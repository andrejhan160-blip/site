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
import type { WorkflowTemplateSummary } from '@/lib/types';

export const metadata: Metadata = { title: 'Workflows' };

export default async function WorkflowsPage() {
  const profile = await requireStaff();
  const templates = await api<WorkflowTemplateSummary[]>('/workflow-templates');

  return (
    <>
      <PageHeader
        title="Workflows"
        description="Reusable process templates. Opening a case copies the template — editing a template never changes a case that already exists."
        actions={
          canAdminister(profile.role) ? (
            <Button asChild>
              <Link href="/workflows/new">
                <Plus />
                New workflow
              </Link>
            </Button>
          ) : undefined
        }
      />

      {templates.length === 0 ? (
        <Card>
          <EmptyState
            title="No workflows yet"
            description="Create a workflow to open cases from it."
            action={
              canAdminister(profile.role) ? (
                <Button asChild>
                  <Link href="/workflows/new">Create a workflow</Link>
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
                    <Badge tone="success">Active</Badge>
                  ) : (
                    <Badge tone="neutral">Archived</Badge>
                  )}
                </div>
                {template.description ? (
                  <p className="mt-2 line-clamp-2 text-sm text-[var(--color-ink-muted)]">{template.description}</p>
                ) : null}
                <p className="mt-4 text-sm text-[var(--color-ink-muted)]">
                  {template.stages.length} stages ·{' '}
                  {template.stages.reduce((sum, stage) => sum + (stage._count?.requirements ?? 0), 0)} documents ·{' '}
                  {template._count.cases} cases
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
                      +{template.stages.length - 5} more
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
