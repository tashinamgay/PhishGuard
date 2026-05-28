// =============================================================================
// utils/api.js — Axios API Client (Final Fixed Version)
// =============================================================================

import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
})

// ── Add JWT token to every request ───────────────────────────────────────────
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('phishguard_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// ── Handle 401 — only redirect on non-auth routes ────────────────────────────
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const url = error.config?.url || ''
      // DO NOT redirect on these auth routes — let the component handle the error
      const skipRedirect = [
        '/auth/login',
        '/auth/register',
        '/auth/verify-2fa',
        '/auth/enable-2fa',
        '/auth/disable-2fa',
        '/auth/setup-2fa',
      ]
      const shouldSkip = skipRedirect.some(path => url.includes(path))
      if (!shouldSkip) {
        localStorage.removeItem('phishguard_token')
        localStorage.removeItem('phishguard_user')
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)

// ── Auth ──────────────────────────────────────────────────────────────────────
export async function register(name, email, password, role = 'user') {
  const { data } = await api.post('/auth/register', { name, email, password, role })
  return data
}

export async function login(email, password) {
  const { data } = await api.post('/auth/login', { email, password })
  return data
}

export async function verify2FA(email, code) {
  const { data } = await api.post('/auth/verify-2fa', {
    email,
    code: String(code).trim()
  })
  return data
}

export async function setup2FA() {
  const { data } = await api.post('/auth/setup-2fa')
  return data
}

export async function enable2FA(code) {
  const codeStr = String(code).trim()
  const { data } = await api.post('/auth/enable-2fa', { code: codeStr })
  return data
}

export async function disable2FA(code) {
  const { data } = await api.post('/auth/disable-2fa', {
    code: String(code).trim()
  })
  return data
}

export async function getMe() {
  const { data } = await api.get('/auth/me')
  return data
}

// ── Prediction ────────────────────────────────────────────────────────────────
export async function predictEmail(emailText, modelKey = 'stacking_rf', subject = null, headers = null) {
  const payload = { email_text: emailText, model_key: modelKey }
  if (subject) payload.subject = subject
  if (headers) payload.headers = headers
  const { data } = await api.post('/predict', payload)
  return data
}

// Call this only when user clicks "Get AI Explanation" button
// Returns { explanation, source, rate_limited, retry_after }
export async function explainPrediction(predictionId) {
  const { data } = await api.post(`/explain/${predictionId}`)
  return data
}

export async function getHistory(limit = 50, offset = 0) {
  const { data } = await api.get('/history', { params: { limit, offset } })
  return data
}

export async function clearHistory() {
  const { data } = await api.delete('/history')
  return data
}

// ── Admin ─────────────────────────────────────────────────────────────────────
export async function getAdminUsers() {
  const { data } = await api.get('/admin/users')
  return data
}

export async function updateUser(userId, updates) {
  const { data } = await api.put(`/admin/users/${userId}`, updates)
  return data
}

export async function deleteUser(userId) {
  const { data } = await api.delete(`/admin/users/${userId}`)
  return data
}

export async function getAdminLogs() {
  const { data } = await api.get('/admin/logs')
  return data
}

export async function getAdminStats() {
  const { data } = await api.get('/admin/stats')
  return data
}

export default api
