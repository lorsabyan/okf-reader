import { staleSince, trustTier, lastVerifiedAt, type Concept } from '@lorsabyan/okf-core';
import { Badge } from '@/components/ui/badge';

/**
 * The badge row under a concept's breadcrumbs: type, lifecycle status, trust
 * tier, staleness, date, tags.
 *
 * Shared by the static reader and the runtime viewer, which render the same row
 * from the same model — see the SSG/runtime dedup follow-up in plans/README.md.
 *
 * Everything here is advisory. Spec §5.3 is explicit that trust tiers are
 * signals rather than access control, so this labels content and never hides or
 * gates it.
 */

const TRUST_LABEL = {
  'human-reviewed': 'human-reviewed',
  'machine-confirmed': 'machine-confirmed',
  unverified: 'unverified',
} as const;

// Descending prominence. `default` is deliberately unused: the type badge
// already owns it, and a trust badge competing with it reads as two titles.
const TRUST_VARIANT = {
  'human-reviewed': 'secondary',
  'machine-confirmed': 'outline',
  unverified: 'ghost',
} as const;

export default function ConceptMeta({ concept }: { concept: Concept }) {
  const tier = trustTier(concept);
  const verifiedAt = lastVerifiedAt(concept);
  // Evaluated when the page is rendered — at build time for the static reader.
  // A published site therefore reports staleness as of its last build, which is
  // the same freshness contract as the rest of its content.
  const expired = staleSince(concept);

  return (
    <div className="mt-3 flex flex-wrap items-center gap-1.5">
      <Badge>{concept.type}</Badge>

      {concept.status === 'deprecated' && <Badge variant="destructive">deprecated</Badge>}
      {concept.status === 'draft' && <Badge variant="warning">draft</Badge>}

      <Badge
        variant={TRUST_VARIANT[tier]}
        title={
          concept.verified.length
            ? `Verified by ${concept.verified.map((v) => v.by).join(', ')}${verifiedAt ? ` (${verifiedAt.slice(0, 10)})` : ''}`
            : 'No verification recorded'
        }
      >
        {TRUST_LABEL[tier]}
      </Badge>

      {expired && <Badge variant="warning">stale since {expired}</Badge>}

      {concept.updatedAt && (
        <time className="text-sm text-muted-foreground" dateTime={concept.updatedAt}>
          {concept.updatedAt.slice(0, 10)}
        </time>
      )}

      {concept.tags.map((t) => (
        <Badge key={t} variant="outline">
          {t}
        </Badge>
      ))}
    </div>
  );
}
