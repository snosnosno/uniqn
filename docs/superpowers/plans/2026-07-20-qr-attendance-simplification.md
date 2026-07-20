# QR 출석 단순화 (고정 QR 전환) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 회전 QR(`event`)을 완전히 제거하고 공고당 고정 QR(`venue`) 단일 경로로 전환해, 사장·스태프 양쪽이 QR 사용 시 선택할 것을 0개로 만든다.

**Architecture:** 서버 RPC `process_qr_checkin_atomically`는 이미 `p_action='auto'` 분기와 `active`/`container` 상태를 지원하므로 **DB 마이그레이션이 없다**. 작업은 (1) work_log 해소 로직 교체 — 고정 공고의 `date='FIXED_SCHEDULE'` 대응 + 하루 다중 배정 자동 선택, (2) `event` 경로 전량 삭제, (3) UI 진입점 통합(사장 3→도착지 1, 스태프 2→1)으로 구성된다.

**Tech Stack:** Expo 55 / RN 0.83.4 / React 19.2 / TS strict / NativeWind 4.2 / Supabase / Jest

**설계 문서:** `docs/superpowers/specs/2026-07-20-qr-attendance-simplification-design.md`

## Global Constraints

- 모든 주석·커밋 메시지·사용자 문구는 **한글**. 코드 식별자만 영문.
- 로깅은 `logger.info()` / `logger.error()` — `console.log()` 금지.
- 모든 `className`에 `dark:` 변형 동반.
- import 경로는 `@/` 절대 경로.
- 알림은 `toast.success()` / `confirmAction()` / `showAlert()` — `Alert.alert()` 직접 호출 금지.
- 필드명 camelCase (DB 컬럼만 snake_case).
- DB 접근은 Service → Repository → Supabase 경유. Presentation/Hooks에서 Supabase 직접 호출 금지.
- **기존 마이그레이션 파일 수정 금지.** 이 계획은 마이그레이션을 추가하지 않는다.
- **`mcp__supabase__*` 직접 호출 금지.**
- **`event_qr_codes` 테이블·RLS·pgTAP 테스트는 건드리지 않는다** (별도 PR).
- 커밋 메시지 형식: `<type>(<scope>): <한글 설명>`

## 확정된 사실 (조사 완료 — 재확인 불필요)

| 사실 | 근거 |
|---|---|
| 고정 공고 work_log의 `date`는 `'FIXED_SCHEDULE'` 리터럴 (NULL 아님, NOT NULL 제약) | `src/types/assignment.ts:19` `FIXED_DATE_MARKER`, `20260710000002_baseline_schema_from_prod.sql:3863` |
| `(job_posting_id, staff_id, date)`에 UNIQUE 제약 **없음** — 같은 날 다중 행 정상 발생 | `20260710000002_baseline_schema_from_prod.sql:11215` (PK는 `id`뿐) |
| RPC가 `p_action='auto'` 지원 (checked_in이면 checkOut, 아니면 checkIn) | `20260711030100_qr_checkin_server_time_clamp.sql:69-75` |
| RPC가 공고 상태 `active`/`container` 둘 다 허용 | 같은 파일 65행 |
| RPC가 `is_fixed_posting=true`면 날짜 검증 건너뜀 | 같은 파일 64행 |
| `WORK_LOG_STATUS_VALUES` = scheduled / checked_in / checked_out / completed / cancelled / no_show | `src/constants/statusValues.ts:28-35` |
| `WorkLog.timeSlot`은 `"18:00~02:00"` 형태 문자열 (또는 `'미정'`/`'NEGOTIABLE'`) | `src/types/schedule.ts:459` |

---

## File Structure

**신규 생성**
- `src/services/work/selectWorkLogForQR.ts` — 후보 work_log 중 처리 대상 1개를 고르는 순수 함수. 부수효과 없음, 테스트 용이.
- `src/services/work/__tests__/selectWorkLogForQR.test.ts`
- `app/(employer)/job-postings/[id]/qr.tsx` — 사장 QR 전용 화면 (모달 대체)

**수정**
- `src/repositories/interfaces/IWorkLogRepository.ts` — `findQRCandidates` 시그니처 추가
- `src/repositories/supabase/WorkLogRepository.ts` — `findQRCandidates` 구현 추가
- `src/services/work/eventQRService.ts` — `event` 경로 전량 삭제, `processQRCheckIn` 단일 진입점으로 축소
- `src/hooks/useQRCode.ts` — `useQRDisplayModal` 삭제, `processQRCheckIn` 호출로 교체
- `app/(app)/(tabs)/schedule.tsx` — 인라인 스캐너 제거 → 스캔 화면 라우팅
- `app/(employer)/job-postings/[id]/_layout.tsx` — 헤더 QR 버튼이 QR 화면으로 라우팅
- `app/(employer)/employer.tsx` — 카드 QR 아이콘이 QR 화면으로 라우팅
- `src/components/settlement/SettlementModals.tsx` + `StaffManagementTab` — QR 진입점 제거

**삭제**
- `src/hooks/useEventQR.ts`
- `src/components/employer/qr/eventQRScope.ts`
- `src/components/employer/qr/useEventQRController.ts`
- `src/components/employer/qr/EventQRModal.tsx`
- `src/components/employer/qr/QRPanel.tsx`
- `src/components/qr/QRCodeDisplay.tsx` — **실사용처 0으로 확인됨** (`src/components/qr/index.ts:17` 배럴 export만 존재)
- `app/(app)/(tabs)/qr.tsx`

---

### Task 1: work_log QR 후보 조회 (Repository)

고정 공고(`date='FIXED_SCHEDULE'`)와 일반 공고(`date=오늘`)를 **한 번의 쿼리로** 모두 잡고, 하루 다중 배정을 예외 없이 배열로 반환한다. 기존 `findByJobPostingStaffDate`는 2행 이상이면 `BusinessError`를 던지는데(`WorkLogRepository.ts:434-438`) 이는 회전 QR 전제이므로 QR 경로에서 쓰지 않는다.

**Files:**
- Modify: `src/repositories/interfaces/IWorkLogRepository.ts`
- Modify: `src/repositories/supabase/WorkLogRepository.ts` (`findByJobPostingStaffDate` 바로 아래에 추가)
- Test: `src/repositories/supabase/__tests__/workLogQRCandidates.test.ts` (신규)

**Interfaces:**
- Consumes: 없음 (첫 태스크)
- Produces: `workLogRepository.findQRCandidates(jobPostingId: string, staffId: string, today: string): Promise<WorkLog[]>`

- [ ] **Step 1: 실패하는 테스트 작성**

`src/repositories/supabase/__tests__/workLogQRCandidates.test.ts` 생성:

```typescript
/**
 * UNIQN Mobile - QR 후보 work_log 조회 테스트
 *
 * @description 고정 공고(date='FIXED_SCHEDULE')와 일반 공고(date=오늘)를
 *   한 쿼리로 모두 조회하는지 검증. 하루 다중 배정은 예외 없이 배열로 반환.
 */
import { FIXED_DATE_MARKER } from '@/types/assignment';

const mockIn = jest.fn();
const mockEq2 = jest.fn(() => ({ in: mockIn }));
const mockEq1 = jest.fn(() => ({ eq: mockEq2 }));
const mockSelect = jest.fn(() => ({ eq: mockEq1 }));
const mockFrom = jest.fn(() => ({ select: mockSelect }));

jest.mock('@/lib/supabase', () => ({
  supabase: { from: (...args: unknown[]) => mockFrom(...(args as [])) },
}));

import { WorkLogRepository } from '@/repositories/supabase/WorkLogRepository';

describe('WorkLogRepository.findQRCandidates', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('오늘 날짜와 FIXED_SCHEDULE 을 한 쿼리로 함께 조회한다', async () => {
    mockIn.mockResolvedValue({ data: [], error: null });

    const repo = new WorkLogRepository();
    await repo.findQRCandidates('posting-1', 'staff-1', '2026-07-20');

    expect(mockEq1).toHaveBeenCalledWith('job_posting_id', 'posting-1');
    expect(mockEq2).toHaveBeenCalledWith('staff_id', 'staff-1');
    expect(mockIn).toHaveBeenCalledWith('date', ['2026-07-20', FIXED_DATE_MARKER]);
  });

  it('하루에 배정이 2건이면 예외 없이 2건 모두 반환한다', async () => {
    mockIn.mockResolvedValue({
      data: [
        { id: 'wl-1', staff_id: 'staff-1', job_posting_id: 'posting-1', date: '2026-07-20', status: 'scheduled', time_slot: '09:00~15:00', role: 'dealer' },
        { id: 'wl-2', staff_id: 'staff-1', job_posting_id: 'posting-1', date: '2026-07-20', status: 'scheduled', time_slot: '18:00~24:00', role: 'dealer' },
      ],
      error: null,
    });

    const repo = new WorkLogRepository();
    const result = await repo.findQRCandidates('posting-1', 'staff-1', '2026-07-20');

    expect(result).toHaveLength(2);
    expect(result.map((w) => w.id)).toEqual(['wl-1', 'wl-2']);
  });

  it('배정이 없으면 빈 배열을 반환한다', async () => {
    mockIn.mockResolvedValue({ data: [], error: null });

    const repo = new WorkLogRepository();
    const result = await repo.findQRCandidates('posting-1', 'staff-1', '2026-07-20');

    expect(result).toEqual([]);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx jest src/repositories/supabase/__tests__/workLogQRCandidates.test.ts`
Expected: FAIL — `repo.findQRCandidates is not a function`

- [ ] **Step 3: 인터페이스에 시그니처 추가**

`src/repositories/interfaces/IWorkLogRepository.ts`의 `findByJobPostingStaffDate` 선언 바로 아래에 추가:

```typescript
  /**
   * QR 스캔용 work_log 후보 조회
   *
   * @description 고정 공고(date='FIXED_SCHEDULE')와 일반 공고(date=오늘)를 한 쿼리로 조회.
   *   하루 다중 배정이 정상 케이스이므로 예외를 던지지 않고 배열을 그대로 반환한다.
   *   (job_posting_id, staff_id, date)에 UNIQUE 제약이 없어 2건 이상이 정상 발생한다.
   */
  findQRCandidates(jobPostingId: string, staffId: string, today: string): Promise<WorkLog[]>;
```

- [ ] **Step 4: 구현 추가**

`src/repositories/supabase/WorkLogRepository.ts`의 `findByJobPostingStaffDate` 메서드가 끝나는 지점 바로 뒤에 추가. 파일 상단 import에 `FIXED_DATE_MARKER`를 더한다:

```typescript
import { FIXED_DATE_MARKER } from '@/types/assignment';
```

메서드 본문:

```typescript
  async findQRCandidates(
    jobPostingId: string,
    staffId: string,
    today: string
  ): Promise<WorkLog[]> {
    try {
      logger.info('QR 후보 근무 기록 조회', { jobPostingId, staffId, today });

      // 고정 공고는 date 가 'FIXED_SCHEDULE' 리터럴이므로 오늘 날짜와 함께 조회한다.
      const { data, error } = await supabase
        .from(TABLE)
        .select(TABLE_COLUMNS)
        .eq('job_posting_id', jobPostingId)
        .eq('staff_id', staffId)
        .in('date', [today, FIXED_DATE_MARKER]);

      if (error) handleSupabaseError(error, { operation: 'QR 후보 근무 기록 조회', table: TABLE });

      const workLogs = ((data ?? []) as Record<string, unknown>[])
        .map((row) => toWorkLog(row))
        .filter((workLog): workLog is WorkLog => Boolean(workLog));

      logger.info('QR 후보 근무 기록 조회 완료', {
        jobPostingId,
        staffId,
        today,
        count: workLogs.length,
      });

      return workLogs;
    } catch (error) {
      rethrowOrHandle(error, 'QR 후보 근무 기록 조회', { jobPostingId, staffId, today });
    }
  }
```

> `rethrowOrHandle`이 `never`를 반환하지 않는 시그니처라면 마지막에 `return [];`를 덧붙인다. 파일 내 다른 메서드가 이 헬퍼를 어떻게 마무리하는지 확인하고 동일한 패턴을 따를 것.

- [ ] **Step 5: 테스트 통과 확인**

Run: `npx jest src/repositories/supabase/__tests__/workLogQRCandidates.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 6: 커밋**

```bash
git add src/repositories/interfaces/IWorkLogRepository.ts src/repositories/supabase/WorkLogRepository.ts src/repositories/supabase/__tests__/workLogQRCandidates.test.ts
git commit -m "feat(qr): 고정 공고 대응 QR 후보 work_log 조회 추가

고정 공고는 work_logs.date 가 'FIXED_SCHEDULE' 리터럴이라 오늘 날짜로는
조회되지 않는다. 오늘 날짜와 마커를 한 쿼리로 함께 조회하고,
하루 다중 배정을 예외 없이 배열로 반환한다."
```

---

### Task 2: 처리 대상 work_log 자동 선택 (순수 함수)

고정 QR은 `assignmentGroupId`/`timeSlot`을 인코딩하지 않으므로, 하루에 여러 배정이 있으면 어느 것을 처리할지 서버가 아니라 **클라이언트가 결정해 RPC에 `workLogId`를 넘겨야** 한다. 스태프가 고를 것을 0개로 유지하는 것이 설계 원칙이므로 자동 선택한다.

**선택 규칙 (우선순위 순)**
1. `checked_in` 상태 후보가 있으면 → 그것을 처리 대상으로 (퇴근이 된다). 2건 이상이면 `checkInTime`이 가장 이른 것.
2. 없으면 `scheduled` 상태 후보 중 `timeSlot` 시작시각이 **현재 시각과 가장 가까운** 것 (출근이 된다). 자정을 넘는 근무를 위해 24시간 순환 거리로 계산한다.
3. 위 둘 다 없으면 `null` + 사유 반환.

**Files:**
- Create: `src/services/work/selectWorkLogForQR.ts`
- Test: `src/services/work/__tests__/selectWorkLogForQR.test.ts`

**Interfaces:**
- Consumes: Task 1의 `findQRCandidates` 반환값 (`WorkLog[]`)
- Produces:
  ```typescript
  export type QRSelectionFailureReason = 'no_assignment' | 'all_checked_out' | 'not_active';
  export type QRSelectionResult =
    | { workLog: WorkLog; reason: null }
    | { workLog: null; reason: QRSelectionFailureReason };
  export function selectWorkLogForQR(candidates: WorkLog[], now: Date): QRSelectionResult;
  export function parseTimeSlotStartMinutes(timeSlot: string | undefined): number | null;
  ```

- [ ] **Step 1: 실패하는 테스트 작성**

`src/services/work/__tests__/selectWorkLogForQR.test.ts` 생성:

```typescript
/**
 * UNIQN Mobile - QR 처리 대상 work_log 자동 선택 테스트
 *
 * @description 고정 QR 은 슬롯을 인코딩하지 않으므로 하루 다중 배정 시
 *   클라이언트가 처리 대상을 자동 결정한다.
 */
