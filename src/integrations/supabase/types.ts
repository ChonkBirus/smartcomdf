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
      companies: {
        Row: {
          cnpj: string | null
          corporate_name: string
          created_at: string
          email: string | null
          id: string
          logo_url: string | null
          phone: string | null
          plan_id: string | null
          status: Database["public"]["Enums"]["company_status"]
          trade_name: string | null
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          cnpj?: string | null
          corporate_name: string
          created_at?: string
          email?: string | null
          id?: string
          logo_url?: string | null
          phone?: string | null
          plan_id?: string | null
          status?: Database["public"]["Enums"]["company_status"]
          trade_name?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          cnpj?: string | null
          corporate_name?: string
          created_at?: string
          email?: string | null
          id?: string
          logo_url?: string | null
          phone?: string | null
          plan_id?: string | null
          status?: Database["public"]["Enums"]["company_status"]
          trade_name?: string | null
          updated_at?: string
          whatsapp?: string | null
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
      plans: {
        Row: {
          active: boolean
          annual_price: number
          created_at: string
          id: string
          max_customers: number
          max_products: number
          max_service_orders: number
          max_storage_gb: number
          max_users: number
          monthly_price: number
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          annual_price?: number
          created_at?: string
          id?: string
          max_customers?: number
          max_products?: number
          max_service_orders?: number
          max_storage_gb?: number
          max_users?: number
          monthly_price?: number
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          annual_price?: number
          created_at?: string
          id?: string
          max_customers?: number
          max_products?: number
          max_service_orders?: number
          max_storage_gb?: number
          max_users?: number
          monthly_price?: number
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
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
      projects: {
        Row: {
          cancelled_at: string | null
          company_id: string
          completed_at: string | null
          completion_estimate: string | null
          created_at: string
          created_by: string | null
          customer_address_id: string | null
          customer_contact_id: string | null
          customer_id: string
          deleted_at: string | null
          description: string | null
          down_payment_amount: number
          expected_end_date: string | null
          expected_start_date: string | null
          id: string
          internal_notes: string | null
          notes: string | null
          priority: string
          project_number: string
          quote_id: string | null
          remaining_amount: number
          started_at: string | null
          status: string
          title: string
          total_amount: number
          updated_at: string
        }
        Insert: {
          cancelled_at?: string | null
          company_id: string
          completed_at?: string | null
          completion_estimate?: string | null
          created_at?: string
          created_by?: string | null
          customer_address_id?: string | null
          customer_contact_id?: string | null
          customer_id: string
          deleted_at?: string | null
          description?: string | null
          down_payment_amount?: number
          expected_end_date?: string | null
          expected_start_date?: string | null
          id?: string
          internal_notes?: string | null
          notes?: string | null
          priority?: string
          project_number: string
          quote_id?: string | null
          remaining_amount?: number
          started_at?: string | null
          status?: string
          title: string
          total_amount?: number
          updated_at?: string
        }
        Update: {
          cancelled_at?: string | null
          company_id?: string
          completed_at?: string | null
          completion_estimate?: string | null
          created_at?: string
          created_by?: string | null
          customer_address_id?: string | null
          customer_contact_id?: string | null
          customer_id?: string
          deleted_at?: string | null
          description?: string | null
          down_payment_amount?: number
          expected_end_date?: string | null
          expected_start_date?: string | null
          id?: string
          internal_notes?: string | null
          notes?: string | null
          priority?: string
          project_number?: string
          quote_id?: string | null
          remaining_amount?: number
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
            foreignKeyName: "projects_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: true
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
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
          discount: number
          down_payment_amount: number
          down_payment_percent: number
          first_sent_at: string | null
          id: string
          internal_notes: string | null
          issue_date: string
          items_subtotal: number
          labor_cost: number
          payment_approved_at: string | null
          payment_status: string
          payment_terms: string | null
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
          discount?: number
          down_payment_amount?: number
          down_payment_percent?: number
          first_sent_at?: string | null
          id?: string
          internal_notes?: string | null
          issue_date?: string
          items_subtotal?: number
          labor_cost?: number
          payment_approved_at?: string | null
          payment_status?: string
          payment_terms?: string | null
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
          discount?: number
          down_payment_amount?: number
          down_payment_percent?: number
          first_sent_at?: string | null
          id?: string
          internal_notes?: string | null
          issue_date?: string
          items_subtotal?: number
          labor_cost?: number
          payment_approved_at?: string | null
          payment_status?: string
          payment_terms?: string | null
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
      subscriptions: {
        Row: {
          active: boolean
          company_id: string
          created_at: string
          expiration_date: string | null
          id: string
          plan_id: string
          start_date: string
          trial: boolean
          updated_at: string
        }
        Insert: {
          active?: boolean
          company_id: string
          created_at?: string
          expiration_date?: string | null
          id?: string
          plan_id: string
          start_date?: string
          trial?: boolean
          updated_at?: string
        }
        Update: {
          active?: boolean
          company_id?: string
          created_at?: string
          expiration_date?: string | null
          id?: string
          plan_id?: string
          start_date?: string
          trial?: boolean
          updated_at?: string
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
            foreignKeyName: "subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
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
      [_ in never]: never
    }
    Functions: {
      accept_invitation: { Args: { _token: string }; Returns: string }
      accept_public_quote: {
        Args: { _document?: string; _name: string; _token: string }
        Returns: Json
      }
      admin_companies_overview: {
        Args: never
        Returns: {
          cnpj: string
          corporate_name: string
          created_at: string
          id: string
          plan_name: string
          plan_slug: string
          status: Database["public"]["Enums"]["company_status"]
          subscription_active: boolean
          subscription_expires: string
          subscription_trial: boolean
          trade_name: string
          users_count: number
        }[]
      }
      admin_set_company_status: {
        Args: {
          _company_id: string
          _status: Database["public"]["Enums"]["company_status"]
        }
        Returns: undefined
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
        Returns: Json
      }
      cancel_quote_payment: {
        Args: { _payment_id: string; _reason?: string }
        Returns: Json
      }
      confirm_nota_receiving: {
        Args: {
          _doc_id: string
          _location_id: string
          _notes?: string
          _supplier_id?: string
        }
        Returns: Json
      }
      convert_quote_to_project: { Args: { _quote_id: string }; Returns: string }
      current_company_id: { Args: never; Returns: string }
      get_my_features: { Args: never; Returns: string[] }
      get_my_permissions: { Args: never; Returns: string[] }
      get_public_quote_by_token: { Args: { _token: string }; Returns: Json }
      has_company_role: {
        Args: { _role: Database["public"]["Enums"]["app_role"] }
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
      next_project_number: { Args: { _company_id: string }; Returns: string }
      next_quote_number: { Args: { _company_id: string }; Returns: string }
      notify_user: {
        Args: {
          _company_id: string
          _message?: string
          _title: string
          _user_id: string
        }
        Returns: string
      }
      quote_recalc_totals: { Args: { _quote_id: string }; Returns: undefined }
      quotes_mark_expired: { Args: never; Returns: number }
      receive_purchase_order: {
        Args: {
          _items: Json
          _location_id: string
          _notes?: string
          _po_id: string
        }
        Returns: Json
      }
      register_public_quote_view: {
        Args: { _token: string }
        Returns: undefined
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
