/**
 * Fixes partial O-Level teacher_subjects assignments.
 * For every O-Level class, each (teacher_id, subject_id) pair should have a row
 * for ALL streams of that class. This script finds gaps and inserts the missing rows.
 */

const { createClient } = require('@supabase/supabase-js')

const URL  = 'https://dbhaitdxwimhmwpwjogb.supabase.co'
const KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRiaGFpdGR4d2ltaG13cHdqb2diIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTE4NDMxMywiZXhwIjoyMDk2NzYwMzEzfQ.CbxJ2vqjJgoEZBmByJ8faVPOYakvBw3b7gq4NjKZJig'
const sb   = createClient(URL, KEY)

async function fetchAll(table, select = '*', extras = {}) {
  const rows = []
  let page = 0
  while (true) {
    let q = sb.from(table).select(select).range(page * 1000, page * 1000 + 999)
    if (extras.order) q = q.order(extras.order)
    const { data, error } = await q
    if (error) throw new Error(`${table}: ${error.message}`)
    if (!data || data.length === 0) break
    rows.push(...data)
    if (data.length < 1000) break
    page++
  }
  return rows
}

async function main() {
  console.log('Fetching data…')
  const [classes, classStreams, assignments] = await Promise.all([
    fetchAll('classes'),
    fetchAll('class_streams'),
    fetchAll('teacher_subjects'),
  ])

  console.log(`  classes: ${classes.length}  class_streams: ${classStreams.length}  teacher_subjects: ${assignments.length}`)

  // Only care about O-Level classes
  const oLevelClassIds = new Set(classes.filter(c => c.level !== 'A_LEVEL').map(c => c.id))

  // Map class_id → [class_stream_id, ...]
  const classStreamMap = {}
  for (const cs of classStreams) {
    if (!classStreamMap[cs.class_id]) classStreamMap[cs.class_id] = []
    classStreamMap[cs.class_id].push(cs.id)
  }

  // Map class_stream_id → class_id
  const streamToClass = {}
  for (const cs of classStreams) streamToClass[cs.id] = cs.class_id

  // Group existing O-Level assignments by (teacher_id, class_id, subject_id) → Set of class_stream_ids
  const existing = {} // key → Set<class_stream_id>
  for (const a of assignments) {
    const classId = streamToClass[a.class_stream_id]
    if (!classId || !oLevelClassIds.has(classId)) continue
    const key = `${a.teacher_id}|${classId}|${a.subject_id}`
    if (!existing[key]) existing[key] = new Set()
    existing[key].add(a.class_stream_id)
  }

  // Build missing rows
  const toInsert = []
  for (const [key, assignedSet] of Object.entries(existing)) {
    const [teacherId, classId, subjectId] = key.split('|')
    const allStreamIds = classStreamMap[classId] || []
    for (const streamId of allStreamIds) {
      if (!assignedSet.has(streamId)) {
        toInsert.push({ teacher_id: teacherId, class_stream_id: streamId, subject_id: subjectId })
      }
    }
  }

  if (toInsert.length === 0) {
    console.log('✅ No partial assignments found — all O-Level teachers already cover all streams.')
    return
  }

  console.log(`Found ${toInsert.length} missing rows across ${Object.keys(existing).length} teacher/class/subject combos. Inserting…`)

  // Insert in chunks of 500 (PostgREST body limit)
  const CHUNK = 500
  let inserted = 0
  for (let i = 0; i < toInsert.length; i += CHUNK) {
    const chunk = toInsert.slice(i, i + CHUNK)
    const { error } = await sb
      .from('teacher_subjects')
      .upsert(chunk, { onConflict: 'teacher_id,class_stream_id,subject_id' })
    if (error) {
      console.error(`Error inserting chunk ${i}–${i + chunk.length - 1}:`, error.message)
      process.exit(1)
    }
    inserted += chunk.length
    console.log(`  inserted ${inserted}/${toInsert.length}`)
  }

  console.log(`✅ Done. Inserted ${toInsert.length} missing teacher_subjects rows.`)
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1) })
