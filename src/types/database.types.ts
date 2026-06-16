export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      activities: {
        Row: {
          created_at: string
          created_by: string | null
          entity_id: string
          entity_type: string
          id: string
          payload: Json | null
          type: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          entity_id: string
          entity_type: string
          id?: string
          payload?: Json | null
          type: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          entity_id?: string
          entity_type?: string
          id?: string
          payload?: Json | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "activities_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_tasks: {
        Row: {
          agent: string
          completed_at: string | null
          context: Json
          created_at: string
          entity_id: string | null
          entity_type: string | null
          error: string | null
          id: string
          requested_by: string | null
          result: Json | null
          started_at: string | null
          status: string
        }
        Insert: {
          agent: string
          completed_at?: string | null
          context?: Json
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          error?: string | null
          id?: string
          requested_by?: string | null
          result?: Json | null
          started_at?: string | null
          status?: string
        }
        Update: {
          agent?: string
          completed_at?: string | null
          context?: Json
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          error?: string | null
          id?: string
          requested_by?: string | null
          result?: Json | null
          started_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_tasks_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      brief_tokens: {
        Row: {
          archived_at: string | null
          archived_by: string | null
          company_id: string | null
          contact_id: string | null
          created_at: string
          created_by: string | null
          expires_at: string
          id: string
          prospect_email: string
          prospect_entreprise: string | null
          prospect_nom: string
          token: string
          used: boolean
          used_at: string | null
        }
        Insert: {
          archived_at?: string | null
          archived_by?: string | null
          company_id?: string | null
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          expires_at: string
          id?: string
          prospect_email: string
          prospect_entreprise?: string | null
          prospect_nom: string
          token: string
          used?: boolean
          used_at?: string | null
        }
        Update: {
          archived_at?: string | null
          archived_by?: string | null
          company_id?: string | null
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          expires_at?: string
          id?: string
          prospect_email?: string
          prospect_entreprise?: string | null
          prospect_nom?: string
          token?: string
          used?: boolean
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "brief_tokens_archived_by_fkey"
            columns: ["archived_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brief_tokens_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brief_tokens_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brief_tokens_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      briefs: {
        Row: {
          archived_at: string | null
          archived_by: string | null
          company_id: string | null
          contact_id: string | null
          id: string
          pdf_generated_at: string | null
          pdf_path: string | null
          prospect_email: string | null
          prospect_entreprise: string | null
          prospect_nom: string | null
          reponses: Json
          submitted_at: string
          token_id: string | null
        }
        Insert: {
          archived_at?: string | null
          archived_by?: string | null
          company_id?: string | null
          contact_id?: string | null
          id?: string
          pdf_generated_at?: string | null
          pdf_path?: string | null
          prospect_email?: string | null
          prospect_entreprise?: string | null
          prospect_nom?: string | null
          reponses: Json
          submitted_at?: string
          token_id?: string | null
        }
        Update: {
          archived_at?: string | null
          archived_by?: string | null
          company_id?: string | null
          contact_id?: string | null
          id?: string
          pdf_generated_at?: string | null
          pdf_path?: string | null
          prospect_email?: string | null
          prospect_entreprise?: string | null
          prospect_nom?: string | null
          reponses?: Json
          submitted_at?: string
          token_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "briefs_archived_by_fkey"
            columns: ["archived_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "briefs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "briefs_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "briefs_token_id_fkey"
            columns: ["token_id"]
            isOneToOne: false
            referencedRelation: "brief_tokens"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_event_links: {
        Row: {
          google_calendar_id: string
          google_event_id: string
          id: string
          last_synced_at: string
          source_id: string
          source_kind: string
          user_id: string
        }
        Insert: {
          google_calendar_id: string
          google_event_id: string
          id?: string
          last_synced_at?: string
          source_id: string
          source_kind: string
          user_id: string
        }
        Update: {
          google_calendar_id?: string
          google_event_id?: string
          id?: string
          last_synced_at?: string
          source_id?: string
          source_kind?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_event_links_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      call_logs: {
        Row: {
          called_at: string
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: string
          notes: string | null
          reachability: string
          rep_id: string | null
          result: string | null
        }
        Insert: {
          called_at?: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          notes?: string | null
          reachability: string
          rep_id?: string | null
          result?: string | null
        }
        Update: {
          called_at?: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          notes?: string | null
          reachability?: string
          rep_id?: string | null
          result?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "call_logs_rep_id_fkey"
            columns: ["rep_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          address: string | null
          created_at: string
          created_by: string
          domain: string | null
          google_maps_url: string | null
          id: string
          name: string
          phone: string | null
          place_id: string | null
          sector: string | null
          siren: string | null
          size: string | null
          updated_at: string
          website: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string
          created_by: string
          domain?: string | null
          google_maps_url?: string | null
          id?: string
          name: string
          phone?: string | null
          place_id?: string | null
          sector?: string | null
          siren?: string | null
          size?: string | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string
          created_by?: string
          domain?: string | null
          google_maps_url?: string | null
          id?: string
          name?: string
          phone?: string | null
          place_id?: string | null
          sector?: string | null
          siren?: string | null
          size?: string | null
          updated_at?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "companies_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          company_id: string | null
          created_at: string
          created_by: string
          email: string | null
          first_name: string
          id: string
          last_name: string
          phone: string | null
          role: string | null
          updated_at: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          created_by: string
          email?: string | null
          first_name: string
          id?: string
          last_name: string
          phone?: string | null
          role?: string | null
          updated_at?: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          created_by?: string
          email?: string | null
          first_name?: string
          id?: string
          last_name?: string
          phone?: string | null
          role?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contacts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      deals: {
        Row: {
          assigned_to: string | null
          company_id: string | null
          contact_id: string | null
          created_at: string
          created_by: string
          drive_folder_id: string | null
          drive_folder_url: string | null
          expected_close_date: string | null
          id: string
          probability: number | null
          source_lead_id: string | null
          stage: string
          stage_order: number
          title: string
          updated_at: string
          value: number | null
        }
        Insert: {
          assigned_to?: string | null
          company_id?: string | null
          contact_id?: string | null
          created_at?: string
          created_by: string
          drive_folder_id?: string | null
          drive_folder_url?: string | null
          expected_close_date?: string | null
          id?: string
          probability?: number | null
          source_lead_id?: string | null
          stage?: string
          stage_order?: number
          title: string
          updated_at?: string
          value?: number | null
        }
        Update: {
          assigned_to?: string | null
          company_id?: string | null
          contact_id?: string | null
          created_at?: string
          created_by?: string
          drive_folder_id?: string | null
          drive_folder_url?: string | null
          expected_close_date?: string | null
          id?: string
          probability?: number | null
          source_lead_id?: string | null
          stage?: string
          stage_order?: number
          title?: string
          updated_at?: string
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "deals_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_source_lead_id_fkey"
            columns: ["source_lead_id"]
            isOneToOne: false
            referencedRelation: "lead_imports"
            referencedColumns: ["id"]
          },
        ]
      }
      email_campaigns: {
        Row: {
          created_at: string
          id: string
          lead_id: string
          lead_snapshot: Json
          selected_variant: Json | null
          sent_at: string | null
          sent_by: string | null
          status: string
          updated_at: string
          variant_1: Json
          variant_2: Json
          variant_3: Json
        }
        Insert: {
          created_at?: string
          id?: string
          lead_id: string
          lead_snapshot?: Json
          selected_variant?: Json | null
          sent_at?: string | null
          sent_by?: string | null
          status?: string
          updated_at?: string
          variant_1?: Json
          variant_2?: Json
          variant_3?: Json
        }
        Update: {
          created_at?: string
          id?: string
          lead_id?: string
          lead_snapshot?: Json
          selected_variant?: Json | null
          sent_at?: string | null
          sent_by?: string | null
          status?: string
          updated_at?: string
          variant_1?: Json
          variant_2?: Json
          variant_3?: Json
        }
        Relationships: [
          {
            foreignKeyName: "email_campaigns_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "lead_imports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_campaigns_sent_by_fkey"
            columns: ["sent_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      entity_tags: {
        Row: {
          created_at: string
          entity_id: string
          entity_type: string
          tag_id: string
        }
        Insert: {
          created_at?: string
          entity_id: string
          entity_type: string
          tag_id: string
        }
        Update: {
          created_at?: string
          entity_id?: string
          entity_type?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "entity_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      goals: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          metric_type: string
          owner_profile_id: string | null
          period_end: string
          period_start: string
          period_type: string
          scope: string
          status: string
          target_value: number
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          metric_type: string
          owner_profile_id?: string | null
          period_end: string
          period_start: string
          period_type: string
          scope?: string
          status?: string
          target_value: number
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          metric_type?: string
          owner_profile_id?: string | null
          period_end?: string
          period_start?: string
          period_type?: string
          scope?: string
          status?: string
          target_value?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "goals_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goals_owner_profile_id_fkey"
            columns: ["owner_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_items: {
        Row: {
          description: string
          id: string
          invoice_id: string
          quantity: number
          sort_order: number
          total: number
          unit_price: number
        }
        Insert: {
          description: string
          id?: string
          invoice_id: string
          quantity?: number
          sort_order?: number
          total?: number
          unit_price?: number
        }
        Update: {
          description?: string
          id?: string
          invoice_id?: string
          quantity?: number
          sort_order?: number
          total?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices_with_effective_status"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          company_id: string | null
          contact_id: string | null
          created_at: string
          created_by: string
          due_date: string | null
          id: string
          issue_date: string
          notes: string | null
          number: string
          project_id: string | null
          status: string
          subtotal: number
          tax_amount: number
          tax_rate: number
          total: number
          type: string
          updated_at: string
        }
        Insert: {
          company_id?: string | null
          contact_id?: string | null
          created_at?: string
          created_by: string
          due_date?: string | null
          id?: string
          issue_date?: string
          notes?: string | null
          number: string
          project_id?: string | null
          status?: string
          subtotal?: number
          tax_amount?: number
          tax_rate?: number
          total?: number
          type?: string
          updated_at?: string
        }
        Update: {
          company_id?: string | null
          contact_id?: string | null
          created_at?: string
          created_by?: string
          due_date?: string | null
          id?: string
          issue_date?: string
          notes?: string | null
          number?: string
          project_id?: string | null
          status?: string
          subtotal?: number
          tax_amount?: number
          tax_rate?: number
          total?: number
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_imports: {
        Row: {
          assigned_to: string | null
          company_active: boolean | null
          company_domain: string | null
          company_id: string | null
          company_name: string | null
          contact_id: string | null
          duplicate_of: string | null
          email: string | null
          email_verified: string
          estimated_budget: number | null
          expected_close_date: string | null
          external_id: string | null
          external_links: Json
          first_name: string | null
          id: string
          imported_at: string
          last_name: string | null
          linkedin_verified: boolean
          next_follow_up_at: string | null
          pagespeed_score: number | null
          phone: string | null
          pipeline_stage: string
          processed_at: string | null
          processed_by: string | null
          qualification_score: number | null
          quality_score: number | null
          raw_payload: Json | null
          role: string | null
          source: string
          stage_updated_at: string
          status: string
          temperature: string | null
          verified_at: string | null
        }
        Insert: {
          assigned_to?: string | null
          company_active?: boolean | null
          company_domain?: string | null
          company_id?: string | null
          company_name?: string | null
          contact_id?: string | null
          duplicate_of?: string | null
          email?: string | null
          email_verified?: string
          estimated_budget?: number | null
          expected_close_date?: string | null
          external_id?: string | null
          external_links?: Json
          first_name?: string | null
          id?: string
          imported_at?: string
          last_name?: string | null
          linkedin_verified?: boolean
          next_follow_up_at?: string | null
          pagespeed_score?: number | null
          phone?: string | null
          pipeline_stage?: string
          processed_at?: string | null
          processed_by?: string | null
          qualification_score?: number | null
          quality_score?: number | null
          raw_payload?: Json | null
          role?: string | null
          source?: string
          stage_updated_at?: string
          status?: string
          temperature?: string | null
          verified_at?: string | null
        }
        Update: {
          assigned_to?: string | null
          company_active?: boolean | null
          company_domain?: string | null
          company_id?: string | null
          company_name?: string | null
          contact_id?: string | null
          duplicate_of?: string | null
          email?: string | null
          email_verified?: string
          estimated_budget?: number | null
          expected_close_date?: string | null
          external_id?: string | null
          external_links?: Json
          first_name?: string | null
          id?: string
          imported_at?: string
          last_name?: string | null
          linkedin_verified?: boolean
          next_follow_up_at?: string | null
          pagespeed_score?: number | null
          phone?: string | null
          pipeline_stage?: string
          processed_at?: string | null
          processed_by?: string | null
          qualification_score?: number | null
          quality_score?: number | null
          raw_payload?: Json | null
          role?: string | null
          source?: string
          stage_updated_at?: string
          status?: string
          temperature?: string | null
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_imports_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_imports_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_imports_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_imports_duplicate_of_fkey"
            columns: ["duplicate_of"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_imports_processed_by_fkey"
            columns: ["processed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_intake_seen: {
        Row: {
          company_name: string
          external_id: string
          id: string
          seen_at: string | null
          source: string | null
        }
        Insert: {
          company_name: string
          external_id: string
          id?: string
          seen_at?: string | null
          source?: string | null
        }
        Update: {
          company_name?: string
          external_id?: string
          id?: string
          seen_at?: string | null
          source?: string | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          link: string | null
          read_at: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          read_at?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          read_at?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      objection_logs: {
        Row: {
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: string
          notes: string | null
          objection_id: string
          objection_label: string | null
          outcome: string | null
          pain_id: string | null
          rep_id: string | null
          stage: string
        }
        Insert: {
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          notes?: string | null
          objection_id: string
          objection_label?: string | null
          outcome?: string | null
          pain_id?: string | null
          rep_id?: string | null
          stage: string
        }
        Update: {
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          notes?: string | null
          objection_id?: string
          objection_label?: string | null
          outcome?: string | null
          pain_id?: string | null
          rep_id?: string | null
          stage?: string
        }
        Relationships: [
          {
            foreignKeyName: "objection_logs_rep_id_fkey"
            columns: ["rep_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      places_search_cache: {
        Row: {
          cached_at: string
          hit_count: number
          language_code: string
          query_signature: string
          region_code: string
          result_count: number
          results: Json
        }
        Insert: {
          cached_at?: string
          hit_count?: number
          language_code?: string
          query_signature: string
          region_code?: string
          result_count: number
          results: Json
        }
        Update: {
          cached_at?: string
          hit_count?: number
          language_code?: string
          query_signature?: string
          region_code?: string
          result_count?: number
          results?: Json
        }
        Relationships: []
      }
      places_search_log: {
        Row: {
          cache_hit: boolean
          id: string
          new_place_ids: number
          query_signature: string
          region_code: string
          result_count: number
          run_at: string
        }
        Insert: {
          cache_hit: boolean
          id?: string
          new_place_ids: number
          query_signature: string
          region_code: string
          result_count: number
          run_at?: string
        }
        Update: {
          cache_hit?: boolean
          id?: string
          new_place_ids?: number
          query_signature?: string
          region_code?: string
          result_count?: number
          run_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          email: string
          full_name: string | null
          id: string
          role: string
          role_id: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          email: string
          full_name?: string | null
          id: string
          role?: string
          role_id?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string
          full_name?: string | null
          id?: string
          role?: string
          role_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          assigned_to: string | null
          brief_id: string | null
          budget: number | null
          company_id: string | null
          contact_id: string | null
          created_at: string
          created_by: string
          deal_id: string | null
          description: string | null
          drive_folder_id: string | null
          drive_folder_url: string | null
          duration_days: number
          end_date: string | null
          id: string
          name: string
          start_date: string | null
          status: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          brief_id?: string | null
          budget?: number | null
          company_id?: string | null
          contact_id?: string | null
          created_at?: string
          created_by: string
          deal_id?: string | null
          description?: string | null
          drive_folder_id?: string | null
          drive_folder_url?: string | null
          duration_days?: number
          end_date?: string | null
          id?: string
          name: string
          start_date?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          brief_id?: string | null
          budget?: number | null
          company_id?: string | null
          contact_id?: string | null
          created_at?: string
          created_by?: string
          deal_id?: string | null
          description?: string | null
          drive_folder_id?: string | null
          drive_folder_url?: string | null
          duration_days?: number
          end_date?: string | null
          id?: string
          name?: string
          start_date?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_brief_id_fkey"
            columns: ["brief_id"]
            isOneToOne: false
            referencedRelation: "briefs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      prospection_settings: {
        Row: {
          id: string
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          id?: string
          key: string
          updated_at?: string
          value: string
        }
        Update: {
          id?: string
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      role_permissions: {
        Row: {
          permission_key: string
          role_id: string
        }
        Insert: {
          permission_key: string
          role_id: string
        }
        Update: {
          permission_key?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_system: boolean
          key: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_system?: boolean
          key: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_system?: boolean
          key?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      tags: {
        Row: {
          color: string
          created_at: string
          created_by: string | null
          id: string
          name: string
        }
        Insert: {
          color?: string
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
        }
        Update: {
          color?: string
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "tags_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      task_templates: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          items: Json
          name: string
          scope: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          items?: Json
          name: string
          scope?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          items?: Json
          name?: string
          scope?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assigned_to: string | null
          auto_origin: string | null
          created_at: string
          created_by: string
          description: string | null
          due_date: string | null
          id: string
          priority: string
          related_id: string | null
          related_type: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          auto_origin?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          due_date?: string | null
          id?: string
          priority?: string
          related_id?: string | null
          related_type?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          auto_origin?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          due_date?: string | null
          id?: string
          priority?: string
          related_id?: string | null
          related_type?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_integrations: {
        Row: {
          access_token: string
          connected_at: string
          google_account_email: string | null
          google_calendar_id: string | null
          id: string
          last_sync_at: string | null
          last_sync_error: string | null
          provider: string
          refresh_token: string
          scope: string
          token_expires_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token: string
          connected_at?: string
          google_account_email?: string | null
          google_calendar_id?: string | null
          id?: string
          last_sync_at?: string | null
          last_sync_error?: string | null
          provider: string
          refresh_token: string
          scope: string
          token_expires_at: string
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string
          connected_at?: string
          google_account_email?: string | null
          google_calendar_id?: string | null
          id?: string
          last_sync_at?: string | null
          last_sync_error?: string | null
          provider?: string
          refresh_token?: string
          scope?: string
          token_expires_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_integrations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      invoices_with_effective_status: {
        Row: {
          company_id: string | null
          contact_id: string | null
          created_at: string | null
          created_by: string | null
          due_date: string | null
          id: string | null
          issue_date: string | null
          notes: string | null
          number: string | null
          project_id: string | null
          raw_status: string | null
          status: string | null
          subtotal: number | null
          tax_amount: number | null
          tax_rate: number | null
          total: number | null
          type: string | null
          updated_at: string | null
        }
        Insert: {
          company_id?: string | null
          contact_id?: string | null
          created_at?: string | null
          created_by?: string | null
          due_date?: string | null
          id?: string | null
          issue_date?: string | null
          notes?: string | null
          number?: string | null
          project_id?: string | null
          raw_status?: string | null
          status?: never
          subtotal?: number | null
          tax_amount?: number | null
          tax_rate?: number | null
          total?: number | null
          type?: string | null
          updated_at?: string | null
        }
        Update: {
          company_id?: string | null
          contact_id?: string | null
          created_at?: string | null
          created_by?: string | null
          due_date?: string | null
          id?: string | null
          issue_date?: string | null
          notes?: string | null
          number?: string | null
          project_id?: string | null
          raw_status?: string | null
          status?: never
          subtotal?: number | null
          tax_amount?: number | null
          tax_rate?: number | null
          total?: number | null
          type?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      v_prospection_weekly: {
        Row: {
          a_rappeler: number | null
          appels_passes: number | null
          devis_a_envoyer: number | null
          rdv_obtenus: number | null
          rep_id: string | null
          repondus: number | null
          sans_reponse: number | null
          week: string | null
        }
        Relationships: [
          {
            foreignKeyName: "call_logs_rep_id_fkey"
            columns: ["rep_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      clean_replacement_chars: { Args: { t: string }; Returns: string }
      create_default_project_tasks: {
        Args: { p_project_id: string }
        Returns: undefined
      }
      generate_invoice_number: { Args: { doc_type: string }; Returns: string }
      has_permission: { Args: { perm_key: string }; Returns: boolean }
      is_admin: { Args: never; Returns: boolean }
      purge_lead_intake_seen: {
        Args: { older_than_days?: number }
        Returns: number
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
