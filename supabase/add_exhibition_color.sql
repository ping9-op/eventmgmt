-- 박람회 색상 컬럼 추가 — DB에서 색상 관리
-- Supabase SQL Editor에서 실행하세요

ALTER TABLE exhibitions
  ADD COLUMN IF NOT EXISTS color TEXT DEFAULT NULL;

-- 기존 박람회 기본 색상 지정
UPDATE exhibitions SET color = '#B5363A' WHERE key = 'KIF';
UPDATE exhibitions SET color = '#2E7D51' WHERE key = 'TS';
UPDATE exhibitions SET color = '#7B2D8B' WHERE key = 'SITF';
UPDATE exhibitions SET color = '#C47D1A' WHERE key = 'Tokyo';
