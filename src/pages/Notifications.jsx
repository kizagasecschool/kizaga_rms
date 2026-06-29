import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useAppNotifications } from '../context/AppNotificationsContext'
import { useNotification } from '../context/NotificationContext'

function Notifications() {
  const { profile } = useAuth()
  const { showToast } = useNotification()
  const { notifications, fetchNotifications, markAsRead, markAllAsRead, deleteNotification } = useAppNotifications()
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      await fetchNotifications()
      setLoading(false)
    }
    load()
  }, [fetchNotifications])

  const handleMarkRead = async (id) => {
    await markAsRead(id)
  }

  const handleMarkAllRead = async () => {
    await markAllAsRead()
    showToast('All notifications marked as read', 'success')
  }

  const getTypeIcon = (type) => {
    switch (type) {
      case 'exam_created':
      case 'results_processed':
        return (
          <div className="w-9 h-9 rounded-full bg-maroon-100 text-maroon-600 flex items-center justify-center shrink-0">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
        )
      case 'success':
        return (
          <div className="w-9 h-9 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        )
      case 'warning':
        return (
          <div className="w-9 h-9 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
            </svg>
          </div>
        )
      default:
        return (
          <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
            </svg>
          </div>
        )
    }
  }

  const formatTime = (dateStr) => {
    const d = new Date(dateStr)
    const now = new Date()
    const diffMs = now - d
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMins / 60)
    const diffDays = Math.floor(diffHours / 24)

    if (diffMins < 1) return 'Sasa hivi'
    if (diffMins < 60) return `Dakika ${diffMins} zilizopita`
    if (diffHours < 24) return `Saa ${diffHours} zilizopita`
    if (diffDays < 7) return `Siku ${diffDays} zilizopita`
    return d.toLocaleDateString('sw-TZ', { day: 'numeric', month: 'short' })
  }

  const handleDelete = async (e, id) => {
    e.stopPropagation()
    await deleteNotification(id)
    showToast('Arifa imefutwa', 'success')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-3 border-gray-200 border-t-maroon-600 rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
          <p className="text-gray-500 mt-1">Stay updated with system activities</p>
        </div>
        {notifications.some((n) => !n.is_read) && (
          <button
            onClick={handleMarkAllRead}
            className="px-4 py-2 text-sm font-medium text-maroon-600 bg-maroon-50 rounded-xl hover:bg-maroon-100 transition"
          >
            Mark All as Read
          </button>
        )}
      </div>

      <div className="space-y-1">
        {notifications.length === 0 && (
          <div className="text-center py-16">
            <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0M3.124 7.5A8.969 8.969 0 015.292 3m13.416 0a8.969 8.969 0 012.168 4.5" />
            </svg>
            <p className="text-sm text-gray-400">No notifications yet</p>
          </div>
        )}
        {notifications.map((n) => (
          <div
            key={n.id}
            className={`flex items-start gap-4 p-4 rounded-xl transition cursor-pointer ${
              n.is_read ? 'bg-white hover:bg-gray-50' : 'bg-maroon-50/50 hover:bg-maroon-50'
            }`}
            onClick={() => !n.is_read && handleMarkRead(n.id)}
          >
            {getTypeIcon(n.type)}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <p className={`text-sm ${n.is_read ? 'text-gray-700' : 'text-gray-900 font-medium'}`}>
                  {n.title}
                </p>
                <span className="text-xs text-gray-400 shrink-0 whitespace-nowrap">{formatTime(n.created_at)}</span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">{n.message}</p>
              {n.link && (
                <Link
                  to={n.link}
                  className="text-xs text-maroon-600 font-medium hover:underline mt-1 inline-block"
                  onClick={(e) => e.stopPropagation()}
                >
                  View details &rarr;
                </Link>
              )}
              {n.sender && (
                <p className="text-xs text-gray-400 mt-1">From: {n.sender.full_name || n.sender.email}</p>
              )}
            </div>
            <div className="flex flex-col items-end gap-2 shrink-0">
              {!n.is_read && <div className="w-2 h-2 rounded-full bg-maroon-600 mt-1" />}
              <button
                onClick={(e) => handleDelete(e, n.id)}
                className="text-gray-300 hover:text-red-500 transition p-1 rounded"
                title="Futa arifa"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default Notifications
