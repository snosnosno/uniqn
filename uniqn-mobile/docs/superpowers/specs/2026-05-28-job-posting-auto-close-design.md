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

### 충돌 ② `filled_positions` 이중 업데이트

SP3(`20260525190000_filled_positions_trigger.sql`)에서 `fn_update_job_posting_stats` 트리거에 filled delta를 통합했으나, `cancel_application_atomically:138-147`은 여전히 수동 UPDATE를 유지. 같은 컬럼을 두 경로가 만지는 일관성 위험.

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

## 4. VIEW 정의

```sql
CREATE OR REPLACE VIEW public.job_postings_v
  WITH (security_invoker = on) AS
SELECT
  jp.*,

  CASE
    -- 1. 의도 우선
    WHEN jp.status IN ('draft', 'cancelled', 'closed') THEN jp.status::text

    -- 2. 시간 만료 (고정 공고)
    WHEN jp.posting_type = 'fixed'
     AND (jp.fixed_config->>'expiresAt')::timestamptz < now()
     THEN 'expired'

    -- 3. 날짜 만료 (regular/urgent/tournament: 마지막 근무일 + 2일 경과)
    WHEN jp.posting_type IN ('regular', 'urgent', 'tournament')
     AND jp.last_work_date IS NOT NULL
     AND jp.last_work_date <= ((now() AT TIME ZONE 'Asia/Seoul')::date - INTERVAL '2 days')::date
     THEN 'expired_by_work_date'

    -- 4. 정원 마감
    WHEN jp.total_positions > 0
     AND jp.filled_positions >= jp.total_positions
     THEN 'capacity_full'

    -- 5. 진행 중
    ELSE 'active'
  END AS effective_status,

  CASE
    WHEN jp.status NOT IN ('active') THEN false
    WHEN jp.posting_type = 'fixed'
         AND (jp.fixed_config->>'expiresAt')::timestamptz < now() THEN false
    WHEN jp.posting_type IN ('regular','urgent','tournament')
         AND jp.last_work_date IS NOT NULL
         AND jp.last_work_date <= ((now() AT TIME ZONE 'Asia/Seoul')::date - INTERVAL '2 days')::date THEN false
    WHEN jp.total_positions > 0 AND jp.filled_positions >= jp.total_positions THEN false
    ELSE true
  END AS is_applicable

FROM public.job_postings jp;
```

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

| 단계 | 작업                                                                                                                | 비고                                                                    |
| ---- | ------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| M1   | `job_postings_v` VIEW 생성 (위 SQL)                                                                                 | 멱등 (CREATE OR REPLACE)                                                |
| M2   | `closed_reason` CHECK 제약 변경: `'expired'`, `'expired_by_work_date'` 제거                                         | prod 해당 rows 0건                                                      |
| M3   | 기존 `expired`/`expired_by_work_date` rows 복귀: `status='active'`, `closed_reason=NULL`, `closed_at=NULL` (있다면) | prod 해당 0건이라 no-op                                                 |
| M4   | pg_cron 2개 제거: `cron.unschedule('expire_fixed_postings_batch')`, `cron.unschedule('expire_by_last_work_date')`   |                                                                         |
| M5   | BEFORE INSERT/UPDATE 트리거 `fn_fixed_posting_expired` 삭제 (`DROP FUNCTION ... CASCADE`)                           | VIEW가 처리                                                             |
| M6   | `cancel_application_atomically` 단순화: status 재오픈 로직(`20260414120100:140-147`) 제거                           | 정원 회복은 VIEW가 자동 처리. `manual`/`owner_deleted` 의도 그대로 보존 |
| M7   | (별도, SP3 후속) `cancel_application_atomically` 의 수동 `filled_positions` UPDATE 제거 — 트리거로 일원화           | 충돌 ② 해소                                                             |
| M8   | 알림 인프라 교체 (섹션 6)                                                                                           | cron은 알림용으로만 남음                                                |
| M9   | 클라이언트 쿼리 마이그레이션 (섹션 7)                                                                               |                                                                         |
| M10  | disabled 테스트 정리 + 새 테스트 추가 (섹션 8)                                                                      |                                                                         |

각 단계 멱등성 보장. M2/M3 이전 백업 SELECT 1회.

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
신규 마이그레이션 (예상 5개):
- 20260528_M1_create_job_postings_view.sql
- 20260528_M2_closed_reason_constraint.sql
- 20260528_M3_drop_expire_crons_and_trigger.sql
- 20260528_M4_simplify_cancel_application_atomically.sql
- 20260528_M5_notification_idempotency_columns_and_fn.sql

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
