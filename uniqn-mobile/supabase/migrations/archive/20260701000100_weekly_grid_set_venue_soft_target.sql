-- 주간 배치 그리드 — Phase 3 ⑤ soft-target 쓰기 RPC (R3/E5/S2/S3)
--
-- soft-target = 운영처 날짜별 목표인원 → "부족 N명" 신호. 컨테이너 schedule.softTargets(JSONB)에
--   read-modify-write 한다. requirements 와 분리(softTargets 전용)해 add_direct_staff MAX_CAPACITY
--   하드가드를 회피한다(§4.4).
--
-- 왜 SECDEF RPC 전용인가:
--   restrictive 정책 jp_container_no_direct_update 가 모든 클라 롤(public)의 컨테이너 직접 UPDATE 를
--   차단한다(컨테이너 쓰기 하이재킹 방지, 20260630000500). 따라서 컨테이너 schedule 변경은 SECDEF
--   RPC(definer=postgres=테이블 소유자, FORCE RLS off → RLS 우회)만 가능하다. 본 함수가 유일 경로.
--
-- 불변식:
--   E5 날짜키: 입력 p_date 를 YYYY-MM-DD 로 write 경계 정규화(work_logs.date / COUNT-by-date 와 정합).
--   S2 anon REVOKE / S3 SECDEF search_path=public,extensions,pg_temp.
--   권한: 컨테이너 workspace 의 owner/멤버/콜라보/admin 만(add_direct_staff 와 동일 게이트).
--   count: <0 거부, =0 이면 키 제거(부족신호 노이즈 방지 — TS withSoftTarget 와 일관), >0 이면 저장.
CREATE OR REPLACE FUNCTION public.set_venue_soft_target(
  p_venue uuid,
  p_date text,
  p_count integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
DECLARE
  v_caller uuid := auth.uid();
  v_ws uuid;
  v_owner_id uuid;
  v_schedule jsonb;
  v_targets jsonb;
  v_date_key text;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 인증이 필요합니다';
  END IF;

  -- 입력 검증: 음수 목표 거부(0 은 키 제거 의미로 허용)
  IF p_count IS NULL THEN
    RAISE EXCEPTION 'INVALID_INPUT: 목표 인원(count)이 필요합니다';
  END IF;
  IF p_count < 0 THEN
    RAISE EXCEPTION 'INVALID_INPUT: 목표 인원은 0 이상이어야 합니다 (%)', p_count;
  END IF;

  -- E5: 날짜키 YYYY-MM-DD 정규화(write 경계). 잘못된 날짜는 거부.
  BEGIN
    v_date_key := to_char(p_date::date, 'YYYY-MM-DD');
  EXCEPTION
    WHEN invalid_datetime_format OR datetime_field_overflow OR invalid_text_representation THEN
      RAISE EXCEPTION 'INVALID_INPUT: 날짜 형식이 올바르지 않습니다 (%)', p_date;
  END;

  -- 컨테이너 잠금 + workspace/owner 로드(컨테이너만 대상)
  SELECT workspace_id, owner_id, schedule
    INTO v_ws, v_owner_id, v_schedule
  FROM public.job_postings
  WHERE id = p_venue AND status = 'container'::posting_status
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'VENUE_NOT_FOUND: %', p_venue;
  END IF;

  -- 권한 게이트(add_direct_staff 동치): owner/워크스페이스 멤버/콜라보/admin 만
  IF NOT (
    v_owner_id = v_caller
    OR public.is_workspace_member(v_ws, v_caller)
    OR public.is_posting_collaborator(p_venue, v_caller)
    OR public.is_admin()
  ) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 운영처 관리 권한이 없습니다';
  END IF;

  -- read-modify-write: softTargets 맵 갱신
  v_targets := COALESCE(v_schedule -> 'softTargets', '{}'::jsonb);
  IF p_count = 0 THEN
    v_targets := v_targets - v_date_key;            -- 키 제거(부족신호 노이즈 방지)
  ELSE
    v_targets := jsonb_set(v_targets, ARRAY[v_date_key], to_jsonb(p_count), true);
  END IF;

  UPDATE public.job_postings
  SET schedule = jsonb_set(COALESCE(v_schedule, '{}'::jsonb), '{softTargets}', v_targets, true),
      updated_at = now()
  WHERE id = p_venue;

  RETURN jsonb_build_object(
    'venueId', p_venue,
    'date', v_date_key,
    'count', p_count,
    'softTargets', v_targets
  );
END;
$function$;

-- 권한: 미인증(anon) 차단(S2), 인증 사용자만(본문에서 운영처 권한 재검증).
REVOKE ALL ON FUNCTION public.set_venue_soft_target(uuid, text, integer) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.set_venue_soft_target(uuid, text, integer) TO authenticated;

COMMENT ON FUNCTION public.set_venue_soft_target(uuid, text, integer) IS
  '운영처 컨테이너 schedule.softTargets[date]=count read-modify-write. 날짜키 YYYY-MM-DD 정규화(E5), count=0 키제거, restrictive 정책 우회 유일 경로(SECDEF).';
