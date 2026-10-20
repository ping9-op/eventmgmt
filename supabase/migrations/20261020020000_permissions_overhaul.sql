-- 2026-10-20 권한 감사 후속 조치
-- 2026-10-20 운영 DB에 적용됨 (apply_migration 도구 오류로 execute_sql 단일 트랜잭션으로 실행 — migration 이력 테이블에는 없음)
--  1) 행위자 기록: Activity 작성자 / 단계 이력 변경자를 실제 로그인 사용자로 DB에서 채움
--  2) Task 담당자 = 리드 담당자 (접근 권한 기준과 일치)
--  3) 리드 삭제 금지 → 보관(archived_at)
--  4) Activity·단계 이력은 추가만 가능 (수정·삭제 불가, 관리자 포함)
--  5) 박람회/행사별 권한 (보기/편집) — 관리자는 전체, 그 외는 부여받은 박람회·행사만
--  6) 결과보고서 사진 삭제는 관리자만

-- ── 1) 행위자 기록 ─────────────────────────────────────────────────────────
-- 표시 이름: app_metadata.sales_owner(담당자 이름) 우선, 없으면 이메일
create or replace function public.current_actor()
returns text language sql stable set search_path = '' as $$
  select coalesce(nullif(auth.jwt() -> 'app_metadata' ->> 'sales_owner', ''), auth.jwt() ->> 'email')
$$;

create or replace function public.set_actor()
returns trigger language plpgsql set search_path = '' as $$
begin
  -- 로그인 사용자 요청일 때만 덮어씀 (SQL 편집기·서비스 작업은 입력값 유지)
  if auth.uid() is not null then
    if tg_table_name = 'sales_activities' then
      new.created_by := public.current_actor();
    else
      new.changed_by := public.current_actor();
    end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_sales_activities_actor on public.sales_activities;
create trigger trg_sales_activities_actor before insert on public.sales_activities
  for each row execute function public.set_actor();
drop trigger if exists trg_sales_stage_history_actor on public.sales_stage_history;
create trigger trg_sales_stage_history_actor before insert on public.sales_stage_history
  for each row execute function public.set_actor();

-- ── 2) Task 담당자 = 리드 담당자 ────────────────────────────────────────────
create or replace function public.task_owner_from_lead()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.lead_id is not null then
    select l.owner into new.owner from public.sales_leads l where l.id = new.lead_id;
  end if;
  return new;
end $$;

drop trigger if exists trg_sales_tasks_owner on public.sales_tasks;
create trigger trg_sales_tasks_owner before insert or update on public.sales_tasks
  for each row execute function public.task_owner_from_lead();

-- 리드 담당자가 바뀌면 그 리드의 Task 담당자도 함께 변경
create or replace function public.sync_task_owner()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.sales_tasks set owner = new.owner where lead_id = new.id;
  return null;
end $$;

drop trigger if exists trg_sales_leads_sync_task_owner on public.sales_leads;
create trigger trg_sales_leads_sync_task_owner after update of owner on public.sales_leads
  for each row when (new.owner is distinct from old.owner) execute function public.sync_task_owner();

-- ── 3) 리드 삭제 금지 → 보관 ───────────────────────────────────────────────
alter table public.sales_leads add column if not exists archived_at timestamptz;
drop trigger if exists trg_sales_leads_no_delete on public.sales_leads;
create trigger trg_sales_leads_no_delete before delete on public.sales_leads
  for each row execute function public.prevent_hard_delete();

-- ── 4) Activity·단계 이력: 조회·추가만 ─────────────────────────────────────
drop policy if exists sales_activities_owner_access on public.sales_activities;
create policy sales_activities_select on public.sales_activities for select to authenticated
  using (public.is_admin() or exists (select 1 from public.sales_leads sl where sl.id = sales_activities.lead_id and sl.owner = public.current_sales_owner()));
create policy sales_activities_insert on public.sales_activities for insert to authenticated
  with check (public.is_admin() or exists (select 1 from public.sales_leads sl where sl.id = sales_activities.lead_id and sl.owner = public.current_sales_owner()));

