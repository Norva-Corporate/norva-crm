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
  | "prospect"
  | "qualified"
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
  created_by: string;
  created_at: string;
  updated_at: string;
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
  start_date: string | null;
  end_date: string | null;
  budget: number | null;
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