import { selectWorkLogForQR, parseTimeSlotStartMinutes } from '@/services/work/selectWorkLogForQR';
import { WORK_LOG_STATUS_VALUES } from '@/constants/statusValues';
import type { WorkLog } from '@/types';

function makeWorkLog(overrides: Partial<WorkLog> & { id: string }): WorkLog {
  return {
    staffId: 'staff-1',
    jobPostingId: 'posting-1',
    date: '2026-07-20',
    status: WORK_LOG_STATUS_VALUES.SCHEDULED,
    role: 'dealer',
    ...overrides,
  } as WorkLog;
}

describe('parseTimeSlotStartMinutes', () => {
  it('"18:00~02:00" 에서 시작 시각 분(1080)을 뽑는다', () => {
    expect(parseTimeSlotStartMinutes('18:00~02:00')).toBe(18 * 60);
  });

  it('"09:30" 단일 표기도 처리한다', () => {
    expect(parseTimeSlotStartMinutes('09:30')).toBe(9 * 60 + 30);
  });

  it('파싱 불가 값은 null 을 반환한다', () => {
    expect(parseTimeSlotStartMinutes('미정')).toBeNull();
    expect(parseTimeSlotStartMinutes('NEGOTIABLE')).toBeNull();
    expect(parseTimeSlotStartMinutes(undefined)).toBeNull();
  });
});

