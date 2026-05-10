# 일반탭 날짜필터 — 달력 UI 전환 설계

**작성일**: 2026-04-19
**상태**: 설계 승인 대기
**영향 범위**: `uniqn-mobile/` — 구인구직 탭(일반 공고 타입)
**관련 파일**:
- `uniqn-mobile/app/(app)/(tabs)/index.tsx:177-179` (DateSlider 사용 지점)
- `uniqn-mobile/src/components/jobs/DateSlider.tsx` (교체 대상)
- `uniqn-mobile/src/repositories/jobPostingRepository.ts` (메서드 추가)

## 배경

구인구직 탭의 일반 공고 타입에서는 현재 `DateSlider` 컴포넌트로 날짜 필터링을 한다. 이 컴포넌트는 어제부터 +14일까지 16일을 가로 스크롤 칩으로 표시한다.

**문제점**:
- 16일 윈도우가 좁음 — 월 초/말 사용자가 답답함
- 일자별 공고 분포를 볼 수 없음 — 사용자는 어느 날에 공고가 몰려있는지 모름
- 스크롤해야 전체 범위 확인 가능

## 목표

월 단위 달력 그리드로 교체하여:
1. 일자별 공고 개수를 뱃지로 시각화 (분포를 한눈에)
2. 월 이동으로 -1 ~ +3개월 범위 탐색
3. 접기/펼치기로 공고 리스트 공간 확보

## 설계 결정

| # | 결정 | 선택 | 이유 |
|---|------|------|------|
| 1 | 기본 상태 | C — 첫 진입 펼침, 선택 후 접힘 | 달력 → 리스트 플로우가 자연스러움, 숨겨진 기능 회피 |
| 2 | 월 범위 | -1 ~ +3개월 | 과거 공고 확인(지원/정산) + 미래 공고 탐색, 현재 DateSlider의 "어제부터" 일관성 |
| 3 | "전체" 옵션 | E — 접힌 헤더의 ✕ 버튼 | 달력 그리드와 UI 분리, 펼친 상태엔 상단 우측 "전체 보기" 텍스트 버튼 |
| 4 | 과거 날짜 | A1 — 회색 + 탭 가능 | 과거 공고도 지원/정산 확인 수요 있음 |
| 5 | 0건 날짜 | B1 — 탭 불가, 뱃지 없음 | 빈 리스트 유도보다 불가 상태가 명확 |
| 6 | 오늘 표시 | C — 골드 테두리 링 | 선택(채움)과 구분, 60-30-10 준수 |
| 7 | 선택 표시 | D — 골드 채움 + on-gold 텍스트 | 시각 임팩트 + Squint Test 통과 |
| 8 | 접힌 헤더 | H1 — 요약 + 탭 펼침 + ✕ | 한 줄 요약 + 명확한 토글 + 해제 분리 |
| 9 | 카운트 뱃지 색 | P4 — `bg-gold/15` 반투명 골드 | 목업 맛 유지 + Rule 3 위반 회피 |

## 아키텍처

### 파일 구조 (신규/수정)

```
uniqn-mobile/
├─ supabase/migrations/
│  └─ YYYYMMDDHHMMSS_add_regular_posting_date_counts_rpc.sql  [신규]
├─ src/
│  ├─ repositories/
│  │  ├─ interfaces/IJobPostingRepository.ts                   [수정]
│  │  └─ jobPostingRepository.ts                               [수정]
│  ├─ hooks/
│  │  └─ useRegularDateCounts.ts                               [신규]
│  └─ components/jobs/
│     ├─ DateCalendar/
│     │  ├─ DateCalendar.tsx                                   [신규]
│     │  ├─ CalendarHeader.tsx                                 [신규]
│     │  ├─ CalendarGrid.tsx                                   [신규]
│     │  ├─ CalendarCell.tsx                                   [신규]
│     │  ├─ CollapsedHeader.tsx                                [신규]
│     │  └─ __tests__/                                          [신규]
│     └─ index.ts                                              [수정: DateSlider export 제거]
└─ app/(app)/(tabs)/index.tsx                                  [수정: DateSlider → DateCalendar]
```

### 데이터 플로우

```
JobsScreen
  └─ DateCalendar (selectedDate, onDateSelect)
       ├─ useRegularDateCounts(visibleMonth)
       │    └─ jobPostingRepository.getRegularDateCounts(start, end)
       │         └─ supabase.rpc('get_regular_posting_date_counts', ...)
       ├─ CollapsedHeader        (mode === 'collapsed')
       └─ CalendarHeader
          + CalendarGrid → CalendarCell[]   (mode === 'expanded')
```

