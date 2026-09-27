-- ============================================================
-- 고정 공고 만료 24시간 전 알림 회귀 가드 (마이그 20260927110000)
-- ============================================================
-- 크론이 **매시** 돌기 때문에 멱등이 깨지면 같은 공고에 알림이 하루 24번 쌓인다 —
-- "성공적으로 여러 번 INSERT" 는 에러가 아니라 로그도 안 남는다. 창 판정이 어긋나면
-- 반대로 알림이 아예 안 가서 공고가 조용히 닫힌다.
--
-- 시나리오:
--   B1. 인덱스가 UNIQUE + 부분(partial)
--   B2. 5시간 뒤 만료되는 게시 중 고정 공고 → 1건 (본문 계약: category/priority/link/data)
--   B3. 30시간 뒤 만료 → 없음 (창 밖)
--   B4. 마감(closed) 공고 → 없음
--   B5. 이미 지난 만료 → 없음 (만료 크론의 몫)
--   B6. 손상된 expiresAt → 배치가 죽지 않고 건너뜀
--   B7. 멱등 — 두 번째 호출에 내 알림 수 그대로
--   B8. 연장으로 만료 시각이 바뀌면(여전히 창 안) 새 키라 한 번 더 알린다
--
-- 안전: BEGIN/ROLLBACK 래핑 + 마커 이메일(__sql_fixture_fpe_*@test.local)
-- ============================================================

BEGIN;
SELECT plan(1);

DO $$
DECLARE
  v_owner_id     uuid := gen_random_uuid();
  v_workspace_id uuid := gen_random_uuid();

  v_jp_soon    uuid := gen_random_uuid();  -- B2/B7/B8
  v_jp_later   uuid := gen_random_uuid();  -- B3
  v_jp_closed  uuid := gen_random_uuid();  -- B4
  v_jp_past    uuid := gen_random_uuid();  -- B5
  v_jp_broken  uuid := gen_random_uuid();  -- B6

  v_is_uniq boolean;
  v_pred    text;
  v_mine    int;
  v_n       record;
  v_fixed_schedule jsonb := jsonb_build_object('kind','fixed','requirements', jsonb_build_array(
      jsonb_build_object('date','FIXED_SCHEDULE','timeSlots', jsonb_build_array(
        jsonb_build_object('startTime','19:00','roles', jsonb_build_array(
          jsonb_build_object('role','dealer','count',1)))))));
