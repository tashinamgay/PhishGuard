// =============================================================================
// src/components/Spinner.jsx — Loading Indicator
// =============================================================================
// Shown in the result panel while the backend is processing an email.
// Uses the CSS "spin" animation defined in index.html.
//
// Props:
//   message (string) — loading text to display below the spinner
//                      defaults to "Analysing..."
// =============================================================================

export default function Spinner({ message = 'Analysing...' }) {
  return (
    <div style={{
      width: '100%',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: '60px 0', gap: 16,
    }}>
      {/* Spinning circle — uses the @keyframes spin in index.html */}
      <div style={{
        width: 40, height: 40,
        borderRadius: '50%',
        border: '2px solid rgba(0,212,255,0.15)',  // faint full circle
        borderTopColor: '#00d4ff',                  // bright top segment
        animation: 'spin 0.9s linear infinite',
      }} />

      {/* Loading message */}
      <div style={{
        fontFamily: 'Space Mono', fontSize: 11,
        color: '#00d4ff',
        letterSpacing: '0.1em', textTransform: 'uppercase',
      }}>
        {message}
      </div>
    </div>
  )
}
