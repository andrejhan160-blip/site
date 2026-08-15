import { NextResponse } from 'next/server';
import { api, ApiError } from '@/lib/api';

/**
 * Redirects to a short-lived signed URL for a document. The storage key never
 * reaches the browser, and authorisation is re-checked by the API on every hit.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const { url } = await api<{ url: string }>(`/documents/${id}/download-url`);
    return NextResponse.redirect(url);
  } catch (error) {
    const status = error instanceof ApiError ? error.status : 500;
    return NextResponse.json({ message: 'This document is not available' }, { status });
  }
}
