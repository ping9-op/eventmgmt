# GME Event Management App — 개발 현황 및 방향 계획서

> 최종 업데이트: 2026-06-02 (세션 종료 시점)  
> 배포 URL: https://biz-eventmgmt.vercel.app  
> Supabase 프로젝트: euyrqwrhevnmhovoidcn (gme-event-mgmt, ap-northeast-2)

---

## 오늘(2026-06-02) 작업 전체 요약

### 커밋 목록 (최신순)

| 커밋 | 내용 |
|------|------|
| `7752d35` | fix: Proposal 파싱 후 폼 상태 완전 초기화 (이전 데이터 잔존 버그) |
| `78666f6` | fix: '이 내용으로 등록' 실제 동작 구현 (스텁→저장 단계 이동) |
| `79e30b3` | feat: 기존/신규 뱃지 자동화 — proposal 수 기반 자동 판단 |
| `0f59284` | feat: Proposal 파일 파싱 — Word(.docx/.doc) 지원 추가 |
| `edb46a6` | feat: Proposal 파일 파싱 — PDF 텍스트 추출 폴백 |
| `9f6df0a` | fix: 목업 파서(더미 데이터) → 실제 AI + PDF 파싱으로 교체 |
| `939d4d1` | feat: 로그인 페이지 비밀번호 표시/숨기기 토글 |
| `d8e87ba` | fix: EventDetail Budget 탭 예산↔결제 자동 동기화 개선 |
| `44d01dc` | fix: Vercel SPA 라우팅 404 버그 (vercel.json rewrite 누락) |
| `9b822e1` | feat: LOW 우선순위 6개 항목 전체 구현 |
| `38d24c2` | docs: PROJECT_PLAN.md Medium 항목 완료 반영 |
| `8a5d202` | feat: AI Proposal Edge Function 보안 이전 |
| `f82424a` | feat: 결과 보고서 사진 Supabase Storage 이전 |
| `b58c721` | feat: LeadDetailPanel Activity 타임라인 개선 |
| `50661dc` | feat: 단계 전환 소요일 분석 + stage_history 시스템 |
| `57a7e0c` | feat: Sales Dashboard 행사별 리드 현황 섹션 |
| `14b99b5` | feat: Sales Reports 기간 필터 + 코리도별 분석 |
| `e1c614f` | feat: 박람회 표시명 통일 (exhDisplayName) |

---

## Supabase 설정 현황

### 테이블 (모두 생성 완료)
- `exhibitions` — color 컬럼 추가됨, KIF/KFW/SITF/Tokyo 색상 입력됨
- `proposals` — 2개 레코드 (KIF 2024, KFW 2024)
- `payments` — 13개 레코드 (KIF_2024, KFW_2024 정상 연결됨)
- `results` — 비어있음
- `event_data` — 1개 레코드
- `sales_leads/activities/tasks/proposals` — 비어있음
- `sales_settings` — 기본값 7개 키 입력됨
- `sales_stage_history` — 생성됨 (스테이지 변경 자동 기록)

### Storage 버킷
- `report-photos` — 생성됨 (공개 버킷, 10MB 제한)

### Edge Functions
- `ai-proposal` — 배포됨 (AI 변동사유 생성, ACTIVE)
- `parse-proposal` — 배포됨 (파일 파싱, ACTIVE)
- ⚠️ **ANTHROPIC_API_KEY 미설정** — Edge Function에 등록 필요

### 계정
- `andrewc@gmeremit.com` — admin ✅
- `jaceyj@gmeremit.com` — admin ✅

---

## 기능 구현 완료 현황

### Expo 모듈
| 기능 | 상태 |
|------|------|
| 대시보드 (2×2 그리드) | ✅ |
| 박람회 대시보드 (도넛차트, 순위, 비용차트) | ✅ |
| 기존/신규 뱃지 자동화 (proposal 수 기반) | ✅ |
| 기존 박람회 목록 + 카드 | ✅ |
| 일정 관리 | ✅ |
| 결제 일정 (예산↔결제 자동 동기화) | ✅ |
| KFW_2024 payments 키 수정 완료 | ✅ |
| 새 Proposal 작성 (4단계 위저드) | ✅ |
| Proposal 파일 파싱 (PDF/Word/AI) | ✅ |
| - AI API 있을 때: Claude 직접 파싱 | ✅ |
| - AI API 없을 때: pdfjs-dist 텍스트 추출 | ✅ |
| - Word(.docx): mammoth 텍스트 추출 | ✅ |
| 결과 보고서 (10섹션 + PPT) | ✅ |
| 보고서 사진 Supabase Storage | ✅ |
| 이벤트 상세 (7탭) | ✅ |

### Sales 모듈
| 기능 | 상태 |
|------|------|
| Sales 대시보드 + 행사별 리드 현황 | ✅ |
| 리드 목록 (50건 페이지네이션) | ✅ |
| LeadDetailPanel (Activity 타임라인 아이콘/뱃지/삭제) | ✅ |
| Funnel (Board/Table/Proposal 3탭) | ✅ |
| Follow-up 관리 | ✅ |
| Sales Reports (기간필터 + 코리도 + 단계 전환 소요일) | ✅ |
| stage_history 자동 수집 | ✅ |
| Sales Settings | ✅ |

### 공통 인프라
| 기능 | 상태 |
|------|------|
| Supabase Auth + 계정 관리 | ✅ |
| isAdmin 권한 (TopBar ADMIN 뱃지) | ✅ |
| 로그인 비밀번호 표시/숨기기 | ✅ |
| 박람회 색상 DB화 + 동적 로딩 | ✅ |
| 모바일 반응형 (햄버거 메뉴) | ✅ |
| 결제 D-day 알림 TopBar 뱃지 | ✅ |
| 일본어(ja) 지원 (주요 키 60+) | ✅ |
| Vercel SPA 라우팅 (vercel.json) | ✅ |

---

## 남은 작업 (다음 세션)

| 우선순위 | 항목 | 설명 |
|----------|------|------|
| 🔴 즉시 | **ANTHROPIC_API_KEY 등록** | Supabase Edge Functions → Secrets |
| 🟡 중간 | **실제 데이터 입력** | 박람회 proposal/결과 등록 시작 |
| 🟡 중간 | **Sales 리드 등록** | 현재 DB에 리드 0건 |
| 🟢 낮음 | 보고서 PPT 섹션 마무리 | 섹션 6~10 내용 검증 |
| 🟢 낮음 | 성능 최적화 | 리드 수 증가 대비 |

---

## DB 데이터 현황

```
exhibitions: 2개 (KIF, KFW)
proposals:   2개 (KIF 2024, KFW 2024)
payments:    13개 (KIF_2024: 3개, KFW_2024: 8개, KoreaFinte 제거됨)
results:     0개
event_data:  1개
sales_leads: 0개
sales_settings: 7개 키 (owners/sources/corridors 등 기본값)
```

---

## 알려진 이슈 / 주의사항

1. **Anthropic API 없음** → Proposal 파일 파싱 시 PDF/Word 텍스트 추출(패턴 매칭)으로 동작. 정밀도 낮을 수 있음.
2. **stage_history** → SQL 실행 필요: `supabase/add_stage_history.sql`
3. **report-photos Storage** → SQL 실행 필요: `supabase/create_storage_buckets.sql`
4. **Word(.doc) 구버전** → mammoth는 .docx만 완벽 지원. 구버전 .doc는 변환 필요할 수 있음.

---

*배포: https://biz-eventmgmt.vercel.app*
