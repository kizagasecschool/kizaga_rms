import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useNotification } from '../../context/NotificationContext'

const STEPS = { EMAIL: 1, TOKEN: 2, PASSWORD: 3, DONE: 4 }

function ForgotPassword() {
  const { showToast } = useNotification()
  const [step, setStep] = useState(STEPS.EMAIL)
  const [email, setEmail] = useState('')
  const [token, setToken] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [verifiedToken, setVerifiedToken] = useState('')

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.replace(/\/+$/, '')
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

  async function callEdgeFunction(name, body) {
    let res
    try {
      res = await fetch(`${supabaseUrl}/functions/v1/${name}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${anonKey}`,
        },
        body: JSON.stringify(body),
      })
    } catch {
      throw new Error('Network error - please check your connection or the edge function may not be deployed.')
    }
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Something went wrong')
    return data
  }

  const handleSendCode = async (e) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)
    try {
      await callEdgeFunction('send-reset-token', { email })
      setStep(STEPS.TOKEN)
      showToast('Reset code sent to your email', 'success')
    } catch (err) {
      setError(err.message)
      showToast(err.message, 'error')
    } finally {
      setIsLoading(false)
    }
  }

  const handleVerifyCode = async (e) => {
    e.preventDefault()
    if (token.length !== 6) {
      setError('Please enter the full 6-digit code')
      return
    }
    setError('')
    setIsLoading(true)
    try {
      const data = await callEdgeFunction('verify-reset-token', { email, token })
      if (data.valid) {
        setVerifiedToken(token)
        setStep(STEPS.PASSWORD)
      }
    } catch (err) {
      setError(err.message)
      showToast(err.message, 'error')
    } finally {
      setIsLoading(false)
    }
  }

  const handleResetPassword = async (e) => {
    e.preventDefault()
    setError('')
    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }
    setIsLoading(true)
    try {
      await callEdgeFunction('verify-reset-token', {
        email,
        token: verifiedToken,
        new_password: password,
      })
      setStep(STEPS.DONE)
      showToast('Password reset successfully', 'success')
    } catch (err) {
      setError(err.message)
      showToast(err.message, 'error')
    } finally {
      setIsLoading(false)
    }
  }

  const renderStepIndicator = () => (
    <div className="flex items-center justify-center gap-2 mb-8">
      {[STEPS.EMAIL, STEPS.TOKEN, STEPS.PASSWORD].map((s) => (
        <div key={s} className="flex items-center gap-2">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
            step >= s ? 'bg-maroon-600 text-white' : 'bg-gray-200 text-gray-400'
          }`}>
            {s}
          </div>
          {s < STEPS.PASSWORD && <div className={`w-8 h-0.5 ${step > s ? 'bg-maroon-600' : 'bg-gray-200'}`} />}
        </div>
      ))}
    </div>
  )

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-2 bg-slate-50">
      <div className="hidden lg:flex bg-gradient-to-br from-maroon-800 via-maroon-900 to-neutral-950 items-center justify-center text-white relative overflow-hidden">
        <div className="absolute inset-0 bg-neutral-950/20" />
        <div className="relative z-10 text-center">
          <div className="w-24 h-24 mx-auto mb-6 bg-white/10 backdrop-blur-sm rounded-2xl flex items-center justify-center border border-white/20">
            <span className="text-3xl font-bold text-white">K</span>
          </div>
          <h2 className="text-2xl font-bold mb-2">Kizaga Secondary School</h2>
          <p className="text-maroon-100 text-sm">Staff Portal</p>
        </div>
      </div>

      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="lg:hidden text-center mb-8">
            <div className="w-16 h-16 mx-auto mb-4 bg-maroon-100 rounded-2xl flex items-center justify-center">
              <span className="text-xl font-bold text-maroon-600">K</span>
            </div>
            <h1 className="text-xl font-bold text-slate-900">Reset Password</h1>
            <p className="text-sm text-slate-500 mt-1">
              {step === STEPS.EMAIL && 'Enter your email to receive a reset code'}
              {step === STEPS.TOKEN && 'Enter the 6-digit code sent to your email'}
              {step === STEPS.PASSWORD && 'Choose a new password'}
              {step === STEPS.DONE && 'Password reset complete'}
            </p>
          </div>

          <div className="hidden lg:block text-center mb-8">
            <h1 className="text-2xl font-bold text-slate-900">Reset Password</h1>
            <p className="text-sm text-slate-500 mt-1">
              {step === STEPS.EMAIL && 'Enter your email to receive a reset code'}
              {step === STEPS.TOKEN && 'Enter the 6-digit code sent to your email'}
              {step === STEPS.PASSWORD && 'Choose a new password'}
              {step === STEPS.DONE && 'Password reset complete'}
            </p>
          </div>

          {step < STEPS.DONE && renderStepIndicator()}

          {step === STEPS.DONE ? (
            <div className="text-center bg-white rounded-2xl shadow-lg shadow-gray-200/50 p-8">
              <div className="w-16 h-16 mx-auto mb-4 bg-green-100 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                </svg>
              </div>
              <h2 className="text-lg font-semibold text-slate-900 mb-2">Password Reset Complete</h2>
              <p className="text-sm text-slate-500 mb-6">Your password has been reset successfully.</p>
              <Link
                to="/login"
                className="inline-block px-6 py-3 bg-maroon-600 hover:bg-maroon-700 text-white font-semibold rounded-xl text-sm transition"
              >
                Sign In
              </Link>
            </div>
          ) : step === STEPS.EMAIL ? (
            <div className="bg-white rounded-2xl shadow-lg shadow-gray-200/50 p-6 sm:p-8">
              <form onSubmit={handleSendCode} className="space-y-5">
                {error && (
                  <div className="flex items-center gap-2.5 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
                    <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                    </svg>
                    <span>{error}</span>
                  </div>
                )}

                <div className="space-y-1.5">
                  <label htmlFor="email" className="block text-sm font-medium text-slate-700">Email address</label>
                  <div className="relative">
                    <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                    </svg>
                    <input
                      id="email"
                      type="email"
                      placeholder="you@school.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      autoFocus
                      className="w-full pl-11 pr-4 py-3 border border-slate-300 rounded-xl text-sm outline-none focus:border-maroon-500 focus:ring-4 focus:ring-maroon-500/10 transition placeholder:text-slate-400"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3 bg-maroon-600 hover:bg-maroon-700 active:bg-maroon-800 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold rounded-xl text-sm transition-all flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Sending...</>
                  ) : 'Send Reset Code'}
                </button>

                <Link
                  to="/login"
                  className="block w-full text-center text-sm text-slate-500 hover:text-slate-700 font-medium py-2"
                >
                  Back to login
                </Link>
              </form>
            </div>
          ) : step === STEPS.TOKEN ? (
            <div className="bg-white rounded-2xl shadow-lg shadow-gray-200/50 p-6 sm:p-8">
              <p className="text-sm text-slate-500 mb-6 text-center">
                We sent a code to <span className="font-medium text-slate-700">{email}</span>
              </p>
              <form onSubmit={handleVerifyCode} className="space-y-5">
                {error && (
                  <div className="flex items-center gap-2.5 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
                    <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                    </svg>
                    <span>{error}</span>
                  </div>
                )}

                <div className="space-y-1.5">
                  <label htmlFor="token" className="block text-sm font-medium text-slate-700">Reset Code</label>
                  <input
                    id="token"
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="000000"
                    value={token}
                    onChange={(e) => setToken(e.target.value.replace(/\D/g, ''))}
                    required
                    autoFocus
                    className="w-full px-4 py-3 text-center text-2xl tracking-[0.5em] font-bold border border-slate-300 rounded-xl text-sm outline-none focus:border-maroon-500 focus:ring-4 focus:ring-maroon-500/10 transition placeholder:text-slate-300"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isLoading || token.length !== 6}
                  className="w-full py-3 bg-maroon-600 hover:bg-maroon-700 active:bg-maroon-800 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold rounded-xl text-sm transition-all flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Verifying...</>
                  ) : 'Verify Code'}
                </button>

                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setStep(STEPS.EMAIL)}
                    className="text-sm text-slate-500 hover:text-slate-700 font-medium"
                  >
                    Change email
                  </button>
                  <button
                    type="button"
                    disabled={isLoading}
                    onClick={handleSendCode}
                    className="text-sm text-maroon-600 hover:text-maroon-500 font-medium disabled:opacity-50"
                  >
                    Resend code
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <div className="bg-white rounded-2xl shadow-lg shadow-gray-200/50 p-6 sm:p-8">
              <form onSubmit={handleResetPassword} className="space-y-5">
                {error && (
                  <div className="flex items-center gap-2.5 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
                    <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                    </svg>
                    <span>{error}</span>
                  </div>
                )}

                <div className="space-y-1.5">
                  <label htmlFor="new-password" className="block text-sm font-medium text-slate-700">New Password</label>
                  <div className="relative">
                    <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                    </svg>
                    <input
                      id="new-password"
                      type="password"
                      placeholder="Min. 6 characters"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={6}
                      autoFocus
                      className="w-full pl-11 pr-4 py-3 border border-slate-300 rounded-xl text-sm outline-none focus:border-maroon-500 focus:ring-4 focus:ring-maroon-500/10 transition placeholder:text-slate-400"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="confirm-password" className="block text-sm font-medium text-slate-700">Confirm Password</label>
                  <div className="relative">
                    <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                    </svg>
                    <input
                      id="confirm-password"
                      type="password"
                      placeholder="Re-enter new password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      minLength={6}
                      className="w-full pl-11 pr-4 py-3 border border-slate-300 rounded-xl text-sm outline-none focus:border-maroon-500 focus:ring-4 focus:ring-maroon-500/10 transition placeholder:text-slate-400"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3 bg-maroon-600 hover:bg-maroon-700 active:bg-maroon-800 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold rounded-xl text-sm transition-all flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Resetting...</>
                  ) : 'Reset Password'}
                </button>

                <Link
                  to="/login"
                  className="block w-full text-center text-sm text-slate-500 hover:text-slate-700 font-medium py-2"
                >
                  Back to login
                </Link>
              </form>
            </div>
          )}

          <p className="text-center text-xs text-slate-400 mt-6">
            &copy; {new Date().getFullYear()} Kizaga Secondary School
          </p>
        </div>
      </div>
    </div>
  )
}

export default ForgotPassword
