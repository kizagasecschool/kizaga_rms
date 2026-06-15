import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
config({ path: resolve(__dirname, '../.env') })

const supabaseUrl = process.env.VITE_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceKey) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const EMAIL = 'kizengagodlove5@gmail.com'
const PASSWORD = '12345678'
const FULL_NAME = 'Godlove Kizenga'
const EMPLOYEE_NUMBER = 'TCH-KIZENGA'

async function main() {
  console.log(`Creating teacher: ${EMAIL}\n`)

  // 1. Find Mathematics subject (O-Level)
  console.log('Looking up Mathematics subject...')
  const { data: subjects, error: subErr } = await supabase
    .from('subjects')
    .select('id, subject_code, subject_name')
    .in('subject_code', ['MATH-O', 'MATH_O', 'MATH'])

  if (subErr) { console.error('Subject error:', subErr.message); process.exit(1) }
  if (!subjects || subjects.length === 0) {
    console.log('  No math subjects found. Will skip subject assignments.')
  } else {
    subjects.forEach(s => console.log(`  ${s.subject_code}: ${s.subject_name} (${s.id})`))
  }

  // 2. Find Form 1 class_streams
  console.log('\nLooking up Form 1 streams...')
  const { data: classes } = await supabase
    .from('classes')
    .select('id, class_name')
    .eq('class_name', 'Form 1')
    .single()

  if (!classes) { console.error('Form 1 class not found'); process.exit(1) }
  console.log('  Form 1 ID:', classes.id)

  const { data: classStreams } = await supabase
    .from('class_streams')
    .select('id, class_id, stream_id')
    .eq('class_id', classes.id)

  if (!classStreams || classStreams.length === 0) {
    console.log('  No class_streams found for Form 1. Will skip stream assignments.')
  } else {
    // Get stream names
    const streamIds = classStreams.map(cs => cs.stream_id)
    const { data: streams } = await supabase
      .from('streams')
      .select('id, stream_name')
      .in('id', streamIds)

    const streamMap = {}
    streams?.forEach(s => { streamMap[s.id] = s.stream_name })
    classStreams.forEach(cs => {
      console.log(`  ${cs.id} → Stream ${streamMap[cs.stream_id] || cs.stream_id}`)
    })
  }

  // 3. Create or get auth user
  process.stdout.write('\nCreating auth user... ')
  let userId

  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: EMAIL,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: FULL_NAME, role: 'teacher' },
  })

  if (authError) {
    if (authError.message?.toLowerCase().includes('already been registered')) {
      console.log('already exists')
      const { data: listData } = await supabase.auth.admin.listUsers()
      const existing = listData?.users?.find(x => x.email === EMAIL)
      if (!existing) { console.error('Could not find existing user'); process.exit(1) }
      userId = existing.id
    } else {
      console.error('ERROR:', authError.message)
      process.exit(1)
    }
  } else {
    console.log('done')
    userId = authData.user.id
  }

  // 4. Upsert profile
  process.stdout.write('Creating profile... ')
  const { error: pe } = await supabase
    .from('profiles')
    .upsert({ id: userId, email: EMAIL, full_name: FULL_NAME, role: 'teacher' }, { onConflict: 'id' })

  if (pe) { console.error('FAILED:', pe.message); process.exit(1) }
  console.log('done')

  // 5. Insert teacher record (check if already exists for this profile_id)
  process.stdout.write('Creating teacher record... ')
  const { data: existingTeacher } = await supabase
    .from('teachers')
    .select('id')
    .eq('profile_id', userId)
    .maybeSingle()

  let teacherId
  if (existingTeacher) {
    teacherId = existingTeacher.id
    console.log('already exists (id: ' + teacherId + ')')
  } else {
    const { data: teacher, error: te } = await supabase
      .from('teachers')
      .insert({
        employee_number: EMPLOYEE_NUMBER,
        profile_id: userId,
        qualification: null,
        phone: null,
        status: 'active',
      })
      .select('id')
      .single()

    if (te) { console.error('FAILED:', te.message); process.exit(1) }
    teacherId = teacher.id
    console.log('done (id: ' + teacherId + ')')
  }

  // 6. Assign subjects to Form 1 class_streams (teacher_subjects requires all three: teacher + stream + subject)
  if (subjects && subjects.length > 0 && classStreams && classStreams.length > 0) {
    console.log('\nAssigning Mathematics to all Form 1 streams...')
    for (const cs of classStreams) {
      for (const sub of subjects) {
        const { error: ae } = await supabase
          .from('teacher_subjects')
          .upsert(
            { teacher_id: teacherId, subject_id: sub.id, class_stream_id: cs.id },
            { onConflict: 'teacher_id,subject_id,class_stream_id', ignoreDuplicates: true }
          )
        if (ae) console.log('  ' + sub.subject_code + ' → ' + cs.id + ': ' + ae.message)
        else console.log('  ' + sub.subject_code + ' → stream ' + cs.id)
      }
    }
  }

  console.log('\n=== SUCCESS ===')
  console.log('  Email:    ' + EMAIL)
  console.log('  Password: ' + PASSWORD)
  console.log('  Name:     ' + FULL_NAME)
  console.log('  Employee: ' + EMPLOYEE_NUMBER)
  console.log('  Role:     teacher')
  console.log('  User ID:  ' + userId)
  console.log('  Teacher ID: ' + teacherId)
}

main().catch(err => { console.error('\nFatal:', err); process.exit(1) })
