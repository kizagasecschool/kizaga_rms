import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase'

const BUCKET = 'events-media'

export default function ManageEventsAnnouncements() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState({ type: '', text: '' })
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const fileInputRef = useRef(null)

  const [form, setForm] = useState({
    type: 'ANNOUNCEMENT',
    title: '',
    description: '',
    event_date: '',
    file_url: '',
    file_type: '',
  })

  const loadItems = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('events_announcements')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false })
    if (error) {
      console.error('Load error:', error)
      setMessage({ type: 'error', text: 'Failed to load: ' + error.message })
    } else {
      setItems(data || [])
    }
    setLoading(false)
  }

  useEffect(() => { loadItems() }, [])

  const resetForm = () => {
    setForm({ type: 'ANNOUNCEMENT', title: '', description: '', event_date: '', file_url: '', file_type: '' })
    setEditing(null)
    setShowForm(false)
  }

  const editItem = (item) => {
    setForm({
      type: item.type,
      title: item.title,
      description: item.description || '',
      event_date: item.event_date || '',
      file_url: item.file_url || '',
      file_type: item.file_type || '',
    })
    setEditing(item.id)
    setShowForm(true)
  }

  const uploadFile = async (file) => {
    const ext = file.name.split('.').pop().toLowerCase()
    const isImage = ['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(ext)
    const prefix = isImage ? 'image' : 'pdf'
    const fileName = `${prefix}-${Date.now()}.${ext}`
    const filePath = `${fileName}`
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(filePath, file, { cacheControl: '3600', upsert: true })
    if (uploadError) throw uploadError
    const { data: { publicUrl } } = supabase.storage
      .from(BUCKET)
      .getPublicUrl(filePath)
    return { url: publicUrl, fileType: isImage ? 'image' : 'pdf' }
  }

  const removeOldFile = async (url) => {
    if (!url) return
    const path = url.split(`/${BUCKET}/`)[1]
    if (path) {
      await supabase.storage.from(BUCKET).remove([path])
    }
  }

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const isImage = file.type.startsWith('image/')
    const isPdf = file.type === 'application/pdf'
    if (!isImage && !isPdf) {
      setMessage({ type: 'error', text: 'Please select an image or PDF file' })
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      setMessage({ type: 'error', text: 'File must be under 10MB' })
      return
    }
    setSaving(true)
    try {
      await removeOldFile(form.file_url)
      const { url, fileType } = await uploadFile(file)
      setForm(prev => ({ ...prev, file_url: url, file_type: fileType }))
      setMessage({ type: 'success', text: 'File uploaded' })
    } catch (err) {
      setMessage({ type: 'error', text: 'Upload failed: ' + (err.message || err) })
    } finally {
      setSaving(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleRemoveFile = async () => {
    if (!form.file_url) return
    await removeOldFile(form.file_url)
    setForm(prev => ({ ...prev, file_url: '', file_type: '' }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.title) {
      setMessage({ type: 'error', text: 'Please enter a title' })
      return
    }
    setSaving(true)
    setMessage({ type: '', text: '' })
    try {
      const payload = {
        type: form.type,
        title: form.title,
        description: form.description,
        file_url: form.file_url || null,
        file_type: form.file_type || null,
        event_date: form.type === 'EVENT' && form.event_date ? form.event_date : null,
      }
      if (editing) {
        const { error } = await supabase
          .from('events_announcements')
          .update({ ...payload, updated_at: new Date().toISOString() })
          .eq('id', editing)
        if (error) throw error
        setMessage({ type: 'success', text: 'Updated successfully' })
      } else {
        const { error } = await supabase
          .from('events_announcements')
          .insert(payload)
        if (error) throw error
        setMessage({ type: 'success', text: 'Created successfully' })
      }
      resetForm()
      await loadItems()
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to save: ' + (err.message || err) })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Una uhakika unataka kufuta?')) return
    const item = items.find(i => i.id === id)
    if (item?.file_url) await removeOldFile(item.file_url)
    const { error } = await supabase.from('events_announcements').delete().eq('id', id)
    if (error) {
      setMessage({ type: 'error', text: 'Failed to delete: ' + error.message })
    } else {
      setMessage({ type: 'success', text: 'Deleted successfully' })
      await loadItems()
    }
  }

  const handleToggleActive = async (item) => {
    const { error } = await supabase
      .from('events_announcements')
      .update({ is_active: !item.is_active, updated_at: new Date().toISOString() })
      .eq('id', item.id)
    if (!error) await loadItems()
  }

  const filtered = items.filter(i => !editing || i.id === editing)

  if (loading && items.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-maroon-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const events = items.filter(i => i.type === 'EVENT')
  const announcements = items.filter(i => i.type === 'ANNOUNCEMENT')

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Matukio na Matangazo</h1>
          <p className="text-sm text-gray-500 mt-1">Simamia matukio na matangazo ya shule</p>
        </div>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="px-4 py-2.5 bg-maroon-600 text-white text-sm font-semibold rounded-lg hover:bg-maroon-700 transition flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Ongeza
          </button>
        )}
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

      {/* Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 p-5 space-y-4 mb-6">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-800 uppercase tracking-wider">
              {editing ? 'Hariri' : 'Ongeza'} {form.type === 'EVENT' ? 'Tukio' : 'Tangazo'}
            </h2>
            <button type="button" onClick={resetForm} className="text-sm text-gray-400 hover:text-gray-600">&times; Ghairi</button>
          </div>

          {/* Type */}
          <div className="flex gap-2">
            {['ANNOUNCEMENT', 'EVENT'].map(t => (
              <button
                key={t}
                type="button"
                onClick={() => setForm(prev => ({ ...prev, type: t, event_date: t === 'ANNOUNCEMENT' ? '' : prev.event_date }))}
                className={`flex-1 py-2.5 text-sm font-semibold rounded-lg border transition ${
                  form.type === t
                    ? 'bg-maroon-600 text-white border-maroon-600'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                }`}
              >
                {t === 'EVENT' ? 'Tukio' : 'Tangazo'}
              </button>
            ))}
          </div>

          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Jina *</label>
            <input
              type="text"
              value={form.title}
              onChange={e => setForm(prev => ({ ...prev, title: e.target.value }))}
              className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:border-maroon-400 focus:ring-4 focus:ring-maroon-500/10 outline-none transition"
              placeholder="Jina la tukio au tangazo"
              required
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Maelezo</label>
            <textarea
              value={form.description}
              onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))}
              rows={3}
              className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:border-maroon-400 focus:ring-4 focus:ring-maroon-500/10 outline-none transition resize-none"
              placeholder="Maelezo mafupi..."
            />
          </div>

          {/* Event Date */}
          {form.type === 'EVENT' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tarehe ya Tukio *</label>
              <input
                type="date"
                value={form.event_date}
                onChange={e => setForm(prev => ({ ...prev, event_date: e.target.value }))}
                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:border-maroon-400 focus:ring-4 focus:ring-maroon-500/10 outline-none transition"
                required={form.type === 'EVENT'}
              />
            </div>
          )}

          {/* File Upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Picha au PDF</label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,application/pdf"
              onChange={handleFileChange}
              className="hidden"
            />
            {form.file_url ? (
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                {form.file_type === 'image' ? (
                  <img src={form.file_url} alt="" className="w-12 h-12 object-cover rounded-lg" />
                ) : (
                  <div className="w-12 h-12 bg-maroon-100 rounded-lg flex items-center justify-center">
                    <svg className="w-6 h-6 text-maroon-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                    </svg>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-700 truncate">{form.file_url.split('/').pop()}</p>
                  <a href={form.file_url} target="_blank" rel="noopener noreferrer" className="text-xs text-maroon-600 hover:underline">Fungua</a>
                </div>
                <button type="button" onClick={handleRemoveFile} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2.5 border-2 border-dashed border-gray-300 rounded-lg text-sm text-gray-500 hover:border-maroon-400 hover:text-maroon-600 transition disabled:opacity-50"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                </svg>
                {saving ? 'Inapakia...' : 'Pakia picha au PDF'}
              </button>
            )}
            <p className="text-xs text-gray-400 mt-1">PNG, JPG, WEBP au PDF. Max 10MB</p>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2.5 bg-maroon-600 text-white text-sm font-semibold rounded-lg hover:bg-maroon-700 disabled:opacity-50 transition flex items-center gap-2"
            >
              {saving && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
              {saving ? 'Inahifadhi...' : editing ? 'Sasisha' : 'Hifadhi'}
            </button>
            <button type="button" onClick={resetForm} className="px-5 py-2.5 text-sm font-semibold text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition">
              Ghairi
            </button>
          </div>
        </form>
      )}

      {/* Events List */}
      {events.length > 0 && (
        <div className="mb-8">
          <h2 className="text-sm font-semibold text-gray-800 uppercase tracking-wider mb-3">Matukio</h2>
          <div className="space-y-2">
            {events.map(item => (
              <ItemRow key={item.id} item={item} onEdit={editItem} onDelete={handleDelete} onToggle={handleToggleActive} />
            ))}
          </div>
        </div>
      )}

      {/* Announcements List */}
      {announcements.length > 0 && (
        <div className="mb-8">
          <h2 className="text-sm font-semibold text-gray-800 uppercase tracking-wider mb-3">Matangazo</h2>
          <div className="space-y-2">
            {announcements.map(item => (
              <ItemRow key={item.id} item={item} onEdit={editItem} onDelete={handleDelete} onToggle={handleToggleActive} />
            ))}
          </div>
        </div>
      )}

      {!showForm && items.length === 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <svg className="w-7 h-7 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
            </svg>
          </div>
          <h3 className="text-sm font-semibold text-gray-900">Hakuna matukio au matangazo</h3>
          <p className="text-xs text-gray-500 mt-1">Bonyeza "Ongeza" kuongeza tukio au tangazo la kwanza</p>
        </div>
      )}
    </div>
  )
}

