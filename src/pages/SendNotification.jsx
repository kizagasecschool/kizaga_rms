import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useAppNotifications } from '../context/AppNotificationsContext'
import { useNotification } from '../context/NotificationContext'

function SendNotification() {
  const { profile } = useAuth()
  const { sendNotification } = useAppNotifications()
  const { showToast } = useNotification()

  const [recipientType, setRecipientType] = useState('role')
  const [recipientRole, setRecipientRole] = useState('teacher')
  const [recipientUserId, setRecipientUserId] = useState('')
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [profiles, setProfiles] = useState([])
  const [preview, setPreview] = useState(null)

  useEffect(() => {
    if (recipientType === 'user') {
      supabase
        .from('profiles')
        .select('id, full_name, email, role')
        .neq('id', profile?.id)
        .order('full_name')
        .then(({ data }) => {
          if (data) setProfiles(data)
        })
    }
  }, [recipientType, profile])

  const canSend = ['admin', 'headmaster', 'academic'].includes(profile?.role)

  const handlePreview = () => {
    if (!recipientType || !title || !message) return
    const parts = []
    if (recipientType === 'role') {
      parts.push(`All ${recipientRole}s`)
    } else {
      const user = profiles.find((p) => p.id === recipientUserId)
      parts.push(user?.full_name || user?.email || 'Selected user')
    }
    parts.push(title)
    setPreview(parts)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!title.trim() || !message.trim()) {
      showToast('Please fill in title and message', 'error')
      return
    }
    setSending(true)
    try {
      if (recipientType === 'role') {
        const { error } = await supabase.rpc('notify_role', {
          p_sender_id: profile.id,
          p_recipient_role: recipientRole,
          p_title: title.trim(),
          p_message: message.trim(),
          p_type: 'info',
        })
        if (error) throw error
        showToast(`Notification sent to all ${recipientRole}s`, 'success')
      } else {
        if (!recipientUserId) {
          showToast('Please select a user', 'error')
          return
        }
        await sendNotification({
          recipient_id: recipientUserId,
          title: title.trim(),
          message: message.trim(),
          type: 'info',
        })
        showToast('Notification sent', 'success')
      }
      setTitle('')
      setMessage('')
      setPreview(null)
    } catch (err) {
      console.error('Send notification error:', err)
      showToast('Failed to send. ' + (err.message || ''), 'error')
    } finally {
      setSending(false)
    }
  }

  if (!canSend) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-center">
          <svg className="w-10 h-10 text-amber-500 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
          <h2 className="text-lg font-semibold text-amber-800 mb-1">Access Restricted</h2>
          <p className="text-sm text-amber-600">Only Admin, Headmaster, and Academic Officer can send notifications.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Send Notification</h1>
        <p className="text-gray-500 mt-1">Send announcements to users or roles</p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Send To</label>
            <div className="flex gap-3 mb-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="recipientType"
                  checked={recipientType === 'role'}
                  onChange={() => setRecipientType('role')}
                  className="accent-maroon-600"
                />
                <span className="text-sm text-gray-700">Entire Role</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="recipientType"
                  checked={recipientType === 'user'}
                  onChange={() => setRecipientType('user')}
                  className="accent-maroon-600"
                />
                <span className="text-sm text-gray-700">Specific User</span>
              </label>
            </div>

            {recipientType === 'role' ? (
              <select
                value={recipientRole}
                onChange={(e) => setRecipientRole(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-sm outline-none focus:border-maroon-400 focus:ring-4 focus:ring-maroon-500/10 transition"
              >
                <option value="teacher">Teachers</option>
                <option value="academic">Academic Officers</option>
                <option value="headmaster">Headmasters</option>
                <option value="admin">Admins</option>
              </select>
            ) : (
              <select
                value={recipientUserId}
                onChange={(e) => setRecipientUserId(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-sm outline-none focus:border-maroon-400 focus:ring-4 focus:ring-maroon-500/10 transition"
              >
                <option value="">Select a user...</option>
                {profiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.full_name || p.email} ({p.role})
                  </option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Title</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-sm outline-none focus:border-maroon-400 focus:ring-4 focus:ring-maroon-500/10 transition"
              placeholder="e.g. Staff Meeting Tomorrow"
              maxLength={200}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Message</label>
            <textarea
              required
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-sm outline-none focus:border-maroon-400 focus:ring-4 focus:ring-maroon-500/10 transition resize-none"
              placeholder="Enter your notification message..."
              maxLength={1000}
            />
            <p className="text-xs text-gray-400 mt-1 text-right">{message.length}/1000</p>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={sending}
              className="px-5 py-2.5 bg-maroon-600 text-white text-sm font-medium rounded-xl hover:bg-maroon-700 disabled:opacity-50 transition flex items-center gap-2"
            >
              {sending ? (
                <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Sending...</>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                  </svg>
                  Send Notification
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default SendNotification
