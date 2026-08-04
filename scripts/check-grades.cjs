const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  'https://dbhaitdxwimhmwpwjogb.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRiaGFpdGR4d2ltaG13cHdqb2diIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTE4NDMxMywiZXhwIjoyMDk2NzYwMzEzfQ.CbxJ2vqjJgoEZBmByJ8faVPOYakvBw3b7gq4NjKZJig'
);

async function main() {
  const { data: grades } = await supabase.from('grades').select('*').eq('level', 'O_LEVEL').order('min_mark');
  console.log('O-Level grades:');
  grades.forEach(g => console.log(`  ${g.grade}: ${g.min_mark}-${g.max_mark} points=${g.points}`));

  // Check specific student results
  const { data: students } = await supabase
    .from('students')
    .select('id, surname, first_name, admission_number')
    .eq('class_id', 'ce863d72-f6a0-4674-b405-00924604caf5')
    .eq('status', 'active')
    .order('admission_number')
    .limit(5);

  const { data: marks } = await supabase
    .from('marks')
    .select('student_id, marks_obtained, subjects!inner(subject_code)')
    .eq('exam_id', 'e62024e2-e5f3-4214-a921-5b2667be5335');

  for (const s of students.slice(0, 3)) {
    const sm = marks.filter(m => m.student_id === s.id);
    const total = sm.reduce((sum, m) => sum + m.marks_obtained, 0);
    const avg = sm.length > 0 ? total / sm.length : 0;
    console.log(`\n${s.surname} ${s.first_name} (${s.admission_number}): ${sm.length} subjects, total=${total}, avg=${avg.toFixed(2)}`);
    sm.forEach(m => console.log(`  ${m.subjects.subject_code}: ${m.marks_obtained}`));
  }
}
main().catch(console.error);
