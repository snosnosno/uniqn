-- ============================================================
-- 감사 후속 P5 — work_logs 방어 심화 (M4 + L2)
--
-- M4: staff_id / owner_id 무단 재지정 차단 (BEFORE UPDATE 트리거)
-- L2: time_slot 형식 CHECK
--
-- 🔴 감사 §7 P5 의 원 처방(`REVOKE UPDATE (staff_id, owner_id) ... FROM authenticated`)은
--    **무효다**. 로컬에서 실제로 실행해 확인했다 — REVOKE 는 성공을 반환하지만
--    information_schema.column_privileges 도 pg_class.relacl 도 불변이다.
--    `authenticated` 가 테이블 레벨 UPDATE 전권(`authenticated=arwdDxtm/postgres`)을
--    갖고 있고, PostgreSQL 은 테이블 레벨 GRANT 에서 컬럼 부분집합을 뺄 수 없기 때문이다.
--    → 선례 `fn_work_logs_pin_posting_id`(job_posting_id 고정)와 동일한 형태의
--      BEFORE UPDATE 트리거로 간다.
-- ============================================================

-- ------------------------------------------------------------
-- M4. work_logs.staff_id / owner_id 불변 고정
--
-- 왜 필요한가 (prod 실측 근거):
--   · RLS 정책은 `wl_select`(SELECT)·`wl_update`(UPDATE) 2개뿐이고,
--     `wl_update` 는 WITH CHECK 이 NULL 이라 USING 이 재사용된다. 그 USING 은
--     `owner_id = auth.uid() OR job_posting_id IN (내 워크스페이스/협업 공고)` 인데,
--     job_posting_id 는 이미 트리거로 고정돼 있으므로 워크스페이스 멤버는
--     **두 컬럼을 임의 값으로 바꿔도 정책을 계속 만족한다**.
--   · 기존 BEFORE UPDATE 트리거 `protect_work_log_payroll_columns` 는
--     app_metadata.role 이 admin/employer 면 early RETURN 이라 이 축을 보지 않는다.
--   · 즉 두 컬럼을 막는 계층이 하나도 없었다.
--
-- 증분 위협(감사 §6 이 가설 3개 중 2개를 기각하고 남긴 하나):
--   출근·정산이 끝난 근무 기록을 스태프 본인 이력에서 **무음으로 지우는 것**.
--   정상 경로 `remove_direct_staff` 는 checked_in/checked_out/completed 를 거부하고
--   소프트 취소라 알림이 반드시 나가며, work_logs 에는 DELETE 정책이 아예 없다.
--   staff_id 재지정은 그 가드를 우회하는 유일한 무음 삭제 수단이다.
--
-- 정당한 writer 전수 (prod pg_proc 전수 스캔 + 레포 전수 grep):
--   · staff_id  — UPDATE 경로에 **0곳**. INSERT 는 add_direct_staff / confirm_application
--     (둘 다 SECDEF) 뿐이고 이 트리거는 UPDATE 전용이라 무영향.
--   · owner_id  — `permanently_delete_user`(SECDEF) 의 `SET owner_id = NULL` **1곳뿐**.
--     그래서 NULL 로 가는 변경만 허용한다.
--     ⚠️ 감사가 적은 "SECDEF RPC 2개(permanently_delete_user·remove_direct_staff)"는 오기다 —
--        `remove_direct_staff` 는 두 컬럼 모두 손대지 않는다(소프트 취소로 status 만 바꾼다).
--   · 클라이언트 TS · functions/ · supabase/functions/ · scripts/ 에 두 컬럼 쓰기 0곳.
--
-- 설계 근거 (전부 로컬 supabase_db_uniqn 에서 실제로 실행해 확인):
--   · `BEFORE UPDATE OF <컬럼>` 은 SET 절에 그 컬럼이 없으면 **발화하지 않는다**
--     → 정상 경로(다른 컬럼만 갱신)에 오버헤드 0.
--   · 그러나 SET 절에 **동일한 값**으로 실리기만 해도 발화한다
--     → `IS DISTINCT FROM` 가드가 없으면 객체를 통째로 보내는 호출이 오탐으로 죽는다.
--   · SECDEF 함수 내부의 UPDATE 도 트리거는 발화한다(SECDEF 라고 건너뛰지 않는다)
--     → permanently_delete_user 를 통과시키려면 예외 조건이 트리거 안에 있어야 한다.
--
-- 🔴 owner_id 를 "NULL 이면 무조건 허용"으로 두면 구멍이 남는다 — 실측으로 확인했다.
--   클라는 `.eq('owner_id', ownerId)` 로 구인자별 완료 근무 기록을 조회한다
--   (WorkLogRepository.ts:226,264). 즉 owner_id 를 NULL 로 만들면 그 행이
--   **공고 소유자의 정산 목록에서 사라진다.** 그리고 wl_update 의 USING 은
--   워크스페이스 멤버·협업자를 통과시키므로, 이건 자해가 아니라 **타인에 대한 피해**다.
--   (에디터가 남의 공고 행을 지울 수 있다 — 로컬에서 실제로 재현했다.)
--
--   그래서 NULL 화도 "원래 자기 소유였거나 관리자일 때"로 좁힌다. 이 조건은
--   permanently_delete_user 의 두 정당 경로를 모두 통과시킨다(로컬 실증):
--     · 본인 계정 삭제  — `UPDATE ... WHERE owner_id = p_user_id` 이고 p_user_id = auth.uid()
--     · 관리자 대행 삭제 — public.is_admin()
--   반면 에디터·협업자가 남의 공고 행을 NULL 로 만드는 경로는 차단된다.
--
--   ⚠️ 남는 잔여 위험은 "자기 소유 행을 자기가 NULL 로 만드는 것" 하나뿐이고, 이는 자해라
--      수용한다. GUC 마커로 완전히 닫으려면 계정 삭제 경로(고위험 SECDEF)를 재정의해야 해서
--      이 방어가 갚는 값보다 비싸다.
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.fn_work_logs_pin_identity()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  -- staff_id 는 정당한 UPDATE writer 가 하나도 없다 — 예외 없이 차단한다.
  IF NEW.staff_id IS DISTINCT FROM OLD.staff_id THEN
    RAISE EXCEPTION 'WORK_LOG_STAFF_IMMUTABLE: work_logs.staff_id 는 변경할 수 없습니다 (근무 이력 무음 이전 차단)'
      USING ERRCODE = '42501';  -- insufficient_privilege
  END IF;

  -- owner_id 는 permanently_delete_user 의 참조 해제(NULL)만 허용하되,
  -- 그 NULL 화도 "원래 자기 소유였거나 관리자"일 때로 좁힌다.
  -- 그렇지 않으면 에디터·협업자가 남의 공고 행을 NULL 로 만들어
  -- 공고 소유자의 정산 목록에서 감출 수 있다(헤더 주석 참조).
  IF NEW.owner_id IS DISTINCT FROM OLD.owner_id
     AND NOT (
       NEW.owner_id IS NULL
       AND (OLD.owner_id = auth.uid() OR public.is_admin())
     ) THEN
    RAISE EXCEPTION 'WORK_LOG_OWNER_IMMUTABLE: work_logs.owner_id 는 다른 사용자로 변경할 수 없습니다 (소유 이전 차단)'
      USING ERRCODE = '42501';  -- insufficient_privilege
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.fn_work_logs_pin_identity() IS
  'work_logs.staff_id 불변 + owner_id 는 (본인 소유였거나 관리자일 때만) NULL 로 지우기 허용. '
  '워크스페이스 멤버가 raw PostgREST 로 출근·정산 완료 기록을 타인에게 재지정해 무음 삭제하거나, '
  'owner_id 를 NULL 로 만들어 공고 소유자의 정산 목록에서 감추는 경로를 차단한다(감사 M4). '
  'NULL 예외는 permanently_delete_user 의 참조 해제(본인 삭제·관리자 대행) 전용.';

