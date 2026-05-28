// =============================================================================
// hooks/usePredict.js — Email Prediction Hook (with subject/headers support)
// =============================================================================

import { useState } from 'react'
import { predictEmail } from '../utils/api'

export function usePredict() {
  const [result,  setResult]  = useState(null)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState(null)

  const predict = async (emailText, modelKey = 'stacking_rf', subject = null, headers = null) => {
    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const data = await predictEmail(emailText, modelKey, subject, headers)
      setResult(data)
    } catch (err) {
      const msg = err.response?.data?.detail || 'Prediction failed. Is the backend running?'
      setError(typeof msg === 'string' ? msg : JSON.stringify(msg))
    } finally {
      setLoading(false)
    }
  }

  const reset = () => {
    setResult(null)
    setError(null)
  }

  return { result, loading, error, predict, reset }
}
