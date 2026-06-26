import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import Modal from '../components/Modal'
import { useNotification } from '../context/NotificationContext'
import ErrorBoundary from '../components/ErrorBoundary'

const STATUSES = ['active', 'inactive', 'on_leave']

function Teachers() {
  const { showToast } = useNotification()
  const [loading, setLoading] = useState(true)

  const [teachers, setTeachers] = useState([])
  const [classes, setClasses] = useState([])
  const [streams, setStreams] = useState([])
  const [classStreams, setClassStreams] = useState([])
  const [subjects, setSubjects] = useState([])
  const [assignments, setAssignments] = useState([])
  const [classCombinations, setClassCombinations] = useState([])
  const [combinationSubjects, setCombinationSubjects] = useState([])
  const [streamCombinations, setStreamCombinations] = useState([])
  const [combinations, setCombinations] = useState([])

  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('')

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [formData, setFormData] = useState({})
  const [saving, setSaving] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(null)

  const [assignOpen, setAssignOpen] = useState(false)
  const [assignTeacher, setAssignTeacher] = useState(null)

  const [assignClassId, setAssignClassId] = useState('')
  const [assignStreamIds, setAssignStreamIds] = useState([])
  const [assignALevelStreamId, setAssignALevelStreamId] = useState('')
  const [assignSubjectIds, setAssignSubjectIds] = useState([])

  const fetchTeachers = useCallback(async () => {
    const { data } = await supabase
      .from('teachers')
      .select('*, profiles(*)')
      .order('created_at', { ascending: false })
    if (data) setTeachers(data)
  }, [])

  const fetchLookups = useCallback(async () => {
    const [cRes, sRes, csRes, subRes, cs2Res, ccRes, scRes, combRes] = await Promise.all([
      supabase.from('classes').select('*').order('sort_order'),
      supabase.from('streams').select('*').order('stream_name'),
      supabase.from('class_streams').select('*, classes(*), streams(*)'),
      supabase.from('subjects').select('*').order('subject_name'),
      supabase.from('combination_subjects').select('*'),
      supabase.from('class_combinations').select('*'),
      supabase.from('stream_combinations').select('*'),
      supabase.from('combinations').select('*').order('code'),
    ])
    if (cRes.data) setClasses(cRes.data)
    if (sRes.data) setStreams(sRes.data)
    if (csRes.data) setClassStreams(csRes.data)
    if (subRes.data) setSubjects(subRes.data)
    if (cs2Res.data) setCombinationSubjects(cs2Res.data)
    if (ccRes.data) setClassCombinations(ccRes.data)
    if (scRes.data) setStreamCombinations(scRes.data)
    if (combRes.data) setCombinations(combRes.data)
  }, [])

  const fetchAssignments = useCallback(async () => {
    const { data } = await supabase
      .from('teacher_subjects')
      .select('*, class_streams(*), subjects(*)')
    if (data) setAssignments(data)
  }, [])

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        await Promise.all([fetchTeachers(), fetchLookups(), fetchAssignments()])
      } catch (err) {
        console.error('Load error:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [fetchTeachers, fetchLookups, fetchAssignments])

  const filtered = teachers.filter((t) => {
    const q = search.toLowerCase()
    const fullName = (t.profiles?.full_name || '').toLowerCase()
    const empNum = (t.employee_number || '').toLowerCase()
    if (q && !fullName.includes(q) && !empNum.includes(q)) return false
    if (filterStatus && t.status !== filterStatus) return false
    return true
  })

  const getAssignmentsForTeacher = (teacherId) => {
    return assignments.filter((a) => a.teacher_id === teacherId)
  }

  const getClassSubjects = (classId) => {
    if (!classId) return []
    const cls = classes.find(c => c.id === classId)
    if (!cls) return []
    if (cls.level === 'O_LEVEL') {
      return subjects.filter(s => s.level === 'O_LEVEL')
    }
    if (cls.level === 'A_LEVEL') {
      const comboIds = classCombinations
        .filter(cc => cc.class_id === classId)
        .map(cc => cc.combination_id)
      const subjectIds = combinationSubjects
        .filter(cs => comboIds.includes(cs.combination_id))
        .map(cs => cs.subject_id)
      return subjects.filter(s => subjectIds.includes(s.id))
    }
    return []
  }

  const getStreamSubjects = (classStreamId) => {
    if (!classStreamId) return []
    const sc = streamCombinations.find((sc) => sc.class_stream_id === classStreamId)
    if (!sc) return []
    const subjectIds = combinationSubjects
      .filter((cs) => cs.combination_id === sc.combination_id)
      .map((cs) => cs.subject_id)
    return subjects.filter((s) => subjectIds.includes(s.id))
  }

  const openCreate = () => {
    setEditing(null)
    setFormData({
      email: '',
      password: '',
      full_name: '',
      employee_number: '',
      qualification: '',
      phone: '',
      status: 'active',
    })
    setFormOpen(true)
  }

  const openEdit = (teacher) => {
    setEditing(teacher)
    setFormData({
      email: teacher.profiles?.email || '',
      password: '',
      full_name: teacher.profiles?.full_name || '',
      employee_number: teacher.employee_number,
      qualification: teacher.qualification || '',
      phone: teacher.phone || '',
      status: teacher.status,
    })
    setFormOpen(true)
  }

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      if (editing) {
        const { error: profileErr } = await supabase
          .from('profiles')
          .update({ full_name: formData.full_name, email: formData.email })
          .eq('id', editing.profile_id)
        if (profileErr) throw profileErr

        const { error: teacherErr } = await supabase
          .from('teachers')
          .update({
            employee_number: formData.employee_number,
            qualification: formData.qualification || null,
            phone: formData.phone || null,
            status: formData.status,
          })
          .eq('id', editing.id)
        if (teacherErr) throw teacherErr

        await fetchTeachers()
        setFormOpen(false)
        showToast('Teacher updated successfully', 'success')
        } else {
        const res = await fetch('/api/register-teacher', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: formData.email,
            password: formData.password,
            full_name: formData.full_name,
            employee_number: formData.employee_number,
            qualification: formData.qualification || null,
            phone: formData.phone || null,
          }),
        })

        const text = await res.text()
        let result
        try {
          result = JSON.parse(text)
        } catch {
          throw new Error(text || `Server returned ${res.status}`)
        }

        if (!res.ok) {
          throw new Error(result.error || 'Failed to register teacher')
        }

        await fetchTeachers()
        setFormOpen(false)
        showToast('Teacher registered successfully', 'success')
      }
    } catch (err) {
      console.error('Save error:', err)
      showToast('Failed to save. ' + (err.message || ''), 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id) => {
    try {
      const teacher = teachers.find((t) => t.id === id)
      if (!teacher) return

      const res = await fetch('/api/delete-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: teacher.profile_id }),
      })

      const text = await res.text()
      let result
      try {
        result = JSON.parse(text)
      } catch {
        throw new Error(text || `Server returned ${res.status}`)
      }

      if (!res.ok) {
        throw new Error(result.error || 'Failed to delete teacher')
      }

      await fetchTeachers()
      setDeleteConfirm(null)
      showToast('Teacher deleted successfully', 'success')
    } catch (err) {
      console.error('Delete error:', err)
      showToast('Failed to delete. ' + (err.message || ''), 'error')
    }
  }

  const openAssign = (teacher) => {
    setAssignTeacher(teacher)
    setAssignClassId('')
    setAssignStreamIds([])
    setAssignALevelStreamId('')
    setAssignSubjectIds([])
    setAssignOpen(true)
  }

  const handleAssign = async () => {
    if (!assignTeacher?.id) {
      showToast('Teacher not selected', 'error')
      return
    }
    const assignClass = classes.find((c) => c.id === assignClassId)
    const isALevel = assignClass?.level === 'A_LEVEL'
    // O-Level: auto-expand to all streams of the class; A-Level: single selected stream
    const effectiveStreamIds = isALevel
      ? (assignALevelStreamId ? [assignALevelStreamId] : [])
      : classStreams.filter((cs) => cs.class_id === assignClassId).map((cs) => cs.id)
    if (!assignClassId || effectiveStreamIds.length === 0 || assignSubjectIds.length === 0) {
      showToast(isALevel ? 'Please select a stream and subjects' : 'Please select subjects', 'error')
      return
    }
    setSaving(true)
    try {
      const existing = assignments.filter(
        (a) => a.teacher_id === assignTeacher.id && effectiveStreamIds.includes(a.class_stream_id) && assignSubjectIds.includes(a.subject_id)
      )

      const toInsert = []
      effectiveStreamIds.forEach(sid => {
        assignSubjectIds.forEach(subId => {
          if (!existing.find(e => e.class_stream_id === sid && e.subject_id === subId)) {
            toInsert.push({
              teacher_id: assignTeacher.id,
              class_stream_id: sid,
              subject_id: subId,
            })
          }
        })
      })

      if (toInsert.length === 0) {
        showToast('All selected combinations already assigned', 'warning')
        setSaving(false)
        return
      }

      const { error } = await supabase.from('teacher_subjects').insert(toInsert)
      if (error) throw error

      await fetchAssignments()
      setAssignClassId('')
      setAssignStreamIds([])
      setAssignSubjectIds([])
      showToast(`Assigned ${toInsert.length} combination(s)`, 'success')
    } catch (err) {
      console.error('Assign error:', err)
      showToast('Failed to assign. ' + (err.message || ''), 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleUnassignClassSubject = async (classId, subjectId) => {
    try {
      const streamIds = classStreams
        .filter(cs => cs.class_id === classId)
        .map(cs => cs.id)

      const { error } = await supabase
        .from('teacher_subjects')
        .delete()
        .eq('teacher_id', assignTeacher.id)
        .eq('subject_id', subjectId)
        .in('class_stream_id', streamIds)

      if (error) throw error
      await fetchAssignments()
      showToast('Assignment removed', 'success')
    } catch (err) {
      console.error('Unassign error:', err)
      showToast('Failed to remove assignment.', 'error')
    }
  }

  const teacherAssignments = assignTeacher ? getAssignmentsForTeacher(assignTeacher.id) : []

  const getAssignmentsByClassSubject = () => {
    const map = {}
    teacherAssignments.forEach(a => {
      const cs = classStreams.find(c => c.id === a.class_stream_id)
      if (!cs) return
      if (!map[cs.class_id]) map[cs.class_id] = {}
      if (!map[cs.class_id][a.subject_id]) map[cs.class_id][a.subject_id] = []
      map[cs.class_id][a.subject_id].push(a)
    })
    return map
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-3 border-gray-200 border-t-maroon-600 rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <ErrorBoundary>
    <div>
      <div className="mb-8 flex flex-col sm:flex-row items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Teacher Registration</h1>
          <p className="text-gray-500 mt-1">Register, edit, and manage teachers. Assign classes and subjects.</p>
        </div>
        <button
          onClick={openCreate}
          className="px-4 py-2 bg-maroon-600 text-white text-sm font-medium rounded-lg hover:bg-maroon-700 transition"
        >
          + Add Teacher
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-100 space-y-3 sm:space-y-0 sm:flex sm:items-center sm:gap-3">
          <div className="flex-1 relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or employee number..."
              className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-maroon-500 focus:border-maroon-500"
            />
          </div>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-maroon-500"
          >
            <option value="">All Statuses</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1).replace('_', ' ')}</option>
            ))}
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider w-28">Employee #</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Full Name</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Email</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden lg:table-cell">Qualification</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Phone</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider w-24">Status</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider w-28">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-sm text-gray-400">
                    {search || filterStatus ? 'No matching teachers found.' : 'No teachers registered yet. Click "+ Add Teacher" to begin.'}
                  </td>
                </tr>
              )}
              {filtered.map((t) => {
                return (
                  <tr key={t.id} className="hover:bg-gray-50 transition">
                    <td className="px-4 py-3.5">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700 whitespace-nowrap">
                        {t.employee_number}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <p className="text-sm font-medium text-gray-900">{t.profiles?.full_name || 'Unknown'}</p>
                    </td>
                    <td className="px-4 py-3.5 text-sm text-gray-600 max-w-[180px] truncate">{t.profiles?.email || '-'}</td>
                    <td className="px-4 py-3.5 text-sm text-gray-600 hidden lg:table-cell">{t.qualification || '-'}</td>
                    <td className="px-4 py-3.5 text-sm text-gray-600 whitespace-nowrap">{t.phone || '-'}</td>
                    <td className="px-4 py-3.5">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${
                        t.status === 'active' ? 'bg-emerald-50 text-emerald-700' :
                        t.status === 'on_leave' ? 'bg-amber-50 text-amber-700' :
                        'bg-gray-100 text-gray-600'
                      }`}>
                        {t.status === 'on_leave' ? 'On Leave' : t.status.charAt(0).toUpperCase() + t.status.slice(1)}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openAssign(t)}
                          title="Assign subjects"
                          className="p-1.5 rounded-lg text-maroon-600 hover:bg-maroon-50 hover:text-maroon-800 transition"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                          </svg>
                        </button>
                        <button
                          onClick={() => openEdit(t)}
                          title="Edit teacher"
                          className="p-1.5 rounded-lg text-maroon-600 hover:bg-maroon-50 hover:text-maroon-800 transition"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(t)}
                          title="Delete teacher"
                          className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 hover:text-red-700 transition"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <div className="px-5 py-3 border-t border-gray-100 bg-gray-50 flex items-center justify-between">
          <span className="text-xs text-gray-500">{filtered.length} teacher(s)</span>
        </div>
      </div>

      {/* Add/Edit Modal */}
      <Modal isOpen={formOpen} onClose={() => setFormOpen(false)} title="" className="max-w-2xl">
        <div className="border-b border-gray-100 px-6 py-4 -mx-6 -mt-6 mb-6 bg-maroon-50/50 rounded-t-xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-maroon-100 rounded-xl flex items-center justify-center">
              <svg className="w-5 h-5 text-maroon-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.438 60.438 0 0 0-.491 6.347A48.62 48.62 0 0 1 12 20.904a48.62 48.62 0 0 1 8.232-4.41 60.46 60.46 0 0 0-.491-6.347m-15.482 0a50.636 50.636 0 0 0-2.658-.813A59.906 59.906 0 0 1 12 3.493a59.903 59.903 0 0 1 10.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0 1 12 13.489a50.702 50.702 0 0 1 7.74-3.342" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">{editing ? 'Edit Teacher' : 'Register New Teacher'}</h2>
              <p className="text-sm text-gray-500">{editing ? 'Update the teacher\'s information below' : 'Fill in the teacher\'s details below'}</p>
            </div>
          </div>
        </div>
        <form onSubmit={handleSave} className="space-y-6">
          <div className="bg-gray-50/50 rounded-xl p-5 border border-gray-100">
            <div className="flex items-center gap-2 mb-4">
              <svg className="w-4 h-4 text-maroon-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
              </svg>
              <span className="text-sm font-semibold text-gray-800">Personal Information</span>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Full Name <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  required
                  value={formData.full_name || ''}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-sm outline-none focus:border-maroon-400 focus:ring-4 focus:ring-maroon-500/10 transition placeholder:text-gray-400"
                  placeholder="e.g. John Doe"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">Qualification</label>
                  <input
                    type="text"
                    value={formData.qualification || ''}
                    onChange={(e) => setFormData({ ...formData, qualification: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-sm outline-none focus:border-maroon-400 focus:ring-4 focus:ring-maroon-500/10 transition placeholder:text-gray-400"
                    placeholder="e.g. B.Ed, MSc"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">Phone Number</label>
                  <input
                    type="text"
                    value={formData.phone || ''}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-sm outline-none focus:border-maroon-400 focus:ring-4 focus:ring-maroon-500/10 transition placeholder:text-gray-400"
                    placeholder="e.g. +255712345678"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="bg-gray-50/50 rounded-xl p-5 border border-gray-100">
            <div className="flex items-center gap-2 mb-4">
              <svg className="w-4 h-4 text-maroon-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
              </svg>
              <span className="text-sm font-semibold text-gray-800">Account & Employee Information</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Employee Number <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  required
                  value={formData.employee_number || ''}
                  onChange={(e) => setFormData({ ...formData, employee_number: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-sm outline-none focus:border-maroon-400 focus:ring-4 focus:ring-maroon-500/10 transition placeholder:text-gray-400"
                  placeholder="e.g. T001"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Email <span className="text-red-500">*</span></label>
                <input
                  type="email"
                  required
                  value={formData.email || ''}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-sm outline-none focus:border-maroon-400 focus:ring-4 focus:ring-maroon-500/10 transition placeholder:text-gray-400"
                  placeholder="e.g. john@school.ac.tz"
                />
              </div>
            </div>
            {!editing && (
              <div className="mt-4">
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Password <span className="text-red-500">*</span></label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={formData.password || ''}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-sm outline-none focus:border-maroon-400 focus:ring-4 focus:ring-maroon-500/10 transition placeholder:text-gray-400"
                  placeholder="Min. 6 characters"
                />
              </div>
            )}
            {editing && (
              <div className="mt-4">
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Status</label>
                <select
                  value={formData.status || 'active'}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-sm outline-none focus:border-maroon-400 focus:ring-4 focus:ring-maroon-500/10 transition"
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>{s === 'on_leave' ? 'On Leave' : s.charAt(0).toUpperCase() + s.slice(1)}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-3 pt-2 border-t border-gray-100">
            <button
              type="button"
              onClick={() => setFormOpen(false)}
              className="px-5 py-2.5 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 hover:border-gray-300 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 text-sm font-medium text-white bg-maroon-600 rounded-xl hover:bg-maroon-700 active:bg-maroon-800 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center gap-2"
            >
              {saving ? (
                <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Saving...</>
              ) : (
                <><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
                {editing ? 'Update Teacher' : 'Register Teacher'}</>
              )}
            </button>
          </div>
        </form>
      </Modal>

      {/* Assign Subjects Modal */}
      <Modal
        isOpen={assignOpen}
        onClose={() => setAssignOpen(false)}
        title={`Assign Subjects - ${assignTeacher?.profiles?.full_name || ''}`}
        className="max-w-3xl"
      >
        <div className="space-y-6">
          <div className="bg-maroon-50 border border-maroon-200 rounded-lg p-4 text-sm text-maroon-800">
            <p className="font-medium mb-1">Assign subjects to this teacher</p>
            <p className="text-xs">O-Level: select a class and subjects. A-Level: select a class, choose a stream, then subjects.</p>
          </div>

          <div className="bg-gray-50/50 rounded-xl p-5 border border-gray-100">
            <div className="flex items-center gap-2 mb-4">
              <svg className="w-4 h-4 text-maroon-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              <span className="text-sm font-semibold text-gray-800">New Assignment</span>
            </div>

            <div className="mb-4">
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Class</label>
              <select
                value={assignClassId}
                onChange={(e) => {
                  const newClassId = e.target.value
                  setAssignClassId(newClassId)
                  setAssignSubjectIds([])
                  setAssignALevelStreamId('')
                  const allStreamIds = classStreams
                    .filter(cs => cs.class_id === newClassId)
                    .map(cs => cs.id)
                  setAssignStreamIds(allStreamIds)
                }}
                className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-sm outline-none focus:border-maroon-400 focus:ring-4 focus:ring-maroon-500/10 transition"
              >
                <option value="">-- Select Class --</option>
                {['O_LEVEL', 'A_LEVEL'].map(level => {
                  const levelClasses = classes.filter(c => c.level === level)
                  if (!levelClasses.length) return null
                  return (
                    <optgroup key={level} label={level === 'O_LEVEL' ? 'O-Level' : 'A-Level'}>
                      {levelClasses.map(c => (
                        <option key={c.id} value={c.id}>{c.class_name}</option>
                      ))}
                    </optgroup>
                  )
                })}
              </select>
            </div>

            {assignClassId && (() => {
              const assignClass = classes.find((c) => c.id === assignClassId)
              const isALevel = assignClass?.level === 'A_LEVEL'
              const classStreamList = classStreams.filter(cs => cs.class_id === assignClassId)
              const streamSubjects = isALevel ? getStreamSubjects(assignALevelStreamId) : getClassSubjects(assignClassId)
              const selectedStreamCombo = isALevel && assignALevelStreamId
                ? streamCombinations.find(sc => sc.class_stream_id === assignALevelStreamId)
                : null
              const selectedCombo = selectedStreamCombo
                ? combinations.find(c => c.id === selectedStreamCombo.combination_id)
                : null

              return (
                <>
                  {isALevel && (
                    /* A-Level: single stream dropdown */
                    <div className="mb-4">
                      <label className="block text-xs font-medium text-gray-600 mb-1.5">Stream</label>
                      <select
                        value={assignALevelStreamId}
                        onChange={(e) => {
                          setAssignALevelStreamId(e.target.value)
                          setAssignSubjectIds([])
                        }}
                        className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-sm outline-none focus:border-maroon-400 focus:ring-4 focus:ring-maroon-500/10 transition"
                      >
                        <option value="">-- Select Stream --</option>
                        {classStreamList.map(cs => {
                          const str = streams.find(s => s.id === cs.stream_id)
                          const sc = streamCombinations.find(sc => sc.class_stream_id === cs.id)
                          const combo = sc ? combinations.find(c => c.id === sc.combination_id) : null
                          return (
                            <option key={cs.id} value={cs.id}>
                              {str?.stream_name || '?'}{combo ? ` — ${combo.code} (${combo.name})` : ' — No combination assigned'}
                            </option>
                          )
                        })}
                        {classStreamList.length === 0 && (
                          <option disabled>No streams found</option>
                        )}
                      </select>
                      {assignALevelStreamId && !selectedStreamCombo && (
                        <p className="mt-1.5 text-xs text-amber-600">
                          No combination assigned to this stream. Go to Class Subjects to assign one first.
                        </p>
                      )}
                      {selectedCombo && (
                        <p className="mt-1.5 text-xs text-emerald-600 font-medium">
                          Combination: {selectedCombo.code} — {selectedCombo.name}
                        </p>
                      )}
                    </div>
                  )}
                  {/* Subjects — shown for O-Level always, A-Level only after stream selected */}
                  {(!isALevel || assignALevelStreamId) && (
                    <div className="mb-4">
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-xs font-medium text-gray-600">
                          Subjects {isALevel && selectedCombo ? <span className="text-gray-400 font-normal">({selectedCombo.code})</span> : ''}
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            setAssignSubjectIds(prev =>
                              prev.length === streamSubjects.length ? [] : streamSubjects.map(s => s.id)
                            )
                          }}
                          className="text-xs text-maroon-600 hover:text-maroon-800 font-medium"
                        >
                          {assignSubjectIds.length === streamSubjects.length && streamSubjects.length > 0 ? 'Deselect All' : 'Select All'}
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {streamSubjects.map(sub => {
                          const checked = assignSubjectIds.includes(sub.id)
                          return (
                            <label
                              key={sub.id}
                              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm cursor-pointer transition ${
                                checked ? 'border-maroon-400 bg-maroon-50 text-maroon-700' : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => {
                                  setAssignSubjectIds(prev =>
                                    prev.includes(sub.id) ? prev.filter(id => id !== sub.id) : [...prev, sub.id]
                                  )
                                }}
                                className="sr-only"
                              />
                              {checked ? (
                                <svg className="w-3.5 h-3.5 text-maroon-600" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                              ) : (
                                <svg className="w-3.5 h-3.5 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                              )}
                              {sub.subject_name} ({sub.subject_code})
                            </label>
                          )
                        })}
                        {streamSubjects.length === 0 && (
                          <span className="text-xs text-gray-400">
                            {isALevel && assignALevelStreamId && !selectedStreamCombo
                              ? 'Assign a combination to this stream first'
                              : 'No subjects found'}
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  <button
                    type="button"
                    disabled={saving || assignSubjectIds.length === 0 || (isALevel && !assignALevelStreamId)}
                    onClick={handleAssign}
                    className="w-full px-5 py-2.5 text-sm font-medium text-white bg-maroon-600 rounded-xl hover:bg-maroon-700 disabled:opacity-50 transition flex items-center justify-center gap-2"
                  >
                    {saving ? (
                      <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Assigning...</>
                    ) : isALevel ? (
                      <>Assign {assignSubjectIds.length} subject(s) to this stream</>
                    ) : (
                      <>Assign {assignSubjectIds.length} subject(s) to {assignClass?.class_name}</>
                    )}
                  </button>
                </>
              )
            })()}
          </div>

          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-3">
              Current Assignments
            </h3>
            {teacherAssignments.length === 0 ? (
              <div className="bg-gray-50 rounded-xl p-6 text-center text-sm text-gray-400 border border-gray-100">
                No subjects assigned yet. Use the form above to assign.
              </div>
            ) : (
              <div className="space-y-2">
                {Object.entries(getAssignmentsByClassSubject()).map(([classId, subjectMap]) => {
                  const cls = classes.find(c => c.id === classId)
                  const isALevel = cls?.level === 'A_LEVEL'
                  const allClassStreamIds = classStreams.filter(cs => cs.class_id === classId).map(cs => cs.id)
                  return (
                    <div key={classId} className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                      <p className="text-sm font-semibold text-gray-700 mb-2">
                        {cls?.class_name || 'Unknown'}
                        <span className={`text-xs font-normal ml-2 px-1.5 py-0.5 rounded ${isALevel ? 'bg-violet-100 text-violet-600' : 'bg-blue-100 text-blue-600'}`}>
                          {isALevel ? 'A-Level' : 'O-Level'}
                        </span>
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(subjectMap).map(([subjectId, assignmentRows]) => {
                          const sub = subjects.find(s => s.id === subjectId)
                          const assignedStreamIds = assignmentRows.map(a => a.class_stream_id)
                          // For A-Level: show stream name. For O-Level: warn if not all streams covered.
                          const assignedStreamNames = assignedStreamIds.map(id => {
                            const cs = classStreams.find(c => c.id === id)
                            return streams.find(s => s.id === cs?.stream_id)?.stream_name
                          }).filter(Boolean).sort()
                          const missingCount = !isALevel ? allClassStreamIds.filter(id => !assignedStreamIds.includes(id)).length : 0
                          return (
                            <span
                              key={subjectId}
                              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border ${
                                missingCount > 0
                                  ? 'bg-amber-50 border-amber-200 text-amber-800'
                                  : 'bg-white border-gray-200 text-gray-700'
                              }`}
                            >
                              {sub?.subject_name || 'Unknown'} ({sub?.subject_code || '?'})
                              {isALevel && (
                                <span className="text-violet-500 font-normal">· {assignedStreamNames.join(', ')}</span>
                              )}
                              {!isALevel && missingCount > 0 && (
                                <span
                                  className="text-amber-600 font-normal"
                                  title={`Only streams ${assignedStreamNames.join(', ')} — use the form above to assign the missing ${missingCount} stream(s)`}
                                >
                                  · {assignedStreamNames.join(', ')} only ⚠
                                </span>
                              )}
                              <button
                                type="button"
                                onClick={() => handleUnassignClassSubject(classId, subjectId)}
                                className="text-red-400 hover:text-red-600 ml-0.5"
                                title="Remove from all streams"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            </span>
                          )
                        })}
                      </div>
                      {!isALevel && Object.values(subjectMap).some(rows => allClassStreamIds.filter(id => !rows.map(r => r.class_stream_id).includes(id)).length > 0) && (
                        <p className="mt-2 text-xs text-amber-600">
                          ⚠ Some subjects cover only partial streams. Select this class above and re-assign those subjects to fill the missing streams.
                        </p>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <div className="flex justify-end pt-2 border-t border-gray-100">
            <button
              type="button"
              onClick={() => setAssignOpen(false)}
              className="px-5 py-2.5 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition"
            >
              Done
            </button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation */}
      <Modal isOpen={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} title="Confirm Delete">
        <p className="text-sm text-gray-600 mb-6">
          Are you sure you want to delete <strong>{deleteConfirm?.profiles?.full_name}</strong>
          {deleteConfirm?.employee_number && <> (#{deleteConfirm.employee_number})</>}?
          This will also remove all subject assignments for this teacher.
        </p>
        <div className="flex justify-end gap-3">
          <button
            onClick={() => setDeleteConfirm(null)}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition"
          >
            Cancel
          </button>
          <button
            onClick={() => handleDelete(deleteConfirm.id)}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition"
          >
            Delete
          </button>
        </div>
      </Modal>
    </div>
    </ErrorBoundary>
  )
}

export default Teachers