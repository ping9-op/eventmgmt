-- 세일즈 실시간 반영: 다른 직원이 리드·할 일을 바꾸면 새로고침 없이 화면에 반영
-- 화면은 변경 알림만 받고 데이터는 기존처럼 다시 읽는다 (개인정보 복호화 경로 유지)
-- Realtime은 구독자의 RLS SELECT 정책을 그대로 적용하므로 매니저는 본인 리드 변경만 받는다
alter publication supabase_realtime add table public.sales_leads, public.sales_tasks;
