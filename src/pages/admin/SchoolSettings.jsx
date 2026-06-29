import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../../lib/supabase'

export default function SchoolSettings() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState({ type: '', text: '' })
  const timerRef = useRef(null)

  const showMessage = useCallback((a, b) => {
    if (timerRef.current) clearTimeout(timerRef.current)
    const msg = typeof a === 'string' ? { type: a, text: b || '' } : a
    setMessage(msg)
    timerRef.current = setTimeout(() => setMessage({ type: '', text: '' }), 3000)
  }, [])
  const [settings, setSettings] = useState({
    id: '',
    school_name: '',
    school_code: '',
    address: '',
    phone: '',
    email: '',
    region: '',
    district: '',
    logo_url: '',
    national_logo_url: '',
    beem_api_key: '',
    beem_secret_key: '',
    beem_sender_id: '',
  })

  const schoolLogoInput = useRef(null)
  const nationalLogoInput = useRef(null)

  const loadSettings = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('school_settings')
      .select('*')
      .limit(1)
    if (error) {
      console.error('Load settings error:', error)
      showMessage({ type: 'error', text: 'Failed to load settings: ' + (error.message || 'Unknown error') })
    } else if (data && data.length > 0) {
      const row = data[0]
      setSettings({
        id: row.id || '',
        school_name: row.school_name || '',
        school_code: row.school_code || '',
        address: row.address || '',
        phone: row.phone || '',
        email: row.email || '',
        region: row.region || '',
        district: row.district || '',
        logo_url: row.logo_url || '',
        national_logo_url: row.national_logo_url || '',
        beem_api_key: row.beem_api_key || '',
        beem_secret_key: row.beem_secret_key || '',
        beem_sender_id: row.beem_sender_id || '',
      })
    }
    setLoading(false)
  }

  useEffect(() => { loadSettings() }, [])

  const handleChange = (e) => {
    const { name, value } = e.target
    setSettings(prev => ({ ...prev, [name]: value }))
  }

  const uploadLogo = async (file, type) => {
    const ext = file.name.split('.').pop().toLowerCase()
    const fileName = `${type}-${Date.now()}.${ext}`
    const filePath = `logos/${fileName}`
    const { error } = await supabase.storage
      .from('school-logos')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: true,
      })
    if (error) throw error
    const { data: { publicUrl } } = supabase.storage
      .from('school-logos')
      .getPublicUrl(filePath)
    return publicUrl
  }

  const handleLogoChange = async (e, type) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      showMessage({ type: 'error', text: 'Please select an image file' })
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      showMessage({ type: 'error', text: 'Image must be less than 5MB' })
      return
    }
    try {
      setSaving(true)
      showMessage({ type: '', text: '' })
      const url = await uploadLogo(file, type)
      const field = type === 'school' ? 'logo_url' : 'national_logo_url'

      // Immediately persist the URL to the DB so it survives page navigation
      if (settings.id) {
        const { error: saveErr } = await supabase
          .from('school_settings')
          .update({ [field]: url, updated_at: new Date().toISOString() })
          .eq('id', settings.id)
        if (saveErr) throw new Error('Uploaded but failed to save URL: ' + saveErr.message)
      }

      setSettings(prev => ({ ...prev, [field]: url }))
      showMessage({ type: 'success', text: 'Logo uploaded and saved' })
    } catch (err) {
      showMessage({ type: 'error', text: 'Failed to upload logo: ' + (err.message || err) })
    } finally {
      setSaving(false)
    }
  }

  const removeLogo = async (type) => {
    const field = type === 'school' ? 'logo_url' : 'national_logo_url'
    const url = settings[field]
    if (!url) return
    try {
      const path = url.split('/school-logos/')[1]
      if (path) {
        await supabase.storage.from('school-logos').remove([path])
      }
      // Immediately persist the removal to DB
      if (settings.id) {
        await supabase
          .from('school_settings')
          .update({ [field]: null, updated_at: new Date().toISOString() })
          .eq('id', settings.id)
      }
      setSettings(prev => ({ ...prev, [field]: '' }))
      showMessage({ type: 'success', text: 'Logo removed' })
    } catch (err) {
      showMessage({ type: 'error', text: 'Failed to remove logo: ' + (err.message || err) })
    }
  }

  const handleSave = async (e) => {
    e.preventDefault()
    if (!settings.school_name || !settings.school_code) {
      showMessage({ type: 'error', text: 'School name and code are required' })
      return
    }
    setSaving(true)
    showMessage({ type: '', text: '' })
      const { error } = await supabase
      .from('school_settings')
      .upsert({
        id: settings.id || undefined,
        school_name: settings.school_name,
        school_code: settings.school_code,
        address: settings.address,
        phone: settings.phone,
        email: settings.email,
        region: settings.region,
        district: settings.district,
        logo_url: settings.logo_url || null,
        national_logo_url: settings.national_logo_url || null,
        beem_api_key: settings.beem_api_key || null,
        beem_secret_key: settings.beem_secret_key || null,
        beem_sender_id: settings.beem_sender_id || null,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'id' })
    if (error) {
      showMessage({ type: 'error', text: 'Save failed: ' + error.message })
    } else {
      showMessage({ type: 'success', text: 'School settings saved successfully' })
    }
    setSaving(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-maroon-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">School Settings</h1>
        <p className="text-sm text-gray-500 mt-1">Manage your school information and logos</p>
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

      <form onSubmit={handleSave} className="space-y-6">
        {/* School Name & Code */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <h2 className="text-sm font-semibold text-gray-800 uppercase tracking-wider">School Identity</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">School Name *</label>
              <input
                type="text"
                name="school_name"
                value={settings.school_name}
                onChange={handleChange}
                required
                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:border-maroon-400 focus:ring-4 focus:ring-maroon-500/10 outline-none transition"
                placeholder="e.g. Kizaga Secondary School"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">School Code *</label>
              <input
                type="text"
                name="school_code"
                value={settings.school_code}
                onChange={handleChange}
                required
                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:border-maroon-400 focus:ring-4 focus:ring-maroon-500/10 outline-none transition"
                placeholder="e.g. KSS001"
              />
            </div>
          </div>
        </div>

        {/* Contact */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <h2 className="text-sm font-semibold text-gray-800 uppercase tracking-wider">Contact Information</h2>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
            <textarea
              name="address"
              value={settings.address}
              onChange={handleChange}
              rows={2}
              className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:border-maroon-400 focus:ring-4 focus:ring-maroon-500/10 outline-none transition resize-none"
              placeholder="P.O. Box 123, Dar es Salaam"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
              <input
                type="text"
                name="phone"
                value={settings.phone}
                onChange={handleChange}
                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:border-maroon-400 focus:ring-4 focus:ring-maroon-500/10 outline-none transition"
                placeholder="+255 700 000 000"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                name="email"
                value={settings.email}
                onChange={handleChange}
                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:border-maroon-400 focus:ring-4 focus:ring-maroon-500/10 outline-none transition"
                placeholder="info@school.ac.tz"
              />
            </div>
          </div>
        </div>

        {/* Location */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <h2 className="text-sm font-semibold text-gray-800 uppercase tracking-wider">Location</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Region (Mkoa)</label>
              <input
                type="text"
                name="region"
                value={settings.region}
                onChange={handleChange}
                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:border-maroon-400 focus:ring-4 focus:ring-maroon-500/10 outline-none transition"
                placeholder="e.g. Dar es Salaam"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">District (Wilaya)</label>
              <input
                type="text"
                name="district"
                value={settings.district}
                onChange={handleChange}
                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:border-maroon-400 focus:ring-4 focus:ring-maroon-500/10 outline-none transition"
                placeholder="e.g. Ilala"
              />
            </div>
          </div>
        </div>

        {/* Logos */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <h2 className="text-sm font-semibold text-gray-800 uppercase tracking-wider">Logos</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {/* School Logo */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">School Logo</label>
              {settings.logo_url ? (
                <div className="relative inline-block">
                  <img
                    src={settings.logo_url}
                    alt="School Logo"
                    className="w-28 h-28 object-contain border border-gray-200 rounded-lg"
                  />
                  <button
                    type="button"
                    onClick={() => removeLogo('school')}
                    className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ) : (
                <div
                  onClick={() => schoolLogoInput.current?.click()}
                  className="w-28 h-28 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-maroon-400 hover:bg-maroon-50/20 transition"
                >
                  <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                  </svg>
                  <span className="text-[10px] text-gray-400 mt-1">Upload</span>
                </div>
              )}
              <input
                ref={schoolLogoInput}
                type="file"
                accept="image/*"
                onChange={(e) => handleLogoChange(e, 'school')}
                className="hidden"
              />
              <p className="text-[10px] text-gray-400 mt-1">PNG, JPG, WEBP. Max 5MB</p>
            </div>

            {/* National Logo */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">National Logo (Logo ya Umoja)</label>
              {settings.national_logo_url ? (
                <div className="relative inline-block">
                  <img
                    src={settings.national_logo_url}
                    alt="National Logo"
                    className="w-28 h-28 object-contain border border-gray-200 rounded-lg"
                  />
                  <button
                    type="button"
                    onClick={() => removeLogo('national')}
                    className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ) : (
                <div
                  onClick={() => nationalLogoInput.current?.click()}
                  className="w-28 h-28 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-maroon-400 hover:bg-maroon-50/20 transition"
                >
                  <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                  </svg>
                  <span className="text-[10px] text-gray-400 mt-1">Upload</span>
                </div>
              )}
              <input
                ref={nationalLogoInput}
                type="file"
                accept="image/*"
                onChange={(e) => handleLogoChange(e, 'national')}
                className="hidden"
              />
              <p className="text-[10px] text-gray-400 mt-1">Tanzania Coat of Arms. PNG, JPG. Max 5MB</p>
            </div>
          </div>
        </div>

        {/* Beem Africa SMS */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-gray-800 uppercase tracking-wider">SMS Configuration (Beem Africa)</h2>
            <p className="text-xs text-gray-400 mt-0.5">Configure Beem Africa SMS gateway to send SMS to parents. Get credentials at <span className="font-mono">apisms.beem.africa</span></p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">API Key</label>
              <input
                type="text"
                name="beem_api_key"
                value={settings.beem_api_key}
                onChange={handleChange}
                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:border-maroon-400 focus:ring-4 focus:ring-maroon-500/10 outline-none transition"
                placeholder="Beem Africa API Key"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Secret Key</label>
              <input
                type="password"
                name="beem_secret_key"
                value={settings.beem_secret_key}
                onChange={handleChange}
                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:border-maroon-400 focus:ring-4 focus:ring-maroon-500/10 outline-none transition"
                placeholder="Beem Africa Secret Key"
              />
            </div>
          </div>
          <div className="sm:w-1/2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Sender ID</label>
            <input
              type="text"
              name="beem_sender_id"
              value={settings.beem_sender_id}
              onChange={handleChange}
              className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:border-maroon-400 focus:ring-4 focus:ring-maroon-500/10 outline-none transition"
              placeholder="e.g. KIZAGA"
              maxLength={11}
            />
            <p className="text-xs text-gray-400 mt-1">Max 11 characters. Must be registered with Beem Africa.</p>
          </div>
        </div>

        {/* Save */}
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2.5 bg-maroon-600 text-white text-sm font-semibold rounded-lg hover:bg-maroon-700 disabled:opacity-50 transition flex items-center gap-2"
          >
            {saving && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
          <button
            type="button"
            onClick={loadSettings}
            className="px-6 py-2.5 text-sm font-semibold text-gray-600 hover:text-gray-800 border border-gray-200 rounded-lg hover:bg-gray-50 transition"
          >
            Reset
          </button>
        </div>
      </form>
    </div>
  )
}
