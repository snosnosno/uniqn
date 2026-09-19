-- =============================================================================
-- reports_xss_check 트리거 컬럼 확장 (죽은 회로 후속 LOW-8)
-- =============================================================================
-- 배경
--   `reports_xss_check` 는 baseline(20260710000002:12226) 이래
--   `check_xss_fields('description')` **단일 컬럼**만 검사해 왔다.
--   `create_report` 는 authenticated 에 EXECUTE 가 열려 있어 PostgREST 직접 호출로
--   클라 zod(`src/schemas/report.schema.ts` 의 xssValidation)를 통째로 우회할 수 있고,
--   그 경우 아래 컬럼들이 **무검증 저장**된다:
--     · target_name          (클라 zod 있음 — RPC 직접 호출로 우회 가능)
--     · reporter_name        (클라 생성 스키마에 필드 자체가 없다 — 서비스가 프로필에서 채움)
--     · job_posting_title    (클라 zod 있음 — 우회 가능)
--     · work_date            (클라는 YYYY-MM-DD regex 만)
--     · reviewer_notes       (관리자 입력. review_report 가 NULLIF 만 거쳐 그대로 쓴다)
--
--   특히 `target_name` 은 `notify_on_report_review`(20260802170000:124)가
--   `notifications.data.targetName` 으로 그대로 복사한다 — 저장 오염이 알림 데이터까지
--   번진다. 소비처가 RN `<Text>` 라 실행 위험은 없지만, 오염을 저장 시점에 막는 것이 맞다.
--
-- 하는 일
--   공용 트리거 함수 `check_xss_fields`(무인자, 컬럼명을 TG_ARGV 로 받는다)를 **그대로
--   재사용**해 트리거만 재생성한다. 함수 신설·재정의 없음.
--   선례: 20260717093000:437-440 이 정확히 같은 방식으로 job_postings 에 contact_phone 을
--   추가했다.
--
--   제외한 컬럼: uuid/enum/CHECK/timestamp 계열 전부.
--   · evidence_urls  — 20260802170200 이 charset 화이트리스트 패턴으로 이미 봉쇄
--   · reviewer_id    — review_report 가 `p_reviewer_id::text` 캐스팅으로만 쓴다
--
-- ⚠️ 파리티: **함수 수 불변 · 정책 수 불변**.
--    CREATE OR REPLACE FUNCTION 이 없으므로 pg_proc 에 새 행이 생기지 않는다.
--    → supabase/tests/parity_baseline_guard.test.sql 갱신 불필요(191/111 유지).
--
-- ⚠️ 발화 순서: BEFORE 트리거는 이름 알파벳순으로 발화한다 —
--    reports_updated_at → reports_xss_check → tr_reports_pin_identity.
--    트리거 이름을 그대로 두므로 순서가 유지된다(20260802170300:76 이 세운 전제).
--
-- ⚠️ proconfig 함정 해당 없음: 함수 본문을 건드리지 않으므로 `check_xss_fields` 의
--    `SET search_path TO 'public'` 은 그대로다. (`CREATE OR REPLACE` 의 SET 절이
--    proconfig 를 통째로 교체하는 함정은 이 마이그와 무관하다.)
--
-- ⚠️ 소급 아님 — 기존 행은 검사하지 않는다. 다만 오염 행이 **이미 있으면** 이후 그 행의
--    모든 UPDATE(review_report·permanently_delete_user 의 reporter_id NULL 화 포함)가
--    이 트리거에 걸려 실패한다. 적용 전 오염 행 0건 프로브가 게이트다.
--    → 2026-08-02 prod 실측: `public.reports` **0행**(오염 0). 차단 위험 없음.
--
-- ⚠️ 기성 비대칭(신규 아님): 서버 정규식 `on\w+\s*=` 에는 단어 경계가 없어
--    클라 `\bon[a-z]+\s*=` 보다 넓다(예: 'condition=3' 은 클라 통과·서버 거부).
--    이미 커버 중인 8개 테이블과 동일한 성질이라 이 마이그가 새로 만드는 축이 아니다.
--
-- ⚠️ 버전 번호: `20260802180000` 은 미머지 브랜치(feat/work-log-slot-sync)의
--    `update_work_log_slot_rpc` 가 이미 점유했다. schema_migrations 의 PK 가 version
--    단일 컬럼이라 공존할 수 없으므로 190000 을 쓴다(PR#406 이 같은 충돌을 겪었다).
-- =============================================================================

DROP TRIGGER IF EXISTS reports_xss_check ON public.reports;

CREATE TRIGGER reports_xss_check
  BEFORE INSERT OR UPDATE ON public.reports
  FOR EACH ROW
  EXECUTE FUNCTION public.check_xss_fields(
    'description',
    'target_name',
    'reporter_name',
    'job_posting_title',
    'reviewer_notes',
    'work_date'
  );

COMMENT ON TRIGGER reports_xss_check ON public.reports IS
  'reports 의 자유 텍스트 사용자 입력 전부를 서버에서 검사한다. create_report RPC 는 authenticated 에 열려 있어 클라 zod 가 우회 가능하다 — 컬럼을 빼면 그 컬럼이 무방비가 된다.';
