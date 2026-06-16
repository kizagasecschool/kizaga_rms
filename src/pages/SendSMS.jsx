import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useNotification } from '../context/NotificationContext'

export default function SendSMS() {
  const { profile } = useAuth()
  const { showToast } = useNotification()

  const [classes, setClasses] = useState([])
  const [classId, setClassId] = useState('')
  const [recipients, setRecipients] = useState([])
  const [loadingRecipients, setLoadingRecipients] = useState(false)
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)

  useEffect(() => {
    loadClasses()
  }, [])

  const canSend = ['admin', 'headmaster', 'academic'].includes(profile?.role)

  const loadClasses = async () => {
    const { data, error } = await supabase.from('classes').select('*').order('sort_order')
    if (error) {
      showToast('Failed to load classes', 'error')
    } else {
      setClasses(data || [])
    }
  }

  const normalizePhone = (raw) => {
    if (!raw) return null
    const digits = raw.replace(/[^0-9]/g, '')
    if (!digits) return null
    // If phone looks local (9 or 10 digits without country code), try to convert to Tanzania format
    if (digits.length === 9) return '255' + digits
    if (digits.length === 10 && digits.startsWith('0')) return '255' + digits.slice(1)
    return digits
  }

  const loadRecipients = async () => {
    if (!classId) {
      showToast('Select a class first', 'error')
      return
    }
    setLoadingRecipients(true)
    try {
      const { data, error } = await supabase
        .from('students')
        .select('id, full_name, parent_name, parent_phone')
        .eq('class_id', classId)
        .order('full_name')

      if (error) throw error

      const list = (data || [])
        .map((s) => ({
          phone: normalizePhone(s.parent_phone),
          name: s.parent_name || s.full_name || null,
        }))
        .filter(r => r.phone)

      setRecipients(list)
      showToast(`Loaded ${list.length} recipient(s)`, 'success')
    } catch (err) {
      console.error('Load recipients error:', err)
      showToast('Failed to load recipients', 'error')
    } finally {
      setLoadingRecipients(false)
    }
  }

  const handleSend = async (e) => {
    e.preventDefault()
    if (!message.trim()) {
      showToast('Please enter a message', 'error')
      return
    }
    if (!recipients || recipients.length === 0) {
      showToast('No recipients loaded', 'error')
      return
    }
    setSending(true)
    try {
      const body = {
        recipients: recipients.map((r) => ({ phone: r.phone, name: r.name })),
        message: message.trim(),
      }

      const res = await fetch('/api/send-sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const result = await res.json()
      if (!res.ok) {
        throw new Error(result.error || 'Failed to send SMS')
      }

      showToast(result.message || 'SMS sent', 'success')
      setMessage('')
    } catch (err) {
      console.error('Send SMS error:', err)
      showToast('Failed to send SMS: ' + (err.message || ''), 'error')
    } finally {
      setSending(false)
    }
  }

  if (!canSend) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-center">
          <h2 className="text-lg font-semibold text-amber-800 mb-1">Access Restricted</h2>
          <p className="text-sm text-amber-600">Only Admin, Headmaster, and Academic Officer can send SMS.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Send SMS to Parents</h1>
        <p className="text-sm text-gray-500 mt-1">Select a class, load parent contacts and send SMS (BeemAfrica)</p>
      </div>

      <form onSubmit={handleSend} className="bg-white rounded-2xl border border-gray-200 p-6 space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Class</label>
          <div className="flex gap-3">
            <select
              value={classId}
              onChange={(e) => setClassId(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-sm outline-none"
            >
              <option value="">Select a class...</option>
              {classes.map(c => (
                <option key={c.id} value={c.id}>{c.class_name || c.name || c.description || c.id}</option>
              ))}
            </select>
            <button
              type="button"
              disabled={!classId || loadingRecipients}
              onClick={loadRecipients}
              className="px-4 py-2 bg-maroon-600 text-white rounded-xl disabled:opacity-50"
            >
              {loadingRecipients ? 'Loading...' : 'Load Parents'}
            </button>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Recipients</label>
          <div className="text-sm text-gray-600">{recipients.length} parent(s) loaded</div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
          <textarea
            required
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={5}
            className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-sm outline-none"
            placeholder="Enter SMS message to parents..."
            maxLength={612}
          />
          <p className="text-xs text-gray-400 mt-1 text-right">{message.length}/612</p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={sending}
            className="px-5 py-2.5 bg-maroon-600 text-white text-sm font-medium rounded-xl disabled:opacity-50"
          >
            {sending ? 'Sending...' : 'Send SMS'}
          </button>
        </div>
      </form>
    </div>
  )
}
