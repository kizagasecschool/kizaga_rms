/**
 * Finds auth.users entries that have no matching row in profiles (orphaned)
 * and deletes them so their email can be re-registered.
 */

const { createClient } = require('@supabase/supabase-js')

const URL = 'https://dbhaitdxwimhmwpwjogb.supabase.co'
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRiaGFpdGR4d2ltaG13cHdqb2diIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTE4NDMxMywiZXhwIjoyMDk2NzYwMzEzfQ.CbxJ2vqjJgoEZBmByJ8faVPOYakvBw3b7gq4NjKZJig'
const sb = createClient(URL, KEY)

async function main() {
  console.log('Fetching all auth users (paginated)…')
  const allAuthUsers = []
  let page = 1
  while (true) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) throw new Error('listUsers: ' + error.message)
    if (!data.users.length) break
    allAuthUsers.push(...data.users)
    if (data.users.length < 1000) break
    page++
  }
  console.log(`  Total auth users: ${allAuthUsers.length}`)

  // Fetch all profile IDs
  const profileIds = new Set()
  let pPage = 0
  while (true) {
    const { data, error } = await sb.from('profiles').select('id').range(pPage * 1000, pPage * 1000 + 999)
    if (error) throw new Error('profiles: ' + error.message)
    if (!data.length) break
    data.forEach(r => profileIds.add(r.id))
    if (data.length < 1000) break
    pPage++
  }
  console.log(`  Total profile rows: ${profileIds.size}`)

  // Find orphaned auth users
  const orphaned = allAuthUsers.filter(u => !profileIds.has(u.id))
  console.log(`  Orphaned auth users (no profile): ${orphaned.length}`)

  if (orphaned.length === 0) {
    console.log('✅ No orphaned auth users found.')
    return
  }

  for (const u of orphaned) {
    console.log(`  Deleting orphaned auth user: ${u.email} (${u.id})`)
    const { error } = await sb.auth.admin.deleteUser(u.id)
    if (error) console.error(`  ✗ Failed to delete ${u.email}: ${error.message}`)
    else console.log(`  ✓ Deleted ${u.email}`)
  }

  console.log(`✅ Done. Deleted ${orphaned.length} orphaned auth user(s).`)
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1) })
