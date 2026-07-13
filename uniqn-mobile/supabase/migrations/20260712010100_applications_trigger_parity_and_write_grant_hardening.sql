-- 파리티 고정 + anon write grant 회수 — 유저플로우 감사 §5 후속 (2026-07-12)
--
-- 배경: prod↔레포 파리티 부채 (pitfall_prod_repo_schema_drift_massive)
--   대규모 파리티 재정렬은 별도 트랙(2026-07-11 parity-baseline-squash)이 다룬다.
--   이 마이그레이션은 유저플로우 감사가 실측으로 확정한 항목만 고정한다.
--
-- [1] applications 트리거 2종 레포 고정 (prod 에만 존재하던 파리티 구멍)
--   applications_updated_at / applications_xss_check 트리거는 20260420235202 가
--   legacy 트리거를 드롭한 뒤 prod 에서만 재생성됐다(P1#10 의
--   tr_notify_cancellation_request 와 동일 패턴 — 20260711030000 이 그걸 고정했고
--   이번에 나머지 2종을 고정한다). 함수 본문은 prod pg_get_functiondef 실측
--   원본 그대로 — prod 에는 완전 no-op, 신규/로컬 환경에는 파리티 복원.
--   ※ update_updated_at / check_xss_fields 는 다른 테이블 트리거도 공유하는
--     함수라 본문을 prod 실측과 다르게 바꾸지 않는다(search_path 하드닝 등은
--     파리티 베이스라인 트랙 소관).
--
-- [2] 레포 전용 느슨 정책 제거 (레포가 prod 보다 위험 — 감사 §5 ④)
--   - notifications_insert_service: base_schema.sql:654 가 만드는
--     `auth.uid() IS NOT NULL OR is_admin()` INSERT 정책. prod 는 notifications
--     INSERT/ALL 정책 0개(알림 생성은 SECURITY DEFINER 트리거 6종 전용)라
--     위조 INSERT 가 거부되지만, db reset 한 로컬/신규 환경은 인증만 되면
--     아무에게나 알림 위조를 허용했다.
--   - work_logs_insert_owner_or_admin / work_logs_delete_admin: prod 의
--     work_logs 정책은 wl_select/wl_update 2개뿐(실측 2026-07-12). 앱 코드에
--     work_logs 클라이언트 직접 INSERT/DELETE 는 0건(생성은 SECDEF RPC 경유)
--     — 레포 전용 잔재를 제거해 prod 파리티. work_logs_update_involved 는
--     20260710010000 이 이미 드롭.
--
-- [3] users.nickname UNIQUE (prod 존재, 레포 누락 — 감사 §5 ④)
--   prod: users_nickname_key UNIQUE (nickname). db reset 시 닉네임 중복
--   생성 구멍이 열리므로 멱등 추가.
--
-- [4] anon write grant 회수 (감사 §5 ⑤, defense-in-depth)
--   notifications / applications / work_logs 에 anon 의
--   INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER grant 가 잔존했다
--   (prod 실측 2026-07-12). 현재는 RLS 가 막고 있으나 정책 실수 한 번이면
--   구멍 — PR #235 가 함수 EXECUTE 에 적용한 것과 같은 계열의 회수.
--   SELECT 는 유지(RLS 게이트 하에서 prod 동작 동일).
--   ※ 로컬 테스트 픽스처(jpc_helpers.sql)의 블랭킷 GRANT 에도 동일 REVOKE 미러.
--
-- 회귀 고정: supabase/tests/parity_pin_write_grants.test.sql (9 케이스)
--            supabase/tests/jpc_work_logs_rls.test.sql (INSERT 4/4 DENY 로 갱신)

-- ============================================================================
-- [1] applications 트리거 파리티 고정 (prod 실측 본문 그대로)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.check_xss_fields()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  field_value TEXT;
  field_name TEXT;
  xss_pattern TEXT := '<\s*script|javascript\s*:|on\w+\s*=|<\s*iframe|<\s*object|<\s*embed';
BEGIN
  FOR field_name IN SELECT unnest(TG_ARGV)
  LOOP
    EXECUTE format('SELECT ($1).%I::text', field_name) INTO field_value USING NEW;
    IF field_value IS NOT NULL AND field_value ~* xss_pattern THEN
      RAISE EXCEPTION 'XSS pattern detected in field: %', field_name;
    END IF;
  END LOOP;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS applications_updated_at ON public.applications;
CREATE TRIGGER applications_updated_at
  BEFORE UPDATE ON public.applications
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS applications_xss_check ON public.applications;
CREATE TRIGGER applications_xss_check
  BEFORE INSERT OR UPDATE ON public.applications
  FOR EACH ROW EXECUTE FUNCTION check_xss_fields('message', 'notes');

-- ============================================================================
-- [2] 레포 전용 느슨 정책 제거 (prod 미존재 → no-op)
-- ============================================================================

DROP POLICY IF EXISTS "notifications_insert_service" ON public.notifications;
DROP POLICY IF EXISTS "work_logs_insert_owner_or_admin" ON public.work_logs;
DROP POLICY IF EXISTS "work_logs_delete_admin" ON public.work_logs;

-- ============================================================================
-- [3] users.nickname UNIQUE (prod 존재 → no-op)
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'users_nickname_key' AND conrelid = 'public.users'::regclass
  ) THEN
    ALTER TABLE public.users ADD CONSTRAINT users_nickname_key UNIQUE (nickname);
  END IF;
END $$;

-- ============================================================================
-- [4] anon write grant 회수 (prod 실변경 — defense-in-depth)
-- ============================================================================

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.notifications, public.applications, public.work_logs
  FROM anon;
