-- 리드 발굴자(sourced_by) 추가
-- 담당자(owner)는 넘겨줄 수 있지만, 처음 발굴한 사람은 바뀌지 않도록 별도 칸으로 기록한다.
--  · 등록 시: 매니저는 항상 본인, 관리자는 입력값(없으면 본인) — 관리자가 리드를 넘겨줘도 발굴자는 관리자로 남음
--  · 수정 시: 관리자만 변경 가능 (매니저가 바꾸려 하면 이전 값 유지)
--  · 기존 리드: 현재 담당자를 발굴자로 채움

alter table public.sales_leads add column if not exists sourced_by text;

update public.sales_leads set sourced_by = owner where sourced_by is null or sourced_by = '';

create or replace function public.sales_leads_sourced_by()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    if auth.uid() is not null and not public.is_admin() then
      new.sourced_by := coalesce(nullif(public.current_sales_owner(), ''), new.owner);
    else
      -- 관리자 / SQL 편집기·서비스 작업: 입력값 우선, 없으면 본인 → 담당자
      new.sourced_by := coalesce(nullif(new.sourced_by, ''), nullif(public.current_sales_owner(), ''), new.owner);
    end if;
  elsif new.sourced_by is distinct from old.sourced_by then
    if auth.uid() is not null and not public.is_admin() then
      new.sourced_by := old.sourced_by;
    elsif nullif(new.sourced_by, '') is null then
      new.sourced_by := old.sourced_by;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_sales_leads_c_sourced_by on public.sales_leads;
create trigger trg_sales_leads_c_sourced_by before insert or update on public.sales_leads
  for each row execute function public.sales_leads_sourced_by();
