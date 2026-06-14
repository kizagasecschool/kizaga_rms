import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { useNotification } from '../../context/NotificationContext'

function Login() {
  const { showToast } = useNotification()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [resetMode, setResetMode] = useState(false)
  const [resetSent, setResetSent] = useState(false)
  const { signIn, user, profile, loading: authLoading } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (!authLoading && user && profile) {
      const redirectMap = {
        admin: '/admin',
        headmaster: '/headmaster',
        academic: '/academic',
        teacher: '/teacher',
      }
      navigate(redirectMap[profile.role] || '/teacher', { replace: true })
    }
  }, [user, profile, authLoading, navigate])

  const handleLogin = async (e) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      await signIn(email, password)
    } catch (err) {
      setError(err.message || 'Invalid email or password')
      showToast(err.message || 'Invalid email or password', 'error')
    } finally {
      setIsLoading(false)
    }
  }

  const handleForgotPassword = async (e) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/login`,
      })
      if (error) throw error
      setResetSent(true)
      showToast('Reset link sent to your email', 'success')
    } catch (err) {
      setError(err.message || 'Failed to send reset email')
      showToast(err.message || 'Failed to send reset email', 'error')
    } finally {
      setIsLoading(false)
    }
  }

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <div className="w-10 h-10 border-4 border-slate-200 border-t-maroon-600 rounded-full animate-spin" />
      </div>
    )
  }

  if (resetMode) {
    return (
      <div className="min-h-screen lg:grid lg:grid-cols-2 bg-slate-50">
        {/* Left - Desktop only */}
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
        {/* Right - Form */}
        <div className="flex items-center justify-center p-6">
          <div className="w-full max-w-md">
            {/* Mobile banner */}
            <div className="lg:hidden text-center mb-8">
              <div className="w-16 h-16 mx-auto mb-4 bg-maroon-100 rounded-2xl flex items-center justify-center">
                <span className="text-xl font-bold text-maroon-600">K</span>
              </div>
              <h1 className="text-xl font-bold text-slate-900">Reset Password</h1>
              <p className="text-sm text-slate-500 mt-1">Enter your email to receive reset instructions</p>
            </div>
            {/* Desktop heading */}
            <div className="hidden lg:block text-center mb-8">
              <h1 className="text-2xl font-bold text-slate-900">Reset Password</h1>
              <p className="text-sm text-slate-500 mt-1">Enter your email to receive reset instructions</p>
            </div>

            {resetSent ? (
              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-4 bg-green-100 rounded-full flex items-center justify-center">
                  <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                  </svg>
                </div>
                <h2 className="text-lg font-semibold text-slate-900 mb-2">Check your inbox</h2>
                <p className="text-sm text-slate-500 mb-6">We've sent a password reset link to <span className="font-medium text-slate-700">{email}</span></p>
                <button
                  onClick={() => { setResetMode(false); setResetSent(false) }}
                  className="text-sm font-medium text-maroon-600 hover:text-maroon-500 hover:underline"
                >
                  Back to login
                </button>
              </div>
            ) : (
              <form onSubmit={handleForgotPassword} className="space-y-5">
                {error && (
                  <div className="flex items-center gap-2.5 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
                    <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                    </svg>
                    <span>{error}</span>
                  </div>
                )}

                <div className="space-y-1.5">
                  <label htmlFor="reset-email" className="block text-sm font-medium text-slate-700">Email address</label>
                  <div className="relative">
                    <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                    </svg>
                    <input
                      id="reset-email"
                      type="email"
                      placeholder="you@school.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
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
                  ) : 'Send Reset Link'}
                </button>

                <button
                  type="button"
                  onClick={() => { setResetMode(false); setError('') }}
                  className="w-full text-sm text-slate-500 hover:text-slate-700 font-medium py-2"
                >
                  Back to login
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-2 bg-slate-50">
      {/* Left - Desktop only */}
      <div className="hidden lg:flex bg-gradient-to-br from-maroon-800 via-maroon-900 to-neutral-950 items-center justify-center text-white relative overflow-hidden">
        <div className="absolute inset-0 bg-neutral-950/20" />
        <div className="relative z-10 text-center max-w-md">
          <div className="w-28 h-28 mx-auto mb-8 bg-white/10 backdrop-blur-sm rounded-3xl flex items-center justify-center border border-white/20">
            <span className="text-4xl font-bold text-white">K</span>
          </div>
          <h2 className="text-3xl font-bold mb-3">Kizaga Secondary School</h2>
          <p className="text-maroon-100 text-base">Staff Portal</p>
          <div className="mt-12 space-y-4">
            <div className="flex items-center gap-3 text-maroon-100 text-sm">
              <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>Manage student results efficiently</span>
            </div>
            <div className="flex items-center gap-3 text-maroon-100 text-sm">
              <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>Track academic performance over time</span>
            </div>
            <div className="flex items-center gap-3 text-maroon-100 text-sm">
              <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>Generate comprehensive reports</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right - Form */}
      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          {/* Mobile banner */}
          <div className="lg:hidden mb-8">
            <div className="bg-gradient-to-br from-maroon-800 via-maroon-900 to-neutral-950 rounded-2xl p-8 text-white text-center relative overflow-hidden">
              <div className="absolute inset-0 bg-neutral-950/20" />
              <div className="relative z-10">
                <div className="w-16 h-16 mx-auto mb-4 bg-white/10 backdrop-blur rounded-2xl flex items-center justify-center border border-white/20">
                  <span className="text-xl font-bold text-white">K</span>
                </div>
                <h2 className="text-lg font-bold">Kizaga Secondary School</h2>
                <p className="text-maroon-100 text-xs">Staff Portal</p>
                <div className="flex items-center justify-center gap-4 mt-4 text-maroon-100 text-xs">
                  <span>Results</span>
                  <span className="w-1 h-1 rounded-full bg-maroon-100/40" />
                  <span>Performance</span>
                  <span className="w-1 h-1 rounded-full bg-maroon-100/40" />
                  <span>Reports</span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-lg shadow-gray-200/50 p-6 sm:p-8">
            <div className="text-center mb-8">
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Welcome back</h1>
              <p className="text-sm text-slate-500 mt-1">Sign in to your account to continue</p>
            </div>

            <form onSubmit={handleLogin} className="space-y-5">
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

              <div className="space-y-1.5">
                <label htmlFor="password" className="block text-sm font-medium text-slate-700">Password</label>
                <div className="relative">
                  <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                  </svg>
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="w-full pl-11 pr-12 py-3 border border-slate-300 rounded-xl text-sm outline-none focus:border-maroon-500 focus:ring-4 focus:ring-maroon-500/10 transition placeholder:text-slate-400"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition p-1"
                    tabIndex={-1}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? (
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 text-maroon-600 focus:ring-maroon-500 focus:ring-offset-0"
                  />
                  <span className="text-sm text-slate-600">Remember me</span>
                </label>
                <Link
                  to="/forgot-password"
                  className="text-sm font-medium text-maroon-600 hover:text-maroon-500 hover:underline"
                >
                  Forgot password?
                </Link>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 bg-maroon-600 hover:bg-maroon-700 active:bg-maroon-800 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold rounded-xl text-sm transition-all flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Signing in...</>
                ) : 'Sign In'}
              </button>
            </form>

            <div className="flex items-center justify-center mt-6">
              <Link to="/" className="text-sm text-slate-500 hover:text-maroon-600 transition inline-flex items-center gap-1.5">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955a1.126 1.126 0 011.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
                </svg>
                Back to Home
              </Link>
            </div>

            <p className="text-center text-xs text-slate-400 mt-6">
              &copy; {new Date().getFullYear()} Kizaga Secondary School
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Login
