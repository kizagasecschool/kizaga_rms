import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
const FROM_EMAIL = Deno.env.get('RESEND_FROM_EMAIL') || 'noreply@kizaga-school.ac.tz'

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
    const { email } = await req.json()
    if (!email) {
      return new Response(JSON.stringify({ error: 'Email is required' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const token = Math.floor(100000 + Math.random() * 900000).toString()
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString()

    const { error: dbErr } = await supabase
      .from('password_reset_tokens')
      .insert({ email, token, expires_at: expiresAt })

    if (dbErr) throw dbErr

    if (!RESEND_API_KEY) {
      console.warn('RESEND_API_KEY not set — returning token in response for development')
      return new Response(JSON.stringify({ message: 'Reset code sent to your email', token }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      })
    }

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: email,
        subject: 'Kizaga RMS — Password Reset Code',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
            <div style="background: #6b1d2a; padding: 24px; text-align: center;">
              <h1 style="color: #fff; margin: 0; font-size: 20px;">Kizaga Secondary School</h1>
              <p style="color: #e8b4b4; margin: 4px 0 0; font-size: 13px;">Record Management System</p>
            </div>
            <div style="padding: 32px 24px; background: #fff;">
              <h2 style="margin: 0 0 8px; font-size: 18px; color: #1e293b;">Password Reset Code</h2>
              <p style="margin: 0 0 20px; font-size: 14px; color: #64748b;">
                Use the code below to reset your password. This code expires in <strong>15 minutes</strong>.
              </p>
              <div style="background: #f1f5f9; border-radius: 12px; padding: 24px; text-align: center; letter-spacing: 8px; font-size: 32px; font-weight: bold; color: #6b1d2a;">
                ${token}
              </div>
              <p style="margin: 20px 0 0; font-size: 12px; color: #94a3b8;">
                If you didn't request this code, you can safely ignore this email.
              </p>
            </div>
          </div>
        `,
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      console.error('Resend API error:', err)
      return new Response(JSON.stringify({ error: 'Failed to send email' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      })
    }

    return new Response(JSON.stringify({ message: 'Reset code sent to your email' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (err) {
    console.error('send-reset-token error:', err)
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
