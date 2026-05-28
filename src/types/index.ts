export type UserRole = "admin" | "member";

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  role: UserRole;
  created_at: string;
  updated_at: string;
}

export interface Company {
  id: string;
  name: string;
  domain: string | null;
  sector: string | null;
  size: string | null;
  website: string | null;
  phone: string | null;
  address: string | null;
  notes: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface Contact {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  role: string | null;
  company_id: string | null;
  company?: Company;
  notes: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export type DealStage =
  | "discussion"
  | "proposal"
  | "negotiation"
  | "won"
  | "lost";

export interface Deal {
  id: string;
  title: string;
  value: number | null;
  stage: DealStage;
  probability: number | null;
  expected_close_date: string | null;
  contact_id: string | null;
  contact?: Contact;
  company_id: string | null;
  company?: Company;
  assigned_to: string | null;
  assignee?: Profile;
  notes: string | null;
  /** Lead d'origine si le deal a été créé via convertLeadToDeal (022) */
  source_lead_id: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface DealSourceLead {
  id: string;
  first_name: string | null;
  last_name: string | null;
  company_name: string | null;
}

export type ProjectStatus =
  | "en_attente"
  | "en_cours"
  | "en_pause"
  | "termine"
  | "annule";

export interface Project {
  id: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  deal_id: string | null;
  deal?: Deal;
  contact_id: string | null;
  contact?: Contact;
  company_id: string | null;
  company?: Company;
  start_date: string | null;
  end_date: string | null;
  budget: number | null;
  /** Durée prévue du delivery en jours (1-180, default 14). Module les délais des tâches auto (023). */
  duration_days: number;
  assigned_to: string | null;
  assignee?: Profile;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export type InvoiceStatus =
  | "brouillon"
  | "envoyee"
  | "payee"
  | "en_retard"
  | "annulee";

export type DocumentType = "quote" | "invoice";

export interface InvoiceItem {
  id: string;
  invoice_id: string;
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
  sort_order: number;
}

export interface Invoice {
  id: string;
  number: string;
  type: DocumentType;
  status: InvoiceStatus;
  project_id: string | null;
  project?: Project;
  contact_id: string | null;
  contact?: Contact;
  company_id: string | null;
  company?: Company;
  issue_date: string;
  due_date: string | null;
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  total: number;
  notes: string | null;
  items?: InvoiceItem[];
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface DealWithRelations {
  id: string;
  title: string;
  value: number | null;
  stage: DealStage;
  probability: number | null;
  expected_close_date: string | null;
  contact_id: string | null;
  contact: Contact | null;
  company_id: string | null;
  company: Company | null;
  assigned_to: string | null;
  assignee: Profile | null;
  notes: string | null;
  source_lead_id: string | null;
  source_lead: DealSourceLead | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface ContactWithRelations {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  role: string | null;
  company_id: string | null;
  company: Company | null;
  notes: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface ContactWithDeals extends ContactWithRelations {
  deals: DealWithRelations[];
}

export interface CompanyWithRelations extends Company {
  contacts: Contact[];
  deals: DealWithRelations[];
}

// ============================================================
// Tasks
// ============================================================
export type TaskStatus = "pending" | "in_progress" | "done" | "cancelled";
export type TaskPriority = "low" | "normal" | "high" | "urgent";
export type TaskRelatedType =
  | "contact"
  | "company"
  | "deal"
  | "project"
  | "lead_import";

export interface Task {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string | null;
  related_type: TaskRelatedType | null;
  related_id: string | null;
  assigned_to: string | null;
  assignee?: Profile | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

// ============================================================
// Activities
// ============================================================
export type ActivityEntityType =
  | "contact"
  | "company"
  | "deal"
  | "project"
  | "invoice"
  | "lead_import";

export type ActivityType =
  | "deal_created"
  | "deal_stage_changed"
  | "invoice_created"
  | "invoice_status_changed"
  | "project_created"
  | "project_status_changed"
  | "note"
  | "call"
  | "meeting"
  | "email";

export interface Activity {
  id: string;
  type: ActivityType | string;
  entity_type: ActivityEntityType;
  entity_id: string;
  payload: Record<string, unknown> | null;
  created_by: string | null;
  author?: Pick<Profile, "id" | "full_name" | "avatar_url"> | null;
  created_at: string;
}

// ============================================================
// Notifications
// ============================================================
export type NotificationType =
  | "task_assigned"
  | "deal_assigned"
  | "invoice_paid"
  | "discussion_mention"
  | string;

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
}

// ============================================================
// Tags
// ============================================================
export type TagEntityType =
  | "contact"
  | "company"
  | "deal"
  | "project"
  | "lead_import";

export interface Tag {
  id: string;
  name: string;
  color: string;
  created_by: string | null;
  created_at: string;
}

export interface EntityTag {
  tag_id: string;
  entity_type: TagEntityType;
  entity_id: string;
  created_at: string;
}

// ============================================================
// Agent Tasks
// ============================================================
export type AgentTaskStatus =
  | "pending"
  | "running"
  | "done"
  | "error"
  | "cancelled";

export type AgentTaskEntityType =
  | "contact"
  | "company"
  | "deal"
  | "project"
  | "lead_import";

export type AgentName =
  | "premier-contact"
  | "enrichissement"
  | "audit-site"
  | "rescoring-deal"
  | string;

export interface AgentTask {
  id: string;
  agent: AgentName;
  status: AgentTaskStatus;
  entity_type: AgentTaskEntityType | null;
  entity_id: string | null;
  context: Record<string, unknown>;
  requested_by: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  result: Record<string, unknown> | null;
  error: string | null;
}

// ============================================================
// Discussion (messagerie interne)
// ============================================================
export type MentionType =
  | "user"
  | "company"
  | "contact"
  | "project"
  | "task"
  | "invoice";

export interface Mention {
  type: MentionType;
  id: string;
  label: string;
}

export interface Attachment {
  path: string;
  name: string;
  size: number;
  mime: string;
}

export interface DiscussionChannel {
  id: string;
  name: string;
  description: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface DiscussionMessage {
  id: string;
  channel_id: string;
  user_id: string | null;
  content: string;
  parent_id: string | null;
  attachments: Attachment[];
  mentions: Mention[];
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
  author?: Pick<Profile, "id" | "full_name" | "avatar_url" | "email"> | null;
}

export interface DiscussionRead {
  user_id: string;
  channel_id: string;
  last_read_at: string;
}

export interface ChannelWithUnread extends DiscussionChannel {
  unread_count: number;
  last_read_at: string | null;
}

// ============================================================
// Custom Fields
// ============================================================

export type CustomFieldType =
  | "text"
  | "number"
  | "date"
  | "select"
  | "url"
  | "boolean";

export type CustomFieldEntityType =
  | "contact"
  | "company"
  | "deal"
  | "project"
  | "lead_import";

export interface CustomFieldDefinition {
  id: string;
  entity_type: CustomFieldEntityType;
  name: string;
  field_type: CustomFieldType;
  options: string[] | null;
  required: boolean;
  sort_order: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CustomFieldValue {
  id: string;
  field_id: string;
  entity_type: CustomFieldEntityType;
  entity_id: string;
  value: string | null;
  created_at: string;
  updated_at: string;
}

/** Définition enrichie avec la valeur courante pour une entité donnée. */
export interface CustomFieldWithValue extends CustomFieldDefinition {
  value: string | null;
  value_id: string | null;
}
