import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://euyrqwrhevnmhovoidcn.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV1eXJxd3JoZXZubWhvdm9pZGNuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgxMDk2NTMsImV4cCI6MjA5MzY4NTY1M30.kyO2N3yycSpwRQM1mw-Xk92TEyrJaOZgf8xvugjcaWA'
)

async function seed() {
  console.log('Seeding...')

  // 1. Exhibitions
  const { error: e1 } = await supabase.from('exhibitions').upsert([
    { key: 'KIF',   name: 'Korea Import Fair (KIF)', recurring: true },
    { key: 'TS',    name: 'Travel Show',             recurring: true },
    { key: 'SITF',  name: 'SITF',                    recurring: true },
    { key: 'Tokyo', name: 'Korea Expo in Tokyo',     recurring: false },
  ], { onConflict: 'key' })
  if (e1) { console.error('exhibitions:', e1.message); return }
  console.log('✓ exhibitions')

  // Get exhibition IDs
  const { data: exhs } = await supabase.from('exhibitions').select('id, key')
  const exhId = (key: string) => exhs!.find(e => e.key === key)!.id

  // 2. Proposals
  const proposals = [
    { exhibition_id: exhId('KIF'), year: 2025, proposal_date: '2025-01-10', author: 'Andrew', date_of_event: '2025 Jun 24-26', venue: 'COEX Hall B', objective: 'To promote GME BIZ to potential Korean Merchants.', products: [{product:'GMEBIZ',target:'Domestic Korean Merchants'},{product:'GME Remittance',target:'Individual Customers'}], expected_results: ['Promote GME BIZ to potential merchants','To onboard 25 new merchants'], budget: [{item:'Booth Fee',curr:1900800,prev:0,note:'',currency:'KRW'},{item:'Design',curr:495000,prev:0,note:'',currency:'KRW'},{item:'Gift',curr:62500,prev:0,note:'',currency:'KRW'}], explanations: {} },
    { exhibition_id: exhId('KIF'), year: 2026, proposal_date: '2026-01-14', author: 'Andrew', date_of_event: '2026 Jun 23-25', venue: 'COEX Hall B', objective: 'To promote GME BIZ to potential Korean Merchants, and to increase brand awareness.', products: [{product:'GMEBIZ',target:'Domestic Korean Merchants'},{product:'GME Remittance',target:'Individual Customers'}], expected_results: ['Promote GME BIZ to potential merchants','To onboard 30 new merchants of GMEBIZ'], budget: [{item:'Booth Fee',curr:5132160,prev:1900800,note:'Cost Increase',currency:'KRW'},{item:'Design',curr:500000,prev:495000,note:'Same',currency:'KRW'},{item:'Gift',curr:1200000,prev:62500,note:'Cost Increase',currency:'KRW'}], explanations: {} },
    { exhibition_id: exhId('TS'),  year: 2026, proposal_date: '2026-02-11', author: 'Andrew', date_of_event: '2026 May 14 (THU) - 17 (SUN)', venue: 'KINTEX', objective: 'To promote GME BIZ to potential Korean Travel agency, GME Remit to individual travelers.', products: [{product:'GMEBIZ',target:'Travel agency'},{product:'GME Remittance & Travel Card',target:'Individual Travelers'}], expected_results: ['Promote GME BIZ','20 registration, 10-15 onboard','80-100 new Registration'], budget: [{item:'Booth Fee',curr:2420000,prev:3080000,note:'Reduce',currency:'KRW'},{item:'Design',curr:200000,prev:170000,note:'Same',currency:'KRW'},{item:'Gift',curr:1880000,prev:500000,note:'Increase',currency:'KRW'},{item:'Part Timer',curr:500000,prev:0,note:'Need 1 PT',currency:'KRW'}], explanations: {} },
    { exhibition_id: exhId('SITF'),year: 2026, proposal_date: '2026-01-22', author: 'Andrew', date_of_event: '2026 Jun 04 (THU) - 07 (SUN)', venue: 'COEX Hall C', objective: 'To promote GME BIZ to potential Korean Merchants, GME Remit to individual travelers.', products: [{product:'GMEBIZ',target:'Travel company Merchants'},{product:'GME Remittance',target:'Individual Travelers'}], expected_results: ['Promote GME BIZ','To onboard 30 new merchants','80-100 new Registration'], budget: [{item:'Booth Fee',curr:4254250,prev:4268250,note:'Same',currency:'KRW'},{item:'Design',curr:500000,prev:467500,note:'Same',currency:'KRW'},{item:'Gift',curr:1500000,prev:358500,note:'Increase',currency:'KRW'}], explanations: {} },
    { exhibition_id: exhId('Tokyo'),year:2026, proposal_date: '2026-01-23', author: 'Andrew', date_of_event: '2026 Apr 16 (THU) - 18 (Sat)', venue: 'Sunshine City Convention Center, Tokyo', objective: 'To promote GME BIZ to potential Korean Merchants.', products: [{product:'GMEBIZ',target:'Travel company Merchants'}], expected_results: ['Promote GME BIZ','To onboard 30 new merchants'], budget: [{item:'Booth Fee',curr:780000,prev:0,note:'1 Basic Booth',currency:'JPY'},{item:'Design',curr:1500000,prev:0,note:'6 banners',currency:'KRW'},{item:'Item Delivery',curr:500000,prev:0,note:'Brochure etc',currency:'KRW'},{item:'Gift',curr:1500000,prev:0,note:'100 Gifts',currency:'KRW'},{item:'Flight',curr:160000,prev:0,note:'4 People',currency:'JPY'},{item:'Accommodation',curr:180000,prev:0,note:'4 People',currency:'JPY'},{item:'Meal',curr:60000,prev:0,note:'3 meals/day',currency:'JPY'}], explanations: {} },
  ]
  for (const p of proposals) {
    await supabase.from('proposals').upsert(p as any, { onConflict: 'exhibition_id,year' })
  }
  console.log('✓ proposals')

  // 3. Payments
  const payments = [
    {exhibition_key:'KIF_2026',item:'Booth Fee',total:5132160,currency:'KRW',deposit_amount:2566080,deposit_due:'2026-03-15',deposit_paid:true,final_amount:2566080,final_due:'2026-05-20',final_paid:false},
    {exhibition_key:'KIF_2026',item:'Design',total:500000,currency:'KRW',deposit_amount:250000,deposit_due:'2026-03-20',deposit_paid:true,final_amount:250000,final_due:'2026-05-20',final_paid:false},
    {exhibition_key:'KIF_2026',item:'Gift',total:1200000,currency:'KRW',deposit_amount:0,deposit_due:null,deposit_paid:false,final_amount:1200000,final_due:'2026-05-30',final_paid:false},
    {exhibition_key:'TS_2026',item:'Booth Fee',total:2420000,currency:'KRW',deposit_amount:1210000,deposit_due:'2026-03-01',deposit_paid:true,final_amount:1210000,final_due:'2026-04-30',final_paid:false},
    {exhibition_key:'TS_2026',item:'Design',total:200000,currency:'KRW',deposit_amount:0,deposit_due:null,deposit_paid:false,final_amount:200000,final_due:'2026-05-14',final_paid:false},
    {exhibition_key:'TS_2026',item:'Gift',total:1880000,currency:'KRW',deposit_amount:0,deposit_due:null,deposit_paid:false,final_amount:1880000,final_due:'2026-05-10',final_paid:false},
    {exhibition_key:'TS_2026',item:'Part Timer',total:500000,currency:'KRW',deposit_amount:0,deposit_due:null,deposit_paid:false,final_amount:500000,final_due:'2026-05-14',final_paid:false},
    {exhibition_key:'SITF_2026',item:'Booth Fee',total:4254250,currency:'KRW',deposit_amount:2127125,deposit_due:'2026-03-15',deposit_paid:true,final_amount:2127125,final_due:'2026-06-01',final_paid:false},
    {exhibition_key:'SITF_2026',item:'Design',total:500000,currency:'KRW',deposit_amount:250000,deposit_due:'2026-03-20',deposit_paid:true,final_amount:250000,final_due:'2026-06-01',final_paid:false},
    {exhibition_key:'SITF_2026',item:'Gift',total:1500000,currency:'KRW',deposit_amount:0,deposit_due:null,deposit_paid:false,final_amount:1500000,final_due:'2026-06-05',final_paid:false},
    {exhibition_key:'Tokyo_2026',item:'Booth Fee',total:780000,currency:'JPY',deposit_amount:390000,deposit_due:'2026-02-15',deposit_paid:true,final_amount:390000,final_due:'2026-03-30',final_paid:true},
    {exhibition_key:'Tokyo_2026',item:'Design',total:1500000,currency:'KRW',deposit_amount:750000,deposit_due:'2026-02-20',deposit_paid:true,final_amount:750000,final_due:'2026-03-15',final_paid:true},
    {exhibition_key:'Tokyo_2026',item:'Item Delivery',total:500000,currency:'KRW',deposit_amount:0,deposit_due:null,deposit_paid:false,final_amount:500000,final_due:'2026-04-01',final_paid:false},
    {exhibition_key:'Tokyo_2026',item:'Gift',total:1500000,currency:'KRW',deposit_amount:0,deposit_due:null,deposit_paid:false,final_amount:1500000,final_due:'2026-04-01',final_paid:false},
    {exhibition_key:'Tokyo_2026',item:'Flight',total:160000,currency:'JPY',deposit_amount:160000,deposit_due:'2026-03-01',deposit_paid:true,final_amount:0,final_due:null,final_paid:false},
    {exhibition_key:'Tokyo_2026',item:'Accommodation',total:180000,currency:'JPY',deposit_amount:180000,deposit_due:'2026-03-01',deposit_paid:true,final_amount:0,final_due:null,final_paid:false},
    {exhibition_key:'Tokyo_2026',item:'Meal',total:60000,currency:'JPY',deposit_amount:0,deposit_due:null,deposit_paid:false,final_amount:60000,final_due:'2026-04-16',final_paid:false},
  ]
  const { error: e3 } = await supabase.from('payments').insert(payments as any)
  if (e3) console.log('payments (may already exist):', e3.message)
  else console.log('✓ payments')

  // 4. Sales Leads
  const leads = [
    {serial_no:'L001',registered_date:'2026-04-16',event_name:'Korea Expo in Tokyo 2026',company_name:'Hanbit Trading Co.',contact_person:'Kim Jisu',phone:'03-1234-5678',email:'jisu@hanbit.jp',lead_source:'Expo',business_type:'Import/Export',country_corridor:'Korea → Japan',expected_monthly_volume:5000,volume_currency:'USD',priority:'High',owner:'Andrew',current_stage:'Proposal Sent',first_contact_done:true,next_action:'Follow up on proposal',remarks:'Large cosmetics importer'},
    {serial_no:'L002',registered_date:'2026-04-17',event_name:'Korea Expo in Tokyo 2026',company_name:'Tokyo Korean Mart',contact_person:'Park Junho',phone:'03-9876-5432',email:'junho@tkmart.jp',lead_source:'Expo',business_type:'Korean Grocery',country_corridor:'Korea → Japan',expected_monthly_volume:2000,volume_currency:'USD',priority:'Medium',owner:'Andrew',current_stage:'Contacted',first_contact_done:true,next_action:'Send brochure',remarks:'Small grocery chain'},
    {serial_no:'L003',registered_date:'2026-04-17',event_name:'Korea Expo in Tokyo 2026',company_name:'Sakura Travel Agency',contact_person:'Yamamoto Keiko',phone:'03-5555-6666',email:'keiko@sakura-travel.jp',lead_source:'Expo',business_type:'Travel Agency',country_corridor:'Korea → Japan',expected_monthly_volume:8000,volume_currency:'USD',priority:'High',owner:'Jacey',current_stage:'Meeting Scheduled',first_contact_done:true,next_action:'Prepare presentation',remarks:'Imports cosmetics from Korea'},
    {serial_no:'L004',registered_date:'2026-04-18',event_name:'Korea Expo in Tokyo 2026',company_name:'Global Remit Japan',contact_person:'Tanaka Hiroshi',phone:'06-1111-2222',email:'hiroshi@gremit.jp',lead_source:'Expo',business_type:'Import/Export',country_corridor:'Korea → Japan',expected_monthly_volume:15000,volume_currency:'USD',priority:'High',owner:'Violet',current_stage:'Negotiation',first_contact_done:true,next_action:'Send revised fee structure',remarks:'Large volume, needs competitive rate'},
    {serial_no:'L005',registered_date:'2026-04-18',event_name:'Korea Expo in Tokyo 2026',company_name:'Noodle House Osaka',contact_person:'Choi Sungwoo',phone:'06-3333-4444',email:'sungwoo@noodle.jp',lead_source:'Expo',business_type:'Korean Restaurant',country_corridor:'Korea → Japan',expected_monthly_volume:1500,volume_currency:'USD',priority:'Low',owner:'John',current_stage:'Lost',first_contact_done:true,next_action:'',lost_reason:'Competitor Already Used',remarks:'Using another provider'},
    {serial_no:'L006',registered_date:'2026-04-18',event_name:'Korea Expo in Tokyo 2026',company_name:'Hanin Mart Tokyo',contact_person:'Lee Hyunwoo',phone:'03-7777-8888',email:'hyunwoo@haninmart.jp',lead_source:'Expo',business_type:'Korean Grocery',country_corridor:'Korea → Japan',expected_monthly_volume:8000,volume_currency:'USD',priority:'High',owner:'Andrew',current_stage:'Onboarding',first_contact_done:true,next_action:'Complete document review',remarks:'Documents submitted'},
    {serial_no:'L007',registered_date:'2026-05-15',event_name:'Travel Show 2026',company_name:'Korea Tour Japan',contact_person:'Shin Jiyeon',phone:'03-2222-3333',email:'jiyeon@ktour.jp',lead_source:'Expo',business_type:'Travel Agency',country_corridor:'Korea → Japan',expected_monthly_volume:20000,volume_currency:'KRW',priority:'High',owner:'Jacey',current_stage:'New Lead',first_contact_done:false,next_action:'Initial contact',remarks:'Met at Travel Show booth'},
    {serial_no:'L008',registered_date:'2026-05-15',event_name:'Travel Show 2026',company_name:'JK Academy',contact_person:'Jang Kyungho',phone:'03-4444-5555',email:'kyungho@jkacademy.jp',lead_source:'Expo',business_type:'Education/Academy',country_corridor:'Korea → Japan',expected_monthly_volume:3000,volume_currency:'USD',priority:'Medium',owner:'Violet',current_stage:'Onboarded / Won',first_contact_done:true,next_action:'',remarks:'Successfully onboarded'},
    {serial_no:'L009',registered_date:'2026-05-15',event_name:'Travel Show 2026',company_name:'Mint Kimbab',contact_person:'Oh Seungmin',phone:'090-9999-0000',email:'seungmin@mintkimbab.jp',lead_source:'Referral',business_type:'Korean Restaurant',country_corridor:'Korea → Japan',expected_monthly_volume:1200,volume_currency:'USD',priority:'Low',owner:'John',current_stage:'Contacted',first_contact_done:true,next_action:'Send brochure',remarks:'Referred by Hanbit Trading'},
    {serial_no:'L010',registered_date:'2026-05-16',event_name:'Travel Show 2026',company_name:'K-Style Fashion',contact_person:'Kwon Yejin',phone:'03-6666-7777',email:'yejin@kstyle.jp',lead_source:'Expo',business_type:'Import/Export',country_corridor:'Korea → Japan',expected_monthly_volume:5000,volume_currency:'USD',priority:'Medium',owner:'Andrew',current_stage:'Proposal Sent',first_contact_done:true,next_action:'Wait for response',remarks:'K-fashion importer'},
  ]
  const { error: e4 } = await supabase.from('sales_leads').insert(leads as any)
  if (e4) console.log('sales_leads (may already exist):', e4.message)
  else console.log('✓ sales_leads')

  // 5. Results (Tokyo 2026)
  const result = {
    exhibition_key: 'Tokyo_2026',
    objective: 'To promote GME BIZ to potential Korean Merchants.',
    event_date: '2026 Apr 16 (THU) - 18 (Sat)',
    event_venue: 'Sunshine City Convention Center, Tokyo',
    event_target: 'Korean merchants in Japan',
    actual_costs: [
      {item:'Booth Fee',budgeted:780000,actual:780000,currency:'JPY'},
      {item:'Design',budgeted:1500000,actual:1480000,currency:'KRW'},
      {item:'Item Delivery',budgeted:500000,actual:620000,currency:'KRW'},
      {item:'Gift',budgeted:1500000,actual:1350000,currency:'KRW'},
      {item:'Flight',budgeted:160000,actual:168000,currency:'JPY'},
      {item:'Accommodation',budgeted:180000,actual:175000,currency:'JPY'},
      {item:'Meal',budgeted:60000,actual:58000,currency:'JPY'},
    ],
    marketing_activities: [
      {type:'SNS',description:'Instagram/Facebook 사전 홍보 3회 게시',result:'도달 1,200명'},
      {type:'Event',description:'가라뽕 스핀 휠 이벤트 1일 2회',result:'참여 180명'},
    ],
    marketing_photos: [],
    reg_remittance: 0, reg_card: 0, reg_biz: 18, reg_onboard: 12,
    cost_per_person: 0, visitors: 280, new_merchants: 18, new_registrations: 0,
    shortcomings: ['머천트 목표(30) 미달성','일본어 브로셔 부족'],
    improvements: ['부스 위치 좋음','이벤트 반응 매우 좋음','Kyodai 협업 효과적'],
    recommendations: ['일본어 자료 보강 필요','현지 파트너와의 협업 확대','다음 해 부스 크기 확대 검토'],
    requests: ['일본어 가능 직원 파견','현지 홍보 예산 증대'],
    conclusion: '첫 해외 박람회로 머천트 목표 미달성이지만, 일본 시장 탐색 및 Kyodai 파트너십 강화에 기여함.',
    cover_title: 'Korea Expo in Tokyo 2026 결과 보고서',
    cover_date: '2026-05-01',
    cover_author: 'Andrew',
    sections_enabled: {1:true,2:true,3:true,4:true,5:true,6:true,7:true,8:true,9:true,10:true},
  }
  const { error: e5 } = await supabase.from('results').upsert(result as any, { onConflict: 'exhibition_key' })
  if (e5) console.log('results:', e5.message)
  else console.log('✓ results')

  console.log('Done!')
}

seed()
