import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import Modal from '../../components/Modal'
import { useNotification } from '../../context/NotificationContext'

const SUBJECT_TYPES = ['COMPULSORY', 'OPTIONAL', 'ELECTIVE']
const ROLES = ['CORE', 'SUBSIDIARY', 'OPTIONAL']

const subjectTypeLabel = (type, level) => {
  if (level === 'A_LEVEL') {
    switch (type) {
      case 'COMPULSORY': return 'Principal'
      case 'ELECTIVE':   return 'Subsidiary'
      case 'OPTIONAL':   return 'Optional'
      default: return type
    }
  }
  switch (type) {
    case 'COMPULSORY': return 'Compulsory'
    case 'OPTIONAL':   return 'Optional'
    case 'ELECTIVE':   return 'Elective'
    default: return type
  }
}

const subjectTypeColor = (type, level) => {
  if (level === 'A_LEVEL') {
    switch (type) {
      case 'COMPULSORY': return 'bg-emerald-50 text-emerald-700'
      case 'ELECTIVE':   return 'bg-violet-50 text-violet-700'
      case 'OPTIONAL':   return 'bg-amber-50 text-amber-700'
      default: return 'bg-gray-100 text-gray-600'
    }
  }
  switch (type) {
    case 'COMPULSORY': return 'bg-rose-50 text-rose-700'
    case 'OPTIONAL':   return 'bg-teal-50 text-teal-700'
    case 'ELECTIVE':   return 'bg-gray-100 text-gray-600'
    default: return 'bg-gray-100 text-gray-600'
  }
}

