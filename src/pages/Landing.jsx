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
  { name: 'Science Laboratories', desc: 'Fully equipped physics, chemistry and biology laboratories for practical learning.', image: 'https://placehold.co/600x400/801818/ffffff?text=Science+Labs', icon: 'M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.113.443-.276.857-.486 1.25M9.75 3.104c.53-.32 1.128-.512 1.759-.58M5 14.5l-.424 2.5A1.5 1.5 0 006.06 19h2.88a1.5 1.5 0 001.485-2l-.423-2.5M18 8.584V4.5a1.5 1.5 0 00-1.5-1.5h-3A1.5 1.5 0 0012 4.5v4.084M18 8.584a3 3 0 01-3 3h-1.5a3 3 0 01-3-3' },
  { name: 'Boys Dormitory', desc: 'Spacious and secure dormitory accommodating over 200 boarding students.', image: 'https://placehold.co/600x400/801818/ffffff?text=Boys+Dormitory', icon: 'M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008z' },
  { name: 'Girls Dormitory', desc: 'Safe and conducive boarding facility for female students with 24-hour matron support.', image: 'https://placehold.co/600x400/801818/ffffff?text=Girls+Dormitory', icon: 'M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008z' },
  { name: 'Library', desc: 'Well-stocked library with textbooks, reference materials, and a quiet reading zone.', image: 'https://placehold.co/600x400/801818/ffffff?text=Library', icon: 'M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25' },
  { name: 'Sports Grounds', desc: 'Football pitch, basketball court, volleyball court and athletics track for sports development.', image: 'https://placehold.co/600x400/801818/ffffff?text=Sports+Grounds', icon: 'M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.048 8.287 8.287 0 009 9.6a8.983 8.983 0 013.361-6.867 8.21 8.21 0 003 2.48z' },
  { name: 'Computer Lab', desc: 'Modern computer laboratory with internet access for IT and research studies.', image: 'https://placehold.co/600x400/801818/ffffff?text=Computer+Lab', icon: 'M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0V12a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 12V5.25' },
]

