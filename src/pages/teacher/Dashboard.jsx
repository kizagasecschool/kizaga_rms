import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import StudentsByClassTable from '../../components/StudentsByClassTable'

async function fetchAllRows(buildQuery, pageSize = 1000) {
  let from = 0
  const all = []
  while (true) {
    const { data, error } = await buildQuery().range(from, from + pageSize - 1)
    if (error) throw error
    if (!data || data.length === 0) break
    all.push(...data)
    if (data.length < pageSize) break
    from += pageSize
  }
  return all
}

async function fetchAssignedStudentIds(subjectId, studentIds) {
  if (!subjectId || !studentIds?.length) return []
  const PAGE = 1000
  const CHUNK = 50
  const ids = []
  for (let i = 0; i < studentIds.length; i += CHUNK) {
    const chunkIds = studentIds.slice(i, i + CHUNK)
    let from = 0
    while (true) {
      const { data, error } = await supabase
        .from('student_subjects')
        .select('student_id')
        .eq('subject_id', subjectId)
        .in('student_id', chunkIds)
        .range(from, from + PAGE - 1)
      if (error) throw error
      if (!data || data.length === 0) break
      ids.push(...data.map(row => row.student_id))
      if (data.length < PAGE) break
      from += PAGE
    }
  }
  return [...new Set(ids)]
}

