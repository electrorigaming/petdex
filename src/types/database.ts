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
      admins: {
        Row: {
          created_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
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
      pets: {
        Row: {
          age_estimate: string | null
          created_at: string
          description: string | null
          id: string
          location: string | null
          name: string
          nicknames: string[]
          photo_url: string | null
          registered_on: string
          slug: string
          status: string
          updated_at: string
          weight_kg: number | null
          zone: string | null
        }
        Insert: {
          age_estimate?: string | null
          created_at?: string
          description?: string | null
          id?: string
          location?: string | null
          name: string
          nicknames?: string[]
          photo_url?: string | null
          registered_on?: string
          slug: string
          status?: string
          updated_at?: string
          weight_kg?: number | null
          zone?: string | null
        }
        Update: {
          age_estimate?: string | null
          created_at?: string
          description?: string | null
          id?: string
          location?: string | null
          name?: string
          nicknames?: string[]
          photo_url?: string | null
          registered_on?: string
          slug?: string
          status?: string
          updated_at?: string
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
          id: string | null
          last_seen_on: string | null
          milestone_count: number | null
          name: string | null
          nicknames: string[] | null
          photo_url: string | null
          registered_on: string | null
          seen_today: boolean | null
          slug: string | null
          status: string | null
          total_sightings: number | null
          zone: string | null
        }
        Insert: {
          id?: string | null
          last_seen_on?: never
          milestone_count?: never
          name?: string | null
          nicknames?: string[] | null
          photo_url?: string | null
          registered_on?: string | null
          seen_today?: never
          slug?: string | null
          status?: string | null
          total_sightings?: never
          zone?: string | null
        }
        Update: {
          id?: string | null
          last_seen_on?: never
          milestone_count?: never
          name?: string | null
          nicknames?: string[] | null
          photo_url?: string | null
          registered_on?: string | null
          seen_today?: never
          slug?: string | null
          status?: string | null
          total_sightings?: never
          zone?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      is_admin: { Args: never; Returns: boolean }
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
