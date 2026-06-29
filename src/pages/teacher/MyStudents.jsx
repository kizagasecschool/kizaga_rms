import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'

function MyStudents() {
  const { profile } = useAuth()
  const [loading, setLoading] = useState(true)
  const [groups, setGroups] = useState([])

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const { data: teacher } = await supabase
          .from('teachers')
          .select('id')
          .eq('profile_id', profile?.id)
          .single()
        if (!teacher) return

        const { data: assignments } = await supabase
          .from('teacher_subjects')
          .select('*, class_streams!inner(*, classes!inner(*), streams!inner(*)), subjects!inner(*)')
          .eq('teacher_id', teacher.id)

        if (!assignments || assignments.length === 0) return

        const subjectIds = [...new Set(assignments.map(a => a.subject_id))]

        // Separate O-Level (query by class_id) and A-Level (query by class_stream_id)
        const oLevelClassIds = [...new Set(
          assignments
            .filter(a => a.class_streams?.classes?.level !== 'A_LEVEL')
            .map(a => a.class_streams?.class_id).filter(Boolean)
        )]
        const aLevelStreamIds = [...new Set(
          assignments
            .filter(a => a.class_streams?.classes?.level === 'A_LEVEL')
            .map(a => a.class_stream_id).filter(Boolean)
        )]

        const fetchPromises = []
        if (oLevelClassIds.length > 0)
          fetchPromises.push(supabase.from('students').select('*').in('class_id', oLevelClassIds).eq('status', 'active').order('surname'))
        if (aLevelStreamIds.length > 0)
          fetchPromises.push(supabase.from('students').select('*').in('class_stream_id', aLevelStreamIds).eq('status', 'active').order('surname'))

        const [ssRes, subRes, ...studentResults] = await Promise.all([
          supabase.from('student_subjects').select('student_id, subject_id').in('subject_id', subjectIds).limit(2000),
          supabase.from('subjects').select('*').in('id', subjectIds),
          ...fetchPromises,
        ])

        const students = studentResults.flatMap(r => r.data || []).slice().sort((a, b) => {
          const gA = a.gender === 'Female' ? 0 : 1
          const gB = b.gender === 'Female' ? 0 : 1
          if (gA !== gB) return gA - gB
          const s1 = (a.first_name || '').localeCompare(b.first_name || '')
          if (s1 !== 0) return s1
          const s2 = (a.middle_name || '').localeCompare(b.middle_name || '')
          return s2 !== 0 ? s2 : (a.surname || '').localeCompare(b.surname || '')
        })
        const studentSubs = ssRes.data || []
        const subjects = subRes.data || []

        const subMap = {}
        subjects.forEach(s => { subMap[s.id] = s })

        const studentSubMap = {}
        studentSubs.forEach(ss => {
          if (!studentSubMap[ss.student_id]) studentSubMap[ss.student_id] = []
          studentSubMap[ss.student_id].push(ss.subject_id)
        })

        const grouped = []
        const processed = new Set()

        assignments.forEach(a => {
          const cs = a.class_streams
          const isOLevel = cs.classes?.level !== 'A_LEVEL'
          // For O-Level group by class; A-Level group by stream
          const groupKey = isOLevel ? `class_${cs.class_id}` : cs.id
          if (processed.has(groupKey)) return
          processed.add(groupKey)

          const cls = cs.classes
          const str = cs.streams
          const label = isOLevel
            ? (cls?.class_name || 'Unknown')
            : (cls && str ? `${cls.class_name} - ${str.stream_name}` : 'Unknown')

          const groupSubjectIds = isOLevel
            ? [...new Set(assignments.filter(a2 => a2.class_streams?.class_id === cs.class_id).map(a2 => a2.subject_id))]
            : [...new Set(assignments.filter(a2 => a2.class_stream_id === cs.id).map(a2 => a2.subject_id))]

          const subjectNames = groupSubjectIds.map(sid => subMap[sid]?.subject_name || '?').join(', ')

          const studentList = students
            .filter(s => isOLevel ? s.class_id === cs.class_id : s.class_stream_id === cs.id)
            .map(s => {
              if (isOLevel) {
                // O-Level: all students take the same class subjects
                return { ...s, subjects: subjectNames, subjectCount: groupSubjectIds.length }
              }
              const ssIds = studentSubMap[s.id] || []
              const matchingSubs = groupSubjectIds.filter(sid => ssIds.includes(sid))
              return {
                ...s,
                subjects: matchingSubs.map(sid => subMap[sid]?.subject_name || '?').join(', '),
                subjectCount: matchingSubs.length,
              }
            })
            .filter(s => s.subjectCount > 0)

          if (studentList.length > 0) {
            grouped.push({ id: groupKey, label, students: studentList, subjectCount: groupSubjectIds.length })
          }
        })

        grouped.sort((a, b) => a.label.localeCompare(b.label))
        setGroups(grouped)
      } catch (err) {
        console.error('Load my students error:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [profile])

  const totalStudents = useMemo(() =>
    groups.reduce((sum, g) => sum + g.students.length, 0),
    [groups]
  )

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">My Students</h1>
        <p className="text-gray-500 mt-1">
          {loading ? 'Loading...' : `${totalStudents} student${totalStudents !== 1 ? 's' : ''} across ${groups.length} class${groups.length !== 1 ? 'es' : ''}`}
        </p>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-5 animate-pulse">
              <div className="h-5 w-48 bg-gray-200 rounded mb-3" />
              <div className="h-4 w-full bg-gray-100 rounded mb-2" />
              <div className="h-4 w-3/4 bg-gray-100 rounded" />
            </div>
          ))}
        </div>
      ) : groups.length === 0 ? (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 text-sm text-amber-700">
          <div className="flex items-center gap-2 mb-1">
            <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
            </svg>
            <span className="font-medium">No students assigned</span>
          </div>
          <p className="text-xs">You haven't been assigned any classes or subjects yet. Contact the admin or academic officer.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map(group => (
            <div key={group.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-5 py-4 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-gray-900">{group.label}</h2>
                <span className="text-xs text-gray-500">
                  {group.students.length} student{group.students.length !== 1 ? 's' : ''} · {group.subjectCount} subject{group.subjectCount !== 1 ? 's' : ''}
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-100 bg-white">
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider w-8">#</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Student Name</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider w-24">Adm No</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Subjects</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {group.students.map((s, idx) => (
                      <tr key={s.id} className="hover:bg-gray-50 transition">
                        <td className="px-4 py-2.5 text-xs text-gray-400 align-middle">{idx + 1}</td>
                        <td className="px-4 py-2.5 align-middle">
                          <p className="text-sm font-medium text-gray-900 whitespace-nowrap">
                            {[s.first_name, s.middle_name, s.surname].filter(Boolean).join(' ')}
                          </p>
                        </td>
                        <td className="px-4 py-2.5 align-middle">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700">{s.admission_number}</span>
                        </td>
                        <td className="px-4 py-2.5 align-middle">
                          <p className="text-xs text-gray-600 max-w-xs truncate">{s.subjects}</p>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default MyStudents
