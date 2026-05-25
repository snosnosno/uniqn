# 스케줄 확정 경로 통일 (SP2) — 설계 문서

- **날짜**: 2026-05-25
- **브랜치**: `refactor/schedule-counter-unify` (베이스: SP1 HEAD `0f4a65d86`)
- **범위**: 3-subproject 로드맵 중 **SP2만**. SP1(스키마 통일)은 완료. SP3(단일 canonical 카운터 + dead counter 제거)는 후속.
- **의존**: SP1 (fixed = `requirements[{date:null, timeSlots:[synthetic]}]` 통일 구조).

---

## 1. 배경 / 문제

`confirm_application` RPC 와 클라이언트 확정 경로가 **fixed/dated 두 갈래**로 갈라져 있다. SP1 이 스케줄 substructure 를 통일했지만, 확정 경로의 분기는 그대로 남았다.

### 1.1 현행 prod 상태 (실측 검증 완료, 2026-05-25)

- **`confirm_application` RPC** 는 이미 SP1 통일 구조(`schedule->'requirements'`)를 H1 정원 가드에서 읽고, **실시간 work_logs 를 카운트**한다(dead counter 안 읽음). 분기는 `p_is_fixed_posting` 플래그 하나뿐:
  - `IF NOT p_is_fixed_posting AND jsonb_array_length(p_assignments) > 0` → **fixed 는 H1 정원 가드를 건너뜀**.
  - 동일 가드로 **fixed 는 work_logs INSERT 를 건너뜀**.
- **클라이언트** `ApplicationRepositoryTransactions.executeConfirmWithHistory`:
  - `isFixedPosting = jobData.schedule.kind === 'fixed'` (65) 로 분기.
  - `validateConfirmCapacity(isFixedPosting, ...)` (77) 에 플래그 전달.
  - RPC 에 `p_is_fixed_posting: isFixedPosting` (120) 전달.
- **클라이언트 capacity 검증**(`slotCapacity.ts`)은 SP1 에서 fixed 를 처리하도록 정렬됐으나, `filled: role.filled ?? 0`(line 68) **dead counter 를 읽어 항상 0** → 클라 가드는 실제 overfill 을 탐지하지 못한다(이미 찬 슬롯도 remaining=count 로 계산).
- **fixed 취소**: `executeReviewCancellation` (171–175) 이 `schedule.kind === 'fixed'` 이면 throw → fixed 는 취소 불가(work_logs 부재가 이유였음).

### 1.2 이 분기가 낳는 결함

| 결함                                     | 원인                                                                                                                                                                              |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **fixed 역할별 overfill 가능**           | 서버 H1 가드가 fixed 를 명시적으로 스킵. 클라 가드는 dead counter(항상 0) 기반이라 무력. 신뢰할 enforcement 0.                                                                    |
| **fixed 역할별 (filled/count) 항상 0/N** | fixed 는 work_logs 를 만들지 않음 → 역할 단위 hydrate RPC(`get_posting_filled_counts`)가 카운트할 행이 없음. (표시 최종 정합은 SP3 소관이나, work_logs 생성 전제가 여기서 마련됨) |
| **fixed 확정/취소 비대칭**               | fixed 는 확정은 되는데 취소는 클라가 차단.                                                                                                                                        |

### 1.3 왜 지금

prod 공고 2건(둘 다 dated), **fixed 0건, legacy roleRequirements 0건**, 확정 1건, work_log 1건. RPC 재정의·마이그레이션 무위험 시점.

---

## 2. 목표 / 비목표

### 목표 (SP2)

- `confirm_application` 에서 **fixed/dated 분기(`p_is_fixed_posting`)를 제거** — 모든 공고가 동일 경로(H1 정원 가드 + work_logs INSERT)를 탄다.
- **서버 H1 정원 가드를 fixed 에도 실제로 작동**시켜 역할별 overfill 을 서버에서 차단한다. 이를 위해 서버 H1 의 capacity 키 도출(date/slot)을 **클라이언트 fixed 마커와 정합**시킨다.
- fixed 확정 시 work_logs 가 생성되게 한다(SP3 의 hydrate 표시 + 트리거 카운터 전제).
- **fixed 취소를 활성화** — 클라 차단 제거, fixed 도 `cancel_application_atomically` 통일 경로.
- 기존 동작(체크인/정산/blurhash 전파/알림/dated 확정·취소) 완전 보존.

### 비목표 (SP3 소관)

- dead counter(`schedule...roles[].filled`) 제거 — SP3.
- `filled_positions` 수동 ±1 → 트리거 이관 — SP3 (SP2 는 현행 수동 갱신 그대로 보존, 이중증가 금지).
- 역할별 표시를 hydrate 단일 소스로 — SP3 (SP2 는 fixed work_logs 생성까지만).
- `get_posting_filled_counts` / 표시 모델 변경 — SP3.

