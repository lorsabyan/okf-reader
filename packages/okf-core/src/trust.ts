/**
 * OKF v0.2 trust and lifecycle derivation (spec §5.2–§5.5).
 *
 * These answers are *derived*, never stored: the spec is explicit that a trust
 * score would be subjective, unportable between consumers, and stale the moment
 * it is written. Absence carries meaning here — a concept with no `verified` is
 * distinguishable from a verified one, but is never invalid.
 *
 * Browser-safe (no node imports), per the @lorsabyan/okf-core rules in CLAUDE.md.
 */

/** An identity recorded against a concept: `generated.by`, `verified[].by`. */
export interface Actor {
  /** Spec §7: `<producer>/<version>`, `human:<id>`, or `process:<id>`. */
  by: string;
  /** ISO 8601. Optional — `generated.by` is required within `generated`, `at` is not. */
  at?: string;
}

/** A material a concept derives from (spec §5.1). */
export interface Source {
  /** Stable key that body footnotes (`[^id]`) join against. */
  id?: string;
  /**
   * Either something followable (URL, bundle path) or a population/scope
   * descriptor that is deliberately not a link, e.g.
   * "all queries in BigQuery project X". Callers must not assume it is a URL.
   */
  resource: string;
  title?: string;
  /** Who produced the source, in the actor convention (§7). An authority signal. */
  author?: string;
  /** How often the source was exercised over the bundle's usage window. */
  usageCount?: number;
  /** `YYYY-MM-DD`. When the source itself last changed — distinct from `generated.at`. */
  lastModified?: string;
}

export type ConceptStatus = 'draft' | 'stable' | 'deprecated';

export type TrustTier = 'unverified' | 'machine-confirmed' | 'human-reviewed';

const STATUSES: ReadonlySet<string> = new Set<ConceptStatus>(['draft', 'stable', 'deprecated']);

const HUMAN_PREFIX = 'human:';

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function toActor(value: unknown): Actor | undefined {
  const rec = asRecord(value);
  if (!rec) return undefined;
  const by = rec.by;
  if (typeof by !== 'string' || !by.trim()) return undefined;
  const at = rec.at;
  return { by, ...(at != null ? { at: String(at) } : {}) };
}

/** Parse frontmatter `generated` into an Actor, or undefined when absent/malformed. */
export function parseGenerated(value: unknown): Actor | undefined {
  return toActor(value);
}

/**
 * Parse frontmatter `verified` into a list (spec §5.2).
 *
 * A single verifier MAY be written as one `{ by, at }` mapping without the list
 * dash, and consumers MUST treat that bare mapping as a one-element list — so
 * this always returns an array and callers never branch on the written shape.
 */
export function normalizeVerified(value: unknown): Actor[] {
  if (value == null) return [];
  const raw = Array.isArray(value) ? value : [value];
  return raw.map(toActor).filter((a): a is Actor => a !== undefined);
}

/** Parse frontmatter `sources` (spec §5.1). Entries without a `resource` are dropped. */
export function parseSources(value: unknown): Source[] {
  if (!Array.isArray(value)) return [];
  const sources: Source[] = [];
  for (const entry of value) {
    const rec = asRecord(entry);
    if (!rec) continue;
    const resource = rec.resource;
    if (typeof resource !== 'string' || !resource.trim()) continue;
    const usageCount = Number(rec.usageCount ?? rec.usage_count);
    sources.push({
      resource,
      ...(typeof rec.id === 'string' ? { id: rec.id } : {}),
      ...(typeof rec.title === 'string' ? { title: rec.title } : {}),
      ...(typeof rec.author === 'string' ? { author: rec.author } : {}),
      ...(Number.isFinite(usageCount) ? { usageCount } : {}),
      ...(rec.lastModified ?? rec.last_modified
        ? { lastModified: String(rec.lastModified ?? rec.last_modified) }
        : {}),
    });
  }
  return sources;
}

/** Parse frontmatter `status` (spec §5.4). Absent or unrecognized ⇒ 'stable'. */
export function parseStatus(value: unknown): ConceptStatus {
  const s = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return STATUSES.has(s) ? (s as ConceptStatus) : 'stable';
}

/**
 * Derive a trust tier from `verified` (spec §5.3), lowest to highest:
 * no `verified` ⇒ unverified; non-`human:` actors only ⇒ machine-confirmed;
 * any `human:` actor ⇒ human-reviewed.
 *
 * Advisory only. Spec §5.3 is explicit that tiers are signals, not access
 * control, so callers should label content with this and never gate on it.
 */
export function trustTier(concept: { verified?: Actor[] }): TrustTier {
  const events = concept.verified ?? [];
  if (events.length === 0) return 'unverified';
  return events.some((e) => e.by.startsWith(HUMAN_PREFIX)) ? 'human-reviewed' : 'machine-confirmed';
}

/** The most recent `verified[].at`, or undefined when none carries one. */
export function lastVerifiedAt(concept: { verified?: Actor[] }): string | undefined {
  const stamps = (concept.verified ?? []).map((e) => e.at).filter((at): at is string => !!at);
  if (stamps.length === 0) return undefined;
  return stamps.reduce((latest, at) => (at > latest ? at : latest));
}

/**
 * The `stale_after` date when the concept is stale on `now`, else undefined
 * (spec §5.5: stale when `today >= stale_after`).
 *
 * An absolute date rather than a TTL is what keeps this a plain comparison with
 * no reference to when the concept was read. `now` is injectable so tests do
 * not rot as the real clock moves past a fixture's date.
 */
export function staleSince(
  concept: { staleAfter?: string },
  now: Date = new Date(),
): string | undefined {
  const deadline = concept.staleAfter;
  if (!deadline) return undefined;
  const parsed = Date.parse(`${deadline.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(parsed)) return undefined;
  // Compare date-only, in UTC, so a local timezone cannot shift the boundary day.
  const today = Date.parse(`${now.toISOString().slice(0, 10)}T00:00:00Z`);
  return today >= parsed ? deadline : undefined;
}