Presentation(DateCalendar) → Hook(useRegularDateCounts) → Repository → Supabase RPC. CLAUDE.md의 레이어링 규약 준수.

## DB / RPC

### 마이그레이션

```sql
-- 목적: 일반 공고 타입의 기간 내 일자별 공고 개수 집계
-- 실행 방법: Supabase MCP apply_migration (supabase db push 금지)

create or replace function public.get_regular_posting_date_counts(
  p_start_date date,
  p_end_date date
)
returns table (work_date date, posting_count bigint)
language sql
stable
security invoker
set search_path = public
as $$
  select
    jpwd.work_date,
    count(distinct jp.id) as posting_count
  from job_postings jp
  join job_posting_work_dates jpwd on jpwd.job_posting_id = jp.id
  where jp.posting_type = 'regular'
    and jp.status = 'active'
    and jpwd.work_date between p_start_date and p_end_date
  group by jpwd.work_date
  order by jpwd.work_date;
$$;

grant execute on function public.get_regular_posting_date_counts(date, date) to authenticated;
```

**구현 전 확인 필요:**
1. `job_posting_work_dates` 테이블명과 컬럼명 — `mcp__supabase__list_tables`로 실제 스키마 검증
2. `job_postings.posting_type` enum 값 `'regular'` 실존 확인
3. `job_posting_work_dates.work_date` 컬럼 인덱스 존재 여부 — 없으면 `create index idx_jpwd_work_date on job_posting_work_dates(work_date)` 추가
4. `mcp__supabase__generate_typescript_types`로 타입 재생성 → `src/types/supabase.ts`의 `Functions` 타입에 RPC 시그니처 포함

## Repository & Hook

### Repository 메서드 (IJobPostingRepository)

```typescript
interface IJobPostingRepository {
  // ... 기존
  getRegularDateCounts(startDate: string, endDate: string): Promise<Record<string, number>>;
}
```

구현부:
```typescript
async getRegularDateCounts(startDate, endDate) {
  const { data, error } = await supabase.rpc('get_regular_posting_date_counts', {
    p_start_date: startDate,
    p_end_date: endDate,
  });
  if (error) throw toAppError(error, 'E4');
  return Object.fromEntries(
    (data ?? []).map((row) => [row.work_date, Number(row.posting_count)])
  );
}
```

### `useRegularDateCounts` 훅

```typescript
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
    queryKey: [...queryKeys.jobPostings.all, 'regularDateCounts', range.start, range.end],
    queryFn: () => jobPostingRepository.getRegularDateCounts(range.start, range.end),
    staleTime: cachingPolicies.frequent,
    gcTime: cachingPolicies.standard * 2,
  });
}
```

**캐시 전략**: 월별 독립 캐시, 5분 staleTime, 월 재방문 시 cache hit.

**무효화**: 공고 등록/수정/삭제 시 `invalidateQueries({ queryKey: queryKeys.jobPostings.all })` — 기존 뮤테이션 훅이 이미 `jobPostings.all`을 invalidate하는지 구현 단계 확인 필요.

## UI 컴포넌트

### `DateCalendar` — 진입 및 상태머신

```typescript
interface DateCalendarProps {
  selectedDate: Date | null;
  onDateSelect: (date: Date | null) => void;
  className?: string;
}
```

**내부 상태:**
```typescript
type CalendarMode = 'expanded' | 'collapsed';
const [mode, setMode] = useState<CalendarMode>('expanded');
const [visibleMonth, setVisibleMonth] = useState<Date>(
  selectedDate ?? startOfMonth(new Date())
);
```

**상태 전이:**

| 트리거 | from → to |
|--------|-----------|
| mount | → expanded |
| 날짜 셀 탭 | expanded → collapsed |
| CollapsedHeader 탭 | collapsed → expanded |
| ✕ 탭 | collapsed → expanded (+ onDateSelect(null)) |
| selectedDate 외부에서 null | collapsed → expanded |

**애니메이션 (impeccable Rule 8):**
- entrance: 300ms, `Easing.bezier(0.25, 1, 0.5, 1)`
- exit: 225ms (75% 규칙)
- Reduce Motion: opacity 페이드만

### `CalendarHeader` (펼친 상태)

