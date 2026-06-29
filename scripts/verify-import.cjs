const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  'https://dbhaitdxwimhmwpwjogb.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRiaGFpdGR4d2ltaG13cHdqb2diIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTE4NDMxMywiZXhwIjoyMDk2NzYwMzEzfQ.CbxJ2vqjJgoEZBmByJ8faVPOYakvBw3b7gq4NjKZJig'
);

async function main() {
  const examId = 'e62024e2-e5f3-4214-a921-5b2667be5335';

  const { count } = await supabase
    .from('marks')
    .select('*', { count: 'exact', head: true })
    .eq('exam_id', examId);
  console.log('Total marks:', count);

  const { data: marks } = await supabase
    .from('marks')
    .select('student_id')
    .eq('exam_id', examId);
  const unique = new Set(marks.map(m => m.student_id));
  console.log('Students with marks:', unique.size);

  // Subject distribution
  const { data: subjMarks } = await supabase
    .from('marks')
    .select('subjects!inner(subject_code)')
    .eq('exam_id', examId);
  const dist = {};
  subjMarks.forEach(m => {
    const code = m.subjects.subject_code;
    dist[code] = (dist[code] || 0) + 1;
  });
  console.log('Marks per subject:');
  for (const [code, c] of Object.entries(dist)) {
    console.log(`  ${code}: ${c}`);
  }

  // Check a specific student (AGNES JUMA SAINI)
  const { data: students } = await supabase
    .from('students')
    .select('id, surname, first_name, admission_number')
    .eq('class_id', 'ce863d72-f6a0-4674-b405-00924604caf5')
    .eq('status', 'active')
    .order('surname')
    .limit(5);

  for (const s of students) {
    const { data: sm } = await supabase
      .from('marks')
      .select('marks_obtained, subjects(subject_code)')
      .eq('exam_id', examId)
      .eq('student_id', s.id)
      .order('subjects(subject_code)');
    console.log(`\n${s.surname} ${s.first_name} (${s.admission_number}):`);
    sm.forEach(m => console.log(`  ${m.subjects.subject_code}: ${m.marks_obtained}`));
  }
}
main().catch(console.error);
