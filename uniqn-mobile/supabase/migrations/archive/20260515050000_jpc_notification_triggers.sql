-- 공고별 협업자 알림 트리거 + 신규 지원자 알림 수신자 확장 — Phase 3
-- 플랜: docs/superpowers/plans/2026-05-11-job-posting-collaborators.md (Phase 3)
--
-- 실제 알림 메커니즘 (audit 확정):
-- - notification_outbox 미존재 → INSERT INTO public.notifications 직접
-- - AFTER INSERT statement trigger 가 send-push-notification edge function 호출
-- - 따라서 본 trigger 는 notifications 행만 만들면 푸시는 자동
--
-- Codex outside-voice 가드:
-- - auth.uid() IS NULL (cascade/service) 시 알림 skip
-- - 본인이 자기 발 빼기 시 알림 skip (스스로 한 행위)

-- ============================================================================
-- 1. notify_on_collaborator_added — owner 가 추가한 협업자에게 알림
-- ============================================================================
CREATE FUNCTION public.notify_on_collaborator_added() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public', 'extensions'
AS $$
DECLARE
  v_caller_uid    uuid;
  v_job_title     text;
  v_adder_name    text;
BEGIN
  v_caller_uid := (SELECT auth.uid());

  -- cascade / service role → 알림 skip
  IF v_caller_uid IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT title INTO v_job_title
  FROM public.job_postings WHERE id = NEW.job_posting_id;

  SELECT COALESCE(raw_user_meta_data->>'name', email)
  INTO v_adder_name
  FROM auth.users WHERE id = NEW.added_by;

  INSERT INTO public.notifications (
    recipient_id, type, title, body, link, data, priority
  ) VALUES (
    NEW.user_id,
    'job_posting_collaborator_added',
    '🤝 공고 관리 초대',
    format('%s님이 ''%s'' 공고 관리에 초대했어요',
           COALESCE(v_adder_name, '동료'),
           COALESCE(v_job_title, '해당 공고')),
    format('/my-postings/%s', NEW.job_posting_id),
    jsonb_build_object(
      'jobPostingId', NEW.job_posting_id,
      'addedBy', NEW.added_by,
      'addedAt', NEW.added_at,
      'senderId', NEW.added_by
    ),
    'normal'
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '[notify_on_collaborator_added] failed for jpc % — %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_jpc_added_notify
  AFTER INSERT ON public.job_posting_collaborators
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_collaborator_added();

-- ============================================================================
-- 2. notify_on_collaborator_removed — owner 가 제거한 협업자에게 알림
--    (본인 발 빼기 시 OLD.user_id = auth.uid() 이므로 skip)
-- ============================================================================
CREATE FUNCTION public.notify_on_collaborator_removed() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public', 'extensions'
AS $$
DECLARE
  v_caller_uid uuid;
  v_job_title  text;
BEGIN
  v_caller_uid := (SELECT auth.uid());

  -- cascade / service / 본인 발 빼기 → 알림 skip
  IF v_caller_uid IS NULL OR v_caller_uid = OLD.user_id THEN
    RETURN OLD;
  END IF;

  SELECT title INTO v_job_title
  FROM public.job_postings WHERE id = OLD.job_posting_id;

  INSERT INTO public.notifications (
    recipient_id, type, title, body, link, data, priority
  ) VALUES (
    OLD.user_id,
    'job_posting_collaborator_removed',
    '공고 관리 제외',
    format('''%s'' 공고 관리에서 제외되었어요',
           COALESCE(v_job_title, '해당 공고')),
    '/my-postings',
    jsonb_build_object(
      'jobPostingId', OLD.job_posting_id,
      'senderId', v_caller_uid
    ),
    'normal'
  );

  RETURN OLD;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '[notify_on_collaborator_removed] failed for jpc % — %', OLD.id, SQLERRM;
  RETURN OLD;
END;
$$;

CREATE TRIGGER trg_jpc_removed_notify
  AFTER DELETE ON public.job_posting_collaborators
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_collaborator_removed();

-- ============================================================================
-- 3. notify_on_application_insert 확장 — owner + workspace editor + collaborator UNION
-- ============================================================================
CREATE OR REPLACE FUNCTION public.notify_on_application_insert() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public', 'extensions'
AS $$
DECLARE
  v_job_title text;
  v_workspace_id uuid;
BEGIN
  SELECT title, workspace_id INTO v_job_title, v_workspace_id
  FROM public.job_postings WHERE id = NEW.job_posting_id;

  IF v_workspace_id IS NULL THEN
    RETURN NEW;                                                  -- 공고 없으면 스킵
  END IF;

  -- 수신자 UNION: workspace owner + editors + collaborators (중복 자동 제거)
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
    SELECT user_id  AS recipient_id FROM public.job_posting_collaborators WHERE job_posting_id = NEW.job_posting_id
  ) r
  WHERE r.recipient_id IS NOT NULL
    AND r.recipient_id != NEW.applicant_id;                      -- 본인 알림 안 함

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '[notify_on_application_insert] failed for application % — %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;
