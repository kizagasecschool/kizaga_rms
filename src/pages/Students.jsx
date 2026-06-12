import { useState, useEffect, useCallback } from 'react'
import Papa from 'papaparse'
import { supabase } from '../lib/supabase'
import Modal from '../components/Modal'
import { useNotification } from '../context/NotificationContext'

const STATUSES = ['active', 'inactive', 'graduated', 'transferred', 'expelled']

const TEMPLATE_HEADERS = [
  'admission_number', 'first_name', 'middle_name', 'surname',
  'gender', 'date_of_birth', 'class', 'stream',
  'admission_date', 'parent_name', 'parent_phone', 'address', 'status',
]

const TEMPLATE_ROW = {
  admission_number: 'S001',
  first_name: 'John',
  middle_name: 'Andrew',
  surname: 'Doe',
  gender: 'Male',
  date_of_birth: '2010-05-15',
  class: 'Form One',
  stream: 'East',
  admission_date: '2025-01-10',
  parent_name: 'Andrew Doe',
  parent_phone: '+255712345678',
  address: 'Dar es Salaam',
  status: 'active',
}

function downloadTemplate() {
  const csv = Papa.unparse({
    fields: TEMPLATE_HEADERS,
    data: [TEMPLATE_ROW],
  })
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'student_registration_template.csv'
  a.click()
  URL.revokeObjectURL(url)
}

