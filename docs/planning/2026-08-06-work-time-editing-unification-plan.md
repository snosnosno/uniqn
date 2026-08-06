# 근무 시간 편집 통일 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (권장) 또는 superpowers:executing-plans 로 task 단위 구현. 각 스텝은 체크박스(`- [ ]`)로 추적한다.

**Goal:** 같은 사람의 같은 하루를 근무표·공고 스태프관리·정산 탭 **어디서 열든 같은 시트에서 같은 규칙으로** 수정하게 하고, 출근 예정이 실제 출근으로 몰래 저장되던 결함을 없앤다.

**Architecture:** 클라 편집기 3개가 갈라져 쓰던 시간·역할·색·메모를 공용 시트 하나로 모으고, 서버는 `update_work_log_slot` RPC 하나가 예정·실적·역할·색·메모를 한 트랜잭션으로 처리한다. 실적 쓰기 2경로(직접 UPDATE)가 RPC로 이관되면서 시간모델 R4(직접 UPDATE REVOKE)의 선행 조건이 함께 해소된다.

**Tech Stack:** Expo 55 / RN 0.83.6 / React 19.2 / TS strict / NativeWind 4.2 / Supabase(PostgreSQL + PL/pgSQL RPC) / TanStack Query / Jest / pgTAP

**설계 정본:** `docs/planning/2026-08-06-work-time-editing-unification-design.md` — 본 계획의 모든 §참조는 이 문서를 가리킨다.

---

## Global Constraints

- **언어**: 모든 응답·커밋 메시지·문서·코드 주석은 **한글**. 코드 식별자·라이브러리명만 원문.
- **커밋 형식**: `<type>(<scope>): <한글 설명>` — feat/fix/refactor/style/docs/test/chore/perf
- **아키텍처 경유**: Presentation → Hooks → Service → Repository → Supabase. Presentation/Hooks에서 Supabase 직접 호출 금지. TanStack Query 읽기 전용 조회만 Repository 직접 호출 허용.
- **필드명**: camelCase (DB는 snake_case, Repository 경계에서 투영)
- **다크모드**: 모든 색상 클래스에 `dark:` 쌍 필수
- **알림**: `toast.success()` / 확인=`confirmAction()` / 안내=`showAlert()`. `Alert.alert()` 직접 호출 금지
- **로깅**: `logger.info()` — `console.log()` 금지
- **경로**: `@/` 절대 경로. 시스템 절대 경로 금지
- **파일 크기**: 800줄 상한. 400줄 넘으면 분리 검토
- **마이그레이션 적용**: Supabase **MCP `apply_migration` 전용**. `supabase db push` 금지. 기존 마이그레이션 파일 수정 금지
- **마이그레이션 형식**: 함수 재정의는 **`CREATE OR REPLACE`만** — `DROP` 하면 `20260731090000`이 회수한 PUBLIC EXECUTE가 되살아난다. `SET search_path TO 'public', 'extensions', 'pg_temp'` 를 반드시 명시(`pg_temp` 누락 시 `parity_baseline_guard.test.sql:134` red)
- **work_logs 읽기**: 취소 필터 필수 — `AND wl.status NOT IN ('cancelled', 'no_show')`
- **XSS**: 사용자 입력에 `z.string().refine(xssValidation)`
- **워크트리**: 구현 세션은 전용 git worktree에서. `node_modules`는 `mklink /J`로 정션
- **e2e 사각지대**: `eslint.config.js` ignores에 `e2e/`가 있어 `npm run quality` 범위 밖이다. 상수·문구 변경 시 `e2e/` **별도 Grep 필수**

### 검증 명령

| 목적 | 명령 |
|---|---|
| 유닛 테스트 | `npm test -- <경로>` |
| pgTAP | `npm run db:start` → `npm run test:db` |
| 타입 | `npm run type-check` |
| 전체 품질 | `npm run quality` |

---

## File Structure

### 신규 — 서버

| 파일 | 책임 |
|---|---|
| `supabase/migrations/20260806120000_notify_merge_time_change.sql` | 알림 트리거 — 한 UPDATE가 예정+실적을 함께 바꾸면 1통으로 합침 |
| `supabase/migrations/20260806130000_venue_day_slots_attendance.sql` | 읽기 RPC — `get_venue_day_slots` 반환에 출퇴근·정산상태·날짜 추가 |
| `supabase/migrations/20260806140000_work_log_slot_attendance.sql` | 쓰기 RPC — `update_work_log_slot`에 실적·상태 파생·역할 이력·`custom_role` 흡수 |
| `supabase/tests/notify_time_change_merge.test.sql` | 알림 병합 pgTAP |
| `supabase/tests/work_log_slot_attendance_rpc.test.sql` | 실적 이관 pgTAP |

### 신규 — 클라

| 파일 | 책임 |
|---|---|
| `src/components/workLogEdit/CollapsibleSection.tsx` | 접힘 섹션 + 한 줄 요약(D6) |
| `src/components/workLogEdit/WorkTimeFields.tsx` | 예정/출근/퇴근 3필드 + [예정대로 기록] + 상태 배지 |
| `src/components/workLogEdit/SlotRoleChips.tsx` | 역할 칩(마감 표기, 선택은 허용 — D7) |
| `src/components/workLogEdit/SlotColorChips.tsx` | 구분 색 팔레트 |
| `src/components/workLogEdit/WorkLogEditSheet.tsx` | 조립 + dirty 축만 전송 + 정산완료 읽기전용 |
| `src/components/workLogEdit/workLogEditPayload.ts` | dirty 판정 → RPC 패치 변환(순수 함수) |
| `src/components/workLogEdit/index.ts` | 배럴 |

### 수정

| 파일 | 변경 |
|---|---|
| `src/repositories/interfaces/IWorkScheduleRepository.ts` | `VenueDaySlot`에 `checkInTs`/`checkOutTs`/`payrollStatus`/`date` 추가 |
| `src/repositories/supabase/WorkScheduleRepository.ts` | 신규 필드 투영 |
| `src/repositories/supabase/WorkLogRepositoryVenue.ts` | `UpdateSlotInput`에 `checkIn`/`checkOut`/`reason` 추가 |
| `src/repositories/supabase/ConfirmedStaffRepository.ts:373-452` | `updateWorkTimeWithTransaction` → RPC 위임 |
| `src/repositories/supabase/SettlementRepository.ts:301` | 동상 |
| `src/components/workSchedule/VenueDayPanel.tsx` | `EditSlotSheet`+`WorkTimeEditor` → `WorkLogEditSheet`. `isContainer` 게이트 제거, 빼기를 카드 액션으로 |
| `src/components/employer/applicants/StaffManagementTab.tsx` | `WorkTimeEditor` → `WorkLogEditSheet`. `onShowRoleChange` 제거 |
| `src/features/employer/settlements/SettlementModals.tsx` | 동상. `RoleChangeModal` 제거 |

### 삭제

- `src/components/employer/settlement/WorkTimeEditor.tsx` (→ `WorkLogEditSheet`가 대체)
- `src/components/workSchedule/EditSlotSheet.tsx` (동상)
- `src/components/employer/applicants/RoleChangeModal.tsx` (역할이 시트로 흡수)

---

## Task 1: 알림 병합 — 한 번의 저장 = 한 통

**Files:**
- Create: `supabase/migrations/20260806120000_notify_merge_time_change.sql`
- Create: `supabase/tests/notify_time_change_merge.test.sql`

**Interfaces:**
- Consumes: 없음 (첫 태스크)
- Produces: `notify_on_work_log_update()` 재정의 — Case 2(실적)와 Case 2-B(예정)가 같은 UPDATE에서 동시 성립하면 **Case 2 한 통에 예정 변경 문구를 덧붙이고 Case 2-B는 건너뛴다**

**배경 (실측 확인됨):** `20260802093000_...sql`의 Case 2(129행, `modification_history` 길이 증가)와 Case 2-B(197행, `time_slot IS DISTINCT FROM`)는 **독립 IF 블록**이고 사이에 early return이 없다(`RETURN NEW`는 404행). Task 3 이후 한 RPC가 둘을 함께 바꾸므로 스태프에게 알림 2통이 간다.

- [ ] **Step 1: 현재 prod 함수 본문을 실측해 재정의 베이스를 확정**

```bash
# MCP execute_sql 로 실행 (Bash 아님)
# SELECT md5(replace(pg_get_functiondef(oid), chr(13), '')), length(prosrc)
# FROM pg_proc WHERE proname = 'notify_on_work_log_update';
```

