import { createClient } from 'jsr:@supabase/supabase-js@2'

interface TeacherInput {
  email: string
  password: string
  full_name: string
  employee_number: string
  qualification?: string
  phone?: string
  subject_ids?: string[]
  class_stream_ids?: string[]
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 })
  }

  try {
    const input: TeacherInput = await req.json()

    if (!input.email || !input.password || !input.full_name || !input.employee_number) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: email, password, full_name, employee_number' }),
        { status: 400 },
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, serviceRoleKey)

    const authRes = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify({
        email: input.email,
        password: input.password,
        email_confirm: true,
        user_metadata: {
          full_name: input.full_name,
          role: 'teacher',
        },
      }),
    })

    const authData = await authRes.json()
    if (!authRes.ok) {
      throw new Error(authData.msg || authData.error || 'Failed to create auth user')
    }

    const { error: profileErr } = await supabase.from('profiles').insert({
      id: authData.id,
      email: input.email,
      full_name: input.full_name,
      role: 'teacher',
    })
    if (profileErr && !profileErr.message.includes('duplicate key')) {
      await supabase.auth.admin.deleteUser(authData.id)
      throw profileErr
    }

    const { data: teacher, error: teacherErr } = await supabase
      .from('teachers')
      .insert({
        employee_number: input.employee_number,
        profile_id: authData.id,
        qualification: input.qualification || null,
        phone: input.phone || null,
        status: 'active',
      })
      .select('id')
      .single()
    if (teacherErr) {
      await supabase.from('profiles').delete().eq('id', authData.id)
      await supabase.auth.admin.deleteUser(authData.id)
      throw teacherErr
    }

    const subjectIds = Array.isArray(input.subject_ids) ? input.subject_ids : []
    const classStreamIds = Array.isArray(input.class_stream_ids) ? input.class_stream_ids : []

    if (subjectIds.length > 0 || classStreamIds.length > 0) {
      const assignments = []
      if (subjectIds.length > 0 && classStreamIds.length > 0) {
        for (const subject_id of subjectIds) {
          for (const class_stream_id of classStreamIds) {
            assignments.push({ teacher_id: teacher.id, subject_id, class_stream_id })
          }
        }
      } else if (subjectIds.length > 0) {
        for (const subject_id of subjectIds) {
          assignments.push({ teacher_id: teacher.id, subject_id })
        }
      } else if (classStreamIds.length > 0) {
        for (const class_stream_id of classStreamIds) {
          assignments.push({ teacher_id: teacher.id, class_stream_id })
        }
      }

      if (assignments.length > 0) {
        const { error: assignErr } = await supabase.from('teacher_subjects').insert(assignments)
        if (assignErr) {
          console.error('Failed to assign subjects:', assignErr)
        }
      }
    }

    return new Response(JSON.stringify({ id: teacher.id, auth_id: authData.id }), {
      headers: { 'Content-Type': 'application/json' },
      status: 201,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return new Response(JSON.stringify({ error: message }), { status: 500 })
  }
})
