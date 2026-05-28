// =============================================================================
// src/App.jsx — Root Application with Auth Routes (Week 6 + Week 8 + Week 9)
// =============================================================================

import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import Layout         from './components/Layout'
import DetectorPage   from './pages/DetectorPage'
import HistoryPage    from './pages/HistoryPage'
import LoginPage      from './pages/LoginPage'
import RegisterPage   from './pages/RegisterPage'
import AdminPage      from './pages/AdminPage'
import Setup2FAPage   from './pages/Setup2FAPage'
import ResearcherPage from './pages/ResearcherPage'

function ProtectedRoute({ children, allowedRoles }) {
  const { user, loading } = useAuth()
  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#0a0e1a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b7a99', fontFamily: 'Space Mono' }}>
      Loading...
    </div>
  )
  if (!user) return <Navigate to="/login" replace />
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    if (user.role === 'admin')      return <Navigate to="/admin"      replace />
    if (user.role === 'researcher') return <Navigate to="/researcher" replace />
    return <Navigate to="/detect" replace />
  }
  return children
}

function PublicRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return null
  if (user) {
    if (user.role === 'admin')      return <Navigate to="/admin"      replace />
    if (user.role === 'researcher') return <Navigate to="/researcher" replace />
    return <Navigate to="/detect" replace />
  }
  return children
}

export default function App() {
  return (
    <Routes>
      {/* ── Public Routes ── */}
      <Route path="/login"    element={<PublicRoute><LoginPage /></PublicRoute>} />
      <Route path="/register" element={<PublicRoute><RegisterPage /></PublicRoute>} />

      {/* ── Root redirect ── */}
      <Route path="/" element={<Navigate to="/detect" replace />} />

      {/* ── End User Routes ── */}
      <Route path="/detect" element={
        <ProtectedRoute allowedRoles={['user', 'researcher', 'admin']}>
          <Layout><DetectorPage /></Layout>
        </ProtectedRoute>
      } />
      <Route path="/history" element={
        <ProtectedRoute allowedRoles={['user', 'researcher', 'admin']}>
          <Layout><HistoryPage /></Layout>
        </ProtectedRoute>
      } />

      {/* ── 2FA Setup ── */}
      <Route path="/setup-2fa" element={
        <ProtectedRoute allowedRoles={['user', 'researcher', 'admin']}>
          <Layout><Setup2FAPage /></Layout>
        </ProtectedRoute>
      } />

      {/* ── Researcher Routes ── */}
      <Route path="/researcher" element={
        <ProtectedRoute allowedRoles={['researcher', 'admin']}>
          <Layout><ResearcherPage /></Layout>
        </ProtectedRoute>
      } />

      {/* ── Admin Routes ── */}
      <Route path="/admin" element={
        <ProtectedRoute allowedRoles={['admin']}>
          <AdminPage />
        </ProtectedRoute>
      } />

      {/* ── 404 fallback ── */}
      <Route path="*" element={<Navigate to="/detect" replace />} />
    </Routes>
  )
}
