import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useLang } from '../../contexts/LangContext'

export default function Sidebar() {
  const navigate = useNavigate()
  const location = useLocation()
  const { t } = useLang()
  const [expoOpen, setExpoOpen] = useState(true)
  const [salesOpen, setSalesOpen] = useState(true)

  const active = (path: string) => location.pathname === path

  function NavItem({ path, label, sub }: { path: string; label: string; sub?: boolean }) {
    return (
      <div
        className={`nav-item${sub ? ' sub' : ''}${active(path) ? ' active' : ''}`}
        onClick={() => navigate(path)}
      >
        <div className="ind" />
        <div className="nm">{label}</div>
      </div>
    )
  }

  return (
    <div className="sidebar">
      <div className="sb-logo" onClick={() => navigate('/')}>● GME EM</div>

      <NavItem path="/" label={`📊  ${t('dashboard')}`} />

      <div className={`nav-group${expoOpen ? ' open' : ''}`}>
        <div className="nav-group-header" onClick={() => setExpoOpen(o => !o)}>
          <span className="nav-group-label">{t('expo_group')}</span>
          <span className="nav-group-arrow">▶</span>
        </div>
        <div className="nav-group-items">
          <NavItem path="/expo/overview" label={t('expo_overview')} sub />
          <NavItem path="/expo/exhibitions" label={t('exhibitions')} sub />
          <NavItem path="/expo/schedule" label={t('schedule')} sub />
          <NavItem path="/expo/payments" label={t('payments')} sub />
          <NavItem path="/expo/create" label={t('create')} sub />
          <NavItem path="/expo/report" label={t('report')} sub />
        </div>
      </div>

      <div className={`nav-group${salesOpen ? ' open' : ''}`}>
        <div className="nav-group-header" onClick={() => setSalesOpen(o => !o)}>
          <span className="nav-group-label">{t('sales_group')}</span>
          <span className="nav-group-arrow">▶</span>
        </div>
        <div className="nav-group-items">
          <NavItem path="/sales/dashboard" label={t('sales_dashboard')} sub />
          <NavItem path="/sales/leads" label={t('sales_leads')} sub />
          <NavItem path="/sales/funnel" label={t('sales_funnel')} sub />
          <NavItem path="/sales/followup" label={t('sales_followup')} sub />
          <NavItem path="/sales/reports" label={t('sales_reports')} sub />
          <NavItem path="/sales/settings" label={t('sales_settings')} sub />
        </div>
      </div>

      <NavItem path="/settings" label={t('settings')} />

      <div className="sb-ver">v3.0 · GME Event Management</div>
    </div>
  )
}