레포의 `20260802093000_...sql` 본문 md5와 대조한다. **`chr(13)` 제거 없이 비교하면 CRLF 때문에 전부 가짜 불일치로 보인다.** 불일치하면 prod에 나중 하드닝이 얹힌 것이므로 중단하고 보고.

- [ ] **Step 2: 실패하는 pgTAP 테스트 작성**

`supabase/tests/notify_time_change_merge.test.sql`:

```sql
-- ============================================================
-- notify_on_work_log_update — 예정+실적 동시 변경 시 알림 1통
--
-- 마이그레이션: 20260806120000_notify_merge_time_change.sql
--
-- 무엇을 지키는 테스트인가:
--   Case 2(실적 이력)와 Case 2-B(time_slot 컬럼)는 독립 IF 라, 통합 편집 RPC 가
--   둘을 한 UPDATE 로 바꾸면 스태프 폰에 2통이 간다. 병합 가드를 빼면 3번이 red.
-- ============================================================
BEGIN;
SELECT plan(4);

DO $$
DECLARE s RECORD;
BEGIN
  SELECT * INTO s FROM jpc_test_seed();
  PERFORM set_config('nm.owner_id', s.owner_id::text,       true);
  PERFORM set_config('nm.jp_id',    s.job_posting_id::text, true);
  PERFORM set_config('nm.staff_id', s.collaborator_id::text, true);
END $$;

-- 대상 work_log 1건 준비 (예정 18:00, 실적 없음)
DO $$
DECLARE v_id uuid;
BEGIN
  INSERT INTO public.work_logs (job_posting_id, staff_id, owner_id, date, time_slot, status, role)
  VALUES (
    current_setting('nm.jp_id')::uuid,
    current_setting('nm.staff_id')::uuid,
    current_setting('nm.owner_id')::uuid,
    '2026-08-10', '18:00', 'scheduled', 'dealer'
  ) RETURNING id INTO v_id;
  PERFORM set_config('nm.wl_id', v_id::text, true);
  DELETE FROM public.notifications WHERE recipient_id = current_setting('nm.staff_id')::uuid;
END $$;

-- 1) 예정만 변경 → 1통
DO $$
BEGIN
  UPDATE public.work_logs SET time_slot = '19:00'
  WHERE id = current_setting('nm.wl_id')::uuid;
END $$;

SELECT is(
  (SELECT count(*)::int FROM public.notifications
   WHERE recipient_id = current_setting('nm.staff_id')::uuid),
  1,
  '예정만 변경하면 알림 1통'
);

-- 2) 실적만 변경 → 1통 추가
DO $$
BEGIN
  DELETE FROM public.notifications WHERE recipient_id = current_setting('nm.staff_id')::uuid;
  UPDATE public.work_logs
  SET check_in_ts = '2026-08-10T10:00:00Z',
      status = 'checked_in',
      modification_history = '[{"reason":"테스트"}]'::jsonb
  WHERE id = current_setting('nm.wl_id')::uuid;
END $$;

SELECT is(
  (SELECT count(*)::int FROM public.notifications
   WHERE recipient_id = current_setting('nm.staff_id')::uuid),
  1,
  '실적만 변경하면 알림 1통'
);

-- 3) 🔴 핵심 — 예정+실적 동시 변경 → 여전히 1통
DO $$
BEGIN
  DELETE FROM public.notifications WHERE recipient_id = current_setting('nm.staff_id')::uuid;
  UPDATE public.work_logs
  SET time_slot = '20:00',
      check_in_ts = '2026-08-10T11:00:00Z',
      modification_history = '[{"reason":"테스트"},{"reason":"테스트2"}]'::jsonb
  WHERE id = current_setting('nm.wl_id')::uuid;
END $$;

SELECT is(
  (SELECT count(*)::int FROM public.notifications
   WHERE recipient_id = current_setting('nm.staff_id')::uuid),
  1,
  '예정+실적을 한 번에 바꿔도 알림은 1통 (병합 가드)'
);

-- 4) 그 1통의 본문에 예정 변경이 담겨 있다
SELECT ok(
  (SELECT body LIKE '%20:00%' FROM public.notifications
   WHERE recipient_id = current_setting('nm.staff_id')::uuid LIMIT 1),
  '병합된 알림 본문에 바뀐 출근 예정 시각이 담긴다'
);

SELECT * FROM finish();
ROLLBACK;
```

- [ ] **Step 3: 테스트가 실패하는지 확인 (RED)**

```bash
cd uniqn-mobile && npm run db:start && npm run test:db
```

기대: 3번·4번 FAIL (현재는 2통이 발송되고 병합 본문이 없음)

- [ ] **Step 4: 마이그레이션 작성**

`supabase/migrations/20260806120000_notify_merge_time_change.sql` — `20260802093000_...sql`의 함수 본문 전체를 복사한 뒤 **두 곳만** 고친다.

(가) Case 2 본문 조립부, `v_time_change_parts` 를 쓰는 자리 **직후**에 예정 변경 문구를 덧붙인다:

```sql
  -- [병합] 같은 UPDATE 에서 출근 예정 시각도 바뀌었으면 이 한 통에 함께 싣는다.
  --        (아래 Case 2-B 는 그때 건너뛴다 — 스태프 폰에 2통이 가지 않게)
  IF OLD.time_slot IS DISTINCT FROM NEW.time_slot THEN
    v_time_change_parts := v_time_change_parts || ARRAY[
      format('출근 예정 %s → %s',
        CASE WHEN OLD.time_slot IS NULL OR OLD.time_slot = '' THEN '미정' ELSE OLD.time_slot END,
        CASE WHEN NEW.time_slot IS NULL OR NEW.time_slot = '' THEN '미정' ELSE NEW.time_slot END)
    ];
  END IF;
```

(나) Case 2-B 의 IF 조건에 **가드 한 줄** 추가 (기존 조건은 그대로 유지):

```sql
  IF OLD.time_slot IS DISTINCT FROM NEW.time_slot
     AND NEW.status <> 'cancelled'
     -- [병합] Case 2 가 이미 발송했으면 중복 발송하지 않는다.
     AND v_modification_count_after <= v_modification_count_before THEN
```

⚠️ 함수 헤더는 **반드시** 아래 그대로 유지한다(파리티 가드):

```sql
CREATE OR REPLACE FUNCTION public.notify_on_work_log_update() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'extensions', 'pg_temp'
    AS $$
```

- [ ] **Step 5: MCP `apply_migration` 으로 적용 후 테스트 통과 확인 (GREEN)**

```bash
cd uniqn-mobile && npm run test:db
```

기대: 4/4 PASS. 로컬 green 후에만 prod 적용을 논한다.

- [ ] **Step 6: 커밋**

```bash
git add supabase/migrations/20260806120000_notify_merge_time_change.sql supabase/tests/notify_time_change_merge.test.sql
git commit -m "fix(db): 예정+실적 동시 변경 시 알림 2통을 1통으로 병합

Case 2(실적 이력)와 Case 2-B(time_slot 컬럼)가 독립 IF 라 통합 편집 RPC 가
둘을 한 UPDATE 로 바꾸면 스태프에게 2통이 갔다. Case 2 본문에 예정 변경을
덧붙이고 Case 2-B 에 중복 발송 가드를 넣는다."
```

---

## Task 2: 읽기 RPC 확장 — 근무표가 실적을 알게 한다

**Files:**
- Create: `supabase/migrations/20260806130000_venue_day_slots_attendance.sql`
- Modify: `src/repositories/interfaces/IWorkScheduleRepository.ts:11-27`
- Modify: `src/repositories/supabase/WorkScheduleRepository.ts`
- Test: `src/repositories/supabase/__tests__/WorkScheduleRepository.test.ts`

**Interfaces:**
- Consumes: 없음 (Task 1과 독립)
- Produces: `VenueDaySlot` 에 4개 필드 추가 —
  ```ts
  checkInTs: string | null;      // ISO timestamptz
  checkOutTs: string | null;
  payrollStatus: string | null;
  date: string;                  // YYYY-MM-DD
  ```
  Task 8의 `VenueDayPanel` 이 이 값으로 시트를 프리필한다.

**배경:** `VenueDaySlot`에 출퇴근·정산상태·날짜가 없어서 `VenueDayPanel`이 `useConfirmedStaff(venueId)`로 컨테이너 직속만 따로 해소하고 있다. `isContainer` 게이트는 그 **결과**다(설계 §5-1).

- [ ] **Step 1: 현재 함수 정의 실측**

MCP `execute_sql`:
```sql
SELECT pg_get_functiondef(oid) FROM pg_proc WHERE proname = 'get_venue_day_slots';
```

