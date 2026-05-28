import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { register } from '../utils/api'

export default function RegisterPage() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'user' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [pending, setPending] = useState(null)

  const handleChange = (event) => setForm({ ...form, [event.target.name]: event.target.value })

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    if (form.password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    setLoading(true)
    try {
      const data = await register(form.name, form.email, form.password, form.role)
      if (data.is_approved) {
        setPending({ approved: true, role: data.role })
        setTimeout(() => navigate('/login'), 1600)
      } else {
        setPending({ approved: false, role: data.role })
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  if (pending && !pending.approved) {
    return (
      <AuthShell>
        <div className="auth-card">
          <p className="eyebrow">Approval required</p>
          <h2>Account created</h2>
          <p className="panel-copy">
            Your {pending.role} account was created successfully. An admin must approve it before you can sign in.
          </p>
          <div className="auth-note">
            Next steps: admin reviews the account, approves access, and then you can login and set up 2FA.
          </div>
          <Link className="primary-btn" style={{ display: 'block', textAlign: 'center', textDecoration: 'none' }} to="/login">
            Go to login
          </Link>
        </div>
      </AuthShell>
    )
  }

  return (
    <AuthShell>
      <div className="auth-card">
        <p className="eyebrow">Create account</p>
        <h2>Join PhishGuard</h2>
        <p className="panel-copy">The first registered user becomes admin. All later users require admin approval.</p>

        {pending?.approved && <div className="auth-success">Admin account created. Redirecting to login...</div>}
        {error && <div className="auth-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <label className="field">
            <span className="field-label">Full name</span>
            <input className="text-input" type="text" name="name" value={form.name} onChange={handleChange} placeholder="Your name" required />
          </label>
          <label className="field">
            <span className="field-label">Email</span>
            <input className="text-input" type="email" name="email" value={form.email} onChange={handleChange} placeholder="you@example.com" required />
          </label>
          <label className="field">
            <span className="field-label">Password</span>
            <input className="text-input" type="password" name="password" value={form.password} onChange={handleChange} placeholder="At least 8 characters" required />
          </label>
          <label className="field">
            <span className="field-label">Requested role</span>
            <select className="text-input" name="role" value={form.role} onChange={handleChange}>
              <option value="user">End User</option>
              <option value="researcher">Researcher</option>
            </select>
          </label>

          <button type="submit" className="primary-btn" disabled={loading || !!pending}>
            {loading ? 'Creating account...' : 'Create account'}
          </button>
        </form>

        <p style={{ textAlign: 'center', color: '#607086', margin: '18px 0 0' }}>
          Already registered? <Link to="/login" style={{ color: '#0784c3', fontWeight: 800 }}>Sign in</Link>
        </p>
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
          <h1>Secure access for phishing research and detection.</h1>
          <p>
            Register as a normal user or researcher. Admin approval and two-factor authentication protect the platform before sensitive features are available.
          </p>
        </div>
        <div className="auth-feature-grid">
          <div className="auth-feature"><strong>Admin</strong><span>Approves accounts and manages roles.</span></div>
          <div className="auth-feature"><strong>Researcher</strong><span>Trains and compares ML models.</span></div>
          <div className="auth-feature"><strong>User</strong><span>Checks emails and receives explanations.</span></div>
        </div>
      </section>
      <section className="auth-card-wrap">{children}</section>
    </main>
  )
}
