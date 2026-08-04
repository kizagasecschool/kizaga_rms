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
    const { data: classes, error: classErr } = await supabase
      .from('classes')
      .select('id, class_name, level, sort_order')
      .order('sort_order', { ascending: true })

    if (classErr) throw classErr

    const summary = []
    const updates = []

    for (let i = 0; i < classes.length; i++) {
      const current = classes[i]
      const next = classes[i + 1]

      const { count, error: countErr } = await supabase
        .from('students')
        .select('*', { count: 'exact', head: true })
        .eq('class_id', current.id)
        .eq('status', 'active')

      if (countErr) throw countErr

      if (next && current.level === next.level) {
        updates.push({
          from: current.class_name,
          from_id: current.id,
          to: next.class_name,
          to_id: next.id,
          student_count: count,
          action: 'promote',
        })
      } else {
        updates.push({
          from: current.class_name,
          from_id: current.id,
          to: 'Graduated',
          to_id: null,
          student_count: count,
          action: 'graduate',
        })
      }
    }

    const results = []
    for (const u of updates) {
      if (u.action === 'promote') {
        const { error: updErr } = await supabase
          .from('students')
          .update({ class_id: u.to_id, class_stream_id: null, updated_at: new Date().toISOString() })
          .eq('class_id', u.from_id)
          .eq('status', 'active')

        if (updErr) throw updErr

        results.push({
          from: u.from,
          to: u.to,
          count: u.student_count,
          status: 'promoted',
        })
      } else {
        const { error: updErr } = await supabase
          .from('students')
          .update({ status: 'graduated', updated_at: new Date().toISOString() })
          .eq('class_id', u.from_id)
          .eq('status', 'active')

        if (updErr) throw updErr

        results.push({
          from: u.from,
          to: 'Graduated',
          count: u.student_count,
          status: 'graduated',
        })
      }
    }

    return res.status(200).json({
      message: 'Class upgrade completed successfully',
      results,
    })
  } catch (err) {
    console.error('upgrade-students error:', err)
    return res.status(500).json({ error: err.message || 'Failed to upgrade students' })
  }
}
