-- 3단계-1: 문자열 키 → 제안서(proposal) ID 연결 준비 (확장만, 기존 컬럼 유지)
-- 2026-10-16 운영 DB에 적용됨 (Supabase MCP apply_migration: phase1_ids_sessions_archive_serial, phase1_autofill_proposal_id)

-- 1) 같은 박람회의 연 2회(상반기/하반기) 개최 지원: 회차 구분 컬럼
alter table public.proposals add column if not exists session text; -- null = 연 1회, 예: '상반기', '하반기'
create unique index if not exists proposals_exh_year_session_uq
  on public.proposals (exhibition_id, year, coalesce(session, ''));
alter table public.proposals alter column exhibition_id set not null;

-- 2) 삭제 대신 보관(이력 보존) + DB에서 실제 삭제 차단
alter table public.exhibitions add column if not exists archived_at timestamptz;
alter table public.proposals   add column if not exists archived_at timestamptz;

create or replace function public.prevent_hard_delete()
returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception '% 는 삭제할 수 없습니다. 이력 보존을 위해 보관(archived_at) 처리하세요.', tg_table_name;
end $$;

drop trigger if exists trg_exhibitions_no_delete on public.exhibitions;
create trigger trg_exhibitions_no_delete before delete on public.exhibitions
  for each row execute function public.prevent_hard_delete();
drop trigger if exists trg_proposals_no_delete on public.proposals;
create trigger trg_proposals_no_delete before delete on public.proposals
  for each row execute function public.prevent_hard_delete();

-- 3) 행사(제안서) ID 연결 컬럼 + 기존 문자열 키로 채우기
alter table public.payments    add column if not exists proposal_id uuid references public.proposals(id) on delete restrict;
alter table public.results     add column if not exists proposal_id uuid unique references public.proposals(id) on delete restrict;
alter table public.event_data  add column if not exists proposal_id uuid unique references public.proposals(id) on delete restrict;
alter table public.sales_leads add column if not exists proposal_id uuid references public.proposals(id) on delete restrict;
create index if not exists payments_proposal_id_idx on public.payments (proposal_id);
create index if not exists sales_leads_proposal_id_idx on public.sales_leads (proposal_id);

update public.payments t set proposal_id = pr.id
  from public.proposals pr join public.exhibitions e on e.id = pr.exhibition_id
  where t.proposal_id is null and t.exhibition_key = e.key || '_' || pr.year;
update public.results t set proposal_id = pr.id
  from public.proposals pr join public.exhibitions e on e.id = pr.exhibition_id
  where t.proposal_id is null and t.exhibition_key = e.key || '_' || pr.year;
update public.event_data t set proposal_id = pr.id
  from public.proposals pr join public.exhibitions e on e.id = pr.exhibition_id
  where t.proposal_id is null and t.exhibition_key = e.key || '_' || pr.year;
update public.sales_leads t set proposal_id = pr.id
  from public.proposals pr join public.exhibitions e on e.id = pr.exhibition_id
  where t.proposal_id is null and t.event_name = e.name || ' ' || pr.year;

-- 4) 리드 번호: DB 시퀀스로 발급 (기존 최대 번호 다음부터), 중복 금지
create sequence if not exists public.sales_lead_serial_seq;
select setval('public.sales_lead_serial_seq',
  greatest(coalesce((select max(regexp_replace(serial_no, '\D', '', 'g')::int) from public.sales_leads), 0), 1));

create or replace function public.next_lead_serial()
returns text language plpgsql volatile set search_path = '' as $$
declare n bigint := nextval('public.sales_lead_serial_seq');
begin
  -- lpad는 3자리 초과 시 잘라내므로 999 이후는 그대로
  return 'L' || case when n < 1000 then lpad(n::text, 3, '0') else n::text end;
end $$;

alter table public.sales_leads alter column serial_no set default public.next_lead_serial();
alter table public.sales_leads add constraint sales_leads_serial_no_key unique (serial_no);

-- 5) 이행 기간: 앱이 문자열 키로 저장해도 proposal_id 자동 채움 (앱이 ID로 전환되면 제거 예정)
create or replace function public.autofill_proposal_id()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.proposal_id is null then
    if tg_table_name = 'sales_leads' then
      if coalesce(new.event_name, '') <> '' then
        select pr.id into new.proposal_id
          from public.proposals pr join public.exhibitions e on e.id = pr.exhibition_id
          where e.name || ' ' || pr.year = new.event_name and pr.session is null
          limit 1;
      end if;
    else
      select pr.id into new.proposal_id
        from public.proposals pr join public.exhibitions e on e.id = pr.exhibition_id
        where e.key || '_' || pr.year = new.exhibition_key and pr.session is null
        limit 1;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_payments_autofill_proposal on public.payments;
create trigger trg_payments_autofill_proposal before insert or update on public.payments
  for each row execute function public.autofill_proposal_id();
drop trigger if exists trg_results_autofill_proposal on public.results;
create trigger trg_results_autofill_proposal before insert or update on public.results
  for each row execute function public.autofill_proposal_id();
drop trigger if exists trg_event_data_autofill_proposal on public.event_data;
create trigger trg_event_data_autofill_proposal before insert or update on public.event_data
  for each row execute function public.autofill_proposal_id();

-- 리드는 행사명을 바꾸면 연결도 다시 계산 (행사명을 비우면 연결 해제)
create or replace function public.relink_lead_proposal()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and new.event_name is distinct from old.event_name and new.proposal_id is not distinct from old.proposal_id then
    new.proposal_id := null;
  end if;
  return new;
end $$;
drop trigger if exists trg_sales_leads_a_relink on public.sales_leads;
create trigger trg_sales_leads_a_relink before update on public.sales_leads
  for each row execute function public.relink_lead_proposal();
drop trigger if exists trg_sales_leads_b_autofill_proposal on public.sales_leads;
create trigger trg_sales_leads_b_autofill_proposal before insert or update on public.sales_leads
  for each row execute function public.autofill_proposal_id();
