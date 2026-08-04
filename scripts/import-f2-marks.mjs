import XLSX from 'xlsx'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://dbhaitdxwimhmwpwjogb.supabase.co'
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRiaGFpdGR4d2ltaG13cHdqb2diIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTE4NDMxMywiZXhwIjoyMDk2NzYwMzEzfQ.CbxJ2vqjJgoEZBmByJ8faVPOYakvBw3b7gq4NjKZJig'

const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

const EXAM_ID = '2c66818a-8acd-4ea2-8c00-23c37003a1af'   // Terminal
const CLASS_ID = 'ce863d72-f6a0-4674-b405-00924604caf5'  // Form 2
const ENTERED_BY = '3a41fee2-40c7-4fc1-bc25-1a541cff10e2'

// DB subject IDs (O-Level)
const SUBJECT_IDS = {
  CHEM: 'dcc05791-4ef5-4116-bd59-793a862cd0f7',
  BIOL: '977281b3-33d7-4aca-a85f-1a0c0c4ed93e',
  PHYS: 'a884d74b-23bf-49e1-bb21-c14f96a0892a',
  MATH: 'b5ac111a-bb22-4afb-acd0-7387e01b0987',
  HIST: '31441abe-6d1e-461e-9ced-063ad56613da',
  GEOG: 'ac06b686-db4d-43ce-b960-6eece99adfee',
  HTMA: 'b36be84d-6c25-4132-b0c1-12bab74a4b09', // Historia ya Tanzania na maadili
  ENGL: '9d010bd8-bbd9-43de-a153-e481e7b43856',
  KISW: '7f99e956-2e86-4941-a0b5-f2bc7f18f0f2',
  BUSS: '80db5cf9-6db9-4c20-84c5-741c005dffb8',
}

// Excel column indices for each subject score
const SUBJECT_COLS = {
  CHEM: 6,
  BIOL: 8,
  PHYS: 10,
  MATH: 12,
  HIST: 14,
  GEOG: 16,
  HTMA: 17,
  ENGL: 18,
  KISW: 19,
  BUSS: 21,
}

function norm(s) {
  return String(s || '').trim().toUpperCase()
}

async function main() {
  // 1. Read Excel
  const wb = XLSX.readFile('F2.xlsx')
  const ws = wb.Sheets['Table 1']
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })
  const dataRows = rows.slice(1).filter(r => r[0] !== '' && r[1] !== '')

  console.log(`Excel rows: ${dataRows.length}`)

  // 2. Fetch all F2 students from DB
  const { data: dbStudents, error: sErr } = await supabase
    .from('students')
    .select('id, first_name, middle_name, surname')
    .eq('class_id', CLASS_ID)
    .eq('status', 'active')
  if (sErr) { console.error('Fetch students failed:', sErr); process.exit(1) }
  console.log(`DB students: ${dbStudents.length}`)

  // Build lookup maps
  // Key: FIRSTNAME|MIDDLENAME|SURNAME (exact)
  // Fallback key: FIRSTNAME|SURNAME
  const exactMap = new Map()
  const fuzzyMap = new Map()
  for (const s of dbStudents) {
    const exact = `${norm(s.first_name)}|${norm(s.middle_name)}|${norm(s.surname)}`
    const fuzzy = `${norm(s.first_name)}|${norm(s.surname)}`
    exactMap.set(exact, s)
    if (!fuzzyMap.has(fuzzy)) fuzzyMap.set(fuzzy, [])
    fuzzyMap.get(fuzzy).push(s)
  }

  // 3. Match and build marks
  const marksToInsert = []
  const unmatched = []
  const noScores = []

  for (const row of dataRows) {
    const excelFirst  = norm(row[2])
    const excelMiddle = norm(row[3])
    const excelLast   = norm(row[4])

    if (!excelFirst && !excelLast) continue

    // Exact match first
    const exactKey = `${excelFirst}|${excelMiddle}|${excelLast}`
    let student = exactMap.get(exactKey)

    // Fuzzy: first + surname
    if (!student) {
      const fuzzyKey = `${excelFirst}|${excelLast}`
      const matches = fuzzyMap.get(fuzzyKey) || []
      if (matches.length === 1) student = matches[0]
    }

    if (!student) {
      unmatched.push(`${excelFirst} ${excelMiddle} ${excelLast}`)
      continue
    }

    // Check if this student has any score
    const scores = Object.entries(SUBJECT_COLS).map(([subj, col]) => ({
      subj, score: row[col]
    }))
    const hasAnyScore = scores.some(s => s.score !== '' && s.score !== null && !isNaN(Number(s.score)))

    if (!hasAnyScore) {
      noScores.push(`${excelFirst} ${excelMiddle} ${excelLast}`)
      continue
    }

    // Build mark rows for subjects that have a score
    for (const { subj, score } of scores) {
      if (score === '' || score === null || isNaN(Number(score))) continue
      marksToInsert.push({
        student_id:      student.id,
        exam_id:         EXAM_ID,
        subject_id:      SUBJECT_IDS[subj],
        marks_obtained:  Number(score),
        practical_marks: 0,
        is_absent:       false,
        entered_by:      ENTERED_BY,
      })
    }
  }

  console.log(`\nMatched students with scores: ${new Set(marksToInsert.map(m => m.student_id)).size}`)
  console.log(`Total mark rows to insert: ${marksToInsert.length}`)
  console.log(`Students with no scores (skipped): ${noScores.length}`)
  console.log(`Unmatched names (${unmatched.length}):`)
  unmatched.forEach(n => console.log('  -', n))

  if (marksToInsert.length === 0) {
    console.log('Nothing to insert.')
    return
  }

  // 4. Upsert marks in batches of 200
  const BATCH = 200
  let inserted = 0
  for (let i = 0; i < marksToInsert.length; i += BATCH) {
    const batch = marksToInsert.slice(i, i + BATCH)
    const { error } = await supabase
      .from('marks')
      .upsert(batch, { onConflict: 'student_id,exam_id,subject_id' })
    if (error) {
      console.error(`Batch ${i}-${i + BATCH} failed:`, error.message)
      process.exit(1)
    }
    inserted += batch.length
    console.log(`Inserted ${inserted}/${marksToInsert.length}...`)
  }

  console.log('\nAll marks inserted. Processing exam results...')

  // 5. Process the exam (recompute grades/divisions/rankings)
  const { error: procErr } = await supabase.rpc('process_exam', { p_exam_id: EXAM_ID })
  if (procErr) {
    console.error('process_exam failed:', procErr.message)
  } else {
    console.log('process_exam completed successfully.')
  }
}

main().catch(err => { console.error(err); process.exit(1) })
