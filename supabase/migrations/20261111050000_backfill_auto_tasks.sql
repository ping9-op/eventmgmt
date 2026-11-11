-- 기존 진행 중 리드에 현재 단계의 기본 할 일 일괄 배정 (사용자 결정: 한 번에 배정, 2026-11-11)
-- 대상: 보관 안 됨 + Won/Lost 아님 + 미완료 할 일 없음. 기한은 자동 배정 규칙과 동일 (New Lead 다음날, 그 외 3일 뒤)
insert into public.sales_tasks (lead_id, task_title, task_type, due_date, status, owner, auto_stage)
select l.id, p.title, p.type, ((now() at time zone 'Asia/Seoul')::date + p.days)::text, 'Pending', l.owner, l.current_stage
  from public.sales_leads l
  join (values
    ('New Lead',          '첫 연락 (Cold Call / Cold Email)', 'Call',          1),
    ('Outreach Sent',     '응답 확인 · 재연락',               'Call',          3),
    ('Engaged',           '미팅 일정 잡기',                   'Meeting',       3),
    ('Meeting Scheduled', '미팅 후 제안서 발송',              'Send Proposal', 3),
    ('Proposal Sent',     '제안서 회신 확인',                 'Call',          3),
    ('Onboarding',        '온보딩 서류·진행 확인',            'Request Docs',  3)
  ) as p(stage, title, type, days) on p.stage = l.current_stage
 where l.archived_at is null
   and not exists (select 1 from public.sales_tasks t where t.lead_id = l.id and t.status is distinct from 'Done');
