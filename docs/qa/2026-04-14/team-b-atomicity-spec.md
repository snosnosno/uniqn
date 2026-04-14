# Team B — Atomicity & Race Hardening Spec

> 작성일: 2026-04-14
> 입력: Phase 0 #3, #4, #5 (취소/QR/board sync 비원자 흐름)
> 결과: 3개 RPC SQL 스펙 + outbox 패턴 + 실패 매트릭스 + 마이그레이션 순서

---

## 0. Summary

| Flow | 현재 위험 | 해결 방안 | 마이그레이션 노력 | 모니터링 |
|------|-----------|----------|------------------|---------|
| 취소 (3 site) | 정원 over/under, orphan work_log | `cancel_application_atomically` RPC | ~2일 | filled > total alert |
| QR check-in/out | 음수 work_duration, payroll 중복 지급 | `process_qr_checkin_atomically` RPC | ~1일 | duration outlier alert |
| Schedule board sync | 분기 상태, 복구 불가 | Outbox 패턴 + background job | ~3일 | outbox status dashboard |

**Total**: ~1주 (순차) / 위험 95% 감소

---

## 1. Methodology

1. 각 함수의 모든 `.from(...)` 호출(테이블 + 작업) 추적
2. 사전 검증 read와 최종 write 분리
3. 단계별 에러 처리 분석 (try/catch swallow 검출)
4. 단계 간 race window 식별
5. PL/pgSQL RPC 설계: SELECT FOR UPDATE → validate → atomic write

---

## 2. Flow 1: 취소 (executeCancelConfirmation + executeApproveCancellation)

### 2.1 현재 코드 분석

**`ApplicationRepositoryTransactions.ts:218-303` (executeCancelConfirmation, 스태프 확정 취소)**

| 단계 | 작업 | 테이블 | line |
|------|------|--------|------|
| 1 | 지원 상태 read | applications | 226 |
| 2 | 공고 read + 소유권 검증 | job_postings | 234-238 |
| 3 | applications.update(status=APPLIED, history) | applications | 266-276 |
| 4 | job_postings.update(filled 재계산, reopen) | job_postings | 282-288 (`updateJobPostingCapacity`) |
| 5 | work_logs.delete(SCHEDULED만) | work_logs | 291 (`deleteScheduledWorkLogs`) |

**`ApplicationRepositoryTransactions.ts:475-541` (executeApproveCancellation, 구인자 취소 승인)**

| 단계 | 작업 | 테이블 | line |
|------|------|--------|------|
| 1 | 지원 read | (컨텍스트) | 482 |
| 2 | applications.update(status=CANCELLED, history) | applications | 511-528 |
| 3 | job_postings.update(filled 감소) | job_postings | 531-537 |
| 4 | work_logs.delete | work_logs | 540 |

**에러 처리**:
- 278-279: `handleSupabaseError` rethrow OR log, 단 capacity 갱신(282)는 무시하고 계속
- 470: capacity 갱신 실패 시 silent `logger.warn`
- 524-528, 540: 동일 패턴

### 2.2 실패 모드 매트릭스

| 단계 | 작업 | 실패 모드 | 결과 inconsistency | 영향 |
|------|------|----------|-------------------|------|
| 1 | applications.update | optimistic lock 실패 | application stuck CONFIRMED, capacity locked | 스태프 취소 불가 |
| 1alt | applications.update 성공, **응답 전 네트워크 timeout** | 클라이언트 모름 → 재시도 | job posting 중복 감소 | **Critical: capacity invariant 위반** |
| 2 | updateJobPostingCapacity 실패 (concurrent update) | silent log | filled_positions stuck high | UI "still full" |
| 3 | deleteScheduledWorkLogs 실패 | silent log | orphan work_log | **Critical: payroll 중복 계산** |
| 1→2 race | applications APPLIED 후, 다른 클라이언트가 같은 슬롯 confirm | 두 confirm 모두 같은 슬롯 본 | filled > total | **Critical: overbooking** |
| 2→3 race | capacity 감소 후, orphan work_log로 check-in | check-in 성공 → 부정 급여 | payroll audit 시 발견 | **Critical: 부정 지급** |

### 2.3 RPC Spec: `cancel_application_atomically`

