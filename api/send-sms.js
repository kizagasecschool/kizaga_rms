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
      .maybeSingle()

    const apiKey = settings?.beem_api_key
    const secretKey = settings?.beem_secret_key
    const senderId = settings?.beem_sender_id || 'N-SMS'

    if (!apiKey || !secretKey) {
      return res.status(400).json({ error: 'BeemAfrica API not configured. Add API keys in School Settings.' })
    }

    const auth = Buffer.from(`${apiKey}:${secretKey}`).toString('base64')

    const payload = {
      source_addr: senderId,
      encoding: '0',
      schedule_time: '',
      message: message.trim(),
      recipients: recipients.map((r, i) => ({
        recipient_id: i + 1,
        dest_addr: r.phone.replace(/[^0-9]/g, ''),
      })),
    }

    const response = await fetch('https://apism.beem.africa/v1/send', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    const result = await response.json()

    if (!response.ok) {
      console.error('BeemAfrica API error:', result)
      return res.status(400).json({ error: result?.message || result?.error || 'Failed to send SMS' })
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
