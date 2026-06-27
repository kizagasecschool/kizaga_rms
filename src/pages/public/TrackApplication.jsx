import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { Link } from 'react-router-dom'

export default function TrackApplication() {
  useEffect(() => {
    document.title = 'Track Application Status | Kizaga Secondary School'
  }, [])

  const [appNo, setAppNo] = useState('')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [conversations, setConversations] = useState([])
  const [replyMessage, setReplyMessage] = useState('')
  const [replyFile, setReplyFile] = useState(null)
  const [submittingReply, setSubmittingReply] = useState(false)
  const [replySuccess, setReplySuccess] = useState('')
  const [previewAttachment, setPreviewAttachment] = useState(null)

  const statusLabels = {
    pending: 'Inasubiri Kukaguliwa',
    approved: 'Imekubaliwa',
    rejected: 'Imekataliwa',
    needs_info: 'Inahitaji Maelezo Zaidi',
    withdrawn: 'Imeondolewa',
  }

  const statusColors = {
    pending: 'bg-yellow-100 text-yellow-800',
    approved: 'bg-green-100 text-green-800',
    rejected: 'bg-red-100 text-red-800',
    needs_info: 'bg-blue-100 text-blue-800',
    withdrawn: 'bg-gray-100 text-gray-600',
  }

  const loadConversations = async (appId) => {
    const { data: msgs } = await supabase
      .rpc('get_application_conversations', { p_application_id: appId })
    setConversations(msgs || [])
  }

  useEffect(() => {
    if (data) loadConversations(data.id)
  }, [data])

  const handleSubmitReply = async (e) => {
    e.preventDefault()
    if (!replyMessage.trim() && !replyFile) return
    setError('')
    setReplySuccess('')
    if (replyFile) {
      if (replyFile.type !== 'application/pdf') {
        setError('Tafadhali chagua faili ya PDF pekee')
        return
      }
      if (replyFile.size > 1 * 1024 * 1024) {
        setError('Faili si zaidi ya 1MB')
        return
      }
    }
    setSubmittingReply(true)
    try {
      let attachmentUrl = ''
      if (replyFile) {
        const filePath = `${data.id}/${Date.now()}_${replyFile.name}`
        const { error: uploadError } = await supabase.storage
          .from('application-files')
          .upload(filePath, replyFile)
        if (uploadError) throw uploadError
        const { data: urlData } = supabase.storage
          .from('application-files')
          .getPublicUrl(filePath)
        attachmentUrl = urlData.publicUrl
      }
      const { error: replyError } = await supabase
        .rpc('send_application_reply', {
          p_application_id: data.id,
          p_message: replyMessage.trim(),
          p_attachment_url: attachmentUrl,
        })
      if (replyError) throw replyError
      setReplySuccess('Jibu lako limetumwa. Ombi lako sasa linakaguliwa tena.')
      setReplyMessage('')
      setReplyFile(null)
      const { data: updated } = await supabase
        .from('admission_applications')
        .select('*')
        .eq('application_no', appNo.trim().toUpperCase())
        .maybeSingle()
      setData(updated)
      if (updated) loadConversations(updated.id)
    } catch (err) {
      console.error(err)
      setError('Imeshindwa kutuma jibu. Tafadhali jaribu tena.')
    } finally {
      setSubmittingReply(false)
    }
  }

  const handleSearch = async (e) => {
    e.preventDefault()
    if (!appNo.trim()) return
    setLoading(true)
    setError('')
    setData(null)
    setReplySuccess('')
    setReplyMessage('')
    setReplyFile(null)
    try {
      const { data: result, error: queryError } = await supabase
        .from('admission_applications')
        .select('*')
        .eq('application_no', appNo.trim().toUpperCase())
        .maybeSingle()
      if (queryError) throw queryError
      if (!result) {
        setError('Ombi halijapatikana. Tafadhali angalia namba yako.')
        return
      }
      setData(result)
    } catch (err) {
      console.error(err)
      setError('Kuna tatizo. Tafadhali jaribu tena.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-maroon-700 text-white py-4 px-4">
        <div className="max-w-2xl mx-auto">
          <Link to="/" className="text-white/70 hover:text-white text-sm">&larr; Rudi Nyuma</Link>
          <h1 className="text-xl font-bold mt-1">Fuatilia Ombi Lako</h1>
          <p className="text-white/70 text-sm">Ingiza namba ya ombi lako uone hali yake</p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-8">
        <form onSubmit={handleSearch} className="bg-white rounded-2xl border border-gray-200 p-6 mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">Ingiza Namba ya Ombi</label>
          <div className="flex gap-3">
            <input
              value={appNo}
              onChange={(e) => setAppNo(e.target.value)}
              className="flex-1 px-3 py-2.5 border border-gray-200 rounded-xl text-sm"
              placeholder="e.g. APP-2025-0001"
            />
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 bg-maroon-600 text-white text-sm font-medium rounded-xl disabled:opacity-50"
            >
              {loading ? 'Inatafuta...' : 'Tafuta'}
            </button>
          </div>
        </form>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700 mb-4">{error}</div>
        )}

        {data && (
          <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Taarifa za Ombi</h2>
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusColors[data.status]}`}>
                {statusLabels[data.status]}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-500">Namba ya Ombi:</span>
                <p className="font-medium text-gray-900">{data.application_no}</p>
              </div>
              <div>
                <span className="text-gray-500">Tarehe ya Kutuma:</span>
                <p className="font-medium text-gray-900">{new Date(data.created_at).toLocaleDateString('sw-TZ')}</p>
              </div>
              <div>
                <span className="text-gray-500">Jina la Mwanafunzi:</span>
                <p className="font-medium text-gray-900">{data.first_name} {data.middle_name} {data.surname}</p>
              </div>
              <div>
                <span className="text-gray-500">Darasa:</span>
                <p className="font-medium text-gray-900">{data.class_applying}</p>
              </div>
              <div>
                <span className="text-gray-500">Mzazi/Mlezi:</span>
                <p className="font-medium text-gray-900">{data.parent_name}</p>
              </div>
              <div>
                <span className="text-gray-500">Simu:</span>
                <p className="font-medium text-gray-900">{data.parent_phone}</p>
              </div>
            </div>

            <div className="border-t border-gray-100 pt-4 grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-500">Namba la Mtihani:</span>
                <p className="font-medium text-gray-900">{data.exam_no || '-'}</p>
              </div>
              <div>
                <span className="text-gray-500">Mkoa:</span>
                <p className="font-medium text-gray-900">{data.region || '-'}</p>
              </div>
              <div>
                <span className="text-gray-500">Wilaya:</span>
                <p className="font-medium text-gray-900">{data.district || '-'}</p>
              </div>
              <div>
                <span className="text-gray-500">Ulemavu:</span>
                <p className="font-medium text-gray-900">{data.disability || 'Hakuna'}</p>
              </div>
            </div>

            {data.reasons && (
              <div className="border-t border-gray-100 pt-4">
                <span className="text-gray-500 text-sm">Sababu za Kuomba:</span>
                <p className="text-gray-900 mt-1">{data.reasons}</p>
              </div>
            )}

            {data.admin_notes && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <p className="text-xs font-medium text-blue-700 mb-1">Maelezo ya Uongozi:</p>
                <p className="text-sm text-blue-800">{data.admin_notes}</p>
              </div>
            )}

            {/* Conversation History */}
            {conversations.length > 0 && (
              <div className="border-t border-gray-100 pt-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Mazungumzo</h3>
                <div className="space-y-3 max-h-72 overflow-y-auto">
                  {conversations.map((msg) => (
                    <div
                      key={msg.id}
                      className={`p-3 rounded-xl text-sm ${
                        msg.sender === 'academic'
                          ? 'bg-blue-50 border border-blue-200 mr-8'
                          : 'bg-gray-50 border border-gray-200 ml-8'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold text-xs text-gray-500">
                          {msg.sender === 'academic' ? 'Shule' : 'Wewe'}
                        </span>
                        <span className="text-xs text-gray-400">
                          {new Date(msg.created_at).toLocaleDateString('sw-TZ', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="text-gray-800 whitespace-pre-wrap">{msg.message || 'Hakuna ujumbe'}</p>
                      {msg.sender === 'academic' && msg.requires_attachment && (
                        <p className="text-xs text-blue-600 font-medium mt-1">* Tafadhali ambatisha faili ya PDF</p>
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

            {/* Reply Form (only when status is needs_info) */}
            {data.status === 'needs_info' && (
              <form onSubmit={handleSubmitReply} className="border-t border-gray-100 pt-4 space-y-4">
                <h3 className="text-sm font-semibold text-gray-700">Tuma Jibu Lako</h3>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ujumbe wako</label>
                  <textarea
                    value={replyMessage}
                    onChange={(e) => setReplyMessage(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm"
                    placeholder="Andika jibu lako hapa..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Ambatisha faili (PDF, si zaidi ya 1MB)
                  </label>
                  <input
                    type="file"
                    accept="application/pdf"
                    onChange={(e) => setReplyFile(e.target.files[0])}
                    className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-maroon-50 file:text-maroon-700 hover:file:bg-maroon-100"
                  />
                  {replyFile && (
                    <p className="text-xs text-green-600 mt-1">{replyFile.name} ({(replyFile.size / 1024).toFixed(1)} KB)</p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={submittingReply || (!replyMessage.trim() && !replyFile)}
                  className="w-full py-2.5 bg-maroon-600 text-white text-sm font-medium rounded-xl hover:bg-maroon-700 disabled:opacity-50"
                >
                  {submittingReply ? 'Inatuma...' : 'Tuma Jibu'}
                </button>
              </form>
            )}

            {replySuccess && (
              <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-sm text-green-700">
                {replySuccess}
              </div>
            )}
          </div>
        )}
      </div>

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
    </div>
  )
}