```
[ ‹ ]  [ 2026년 4월 ]  [ › ]          [ 전체 보기 ]
```

- 월 이동 화살표: `hitSlop={10}`, 시각 24×24 + 터치 44×44
- 경계 (3월 / 7월) 도달 시 `opacity-40 + disabled`
- "전체 보기": `selectedDate === null`이면 숨김
- 월 이동 시 햅틱 `Light` (200ms throttle)

### `CalendarGrid`

- 7열 × 최대 6행, `flex-row flex-wrap` + 셀 `w-[14.2857%]`
- 요일 헤더: 일(`text-error`) / 토(`text-info`) / 평일(`text-content-secondary`)
- `eachDayOfInterval({ start: startOfWeek(startOfMonth(m)), end: endOfWeek(endOfMonth(m)) })`
- 이전/다음 달 셀 `opacity-30` + 탭 불가

### `CalendarCell`

```typescript
interface CalendarCellProps {
  date: Date;
  count: number;
  isToday: boolean;
  isSelected: boolean;
  isOutsideMonth: boolean;
  onPress: (date: Date) => void;
}
```

**스타일 결정 트리:**

| 조건 | 처리 |
|------|------|
| `isOutsideMonth` | `opacity-30` + disabled |
| `count === 0` | 뱃지 없음 + disabled |
| `isSelected` | `bg-gold`, `text-on-gold`, 뱃지 `bg-on-gold/20 text-on-gold` |
| `isToday` | `border-2 border-gold`, 텍스트 골드, 뱃지 `bg-gold/15` |
| 과거 + count>0 | `opacity-60`, 탭 가능, 뱃지 `bg-gold/15` |
| 기본 | 정상, 탭 가능, 뱃지 `bg-gold/15` |

**셀 레이아웃 (높이 64px):**
- 날짜 숫자 (text-body, weight 500)
- 카운트 뱃지 `bg-gold/15 text-content-primary rounded-sm px-1.5 py-0.5 text-[10px] font-sans-medium`

**인터랙션:**
- 탭 햅틱 `Light`
- Pressed: `bg-surface-hover dark:bg-surface-hover` (Rule 21 역방향)
- Focus ring: Info 블루 `#2563EB` 2px (Rule 22)
- 접근성: `accessibilityLabel="4월 18일 토요일 공고 12건"` 등 전체 문장

### `CollapsedHeader`

```
┌──────────────────────────────────────────┐
│  📅  4월 18일 (토) · 12건        [ ✕ ]  │
└──────────────────────────────────────────┘
```

- 외부 `Pressable` → `onPress={onExpand}` (펼치기)
- 우측 ✕ 별도 `Pressable` + event propagation 차단
- 아이콘: Lucide `CalendarIcon` 16px, stroke 2.0
- 배경: `bg-surface-card dark:bg-surface-elevated`
- 하단 1px `border-b border-border-subtle`
- 두 Pressable 모두 햅틱 `Light`
- 접근성:
  - 외부 `accessibilityLabel="날짜 필터 펼치기, 현재 4월 18일 토요일 12건 선택됨"`
  - ✕ `accessibilityLabel="날짜 필터 해제"`

### 로딩/에러

- **로딩**: 그리드 렌더 유지, 뱃지 위치에 `SkeletonText w-8 h-3` (Rule 16)
- **에러**: 그리드 하단 인라인 메시지 "공고 수를 불러오지 못했어요. 다시 시도해주세요." + 재시도 버튼 (Rule 10)
- **에러 시 달력 자체는 동작** — 탭 가능, 필터 적용됨, 건수만 미표시

## 통합

### JobsScreen 수정

```diff
- {selectedType === 'regular' && (
-   <DateSlider selectedDate={selectedDate} onDateSelect={setSelectedDate} />
- )}
+ {selectedType === 'regular' && (
+   <DateCalendar selectedDate={selectedDate} onDateSelect={setSelectedDate} />
+ )}
```

기존 `selectedDateString`/`filters`/`handleTypeChange` 로직은 변경 불필요. `handleTypeChange`의 `setSelectedDate(null)`로 탭 전환 시 달력 자동 리셋.

### DateSlider 처리

- `src/components/jobs/index.ts` export에서 `DateSlider` 제거
- 파일 자체는 3개월 그레이스 유지, Q3 2026 `knip` 확인 후 완전 제거
- `__tests__/JobsScreen.test.tsx`, `e2e/tests/p2-standard/jobs-home.spec.ts`, `e2e/pages/app/tabs/home.page.ts`의 DateSlider selector는 DateCalendar selector로 교체

