import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Mobile browsers can discard sessionStorage when the CRM tab is suspended to
// open Camera, Gallery, or Files. Preserve any existing signed-in session once
// during this migration, then use localStorage so returning to the upload does
// not unexpectedly log the user out. Supabase still refreshes/expires tokens,
// and explicit logout/deactivation still clears the session.
if (typeof window !== 'undefined') {
    try {
        Object.keys(window.sessionStorage).forEach(key => {
            if (key.startsWith('sb-') && key.endsWith('-auth-token') && !window.localStorage.getItem(key)) {
                const value = window.sessionStorage.getItem(key);
                if (value) window.localStorage.setItem(key, value);
            }
        });
    } catch (error) {
        console.warn('Could not migrate the existing browser session:', error);
    }
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
        storage: typeof window !== 'undefined' ? window.localStorage : undefined,
        autoRefreshToken: true,
        persistSession: true,
    }
})

export default supabase
