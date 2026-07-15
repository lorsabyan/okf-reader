import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { loadBundle } from '@/lib/bundle';
import { analyzeBundle } from '@okf/core';

export const metadata = { title: 'Bundle health' };

function ConceptLink({ id }: { id: string }) {
  const concept = loadBundle().byId.get(id);
  return (
    <Link href={`/c/${id}/`} className="font-medium text-primary hover:underline">
      {concept?.title ?? id}
    </Link>
  );
}

function Section({
  title,
  count,
  severity = 'warning',
  children,
}: {
  title: string;
  count: number;
  severity?: 'destructive' | 'warning';
  children?: React.ReactNode;
}) {
  return (
    <section className="mt-8">
      <div className="flex items-center gap-2">
        <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
        <Badge variant={count > 0 ? severity : 'outline'}>{count}</Badge>
      </div>
      <div className="mt-3">
        {count > 0 ? (
          children
        ) : (
          <p className="text-sm text-muted-foreground">none 🎉</p>
        )}
      </div>
    </section>
  );
}

export default function HealthPage() {
  const bundle = loadBundle();
  const report = analyzeBundle(bundle);

  return (
    <article className="max-w-3xl">
      <h1 className="text-3xl font-bold tracking-tight">Bundle health</h1>
      <p className="mt-2 text-muted-foreground">
        Automated checks over {bundle.concepts.length} concepts in {bundle.name}.
      </p>

      <div className="mt-4 flex flex-wrap gap-1.5">
        <Badge variant={report.brokenLinks.length ? 'destructive' : 'outline'}>
          Broken links <span className="ml-1 font-bold">{report.brokenLinks.length}</span>
        </Badge>
        <Badge variant={report.missingDescriptions.length ? 'warning' : 'outline'}>
          Missing descriptions <span className="ml-1 font-bold">{report.missingDescriptions.length}</span>
        </Badge>
        <Badge variant={report.untyped.length ? 'warning' : 'outline'}>
          Untyped <span className="ml-1 font-bold">{report.untyped.length}</span>
        </Badge>
        <Badge variant={report.stale.length ? 'warning' : 'outline'}>
          Stale <span className="ml-1 font-bold">{report.stale.length}</span>
        </Badge>
        <Badge variant={report.undated.length ? 'warning' : 'outline'}>
          Undated <span className="ml-1 font-bold">{report.undated.length}</span>
        </Badge>
        <Badge variant={report.orphans.length ? 'warning' : 'outline'}>
          Orphans <span className="ml-1 font-bold">{report.orphans.length}</span>
        </Badge>
      </div>

      <Section title="Broken links" count={report.brokenLinks.length} severity="destructive">
        <ul className="space-y-2">
          {report.brokenLinks.map(({ fromId, target }) => (
            <li key={`${fromId}->${target}`} className="text-sm leading-relaxed">
              <ConceptLink id={fromId} /> <span className="text-muted-foreground">→ {target}</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Missing descriptions" count={report.missingDescriptions.length}>
        <ul className="space-y-2">
          {report.missingDescriptions.map((id) => (
            <li key={id} className="text-sm leading-relaxed">
              <ConceptLink id={id} />
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Untyped concepts" count={report.untyped.length}>
        <ul className="space-y-2">
          {report.untyped.map((id) => (
            <li key={id} className="text-sm leading-relaxed">
              <ConceptLink id={id} />
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Stale concepts (older than a year)" count={report.stale.length}>
        <ul className="space-y-2">
          {report.stale.map(({ id, timestamp }) => (
            <li key={id} className="text-sm leading-relaxed">
              <ConceptLink id={id} /> <span className="text-muted-foreground">({timestamp.slice(0, 10)})</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Undated concepts" count={report.undated.length}>
        <ul className="space-y-2">
          {report.undated.map((id) => (
            <li key={id} className="text-sm leading-relaxed">
              <ConceptLink id={id} />
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Orphans (no inbound or outbound links)" count={report.orphans.length}>
        <ul className="space-y-2">
          {report.orphans.map((id) => (
            <li key={id} className="text-sm leading-relaxed">
              <ConceptLink id={id} />
            </li>
          ))}
        </ul>
      </Section>
    </article>
  );
}
