import { createClient } from '@supabase/supabase-js'
import nodemailer from 'nodemailer'

function createTransporter() {
  return nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    requireTLS: true,
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  })
}

function buildEmailHtml(email, token, resetUrl) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin:0;padding:0;background-color:#f1f5f9;font-family:Arial,Helvetica,sans-serif;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f1f5f9;padding:24px 0;">
        <tr>
          <td align="center">
            <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%;">
              <!-- Header -->
              <tr>
                <td style="background-color:#6b1d2a;padding:24px 32px;text-align:center;border-radius:12px 12px 0 0;">
                  <h1 style="color:#ffffff;margin:0;font-size:20px;font-weight:700;">Kizaga Secondary School</h1>
                  <p style="color:#e8b4b4;margin:4px 0 0;font-size:13px;">Record Management System</p>
                </td>
              </tr>
              <!-- Body -->
              <tr>
                <td style="background-color:#ffffff;padding:32px;border-radius:0 0 12px 12px;">
                  <h2 style="margin:0 0 8px;font-size:18px;color:#1e293b;">Password Reset Code</h2>
                  <p style="margin:0 0 20px;font-size:14px;color:#64748b;line-height:1.5;">
                    We received a request to reset the password for your Kizaga RMS account associated with
                    <strong style="color:#334155;">${email}</strong>.
                  </p>
                  <p style="margin:0 0 24px;font-size:14px;color:#64748b;line-height:1.5;">
                    Use the 6-digit code below to reset your password. This code expires in <strong>15 minutes</strong>.
                  </p>
                  <!-- Code Display -->
                  <div style="background:#f1f5f9;border-radius:12px;padding:24px;text-align:center;letter-spacing:8px;font-size:36px;font-weight:bold;color:#6b1d2a;margin-bottom:24px;">
                    ${token}
                  </div>
                  <!-- Reset Button -->
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td align="center" style="padding-bottom:24px;">
                        <a href="${resetUrl}" target="_blank"
                           style="display:inline-block;padding:14px 32px;background-color:#6b1d2a;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;border-radius:8px;">
                          Reset Password
                        </a>
                      </td>
                    </tr>
                  </table>
                  <!-- Text fallback -->
                  <p style="margin:0 0 24px;font-size:12px;color:#94a3b8;text-align:center;word-break:break-all;">
                    If the button does not work, copy and paste this link into your browser:<br>
                    <a href="${resetUrl}" style="color:#6b1d2a;">${resetUrl}</a>
                  </p>
                  <!-- Security Notice -->
                  <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:16px;margin-bottom:24px;">
                    <p style="margin:0;font-size:12px;color:#991b1b;line-height:1.5;">
                      <strong>Security Notice:</strong> This code expires in 15 minutes. If you did not request a password reset,
                      please ignore this email and contact the school administration immediately.
                    </p>
                  </div>
                  <hr style="border:none;border-top:1px solid #e2e8f0;margin:0 0 16px;">
                  <p style="margin:0;font-size:11px;color:#94a3b8;">
                    Kizaga Secondary School &bull; Staff Portal<br>
                    This is an automated message, please do not reply to this email.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const supabaseUrl = process.env.SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const gmailUser = process.env.GMAIL_USER
  const gmailPass = process.env.GMAIL_APP_PASSWORD

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
    return res.status(500).json({ error: 'Server configuration error' })
  }
  if (!gmailUser || !gmailPass) {
    console.error('Missing GMAIL_USER or GMAIL_APP_PASSWORD')
    return res.status(500).json({ error: 'Email service not configured' })
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey)

  try {
    const { email } = req.body

    if (!email) {
      return res.status(400).json({ error: 'Email is required' })
    }

    const token = Math.floor(100000 + Math.random() * 900000).toString()
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString()

    const { error: dbErr } = await supabase
      .from('password_reset_tokens')
      .insert({ email, token, expires_at: expiresAt })

    if (dbErr) throw dbErr

    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : process.env.SITE_URL || 'http://localhost:5173'

    const resetUrl = `${baseUrl}/forgot-password?email=${encodeURIComponent(email)}&token=${token}`

    const transporter = createTransporter()

    await transporter.sendMail({
      from: `"Kizaga RMS" <${gmailUser}>`,
      to: email,
      subject: 'Kizaga RMS — Password Reset Code',
      html: buildEmailHtml(email, token, resetUrl),
    })

    return res.status(200).json({ message: 'Reset code sent to your email' })
  } catch (err) {
    console.error('send-reset-token error:', err)
    return res.status(500).json({ error: err.message || 'Failed to send reset email' })
  }
}
