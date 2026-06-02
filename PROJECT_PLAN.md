# GME Event Management App — 개발 현황 및 방향 계획서

> 최종 업데이트: 2026-06-02  
> 기준: HTML 목업(prototype.html) vs React 앱 전체 코드 비교 + 실제 구현 확인

---

## 1. 구현 완료 현황 (코드 확인 기준)

### 1-1. Expo 모듈

| 기능 | 상태 | 비고 |
|------|------|------|
| 대시보드 (2×2 그리드, 박람회+Sales) | ✅ | Dashboard.tsx |
| 박람회 대시보드 (도넛차트, 순위테이블, 비용차트) | ✅ | ExpoOverview.tsx |
| 기존 박람회 목록 (카드, 이력 스크롤) | ✅ | Exhibitions.tsx |
| 일정 관리 (연도별 테이블) | ✅ | Schedule.tsx |
| 결제 일정 (선금/잔금 토글, 인보이스 업로드) | ✅ | Payments.tsx |
| 제안서 작성 (4단계 위저드, AI, 파일업로드) | ✅ | Proposal.tsx |
| 결과 보고서 (10개 섹션, PPT 내보내기) | ✅ | Report.tsx |
| 이벤트 상세 — Overview 탭 | ✅ | EventDetail.tsx |
| 이벤트 상세 — Budget 탭 (예산+결제 통합) | ✅ | EventDetail.tsx |
| 이벤트 상세 — Checklist 탭 (카드+서브아이템) | ✅ | EventDetail.tsx |
| 이벤트 상세 — Design 탭 | ✅ | EventDetail.tsx |
| 이벤트 상세 — Gifts 탭 (온보딩+이벤트) | ✅ | EventDetail.tsx |
| 이벤트 상세 — Equipment 탭 | ✅ | EventDetail.tsx |
| 이벤트 상세 — Itinerary 탭 | ✅ | EventDetail.tsx |

### 1-2. Sales 모듈

| 기능 | 상태 | 비고 |
|------|------|------|
| Sales 대시보드 (KPI, Funnel 바, Top Leads) | ✅ | SalesDashboard.tsx |
| Sales 대시보드 — 행사별 리드 현황 테이블 | ✅ 2026-06-02 추가 | SalesDashboard.tsx |
| 리드 목록 (그룹뷰/상세뷰, 일괄 작업, 엑셀 import) | ✅ | SalesLeads.tsx |
| 리드 상세 패널 (활동로그, 태스크, 제안서) | ✅ | LeadDetailPanel.tsx |
| Sales Funnel (Board/Table/Proposal 3탭) | ✅ | SalesFunnel.tsx |
| Follow-up 관리 (오늘/주간/기한초과/완료 필터) | ✅ | SalesFollowUp.tsx |
| Sales 리포트 (KPI + 4개 분석 섹션) | ✅ | SalesReports.tsx |
| Sales 리포트 — 기간 필터 (전체/이번달/3개월/올해) | ✅ 2026-06-02 추가 | SalesReports.tsx |
| Sales 리포트 — 국가 코리도별 분석 | ✅ 2026-06-02 추가 | SalesReports.tsx |
| Sales 설정 (마스터 데이터 관리) | ✅ | SalesSettings.tsx |

### 1-3. 공통 인프라

| 기능 | 상태 | 비고 |
|------|------|------|
| Supabase 인증 (이메일/패스워드) | ✅ | AuthContext.tsx |
| 한국어/영어 전환 | ✅ 1,050+ 키 | LangContext + i18n/index.ts |
| 토스트 알림 | ✅ | ToastContext.tsx |
| 박람회 표시명 형식 통일 (이름(KEY)) | ✅ 2026-06-02 추가 | utils.ts exhDisplayName |
| 타입 정의 (DB + 앱레벨) | ✅ 수정됨 | types/database.ts |

---

## 2. 남은 개발 항목

### 🟡 MEDIUM — 2~4주

| # | 항목 | 설명 | 파일 |
|---|------|------|------|
| 1 | **Sales Reports 단계 전환 소요일** | 각 스테이지 평균 체류 기간 계산. stage_history 테이블 필요 또는 activities 근사 계산 | SalesReports.tsx + Supabase |
| 2 | **LeadDetailPanel 활동 로그 개선** | activity_type별 아이콘, 인라인 편집, 필터 | LeadDetailPanel.tsx |
| 3 | **결과 보고서 사진 Supabase Storage** | 현재 base64 → Storage URL로 전환 (대용량 문제) | Report.tsx + Supabase Storage |
| 4 | **Proposal 파일 업로드 AI 파싱** | Google AI API → Supabase Edge Function으로 이전 (키 보안) | Proposal.tsx |

### 🟢 LOW — 5주+

| # | 항목 | 설명 |
|---|------|------|
| 5 | **박람회 색상 DB화** | utils.ts 하드코딩 → exhibitions.color 컬럼 |
| 6 | **모바일 반응형** | 현재 데스크탑 전용 |
| 7 | **권한 관리** | Admin/Viewer 역할 기반 접근 제어 |
| 8 | **알림 시스템** | 결제 D-day, 팔로우업 기한 이메일 |
| 9 | **국가별 다국어** | 일본어(ja) 추가 |

---

## 3. 커밋 이력 (2026-06-02)

| 커밋 | 내용 |
|------|------|
| `e1c614f` | 박람회 표시명 통일 — exhDisplayName 헬퍼 전체 적용 |
| `14b99b5` | Sales Reports — 기간 필터 + 국가 코리도별 분석 + 타입 수정 |
| `57a7e0c` | Sales Dashboard — 행사별 리드 현황 섹션 추가 |

---

## 4. 기술 부채 메모

| 항목 | 심각도 | 현황 |
|------|--------|------|
| 박람회 색상 하드코딩 | 🟡 | utils.ts EXH_COLORS |
| 결과사진 base64 저장 | 🟡 | Report.tsx — Supabase Storage 이전 필요 |
| Google AI 키 클라이언트 노출 | 🔴 | VITE_ 변수 → Edge Function 이전 필요 |
| CSS 인라인 스타일 혼재 | 🟢 | 큰 이슈 아님, 점진 개선 가능 |
| 테스트 부재 | 🟡 | 단위/통합 테스트 전무 |

---

*이 문서는 코드 전체 분석 기반으로 주기적으로 업데이트합니다.*
