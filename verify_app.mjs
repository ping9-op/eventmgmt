import { chromium } from 'playwright'

const BASE = 'https://biz-eventmgmt.vercel.app'
const EMAIL = 'andrewc@gmeremit.com'
const PASSWORD = 'Csh061490!@'

const ss = (page, name) => page.screenshot({ path: `verify_${name}.png`, fullPage: true })

async function run() {
  const browser = await chromium.launch({ headless: true })
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } })
  const page = await ctx.newPage()

  const errors = []
  const findings = []
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()) })
  page.on('pageerror', err => errors.push('[PageError] ' + err.message))

  // ── 1. 로그인 ────────────────────────────────────────────────
  console.log('\n[1] 로그인 페이지...')
  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 20000 })
  await ss(page, '01_login')

  // 폼 구조 확인
  const inputs = await page.locator('input').all()
  for (const inp of inputs) {
    const type = await inp.getAttribute('type')
    const placeholder = await inp.getAttribute('placeholder')
    console.log(`  input type="${type}" placeholder="${placeholder}"`)
  }
  const buttons = await page.locator('button').all()
  for (const btn of buttons) {
    const text = await btn.innerText().catch(() => '')
    console.log(`  button: "${text}"`)
  }

  // 로그인 시도 — 이메일/비번 입력
  const emailInput = page.locator('input[type=email]').first()
  const pwInput = page.locator('input[type=password]').first()
  await emailInput.fill(EMAIL)
  await pwInput.fill(PASSWORD)
  await ss(page, '02_login_filled')

  // 제출 버튼 클릭 (type=submit 또는 텍스트로)
  const submitBtn = page.locator('button[type=submit], button:has-text("로그인"), button:has-text("Login"), button:has-text("Sign")').first()
  await submitBtn.click()

  // 네트워크 완료 대기
  await page.waitForLoadState('networkidle', { timeout: 12000 }).catch(() => {})
  await page.waitForTimeout(2000)
  const urlAfter = page.url()
  console.log('\n  로그인 후 URL:', urlAfter)
  await ss(page, '03_after_login')

  if (urlAfter.includes('/login')) {
    // 에러 메시지 확인
    const errText = await page.locator('[style*=color],[class*=error],[class*=Error]').allInnerTexts().catch(() => [])
    console.log('  화면 에러 텍스트:', errText.join(' | ').slice(0, 200))
    findings.push('❌ 로그인 실패 — URL이 /login에 머묌')
    await browser.close()
    return findings
  }

  console.log('  ✅ 로그인 성공')

  // ── 2. 대시보드 ────────────────────────────────────────────────
  console.log('\n[2] 대시보드...')
  await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {})
  await ss(page, '04_dashboard')
  const cardCount = await page.locator('[style*="border-radius: 14px"],[style*="borderRadius: 14"],.card,.metric').count()
  console.log('  카드 요소:', cardCount)

  // JS 에러 체크
  if (errors.length > 0) {
    const unique = [...new Set(errors)]
    unique.slice(0, 5).forEach(e => {
      console.log('  ❌ JS Error:', e.slice(0, 150))
      findings.push('❌ JS 에러: ' + e.slice(0, 120))
    })
  } else {
    console.log('  ✅ JS 콘솔 에러 없음')
  }

  // ── 3. 박람회 대시보드 ──────────────────────────────────────────
  console.log('\n[3] 박람회 대시보드...')
  await page.goto(BASE + '/expo/overview', { waitUntil: 'networkidle', timeout: 10000 })
  await ss(page, '05_expo_overview')
  const canvases = await page.locator('canvas').count()
  console.log('  도넛 차트(canvas):', canvases > 0 ? `✅ ${canvases}개` : '❌ 없음')
  if (canvases === 0) findings.push('⚠️ 박람회 대시보드 도넛 차트 미표시')

  // ── 4. 기존 박람회 ──────────────────────────────────────────────
  console.log('\n[4] 기존 박람회...')
  await page.goto(BASE + '/expo/exhibitions', { waitUntil: 'networkidle', timeout: 10000 })
  await ss(page, '06_exhibitions')
  const exhCards = await page.locator('.exh-card').count()
  console.log('  박람회 카드:', exhCards > 0 ? `✅ ${exhCards}개` : '⚠️ 0개')

  // ── 5. 일정 관리 ────────────────────────────────────────────────
  console.log('\n[5] 일정 관리...')
  await page.goto(BASE + '/expo/schedule', { waitUntil: 'networkidle', timeout: 10000 })
  await ss(page, '07_schedule')
  const yrSec = await page.locator('.yr-section,.yr-header').count()
  console.log('  연도 섹션:', yrSec > 0 ? `✅ ${yrSec}개` : '⚠️ 없음')

  // ── 6. 결제 일정 ────────────────────────────────────────────────
  console.log('\n[6] 결제 일정...')
  await page.goto(BASE + '/expo/payments', { waitUntil: 'networkidle', timeout: 10000 })
  await ss(page, '08_payments')
  const payItems = await page.locator('.pay-list-item').count()
  console.log('  결제 목록:', payItems > 0 ? `✅ ${payItems}개` : '⚠️ 없음')

  // ── 7. Proposal 작성 ────────────────────────────────────────────
  console.log('\n[7] Proposal 작성...')
  await page.goto(BASE + '/expo/create', { waitUntil: 'networkidle', timeout: 10000 })
  await ss(page, '09_proposal')
  const steps = await page.locator('.step').count()
  console.log('  Step 수:', steps === 4 ? `✅ 4개` : `❌ ${steps}개 (예상: 4)`)
  if (steps !== 4) findings.push(`❌ Proposal 스텝 수 이상: ${steps}개`)

  // ── 8. 결과 보고서 ──────────────────────────────────────────────
  console.log('\n[8] 결과 보고서...')
  await page.goto(BASE + '/expo/report', { waitUntil: 'networkidle', timeout: 10000 })
  await ss(page, '10_report')
  const reportItems = await page.locator('.report-list-item').count()
  console.log('  보고서 목록:', reportItems > 0 ? `✅ ${reportItems}개` : '⚠️ 없음')

  // ── 9. 이벤트 상세 ──────────────────────────────────────────────
  console.log('\n[9] 이벤트 상세 (ExpoOverview → 카드 클릭)...')
  await page.goto(BASE + '/expo/overview', { waitUntil: 'networkidle', timeout: 10000 })
  // 박람회 카드나 범례 클릭 시도
  const exhCardLink = page.locator('.exh-card').first()
  if (await exhCardLink.count() > 0) {
    await exhCardLink.click()
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {})
  }
  const evUrl = page.url()
  console.log('  이동 URL:', evUrl)
  if (evUrl.includes('/event/')) {
    await ss(page, '11_event_detail')
    const tabs = await page.locator('.ev-tab').count()
    console.log('  이벤트 탭 수:', tabs >= 7 ? `✅ ${tabs}개` : `⚠️ ${tabs}개`)
    if (tabs < 7) findings.push(`⚠️ 이벤트 상세 탭 ${tabs}개 (예상 7)`)

    // Budget 탭
    await page.locator('.ev-tab').filter({ hasText: /budget|예산/i }).click().catch(() => {})
    await page.waitForTimeout(800)
    await ss(page, '12_event_budget')
    const summaryCards = await page.locator('[style*="EFF6FF"],[style*="ECFDF5"],[style*="FEF2F2"]').count()
    console.log('  Budget 탭 요약 카드:', summaryCards > 0 ? `✅ ${summaryCards}개` : '⚠️ 없음')

    // Checklist 탭
    await page.locator('.ev-tab').filter({ hasText: /checklist|체크/i }).click().catch(() => {})
    await page.waitForTimeout(800)
    await ss(page, '13_event_checklist')
    const clCards = await page.locator('[id^=clcard]').count()
    console.log('  체크리스트 카드:', clCards > 0 ? `✅ ${clCards}개` : '⚠️ 없음')
  } else {
    findings.push('⚠️ 이벤트 상세 페이지 진입 실패')
    console.log('  ⚠️ 이벤트 상세 진입 안됨')
  }

  // ── 10. Sales 대시보드 ──────────────────────────────────────────
  console.log('\n[10] Sales 대시보드...')
  await page.goto(BASE + '/sales/dashboard', { waitUntil: 'networkidle', timeout: 10000 })
  await ss(page, '14_sales_dashboard')
  const kpis = await page.locator('[style*="fontWeight: 800"],[style*="font-weight: 800"]').count()
  console.log('  KPI 수치 요소:', kpis)

  // ── 11. Sales Reports ───────────────────────────────────────────
  console.log('\n[11] Sales Reports...')
  await page.goto(BASE + '/sales/reports', { waitUntil: 'networkidle', timeout: 10000 })
  await ss(page, '15_sales_reports')
  const periodAll = await page.locator('button:has-text("전체"), button:has-text("All Time")').count()
  console.log('  기간 필터(전체):', periodAll > 0 ? '✅' : '❌ 없음')
  if (periodAll === 0) findings.push('❌ Sales Reports 기간 필터 버튼 없음')
  const stageSection = await page.locator('text=단계 전환, text=Stage Duration').count()
  console.log('  단계 전환 소요일 섹션:', stageSection > 0 ? '✅' : '❌ 없음')
  if (stageSection === 0) findings.push('❌ Sales Reports 단계 전환 섹션 없음')

  // ── 12. Sales Lead 등록 모달 ────────────────────────────────────
  console.log('\n[12] Sales Leads — 리드 등록 모달...')
  await page.goto(BASE + '/sales/leads', { waitUntil: 'networkidle', timeout: 10000 })
  await ss(page, '16_sales_leads')
  const regBtn = await page.locator('button:has-text("등록"), button:has-text("Register")').first()
  if (await regBtn.count() > 0) {
    await regBtn.click()
    await page.waitForTimeout(600)
    await ss(page, '17_lead_register_modal')
    const modalVisible = await page.locator('.modal-bg.open, [class*=modal]').count()
    console.log('  등록 모달:', modalVisible > 0 ? '✅ 열림' : '⚠️ 안열림')
    // 모달 닫기
    await page.keyboard.press('Escape').catch(() => {})
    await page.locator('button:has-text("취소"), button:has-text("✕"), .modal-close').first().click().catch(() => {})
  }

  // ── 13. Sales Funnel (3개 탭) ───────────────────────────────────
  console.log('\n[13] Sales Funnel...')
  await page.goto(BASE + '/sales/funnel', { waitUntil: 'networkidle', timeout: 10000 })
  await ss(page, '18_funnel_board')
  const proposalTab = await page.locator('text=Proposal').count()
  console.log('  Proposal 탭:', proposalTab > 0 ? '✅' : '❌ 없음')
  if (proposalTab === 0) findings.push('❌ Funnel Proposal 탭 없음')
  await page.locator('div:has-text("Proposal")').filter({ has: page.locator('div') }).first().click().catch(() => {})
  await page.waitForTimeout(600)
  await ss(page, '19_funnel_proposal')

  // ── 14. 모바일 반응형 ────────────────────────────────────────────
  console.log('\n[14] 모바일 반응형 (375px)...')
  const mobilePage = await ctx.newPage()
  await mobilePage.setViewportSize({ width: 375, height: 812 })
  await mobilePage.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 12000 })
  await mobilePage.screenshot({ path: 'verify_20_mobile.png', fullPage: false })
  const hamburger = await mobilePage.locator('.topbar-hamburger').isVisible().catch(() => false)
  console.log('  햄버거 버튼 표시:', hamburger ? '✅' : '❌ 미표시')
  if (!hamburger) findings.push('❌ 모바일 햄버거 버튼 미표시')
  const sidebarHidden = !(await mobilePage.locator('.sidebar').isVisible().catch(() => true))
  console.log('  사이드바 기본 숨김:', sidebarHidden ? '✅' : '⚠️ 보임')
  // 햄버거 클릭 → 사이드바 열리는지
  if (hamburger) {
    await mobilePage.locator('.topbar-hamburger').click()
    await mobilePage.waitForTimeout(400)
    await mobilePage.screenshot({ path: 'verify_21_mobile_sidebar.png' })
    const sidebarOpen = await mobilePage.locator('.sidebar.sidebar-mobile-open').isVisible().catch(() => false)
    console.log('  햄버거 클릭 후 사이드바 열림:', sidebarOpen ? '✅' : '❌')
    if (!sidebarOpen) findings.push('⚠️ 모바일 사이드바 열림 동작 미확인')
  }
  await mobilePage.close()

  // ── 최종 JS 에러 ─────────────────────────────────────────────────
  console.log('\n── 콘솔 에러 요약 ──')
  const uniqueErrs = [...new Set(errors)].filter(e => !e.includes('favicon'))
  if (uniqueErrs.length === 0) {
    console.log('  ✅ JS 콘솔 에러 없음')
  } else {
    uniqueErrs.slice(0, 8).forEach(e => {
      console.log('  ❌', e.slice(0, 140))
      findings.push('❌ JS 에러: ' + e.slice(0, 120))
    })
  }

  await browser.close()
  return findings
}

run().then(findings => {
  console.log('\n══════════════════════════════════════════')
  console.log('발견된 이슈 총합:')
  if (findings.length === 0) console.log('  없음 ✅')
  else findings.forEach(f => console.log(' ', f))
}).catch(err => {
  console.error('테스트 실행 오류:', err.message)
  process.exit(1)
})
