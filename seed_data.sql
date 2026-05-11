-- GME Event Management 샘플 데이터

-- 1. 박람회 (exhibitions)
INSERT INTO exhibitions (id, key, name, recurring, created_at) VALUES
  ('exh-kif-001', 'KIF', 'Korea Import Fair (KIF)', true, now()),
  ('exh-ts-001',  'TS',  'Travel Show',             true, now()),
  ('exh-sitf-001','SITF','SITF',                     true, now()),
  ('exh-tok-001', 'Tokyo','Korea Expo in Tokyo',     false, now())
ON CONFLICT DO NOTHING;

-- 2. Proposals
INSERT INTO proposals (exhibition_id, year, proposal_date, author, date_of_event, venue, objective, products, expected_results, budget, explanations, created_at) VALUES
  ('exh-kif-001', 2025, '2025-01-10', 'Andrew', '2025 Jun 24-26', 'COEX Hall B',
   'To promote GME BIZ to potential Korean Merchants.',
   '[{"product":"GMEBIZ","target":"Domestic Korean Merchants"},{"product":"GME Remittance","target":"Individual Customers"}]',
   '["Promote GME BIZ to potential merchants","To onboard 25 new merchants"]',
   '[{"item":"Booth Fee","curr":1900800,"prev":0,"note":"","currency":"KRW"},{"item":"Design","curr":495000,"prev":0,"note":"","currency":"KRW"},{"item":"Gift","curr":62500,"prev":0,"note":"","currency":"KRW"}]',
   '{}', now()),
  ('exh-kif-001', 2026, '2026-01-14', 'Andrew', '2026 Jun 23-25', 'COEX Hall B',
   'To promote GME BIZ to potential Korean Merchants, and to increase brand awareness.',
   '[{"product":"GMEBIZ","target":"Domestic Korean Merchants"},{"product":"GME Remittance","target":"Individual Customers"}]',
   '["Promote GME BIZ to potential merchants","To onboard 30 new merchants of GMEBIZ"]',
   '[{"item":"Booth Fee","curr":5132160,"prev":1900800,"note":"Cost Increase","currency":"KRW"},{"item":"Design","curr":500000,"prev":495000,"note":"Same","currency":"KRW"},{"item":"Gift","curr":1200000,"prev":62500,"note":"Cost Increase","currency":"KRW"}]',
   '{}', now()),
  ('exh-ts-001', 2026, '2026-02-11', 'Andrew', '2026 May 14 (THU) - 17 (SUN)', 'KINTEX',
   'To promote GME BIZ to potential Korean Travel agency, GME Remit to individual travelers.',
   '[{"product":"GMEBIZ","target":"Travel agency"},{"product":"GME Remittance & Travel Card","target":"Individual Travelers"}]',
   '["Promote GME BIZ","20 registration, 10-15 onboard","80-100 new Registration"]',
   '[{"item":"Booth Fee","curr":2420000,"prev":3080000,"note":"Reduce","currency":"KRW"},{"item":"Design","curr":200000,"prev":170000,"note":"Same","currency":"KRW"},{"item":"Gift","curr":1880000,"prev":500000,"note":"Increase","currency":"KRW"},{"item":"Part Timer","curr":500000,"prev":0,"note":"Need 1 PT","currency":"KRW"}]',
   '{}', now()),
  ('exh-sitf-001', 2026, '2026-01-22', 'Andrew', '2026 Jun 04 (THU) - 07 (SUN)', 'COEX Hall C',
   'To promote GME BIZ to potential Korean Merchants, GME Remit to individual travelers.',
   '[{"product":"GMEBIZ","target":"Travel company Merchants"},{"product":"GME Remittance","target":"Individual Travelers"}]',
   '["Promote GME BIZ","To onboard 30 new merchants","80-100 new Registration"]',
   '[{"item":"Booth Fee","curr":4254250,"prev":4268250,"note":"Same","currency":"KRW"},{"item":"Design","curr":500000,"prev":467500,"note":"Same","currency":"KRW"},{"item":"Gift","curr":1500000,"prev":358500,"note":"Increase","currency":"KRW"}]',
   '{}', now()),
  ('exh-tok-001', 2026, '2026-01-23', 'Andrew', '2026 Apr 16 (THU) - 18 (Sat)', 'Sunshine City Convention Center, Tokyo',
   'To promote GME BIZ to potential Korean Merchants.',
   '[{"product":"GMEBIZ","target":"Travel company Merchants"}]',
   '["Promote GME BIZ","To onboard 30 new merchants"]',
   '[{"item":"Booth Fee","curr":780000,"prev":0,"note":"1 Basic Booth","currency":"JPY"},{"item":"Design","curr":1500000,"prev":0,"note":"6 banners","currency":"KRW"},{"item":"Item Delivery","curr":500000,"prev":0,"note":"Brochure etc","currency":"KRW"},{"item":"Gift","curr":1500000,"prev":0,"note":"100 Gifts","currency":"KRW"},{"item":"Flight","curr":160000,"prev":0,"note":"4 People","currency":"JPY"},{"item":"Accommodation","curr":180000,"prev":0,"note":"4 People","currency":"JPY"},{"item":"Meal","curr":60000,"prev":0,"note":"3 meals/day","currency":"JPY"}]',
   '{}', now())
