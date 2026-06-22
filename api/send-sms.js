import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const supabaseUrl = process.env.SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    return res.status(500).json({ error: 'Server configuration error' })
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey)

  try {
    const { recipients, message } = req.body

    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
      return res.status(400).json({ error: 'Recipients are required' })
    }

    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'Message is required' })
    }

    const { data: settings } = await supabase
      .from('school_settings')
      .select('at_api_key, at_username, at_sender_id')
      .limit(1)

    const apiKey = settings?.[0]?.at_api_key
    const username = settings?.[0]?.at_username
    const senderId = settings?.[0]?.at_sender_id || ''

    if (!apiKey || !username) {
      return res.status(400).json({ error: 'Africa\'s Talking API not configured. Add API Key and Username in School Settings.' })
    }

    const phones = recipients
      .map(r => r.phone.replace(/[^0-9]/g, ''))
      .filter(Boolean)
      .join(',')

    const params = new URLSearchParams()
    params.append('username', username)
    params.append('to', phones)
    params.append('message', message.trim())
    params.append('bulkSMSMode', '1')
    if (senderId) params.append('from', senderId)

    const response = await fetch('https://api.africastalking.com/version1/messaging', {
      method: 'POST',
      headers: {
        'apiKey': apiKey,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
      },
      body: params.toString(),
    })

    const result = await response.json()

    if (!response.ok) {
      console.error('Africa\'s Talking API error:', result)
      return res.status(400).json({
        error: result?.message || result?.error || 'Failed to send SMS',
      })
    }

    return res.status(200).json({
      success: true,
      message: `SMS sent to ${recipients.length} recipient(s)`,
      data: result,
    })
  } catch (err) {
    console.error('send-sms error:', err)
    return res.status(500).json({ error: err.message || 'Failed to send SMS' })
  }
}
