-- ============================================================
-- 감사 sec-01 / sec-02 — storage 하드닝
-- 출처: docs/analysis/2026-08-09-full-app-audit-2rounds.md §3 S0-서버
-- ============================================================
--
-- ## sec-01 [MEDIUM] chat 버킷 4정책에 소유자 술어가 없다
--
-- prod 실측(2026-08-09): storage.objects 정책 35개 중 chat 4종만 술어가
--   `bucket_id = 'chat'` 뿐이다. 나머지 11개 버킷은 전부
--   `(storage.foldername(name))[1] = (auth.uid())::text` 를 건다.
--   **UPDATE/DELETE 에 소유자 검사가 없는 버킷은 chat 이 유일**하다
--   → 인증된 아무 사용자나 남의 chat 객체를 읽고 덮어쓰고 지울 수 있다.
--   원천: 20260710000003_baseline_platform_glue.sql:96-99
--
-- ## 설계 결정 — 왜 "버킷 제거"가 아니라 "정책 조이기"인가 (실측 근거)
--
-- 감사는 (a) owner-scope 봉합 / (b) 버킷 자체 제거 두 안을 제시했다.
-- 근거만 보면 (b) 가 우세했다: chat 버킷 참조 코드 **0건**(src·app·functions·
--   supabase/functions 전수), chat 객체 **0개**, chat/messages 테이블 **0개**,
--   그리고 수익모델 문서가 카카오톡 오픈채팅을 외부 대체재로 명시해 인앱 채팅
--   로드맵이 없음을 시사한다.
--
-- 그런데 (b) 는 **SQL 로 물리적으로 불가능**하다 — 로컬 실측:
--     DELETE FROM storage.buckets WHERE id='chat';
--     → ERROR: Direct deletion from storage tables is not allowed.
--       Use the Storage API instead. (storage.protect_delete() 트리거)
--   버킷 제거는 Storage API/대시보드 전용이다. 마이그로 할 수 없다.
--
-- ## 구현 — 왜 DROP/ALTER 가 아니라 RESTRICTIVE 정책 추가인가 (실측 근거)
--
-- 느슨한 chat 4정책을 고치려면 DROP+CREATE 또는 ALTER POLICY 가 필요한데
-- 둘 다 **테이블 소유자**를 요구한다. prod 실측:
--     storage.objects owner = supabase_storage_admin
--     current_user = postgres · rolsuper = false
--     pg_has_role(postgres, 'supabase_storage_admin', 'USAGE') = false
--   → prod 에서 DROP/ALTER POLICY 는 42501 로 실패한다
--     (memory/pitfall_supabase_storage_drop_policy.md 가 기록한 그 함정.
--      로컬 스택에서는 postgres 가 슈퍼유저라 성공하므로 **로컬 통과 ≠ prod 통과**다).
--
-- CREATE POLICY 는 동작한다 — 선례 2건이 prod 에 실재한다
--   (20260420164817 inquiry_attachments_storage_policies ·
--    20260802112404 report_evidence_storage → 해당 정책들이 prod pg_policies 에 존재).
--
-- 그래서 **RESTRICTIVE 정책을 하나 얹는다**. RESTRICTIVE 는 기존 PERMISSIVE 정책과
-- AND 로 결합하므로, 느슨한 4정책을 건드리지 않고도 chat 접근을 소유자로 좁힐 수 있다.
-- 술어를 `bucket_id IS DISTINCT FROM 'chat' OR 소유자일치` 로 써서 **다른 10개 버킷에는
-- 항상 TRUE** 가 되게 했다 — 기존 동작 무변경이 이 술어 형태의 존재 이유다.
--   · `IS DISTINCT FROM`: storage.objects.bucket_id 는 NULLABLE(실측)이라
--     `<>` 를 쓰면 NULL 행에서 술어가 NULL → RESTRICTIVE 가 차단해버린다.
--   · 루트 경로 업로드(폴더 없음)는 foldername[1] 이 NULL → 차단(fail-close).
--     다른 버킷들과 동일한 계약이다.
--
-- ⚠️ 되돌리기·후속: 이 RESTRICTIVE 정책도 같은 이유로 **SQL 로는 DROP 할 수 없다**.
--   채팅을 실제로 구현해 "참여자 판정" 정책으로 교체할 때는 Supabase 대시보드에서
--   이 정책을 지우고 새 정책을 만들어야 한다. 그때가 chat 버킷 자체를 Storage API 로
--   제거할지 결정할 시점이기도 하다(현재로선 제거가 근거상 우세).
--
-- ## sec-02 [LOW] temp 버킷 allowed_mime_types = NULL (20MB 무제한 타입)
--
-- prod 실측: 12개 버킷 중 temp 만 allowed_mime_types 가 NULL 이다.
-- temp 정책 3종(select/insert/delete)은 이미 owner-scope 라 남의 폴더는 못 건드리지만,
-- **임의 확장자 20MB 업로드**는 열려 있다. 앱이 읽지도 정리하지도 않는 버킷이라
-- 실질은 무료 파일호스팅 벡터다. 실제 업로드 타입의 합집합으로 좁힌다.
--   · image/svg+xml 은 제외했다 — SVG 는 서빙 시 XSS 벡터이고 temp 에 필요가 없다.
--
-- ## 파리티
-- storage 스키마 소관이라 public 함수/정책 카운트 불변
--   → PARITY_EXPECT_FUNCS=208 · PARITY_EXPECT_POLICIES 는 같은 배치의
--     20260809140000 에서 111 → 110 으로 갱신된다(이 파일은 무영향).
--
-- ## 회귀 고정
-- supabase/tests/storage_chat_owner_scope.test.sql
-- ============================================================