⚠️ 레포에는 `archive/` 아래 두 버전만 있다. **prod 정의가 진실원**이므로 여기서 얻은 본문을 베이스로 삼는다.

- [ ] **Step 2: 실패하는 레포 테스트 작성**

`src/repositories/supabase/__tests__/WorkScheduleRepository.test.ts` 에 추가:

```typescript
it('RPC 응답의 출퇴근·정산상태·날짜를 camelCase 로 투영한다', async () => {
  mockRpc.mockResolvedValueOnce({
    data: [
      {
        work_log_id: 'wl-1',
        staff_id: 'st-1',
        staff_name: '홍길동',
        staff_nickname: null,
        staff_photo_url: null,
        role: 'dealer',
        custom_role: null,
        time_slot: '18:00',
        status: 'checked_in',
        job_posting_id: 'jp-1',
        is_container: true,
        color: null,
        notes: null,
        check_in_ts: '2026-08-10T09:00:00+00:00',
        check_out_ts: null,
        payroll_status: 'pending',
        date: '2026-08-10',
      },
    ],
    error: null,
  });

  const rows = await repository.getVenueDaySlots('venue-1', '2026-08-10');

  expect(rows[0].checkInTs).toBe('2026-08-10T09:00:00+00:00');
  expect(rows[0].checkOutTs).toBeNull();
  expect(rows[0].payrollStatus).toBe('pending');
  expect(rows[0].date).toBe('2026-08-10');
});
```

- [ ] **Step 3: 테스트 실패 확인 (RED)**

```bash
cd uniqn-mobile && npm test -- src/repositories/supabase/__tests__/WorkScheduleRepository.test.ts
```

기대: FAIL — `checkInTs` 가 `undefined`

- [ ] **Step 4: 마이그레이션 작성**

`supabase/migrations/20260806130000_venue_day_slots_attendance.sql` — Step 1에서 얻은 정의를 베이스로 `RETURNS TABLE` 에 4열을 **끝에 추가**하고 SELECT 에 컬럼을 더한다. 기존 열의 **순서·이름은 절대 바꾸지 않는다**(구클라가 위치로 읽는다).

```sql
-- 반환 열 추가(끝에만) — 구클라 하위호환
--   check_in_ts / check_out_ts / payroll_status / date
--
-- ⚠️ 기존 열 순서·이름 변경 금지. 구클라는 신규 열을 무시한다.
CREATE OR REPLACE FUNCTION public.get_venue_day_slots(...)
RETURNS TABLE (
  -- ... 기존 열 그대로 ...
  check_in_ts    timestamptz,
  check_out_ts   timestamptz,
  payroll_status text,
  date           text
)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'extensions', 'pg_temp'
AS $$
...
    wl.check_in_ts,
    wl.check_out_ts,
    wl.payroll_status,
    wl.date
  FROM public.work_logs wl
  WHERE ...
    AND wl.status NOT IN ('cancelled', 'no_show')   -- 소프트 취소 필터(필수)
...
$$;
```

- [ ] **Step 5: 타입·투영 반영**

`IWorkScheduleRepository.ts` 의 `VenueDaySlot` 인터페이스 끝에:

```typescript
  /** 실제 출근 시각(ISO timestamptz). 미기록이면 null. */
  checkInTs: string | null;
  /** 실제 퇴근 시각(ISO timestamptz). 미기록이면 null. */
  checkOutTs: string | null;
  /** 정산 상태 — 'completed' 면 시트가 읽기 전용으로 열린다. */
  payrollStatus: string | null;
  /** YYYY-MM-DD. 시트가 시각을 Date 로 조립할 때 기준 날짜. */
  date: string;
```

`WorkScheduleRepository.ts` 의 투영 매핑에 4줄 추가.

- [ ] **Step 6: 테스트 통과 확인 (GREEN)**

```bash
cd uniqn-mobile && npm test -- src/repositories/supabase/__tests__/WorkScheduleRepository.test.ts && npm run type-check
```

- [ ] **Step 7: 커밋**

```bash
git add supabase/migrations/20260806130000_venue_day_slots_attendance.sql src/repositories/
git commit -m "feat(db): 근무표 슬롯 조회에 출퇴근·정산상태·날짜 추가

VenueDaySlot 에 실적이 없어 근무표가 컨테이너 직속만 따로 해소하고 있었다.
공고 스팬 슬롯에서도 실적을 편집하려면 읽기 RPC 가 값을 실어 와야 한다."
```

---

## Task 3: 쓰기 RPC 확장 — 실적·상태·역할 이력을 한 트랜잭션으로

**Files:**
- Create: `supabase/migrations/20260806140000_work_log_slot_attendance.sql`
- Create: `supabase/tests/work_log_slot_attendance_rpc.test.sql`

**Interfaces:**
- Consumes: Task 1의 병합된 알림 트리거
- Produces: `update_work_log_slot(p_work_log_id uuid, p_patch jsonb)` 가 아래 키를 추가로 받는다 —
  ```
  checkIn   : string(ISO) | null    // null = 삭제, 키 없음 = 미변경
  checkOut  : string(ISO) | null
  reason    : string                // 수정 사유(modification_history 에 append)
  ```
  Task 4의 Repository가 이 계약으로 호출한다.

**배경:** 실적 쓰기가 지금 `ConfirmedStaffRepository.ts:444`·`SettlementRepository.ts:301` 두 곳의 직접 UPDATE다. 예정=RPC / 실적=직접 UPDATE면 통합 시트의 한 번 저장이 **두 번 호출**이 되어 부분 실패가 생긴다.

- [ ] **Step 1: 실패하는 pgTAP 테스트 작성**

`supabase/tests/work_log_slot_attendance_rpc.test.sql`:

```sql
-- ============================================================
-- update_work_log_slot — 실적(checkIn/checkOut) 이관 + 상태 파생 + 역할 이력
--
-- 마이그레이션: 20260806140000_work_log_slot_attendance.sql
--
-- 무엇을 지키는 테스트인가:
--   실적 쓰기가 클라 직접 UPDATE 였다. RPC 로 옮기면서 상태 파생(SET-1 규칙)과
--   역할 이력(근무표 경로에 없던 것)을 서버 한 곳으로 모은다.
--
-- ⚠️ 42501 단독 단언 금지 — 권한 거부는 throws_like '%PERMISSION_DENIED%' 로 본다.
-- ⚠️ RPC 호출과 결과 조회를 한 SELECT 에 섞지 않는다(평가 순서 비보장).
-- ============================================================
BEGIN;
SELECT plan(8);

DO $$
DECLARE s RECORD; v_id uuid;
BEGIN
  SELECT * INTO s FROM jpc_test_seed();
  PERFORM set_config('wa.owner_id', s.owner_id::text,        true);
  PERFORM set_config('wa.out_id',   s.outsider_id::text,     true);
  PERFORM set_config('wa.jp_id',    s.job_posting_id::text,  true);

  INSERT INTO public.work_logs (job_posting_id, staff_id, owner_id, date, time_slot, status, role)
  VALUES (s.job_posting_id, s.collaborator_id, s.owner_id, '2026-08-10', '18:00', 'scheduled', 'dealer')
  RETURNING id INTO v_id;
  PERFORM set_config('wa.wl_id', v_id::text, true);
END $$;

-- 1~2) 출근만 기록 → status='checked_in'
DO $$
BEGIN
  PERFORM jpc_test_set_user(current_setting('wa.owner_id')::uuid);
  PERFORM public.update_work_log_slot(
    current_setting('wa.wl_id')::uuid,
    jsonb_build_object('checkIn', '2026-08-10T09:00:00+00:00', 'reason', '테스트')
  );
END $$;

SELECT is((SELECT status FROM public.work_logs WHERE id = current_setting('wa.wl_id')::uuid),
          'checked_in', '출근만 기록하면 status=checked_in');
SELECT isnt((SELECT check_in_ts FROM public.work_logs WHERE id = current_setting('wa.wl_id')::uuid),
            NULL, 'check_in_ts 가 기록된다');

-- 3) 퇴근까지 → status='checked_out'
DO $$
BEGIN
  PERFORM public.update_work_log_slot(
    current_setting('wa.wl_id')::uuid,
    jsonb_build_object('checkOut', '2026-08-10T18:00:00+00:00', 'reason', '테스트')
  );
END $$;

SELECT is((SELECT status FROM public.work_logs WHERE id = current_setting('wa.wl_id')::uuid),
          'checked_out', '퇴근까지 기록하면 status=checked_out');

-- 4) 🔴 출근 삭제(JSON null) → status='scheduled' 로 강등
DO $$
BEGIN
  PERFORM public.update_work_log_slot(
    current_setting('wa.wl_id')::uuid,
    jsonb_build_object('checkIn', NULL, 'checkOut', NULL, 'reason', '오기록 정정')
  );
END $$;

SELECT is((SELECT status FROM public.work_logs WHERE id = current_setting('wa.wl_id')::uuid),
          'scheduled', '시각을 지우면 status 가 scheduled 로 강등된다(23514 방지)');

-- 5) 예정만 바꿔도 status 는 그대로 (D1 — 예정은 상태를 건드리지 않는다)
DO $$
BEGIN
  PERFORM public.update_work_log_slot(
    current_setting('wa.wl_id')::uuid,
    jsonb_build_object('startTime', '19:00')
  );
END $$;

SELECT is((SELECT status FROM public.work_logs WHERE id = current_setting('wa.wl_id')::uuid),
          'scheduled', '🔴 출근 예정만 바꾸면 근태 상태는 바뀌지 않는다');

-- 6) 수정 사유가 modification_history 에 남는다
SELECT ok(
  (SELECT jsonb_array_length(COALESCE(modification_history, '[]'::jsonb)) > 0
   FROM public.work_logs WHERE id = current_setting('wa.wl_id')::uuid),
  '수정 사유가 modification_history 에 append 된다'
);

-- 7) 역할 변경이 role_change_history 에 남는다 (근무표 경로에 없던 것)
DO $$
BEGIN
  PERFORM public.update_work_log_slot(
    current_setting('wa.wl_id')::uuid,
    jsonb_build_object('staffRole', 'floor')
  );
END $$;

SELECT ok(
  (SELECT jsonb_array_length(COALESCE(role_change_history, '[]'::jsonb)) > 0
   FROM public.work_logs WHERE id = current_setting('wa.wl_id')::uuid),
  '역할 변경이 role_change_history 에 append 된다'
);

-- 8) 권한 없는 사용자는 거부
SELECT throws_like($$
  SELECT public.update_work_log_slot(
    current_setting('wa.wl_id')::uuid,
    jsonb_build_object('checkIn', '2026-08-10T09:00:00+00:00')
  )
$$, '%PERMISSION_DENIED%', '공고 소유자가 아니면 거부된다');

SELECT * FROM finish();
ROLLBACK;
```

