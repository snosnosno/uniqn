-- 지점(job_postings container) 기본명 소급 정정
--
-- 배경: `useEnsureDefaultVenue` 가 지점 이름을 **워크스페이스 이름에서 그대로 복사**했다.
-- 그 결과 팀도 '내 팀', 지점도 '내 팀' 인 사용자가 생겼다. 팀과 지점은 다른 축인데 화면에서
-- 같은 단어로 불리면 어느 쪽을 고르는 건지 알 수 없다. S1(PR#370)이 클라 경로를
-- `defaultVenueName()` SSOT 로 바꿔 유입은 끊었지만, 이미 만들어진 행은 그대로 남아 있다.
--
-- 대상 판별 (사용자가 지은 이름은 불가침)
--   ① title 이 소속 워크스페이스 이름과 같다  → 복사 버그의 산물. 사람이 고른 값이 아니다.
--   ② title 이 레거시 기본값('기본 지점' / '내 지점')이다.
-- 🔑 "손대지 않았음" 의 근거는 추정이 아니다 — **지점 이름을 바꿀 수단 자체가 없었다.**
--    rename UI/RPC 는 S1 이 처음 도입했고(prod 적용 2026-07-30), 대상 행은 전부 그 이전에
--    마지막으로 수정됐다. 즉 prod 의 모든 컨테이너 제목은 기계 생성값이다.
--
-- 목표명: `defaultVenueName()` 과 같은 규칙 = `{닉네임|이름}의 지점`, 둘 다 없으면 '내 지점'.
--   (src/constants/defaultNames.ts — 클라와 문자열 규칙이 어긋나면 다음 신규 지점이 다시 갈라진다)
--
-- 안전 장치
--  * `uniq_venue_container (workspace_id, lower(title), schedule->>'kind') WHERE status='container'`
--    위반 가능성을 **UPDATE 전에 세어서 0 이 아니면 즉시 중단**한다(fail-closed).
--    조용히 건너뛰면 "다 바꿨다"고 착각한 채 일부만 바뀐 상태로 끝난다.
--  * 알림 무발송 확인: `notify_on_job_posting_update` 는 title 변경 시 `job_updated` 알림을
--    보내지만 수신자가 `applications` 행이다. 컨테이너에는 지원 행이 붙지 않는다
--    (prod 실측 4건 전부 0행). 컨테이너가 아닌 공고는 이 마이그 대상이 아니다.
--  * 목표명이 현재명과 같으면 UPDATE 하지 않는다 → 재실행해도 안전(멱등).

-- ① fail-closed 충돌 가드
DO $$
DECLARE
  v_conflicts int;
BEGIN
  SELECT count(*) INTO v_conflicts
  FROM (
    SELECT jp.id, jp.workspace_id,
           COALESCE(jp.schedule ->> 'kind', '') AS kind,
           CASE
             WHEN COALESCE(NULLIF(btrim(u.nickname), ''), NULLIF(btrim(u.name), '')) IS NOT NULL
               THEN LEFT(COALESCE(NULLIF(btrim(u.nickname), ''), NULLIF(btrim(u.name), '')), 40) || '의 지점'
             ELSE '내 지점'
           END AS new_title,
           jp.title AS old_title
    FROM public.job_postings jp
    JOIN public.workspaces w ON w.id = jp.workspace_id
    LEFT JOIN public.users u ON u.id = w.owner_id
    WHERE jp.status = 'container'
      AND (jp.title = w.name OR jp.title IN ('기본 지점', '내 지점'))
  ) c
  WHERE c.new_title <> c.old_title
    AND EXISTS (
      SELECT 1
      FROM public.job_postings x
      WHERE x.workspace_id = c.workspace_id
        AND x.status = 'container'
        AND x.id <> c.id
        AND lower(x.title) = lower(c.new_title)
        AND COALESCE(x.schedule ->> 'kind', '') = c.kind
    );

  IF v_conflicts > 0 THEN
    RAISE EXCEPTION
      '[rename_default_venue_containers] uniq_venue_container 충돌 %건 — 중단한다. 사전 카운트는 0이었으므로 그 사이 데이터가 바뀌었다는 뜻이다. 재측정 후 다시 판단할 것.',
      v_conflicts;
  END IF;
END $$;

-- ② 소급 rename
WITH candidate AS (
  SELECT jp.id,
         jp.workspace_id,
         jp.title AS old_title,
         COALESCE(jp.schedule ->> 'kind', '') AS kind,
         CASE
           WHEN COALESCE(NULLIF(btrim(u.nickname), ''), NULLIF(btrim(u.name), '')) IS NOT NULL
             THEN LEFT(COALESCE(NULLIF(btrim(u.nickname), ''), NULLIF(btrim(u.name), '')), 40) || '의 지점'
           ELSE '내 지점'
         END AS new_title
  FROM public.job_postings jp
  JOIN public.workspaces w ON w.id = jp.workspace_id
  LEFT JOIN public.users u ON u.id = w.owner_id
  WHERE jp.status = 'container'
    AND (jp.title = w.name OR jp.title IN ('기본 지점', '내 지점'))
),
eligible AS (
  SELECT c.*
  FROM candidate c
  WHERE c.new_title <> c.old_title
    AND NOT EXISTS (
      SELECT 1
      FROM public.job_postings x
      WHERE x.workspace_id = c.workspace_id
        AND x.status = 'container'
        AND x.id <> c.id
        AND lower(x.title) = lower(c.new_title)
        AND COALESCE(x.schedule ->> 'kind', '') = c.kind
    )
)
UPDATE public.job_postings jp
SET title = e.new_title
FROM eligible e
WHERE jp.id = e.id;