-- 트리거 함수는 직접 호출 대상이 아니다. prod 하드닝 관례(20260731090000)와 정합.
REVOKE EXECUTE ON FUNCTION public.fn_work_logs_pin_identity() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS tr_work_logs_pin_identity ON public.work_logs;
CREATE TRIGGER tr_work_logs_pin_identity
  BEFORE UPDATE OF staff_id, owner_id ON public.work_logs
  FOR EACH ROW EXECUTE FUNCTION public.fn_work_logs_pin_identity();

-- ------------------------------------------------------------
-- L2. work_logs.time_slot 형식 CHECK
--
-- 왜 필요한가 (prod 실측 근거):
--   `add_direct_staff(p_job_posting_id, p_staff_id, p_assignments jsonb)` 는
--   **클라이언트가 보낸 jsonb** 의 `v_assignment->>'timeSlot'` 을 아무 검증 없이
--   그대로 work_logs.time_slot 에 INSERT 한다(confirm_application 도 동형).
--   두 함수 모두 authenticated 에 GRANT 돼 있어 raw RPC 호출로 임의 문자열 주입이 가능하고,
--   유일한 형식 게이트는 클라이언트(`assertSlotStartTime`)뿐이었다.
--
-- 🔴 감사·인계 프롬프트의 전제 정정 (prod 실측):
--   "job_postings 의 자유 문자열을 그대로 복사한다"는 부정확하다.
--   prod job_postings 33건의 schedule 에 `timeSlot` 키는 **0건**이고 실제 키는
--   `requirements[].timeSlots[].startTime` 이다. work_logs.time_slot 의 실제 원천은
--   `applications.assignments[].timeSlot` 이며 prod 전수 9건이 모두 단일 시각이다
--   (`19:00`·`21:00`·`18:30`·`21:30`).
--
-- 허용 집합 (prod 전수 + 활성 생산 형태 + 특수 마커를 모두 담는다):
--   · NULL                      — 시각 미지정(updateSlot 의 timeUndecided 경로)
--   · 'NEGOTIABLE'              — FIXED_TIME_MARKER(고정공고 시간 협의)
--   · '미정'                     — TBA_TIME_MARKER
--   · ''                        — 레거시 빈 문자열(_posting_slot_key 가 '미정' 으로 정규화)
--   · 'HH:MM'                   — 현행 단일 시각(활성 생산 형태)
--   · 'HH:MM[구분자]HH:MM'       — 레거시 범위. 구분자는 '-' 또는 '~' 이며 **양쪽 공백을 허용**한다.
--     ⚠️ prod 레거시 실측값이 `'18:30 - 03:00'` · `'17:00 - 00:00'` 처럼
--        하이픈 양쪽에 공백이 있다. 공백을 빼먹은 정규식을 쓰면 기존 행이 즉시 깨진다.
--
-- 차단되는 것(로컬에서 실제로 걸어 확인): 공백만(' ') · '<script>alert(1)</script>' ·
--   200자 숫자열 · '9:00'(한자리 시) · '18:00:00'(초 포함) · 'TBD'
--
-- NOT VALID 로 걸고 즉시 VALIDATE 한다 — prod 3행이 전부 통과함을 사전 확인했으므로
-- VALIDATE 는 성공하지만, 두 단계로 나누면 실패 시 어느 쪽이 문제인지 즉시 갈린다.
-- ------------------------------------------------------------

ALTER TABLE public.work_logs
  ADD CONSTRAINT work_logs_time_slot_format
  CHECK (
    time_slot IS NULL
    OR time_slot IN ('NEGOTIABLE', '미정', '')
    OR time_slot ~ '^([01][0-9]|2[0-3]):[0-5][0-9](\s*[-~]\s*([01][0-9]|2[0-3]):[0-5][0-9])?$'
  )
  NOT VALID;

ALTER TABLE public.work_logs VALIDATE CONSTRAINT work_logs_time_slot_format;

COMMENT ON CONSTRAINT work_logs_time_slot_format ON public.work_logs IS
  'time_slot 형식 게이트(감사 L2). 허용: NULL / NEGOTIABLE / 미정 / 빈문자열 / HH:MM / HH:MM[-~]HH:MM(구분자 양쪽 공백 허용). '
  'add_direct_staff·confirm_application 이 클라 jsonb 의 timeSlot 을 무검증 INSERT 하는 경로를 닫는다.';
