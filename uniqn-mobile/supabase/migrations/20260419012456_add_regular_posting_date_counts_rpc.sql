-- 일반 공고 타입의 일자별 공고 개수 집계 RPC
--
-- 목적: DateCalendar UI에서 월 단위 달력 셀에 공고 개수 뱃지 표시
-- 성능: work_dates/work_date 컬럼 기반, 필터 (posting_type='regular', status='active') 후
--       unnest → 날짜 범위 체크 → group by 집계.
--
-- 날짜 포맷: 'yyyy-MM-dd' 문자열. lexicographic 비교 = 시간순 비교 동일.

create or replace function public.get_regular_posting_date_counts(
  p_start_date text,
  p_end_date text
)
returns table (work_date text, posting_count bigint)
language sql
stable
security invoker
set search_path = public
as $$
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
  )
  select
    wd as work_date,
    count(distinct id) as posting_count
  from expanded
  where wd between p_start_date and p_end_date
  group by wd
  order by wd;
$$;

grant execute on function public.get_regular_posting_date_counts(text, text) to authenticated;

comment on function public.get_regular_posting_date_counts(text, text) is
  'DateCalendar UI용: 일반 공고 타입의 일자별 공고 개수 집계. 날짜는 yyyy-MM-dd 문자열.';
