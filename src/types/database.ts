export type Json = string | number | boolean | null | { [key: string]: Json } | Json[]

// --- Supabase Database type (must match Supabase CLI output pattern) ---

export type Database = {
  public: {
    Tables: {
      exhibitions: {
        Row: { id: string; key: string; name: string; recurring: boolean; created_at: string }
        Insert: { key: string; name: string; recurring?: boolean }
        Update: { key?: string; name?: string; recurring?: boolean }
        Relationships: []
      }
      proposals: {
        Row: {
          id: string; exhibition_id: string; year: number; proposal_date: string
          author: string; date_of_event: string; venue: string; objective: string
          products: Json; expected_results: Json; budget: Json; explanations: Json; created_at: string
        }
        Insert: {
          exhibition_id: string; year: number; proposal_date: string
          author: string; date_of_event: string; venue: string; objective: string
          products?: Json; expected_results?: Json; budget?: Json; explanations?: Json
        }
        Update: {
          exhibition_id?: string; year?: number; proposal_date?: string
          author?: string; date_of_event?: string; venue?: string; objective?: string
          products?: Json; expected_results?: Json; budget?: Json; explanations?: Json
        }
        Relationships: []
      }
      payments: {
        Row: {
          id: string; exhibition_key: string; item: string; total: number; currency: string
          deposit_amount: number; deposit_due: string | null; deposit_paid: boolean
          final_amount: number; final_due: string | null; final_paid: boolean; created_at: string
        }
        Insert: {
          exhibition_key: string; item: string; total?: number; currency?: string
          deposit_amount?: number; deposit_due?: string | null; deposit_paid?: boolean
          final_amount?: number; final_due?: string | null; final_paid?: boolean
        }
        Update: {
          exhibition_key?: string; item?: string; total?: number; currency?: string
          deposit_amount?: number; deposit_due?: string | null; deposit_paid?: boolean
          final_amount?: number; final_due?: string | null; final_paid?: boolean
        }
        Relationships: []
      }
      results: {
        Row: {
          id: string; exhibition_key: string; objective: string | null; event_date: string | null
          event_venue: string | null; event_target: string | null; actual_costs: Json
          marketing_activities: Json; marketing_photos: Json
          reg_remittance: number; reg_card: number; reg_biz: number; reg_onboard: number
          cost_per_person: number; visitors: number; new_merchants: number; new_registrations: number
          shortcomings: Json; improvements: Json; recommendations: Json; requests: Json
          conclusion: string | null; cover_title: string | null; cover_date: string | null
          cover_author: string | null; sections_enabled: Json; created_at: string
        }
        Insert: {
          exhibition_key: string; objective?: string | null; event_date?: string | null
          event_venue?: string | null; event_target?: string | null; actual_costs?: Json
          marketing_activities?: Json; marketing_photos?: Json
          reg_remittance?: number; reg_card?: number; reg_biz?: number; reg_onboard?: number
          cost_per_person?: number; visitors?: number; new_merchants?: number; new_registrations?: number
          shortcomings?: Json; improvements?: Json; recommendations?: Json; requests?: Json
          conclusion?: string | null; cover_title?: string | null; cover_date?: string | null
          cover_author?: string | null; sections_enabled?: Json
        }
        Update: {
          exhibition_key?: string; objective?: string | null; event_date?: string | null
          event_venue?: string | null; event_target?: string | null; actual_costs?: Json
          marketing_activities?: Json; marketing_photos?: Json
          reg_remittance?: number; reg_card?: number; reg_biz?: number; reg_onboard?: number
          cost_per_person?: number; visitors?: number; new_merchants?: number; new_registrations?: number
          shortcomings?: Json; improvements?: Json; recommendations?: Json; requests?: Json
          conclusion?: string | null; cover_title?: string | null; cover_date?: string | null
          cover_author?: string | null; sections_enabled?: Json
        }
        Relationships: []
      }
      event_data: {
        Row: {
          id: string; exhibition_key: string; tab: string
          checklist: Json; design: Json; gifts_onboard: Json; gifts_event: Json
          equipment: Json; itinerary: Json; created_at: string
        }
        Insert: {
          exhibition_key: string; tab: string
          checklist?: Json; design?: Json; gifts_onboard?: Json; gifts_event?: Json
          equipment?: Json; itinerary?: Json
        }
        Update: {
          exhibition_key?: string; tab?: string
          checklist?: Json; design?: Json; gifts_onboard?: Json; gifts_event?: Json
          equipment?: Json; itinerary?: Json
        }
        Relationships: []
      }
      sales_leads: {
        Row: {
          id: string; serial_no: string; registered_date: string; event_name: string
          company_name: string; contact_person: string; phone: string | null; email: string | null
          lead_source: string; address: string | null; business_type: string; country_corridor: string
          expected_monthly_volume: number | null; volume_currency: string; priority: string
          owner: string; current_stage: string; first_contact_done: boolean
          last_contact_date: string | null; next_action: string | null; next_follow_up_date: string | null
          lost_reason: string | null; remarks: string | null; created_at: string
        }
        Insert: {
          serial_no: string; registered_date: string; event_name: string
          company_name: string; contact_person: string; phone?: string | null; email?: string | null
          lead_source: string; address?: string | null; business_type: string; country_corridor: string
          expected_monthly_volume?: number | null; volume_currency?: string; priority?: string
          owner: string; current_stage?: string; first_contact_done?: boolean
          last_contact_date?: string | null; next_action?: string | null; next_follow_up_date?: string | null
          lost_reason?: string | null; remarks?: string | null
        }
        Update: {
          serial_no?: string; registered_date?: string; event_name?: string
          company_name?: string; contact_person?: string; phone?: string | null; email?: string | null
          lead_source?: string; address?: string | null; business_type?: string; country_corridor?: string
          expected_monthly_volume?: number | null; volume_currency?: string; priority?: string
          owner?: string; current_stage?: string; first_contact_done?: boolean
          last_contact_date?: string | null; next_action?: string | null; next_follow_up_date?: string | null
          lost_reason?: string | null; remarks?: string | null
        }
        Relationships: []
      }
      sales_activities: {
        Row: {
          id: string; lead_id: string; activity_type: string; activity_result: string | null
          activity_date: string; note: string | null; created_by: string; created_at: string
        }
        Insert: {
          lead_id: string; activity_type: string; activity_result?: string | null
          activity_date: string; note?: string | null; created_by: string
        }
        Update: {
          lead_id?: string; activity_type?: string; activity_result?: string | null
          activity_date?: string; note?: string | null; created_by?: string
        }
        Relationships: []
      }
      sales_tasks: {
        Row: {
          id: string; lead_id: string; task_title: string; task_type: string
          due_date: string; status: string; priority: string; owner: string
          completed_at: string | null; note: string | null; created_at: string
        }
        Insert: {
          lead_id: string; task_title: string; task_type: string
          due_date: string; status?: string; priority?: string; owner: string
          completed_at?: string | null; note?: string | null
        }
        Update: {
          lead_id?: string; task_title?: string; task_type?: string
          due_date?: string; status?: string; priority?: string; owner?: string
          completed_at?: string | null; note?: string | null
        }
        Relationships: []
      }
      sales_proposals: {
        Row: {
          id: string; lead_id: string; proposal_sent_date: string | null
          proposed_fee_rate: number | null; expected_monthly_volume: number | null
          volume_currency: string; contract_status: string; onboarding_status: string
          proposal_file_name: string | null; contract_file_name: string | null
          remarks: string | null; created_at: string
        }
        Insert: {
          lead_id: string; proposal_sent_date?: string | null
          proposed_fee_rate?: number | null; expected_monthly_volume?: number | null
          volume_currency?: string; contract_status?: string; onboarding_status?: string
          proposal_file_name?: string | null; contract_file_name?: string | null
          remarks?: string | null
        }
        Update: {
          lead_id?: string; proposal_sent_date?: string | null
          proposed_fee_rate?: number | null; expected_monthly_volume?: number | null
          volume_currency?: string; contract_status?: string; onboarding_status?: string
          proposal_file_name?: string | null; contract_file_name?: string | null
          remarks?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

// --- App-level types ---

export interface Exhibition {
  id: string; key: string; name: string; recurring: boolean
}

export interface BudgetItem {
  item: string; curr: number; prev: number; note: string; currency?: string
}

export interface ProductTarget {
  product: string; target: string
}

export interface Proposal {
  id: string; exhibition_id: string; year: number; proposal_date: string
  author: string; date_of_event: string; venue: string; objective: string
  products: ProductTarget[]; expected_results: string[]
  budget: BudgetItem[]; explanations: Record<string, string>
}

export interface Payment {
  id: string; exhibition_key: string; item: string; total: number; currency: string
  deposit_amount: number; deposit_due: string | null; deposit_paid: boolean
  final_amount: number; final_due: string | null; final_paid: boolean
}

export interface ActualCost {
  item: string; budgeted: number; actual: number; currency: string
}

export interface MarketingActivity {
  type: string; description: string; result: string
}

export interface Result {
  id: string; exhibition_key: string; objective: string; event_date: string
  event_venue: string; event_target: string; actual_costs: ActualCost[]
  marketing_activities: MarketingActivity[]; marketing_photos: string[]
  reg_remittance: number; reg_card: number; reg_biz: number; reg_onboard: number
  cost_per_person: number; visitors: number; new_merchants: number; new_registrations: number
  shortcomings: string[]; improvements: string[]; recommendations: string[]
  requests: string[]; conclusion: string; cover_title: string; cover_date: string
  cover_author: string; sections_enabled: Record<string, boolean>
}

export interface ChecklistItem {
  name: string; pic: string; deadline: string; status: string; remarks: string
  subs: Array<{ name: string; status: string }>
}

export interface EventData {
  id: string; exhibition_key: string; tab: string
  checklist: ChecklistItem[]
  design: Array<{ item: string; vendor: string; qty: number; status: string; note: string }>
  gifts_onboard: Array<{ item: string; qty: number; status: string; note: string }>
  gifts_event: Array<{ item: string; qty: number; status: string; note: string }>
  equipment: Array<{ item: string; qty: number; owner: string; status: string; note: string }>
  itinerary: Array<{ date: string; time: string; activity: string; person: string; note: string }>
}

export interface SalesLead {
  id: string; serial_no: string; registered_date: string; event_name: string
  company_name: string; contact_person: string; phone: string | null; email: string | null
  lead_source: string; address: string | null; business_type: string; country_corridor: string
  expected_monthly_volume: number | null; volume_currency: string; priority: string
  owner: string; current_stage: string; first_contact_done: boolean
  last_contact_date: string | null; next_action: string | null; next_follow_up_date: string | null
  lost_reason: string | null; remarks: string | null
}

export interface SalesActivity {
  id: string; lead_id: string; activity_type: string; activity_result: string | null
  activity_date: string; note: string | null; created_by: string
}

export interface SalesTask {
  id: string; lead_id: string; task_title: string; task_type: string
  due_date: string; status: string; priority: string; owner: string
  completed_at: string | null; note: string | null
}

export interface SalesProposal {
  id: string; lead_id: string; proposal_sent_date: string | null
  proposed_fee_rate: number | null; expected_monthly_volume: number | null
  volume_currency: string; contract_status: string; onboarding_status: string
  proposal_file_name: string | null; contract_file_name: string | null; remarks: string | null
}
