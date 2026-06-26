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

    // Step 1: Create auth user.
    // Guard: if the email is already in auth.users but has no profile row (orphaned from
    // a manual/dashboard delete), wipe the stale auth entry first so we can re-register.
    let authData, authError
    ;({ data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name, role: 'teacher' },
    }))

    if (authError) {
      const isAlreadyRegistered =
        authError.message?.toLowerCase().includes('already been registered') ||
        authError.message?.toLowerCase().includes('already registered') ||
        authError.code === 'email_exists'

      if (isAlreadyRegistered) {
        // Find the existing auth user by email
        const { data: listData, error: listErr } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 })
        if (listErr) throw new Error(`Failed to create auth user: ${authError.message}`)

        const existing = listData?.users?.find(u => u.email?.toLowerCase() === email.toLowerCase())
        if (!existing) throw new Error(`Failed to create auth user: ${authError.message}`)

        const { data: profile } = await supabase
          .from('profiles')
          .select('id, role')
          .eq('id', existing.id)
          .maybeSingle()

        if (profile) {
          // Email belongs to a non-teacher account
          if (profile.role !== 'teacher') {
            throw new Error(`This email is already used by a ${profile.role} account and cannot be registered as a teacher.`)
          }

          // Profile exists with role=teacher. Check if a teachers row also exists.
          const { data: teacherRow } = await supabase
            .from('teachers')
            .select('id')
            .eq('profile_id', existing.id)
            .maybeSingle()

          if (teacherRow) {
            // Fully registered teacher — block duplicate
            throw new Error('A teacher with this email is already registered. Edit the existing record instead.')
          }

          // Profile exists but teachers row is missing (partial previous deletion).
          // Update the profile details and create only the missing teachers row.
          await supabase.from('profiles').update({ full_name, email }).eq('id', existing.id)

          const { data: newTeacher, error: tErr } = await supabase
            .from('teachers')
            .insert({
              employee_number,
              profile_id: existing.id,
              qualification: qualification || null,
              phone: phone || null,
              status: 'active',
            })
            .select('id')
            .single()
          if (tErr) throw new Error(`Failed to create teacher record: ${tErr.message}`)

          return res.status(201).json({
            user_id: existing.id,
            teacher_id: newTeacher.id,
            employee_number,
          })
        }

        // No profile — orphaned auth user. Delete it and retry.
        const { error: delErr } = await supabase.auth.admin.deleteUser(existing.id)
        if (delErr) throw new Error(`Failed to create auth user: ${authError.message}`)

        ;({ data: authData, error: authError } = await supabase.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: { full_name, role: 'teacher' },
        }))
        if (authError) throw new Error(`Failed to create auth user: ${authError.message}`)
      } else {
        throw new Error(`Failed to create auth user: ${authError.message}`)
      }
    }

    const userId = authData.user.id

    // Step 2: Upsert profile (handles trigger-created row)
    const { error: profileError } = await supabase
      .from('profiles')
      .upsert({ id: userId, email, full_name, role: 'teacher' })

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
