'use client';

import {
  Activity,
  Check,
  ExternalLink,
  FolderOpen,
  GitBranch,
  Link as LinkIcon,
  Loader2,
  Menu,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import Breadcrumbs from '@/components/Breadcrumbs';
import HealthView from '@/components/open/HealthView';
import Neighborhood from '@/components/Neighborhood';
import PageToc from '@/components/PageToc';
import PrevNext from '@/components/PrevNext';
import TourBar from '@/components/tour/TourBar';
import TourSection from '@/components/tour/TourSection';
import TourView from '@/components/tour/TourView';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import {
  buildBundle,
  detectBundleRoot,
  navGroups,
  parseFrontmatter,
  type Concept,
  type CoreBundle,
  type DetectedRoot,
} from '@okf/core';
import { loadHandle, saveHandle, deleteHandle, listHandleKeys } from '@/lib/idb-handles';
import { renderMarkdown } from '@/lib/markdown';
import { prevNextInGroup } from '@/lib/prev-next';
import { PROSE_CLASS } from '@/lib/prose';
import {
  deleteRecent,
  getRecents,
  recordGithubRecent,
  recordLocalRecent,
  relativeTime,
  type GithubRecentEntry,
  type LocalRecentEntry,
  type RecentEntry,
} from '@/lib/recents';
import { fetchGithubBundle, formatGithubRef, parseGithubUrl, type GithubRef } from '@/lib/sources/github';
import { pickDirectory, readFileList, reopenDirectory, supportsDirectoryPicker, type DirHandle } from '@/lib/sources/local';
import { getTourSummaries, isTour, resolveTourSteps, toursForStep } from '@okf/core';
import { cn } from '@/lib/utils';

const hashHref = (id: string) => `#/${id}`;
const HEALTH_ROUTE = '~health';

/** Replace the `src` search param in place, preserving path and hash. */
function setShareParam(src: string | null) {
  const url = new URL(window.location.href);
  if (src) url.searchParams.set('src', src);
  else url.searchParams.delete('src');
  window.history.replaceState(null, '', url.toString());
}

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
  const { html } = useMemo(
    () => renderMarkdown(body, fromId, (id) => bundle.byId.has(id), hashHref),
    [bundle, body, fromId],
  );
  return <section className={PROSE_CLASS} dangerouslySetInnerHTML={{ __html: html }} />;
}

function ConceptView({ bundle, concept }: { bundle: CoreBundle; concept: Concept }) {
  const tour = isTour(concept);
  const rendered = useMemo(
    () => renderMarkdown(concept.body, concept.id, (id) => bundle.byId.has(id), hashHref, concept.description),
    [bundle, concept],
  );
  const candidateTours = useMemo(
    () =>
      toursForStep(bundle, concept.id).map((t) => ({
        id: t.id,
        title: t.title,
        steps: resolveTourSteps(bundle, t)
          .filter((s) => s.exists)
          .map(({ id, title }) => ({ id, title })),
      })),
    [bundle, concept.id],
  );
  const { prev, next } = useMemo(() => prevNextInGroup(bundle, concept.id), [bundle, concept.id]);
  const inbound = (bundle.backlinks.get(concept.id) ?? []).map((id) => bundle.byId.get(id)!);
  const outbound = concept.outLinks.map((id) => bundle.byId.get(id)!);

  if (tour) {
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
        introHtml={rendered.html}
        steps={resolveTourSteps(bundle, concept)}
        hrefFor={hashHref}
      />
    );
  }

  return (
    <div className="flex gap-8">
      <article className="min-w-0 max-w-3xl flex-1">
        <Breadcrumbs id={concept.id} title={concept.title} homeHref="#/" />
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
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
        <section className={PROSE_CLASS} dangerouslySetInnerHTML={{ __html: rendered.html }} />
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

        <PrevNext prev={prev} next={next} hrefFor={hashHref} />

        <Separator className="mt-10" />
        <footer className="py-4 text-xs text-muted-foreground">Concept ID: {concept.id}</footer>

        {candidateTours.length > 0 && (
          <TourBar bundleName={bundle.name} conceptId={concept.id} tours={candidateTours} hrefFor={hashHref} />
        )}
      </article>
      <PageToc headings={rendered.headings} />
    </div>
  );
}

