// Test the Vercel API route: node scripts/setup_teacher_registration.cjs
const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') })

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

async function main() {
  console.log('Testing /api/register-teacher via Supabase Admin API...\n')

  const email = 'testreg_' + Date.now() + '@school.ac.tz'

  // Simulate what the API route does
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password: 'test123',
    email_confirm: true,
    user_metadata: { full_name: 'Test Registration', role: 'teacher' },
  })

  if (authError) {
    console.log('FAILED at createUser:', authError.message)
    return
  }

  const userId = authData.user.id
  console.log('Auth user created:', userId)

  const { error: profileError } = await supabase.from('profiles').insert({
    id: userId, email, full_name: 'Test Registration', role: 'teacher',
  })

  if (profileError) {
    console.log('FAILED at profile insert:', profileError.message)
    await supabase.auth.admin.deleteUser(userId).catch(() => {})
    return
  }

  const empNo = 'TR' + Date.now().toString().slice(-4)
  const { data: teacherData, error: teacherError } = await supabase
    .from('teachers')
    .insert({
      employee_number: empNo,
      profile_id: userId,
      qualification: 'B.Ed',
      phone: '+255700000000',
      status: 'active',
    })
    .select('id')
    .single()

  if (teacherError) {
    console.log('FAILED at teacher insert:', teacherError.message)
    await supabase.from('profiles').delete().eq('id', userId).catch(() => {})
    await supabase.auth.admin.deleteUser(userId).catch(() => {})
    return
  }

  console.log('SUCCESS! Teacher registered:', JSON.stringify({
    user_id: userId,
    teacher_id: teacherData.id,
    employee_number: empNo,
  }, null, 2))

  // Cleanup
  await supabase.from('teacher_subjects').delete().eq('teacher_id', teacherData.id)
  await supabase.from('teachers').delete().eq('id', teacherData.id)
  await supabase.from('profiles').delete().eq('id', userId)
  await supabase.auth.admin.deleteUser(userId)
  console.log('\nTest data cleaned up')
}

main().catch(console.error)
