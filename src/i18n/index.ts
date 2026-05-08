export type Lang = 'ko' | 'en'

const translations: Record<Lang, Record<string, string>> = {
  ko: {
    // Navigation
    dashboard: '대시보드',
    expo_group: '🏛  박람회',
    expo_overview: '📊  박람회 대시보드',
    exhibitions: '🏢  기존 박람회',
    schedule: '📅  박람회 일정 관리',
    payments: '💰  비용 결제 일정',
    create: '✏️  새 Proposal 작성',
    report: '📋  결과 보고서',
    sales_group: '💼  Sales',
    sales_dashboard: '📊  Sales 대시보드',
    sales_leads: '👥  Lead 관리',
    sales_funnel: '🔀  Sales Funnel',
    sales_followup: '📞  Follow-up 관리',
    sales_reports: '📈  Sales 리포트',
    sales_settings: '⚙️  Sales 설정',
    settings: '⚙️  설정',
    // Dashboard
    upcoming: '다가오는 일정',
    upcoming_sub: '앞으로 60일',
    no_upcoming: '향후 60일 내 일정 없음',
    summary: '전체 요약',
    // Common
    paid: '결제 완료',
    unpaid: '미결제',
    deposit: '계약금',
    final_pay: '잔금',
    total: '합계',
    edit: '편집',
    delete: '삭제',
    save: '저장',
    cancel: '취소',
    add: '추가',
    close: '닫기',
    // Settings
    settings_title: '설정',
    api_key_title: 'API Key 관리',
    // Report export
    export_ppt: 'PPT 내보내기',
  },
  en: {
    // Navigation
    dashboard: 'Dashboard',
    expo_group: '🏛  Exhibitions',
    expo_overview: '📊  Expo Dashboard',
    exhibitions: '🏢  Exhibition List',
    schedule: '📅  Schedule',
    payments: '💰  Payments',
    create: '✏️  New Proposal',
    report: '📋  Result Report',
    sales_group: '💼  Sales',
    sales_dashboard: '📊  Sales Dashboard',
    sales_leads: '👥  Lead Management',
    sales_funnel: '🔀  Sales Funnel',
    sales_followup: '📞  Follow-up',
    sales_reports: '📈  Sales Reports',
    sales_settings: '⚙️  Sales Settings',
    settings: '⚙️  Settings',
    // Dashboard
    upcoming: 'Upcoming Schedule',
    upcoming_sub: 'Next 60 days',
    no_upcoming: 'No events in the next 60 days',
    summary: 'Summary',
    // Common
    paid: 'Paid',
    unpaid: 'Unpaid',
    deposit: 'Deposit',
    final_pay: 'Final',
    total: 'Total',
    edit: 'Edit',
    delete: 'Delete',
    save: 'Save',
    cancel: 'Cancel',
    add: 'Add',
    close: 'Close',
    // Settings
    settings_title: 'Settings',
    api_key_title: 'API Key Management',
    // Report export
    export_ppt: 'Export PPT',
  }
}

let currentLang: Lang = 'ko'

export function setLang(lang: Lang) { currentLang = lang }
export function getLang(): Lang { return currentLang }
export function t(key: string): string {
  return translations[currentLang][key] || translations['ko'][key] || key
}
