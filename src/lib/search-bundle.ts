import type { Concept, CoreBundle } from '@okf/core';

/**
 * In-memory full-text search over an already-loaded bundle (runtime viewer
 * at `/open`, where there's no build step to run Pagefind over). Pure and
 * synchronous — safe to call on every keystroke, no worker/index needed at
 * bundle scale.
 */

export interface BundleHit {
  id: string;
  title: string;
  excerptHtml: string;
  score: number;
}

const EXCERPT_TARGET_LENGTH = 120;
const EXCERPT_HALF_WINDOW = 60;

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** ~120 chars of `source` centered on the first match, HTML-escaped, matches wrapped in <mark>. */
function buildExcerpt(source: string, words: string[]): string {
  const lower = source.toLowerCase();
  let firstIndex = -1;
  for (const w of words) {
    const idx = lower.indexOf(w);
    if (idx !== -1 && (firstIndex === -1 || idx < firstIndex)) firstIndex = idx;
  }

  let start = 0;
  let end = Math.min(source.length, EXCERPT_TARGET_LENGTH);
  if (firstIndex !== -1) {
    start = Math.max(0, firstIndex - EXCERPT_HALF_WINDOW);
    end = Math.min(source.length, start + EXCERPT_TARGET_LENGTH);
    start = Math.max(0, end - EXCERPT_TARGET_LENGTH);
  }
  const slice = source.slice(start, end);
  const prefix = start > 0 ? '…' : '';
  const suffix = end < source.length ? '…' : '';

  // Locate match ranges within the slice (re-searching, since indices shifted).
  const sliceLower = slice.toLowerCase();
  const ranges: [number, number][] = [];
  for (const w of words) {
    if (!w) continue;
    let from = 0;
    for (;;) {
      const idx = sliceLower.indexOf(w, from);
      if (idx === -1) break;
      ranges.push([idx, idx + w.length]);
      from = idx + w.length;
    }
  }
  ranges.sort((a, b) => a[0] - b[0]);
  const merged: [number, number][] = [];
  for (const r of ranges) {
    const last = merged[merged.length - 1];
    if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1]);
    else merged.push([r[0], r[1]]);
  }

  // Escape each raw segment independently, then splice in literal <mark> tags —
  // guarantees bundle-supplied text (e.g. a body containing "<script>") can
  // never contribute real markup to the excerpt.
  let html = '';
  let pos = 0;
  for (const [s, e] of merged) {
    html += escapeHtml(slice.slice(pos, s));
    html += `<mark>${escapeHtml(slice.slice(s, e))}</mark>`;
    pos = e;
  }
  html += escapeHtml(slice.slice(pos));

  return prefix + html + suffix;
}

/** Case-insensitive AND-across-words search over a bundle's concepts. */
export function searchBundle(bundle: Pick<CoreBundle, 'concepts'>, query: string, limit = 8): BundleHit[] {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];

  const matches: { concept: Concept; score: number }[] = [];
  for (const concept of bundle.concepts) {
    const title = concept.title.toLowerCase();
    const description = concept.description.toLowerCase();
    const tagsAndType = [...concept.tags, concept.type].join(' ').toLowerCase();
    const body = concept.body.toLowerCase();
    const combined = `${title} ${description} ${tagsAndType} ${body}`;

    let score = 0;
    let matchesAllWords = true;
    for (const word of words) {
      if (!combined.includes(word)) {
        matchesAllWords = false;
        break;
      }
      if (title.includes(word)) score += 10;
      if (description.includes(word)) score += 5;
      if (tagsAndType.includes(word)) score += 3;
      if (body.includes(word)) score += 1;
    }
    if (matchesAllWords) matches.push({ concept, score });
  }

  // Array#sort is stable, so equal scores keep the bundle's existing (id) order.
  matches.sort((a, b) => b.score - a.score);

  return matches.slice(0, limit).map(({ concept, score }) => {
    const bodyLower = concept.body.toLowerCase();
    const matchedInBody = words.some((w) => bodyLower.includes(w));
    const source = matchedInBody ? concept.body : concept.description;
    return {
      id: concept.id,
      title: concept.title,
      excerptHtml: buildExcerpt(source, words),
      score,
    };
  });
}
