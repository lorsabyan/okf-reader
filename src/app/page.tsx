import fs from 'node:fs';
import path from 'node:path';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
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
    <article className="max-w-3xl">
      <h1 className="text-3xl font-bold tracking-tight">{bundle.name}</h1>
      <p className="mt-1 text-muted-foreground">
        {bundle.concepts.length} concepts · {types.size} types
      </p>

      <div className="mt-4 flex flex-wrap gap-1.5">
        {[...types.entries()]
          .sort(([, a], [, b]) => b - a)
          .map(([t, n]) => (
            <Badge key={t} variant="secondary">
              {t}
              <span className="ml-1 font-bold">{n}</span>
            </Badge>
          ))}
      </div>

      {indexHtml && (
        <section
          className="prose prose-neutral mt-8 max-w-none dark:prose-invert"
          dangerouslySetInnerHTML={{ __html: indexHtml }}
        />
      )}

      {recent.length > 0 && (
        <section className="mt-10">
          <h2 className="text-xl font-semibold tracking-tight">Recently updated</h2>
          <ul className="mt-3 space-y-2">
            {recent.map((c) => (
              <li key={c.id} className="text-sm leading-relaxed">
                <Link href={`/c/${c.id}/`} className="font-medium text-primary hover:underline">
                  {c.title}
                </Link>
                <span className="text-muted-foreground"> — {c.description || c.type}</span>{' '}
                <time className="text-muted-foreground">({c.timestamp!.slice(0, 10)})</time>
              </li>
            ))}
          </ul>
        </section>
      )}
    </article>
  );
}