-- -----------------------------------------------------------------------------
-- 1. sec-01 — chat 버킷 소유자 스코프 RESTRICTIVE 정책
--    ※ insufficient_privilege 를 일부러 잡지 않는다. 보안 수정이 조용히 skip 되면
--      "적용했다"고 기록되면서 구멍이 남는다 — 실패하려면 시끄럽게 실패해야 한다.
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'chat_storage_owner_scope'
  ) THEN
    EXECUTE $ddl$
      CREATE POLICY chat_storage_owner_scope
        ON storage.objects
        AS RESTRICTIVE
        FOR ALL
        TO authenticated
        USING (
          bucket_id IS DISTINCT FROM 'chat'::text
          OR (storage.foldername(name))[1] = (auth.uid())::text
        )
        WITH CHECK (
          bucket_id IS DISTINCT FROM 'chat'::text
          OR (storage.foldername(name))[1] = (auth.uid())::text
        )
    $ddl$;
  END IF;
EXCEPTION
  -- storage 스키마가 아예 없는 환경(축소 로컬 등)에서만 skip.
  -- 보안 술어를 못 얹는 상황이 아니라, 보호할 대상 자체가 없는 상황이다.
  WHEN undefined_table THEN
    RAISE WARNING '[sec-01] storage.objects 부재 — skip';
END $$;

-- ⚠️ COMMENT ON POLICY ... ON storage.objects 를 쓰지 말 것.
--   CI 실측(2026-08-09, DB Tests): `ERROR: must be owner of relation objects (SQLSTATE 42501)`.
--   같은 마이그의 CREATE POLICY 는 통과했는데 COMMENT 만 막힌다 — 즉 이 테이블에서
--   "정책 생성"과 "정책 주석"의 권한 요건이 다르다. 정책의 의도는 위 헤더 주석에 남긴다.
--   🔑 로컬 psql(-U postgres)은 슈퍼유저라 COMMENT 가 **성공한다**. 로컬 통과 ≠ CI/prod 통과.

-- -----------------------------------------------------------------------------
-- 2. sec-02 — temp 버킷 MIME 화이트리스트
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  UPDATE storage.buckets
  SET allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
  WHERE id = 'temp';
EXCEPTION
  WHEN undefined_table THEN
    RAISE WARNING '[sec-02] storage.buckets 부재 — skip';
END $$;
