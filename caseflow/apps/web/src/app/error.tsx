'use client';

import Link from 'next/link';
import { useEffect } from 'react';

/**
 * Last-resort boundary. Render failures — an API that is briefly unavailable, a
 * rate limit, a bad gateway — land here instead of showing a bare 500 page.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-6 text-center card-shadow">
        <h1 className="text-lg font-semibold">Something went wrong</h1>
        <p className="mt-2 text-sm text-[var(--color-ink-muted)]">
          The page could not be loaded. This is usually temporary — try again in a moment.
        </p>
        <div className="mt-6 flex justify-center gap-2">
          <button
            onClick={reset}
            className="inline-flex h-10 items-center rounded-lg bg-[var(--color-accent)] px-4 text-sm font-medium text-white"
          >
            Try again
          </button>
          <Link
            href="/"
            className="inline-flex h-10 items-center rounded-lg border border-[var(--color-border-strong)] px-4 text-sm font-medium"
          >
            Go back
          </Link>
        </div>
        {error.digest ? (
          <p className="mt-4 text-xs text-[var(--color-ink-subtle)]">Reference: {error.digest}</p>
        ) : null}
      </div>
    </main>
  );
}
