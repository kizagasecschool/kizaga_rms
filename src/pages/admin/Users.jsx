import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import Modal from '../../components/Modal'
import { useNotification } from '../../context/NotificationContext'
import ErrorBoundary from '../../components/ErrorBoundary'

const ROLES = ['admin', 'headmaster', 'academic', 'teacher']

function Users() {
  const { showToast } = useNotification()
  const [loading, setLoading] = useState(true)
  const [users, setUsers] = useState([])
  const [teachers, setTeachers] = useState([])
  const [search, setSearch] = useState('')
  const [filterRole, setFilterRole] = useState('')

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [formData, setFormData] = useState({})
  const [saving, setSaving] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(null)

  const fetchUsers = useCallback(async () => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false })
    if (data) setUsers(data)
  }, [])

  const fetchTeachers = useCallback(async () => {
    const { data } = await supabase
      .from('teachers')
      .select('id, profile_id, employee_number, qualification, phone, status')
    if (data) setTeachers(data)
  }, [])

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        await Promise.all([fetchUsers(), fetchTeachers()])
      } catch (err) {
        console.error('Load error:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [fetchUsers, fetchTeachers])

  const getTeacherData = (profileId) => {
    return teachers.find(t => t.profile_id === profileId) || null
  }

  const filtered = users.filter((u) => {
    const q = search.toLowerCase()
    if (q && !u.full_name?.toLowerCase().includes(q) && !u.email?.toLowerCase().includes(q)) return false
    if (filterRole && u.role !== filterRole) return false
    return true
  })

  const openCreate = () => {
    setEditing(null)
    setFormData({
      email: '',
      password: '',
      full_name: '',
      role: 'teacher',
      employee_number: '',
      qualification: '',
      phone: '',
    })
    setFormOpen(true)
  }

  const openEdit = (user) => {
    const teacher = getTeacherData(user.id)
    setEditing(user)
    setFormData({
      email: user.email || '',
      password: '',
      full_name: user.full_name || '',
      role: user.role || 'teacher',
      employee_number: teacher?.employee_number || '',
      qualification: teacher?.qualification || '',
      phone: teacher?.phone || '',
      status: teacher?.status || 'active',
    })
    setFormOpen(true)
  }

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      if (editing) {
        const updates = {
          email: formData.email,
          full_name: formData.full_name,
          role: formData.role,
        }

        const { error: profileErr } = await supabase
          .from('profiles')
          .update(updates)
          .eq('id', editing.id)
        if (profileErr) throw profileErr

        if (formData.role === 'teacher') {
          const existingTeacher = getTeacherData(editing.id)
          if (existingTeacher) {
            const { error: teacherErr } = await supabase
              .from('teachers')
              .update({
                employee_number: formData.employee_number,
                qualification: formData.qualification || null,
                phone: formData.phone || null,
                status: formData.status,
              })
              .eq('id', existingTeacher.id)
            if (teacherErr) throw teacherErr
          } else {
            const { error: teacherErr } = await supabase
              .from('teachers')
              .insert({
                employee_number: formData.employee_number,
                profile_id: editing.id,
                qualification: formData.qualification || null,
                phone: formData.phone || null,
                status: 'active',
              })
            if (teacherErr) throw teacherErr
          }
        }

        await fetchUsers()
        await fetchTeachers()
        setFormOpen(false)
        showToast('User updated successfully', 'success')
      } else {
        const res = await fetch('/api/register-user', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: formData.email,
            password: formData.password,
            full_name: formData.full_name,
            role: formData.role,
            employee_number: formData.employee_number || null,
            qualification: formData.qualification || null,
            phone: formData.phone || null,
          }),
        })

        const text = await res.text()
        let result
        try {
          result = JSON.parse(text)
        } catch {
          throw new Error(text || `Server returned ${res.status}`)
        }

        if (!res.ok) {
          throw new Error(result.error || 'Failed to register user')
        }

        await fetchUsers()
        await fetchTeachers()
        setFormOpen(false)
        showToast('User registered successfully', 'success')
      }
    } catch (err) {
      console.error('Save error:', err)
      showToast('Failed to save. ' + (err.message || ''), 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (user) => {
    try {
      const teacher = getTeacherData(user.id)
      if (teacher) {
        const { error: teacherErr } = await supabase.from('teachers').delete().eq('id', teacher.id)
        if (teacherErr) throw teacherErr
      }

      const { error: profileErr } = await supabase.from('profiles').delete().eq('id', user.id)
      if (profileErr) throw profileErr

      await fetchUsers()
      await fetchTeachers()
      setDeleteConfirm(null)
      showToast('User deleted successfully', 'success')
    } catch (err) {
      console.error('Delete error:', err)
      showToast('Failed to delete. ' + (err.message || ''), 'error')
    }
  }

  const roleBadgeClass = (role) => {
    const map = {
      admin: 'bg-purple-50 text-purple-700',
      headmaster: 'bg-blue-50 text-blue-700',
      academic: 'bg-amber-50 text-amber-700',
      teacher: 'bg-emerald-50 text-emerald-700',
    }
    return map[role] || 'bg-gray-100 text-gray-600'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-3 border-gray-200 border-t-maroon-600 rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <ErrorBoundary>
    <div>
      <div className="mb-8 flex flex-col sm:flex-row items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
          <p className="text-gray-500 mt-1">Manage all system users: admins, headmasters, academic staff, and teachers.</p>
        </div>
        <button
          onClick={openCreate}
          className="px-4 py-2 bg-maroon-600 text-white text-sm font-medium rounded-lg hover:bg-maroon-700 transition"
        >
          + Add User
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-100 space-y-3 sm:space-y-0 sm:flex sm:items-center sm:gap-3">
          <div className="flex-1 relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or email..."
              className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-maroon-500 focus:border-maroon-500"
            />
          </div>
          <select
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-maroon-500"
          >
            <option value="">All Roles</option>
            {ROLES.map((r) => (
              <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>
            ))}
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Full Name</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Email</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Role</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Employee #</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-sm text-gray-400">
                    {search || filterRole ? 'No matching users found.' : 'No users registered yet.'}
                  </td>
                </tr>
              )}
              {filtered.map((u) => {
                const teacher = getTeacherData(u.id)
                return (
                  <tr key={u.id} className="hover:bg-gray-50 transition">
                    <td className="px-5 py-3.5">
                      <p className="text-sm font-medium text-gray-900">{u.full_name || 'Unknown'}</p>
                    </td>
                    <td className="px-5 py-3.5 text-sm text-gray-600">{u.email || '-'}</td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${roleBadgeClass(u.role)}`}>
                        {u.role ? u.role.charAt(0).toUpperCase() + u.role.slice(1) : 'Unknown'}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      {teacher ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700">
                          {teacher.employee_number}
                        </span>
                      ) : (
                        <span className="text-sm text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <button
                        onClick={() => openEdit(u)}
                        className="text-sm text-maroon-600 hover:text-maroon-800 font-medium mr-3"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => setDeleteConfirm(u)}
                        className="text-sm text-red-500 hover:text-red-700 font-medium"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <div className="px-5 py-3 border-t border-gray-100 bg-gray-50 flex items-center justify-between">
          <span className="text-xs text-gray-500">{filtered.length} user(s)</span>
        </div>
      </div>

      {/* Add/Edit Modal */}
      <Modal isOpen={formOpen} onClose={() => setFormOpen(false)} title="" className="max-w-2xl">
        <div className="border-b border-gray-100 px-6 py-4 -mx-6 -mt-6 mb-6 bg-maroon-50/50 rounded-t-xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-maroon-100 rounded-xl flex items-center justify-center">
              <svg className="w-5 h-5 text-maroon-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">{editing ? 'Edit User' : 'Register New User'}</h2>
              <p className="text-sm text-gray-500">{editing ? 'Update the user\'s information below' : 'Fill in the user\'s details below'}</p>
            </div>
          </div>
        </div>
        <form onSubmit={handleSave} className="space-y-6">
          <div className="bg-gray-50/50 rounded-xl p-5 border border-gray-100">
            <div className="flex items-center gap-2 mb-4">
              <svg className="w-4 h-4 text-maroon-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
              </svg>
              <span className="text-sm font-semibold text-gray-800">User Information</span>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Full Name <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  required
                  value={formData.full_name || ''}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-sm outline-none focus:border-maroon-400 focus:ring-4 focus:ring-maroon-500/10 transition placeholder:text-gray-400"
                  placeholder="e.g. John Doe"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Role <span className="text-red-500">*</span></label>
                <select
                  value={formData.role || 'teacher'}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-sm outline-none focus:border-maroon-400 focus:ring-4 focus:ring-maroon-500/10 transition"
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Email <span className="text-red-500">*</span></label>
                <input
                  type="email"
                  required
                  value={formData.email || ''}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-sm outline-none focus:border-maroon-400 focus:ring-4 focus:ring-maroon-500/10 transition placeholder:text-gray-400"
                  placeholder="e.g. user@school.ac.tz"
                />
              </div>
              {!editing && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">Password <span className="text-red-500">*</span></label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={formData.password || ''}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-sm outline-none focus:border-maroon-400 focus:ring-4 focus:ring-maroon-500/10 transition placeholder:text-gray-400"
                    placeholder="Min. 6 characters"
                  />
                </div>
              )}
            </div>
          </div>

          {(formData.role === 'teacher' || (editing && getTeacherData(editing.id))) && (
            <div className="bg-gray-50/50 rounded-xl p-5 border border-gray-100">
              <div className="flex items-center gap-2 mb-4">
                <svg className="w-4 h-4 text-maroon-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.438 60.438 0 0 0-.491 6.347A48.62 48.62 0 0 1 12 20.904a48.62 48.62 0 0 1 8.232-4.41 60.46 60.46 0 0 0-.491-6.347m-15.482 0a50.636 50.636 0 0 0-2.658-.813A59.906 59.906 0 0 1 12 3.493a59.903 59.903 0 0 1 10.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0 1 12 13.489a50.702 50.702 0 0 1 7.74-3.342" />
                </svg>
                <span className="text-sm font-semibold text-gray-800">Teacher Details</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">Employee Number <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    required
                    value={formData.employee_number || ''}
                    onChange={(e) => setFormData({ ...formData, employee_number: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-sm outline-none focus:border-maroon-400 focus:ring-4 focus:ring-maroon-500/10 transition placeholder:text-gray-400"
                    placeholder="e.g. T001"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">Qualification</label>
                  <input
                    type="text"
                    value={formData.qualification || ''}
                    onChange={(e) => setFormData({ ...formData, qualification: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-sm outline-none focus:border-maroon-400 focus:ring-4 focus:ring-maroon-500/10 transition placeholder:text-gray-400"
                    placeholder="e.g. B.Ed, MSc"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">Phone Number</label>
                  <input
                    type="text"
                    value={formData.phone || ''}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-sm outline-none focus:border-maroon-400 focus:ring-4 focus:ring-maroon-500/10 transition placeholder:text-gray-400"
                    placeholder="e.g. +255712345678"
                  />
                </div>
                {editing && (
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1.5">Status</label>
                    <select
                      value={formData.status || 'active'}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-sm outline-none focus:border-maroon-400 focus:ring-4 focus:ring-maroon-500/10 transition"
                    >
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                      <option value="on_leave">On Leave</option>
                    </select>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-2 border-t border-gray-100">
            <button
              type="button"
              onClick={() => setFormOpen(false)}
              className="px-5 py-2.5 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 hover:border-gray-300 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 text-sm font-medium text-white bg-maroon-600 rounded-xl hover:bg-maroon-700 active:bg-maroon-800 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center gap-2"
            >
              {saving ? (
                <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Saving...</>
              ) : (
                <><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
                {editing ? 'Update User' : 'Register User'}</>
              )}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation */}
      <Modal isOpen={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} title="Confirm Delete">
        <p className="text-sm text-gray-600 mb-6">
          Are you sure you want to delete <strong>{deleteConfirm?.full_name}</strong>
          {deleteConfirm?.email && <> ({deleteConfirm.email})</>}?
        </p>
        <div className="flex justify-end gap-3">
          <button
            onClick={() => setDeleteConfirm(null)}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition"
          >
            Cancel
          </button>
          <button
            onClick={() => handleDelete(deleteConfirm)}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition"
          >
            Delete
          </button>
        </div>
      </Modal>
    </div>
    </ErrorBoundary>
  )
}

export default Users
