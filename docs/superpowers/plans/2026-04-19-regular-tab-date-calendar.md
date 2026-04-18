# 일반탭 날짜필터 달력 UI 전환 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 구인구직 탭 일반 공고 타입의 가로 스크롤 날짜 칩(`DateSlider`)을 월 단위 달력 그리드(`DateCalendar`) + 일자별 공고 개수 뱃지 + 접기/펼치기 헤더로 교체한다.

**Architecture:** Supabase RPC로 일자별 집계 → TanStack Query 훅 → 컴포지션형 UI(`DateCalendar` = 상태머신, 하위에 `CalendarHeader`/`CalendarGrid`/`CalendarCell`/`CollapsedHeader`). 기본 펼침 → 날짜 선택 시 자동 접힘, 접힌 헤더 탭으로 재펼침, ✕로 선택 해제.

**Tech Stack:** React Native 0.83.4 / Expo 55 / TypeScript strict / NativeWind 4.2 / Supabase (Auth + Postgres + RPC) / TanStack Query v5 / Reanimated 4.2 / date-fns + ko locale / expo-haptics / @testing-library/react-native

**Spec:** `docs/superpowers/specs/2026-04-19-regular-tab-date-calendar-design.md`

---

## File Structure

### 신규 파일
```
uniqn-mobile/
├─ supabase/migrations/YYYYMMDDHHMMSS_add_regular_posting_date_counts_rpc.sql
├─ src/
│  ├─ hooks/
│  │  ├─ useRegularDateCounts.ts
│  │  └─ __tests__/useRegularDateCounts.test.ts
│  └─ components/jobs/DateCalendar/
│     ├─ DateCalendar.tsx
│     ├─ CalendarHeader.tsx
│     ├─ CalendarGrid.tsx
│     ├─ CalendarCell.tsx
│     ├─ CollapsedHeader.tsx
│     ├─ index.ts
│     └─ __tests__/
│        ├─ DateCalendar.test.tsx
│        ├─ CalendarHeader.test.tsx
│        ├─ CalendarGrid.test.tsx
│        ├─ CalendarCell.test.tsx
│        └─ CollapsedHeader.test.tsx
```

### 수정 파일
```
uniqn-mobile/
├─ src/
│  ├─ repositories/
│  │  ├─ interfaces/IJobPostingRepository.ts         (메서드 추가)
│  │  └─ supabase/JobPostingRepository.ts            (구현 추가)
│  └─ components/jobs/index.ts                       (DateSlider export 제거 + DateCalendar 추가)
├─ app/(app)/(tabs)/
│  ├─ index.tsx                                      (DateSlider → DateCalendar)
│  └─ __tests__/JobsScreen.test.tsx                  (selector 교체)
└─ e2e/
   ├─ pages/app/tabs/home.page.ts                    (selector 교체)
   └─ tests/p2-standard/jobs-home.spec.ts            (시나리오 수정)
```

### 주요 데이터 타입

```typescript
// 일자별 카운트 맵 — key: 'yyyy-MM-dd', value: posting 개수
type DateCountMap = Record<string, number>;

// 달력 모드
type CalendarMode = 'expanded' | 'collapsed';

// 카운트 상태 (로딩/에러/데이터)
type CountState =
  | { type: 'loading' }
  | { type: 'error'; retry: () => void }
  | { type: 'ready'; counts: DateCountMap };
```

### 주요 토큰 매핑 (tailwind.config.js 기준)

