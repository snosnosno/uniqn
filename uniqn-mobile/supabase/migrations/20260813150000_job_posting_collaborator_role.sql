-- ============================================================================
-- S3-4 · 협업자 권한 2단 (manager / viewer)
-- ============================================================================
-- 지금은 '가입/제외' 이진 모델이다. 협업자로 넣는 순간 그 사람은 공고를 수정하고, 지원자를
-- 확정·거절하고, 정산까지 건드릴 수 있다. 사장이 "지원자 현황만 봐 줘" 라고 부탁하려면
-- 현재로선 **전권을 주는 수밖에 없다.**
--
-- 🔴 이 마이그레이션은 **문서화된 보안 결정을 뒤집는다.**
--    docs/superpowers/specs/2026-05-11-job-posting-collaborators-design.md:681-684 는
--    'Collaborator 권한 차등(manager/viewer)' 을 "NOT in scope" 로 명시하고,
--    외부 리뷰어(Codex)가 과권한을 우려했으나 **owner 신뢰 모델로 결정**했다고 적었다.
--    감사(2026-08-12 gap-09)가 그 결정을 되돌리자고 제안했고, 사용자가 승인했다.
--    그 이력을 여기 남긴다 — 나중에 "왜 이렇게 됐지" 를 묻는 사람이 반드시 있다.
--
-- ============================================================================
-- 🔑 설계의 핵심: **폭발 반경을 뒤집는다**
-- ============================================================================
-- 순진하게 하면 `is_posting_collaborator` 는 그대로 두고 쓰기 지점마다 새 헬퍼로 갈아끼워야 한다.
-- 실측하면 그 지점이 **쓰기 RPC 14종 + 쓰기 RLS 정책 5개 = 19곳**이다. 19곳을 손으로 고치면
-- 하나만 빠뜨려도 viewer 가 그 경로로 쓰기를 할 수 있고, **그건 아무 에러도 내지 않는다.**
--
-- 그래서 반대로 한다:
--   · `is_posting_collaborator()` 의 의미를 **manager 전용**으로 바꾼다
--     → 쓰기 RPC 14종과 쓰기 정책 5개가 **한 줄도 안 고치고** 자동으로 fail-closed 가 된다.
--   · 읽기 전용 `is_posting_collaborator_any()` 를 새로 만들어 **읽기 5개 정책 + 읽기 RPC 1종**만
--     명시적으로 갈아끼운다.
--     ⚠️ 처음엔 2종이라고 셌다. `ops_resolve_staff_work_logs` 는 함수 자체가 읽기 전용이라
--        같이 넓혔는데, 그 안의 호출은 읽기 가시성이 아니라 **쓰기 권한 판정**이었다(§4 하단 참조).
--        "읽기 전용 함수" 와 "읽기 가시성 판정" 은 다른 축이다 — 함수 단위로 세면 틀린다.
-- 고칠 곳이 19 → 6 으로 줄고, 빠뜨렸을 때의 실패가 "권한이 남는" 쪽이 아니라
-- "권한이 모자란" 쪽으로 뒤집힌다. 보안 변경에서 실패 방향은 옳음만큼 중요하다.
--
-- ⚠️ `is_workspace_jpc_member` 는 **건드리지 않는다.** 그건 "이 워크스페이스의 어떤 공고든
--    협업자인가" 이고 workspaces SELECT 가시성에만 쓰인다 — viewer 도 워크스페이스가 보여야
--    그 안의 공고에 닿는다.
--
-- 🔒 **기존 행은 전부 'manager'** (컬럼 DEFAULT). 즉 이 마이그레이션만으로는 동작이
--    하나도 바뀌지 않는다. viewer 는 사장이 명시적으로 지정해야 생긴다.
-- ============================================================================

-- ------------------------------------------------------------
-- 1. role 컬럼
-- ------------------------------------------------------------
-- ENUM 이 아니라 text + CHECK 인 이유: `ALTER TYPE ... ADD VALUE` 는 되돌릴 수 없고
-- 트랜잭션 안에서 쓰기도 까다롭다. 값이 2개뿐이고 늘어날 여지가 있는 축이라 CHECK 이 낫다
-- (notification_category 주석이 같은 이유로 ENUM 확장을 피하고 있다).
ALTER TABLE public.job_posting_collaborators
  ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'manager';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.job_posting_collaborators'::regclass
       AND conname = 'job_posting_collaborators_role_check'
  ) THEN
    ALTER TABLE public.job_posting_collaborators
      ADD CONSTRAINT job_posting_collaborators_role_check
      CHECK (role IN ('manager', 'viewer'));
  END IF;
