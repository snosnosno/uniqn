-- 주간 배치 그리드 — Phase 1 ⑦ venue 스팬 SSOT 함수 (적대 리뷰 MEDIUM: 발산 방지)
--
-- E1 불변식의 핵심 = venue 스팬: 운영처 V 의 work_logs 는 컨테이너 V 와 venue_id=V 인 open 공고
--   양쪽에 매달린다. 이 스팬 정의가 산문/테스트에만 있으면 count/부족/정산 reader 가 각자
--   `job_posting_id IN (SELECT id ... WHERE venue_id=:V OR id=:V)` 를 재구현하다 `OR id=:V`(컨테이너
--   자기행) 누락 등으로 silent 발산한다(enum 발산/카운터 드리프트와 동일 클래스).
--
-- 조치: 스팬을 단일 SQL 함수로 봉인. Phase 2(useGridSummary/useVenueDaySlots)·Phase 4(정산)·집계
--   RPC 가 이 함수만 경유하도록 강제한다. INVOKER 권한(RLS 적용)이라 호출자가 볼 수 있는 공고만
--   반환 → 외부인은 빈 집합(fail-closed). 상태 제외(cancelled/no_show)는 work_logs 레벨이라 분리.
CREATE OR REPLACE FUNCTION public.venue_span_posting_ids(p_venue uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT id FROM public.job_postings
  WHERE p_venue IS NOT NULL AND (venue_id = p_venue OR id = p_venue);
$function$;

-- 신규 함수 anon default-grant 차단(S2) — 인증 사용자만(RLS 가 가시성 추가 제한).
REVOKE ALL ON FUNCTION public.venue_span_posting_ids(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.venue_span_posting_ids(uuid) TO authenticated;

COMMENT ON FUNCTION public.venue_span_posting_ids(uuid) IS
  'venue 스팬 SSOT: 운영처 컨테이너(id=:V)+그 venue 의 공고(venue_id=:V) posting id 집합. count/부족/정산 reader 공용(E1 발산 방지).';
