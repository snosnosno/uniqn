-- 달력 날짜 배지(get_regular_posting_date_counts) — 목록과 같은 "전향 하한"을 건다.
--
-- 무엇이 문제였나 (PR #475 리뷰 잔여 · 중간)
--   구인구직 탭 달력은 날짜마다 "그날 공고 N건" 배지를 보여 준다. 이 RPC 는 `status='active'` 인
--   일반 공고를 근무일별로 셀 뿐 **이미 끝난 공고를 거르지 않았다.** 반면 목록(getList)은
--   `last_work_date IS NULL OR last_work_date >= 오늘` 로 끝난 공고를 숨긴다(#475, applyForwardLookingScope).
--   자동 마감 크론(fn_expire_by_last_work_date)은 마지막 근무일 +2일에야 status 를 닫으므로 그 사이의
--   공고는 배지에는 세어지고 목록에는 없다 → **배지가 있는 지난 날짜를 누르면 0건.**
--
-- 어떻게 고치나
--   목록과 같은 술어를 건다. "오늘"은 KST — last_work_date 는 한국 달력 날짜이고 마감 크론도 KST 로 센다.
--   클라이언트 목록 하한도 같은 PR 에서 기기 로컬 날짜 → KST 로 맞췄다(getKstTodayString).
--   하한을 시작일이 아니라 **마지막 근무일**에 거는 이유도 목록과 같다: 지난주에 시작해 다음 주까지
--   이어지는 다중일 공고는 지난 날짜 칸에서도 여전히 열리고 지원할 수 있다(그 칸의 배지는 남는다).
--
-- 범위 밖: 목록은 active + capacity_full 을 보여 주는데 배지는 active 만 센다(종전 그대로 — 정원 마감
--   공고를 배지에 셀지는 제품 판단이다).
--
-- 계약: 기존 함수 CREATE OR REPLACE(시그니처·반환형 동일, SECURITY INVOKER 유지) — 신규 함수·정책 없음
--       → 파리티 불변. ACL 은 CREATE OR REPLACE 로 보존(anon·authenticated EXECUTE 그대로 —
--       게스트 둘러보기가 anon 으로 부른다).
-- 회귀 고정: supabase/tests/regular_date_counts_forward_looking.test.sql

CREATE OR REPLACE FUNCTION public.get_regular_posting_date_counts(p_start_date text, p_end_date text)
    RETURNS TABLE(work_date text, posting_count bigint)
    LANGUAGE sql STABLE
    SET search_path TO 'public'
    AS $$
  with expanded as (
    select
      jp.id,
      unnest(
        case
          when jp.work_dates is not null and array_length(jp.work_dates, 1) > 0
            then jp.work_dates
          when jp.work_date is not null and jp.work_date <> ''
            then array[jp.work_date]
          else array[]::text[]
        end
      ) as wd
    from public.job_postings jp
    where jp.posting_type = 'regular'
      and jp.status = 'active'
      -- 목록(getList)의 전향 하한과 같은 술어 — 끝난 공고는 배지에서도 뺀다. 값이 없는 구형 행은 통과(fail-open).
      and (jp.last_work_date is null
           or jp.last_work_date >= (now() at time zone 'Asia/Seoul')::date)
  )
  select
    wd as work_date,
    count(distinct id) as posting_count
  from expanded
  where wd between p_start_date and p_end_date
  group by wd
  order by wd;
$$;

COMMENT ON FUNCTION public.get_regular_posting_date_counts(text, text) IS
  'DateCalendar UI용: 일반 공고 타입의 일자별 공고 개수 집계. 날짜는 yyyy-MM-dd 문자열. 목록과 같은 전향 하한(last_work_date >= KST 오늘, NULL 통과)을 건다 — 끝난 공고는 세지 않는다.';
