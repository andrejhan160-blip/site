'use server';

import { z } from 'zod';
import { ApiError, apiPublic } from '@/lib/api';

const schema = z.object({
  email: z.string().email('Enter a valid email address'),
});

export interface LoginState {
  status: 'idle' | 'sent' | 'error';
  message?: string;
  /** Present outside production so the demo can be walked through without a mailbox. */
  devLink?: string;
}

export async function requestMagicLink(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = schema.safeParse({ email: formData.get('email') });
  if (!parsed.success) {
    return { status: 'error', message: parsed.error.issues[0]?.message ?? 'Invalid email' };
  }

  try {
    const { data } = await apiPublic<{ sent: true; devLink?: string }>('/auth/magic-link', {
      email: parsed.data.email,
    });
    return { status: 'sent', devLink: data.devLink };
  } catch (error) {
    if (error instanceof ApiError && error.status === 429) {
      return { status: 'error', message: 'Too many attempts. Try again in a minute.' };
    }
    return { status: 'error', message: 'Could not send the link. Please try again.' };
  }
}
