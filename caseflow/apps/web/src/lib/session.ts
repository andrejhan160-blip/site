import 'server-only';
import { redirect } from 'next/navigation';
import { cache } from 'react';
import { api, ApiError } from './api';
import type { Profile } from './types';

/** Cached per request so a page tree resolves the profile once. */
export const getProfile = cache(async (): Promise<Profile | null> => {
  try {
    return await api<Profile>('/auth/me');
  } catch (error) {
    if (error instanceof ApiError && (error.status === 401 || error.status === 403)) return null;
    throw error;
  }
});

export async function requireStaff(): Promise<Profile> {
  const profile = await getProfile();
  if (!profile) redirect('/login');
  if (profile.role === 'CLIENT') redirect('/portal');
  return profile;
}

export async function requireClient(): Promise<Profile> {
  const profile = await getProfile();
  if (!profile) redirect('/login');
  if (profile.role !== 'CLIENT') redirect('/dashboard');
  return profile;
}

export function canManage(role: Profile['role']): boolean {
  return role === 'OWNER' || role === 'ADMIN' || role === 'MANAGER';
}

export function canAdminister(role: Profile['role']): boolean {
  return role === 'OWNER' || role === 'ADMIN';
}
