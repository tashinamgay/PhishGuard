import { useEffect, useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const NAV_ITEMS = [
  { to: '/detect', label: 'Detector', icon: 'D' },
  { to: '/history', label: 'History', icon: 'H' },
]

const RESEARCHER_ITEMS = [
  { to: '/researcher', label: 'Research Lab', icon: 'R' },
]

export default function Layout({ children }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, logout } = useAuth()
  const [open, setOpen] = useState(false)

  useEffect(() => setOpen(false), [location.pathname])

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const roleLabel = user?.role || 'user'

  return (
    <div className="app-shell">
      <div className="mobile-topbar">
        <button
          aria-label="Open navigation"
          onClick={() => setOpen(true)}
          style={{
            width: 38,
            height: 38,
            borderRadius: 8,
            border: '1px solid rgba(255,255,255,0.18)',
            background: 'rgba(255,255,255,0.08)',
            color: '#fff',
            cursor: 'pointer',
          }}
        >
          =
        </button>
        <img src="/cihe-logo.png" alt="CIHE" style={{ width: 30, height: 30, objectFit: 'contain', background: '#fff', borderRadius: 6 }} />
        <strong>PhishGuard</strong>
      </div>

      <div className={`overlay${open ? ' visible' : ''}`} onClick={() => setOpen(false)} />

      <aside className={`sidebar${open ? ' open' : ''}`}>
        <div className="brand-block">
          <img src="/cihe-logo.png" alt="CIHE" className="brand-mark" />
          <div>
            <div className="brand-name">PhishGuard</div>
            <div className="brand-subtitle">LLM phishing defence</div>
          </div>
        </div>

        <nav className="nav-area">
          <div className="nav-section">Workspace</div>
          {NAV_ITEMS.map(item => (
            <NavLink key={item.to} to={item.to} className="nav-link">
              <span className="nav-icon">{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}

          {(user?.role === 'researcher' || user?.role === 'admin') && (
            <>
              <div className="nav-section">Research</div>
              {RESEARCHER_ITEMS.map(item => (
                <NavLink key={item.to} to={item.to} className="nav-link">
                  <span className="nav-icon">{item.icon}</span>
                  <span>{item.label}</span>
                </NavLink>
              ))}
            </>
          )}

          {user?.role === 'admin' && (
            <>
              <div className="nav-section">Administration</div>
              <NavLink to="/admin" className="nav-link">
                <span className="nav-icon">A</span>
                <span>Admin Panel</span>
              </NavLink>
            </>
          )}
        </nav>

        {user && (
          <div className="user-panel">
            <div style={{ color: '#ffffff', fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user.name}
            </div>
            <div className="role-pill">{roleLabel}</div>
            <NavLink to="/setup-2fa" className="ghost-btn">2FA setup</NavLink>
            <button onClick={handleLogout} className="danger-btn">Logout</button>
          </div>
        )}
      </aside>

      <main className="main-content">{children}</main>
    </div>
  )
}
