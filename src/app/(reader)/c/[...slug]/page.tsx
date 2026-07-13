import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ExternalLink } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { loadBundle } from '@/lib/bundle';
import { renderMarkdown } from '@/lib/markdown';
import Neighborhood from '@/components/Neighborhood';
import TourBar from '@/components/tour/TourBar';
import TourView from '@/components/tour/TourView';
import { isTour, resolveTourSteps, toursForStep } from '@okf/core';

export const dynamicParams = false;

export function generateStaticParams() {
  return loadBundle().concepts.map((c) => ({ slug: c.id.split('/') }));
}

export default async function ConceptPage({ params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params;
  const bundle = loadBundle();
  const concept = bundle.byId.get(slug.map(decodeURIComponent).join('/'));
  if (!concept) notFound();

  const html = renderMarkdown(concept.body, concept.id, (id) => bundle.byId.has(id));
  const inbound = (bundle.backlinks.get(concept.id) ?? []).map((id) => bundle.byId.get(id)!);
  const outbound = concept.outLinks.map((id) => bundle.byId.get(id)!);

  if (isTour(concept)) {
    return (
      <TourView
        bundleName={bundle.name}
        tour={{
          id: concept.id,
          title: concept.title,
          type: concept.type,
          description: concept.description,
          timestamp: concept.timestamp,
          tags: concept.tags,
        }}
        introHtml={html}
        steps={resolveTourSteps(bundle, concept)}
      />
    );
  }

  const candidateTours = toursForStep(bundle, concept.id).map((t) => ({
    id: t.id,
    title: t.title,
    steps: resolveTourSteps(bundle, t)
      .filter((s) => s.exists)
      .map(({ id, title }) => ({ id, title })),
  }));

  return (
    <article className="max-w-3xl" data-pagefind-body data-pagefind-meta={`type:${concept.type}`}>
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge>{concept.type}</Badge>
        {concept.timestamp && (
          <time className="text-sm text-muted-foreground">{concept.timestamp.slice(0, 10)}</time>
        )}
        {concept.tags.map((t) => (
          <Badge key={t} variant="outline">
            {t}
          </Badge>
        ))}
      </div>
      <h1 className="mt-3 text-3xl font-bold tracking-tight">{concept.title}</h1>
      {concept.description && <p className="mt-2 text-lg text-muted-foreground">{concept.description}</p>}
      {concept.resource && (
        <p className="mt-2 break-all text-sm">
          <a
            href={concept.resource}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-primary hover:underline"
          >
            <ExternalLink className="size-3.5 shrink-0" />
            {concept.resource}
          </a>
        </p>
      )}

      <section
        className="prose prose-neutral mt-8 max-w-none dark:prose-invert"
        dangerouslySetInnerHTML={{ __html: html }}
      />

      <Neighborhood
        center={{ id: concept.id, title: concept.title }}
        inbound={inbound.map(({ id, title }) => ({ id, title }))}
        outbound={outbound.map(({ id, title }) => ({ id, title }))}
      />

      {inbound.length > 0 && (
        <section className="mt-8">
          <h2 className="text-xl font-semibold tracking-tight">Cited by</h2>
          <ul className="mt-3 space-y-2">
            {inbound.map((c) => (
              <li key={c.id} className="text-sm leading-relaxed">
                <Link href={`/c/${c.id}/`} className="font-medium text-primary hover:underline">
                  {c.title}
                </Link>
                {c.description && <span className="text-muted-foreground"> — {c.description}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}

      <Separator className="mt-10" />
      <footer className="py-4 text-xs text-muted-foreground">Concept ID: {concept.id}</footer>

      {candidateTours.length > 0 && (
        <TourBar bundleName={bundle.name} conceptId={concept.id} tours={candidateTours} />
      )}
    </article>
  );
}