END;
$$;

COMMENT ON COLUMN public.job_posting_collaborators.role IS
  'S3-4 협업자 권한. manager=기존 전권(기본값) / viewer=읽기 전용. '
  '쓰기 게이트는 is_posting_collaborator() 가, 읽기 게이트는 is_posting_collaborator_any() 가 판정한다.';

-- ------------------------------------------------------------
-- 2. 헬퍼 — 의미를 바꾸는 쪽(쓰기)과 새로 만드는 쪽(읽기)
-- ------------------------------------------------------------
-- 🚨 이 함수의 **의미가 바뀐다**: 종전 "협업자인가" → 이제 "관리 권한 협업자인가".
--    쓰기 RPC 14종·쓰기 정책 5개가 이 함수를 부르므로, 그 전부가 여기서 한 번에 좁혀진다.
CREATE OR REPLACE FUNCTION public.is_posting_collaborator(p_posting_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.job_posting_collaborators jpc
     WHERE jpc.job_posting_id = p_posting_id
       AND jpc.user_id = p_user_id
       AND jpc.role = 'manager'
  );
$$;

COMMENT ON FUNCTION public.is_posting_collaborator(uuid, uuid) IS
  'S3-4 이후: **관리 권한(manager) 협업자인가**. 쓰기 게이트 전용. '
  '읽기 가시성은 is_posting_collaborator_any() 를 쓸 것 — 이 둘을 바꿔 쓰면 viewer 가 쓰기를 하거나 '
  '아무것도 못 보게 된다.';

-- 읽기 가시성 — tier 무관. viewer 의 존재 이유가 이것이다(보긴 봐야 한다).
CREATE OR REPLACE FUNCTION public.is_posting_collaborator_any(p_posting_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.job_posting_collaborators jpc
     WHERE jpc.job_posting_id = p_posting_id
       AND jpc.user_id = p_user_id
  );
$$;

COMMENT ON FUNCTION public.is_posting_collaborator_any(uuid, uuid) IS
  'S3-4: tier 무관 협업자 여부. **읽기 가시성 전용** — 쓰기 게이트에 쓰면 viewer 가 쓰기를 한다.';

-- 🔒 anon 에는 주지 않는다. 짝인 `is_posting_collaborator` 도 authenticated/service_role 만
--    갖고 있고(baseline 20260710000002:14818-14820), 그 상태로 `app_select`·`qr_select`·
--    `wl_select`(TO 절이 없어 PUBLIC = anon 포함) 안에서 문제없이 평가돼 왔다 —
--    즉 anon 부여는 **필요하지 않다.** 주면 anon 이 (공고 UUID, 사용자 UUID) 로 협업자
--    여부를 되묻는 오라클이 생기고, 공고 UUID 는 공유 링크에 실려 준(準)공개다.
--    이 마이그레이션의 전제가 "실패 방향을 좁은 쪽으로" 인데 여기만 넓으면 앞뒤가 안 맞는다.
REVOKE ALL ON FUNCTION public.is_posting_collaborator_any(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_posting_collaborator_any(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.is_posting_collaborator_any(uuid, uuid) TO authenticated, service_role;

-- ------------------------------------------------------------
-- 3. 읽기 정책 5개만 _any 로 교체 (쓰기 정책 5개는 손대지 않는다 — 자동으로 좁혀졌다)
-- ------------------------------------------------------------
-- 원문을 그대로 복원하고 헬퍼 이름만 바꾼다. 조건식을 '정리'하고 싶은 충동을 참을 것 —
-- RLS 정책은 리팩터링하는 물건이 아니다.

DROP POLICY IF EXISTS jp_select_managed ON public.job_postings;
CREATE POLICY jp_select_managed ON public.job_postings
  FOR SELECT TO authenticated
  USING (
    (owner_id = (SELECT auth.uid()))
    OR is_workspace_member(workspace_id, (SELECT auth.uid()))
    OR is_posting_collaborator_any(id, (SELECT auth.uid()))
  );

DROP POLICY IF EXISTS app_select ON public.applications;
CREATE POLICY app_select ON public.applications
  FOR SELECT
  USING (
    (applicant_id = (SELECT auth.uid()))
    OR (job_posting_id IN (
      SELECT job_postings.id FROM public.job_postings
       WHERE (job_postings.owner_id = (SELECT auth.uid()))
          OR is_workspace_member(job_postings.workspace_id, (SELECT auth.uid()))
          OR is_posting_collaborator_any(job_postings.id, (SELECT auth.uid()))
    ))
  );

DROP POLICY IF EXISTS qr_select ON public.event_qr_codes;
CREATE POLICY qr_select ON public.event_qr_codes
  FOR SELECT
  USING (
    (user_id = (SELECT auth.uid()))
    OR (job_posting_id IN (
      SELECT job_postings.id FROM public.job_postings
       WHERE (job_postings.owner_id = (SELECT auth.uid()))
          OR is_workspace_member(job_postings.workspace_id, (SELECT auth.uid()))
          OR is_posting_collaborator_any(job_postings.id, (SELECT auth.uid()))
    ))
  );

DROP POLICY IF EXISTS wl_select ON public.work_logs;
CREATE POLICY wl_select ON public.work_logs
  FOR SELECT
  USING (
    (staff_id = (SELECT auth.uid()))
    OR (owner_id = (SELECT auth.uid()))
    OR (job_posting_id IN (
      SELECT job_postings.id FROM public.job_postings
       WHERE is_workspace_member(job_postings.workspace_id, (SELECT auth.uid()))
          OR is_posting_collaborator_any(job_postings.id, (SELECT auth.uid()))
    ))
  );

DROP POLICY IF EXISTS jpa_select_manager ON public.job_posting_announcements;
CREATE POLICY jpa_select_manager ON public.job_posting_announcements
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
        FROM public.job_postings jp
        JOIN public.workspaces w ON w.id = jp.workspace_id
       WHERE jp.id = job_posting_announcements.job_posting_id
         AND (
           -- initPlan 캐싱(20260809140000 RLS 비용 위생) — 맨 auth.uid() 는 행마다 재평가된다.
              w.owner_id = (SELECT auth.uid())
           OR public.is_workspace_member(jp.workspace_id, (SELECT auth.uid()))
           OR public.is_posting_collaborator_any(jp.id, (SELECT auth.uid()))
         )
    )
  );