ON CONFLICT DO NOTHING;

-- 3. Payments
INSERT INTO payments (exhibition_key, item, total, currency, deposit_amount, deposit_due, deposit_paid, final_amount, final_due, final_paid, created_at) VALUES
  ('KIF_2026','Booth Fee',5132160,'KRW',2566080,'2026-03-15',true,2566080,'2026-05-20',false,now()),
  ('KIF_2026','Design',500000,'KRW',250000,'2026-03-20',true,250000,'2026-05-20',false,now()),
  ('KIF_2026','Gift',1200000,'KRW',0,null,false,1200000,'2026-05-30',false,now()),
  ('TS_2026','Booth Fee',2420000,'KRW',1210000,'2026-03-01',true,1210000,'2026-04-30',false,now()),
  ('TS_2026','Design',200000,'KRW',0,null,false,200000,'2026-05-14',false,now()),
  ('TS_2026','Gift',1880000,'KRW',0,null,false,1880000,'2026-05-10',false,now()),
  ('TS_2026','Part Timer',500000,'KRW',0,null,false,500000,'2026-05-14',false,now()),
  ('SITF_2026','Booth Fee',4254250,'KRW',2127125,'2026-03-15',true,2127125,'2026-06-01',false,now()),
  ('SITF_2026','Design',500000,'KRW',250000,'2026-03-20',true,250000,'2026-06-01',false,now()),
  ('SITF_2026','Gift',1500000,'KRW',0,null,false,1500000,'2026-06-05',false,now()),
  ('Tokyo_2026','Booth Fee',780000,'JPY',390000,'2026-02-15',true,390000,'2026-03-30',true,now()),
  ('Tokyo_2026','Design',1500000,'KRW',750000,'2026-02-20',true,750000,'2026-03-15',true,now()),
  ('Tokyo_2026','Item Delivery',500000,'KRW',0,null,false,500000,'2026-04-01',false,now()),
  ('Tokyo_2026','Gift',1500000,'KRW',0,null,false,1500000,'2026-04-01',false,now()),
  ('Tokyo_2026','Flight',160000,'JPY',160000,'2026-03-01',true,0,null,false,now()),
  ('Tokyo_2026','Accommodation',180000,'JPY',180000,'2026-03-01',true,0,null,false,now()),
  ('Tokyo_2026','Meal',60000,'JPY',0,null,false,60000,'2026-04-16',false,now())
ON CONFLICT DO NOTHING;

