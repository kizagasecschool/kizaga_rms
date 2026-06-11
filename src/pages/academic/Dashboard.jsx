import { useAuth } from '../../context/AuthContext'

function AcademicDashboard() {
  const { profile } = useAuth()

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Academic Dashboard</h1>
        <p className="text-gray-500 mt-1">Welcome, {profile?.full_name}. Manage academic records.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {[
          { label: 'Active Students', value: '--', color: 'bg-indigo-50 text-indigo-600' },
          { label: 'Results Entered', value: '--', color: 'bg-emerald-50 text-emerald-600' },
          { label: 'Upcoming Exams', value: '--', color: 'bg-amber-50 text-amber-600' },
          { label: 'Subjects', value: '--', color: 'bg-rose-50 text-rose-600' },
        ].map((stat) => (
          <div key={stat.label} className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-sm transition">
            <div className={`w-10 h-10 rounded-lg ${stat.color} flex items-center justify-center mb-3`}>
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
              </svg>
            </div>
            <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
            <p className="text-sm text-gray-500 mt-1">{stat.label}</p>
          </div>
        ))}
      </div>

      <div className="mt-8 bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[
            'Enter Results', 'Manage Students', 'Create Exam', 'View Reports', 'Print Report Cards', 'Manage Subjects'
          ].map((action) => (
            <button
              key={action}
              className="text-left px-4 py-3 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:border-indigo-300 hover:text-indigo-600 hover:bg-indigo-50/50 transition"
            >
              {action}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

export default AcademicDashboard
