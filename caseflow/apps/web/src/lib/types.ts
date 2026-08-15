/** Shapes returned by the CaseFlow API, as consumed by the web app. */

export type Role = 'OWNER' | 'ADMIN' | 'MANAGER' | 'SPECIALIST' | 'CLIENT';
export type CaseStatus = 'DRAFT' | 'ACTIVE' | 'ON_HOLD' | 'COMPLETED' | 'CANCELLED';
export type StageStatus = 'PENDING' | 'ACTIVE' | 'COMPLETED' | 'BLOCKED';
export type RequirementStatus =
  | 'PENDING'
  | 'UPLOADED'
  | 'UNDER_REVIEW'
  | 'APPROVED'
  | 'REJECTED'
  | 'WAIVED';
export type DocumentStatus = 'UPLOADED' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED' | 'EXPIRED';
export type RequestStatus = 'OPEN' | 'COMPLETED' | 'OVERDUE' | 'CANCELLED';
export type RequestType = 'DOCUMENT' | 'INFORMATION' | 'ACTION' | 'PAYMENT_CONFIRMATION' | 'APPOINTMENT';
export type TaskStatus = 'OPEN' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
export type TaskVisibility = 'INTERNAL' | 'CLIENT' | 'BOTH';
export type ActorType = 'USER' | 'CLIENT' | 'SYSTEM' | 'INTEGRATION';

export interface Organization {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  customDomain?: string | null;
  timezone: string;
  primaryColor: string;
  supportEmail: string | null;
  portalWelcomeText: string | null;
  /** Есть ли активное подключение к CRM. Отсутствует в ответе /auth/me. */
  crmConnected?: boolean;
}

export interface Profile {
  id: string;
  name: string;
  email: string;
  role: Role;
  avatarUrl: string | null;
  clientId: string | null;
  client: { id: string; firstName: string; lastName: string } | null;
  organization: Organization;
}

export interface UserRef {
  id: string;
  name: string;
  email?: string;
  role?: Role;
  avatarUrl?: string | null;
}

