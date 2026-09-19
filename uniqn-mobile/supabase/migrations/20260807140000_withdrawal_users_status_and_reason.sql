-- =============================================================================
-- 회원탈퇴 파이프라인 ① — users.status 에 'deactivated' 허용 + 탈퇴 사유 저장
-- =============================================================================
-- 배경 (2026-08-07 prod 실측)
--   `UserRepository.requestDeletion`(src/repositories/supabase/UserRepository.ts:308)
--   이 `status = 'deactivated'` 를 쓰는데, prod `users_status_check` 는
--     CHECK (status = ANY (ARRAY['active','inactive','suspended','deleted']))
--   라 **'deactivated' 를 거부한다**. 즉 회원탈퇴 요청 자체가 100% 실패해 왔다.
--
--   로컬에서 같은 UPDATE 를 재현해 확인:
--     ERROR: new row for relation "users" violates check constraint "users_status_check"
--
--   prod `users` 27행 전부 status='active' 이고 deactivated·deleted 는 0행이다.
--   전체 감사(2026-08-07 A1)는 이 0건을 "아직 탈퇴한 사람이 없다"로 읽었으나, 실제로는
--   **탈퇴가 불가능해서** 0건이다. 그래서 크론 가드만 고치면(마이그 ②) 삭제 대상 행이
--   구조적으로 영원히 0건이라 수선이 공허해진다 — 이 마이그가 ②의 선행 조건이다.
--
--   앱 계층은 이미 'deactivated' 를 정본으로 취급한다(단방향 드리프트):
--     · src/types/user.ts:124            — status 유니온에 'deactivated' 포함
--     · src/schemas/user.schema.ts:33    — userStatusSchema 에 'deactivated' 포함
--     · UserRepository.ts:388            — 탈퇴 철회가 status='deactivated' 로 행을 찾는다
--     · supabase/functions/process-scheduled-deletions/index.ts:59 — 크론 조회 조건
--   → DB 쪽 CHECK 만 뒤처져 있었다. DB 를 앱에 맞춘다('deleted' 등 기존 값은 전부 보존).
--
-- 탈퇴 사유 저장 (감사 A2 "덤")
--   화면이 사유를 **필수**로 받는데(app/(app)/settings/delete-account.tsx:157-160)
--   저장되는 곳이 없었다 — requestDeletion 의 UPDATE 에 reason 이 아예 없고,
--   UserRepository.ts:222 주석이 "DB에 reason 컬럼이 별도로 없으면 기본값"이라고 자인한다.
--   users 에 컬럼 2개를 추가해 실제로 적재한다.
--
--   ⚠️ 알려진 한계(사용자 승인됨): 이 컬럼은 users 행에 있으므로 유예기간 만료 후
--      `permanently_delete_user` 의 `DELETE FROM public.users` 와 함께 사라진다.
--      즉 "유예 중인 탈퇴자의 사유"만 보인다. 영구 이탈 분석이 필요해지면 별도 익명
--      보존 테이블(deletion_feedback)이 맞다 — 그때 이 컬럼에서 승계할 것.
--
-- ⚠️ 파리티 불변: 함수 200 · 정책 111.
--    CREATE FUNCTION 없음(pg_proc 무변화), RLS 정책 무변화.
--    users_xss_check 는 DROP+CREATE 재생성이라 **트리거 개수도 불변**이며,
--    이름을 그대로 두므로 BEFORE 트리거 알파벳순 발화 순서도 유지된다
--    (선례: 20260802190000 reports_xss_check 컬럼 확장과 동일 방식).
--
-- ⚠️ 기존 행 영향 없음: prod·로컬 모두 status 는 'active' 뿐이라 제약 확장은 순수 완화다.
--    (제약을 넓히기만 하므로 기존 행 재검증에서 실패할 수 없다.)
-- =============================================================================

-- ─── 1) status 에 'deactivated' 추가 ────────────────────────────────────────
-- 기존 4값은 전부 보존한다. 'deleted' 는 getDeletionStatus(UserRepository.ts:218)가
-- '삭제 완료'로 해석하는 종결 상태라 'deactivated'(유예 중)와 의미가 다르다 — 둘 다 필요.
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_status_check;

ALTER TABLE public.users
  ADD CONSTRAINT users_status_check
  CHECK (status = ANY (ARRAY['active'::text, 'inactive'::text, 'suspended'::text,
                             'deactivated'::text, 'deleted'::text]));

-- ─── 2) 탈퇴 사유 컬럼 ──────────────────────────────────────────────────────
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS deletion_reason text,
  ADD COLUMN IF NOT EXISTS deletion_reason_detail text;

COMMENT ON COLUMN public.users.deletion_reason IS
  '회원탈퇴 사유 코드. DELETION_REASONS(src/services/auth/accountDeletionService.ts:28) 와 동일 집합.';
COMMENT ON COLUMN public.users.deletion_reason_detail IS
  '탈퇴 사유 상세(reason=''other'' 일 때만 수집). 자유 텍스트 — users_xss_check 가 검사한다.';

-- 사유 코드는 앱 상수와 같은 집합으로 고정한다. 앱에서 값을 추가하면 이 제약도 함께 넓힐 것.
-- (NULL 허용 — 이 마이그 이전에 만들어진 행과, 사유 없이 만들어지는 관리자 경로를 위해)
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_deletion_reason_check;

ALTER TABLE public.users
  ADD CONSTRAINT users_deletion_reason_check
  CHECK (deletion_reason IS NULL OR deletion_reason = ANY (ARRAY[
    'no_longer_needed'::text,
    'found_better_service'::text,
    'privacy_concerns'::text,
    'too_many_notifications'::text,
    'difficult_to_use'::text,
    'other'::text
  ]));

-- 자유 텍스트 길이 상한 — 화면 입력은 3줄짜리 multiline 이라 500자면 충분하고,
-- PostgREST 직접 호출로 무제한 텍스트가 들어오는 것을 막는다.
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_deletion_reason_detail_len_check;

ALTER TABLE public.users
  ADD CONSTRAINT users_deletion_reason_detail_len_check
  CHECK (deletion_reason_detail IS NULL OR char_length(deletion_reason_detail) <= 500);

-- ─── 3) XSS 검사 대상에 deletion_reason_detail 추가 ─────────────────────────
-- 공용 트리거 함수 `check_xss_fields`(무인자, 컬럼명을 TG_ARGV 로 받는다)를 재사용한다.
-- 함수 신설·재정의 없음 → 파리티 불변. 기존 4컬럼은 그대로 두고 1개만 덧붙인다.
-- deletion_reason 은 위 CHECK 로 값 집합이 고정돼 자유 텍스트가 아니므로 제외한다.
DROP TRIGGER IF EXISTS users_xss_check ON public.users;

CREATE TRIGGER users_xss_check
  BEFORE INSERT OR UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.check_xss_fields(
    'name', 'nickname', 'note', 'career', 'deletion_reason_detail'
  );
