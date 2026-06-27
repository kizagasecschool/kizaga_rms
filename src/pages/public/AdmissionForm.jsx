import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { Link } from 'react-router-dom'

export default function AdmissionForm() {
  useEffect(() => {
    document.title = 'Apply for Admission | Kizaga Secondary School'
  }, [])
  const [form, setForm] = useState({
    first_name: '', middle_name: '', surname: '',
    gender: '', date_of_birth: '',
    class_applying: '',
    previous_school: '',
    exam_no: '', region: '', district: '', disability: '', reasons: '',
    parent_name: '', parent_phone: '', parent_email: '', address: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(null)
  const [error, setError] = useState('')

  const handleChange = (e) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const generateApplicationNo = async () => {
    const year = new Date().getFullYear()
    const { data } = await supabase
      .from('admission_applications')
      .select('application_no')
      .like('application_no', `APP-${year}-%`)
      .order('application_no', { ascending: false })
      .limit(1)
    const lastNum = data?.length > 0 ? parseInt((data[0].application_no || '').split('-')[2] || '0', 10) : 0
    return `APP-${year}-${String(lastNum + 1).padStart(4, '0')}`
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.first_name || !form.surname || !form.parent_name || !form.parent_phone || !form.class_applying || !form.gender) {
      setError('Tafadhali jaza sehemu zote muhimu (zenye *)')
      return
    }
    if (!form.region || !form.district || !form.reasons) {
      setError('Tafadhali jaza Mkoa, Wilaya, na Sababu za Kuomba')
      return
    }
    if (['Form 1', 'Form 5'].includes(form.class_applying) && !form.exam_no) {
      setError('Tafadhali ingiza Namba ya Mtihani (NP) kwa ajili ya darasa ulilochagua')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      const applicationNo = await generateApplicationNo()
      const { error: insertError } = await supabase
        .from('admission_applications')
        .insert({
          application_no: applicationNo,
          ...form,
          date_of_birth: form.date_of_birth || null,
        })
      if (insertError) throw insertError
      setSubmitted(applicationNo)
    } catch (err) {
      console.error('Submission error:', err)
      setError('Imeshindwa kutuma ombi. Tafadhali jaribu tena.')
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="max-w-lg w-full bg-white rounded-2xl shadow-lg p-8 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Ombi Limekamilika!</h2>
          <p className="text-gray-600 mb-4">Namba yako ya ombi ni:</p>
          <div className="text-3xl font-bold text-maroon-700 bg-maroon-50 rounded-xl py-3 px-4 mb-4 tracking-wider">
            {submitted}
          </div>
          <p className="text-sm text-gray-500 mb-6">Hifadhi namba hii ili uweze kufuatilia hali ya ombi lako.</p>
          <div className="flex gap-3 justify-center">
            <Link
              to="/track-application"
              className="px-5 py-2.5 bg-maroon-600 text-white text-sm font-medium rounded-xl hover:bg-maroon-700 transition"
            >
              Fuatilia Ombi
            </Link>
            <Link
              to="/"
              className="px-5 py-2.5 bg-gray-100 text-gray-700 text-sm font-medium rounded-xl hover:bg-gray-200 transition"
            >
              Nenda Nyumbani
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-maroon-700 text-white py-4 px-4">
        <div className="max-w-3xl mx-auto">
          <Link to="/" className="text-white/70 hover:text-white text-sm">&larr; Rudi Nyuma</Link>
          <h1 className="text-xl font-bold mt-1">Ombi la Kujiunga na Shule</h1>
          <p className="text-white/70 text-sm">Karibu! Tafadhali jaza taarifa za mwanafunzi na mzazi</p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 text-sm text-red-700">{error}</div>
        )}

        {/* Returning applicant notice */}
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 mb-6 flex items-center justify-between">
          <p className="text-sm text-emerald-800">Umekwisha tuma ombi? Fuatilia hali yake.</p>
          <Link to="/track-application" className="text-sm font-medium text-emerald-700 hover:text-emerald-800 underline">Fuatilia Ombi &rarr;</Link>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-200 p-6 space-y-5">
          {/* Student Info */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Taarifa za Mwanafunzi</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Jina la Kwanza *</label>
                <input name="first_name" value={form.first_name} onChange={handleChange} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Jina la Kati</label>
                <input name="middle_name" value={form.middle_name} onChange={handleChange} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Jina la Mwisho *</label>
                <input name="surname" value={form.surname} onChange={handleChange} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Jinsia *</label>
                <select name="gender" value={form.gender} onChange={handleChange} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm">
                  <option value="">Chagua...</option>
                  <option value="Male">Kiume</option>
                  <option value="Female">Kike</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tarehe ya Kuzaliwa</label>
                <input type="date" name="date_of_birth" value={form.date_of_birth} onChange={handleChange} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Darasa Analotaka *</label>
                <select name="class_applying" value={form.class_applying} onChange={handleChange} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm">
                  <option value="">Chagua...</option>
                  <optgroup label="O-Level">
                    <option value="Form 1">Form 1</option>
                    <option value="Form 2">Form 2</option>
                    <option value="Form 3">Form 3</option>
                    <option value="Form 4">Form 4</option>
                  </optgroup>
                  <optgroup label="A-Level">
                    <option value="Form 5">Form 5</option>
                    <option value="Form 6">Form 6</option>
                  </optgroup>
                </select>
              </div>
            </div>
            <div className="mt-3">
              <label className="block text-sm font-medium text-gray-700 mb-1">Shule ya Awali</label>
              <input name="previous_school" value={form.previous_school} onChange={handleChange} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" placeholder="Jina la shule aliyotoka..." />
            </div>
          </div>

          <hr className="border-gray-100" />

          {/* Additional Info */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Maelezo ya Ziada</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Namba la Mtihani (NP) {form.class_applying && ['Form 1', 'Form 5'].includes(form.class_applying) ? '*' : ''}
                </label>
                <input name="exam_no" value={form.exam_no} onChange={handleChange} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" placeholder="e.g. NP-123456" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mkoa *</label>
                <input name="region" value={form.region} onChange={handleChange} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" placeholder="Mkoa anaoishi..." />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Wilaya *</label>
                <input name="district" value={form.district} onChange={handleChange} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" placeholder="Wilaya anayoishi..." />
              </div>
            </div>
            <div className="mt-3">
              <label className="block text-sm font-medium text-gray-700 mb-1">Sababu za Kuomba *</label>
              <textarea name="reasons" value={form.reasons} onChange={handleChange} rows={3} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" placeholder="Eleza sababu zinazokufanya utake kujiunga na shule hii..." />
            </div>
            <div className="mt-3">
              <label className="block text-sm font-medium text-gray-700 mb-1">Je, mwanafunzi ana ulemavu wowote?</label>
              <select name="disability" value={form.disability} onChange={handleChange} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm">
                <option value="">Hakuna ulemavu</option>
                <option value="Kusikia (Hearing)">Kusikia (Hearing)</option>
                <option value="Kuona (Vision)">Kuona (Vision)</option>
                <option value="Kiwenndo (Physical)">Kiwenndo (Physical)</option>
                <option value="Akili (Intellectual)">Akili (Intellectual)</option>
                <option value="Nyinginezo">Nyinginezo</option>
              </select>
            </div>
          </div>

          <hr className="border-gray-100" />

          {/* Parent Info */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Taarifa za Mzazi/Mlezi</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Jina la Mzazi/Mlezi *</label>
                <input name="parent_name" value={form.parent_name} onChange={handleChange} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Namba ya Simu *</label>
                <input name="parent_phone" value={form.parent_phone} onChange={handleChange} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" placeholder="+2557XXXXXXXX" />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Barua Pepe</label>
                <input type="email" name="parent_email" value={form.parent_email} onChange={handleChange} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Anuani</label>
                <input name="address" value={form.address} onChange={handleChange} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 bg-maroon-700 text-white text-sm font-semibold rounded-xl hover:bg-maroon-800 disabled:opacity-50 transition"
          >
            {submitting ? 'Inatuma Ombi...' : 'Tuma Ombi'}
          </button>
        </form>
      </div>
    </div>
  )
}
