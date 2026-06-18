import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

const roleRedirects = {
  admin: '/admin',
  headmaster: '/headmaster',
  academic: '/academic',
  teacher: '/teacher',
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  const fetchProfile = async (userId) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle()
    if (error) {
      console.error('Error fetching profile:', error)
      return
    }
    if (!data) {
      const { data: { user } } = await supabase.auth.getUser()
      if (user?.email) {
        const { data: newProfile, error: insertError } = await supabase
          .from('profiles')
          .insert({
            id: userId,
            email: user.email,
            full_name: user.user_metadata?.full_name || '',
            role: user.user_metadata?.role || 'teacher',
          })
          .select()
          .maybeSingle()
        if (insertError) {
          if (insertError.message?.includes('duplicate key')) {
            const { data: retry } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', userId)
              .maybeSingle()
            if (retry) setProfile(retry)
          } else {
            console.error('Error creating profile:', insertError)
          }
          return
        }
        if (newProfile) {
          setProfile(newProfile)
          return
        }
      }
      return
    }
    setProfile(data)
  }

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        setUser(session.user)
        await fetchProfile(session.user.id)
      }
      setLoading(false)
    }
    init()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        await fetchProfile(session.user.id)
      } else {
        setProfile(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  // Inactivity timer
  useEffect(() => {
    let timeout;
    const inactivityTime = 30 * 60 * 1000; // 30 minutes

    const signOutUser = async () => {
      await supabase.auth.signOut();
      setUser(null);
      setProfile(null);
      window.location.reload();
    };

    const resetTimer = () => {
      clearTimeout(timeout);
      timeout = setTimeout(signOutUser, inactivityTime);
    };

    // Events to watch
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    events.forEach(event => window.addEventListener(event, resetTimer));

    // Initial start
    resetTimer();

    return () => {
      clearTimeout(timeout);
      events.forEach(event => window.removeEventListener(event, resetTimer));
    };
  }, []);

  const signIn = async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  }

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    setUser(null)
    setProfile(null)
  }, [])

  const getRedirectPath = () => {
    if (!profile) return '/login'
    return roleRedirects[profile.role] || '/login'
  }

  return (
    <AuthContext.Provider value={{ user, profile, loading, signIn, signOut, getRedirectPath }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