function HomeView({ bundle }: { bundle: CoreBundle }) {
  const types = new Map<string, number>();
  for (const c of bundle.concepts) types.set(c.type, (types.get(c.type) ?? 0) + 1);
  const rootIndex = bundle.files.get('index.md');
  const tours = useMemo(() => getTourSummaries(bundle), [bundle]);
  const recent = useMemo(
    () =>
      bundle.concepts
        .filter((c) => c.timestamp)
        .sort((a, b) => (b.timestamp! < a.timestamp! ? -1 : 1))
        .slice(0, 8),
    [bundle],
  );
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

      <TourSection bundleName={bundle.name} tours={tours} hrefFor={hashHref} />

      {rootIndex && <Markdown bundle={bundle} body={parseFrontmatter(rootIndex).body} fromId="" />}

      {recent.length > 0 && (
        <section className="mt-10">
          <h2 className="text-xl font-semibold tracking-tight">Recently updated</h2>
          <ul className="mt-3 space-y-2">
            {recent.map((c) => (
              <li key={c.id} className="text-sm leading-relaxed">
                <a href={hashHref(c.id)} className="font-medium text-primary hover:underline">
                  {c.title}
                </a>
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

function ShareButton() {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const share = async () => {
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 1500);
  };

  return (
    <Button variant="outline" size="sm" onClick={share}>
      {copied ? <Check className="size-3.5" /> : <LinkIcon className="size-3.5" />}
      {copied ? 'Copied' : 'Share'}
    </Button>
  );
}

/** Dismissible notice offering to re-root the bundle at a better-resolving subdirectory. */
function RootSuggestionBanner({
  detected,
  onReRoot,
  onDismiss,
}: {
  detected: DetectedRoot;
  onReRoot: () => void;
  onDismiss: () => void;
}) {
  const broken = detected.rootTotal - detected.rootResolved;
  return (
    <div className="mx-auto max-w-screen-2xl px-4 pt-3">
      <Card className="flex-row flex-wrap items-center justify-between gap-3 border-amber-500/40 bg-amber-500/10 px-4 py-3">
        <p className="text-sm leading-relaxed">
          <strong>{broken}</strong> of <strong>{detected.rootTotal}</strong> cross-links don&apos;t resolve
          here, but would under{' '}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">{detected.prefix}/</code>.
        </p>
        <div className="flex shrink-0 gap-2">
          <Button size="sm" onClick={onReRoot}>
            Re-root to {detected.prefix}/
          </Button>
          <Button size="sm" variant="ghost" onClick={onDismiss}>
            Dismiss
          </Button>
        </div>
      </Card>
    </div>
  );
}

/** Filter input + grouped concept list + header actions, shared between the desktop `<nav>` and the mobile drawer. */
function BundleNavContent({
  bundle,
  groups,
  route,
  shareable,
  onClose,
  onNavigate,
}: {
  bundle: CoreBundle;
  groups: { group: string; items: Concept[] }[];
  route: string;
  shareable: boolean;
  onClose: () => void;
  onNavigate?: () => void;
}) {
  const [q, setQ] = useState('');
  const needle = q.trim().toLowerCase();
  const bodies = useMemo(
    () => new Map(bundle.concepts.map((c) => [c.id, c.body.toLowerCase()])),
    [bundle],
  );

  const matchesMeta = (c: Concept) =>
    !needle ||
    c.title.toLowerCase().includes(needle) ||
    c.id.toLowerCase().includes(needle) ||
    c.type.toLowerCase().includes(needle) ||
    c.tags.some((t) => t.toLowerCase().includes(needle));
  const matchesBody = (c: Concept) => !!needle && (bodies.get(c.id) ?? '').includes(needle);
  const match = (c: Concept) => matchesMeta(c) || matchesBody(c);

  return (
    <>
      <div className="space-y-2 p-4 pb-2">
        <div className="flex items-center justify-between gap-2">
          <a href="#/" onClick={onNavigate} className="truncate text-sm font-semibold">
            {bundle.name}
          </a>
          <Button variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Button variant="outline" size="sm" asChild>
            <a href={hashHref(HEALTH_ROUTE)} onClick={onNavigate}>
              <Activity className="size-3.5" />
              Bundle health
            </a>
          </Button>
          {shareable && <ShareButton />}
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
      <ScrollArea className="px-4 pb-4 md:h-[calc(100%-9rem)]">
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
                      onClick={onNavigate}
                      className={cn(
                        'block rounded-md px-2 py-1.5 text-sm leading-snug hover:bg-accent hover:text-accent-foreground',
                        route === c.id && 'bg-accent font-medium text-accent-foreground',
                      )}
                    >
                      {c.title}
                      {needle && !matchesMeta(c) && matchesBody(c) && (
                        <span className="ml-1.5 text-xs text-muted-foreground">(body match)</span>
                      )}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </ScrollArea>
    </>
  );
}

function BundleShell({
  bundle,
  shareable,
  banner,
  onClose,
}: {
  bundle: CoreBundle;
  shareable: boolean;
  banner?: ReactNode;
  onClose: () => void;
}) {
  const route = useHashRoute();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const groups = useMemo(() => navGroups(bundle), [bundle]);
  const concept = route && route !== HEALTH_ROUTE ? bundle.byId.get(route) : undefined;

  return (
    <>
      {banner}
      <div className="mx-auto grid max-w-screen-2xl md:grid-cols-[300px_1fr]">
        <div className="flex items-center gap-2 border-b bg-muted/30 p-3 md:hidden">
          <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" aria-label="Open navigation menu">
                <Menu className="size-4" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 gap-0 p-0">
              <SheetHeader className="border-b">
                <SheetTitle className="truncate text-sm">{bundle.name}</SheetTitle>
              </SheetHeader>
              <BundleNavContent
                bundle={bundle}
                groups={groups}
                route={route}
                shareable={shareable}
                onClose={onClose}
                onNavigate={() => setMobileNavOpen(false)}
              />
            </SheetContent>
          </Sheet>
          <a href="#/" className="truncate text-sm font-semibold">
            {bundle.name}
          </a>
        </div>
        <nav className="hidden border-b bg-muted/30 md:sticky md:top-14 md:block md:h-[calc(100vh-3.5rem)] md:border-b-0 md:border-r">
          <BundleNavContent bundle={bundle} groups={groups} route={route} shareable={shareable} onClose={onClose} />
        </nav>
        <main className="min-w-0 px-6 py-8 md:px-12">
          {route === HEALTH_ROUTE ? (
            <HealthView bundle={bundle} />
          ) : concept ? (
            <ConceptView bundle={bundle} concept={concept} />
          ) : route ? (
            <p className="text-muted-foreground">No concept “{route}” in this bundle.</p>
          ) : (
            <HomeView bundle={bundle} />
          )}
        </main>
      </div>
    </>
  );
}

/** Match predicate for a recent entry, used both to find and to delete it. */
function sameRecent(a: RecentEntry) {
  return (b: RecentEntry) => (a.kind === 'github' ? b.kind === 'github' && b.src === a.src : b.kind === 'local' && b.name === a.name);
}

/** "Recent" list below the two open-a-bundle cards on the /open landing page. */
function RecentsSection({
  busy,
  onOpenGithub,
  onOpenLocal,
}: {
  busy: boolean;
  onOpenGithub: (entry: GithubRecentEntry) => void;
  onOpenLocal: (entry: LocalRecentEntry, handle: DirHandle) => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [recents, setRecents] = useState<RecentEntry[]>([]);
  const [handleNames, setHandleNames] = useState<Set<string>>(new Set());

  useEffect(() => {
    setMounted(true);
    setRecents(getRecents());
    listHandleKeys()
      .then((keys) => setHandleNames(new Set(keys)))
      .catch(() => setHandleNames(new Set()));
  }, []);

  if (!mounted || recents.length === 0) return null;

  const remove = (entry: RecentEntry) => {
    setRecents(deleteRecent(sameRecent(entry)));
    if (entry.kind === 'local') deleteHandle(entry.name).catch(() => {});
  };

  const open = async (entry: RecentEntry) => {
    if (entry.kind === 'github') {
      onOpenGithub(entry);
      return;
    }
    const handle = await loadHandle(entry.name);
    if (handle) onOpenLocal(entry, handle);
  };

  return (
    <section className="mt-10">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Recent</h2>
      <ul className="mt-3 space-y-1">
        {recents.map((entry) => {
          const Icon = entry.kind === 'github' ? GitBranch : FolderOpen;
          const canOpen = entry.kind === 'github' || handleNames.has(entry.name);
          const key = entry.kind === 'github' ? `github:${entry.src}` : `local:${entry.name}`;
          return (
            <li key={key} className="flex items-center gap-1 rounded-md py-2 pl-2 pr-1 hover:bg-muted/50">
              <button
                type="button"
                disabled={!canOpen || busy}
                title={canOpen ? undefined : 're-select the folder to reopen'}
                onClick={() => open(entry)}
                className={cn(
                  'flex min-w-0 flex-1 items-center gap-2 text-left text-sm',
                  canOpen ? 'text-foreground' : 'cursor-not-allowed text-muted-foreground',
                )}
              >
                <Icon className="size-3.5 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate">
                  {entry.name}
                  {entry.kind === 'github' && (
                    <span className="ml-1.5 text-xs text-muted-foreground">({entry.src})</span>
                  )}
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">{relativeTime(entry.openedAt)}</span>
              </button>
              <button
                type="button"
                aria-label={`Remove ${entry.name} from recents`}
                onClick={() => remove(entry)}
                className="shrink-0 rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="size-3.5" />
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export default function OpenViewer() {
  const [bundle, setBundle] = useState<CoreBundle | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [repoUrl, setRepoUrl] = useState('');
  const [githubRef, setGithubRef] = useState<GithubRef | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [canPick, setCanPick] = useState(false);
  useEffect(() => setCanPick(supportsDirectoryPicker()), []);

  // Bundle-root detection (feature set A): the raw file map as originally
  // loaded (kept around so re-rooting never has to re-fetch), the
  // suggestion computed from it, and whether the user dismissed it.
  const [rawFiles, setRawFiles] = useState<Map<string, string> | null>(null);
  const [detected, setDetected] = useState<DetectedRoot | null>(null);
  const [detectedDismissed, setDetectedDismissed] = useState(false);

  const load = useCallback((files: Map<string, string>, name: string, opts?: { keepHash?: boolean }) => {
    const b = buildBundle(files, name);
    if (!b.concepts.length) {
      setError('No OKF concept documents found (markdown files with frontmatter).');
      return false;
    }
    setError(null);
    if (!opts?.keepHash) window.location.hash = '';
    setBundle(b);
    setRawFiles(files);
    setDetected(detectBundleRoot(files));
    setDetectedDismissed(false);
    return true;
  }, []);

  /** Rebuild the bundle scoped to the suggested prefix, without re-fetching. */
  const reRoot = useCallback(() => {
    if (!rawFiles || !detected) return;
    const prefix = detected.prefix;
    const strip = `${prefix}/`;
    const filtered = new Map<string, string>();
    for (const [path, text] of rawFiles) {
      if (path.startsWith(strip)) filtered.set(path.slice(strip.length), text);
    }
    const newName = prefix.split('/').pop()!;
    const b = buildBundle(filtered, newName);
    window.location.hash = '';
    setBundle(b);
    setDetected(null);
    setDetectedDismissed(false);

    if (githubRef) {
      const newRef: GithubRef = {
        ...githubRef,
        subdir: githubRef.subdir ? `${githubRef.subdir}/${prefix}` : prefix,
      };
      setGithubRef(newRef);
      const src = formatGithubRef(newRef);
      setShareParam(src);
      recordGithubRecent(src, newName);
    } else {
      recordLocalRecent(newName);
    }
  }, [rawFiles, detected, githubRef]);

  const loadFromGithub = useCallback(
    async (ref: GithubRef, opts?: { keepHash?: boolean }) => {
      setBusy('Fetching from GitHub…');
      setError(null);
      try {
        const { files, name, branch } = await fetchGithubBundle(ref, (done, total) =>
          setBusy(`Fetching from GitHub… ${done}/${total}`),
        );
        const resolvedRef: GithubRef = { ...ref, branch };
        const ok = load(files, name, opts);
        setGithubRef(resolvedRef);
        const src = formatGithubRef(resolvedRef);
        setShareParam(src);
        if (ok) recordGithubRecent(src, name);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setBusy(null);
      }
    },
    [load],
  );

  // Deep-link support: `?src=<owner>/<repo>[/tree/<branch>[/<subdir>]]` auto-loads that repo.
  useEffect(() => {
    const src = new URLSearchParams(window.location.search).get('src');
    const ref = src ? parseGithubUrl(src) : null;
    if (ref) loadFromGithub(ref, { keepHash: true });
    // Only ever run once, on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openLocal = async () => {
    if (canPick) {
      const result = await pickDirectory();
      if (result) {
        setGithubRef(null);
        setShareParam(null);
        if (load(result.files, result.name)) {
          recordLocalRecent(result.name);
          saveHandle(result.name, result.handle).catch(() => {});
        }
      }
    } else {
      fileInput.current?.click();
    }
  };

  const openGithub = () => {
    const ref = parseGithubUrl(repoUrl);
    if (!ref) {
      setError('Could not parse that GitHub URL. Try owner/repo or a full github.com link.');
      return;
    }
    loadFromGithub(ref);
  };

  const openGithubRecent = (entry: GithubRecentEntry) => {
    const ref = parseGithubUrl(entry.src);
    if (!ref) {
      setError('Could not reopen that GitHub bundle.');
      return;
    }
    loadFromGithub(ref);
  };

  const openLocalRecent = async (entry: LocalRecentEntry, handle: DirHandle) => {
    setBusy('Reopening folder…');
    setError(null);
    try {
      const result = await reopenDirectory(handle);
      if (result === 'denied') {
        setError(`Permission to read "${entry.name}" was denied.`);
        return;
      }
      setGithubRef(null);
      setShareParam(null);
      if (load(result.files, result.name)) recordLocalRecent(result.name);
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
        shareable={!!githubRef}
        banner={
          detected && !detectedDismissed ? (
            <RootSuggestionBanner
              detected={detected}
              onReRoot={reRoot}
              onDismiss={() => setDetectedDismissed(true)}
            />
          ) : undefined
        }
        onClose={() => {
          setBundle(null);
          setGithubRef(null);
          setRawFiles(null);
          setDetected(null);
          setDetectedDismissed(false);
          window.location.hash = '';
          setShareParam(null);
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
                  setGithubRef(null);
                  setShareParam(null);
                  if (load(files, name)) recordLocalRecent(name);
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

      <RecentsSection busy={!!busy} onOpenGithub={openGithubRecent} onOpenLocal={openLocalRecent} />
    </div>
  );
}
