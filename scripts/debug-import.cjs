const { createClient } = require('@supabase/supabase-js');
const XLSX = require('xlsx');
const supabase = createClient(
  'https://dbhaitdxwimhmwpwjogb.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRiaGFpdGR4d2ltaG13cHdqb2diIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTE4NDMxMywiZXhwIjoyMDk2NzYwMzEzfQ.CbxJ2vqjJgoEZBmByJ8faVPOYakvBw3b7gq4NjKZJig'
);

async function main() {
  const EXAM_ID = 'e62024e2-e5f3-4214-a921-5b2667be5335';
  const FORM2_CLASS_ID = 'ce863d72-f6a0-4674-b405-00924604caf5';

  // Get DB students
  const { data: students } = await supabase
    .from('students')
    .select('id, surname, first_name, middle_name, admission_number')
    .eq('class_id', FORM2_CLASS_ID)
    .eq('status', 'active')
    .order('admission_number');

  const lookup = {};
  for (const s of students) {
    const key = [s.first_name, s.middle_name, s.surname].map(v => (v || '').toUpperCase()).join('|');
    // Check for duplicate keys
    if (lookup[key]) console.log('DUPLICATE KEY:', key, lookup[key].admission_number, s.admission_number);
    lookup[key] = s;
  }
  console.log('Unique lookup keys:', Object.keys(lookup).length);

  // Read Excel
  const wb = XLSX.readFile('C:\\Users\\Administrator\\Videos\\kizaga_rms\\F2.xlsx');
  const ws = wb.Sheets['Table 1'];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });

  // Build Excel names
  const excelNames = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || !row[1]) continue;
    const firstName = String(row[2] || '').trim().toUpperCase();
    const middleName = String(row[3] || '').trim().toUpperCase();
    const surname = String(row[4] || '').trim().toUpperCase();
    const key = [firstName, middleName, surname].join('|');
    const student = lookup[key];
    excelNames.push({
      row: i,
      excelName: String(row[1]).trim(),
      key,
      matched: !!student,
      studentId: student ? student.id : null,
      studentAdm: student ? student.admission_number : null,
      division: row[23],
    });
  }

  // Get marks from DB
  const { data: marks } = await supabase
    .from('marks')
    .select('student_id')
    .eq('exam_id', EXAM_ID);
  const markedIds = new Set(marks.map(m => m.student_id));

  console.log('\nExpected to have marks but MISSING in DB:');
  let countMissing = 0;
  for (const e of excelNames) {
    if (e.division && e.division !== '-' && e.matched && !markedIds.has(e.studentId)) {
      countMissing++;
      if (countMissing <= 10) console.log(`  ${e.excelName} (adm: ${e.studentAdm}) - division: ${e.division}`);
    }
  }
  console.log(`Total missing: ${countMissing}`);

  // Check for duplicate student IDs in marks
  const idCounts = {};
  marks.forEach(m => {
    idCounts[m.student_id] = (idCounts[m.student_id] || 0) + 1;
  });
  console.log('\nStudents with unusual subject counts:');
  let normalCount = 0;
  for (const [sid, cnt] of Object.entries(idCounts)) {
    if (cnt > 10 || cnt < 5) {
      const s = students.find(st => st.id === sid);
      console.log(`  ${s ? s.surname + ' ' + s.first_name : sid}: ${cnt} subjects`);
    } else {
      normalCount++;
    }
  }
  console.log(`Students with 5-10 subjects: ${normalCount}`);
  console.log(`Total students with marks: ${Object.keys(idCounts).length}`);
}

main().catch(console.error);
