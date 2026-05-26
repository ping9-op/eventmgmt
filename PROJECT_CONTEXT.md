# GME Event Management App — 프로젝트 컨텍스트

## 개요
GME Remit 내부 툴. 박람회(Expo) 관리 + 세일즈 CRM 두 모듈로 구성.  
실 데이터 운영 중 (2026-05-22 DB 초기화 후 입력 진행).

## 스택
- **Frontend**: React 18 + TypeScript + Vite (Tailwind 없음, CSS 변수 기반 커스텀 스타일)
- **Backend**: Supabase (PostgreSQL + Auth)
- **배포**: Vercel → https://gme-eventmgmt.vercel.app (git push → 자동 배포)
- **라이브러리**: react-router-dom v6 (BrowserRouter), chart.js, pptxgenjs, xlsx

## 라우팅 구조 (src/App.tsx)
```
/login                    → LoginPage
/                         → Dashboard
/expo/overview            → ExpoOverview
/expo/exhibitions         → Exhibitions (박람회 목록)
/expo/schedule            → Schedule
/expo/payments            → Payments
/expo/create              → Proposal (신규 박람회 제안서)
/expo/report              → Report (결과 보고서 + PPT 내보내기)
/expo/event/:key/:year    → EventDetail (7탭: 개요/예산/체크리스트/디자인/선물/장비/일정)
/sales/dashboard          → SalesDashboard
/sales/leads              → SalesLeads
/sales/funnel             → SalesFunnel
/sales/followup           → SalesFollowUp
/sales/reports            → SalesReports
/sales/settings           → SalesSettings
```

## 파일 구조
```
src/
├── App.tsx
├── main.tsx
├── types/database.ts          ← Supabase DB 타입 정의 (핵심)
├── lib/utils.ts               ← 공통 유틸, 색상, 날짜 포맷, 상수
├── i18n/index.ts              ← 한국어/영어 번역 키 (이모지/기호 포함됨)
├── contexts/
│   ├── AuthContext.tsx
│   ├── ToastContext.tsx
│   └── LangContext.tsx
├── components/
│   ├── ProposalEditModal.tsx  ← Proposal 편집/삭제 모달
│   ├── auth/LoginPage.tsx
│   ├── layout/               ← Layout, TopBar, Sidebar
│   └── pages/                ← 모든 페이지 컴포넌트
```

## Supabase DB 테이블

### 박람회 모듈
| 테이블 | 용도 |
|--------|------|
| `exhibitions` | 박람회 기본정보. key 컬럼(예: KIF, KOEFA, SITF)으로 식별 |
| `proposals` | 제안서. exhibition_key + year로 FK |
| `payments` | 결제정보. key = `{exhibition.key}_{year}` |
| `results` | 결과 보고서 |
| `event_data` | EventDetail 7탭 JSON 데이터 |

### 세일즈 모듈
| 테이블 | 용도 |
|--------|------|
| `sales_leads` | 영업 리드 |
| `sales_activities` | 활동 로그 |
| `sales_tasks` | 팔로업 태스크 |
| `sales_proposals` | 영업 제안서 |

## 주요 패턴 / 설계 결정

### 결제 시스템 (PayCard — EventDetail 예산탭)
- 결제 방식: **일시불** | **선금/잔금**
- 결제 수단: **계좌이체** | **카드** (2가지만)
- 선금/잔금 비율(%) 입력 → 금액 자동 계산
- `payment_method`는 `final_due` 필드에 `"METHOD:{방법}"` 문자열로 인코딩 저장 (DB 스키마 변경 없이)
- 일시불 전환 시 `depAmt = p.total` (전체 금액)으로 세팅
- `payment total = deposit_amount + final_amount` 일치 중요

### i18n
- `src/i18n/index.ts`에 한국어/영어 번역 키 정의
- **번역 키 자체에 이모지/기호 포함됨** → JSX에서 추가하면 중복 표시됨
- `LangContext`로 전역 언어 토글

### 미저장 변경사항 보호 (EventDetail)
- 체크리스트/디자인/선물/장비/일정 수정 시 헤더 "● 미저장" 표시
- `safeNavigate()` 패턴 사용 (useBlocker 불가 — BrowserRouter와 비호환)
- 브라우저 새로고침 시 `beforeunload` 이벤트 경고

### ProposalEditModal
- `exhKey` prop 필수
- 저장 시 payments 테이블 자동 동기화 (항목 추가/삭제/금액변경 반영)
- cascade delete 지원

### EventDetail 예산↔결제일정 동기화
- 예산탭 수정 → 결제일정 자동 반영
- Proposal 데이터와 양방향 연동

## 주의사항
- **Supabase anon key로 DDL 불가** — 컬럼 추가 등은 Supabase 대시보드에서 직접
- **BrowserRouter 사용** → `useBlocker` 사용 불가, `safeNavigate` 패턴 사용
- **exhibition key** = 등록 시 apName에서 자동 파생 (첫 12자 알파벳/숫자), 필요 시 DB에서 수정
- **i18n 번역 키에 이모지** 포함 → JSX에서 중복 추가 금지
- **vercel.json**: index.html 캐시 no-store 설정 (구버전 서빙 방지)

## 현재 상태 (2026-05-26)
- 총 58 커밋
- 실 데이터 입력 중
- 결제 시스템 정상 동작 (일시불 depAmt 버그 수정 완료)
- 예산↔결제일정 자동 동기화 동작 중
- 한국어/영어 i18n 전체 적용

## GitHub / 배포
- **레포**: https://github.com/ping9-op/eventmgmt.git
- **배포**: https://gme-eventmgmt.vercel.app
- git push → Vercel 자동 배포 (~20~30초)
