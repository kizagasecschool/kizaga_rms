import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

export default function JoiningInstructions() {
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.from('joining_instructions').select('*').order('level').then(({ data, error }) => {
      if (!error) setRecords(data || [])
      setLoading(false)
    })
  }, [])

  const levelBadge = (level) => {
    if (level === 'O_LEVEL') return { label: 'O-Level', class: 'bg-blue-100 text-blue-700' }
    return { label: 'A-Level', class: 'bg-purple-100 text-purple-700' }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-maroon-700 text-white py-6 px-4">
        <div className="max-w-4xl mx-auto">
          <Link to="/" className="text-white/70 hover:text-white text-sm">&larr; Rudi Nyumbani</Link>
          <h1 className="text-2xl font-bold mt-1">Maelekezo ya Kujiunga</h1>
          <p className="text-white/70 text-sm mt-1">Pakua maelekezo ya kujiunga kwa O-Level na A-Level</p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-6 h-6 border-3 border-gray-200 border-t-maroon-600 rounded-full animate-spin" />
          </div>
        ) : records.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
            <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <svg className="w-7 h-7 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
            </div>
            <h3 className="text-sm font-semibold text-gray-900">Hakuna maelekezo bado</h3>
            <p className="text-xs text-gray-500 mt-1">Maelekezo ya kujiunga yatakuwepo hapa yakiwa tayari.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {records.map(rec => {
              const badge = levelBadge(rec.level)
              return (
                <div key={rec.id} className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                  <div className="p-6">
                    <div className="flex items-center gap-2 mb-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold uppercase ${badge.class}`}>
                        {badge.label}
                      </span>
                    </div>
                    <h2 className="text-lg font-semibold text-gray-900 mb-2">{rec.title}</h2>
                    {rec.description && (
                      <p className="text-sm text-gray-500 mb-4">{rec.description}</p>
                    )}
                    {rec.pdf_url ? (
                      <a
                        href={rec.pdf_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-5 py-3 bg-maroon-600 text-white text-sm font-semibold rounded-xl hover:bg-maroon-700 transition"
                      >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                        </svg>
                        Fungua PDF
                      </a>
                    ) : (
                      <p className="text-sm text-gray-400 italic">PDF haijapakiwa bado</p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