| 디자인 | 클래스 |
|--------|--------|
| 골드 (CTA) | `bg-primary-500`, `border-primary-500`, `text-primary-500` |
| 골드 배경 위 텍스트 | `text-content-onGold` (#09090B) |
| 반투명 골드 뱃지 | `bg-primary-500/15` |
| Pressed 피드백 | `bg-surface-hover dark:bg-surface-hover` |
| Focus ring (info blue) | `border-info-500` |
| 요일 일요일 | `text-error-500` |
| 요일 토요일 | `text-info-500` |
| 디바이더 | `border-divider` |

---

## 사전 조건 확인

**중요 — Supabase 스키마 사실:**
- 테이블 `job_posting_work_dates`는 **존재하지 않음**
- 작업 날짜는 `job_postings.work_date`(text, 단일) 및 `job_postings.work_dates`(text[], 여러 날짜) 두 컬럼에 분산 저장
- 날짜 형식은 `'yyyy-MM-dd'` (text). 문자열 `between` 비교로 범위 검색 가능
- 기존 필터 패턴: `.contains('work_dates', [filters.workDate])`

**이 사실에 맞춰 RPC는 `unnest` + `coalesce(work_dates, [work_date])` 패턴으로 구현한다.**

---

## Task 1: Supabase RPC 마이그레이션 + 타입 재생성

**Files:**
- Create: `uniqn-mobile/supabase/migrations/<timestamp>_add_regular_posting_date_counts_rpc.sql`
- Modify: `uniqn-mobile/src/types/supabase.ts` (자동 생성)

- [ ] **Step 1-1: 현재 시각으로 타임스탬프 생성**

실행:
```bash
python3 -c "from datetime import datetime; print(datetime.now().strftime('%Y%m%d%H%M%S'))"
```

출력된 타임스탬프(예: `20260419153000`)를 파일명에 사용한다.

- [ ] **Step 1-2: 스키마 실시간 검증 (MCP)**

`mcp__supabase__list_tables`를 호출하여 다음을 확인한다:
- `job_postings` 테이블이 존재
- 컬럼에 `posting_type`, `status`, `work_date`, `work_dates` 포함
- 각 컬럼 타입이 예상과 일치 (posting_type=enum/text, work_date=text, work_dates=text[])

만약 컬럼명이 다르면 아래 SQL을 그에 맞게 조정한다. 조정 시 이 계획서에도 주석으로 남길 것.

- [ ] **Step 1-3: 마이그레이션 파일 작성**

경로: `uniqn-mobile/supabase/migrations/<타임스탬프>_add_regular_posting_date_counts_rpc.sql`

내용:
```sql
-- 일반 공고 타입의 일자별 공고 개수 집계 RPC
--
-- 목적: DateCalendar UI에서 월 단위 달력 셀에 공고 개수 뱃지 표시
-- 성능: work_dates/work_date 컬럼 기반, 필터 (posting_type='regular', status='active') 후
--       unnest → 날짜 범위 체크 → group by 집계.
--
-- 날짜 포맷: 'yyyy-MM-dd' 문자열. lexicographic 비교 = 시간순 비교 동일.

create or replace function public.get_regular_posting_date_counts(
  p_start_date text,
  p_end_date text
)
returns table (work_date text, posting_count bigint)
language sql
stable
security invoker
set search_path = public
as $$
  with expanded as (
    select
      jp.id,
      unnest(
        case
          when jp.work_dates is not null and array_length(jp.work_dates, 1) > 0
            then jp.work_dates
          when jp.work_date is not null and jp.work_date <> ''
            then array[jp.work_date]
          else array[]::text[]
        end
      ) as wd
    from public.job_postings jp
    where jp.posting_type = 'regular'
      and jp.status = 'active'
  )
  select
    wd as work_date,
    count(distinct id) as posting_count
  from expanded
  where wd between p_start_date and p_end_date
  group by wd
  order by wd;
$$;

grant execute on function public.get_regular_posting_date_counts(text, text) to authenticated;

comment on function public.get_regular_posting_date_counts(text, text) is
  'DateCalendar UI용: 일반 공고 타입의 일자별 공고 개수 집계. 날짜는 yyyy-MM-dd 문자열.';
```

- [ ] **Step 1-4: MCP로 마이그레이션 적용**

`mcp__supabase__apply_migration` 호출. 파라미터:
- `name`: 파일명과 동일 (타임스탬프 제외) — 예 `add_regular_posting_date_counts_rpc`
- `query`: Step 1-3의 SQL 전체

**주의**: `supabase db push` 금지 (메모리 `feedback_supabase_migration_workflow.md` 참조). MCP `apply_migration` 전용.

- [ ] **Step 1-5: 적용 검증 — RPC 직접 실행**

`mcp__supabase__execute_sql`로 스모크 테스트:
```sql
select * from public.get_regular_posting_date_counts('2026-04-01', '2026-04-30');
```

예상: 에러 없이 실행. 행은 0개여도 무방(일반 공고 없을 수 있음). 에러나면 Step 1-3 SQL 수정 후 재시도.

- [ ] **Step 1-6: TypeScript 타입 재생성**

`mcp__supabase__generate_typescript_types`를 호출하여 `src/types/supabase.ts` 갱신. 생성된 `Functions` 타입에 `get_regular_posting_date_counts`가 포함되었는지 확인:

```bash
grep -n "get_regular_posting_date_counts" uniqn-mobile/src/types/supabase.ts
```

예상: `Args: { p_start_date: string; p_end_date: string }` + `Returns: { work_date: string; posting_count: number }[]` 형태의 정의 발견.

- [ ] **Step 1-7: 타입체크 통과 확인**

```bash
cd uniqn-mobile && npx tsc --noEmit
```

예상: exit 0 (에러 0).

- [ ] **Step 1-8: 커밋**

```bash
cd uniqn-mobile && git add supabase/migrations/*_add_regular_posting_date_counts_rpc.sql src/types/supabase.ts
git commit -m "feat(db): 일반 공고 일자별 개수 집계 RPC 추가

DateCalendar UI에서 월별 달력 셀에 공고 개수 뱃지를 표시하기 위한
get_regular_posting_date_counts(start, end) RPC 함수 추가.

- work_dates 배열 + work_date 스칼라 둘 다 지원
- status='active', posting_type='regular' 필터
- text 날짜 비교(yyyy-MM-dd format lexicographic order)"
```

---

## Task 2: Repository — `getRegularDateCounts` 메서드 추가

**Files:**
- Modify: `uniqn-mobile/src/repositories/interfaces/IJobPostingRepository.ts`
- Modify: `uniqn-mobile/src/repositories/supabase/JobPostingRepository.ts`
- Create: `uniqn-mobile/src/repositories/supabase/__tests__/JobPostingRepository.getRegularDateCounts.test.ts`

- [ ] **Step 2-1: Interface에 메서드 선언 추가**

파일: `uniqn-mobile/src/repositories/interfaces/IJobPostingRepository.ts`

`getTypeCounts` 메서드 바로 뒤(line 132 이후)에 추가:

```typescript
  /**
   * 일반 공고 타입의 일자별 공고 개수 집계
   *
   * @description DateCalendar UI의 달력 셀 뱃지용.
   *              Supabase RPC(get_regular_posting_date_counts) 호출 래퍼.
   * @param startDate - 집계 시작일 (inclusive, 'yyyy-MM-dd')
   * @param endDate   - 집계 종료일 (inclusive, 'yyyy-MM-dd')
   * @returns 날짜→개수 맵 (0건 날짜는 키 없음)
   */
  getRegularDateCounts(
    startDate: string,
    endDate: string
  ): Promise<Record<string, number>>;
```

- [ ] **Step 2-2: 실패 테스트 작성**

파일 생성: `uniqn-mobile/src/repositories/supabase/__tests__/JobPostingRepository.getRegularDateCounts.test.ts`

```typescript
/**
 * SupabaseJobPostingRepository.getRegularDateCounts — RPC 래퍼 테스트
 */

import { SupabaseJobPostingRepository } from '../JobPostingRepository';

const mockRpc = jest.fn();

jest.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: (...args: unknown[]) => mockRpc(...args),
  },
}));

jest.mock('@/utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), debug: jest.fn(), error: jest.fn() },
}));

describe('SupabaseJobPostingRepository.getRegularDateCounts', () => {
  beforeEach(() => {
    mockRpc.mockReset();
  });

  it('RPC 이름과 파라미터를 정확히 전달한다', async () => {
    mockRpc.mockResolvedValueOnce({ data: [], error: null });
    const repo = new SupabaseJobPostingRepository();

    await repo.getRegularDateCounts('2026-04-01', '2026-04-30');

    expect(mockRpc).toHaveBeenCalledWith('get_regular_posting_date_counts', {
      p_start_date: '2026-04-01',
      p_end_date: '2026-04-30',
    });
  });

  it('RPC 응답을 date→count 맵으로 변환한다', async () => {
    mockRpc.mockResolvedValueOnce({
      data: [
        { work_date: '2026-04-14', posting_count: 2 },
        { work_date: '2026-04-18', posting_count: 12 },
      ],
      error: null,
    });
    const repo = new SupabaseJobPostingRepository();

    const result = await repo.getRegularDateCounts('2026-04-01', '2026-04-30');

    expect(result).toEqual({ '2026-04-14': 2, '2026-04-18': 12 });
  });

  it('posting_count가 bigint(문자열/숫자)여도 number로 정규화한다', async () => {
    mockRpc.mockResolvedValueOnce({
      data: [{ work_date: '2026-04-18', posting_count: '12' }],
      error: null,
    });
    const repo = new SupabaseJobPostingRepository();

    const result = await repo.getRegularDateCounts('2026-04-01', '2026-04-30');

    expect(result).toEqual({ '2026-04-18': 12 });
    expect(typeof result['2026-04-18']).toBe('number');
  });

  it('data가 null이어도 빈 객체 반환', async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: null });
    const repo = new SupabaseJobPostingRepository();

    const result = await repo.getRegularDateCounts('2026-04-01', '2026-04-30');

    expect(result).toEqual({});
  });

  it('RPC 에러 시 예외를 던진다', async () => {
    mockRpc.mockResolvedValueOnce({
      data: null,
      error: { message: 'DB connection lost', code: '08003' },
    });
    const repo = new SupabaseJobPostingRepository();

    await expect(
      repo.getRegularDateCounts('2026-04-01', '2026-04-30')
    ).rejects.toThrow();
  });
});
```

- [ ] **Step 2-3: 테스트 실행 — 실패 확인**

```bash
cd uniqn-mobile && npx jest src/repositories/supabase/__tests__/JobPostingRepository.getRegularDateCounts.test.ts
```

예상: 5개 테스트 전부 FAIL ("getRegularDateCounts is not a function" 또는 유사).

- [ ] **Step 2-4: 구현 추가**

파일: `uniqn-mobile/src/repositories/supabase/JobPostingRepository.ts`

`getTypeCounts` 메서드 바로 뒤(현재 line 335 이후, `// ── Simple Write ──` 주석 바로 앞)에 추가:

```typescript
  async getRegularDateCounts(
    startDate: string,
    endDate: string
  ): Promise<Record<string, number>> {
    try {
      logger.info('일반 공고 일자별 개수 조회', { startDate, endDate });
      const { data, error } = await supabase.rpc('get_regular_posting_date_counts', {
        p_start_date: startDate,
        p_end_date: endDate,
      });
      if (error) {
        handleSupabaseError(error, {
          operation: '일반 공고 일자별 개수 조회',
          table: TABLE,
        });
      }
      const rows = (data ?? []) as Array<{ work_date: string; posting_count: number | string }>;
      const result: Record<string, number> = {};
      for (const row of rows) {
        result[row.work_date] = Number(row.posting_count);
      }
      logger.info('일반 공고 일자별 개수 조회 완료', {
        dates: Object.keys(result).length,
      });
      return result;
    } catch (error) {
      rethrowOrHandle(error, '일반 공고 일자별 개수 조회', { startDate, endDate });
    }
  }
```

- [ ] **Step 2-5: 테스트 실행 — 통과 확인**

```bash
cd uniqn-mobile && npx jest src/repositories/supabase/__tests__/JobPostingRepository.getRegularDateCounts.test.ts
```

예상: 5/5 pass.

- [ ] **Step 2-6: 타입체크 + 린트**

```bash
cd uniqn-mobile && npx tsc --noEmit && npx eslint src/repositories/supabase/JobPostingRepository.ts src/repositories/interfaces/IJobPostingRepository.ts
```

예상: 0 errors.

- [ ] **Step 2-7: 커밋**

```bash
cd uniqn-mobile && git add src/repositories/
git commit -m "feat(jobs): Repository에 일반 공고 일자별 개수 조회 메서드 추가

- IJobPostingRepository.getRegularDateCounts(startDate, endDate) 인터페이스
- SupabaseJobPostingRepository 구현 — RPC 래퍼 + bigint 정규화
- 단위 테스트 5종 (호출/변환/정규화/null/에러)"
```

---

## Task 3: `useRegularDateCounts` 훅

**Files:**
- Create: `uniqn-mobile/src/hooks/useRegularDateCounts.ts`
- Create: `uniqn-mobile/src/hooks/__tests__/useRegularDateCounts.test.ts`

- [ ] **Step 3-1: 실패 테스트 작성**

파일: `uniqn-mobile/src/hooks/__tests__/useRegularDateCounts.test.ts`

```typescript
/**
 * useRegularDateCounts — 달력 UI용 카운트 쿼리 훅 테스트
 */

import { renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

const mockGetRegularDateCounts = jest.fn();

jest.mock('@/repositories', () => ({
  jobPostingRepository: {
    getRegularDateCounts: (...args: unknown[]) => mockGetRegularDateCounts(...args),
  },
}));

import { useRegularDateCounts } from '../useRegularDateCounts';

function createWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

describe('useRegularDateCounts', () => {
  beforeEach(() => {
    mockGetRegularDateCounts.mockReset();
  });

  it('보이는 월 기준 주 단위 확장된 범위로 Repository 호출', async () => {
    // 2026-04-15는 4월(수요일). 4월 1일은 수요일 → startOfWeek(일요일 기준)는 3월 29일.
    // endOfMonth(4월)=4월 30일(목), endOfWeek(일요일 기준) = 5월 2일(토).
    mockGetRegularDateCounts.mockResolvedValueOnce({});
    const wrapper = createWrapper();

    renderHook(() => useRegularDateCounts(new Date('2026-04-15T00:00:00')), {
      wrapper,
    });

    await waitFor(() => {
      expect(mockGetRegularDateCounts).toHaveBeenCalledWith('2026-03-29', '2026-05-02');
    });
  });

  it('data에 카운트 맵이 반환된다', async () => {
    mockGetRegularDateCounts.mockResolvedValueOnce({
      '2026-04-14': 2,
      '2026-04-18': 12,
    });
    const wrapper = createWrapper();

    const { result } = renderHook(
      () => useRegularDateCounts(new Date('2026-04-15T00:00:00')),
      { wrapper }
    );

    await waitFor(() => {
      expect(result.current.data).toEqual({ '2026-04-14': 2, '2026-04-18': 12 });
    });
  });

  it('visibleMonth가 바뀌면 새 범위로 재호출', async () => {
    mockGetRegularDateCounts
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({});
    const wrapper = createWrapper();

    const { rerender } = renderHook(
      ({ month }: { month: Date }) => useRegularDateCounts(month),
      {
        wrapper,
        initialProps: { month: new Date('2026-04-15T00:00:00') },
      }
    );

    await waitFor(() => {
      expect(mockGetRegularDateCounts).toHaveBeenCalledTimes(1);
    });

    rerender({ month: new Date('2026-05-15T00:00:00') });

    await waitFor(() => {
      expect(mockGetRegularDateCounts).toHaveBeenCalledTimes(2);
    });
  });

  it('Repository 에러를 쿼리 에러로 전파', async () => {
    mockGetRegularDateCounts.mockRejectedValueOnce(new Error('RPC failed'));
    const wrapper = createWrapper();

    const { result } = renderHook(
      () => useRegularDateCounts(new Date('2026-04-15T00:00:00')),
      { wrapper }
    );

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });
});
```

- [ ] **Step 3-2: 테스트 실행 — 실패 확인**

```bash
cd uniqn-mobile && npx jest src/hooks/__tests__/useRegularDateCounts.test.ts
```

예상: 모두 FAIL (모듈 없음 또는 export 없음).

- [ ] **Step 3-3: 훅 구현**

파일: `uniqn-mobile/src/hooks/useRegularDateCounts.ts`

```typescript
/**
 * UNIQN Mobile - 일반 공고 일자별 개수 조회 훅
 *
 * @description DateCalendar UI의 달력 셀 뱃지용.
 *              보이는 월 기준 주 단위 확장된 범위(이전/다음 달 일부 포함)로 RPC 호출.
 *              월별 독립 캐시(5분 staleTime) — 월 전환 후 재방문 시 cache hit.
 * @version 1.0.0
 */

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  format,
} from 'date-fns';
import { cachingPolicies, queryKeys } from '@/lib/queryClient';
import { jobPostingRepository } from '@/repositories';

export function useRegularDateCounts(visibleMonth: Date) {
  const range = useMemo(() => {
    const start = startOfWeek(startOfMonth(visibleMonth), { weekStartsOn: 0 });
    const end = endOfWeek(endOfMonth(visibleMonth), { weekStartsOn: 0 });
    return {
      start: format(start, 'yyyy-MM-dd'),
      end: format(end, 'yyyy-MM-dd'),
    };
  }, [visibleMonth]);

  return useQuery({
    queryKey: [
      ...queryKeys.jobPostings.all,
      'regularDateCounts',
      range.start,
      range.end,
    ] as const,
    queryFn: () =>
      jobPostingRepository.getRegularDateCounts(range.start, range.end),
    staleTime: cachingPolicies.frequent,
    gcTime: cachingPolicies.standard * 2,
  });
}

export default useRegularDateCounts;
```

- [ ] **Step 3-4: 테스트 통과 확인**

```bash
cd uniqn-mobile && npx jest src/hooks/__tests__/useRegularDateCounts.test.ts
```

예상: 4/4 pass.

- [ ] **Step 3-5: 타입체크**

```bash
cd uniqn-mobile && npx tsc --noEmit
```

예상: 0 errors.

- [ ] **Step 3-6: 커밋**

```bash
cd uniqn-mobile && git add src/hooks/useRegularDateCounts.ts src/hooks/__tests__/useRegularDateCounts.test.ts
git commit -m "feat(jobs): useRegularDateCounts 훅 추가

DateCalendar UI의 월별 카운트 조회를 위한 TanStack Query 훅.
- 보이는 월 기준 주 단위 확장 범위 계산 (startOfWeek ~ endOfWeek)
- 월별 독립 캐시 (5분 staleTime)
- 단위 테스트 4종 (범위 계산/데이터 변환/재호출/에러)"
```

---

## Task 4: `CalendarCell` 컴포넌트

**Files:**
- Create: `uniqn-mobile/src/components/jobs/DateCalendar/CalendarCell.tsx`
- Create: `uniqn-mobile/src/components/jobs/DateCalendar/__tests__/CalendarCell.test.tsx`

- [ ] **Step 4-1: 실패 테스트 작성**

파일: `uniqn-mobile/src/components/jobs/DateCalendar/__tests__/CalendarCell.test.tsx`

```typescript
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { CalendarCell } from '../CalendarCell';

jest.mock('@/utils/haptics', () => ({
  triggerHaptic: jest.fn(),
}));

const BASE_DATE = new Date('2026-04-18T00:00:00'); // 토요일

describe('CalendarCell', () => {
  const baseProps = {
    date: BASE_DATE,
    count: 12,
    isToday: false,
    isSelected: false,
    isOutsideMonth: false,
    onPress: jest.fn(),
  };

  beforeEach(() => {
    baseProps.onPress = jest.fn();
  });

  it('기본 상태: 날짜 숫자와 카운트 뱃지 렌더', () => {
    const { getByText } = render(<CalendarCell {...baseProps} />);
    expect(getByText('18')).toBeTruthy();
    expect(getByText('12건')).toBeTruthy();
  });

  it('count=0이면 뱃지 미표시 + 탭 불가', () => {
    const { getByTestId, queryByText } = render(
      <CalendarCell {...baseProps} count={0} testID="cell" />
    );
    expect(queryByText(/건/)).toBeNull();
    fireEvent.press(getByTestId('cell'));
    expect(baseProps.onPress).not.toHaveBeenCalled();
  });

  it('isOutsideMonth=true이면 탭 불가', () => {
    const { getByTestId } = render(
      <CalendarCell {...baseProps} isOutsideMonth testID="cell" />
    );
    fireEvent.press(getByTestId('cell'));
    expect(baseProps.onPress).not.toHaveBeenCalled();
  });

  it('탭 가능한 경우 onPress 호출', () => {
    const { getByTestId } = render(<CalendarCell {...baseProps} testID="cell" />);
    fireEvent.press(getByTestId('cell'));
    expect(baseProps.onPress).toHaveBeenCalledWith(BASE_DATE);
  });

  it('탭 시 햅틱 light 트리거', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { triggerHaptic } = require('@/utils/haptics');
    const { getByTestId } = render(<CalendarCell {...baseProps} testID="cell" />);
    fireEvent.press(getByTestId('cell'));
    expect(triggerHaptic).toHaveBeenCalledWith('light');
  });

  it('accessibilityLabel에 날짜+요일+카운트 포함', () => {
    const { getByLabelText } = render(<CalendarCell {...baseProps} />);
    // "4월 18일 토요일 공고 12건" 형식
    expect(getByLabelText(/4월 18일.*토요일.*12건/)).toBeTruthy();
  });

  it('count=0일 때 accessibilityLabel에 "공고 없음"', () => {
    const { getByLabelText } = render(<CalendarCell {...baseProps} count={0} />);
    expect(getByLabelText(/공고 없음/)).toBeTruthy();
  });

  it('isSelected=true면 accessibilityState.selected=true', () => {
    const { getByTestId } = render(
      <CalendarCell {...baseProps} isSelected testID="cell" />
    );
    expect(getByTestId('cell').props.accessibilityState.selected).toBe(true);
  });
});
```

- [ ] **Step 4-2: 테스트 실행 — 실패 확인**

```bash
cd uniqn-mobile && npx jest src/components/jobs/DateCalendar/__tests__/CalendarCell.test.tsx
```

예상: 모두 FAIL.

- [ ] **Step 4-3: 컴포넌트 구현**

파일: `uniqn-mobile/src/components/jobs/DateCalendar/CalendarCell.tsx`

```typescript
/**
 * UNIQN Mobile - CalendarCell
 *
 * @description 달력 단일 날짜 셀 — 날짜 숫자 + 카운트 뱃지 + 오늘/선택/과거 상태
 * @version 1.0.0
 *
 * 스타일 결정 트리:
 *   isOutsideMonth   → opacity-30, disabled
 *   count === 0      → 뱃지 없음, disabled
 *   isSelected       → bg-primary-500, text-content-onGold, 뱃지 bg-[rgba(9,9,11,0.2)]
 *   isToday          → border-2 border-primary-500, 뱃지 bg-primary-500/15
 *   과거 + count>0   → opacity-60, 탭 가능, 뱃지 bg-primary-500/15
 *   기본             → 탭 가능, 뱃지 bg-primary-500/15
 */

import React, { memo, useCallback } from 'react';
import { View, Text, Pressable } from 'react-native';
import { format, isBefore, startOfDay } from 'date-fns';
import { ko } from 'date-fns/locale/ko';
import { triggerHaptic } from '@/utils/haptics';

interface CalendarCellProps {
  date: Date;
  count: number;
  isToday: boolean;
  isSelected: boolean;
  isOutsideMonth: boolean;
  onPress: (date: Date) => void;
  testID?: string;
}

export const CalendarCell = memo(function CalendarCell({
  date,
  count,
  isToday,
  isSelected,
  isOutsideMonth,
  onPress,
  testID,
}: CalendarCellProps) {
  const disabled = isOutsideMonth || count === 0;
  const isPast = isBefore(startOfDay(date), startOfDay(new Date()));
  const dayNumber = format(date, 'd');
  const fullLabel = format(date, 'M월 d일 EEEE', { locale: ko });
  const countLabel = count > 0 ? `공고 ${count}건` : '공고 없음';

  const handlePress = useCallback(() => {
    if (disabled) return;
    void triggerHaptic('light');
    onPress(date);
  }, [date, disabled, onPress]);

  const containerBase =
    'flex-1 items-center justify-center min-h-[64px] rounded-sm mx-0.5 my-0.5';
  const containerState = isSelected
    ? 'bg-primary-500'
    : isToday
      ? 'border-2 border-primary-500'
      : '';
  const opacityClass = isOutsideMonth ? 'opacity-30' : isPast && !isSelected ? 'opacity-60' : '';

  const numberColor = isSelected
    ? 'text-content-onGold'
    : isToday
      ? 'text-primary-500'
      : 'text-content-primary';

  const badgeBase =
    'rounded-sm px-1.5 py-0.5 mt-1 text-[10px] font-sans-medium';
  const badgeColor = isSelected
    ? 'bg-[rgba(9,9,11,0.2)] text-content-onGold'
    : 'bg-primary-500/15 text-content-primary';

  return (
    <Pressable
      testID={testID}
      disabled={disabled}
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={`${fullLabel} ${countLabel}`}
      accessibilityState={{ selected: isSelected, disabled }}
      className={`${containerBase} ${containerState} ${opacityClass}`}
      style={({ pressed }) =>
        pressed && !disabled
          ? { backgroundColor: 'rgba(34, 34, 40, 0.4)' }
          : undefined
      }
    >
      <Text className={`text-sm font-sans-medium ${numberColor}`}>
        {dayNumber}
      </Text>
      {count > 0 && !isOutsideMonth && (
        <Text className={`${badgeBase} ${badgeColor}`}>{count}건</Text>
      )}
    </Pressable>
  );
});

export default CalendarCell;
```

- [ ] **Step 4-4: 테스트 통과 확인**

```bash
cd uniqn-mobile && npx jest src/components/jobs/DateCalendar/__tests__/CalendarCell.test.tsx
```

예상: 8/8 pass.

- [ ] **Step 4-5: 커밋**

```bash
cd uniqn-mobile && git add src/components/jobs/DateCalendar/
git commit -m "feat(jobs): CalendarCell 컴포넌트 추가

일반탭 달력 단일 날짜 셀.
- 날짜 숫자 + 카운트 뱃지 (bg-primary-500/15)
- 오늘=골드 테두리, 선택=골드 채움, 과거=흐림, 0건=비활성
- 탭 햅틱 light + accessibilityLabel 전체 문장
- 단위 테스트 8종"
```

---

## Task 5: `CalendarGrid` 컴포넌트

**Files:**
- Create: `uniqn-mobile/src/components/jobs/DateCalendar/CalendarGrid.tsx`
- Create: `uniqn-mobile/src/components/jobs/DateCalendar/__tests__/CalendarGrid.test.tsx`

- [ ] **Step 5-1: 실패 테스트 작성**

파일: `uniqn-mobile/src/components/jobs/DateCalendar/__tests__/CalendarGrid.test.tsx`

```typescript
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { CalendarGrid } from '../CalendarGrid';

jest.mock('@/utils/haptics', () => ({ triggerHaptic: jest.fn() }));

describe('CalendarGrid', () => {
  it('요일 헤더 7개 렌더 (일~토)', () => {
    const { getByText } = render(
      <CalendarGrid
        visibleMonth={new Date('2026-04-15T00:00:00')}
        selectedDate={null}
        counts={{}}
        onDateSelect={jest.fn()}
      />
    );
    ['일', '월', '화', '수', '목', '금', '토'].forEach((d) => {
      expect(getByText(d)).toBeTruthy();
    });
  });

  it('2026-04 기준 날짜 35칸 (5주) 렌더 — 4월 1일=수, 30일=목, 5주로 커버', () => {
    const { getAllByTestId } = render(
      <CalendarGrid
        visibleMonth={new Date('2026-04-15T00:00:00')}
        selectedDate={null}
        counts={{}}
        onDateSelect={jest.fn()}
      />
    );
    // Sun Mar 29 ~ Sat May 2 = 35 days
    const cells = getAllByTestId(/^calendar-cell-/);
    expect(cells.length).toBe(35);
  });

  it('카운트 맵에 있는 날짜만 뱃지 표시', () => {
    const { getByText, queryAllByText } = render(
      <CalendarGrid
        visibleMonth={new Date('2026-04-15T00:00:00')}
        selectedDate={null}
        counts={{ '2026-04-18': 12, '2026-04-14': 2 }}
        onDateSelect={jest.fn()}
      />
    );
    expect(getByText('12건')).toBeTruthy();
    expect(getByText('2건')).toBeTruthy();
    // 다른 날짜엔 "건" 텍스트가 그 2개뿐
    expect(queryAllByText(/건$/).length).toBe(2);
  });

  it('셀 탭 시 onDateSelect 호출', () => {
    const onSelect = jest.fn();
    const { getByTestId } = render(
      <CalendarGrid
        visibleMonth={new Date('2026-04-15T00:00:00')}
        selectedDate={null}
        counts={{ '2026-04-18': 12 }}
        onDateSelect={onSelect}
      />
    );
    fireEvent.press(getByTestId('calendar-cell-2026-04-18'));
    expect(onSelect).toHaveBeenCalledWith(expect.any(Date));
    const calledDate: Date = onSelect.mock.calls[0][0];
    expect(calledDate.toISOString().slice(0, 10)).toBe('2026-04-18');
  });
});
```

- [ ] **Step 5-2: 테스트 실행 — 실패 확인**

```bash
cd uniqn-mobile && npx jest src/components/jobs/DateCalendar/__tests__/CalendarGrid.test.tsx
```

예상: 모두 FAIL.

- [ ] **Step 5-3: 컴포넌트 구현**

파일: `uniqn-mobile/src/components/jobs/DateCalendar/CalendarGrid.tsx`

```typescript
/**
 * UNIQN Mobile - CalendarGrid
 *
 * @description 7×N 달력 그리드 (요일 헤더 + 날짜 셀). CalendarCell 조합.
 * @version 1.0.0
 */

import React, { memo, useMemo } from 'react';
import { View, Text } from 'react-native';
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  isSameDay,
  isSameMonth,
  isToday as dfIsToday,
} from 'date-fns';
import { CalendarCell } from './CalendarCell';

interface CalendarGridProps {
  visibleMonth: Date;
  selectedDate: Date | null;
  counts: Record<string, number>;
  onDateSelect: (date: Date) => void;
}

const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'] as const;

function weekdayColor(index: number): string {
  if (index === 0) return 'text-error-500';
  if (index === 6) return 'text-info-500';
  return 'text-content-secondary';
}

export const CalendarGrid = memo(function CalendarGrid({
  visibleMonth,
  selectedDate,
  counts,
  onDateSelect,
}: CalendarGridProps) {
  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(visibleMonth), { weekStartsOn: 0 });
    const end = endOfWeek(endOfMonth(visibleMonth), { weekStartsOn: 0 });
    return eachDayOfInterval({ start, end });
  }, [visibleMonth]);

  return (
    <View>
      {/* 요일 헤더 */}
      <View className="flex-row border-b border-divider">
        {WEEKDAY_LABELS.map((label, index) => (
          <View key={label} className="flex-1 items-center py-2">
            <Text className={`text-xs font-sans-medium ${weekdayColor(index)}`}>
              {label}
            </Text>
          </View>
        ))}
      </View>

      {/* 날짜 그리드 */}
      <View className="flex-row flex-wrap">
        {days.map((day) => {
          const key = format(day, 'yyyy-MM-dd');
          const count = counts[key] ?? 0;
          const isOutsideMonth = !isSameMonth(day, visibleMonth);
          const isSelected = selectedDate !== null && isSameDay(day, selectedDate);
          return (
            <View key={key} style={{ width: `${100 / 7}%` }}>
              <CalendarCell
                date={day}
                count={count}
                isToday={dfIsToday(day)}
                isSelected={isSelected}
                isOutsideMonth={isOutsideMonth}
                onPress={onDateSelect}
                testID={`calendar-cell-${key}`}
              />
            </View>
          );
        })}
      </View>
    </View>
  );
});

export default CalendarGrid;
```

- [ ] **Step 5-4: 테스트 통과 확인**

```bash
cd uniqn-mobile && npx jest src/components/jobs/DateCalendar/__tests__/CalendarGrid.test.tsx
```

예상: 4/4 pass.

- [ ] **Step 5-5: 커밋**

```bash
cd uniqn-mobile && git add src/components/jobs/DateCalendar/CalendarGrid.tsx src/components/jobs/DateCalendar/__tests__/CalendarGrid.test.tsx
git commit -m "feat(jobs): CalendarGrid 컴포넌트 추가

7×N 달력 그리드 (요일 헤더 + 날짜 셀).
- 일=red, 토=info blue, 평일=secondary (impeccable Rule 13 다축 위계)
- 주 단위 확장 날짜 배열 생성 (startOfWeek~endOfWeek)
- CalendarCell 조합
- 단위 테스트 4종"
```

---

## Task 6: `CalendarHeader` 컴포넌트

**Files:**
- Create: `uniqn-mobile/src/components/jobs/DateCalendar/CalendarHeader.tsx`
- Create: `uniqn-mobile/src/components/jobs/DateCalendar/__tests__/CalendarHeader.test.tsx`

- [ ] **Step 6-1: 실패 테스트 작성**

파일: `uniqn-mobile/src/components/jobs/DateCalendar/__tests__/CalendarHeader.test.tsx`

```typescript
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { CalendarHeader } from '../CalendarHeader';

jest.mock('@/utils/haptics', () => ({ triggerHaptic: jest.fn() }));
jest.mock('@/components/icons', () => ({
  ChevronLeftIcon: (props: unknown) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Text } = require('react-native');
    return <Text {...(props as object)}>‹</Text>;
  },
  ChevronRightIcon: (props: unknown) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Text } = require('react-native');
    return <Text {...(props as object)}>›</Text>;
  },
}));

describe('CalendarHeader', () => {
  const baseProps = {
    visibleMonth: new Date('2026-04-15T00:00:00'),
    canGoPrev: true,
    canGoNext: true,
    hasSelection: false,
    onPrev: jest.fn(),
    onNext: jest.fn(),
    onClearSelection: jest.fn(),
  };

  beforeEach(() => {
    baseProps.onPrev = jest.fn();
    baseProps.onNext = jest.fn();
    baseProps.onClearSelection = jest.fn();
  });

  it('월 이름 표시 (2026년 4월)', () => {
    const { getByText } = render(<CalendarHeader {...baseProps} />);
    expect(getByText('2026년 4월')).toBeTruthy();
  });

  it('좌우 화살표 탭 시 콜백', () => {
    const { getByLabelText } = render(<CalendarHeader {...baseProps} />);
    fireEvent.press(getByLabelText('이전 달'));
    expect(baseProps.onPrev).toHaveBeenCalled();
    fireEvent.press(getByLabelText('다음 달'));
    expect(baseProps.onNext).toHaveBeenCalled();
  });

  it('canGoPrev=false면 이전 화살표 disabled', () => {
    const { getByLabelText } = render(
      <CalendarHeader {...baseProps} canGoPrev={false} />
    );
    fireEvent.press(getByLabelText('이전 달'));
    expect(baseProps.onPrev).not.toHaveBeenCalled();
  });

  it('canGoNext=false면 다음 화살표 disabled', () => {
    const { getByLabelText } = render(
      <CalendarHeader {...baseProps} canGoNext={false} />
    );
    fireEvent.press(getByLabelText('다음 달'));
    expect(baseProps.onNext).not.toHaveBeenCalled();
  });

  it('hasSelection=false면 "전체 보기" 버튼 미표시', () => {
    const { queryByText } = render(<CalendarHeader {...baseProps} />);
    expect(queryByText('전체 보기')).toBeNull();
  });

  it('hasSelection=true면 "전체 보기" 탭 가능', () => {
    const { getByText } = render(
      <CalendarHeader {...baseProps} hasSelection />
    );
    fireEvent.press(getByText('전체 보기'));
    expect(baseProps.onClearSelection).toHaveBeenCalled();
  });
});
```

- [ ] **Step 6-2: 테스트 실행 — 실패 확인**

```bash
cd uniqn-mobile && npx jest src/components/jobs/DateCalendar/__tests__/CalendarHeader.test.tsx
```

예상: 모두 FAIL.

- [ ] **Step 6-3: 아이콘 export 확인**

`ChevronLeftIcon`, `ChevronRightIcon`이 `@/components/icons`에 있는지 확인:

```bash
grep -n "ChevronLeftIcon\|ChevronRightIcon" uniqn-mobile/src/components/icons/index.tsx
```

**만약 없으면** `icons/index.tsx`에 추가 (Lucide 팩토리 패턴 기존 파일 참고):

```typescript
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
// ... 기존 createIcon 팩토리가 있다면 그것 사용
export const ChevronLeftIcon = /* factory-wrapped */;
export const ChevronRightIcon = /* factory-wrapped */;
```

없는 경우 기존 파일의 패턴을 그대로 따를 것. 있으면 이 단계는 skip.

- [ ] **Step 6-4: 컴포넌트 구현**

파일: `uniqn-mobile/src/components/jobs/DateCalendar/CalendarHeader.tsx`

```typescript
/**
 * UNIQN Mobile - CalendarHeader
 *
 * @description 달력 상단 헤더 — 월 이동 화살표 + 월 이름 + "전체 보기" 버튼
 * @version 1.0.0
 */

import React, { memo, useCallback } from 'react';
import { View, Text, Pressable } from 'react-native';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale/ko';
import { ChevronLeftIcon, ChevronRightIcon } from '@/components/icons';
import { triggerHaptic } from '@/utils/haptics';

interface CalendarHeaderProps {
  visibleMonth: Date;
  canGoPrev: boolean;
  canGoNext: boolean;
  hasSelection: boolean;
  onPrev: () => void;
  onNext: () => void;
  onClearSelection: () => void;
}

export const CalendarHeader = memo(function CalendarHeader({
  visibleMonth,
  canGoPrev,
  canGoNext,
  hasSelection,
  onPrev,
  onNext,
  onClearSelection,
}: CalendarHeaderProps) {
  const monthLabel = format(visibleMonth, 'yyyy년 M월', { locale: ko });

  const handlePrev = useCallback(() => {
    if (!canGoPrev) return;
    void triggerHaptic('light');
    onPrev();
  }, [canGoPrev, onPrev]);

  const handleNext = useCallback(() => {
    if (!canGoNext) return;
    void triggerHaptic('light');
    onNext();
  }, [canGoNext, onNext]);

  return (
    <View className="flex-row items-center px-4 py-3">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="이전 달"
        accessibilityState={{ disabled: !canGoPrev }}
        disabled={!canGoPrev}
        onPress={handlePrev}
        hitSlop={10}
        className={`w-11 h-11 items-center justify-center ${canGoPrev ? '' : 'opacity-40'}`}
      >
        <ChevronLeftIcon size={24} />
      </Pressable>

      <View className="flex-1 items-center">
        <Text
          className="text-base font-sans-semibold text-content-primary"
          accessibilityRole="header"
        >
          {monthLabel}
        </Text>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="다음 달"
        accessibilityState={{ disabled: !canGoNext }}
        disabled={!canGoNext}
        onPress={handleNext}
        hitSlop={10}
        className={`w-11 h-11 items-center justify-center ${canGoNext ? '' : 'opacity-40'}`}
      >
        <ChevronRightIcon size={24} />
      </Pressable>

      {hasSelection && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="전체 날짜 보기"
          onPress={() => {
            void triggerHaptic('light');
            onClearSelection();
          }}
          hitSlop={10}
          className="ml-2 px-2 py-1"
        >
          <Text className="text-xs font-sans-medium text-content-secondary">
            전체 보기
          </Text>
        </Pressable>
      )}
    </View>
  );
});

export default CalendarHeader;
```

- [ ] **Step 6-5: 테스트 통과 확인**

```bash
cd uniqn-mobile && npx jest src/components/jobs/DateCalendar/__tests__/CalendarHeader.test.tsx
```

예상: 6/6 pass.

- [ ] **Step 6-6: 커밋**

```bash
cd uniqn-mobile && git add src/components/jobs/DateCalendar/CalendarHeader.tsx src/components/jobs/DateCalendar/__tests__/CalendarHeader.test.tsx src/components/icons/
git commit -m "feat(jobs): CalendarHeader 컴포넌트 추가

달력 상단 월 이동 + \"전체 보기\" 버튼.
- 좌우 화살표 44×44 터치 타깃 (hitSlop 10)
- 경계 도달 시 opacity-40 + disabled
- hasSelection=true일 때만 \"전체 보기\" 노출
- 단위 테스트 6종"
```

---

## Task 7: `CollapsedHeader` 컴포넌트

**Files:**
- Create: `uniqn-mobile/src/components/jobs/DateCalendar/CollapsedHeader.tsx`
- Create: `uniqn-mobile/src/components/jobs/DateCalendar/__tests__/CollapsedHeader.test.tsx`

- [ ] **Step 7-1: 실패 테스트 작성**

파일: `uniqn-mobile/src/components/jobs/DateCalendar/__tests__/CollapsedHeader.test.tsx`

```typescript
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { CollapsedHeader } from '../CollapsedHeader';

jest.mock('@/utils/haptics', () => ({ triggerHaptic: jest.fn() }));
jest.mock('@/components/icons', () => ({
  CalendarIcon: () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Text } = require('react-native');
    return <Text>📅</Text>;
  },
  XIcon: () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Text } = require('react-native');
    return <Text>✕</Text>;
  },
}));

describe('CollapsedHeader', () => {
  const baseProps = {
    selectedDate: new Date('2026-04-18T00:00:00'),
    count: 12,
    onExpand: jest.fn(),
    onClear: jest.fn(),
  };

  beforeEach(() => {
    baseProps.onExpand = jest.fn();
    baseProps.onClear = jest.fn();
  });

  it('선택 날짜 요약 렌더 (4월 18일 (토) · 12건)', () => {
    const { getByText } = render(<CollapsedHeader {...baseProps} />);
    expect(getByText(/4월 18일.*토.*12건/)).toBeTruthy();
  });

  it('헤더 탭 시 onExpand 호출', () => {
    const { getByLabelText } = render(<CollapsedHeader {...baseProps} />);
    fireEvent.press(getByLabelText(/날짜 필터 펼치기/));
    expect(baseProps.onExpand).toHaveBeenCalled();
  });

  it('✕ 탭 시 onClear 호출 + onExpand 호출 안 됨', () => {
    const { getByLabelText } = render(<CollapsedHeader {...baseProps} />);
    fireEvent.press(getByLabelText('날짜 필터 해제'));
    expect(baseProps.onClear).toHaveBeenCalled();
    expect(baseProps.onExpand).not.toHaveBeenCalled();
  });

  it('count=0이어도 요약에 "0건" 표시', () => {
    const { getByText } = render(<CollapsedHeader {...baseProps} count={0} />);
    expect(getByText(/0건/)).toBeTruthy();
  });
});
```

- [ ] **Step 7-2: 테스트 실행 — 실패 확인**

```bash
cd uniqn-mobile && npx jest src/components/jobs/DateCalendar/__tests__/CollapsedHeader.test.tsx
```

예상: 모두 FAIL.

- [ ] **Step 7-3: 아이콘 확인**

`CalendarIcon`, `XIcon`이 `@/components/icons`에 있는지 확인:

```bash
grep -n "CalendarIcon\|XIcon\b" uniqn-mobile/src/components/icons/index.tsx
```

없으면 기존 팩토리 패턴으로 추가 (`ChevronLeft` 등과 같은 방식, lucide `Calendar`, `X` 아이콘 매핑).

- [ ] **Step 7-4: 컴포넌트 구현**

파일: `uniqn-mobile/src/components/jobs/DateCalendar/CollapsedHeader.tsx`

```typescript
/**
 * UNIQN Mobile - CollapsedHeader
 *
 * @description 달력이 접힌 상태의 헤더 — 선택 요약 + 펼치기 탭 + ✕ 해제
 * @version 1.0.0
 *
 * H1 디자인 (spec 결정 #8):
 *   [ 📅  4월 18일 (토) · 12건              [ ✕ ] ]
 *   ↑ 왼쪽 영역 전체 탭 = 펼치기    ↑ ✕ = 선택 해제
 */

import React, { memo, useCallback } from 'react';
import { View, Text, Pressable } from 'react-native';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale/ko';
import { CalendarIcon, XIcon } from '@/components/icons';
import { triggerHaptic } from '@/utils/haptics';

interface CollapsedHeaderProps {
  selectedDate: Date;
  count: number;
  onExpand: () => void;
  onClear: () => void;
}

export const CollapsedHeader = memo(function CollapsedHeader({
  selectedDate,
  count,
  onExpand,
  onClear,
}: CollapsedHeaderProps) {
  const summary = `${format(selectedDate, 'M월 d일 (E)', { locale: ko })} · ${count}건`;

  const handleExpand = useCallback(() => {
    void triggerHaptic('light');
    onExpand();
  }, [onExpand]);

  const handleClear = useCallback(() => {
    void triggerHaptic('light');
    onClear();
  }, [onClear]);

  return (
    <View
      className="flex-row items-center bg-surface-card dark:bg-surface-elevated border-b border-divider"
      style={{ minHeight: 48 }}
    >
      <Pressable
        onPress={handleExpand}
        accessibilityRole="button"
        accessibilityLabel={`날짜 필터 펼치기, 현재 ${summary} 선택됨`}
        className="flex-1 flex-row items-center px-4 py-3"
        style={({ pressed }) =>
          pressed ? { backgroundColor: 'rgba(34,34,40,0.2)' } : undefined
        }
      >
        <CalendarIcon size={16} />
        <Text className="ml-2 text-sm font-sans-medium text-content-primary">
          {summary}
        </Text>
      </Pressable>

      <Pressable
        onPress={handleClear}
        accessibilityRole="button"
        accessibilityLabel="날짜 필터 해제"
        hitSlop={10}
        className="w-11 h-11 items-center justify-center"
      >
        <XIcon size={16} />
      </Pressable>
    </View>
  );
});

export default CollapsedHeader;
```

- [ ] **Step 7-5: 테스트 통과 확인**

```bash
cd uniqn-mobile && npx jest src/components/jobs/DateCalendar/__tests__/CollapsedHeader.test.tsx
```

예상: 4/4 pass.

- [ ] **Step 7-6: 커밋**

```bash
cd uniqn-mobile && git add src/components/jobs/DateCalendar/CollapsedHeader.tsx src/components/jobs/DateCalendar/__tests__/CollapsedHeader.test.tsx src/components/icons/
git commit -m "feat(jobs): CollapsedHeader 컴포넌트 추가

접힌 달력의 헤더 — 선택 요약 + 펼치기 탭 + ✕ 해제.
- 전체 Pressable 탭 = onExpand, ✕ 별도 Pressable = onClear
- accessibilityLabel 전체 문장 (VoiceOver)
- 단위 테스트 4종"
```

---

## Task 8: `DateCalendar` 상태머신 컴포넌트

**Files:**
- Create: `uniqn-mobile/src/components/jobs/DateCalendar/DateCalendar.tsx`
- Create: `uniqn-mobile/src/components/jobs/DateCalendar/index.ts`
- Create: `uniqn-mobile/src/components/jobs/DateCalendar/__tests__/DateCalendar.test.tsx`

- [ ] **Step 8-1: 실패 테스트 작성**

파일: `uniqn-mobile/src/components/jobs/DateCalendar/__tests__/DateCalendar.test.tsx`

```typescript
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DateCalendar } from '../DateCalendar';

const mockGetRegularDateCounts = jest.fn();

jest.mock('@/repositories', () => ({
  jobPostingRepository: {
    getRegularDateCounts: (...args: unknown[]) => mockGetRegularDateCounts(...args),
  },
}));

jest.mock('@/utils/haptics', () => ({ triggerHaptic: jest.fn() }));

// 아이콘을 텍스트로 스텁 (Task 6/7 이미 추가됨 — 이 테스트에서도 간단 스텁)
jest.mock('@/components/icons', () => ({
  ChevronLeftIcon: () => null,
  ChevronRightIcon: () => null,
  CalendarIcon: () => null,
  XIcon: () => null,
}));

function renderWithClient(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

describe('DateCalendar 상태머신', () => {
  beforeEach(() => {
    mockGetRegularDateCounts.mockReset();
    mockGetRegularDateCounts.mockResolvedValue({ '2026-04-18': 12 });
    // 2026-04-19 고정 시각 — Date.now()만 고정하고 setTimeout 등은 실제 유지
    // (TanStack Query + waitFor가 real timer에 의존).
    jest.useFakeTimers({
      doNotFake: [
        'setTimeout',
        'setInterval',
        'clearTimeout',
        'clearInterval',
        'nextTick',
        'queueMicrotask',
        'setImmediate',
        'requestAnimationFrame',
      ],
    });
    jest.setSystemTime(new Date('2026-04-19T00:00:00'));
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('마운트 시 expanded — 그리드 렌더', async () => {
    const { findByTestId } = renderWithClient(
      <DateCalendar selectedDate={null} onDateSelect={jest.fn()} />
    );
    // 달력 셀 존재 = 펼쳐진 상태
    expect(await findByTestId('calendar-cell-2026-04-18')).toBeTruthy();
  });

  it('날짜 셀 탭 시 onDateSelect + 상태 collapsed로 전환', async () => {
    const onSelect = jest.fn();
    const { findByTestId, queryByTestId, getByLabelText } = renderWithClient(
      <DateCalendar selectedDate={null} onDateSelect={onSelect} />
    );
    const cell = await findByTestId('calendar-cell-2026-04-18');
    fireEvent.press(cell);
    expect(onSelect).toHaveBeenCalled();
    await waitFor(() => {
      // collapsed 헤더의 accessibilityLabel은 "날짜 필터 펼치기..."로 시작
      expect(getByLabelText(/날짜 필터 펼치기/)).toBeTruthy();
      // 그리드 셀은 사라짐
      expect(queryByTestId('calendar-cell-2026-04-18')).toBeNull();
    });
  });

  it('collapsed 헤더 탭 시 expanded 복귀', async () => {
    const { findByTestId, getByLabelText } = renderWithClient(
      <DateCalendar
        selectedDate={new Date('2026-04-18T00:00:00')}
        onDateSelect={jest.fn()}
      />
    );
    // selectedDate가 있으면 collapsed로 시작 (상태 머신 결정: selectedDate!=null이면 collapsed)
    const header = getByLabelText(/날짜 필터 펼치기/);
    fireEvent.press(header);
    expect(await findByTestId('calendar-cell-2026-04-18')).toBeTruthy();
  });

  it('collapsed ✕ 탭 시 onDateSelect(null) + expanded 복귀', async () => {
    const onSelect = jest.fn();
    const { getByLabelText, findByTestId } = renderWithClient(
      <DateCalendar
        selectedDate={new Date('2026-04-18T00:00:00')}
        onDateSelect={onSelect}
      />
    );
    fireEvent.press(getByLabelText('날짜 필터 해제'));
    expect(onSelect).toHaveBeenCalledWith(null);
    // ✕ 이후 expanded 복귀 — onSelect(null)를 부모가 처리한 뒤 상태 리렌더
    // 부모 없이 단독 테스트에서는 내부 상태만으로 expanded 확인
    expect(await findByTestId('calendar-cell-2026-04-18')).toBeTruthy();
  });

  it('selectedDate prop이 외부에서 null로 바뀌면 expanded 복귀', async () => {
    const { rerender, findByTestId, queryByTestId } = renderWithClient(
      <DateCalendar
        selectedDate={new Date('2026-04-18T00:00:00')}
        onDateSelect={jest.fn()}
      />
    );
    expect(queryByTestId('calendar-cell-2026-04-18')).toBeNull();
    rerender(
      <QueryClientProvider
        client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
      >
        <DateCalendar selectedDate={null} onDateSelect={jest.fn()} />
      </QueryClientProvider>
    );
    expect(await findByTestId('calendar-cell-2026-04-18')).toBeTruthy();
  });
});
```

- [ ] **Step 8-2: 테스트 실행 — 실패 확인**

```bash
cd uniqn-mobile && npx jest src/components/jobs/DateCalendar/__tests__/DateCalendar.test.tsx
```

예상: 모듈 없음으로 모두 FAIL.

- [ ] **Step 8-3: 컴포넌트 구현**

파일: `uniqn-mobile/src/components/jobs/DateCalendar/DateCalendar.tsx`

```typescript
/**
 * UNIQN Mobile - DateCalendar
 *
 * @description 일반 공고 탭 날짜 필터의 상태머신 컴포넌트.
 *   - 기본 expanded (첫 진입: 달력 표시)
 *   - 날짜 선택 → collapsed (요약 헤더)
 *   - collapsed 헤더 탭 → expanded
 *   - collapsed ✕ → expanded + onDateSelect(null)
 *   - 외부에서 selectedDate=null로 변경 → expanded
 * @version 1.0.0
 *
 * 월 범위: 오늘의 전월 1일 ~ 오늘의 +3개월 말일 (spec 결정 #2).
 */

import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import {
  addMonths,
  isBefore,
  isAfter,
  startOfMonth,
  endOfMonth,
  subMonths,
  format,
} from 'date-fns';
import { useRegularDateCounts } from '@/hooks/useRegularDateCounts';
import { CalendarHeader } from './CalendarHeader';
import { CalendarGrid } from './CalendarGrid';
import { CollapsedHeader } from './CollapsedHeader';

interface DateCalendarProps {
  selectedDate: Date | null;
  onDateSelect: (date: Date | null) => void;
  className?: string;
}

type Mode = 'expanded' | 'collapsed';

export const DateCalendar = memo(function DateCalendar({
  selectedDate,
  onDateSelect,
  className = '',
}: DateCalendarProps) {
  // selectedDate가 주어지면 시작부터 collapsed (재진입 시 자연스러움).
  // 없으면 expanded (spec 결정 #1 C).
  const [mode, setMode] = useState<Mode>(selectedDate ? 'collapsed' : 'expanded');
  const [visibleMonth, setVisibleMonth] = useState<Date>(
    selectedDate ?? startOfMonth(new Date())
  );

  // 월 범위 경계 (spec 결정 #2: -1 ~ +3개월)
  const { minMonth, maxMonth } = useMemo(() => {
    const today = new Date();
    return {
      minMonth: startOfMonth(subMonths(today, 1)),
      maxMonth: startOfMonth(addMonths(today, 3)),
    };
  }, []);

  const canGoPrev = isAfter(visibleMonth, minMonth);
  const canGoNext = isBefore(visibleMonth, maxMonth);

  // 외부 selectedDate=null 변경 시 expanded로 동기화
  useEffect(() => {
    if (selectedDate === null) setMode('expanded');
  }, [selectedDate]);

  // 카운트 쿼리
  const { data: counts = {} } = useRegularDateCounts(visibleMonth);

  const handleDateSelect = useCallback(
    (date: Date) => {
      onDateSelect(date);
      setMode('collapsed');
    },
    [onDateSelect]
  );

  const handleExpand = useCallback(() => setMode('expanded'), []);

  const handleClearSelection = useCallback(() => {
    onDateSelect(null);
    setMode('expanded');
  }, [onDateSelect]);

  const handlePrevMonth = useCallback(() => {
    setVisibleMonth((m) => subMonths(m, 1));
  }, []);

  const handleNextMonth = useCallback(() => {
    setVisibleMonth((m) => addMonths(m, 1));
  }, []);

  if (mode === 'collapsed' && selectedDate) {
    const key = format(selectedDate, 'yyyy-MM-dd');
    const count = counts[key] ?? 0;
    return (
      <View className={className}>
        <CollapsedHeader
          selectedDate={selectedDate}
          count={count}
          onExpand={handleExpand}
          onClear={handleClearSelection}
        />
      </View>
    );
  }

  return (
    <View
      className={`bg-surface-card dark:bg-surface-elevated border-b border-divider ${className}`}
    >
      <CalendarHeader
        visibleMonth={visibleMonth}
        canGoPrev={canGoPrev}
        canGoNext={canGoNext}
        hasSelection={selectedDate !== null}
        onPrev={handlePrevMonth}
        onNext={handleNextMonth}
        onClearSelection={handleClearSelection}
      />
      <CalendarGrid
        visibleMonth={visibleMonth}
        selectedDate={selectedDate}
        counts={counts}
        onDateSelect={handleDateSelect}
      />
    </View>
  );
});

export default DateCalendar;
```

- [ ] **Step 8-4: Barrel export 작성**

파일: `uniqn-mobile/src/components/jobs/DateCalendar/index.ts`

```typescript
export { DateCalendar } from './DateCalendar';
```

- [ ] **Step 8-5: 테스트 통과 확인**

```bash
cd uniqn-mobile && npx jest src/components/jobs/DateCalendar/__tests__/DateCalendar.test.tsx
```

예상: 5/5 pass.

- [ ] **Step 8-6: 전체 DateCalendar 테스트 일괄 실행**

```bash
cd uniqn-mobile && npx jest src/components/jobs/DateCalendar/
```

예상: 모든 테스트 파일 pass (CalendarCell 8 + CalendarGrid 4 + CalendarHeader 6 + CollapsedHeader 4 + DateCalendar 5 = 27개).

- [ ] **Step 8-7: 커밋**

```bash
cd uniqn-mobile && git add src/components/jobs/DateCalendar/
git commit -m "feat(jobs): DateCalendar 상태머신 컴포넌트 추가

구인구직 일반탭 날짜 필터의 메인 진입 컴포넌트.
- 기본 expanded → 날짜 선택 시 collapsed 전환
- collapsed 헤더 탭 = 재펼침, ✕ = 선택 해제 + 재펼침
- 외부 selectedDate=null 변경 시 expanded 동기화
- 월 범위: -1 ~ +3개월 (경계 도달 시 화살표 disabled)
- 상태머신 단위 테스트 5종"
```

---

## Task 9: 컴포넌트 배럴 export 업데이트 + JobsScreen 통합

**Files:**
- Modify: `uniqn-mobile/src/components/jobs/index.ts`
- Modify: `uniqn-mobile/app/(app)/(tabs)/index.tsx`

- [ ] **Step 9-1: jobs/index.ts 수정**

파일: `uniqn-mobile/src/components/jobs/index.ts`

변경 (line 36~38 영역):

```typescript
// BEFORE
export { PostingTypeChips } from './PostingTypeChips';
export { DateSlider } from './DateSlider';
export { SearchBar } from './SearchBar';

// AFTER
export { PostingTypeChips } from './PostingTypeChips';
export { DateCalendar } from './DateCalendar';
export { SearchBar } from './SearchBar';
```

`DateSlider` export는 제거. 파일 자체는 유지(spec 결정 #5-3, Q3 2026 knip 확인 후 완전 제거).

- [ ] **Step 9-2: JobsScreen 수정**

파일: `uniqn-mobile/app/(app)/(tabs)/index.tsx`

**Line 11 (import):**

```typescript
// BEFORE
import { JobList, PostingTypeChips, DateSlider, SearchBar } from '@/components/jobs';

// AFTER
import { JobList, PostingTypeChips, DateCalendar, SearchBar } from '@/components/jobs';
```

**Line 177~179 (렌더):**

```tsx
// BEFORE
{selectedType === 'regular' && (
  <DateSlider selectedDate={selectedDate} onDateSelect={setSelectedDate} />
)}

// AFTER
{selectedType === 'regular' && (
  <DateCalendar selectedDate={selectedDate} onDateSelect={setSelectedDate} />
)}
```

그 외 로직(`filters`, `selectedDateString`, `handleTypeChange`)은 변경 불필요.

- [ ] **Step 9-3: 타입체크 통과 확인**

```bash
cd uniqn-mobile && npx tsc --noEmit
```

예상: 0 errors.

- [ ] **Step 9-4: 관련 테스트 회귀 확인 (JobsScreen.test.tsx 제외 — 다음 Task에서)**

```bash
cd uniqn-mobile && npx jest src/components/jobs/
```

예상: DateCalendar 디렉토리 27개 + 기존 jobs 컴포넌트 테스트 모두 pass.

- [ ] **Step 9-5: 커밋**

```bash
cd uniqn-mobile && git add src/components/jobs/index.ts app/\(app\)/\(tabs\)/index.tsx
git commit -m "feat(jobs): JobsScreen 일반탭 날짜필터를 달력으로 교체

DateSlider → DateCalendar 교체.
- components/jobs/index.ts: DateSlider export 제거, DateCalendar 추가
- app/(app)/(tabs)/index.tsx: import + render 한 줄 교체
- 기존 selectedDateString/filters/handleTypeChange 로직 재사용 (변경 없음)
- DateSlider 파일 자체는 유지 (Q3 2026 knip 확인 후 제거 예정)"
```

---

## Task 10: `JobsScreen.test.tsx` 회귀 테스트 수정

**Files:**
- Modify: `uniqn-mobile/app/(app)/(tabs)/__tests__/JobsScreen.test.tsx`

- [ ] **Step 10-1: 현재 테스트 실행으로 어느 부분이 깨지는지 확인**

```bash
cd uniqn-mobile && npx jest app/\(app\)/\(tabs\)/__tests__/JobsScreen.test.tsx
```

예상: DateSlider 관련 테스트 실패.

- [ ] **Step 10-2: 테스트 파일 읽기**

```bash
wc -l uniqn-mobile/app/\(app\)/\(tabs\)/__tests__/JobsScreen.test.tsx
```

파일 전체 내용을 확인한다 (Read 툴). `DateSlider` 문자열 위치를 기록.

- [ ] **Step 10-3: DateSlider → DateCalendar selector 교체**

`DateSlider` mock/selector를 `DateCalendar` mock/selector로 바꾼다. 기존 mock 구조를 그대로 유지하되 이름만 교체:

```typescript
// BEFORE (예시)
jest.mock('@/components/jobs', () => ({
  // ...
  DateSlider: ({ onDateSelect }: { onDateSelect: (d: Date | null) => void }) => {
    const { Pressable, Text } = require('react-native');
    return (
      <Pressable testID="date-slider-today" onPress={() => onDateSelect(new Date())}>
        <Text>Today</Text>
      </Pressable>
    );
  },
  // ...
}));

// AFTER
jest.mock('@/components/jobs', () => ({
  // ...
  DateCalendar: ({ onDateSelect }: { onDateSelect: (d: Date | null) => void }) => {
    const { Pressable, Text } = require('react-native');
    return (
      <Pressable testID="date-calendar-today" onPress={() => onDateSelect(new Date())}>
        <Text>Today</Text>
      </Pressable>
    );
  },
  // ...
}));
```

그 외 테스트 선언(`it('...')` 블록 내부)에서 `getByTestId('date-slider-...')`를 `getByTestId('date-calendar-...')`로 교체.

- [ ] **Step 10-4: 새 테스트 추가 — "일반 탭 진입 시 달력 펼침"**

```typescript
it('일반 탭 진입 시 달력이 기본 펼침 상태로 렌더', async () => {
  const { findByTestId } = render(<JobsScreen />);
  // DateCalendar mock 내부의 expanded 상태 감지용 testID (mock 구현에 따라 이름 조정)
  expect(await findByTestId('date-calendar-today')).toBeTruthy();
});
```

- [ ] **Step 10-5: 테스트 실행 — 통과 확인**

```bash
cd uniqn-mobile && npx jest app/\(app\)/\(tabs\)/__tests__/JobsScreen.test.tsx
```

예상: 모든 테스트 pass.

- [ ] **Step 10-6: 커밋**

```bash
cd uniqn-mobile && git add app/\(app\)/\(tabs\)/__tests__/JobsScreen.test.tsx
git commit -m "test(jobs): JobsScreen 테스트 selector DateSlider→DateCalendar 교체

- 기존 DateSlider mock을 DateCalendar mock으로 이름/ID 교체
- \"일반 탭 진입 시 달력 펼침\" 시나리오 추가"
```

---

## Task 11: E2E 테스트 수정

**Files:**
- Modify: `uniqn-mobile/e2e/pages/app/tabs/home.page.ts`
- Modify: `uniqn-mobile/e2e/tests/p2-standard/jobs-home.spec.ts`

- [ ] **Step 11-1: 두 파일 현재 상태 확인**

```bash
grep -n "DateSlider\|date-slider\|날짜" uniqn-mobile/e2e/pages/app/tabs/home.page.ts uniqn-mobile/e2e/tests/p2-standard/jobs-home.spec.ts
```

출력에서 DateSlider 관련 selector/시나리오 위치 기록.

- [ ] **Step 11-2: `home.page.ts` selector 수정**

`DateSlider`/`date-slider` 참조를 달력 선택자로 교체. 구체 예:

```typescript
// BEFORE (예시)
async pickDate(dateKey: string) {
  await this.page.getByTestId(`date-slider-chip-${dateKey}`).click();
}

// AFTER
async pickDate(dateKey: string) {
  // 달력 셀 ID는 yyyy-MM-dd 포맷
  await this.page.getByTestId(`calendar-cell-${dateKey}`).click();
}

async expandCalendar() {
  // collapsed 상태에서 헤더 탭 = 펼치기
  await this.page.getByLabel(/날짜 필터 펼치기/).click();
}

async clearDateFilter() {
  await this.page.getByLabel('날짜 필터 해제').click();
}

async goPrevMonth() {
  await this.page.getByLabel('이전 달').click();
}

async goNextMonth() {
  await this.page.getByLabel('다음 달').click();
}
```

- [ ] **Step 11-3: `jobs-home.spec.ts` 시나리오 수정**

기존 날짜 칩 탭 시나리오를 달력 시나리오로 교체:

```typescript
// BEFORE (예시)
test('일반 탭에서 날짜 선택 시 해당 날짜 공고만 필터', async ({ page }) => {
  const home = new HomePage(page);
  await home.selectPostingType('regular');
  await home.pickDate('today'); // 슬라이더 칩
  // ... 검증
});

// AFTER
test('일반 탭에서 달력으로 날짜 선택 시 해당 날짜 공고만 필터 + 접힘', async ({ page }) => {
  const home = new HomePage(page);
  await home.selectPostingType('regular');
  // 진입 시 이미 expanded
  const today = new Date().toISOString().slice(0, 10);
  await home.pickDate(today);
  // 접힌 헤더 가시 확인
  await expect(page.getByLabel(/날짜 필터 펼치기/)).toBeVisible();
  // 리스트 필터 적용 검증 (기존 assertion 유지)
});
```

그리고 새 시나리오 추가:

```typescript
test('일반 탭에서 다음 달로 이동 + 카운트 표시', async ({ page }) => {
  const home = new HomePage(page);
  await home.selectPostingType('regular');
  await home.goNextMonth();
  // 월 이름 변경 확인
  const nextMonthLabel = new Date();
  nextMonthLabel.setMonth(nextMonthLabel.getMonth() + 1);
  const year = nextMonthLabel.getFullYear();
  const month = nextMonthLabel.getMonth() + 1;
  await expect(page.getByText(`${year}년 ${month}월`)).toBeVisible();
});
```

- [ ] **Step 11-4: E2E 실행 (로컬 — 옵션)**

로컬 Playwright 러너가 설정돼 있다면:

```bash
cd uniqn-mobile && npx playwright test e2e/tests/p2-standard/jobs-home.spec.ts
```

예상: pass. (CI 환경에서도 다음 단계에서 검증됨.)

**주의**: E2E 러너가 로컬에서 못 돌면 이 단계는 "selector 교체 + TypeScript 타입체크 통과"까지만 확인하고 넘어간다 — CI가 최종 검증.

- [ ] **Step 11-5: 타입체크**

```bash
cd uniqn-mobile && npx tsc --noEmit -p e2e/tsconfig.json 2>/dev/null || npx tsc --noEmit
```

예상: 0 errors.

- [ ] **Step 11-6: 커밋**

```bash
cd uniqn-mobile && git add e2e/
git commit -m "test(e2e): 일반탭 날짜필터 e2e selector/시나리오 DateCalendar 대응

- home.page.ts: pickDate, expandCalendar, clearDateFilter, goPrevMonth, goNextMonth
- jobs-home.spec.ts: 날짜 선택 → 접힘 검증, 월 이동 시나리오 추가"
```

---

## Task 12: 최종 검증

- [ ] **Step 12-1: 전체 품질 게이트 실행**

```bash
cd uniqn-mobile && npm run quality
```

예상: `tsc --noEmit` + `eslint` + `prettier --check` 모두 exit 0.

실패 시:
- 타입 에러 → 해당 파일 수정
- 린트 에러 → `npx eslint --fix` 시도
- 포맷 위반 → `npx prettier --write <file>` 실행 후 수동 재확인

- [ ] **Step 12-2: 전체 Jest 실행**

```bash
cd uniqn-mobile && npm test -- --watchAll=false
```

예상: 전체 테스트 pass. 특히:
- `SupabaseJobPostingRepository.getRegularDateCounts` 5개
- `useRegularDateCounts` 4개
- `CalendarCell` 8개
- `CalendarGrid` 4개
- `CalendarHeader` 6개
- `CollapsedHeader` 4개
- `DateCalendar` 5개
- `JobsScreen` 기존 + 신규 시나리오

합 36개 이상 신규 pass.

- [ ] **Step 12-3: 커버리지 확인**

```bash
cd uniqn-mobile && npm test -- --coverage --collectCoverageFrom='src/components/jobs/DateCalendar/**/*.{ts,tsx}' --collectCoverageFrom='src/hooks/useRegularDateCounts.ts'
```

예상: 신규 코드 80%+ 커버리지.

- [ ] **Step 12-4: 개발 서버로 수동 UI 검증**

```bash
cd uniqn-mobile && npm start
```

앱을 열고 다음 시나리오를 수동 체크 (각 항목 PASS 확인):

- [ ] (a) 구인구직 탭 진입 → 일반 공고 타입 선택 → 달력이 펼친 상태로 표시
- [ ] (b) 오늘 날짜에 골드 테두리(border-primary-500)
- [ ] (c) 카운트 있는 날짜에 `bg-primary-500/15` 반투명 골드 뱃지
- [ ] (d) 날짜 셀 탭 → 달력 접힘 + `[📅 M월 d일 (요일) · N건] [✕]` 헤더 표시 + 공고 리스트 해당 날짜만
- [ ] (e) 접힌 헤더 탭 → 달력 재펼침
- [ ] (f) ✕ 탭 → 필터 해제 + 달력 재펼침
- [ ] (g) 이전 달 화살표 → 3월 카운트 표시 (캐시 1번 hit)
- [ ] (h) 3월 도달 시 이전 화살표 disabled (opacity-40)
- [ ] (i) +3개월(7월) 도달 시 다음 화살표 disabled
- [ ] (j) 과거 날짜 셀 흐림(opacity-60) + 탭 가능
- [ ] (k) 0건 날짜 셀 뱃지 없음 + 탭 시 반응 없음
- [ ] (l) 다크모드 전환 — 달력 가시성 OK
- [ ] (m) iOS 시뮬레이터/실기기에서 Reduce Motion ON → 접기/펼치기 애니메이션 즉시 전환 (Skeleton과 동일 패턴)

실패 항목 있으면 해당 기능의 Task로 돌아가 수정 후 재검증.

- [ ] **Step 12-5: (선택) 다크모드 className 정적 추출 검증**

메모리 `pitfall_nativewind_dynamic_className_dark.md` 관련 — `dark:` variant가 제대로 정적 추출되었는지 확인:

```bash
cd uniqn-mobile && grep -rn "dark:" src/components/jobs/DateCalendar/
```

동적 className(`${pressed ? "dark:..." : ""}`)이 없어야 한다. 모든 `dark:` 클래스는 정적 문자열 내부에 있어야 한다.

- [ ] **Step 12-6: 최종 빌드 스모크**

```bash
cd uniqn-mobile && npx expo export --platform ios 2>&1 | tail -20
```

(또는 android/web — 둘 중 빠르게 되는 플랫폼으로)

예상: 번들 생성 성공, unresolved import 없음.

- [ ] **Step 12-7: 최종 완료 커밋 (변경 있는 경우에만)**

위 검증에서 코드 수정이 발생한 경우:

```bash
cd uniqn-mobile && git add -A
git commit -m "fix(jobs): 수동 QA 검증에서 발견된 달력 이슈 수정

- <수정 항목 구체 기입>"
```

수정 없으면 이 단계 skip.

---

## Self-Review

### 1. Spec coverage

스펙 9개 결정 → 태스크 매핑:

| Spec 결정 | 커버 Task |
|-----------|-----------|
| #1 C (첫 진입 펼침, 선택 후 접힘) | Task 8 (상태머신) |
| #2 -1~+3개월 | Task 8 (minMonth/maxMonth) |
| #3 E (접힌 헤더 ✕) | Task 7, 8 |
| #4 A1 (과거 탭 가능) | Task 4 (isPast opacity-60) |
| #5 B1 (0건 탭 불가) | Task 4 (disabled) |
| #6 오늘 골드 테두리 | Task 4 |
| #7 선택 골드 채움 | Task 4 |
| #8 H1 헤더 | Task 7 |
| #9 P4 `bg-primary-500/15` | Task 4 |

스펙 성공 기준 체크:
- 일반 탭 진입 시 펼침 ✓ (Task 8 기본 상태, Task 10 회귀)
- 날짜 탭 → 접힘 + 리스트 필터 ✓ (Task 8, 9)
- 월 이동 cache hit ✓ (Task 3 월별 독립 캐시)
- 애니메이션 시작/종료 75% + Reduce Motion ✓ (Task 12-4m 수동 확인 — 단, 애니메이션 구체 구현이 plan 내 Reanimated 코드로 명시되지 않음)

**보완 지점**: 스펙은 접기/펼치기 애니메이션 300ms/225ms를 명시하지만, Task 8 구현에선 Reanimated 코드가 없어 즉시 전환된다. 이는 첫 iteration에서 의도적 단순화 — 상태머신의 상태 전환 자체가 먼저 동작하면 애니메이션은 follow-up으로 추가 가능. 만약 사용자가 애니메이션이 즉시 필요하다고 느끼면 Task 8 이후 추가 Task로 처리한다.

### 2. Placeholder scan

- "TBD/TODO" — 없음 ✓
- "Similar to Task N" — 없음, 각 태스크 full code ✓
- "handle edge cases" 공식 문구 — 없음 ✓
- Task 1 Step 1-1/1-2는 "확인" 단계 — 이는 placeholder가 아닌 실행 가능한 명령 ✓
- Task 10 Step 10-2는 기존 파일의 내용을 Read로 확인하는 단계 — "현재 파일을 읽고 DateSlider 위치 찾기"는 실제 실행 가능 명령 ✓
- Task 11 Step 11-3의 시나리오 수정은 기존 파일 구조에 따라 약간 달라질 수 있음 — 실행자가 확인 후 적절히 매핑. **이는 허용 가능한 "기존 파일 상태에 따른 실용 유연성"이며, 시그니처/의도는 명시됨** ✓

### 3. Type consistency

- `Record<string, number>` → 모든 자리에서 동일 (Repository 반환, hook data, counts prop)
- `CalendarMode` = `'expanded' | 'collapsed'` → Task 8에서만 쓰이며 일관
- `getRegularDateCounts(startDate: string, endDate: string)` → Task 2 선언, Task 3 호출 일치
- CSS 토큰: `bg-primary-500`, `text-content-onGold`, `bg-primary-500/15`, `border-divider`, `text-error-500`, `text-info-500`, `text-content-secondary`, `bg-surface-card`, `dark:bg-surface-elevated` — 모두 `tailwind.config.js`에서 확인한 실존 토큰

### 4. Completeness

DateSlider 파일 자체 유지 — Task 9에서 export만 제거. 삭제 Task는 없음(spec 결정 #5-3: Q3 2026까지 그레이스). 이는 의도된 설계 ✓.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-04-19-regular-tab-date-calendar.md`. Two execution options:

**1. Subagent-Driven (recommended)** - 태스크별 fresh subagent dispatch + 2단계 리뷰. 각 태스크 후 독립 검증으로 회귀 위험 최소화.

**2. Inline Execution** - 현재 세션에서 executing-plans 스킬로 배치 실행 + 체크포인트. 빠른 반복.

어떤 방식으로 진행할까요?
