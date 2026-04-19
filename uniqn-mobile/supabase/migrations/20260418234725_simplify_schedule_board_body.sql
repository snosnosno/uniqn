-- 일정 게시글 본문을 메타데이터 나열 대신 단체 대화방 안내문으로 단순화.
-- TS: src/services/boardService.ts buildScheduleBoardBody와 동기화.
-- 기존 자동 생성 게시글은 함수 정의 갱신 후 본문만 일괄 백필 (updated_at /
-- last_activity_at 미터치 → 정렬 영향 없음, is_locked 변화 없음 → 잠금 알림 미발송).

CREATE OR REPLACE FUNCTION public._build_schedule_board_body(p_jp job_postings)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = 'public'
AS $$
DECLARE
  v_lines text[] := ARRAY[]::text[];
  v_description text;
BEGIN
  v_lines := v_lines || (
    '이 게시글은 "' || COALESCE(p_jp.title, '') ||
    '"의 단체 대화방이에요. 공지사항, 문의사항, 소통 등 자유롭게 사용가능합니다.'
  );

  v_description := COALESCE(p_jp.description, '');
  IF length(trim(v_description)) > 0 THEN
    v_lines := v_lines || '';
    -- XSS 방어는 클라이언트 렌더 단계에서 처리.
    v_lines := v_lines || trim(v_description);
  END IF;

  RETURN array_to_string(v_lines, E'\n');
END;
$$;

-- 기존 자동 생성 일정 게시글 본문 백필.
UPDATE public.board_posts bp
SET body = public._build_schedule_board_body(jp)
FROM public.job_postings jp
WHERE bp.linked_job_posting_id = jp.id
  AND bp.board_type = 'schedule'
  AND bp.is_auto_created = true;
