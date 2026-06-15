import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { email, token, new_password } = await req.json()

    if (!email || !token) {
      return new Response(JSON.stringify({ error: 'Email and token are required' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { data: rows, error: fetchErr } = await supabase
      .from('password_reset_tokens')
      .select('*')
      .eq('email', email)
      .eq('token', token)
      .eq('used', false)
      .gte('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)

    if (fetchErr) throw fetchErr

    if (!rows || rows.length === 0) {
      return new Response(JSON.stringify({ error: 'Invalid or expired reset code' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    if (!new_password) {
      return new Response(JSON.stringify({ valid: true, message: 'Token is valid' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      })
    }

    if (new_password.length < 6) {
      return new Response(JSON.stringify({ error: 'Password must be at least 6 characters' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const authRes = await fetch(
      `${supabaseUrl}/auth/v1/admin/users?email=${encodeURIComponent(email)}`,
      {
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
        },
      }
    )
    const userData = await authRes.json()
    const user = userData.users?.[0]
    if (!user) {
      return new Response(JSON.stringify({ error: 'User not found' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 404,
      })
    }

    const { error: pwErr } = await supabase.auth.admin.updateUserById(
      user.id,
      { password: new_password }
    )

    if (pwErr) throw pwErr

    await supabase
      .from('password_reset_tokens')
      .update({ used: true })
      .eq('id', rows[0].id)

    return new Response(JSON.stringify({ message: 'Password reset successfully' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (err) {
    console.error('verify-reset-token error:', err)
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
