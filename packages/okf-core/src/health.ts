import { extractLinkTargets, isReservedTarget, resolveLink, type CoreBundle } from './core.ts';
import { staleSince, trustTier } from './trust.ts';

const DAY_MS = 24 * 60 * 60 * 1000;
const AGING_AFTER_MS = 365 * DAY_MS;

export interface HealthReport {
  brokenLinks: { fromId: string; target: string }[];
  missingDescriptions: string[];
  untyped: string[];
  /**
   * Past the author's own `stale_after` (spec §5.5). This is the spec's notion
   * of staleness: an absolute date the author chose, not a guess about age.
   */
  stale: { id: string; staleSince: string }[];
  /**
   * Not updated in over a year. A heuristic this reader invented, kept because
   * it is a genuine smell in bundles whose authors never set `stale_after` —
   * but no longer conflated with `stale`. A concept can be two years old and
   * deliberately current, or a week old and already expired.
   */
  aging: { id: string; updatedAt: string }[];
  /** No `generated.at` and no legacy `timestamp`. */
  undated: string[];
  /** No `verified` entries (spec §5.3). Informational, never a defect. */
  unverified: string[];
  /** `status: deprecated` (spec §5.4). */
  deprecated: string[];
  orphans: string[];
}

/**
 * Analyze a bundle for common documentation-health issues.
 *
 * `now` is injectable so callers (and tests) get a stable answer instead of one
 * that changes as the real clock crosses a concept's `stale_after`.
 */
export function analyzeBundle(
  bundle: Pick<CoreBundle, 'concepts' | 'byId' | 'backlinks'>,
  now: Date = new Date(),
): HealthReport {
  const nowMs = now.getTime();

  const brokenLinks: { fromId: string; target: string }[] = [];
  const missingDescriptions: string[] = [];
  const untyped: string[] = [];
  const stale: { id: string; staleSince: string }[] = [];
  const aging: { id: string; updatedAt: string }[] = [];
  const undated: string[] = [];
  const unverified: string[] = [];
  const deprecated: string[] = [];
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

    const expired = staleSince(c, now);
    if (expired) stale.push({ id: c.id, staleSince: expired });

    // `updatedAt` covers both v0.2 `generated.at` and v0.1 `timestamp`, so
    // aging and undated work the same for either vintage of bundle.
    if (c.updatedAt) {
      const ts = Date.parse(c.updatedAt);
      if (!Number.isNaN(ts) && nowMs - ts > AGING_AFTER_MS) {
        aging.push({ id: c.id, updatedAt: c.updatedAt });
      }
    } else {
      undated.push(c.id);
    }

    if (trustTier(c) === 'unverified') unverified.push(c.id);
    if (c.status === 'deprecated') deprecated.push(c.id);

    const hasInbound = (bundle.backlinks.get(c.id) ?? []).length > 0;
    const hasOutbound = c.outLinks.length > 0;
    if (!hasInbound && !hasOutbound) orphans.push(c.id);
  }

  stale.sort((a, b) => a.staleSince.localeCompare(b.staleSince));
  aging.sort((a, b) => Date.parse(a.updatedAt) - Date.parse(b.updatedAt));

  return {
    brokenLinks,
    missingDescriptions,
    untyped,
    stale,
    aging,
    undated,
    unverified,
    deprecated,
    orphans,
  };
}
