import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import Modal from '../../components/Modal'
import { useNotification } from '../../context/NotificationContext'
import { useAuth } from '../../context/AuthContext'

const EXAM_TYPES = ['WEEKLY', 'MONTHLY', 'MIDTERM_1', 'TERMINAL', 'MIDTERM_2', 'ANNUAL', 'SERIES_1', 'SERIES_2', 'SERIES_3', 'MOCK', 'PRE_NATIONAL']

const STATUS_OPTIONS = ['draft', 'entering_marks', 'processed', 'published', 'locked']

const STATUS_COLORS = {
  draft: 'bg-gray-100 text-gray-600',
  entering_marks: 'bg-amber-50 text-amber-700',
  processed: 'bg-blue-50 text-blue-700',
  published: 'bg-emerald-50 text-emerald-700',
  locked: 'bg-rose-50 text-rose-700',
}

function AcademicExams() {
  const { showToast } = useNotification()
  const { profile } = useAuth()
  const [loading, setLoading] = useState(true)
  const [exams, setExams] = useState([])
  const [classes, setClasses] = useState([])
  const [academicYears, setAcademicYears] = useState([])
  const [terms, setTerms] = useState([])
  const [examClasses, setExamClasses] = useState([])

  const [modalOpen, setModalOpen] = useState(false)
  const [editingExam, setEditingExam] = useState(null)
  const [formData, setFormData] = useState({})
  const [saving, setSaving] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const [processConfirm, setProcessConfirm] = useState(null)
  const [processing, setProcessing] = useState(false)
  const [processProgress, setProcessProgress] = useState('')

  const fetchExams = useCallback(async () => {
    const { data } = await supabase
      .from('exams')
      .select('*, term:term_id(id, term_name), academic_year:academic_year_id(id, year_name)')
      .order('created_at', { ascending: false })
    if (data) setExams(data)
  }, [])

  const fetchClasses = useCallback(async () => {
    const { data } = await supabase.from('classes').select('*').order('sort_order')
    if (data) setClasses(data)
  }, [])

  const fetchAcademicYears = useCallback(async () => {
    const { data } = await supabase.from('academic_years').select('*').order('year_name', { ascending: false })
    if (data) setAcademicYears(data)
  }, [])

  const fetchTerms = useCallback(async () => {
    const { data } = await supabase.from('terms').select('*').order('term_name')
    if (data) setTerms(data)
  }, [])

  const fetchExamClasses = useCallback(async () => {
    const { data } = await supabase.from('exam_classes').select('*')
    if (data) setExamClasses(data)
  }, [])

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      await Promise.all([fetchExams(), fetchClasses(), fetchAcademicYears(), fetchTerms(), fetchExamClasses()])
      setLoading(false)
    }
    load()
  }, [fetchExams, fetchClasses, fetchAcademicYears, fetchTerms, fetchExamClasses])

  const getExamClassNames = (examId) => {
    const ids = examClasses.filter((ec) => ec.exam_id === examId).map((ec) => ec.class_id)
    return classes.filter((c) => ids.includes(c.id)).map((c) => c.class_name).join(', ')
  }

  const getTermName = (termId) => terms.find((t) => t.id === termId)?.term_name || '-'
  const getYearName = (yearId) => academicYears.find((y) => y.id === yearId)?.year_name || '-'

  const openCreate = () => {
    setEditingExam(null)
    const activeYear = academicYears.find((y) => y.is_active)
    const activeTerm = terms.find((t) => t.is_active)
    setFormData({
      name: '',
      exam_type: 'MONTHLY',
      term_id: activeTerm?.id || '',
      academic_year_id: activeYear?.id || '',
      start_date: '',
      end_date: '',
      has_practical: false,
      status: 'draft',
      class_ids: [],
    })
    setModalOpen(true)
  }

  const openEdit = (exam) => {
    setEditingExam(exam)
    const assigned = examClasses.filter((ec) => ec.exam_id === exam.id).map((ec) => ec.class_id)
    setFormData({
      name: exam.name,
      exam_type: exam.exam_type,
      term_id: exam.term_id,
      academic_year_id: exam.academic_year_id,
      start_date: exam.start_date || '',
      end_date: exam.end_date || '',
      has_practical: exam.has_practical || false,
      status: exam.status,
      class_ids: assigned,
    })
    setModalOpen(true)
  }

  const toggleClass = (classId) => {
    setFormData((prev) => {
      const ids = prev.class_ids || []
      if (ids.includes(classId)) {
        return { ...prev, class_ids: ids.filter((id) => id !== classId) }
      }
      return { ...prev, class_ids: [...ids, classId] }
    })
  }

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const payload = {
        name: formData.name,
        exam_type: formData.exam_type,
        term_id: formData.term_id,
        academic_year_id: formData.academic_year_id,
        start_date: formData.start_date || null,
        end_date: formData.end_date || null,
        has_practical: formData.has_practical,
        status: formData.status,
      }

      if (editingExam) {
        const { error } = await supabase.from('exams').update(payload).eq('id', editingExam.id)
        if (error) throw error
        await syncExamClasses(editingExam.id)
      } else {
        const { data, error } = await supabase.from('exams').insert(payload).select('id').single()
        if (error) throw error
        await syncExamClasses(data.id)

        // Notify teachers about new exam
        supabase.rpc('notify_exam_teachers', {
          p_exam_id: data.id,
          p_sender_id: profile.id,
          p_title: `New Exam: ${formData.name}`,
          p_message: `A new ${formData.exam_type} exam "${formData.name}" has been created for your class.`,
          p_type: 'exam_created',
          p_link: '/academic/exams',
        }).then(({ error: notifErr }) => {
          if (notifErr) console.error('Notification error:', notifErr)
        })
      }

      await fetchExams()
      await fetchExamClasses()
      setModalOpen(false)
      showToast(editingExam ? 'Exam updated successfully' : 'Exam created successfully', 'success')
    } catch (err) {
      console.error('Save error:', err)
      showToast('Failed to save. ' + (err.message || ''), 'error')
    } finally {
      setSaving(false)
    }
  }

  const syncExamClasses = async (examId) => {
    const selectedIds = formData.class_ids || []
    const existingIds = examClasses.filter((ec) => ec.exam_id === examId).map((ec) => ec.class_id)

    const toRemove = existingIds.filter((id) => !selectedIds.includes(id))
    const toAdd = selectedIds.filter((id) => !existingIds.includes(id))

    if (toRemove.length > 0) {
      const { error } = await supabase
        .from('exam_classes')
        .delete()
        .eq('exam_id', examId)
        .in('class_id', toRemove)
      if (error) throw error
    }

    if (toAdd.length > 0) {
      const inserts = toAdd.map((classId) => ({ exam_id: examId, class_id: classId }))
      const { error } = await supabase.from('exam_classes').insert(inserts)
      if (error) throw error
    }
  }

  const handleDelete = async (id) => {
    try {
      const { error } = await supabase.from('exams').delete().eq('id', id)
      if (error) throw error
      await fetchExams()
      await fetchExamClasses()
      setDeleteConfirm(null)
      showToast('Exam deleted successfully', 'success')
    } catch (err) {
      console.error('Delete error:', err)
      showToast('Failed to delete. ' + (err.message || ''), 'error')
    }
  }

  const handleTransition = async (examId, newStatus) => {
    setSaving(true)
    try {
      const { error } = await supabase.rpc('transition_exam_status', { p_exam_id: examId, p_new_status: newStatus })
      if (error) throw error
      await fetchExams()
      showToast(`Exam status changed to ${newStatus.replace('_', ' ')}`, 'success')
    } catch (err) {
      console.error('Transition error:', err)
      showToast('Failed to transition. ' + (err.message || ''), 'error')
    } finally {
      setSaving(false)
    }
  }

  const executeProcess = async (exam) => {
    setProcessing(true)
    setProcessProgress('Processing exam results...')
    try {
      const { error: processError } = await supabase.rpc('process_exam', { p_exam_id: exam.id })
      if (processError) throw processError

      const { error: transitionError } = await supabase.rpc('transition_exam_status', {
        p_exam_id: exam.id,
        p_new_status: 'processed',
      })
      if (transitionError) throw transitionError

      supabase.rpc('notify_exam_teachers', {
        p_exam_id: exam.id,
        p_sender_id: profile.id,
        p_title: `Results Processed: ${exam.name}`,
        p_message: `Results for "${exam.name}" have been processed and are available.`,
        p_type: 'results_processed',
        p_link: '/academic/exams',
      }).then(({ error: notifErr }) => {
        if (notifErr) console.error('Notification error:', notifErr)
      })

      await fetchExams()
      setProcessConfirm(null)
      showToast(`"${exam.name}" processed successfully`, 'success')
    } catch (err) {
      console.error('Process error:', err)
      showToast('Failed to process. ' + (err.message || ''), 'error')
    } finally {
      setProcessing(false)
      setProcessProgress('')
    }
  }

  const getNextStatuses = (current) => {
    switch (current) {
      case 'draft': return [{ status: 'entering_marks', label: 'Start Mark Entry', color: 'bg-blue-600 hover:bg-blue-700' }]
      case 'entering_marks': return [{ status: 'processed', label: 'Process Results', color: 'bg-indigo-600 hover:bg-indigo-700' }]
      case 'processed': return [{ status: 'published', label: 'Publish', color: 'bg-emerald-600 hover:bg-emerald-700' }]
      case 'published': return [{ status: 'locked', label: 'Lock', color: 'bg-rose-600 hover:bg-rose-700' }]
      default: return []
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-3 border-gray-200 border-t-maroon-600 rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Exam Management</h1>
        <p className="text-gray-500 mt-1">Create and manage exams, track status workflow</p>
      </div>

      <div className="flex items-center justify-between mb-6 flex-wrap gap-2">
        <p className="text-sm text-gray-500">{exams.length} exam(s)</p>
        <button
          onClick={openCreate}
          className="px-4 py-2 bg-maroon-600 text-white text-sm font-medium rounded-lg hover:bg-maroon-700 transition"
        >
          + Create Exam
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Name</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Type</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Term</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Year</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Dates</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Classes</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
              <th className="text-center px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">View</th>
              <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {exams.length === 0 && (
              <tr>
                <td colSpan={9} className="px-5 py-10 text-center text-sm text-gray-400">
                  No exams found. Click "+ Create Exam" to create one.
                </td>
              </tr>
            )}
            {exams.map((exam) => (
              <tr key={exam.id} className="hover:bg-gray-50 transition">
                <td className="px-5 py-3.5 text-sm font-medium text-gray-900">{exam.name}</td>
                <td className="px-5 py-3.5">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700">
                    {exam.exam_type}
                  </span>
                </td>
                <td className="px-5 py-3.5 text-sm text-gray-600">{getTermName(exam.term_id)}</td>
                <td className="px-5 py-3.5 text-sm text-gray-600">{getYearName(exam.academic_year_id)}</td>
                <td className="px-5 py-3.5 text-sm text-gray-600">
                  {exam.start_date ? `${exam.start_date} – ${exam.end_date || '...'}` : '-'}
                </td>
                <td className="px-5 py-3.5 text-sm text-gray-600 max-w-[200px] truncate" title={getExamClassNames(exam.id)}>
                  {getExamClassNames(exam.id) || '-'}
                </td>
                <td className="px-5 py-3.5">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[exam.status] || 'bg-gray-100 text-gray-600'}`}>
                    {exam.status.replace('_', ' ')}
                  </span>
                </td>
                <td className="px-5 py-3.5 text-center">
                  <Link
                    to={`/academic/view-marks?examId=${exam.id}`}
                    className="inline-flex items-center px-2.5 py-1 text-xs font-medium text-maroon-600 bg-maroon-50 hover:bg-maroon-100 rounded-md transition"
                  >
                    View
                  </Link>
                </td>
                <td className="px-5 py-3.5 text-right">
                  <div className="flex items-center justify-end gap-1">
                    {getNextStatuses(exam.status).map((action) => (
                      <button
                        key={action.status}
                        disabled={saving || (processing && action.status === 'processed')}
                        onClick={() => {
                          if (action.status === 'processed') {
                            setProcessConfirm(exam)
                          } else {
                            handleTransition(exam.id, action.status)
                          }
                        }}
                        className={`px-2.5 py-1 text-xs font-medium text-white rounded-md transition disabled:opacity-50 ${action.color}`}
                      >
                        {action.label}
                      </button>
                    ))}
                    {exam.status !== 'locked' && (
                      <>
                        <button
                          onClick={() => openEdit(exam)}
                          className="p-1.5 text-gray-400 hover:text-maroon-600 hover:bg-gray-100 rounded-lg transition"
                          title="Edit"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                          </svg>
                        </button>
                        <button
                          onClick={() => setDeleteConfirm({ id: exam.id, name: exam.name })}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                          title="Delete"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                          </svg>
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingExam ? 'Edit Exam' : 'Create Exam'}
        className="max-w-2xl"
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Exam Name</label>
            <input
              type="text"
              required
              value={formData.name || ''}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-maroon-500 focus:border-maroon-500"
              placeholder="e.g. Form 4 Terminal Exam"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Exam Type</label>
              <select
                value={formData.exam_type || 'MONTHLY'}
                onChange={(e) => setFormData({ ...formData, exam_type: e.target.value })}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-maroon-500 focus:border-maroon-500"
              >
                {EXAM_TYPES.map((t) => (
                  <option key={t} value={t}>{t.replace('_', ' ')}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                value={formData.status || 'draft'}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-maroon-500 focus:border-maroon-500"
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>{s.replace('_', ' ')}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Academic Year</label>
              <select
                required
                value={formData.academic_year_id || ''}
                onChange={(e) => setFormData({ ...formData, academic_year_id: e.target.value })}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-maroon-500 focus:border-maroon-500"
              >
                <option value="">Select year</option>
                {academicYears.map((y) => (
                  <option key={y.id} value={y.id}>{y.year_name}{y.is_active ? ' (Active)' : ''}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Term</label>
              <select
                required
                value={formData.term_id || ''}
                onChange={(e) => setFormData({ ...formData, term_id: e.target.value })}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-maroon-500 focus:border-maroon-500"
              >
                <option value="">Select term</option>
                {terms
                  .filter((t) => !formData.academic_year_id || t.academic_year_id === formData.academic_year_id)
                  .map((t) => (
                    <option key={t.id} value={t.id}>{t.term_name}{t.is_active ? ' (Active)' : ''}</option>
                  ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
              <input
                type="date"
                value={formData.start_date || ''}
                onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-maroon-500 focus:border-maroon-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
              <input
                type="date"
                value={formData.end_date || ''}
                onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-maroon-500 focus:border-maroon-500"
              />
            </div>
          </div>

          <label className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 cursor-pointer hover:bg-gray-50 transition">
            <input
              type="checkbox"
              checked={formData.has_practical || false}
              onChange={(e) => setFormData({ ...formData, has_practical: e.target.checked })}
              className="w-4 h-4 rounded border-gray-300 text-maroon-600 focus:ring-maroon-500"
            />
            <div>
              <span className="text-sm font-medium text-gray-900">Has Practical Exams</span>
              <p className="text-xs text-gray-500">Enable practical marks for science subjects (CHEM, PHY, BIO)</p>
            </div>
          </label>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Target Classes</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-48 overflow-y-auto p-2 border border-gray-200 rounded-lg">
              {classes.map((c) => {
                const checked = (formData.class_ids || []).includes(c.id)
                return (
                  <label
                    key={c.id}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm cursor-pointer transition ${
                      checked ? 'bg-maroon-50 border-maroon-200' : 'border-gray-100 hover:bg-gray-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleClass(c.id)}
                      className="w-4 h-4 rounded border-gray-300 text-maroon-600 focus:ring-maroon-500"
                    />
                    <span className="text-sm font-medium text-gray-900">{c.class_name}</span>
                  </label>
                )
              })}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-sm font-medium text-white bg-maroon-600 rounded-lg hover:bg-maroon-700 disabled:opacity-50 transition"
            >
              {saving ? 'Saving...' : editingExam ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        title="Confirm Delete"
      >
        <p className="text-sm text-gray-600 mb-6">
          Are you sure you want to delete <strong>{deleteConfirm?.name}</strong>?
          This will also remove all marks and results associated with this exam.
          This action cannot be undone.
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

      <Modal
        isOpen={!!processConfirm}
        onClose={processing ? null : () => setProcessConfirm(null)}
        title={processing ? 'Processing...' : 'Process Exam Results'}
      >
        {processing ? (
          <div className="text-center py-6">
            <div className="w-10 h-10 border-3 border-gray-200 border-t-maroon-600 rounded-full animate-spin mx-auto mb-4" />
            <p className="text-sm text-gray-600">{processProgress}</p>
            <p className="text-xs text-gray-400 mt-2">Calculating grades, divisions, and rankings...</p>
          </div>
        ) : (
          <>
            <div className="space-y-3 mb-6">
              <div className="flex items-center gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <svg className="w-5 h-5 text-amber-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
                <p className="text-sm text-amber-800">
                  Processing will calculate grades, divisions, and rankings. This action can be undone by reprocessing.
                </p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Exam</span>
                  <span className="font-medium text-gray-900">{processConfirm?.name}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Type</span>
                  <span className="font-medium text-gray-900">{processConfirm?.exam_type?.replace('_', ' ')}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Classes</span>
                  <span className="font-medium text-gray-900">{getExamClassNames(processConfirm?.id || '') || '-'}</span>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setProcessConfirm(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={() => executeProcess(processConfirm)}
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition"
              >
                Process Now
              </button>
            </div>
          </>
        )}
      </Modal>
    </div>
  )
}

export default AcademicExams
