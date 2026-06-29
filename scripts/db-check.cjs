const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  'https://dbhaitdxwimhmwpwjogb.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRiaGFpdGR4d2ltaG13cHdqb2diIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTE4NDMxMywiZXhwIjoyMDk2NzYwMzEzfQ.CbxJ2vqjJgoEZBmByJ8faVPOYakvBw3b7gq4NjKZJig'
);

async function main() {
  const examId = 'e62024e2-e5f3-4214-a921-5b2667be5335';

  // Check count
  const { count, error: ce } = await supabase
    .from('marks')
    .select('*', { count: 'exact', head: true })
    .eq('exam_id', examId);
  console.log('Count:', count, ce);

  // Get a sample
  const { data: sample } = await supabase
    .from('marks')
    .select('id, student_id, subject_id, marks_obtained, created_at')
    .eq('exam_id', examId)
    .limit(3);
  console.log('Sample:', JSON.stringify(sample, null, 2));

  // Count unique (student_id, subject_id) combos
  const { data: all } = await supabase
    .from('marks')
    .select('student_id, subject_id')
    .eq('exam_id', examId);
  
  console.log('Raw records:', all.length);
  const uniquePairs = new Set(all.map(m => `${m.student_id}|${m.subject_id}`));
  console.log('Unique student-subject pairs:', uniquePairs.size);

  // Count unique students
  const uniqueStudents = new Set(all.map(m => m.student_id));
  console.log('Unique students:', uniqueStudents.size);

  // Check for duplicate (student_id, subject_id) pairs
  const pairCount = {};
  all.forEach(m => {
    const p = `${m.student_id}|${m.subject_id}`;
    pairCount[p] = (pairCount[p] || 0) + 1;
  });
  const duplicates = Object.entries(pairCount).filter(([_, c]) => c > 1);
  if (duplicates.length > 0) {
    console.log('DUPLICATE PAIRS FOUND:', duplicates.length);
    duplicates.slice(0, 5).forEach(([pair, count]) => console.log(`  ${pair}: ${count}`));
  } else {
    console.log('No duplicate pairs - UNIQUE constraint works');
  }

  // Count with delay and check again
  console.log('\nWaiting 5 seconds...');
  await new Promise(r => setTimeout(r, 5000));
  
  const { count: count2 } = await supabase
    .from('marks')
    .select('*', { count: 'exact', head: true })
    .eq('exam_id', examId);
  console.log('Count after delay:', count2);
}
main().catch(console.error);
