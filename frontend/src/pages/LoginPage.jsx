import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { login, verify2FA } from '../utils/api'

export default function LoginPage() {
  const navigate = useNavigate()
  const { login: authLogin } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [step, setStep] = useState('login')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [tempEmail, setTempEmail] = useState('')

  const redirect = (data) => {
    authLogin(data)
    if (data.requires_2fa_setup) {
      navigate('/setup-2fa')
      return
    }
    if (data.role === 'admin') navigate('/admin')
    else if (data.role === 'researcher') navigate('/researcher')
    else navigate('/detect')
  }

  const handleLogin = async (event) => {
    event.preventDefault()
    setError('')
    setLoading(true)
    try {
      const data = await login(email, password)
      if (data.requires_2fa) {
        setTempEmail(email)
        setStep('2fa')
      } else {
        redirect(data)
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  const handle2FA = async (event) => {
    event.preventDefault()
    const trimmed = code.trim()
    if (trimmed.length !== 6) {
      setError('Please enter the 6-digit code.')
      return
    }
    setError('')
    setLoading(true)
    try {
      redirect(await verify2FA(tempEmail, trimmed))
    } catch (err) {
      setError(err.response?.data?.detail || 'Invalid 2FA code.')
      setCode('')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthShell>
      <div className="auth-card">
        {step === 'login' ? (
          <>
            <p className="eyebrow">Secure sign in</p>
            <h2>Welcome back</h2>
            <p className="panel-copy">Use your approved PhishGuard account. 2FA setup is required for every user after first login.</p>

            <div className="auth-note">Two-factor authentication is mandatory for admins, researchers, and normal users.</div>
            {error && <div className="auth-error">{error}</div>}

            <form onSubmit={handleLogin}>
              <label className="field">
                <span className="field-label">Email</span>
                <input className="text-input" type="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="you@example.com" required />
              </label>
              <label className="field">
                <span className="field-label">Password</span>
                <input className="text-input" type="password" value={password} onChange={event => setPassword(event.target.value)} placeholder="Enter password" required />
              </label>
              <button type="submit" className="primary-btn" disabled={loading}>{loading ? 'Signing in...' : 'Sign in'}</button>
            </form>

            <p style={{ textAlign: 'center', color: '#607086', margin: '18px 0 0' }}>
              Need an account? <Link to="/register" style={{ color: '#0784c3', fontWeight: 800 }}>Register</Link>
            </p>
          </>
        ) : (
          <>
            <p className="eyebrow">Two-factor check</p>
            <h2>Enter 2FA code</h2>
            <p className="panel-copy">Open Google Authenticator or your TOTP app and enter the current 6-digit code.</p>
            {error && <div className="auth-error">{error}</div>}
            <form onSubmit={handle2FA}>
              <label className="field">
                <span className="field-label">Authenticator code</span>
                <input
                  className="text-input"
                  type="text"
                  value={code}
                  onChange={event => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  maxLength={6}
                  autoFocus
                  style={{ textAlign: 'center', fontSize: 28, letterSpacing: '0.35em', fontWeight: 900 }}
                />
              </label>
              <button type="submit" className="primary-btn" disabled={loading || code.length !== 6}>
                {loading ? 'Verifying...' : 'Verify code'}
              </button>
            </form>
            <button
              onClick={() => {
                setStep('login')
                setCode('')
                setError('')
              }}
              style={{ marginTop: 12, border: 0, background: 'transparent', color: '#607086', cursor: 'pointer', width: '100%' }}
            >
              Back to login
            </button>
          </>
        )}
      </div>
    </AuthShell>
  )
}

function AuthShell({ children }) {
  return (
    <main className="auth-page">
      <section className="auth-hero">
        <div className="auth-logo">
          <img src="/cihe-logo.png" alt="CIHE" />
          <span>PhishGuard</span>
        </div>
        <div>
          <h1>Phishing detection with explanations users can understand.</h1>
          <p>
            A secure role-based platform for email classification, Gemini explanation, researcher model evaluation, and admin governance.
          </p>
        </div>
        <div className="auth-feature-grid">
          <div className="auth-feature"><strong>2FA</strong><span>Required for every account.</span></div>
          <div className="auth-feature"><strong>RBAC</strong><span>Admin, researcher, and user workflows.</span></div>
          <div className="auth-feature"><strong>Gemini</strong><span>On-demand explanation with fallback.</span></div>
        </div>
      </section>
      <section className="auth-card-wrap">{children}</section>
    </main>
  )
}
