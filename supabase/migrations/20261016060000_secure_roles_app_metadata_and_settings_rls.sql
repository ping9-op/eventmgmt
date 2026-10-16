-- 권한 판정을 user_metadata(사용자가 supabase.auth.updateUser로 직접 수정 가능) → app_metadata(서버만 수정 가능)로 이전
-- 2026-10-16 운영 DB에 적용됨 (Supabase MCP apply_migration)

-- 1) 기존 계정의 role / sales_owner 값을 app_metadata로 복사
update auth.users
set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
  || jsonb_strip_nulls(jsonb_build_object(
       'role', raw_user_meta_data->>'role',
       'sales_owner', raw_user_meta_data->>'sales_owner'))
where raw_user_meta_data ? 'role' or raw_user_meta_data ? 'sales_owner';

create or replace function public.is_admin()
returns boolean
language sql stable
set search_path = ''
as $$
  select
    coalesce(auth.jwt() ->> 'email', '') in ('andrewc@gmeremit.com')
    or coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin'
$$;

create or replace function public.current_sales_owner()
returns text
language sql stable
set search_path = ''
as $$
  select auth.jwt() -> 'app_metadata' ->> 'sales_owner'
$$;

-- 2) sales_settings: 조회는 로그인 사용자 전체, 변경은 관리자만
drop policy if exists "authenticated_full_access" on public.sales_settings;
drop policy if exists "Allow all" on public.sales_settings;
create policy sales_settings_read on public.sales_settings
  for select to authenticated using (true);
create policy sales_settings_admin_write on public.sales_settings
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
