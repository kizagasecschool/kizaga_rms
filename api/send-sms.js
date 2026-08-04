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
      .select('beem_api_key, beem_secret_key, beem_sender_id')
      .limit(1)

    const apiKey    = settings?.[0]?.beem_api_key
    const secretKey = settings?.[0]?.beem_secret_key
    const senderId  = settings?.[0]?.beem_sender_id

    if (!apiKey || !secretKey) {
      return res.status(400).json({ error: 'Beem Africa SMS not configured. Add API Key and Secret Key in School Settings.' })
    }
    if (!senderId) {
      return res.status(400).json({ error: 'Beem Sender ID is not set. Add your registered Sender ID in School Settings.' })
    }

    const token = Buffer.from(`${apiKey}:${secretKey}`).toString('base64')

    const beemRecipients = recipients.map((r, i) => ({
      recipient_id: i + 1,
      dest_addr: r.phone.replace(/[^0-9]/g, ''),
    })).filter(r => r.dest_addr)

    if (beemRecipients.length === 0) {
      return res.status(400).json({ error: 'No valid phone numbers found' })
    }

    const response = await fetch('https://apisms.beem.africa/v1/send', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        source_addr: senderId,
        schedule_time: '',
        encoding: 0,
        message: message.trim(),
        recipients: beemRecipients,
      }),
    })

    const result = await response.json()

    if (!response.ok) {
      console.error('Beem Africa API error:', result)
      return res.status(400).json({
        error: result?.message || result?.error || `Beem API error (${response.status})`,
      })
    }

    return res.status(200).json({
      success: true,
      message: `SMS sent to ${beemRecipients.length} recipient(s)`,
      data: result,
    })
  } catch (err) {
    console.error('send-sms error:', err)
    return res.status(500).json({ error: err.message || 'Failed to send SMS' })
  }
}