⚠️ 8번 실행 전 `jpc_test_set_user(current_setting('wa.out_id')::uuid)` 를 DO 블록으로 먼저 호출한다.

- [ ] **Step 2: 테스트 실패 확인 (RED)**

```bash
cd uniqn-mobile && npm run test:db
```

기대: 1~7 FAIL (`checkIn` 은 현재 허용 키가 아니라 `INVALID_PATCH_KEY` 로 거부됨)

- [ ] **Step 3: 마이그레이션 작성 — 허용 키 확장**

`20260802180000_update_work_log_slot_rpc.sql` 본문을 복사해 아래를 추가한다.

(가) 허용 키 집합(126행 부근 `jsonb_object_keys` 검사)에 `checkIn`·`checkOut`·`reason` 추가.

(나) 파싱 — **키 존재는 `?`, 값 타입은 `jsonb_typeof` 로 따로 본다**(기존 계약과 동일):

```sql
  -- 실적 출근. 키 없음=미변경 / JSON null=삭제 / 문자열=기록
  IF p_patch ? 'checkIn' THEN
    v_set_check_in := true;
    IF jsonb_typeof(p_patch->'checkIn') = 'null' THEN
      v_new_check_in := NULL;
    ELSIF jsonb_typeof(p_patch->'checkIn') = 'string' THEN
      v_new_check_in := (p_patch->>'checkIn')::timestamptz;
    ELSE
      RAISE EXCEPTION 'INVALID_PATCH_TYPE: checkIn';
    END IF;
  END IF;
  -- checkOut 도 동일 패턴
```

(다) 상태 파생 — 클라 `resolveWorkTimeStatus` 규칙을 그대로 옮긴다:

```sql
  -- 근태 생애주기 상태에서만 파생한다. no_show·cancelled 는 건드리지 않는다 —
  -- 시간 수정이 노쇼를 조용히 checked_out 으로 뒤집으면 없던 유급 근무가 생긴다.
  IF v_wl.status IN ('scheduled', 'checked_in', 'checked_out', 'completed') THEN
    v_final_check_in  := CASE WHEN v_set_check_in  THEN v_new_check_in  ELSE v_wl.check_in_ts  END;
    v_final_check_out := CASE WHEN v_set_check_out THEN v_new_check_out ELSE v_wl.check_out_ts END;

    v_new_status := CASE
      WHEN v_final_check_in IS NOT NULL AND v_final_check_out IS NOT NULL
        THEN CASE WHEN v_wl.status = 'completed' THEN v_wl.status ELSE 'checked_out' END
      WHEN v_final_check_in IS NOT NULL THEN 'checked_in'
      ELSE 'scheduled'
    END;
  ELSE
    v_new_status := v_wl.status;
  END IF;
```

(라) 이력 append — **같은 `FOR UPDATE` 잠금 안에서** 읽고 쓴다(Lost Update 방지):

```sql
  -- ⚠️ v_wl 은 227행에서 이미 FOR UPDATE 로 잠갔다. 그 스냅샷에서 append 한다 —
  --    다시 SELECT 하면 잠금 밖 읽기가 되어 Lost Update 경로가 열린다.
  IF v_set_check_in OR v_set_check_out THEN
    v_new_mod_history := COALESCE(v_wl.modification_history, '[]'::jsonb) || jsonb_build_object(
      'previousStartTime', v_wl.check_in_ts,
      'previousEndTime',   v_wl.check_out_ts,
      'newStartTime',      v_final_check_in,
      'newEndTime',        v_final_check_out,
      'reason',            COALESCE(p_patch->>'reason', ''),
      'modifiedBy',        auth.uid(),
      'modifiedAt',        now()
    );
  END IF;
```

(마) 역할 이력 + `custom_role` 정리:

```sql
  IF v_set_role AND v_new_role IS DISTINCT FROM v_wl.role THEN
    v_new_role_history := COALESCE(v_wl.role_change_history, '[]'::jsonb) || jsonb_build_object(
      'previousRole', v_wl.role, 'newRole', v_new_role,
      'reason', COALESCE(p_patch->>'reason', ''),
      'changedBy', auth.uid(), 'changedAt', now()
    );
    -- 표준 역할로 바꾸면 옛 커스텀 역할명을 지운다 — 남기면 유령으로 되살아난다.
    v_clear_custom_role := true;
  END IF;
```

(바) 최종 UPDATE 에 신규 컬럼 추가. `check_out_ts` 를 쓸 때는 **출처를 사람으로 되돌린다**:

```sql
    check_in_ts   = CASE WHEN v_set_check_in  THEN v_new_check_in  ELSE check_in_ts  END,
    check_out_ts  = CASE WHEN v_set_check_out THEN v_new_check_out ELSE check_out_ts END,
    end_time_source = CASE WHEN v_set_check_out THEN 'manual' ELSE end_time_source END,
    custom_role   = CASE WHEN v_clear_custom_role THEN NULL ELSE custom_role END,
    status        = v_new_status,
    modification_history  = COALESCE(v_new_mod_history,  modification_history),
    role_change_history   = COALESCE(v_new_role_history, role_change_history),
    has_time_modification_logs = CASE WHEN v_set_check_in OR v_set_check_out
                                      THEN true ELSE has_time_modification_logs END,
```

⚠️ **정원 거부는 넣지 않는다**(D7). 결함 ④는 의도된 동작으로 재분류됐다.
⚠️ **정산 완료 잠금은 유지한다** — 기존 `payroll_status = 'completed'` 거부 로직을 실적 키에도 적용.

- [ ] **Step 4: MCP `apply_migration` 적용 후 GREEN 확인**

```bash
cd uniqn-mobile && npm run test:db
```

기대: 8/8 PASS

- [ ] **Step 5: 기존 pgTAP 회귀 확인**

```bash
cd uniqn-mobile && npm run test:db 2>&1 | tail -40
```

기대: `work_log_slot_sync_rpc.test.sql`(27) 포함 **전체 스위트 green**. 하나라도 red면 하위호환이 깨진 것이므로 중단.

- [ ] **Step 6: 커밋**

