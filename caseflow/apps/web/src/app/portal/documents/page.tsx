import type { Metadata } from 'next';
import { DocumentList } from '@/components/case/document-list';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { api } from '@/lib/api';
import { requireClient } from '@/lib/session';
import type { PortalDocuments } from '@/lib/types';

export const metadata: Metadata = { title: 'Документы' };

export default async function PortalDocumentsPage() {
  await requireClient();
  const documents = await api<PortalDocuments>('/portal/documents');

  const groups = [
    {
      key: 'required',
      title: 'Нужно загрузить',
      description: 'Без них дело не движется дальше.',
      items: documents.required,
    },
    {
      key: 'underReview',
      title: 'На проверке',
      description: 'Документы у нас — от вас ничего не требуется.',
      items: documents.underReview,
    },
    { key: 'approved', title: 'Принято', items: documents.approved },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Документы</h1>
        <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
          Что нужно нам, что вы уже прислали и что с этим стало.
        </p>
      </div>

      {documents.all.length === 0 ? (
        <Card>
          <EmptyState title="Документы пока не запрашивали" description="Мы напишем, когда что-то понадобится." />
        </Card>
      ) : (
        groups
          .filter((group) => group.items.length > 0)
          .map((group) => (
            <Card key={group.key} className="overflow-hidden">
              <CardHeader>
                <div>
                  <CardTitle>{group.title}</CardTitle>
                  {group.description ? (
                    <p className="mt-0.5 text-sm text-[var(--color-ink-muted)]">{group.description}</p>
                  ) : null}
                </div>
                <span className="text-sm text-[var(--color-ink-muted)]">{group.items.length}</span>
              </CardHeader>
              <DocumentList
                requirements={group.items}
                caseId={group.items[0]?.caseId ?? ''}
                canReview={false}
                canUpload={group.key !== 'approved'}
                portal
              />
            </Card>
          ))
      )}
    </div>
  );
}
