-- SP3: schedule.requirements[].timeSlots[].roles[] 의 dead counter `filled` 키 strip (멱등)
--
-- dead counter `filled` 는 SP3 에서 제거됨(타입/zod/직렬화). 기존 prod doc 의 잔류 `filled` 키를 청산한다.
-- 읽기 호환(role zod 비-strict)이 이미 잔류 키를 strip 하지만, 저장 데이터도 정합화한다.
-- 멱등: filled 키가 하나도 없으면 WHERE 가 0 row.
-- ⚠️ NULL 전파 방어: 빈 배열(timeSlots/roles 0개)이면 jsonb_agg 가 SQL NULL 을 반환하고
--    jsonb_set(target, path, NULL) 은 문서 전체를 NULL 로 만든다. 모든 jsonb_agg 를
--    COALESCE(..., '[]'::jsonb) 로 감싸 빈 배열을 보존한다(스키마 증발 방지).

UPDATE job_postings jp SET schedule = jsonb_set(
  jp.schedule, '{requirements}',
  COALESCE((SELECT jsonb_agg(
     jsonb_set(req, '{timeSlots}',
       COALESCE((SELECT jsonb_agg(
          jsonb_set(ts, '{roles}',
            COALESCE((SELECT jsonb_agg(r - 'filled')
             FROM jsonb_array_elements(COALESCE(ts->'roles','[]'::jsonb)) r), '[]'::jsonb))
        )
        FROM jsonb_array_elements(COALESCE(req->'timeSlots','[]'::jsonb)) ts), '[]'::jsonb))
   )
   FROM jsonb_array_elements(COALESCE(jp.schedule->'requirements','[]'::jsonb)) req), '[]'::jsonb)
)
WHERE jp.schedule ? 'requirements'
  AND EXISTS (
    SELECT 1 FROM jsonb_array_elements(jp.schedule->'requirements') req2,
      jsonb_array_elements(COALESCE(req2->'timeSlots','[]'::jsonb)) ts2,
      jsonb_array_elements(COALESCE(ts2->'roles','[]'::jsonb)) r2
    WHERE r2 ? 'filled'
  );