---

## 3. 핵심 설계: fixed 키 정합 (overfill 차단의 실제 메커니즘)

### 3.1 SP1 확립 fixed 마커 규약

| 개념                                      | 마커               | 상수                |
| ----------------------------------------- | ------------------ | ------------------- |
| fixed 날짜(반복근무, 특정일 없음)         | `'FIXED_SCHEDULE'` | `FIXED_DATE_MARKER` |
| fixed 시간 협의(startTime 없음, TBA 아님) | `'NEGOTIABLE'`     | `FIXED_TIME_MARKER` |
| 시간 미정(TBA)                            | `'미정'`           | `TBA_TIME_MARKER`   |

클라 `slotCapacity.ts` 는 이미 이 규약으로 capacity 맵을 만든다:

- `effectiveDate = requirement.date ?? FIXED_DATE_MARKER` (line 43)
- `slotSelectionTime = isTimeToBeAnnounced ? TBA_TIME_MARKER : (startTime || (kind==='fixed' ? FIXED_TIME_MARKER : ''))` (line 51–53)

그리고 클라 확정 flat assignment(`ApplicationRepositoryTransactions.ts:93–108`)는 `a.dates`(fixed=`['FIXED_SCHEDULE']`) + `a.timeSlot`(fixed=`'NEGOTIABLE'` 또는 `'미정'`)를 RPC 로 보낸다.

> **검증 항목(플랜 Task 0)**: fixed 확정 시 `assignment.dates === ['FIXED_SCHEDULE']`, `assignment.timeSlot === 'NEGOTIABLE'|'미정'` 임을 `AssignmentSelector`/`buildCanonicalFixedAssignment` 에서 실측 확인. SP1 메모리·slotCapacity 주석이 단언하나 코드로 재확인 후 진행.

### 3.2 서버 H1 키 도출 불일치 (현행 버그)

현행 `confirm_application` H1 capacity 서브쿼리:

```sql
WHERE req->>'date' = v_rec.a_date
  AND (CASE WHEN COALESCE((ts->>'isTimeToBeAnnounced')::boolean, false)
            THEN '미정'
            ELSE public._posting_slot_key(COALESCE(ts->>'startTime', ts->>'time')) END) = v_rec.slot_key
  AND public._posting_role_key(r->>'role', r->>'customRole') = v_rec.role_key
```

fixed 의 경우:

- `req->>'date'` = `NULL` (JSON null), `v_rec.a_date` = `'FIXED_SCHEDULE'` → `NULL = 'FIXED_SCHEDULE'` → **false → 매칭 0 → v_capacity=0 → 가드 무력**.
- fixed 협의 슬롯: `startTime` 없음, `isTimeToBeAnnounced` false → `_posting_slot_key(NULL)` → `'미정'`. 그런데 `v_rec.slot_key` = `_posting_slot_key('NEGOTIABLE')` = `'NEGOTIABLE'` → **불일치**.

즉 `p_is_fixed_posting` 만 끄면 H1 이 여전히 vacuous 하다. **반드시 서버 키 도출을 클라 마커와 정합시켜야** 한다.

### 3.3 SP2 서버 H1 키 정합 (해결)

`v_is_fixed := (v_job.schedule->>'kind') = 'fixed'` 를 RPC 내부에서 도출하고:

- **date 매칭**: `COALESCE(req->>'date', 'FIXED_SCHEDULE') = v_rec.a_date`
  - dated: `req->>'date'` = 실제 날짜 → 변화 없음.
  - fixed: `NULL → 'FIXED_SCHEDULE'` = assignment 의 `'FIXED_SCHEDULE'` → 매칭 성공.
- **slot 매칭**: capacity 서브쿼리의 슬롯 키 CASE 를 클라 line 51–53 와 동형으로:
  ```sql
  CASE
    WHEN COALESCE((ts->>'isTimeToBeAnnounced')::boolean, false) THEN '미정'
    WHEN COALESCE(ts->>'startTime', ts->>'time') IS NOT NULL THEN public._posting_slot_key(COALESCE(ts->>'startTime', ts->>'time'))
    WHEN v_is_fixed THEN 'NEGOTIABLE'
    ELSE public._posting_slot_key(COALESCE(ts->>'startTime', ts->>'time'))  -- '' → _posting_slot_key → '미정' (dated 비정상 케이스 방어)
  END = v_rec.slot_key
  ```
- **role 매칭**: 기존 `_posting_role_key` 그대로(이미 정합).

