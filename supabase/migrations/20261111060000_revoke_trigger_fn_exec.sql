-- 오늘 추가한 security definer 함수는 트리거 전용 — API(RPC)로 직접 호출하지 못하도록 실행 권한 회수
-- (트리거는 실행 권한과 무관하게 동작함)
revoke execute on function public.sync_lead_next_step(uuid) from public, anon, authenticated;
revoke execute on function public.sales_tasks_sync_lead() from public, anon, authenticated;
revoke execute on function public.sales_activities_touch_lead() from public, anon, authenticated;
revoke execute on function public.sales_leads_auto_task() from public, anon, authenticated;
