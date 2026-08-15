import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { PageHeader } from '@/components/layout/page-header';
import { api, ApiError } from '@/lib/api';
import { canAdminister, requireStaff } from '@/lib/session';
import type { WorkflowTemplateDetail } from '@/lib/types';
import { WorkflowEditor } from '../../workflow-editor';

export const metadata: Metadata = { title: 'Редактирование воркфлоу' };

export default async function EditWorkflowPage({ params }: { params: Promise<{ id: string }> }) {
  const profile = await requireStaff();
  const { id } = await params;
  if (!canAdminister(profile.role)) redirect(`/workflows/${id}`);

  let template: WorkflowTemplateDetail;
  try {
    template = await api<WorkflowTemplateDetail>(`/workflow-templates/${id}`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }

  return (
    <>
      <Link
        href={`/workflows/${id}`}
        className="text-sm text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]"
      >
        ← {template.name}
      </Link>
      <div className="mt-3">
        <PageHeader
          title="Редактирование воркфлоу"
          description="Изменения повлияют только на дела, открытые после сохранения. У существующих дел останутся те этапы и документы, с которыми они были созданы."
        />
      </div>
      <WorkflowEditor template={template} />
    </>
  );
}
