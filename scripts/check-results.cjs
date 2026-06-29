const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  'https://dbhaitdxwimhmwpwjogb.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRiaGFpdGR4d2ltaG13cHdqb2diIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTE4NDMxMywiZXhwIjoyMDk2NzYwMzEzfQ.CbxJ2vqjJgoEZBmByJ8faVPOYakvBw3b7gq4NjKZJig'
);

async function main() {
  const EXAM_ID = 'e62024e2-e5f3-4214-a921-5b2667be5335';

  // Check if student_results have been computed
  const { data: results, count } = await supabase
    .from('student_results')
    .select('student_id, total_marks, average_marks, grade, division, position', { count: 'exact' })
    .eq('exam_id', EXAM_ID);
  console.log('Student results count:', count);
  if (results && results.length > 0) {
    results.slice(0, 5).forEach(r => console.log(`  ${r.student_id}: total=${r.total_marks}, avg=${r.average_marks}, grade=${r.grade}, div=${r.division}, pos=${r.position}`));
  }

  // Check exam status
  const { data: exam } = await supabase.from('exams').select('status').eq('id', EXAM_ID).single();
  console.log('Exam status:', exam?.status);
}
main().catch(console.error);
