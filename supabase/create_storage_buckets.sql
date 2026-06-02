-- Supabase Storage 버킷 생성
-- Supabase SQL Editor에서 실행하세요

-- 결과 보고서 현장 사진 버킷 (공개)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'report-photos',
  'report-photos',
  true,                                -- public: 공개 URL로 이미지 표시
  10485760,                            -- 10MB per file
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic']
)
ON CONFLICT (id) DO NOTHING;

-- RLS 정책: 인증된 사용자만 업로드/삭제, 공개 읽기
CREATE POLICY "Public read report photos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'report-photos');

CREATE POLICY "Authenticated upload report photos"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'report-photos' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated delete report photos"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'report-photos' AND auth.role() = 'authenticated');
