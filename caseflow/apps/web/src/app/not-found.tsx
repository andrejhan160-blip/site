import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-6 text-center card-shadow">
        <h1 className="text-lg font-semibold">Страница не найдена</h1>
        <p className="mt-2 text-sm text-[var(--color-ink-muted)]">
          Такой страницы нет — либо она принадлежит другой организации.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex h-10 items-center justify-center rounded-lg bg-[var(--color-accent)] px-4 text-sm font-medium text-white"
        >
          Вернуться в CaseFlow
        </Link>
      </div>
    </main>
  );
}
