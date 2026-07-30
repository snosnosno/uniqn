-- 스케줄 보드 동기화가 description 있는 공고에서만 두 달간 조용히 실패한 결함 수정
--
-- 증상
--   schedule_board_sync_outbox 에 status='failed_retry_limit' 35건이
--   2026-06-03 ~ 07-30 누적. 에러는 전부
--   `sync_schedule_board RPC failed: malformed array literal: ""` (SQLSTATE 22P02).
--
-- 근본 원인
--   아래 한 줄이다.
--
--     v_lines := v_lines || '';
--
--   `''` 는 **unknown 타입 리터럴**이다. `text[] || unknown` 을 만나면 Postgres 는
--   `anyarray || anyelement` 가 아니라 `anyarray || anyarray` 로 해소해서
--   `''` 를 `array_in('')` 로 배열 파싱하려 든다 → `malformed array literal: ""`.
--
--   같은 함수의 다른 두 append 는 멀쩡하다. 첫 줄은 `'...' || COALESCE(...) || '...'`
--   로 **이미 text 로 확정된** 식이고, 마지막 줄은 `trim(v_description)` 으로 역시
--   text 다. 오직 맨몸 `''` 만 unknown 이라 배열로 해소된다.
--
--   그리고 이 줄은 `IF length(trim(v_description)) > 0` 안에 있다. 그래서
--   **설명이 있는 공고에서만** 터진다 — 이것이 "두 달째 조용히" 의 정체다.
--
-- 실측 증거 (prod, 2026-07-31)
--   재현:   SELECT (ARRAY[]::text[] || '');   → ERROR 22P02 malformed array literal: ""
--   수정안: SELECT (ARRAY[]::text[] || ''::text); → {""} (길이 1, 의도한 빈 줄)
--   상관:   실패 공고 17건 → description 있음 17 / 없음 0
--           성공 공고 13건 → description 있음  0 / 없음 13   (예외 0건)
--
-- 변경 범위
--   `''` → `''::text` 한 글자 그룹. 나머지 본문은 prod 현행 정의(pg_proc.prosrc)를
--   그대로 옮겼다 — 재정의 베이스는 archive 가 아니라 최신 정의여야 한다
--   (wiki decisions/secdef-replace-search-path-loss).
--   속성 보존: plpgsql / SECURITY INVOKER / search_path=public / IMMUTABLE.

CREATE OR REPLACE FUNCTION public._build_schedule_board_body(p_jp job_postings)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $function$
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
    -- ⚠️ `''` 를 맨몸으로 두면 unknown 리터럴이라 `anyarray || anyarray` 로 해소돼
    --    `malformed array literal: ""` 로 죽는다. 명시 캐스트가 필수다.
    v_lines := v_lines || ''::text;
    -- XSS 방어는 클라이언트 렌더 단계에서 처리.
    v_lines := v_lines || trim(v_description);
  END IF;

  RETURN array_to_string(v_lines, E'\n');
END;
$function$;
