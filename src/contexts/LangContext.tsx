import { createContext, useContext, useState, ReactNode } from 'react'
import type { Lang } from '../i18n'

interface LangContextType {
  lang: Lang
  setLang: (l: Lang) => void
  t: (key: string) => string
}

const translations: Record<Lang, Record<string, string>> = {
  ko: {
    dashboard: '대시보드', expo_group: '🏛  박람회', expo_overview: '📊  박람회 대시보드',
    exhibitions: '🏢  기존 박람회', schedule: '📅  박람회 일정 관리', payments: '💰  비용 결제 일정',
    create: '✏️  새 Proposal 작성', report: '📋  결과 보고서',
    sales_group: '💼  Sales', sales_dashboard: '📊  Sales 대시보드', sales_leads: '👥  Lead 관리',
    sales_funnel: '🔀  Sales Funnel', sales_followup: '📞  Follow-up 관리',
    sales_reports: '📈  Sales 리포트', sales_settings: '⚙️  Sales 설정', settings: '⚙️  설정',
    upcoming: '다가오는 일정', no_upcoming: '향후 60일 내 일정 없음',
    paid: '결제 완료', unpaid: '미결제', deposit: '계약금', final_pay: '잔금',
    total: '합계', edit: '편집', delete: '삭제', save: '저장', cancel: '취소', add: '추가', close: '닫기',
    settings_title: '설정', export_ppt: 'PPT 내보내기',
    sign_out: '로그아웃',
  },
  en: {
    dashboard: 'Dashboard', expo_group: '🏛  Exhibitions', expo_overview: '📊  Expo Dashboard',
    exhibitions: '🏢  Exhibition List', schedule: '📅  Schedule', payments: '💰  Payments',
    create: '✏️  New Proposal', report: '📋  Result Report',
    sales_group: '💼  Sales', sales_dashboard: '📊  Sales Dashboard', sales_leads: '👥  Lead Management',
    sales_funnel: '🔀  Sales Funnel', sales_followup: '📞  Follow-up',
    sales_reports: '📈  Sales Reports', sales_settings: '⚙️  Sales Settings', settings: '⚙️  Settings',
    upcoming: 'Upcoming Schedule', no_upcoming: 'No events in the next 60 days',
    paid: 'Paid', unpaid: 'Unpaid', deposit: 'Deposit', final_pay: 'Final',
    total: 'Total', edit: 'Edit', delete: 'Delete', save: 'Save', cancel: 'Cancel', add: 'Add', close: 'Close',
    settings_title: 'Settings', export_ppt: 'Export PPT',
    sign_out: 'Sign Out',
  }
}

const LangContext = createContext<LangContextType | null>(null)

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>('ko')

  function t(key: string): string {
    return translations[lang][key] || translations['ko'][key] || key
  }

  return (
    <LangContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LangContext.Provider>
  )
}

export function useLang() {
  const ctx = useContext(LangContext)
  if (!ctx) throw new Error('useLang must be used within LangProvider')
  return ctx
}
