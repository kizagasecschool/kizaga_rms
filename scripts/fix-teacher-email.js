// Run: node scripts/fix-teacher-email.js
// Fixes a teacher's auth email directly using service role key

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

config()

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function fixUser(id, correctEmail, label) {
  const { error: authErr } = await supabase.auth.admin.updateUserById(id, {
    email: correctEmail,
    email_confirm: true,
  })
  if (authErr) { console.error(`Auth update failed for ${label}:`, authErr.message); return false }

  const { error: profErr } = await supabase
    .from('profiles')
    .update({ email: correctEmail })
    .eq('id', id)
  if (profErr) { console.error(`Profile update failed for ${label}:`, profErr.message); return false }

  console.log(`✓ ${label} → ${correctEmail}`)
  return true
}

async function fixEmail() {
  // 1. Revert ABBASI back to his original email (was wrongly changed)
  await fixUser(
    'e7f11474-1983-462c-9248-7324664d5426',
    'juma@gmail.com',
    'ABBASI MTANDIKA JUMA (revert)'
  )

  // 2. Fix DISHON — sync auth to match his profile email
  await fixUser(
    '02304a3e-2dca-4041-b4d7-708ba79351f9',
    'dishonodanga756@gmail.com',
    'DISHON ODANGA KAMAGANGA (fix auth)'
  )

  console.log('\nDone. Login credentials:')
  console.log('  ABBASI  → juma@gmail.com')
  console.log('  DISHON  → dishonodanga756@gmail.com')
}

fixEmail()
