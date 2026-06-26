import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useNotification } from '../context/NotificationContext'

const defaultItems = (category, classLevel) => {
  if (category === 'HOSTEL') return ['', '', '', '']
  if (category === 'SHAMBA') return ['', '', '']
  if (classLevel === 'O_LEVEL') return ['Shati jeupe (White shirt)', 'Suruali/sketi kahawia (Brown trousers/skirt)', 'Tie ya shule', 'Viatu vyeusi', 'Sweater ya shule']
  if (classLevel === 'A_LEVEL') return ['Shati la blue (Blue shirt)', 'Suruali/sketi navy (Navy trousers/skirt)', 'Tie ya shule', 'Viatu vyeusi', 'Blazer ya shule']
  return ['']
}

const categoryLabels = { SCHOOL: 'Sare ya Shule', HOSTEL: 'Sare ya Hostel', SHAMBA: 'Sare ya Shamba', SPORTS: 'Sare ya Michezo' }
const classOptions = ['ALL', 'O_LEVEL', 'A_LEVEL', 'Form 1', 'Form 2', 'Form 3', 'Form 4', 'Form 5', 'Form 6']

export default function ManageUniforms() {
  const { profile } = useAuth()
  const { showToast } = useNotification()
  const [uniforms, setUniforms] = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef()

  const [form, setForm] = useState({
    category: 'SCHOOL',
    class_level: 'O_LEVEL',
    title: '',
    description: '',
    image_url: '',
    items: [],
    gender: '',
    sort_order: 0,
  })

  const loadUniforms = async () => {
    setLoading(true)
    const { data, error } = await supabase.rpc('get_uniforms')
    if (error) {
      showToast('Failed to load uniforms', 'error')
    } else {
      setUniforms(data || [])
    }
    setLoading(false)
  }

  useEffect(() => { loadUniforms() }, [])

  const canManage = ['admin', 'headmaster'].includes(profile?.role)
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

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm(prev => ({
      ...prev,
      [name]: value,
      ...(name === 'category' && { items: defaultItems(value, form.class_level) }),
      ...(name === 'class_level' && { items: defaultItems(form.category, value) }),
    }))
  }

  const handleItemChange = (idx, val) => {
    setForm(prev => {
      const items = [...prev.items]
      items[idx] = val
      return { ...prev, items }
    })
  }

  const addItem = () => setForm(prev => ({ ...prev, items: [...prev.items, ''] }))
  const removeItem = (idx) => setForm(prev => ({ ...prev, items: prev.items.filter((_, i) => i !== idx) }))

  const uploadImage = async (file) => {
    const ext = file.name.split('.').pop().toLowerCase()
    const fileName = `uniform-${Date.now()}.${ext}`
    const filePath = `uniforms/${fileName}`
    const { error: uploadError } = await supabase.storage
      .from('school-logos')
      .upload(filePath, file, { cacheControl: '3600', upsert: true })
    if (uploadError) throw uploadError
    const { data: { publicUrl } } = supabase.storage
      .from('school-logos')
      .getPublicUrl(filePath)
    return publicUrl
  }

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      showToast('Please select an image file', 'error')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      showToast('Image must be under 5MB', 'error')
      return
    }
    setUploading(true)
    try {
      const url = await uploadImage(file)
      setForm(prev => ({ ...prev, image_url: url }))
      showToast('Image uploaded', 'success')
    } catch {
      showToast('Failed to upload image', 'error')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const removeImage = async () => {
    if (!form.image_url) return
    try {
      const path = form.image_url.split('/school-logos/')[1]
      if (path) await supabase.storage.from('school-logos').remove([path])
    } catch { /* best-effort */ }
    // If editing an existing record, persist removal immediately so cancel doesn't leave a dead URL
    if (editing) {
      await supabase.from('uniforms')
        .update({ image_url: '', updated_at: new Date().toISOString() })
        .eq('id', editing)
    }
    setForm(prev => ({ ...prev, image_url: '' }))
  }

  const openEdit = (u) => {
    setForm({
      category: u.category,
      class_level: u.class_level,
      title: u.title,
      description: u.description || '',
      image_url: u.image_url || '',
      items: Array.isArray(u.items) ? u.items : [],
      gender: u.gender || '',
      sort_order: u.sort_order || 0,
    })
    setEditing(u.id)
  }

  const resetForm = () => {
    setForm({
      category: 'SCHOOL',
      class_level: 'O_LEVEL',
      title: '',
      description: '',
      image_url: '',
      items: defaultItems('SCHOOL', 'O_LEVEL'),
      gender: '',
      sort_order: 0,
    })
    setEditing(null)
  }

  const handleSave = async (e) => {
    e.preventDefault()
    if (!form.title) {
      showToast('Please enter a uniform name', 'error')
      return
    }
    setSaving(true)
    try {
      const { error } = await supabase.rpc('save_uniform', {
        p_id: editing,
        p_category: form.category,
        p_class_level: form.class_level,
        p_title: form.title,
        p_description: form.description,
        p_image_url: form.image_url,
        p_items: form.items.filter(Boolean),
        p_gender: form.gender,
        p_sort_order: form.sort_order,
      })
      if (error) throw error
      showToast(editing ? 'Uniform updated' : 'Uniform added', 'success')
      resetForm()
      loadUniforms()
    } catch {
      showToast('Failed to save uniform', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Una uhakika unataka kufuta sare hii?')) return
    try {
      const { error } = await supabase.rpc('delete_uniform', { p_id: id })
      if (error) throw error
      showToast('Uniform deleted', 'success')
      if (editing === id) resetForm()
      loadUniforms()
    } catch {
      showToast('Failed to delete uniform', 'error')
    }
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Sare za Shule</h1>
        <p className="text-sm text-gray-500 mt-1">Dhibiti sare za wanafunzi kwa ajili ya shule, hostel, shamba na michezo</p>
      </div>

      {/* Form */}
      <form onSubmit={handleSave} className="bg-white rounded-2xl border border-gray-200 p-5 mb-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">{editing ? 'Hariri Sare' : 'Ongeza Sare Mpya'}</h2>
          {editing && (
            <button type="button" onClick={resetForm} className="text-xs text-gray-500 hover:text-gray-700">Ghairi</button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Aina</label>
            <select name="category" value={form.category} onChange={handleChange} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm">
              {Object.entries(categoryLabels).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Kiwango / Darasa</label>
            <select name="class_level" value={form.class_level} onChange={handleChange} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm">
              {classOptions.map(o => (
                <option key={o} value={o}>{o === 'ALL' ? 'Wote' : o === 'O_LEVEL' ? 'O-Level' : o === 'A_LEVEL' ? 'A-Level' : o}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Jinsia (si lazima)</label>
            <select name="gender" value={form.gender} onChange={handleChange} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm">
              <option value="">Wote</option>
              <option value="Male">Kiume</option>
              <option value="Female">Kike</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Jina la Sare *</label>
          <input name="title" value={form.title} onChange={handleChange} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" placeholder="e.g. O-Level Sare ya Shule" />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Maelezo</label>
          <textarea name="description" value={form.description} onChange={handleChange} rows={2} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" placeholder="Maelezo mafupi kuhusu sare hizi..." />
        </div>

        {/* Items */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-xs font-medium text-gray-600">Vipengele vya Sare</label>
            <button type="button" onClick={addItem} className="text-xs text-maroon-600 hover:text-maroon-700 font-medium">+ Ongeza kipengele</button>
          </div>
          <div className="space-y-1.5">
            {form.items.map((item, idx) => (
              <div key={idx} className="flex gap-2">
                <input value={item} onChange={(e) => handleItemChange(idx, e.target.value)} className="flex-1 px-3 py-1.5 border border-gray-200 rounded-lg text-xs" placeholder={`Kipengele ${idx + 1}`} />
                {form.items.length > 1 && (
                  <button type="button" onClick={() => removeItem(idx)} className="text-red-400 hover:text-red-600 text-xs px-1">&times;</button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Image Upload */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Picha ya Sare</label>
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} className="px-3 py-2 border border-gray-200 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50">
              {uploading ? 'Inapakia...' : 'Chagua Picha'}
            </button>
            {form.image_url && (
              <button type="button" onClick={removeImage} className="text-xs text-red-500 hover:text-red-700">Ondoa</button>
            )}
            <input ref={fileRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
          </div>
          {form.image_url && (
            <div className="mt-2 w-32 h-32 rounded-lg border border-gray-200 overflow-hidden bg-gray-50">
              <img src={form.image_url} alt="Sare" className="w-full h-full object-cover" />
            </div>
          )}
        </div>

        <div className="w-32">
          <label className="block text-xs font-medium text-gray-600 mb-1">Mpangilio</label>
          <input type="number" name="sort_order" value={form.sort_order} onChange={handleChange} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
        </div>

        <button type="submit" disabled={saving || uploading} className="px-5 py-2 bg-maroon-600 text-white text-sm font-medium rounded-xl hover:bg-maroon-700 disabled:opacity-50">
          {saving ? 'Inaokoa...' : editing ? 'Sasisha Sare' : 'Ongeza Sare'}
        </button>
      </form>

      {/* Uniforms List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-6 h-6 border-3 border-gray-200 border-t-maroon-600 rounded-full animate-spin" />
        </div>
      ) : uniforms.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center text-sm text-gray-400">Hakuna sare zilizowekwa. Bofya "Ongeza Sare Mpya" kuanza.</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {uniforms.map(u => (
            <div key={u.id} className="bg-white rounded-2xl border border-gray-200 overflow-hidden hover:shadow-md transition">
              {u.image_url ? (
                <div className="aspect-[4/3] bg-gray-100 overflow-hidden">
                  <img src={u.image_url} alt={u.title} className="w-full h-full object-cover" />
                </div>
              ) : (
                <div className="aspect-[4/3] bg-gradient-to-br from-maroon-50 to-maroon-100 flex items-center justify-center">
                  <svg className="w-12 h-12 text-maroon-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
                  </svg>
                </div>
              )}
              <div className="p-4">
                <div className="flex flex-wrap items-center gap-1.5 mb-1">
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-maroon-100 text-maroon-700">{categoryLabels[u.category]}</span>
                  {u.class_level !== 'ALL' && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-600">{u.class_level}</span>
                  )}
                  {u.gender && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-50 text-blue-600">{u.gender === 'Male' ? 'Kiume' : 'Kike'}</span>
                  )}
                </div>
                <h3 className="font-semibold text-gray-900 text-sm">{u.title}</h3>
                {u.description && <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{u.description}</p>}
                {Array.isArray(u.items) && u.items.length > 0 && (
                  <ul className="mt-2 space-y-0.5">
                    {u.items.slice(0, 4).map((item, i) => (
                      <li key={i} className="flex items-start gap-1.5 text-xs text-gray-600">
                        <span className="w-1 h-1 rounded-full bg-maroon-500 mt-1.5 shrink-0"></span>
                        {item}
                      </li>
                    ))}
                    {u.items.length > 4 && (
                      <li className="text-xs text-gray-400 pl-3">+{u.items.length - 4} zaidi</li>
                    )}
                  </ul>
                )}
                <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100">
                  <button onClick={() => openEdit(u)} className="text-xs text-maroon-600 hover:text-maroon-700 font-medium">Hariri</button>
                  <button onClick={() => handleDelete(u.id)} className="text-xs text-red-500 hover:text-red-700 font-medium">Futa</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