function ItemRow({ item, onEdit, onDelete, onToggle }) {
  return (
    <div className={`bg-white rounded-lg border ${item.is_active ? 'border-gray-200' : 'border-gray-100 bg-gray-50'} p-4 flex items-center gap-4`}>
      {/* Thumbnail */}
      {item.file_url ? (
        item.file_type === 'image' ? (
          <img src={item.file_url} alt="" className="w-12 h-12 object-cover rounded-lg shrink-0" />
        ) : (
          <div className="w-12 h-12 bg-maroon-100 rounded-lg flex items-center justify-center shrink-0">
            <svg className="w-6 h-6 text-maroon-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>
          </div>
        )
      ) : (
        <div className={`w-12 h-12 rounded-lg flex items-center justify-center shrink-0 ${item.type === 'EVENT' ? 'bg-orange-100' : 'bg-blue-100'}`}>
          <svg className={`w-6 h-6 ${item.type === 'EVENT' ? 'text-orange-600' : 'text-blue-600'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
            {item.type === 'EVENT'
              ? <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
              : <path strokeLinecap="round" strokeLinejoin="round" d="M10.34 15.84c-.688-.06-1.386-.09-2.09-.09H7.5a4.5 4.5 0 110-9h.75c.704 0 1.402-.03 2.09-.09m0 9.18c.253.962.584 1.892.985 2.783.247.55.06 1.21-.463 1.511l-.657.38a.496.496 0 01-.708-.298 12.006 12.006 0 00-.877-1.852m0-3.18a23.96 23.96 0 010-3.18m0 3.18c.255-1.253.378-2.537.378-3.82 0-1.282-.123-2.568-.378-3.82m0 0c.688.06 1.386.09 2.09.09H16.5a4.5 4.5 0 010 9h-.75c-.704 0-1.402.03-2.09.09m0 0c-.253.962-.584 1.892-.985 2.783-.247.55-.06 1.21.463 1.511l.657.38c.38.219.852-.05.852-.486 0-1.038.078-2.059.23-3.055" />
            }
          </svg>
        </div>
      )}

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
            item.type === 'EVENT'
              ? 'bg-orange-100 text-orange-700'
              : 'bg-blue-100 text-blue-700'
          }`}>
            {item.type === 'EVENT' ? 'Tukio' : 'Tangazo'}
          </span>
          {!item.is_active && (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-gray-200 text-gray-600">Imefichwa</span>
          )}
        </div>
        <p className="text-sm font-medium text-gray-900 mt-0.5 truncate">{item.title}</p>
        {item.type === 'EVENT' && item.event_date && (
          <p className="text-xs text-gray-500 mt-0.5">
            {new Date(item.event_date).toLocaleDateString('sw-TZ', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 shrink-0">
        <button onClick={() => onToggle(item)} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition" title={item.is_active ? 'Ficha' : 'Onyesha'}>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
            {item.is_active
              ? <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
              : <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
            }
          </svg>
        </button>
        <button onClick={() => onEdit(item)} className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition" title="Hariri">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
          </svg>
        </button>
        <button onClick={() => onDelete(item.id)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition" title="Futa">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
          </svg>
        </button>
      </div>
    </div>
  )
}
