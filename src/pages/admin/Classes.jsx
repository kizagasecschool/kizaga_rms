import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import Modal from '../../components/Modal'
import { useNotification } from '../../context/NotificationContext'

const TABS = [
  { key: 'classes', label: 'Classes' },
  { key: 'streams', label: 'Streams' },
  { key: 'assignments', label: 'Class Streams' },
]

const LEVELS = ['O_LEVEL', 'A_LEVEL']

function AdminClasses() {
  const navigate = useNavigate()
  const { showToast } = useNotification()
  const [activeTab, setActiveTab] = useState('classes')
  const [loading, setLoading] = useState(true)

  const [classes, setClasses] = useState([])
  const [streams, setStreams] = useState([])
  const [classStreams, setClassStreams] = useState([])
  const [levelFilter, setLevelFilter] = useState('all')

  const [modalOpen, setModalOpen] = useState(false)
  const [editingItem, setEditingItem] = useState(null)
  const [formData, setFormData] = useState({})
  const [saving, setSaving] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(null)

  const [selectedClassId, setSelectedClassId] = useState('')

  const fetchClasses = useCallback(async () => {
    const { data } = await supabase.from('classes').select('*').order('sort_order')
    if (data) setClasses(data)
  }, [])

  const fetchStreams = useCallback(async () => {
    const { data } = await supabase.from('streams').select('*').order('stream_name')
    if (data) setStreams(data)
  }, [])

  const fetchClassStreams = useCallback(async () => {
    const { data } = await supabase.from('class_streams').select('*')
    if (data) setClassStreams(data)
  }, [])

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      await Promise.all([fetchClasses(), fetchStreams(), fetchClassStreams()])
      setLoading(false)
    }
    load()
  }, [fetchClasses, fetchStreams, fetchClassStreams])

  const filteredClasses = levelFilter === 'all'
    ? classes
    : classes.filter((c) => c.level === levelFilter)

  const openCreate = () => {
    setEditingItem(null)
    setFormData(
      activeTab === 'classes'
        ? { class_name: '', level: 'O_LEVEL', sort_order: classes.length + 1 }
        : { stream_name: '' }
    )
    setModalOpen(true)
  }

  const openEdit = (item) => {
    setEditingItem(item)
    setFormData(
      activeTab === 'classes'
        ? { class_name: item.class_name, level: item.level, sort_order: item.sort_order }
        : { stream_name: item.stream_name }
    )
    setModalOpen(true)
  }

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      if (activeTab === 'classes') {
        if (editingItem) {
          const { error } = await supabase
            .from('classes')
            .update({ class_name: formData.class_name, level: formData.level, sort_order: Number(formData.sort_order) })
            .eq('id', editingItem.id)
          if (error) throw error
        } else {
          const { error } = await supabase
            .from('classes')
            .insert({ class_name: formData.class_name, level: formData.level, sort_order: Number(formData.sort_order) })
          if (error) throw error
        }
        await fetchClasses()
      } else {
        if (editingItem) {
          const { error } = await supabase
            .from('streams')
            .update({ stream_name: formData.stream_name })
            .eq('id', editingItem.id)
          if (error) throw error
        } else {
          const { error } = await supabase
            .from('streams')
            .insert({ stream_name: formData.stream_name })
          if (error) throw error
        }
        await fetchStreams()
      }
      setModalOpen(false)
      showToast(editingItem ? 'Updated successfully' : 'Created successfully', 'success')
    } catch (err) {
      console.error('Save error:', err)
      showToast('Failed to save. ' + (err.message || ''), 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id) => {
    try {
      if (activeTab === 'classes') {
        const { error } = await supabase.from('classes').delete().eq('id', id)
        if (error) throw error
        await fetchClasses()
      } else {
        const { error } = await supabase.from('streams').delete().eq('id', id)
        if (error) throw error
        await fetchStreams()
      }
      setDeleteConfirm(null)
      showToast('Deleted successfully', 'success')
    } catch (err) {
      console.error('Delete error:', err)
      showToast('Failed to delete. ' + (err.message || ''), 'error')
    }
  }

  const toggleAssignment = async (classId, streamId, assigned) => {
    try {
      if (assigned) {
        const { error } = await supabase
          .from('class_streams')
          .delete()
          .eq('class_id', classId)
          .eq('stream_id', streamId)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('class_streams')
          .insert({ class_id: classId, stream_id: streamId })
        if (error) throw error
      }
      await fetchClassStreams()
      showToast(assigned ? 'Stream removed from class' : 'Stream assigned to class', 'success')
    } catch (err) {
      console.error('Toggle error:', err)
      showToast('Failed to update assignment.', 'error')
    }
  }

  const selectedClassStreamIds = classStreams
    .filter((cs) => cs.class_id === selectedClassId)
    .map((cs) => cs.stream_id)

  const unassignedStreams = streams.filter(
    (s) => !selectedClassStreamIds.includes(s.id)
  )

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
        <h1 className="text-2xl font-bold text-gray-900">Class Management</h1>
        <p className="text-gray-500 mt-1">Manage O-Level and A-Level classes, streams, and assignments</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-lg w-fit">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 text-sm font-medium rounded-md transition ${
              activeTab === tab.key
                ? 'bg-white text-maroon-700 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Classes Tab */}
      {activeTab === 'classes' && (
        <div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm text-gray-500">Level:</span>
              {['all', ...LEVELS].map((l) => (
                <button
                  key={l}
                  onClick={() => setLevelFilter(l)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition ${
                    levelFilter === l
                      ? 'bg-maroon-50 border-maroon-200 text-maroon-700'
                      : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {l === 'all' ? 'All' : l === 'O_LEVEL' ? 'O-Level' : 'A-Level'}
                </button>
              ))}
            </div>
            <button
              onClick={openCreate}
              className="px-4 py-2 bg-maroon-600 text-white text-sm font-medium rounded-lg hover:bg-maroon-700 transition"
            >
              + Add Class
            </button>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">#</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Class Name</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Level</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Sort Order</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredClasses.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-5 py-10 text-center text-sm text-gray-400">
                      No classes found. Click "+ Add Class" to create one.
                    </td>
                  </tr>
                )}
                {filteredClasses.map((c, i) => (
                  <tr key={c.id} className="hover:bg-gray-50 transition">
                    <td className="px-5 py-3.5 text-sm text-gray-500">{i + 1}</td>
                    <td className="px-5 py-3.5 text-sm font-medium text-gray-900">{c.class_name}</td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        c.level === 'O_LEVEL'
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-violet-50 text-violet-700'
                      }`}>
                        {c.level === 'O_LEVEL' ? 'O-Level' : 'A-Level'}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-sm text-gray-700">{c.sort_order}</td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => navigate(`/admin/class-subjects?classId=${c.id}`)}
                          title="Manage subjects"
                          className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 hover:text-emerald-800 transition"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                          </svg>
                        </button>
                        <button
                          onClick={() => openEdit(c)}
                          title="Edit class"
                          className="p-1.5 rounded-lg text-maroon-600 hover:bg-maroon-50 hover:text-maroon-800 transition"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => setDeleteConfirm({ type: 'classes', id: c.id, name: c.class_name })}
                          title="Delete class"
                          className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 hover:text-red-700 transition"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
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
        </div>
      )}

      {/* Streams Tab */}
      {activeTab === 'streams' && (
        <div>
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <p className="text-sm text-gray-500">{streams.length} stream(s) total</p>
            <button
              onClick={openCreate}
              className="px-4 py-2 bg-maroon-600 text-white text-sm font-medium rounded-lg hover:bg-maroon-700 transition"
            >
              + Add Stream
            </button>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">#</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Stream Name</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {streams.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-5 py-10 text-center text-sm text-gray-400">
                      No streams found. Click "+ Add Stream" to create one.
                    </td>
                  </tr>
                )}
                {streams.map((s, i) => (
                  <tr key={s.id} className="hover:bg-gray-50 transition">
                    <td className="px-5 py-3.5 text-sm text-gray-500">{i + 1}</td>
                    <td className="px-5 py-3.5 text-sm font-medium text-gray-900">{s.stream_name}</td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openEdit(s)}
                          title="Edit stream"
                          className="p-1.5 rounded-lg text-maroon-600 hover:bg-maroon-50 hover:text-maroon-800 transition"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => setDeleteConfirm({ type: 'streams', id: s.id, name: s.stream_name })}
                          title="Delete stream"
                          className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 hover:text-red-700 transition"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
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
        </div>
      )}

      {/* Assignments Tab */}
      {activeTab === 'assignments' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1">
            <label className="block text-sm font-medium text-gray-700 mb-2">Select Class</label>
            <select
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-maroon-500 focus:border-maroon-500"
            >
              <option value="">-- Choose a class --</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.class_name} ({c.level === 'O_LEVEL' ? 'O-Level' : 'A-Level'})
                </option>
              ))}
            </select>

            {selectedClassId && (
              <div className="mt-6">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Assigned Streams</h3>
                {selectedClassStreamIds.length === 0 ? (
                  <p className="text-sm text-gray-400">No streams assigned yet.</p>
                ) : (
                  <div className="space-y-1.5">
                    {classStreams
                      .filter((cs) => cs.class_id === selectedClassId)
                      .map((cs) => {
                        const stream = streams.find((s) => s.id === cs.stream_id)
                        return (
                          <div key={cs.id} className="flex items-center justify-between px-3 py-2 bg-maroon-50 rounded-lg">
                            <span className="text-sm font-medium text-maroon-700">
                              Stream {stream?.stream_name}
                            </span>
                            <button
                              onClick={() => toggleAssignment(selectedClassId, cs.stream_id, true)}
                              className="text-xs text-red-500 hover:text-red-700 font-medium"
                            >
                              Remove
                            </button>
                          </div>
                        )
                      })}
                  </div>
                )}

                {unassignedStreams.length > 0 && (
                  <div className="mt-6">
                    <h3 className="text-sm font-semibold text-gray-900 mb-3">Available Streams</h3>
                    <div className="space-y-1.5">
                      {unassignedStreams.map((s) => (
                        <div key={s.id} className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-lg">
                          <span className="text-sm text-gray-700">Stream {s.stream_name}</span>
                          <button
                            onClick={() => toggleAssignment(selectedClassId, s.id, false)}
                            className="text-xs text-maroon-600 hover:text-maroon-800 font-medium"
                          >
                            Assign
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="mt-4 pt-4 border-t border-gray-200">
                  <button
                    onClick={() => navigate(`/admin/class-subjects?classId=${selectedClassId}`)}
                    className="w-full px-3 py-2 text-sm font-medium text-emerald-600 bg-emerald-50 rounded-lg hover:bg-emerald-100 transition"
                  >
                    Manage Subjects for this Class
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="lg:col-span-2">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">All Assignments</h3>
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Class</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Level</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Streams</th>
                    <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {classes.map((c) => {
                    const assigned = classStreams
                      .filter((cs) => cs.class_id === c.id)
                      .map((cs) => streams.find((s) => s.id === cs.stream_id))
                      .filter(Boolean)
                    return (
                      <tr key={c.id} className="hover:bg-gray-50 transition">
                        <td className="px-5 py-3.5 text-sm font-medium text-gray-900">{c.class_name}</td>
                        <td className="px-5 py-3.5">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            c.level === 'O_LEVEL'
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-violet-50 text-violet-700'
                          }`}>
                            {c.level === 'O_LEVEL' ? 'O-Level' : 'A-Level'}
                          </span>
                        </td>
                        <td className="px-5 py-3.5">
                          {assigned.length === 0 ? (
                            <span className="text-sm text-gray-400">None</span>
                          ) : (
                            <div className="flex flex-wrap gap-1.5">
                              {assigned.map((s) => (
                                <span
                                  key={s.id}
                                  className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-maroon-50 text-maroon-700"
                                >
                                  Stream {s.stream_name}
                                </span>
                              ))}
                            </div>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-right text-sm text-gray-700">
                          <button
                            onClick={() => navigate(`/admin/class-subjects?classId=${c.id}`)}
                            className="text-xs text-emerald-600 hover:text-emerald-800 font-medium"
                          >
                            Subjects
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create/Edit Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={activeTab === 'classes'
          ? (editingItem ? 'Edit Class' : 'Add Class')
          : (editingItem ? 'Edit Stream' : 'Add Stream')
        }
      >
        <form onSubmit={handleSave} className="space-y-4">
          {activeTab === 'classes' ? (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Class Name</label>
                <input
                  type="text"
                  required
                  value={formData.class_name || ''}
                  onChange={(e) => setFormData({ ...formData, class_name: e.target.value })}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-maroon-500 focus:border-maroon-500"
                  placeholder="e.g. Form 1"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Level</label>
                <select
                  value={formData.level || 'O_LEVEL'}
                  onChange={(e) => setFormData({ ...formData, level: e.target.value })}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-maroon-500 focus:border-maroon-500"
                >
                  <option value="O_LEVEL">O-Level (Form 1-4)</option>
                  <option value="A_LEVEL">A-Level (Form 5-6)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Sort Order</label>
                <input
                  type="number"
                  required
                  min={1}
                  value={formData.sort_order || ''}
                  onChange={(e) => setFormData({ ...formData, sort_order: e.target.value })}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-maroon-500 focus:border-maroon-500"
                />
              </div>
            </>
          ) : (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Stream Name</label>
              <input
                type="text"
                required
                value={formData.stream_name || ''}
                onChange={(e) => setFormData({ ...formData, stream_name: e.target.value })}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-maroon-500 focus:border-maroon-500"
                placeholder="e.g. A"
              />
            </div>
          )}
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
              {saving ? 'Saving...' : editingItem ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        title="Confirm Delete"
      >
        <p className="text-sm text-gray-600 mb-6">
          Are you sure you want to delete <strong>{deleteConfirm?.name}</strong>?
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
    </div>
  )
}

export default AdminClasses
