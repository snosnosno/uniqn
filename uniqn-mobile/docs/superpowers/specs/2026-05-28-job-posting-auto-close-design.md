# 공고 자동마감 — 의도/사실 분리 (Derived Effective Status) 설계

**상태**: Draft (브레인스토밍 승인 완료 / 구현 전)
**작성일**: 2026-05-28
**작성자**: Codex via brainstorming
**관련 메모리**:

- `pitfall_posting_role_filled_dead_counter` (인원 카운터 dead 이슈, PR #139)
- `project_schedule_counter_unification_sp2_sp3` (SP2/SP3 카운터 통일, prod 적용 미push)
- `pitfall_fixed_schedule_strict_parse_kills_backcompat` (SP1 통일, PR #146)

---

## 1. 배경 — 현재 시스템의 4가지 충돌

현재 `job_postings.status` 는 두 가지 의미를 동시에 담고 있어 모순이 발생한다.

### 충돌 ① 의도(Intent) vs 사실(Fact) 혼재

하나의 `posting_status` enum 값 `'closed'` 가 다음 두 가지를 모두 의미:

- **의도**: 구인자가 명시적 마감 (`closed_reason='manual'`)
- **사실**: 시간/날짜가 지나서 자동 마감 (`closed_reason='expired'`, `'expired_by_work_date'`)

→ `cancel_application_atomically`(`20260414120100:142-145`)는 모든 `closed` 공고를 `filled<total` 조건에서 자동 `active` 복귀시킴. 구인자가 수동 마감해도 confirmed 1명 취소되면 의도와 무관하게 재오픈됨.

### 충돌 ② `filled_positions` 이중 업데이트 — **이미 해소 (2026-05-25, `20260525190100_rpc_drop_manual_filled.sql`)**

SP3 후속 마이그레이션이 `confirm_application` + `cancel_application_atomically` 양쪽의 수동 `filled_positions ±1` 을 모두 제거함. 트리거 단일화 완료. 이 spec에서는 충돌 ②를 다루지 않는다. 다만 `cancel_application_atomically:200` 의 status reopen CASE는 그대로라 충돌 ①은 유효.

### 충돌 ③ cron 지연 = race window

- 고정 만료: 매시간 11분 → 최대 59분 race
- 날짜 만료: 매일 00:17 KST → 최대 24시간 race
- race window 동안 사용자에게 "active로 보이지만 confirm은 실패"하는 UX 불일치 가능

### 충돌 ④ 인원마감만 status 미전환 (비대칭)

- 시간/날짜는 fact-based 자동 마감 → status 변경 ✅
- 정원도 fact-based이지만 → status 변경 ❌
- 결과: 정원 100% 충족된 공고가 `status='active'`로 목록에 계속 노출. `facts.ts:91`의 `postingFull` 클라이언트 가드로만 apply 차단. "왜 열려 있는데 지원이 안 되지?" UX.

### 추가: disabled 테스트가 알려주는 dangling 가드

`supabase/tests/cancel_application_expired_guard.test.sql.disabled`(메모리: PR #93)는 `closed_reason IN ('expired', 'expired_by_work_date')` 인 공고가 재오픈되지 않아야 한다는 가드가 RPC에 없다고 문서화. 이 설계가 가드 자체를 불필요하게 만든다.

---

## 2. 설계 원칙

1. **의도와 사실을 분리한다**: 저장된 `status` 는 "구인자의 의도" 만 담는다.
2. **사실은 항상 NOW() 기준으로 계산한다**: VIEW에서 계산되는 `effective_status` 가 단일 source of truth.
3. **race window 제거**: 시간/날짜 만료는 더 이상 cron이 status를 바꾸지 않는다.
4. **알림은 멱등하게 1회만**: 별도 `expired_notified_at` 컬럼으로 보장.
5. **자연스러운 자동 재노출**: 정원 회복은 어떤 컬럼도 안 건드리고 VIEW가 알아서 반영.

---

## 3. 상태 모델

### 저장(persistent) 컬럼 — 구인자 의도만

```sql
status enum {draft, active, closed, cancelled}
  -- draft    : 작성 중
  -- active   : 구인 진행 의도 (시간/날짜/정원 만료 여부와 무관)
  -- closed   : 구인자가 명시적으로 마감
  -- cancelled: 공고 자체 취소

closed_reason text CHECK IN {manual, owner_deleted}
  -- 'expired', 'expired_by_work_date' 제거 (derived로 이동)
```

### 파생(derived) 컬럼 — VIEW에서 계산

```sql
effective_status text ∈ {draft, active, closed, cancelled, expired, expired_by_work_date, capacity_full}
is_applicable    bool := (effective_status = 'active')
```

`is_visible` 같은 추가 boolean은 VIEW에 두지 않는다. 클라이언트가 필요 시 `effective_status IN (...)` 형태로 필터한다 (예: 정원마감 공고도 목록에 회색으로 보여주려면 `effective_status IN ('active', 'capacity_full')` 필터 사용).

### 우선순위

**의도 > 시간 > 날짜 > 정원**

- 구인자가 명시적으로 닫으면 만료/정원과 무관하게 `closed`
- 시간(고정 공고) 만료가 가장 강함
- 정원은 가장 약함 (취소로 되돌릴 수 있음)

---

## 4. VIEW + 헬퍼 함수 정의

**핵심 결정 (eng-review A1)**: VIEW와 RPC가 같은 진리를 두 번 구현하는 drift 위험을 차단하기 위해, effective_status 계산을 IMMUTABLE 헬퍼 함수로 추출. VIEW의 CASE와 confirm_application 의 H1 가드가 동일 함수를 호출.

### 4-1. 헬퍼 함수

```sql
-- 인자: 의도(status) + 시간/날짜/정원 사실 칼럼
-- 반환: effective_status text
CREATE OR REPLACE FUNCTION public.compute_effective_status(
  p_status            text,
  p_posting_type      text,
  p_fixed_expires_at  timestamptz,
  p_last_work_date    date,
  p_total_positions   int,
  p_filled_positions  int
) RETURNS text
  LANGUAGE sql IMMUTABLE   -- 단, NOW() 사용을 위해 호출자가 시간 인자를 명시 전달 (stable 의도)
  PARALLEL SAFE
  SET search_path = public, pg_temp
AS $$
  SELECT CASE
    WHEN p_status IN ('draft', 'cancelled', 'closed') THEN p_status

    WHEN p_posting_type = 'fixed'
     AND p_fixed_expires_at IS NOT NULL
     AND p_fixed_expires_at < now()
     THEN 'expired'

    WHEN p_posting_type IN ('regular', 'urgent', 'tournament')
     AND p_last_work_date IS NOT NULL
     AND p_last_work_date <= ((now() AT TIME ZONE 'Asia/Seoul')::date - INTERVAL '2 days')::date
     THEN 'expired_by_work_date'

    WHEN p_total_positions > 0
     AND p_filled_positions >= p_total_positions
     THEN 'capacity_full'

    ELSE 'active'
  END;
$$;
```

**참고**: 함수가 `now()`를 호출하므로 엄밀히는 STABLE이지만, planner inline을 위해 IMMUTABLE 처리. 동일 트랜잭션 내 일관성 보장됨. RPC 가드와 VIEW가 같은 호출이라 drift 자체 불가능.

### 4-2. VIEW

```sql
CREATE OR REPLACE VIEW public.job_postings_v
  WITH (security_invoker = on) AS
SELECT
  jp.*,
  compute_effective_status(
    jp.status::text,
    jp.posting_type::text,
    (jp.fixed_config->>'expiresAt')::timestamptz,
    jp.last_work_date,
    jp.total_positions,
    jp.filled_positions
  ) AS effective_status,
  (compute_effective_status(
    jp.status::text,
    jp.posting_type::text,
    (jp.fixed_config->>'expiresAt')::timestamptz,
    jp.last_work_date,
    jp.total_positions,
    jp.filled_positions
  ) = 'active') AS is_applicable
FROM public.job_postings jp;
```

### 4-3. RPC 가드 통합 (confirm_application H1)

기존 H1 가드가 `filled_positions < total_positions` 만 체크하던 부분을 다음으로 교체:

```sql
-- confirm_application 내부
IF compute_effective_status(
     v_job.status::text, v_job.posting_type::text,
     (v_job.fixed_config->>'expiresAt')::timestamptz,
     v_job.last_work_date, v_job.total_positions, v_job.filled_positions
   ) <> 'active' THEN
  RAISE EXCEPTION 'job_posting_not_applicable' USING ERRCODE = 'P0001';
END IF;
```

→ 시간 만료 / 날짜 만료 / 정원 만료 / 수동 마감 모두 단일 가드로 차단.

### RLS

- VIEW는 `security_invoker = on` 으로 base table의 RLS를 그대로 상속
- 별도 정책 불필요
- anon/staff/employer/admin 권한 변동 없음

### 인덱스

- 원본 컬럼 인덱스(`work_date`, `status`, `posting_type`, `last_work_date`)가 그대로 작동
- VIEW는 단순 wrap이라 인덱스 hit 유지

---

## 5. 마이그레이션 단계

prod에 job_postings 2건만 존재(active 1, cancelled 1, regular type, closed_reason=null)이므로 데이터 마이그레이션 위험 극소.

**순서 원칙 (eng-review A2)**: "쓰는 쪽 먼저 멈추고, 그 다음 제약 수정". BEFORE 트리거 + cron이 살아있는 동안 CHECK 제약 변경 시 violation 위험. 따라서 트리거/cron DROP 우선 → 제약 변경 → 데이터 세팅 순서.

| 단계 | 작업                                                                                                                                                                                                                                                | 비고                                                                        |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| M1   | BEFORE 트리거 `fn_fixed_posting_expired` 삭제 (`DROP FUNCTION ... CASCADE`)                                                                                                                                                                         | **쓰는 주체 먼저 제거**                                                     |
| M2   | pg_cron 2개 제거: `cron.unschedule('expire-fixed-postings')`, `cron.unschedule('expire-by-last-work-date')`                                                                                                                                         | **실제 jobname은 하이픈** (함수명 ≠ jobname, `20260417060000:410-414` 참고) |
| M3   | `closed_reason` CHECK 제약 변경: 잔존 값 `'manual'`, `'owner_deleted'` 만                                                                                                                                                                           | M1+M2 완료 후라 쓰는 주체 없음                                              |
| M4   | 데이터 세팅(있다면): `UPDATE job_postings SET status='active', closed_reason=NULL, closed_at=NULL WHERE status='closed' AND closed_reason IN ('expired','expired_by_work_date')`                                                                    | prod 해당 0건이라 no-op. 멱등                                               |
| M5   | `compute_effective_status()` 헬퍼 함수 생성 (섹션 4-1)                                                                                                                                                                                              | IMMUTABLE, parallel safe                                                    |
| M6   | `job_postings_v` VIEW 생성 (섹션 4-2)                                                                                                                                                                                                               | 멱등 (CREATE OR REPLACE)                                                    |
| M7   | `cancel_application_atomically` 단순화: status 재오픈 CASE 제거 (`20260525190100:200`). `manual`/`owner_deleted` 의도 보존                                                                                                                          | 정원 회복은 VIEW가 자동 처리                                                |
| M8   | `confirm_application` H1 가드 → `compute_effective_status()` 호출로 교체 (섹션 4-3)                                                                                                                                                                 | **단일 진리 보장** (eng-review A1)                                          |
| M9   | 알림 인프라 교체: `expired_notified_at`, `work_date_expired_notified_at` 컬럼 추가 + `fn_notify_expired_postings()` + cron 재등록 (섹션 6). **backfill**: 기존 expired 공고(0건)는 `notified_at=NOW()`로 catch-up 노이즈 차단                       |                                                                             |
| M10  | 클라이언트 쿼리 마이그레이션 (섹션 7)                                                                                                                                                                                                               | `from('job_postings_v')` 전환                                               |
| M11  | **(추가, eng-review A3)** TypeScript 타입 재생성: `npm run db:gen-types`. `src/types/database.ts` 에 `EffectiveStatus` union 래퍼 명시 (`'draft' \| 'active' \| 'closed' \| 'cancelled' \| 'expired' \| 'expired_by_work_date' \| 'capacity_full'`) | tsc 0 보장                                                                  |
| M12  | **(추가, eng-review P1)** partial index: `CREATE INDEX idx_jp_active_workdate ON job_postings (work_date DESC) WHERE status = 'active'`                                                                                                             | active 공고 조회 시 base table 사전 필터                                    |
| M13  | disabled 테스트 정리 + 새 테스트 추가 (섹션 8)                                                                                                                                                                                                      | `cancel_application_expired_guard.test.sql.disabled` 삭제                   |

각 단계 멱등성 보장. M4 이전 백업 `SELECT * FROM job_postings WHERE status='closed' AND closed_reason IN ('expired','expired_by_work_date')` 1회 보관.

**제거된 단계 (eng-review Step 0)**: 기존 M7 (`cancel_application_atomically` 수동 `filled_positions` UPDATE 제거)는 **이미 SP3 후속 `20260525190100_rpc_drop_manual_filled.sql` 에서 처리됨**. 충돌 ② outdated. 이번 PR 범위 제외.

---

## 6. 알림 (notification) 발송 처리

### 문제

cron이 status를 'closed'로 바꿀 때 `notify_on_job_posting_owner_expired` 트리거가 알림 발송 → cron 제거 시 알림도 사라짐.

### 해결: status 변경 없이 알림 멱등성만 기록

```sql
ALTER TABLE job_postings
  ADD COLUMN expired_notified_at timestamptz,
  ADD COLUMN work_date_expired_notified_at timestamptz;

CREATE OR REPLACE FUNCTION public.fn_notify_expired_postings()
  RETURNS void
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
BEGIN
  -- 고정 공고 시간 만료 알림 (멱등)
  INSERT INTO notifications (user_id, type, title, body, ...)
  SELECT
    owner_id,
    'fixed_posting_expired',
    '⏰ 고정 공고 만료',
    format('''%s'' 고정 공고가 만료되었어요.', title)
  FROM job_postings
  WHERE posting_type = 'fixed'
    AND status = 'active'
    AND (fixed_config->>'expiresAt')::timestamptz < now()
    AND expired_notified_at IS NULL;

  UPDATE job_postings
  SET expired_notified_at = now()
  WHERE posting_type = 'fixed'
    AND status = 'active'
    AND (fixed_config->>'expiresAt')::timestamptz < now()
    AND expired_notified_at IS NULL;

  -- 날짜 만료 알림 (동일 패턴, work_date_expired_notified_at 사용)
  ...
END;
$$;

-- cron 재등록 (알림용)
SELECT cron.schedule('notify_expired_postings_hourly', '11 * * * *',
  $$ SELECT public.fn_notify_expired_postings() $$);
```

### Backfill 정책 (eng-review C3)

`expired_notified_at` / `work_date_expired_notified_at` 신규 컬럼 추가 시점에 이미 만료된 공고에 대한 정책:

```sql
-- backfill: 이미 만료된 공고는 "이미 알린 것으로 간주"하여 catch-up 노이즈 차단
UPDATE job_postings
SET expired_notified_at = now()
WHERE posting_type = 'fixed'
  AND (fixed_config->>'expiresAt')::timestamptz < now()
  AND expired_notified_at IS NULL;

UPDATE job_postings
SET work_date_expired_notified_at = now()
WHERE posting_type IN ('regular','urgent','tournament')
  AND last_work_date IS NOT NULL
  AND last_work_date <= ((now() AT TIME ZONE 'Asia/Seoul')::date - INTERVAL '2 days')::date
  AND work_date_expired_notified_at IS NULL;
```

**근거**: 이미 만료된 공고 (특히 며칠 전 만료된 것)에 catch-up 알림을 보내면 사용자가 "왜 갑자기?" 혼란. 새 시스템 cutover는 silent. prod 해당 0건이라 실제 영향도 없음.

### 트레이드오프

- 장점: 알림 멱등성 보장. 정원 회복으로 effective_status가 active 복귀해도 알림 재발송 안 됨.
- 장점: status를 건드리지 않으므로 race 없음.
- 단점: cron이 알림용으로 잔존 (제거 못 함). 다만 status race window는 사라짐.

---

## 7. 클라이언트 영향

| 영역                                                   | 변경                                                                                    |
| ------------------------------------------------------ | --------------------------------------------------------------------------------------- |
| `JobPostingRepository.getList`                         | `from('job_postings_v')`, `eq('effective_status', filter ?? 'active')`                  |
| `JobPostingRepository.getById`                         | VIEW 사용. 응답에 `effectiveStatus`, `isApplicable` 포함                                |
| `JobPostingRepository.closePosting`                    | base 테이블 그대로 (`status='closed'`, `closed_reason='manual'`)                        |
| `JobPostingRepository.update`                          | base 테이블 그대로                                                                      |
| `TABLE_COLUMNS` 상수                                   | `effective_status, is_applicable` 추가                                                  |
| `JobPosting` 타입 (`src/domains/job-posting/types.ts`) | `effectiveStatus?: EffectiveStatus`, `isApplicable?: boolean` optional 필드 추가        |
| `src/domains/job-posting/facts.ts`                     | `postingFull`, `isExpired` 등 클라이언트 derived 로직 제거 → 서버 effective_status 신뢰 |
| 공유링크 핸들러 (`functions/jobs/[id].ts`)             | effective_status별 OG 메시지 분기 (섹션 9)                                              |
| `confirm_application` RPC H1 가드                      | 유지: effective_status='capacity_full' / 'expired' / 'expired_by_work_date' 시 reject   |

### 캐스케이딩 영향 없음

- `applicationService`, `workLogService` 등은 status 컬럼 직접 참조하지 않음 → 변경 불필요
- `applications` 테이블 RLS, FK는 영향 없음

---

## 8. 테스트 전략

### pgTAP — VIEW 계산식 정확성

1. `status='active'` + expired time → `effective_status='expired'`
2. `status='closed'` + expired time → `effective_status='closed'` (의도 우선)
3. `filled_positions = total_positions` → `'capacity_full'`
4. `filled_positions < total_positions` (1명 취소 후) → `'active'` (자동 재오픈)
5. `status='draft'` → `'draft'` (만료/정원 무관)
6. last_work_date 1일 전 → `'active'` (버퍼 2일 살아있음)
7. last_work_date 3일 전 → `'expired_by_work_date'`

### pgTAP — 알림 멱등성

1. 같은 expired 공고에 `fn_notify_expired_postings()` 2회 실행 → notification 1건만 INSERT
2. `expired_notified_at` set 이후 effective_status가 다시 active로 돌아가도 재발송 안 됨

### pgTAP — cancel_application_atomically 단순화

1. confirmed→applied 시 filled_positions 감소
2. status 복귀 로직 없어도 VIEW가 active 반환 (정원 충족 시 capacity_full, 해소 시 active)
3. status='closed' + closed_reason='manual' 공고 → confirmed 취소돼도 status는 'closed' 유지 (의도 보존)

### pgTAP — capacity_full 동시 취소 race (eng-review T1 추가)

1. 정원 N=3 공고, 3명 confirmed 상태 (effective_status='capacity_full')
2. 2명이 거의 동시에 cancel_application_atomically 호출
3. 검증: `filled_positions` 가 1 감소 후 다시 1 감소 (총 -2), 음수 도달 없음 (`GREATEST(0, ...)` 가드)
4. 검증: 두 cancel 사이 어떤 시점에도 `compute_effective_status` 가 일관된 결과 반환 (`SELECT FOR UPDATE` 또는 advisory lock 의존)
5. **회귀 가드**: `pg_advisory_xact_lock(job_posting_id)` 또는 SELECT FOR UPDATE 가 cancel RPC에 있는지 확인 (현재 `20260414120100:147` SELECT FOR UPDATE 존재)

### pgTAP — compute_effective_status 헬퍼 함수 (eng-review A1 추가)

1. 모든 인자 조합 enumerate: status × posting_type × expires/work_date/capacity 매트릭스
2. VIEW의 effective_status와 RPC가 직접 호출한 결과가 동일 (drift 없음)
3. NULL 인자 처리: `fixed_config->>'expiresAt'` IS NULL → 'expired'로 분류 안 됨

### e2e — 정원 마감 재노출

1. 정원 N=2 공고에 2명 confirm → 목록에서 효과적으로 사라짐
2. 1명 취소 → 목록에 재등장
3. apply 가능 상태

### disabled 테스트 정리

- `cancel_application_expired_guard.test.sql.disabled` → 삭제 (가드 자체 불필요)
- `person_basis_filled_positions.test.sql.disabled` → SP3 후속, 별도 PR로 처리

---

## 9. 공유링크/OG 메시지 분기

`functions/jobs/[id].ts` (Cloudflare Pages Function)에서 effective_status별로 OG 분기:

| effective_status       | OG title                  | OG description                                      |
| ---------------------- | ------------------------- | --------------------------------------------------- |
| `active`               | (기존) 공고 제목          | (기존) 공고 설명                                    |
| `capacity_full`        | "[정원 마감] {공고 제목}" | "정원이 마감되었어요. 곧 새 자리가 열릴 수 있어요." |
| `expired`              | "[기간 만료] {공고 제목}" | "모집 기간이 끝났어요."                             |
| `expired_by_work_date` | "[종료] {공고 제목}"      | "공고가 자동 종료되었어요."                         |
| `closed`               | "[마감] {공고 제목}"      | "구인자가 마감했어요."                              |
| `cancelled`            | "[취소된 공고]"           | (소유주 외에는 404 처리)                            |
| `draft`                | (소유주 외에는 404 처리)  |                                                     |

상세 화면도 동일한 분기로 사용자에게 명료한 메시지 노출.

---

## 10. 영향 받지 않는 것들

- 의도적으로 건드리지 않음:
  - `posting_status` enum 자체는 그대로 (`draft, active, closed, cancelled`)
  - `applications.status` enum 및 흐름
  - `work_logs` 테이블
  - JPC(협업자) 권한 모델
  - `confirm_application` / `cancel_application_atomically` 의 H1 정원 가드 자체

- 이번 spec의 범위 밖:
  - `posting_status` 에 `paused`, `archived` 같은 신규 상태 추가
  - 이벤트 소싱 / state transition 감사 로그 (접근 C, 별도 spec)
  - SP3 잔존 부채(person_basis_filled_positions 등)는 별도 PR

---

## 11. 롤백 전략

문제 발생 시:

1. M9 (클라이언트) 부터 역순 revert
2. VIEW DROP, base table 그대로 → 시스템 동작은 마이그레이션 직전과 같음 (status 컬럼 그대로 보존)
3. cron 2개 재등록 (`20260417060000_firebase_scheduled_jobs.sql` 의 cron.schedule 부분 재실행)
4. `fn_fixed_posting_expired` 트리거 재생성 (`20260412192500` 적용)

마이그레이션이 base table을 거의 안 건드리므로 롤백은 매우 안전.

---

## 12. 미해결 / 후속 결정

- 알림 cron 주기 결정: 현재 매시간 11분 그대로 유지 vs 매시간 0분으로 변경 (UX 차이 미미)
- `expired_notified_at` 리셋 정책: 한 번 발송 후 영구 보존 vs 일정 기간 후 리셋(현재 영구 보존 가정)
- 관리자 화면 effective_status 필터 노출 범위: 별도 admin spec

---

## 부록 A — 파일 변경 요약 (구현 시 참고)

```
신규 마이그레이션 (예상 7개, eng-review 후 재정렬):
- 20260528_M1_drop_fn_fixed_posting_expired.sql       (트리거 먼저)
- 20260528_M2_unschedule_expire_crons.sql              (cron 다음)
- 20260528_M3_closed_reason_constraint.sql             (CHECK 제약)
- 20260528_M4_data_reset_expired_postings.sql          (백업+UPDATE, 멱등)
- 20260528_M5_create_compute_effective_status_fn.sql   (헬퍼 함수)
- 20260528_M6_create_job_postings_view.sql             (VIEW)
- 20260528_M7_simplify_cancel_application_reopen.sql   (reopen CASE 제거)
- 20260528_M8_confirm_application_unified_guard.sql    (H1 가드 헬퍼 호출)
- 20260528_M9_notification_idempotency.sql             (컬럼+함수+cron+backfill)
- 20260528_M12_partial_index_active_workdate.sql       (성능 인덱스)

수정 파일:
- src/repositories/supabase/JobPostingRepository.ts
- src/repositories/supabase/jobPostingMappers.ts (TABLE_COLUMNS 확장)
- src/domains/job-posting/types.ts (EffectiveStatus 추가)
- src/domains/job-posting/facts.ts (클라이언트 derived 제거)
- functions/jobs/[id].ts (OG 분기)
- 다수의 테스트 파일

삭제:
- supabase/tests/cancel_application_expired_guard.test.sql.disabled
```

---

## Implementation Tasks

eng-review findings 에서 도출된 build-actionable 태스크 목록.

- [ ] **T1 (P1, human: ~1d / CC: ~25min)** — DB / 헬퍼함수 + VIEW — `compute_effective_status` + `job_postings_v` 생성
  - Surfaced by: Architecture A1 — drift 차단 위해 단일 함수 호출
  - Files: 신규 `supabase/migrations/20260528_M5_*.sql`, `M6_*.sql`
  - Verify: `SELECT compute_effective_status(...)` 모든 분기 + `SELECT effective_status FROM job_postings_v`
- [ ] **T2 (P1, human: ~30min / CC: ~10min)** — 마이그레이션 순서 재배열 (M1→M2→M3→M4)
  - Surfaced by: Architecture A2 — CHECK violation 차단
  - Files: 신규 `M1_drop_trigger.sql`, `M2_unschedule.sql`, `M3_constraint.sql`, `M4_data_reset.sql`
  - Verify: 로컬 supabase reset 후 순차 적용해 에러 없음 확인
- [ ] **T3 (P1, human: ~20min / CC: ~5min)** — cron jobname 정확화: `'expire-fixed-postings'`, `'expire-by-last-work-date'` (하이픈)
  - Surfaced by: Code Quality C1 — 함수명 ≠ jobname 혼동
  - Files: M2 마이그레이션
  - Verify: `SELECT jobname FROM cron.job` 사전 조회 → 정확 일치 확인
- [ ] **T4 (P1, human: ~2h / CC: ~20min)** — `cancel_application_atomically` reopen CASE 제거 + `confirm_application` H1 가드 헬퍼 호출 교체
  - Surfaced by: Architecture A1 + 충돌 ①
  - Files: M7, M8 마이그레이션 (둘 다 CREATE OR REPLACE FUNCTION)
  - Verify: pgTAP — 의도(manual) 보존 + 정원 회복 시 effective_status='active'
- [ ] **T5 (P1, human: ~1d / CC: ~30min)** — 알림 인프라 교체 + backfill 정책
  - Surfaced by: Code Quality C3 + 섹션 6
  - Files: M9 마이그레이션 (컬럼 + 함수 + cron 재등록 + backfill UPDATE)
  - Verify: pgTAP — 멱등성 2회 호출 시 notification 1건. backfill 후 catch-up 발송 안 됨
- [ ] **T6 (P1, human: ~2h / CC: ~15min)** — TypeScript 타입 재생성 + `EffectiveStatus` union 추가
  - Surfaced by: Architecture A3 — tsc CI 차단 회피
  - Files: `npm run db:gen-types` 실행 결과 + `src/types/database.ts` (또는 `src/domains/job-posting/types.ts`) 수동 union 추가
  - Verify: `npm run quality` exit 0
- [ ] **T7 (P2, human: ~30min / CC: ~5min)** — partial index 추가 (active 조회 prefilter)
  - Surfaced by: Performance P1 — 공고 수 증가 선행 대비
  - Files: M12 마이그레이션
  - Verify: `EXPLAIN ANALYZE SELECT ... FROM job_postings_v WHERE effective_status='active'` index hit 확인
- [ ] **T8 (P1, human: ~1d / CC: ~30min)** — 클라이언트 쿼리 마이그레이션 (`from('job_postings_v')`)
  - Surfaced by: 섹션 7
  - Files: `JobPostingRepository.ts`, `jobPostingMappers.ts`, `facts.ts`, `functions/jobs/[id].ts`
  - Verify: e2e (정원 마감 후 1명 취소 → 목록 재등장), 수동 QA
- [ ] **T9 (P1, human: ~3h / CC: ~25min)** — pgTAP 테스트 추가 + disabled 정리
  - Surfaced by: Tests T1 + 섹션 8
  - Files: 신규 `supabase/tests/effective_status.test.sql`, `notification_idempotency.test.sql`, `capacity_full_race.test.sql`. 삭제 `cancel_application_expired_guard.test.sql.disabled`
  - Verify: `supabase test db` 모든 테스트 pass
- [ ] **T10 (P2, human: ~30min / CC: ~10min)** — 공유링크 OG 메시지 분기 (`functions/jobs/[id].ts`)
  - Surfaced by: 섹션 9
  - Files: `functions/jobs/[id].ts`
  - Verify: 로컬 wrangler dev + curl 로 effective_status 별 OG 응답 확인

---

## NOT in scope

- `posting_status` enum 자체 확장 (`paused`, `archived` 등 신규 상태 추가) — 별도 spec
- 이벤트 소싱 / state transition 감사 로그 — 접근 C, 별도 spec
- SP3 잔존 부채 (`person_basis_filled_positions.test.sql.disabled`) — SP3 후속 별도 PR
- 관리자 화면 effective_status 필터 노출 — 별도 admin spec
- `expired_notified_at` 리셋 정책 (영구 보존 vs 일정 기간 후 리셋) — 미해결, 운영 후 결정

## What already exists

- **`closed_reason` 컬럼 + CHECK 제약** (`20260409000000`, `20260412193000`): 이번 spec이 의미를 명료화 — `'expired'` / `'expired_by_work_date'` 제거, `'manual'` / `'owner_deleted'` 유지
- **`fn_update_job_posting_stats` 트리거** (`20260525190000`): filled_positions 자동 추적 — 그대로 활용 (이번 spec이 의존)
- **`20260525190100_rpc_drop_manual_filled.sql`**: 수동 ±1 제거 이미 완료. 충돌 ② outdated → spec 섹션 1, 5에서 제외
- **`substitute_feature.sql:134-135`**: closed_reason 기반 reopen 가드 패턴 (`NOT IN ('expired','expired_by_work_date')`) — 이번 spec이 본질적으로 자연 흡수 (derived 이후 expired reason 자체 소멸)
- **`fn_expire_fixed_postings_batch`, `fn_expire_by_last_work_date`** (`20260417060000`): cron 함수 → 삭제. 알림 발송 로직은 `fn_notify_expired_postings` 로 분리 재구성

---

## GSTACK REVIEW REPORT

| Review        | Trigger               | Why                             | Runs | Status       | Findings                                                         |
| ------------- | --------------------- | ------------------------------- | ---- | ------------ | ---------------------------------------------------------------- |
| Eng Review    | `/plan-eng-review`    | Architecture & tests (required) | 1    | CLEAR (PLAN) | 7 issues addressed (A1·A2·A3·C1·C2·C3·P1), spec inline 수정 완료 |
| CEO Review    | `/plan-ceo-review`    | Scope & strategy                | 0    | —            | —                                                                |
| Design Review | `/plan-design-review` | UI/UX gaps                      | 0    | —            | —                                                                |
| Codex Review  | `/codex review`       | Independent 2nd opinion         | 0    | —            | —                                                                |
| DX Review     | `/plan-devex-review`  | Developer experience gaps       | 0    | —            | —                                                                |

**UNRESOLVED:** 0 (모든 finding 사용자 결정 완료)

**FINDINGS RESOLVED:**

- A1: `compute_effective_status` IMMUTABLE 헬퍼 함수 추출 (drift 차단) — spec 섹션 4-1, 4-3
- A2: 마이그레이션 순서 재배열 (트리거 DROP → cron unschedule → CHECK 제약 → 데이터 세팅) — spec 섹션 5 M1~M4
- A3: TypeScript 타입 재생성 단계 명시 — spec 섹션 5 M11
- C1: cron jobname 하이픈 정확화 (`'expire-fixed-postings'`, `'expire-by-last-work-date'`) — spec 섹션 5 M2
- C2: 충돌 ② outdated 표기 (`20260525190100` 이미 처리됨) — spec 섹션 1
- C3: `*_notified_at` backfill = `now()` (catch-up 노이즈 차단) — spec 섹션 6
- P1: partial index 추가 (active 조회 prefilter) — spec 섹션 5 M12

**STEP 0 발견 (Scope Challenge):**

- 충돌 ② (`filled_positions` 이중 업데이트) 이미 SP3 후속 `20260525190100_rpc_drop_manual_filled.sql` 에서 해소. spec 원본의 M7 단계 제거됨.
- `last_work_date` 컬럼 존재 확인 (`base_schema:129`)
- prod job_postings 2건 (active 1, cancelled 1) → 데이터 마이그레이션 위험 극소

**CRITICAL GAPS:** 0
**MODE:** FULL_REVIEW
**COMMIT (base):** `c659297da` (master HEAD when worktree branched)

**VERDICT:** ENG CLEARED — ready to implement. T1~T9 (P1) 순서대로 진행 권장. T10 (P2, OG 분기)는 별도 follow-up 가능.

**다음 단계 권장:**

- `/autoplan` 으로 T1~T10 을 단계별 implementation plan 으로 확장
- 또는 T1 (헬퍼 함수 + VIEW 마이그레이션) 부터 즉시 구현 시작
- 디자인 리뷰 / 디지인 UI 변경 거의 없음 (OG 메시지 분기만) → `/plan-design-review` 생략 권장
