import fs from 'node:fs';
import path from 'node:path';
import Link from 'next/link';
import { loadBundle } from '@/lib/bundle';
import { renderMarkdown } from '@/lib/markdown';

export default function Home() {
  const bundle = loadBundle();
  const types = new Map<string, number>();
  for (const c of bundle.concepts) types.set(c.type, (types.get(c.type) ?? 0) + 1);

  const recent = bundle.concepts
    .filter((c) => c.timestamp)
    .sort((a, b) => (b.timestamp! < a.timestamp! ? -1 : 1))
    .slice(0, 8);

  const rootIndex = path.join(bundle.dir, 'index.md');
  const indexHtml = fs.existsSync(rootIndex)
    ? renderMarkdown(fs.readFileSync(rootIndex, 'utf-8').replace(/^---[\s\S]*?---\n/, ''), '', (id) => bundle.byId.has(id))
    : null;

  return (
    <article>
      <h1>{bundle.name}</h1>
      <p className="stats">
        {bundle.concepts.length} concepts · {types.size} types
      </p>

      <div className="type-chips">
        {[...types.entries()]
          .sort(([, a], [, b]) => b - a)
          .map(([t, n]) => (
            <span key={t} className="badge">
              {t} <b>{n}</b>
            </span>
          ))}
      </div>

      {indexHtml && <section className="md-body" dangerouslySetInnerHTML={{ __html: indexHtml }} />}

      {recent.length > 0 && (
        <section>
          <h2>Recently updated</h2>
          <ul className="recent">
            {recent.map((c) => (
              <li key={c.id}>
                <Link href={`/c/${c.id}/`}>{c.title}</Link>
                <span className="muted"> — {c.description || c.type}</span>
                <time className="muted"> ({c.timestamp!.slice(0, 10)})</time>
              </li>
            ))}
          </ul>
        </section>
      )}
    </article>
  );
}
