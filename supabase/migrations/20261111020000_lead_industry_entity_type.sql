-- 리드 등록 항목 정리
--  1) Business Type = 사업자 구분(법인 / 개인사업자)으로 변경, 기존 업종 값은 새 산업군(industry) 칸으로 이전
--  2) 산업군 목록(sales_settings.industries) — 설정 화면에서 편집
--  3) 연락 채널에 On-site Visit 추가

-- ── 1) 산업군 칸 + 기존 업종 값 이전 ──────────────────────────────────────
alter table public.sales_leads add column if not exists industry text not null default '';

update public.sales_leads set industry = case business_type
    when 'Korean Restaurant'     then '요식업'
    when 'Korean Grocery'        then '도소매'
    when 'Travel Agency'         then '여행'
    when 'Education/Academy'     then '교육'
    when 'Other Korean Business' then '기타'
    else business_type  -- 'Import/Export' 등 수입/수출을 단정할 수 없는 값은 그대로 두고 담당자가 재분류
  end
 where industry = '' and business_type <> '';

-- 기존 값은 업종이었으므로 사업자 구분은 비워 둠 (법인/개인 여부는 알 수 없음)
update public.sales_leads set business_type = '' where business_type not in ('', '법인', '개인사업자');

alter table public.sales_leads drop constraint if exists sales_leads_business_type_check;
alter table public.sales_leads add constraint sales_leads_business_type_check
  check (business_type in ('', '법인', '개인사업자'));

-- ── 2) 산업군 목록 ─────────────────────────────────────────────────────────
insert into public.sales_settings (key, value, updated_at)
values ('industries', '["수입", "수출", "제조", "여행", "교육", "요식업", "도소매", "물류", "IT/서비스", "기타"]'::jsonb, now())
on conflict (key) do nothing;

-- ── 3) 연락 채널 ───────────────────────────────────────────────────────────
alter table public.sales_leads drop constraint if exists sales_leads_outreach_channel_check;
alter table public.sales_leads add constraint sales_leads_outreach_channel_check check (outreach_channel is null or outreach_channel in (
  'Cold Email', 'Cold Call', 'LinkedIn', 'Trade Show', 'On-site Visit', 'Referral', 'Inbound', 'Other'
));