BEGIN
  -- ------------------------------------------------------------
  -- 0. seed
  -- ------------------------------------------------------------
  INSERT INTO auth.users (id, email, aud, role, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  VALUES (v_owner_id, '__sql_fixture_fpe_owner@test.local', 'authenticated', 'authenticated', '', '{"role":"employer"}'::jsonb, '{"name":"FPE_OWNER"}'::jsonb, now(), now());

  INSERT INTO public.users (id, email, name, role, is_active, created_at, updated_at)
  VALUES (v_owner_id, '__sql_fixture_fpe_owner@test.local', 'fixture', 'employer'::user_role, true, now(), now())
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, is_active = EXCLUDED.is_active;

  INSERT INTO public.workspaces (id, name, owner_id, created_at, updated_at)
  VALUES (v_workspace_id, '__sql_fixture_fpe_ws', v_owner_id, now(), now());

  -- ------------------------------------------------------------
  -- B1. 인덱스가 UNIQUE + 부분 인덱스인가
  -- ------------------------------------------------------------
  SELECT i.indisunique, pg_get_expr(i.indpred, i.indrelid)
    INTO v_is_uniq, v_pred
    FROM pg_index i
    JOIN pg_class c ON c.oid = i.indexrelid
   WHERE c.relname = 'notifications_fixed_posting_expiring_idem';

  IF v_is_uniq IS NULL THEN
    RAISE EXCEPTION 'B1 fail: 멱등 인덱스 notifications_fixed_posting_expiring_idem 가 없다';
  END IF;
  IF NOT v_is_uniq THEN
    RAISE EXCEPTION 'B1 fail: 멱등 인덱스가 UNIQUE 가 아니다 — 매시 크론이 중복을 쌓는다';
  END IF;
  IF v_pred IS NULL OR v_pred NOT LIKE '%fixed_posting_expiring%' THEN
    RAISE EXCEPTION 'B1 fail: 부분 인덱스 조건이 사라졌다 (pred=%)', coalesce(v_pred, '(none)');
  END IF;

  -- ------------------------------------------------------------
  -- 1. 공고 생성 — 만료 시각만 다르게
  -- ------------------------------------------------------------
  INSERT INTO public.job_postings (id, title, workspace_id, owner_id, status, posting_type, schedule, fixed_config, created_at, updated_at)
  VALUES
    (v_jp_soon,   '__sql_fixture_fpe_soon',   v_workspace_id, v_owner_id, 'active'::posting_status, 'fixed', v_fixed_schedule,
      jsonb_build_object('durationDays', 7, 'expiresAt', to_char((now() + interval '5 hours') AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')), now(), now()),
    (v_jp_later,  '__sql_fixture_fpe_later',  v_workspace_id, v_owner_id, 'active'::posting_status, 'fixed', v_fixed_schedule,
      jsonb_build_object('durationDays', 7, 'expiresAt', to_char((now() + interval '30 hours') AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')), now(), now()),
    (v_jp_closed, '__sql_fixture_fpe_closed', v_workspace_id, v_owner_id, 'closed'::posting_status, 'fixed', v_fixed_schedule,
      jsonb_build_object('durationDays', 7, 'expiresAt', to_char((now() + interval '5 hours') AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')), now(), now()),
    (v_jp_past,   '__sql_fixture_fpe_past',   v_workspace_id, v_owner_id, 'active'::posting_status, 'fixed', v_fixed_schedule,
      jsonb_build_object('durationDays', 7, 'expiresAt', to_char((now() - interval '1 hour') AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')), now(), now()),
    (v_jp_broken, '__sql_fixture_fpe_broken', v_workspace_id, v_owner_id, 'active'::posting_status, 'fixed', v_fixed_schedule,
      jsonb_build_object('durationDays', 7, 'expiresAt', 'not-a-date'), now(), now());

  -- ------------------------------------------------------------
  -- 2. 1차 실행 — B2~B6
  -- ------------------------------------------------------------
  PERFORM public.fn_notify_fixed_postings_expiring();  -- B6: 손상 값이 있어도 죽지 않아야 한다

  SELECT count(*) INTO v_mine FROM public.notifications
   WHERE recipient_id = v_owner_id AND type = 'fixed_posting_expiring';
  IF v_mine <> 1 THEN
    RAISE EXCEPTION 'B2-B6 fail: 내 만료 예정 알림이 1건이어야 한다 (got %)', v_mine;
  END IF;

  SELECT * INTO v_n FROM public.notifications
   WHERE recipient_id = v_owner_id AND type = 'fixed_posting_expiring';
  IF v_n.data ->> 'jobPostingId' <> v_jp_soon::text THEN
    RAISE EXCEPTION 'B2 fail: 5시간 뒤 만료 공고가 아닌 공고에 알림이 갔다 (%)', v_n.data ->> 'jobPostingId';
  END IF;
  IF v_n.category::text <> 'job' OR v_n.priority <> 'high' THEN
    RAISE EXCEPTION 'B2 fail: category/priority 계약 위반 (%/%)', v_n.category, v_n.priority;
  END IF;
  IF v_n.link <> format('/my-postings/%s', v_jp_soon) THEN
    RAISE EXCEPTION 'B2 fail: 목적지는 [7일 연장]이 있는 관리 화면이어야 한다 (%)', v_n.link;
  END IF;
  IF v_n.data ->> 'expiresAt' IS NULL OR v_n.body NOT LIKE '%7일 연장%' THEN
    RAISE EXCEPTION 'B2 fail: data.expiresAt/본문 계약 위반 (data=%, body=%)', v_n.data, v_n.body;
  END IF;

  -- ------------------------------------------------------------
  -- B7. 멱등 — 두 번째 호출에 내 알림 수 그대로
  -- ------------------------------------------------------------
  PERFORM public.fn_notify_fixed_postings_expiring();
  SELECT count(*) INTO v_mine FROM public.notifications
   WHERE recipient_id = v_owner_id AND type = 'fixed_posting_expiring';
  IF v_mine <> 1 THEN
    RAISE EXCEPTION 'B7 fail: 재실행에 중복이 들어갔다 (got %) — 매시 크론이 알림함을 도배한다', v_mine;
  END IF;

  -- ------------------------------------------------------------
  -- B8. 만료 시각이 바뀌면 새 키 — 한 번 더 알린다
  -- ------------------------------------------------------------
  UPDATE public.job_postings
     SET fixed_config = jsonb_set(fixed_config, '{expiresAt}',
       to_jsonb(to_char((now() + interval '6 hours') AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')))
   WHERE id = v_jp_soon;

  PERFORM public.fn_notify_fixed_postings_expiring();
  SELECT count(*) INTO v_mine FROM public.notifications
   WHERE recipient_id = v_owner_id AND type = 'fixed_posting_expiring';
  IF v_mine <> 2 THEN
    RAISE EXCEPTION 'B8 fail: 만료 시각이 바뀐 뒤 새 알림이 1건 더 있어야 한다 (got %)', v_mine;
  END IF;
END $$;

SELECT pass('고정 공고 만료 예정 알림: 창·상태·멱등·연장 후 재알림 계약 (B1-B8)');

SELECT * FROM finish();
ROLLBACK;
