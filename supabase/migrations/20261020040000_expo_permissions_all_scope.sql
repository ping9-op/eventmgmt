-- 박람회 권한에 "모든 박람회" 범위 추가 (이후 새로 등록되는 박람회·행사 포함)
-- 2026-10-20 운영 DB에 적용 (execute_sql)
-- 범위는 셋 중 정확히 하나: 모든 박람회(all_exhibitions) / 특정 박람회(exhibition_id) / 특정 행사(proposal_id)

alter table public.expo_permissions add column if not exists all_exhibitions boolean not null default false;
alter table public.expo_permissions drop constraint if exists expo_permissions_check;
alter table public.expo_permissions add constraint expo_permissions_scope_check
  check (num_nonnulls(exhibition_id, proposal_id) + all_exhibitions::int = 1);
create unique index if not exists expo_permissions_user_all_uq on public.expo_permissions (user_id) where all_exhibitions;

create or replace function public.has_event_perm(p_proposal uuid, p_exhibition uuid, need_edit boolean)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_admin() or exists (
    select 1 from public.expo_permissions ep
    where ep.user_id = auth.uid()
      and (ep.all_exhibitions
        or (p_proposal is not null and ep.proposal_id = p_proposal)
        or (p_exhibition is not null and ep.exhibition_id = p_exhibition))
      and (not need_edit or ep.level = 'edit'))
$$;

create or replace function public.can_view_exhibition(p_exhibition uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_admin()
    or exists (select 1 from public.expo_permissions ep where ep.user_id = auth.uid() and (ep.all_exhibitions or ep.exhibition_id = p_exhibition))
    or exists (select 1 from public.expo_permissions ep join public.proposals pr on pr.id = ep.proposal_id
               where ep.user_id = auth.uid() and pr.exhibition_id = p_exhibition)
$$;
