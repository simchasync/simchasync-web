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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      admin_audit_logs: {
        Row: {
          action: string
          admin_user_id: string
          created_at: string
          details: Json | null
          id: string
          target_tenant_id: string | null
          target_user_id: string | null
        }
        Insert: {
          action: string
          admin_user_id: string
          created_at?: string
          details?: Json | null
          id?: string
          target_tenant_id?: string | null
          target_user_id?: string | null
        }
        Update: {
          action?: string
          admin_user_id?: string
          created_at?: string
          details?: Json | null
          id?: string
          target_tenant_id?: string | null
          target_user_id?: string | null
        }
        Relationships: []
      }
      agents: {
        Row: {
          commission_rate: number
          created_at: string
          email: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          commission_rate?: number
          created_at?: string
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          commission_rate?: number
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agents_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_agents: {
        Row: {
          agent_id: string
          commission_amount: number | null
          commission_paid: boolean
          commission_rate: number
          created_at: string
          event_id: string
          id: string
          notes: string | null
        }
        Insert: {
          agent_id: string
          commission_amount?: number | null
          commission_paid?: boolean
          commission_rate?: number
          created_at?: string
          event_id: string
          id?: string
          notes?: string | null
        }
        Update: {
          agent_id?: string
          commission_amount?: number | null
          commission_paid?: boolean
          commission_rate?: number
          created_at?: string
          event_id?: string
          id?: string
          notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "booking_agents_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_agents_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_requests: {
        Row: {
          created_at: string
          email: string | null
          event_date: string | null
          event_type: string | null
          id: string
          message: string | null
          name: string
          phone: string | null
          price: number | null
          source_colleague_id: string | null
          source_event_id: string | null
          source_tenant_id: string | null
          status: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          event_date?: string | null
          event_type?: string | null
          id?: string
          message?: string | null
          name: string
          phone?: string | null
          price?: number | null
          source_colleague_id?: string | null
          source_event_id?: string | null
          source_tenant_id?: string | null
          status?: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          event_date?: string | null
          event_type?: string | null
          id?: string
          message?: string | null
          name?: string
          phone?: string | null
          price?: number | null
          source_colleague_id?: string | null
          source_event_id?: string | null
          source_tenant_id?: string | null
          status?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_requests_source_colleague_id_fkey"
            columns: ["source_colleague_id"]
            isOneToOne: false
            referencedRelation: "event_colleagues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_requests_source_event_id_fkey"
            columns: ["source_event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_requests_source_tenant_id_fkey"
            columns: ["source_tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_requests_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      cancellation_feedback: {
        Row: {
          created_at: string
          details: string | null
          id: string
          outcome: string
          plan: string | null
          reason: string
          tenant_id: string
          tenant_name: string | null
          user_email: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          details?: string | null
          id?: string
          outcome: string
          plan?: string | null
          reason: string
          tenant_id: string
          tenant_name?: string | null
          user_email?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          details?: string | null
          id?: string
          outcome?: string
          plan?: string | null
          reason?: string
          tenant_id?: string
          tenant_name?: string | null
          user_email?: string | null
          user_id?: string
        }
        Relationships: []
      }
      clients: {
        Row: {
          created_at: string
          email: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clients_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      colleagues: {
        Row: {
          created_at: string
          default_price: number | null
          email: string | null
          full_name: string
          id: string
          notes: string | null
          phone: string | null
          role_instrument: string | null
          tenant_id: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          default_price?: number | null
          email?: string | null
          full_name: string
          id?: string
          notes?: string | null
          phone?: string | null
          role_instrument?: string | null
          tenant_id: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          default_price?: number | null
          email?: string | null
          full_name?: string
          id?: string
          notes?: string | null
          phone?: string | null
          role_instrument?: string | null
          tenant_id?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "colleagues_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      event_attachments: {
        Row: {
          created_at: string
          event_id: string
          file_type: string | null
          file_url: string
          id: string
          name: string | null
        }
        Insert: {
          created_at?: string
          event_id: string
          file_type?: string | null
          file_url: string
          id?: string
          name?: string | null
        }
        Update: {
          created_at?: string
          event_id?: string
          file_type?: string | null
          file_url?: string
          id?: string
          name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_attachments_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_colleagues: {
        Row: {
          booking_request_id: string | null
          colleague_id: string | null
          colleague_type: string
          created_at: string
          email: string | null
          event_id: string
          id: string
          invite_status: string
          name: string | null
          notes: string | null
          payment_responsibility: string
          phone: string | null
          price: number | null
          role_instrument: string | null
          user_id: string | null
        }
        Insert: {
          booking_request_id?: string | null
          colleague_id?: string | null
          colleague_type?: string
          created_at?: string
          email?: string | null
          event_id: string
          id?: string
          invite_status?: string
          name?: string | null
          notes?: string | null
          payment_responsibility?: string
          phone?: string | null
          price?: number | null
          role_instrument?: string | null
          user_id?: string | null
        }
        Update: {
          booking_request_id?: string | null
          colleague_id?: string | null
          colleague_type?: string
          created_at?: string
          email?: string | null
          event_id?: string
          id?: string
          invite_status?: string
          name?: string | null
          notes?: string | null
          payment_responsibility?: string
          phone?: string | null
          price?: number | null
          role_instrument?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_colleagues_booking_request_id_fkey"
            columns: ["booking_request_id"]
            isOneToOne: false
            referencedRelation: "booking_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_colleagues_colleague_id_fkey"
            columns: ["colleague_id"]
            isOneToOne: false
            referencedRelation: "colleagues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_colleagues_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_expenses: {
        Row: {
          amount: number
          category: string | null
          created_at: string
          event_id: string
          expense_name: string
          id: string
          notes: string | null
        }
        Insert: {
          amount?: number
          category?: string | null
          created_at?: string
          event_id: string
          expense_name: string
          id?: string
          notes?: string | null
        }
        Update: {
          amount?: number
          category?: string | null
          created_at?: string
          event_id?: string
          expense_name?: string
          id?: string
          notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_expenses_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_payments: {
        Row: {
          amount: number
          created_at: string
          event_id: string
          id: string
          invoice_id: string | null
          method: string
          notes: string | null
          payment_date: string
        }
        Insert: {
          amount?: number
          created_at?: string
          event_id: string
          id?: string
          invoice_id?: string | null
          method?: string
          notes?: string | null
          payment_date?: string
        }
        Update: {
          amount?: number
          created_at?: string
          event_id?: string
          id?: string
          invoice_id?: string | null
          method?: string
          notes?: string | null
          payment_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_payments_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      event_songs: {
        Row: {
          artist: string | null
          created_at: string
          event_id: string
          id: string
          notes: string | null
          segment: string
          song_title: string
          sort_order: number
        }
        Insert: {
          artist?: string | null
          created_at?: string
          event_id: string
          id?: string
          notes?: string | null
          segment?: string
          song_title: string
          sort_order?: number
        }
        Update: {
          artist?: string | null
          created_at?: string
          event_id?: string
          id?: string
          notes?: string | null
          segment?: string
          song_title?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "event_songs_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_team_members: {
        Row: {
          cost: number | null
          created_at: string
          event_id: string
          id: string
          invitation_status: string
          invited_at: string | null
          name: string | null
          notes: string | null
          responded_at: string | null
          role: string | null
          user_id: string | null
        }
        Insert: {
          cost?: number | null
          created_at?: string
          event_id: string
          id?: string
          invitation_status?: string
          invited_at?: string | null
          name?: string | null
          notes?: string | null
          responded_at?: string | null
          role?: string | null
          user_id?: string | null
        }
        Update: {
          cost?: number | null
          created_at?: string
          event_id?: string
          id?: string
          invitation_status?: string
          invited_at?: string | null
          name?: string | null
          notes?: string | null
          responded_at?: string | null
          role?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_team_members_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          balance_due: number | null
          chuppah_time: string | null
          client_id: string | null
          created_at: string
          deposit: number | null
          deposit_status: string
          due_date: string | null
          event_date: string
          event_start_time: string | null
          event_type: string
          first_dance_time: string | null
          hebrew_date: string | null
          id: string
          location: string | null
          meal_time: string | null
          mitzvah_tanz_time: string | null
          notes: string | null
          payment_status: Database["public"]["Enums"]["payment_status"]
          second_dance_time: string | null
          tenant_id: string
          total_price: number | null
          travel_fee: number | null
          updated_at: string
          venue: string | null
        }
        Insert: {
          balance_due?: number | null
          chuppah_time?: string | null
          client_id?: string | null
          created_at?: string
          deposit?: number | null
          deposit_status?: string
          due_date?: string | null
          event_date: string
          event_start_time?: string | null
          event_type?: string
          first_dance_time?: string | null
          hebrew_date?: string | null
          id?: string
          location?: string | null
          meal_time?: string | null
          mitzvah_tanz_time?: string | null
          notes?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          second_dance_time?: string | null
          tenant_id: string
          total_price?: number | null
          travel_fee?: number | null
          updated_at?: string
          venue?: string | null
        }
        Update: {
          balance_due?: number | null
          chuppah_time?: string | null
          client_id?: string | null
          created_at?: string
          deposit?: number | null
          deposit_status?: string
          due_date?: string | null
          event_date?: string
          event_start_time?: string | null
          event_type?: string
          first_dance_time?: string | null
          hebrew_date?: string | null
          id?: string
          location?: string | null
          meal_time?: string | null
          mitzvah_tanz_time?: string | null
          notes?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          second_dance_time?: string | null
          tenant_id?: string
          total_price?: number | null
          travel_fee?: number | null
          updated_at?: string
          venue?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "events_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      feature_requests: {
        Row: {
          admin_notes: string | null
          created_at: string
          description: string | null
          id: string
          status: string
          tenant_id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string
          description?: string | null
          id?: string
          status?: string
          tenant_id: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_notes?: string | null
          created_at?: string
          description?: string | null
          id?: string
          status?: string
          tenant_id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "feature_requests_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount: number
          client_id: string | null
          created_at: string
          description: string | null
          event_id: string | null
          id: string
          overtime: number | null
          sent_at: string | null
          status: Database["public"]["Enums"]["invoice_status"]
          stripe_payment_id: string | null
          stripe_payment_url: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          amount?: number
          client_id?: string | null
          created_at?: string
          description?: string | null
          event_id?: string | null
          id?: string
          overtime?: number | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          stripe_payment_id?: string | null
          stripe_payment_url?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          amount?: number
          client_id?: string | null
          created_at?: string
          description?: string | null
          event_id?: string | null
          id?: string
          overtime?: number | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          stripe_payment_id?: string | null
          stripe_payment_url?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          link: string | null
          message: string | null
          read: boolean
          tenant_id: string
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          link?: string | null
          message?: string | null
          read?: boolean
          tenant_id: string
          title: string
          type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          link?: string | null
          message?: string | null
          read?: boolean
          tenant_id?: string
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          has_used_trial: boolean
          id: string
          language: string
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          has_used_trial?: boolean
          id?: string
          language?: string
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          has_used_trial?: boolean
          id?: string
          language?: string
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      support_tickets: {
        Row: {
          created_at: string
          description: string | null
          id: string
          priority: Database["public"]["Enums"]["ticket_priority"]
          status: Database["public"]["Enums"]["ticket_status"]
          subject: string
          tenant_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          priority?: Database["public"]["Enums"]["ticket_priority"]
          status?: Database["public"]["Enums"]["ticket_status"]
          subject: string
          tenant_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          priority?: Database["public"]["Enums"]["ticket_priority"]
          status?: Database["public"]["Enums"]["ticket_status"]
          subject?: string
          tenant_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_tickets_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_landing_pages: {
        Row: {
          about: string | null
          created_at: string
          hero_image_url: string | null
          id: string
          logo_url: string | null
          services_description: string | null
          tagline: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          about?: string | null
          created_at?: string
          hero_image_url?: string | null
          id?: string
          logo_url?: string | null
          services_description?: string | null
          tagline?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          about?: string | null
          created_at?: string
          hero_image_url?: string | null
          id?: string
          logo_url?: string | null
          services_description?: string | null
          tagline?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_landing_pages_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_members: {
        Row: {
          accepted_at: string | null
          created_at: string
          id: string
          invitation_email: string | null
          invitation_status: Database["public"]["Enums"]["tenant_invitation_status"]
          invited_at: string
          invited_by: string | null
          role: Database["public"]["Enums"]["tenant_role"]
          tenant_id: string
          user_id: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          id?: string
          invitation_email?: string | null
          invitation_status?: Database["public"]["Enums"]["tenant_invitation_status"]
          invited_at?: string
          invited_by?: string | null
          role?: Database["public"]["Enums"]["tenant_role"]
          tenant_id: string
          user_id: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          id?: string
          invitation_email?: string | null
          invitation_status?: Database["public"]["Enums"]["tenant_invitation_status"]
          invited_at?: string
          invited_by?: string | null
          role?: Database["public"]["Enums"]["tenant_role"]
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_members_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_packages: {
        Row: {
          created_at: string
          description: string | null
          features: string[] | null
          id: string
          is_popular: boolean
          name: string
          price: string | null
          sort_order: number
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          features?: string[] | null
          id?: string
          is_popular?: boolean
          name: string
          price?: string | null
          sort_order?: number
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          features?: string[] | null
          id?: string
          is_popular?: boolean
          name?: string
          price?: string | null
          sort_order?: number
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_packages_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          calendar_token: string | null
          created_at: string
          custom_price_cents: number | null
          id: string
          is_manual_override: boolean
          is_primary_workspace: boolean
          last_synced_at: string | null
          name: string
          notes: string | null
          payment_instructions: string | null
          plan: string
          slug: string
          stripe_connect_account_id: string | null
          stripe_connect_onboarded: boolean | null
          stripe_current_period_end: string | null
          stripe_customer_id: string | null
          stripe_mrr_cents: number | null
          stripe_plan_price_id: string | null
          stripe_subscription_id: string | null
          stripe_subscription_status: string | null
          trial_ends_at: string
          updated_at: string
        }
        Insert: {
          calendar_token?: string | null
          created_at?: string
          custom_price_cents?: number | null
          id?: string
          is_manual_override?: boolean
          is_primary_workspace?: boolean
          last_synced_at?: string | null
          name: string
          notes?: string | null
          payment_instructions?: string | null
          plan?: string
          slug: string
          stripe_connect_account_id?: string | null
          stripe_connect_onboarded?: boolean | null
          stripe_current_period_end?: string | null
          stripe_customer_id?: string | null
          stripe_mrr_cents?: number | null
          stripe_plan_price_id?: string | null
          stripe_subscription_id?: string | null
          stripe_subscription_status?: string | null
          trial_ends_at?: string
          updated_at?: string
        }
        Update: {
          calendar_token?: string | null
          created_at?: string
          custom_price_cents?: number | null
          id?: string
          is_manual_override?: boolean
          is_primary_workspace?: boolean
          last_synced_at?: string | null
          name?: string
          notes?: string | null
          payment_instructions?: string | null
          plan?: string
          slug?: string
          stripe_connect_account_id?: string | null
          stripe_connect_onboarded?: boolean | null
          stripe_current_period_end?: string | null
          stripe_customer_id?: string | null
          stripe_mrr_cents?: number | null
          stripe_plan_price_id?: string | null
          stripe_subscription_id?: string | null
          stripe_subscription_status?: string | null
          trial_ends_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      ticket_replies: {
        Row: {
          created_at: string
          id: string
          is_admin: boolean
          message: string
          ticket_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_admin?: boolean
          message: string
          ticket_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_admin?: boolean
          message?: string
          ticket_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_replies_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      workspace_expenses: {
        Row: {
          amount: number
          category: string
          created_at: string
          expense_date: string
          id: string
          notes: string | null
          tenant_id: string
          title: string
          updated_at: string
        }
        Insert: {
          amount?: number
          category?: string
          created_at?: string
          expense_date?: string
          id?: string
          notes?: string | null
          tenant_id: string
          title: string
          updated_at?: string
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          expense_date?: string
          id?: string
          notes?: string | null
          tenant_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_expenses_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_subscriptions: {
        Row: {
          created_at: string
          current_period_end: string | null
          features_locked: boolean
          id: string
          is_manual_override: boolean
          plan_id: string | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          subscription_status: string
          updated_at: string
          user_id: string | null
          workspace_id: string
          workspace_limits: Json
        }
        Insert: {
          created_at?: string
          current_period_end?: string | null
          features_locked?: boolean
          id?: string
          is_manual_override?: boolean
          plan_id?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_status?: string
          updated_at?: string
          user_id?: string | null
          workspace_id: string
          workspace_limits?: Json
        }
        Update: {
          created_at?: string
          current_period_end?: string | null
          features_locked?: boolean
          id?: string
          is_manual_override?: boolean
          plan_id?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_status?: string
          updated_at?: string
          user_id?: string | null
          workspace_id?: string
          workspace_limits?: Json
        }
        Relationships: [
          {
            foreignKeyName: "workspace_subscriptions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_create_workspace: { Args: { _user_id: string }; Returns: boolean }
      can_view_event: {
        Args: { _event_id: string; _tenant_id: string; _user_id: string }
        Returns: boolean
      }
      compute_workspace_limits: { Args: { _plan_id: string }; Returns: Json }
      get_tenant_by_slug: {
        Args: { _slug: string }
        Returns: {
          id: string
          name: string
          slug: string
        }[]
      }
      get_tenant_member_role: {
        Args: { _tenant_id: string; _user_id: string }
        Returns: string
      }
      get_user_tenant_id: { Args: { _user_id: string }; Returns: string }
      get_user_tenants: {
        Args: { _user_id: string }
        Returns: {
          role: string
          tenant_id: string
          tenant_name: string
          tenant_slug: string
        }[]
      }
      get_user_workspace_count: { Args: { _user_id: string }; Returns: number }
      get_workspace_subscription: {
        Args: { _workspace_id: string }
        Returns: {
          current_period_end: string
          plan_id: string
          stripe_customer_id: string
          stripe_subscription_id: string
          subscription_status: string
          user_id: string
          workspace_id: string
          workspace_limits: Json
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_internal_tenant_member: {
        Args: { _tenant_id: string; _user_id: string }
        Returns: boolean
      }
      is_tenant_member: {
        Args: { _tenant_id: string; _user_id: string }
        Returns: boolean
      }
      workspace_subscription_is_active: {
        Args: { _workspace_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "support_agent" | "billing_admin"
      invoice_status: "draft" | "sent" | "paid" | "overdue"
      payment_status: "paid" | "partial" | "unpaid"
      tenant_invitation_status: "invited" | "accepted"
      tenant_role:
        | "owner"
        | "booking_manager"
        | "social_media_manager"
        | "member"
      ticket_priority: "low" | "medium" | "high" | "urgent"
      ticket_status: "open" | "in_progress" | "resolved" | "closed"
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
    Enums: {
      app_role: ["admin", "support_agent", "billing_admin"],
      invoice_status: ["draft", "sent", "paid", "overdue"],
      payment_status: ["paid", "partial", "unpaid"],
      tenant_invitation_status: ["invited", "accepted"],
      tenant_role: [
        "owner",
        "booking_manager",
        "social_media_manager",
        "member",
      ],
      ticket_priority: ["low", "medium", "high", "urgent"],
      ticket_status: ["open", "in_progress", "resolved", "closed"],
    },
  },
} as const
