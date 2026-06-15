import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useNotification } from '../../context/NotificationContext'

const LEVELS = ['O_LEVEL', 'A_LEVEL']

function AcademicClasses() {
  const navigate = useNavigate()
  const { showToast } = useNotification()
  const [loading, setLoading] = useState(true)
  const [classes, setClasses] = useState([])
  const [streams, setStreams] = useState([])
  const [classStreams, setClassStreams] = useState([])
  const [selectedClassId, setSelectedClassId] = useState('')
  const [levelFilter, setLevelFilter] = useState('all')
  const [streamSearch, setStreamSearch] = useState('')
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

  const totalAssignments = classStreams.length

  const filteredClasses = levelFilter === 'all'
    ? classes
    : classes.filter((c) => c.level === levelFilter)

  const selectedClass = classes.find((c) => c.id === selectedClassId)
  const selectedClassStreamIds = classStreams
    .filter((cs) => cs.class_id === selectedClassId)
    .map((cs) => cs.stream_id)

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

  const assignedStreams = streams.filter((s) => selectedClassStreamIds.includes(s.id))
  const unassignedStreams = streams.filter((s) => !selectedClassStreamIds.includes(s.id))
  const filteredUnassigned = streamSearch
    ? unassignedStreams.filter((s) =>
        s.stream_name.toLowerCase().includes(streamSearch.toLowerCase())
      )
    : unassignedStreams

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-3 border-gray-200 border-t-maroon-600 rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Classes</h1>
        <p className="text-gray-500 mt-1">Manage class streams and subject assignments</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-maroon-50 text-maroon-600 flex items-center justify-center shrink-0">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008z" />
            </svg>
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{classes.length}</p>
            <p className="text-sm text-gray-500">Total Classes</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 11M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
            </svg>
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{streams.length}</p>
            <p className="text-sm text-gray-500">Total Streams</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-violet-50 text-violet-600 flex items-center justify-center shrink-0">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
            </svg>
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{totalAssignments}</p>
            <p className="text-sm text-gray-500">Total Assignments</p>
          </div>
        </div>
      </div>

      {/* Level Filter */}
      {classes.length > 0 && (
        <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-lg w-fit">
          {['all', ...LEVELS].map((l) => (
            <button
              key={l}
              onClick={() => setLevelFilter(l)}
              className={`px-4 py-2 text-sm font-medium rounded-md transition ${
                levelFilter === l
                  ? 'bg-white text-maroon-700 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {l === 'all' ? 'All Classes' : l === 'O_LEVEL' ? 'O-Level' : 'A-Level'}
            </button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Class selector + assignment panel */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-900">Stream Assignment</h3>
            </div>
            <div className="p-5">
              <label className="block text-sm font-medium text-gray-700 mb-2">Select Class</label>
              <select
                value={selectedClassId}
                onChange={(e) => { setSelectedClassId(e.target.value); setStreamSearch('') }}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-maroon-500 focus:border-maroon-500"
              >
                <option value="">-- Choose a class --</option>
                {classes.map((c) => {
                  const count = classStreams.filter((cs) => cs.class_id === c.id).length
                  return (
                    <option key={c.id} value={c.id}>
                      {c.class_name} ({c.level === 'O_LEVEL' ? 'O' : 'A'}-Level) - {count} stream{count !== 1 ? 's' : ''}
                    </option>
                  )
                })}
              </select>

              {selectedClassId && (
                <div className="mt-5">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Assigned Streams ({assignedStreams.length})
                    </h4>
                  </div>

                  {assignedStreams.length === 0 ? (
                    <p className="text-sm text-gray-400 mb-4">No streams assigned yet.</p>
                  ) : (
                    <div className="space-y-1.5 mb-4">
                      {assignedStreams.map((s) => (
                        <div
                          key={s.id}
                          className="flex items-center justify-between px-3 py-2 bg-maroon-50 rounded-lg border border-maroon-200"
                        >
                          <span className="text-sm font-medium text-maroon-700">Stream {s.stream_name}</span>
                          <button
                            type="button"
                            disabled={saving}
                            onClick={() => toggleAssignment(selectedClassId, s.id, true)}
                            className="text-xs font-medium text-red-600 hover:text-red-800 disabled:opacity-50"
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="pt-3 border-t border-gray-100">
                    <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                      Available Streams ({filteredUnassigned.length})
                    </h4>

                    <input
                      type="text"
                      placeholder="Search streams..."
                      value={streamSearch}
                      onChange={(e) => setStreamSearch(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-maroon-500 focus:border-maroon-500"
                    />

                    <div className="space-y-1.5 max-h-64 overflow-y-auto">
                      {filteredUnassigned.length === 0 ? (
                        <p className="text-sm text-gray-400">
                          {streamSearch ? 'No streams match your search.' : 'All streams are assigned.'}
                        </p>
                      ) : (
                        filteredUnassigned.map((s) => (
                          <div
                            key={s.id}
                            className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-lg border border-gray-100 hover:border-gray-200 transition"
                          >
                            <span className="text-sm text-gray-700">Stream {s.stream_name}</span>
                            <button
                              type="button"
                              disabled={saving}
                              onClick={() => toggleAssignment(selectedClassId, s.id, false)}
                              className="text-xs font-medium text-maroon-600 hover:text-maroon-800 bg-maroon-50 px-2.5 py-1 rounded-md hover:bg-maroon-100 disabled:opacity-50 transition"
                            >
                              Assign
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="mt-5 pt-4 border-t border-gray-200 space-y-2">
                    <button
                      onClick={() => navigate(`/academic/class-subjects?classId=${selectedClassId}`)}
                      className="w-full px-3 py-2 text-sm font-medium text-emerald-600 bg-emerald-50 rounded-lg hover:bg-emerald-100 transition"
                    >
                      Manage Subjects for {selectedClass?.class_name}
                    </button>
                    <button
                      onClick={() => navigate(`/academic/enter-marks?classId=${selectedClassId}`)}
                      className="w-full px-3 py-2 text-sm font-medium text-maroon-600 bg-maroon-50 rounded-lg hover:bg-maroon-100 transition"
                    >
                      Enter Marks for {selectedClass?.class_name}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right: Overview table */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">
                  {levelFilter === 'all' ? 'All Classes' : levelFilter === 'O_LEVEL' ? 'O-Level Classes' : 'A-Level Classes'}
                </h3>
                <p className="text-xs text-gray-400 mt-0.5">{filteredClasses.length} class(es)</p>
              </div>
            </div>
            <div className="overflow-x-auto">
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
                {filteredClasses.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-5 py-12 text-center text-sm text-gray-400">
                      No classes found.
                    </td>
                  </tr>
                )}
                {filteredClasses.map((c) => {
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
                      <td className="px-5 py-3.5 text-right">
                        <span className="text-sm font-semibold text-gray-800">{assigned.length}</span>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => navigate(`/academic/class-subjects?classId=${c.id}`)}
                            className="px-2.5 py-1 text-xs font-medium text-emerald-600 bg-emerald-50 rounded-md hover:bg-emerald-100 transition"
                          >
                            Subjects
                          </button>
                          <button
                            onClick={() => {
                              setSelectedClassId(c.id)
                              setStreamSearch('')
                            }}
                            className="px-2.5 py-1 text-xs font-medium text-maroon-600 bg-maroon-50 rounded-md hover:bg-maroon-100 transition"
                          >
                            Streams
                          </button>
                        </div>
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
    </div>
  )
}

export default AcademicClasses
