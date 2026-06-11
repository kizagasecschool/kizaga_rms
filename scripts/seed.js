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

const users = [
  { email: 'admin@school.com',       password: 'Admin@123',       full_name: 'Admin User',       role: 'admin' },
  { email: 'headmaster@school.com',  password: 'Headmaster@123',  full_name: 'Headmaster User',  role: 'headmaster' },
  { email: 'academic@school.com',    password: 'Academic@123',    full_name: 'Academic User',    role: 'academic' },
  { email: 'teacher@school.com',     password: 'Teacher@123',     full_name: 'Teacher User',     role: 'teacher' },
]

async function seed() {
  console.log('Seeding users...\n')

  let success = 0
  let failed = 0

  for (const u of users) {
    process.stdout.write(`  ${u.email} ... `)

    // Create user
    const { data, error } = await supabase.auth.admin.createUser({
      email: u.email,
      password: u.password,
      email_confirm: true,
      user_metadata: { full_name: u.full_name, role: u.role },
    })

    if (error) {
      // If user exists, we can still try to update their profile
      if (error.message?.toLowerCase().includes('already exists')) {
        console.log('already exists')

        // Find the existing user to get their ID
        const { data: listData } = await supabase.auth.admin.listUsers()
        const existing = listData?.users?.find((x) => x.email === u.email)
        if (existing) {
          const { error: pe } = await supabase
            .from('profiles')
            .upsert({ id: existing.id, email: u.email, full_name: u.full_name, role: u.role }, { onConflict: 'id' })
          if (pe) console.log(`       profile upsert: ${pe.message}`)
        }
        continue
      }

      console.log(`ERROR ${error.message}`)
      failed++
      continue
    }

    // Create profile directly with service role (guaranteed to work)
    const { error: pe } = await supabase
      .from('profiles')
      .upsert({ id: data.user.id, email: u.email, full_name: u.full_name, role: u.role }, { onConflict: 'id' })

    if (pe) {
      console.log(`created but profile: ${pe.message}`)
      failed++
    } else {
      console.log(`done (${u.role})`)
      success++
    }
  }

  console.log(`\nDone. ${success} created, ${failed} failed.`)
  process.exit(failed > 0 ? 1 : 0)
}

seed().catch((err) => {
  console.error('\nSeed failed:', err)
  process.exit(1)
})