-- ------------------------------------------------------------
-- 4. 읽기 RPC 1종만 _any 로 (viewer 가 지원자 화면을 볼 수 있어야 한다)
-- ------------------------------------------------------------
-- get_applicant_no_show_counts (S3-3) — 지원자 목록이 보이는데 칩만 안 보이면 앞뒤가 안 맞는다.
CREATE OR REPLACE FUNCTION public.get_applicant_no_show_counts(
  p_job_posting_id uuid,
  p_staff_ids uuid[]
)
RETURNS TABLE (staff_id uuid, no_show_count integer)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller       uuid := auth.uid();
  v_owner_id     uuid;
  v_workspace_id uuid;
  v_found        boolean;
  v_since text := to_char(
    ((now() AT TIME ZONE 'Asia/Seoul')::date - INTERVAL '180 days')::date, 'YYYY-MM-DD');
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 인증이 필요합니다';
  END IF;

  IF p_job_posting_id IS NULL OR p_staff_ids IS NULL OR array_length(p_staff_ids, 1) IS NULL THEN
    RETURN;
  END IF;

  SELECT jp.owner_id, jp.workspace_id, true
    INTO v_owner_id, v_workspace_id, v_found
    FROM public.job_postings jp
   WHERE jp.id = p_job_posting_id;

  IF NOT COALESCE(v_found, false) THEN
    RAISE EXCEPTION 'NOT_FOUND: 공고를 찾을 수 없습니다';
  END IF;

  -- 읽기라서 _any — viewer 도 지원자 화면을 본다.
  --
  -- 🔴 **명시적 결정 (2026-08-16, 사용자 승인)**: 이 완화는 프라이버시 축을 건드린다.
  --    20260813120000 은 같은 함수에 "④ 공고를 **관리할 수 있는** 사람만" 게이트를 걸고
  --    "사람에 대한 부정적 지표라 설계를 좁히는 것이 기능보다 중요하다"고 적었다.
  --    그런데 viewer 는 사장이 관리 권한을 주지 **않기로** 정한 사람이다.
  --    그럼에도 열어 두기로 한 이유는 지원자 목록이 이미 보이는 화면에서 노쇼 칩만
  --    사라지면 판단 근거가 반쪽이 되기 때문이고, 반환값이 여전히 **횟수뿐**이라
  --    (업장·날짜·사유 없음, 180일 창) 낙인 방지 설계의 본체는 유지되기 때문이다.
  --    ⚠️ 그 대가로 **viewer 를 지정하는 사장은 그 사람이 타인의 노쇼 횟수를 본다는 것을
  --    알아야 한다** — 협업자 지정 UI 의 viewer 설명 문구가 이 사실을 담아야 한다.
  --    되돌리려면 여기를 좁은 헬퍼로 바꾸고 UI 에서 viewer 분기로 칩을 숨기면 된다.
  IF NOT (
       v_owner_id = v_caller
    OR public.is_workspace_member(v_workspace_id, v_caller)
    OR public.is_posting_collaborator_any(p_job_posting_id, v_caller)
    OR public.is_admin()
  ) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 이 공고의 지원자를 볼 권한이 없습니다';
  END IF;

  RETURN QUERY
  SELECT
    a.applicant_id,
    COUNT(wl.id)::integer
  FROM public.applications a
  LEFT JOIN public.work_logs wl
    ON  wl.staff_id = a.applicant_id
    AND (wl.status = 'no_show' OR wl.no_show_at IS NOT NULL)
    AND wl.date >= v_since
  WHERE a.job_posting_id = p_job_posting_id
    AND a.applicant_id = ANY(p_staff_ids)
  GROUP BY a.applicant_id;
