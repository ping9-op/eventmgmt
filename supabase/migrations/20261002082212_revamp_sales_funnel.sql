-- 세일즈 퍼널 단계 개편 + 리드 필드 추가
-- 단계 값은 기존 규칙대로 라벨 문자열을 그대로 저장한다.
--   New Lead → Outreach Sent → Engaged → Meeting Scheduled → Proposal Sent → Onboarding → Won / Lost
--   (Negotiation 삭제: 고정 환율·고정 수수료 정책)

BEGIN;

-- ── 1. 기존 단계 매핑 ──────────────────────────────────────────────────────
UPDATE sales_leads SET current_stage = 'Outreach Sent' WHERE current_stage = 'Contacted';
UPDATE sales_leads SET current_stage = 'Proposal Sent' WHERE current_stage = 'Negotiation';
UPDATE sales_leads SET current_stage = 'Won'           WHERE current_stage IN ('Onboarded / Won', 'Onboarded/Won');

UPDATE sales_stage_history SET from_stage = 'Outreach Sent' WHERE from_stage = 'Contacted';
UPDATE sales_stage_history SET from_stage = 'Proposal Sent' WHERE from_stage = 'Negotiation';
UPDATE sales_stage_history SET from_stage = 'Won'           WHERE from_stage IN ('Onboarded / Won', 'Onboarded/Won');
UPDATE sales_stage_history SET to_stage   = 'Outreach Sent' WHERE to_stage   = 'Contacted';
UPDATE sales_stage_history SET to_stage   = 'Proposal Sent' WHERE to_stage   = 'Negotiation';
UPDATE sales_stage_history SET to_stage   = 'Won'           WHERE to_stage   IN ('Onboarded / Won', 'Onboarded/Won');

-- ── 2. 컬럼 추가 / 변경 ────────────────────────────────────────────────────
ALTER TABLE sales_leads
  ADD COLUMN IF NOT EXISTS outreach_channel TEXT,
  ADD COLUMN IF NOT EXISTS lost_reason_note TEXT,
  ADD COLUMN IF NOT EXISTS lost_at_stage    TEXT;

-- last_contact_date: text(YYYY-MM-DD) → date
UPDATE sales_leads SET last_contact_date = NULL WHERE last_contact_date = '';
ALTER TABLE sales_leads
  ALTER COLUMN last_contact_date TYPE DATE USING last_contact_date::date;

-- ── 3. CHECK 제약 ─────────────────────────────────────────────────────────
ALTER TABLE sales_leads
  ADD CONSTRAINT sales_leads_current_stage_check CHECK (current_stage IN (
    'New Lead', 'Outreach Sent', 'Engaged', 'Meeting Scheduled',
    'Proposal Sent', 'Onboarding', 'Won', 'Lost'
  )),
  ADD CONSTRAINT sales_leads_outreach_channel_check CHECK (outreach_channel IS NULL OR outreach_channel IN (
    'Cold Email', 'Cold Call', 'LinkedIn', 'Trade Show', 'Referral', 'Inbound', 'Other'
  ));

-- ── 4. 단계 변경 시 자동 처리 트리거 ──────────────────────────────────────
--   · Lost로 바뀌면 직전 단계를 lost_at_stage에 저장
--   · Outreach Sent 이후 단계(Lost 포함)로 바뀌면 last_contact_date = 오늘(KST)
--     단, 같은 UPDATE에서 last_contact_date를 직접 바꾼 경우는 수동 값을 존중
CREATE OR REPLACE FUNCTION sales_leads_stage_autofill()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.current_stage <> 'New Lead' AND NEW.last_contact_date IS NULL THEN
      NEW.last_contact_date := (now() AT TIME ZONE 'Asia/Seoul')::date;
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.current_stage IS DISTINCT FROM OLD.current_stage THEN
    IF NEW.current_stage = 'Lost' THEN
      NEW.lost_at_stage := OLD.current_stage;
    END IF;
    IF NEW.current_stage <> 'New Lead'
       AND NEW.last_contact_date IS NOT DISTINCT FROM OLD.last_contact_date THEN
      NEW.last_contact_date := (now() AT TIME ZONE 'Asia/Seoul')::date;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sales_leads_stage_autofill ON sales_leads;
CREATE TRIGGER trg_sales_leads_stage_autofill
  BEFORE INSERT OR UPDATE ON sales_leads
  FOR EACH ROW EXECUTE FUNCTION sales_leads_stage_autofill();

-- ── 5. Lost Reason 기본 목록 교체 (설정 화면에서 계속 편집 가능) ──────────
UPDATE sales_settings
   SET value = '["Pricing", "No Response", "Not a Fit", "Chose Competitor", "KYB Issue", "Timing", "Other"]'::jsonb,
       updated_at = now()
 WHERE key = 'lost_reasons';

COMMIT;
