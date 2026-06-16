import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  if (req.method !== 'DELETE' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const supabaseUrl = process.env.SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
    return res.status(500).json({ error: 'Server configuration error' })
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey)

  try {
    const input = req.body || await new Promise((resolve, reject) => {
      let body = ''
      req.on('data', (chunk) => { body += chunk })
      req.on('end', () => {
        try { resolve(JSON.parse(body)) } catch (e) { reject(new Error('Invalid JSON in request body')) }
      })
      req.on('error', reject)
    })

    const { user_id } = input

    if (!user_id) {
      return res.status(400).json({ error: 'Missing required field: user_id' })
    }

    // Delete auth user (this also cascades to profiles if ON DELETE CASCADE is set)
    const { error: authError } = await supabase.auth.admin.deleteUser(user_id)

    if (authError) {
      throw new Error(`Failed to delete auth user: ${authError.message}`)
    }

    return res.status(200).json({ success: true, user_id })
  } catch (err) {
    console.error('delete-user error:', err)
    return res.status(500).json({ error: err.message || 'Failed to delete user' })
  }
}
