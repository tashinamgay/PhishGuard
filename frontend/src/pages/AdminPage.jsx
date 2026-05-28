// =============================================================================
// pages/AdminPage.jsx — Admin Dashboard (Fixed Layout + Scrollable)
// =============================================================================

import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import { getAdminUsers, updateUser, deleteUser, getAdminLogs, getAdminStats } from '../utils/api'

const C = {
  bg: '#0a0e1a', card: '#111827', border: '#1e2d45',
  blue: '#00d4ff', text: '#e8f4fd', muted: '#6b7a99',
  red: '#ff3b5c', green: '#00e5a0', yellow: '#fbbf24',
}

export default function AdminPage() {
  const { user, logout } = useAuth()
  const navigate          = useNavigate()
  const [tab,     setTab]     = useState('users')
  const [users,   setUsers]   = useState([])
  const [logs,    setLogs]    = useState([])
  const [stats,   setStats]   = useState(null)
  const [loading, setLoading] = useState(false)
  const [msg,     setMsg]     = useState('')

  useEffect(() => { loadData() }, [tab])

  const loadData = async () => {
    setLoading(true)
    try {
      if (tab === 'users') setUsers(await getAdminUsers())
      if (tab === 'logs')  setLogs(await getAdminLogs())
      if (tab === 'stats') setStats(await getAdminStats())
    } catch (e) { console.error(e) }
    setLoading(false)
  }

  const approve    = async (id) => { await updateUser(id, { is_approved: true });  setMsg('User approved ✅'); loadData(); setTimeout(() => setMsg(''), 3000) }
  const suspend    = async (id) => { await updateUser(id, { is_active: false });   setMsg('User suspended');   loadData(); setTimeout(() => setMsg(''), 3000) }
  const remove     = async (id) => { if (!confirm('Delete this user permanently?')) return; await deleteUser(id); setMsg('User deleted'); loadData(); setTimeout(() => setMsg(''), 3000) }
  const changeRole = async (id, role) => { await updateUser(id, { role }); setMsg(`Role changed to ${role}`); loadData(); setTimeout(() => setMsg(''), 3000) }

  const roleBadge = (role) => {
    const colors = { admin: C.red, researcher: C.yellow, user: C.blue }
    return (
      <span style={{ background: `${colors[role]}22`, color: colors[role], border: `1px solid ${colors[role]}44`, borderRadius: 4, padding: '2px 8px', fontSize: 11, fontFamily: 'Space Mono' }}>
        {role.toUpperCase()}
      </span>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: C.text, display: 'flex', flexDirection: 'column' }}>

      {/* ── Sticky Header ── */}
      <div style={{
        background: C.card, borderBottom: `1px solid ${C.border}`,
        padding: '14px 24px', display: 'flex', justifyContent: 'space-between',
        alignItems: 'center', flexWrap: 'wrap', gap: 10,
        position: 'sticky', top: 0, zIndex: 50,
      }}>

        {/* CIHE Logo + Title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <img src="/cihe-logo.png" alt="CIHE" style={{ width: 36, height: 36, objectFit: 'contain' }} />
          <div style={{ fontFamily: 'Space Mono', fontSize: 18, fontWeight: 700, color: C.blue }}>
            PHISHGUARD <span style={{ color: C.red, fontSize: 13 }}>ADMIN</span>
          </div>
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ color: C.muted, fontSize: 13 }}>👤 {user?.name}</span>
          <button onClick={() => navigate('/detect')}
            style={{ background: '#00d4ff18', border: '1px solid #00d4ff44', color: C.blue, padding: '6px 14px', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontFamily: 'Space Mono' }}>
            🛡 DETECTOR
          </button>
          <button onClick={() => navigate('/setup-2fa')}
            style={{ background: '#fbbf2418', border: '1px solid #fbbf2444', color: C.yellow, padding: '6px 14px', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontFamily: 'Space Mono' }}>
            🔐 SETUP 2FA
          </button>
          <button onClick={() => { logout(); navigate('/login') }}
            style={{ background: '#ff3b5c22', border: '1px solid #ff3b5c44', color: C.red, padding: '6px 14px', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontFamily: 'Space Mono' }}>
            LOGOUT
          </button>
        </div>
      </div>

      {/* ── Scrollable Content ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>

        {msg && (
          <div style={{ background: '#00e5a020', border: '1px solid #00e5a044', borderRadius: 8, padding: '10px 16px', color: C.green, fontSize: 13, marginBottom: 16 }}>
            {msg}
          </div>
        )}

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
          {['users', 'logs', 'stats'].map(t => (
            <button key={t} onClick={() => setTab(t)}
              style={{ padding: '8px 20px', borderRadius: 8, border: 'none', fontFamily: 'Space Mono', fontSize: 12, cursor: 'pointer', background: tab === t ? C.blue : C.card, color: tab === t ? '#060810' : C.muted, letterSpacing: '0.05em' }}>
              {t.toUpperCase()}
            </button>
          ))}
        </div>

        {loading && <div style={{ color: C.muted, padding: 20, textAlign: 'center' }}>Loading...</div>}

        {/* Users Tab */}
        {!loading && tab === 'users' && (
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <span style={{ fontFamily: 'Space Mono', fontSize: 14, color: C.text }}>All Users ({users.length})</span>
              <span style={{ color: C.yellow, fontSize: 12 }}>⚠️ {users.filter(u => !u.is_approved).length} pending approval</span>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                    {['Name', 'Email', 'Role', 'Status', '2FA', 'Actions'].map(h => (
                      <th key={h} style={{ padding: '12px 16px', textAlign: 'left', color: C.muted, fontSize: 11, fontFamily: 'Space Mono', letterSpacing: '0.1em', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {users.map((u, i) => (
                    <tr key={u.id} style={{ borderBottom: `1px solid ${C.border}20`, background: i % 2 === 0 ? 'transparent' : '#ffffff05' }}>
                      <td style={{ padding: '12px 16px', fontSize: 14, whiteSpace: 'nowrap' }}>{u.name}</td>
                      <td style={{ padding: '12px 16px', fontSize: 13, color: C.muted }}>{u.email}</td>
                      <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>{roleBadge(u.role)}</td>
                      <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                        <span style={{ color: !u.is_approved ? C.yellow : u.is_active ? C.green : C.red, fontSize: 12 }}>
                          {!u.is_approved ? '⏳ Pending' : u.is_active ? '✅ Active' : '🚫 Suspended'}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: 12, color: u.two_fa_enabled ? C.green : C.muted, whiteSpace: 'nowrap' }}>
                        {u.two_fa_enabled ? '✅ On' : '❌ Off'}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'nowrap' }}>
                          {!u.is_approved && (
                            <button onClick={() => approve(u.id)}
                              style={{ background: '#00e5a022', border: '1px solid #00e5a044', color: C.green, padding: '4px 10px', borderRadius: 4, cursor: 'pointer', fontSize: 11, whiteSpace: 'nowrap' }}>
                              Approve
                            </button>
                          )}
                          {u.is_active && (
                            <button onClick={() => suspend(u.id)}
                              style={{ background: '#fbbf2422', border: '1px solid #fbbf2444', color: C.yellow, padding: '4px 10px', borderRadius: 4, cursor: 'pointer', fontSize: 11, whiteSpace: 'nowrap' }}>
                              Suspend
                            </button>
                          )}
                          <select onChange={e => changeRole(u.id, e.target.value)} defaultValue={u.role}
                            style={{ background: C.bg, border: `1px solid ${C.border}`, color: C.text, padding: '4px 8px', borderRadius: 4, fontSize: 11, cursor: 'pointer' }}>
                            <option value="user">User</option>
                            <option value="researcher">Researcher</option>
                            <option value="admin">Admin</option>
                          </select>
                          <button onClick={() => remove(u.id)}
                            style={{ background: '#ff3b5c22', border: '1px solid #ff3b5c44', color: C.red, padding: '4px 10px', borderRadius: 4, cursor: 'pointer', fontSize: 11, whiteSpace: 'nowrap' }}>
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Logs Tab */}
        {!loading && tab === 'logs' && (
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: `1px solid ${C.border}` }}>
              <span style={{ fontFamily: 'Space Mono', fontSize: 14 }}>Activity Logs ({logs.length})</span>
            </div>
            {logs.length === 0 && (
              <div style={{ padding: 40, textAlign: 'center', color: C.muted, fontSize: 13 }}>No activity logs yet</div>
            )}
            {logs.map((log, i) => (
              <div key={log.id} style={{
                padding: '12px 20px', borderBottom: `1px solid ${C.border}20`,
                background: i % 2 === 0 ? 'transparent' : '#ffffff05',
                display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap',
              }}>
                <span style={{ color: C.muted, fontSize: 12, minWidth: 160, whiteSpace: 'nowrap' }}>{new Date(log.timestamp).toLocaleString()}</span>
                <span style={{ color: C.blue, fontSize: 12, fontFamily: 'Space Mono', minWidth: 80 }}>{log.action}</span>
                <span style={{ fontSize: 13 }}>{log.user_name || 'Unknown'}</span>
                <span style={{ color: C.muted, fontSize: 12 }}>{log.details}</span>
                <span style={{ color: C.muted, fontSize: 11, marginLeft: 'auto' }}>{log.ip_address}</span>
              </div>
            ))}
          </div>
        )}

        {/* Stats Tab */}
        {!loading && tab === 'stats' && stats && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
            {[
              { label: 'Total Users',       value: stats.total_users,       color: C.blue   },
              { label: 'Pending Approval',  value: stats.pending_approvals, color: C.yellow },
              { label: 'Total Predictions', value: stats.total_predictions, color: C.text   },
              { label: 'Phishing Detected', value: stats.phishing_detected, color: C.red    },
              { label: 'Safe Emails',       value: stats.safe_detected,     color: C.green  },
            ].map(s => (
              <div key={s.label} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: '20px 24px' }}>
                <div style={{ color: C.muted, fontSize: 11, fontFamily: 'Space Mono', letterSpacing: '0.1em', marginBottom: 8 }}>{s.label.toUpperCase()}</div>
                <div style={{ color: s.color, fontSize: 32, fontWeight: 700, fontFamily: 'Space Mono' }}>{s.value}</div>
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  )
}
