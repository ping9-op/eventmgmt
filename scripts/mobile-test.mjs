import { chromium, devices } from 'playwright'
import { mkdirSync } from 'fs'
import { createClient } from '@supabase/supabase-js'

const URL = 'https://biz-eventmgmt.vercel.app'
const EMAIL = 'claude-test@emsf.internal'
const PASS = 'Test1234!'
const SUPABASE_URL = 'https://euyrqwrhevnmhovoidcn.supabase.co'
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV1eXJxd3JoZXZubWhvdm9pZGNuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgxMDk2NTMsImV4cCI6MjA5MzY4NTY1M30.kyO2N3yycSpwRQM1mw-Xk92TEyrJaOZgf8xvugjcaWA'

// 세션 미리 가져오기
const sb = createClient(SUPABASE_URL, ANON_KEY)
const { data: authData, error: authError } = await sb.auth.signInWithPassword({ email: EMAIL, password: PASS })
if (authError || !authData.session) {
  console.error('❌ Supabase 로그인 실패:', authError?.message)
  process.exit(1)
}
const SESSION = authData.session
console.log('✅ Supabase 세션 획득:', EMAIL)

const VIEWPORTS = [
  { name: 'iPhone14ProMax', ...devices['iPhone 14 Pro Max'] },
  { name: 'Android_Pixel7', ...devices['Pixel 7'] },
]

const PAGES = [
  { path: '/', name: '대시보드' },
  { path: '/expo/overview', name: '박람회_개요' },
  { path: '/expo/exhibitions', name: '박람회_목록' },
  { path: '/expo/schedule', name: '일정_관리' },
  { path: '/expo/payments', name: '결제_일정' },
  { path: '/expo/create', name: 'Proposal_작성' },
  { path: '/sales/dashboard', name: 'Sales_대시보드' },
  { path: '/sales/leads', name: 'Sales_리드' },
  { path: '/sales/funnel', name: 'Sales_펀널' },
  { path: '/sales/followup', name: 'Sales_팔로업' },
  { path: '/sales/reports', name: 'Sales_리포트' },
  { path: '/sales/settings', name: 'Sales_설정' },
]

const issues = []
mkdirSync('./test-screenshots', { recursive: true })

for (const device of VIEWPORTS) {
  console.log(`\n📱 테스트 디바이스: ${device.name} (${device.viewport?.width}x${device.viewport?.height})`)

  const browser = await chromium.launch({ headless: true })
  const ctx = await browser.newContext({ ...device, locale: 'ko-KR' })
  const page = await ctx.newPage()

  const consoleErrors = []
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text())
  })
  page.on('pageerror', err => consoleErrors.push(`PAGE ERROR: ${err.message}`))

  // 세션 쿠키/localStorage 주입으로 로그인 우회
  console.log('  🔑 세션 주입 중...')
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 20000 })

  // Supabase 세션을 localStorage에 주입
  const storageKey = `sb-euyrqwrhevnmhovoidcn-auth-token`
  await page.evaluate(({ key, session }) => {
    localStorage.setItem(key, JSON.stringify(session))
  }, { key: storageKey, session: SESSION })

  // 페이지 새로고침해서 세션 적용
  await page.goto(URL, { waitUntil: 'networkidle', timeout: 20000 })

  // 로그인 됐는지 확인
  const isLoggedIn = !page.url().includes('/login')
  if (!isLoggedIn) {
    issues.push({ device: device.name, page: 'login', issue: '세션 주입 후에도 로그인 안됨' })
    await browser.close()
    continue
  }
  console.log('  ✅ 로그인 성공')

  // 각 페이지 테스트
  for (const pg of PAGES) {
    const pageErrors = []
    page.removeAllListeners('console')
    page.on('console', msg => {
      if (msg.type() === 'error') pageErrors.push(msg.text())
    })

    console.log(`  📄 ${pg.name} 테스트 중...`)

    try {
      await page.goto(`${URL}${pg.path}`, { waitUntil: 'networkidle', timeout: 20000 })

      // 로딩 중 상태 체크 (5초 내 사라져야 함)
      const loadingEl = page.locator('text=로딩 중...')
      const isLoading = await loadingEl.isVisible().catch(() => false)
      if (isLoading) {
        await page.waitForFunction(
          () => !document.body.innerText.includes('로딩 중...'),
          { timeout: 8000 }
        ).catch(() => {
          issues.push({ device: device.name, page: pg.name, issue: '⚠️ 로딩 중 무한대기' })
        })
      }

      // 스크린샷
      const fname = `./test-screenshots/${device.name}_${pg.name}.png`
      await page.screenshot({ path: fname, fullPage: true })

      // 오버플로우 체크
      const overflow = await page.evaluate(() => {
        const body = document.body
        const scrollW = body.scrollWidth
        const clientW = body.clientWidth
        return scrollW > clientW + 5 ? `가로 오버플로우: body ${scrollW}px > viewport ${clientW}px` : null
      })
      if (overflow) {
        issues.push({ device: device.name, page: pg.name, issue: overflow })
      }

      // 버튼 터치타겟 체크 (44px 미만)
      const smallButtons = await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button, a[href]'))
        return btns.filter(el => {
          const r = el.getBoundingClientRect()
          return (r.width > 0 && r.height > 0) && (r.height < 36 || r.width < 36)
        }).map(el => ({
          text: el.textContent?.trim().slice(0, 30) || '',
          h: Math.round(el.getBoundingClientRect().height),
          w: Math.round(el.getBoundingClientRect().width),
        })).slice(0, 5)
      })
      if (smallButtons.length > 0) {
        issues.push({
          device: device.name, page: pg.name,
          issue: `터치 타겟 작음: ${smallButtons.map(b => `"${b.text}"(${b.w}x${b.h})`).join(', ')}`
        })
      }

      if (pageErrors.length > 0) {
        issues.push({ device: device.name, page: pg.name, issue: `콘솔 에러: ${pageErrors[0]}` })
      }

      console.log(`    ✅ 완료 ${overflow ? '⚠️ 오버플로우' : ''} ${smallButtons.length > 0 ? `⚠️ 작은버튼 ${smallButtons.length}개` : ''}`)

    } catch (err) {
      issues.push({ device: device.name, page: pg.name, issue: `❌ 에러: ${err.message?.slice(0, 80)}` })
      console.log(`    ❌ 실패: ${err.message?.slice(0, 60)}`)
    }
  }

  await browser.close()
}

// 결과 출력
console.log('\n' + '='.repeat(60))
console.log('📊 테스트 결과 요약')
console.log('='.repeat(60))

if (issues.length === 0) {
  console.log('✅ 모든 페이지 정상!')
} else {
  console.log(`\n⚠️ 발견된 이슈 ${issues.length}개:\n`)
  for (const i of issues) {
    console.log(`[${i.device}] ${i.page}: ${i.issue}`)
  }
}

console.log(`\n📁 스크린샷: ./test-screenshots/ (${VIEWPORTS.length * PAGES.length}장)`)
