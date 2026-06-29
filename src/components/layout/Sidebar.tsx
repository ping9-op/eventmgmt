import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useLang } from '../../contexts/LangContext'

// NavItem은 Sidebar 함수 외부에서 정의합니다.
// 내부에 정의하면 Sidebar 리렌더링 시마다 새 컴포넌트 참조가 생성되어
// React가 언마운트/리마운트를 반복해 DOM 재생성·포커스 손실·플리커가 발생합니다.
// Sidebar는 폼 dirty 상태를 관리하지 않으므로 safeNavigate 적용 대상이 아닙니다.
// (dirty 상태를 가진 페이지는 EventDetail 내부에서 자체적으로 처리합니다.)
function NavItem({
  path,
  label,
  sub,
  locationPathname,
  onNavigate,
}: {
  path: string
  label: string
  sub?: boolean
  locationPathname: string
  onNavigate: (path: string) => void
}) {
  const isActive = locationPathname === path || (path === '/expo/exhibitions' && locationPathname.startsWith('/expo/event/'))
  return (
    <div
      className={`nav-item${sub ? ' sub' : ''}${isActive ? ' active' : ''}`}
      onClick={() => onNavigate(path)}
    >
      <div className="ind" />
      <div className="nm">{label}</div>
    </div>
  )
}

export default function Sidebar({ open, onClose }: { open?: boolean; onClose?: () => void }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { t } = useLang()
  const [expoOpen, setExpoOpen] = useState(true)
  const [salesOpen, setSalesOpen] = useState(true)

  function handleNavigate(path: string) {
    navigate(path)
    onClose?.()
  }

  return (
    <div className={`sidebar${open ? ' sidebar-mobile-open' : ''}`}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div className="sb-logo" onClick={() => handleNavigate('/')}>● GME EM</div>
        {/* 모바일 닫기 버튼 */}
        <button className="sidebar-close-btn" onClick={onClose} aria-label="사이드바 닫기">✕</button>
      </div>

      <NavItem path="/" label={`📊  ${t('dashboard')}`} locationPathname={location.pathname} onNavigate={handleNavigate} />

      <div className={`nav-group${expoOpen ? ' open' : ''}`}>
        <div className="nav-group-header" onClick={() => setExpoOpen(o => !o)}>
          <span className="nav-group-label">{t('expo_group')}</span>
          <span className="nav-group-arrow">▶</span>
        </div>
        <div className="nav-group-items">
          <NavItem path="/expo/overview" label={t('expo_overview')} sub locationPathname={location.pathname} onNavigate={handleNavigate} />
          <NavItem path="/expo/exhibitions" label={t('exhibitions')} sub locationPathname={location.pathname} onNavigate={handleNavigate} />
          <NavItem path="/expo/schedule" label={t('schedule')} sub locationPathname={location.pathname} onNavigate={handleNavigate} />
          <NavItem path="/expo/payments" label={t('payments')} sub locationPathname={location.pathname} onNavigate={handleNavigate} />
          <NavItem path="/expo/create" label={t('create')} sub locationPathname={location.pathname} onNavigate={handleNavigate} />
          <NavItem path="/expo/report" label={t('report')} sub locationPathname={location.pathname} onNavigate={handleNavigate} />
        </div>
      </div>

      <div className={`nav-group${salesOpen ? ' open' : ''}`}>
        <div className="nav-group-header" onClick={() => setSalesOpen(o => !o)}>
          <span className="nav-group-label">{t('sales_group')}</span>
          <span className="nav-group-arrow">▶</span>
        </div>
        <div className="nav-group-items">
          <NavItem path="/sales/dashboard" label={t('sales_dashboard')} sub locationPathname={location.pathname} onNavigate={handleNavigate} />
          <NavItem path="/sales/leads" label={t('sales_leads')} sub locationPathname={location.pathname} onNavigate={handleNavigate} />
          <NavItem path="/sales/funnel" label={t('sales_funnel')} sub locationPathname={location.pathname} onNavigate={handleNavigate} />
          <NavItem path="/sales/followup" label={t('sales_followup')} sub locationPathname={location.pathname} onNavigate={handleNavigate} />
          <NavItem path="/sales/reports" label={t('sales_reports')} sub locationPathname={location.pathname} onNavigate={handleNavigate} />
          <NavItem path="/sales/settings" label={t('sales_settings')} sub locationPathname={location.pathname} onNavigate={handleNavigate} />
        </div>
      </div>

      <NavItem path="/settings" label={t('settings')} locationPathname={location.pathname} onNavigate={handleNavigate} />

      <div className="sb-ver">v3.0 · GME Event Management</div>
    </div>
  )
}
