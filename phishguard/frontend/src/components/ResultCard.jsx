import { useState } from 'react'
import { explainPrediction } from '../utils/api'

const MODEL_NAMES = {
  stacking_rf: 'Stacking - Random Forest',
  stacking_logistic: 'Stacking - Logistic Regression',
  llama: 'LLaMA (Individual)',
  bert: 'BERT',
  distilbert: 'DistilBERT',
  logistic_regression: 'Logistic Regression',
}

export default function ResultCard({ result }) {
  const [explainState, setExplainState] = useState('idle')
  const [explanation, setExplanation] = useState(null)
  const [source, setSource] = useState(null)
  const [retryAfter, setRetryAfter] = useState(0)

  const isPhishing = result.label === 'phishing'
  const color = isPhishing ? '#d92d43' : '#078a63'
  const phPct = Math.round((result.phishing_prob || 0) * 100)
  const safePct = Math.round((result.safe_prob || 0) * 100)
  const confidencePct = Math.round((result.confidence || 0) * 100)
  const modelName = MODEL_NAMES[result.model_used] || result.model_used || 'Model'
  const inferenceMode = result.inference_mode || 'model'

  const riskColor = {
    HIGH: '#d92d43',
    MEDIUM: '#b77905',
    LOW: '#078a63',
  }[result.risk_level] || '#078a63'

  const handleExplain = async () => {
    if (!result.prediction_id) return
    setExplainState('loading')
    try {
      const response = await explainPrediction(result.prediction_id)
      setExplanation(response.explanation)
      setSource(response.source)
      if (response.rate_limited) {
        setRetryAfter(response.retry_after || 0)
        setExplainState('rate_limit')
      } else {
        setExplainState('done')
      }
    } catch (error) {
      console.error('Explain error:', error)
      setExplanation('The explanation service could not be reached. Please try again, or review the phishing probability, confidence, and risk level shown above.')
      setSource('local_error')
      setExplainState('done')
    }
  }

  const lines = (explanation || '')
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)

  return (
    <article className="result-card" style={{ '--result-color': color }}>
      <div className="result-top">
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start', marginBottom: 18 }}>
          <div>
            <div className="result-label">{isPhishing ? 'PHISHING' : 'SAFE'}</div>
            <p style={{ margin: '6px 0 0', color: '#52637a', lineHeight: 1.5 }}>
              {isPhishing ? 'Threat indicators were found in this message.' : 'No strong phishing indicators were found.'}
            </p>
          </div>
          <div style={{
            border: `1px solid ${riskColor}`,
            color: riskColor,
            background: '#ffffff',
            borderRadius: 999,
            padding: '7px 11px',
            fontSize: 12,
            fontWeight: 900,
            whiteSpace: 'nowrap',
          }}>
            {result.risk_level} risk
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10, marginBottom: 18 }}>
          <Metric label="Confidence" value={`${confidencePct}%`} />
          <Metric label="Model" value={modelName} small />
          <Metric label="Mode" value={inferenceMode.replaceAll('_', ' ')} small />
        </div>

        <Probability label="Phishing probability" value={phPct} color="#d92d43" />
        <Probability label="Safe probability" value={safePct} color="#078a63" />

        {isPhishing && (
          <div style={{
            marginTop: 16,
            border: '1px solid #f0b8c0',
            background: '#fff6f7',
            color: '#9f2030',
            borderRadius: 8,
            padding: 12,
            lineHeight: 1.55,
          }}>
            Avoid clicking links, downloading attachments, or entering passwords until this email is verified through another trusted channel.
          </div>
        )}
      </div>

      <div className="ai-box">
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, alignItems: 'center', marginBottom: 12 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, color: '#102033' }}>Gemini explanation</h2>
            <p style={{ margin: '4px 0 0', color: '#607086', fontSize: 13 }}>
              Plain-language reasoning for non-technical users.
            </p>
          </div>
          {source && (
            <span style={{
              color: source === 'gemini' ? '#0784c3' : '#607086',
              background: '#f0f6fb',
              border: '1px solid #d8e1ec',
              borderRadius: 999,
              padding: '5px 9px',
              fontSize: 12,
              fontWeight: 800,
              whiteSpace: 'nowrap',
            }}>
              {source === 'gemini' ? 'Gemini AI' : 'Fallback'}
            </span>
          )}
        </div>

        {explainState === 'idle' && (
          <>
            <button onClick={handleExplain} className="primary-btn">
              Get AI explanation
            </button>
            <p style={{ margin: '10px 0 0', color: '#607086', fontSize: 12, textAlign: 'center' }}>
              Rate-limited and cached to protect the Gemini quota.
            </p>
          </>
        )}

        {explainState === 'loading' && (
          <div style={{ padding: 16, color: '#607086', background: '#f5f8fb', borderRadius: 8 }}>
            Asking Gemini for a user-friendly explanation...
          </div>
        )}

        {explainState === 'rate_limit' && (
          <div style={{ marginBottom: 12, padding: 12, color: '#7a4c00', background: '#fff8e6', border: '1px solid #f5d28a', borderRadius: 8 }}>
            Please wait {retryAfter}s before requesting another Gemini explanation.
          </div>
        )}

        {(explainState === 'done' || explainState === 'rate_limit') && explanation && (
          <div style={{ display: 'grid', gap: 8 }}>
            {lines.map((line, index) => {
              const clean = line.replace(/^[-*•]\s*/, '')
              return (
                <div key={index} style={{ display: 'flex', gap: 9, alignItems: 'flex-start', color: '#26394f', lineHeight: 1.58 }}>
                  <span style={{ color, fontWeight: 900 }}>{index === 0 ? '>' : '-'}</span>
                  <span>{clean}</span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </article>
  )
}

function Metric({ label, value, small }) {
  return (
    <div style={{ background: '#ffffff', border: '1px solid #d8e1ec', borderRadius: 8, padding: 11, minWidth: 0 }}>
      <div style={{ color: '#607086', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</div>
      <div style={{ marginTop: 5, color: '#102033', fontSize: small ? 13 : 20, fontWeight: 900, overflowWrap: 'anywhere' }}>{value}</div>
    </div>
  )
}

function Probability({ label, value, color }) {
  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, color: '#42526e', fontSize: 13, fontWeight: 800, marginBottom: 6 }}>
        <span>{label}</span>
        <span style={{ color }}>{value}%</span>
      </div>
      <div className="progress-track">
        <div className="progress-fill" style={{ '--value': `${value}%`, '--bar-color': color }} />
      </div>
    </div>
  )
}