describe('selectWorkLogForQR', () => {
  const now = new Date('2026-07-20T10:00:00+09:00'); // 한국시각 오전 10시

  it('후보가 없으면 no_assignment 를 반환한다', () => {
    expect(selectWorkLogForQR([], now)).toEqual({ workLog: null, reason: 'no_assignment' });
  });

  it('후보가 1건이면 그것을 선택한다', () => {
    const wl = makeWorkLog({ id: 'wl-1', timeSlot: '09:00~15:00' });
    expect(selectWorkLogForQR([wl], now)).toEqual({ workLog: wl, reason: null });
  });

  it('checked_in 후보가 있으면 시간대와 무관하게 그것을 우선한다 (퇴근 대상)', () => {
    const scheduled = makeWorkLog({ id: 'wl-scheduled', timeSlot: '10:00~16:00' });
    const checkedIn = makeWorkLog({
      id: 'wl-checked-in',
      timeSlot: '18:00~24:00',
      status: WORK_LOG_STATUS_VALUES.CHECKED_IN,
    });

    const result = selectWorkLogForQR([scheduled, checkedIn], now);

    expect(result.workLog?.id).toBe('wl-checked-in');
  });

  it('scheduled 후보가 여럿이면 현재 시각과 가장 가까운 시작시각을 고른다', () => {
    const morning = makeWorkLog({ id: 'wl-morning', timeSlot: '09:00~15:00' }); // 10:00 기준 60분
    const evening = makeWorkLog({ id: 'wl-evening', timeSlot: '18:00~24:00' }); // 10:00 기준 480분

    const result = selectWorkLogForQR([evening, morning], now);

    expect(result.workLog?.id).toBe('wl-morning');
  });

  it('자정을 넘는 시각도 24시간 순환 거리로 계산한다', () => {
    const lateNight = new Date('2026-07-20T23:00:00+09:00'); // 23:00
    const nearWrap = makeWorkLog({ id: 'wl-wrap', timeSlot: '02:00~08:00' }); // 순환거리 180분
    const far = makeWorkLog({ id: 'wl-far', timeSlot: '14:00~20:00' }); // 거리 540분

    const result = selectWorkLogForQR([far, nearWrap], lateNight);

    expect(result.workLog?.id).toBe('wl-wrap');
  });

  it('후보가 전부 checked_out 이면 all_checked_out 을 반환한다', () => {
    const done = makeWorkLog({ id: 'wl-done', status: WORK_LOG_STATUS_VALUES.CHECKED_OUT });

    expect(selectWorkLogForQR([done], now)).toEqual({ workLog: null, reason: 'all_checked_out' });
  });

  it('후보가 전부 취소/노쇼면 not_active 를 반환한다', () => {
    const cancelled = makeWorkLog({ id: 'wl-c', status: WORK_LOG_STATUS_VALUES.CANCELLED });
    const noShow = makeWorkLog({ id: 'wl-n', status: WORK_LOG_STATUS_VALUES.NO_SHOW });

    expect(selectWorkLogForQR([cancelled, noShow], now)).toEqual({
      workLog: null,
      reason: 'not_active',
    });
  });

  it('timeSlot 파싱 불가 후보만 있으면 그중 첫 번째를 선택한다', () => {
    const tba = makeWorkLog({ id: 'wl-tba', timeSlot: '미정' });

    expect(selectWorkLogForQR([tba], now).workLog?.id).toBe('wl-tba');
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx jest src/services/work/__tests__/selectWorkLogForQR.test.ts`
Expected: FAIL — `Cannot find module '@/services/work/selectWorkLogForQR'`

- [ ] **Step 3: 구현 작성**

`src/services/work/selectWorkLogForQR.ts` 생성:

```typescript
/**
 * UNIQN Mobile - QR 처리 대상 work_log 자동 선택
 *
 * @description 고정 QR 은 assignmentGroupId/timeSlot 을 인코딩하지 않는다.
 *   하루에 여러 배정이 있을 수 있으므로(UNIQUE 제약 없음) 어느 근무를 처리할지
 *   클라이언트가 결정한다. 스태프가 고를 것을 0개로 유지하는 것이 설계 원칙이다.
 *
 * 선택 규칙:
 *   1. checked_in 후보가 있으면 그것 (= 퇴근 처리 대상). 여러 건이면 가장 이른 출근.
 *   2. 없으면 scheduled 후보 중 시작시각이 현재와 가장 가까운 것 (= 출근 처리 대상).
 *   3. 둘 다 없으면 사유와 함께 null.
 */

import { WORK_LOG_STATUS_VALUES } from '@/constants/statusValues';
import { toDateOrNull } from '@/utils/date';
import type { WorkLog } from '@/types';

/** 하루 = 1440분 (자정 순환 거리 계산용) */
const MINUTES_PER_DAY = 1440;

export type QRSelectionFailureReason = 'no_assignment' | 'all_checked_out' | 'not_active';

export type QRSelectionResult =
  | { workLog: WorkLog; reason: null }
  | { workLog: null; reason: QRSelectionFailureReason };

/**
 * timeSlot 문자열에서 시작 시각을 분 단위로 추출
 *
 * @example '18:00~02:00' → 1080, '09:30' → 570, '미정' → null
 */
export function parseTimeSlotStartMinutes(timeSlot: string | undefined): number | null {
  if (!timeSlot) return null;

  const match = /^(\d{1,2}):(\d{2})/.exec(timeSlot.trim());
  if (!match) return null;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  if (hours > 23 || minutes > 59) return null;

  return hours * 60 + minutes;
}

/** 자정을 넘는 근무를 위해 24시간 순환 거리로 계산 */
function cyclicDistanceMinutes(a: number, b: number): number {
  const diff = Math.abs(a - b);
  return Math.min(diff, MINUTES_PER_DAY - diff);
}

/** 출근 처리 대상 후보 중 현재 시각과 가장 가까운 것 */
function pickNearestScheduled(candidates: WorkLog[], now: Date): WorkLog {
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  return candidates.reduce((best, candidate) => {
    const bestStart = parseTimeSlotStartMinutes(best.timeSlot);
    const candidateStart = parseTimeSlotStartMinutes(candidate.timeSlot);

    // 파싱 불가 후보는 후순위 — 파싱 가능한 후보가 항상 이긴다.
    if (candidateStart === null) return best;
    if (bestStart === null) return candidate;

    const bestDistance = cyclicDistanceMinutes(bestStart, nowMinutes);
    const candidateDistance = cyclicDistanceMinutes(candidateStart, nowMinutes);

    return candidateDistance < bestDistance ? candidate : best;
  });
}

/** 퇴근 처리 대상 후보 중 가장 이른 출근 건 */
function pickEarliestCheckedIn(candidates: WorkLog[]): WorkLog {
  return candidates.reduce((best, candidate) => {
    const bestTime = toDateOrNull(best.checkInTime)?.getTime() ?? Number.MAX_SAFE_INTEGER;
    const candidateTime =
      toDateOrNull(candidate.checkInTime)?.getTime() ?? Number.MAX_SAFE_INTEGER;

    return candidateTime < bestTime ? candidate : best;
  });
}

/**
 * QR 스캔 시 처리할 work_log 1건을 자동 선택
 */
export function selectWorkLogForQR(candidates: WorkLog[], now: Date): QRSelectionResult {
  if (candidates.length === 0) {
    return { workLog: null, reason: 'no_assignment' };
  }

  const checkedIn = candidates.filter(
    (workLog) => workLog.status === WORK_LOG_STATUS_VALUES.CHECKED_IN
  );
  if (checkedIn.length > 0) {
    return { workLog: pickEarliestCheckedIn(checkedIn), reason: null };
  }

  const scheduled = candidates.filter(
    (workLog) => workLog.status === WORK_LOG_STATUS_VALUES.SCHEDULED
  );
  if (scheduled.length > 0) {
    return { workLog: pickNearestScheduled(scheduled, now), reason: null };
  }

  const hasFinished = candidates.some(
    (workLog) =>
      workLog.status === WORK_LOG_STATUS_VALUES.CHECKED_OUT ||
      workLog.status === WORK_LOG_STATUS_VALUES.COMPLETED
  );

  return { workLog: null, reason: hasFinished ? 'all_checked_out' : 'not_active' };
}
```

> `toDateOrNull`이 `@/utils/date`에 없으면, 같은 디렉토리에서 `TimeInput`을 `Date`로 변환하는 기존 헬퍼를 찾아 그것을 쓴다. 없으면 이 파일 안에 로컬 헬퍼로 작성하되 `WorkLog.checkInTime`의 `TimeInput` 타입 정의(`src/types/schedule.ts`)를 먼저 확인할 것.

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx jest src/services/work/__tests__/selectWorkLogForQR.test.ts`
Expected: PASS (11 tests)

- [ ] **Step 5: 커밋**

```bash
git add src/services/work/selectWorkLogForQR.ts src/services/work/__tests__/selectWorkLogForQR.test.ts
git commit -m "feat(qr): 하루 다중 배정 시 처리 대상 work_log 자동 선택

고정 QR 은 슬롯을 인코딩하지 않으므로 클라이언트가 대상을 정한다.
출근 중인 건이 있으면 우선(퇴근), 없으면 시작시각이 가장 가까운 건(출근).
자정 넘는 근무를 위해 24시간 순환 거리로 계산한다."
```

---

### Task 3: `processQRCheckIn` 단일 진입점으로 재작성

`processEventQRCheckIn`(회전 QR)과 `processVenueQRCheckIn`(고정 QR) 두 함수를 `processQRCheckIn` 하나로 합친다. 위치(GPS) 검증을 나중에 얹을 지점이 이 함수 하나가 되도록 스캔→검증→RPC 경로를 여기로 모은다.

**Files:**
- Modify: `src/services/work/eventQRService.ts`
- Modify: `src/services/work/__tests__/eventQRService.venue.test.ts`
- Delete: `src/services/work/__tests__/eventQRService.test.ts` (event 경로 전용)
- Read first: `src/repositories/supabase/WorkLogRepositoryTransactions.ts` (`executeProcessQRCheckInOut`의 기존 에러코드→예외 매핑 확인용)

**Interfaces:**
- Consumes: `workLogRepository.findQRCandidates` (Task 1), `selectWorkLogForQR` (Task 2)
- Produces: `processQRCheckIn(qrString: string, staffId: string): Promise<EventQRScanResult>`

- [ ] **Step 1: 기존 RPC 에러 매핑 확인 및 문구 정합**

`src/repositories/supabase/WorkLogRepositoryTransactions.ts`에서 `executeProcessQRCheckInOut`을 읽고, RPC가 반환하는 에러 코드가 각각 어떤 예외/`userMessage`로 매핑되는지 목록으로 적는다.

설계에서 정한 문구와 대조해, **아래 2개가 다르면 리포지토리 쪽 `userMessage`만 수정**한다(예외 타입·매핑 구조는 건드리지 않는다):

| RPC 에러 코드 | 요구 문구 |
|---|---|
| `already_settled` | `정산이 끝난 근무는 변경할 수 없습니다` |
| `job_posting_inactive` | `종료된 공고입니다` |

나머지 코드(`already_checked_in`, `not_checked_in`, `unauthorized`, `work_log_not_found`)는 `p_action='auto'` 경로에서 정상적으로는 도달하지 않으므로 기존 문구를 유지한다.

- [ ] **Step 2: 실패하는 테스트 작성**

`src/services/work/__tests__/eventQRService.venue.test.ts`를 열고, 기존 `processEventQRCheckIn` import를 제거한 뒤 아래 describe 블록을 파일 끝에 추가한다. 파일 상단 import는 `import { processQRCheckIn } from '@/services/work/eventQRService';`로 바꾼다.

```typescript
describe('processQRCheckIn — 고정 QR 단일 경로', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('venue 형식이 아닌 QR 은 UNIQN QR 아님으로 거부한다', async () => {
    await expect(processQRCheckIn('그냥문자열', 'staff-1')).rejects.toMatchObject({
      userMessage: 'UNIQN 출근 QR이 아닙니다',
    });
  });

  it('event 형식(구 회전 QR)도 더 이상 처리하지 않는다', async () => {
    const legacy = JSON.stringify({
      type: 'event',
      jobPostingId: 'posting-1',
      date: '2026-07-20',
      action: 'checkIn',
      securityCode: 'code-1',
    });

    await expect(processQRCheckIn(legacy, 'staff-1')).rejects.toMatchObject({
      userMessage: 'UNIQN 출근 QR이 아닙니다',
    });
  });

  it('배정이 없으면 오늘 배정 없음 문구로 거부한다', async () => {
    mockFindQRCandidates.mockResolvedValue([]);

    const qr = JSON.stringify({ type: 'venue', jobPostingId: 'posting-1' });

    await expect(processQRCheckIn(qr, 'staff-1')).rejects.toMatchObject({
      userMessage: '오늘 이 공고에 배정된 근무가 없습니다',
    });
  });

  it('후보가 전부 퇴근 완료면 이미 퇴근 문구로 거부한다', async () => {
    mockFindQRCandidates.mockResolvedValue([
      { id: 'wl-1', status: 'checked_out', timeSlot: '09:00~15:00' },
    ]);

    const qr = JSON.stringify({ type: 'venue', jobPostingId: 'posting-1' });

    await expect(processQRCheckIn(qr, 'staff-1')).rejects.toMatchObject({
      userMessage: '오늘 근무는 이미 퇴근 처리됐습니다',
    });
  });

  it('선택된 work_log 로 auto 액션 RPC 를 호출한다', async () => {
    mockFindQRCandidates.mockResolvedValue([
      { id: 'wl-1', status: 'scheduled', timeSlot: '09:00~15:00', assignmentGroupId: null },
    ]);
    mockProcessQRCheckInOutTransaction.mockResolvedValue({
      action: 'checkIn',
      workDuration: 0,
      hasExistingCheckInTime: false,
    });

    const qr = JSON.stringify({ type: 'venue', jobPostingId: 'posting-1' });
    const result = await processQRCheckIn(qr, 'staff-1');

    expect(mockProcessQRCheckInOutTransaction).toHaveBeenCalledWith(
      'wl-1',
      'staff-1',
      'posting-1',
      'auto',
      expect.any(Date),
      expect.any(String)
    );
    expect(result.success).toBe(true);
    expect(result.action).toBe('checkIn');
  });
});
```

> 기존 파일의 모킹 변수명(`mockFindQRCandidates` 등)이 다르면 파일 상단의 mock 설정을 읽고 맞춘다. Task 1에서 추가한 `findQRCandidates`를 `workLogRepository` mock에 등록해야 한다.

- [ ] **Step 3: 테스트 실패 확인**

Run: `npx jest src/services/work/__tests__/eventQRService.venue.test.ts`
Expected: FAIL — `processQRCheckIn is not a function`

- [ ] **Step 4: 구현 — `eventQRService.ts` 재작성**

`src/services/work/eventQRService.ts`를 아래 내용으로 **전면 교체**한다:

```typescript
/**
 * UNIQN Mobile - QR 출퇴근 서비스
 *
 * @description 현장 출퇴근용 고정 QR 처리 서비스
 * @version 3.0.0 - 회전 QR(event) 제거, 공고당 고정 QR(venue) 단일 경로
 *
 * 흐름:
 * 1. 구인자가 공고별 고정 QR 을 출력/공유해 현장에 비치 (QR 은 바뀌지 않는다)
 * 2. 스태프가 QR 스캔
 * 3. 처리 대상 work_log 자동 선택 후 서버가 출/퇴근을 자동 판정 (p_action='auto')
 *
 * QR 코드 데이터 구조:
 * { type: 'venue', jobPostingId: string }
 *
 * @note 위치(GPS) 검증을 추가할 경우 이 파일의 processQRCheckIn 한 곳만 수정하면 된다.
 */

import { logger } from '@/utils/logger';
import { toError, isAppError } from '@/errors';
import { handleServiceError } from '@/errors/serviceErrorHandler';
import { InvalidQRCodeError } from '@/errors/BusinessErrors';
import { trackCheckIn, trackCheckOut } from '@/services/observability';
import { toISODateString, getTodayString } from '@/utils/date';
import { workLogRepository } from '@/repositories';
import { selectWorkLogForQR, type QRSelectionFailureReason } from './selectWorkLogForQR';
import type { VenueQRDisplayData, EventQRScanResult } from '@/types';

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * 고정 QR 데이터 파싱
 *
 * @description type='venue' + jobPostingId 만 가진 고정 QR. 그 외 형식은 null.
 */
function parseVenueQRData(qrString: string): VenueQRDisplayData | null {
  try {
    const data = JSON.parse(qrString);
    if (data.type !== 'venue') return null;
    if (!data.jobPostingId || typeof data.jobPostingId !== 'string') return null;

    return { type: 'venue', jobPostingId: data.jobPostingId };
  } catch (error) {
    logger.debug('QR 데이터 JSON 파싱 실패', { qrString: qrString.slice(0, 50), error });
    return null;
  }
}

/** 선택 실패 사유별 사용자 문구 */
const SELECTION_FAILURE_MESSAGES: Record<QRSelectionFailureReason, string> = {
  no_assignment: '오늘 이 공고에 배정된 근무가 없습니다',
  all_checked_out: '오늘 근무는 이미 퇴근 처리됐습니다',
  not_active: '취소되었거나 처리할 수 없는 근무입니다',
};

// ============================================================================
// QR Service
// ============================================================================

/**
 * QR 스캔 출퇴근 처리 (유일한 스캔 진입점)
 *
 * @description 고정 QR 스캔 → 오늘(또는 고정 스케줄) 배정 후보 조회 →
 *   처리 대상 자동 선택 → process_qr_checkin_atomically(p_action='auto').
 *   서버가 현재 status 로 출근/퇴근을 결정한다(TOCTOU 방지).
 */
export async function processQRCheckIn(
  qrString: string,
  staffId: string
): Promise<EventQRScanResult> {
  const venueData = parseVenueQRData(qrString);

  if (!venueData) {
    throw new InvalidQRCodeError({
      message: 'venue 형식이 아닌 QR',
      userMessage: 'UNIQN 출근 QR이 아닙니다',
    });
  }

  const { jobPostingId } = venueData;

  try {
    logger.info('QR 스캔 출퇴근 처리', { jobPostingId, staffId });

    // 1. 근무 날짜 = 오늘 (QR 에 날짜 미인코딩 — 스캔 시점 기준)
    const date = getTodayString();

    // 2. 후보 조회 (고정 공고의 'FIXED_SCHEDULE' 포함)
    const candidates = await workLogRepository.findQRCandidates(jobPostingId, staffId, date);

    // 3. 처리 대상 자동 선택 (하루 다중 배정 대응)
    const checkTime = new Date();
    const selection = selectWorkLogForQR(candidates, checkTime);

    if (!selection.workLog) {
      throw new InvalidQRCodeError({
        message: `QR 처리 대상 없음: ${selection.reason}`,
        userMessage: SELECTION_FAILURE_MESSAGES[selection.reason],
      });
    }

    const workLog = selection.workLog;
    const workLogId = workLog.id;

    // 4. auto 액션으로 원자적 처리 — 서버가 현재 status 로 출/퇴근 결정
    const result = await workLogRepository.processQRCheckInOutTransaction(
      workLogId,
      staffId,
      jobPostingId,
      'auto',
      checkTime,
      date
    );

    // 5. Analytics (트랜잭션 외부 — 실패해도 출퇴근은 성공)
    if (result.action === 'checkIn') {
      trackCheckIn(toISODateString(checkTime) || '');
      logger.info('QR 출근 처리 완료', { workLogId, staffId });
    } else {
      trackCheckOut(toISODateString(checkTime) || '', result.workDuration);
      logger.info('QR 퇴근 처리 완료', { workLogId, staffId, workDuration: result.workDuration });
    }

    return {
      success: true,
      workLogId,
      assignmentGroupId: workLog.assignmentGroupId ?? null,
      timeSlot: workLog.timeSlot ?? null,
      action: result.action,
      checkTime,
      message: result.action === 'checkIn' ? '출근이 완료되었습니다.' : '퇴근이 완료되었습니다.',
    };
  } catch (error) {
    logger.error('QR 스캔 출퇴근 처리 실패', toError(error), { jobPostingId, staffId });

    if (isAppError(error)) throw error;

    throw handleServiceError(error, {
      operation: 'QR 스캔 출퇴근 처리',
      component: 'eventQRService',
      context: { jobPostingId, staffId },
    });
  }
}

/**
 * 공고별 고정 QR 문자열 생성
 *
 * @description 서버 왕복 없이 공고 ID 만으로 만들어진다. QR 은 바뀌지 않으므로
 *   생성·만료·갱신 개념이 없다.
 */
export function buildVenueQRString(jobPostingId: string): string {
  const data: VenueQRDisplayData = { type: 'venue', jobPostingId };
  return JSON.stringify(data);
}
```

- [ ] **Step 5: event 전용 테스트 파일 삭제**

```bash
git rm src/services/work/__tests__/eventQRService.test.ts
```

- [ ] **Step 6: 테스트 통과 확인**

Run: `npx jest src/services/work/__tests__/eventQRService.venue.test.ts`
Expected: PASS

- [ ] **Step 7: 커밋**

```bash
git add src/services/work/eventQRService.ts src/services/work/__tests__/eventQRService.venue.test.ts
git commit -m "refactor(qr): 회전 QR 제거하고 processQRCheckIn 단일 진입점으로 통합

generateEventQR/validateEventQR/processEventQRCheckIn 등 event 경로 6개 함수를
processQRCheckIn 하나로 대체한다. 위치 검증 추가 시 이 함수만 수정하면 된다.
buildVenueQRString 은 서버 왕복 없이 공고 ID 만으로 QR 문자열을 만든다."
```

---

### Task 4: 스캔 훅 정리 (`useQRCode.ts`)

`useQRDisplayModal`은 회전 QR 표시 전용이라 제거하고, 스캔 훅은 새 서비스 함수를 호출하도록 바꾼다.

**Files:**
- Modify: `src/hooks/useQRCode.ts`
- Modify: `src/__tests__/hooks/useQRCode.test.ts`

**Interfaces:**
- Consumes: `processQRCheckIn` (Task 3)
- Produces: `useQRCodeScanner(options)` — 기존과 동일한 반환 형태 (`handleScanResult`, `isProcessing`, `lastError`, `clearError`)

- [ ] **Step 1: 테스트 수정**

`src/__tests__/hooks/useQRCode.test.ts`에서 `processEventQRCheckIn` 모킹을 `processQRCheckIn`으로 바꾸고, `useQRDisplayModal` 관련 describe 블록을 통째로 삭제한다.

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx jest src/__tests__/hooks/useQRCode.test.ts`
Expected: FAIL — `processQRCheckIn` 미존재 또는 모듈 export 불일치

- [ ] **Step 3: 훅 수정**

`src/hooks/useQRCode.ts`에서:

1. import 교체:
```typescript
import { processQRCheckIn } from '@/services/work/eventQRService';
```

2. 98행 호출부 교체:
```typescript
        const scanResult = await processQRCheckIn(qrString, user.uid);
```

3. `useQRDisplayModal` 함수 전체(175~207행)와 `EventQRDisplayData` import, 하단 `export default`의 `useQRDisplayModal` 항목 삭제.

4. 파일 상단 주석의 `@note QR 생성은 useEventQR 훅 사용 (구인자용)`을 다음으로 교체:
```typescript
 * @note QR 생성은 서버 왕복이 없다 — buildVenueQRString(jobPostingId) 참고.
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx jest src/__tests__/hooks/useQRCode.test.ts`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add src/hooks/useQRCode.ts src/__tests__/hooks/useQRCode.test.ts
git commit -m "refactor(qr): 스캔 훅을 processQRCheckIn 으로 전환하고 표시 모달 훅 제거

useQRDisplayModal 은 회전 QR 표시 전용이라 고정 QR 전환과 함께 불필요해졌다."
```

---

### Task 5: 스태프 스캔 동선 통일

전역 헤더 QR 아이콘 1탭 = 카메라 즉시 오픈. 중간 화면(`/qr`)을 삭제하고, 스케줄 화면의 인라인 스캐너도 같은 경로를 쓰게 해 코드 경로를 1개로 만든다.

**Files:**
- Delete: `app/(app)/(tabs)/qr.tsx`
- Create: `app/(app)/scan.tsx`
- Modify: `app/(app)/(tabs)/_layout.tsx` (`qr` 탭 등록 제거)
- Modify: `app/(app)/(tabs)/schedule.tsx` (인라인 스캐너 제거 → 라우팅)
- Modify: `src/components/layout/TabHeader.tsx` (QR 버튼 목적지 변경) — 정확한 경로는 `showQR` prop을 grep 해서 확인할 것

**Interfaces:**
- Consumes: `useQRCodeScanner` (Task 4), `QRCodeScanner` 컴포넌트 (`@/components/qr`)
- Produces: 라우트 `/scan` — 파라미터 없음. 스캔 성공 시 `router.back()`.

- [ ] **Step 1: 스캔 화면 생성**

`app/(app)/scan.tsx` 생성:

```tsx
/**
 * UNIQN Mobile - QR 스캔 화면
 *
 * @description 스태프용 QR 스캔. 진입 즉시 카메라가 열린다.
 *   고정 QR 이라 스캔 전에 사용자가 고를 것이 없다(출/퇴근은 서버가 자동 판정).
 */

import { useCallback } from 'react';
import { useRouter } from 'expo-router';
import { QRCodeScanner } from '@/components/qr';
import { useQRCodeScanner } from '@/hooks';
import { useTutorial } from '@/hooks/useTutorial';
import { TutorialOverlay } from '@/components/tutorial';
import { QR_CHECKIN_TUTORIAL } from '@/constants/tutorials';
import { View } from 'react-native';
import type { QRCodeScanResult } from '@/types';

export default function ScanScreen() {
  const router = useRouter();

  const {
    needsTutorial,
    completeTutorial,
    isLoading: isTutorialLoading,
    timeoutMs: tutorialTimeoutMs,
  } = useTutorial('qrCheckIn', { pageCount: QR_CHECKIN_TUTORIAL.pages.length });

  const { handleScanResult, lastError, clearError } = useQRCodeScanner({
    onSuccess: () => {
      router.back();
    },
  });

  const handleClose = useCallback(() => {
    clearError();
    router.back();
  }, [clearError, router]);

  const handleScan = useCallback(
    (result: QRCodeScanResult) => {
      handleScanResult(result);
    },
    [handleScanResult]
  );

  return (
    <View className="flex-1 bg-surface-page dark:bg-surface">
      <QRCodeScanner
        visible
        onClose={handleClose}
        onScan={handleScan}
        title="출퇴근 QR 스캔"
        scanError={lastError}
        onClearError={clearError}
      />
      {needsTutorial && !isTutorialLoading && (
        <View className="absolute inset-0 z-10">
          <TutorialOverlay
            config={QR_CHECKIN_TUTORIAL}
            onComplete={completeTutorial}
            timeoutMs={tutorialTimeoutMs}
          />
        </View>
      )}
    </View>
  );
}
```

> `QRCodeScanner`의 `expectedAction` prop이 필수라면, 고정 QR 전환으로 의미가 없어졌으므로 `src/components/qr/QRCodeScanner.tsx`와 `.web.tsx`에서 optional로 바꾸고 관련 표시 로직을 제거한다.

- [ ] **Step 2: 구 화면 삭제 및 탭 등록 해제**

```bash
git rm "app/(app)/(tabs)/qr.tsx"
```

`app/(app)/(tabs)/_layout.tsx`에서 `name="qr"` 인 `<Tabs.Screen>` 등록(`href: null`로 숨겨져 있음)을 삭제한다.

- [ ] **Step 3: 헤더 QR 버튼 목적지 변경**

`showQR` prop을 소비하는 컴포넌트를 찾는다:

```bash
grep -rn "showQR" src/ app/
```

QR 아이콘 `onPress`가 `/qr`로 라우팅하거나 로컬 상태를 여는 부분을 `router.push('/scan')`으로 교체한다.

- [ ] **Step 4: 스케줄 인라인 스캐너 제거**

`app/(app)/(tabs)/schedule.tsx`에서:
- `<QRCodeScanner ... />` 인라인 렌더와 그에 딸린 `useQRCodeScanner` 호출, 스캐너 열림 상태(`useState`)를 삭제
- `WorkTab`의 "QR 코드로 출근/퇴근하기" 버튼 `onPress`를 `router.push('/scan')`으로 교체

- [ ] **Step 5: 타입체크 + 관련 테스트 실행**

Run: `npm run type-check`
Expected: exit 0, 0 errors

Run: `npx jest src/__tests__/hooks/useQRCode.test.ts src/services/work/__tests__`
Expected: PASS

- [ ] **Step 6: 커밋**

```bash
git add -A
git commit -m "refactor(qr): 스태프 스캔 동선을 /scan 단일 경로로 통일

전역 헤더 QR 아이콘 1탭이면 카메라가 바로 열린다. 고를 것이 없어진 중간
화면(/qr)을 삭제하고, 스케줄 화면의 인라인 스캐너도 같은 라우트를 쓰게 해
스캐너 코드 경로를 1개로 줄인다."
```

---

### Task 6: 사장 QR 전용 화면 + 진입점 도착지 통일

진입점 3개 중 정산 화면 버튼을 제거하고, 남은 2개(리스트 카드 아이콘 / 상세 헤더 버튼)가 **같은 화면**으로 가게 한다. 모달 3개는 전부 삭제한다.

**Files:**
- Create: `app/(employer)/job-postings/[id]/qr.tsx`
- Modify: `app/(employer)/job-postings/[id]/_layout.tsx`
- Modify: `app/(employer)/employer.tsx`
- Modify: `src/components/settlement/SettlementModals.tsx` + `StaffManagementTab`
- Delete: `src/components/employer/qr/EventQRModal.tsx`, `QRPanel.tsx`, `useEventQRController.ts`, `eventQRScope.ts`, `src/hooks/useEventQR.ts`

**Interfaces:**
- Consumes: `buildVenueQRString(jobPostingId)` (Task 3)
- Produces: 라우트 `/job-postings/[id]/qr`

> 실제 라우트 디렉토리 구조는 `ls "app/(employer)/"`로 먼저 확인하고, 기존 상세 화면(`index.tsx`/`applicants.tsx`/`settlements.tsx`)과 같은 레벨에 `qr.tsx`를 둔다.

- [ ] **Step 1: QR 화면 생성**

`app/(employer)/job-postings/[id]/qr.tsx` 생성. 공고 제목은 기존 상세 화면이 쓰는 훅을 재사용한다(`_layout.tsx`를 읽어 어떤 훅/컨텍스트로 공고를 얻는지 확인 후 동일하게 사용):

```tsx
/**
 * UNIQN Mobile - 공고 고정 QR 화면
 *
 * @description 공고당 1장인 고정 출퇴근 QR. 바뀌지 않으므로 만료·갱신이 없다.
 *   화면으로 보여주거나 스크린샷으로 저장해 현장에 비치하면 스태프가 스캔해 출/퇴근한다.
 *
 * @note 저장/공유 버튼을 두지 않는다 — expo-media-library·react-native-view-shot 은
 *   네이티브 모듈이라 OTA 로 배포되지 않는다(새 EAS 빌드 필요). 스크린샷으로 충분하다.
 */

import { useMemo } from 'react';
import { View, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import QRCode from 'react-native-qrcode-svg';
import { buildVenueQRString } from '@/services/work/eventQRService';

export default function JobPostingQRScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const qrValue = useMemo(() => (id ? buildVenueQRString(id) : ''), [id]);

  if (!id) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-surface-page dark:bg-surface">
        <Text className="text-base text-content-secondary dark:text-secondary-400 font-sans">
          공고를 찾을 수 없어요
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-surface-page dark:bg-surface" edges={['bottom']}>
      <View className="flex-1 items-center justify-center px-4">
        {/* QR 배경은 스캔 대비를 위해 다크모드에서도 흰색 유지 (dark:bg-white 의도적) */}
        <View className="rounded-lg bg-white p-6 dark:bg-white">
          <QRCode value={qrValue} size={260} />
        </View>
      </View>
    </SafeAreaView>
  );
}
```

> **새 의존성을 추가하지 않는다.** `react-native-qrcode-svg`는 이미 설치돼 있다(`package.json:101`).
> 이 원칙 덕분에 이번 작업 전체가 새 EAS 빌드 없이 OTA로 배포된다.

화면 제목은 `_layout.tsx`의 `<Stack.Screen name="qr" options={{ title: '출퇴근 QR' }} />`로 지정한다.

- [ ] **Step 2: 진입점 2개를 새 화면으로 라우팅**

`app/(employer)/job-postings/[id]/_layout.tsx`:
- `HeaderQRAction`의 `onPress`를 `router.push(\`/job-postings/${id}/qr\`)`로 교체
- `<EventQRModal ... />` 렌더와 관련 상태·`!isFixed` 조건부 마운트 제거
- 헤더 QR 버튼을 `isFixed`로 숨기던 로직 제거 (고정 공고도 QR 사용 가능)

`app/(employer)/employer.tsx`:
- 카드 QR 아이콘 `onPress`의 `handleShowQR`(토스트만 띄우고 리턴하던 `isFixed` 분기 포함)를 `router.push(\`/job-postings/${posting.id}/qr\`)`로 교체
- `<EventQRModal ... />` 렌더와 관련 상태 제거

- [ ] **Step 3: 정산 화면 진입점 제거**

`StaffManagementTab`에서 "이벤트 QR 열기" 버튼을 삭제하고, `SettlementModals.tsx`에서 `EventQRModal` 렌더와 `useSettlementModals`의 QR 관련 상태(`isQRVisible`/`openQR`/`closeQR` 등 실제 이름은 파일 확인)를 삭제한다.

- [ ] **Step 4: 죽은 컴포넌트·훅 삭제**

```bash
git rm src/components/employer/qr/EventQRModal.tsx \
       src/components/employer/qr/QRPanel.tsx \
       src/components/employer/qr/useEventQRController.ts \
       src/components/employer/qr/eventQRScope.ts \
       src/hooks/useEventQR.ts
```

관련 테스트 파일(`src/components/employer/qr/__tests__/` 등)이 있으면 함께 삭제한다.
`src/hooks/index.ts` 배럴에서 `useEventQR` export를 제거한다.

- [ ] **Step 5: `isFixed` 이중 판정 정리**

`app/(employer)/job-postings/[id]/index.tsx`에서 `!(contextIsFixed || isFixed)` 형태의 이중 비교를 찾아, QR 관련 조건이면 통째로 삭제한다(고정 공고도 QR 사용 가능해졌으므로). QR 외 용도로도 쓰이면 그 부분은 건드리지 않는다.

- [ ] **Step 6: 타입체크 + 전체 테스트**

Run: `npm run type-check`
Expected: exit 0, 0 errors

Run: `npm test`
Expected: 전체 통과 — 실패가 있으면 삭제된 심볼을 참조하는 테스트이므로 해당 테스트를 정리한다.

- [ ] **Step 7: 커밋**

```bash
git add -A
git commit -m "feat(qr): 사장 QR 전용 화면 신설하고 진입점 도착지를 하나로 통일

모달 3개(리스트/헤더/정산)를 화면 1개로 대체한다. 정산 화면의 중복
진입점은 삭제하고, 고정 공고도 QR 을 쓸 수 있게 isFixed 차단을 푼다.
QR 은 공고 ID 만으로 만들어져 서버 왕복·만료·갱신이 없다."
```

---

### Task 7: 죽은 코드 정리 및 최종 검증

**Files:**
- Modify: `src/repositories/supabase/EventQRRepository.ts`, `src/repositories/interfaces/IEventQRRepository.ts`
- Modify: `src/types/` 내 QR 타입 정의
- Modify: `knip.json` 또는 래칫 설정 (미사용 export 수치 갱신)

- [ ] **Step 1: 미사용 심볼 탐지**

Run: `npx knip`

출력에서 이번 변경으로 **새로 미사용이 된 것만** 추린다. 기존부터 미사용이던 항목은 이번 PR 범위가 아니다.

- [ ] **Step 2: 미사용 QR 표시 컴포넌트 삭제**

`QRCodeDisplay.tsx`는 배럴 export 외에 실사용처가 없음이 확인됐다(조사 시점 grep 결과 `src/components/qr/index.ts:17` 단 1건).

삭제 전 재확인:

```bash
grep -rn "QRCodeDisplay" src/ app/ e2e/
```

배럴 export 1건 외에 결과가 없으면:

```bash
git rm src/components/qr/QRCodeDisplay.tsx
```

`src/components/qr/index.ts`에서 해당 export 줄을 제거한다.

- [ ] **Step 3: EventQR 리포지토리·타입 정리**

`EventQRRepository`/`IEventQRRepository`의 모든 메서드가 미사용이면 두 파일과 `src/repositories/index.ts`의 `eventQRRepository` export를 삭제한다.

> **`event_qr_codes` 테이블·RLS·pgTAP 테스트는 삭제하지 않는다** (설계 문서 범위 밖 — 별도 PR).

`src/types/`에서 `EventQRCode`, `EventQRDisplayData`, `GenerateEventQRInput`, `EventQRValidationResult`, `QRCodeAction`이 더 이상 참조되지 않으면 삭제한다. `VenueQRDisplayData`와 `EventQRScanResult`는 **유지**한다.

- [ ] **Step 4: 튜토리얼 문구 갱신**

`src/constants/tutorials/qrCheckInTutorial.ts`를 열어 "구인자가 QR을 생성하면" 류의 회전 QR 전제 문구를 고정 QR 기준으로 고친다 (예: "현장에 비치된 QR을 스캔하면 출근이 완료돼요").

- [ ] **Step 5: 전체 품질 게이트**

Run: `npm run quality`
Expected: exit 0 (type-check + lint + format:check 모두 통과)

Run: `npm test`
Expected: 전체 통과, 실패 0

Run: `npx knip`
Expected: 미사용 export 수가 래칫 기준(현행 2214) 이하. 초과하면 원인을 확인하고 정리하거나 래칫 값을 갱신한다.

- [ ] **Step 6: E2E 확인**

Run: `npx jest e2e/tests/p2-standard/qr-checkin.spec.ts` (또는 프로젝트의 E2E 실행 명령)

`/qr` 라우트를 참조하는 페이지 오브젝트(`e2e/pages/app/tabs/qr.page.ts`)가 깨지므로 `/scan` 기준으로 수정한다. 웹 카메라 제약으로 실제 스캔은 여전히 검증되지 않는다 — **이 공백은 실기기 QA 항목으로 남는다.**

- [ ] **Step 7: 커밋**

```bash
git add -A
git commit -m "chore(qr): 회전 QR 잔여 코드 정리 및 튜토리얼 문구 갱신

EventQR 리포지토리·타입·튜토리얼 문구에서 회전 QR 전제를 제거한다.
event_qr_codes 테이블과 RLS·pgTAP 은 별도 PR 로 남긴다."
```

---

## 완료 후 남는 것 (이 계획 범위 밖)

| 항목 | 사유 |
|---|---|
| 실기기 QA — 스태프 스캔 → 출근 → 재스캔 → 퇴근 | 웹 카메라 제약으로 E2E 자동화 불가 |
| 실기기 QA — 고정(`isFixed`) 공고 QR 출퇴근 | 이번에 처음 활성화되는 경로 |
| 실기기 QA — 하루 2슬롯 배정 시 자동 선택 정확도 | 단위 테스트는 있으나 실데이터 확인 필요 |
| `event_qr_codes` 테이블 DROP | RLS·pgTAP 4종이 물려 있어 별도 PR |
| 위치(GPS) 기반 부정 출근 방지 | v1 범위 밖 — `processQRCheckIn` 한 곳만 수정하면 됨 |
| 웹 재배포 / OTA | 배포 게이트 |
