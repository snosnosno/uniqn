-- =============================================================================
-- 신고 증빙(report evidence) 전용 Storage 버킷 + RLS 정책
--
-- 배경:
--   `reports.evidence_urls` 는 타입/RPC 파라미터(`p_evidence_urls`)까지 있으면서
--   사진을 올리는 UI 가 없어 항상 빈 배열이었다. 관리자는 진술 대 진술만 놓고 판정해 왔다.
--   노쇼·임금체불·폭언처럼 심각도 높은 신고에 증빙을 붙일 수 있도록 저장소를 연다.
--
-- 왜 별도 버킷인가 (1:1 문의 버킷 `inquiry-attachments` 재사용 대신):
--   버킷은 보존/수명주기/일괄정리의 단위다. 문의 첨부와 분쟁 증빙이 한 통에 섞이면
--   문의 쪽 정리 정책이 증빙을 조용히 지울 수 있고, 파일이 한 번 쌓이면 되돌리기 어렵다.
--   RLS 축(`storage.foldername(name)[1] = auth.uid()`)과 용량/MIME 제약은 문의 버킷과 동일하게 맞춘다.
--
-- 경로 규칙: {업로더uid}/{제출id}/{timestamp}-{random}.{jpg|png|webp}
--   첫 세그먼트가 업로더 uid 여야 INSERT/SELECT 정책이 성립한다.
--
-- 권한 설계:
--   INSERT — 본인 폴더에만 (auth.uid())
--   SELECT — 본인 + 관리자
--   DELETE — **관리자만**. 신고자가 접수 뒤 증빙을 지울 수 있으면 이 기능의 목적(판정 근거 보존)이
--            사라진다. 대신 클라이언트는 신고 생성 **전에** 업로드를 끝내므로 롤백 삭제가 필요 없고,
--            부분 업로드 실패로 남는 고아 파일은 로그로만 남긴다.
--   UPDATE — 없음(덮어쓰기 불가, upsert:false 와 일관).
--
-- 멱등: 버킷은 ON CONFLICT UPDATE, 정책은 존재 검사 후 생성.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. 버킷 생성 (비공개, 5MB, 이미지 3종)
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  VALUES ('report-evidence', 'report-evidence', false, 5242880,
          ARRAY['image/jpeg','image/png','image/webp'])
  ON CONFLICT (id) DO UPDATE SET
    public             = EXCLUDED.public,
    file_size_limit    = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;
EXCEPTION
  WHEN undefined_table THEN
    RAISE WARNING '[report_evidence_storage] storage.buckets 부재 — skip';
END $$;

-- -----------------------------------------------------------------------------
-- 2. storage.objects RLS 정책 3종
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  p record;
BEGIN
  FOR p IN
    SELECT * FROM (VALUES
      ('report_evidence_insert_own','INSERT',NULL,
       '((bucket_id = ''report-evidence''::text) AND ((storage.foldername(name))[1] = (auth.uid())::text))'),
      ('report_evidence_select_own_or_admin','SELECT',
       '((bucket_id = ''report-evidence''::text) AND (((storage.foldername(name))[1] = (auth.uid())::text) OR public.is_admin()))',
       NULL),
      ('report_evidence_delete_admin_only','DELETE',
       '((bucket_id = ''report-evidence''::text) AND public.is_admin())',
       NULL)
    ) AS t(polname, cmd, qual, with_check)
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = p.polname
    ) THEN
      EXECUTE format(
        'CREATE POLICY %I ON storage.objects FOR %s TO authenticated %s %s',
        p.polname,
        p.cmd,
        COALESCE('USING (' || p.qual || ')', ''),
        COALESCE('WITH CHECK (' || p.with_check || ')', '')
      );
    END IF;
  END LOOP;
EXCEPTION
  WHEN insufficient_privilege THEN
    RAISE WARNING '[report_evidence_storage] storage.objects 정책 생성 권한 없음 — skip';
  -- 1번 블록(버킷)은 undefined_table 을 잡는데 여기만 안 잡으면,
  -- storage 스키마가 없어 1번이 skip 된 바로 그 환경에서 42P01 로 마이그 전체가 실패한다.
  WHEN undefined_table THEN
    RAISE WARNING '[report_evidence_storage] storage.objects 부재 — skip';
END $$;

-- -----------------------------------------------------------------------------
-- 3. 컬럼 의미 갱신 주석
--    evidence_urls 는 이제 "URL"이 아니라 report-evidence 버킷의 Storage 경로를 담는다.
--    (서명 URL 은 만료되므로 저장하지 않는다. 과거 데이터의 http(s) URL 은 읽기 쪽에서만 허용.)
-- -----------------------------------------------------------------------------
COMMENT ON COLUMN public.reports.evidence_urls IS
  '증빙 참조 배열. 신규 데이터는 report-evidence 버킷의 Storage 경로({업로더uid}/{제출id}/{파일명}). 서명 URL 은 열람 시점 발급. 과거 데이터에 한해 http(s) 절대 URL 존재 가능.';
