// ============================================================
// Types Supabase générés via `mcp__supabase__generate_typescript_types`
// Source de vérité = schéma DB. À régénérer après chaque migration
// (Phase D2 du chantier d'audit).
//
// Cohabite avec src/types/index.ts (interfaces métier hand-rolled
// + types "*WithRelations"). Migration progressive vers ces types
// quand un fichier est touché.
// ============================================================

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      activities: {
        Row: {
          created_at: string;
          created_by: string | null;
          entity_id: string;
          entity_type: string;
          id: string;
          payload: Json | null;
          type: string;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          entity_id: string;
          entity_type: string;
          id?: string;
          payload?: Json | null;
          type: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          entity_id?: string;
          entity_type?: string;
          id?: string;
          payload?: Json | null;
          type?: string;
        };
      };
      agent_tasks: {
        Row: {
          agent: string;
          completed_at: string | null;
          context: Json;
          created_at: string;
          entity_id: string | null;
          entity_type: string | null;
          error: string | null;
          id: string;
          requested_by: string | null;
          result: Json | null;
          started_at: string | null;
          status: string;
        };
        Insert: {
          agent: string;
          completed_at?: string | null;
          context?: Json;
          created_at?: string;
          entity_id?: string | null;
          entity_type?: string | null;
          error?: string | null;
          id?: string;
          requested_by?: string | null;
          result?: Json | null;
          started_at?: string | null;
          status?: string;
        };
        Update: {
          agent?: string;
          completed_at?: string | null;
          context?: Json;
          created_at?: string;
          entity_id?: string | null;
          entity_type?: string | null;
          error?: string | null;
          id?: string;
          requested_by?: string | null;
          result?: Json | null;
          started_at?: string | null;
          status?: string;
        };
      };
      brief_tokens: {
        Row: {
          archived_at: string | null;
          archived_by: string | null;
          company_id: string | null;
          contact_id: string | null;
          created_at: string;
          created_by: string | null;
          expires_at: string;
          id: string;
          prospect_email: string;
          prospect_entreprise: string | null;
          prospect_nom: string;
          token: string;
          used: boolean;
          used_at: string | null;
        };
        Insert: {
          archived_at?: string | null;
          archived_by?: string | null;
          company_id?: string | null;
          contact_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          expires_at: string;
          id?: string;
          prospect_email: string;
          prospect_entreprise?: string | null;
          prospect_nom: string;
          token: string;
          used?: boolean;
          used_at?: string | null;
        };
        Update: {
          archived_at?: string | null;
          archived_by?: string | null;
          company_id?: string | null;
          contact_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          expires_at?: string;
          id?: string;
          prospect_email?: string;
          prospect_entreprise?: string | null;
          prospect_nom?: string;
          token?: string;
          used?: boolean;
          used_at?: string | null;
        };
      };
      briefs: {
        Row: {
          archived_at: string | null;
          archived_by: string | null;
          company_id: string | null;
          contact_id: string | null;
          id: string;
          pdf_generated_at: string | null;
          pdf_path: string | null;
          prospect_email: string | null;
          prospect_entreprise: string | null;
          prospect_nom: string | null;
          reponses: Json;
          submitted_at: string;
          token_id: string | null;
        };
        Insert: {
          archived_at?: string | null;
          archived_by?: string | null;
          company_id?: string | null;
          contact_id?: string | null;
          id?: string;
          pdf_generated_at?: string | null;
          pdf_path?: string | null;
          prospect_email?: string | null;
          prospect_entreprise?: string | null;
          prospect_nom?: string | null;
          reponses: Json;
          submitted_at?: string;
          token_id?: string | null;
        };
        Update: {
          archived_at?: string | null;
          archived_by?: string | null;
          company_id?: string | null;
          contact_id?: string | null;
          id?: string;
          pdf_generated_at?: string | null;
          pdf_path?: string | null;
          prospect_email?: string | null;
          prospect_entreprise?: string | null;
          prospect_nom?: string | null;
          reponses?: Json;
          submitted_at?: string;
          token_id?: string | null;
        };
      };
      calendar_event_links: {
        Row: {
          google_calendar_id: string;
          google_event_id: string;
          id: string;
          last_synced_at: string;
          source_id: string;
          source_kind: string;
          user_id: string;
        };
        Insert: {
          google_calendar_id: string;
          google_event_id: string;
          id?: string;
          last_synced_at?: string;
          source_id: string;
          source_kind: string;
          user_id: string;
        };
        Update: {
          google_calendar_id?: string;
          google_event_id?: string;
          id?: string;
          last_synced_at?: string;
          source_id?: string;
          source_kind?: string;
          user_id?: string;
        };
      };
      companies: {
        Row: {
          address: string | null;
          created_at: string;
          created_by: string;
          domain: string | null;
          id: string;
          name: string;
          notes: string | null;
          phone: string | null;
          sector: string | null;
          size: string | null;
          updated_at: string;
          website: string | null;
        };
        Insert: {
          address?: string | null;
          created_at?: string;
          created_by: string;
          domain?: string | null;
          id?: string;
          name: string;
          notes?: string | null;
          phone?: string | null;
          sector?: string | null;
          size?: string | null;
          updated_at?: string;
          website?: string | null;
        };
        Update: {
          address?: string | null;
          created_at?: string;
          created_by?: string;
          domain?: string | null;
          id?: string;
          name?: string;
          notes?: string | null;
          phone?: string | null;
          sector?: string | null;
          size?: string | null;
          updated_at?: string;
          website?: string | null;
        };
      };
      contacts: {
        Row: {
          company_id: string | null;
          created_at: string;
          created_by: string;
          email: string | null;
          first_name: string;
          id: string;
          last_name: string;
          notes: string | null;
          phone: string | null;
          role: string | null;
          updated_at: string;
        };
        Insert: {
          company_id?: string | null;
          created_at?: string;
          created_by: string;
          email?: string | null;
          first_name: string;
          id?: string;
          last_name: string;
          notes?: string | null;
          phone?: string | null;
          role?: string | null;
          updated_at?: string;
        };
        Update: {
          company_id?: string | null;
          created_at?: string;
          created_by?: string;
          email?: string | null;
          first_name?: string;
          id?: string;
          last_name?: string;
          notes?: string | null;
          phone?: string | null;
          role?: string | null;
          updated_at?: string;
        };
      };
      deals: {
        Row: {
          assigned_to: string | null;
          company_id: string | null;
          contact_id: string | null;
          created_at: string;
          created_by: string;
          drive_folder_id: string | null;
          drive_folder_url: string | null;
          expected_close_date: string | null;
          id: string;
          notes: string | null;
          probability: number | null;
          source_lead_id: string | null;
          stage: string;
          stage_order: number;
          title: string;
          updated_at: string;
          value: number | null;
        };
        Insert: {
          assigned_to?: string | null;
          company_id?: string | null;
          contact_id?: string | null;
          created_at?: string;
          created_by: string;
          drive_folder_id?: string | null;
          drive_folder_url?: string | null;
          expected_close_date?: string | null;
          id?: string;
          notes?: string | null;
          probability?: number | null;
          source_lead_id?: string | null;
          stage?: string;
          stage_order?: number;
          title: string;
          updated_at?: string;
          value?: number | null;
        };
        Update: {
          assigned_to?: string | null;
          company_id?: string | null;
          contact_id?: string | null;
          created_at?: string;
          created_by?: string;
          drive_folder_id?: string | null;
          drive_folder_url?: string | null;
          expected_close_date?: string | null;
          id?: string;
          notes?: string | null;
          probability?: number | null;
          source_lead_id?: string | null;
          stage?: string;
          stage_order?: number;
          title?: string;
          updated_at?: string;
          value?: number | null;
        };
      };
      email_campaigns: {
        Row: {
          created_at: string;
          id: string;
          lead_id: string;
          lead_snapshot: Json;
          selected_variant: Json | null;
          sent_at: string | null;
          sent_by: string | null;
          status: string;
          updated_at: string;
          variant_1: Json;
          variant_2: Json;
          variant_3: Json;
        };
        Insert: {
          created_at?: string;
          id?: string;
          lead_id: string;
          lead_snapshot?: Json;
          selected_variant?: Json | null;
          sent_at?: string | null;
          sent_by?: string | null;
          status?: string;
          updated_at?: string;
          variant_1?: Json;
          variant_2?: Json;
          variant_3?: Json;
        };
        Update: {
          created_at?: string;
          id?: string;
          lead_id?: string;
          lead_snapshot?: Json;
          selected_variant?: Json | null;
          sent_at?: string | null;
          sent_by?: string | null;
          status?: string;
          updated_at?: string;
          variant_1?: Json;
          variant_2?: Json;
          variant_3?: Json;
        };
      };
      entity_tags: {
        Row: {
          created_at: string;
          entity_id: string;
          entity_type: string;
          tag_id: string;
        };
        Insert: {
          created_at?: string;
          entity_id: string;
          entity_type: string;
          tag_id: string;
        };
        Update: {
          created_at?: string;
          entity_id?: string;
          entity_type?: string;
          tag_id?: string;
        };
      };
      invoice_items: {
        Row: {
          description: string;
          id: string;
          invoice_id: string;
          quantity: number;
          sort_order: number;
          total: number;
          unit_price: number;
        };
        Insert: {
          description: string;
          id?: string;
          invoice_id: string;
          quantity?: number;
          sort_order?: number;
          total?: number;
          unit_price?: number;
        };
        Update: {
          description?: string;
          id?: string;
          invoice_id?: string;
          quantity?: number;
          sort_order?: number;
          total?: number;
          unit_price?: number;
        };
      };
      invoices: {
        Row: {
          company_id: string | null;
          contact_id: string | null;
          created_at: string;
          created_by: string;
          due_date: string | null;
          id: string;
          issue_date: string;
          notes: string | null;
          number: string;
          project_id: string | null;
          status: string;
          subtotal: number;
          tax_amount: number;
          tax_rate: number;
          total: number;
          type: string;
          updated_at: string;
        };
        Insert: {
          company_id?: string | null;
          contact_id?: string | null;
          created_at?: string;
          created_by: string;
          due_date?: string | null;
          id?: string;
          issue_date?: string;
          notes?: string | null;
          number: string;
          project_id?: string | null;
          status?: string;
          subtotal?: number;
          tax_amount?: number;
          tax_rate?: number;
          total?: number;
          type?: string;
          updated_at?: string;
        };
        Update: {
          company_id?: string | null;
          contact_id?: string | null;
          created_at?: string;
          created_by?: string;
          due_date?: string | null;
          id?: string;
          issue_date?: string;
          notes?: string | null;
          number?: string;
          project_id?: string | null;
          status?: string;
          subtotal?: number;
          tax_amount?: number;
          tax_rate?: number;
          total?: number;
          type?: string;
          updated_at?: string;
        };
      };
      lead_imports: {
        Row: {
          assigned_to: string | null;
          company_active: boolean | null;
          company_domain: string | null;
          company_id: string | null;
          company_name: string | null;
          contact_id: string | null;
          duplicate_of: string | null;
          email: string | null;
          email_verified: string;
          estimated_budget: number | null;
          expected_close_date: string | null;
          external_id: string | null;
          first_name: string | null;
          id: string;
          imported_at: string;
          last_name: string | null;
          linkedin_verified: boolean;
          next_follow_up_at: string | null;
          notes: string | null;
          pagespeed_score: number | null;
          phone: string | null;
          pipeline_stage: string;
          processed_at: string | null;
          processed_by: string | null;
          qualification_score: number | null;
          quality_score: number | null;
          raw_payload: Json | null;
          role: string | null;
          source: string;
          stage_updated_at: string;
          status: string;
          temperature: string | null;
          verified_at: string | null;
        };
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
      };
      lead_intake_seen: {
        Row: {
          company_name: string;
          external_id: string;
          id: string;
          seen_at: string | null;
          source: string | null;
        };
        Insert: {
          company_name: string;
          external_id: string;
          id?: string;
          seen_at?: string | null;
          source?: string | null;
        };
        Update: {
          company_name?: string;
          external_id?: string;
          id?: string;
          seen_at?: string | null;
          source?: string | null;
        };
      };
      notifications: {
        Row: {
          body: string | null;
          created_at: string;
          id: string;
          link: string | null;
          read_at: string | null;
          title: string;
          type: string;
          user_id: string;
        };
        Insert: {
          body?: string | null;
          created_at?: string;
          id?: string;
          link?: string | null;
          read_at?: string | null;
          title: string;
          type: string;
          user_id: string;
        };
        Update: {
          body?: string | null;
          created_at?: string;
          id?: string;
          link?: string | null;
          read_at?: string | null;
          title?: string;
          type?: string;
          user_id?: string;
        };
      };
      profiles: {
        Row: {
          avatar_url: string | null;
          created_at: string | null;
          email: string;
          full_name: string | null;
          id: string;
          role: string;
          updated_at: string;
        };
        Insert: {
          avatar_url?: string | null;
          created_at?: string | null;
          email: string;
          full_name?: string | null;
          id: string;
          role?: string;
          updated_at?: string;
        };
        Update: {
          avatar_url?: string | null;
          created_at?: string | null;
          email?: string;
          full_name?: string | null;
          id?: string;
          role?: string;
          updated_at?: string;
        };
      };
      projects: {
        Row: {
          assigned_to: string | null;
          brief_id: string | null;
          budget: number | null;
          company_id: string | null;
          contact_id: string | null;
          created_at: string;
          created_by: string;
          deal_id: string | null;
          description: string | null;
          drive_folder_id: string | null;
          drive_folder_url: string | null;
          duration_days: number;
          end_date: string | null;
          id: string;
          name: string;
          start_date: string | null;
          status: string;
          updated_at: string;
        };
        Insert: {
          assigned_to?: string | null;
          brief_id?: string | null;
          budget?: number | null;
          company_id?: string | null;
          contact_id?: string | null;
          created_at?: string;
          created_by: string;
          deal_id?: string | null;
          description?: string | null;
          drive_folder_id?: string | null;
          drive_folder_url?: string | null;
          duration_days?: number;
          end_date?: string | null;
          id?: string;
          name: string;
          start_date?: string | null;
          status?: string;
          updated_at?: string;
        };
        Update: {
          assigned_to?: string | null;
          brief_id?: string | null;
          budget?: number | null;
          company_id?: string | null;
          contact_id?: string | null;
          created_at?: string;
          created_by?: string;
          deal_id?: string | null;
          description?: string | null;
          drive_folder_id?: string | null;
          drive_folder_url?: string | null;
          duration_days?: number;
          end_date?: string | null;
          id?: string;
          name?: string;
          start_date?: string | null;
          status?: string;
          updated_at?: string;
        };
      };
      prospection_settings: {
        Row: {
          id: string;
          key: string;
          updated_at: string;
          value: string;
        };
        Insert: { id?: string; key: string; updated_at?: string; value: string };
        Update: {
          id?: string;
          key?: string;
          updated_at?: string;
          value?: string;
        };
      };
      tags: {
        Row: {
          color: string;
          created_at: string;
          created_by: string | null;
          id: string;
          name: string;
        };
        Insert: {
          color?: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          name: string;
        };
        Update: {
          color?: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          name?: string;
        };
      };
      tasks: {
        Row: {
          assigned_to: string | null;
          auto_origin: string | null;
          created_at: string;
          created_by: string;
          description: string | null;
          due_date: string | null;
          id: string;
          priority: string;
          related_id: string | null;
          related_type: string | null;
          status: string;
          title: string;
          updated_at: string;
        };
        Insert: {
          assigned_to?: string | null;
          auto_origin?: string | null;
          created_at?: string;
          created_by: string;
          description?: string | null;
          due_date?: string | null;
          id?: string;
          priority?: string;
          related_id?: string | null;
          related_type?: string | null;
          status?: string;
          title: string;
          updated_at?: string;
        };
        Update: {
          assigned_to?: string | null;
          auto_origin?: string | null;
          created_at?: string;
          created_by?: string;
          description?: string | null;
          due_date?: string | null;
          id?: string;
          priority?: string;
          related_id?: string | null;
          related_type?: string | null;
          status?: string;
          title?: string;
          updated_at?: string;
        };
      };
      user_integrations: {
        Row: {
          access_token: string;
          connected_at: string;
          google_account_email: string | null;
          google_calendar_id: string | null;
          id: string;
          last_sync_at: string | null;
          last_sync_error: string | null;
          provider: string;
          refresh_token: string;
          scope: string;
          token_expires_at: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          access_token: string;
          connected_at?: string;
          google_account_email?: string | null;
          google_calendar_id?: string | null;
          id?: string;
          last_sync_at?: string | null;
          last_sync_error?: string | null;
          provider: string;
          refresh_token: string;
          scope: string;
          token_expires_at: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          access_token?: string;
          connected_at?: string;
          google_account_email?: string | null;
          google_calendar_id?: string | null;
          id?: string;
          last_sync_at?: string | null;
          last_sync_error?: string | null;
          provider?: string;
          refresh_token?: string;
          scope?: string;
          token_expires_at?: string;
          updated_at?: string;
          user_id?: string;
        };
      };
    };
    Views: {
      invoices_with_effective_status: {
        Row: {
          company_id: string | null;
          contact_id: string | null;
          created_at: string | null;
          created_by: string | null;
          due_date: string | null;
          id: string | null;
          issue_date: string | null;
          notes: string | null;
          number: string | null;
          project_id: string | null;
          raw_status: string | null;
          status: string | null;
          subtotal: number | null;
          tax_amount: number | null;
          tax_rate: number | null;
          total: number | null;
          type: string | null;
          updated_at: string | null;
        };
      };
    };
    Functions: {
      clean_replacement_chars: { Args: { t: string }; Returns: string };
      create_default_project_tasks: {
        Args: { p_project_id: string };
        Returns: undefined;
      };
      generate_invoice_number: { Args: { doc_type: string }; Returns: string };
    };
  };
};

// ============================================================
// Helpers d'accès aux tables (sucre syntaxique)
// ============================================================
type PublicSchema = Database["public"];

export type Tables<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Row"];

export type TablesInsert<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Insert"];

export type TablesUpdate<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Update"];
