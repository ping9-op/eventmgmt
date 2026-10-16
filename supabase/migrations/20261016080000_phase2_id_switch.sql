-- 3단계-2: 앱이 proposal_id로 읽기/쓰기 전환에 맞춘 DB 정리
-- 2026-10-16 운영 DB에 적용됨 (phase2_drop_legacy_key_unique, phase2_drop_lead_relink_trigger)

-- 보고서/체크리스트의 유일성은 proposal_id가 보장. 문자열 키는 연도 변경·회차 추가 시 충돌할 수 있어 유일 제약 해제
alter table public.results    drop constraint if exists results_exhibition_key_key;
alter table public.event_data drop constraint if exists event_data_exhibition_key_key;

-- 앱이 리드의 proposal_id를 직접 지정하므로, 행사명 변경 시 연결을 초기화하던 트리거 제거
-- (회차 라벨 "… 상반기"는 자동 매칭되지 않아 연결이 끊길 수 있었음)
drop trigger if exists trg_sales_leads_a_relink on public.sales_leads;
drop function if exists public.relink_lead_proposal();