```sql
CREATE OR REPLACE FUNCTION public.cancel_application_atomically(
  p_application_id uuid,
  p_actor_type text,        -- 'staff_initiates' | 'staff_approves_cancel_request'
  p_actor_id uuid,
  p_cancel_reason text DEFAULT NULL,
  p_rejection_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_application applications%ROWTYPE;
  v_job_posting job_postings%ROWTYPE;
  v_active_confirmation_entry jsonb;
  v_active_confirmation_index int;
  v_confirmation_history jsonb := '[]'::jsonb;
  v_deleted_work_log_count int := 0;
  v_now text := to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
  v_assignment_count int := 0;
  v_new_filled int;
  v_new_status text;
  v_updated_cancellation_request jsonb;
BEGIN
  -- 1. Lock application row
  SELECT * INTO v_application FROM applications
  WHERE id = p_application_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'application_not_found');
  END IF;

  -- 2. Idempotency: 이미 동일 액션이 적용됐다면 success 반환
  IF p_actor_type = 'staff_initiates' AND v_application.status = 'applied' THEN
    RETURN jsonb_build_object('success', true, 'idempotent', true);
  END IF;
  IF p_actor_type = 'staff_approves_cancel_request' AND v_application.status = 'cancelled' THEN
    RETURN jsonb_build_object('success', true, 'idempotent', true);
  END IF;

  -- 3. State validation (actor-specific)
  IF p_actor_type = 'staff_initiates' THEN
    IF v_application.status != 'confirmed' THEN
      RETURN jsonb_build_object('success', false, 'error', 'invalid_status_for_cancellation',
                                'current_status', v_application.status);
    END IF;
  ELSIF p_actor_type = 'staff_approves_cancel_request' THEN
    IF v_application.status != 'cancellation_pending' THEN
      RETURN jsonb_build_object('success', false, 'error', 'invalid_status_for_approval',
                                'current_status', v_application.status);
    END IF;
    IF v_application.cancellation_request IS NULL
       OR (v_application.cancellation_request->>'status') != 'pending' THEN
      RETURN jsonb_build_object('success', false, 'error', 'no_pending_cancellation_request');
    END IF;
  ELSE
    RETURN jsonb_build_object('success', false, 'error', 'invalid_actor_type');
  END IF;

  -- 4. Lock job_posting
  SELECT * INTO v_job_posting FROM job_postings
  WHERE id = v_application.job_posting_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'job_posting_not_found');
  END IF;

  -- 5. Manual permission check (SECURITY DEFINER bypasses RLS)
  IF p_actor_type = 'staff_approves_cancel_request' THEN
    IF v_job_posting.owner_id != p_actor_id THEN
      RETURN jsonb_build_object('success', false, 'error', 'unauthorized');
    END IF;
  ELSIF p_actor_type = 'staff_initiates' THEN
    IF v_application.applicant_id != p_actor_id THEN
      RETURN jsonb_build_object('success', false, 'error', 'unauthorized');
    END IF;
  END IF;

  -- 6. confirmation_history 갱신
  v_confirmation_history := COALESCE(v_application.confirmation_history, '[]'::jsonb);
  SELECT value, ordinality - 1
  INTO v_active_confirmation_entry, v_active_confirmation_index
  FROM jsonb_array_elements(v_confirmation_history) WITH ORDINALITY
  WHERE (value->>'cancelled_at') IS NULL
  LIMIT 1;

  IF v_active_confirmation_entry IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'no_active_confirmation');
  END IF;

  v_confirmation_history := jsonb_set(v_confirmation_history,
    ARRAY[v_active_confirmation_index::text, 'cancelled_at'], to_jsonb(v_now));
  v_confirmation_history := jsonb_set(v_confirmation_history,
    ARRAY[v_active_confirmation_index::text, 'cancelled_by'], to_jsonb(p_actor_id));
  v_confirmation_history := jsonb_set(v_confirmation_history,
    ARRAY[v_active_confirmation_index::text, 'cancellation_reason'],
    COALESCE(to_jsonb(p_cancel_reason), 'null'::jsonb));

  -- 7. New status + cancellation_request update
  IF p_actor_type = 'staff_initiates' THEN
    v_new_status := 'applied';
  ELSE
    v_new_status := 'cancelled';
    v_updated_cancellation_request := v_application.cancellation_request
      || jsonb_build_object('status', 'approved', 'reviewed_at', v_now, 'reviewed_by', p_actor_id);
  END IF;

  -- 8. Update applications
  UPDATE applications SET
    status = v_new_status,
    confirmation_history = v_confirmation_history,
    cancellation_request = COALESCE(v_updated_cancellation_request, cancellation_request),
    cancelled_at = v_now,
    updated_at = v_now
  WHERE id = p_application_id;

  -- 9. job_postings: filled_positions 재계산
  SELECT COUNT(*)::int INTO v_assignment_count
  FROM jsonb_array_elements(v_active_confirmation_entry->'assignments') a
  CROSS JOIN LATERAL jsonb_array_elements((a->>'dates')::jsonb) d;

  v_new_filled := GREATEST(0, v_job_posting.filled_positions - v_assignment_count);

  UPDATE job_postings SET
    filled_positions = v_new_filled,
    status = CASE
      WHEN status = 'closed' AND v_new_filled < total_positions THEN 'active'
      ELSE status
    END,
    updated_at = v_now
  WHERE id = v_job_posting.id;

  -- 10. work_logs DELETE
  DELETE FROM work_logs
  WHERE application_id = p_application_id
    AND status = 'scheduled';
  GET DIAGNOSTICS v_deleted_work_log_count = ROW_COUNT;

  RETURN jsonb_build_object(
    'success', true,
    'application_id', p_application_id,
    'new_status', v_new_status,
    'assignment_count', v_assignment_count,
    'new_filled_positions', v_new_filled,
    'deleted_work_log_count', v_deleted_work_log_count,
    'cancelled_at', v_now
  );
END;
$$;
```

