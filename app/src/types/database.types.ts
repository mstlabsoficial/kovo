// Generated from the live KOVO Supabase schema.
// Source project: otlwmrbioawjvgrrznoq
// Generated: 2026-11-08
// Do not edit manually; regenerate after schema changes.

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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      appointments: {
        Row: {
          administrative_note: string | null
          created_at: string
          created_by: string | null
          ends_at: string
          id: string
          legacy_id: string | null
          location: string | null
          modality: string | null
          org_id: string
          patient_id: string
          price_cents: number
          professional_id: string | null
          service_id: string | null
          starts_at: string
          status: string
          updated_at: string
        }
        Insert: {
          administrative_note?: string | null
          created_at?: string
          created_by?: string | null
          ends_at: string
          id?: string
          legacy_id?: string | null
          location?: string | null
          modality?: string | null
          org_id: string
          patient_id: string
          price_cents?: number
          professional_id?: string | null
          service_id?: string | null
          starts_at: string
          status?: string
          updated_at?: string
        }
        Update: {
          administrative_note?: string | null
          created_at?: string
          created_by?: string | null
          ends_at?: string
          id?: string
          legacy_id?: string | null
          location?: string | null
          modality?: string | null
          org_id?: string
          patient_id?: string
          price_cents?: number
          professional_id?: string | null
          service_id?: string | null
          starts_at?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_org_id_patient_id_fkey"
            columns: ["org_id", "patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["org_id", "id"]
          },
          {
            foreignKeyName: "appointments_org_id_professional_id_fkey"
            columns: ["org_id", "professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["org_id", "id"]
          },
          {
            foreignKeyName: "appointments_org_id_service_id_fkey"
            columns: ["org_id", "service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["org_id", "id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: number
          metadata: Json
          org_id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: never
          metadata?: Json
          org_id: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: never
          metadata?: Json
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      clinical_note_rectifications: {
        Row: {
          author_id: string
          created_at: string
          id: string
          note_id: string
          org_id: string
          reason: string
          replacement_text: string
        }
        Insert: {
          author_id: string
          created_at?: string
          id?: string
          note_id: string
          org_id: string
          reason: string
          replacement_text: string
        }
        Update: {
          author_id?: string
          created_at?: string
          id?: string
          note_id?: string
          org_id?: string
          reason?: string
          replacement_text?: string
        }
        Relationships: [
          {
            foreignKeyName: "clinical_note_rectifications_note_id_fkey"
            columns: ["note_id"]
            isOneToOne: false
            referencedRelation: "clinical_notes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clinical_note_rectifications_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rectifications_note_org_fk"
            columns: ["org_id", "note_id"]
            isOneToOne: false
            referencedRelation: "clinical_notes"
            referencedColumns: ["org_id", "id"]
          },
        ]
      }
      clinical_notes: {
        Row: {
          appointment_id: string | null
          author_id: string | null
          content: string
          created_at: string
          id: string
          note_type: string
          org_id: string
          patient_id: string
          signed_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          appointment_id?: string | null
          author_id?: string | null
          content: string
          created_at?: string
          id?: string
          note_type?: string
          org_id: string
          patient_id: string
          signed_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          appointment_id?: string | null
          author_id?: string | null
          content?: string
          created_at?: string
          id?: string
          note_type?: string
          org_id?: string
          patient_id?: string
          signed_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clinical_notes_org_id_appointment_id_fkey"
            columns: ["org_id", "appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["org_id", "id"]
          },
          {
            foreignKeyName: "clinical_notes_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clinical_notes_org_id_patient_id_fkey"
            columns: ["org_id", "patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["org_id", "id"]
          },
        ]
      }
      employees: {
        Row: {
          active: boolean
          created_at: string
          email: string | null
          full_name: string
          id: string
          org_id: string
          role_title: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          email?: string | null
          full_name: string
          id?: string
          org_id: string
          role_title?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          org_id?: string
          role_title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employees_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount_cents: number
          category: string | null
          created_at: string
          description: string
          document_path: string | null
          expense_date: string
          id: string
          legacy_id: string | null
          org_id: string
          supplier: string | null
        }
        Insert: {
          amount_cents: number
          category?: string | null
          created_at?: string
          description: string
          document_path?: string | null
          expense_date?: string
          id?: string
          legacy_id?: string | null
          org_id: string
          supplier?: string | null
        }
        Update: {
          amount_cents?: number
          category?: string | null
          created_at?: string
          description?: string
          document_path?: string | null
          expense_date?: string
          id?: string
          legacy_id?: string | null
          org_id?: string
          supplier?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expenses_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_lines: {
        Row: {
          description: string
          id: string
          invoice_id: string
          line_total_cents: number
          org_id: string
          quantity: number
          tax_rate: number
          unit_price_cents: number
        }
        Insert: {
          description: string
          id?: string
          invoice_id: string
          line_total_cents: number
          org_id: string
          quantity?: number
          tax_rate?: number
          unit_price_cents: number
        }
        Update: {
          description?: string
          id?: string
          invoice_id?: string
          line_total_cents?: number
          org_id?: string
          quantity?: number
          tax_rate?: number
          unit_price_cents?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_lines_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_lines_org_id_invoice_id_fkey"
            columns: ["org_id", "invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["org_id", "id"]
          },
        ]
      }
      invoices: {
        Row: {
          created_at: string
          currency: string
          due_date: string | null
          id: string
          invoice_number: string | null
          issue_date: string
          legacy_id: string | null
          legacy_status: string | null
          notes: string | null
          org_id: string
          patient_id: string | null
          retention_cents: number
          series: string | null
          status: string
          subtotal_cents: number
          tax_cents: number
          total_cents: number
        }
        Insert: {
          created_at?: string
          currency?: string
          due_date?: string | null
          id?: string
          invoice_number?: string | null
          issue_date?: string
          legacy_id?: string | null
          legacy_status?: string | null
          notes?: string | null
          org_id: string
          patient_id?: string | null
          retention_cents?: number
          series?: string | null
          status?: string
          subtotal_cents?: number
          tax_cents?: number
          total_cents?: number
        }
        Update: {
          created_at?: string
          currency?: string
          due_date?: string | null
          id?: string
          invoice_number?: string | null
          issue_date?: string
          legacy_id?: string | null
          legacy_status?: string | null
          notes?: string | null
          org_id?: string
          patient_id?: string | null
          retention_cents?: number
          series?: string | null
          status?: string
          subtotal_cents?: number
          tax_cents?: number
          total_cents?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoices_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_org_id_patient_id_fkey"
            columns: ["org_id", "patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["org_id", "id"]
          },
        ]
      }
      memberships: {
        Row: {
          active: boolean
          created_at: string
          id: string
          org_id: string
          role: string
          user_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          org_id: string
          role: string
          user_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          org_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "memberships_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          id: string
          is_demo: boolean
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_demo?: boolean
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          is_demo?: boolean
          name?: string
        }
        Relationships: []
      }
      patient_documents: {
        Row: {
          created_at: string
          document_type: string
          file_name: string
          id: string
          org_id: string
          patient_id: string
          storage_path: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          document_type: string
          file_name: string
          id?: string
          org_id: string
          patient_id: string
          storage_path: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          document_type?: string
          file_name?: string
          id?: string
          org_id?: string
          patient_id?: string
          storage_path?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "patient_documents_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_documents_org_id_patient_id_fkey"
            columns: ["org_id", "patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["org_id", "id"]
          },
        ]
      }
      patients: {
        Row: {
          address: string | null
          administrative_notes: string | null
          birth_date: string | null
          created_at: string
          email: string | null
          emergency_contact: string | null
          first_name: string
          id: string
          last_name: string
          legacy_id: string | null
          org_id: string
          patient_code: string
          phone: string | null
          profile_data: Json
          status: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          administrative_notes?: string | null
          birth_date?: string | null
          created_at?: string
          email?: string | null
          emergency_contact?: string | null
          first_name: string
          id?: string
          last_name: string
          legacy_id?: string | null
          org_id: string
          patient_code: string
          phone?: string | null
          profile_data?: Json
          status?: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          administrative_notes?: string | null
          birth_date?: string | null
          created_at?: string
          email?: string | null
          emergency_contact?: string | null
          first_name?: string
          id?: string
          last_name?: string
          legacy_id?: string | null
          org_id?: string
          patient_code?: string
          phone?: string | null
          profile_data?: Json
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "patients_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount_cents: number
          created_at: string
          id: string
          invoice_id: string
          method: string | null
          org_id: string
          paid_at: string
          reference: string | null
        }
        Insert: {
          amount_cents: number
          created_at?: string
          id?: string
          invoice_id: string
          method?: string | null
          org_id: string
          paid_at?: string
          reference?: string | null
        }
        Update: {
          amount_cents?: number
          created_at?: string
          id?: string
          invoice_id?: string
          method?: string | null
          org_id?: string
          paid_at?: string
          reference?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_org_id_invoice_id_fkey"
            columns: ["org_id", "invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["org_id", "id"]
          },
        ]
      }
      professionals: {
        Row: {
          created_at: string
          display_name: string
          email: string | null
          id: string
          org_id: string
          phone: string | null
          professional_number: string | null
        }
        Insert: {
          created_at?: string
          display_name: string
          email?: string | null
          id?: string
          org_id: string
          phone?: string | null
          professional_number?: string | null
        }
        Update: {
          created_at?: string
          display_name?: string
          email?: string | null
          id?: string
          org_id?: string
          phone?: string | null
          professional_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "professionals_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          active: boolean
          created_at: string
          duration_minutes: number
          id: string
          legacy_id: string | null
          name: string
          org_id: string
          price_cents: number
          tax_exempt: boolean
        }
        Insert: {
          active?: boolean
          created_at?: string
          duration_minutes: number
          id?: string
          legacy_id?: string | null
          name: string
          org_id: string
          price_cents?: number
          tax_exempt?: boolean
        }
        Update: {
          active?: boolean
          created_at?: string
          duration_minutes?: number
          id?: string
          legacy_id?: string | null
          name?: string
          org_id?: string
          price_cents?: number
          tax_exempt?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "services_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      delete_clinical_note_draft: {
        Args: { p_note_id: string; p_org_id: string }
        Returns: undefined
      }
      emit_invoice: {
        Args: { p_invoice: string }
        Returns: {
          created_at: string
          currency: string
          due_date: string | null
          id: string
          invoice_number: string | null
          issue_date: string
          legacy_id: string | null
          legacy_status: string | null
          notes: string | null
          org_id: string
          patient_id: string | null
          retention_cents: number
          series: string | null
          status: string
          subtotal_cents: number
          tax_cents: number
          total_cents: number
        }
        SetofOptions: {
          from: "*"
          to: "invoices"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      rectify_clinical_note: {
        Args: { p_note: string; p_reason: string; p_replacement: string }
        Returns: string
      }
      save_clinical_note_draft: {
        Args: {
          p_appointment_id: string
          p_content: string
          p_note_id?: string
          p_note_type: string
          p_org_id: string
          p_patient_id: string
        }
        Returns: string
      }
      save_invoice_draft: {
        Args: {
          p_due_date: string
          p_issue_date: string
          p_legacy_id?: string
          p_lines: Json
          p_org_id: string
          p_patient_id: string
          p_retention_cents?: number
        }
        Returns: string
      }
      sign_clinical_note: {
        Args: { p_note: string }
        Returns: {
          appointment_id: string | null
          author_id: string | null
          content: string
          created_at: string
          id: string
          note_type: string
          org_id: string
          patient_id: string
          signed_at: string | null
          status: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "clinical_notes"
          isOneToOne: true
          isSetofReturn: false
        }
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
