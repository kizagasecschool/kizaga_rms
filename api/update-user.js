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
    const input = req.body || await new Promise((resolve, reject) => {
      let body = ''
      req.on('data', (chunk) => { body += chunk })
      req.on('end', () => {
        try { resolve(JSON.parse(body)) } catch (e) { reject(new Error('Invalid JSON in request body')) }
      })
      req.on('error', reject)
    })

    const { user_id, email, full_name, role, password } = input

    if (!user_id) {
      return res.status(400).json({ error: 'Missing required field: user_id' })
    }

    const validRoles = ['admin', 'headmaster', 'academic', 'teacher']
    if (role && !validRoles.includes(role)) {
      return res.status(400).json({ error: `Invalid role. Must be one of: ${validRoles.join(', ')}` })
    }

    // Build auth update payload — only include fields that are changing
    const authUpdates = {}
    if (email) authUpdates.email = email
    if (password) authUpdates.password = password
    if (full_name || role) {
      authUpdates.user_metadata = {}
      if (full_name) authUpdates.user_metadata.full_name = full_name
      if (role) authUpdates.user_metadata.role = role
    }

    if (Object.keys(authUpdates).length > 0) {
      const { error: authErr } = await supabase.auth.admin.updateUserById(user_id, authUpdates)
      if (authErr) throw new Error(`Failed to update auth user: ${authErr.message}`)
    }

    // Update profile table
    const profileUpdates = {}
    if (email) profileUpdates.email = email
    if (full_name) profileUpdates.full_name = full_name
    if (role) profileUpdates.role = role

    if (Object.keys(profileUpdates).length > 0) {
      const { error: profileErr } = await supabase
        .from('profiles')
        .update(profileUpdates)
        .eq('id', user_id)
      if (profileErr) throw new Error(`Failed to update profile: ${profileErr.message}`)
    }

    return res.status(200).json({ success: true })
  } catch (err) {
    console.error('update-user error:', err)
    return res.status(500).json({ error: err.message || 'Failed to update user' })
  }
}
