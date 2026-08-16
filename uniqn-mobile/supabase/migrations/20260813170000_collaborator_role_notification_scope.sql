-- ============================================================================
-- S3-4 보정 · 처리 요구 알림은 manager 에게만
-- ============================================================================
-- 20260813150000 이 협업자를 manager/viewer 2단으로 나눴다. 쓰기 게이트 19곳은
-- `is_posting_collaborator()` 의 의미를 바꾸는 것만으로 전부 fail-closed 가 됐다.
-- 그런데 **알림 수신자 축은 헬퍼를 거치지 않는다** — 두 트리거 함수가
-- `job_posting_collaborators` 를 role 조건 없이 직접 읽어 전량 팬아웃한다.
--
-- 🚨 그래서 viewer 는 **자기가 처리할 수 없는 일**을 알리는 알림을 받는다.
--    · 취소 요청 → 승인/거절이 필요한데 viewer 는 `applications` UPDATE 가 막혀 있다.
--    · 새 지원   → 확정이 필요한데 viewer 는 확정 RPC 가 막혀 있다.
--    알림을 눌러 들어가면 처리 버튼이 없는 화면을 만난다. 20260813150000 이
--    `ops_resolve_staff_work_logs` 에서 정확히 이 실패 모드("서버는 안전하지만
--    사용자는 막다른 길")를 피했으면서, 알림 축은 점검하지 않았다.
--
-- 🔑 **가시성은 그대로 둔다.** viewer 는 여전히 지원자·근무 기록을 볼 수 있다
--    (읽기 정책 5개는 `_any`). 여기서 줄이는 것은 "당신이 처리하라" 는 **호출**뿐이다.
--    보는 것과 불려 나가는 것은 다른 축이다.
--
-- 형식 규율: 기존 함수 2종 CREATE OR REPLACE 뿐 — 신규 함수·트리거·정책 없음.
--            파리티 마커(214/112) 불변.
-- ============================================================================

-- ------------------------------------------------------------
-- 1. 취소 요청 알림 — 승인/거절 권한자에게만
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_notify_cancellation_request()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_owner_id uuid;
  v_posting_title text;
  v_workspace_id uuid;
BEGIN
  IF NEW.status::text = 'cancellation_pending' AND OLD.status::text != 'cancellation_pending' THEN
    SELECT owner_id, title, workspace_id INTO v_owner_id, v_posting_title, v_workspace_id
    FROM public.job_postings WHERE id = NEW.job_posting_id;

    -- 수신자: 공고 owner ∪ 워크스페이스 owner/멤버 ∪ 공고 협업자 **manager** (dedup, 신청자 제외)
    INSERT INTO public.notifications (recipient_id, type, category, title, body, data, priority)
    SELECT DISTINCT r.uid,
      'cancellation_requested',
      'application'::public.notification_category,
      '취소 요청',
      COALESCE(NEW.applicant_name, '스태프') || '님이 "' || COALESCE(v_posting_title, '공고') || '" 취소를 요청했습니다',
      jsonb_build_object('applicationId', NEW.id, 'jobPostingId', NEW.job_posting_id),
      'high'
    FROM (
      SELECT v_owner_id AS uid
      UNION
      SELECT w.owner_id FROM public.workspaces w
        WHERE v_workspace_id IS NOT NULL AND w.id = v_workspace_id
      UNION
      SELECT wm.user_id FROM public.workspace_members wm
        WHERE v_workspace_id IS NOT NULL AND wm.workspace_id = v_workspace_id
      UNION
      -- 🔒 S3-4 보정: viewer 는 취소를 승인·거절할 수 없다(쓰기 게이트가 manager 전용).
      --    부르지 않는다 — 처리할 수 없는 사람을 호출하면 알림이 막다른 길이 된다.
      SELECT c.user_id FROM public.job_posting_collaborators c
        WHERE c.job_posting_id = NEW.job_posting_id
          AND c.role = 'manager'
    ) r
    WHERE r.uid IS NOT NULL
      AND r.uid IS DISTINCT FROM NEW.applicant_id;
  END IF;
  RETURN NEW;
END;
$function$;

-- ------------------------------------------------------------
-- 2. 새 지원 알림 — 확정 권한자에게만
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_on_application_insert()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
DECLARE
  v_job_title text;
  v_workspace_id uuid;
BEGIN
  SELECT title, workspace_id INTO v_job_title, v_workspace_id
  FROM public.job_postings WHERE id = NEW.job_posting_id;

  IF v_workspace_id IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.notifications (
    recipient_id, type, title, body, link, data, priority
  )
  SELECT
    r.recipient_id,
    'new_application',
    '📨 새로운 지원자',
    format('%s님이 ''%s''에 지원했습니다.', NEW.applicant_name, COALESCE(v_job_title, '해당 공고')),
    format('/employer/applicants/%s', NEW.job_posting_id),
    jsonb_build_object(
      'applicationId', NEW.id,
      'jobPostingId', NEW.job_posting_id,
      'applicantId', NEW.applicant_id,
      'applicantName', NEW.applicant_name,
      'jobPostingTitle', COALESCE(v_job_title, ''),
      'senderId', NEW.applicant_id
    ),
    'normal'
  FROM (
    SELECT owner_id AS recipient_id FROM public.workspaces WHERE id = v_workspace_id
    UNION
    SELECT user_id  AS recipient_id FROM public.workspace_members WHERE workspace_id = v_workspace_id
    UNION
    -- 🔒 S3-4 보정: viewer 는 지원자를 확정할 수 없다. 위 취소 요청과 같은 이유.
    SELECT user_id  AS recipient_id FROM public.job_posting_collaborators
      WHERE job_posting_id = NEW.job_posting_id
        AND role = 'manager'
  ) r
  WHERE r.recipient_id IS NOT NULL
    AND r.recipient_id != NEW.applicant_id;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '[notify_on_application_insert] failed for application % — %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$function$;

-- ------------------------------------------------------------
-- 3. 스모크 — 두 함수가 실제로 role 을 보는가
-- ------------------------------------------------------------
-- 이 보정의 본질은 "헬퍼를 안 거치는 경로가 남아 있었다" 이므로,
-- 앞으로 같은 축이 또 생기면 여기서 잡히도록 **직접 참조 전수**를 단언한다.
DO $$
DECLARE
  v_leaky text;
BEGIN
  SELECT string_agg(p.proname, ', ') INTO v_leaky
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public'
     AND p.prosrc LIKE '%job_posting_collaborators%'
     AND p.prosrc NOT LIKE '%role%'
     AND p.proname NOT LIKE 'jpc_test_%'
     AND p.proname NOT IN (
       'is_posting_collaborator',       -- 이미 role = 'manager' 로 좁다
       'is_posting_collaborator_any',   -- 읽기 가시성 전용(의도적으로 tier 무관)
       'is_workspace_jpc_member'        -- workspaces 가시성 — viewer 도 보여야 한다
     );

  IF v_leaky IS NOT NULL THEN
    RAISE EXCEPTION
      'job_posting_collaborators 를 role 조건 없이 읽는 함수가 남아 있다: % — viewer 가 처리할 수 없는 알림을 받거나 권한 축이 새는지 확인할 것',
      v_leaky;
  END IF;
END;
$$;
