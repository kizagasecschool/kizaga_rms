import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
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

    const { email, password, full_name, employee_number, qualification, phone } = input

    if (!email || !password || !full_name || !employee_number) {
      return res.status(400).json({
        error: 'Missing required fields: email, password, full_name, employee_number',
      })
    }

    // Step 1: Create auth user
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name, role: 'teacher' },
    })

    if (authError) {
      throw new Error(`Failed to create auth user: ${authError.message}`)
    }

    const userId = authData.user.id

    // Step 2: Insert profile (clean up auth user on failure)
    const { error: profileError } = await supabase
      .from('profiles')
      .insert({ id: userId, email, full_name, role: 'teacher' })

    if (profileError) {
      await supabase.auth.admin.deleteUser(userId).catch(() => {})
      throw new Error(`Failed to create profile: ${profileError.message}`)
    }

    // Step 3: Insert teacher record (clean up profile + auth user on failure)
    const { data: teacherData, error: teacherError } = await supabase
      .from('teachers')
      .insert({
        employee_number,
        profile_id: userId,
        qualification: qualification || null,
        phone: phone || null,
        status: 'active',
      })
      .select('id')
      .single()

    if (teacherError) {
      await supabase.from('profiles').delete().eq('id', userId).catch(() => {})
      await supabase.auth.admin.deleteUser(userId).catch(() => {})
      throw new Error(`Failed to create teacher record: ${teacherError.message}`)
    }

    return res.status(201).json({
      user_id: userId,
      teacher_id: teacherData.id,
      employee_number,
    })
  } catch (err) {
    console.error('register-teacher error:', err)
    return res.status(500).json({ error: err.message || 'Failed to register teacher' })
  }
}
