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
      activity_logs: {
        Row: {
          company_id: string
          created_at: string
          description: string
          id: string
          user_id: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          description: string
          id?: string
          user_id?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          description?: string
          id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_conversations: {
        Row: {
          company_id: string
          created_at: string
          deleted_at: string | null
          id: string
          status: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          status?: string
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_conversations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_messages: {
        Row: {
          company_id: string
          content: string
          conversation_id: string
          created_at: string
          id: string
          role: string
          user_id: string
        }
        Insert: {
          company_id: string
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          role: string
          user_id: string
        }
        Update: {
          company_id?: string
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_messages_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "ai_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_parser_corrections: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          hits: number
          id: string
          last_used_at: string
          source_code: string | null
          source_text: string
          source_type: string
          target_id: string | null
          target_label: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          hits?: number
          id?: string
          last_used_at?: string
          source_code?: string | null
          source_text: string
          source_type: string
          target_id?: string | null
          target_label?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          hits?: number
          id?: string
          last_used_at?: string
          source_code?: string | null
          source_text?: string
          source_type?: string
          target_id?: string | null
          target_label?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_parser_corrections_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      attachments: {
        Row: {
          company_id: string
          created_at: string
          file_name: string
          file_size: number | null
          file_url: string
          id: string
          module: string
          record_id: string
          uploaded_by: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          file_name: string
          file_size?: number | null
          file_url: string
          id?: string
          module: string
          record_id: string
          uploaded_by?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          file_name?: string
          file_size?: number | null
          file_url?: string
          id?: string
          module?: string
          record_id?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attachments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          company_id: string | null
          created_at: string
          id: string
          ip_address: string | null
          module: string
          new_data: Json | null
          old_data: Json | null
          record_id: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          company_id?: string | null
          created_at?: string
          id?: string
          ip_address?: string | null
          module: string
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          company_id?: string | null
          created_at?: string
          id?: string
          ip_address?: string | null
          module?: string
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_reconciliations: {
        Row: {
          bank_transaction_id: string
          company_id: string
          confidence_score: number | null
          confirmed_at: string | null
          confirmed_by: string | null
          created_at: string
          financial_transaction_id: string | null
          id: string
          matched_by: string
          source: string
          status: string
          updated_at: string
        }
        Insert: {
          bank_transaction_id: string
          company_id: string
          confidence_score?: number | null
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          financial_transaction_id?: string | null
          id?: string
          matched_by?: string
          source?: string
          status?: string
          updated_at?: string
        }
        Update: {
          bank_transaction_id?: string
          company_id?: string
          confidence_score?: number | null
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          financial_transaction_id?: string | null
          id?: string
          matched_by?: string
          source?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bank_reconciliations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_reconciliations_financial_transaction_id_fkey"
            columns: ["financial_transaction_id"]
            isOneToOne: false
            referencedRelation: "financial_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_statement_imports: {
        Row: {
          bank_account_id: string | null
          company_id: string
          created_at: string
          duplicate_rows: number
          error_message: string | null
          error_rows: number
          file_name: string
          file_size: number
          file_type: string
          id: string
          imported_by: string | null
          imported_rows: number
          status: string
          total_rows: number
          updated_at: string
        }
        Insert: {
          bank_account_id?: string | null
          company_id: string
          created_at?: string
          duplicate_rows?: number
          error_message?: string | null
          error_rows?: number
          file_name: string
          file_size?: number
          file_type: string
          id?: string
          imported_by?: string | null
          imported_rows?: number
          status?: string
          total_rows?: number
          updated_at?: string
        }
        Update: {
          bank_account_id?: string | null
          company_id?: string
          created_at?: string
          duplicate_rows?: number
          error_message?: string | null
          error_rows?: number
          file_name?: string
          file_size?: number
          file_type?: string
          id?: string
          imported_by?: string | null
          imported_rows?: number
          status?: string
          total_rows?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bank_statement_imports_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "financial_bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_statement_imports_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_statement_transactions: {
        Row: {
          amount: number
          bank_account_id: string | null
          category_suggestion: string | null
          company_id: string
          created_at: string
          description: string
          document_number: string | null
          external_id: string | null
          id: string
          ignored_reason: string | null
          import_id: string
          raw_payload: Json | null
          reconciled_financial_transaction_id: string | null
          reconciliation_status: string
          transaction_date: string
          transaction_hash: string
          type: string
          updated_at: string
        }
        Insert: {
          amount: number
          bank_account_id?: string | null
          category_suggestion?: string | null
          company_id: string
          created_at?: string
          description?: string
          document_number?: string | null
          external_id?: string | null
          id?: string
          ignored_reason?: string | null
          import_id: string
          raw_payload?: Json | null
          reconciled_financial_transaction_id?: string | null
          reconciliation_status?: string
          transaction_date: string
          transaction_hash: string
          type: string
          updated_at?: string
        }
        Update: {
          amount?: number
          bank_account_id?: string | null
          category_suggestion?: string | null
          company_id?: string
          created_at?: string
          description?: string
          document_number?: string | null
          external_id?: string | null
          id?: string
          ignored_reason?: string | null
          import_id?: string
          raw_payload?: Json | null
          reconciled_financial_transaction_id?: string | null
          reconciliation_status?: string
          transaction_date?: string
          transaction_hash?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bank_statement_transactions_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "financial_bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_statement_transactions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_statement_transactions_import_id_fkey"
            columns: ["import_id"]
            isOneToOne: false
            referencedRelation: "bank_statement_imports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_statement_transactions_reconciled_financial_transacti_fkey"
            columns: ["reconciled_financial_transaction_id"]
            isOneToOne: false
            referencedRelation: "financial_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_charges: {
        Row: {
          amount: number
          bank_slip_url: string | null
          billing_cycle: string
          checkout_url: string | null
          company_id: string
          coupon_code: string | null
          coupon_id: string | null
          created_at: string
          discount_amount: number | null
          due_date: string | null
          final_amount: number | null
          id: string
          invoice_url: string | null
          original_amount: number | null
          paid_at: string | null
          payment_method: string | null
          pix_copy_paste: string | null
          pix_qr_code: string | null
          plan_id: string | null
          provider: string
          provider_charge_id: string | null
          provider_subscription_id: string | null
          raw_payload: Json | null
          status: string
          subscription_id: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          bank_slip_url?: string | null
          billing_cycle: string
          checkout_url?: string | null
          company_id: string
          coupon_code?: string | null
          coupon_id?: string | null
          created_at?: string
          discount_amount?: number | null
          due_date?: string | null
          final_amount?: number | null
          id?: string
          invoice_url?: string | null
          original_amount?: number | null
          paid_at?: string | null
          payment_method?: string | null
          pix_copy_paste?: string | null
          pix_qr_code?: string | null
          plan_id?: string | null
          provider: string
          provider_charge_id?: string | null
          provider_subscription_id?: string | null
          raw_payload?: Json | null
          status?: string
          subscription_id?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          bank_slip_url?: string | null
          billing_cycle?: string
          checkout_url?: string | null
          company_id?: string
          coupon_code?: string | null
          coupon_id?: string | null
          created_at?: string
          discount_amount?: number | null
          due_date?: string | null
          final_amount?: number | null
          id?: string
          invoice_url?: string | null
          original_amount?: number | null
          paid_at?: string | null
          payment_method?: string | null
          pix_copy_paste?: string | null
          pix_qr_code?: string | null
          plan_id?: string | null
          provider?: string
          provider_charge_id?: string | null
          provider_subscription_id?: string | null
          raw_payload?: Json | null
          status?: string
          subscription_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "billing_charges_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_charges_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "billing_coupons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_charges_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_charges_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_checkout_sessions: {
        Row: {
          amount: number
          billing_cycle: string
          checkout_url: string | null
          company_id: string
          coupon_code: string | null
          coupon_id: string | null
          created_at: string
          created_by: string | null
          discount_amount: number | null
          expires_at: string | null
          final_amount: number | null
          id: string
          original_amount: number | null
          payment_method: string | null
          plan_id: string
          provider: string
          provider_checkout_id: string | null
          status: string
          subscription_id: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          billing_cycle: string
          checkout_url?: string | null
          company_id: string
          coupon_code?: string | null
          coupon_id?: string | null
          created_at?: string
          created_by?: string | null
          discount_amount?: number | null
          expires_at?: string | null
          final_amount?: number | null
          id?: string
          original_amount?: number | null
          payment_method?: string | null
          plan_id: string
          provider: string
          provider_checkout_id?: string | null
          status?: string
          subscription_id?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          billing_cycle?: string
          checkout_url?: string | null
          company_id?: string
          coupon_code?: string | null
          coupon_id?: string | null
          created_at?: string
          created_by?: string | null
          discount_amount?: number | null
          expires_at?: string | null
          final_amount?: number | null
          id?: string
          original_amount?: number | null
          payment_method?: string | null
          plan_id?: string
          provider?: string
          provider_checkout_id?: string | null
          status?: string
          subscription_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "billing_checkout_sessions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_checkout_sessions_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "billing_coupons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_checkout_sessions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_checkout_sessions_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_coupon_redemptions: {
        Row: {
          charge_id: string | null
          checkout_session_id: string | null
          company_id: string
          coupon_id: string
          created_at: string
          discount_amount: number
          final_amount: number
          id: string
          original_amount: number
          subscription_id: string | null
        }
        Insert: {
          charge_id?: string | null
          checkout_session_id?: string | null
          company_id: string
          coupon_id: string
          created_at?: string
          discount_amount: number
          final_amount: number
          id?: string
          original_amount: number
          subscription_id?: string | null
        }
        Update: {
          charge_id?: string | null
          checkout_session_id?: string | null
          company_id?: string
          coupon_id?: string
          created_at?: string
          discount_amount?: number
          final_amount?: number
          id?: string
          original_amount?: number
          subscription_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "billing_coupon_redemptions_charge_id_fkey"
            columns: ["charge_id"]
            isOneToOne: false
            referencedRelation: "billing_charges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_coupon_redemptions_checkout_session_id_fkey"
            columns: ["checkout_session_id"]
            isOneToOne: false
            referencedRelation: "billing_checkout_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_coupon_redemptions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_coupon_redemptions_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "billing_coupons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_coupon_redemptions_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_coupons: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          description: string | null
          discount_type: string
          discount_value: number
          duration: string
          duration_months: number | null
          eligible_plan_ids: string[] | null
          id: string
          is_active: boolean
          max_redemptions: number | null
          max_redemptions_per_company: number | null
          redemption_count: number
          updated_at: string
          valid_from: string | null
          valid_until: string | null
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          discount_type: string
          discount_value: number
          duration: string
          duration_months?: number | null
          eligible_plan_ids?: string[] | null
          id?: string
          is_active?: boolean
          max_redemptions?: number | null
          max_redemptions_per_company?: number | null
          redemption_count?: number
          updated_at?: string
          valid_from?: string | null
          valid_until?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          discount_type?: string
          discount_value?: number
          duration?: string
          duration_months?: number | null
          eligible_plan_ids?: string[] | null
          id?: string
          is_active?: boolean
          max_redemptions?: number | null
          max_redemptions_per_company?: number | null
          redemption_count?: number
          updated_at?: string
          valid_from?: string | null
          valid_until?: string | null
        }
        Relationships: []
      }
      billing_customers: {
        Row: {
          company_id: string
          cpf_cnpj: string | null
          created_at: string
          email: string | null
          id: string
          mobile_phone: string | null
          name: string | null
          phone: string | null
          provider: string
          provider_customer_id: string | null
          updated_at: string
        }
        Insert: {
          company_id: string
          cpf_cnpj?: string | null
          created_at?: string
          email?: string | null
          id?: string
          mobile_phone?: string | null
          name?: string | null
          phone?: string | null
          provider: string
          provider_customer_id?: string | null
          updated_at?: string
        }
        Update: {
          company_id?: string
          cpf_cnpj?: string | null
          created_at?: string
          email?: string | null
          id?: string
          mobile_phone?: string | null
          name?: string | null
          phone?: string | null
          provider?: string
          provider_customer_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "billing_customers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_dunning_events: {
        Row: {
          billing_charge_id: string | null
          channel: string | null
          company_id: string
          created_at: string
          due_date: string | null
          event_code: string
          executed_at: string | null
          handled_at: string | null
          handled_by: string | null
          id: string
          message: string | null
          notes: string | null
          rule_id: string | null
          scheduled_for: string | null
          status: string
          subscription_id: string
          updated_at: string
        }
        Insert: {
          billing_charge_id?: string | null
          channel?: string | null
          company_id: string
          created_at?: string
          due_date?: string | null
          event_code: string
          executed_at?: string | null
          handled_at?: string | null
          handled_by?: string | null
          id?: string
          message?: string | null
          notes?: string | null
          rule_id?: string | null
          scheduled_for?: string | null
          status?: string
          subscription_id: string
          updated_at?: string
        }
        Update: {
          billing_charge_id?: string | null
          channel?: string | null
          company_id?: string
          created_at?: string
          due_date?: string | null
          event_code?: string
          executed_at?: string | null
          handled_at?: string | null
          handled_by?: string | null
          id?: string
          message?: string | null
          notes?: string | null
          rule_id?: string | null
          scheduled_for?: string | null
          status?: string
          subscription_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "billing_dunning_events_billing_charge_id_fkey"
            columns: ["billing_charge_id"]
            isOneToOne: false
            referencedRelation: "billing_charges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_dunning_events_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_dunning_events_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "billing_dunning_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_dunning_events_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_dunning_rules: {
        Row: {
          active: boolean
          code: string
          created_at: string
          description: string | null
          id: string
          name: string
          sort_order: number
          subscription_status: string | null
          trigger_offset_days: number
          trigger_type: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
          sort_order?: number
          subscription_status?: string | null
          trigger_offset_days?: number
          trigger_type: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          sort_order?: number
          subscription_status?: string | null
          trigger_offset_days?: number
          trigger_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      billing_provider_settings: {
        Row: {
          active: boolean
          created_at: string
          environment: string
          id: string
          privacy_policy_url: string | null
          provider: string
          public_config: Json | null
          support_email: string | null
          support_whatsapp: string | null
          terms_of_use_url: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          environment: string
          id?: string
          privacy_policy_url?: string | null
          provider: string
          public_config?: Json | null
          support_email?: string | null
          support_whatsapp?: string | null
          terms_of_use_url?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          environment?: string
          id?: string
          privacy_policy_url?: string | null
          provider?: string
          public_config?: Json | null
          support_email?: string | null
          support_whatsapp?: string | null
          terms_of_use_url?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      billing_webhook_events: {
        Row: {
          created_at: string
          error_message: string | null
          event_id: string | null
          event_type: string
          id: string
          payload: Json
          payload_hash: string | null
          processed_at: string | null
          provider: string
          provider_object_id: string | null
          status: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          event_id?: string | null
          event_type: string
          id?: string
          payload: Json
          payload_hash?: string | null
          processed_at?: string | null
          provider: string
          provider_object_id?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          event_id?: string | null
          event_type?: string
          id?: string
          payload?: Json
          payload_hash?: string | null
          processed_at?: string | null
          provider?: string
          provider_object_id?: string | null
          status?: string
        }
        Relationships: []
      }
      brands: {
        Row: {
          active: boolean
          company_id: string
          created_at: string
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          company_id: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          company_id?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "brands_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          active: boolean
          category_type: Database["public"]["Enums"]["category_type"]
          company_id: string
          created_at: string
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          category_type?: Database["public"]["Enums"]["category_type"]
          company_id: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          category_type?: Database["public"]["Enums"]["category_type"]
          company_id?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      cnpj_lookup_cache: {
        Row: {
          cnpj: string
          created_at: string
          expires_at: string | null
          fetched_at: string
          id: string
          normalized_data: Json
          provider: string
          raw_payload: Json | null
          updated_at: string
        }
        Insert: {
          cnpj: string
          created_at?: string
          expires_at?: string | null
          fetched_at?: string
          id?: string
          normalized_data: Json
          provider: string
          raw_payload?: Json | null
          updated_at?: string
        }
        Update: {
          cnpj?: string
          created_at?: string
          expires_at?: string | null
          fetched_at?: string
          id?: string
          normalized_data?: Json
          provider?: string
          raw_payload?: Json | null
          updated_at?: string
        }
        Relationships: []
      }
      cnpj_lookup_logs: {
        Row: {
          cnpj: string
          company_id: string | null
          created_at: string
          error_message: string | null
          id: string
          provider: string
          requested_by: string | null
          result_summary: Json | null
          status: string
        }
        Insert: {
          cnpj: string
          company_id?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          provider: string
          requested_by?: string | null
          result_summary?: Json | null
          status: string
        }
        Update: {
          cnpj?: string
          company_id?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          provider?: string
          requested_by?: string | null
          result_summary?: Json | null
          status?: string
        }
        Relationships: []
      }
      commercial_contact_logs: {
        Row: {
          company_id: string
          contact_channel: string
          contact_type: string
          contacted_at: string
          contacted_by: string | null
          created_at: string
          id: string
          message: string | null
          next_follow_up_at: string | null
          result: string | null
          subject: string | null
          subscription_id: string | null
          updated_at: string
        }
        Insert: {
          company_id: string
          contact_channel: string
          contact_type: string
          contacted_at?: string
          contacted_by?: string | null
          created_at?: string
          id?: string
          message?: string | null
          next_follow_up_at?: string | null
          result?: string | null
          subject?: string | null
          subscription_id?: string | null
          updated_at?: string
        }
        Update: {
          company_id?: string
          contact_channel?: string
          contact_type?: string
          contacted_at?: string
          contacted_by?: string | null
          created_at?: string
          id?: string
          message?: string | null
          next_follow_up_at?: string | null
          result?: string | null
          subject?: string | null
          subscription_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "commercial_contact_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commercial_contact_logs_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      commercial_launch_checklist: {
        Row: {
          completed: boolean
          completed_at: string | null
          completed_by: string | null
          created_at: string
          description: string | null
          id: string
          key: string
          sort_order: number
          title: string
          updated_at: string
        }
        Insert: {
          completed?: boolean
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          description?: string | null
          id?: string
          key: string
          sort_order?: number
          title: string
          updated_at?: string
        }
        Update: {
          completed?: boolean
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          description?: string | null
          id?: string
          key?: string
          sort_order?: number
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      commercial_pilots: {
        Row: {
          company_id: string
          converted_at: string | null
          created_at: string
          expected_conversion_date: string | null
          id: string
          loss_reason: string | null
          lost_at: string | null
          notes: string | null
          onboarding_status: string
          responsible_admin_id: string | null
          source: string | null
          status: string
          updated_at: string
        }
        Insert: {
          company_id: string
          converted_at?: string | null
          created_at?: string
          expected_conversion_date?: string | null
          id?: string
          loss_reason?: string | null
          lost_at?: string | null
          notes?: string | null
          onboarding_status?: string
          responsible_admin_id?: string | null
          source?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          converted_at?: string | null
          created_at?: string
          expected_conversion_date?: string | null
          id?: string
          loss_reason?: string | null
          lost_at?: string | null
          notes?: string | null
          onboarding_status?: string
          responsible_admin_id?: string | null
          source?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "commercial_pilots_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          city: string | null
          cnpj: string | null
          complement: string | null
          corporate_name: string
          country: string
          created_at: string
          district: string | null
          email: string | null
          id: string
          logo_url: string | null
          number: string | null
          phone: string | null
          plan_id: string | null
          state: string | null
          status: Database["public"]["Enums"]["company_status"]
          street: string | null
          trade_name: string | null
          updated_at: string
          whatsapp: string | null
          zipcode: string | null
        }
        Insert: {
          city?: string | null
          cnpj?: string | null
          complement?: string | null
          corporate_name: string
          country?: string
          created_at?: string
          district?: string | null
          email?: string | null
          id?: string
          logo_url?: string | null
          number?: string | null
          phone?: string | null
          plan_id?: string | null
          state?: string | null
          status?: Database["public"]["Enums"]["company_status"]
          street?: string | null
          trade_name?: string | null
          updated_at?: string
          whatsapp?: string | null
          zipcode?: string | null
        }
        Update: {
          city?: string | null
          cnpj?: string | null
          complement?: string | null
          corporate_name?: string
          country?: string
          created_at?: string
          district?: string | null
          email?: string | null
          id?: string
          logo_url?: string | null
          number?: string | null
          phone?: string | null
          plan_id?: string | null
          state?: string | null
          status?: Database["public"]["Enums"]["company_status"]
          street?: string | null
          trade_name?: string | null
          updated_at?: string
          whatsapp?: string | null
          zipcode?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "companies_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      company_cost_settings: {
        Row: {
          allocation_method: string
          company_id: string
          created_at: string
          default_card_fee_rate: number
          default_commission_rate: number
          default_desired_margin_rate: number
          default_fixed_cost_allocation_rate: number
          default_operational_cost_rate: number
          default_tax_rate: number
          default_warranty_reserve_rate: number
          expected_monthly_revenue: number | null
          expected_monthly_sales_count: number | null
          id: string
          monthly_fixed_costs_total: number
          monthly_operational_costs_total: number
          pro_labore_percent: number
          pro_labore_value: number | null
          updated_at: string
        }
        Insert: {
          allocation_method?: string
          company_id: string
          created_at?: string
          default_card_fee_rate?: number
          default_commission_rate?: number
          default_desired_margin_rate?: number
          default_fixed_cost_allocation_rate?: number
          default_operational_cost_rate?: number
          default_tax_rate?: number
          default_warranty_reserve_rate?: number
          expected_monthly_revenue?: number | null
          expected_monthly_sales_count?: number | null
          id?: string
          monthly_fixed_costs_total?: number
          monthly_operational_costs_total?: number
          pro_labore_percent?: number
          pro_labore_value?: number | null
          updated_at?: string
        }
        Update: {
          allocation_method?: string
          company_id?: string
          created_at?: string
          default_card_fee_rate?: number
          default_commission_rate?: number
          default_desired_margin_rate?: number
          default_fixed_cost_allocation_rate?: number
          default_operational_cost_rate?: number
          default_tax_rate?: number
          default_warranty_reserve_rate?: number
          expected_monthly_revenue?: number | null
          expected_monthly_sales_count?: number | null
          id?: string
          monthly_fixed_costs_total?: number
          monthly_operational_costs_total?: number
          pro_labore_percent?: number
          pro_labore_value?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_cost_settings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      company_fixed_costs: {
        Row: {
          active: boolean
          amount: number
          category: string | null
          company_id: string
          created_at: string
          created_by: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          amount?: number
          category?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          amount?: number
          category?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_fixed_costs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      company_settings: {
        Row: {
          company_id: string
          created_at: string
          currency: string
          dark_mode: boolean
          id: string
          language: string
          pix_key: string | null
          pix_key_type: string | null
          pix_receiver_city: string | null
          pix_receiver_name: string | null
          require_after_photo: boolean
          require_before_photo: boolean
          timezone: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          currency?: string
          dark_mode?: boolean
          id?: string
          language?: string
          pix_key?: string | null
          pix_key_type?: string | null
          pix_receiver_city?: string | null
          pix_receiver_name?: string | null
          require_after_photo?: boolean
          require_before_photo?: boolean
          timezone?: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          currency?: string
          dark_mode?: boolean
          id?: string
          language?: string
          pix_key?: string | null
          pix_key_type?: string | null
          pix_receiver_city?: string | null
          pix_receiver_name?: string | null
          require_after_photo?: boolean
          require_before_photo?: boolean
          timezone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "settings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_activities: {
        Row: {
          activity_type: Database["public"]["Enums"]["crm_activity_type"]
          assigned_to: string | null
          company_id: string
          completed_at: string | null
          created_at: string
          created_by: string | null
          customer_id: string | null
          deleted_at: string | null
          description: string | null
          due_at: string | null
          id: string
          opportunity_id: string | null
          priority: Database["public"]["Enums"]["crm_priority"]
          quote_id: string | null
          status: Database["public"]["Enums"]["crm_activity_status"]
          title: string
          updated_at: string
        }
        Insert: {
          activity_type?: Database["public"]["Enums"]["crm_activity_type"]
          assigned_to?: string | null
          company_id: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          deleted_at?: string | null
          description?: string | null
          due_at?: string | null
          id?: string
          opportunity_id?: string | null
          priority?: Database["public"]["Enums"]["crm_priority"]
          quote_id?: string | null
          status?: Database["public"]["Enums"]["crm_activity_status"]
          title: string
          updated_at?: string
        }
        Update: {
          activity_type?: Database["public"]["Enums"]["crm_activity_type"]
          assigned_to?: string | null
          company_id?: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          deleted_at?: string | null
          description?: string | null
          due_at?: string | null
          id?: string
          opportunity_id?: string | null
          priority?: Database["public"]["Enums"]["crm_priority"]
          quote_id?: string | null
          status?: Database["public"]["Enums"]["crm_activity_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_activities_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_activities_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_activities_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "crm_opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_activities_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_notes: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          customer_id: string | null
          id: string
          note: string
          opportunity_id: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          id?: string
          note: string
          opportunity_id: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          id?: string
          note?: string
          opportunity_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_notes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_notes_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_notes_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "crm_opportunities"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_opportunities: {
        Row: {
          address: string | null
          assigned_to: string | null
          company_id: string
          company_name: string | null
          created_at: string
          created_by: string | null
          customer_id: string | null
          customer_type: Database["public"]["Enums"]["crm_customer_type"] | null
          deleted_at: string | null
          description: string | null
          email: string | null
          estimated_value: number | null
          id: string
          lead_name: string
          lead_type: Database["public"]["Enums"]["crm_lead_type"]
          lost_at: string | null
          lost_reason: string | null
          next_action: string | null
          next_follow_up_at: string | null
          notes: string | null
          phone: string | null
          pipeline_id: string
          project_id: string | null
          quote_id: string | null
          service_interest: string | null
          service_order_id: string | null
          sort_order: number
          source: Database["public"]["Enums"]["crm_source"] | null
          stage_id: string
          tags: string[]
          temperature: Database["public"]["Enums"]["crm_temperature"]
          updated_at: string
          won_at: string | null
        }
        Insert: {
          address?: string | null
          assigned_to?: string | null
          company_id: string
          company_name?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          customer_type?:
            | Database["public"]["Enums"]["crm_customer_type"]
            | null
          deleted_at?: string | null
          description?: string | null
          email?: string | null
          estimated_value?: number | null
          id?: string
          lead_name: string
          lead_type?: Database["public"]["Enums"]["crm_lead_type"]
          lost_at?: string | null
          lost_reason?: string | null
          next_action?: string | null
          next_follow_up_at?: string | null
          notes?: string | null
          phone?: string | null
          pipeline_id: string
          project_id?: string | null
          quote_id?: string | null
          service_interest?: string | null
          service_order_id?: string | null
          sort_order?: number
          source?: Database["public"]["Enums"]["crm_source"] | null
          stage_id: string
          tags?: string[]
          temperature?: Database["public"]["Enums"]["crm_temperature"]
          updated_at?: string
          won_at?: string | null
        }
        Update: {
          address?: string | null
          assigned_to?: string | null
          company_id?: string
          company_name?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          customer_type?:
            | Database["public"]["Enums"]["crm_customer_type"]
            | null
          deleted_at?: string | null
          description?: string | null
          email?: string | null
          estimated_value?: number | null
          id?: string
          lead_name?: string
          lead_type?: Database["public"]["Enums"]["crm_lead_type"]
          lost_at?: string | null
          lost_reason?: string | null
          next_action?: string | null
          next_follow_up_at?: string | null
          notes?: string | null
          phone?: string | null
          pipeline_id?: string
          project_id?: string | null
          quote_id?: string | null
          service_interest?: string | null
          service_order_id?: string | null
          sort_order?: number
          source?: Database["public"]["Enums"]["crm_source"] | null
          stage_id?: string
          tags?: string[]
          temperature?: Database["public"]["Enums"]["crm_temperature"]
          updated_at?: string
          won_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_opportunities_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_opportunities_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_opportunities_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "crm_pipelines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_opportunities_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_opportunities_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_opportunities_service_order_id_fkey"
            columns: ["service_order_id"]
            isOneToOne: false
            referencedRelation: "service_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_opportunities_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "crm_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_pipelines: {
        Row: {
          company_id: string
          created_at: string
          id: string
          is_default: boolean
          name: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          is_default?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          is_default?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_pipelines_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_stages: {
        Row: {
          color: string | null
          company_id: string
          created_at: string
          id: string
          is_lost: boolean
          is_won: boolean
          name: string
          pipeline_id: string
          position: number
          stage_type: Database["public"]["Enums"]["crm_stage_type"]
          updated_at: string
        }
        Insert: {
          color?: string | null
          company_id: string
          created_at?: string
          id?: string
          is_lost?: boolean
          is_won?: boolean
          name: string
          pipeline_id: string
          position?: number
          stage_type?: Database["public"]["Enums"]["crm_stage_type"]
          updated_at?: string
        }
        Update: {
          color?: string | null
          company_id?: string
          created_at?: string
          id?: string
          is_lost?: boolean
          is_won?: boolean
          name?: string
          pipeline_id?: string
          position?: number
          stage_type?: Database["public"]["Enums"]["crm_stage_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_stages_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_stages_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "crm_pipelines"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_timeline: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          description: string | null
          event_type: string
          id: string
          metadata: Json
          opportunity_id: string
          title: string
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          event_type: string
          id?: string
          metadata?: Json
          opportunity_id: string
          title: string
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          event_type?: string
          id?: string
          metadata?: Json
          opportunity_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_timeline_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_timeline_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "crm_opportunities"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_addresses: {
        Row: {
          address_type: Database["public"]["Enums"]["customer_address_type"]
          city: string | null
          company_id: string
          complement: string | null
          country: string
          created_at: string
          customer_id: string
          district: string | null
          id: string
          is_primary: boolean
          number: string | null
          reference: string | null
          state: string | null
          street: string | null
          updated_at: string
          zipcode: string | null
        }
        Insert: {
          address_type?: Database["public"]["Enums"]["customer_address_type"]
          city?: string | null
          company_id: string
          complement?: string | null
          country?: string
          created_at?: string
          customer_id: string
          district?: string | null
          id?: string
          is_primary?: boolean
          number?: string | null
          reference?: string | null
          state?: string | null
          street?: string | null
          updated_at?: string
          zipcode?: string | null
        }
        Update: {
          address_type?: Database["public"]["Enums"]["customer_address_type"]
          city?: string | null
          company_id?: string
          complement?: string | null
          country?: string
          created_at?: string
          customer_id?: string
          district?: string | null
          id?: string
          is_primary?: boolean
          number?: string | null
          reference?: string | null
          state?: string | null
          street?: string | null
          updated_at?: string
          zipcode?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_addresses_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_addresses_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_contacts: {
        Row: {
          active: boolean
          company_id: string
          created_at: string
          customer_id: string
          email: string | null
          id: string
          is_primary: boolean
          name: string
          phone: string | null
          role: string | null
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          active?: boolean
          company_id: string
          created_at?: string
          customer_id: string
          email?: string | null
          id?: string
          is_primary?: boolean
          name: string
          phone?: string | null
          role?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          active?: boolean
          company_id?: string
          created_at?: string
          customer_id?: string
          email?: string | null
          id?: string
          is_primary?: boolean
          name?: string
          phone?: string | null
          role?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_contacts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_contacts_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_history: {
        Row: {
          company_id: string
          created_at: string
          customer_id: string
          description: string | null
          history_type: Database["public"]["Enums"]["customer_history_type"]
          id: string
          title: string
          user_id: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          customer_id: string
          description?: string | null
          history_type?: Database["public"]["Enums"]["customer_history_type"]
          id?: string
          title: string
          user_id?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          customer_id?: string
          description?: string | null
          history_type?: Database["public"]["Enums"]["customer_history_type"]
          id?: string
          title?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_history_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_history_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_import_jobs: {
        Row: {
          column_mapping: Json | null
          company_id: string
          completed_at: string | null
          created_at: string
          created_by: string
          created_rows: number
          error_message: string | null
          file_name: string
          file_url: string | null
          id: string
          invalid_rows: number
          skipped_rows: number
          status: string
          total_rows: number
          updated_at: string
          updated_rows: number
          valid_rows: number
        }
        Insert: {
          column_mapping?: Json | null
          company_id: string
          completed_at?: string | null
          created_at?: string
          created_by: string
          created_rows?: number
          error_message?: string | null
          file_name: string
          file_url?: string | null
          id?: string
          invalid_rows?: number
          skipped_rows?: number
          status?: string
          total_rows?: number
          updated_at?: string
          updated_rows?: number
          valid_rows?: number
        }
        Update: {
          column_mapping?: Json | null
          company_id?: string
          completed_at?: string | null
          created_at?: string
          created_by?: string
          created_rows?: number
          error_message?: string | null
          file_name?: string
          file_url?: string | null
          id?: string
          invalid_rows?: number
          skipped_rows?: number
          status?: string
          total_rows?: number
          updated_at?: string
          updated_rows?: number
          valid_rows?: number
        }
        Relationships: [
          {
            foreignKeyName: "customer_import_jobs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_import_rows: {
        Row: {
          action: string
          company_id: string
          created_at: string
          id: string
          import_job_id: string
          mapped_data: Json
          matched_customer_id: string | null
          raw_data: Json
          row_number: number
          status: string
          updated_at: string
          validation_errors: Json | null
        }
        Insert: {
          action?: string
          company_id: string
          created_at?: string
          id?: string
          import_job_id: string
          mapped_data?: Json
          matched_customer_id?: string | null
          raw_data?: Json
          row_number: number
          status?: string
          updated_at?: string
          validation_errors?: Json | null
        }
        Update: {
          action?: string
          company_id?: string
          created_at?: string
          id?: string
          import_job_id?: string
          mapped_data?: Json
          matched_customer_id?: string | null
          raw_data?: Json
          row_number?: number
          status?: string
          updated_at?: string
          validation_errors?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_import_rows_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_import_rows_import_job_id_fkey"
            columns: ["import_job_id"]
            isOneToOne: false
            referencedRelation: "customer_import_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_import_rows_matched_customer_id_fkey"
            columns: ["matched_customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_tag_relations: {
        Row: {
          company_id: string
          created_at: string
          customer_id: string
          id: string
          tag_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          customer_id: string
          id?: string
          tag_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          customer_id?: string
          id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_tag_relations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_tag_relations_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_tag_relations_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "customer_tags"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_tags: {
        Row: {
          color: string
          company_id: string
          created_at: string
          id: string
          name: string
        }
        Insert: {
          color?: string
          company_id: string
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          color?: string
          company_id?: string
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_tags_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          active: boolean
          company_id: string
          corporate_name: string | null
          cpf_cnpj: string
          created_at: string
          created_by: string | null
          customer_origin: string | null
          customer_status: Database["public"]["Enums"]["customer_status"]
          customer_type: Database["public"]["Enums"]["customer_type"]
          deleted_at: string | null
          email: string | null
          id: string
          municipal_registration: string | null
          name: string
          notes: string | null
          phone: string | null
          state_registration: string | null
          trade_name: string | null
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          active?: boolean
          company_id: string
          corporate_name?: string | null
          cpf_cnpj: string
          created_at?: string
          created_by?: string | null
          customer_origin?: string | null
          customer_status?: Database["public"]["Enums"]["customer_status"]
          customer_type?: Database["public"]["Enums"]["customer_type"]
          deleted_at?: string | null
          email?: string | null
          id?: string
          municipal_registration?: string | null
          name: string
          notes?: string | null
          phone?: string | null
          state_registration?: string | null
          trade_name?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          active?: boolean
          company_id?: string
          corporate_name?: string | null
          cpf_cnpj?: string
          created_at?: string
          created_by?: string | null
          customer_origin?: string | null
          customer_status?: Database["public"]["Enums"]["customer_status"]
          customer_type?: Database["public"]["Enums"]["customer_type"]
          deleted_at?: string | null
          email?: string | null
          id?: string
          municipal_registration?: string | null
          name?: string
          notes?: string | null
          phone?: string | null
          state_registration?: string | null
          trade_name?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      features: {
        Row: {
          active: boolean
          category: string | null
          code: string
          created_at: string
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          category?: string | null
          code: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          category?: string | null
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      finance_monthly_plans: {
        Row: {
          cash_min: number | null
          company_id: string
          created_at: string
          created_by: string | null
          expense_cap: number | null
          id: string
          margin_goal_pct: number | null
          month: number
          notes: string | null
          profit_goal: number | null
          revenue_goal: number | null
          updated_at: string
          year: number
        }
        Insert: {
          cash_min?: number | null
          company_id: string
          created_at?: string
          created_by?: string | null
          expense_cap?: number | null
          id?: string
          margin_goal_pct?: number | null
          month: number
          notes?: string | null
          profit_goal?: number | null
          revenue_goal?: number | null
          updated_at?: string
          year: number
        }
        Update: {
          cash_min?: number | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          expense_cap?: number | null
          id?: string
          margin_goal_pct?: number | null
          month?: number
          notes?: string | null
          profit_goal?: number | null
          revenue_goal?: number | null
          updated_at?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "finance_monthly_plans_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_bank_accounts: {
        Row: {
          account_name: string | null
          account_number_masked: string | null
          account_type: string | null
          active: boolean
          agency: string | null
          balance: number
          bank_code: string | null
          bank_name: string
          company_id: string
          consent_status: string | null
          created_at: string
          currency: string
          id: string
          last_sync_at: string | null
          openfinance_connection_id: string | null
          provider: string
          provider_account_id: string | null
          updated_at: string
        }
        Insert: {
          account_name?: string | null
          account_number_masked?: string | null
          account_type?: string | null
          active?: boolean
          agency?: string | null
          balance?: number
          bank_code?: string | null
          bank_name: string
          company_id: string
          consent_status?: string | null
          created_at?: string
          currency?: string
          id?: string
          last_sync_at?: string | null
          openfinance_connection_id?: string | null
          provider?: string
          provider_account_id?: string | null
          updated_at?: string
        }
        Update: {
          account_name?: string | null
          account_number_masked?: string | null
          account_type?: string | null
          active?: boolean
          agency?: string | null
          balance?: number
          bank_code?: string | null
          bank_name?: string
          company_id?: string
          consent_status?: string | null
          created_at?: string
          currency?: string
          id?: string
          last_sync_at?: string | null
          openfinance_connection_id?: string | null
          provider?: string
          provider_account_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_bank_accounts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_bank_accounts_openfinance_connection_id_fkey"
            columns: ["openfinance_connection_id"]
            isOneToOne: false
            referencedRelation: "openfinance_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_categories: {
        Row: {
          active: boolean
          category_group: string | null
          code: string | null
          company_id: string
          cost_behavior: string | null
          created_at: string
          id: string
          is_default: boolean
          level: number | null
          name: string
          parent_id: string | null
          sort_order: number
          type: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          category_group?: string | null
          code?: string | null
          company_id: string
          cost_behavior?: string | null
          created_at?: string
          id?: string
          is_default?: boolean
          level?: number | null
          name: string
          parent_id?: string | null
          sort_order?: number
          type: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          category_group?: string | null
          code?: string | null
          company_id?: string
          cost_behavior?: string | null
          created_at?: string
          id?: string
          is_default?: boolean
          level?: number | null
          name?: string
          parent_id?: string | null
          sort_order?: number
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_categories_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "financial_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_transactions: {
        Row: {
          amount: number
          bank_account_id: string | null
          category_id: string | null
          company_id: string
          created_at: string
          created_by: string | null
          customer_id: string | null
          deleted_at: string | null
          description: string
          due_date: string | null
          id: string
          notes: string | null
          openfinance_transaction_id: string | null
          origin: string
          origin_id: string | null
          origin_type: string | null
          paid_at: string | null
          payment_method: string | null
          project_id: string | null
          purchase_id: string | null
          quote_id: string | null
          quote_payment_id: string | null
          service_order_id: string | null
          status: string
          supplier_id: string | null
          type: string
          updated_at: string
        }
        Insert: {
          amount: number
          bank_account_id?: string | null
          category_id?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          deleted_at?: string | null
          description: string
          due_date?: string | null
          id?: string
          notes?: string | null
          openfinance_transaction_id?: string | null
          origin?: string
          origin_id?: string | null
          origin_type?: string | null
          paid_at?: string | null
          payment_method?: string | null
          project_id?: string | null
          purchase_id?: string | null
          quote_id?: string | null
          quote_payment_id?: string | null
          service_order_id?: string | null
          status?: string
          supplier_id?: string | null
          type: string
          updated_at?: string
        }
        Update: {
          amount?: number
          bank_account_id?: string | null
          category_id?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          deleted_at?: string | null
          description?: string
          due_date?: string | null
          id?: string
          notes?: string | null
          openfinance_transaction_id?: string | null
          origin?: string
          origin_id?: string | null
          origin_type?: string | null
          paid_at?: string | null
          payment_method?: string | null
          project_id?: string | null
          purchase_id?: string | null
          quote_id?: string | null
          quote_payment_id?: string | null
          service_order_id?: string | null
          status?: string
          supplier_id?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_transactions_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "financial_bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_transactions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "financial_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_transactions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_transactions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_transactions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_transactions_purchase_id_fkey"
            columns: ["purchase_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_transactions_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_transactions_quote_payment_id_fkey"
            columns: ["quote_payment_id"]
            isOneToOne: false
            referencedRelation: "quote_payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_transactions_service_order_id_fkey"
            columns: ["service_order_id"]
            isOneToOne: false
            referencedRelation: "service_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_transactions_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      item_images: {
        Row: {
          company_id: string
          created_at: string
          file_name: string
          file_path: string
          file_url: string
          id: string
          is_primary: boolean
          item_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          file_name: string
          file_path: string
          file_url: string
          id?: string
          is_primary?: boolean
          item_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          file_name?: string
          file_path?: string
          file_url?: string
          id?: string
          is_primary?: boolean
          item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_images_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_images_product_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
        ]
      }
      items: {
        Row: {
          active: boolean
          barcode: string | null
          brand_id: string | null
          category_id: string | null
          company_id: string
          controls_stock: boolean
          cost_price: number
          created_at: string
          deleted_at: string | null
          description: string | null
          global_catalog_id: string | null
          id: string
          item_type: Database["public"]["Enums"]["item_type"]
          manufacturer_id: string | null
          minimum_stock: number
          name: string
          sale_price: number
          sku: string | null
          unit: Database["public"]["Enums"]["product_unit"]
          updated_at: string
        }
        Insert: {
          active?: boolean
          barcode?: string | null
          brand_id?: string | null
          category_id?: string | null
          company_id: string
          controls_stock?: boolean
          cost_price?: number
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          global_catalog_id?: string | null
          id?: string
          item_type?: Database["public"]["Enums"]["item_type"]
          manufacturer_id?: string | null
          minimum_stock?: number
          name: string
          sale_price?: number
          sku?: string | null
          unit?: Database["public"]["Enums"]["product_unit"]
          updated_at?: string
        }
        Update: {
          active?: boolean
          barcode?: string | null
          brand_id?: string | null
          category_id?: string | null
          company_id?: string
          controls_stock?: boolean
          cost_price?: number
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          global_catalog_id?: string | null
          id?: string
          item_type?: Database["public"]["Enums"]["item_type"]
          manufacturer_id?: string | null
          minimum_stock?: number
          name?: string
          sale_price?: number
          sku?: string | null
          unit?: Database["public"]["Enums"]["product_unit"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_manufacturer_id_fkey"
            columns: ["manufacturer_id"]
            isOneToOne: false
            referencedRelation: "manufacturers"
            referencedColumns: ["id"]
          },
        ]
      }
      manufacturers: {
        Row: {
          active: boolean
          company_id: string
          created_at: string
          email: string | null
          id: string
          name: string
          phone: string | null
          updated_at: string
          website: string | null
        }
        Insert: {
          active?: boolean
          company_id: string
          created_at?: string
          email?: string | null
          id?: string
          name: string
          phone?: string | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          active?: boolean
          company_id?: string
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          phone?: string | null
          updated_at?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "manufacturers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      nota_document_items: {
        Row: {
          company_id: string
          confirmed_quantity: number | null
          confirmed_unit_cost: number | null
          created_at: string
          created_item_id: string | null
          document_id: string
          id: string
          line_no: number | null
          match_confidence: number | null
          match_reason: string | null
          matched_item_id: string | null
          new_item_payload: Json | null
          raw_code: string | null
          raw_name: string
          raw_quantity: number | null
          raw_total: number | null
          raw_unit: string | null
          raw_unit_cost: number | null
          status: Database["public"]["Enums"]["nota_item_status"]
          stock_movement_id: string | null
          updated_at: string
        }
        Insert: {
          company_id: string
          confirmed_quantity?: number | null
          confirmed_unit_cost?: number | null
          created_at?: string
          created_item_id?: string | null
          document_id: string
          id?: string
          line_no?: number | null
          match_confidence?: number | null
          match_reason?: string | null
          matched_item_id?: string | null
          new_item_payload?: Json | null
          raw_code?: string | null
          raw_name: string
          raw_quantity?: number | null
          raw_total?: number | null
          raw_unit?: string | null
          raw_unit_cost?: number | null
          status?: Database["public"]["Enums"]["nota_item_status"]
          stock_movement_id?: string | null
          updated_at?: string
        }
        Update: {
          company_id?: string
          confirmed_quantity?: number | null
          confirmed_unit_cost?: number | null
          created_at?: string
          created_item_id?: string | null
          document_id?: string
          id?: string
          line_no?: number | null
          match_confidence?: number | null
          match_reason?: string | null
          matched_item_id?: string | null
          new_item_payload?: Json | null
          raw_code?: string | null
          raw_name?: string
          raw_quantity?: number | null
          raw_total?: number | null
          raw_unit?: string | null
          raw_unit_cost?: number | null
          status?: Database["public"]["Enums"]["nota_item_status"]
          stock_movement_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "nota_document_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nota_document_items_created_item_id_fkey"
            columns: ["created_item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nota_document_items_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "nota_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nota_document_items_matched_item_id_fkey"
            columns: ["matched_item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nota_document_items_stock_movement_id_fkey"
            columns: ["stock_movement_id"]
            isOneToOne: false
            referencedRelation: "stock_movements"
            referencedColumns: ["id"]
          },
        ]
      }
      nota_documents: {
        Row: {
          ai_confidence: number | null
          ai_invoice_number: string | null
          ai_issue_date: string | null
          ai_model: string | null
          ai_raw: Json | null
          ai_supplier_cnpj: string | null
          ai_supplier_name: string | null
          ai_total_amount: number | null
          company_id: string
          confirmed_at: string | null
          created_at: string
          error_message: string | null
          file_path: string
          file_size: number | null
          id: string
          location_id: string | null
          mime_type: string | null
          notes: string | null
          original_name: string | null
          processed_at: string | null
          purchase_order_id: string | null
          status: Database["public"]["Enums"]["nota_document_status"]
          supplier_id: string | null
          updated_at: string
          uploaded_by: string | null
        }
        Insert: {
          ai_confidence?: number | null
          ai_invoice_number?: string | null
          ai_issue_date?: string | null
          ai_model?: string | null
          ai_raw?: Json | null
          ai_supplier_cnpj?: string | null
          ai_supplier_name?: string | null
          ai_total_amount?: number | null
          company_id: string
          confirmed_at?: string | null
          created_at?: string
          error_message?: string | null
          file_path: string
          file_size?: number | null
          id?: string
          location_id?: string | null
          mime_type?: string | null
          notes?: string | null
          original_name?: string | null
          processed_at?: string | null
          purchase_order_id?: string | null
          status?: Database["public"]["Enums"]["nota_document_status"]
          supplier_id?: string | null
          updated_at?: string
          uploaded_by?: string | null
        }
        Update: {
          ai_confidence?: number | null
          ai_invoice_number?: string | null
          ai_issue_date?: string | null
          ai_model?: string | null
          ai_raw?: Json | null
          ai_supplier_cnpj?: string | null
          ai_supplier_name?: string | null
          ai_total_amount?: number | null
          company_id?: string
          confirmed_at?: string | null
          created_at?: string
          error_message?: string | null
          file_path?: string
          file_size?: number | null
          id?: string
          location_id?: string | null
          mime_type?: string | null
          notes?: string | null
          original_name?: string | null
          processed_at?: string | null
          purchase_order_id?: string | null
          status?: Database["public"]["Enums"]["nota_document_status"]
          supplier_id?: string | null
          updated_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "nota_documents_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nota_documents_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "stock_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nota_documents_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nota_documents_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          company_id: string
          created_at: string
          id: string
          message: string | null
          read: boolean
          title: string
          user_id: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          message?: string | null
          read?: boolean
          title: string
          user_id?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          message?: string | null
          read?: boolean
          title?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      openfinance_connections: {
        Row: {
          company_id: string
          consent_expires_at: string | null
          consent_id: string | null
          created_at: string
          created_by: string | null
          error_message: string | null
          id: string
          last_sync_at: string | null
          provider: string
          provider_connection_id: string | null
          provider_item_id: string | null
          revoked_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          company_id: string
          consent_expires_at?: string | null
          consent_id?: string | null
          created_at?: string
          created_by?: string | null
          error_message?: string | null
          id?: string
          last_sync_at?: string | null
          provider: string
          provider_connection_id?: string | null
          provider_item_id?: string | null
          revoked_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          consent_expires_at?: string | null
          consent_id?: string | null
          created_at?: string
          created_by?: string | null
          error_message?: string | null
          id?: string
          last_sync_at?: string | null
          provider?: string
          provider_connection_id?: string | null
          provider_item_id?: string | null
          revoked_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "openfinance_connections_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      openfinance_transactions: {
        Row: {
          amount: number
          bank_account_id: string | null
          category_suggestion: string | null
          company_id: string
          connection_id: string | null
          created_at: string
          description: string
          id: string
          ignore_reason: string | null
          provider: string
          provider_transaction_id: string
          raw_payload: Json | null
          reconciled_transaction_id: string | null
          reconciliation_status: string
          transaction_date: string
          type: string
          updated_at: string
        }
        Insert: {
          amount: number
          bank_account_id?: string | null
          category_suggestion?: string | null
          company_id: string
          connection_id?: string | null
          created_at?: string
          description: string
          id?: string
          ignore_reason?: string | null
          provider: string
          provider_transaction_id: string
          raw_payload?: Json | null
          reconciled_transaction_id?: string | null
          reconciliation_status?: string
          transaction_date: string
          type: string
          updated_at?: string
        }
        Update: {
          amount?: number
          bank_account_id?: string | null
          category_suggestion?: string | null
          company_id?: string
          connection_id?: string | null
          created_at?: string
          description?: string
          id?: string
          ignore_reason?: string | null
          provider?: string
          provider_transaction_id?: string
          raw_payload?: Json | null
          reconciled_transaction_id?: string | null
          reconciliation_status?: string
          transaction_date?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "openfinance_transactions_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "financial_bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "openfinance_transactions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "openfinance_transactions_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "openfinance_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      openfinance_webhook_events: {
        Row: {
          company_id: string | null
          connection_id: string | null
          created_at: string
          error_message: string | null
          event_id: string | null
          event_type: string | null
          id: string
          payload: Json
          processed_at: string | null
          provider: string
          status: string
        }
        Insert: {
          company_id?: string | null
          connection_id?: string | null
          created_at?: string
          error_message?: string | null
          event_id?: string | null
          event_type?: string | null
          id?: string
          payload: Json
          processed_at?: string | null
          provider: string
          status?: string
        }
        Update: {
          company_id?: string | null
          connection_id?: string | null
          created_at?: string
          error_message?: string | null
          event_id?: string | null
          event_type?: string | null
          id?: string
          payload?: Json
          processed_at?: string | null
          provider?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "openfinance_webhook_events_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "openfinance_webhook_events_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "openfinance_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      permissions: {
        Row: {
          action: string
          created_at: string
          description: string | null
          id: string
          module: string
          slug: string
        }
        Insert: {
          action: string
          created_at?: string
          description?: string | null
          id?: string
          module: string
          slug: string
        }
        Update: {
          action?: string
          created_at?: string
          description?: string | null
          id?: string
          module?: string
          slug?: string
        }
        Relationships: []
      }
      pilot_feedback: {
        Row: {
          actual_result: string | null
          assignee: string | null
          company_id: string
          created_at: string
          description: string | null
          expected_result: string | null
          feedback_type: string
          id: string
          module: string
          pilot_id: string | null
          priority: string
          resolved_at: string | null
          screen: string | null
          status: string
          steps_to_reproduce: string | null
          submitted_by: string | null
          title: string
          updated_at: string
        }
        Insert: {
          actual_result?: string | null
          assignee?: string | null
          company_id: string
          created_at?: string
          description?: string | null
          expected_result?: string | null
          feedback_type: string
          id?: string
          module: string
          pilot_id?: string | null
          priority?: string
          resolved_at?: string | null
          screen?: string | null
          status?: string
          steps_to_reproduce?: string | null
          submitted_by?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          actual_result?: string | null
          assignee?: string | null
          company_id?: string
          created_at?: string
          description?: string | null
          expected_result?: string | null
          feedback_type?: string
          id?: string
          module?: string
          pilot_id?: string | null
          priority?: string
          resolved_at?: string | null
          screen?: string | null
          status?: string
          steps_to_reproduce?: string | null
          submitted_by?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pilot_feedback_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pilot_feedback_pilot_id_fkey"
            columns: ["pilot_id"]
            isOneToOne: false
            referencedRelation: "commercial_pilots"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_features: {
        Row: {
          created_at: string
          enabled: boolean
          feature_id: string
          id: string
          plan_id: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          feature_id: string
          id?: string
          plan_id: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          feature_id?: string
          id?: string
          plan_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_features_feature_id_fkey"
            columns: ["feature_id"]
            isOneToOne: false
            referencedRelation: "features"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_features_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_limits: {
        Row: {
          created_at: string
          id: string
          max_companies: number | null
          max_users: number | null
          monthly_import_limit: number | null
          monthly_ocr_limit: number | null
          monthly_service_order_limit: number | null
          plan_id: string
          storage_gb: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          max_companies?: number | null
          max_users?: number | null
          monthly_import_limit?: number | null
          monthly_ocr_limit?: number | null
          monthly_service_order_limit?: number | null
          plan_id: string
          storage_gb?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          max_companies?: number | null
          max_users?: number | null
          monthly_import_limit?: number | null
          monthly_ocr_limit?: number | null
          monthly_service_order_limit?: number | null
          plan_id?: string
          storage_gb?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_limits_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: true
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          active: boolean
          annual_price: number
          created_at: string
          description: string | null
          id: string
          max_customers: number
          max_products: number
          max_service_orders: number
          max_storage_gb: number
          max_users: number
          monthly_price: number
          name: string
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          annual_price?: number
          created_at?: string
          description?: string | null
          id?: string
          max_customers?: number
          max_products?: number
          max_service_orders?: number
          max_storage_gb?: number
          max_users?: number
          monthly_price?: number
          name: string
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          annual_price?: number
          created_at?: string
          description?: string | null
          id?: string
          max_customers?: number
          max_products?: number
          max_service_orders?: number
          max_storage_gb?: number
          max_users?: number
          monthly_price?: number
          name?: string
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      pricing_simulations: {
        Row: {
          additional_costs: number
          applied_to_item: boolean
          card_fee_rate: number
          commission_rate: number
          company_id: string
          cost_price: number
          created_at: string
          current_price: number | null
          desired_margin_rate: number
          estimated_margin_rate: number
          estimated_profit: number
          fixed_cost_allocation_rate: number
          id: string
          item_id: string | null
          item_name: string
          markup_multiplier: number
          markup_percentage: number
          operational_cost_rate: number
          suggested_price: number
          tax_rate: number
          user_id: string | null
          warranty_reserve_rate: number
        }
        Insert: {
          additional_costs?: number
          applied_to_item?: boolean
          card_fee_rate?: number
          commission_rate?: number
          company_id: string
          cost_price?: number
          created_at?: string
          current_price?: number | null
          desired_margin_rate?: number
          estimated_margin_rate?: number
          estimated_profit?: number
          fixed_cost_allocation_rate?: number
          id?: string
          item_id?: string | null
          item_name: string
          markup_multiplier?: number
          markup_percentage?: number
          operational_cost_rate?: number
          suggested_price?: number
          tax_rate?: number
          user_id?: string | null
          warranty_reserve_rate?: number
        }
        Update: {
          additional_costs?: number
          applied_to_item?: boolean
          card_fee_rate?: number
          commission_rate?: number
          company_id?: string
          cost_price?: number
          created_at?: string
          current_price?: number | null
          desired_margin_rate?: number
          estimated_margin_rate?: number
          estimated_profit?: number
          fixed_cost_allocation_rate?: number
          id?: string
          item_id?: string | null
          item_name?: string
          markup_multiplier?: number
          markup_percentage?: number
          operational_cost_rate?: number
          suggested_price?: number
          tax_rate?: number
          user_id?: string | null
          warranty_reserve_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "pricing_simulations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pricing_simulations_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
        ]
      }
      product_import_jobs: {
        Row: {
          column_mapping: Json | null
          company_id: string
          completed_at: string | null
          created_at: string
          created_by: string
          created_rows: number
          error_message: string | null
          file_name: string
          file_url: string | null
          id: string
          invalid_rows: number
          skipped_rows: number
          status: string
          stock_location_id: string | null
          total_rows: number
          updated_at: string
          updated_rows: number
          valid_rows: number
        }
        Insert: {
          column_mapping?: Json | null
          company_id: string
          completed_at?: string | null
          created_at?: string
          created_by: string
          created_rows?: number
          error_message?: string | null
          file_name: string
          file_url?: string | null
          id?: string
          invalid_rows?: number
          skipped_rows?: number
          status?: string
          stock_location_id?: string | null
          total_rows?: number
          updated_at?: string
          updated_rows?: number
          valid_rows?: number
        }
        Update: {
          column_mapping?: Json | null
          company_id?: string
          completed_at?: string | null
          created_at?: string
          created_by?: string
          created_rows?: number
          error_message?: string | null
          file_name?: string
          file_url?: string | null
          id?: string
          invalid_rows?: number
          skipped_rows?: number
          status?: string
          stock_location_id?: string | null
          total_rows?: number
          updated_at?: string
          updated_rows?: number
          valid_rows?: number
        }
        Relationships: [
          {
            foreignKeyName: "product_import_jobs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_import_jobs_stock_location_id_fkey"
            columns: ["stock_location_id"]
            isOneToOne: false
            referencedRelation: "stock_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      product_import_rows: {
        Row: {
          action: string
          company_id: string
          created_at: string
          id: string
          import_job_id: string
          mapped_data: Json
          matched_item_id: string | null
          raw_data: Json
          row_number: number
          status: string
          updated_at: string
          validation_errors: Json | null
        }
        Insert: {
          action?: string
          company_id: string
          created_at?: string
          id?: string
          import_job_id: string
          mapped_data?: Json
          matched_item_id?: string | null
          raw_data?: Json
          row_number: number
          status?: string
          updated_at?: string
          validation_errors?: Json | null
        }
        Update: {
          action?: string
          company_id?: string
          created_at?: string
          id?: string
          import_job_id?: string
          mapped_data?: Json
          matched_item_id?: string | null
          raw_data?: Json
          row_number?: number
          status?: string
          updated_at?: string
          validation_errors?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "product_import_rows_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_import_rows_import_job_id_fkey"
            columns: ["import_job_id"]
            isOneToOne: false
            referencedRelation: "product_import_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_import_rows_matched_item_id_fkey"
            columns: ["matched_item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
        ]
      }
      production_checklist_items: {
        Row: {
          code: string
          company_id: string
          completed_at: string | null
          created_at: string
          id: string
          note: string | null
          responsible: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          code: string
          company_id: string
          completed_at?: string | null
          created_at?: string
          id?: string
          note?: string | null
          responsible?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          code?: string
          company_id?: string
          completed_at?: string | null
          created_at?: string
          id?: string
          note?: string | null
          responsible?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "production_checklist_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_roles: {
        Row: {
          company_id: string | null
          created_at: string
          id: string
          profile_id: string
          role_id: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          id?: string
          profile_id: string
          role_id: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          id?: string
          profile_id?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_roles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_roles_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_roles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          active: boolean
          avatar_url: string | null
          company_id: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          avatar_url?: string | null
          company_id?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          avatar_url?: string | null
          company_id?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      project_items: {
        Row: {
          company_id: string
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          item_id: string | null
          item_type: string
          name: string
          position: number
          project_id: string
          quantity: number
          quote_item_id: string | null
          reserved_quantity: number
          unit: string
          updated_at: string
          used_quantity: number
        }
        Insert: {
          company_id: string
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          item_id?: string | null
          item_type?: string
          name: string
          position?: number
          project_id: string
          quantity?: number
          quote_item_id?: string | null
          reserved_quantity?: number
          unit?: string
          updated_at?: string
          used_quantity?: number
        }
        Update: {
          company_id?: string
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          item_id?: string | null
          item_type?: string
          name?: string
          position?: number
          project_id?: string
          quantity?: number
          quote_item_id?: string | null
          reserved_quantity?: number
          unit?: string
          updated_at?: string
          used_quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "project_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_items_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_items_quote_item_id_fkey"
            columns: ["quote_item_id"]
            isOneToOne: false
            referencedRelation: "quote_items"
            referencedColumns: ["id"]
          },
        ]
      }
      project_material_checks: {
        Row: {
          available_quantity: number
          checked_at: string
          checked_by: string | null
          company_id: string
          created_at: string
          id: string
          item_id: string | null
          missing_quantity: number
          project_id: string
          project_item_id: string
          required_quantity: number
          status: string
          stock_location_id: string | null
          updated_at: string
        }
        Insert: {
          available_quantity?: number
          checked_at?: string
          checked_by?: string | null
          company_id: string
          created_at?: string
          id?: string
          item_id?: string | null
          missing_quantity?: number
          project_id: string
          project_item_id: string
          required_quantity?: number
          status: string
          stock_location_id?: string | null
          updated_at?: string
        }
        Update: {
          available_quantity?: number
          checked_at?: string
          checked_by?: string | null
          company_id?: string
          created_at?: string
          id?: string
          item_id?: string | null
          missing_quantity?: number
          project_id?: string
          project_item_id?: string
          required_quantity?: number
          status?: string
          stock_location_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_material_checks_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_material_checks_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_material_checks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_material_checks_project_item_id_fkey"
            columns: ["project_item_id"]
            isOneToOne: true
            referencedRelation: "project_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_material_checks_stock_location_id_fkey"
            columns: ["stock_location_id"]
            isOneToOne: false
            referencedRelation: "stock_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      project_number_counters: {
        Row: {
          company_id: string
          current_number: number
          updated_at: string
        }
        Insert: {
          company_id: string
          current_number?: number
          updated_at?: string
        }
        Update: {
          company_id?: string
          current_number?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_number_counters_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      project_team_members: {
        Row: {
          company_id: string
          created_at: string
          id: string
          project_id: string
          role: string | null
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          project_id: string
          role?: string | null
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          project_id?: string
          role?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_team_members_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_team_members_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          access_instructions: string | null
          cancelled_at: string | null
          company_id: string
          completed_at: string | null
          completion_estimate: string | null
          created_at: string
          created_by: string | null
          customer_address_id: string | null
          customer_contact_id: string | null
          customer_id: string
          customer_instructions: string | null
          deleted_at: string | null
          description: string | null
          down_payment_amount: number
          expected_end_date: string | null
          expected_start_date: string | null
          financial_status: string
          id: string
          internal_notes: string | null
          material_status: string
          materials_checked_at: string | null
          notes: string | null
          operational_notes: string | null
          opportunity_id: string | null
          parking_instructions: string | null
          planned_end_date: string | null
          planned_end_time: string | null
          planned_start_date: string | null
          planned_start_time: string | null
          planning_status: string
          priority: string
          project_number: string
          quote_id: string | null
          ready_for_os_at: string | null
          remaining_amount: number
          responsible_user_id: string | null
          started_at: string | null
          status: string
          title: string
          total_amount: number
          updated_at: string
        }
        Insert: {
          access_instructions?: string | null
          cancelled_at?: string | null
          company_id: string
          completed_at?: string | null
          completion_estimate?: string | null
          created_at?: string
          created_by?: string | null
          customer_address_id?: string | null
          customer_contact_id?: string | null
          customer_id: string
          customer_instructions?: string | null
          deleted_at?: string | null
          description?: string | null
          down_payment_amount?: number
          expected_end_date?: string | null
          expected_start_date?: string | null
          financial_status?: string
          id?: string
          internal_notes?: string | null
          material_status?: string
          materials_checked_at?: string | null
          notes?: string | null
          operational_notes?: string | null
          opportunity_id?: string | null
          parking_instructions?: string | null
          planned_end_date?: string | null
          planned_end_time?: string | null
          planned_start_date?: string | null
          planned_start_time?: string | null
          planning_status?: string
          priority?: string
          project_number: string
          quote_id?: string | null
          ready_for_os_at?: string | null
          remaining_amount?: number
          responsible_user_id?: string | null
          started_at?: string | null
          status?: string
          title: string
          total_amount?: number
          updated_at?: string
        }
        Update: {
          access_instructions?: string | null
          cancelled_at?: string | null
          company_id?: string
          completed_at?: string | null
          completion_estimate?: string | null
          created_at?: string
          created_by?: string | null
          customer_address_id?: string | null
          customer_contact_id?: string | null
          customer_id?: string
          customer_instructions?: string | null
          deleted_at?: string | null
          description?: string | null
          down_payment_amount?: number
          expected_end_date?: string | null
          expected_start_date?: string | null
          financial_status?: string
          id?: string
          internal_notes?: string | null
          material_status?: string
          materials_checked_at?: string | null
          notes?: string | null
          operational_notes?: string | null
          opportunity_id?: string | null
          parking_instructions?: string | null
          planned_end_date?: string | null
          planned_end_time?: string | null
          planned_start_date?: string | null
          planned_start_time?: string | null
          planning_status?: string
          priority?: string
          project_number?: string
          quote_id?: string | null
          ready_for_os_at?: string | null
          remaining_amount?: number
          responsible_user_id?: string | null
          started_at?: string | null
          status?: string
          title?: string
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_customer_address_id_fkey"
            columns: ["customer_address_id"]
            isOneToOne: false
            referencedRelation: "customer_addresses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_customer_contact_id_fkey"
            columns: ["customer_contact_id"]
            isOneToOne: false
            referencedRelation: "customer_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "crm_opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: true
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      public_rate_limits: {
        Row: {
          bucket: string
          count: number
          reset_at: string
          updated_at: string
        }
        Insert: {
          bucket: string
          count?: number
          reset_at: string
          updated_at?: string
        }
        Update: {
          bucket?: string
          count?: number
          reset_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      purchase_order_items: {
        Row: {
          created_at: string
          id: string
          item_id: string
          purchase_order_id: string
          quantity: number
          received_quantity: number
          total_cost: number
          unit_cost: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          item_id: string
          purchase_order_id: string
          quantity: number
          received_quantity?: number
          total_cost?: number
          unit_cost: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          item_id?: string
          purchase_order_id?: string
          quantity?: number
          received_quantity?: number
          total_cost?: number
          unit_cost?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_order_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_items_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_orders: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          cancellation_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          company_id: string
          created_at: string
          created_by: string | null
          expected_delivery_date: string | null
          id: string
          issue_date: string
          notes: string | null
          order_number: string
          status: Database["public"]["Enums"]["purchase_order_status"]
          supplier_id: string
          total_amount: number
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          expected_delivery_date?: string | null
          id?: string
          issue_date?: string
          notes?: string | null
          order_number: string
          status?: Database["public"]["Enums"]["purchase_order_status"]
          supplier_id: string
          total_amount?: number
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          expected_delivery_date?: string | null
          id?: string
          issue_date?: string
          notes?: string | null
          order_number?: string
          status?: Database["public"]["Enums"]["purchase_order_status"]
          supplier_id?: string
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      qa_bugs: {
        Row: {
          assignee: string | null
          created_at: string
          description: string
          fix: string | null
          id: string
          impact: string | null
          priority: string
          reporter_id: string | null
          root_cause: string | null
          screen: string
          status: string
          updated_at: string
        }
        Insert: {
          assignee?: string | null
          created_at?: string
          description: string
          fix?: string | null
          id?: string
          impact?: string | null
          priority?: string
          reporter_id?: string | null
          root_cause?: string | null
          screen: string
          status?: string
          updated_at?: string
        }
        Update: {
          assignee?: string | null
          created_at?: string
          description?: string
          fix?: string | null
          id?: string
          impact?: string | null
          priority?: string
          reporter_id?: string | null
          root_cause?: string | null
          screen?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      quote_history: {
        Row: {
          actor_label: string | null
          actor_user_id: string | null
          company_id: string
          created_at: string
          event_type: string
          id: string
          meta: Json
          quote_id: string
        }
        Insert: {
          actor_label?: string | null
          actor_user_id?: string | null
          company_id: string
          created_at?: string
          event_type: string
          id?: string
          meta?: Json
          quote_id: string
        }
        Update: {
          actor_label?: string | null
          actor_user_id?: string | null
          company_id?: string
          created_at?: string
          event_type?: string
          id?: string
          meta?: Json
          quote_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quote_history_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_history_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_items: {
        Row: {
          company_id: string
          cost_price: number
          created_at: string
          description: string | null
          id: string
          image_path: string | null
          item_id: string | null
          kind: Database["public"]["Enums"]["quote_item_kind"]
          name: string
          position: number
          quantity: number
          quote_id: string
          total: number
          unit_price: number
          updated_at: string
        }
        Insert: {
          company_id: string
          cost_price?: number
          created_at?: string
          description?: string | null
          id?: string
          image_path?: string | null
          item_id?: string | null
          kind?: Database["public"]["Enums"]["quote_item_kind"]
          name: string
          position?: number
          quantity?: number
          quote_id: string
          total?: number
          unit_price?: number
          updated_at?: string
        }
        Update: {
          company_id?: string
          cost_price?: number
          created_at?: string
          description?: string | null
          id?: string
          image_path?: string | null
          item_id?: string | null
          kind?: Database["public"]["Enums"]["quote_item_kind"]
          name?: string
          position?: number
          quantity?: number
          quote_id?: string
          total?: number
          unit_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quote_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_items_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_payments: {
        Row: {
          amount: number
          approved_by: string | null
          cancelled_at: string | null
          company_id: string
          created_at: string
          created_by: string | null
          customer_id: string | null
          description: string | null
          due_date: string | null
          id: string
          paid_at: string | null
          payer_name: string | null
          payment_date: string | null
          payment_method: string
          payment_status: string
          payment_type: string
          pix_copy_paste: string | null
          pix_key: string | null
          pix_qr_code_url: string | null
          pix_txid: string | null
          provider: string | null
          provider_charge_id: string | null
          provider_payload: Json | null
          quote_id: string
          receipt_file_path: string | null
          receipt_mime_type: string | null
          receipt_rejection_reason: string | null
          receipt_reviewed_at: string | null
          receipt_reviewed_by: string | null
          receipt_size: number | null
          receipt_source: string | null
          receipt_status: string | null
          receipt_uploaded_at: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          approved_by?: string | null
          cancelled_at?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          paid_at?: string | null
          payer_name?: string | null
          payment_date?: string | null
          payment_method?: string
          payment_status?: string
          payment_type?: string
          pix_copy_paste?: string | null
          pix_key?: string | null
          pix_qr_code_url?: string | null
          pix_txid?: string | null
          provider?: string | null
          provider_charge_id?: string | null
          provider_payload?: Json | null
          quote_id: string
          receipt_file_path?: string | null
          receipt_mime_type?: string | null
          receipt_rejection_reason?: string | null
          receipt_reviewed_at?: string | null
          receipt_reviewed_by?: string | null
          receipt_size?: number | null
          receipt_source?: string | null
          receipt_status?: string | null
          receipt_uploaded_at?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          approved_by?: string | null
          cancelled_at?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          paid_at?: string | null
          payer_name?: string | null
          payment_date?: string | null
          payment_method?: string
          payment_status?: string
          payment_type?: string
          pix_copy_paste?: string | null
          pix_key?: string | null
          pix_qr_code_url?: string | null
          pix_txid?: string | null
          provider?: string | null
          provider_charge_id?: string | null
          provider_payload?: Json | null
          quote_id?: string
          receipt_file_path?: string | null
          receipt_mime_type?: string | null
          receipt_rejection_reason?: string | null
          receipt_reviewed_at?: string | null
          receipt_reviewed_by?: string | null
          receipt_size?: number | null
          receipt_source?: string | null
          receipt_status?: string | null
          receipt_uploaded_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quote_payments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_payments_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      quotes: {
        Row: {
          accepted_at: string | null
          accepted_by_document: string | null
          accepted_by_name: string | null
          accepted_ip: string | null
          approved_at: string | null
          cancelled_at: string | null
          company_id: string
          completion_estimate: string | null
          converted_at: string | null
          created_at: string
          created_by: string | null
          customer_id: string
          customer_notes: string | null
          delivery_terms: string | null
          diagnosis_critical_points: string | null
          diagnosis_environment: string | null
          diagnosis_need: string | null
          diagnosis_objective: string | null
          diagnosis_problem: string | null
          diagnosis_technical_notes: string | null
          discount: number
          down_payment_amount: number
          down_payment_percent: number
          financial_status: string
          first_sent_at: string | null
          id: string
          internal_notes: string | null
          issue_date: string
          items_subtotal: number
          labor_cost: number
          opportunity_id: string | null
          paid_amount: number
          payment_approved_at: string | null
          payment_status: string
          payment_terms: string | null
          project_id: string | null
          public_token: string
          quote_number: string
          remaining_amount: number
          status: Database["public"]["Enums"]["quote_status"]
          title: string | null
          total_amount: number
          updated_at: string
          valid_until: string | null
          viewed_at: string | null
          warranty_terms: string | null
        }
        Insert: {
          accepted_at?: string | null
          accepted_by_document?: string | null
          accepted_by_name?: string | null
          accepted_ip?: string | null
          approved_at?: string | null
          cancelled_at?: string | null
          company_id: string
          completion_estimate?: string | null
          converted_at?: string | null
          created_at?: string
          created_by?: string | null
          customer_id: string
          customer_notes?: string | null
          delivery_terms?: string | null
          diagnosis_critical_points?: string | null
          diagnosis_environment?: string | null
          diagnosis_need?: string | null
          diagnosis_objective?: string | null
          diagnosis_problem?: string | null
          diagnosis_technical_notes?: string | null
          discount?: number
          down_payment_amount?: number
          down_payment_percent?: number
          financial_status?: string
          first_sent_at?: string | null
          id?: string
          internal_notes?: string | null
          issue_date?: string
          items_subtotal?: number
          labor_cost?: number
          opportunity_id?: string | null
          paid_amount?: number
          payment_approved_at?: string | null
          payment_status?: string
          payment_terms?: string | null
          project_id?: string | null
          public_token?: string
          quote_number: string
          remaining_amount?: number
          status?: Database["public"]["Enums"]["quote_status"]
          title?: string | null
          total_amount?: number
          updated_at?: string
          valid_until?: string | null
          viewed_at?: string | null
          warranty_terms?: string | null
        }
        Update: {
          accepted_at?: string | null
          accepted_by_document?: string | null
          accepted_by_name?: string | null
          accepted_ip?: string | null
          approved_at?: string | null
          cancelled_at?: string | null
          company_id?: string
          completion_estimate?: string | null
          converted_at?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string
          customer_notes?: string | null
          delivery_terms?: string | null
          diagnosis_critical_points?: string | null
          diagnosis_environment?: string | null
          diagnosis_need?: string | null
          diagnosis_objective?: string | null
          diagnosis_problem?: string | null
          diagnosis_technical_notes?: string | null
          discount?: number
          down_payment_amount?: number
          down_payment_percent?: number
          financial_status?: string
          first_sent_at?: string | null
          id?: string
          internal_notes?: string | null
          issue_date?: string
          items_subtotal?: number
          labor_cost?: number
          opportunity_id?: string | null
          paid_amount?: number
          payment_approved_at?: string | null
          payment_status?: string
          payment_terms?: string | null
          project_id?: string | null
          public_token?: string
          quote_number?: string
          remaining_amount?: number
          status?: Database["public"]["Enums"]["quote_status"]
          title?: string | null
          total_amount?: number
          updated_at?: string
          valid_until?: string | null
          viewed_at?: string | null
          warranty_terms?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quotes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "crm_opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: true
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          created_at: string
          id: string
          permission_id: string
          role_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          permission_id: string
          role_id: string
        }
        Update: {
          created_at?: string
          id?: string
          permission_id?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["id"]
          },
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
          name: string
          slug: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_system?: boolean
          name: string
          slug: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_system?: boolean
          name?: string
          slug?: string
        }
        Relationships: []
      }
      service_order_checklist_items: {
        Row: {
          checked: boolean
          checked_at: string | null
          checked_by: string | null
          company_id: string
          created_at: string
          description: string | null
          id: string
          notes: string | null
          required: boolean
          service_order_id: string
          sort_order: number
          title: string
          updated_at: string
        }
        Insert: {
          checked?: boolean
          checked_at?: string | null
          checked_by?: string | null
          company_id: string
          created_at?: string
          description?: string | null
          id?: string
          notes?: string | null
          required?: boolean
          service_order_id: string
          sort_order?: number
          title: string
          updated_at?: string
        }
        Update: {
          checked?: boolean
          checked_at?: string | null
          checked_by?: string | null
          company_id?: string
          created_at?: string
          description?: string | null
          id?: string
          notes?: string | null
          required?: boolean
          service_order_id?: string
          sort_order?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_order_checklist_items_checked_by_fkey"
            columns: ["checked_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_order_checklist_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_order_checklist_items_service_order_id_fkey"
            columns: ["service_order_id"]
            isOneToOne: false
            referencedRelation: "service_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      service_order_checklist_template_items: {
        Row: {
          active: boolean
          company_id: string
          created_at: string
          description: string | null
          id: string
          required: boolean
          sort_order: number
          template_id: string
          title: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          company_id: string
          created_at?: string
          description?: string | null
          id?: string
          required?: boolean
          sort_order?: number
          template_id: string
          title: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          company_id?: string
          created_at?: string
          description?: string | null
          id?: string
          required?: boolean
          sort_order?: number
          template_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_order_checklist_template_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_order_checklist_template_items_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "service_order_checklist_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      service_order_checklist_templates: {
        Row: {
          active: boolean
          company_id: string
          created_at: string
          description: string | null
          id: string
          name: string
          service_type: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          company_id: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
          service_type?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          company_id?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          service_type?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_order_checklist_templates_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      service_order_execution_logs: {
        Row: {
          action: string
          company_id: string
          created_at: string
          id: string
          metadata: Json | null
          new_status: string | null
          notes: string | null
          previous_status: string | null
          service_order_id: string
          user_id: string | null
        }
        Insert: {
          action: string
          company_id: string
          created_at?: string
          id?: string
          metadata?: Json | null
          new_status?: string | null
          notes?: string | null
          previous_status?: string | null
          service_order_id: string
          user_id?: string | null
        }
        Update: {
          action?: string
          company_id?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          new_status?: string | null
          notes?: string | null
          previous_status?: string | null
          service_order_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "service_order_execution_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_order_execution_logs_service_order_id_fkey"
            columns: ["service_order_id"]
            isOneToOne: false
            referencedRelation: "service_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_order_execution_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      service_order_items: {
        Row: {
          company_id: string
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          item_id: string | null
          item_type: string
          name: string
          planned_quantity: number
          position: number
          project_item_id: string | null
          service_order_id: string
          unit: string
          updated_at: string
          used_quantity: number
        }
        Insert: {
          company_id: string
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          item_id?: string | null
          item_type?: string
          name: string
          planned_quantity?: number
          position?: number
          project_item_id?: string | null
          service_order_id: string
          unit?: string
          updated_at?: string
          used_quantity?: number
        }
        Update: {
          company_id?: string
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          item_id?: string | null
          item_type?: string
          name?: string
          planned_quantity?: number
          position?: number
          project_item_id?: string | null
          service_order_id?: string
          unit?: string
          updated_at?: string
          used_quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "service_order_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_order_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_order_items_project_item_id_fkey"
            columns: ["project_item_id"]
            isOneToOne: false
            referencedRelation: "project_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_order_items_service_order_id_fkey"
            columns: ["service_order_id"]
            isOneToOne: false
            referencedRelation: "service_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      service_order_material_usage: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          id: string
          item_id: string
          notes: string | null
          planned_quantity: number
          service_order_id: string
          service_order_item_id: string | null
          stock_location_id: string | null
          stock_warning: boolean
          unit: string | null
          updated_at: string
          used_quantity: number
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          item_id: string
          notes?: string | null
          planned_quantity?: number
          service_order_id: string
          service_order_item_id?: string | null
          stock_location_id?: string | null
          stock_warning?: boolean
          unit?: string | null
          updated_at?: string
          used_quantity?: number
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          item_id?: string
          notes?: string | null
          planned_quantity?: number
          service_order_id?: string
          service_order_item_id?: string | null
          stock_location_id?: string | null
          stock_warning?: boolean
          unit?: string | null
          updated_at?: string
          used_quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "service_order_material_usage_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_order_material_usage_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_order_material_usage_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_order_material_usage_service_order_id_fkey"
            columns: ["service_order_id"]
            isOneToOne: false
            referencedRelation: "service_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_order_material_usage_service_order_item_id_fkey"
            columns: ["service_order_item_id"]
            isOneToOne: false
            referencedRelation: "service_order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_order_material_usage_stock_location_id_fkey"
            columns: ["stock_location_id"]
            isOneToOne: false
            referencedRelation: "stock_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      service_order_number_counters: {
        Row: {
          company_id: string
          current_number: number
          updated_at: string
        }
        Insert: {
          company_id: string
          current_number?: number
          updated_at?: string
        }
        Update: {
          company_id?: string
          current_number?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_order_number_counters_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      service_order_photos: {
        Row: {
          company_id: string
          created_at: string
          description: string | null
          file_name: string
          file_size: number | null
          file_url: string
          id: string
          photo_type: string
          service_order_id: string
          uploaded_by: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          description?: string | null
          file_name: string
          file_size?: number | null
          file_url: string
          id?: string
          photo_type: string
          service_order_id: string
          uploaded_by?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          description?: string | null
          file_name?: string
          file_size?: number | null
          file_url?: string
          id?: string
          photo_type?: string
          service_order_id?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "service_order_photos_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_order_photos_service_order_id_fkey"
            columns: ["service_order_id"]
            isOneToOne: false
            referencedRelation: "service_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_order_photos_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      service_order_report_counters: {
        Row: {
          company_id: string
          current_number: number
          updated_at: string
        }
        Insert: {
          company_id: string
          current_number?: number
          updated_at?: string
        }
        Update: {
          company_id?: string
          current_number?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_order_report_counters_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      service_order_report_send_events: {
        Row: {
          channel: string
          company_id: string
          created_at: string
          id: string
          message: string | null
          recipient_contact: string | null
          recipient_name: string | null
          report_id: string
          sent_at: string
          sent_by: string | null
          service_order_id: string
          status: string
        }
        Insert: {
          channel: string
          company_id: string
          created_at?: string
          id?: string
          message?: string | null
          recipient_contact?: string | null
          recipient_name?: string | null
          report_id: string
          sent_at?: string
          sent_by?: string | null
          service_order_id: string
          status: string
        }
        Update: {
          channel?: string
          company_id?: string
          created_at?: string
          id?: string
          message?: string | null
          recipient_contact?: string | null
          recipient_name?: string | null
          report_id?: string
          sent_at?: string
          sent_by?: string | null
          service_order_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_order_report_send_events_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_order_report_send_events_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "service_order_reports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_order_report_send_events_sent_by_fkey"
            columns: ["sent_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_order_report_send_events_service_order_id_fkey"
            columns: ["service_order_id"]
            isOneToOne: false
            referencedRelation: "service_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      service_order_reports: {
        Row: {
          company_id: string
          created_at: string
          generated_at: string | null
          generated_by: string | null
          id: string
          pdf_file_name: string | null
          pdf_file_url: string | null
          public_token: string | null
          report_number: string
          sent_at: string | null
          sent_by: string | null
          service_order_id: string
          status: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          generated_at?: string | null
          generated_by?: string | null
          id?: string
          pdf_file_name?: string | null
          pdf_file_url?: string | null
          public_token?: string | null
          report_number: string
          sent_at?: string | null
          sent_by?: string | null
          service_order_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          generated_at?: string | null
          generated_by?: string | null
          id?: string
          pdf_file_name?: string | null
          pdf_file_url?: string | null
          public_token?: string | null
          report_number?: string
          sent_at?: string | null
          sent_by?: string | null
          service_order_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_order_reports_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_order_reports_generated_by_fkey"
            columns: ["generated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_order_reports_sent_by_fkey"
            columns: ["sent_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_order_reports_service_order_id_fkey"
            columns: ["service_order_id"]
            isOneToOne: false
            referencedRelation: "service_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      service_order_signatures: {
        Row: {
          company_id: string
          created_at: string
          id: string
          ip_address: string | null
          report_id: string | null
          service_order_id: string
          signature_file_url: string
          signature_type: string
          signed_at: string
          signer_document: string | null
          signer_email: string | null
          signer_name: string
          signer_phone: string | null
          user_agent: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          ip_address?: string | null
          report_id?: string | null
          service_order_id: string
          signature_file_url: string
          signature_type: string
          signed_at?: string
          signer_document?: string | null
          signer_email?: string | null
          signer_name: string
          signer_phone?: string | null
          user_agent?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          ip_address?: string | null
          report_id?: string | null
          service_order_id?: string
          signature_file_url?: string
          signature_type?: string
          signed_at?: string
          signer_document?: string | null
          signer_email?: string | null
          signer_name?: string
          signer_phone?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "service_order_signatures_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_order_signatures_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "service_order_reports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_order_signatures_service_order_id_fkey"
            columns: ["service_order_id"]
            isOneToOne: false
            referencedRelation: "service_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      service_order_stock_deduction_logs: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          error_message: string | null
          id: string
          item_id: string | null
          material_usage_id: string | null
          quantity: number
          service_order_id: string
          status: string
          stock_location_id: string | null
          stock_movement_id: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          error_message?: string | null
          id?: string
          item_id?: string | null
          material_usage_id?: string | null
          quantity?: number
          service_order_id: string
          status: string
          stock_location_id?: string | null
          stock_movement_id?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          error_message?: string | null
          id?: string
          item_id?: string | null
          material_usage_id?: string | null
          quantity?: number
          service_order_id?: string
          status?: string
          stock_location_id?: string | null
          stock_movement_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "service_order_stock_deduction_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_order_stock_deduction_logs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_order_stock_deduction_logs_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_order_stock_deduction_logs_material_usage_id_fkey"
            columns: ["material_usage_id"]
            isOneToOne: false
            referencedRelation: "service_order_material_usage"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_order_stock_deduction_logs_service_order_id_fkey"
            columns: ["service_order_id"]
            isOneToOne: false
            referencedRelation: "service_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_order_stock_deduction_logs_stock_location_id_fkey"
            columns: ["stock_location_id"]
            isOneToOne: false
            referencedRelation: "stock_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_order_stock_deduction_logs_stock_movement_id_fkey"
            columns: ["stock_movement_id"]
            isOneToOne: false
            referencedRelation: "stock_movements"
            referencedColumns: ["id"]
          },
        ]
      }
      service_orders: {
        Row: {
          access_instructions: string | null
          assigned_technician_id: string | null
          cancelled_at: string | null
          company_id: string
          completed_at: string | null
          created_at: string
          created_by: string | null
          customer_absent: boolean
          customer_address_id: string | null
          customer_contact_id: string | null
          customer_id: string
          customer_instructions: string | null
          customer_signed_at: string | null
          deleted_at: string | null
          description: string | null
          execution_completed_by: string | null
          execution_notes: string | null
          execution_started_by: string | null
          final_report_generated_at: string | null
          final_report_sent_at: string | null
          id: string
          internal_notes: string | null
          issue_found: string | null
          opportunity_id: string | null
          parking_instructions: string | null
          pending_reason: string | null
          priority: string
          project_id: string
          quote_id: string | null
          report_status: string
          responsible_user_id: string | null
          scheduled_date: string | null
          scheduled_end_time: string | null
          scheduled_start_time: string | null
          service_order_number: string
          solution_applied: string | null
          started_at: string | null
          status: string
          stock_deducted_at: string | null
          stock_deducted_by: string | null
          stock_deduction_status: string
          technical_notes: string | null
          technician_report: string | null
          title: string
          updated_at: string
        }
        Insert: {
          access_instructions?: string | null
          assigned_technician_id?: string | null
          cancelled_at?: string | null
          company_id: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          customer_absent?: boolean
          customer_address_id?: string | null
          customer_contact_id?: string | null
          customer_id: string
          customer_instructions?: string | null
          customer_signed_at?: string | null
          deleted_at?: string | null
          description?: string | null
          execution_completed_by?: string | null
          execution_notes?: string | null
          execution_started_by?: string | null
          final_report_generated_at?: string | null
          final_report_sent_at?: string | null
          id?: string
          internal_notes?: string | null
          issue_found?: string | null
          opportunity_id?: string | null
          parking_instructions?: string | null
          pending_reason?: string | null
          priority?: string
          project_id: string
          quote_id?: string | null
          report_status?: string
          responsible_user_id?: string | null
          scheduled_date?: string | null
          scheduled_end_time?: string | null
          scheduled_start_time?: string | null
          service_order_number: string
          solution_applied?: string | null
          started_at?: string | null
          status?: string
          stock_deducted_at?: string | null
          stock_deducted_by?: string | null
          stock_deduction_status?: string
          technical_notes?: string | null
          technician_report?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          access_instructions?: string | null
          assigned_technician_id?: string | null
          cancelled_at?: string | null
          company_id?: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          customer_absent?: boolean
          customer_address_id?: string | null
          customer_contact_id?: string | null
          customer_id?: string
          customer_instructions?: string | null
          customer_signed_at?: string | null
          deleted_at?: string | null
          description?: string | null
          execution_completed_by?: string | null
          execution_notes?: string | null
          execution_started_by?: string | null
          final_report_generated_at?: string | null
          final_report_sent_at?: string | null
          id?: string
          internal_notes?: string | null
          issue_found?: string | null
          opportunity_id?: string | null
          parking_instructions?: string | null
          pending_reason?: string | null
          priority?: string
          project_id?: string
          quote_id?: string | null
          report_status?: string
          responsible_user_id?: string | null
          scheduled_date?: string | null
          scheduled_end_time?: string | null
          scheduled_start_time?: string | null
          service_order_number?: string
          solution_applied?: string | null
          started_at?: string | null
          status?: string
          stock_deducted_at?: string | null
          stock_deducted_by?: string | null
          stock_deduction_status?: string
          technical_notes?: string | null
          technician_report?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_orders_assigned_technician_id_fkey"
            columns: ["assigned_technician_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_orders_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_orders_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_orders_customer_address_id_fkey"
            columns: ["customer_address_id"]
            isOneToOne: false
            referencedRelation: "customer_addresses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_orders_customer_contact_id_fkey"
            columns: ["customer_contact_id"]
            isOneToOne: false
            referencedRelation: "customer_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_orders_execution_completed_by_fkey"
            columns: ["execution_completed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_orders_execution_started_by_fkey"
            columns: ["execution_started_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_orders_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "crm_opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_orders_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_orders_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_orders_responsible_user_id_fkey"
            columns: ["responsible_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_orders_stock_deducted_by_fkey"
            columns: ["stock_deducted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_balances: {
        Row: {
          company_id: string
          id: string
          item_id: string
          location_id: string
          quantity: number
          updated_at: string
        }
        Insert: {
          company_id: string
          id?: string
          item_id: string
          location_id: string
          quantity?: number
          updated_at?: string
        }
        Update: {
          company_id?: string
          id?: string
          item_id?: string
          location_id?: string
          quantity?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_balances_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_balances_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_balances_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "stock_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_locations: {
        Row: {
          active: boolean
          company_id: string
          created_at: string
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          company_id: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          company_id?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_locations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_movements: {
        Row: {
          company_id: string
          created_at: string
          id: string
          item_id: string
          location_id: string
          movement_type: Database["public"]["Enums"]["stock_movement_type"]
          new_balance: number
          notes: string | null
          previous_balance: number
          quantity: number
          reason: string | null
          reference_id: string | null
          reference_type: string | null
          related_movement_id: string | null
          user_id: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          item_id: string
          location_id: string
          movement_type: Database["public"]["Enums"]["stock_movement_type"]
          new_balance?: number
          notes?: string | null
          previous_balance?: number
          quantity: number
          reason?: string | null
          reference_id?: string | null
          reference_type?: string | null
          related_movement_id?: string | null
          user_id?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          item_id?: string
          location_id?: string
          movement_type?: Database["public"]["Enums"]["stock_movement_type"]
          new_balance?: number
          notes?: string | null
          previous_balance?: number
          quantity?: number
          reason?: string | null
          reference_id?: string | null
          reference_type?: string | null
          related_movement_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "stock_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_related_movement_id_fkey"
            columns: ["related_movement_id"]
            isOneToOne: false
            referencedRelation: "stock_movements"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_events: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          description: string | null
          event_type: string
          id: string
          metadata: Json
          new_plan_id: string | null
          new_status: string | null
          previous_plan_id: string | null
          previous_status: string | null
          subscription_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          event_type: string
          id?: string
          metadata?: Json
          new_plan_id?: string | null
          new_status?: string | null
          previous_plan_id?: string | null
          previous_status?: string | null
          subscription_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          event_type?: string
          id?: string
          metadata?: Json
          new_plan_id?: string | null
          new_status?: string | null
          previous_plan_id?: string | null
          previous_status?: string | null
          subscription_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_events_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_events_new_plan_id_fkey"
            columns: ["new_plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_events_previous_plan_id_fkey"
            columns: ["previous_plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_events_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_usage: {
        Row: {
          company_id: string
          created_at: string
          id: string
          imports_used_count: number
          ocr_used_count: number
          period_end: string
          period_start: string
          service_orders_count: number
          storage_used_mb: number
          subscription_id: string
          updated_at: string
          users_count: number
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          imports_used_count?: number
          ocr_used_count?: number
          period_end: string
          period_start: string
          service_orders_count?: number
          storage_used_mb?: number
          subscription_id: string
          updated_at?: string
          users_count?: number
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          imports_used_count?: number
          ocr_used_count?: number
          period_end?: string
          period_start?: string
          service_orders_count?: number
          storage_used_mb?: number
          subscription_id?: string
          updated_at?: string
          users_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "subscription_usage_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_usage_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          activated_at: string | null
          active: boolean
          billing_cycle: string
          cancel_at_period_end: boolean
          canceled_at: string | null
          canceled_by: string | null
          cancellation_effective_at: string | null
          cancellation_reason: string | null
          cancellation_scheduled_at: string | null
          company_id: string
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          expiration_date: string | null
          grace_period_ends_at: string | null
          id: string
          metadata: Json
          monthly_price: number | null
          next_billing_date: string | null
          payment_provider: string | null
          pending_plan_billing_cycle: string | null
          pending_plan_change_at: string | null
          pending_plan_change_type: string | null
          pending_plan_id: string | null
          pending_plan_requested_at: string | null
          pending_plan_requested_by: string | null
          plan_id: string
          provider_customer_id: string | null
          provider_subscription_id: string | null
          start_date: string
          status: string
          suspended_at: string | null
          trial: boolean
          trial_ends_at: string | null
          trial_starts_at: string | null
          updated_at: string
          yearly_price: number | null
        }
        Insert: {
          activated_at?: string | null
          active?: boolean
          billing_cycle?: string
          cancel_at_period_end?: boolean
          canceled_at?: string | null
          canceled_by?: string | null
          cancellation_effective_at?: string | null
          cancellation_reason?: string | null
          cancellation_scheduled_at?: string | null
          company_id: string
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          expiration_date?: string | null
          grace_period_ends_at?: string | null
          id?: string
          metadata?: Json
          monthly_price?: number | null
          next_billing_date?: string | null
          payment_provider?: string | null
          pending_plan_billing_cycle?: string | null
          pending_plan_change_at?: string | null
          pending_plan_change_type?: string | null
          pending_plan_id?: string | null
          pending_plan_requested_at?: string | null
          pending_plan_requested_by?: string | null
          plan_id: string
          provider_customer_id?: string | null
          provider_subscription_id?: string | null
          start_date?: string
          status?: string
          suspended_at?: string | null
          trial?: boolean
          trial_ends_at?: string | null
          trial_starts_at?: string | null
          updated_at?: string
          yearly_price?: number | null
        }
        Update: {
          activated_at?: string | null
          active?: boolean
          billing_cycle?: string
          cancel_at_period_end?: boolean
          canceled_at?: string | null
          canceled_by?: string | null
          cancellation_effective_at?: string | null
          cancellation_reason?: string | null
          cancellation_scheduled_at?: string | null
          company_id?: string
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          expiration_date?: string | null
          grace_period_ends_at?: string | null
          id?: string
          metadata?: Json
          monthly_price?: number | null
          next_billing_date?: string | null
          payment_provider?: string | null
          pending_plan_billing_cycle?: string | null
          pending_plan_change_at?: string | null
          pending_plan_change_type?: string | null
          pending_plan_id?: string | null
          pending_plan_requested_at?: string | null
          pending_plan_requested_by?: string | null
          plan_id?: string
          provider_customer_id?: string | null
          provider_subscription_id?: string | null
          start_date?: string
          status?: string
          suspended_at?: string | null
          trial?: boolean
          trial_ends_at?: string | null
          trial_starts_at?: string | null
          updated_at?: string
          yearly_price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_pending_plan_id_fkey"
            columns: ["pending_plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_import_jobs: {
        Row: {
          column_mapping: Json | null
          company_id: string
          completed_at: string | null
          created_at: string
          created_by: string
          created_rows: number
          error_message: string | null
          file_name: string
          file_url: string | null
          id: string
          invalid_rows: number
          skipped_rows: number
          status: string
          total_rows: number
          updated_at: string
          updated_rows: number
          valid_rows: number
        }
        Insert: {
          column_mapping?: Json | null
          company_id: string
          completed_at?: string | null
          created_at?: string
          created_by: string
          created_rows?: number
          error_message?: string | null
          file_name: string
          file_url?: string | null
          id?: string
          invalid_rows?: number
          skipped_rows?: number
          status?: string
          total_rows?: number
          updated_at?: string
          updated_rows?: number
          valid_rows?: number
        }
        Update: {
          column_mapping?: Json | null
          company_id?: string
          completed_at?: string | null
          created_at?: string
          created_by?: string
          created_rows?: number
          error_message?: string | null
          file_name?: string
          file_url?: string | null
          id?: string
          invalid_rows?: number
          skipped_rows?: number
          status?: string
          total_rows?: number
          updated_at?: string
          updated_rows?: number
          valid_rows?: number
        }
        Relationships: [
          {
            foreignKeyName: "supplier_import_jobs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_import_rows: {
        Row: {
          action: string
          company_id: string
          created_at: string
          id: string
          import_job_id: string
          mapped_data: Json | null
          matched_supplier_id: string | null
          raw_data: Json
          row_number: number
          status: string
          updated_at: string
          validation_errors: Json | null
        }
        Insert: {
          action?: string
          company_id: string
          created_at?: string
          id?: string
          import_job_id: string
          mapped_data?: Json | null
          matched_supplier_id?: string | null
          raw_data: Json
          row_number: number
          status?: string
          updated_at?: string
          validation_errors?: Json | null
        }
        Update: {
          action?: string
          company_id?: string
          created_at?: string
          id?: string
          import_job_id?: string
          mapped_data?: Json | null
          matched_supplier_id?: string | null
          raw_data?: Json
          row_number?: number
          status?: string
          updated_at?: string
          validation_errors?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "supplier_import_rows_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_import_rows_import_job_id_fkey"
            columns: ["import_job_id"]
            isOneToOne: false
            referencedRelation: "supplier_import_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_import_rows_matched_supplier_id_fkey"
            columns: ["matched_supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          active: boolean
          address: string | null
          city: string | null
          company_id: string
          complement: string | null
          corporate_name: string
          cpf_cnpj: string
          created_at: string
          deleted_at: string | null
          district: string | null
          email: string | null
          id: string
          notes: string | null
          number: string | null
          phone: string | null
          state: string | null
          trade_name: string | null
          updated_at: string
          website: string | null
          whatsapp: string | null
          zipcode: string | null
        }
        Insert: {
          active?: boolean
          address?: string | null
          city?: string | null
          company_id: string
          complement?: string | null
          corporate_name: string
          cpf_cnpj: string
          created_at?: string
          deleted_at?: string | null
          district?: string | null
          email?: string | null
          id?: string
          notes?: string | null
          number?: string | null
          phone?: string | null
          state?: string | null
          trade_name?: string | null
          updated_at?: string
          website?: string | null
          whatsapp?: string | null
          zipcode?: string | null
        }
        Update: {
          active?: boolean
          address?: string | null
          city?: string | null
          company_id?: string
          complement?: string | null
          corporate_name?: string
          cpf_cnpj?: string
          created_at?: string
          deleted_at?: string | null
          district?: string | null
          email?: string | null
          id?: string
          notes?: string | null
          number?: string | null
          phone?: string | null
          state?: string | null
          trade_name?: string | null
          updated_at?: string
          website?: string | null
          whatsapp?: string | null
          zipcode?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      user_invitations: {
        Row: {
          accepted_at: string | null
          company_id: string
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string | null
          role: Database["public"]["Enums"]["app_role"]
          status: Database["public"]["Enums"]["invitation_status"]
          token: string
        }
        Insert: {
          accepted_at?: string | null
          company_id: string
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          status?: Database["public"]["Enums"]["invitation_status"]
          token?: string
        }
        Update: {
          accepted_at?: string | null
          company_id?: string
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          status?: Database["public"]["Enums"]["invitation_status"]
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_invitations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      user_onboarding_progress: {
        Row: {
          company_id: string
          completed_at: string | null
          created_at: string
          current_step: number
          id: string
          skipped_at: string | null
          status: string
          tour_key: string
          updated_at: string
          user_id: string
        }
        Insert: {
          company_id: string
          completed_at?: string | null
          created_at?: string
          current_step?: number
          id?: string
          skipped_at?: string | null
          status?: string
          tour_key: string
          updated_at?: string
          user_id: string
        }
        Update: {
          company_id?: string
          completed_at?: string | null
          created_at?: string
          current_step?: number
          id?: string
          skipped_at?: string | null
          status?: string
          tour_key?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_onboarding_progress_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          company_id: string | null
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      billing_provider_settings_public: {
        Row: {
          active: boolean | null
          environment: string | null
          id: string | null
          privacy_policy_url: string | null
          provider: string | null
          support_email: string | null
          support_whatsapp: string | null
          terms_of_use_url: string | null
        }
        Insert: {
          active?: boolean | null
          environment?: string | null
          id?: string | null
          privacy_policy_url?: string | null
          provider?: string | null
          support_email?: string | null
          support_whatsapp?: string | null
          terms_of_use_url?: string | null
        }
        Update: {
          active?: boolean | null
          environment?: string | null
          id?: string | null
          privacy_policy_url?: string | null
          provider?: string | null
          support_email?: string | null
          support_whatsapp?: string | null
          terms_of_use_url?: string | null
        }
        Relationships: []
      }
      subscription_commercial_history: {
        Row: {
          actor_name: string | null
          actor_type: string | null
          amount: number | null
          company_id: string | null
          description: string | null
          event_date: string | null
          event_type: string | null
          id: string | null
          source: string | null
          subscription_id: string | null
          title: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      _po_expense_category: { Args: { _company: string }; Returns: string }
      accept_invitation: { Args: { _token: string }; Returns: string }
      accept_public_quote: {
        Args: { _document?: string; _name: string; _token: string }
        Returns: Json
      }
      add_project_team_member: {
        Args: { _project_id: string; _role?: string; _user_id: string }
        Returns: string
      }
      admin_companies_overview: {
        Args: never
        Returns: {
          cnpj: string
          corporate_name: string
          created_at: string
          id: string
          last_paid_at: string
          next_billing_date: string
          plan_id: string
          plan_name: string
          plan_slug: string
          status: Database["public"]["Enums"]["company_status"]
          subscription_active: boolean
          subscription_expires: string
          subscription_id: string
          subscription_status: string
          subscription_trial: boolean
          trade_name: string
          trial_ends_at: string
          users_count: number
        }[]
      }
      admin_list_subscription_events: {
        Args: { _subscription_id: string }
        Returns: {
          company_id: string
          created_at: string
          created_by: string | null
          description: string | null
          event_type: string
          id: string
          metadata: Json
          new_plan_id: string | null
          new_status: string | null
          previous_plan_id: string | null
          previous_status: string | null
          subscription_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "subscription_events"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      admin_list_subscriptions: {
        Args: { _search?: string; _status?: string }
        Returns: {
          billing_cycle: string
          canceled_at: string
          company_id: string
          company_name: string
          created_at: string
          current_period_end: string
          grace_period_ends_at: string
          id: string
          monthly_price: number
          next_billing_date: string
          plan_id: string
          plan_name: string
          plan_slug: string
          status: string
          trial_ends_at: string
          yearly_price: number
        }[]
      }
      admin_set_company_status: {
        Args: {
          _company_id: string
          _status: Database["public"]["Enums"]["company_status"]
        }
        Returns: undefined
      }
      admin_update_subscription: {
        Args: {
          _description?: string
          _extend_grace_days?: number
          _extend_trial_days?: number
          _new_billing_cycle?: string
          _new_plan_id?: string
          _new_status?: string
          _subscription_id: string
        }
        Returns: string
      }
      apply_stock_movement: {
        Args: {
          _final_quantity?: number
          _item_id: string
          _location_id: string
          _movement_type: Database["public"]["Enums"]["stock_movement_type"]
          _notes?: string
          _quantity: number
          _reason?: string
          _related_movement_id?: string
        }
        Returns: string
      }
      approve_quote_payment: {
        Args: { _note?: string; _payment_id: string }
        Returns: undefined
      }
      can_access_service_order: { Args: { _so_id: string }; Returns: boolean }
      cancel_purchase_order_finance: {
        Args: { _po_id: string }
        Returns: number
      }
      cancel_quote_payment: {
        Args: { _payment_id: string; _reason?: string }
        Returns: Json
      }
      cancel_service_order: {
        Args: { _id: string; _reason?: string }
        Returns: undefined
      }
      check_project_materials: { Args: { _project_id: string }; Returns: Json }
      cleanup_public_rate_limits: { Args: never; Returns: number }
      confirm_nota_receiving: {
        Args: {
          _doc_id: string
          _location_id: string
          _notes?: string
          _supplier_id?: string
        }
        Returns: Json
      }
      convert_quote_to_project: {
        Args: { _quote_id: string; _responsible_user_id?: string }
        Returns: string
      }
      create_project_from_quote: {
        Args: { _quote_id: string }
        Returns: string
      }
      create_service_order_from_project: {
        Args: { _assigned_technician_id?: string; _project_id: string }
        Returns: string
      }
      crm_seed_default_pipeline: {
        Args: { _company_id: string }
        Returns: string
      }
      current_company_id: { Args: never; Returns: string }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      email_queue_dispatch: { Args: never; Returns: undefined }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      expire_trials_and_subscriptions: {
        Args: { p_grace_days?: number }
        Returns: {
          action: string
          company_id: string
          new_status: string
          subscription_id: string
        }[]
      }
      generate_smart_service_order_checklist: {
        Args: { _so_id: string }
        Returns: number
      }
      get_my_features: { Args: never; Returns: string[] }
      get_my_permissions: { Args: never; Returns: string[] }
      get_pilot_activation: { Args: { _company_id: string }; Returns: Json }
      get_public_quote_by_token: { Args: { _token: string }; Returns: Json }
      get_public_so_report: { Args: { _token: string }; Returns: Json }
      has_company_role:
        | {
            Args: { _role: Database["public"]["Enums"]["app_role"] }
            Returns: boolean
          }
        | {
            Args: {
              _company_id: string
              _role: Database["public"]["Enums"]["app_role"]
            }
            Returns: boolean
          }
      has_feature: { Args: { _code: string }; Returns: boolean }
      has_permission: { Args: { _slug: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_company_member: { Args: { _company_id: string }; Returns: boolean }
      is_super_admin: { Args: never; Returns: boolean }
      log_activity: { Args: { _description: string }; Returns: string }
      log_audit: {
        Args: {
          _action: string
          _module: string
          _new_data?: Json
          _old_data?: Json
          _record_id?: string
        }
        Returns: string
      }
      mark_project_ready_for_os: {
        Args: { _force?: boolean; _project_id: string }
        Returns: undefined
      }
      mark_purchase_order_paid: {
        Args: {
          _bank_account_id?: string
          _notes?: string
          _paid_at?: string
          _payment_method?: string
          _po_id: string
        }
        Returns: string
      }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      next_project_number: { Args: { _company_id: string }; Returns: string }
      next_quote_number: { Args: { _company_id: string }; Returns: string }
      next_service_order_number: {
        Args: { _company_id: string }
        Returns: string
      }
      next_so_report_number: { Args: { _company_id: string }; Returns: string }
      notify_user: {
        Args: {
          _company_id: string
          _message?: string
          _title: string
          _user_id: string
        }
        Returns: string
      }
      process_billing_dunning_rules: {
        Args: never
        Returns: {
          inserted_count: number
          rule_code: string
        }[]
      }
      process_pending_cancellations: { Args: never; Returns: number }
      process_pending_plan_changes: { Args: never; Returns: number }
      quote_recalc_totals: { Args: { _quote_id: string }; Returns: undefined }
      quotes_mark_expired: { Args: never; Returns: number }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      receive_purchase_order: {
        Args: {
          _items: Json
          _location_id: string
          _notes?: string
          _po_id: string
        }
        Returns: Json
      }
      register_dunning_contact: {
        Args: {
          _channel: string
          _event_id: string
          _message: string
          _next_follow_up_at: string
          _result: string
        }
        Returns: string
      }
      register_public_quote_view: {
        Args: { _token: string }
        Returns: undefined
      }
      reject_quote_payment_receipt: {
        Args: { _payment_id: string; _reason?: string }
        Returns: undefined
      }
      remove_project_team_member: { Args: { _id: string }; Returns: undefined }
      resync_quote_payment: {
        Args: { _payment_id: string }
        Returns: undefined
      }
      rollback_public_quote_receipt: {
        Args: { _payment_id: string }
        Returns: undefined
      }
      seed_default_financial_categories: {
        Args: { _company_id: string }
        Returns: undefined
      }
      service_order_execute_transition: {
        Args: {
          _action: string
          _issue_found?: string
          _reason?: string
          _so_id: string
          _solution_applied?: string
          _technician_report?: string
        }
        Returns: {
          access_instructions: string | null
          assigned_technician_id: string | null
          cancelled_at: string | null
          company_id: string
          completed_at: string | null
          created_at: string
          created_by: string | null
          customer_absent: boolean
          customer_address_id: string | null
          customer_contact_id: string | null
          customer_id: string
          customer_instructions: string | null
          customer_signed_at: string | null
          deleted_at: string | null
          description: string | null
          execution_completed_by: string | null
          execution_notes: string | null
          execution_started_by: string | null
          final_report_generated_at: string | null
          final_report_sent_at: string | null
          id: string
          internal_notes: string | null
          issue_found: string | null
          opportunity_id: string | null
          parking_instructions: string | null
          pending_reason: string | null
          priority: string
          project_id: string
          quote_id: string | null
          report_status: string
          responsible_user_id: string | null
          scheduled_date: string | null
          scheduled_end_time: string | null
          scheduled_start_time: string | null
          service_order_number: string
          solution_applied: string | null
          started_at: string | null
          status: string
          stock_deducted_at: string | null
          stock_deducted_by: string | null
          stock_deduction_status: string
          technical_notes: string | null
          technician_report: string | null
          title: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "service_orders"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      so_attach_report_pdf: {
        Args: { _pdf_name: string; _pdf_path: string; _report_id: string }
        Returns: {
          company_id: string
          created_at: string
          generated_at: string | null
          generated_by: string | null
          id: string
          pdf_file_name: string | null
          pdf_file_url: string | null
          public_token: string | null
          report_number: string
          sent_at: string | null
          sent_by: string | null
          service_order_id: string
          status: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "service_order_reports"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      so_can_mutate_execution: { Args: { _so_id: string }; Returns: boolean }
      so_check_stock: {
        Args: { _item_id: string; _location_id: string }
        Returns: number
      }
      so_checklist_add_item: {
        Args: {
          _description?: string
          _required?: boolean
          _so_id: string
          _title: string
        }
        Returns: {
          checked: boolean
          checked_at: string | null
          checked_by: string | null
          company_id: string
          created_at: string
          description: string | null
          id: string
          notes: string | null
          required: boolean
          service_order_id: string
          sort_order: number
          title: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "service_order_checklist_items"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      so_checklist_toggle: {
        Args: { _checked: boolean; _item_id: string; _notes?: string }
        Returns: {
          checked: boolean
          checked_at: string | null
          checked_by: string | null
          company_id: string
          created_at: string
          description: string | null
          id: string
          notes: string | null
          required: boolean
          service_order_id: string
          sort_order: number
          title: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "service_order_checklist_items"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      so_collect_signature: {
        Args: {
          _ip_address?: string
          _signature_file_url: string
          _signature_type: string
          _signer_document?: string
          _signer_email?: string
          _signer_name: string
          _signer_phone?: string
          _so_id: string
          _user_agent?: string
        }
        Returns: {
          company_id: string
          created_at: string
          id: string
          ip_address: string | null
          report_id: string | null
          service_order_id: string
          signature_file_url: string
          signature_type: string
          signed_at: string
          signer_document: string | null
          signer_email: string | null
          signer_name: string
          signer_phone: string | null
          user_agent: string | null
        }
        SetofOptions: {
          from: "*"
          to: "service_order_signatures"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      so_deduct_stock: { Args: { _so_id: string }; Returns: Json }
      so_generate_final_report: {
        Args: { _service_order_id: string }
        Returns: {
          company_id: string
          created_at: string
          generated_at: string | null
          generated_by: string | null
          id: string
          pdf_file_name: string | null
          pdf_file_url: string | null
          public_token: string | null
          report_number: string
          sent_at: string | null
          sent_by: string | null
          service_order_id: string
          status: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "service_order_reports"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      so_log_report_send: {
        Args: {
          _channel: string
          _message?: string
          _recipient_contact?: string
          _recipient_name?: string
          _report_id: string
          _status: string
        }
        Returns: {
          channel: string
          company_id: string
          created_at: string
          id: string
          message: string | null
          recipient_contact: string | null
          recipient_name: string | null
          report_id: string
          sent_at: string
          sent_by: string | null
          service_order_id: string
          status: string
        }
        SetofOptions: {
          from: "*"
          to: "service_order_report_send_events"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      so_material_add: {
        Args: {
          _item_id: string
          _location_id: string
          _notes?: string
          _so_id: string
          _so_item_id?: string
          _used_quantity: number
        }
        Returns: {
          company_id: string
          created_at: string
          created_by: string | null
          id: string
          item_id: string
          notes: string | null
          planned_quantity: number
          service_order_id: string
          service_order_item_id: string | null
          stock_location_id: string | null
          stock_warning: boolean
          unit: string | null
          updated_at: string
          used_quantity: number
        }
        SetofOptions: {
          from: "*"
          to: "service_order_material_usage"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      so_material_update: {
        Args: {
          _id: string
          _location_id?: string
          _notes?: string
          _used_quantity: number
        }
        Returns: {
          company_id: string
          created_at: string
          created_by: string | null
          id: string
          item_id: string
          notes: string | null
          planned_quantity: number
          service_order_id: string
          service_order_item_id: string | null
          stock_location_id: string | null
          stock_warning: boolean
          unit: string | null
          updated_at: string
          used_quantity: number
        }
        SetofOptions: {
          from: "*"
          to: "service_order_material_usage"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      so_pending_required_checklist: {
        Args: { _so_id: string }
        Returns: {
          checked: boolean
          checked_at: string | null
          checked_by: string | null
          company_id: string
          created_at: string
          description: string | null
          id: string
          notes: string | null
          required: boolean
          service_order_id: string
          sort_order: number
          title: string
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "service_order_checklist_items"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      so_photo_delete: { Args: { _photo_id: string }; Returns: string }
      so_photo_register: {
        Args: {
          _description?: string
          _file_name: string
          _file_size?: number
          _file_url: string
          _photo_type: string
          _so_id: string
        }
        Returns: {
          company_id: string
          created_at: string
          description: string | null
          file_name: string
          file_size: number | null
          file_url: string
          id: string
          photo_type: string
          service_order_id: string
          uploaded_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "service_order_photos"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      submit_public_quote_receipt: {
        Args: {
          _amount: number
          _ext: string
          _mime: string
          _payer_name: string
          _payment_date: string
          _payment_method: string
          _size: number
          _token: string
        }
        Returns: {
          payment_id: string
          upload_path: string
        }[]
      }
      sync_purchase_order_to_finance: {
        Args: { _po_id: string }
        Returns: string
      }
      transfer_stock: {
        Args: {
          _from_location: string
          _item_id: string
          _notes?: string
          _quantity: number
          _to_location: string
        }
        Returns: Json
      }
      try_consume_rate_limit: {
        Args: { _bucket: string; _limit: number; _window_seconds: number }
        Returns: {
          allowed: boolean
          remaining: number
          retry_after_sec: number
        }[]
      }
      update_project_planning: {
        Args: {
          _access_instructions?: string
          _clear_responsible?: boolean
          _customer_instructions?: string
          _id: string
          _operational_notes?: string
          _parking_instructions?: string
          _planned_end_date?: string
          _planned_end_time?: string
          _planned_start_date?: string
          _planned_start_time?: string
          _priority?: string
          _responsible_user_id?: string
        }
        Returns: undefined
      }
      validate_public_quote_image_paths: {
        Args: { _paths: string[]; _token: string }
        Returns: string[]
      }
    }
    Enums: {
      app_role:
        | "super_admin"
        | "owner"
        | "manager"
        | "financial"
        | "commercial"
        | "stock"
        | "technician"
      category_type: "PRODUCT" | "SERVICE" | "BOTH"
      company_status: "active" | "inactive" | "trial" | "blocked"
      crm_activity_status: "pending" | "completed" | "overdue" | "cancelled"
      crm_activity_type:
        | "call"
        | "whatsapp"
        | "email"
        | "visit"
        | "meeting"
        | "proposal_sent"
        | "follow_up"
        | "maintenance"
        | "commercial_return"
        | "internal_task"
        | "other"
      crm_customer_type:
        | "residencial"
        | "empresa"
        | "condominio"
        | "comercio"
        | "industria"
        | "outro"
      crm_lead_type: "pf" | "pj"
      crm_priority: "low" | "medium" | "high" | "urgent"
      crm_source:
        | "whatsapp"
        | "instagram"
        | "indicacao"
        | "site"
        | "cliente_antigo"
        | "google"
        | "prospeccao"
        | "outro"
      crm_stage_type: "open" | "won" | "lost" | "archived"
      crm_temperature: "cold" | "warm" | "hot" | "urgent"
      customer_address_type: "BILLING" | "INSTALLATION" | "DELIVERY" | "OTHER"
      customer_history_type:
        | "NOTE"
        | "CALL"
        | "WHATSAPP"
        | "EMAIL"
        | "MEETING"
        | "SYSTEM"
      customer_status: "LEAD" | "ACTIVE" | "INACTIVE" | "BLOCKED"
      customer_type: "INDIVIDUAL" | "COMPANY"
      invitation_status: "pending" | "accepted" | "expired" | "revoked"
      item_type: "PRODUCT" | "SERVICE"
      nota_document_status:
        | "UPLOADED"
        | "PROCESSING"
        | "PARSED"
        | "REVIEWED"
        | "CONFIRMED"
        | "FAILED"
        | "CANCELLED"
      nota_item_status: "PENDING" | "MATCHED" | "NEW" | "IGNORED"
      product_unit: "UN" | "CX" | "MT" | "M2" | "M3" | "RL" | "KIT"
      purchase_order_status:
        | "DRAFT"
        | "PENDING"
        | "APPROVED"
        | "PARTIALLY_RECEIVED"
        | "RECEIVED"
        | "CANCELLED"
      quote_item_kind: "PRODUCT" | "SERVICE" | "LABOR" | "OTHER"
      quote_status:
        | "DRAFT"
        | "SENT"
        | "VIEWED"
        | "APPROVED"
        | "REJECTED"
        | "CANCELLED"
        | "EXPIRED"
      stock_movement_type:
        | "ENTRY"
        | "EXIT"
        | "ADJUSTMENT"
        | "TRANSFER_IN"
        | "TRANSFER_OUT"
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
      app_role: [
        "super_admin",
        "owner",
        "manager",
        "financial",
        "commercial",
        "stock",
        "technician",
      ],
      category_type: ["PRODUCT", "SERVICE", "BOTH"],
      company_status: ["active", "inactive", "trial", "blocked"],
      crm_activity_status: ["pending", "completed", "overdue", "cancelled"],
      crm_activity_type: [
        "call",
        "whatsapp",
        "email",
        "visit",
        "meeting",
        "proposal_sent",
        "follow_up",
        "maintenance",
        "commercial_return",
        "internal_task",
        "other",
      ],
      crm_customer_type: [
        "residencial",
        "empresa",
        "condominio",
        "comercio",
        "industria",
        "outro",
      ],
      crm_lead_type: ["pf", "pj"],
      crm_priority: ["low", "medium", "high", "urgent"],
      crm_source: [
        "whatsapp",
        "instagram",
        "indicacao",
        "site",
        "cliente_antigo",
        "google",
        "prospeccao",
        "outro",
      ],
      crm_stage_type: ["open", "won", "lost", "archived"],
      crm_temperature: ["cold", "warm", "hot", "urgent"],
      customer_address_type: ["BILLING", "INSTALLATION", "DELIVERY", "OTHER"],
      customer_history_type: [
        "NOTE",
        "CALL",
        "WHATSAPP",
        "EMAIL",
        "MEETING",
        "SYSTEM",
      ],
      customer_status: ["LEAD", "ACTIVE", "INACTIVE", "BLOCKED"],
      customer_type: ["INDIVIDUAL", "COMPANY"],
      invitation_status: ["pending", "accepted", "expired", "revoked"],
      item_type: ["PRODUCT", "SERVICE"],
      nota_document_status: [
        "UPLOADED",
        "PROCESSING",
        "PARSED",
        "REVIEWED",
        "CONFIRMED",
        "FAILED",
        "CANCELLED",
      ],
      nota_item_status: ["PENDING", "MATCHED", "NEW", "IGNORED"],
      product_unit: ["UN", "CX", "MT", "M2", "M3", "RL", "KIT"],
      purchase_order_status: [
        "DRAFT",
        "PENDING",
        "APPROVED",
        "PARTIALLY_RECEIVED",
        "RECEIVED",
        "CANCELLED",
      ],
      quote_item_kind: ["PRODUCT", "SERVICE", "LABOR", "OTHER"],
      quote_status: [
        "DRAFT",
        "SENT",
        "VIEWED",
        "APPROVED",
        "REJECTED",
        "CANCELLED",
        "EXPIRED",
      ],
      stock_movement_type: [
        "ENTRY",
        "EXIT",
        "ADJUSTMENT",
        "TRANSFER_IN",
        "TRANSFER_OUT",
      ],
    },
  },
} as const
