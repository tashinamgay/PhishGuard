import { useEffect, useState } from 'react'
import { clearHistory, getHistory } from '../utils/api'

const MODEL_COLORS = {
  stacking_rf: '#fb923c',
  bert: '#0784c3',
  distilbert: '#11a88f',
  llama: '#7c5fd6',
  logistic_regression: '#42526e',
}

export default function HistoryPage() {
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchHistory = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await getHistory(50)
      setHistory(Array.isArray(data) ? data : [])
    } catch {
      setError('Could not load history. Is the backend running?')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchHistory() }, [])

  const handleClear = async () => {
    if (!window.confirm('Clear all prediction history?')) return
    await clearHistory()
    setHistory([])
  }

  const formatTime = (timestamp) => {
    try {
      return new Date(timestamp + 'Z').toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    } catch {
      return ''
    }
  }

  return (
    <div>
      <header className="page-header">
        <div>
          <p className="eyebrow">Audit trail</p>
          <h1 className="page-title">Prediction history</h1>
          <p className="page-copy">All recent email analyses, newest first. Admins and researchers can review usage while normal users see their own history.</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          <button onClick={fetchHistory} style={buttonStyle('#0784c3')}>Refresh</button>
          {history.length > 0 && <button onClick={handleClear} style={buttonStyle('#d92d43')}>Clear all</button>}
        </div>
      </header>

      {error && <div className="auth-error">{error}</div>}

      {loading && (
        <div style={{ display: 'grid', gap: 10 }}>
          {[...Array(5)].map((_, index) => <div key={index} className="panel" style={{ height: 64, opacity: 0.7 }} />)}
        </div>
      )}

      {!loading && history.length === 0 && (
        <div className="empty-state">
          <div style={{ fontSize: 42, fontWeight: 900, color: '#0784c3' }}>H</div>
          <h2 style={{ margin: '0 0 8px', color: '#102033' }}>No history yet</h2>
          <p style={{ margin: 0 }}>Analyse some emails to see saved predictions here.</p>
        </div>
      )}

      {!loading && history.length > 0 && (
        <div style={{ display: 'grid', gap: 10 }}>
          {history.map(item => {
            const isPhishing = item.label === 'phishing'
            const labelColor = isPhishing ? '#d92d43' : '#078a63'
            const modelColor = MODEL_COLORS[item.model_used] || '#0784c3'
            return (
              <div key={item.id} className="panel" style={{
                display: 'grid',
                gridTemplateColumns: '40px minmax(0, 1fr) auto',
                gap: 14,
                alignItems: 'center',
                padding: 14,
                borderColor: isPhishing ? '#f3b6c0' : '#b9e5d6',
                background: isPhishing ? '#fff7f8' : '#f3fff9',
              }}>
                <div style={{
                  width: 36,
                  height: 36,
                  borderRadius: 8,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: labelColor,
                  background: '#ffffff',
                  border: `1px solid ${isPhishing ? '#f3b6c0' : '#b9e5d6'}`,
                  fontWeight: 900,
                }}>
                  {isPhishing ? '!' : '✓'}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ color: '#102033', fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.email_preview}
                  </div>
                  <div style={{ marginTop: 5, color: '#607086', fontSize: 12 }}>{formatTime(item.timestamp)}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  <span style={pillStyle(modelColor)}>{item.model_used || 'bert'}</span>
                  <span style={pillStyle(labelColor)}>{item.label}</span>
                  <strong style={{ color: '#102033', fontSize: 13 }}>{Math.round(item.confidence * 100)}%</strong>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function buttonStyle(color) {
  return {
    padding: '9px 14px',
    borderRadius: 8,
    border: `1px solid ${color}`,
    background: '#ffffff',
    color,
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: 800,
  }
}

function pillStyle(color) {
  return {
    color,
    background: '#ffffff',
    border: `1px solid ${color}55`,
    borderRadius: 999,
    padding: '4px 8px',
    fontSize: 10,
    fontWeight: 900,
    textTransform: 'uppercase',
    overflowWrap: 'anywhere',
  }
}
