import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Check your .env file.')
}

// When set in sessionStorage, auth tokens are stored in sessionStorage (cleared on tab close).
// When absent, tokens go to localStorage (persists across browser restarts = "Remember Me").
export const SESSION_ONLY_KEY = 'kizaga-session-only'

const authStorage = {
  getItem: (key) => {
    if (sessionStorage.getItem(SESSION_ONLY_KEY)) return sessionStorage.getItem(key)
    return localStorage.getItem(key)
  },
  setItem: (key, value) => {
    if (sessionStorage.getItem(SESSION_ONLY_KEY)) sessionStorage.setItem(key, value)
    else localStorage.setItem(key, value)
  },
  removeItem: (key) => {
    localStorage.removeItem(key)
    sessionStorage.removeItem(key)
  },
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { storage: authStorage },
})
