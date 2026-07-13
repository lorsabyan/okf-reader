import { extractLinkTargets, isReservedTarget, resolveLink, type CoreBundle } from './core.ts';

const DAY_MS = 24 * 60 * 60 * 1000;
const STALE_AFTER_MS = 365 * DAY_MS;

export interface HealthReport {
  brokenLinks: { fromId: string; target: string }[];
  missingDescriptions: string[];
  untyped: string[];
  stale: { id: string; timestamp: string }[];
  undated: string[];
  orphans: string[];
}

/** Analyze a bundle for common documentation-health issues. */
export function analyzeBundle(bundle: Pick<CoreBundle, 'concepts' | 'byId' | 'backlinks'>): HealthReport {
  const now = Date.now();

  const brokenLinks: { fromId: string; target: string }[] = [];
  const missingDescriptions: string[] = [];
  const untyped: string[] = [];
  const stale: { id: string; timestamp: string }[] = [];
  const undated: string[] = [];
  const orphans: string[] = [];

  for (const c of bundle.concepts) {
    const seen = new Set<string>();
    for (const raw of extractLinkTargets(c.body)) {
      const target = resolveLink(raw, c.id);
      if (target === c.id || seen.has(target)) continue;
      seen.add(target);
      if (!bundle.byId.has(target) && !isReservedTarget(target)) {
        brokenLinks.push({ fromId: c.id, target });
      }
    }

    if (!c.description) missingDescriptions.push(c.id);
    if (!c.typeExplicit) untyped.push(c.id);

    if (c.timestamp) {
      const ts = Date.parse(c.timestamp);
      if (!Number.isNaN(ts) && now - ts > STALE_AFTER_MS) stale.push({ id: c.id, timestamp: c.timestamp });
    } else {
      undated.push(c.id);
    }

    const hasInbound = (bundle.backlinks.get(c.id) ?? []).length > 0;
    const hasOutbound = c.outLinks.length > 0;
    if (!hasInbound && !hasOutbound) orphans.push(c.id);
  }

  stale.sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));

  return { brokenLinks, missingDescriptions, untyped, stale, undated, orphans };
}
