import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

function StudentsByClassTable({ classStreamIds } = {}) {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      const { data: classes } = await supabase
        .from('classes')
        .select('id, class_name')
        .order('sort_order')

      if (!classes?.length) { setLoading(false); return }

      const { data: streams } = await supabase
        .from('class_streams')
        .select('id, class_id')

      const classMap = {}
      classes.forEach((c) => { classMap[c.id] = { id: c.id, name: c.class_name, male: 0, female: 0, total: 0 } })

      // Build streamId → classId lookup
      const streamToClass = {}
      streams?.forEach((cs) => { streamToClass[cs.id] = cs.class_id })

      let query = supabase.from('students').select('class_stream_id, class_id, gender')
      if (classStreamIds?.length > 0) {
        query = query.in('class_stream_id', classStreamIds)
      }
      const { data: students } = await query

      students?.forEach((s) => {
        let cid = null
        if (s.class_stream_id && streamToClass[s.class_stream_id]) {
          cid = streamToClass[s.class_stream_id]
        } else if (s.class_id) {
          cid = s.class_id
        }
        if (!cid || !classMap[cid]) return
        classMap[cid].total++
        if (s.gender === 'Female') classMap[cid].female++
        else classMap[cid].male++
      })

      const rows = classes.map((c) => classMap[c.id]).filter((r) => r.total > 0)

      setData(rows)
      setLoading(false)
    }
    fetchData()
  }, [classStreamIds])

  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-8 bg-gray-100 rounded animate-pulse" />
        ))}
      </div>
    )
  }

  if (!data.length) {
    return <p className="text-sm text-gray-500">Hakuna wanafunzi.</p>
  }

  const grandTotal = data.reduce(
    (a, r) => ({ male: a.male + r.male, female: a.female + r.female, total: a.total + r.total }),
    { male: 0, female: 0, total: 0 },
  )

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="bg-maroon-600">
          <th className="px-4 py-2.5 text-left text-xs font-semibold text-white uppercase tracking-wider">Darasa</th>
          <th className="px-4 py-2.5 text-center text-xs font-semibold text-white uppercase tracking-wider">Wavulana</th>
          <th className="px-4 py-2.5 text-center text-xs font-semibold text-white uppercase tracking-wider">Wasichana</th>
          <th className="px-4 py-2.5 text-center text-xs font-semibold text-white uppercase tracking-wider">Jumla</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-200">
        {data.map((row, i) => (
          <tr key={row.id} className={`${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'}`}>
            <td className="px-4 py-2 font-medium text-gray-900">{row.name}</td>
            <td className="px-4 py-2 text-center text-gray-700">{row.male}</td>
            <td className="px-4 py-2 text-center text-gray-700">{row.female}</td>
            <td className="px-4 py-2 text-center font-semibold text-gray-900">{row.total}</td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr className="bg-maroon-50 font-semibold border-t-2 border-maroon-300">
          <td className="px-4 py-2.5 text-xs text-gray-800 uppercase tracking-wide">Jumla Kuu</td>
          <td className="px-4 py-2.5 text-center text-gray-900">{grandTotal.male}</td>
          <td className="px-4 py-2.5 text-center text-gray-900">{grandTotal.female}</td>
          <td className="px-4 py-2.5 text-center font-bold text-maroon-700">{grandTotal.total}</td>
        </tr>
      </tfoot>
    </table>
  )
}

export default StudentsByClassTable