drop policy if exists sales_stage_history_owner_access on public.sales_stage_history;
create policy sales_stage_history_select on public.sales_stage_history for select to authenticated
  using (public.is_admin() or exists (select 1 from public.sales_leads sl where sl.id = sales_stage_history.lead_id and sl.owner = public.current_sales_owner()));
create policy sales_stage_history_insert on public.sales_stage_history for insert to authenticated
  with check (public.is_admin() or exists (select 1 from public.sales_leads sl where sl.id = sales_stage_history.lead_id and sl.owner = public.current_sales_owner()));

-- ── 5) 박람회/행사별 권한 ──────────────────────────────────────────────────
-- 부여 단위: 박람회 전체(exhibition_id, 이후 생기는 회차 포함) 또는 특정 행사(proposal_id)
create table if not exists public.expo_permissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  exhibition_id uuid references public.exhibitions(id),
  proposal_id uuid references public.proposals(id),
  level text not null check (level in ('view', 'edit')),
  granted_by text,
  created_at timestamptz not null default now(),
  check ((exhibition_id is null) <> (proposal_id is null))
);
create unique index if not exists expo_permissions_user_exh_uq on public.expo_permissions (user_id, exhibition_id) where exhibition_id is not null;
create unique index if not exists expo_permissions_user_prop_uq on public.expo_permissions (user_id, proposal_id) where proposal_id is not null;

alter table public.expo_permissions enable row level security;
create policy expo_permissions_select on public.expo_permissions for select to authenticated
  using (public.is_admin() or user_id = auth.uid());
create policy expo_permissions_admin_write on public.expo_permissions for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- 행사 권한: 관리자, 또는 해당 행사 권한, 또는 그 박람회 전체 권한
create or replace function public.has_event_perm(p_proposal uuid, p_exhibition uuid, need_edit boolean)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_admin() or exists (
    select 1 from public.expo_permissions ep
    where ep.user_id = auth.uid()
      and ((p_proposal is not null and ep.proposal_id = p_proposal)
        or (p_exhibition is not null and ep.exhibition_id = p_exhibition))
      and (not need_edit or ep.level = 'edit'))
$$;

create or replace function public.has_proposal_perm(p_proposal uuid, need_edit boolean)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.has_event_perm(p_proposal, (select pr.exhibition_id from public.proposals pr where pr.id = p_proposal), need_edit)
$$;

