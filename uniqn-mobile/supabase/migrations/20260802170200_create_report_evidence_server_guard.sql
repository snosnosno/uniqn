-- =============================================================================
-- create_report: 증빙 참조(p_evidence_urls) 서버측 검증
-- =============================================================================
-- 배경
--   `create_report` 는 지금까지 `p_evidence_urls` 를 **한 번도 보지 않고**
--   `COALESCE(p_evidence_urls, ARRAY[]::text[])` 로 그대로 INSERT 했다.
--   유일한 방어는 클라이언트 zod(`report.schema.ts` 의 reportEvidenceRefSchema)뿐인데,
--   이 RPC 는 authenticated 에 EXECUTE 가 열려 있어 PostgREST 로 직접 호출하면 zod 를 통째로 건너뛴다.
--   `reports_xss_check` 트리거는 `description` **단일 컬럼**만 검사하므로 여기도 막지 못한다.
--
--   그 결과 인증된 아무 사용자나 임의 외부 URL 을 증빙으로 심을 수 있었고,
--   관리자가 신고 상세를 여는 순간 `<Image source={{uri}}>` 가 그 URL 을 그대로 가져온다
--   (`useReportEvidence.ts` 의 isAbsoluteEvidenceUrl 이 `^https?://` 를 통과시킨다).
--   → 관리자 열람 시각 + 공인 IP/UA 가 공격자 서버로 새고, 배열 길이 제한도 없어 화면 마비까지 가능했다.
--   (`javascript:`/`data:` 는 클라 게이트에 막혀 XSS 승격은 없다 — 누출·가용성 문제다.)
--
-- 이 마이그레이션이 하는 일
--   신규 신고에 한해 증빙 참조를 **본인이 업로드한 Storage 경로**로만 제한한다.
--   형태는 클라이언트 REPORT_EVIDENCE_PATH_PATTERN 과 동일하되,
--   첫 세그먼트를 `p_reporter_id` 로 **못 박아** 남의 폴더 경로를 심을 수 없게 한다
--   (Storage RLS 의 `foldername(name)[1] = auth.uid()` 와 같은 축).
--
--   ⚠️ 기존 행은 건드리지 않는다. 과거 http(s) 증빙이 있는 행은 그대로 읽힌다 —
--      제한은 INSERT 경로에만 건다.
--
-- 원본 정의: archive/20260420150000_add_report_rpcs.sql (이후 변경 없음, prosrc 실측으로 대조).
-- 검증 블록 외 본문·시그니처·SECDEF·search_path 는 한 글자도 바꾸지 않는다.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.create_report(
  p_type text,
  p_reporter_type text,
  p_reporter_id uuid,
  p_reporter_name text,
  p_target_id uuid,
  p_target_name text,
  p_job_posting_id uuid,
  p_job_posting_title text,
  p_description text,
  p_evidence_urls text[],
  p_severity report_severity,
  p_work_log_id uuid DEFAULT NULL::uuid,
  p_work_date text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_report_id           uuid;
  v_existing_report_id  uuid;
  v_ref                 text;
  v_evidence_pattern    text;
BEGIN
  IF auth.uid() IS DISTINCT FROM p_reporter_id THEN
    RAISE EXCEPTION 'FORBIDDEN: 본인 계정으로만 신고할 수 있습니다 (auth.uid=%, p_reporter_id=%)',
      auth.uid(), p_reporter_id
      USING ERRCODE = 'P0001';
  END IF;

  IF p_reporter_id = p_target_id THEN
    RAISE EXCEPTION 'CANNOT_REPORT_SELF: 본인을 신고할 수 없습니다'
      USING ERRCODE = 'P0001';
  END IF;

  IF p_reporter_type NOT IN ('employer', 'employee') THEN
    RAISE EXCEPTION 'INVALID_REPORTER_TYPE: 유효하지 않은 신고자 유형 (%)', p_reporter_type
      USING ERRCODE = 'P0001';
  END IF;

  -- ---- 증빙 검증 (신설) ----
  -- 클라 상한과 같은 3장. array_length 는 빈 배열에서 NULL 이라 비교가 통과하지 않는다(의도).
  IF p_evidence_urls IS NOT NULL THEN
    IF array_length(p_evidence_urls, 1) > 3 THEN
      RAISE EXCEPTION 'TOO_MANY_EVIDENCE: 증빙은 최대 3장까지 첨부할 수 있습니다 (요청 %)',
        array_length(p_evidence_urls, 1)
        USING ERRCODE = 'P0001';
    END IF;

    -- 첫 세그먼트를 신고자 본인으로 고정한다 — 남의 폴더도, 외부 URL 도 통과할 수 없다.
    v_evidence_pattern :=
      '^' || p_reporter_id::text || '/[A-Za-z0-9._-]{1,64}/[A-Za-z0-9._-]{1,96}\.(jpg|jpeg|png|webp)$';

    FOREACH v_ref IN ARRAY p_evidence_urls LOOP
      IF v_ref IS NULL OR v_ref !~* v_evidence_pattern THEN
        RAISE EXCEPTION 'INVALID_EVIDENCE_REF: 증빙은 본인이 업로드한 이미지 경로여야 합니다'
          USING ERRCODE = 'P0001';
      END IF;
    END LOOP;
  END IF;

  SELECT id INTO v_existing_report_id
    FROM public.reports
    WHERE reporter_id     = p_reporter_id
      AND target_id       = p_target_id
      AND job_posting_id  = p_job_posting_id
      AND type            = p_type
      AND created_at      > now() - interval '24 hours'
    LIMIT 1;

  IF v_existing_report_id IS NOT NULL THEN
    RAISE EXCEPTION 'DUPLICATE_REPORT: 24시간 내 동일 건을 이미 신고했습니다 (existing=%)',
      v_existing_report_id
      USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.reports (
    type,
    reporter_type,
    reporter_id,
    reporter_name,
    target_id,
    target_name,
    job_posting_id,
    job_posting_title,
    work_log_id,
    work_date,
    description,
    evidence_urls,
    severity,
    status
  )
  VALUES (
    p_type,
    p_reporter_type,
    p_reporter_id,
    p_reporter_name,
    p_target_id,
    p_target_name,
    p_job_posting_id,
    NULLIF(p_job_posting_title, ''),
    p_work_log_id,
    p_work_date,
    p_description,
    COALESCE(p_evidence_urls, ARRAY[]::text[]),
    p_severity,
    'pending'
  )
  RETURNING id INTO v_report_id;

  RETURN jsonb_build_object('report_id', v_report_id);
END;
$function$;

COMMENT ON FUNCTION public.create_report(
  text, text, uuid, text, uuid, text, uuid, text, text, text[], report_severity, uuid, text
) IS
  '양방향 신고 생성. 증빙(p_evidence_urls)은 신고자 본인 폴더의 이미지 Storage 경로 최대 3장만 허용한다 '
  '— 클라 zod 는 RPC 직접 호출로 우회되므로 서버에서 같은 규칙을 강제한다. 기존 행에는 소급 적용하지 않는다.';

-- CREATE OR REPLACE 는 ACL 을 보존하지만, anon 회수 상태를 명시적으로 재확인한다
-- (20260621090000_harden_anon_rpc_revoke_and_delete_guard 가 확립한 규율).
REVOKE ALL ON FUNCTION public.create_report(
  text, text, uuid, text, uuid, text, uuid, text, text, text[], report_severity, uuid, text
) FROM PUBLIC, anon;