```bash
git add supabase/migrations/20260806140000_work_log_slot_attendance.sql supabase/tests/work_log_slot_attendance_rpc.test.sql
git commit -m "feat(db): update_work_log_slot 에 실적·상태 파생·역할 이력 흡수

실적 쓰기가 클라 직접 UPDATE 2곳이라 통합 시트의 한 번 저장이 두 번 호출이
됐다. checkIn/checkOut/reason 키를 추가해 한 트랜잭션으로 모은다.
근무표 역할 변경에 없던 role_change_history·custom_role 정리도 함께 흡수.
정원 거부는 넣지 않는다(D7)."
```

---

## Task 4: Repository 계층 — 실적 쓰기를 RPC로 위임

**Files:**
- Modify: `src/repositories/supabase/WorkLogRepositoryVenue.ts` (`UpdateSlotInput` 확장)
- Modify: `src/repositories/supabase/ConfirmedStaffRepository.ts:373-452`
- Modify: `src/repositories/supabase/SettlementRepository.ts:301`
- Test: `src/repositories/supabase/__tests__/WorkLogRepositoryVenue.updateSlot.test.ts`

**Interfaces:**
- Consumes: Task 3의 RPC 계약(`checkIn`/`checkOut`/`reason`)
- Produces:
  ```ts
  interface UpdateSlotInput {
    startTime?: string;
    timeUndecided?: boolean;
    staffRole?: StaffRole;
    color?: string;
    memo?: string;
    editedBy?: string;
    checkIn?: Date | null;    // 신규 — undefined=미변경, null=삭제
    checkOut?: Date | null;   // 신규
    reason?: string;          // 신규
  }
  ```
  Task 7의 `WorkLogEditSheet` 가 이 타입으로 저장한다.

- [ ] **Step 1: 실패하는 테스트 작성**

`src/repositories/supabase/__tests__/WorkLogRepositoryVenue.updateSlot.test.ts` 에 추가:

```typescript
it('checkIn 을 ISO 문자열로 패치에 실어 보낸다', async () => {
  mockRpc.mockResolvedValueOnce({ data: {}, error: null });

  await repository.updateSlot('wl-1', { checkIn: new Date('2026-08-10T09:00:00Z') });

  expect(mockRpc).toHaveBeenCalledWith('update_work_log_slot', {
    p_work_log_id: 'wl-1',
    p_patch: { checkIn: '2026-08-10T09:00:00.000Z' },
  });
});

it('checkIn: null 은 JSON null 로 보내 삭제를 표현한다', async () => {
  mockRpc.mockResolvedValueOnce({ data: {}, error: null });

  await repository.updateSlot('wl-1', { checkIn: null });

  expect(mockRpc).toHaveBeenCalledWith('update_work_log_slot', {
    p_work_log_id: 'wl-1',
    p_patch: { checkIn: null },
  });
});

it('checkIn 을 주지 않으면 패치에 키 자체가 없다 (미변경)', async () => {
  mockRpc.mockResolvedValueOnce({ data: {}, error: null });

  await repository.updateSlot('wl-1', { memo: '메모만' });

  const patch = mockRpc.mock.calls[0][1].p_patch;
  expect('checkIn' in patch).toBe(false);
});
```

- [ ] **Step 2: 테스트 실패 확인 (RED)**

```bash
cd uniqn-mobile && npm test -- src/repositories/supabase/__tests__/WorkLogRepositoryVenue.updateSlot.test.ts
```

- [ ] **Step 3: `UpdateSlotInput` 확장 + 패치 빌더 구현**

```typescript
  // 실적 3상 — undefined=키 없음(미변경) / null=JSON null(삭제) / Date=ISO 문자열
  // ⚠️ `if (input.checkIn)` 로 쓰면 null 삭제가 조용히 무시된다. `!== undefined` 로 본다.
  if (input.checkIn !== undefined) {
    patch.checkIn = input.checkIn ? input.checkIn.toISOString() : null;
  }
  if (input.checkOut !== undefined) {
    patch.checkOut = input.checkOut ? input.checkOut.toISOString() : null;
  }
  if (input.reason !== undefined) {
    patch.reason = input.reason;
  }
```

- [ ] **Step 4: 테스트 통과 확인 (GREEN)**

```bash
cd uniqn-mobile && npm test -- src/repositories/supabase/__tests__/WorkLogRepositoryVenue.updateSlot.test.ts
```

- [ ] **Step 5: 두 리포지토리를 RPC 위임으로 교체**

`ConfirmedStaffRepository.updateWorkTimeWithTransaction` 본문을 아래로 교체한다. 권한 검증·정산 잠금·이력 append는 **RPC가 담당하므로 클라에서 제거**한다:

```typescript
  async updateWorkTimeWithTransaction(context: UpdateConfirmedStaffWorkTimeContext): Promise<void> {
    try {
      logger.info('근무 시간 수정 시작', { workLogId: context.workLogId });

      // 권한·정산 잠금·상태 파생·이력 append 는 모두 RPC 안에서 끝난다
      // (update_work_log_slot, 20260806140000). 클라가 다단계로 흉내내지 않는다.
      await workLogRepositoryVenue.updateSlot(context.workLogId, {
        checkIn: context.checkInTime,
        checkOut: context.checkOutTime,
        reason: context.reason,
        editedBy: context.actorId,
      });

      logger.info('근무 시간 수정 완료', { workLogId: context.workLogId });
    } catch (error) {
      rethrowOrHandle(error, '근무 시간 수정', { workLogId: context.workLogId });
    }
  }
```

`SettlementRepository.updateWorkTimeWithTransaction` 도 동일 패턴으로 교체한다.

⚠️ `resolveWorkTimeStatus`(`workLogTimeStatus.ts`)는 **이 시점부터 소비자가 0이 된다.** 삭제하지 말고 `@deprecated` 주석을 달아 남긴다 — 서버 규칙과 대조하는 문서 가치가 있고, `knip` 래칫은 Task 9에서 함께 본다.

- [ ] **Step 6: 기존 테스트 회귀 확인**

```bash
cd uniqn-mobile && npm test -- src/repositories && npm run type-check
```

기대: 전부 PASS. `ConfirmedStaffRepository.statusTimestamp.test.ts`·`statusAudit.test.ts` 가 직접 UPDATE 를 단언한다면 **RPC 호출 단언으로 갱신**한다(계약이 바뀐 것이지 결함이 아니다).

- [ ] **Step 7: 커밋**

```bash
git add src/repositories/
git commit -m "refactor(repository): 실적 쓰기 2경로를 update_work_log_slot RPC 로 위임

ConfirmedStaffRepository·SettlementRepository 의 직접 UPDATE 를 RPC 호출로
바꾼다. 권한 검증·정산 잠금·상태 파생·이력 append 가 서버 한 곳으로 모여
경로별 어긋남이 구조적으로 불가능해진다. 시간모델 R4 선행 조건 해소."
```

---

## Task 5: `WorkTimeFields` — 예정 프리필 제거와 원탭 복사

**Files:**
- Create: `src/components/workLogEdit/WorkTimeFields.tsx`
- Test: `src/components/workLogEdit/__tests__/WorkTimeFields.test.tsx`

**Interfaces:**
- Consumes: 없음 (순수 프레젠테이션)
- Produces:
  ```ts
  interface WorkTimeFieldsValue {
    scheduledStart: string | null;   // 'HH:mm' | null(미정)
    scheduledUndecided: boolean;
    checkIn: Date | null;
    checkOut: Date | null;
  }
  interface WorkTimeFieldsProps {
    value: WorkTimeFieldsValue;
    baseDate: Date;                  // 시각 → Date 조립 기준
    onChange: (next: WorkTimeFieldsValue) => void;
    readOnly?: boolean;
  }
  ```
  Task 7의 `WorkLogEditSheet` 가 소비한다.

**배경(핵심 결함):** `WorkTimeEditor.tsx:114-121` 이 실제 출근이 없으면 예정 시각을 출근 칸에 프리필하고 `미정=false` 로 둔다. 그래서 퇴근만 고쳐도 예정 값이 `check_in_ts` 로 저장되고 상태가 뒤집힌다.

- [ ] **Step 1: 실패하는 테스트 작성**

