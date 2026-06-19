import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useNotification } from '../context/NotificationContext'

const statusLabels = {
  pending: 'Inasubiri',
  approved: 'Imekubaliwa',
  rejected: 'Imekataliwa',
  needs_info: 'Inahitaji Maelezo',
  withdrawn: 'Imeondolewa',
}

const statusColors = {
  pending: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  approved: 'bg-green-100 text-green-700 border-green-200',
  rejected: 'bg-red-100 text-red-700 border-red-200',
  needs_info: 'bg-blue-100 text-blue-700 border-blue-200',
  withdrawn: 'bg-gray-100 text-gray-500 border-gray-200',
}

export default function ManageAdmissions() {
  const { profile } = useAuth()
  const { showToast } = useNotification()
  const [applications, setApplications] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [filter, setFilter] = useState('all')
  const [selected, setSelected] = useState(null)
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  const canManage = ['admin', 'headmaster', 'academic'].includes(profile?.role)

  const loadApplications = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .rpc('get_admission_applications')
    if (error) {
      setLoadError(error.message)
      showToast('Imeshindwa kupakia maombi', 'error')
    } else {
      setApplications(data || [])
      setLoadError(null)
    }
    setLoading(false)
  }

  useEffect(() => {
    loadApplications()
  }, [])

  const filtered = filter === 'all'
    ? applications
    : applications.filter(a => a.status === filter)

  const handleStatusChange = async (id, newStatus) => {
    setSaving(true)
    try {
      const { error } = await supabase
        .rpc('update_admission_application', {
          app_id: id,
          new_status: newStatus,
          notes: notes || null,
        })
      if (error) throw error
      showToast(`Ombi limebadilishwa kuwa "${statusLabels[newStatus]}"`, 'success')
      setSelected(null)
      setNotes('')
      loadApplications()
    } catch (err) {
      console.error(err)
      showToast('Imeshindwa kubadilisha hali', 'error')
    } finally {
      setSaving(false)
    }
  }

  if (!canManage) {
    return (
      <div className="max-w-3xl mx-auto">
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-center mt-8">
          <h2 className="text-lg font-semibold text-amber-800">Hairuhusiwi</h2>
          <p className="text-sm text-amber-600">Ni Admin na Headmaster pekee wanaoruhusiwa.</p>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Maombi ya Kujiunga</h1>
        <p className="text-sm text-gray-500 mt-1">Dhibiti maombi ya wanafunzi wanaotaka kujiunga</p>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {['all', 'pending', 'approved', 'rejected', 'needs_info'].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition ${
              filter === f
                ? 'bg-maroon-600 text-white border-maroon-600'
                : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
            }`}
          >
            {f === 'all' ? 'Zote' : statusLabels[f]}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-6 h-6 border-3 border-gray-200 border-t-maroon-600 rounded-full animate-spin" />
        </div>
      ) : loadError ? (
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <p className="text-sm font-medium text-red-700">Hitilafu: {loadError}</p>
          <p className="text-xs text-red-500 mt-2">Endesha migration SQL kwenye Supabase Dashboard.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">#</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Namba</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Mwanafunzi</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Darasa</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Mzazi</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Simu</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Hali</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Tarehe</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Hatua</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((app, idx) => (
                  <tr key={app.id} className="hover:bg-gray-50 transition">
                    <td className="px-4 py-3 text-gray-500">{idx + 1}</td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-700">{app.application_no}</td>
                    <td className="px-4 py-3">
                      <span className="font-medium text-gray-900">{app.first_name} {app.surname}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-700">{app.class_applying}</td>
                    <td className="px-4 py-3 text-gray-700">{app.parent_name}</td>
                    <td className="px-4 py-3 text-gray-700">{app.parent_phone}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${statusColors[app.status]}`}>
                        {statusLabels[app.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center text-xs text-gray-500">
                      {new Date(app.created_at).toLocaleDateString('sw-TZ')}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => { setSelected(selected?.id === app.id ? null : app); setNotes(app.admin_notes || '') }}
                        className="px-2.5 py-1 text-xs font-medium text-maroon-700 bg-maroon-50 rounded-lg hover:bg-maroon-100 transition"
                      >
                        {selected?.id === app.id ? 'Funga' : 'Fungua'}
                      </button>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-sm text-gray-400">Hakuna maombi</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Detail Panel */}
          {selected && (
            <div className="border-t border-gray-200 bg-gray-50 p-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-sm mb-4">
                <div>
                  <span className="text-gray-500 text-xs">Namba:</span>
                  <p className="font-medium">{selected.application_no}</p>
                </div>
                <div>
                  <span className="text-gray-500 text-xs">Mwanafunzi:</span>
                  <p className="font-medium">{selected.first_name} {selected.middle_name} {selected.surname}</p>
                </div>
                <div>
                  <span className="text-gray-500 text-xs">Jinsia:</span>
                  <p className="font-medium">{selected.gender === 'Male' ? 'Kiume' : 'Kike'}</p>
                </div>
                <div>
                  <span className="text-gray-500 text-xs">Tarehe ya Kuzaliwa:</span>
                  <p className="font-medium">{selected.date_of_birth ? new Date(selected.date_of_birth).toLocaleDateString('sw-TZ') : '-'}</p>
                </div>
                <div>
                  <span className="text-gray-500 text-xs">Darasa Analotaka:</span>
                  <p className="font-medium">{selected.class_applying}</p>
                </div>
                <div>
                  <span className="text-gray-500 text-xs">Shule ya Awali:</span>
                  <p className="font-medium">{selected.previous_school || '-'}</p>
                </div>
                <div>
                  <span className="text-gray-500 text-xs">Mzazi:</span>
                  <p className="font-medium">{selected.parent_name}</p>
                </div>
                <div>
                  <span className="text-gray-500 text-xs">Simu:</span>
                  <p className="font-medium">{selected.parent_phone}</p>
                </div>
                <div>
                  <span className="text-gray-500 text-xs">Barua Pepe:</span>
                  <p className="font-medium">{selected.parent_email || '-'}</p>
                </div>
                <div className="sm:col-span-2">
                  <span className="text-gray-500 text-xs">Anuani:</span>
                  <p className="font-medium">{selected.address || '-'}</p>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-sm mb-4 border-t border-gray-200 pt-4">
                <div>
                  <span className="text-gray-500 text-xs">Namba la Mtihani (NP):</span>
                  <p className="font-medium">{selected.exam_no || '-'}</p>
                </div>
                <div>
                  <span className="text-gray-500 text-xs">Mkoa:</span>
                  <p className="font-medium">{selected.region || '-'}</p>
                </div>
                <div>
                  <span className="text-gray-500 text-xs">Wilaya:</span>
                  <p className="font-medium">{selected.district || '-'}</p>
                </div>
                <div>
                  <span className="text-gray-500 text-xs">Ulemavu:</span>
                  <p className="font-medium">{selected.disability || 'Hakuna'}</p>
                </div>
              </div>
              <div className="border-t border-gray-200 pt-4 mb-4">
                <span className="text-gray-500 text-xs">Sababu za Kuomba:</span>
                <p className="text-sm text-gray-800 mt-1">{selected.reasons || 'Hakuna maelezo'}</p>
              </div>

              {/* Admin Notes */}
              <div className="mb-4">
                <label className="block text-xs font-medium text-gray-600 mb-1">Maelezo ya Uongozi</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                  placeholder="Andika maelezo kwa mzazi..."
                />
              </div>

              {/* Actions */}
              <div className="flex gap-2 flex-wrap">
                {selected.status !== 'approved' && (
                  <button
                    onClick={() => handleStatusChange(selected.id, 'approved')}
                    disabled={saving}
                    className="px-4 py-2 bg-green-600 text-white text-xs font-medium rounded-lg hover:bg-green-700 disabled:opacity-50"
                  >
                    {saving ? 'Inabadilisha...' : 'Kubali Ombi'}
                  </button>
                )}
                {selected.status !== 'rejected' && (
                  <button
                    onClick={() => handleStatusChange(selected.id, 'rejected')}
                    disabled={saving}
                    className="px-4 py-2 bg-red-600 text-white text-xs font-medium rounded-lg hover:bg-red-700 disabled:opacity-50"
                  >
                    Kataa Ombi
                  </button>
                )}
                {selected.status !== 'needs_info' && (
                  <button
                    onClick={() => handleStatusChange(selected.id, 'needs_info')}
                    disabled={saving}
                    className="px-4 py-2 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    Omba Maelezo Zaidi
                  </button>
                )}
                {selected.status !== 'pending' && (
                  <button
                    onClick={() => handleStatusChange(selected.id, 'pending')}
                    disabled={saving}
                    className="px-4 py-2 bg-yellow-600 text-white text-xs font-medium rounded-lg hover:bg-yellow-700 disabled:opacity-50"
                  >
                    Weka Tena Inasubiri
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
