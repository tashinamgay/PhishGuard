// =============================================================================
// pages/ResearcherPage.jsx â€” Full Researcher Dashboard
// =============================================================================
// Tabs:
//   overview  â€” static benchmark metrics, accuracy bar chart
//   train     â€” upload CSV â†’ select model â†’ train â†’ live progress â†’ results
//   models    â€” all trained model versions, confusion matrix, deploy button
//   ensemble  â€” ensemble method analysis
//   dataset   â€” dataset info & training config
// =============================================================================

import { useState, useEffect, useRef, useCallback } from 'react'
import axios from 'axios'

const api = axios.create({ baseURL: '/api', timeout: 60000 })
api.interceptors.request.use(cfg => {
  const t = localStorage.getItem('phishguard_token')
  if (t) cfg.headers.Authorization = `Bearer ${t}`
  return cfg
})

const C = {
  bg: '#f5f7fb', card: '#ffffff', border: '#d8e1ec',
  blue: '#0784c3', text: '#102033', muted: '#52637a',
  red: '#d92d43', green: '#078a63', yellow: '#b77905',
  purple: '#7c5fd6', orange: '#c95f13', gray: '#42526e',
}

// â”€â”€ Static benchmark data (existing research results) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const INDIVIDUAL_MODELS = [
  { name: 'LLaMA (Individual)', key: 'llama', accuracy: 0.9758, precision: 0.9758, recall: 0.9758, f1: 0.9758, auc: 0.9880, color: C.purple, type: 'Deep Learning' },
]

const ENSEMBLE_MODELS = [
  { name: 'Stacking - Random Forest',       key: 'stacking_rf',       accuracy: 0.9805, precision: 0.9805, recall: 0.9805, f1: 0.9805, color: C.orange, type: 'Stacking' },
  { name: 'Stacking - Logistic Regression', key: 'stacking_logistic', accuracy: 0.9762, precision: 0.9762, recall: 0.9762, f1: 0.9762, color: C.yellow, type: 'Stacking' },
]

const TRAINABLE = [
  { key: 'stacking_rf',       label: 'Stacking - Random Forest',       color: C.orange, desc: 'Rank 1 method, F1 98.05%' },
  { key: 'stacking_logistic', label: 'Stacking - Logistic Regression', color: C.yellow, desc: 'Rank 2 method, F1 97.62%' },
  { key: 'llama',             label: 'LLaMA (Individual)',             color: C.purple, desc: 'Rank 3 method, F1 97.58%' },
]

const pct  = v => `${(v * 100).toFixed(2)}%`
const pct1 = v => v != null ? `${(v * 100).toFixed(1)}%` : '-'

// â”€â”€ Reusable small components â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const Bar = ({ value, color, height = 8 }) => (
  <div style={{ background: '#eef3f8', borderRadius: 4, height, overflow: 'hidden', flex: 1 }}>
    <div style={{ background: color, height: '100%', width: `${value * 100}%`, borderRadius: 4, transition: 'width 0.6s ease' }} />
  </div>
)

const MetricCard = ({ label, value, color, sub }) => (
  <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: '14px 16px' }}>
    <div style={{ color: C.muted, fontSize: 10, fontFamily: 'Space Mono', letterSpacing: '0.1em', marginBottom: 6 }}>{label}</div>
    <div style={{ color, fontSize: 22, fontWeight: 700, fontFamily: 'Space Mono' }}>{value}</div>
    {sub && <div style={{ color: C.muted, fontSize: 11, marginTop: 4 }}>{sub}</div>}
  </div>
)

const StatusBadge = ({ status }) => {
  const map = { pending: [C.muted,'WAIT'], running: [C.blue,'RUN'], done: [C.green,'DONE'], failed: [C.red,'FAIL'] }
  const [color, icon] = map[status] || [C.muted,'?']
  return (
    <span style={{ fontSize: 11, color, background: `${color}18`, border: `1px solid ${color}30`,
      padding: '2px 8px', borderRadius: 20, fontFamily: 'Space Mono', whiteSpace: 'nowrap' }}>
      {icon} {status.toUpperCase()}
    </span>
  )
}

