import { Download, FileText } from 'lucide-react';
import Link from 'next/link';
import { EmptyState } from '@/components/ui/empty-state';
import { DeadlineBadge, DocumentStatusBadge, RequirementStatusBadge } from '@/components/ui/status';
import type { Requirement } from '@/lib/types';
import { formatBytes, formatDateTime } from '@/lib/utils';
import { ReviewActions } from './review-actions';
import { UploadForm } from './upload-form';

/**
 * Requirement-centric document view. Every version is kept and shown; a
 * replacement is a new version rather than an overwrite.
 */
export function DocumentList({
  requirements,
  caseId,
  canReview,
  canUpload,
  portal = false,
  emptyLabel = 'No documents requested yet.',
}: {
  requirements: Requirement[];
  caseId: string;
  canReview: boolean;
  canUpload: boolean;
  portal?: boolean;
  emptyLabel?: string;
}) {
  if (requirements.length === 0) {
    return <EmptyState title={emptyLabel} />;
  }

  return (
    <ul className="divide-y divide-[var(--color-border)]">
      {requirements.map((requirement) => {
        const latest = requirement.documents[0];
        const history = requirement.documents.slice(1);
        const targetCaseId = requirement.caseId ?? caseId;

        return (
          <li key={requirement.id} className="px-6 py-5 first:pt-4">
            <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">{requirement.name}</p>
                  {!requirement.required ? (
                    <span className="text-xs text-[var(--color-ink-subtle)]">optional</span>
                  ) : null}
                  <RequirementStatusBadge status={requirement.status} />
                  <DeadlineBadge deadline={requirement.deadline} />
                </div>

                {requirement.instructions ? (
                  <p className="mt-1.5 text-sm text-[var(--color-ink-muted)]">{requirement.instructions}</p>
                ) : null}
                {requirement.case && portal ? (
                  <p className="mt-1 text-xs text-[var(--color-ink-subtle)]">{requirement.case.title}</p>
                ) : null}
              </div>

              {canUpload && requirement.status !== 'APPROVED' ? (
                <UploadForm
                  caseId={targetCaseId}
                  requirementId={requirement.id}
                  portal={portal}
                  variant={requirement.status === 'REJECTED' ? 'primary' : 'secondary'}
                  label={requirement.documents.length > 0 ? 'Upload replacement' : 'Upload'}
                />
              ) : null}
            </div>

            {latest ? (
              <div className="mt-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-muted)]/60 px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <FileText className="h-4 w-4 shrink-0 text-[var(--color-ink-subtle)]" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{latest.filename}</p>
                      <p className="text-xs text-[var(--color-ink-muted)]">
                        v{latest.version} · {formatBytes(latest.fileSize)} · uploaded{' '}
                        {formatDateTime(latest.createdAt)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <DocumentStatusBadge status={latest.status} />
                    <Link
                      href={`/download/${latest.id}`}
                      // Never prefetched: following this link mints a signed URL.
                      prefetch={false}
                      className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-3 text-[13px] font-medium hover:bg-[var(--color-surface-muted)]"
                    >
                      <Download className="h-3.5 w-3.5" />
                      Download
                    </Link>
                    {canReview && latest.status === 'UNDER_REVIEW' ? (
                      <ReviewActions documentId={latest.id} caseId={targetCaseId} filename={latest.filename} />
                    ) : null}
                  </div>
                </div>

                {latest.status === 'REJECTED' && latest.rejectionReason ? (
                  <p className="mt-3 rounded-lg bg-[var(--color-danger-soft)] px-3 py-2 text-sm text-[var(--color-danger)]">
                    <span className="font-medium">Rejected:</span> {latest.rejectionReason}
                  </p>
                ) : null}

                {latest.status === 'APPROVED' && latest.reviewedAt ? (
                  <p className="mt-2 text-xs text-[var(--color-success)]">
                    Approved {formatDateTime(latest.reviewedAt)}
                    {latest.reviewedBy && 'name' in latest.reviewedBy ? ` by ${latest.reviewedBy.name}` : ''}
                  </p>
                ) : null}
              </div>
            ) : null}

            {history.length > 0 ? (
              <details className="mt-2">
                <summary className="cursor-pointer text-xs text-[var(--color-ink-muted)]">
                  {history.length} earlier version{history.length > 1 ? 's' : ''}
                </summary>
                <ul className="mt-2 space-y-1.5">
                  {history.map((document) => (
                    <li
                      key={document.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm text-[var(--color-ink-muted)]"
                    >
                      <span className="truncate">
                        v{document.version} · {document.filename} · {formatDateTime(document.createdAt)}
                      </span>
                      <span className="flex items-center gap-2">
                        <DocumentStatusBadge status={document.status} />
                        <Link href={`/download/${document.id}`} prefetch={false} className="text-[var(--color-accent)]">
                          Download
                        </Link>
                      </span>
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
