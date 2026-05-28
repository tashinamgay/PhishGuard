const MODELS = [
  {
    key: 'stacking_rf',
    label: 'Stacking - Random Forest',
    color: '#0784c3',
    acc: '98.05%',
    meta: 'Rank 1 by F1 score',
  },
  {
    key: 'stacking_logistic',
    label: 'Stacking - Logistic Regression',
    color: '#11a88f',
    acc: '97.62%',
    meta: 'Rank 2 by F1 score',
  },
  {
    key: 'llama',
    label: 'LLaMA (Individual)',
    color: '#7c5fd6',
    acc: '97.58%',
    meta: 'Rank 3 by F1 score',
  },
]

export default function ModelSelector({ selected, onChange }) {
  return (
    <div className="panel">
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, alignItems: 'flex-start', marginBottom: 14 }}>
        <div>
          <h2 className="panel-title">Model selection</h2>
          <p className="panel-copy">Choose the ranked method used for classification. These options match the final Colab comparison table.</p>
        </div>
      </div>

      <div className="model-grid">
        {MODELS.map(model => {
          const isActive = selected === model.key
          return (
            <button
              key={model.key}
              type="button"
              className={`model-option${isActive ? ' active' : ''}`}
              style={{ '--model-color': model.color }}
              onClick={() => onChange(model.key)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                <span className="model-dot" />
                <span className="model-name">{model.label}</span>
              </div>
              <div className="model-meta">F1 {model.acc}</div>
              <div className="model-meta">{model.meta}</div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
