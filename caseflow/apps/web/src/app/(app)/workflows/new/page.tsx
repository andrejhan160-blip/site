import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/layout/page-header';
import { canAdminister, requireStaff } from '@/lib/session';
import { WorkflowEditor } from '../workflow-editor';

export const metadata: Metadata = { title: 'Новый воркфлоу' };

export default async function NewWorkflowPage() {
  const profile = await requireStaff();
  if (!canAdminister(profile.role)) redirect('/workflows');

  return (
    <>
      <Link href="/workflows" className="text-sm text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]">
        ← Все воркфлоу
      </Link>
      <div className="mt-3">
        <PageHeader
          title="Новый воркфлоу"
          description="Этапы идут по порядку. К каждому можно привязать документы — они станут чек-листом клиента в тот момент, когда по этому воркфлоу откроют дело."
        />
      </div>
      <WorkflowEditor />
    </>
  );
}
