-- sales_stage_history: 리드 스테이지 변경 이력 테이블
-- Supabase SQL Editor에서 실행하세요

CREATE TABLE IF NOT EXISTS sales_stage_history (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id     UUID        NOT NULL REFERENCES sales_leads(id) ON DELETE CASCADE,
  from_stage  TEXT,                          -- 이전 스테이지 (최초 등록 시 NULL)
  to_stage    TEXT        NOT NULL,           -- 변경된 스테이지
  changed_at  TIMESTAMPTZ DEFAULT NOW(),
  changed_by  TEXT                            -- 변경한 사용자 (owner)
);

CREATE INDEX IF NOT EXISTS idx_stage_history_lead_id   ON sales_stage_history (lead_id);
CREATE INDEX IF NOT EXISTS idx_stage_history_changed_at ON sales_stage_history (changed_at DESC);

-- RLS (Row Level Security) — 인증된 사용자만 접근
ALTER TABLE sales_stage_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read stage history"
  ON sales_stage_history FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert stage history"
  ON sales_stage_history FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');
