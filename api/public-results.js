import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )

  const { action, admissionNo, studentId, examId } = req.body || {}

  try {
    // ── Lookup student + exams + subjects + grades ──────────────────────────
    if (action === 'lookup') {
      if (!admissionNo?.trim()) return res.status(400).json({ error: 'admissionNo required' })

      const { data: student } = await supabase
        .from('students')
        .select('id, first_name, middle_name, surname, gender, class_id, class_stream_id, admission_number, classes(class_name, level)')
        .ilike('admission_number', admissionNo.trim())
        .maybeSingle()

      if (!student) return res.json({ student: null })

      const [examClassesRes, classSubjRes, gradesRes] = await Promise.all([
        supabase.from('exam_classes').select('exam_id, exams!inner(*)').eq('class_id', student.class_id),
        supabase.from('class_subjects').select('subject_id, subjects(*)').eq('class_id', student.class_id),
        supabase.from('grades').select('*').order('min_mark', { ascending: false }),
      ])

      const seen = new Set()
      const exams = []
      ;(examClassesRes.data || []).forEach(ec => {
        if (!seen.has(ec.exam_id)) { seen.add(ec.exam_id); exams.push(ec.exams) }
      })
      exams.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))

      const subjects = (classSubjRes.data || []).map(cs => cs.subjects).filter(Boolean)

      return res.json({ student, exams, subjects, grades: gradesRes.data || [] })
    }

    // ── Fetch marks + result row for one exam ───────────────────────────────
    if (action === 'results') {
      if (!studentId || !examId) return res.status(400).json({ error: 'studentId and examId required' })

      const [marksRes, resultRes] = await Promise.all([
        supabase.from('marks').select('*').eq('exam_id', examId).eq('student_id', studentId),
        supabase.from('student_results').select('*').eq('exam_id', examId).eq('student_id', studentId).maybeSingle(),
      ])

      return res.json({ marks: marksRes.data || [], resultRow: resultRes.data || null })
    }

    return res.status(400).json({ error: 'Unknown action' })
  } catch (err) {
    console.error('public-results error:', err)
    return res.status(500).json({ error: err.message || 'Server error' })
  }
}
