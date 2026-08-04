const { createClient } = require('@supabase/supabase-js');
const XLSX = require('xlsx');
const supabase = createClient(
  'https://dbhaitdxwimhmwpwjogb.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRiaGFpdGR4d2ltaG13cHdqb2diIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTE4NDMxMywiZXhwIjoyMDk2NzYwMzEzfQ.CbxJ2vqjJgoEZBmByJ8faVPOYakvBw3b7gq4NjKZJig'
);

async function main() {
  const EXAM_ID = 'e62024e2-e5f3-4214-a921-5b2667be5335';
  const FORM2_CLASS_ID = 'ce863d72-f6a0-4674-b405-00924604caf5';

  // Total count
  const { count } = await supabase
    .from('marks')
    .select('*', { count: 'exact', head: true })
    .eq('exam_id', EXAM_ID);
  console.log('Total marks:', count);

  // Get ALL marks with pagination
  let allMarks = [];
  let page = 0;
  const PAGE_SIZE = 1000;
  while (true) {
    const { data } = await supabase
      .from('marks')
      .select('student_id, marks_obtained, subjects!inner(subject_code)')
      .eq('exam_id', EXAM_ID)
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
    if (!data || data.length === 0) break;
    allMarks = allMarks.concat(data);
    page++;
  }
  console.log('All marks fetched:', allMarks.length);

  // Unique students
  const uniqueStudents = new Set(allMarks.map(m => m.student_id));
  console.log('Students with marks:', uniqueStudents.size);

  // Subject distribution
  const dist = {};
  allMarks.forEach(m => {
    const code = m.subjects.subject_code;
    dist[code] = (dist[code] || 0) + 1;
  });
  console.log('Marks per subject:');
  for (const [code, c] of Object.entries(dist).sort()) {
    console.log(`  ${code}: ${c}`);
  }

  // Count marks per student distribution
  const perStudent = {};
  allMarks.forEach(m => {
    perStudent[m.student_id] = (perStudent[m.student_id] || 0) + 1;
  });
  const dist2 = {};
  for (const cnt of Object.values(perStudent)) {
    dist2[cnt] = (dist2[cnt] || 0) + 1;
  }
  console.log('\nSubjects per student:');
  for (const [cnt, num] of Object.entries(dist2).sort((a, b) => a[0] - b[0])) {
    console.log(`  ${cnt} subjects: ${num} students`);
  }

  // Verify a sample student against Excel
  const { data: students } = await supabase
    .from('students')
    .select('id, surname, first_name, admission_number')
    .eq('class_id', FORM2_CLASS_ID)
    .eq('status', 'active')
    .order('admission_number')
    .limit(3);

  for (const s of students) {
    const sm = allMarks.filter(m => m.student_id === s.id);
    console.log(`\n${s.surname} ${s.first_name} (${s.admission_number}): ${sm.length} subjects`);
    sm.forEach(m => console.log(`  ${m.subjects.subject_code}: ${m.marks_obtained}`));
  }

  // Compare with Excel for first few students
  console.log('\n--- Excel comparison ---');
  const wb = XLSX.readFile('C:\\Users\\Administrator\\Videos\\kizaga_rms\\F2.xlsx');
  const ws = wb.Sheets['Table 1'];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });

  const excelSubjectCols = {
    'CHEM': 6, 'BIOL': 8, 'PHYS': 10, 'MATH': 12,
    'HIST': 14, 'GEOG': 16, 'HTMA': 17, 'ENGL': 18, 'KISW': 19, 'BUSS': 21,
  };

  // Check first student with marks
  const lookup = {};
  for (const s of students) {
    const key = [s.first_name, ...(students.find(st => st.id === s.id)?.first_name ? [] : [])];
  }

  // Manual: check AGNES JUMA SAINI
  for (let i = 1; i <= 2; i++) {
    const row = rows[i];
    console.log(`\nExcel row ${i}: ${row[1]}`);
    for (const [subj, col] of Object.entries(excelSubjectCols)) {
      const val = row[col];
      if (val !== undefined && val !== null && val !== '') {
        console.log(`  ${subj}: ${val}`);
      }
    }
    console.log(`  Division: ${row[23]}, Points: ${row[24]}`);
  }
}
main().catch(console.error);
