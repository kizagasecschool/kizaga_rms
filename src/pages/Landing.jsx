import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

const subjectsOLevel = [
  'Mathematics', 'English Language', 'Kiswahili', 'Physics',
  'Chemistry', 'Biology', 'History', 'Geography',
  'Civics', 'Business Studies', 'Historia ya Tanzania', 'Maadili',
]

const aLevelCombinations = [
  { name: 'CBG', subjects: 'Chemistry, Biology, Geography', career: 'Medicine, Agriculture, Environmental Science' },
  { name: 'HKL', subjects: 'History, Kiswahili, Literature', career: 'Law, Journalism, Education' },
]

const heroImages = Array.from({ length: 6 }, (_, i) => `/images/${i + 1}.jpg`)

const facilities = [
  { name: 'Science Laboratories', desc: 'Fully equipped physics, chemistry and biology laboratories for practical learning.', icon: 'M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.113.443-.276.857-.486 1.25M9.75 3.104c.53-.32 1.128-.512 1.759-.58M5 14.5l-.424 2.5A1.5 1.5 0 006.06 19h2.88a1.5 1.5 0 001.485-2l-.423-2.5M18 8.584V4.5a1.5 1.5 0 00-1.5-1.5h-3A1.5 1.5 0 0012 4.5v4.084M18 8.584a3 3 0 01-3 3h-1.5a3 3 0 01-3-3' },
  { name: 'Boys Dormitory', desc: 'Spacious and secure dormitory accommodating over 200 boarding students.', icon: 'M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008z' },
  { name: 'Girls Dormitory', desc: 'Safe and conducive boarding facility for female students with 24-hour matron support.', icon: 'M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008z' },
  { name: 'Library', desc: 'Well-stocked library with textbooks, reference materials, and a quiet reading zone.', icon: 'M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0118 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25' },
  { name: 'Sports Grounds', desc: 'Football pitch, basketball court, volleyball court and athletics track for sports development.', icon: 'M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.048 8.287 8.287 0 009 9.6a8.983 8.983 0 013.361-6.867 8.21 8.21 0 003 2.48z' },
  { name: 'Computer Lab', desc: 'Modern computer laboratory with internet access for IT and research studies.', icon: 'M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0V12a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 12V5.25' },
]

