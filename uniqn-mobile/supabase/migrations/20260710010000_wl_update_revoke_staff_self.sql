-- work_logs UPDATE — 스태프 자기행 쓰기 권한 회수 (유저플로우 감사 P0#1, CRITICAL)
--
-- 문제
--   wl_update USING 이 `staff_id = auth.uid()` 를 허용해, 스태프가 자기 JWT 로
--   Supabase REST 에 직접 PATCH 하여 자신의 work_log 를 수정할 수 있었다.
--   protect_work_log_payroll_columns 트리거는 payroll_amount / payroll_status /
--   payroll_date / payroll_notes 4개만 막는다(prod 함수 본문 실측). 정산 금액을
--   실제로 결정하는 입력값은 보호되지 않았다:
--     check_in_ts, check_out_ts, custom_salary_info, custom_allowances, custom_tax_settings
--   최종 금액 컬럼 쓰기를 막아도 서버가 그 입력값으로 재계산하므로 결과가 조작된다.
--   → 인증된 스태프가 앱 UI 를 전혀 거치지 않고 자기 정산액을 부풀릴 수 있었다.
--
-- 수정
--   wl_update USING 에서 staff_id 자기행 분기를 제거한다.
--   스태프의 정상 출퇴근은 process_qr_checkin_atomically(SECURITY DEFINER,
--   owner=postgres, 자체적으로 auth.uid() = p_staff_id 검증)를 경유하므로 RLS 를
--   우회한다 → QR 체크인/체크아웃은 영향받지 않는다.
--   조회는 wl_select 가 staff_id 분기를 유지하므로 그대로 동작한다.
--
-- 함께 정리: work_logs_update_involved (레포 전용 잔재)
--   base_schema.sql 이 만든 permissive UPDATE 정책으로
--   `staff_id = auth.uid() OR owner_id = auth.uid() OR is_admin()` 을 허용한다.
--   RLS permissive 정책은 OR 로 합산되므로, 이 정책이 남아 있으면 wl_update 만
--   고쳐도 스태프 쓰기가 열린 채로 남는다.
--   prod 실측(2026-07-10): work_logs 의 UPDATE 정책은 wl_update 단 1개.
--   즉 이 정책은 prod 에 존재하지 않는다 → prod 에서는 IF EXISTS 로 no-op 이고,
--   로컬/신규 환경을 prod 와 동일하게 맞추는 파리티 수정이다.
--
-- 잔여 벡터 (의도적, P1 후속)
--   job_posting_collaborators 로 추가된 staff-role 사용자는 is_posting_collaborator
--   분기로 여전히 UPDATE 할 수 있다. 협업자 추가는 workspace owner 만 가능하므로
--   (jpc_insert_ws_owner) 외부인이 스스로 진입할 수는 없다.
--   컬럼 단위 방어(트리거에 정산 입력값 추가 + 신뢰경로 플래그)는 별도 PR 로 다룬다.
--
-- 회귀 고정: supabase/tests/wl_update_staff_self_revoke.test.sql (8 케이스)
--            supabase/tests/jpc_work_logs_rls.test.sql (staff 본인 UPDATE → DENY)

-- 레포 전용 잔재 제거 (prod 미존재 → no-op)
DROP POLICY IF EXISTS "work_logs_update_involved" ON public.work_logs;

DROP POLICY IF EXISTS "wl_update" ON public.work_logs;
CREATE POLICY "wl_update"
  ON public.work_logs FOR UPDATE
  USING (
    (owner_id = (SELECT auth.uid()))
    OR (job_posting_id IN (
      SELECT id FROM public.job_postings
      WHERE public.is_workspace_member(workspace_id, (SELECT auth.uid()))
        OR public.is_posting_collaborator(id, (SELECT auth.uid()))
    ))
  );

COMMENT ON POLICY "wl_update" ON public.work_logs IS
  '근무기록 UPDATE: 공고 owner / 워크스페이스 멤버 / 공고 협업자만. '
  '스태프 자기행 쓰기는 2026-07-10 회수 — 정산 입력값(check_in_ts/custom_*) 조작 차단. '
  '스태프 출퇴근은 process_qr_checkin_atomically(SECURITY DEFINER) 경유.';