### 2.4 마이그레이션 순서

1. 새 마이그레이션 파일 `20260414xxxxxx_add_cancel_application_atomically.sql` 생성
2. SQL 단위 테스트 (해피 패스 + 권한 오류 + idempotency)
3. `ApplicationRepositoryTransactions.ts:218-303` → RPC 호출 1줄로 교체
4. `ApplicationRepositoryTransactions.ts:475-541` → RPC 호출 1줄로 교체
5. `updateJobPostingCapacity` (407-458), `deleteScheduledWorkLogs` (460-473) 헬퍼 제거
6. 회귀 테스트: 동시 confirm + 취소 race, 네트워크 timeout 후 retry, orphan work_log 검사

### 2.5 RLS 영향

- **SECURITY DEFINER 필요**: YES (capacity 갱신은 다른 사용자 소유 row 수정)
- **수동 권한 검사 필수** (5단계 참조): actor가 application의 staff 또는 job_posting의 owner인지 확인
- **위험**: SECURITY DEFINER인데 권한 검사 누락 시 staff가 다른 사용자 application 취소 가능 → critical bug

---

## 3. Flow 2: QR Check-In/Out (executeProcessQRCheckInOut)

### 3.1 현재 코드 분석

**`WorkLogRepositoryTransactions.ts:185-348`**

| 단계 | 작업 | 테이블 | line |
|------|------|--------|------|
| 1 | work_log + job_posting 병렬 read | work_logs, job_postings | 201-207 |
| 2 | 상태 검증 (staffId, jobPostingId, date, payroll) | (메모리) | 243-263 |
| 3a | check-in: work_logs.update(status, check_in_time) | work_logs | 285-296 |
| 3b | check-out: work_logs.update(status, check_out_time, work_duration) | work_logs | 324-336 |

**문제**: 1단계 read와 3단계 write 사이에 다른 클라이언트가:
- 같은 work_log를 CHECKED_OUT으로 변경
- payroll status를 COMPLETED로 변경

→ read가 stale, write는 invalid state 위에 덮어씀

### 3.2 실패 모드

| 단계 | 실패 모드 | inconsistency | 영향 |
|------|----------|---------------|------|
| 1 | read at T0, change at T0+10ms | stale read | 이중 check-in |
| 2 | concurrent checkout 먼저 | invalid update | work_duration null |
| 1→3a race | 둘 다 SCHEDULED 봄, 둘 다 CHECKED_IN 씀 | check_in_time 잘못된 timestamp | 음수 work_duration |
| 3b race | CHECKED_IN read, payroll COMPLETED 동시 | overwrite payroll status | **Critical: 정산 깨짐** |

### 3.3 RPC Spec: `process_qr_checkin_atomically`

