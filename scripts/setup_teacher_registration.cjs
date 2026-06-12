// Run once after SQL is applied: node scripts/setup_teacher_registration.cjs
const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') })

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

async function main() {
  console.log('Testing register_teacher function...\n')
  
  const email = 'testreg_' + Date.now() + '@school.ac.tz'
  const { data, error } = await supabase.rpc('register_teacher', {
    p_email: email,
    p_password: 'test123',
    p_full_name: 'Test Registration',
    p_employee_number: 'TR' + Date.now().toString().slice(-4),
    p_qualification: 'B.Ed',
    p_phone: '+255700000000',
  })

  if (error) {
    console.log('FAILED:', error.message + '\n')
    console.log('Make sure you created the function in Supabase Dashboard SQL Editor:')
    console.log('  https://supabase.com/dashboard/project/dbhaitdxwimhmwpwjogb/sql/new')
    // Show the SQL to create the function
    const sql = require('fs').readFileSync(require('path').join(__dirname, '..', 'supabase', 'migration_tables.sql'), 'utf8')
    const match = sql.match(/CREATE OR REPLACE FUNCTION public.register_teacher[\s\S]*?LANGUAGE plpgsql;/)
    if (match) console.log('\nSQL to run:\n\n' + match[0])
    return
  }

  console.log('SUCCESS! Teacher registered:', JSON.stringify(data, null, 2))

  // Cleanup
  if (data?.user_id) {
    await supabase.from('teacher_subjects').delete().eq('teacher_id', data.teacher_id)
    await supabase.from('teachers').delete().eq('id', data.teacher_id)
    await supabase.from('profiles').delete().eq('id', data.user_id)
    await supabase.auth.admin.deleteUser(data.user_id)
    console.log('\nTest data cleaned up')
  }
}

main().catch(console.error)