## 엣지케이스

| 케이스 | 동작 |
|--------|------|
| 오프라인 진입 | `enabled=false` → 뱃지 없는 달력 + 전역 OfflineBanner, 탭은 가능 |
| 로딩 중 월 전환 | 이전 월 카운트 즉시 숨김, skeleton 표시 (`keepPreviousData` 안 씀) |
| 빈 월 (모두 0건) | 달력 유지 + 하단 안내 "이 달엔 등록된 일반 공고가 없어요" |
| 선택 날짜가 보이는 월 밖 | 선택 상태 유지, 그리드엔 선택 표시 안 보임, CollapsedHeader는 원래 날짜 |
| 월 경계 셀 (4월 그리드의 3월 30일) | `opacity-30` + 탭 불가 |
| 선택 날짜 마감됨 (과거 + 0건) | CollapsedHeader "· 0건" 표시, 리스트 빈 상태 |

## 테스트 전략

### Jest 단위 테스트 (신규)

| 파일 | 범위 |
|------|------|
| `DateCalendar.test.tsx` | 상태 전이 4가지, selectedDate 외부 변경 동기화 |
| `CalendarGrid.test.tsx` | 그리드 날짜 개수, 월 경계 처리 |
| `CalendarCell.test.tsx` | 4가지 상태 조합 스타일/인터랙션 |
| `CollapsedHeader.test.tsx` | 탭=onExpand, ✕=onClear + stopPropagation |
| `useRegularDateCounts.test.ts` | range 계산, RPC 응답 변환, 에러 처리 |

### 통합 테스트 수정 (`JobsScreen.test.tsx`)

- DateSlider → DateCalendar selector 교체
- "일반 탭 진입 시 달력 펼침" 추가
- "날짜 선택 → 접힘 + 리스트 필터" 추가

### e2e 수정 (`jobs-home.spec.ts`, `home.page.ts`)

- 날짜 칩 → 달력 셀 selector 교체
- "월 이동 → 카운트 표시" 시나리오 추가

### 커버리지 목표

신규 코드 80%+ (golden-principles.md #3).

## 구현 순서

1. DB 마이그레이션 (Supabase MCP `apply_migration`) + `generate_typescript_types`
2. Repository `getRegularDateCounts` 메서드 + 단위 테스트
3. `useRegularDateCounts` 훅 + 단위 테스트
4. UI 컴포넌트 bottom-up: `CalendarCell` → `CalendarGrid` → `CalendarHeader` → `CollapsedHeader`
5. `DateCalendar` 컴포지션 + 상태머신 테스트
6. `JobsScreen` 통합 + 기존 통합 테스트 수정
7. e2e 수정
8. `npm run quality` + `npm test` 통과

롤아웃/feature flag 없음 (내부 앱).

## 성공 기준

- [ ] 일반 탭 진입 시 달력 펼침
- [ ] 날짜 탭 시 달력 접힘 + 리스트 해당 날짜만
- [ ] 월 이동 시 카운트 교체, 재방문 cache hit
- [ ] 오늘=테두리, 선택=채움, 과거=흐림, 0건=탭불가
- [ ] Reduce Motion 환경에서 애니메이션 비활성
- [ ] `npm run quality` 통과
- [ ] 신규 코드 테스트 커버리지 80%+
- [ ] e2e jobs-home pass

## 위험 & 완화

| 위험 | 영향 | 완화 |
|------|------|------|
| `job_posting_work_dates` 스키마 가정 오류 | 마이그레이션 실패 | 구현 1단계에서 `list_tables`로 검증 |
| `work_date` 인덱스 누락 | RPC 응답 느림 | EXPLAIN 후 필요 시 인덱스 추가 |
| 기존 뮤테이션 훅이 `jobPostings.all` invalidate 안 함 | 공고 등록 후 카운트 stale | 구현 3단계에서 invalidate 확인 + 필요 시 추가 |
| 달력이 세로 300px 차지 → 리스트 공간 압박 | UX 저하 | 결정 C (선택 후 자동 접힘)으로 완화 |
| Reanimated height 애니메이션 레이아웃 점프 | 시각 버그 | `useAnimatedStyle` + measured height, 필요 시 `LayoutAnimation` fallback |