function Landing() {
  const { user, profile, loading } = useAuth()
  const [schoolInfo, setSchoolInfo] = useState(null)
  const [currentSlide, setCurrentSlide] = useState(0)

  useEffect(() => {
    supabase.from('school_settings').select('logo_url, school_name').limit(1).then(({ data }) => {
      if (data?.[0]) setSchoolInfo(data[0])
    })
  }, [])

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide(prev => (prev + 1) % heroImages.length)
    }, 10000)
    return () => clearInterval(timer)
  }, [])

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
              <a href="#results" className="text-sm text-gray-600 hover:text-maroon-600 transition">Results</a>
              <a href="#contact" className="text-sm text-gray-600 hover:text-maroon-600 transition">Contact</a>
            </nav>

            <div className="flex items-center gap-3">
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

      {/* ========== HERO ========== */}
      <section className="relative bg-black text-white overflow-hidden">
        {/* Slideshow images */}
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
        {/* Dots */}
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
                <p className="text-3xl font-bold text-maroon-600">500+</p>
                <p className="text-sm text-gray-500 mt-1">Students</p>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-6 text-center">
                <p className="text-3xl font-bold text-maroon-600">30+</p>
                <p className="text-sm text-gray-500 mt-1">Teachers</p>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-6 text-center">
                <p className="text-3xl font-bold text-maroon-600">15+</p>
                <p className="text-sm text-gray-500 mt-1">Years</p>
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
              <div key={f.name} className="bg-white rounded-xl border border-gray-200 overflow-hidden group">
                <div className="relative h-48 bg-gray-100 overflow-hidden">
                  <img
                    src={f.image}
                    alt={`${f.name} at Kizaga Secondary School`}
                    className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                  <div className="absolute bottom-3 left-3">
                    <div className="w-8 h-8 bg-white/90 backdrop-blur rounded-lg flex items-center justify-center">
                      <svg className="w-4 h-4 text-maroon-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d={f.icon} />
                      </svg>
                    </div>
                  </div>
                </div>
                <div className="p-5">
                  <h3 className="text-base font-semibold text-gray-900 mb-2">{f.name}</h3>
                  <p className="text-sm text-gray-500 leading-relaxed">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ========== RESULTS ========== */}
      <section id="results" className="py-16 sm:py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-3">Student Results &amp; Academic Performance Tracking</h2>
            <div className="w-16 h-1 bg-maroon-600 mx-auto rounded-full mb-4" />
            <p className="text-gray-500 max-w-2xl mx-auto">
              Track and manage student academic performance, examination results, and generate comprehensive reports
              through our online school management system.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
            <div className="bg-gray-50 rounded-xl border border-gray-200 p-6 text-center">
              <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-sm font-semibold text-gray-900 mb-1">Real-Time Student Performance Tracking</h3>
              <p className="text-xs text-gray-500">Monitor student progress and academic performance throughout the year</p>
            </div>
            <div className="bg-gray-50 rounded-xl border border-gray-200 p-6 text-center">
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                </svg>
              </div>
              <h3 className="text-sm font-semibold text-gray-900 mb-1">Academic Report Generation</h3>
              <p className="text-xs text-gray-500">Generate comprehensive student academic reports and transcripts instantly</p>
            </div>
            <div className="bg-gray-50 rounded-xl border border-gray-200 p-6 text-center">
              <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
                </svg>
              </div>
              <h3 className="text-sm font-semibold text-gray-900 mb-1">Performance Analytics &amp; Insights</h3>
              <p className="text-xs text-gray-500">Analyze class and individual student performance trends with data-driven insights</p>
            </div>
          </div>

          <div className="text-center">
            {user && profile ? (
              <Link
                to={profile.role === 'teacher' ? '/teacher' : '/academic'}
                className="inline-flex items-center gap-2 px-6 py-3 bg-maroon-600 text-white font-semibold rounded-xl hover:bg-maroon-700 transition text-sm"
              >
                Go to Dashboard
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                </svg>
              </Link>
            ) : (
              <Link
                to="/login"
                className="inline-flex items-center gap-2 px-6 py-3 bg-maroon-600 text-white font-semibold rounded-xl hover:bg-maroon-700 transition text-sm"
              >
                Staff Login &mdash; Access Student Results
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                </svg>
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* ========== HEADMASTER ========== */}
      <section className="py-16 sm:py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center">
            <div className="w-20 h-20 bg-maroon-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-10 h-10 text-maroon-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.438 60.438 0 0 0-.491 6.347A48.62 48.62 0 0 1 12 20.904a48.62 48.62 0 0 1 8.232-4.41 60.46 60.46 0 0 0-.491-6.347m-15.482 0a50.636 50.636 0 0 0-2.658-.813A59.906 59.906 0 0 1 12 3.493a59.903 59.903 0 0 1 10.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0 1 12 13.489a50.702 50.702 0 0 1 7.74-3.342" />
              </svg>
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">Message from the Head of School &mdash; Kizaga Secondary School</h2>
            <div className="w-16 h-1 bg-maroon-600 mx-auto rounded-full mb-6" />
            <blockquote className="text-gray-600 leading-relaxed italic mb-6">
              &ldquo;At Kizaga Secondary School, we believe every student has the potential to excel. Our
              dedicated team of educators works tirelessly to create a nurturing environment where
              academic excellence, character development, and personal growth go hand in hand. We
              invite you to join our community and be part of our success story.&rdquo;
            </blockquote>
            <p className="text-sm font-semibold text-gray-900">Head of School</p>
            <p className="text-xs text-gray-500">Kizaga Secondary School</p>
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

          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 max-w-3xl mx-auto">
            <a href="https://maps.google.com/?q=Kizaga+ya+Ulemo+Tanzania" target="_blank" rel="noopener noreferrer" className="bg-gray-50 rounded-xl border border-gray-200 p-4 text-center hover:border-maroon-300 hover:bg-maroon-50/30 transition block">
              <div className="w-7 h-7 bg-maroon-100 rounded-lg flex items-center justify-center mx-auto mb-2">
                <svg className="w-3.5 h-3.5 text-maroon-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                </svg>
              </div>
              <h3 className="text-xs font-semibold text-gray-900">Location</h3>
            </a>
            <a href="mailto:kizagasec2024@gmail.com" className="bg-gray-50 rounded-xl border border-gray-200 p-4 text-center hover:border-maroon-300 hover:bg-maroon-50/30 transition block">
              <div className="w-7 h-7 bg-maroon-100 rounded-lg flex items-center justify-center mx-auto mb-2">
                <svg className="w-3.5 h-3.5 text-maroon-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                </svg>
              </div>
              <h3 className="text-xs font-semibold text-gray-900">Email</h3>
            </a>
            <div className="bg-gray-50 rounded-xl border border-gray-200 p-4 text-center">
              <h3 className="text-xs font-semibold text-gray-900 mb-2">Headmistress</h3>
              <div className="flex items-center justify-center gap-2">
                <a href="tel:+255713834401" className="w-7 h-7 bg-maroon-100 rounded-lg flex items-center justify-center hover:bg-maroon-200 transition">
                  <svg className="w-3.5 h-3.5 text-maroon-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
                  </svg>
                </a>
                <a href="https://wa.me/255713834401" target="_blank" rel="noopener noreferrer" className="w-7 h-7 bg-green-100 rounded-lg flex items-center justify-center hover:bg-green-200 transition">
                  <svg className="w-3.5 h-3.5 text-green-600" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                  </svg>
                </a>
              </div>
            </div>
            <div className="bg-gray-50 rounded-xl border border-gray-200 p-4 text-center">
              <h3 className="text-xs font-semibold text-gray-900 mb-2">Second Master</h3>
              <div className="flex items-center justify-center gap-2">
                <a href="tel:+255710496118" className="w-7 h-7 bg-maroon-100 rounded-lg flex items-center justify-center hover:bg-maroon-200 transition">
                  <svg className="w-3.5 h-3.5 text-maroon-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
                  </svg>
                </a>
                <a href="https://wa.me/255710496118" target="_blank" rel="noopener noreferrer" className="w-7 h-7 bg-green-100 rounded-lg flex items-center justify-center hover:bg-green-200 transition">
                  <svg className="w-3.5 h-3.5 text-green-600" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                  </svg>
                </a>
              </div>
            </div>
            <div className="bg-gray-50 rounded-xl border border-gray-200 p-4 text-center">
              <h3 className="text-xs font-semibold text-gray-900 mb-2">Academic Master</h3>
              <div className="flex items-center justify-center gap-2">
                <a href="tel:+255676155601" className="w-7 h-7 bg-maroon-100 rounded-lg flex items-center justify-center hover:bg-maroon-200 transition">
                  <svg className="w-3.5 h-3.5 text-maroon-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
                  </svg>
                </a>
                <a href="https://wa.me/255676155601" target="_blank" rel="noopener noreferrer" className="w-7 h-7 bg-green-100 rounded-lg flex items-center justify-center hover:bg-green-200 transition">
                  <svg className="w-3.5 h-3.5 text-green-600" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                  </svg>
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
                <li><a href="#results" className="text-sm text-gray-400 hover:text-white transition">Results</a></li>
                <li><a href="#contact" className="text-sm text-gray-400 hover:text-white transition">Contact</a></li>
              </ul>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-white mb-4">Academics</h3>
              <ul className="space-y-2">
                <li><a href="#" className="text-sm text-gray-400 hover:text-white transition">O-Level Subjects</a></li>
                <li><a href="#" className="text-sm text-gray-400 hover:text-white transition">A-Level Combinations</a></li>
                <li><a href="#" className="text-sm text-gray-400 hover:text-white transition">Examinations</a></li>
                <li><a href="#" className="text-sm text-gray-400 hover:text-white transition">Academic Calendar</a></li>
              </ul>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-white mb-4">Contact</h3>
              <ul className="space-y-2 text-sm text-gray-400">
                <li>Kizaga, Tanzania</li>
                <li>+255 712 345 678</li>
                <li>+255 765 432 100</li>
                <li>info@kizaga-school.ac.tz</li>
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
