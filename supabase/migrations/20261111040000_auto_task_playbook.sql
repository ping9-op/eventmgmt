-- 세일즈 기본 할 일 자동 배정 (3단계)
-- 리드 등록·단계 변경 시 그 단계의 기본 할 일을 담당자에게 자동으로 만든다 (등록 화면·엑셀·일괄 변경 모두 동일)
--   New Lead          → 첫 연락 (Cold Call / Cold Email)   다음날
--   Outreach Sent     → 응답 확인 · 재연락                  3일 뒤
--   Engaged           → 미팅 일정 잡기                      3일 뒤
--   Meeting Scheduled → 미팅 후 제안서 발송                 3일 뒤
--   Proposal Sent     → 제안서 회신 확인                    3일 뒤
--   Onboarding        → 온보딩 서류·진행 확인               3일 뒤
--   Won / Lost        → 남은 할 일 모두 종료
-- 단계가 바뀌면 이전 단계에서 자동으로 만든 미완료 할 일은 종료 (직접 만든 할 일은 유지)

alter table public.sales_tasks add column if not exists auto_stage text;
comment on column public.sales_tasks.auto_stage is '자동 배정된 할 일이면 그 단계명, 직접 만든 할 일은 NULL';

create or replace function public.sales_leads_auto_task()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_today date := (now() at time zone 'Asia/Seoul')::date;
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

  case new.current_stage
    when 'New Lead'          then v_title := '첫 연락 (Cold Call / Cold Email)'; v_type := 'Call';          v_days := 1;
    when 'Outreach Sent'     then v_title := '응답 확인 · 재연락';               v_type := 'Call';          v_days := 3;
    when 'Engaged'           then v_title := '미팅 일정 잡기';                   v_type := 'Meeting';       v_days := 3;
    when 'Meeting Scheduled' then v_title := '미팅 후 제안서 발송';              v_type := 'Send Proposal'; v_days := 3;
    when 'Proposal Sent'     then v_title := '제안서 회신 확인';                 v_type := 'Call';          v_days := 3;
    when 'Onboarding'        then v_title := '온보딩 서류·진행 확인';            v_type := 'Request Docs';  v_days := 3;
    else return null;
  end case;

  insert into public.sales_tasks (lead_id, task_title, task_type, due_date, status, owner, auto_stage)
  values (new.id, v_title, v_type, (v_today + v_days)::text, 'Pending', new.owner, new.current_stage);
  return null;
end $$;

drop trigger if exists trg_sales_leads_auto_task_ins on public.sales_leads;
create trigger trg_sales_leads_auto_task_ins after insert on public.sales_leads
  for each row execute function public.sales_leads_auto_task();

drop trigger if exists trg_sales_leads_auto_task_upd on public.sales_leads;
create trigger trg_sales_leads_auto_task_upd after update of current_stage on public.sales_leads
  for each row when (old.current_stage is distinct from new.current_stage)
  execute function public.sales_leads_auto_task();
