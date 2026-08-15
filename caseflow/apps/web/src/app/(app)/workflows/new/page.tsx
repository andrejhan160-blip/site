import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/layout/page-header';
import { canAdminister, requireStaff } from '@/lib/session';
import { WorkflowEditor } from '../workflow-editor';

export const metadata: Metadata = { title: 'New workflow' };

export default async function NewWorkflowPage() {
  const profile = await requireStaff();
  if (!canAdminister(profile.role)) redirect('/workflows');

  return (
    <>
      <Link href="/workflows" className="text-sm text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]">
        ← All workflows
      </Link>
      <div className="mt-3">
        <PageHeader
          title="New workflow"
          description="Stages run in order. Each stage can require documents, which become the client's checklist the moment a case is opened from this workflow."
        />
      </div>
      <WorkflowEditor />
    </>
  );
}
