'use client';

import DOMPurify from 'dompurify';
import { ExternalLink, FolderOpen, GitBranch, Loader2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Neighborhood from '@/components/Neighborhood';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { buildBundle, navGroups, parseFrontmatter, type Concept, type CoreBundle } from '@/lib/core';
import { renderMarkdown } from '@/lib/markdown';
import { fetchGithubBundle, parseGithubUrl } from '@/lib/sources/github';
import { pickDirectory, readFileList, supportsDirectoryPicker } from '@/lib/sources/local';
import { cn } from '@/lib/utils';

const hashHref = (id: string) => `#/${id}`;

function useHashRoute(): string {
  const [route, setRoute] = useState('');
  useEffect(() => {
    const read = () => setRoute(decodeURIComponent(window.location.hash.replace(/^#\/?/, '')));
    read();
    window.addEventListener('hashchange', read);
    return () => window.removeEventListener('hashchange', read);
  }, []);
  return route;
}

function Markdown({ bundle, body, fromId }: { bundle: CoreBundle; body: string; fromId: string }) {
  const html = useMemo(
    () =>
      DOMPurify.sanitize(
        renderMarkdown(body, fromId, (id) => bundle.byId.has(id), hashHref),
      ),
    [bundle, body, fromId],
  );
  return (
    <section
      className="prose prose-neutral mt-8 max-w-none dark:prose-invert"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

function ConceptView({ bundle, concept }: { bundle: CoreBundle; concept: Concept }) {
  const inbound = (bundle.backlinks.get(concept.id) ?? []).map((id) => bundle.byId.get(id)!);
  const outbound = concept.outLinks.map((id) => bundle.byId.get(id)!);
  return (
    <article className="max-w-3xl">
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
      <Markdown bundle={bundle} body={concept.body} fromId={concept.id} />
      <Neighborhood
        center={{ id: concept.id, title: concept.title }}
        inbound={inbound.map(({ id, title }) => ({ id, title }))}
        outbound={outbound.map(({ id, title }) => ({ id, title }))}
        hrefFor={hashHref}
      />
      {inbound.length > 0 && (
        <section className="mt-8">
          <h2 className="text-xl font-semibold tracking-tight">Cited by</h2>
          <ul className="mt-3 space-y-2">
            {inbound.map((c) => (
              <li key={c.id} className="text-sm leading-relaxed">
                <a href={hashHref(c.id)} className="font-medium text-primary hover:underline">
                  {c.title}
                </a>
                {c.description && <span className="text-muted-foreground"> — {c.description}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}
      <Separator className="mt-10" />
      <footer className="py-4 text-xs text-muted-foreground">Concept ID: {concept.id}</footer>
    </article>
  );
}

function HomeView({ bundle }: { bundle: CoreBundle }) {
  const types = new Map<string, number>();
  for (const c of bundle.concepts) types.set(c.type, (types.get(c.type) ?? 0) + 1);
  const rootIndex = bundle.files.get('index.md');
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
      {rootIndex && <Markdown bundle={bundle} body={parseFrontmatter(rootIndex).body} fromId="" />}
    </article>
  );
}

function BundleShell({ bundle, onClose }: { bundle: CoreBundle; onClose: () => void }) {
  const route = useHashRoute();
  const [q, setQ] = useState('');
  const needle = q.trim().toLowerCase();
  const groups = useMemo(() => navGroups(bundle), [bundle]);
  const concept = route ? bundle.byId.get(route) : undefined;

  const match = (c: Concept) =>
    !needle ||
    c.title.toLowerCase().includes(needle) ||
    c.id.toLowerCase().includes(needle) ||
    c.type.toLowerCase().includes(needle) ||
    c.tags.some((t) => t.toLowerCase().includes(needle));

  return (
    <div className="mx-auto grid max-w-screen-2xl md:grid-cols-[300px_1fr]">
      <nav className="border-b bg-muted/30 md:sticky md:top-14 md:h-[calc(100vh-3.5rem)] md:border-b-0 md:border-r">
        <div className="space-y-2 p-4 pb-2">
          <div className="flex items-center justify-between gap-2">
            <a href="#/" className="truncate text-sm font-semibold">
              {bundle.name}
            </a>
            <Button variant="outline" size="sm" onClick={onClose}>
              Close
            </Button>
          </div>
          <Input
            type="search"
            placeholder="Filter concepts…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Filter concepts"
            className="h-9"
          />
        </div>
        <ScrollArea className="px-4 pb-4 md:h-[calc(100%-6.5rem)]">
          {groups.map(({ group, items }) => {
            const visible = items.filter(match);
            if (!visible.length) return null;
            return (
              <div key={group} className="mt-4">
                <h3 className="px-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {group}
                </h3>
                <ul className="mt-1 space-y-0.5">
                  {visible.map((c) => (
                    <li key={c.id}>
                      <a
                        href={hashHref(c.id)}
                        className={cn(
                          'block rounded-md px-2 py-1.5 text-sm leading-snug hover:bg-accent hover:text-accent-foreground',
                          route === c.id && 'bg-accent font-medium text-accent-foreground',
                        )}
                      >
                        {c.title}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </ScrollArea>
      </nav>
      <main className="min-w-0 px-6 py-8 md:px-12">
        {concept ? (
          <ConceptView bundle={bundle} concept={concept} />
        ) : route ? (
          <p className="text-muted-foreground">No concept “{route}” in this bundle.</p>
        ) : (
          <HomeView bundle={bundle} />
        )}
      </main>
    </div>
  );
}

export default function OpenViewer() {
  const [bundle, setBundle] = useState<CoreBundle | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [repoUrl, setRepoUrl] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);
  const [canPick, setCanPick] = useState(false);
  useEffect(() => setCanPick(supportsDirectoryPicker()), []);

  const load = useCallback((files: Map<string, string>, name: string) => {
    const b = buildBundle(files, name);
    if (!b.concepts.length) {
      setError('No OKF concept documents found (markdown files with frontmatter).');
      return;
    }
    setError(null);
    window.location.hash = '';
    setBundle(b);
  }, []);

  const openLocal = async () => {
    if (canPick) {
      const result = await pickDirectory();
      if (result) load(result.files, result.name);
    } else {
      fileInput.current?.click();
    }
  };

  const openGithub = async () => {
    const ref = parseGithubUrl(repoUrl);
    if (!ref) {
      setError('Could not parse that GitHub URL. Try owner/repo or a full github.com link.');
      return;
    }
    setBusy('Fetching from GitHub…');
    setError(null);
    try {
      const { files, name } = await fetchGithubBundle(ref, (done, total) =>
        setBusy(`Fetching from GitHub… ${done}/${total}`),
      );
      load(files, name);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  if (bundle) {
    return (
      <BundleShell
        bundle={bundle}
        onClose={() => {
          setBundle(null);
          window.location.hash = '';
        }}
      />
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-3xl font-bold tracking-tight">Open a bundle</h1>
      <p className="mt-2 text-muted-foreground">
        Browse any Open Knowledge Format bundle directly in this page. Everything runs in your
        browser — local files are never uploaded.
      </p>
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FolderOpen className="size-4" /> Local folder
            </CardTitle>
            <CardDescription>
              {canPick
                ? 'Pick a bundle directory from your machine.'
                : 'Select a bundle directory (read as a one-time snapshot).'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={openLocal} disabled={!!busy}>
              Choose folder
            </Button>
            <input
              ref={fileInput}
              type="file"
              className="hidden"
              // @ts-expect-error non-standard but universally supported
              webkitdirectory=""
              onChange={async (e) => {
                if (e.target.files?.length) {
                  const { files, name } = await readFileList(e.target.files);
                  load(files, name);
                }
              }}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <GitBranch className="size-4" /> Public GitHub repo
            </CardTitle>
            <CardDescription>owner/repo, or a /tree/branch/subdir URL.</CardDescription>
          </CardHeader>
          <CardContent className="flex gap-2">
            <Input
              placeholder="e.g. GoogleCloudPlatform/knowledge-catalog/tree/main/okf/bundles/ga4"
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && openGithub()}
              disabled={!!busy}
            />
            <Button onClick={openGithub} disabled={!!busy || !repoUrl.trim()}>
              Open
            </Button>
          </CardContent>
        </Card>
      </div>
      {busy && (
        <p className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> {busy}
        </p>
      )}
      {error && <p className="mt-6 text-sm text-destructive">{error}</p>}
    </div>
  );
}