// â”€â”€ Confusion Matrix renderer â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const ConfusionMatrix = ({ matrix }) => {
  if (!matrix || matrix.length < 2) return null
  const [[tn, fp], [fn, tp]] = matrix
  const total = tn + fp + fn + tp

  const Cell = ({ v, label, color, isMain }) => (
    <div style={{ background: isMain ? `${color}22` : `${color}08`, border: `1px solid ${color}30`,
      borderRadius: 8, padding: '12px 8px', textAlign: 'center', flex: 1 }}>
      <div style={{ fontFamily: 'Space Mono', fontSize: 20, fontWeight: 700, color }}>{v}</div>
      <div style={{ fontSize: 10, color: C.muted, marginTop: 4 }}>{label}</div>
      <div style={{ fontSize: 10, color, marginTop: 2 }}>{((v / total) * 100).toFixed(1)}%</div>
    </div>
  )

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 10, color: C.muted, fontFamily: 'Space Mono' }}>
        <span>PREDICTED</span>
        <span style={{ marginLeft: 'auto' }}>Safe / Phishing</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <Cell v={tn} label="True Negative"  color={C.green}  isMain={true}  />
        <Cell v={fp} label="False Positive" color={C.yellow} isMain={false} />
        <Cell v={fn} label="False Negative" color={C.orange} isMain={false} />
        <Cell v={tp} label="True Positive"  color={C.blue}   isMain={true}  />
      </div>
      <div style={{ fontSize: 11, color: C.muted, marginTop: 8, textAlign: 'center' }}>
        Total test samples: {total} - Correct: {tn + tp} ({(((tn + tp) / total) * 100).toFixed(1)}%)
      </div>
    </div>
  )
}

