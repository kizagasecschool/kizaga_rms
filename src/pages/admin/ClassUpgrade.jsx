import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

function ClassUpgrade() {
  const [classes, setClasses] = useState([])
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    loadStats()
  }, [])

  async function loadStats() {
    setLoading(true)
    setError('')
    try {
      const { data: classList, error: clsErr } = await supabase
        .from('classes')
        .select('id, class_name, level, sort_order')
        .order('sort_order', { ascending: true })

      if (clsErr) throw clsErr

      const withCounts = await Promise.all(
        classList.map(async (c) => {
          const { count, error: cntErr } = await supabase
            .from('students')
            .select('*', { count: 'exact', head: true })
            .eq('class_id', c.id)
            .eq('status', 'active')
          if (cntErr) throw cntErr
          return { ...c, student_count: count }
        })
      )

      setClasses(withCounts)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  function getNextClass(currentIndex) {
    const next = classes[currentIndex + 1]
    if (!next) return null
    if (next.level !== classes[currentIndex].level) return null
    return next
  }

  function getAction(currentIndex) {
    const current = classes[currentIndex]
    const next = getNextClass(currentIndex)
    if (next) {
      return { label: `${current.class_name} → ${next.class_name}`, type: 'promote' }
    }
    return { label: `${current.class_name} → Graduated`, type: 'graduate' }
  }

  const handleUpgrade = async () => {
    setRunning(true)
    setError('')
    setResult(null)
    try {
      const res = await fetch('/api/upgrade-students', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Upgrade failed')
      setResult(data.results)
      await loadStats()
    } catch (err) {
      setError(err.message)
    } finally {
      setRunning(false)
      setConfirm(false)
    }
  }

  const totalStudents = classes.reduce((sum, c) => sum + (c.student_count || 0), 0)

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Class Upgrade</h1>
        <p className="text-gray-500 mt-1">Promote students to the next class or graduate them.</p>
      </div>

      {error && (
        <div className="mb-4 flex items-center gap-2.5 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
          <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
          </svg>
          <span>{error}</span>
        </div>
      )}

      {result && (
        <div className="mb-6 bg-green-50 border border-green-200 rounded-xl p-4">
          <div className="flex items-center gap-2 text-green-700 font-semibold text-sm mb-3">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Upgrade Completed Successfully
          </div>
          <div className="space-y-1.5">
            {result.map((r, i) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                <span className="text-gray-700 font-medium">{r.from}</span>
                <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                </svg>
                <span className="text-gray-700 font-medium">{r.to}</span>
                <span className="text-gray-500 ml-1">({r.count} students)</span>
                <span className={`ml-auto text-xs font-medium px-2 py-0.5 rounded ${r.status === 'promoted' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                  {r.status === 'promoted' ? 'Promoted' : 'Graduated'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <div className="w-8 h-8 border-4 border-gray-200 border-t-maroon-600 rounded-full animate-spin mx-auto" />
          </div>
        ) : (
          <div>
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <p className="text-sm font-semibold text-gray-900">
                Current Enrollment <span className="text-gray-500 font-normal">({totalStudents} active students)</span>
              </p>
            </div>
            <div className="divide-y divide-gray-100">
              {classes.map((c, i) => {
                const action = getAction(i)
                return (
                  <div key={c.id} className="px-5 py-3.5 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <span className="text-sm font-medium text-gray-900 w-24">{c.class_name}</span>
                      <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">{c.level.replace('_', ' ')}</span>
                      <span className="text-sm text-gray-600">{c.student_count || 0} students</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500">{action.label}</span>
                      {action.type === 'promote' ? (
                        <svg className="w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      <div className="mt-6">
        {!confirm ? (
          <button
            onClick={() => setConfirm(true)}
            disabled={running || totalStudents === 0}
            className="px-6 py-3 bg-maroon-600 hover:bg-maroon-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl text-sm transition flex items-center gap-2"
          >
            {running ? (
              <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Upgrading...</>
            ) : 'Start Class Upgrade'}
          </button>
        ) : (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 max-w-lg">
            <div className="flex items-start gap-3">
              <svg className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
              <div>
                <p className="text-sm font-semibold text-amber-800 mb-1">Confirm Class Upgrade</p>
                <p className="text-xs text-amber-700 mb-3">
                  This will promote <strong>{totalStudents}</strong> active students to the next class.
                  Students in Form 4 and Form 6 will be marked as <strong>Graduated</strong>.
                  This action cannot be undone.
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleUpgrade}
                    disabled={running}
                    className="px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-semibold rounded-lg text-xs transition"
                  >
                    {running ? 'Processing...' : 'Confirm Upgrade'}
                  </button>
                  <button
                    onClick={() => setConfirm(false)}
                    disabled={running}
                    className="px-4 py-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 font-semibold rounded-lg text-xs transition"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default ClassUpgrade
