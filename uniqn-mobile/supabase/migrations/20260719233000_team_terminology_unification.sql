-- 워크스페이스 → 팀 용어 통일 (DB 데이터 생성부)
--
-- 배경:
--   클라이언트 JSX 는 이미 "팀" 으로 리네이밍됐고 클라 폴백 기본 이름도 '내 팀' 이다
--   (workspaceService.ts:92, useEnsureDefaultWorkspace.ts:20).
--   그런데도 화면에 "내 워크스페이스" 가 뜬 이유는 그 문자열이 UI 텍스트가 아니라
--   **DB 트리거가 생성한 데이터**이기 때문이다. 지난 리네이밍이 코드만 고치고
--   데이터 생성부를 놓쳐, 생성 경로 3개 중 DB 트리거만 옛 이름을 남겼다.
--
-- 이 마이그레이션이 하는 일:
--   1. handle_new_user()                        — 신규 employer 기본 팀 이름 'OOO 팀'
--   2. notify_on_workspace_invitation_insert()  — 초대 알림 문구 "OOO님이 팀에 초대했어요"
--   3. 이미 'OOO 워크스페이스' 로 생성된 기존 workspaces 행 소급 정정
--
-- ⚠️ search_path 유실 함정 (재발 3회차 — wiki sources/nickname-search-unification):
--   CREATE OR REPLACE FUNCTION 은 함수 정의를 통째로 갈아끼우므로 pg_proc.proconfig 도
--   함께 재설정된다. 즉 별도 `ALTER FUNCTION ... SET search_path` 로 넣어둔 보정은
--   REPLACE 하는 순간 사라진다.
--   handle_new_user() 가 정확히 그 경우다 — baseline 은 search_path='public' 이었고
--   20260711100000_secdef_pg_temp_batch_and_overload_drop.sql:55 에서 'public, pg_temp'
--   로 ALTER 됐다. 아래 두 함수 모두 SET 절을 **인라인으로** 명시해 보존한다.
--
-- 테이블/컬럼명(workspaces, workspace_id)과 알림 payload 키(workspaceName)는
-- 건드리지 않는다 — 클라이언트 계약이라 표시 문자열과 별개다.

-- ============================================================================
-- 1. 신규 employer 기본 팀 이름
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_provider text;
  v_role public.user_role;
  v_workspace_name text;
BEGIN
  v_provider := NEW.raw_app_meta_data ->> 'provider';
  v_role := COALESCE((NEW.raw_app_meta_data ->> 'role')::public.user_role, 'staff');

  INSERT INTO public.users (id, email, name, role, social_provider)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data ->> 'name', ''),
    v_role,
    CASE
      WHEN v_provider IN ('apple', 'google', 'kakao', 'naver') THEN v_provider
      ELSE NULL
    END
  );

  -- employer 자동 default 팀 생성
  IF v_role = 'employer' THEN
    BEGIN
      -- 이름 → 이메일 로컬파트 → '내' 순으로 폴백. 결과: '홍길동 팀' / 'hong 팀' / '내 팀'
      v_workspace_name := COALESCE(
        NULLIF(LEFT(NEW.raw_user_meta_data ->> 'name', 40), ''),
        NULLIF(LEFT(SPLIT_PART(COALESCE(NEW.email, ''), '@', 1), 40), ''),
        '내'
      ) || ' 팀';

      INSERT INTO public.workspaces (name, owner_id)
      VALUES (v_workspace_name, NEW.id);
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'handle_new_user: 팀 자동 생성 실패 (user_id=%, error=%)',
        NEW.id, SQLERRM;
    END;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.handle_new_user() IS
  '신규 가입자 public.users INSERT + employer default 팀 자동 생성. 지갑/IAP 제거로 가입 하트 grant 블록 제거 (2026-06-22). 팀 생성 실패는 회원가입을 차단하지 않음 (EXCEPTION 격리). 기본 이름 ''OOO 팀'' (2026-07-19 용어 통일).';

-- ============================================================================
-- 2. 팀 초대 알림 문구
-- ============================================================================

CREATE OR REPLACE FUNCTION public.notify_on_workspace_invitation_insert() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_workspace_name text;
  v_inviter_name text;
BEGIN
  IF NEW.status != 'pending' THEN
    RETURN NEW;
  END IF;

  SELECT name INTO v_workspace_name FROM public.workspaces WHERE id = NEW.workspace_id;
  SELECT COALESCE(name, '알 수 없음') INTO v_inviter_name FROM public.users WHERE id = NEW.invited_by;

  v_workspace_name := COALESCE(v_workspace_name, '팀');
  v_inviter_name := COALESCE(v_inviter_name, '알 수 없음');

  INSERT INTO public.notifications (
    recipient_id, type, title, body, link, data, priority
  )
  VALUES (
    NEW.invitee_user_id,
    'workspace_invitation',
    format('%s님이 팀에 초대했어요', v_inviter_name),
    format('%s · 편집자 권한', v_workspace_name),
    format('/workspace/invitations'),
    -- payload 키는 클라이언트 계약이라 그대로 둔다 (표시 문자열만 바뀐다)
    jsonb_build_object(
      'invitationId', NEW.id,
      'workspaceId', NEW.workspace_id,
      'workspaceName', v_workspace_name,
      'inviterName', v_inviter_name,
      'senderId', NEW.invited_by
    ),
    'normal'
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '[notify_on_workspace_invitation_insert] failed for invitation % — %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.notify_on_workspace_invitation_insert() IS
  '팀 초대 발송 시 invitee 에게 인앱 알림 INSERT (push 발송은 기존 trigger 가 처리). 표시 문구 2026-07-19 용어 통일, payload 키는 클라 계약이라 유지.';

-- ============================================================================
-- 3. 기존 데이터 소급 정정
-- ============================================================================
-- 실사용자 0 인 지금이 가장 싼 시점이다. 나중으로 미루면 사용자가 직접 바꾼 이름과
-- 트리거가 만든 이름을 구별할 수 없어져 소급 자체가 위험해진다.
-- 접미사 ' 워크스페이스' 로 끝나는 행만 대상 — 사용자가 의도적으로 넣은 다른 위치의
-- '워크스페이스' 는 건드리지 않는다.

UPDATE public.workspaces
SET name = regexp_replace(name, ' 워크스페이스$', ' 팀')
WHERE name LIKE '% 워크스페이스';