function AdminSubjects() {
  const { showToast } = useNotification()
  const [activeTab, setActiveTab] = useState('olevel')
  const [aLevelSubTab, setALevelSubTab] = useState('subjects')
  const [loading, setLoading] = useState(true)

  const [subjects, setSubjects] = useState([])
  const [combinations, setCombinations] = useState([])
  const [combinationSubjects, setCombinationSubjects] = useState([])

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
  const [subjectSearch, setSubjectSearch] = useState('')

  const fetchSubjects = useCallback(async () => {
    const { data } = await supabase.from('subjects').select('*').order('subject_name')
    if (data) setSubjects(data)
  }, [])

  const fetchCombinations = useCallback(async () => {
    const { data } = await supabase.from('combinations').select('*').order('name')
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

  const filteredALevelSubs = subjectSearch
    ? aLevelSubjects.filter((s) =>
        s.subject_name.toLowerCase().includes(subjectSearch.toLowerCase()) ||
        s.subject_code.toLowerCase().includes(subjectSearch.toLowerCase())
      )
    : aLevelSubjects

  // ─── Subject CRUD ───────────────────────────────────────
  const openSubjectCreate = () => {
    setEditingSubject(null)
    setFormData({
      subject_code: '',
      subject_name: '',
      level: activeTab === 'olevel' ? 'O_LEVEL' : 'A_LEVEL',
      subject_type: 'COMPULSORY',
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
      showToast(editingSubject ? 'Subject updated' : 'Subject created', 'success')
    } catch (err) {
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
      showToast('Subject deleted', 'success')
    } catch (err) {
      showToast('Failed to delete. ' + (err.message || ''), 'error')
    }
  }

  // ─── Combination CRUD ────────────────────────────────────
  const openComboCreate = () => {
    setEditingCombo(null)
    setFormData({ code: '', name: '', description: '' })
    setComboModalOpen(true)
  }

  const openComboEdit = (combo) => {
    setEditingCombo(combo)
    setFormData({
      code: combo.code || '',
      name: combo.name || '',
      description: combo.description || '',
    })
    setComboModalOpen(true)
  }

  const handleSaveCombo = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const payload = { code: formData.code.toUpperCase(), name: formData.name, description: formData.description }
      if (editingCombo) {
        const { error } = await supabase.from('combinations').update(payload).eq('id', editingCombo.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('combinations').insert(payload)
        if (error) throw error
      }
      await fetchCombinations()
      setComboModalOpen(false)
      showToast(editingCombo ? 'Combination updated' : 'Combination created', 'success')
    } catch (err) {
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
      showToast('Combination deleted', 'success')
    } catch (err) {
      showToast('Failed to delete. ' + (err.message || ''), 'error')
    }
  }

  // ─── Combination Subjects ────────────────────────────────
  const openComboSubjects = (combo) => {
    setSelectedCombo(combo)
    setPendingRoles({})
    setComboSubjectsModalOpen(true)
  }

  const getAssignedSubjects = (comboId) =>
    combinationSubjects.filter((cs) => cs.combination_id === comboId)

  const getAssignedSubjectIds = (comboId) =>
    getAssignedSubjects(comboId).map((cs) => cs.subject_id)

  const toggleComboSubject = async (comboId, subjectId, role) => {
    setSaving(true)
    try {
      const existing = combinationSubjects.find(
        (cs) => cs.combination_id === comboId && cs.subject_id === subjectId
      )
      if (existing) {
        const { error } = await supabase.from('combination_subjects').delete().eq('id', existing.id)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('combination_subjects')
          .insert({ combination_id: comboId, subject_id: subjectId, subject_role: role })
        if (error) throw error
      }
      await fetchCombinationSubjects()
      showToast(existing ? 'Subject removed' : 'Subject added', 'success')
    } catch (err) {
      const msg = err?.code === '23505'
        ? `Subject code "${formData.subject_code.toUpperCase()}" already exists`
        : err.message || 'Unknown error'
      showToast('Failed to save. ' + msg, 'error')
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
    } catch {
      showToast('Failed to update role.', 'error')
    } finally {
      setSaving(false)
    }
  }

  // ─── Helpers ─────────────────────────────────────────────

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
        <h1 className="text-2xl font-bold text-gray-900">Subject & Combination Management</h1>
        <p className="text-gray-500 mt-1">Manage O-Level subjects, A-Level subjects, and combination groupings</p>
      </div>

      {/* ─── Main Tabs ─── */}
      <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-lg w-fit">
        {[
          { key: 'olevel', label: 'O-Level Subjects' },
          { key: 'alevel', label: 'A-Level Management' },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-5 py-2 text-sm font-medium rounded-md transition ${
              activeTab === tab.key
                ? 'bg-white text-maroon-700 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════
          O-LEVEL SUBJECTS
          ══════════════════════════════════════════════════════ */}
      {activeTab === 'olevel' && (
        <div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-3">
              <p className="text-sm text-gray-500">{oLevelSubjects.length} subject(s)</p>
              {oLevelSubjects.length === 0 && (
                <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">No subjects yet</span>
              )}
            </div>
            <button
              onClick={openSubjectCreate}
              className="px-4 py-2 bg-maroon-600 text-white text-sm font-medium rounded-lg hover:bg-maroon-700 transition"
            >
              + Add O-Level Subject
            </button>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Code</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Subject Name</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Type</th>
                    <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {oLevelSubjects.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-5 py-10 text-center text-sm text-gray-400">
                        No O-Level subjects. Click "+ Add O-Level Subject" to create one.
                      </td>
                    </tr>
                  )}
                  {oLevelSubjects.map((s) => (
                    <tr key={s.id} className="hover:bg-gray-50 transition">
                      <td className="px-5 py-3.5">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700 font-mono">
                          {s.subject_code}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-sm font-medium text-gray-900">{s.subject_name}</td>
                      <td className="px-5 py-3.5">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${subjectTypeColor(s.subject_type, 'O_LEVEL')}`}>
                          {subjectTypeLabel(s.subject_type, 'O_LEVEL')}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <button onClick={() => openSubjectEdit(s)} className="text-sm text-maroon-600 hover:text-maroon-800 font-medium mr-3">Edit</button>
                        <button onClick={() => setDeleteConfirm({ type: 'subject', id: s.id, name: s.subject_name })} className="text-sm text-red-500 hover:text-red-700 font-medium">Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          A-LEVEL MANAGEMENT
          ══════════════════════════════════════════════════════ */}
      {activeTab === 'alevel' && (
        <div>
          {/* A-Level sub-tabs */}
          <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-lg w-fit">
            {[
              { key: 'subjects', label: 'A-Level Subjects' },
              { key: 'combinations', label: 'Combinations & Subject Assignment' },
            ].map((sub) => (
              <button
                key={sub.key}
                onClick={() => setALevelSubTab(sub.key)}
                className={`px-5 py-2 text-sm font-medium rounded-md transition ${
                  aLevelSubTab === sub.key
                    ? 'bg-white text-maroon-700 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {sub.label}
              </button>
            ))}
          </div>

          {/* ─── A-LEVEL SUBJECTS ─── */}
          {aLevelSubTab === 'subjects' && (
            <div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                <div className="flex items-center gap-3">
                  <p className="text-sm text-gray-500">{aLevelSubjects.length} A-Level subject(s)</p>
                  {aLevelSubjects.length === 0 && (
                    <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">No subjects — add subjects first, then assign to combinations</span>
                  )}
                </div>
                <button
                  onClick={openSubjectCreate}
                  className="px-4 py-2 bg-maroon-600 text-white text-sm font-medium rounded-lg hover:bg-maroon-700 transition"
                >
                  + Add A-Level Subject
                </button>
              </div>

              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100">
                  <input
                    type="text"
                    value={subjectSearch}
                    onChange={(e) => setSubjectSearch(e.target.value)}
                    placeholder="Search A-Level subjects..."
                    className="w-full sm:w-72 px-3.5 py-2 bg-white border border-gray-200 rounded-lg text-sm outline-none focus:border-maroon-400 focus:ring-4 focus:ring-maroon-500/10 transition"
                  />
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200 bg-gray-50">
                        <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Code</th>
                        <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Subject Name</th>
                        <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Type</th>
                        <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filteredALevelSubs.length === 0 && (
                        <tr>
                          <td colSpan={4} className="px-5 py-10 text-center text-sm text-gray-400">
                            {subjectSearch ? 'No subjects match your search.' : 'No A-Level subjects. Click "+ Add A-Level Subject" to create one.'}
                          </td>
                        </tr>
                      )}
                      {filteredALevelSubs.map((s) => (
                        <tr key={s.id} className="hover:bg-gray-50 transition">
                          <td className="px-5 py-3.5">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700 font-mono">
                              {s.subject_code}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 text-sm font-medium text-gray-900">{s.subject_name}</td>
                          <td className="px-5 py-3.5">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${subjectTypeColor(s.subject_type, 'A_LEVEL')}`}>
                              {subjectTypeLabel(s.subject_type, 'A_LEVEL')}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 text-right">
                            <button onClick={() => openSubjectEdit(s)} className="text-sm text-maroon-600 hover:text-maroon-800 font-medium mr-3">Edit</button>
                            <button onClick={() => setDeleteConfirm({ type: 'subject', id: s.id, name: s.subject_name })} className="text-sm text-red-500 hover:text-red-700 font-medium">Delete</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ─── A-LEVEL COMBINATIONS ─── */}
          {aLevelSubTab === 'combinations' && (
            <div>
              <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                <div className="flex items-center gap-3">
                  <p className="text-sm text-gray-500">{combinations.length} combination(s)</p>
                  {aLevelSubjects.length === 0 && (
                    <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                      No A-Level subjects — go to "A-Level Subjects" tab to add them first
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={openSubjectCreate}
                    className="px-4 py-2 bg-white text-maroon-700 text-sm font-medium rounded-lg border border-maroon-300 hover:bg-maroon-50 transition"
                  >
                    + Add A-Level Subject
                  </button>
                  <button
                    onClick={openComboCreate}
                    className="px-4 py-2 bg-maroon-600 text-white text-sm font-medium rounded-lg hover:bg-maroon-700 transition"
                  >
                    + Add Combination
                  </button>
                </div>
              </div>

              {combinations.length === 0 ? (
                <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
                  <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15a2.25 2.25 0 012.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z" />
                  </svg>
                  <p className="text-sm text-gray-400">No combinations created yet.</p>
                  <button onClick={openComboCreate} className="mt-3 text-sm text-maroon-600 font-medium hover:underline">
                    + Create your first combination
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {combinations.map((combo) => {
                    const assigned = getAssignedSubjects(combo.id)
                    const core = assigned.filter((cs) => cs.subject_role === 'CORE')
                    const subsidiary = assigned.filter((cs) => cs.subject_role === 'SUBSIDIARY')
                    const optional = assigned.filter((cs) => cs.subject_role === 'OPTIONAL')
                    const getSubject = (id) => subjects.find((s) => s.id === id)
                    const total = assigned.length

                    return (
                      <div key={combo.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
                        {/* Header */}
                        <div className="px-5 py-4 border-b border-gray-100 flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-maroon-50 flex items-center justify-center shrink-0">
                              <span className="text-sm font-bold text-maroon-700 font-mono">{combo.code}</span>
                            </div>
                            <div>
                              <h3 className="text-base font-semibold text-gray-900">{combo.name}</h3>
                              {combo.description && (
                                <p className="text-xs text-gray-500 mt-0.5">{combo.description}</p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={() => openComboSubjects(combo)}
                              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition ${
                                total === 0
                                  ? 'text-amber-600 bg-amber-50 hover:bg-amber-100 animate-pulse'
                                  : 'text-maroon-600 bg-maroon-50 hover:bg-maroon-100'
                              }`}
                              title={total === 0 ? 'No subjects assigned — click to add' : 'Manage subjects'}
                            >
                              {total === 0 ? '⚠ Assign Subjects' : 'Manage Subjects'}
                            </button>
                            <button onClick={() => openComboEdit(combo)} className="p-1.5 text-gray-400 hover:text-maroon-600 hover:bg-gray-100 rounded-lg transition">
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                              </svg>
                            </button>
                            <button onClick={() => setDeleteConfirm({ type: 'combination', id: combo.id, name: combo.name })} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition">
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                              </svg>
                            </button>
                          </div>
                        </div>

                        {/* Subjects by Role */}
                        <div className="px-5 py-4 space-y-4">
                          {total === 0 && (
                            <div className="text-center py-4">
                              <p className="text-sm text-gray-400 mb-2">No subjects assigned to this combination</p>
                              <button
                                onClick={() => openComboSubjects(combo)}
                                className="px-4 py-2 text-sm font-medium text-maroon-600 bg-maroon-50 rounded-lg hover:bg-maroon-100 transition"
                              >
                                Assign Subjects Now
                              </button>
                            </div>
                          )}

                          {core.length > 0 && (
                            <div>
                              <div className="flex items-center gap-2 mb-2">
                                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                  Core Subjects ({core.length})
                                </span>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                {core.map((cs) => {
                                  const sub = getSubject(cs.subject_id)
                                  return sub ? (
                                    <span key={cs.id} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 text-sm font-medium">
                                      <span className="font-mono">{sub.subject_code}</span>
                                      <span className="text-xs opacity-70">{sub.subject_name}</span>
                                    </span>
                                  ) : null
                                })}
                              </div>
                            </div>
                          )}

                          {subsidiary.length > 0 && (
                            <div>
                              <div className="flex items-center gap-2 mb-2">
                                <span className="w-2 h-2 rounded-full bg-violet-500" />
                                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                  Subsidiary ({subsidiary.length})
                                </span>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                {subsidiary.map((cs) => {
                                  const sub = getSubject(cs.subject_id)
                                  return sub ? (
                                    <span key={cs.id} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-violet-200 bg-violet-50 text-violet-700 text-sm font-medium">
                                      <span className="font-mono">{sub.subject_code}</span>
                                      <span className="text-xs opacity-70">{sub.subject_name}</span>
                                    </span>
                                  ) : null
                                })}
                              </div>
                            </div>
                          )}

                          {optional.length > 0 && (
                            <div>
                              <div className="flex items-center gap-2 mb-2">
                                <span className="w-2 h-2 rounded-full bg-amber-500" />
                                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                  Optional ({optional.length})
                                </span>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                {optional.map((cs) => {
                                  const sub = getSubject(cs.subject_id)
                                  return sub ? (
                                    <span key={cs.id} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-amber-200 bg-amber-50 text-amber-700 text-sm font-medium">
                                      <span className="font-mono">{sub.subject_code}</span>
                                      <span className="text-xs opacity-70">{sub.subject_name}</span>
                                    </span>
                                  ) : null
                                })}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Footer */}
                        <div className="px-5 py-2.5 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
                          <span className="text-xs text-gray-500">
                            {total} subject{total !== 1 ? 's' : ''} total
                          </span>
                          <span className="text-xs text-gray-400">
                            {core.length} core · {subsidiary.length} subsidiary · {optional.length} optional
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ==================== SUBJECT FORM MODAL ==================== */}
      <Modal isOpen={subjectModalOpen} onClose={() => setSubjectModalOpen(false)} title={editingSubject ? 'Edit Subject' : 'Add Subject'}>
        <form onSubmit={handleSaveSubject} className="space-y-4">
          <p className="text-xs text-gray-500 mb-2">
            {editingSubject
              ? `Editing ${editingSubject.level === 'O_LEVEL' ? 'O-Level' : 'A-Level'} subject`
              : `Creating a new ${formData.level === 'O_LEVEL' ? 'O-Level' : 'A-Level'} subject`}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Subject Code <span className="text-red-500">*</span></label>
              <input type="text" required maxLength={6} value={formData.subject_code || ''} onChange={(e) => setFormData({ ...formData, subject_code: e.target.value })}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-maroon-500 focus:border-maroon-500"
                placeholder="e.g. PHY" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Subject Name <span className="text-red-500">*</span></label>
              <input type="text" required value={formData.subject_name || ''} onChange={(e) => setFormData({ ...formData, subject_name: e.target.value })}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-maroon-500 focus:border-maroon-500"
                placeholder="e.g. Physics" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
            <select value={formData.subject_type || 'COMPULSORY'} onChange={(e) => setFormData({ ...formData, subject_type: e.target.value })}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-maroon-500 focus:border-maroon-500">
              {SUBJECT_TYPES.map((t) => (
                <option key={t} value={t}>{subjectTypeLabel(t, formData.level)}</option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setSubjectModalOpen(false)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition">Cancel</button>
            <button type="submit" disabled={saving} className="px-4 py-2 text-sm font-medium text-white bg-maroon-600 rounded-lg hover:bg-maroon-700 disabled:opacity-50 transition">
              {saving ? 'Saving...' : editingSubject ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ==================== COMBINATION FORM MODAL ==================== */}
      <Modal isOpen={comboModalOpen} onClose={() => setComboModalOpen(false)} title={editingCombo ? 'Edit Combination' : 'Add Combination'}>
        <form onSubmit={handleSaveCombo} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Code <span className="text-red-500">*</span></label>
              <input type="text" required maxLength={3} value={formData.code || ''} onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-maroon-500 focus:border-maroon-500"
                placeholder="e.g. PCB" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name <span className="text-red-500">*</span></label>
              <input type="text" required value={formData.name || ''} onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-maroon-500 focus:border-maroon-500"
                placeholder="e.g. Physics, Chemistry, Biology" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <input type="text" value={formData.description || ''} onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-maroon-500 focus:border-maroon-500"
              placeholder="e.g. Medicine and Health Sciences" />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setComboModalOpen(false)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition">Cancel</button>
            <button type="submit" disabled={saving} className="px-4 py-2 text-sm font-medium text-white bg-maroon-600 rounded-lg hover:bg-maroon-700 disabled:opacity-50 transition">
              {saving ? 'Saving...' : editingCombo ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ==================== COMBINATION SUBJECTS MODAL ==================== */}
      <Modal isOpen={comboSubjectsModalOpen} onClose={() => { setComboSubjectsModalOpen(false); setPendingRoles({}) }}
        title={`${selectedCombo?.code || ''} — ${selectedCombo?.name || ''} » Assign Subjects`}
        className="max-w-2xl">
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
          <p className="text-sm text-amber-800 font-medium">A-Level Combination Structure</p>
          <p className="text-xs text-amber-700 mt-1">
            Each combination should have <strong>3 Core</strong> (principal) subjects, <strong>1 Subsidiary</strong> subject, and any number of <strong>Optional</strong> subjects. Click "Add" to assign a subject with its role. Use the dropdown to change a subject's role.
          </p>
        </div>

        {aLevelSubjects.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-sm text-gray-400 mb-3">No A-Level subjects available.</p>
            <button
              type="button"
              onClick={() => { setComboSubjectsModalOpen(false); setALevelSubTab('subjects') }}
              className="text-sm font-medium text-maroon-600 hover:underline"
            >
              Go to "A-Level Subjects" tab to add subjects first
            </button>
          </div>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
            {aLevelSubjects.map((sub) => {
              const assigned = getAssignedSubjectIds(selectedCombo?.id || '')
              const isAssigned = assigned.includes(sub.id)
              const currentRole = combinationSubjects.find(
                (cs) => cs.combination_id === selectedCombo?.id && cs.subject_id === sub.id
              )?.subject_role || 'CORE'

              return (
                <div key={sub.id} className={`flex items-center gap-3 px-4 py-3 rounded-lg border transition ${
                  isAssigned ? 'bg-white border-maroon-200 shadow-sm' : 'bg-gray-50 border-gray-100 hover:border-gray-200'
                }`}>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">{sub.subject_name}</p>
                    <p className="text-xs text-gray-500 font-mono">{sub.subject_code}</p>
                  </div>
                  {isAssigned ? (
                    <div className="flex items-center gap-2">
                      <select value={currentRole} disabled={saving}
                        onChange={(e) => updateComboSubjectRole(selectedCombo.id, sub.id, e.target.value)}
                        className={`px-2 py-1 text-xs border rounded-md focus:outline-none focus:ring-1 focus:ring-maroon-500 ${
                          currentRole === 'CORE' ? 'border-emerald-300 bg-emerald-50 text-emerald-700' :
                          currentRole === 'SUBSIDIARY' ? 'border-violet-300 bg-violet-50 text-violet-700' :
                          'border-amber-300 bg-amber-50 text-amber-700'
                        }`}>
                        {ROLES.map((r) => (<option key={r} value={r}>{r === 'CORE' ? 'Core' : r === 'SUBSIDIARY' ? 'Subsidiary' : 'Optional'}</option>))}
                      </select>
                      <button type="button" disabled={saving} onClick={() => toggleComboSubject(selectedCombo.id, sub.id, currentRole)}
                        className="px-2.5 py-1 text-xs font-medium text-red-600 bg-red-50 rounded-md hover:bg-red-100 transition disabled:opacity-50">
                        Remove
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <select value={pendingRoles[sub.id] || 'CORE'} onChange={(e) => setPendingRoles((prev) => ({ ...prev, [sub.id]: e.target.value }))}
                        className="px-2 py-1 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-maroon-500">
                        {ROLES.map((r) => (<option key={r} value={r}>{r === 'CORE' ? 'Core' : r === 'SUBSIDIARY' ? 'Subsidiary' : 'Optional'}</option>))}
                      </select>
                      <button type="button" disabled={saving} onClick={() => toggleComboSubject(selectedCombo.id, sub.id, pendingRoles[sub.id] || 'CORE')}
                        className="px-2.5 py-1 text-xs font-medium text-maroon-600 bg-maroon-50 rounded-md hover:bg-maroon-100 transition disabled:opacity-50">
                        Add
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        <div className="flex justify-end pt-4 border-t border-gray-100 mt-4">
          <button type="button" onClick={() => { setComboSubjectsModalOpen(false); setPendingRoles({}) }}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition">
            Done
          </button>
        </div>
      </Modal>

      {/* ==================== DELETE CONFIRMATION ==================== */}
      <Modal isOpen={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} title="Confirm Delete">
        <p className="text-sm text-gray-600 mb-6">
          Are you sure you want to delete <strong>{deleteConfirm?.name}</strong>?
          {deleteConfirm?.type === 'combination' && (
            <span className="block mt-1 text-xs text-amber-600">This will also remove all subject assignments for this combination.</span>
          )}
        </p>
        <div className="flex justify-end gap-3">
          <button onClick={() => setDeleteConfirm(null)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition">Cancel</button>
          <button onClick={() => {
            if (deleteConfirm.type === 'subject') handleDeleteSubject(deleteConfirm.id)
            else if (deleteConfirm.type === 'combination') handleDeleteCombo(deleteConfirm.id)
          }} className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition">Delete</button>
        </div>
      </Modal>
    </div>
  )
}

export default AdminSubjects
