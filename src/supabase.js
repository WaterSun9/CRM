import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Configured with sessionStorage for strict client security:
// Sessions expire automatically when the tab/browser is closed, forcing the Login screen on new visits.
export const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
        storage: typeof window !== 'undefined' ? window.sessionStorage : undefined,
        autoRefreshToken: true,
        persistSession: true,
    }
})

export default supabase