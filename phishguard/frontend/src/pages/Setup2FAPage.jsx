// =============================================================================
// pages/Setup2FAPage.jsx — Responsive 2FA Setup (All bugs fixed)
// =============================================================================

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { setup2FA, enable2FA, disable2FA, getMe } from '../utils/api'

const C = {
  bg: '#0a0e1a', card: '#111827', border: '#1e2d45',
  blue: '#00d4ff', text: '#e8f4fd', muted: '#6b7a99',
  red: '#ff3b5c', green: '#00e5a0', yellow: '#fbbf24',
}

function getErrorMessage(e) {
  const detail = e?.response?.data?.detail
  if (!detail) return 'Something went wrong. Please try again.'
  if (typeof detail === 'string') {
    if (detail.toLowerCase().includes('field required')) return 'Please enter the 6-digit code from your authenticator app.'
    return detail
  }
  if (Array.isArray(detail)) return detail[0]?.msg || 'Validation error'
  if (typeof detail === 'object') return detail.msg || JSON.stringify(detail)
  return String(detail)
}

export default function Setup2FAPage() {
  const navigate  = useNavigate()
  const [step,    setStep]    = useState('loading')
  const [qrCode,  setQrCode]  = useState('')
  const [secret,  setSecret]  = useState('')
  const [code,    setCode]    = useState('')
  const [disCode, setDisCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  useEffect(() => {
    getMe()
      .then(u => setStep(u.two_fa_enabled ? 'enabled' : 'intro'))
      .catch(() => setStep('intro'))
  }, [])

  const handleSetup = async () => {
    setLoading(true); setError('')
    try {
      const data = await setup2FA()
      setQrCode(data.qr_code); setSecret(data.secret); setStep('scan')
    } catch (e) { setError(getErrorMessage(e)) }
    setLoading(false)
  }

  const handleEnable = async (e) => {
    e.preventDefault()
    const trimmed = code.trim()
    if (trimmed.length !== 6 || loading) { setError('Please enter the 6-digit code from your authenticator app.'); return }
    setLoading(true); setError('')
    try { await enable2FA(trimmed); setStep('done') }
    catch (err) { setError(getErrorMessage(err)); setCode('') }
    setLoading(false)
  }

  const handleDisable = async (e) => {
    e.preventDefault()
    const trimmed = disCode.trim()
    if (trimmed.length !== 6 || loading) { setError('Please enter the 6-digit code from your authenticator app.'); return }
    setLoading(true); setError('')
    try { await disable2FA(trimmed); setStep('disabled') }
    catch (err) { setError(getErrorMessage(err)); setDisCode('') }
    setLoading(false)
  }

  const inputStyle = {
    width: '100%', padding: '16px', background: '#0a0e1a',
    border: `1px solid ${C.border}`, borderRadius: 8, color: C.text,
    fontSize: 28, fontFamily: 'Space Mono', textAlign: 'center',
    letterSpacing: '0.5em', outline: 'none', boxSizing: 'border-box',
  }
  const btnPrimary = {
    width: '100%', padding: 13, background: C.blue, border: 'none',
    borderRadius: 8, color: '#060810', fontFamily: 'Space Mono',
    fontSize: 13, fontWeight: 700, cursor: 'pointer', letterSpacing: '0.05em',
  }
  const btnDisabled = { ...btnPrimary, background: '#1e2d45', color: C.muted, cursor: 'not-allowed' }
  const btnBack = {
    width: '100%', marginTop: 8, padding: '10px', background: 'none',
    border: `1px solid ${C.border}`, borderRadius: 8, color: C.muted,
    cursor: 'pointer', fontSize: 12, fontFamily: 'Space Mono',
  }

  if (step === 'loading') return (
    <div style={{ textAlign: 'center', padding: 60, color: C.muted, fontFamily: 'Space Mono' }}>Loading...</div>
  )

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', padding: '0 4px' }}>

      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontFamily: 'Space Mono', fontSize: 18, color: C.text, margin: 0 }}>🔐 Two-Factor Authentication</h1>
        <p style={{ color: C.muted, fontSize: 13, marginTop: 6 }}>Add extra security to your account</p>
      </div>

      {error !== '' && (
        <div style={{ background: '#ff3b5c20', border: '1px solid #ff3b5c44', borderRadius: 8, padding: '10px 14px', color: C.red, fontSize: 13, marginBottom: 16, textAlign: 'center' }}>
          ❌ {String(error)}
        </div>
      )}

      {/* INTRO */}
      {step === 'intro' && (
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 28 }}>
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🛡️</div>
            <div style={{ fontFamily: 'Space Mono', fontSize: 14, color: C.text, marginBottom: 8 }}>Protect Your Account</div>
            <div style={{ color: C.muted, fontSize: 13, lineHeight: 1.7 }}>2FA adds a second layer of security. Even if someone knows your password they cannot login without your phone.</div>
          </div>
          <div style={{ background: '#00d4ff10', border: '1px solid #00d4ff20', borderRadius: 8, padding: 14, marginBottom: 20 }}>
            {['Download Google Authenticator on your phone','Click Setup 2FA to get your QR code','Scan the QR code with the app','Enter the 6-digit code to activate'].map((s, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, marginBottom: i < 3 ? 8 : 0 }}>
                <span style={{ color: C.blue, fontFamily: 'Space Mono', fontSize: 12, minWidth: 18, fontWeight: 700 }}>{i+1}.</span>
                <span style={{ color: C.text, fontSize: 13 }}>{s}</span>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
            <a href="https://play.google.com/store/apps/details?id=com.google.android.apps.authenticator2" target="_blank" rel="noreferrer"
              style={{ flex: 1, padding: '10px', background: '#1e2d45', border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, textDecoration: 'none', textAlign: 'center', fontSize: 12, fontFamily: 'Space Mono' }}>
              📱 Android
            </a>
            <a href="https://apps.apple.com/app/google-authenticator/id388497605" target="_blank" rel="noreferrer"
              style={{ flex: 1, padding: '10px', background: '#1e2d45', border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, textDecoration: 'none', textAlign: 'center', fontSize: 12, fontFamily: 'Space Mono' }}>
              🍎 iPhone
            </a>
          </div>
          <button onClick={handleSetup} disabled={loading} style={loading ? btnDisabled : btnPrimary}>
            {loading ? 'GENERATING QR CODE...' : 'SETUP 2FA (REQUIRED)'}
          </button>
          <div style={{ marginTop: 12, padding: '10px 14px', background: '#ff3b5c10', border: '1px solid #ff3b5c30', borderRadius: 8, fontSize: 12, color: '#ff6b7a', textAlign: 'center' }}>
            ⚠️ 2FA is mandatory. You must complete setup to access the platform.
          </div>
        </div>
      )}

      {/* SCAN */}
      {step === 'scan' && (
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 28 }}>
          <h2 style={{ fontFamily: 'Space Mono', fontSize: 15, color: C.text, marginBottom: 8, textAlign: 'center' }}>Scan QR Code</h2>
          <p style={{ color: C.muted, fontSize: 13, marginBottom: 20, textAlign: 'center', lineHeight: 1.6 }}>
            Open Google Authenticator → tap <strong style={{ color: C.text }}>+</strong> → tap <strong style={{ color: C.text }}>Scan QR code</strong>
          </p>
          <div style={{ textAlign: 'center', marginBottom: 18 }}>
            <div style={{ display: 'inline-block', padding: 12, background: '#ffffff', borderRadius: 12 }}>
              <img src={'data:image/png;base64,' + qrCode} alt="2FA QR Code" style={{ width: '100%', maxWidth: 200, height: 'auto', display: 'block' }} />
            </div>
          </div>
          <div style={{ background: '#1e2d4560', borderRadius: 8, padding: 12, marginBottom: 20, textAlign: 'center' }}>
            <div style={{ color: C.muted, fontSize: 10, fontFamily: 'Space Mono', marginBottom: 6, letterSpacing: '0.1em' }}>MANUAL ENTRY KEY</div>
            <div style={{ color: C.blue, fontFamily: 'Space Mono', fontSize: 12, letterSpacing: '0.1em', wordBreak: 'break-all' }}>{secret}</div>
          </div>
          <button onClick={() => { setStep('verify'); setCode(''); setError('') }} style={btnPrimary}>I SCANNED IT → NEXT</button>
          <button onClick={() => { setStep('intro'); setError('') }} style={btnBack}>← BACK</button>
        </div>
      )}

      {/* VERIFY */}
      {step === 'verify' && (
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 28 }}>
          <h2 style={{ fontFamily: 'Space Mono', fontSize: 15, color: C.text, marginBottom: 8, textAlign: 'center' }}>Enter Verification Code</h2>
          <p style={{ color: C.muted, fontSize: 13, marginBottom: 20, textAlign: 'center', lineHeight: 1.6 }}>Enter the 6-digit code from your Google Authenticator app</p>
          <form onSubmit={handleEnable}>
            <input type="text" value={code} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000" maxLength={6} autoFocus style={{ ...inputStyle, marginBottom: 8 }} />
            <div style={{ color: C.muted, fontSize: 11, textAlign: 'center', marginBottom: 18 }}>Code refreshes every 30 seconds</div>
            <button type="submit" disabled={loading || code.length !== 6} style={loading || code.length !== 6 ? btnDisabled : btnPrimary}>
              {loading ? 'ACTIVATING...' : 'ACTIVATE 2FA'}
            </button>
          </form>
          <button onClick={() => { setStep('scan'); setCode(''); setError('') }} style={btnBack}>← BACK TO QR CODE</button>
        </div>
      )}

      {/* ENABLED */}
      {step === 'enabled' && (
        <div style={{ background: C.card, border: '1px solid #00e5a044', borderRadius: 14, padding: 28 }}>
          <div style={{ textAlign: 'center', marginBottom: 20 }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
            <div style={{ fontFamily: 'Space Mono', fontSize: 15, color: C.green, marginBottom: 8 }}>2FA is Active</div>
            <div style={{ color: C.muted, fontSize: 13 }}>Your account is protected with two-factor authentication</div>
          </div>
          <div style={{ background: '#00e5a010', border: '1px solid #00e5a030', borderRadius: 8, padding: 14, marginBottom: 20, fontSize: 13, color: C.text }}>
            Every login requires your 6-digit code from Google Authenticator
          </div>
          <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 18 }}>
            <div style={{ color: C.muted, fontSize: 12, marginBottom: 10, textAlign: 'center' }}>Want to disable 2FA? Enter your current code:</div>
            <form onSubmit={handleDisable}>
              <input type="text" value={disCode} onChange={e => setDisCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000" maxLength={6} style={{ ...inputStyle, marginBottom: 12 }} />
              <button type="submit" disabled={loading || disCode.length !== 6}
                style={{ ...btnPrimary, background: disCode.length === 6 ? C.red : '#1e2d45', color: disCode.length === 6 ? '#fff' : C.muted, cursor: disCode.length !== 6 ? 'not-allowed' : 'pointer' }}>
                {loading ? 'DISABLING...' : 'DISABLE 2FA'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* DONE */}
      {step === 'done' && (
        <div style={{ background: C.card, border: '1px solid #00e5a044', borderRadius: 14, padding: 28, textAlign: 'center' }}>
          <div style={{ fontSize: 56, marginBottom: 16 }}>✅</div>
          <div style={{ fontFamily: 'Space Mono', fontSize: 18, color: C.green, marginBottom: 12 }}>2FA Enabled!</div>
          <div style={{ color: C.muted, fontSize: 13, lineHeight: 1.7, marginBottom: 20 }}>Your account is now protected. Every login will require your 6-digit code.</div>
          <div style={{ background: '#fbbf2415', border: '1px solid #fbbf2430', borderRadius: 8, padding: 14, marginBottom: 20, fontSize: 12, color: C.yellow, textAlign: 'left' }}>
            ⚠️ <strong>Important:</strong> Keep your authenticator app safe. If you lose it contact an admin to reset your 2FA.
          </div>
          <button onClick={() => navigate('/detect')} style={btnPrimary}>GO TO DETECTOR →</button>
        </div>
      )}

      {/* DISABLED */}
      {step === 'disabled' && (
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 28, textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🔓</div>
          <div style={{ fontFamily: 'Space Mono', fontSize: 15, color: C.yellow, marginBottom: 8 }}>2FA Disabled</div>
          <div style={{ color: C.muted, fontSize: 13, marginBottom: 20 }}>Two-factor authentication has been removed from your account.</div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button onClick={() => { setStep('intro'); setDisCode(''); setError('') }}
              style={{ flex: 1, minWidth: 140, padding: 12, background: C.blue, border: 'none', borderRadius: 8, color: '#060810', fontFamily: 'Space Mono', fontSize: 12, cursor: 'pointer', fontWeight: 700 }}>
              RE-ENABLE 2FA
            </button>
            <button onClick={() => navigate('/detect')}
              style={{ flex: 1, minWidth: 140, padding: 12, background: '#1e2d45', border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, fontFamily: 'Space Mono', fontSize: 12, cursor: 'pointer' }}>
              GO TO DETECTOR
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
