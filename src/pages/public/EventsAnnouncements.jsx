import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

export default function EventsAnnouncements() {
  const [events, setEvents] = useState([])
  const [announcements, setAnnouncements] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('EVENTS')
  const [expandedId, setExpandedId] = useState(null)
  const [schoolInfo, setSchoolInfo] = useState(null)

  const loadItems = async () => {
    const { data, error } = await supabase
      .from('events_announcements')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false })
    if (error) {
      console.error('Load error:', error)
    } else {
      const rows = data || []
      setEvents(rows.filter(r => r.type === 'EVENT'))
      setAnnouncements(rows.filter(r => r.type === 'ANNOUNCEMENT'))
    }
    setLoading(false)
  }

  useEffect(() => {
    loadItems()
    supabase.from('school_settings').select('school_name').limit(1).then(({ data }) => {
      if (data?.[0]) setSchoolInfo(data[0])
    })
  }, [])

  const formatDate = (d) => {
    return new Date(d).toLocaleDateString('sw-TZ', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
  }

  const isPastEvent = (date) => {
    return new Date(date) < new Date(new Date().toDateString())
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-maroon-700 text-white py-6 px-4">
        <div className="max-w-4xl mx-auto">
          <Link to="/" className="text-white/70 hover:text-white text-sm">&larr; Rudi Nyumbani</Link>
          <h1 className="text-2xl font-bold mt-1">Matukio na Matangazo</h1>
          <p className="text-white/70 text-sm mt-1">Taarifa mpya kutoka {schoolInfo?.school_name || 'shule yetu'}</p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Tabs */}
        <div className="bg-white rounded-2xl border border-gray-200 p-1.5 flex gap-1 mb-6">
          {[
            { key: 'EVENTS', label: 'Matukio', icon: 'M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5' },
            { key: 'ANNOUNCEMENTS', label: 'Matangazo', icon: 'M10.34 15.84c-.688-.06-1.386-.09-2.09-.09H7.5a4.5 4.5 0 110-9h.75c.704 0 1.402-.03 2.09-.09m0 9.18c.253.962.584 1.892.985 2.783.247.55.06 1.21-.463 1.511l-.657.38a.496.496 0 01-.708-.298 12.006 12.006 0 00-.877-1.852m0-3.18a23.96 23.96 0 010-3.18m0 3.18c.255-1.253.378-2.537.378-3.82 0-1.282-.123-2.568-.378-3.82m0 0c.688.06 1.386.09 2.09.09H16.5a4.5 4.5 0 010 9h-.75c-.704 0-1.402.03-2.09.09m0 0c-.253.962-.584 1.892-.985 2.783-.247.55-.06 1.21.463 1.511l.657.38c.38.219.852-.05.852-.486 0-1.038.078-2.059.23-3.055' },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center justify-center gap-2 flex-1 py-3 text-sm font-semibold rounded-xl transition ${
                activeTab === tab.key
                  ? 'bg-maroon-700 text-white shadow-sm'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d={tab.icon} />
              </svg>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-4 border-maroon-600 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {/* Events */}
        {!loading && activeTab === 'EVENTS' && (
          <>
            {events.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-1">Hakuna Matukio</h3>
                <p className="text-sm text-gray-500">Hakuna matukio yaliyopangwa kwa sasa. Tafadhali rudi tena baadaye.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {events.map(item => {
                  const past = isPastEvent(item.event_date)
                  return (
                    <div key={item.id} className={`bg-white rounded-2xl border overflow-hidden ${past ? 'border-gray-200 opacity-75' : 'border-gray-200'}`}>
                      {/* Image */}
                      {item.file_url && item.file_type === 'image' && (
                        <img src={item.file_url} alt={item.title} className="w-full h-48 sm:h-64 object-cover" />
                      )}
                      <div className="p-5">
                        <div className="flex items-center gap-2 mb-2">
                          {past && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-gray-200 text-gray-600 uppercase">Imepita</span>
                          )}
                          {item.event_date && (
                            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium ${
                              past ? 'bg-gray-100 text-gray-500' : 'bg-orange-100 text-orange-700'
                            }`}>
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                              </svg>
                              {formatDate(item.event_date)}
                            </span>
                          )}
                        </div>
                        <h2 className="text-lg font-bold text-gray-900">{item.title}</h2>
                        {item.description && (
                          <div className="mt-2">
                            <p className={`text-sm text-gray-600 ${expandedId === item.id ? '' : 'line-clamp-3'}`}>{item.description}</p>
                            {item.description.length > 200 && (
                              <button onClick={() => setExpandedId(expandedId === item.id ? null : item.id)} className="text-xs font-medium text-maroon-600 hover:underline mt-1">
                                {expandedId === item.id ? 'Ficha' : 'Soma zaidi'}
                              </button>
                            )}
                          </div>
                        )}
                        {/* PDF */}
                        {item.file_url && item.file_type === 'pdf' && (
                          <a
                            href={item.file_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 mt-3 px-3 py-2 bg-maroon-50 text-maroon-700 text-sm font-medium rounded-lg hover:bg-maroon-100 transition"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                            </svg>
                            Fungua PDF
                          </a>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}

        {/* Announcements */}
        {!loading && activeTab === 'ANNOUNCEMENTS' && (
          <>
            {announcements.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10.34 15.84c-.688-.06-1.386-.09-2.09-.09H7.5a4.5 4.5 0 110-9h.75c.704 0 1.402-.03 2.09-.09m0 9.18c.253.962.584 1.892.985 2.783.247.55.06 1.21-.463 1.511l-.657.38a.496.496 0 01-.708-.298 12.006 12.006 0 00-.877-1.852m0-3.18a23.96 23.96 0 010-3.18m0 3.18c.255-1.253.378-2.537.378-3.82 0-1.282-.123-2.568-.378-3.82m0 0c.688.06 1.386.09 2.09.09H16.5a4.5 4.5 0 010 9h-.75c-.704 0-1.402.03-2.09.09m0 0c-.253.962-.584 1.892-.985 2.783-.247.55-.06 1.21.463 1.511l.657.38c.38.219.852-.05.852-.486 0-1.038.078-2.059.23-3.055" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-1">Hakuna Matangazo</h3>
                <p className="text-sm text-gray-500">Hakuna matangazo kwa sasa. Tafadhali rudi tena baadaye.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {announcements.map(item => (
                  <div key={item.id} className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                    {item.file_url && item.file_type === 'image' && (
                      <img src={item.file_url} alt={item.title} className="w-full h-48 sm:h-64 object-cover" />
                    )}
                    <div className="p-5">
                      <h2 className="text-lg font-bold text-gray-900">{item.title}</h2>
                      {item.description && (
                        <div className="mt-2">
                          <p className={`text-sm text-gray-600 ${expandedId === item.id ? '' : 'line-clamp-3'}`}>{item.description}</p>
                          {item.description.length > 200 && (
                            <button onClick={() => setExpandedId(expandedId === item.id ? null : item.id)} className="text-xs font-medium text-maroon-600 hover:underline mt-1">
                              {expandedId === item.id ? 'Ficha' : 'Soma zaidi'}
                            </button>
                          )}
                        </div>
                      )}
                      {item.file_url && item.file_type === 'pdf' && (
                        <a
                          href={item.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 mt-3 px-3 py-2 bg-blue-50 text-blue-700 text-sm font-medium rounded-lg hover:bg-blue-100 transition"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                          </svg>
                          Fungua PDF
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
