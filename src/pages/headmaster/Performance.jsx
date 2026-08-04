import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../../lib/supabase'

function calcPassRate(results) {
  if (!results.length) return 0
  const passed = results.filter(r => r.average_marks != null && r.average_marks >= 40).length
  return Math.round((passed / results.length) * 100)
}

function calcAvg(results) {
  const valid = results.filter(r => r.average_marks != null)
  if (!valid.length) return null
  return valid.reduce((s, r) => s + r.average_marks, 0) / valid.length
}

function divCounts(results) {
  const counts = { I: 0, II: 0, III: 0, IV: 0, '0': 0 }
  results.forEach(r => {
    const d = r.division ? String(r.division).replace('Division ', '') : '0'
    if (d in counts) counts[d]++
    else counts['0']++
  })
  return counts
}

function PassBadge({ rate }) {
  const color = rate >= 80 ? 'bg-green-100 text-green-700' : rate >= 60 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'
  return <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${color}`}>{rate}%</span>
}

export default function HeadmasterPerformance() {
  const [activeTab, setActiveTab] = useState('exam')

  const [academicYears, setAcademicYears] = useState([])
  const [exams, setExams] = useState([])
  const [classes, setClasses] = useState([])
  const [students, setStudents] = useState([])
  const [results, setResults] = useState([])

  const [selectedYearId, setSelectedYearId] = useState('')
  const [selectedExamId, setSelectedExamId] = useState('')
  const [expandedClass, setExpandedClass] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadingResults, setLoadingResults] = useState(false)
  const [selectedExam, setSelectedExam] = useState(null)

  // Trends state
  const [trendsYearId, setTrendsYearId] = useState('')
  const [trendData, setTrendData] = useState([])
  const [loadingTrends, setLoadingTrends] = useState(false)

  useEffect(() => {
    const load = async () => {
      const [yRes, eRes, cRes] = await Promise.all([
        supabase.from('academic_years').select('*').order('year_name', { ascending: false }).limit(20),
        supabase.from('exams').select('*').order('created_at', { ascending: false }).limit(500),
        supabase.from('classes').select('*').order('sort_order').limit(50),
      ])
      if (yRes.data) setAcademicYears(yRes.data)
      if (eRes.data) setExams(eRes.data)
      if (cRes.data) setClasses(cRes.data)
      setLoading(false)
    }
    load()
  }, [])

  useEffect(() => {
    setSelectedExam(exams.find(e => e.id === selectedExamId) || null)
  }, [selectedExamId, exams])

  useEffect(() => {
    if (!selectedExamId) { setResults([]); setStudents([]); return }
    const load = async () => {
      setLoadingResults(true)
      setExpandedClass(null)
      const PAGE = 1000
      const fetchPaged = async (buildFn) => {
        let from = 0; const all = []
        while (true) {
          const { data } = await buildFn().range(from, from + PAGE - 1)
          if (!data || !data.length) break
          all.push(...data)
          if (data.length < PAGE) break
          from += PAGE
        }
        return all
      }
      const [rAll, sAll] = await Promise.all([
        fetchPaged(() => supabase.from('student_results').select('*').eq('exam_id', selectedExamId)),
        fetchPaged(() => supabase.from('students').select('id, first_name, middle_name, surname, admission_number, gender, class_id')),
      ])
      setResults(rAll)
      setStudents(sAll)
      setLoadingResults(false)
    }
    load()
  }, [selectedExamId])

  useEffect(() => {
    if (activeTab !== 'trends') return
    const load = async () => {
      setLoadingTrends(true)
      const doneExams = exams.filter(e =>
        ['processed', 'published', 'locked'].includes(e.status) &&
        (!trendsYearId || e.academic_year_id === trendsYearId)
      ).sort((a, b) => new Date(a.start_date || a.created_at) - new Date(b.start_date || b.created_at))

      if (doneExams.length === 0) { setTrendData([]); setLoadingTrends(false); return }

      const examIds = doneExams.map(e => e.id)
      let from = 0; const allRes = []
      while (true) {
        const { data } = await supabase
          .from('student_results')
          .select('exam_id, average_marks, division')
          .in('exam_id', examIds)
          .range(from, from + 999)
        if (!data || !data.length) break
        allRes.push(...data)
        if (data.length < 1000) break
        from += 1000
      }

      const byExam = {}
      allRes.forEach(r => {
        if (!byExam[r.exam_id]) byExam[r.exam_id] = []
        byExam[r.exam_id].push(r)
      })

      const trend = doneExams.map(exam => {
        const res = byExam[exam.id] || []
        return {
          id: exam.id,
          name: exam.name,
          date: exam.start_date || exam.created_at?.slice(0, 10) || '',
          total: res.length,
          avg: calcAvg(res),
          passRate: calcPassRate(res),
          divs: divCounts(res),
        }
      })
      setTrendData(trend)
      setLoadingTrends(false)
    }
    load()
  }, [activeTab, trendsYearId, exams])

  const filteredExams = useMemo(() => {
    const list = selectedYearId ? exams.filter(e => e.academic_year_id === selectedYearId) : exams
    return list.filter(e => ['processed', 'published', 'locked'].includes(e.status))
  }, [exams, selectedYearId])

  const studentMap = useMemo(() => {
    const m = {}
    students.forEach(s => { m[s.id] = s })
    return m
  }, [students])

  const resultMap = useMemo(() => {
    const m = {}
    results.forEach(r => { m[r.student_id] = r })
    return m
  }, [results])

  const classSummaries = useMemo(() => {
    if (!results.length || !students.length) return []
    const byClass = {}
    results.forEach(r => {
      const student = studentMap[r.student_id]
      if (!student) return
      const classId = student.class_id
      if (!classId) return
      if (!byClass[classId]) byClass[classId] = []
      byClass[classId].push({ ...r, student })
    })
    return Object.entries(byClass).map(([classId, classResults]) => {
      const cls = classes.find(c => c.id === classId)
      return {
        classId,
        className: cls?.class_name || 'Unknown Class',
        level: cls?.level || 'O_LEVEL',
        sortOrder: cls?.sort_order ?? 999,
        results: classResults,
        count: classResults.length,
        avg: calcAvg(classResults),
        passRate: calcPassRate(classResults),
        divs: divCounts(classResults),
      }
    }).sort((a, b) => a.sortOrder - b.sortOrder)
  }, [results, students, classes, studentMap])

  const overallStats = useMemo(() => {
    if (!results.length) return null
    return {
      total: results.length,
      passRate: calcPassRate(results),
      avg: calcAvg(results),
      divs: divCounts(results),
    }
  }, [results])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-gray-200 border-t-maroon-600 rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">School Performance</h1>
        <p className="text-gray-500 mt-1">Exam results summary across all classes</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-xl w-fit">
        <button
          onClick={() => setActiveTab('exam')}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition ${activeTab === 'exam' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >Exam Results</button>
        <button
          onClick={() => setActiveTab('trends')}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition ${activeTab === 'trends' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >Trends</button>
      </div>

      {/* ── TRENDS TAB ── */}
      {activeTab === 'trends' && (
        <div>
          <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
            <div className="flex items-center gap-4 flex-wrap">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Academic Year</label>
                <select
                  value={trendsYearId}
                  onChange={e => setTrendsYearId(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-maroon-500"
                >
                  <option value="">All Years</option>
                  {academicYears.map(y => <option key={y.id} value={y.id}>{y.year_name}</option>)}
                </select>
              </div>
            </div>
          </div>

          {loadingTrends ? (
            <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-gray-200 border-t-maroon-600 rounded-full animate-spin" /></div>
          ) : trendData.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-10 text-center">
              <p className="text-sm text-gray-500">No completed exams found for the selected period.</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100">
                <h2 className="text-sm font-semibold text-gray-800">Performance Trend — {trendData.length} Exam{trendData.length !== 1 ? 's' : ''}</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Exam</th>
                      <th className="text-center px-3 py-3 text-xs font-semibold text-gray-500 uppercase">Date</th>
                      <th className="text-center px-3 py-3 text-xs font-semibold text-gray-500 uppercase">Students</th>
                      <th className="text-left px-3 py-3 text-xs font-semibold text-gray-500 uppercase w-40">Average</th>
                      <th className="text-left px-3 py-3 text-xs font-semibold text-gray-500 uppercase w-40">Pass Rate</th>
                      <th className="text-center px-3 py-3 text-xs font-semibold text-gray-500 uppercase">Div I</th>
                      <th className="text-center px-3 py-3 text-xs font-semibold text-gray-500 uppercase">Div II</th>
                      <th className="text-center px-3 py-3 text-xs font-semibold text-gray-500 uppercase">Div III</th>
                      <th className="text-center px-3 py-3 text-xs font-semibold text-gray-500 uppercase">Div 0</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {trendData.map((t, i) => {
                      const prevAvg = i > 0 ? trendData[i - 1].avg : null
                      const trend = t.avg != null && prevAvg != null ? (t.avg > prevAvg ? 'up' : t.avg < prevAvg ? 'down' : 'same') : null
                      return (
                        <tr key={t.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-medium text-gray-900">
                            <div className="flex items-center gap-2">
                              {trend === 'up' && <span className="text-green-500 text-xs">▲</span>}
                              {trend === 'down' && <span className="text-red-500 text-xs">▼</span>}
                              {t.name}
                            </div>
                          </td>
                          <td className="px-3 py-3 text-center text-gray-500 text-xs">{t.date}</td>
                          <td className="px-3 py-3 text-center text-gray-700">{t.total || '—'}</td>
                          <td className="px-3 py-3">
                            {t.avg != null ? (
                              <div className="flex items-center gap-2">
                                <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                  <div className="h-full bg-blue-500 rounded-full" style={{ width: `${Math.min(t.avg, 100)}%` }} />
                                </div>
                                <span className="text-xs text-gray-700 w-10 text-right">{t.avg.toFixed(1)}%</span>
                              </div>
                            ) : <span className="text-gray-300 text-xs">—</span>}
                          </td>
                          <td className="px-3 py-3">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${t.passRate >= 80 ? 'bg-green-500' : t.passRate >= 60 ? 'bg-yellow-400' : 'bg-red-400'}`}
                                  style={{ width: `${t.passRate}%` }}
                                />
                              </div>
                              <span className="text-xs text-gray-700 w-10 text-right">{t.passRate}%</span>
                            </div>
                          </td>
                          {['I', 'II', 'III', '0'].map(d => (
                            <td key={d} className="px-3 py-3 text-center text-gray-600">{t.divs[d] ?? 0}</td>
                          ))}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── EXAM RESULTS TAB ── */}
      {activeTab === 'exam' && (
      <div>
      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-xl">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Academic Year</label>
            <select
              value={selectedYearId}
              onChange={e => { setSelectedYearId(e.target.value); setSelectedExamId('') }}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-maroon-500 focus:border-maroon-500"
            >
              <option value="">All Years</option>
              {academicYears.map(y => <option key={y.id} value={y.id}>{y.year_name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Select Exam</label>
            <select
              value={selectedExamId}
              onChange={e => setSelectedExamId(e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-maroon-500 focus:border-maroon-500"
            >
              <option value="">Select exam...</option>
              {filteredExams.map(e => (
                <option key={e.id} value={e.id}>{e.name} — {e.status}</option>
              ))}
            </select>
            {selectedYearId && filteredExams.length === 0 && (
              <p className="text-xs text-amber-600 mt-1">No completed exams for this year.</p>
            )}
          </div>
        </div>
      </div>

      {loadingResults && (
        <div className="flex items-center justify-center py-12">
          <div className="w-6 h-6 border-2 border-gray-200 border-t-maroon-600 rounded-full animate-spin" />
        </div>
      )}

      {!loadingResults && !selectedExamId && (
        <div className="bg-white rounded-xl border border-gray-200 p-10 text-center">
          <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
          </svg>
          <p className="text-sm text-gray-500">Select an exam to view school performance.</p>
        </div>
      )}

      {!loadingResults && selectedExamId && results.length === 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-10 text-center">
          <p className="text-sm text-gray-500">No results found for this exam.</p>
        </div>
      )}

      {!loadingResults && overallStats && (
        <>
          {/* Overall summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            {[
              { label: 'Total Students', value: overallStats.total, suffix: '' },
              { label: 'Pass Rate', value: overallStats.passRate, suffix: '%' },
              { label: 'School Average', value: overallStats.avg != null ? overallStats.avg.toFixed(1) : '-', suffix: overallStats.avg != null ? '%' : '' },
              { label: 'Classes', value: classSummaries.length, suffix: '' },
            ].map(card => (
              <div key={card.label} className="bg-white rounded-xl border border-gray-200 p-4">
                <p className="text-2xl font-bold text-gray-900">{card.value}{card.suffix}</p>
                <p className="text-xs text-gray-500 mt-1">{card.label}</p>
              </div>
            ))}
          </div>

          {/* Division distribution */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
            <h2 className="text-sm font-semibold text-gray-800 mb-3">Division Distribution — Whole School</h2>
            <div className="flex flex-wrap gap-3">
              {['I', 'II', 'III', 'IV', '0'].map(div => (
                <div key={div} className="flex flex-col items-center bg-gray-50 rounded-lg px-5 py-3 border border-gray-200 min-w-[80px]">
                  <span className="text-lg font-bold text-gray-900">{overallStats.divs[div] ?? 0}</span>
                  <span className="text-xs text-gray-500 mt-0.5">Div {div}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Per-class table */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-800">Results by Class</h2>
              <p className="text-xs text-gray-400 mt-0.5">Click a class to expand the student list</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Class</th>
                    <th className="text-center px-3 py-3 text-xs font-semibold text-gray-500 uppercase">Students</th>
                    <th className="text-center px-3 py-3 text-xs font-semibold text-gray-500 uppercase">Average</th>
                    <th className="text-center px-3 py-3 text-xs font-semibold text-gray-500 uppercase">Pass Rate</th>
                    <th className="text-center px-3 py-3 text-xs font-semibold text-gray-500 uppercase">Div I</th>
                    <th className="text-center px-3 py-3 text-xs font-semibold text-gray-500 uppercase">Div II</th>
                    <th className="text-center px-3 py-3 text-xs font-semibold text-gray-500 uppercase">Div III</th>
                    <th className="text-center px-3 py-3 text-xs font-semibold text-gray-500 uppercase">Div IV</th>
                    <th className="text-center px-3 py-3 text-xs font-semibold text-gray-500 uppercase">Div 0</th>
                    <th className="text-center px-3 py-3 text-xs font-semibold text-gray-500 uppercase"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {classSummaries.map(cls => (
                    <>
                      <tr
                        key={cls.classId}
                        className="hover:bg-gray-50 transition cursor-pointer"
                        onClick={() => setExpandedClass(expandedClass === cls.classId ? null : cls.classId)}
                      >
                        <td className="px-4 py-3 font-medium text-gray-900">{cls.className}</td>
                        <td className="px-3 py-3 text-center text-gray-700">{cls.count}</td>
                        <td className="px-3 py-3 text-center text-gray-700">
                          {cls.avg != null ? `${cls.avg.toFixed(1)}%` : '-'}
                        </td>
                        <td className="px-3 py-3 text-center"><PassBadge rate={cls.passRate} /></td>
                        {['I', 'II', 'III', 'IV', '0'].map(d => (
                          <td key={d} className="px-3 py-3 text-center text-gray-600">{cls.divs[d] ?? 0}</td>
                        ))}
                        <td className="px-3 py-3 text-center">
                          <svg
                            className={`w-4 h-4 text-gray-400 mx-auto transition-transform ${expandedClass === cls.classId ? 'rotate-180' : ''}`}
                            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                          </svg>
                        </td>
                      </tr>
                      {expandedClass === cls.classId && (
                        <tr key={`${cls.classId}-detail`}>
                          <td colSpan={10} className="px-0 py-0 bg-gray-50 border-b border-gray-200">
                            <div className="px-4 py-3">
                              <h3 className="text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">
                                {cls.className} Students — Ranked by Position
                              </h3>
                              <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
                                <table className="w-full text-xs">
                                  <thead>
                                    <tr className="bg-gray-50 border-b border-gray-200">
                                      <th className="text-center px-3 py-2 font-semibold text-gray-500">#</th>
                                      <th className="text-left px-3 py-2 font-semibold text-gray-500">Namba ya Usajili</th>
                                      <th className="text-left px-3 py-2 font-semibold text-gray-500">Jina la Mwanafunzi</th>
                                      <th className="text-center px-3 py-2 font-semibold text-gray-500">Wastani</th>
                                      <th className="text-center px-3 py-2 font-semibold text-gray-500">Daraja</th>
                                      <th className="text-center px-3 py-2 font-semibold text-gray-500">Division</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-gray-100">
                                    {cls.results
                                      .slice()
                                      .sort((a, b) => (a.position ?? 9999) - (b.position ?? 9999))
                                      .map((r, idx) => {
                                        const s = r.student
                                        return (
                                          <tr key={r.id} className="hover:bg-gray-50">
                                            <td className="px-3 py-2 text-center text-gray-500">{r.position ?? idx + 1}</td>
                                            <td className="px-3 py-2 font-mono text-gray-500">{s?.admission_number || '-'}</td>
                                            <td className="px-3 py-2 font-medium text-gray-900">
                                              {s ? `${s.first_name} ${s.middle_name || ''} ${s.surname}`.replace(/\s+/g, ' ').trim() : '-'}
                                            </td>
                                            <td className="px-3 py-2 text-center text-gray-700">
                                              {r.average_marks != null ? `${Number(r.average_marks).toFixed(1)}%` : '-'}
                                            </td>
                                            <td className="px-3 py-2 text-center font-semibold text-gray-800">{r.grade || '-'}</td>
                                            <td className="px-3 py-2 text-center text-gray-700">
                                              {r.division ? String(r.division).replace('Division ', '') : '-'}
                                            </td>
                                          </tr>
                                        )
                                      })}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
      </div>
      )}
    </div>
  )
}