END;
$$;

-- 🚨 `ops_resolve_staff_work_logs` 는 **바꾸지 않는다.**
--    처음엔 "읽기 전용 함수니까 _any 로" 라며 pg_get_functiondef + replace 로 본문을 치환했다.
--    그건 틀렸다. 함수는 읽기 전용이 맞지만, **치환 대상이던 그 한 줄은 읽기 가시성이 아니라
--    쓰기 권한 판정**이다 — `v_posting_axis` 는 출력 컬럼 `write_allowed` 가 되고
--    (20260809110000: "쓰기 축 = update_work_log_slot 술어의 공고 부분"),
--    화면은 그 값으로 근태 기록 컨트롤을 연다(StaffAttendanceSheet.tsx:167
--    `canWrite = reason === 'ok' && writeAllowed && !!workLogId`).
--    _any 로 넓히면 viewer 에게 기록 버튼이 열리고, 누르는 순간 좁은 헬퍼를 그대로 쓰는
--    `update_work_log_slot` 이 거절한다 — 서버는 안전하지만 사용자는 막다른 길을 만난다.
--    "읽기 7곳만 _any" 라는 이 마이그레이션의 전제에서 이 자리는 애초에 읽기가 아니었다.
--    viewer 의 가시성은 이 함수의 입장 게이트(`is_ops_member`)가 이미 보장하므로 잃는 것도 없다.

-- ------------------------------------------------------------
-- 5. role 변경 경로 — UPDATE 정책 + 감사 + 알림
-- ------------------------------------------------------------
-- 종전 설계는 "행 immutable, 변경 시 DELETE + INSERT"였다(20260515020000 주석).
-- role 을 그렇게 바꾸면 제거·추가 알림이 각각 날아가 협업자가 "잘렸다가 다시 불렸다"고 읽는다.
-- 그래서 UPDATE 를 연다 — 단, **owner 만**, 그리고 **role 컬럼만**.
DROP POLICY IF EXISTS jpc_update_role_owner ON public.job_posting_collaborators;
CREATE POLICY jpc_update_role_owner ON public.job_posting_collaborators
  FOR UPDATE TO authenticated
  -- `(SELECT auth.uid())` — 이 파일이 :58-59 에서 "스타일이 아니라 성능 계약" 이라고
  -- 부른 그 규약이다. 여기만 맨 호출로 남아 있었다(RLS 비용 위생 20260809140000).
  USING (
    EXISTS (
      SELECT 1 FROM public.job_postings jp
        JOIN public.workspaces w ON w.id = jp.workspace_id
       WHERE jp.id = job_posting_collaborators.job_posting_id
         AND w.owner_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.job_postings jp
        JOIN public.workspaces w ON w.id = jp.workspace_id
       WHERE jp.id = job_posting_collaborators.job_posting_id
         AND w.owner_id = (SELECT auth.uid())
    )
  );

-- role 이외 컬럼은 UPDATE 로 못 바꾼다. 정책만으로는 컬럼을 못 좁히므로 트리거로 막는다 —
-- 이게 없으면 owner 가 user_id 를 갈아끼워 **다른 사람을 협업자로 둔갑**시킬 수 있다.
CREATE OR REPLACE FUNCTION public.fn_jpc_role_update_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.job_posting_id IS DISTINCT FROM OLD.job_posting_id
     OR NEW.user_id     IS DISTINCT FROM OLD.user_id
     OR NEW.added_by    IS DISTINCT FROM OLD.added_by
     OR NEW.id          IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION 'jpc_update_role_only'
      USING ERRCODE = '42501',
            DETAIL  = '협업자 행에서 UPDATE 로 바꿀 수 있는 것은 role 뿐입니다.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_jpc_role_update_guard ON public.job_posting_collaborators;
