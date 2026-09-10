import { useEffect, lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './contexts/AuthContext'
import { ToastProvider } from './contexts/ToastContext'
import { supabase } from './lib/supabase'
import { initExhColors } from './lib/utils'
import Layout from './components/layout/Layout'
import LoginPage from './components/auth/LoginPage'
import LoadingSpinner from './components/LoadingSpinner'

const Dashboard = lazy(() => import('./components/pages/Dashboard'))
const Exhibitions = lazy(() => import('./components/pages/Exhibitions'))
const Schedule = lazy(() => import('./components/pages/Schedule'))
const Payments = lazy(() => import('./components/pages/Payments'))
const ExpoOverview = lazy(() => import('./components/pages/ExpoOverview'))
const Proposal = lazy(() => import('./components/pages/Proposal'))
const Report = lazy(() => import('./components/pages/Report'))
const SalesDashboard = lazy(() => import('./components/pages/SalesDashboard'))
const SalesLeads = lazy(() => import('./components/pages/SalesLeads'))
const SalesFunnel = lazy(() => import('./components/pages/SalesFunnel'))
const SalesFollowUp = lazy(() => import('./components/pages/SalesFollowUp'))
const SalesReports = lazy(() => import('./components/pages/SalesReports'))
const SalesSettings = lazy(() => import('./components/pages/SalesSettings'))
const EventDetail = lazy(() => import('./components/pages/EventDetail'))

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: 'var(--muted)' }}>로딩 중...</div>
  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
}

export default function App() {
  const { user, loading } = useAuth()

  // 앱 시작 시 박람회 색상을 DB에서 로드해 동적 색상 캐시 초기화
  useEffect(() => {
    if (!user) return
    supabase.from('exhibitions').select('name, color').then(({ data }) => {
      if (data) initExhColors(data as { name: string; color?: string | null }[])
    })
  }, [user])

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: 'var(--muted)' }}>로딩 중...</div>

  return (
    <ToastProvider>
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <LoginPage />} />
      <Route path="/" element={<RequireAuth><Layout /></RequireAuth>}>
        <Route index element={<Suspense fallback={<LoadingSpinner />}><Dashboard /></Suspense>} />
        <Route path="expo/overview" element={<Suspense fallback={<LoadingSpinner />}><ExpoOverview /></Suspense>} />
        <Route path="expo/exhibitions" element={<Suspense fallback={<LoadingSpinner />}><Exhibitions /></Suspense>} />
        <Route path="expo/schedule" element={<Suspense fallback={<LoadingSpinner />}><Schedule /></Suspense>} />
        <Route path="expo/payments" element={<Suspense fallback={<LoadingSpinner />}><Payments /></Suspense>} />
        <Route path="expo/create" element={<Suspense fallback={<LoadingSpinner />}><Proposal /></Suspense>} />
        <Route path="expo/report" element={<Suspense fallback={<LoadingSpinner />}><Report /></Suspense>} />
        <Route path="sales/dashboard" element={<Suspense fallback={<LoadingSpinner />}><SalesDashboard /></Suspense>} />
        <Route path="sales/leads" element={<Suspense fallback={<LoadingSpinner />}><SalesLeads /></Suspense>} />
        <Route path="sales/funnel" element={<Suspense fallback={<LoadingSpinner />}><SalesFunnel /></Suspense>} />
        <Route path="sales/followup" element={<Suspense fallback={<LoadingSpinner />}><SalesFollowUp /></Suspense>} />
        <Route path="sales/reports" element={<Suspense fallback={<LoadingSpinner />}><SalesReports /></Suspense>} />
        <Route path="sales/settings" element={<Suspense fallback={<LoadingSpinner />}><SalesSettings /></Suspense>} />
        <Route path="settings" element={<Suspense fallback={<LoadingSpinner />}><SalesSettings /></Suspense>} />
        <Route path="expo/event/:key/:year" element={<Suspense fallback={<LoadingSpinner />}><EventDetail /></Suspense>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
    </ToastProvider>
  )
}
