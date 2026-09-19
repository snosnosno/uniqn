-- board_comments: 권한 검사를 핀 메타데이터 불변식보다 **먼저** 발화시킨다.
--
-- 결함: PostgreSQL 은 같은 시점(BEFORE UPDATE)의 행 트리거를 **이름 알파벳 순**으로
--   발화한다. 적용 전 실측 순서(BEFORE UPDATE 행 트리거만 — tgtype 비트로 걸러 확인)는
--     board_comment_parent_integrity -> board_comment_pin_invariants
--     -> board_comment_update_scope -> board_comments_updated_at
--     -> board_comments_xss_check
--   이라서 `board_comment_pin_invariants`(메타데이터 불변식)가
--   `board_comment_update_scope`(권한 검사)보다 앞선다.
--   (`board_comment_notify_insert` 는 AFTER INSERT 트리거라 이 순서와 무관하다.)
--
--   그 결과 댓글 작성자가 자기 댓글을 고정하려 하면, 권한이 없다는 사실
--   ("authors cannot moderate comments") 대신 내부 자료구조 규칙
--   ("pinned comments require pin metadata")을 보게 된다. 권한 없는 호출자에게
--   내부 구조를 먼저 알려주는 순서는 뒤집혀 있다.
--
-- 조치: 핀 불변식 트리거를 `zz_` 접두사로 재등록해 권한 검사 뒤로 보낸다.
--   함수 본문·트리거 이벤트·대상 컬럼은 20260910153217 과 동일하며 이름만 바뀐다.
--   불변식은 "마지막 정합성 확인"이므로 마지막에 도는 것이 의미상으로도 맞다.
--   레포에는 같은 방식의 순서 제어 선례가 있다
--   (`zz_work_logs_recompute_duration`, `zz_work_log_payroll_owner`).
--
-- INSERT 경로는 순서 영향이 없다 — `board_comment_update_scope` 는 BEFORE UPDATE 전용이다.

DROP TRIGGER IF EXISTS board_comment_pin_invariants ON public.board_comments;
DROP TRIGGER IF EXISTS zz_board_comment_pin_invariants ON public.board_comments;

CREATE TRIGGER zz_board_comment_pin_invariants
BEFORE INSERT OR UPDATE OF status, is_pinned, pinned_at, pinned_by
ON public.board_comments
FOR EACH ROW EXECUTE FUNCTION public.enforce_board_comment_pin_invariants();

-- 적용 후 실측 순서:
--   board_comment_parent_integrity -> board_comment_update_scope
--   -> board_comments_updated_at -> board_comments_xss_check
--   -> zz_board_comment_pin_invariants
-- 권한 검사(update_scope)가 불변식(pin_invariants)보다 먼저 돈다.
