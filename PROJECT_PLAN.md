# GME Event Management App — 개발 현황 및 방향 계획서

> 최종 업데이트: 2026-06-02  
> 기준: HTML 목업(prototype.html) vs React 앱 전체 코드 비교 + 실제 구현 확인

---

## 1. 구현 완료 현황

### Expo 모듈

| 기능 | 상태 |
|------|------|
| 대시보드 (2×2 그리드, 박람회+Sales) | ✅ |
| 박람회 대시보드 (도넛차트, 순위, 비용차트) | ✅ |
| 기존 박람회 목록 (카드, 이력 스크롤) | ✅ |
| 일정 관리 (연도별 테이블) | ✅ |
| 결제 일정 (선금/잔금, 인보이스 업로드) | ✅ |
| 제안서 작성 (4단계 위저드, AI, 파일업로드) | ✅ |
| AI 변동사유 — Edge Function 보안 처리 | ✅ |
| 결과 보고서 (10개 섹션, PPT 내보내기) | ✅ |
| 결과 보고서 사진 — Supabase Storage | ✅ |
| 이벤트 상세 (Overview/Budget/Checklist/Design/Gifts/Equipment/Itinerary 7탭) | ✅ |

### Sales 모듈

| 기능 | 상태 |
|------|------|
| Sales 대시보드 (KPI, Funnel, Top Leads, 행사별 현황) | ✅ |
| 리드 목록 (그룹뷰/상세뷰, 일괄작업, 엑셀 import, corridor 필터) | ✅ |
| 리드 상세 패널 (Activity 타임라인 아이콘, 스테이지 빠른 버튼, Task 개선) | ✅ |
| Sales Funnel (Board/Table/Proposal 3탭) | ✅ |
| Follow-up 관리 (오늘/주간/기한초과/완료) | ✅ |
| Sales 리포트 (기간필터, Funnel/행사/코리도/Lost/담당자 분석) | ✅ |
| 단계 전환 소요일 분석 (실측+근사값 표시) | ✅ |
| 스테이지 이력 자동 수집 (SalesLeads/Funnel/LeadDetailPanel) | ✅ |
| Sales 설정 (마스터 데이터) | ✅ |

---

## 2. Supabase 설정 필요 항목

앱 배포 전 아래 SQL/명령을 Supabase에서 실행해야 합니다:

```bash
# 1. stage_history 테이블 생성
#    → Supabase Dashboard > SQL Editor에서 실행
#    파일: supabase/add_stage_history.sql

# 2. Storage 버킷 생성
#    파일: supabase/create_storage_buckets.sql

# 3. Edge Function 배포 (AI Proposal 키 보안)
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
supabase functions deploy ai-proposal
```

---

## 3. 남은 개발 항목 (LOW 우선순위)

| # | 항목 | 설명 |
|---|------|------|
| 1 | **박람회 색상 DB화** | utils.ts 하드코딩 → exhibitions.color 컬럼 |
| 2 | **모바일 반응형** | 현재 데스크탑 전용, 태블릿 지원 추가 |
| 3 | **권한 관리** | Admin/Viewer 역할 기반 접근 제어 |
| 4 | **결제 D-day 알림** | 메일/앱 내 알림 (만기 3일 전) |
| 5 | **일본어(ja) 지원** | 일본 박람회 대응 다국어 추가 |
| 6 | **성능 최적화** | 리드 목록 가상화 (리드 수 1,000+ 대비) |

---

## 4. 커밋 이력 (2026-06-02 — 오늘 작업)

| 커밋 | 내용 |
|------|------|
| `e1c614f` | 박람회 표시명 통일 — exhDisplayName 헬퍼 전체 적용 |
| `14b99b5` | Sales Reports — 기간 필터 + 코리도 분석 + 타입 수정 |
| `57a7e0c` | Sales Dashboard — 행사별 리드 현황 섹션 |
| `50661dc` | 단계 전환 소요일 분석 — 스테이지 이력 추적 시스템 |
| `b58c721` | LeadDetailPanel — Activity 타임라인 + 스테이지 빠른 버튼 |
| `f82424a` | 결과 보고서 사진 — Supabase Storage 이전 |
| `8a5d202` | AI Proposal — Edge Function으로 API 키 보안 이전 |

---

## 5. 기술 부채 메모

| 항목 | 심각도 | 현황 |
|------|--------|------|
| 박람회 색상 하드코딩 | 🟡 | utils.ts EXH_COLORS |
| CSS 인라인 스타일 혼재 | 🟢 | 점진 개선 가능 |
| 테스트 부재 | 🟡 | 단위/통합 테스트 전무 |

---

*이 문서는 코드 전체 분석 기반으로 주기적으로 업데이트합니다.*
