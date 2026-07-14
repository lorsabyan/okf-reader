/**
 * Base path for deployments under a sub-path (e.g. GitHub Pages).
 * next/link handles this automatically; raw <a> hrefs — rewritten
 * markdown links and SVG node links — must go through conceptHref.
 */
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

export function conceptHref(id: string): string {
  return `${BASE_PATH}/c/${id}/`;
}
