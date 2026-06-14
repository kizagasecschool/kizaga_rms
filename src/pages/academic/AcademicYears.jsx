import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import Modal from '../../components/Modal'
import { useNotification } from '../../context/NotificationContext'

function AcademicYears() {
  const { showToast } = useNotification()
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('years')

  // Academic Years
  const [years, setYears] = useState([])
  const [yearModalOpen, setYearModalOpen] = useState(false)
  const [editingYear, setEditingYear] = useState(null)
  const [yearForm, setYearForm] = useState({ year_name: '', start_date: '', end_date: '', is_active: false })
  const [savingYear, setSavingYear] = useState(false)
  const [deleteYearConfirm, setDeleteYearConfirm] = useState(null)

  // Terms
  const [terms, setTerms] = useState([])
  const [termModalOpen, setTermModalOpen] = useState(false)
  const [editingTerm, setEditingTerm] = useState(null)
  const [termForm, setTermForm] = useState({ academic_year_id: '', term_name: '', start_date: '', end_date: '', is_active: false })
  const [savingTerm, setSavingTerm] = useState(false)
  const [deleteTermConfirm, setDeleteTermConfirm] = useState(null)

  const fetchYears = useCallback(async () => {
    const { data } = await supabase.from('academic_years').select('*').order('year_name', { ascending: false })
    if (data) setYears(data)
  }, [])

  const fetchTerms = useCallback(async () => {
    const { data } = await supabase.from('terms').select('*, academic_year:academic_year_id(year_name)').order('term_name')
    if (data) setTerms(data)
  }, [])

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      await Promise.all([fetchYears(), fetchTerms()])
      setLoading(false)
    }
    load()
  }, [fetchYears, fetchTerms])

  // ── Academic Year CRUD ──

  const openCreateYear = () => {
    setEditingYear(null)
    setYearForm({ year_name: '', start_date: '', end_date: '', is_active: false })
    setYearModalOpen(true)
  }

  const openEditYear = (year) => {
    setEditingYear(year)
    setYearForm({
      year_name: year.year_name,
      start_date: year.start_date,
      end_date: year.end_date,
      is_active: year.is_active,
    })
    setYearModalOpen(true)
  }

  const handleSaveYear = async (e) => {
    e.preventDefault()
    setSavingYear(true)
    try {
      const payload = {
        year_name: yearForm.year_name,
        start_date: yearForm.start_date,
        end_date: yearForm.end_date,
        is_active: yearForm.is_active,
      }
      if (editingYear) {
        const { error } = await supabase.from('academic_years').update(payload).eq('id', editingYear.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('academic_years').insert(payload)
        if (error) throw error
      }
      await fetchYears()
      setYearModalOpen(false)
      showToast(editingYear ? 'Academic year updated' : 'Academic year created', 'success')
    } catch (err) {
      showToast('Failed to save. ' + (err.message || ''), 'error')
    } finally {
      setSavingYear(false)
    }
  }

  const handleDeleteYear = async (id) => {
    try {
      const { error } = await supabase.from('academic_years').delete().eq('id', id)
      if (error) throw error
      await fetchYears()
      setDeleteYearConfirm(null)
      showToast('Academic year deleted', 'success')
    } catch (err) {
      showToast('Failed to delete. ' + (err.message || ''), 'error')
    }
  }

  // ── Term CRUD ──

  const openCreateTerm = () => {
    setEditingTerm(null)
    const activeYear = years.find((y) => y.is_active)
    setTermForm({
      academic_year_id: activeYear?.id || '',
      term_name: '',
      start_date: '',
      end_date: '',
      is_active: false,
    })
    setTermModalOpen(true)
  }

  const openEditTerm = (term) => {
    setEditingTerm(term)
    setTermForm({
      academic_year_id: term.academic_year_id,
      term_name: term.term_name,
      start_date: term.start_date,
      end_date: term.end_date,
      is_active: term.is_active,
    })
    setTermModalOpen(true)
  }

  const handleSaveTerm = async (e) => {
    e.preventDefault()
    setSavingTerm(true)
    try {
      const payload = {
        academic_year_id: termForm.academic_year_id,
        term_name: termForm.term_name,
        start_date: termForm.start_date,
        end_date: termForm.end_date,
        is_active: termForm.is_active,
      }
      if (editingTerm) {
        const { error } = await supabase.from('terms').update(payload).eq('id', editingTerm.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('terms').insert(payload)
        if (error) throw error
      }
      await fetchTerms()
      setTermModalOpen(false)
      showToast(editingTerm ? 'Term updated' : 'Term created', 'success')
    } catch (err) {
      showToast('Failed to save. ' + (err.message || ''), 'error')
    } finally {
      setSavingTerm(false)
    }
  }

  const handleDeleteTerm = async (id) => {
    try {
      const { error } = await supabase.from('terms').delete().eq('id', id)
      if (error) throw error
      await fetchTerms()
      setDeleteTermConfirm(null)
      showToast('Term deleted', 'success')
    } catch (err) {
      showToast('Failed to delete. ' + (err.message || ''), 'error')
    }
  }

  const getYearName = (id) => years.find((y) => y.id === id)?.year_name || '-'

  const termsForYear = (yearId) => terms.filter((t) => t.academic_year_id === yearId)

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
        <h1 className="text-2xl font-bold text-gray-900">Academic Years &amp; Terms</h1>
        <p className="text-gray-500 mt-1">Manage academic years and their terms</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-xl w-fit">
        <button
          onClick={() => setTab('years')}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition ${tab === 'years' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >
          Academic Years
        </button>
        <button
          onClick={() => setTab('terms')}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition ${tab === 'terms' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >
          Terms
        </button>
      </div>

      {tab === 'years' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-gray-500">{years.length} year(s)</p>
            <button onClick={openCreateYear} className="px-4 py-2 bg-maroon-600 text-white text-sm font-medium rounded-lg hover:bg-maroon-700 transition">
              + Add Year
            </button>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Year</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Start Date</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">End Date</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {years.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-5 py-10 text-center text-sm text-gray-400">
                      No academic years found. Click "+ Add Year" to create one.
                    </td>
                  </tr>
                )}
                {years.map((y) => (
                  <tr key={y.id} className="hover:bg-gray-50 transition">
                    <td className="px-5 py-3.5 text-sm font-medium text-gray-900">{y.year_name}</td>
                    <td className="px-5 py-3.5 text-sm text-gray-600">{y.start_date}</td>
                    <td className="px-5 py-3.5 text-sm text-gray-600">{y.end_date}</td>
                    <td className="px-5 py-3.5">
                      {y.is_active ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700">
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
                          Inactive
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => openEditYear(y)} className="p-1.5 text-gray-400 hover:text-maroon-600 hover:bg-gray-100 rounded-lg transition">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                          </svg>
                        </button>
                        <button onClick={() => setDeleteYearConfirm(y)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>

          {/* Year Modal */}
          <Modal isOpen={yearModalOpen} onClose={() => setYearModalOpen(false)} title={editingYear ? 'Edit Academic Year' : 'Add Academic Year'}>
            <form onSubmit={handleSaveYear} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Year Name</label>
                <input
                  type="text"
                  required
                  value={yearForm.year_name}
                  onChange={(e) => setYearForm({ ...yearForm, year_name: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-sm outline-none focus:border-maroon-400 focus:ring-4 focus:ring-maroon-500/10 transition"
                  placeholder="e.g. 2025"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">Start Date</label>
                  <input
                    type="date"
                    required
                    value={yearForm.start_date}
                    onChange={(e) => setYearForm({ ...yearForm, start_date: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-sm outline-none focus:border-maroon-400 focus:ring-4 focus:ring-maroon-500/10 transition"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">End Date</label>
                  <input
                    type="date"
                    required
                    value={yearForm.end_date}
                    onChange={(e) => setYearForm({ ...yearForm, end_date: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-sm outline-none focus:border-maroon-400 focus:ring-4 focus:ring-maroon-500/10 transition"
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={yearForm.is_active}
                  onChange={(e) => setYearForm({ ...yearForm, is_active: e.target.checked })}
                  className="accent-maroon-600 w-4 h-4"
                />
                <span className="text-sm text-gray-700">Set as active year</span>
              </label>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setYearModalOpen(false)} className="px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition">
                  Cancel
                </button>
                <button type="submit" disabled={savingYear} className="px-4 py-2 bg-maroon-600 text-white text-sm font-medium rounded-lg hover:bg-maroon-700 disabled:opacity-50 transition flex items-center gap-2">
                  {savingYear ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Saving...</> : editingYear ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </Modal>

          {/* Delete Year Confirmation */}
          <Modal isOpen={!!deleteYearConfirm} onClose={() => setDeleteYearConfirm(null)} title="Delete Academic Year">
            <p className="text-sm text-gray-600 mb-6">
              Are you sure you want to delete <strong>{deleteYearConfirm?.year_name}</strong>? This will also delete all terms and exams in this year. This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeleteYearConfirm(null)} className="px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition">Cancel</button>
              <button onClick={() => handleDeleteYear(deleteYearConfirm.id)} className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition">Delete</button>
            </div>
          </Modal>
        </div>
      )}

      {tab === 'terms' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-gray-500">{terms.length} term(s)</p>
            <button onClick={openCreateTerm} className="px-4 py-2 bg-maroon-600 text-white text-sm font-medium rounded-lg hover:bg-maroon-700 transition">
              + Add Term
            </button>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Term</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Academic Year</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Start Date</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">End Date</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {terms.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-5 py-10 text-center text-sm text-gray-400">
                      No terms found. Click "+ Add Term" to create one.
                    </td>
                  </tr>
                )}
                {terms.map((t) => (
                  <tr key={t.id} className="hover:bg-gray-50 transition">
                    <td className="px-5 py-3.5 text-sm font-medium text-gray-900">{t.term_name}</td>
                    <td className="px-5 py-3.5 text-sm text-gray-600">{t.academic_year?.year_name || getYearName(t.academic_year_id)}</td>
                    <td className="px-5 py-3.5 text-sm text-gray-600">{t.start_date}</td>
                    <td className="px-5 py-3.5 text-sm text-gray-600">{t.end_date}</td>
                    <td className="px-5 py-3.5">
                      {t.is_active ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700">Active</span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">Inactive</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => openEditTerm(t)} className="p-1.5 text-gray-400 hover:text-maroon-600 hover:bg-gray-100 rounded-lg transition">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                          </svg>
                        </button>
                        <button onClick={() => setDeleteTermConfirm(t)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>

          {/* Term Modal */}
          <Modal isOpen={termModalOpen} onClose={() => setTermModalOpen(false)} title={editingTerm ? 'Edit Term' : 'Add Term'}>
            <form onSubmit={handleSaveTerm} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Academic Year</label>
                <select
                  required
                  value={termForm.academic_year_id}
                  onChange={(e) => setTermForm({ ...termForm, academic_year_id: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-sm outline-none focus:border-maroon-400 focus:ring-4 focus:ring-maroon-500/10 transition"
                >
                  <option value="">-- Select year --</option>
                  {years.map((y) => (
                    <option key={y.id} value={y.id}>{y.year_name}{y.is_active ? ' (Active)' : ''}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Term Name</label>
                <input
                  type="text"
                  required
                  value={termForm.term_name}
                  onChange={(e) => setTermForm({ ...termForm, term_name: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-sm outline-none focus:border-maroon-400 focus:ring-4 focus:ring-maroon-500/10 transition"
                  placeholder="e.g. Term I"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">Start Date</label>
                  <input
                    type="date"
                    required
                    value={termForm.start_date}
                    onChange={(e) => setTermForm({ ...termForm, start_date: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-sm outline-none focus:border-maroon-400 focus:ring-4 focus:ring-maroon-500/10 transition"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">End Date</label>
                  <input
                    type="date"
                    required
                    value={termForm.end_date}
                    onChange={(e) => setTermForm({ ...termForm, end_date: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-sm outline-none focus:border-maroon-400 focus:ring-4 focus:ring-maroon-500/10 transition"
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={termForm.is_active}
                  onChange={(e) => setTermForm({ ...termForm, is_active: e.target.checked })}
                  className="accent-maroon-600 w-4 h-4"
                />
                <span className="text-sm text-gray-700">Set as active term</span>
              </label>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setTermModalOpen(false)} className="px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition">Cancel</button>
                <button type="submit" disabled={savingTerm} className="px-4 py-2 bg-maroon-600 text-white text-sm font-medium rounded-lg hover:bg-maroon-700 disabled:opacity-50 transition flex items-center gap-2">
                  {savingTerm ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Saving...</> : editingTerm ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </Modal>

          {/* Delete Term Confirmation */}
          <Modal isOpen={!!deleteTermConfirm} onClose={() => setDeleteTermConfirm(null)} title="Delete Term">
            <p className="text-sm text-gray-600 mb-6">
              Are you sure you want to delete <strong>{deleteTermConfirm?.term_name}</strong>? This will also delete all exams in this term. This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeleteTermConfirm(null)} className="px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition">Cancel</button>
              <button onClick={() => handleDeleteTerm(deleteTermConfirm.id)} className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition">Delete</button>
            </div>
          </Modal>
        </div>
      )}
    </div>
  )
}

export default AcademicYears