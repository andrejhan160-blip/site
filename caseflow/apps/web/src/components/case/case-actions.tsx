'use client';

import { FilePlus2, GitBranch, ListPlus, MessageSquarePlus, Settings2 } from 'lucide-react';
import { FormDialog } from '@/components/forms/form-dialog';
import { Button } from '@/components/ui/button';
import { Field, Input, Select, Textarea } from '@/components/ui/input';
import { changeStage, createRequest, createTask, requestDocument, updateCase } from '@/lib/actions';
import type { CaseStatus, Stage, TeamMember } from '@/lib/types';

export function ChangeStageDialog({
  caseId,
  stages,
  currentStageId,
}: {
  caseId: string;
  stages: Stage[];
  currentStageId: string | null;
}) {
  return (
    <FormDialog
      trigger={
        <Button variant="secondary">
          <GitBranch />
          Change stage
        </Button>
      }
      title="Change stage"
      description="Earlier stages are marked complete; the client is notified of the new stage."
      action={changeStage}
      submitLabel="Move case"
      pendingLabel="Moving…"
    >
      <input type="hidden" name="caseId" value={caseId} />
      <Field label="Move to">
        <Select name="stageId" required defaultValue={currentStageId ?? ''}>
          {stages.map((stage) => (
            <option key={stage.id} value={stage.id}>
              {stage.position + 1}. {stage.name}
              {stage.id === currentStageId ? ' (current)' : ''}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Internal note" hint="Stored on the activity log; the client does not see it.">
        <Textarea name="note" rows={2} />
      </Field>
    </FormDialog>
  );
}

export function RequestDocumentDialog({ caseId, stages }: { caseId: string; stages: Stage[] }) {
  return (
    <FormDialog
      trigger={
        <Button>
          <FilePlus2 />
          Request document
        </Button>
      }
      title="Request a document"
      description="Creates the requirement and a client request, and notifies the client."
      action={requestDocument}
      submitLabel="Send request"
      pendingLabel="Sending…"
    >
      <input type="hidden" name="caseId" value={caseId} />
      <Field label="Document">
        <Input name="name" required autoFocus placeholder="e.g. Health insurance policy" />
      </Field>
      <Field label="Stage">
        <Select name="stageId" defaultValue="">
          <option value="">Current stage</option>
          {stages.map((stage) => (
            <option key={stage.id} value={stage.id}>
              {stage.position + 1}. {stage.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Instructions" hint="What exactly the client must upload — they see this verbatim.">
        <Textarea
          name="instructions"
          rows={3}
          placeholder="Colour scan, all pages, issued within the last 3 months."
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Deadline">
          <Input name="deadline" type="date" />
        </Field>
        <div className="flex flex-col justify-end gap-2 pb-1">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="required" defaultChecked className="h-4 w-4 rounded" />
            Required document
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="notifyClient" defaultChecked className="h-4 w-4 rounded" />
            Notify the client
          </label>
        </div>
      </div>
    </FormDialog>
  );
}

export function CreateRequestDialog({ caseId }: { caseId: string }) {
  return (
    <FormDialog
      trigger={
        <Button variant="secondary">
          <MessageSquarePlus />
          New request
        </Button>
      }
      title="Ask the client for something"
      description="Use this for information, confirmations or actions that are not a document."
      action={createRequest}
      submitLabel="Send request"
      pendingLabel="Sending…"
    >
      <input type="hidden" name="caseId" value={caseId} />
      <Field label="Title">
        <Input name="title" required autoFocus placeholder="e.g. Confirm your travel dates" />
      </Field>
      <Field label="Type">
        <Select name="type" defaultValue="INFORMATION">
          <option value="INFORMATION">Information</option>
          <option value="ACTION">Action</option>
          <option value="APPOINTMENT">Appointment</option>
          <option value="PAYMENT_CONFIRMATION">Payment confirmation</option>
        </Select>
      </Field>
      <Field label="Description">
        <Textarea name="description" rows={3} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Deadline">
          <Input name="deadline" type="date" />
        </Field>
        <label className="flex items-end gap-2 pb-2.5 text-sm">
          <input type="checkbox" name="notifyClient" defaultChecked className="h-4 w-4 rounded" />
          Notify the client
        </label>
      </div>
    </FormDialog>
  );
}

export function CreateTaskDialog({ caseId, team }: { caseId: string; team: TeamMember[] }) {
  return (
    <FormDialog
      trigger={
        <Button variant="secondary">
          <ListPlus />
          New task
        </Button>
      }
      title="Create a task"
      description="Internal tasks stay with your team. Client-visible tasks appear in their portal."
      action={createTask}
      submitLabel="Create task"
      pendingLabel="Creating…"
    >
      <input type="hidden" name="caseId" value={caseId} />
      <Field label="Title">
        <Input name="title" required autoFocus />
      </Field>
      <Field label="Description">
        <Textarea name="description" rows={3} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Assign to">
          <Select name="assignedToId" defaultValue="">
            <option value="">Me</option>
            {team.map((member) => (
              <option key={member.id} value={member.id}>
                {member.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Deadline">
          <Input name="deadline" type="date" />
        </Field>
      </div>
      <Field label="Visibility">
        <Select name="visibility" defaultValue="INTERNAL">
          <option value="INTERNAL">Internal only</option>
          <option value="CLIENT">Client only</option>
          <option value="BOTH">Both</option>
        </Select>
      </Field>
    </FormDialog>
  );
}

export function CaseSettingsDialog({
  caseId,
  title,
  status,
  assignedUserId,
  team,
}: {
  caseId: string;
  title: string;
  status: CaseStatus;
  assignedUserId: string | null;
  team: TeamMember[];
}) {
  return (
    <FormDialog
      trigger={
        <Button variant="ghost" size="icon" aria-label="Case settings">
          <Settings2 />
        </Button>
      }
      title="Case settings"
      description="Reassign the case, rename it, or put it on hold."
      action={updateCase}
      submitLabel="Save changes"
      pendingLabel="Saving…"
    >
      <input type="hidden" name="caseId" value={caseId} />
      <Field label="Case title">
        <Input name="title" defaultValue={title} required />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Assigned to">
          <Select name="assignedUserId" defaultValue={assignedUserId ?? ''}>
            <option value="">Leave unchanged</option>
            {team.map((member) => (
              <option key={member.id} value={member.id}>
                {member.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Status">
          <Select name="status" defaultValue={status}>
            <option value="ACTIVE">Active</option>
            <option value="ON_HOLD">On hold</option>
            <option value="COMPLETED">Completed</option>
            <option value="CANCELLED">Cancelled</option>
          </Select>
        </Field>
      </div>
    </FormDialog>
  );
}
