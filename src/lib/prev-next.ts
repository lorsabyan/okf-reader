import { navGroups, type CoreBundle } from '@okf/core';

/**
 * Prev/next concept within the same sidebar group (top-level directory),
 * in the same alphabetical order the sidebar itself uses — reused by
 * both the SSG concept page and the runtime viewer's ConceptView.
 */

export interface AdjacentConcept {
  id: string;
  title: string;
}

export interface PrevNextResult {
  prev?: AdjacentConcept;
  next?: AdjacentConcept;
}

export function prevNextInGroup(bundle: Pick<CoreBundle, 'concepts'>, conceptId: string): PrevNextResult {
  for (const { items } of navGroups(bundle)) {
    const index = items.findIndex((c) => c.id === conceptId);
    if (index === -1) continue;
    const prev = index > 0 ? items[index - 1] : undefined;
    const next = index < items.length - 1 ? items[index + 1] : undefined;
    return {
      prev: prev ? { id: prev.id, title: prev.title } : undefined,
      next: next ? { id: next.id, title: next.title } : undefined,
    };
  }
  return {};
}
