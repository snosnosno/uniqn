-- ============================================================
-- 좌석 기준 마이그(20260718000000) prod 적용 전 사전 프로브 (읽기 전용)
-- [상태] 2026-07-18 해당 마이그 prod 적용 완료 — 본 프로브는 실행 불필요.
--        이후 prod 사전 프로브를 작성할 때 템플릿으로 참고할 것.
-- 실행: psql "$PROD_DB_URL" -f supabase/probes/seat_basis_prod_preapply_probes.sql
-- 판정: 세 프로브 모두 count=0 이면 안전 적용. >0 이면 아래 대응 후 적용.
--
-- 왜 필요: 백필 UPDATE 가 컨테이너 제외 전 공고를 재계산하며
--   ① _total_positions_from_schedule 의 (r->>'count')::int / (r->>'headcount')::int 하드캐스트
--   ② 클라↔SQL 좌석합 레거시 형상 편차(name-only/headcount-only/공백 role)
--   ③ 매 UPDATE 마다 재발화하는 check_xss_fields(job_postings title/description)
--   중 하나라도 legacy 행에 걸리면 백필/마이그가 abort(원자 롤백 — 파괴는 없으나 적용 실패).
-- ============================================================

\echo '=== P3: 비정수/비숫자 count·headcount (백필 하드캐스트 abort 유발) ==='
-- count 또는 headcount 가 존재하는데 정수 형태(^-?\d+$)가 아닌 role → ::int 캐스트 실패
SELECT count(*) AS p3_non_integer_count_or_headcount,
       COALESCE(array_agg(DISTINCT jp_id) FILTER (WHERE jp_id IS NOT NULL), '{}') AS sample_posting_ids
FROM (
  SELECT jp.id AS jp_id
  FROM public.job_postings jp
  CROSS JOIN LATERAL jsonb_array_elements(COALESCE(jp.schedule->'requirements','[]'::jsonb)) req
  CROSS JOIN LATERAL jsonb_array_elements(COALESCE(req->'timeSlots','[]'::jsonb)) ts
  CROSS JOIN LATERAL jsonb_array_elements(COALESCE(ts->'roles','[]'::jsonb)) r
  WHERE jp.status <> 'container'
    AND (
      ((r ? 'count')    AND (r->>'count')    IS NOT NULL AND (r->>'count')    !~ '^-?\d+$')
      OR
      ((r ? 'headcount') AND (r->>'headcount') IS NOT NULL AND (r->>'headcount') !~ '^-?\d+$')
    )
) x;

\echo '=== P4: 레거시 형상(name-only / headcount-only / 공백 role) — 클라↔SQL total 드리프트 ==='
-- SQL 은 흡수, 클라(stats.ts)는 미흡수 → 편집/미리보기 표시 드리프트. 0 이면 클라 fallback 불요.
SELECT count(*) AS p4_legacy_shape_roles,
       COALESCE(array_agg(DISTINCT jp_id) FILTER (WHERE jp_id IS NOT NULL), '{}') AS sample_posting_ids
FROM (
  SELECT jp.id AS jp_id
  FROM public.job_postings jp
  CROSS JOIN LATERAL jsonb_array_elements(COALESCE(jp.schedule->'requirements','[]'::jsonb)) req
  CROSS JOIN LATERAL jsonb_array_elements(COALESCE(req->'timeSlots','[]'::jsonb)) ts
  CROSS JOIN LATERAL jsonb_array_elements(COALESCE(ts->'roles','[]'::jsonb)) r
  WHERE jp.status <> 'container'
    AND (
      -- name-only: role 비었는데 name 있음 (SQL 카운트 / 클라 스킵)
      (COALESCE(NULLIF(btrim(r->>'role'),''), NULL) IS NULL AND NULLIF(btrim(r->>'name'),'') IS NOT NULL)
      OR
      -- headcount-only: count 없는데 headcount 있음 (SQL headcount / 클라 0)
      (NOT (r ? 'count') AND (r ? 'headcount'))
      OR
      -- 공백 role: role 이 공백문자열 (클라 카운트 / SQL btrim 스킵)
      ((r ? 'role') AND btrim(r->>'role') = '' AND (r->>'role') <> '')
    )
) y;

\echo '=== P5: check_xss_fields 정규식에 걸리는 title/description (백필 UPDATE 재검증 abort) ==='
-- baseline check_xss_fields 패턴과 동일. on\w+\s*= 가 legacy 평문("onboarding = ...")에 오탐 가능.
SELECT count(*) AS p5_xss_regex_match,
       COALESCE(array_agg(id), '{}') AS sample_posting_ids
FROM public.job_postings
WHERE status <> 'container'
  AND (
    COALESCE(title, '')       ~* '<\s*script|javascript\s*:|on\w+\s*=|<\s*iframe|<\s*object|<\s*embed'
    OR COALESCE(description, '') ~* '<\s*script|javascript\s*:|on\w+\s*=|<\s*iframe|<\s*object|<\s*embed'
  );

-- 대응 요약:
--   P3>0 → 해당 공고 schedule count/headcount 정수 정규화 후 적용(또는 캐스트에 정규식 가드).
--   P4>0 → 클라 stats.ts 에 name/headcount fallback 2줄 추가 or SQL legacy 절 제거로 정렬.
--   P5>0 → 오탐이면 무해(백필이 title/description 을 바꾸지 않음), 단 트리거가 재검증하므로
--          해당 행을 사전 정정하거나 백필을 title/description 미포함 방식으로 조정.
