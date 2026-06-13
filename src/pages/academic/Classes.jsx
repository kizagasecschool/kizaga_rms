import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useNotification } from '../../context/NotificationContext'
function AcademicClasses() {
  const navigate = useNavigate()
  const { showToast } = useNotification()
  const [loading, setLoading] = useState(true)
  const [classes, setClasses] = useState([])
  const [streams, setStreams] = useState([])
  const [classStreams, setClassStreams] = useState([])
  const [selectedClassId, setSelectedClassId] = useState('')
  const [saving, setSaving] = useState(false)

  const fetchData = useCallback(async () => {
    const [cRes, sRes, csRes] = await Promise.all([
      supabase.from('classes').select('*').order('sort_order'),
      supabase.from('streams').select('*').order('stream_name'),
      supabase.from('class_streams').select('*'),
    ])
    if (cRes.data) setClasses(cRes.data)
    if (sRes.data) setStreams(sRes.data)
    if (csRes.data) setClassStreams(csRes.data)
  }, [])

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      await fetchData()
      setLoading(false)
    }
    load()
  }, [fetchData])

  const toggleAssignment = async (classId, streamId, assigned) => {
    setSaving(true)
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
      await fetchData()
      showToast(assigned ? 'Stream removed from class' : 'Stream assigned to class', 'success')
    } catch (err) {
      console.error('Toggle error:', err)
      showToast('Failed to update assignment.', 'error')
    } finally {
      setSaving(false)
    }
  }

  const selectedClassStreamIds = classStreams
    .filter((cs) => cs.class_id === selectedClassId)
    .map((cs) => cs.stream_id)

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
        <h1 className="text-2xl font-bold text-gray-900">Class Stream Management</h1>
        <p className="text-gray-500 mt-1">Assign streams to classes for O-Level and A-Level</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Class selector + assignment toggles */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl border border-gray-200 p-5">
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
                <div className="space-y-2">
                  {streams.map((s) => {
                    const assigned = selectedClassStreamIds.includes(s.id)
                    return (
                      <label
                        key={s.id}
                        className={`flex items-center justify-between px-3 py-2.5 rounded-lg border cursor-pointer transition ${
                          assigned
                            ? 'bg-maroon-50 border-maroon-200'
                            : 'bg-gray-50 border-gray-100 hover:border-gray-200'
                        }`}
                      >
                        <span className={`text-sm font-medium ${assigned ? 'text-maroon-700' : 'text-gray-600'}`}>
                          Stream {s.stream_name}
                        </span>
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => toggleAssignment(selectedClassId, s.id, assigned)}
                          className={`text-xs font-medium px-2.5 py-1 rounded-md transition ${
                            assigned
                              ? 'bg-red-100 text-red-600 hover:bg-red-200'
                              : 'bg-maroon-100 text-maroon-600 hover:bg-maroon-200'
                          } disabled:opacity-50`}
                        >
                          {assigned ? 'Remove' : 'Assign'}
                        </button>
                      </label>
                    )
                  })}
                </div>

                <div className="mt-4 pt-4 border-t border-gray-200">
                  <button
                    onClick={() => navigate(`/academic/class-subjects?classId=${selectedClassId}`)}
                    className="w-full px-3 py-2 text-sm font-medium text-emerald-600 bg-emerald-50 rounded-lg hover:bg-emerald-100 transition"
                  >
                    Manage Subjects for this Class
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right: Overview table */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-900">All Class Streams</h3>
            </div>
            <table className="w-full">
              <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Class</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Level</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Streams</th>
                    <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Count</th>
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
                      <td className="px-5 py-3.5 text-right text-sm text-gray-700">{assigned.length}</td>
                      <td className="px-5 py-3.5 text-right">
                        <button
                          onClick={() => navigate(`/academic/class-subjects?classId=${c.id}`)}
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
  )
}

export default AcademicClasses
