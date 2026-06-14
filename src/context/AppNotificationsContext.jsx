import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'

const AppNotificationsContext = createContext(null)

export function AppNotificationsProvider({ children }) {
  const { profile } = useAuth()
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const channelRef = useRef(null)

  const fetchUnreadCount = useCallback(async () => {
    if (!profile) { setUnreadCount(0); return }
    const { data, error } = await supabase.rpc('get_unread_notification_count')
    if (!error && data !== null) setUnreadCount(data)
  }, [profile])

  const fetchNotifications = useCallback(async () => {
    if (!profile) return
    const { data } = await supabase
      .from('notifications')
      .select('*, sender:sender_id(full_name, email)')
      .or(`recipient_id.eq.${profile.id},recipient_role.eq.${profile.role}`)
      .order('created_at', { ascending: false })
      .limit(50)
    if (data) setNotifications(data)
  }, [profile])

  useEffect(() => {
    if (!profile) return
    fetchNotifications()
    fetchUnreadCount()
  }, [profile, fetchNotifications, fetchUnreadCount])

  // Real-time subscription
  useEffect(() => {
    if (!profile) return
    const channel = supabase
      .channel('app-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `recipient_id=eq.${profile.id}`,
        },
        () => {
          fetchUnreadCount()
          fetchNotifications()
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
          filter: `recipient_id=eq.${profile.id}`,
        },
        () => {
          fetchUnreadCount()
          fetchNotifications()
        }
      )
      .subscribe()

    channelRef.current = channel
    return () => { supabase.removeChannel(channel) }
  }, [profile, fetchUnreadCount, fetchNotifications])

  const markAsRead = useCallback(async (id) => {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', id)
      .eq('recipient_id', profile.id)
    if (!error) {
      setUnreadCount((prev) => Math.max(0, prev - 1))
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      )
    }
  }, [profile])

  const markAllAsRead = useCallback(async () => {
    const ids = notifications.filter((n) => !n.is_read).map((n) => n.id)
    if (ids.length === 0) return
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .in('id', ids)
      .eq('recipient_id', profile.id)
    if (!error) {
      setUnreadCount(0)
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })))
    }
  }, [profile, notifications])

  const sendNotification = useCallback(async ({ recipient_id, recipient_role, title, message, type, link }) => {
    const { data, error } = await supabase
      .from('notifications')
      .insert({
        sender_id: profile.id,
        recipient_id: recipient_id || null,
        recipient_role: recipient_role || null,
        title,
        message,
        type: type || 'info',
        link: link || null,
      })
      .select('id')
    if (error) throw error
    return data
  }, [profile])

  return (
    <AppNotificationsContext.Provider value={{
      notifications,
      unreadCount,
      fetchNotifications,
      fetchUnreadCount,
      markAsRead,
      markAllAsRead,
      sendNotification,
    }}>
      {children}
    </AppNotificationsContext.Provider>
  )
}

export function useAppNotifications() {
  const ctx = useContext(AppNotificationsContext)
  if (!ctx) throw new Error('useAppNotifications must be used within AppNotificationsProvider')
  return ctx
}
