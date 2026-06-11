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

async function createAdmin() {
  const email = process.argv[2]
  const password = process.argv[3]
  const fullName = process.argv[4] || 'Admin User'

  if (!email || !password) {
    console.error('Usage: node scripts/createAdmin.js <email> <password> [full_name]')
    process.exit(1)
  }

  process.stdout.write(`Creating admin ${email} ... `)

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName, role: 'admin' },
  })

  if (error) {
    if (error.message?.toLowerCase().includes('already exists')) {
      console.log('already exists')
      process.exit(0)
    }
    console.error(`ERROR ${error.message}`)
    process.exit(1)
  }

  // Create profile directly
  const { error: pe } = await supabase
    .from('profiles')
    .upsert({ id: data.user.id, email, full_name: fullName, role: 'admin' }, { onConflict: 'id' })

  if (pe) {
    console.error(`created but profile: ${pe.message}`)
    process.exit(1)
  }

  console.log('done')
  console.log(`  Email:    ${email}`)
  console.log(`  Password: ${password}`)
  console.log(`  Role:     admin`)
  process.exit(0)
}

createAdmin().catch((err) => {
  console.error('Failed:', err)
  process.exit(1)
})
