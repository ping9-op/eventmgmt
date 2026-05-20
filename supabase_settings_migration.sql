-- sales_settings 테이블 생성
CREATE TABLE IF NOT EXISTS sales_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS 설정 (모든 인증 사용자 접근 허용)
ALTER TABLE sales_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all" ON sales_settings;
CREATE POLICY "Allow all" ON sales_settings FOR ALL USING (true) WITH CHECK (true);

-- 기본값 삽입 (이미 존재하면 무시)
INSERT INTO sales_settings (key, value) VALUES
  ('owners',          '["Andrew", "Jacey", "Violet", "John"]'),
  ('sources',         '["Expo", "Referral", "Website", "Cold Call", "Partner", "Offline Visit"]'),
  ('event_names',     '["Korea Import Fair (KIF) 2026", "Travel Show 2026", "SITF 2026", "Korea Expo in Tokyo 2026"]'),
  ('corridors',       '["Korea → Japan", "Korea → Australia", "Korea → USA", "Korea → Vietnam", "Korea → Singapore", "Korea → Philippines", "Japan → Korea", "Other"]'),
  ('business_types',  '["Korean Restaurant", "Travel Agency", "Korean Grocery", "Education/Academy", "Import/Export", "Other Korean Business"]'),
  ('contact_methods', '["Email", "Call", "SMS", "Kakao", "Visit"]'),
  ('lost_reasons',    '["No Demand", "Price Issue", "Competitor Already Used", "No Response", "Compliance Issue", "Service Not Available", "Internal Priority Low", "Other"]')
ON CONFLICT (key) DO NOTHING;