export interface ClientRef {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string | null;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

export interface ClientListRow {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  activeCaseCount: number;
  totalCaseCount: number;
  assignedUser: UserRef | null;
  lastActivityAt: string;
  status: 'ACTIVE' | 'COMPLETED' | 'NEW';
}

export interface CaseListRow {
  id: string;
  title: string;
  status: CaseStatus;
  progress: number;
  lastActivityAt: string;
  externalCrmEntityId: string | null;
  client: ClientRef;
  assignedUser: UserRef | null;
  currentStage: { id: string; name: string; position: number } | null;
  template: { id: string; name: string } | null;
}

export interface DocumentRecord {
  id: string;
  filename: string;
  mimeType: string;
  fileSize: number;
  version: number;
  status: DocumentStatus;
  rejectionReason: string | null;
  createdAt: string;
  reviewedAt: string | null;
  uploadedBy?: UserRef | null;
  reviewedBy?: UserRef | { name: string } | null;
}

export interface Requirement {
  id: string;
  caseId: string;
  stageId: string | null;
  name: string;
  description: string | null;
  instructions: string | null;
  required: boolean;
  deadline: string | null;
  status: RequirementStatus;
  createdAt: string;
  stage?: { id: string; name: string } | null;
  case?: { id: string; title: string };
  documents: DocumentRecord[];
}

export interface Stage {
  id: string;
  name: string;
  description: string | null;
  position: number;
  status: StageStatus;
  startedAt: string | null;
  completedAt: string | null;
  requirements?: Requirement[];
}

export interface ClientRequestRecord {
  id: string;
  caseId: string;
  type: RequestType;
  title: string;
  description: string | null;
  deadline: string | null;
  status: RequestStatus;
  createdAt: string;
  completedAt: string | null;
  createdBy?: UserRef | null;
  case?: { id: string; title: string };
  client?: ClientRef;
  requirement?: { id: string; name: string; status: RequirementStatus } | null;
}

export interface TaskRecord {
  id: string;
  caseId: string;
  title: string;
  description: string | null;
  deadline: string | null;
  status: TaskStatus;
  visibility: TaskVisibility;
  completedAt: string | null;
  assignedTo?: UserRef | null;
  case?: { id: string; title: string };
}

export interface MessageRecord {
  id: string;
  caseId: string;
  body: string;
  senderType: ActorType;
  createdAt: string;
  sender: UserRef | null;
  case?: { id: string; title: string };
}

export interface ActivityEvent {
  id: string;
  caseId: string | null;
  actorType: ActorType;
  actorLabel: string | null;
  eventType: string;
  payload: Record<string, unknown>;
  createdAt: string;
  case?: { id: string; title: string } | null;
}

export interface CaseDetail {
  id: string;
  title: string;
  description: string | null;
  status: CaseStatus;
  progress: number;
  createdAt: string;
  lastActivityAt: string;
  externalCrmEntityId: string | null;
  crmProvider: string;
  client: ClientRef & { email: string; phone: string | null; telegramId: string | null };
  assignedUser: UserRef | null;
  template: { id: string; name: string } | null;
  currentStage: Stage | null;
  stages: Stage[];
  requirements: Requirement[];
  requests: ClientRequestRecord[];
  tasks: TaskRecord[];
  messages: MessageRecord[];
  activity: ActivityEvent[];
}

export interface ClientDetail {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  telegramId: string | null;
  externalCrmContactId: string | null;
  notes: string | null;
  createdAt: string;
  portalUser: { id: string; email: string; lastLoginAt: string | null } | null;
  cases: Array<CaseListRow & { currentStage: { id: string; name: string } | null }>;
  activeCases: CaseListRow[];
  completedCases: CaseListRow[];
  recentActivity: ActivityEvent[];
}

export interface DashboardData {
  metrics: { activeCases: number; myCases: number; documentsForReview: number; overdueRequests: number };
  needsAttention: Array<CaseListRow & { _count: { documents: number } }>;
  overdueRequests: ClientRequestRecord[];
  documentsForReview: Array<
    DocumentRecord & {
      case: { id: string; title: string; client: { firstName: string; lastName: string } };
      requirement: { id: string; name: string } | null;
    }
  >;
  deadlines: Array<{
    id: string;
    kind: 'DOCUMENT' | 'REQUEST';
    title: string;
    deadline: string | null;
    caseId: string;
    caseTitle: string;
    clientName: string;
  }>;
  staleCases: CaseListRow[];
  recentUploads: Array<
    DocumentRecord & { case: { id: string; title: string; client: { firstName: string; lastName: string } } }
  >;
}

export interface WorkflowTemplateSummary {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  stages: Array<{ id: string; name: string; position: number; _count?: { requirements: number } }>;
  _count: { cases: number };
}

export interface WorkflowTemplateDetail {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  stages: Array<{
    id: string;
    name: string;
    description: string | null;
    position: number;
    requirements: Array<{
      id: string;
      name: string;
      instructions: string | null;
      required: boolean;
      deadlineDays: number | null;
    }>;
  }>;
}

export interface PortalDashboard {
  organization: Pick<Organization, 'name' | 'logoUrl' | 'primaryColor' | 'supportEmail' | 'portalWelcomeText'>;
  client: { firstName: string; lastName: string; email: string };
  activeCase:
    | (CaseListRow & { stages: Stage[]; currentStage: Stage | null; description: string | null })
    | null;
  nextStage: Stage | null;
  cases: Array<CaseListRow & { stages: Stage[] }>;
  openRequests: ClientRequestRecord[];
  tasks: TaskRecord[];
  deadlines: Requirement[];
  activity: ActivityEvent[];
}

export interface PortalDocuments {
  required: Requirement[];
  underReview: Requirement[];
  approved: Requirement[];
  rejected: Requirement[];
  all: Requirement[];
}

export interface PortalRequests {
  open: ClientRequestRecord[];
  overdue: ClientRequestRecord[];
  completed: ClientRequestRecord[];
  cancelled: ClientRequestRecord[];
}

export interface PortalThread {
  id: string;
  title: string;
  assignedUser: UserRef | null;
  messages: MessageRecord[];
}

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: Role;
  avatarUrl: string | null;
  isActive: boolean;
  lastLoginAt: string | null;
  _count: { assignedCases: number };
}

export interface CrmSettings {
  availableProviders: string[];
  connections: Array<{
    id: string;
    provider: string;
    isActive: boolean;
    baseUrl: string | null;
    configuredKeys: string[];
    hasCredentials: boolean;
    webhookSecret: string | null;
    syncedFields: string[];
    lastSyncedAt: string | null;
    mappings: Array<{
      id: string;
      pipelineId: string;
      pipelineName: string | null;
      externalStageId: string;
      externalStageName: string | null;
      templateStageId: string | null;
      templateStage: { id: string; name: string; template: { id: string; name: string } } | null;
    }>;
  }>;
}

export interface NotificationRecord {
  id: string;
  subject: string;
  body: string;
  linkUrl: string | null;
  readAt: string | null;
  createdAt: string;
}