function Students() {
  const { showToast } = useNotification()
  const [loading, setLoading] = useState(true)

  const [students, setStudents] = useState([])
  const [classes, setClasses] = useState([])
  const [streams, setStreams] = useState([])
  const [classStreams, setClassStreams] = useState([])

  const [search, setSearch] = useState('')
  const [filterClass, setFilterClass] = useState('')
  const [filterStatus, setFilterStatus] = useState('')

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [formData, setFormData] = useState({})
  const [saving, setSaving] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(null)

  const [csvOpen, setCsvOpen] = useState(false)
  const [csvData, setCsvData] = useState([])
  const [csvErrors, setCsvErrors] = useState([])
  const [csvImporting, setCsvImporting] = useState(false)
  const [csvFile, setCsvFile] = useState(null)

  const [subjectsOpen, setSubjectsOpen] = useState(false)
  const [subjectsStudent, setSubjectsStudent] = useState(null)
  const [subjectsStudentId, setSubjectsStudentId] = useState('')
  const [studentSubjectIds, setStudentSubjectIds] = useState([])
  const [savingSubjects, setSavingSubjects] = useState(false)

  const fetchStudents = useCallback(async () => {
    const { data } = await supabase
      .from('students')
      .select('*, class_streams(*)')
      .order('surname')
    if (data) setStudents(data)
  }, [])

  const [subjects, setSubjects] = useState([])

  const fetchLookups = useCallback(async () => {
    const [cRes, sRes, csRes, subRes] = await Promise.all([
      supabase.from('classes').select('*').order('sort_order'),
      supabase.from('streams').select('*').order('stream_name'),
      supabase.from('class_streams').select('*, classes(*), streams(*)'),
      supabase.from('subjects').select('*').order('subject_name'),
    ])
    if (cRes.data) setClasses(cRes.data)
    if (sRes.data) setStreams(sRes.data)
    if (csRes.data) setClassStreams(csRes.data)
    if (subRes.data) setSubjects(subRes.data)
  }, [])

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      await Promise.all([fetchStudents(), fetchLookups()])
      setLoading(false)
    }
    load()
  }, [fetchStudents, fetchLookups])

  const classStreamMap = {}
  classStreams.forEach((cs) => {
    const cls = classes.find((c) => c.id === cs.class_id)
    const str = streams.find((s) => s.id === cs.stream_id)
    if (cls && str) {
      classStreamMap[cs.id] = { class_name: cls.class_name, stream_name: str.stream_name }
    }
  })

  const getClassStreamOptions = () => {
    return classStreams.map((cs) => {
      const cls = classes.find((c) => c.id === cs.class_id)
      const str = streams.find((s) => s.id === cs.stream_id)
      return { id: cs.id, label: cls && str ? `${cls.class_name} - Stream ${str.stream_name}` : cs.id }
    })
  }

  const filtered = students.filter((s) => {
    const q = search.toLowerCase()
    if (q && !s.admission_number.toLowerCase().includes(q) && !s.first_name.toLowerCase().includes(q) && !s.surname.toLowerCase().includes(q)) return false
    if (filterClass && s.class_stream_id !== filterClass && !(filterClass === 'none' && !s.class_stream_id)) return false
    if (filterStatus && s.status !== filterStatus) return false
    return true
  })

  const openCreate = () => {
    setEditing(null)
    setFormData({
      admission_number: '',
      first_name: '',
      middle_name: '',
      surname: '',
      gender: 'Male',
      date_of_birth: '',
      class_stream_id: '',
      admission_date: new Date().toISOString().slice(0, 10),
      status: 'active',
      parent_name: '',
      parent_phone: '',
      address: '',
    })
    setFormOpen(true)
  }

  const openEdit = (student) => {
    setEditing(student)
    setFormData({
      admission_number: student.admission_number,
      first_name: student.first_name,
      middle_name: student.middle_name || '',
      surname: student.surname,
      gender: student.gender,
      date_of_birth: student.date_of_birth,
      class_stream_id: student.class_stream_id || '',
      admission_date: student.admission_date,
      status: student.status,
      parent_name: student.parent_name || '',
      parent_phone: student.parent_phone || '',
      address: student.address || '',
    })
    setFormOpen(true)
  }

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const payload = {
        ...formData,
        class_stream_id: formData.class_stream_id || null,
        middle_name: formData.middle_name || null,
        parent_name: formData.parent_name || null,
        parent_phone: formData.parent_phone || null,
        address: formData.address || null,
      }
      if (editing) {
        const { error } = await supabase.from('students').update(payload).eq('id', editing.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('students').insert(payload)
        if (error) throw error
      }
      await fetchStudents()
      setFormOpen(false)
      showToast(editing ? 'Student updated successfully' : 'Student registered successfully', 'success')
    } catch (err) {
      console.error('Save error:', err)
      showToast('Failed to save. ' + (err.message || ''), 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id) => {
    try {
      const { error } = await supabase.from('students').delete().eq('id', id)
      if (error) throw error
      await fetchStudents()
      setDeleteConfirm(null)
      showToast('Student deleted successfully', 'success')
    } catch (err) {
      console.error('Delete error:', err)
      showToast('Failed to delete. ' + (err.message || ''), 'error')
    }
  }

  const openSubjects = async (student) => {
    if (!student) return
    setSubjectsStudent(student)
    setSubjectsStudentId(student.id)
    const { data } = await supabase
      .from('student_subjects')
      .select('subject_id')
      .eq('student_id', student.id)
    setStudentSubjectIds((data || []).map((r) => r.subject_id))
    setSubjectsOpen(true)
  }

  const handleSubjectsStudentChange = async (studentId) => {
    const student = students.find((s) => s.id === studentId)
    if (!student) return
    setSubjectsStudent(student)
    setSubjectsStudentId(studentId)
    const { data } = await supabase
      .from('student_subjects')
      .select('subject_id')
      .eq('student_id', studentId)
    setStudentSubjectIds((data || []).map((r) => r.subject_id))
  }

  const handleToggleSubject = (subjectId) => {
    setStudentSubjectIds((prev) =>
      prev.includes(subjectId)
        ? prev.filter((id) => id !== subjectId)
        : [...prev, subjectId]
    )
  }

  const handleSaveSubjects = async () => {
    setSavingSubjects(true)
    try {
      const existing = await supabase
        .from('student_subjects')
        .select('subject_id')
        .eq('student_id', subjectsStudent.id)
      const existingIds = (existing.data || []).map((r) => r.subject_id)

      const toRemove = existingIds.filter((id) => !studentSubjectIds.includes(id))
      const toAdd = studentSubjectIds.filter((id) => !existingIds.includes(id))

      if (toRemove.length > 0) {
        await supabase
          .from('student_subjects')
          .delete()
          .eq('student_id', subjectsStudent.id)
          .in('subject_id', toRemove)
      }
      if (toAdd.length > 0) {
        await supabase
          .from('student_subjects')
          .insert(toAdd.map((subject_id) => ({ student_id: subjectsStudent.id, subject_id })))
      }
      setSubjectsOpen(false)
      setSubjectsStudent(null)
      showToast('Subjects updated successfully', 'success')
    } catch (err) {
      console.error('Save subjects error:', err)
      showToast('Failed to update subjects. ' + (err.message || ''), 'error')
    } finally {
      setSavingSubjects(false)
    }
  }

  const handleCsvFile = (e) => {
    const file = e.target.files[0]
    if (!file) return
    setCsvFile(file)
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const errors = []
        const valid = []
        results.data.forEach((row, i) => {
          if (!row.admission_number || !row.first_name || !row.surname || !row.gender || !row.date_of_birth) {
            errors.push(`Row ${i + 2}: missing required fields (admission_number, first_name, surname, gender, date_of_birth)`)
            return
          }
          if (!['Male', 'Female'].includes(row.gender)) {
            errors.push(`Row ${i + 2}: gender must be Male or Female`)
            return
          }
          const csId = resolveClassStream(row.class, row.stream)
          valid.push({
            admission_number: row.admission_number.trim(),
            first_name: row.first_name.trim(),
            middle_name: (row.middle_name || '').trim() || null,
            surname: row.surname.trim(),
            gender: row.gender.trim(),
            date_of_birth: row.date_of_birth.trim(),
            class_stream_id: csId,
            admission_date: (row.admission_date || '').trim() || new Date().toISOString().slice(0, 10),
            parent_name: (row.parent_name || '').trim() || null,
            parent_phone: (row.parent_phone || '').trim() || null,
            address: (row.address || '').trim() || null,
            status: (row.status || 'active').trim().toLowerCase(),
          })
        })
        setCsvData(valid)
        setCsvErrors(errors)
      },
    })
  }

  const resolveClassStream = (className, streamName) => {
    if (!className || !streamName) return null
    const cls = classes.find((c) => c.class_name.toLowerCase() === className.trim().toLowerCase())
    const str = streams.find((s) => s.stream_name.toLowerCase() === streamName.trim().toLowerCase())
    if (!cls || !str) return null
    const cs = classStreams.find((c) => c.class_id === cls.id && c.stream_id === str.id)
    return cs ? cs.id : null
  }

  const handleCsvImport = async () => {
    setCsvImporting(true)
    let imported = 0
    let failed = 0
    for (const row of csvData) {
      const { error } = await supabase.from('students').insert(row)
      if (error) {
        console.error('CSV insert error:', error)
        failed++
      } else {
        imported++
      }
    }
    setCsvImporting(false)
    setCsvOpen(false)
    setCsvData([])
    setCsvErrors([])
    setCsvFile(null)
    await fetchStudents()
    if (failed > 0) {
      showToast(`Imported: ${imported}, Failed: ${failed}`, 'warning')
    } else {
      showToast(`${imported} student(s) imported successfully`, 'success')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-3 border-gray-200 border-t-indigo-600 rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div>
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Student Registration</h1>
          <p className="text-gray-500 mt-1">Register, edit, and manage students</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={downloadTemplate}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            Template
          </button>
          <button
            onClick={() => setCsvOpen(true)}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 9.776c.112-.017.227-.026.344-.026h15.812c.117 0 .232.009.344.026m-16.5 0a2.25 2.25 0 00-1.883 2.542l.857 6a2.25 2.25 0 002.227 1.932H19.05a2.25 2.25 0 002.227-1.932l.857-6a2.25 2.25 0 00-1.883-2.542m-16.5 0V6A2.25 2.25 0 016 3.75h3.879a1.5 1.5 0 011.06.44l2.122 2.12a1.5 1.5 0 001.06.44H18A2.25 2.25 0 0120.25 9v.776" />
            </svg>
            Upload CSV
          </button>
          <button
            onClick={() => {
              if (students.length === 0) {
                showToast('No students available', 'info')
                return
              }
              openSubjects(students[0])
            }}
            className="px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Subject Assignments
          </button>
          <button
            onClick={openCreate}
            className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition"
          >
            + Add Student
          </button>
        </div>
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
              placeholder="Search by admission number or name..."
              className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
          <select
            value={filterClass}
            onChange={(e) => setFilterClass(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">All Classes</option>
            <option value="none">Unassigned</option>
            {getClassStreamOptions().map((o) => (
              <option key={o.id} value={o.id}>{o.label}</option>
            ))}
          </select>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">All Statuses</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
            ))}
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Admission #</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Full Name</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Gender</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Class</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-sm text-gray-400">
                    {search || filterClass || filterStatus ? 'No matching students found.' : 'No students registered yet. Click "+ Add Student" to begin.'}
                  </td>
                </tr>
              )}
              {filtered.map((s) => {
                const cs = s.class_streams || null
                return (
                  <tr key={s.id} className="hover:bg-gray-50 transition">
                    <td className="px-5 py-3.5">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700">
                        {s.admission_number}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <p className="text-sm font-medium text-gray-900">
                        {s.surname}, {s.first_name}{s.middle_name ? ` ${s.middle_name}` : ''}
                      </p>
                    </td>
                    <td className="px-5 py-3.5 text-sm text-gray-600">{s.gender}</td>
                    <td className="px-5 py-3.5 text-sm text-gray-600">
                      {cs?.classes && cs?.streams
                        ? `${cs.classes.class_name} - Stream ${cs.streams.stream_name}`
                        : <span className="text-gray-400">None</span>}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        s.status === 'active' ? 'bg-emerald-50 text-emerald-700' :
                        s.status === 'inactive' ? 'bg-gray-100 text-gray-600' :
                        s.status === 'graduated' ? 'bg-blue-50 text-blue-700' :
                        s.status === 'transferred' ? 'bg-amber-50 text-amber-700' :
                        'bg-red-50 text-red-700'
                      }`}>
                        {s.status.charAt(0).toUpperCase() + s.status.slice(1)}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <button
                        onClick={() => openSubjects(s)}
                        className="text-sm text-emerald-600 hover:text-emerald-800 font-medium mr-3"
                        title="Assign subjects"
                      >
                        Subjects
                      </button>
                      <button
                        onClick={() => openEdit(s)}
                        className="text-sm text-indigo-600 hover:text-indigo-800 font-medium mr-3"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => setDeleteConfirm(s)}
                        className="text-sm text-red-500 hover:text-red-700 font-medium"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <div className="px-5 py-3 border-t border-gray-100 bg-gray-50 flex items-center justify-between">
          <span className="text-xs text-gray-500">{filtered.length} student(s)</span>
        </div>
      </div>

      {/* Add/Edit Modal */}
      <Modal isOpen={formOpen} onClose={() => setFormOpen(false)} title="" className="max-w-3xl">
        <div className="border-b border-gray-100 px-6 py-4 -mx-6 -mt-6 mb-6 bg-gradient-to-r from-indigo-50 to-white rounded-t-xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center">
              <svg className="w-5 h-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">{editing ? 'Edit Student' : 'Register New Student'}</h2>
              <p className="text-sm text-gray-500">{editing ? 'Update the student\'s information below' : 'Fill in the student\'s details below'}</p>
            </div>
          </div>
        </div>
        <form onSubmit={handleSave} className="space-y-6">

          <div className="bg-gray-50/50 rounded-xl p-5 border border-gray-100">
            <div className="flex items-center gap-2 mb-4">
              <svg className="w-4 h-4 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
              </svg>
              <span className="text-sm font-semibold text-gray-800">Full Name</span>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Surname <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  required
                  value={formData.surname || ''}
                  onChange={(e) => setFormData({ ...formData, surname: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-sm outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10 transition placeholder:text-gray-400"
                  placeholder="e.g. Doe"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">First Name <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  required
                  value={formData.first_name || ''}
                  onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-sm outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10 transition placeholder:text-gray-400"
                  placeholder="e.g. John"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Middle Name</label>
                <input
                  type="text"
                  value={formData.middle_name || ''}
                  onChange={(e) => setFormData({ ...formData, middle_name: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-sm outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10 transition placeholder:text-gray-400"
                  placeholder="e.g. Andrew"
                />
              </div>
            </div>
          </div>

          <div className="bg-gray-50/50 rounded-xl p-5 border border-gray-100">
            <div className="flex items-center gap-2 mb-4">
              <svg className="w-4 h-4 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
              </svg>
              <span className="text-sm font-semibold text-gray-800">Student Information</span>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Admission Number <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  required
                  value={formData.admission_number || ''}
                  onChange={(e) => setFormData({ ...formData, admission_number: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-sm outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10 transition placeholder:text-gray-400"
                  placeholder="e.g. S001"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Gender <span className="text-red-500">*</span></label>
                <select
                  required
                  value={formData.gender || 'Male'}
                  onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-sm outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10 transition"
                >
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Date of Birth <span className="text-red-500">*</span></label>
                <input
                  type="date"
                  required
                  value={formData.date_of_birth || ''}
                  onChange={(e) => setFormData({ ...formData, date_of_birth: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-sm outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10 transition"
                />
              </div>
            </div>
          </div>

          <div className="bg-gray-50/50 rounded-xl p-5 border border-gray-100">
            <div className="flex items-center gap-2 mb-4">
              <svg className="w-4 h-4 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />
              </svg>
              <span className="text-sm font-semibold text-gray-800">Enrollment</span>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-1">
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Class / Stream</label>
                <select
                  value={formData.class_stream_id || ''}
                  onChange={(e) => setFormData({ ...formData, class_stream_id: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-sm outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10 transition"
                >
                  <option value="">-- Not assigned --</option>
                  {getClassStreamOptions().map((o) => (
                    <option key={o.id} value={o.id}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Admission Date</label>
                <input
                  type="date"
                  value={formData.admission_date || ''}
                  onChange={(e) => setFormData({ ...formData, admission_date: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-sm outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10 transition"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Status</label>
                <select
                  value={formData.status || 'active'}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-sm outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10 transition"
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="bg-gray-50/50 rounded-xl p-5 border border-gray-100">
            <div className="flex items-center gap-2 mb-4">
              <svg className="w-4 h-4 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 00.75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 00-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0112 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 01-.673-.38m0 0A2.18 2.18 0 013 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 013.413-.387m7.5 0V5.25A2.25 2.25 0 0013.5 3h-3a2.25 2.25 0 00-2.25 2.25v.894m7.5 0a48.667 48.667 0 00-7.5 0" />
              </svg>
              <span className="text-sm font-semibold text-gray-800">Parent / Contact Information</span>
            </div>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Parent / Guardian Name</label>
                <input
                  type="text"
                  value={formData.parent_name || ''}
                  onChange={(e) => setFormData({ ...formData, parent_name: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-sm outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10 transition placeholder:text-gray-400"
                  placeholder="e.g. Andrew Doe"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Phone Number</label>
                <input
                  type="text"
                  value={formData.parent_phone || ''}
                  onChange={(e) => setFormData({ ...formData, parent_phone: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-sm outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10 transition placeholder:text-gray-400"
                  placeholder="e.g. +255712345678"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Physical Address</label>
              <input
                type="text"
                value={formData.address || ''}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-sm outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10 transition placeholder:text-gray-400"
                placeholder="e.g. Dar es Salaam"
              />
            </div>
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
              className="px-6 py-2.5 text-sm font-medium text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 active:bg-indigo-800 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center gap-2 shadow-lg shadow-indigo-200"
            >
              {saving ? (
                <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Saving...</>
              ) : (
                <><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
                {editing ? 'Update Student' : 'Register Student'}</>
              )}
            </button>
          </div>
        </form>
      </Modal>

      {/* CSV Upload Modal */}
      <Modal isOpen={csvOpen} onClose={() => { setCsvOpen(false); setCsvData([]); setCsvErrors([]); setCsvFile(null) }} title="Upload Students CSV">
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
            <p className="font-medium mb-1">CSV Format Instructions</p>
            <ul className="list-disc list-inside space-y-1 text-xs">
              <li>Download the <button onClick={downloadTemplate} className="text-indigo-600 underline font-medium">template</button> first</li>
              <li>Required columns: <strong>admission_number, first_name, surname, gender, date_of_birth</strong></li>
              <li>Gender must be <strong>Male</strong> or <strong>Female</strong></li>
              <li>Date format: <strong>YYYY-MM-DD</strong> (e.g., 2010-05-15)</li>
              <li>Use <strong>class</strong> and <strong>stream</strong> columns to assign students (must match existing class/stream names)</li>
              <li>Leave <strong>class</strong> and <strong>stream</strong> empty to skip class assignment</li>
              <li>File must be UTF-8 encoded CSV</li>
            </ul>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Select CSV File</label>
            <input
              type="file"
              accept=".csv"
              onChange={handleCsvFile}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
            />
          </div>

          {csvErrors.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-xs font-medium text-red-700 mb-1">{csvErrors.length} error(s):</p>
              <ul className="list-disc list-inside text-xs text-red-600 space-y-0.5">
                {csvErrors.map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            </div>
          )}

          {csvData.length > 0 && (
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">{csvData.length} valid row(s) ready to import</p>
              <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="text-left px-3 py-2 font-medium text-gray-500">#</th>
                      <th className="text-left px-3 py-2 font-medium text-gray-500">Admission</th>
                      <th className="text-left px-3 py-2 font-medium text-gray-500">Name</th>
                      <th className="text-left px-3 py-2 font-medium text-gray-500">Gender</th>
                      <th className="text-left px-3 py-2 font-medium text-gray-500">Class</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {csvData.map((row, i) => {
                      const cs = row.class_stream_id ? classStreamMap[row.class_stream_id] : null
                      return (
                        <tr key={i}>
                          <td className="px-3 py-2 text-gray-500">{i + 1}</td>
                          <td className="px-3 py-2 font-medium text-gray-700">{row.admission_number}</td>
                          <td className="px-3 py-2 text-gray-600">{row.surname}, {row.first_name}</td>
                          <td className="px-3 py-2 text-gray-600">{row.gender}</td>
                          <td className="px-3 py-2 text-gray-600">{cs ? `${cs.class_name} - ${cs.stream_name}` : '-'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => { setCsvOpen(false); setCsvData([]); setCsvErrors([]); setCsvFile(null) }}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={csvData.length === 0 || csvImporting}
              onClick={handleCsvImport}
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition"
            >
              {csvImporting ? 'Importing...' : `Import ${csvData.length} Student(s)`}
            </button>
          </div>
        </div>
      </Modal>

      {/* Subject Assignment Modal */}
      <Modal isOpen={subjectsOpen} onClose={() => setSubjectsOpen(false)} title="" className="max-w-2xl">
        <div className="border-b border-gray-100 px-6 py-4 -mx-6 -mt-6 mb-6 bg-gradient-to-r from-emerald-50 to-white rounded-t-xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
              <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-semibold text-gray-900">Subject Assignments</h2>
              <p className="text-sm text-gray-500">Assign subjects to each student</p>
            </div>
          </div>
        </div>
        <div className="mb-4">
          <label className="block text-xs font-medium text-gray-600 mb-1.5">Select Student</label>
          <select
            value={subjectsStudentId}
            onChange={(e) => handleSubjectsStudentChange(e.target.value)}
            className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-sm outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-500/10 transition"
          >
            {students.map((s) => {
              const cs = classStreams.find((c) => c.id === s.class_stream_id)
              const label = `${s.surname}, ${s.first_name} (${s.admission_number})${cs ? ` - ${cs.classes?.class_name || ''} Stream ${cs.streams?.stream_name || ''}` : ''}`
              return (
                <option key={s.id} value={s.id}>{label}</option>
              )
            })}
          </select>
        </div>
        {subjectsStudent && (
          <div className="mb-4 px-4 py-3 bg-emerald-50 rounded-xl border border-emerald-100">
            <p className="text-sm font-medium text-emerald-800">
              {subjectsStudent.surname}, {subjectsStudent.first_name}
              {subjectsStudent.middle_name ? ` ${subjectsStudent.middle_name}` : ''}
            </p>
            <p className="text-xs text-emerald-600">{subjectsStudent.admission_number}</p>
          </div>
        )}
        <p className="text-sm text-gray-600 mb-4">
          Select the subjects this student will take. Unchecked subjects will be removed.
        </p>
        <div className="max-h-80 overflow-y-auto space-y-1.5 mb-6">
          {subjects.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-8">No subjects available. Add subjects first.</p>
          )}
          {subjects.map((sub) => (
            <label
              key={sub.id}
              className={`flex items-center gap-3 px-4 py-2.5 rounded-xl cursor-pointer transition border ${
                studentSubjectIds.includes(sub.id)
                  ? 'bg-emerald-50 border-emerald-200'
                  : 'bg-gray-50 border-gray-100 hover:border-gray-200'
              }`}
            >
              <input
                type="checkbox"
                checked={studentSubjectIds.includes(sub.id)}
                onChange={() => handleToggleSubject(sub.id)}
                className="w-4 h-4 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500"
              />
              <div className="flex-1">
                <span className="text-sm font-medium text-gray-800">{sub.subject_name}</span>
                <span className="text-xs text-gray-400 ml-2">({sub.subject_code})</span>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                sub.subject_type === 'COMPULSORY' ? 'bg-blue-50 text-blue-600' :
                sub.subject_type === 'OPTIONAL' ? 'bg-amber-50 text-amber-600' :
                'bg-purple-50 text-purple-600'
              }`}>
                {sub.subject_type}
              </span>
            </label>
          ))}
        </div>
        <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
          <button
            type="button"
            onClick={() => setSubjectsOpen(false)}
            className="px-5 py-2.5 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={savingSubjects}
            onClick={handleSaveSubjects}
            className="px-6 py-2.5 text-sm font-medium text-white bg-emerald-600 rounded-xl hover:bg-emerald-700 disabled:opacity-50 transition flex items-center gap-2"
          >
            {savingSubjects ? (
              <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Saving...</>
            ) : (
              'Save Assignments'
            )}
          </button>
        </div>
      </Modal>

      {/* Delete Confirmation */}
      <Modal isOpen={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} title="Confirm Delete">
        <p className="text-sm text-gray-600 mb-6">
          Are you sure you want to delete <strong>{deleteConfirm?.surname}, {deleteConfirm?.first_name}</strong>
          {deleteConfirm?.admission_number && <> (#{deleteConfirm.admission_number})</>}?
          This will also remove all marks, attendance, and results for this student.
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
  )
}

export default Students
