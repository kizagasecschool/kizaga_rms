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

    // Delete teacher_subjects and teachers explicitly before deleting the auth user.
    // The DB migration (migration_fix_delete_user_cascade.sql) adds ON DELETE CASCADE
    // on these FKs, but doing it explicitly here is belt-and-suspenders and works even
    // before the migration is applied.
    const { data: teacher } = await supabase
      .from('teachers')
      .select('id')
      .eq('profile_id', user_id)
      .maybeSingle()

    if (teacher) {
      const { error: tsErr } = await supabase
        .from('teacher_subjects')
        .delete()
        .eq('teacher_id', teacher.id)
      if (tsErr) throw new Error(`Failed to delete teacher subjects: ${tsErr.message}`)

      const { error: tErr } = await supabase
        .from('teachers')
        .delete()
        .eq('id', teacher.id)
      if (tErr) throw new Error(`Failed to delete teacher: ${tErr.message}`)
    }

    // Nullify audit_log references (user_id is already nullable in schema)
    await supabase.from('audit_logs').update({ user_id: null }).eq('user_id', user_id)

    // Delete the profile row. After the migration:
    //   - marks.entered_by and announcements.created_by SET NULL automatically
    // Before the migration those columns are NOT NULL and will block deletion only
    // if the teacher has previously entered marks or created announcements.
    const { error: profileErr } = await supabase
      .from('profiles')
      .delete()
      .eq('id', user_id)
    if (profileErr) throw new Error(`Failed to delete profile: ${profileErr.message}`)

    // Finally delete the auth user
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
