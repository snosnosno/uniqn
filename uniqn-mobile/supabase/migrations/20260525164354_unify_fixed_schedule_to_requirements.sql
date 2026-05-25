-- =============================================================================
-- Migration: schedule.roleRequirements -> schedule.requirements (SP1 통일)
--
-- fixed 공고의 역할이 사는 substructure 를 dated 와 동일한
-- requirements[].timeSlots[].roles[] 단일 경로로 통일한다.
-- - schedule ? 'roleRequirements' 인 row 만 대상 (멱등: 키 없으면 no-op).
-- - 합성 변환: requirements = [{ date:null, timeSlots:[{ startTime, isTimeToBeAnnounced:false, roles: <roleRequirements> }] }]
-- - roleRequirements 키 제거.
-- - prod fixed 공고 0건 → 0 rows. fresh/staging/미래 시드 대비.
-- - DOWN: requirements[0].timeSlots[0].roles -> roleRequirements 역변환 (kind=fixed + date:null 인 row 만).
-- =============================================================================

-- UP --------------------------------------------------------------------------
UPDATE public.job_postings
SET schedule = (schedule - 'roleRequirements')
  || jsonb_build_object(
       'requirements',
       jsonb_build_array(
         jsonb_build_object(
           'date', NULL,
           'timeSlots',
           jsonb_build_array(
             jsonb_strip_nulls(
               jsonb_build_object(
                 'startTime', schedule->>'startTime',
                 'isTimeToBeAnnounced', false,
                 'roles', COALESCE(schedule->'roleRequirements', '[]'::jsonb)
               )
             )
           )
         )
       )
     )
WHERE schedule ? 'roleRequirements'
  AND schedule->>'kind' = 'fixed';

-- DOWN (수동 롤백 — apply_migration 으로 별도 실행) -----------------------------
-- UPDATE public.job_postings
-- SET schedule = (schedule - 'requirements')
--   || jsonb_build_object(
--        'roleRequirements',
--        COALESCE(schedule#>'{requirements,0,timeSlots,0,roles}', '[]'::jsonb)
--      )
-- WHERE schedule->>'kind' = 'fixed'
--   AND schedule ? 'requirements'
--   AND (schedule#>'{requirements,0,date}') = 'null'::jsonb;