CREATE TRIGGER trg_jpc_role_update_guard
  BEFORE UPDATE ON public.job_posting_collaborators
  FOR EACH ROW EXECUTE FUNCTION public.fn_jpc_role_update_guard();

-- 감사 로그에 'role_changed' 를 허용한다. 제약을 **정의로** 찾아 정확히 1개만 교체한다.
DO $$
DECLARE
  v_name text;
  v_dropped int := 0;
BEGIN
  FOR v_name IN
    SELECT con.conname FROM pg_constraint con
     WHERE con.conrelid = 'public.job_posting_collaborator_audit'::regclass
       AND con.contype = 'c'
       AND pg_get_constraintdef(con.oid) LIKE '%added%'
       AND pg_get_constraintdef(con.oid) LIKE '%removed%'
  LOOP
    EXECUTE format('ALTER TABLE public.job_posting_collaborator_audit DROP CONSTRAINT %I', v_name);
    v_dropped := v_dropped + 1;
  END LOOP;

  IF v_dropped <> 1 THEN
    RAISE EXCEPTION 'audit action CHECK 을 정확히 1개 지울 것으로 기대했으나 %개였다', v_dropped;
  END IF;
END;
$$;

ALTER TABLE public.job_posting_collaborator_audit
  ADD CONSTRAINT job_posting_collaborator_audit_action_check
  CHECK (action IN ('added', 'removed', 'role_changed'));

-- role 변경도 감사 로그에 남긴다. 추가·제거만 남기면 "권한이 언제 좁혀졌는지"가 증발한다.
CREATE OR REPLACE FUNCTION public.fn_jpc_role_change_audit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    INSERT INTO public.job_posting_collaborator_audit
      (job_posting_id, target_user_id, actor_user_id, action, source)
    VALUES
      (NEW.job_posting_id, NEW.user_id, COALESCE(auth.uid(), NEW.added_by), 'role_changed', 'user');
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_jpc_role_change_audit ON public.job_posting_collaborators;
CREATE TRIGGER trg_jpc_role_change_audit
  AFTER UPDATE ON public.job_posting_collaborators
  FOR EACH ROW EXECUTE FUNCTION public.fn_jpc_role_change_audit();

-- 트리거 함수의 EXECUTE 는 회수한다. 트리거 발화에는 호출자의 EXECUTE 권한이 필요 없고,
-- 직접 호출은 PL/pgSQL 이 "trigger functions can only be called as triggers" 로 거부하므로
-- **악용 경로는 아니다.** 그래도 회수하는 이유는 이 저장소의 SECDEF 하드닝 관례이기 때문이다 —
-- 실측하면 SECDEF 트리거 함수 52개 중 50개가 이미 PUBLIC 을 회수한 상태고, 안 한 2개가
-- 이 마이그레이션이 새로 만든 둘이었다. 관례에서 혼자 벗어난 객체는 다음 보안 감사에서
-- 매번 "왜 얘만 다르지" 로 되살아난다.
REVOKE ALL ON FUNCTION public.fn_jpc_role_update_guard() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_jpc_role_change_audit() FROM PUBLIC, anon, authenticated;

-- ------------------------------------------------------------
-- 6. 스모크 — 전제가 깨졌으면 지금 실패한다
-- ------------------------------------------------------------
DO $$
DECLARE
  v_writers int;
BEGIN
  -- 기존 행이 전부 manager 인가 (동작 무변화의 근거)
  IF EXISTS (SELECT 1 FROM public.job_posting_collaborators WHERE role <> 'manager') THEN
    RAISE EXCEPTION '기존 협업자 행에 manager 아닌 값이 있다 — DEFAULT 가 안 먹었다';
  END IF;

  -- 쓰기 정책 5개가 여전히 좁은 헬퍼(is_posting_collaborator)를 쓰는가.
  -- 여기서 _any 가 잡히면 viewer 가 쓰기를 할 수 있다는 뜻이다.
  SELECT count(*) INTO v_writers
    FROM pg_policies
   WHERE schemaname = 'public'
     AND cmd IN ('UPDATE', 'DELETE')
     AND coalesce(qual, '') || coalesce(with_check, '') LIKE '%is_posting_collaborator_any%';

  IF v_writers <> 0 THEN
    RAISE EXCEPTION '쓰기 정책 %개가 is_posting_collaborator_any 를 쓴다 — viewer 가 쓰기를 할 수 있다', v_writers;
  END IF;
END;
$$;