```sql
CREATE OR REPLACE FUNCTION public.process_qr_checkin_atomically(
  p_work_log_id uuid,
  p_staff_id uuid,
  p_job_posting_id uuid,
  p_action text,         -- 'checkIn' | 'checkOut'
  p_check_time timestamptz DEFAULT now(),
  p_expected_date date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public'
AS $$
DECLARE
  v_work_log work_logs%ROWTYPE;
  v_job_posting job_postings%ROWTYPE;
  v_now text := to_char(p_check_time AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
  v_work_duration numeric := 0;
  v_duration_minutes numeric;
BEGIN
  -- 1. Lock work_log + job_posting
  SELECT * INTO v_work_log FROM work_logs
  WHERE id = p_work_log_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'work_log_not_found');
  END IF;

  SELECT * INTO v_job_posting FROM job_postings
  WHERE id = p_job_posting_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'job_posting_not_found');
  END IF;

  -- 2. Defensive validations
  IF v_work_log.staff_id != p_staff_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'staff_id_mismatch');
  END IF;
  IF v_work_log.job_posting_id != p_job_posting_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'job_posting_id_mismatch');
  END IF;
  IF p_expected_date IS NOT NULL
     AND NOT v_work_log.is_fixed_posting
     AND (v_work_log.date::date) != p_expected_date THEN
    RETURN jsonb_build_object('success', false, 'error', 'date_mismatch');
  END IF;
  IF v_job_posting.status != 'active' THEN
    RETURN jsonb_build_object('success', false, 'error', 'job_posting_inactive');
  END IF;
  IF v_work_log.payroll_status = 'completed' THEN
    RETURN jsonb_build_object('success', false, 'error', 'already_settled');
  END IF;

  -- 3. Action-specific
  IF p_action = 'checkIn' THEN
    IF v_work_log.status IN ('checked_in', 'checked_out') THEN
      RETURN jsonb_build_object('success', false, 'error', 'already_checked_in');
    END IF;
    UPDATE work_logs SET
      status = 'checked_in',
      check_in_time = v_now,
      updated_at = v_now
    WHERE id = p_work_log_id;
    RETURN jsonb_build_object('success', true, 'action', 'checkIn',
                              'check_in_time', v_now, 'work_duration', 0);

  ELSIF p_action = 'checkOut' THEN
    IF v_work_log.status != 'checked_in' THEN
      RETURN jsonb_build_object('success', false, 'error', 'not_checked_in');
    END IF;
    IF v_work_log.check_in_time IS NOT NULL THEN
      v_duration_minutes := EXTRACT(EPOCH FROM (p_check_time - v_work_log.check_in_time::timestamptz)) / 60;
      v_work_duration := GREATEST(0, ROUND((v_duration_minutes / 60) * 100) / 100);
    END IF;
    UPDATE work_logs SET
      status = 'checked_out',
      check_out_time = v_now,
      work_duration = v_work_duration,
      updated_at = v_now
    WHERE id = p_work_log_id;
    RETURN jsonb_build_object('success', true, 'action', 'checkOut',
                              'check_out_time', v_now, 'work_duration', v_work_duration);

  ELSE
    RETURN jsonb_build_object('success', false, 'error', 'invalid_action');
  END IF;
END;
$$;
```

### 3.4 마이그레이션

1. 새 마이그레이션 파일 작성
2. SQL 테스트 (해피 패스 + 이미 정산 + 동시 check-in)
3. `WorkLogRepositoryTransactions.ts:185-348` → RPC 호출 1줄로 교체
4. 회귀 테스트: payroll 완료 후 check-in 시도, 동시 check-in race

### 3.5 RLS 영향

- **SECURITY DEFINER 필요**: YES
- **수동 권한 검사**: `v_work_log.staff_id = p_staff_id` (이미 포함)
- **위험**: 권한 검사 누락 시 임의 staff가 다른 사람 work_log 조작 가능

---

## 4. Flow 3: Schedule Board Sync (jobManagementService)

### 4.1 현재 코드 분석

**`jobManagementService.ts:20-33` `syncScheduleBoardSafely`**:
```typescript
async function syncScheduleBoardSafely(task, context) {
  try {
    await task();
  } catch (error) {
    logger.warn('Schedule board sync failed', { error, ...context });
  }
}
```

호출자:
- `createJobPosting` (46-66, line 53)
- `updateJobPosting` (68-92, line 77)
- `deleteJobPosting` (94-111, line 98)
- `closeJobPosting` (113-130, line 117)
- `reopenJobPosting` (132-149, line 136)
- `bulkUpdateJobPostingStatus` (166-199, line 181)

**문제**: board 상태가 job_postings와 분기. 복구 메커니즘 없음. 호출자가 sync 실패를 모름.

### 4.2 단일 트랜잭션이 어려운 이유

1. **DB/서비스 경계**: board는 다른 Supabase 프로젝트, 외부 REST, Redis 등일 가능성 — 단일 PostgreSQL 트랜잭션이 걸쳐갈 수 없음
2. **Idempotency**: 부분 성공 후 retry 시 중복 발생 가능
3. **2-Phase Commit**: Supabase 프로젝트 간 미지원

### 4.3 권장 방안: Outbox 패턴

