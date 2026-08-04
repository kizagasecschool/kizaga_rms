const { createClient } = require('@supabase/supabase-js');
const XLSX = require('xlsx');
const supabase = createClient(
  'https://dbhaitdxwimhmwpwjogb.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRiaGFpdGR4d2ltaG13cHdqb2diIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTE4NDMxMywiZXhwIjoyMDk2NzYwMzEzfQ.CbxJ2vqjJgoEZBmByJ8faVPOYakvBw3b7gq4NjKZJig'
);

async function main() {
  const examId = 'e62024e2-e5f3-4214-a921-5b2667be5335';

  // Count marks per student
  const { data: marks } = await supabase
    .from('marks')
    .select('student_id, marks_obtained')
    .eq('exam_id', examId);

  const perStudent = {};
  marks.forEach(m => {
    if (!perStudent[m.student_id]) perStudent[m.student_id] = [];
    perStudent[m.student_id].push(m.marks_obtained);
  });

  console.log('Students with marks:', Object.keys(perStudent).length);

  // Show subject count per student
  let totalSubjects = 0;
  let totalStudents = 0;
  for (const [sid, subs] of Object.entries(perStudent)) {
    totalSubjects += subs.length;
    totalStudents++;
    if (subs.length < 5) {
      const { data: s } = await supabase.from('students').select('surname,first_name').eq('id', sid).single();
      console.log(`FEW_SUBJECTS (${subs.length}): ${s.surname} ${s.first_name}`);
    }
  }
  console.log(`Total subjects: ${totalSubjects}, Students: ${totalStudents}`);

  // Read Excel and check which students should have marks but don't
  const wb = XLSX.readFile('C:\\Users\\Administrator\\Videos\\kizaga_rms\\F2.xlsx');
  const ws = wb.Sheets['Table 1'];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });

  const { data: students } = await supabase
    .from('students')
    .select('id, surname, first_name, middle_name')
    .eq('class_id', 'ce863d72-f6a0-4674-b405-00924604caf5')
    .eq('status', 'active');

  const lookup = {};
  for (const s of students) {
    const key = [s.first_name, s.middle_name, s.surname].map(v => (v || '').toUpperCase()).join('|');
    lookup[key] = s;
  }

  const markedSet = new Set(Object.keys(perStudent));
  let excelWithMarks = 0;
  let missingInDB = 0;

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || !row[1]) continue;

    const firstName = String(row[2] || '').trim().toUpperCase();
    const middleName = String(row[3] || '').trim().toUpperCase();
    const surname = String(row[4] || '').trim().toUpperCase();
    const key = [firstName, middleName, surname].join('|');
    const student = lookup[key];
    const division = row[23];

    if (!student) continue;
    if (!division || division === '-') continue;

    excelWithMarks++;
    if (!markedSet.has(student.id)) {
      missingInDB++;
      console.log(`MISSING: ${row[1]} (division: ${division})`);
    }
  }

  console.log(`\nExcel students with marks: ${excelWithMarks}`);
  console.log(`Missing in DB: ${missingInDB}`);
}
main().catch(console.error);
