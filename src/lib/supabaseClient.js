import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://fldwlpktqjmqimpfaviw.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_iEZTkdXwewSRlu0SxAJPRg_AmP453Bf'

export const isSupabaseConfigured = true

export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey
)


