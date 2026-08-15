import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/layout/page-header';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { api, ApiError } from '@/lib/api';
import { canAdminister, requireStaff } from '@/lib/session';
import { countOf } from '@/lib/i18n';
import type { WorkflowTemplateDetail } from '@/lib/types';
import { ArchiveWorkflowButton } from './archive-button';

export const metadata: Metadata = { title: 'Воркфлоу' };

export default async function WorkflowDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const profile = await requireStaff();
  const { id } = await params;

  let template: WorkflowTemplateDetail;
  try {
    template = await api<WorkflowTemplateDetail>(`/workflow-templates/${id}`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }

  return (
    <>
      <Link href="/workflows" className="text-sm text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]">
        ← Все воркфлоу
      </Link>
      <div className="mt-3">
        <PageHeader
          title={template.name}
          description={template.description ?? undefined}
          actions={
            canAdminister(profile.role) ? (
              <>
                <Button asChild variant="secondary">
                  <Link href={`/workflows/${template.id}/edit`}>Редактировать</Link>
                </Button>
                {template.isActive ? <ArchiveWorkflowButton templateId={template.id} /> : null}
              </>
            ) : undefined
          }
        />
      </div>

      <div className="space-y-4">
        {template.stages.map((stage, index) => (
          <Card key={stage.id}>
            <CardHeader>
              <div className="flex items-center gap-3">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--color-surface-muted)] text-sm font-semibold text-[var(--color-ink-muted)]">
                  {index + 1}
                </span>
                <div>
                  <CardTitle>{stage.name}</CardTitle>
                  {stage.description ? (
                    <p className="mt-0.5 text-sm text-[var(--color-ink-muted)]">{stage.description}</p>
                  ) : null}
                </div>
              </div>
              <Badge tone="neutral">
                {countOf(stage.requirements.length, 'документ', 'документа', 'документов')}
              </Badge>
            </CardHeader>
            {stage.requirements.length > 0 ? (
              <CardContent className="pt-0">
                <ul className="divide-y divide-[var(--color-border)] rounded-xl border border-[var(--color-border)]">
                  {stage.requirements.map((requirement) => (
                    <li key={requirement.id} className="px-4 py-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-medium">{requirement.name}</p>
                        <div className="flex items-center gap-2">
                          {!requirement.required ? <Badge tone="neutral">По желанию</Badge> : null}
                          {requirement.deadlineDays !== null ? (
                            <Badge tone="neutral">Срок: {requirement.deadlineDays} дн. от старта</Badge>
                          ) : null}
                        </div>
                      </div>
                      {requirement.instructions ? (
                        <p className="mt-1 text-sm text-[var(--color-ink-muted)]">{requirement.instructions}</p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </CardContent>
            ) : null}
          </Card>
        ))}
      </div>
    </>
  );
}
