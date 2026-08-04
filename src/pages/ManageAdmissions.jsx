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
  const [showRequestModal, setShowRequestModal] = useState(false)
  const [requestMessage, setRequestMessage] = useState('')
  const [requireAttachment, setRequireAttachment] = useState(false)
  const [sendingRequest, setSendingRequest] = useState(false)
  const [conversations, setConversations] = useState([])
  const [loadingConversations, setLoadingConversations] = useState(false)
  const [previewAttachment, setPreviewAttachment] = useState(null)
  const [classes, setClasses] = useState([])
  const [classStreams, setClassStreams] = useState([])
  const [showConvertModal, setShowConvertModal] = useState(false)
  const [converting, setConverting] = useState(false)
  const [convertClassId, setConvertClassId] = useState('')
  const [convertStreamId, setConvertStreamId] = useState('')
  const [convertAdmissionNo, setConvertAdmissionNo] = useState('')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [checkedIds, setCheckedIds] = useState(new Set())
  const [bulkSaving, setBulkSaving] = useState(false)

  const canManage = ['admin', 'headmaster', 'academic'].includes(profile?.role)
  const canCreateStudent = ['admin', 'academic'].includes(profile?.role)

  const loadApplications = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .rpc('get_admission_applications')
    if (error) {
      setLoadError(error.message)
      showToast('Failed to load applications', 'error')
    } else {
      setApplications(data || [])
      setLoadError(null)
    }
    setLoading(false)
  }

  useEffect(() => {
    loadApplications()
    supabase.from('classes').select('*').order('sort_order').then(({ data }) => setClasses(data || []))
    supabase.from('class_streams').select('*, streams(*)').then(({ data }) => setClassStreams(data || []))
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
      showToast(`Application status changed to "${statusLabels[newStatus]}"`, 'success')
      setSelected(null)
      setNotes('')
      loadApplications()
    } catch (err) {
      console.error(err)
      showToast('Failed to update status', 'error')
    } finally {
      setSaving(false)
    }
  }

  const loadConversations = async (applicationId) => {
    setLoadingConversations(true)
    const { data, error } = await supabase
      .rpc('get_application_conversations', { p_application_id: applicationId })
    if (!error) setConversations(data || [])
    setLoadingConversations(false)
  }

  useEffect(() => {
    if (selected) {
      loadConversations(selected.id)
    } else {
      setConversations([])
    }
  }, [selected])

  const handleSendRequest = async () => {
    if (!requestMessage.trim()) return
    setSendingRequest(true)
    try {
      const { error } = await supabase
        .rpc('send_application_request', {
          p_application_id: selected.id,
          p_message: requestMessage.trim(),
          p_requires_attachment: requireAttachment,
        })
      if (error) throw error
      showToast('Request for information sent', 'success')
      setShowRequestModal(false)
      setRequestMessage('')
      setRequireAttachment(false)
      setSelected(null)
      loadApplications()
    } catch (err) {
      console.error(err)
      showToast('Failed to send message', 'error')
    } finally {
      setSendingRequest(false)
    }
  }

  const generateAdmissionNumber = async () => {
    const year = new Date().getFullYear().toString()
    const prefix = year + 'K'
    const { data } = await supabase
      .from('students')
      .select('admission_number')
      .like('admission_number', prefix + '%')
      .order('admission_number', { ascending: false })
      .limit(1)
    if (data && data.length > 0) {
      const lastNum = parseInt(data[0].admission_number.replace(prefix, ''), 10) || 0
      return prefix + String(lastNum + 1).padStart(3, '0')
    }
    return prefix + '001'
  }

  const handleOpenConvertModal = async () => {
    const matchedClass = classes.find(c => c.class_name === selected.class_applying)
    const admNo = await generateAdmissionNumber()
    const classId = matchedClass?.id || ''
    setConvertClassId(classId)
    const streamsForClass = classStreams.filter(cs => cs.class_id === classId)
    setConvertStreamId(streamsForClass.length === 1 ? streamsForClass[0].id : '')
    setConvertAdmissionNo(admNo)
    setShowConvertModal(true)
  }

  const handleConvert = async () => {
    if (!convertStreamId) return
    setConverting(true)
    try {
      const { error } = await supabase
        .rpc('convert_application_to_student', {
          p_application_id: selected.id,
          p_class_stream_id: convertStreamId,
          p_admission_number: convertAdmissionNo,
        })
      if (error) throw error
      showToast('Student enrolled successfully', 'success')
      setShowConvertModal(false)
      setSelected(null)
      loadApplications()
    } catch (err) {
      console.error(err)
      showToast('Failed to enrol student', 'error')
    } finally {
      setConverting(false)
    }
  }

  const handleBulkStatus = async (newStatus) => {
    if (checkedIds.size === 0) return
    setBulkSaving(true)
    let done = 0
    for (const id of checkedIds) {
      try {
        await supabase.rpc('update_admission_application', { app_id: id, new_status: newStatus, notes: null })
        done++
      } catch { /* skip failed */ }
    }
    showToast(`${done} maombi ${statusLabels[newStatus].toLowerCase()}`, 'success')
    setCheckedIds(new Set())
    loadApplications()
    setBulkSaving(false)
  }

  const toggleCheck = (id) => {
    setCheckedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const toggleCheckAll = () => {
    if (checkedIds.size === filtered.length) {
      setCheckedIds(new Set())
    } else {
      setCheckedIds(new Set(filtered.map(a => a.id)))
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      const { error } = await supabase
        .rpc('delete_admission_application', { p_application_id: selected.id })
      if (error) throw error
      showToast('Application deleted', 'success')
      setShowDeleteConfirm(false)
      setSelected(null)
      loadApplications()
    } catch (err) {
      console.error(err)
      showToast('Failed to delete application', 'error')
    } finally {
      setDeleting(false)
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
        <>
          {checkedIds.size > 0 && (
            <div className="flex items-center gap-3 mb-3 bg-maroon-50 border border-maroon-200 rounded-xl px-4 py-2.5">
              <span className="text-sm font-medium text-maroon-800">{checkedIds.size} yamechaguliwa</span>
              <button
                onClick={() => handleBulkStatus('approved')}
                disabled={bulkSaving}
                className="px-3 py-1.5 text-xs font-semibold text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 transition"
              >Kubali Wote</button>
              <button
                onClick={() => handleBulkStatus('rejected')}
                disabled={bulkSaving}
                className="px-3 py-1.5 text-xs font-semibold text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 transition"
              >Kataa Wote</button>
              <button onClick={() => setCheckedIds(new Set())} className="ml-auto text-xs text-maroon-600 hover:underline">Ondoa Uchaguzi</button>
              {bulkSaving && <span className="w-4 h-4 border-2 border-maroon-400 border-t-transparent rounded-full animate-spin" />}
            </div>
          )}

          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-4 py-3">
                    <input type="checkbox" checked={filtered.length > 0 && checkedIds.size === filtered.length} onChange={toggleCheckAll} className="rounded accent-maroon-600" />
                  </th>
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
                  <tr key={app.id} className={`hover:bg-gray-50 transition ${checkedIds.has(app.id) ? 'bg-maroon-50' : ''}`}>
                    <td className="px-4 py-3">
                      <input type="checkbox" checked={checkedIds.has(app.id)} onChange={() => toggleCheck(app.id)} className="rounded accent-maroon-600" />
                    </td>
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
                    <td colSpan={10} className="px-4 py-8 text-center text-sm text-gray-400">Hakuna maombi</td>
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
                {selected.status === 'approved' && canCreateStudent && (
                  <button
                    onClick={handleOpenConvertModal}
                    disabled={converting}
                    className="px-4 py-2 bg-purple-600 text-white text-xs font-medium rounded-lg hover:bg-purple-700 disabled:opacity-50"
                  >
                    Ingiza kwenye Wanafunzi
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
                    onClick={() => {
                      setRequestMessage('')
                      setRequireAttachment(false)
                      setShowRequestModal(true)
                    }}
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
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="px-4 py-2 bg-gray-600 text-white text-xs font-medium rounded-lg hover:bg-gray-700"
                >
                  Futa Ombi
                </button>
              </div>

              {/* Conversation History */}
              {selected && conversations.length > 0 && (
                <div className="border-t border-gray-200 pt-4 mt-4">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">Mazungumzo</h3>
                  <div className="space-y-3 max-h-64 overflow-y-auto">
                    {conversations.map((msg) => (
                      <div
                        key={msg.id}
                        className={`p-3 rounded-xl text-sm ${
                          msg.sender === 'academic'
                            ? 'bg-blue-50 border border-blue-200 ml-8'
                            : 'bg-gray-50 border border-gray-200 mr-8'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-semibold text-xs text-gray-500">
                            {msg.sender === 'academic' ? 'Shule' : 'Mwombaji'}
                          </span>
                          <span className="text-xs text-gray-400">
                            {new Date(msg.created_at).toLocaleDateString('sw-TZ', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <p className="text-gray-800 whitespace-pre-wrap">{msg.message || 'Hakuna ujumbe'}</p>
                        {msg.sender === 'academic' && msg.requires_attachment && (
                          <p className="text-xs text-blue-600 font-medium mt-1">* Attachment inahitajika</p>
                        )}
                        {msg.attachment_url && (
                          <button
                            onClick={() => setPreviewAttachment(msg.attachment_url)}
                            className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 mt-1 underline"
                          >
                            Fungua attachment
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Loading conversations */}
              {selected && loadingConversations && (
                <div className="border-t border-gray-200 pt-4 mt-4 text-center text-sm text-gray-400">
                  Inapakia mazungumzo...
                </div>
              )}
            </div>
          )}
          </div>
        </>
      )}

      {/* Delete Confirmation */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6">
            <h3 className="text-base font-bold text-gray-900 mb-2">Futa Ombi?</h3>
            <p className="text-sm text-gray-600 mb-5">Je, una uhakika unataka kufuta ombi hili? Hatua hii haiwezi kutenduliwa.</p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleting}
                className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50"
              >
                Ghairi
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {deleting ? 'Inafuta...' : 'Futa'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Convert to Student Modal */}
      {showConvertModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Ingiza Mwanafunzi</h2>
            <p className="text-sm text-gray-500 mb-4">
              Ombi litafutwa baada ya mwanafunzi kuundwa.
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Namba ya Udahili</label>
                <input
                  value={convertAdmissionNo}
                  readOnly
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Darasa</label>
                <select
                  value={convertClassId}
                  onChange={(e) => { setConvertClassId(e.target.value); setConvertStreamId('') }}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                >
                  <option value="">-- Chagua Darasa --</option>
                  {classes.map(c => (
                    <option key={c.id} value={c.id}>{c.class_name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Stream</label>
                <select
                  value={convertStreamId}
                  onChange={(e) => setConvertStreamId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                >
                  <option value="">-- Chagua Stream --</option>
                  {classStreams
                    .filter(cs => cs.class_id === convertClassId)
                    .map(cs => (
                      <option key={cs.id} value={cs.id}>
                        {cs.streams?.stream_name ? `Stream ${cs.streams.stream_name}` : cs.id}
                      </option>
                    ))}
                </select>
              </div>
            </div>
            <div className="flex gap-3 justify-end mt-6">
              <button
                onClick={() => setShowConvertModal(false)}
                disabled={converting}
                className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50"
              >
                Ghairi
              </button>
              <button
                onClick={handleConvert}
                disabled={converting || !convertStreamId}
                className="px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 disabled:opacity-50"
              >
                {converting ? 'Inaunda...' : 'Thibitisha na Unda'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Attachment Preview Modal */}
      {previewAttachment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setPreviewAttachment(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl mx-4 max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h3 className="text-sm font-semibold text-gray-700">Attachment</h3>
              <div className="flex items-center gap-2">
                <a
                  href={previewAttachment}
                  download
                  className="px-3 py-1.5 text-xs font-medium text-white bg-maroon-600 rounded-lg hover:bg-maroon-700"
                >
                  Download
                </a>
                <button onClick={() => setPreviewAttachment(null)} className="p-1 text-gray-400 hover:text-gray-600 text-lg leading-none">&times;</button>
              </div>
            </div>
            <div className="flex-1 min-h-0 p-2">
              <iframe
                src={previewAttachment}
                className="w-full h-[80vh] rounded-lg border-0"
                title="Attachment Preview"
              />
            </div>
          </div>
        </div>
      )}

      {/* Request More Info Modal */}
      {showRequestModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Omba Maelezo Zaidi</h2>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Maelezo kwa Mwombaji</label>
              <textarea
                value={requestMessage}
                onChange={(e) => setRequestMessage(e.target.value)}
                rows={4}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                placeholder="Andika maelezo ya kile shule inahitaji..."
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-700 mb-6 cursor-pointer">
              <input
                type="checkbox"
                checked={requireAttachment}
                onChange={(e) => setRequireAttachment(e.target.checked)}
                className="rounded border-gray-300"
              />
              Nahitaji attachment (PDF) kutoka kwa mwombaji
            </label>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowRequestModal(false)}
                disabled={sendingRequest}
                className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50"
              >
                Ghairi
              </button>
              <button
                onClick={handleSendRequest}
                disabled={sendingRequest || !requestMessage.trim()}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {sendingRequest ? 'Inatuma...' : 'Tuma Ombi'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