> work_logs 의 기존 행을 세는 `v_existing` 카운트(`work_logs wl WHERE wl.date = v_rec.a_date ...`)도 동일 정합 필요: fixed work_logs 는 `date='FIXED_SCHEDULE'` 로 INSERT 되므로(아래 3.4), `wl.date = v_rec.a_date('FIXED_SCHEDULE')` 가 자연 매칭된다. 슬롯도 `_posting_slot_key(wl.time_slot='NEGOTIABLE')='NEGOTIABLE'` 매칭. 별도 변경 불필요.

### 3.4 fixed work_logs INSERT

`p_is_fixed_posting` 분기 제거로 INSERT 루프가 fixed 에도 실행된다. fixed flat assignment 는 `date='FIXED_SCHEDULE'`, `timeSlot='NEGOTIABLE'|'미정'`, `role`(역할), 그러므로 work_logs 행이 그 값으로 생성된다:

- `is_fixed_posting` 컬럼 = `v_is_fixed` (현행 하드코딩 `false` → fixed 정확 반영). 기존 work_logs 소비자(체크인/정산)가 `is_fixed_posting` 을 읽는지 플랜에서 확인(읽으면 fixed=true 가 올바름).
- fixed 는 `a.dates=['FIXED_SCHEDULE']` 단일 → 역할 1개당 work_log 1행(과다 생성 없음).

---

## 4. 영역별 상세 설계

### 4.1 DB — `confirm_application` 재정의 (마이그레이션, MCP apply_migration)

- **현행 prod 본문을 `pg_get_functiondef` 로 먼저 get** 후 최소 diff. (이미 §3.2 에 본문 인용 — 적용 직전 재확인.)
- 변경점:
  1. `v_is_fixed boolean := (v_job.schedule->>'kind') = 'fixed';` 선언(`v_job` SELECT 직후).
  2. H1 가드 진입 조건: `IF NOT p_is_fixed_posting AND ...` → `IF jsonb_array_length(p_assignments) > 0` (fixed 포함).
  3. H1 capacity 서브쿼리 date/slot 키를 §3.3 정합 버전으로.
  4. work_logs INSERT 진입 조건: 동일하게 fixed 포함. `is_fixed_posting` = `v_is_fixed`.
  5. `filled_positions`/`stats.filledPositions` 갱신 라인 **현행 유지**(SP3 트리거 이관 전까지 — 이중증가 금지).
  6. `p_assignments_v3`/`p_confirmation_history`/`p_original_application`/`p_notes` 처리, blurhash 등 work_logs 컬럼 **전부 보존**.
- **파라미터 `p_is_fixed_posting`**: 시그니처에서 제거. (RPC 시그니처 변경 → 클라 호출도 동시 변경. 함수 오버로드 잔재 방지 위해 기존 시그니처 `DROP FUNCTION` 후 재생성하거나, 동일 시그니처 유지하며 인자 무시 — **플랜에서 오버로드 충돌 점검**. 권장: 신규 시그니처로 재정의 + 구 시그니처 DROP.)
- SECURITY DEFINER, `SET search_path` 현행 유지(`public`). pgcrypto 미사용이라 extensions 불요(현행대로).

### 4.2 DB — `cancel_application_atomically`

- **변경 없음**(현행 본문이 fixed 를 분기하지 않음 — work_logs DELETE + filled_positions -1 + history). fixed work_logs 가 SP2 로 생기므로 그대로 작동.
- fixed 취소 활성화는 **클라 차단 제거**만으로 충족(아래 4.4).

### 4.3 클라이언트 — `ApplicationRepositoryTransactions.executeConfirmWithHistory`

- `isFixedPosting` 분기(65–68): `assignmentsToConfirm` 선택 로직 검토. fixed 는 `selectedAssignments` 개념이 없으므로 `applicationData.assignments` 전체. dated 는 `selectedAssignments ?? assignments`. → **분기 유지하되 이름만 정리**(이건 "선택 가능 여부"라 fixed/dated 의미 차이가 실재. RPC 플래그 제거와 무관). **재검토**: 이 분기는 capacity/work_logs 와 무관한 UX 선택 로직이므로 SP2 에서 제거 대상 아님 — 유지.
- `validateConfirmCapacity(isFixedPosting, ...)` (77): `_isFixedPosting` 파라미터 제거. 내부는 `validateAssignmentSlotCapacity`(fixed/dated 공통) 단일 호출로. (SP1 이 이미 fixed 라우팅. 단 클라 capacity 는 dead counter 기반이라 실효성은 서버 H1 에 의존 — SP3 에서 dead counter 제거 시 클라 검증은 "키 형태 검증" 수준으로 약화되나, 서버가 권위. SP2 는 시그니처만 정리.)
- RPC 호출(113–122): `p_is_fixed_posting` 인자 제거.
- `loadAndVerifyJobPostingAccess` 등 헬퍼 변경 없음.

