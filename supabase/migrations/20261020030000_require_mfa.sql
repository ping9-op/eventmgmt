-- 2단계 인증(OTP) 필수화 — 비밀번호만 탈취해서는 데이터에 접근할 수 없도록 DB에서 강제
-- 2026-10-20 운영 DB에 적용 (프론트 MFA 화면 배포 후)
-- 예외: 첫 로그인 비밀번호 변경(change_initial_password)은 OTP 등록 전 단계라 aal1 허용

-- 1) 모든 업무 테이블: aal2 세션만 접근 (기존 허용 정책과 AND로 결합되는 restrictive 정책)
do $$
declare t text;
begin
  foreach t in array array['exhibitions', 'proposals', 'payments', 'results', 'event_data',
                           'sales_leads', 'sales_activities', 'sales_tasks', 'sales_proposals',
                           'sales_settings', 'sales_stage_history', 'expo_permissions'] loop
    execute format('drop policy if exists require_mfa on public.%I', t);
    execute format('create policy require_mfa on public.%I as restrictive for all to authenticated using ((select auth.jwt() ->> ''aal'') = ''aal2'') with check ((select auth.jwt() ->> ''aal'') = ''aal2'')', t);
  end loop;
end $$;

-- 2) 결과보고서 사진 업로드/삭제도 aal2만 (공개 URL 조회는 그대로)
drop policy if exists "Require MFA report photos" on storage.objects;
create policy "Require MFA report photos" on storage.objects as restrictive for all to authenticated
  using (bucket_id <> 'report-photos' or (select auth.jwt() ->> 'aal') = 'aal2')
  with check (bucket_id <> 'report-photos' or (select auth.jwt() ->> 'aal') = 'aal2');

-- 3) RPC도 aal2만
create or replace function public.list_event_refs()
returns table (proposal_id uuid, exhibition_id uuid, key text, name text, color text, year int, session text, archived boolean)
language sql stable security definer set search_path = '' as $$
  select pr.id, e.id, e.key, e.name, e.color, pr.year, pr.session, (pr.archived_at is not null or e.archived_at is not null)
  from public.proposals pr join public.exhibitions e on e.id = pr.exhibition_id
  where (auth.jwt() ->> 'aal') = 'aal2'
$$;

drop function if exists public.admin_list_users();
create function public.admin_list_users()
returns table (id uuid, email text, sales_owner text, is_admin boolean, last_sign_in_at timestamptz, has_mfa boolean)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() or coalesce(auth.jwt() ->> 'aal', '') <> 'aal2' then
    raise exception '관리자만 조회할 수 있습니다.';
  end if;
  return query
    select u.id, u.email::text, u.raw_app_meta_data ->> 'sales_owner',
           (u.email = 'andrewc@gmeremit.com' or coalesce(u.raw_app_meta_data ->> 'role', '') = 'admin'),
           u.last_sign_in_at,
           exists (select 1 from auth.mfa_factors f where f.user_id = u.id and f.status = 'verified')
    from auth.users u order by u.email;
end $$;

-- 4) 관리자: 휴대폰 분실 등으로 OTP 초기화 (다음 로그인 때 재등록)
create or replace function public.admin_reset_mfa(p_user uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() or coalesce(auth.jwt() ->> 'aal', '') <> 'aal2' then
    raise exception '관리자만 실행할 수 있습니다.';
  end if;
  delete from auth.mfa_factors where user_id = p_user;
end $$;

revoke all on function public.admin_list_users(), public.admin_reset_mfa(uuid) from public, anon;
grant execute on function public.admin_list_users(), public.admin_reset_mfa(uuid) to authenticated;
