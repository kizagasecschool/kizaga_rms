import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase'

const BUCKET = 'joining-instructions-pdfs'
const LEVELS = ['O_LEVEL', 'A_LEVEL']

const levelLabel = (l) => l === 'O_LEVEL' ? 'O-Level' : 'A-Level'

export default function ManageJoiningInstructions() {
  const [records, setRecords] = useState({ O_LEVEL: null, A_LEVEL: null })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState({ type: '', text: '' })
  const fileInputRef = useRef(null)
  const [uploadingLevel, setUploadingLevel] = useState(null)

  const loadRecords = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('joining_instructions')
      .select('*')
    if (error) {
      setMessage({ type: 'error', text: 'Imeshindwa kupakia: ' + error.message })
    } else {
      const map = { O_LEVEL: null, A_LEVEL: null }
      ;(data || []).forEach(r => { map[r.level] = r })
      setRecords(map)
    }
    setLoading(false)
  }

  useEffect(() => { loadRecords() }, [])

  const uploadPdf = async (file) => {
    const ext = file.name.split('.').pop().toLowerCase()
    const fileName = `joining-${Date.now()}.${ext}`
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(fileName, file, { cacheControl: '3600', upsert: true })
    if (uploadError) throw uploadError
    const { data: { publicUrl } } = supabase.storage
      .from(BUCKET)
      .getPublicUrl(fileName)
    return publicUrl
  }

  const removeOldPdf = async (url) => {
    if (!url) return
    const path = url.split(`/${BUCKET}/`)[1]
    if (path) {
      await supabase.storage.from(BUCKET).remove([path])
    }
  }

  const handleFileChange = async (e, level) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.type !== 'application/pdf') {
      setMessage({ type: 'error', text: 'Tafadhali chagua faili ya PDF tu' })
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      setMessage({ type: 'error', text: 'Faili lazima iwe chini ya 10MB' })
      return
    }
    setSaving(true)
    setUploadingLevel(level)
    setMessage({ type: '', text: '' })
    try {
      const existing = records[level]
      if (existing?.pdf_url) await removeOldPdf(existing.pdf_url)

      const pdfUrl = await uploadPdf(file)
      const title = level === 'O_LEVEL' ? 'Maelekezo ya Kujiunga - O-Level' : 'Maelekezo ya Kujiunga - A-Level'

      if (existing) {
        const { error } = await supabase
          .from('joining_instructions')
          .update({ title, pdf_url: pdfUrl, updated_at: new Date().toISOString() })
          .eq('id', existing.id)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('joining_instructions')
          .insert({ level, title, pdf_url: pdfUrl })
        if (error) throw error
      }

      await loadRecords()
      setMessage({ type: 'success', text: `${levelLabel(level)} PDF imepakiwa` })
    } catch (err) {
      setMessage({ type: 'error', text: 'Imeshindwa: ' + (err.message || err) })
    } finally {
      setSaving(false)
      setUploadingLevel(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleDelete = async (level) => {
    const rec = records[level]
    if (!rec) return
    if (!confirm(`Una uhakika unataka kufuta PDF za ${levelLabel(level)}?`)) return
    setSaving(true)
    try {
      if (rec.pdf_url) await removeOldPdf(rec.pdf_url)
      const { error } = await supabase.from('joining_instructions').delete().eq('id', rec.id)
      if (error) throw error
      await loadRecords()
      setMessage({ type: 'success', text: `PDF ya ${levelLabel(level)} imefutwa` })
    } catch (err) {
      setMessage({ type: 'error', text: 'Imeshindwa kufuta: ' + (err.message || err) })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-maroon-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Maelekezo ya Kujiunga</h1>
        <p className="text-sm text-gray-500 mt-1">Pakia PDF za maelekezo ya kujiunga kwa O-Level na A-Level</p>
      </div>

      {message.text && (
        <div className={`p-4 rounded-xl text-sm font-medium mb-6 ${
          message.type === 'error'
            ? 'bg-red-50 text-red-700 border border-red-200'
            : 'bg-green-50 text-green-700 border border-green-200'
        }`}>
          {message.text}
        </div>
      )}

      <div className="space-y-4">
        {LEVELS.map(level => {
          const rec = records[level]
          return (
            <div key={level} className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="text-sm font-semibold text-gray-800 uppercase tracking-wider">{levelLabel(level)}</h2>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {rec ? 'PDF imepakiwa' : 'Hakuna PDF'}
                  </p>
                </div>
              </div>

              {rec?.pdf_url ? (
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200 mb-4">
                  <div className="w-10 h-10 bg-maroon-100 rounded-lg flex items-center justify-center shrink-0">
                    <svg className="w-5 h-5 text-maroon-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-700 truncate">{rec.pdf_url.split('/').pop()}</p>
                    <a href={rec.pdf_url} target="_blank" rel="noopener noreferrer" className="text-xs text-maroon-600 hover:underline">Fungua PDF</a>
                  </div>
                </div>
              ) : (
                <div className="mb-4 p-4 bg-gray-50 rounded-lg border border-dashed border-gray-300 text-center text-sm text-gray-400">
                  Bado hakuna PDF
                </div>
              )}

              <div className="flex gap-2">
                <label className={`flex items-center gap-2 px-4 py-2 bg-maroon-600 text-white text-sm font-semibold rounded-lg hover:bg-maroon-700 transition cursor-pointer ${saving ? 'opacity-50 pointer-events-none' : ''}`}>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                  </svg>
                  {saving && uploadingLevel === level ? 'Inapakia...' : rec ? 'Badilisha PDF' : 'Pakia PDF'}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="application/pdf"
                    onChange={(e) => handleFileChange(e, level)}
                    className="hidden"
                    disabled={saving}
                  />
                </label>
                {rec && (
                  <button
                    onClick={() => handleDelete(level)}
                    disabled={saving}
                    className="px-4 py-2 text-sm font-semibold text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition disabled:opacity-50"
                  >
                    Futa
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