> **주의**: `validateConfirmCapacity` 가 fixed 에서 dead counter(filled=0) 로 통과시키는 현행 동작은 SP2 후에도 (서버 H1 이 진짜 가드이므로) 무해. 클라 검증은 빠른 UX 피드백용. SP3 에서 dead counter 제거 시 함께 정리.

### 4.4 클라이언트 — fixed 취소 활성화

- `executeReviewCancellation` (171–175) 의 `if (jobData.schedule.kind === 'fixed') throw` 제거.
- fixed 취소 경로가 dated 와 동일하게 `cancel_application_atomically` 를 타는지 확인(staff_initiates / staff_approves_cancel_request 양쪽).
- fixed 취소 시 work_logs(`date='FIXED_SCHEDULE'`, status='scheduled') DELETE + filled_positions -1 정상 동작 검증.

### 4.5 타입 / 시그니처 정리

- `ApplicationRepository` 인터페이스에서 confirm 관련 시그니처에 `isFixedPosting` 누수 없는지 확인.
- `confirm_application` RPC 타입(supabase 생성 타입): 시그니처 변경 시 `generate_typescript_types` 재생성 필요 여부 점검(`createClient` 제네릭 미지정이면 불요 — 메모리 확인).

---

## 5. 테스트 전략 (증거 기반)

### 5.1 동적 overfill 차단 증명 (핵심 — execute_sql BEGIN/ROLLBACK, MCP)

메인(사람)이 직접 수행. 서브에이전트 MCP 금지.

1. fixed 공고 1건 + 역할 정원 1 시드(롤백 트랜잭션 안).
2. 같은 (FIXED_SCHEDULE, NEGOTIABLE, dealer) 슬롯에 2번째 확정 시도 → **`MAX_CAPACITY_REACHED` RAISE** 확인 (RED→GREEN: 재정의 전엔 통과, 후엔 거부).
3. fixed 확정 1회 → work_logs 1행(`date='FIXED_SCHEDULE'`, `is_fixed_posting=true`) 생성 확인.
4. fixed 취소 → work_logs DELETE + filled_positions -1 확인.
5. **dated 회귀 없음**: 기존 dated 확정/취소/정원가드 시나리오 동일 동작(현행 본문 대비 diff 가 dated 경로를 안 건드리는지).
6. 멱등/정합: 재정의 두 번 적용 동일.

### 5.2 단위(Jest)

- `executeConfirmWithHistory`: fixed 확정 시 `p_is_fixed_posting` 미전달 + flatAssignments 형태 확인(mock supabase.rpc).
- `validateConfirmCapacity`: 시그니처 정리 후 fixed/dated 동일 경로.
- `executeReviewCancellation`: fixed 취소가 더는 throw 하지 않고 RPC 호출.
- 기존 confirm/cancel 테스트 회귀 갱신.

### 5.3 게이트

- `npm run quality` (tsc + eslint + prettier) exit 0.
- `npm test` 전체 PASS.

---

## 6. 리스크 / 완화

- **R1 — RPC 재정의 회귀** (blurhash 누락 / filled_positions 이중증가 / dated 경로 손상). → 현행 prod 본문 `pg_get_functiondef` diff 필수, dated 경로 라인 보존, §5.1 동적 검증.
- **R2 — fixed 키 불일치 잔존** (date/slot 마커 미정합 시 H1 여전히 vacuous → overfill 미차단인데 "고쳤다" 오인). → §5.1 step 2 가 RED(재정의 전 통과)→GREEN(후 거부) 를 반드시 증명. 단일 PASS 금지.
- **R3 — fixed assignment 마커 실측 불일치** (dates 가 `['FIXED_SCHEDULE']` 아닐 가능성). → Task 0 에서 `AssignmentSelector`/`buildCanonicalFixedAssignment` 코드 실측 선행.
- **R4 — RPC 시그니처 오버로드 충돌** (`p_is_fixed_posting` 제거 시 구/신 시그니처 공존). → 구 시그니처 `DROP FUNCTION` 명시.
- **R5 — fixed 취소 활성화 부작용** (cancel RPC 가 fixed 가정 위반). → cancel 본문이 fixed-무관(work_logs+filled_positions+history)임을 §4.2 확인 + §5.1 step 4 검증.

---

## 7. 관련 메모리

- `project_schedule_schema_unification_sp1` — SP1 결과 + 3-SP 로드맵 + 마커 규약.
- `pitfall_posting_role_filled_dead_counter` — 원증상(overfill + 0/N) + 현행 RPC 본문 회귀 함정 2건(blurhash/이중증가).
- `pitfall_toast_confirm_behind_native_modal` — FIXED/TBA 시간 키 정합 규칙.
- `feedback_supabase_migration_workflow` — MCP apply_migration 전용.
- `feedback_subagent_dispatch_guards` — MCP 는 메인만, 서브에이전트 금지.
