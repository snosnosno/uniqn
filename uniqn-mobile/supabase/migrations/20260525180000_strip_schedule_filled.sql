-- SP3: schedule.requirements[].timeSlots[].roles[] 의 dead counter `filled` 키 strip (멱등)
--
-- dead counter `filled` 는 SP3 에서 제거됨(타입/zod/직렬화). 기존 prod doc 의 잔류 `filled` 키를 청산한다.
-- 읽기 호환(role zod 비-strict)이 이미 잔류 키를 strip 하지만, 저장 데이터도 정합화한다.
-- 멱등: filled 키가 하나도 없으면 WHERE 가 0 row.

UPDATE job_postings jp SET schedule = jsonb_set(
  jp.schedule, '{requirements}',
  (SELECT jsonb_agg(
     jsonb_set(req, '{timeSlots}',
       (SELECT jsonb_agg(
          jsonb_set(ts, '{roles}',
            (SELECT jsonb_agg(r - 'filled')
             FROM jsonb_array_elements(COALESCE(ts->'roles','[]'::jsonb)) r))
        )
        FROM jsonb_array_elements(COALESCE(req->'timeSlots','[]'::jsonb)) ts))
   )
   FROM jsonb_array_elements(COALESCE(jp.schedule->'requirements','[]'::jsonb)) req)
)
WHERE jp.schedule ? 'requirements'
  AND EXISTS (
    SELECT 1 FROM jsonb_array_elements(jp.schedule->'requirements') req2,
      jsonb_array_elements(COALESCE(req2->'timeSlots','[]'::jsonb)) ts2,
      jsonb_array_elements(COALESCE(ts2->'roles','[]'::jsonb)) r2
    WHERE r2 ? 'filled'
  );
