const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  'https://dbhaitdxwimhmwpwjogb.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRiaGFpdGR4d2ltaG13cHdqb2diIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTE4NDMxMywiZXhwIjoyMDk2NzYwMzEzfQ.CbxJ2vqjJgoEZBmByJ8faVPOYakvBw3b7gq4NjKZJig'
);

async function main() {
  const EXAM_ID = 'e62024e2-e5f3-4214-a921-5b2667be5335';

  // Get all marks for this exam with subject info
  const { data: marks } = await supabase
    .from('marks')
    .select('student_id, marks_obtained, subjects!inner(subject_code)')
    .eq('exam_id', EXAM_ID)
    .order('student_id');

  console.log('Total marks records:', marks.length);

  // Count per student
  const perStudent = {};
  const perStudentSubj = {};
  for (const m of marks) {
    if (!perStudent[m.student_id]) perStudent[m.student_id] = { count: 0, marks: [] };
    perStudent[m.student_id].count++;
    perStudent[m.student_id].marks.push(m);

    if (!perStudentSubj[m.student_id]) perStudentSubj[m.student_id] = {};
    const code = m.subjects.subject_code;
    if (perStudentSubj[m.student_id][code]) {
      console.log(`DUPLICATE SUBJECT: student ${m.student_id} already has ${code}`);
    }
    perStudentSubj[m.student_id][code] = (perStudentSubj[m.student_id][code] || 0) + 1;
  }

  console.log('\nUnique students:', Object.keys(perStudent).length);

  // Show distribution
  const dist = {};
  for (const [sid, data] of Object.entries(perStudent)) {
    dist[data.count] = (dist[data.count] || 0) + 1;
  }
  for (const [cnt, num] of Object.entries(dist).sort((a, b) => a[0] - b[0])) {
    console.log(`  ${cnt} subjects: ${num} students`);
  }

  // Get student names for any with > 10 subjects
  for (const [sid, data] of Object.entries(perStudent)) {
    if (data.count > 10) {
      const { data: s } = await supabase.from('students').select('surname, first_name, admission_number').eq('id', sid).single();
      console.log(`\n${s.surname} ${s.first_name} (${s.admission_number}): ${data.count} subjects`);
      data.marks.forEach(m => console.log(`  ${m.subjects.subject_code}: ${m.marks_obtained}`));
    }
  }
}
main().catch(console.error);