```typescript
import { render, screen, fireEvent } from '@testing-library/react-native';
import { WorkTimeFields } from '../WorkTimeFields';

const BASE_DATE = new Date('2026-08-10T00:00:00+09:00');

describe('WorkTimeFields — 예정과 실적의 분리', () => {
  it('🔴 실제 출근이 없으면 출근 칸을 예정 시각으로 채우지 않는다', () => {
    render(
      <WorkTimeFields
        value={{ scheduledStart: '18:00', scheduledUndecided: false, checkIn: null, checkOut: null }}
        baseDate={BASE_DATE}
        onChange={jest.fn()}
      />
    );

    // 예정은 보이고
    expect(screen.getByText('18:00')).toBeTruthy();
    // 출근 칸은 비어 있다 — '18:00' 이 출근 자리에 복제되면 안 된다
    expect(screen.getByTestId('check-in-value')).toHaveTextContent('—');
  });

  it('[예정대로 기록] 을 누르면 출근이 예정 시각으로 채워진다', () => {
    const onChange = jest.fn();
    render(
      <WorkTimeFields
        value={{ scheduledStart: '18:00', scheduledUndecided: false, checkIn: null, checkOut: null }}
        baseDate={BASE_DATE}
        onChange={onChange}
      />
    );

    fireEvent.press(screen.getByLabelText('예정대로 출근 기록'));

    const next = onChange.mock.calls[0][0];
    expect(next.checkIn).not.toBeNull();
    expect(next.checkIn.getHours()).toBe(18);
    expect(next.checkIn.getMinutes()).toBe(0);
  });

  it('예정이 미정이면 [예정대로 기록] 버튼을 렌더하지 않는다', () => {
    render(
      <WorkTimeFields
        value={{ scheduledStart: null, scheduledUndecided: true, checkIn: null, checkOut: null }}
        baseDate={BASE_DATE}
        onChange={jest.fn()}
      />
    );

    expect(screen.queryByLabelText('예정대로 출근 기록')).toBeNull();
  });

  it('출근이 있으면 상태 배지가 "출근"으로 미리 바뀐다', () => {
    render(
      <WorkTimeFields
        value={{
          scheduledStart: '18:00',
          scheduledUndecided: false,
          checkIn: new Date('2026-08-10T18:05:00+09:00'),
          checkOut: null,
        }}
        baseDate={BASE_DATE}
        onChange={jest.fn()}
      />
    );

    expect(screen.getByTestId('status-badge')).toHaveTextContent('출근');
  });
});
```

- [ ] **Step 2: 테스트 실패 확인 (RED)**

```bash
cd uniqn-mobile && npm test -- src/components/workLogEdit/__tests__/WorkTimeFields.test.tsx
```

기대: FAIL — 모듈 없음

- [ ] **Step 3: 구현**

핵심 규칙 3가지를 코드에 고정한다:

```tsx
/**
 * WorkTimeFields — 출근 예정 · 실제 출퇴근 3필드 (통합 편집 시트 공용)
 *
 * 🔴 예정을 실적 칸에 프리필하지 않는다. 폐지된 WorkTimeEditor 는 실제 출근이 없으면
 *    예정 시각을 출근 칸에 채우고 '미정=false' 로 뒀는데, 그래서 퇴근만 고쳐도 예정 값이
 *    check_in_ts 로 저장돼 근태 상태가 뒤집혔다(사용자 신고 원인).
 *    복사는 [예정대로 기록] 을 누른 순간에만 일어난다.
 *
 * 상태 배지는 저장 후가 아니라 입력 즉시 바뀐다 — 서버 파생 규칙과 같은 식이다.
 */

/** 실적 시각으로부터 저장 후 상태를 미리 구한다(서버 update_work_log_slot 파생과 동일 규칙). */
function previewStatusLabel(checkIn: Date | null, checkOut: Date | null): string {
  if (checkIn && checkOut) return '퇴근';
  if (checkIn) return '출근';
  return '출근 예정';
}

/** 'HH:mm' + 기준 날짜 → Date. 예정을 실적으로 복사할 때만 쓴다. */
function composeCheckIn(scheduledStart: string, baseDate: Date): Date {
  const [h, m] = scheduledStart.split(':').map((v) => Number.parseInt(v, 10));
  const next = new Date(baseDate);
  next.setHours(h, m, 0, 0);
  return next;
}
```

- [ ] **Step 4: 테스트 통과 확인 (GREEN)**

```bash
cd uniqn-mobile && npm test -- src/components/workLogEdit/__tests__/WorkTimeFields.test.tsx
```

기대: 4/4 PASS

- [ ] **Step 5: 커밋**

```bash
git add src/components/workLogEdit/
git commit -m "feat(ui): 예정·실적 분리 시간 필드 컴포넌트 신설

예정 시각을 출근 칸에 프리필하던 동작을 없애고 [예정대로 기록] 원탭 복사로
대체한다. 상태 배지가 입력 즉시 바뀌어 저장 전에 결과를 볼 수 있다."
```

---

## Task 6: 접힘 섹션 + 역할/색 칩

**Files:**
- Create: `src/components/workLogEdit/CollapsibleSection.tsx`
- Create: `src/components/workLogEdit/SlotRoleChips.tsx`
- Create: `src/components/workLogEdit/SlotColorChips.tsx`
- Test: `src/components/workLogEdit/__tests__/CollapsibleSection.test.tsx`
- Test: `src/components/workLogEdit/__tests__/SlotRoleChips.test.tsx`

**Interfaces:**
- Consumes: 없음
- Produces:
  ```ts
  interface CollapsibleSectionProps {
    title: string;
    summary: string;              // 접혔을 때 보이는 한 줄
    defaultExpanded?: boolean;    // 기본 false (D6)
    children: React.ReactNode;
  }
  interface SlotRoleChipsProps {
    value: StaffRole;
    onChange: (role: StaffRole) => void;
    filledByRole?: Record<string, number>;  // 없으면 마감 표기 생략
    readOnly?: boolean;
  }
  ```

- [ ] **Step 1: 실패하는 테스트 작성**

```typescript
// CollapsibleSection.test.tsx
it('기본은 접혀 있고 요약만 보인다', () => {
  render(
    <CollapsibleSection title="출근 예정" summary="18:00">
      <Text>내용</Text>
    </CollapsibleSection>
  );
  expect(screen.getByText('18:00')).toBeTruthy();
  expect(screen.queryByText('내용')).toBeNull();
});

it('탭하면 펼쳐진다', () => {
  render(
    <CollapsibleSection title="출근 예정" summary="18:00">
      <Text>내용</Text>
    </CollapsibleSection>
  );
  fireEvent.press(screen.getByLabelText('출근 예정 펼치기'));
  expect(screen.getByText('내용')).toBeTruthy();
});
```

```typescript
// SlotRoleChips.test.tsx
it('🔴 마감된 역할도 선택할 수 있다 (D7 — 차단하지 않는다)', () => {
  const onChange = jest.fn();
  render(
    <SlotRoleChips value="dealer" onChange={onChange} filledByRole={{ floor: 0 }} />
  );

  fireEvent.press(screen.getByLabelText('역할 플로어'));

  expect(onChange).toHaveBeenCalledWith('floor');
});

it('마감된 역할에 "(마감)" 을 병기한다', () => {
  render(<SlotRoleChips value="dealer" onChange={jest.fn()} filledByRole={{ floor: 0 }} />);
  expect(screen.getByLabelText('역할 플로어 (마감)')).toBeTruthy();
});

it('filledByRole 이 없으면 마감 표기를 생략한다', () => {
  render(<SlotRoleChips value="dealer" onChange={jest.fn()} />);
  expect(screen.getByLabelText('역할 플로어')).toBeTruthy();
});
```

⚠️ `filledByRole` 의 마감 판정 기준은 `selectPostingRoleAvailability`(`@/domains/job-posting`)를 재사용한다 — `RoleChangeModal.tsx:11` 이 쓰던 것과 같은 함수라 판정이 갈리지 않는다.

- [ ] **Step 2: 테스트 실패 확인 (RED)**

```bash
cd uniqn-mobile && npm test -- src/components/workLogEdit/__tests__/
```

- [ ] **Step 3: 구현**

`SlotColorChips` 는 `EditSlotSheet.tsx:503-539` 의 팔레트 로직(퇴역 팔레트 스와치 포함)을 그대로 옮긴다. **NativeWind 는 동적 조립 클래스를 빌드 시점에 못 보므로 `SLOT_COLOR_CHIPS` 의 정적 리터럴만 사용한다.**

- [ ] **Step 4: 테스트 통과 확인 (GREEN)**

```bash
cd uniqn-mobile && npm test -- src/components/workLogEdit/__tests__/
```

- [ ] **Step 5: 커밋**

```bash
git add src/components/workLogEdit/
git commit -m "feat(ui): 접힘 섹션·역할 칩·색 팔레트 컴포넌트 신설

D6 에 따라 예정·역할은 기본 접힘 + 한 줄 요약. D7 에 따라 마감 역할은
표기만 하고 선택은 허용한다."
```

---

## Task 7: `WorkLogEditSheet` 조립 — dirty 축만 전송