**Outbox 테이블**:
```sql
CREATE TABLE IF NOT EXISTS public.schedule_board_sync_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_posting_id uuid NOT NULL REFERENCES job_postings(id) ON DELETE CASCADE,
  action text NOT NULL CHECK (action IN ('create','update','delete','close','reopen')),
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','processing','success','failed_retry_limit')),
  error_message text,
  retry_count int DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX idx_sync_outbox_status ON schedule_board_sync_outbox(status)
  WHERE status IN ('pending','processing');

ALTER TABLE schedule_board_sync_outbox ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_only" ON schedule_board_sync_outbox
  FOR ALL USING (auth.role() = 'service_role');
```

**클라이언트 변경**:
```typescript
export async function updateJobPosting(jobPostingId, input, ownerId) {
  const result = await jobPostingRepository.updateWithTransaction(jobPostingId, input, ownerId);
  await supabase.from('schedule_board_sync_outbox').insert({
    job_posting_id: jobPostingId,
    action: 'update',
    payload: result,
    status: 'pending',
  });
  return result;  // 즉시 반환, board sync는 백그라운드
}
```

**백그라운드 처리** (Edge Function 또는 cron):
```typescript
// 30초마다
async function processOutbox() {
  const { data: pending } = await supabase
    .from('schedule_board_sync_outbox')
    .select('*').eq('status', 'pending')
    .order('created_at').limit(10);

  for (const row of pending) {
    try {
      await syncScheduleBoard(row.action, row.payload);
      await supabase.from('schedule_board_sync_outbox')
        .update({ status: 'success' }).eq('id', row.id);
    } catch (error) {
      const retry = row.retry_count + 1;
      if (retry > 3) {
        await supabase.from('schedule_board_sync_outbox')
          .update({ status: 'failed_retry_limit', error_message: error.message })
          .eq('id', row.id);
        // alert ops
      } else {
        await supabase.from('schedule_board_sync_outbox')
          .update({ retry_count: retry }).eq('id', row.id);
      }
    }
  }
}
```

### 4.4 마이그레이션

1. outbox 테이블 + RLS 마이그레이션
2. `jobManagementService.ts:20-33` `syncScheduleBoardSafely` 제거
3. 6개 호출 site 모두 outbox insert로 교체
4. background processor Edge Function 작성 + 배포
5. outbox 모니터링 대시보드 (failed_retry_limit alert)

---

## 5. 공통 우려사항

### 5.1 SECURITY DEFINER 위험
- RPC가 superuser 권한으로 실행 → RLS bypass
- 권한 검사 누락 시 임의 사용자가 다른 사용자 데이터 조작 가능
- **완화**: 모든 SECURITY DEFINER 함수에 명시적 권한 검사 ≥ 2회. role-based credential로 테스트.

### 5.2 SELECT FOR UPDATE vs Optimistic Locking
- 본 spec은 SELECT FOR UPDATE 사용 — 원자성이 throughput보다 중요
- Lock 비용: ~1ms (interactive QR check-in에 무관)

### 5.3 Idempotency
- 모든 RPC가 응답 metadata 반환 (cancelled_at, deleted_count 등)
- 클라이언트 retry 시 RPC 내부에서 상태 검사 → 동일 결과 반환

### 5.4 테스트 전략
- SQL 단위: 해피 패스, 실패 모드, 권한 (staff/employer/admin)
- TypeScript 통합: E2E 흐름, 동시 race, 네트워크 실패
- 성능: RPC 실행 시간 (<100ms cancel, <50ms QR), lock contention

---

## 6. 다음 액션

| Task | 우선순위 | 사이즈 | 의존성 |
|------|---------|--------|--------|
| `cancel_application_atomically` 마이그레이션 + SQL test | P0 | M | - |
| 클라이언트 218-303, 475-541 RPC 교체 | P0 | S | 위 |
| `process_qr_checkin_atomically` 마이그레이션 + SQL test | P0 | M | - |
| 클라이언트 185-348 RPC 교체 | P0 | S | 위 |
| outbox 테이블 + RLS 마이그레이션 | P1 | S | - |
| jobManagementService 6 site outbox 교체 | P1 | M | 위 |
| outbox processor Edge Function | P1 | M | 위 |
| outbox 모니터링 dashboard + alert | P1 | S | 위 |
| 회귀 테스트 (3 RPC × 5 시나리오) | P0 | L | RPC 완료 |

---

## References

- `ApplicationRepositoryTransactions.ts:218-303,475-541`
- `WorkLogRepositoryTransactions.ts:185-348`
- `jobManagementService.ts:20-111,113-149,166-199`