// â”€â”€ Classification Report table â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const ClassificationReport = ({ report }) => {
  if (!report) return null
  const classes = ['safe', 'phishing']
  const rows    = ['macro avg', 'weighted avg']

  const Th = ({ children }) => (
    <th style={{ padding: '8px 12px', textAlign: 'right', fontSize: 10, color: C.muted, fontFamily: 'Space Mono', letterSpacing: '0.08em', borderBottom: `1px solid ${C.border}` }}>{children}</th>
  )
  const Td = ({ children, color, left }) => (
    <td style={{ padding: '9px 12px', textAlign: left ? 'left' : 'right', fontSize: 13, color: color || C.text, fontFamily: left ? 'DM Sans' : 'Space Mono' }}>{children}</td>
  )
  const Row = ({ key2, label, data, color }) => (
    <tr style={{ borderBottom: `1px solid ${C.border}20` }}>
      <Td left color={color || C.text}>{label}</Td>
      <Td color={C.blue}>{data?.precision != null ? pct1(data.precision) : '-'}</Td>
      <Td color={C.green}>{data?.recall    != null ? pct1(data.recall)    : '-'}</Td>
      <Td color={C.purple}>{data?.['f1-score'] != null ? pct1(data['f1-score']) : '-'}</Td>
      <Td color={C.muted}>{data?.support ?? '-'}</Td>
    </tr>
  )

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <Th>&nbsp;</Th><Th>Precision</Th><Th>Recall</Th><Th>F1-score</Th><Th>Support</Th>
          </tr>
        </thead>
        <tbody>
          {classes.map(cls => <Row key2={cls} label={cls.charAt(0).toUpperCase()+cls.slice(1)} data={report[cls]} color={cls === 'phishing' ? C.red : C.green} />)}
          <tr><td colSpan={5} style={{ padding: '4px 0' }} /></tr>
          {rows.map(r => <Row key2={r} label={r} data={report[r]} color={C.muted} />)}
          {report.accuracy != null && (
            <tr style={{ borderTop: `1px solid ${C.border}` }}>
              <Td left color={C.yellow}>Accuracy</Td>
              <Td color={C.yellow}></Td><Td color={C.yellow}></Td>
              <Td color={C.yellow}>{pct1(report.accuracy)}</Td>
              <Td color={C.muted}>{report['weighted avg']?.support ?? ''}</Td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

// â”€â”€ Progress bar component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const ProgressBar = ({ progress, step, status }) => {
  const color = status === 'failed' ? C.red : status === 'done' ? C.green : C.blue
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: 13, color: C.muted }}>{step || 'Waiting...'}</span>
        <span style={{ fontFamily: 'Space Mono', fontSize: 13, color }}>{progress}%</span>
      </div>
      <div style={{ height: 8, background: '#eef3f8', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${progress}%`, background: color, borderRadius: 4,
          transition: 'width 0.4s ease', boxShadow: status === 'running' ? `0 0 8px ${color}60` : 'none' }} />
      </div>
    </div>
  )
}

// =============================================================================
// Main Component
// =============================================================================
export default function ResearcherPage() {

  // â”€â”€ LIVE METRICS from DB (replaces static INDIVIDUAL_MODELS when available) â”€â”€
  const [liveModels, setLiveModels] = useState([])
  useEffect(() => {
    api.get('/research/models')
      .then(res => { if (res.data && res.data.length > 0) setLiveModels(res.data) })
      .catch(() => {})
  }, [])

  const modelsToShow = liveModels.length > 0
    ? liveModels.map(m => ({
        name: m.display_name, key: m.model_key,
        accuracy: m.accuracy ?? 0, precision: m.precision ?? 0,
        recall: m.recall ?? 0, f1: m.f1_score ?? 0,
        auc: m.auc_score ?? null,
        color: m.model_key === 'stacking_rf' ? C.orange
             : m.model_key === 'stacking_logistic' ? C.yellow
             : m.model_key === 'llama' ? C.purple : C.gray,
        type: m.model_key.startsWith('stacking') ? 'Stacking' : 'Deep Learning',
        deployed: m.is_deployed, version: m.version,
      }))
    : INDIVIDUAL_MODELS


  const [tab, setTab]       = useState('overview')

  // â”€â”€ Train tab state â”€â”€
  const [uploadedPath, setUploadedPath] = useState(null)
  const [uploadedName, setUploadedName] = useState(null)
  const [uploadedRows, setUploadedRows] = useState(null)
  const [uploading,    setUploading]    = useState(false)
  const [uploadError,  setUploadError]  = useState(null)
  const [dragOver,     setDragOver]     = useState(false)

  const [selectedModel,  setSelectedModel]  = useState('stacking_rf')
  const [training,       setTraining]       = useState(false)
  const [currentRun,     setCurrentRun]     = useState(null)  // TrainingRun object
  const [trainError,     setTrainError]     = useState(null)
  const [deployMsg,      setDeployMsg]      = useState(null)

  // â”€â”€ Models tab state â”€â”€
  const [trainedModels, setTrainedModels] = useState([])
  const [allRuns,       setAllRuns]       = useState([])
  const [selectedRun,   setSelectedRun]   = useState(null)  // run to show details

  const pollRef = useRef(null)

  // â”€â”€ Load model list when models tab opens â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  useEffect(() => {
    if (tab === 'models') loadModels()
    if (tab === 'train')  loadRuns()
  }, [tab])

  const loadModels = async () => {
    try {
      const { data } = await api.get('/research/models')
      setTrainedModels(data)
    } catch (e) { console.error(e) }
  }

  const loadRuns = async () => {
    try {
      const { data } = await api.get('/research/runs')
      setAllRuns(data)
    } catch (e) { console.error(e) }
  }

  // â”€â”€ Upload CSV â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const handleUpload = async (file) => {
    if (!file || !file.name.toLowerCase().endsWith('.csv')) {
      setUploadError('Please upload a CSV file'); return
    }
    setUploading(true); setUploadError(null)
    const form = new FormData()
    form.append('file', file)
    try {
      const { data } = await api.post('/research/upload', form, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      setUploadedPath(data.saved_path)
      setUploadedName(data.filename)
      setUploadedRows(data.row_count)
    } catch (e) {
      setUploadError(e.response?.data?.detail || 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const onDrop = (e) => {
    e.preventDefault(); setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleUpload(file)
  }

  // â”€â”€ Start training â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const handleTrain = async () => {
    if (!uploadedPath) return
    setTraining(true); setTrainError(null); setCurrentRun(null)
    try {
      const { data } = await api.post('/research/train', {
        model_key:    selectedModel,
        dataset_path: uploadedPath,
      })
      // Start polling for status
      startPolling(data.run_id)
    } catch (e) {
      setTrainError(e.response?.data?.detail || 'Failed to start training')
      setTraining(false)
    }
  }

  // â”€â”€ Poll training status â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const startPolling = useCallback((runId) => {
    if (pollRef.current) clearInterval(pollRef.current)
    pollRef.current = setInterval(async () => {
      try {
        const { data } = await api.get(`/research/training/${runId}/status`)
        setCurrentRun(data)
        if (data.status === 'done' || data.status === 'failed') {
          clearInterval(pollRef.current)
          setTraining(false)
          if (data.status === 'done') loadModels()
        }
      } catch (e) {
        clearInterval(pollRef.current)
        setTraining(false)
      }
    }, 1500)
  }, [])

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current) }, [])

  // â”€â”€ Deploy model â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const handleDeploy = async (modelId, name) => {
    if (!window.confirm(`Deploy ${name} for production predictions?`)) return
    try {
      const { data } = await api.post(`/research/models/${modelId}/deploy`)
      setDeployMsg(data.message)
      loadModels()
      setTimeout(() => setDeployMsg(null), 4000)
    } catch (e) {
      setDeployMsg('Deploy failed: ' + (e.response?.data?.detail || e.message))
    }
  }

  // ==========================================================================
  // RENDER
  // ==========================================================================

  const tabs = ['overview', 'train', 'models', 'ensemble', 'dataset']

  return (
    <div style={{ color: C.text }}>
      <style>{`
        .res-grid-2  { display: grid; grid-template-columns: 1fr 1fr;               gap: 12px; margin-bottom: 20px; }
        .res-grid-3  { display: grid; grid-template-columns: 1fr 1fr 1fr;           gap: 12px; margin-bottom: 20px; }
        .res-grid-4  { display: grid; grid-template-columns: repeat(4,1fr);         gap: 12px; margin-bottom: 20px; }
        .res-grid-5  { display: grid; grid-template-columns: repeat(5,1fr);         gap: 12px; margin-bottom: 20px; }
        .model-select-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        @media(max-width:768px) {
          .res-grid-2,.res-grid-3,.res-grid-4,.res-grid-5 { grid-template-columns: 1fr 1fr; }
          .model-select-grid { grid-template-columns: 1fr; }
        }
        @media(max-width:480px) {
          .res-grid-2,.res-grid-3,.res-grid-4,.res-grid-5 { grid-template-columns: 1fr; }
        }
        .drop-zone { border: 2px dashed #cfd9e6; border-radius: 12px; padding: 32px 20px;
          text-align: center; cursor: pointer; transition: all 0.2s; }
        .drop-zone:hover,.drop-zone.over { border-color: #0784c3; background: #0784c308; }
        .run-row { padding: 12px 16px; border-bottom: 1px solid ${C.border}20;
          display: flex; gap: 12px; align-items: center; flex-wrap: wrap;
          cursor: pointer; transition: background 0.1s; }
        .run-row:hover { background: #f4f8fc; }
      `}</style>

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontFamily: 'Space Mono', fontSize: 22, color: C.text, margin: 0 }}>Researcher Dashboard</h1>
        <p style={{ color: C.muted, fontSize: 14, marginTop: 6 }}>
          Train models - View metrics - Deploy to production
        </p>
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
        {tabs.map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '8px 18px', borderRadius: 8, border: 'none',
            fontFamily: 'Space Mono', fontSize: 11, cursor: 'pointer',
            background: tab === t ? C.blue : C.card,
            color:      tab === t ? '#060810' : C.muted,
            letterSpacing: '0.05em', textTransform: 'uppercase',
          }}>{t}</button>
        ))}
      </div>

      {/* ================================================================== */}
      {/* OVERVIEW TAB                                                        */}
      {/* ================================================================== */}
      {tab === 'overview' && (
        <div>
          <div className="res-grid-5">
            <MetricCard label="BEST INDIVIDUAL"  value="LLaMA"       color={C.purple} sub="F1: 97.58%" />
            <MetricCard label="BEST ENSEMBLE"    value="Stacking RF" color={C.orange} sub="F1: 98.05%" />
            <MetricCard label="MODELS AVAILABLE" value="3"           color={C.purple} sub="Top 3 methods" />
            <MetricCard label="ENSEMBLE METHODS" value="2"           color={C.yellow} sub="Stacking" />
            <MetricCard label="DATASET SIZE"     value="18,650"      color={C.green}  sub="emails total" />
          </div>

          {/* Best model callout */}
          <div style={{ background: `${C.blue}12`, border: `1px solid ${C.blue}30`, borderRadius: 12, padding: 18, marginBottom: 16 }}>
            <div style={{ fontFamily: 'Space Mono', fontSize: 15, color: C.text, fontWeight: 700, marginBottom: 8 }}>
              Best Method: Stacking - Random Forest - F1: 98.05%
            </div>
            <div style={{ color: C.muted, fontSize: 14, lineHeight: 1.8 }}>
              Stacking - Random Forest achieved the highest F1 score in the final comparison table.
              Stacking - Logistic Regression ranked second at 97.62%, and LLaMA (Individual) ranked third at 97.58%.
            </div>
          </div>

          {/* All models accuracy bar chart */}
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 18 }}>
            <div style={{ fontFamily: 'Space Mono', fontSize: 15, color: C.text, marginBottom: 16 }}>F1 Comparison - Top Methods</div>
            {[...INDIVIDUAL_MODELS, ...ENSEMBLE_MODELS].map((m, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                <div style={{ width: 160, fontSize: 13, color: C.text, flexShrink: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.name}</div>
                <Bar value={m.accuracy} color={m.color} />
                <div style={{ width: 58, fontSize: 12, color: m.color, fontFamily: 'Space Mono', textAlign: 'right', flexShrink: 0 }}>{pct(m.accuracy)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ================================================================== */}
      {/* TRAIN TAB                                                           */}
      {/* ================================================================== */}
      {tab === 'train' && (
        <div>
          <div className="res-grid-2">
            {/* LEFT - Upload + model selection + train button */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

              {/* Dataset upload */}
              <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 18 }}>
                <div style={{ fontFamily: 'Space Mono', fontSize: 12, color: C.blue, marginBottom: 14, letterSpacing: '0.06em' }}>
                  STEP 1 - UPLOAD DATASET
                </div>

                <div
                  className={`drop-zone${dragOver ? ' over' : ''}`}
                  onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={onDrop}
                  onClick={() => document.getElementById('csv-input').click()}
                >
                  <div style={{ fontFamily: 'Space Mono', fontSize: 22, marginBottom: 8, color: C.blue }}>CSV</div>
                  <div style={{ fontFamily: 'Space Mono', fontSize: 12, color: C.muted }}>
                    {uploading ? 'Uploading...' : 'Drag & drop CSV or click to browse'}
                  </div>
                  <div style={{ fontSize: 11, color: C.muted, marginTop: 6 }}>
                    Columns: text, label (0=safe, 1=phishing)
                  </div>
                  <input id="csv-input" type="file" accept=".csv" style={{ display: 'none' }}
                    onChange={e => { if (e.target.files[0]) handleUpload(e.target.files[0]) }} />
                </div>

                {uploadError && (
                  <div style={{ marginTop: 10, padding: '8px 12px', borderRadius: 8, background: `${C.red}10`, border: `1px solid ${C.red}30`, color: C.red, fontSize: 13 }}>
                    {uploadError}
                  </div>
                )}

                {uploadedPath && (
                  <div style={{ marginTop: 12, padding: '10px 14px', borderRadius: 10, background: `${C.green}10`, border: `1px solid ${C.green}30` }}>
                    <div style={{ color: C.green, fontFamily: 'Space Mono', fontSize: 12, marginBottom: 4 }}>Dataset ready</div>
                    <div style={{ fontSize: 13, color: C.text }}>{uploadedName}</div>
                    {uploadedRows > 0 && <div style={{ fontSize: 11, color: C.muted, marginTop: 3 }}>{uploadedRows.toLocaleString()} rows detected</div>}
                  </div>
                )}
              </div>

              {/* Model selection */}
              <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 18 }}>
                <div style={{ fontFamily: 'Space Mono', fontSize: 12, color: C.blue, marginBottom: 14, letterSpacing: '0.06em' }}>
                  STEP 2 - SELECT METHOD
                </div>
                <div className="model-select-grid">
                  {TRAINABLE.map(m => {
                    const isActive = selectedModel === m.key
                    return (
                      <button key={m.key} onClick={() => setSelectedModel(m.key)} style={{
                        padding: '12px 14px', borderRadius: 10, cursor: 'pointer', textAlign: 'left',
                        border:     isActive ? `2px solid ${m.color}` : `1px solid ${C.border}`,
                        background: isActive ? `${m.color}14` : '#ffffff',
                        transition: 'all 0.15s',
                      }}>
                        <div style={{ fontFamily: 'Space Mono', fontSize: 12, color: isActive ? m.color : C.text, fontWeight: 700, marginBottom: 4 }}>{m.label}</div>
                        <div style={{ fontSize: 11, color: C.muted, lineHeight: 1.4 }}>{m.desc}</div>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Train button */}
              <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 18 }}>
                <div style={{ fontFamily: 'Space Mono', fontSize: 12, color: C.blue, marginBottom: 14, letterSpacing: '0.06em' }}>
                  STEP 3 - TRAIN
                </div>
                <button
                  onClick={handleTrain}
                  disabled={!uploadedPath || training}
                  style={{
                    width: '100%', padding: '14px', borderRadius: 10, border: 'none',
                    fontFamily: 'Space Mono', fontSize: 13, fontWeight: 700, letterSpacing: '0.08em',
                    cursor: (!uploadedPath || training) ? 'not-allowed' : 'pointer',
                    background: (!uploadedPath || training) ? '#d7e0ea' : C.blue,
                    color:      (!uploadedPath || training) ? '#4a6080' : '#060810',
                    transition: 'all 0.15s',
                  }}
                >
                  {training ? `Training ${TRAINABLE.find(m => m.key === selectedModel)?.label}...` : `Train ${TRAINABLE.find(m => m.key === selectedModel)?.label}`}
                </button>
                {!uploadedPath && (
                  <div style={{ fontSize: 11, color: C.muted, marginTop: 8, textAlign: 'center' }}>
                    Upload a dataset first
                  </div>
                )}
                {trainError && (
                  <div style={{ marginTop: 10, padding: '8px 12px', borderRadius: 8, background: `${C.red}10`, border: `1px solid ${C.red}30`, color: C.red, fontSize: 13 }}>
                    {trainError}
                  </div>
                )}
              </div>
            </div>

            {/* RIGHT - Live progress + results */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

              {/* Progress */}
              {(training || currentRun) && currentRun && (
                <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 18 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                    <span style={{ fontFamily: 'Space Mono', fontSize: 12, color: C.blue, letterSpacing: '0.06em' }}>TRAINING PROGRESS</span>
                    <StatusBadge status={currentRun.status} />
                  </div>
                  <ProgressBar progress={currentRun.progress} step={currentRun.current_step} status={currentRun.status} />
                  {currentRun.dataset_rows > 0 && (
                    <div style={{ fontSize: 11, color: C.muted, marginTop: 8 }}>
                      Dataset: {currentRun.dataset_filename} - {currentRun.dataset_rows?.toLocaleString()} rows
                    </div>
                  )}
                  {currentRun.error_message && (
                    <div style={{ marginTop: 10, padding: '8px 12px', borderRadius: 8, background: `${C.red}10`, border: `1px solid ${C.red}30`, color: C.red, fontSize: 13 }}>
                      {currentRun.error_message}
                    </div>
                  )}
                </div>
              )}

              {/* Results when done */}
              {currentRun?.status === 'done' && (
                <>
                  {/* Metrics summary */}
                  <div style={{ background: C.card, border: `1px solid ${C.green}30`, borderRadius: 12, padding: 18 }}>
                    <div style={{ fontFamily: 'Space Mono', fontSize: 12, color: C.green, marginBottom: 14, letterSpacing: '0.06em' }}>TRAINING COMPLETE</div>
                    <div className="res-grid-2">
                      <MetricCard label="ACCURACY"  value={pct1(currentRun.accuracy)}        color={C.blue}   />
                      <MetricCard label="F1 SCORE"  value={currentRun.f1 != null ? currentRun.f1.toFixed(4) : '-'} color={C.purple} />
                      <MetricCard label="PRECISION" value={pct1(currentRun.precision_score)} color={C.green}  />
                      <MetricCard label="RECALL"    value={pct1(currentRun.recall_score)}    color={C.yellow} />
                    </div>
                  </div>

                  {/* Confusion matrix */}
                  <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 18 }}>
                    <div style={{ fontFamily: 'Space Mono', fontSize: 12, color: C.muted, marginBottom: 14, letterSpacing: '0.06em' }}>CONFUSION MATRIX</div>
                    <ConfusionMatrix matrix={currentRun.confusion_matrix} />
                  </div>

                  {/* Classification report */}
                  <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 18 }}>
                    <div style={{ fontFamily: 'Space Mono', fontSize: 12, color: C.muted, marginBottom: 14, letterSpacing: '0.06em' }}>CLASSIFICATION REPORT</div>
                    <ClassificationReport report={currentRun.classification_report} />
                  </div>
                </>
              )}

              {/* Placeholder when no run yet */}
              {!currentRun && !training && (
                <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 40, textAlign: 'center' }}>
                  <div style={{ fontFamily: 'Space Mono', fontSize: 22, marginBottom: 12, color: C.blue }}>RESULTS</div>
                  <div style={{ fontFamily: 'Space Mono', fontSize: 12, color: C.muted }}>
                    Training results will appear here
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Recent runs list */}
          {allRuns.length > 0 && (
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden' }}>
              <div style={{ padding: '14px 16px', borderBottom: `1px solid ${C.border}` }}>
                <span style={{ fontFamily: 'Space Mono', fontSize: 12, color: C.muted, letterSpacing: '0.06em' }}>RECENT TRAINING RUNS</span>
              </div>
              {allRuns.slice(0, 8).map(run => (
                <div key={run.id} className="run-row" onClick={() => setSelectedRun(selectedRun?.id === run.id ? null : run)}>
                  <StatusBadge status={run.status} />
                  <span style={{ fontFamily: 'Space Mono', fontSize: 13, color: C.text, flex: 1 }}>{run.model_key}</span>
                  <span style={{ fontSize: 12, color: C.muted }}>{run.dataset_filename}</span>
                  {run.accuracy != null && <span style={{ fontFamily: 'Space Mono', fontSize: 12, color: C.blue }}>{pct1(run.accuracy)}</span>}
                  <span style={{ fontSize: 11, color: C.muted }}>{new Date(run.started_at).toLocaleString()}</span>
                </div>
              ))}
              {/* Expanded run details */}
              {selectedRun && (
                <div style={{ padding: 20, borderTop: `1px solid ${C.border}`, background: '#ffffff' }}>
                  <div className="res-grid-2">
                    <div>
                      <div style={{ fontFamily: 'Space Mono', fontSize: 11, color: C.muted, marginBottom: 10 }}>CONFUSION MATRIX</div>
                      <ConfusionMatrix matrix={selectedRun.confusion_matrix} />
                    </div>
                    <div>
                      <div style={{ fontFamily: 'Space Mono', fontSize: 11, color: C.muted, marginBottom: 10 }}>CLASSIFICATION REPORT</div>
                      <ClassificationReport report={selectedRun.classification_report} />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ================================================================== */}
      {/* MODELS TAB                                                          */}
      {/* ================================================================== */}
      {tab === 'models' && (
        <div>
          {deployMsg && (
            <div style={{ padding: '12px 16px', borderRadius: 10, background: `${C.green}12`, border: `1px solid ${C.green}30`, color: C.green, fontSize: 13, marginBottom: 16 }}>
              {deployMsg}
            </div>
          )}

          {trainedModels.length === 0 ? (
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 60, textAlign: 'center' }}>
              <div style={{ fontFamily: 'Space Mono', fontSize: 22, marginBottom: 14, color: C.blue }}>MODELS</div>
              <div style={{ fontFamily: 'Space Mono', fontSize: 13, color: C.muted }}>No trained models yet</div>
              <div style={{ fontSize: 13, color: C.muted, marginTop: 6 }}>Go to the Train tab to train your first model</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {trainedModels.map(m => (
                <div key={m.id} style={{ background: C.card, border: `1px solid ${m.is_deployed ? C.green + '50' : C.border}`, borderRadius: 12, overflow: 'hidden' }}>
                  {/* Header row */}
                  <div style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', borderBottom: `1px solid ${C.border}` }}>
                    <span style={{ fontFamily: 'Space Mono', fontSize: 14, color: C.text, fontWeight: 700 }}>{m.display_name}</span>
                    <span style={{ fontFamily: 'Space Mono', fontSize: 10, color: C.muted, background: '#eef3f8', padding: '2px 8px', borderRadius: 4 }}>{m.version}</span>
                    {m.is_deployed && (
                      <span style={{ fontFamily: 'Space Mono', fontSize: 10, color: C.green, background: `${C.green}18`, border: `1px solid ${C.green}40`, padding: '2px 8px', borderRadius: 4 }}>
                        DEPLOYED
                      </span>
                    )}
                    <span style={{ fontSize: 12, color: C.muted, marginLeft: 'auto' }}>{new Date(m.trained_at).toLocaleString()}</span>
                    {!m.is_deployed && (
                      <button onClick={() => handleDeploy(m.id, `${m.display_name} ${m.version}`)} style={{
                        padding: '6px 14px', borderRadius: 7, border: `1px solid ${C.blue}40`,
                        background: `${C.blue}12`, color: C.blue, cursor: 'pointer',
                        fontSize: 12, fontFamily: 'Space Mono',
                      }}>
                        Deploy
                      </button>
                    )}
                  </div>

                  {/* Metrics */}
                  <div style={{ padding: '14px 18px' }}>
                    <div className="res-grid-4">
                      <MetricCard label="ACCURACY"  value={pct1(m.accuracy)}  color={C.blue}   />
                      <MetricCard label="PRECISION" value={pct1(m.precision)} color={C.green}  />
                      <MetricCard label="RECALL"    value={pct1(m.recall)}    color={C.yellow} />
                      <MetricCard label="F1 SCORE"  value={m.f1_score != null ? m.f1_score.toFixed(4) : '-'} color={C.purple} />
                    </div>
                    {m.dataset_name && (
                      <div style={{ fontSize: 11, color: C.muted }}>Dataset: {m.dataset_name}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ================================================================== */}
      {/* ENSEMBLE TAB                                                        */}
      {/* ================================================================== */}
      {tab === 'ensemble' && (
        <div>
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: 16, marginBottom: 20 }}>
            <div style={{ fontFamily: 'Space Mono', fontSize: 12, color: C.blue, marginBottom: 8 }}>TOP METHODS - FINAL COLAB RESULTS</div>
            <div style={{ color: C.muted, fontSize: 14, lineHeight: 1.9 }}>
              The final analysis choices now use the top three F1-ranked methods from the Colab comparison table.
              Stacking methods combine base model predictions using a second-level learner.
              Stacking - Random Forest is the best method with F1 98.05%.
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px,1fr))', gap: 14, marginBottom: 20 }}>
            {[
              { title:'Rank 1', icon:'1', color:C.orange, acc:'98.05%', f1:'0.9805', desc:'Stacking - Random Forest ranked first by F1 score.' },
              { title:'Rank 2', icon:'2', color:C.yellow, acc:'97.62%', f1:'0.9762', desc:'Stacking - Logistic Regression ranked second by F1 score.' },
              { title:'Rank 3', icon:'3', color:C.purple, acc:'97.58%', f1:'0.9758', desc:'LLaMA (Individual) ranked third by F1 score.' },
            ].map((e, i) => (
              <div key={i} style={{ background: C.card, border: `1px solid ${e.color}30`, borderRadius: 12, padding: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                  <div>
                    <div style={{ fontFamily: 'Space Mono', fontSize: 20, marginBottom: 4, color: e.color }}>{e.icon}</div>
                    <div style={{ fontFamily: 'Space Mono', fontSize: 12, color: e.color }}>{e.title}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ color: C.blue, fontSize: 15, fontFamily: 'Space Mono', fontWeight: 700 }}>{e.acc}</div>
                    <div style={{ color: C.muted, fontSize: 11 }}>F1: {e.f1}</div>
                  </div>
                </div>
                <div style={{ color: C.muted, fontSize: 12, lineHeight: 1.6 }}>{e.desc}</div>
              </div>
            ))}
          </div>

          <div style={{ background: `${C.orange}12`, border: `2px solid ${C.orange}40`, borderRadius: 12, padding: 20, textAlign: 'center' }}>
            <div style={{ fontFamily: 'Space Mono', fontSize: 28, marginBottom: 8, color: C.orange }}>1</div>
            <div style={{ fontFamily: 'Space Mono', fontSize: 14, color: C.orange, marginBottom: 6 }}>Best Method: Stacking - Random Forest</div>
            <div style={{ color: C.text, fontSize: 14 }}>F1: <strong>98.05%</strong></div>
            <div style={{ color: C.muted, fontSize: 12, marginTop: 6 }}>This is the Rank 1 method from the final comparison table.</div>
          </div>
        </div>
      )}

      {/* ================================================================== */}
      {/* DATASET TAB                                                         */}
      {/* ================================================================== */}
      {tab === 'dataset' && (
        <div>
          <div className="res-grid-3">
            <MetricCard label="TOTAL EMAILS"   value="18,650" color={C.blue}   />
            <MetricCard label="SAFE"           value="11,322" color={C.green}  sub="60.7%" />
            <MetricCard label="PHISHING"       value="7,328"  color={C.red}    sub="39.3%" />
            <MetricCard label="TRAIN SPLIT"    value="70%"    color={C.yellow} sub="13,055 emails" />
            <MetricCard label="VAL SPLIT"      value="10%"    color={C.yellow} sub="1,865 emails" />
            <MetricCard label="TEST SPLIT"     value="20%"    color={C.yellow} sub="3,730 emails" />
          </div>

          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 18, marginBottom: 16 }}>
            <div style={{ fontFamily: 'Space Mono', fontSize: 14, color: C.text, marginBottom: 12 }}>Class Distribution</div>
            <div style={{ display: 'flex', borderRadius: 8, overflow: 'hidden', height: 28, marginBottom: 8 }}>
              <div style={{ width: '60.7%', background: C.green, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: '#ffffff', fontFamily: 'Space Mono', fontWeight: 700 }}>SAFE 60.7%</div>
              <div style={{ width: '39.3%', background: C.red,   display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: C.text,    fontFamily: 'Space Mono', fontWeight: 700 }}>PHISHING 39.3%</div>
            </div>
          </div>

          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 18, marginBottom: 16 }}>
            <div style={{ fontFamily: 'Space Mono', fontSize: 14, color: C.text, marginBottom: 14 }}>Training Configuration</div>
            {[
              ['Dataset',            'Phishing_Email.csv (Kaggle)'],
              ['Total emails',       '18,650 (after cleaning)'],
              ['Duplicates removed', '1,108'],
              ['Epochs',             '5 for all deep learning models'],
              ['Max token length',   '128 tokens'],
              ['Optimizer',          'AdamW'],
              ['Learning rate',      '2e-5'],
              ['Batch size',         '8 train / 8 eval'],
              ['LLaMA method',       'LoRA fine-tuning'],
              ['Logistic Reg',       'TF-IDF (max_features=10000) + sklearn'],
            ].map(([k, v], i) => (
              <div key={i} style={{ display: 'flex', padding: '9px 0', borderBottom: `1px solid ${C.border}20`, flexWrap: 'wrap', gap: 4 }}>
                <div style={{ width: 200, color: C.muted, fontSize: 13, flexShrink: 0 }}>{k}</div>
                <div style={{ color: C.text, fontSize: 13, fontFamily: 'Space Mono' }}>{v}</div>
              </div>
            ))}
          </div>

          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 18 }}>
            <div style={{ fontFamily: 'Space Mono', fontSize: 14, color: C.text, marginBottom: 12 }}>Top Phishing Keywords (EDA)</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {['email','money','free','click','account','http','verify','urgent','bank','password','prize','claim','offer','link','login','win','congratulations','credit','security','suspended'].map((kw, i) => (
                <span key={i} style={{ background: '#ff3b5c18', border: '1px solid #ff3b5c30', color: C.red, padding: '4px 10px', borderRadius: 20, fontSize: 12, fontFamily: 'Space Mono' }}>{kw}</span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

