import { useState } from 'react'
import { usePredict } from '../hooks/usePredict'
import ModelSelector from '../components/ModelSelector'
import ResultCard from '../components/ResultCard'
import Spinner from '../components/Spinner'

const MODEL_LABELS = {
  stacking_rf: 'Stacking - Random Forest',
  stacking_logistic: 'Stacking - Logistic Regression',
  llama: 'LLaMA (Individual)',
}

export default function DetectorPage() {
  const [subject, setSubject] = useState('')
  const [headers, setHeaders] = useState('')
  const [text, setText] = useState('')
  const [showHeaders, setShowHeaders] = useState(false)
  const [selectedModel, setSelectedModel] = useState('stacking_rf')

  const { result, loading, error, predict, reset } = usePredict()

  const handleSubmit = (event) => {
    event.preventDefault()
    if (text.trim().length < 5) return
    predict(text.trim(), selectedModel, subject.trim() || null, headers.trim() || null)
  }

  const handleClear = () => {
    setSubject('')
    setHeaders('')
    setText('')
    reset()
  }

  const canSubmit = !loading && text.trim().length >= 5

  return (
    <div>
      <header className="page-header">
        <div>
          <p className="eyebrow">User detection workspace</p>
          <h1 className="page-title">Check suspicious emails with ML and Gemini explanation.</h1>
          <p className="page-copy">
            Paste the email content, choose a model, and PhishGuard will classify the message as phishing or safe.
            After prediction, users can request a Gemini-assisted explanation in plain language.
          </p>
        </div>
      </header>

      <section className="status-strip" aria-label="System capabilities">
        <div className="stat-tile">
          <div className="stat-label">Roles</div>
          <div className="stat-value">Admin / Researcher / User</div>
        </div>
        <div className="stat-tile">
          <div className="stat-label">Security</div>
          <div className="stat-value">Mandatory 2FA</div>
        </div>
        <div className="stat-tile">
          <div className="stat-label">Explanation</div>
          <div className="stat-value">Gemini on demand</div>
        </div>
        <div className="stat-tile">
          <div className="stat-label">Model flow</div>
          <div className="stat-value">Train, test, deploy</div>
        </div>
      </section>

      <ModelSelector
        selected={selectedModel}
        onChange={(key) => {
          setSelectedModel(key)
          reset()
        }}
      />

      <div className="detector-grid" style={{ marginTop: 22 }}>
        <form onSubmit={handleSubmit} className="panel">
          <h2 className="panel-title">Email details</h2>
          <p className="panel-copy">
            Subject and headers help the model identify spoofing, urgency, and delivery clues. The email body is required.
          </p>

          <label className="field">
            <span className="field-label">Subject</span>
            <input
              className="text-input"
              type="text"
              value={subject}
              onChange={(event) => {
                setSubject(event.target.value)
                if (result) reset()
              }}
              placeholder="Example: Your account has been suspended"
              disabled={loading}
            />
          </label>

          <div className="field">
            <button
              type="button"
              onClick={() => setShowHeaders(value => !value)}
              style={{
                border: '1px solid #cfd9e6',
                background: '#ffffff',
                color: '#0784c3',
                borderRadius: 8,
                padding: '9px 12px',
                cursor: 'pointer',
                fontWeight: 800,
                fontSize: 13,
              }}
            >
              {showHeaders ? 'Hide optional headers' : 'Add optional headers'}
            </button>
            {showHeaders && (
              <textarea
                className="text-input"
                value={headers}
                onChange={(event) => {
                  setHeaders(event.target.value)
                  if (result) reset()
                }}
                placeholder={'From: attacker@fake.com\nReceived: from suspicious-host\nX-Spam-Score: 8.5'}
                disabled={loading}
                rows={4}
                style={{ marginTop: 10, resize: 'vertical', lineHeight: 1.55 }}
              />
            )}
          </div>

          <label className="field">
            <span className="field-label">Email body *</span>
            <textarea
              className="text-input"
              value={text}
              onChange={(event) => {
                setText(event.target.value)
                if (result) reset()
              }}
              placeholder="Paste the full email body here..."
              disabled={loading}
              rows={12}
              style={{ resize: 'vertical', lineHeight: 1.65 }}
            />
          </label>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10, alignItems: 'center' }}>
            <button type="submit" className="primary-btn" disabled={!canSubmit}>
              {loading ? `Analysing with ${MODEL_LABELS[selectedModel]}...` : `Analyse with ${MODEL_LABELS[selectedModel]}`}
            </button>
            {(text || subject || result) && (
              <button
                type="button"
                onClick={handleClear}
                style={{
                  border: '1px solid #cfd9e6',
                  background: '#ffffff',
                  color: '#607086',
                  borderRadius: 8,
                  padding: '11px 14px',
                  cursor: 'pointer',
                  fontWeight: 800,
                }}
              >
                Clear
              </button>
            )}
          </div>

          {error && (
            <div style={{ marginTop: 14, padding: 13, borderRadius: 8, background: '#fff1f3', border: '1px solid #ffc7cf', color: '#b42335' }}>
              {error}
            </div>
          )}
        </form>

        <div>
          {loading && <Spinner message={`Running ${MODEL_LABELS[selectedModel]}...`} />}
          {!loading && result && <ResultCard result={result} />}
          {!loading && !result && (
            <div className="empty-state">
              <div style={{ fontSize: 42, fontWeight: 900, color: '#0784c3', marginBottom: 8 }}>PG</div>
              <h2 style={{ margin: '0 0 8px', color: '#102033' }}>Awaiting analysis</h2>
              <p style={{ margin: 0, maxWidth: 330, lineHeight: 1.6 }}>
                Add an email and run the detector. The result, confidence, risk level, and Gemini explanation will appear here.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