-- 박람회 조회: 박람회 전체 권한 또는 그 박람회의 행사 하나라도 권한이 있으면
create or replace function public.can_view_exhibition(p_exhibition uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_admin()
    or exists (select 1 from public.expo_permissions ep where ep.user_id = auth.uid() and ep.exhibition_id = p_exhibition)
    or exists (select 1 from public.expo_permissions ep join public.proposals pr on pr.id = ep.proposal_id
               where ep.user_id = auth.uid() and pr.exhibition_id = p_exhibition)
$$;

-- 편집 권한 검사 (정책은 조회 범위만 정하고, 쓰기 권한은 여기서 이유와 함께 거부)
create or replace function public.expo_write_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
declare ok boolean;
begin
  -- SQL 편집기·서비스 작업, 관리자는 통과
  if auth.uid() is null or public.is_admin() then
    return coalesce(new, old);
  end if;

  if tg_table_name = 'exhibitions' then
    -- 새 박람회 등록은 관리자만, 박람회 정보 수정·보관은 박람회 전체 편집 권한
    ok := tg_op <> 'INSERT' and public.has_event_perm(null, old.id, true);
  elsif tg_table_name = 'proposals' then
    if tg_op = 'INSERT' then
      ok := public.has_event_perm(null, new.exhibition_id, true);
    else
      ok := public.has_event_perm(old.id, old.exhibition_id, true)
        and (tg_op = 'DELETE' or new.exhibition_id = old.exhibition_id or public.has_event_perm(null, new.exhibition_id, true));
    end if;
  else -- payments / results / event_data
    ok := tg_op = 'INSERT' or public.has_proposal_perm(old.proposal_id, true);
    if ok and tg_op <> 'DELETE' then
      ok := public.has_proposal_perm(new.proposal_id, true);
    end if;
  end if;

  if not ok then
    raise exception '편집 권한이 없습니다. 관리자에게 해당 박람회/행사의 편집 권한을 요청하세요.';
  end if;
  return coalesce(new, old);
end $$;

-- 이름을 trg_z_ 로 시작 — 같은 시점 트리거 중 마지막(autofill로 proposal_id가 채워진 뒤)에 실행
do $$
declare t text;
begin
  foreach t in array array['exhibitions', 'proposals', 'payments', 'results', 'event_data'] loop
    execute format('drop trigger if exists trg_z_expo_write_guard on public.%I', t);
    execute format('create trigger trg_z_expo_write_guard before insert or update or delete on public.%I for each row execute function public.expo_write_guard()', t);
    execute format('drop policy if exists authenticated_full_access on public.%I', t);
  end loop;
end $$;

create policy exhibitions_select on public.exhibitions for select to authenticated using (public.can_view_exhibition(id));
create policy exhibitions_insert on public.exhibitions for insert to authenticated with check (true);
create policy exhibitions_update on public.exhibitions for update to authenticated using (public.can_view_exhibition(id)) with check (true);

create policy proposals_select on public.proposals for select to authenticated using (public.has_event_perm(id, exhibition_id, false));
create policy proposals_insert on public.proposals for insert to authenticated with check (true);
create policy proposals_update on public.proposals for update to authenticated using (public.has_event_perm(id, exhibition_id, false)) with check (true);

do $$
declare t text;
begin
  foreach t in array array['payments', 'results', 'event_data'] loop
    execute format('create policy %I on public.%I for select to authenticated using (public.has_proposal_perm(proposal_id, false))', t || '_select', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (true)', t || '_insert', t);
    execute format('create policy %I on public.%I for update to authenticated using (public.has_proposal_perm(proposal_id, false)) with check (true)', t || '_update', t);
    execute format('create policy %I on public.%I for delete to authenticated using (public.has_proposal_perm(proposal_id, false))', t || '_delete', t);
  end loop;
end $$;

-- 세일즈 화면용 행사 이름 목록 — 박람회 권한이 없어도 리드의 행사명·색상은 보여야 함 (이름/연도/회차/색상만 노출)
create or replace function public.list_event_refs()
returns table (proposal_id uuid, exhibition_id uuid, key text, name text, color text, year int, session text, archived boolean)
language sql stable security definer set search_path = '' as $$
  select pr.id, e.id, e.key, e.name, e.color, pr.year, pr.session, (pr.archived_at is not null or e.archived_at is not null)
  from public.proposals pr join public.exhibitions e on e.id = pr.exhibition_id
$$;

-- 권한 관리 화면용 사용자 목록 (관리자만)
create or replace function public.admin_list_users()
returns table (id uuid, email text, sales_owner text, is_admin boolean, last_sign_in_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then
    raise exception '관리자만 조회할 수 있습니다.';
  end if;
  return query
    select u.id, u.email::text, u.raw_app_meta_data ->> 'sales_owner',
           (u.email = 'andrewc@gmeremit.com' or coalesce(u.raw_app_meta_data ->> 'role', '') = 'admin'),
           u.last_sign_in_at
    from auth.users u order by u.email;
end $$;

do $$
declare f text;
begin
  foreach f in array array['has_event_perm(uuid, uuid, boolean)', 'has_proposal_perm(uuid, boolean)', 'can_view_exhibition(uuid)',
                           'list_event_refs()', 'admin_list_users()', 'expo_write_guard()', 'task_owner_from_lead()', 'sync_task_owner()'] loop
    execute format('revoke all on function public.%s from public, anon', f);
  end loop;
end $$;
grant execute on function public.has_event_perm(uuid, uuid, boolean), public.has_proposal_perm(uuid, boolean),
  public.can_view_exhibition(uuid), public.list_event_refs(), public.admin_list_users() to authenticated;
-- 트리거 전용 함수는 RPC로 노출하지 않음 (Supabase 기본 권한으로 authenticated에 부여돼 있어 별도 회수)
revoke execute on function public.expo_write_guard(), public.sync_task_owner(), public.task_owner_from_lead() from authenticated;

-- ── 6) 결과보고서 사진 삭제는 관리자만 ─────────────────────────────────────
drop policy if exists "Authenticated delete report photos" on storage.objects;
create policy "Admin delete report photos" on storage.objects for delete to authenticated
  using (bucket_id = 'report-photos' and public.is_admin());
