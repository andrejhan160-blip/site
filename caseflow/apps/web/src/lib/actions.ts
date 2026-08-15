'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import type { ActionState } from './action-state';
import { api, ApiError, SESSION_COOKIE } from './api';


/** Wraps an action so API errors surface as form messages instead of crashes. */
async function run(handler: () => Promise<void>, successMessage?: string): Promise<ActionState> {
  try {
    await handler();
    return { ok: true, done: true, message: successMessage };
  } catch (error) {
    if (error instanceof ApiError) return { ok: false, message: error.message };
    throw error;
  }
}

const optional = (value: FormDataEntryValue | null): string | undefined => {
  const text = typeof value === 'string' ? value.trim() : '';
  return text.length > 0 ? text : undefined;
};

const flag = (value: FormDataEntryValue | null): boolean => value === 'on' || value === 'true';

// --- Session -----------------------------------------------------------------

export async function logout(): Promise<void> {
  try {
    await api('/auth/logout', { method: 'POST' });
  } catch {
    // A stale session is already effectively logged out.
  }
  const store = await cookies();
  store.delete(SESSION_COOKIE);
  redirect('/login');
}

// --- Clients -----------------------------------------------------------------

const clientSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z.string().email('Enter a valid email'),
});

export async function createClient(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = clientSchema.safeParse({
    firstName: formData.get('firstName'),
    lastName: formData.get('lastName'),
    email: formData.get('email'),
  });
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };

  return run(async () => {
    await api('/clients', {
      method: 'POST',
      body: {
        ...parsed.data,
        phone: optional(formData.get('phone')),
        telegramId: optional(formData.get('telegramId')),
        externalCrmContactId: optional(formData.get('externalCrmContactId')),
        notes: optional(formData.get('notes')),
        createPortalAccess: formData.get('createPortalAccess') !== null,
      },
    });
    revalidatePath('/clients');
  }, 'Client created');
}

// --- Cases -------------------------------------------------------------------

export async function createCase(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const clientId = optional(formData.get('clientId'));
  const workflowTemplateId = optional(formData.get('workflowTemplateId'));
  if (!clientId || !workflowTemplateId) {
    return { ok: false, message: 'Choose a client and a workflow' };
  }

  let createdId: string | null = null;
  const result = await run(async () => {
    const created = await api<{ id: string }>('/cases', {
      method: 'POST',
      body: {
        clientId,
        workflowTemplateId,
        title: optional(formData.get('title')),
        description: optional(formData.get('description')),
        assignedUserId: optional(formData.get('assignedUserId')),
        externalCrmEntityId: optional(formData.get('externalCrmEntityId')),
      },
    });
    createdId = created.id;
    revalidatePath('/cases');
    revalidatePath('/dashboard');
  });

  if (result.ok && createdId) redirect(`/cases/${createdId}`);
  return result;
}

export async function updateCase(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const caseId = String(formData.get('caseId'));
  return run(async () => {
    await api(`/cases/${caseId}`, {
      method: 'PATCH',
      body: {
        status: optional(formData.get('status')),
        assignedUserId: optional(formData.get('assignedUserId')),
        title: optional(formData.get('title')),
      },
    });
    revalidatePath(`/cases/${caseId}`);
    revalidatePath('/cases');
  }, 'Case updated');
}

export async function changeStage(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const caseId = String(formData.get('caseId'));
  const stageId = optional(formData.get('stageId'));
  if (!stageId) return { ok: false, message: 'Choose a stage' };

  return run(async () => {
    await api(`/cases/${caseId}/stage`, {
      method: 'POST',
      body: { stageId, completePrevious: true, note: optional(formData.get('note')) },
    });
    revalidatePath(`/cases/${caseId}`);
    revalidatePath('/dashboard');
  }, 'Stage updated');
}

// --- Documents ---------------------------------------------------------------

