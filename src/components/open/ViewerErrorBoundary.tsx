'use client';

import { Component, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';

/**
 * Contains render-time crashes from untrusted bundle content (the viewer
 * renders arbitrary GitHub/local markdown): without this, one throw in
 * ConceptView/renderMarkdown unmounts the whole SPA and discards the
 * loaded bundle. Remounted per-route via `key` so navigating away from a
 * crashing concept recovers automatically.
 */
export default class ViewerErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div role="alert" className="mx-auto max-w-lg py-12">
          <h2 className="text-lg font-semibold">This page failed to render</h2>
          <p className="mt-2 break-words text-sm text-muted-foreground">
            {String(this.state.error.message || this.state.error)}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            The rest of the bundle is still loaded — pick another concept from the
            sidebar, or try again.
          </p>
          <Button variant="outline" size="sm" className="mt-4" onClick={() => this.setState({ error: null })}>
            Try again
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}
