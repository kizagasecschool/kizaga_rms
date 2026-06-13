import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import Modal from '../../components/Modal'
import { useNotification } from '../../context/NotificationContext'

const LEVELS = ['O_LEVEL', 'A_LEVEL']
const CURRICULUMS = ['OLD', 'NEW']
const SUBJECT_TYPES = ['COMPULSORY', 'OPTIONAL']
const ROLES = ['CORE', 'SUBSIDIARY', 'OPTIONAL']

function AdminSubjects() {
  const { showToast } = useNotification()
  const [activeLevel, setActiveLevel] = useState('O_LEVEL')
  const [loading, setLoading] = useState(true)

  const [subjects, setSubjects] = useState([])
  const [combinations, setCombinations] = useState([])
  const [combinationSubjects, setCombinationSubjects] = useState([])
  const [curriculumFilter, setCurriculumFilter] = useState('all')

  const [subjectModalOpen, setSubjectModalOpen] = useState(false)
  const [comboModalOpen, setComboModalOpen] = useState(false)
  const [comboSubjectsModalOpen, setComboSubjectsModalOpen] = useState(false)
  const [editingSubject, setEditingSubject] = useState(null)
  const [editingCombo, setEditingCombo] = useState(null)
  const [selectedCombo, setSelectedCombo] = useState(null)
  const [formData, setFormData] = useState({})
  const [saving, setSaving] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const [pendingRoles, setPendingRoles] = useState({})

  const fetchSubjects = useCallback(async () => {
    const { data } = await supabase.from('subjects').select('*').order('subject_name')
    if (data) setSubjects(data)
  }, [])

  const fetchCombinations = useCallback(async () => {
    const { data } = await supabase.from('combinations').select('*').order('combination_name')
    if (data) setCombinations(data)
  }, [])

  const fetchCombinationSubjects = useCallback(async () => {
    const { data } = await supabase.from('combination_subjects').select('*')
    if (data) setCombinationSubjects(data)
  }, [])

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      await Promise.all([fetchSubjects(), fetchCombinations(), fetchCombinationSubjects()])
      setLoading(false)
    }
    load()
  }, [fetchSubjects, fetchCombinations, fetchCombinationSubjects])

  const oLevelSubjects = subjects.filter((s) => s.level === 'O_LEVEL')
  const aLevelSubjects = subjects.filter((s) => s.level === 'A_LEVEL')

  const filteredOLevel = curriculumFilter === 'all'
    ? oLevelSubjects
    : oLevelSubjects.filter((s) => s.curriculum === curriculumFilter)

  const openSubjectCreate = () => {
    setEditingSubject(null)
    setFormData({
      subject_code: '',
      subject_name: '',
      level: activeLevel,
      subject_type: 'COMPULSORY',
      curriculum: 'OLD',
    })
    setSubjectModalOpen(true)
  }

  const openSubjectEdit = (subject) => {
    setEditingSubject(subject)
    setFormData({
      subject_code: subject.subject_code,
      subject_name: subject.subject_name,
      level: subject.level,
      subject_type: subject.subject_type,
      curriculum: subject.curriculum || 'OLD',
    })
    setSubjectModalOpen(true)
  }

  const handleSaveSubject = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const payload = {
        subject_code: formData.subject_code.toUpperCase(),
        subject_name: formData.subject_name,
        level: formData.level,
        subject_type: formData.subject_type,
        curriculum: formData.level === 'O_LEVEL' ? formData.curriculum : null,
      }
      if (editingSubject) {
        const { error } = await supabase.from('subjects').update(payload).eq('id', editingSubject.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('subjects').insert(payload)
        if (error) throw error
      }
      await fetchSubjects()
      setSubjectModalOpen(false)
      showToast(editingSubject ? 'Subject updated successfully' : 'Subject created successfully', 'success')
    } catch (err) {
      console.error('Save error:', err)
      showToast('Failed to save. ' + (err.message || ''), 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteSubject = async (id) => {
    try {
      const { error } = await supabase.from('subjects').delete().eq('id', id)
      if (error) throw error
      await fetchSubjects()
      setDeleteConfirm(null)
      showToast('Subject deleted successfully', 'success')
    } catch (err) {
      console.error('Delete error:', err)
      showToast('Failed to delete. ' + (err.message || ''), 'error')
    }
  }

  const openComboCreate = () => {
    setEditingCombo(null)
    setFormData({ combination_name: '', description: '' })
    setComboModalOpen(true)
  }

  const openComboEdit = (combo) => {
    setEditingCombo(combo)
    setFormData({ combination_name: combo.combination_name, description: combo.description || '' })
    setComboModalOpen(true)
  }

  const handleSaveCombo = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      if (editingCombo) {
        const { error } = await supabase
          .from('combinations')
          .update({ combination_name: formData.combination_name, description: formData.description })
          .eq('id', editingCombo.id)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('combinations')
          .insert({ combination_name: formData.combination_name, description: formData.description })
        if (error) throw error
      }
      await fetchCombinations()
      setComboModalOpen(false)
      showToast(editingCombo ? 'Combination updated successfully' : 'Combination created successfully', 'success')
    } catch (err) {
      console.error('Save error:', err)
      showToast('Failed to save. ' + (err.message || ''), 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteCombo = async (id) => {
    try {
      const { error } = await supabase.from('combinations').delete().eq('id', id)
      if (error) throw error
      await fetchCombinations()
      await fetchCombinationSubjects()
      setDeleteConfirm(null)
      showToast('Combination deleted successfully', 'success')
    } catch (err) {
      console.error('Delete error:', err)
      showToast('Failed to delete. ' + (err.message || ''), 'error')
    }
  }

  const openComboSubjects = (combo) => {
    setSelectedCombo(combo)
    setComboSubjectsModalOpen(true)
    setPendingRoles({})
  }

  const getAssignedSubjects = (comboId) => {
    return combinationSubjects.filter((cs) => cs.combination_id === comboId)
  }

  const getAssignedSubjectIds = (comboId) => {
    return getAssignedSubjects(comboId).map((cs) => cs.subject_id)
  }

  const toggleComboSubject = async (comboId, subjectId, role) => {
    setSaving(true)
    try {
      const existing = combinationSubjects.find(
        (cs) => cs.combination_id === comboId && cs.subject_id === subjectId
      )
      if (existing) {
        const { error } = await supabase
          .from('combination_subjects')
          .delete()
          .eq('id', existing.id)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('combination_subjects')
          .insert({ combination_id: comboId, subject_id: subjectId, subject_role: role })
        if (error) throw error
      }
      await fetchCombinationSubjects()
      showToast(existing ? 'Subject removed from combination' : 'Subject added to combination', 'success')
    } catch (err) {
      console.error('Toggle error:', err)
      showToast('Failed to update subject.', 'error')
    } finally {
      setSaving(false)
    }
  }

  const updateComboSubjectRole = async (comboId, subjectId, newRole) => {
    setSaving(true)
    try {
      const existing = combinationSubjects.find(
        (cs) => cs.combination_id === comboId && cs.subject_id === subjectId
      )
      if (existing) {
        const { error } = await supabase
          .from('combination_subjects')
          .update({ subject_role: newRole })
          .eq('id', existing.id)
        if (error) throw error
        await fetchCombinationSubjects()
        showToast('Subject role updated', 'success')
      }
    } catch (err) {
      console.error('Update role error:', err)
      showToast('Failed to update subject role.', 'error')
    } finally {
      setSaving(false)
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
        <h1 className="text-2xl font-bold text-gray-900">Subject Management</h1>
        <p className="text-gray-500 mt-1">Manage O-Level subjects and A-Level subject combinations</p>
      </div>

      {/* Level Toggle */}
      <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-lg w-fit">
        {LEVELS.map((l) => (
          <button
            key={l}
            onClick={() => setActiveLevel(l)}
            className={`px-5 py-2 text-sm font-medium rounded-md transition ${
              activeLevel === l
                ? 'bg-white text-maroon-700 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {l === 'O_LEVEL' ? 'O-Level Subjects' : 'A-Level Combinations'}
          </button>
        ))}
      </div>

      {/* ==================== O-LEVEL ==================== */}
      {activeLevel === 'O_LEVEL' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">Curriculum:</span>
              {['all', ...CURRICULUMS].map((c) => (
                <button
                  key={c}
                  onClick={() => setCurriculumFilter(c)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition ${
                    curriculumFilter === c
                      ? 'bg-maroon-50 border-maroon-200 text-maroon-700'
                      : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {c === 'all' ? 'All' : c === 'OLD' ? 'Old Curriculum' : 'New Curriculum'}
                </button>
              ))}
            </div>
            <button
              onClick={openSubjectCreate}
              className="px-4 py-2 bg-maroon-600 text-white text-sm font-medium rounded-lg hover:bg-maroon-700 transition"
            >
              + Add Subject
            </button>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Code</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Subject Name</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Curriculum</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Type</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredOLevel.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-5 py-10 text-center text-sm text-gray-400">
                      No O-Level subjects found. Click "+ Add Subject" to create one.
                    </td>
                  </tr>
                )}
                {filteredOLevel.map((s) => (
                  <tr key={s.id} className="hover:bg-gray-50 transition">
                    <td className="px-5 py-3.5">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700">
                        {s.subject_code}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-sm font-medium text-gray-900">{s.subject_name}</td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        s.curriculum === 'NEW'
                          ? 'bg-amber-50 text-amber-700'
                          : 'bg-blue-50 text-blue-700'
                      }`}>
                        {s.curriculum === 'NEW' ? 'New Curriculum' : 'Old Curriculum'}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        s.subject_type === 'COMPULSORY'
                          ? 'bg-rose-50 text-rose-700'
                          : 'bg-teal-50 text-teal-700'
                      }`}>
                        {s.subject_type === 'COMPULSORY' ? 'Compulsory' : 'Optional'}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <button
                        onClick={() => openSubjectEdit(s)}
                        className="text-sm text-maroon-600 hover:text-maroon-800 font-medium mr-3"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => setDeleteConfirm({ type: 'subject', id: s.id, name: s.subject_name })}
                        className="text-sm text-red-500 hover:text-red-700 font-medium"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ==================== A-LEVEL ==================== */}
      {activeLevel === 'A_LEVEL' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-gray-500">{combinations.length} combination(s)</p>
            <button
              onClick={openComboCreate}
              className="px-4 py-2 bg-maroon-600 text-white text-sm font-medium rounded-lg hover:bg-maroon-700 transition"
            >
              + Add Combination
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {combinations.length === 0 && (
              <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-10 text-center text-sm text-gray-400">
                No combinations found. Click "+ Add Combination" to create one.
              </div>
            )}
            {combinations.map((combo) => {
              const assigned = getAssignedSubjects(combo.id)
              const core = assigned.filter((cs) => cs.subject_role === 'CORE')
              const subsidiary = assigned.filter((cs) => cs.subject_role === 'SUBSIDIARY')
              const optional = assigned.filter((cs) => cs.subject_role === 'OPTIONAL')

              const getSubject = (id) => subjects.find((s) => s.id === id)

              return (
                <div key={combo.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-sm transition">
                  <div className="px-5 py-4 border-b border-gray-100 flex items-start justify-between">
                    <div>
                      <h3 className="text-base font-semibold text-gray-900">{combo.combination_name}</h3>
                      {combo.description && (
                        <p className="text-xs text-gray-500 mt-0.5">{combo.description}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => openComboSubjects(combo)}
                        className="px-3 py-1.5 text-xs font-medium text-maroon-600 bg-maroon-50 rounded-lg hover:bg-maroon-100 transition"
                        title="Manage subjects"
                      >
                        Subjects
                      </button>
                      <button
                        onClick={() => openComboEdit(combo)}
                        className="p-1.5 text-gray-400 hover:text-maroon-600 hover:bg-gray-100 rounded-lg transition"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                        </svg>
                      </button>
                      <button
                        onClick={() => setDeleteConfirm({ type: 'combination', id: combo.id, name: combo.combination_name })}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  <div className="px-5 py-3 space-y-3">
                    <div>
                      <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Core Subjects (3)</span>
                      <div className="flex flex-wrap gap-1.5 mt-1.5">
                        {core.length === 0 && <span className="text-xs text-gray-400">None assigned</span>}
                        {core.map((cs) => {
                          const sub = getSubject(cs.subject_id)
                          return sub ? (
                            <span key={cs.id} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-50 text-emerald-700">
                              {sub.subject_code}
                            </span>
                          ) : null
                        })}
                      </div>
                    </div>
                    <div>
                      <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Subsidiary (1)</span>
                      <div className="flex flex-wrap gap-1.5 mt-1.5">
                        {subsidiary.length === 0 && <span className="text-xs text-gray-400">None assigned</span>}
                        {subsidiary.map((cs) => {
                          const sub = getSubject(cs.subject_id)
                          return sub ? (
                            <span key={cs.id} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-violet-50 text-violet-700">
                              {sub.subject_code}
                            </span>
                          ) : null
                        })}
                      </div>
                    </div>
                    <div>
                      <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Optional</span>
                      <div className="flex flex-wrap gap-1.5 mt-1.5">
                        {optional.length === 0 && <span className="text-xs text-gray-400">None assigned</span>}
                        {optional.map((cs) => {
                          const sub = getSubject(cs.subject_id)
                          return sub ? (
                            <span key={cs.id} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700">
                              {sub.subject_code}
                            </span>
                          ) : null
                        })}
                      </div>
                    </div>
                  </div>

                  <div className="px-5 py-2.5 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
                    <span className="text-xs text-gray-500">{assigned.length} subject(s) total</span>
                    <span className="text-xs text-gray-400">
                      {combo.description?.split('–')[0]?.trim() || ''}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ==================== SUBJECT FORM MODAL ==================== */}
      <Modal
        isOpen={subjectModalOpen}
        onClose={() => setSubjectModalOpen(false)}
        title={editingSubject ? 'Edit Subject' : 'Add Subject'}
      >
        <form onSubmit={handleSaveSubject} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Subject Code</label>
              <input
                type="text"
                required
                maxLength={6}
                value={formData.subject_code || ''}
                onChange={(e) => setFormData({ ...formData, subject_code: e.target.value })}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-maroon-500 focus:border-maroon-500"
                placeholder="e.g. PHY"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Subject Name</label>
              <input
                type="text"
                required
                value={formData.subject_name || ''}
                onChange={(e) => setFormData({ ...formData, subject_name: e.target.value })}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-maroon-500 focus:border-maroon-500"
                placeholder="e.g. Physics"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
              <select
                value={formData.subject_type || 'COMPULSORY'}
                onChange={(e) => setFormData({ ...formData, subject_type: e.target.value })}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-maroon-500 focus:border-maroon-500"
              >
                {SUBJECT_TYPES.map((t) => (
                  <option key={t} value={t}>{t === 'COMPULSORY' ? 'Compulsory' : 'Optional'}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Curriculum</label>
              <select
                value={formData.curriculum || 'OLD'}
                onChange={(e) => setFormData({ ...formData, curriculum: e.target.value })}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-maroon-500 focus:border-maroon-500"
              >
                {CURRICULUMS.map((c) => (
                  <option key={c} value={c}>{c === 'OLD' ? 'Old Curriculum' : 'New Curriculum'}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setSubjectModalOpen(false)}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-sm font-medium text-white bg-maroon-600 rounded-lg hover:bg-maroon-700 disabled:opacity-50 transition"
            >
              {saving ? 'Saving...' : editingSubject ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ==================== COMBINATION FORM MODAL ==================== */}
      <Modal
        isOpen={comboModalOpen}
        onClose={() => setComboModalOpen(false)}
        title={editingCombo ? 'Edit Combination' : 'Add Combination'}
      >
        <form onSubmit={handleSaveCombo} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Combination Name</label>
            <input
              type="text"
              required
              value={formData.combination_name || ''}
              onChange={(e) => setFormData({ ...formData, combination_name: e.target.value })}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-maroon-500 focus:border-maroon-500"
              placeholder="e.g. PCB"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <input
              type="text"
              value={formData.description || ''}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-maroon-500 focus:border-maroon-500"
              placeholder="e.g. Physics, Chemistry, Biology – Medicine"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setComboModalOpen(false)}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-sm font-medium text-white bg-maroon-600 rounded-lg hover:bg-maroon-700 disabled:opacity-50 transition"
            >
              {saving ? 'Saving...' : editingCombo ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ==================== COMBINATION SUBJECTS MODAL ==================== */}
      <Modal
        isOpen={comboSubjectsModalOpen}
        onClose={() => { setComboSubjectsModalOpen(false); setPendingRoles({}) }}
        title={`Subjects - ${selectedCombo?.combination_name || ''}`}
      >
        <p className="text-xs text-gray-500 mb-4">
          Select A-Level subjects and assign their role in this combination.
          Each combination should have <strong>3 Core</strong>, <strong>1 Subsidiary</strong>, and any number of <strong>Optional</strong> subjects.
        </p>
        {aLevelSubjects.length === 0 && (
          <p className="text-sm text-gray-400 py-4 text-center">
            No A-Level subjects found. Add A-Level subjects first.
          </p>
        )}
        <div className="space-y-2 max-h-80 overflow-y-auto">
          {aLevelSubjects.map((sub) => {
            const assigned = getAssignedSubjectIds(selectedCombo?.id || '')
            const isAssigned = assigned.includes(sub.id)
            const currentRole = combinationSubjects.find(
              (cs) => cs.combination_id === selectedCombo?.id && cs.subject_id === sub.id
            )?.subject_role || 'OPTIONAL'

            return (
              <div
                key={sub.id}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg border transition ${
                  isAssigned
                    ? 'bg-maroon-50 border-maroon-200'
                    : 'bg-gray-50 border-gray-100 hover:border-gray-200'
                }`}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">{sub.subject_name}</p>
                  <p className="text-xs text-gray-500">{sub.subject_code}</p>
                </div>
                {isAssigned ? (
                  <div className="flex items-center gap-2">
                    <select
                      value={currentRole}
                      disabled={saving}
                      onChange={(e) => updateComboSubjectRole(selectedCombo.id, sub.id, e.target.value)}
                      className="px-2 py-1 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-maroon-500"
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>{r === 'CORE' ? 'Core' : r === 'SUBSIDIARY' ? 'Subsidiary' : 'Optional'}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => toggleComboSubject(selectedCombo.id, sub.id, currentRole)}
                      className="px-2.5 py-1 text-xs font-medium text-red-600 bg-red-50 rounded-md hover:bg-red-100 transition disabled:opacity-50"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <select
                      value={pendingRoles[sub.id] || 'CORE'}
                      onChange={(e) => setPendingRoles((prev) => ({ ...prev, [sub.id]: e.target.value }))}
                      className="px-2 py-1 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-maroon-500"
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>{r === 'CORE' ? 'Core' : r === 'SUBSIDIARY' ? 'Subsidiary' : 'Optional'}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => toggleComboSubject(selectedCombo.id, sub.id, pendingRoles[sub.id] || 'CORE')}
                      className="px-2.5 py-1 text-xs font-medium text-maroon-600 bg-maroon-50 rounded-md hover:bg-maroon-100 transition disabled:opacity-50"
                    >
                      Add
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
        <div className="flex justify-end pt-4">
          <button
            type="button"
            onClick={() => setComboSubjectsModalOpen(false)}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition"
          >
            Done
          </button>
        </div>
      </Modal>

      {/* ==================== DELETE CONFIRMATION ==================== */}
      <Modal
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        title="Confirm Delete"
      >
        <p className="text-sm text-gray-600 mb-6">
          Are you sure you want to delete <strong>{deleteConfirm?.name}</strong>?
          {deleteConfirm?.type === 'combination' && (
            <span className="block mt-1 text-xs text-amber-600">
              This will also remove all subject assignments for this combination.
            </span>
          )}
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
            onClick={() => {
              if (deleteConfirm.type === 'subject') handleDeleteSubject(deleteConfirm.id)
              else if (deleteConfirm.type === 'combination') handleDeleteCombo(deleteConfirm.id)
            }}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition"
          >
            Delete
          </button>
        </div>
      </Modal>
    </div>
  )
}

export default AdminSubjects