export async function requestDocument(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const caseId = String(formData.get('caseId'));
  const name = optional(formData.get('name'));
  if (!name) return { ok: false, message: 'Give the document a name' };

  return run(async () => {
    await api(`/cases/${caseId}/document-requests`, {
      method: 'POST',
      body: {
        name,
        stageId: optional(formData.get('stageId')),
        description: optional(formData.get('description')),
        instructions: optional(formData.get('instructions')),
        required: formData.get('required') !== null,
        deadline: optional(formData.get('deadline')),
        notifyClient: formData.get('notifyClient') !== null,
      },
    });
    revalidatePath(`/cases/${caseId}`);
    revalidatePath('/dashboard');
  }, 'Document requested');
}

export async function uploadDocument(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const caseId = String(formData.get('caseId'));
  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) return { ok: false, message: 'Choose a file to upload' };

  const requirementId = optional(formData.get('requirementId'));
  const portal = flag(formData.get('portal'));

  const payload = new FormData();
  payload.append('file', file);
  if (requirementId) payload.append('requirementId', requirementId);

  return run(async () => {
    await api(portal ? `/portal/cases/${caseId}/documents` : `/cases/${caseId}/documents`, {
      method: 'POST',
      formData: payload,
    });
    revalidatePath(portal ? '/portal' : `/cases/${caseId}`);
    revalidatePath(portal ? '/portal/documents' : '/dashboard');
  }, 'Document uploaded');
}

export async function reviewDocument(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const documentId = String(formData.get('documentId'));
  const caseId = String(formData.get('caseId'));
  const decision = String(formData.get('decision'));
  const rejectionReason = optional(formData.get('rejectionReason'));

  if (decision === 'REJECT' && !rejectionReason) {
    return { ok: false, message: 'A rejection reason is required — the client sees it' };
  }

  return run(async () => {
    await api(`/documents/${documentId}/review`, {
      method: 'POST',
      body: { decision, rejectionReason },
    });
    revalidatePath(`/cases/${caseId}`);
    revalidatePath('/dashboard');
  }, decision === 'APPROVE' ? 'Document approved' : 'Document rejected');
}

// --- Requests, tasks, messages ----------------------------------------------

export async function createRequest(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const caseId = String(formData.get('caseId'));
  const title = optional(formData.get('title'));
  if (!title) return { ok: false, message: 'Give the request a title' };

  return run(async () => {
    await api(`/cases/${caseId}/requests`, {
      method: 'POST',
      body: {
        title,
        type: optional(formData.get('type')) ?? 'INFORMATION',
        description: optional(formData.get('description')),
        deadline: optional(formData.get('deadline')),
        notifyClient: formData.get('notifyClient') !== null,
      },
    });
    revalidatePath(`/cases/${caseId}`);
  }, 'Request sent');
}

export async function completeRequest(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const requestId = String(formData.get('requestId'));
  return run(async () => {
    await api(`/requests/${requestId}/complete`, { method: 'POST' });
    revalidatePath('/portal');
    revalidatePath('/portal/requests');
    const caseId = optional(formData.get('caseId'));
    if (caseId) revalidatePath(`/cases/${caseId}`);
  }, 'Request completed');
}

export async function cancelRequest(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const requestId = String(formData.get('requestId'));
  const caseId = String(formData.get('caseId'));
  return run(async () => {
    await api(`/requests/${requestId}/cancel`, { method: 'POST' });
    revalidatePath(`/cases/${caseId}`);
  }, 'Request cancelled');
}

export async function createTask(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const caseId = String(formData.get('caseId'));
  const title = optional(formData.get('title'));
  if (!title) return { ok: false, message: 'Give the task a title' };

  return run(async () => {
    await api(`/cases/${caseId}/tasks`, {
      method: 'POST',
      body: {
        title,
        description: optional(formData.get('description')),
        assignedToId: optional(formData.get('assignedToId')),
        deadline: optional(formData.get('deadline')),
        visibility: optional(formData.get('visibility')) ?? 'INTERNAL',
      },
    });
    revalidatePath(`/cases/${caseId}`);
  }, 'Task created');
}

export async function setTaskStatus(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const taskId = String(formData.get('taskId'));
  const status = String(formData.get('status'));
  return run(async () => {
    await api(`/tasks/${taskId}`, { method: 'PATCH', body: { status } });
    const caseId = optional(formData.get('caseId'));
    if (caseId) revalidatePath(`/cases/${caseId}`);
    revalidatePath('/portal');
  });
}

