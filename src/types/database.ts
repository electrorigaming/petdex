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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      account_requests: {
        Row: {
          display_name: string
          email: string
          id: string
          requested_at: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          user_id: string | null
        }
        Insert: {
          display_name: string
          email: string
          id?: string
          requested_at?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          user_id?: string | null
        }
        Update: {
          display_name?: string
          email?: string
          id?: string
          requested_at?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          user_id?: string | null
        }
        Relationships: []
      }
      app_users: {
        Row: {
          approved_by: string | null
          created_at: string
          display_name: string
          email: string
          role: string
          user_id: string
        }
        Insert: {
          approved_by?: string | null
          created_at?: string
          display_name: string
          email: string
          role: string
          user_id: string
        }
        Update: {
          approved_by?: string | null
          created_at?: string
          display_name?: string
          email?: string
          role?: string
          user_id?: string
        }
        Relationships: []
      }
      milestones: {
        Row: {
          category: string | null
          created_at: string
          id: string
          note: string | null
          occurred_on: string
          pet_id: string
          title: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          id?: string
          note?: string | null
          occurred_on: string
          pet_id: string
          title: string
        }
        Update: {
          category?: string | null
          created_at?: string
          id?: string
          note?: string | null
          occurred_on?: string
          pet_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "milestones_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "pets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "milestones_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "pets_overview"
            referencedColumns: ["id"]
          },
        ]
      }
      pet_activity_log: {
        Row: {
          action: string
          actor_id: string | null
          actor_label: string
          created_at: string
          detail: string | null
          id: string
          pet_id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_label: string
          created_at?: string
          detail?: string | null
          id?: string
          pet_id: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_label?: string
          created_at?: string
          detail?: string | null
          id?: string
          pet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pet_activity_log_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "pets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pet_activity_log_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "pets_overview"
            referencedColumns: ["id"]
          },
        ]
      }
      pets: {
        Row: {
          age_estimate: string | null
          created_at: string
          created_by: string | null
          description: string | null
          gender: string
          id: string
          location: string | null
          name: string
          nicknames: string[]
          photo_url: string | null
          registered_on: string
          slug: string
          status: string | null
          sterilized: boolean
          updated_at: string
          visibility: string
          weight_kg: number | null
          zone: string | null
        }
        Insert: {
          age_estimate?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          gender?: string
          id?: string
          location?: string | null
          name: string
          nicknames?: string[]
          photo_url?: string | null
          registered_on?: string
          slug: string
          status?: string | null
          sterilized?: boolean
          updated_at?: string
          visibility?: string
          weight_kg?: number | null
          zone?: string | null
        }
        Update: {
          age_estimate?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          gender?: string
          id?: string
          location?: string | null
          name?: string
          nicknames?: string[]
          photo_url?: string | null
          registered_on?: string
          slug?: string
          status?: string | null
          sterilized?: boolean
          updated_at?: string
          visibility?: string
          weight_kg?: number | null
          zone?: string | null
        }
        Relationships: []
      }
      sightings: {
        Row: {
          created_at: string
          id: string
          note: string | null
          pet_id: string
          seen: boolean
          seen_on: string
        }
        Insert: {
          created_at?: string
          id?: string
          note?: string | null
          pet_id: string
          seen: boolean
          seen_on: string
        }
        Update: {
          created_at?: string
          id?: string
          note?: string | null
          pet_id?: string
          seen?: boolean
          seen_on?: string
        }
        Relationships: [
          {
            foreignKeyName: "sightings_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "pets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sightings_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "pets_overview"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      pets_overview: {
        Row: {
          age_estimate: string | null
          description: string | null
          gender: string | null
          id: string | null
          last_seen_on: string | null
          location: string | null
          milestone_count: number | null
          name: string | null
          nicknames: string[] | null
          outcome: string | null
          photo_url: string | null
          registered_on: string | null
          seen_today: boolean | null
          slug: string | null
          status: string | null
          sterilized: boolean | null
          today_not_there: boolean | null
          total_sightings: number | null
          visibility: string | null
          weight_kg: number | null
          zone: string | null
        }
        Insert: {
          age_estimate?: string | null
          description?: string | null
          gender?: string | null
          id?: string | null
          last_seen_on?: never
          location?: string | null
          milestone_count?: never
          name?: string | null
          nicknames?: string[] | null
          outcome?: string | null
          photo_url?: string | null
          registered_on?: string | null
          seen_today?: never
          slug?: string | null
          status?: never
          sterilized?: boolean | null
          today_not_there?: never
          total_sightings?: never
          visibility?: string | null
          weight_kg?: number | null
          zone?: string | null
        }
        Update: {
          age_estimate?: string | null
          description?: string | null
          gender?: string | null
          id?: string | null
          last_seen_on?: never
          location?: string | null
          milestone_count?: never
          name?: string | null
          nicknames?: string[] | null
          outcome?: string | null
          photo_url?: string | null
          registered_on?: string | null
          seen_today?: never
          slug?: string | null
          status?: never
          sterilized?: boolean | null
          today_not_there?: never
          total_sightings?: never
          visibility?: string | null
          weight_kg?: number | null
          zone?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      claim_approved_account: { Args: never; Returns: undefined }
      current_actor_label: { Args: never; Returns: string }
      is_admin: { Args: never; Returns: boolean }
      is_editor: { Args: never; Returns: boolean }
      mark_sighting: {
        Args: {
          p_date?: string
          p_note?: string
          p_pet_id: string
          p_seen?: boolean
        }
        Returns: {
          created_at: string
          id: string
          note: string | null
          pet_id: string
          seen: boolean
          seen_on: string
        }
        SetofOptions: {
          from: "*"
          to: "sightings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      my_account_status: {
        Args: never
        Returns: {
          request_status: string
          role: string
        }[]
      }
      today_local: { Args: never; Returns: string }
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
