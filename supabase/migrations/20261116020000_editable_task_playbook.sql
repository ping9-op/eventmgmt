-- 자동 배정 할 일(플레이북)을 설정 화면에서 편집 — 하드코딩 대신 sales_settings.task_playbook을 읽는다
-- 값: [{ "stage", "title", "type", "days", "on" }]  (on=false 또는 title 빈 값이면 그 단계는 자동 배정 안 함)
-- 설정 행이 없거나 잘못된 경우 아래 기본값으로 동작 (src/lib/tasks.ts TASK_PLAYBOOK과 같은 값)

create or replace function public.sales_default_playbook()
returns jsonb language sql immutable set search_path = '' as $$
  select '[
    {"stage":"New Lead","title":"첫 연락 (Cold Call / Cold Email)","type":"Call","days":1,"on":true},
    {"stage":"Outreach Sent","title":"응답 확인 · 재연락","type":"Call","days":3,"on":true},
    {"stage":"Engaged","title":"미팅 일정 잡기","type":"Meeting","days":3,"on":true},
    {"stage":"Meeting Scheduled","title":"미팅 후 제안서 발송","type":"Send Proposal","days":3,"on":true},
    {"stage":"Proposal Sent","title":"제안서 회신 확인","type":"Call","days":3,"on":true},
    {"stage":"Onboarding","title":"온보딩 서류·진행 확인","type":"Request Docs","days":3,"on":true}
  ]'::jsonb
$$;

insert into public.sales_settings (key, value, updated_at)
values ('task_playbook', public.sales_default_playbook(), now())
on conflict (key) do nothing;

create or replace function public.sales_leads_auto_task()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_book  jsonb;
  v_item  jsonb;
  v_title text;
  v_type  text;
  v_days  int;
begin
  if new.archived_at is not null then return null; end if;

  if tg_op = 'UPDATE' then
    if new.current_stage in ('Won', 'Lost') then
      -- 종료된 리드: 남은 할 일 모두 종료
      update public.sales_tasks set status = 'Done', completed_at = v_today::text
       where lead_id = new.id and status is distinct from 'Done';
      return null;
    end if;
    -- 이전 단계의 자동 할 일 종료
    update public.sales_tasks set status = 'Done', completed_at = v_today::text
     where lead_id = new.id and auto_stage is not null and status is distinct from 'Done';
  end if;

  select value into v_book from public.sales_settings where key = 'task_playbook';
  if v_book is null or jsonb_typeof(v_book) <> 'array' then v_book := public.sales_default_playbook(); end if;

  select e into v_item from jsonb_array_elements(v_book) e where e->>'stage' = new.current_stage limit 1;
  if v_item is null or v_item->'on' = 'false'::jsonb then return null; end if;

  v_title := nullif(btrim(coalesce(v_item->>'title', '')), '');
  if v_title is null then return null; end if;
  v_type := coalesce(nullif(v_item->>'type', ''), 'Other');
  -- days 값이 잘못 저장돼도 리드 저장은 막지 않도록 숫자일 때만 사용 (0~60일)
  v_days := case when (v_item->>'days') ~ '^\d{1,3}$' then least((v_item->>'days')::int, 60) else 3 end;

  insert into public.sales_tasks (lead_id, task_title, task_type, due_date, status, owner, auto_stage)
  values (new.id, v_title, v_type, (v_today + v_days)::text, 'Pending', new.owner, new.current_stage);
  return null;
end $$;

revoke execute on function public.sales_leads_auto_task() from public, anon, authenticated;