**Files:**
- Create: `src/components/workLogEdit/workLogEditPayload.ts`
- Create: `src/components/workLogEdit/WorkLogEditSheet.tsx`
- Create: `src/components/workLogEdit/index.ts`
- Test: `src/components/workLogEdit/__tests__/workLogEditPayload.test.ts`
- Test: `src/components/workLogEdit/__tests__/WorkLogEditSheet.test.tsx`

**Interfaces:**
- Consumes: Task 4의 `UpdateSlotInput`, Task 5의 `WorkTimeFields`, Task 6의 세 컴포넌트
- Produces:
  ```ts
  interface WorkLogEditSheetProps {
    visible: boolean;
    onClose: () => void;
    workLogId: string;
    initial: {
      scheduledStart: string | null;
      checkIn: Date | null;
      checkOut: Date | null;
      role: StaffRole;
      color: string | null;
      memo: string;
      date: string;              // YYYY-MM-DD
      payrollStatus: string | null;
      staffName: string | null;
    };
    filledByRole?: Record<string, number>;
    editedBy?: string;
    onSaved?: () => void;
  }

  // workLogEditPayload.ts
  function resolveWorkLogEditPayload(
    initial: WorkLogEditInitial,
    current: WorkLogEditFormState
  ): UpdateSlotInput;   // 안 건드린 축은 키 자체가 없다
  ```
  Task 8의 세 진입점이 소비한다.

**배경(§8-5):** 한 시트가 되면 "퇴근만 고치려다 역할 칩을 스쳐 역할까지 저장"이 가능해진다. 역할은 이력이 남는 축이라 오탐 저장이 이력을 오염시킨다. **dirty 축만 전송은 완화책이 아니라 필수 요건이다.**

- [ ] **Step 1: 실패하는 페이로드 테스트 작성**

```typescript
import { resolveWorkLogEditPayload } from '../workLogEditPayload';

const INITIAL = {
  scheduledStart: '18:00',
  checkIn: null,
  checkOut: null,
  role: 'dealer' as const,
  color: null,
  memo: '',
};

describe('resolveWorkLogEditPayload — 안 건드린 축은 보내지 않는다', () => {
  it('아무것도 안 바꾸면 빈 패치', () => {
    expect(resolveWorkLogEditPayload(INITIAL, { ...INITIAL, scheduledUndecided: false })).toEqual({});
  });

  it('🔴 퇴근만 바꾸면 역할·색·메모·예정 키가 없다', () => {
    const out = resolveWorkLogEditPayload(INITIAL, {
      ...INITIAL,
      scheduledUndecided: false,
      checkOut: new Date('2026-08-10T02:00:00+09:00'),
    });

    expect('checkOut' in out).toBe(true);
    expect('staffRole' in out).toBe(false);
    expect('color' in out).toBe(false);
    expect('memo' in out).toBe(false);
    expect('startTime' in out).toBe(false);
  });

  it('예정을 미정으로 바꾸면 timeUndecided 만 실린다', () => {
    const out = resolveWorkLogEditPayload(INITIAL, {
      ...INITIAL,
      scheduledStart: null,
      scheduledUndecided: true,
    });

    expect(out.timeUndecided).toBe(true);
    expect('startTime' in out).toBe(false);
  });

  it('실적을 지우면 null 이 실린다 (미변경과 구분)', () => {
    const out = resolveWorkLogEditPayload(
      { ...INITIAL, checkIn: new Date('2026-08-10T18:00:00+09:00') },
      { ...INITIAL, checkIn: null, scheduledUndecided: false }
    );

    expect(out.checkIn).toBeNull();
  });
});
```

- [ ] **Step 2: 테스트 실패 확인 (RED)**

```bash
cd uniqn-mobile && npm test -- src/components/workLogEdit/__tests__/workLogEditPayload.test.ts
```

- [ ] **Step 3: 페이로드 함수 구현**

```typescript
/**
 * 초기값과 현재 폼을 비교해 **바뀐 축만** RPC 패치로 만든다.
 *
 * 🔑 키 부재(미변경)와 null(삭제)은 서버에서 다른 뜻이다(`p_patch ? 'checkIn'`).
 *    `?? ` 나 truthy 판정으로 쓰면 삭제가 조용히 무시된다.
 *
 * 🔴 이건 편의가 아니라 안전장치다 — 역할은 role_change_history 가 남는 축이라,
 *    스쳐 누른 칩이 저장되면 이력이 오염된다(설계 §8-5).
 */
export function resolveWorkLogEditPayload(
  initial: WorkLogEditInitial,
  current: WorkLogEditFormState
): UpdateSlotInput {
  const patch: UpdateSlotInput = {};

  // 예정 — 미정 선택이 시각보다 우선(서버·클라 동일 우선순위)
  if (current.scheduledUndecided) {
    if (initial.scheduledStart !== null) patch.timeUndecided = true;
  } else if (current.scheduledStart !== initial.scheduledStart && current.scheduledStart !== null) {
    patch.startTime = current.scheduledStart;
  }

  if (!sameInstant(current.checkIn, initial.checkIn)) patch.checkIn = current.checkIn;
  if (!sameInstant(current.checkOut, initial.checkOut)) patch.checkOut = current.checkOut;
  if (current.role !== initial.role) patch.staffRole = current.role;
  if (current.color !== initial.color) patch.color = current.color ?? undefined;
  if (current.memo !== initial.memo) patch.memo = current.memo;

  return patch;
}

/** Date | null 동치 비교. 두 값이 모두 null 이면 같다. */
function sameInstant(a: Date | null, b: Date | null): boolean {
  if (a === null && b === null) return true;
  if (a === null || b === null) return false;
  return a.getTime() === b.getTime();
}
```

- [ ] **Step 4: 테스트 통과 확인 (GREEN)**

```bash
cd uniqn-mobile && npm test -- src/components/workLogEdit/__tests__/workLogEditPayload.test.ts
```

- [ ] **Step 5: 시트 조립 + 정산 완료 읽기전용 테스트**

```typescript
it('🔴 정산 완료 건은 전체 읽기 전용이고 사유를 표시한다 (D4)', () => {
  render(
    <WorkLogEditSheet
      visible
      onClose={jest.fn()}
      workLogId="wl-1"
      initial={{ ...BASE_INITIAL, payrollStatus: 'completed' }}
    />
  );

  expect(screen.getByText('정산이 완료돼 수정할 수 없어요.')).toBeTruthy();
  expect(screen.queryByText('저장')).toBeNull();
});

it('빈 패치면 저장 버튼이 비활성이다', () => {
  render(<WorkLogEditSheet visible onClose={jest.fn()} workLogId="wl-1" initial={BASE_INITIAL} />);
  expect(screen.getByLabelText('저장')).toBeDisabled();
});
```

시트 구조는 설계 §3의 배치 그대로:

```tsx
<CollapsibleSection title="출근 예정" summary={scheduledSummary}>…</CollapsibleSection>
<CollapsibleSection title="역할" summary={roleSummary}>…</CollapsibleSection>
{/* 실제 출퇴근은 접지 않는다 — 매일 반복되는 축이다(D6) */}
<WorkTimeFields … />
<Input label="배치 메모" … />
```

⚠️ 시트 푸터는 **[취소] [저장] 둘뿐이다.** "빼기"는 시트가 아니라 각 화면의 카드 액션이다(설계 §3-4).
⚠️ 요약 문자열은 값이 없을 때 `출근 예정 미정` / `역할 미지정` 으로 — 빈 상태도 정보가 되게(§3-1).

- [ ] **Step 6: 테스트 통과 확인 + 타입**

```bash
cd uniqn-mobile && npm test -- src/components/workLogEdit/ && npm run type-check
```

- [ ] **Step 7: 커밋**

```bash
git add src/components/workLogEdit/
git commit -m "feat(ui): 통합 근무 편집 시트 조립

예정·역할은 접힌 채, 실제 출퇴근은 펼친 채 열린다(D6). 안 건드린 축은
패치에 키 자체가 없어 스쳐 누른 칩이 이력을 오염시키지 않는다.
정산 완료 건은 전체 읽기 전용(D4)."
```

---

## Task 8: 진입점 3곳 배선 + 구 편집기 제거

**Files:**
- Modify: `src/components/workSchedule/VenueDayPanel.tsx`
- Modify: `src/components/employer/applicants/StaffManagementTab.tsx`
- Modify: `src/features/employer/settlements/SettlementModals.tsx`
- Delete: `src/components/employer/settlement/WorkTimeEditor.tsx` (+ 테스트 2개)
- Delete: `src/components/workSchedule/EditSlotSheet.tsx` (+ 테스트)
- Delete: `src/components/employer/applicants/RoleChangeModal.tsx`
- Test: `src/components/workSchedule/__tests__/VenueDayPanel.test.tsx`