export async function sendMessage(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const caseId = String(formData.get('caseId'));
  const body = optional(formData.get('body'));
  if (!body) return { ok: false, message: 'Write a message first' };
  const portal = flag(formData.get('portal'));

  return run(async () => {
    await api(portal ? `/portal/cases/${caseId}/messages` : `/cases/${caseId}/messages`, {
      method: 'POST',
      body: { body },
    });
    revalidatePath(portal ? '/portal/messages' : `/cases/${caseId}`);
  });
}

// --- Settings ----------------------------------------------------------------

export async function updateOrganization(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return run(async () => {
    await api('/organization', {
      method: 'PATCH',
      body: {
        name: optional(formData.get('name')),
        primaryColor: optional(formData.get('primaryColor')),
        logoUrl: optional(formData.get('logoUrl')) ?? null,
        supportEmail: optional(formData.get('supportEmail')) ?? null,
        portalWelcomeText: optional(formData.get('portalWelcomeText')) ?? null,
        customDomain: optional(formData.get('customDomain')) ?? null,
        timezone: optional(formData.get('timezone')),
      },
    });
    revalidatePath('/settings');
    revalidatePath('/portal');
  }, 'Branding saved');
}

export async function inviteTeamMember(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const name = optional(formData.get('name'));
  const email = optional(formData.get('email'));
  if (!name || !email) return { ok: false, message: 'Name and email are required' };

  return run(async () => {
    await api('/organization/users', {
      method: 'POST',
      body: { name, email, role: optional(formData.get('role')) ?? 'SPECIALIST' },
    });
    revalidatePath('/settings/team');
  }, 'Team member added');
}

export async function updateTeamMember(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const userId = String(formData.get('userId'));
  const isActiveRaw = formData.get('isActive');
  return run(async () => {
    await api(`/organization/users/${userId}`, {
      method: 'PATCH',
      body: {
        role: optional(formData.get('role')),
        ...(isActiveRaw === null ? {} : { isActive: flag(isActiveRaw) }),
      },
    });
    revalidatePath('/settings/team');
  }, 'Team member updated');
}

export async function saveCrmConnection(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const inboundWebhookUrl = optional(formData.get('inboundWebhookUrl'));
  return run(async () => {
    await api('/integrations/crm/connection', {
      method: 'PUT',
      body: {
        provider: 'BITRIX24',
        isActive: formData.get('isActive') !== null,
        baseUrl: optional(formData.get('baseUrl')),
        credentials: inboundWebhookUrl ? { inboundWebhookUrl } : {},
        syncedFields: (optional(formData.get('syncedFields')) ?? '')
          .split(',')
          .map((field) => field.trim())
          .filter(Boolean),
      },
    });
    revalidatePath('/settings/integrations');
  }, 'Integration saved');
}

export async function testCrmConnection(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const connectionId = String(formData.get('connectionId'));
  try {
    const result = await api<{ ok: boolean; detail: string }>(
      `/integrations/crm/connection/${connectionId}/test`,
      { method: 'POST' },
    );
    revalidatePath('/settings/integrations');
    return { ok: result.ok, message: result.detail, done: true };
  } catch (error) {
    if (error instanceof ApiError) return { ok: false, message: error.message };
    throw error;
  }
}

export async function saveStageMappings(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const connectionId = String(formData.get('connectionId'));
  const rows = formData.getAll('mapping').map((raw) => JSON.parse(String(raw)) as Record<string, string>);

  const mappings = rows.map((row) => ({
    pipelineId: row.pipelineId,
    pipelineName: row.pipelineName || undefined,
    externalStageId: row.externalStageId,
    externalStageName: row.externalStageName || undefined,
    templateStageId: optional(formData.get(`stage:${row.externalStageId}`)) ?? null,
  }));

  return run(async () => {
    await api(`/integrations/crm/connection/${connectionId}/mappings`, {
      method: 'PUT',
      body: { mappings },
    });
    revalidatePath('/settings/integrations');
  }, 'Stage mapping saved');
}

export async function markNotificationsRead(): Promise<void> {
  await api('/notifications/read-all', { method: 'POST' });
  revalidatePath('/', 'layout');
}