function TeacherDashboard() {
  const { profile } = useAuth()
  const [stats, setStats] = useState({ students: 0, subjects: 0, marks: 0, pending: 0 })
  const [entryStatus, setEntryStatus] = useState([])
  const [loading, setLoading] = useState(true)
  const [schoolInfo, setSchoolInfo] = useState(null)
  const [oLevelClassIds, setOLevelClassIds] = useState([])
  const [aLevelStreamIds, setALevelStreamIds] = useState([])

  useEffect(() => {
    supabase.from('school_settings').select('logo_url, school_name').limit(1).then(({ data }) => {
      if (data?.[0]) setSchoolInfo(data[0])
    })
  }, [])

  useEffect(() => {
    const fetchStats = async () => {
      const { data: teacher } = await supabase
        .from('teachers')
        .select('id')
        .eq('profile_id', profile?.id)
        .single()

      if (!teacher) {
        setLoading(false)
        return
      }

      const { data: assignments } = await supabase
        .from('teacher_subjects')
        .select('*, class_streams!inner(class_id, stream_id, classes!inner(class_name, level)), subjects!inner(*)')
        .eq('teacher_id', teacher.id)

      const subjectIds = [...new Set(assignments?.map((a) => a.subject_id) || [])]

      // O-Level students are tracked by class_id (class_stream_id is NULL for them);
      // A-Level students are tracked by class_stream_id.
      const oLevelClassIds = [...new Set(
        (assignments || [])
          .filter((a) => a.class_streams?.classes?.level !== 'A_LEVEL')
          .map((a) => a.class_streams?.class_id)
          .filter(Boolean)
      )]
      const aLevelStreamIds = [...new Set(
        (assignments || [])
          .filter((a) => a.class_streams?.classes?.level === 'A_LEVEL')
          .map((a) => a.class_stream_id)
          .filter(Boolean)
      )]
      setOLevelClassIds(oLevelClassIds)
      setALevelStreamIds(aLevelStreamIds)

      const classIds = [...new Set([
        ...oLevelClassIds,
        ...(assignments || [])
          .filter((a) => a.class_streams?.classes?.level === 'A_LEVEL')
          .map((a) => a.class_streams?.class_id)
          .filter(Boolean),
      ])]

      // Get all exam_ids for those classes
      const { data: examClassRows } = classIds.length > 0
        ? await supabase.from('exam_classes').select('exam_id, class_id').in('class_id', classIds)
        : { data: [] }

      // Build: classId → examIds[]
      const classExamMap = {}
      ;(examClassRows || []).forEach(ec => {
        if (!classExamMap[ec.class_id]) classExamMap[ec.class_id] = []
        classExamMap[ec.class_id].push(ec.exam_id)
      })

      const allExamIds = [...new Set((examClassRows || []).map(ec => ec.exam_id))]

      const [sOLevelRes, sALevelRes, subRes, mRes, strRes, examRes] = await Promise.all([
        oLevelClassIds.length > 0
          ? supabase.from('students').select('*', { count: 'exact', head: true }).in('class_id', oLevelClassIds).eq('status', 'active')
          : { count: 0 },
        aLevelStreamIds.length > 0
          ? supabase.from('students').select('*', { count: 'exact', head: true }).in('class_stream_id', aLevelStreamIds).eq('status', 'active')
          : { count: 0 },
        subjectIds.length > 0
          ? supabase.from('subjects').select('*', { count: 'exact', head: true }).in('id', subjectIds)
          : { count: 0 },
        supabase.from('marks').select('*', { count: 'exact', head: true }).eq('entered_by', profile?.id),
        supabase.from('streams').select('id, stream_name').order('stream_name'),
        allExamIds.length > 0
          ? supabase.from('exams').select('id, name, exam_type, status').in('id', allExamIds)
          : { data: [] },
      ])

      const streamNameMap = {}
      ;(strRes?.data || []).forEach(s => { streamNameMap[s.id] = s.stream_name })

      const examMeta = {}
      ;(examRes?.data || []).forEach(e => { examMeta[e.id] = e })

      // Marks entered by this teacher for the relevant exams/subjects,
      // counted per (exam, subject) → student_id set.
      const marksByKey = {}
      if (profile?.id && allExamIds.length > 0 && subjectIds.length > 0) {
        const teacherMarks = await fetchAllRows(() => supabase
          .from('marks')
          .select('exam_id, subject_id, student_id')
          .eq('entered_by', profile.id)
          .in('exam_id', allExamIds)
          .in('subject_id', subjectIds))
        teacherMarks.forEach(m => {
          const k = `${m.exam_id}_${m.subject_id}`
          if (!marksByKey[k]) marksByKey[k] = new Set()
          marksByKey[k].add(m.student_id)
        })
      }

      // Build per subject+class(+stream) entry status.
      // Dedupe by (class-or-stream, subject) — O-Level classes can have several
      // teacher_subjects rows (one per stream) that all resolve to the same class_id.
      const seenGroups = new Set()
      const rows = []
      let pending = 0
      for (const a of (assignments || [])) {
        const isOLevel = a.class_streams?.classes?.level !== 'A_LEVEL'
        const classId = a.class_streams?.class_id
        const groupKey = isOLevel ? `class_${classId}_${a.subject_id}` : `stream_${a.class_stream_id}_${a.subject_id}`
        if (seenGroups.has(groupKey)) continue
        seenGroups.add(groupKey)

        const subject = a.subjects || {}
        // Only the CURRENT exam (status = entering_marks) counts toward pending.
        // Past exams (processed/published/locked) are no longer shown or counted,
        // so once an exam is processed there is nothing pending until a new exam.
        const applicableExams = (classExamMap[classId] || [])
          .filter(examId => examMeta[examId]?.status === 'entering_marks')
        if (applicableExams.length === 0) continue

        // Pool of active students for this class (O-Level) or stream (A-Level)
        const { data: poolData } = isOLevel
          ? await supabase.from('students').select('id').eq('class_id', classId).eq('status', 'active')
          : await supabase.from('students').select('id').eq('class_stream_id', a.class_stream_id).eq('status', 'active')
        const poolIds = (poolData || []).map(s => s.id)

        // Expected = students who actually take this subject (matches Enter Marks)
        const isCompulsoryOLevel = isOLevel && (subject.subject_type === 'COMPULSORY' || !subject.subject_type)
        const expected = isCompulsoryOLevel
          ? poolIds.length
          : (await fetchAssignedStudentIds(a.subject_id, poolIds)).length

        const className = a.class_streams?.classes?.class_name
        const streamName = isOLevel ? '' : (streamNameMap[a.class_stream_id] || '')

        for (const examId of applicableExams) {
          const entered = (marksByKey[`${examId}_${a.subject_id}`] || new Set()).size
          rows.push({
            key: `${groupKey}_${examId}`,
            subjectName: subject.subject_name,
            subjectCode: subject.subject_code,
            className,
            streamName,
            students: expected,
            exam: examMeta[examId],
            entered,
            completed: expected > 0 && entered >= expected,
          })
          if (expected > entered) pending += (expected - entered)
        }
      }
      rows.sort((x, y) => {
        const c = (x.className || '').localeCompare(y.className || '')
        if (c !== 0) return c
        return (x.subjectName || '').localeCompare(y.subjectName || '')
      })

      setEntryStatus(rows)
      setStats({
        students: (sOLevelRes.count ?? 0) + (sALevelRes.count ?? 0),
        subjects: subRes.count ?? 0,
        marks: mRes.count ?? 0,
        pending: Math.max(0, pending),
      })
      setLoading(false)
    }
    fetchStats()
  }, [profile])

  const cards = [
    { label: 'My Students', value: stats.students, color: 'bg-gray-100 text-gray-600', icon: 'M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z' },
    { label: 'My Subjects', value: stats.subjects, color: 'bg-gray-100 text-gray-600', icon: 'M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z' },
    { label: 'Results Entered', value: stats.marks, color: 'bg-gray-100 text-gray-600', icon: 'M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
    { label: 'Pending Entries', value: stats.pending, color: 'bg-gray-100 text-gray-600', icon: 'M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z' },
  ]

  return (
    <div>
      <div className="mb-8 flex items-center gap-4">
        {schoolInfo?.logo_url && (
          <img src={schoolInfo.logo_url} alt="" className="w-14 h-14 object-contain shrink-0" crossOrigin="anonymous" />
        )}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Teacher Dashboard</h1>
          <p className="text-gray-500 mt-1">Welcome, {profile?.full_name}. Manage your classes and results.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {cards.map((stat) => (
          <div key={stat.label} className="bg-white rounded-xl border border-gray-200 p-5 transition">
            <div className={`w-10 h-10 rounded-lg ${stat.color} flex items-center justify-center mb-3`}>
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d={stat.icon} />
              </svg>
            </div>
            <p className="text-2xl font-bold text-gray-900">
              {loading ? <span className="w-8 h-5 inline-block bg-gray-200 rounded animate-pulse" /> : stat.value}
            </p>
            <p className="text-sm text-gray-500 mt-1">{stat.label}</p>
          </div>
        ))}
      </div>

      {!loading && entryStatus.length > 0 && (
        <div className="mt-8">
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-semibold text-gray-900">Marks Entry Status</h2>
              <span className="text-xs text-gray-500">
                {entryStatus.filter(r => r.completed).length} of {entryStatus.length} complete
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase">Subject</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase">Class</th>
                    <th className="text-center px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase">Students</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase">Exam</th>
                    <th className="text-center px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase">Entered</th>
                    <th className="text-center px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {entryStatus.map(r => (
                    <tr key={r.key} className="hover:bg-gray-50 transition">
                      <td className="px-4 py-2.5">
                        <span className="font-medium text-gray-900">{r.subjectName || 'Unknown'}</span>
                        {r.subjectCode && <span className="text-xs text-gray-400 ml-1.5">{r.subjectCode}</span>}
                      </td>
                      <td className="px-4 py-2.5 text-gray-700 whitespace-nowrap">
                        {r.className || '-'}
                        {r.streamName && <span className="text-xs text-gray-400"> ({r.streamName})</span>}
                      </td>
                      <td className="px-4 py-2.5 text-center text-gray-900">{r.students}</td>
                      <td className="px-4 py-2.5 text-gray-700">{r.exam?.name || 'Unknown exam'}</td>
                      <td className="px-4 py-2.5 text-center text-gray-700">{r.entered} / {r.students}</td>
                      <td className="px-4 py-2.5 text-center">
                        {r.completed ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-green-100 text-green-700 text-xs font-semibold">
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                            </svg>
                            Completed
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 text-xs font-semibold">
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                            </svg>
                            Pending
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {!loading && (
        <div className="mt-8">
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <Link
                to="/teacher/enter-marks"
                className="flex items-center gap-3 px-4 py-3 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:border-maroon-300 hover:text-maroon-600 hover:bg-maroon-50/50 transition"
              >
                <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Enter Marks
              </Link>
            </div>
          </div>
        </div>
      )}

      {!loading && (oLevelClassIds.length > 0 || aLevelStreamIds.length > 0) && (
        <div className="mt-8">
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Students by Class</h2>
            <StudentsByClassTable oLevelClassIds={oLevelClassIds} aLevelStreamIds={aLevelStreamIds} />
          </div>
        </div>
      )}

      {!loading && stats.students === 0 && (
        <div className="mt-8 bg-amber-50 border border-amber-200 rounded-xl p-5 text-sm text-amber-700">
          <div className="flex items-center gap-2 mb-1">
            <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
            </svg>
            <span className="font-medium">No assignments yet</span>
          </div>
          <p className="text-xs">You haven't been assigned any classes or subjects. Contact the admin or academic officer.</p>
        </div>
      )}
    </div>
  )
}

export default TeacherDashboard