function Landing() {
  const { user, profile, loading } = useAuth()
  const [schoolInfo, setSchoolInfo] = useState(null)
  const [currentSlide, setCurrentSlide] = useState(0)
  const [uniforms, setUniforms] = useState([])
  const [joiningInstructions, setJoiningInstructions] = useState([])
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [stats, setStats] = useState({ oLevel: null, aLevel: null, teachers: null })
  const [headmasterName, setHeadmasterName] = useState('')

  useEffect(() => {
    supabase
      .from('school_settings')
      .select('logo_url, school_name, phone, email, address, region, district')
      .limit(1)
      .then(({ data }) => { if (data?.[0]) setSchoolInfo(data[0]) })
  }, [])

  useEffect(() => {
    const fetchStats = async () => {
      const { data: classes } = await supabase.from('classes').select('id, level')
      const oLevelIds = classes?.filter(c => c.level === 'O_LEVEL').map(c => c.id) || []
      const aLevelIds = classes?.filter(c => c.level === 'A_LEVEL').map(c => c.id) || []

      const [oRes, aRes, tRes] = await Promise.all([
        oLevelIds.length > 0
          ? supabase.from('students').select('*', { count: 'exact', head: true }).in('class_id', oLevelIds).eq('status', 'active')
          : Promise.resolve({ count: 0 }),
        aLevelIds.length > 0
          ? supabase.from('students').select('*', { count: 'exact', head: true }).in('class_id', aLevelIds).eq('status', 'active')
          : Promise.resolve({ count: 0 }),
        supabase.from('teachers').select('*', { count: 'exact', head: true }),
      ])

      setStats({ oLevel: oRes.count ?? null, aLevel: aRes.count ?? null, teachers: tRes.count ?? null })
    }
    fetchStats()
  }, [])

  useEffect(() => {
    supabase
      .from('profiles')
      .select('full_name')
      .eq('role', 'headmaster')
      .not('email', 'ilike', '%@school.com')
      .order('full_name')
      .limit(1)
      .then(({ data }) => { if (data?.[0]?.full_name) setHeadmasterName(data[0].full_name) })
  }, [])

  useEffect(() => {
    supabase.from('uniforms').select('*').order('sort_order').order('created_at').then(({ data }) => {
      if (data) setUniforms(data)
    })
  }, [])

  useEffect(() => {
    supabase.from('joining_instructions').select('*').order('level').then(({ data }) => {
      if (data) setJoiningInstructions(data)
    })
  }, [])

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide(prev => (prev + 1) % heroImages.length)
    }, 10000)
    return () => clearInterval(timer)
  }, [])

  const formatStat = (n, suffix = '+') => n == null ? '—' : `${n}${suffix}`

  return (
    <div className="min-h-screen bg-white">
      {/* ========== NAV ========== */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link to="/" className="flex items-center gap-3">
              {schoolInfo?.logo_url ? (
                <img src={schoolInfo.logo_url} alt="" className="w-10 h-10 object-contain shrink-0" crossOrigin="anonymous" />
              ) : (
                <svg viewBox="0 0 36 36" className="w-9 h-9 shrink-0">
                  <rect width="36" height="36" rx="8" fill="#801818"/>
                  <path d="M18 5l11 7v7c0 5.5-11 11-11 11S7 24.5 7 19v-7l11-7z" fill="#a51d1d" stroke="#fff" strokeWidth="0.8"/>
                  <text x="18" y="22" textAnchor="middle" fill="#fff" fontSize="14" fontWeight="700" fontFamily="Inter">K</text>
                </svg>
              )}
              <div className="hidden sm:block">
                <p className="text-sm font-bold text-gray-900 leading-tight">Kizaga Secondary School</p>
                <p className="text-[10px] text-gray-500 leading-tight">Official Website</p>
              </div>
            </Link>

            <nav className="hidden md:flex items-center gap-6">
              <a href="#about" className="text-sm text-gray-600 hover:text-maroon-600 transition">About</a>
              <a href="#academics" className="text-sm text-gray-600 hover:text-maroon-600 transition">Academics</a>
              <a href="#facilities" className="text-sm text-gray-600 hover:text-maroon-600 transition">Facilities</a>
              <Link to="/events-announcements" className="text-sm text-gray-600 hover:text-maroon-600 transition">Events</Link>
              <Link to="/joining-instructions" className="text-sm text-gray-600 hover:text-maroon-600 transition">Joining Instructions</Link>
              {uniforms.length > 0 && (
                <a href="#uniforms" className="text-sm text-gray-600 hover:text-maroon-600 transition">Sare</a>
              )}
              <a href="#contact" className="text-sm text-gray-600 hover:text-maroon-600 transition">Contact</a>
              <Link to="/results" className="text-sm text-maroon-600 hover:text-maroon-700 font-semibold transition">Angalia Matokeo</Link>
              <Link to="/track-application" className="text-sm text-emerald-600 hover:text-emerald-700 font-medium transition">Fuatilia Ombi</Link>
            </nav>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setMobileMenuOpen(o => !o)}
                aria-label="Toggle menu"
                className="md:hidden p-2 rounded-lg text-gray-600 hover:bg-gray-100 transition"
              >
                {mobileMenuOpen ? (
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                ) : (
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                  </svg>
                )}
              </button>
              {user && profile ? (
                <Link
                  to={profile.role === 'admin' ? '/admin' : profile.role === 'headmaster' ? '/headmaster' : profile.role === 'academic' ? '/academic' : '/teacher'}
                  className="px-4 py-2 text-sm font-medium text-white bg-maroon-600 rounded-lg hover:bg-maroon-700 transition"
                >
                  Dashboard
                </Link>
              ) : (
                <div className="flex items-center gap-2">
                  <Link
                    to="/login"
                    className="px-4 py-2 text-sm font-medium text-maroon-600 border border-maroon-300 rounded-lg hover:bg-maroon-50 transition"
                  >
                    Staff Login
                  </Link>
                  <button
                    onClick={() => window.scrollTo({ top: document.getElementById('contact').offsetTop, behavior: 'smooth' })}
                    className="hidden sm:inline-flex px-4 py-2 text-sm font-medium text-white bg-maroon-600 rounded-lg hover:bg-maroon-700 transition"
                  >
                    Contact Us
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* ========== MOBILE MENU ========== */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-x-0 top-16 bottom-0 z-40 bg-white overflow-y-auto">
          <nav className="px-4 py-3">
            {[
              { href: '#about', label: 'About' },
              { href: '#academics', label: 'Academics' },
              { href: '#facilities', label: 'Facilities' },
            ].map(item => (
              <a
                key={item.href}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center px-4 py-3.5 text-base font-medium text-gray-700 rounded-xl hover:bg-gray-50 transition"
              >
                {item.label}
              </a>
            ))}
            <Link to="/events-announcements" onClick={() => setMobileMenuOpen(false)} className="flex items-center px-4 py-3.5 text-base font-medium text-gray-700 rounded-xl hover:bg-gray-50 transition">Events &amp; Announcements</Link>
            <Link to="/joining-instructions" onClick={() => setMobileMenuOpen(false)} className="flex items-center px-4 py-3.5 text-base font-medium text-gray-700 rounded-xl hover:bg-gray-50 transition">Joining Instructions</Link>
            {uniforms.length > 0 && (
              <a href="#uniforms" onClick={() => setMobileMenuOpen(false)} className="flex items-center px-4 py-3.5 text-base font-medium text-gray-700 rounded-xl hover:bg-gray-50 transition">Sare za Shule</a>
            )}
            <a href="#contact" onClick={() => setMobileMenuOpen(false)} className="flex items-center px-4 py-3.5 text-base font-medium text-gray-700 rounded-xl hover:bg-gray-50 transition">Contact</a>
            <div className="mt-4 pt-4 border-t border-gray-100 space-y-3 px-1">
              <Link to="/results" onClick={() => setMobileMenuOpen(false)} className="flex items-center justify-center py-3.5 text-base font-semibold text-maroon-700 bg-maroon-50 border border-maroon-300 rounded-xl">
                Angalia Matokeo
              </Link>
              <Link to="/track-application" onClick={() => setMobileMenuOpen(false)} className="flex items-center justify-center py-3.5 text-base font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl">
                Fuatilia Ombi
              </Link>
              {user && profile ? (
                <Link
                  to={profile.role === 'admin' ? '/admin' : profile.role === 'headmaster' ? '/headmaster' : profile.role === 'academic' ? '/academic' : '/teacher'}
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center justify-center py-3.5 text-base font-semibold text-white bg-maroon-600 rounded-xl"
                >
                  Dashboard
                </Link>
              ) : (
                <>
                  <Link to="/login" onClick={() => setMobileMenuOpen(false)} className="flex items-center justify-center py-3.5 text-base font-semibold text-maroon-700 bg-maroon-50 border border-maroon-200 rounded-xl">
                    Staff Login
                  </Link>
                  <Link to="/apply" onClick={() => setMobileMenuOpen(false)} className="flex items-center justify-center py-3.5 text-base font-semibold text-white bg-emerald-600 rounded-xl">
                    Tuma Ombi Sasa
                  </Link>
                </>
              )}
            </div>
          </nav>
        </div>
      )}

      {/* ========== RESULTS BANNER ========== */}
      <div className="bg-maroon-700 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between flex-wrap gap-2">
          <p className="text-xs sm:text-sm text-maroon-100">
            <span className="font-semibold text-white">Angalia Matokeo ya Mwanafunzi:</span> Ingiza namba ya udahili kuona matokeo ya mtihani na ulinganisho.
          </p>
          <Link
            to="/results"
            className="shrink-0 px-4 py-1.5 bg-white text-maroon-700 text-xs sm:text-sm font-semibold rounded-lg hover:bg-maroon-50 transition"
          >
            Angalia Matokeo &rarr;
          </Link>
        </div>
      </div>

      {/* ========== TRACK BANNER ========== */}
      <div className="bg-emerald-50 border-b border-emerald-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5 flex items-center justify-between flex-wrap gap-2">
          <p className="text-xs sm:text-sm text-emerald-800">
            <span className="font-medium">Umekwisha tuma ombi?</span> Fuatilia hali ya ombi lako kwa kutumia namba ya ombi.
          </p>
          <Link
            to="/track-application"
            className="text-xs sm:text-sm font-medium text-emerald-700 hover:text-emerald-800 underline underline-offset-2"
          >
            Fuatilia Ombi &rarr;
          </Link>
        </div>
      </div>

      {/* ========== HERO ========== */}
      <section className="relative bg-black text-white overflow-hidden">
        <div className="absolute inset-0">
          {heroImages.map((src, i) => (
            <img
              key={i}
              src={src}
              alt=""
              className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ${i === currentSlide ? 'opacity-100' : 'opacity-0'}`}
              loading="lazy"
            />
          ))}
        </div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-28 lg:py-36">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-white/10 backdrop-blur rounded-full text-xs font-medium text-maroon-100 border border-white/10 mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Karibu | Official Website
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight mb-2 drop-shadow-lg">
              Kizaga Secondary School
            </h1>
            <p className="text-lg sm:text-xl text-white/80 font-medium mb-4 drop-shadow-md">
              Shule ya Sekondari Kizaga
            </p>
            <p className="text-xl sm:text-2xl text-white/90 font-medium italic mb-4 drop-shadow-md">
              &ldquo;Elimu ni Mwangaza wa Maisha&rdquo; &mdash; Education is a Life Enlightener
            </p>
            <p className="text-base sm:text-lg text-white/70 max-w-2xl leading-relaxed mb-8 drop-shadow-md">
              Karibu Kizaga Secondary School &mdash; a leading secondary school in Tanzania offering quality
              O-Level and A-Level education. We nurture disciplined, knowledgeable, and skilled leaders
              through modern facilities, dedicated teachers, and a comprehensive school management system.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                to="/apply"
                className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white font-semibold rounded-xl hover:bg-emerald-700 transition text-sm"
              >
                Tuma Ombi Sasa
              </Link>
              <a
                href="#about"
                className="inline-flex items-center gap-2 px-6 py-3 bg-white text-maroon-800 font-semibold rounded-xl hover:bg-gray-100 transition text-sm"
              >
                Explore More
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                </svg>
              </a>
              {!user && !loading && (
                <Link
                  to="/login"
                  className="inline-flex items-center gap-2 px-6 py-3 border border-white/30 text-white font-semibold rounded-xl hover:bg-white/10 transition text-sm"
                >
                  Staff Login
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
                  </svg>
                </Link>
              )}
            </div>
          </div>
        </div>
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 z-10">
          {heroImages.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrentSlide(i)}
              className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${
                i === currentSlide ? 'bg-white w-6' : 'bg-white/40 hover:bg-white/60'
              }`}
            />
          ))}
        </div>
      </section>

      {/* ========== SCHOOL PROFILE / ABOUT ========== */}
      <section id="about" className="py-16 sm:py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-3">About Kizaga Secondary School &mdash; History, Vision &amp; Mission</h2>
            <div className="w-16 h-1 bg-maroon-600 mx-auto rounded-full" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center mb-16">
            <div>
              <h3 className="text-xl font-semibold text-gray-900 mb-4">School History &amp; Background</h3>
              <div className="space-y-4 text-gray-600 leading-relaxed">
                <p>
                  Kizaga Secondary School (Shule ya Sekondari Kizaga, also known as Kizaga School) was established with a vision to provide quality and accessible
                  secondary education to the community in Tanzania. Over the years, this secondary school has grown from a small
                  institution into a reputable centre of academic excellence, serving both O-Level (Form 1&ndash;4) and
                  A-Level (Form 5&ndash;6) students.
                </p>
                <p>
                  Located in a serene environment conducive for learning, our school in Tanzania boasts modern facilities
                  including science laboratories, a well-equipped library, computer lab, and spacious
                  dormitories for boarding students. Our dedicated team of qualified teachers ensures that
                  every student receives personalized attention and support through our school management system
                  for tracking academic performance and student records.
                </p>
                <p>
                  We take pride in our holistic approach to education (elimu bora), nurturing students not only
                  academically but also in sports, arts, and moral values. Kizaga Secondary School
                  continues to produce outstanding graduates who excel in their chosen fields and contribute
                  to the development of Tanzania.
                </p>
                <p className="text-maroon-600 font-medium text-sm">
                  Karibu Kizaga Secondary School &mdash; Elimu ni Mwangaza wa Maisha.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white rounded-xl border border-gray-200 p-6 text-center">
                <p className="text-3xl font-bold text-maroon-600">{formatStat(stats.oLevel)}</p>
                <p className="text-sm text-gray-500 mt-1">O-Level Students</p>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-6 text-center">
                <p className="text-3xl font-bold text-maroon-600">{formatStat(stats.aLevel)}</p>
                <p className="text-sm text-gray-500 mt-1">A-Level Students</p>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-6 text-center">
                <p className="text-3xl font-bold text-maroon-600">{formatStat(stats.teachers)}</p>
                <p className="text-sm text-gray-500 mt-1">Teachers</p>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-6 text-center">
                <p className="text-3xl font-bold text-maroon-600">95%</p>
                <p className="text-sm text-gray-500 mt-1">Pass Rate</p>
              </div>
            </div>
          </div>

          {/* Vision & Mission */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl border border-gray-200 p-8">
              <div className="w-12 h-12 bg-maroon-100 rounded-xl flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-maroon-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Our Vision &mdash; Maono Yetu</h3>
              <p className="text-gray-600 leading-relaxed">
                To be a leading secondary school in Tanzania, producing competent, disciplined, and
                ethical graduates who are equipped with knowledge, skills, and values to excel in
                higher education and contribute positively to society.
              </p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-8">
              <div className="w-12 h-12 bg-maroon-100 rounded-xl flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-maroon-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.438 60.438 0 0 0-.491 6.347A48.62 48.62 0 0 1 12 20.904a48.62 48.62 0 0 1 8.232-4.41 60.46 60.46 0 0 0-.491-6.347m-15.482 0a50.636 50.636 0 0 0-2.658-.813A59.906 59.906 0 0 1 12 3.493a59.903 59.903 0 0 1 10.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0 1 12 13.489a50.702 50.702 0 0 1 7.74-3.342" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Our Mission &mdash; Dhamira Yetu</h3>
              <p className="text-gray-600 leading-relaxed">
                To provide quality and holistic education through innovative teaching methods, dedicated
                staff, modern resources, and a supportive learning environment that fosters academic
                excellence, character development, and lifelong learning.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ========== ACADEMICS ========== */}
      <section id="academics" className="py-16 sm:py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-3">Academic Programs at Kizaga Secondary School</h2>
            <div className="w-16 h-1 bg-maroon-600 mx-auto rounded-full mb-4" />
            <p className="text-gray-500 max-w-2xl mx-auto">
              We offer a comprehensive secondary school curriculum designed to prepare students for national examinations
              and higher education. Our academic programs combine O-Level and A-Level education with a school management
              system that tracks student records and performance.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
            {/* O-Level */}
            <div className="bg-gray-50 rounded-xl border border-gray-200 p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-maroon-100 rounded-lg flex items-center justify-center">
                  <span className="text-sm font-bold text-maroon-600">O</span>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Ordinary Level &mdash; O-Level Subjects (Form 1&ndash;4)</h3>
                  <p className="text-sm text-gray-500">13 compulsory and optional subjects in our secondary school curriculum</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {subjectsOLevel.map((sub) => (
                  <span key={sub} className="px-3 py-1.5 bg-white rounded-lg border border-gray-200 text-sm text-gray-700">
                    {sub}
                  </span>
                ))}
              </div>
            </div>

            {/* A-Level */}
            <div className="bg-gray-50 rounded-xl border border-gray-200 p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-maroon-100 rounded-lg flex items-center justify-center">
                  <span className="text-sm font-bold text-maroon-600">A</span>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Advanced Level &mdash; A-Level Combinations (Form 5&ndash;6)</h3>
                  <p className="text-sm text-gray-500">Specialized science, arts and business subject combinations</p>
                </div>
              </div>
              <div className="space-y-3">
                {aLevelCombinations.map((combo) => (
                  <div key={combo.name} className="bg-white rounded-lg border border-gray-200 p-4">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-bold text-maroon-600">{combo.name}</span>
                      <span className="text-xs text-gray-400">{combo.career}</span>
                    </div>
                    <p className="text-sm text-gray-600">{combo.subjects}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========== FACILITIES ========== */}
      <section id="facilities" className="py-16 sm:py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-3">School Facilities &amp; Campus Resources</h2>
            <div className="w-16 h-1 bg-maroon-600 mx-auto rounded-full mb-4" />
            <p className="text-gray-500 max-w-2xl mx-auto">
              Our secondary school campus in Tanzania is equipped with modern facilities that support quality education, practical learning, and holistic student development.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {facilities.map((f) => (
              <div key={f.name} className="bg-white rounded-xl border border-gray-200 p-6 flex gap-4 items-start hover:shadow-md transition">
                <div className="w-12 h-12 bg-maroon-100 rounded-xl flex items-center justify-center shrink-0">
                  <svg className="w-6 h-6 text-maroon-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d={f.icon} />
                  </svg>
                </div>
                <div>
                  <h3 className="text-base font-semibold text-gray-900 mb-1">{f.name}</h3>
                  <p className="text-sm text-gray-500 leading-relaxed">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ========== JOINING INSTRUCTIONS ========== */}
      <section id="joining-instructions" className="py-16 sm:py-20 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-3">Joining Instructions</h2>
            <div className="w-16 h-1 bg-maroon-600 mx-auto rounded-full mb-4" />
            <p className="text-gray-500 max-w-2xl mx-auto">
              Download joining instructions for O-Level and A-Level students. All required documents are available below.
            </p>
          </div>

          {joiningInstructions.length === 0 ? (
            <div className="bg-gray-50 rounded-2xl border border-gray-200 p-12 text-center">
              <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <svg className="w-7 h-7 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                </svg>
              </div>
              <p className="text-sm text-gray-500">Joining instructions will appear here once published.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {joiningInstructions.map(rec => {
                const isOLevel = rec.level === 'O_LEVEL'
                const badgeClass = isOLevel ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                const badgeLabel = isOLevel ? 'O-Level' : 'A-Level'
                return (
                  <div key={rec.id} className="bg-gray-50 rounded-2xl border border-gray-200 p-6">
                    <div className="flex items-center gap-2 mb-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold uppercase ${badgeClass}`}>
                        {badgeLabel}
                      </span>
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">{rec.title}</h3>
                    {rec.description && (
                      <p className="text-sm text-gray-500 mb-4">{rec.description}</p>
                    )}
                    {rec.pdf_url ? (
                      <a
                        href={rec.pdf_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-5 py-3 bg-maroon-600 text-white text-sm font-semibold rounded-xl hover:bg-maroon-700 transition"
                      >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                        </svg>
                        Open PDF
                      </a>
                    ) : (
                      <p className="text-sm text-gray-400 italic">PDF not yet uploaded</p>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          <div className="text-center mt-10">
            <Link
              to="/joining-instructions"
              className="inline-flex items-center gap-2 px-6 py-3 border border-maroon-300 text-maroon-600 font-semibold rounded-xl hover:bg-maroon-50 transition text-sm"
            >
              View Full Page
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
              </svg>
            </Link>
          </div>
        </div>
      </section>

      {/* ========== UNIFORMS ========== */}
      {uniforms.length > 0 && (
        <section id="uniforms" className="py-16 sm:py-20 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-3">Sare za Shule</h2>
              <div className="w-16 h-1 bg-maroon-600 mx-auto rounded-full mb-4" />
              <p className="text-gray-500 max-w-2xl mx-auto">
                Kizaga Secondary School ina sare maalum kwa wanafunzi. Wanafunzi wanatakiwa kuvaa sare kamili kila siku.
              </p>
            </div>

            <div className="space-y-10">
              {['SCHOOL','HOSTEL','SHAMBA','SPORTS'].filter(cat => uniforms.some(u => u.category === cat)).map(category => {
                const items = uniforms.filter(u => u.category === category)
                return (
                  <div key={category}>
                    <h3 className="text-xl font-semibold text-gray-800 mb-4 text-center">
                      {category === 'SCHOOL' ? 'Sare za Shule' : category === 'HOSTEL' ? 'Sare za Hostel' : category === 'SHAMBA' ? 'Sare za Shamba' : 'Sare za Michezo'}
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
                      {items.map(u => (
                        <div key={u.id} className="bg-gray-50 rounded-2xl border border-gray-200 overflow-hidden">
                          {u.image_url ? (
                            <div className="aspect-[4/3] bg-gray-100 overflow-hidden">
                              <img src={u.image_url} alt={u.title} className="w-full h-full object-cover" />
                            </div>
                          ) : (
                            <div className="aspect-[4/3] bg-gradient-to-br from-maroon-50 to-maroon-100 flex items-center justify-center p-8">
                              <div className="w-32 h-48 mx-auto bg-white rounded-xl shadow-lg border border-gray-200 flex items-center justify-center">
                                <svg className="w-16 h-16 text-maroon-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
                                </svg>
                              </div>
                            </div>
                          )}
                          <div className="p-5">
                            <h3 className="text-lg font-semibold text-gray-900 mb-2">{u.title}</h3>
                            {u.description && <p className="text-sm text-gray-500 mb-2">{u.description}</p>}
                            {Array.isArray(u.items) && u.items.length > 0 && (
                              <ul className="space-y-1.5 text-sm text-gray-600">
                                {u.items.map((item, i) => (
                                  <li key={i} className="flex items-center gap-2">
                                    <span className="w-1.5 h-1.5 rounded-full bg-maroon-500 shrink-0"></span>
                                    {item}
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </section>
      )}

      {/* ========== HEADMISTRESS ========== */}
      <section className="relative py-20 sm:py-28 bg-maroon-700 overflow-hidden">
        {/* Decorative background circles */}
        <div className="absolute top-0 left-0 w-72 h-72 bg-white/5 rounded-full -translate-x-1/2 -translate-y-1/2 pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-white/5 rounded-full translate-x-1/3 translate-y-1/3 pointer-events-none" />
        <div className="absolute top-1/2 right-12 w-32 h-32 bg-white/5 rounded-full -translate-y-1/2 pointer-events-none" />

        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Section label */}
          <div className="text-center mb-10">
            <p className="text-maroon-300 text-xs font-semibold uppercase tracking-[0.2em] mb-3">Message from</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-white">The Headmistress</h2>
            <div className="w-12 h-0.5 bg-maroon-400 mx-auto mt-4" />
          </div>

          {/* Quote card */}
          <div className="relative bg-white/10 backdrop-blur-sm border border-white/15 rounded-2xl px-8 sm:px-14 py-12">
            {/* Opening quote badge */}
            <div className="absolute -top-5 left-10 w-10 h-10 bg-maroon-500 rounded-full flex items-center justify-center shadow-lg border-2 border-maroon-400">
              <span className="text-white text-2xl font-bold leading-none" style={{ fontFamily: 'Georgia, serif' }}>"</span>
            </div>

            <blockquote className="text-white/90 text-lg sm:text-xl leading-relaxed italic text-center">
              At Kizaga Secondary School, we believe every student has the potential to excel.
              Our dedicated team of educators works tirelessly to create a nurturing environment
              where academic excellence, character development, and personal growth go hand in hand.
              We invite you to join our community and be part of our success story.
            </blockquote>

            {/* Divider with icon */}
            <div className="flex items-center gap-4 my-8">
              <div className="flex-1 h-px bg-white/20" />
              <svg className="w-5 h-5 text-maroon-300 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.438 60.438 0 0 0-.491 6.347A48.62 48.62 0 0 1 12 20.904a48.62 48.62 0 0 1 8.232-4.41 60.46 60.46 0 0 0-.491-6.347m-15.482 0a50.636 50.636 0 0 0-2.658-.813A59.906 59.906 0 0 1 12 3.493a59.903 59.903 0 0 1 10.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0 1 12 13.489a50.702 50.702 0 0 1 7.74-3.342" />
              </svg>
              <div className="flex-1 h-px bg-white/20" />
            </div>

            {/* Attribution */}
            <div className="text-center">
              <p className="text-white font-bold text-lg tracking-wide">{headmasterName || 'Head of School'}</p>
              <p className="text-maroon-300 text-sm mt-1">Headmistress &mdash; Kizaga Secondary School</p>
            </div>
          </div>
        </div>
      </section>

      {/* ========== CONTACT ========== */}
      <section id="contact" className="py-16 sm:py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-3">Contact Kizaga Secondary School</h2>
            <div className="w-16 h-1 bg-maroon-600 mx-auto rounded-full mb-4" />
            <p className="text-gray-500 max-w-2xl mx-auto">
              Get in touch with us for inquiries, admissions, or any information about our secondary school in Tanzania.
              Wasiliana nasi kwa maswali, uandikishaji, au taarifa zozote kuhusu shule yetu.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-4xl mx-auto">
            {/* Location */}
            <a href="https://maps.google.com/?q=Kizaga+Ulemo+Tanzania" target="_blank" rel="noopener noreferrer"
               className="bg-gray-50 rounded-xl border border-gray-200 p-5 hover:border-maroon-300 hover:bg-maroon-50/30 transition flex gap-4 items-start">
              <div className="w-10 h-10 bg-maroon-100 rounded-xl flex items-center justify-center shrink-0">
                <svg className="w-5 h-5 text-maroon-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">Location</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {schoolInfo?.address || 'Kizaga, Ulemo, Tanzania'}
                  {schoolInfo?.district && `, ${schoolInfo.district}`}
                  {schoolInfo?.region && `, ${schoolInfo.region}`}
                </p>
                <p className="text-xs text-maroon-600 mt-1">View on Maps &rarr;</p>
              </div>
            </a>

            {/* Email */}
            <a href={`mailto:${schoolInfo?.email || 'kizagasec2024@gmail.com'}`}
               className="bg-gray-50 rounded-xl border border-gray-200 p-5 hover:border-maroon-300 hover:bg-maroon-50/30 transition flex gap-4 items-start">
              <div className="w-10 h-10 bg-maroon-100 rounded-xl flex items-center justify-center shrink-0">
                <svg className="w-5 h-5 text-maroon-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                </svg>
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-900">Email Us</p>
                <p className="text-xs text-maroon-600 mt-0.5 truncate">{schoolInfo?.email || 'kizagasec2024@gmail.com'}</p>
              </div>
            </a>

            {/* Headmistress */}
            <div className="bg-gray-50 rounded-xl border border-gray-200 p-5">
              <p className="text-sm font-semibold text-gray-900 mb-3">Headmistress</p>
              <div className="flex items-center gap-2">
                <a href="tel:+255713834401" className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-maroon-100 text-maroon-700 rounded-lg text-xs font-medium hover:bg-maroon-200 transition">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" /></svg>
                  Call
                </a>
                <a href="https://wa.me/255713834401" target="_blank" rel="noopener noreferrer" className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-green-100 text-green-700 rounded-lg text-xs font-medium hover:bg-green-200 transition">
                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" /></svg>
                  WhatsApp
                </a>
              </div>
            </div>

            {/* Second Master */}
            <div className="bg-gray-50 rounded-xl border border-gray-200 p-5">
              <p className="text-sm font-semibold text-gray-900 mb-3">Second Master</p>
              <div className="flex items-center gap-2">
                <a href="tel:+255710496118" className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-maroon-100 text-maroon-700 rounded-lg text-xs font-medium hover:bg-maroon-200 transition">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" /></svg>
                  Call
                </a>
                <a href="https://wa.me/255710496118" target="_blank" rel="noopener noreferrer" className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-green-100 text-green-700 rounded-lg text-xs font-medium hover:bg-green-200 transition">
                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" /></svg>
                  WhatsApp
                </a>
              </div>
            </div>

            {/* Academic Master */}
            <div className="bg-gray-50 rounded-xl border border-gray-200 p-5">
              <p className="text-sm font-semibold text-gray-900 mb-3">Academic Master</p>
              <div className="flex items-center gap-2">
                <a href="tel:+255676155601" className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-maroon-100 text-maroon-700 rounded-lg text-xs font-medium hover:bg-maroon-200 transition">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" /></svg>
                  Call
                </a>
                <a href="https://wa.me/255676155601" target="_blank" rel="noopener noreferrer" className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-green-100 text-green-700 rounded-lg text-xs font-medium hover:bg-green-200 transition">
                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" /></svg>
                  WhatsApp
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========== FOOTER ========== */}
      <footer className="bg-gray-900 text-gray-400">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center gap-3 mb-4">
                {schoolInfo?.logo_url ? (
                  <div className="w-10 h-10 bg-white/10 backdrop-blur-sm rounded-lg flex items-center justify-center border border-white/20 p-1.5 shrink-0">
                    <img src={schoolInfo.logo_url} alt="" className="w-full h-full object-contain" crossOrigin="anonymous" />
                  </div>
                ) : (
                  <svg viewBox="0 0 36 36" className="w-9 h-9 shrink-0">
                    <rect width="36" height="36" rx="8" fill="#801818"/>
                    <path d="M18 5l11 7v7c0 5.5-11 11-11 11S7 24.5 7 19v-7l11-7z" fill="#a51d1d" stroke="#fff" strokeWidth="0.8"/>
                    <text x="18" y="22" textAnchor="middle" fill="#fff" fontSize="14" fontWeight="700" fontFamily="Inter">K</text>
                  </svg>
                )}
                <div>
                  <p className="text-sm font-bold text-white leading-tight">Kizaga Secondary School</p>
                  <p className="text-xs text-gray-500">Official Website</p>
                </div>
              </div>
              <p className="text-sm text-gray-500 leading-relaxed">
                Kizaga Secondary School &mdash; a leading secondary school in Tanzania dedicated to
                quality O-Level and A-Level education, nurturing disciplined and knowledgeable leaders
                through modern facilities and a comprehensive school management system.
              </p>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-white mb-4">Quick Links</h3>
              <ul className="space-y-2">
                <li><a href="#about" className="text-sm text-gray-400 hover:text-white transition">About Us</a></li>
                <li><a href="#academics" className="text-sm text-gray-400 hover:text-white transition">Academics</a></li>
                <li><a href="#facilities" className="text-sm text-gray-400 hover:text-white transition">Facilities</a></li>
                {uniforms.length > 0 && (
                  <li><a href="#uniforms" className="text-sm text-gray-400 hover:text-white transition">Sare za Shule</a></li>
                )}
                <li><Link to="/apply" className="text-sm text-gray-400 hover:text-white transition">Tuma Ombi</Link></li>
                <li><Link to="/joining-instructions" className="text-sm text-gray-400 hover:text-white transition">Maelekezo ya Kujiunga</Link></li>
                <li><Link to="/events-announcements" className="text-sm text-gray-400 hover:text-white transition">Matukio na Matangazo</Link></li>
                <li><Link to="/results" className="text-sm text-gray-400 hover:text-white transition">Angalia Matokeo</Link></li>
                <li><Link to="/track-application" className="text-sm text-gray-400 hover:text-white transition">Fuatilia Ombi</Link></li>
              </ul>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-white mb-4">Academics</h3>
              <ul className="space-y-2">
                <li><a href="#academics" className="text-sm text-gray-400 hover:text-white transition">O-Level Subjects</a></li>
                <li><a href="#academics" className="text-sm text-gray-400 hover:text-white transition">A-Level Combinations</a></li>
                <li><Link to="/joining-instructions" className="text-sm text-gray-400 hover:text-white transition">Joining Instructions</Link></li>
                <li><Link to="/results" className="text-sm text-gray-400 hover:text-white transition">Exam Results</Link></li>
              </ul>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-white mb-4">Contact</h3>
              <ul className="space-y-2 text-sm text-gray-400">
                {(schoolInfo?.address || schoolInfo?.district || schoolInfo?.region) ? (
                  <li>
                    {[schoolInfo.address, schoolInfo.district, schoolInfo.region].filter(Boolean).join(', ')}
                  </li>
                ) : (
                  <li>Kizaga, Ulemo, Tanzania</li>
                )}
                {schoolInfo?.phone && <li>{schoolInfo.phone}</li>}
                {schoolInfo?.email && <li>{schoolInfo.email}</li>}
              </ul>
              <div className="flex items-center gap-3 mt-4">
                <Link
                  to="/login"
                  className="px-4 py-2 text-xs font-medium text-white bg-maroon-600 rounded-lg hover:bg-maroon-700 transition"
                >
                  Staff Login
                </Link>
              </div>
            </div>
          </div>

          <div className="border-t border-gray-800 mt-10 pt-8 text-center">
            <p className="text-sm text-gray-500">
              &copy; {new Date().getFullYear()} Kizaga Secondary School. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default Landing
