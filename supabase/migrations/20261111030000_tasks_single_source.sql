-- 팔로우업 단일화 (2단계)
--  1) 리드의 다음 할 일(next_action / next_follow_up_date)은 직접 입력하지 않고, 그 리드의 미완료 Task 중
--     가장 빠른 것에서 자동으로 채운다 → 리드관리·퍼널·팔로우업이 같은 값을 본다
--  2) Activity를 기록하면 리드의 마지막 연락일·첫 연락 완료를 자동 갱신
--  3) 기존 리드에 적혀 있던 다음 할 일은 Task로 이전

-- ── 1) Task → 리드의 다음 할 일 ────────────────────────────────────────────
create or replace function public.sync_lead_next_step(p_lead_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_title text;
  v_due   text;
begin
  if p_lead_id is null then return; end if;
  select t.task_title, t.due_date into v_title, v_due
    from public.sales_tasks t
   where t.lead_id = p_lead_id and t.status is distinct from 'Done'
   order by t.due_date, t.created_at
   limit 1;
  update public.sales_leads
     set next_action = v_title, next_follow_up_date = v_due
   where id = p_lead_id
     and (next_action is distinct from v_title or next_follow_up_date is distinct from v_due);
end $$;

create or replace function public.sales_tasks_sync_lead()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op in ('UPDATE', 'DELETE') then
    perform public.sync_lead_next_step(old.lead_id);
  end if;
  if tg_op in ('INSERT', 'UPDATE') and (tg_op = 'INSERT' or new.lead_id is distinct from old.lead_id
       or new.status is distinct from old.status or new.due_date is distinct from old.due_date
       or new.task_title is distinct from old.task_title) then
    perform public.sync_lead_next_step(new.lead_id);
  end if;
  return null;
end $$;

drop trigger if exists trg_sales_tasks_sync_lead on public.sales_tasks;
create trigger trg_sales_tasks_sync_lead after insert or update or delete on public.sales_tasks
  for each row execute function public.sales_tasks_sync_lead();

-- ── 2) Activity → 마지막 연락일 ────────────────────────────────────────────
create or replace function public.sales_activities_touch_lead()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_date date;
begin
  begin
    v_date := new.activity_date::date;
  exception when others then
    v_date := (now() at time zone 'Asia/Seoul')::date;
  end;
  update public.sales_leads
     set last_contact_date = greatest(coalesce(last_contact_date, v_date), v_date),
         first_contact_done = true
   where id = new.lead_id;
  return null;
end $$;

drop trigger if exists trg_sales_activities_touch_lead on public.sales_activities;
create trigger trg_sales_activities_touch_lead after insert on public.sales_activities
  for each row execute function public.sales_activities_touch_lead();

-- ── 3) 기존 다음 할 일 → Task ──────────────────────────────────────────────
insert into public.sales_tasks (lead_id, task_title, task_type, due_date, status, owner)
select l.id,
       coalesce(nullif(trim(l.next_action), ''), '팔로우업'),
       'Other',
       coalesce(nullif(l.next_follow_up_date, ''), (now() at time zone 'Asia/Seoul')::date::text),
       'Pending',
       l.owner
  from public.sales_leads l
 where l.archived_at is null
   and (coalesce(l.next_follow_up_date, '') <> '' or coalesce(trim(l.next_action), '') <> '')
   and not exists (select 1 from public.sales_tasks t where t.lead_id = l.id and t.status is distinct from 'Done');

-- 위 이전 대상이 아니었던 리드도 Task 기준으로 맞춤 (Task 없으면 비움)
select public.sync_lead_next_step(l.id) from public.sales_leads l;
