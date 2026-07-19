# grid-auto-sync (공고→근무표 필요인원 자동 파생) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 일반 공고 등록 시 그 requirements(날짜×역할×인원)가 근무표(그리드)의 "필요 인원"에 자동 반영되게 해, 사장이 근무표에 목표를 따로 입력하는 이중 작업을 없앤다.

**Architecture:** ①DB `get_venue_grid_summary`를 `DROP+CREATE`해 스팬 공고의 `schedule.requirements`를 날짜별 Σ count(좌석 합)로 파생한 `required_count` 열 추가(읽기 시점). ②비-대회 공고 생성 시 기본 지점에 `venue_id` 자동 연결(멱등 `get_or_create_venue_container`). ③클라 `buildGridCells`에서 `필요 = max(수동 softTarget, requiredCount)` 병합. seat-basis(#269) 좌석합 컨벤션과 일치.

**Tech Stack:** PostgreSQL/Supabase(plpgsql SECDEF), TypeScript strict, React Native/Expo, Jest, pgTAP.

**진실원 스펙:** `docs/superpowers/specs/2026-07-18-grid-auto-sync-design.md` (D1~D4·리스크·테스트). 상위 배치 스펙: `docs/superpowers/specs/2026-07-18-supply-launch-v1-design.md` §3.

## Global Constraints

- camelCase(클라)/snake_case(DB). 불변성(스프레드). UI 문자열·커밋·주석 **한글**.
- 마이그레이션은 MCP `apply_migration` 전용(db push 금지), **기존 마이그레이션 수정 금지**, `mcp__supabase__*` 직접 호출은 서브에이전트가 하지 않는다(메인 세션 사용자 게이트).
- SECDEF 하드닝: 신규/재작성 함수 `anon EXECUTE REVOKE` + `search_path` 고정 + NULL fail-closed 유지.
- `venue_span_posting_ids` 조건(SSOT)·`MAX_CAPACITY` 하드가드 **불변**.
- 좌석 합 = **SUM**(`r->>'count'`), peak MAX 아님.
- `weekly_grid_enabled` ON은 **맨 마지막 사용자 게이트**(역순 금지).

---

## File Structure

- **DB(신규 마이그)** `supabase/migrations/<ts>_grid_auto_sync_required_count.sql` — `DROP FUNCTION`+`CREATE` `get_venue_grid_summary`(반환에 `required_count int` 추가) + ACL 재부여.
- **DB 테스트** `supabase/tests/grid_auto_sync_required_count.test.sql` — pgTAP.
- **클라 타입/로직** `src/domains/weeklyGrid/buildGridCells.ts` — `GridSummaryRow.requiredCount` + `max` 병합.
- **리포지토리** `src/repositories/supabase/WeeklyGridRepository.ts` — RPC 응답 `required_count → requiredCount` 매핑.
- **연결(서비스)** `src/services/*`의 `createJobPosting` 경로 — 비-대회·`venueId` 미지정 시 기본 지점 자동 연결.
- **연결(리포)** venue 컨테이너 확보 RPC 래퍼(`get_or_create_venue_container`).
- **연결(폼)** 공고 작성 폼 — 지점 2개+ 선택 칩(기존 그리드 "공고 열기" `venueId` 프리필 경로 재사용).

---

### Task 1: DB — `get_venue_grid_summary`에 `required_count` 파생 추가

**Files:**
- Create: `supabase/migrations/<timestamp>_grid_auto_sync_required_count.sql`
- Test: `supabase/tests/grid_auto_sync_required_count.test.sql`

**Interfaces:**
- Produces: `get_venue_grid_summary(p_venue uuid, p_from text, p_to text)` → `TABLE(d text, headcount int, job_count int, required_count int)`.

현재 함수 본문(baseline `20260710000002...sql:3161-3195`)은 `work_logs`를 날짜별 GROUP BY해 `headcount/job_count`만 반환한다. 여기에 스팬 공고 requirements의 날짜별 Σ count 파생을 FULL OUTER JOIN으로 결합한다.

- [ ] **Step 1: pgTAP 실패 테스트 작성**

`supabase/tests/grid_auto_sync_required_count.test.sql`:
```sql
BEGIN;
SELECT plan(3);

-- 반환 계약: required_count 열 존재
SELECT has_column(
  (SELECT (get_venue_grid_summary('00000000-0000-0000-0000-000000000000','2026-08-01','2026-08-31')).*) IS NOT NULL::text,
  'required_count', 'required_count 열 반환'
);

-- (픽스처는 프로젝트 pgTAP 셋업 규약을 따른다: workspace·container·dated 공고 2건·work_logs)
-- dated 공고 requirements Σ count 파생: 8/10 토요일 딜러 2 + 플로어 1 = 3
SELECT is(
  (SELECT required_count FROM get_venue_grid_summary(:'venue_id','2026-08-01','2026-08-31') WHERE d = '2026-08-10'),
  3, 'dated 공고 requirements 날짜별 Σ count 파생'
);

-- fixed(date=null) 공고는 파생 제외
SELECT is(
  (SELECT COALESCE(SUM(required_count),0)::int FROM get_venue_grid_summary(:'venue_fixed_only','2026-08-01','2026-08-31')),
  0, 'fixed 스케줄은 required_count 파생 제외'
);

SELECT * FROM finish();
ROLLBACK;
```

> 픽스처(workspace/container/공고/work_logs 시드)는 기존 `supabase/tests/` 그리드 테스트의 셋업 패턴을 복제한다. 없으면 최소 시드를 이 파일에 인라인.

- [ ] **Step 2: 실패 확인**

Run(프로젝트 pgTAP 러너 — 로컬 스택 필요):
```bash
cd uniqn-mobile && npm run db:reset && npm run db:test 2>&1 | grep -A3 grid_auto_sync
```
Expected: FAIL — 함수가 아직 `required_count`를 반환하지 않음(3열).

- [ ] **Step 3: 마이그레이션 작성**

`supabase/migrations/<timestamp>_grid_auto_sync_required_count.sql`:
```sql
-- get_venue_grid_summary: required_count(스팬 공고 requirements 날짜별 Σ count, dated only) 추가.
-- 반환 타입 변경이므로 DROP+CREATE. ACL·SECDEF 하드닝 유지.
DROP FUNCTION IF EXISTS public.get_venue_grid_summary(uuid, text, text);

CREATE FUNCTION public.get_venue_grid_summary(p_venue uuid, p_from text, p_to text)
  RETURNS TABLE(d text, headcount integer, job_count integer, required_count integer)
  LANGUAGE plpgsql STABLE SECURITY DEFINER
  SET search_path TO 'public', 'pg_temp'
  AS $$
DECLARE
  v_ws uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 인증이 필요합니다';
  END IF;
  SELECT jp.workspace_id INTO v_ws FROM public.job_postings jp WHERE jp.id = p_venue AND jp.status = 'container';
  IF v_ws IS NULL THEN
    RAISE EXCEPTION 'VENUE_NOT_FOUND: %', p_venue;
  END IF;
  IF NOT (public.is_workspace_member(v_ws, auth.uid()) OR public.is_admin()) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 워크스페이스 권한이 없습니다';
  END IF;

  RETURN QUERY
  WITH span AS (
    SELECT jp.id
    FROM public.job_postings jp
    WHERE jp.id IN (SELECT public.venue_span_posting_ids(p_venue))
      AND jp.workspace_id = v_ws
  ),
  staffed AS (
    SELECT
      wl.date AS d,
      COUNT(*)::int AS headcount,
      COUNT(DISTINCT wl.job_posting_id) FILTER (WHERE wl.job_posting_id <> p_venue)::int AS job_count
    FROM public.work_logs wl
    WHERE wl.job_posting_id IN (SELECT id FROM span)
      AND wl.date >= p_from AND wl.date <= p_to
      AND wl.status NOT IN ('cancelled', 'no_show')
    GROUP BY wl.date
  ),
  required AS (
    SELECT
      (req->>'date') AS d,
      SUM((r->>'count')::int)::int AS required_count
    FROM public.job_postings jp
    JOIN span ON span.id = jp.id
    CROSS JOIN LATERAL jsonb_array_elements(COALESCE(jp.schedule->'requirements', '[]'::jsonb)) req
    CROSS JOIN LATERAL jsonb_array_elements(COALESCE(req->'timeSlots', '[]'::jsonb)) ts
    CROSS JOIN LATERAL jsonb_array_elements(COALESCE(ts->'roles', '[]'::jsonb)) r
    WHERE jp.id <> p_venue                       -- 컨테이너 자신 제외
      AND req->>'date' IS NOT NULL               -- dated only (fixed 제외)
      AND (req->>'date') >= p_from AND (req->>'date') <= p_to
    GROUP BY (req->>'date')
  )
  SELECT
    COALESCE(s.d, rq.d)                AS d,
    COALESCE(s.headcount, 0)           AS headcount,
    COALESCE(s.job_count, 0)           AS job_count,
    COALESCE(rq.required_count, 0)     AS required_count
  FROM staffed s
  FULL OUTER JOIN required rq ON s.d = rq.d;
END;
$$;

ALTER FUNCTION public.get_venue_grid_summary(uuid, text, text) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.get_venue_grid_summary(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_venue_grid_summary(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_venue_grid_summary(uuid, text, text) TO service_role;
COMMENT ON FUNCTION public.get_venue_grid_summary(uuid, text, text) IS
  '주간 그리드 월 요약: venue 스팬 ∩ 동일 workspace 날짜별 headcount + job_count + required_count(requirements Σ count, dated only). E1 SSOT, SECDEF 게이트.';
```

- [ ] **Step 4: 통과 확인 (Red→Green)**

Run:
```bash
cd uniqn-mobile && npm run db:reset && npm run db:test 2>&1 | grep -A3 grid_auto_sync
```
Expected: PASS (3 tests). Red→Green 실측.

- [ ] **Step 5: 커밋**

```bash
git add uniqn-mobile/supabase/migrations/*_grid_auto_sync_required_count.sql uniqn-mobile/supabase/tests/grid_auto_sync_required_count.test.sql
git commit -m "feat(db): 근무표 required_count 파생 — 공고 requirements 날짜별 좌석합(dated) RPC 확장"
```

> **prod 적용은 사용자 게이트**(MCP `apply_migration`). `weekly_grid_enabled` OFF라 이 RPC 호출 0 → 언제 적용해도 안전(상위 스펙 §4.2 순서 1).

---

### Task 2: 리포지토리 — `required_count → requiredCount` 매핑 + 타입

**Files:**
- Modify: `src/domains/weeklyGrid/buildGridCells.ts:12-20` (`GridSummaryRow`)
- Modify: `src/repositories/supabase/WeeklyGridRepository.ts:33-43`
- Test: `src/repositories/supabase/__tests__/WeeklyGridRepository.test.ts` (없으면 신규)

**Interfaces:**
- Consumes: Task 1 RPC(`required_count` 열).
- Produces: `GridSummaryRow { d: string; headcount: number; jobCount: number; requiredCount: number }`.

- [ ] **Step 1: 실패 테스트 작성**

RPC가 `required_count`를 주면 `requiredCount`로 매핑되는지:
```typescript
// WeeklyGridRepository.test.ts (기존 supabase.rpc 모킹 패턴 복제)
it('required_count 를 requiredCount 로 매핑한다', async () => {
  mockRpc.mockResolvedValueOnce({
    data: [{ d: '2026-08-10', headcount: 1, job_count: 2, required_count: 3 }],
    error: null,
  });
  const rows = await repo.getVenueGridSummary('v1', '2026-08-01', '2026-08-31');
  expect(rows[0]).toEqual({ d: '2026-08-10', headcount: 1, jobCount: 2, requiredCount: 3 });
});
```

- [ ] **Step 2: 실패 확인**

Run: `cd uniqn-mobile && npx jest WeeklyGridRepository`
Expected: FAIL — `requiredCount` 미매핑(undefined).

- [ ] **Step 3: 구현**

`buildGridCells.ts` `GridSummaryRow`에 필드 추가:
```typescript
export interface GridSummaryRow {
  /** YYYY-MM-DD (work_logs.date) */
  d: string;
  /** venue 스팬 read-time COUNT (cancelled/no_show 제외) */
  headcount: number;
  /** 그 날 venue 의 open 공고 수 */
  jobCount: number;
  /** 스팬 공고 requirements 날짜별 Σ count(좌석 합, dated only) */
  requiredCount: number;
}
```

`WeeklyGridRepository.ts` 매핑부(현재 33-43행) 교체:
```typescript
      const rows = (data ?? []) as {
        d: string;
        headcount: number | string;
        job_count: number | string;
        required_count: number | string;
      }[];
      // snake_case → camelCase 매핑 + 숫자 정규화(NaN 방어)
      return rows.map((r) => ({
        d: r.d,
        headcount: Number(r.headcount) || 0,
        jobCount: Number(r.job_count) || 0,
        requiredCount: Number(r.required_count) || 0,
      }));
```

- [ ] **Step 4: 통과 확인**

Run: `cd uniqn-mobile && npx jest WeeklyGridRepository src/domains/weeklyGrid`
Expected: PASS.

- [ ] **Step 5: 커밋**

```bash
git add uniqn-mobile/src/domains/weeklyGrid/buildGridCells.ts uniqn-mobile/src/repositories/supabase/WeeklyGridRepository.ts uniqn-mobile/src/repositories/supabase/__tests__/WeeklyGridRepository.test.ts
git commit -m "feat(grid): required_count RPC 응답을 requiredCount 로 매핑 + GridSummaryRow 타입 확장"
```

---

### Task 3: 클라 병합 — `필요 = max(수동 softTarget, requiredCount)`

**Files:**
- Modify: `src/domains/weeklyGrid/buildGridCells.ts:22-54`
- Test: `src/domains/weeklyGrid/__tests__/buildGridCells.test.ts`

**Interfaces:**
- Consumes: Task 2 `GridSummaryRow.requiredCount`.
- Produces: 셀의 `softTarget`(computeDayCell 입력)이 `max(수동, 파생)`.

`computeDayCell`(gridSlotState)은 무변경 — 병합만 `buildGridCells`가 담당(입력 `softTarget`에 max 반영).

- [ ] **Step 1: 실패 테스트 작성**

```typescript
// buildGridCells.test.ts
it('필요인원 = max(수동 softTarget, requiredCount) 로 병합한다', () => {
  const rows = [
    { d: '2026-08-10', headcount: 1, jobCount: 1, requiredCount: 3 }, // 파생 우세
    { d: '2026-08-11', headcount: 0, jobCount: 1, requiredCount: 1 }, // 수동 우세
  ];
  const softTargets = { '2026-08-11': 5 };
  const cells = buildGridCells(rows, softTargets);
  expect(cells['2026-08-10'].softTarget).toBe(3); // max(0, 3)
  expect(cells['2026-08-10'].shortage).toBe(2);   // 3 - 1
  expect(cells['2026-08-11'].softTarget).toBe(5); // max(5, 1)
});
```

- [ ] **Step 2: 실패 확인**

Run: `cd uniqn-mobile && npx jest buildGridCells`
Expected: FAIL — 현재 `softTargets[dateKey] ?? 0`만 사용(파생 미반영).

- [ ] **Step 3: 구현**

`buildGridCells`의 메인 루프에서 `softTarget`을 `max(수동, requiredCount)`로:
```typescript
  for (const row of rows) {
    const dateKey = row.d;
    if (!dateKey) continue;
    seen.add(dateKey);
    const manual = softTargets[dateKey] ?? 0;
    const effectiveTarget = Math.max(manual, row.requiredCount ?? 0);
    cells[dateKey] = computeDayCell({
      dateKey,
      headcount: row.headcount,
      jobCount: row.jobCount,
      softTarget: effectiveTarget,
    });
  }
```
(요약행에 없지만 수동 목표>0인 날 처리 루프는 무변경 — 파생값은 RPC 행으로 들어오므로 위 루프가 담당.)

- [ ] **Step 4: 통과 확인**

Run: `cd uniqn-mobile && npx jest buildGridCells src/domains/weeklyGrid`
Expected: PASS.

- [ ] **Step 5: 커밋**

```bash
git add uniqn-mobile/src/domains/weeklyGrid/buildGridCells.ts uniqn-mobile/src/domains/weeklyGrid/__tests__/buildGridCells.test.ts
git commit -m "feat(grid): 필요인원 = max(수동 목표, 파생 좌석합) 병합"
```

---

### Task 4: 연결 — 비-대회 공고 생성 시 기본 지점 자동 `venue_id`

**Files:**
- Read+Modify: `src/services/`의 `createJobPosting` 구현(`useCreateJobPosting`가 `createJobPosting(input, uid, ownerName, workspaceId)` 호출 — `@/services` 배럴에서 실제 파일 확인).
- Create: venue 컨테이너 확보 리포 메서드(`get_or_create_venue_container` RPC 래퍼) — 기존 그리드 "공고 열기" 경로에 유사 래퍼가 있으면 재사용, 없으면 `WeeklyGridRepository` 또는 워크스페이스 리포에 추가.
- Test: 해당 서비스 단위 테스트.

**Interfaces:**
- Consumes: `get_or_create_venue_container(p_workspace_id uuid, p_name text, p_kind text DEFAULT 'dated', p_period jsonb DEFAULT NULL) → jsonb`(멱등, `venue_id=self`).
- Produces: 비-대회·`venueId` 미지정 신규 공고에 기본 지점 `venue_id` 세팅.

- [ ] **Step 1: 대상 파일 확인**

Run: `cd uniqn-mobile && npx --no-install rg -n "export .*createJobPosting" src/services`
→ `createJobPosting` 실제 구현 파일과 `serializeJobPostingV3`/`options.venueId` 전달 지점 확인. 기존 venue 확보 래퍼 유무: `rg -n "get_or_create_venue_container" src`.

- [ ] **Step 2: 실패 테스트 작성**

```typescript
// createJobPosting 서비스 테스트 (리포 모킹)
it('비-대회 공고 + venueId 미지정이면 기본 지점을 확보해 venue_id 로 연결한다', async () => {
  ensureDefaultVenueMock.mockResolvedValueOnce('venue-1');
  await createJobPosting({ ...regularInput, venueId: undefined }, 'u1', '사장', 'ws1');
  // serialize 에 venueId=venue-1 이 전달됐는지(직렬화 결과 venueId 확인)
  expect(serializedDoc.venueId).toBe('venue-1');
});
it('대회 공고는 venue_id 를 연결하지 않는다(NULL 유지)', async () => {
  await createJobPosting({ ...tournamentInput, venueId: undefined }, 'u1', '사장', 'ws1');
  expect(serializedDoc.venueId).toBeUndefined();
  expect(ensureDefaultVenueMock).not.toHaveBeenCalled();
});
```

- [ ] **Step 3: 실패 확인**

Run: `cd uniqn-mobile && npx jest createJobPosting`
Expected: FAIL — 연결 로직 부재.

- [ ] **Step 4: venue 확보 리포 메서드**

`get_or_create_venue_container` RPC 래퍼(예: 워크스페이스/그리드 리포에 추가):
```typescript
/** 기본 지점(venue 컨테이너)을 멱등 확보하고 venue_id 반환. */
async ensureDefaultVenue(workspaceId: string): Promise<string> {
  const { data, error } = await supabase.rpc('get_or_create_venue_container', {
    p_workspace_id: workspaceId,
    p_name: '기본 지점',
  });
  if (error) handleSupabaseError(error, { operation: '기본 지점 확보', table: 'job_postings' });
  const venue = data as { venue_id?: string; id?: string } | null;
  const venueId = venue?.venue_id ?? venue?.id;
  if (!venueId) throw new Error('기본 지점 확보 실패');
  return venueId;
}
```
> RPC 반환 jsonb의 키(`venue_id`/`id`)는 Step 1에서 함수 정의(baseline `get_or_create_venue_container`)로 확정.

- [ ] **Step 5: 서비스 연결(직렬화 전 분기)**

`createJobPosting` 서비스에서 `serializeJobPostingV3` 호출 전:
```typescript
// 비-대회 + venueId 미지정 → 기본 지점 자동 연결(그리드 필요인원 자동 파생 전제).
let resolvedVenueId = input.venueId;
const canonicalType = getCanonicalPostingType(input.postingType);
if (canonicalType !== 'tournament' && !resolvedVenueId && workspaceId) {
  resolvedVenueId = await venueRepo.ensureDefaultVenue(workspaceId);
}
// serialize 에는 { ...input, venueId: resolvedVenueId } (또는 options.venueId) 전달
```

- [ ] **Step 6: 통과 확인**

Run: `cd uniqn-mobile && npx jest createJobPosting src/services`
Expected: PASS.

- [ ] **Step 7: 커밋**

```bash
git add uniqn-mobile/src/services uniqn-mobile/src/repositories
git commit -m "feat(grid): 비-대회 공고 생성 시 기본 지점 자동 연결(필요인원 자동 파생 전제)"
```

---

### Task 5: 멀티 지점 선택 칩(공고 작성 폼)

**Files:**
- Read+Modify: 공고 작성 폼(지점 2개+ employer). 기존 그리드 "공고 열기" `venueId` 프리필 필드 재사용.
- Test: 폼 단위 — 지점 2개+면 선택 칩 노출, 선택값이 `input.venueId`로.

**Interfaces:**
- Consumes: 활성 워크스페이스 지점 목록(기존 venue 목록 훅/리포).

- [ ] **Step 1: 대상 확인**

Run: `cd uniqn-mobile && npx --no-install rg -n "venueId" app src | rg -i "form|create|공고"`
→ 그리드 "공고 열기"가 `venueId`를 프리필하는 폼 필드 위치 확인(스펙: 동일 필드 재사용).

- [ ] **Step 2: 실패 테스트 작성**

```typescript
it('활성 워크스페이스 지점이 2개+면 지점 선택 칩을 노출한다', () => {
  const { getByText } = renderForm({ venues: [{ id: 'v1', name: '강남점' }, { id: 'v2', name: '홍대점' }] });
  expect(getByText('강남점')).toBeTruthy();
  expect(getByText('홍대점')).toBeTruthy();
});
it('지점이 1개 이하면 선택 칩을 노출하지 않는다', () => {
  const { queryByTestId } = renderForm({ venues: [{ id: 'v1', name: '기본 지점' }] });
  expect(queryByTestId('venue-select-chip')).toBeNull();
});
```

- [ ] **Step 3: 실패 확인**

Run: `cd uniqn-mobile && npx jest <폼 테스트>`
Expected: FAIL.

- [ ] **Step 4: 구현**

지점 목록 length ≥ 2일 때만 칩 렌더, 선택값을 폼 `venueId`로 바인딩(기존 프리필 필드 재사용, 대회 타입이면 미노출).

- [ ] **Step 5: 통과 + 커밋**

Run: `cd uniqn-mobile && npx jest <폼 테스트>`
Expected: PASS.
```bash
git add uniqn-mobile/app uniqn-mobile/src
git commit -m "feat(grid): 지점 2개+ 공고 작성 시 지점 선택 칩(필요인원 파생 연결)"
```

---

### Task 6: 전체 검증

- [ ] **Step 1: 품질 + 관련 테스트 전량**

Run:
```bash
cd uniqn-mobile && npm run quality && npx jest src/domains/weeklyGrid src/repositories src/services
```
Expected: type-check 0 / lint 0 / format OK / 테스트 PASS.

- [ ] **Step 2: DB 계약 재확인**

Run: `cd uniqn-mobile && npm run db:reset && npm run db:test 2>&1 | grep -A3 grid_auto_sync`
Expected: PASS.

- [ ] **Step 3: 커밋(문서 동기화)**

```bash
git add docs/superpowers/plans/2026-07-18-grid-auto-sync.md
git commit -m "docs: grid-auto-sync 구현 계획 반영"
```

> **출시 게이트(사용자, 자동 금지, 상위 스펙 §4.2):** ①prod 마이그 `apply_migration`(flag OFF라 안전) ②OTA(신규 클라 — venue_id 쓰기) ③`weekly_grid_enabled` ON(맨 마지막).

---

## Self-Review

**Spec coverage:** grid-auto-sync 스펙 §4 변경지점 매핑 — DB(Task1)·연결 클라/훅(Task4·5)·클라 타입(Task2)·클라 로직(Task3)·리포(Task2)·캐시(이미 충족, `useJobManagement.ts:123-132` 무효화 확인됨). ✓
**Placeholder scan:** DB SQL·repo·buildGridCells는 실물 코드. Task4·5는 대상 파일 grep 확정 스텝 + 신규 코드 실물 제공(RPC 래퍼·분기). fixed 제외·컨테이너 자기 제외·좌석 SUM 명시. ✓
**Type consistency:** `GridSummaryRow.requiredCount`(Task2 정의) = Task3 소비. `ensureDefaultVenue(workspaceId): Promise<string>`(Task4) 시그니처 일관. RPC 반환 키는 Step1에서 함수 정의로 확정(과가정 방지). ✓
**미확정(구현 시 확인):** `createJobPosting` 실제 파일 경로·`get_or_create_venue_container` 반환 jsonb 키·폼 venueId 필드 위치 — 각 Task Step 1의 grep으로 확정(값 가정 아닌 위치 확정).
