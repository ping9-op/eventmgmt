import { useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './contexts/AuthContext'
import { ToastProvider } from './contexts/ToastContext'
import { supabase } from './lib/supabase'
import { initExhColors } from './lib/utils'
import Layout from './components/layout/Layout'
import LoginPage from './components/auth/LoginPage'
import Dashboard from './components/pages/Dashboard'
import Exhibitions from './components/pages/Exhibitions'
import Schedule from './components/pages/Schedule'
import Payments from './components/pages/Payments'
import ExpoOverview from './components/pages/ExpoOverview'
import Proposal from './components/pages/Proposal'
import Report from './components/pages/Report'
import SalesDashboard from './components/pages/SalesDashboard'
import SalesLeads from './components/pages/SalesLeads'
import SalesFunnel from './components/pages/SalesFunnel'
import SalesFollowUp from './components/pages/SalesFollowUp'
import SalesReports from './components/pages/SalesReports'
import SalesSettings from './components/pages/SalesSettings'
import EventDetail from './components/pages/EventDetail'

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
        <Route index element={<Dashboard />} />
        <Route path="expo/overview" element={<ExpoOverview />} />
        <Route path="expo/exhibitions" element={<Exhibitions />} />
        <Route path="expo/schedule" element={<Schedule />} />
        <Route path="expo/payments" element={<Payments />} />
        <Route path="expo/create" element={<Proposal />} />
        <Route path="expo/report" element={<Report />} />
        <Route path="sales/dashboard" element={<SalesDashboard />} />
        <Route path="sales/leads" element={<SalesLeads />} />
        <Route path="sales/funnel" element={<SalesFunnel />} />
        <Route path="sales/followup" element={<SalesFollowUp />} />
        <Route path="sales/reports" element={<SalesReports />} />
        <Route path="sales/settings" element={<SalesSettings />} />
        <Route path="settings" element={<SalesSettings />} />
        <Route path="expo/event/:key/:year" element={<EventDetail />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
    </ToastProvider>
  )
}
