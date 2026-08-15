/**
 * Shared shape for server-action results. Kept out of the `'use server'` module
 * because such a module may only export async functions.
 */
export interface ActionState {
  ok: boolean;
  message?: string;
  /** Set on success so dialogs can close and forms can reset. */
  done?: boolean;
}

export const idleState: ActionState = { ok: true };
