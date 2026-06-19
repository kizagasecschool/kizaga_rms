import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Link } from 'react-router-dom'

export default function TrackApplication() {
  const [appNo, setAppNo] = useState('')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

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

  const handleSearch = async (e) => {
    e.preventDefault()
    if (!appNo.trim()) return
    setLoading(true)
    setError('')
    setData(null)
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
          </div>
        )}
      </div>
    </div>
  )
}
