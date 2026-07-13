import Link from 'next/link';
import { notFound } from 'next/navigation';
import { loadBundle } from '@/lib/bundle';
import { renderMarkdown } from '@/lib/markdown';
import Neighborhood from '@/components/Neighborhood';

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

  return (
    <article>
      <div className="concept-meta">
        <span className="badge badge-type">{concept.type}</span>
        {concept.timestamp && <time className="muted">{concept.timestamp.slice(0, 10)}</time>}
        {concept.tags.map((t) => (
          <span key={t} className="badge badge-tag">
            {t}
          </span>
        ))}
      </div>
      <h1>{concept.title}</h1>
      {concept.description && <p className="description">{concept.description}</p>}
      {concept.resource && (
        <p className="resource">
          Resource:{' '}
          <a href={concept.resource} target="_blank" rel="noreferrer">
            {concept.resource}
          </a>
        </p>
      )}

      <section className="md-body" dangerouslySetInnerHTML={{ __html: html }} />

      <Neighborhood
        center={{ id: concept.id, title: concept.title }}
        inbound={inbound.map(({ id, title }) => ({ id, title }))}
        outbound={outbound.map(({ id, title }) => ({ id, title }))}
      />

      {inbound.length > 0 && (
        <section className="cited-by">
          <h2>Cited by</h2>
          <ul>
            {inbound.map((c) => (
              <li key={c.id}>
                <Link href={`/c/${c.id}/`}>{c.title}</Link>
                {c.description && <span className="muted"> — {c.description}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}

      <footer className="concept-footer muted">Concept ID: {concept.id}</footer>
    </article>
  );
}
