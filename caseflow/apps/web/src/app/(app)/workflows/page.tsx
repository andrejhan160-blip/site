import type { Metadata } from 'next';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { api } from '@/lib/api';
import { canAdminister, requireStaff } from '@/lib/session';
import { countOf } from '@/lib/i18n';
import type { WorkflowTemplateSummary } from '@/lib/types';

export const metadata: Metadata = { title: 'Воркфлоу' };

export default async function WorkflowsPage() {
  const profile = await requireStaff();
  const templates = await api<WorkflowTemplateSummary[]>('/workflow-templates');

  return (
    <>
      <PageHeader
        title="Воркфлоу"
        description="Шаблоны процессов многоразового пользования. При открытии дела шаблон копируется — правки шаблона уже существующие дела не меняют."
        actions={
          canAdminister(profile.role) ? (
            <Button asChild>
              <Link href="/workflows/new">
                <Plus />
                Новый воркфлоу
              </Link>
            </Button>
          ) : undefined
        }
      />

      {templates.length === 0 ? (
        <Card>
          <EmptyState
            title="Воркфлоу пока нет"
            description="Создайте воркфлоу, чтобы открывать по нему дела."
            action={
              canAdminister(profile.role) ? (
                <Button asChild>
                  <Link href="/workflows/new">Создать воркфлоу</Link>
                </Button>
              ) : undefined
            }
          />
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {templates.map((template) => (
            <Link key={template.id} href={`/workflows/${template.id}`}>
              <Card className="h-full px-6 py-5 transition-colors hover:border-[var(--color-border-strong)]">
                <div className="flex items-start justify-between gap-3">
                  <h2 className="font-semibold">{template.name}</h2>
                  {template.isActive ? (
                    <Badge tone="success">Активен</Badge>
                  ) : (
                    <Badge tone="neutral">В архиве</Badge>
                  )}
                </div>
                {template.description ? (
                  <p className="mt-2 line-clamp-2 text-sm text-[var(--color-ink-muted)]">{template.description}</p>
                ) : null}
                <p className="mt-4 text-sm text-[var(--color-ink-muted)]">
                  {countOf(template.stages.length, 'этап', 'этапа', 'этапов')} ·{' '}
                  {countOf(
                    template.stages.reduce((sum, stage) => sum + (stage._count?.requirements ?? 0), 0),
                    'документ',
                    'документа',
                    'документов',
                  )}{' '}
                  · {countOf(template._count.cases, 'дело', 'дела', 'дел')}
                </p>
                <ol className="mt-3 flex flex-wrap gap-1.5">
                  {template.stages.slice(0, 5).map((stage) => (
                    <li
                      key={stage.id}
                      className="rounded-full bg-[var(--color-surface-muted)] px-2.5 py-1 text-xs text-[var(--color-ink-muted)]"
                    >
                      {stage.name}
                    </li>
                  ))}
                  {template.stages.length > 5 ? (
                    <li className="px-1 py-1 text-xs text-[var(--color-ink-subtle)]">
                      ещё {template.stages.length - 5}
                    </li>
                  ) : null}
                </ol>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