-- 4. Sales Leads
INSERT INTO sales_leads (serial_no, registered_date, event_name, company_name, contact_person, phone, email, lead_source, business_type, country_corridor, expected_monthly_volume, volume_currency, priority, owner, current_stage, first_contact_done, next_action, remarks, created_at) VALUES
  ('L001','2026-04-16','Korea Expo in Tokyo 2026','Hanbit Trading Co.','Kim Jisu','03-1234-5678','jisu@hanbit.jp','Expo','Import/Export','Korea → Japan',5000,'USD','High','Andrew','Proposal Sent',true,'Follow up on proposal','Large cosmetics importer', now()),
  ('L002','2026-04-17','Korea Expo in Tokyo 2026','Tokyo Korean Mart','Park Junho','03-9876-5432','junho@tkmart.jp','Expo','Korean Grocery','Korea → Japan',2000,'USD','Medium','Andrew','Contacted',true,'Send brochure','Small grocery chain', now()),
  ('L003','2026-04-17','Korea Expo in Tokyo 2026','Sakura Travel Agency','Yamamoto Keiko','03-5555-6666','keiko@sakura-travel.jp','Expo','Travel Agency','Korea → Japan',8000,'USD','High','Jacey','Meeting Scheduled',true,'Prepare presentation','Imports cosmetics from Korea', now()),
  ('L004','2026-04-18','Korea Expo in Tokyo 2026','Global Remit Japan','Tanaka Hiroshi','06-1111-2222','hiroshi@gremit.jp','Expo','Import/Export','Korea → Japan',15000,'USD','High','Violet','Negotiation',true,'Send revised fee structure','Large volume, needs competitive rate', now()),
  ('L005','2026-04-18','Korea Expo in Tokyo 2026','Noodle House Osaka','Choi Sungwoo','06-3333-4444','sungwoo@noodle.jp','Expo','Korean Restaurant','Korea → Japan',1500,'USD','Low','John','Lost',true,'','Using another provider', now()),
  ('L006','2026-04-18','Korea Expo in Tokyo 2026','Hanin Mart Tokyo','Lee Hyunwoo','03-7777-8888','hyunwoo@haninmart.jp','Expo','Korean Grocery','Korea → Japan',8000,'USD','High','Andrew','Onboarding',true,'Complete document review','Documents submitted', now()),
  ('L007','2026-05-15','Travel Show 2026','Korea Tour Japan','Shin Jiyeon','03-2222-3333','jiyeon@ktour.jp','Expo','Travel Agency','Korea → Japan',20000,'KRW','High','Jacey','New Lead',false,'Initial contact','Met at Travel Show booth', now()),
  ('L008','2026-05-15','Travel Show 2026','JK Academy','Jang Kyungho','03-4444-5555','kyungho@jkacademy.jp','Expo','Education/Academy','Korea → Japan',3000,'USD','Medium','Violet','Onboarded / Won',true,'','Successfully onboarded', now()),
  ('L009','2026-05-15','Travel Show 2026','Mint Kimbab','Oh Seungmin','090-9999-0000','seungmin@mintkimbab.jp','Referral','Korean Restaurant','Korea → Japan',1200,'USD','Low','John','Contacted',true,'Send brochure','Referred by Hanbit Trading', now()),
  ('L010','2026-05-16','Travel Show 2026','K-Style Fashion','Kwon Yejin','03-6666-7777','yejin@kstyle.jp','Expo','Import/Export','Korea → Japan',5000,'USD','Medium','Andrew','Proposal Sent',true,'Wait for response','K-fashion importer', now())
ON CONFLICT DO NOTHING;

-- 5. Results (Tokyo 2026)
INSERT INTO results (exhibition_key, objective, event_date, event_venue, event_target, actual_costs, marketing_activities, marketing_photos, reg_remittance, reg_card, reg_biz, reg_onboard, cost_per_person, visitors, new_merchants, new_registrations, shortcomings, improvements, recommendations, requests, conclusion, cover_title, cover_date, cover_author, sections_enabled, created_at) VALUES
  ('Tokyo_2026',
   'To promote GME BIZ to potential Korean Merchants.',
   '2026 Apr 16 (THU) - 18 (Sat)',
   'Sunshine City Convention Center, Tokyo',
   'Korean merchants in Japan',
   '[{"item":"Booth Fee","budgeted":780000,"actual":780000,"currency":"JPY"},{"item":"Design","budgeted":1500000,"actual":1480000,"currency":"KRW"},{"item":"Item Delivery","budgeted":500000,"actual":620000,"currency":"KRW"},{"item":"Gift","budgeted":1500000,"actual":1350000,"currency":"KRW"},{"item":"Flight","budgeted":160000,"actual":168000,"currency":"JPY"},{"item":"Accommodation","budgeted":180000,"actual":175000,"currency":"JPY"},{"item":"Meal","budgeted":60000,"actual":58000,"currency":"JPY"}]',
   '[{"type":"SNS","description":"Instagram/Facebook 사전 홍보 3회 게시","result":"도달 1,200명"},{"type":"Event","description":"가라뽕 스핀 휠 이벤트 1일 2회","result":"참여 180명"}]',
   '[]',
   0, 0, 18, 12, 0, 280, 18, 0,
   '["머천트 목표(30) 미달성","일본어 브로셔 부족"]',
   '["부스 위치 좋음","이벤트 반응 매우 좋음","Kyodai 협업 효과적"]',
   '["일본어 자료 보강 필요","현지 파트너와의 협업 확대","다음 해 부스 크기 확대 검토"]',
   '["일본어 가능 직원 파견","현지 홍보 예산 증대"]',
   '첫 해외 박람회로 머천트 목표 미달성이지만, 일본 시장 탐색 및 Kyodai 파트너십 강화에 기여함. 내년 재참가를 통해 추가 온보딩 가능.',
   'Korea Expo in Tokyo 2026 결과 보고서',
   '2026-05-01',
   'Andrew',
   '{"1":true,"2":true,"3":true,"4":true,"5":true,"6":true,"7":true,"8":true,"9":true,"10":true}',
   now())
ON CONFLICT DO NOTHING;
