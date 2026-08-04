const { createClient } = require('@supabase/supabase-js');
const XLSX = require('xlsx');
const crypto = require('crypto');

const supabase = createClient(
  'https://dbhaitdxwimhmwpwjogb.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRiaGFpdGR4d2ltaG13cHdqb2diIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTE4NDMxMywiZXhwIjoyMDk2NzYwMzEzfQ.CbxJ2vqjJgoEZBmByJ8faVPOYakvBw3b7gq4NjKZJig'
);

const EXAM_ID = 'e62024e2-e5f3-4214-a921-5b2667be5335';
const ENTERED_BY = '05463236-cb9c-4d7e-acf6-6d7264638d14';
const FORM2_CLASS_ID = 'ce863d72-f6a0-4674-b405-00924604caf5';

const SUBJECT_COLUMNS = {
  6:  'dcc05791-4ef5-4116-bd59-793a862cd0f7',
  8:  '977281b3-33d7-4aca-a85f-1a0c0c4ed93e',
  10: 'a884d74b-23bf-49e1-bb21-c14f96a0892a',
  12: 'b5ac111a-bb22-4afb-acd0-7387e01b0987',
  14: '31441abe-6d1e-461e-9ced-063ad56613da',
  16: 'ac06b686-db4d-43ce-b960-6eece99adfee',
  17: 'b36be84d-6c25-4132-b0c1-12bab74a4b09',
  18: '9d010bd8-bbd9-43de-a153-e481e7b43856',
  19: '7f99e956-2e86-4941-a0b5-f2bc7f18f0f2',
  21: '80db5cf9-6db9-4c20-84c5-741c005dffb8',
};

async function main() {
  // 1. Delete ALL existing marks for this exam (fresh start)
  console.log('Deleting existing marks for Terminal 2026...');
  const { error: delErr } = await supabase
    .from('marks')
    .delete()
    .eq('exam_id', EXAM_ID);
  if (delErr) { console.error('Delete error:', delErr); return; }
  console.log('Deleted existing marks.');

  // 2. Read Excel
  console.log('Reading Excel...');
  const wb = XLSX.readFile('C:\\Users\\Administrator\\Videos\\kizaga_rms\\F2.xlsx');
  const ws = wb.Sheets['Table 1'];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });
  console.log(`Excel rows: ${rows.length - 1}`);

  // 3. Get students
  console.log('Fetching students...');
  const { data: students, error: stuErr } = await supabase
    .from('students')
    .select('id, first_name, middle_name, surname')
    .eq('class_id', FORM2_CLASS_ID)
    .eq('status', 'active');
  if (stuErr) { console.error('Error:', stuErr); return; }
  console.log(`DB students: ${students.length}`);

  const lookup = {};
  for (const s of students) {
    const key = [s.first_name, s.middle_name, s.surname].map(v => (v || '').toUpperCase()).join('|');
    lookup[key] = s;
  }

  // 4. Build all marks
  const allMarks = [];
  let matched = 0, unmatched = 0, noMarks = 0;

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || !row[1]) continue;

    const firstName = String(row[2] || '').trim().toUpperCase();
    const middleName = String(row[3] || '').trim().toUpperCase();
    const surname = String(row[4] || '').trim().toUpperCase();
    const key = [firstName, middleName, surname].join('|');
    const student = lookup[key];

    if (!student) {
      console.log(`UNMATCHED: ${row[1]}`);
      unmatched++;
      continue;
    }
    matched++;

    if (!row[23] || row[23] === '-') { noMarks++; continue; }

    for (const [colIdx, subjectId] of Object.entries(SUBJECT_COLUMNS)) {
      const markValue = row[parseInt(colIdx)];
      if (markValue === undefined || markValue === null || markValue === '') continue;
      allMarks.push({
        student_id: student.id,
        subject_id: subjectId,
        exam_id: EXAM_ID,
        marks_obtained: Math.min(Math.max(parseFloat(markValue), 0), 100),
        is_absent: false,
        entered_by: ENTERED_BY,
        id: crypto.randomUUID(),
      });
    }
  }

  console.log(`Matched: ${matched}, Unmatched: ${unmatched}, No marks: ${noMarks}`);
  console.log(`Total marks: ${allMarks.length}`);

  if (allMarks.length === 0) return;

  // 5. Insert in small chunks with validation
  const CHUNK = 100;
  let inserted = 0;

  for (let i = 0; i < allMarks.length; i += CHUNK) {
    const chunk = allMarks.slice(i, i + CHUNK);
    const { data, error } = await supabase
      .from('marks')
      .upsert(chunk, { onConflict: ['student_id', 'subject_id', 'exam_id'], defaultToNull: false })
      .select('id');
    
    if (error) {
      console.error(`ERROR at chunk ${i/CHUNK} (${chunk.length} records):`, error.message, error.details, error.hint);
    } else {
      inserted += (data || []).length;
      console.log(`Chunk ${i/CHUNK + 1}: upserted ${(data || []).length}/${chunk.length} marks (total: ${inserted}/${allMarks.length})`);
    }
  }

  // 6. Final verification
  const { count } = await supabase
    .from('marks')
    .select('*', { count: 'exact', head: true })
    .eq('exam_id', EXAM_ID);
  console.log(`\nFinal marks in DB: ${count}`);

  const { data: finalMarks } = await supabase
    .from('marks')
    .select('student_id')
    .eq('exam_id', EXAM_ID);
  const uniqueStudents = new Set(finalMarks.map(m => m.student_id));
  console.log(`Students with marks: ${uniqueStudents.size}`);
}

main().catch(console.error);