**Interfaces:**
- Consumes: Task 2의 `VenueDaySlot` 신규 필드, Task 7의 `WorkLogEditSheet`
- Produces: 없음 (최종 소비자)

- [ ] **Step 1: 실패하는 테스트 작성 — 결함 ② 회귀 가드**

```typescript
it('🔴 공고 스팬 슬롯에서도 출퇴근을 편집할 수 있다 (isContainer 무관)', () => {
  const spanSlot = { ...BASE_SLOT, isContainer: false, checkInTs: null, checkOutTs: null };
  render(<VenueDayPanel venueId="v-1" date="2026-08-10" dateLabel="8월 10일" cell={CELL} />);

  fireEvent.press(screen.getByLabelText(`근무 수정 ${spanSlot.staffName}`));

  // 예전엔 isContainer=false 면 실적 섹션 자체가 없었다
  expect(screen.getByText('실제 출퇴근')).toBeTruthy();
});
```

- [ ] **Step 2: 테스트 실패 확인 (RED)**

```bash
cd uniqn-mobile && npm test -- src/components/workSchedule/__tests__/VenueDayPanel.test.tsx
```

- [ ] **Step 3: `VenueDayPanel` 교체**

제거 대상:
- `useConfirmedStaff(venueId)` 로 실적을 해소하던 블록(`confirmedById`, `resolveAttendanceTarget`, `editingAttendance`) — Task 2 이후 슬롯이 직접 값을 들고 온다
- 모달 스왑 지연(`modalSwapTimerRef`, `SHEET_DISMISS_ANIMATION_MS`) — 시트가 하나라 중첩 Modal 이 없어진다
- `EditSlotSheet` + `WorkTimeEditor` 두 렌더 → `WorkLogEditSheet` 하나

추가: 슬롯 카드에 "빼기" 액션(기존 시트 푸터에서 이동).

⚠️ **`useUpdatePostingSlotTime`(3-C 일괄 변경)과 `SlotTimeChangeSheet` 는 건드리지 않는다.** 축이 다른 별도 경로다(설계 §4-3).

- [ ] **Step 4: `StaffManagementTab` 교체**

- `WorkTimeEditor` → `WorkLogEditSheet`
- `onShowRoleChange` prop 과 그 호출부 제거(역할이 시트로 흡수됨)
- `handleSaveTime` → 시트가 직접 저장하므로 제거

- [ ] **Step 5: `SettlementModals` 교체**

- `WorkTimeEditor` + `RoleChangeModal` → `WorkLogEditSheet`
- `filledByRole` 은 계속 넘긴다(마감 **표기**용, 차단은 안 함 — D7)

- [ ] **Step 6: 구 파일 삭제 + knip 확인**

```bash
cd uniqn-mobile && npx knip 2>&1 | tail -20
```

기대: 미사용 export 수가 래칫(2189) 이하. 초과하면 삭제 누락이 있다.

- [ ] **Step 7: 전체 테스트 + 타입 + 린트**

```bash
cd uniqn-mobile && npm test && npm run quality
```

- [ ] **Step 8: 커밋**

```bash
git add -A src/components src/features
git commit -m "refactor(ui): 시간 편집 진입점 3곳을 통합 시트로 수렴

근무표·공고 스태프관리·정산 탭이 같은 시트를 쓴다. 슬롯 종류에 따라 실적
편집 입구가 사라지던 문제(isContainer 게이트)가 읽기 RPC 확장으로 해소됐다.
EditSlotSheet·WorkTimeEditor·RoleChangeModal 제거. 빼기는 카드 액션으로 이동.

3-C 일괄 변경(update_posting_slot_time)은 축이 달라 그대로 둔다."
```

---

## Task 9: 회귀 마감

**Files:**
- Modify: `e2e/` (문구·구조 단언이 있으면)
- Test: 전체

**Interfaces:**
- Consumes: Task 1~8 전부
- Produces: 없음

- [ ] **Step 1: e2e 별도 Grep (quality 사각지대)**

```bash
cd uniqn-mobile && grep -rn "근무 시간 수정\|시간 수정\|역할 변경\|출근 예정" e2e/
```

`eslint.config.js` ignores 에 `e2e/` 가 있어 `npm run quality` 가 못 잡는다. 시트 제목이 "근무 시간 수정"에서 "근무 수정"으로 바뀌므로 단언을 갱신한다.

- [ ] **Step 2: pgTAP 전체 스위트**

```bash
cd uniqn-mobile && npm run db:start && npm run test:db 2>&1 | tail -30
```

기대: 전체 green. **특히 `parity_baseline_guard.test.sql`** — `search_path` 에서 `pg_temp` 가 빠지면 여기서 red 가 난다.

- [ ] **Step 3: 유닛 + 품질 전체**

```bash
cd uniqn-mobile && npm test && npm run quality
```

- [ ] **Step 4: 파리티 대조 (prod 적용 시)**

MCP `execute_sql`:
```sql
SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public';
```

함수 **신설·삭제 없음**(전부 `CREATE OR REPLACE`)이므로 개수가 변하지 않아야 한다. 정의 대조는 반드시 `md5(replace(pg_get_functiondef(oid), chr(13), ''))` — **`chr(13)` 제거 없이 비교하면 CRLF 때문에 전부 가짜 불일치로 보인다.**

- [ ] **Step 5: 커밋**

```bash
git add -A
git commit -m "test: 근무 시간 편집 통일 회귀 정비

e2e 시트 제목 단언 갱신(quality 사각지대라 별도 Grep 필요)."
```

---

## 범위 밖 (본 계획이 하지 않는 것)

- **직접 UPDATE REVOKE** — 시간모델 R4 트랙. 구버전 앱 공존 기간 종료가 조건. 본 계획은 그 **선행 조건을 해소하는 데까지**다
- **3-C 일괄 변경 통합** — `update_posting_slot_time` 은 축이 달라 그대로 둔다(설계 §4-3)
- **실적 일괄 정정** — 요구가 확인되지 않았다
- **QR 체크인 경로** — SECDEF RPC 라 별도. 사람이 손으로 고치는 축만 다룬다(설계 §4-4)
- **`applications.notes`(확정 시 메모)** — 다른 컬럼·다른 생애주기

---

## Self-Review 결과

**1. 스펙 커버리지**

| 설계 항목 | 담당 태스크 |
|---|---|
| D1 예정/실적 분리 | Task 5(프리필 제거) + Task 3(pgTAP 5번: 예정만 바꾸면 상태 불변) |
| D2 3곳 동일 | Task 8 |
| D3 편집기 전체 통합 | Task 6·7·8 |
| D4 정산 완료 읽기전용 | Task 7 Step 5 |
| D5 일괄 변경 제외 | 범위 밖 명시 |
| D6 접힘 2섹션 | Task 6·7 |
| D7 마감 차단 없음 | Task 6(칩 테스트) + Task 3(정원 거부 미도입 명시) |
| 결함 ① 프리필 | Task 5 |
| 결함 ② isContainer | Task 2(원인) + Task 8(회귀 가드) |
| 결함 ③ 역할 이력 | Task 3 |
| 결함 ④ 정원 검사 | D7로 재분류 — 수정하지 않음 |
| 결함 ⑤ custom_role | Task 3 |
| §5-2 알림 병합 | Task 1 |
| §5-3 컴포넌트 분해 | Task 5·6·7 |
| §8-5 오탐 저장 방지 | Task 7 |
| R4 선행 해소 | Task 4 |

**2. 미결 해소**: 설계 §6의 마지막 미결(알림 발수)은 트리거 실측으로 **A(합침) 확정** → Task 1.

**3. 타입 일관성**: `UpdateSlotInput`(Task 4) → `resolveWorkLogEditPayload` 반환(Task 7) → RPC 패치 키(Task 3) 3계층의 이름이 `checkIn`/`checkOut`/`reason`/`startTime`/`timeUndecided`/`staffRole`/`color`/`memo`로 일치함을 확인했다.

**4. 알려진 위험**

- Task 3이 가장 크다(기존 RPC 300여 줄 위에 5개 블록 추가). 실패 시 Task 1·2는 독립적으로 살아남는다
- Task 4에서 `resolveWorkTimeStatus` 소비자가 0이 되어 `knip`이 잡을 수 있다 → Task 8 Step 6에서 확인
- prod 적용 순서는 **Task 1 → Task 2 → Task 3**. 역순이면 통합 RPC가 알림 2통을 낸다
