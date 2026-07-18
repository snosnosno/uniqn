# 근무표 대회 포함 — 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 대회(tournament) 공고가 지점(venue 컨테이너)에 연결되어 근무표 캘린더의 필요 인원/부족에 자동 집계되게 한다. 단 승인 거절된 대회는 집계에서 제외한다.

**Architecture:** 대회 배제는 DB 제약이 아니라 클라이언트 가드 2곳(자동연결 B4·칩 적용 B5)에만 있었다. 그 가드를 제거하면 파생 계산·좌석 합산식·스팬 SSOT가 이미 posting_type을 가리지 않으므로 대회가 그대로 집계된다. 여기에 승인 거절 대회를 배제하는 필터를 RPC에 추가한다. 신규 화면·신규 DB 개념·RPC 시그니처 변경은 없다.

**Tech Stack:** Expo 55 / RN 0.83.4 / React 19.2 / TS strict / Supabase(PostgreSQL, plpgsql SECDEF) / Jest / pgTAP

## Global Constraints

- 작업 디렉토리: `C:/Users/user/Desktop/T-HOLDEM-team-grid/uniqn-mobile` (워크트리, 브랜치 `feat/team-rename-grid-autosync`)
- 이 배치에 **폴드인**한다 — 새 브랜치를 만들지 않는다.
- 응답·커밋 메시지·문서·코드 주석은 **한글**로 작성한다.
- 커밋 형식: `<type>(<scope>): <한글>` — feat/fix/refactor/style/docs/test/chore/perf
- **기존 마이그레이션 파일을 수정하지 않는다.** 신규 파일만 추가한다.
- **`mcp__supabase__*` 도구를 직접 호출하지 않는다.** prod 적용은 전부 사용자 게이트다.
- DB 테스트 러너는 `npm run test:db:helpers && npx supabase test db` — bare `supabase`는 미탑재다.
- `npx --no-install rg`가 이 레포에서 동작하지 않는다 — `rg` 직접 실행 또는 Grep 도구를 쓴다.
- 커밋은 사전 승인되어 있다. push·PR 생성은 **명시 요청 전까지 하지 않는다.**
- 설계 스펙: `docs/superpowers/specs/2026-07-19-grid-tournament-inclusion-design.md`

## File Structure

| 파일 | 역할 | 변경 |
|---|---|---|
| `supabase/migrations/20260719100000_grid_tournament_inclusion_reject_filter.sql` | `get_venue_grid_summary` 재정의 — 거절 대회 배제 | **생성** |
| `supabase/tests/grid_auto_sync_required_count.test.sql` | 파생 계산 pgTAP — 승인 상태별 3케이스 추가 | 수정 |
| `src/services/jobs/jobManagementService.ts` | B4 자동연결 — 대회 가드 제거 | 수정 (L99-125) |
| `src/services/jobs/__tests__/jobManagementService.venueAutolink.test.ts` | B4 계약 테스트 — 대회 케이스 반전 | 수정 |
| `src/utils/order-sheet/venueSelection.ts` | B5 칩 적용 — 대회 가드 + `postingType` 파라미터 제거 | 수정 |
| `src/utils/order-sheet/__tests__/venueSelection.test.ts` | B5 계약 테스트 — 대회 케이스 반전 | 수정 |
| `app/(employer)/my-postings/create.tsx` | `applySelectedVenue` 호출부 인자 축소 | 수정 (L153) |
| `TODOS.md` | 이월 2건 기록 | 수정 |

Task 1(DB)은 클라이언트와 독립이다 — pgTAP이 `job_postings`에 `venue_id`를 직접 INSERT해 클라 가드를 우회하므로, 클라 변경 없이 먼저 검증된다. 그래서 **방어(거절 배제)를 먼저 넣고 그 다음 문(가드)을 연다.**

---

### Task 1: 거절된 대회를 필요 인원 집계에서 제외

**Files:**
- Create: `supabase/migrations/20260719100000_grid_tournament_inclusion_reject_filter.sql`
- Test: `supabase/tests/grid_auto_sync_required_count.test.sql` (기존 파일 확장: plan(5) → plan(8))

**Interfaces:**
- Consumes: 기존 `public.get_venue_grid_summary(uuid, text, text)` — 반환 `TABLE(d text, headcount integer, job_count integer, required_count integer)`
- Produces: 같은 시그니처·같은 반환 타입. `required` CTE만 거절 대회를 제외한다. 후속 Task는 이 함수를 호출하지 않는다(독립).

> ⚠️ **관찰 포인트**: `job_postings`에 `posting_type='tournament'` + `tournament_config->>'approvalStatus'='pending'`인 행이 INSERT되면 baseline 트리거가 발화한다(알림 생성 계열). pgTAP 트랜잭션에서 이 트리거가 에러를 내면 **우회하지 말고 에러 전문을 보고**하라 — 테스트 설계가 아니라 트리거 쪽 사실 확인이 필요한 신호다.

- [ ] **Step 1: 실패하는 테스트 작성 — 승인 상태별 3케이스 추가**

`supabase/tests/grid_auto_sync_required_count.test.sql`을 연다.

먼저 `SELECT plan(5);`를 다음으로 바꾼다:

```sql
SELECT plan(8);
```

다음으로 `DO $$` 블록의 `DECLARE` 섹션에서 마지막 변수 선언 `v_req_hconly int := -1;` **바로 아래**에 다음 5줄을 추가한다:

```sql
  v_cT    uuid;                        -- 대회 컨테이너
  v_tPend uuid := gen_random_uuid();   -- 승인 대기 대회
  v_tAppr uuid := gen_random_uuid();   -- 승인 완료 대회
  v_tRej  uuid := gen_random_uuid();   -- 승인 거절 대회
  v_req_pending int := -1; v_req_approved int := -1; v_req_rejected int := -1;
```

다음으로 컨테이너 생성부에서 `v_cB := (public.get_or_create_venue_container(v_ws, '운영처GAS_B', 'fixed') ->> 'containerId')::uuid;` **바로 아래**에 다음을 추가한다:

```sql
  v_cT := (public.get_or_create_venue_container(v_ws, '운영처GAS_T', 'dated') ->> 'containerId')::uuid;
```

다음으로 fixed 스팬 공고 INSERT 블록 **바로 아래**(주석 `-- 8/10 근무 로그 1건(spanA)` 바로 위)에 대회 공고 3건을 추가한다:

```sql
  -- 대회 3건: 승인 대기 / 승인 완료 / 승인 거절 — 같은 컨테이너, 서로 다른 날짜
  --   승인 대기 9/01 딜러 8 → required 8 (산입)
  --   승인 완료 9/02 딜러 5 → required 5 (산입)
  --   승인 거절 9/03 딜러 9 → required 0 (배제) ← 이 케이스가 RED
  INSERT INTO public.job_postings (id,owner_id,workspace_id,title,status,posting_type,venue_id,tournament_config,schedule,created_at,updated_at)
  VALUES
  (
    v_tPend, v_owner, v_ws, '__sql_fixture_gas_t_pending', 'active'::posting_status, 'tournament'::posting_type, v_cT,
    '{"approvalStatus":"pending"}'::jsonb,
    '{"kind":"dated","requirements":[{"date":"2026-09-01","timeSlots":[{"startTime":"18:00","roles":[{"role":"dealer","count":8}]}]}]}'::jsonb,
    now(), now()
  ),
  (
    v_tAppr, v_owner, v_ws, '__sql_fixture_gas_t_approved', 'active'::posting_status, 'tournament'::posting_type, v_cT,
    '{"approvalStatus":"approved"}'::jsonb,
    '{"kind":"dated","requirements":[{"date":"2026-09-02","timeSlots":[{"startTime":"18:00","roles":[{"role":"dealer","count":5}]}]}]}'::jsonb,
    now(), now()
  ),
  (
    v_tRej, v_owner, v_ws, '__sql_fixture_gas_t_rejected', 'active'::posting_status, 'tournament'::posting_type, v_cT,
    '{"approvalStatus":"rejected","rejectionReason":"테스트용 거절 사유입니다"}'::jsonb,
    '{"kind":"dated","requirements":[{"date":"2026-09-03","timeSlots":[{"startTime":"18:00","roles":[{"role":"dealer","count":9}]}]}]}'::jsonb,
    now(), now()
  );
```

다음으로 `v_reqfixed` 캡처 블록 **바로 아래**(`INSERT INTO _g VALUES` 바로 위)에 캡처 3건을 추가한다:

```sql
  BEGIN
    SELECT COALESCE(required_count, 0) INTO v_req_pending
    FROM public.get_venue_grid_summary(v_cT, '2026-09-01', '2026-09-30')
    WHERE d = '2026-09-01';
  EXCEPTION WHEN undefined_column THEN v_req_pending := -1;
  END;

  BEGIN
    SELECT COALESCE(required_count, 0) INTO v_req_approved
    FROM public.get_venue_grid_summary(v_cT, '2026-09-01', '2026-09-30')
    WHERE d = '2026-09-02';
  EXCEPTION WHEN undefined_column THEN v_req_approved := -1;
  END;

  -- 거절 대회 날짜는 배제되어 행 자체가 없어야 한다 → NOT FOUND 시 0 유지
  v_req_rejected := 0;
  BEGIN
    SELECT COALESCE(required_count, 0) INTO v_req_rejected
    FROM public.get_venue_grid_summary(v_cT, '2026-09-01', '2026-09-30')
    WHERE d = '2026-09-03';
    IF NOT FOUND THEN v_req_rejected := 0; END IF;
  EXCEPTION WHEN undefined_column THEN v_req_rejected := -1;
  END;
```

다음으로 `INSERT INTO _g VALUES` 목록의 마지막 항목 `('req_hconly', v_req_hconly::text);`를 다음으로 바꾼다:

```sql
    ('req_hconly', v_req_hconly::text),
    ('req_pending',  v_req_pending::text),
    ('req_approved', v_req_approved::text),
    ('req_rejected', v_req_rejected::text);
```

마지막으로 `SELECT * FROM finish();` **바로 위**에 단언 3개를 추가한다:

```sql
-- 6) 승인 대기 대회는 필요 인원에 산입 (제품 결정: 승인 병목 가시화)
SELECT is((SELECT v FROM _g WHERE k = 'req_pending'), '8', '승인 대기(pending) 대회의 좌석은 required_count 에 산입 = 8');

-- 7) 승인 완료 대회는 필요 인원에 산입
SELECT is((SELECT v FROM _g WHERE k = 'req_approved'), '5', '승인 완료(approved) 대회의 좌석은 required_count 에 산입 = 5');

-- 8) 승인 거절 대회는 배제 — 열리지 않을 대회가 영구 부족분으로 남지 않아야 한다
SELECT is((SELECT v FROM _g WHERE k = 'req_rejected'), '0', '승인 거절(rejected) 대회의 좌석은 required_count 에서 배제 = 0');
```

- [ ] **Step 2: 테스트를 돌려 실패를 확인 (RED)**

```bash
cd C:/Users/user/Desktop/T-HOLDEM-team-grid/uniqn-mobile
npm run test:db:helpers && npx supabase test db
```

기대: `grid_auto_sync_required_count` 에서 **테스트 8번만 실패**한다.
```
not ok 8 - 승인 거절(rejected) 대회의 좌석은 required_count 에서 배제 = 0
#         have: 9
#         want: 0
```
6·7번은 통과해야 한다(현재 함수가 승인 상태를 안 보므로 pending·approved도 그냥 산입된다 = 원하는 동작과 우연히 일치).

**8번이 통과해 버리면 멈추고 보고하라** — 테스트가 실제 결함을 잡지 못하고 있다는 뜻이다.

- [ ] **Step 3: 마이그레이션 작성**

`supabase/migrations/20260719100000_grid_tournament_inclusion_reject_filter.sql` 파일을 새로 만든다. 반환 타입이 바뀌지 않으므로 `CREATE OR REPLACE`를 쓴다(DROP 불필요). 본문은 기존 함수 전체를 그대로 옮기고 `required` CTE에 WHERE 조건 한 줄만 추가한다.

```sql
-- ============================================================
-- 근무표 대회 포함 — 승인 거절 대회를 required_count 에서 배제
-- ============================================================
-- 배경: 대회가 지점(venue)에 연결될 수 있게 되면서, 기존 required CTE 가
--   tournament_config->>'approvalStatus' 를 보지 않는 점이 결함으로 활성화된다.
--   관리자가 거절한 대회(열리지 않을 대회)의 좌석이 필요 인원에 영구 산입되어
--   근무표에 영원히 채울 수 없는 부족분이 남는다.
-- 결정: pending·approved 는 산입(승인 병목 가시화 = 계획 정보), rejected 만 배제.
--   대회의 job_postings.status 는 생성 시 'active' 고정이고 승인 상태는 별도
--   JSONB 컬럼에 살기 때문에, status 필터로는 잡을 수 없다.
-- 반환 타입 무변경 → CREATE OR REPLACE. 시그니처·ACL·SECDEF 하드닝 그대로 유지.
-- 설계: docs/superpowers/specs/2026-07-19-grid-tournament-inclusion-design.md §4
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_venue_grid_summary(p_venue uuid, p_from text, p_to text)
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
    -- M1: venue 스팬 ∩ 동일 workspace (타 워크스페이스 유령행 차단)
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
      -- seat-basis SSOT(_total_positions_from_schedule)와 동일한 좌석 합산식
      SUM(GREATEST(COALESCE((r->>'count')::int, (r->>'headcount')::int, 0), 0))::int AS required_count
    FROM public.job_postings jp
    JOIN span ON span.id = jp.id
    CROSS JOIN LATERAL jsonb_array_elements(COALESCE(jp.schedule->'requirements', '[]'::jsonb)) req
    CROSS JOIN LATERAL jsonb_array_elements(COALESCE(req->'timeSlots', '[]'::jsonb)) ts
    CROSS JOIN LATERAL jsonb_array_elements(COALESCE(ts->'roles', '[]'::jsonb)) r
    WHERE jp.id <> p_venue                       -- 컨테이너 자신 제외(이중 계상 방지)
      AND req->>'date' IS NOT NULL               -- dated only (fixed 제외)
      AND (req->>'date') >= p_from AND (req->>'date') <= p_to
      -- 빈 role 스킵(SSOT 동일): role/name 둘 다 비면 좌석 아님
      AND COALESCE(NULLIF(btrim(r->>'role'), ''), NULLIF(btrim(r->>'name'), '')) IS NOT NULL
      -- 승인 거절 대회 배제: 열리지 않을 대회가 영구 부족분으로 남지 않게 한다.
      -- 대회 status 는 'active' 고정이라 status 필터로는 잡히지 않는다.
      AND NOT (jp.posting_type = 'tournament'
               AND jp.tournament_config->>'approvalStatus' = 'rejected')
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

-- CREATE OR REPLACE 는 기존 권한을 보존하지만, 드리프트 방어로 재선언한다(멱등).
ALTER FUNCTION public.get_venue_grid_summary(uuid, text, text) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.get_venue_grid_summary(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_venue_grid_summary(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_venue_grid_summary(uuid, text, text) TO service_role;
COMMENT ON FUNCTION public.get_venue_grid_summary(uuid, text, text) IS
  '주간 그리드 월 요약: venue 스팬 ∩ 동일 workspace 날짜별 headcount + job_count + required_count(requirements Σ count, dated only, 승인 거절 대회 배제). E1 SSOT, SECDEF 게이트, M1 재필터.';
```

- [ ] **Step 4: DB를 리셋해 마이그레이션을 적용하고 테스트 통과 확인 (GREEN)**

```bash
cd C:/Users/user/Desktop/T-HOLDEM-team-grid/uniqn-mobile
npm run db:reset
npm run test:db:helpers && npx supabase test db
```

기대: `grid_auto_sync_required_count` 8/8 통과. 다른 pgTAP 파일에 신규 실패가 없어야 한다.
`jpc_rls` 5/6/7 실패는 **사전 존재 baseline**이며 이 작업과 무관하다 — 그대로 두고 보고에만 명시한다.

- [ ] **Step 5: 커밋**

```bash
cd C:/Users/user/Desktop/T-HOLDEM-team-grid
git add uniqn-mobile/supabase/migrations/20260719100000_grid_tournament_inclusion_reject_filter.sql uniqn-mobile/supabase/tests/grid_auto_sync_required_count.test.sql
git commit -m "fix(db): 승인 거절 대회를 근무표 필요인원 집계에서 배제

대회 status 는 'active' 고정이고 승인 상태는 tournament_config JSONB 에
살기 때문에 기존 required CTE 가 거절 대회를 걸러내지 못했다. 대회가
지점에 연결되면 열리지 않을 대회의 좌석이 영구 부족분으로 남는다.

pending·approved 는 산입(승인 병목 가시화), rejected 만 배제.
pgTAP 3케이스 추가 — 거절 케이스 red-green 실측.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: 대회도 기본 지점에 자동 연결 (B4)

**Files:**
- Modify: `src/services/jobs/jobManagementService.ts:99-125`
- Test: `src/services/jobs/__tests__/jobManagementService.venueAutolink.test.ts`

**Interfaces:**
- Consumes: `jobPostingRepository.getVenueContainers(workspaceId)`, `jobPostingRepository.getOrCreateVenueContainer(workspaceId, {name, kind})` — 기존 시그니처 그대로
- Produces: `resolveDefaultVenueId(input: CreateJobPostingInput, workspaceId: string): Promise<string | undefined>` — 시그니처 무변경. 동작만 바뀐다(대회도 분기 진입).

- [ ] **Step 1: 실패하는 테스트 작성 — 대회 케이스 반전**

`src/services/jobs/__tests__/jobManagementService.venueAutolink.test.ts`를 연다.

먼저 파일 상단 docblock의 계약 줄을 바꾼다. 다음 줄을:

```
 * - 대회 공고 → 분기 진입하지 않는다(venue_id NULL 유지, 관련 리포 미호출).
```

다음으로 교체한다:

```
 * - 대회 공고 → 비-대회와 동일하게 자동 연결한다(근무표에 대회 인원 집계 — 2026-07-19 결정 반전).
```

다음으로 기존 대회 테스트를 통째로 교체한다. 다음 블록을:

```ts
  it('대회 공고 → 분기 진입 안 함(venue_id NULL, 관련 리포 미호출)', async () => {
    await createJobPosting(
      createInput({ postingType: 'tournament' }),
      'employer-1',
      'Owner',
      'workspace-1'
    );

    expect(mockGetVenueContainers).not.toHaveBeenCalled();
    expect(mockGetOrCreateVenueContainer).not.toHaveBeenCalled();
    expect(passedInput().venueId).toBeUndefined();
  });
```

다음 두 테스트로 교체한다:

```ts
  it('대회 공고 + 지점 1개 → 비-대회와 동일하게 그 지점 id 로 연결한다', async () => {
    mockGetVenueContainers.mockResolvedValue([venueContainer('venue-1')]);

    await createJobPosting(
      createInput({ postingType: 'tournament' }),
      'employer-1',
      'Owner',
      'workspace-1'
    );

    expect(mockGetVenueContainers).toHaveBeenCalledWith('workspace-1');
    expect(passedInput().venueId).toBe('venue-1');
  });

  it('대회 공고 + 지점 0개 → 기본 지점을 생성해 연결한다(가게 없는 대회사 경로)', async () => {
    mockGetVenueContainers.mockResolvedValue([]);
    mockGetOrCreateVenueContainer.mockResolvedValue(venueContainer('venue-new'));

    await createJobPosting(
      createInput({ postingType: 'tournament' }),
      'employer-1',
      'Owner',
      'workspace-1'
    );

    expect(mockGetOrCreateVenueContainer).toHaveBeenCalledWith('workspace-1', {
      name: '기본 지점',
      kind: 'dated',
    });
    expect(passedInput().venueId).toBe('venue-new');
  });
```

- [ ] **Step 2: 테스트를 돌려 실패를 확인 (RED)**

```bash
cd C:/Users/user/Desktop/T-HOLDEM-team-grid/uniqn-mobile
npx jest src/services/jobs/__tests__/jobManagementService.venueAutolink.test.ts
```

기대: 신규 대회 테스트 **2개 실패**. 현재 가드가 분기를 막으므로 `venueId`가 `undefined`다.
```
● 대회 공고 + 지점 1개 → 비-대회와 동일하게 그 지점 id 로 연결한다
  expect(received).toBe(expected)
  Expected: "venue-1"
  Received: undefined
```
기존 5개 테스트는 계속 통과해야 한다.

- [ ] **Step 3: 가드 제거**

`src/services/jobs/jobManagementService.ts`에서 다음 줄을:

```ts
  if (getCanonicalPostingType(input.postingType) !== 'tournament' && !resolvedVenueId) {
```

다음으로 바꾼다:

```ts
  if (!resolvedVenueId) {
```

그리고 함수 위 주석에 대회 포함 사실이 드러나지 않으면 다음 한 줄을 `resolveDefaultVenueId` 선언 바로 위에 추가한다:

```ts
/**
 * 공고를 담을 기본 지점(venue 컨테이너)을 정한다.
 * 대회도 포함한다 — 근무표에서 대회 기간 인원/부족을 집계하기 위함(2026-07-19 결정).
 * 지점 1개면 그 지점, 0개면 기본 지점 생성, 2개 이상이면 미연결(폼 선택칩=B5 담당).
 */
```

**주의:** `getCanonicalPostingType`이 이 파일의 다른 곳에서도 쓰이는지 확인한다.

```bash
rg -n "getCanonicalPostingType" src/services/jobs/jobManagementService.ts
```

호출이 0건이면 파일 상단 import 문에서 `getCanonicalPostingType`을 제거한다(미사용 import는 lint 실패를 만든다). 다른 호출이 남아 있으면 import를 그대로 둔다.

- [ ] **Step 4: 테스트를 돌려 통과 확인 (GREEN)**

```bash
cd C:/Users/user/Desktop/T-HOLDEM-team-grid/uniqn-mobile
npx jest src/services/jobs/__tests__/jobManagementService.venueAutolink.test.ts
```

기대: 7개 전부 통과 (기존 5 + 신규 2).

이어서 같은 서비스의 형제 스위트에 회귀가 없는지 확인한다:

```bash
npx jest src/services/jobs/__tests__/
```

기대: 실패 0.

- [ ] **Step 5: 커밋**

```bash
cd C:/Users/user/Desktop/T-HOLDEM-team-grid
git add uniqn-mobile/src/services/jobs/jobManagementService.ts uniqn-mobile/src/services/jobs/__tests__/jobManagementService.venueAutolink.test.ts
git commit -m "feat(grid): 대회 공고도 기본 지점에 자동 연결

대회를 근무표에 포함하기로 결정하면서 B4 자동연결의 대회 배제 가드를
제거한다. 지점 0개인 대회사는 기본 지점이 자동 생성되어 독립 대회도
같은 경로로 집계된다.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: 지점 선택 칩이 대회에도 적용 (B5)

**Files:**
- Modify: `src/utils/order-sheet/venueSelection.ts`
- Modify: `app/(employer)/my-postings/create.tsx:153`
- Test: `src/utils/order-sheet/__tests__/venueSelection.test.ts`

**Interfaces:**
- Consumes: `CreateJobPostingInput` (from `@/types/jobPosting`)
- Produces: `applySelectedVenue(input: CreateJobPostingInput, selectedVenueId: string | undefined): CreateJobPostingInput` — **파라미터가 3개에서 2개로 줄어든다.** `postingType` 인자는 제거된다. `shouldShowVenueChips(venueCount: number, routeVenueId: string | undefined): boolean`은 무변경.

- [ ] **Step 1: 실패하는 테스트 작성 — 대회 케이스 반전 + 시그니처 축소**

`src/utils/order-sheet/__tests__/venueSelection.test.ts`를 연다.
`describe('applySelectedVenue', ...)` 블록 전체를 다음으로 교체한다:

```ts
/**
 * 대회 전용 케이스가 없는 이유: postingType 파라미터를 제거해 헬퍼가 공고 종류를
 * 구분할 수단 자체를 없앴다. "대회도 적용된다"는 이제 런타임 분기가 아니라
 * 타입 수준의 구조적 보장이므로, 같은 인자로 두 번 호출하는 동어반복 테스트를
 * 두지 않는다. 대회 경로의 실질 보장은 B4(jobManagementService.venueAutolink)와
 * 호출부 create.tsx 의 인자 축소가 담당한다.
 */
describe('applySelectedVenue', () => {
  // 헬퍼는 input을 읽고 스프레드만 하므로 최소 형상으로 캐스팅해도 로직 검증에 충분하다.
  const baseInput = { title: '테스트 공고' } as CreateJobPostingInput;

  it('선택 지점이 있으면 공고 종류와 무관하게 input.venueId를 선택값으로 설정한다', () => {
    const result = applySelectedVenue(baseInput, 'venue-2');
    expect(result.venueId).toBe('venue-2');
  });

  it('선택 지점이 없으면 input을 그대로 반환한다', () => {
    const result = applySelectedVenue(baseInput, undefined);
    expect(result).toBe(baseInput);
    expect(result.venueId).toBeUndefined();
  });

  it('원본 input을 변형하지 않는다(불변)', () => {
    applySelectedVenue(baseInput, 'venue-2');
    expect(baseInput.venueId).toBeUndefined();
  });
});
```

- [ ] **Step 2: 테스트를 돌려 실패를 확인 (RED)**

```bash
cd C:/Users/user/Desktop/T-HOLDEM-team-grid/uniqn-mobile
npx jest src/utils/order-sheet/__tests__/venueSelection.test.ts
```

기대: TypeScript 인자 개수 불일치로 컴파일 단계에서 실패한다.
```
Expected 3 arguments, but got 2.
```
이것이 이 태스크의 RED다 — 시그니처가 아직 3개 파라미터이기 때문이다.

- [ ] **Step 3: 가드와 파라미터 제거**

`src/utils/order-sheet/venueSelection.ts`에서 `applySelectedVenue` 함수와 그 위 JSDoc 블록 전체를 다음으로 교체한다:

```ts
/**
 * 제출 input에 선택 지점을 적용한다.
 *
 * 대회(tournament)도 포함한다 — 근무표에서 대회 기간 인원/부족을 집계하기 위해
 * 대회도 venue_id 를 갖는다(2026-07-19 결정, 기존 "대회 = venue_id NULL 유지" 반전).
 * 칩 노출 조건(shouldShowVenueChips)이 postingType 을 보지 않으므로 대회 선택 시에도
 * 칩이 렌더된다 — 여기서 걸러내면 사용자 선택이 조용히 증발한다.
 * - 미선택(2개+인데 안 고름) → input 그대로 → B4가 다중 지점이라 미연결(venue_id 없음, 허용).
 */
export function applySelectedVenue(
  input: CreateJobPostingInput,
  selectedVenueId: string | undefined
): CreateJobPostingInput {
  if (selectedVenueId) {
    return { ...input, venueId: selectedVenueId };
  }
  return input;
}
```

`postingType` 파라미터가 사라지면서 `OrderSheetValues` import가 이 파일에서 미사용이 될 수 있다. 확인한다:

```bash
rg -n "OrderSheetValues" src/utils/order-sheet/venueSelection.ts
```

import 문 외에 사용처가 없으면 해당 import 줄을 제거한다.

- [ ] **Step 4: 호출부 인자 축소**

`app/(employer)/my-postings/create.tsx`에서 다음 두 줄을:

```ts
        // 선택 지점을 반영(대회는 venue_id NULL 유지 불변식 — 헬퍼가 tournament를 제외).
        const finalInput = applySelectedVenue(input, selectedVenueId, values.postingType);
```

다음으로 바꾼다:

```ts
        // 선택 지점을 반영(대회 포함 — 근무표에서 대회 인원/부족을 집계한다).
        const finalInput = applySelectedVenue(input, selectedVenueId);
```

- [ ] **Step 5: 테스트와 타입 체크를 돌려 통과 확인 (GREEN)**

```bash
cd C:/Users/user/Desktop/T-HOLDEM-team-grid/uniqn-mobile
npx jest src/utils/order-sheet/__tests__/venueSelection.test.ts
npx tsc --noEmit
```

기대: jest 전부 통과, `tsc --noEmit` 에러 0.
`tsc`가 `values.postingType` 미사용 관련 에러를 내면 Step 4의 호출부 수정이 누락된 것이다.

- [ ] **Step 6: 커밋**

```bash
cd C:/Users/user/Desktop/T-HOLDEM-team-grid
git add uniqn-mobile/src/utils/order-sheet/venueSelection.ts "uniqn-mobile/app/(employer)/my-postings/create.tsx" uniqn-mobile/src/utils/order-sheet/__tests__/venueSelection.test.ts
git commit -m "feat(grid): 지점 선택 칩을 대회에도 적용

칩 노출 조건은 postingType 을 보지 않아 대회에서도 칩이 렌더됐지만
제출 단계에서 대회를 제외해 사용자 선택이 조용히 증발했다. 대회 포함
결정에 따라 가드를 제거하고 죽은 postingType 파라미터도 함께 없앤다.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: 전체 검증 + 이월 항목 기록

**Files:**
- Modify: `TODOS.md`

**Interfaces:**
- Consumes: Task 1~3의 모든 변경
- Produces: 없음(문서·검증 태스크)

- [ ] **Step 1: 품질 게이트 전체 실행**

```bash
cd C:/Users/user/Desktop/T-HOLDEM-team-grid/uniqn-mobile
npm run quality
```

기대: exit 0 (type-check + lint + format:check 전부 통과).
lint가 미사용 import를 잡으면 Task 2 Step 3 / Task 3 Step 3의 import 정리가 누락된 것이다.

- [ ] **Step 2: 전체 jest 실행**

```bash
cd C:/Users/user/Desktop/T-HOLDEM-team-grid/uniqn-mobile
npx jest
```

기대: 실패 0. 기준선은 이 배치의 직전 측정치 **499스위트 / 5645 pass**다. 스위트·테스트 수가 신규 추가분만큼 늘고 실패가 0이면 통과다.

**실패가 나오면 반드시 실패 목록 전문을 보고하라.** 숫자만 보고하지 말 것.

- [ ] **Step 3: DB 테스트 전체 실행**

```bash
cd C:/Users/user/Desktop/T-HOLDEM-team-grid/uniqn-mobile
npm run test:db:helpers && npx supabase test db
```

기대: `grid_auto_sync_required_count` 8/8 통과. `jpc_rls` 5/6/7 실패는 사전 존재 baseline이므로 그대로 두되 **보고에 명시**한다.

- [ ] **Step 4: 이월 항목을 TODOS.md에 기록**

`TODOS.md` 맨 끝에 다음을 추가한다:

```markdown

---

## 근무표 대회 포함 — 이월 (2026-07-19)

### required CTE 에 job_postings.status 필터 부재
- **What**: `get_venue_grid_summary` 의 `required` CTE 가 공고 status 를 전혀 보지 않아 **취소된(`cancelled`) 일반 공고의 requirements 도 필요인원에 산입**된다.
- **Why 이월**: `closed` 는 만석 마감(capacity_full→closed)일 수 있어 배제하면 required 만 떨어지고 headcount 는 남아 셀이 왜곡된다. 상태별 구분 판단이 선행돼야 한다.
- **Effort**: S | **Priority**: P2 | 대회 포함과 무관하게 기존 배치에 이미 존재하는 동작.

### 캘린더 셀 "대회 있는 날" 표식
- **What**: 근무표 셀에서 평소 운영과 대회를 구분하는 표식(예: 골드 점).
- **Why 이월**: 셀 표식을 그리려면 `get_venue_grid_summary` 가 날짜별 대회 포함 여부를 반환해야 해 "RPC 응답 컬럼 변경 0" 원칙과 충돌한다. 날짜 탭 시 상세 패널에 `대회` 배지가 이미 뜬다.
- **재검토 조건**: D-7 대회가 몰리는 주에 구분 부재가 실사용 문제로 확인되면 RPC 컬럼 추가와 함께 착수.
- **Effort**: M | **Priority**: P3.

### 대회사 대상 "지점" 라벨
- **What**: 대회사에게 "지점"은 장소가 아니라 대회를 담는 서랍이라 어색할 수 있다.
- **Why 이월**: 구조가 아니라 문구만의 문제. 실사용 피드백 후 라벨만 조정.
- **Effort**: S | **Priority**: P3.
```

- [ ] **Step 5: 커밋**

```bash
cd C:/Users/user/Desktop/T-HOLDEM-team-grid
git add TODOS.md
git commit -m "docs: 근무표 대회 포함 이월 3건 기록

- required CTE status 필터 부재(cancelled 공고 산입) — 기존 배치 사안
- 캘린더 셀 대회 표식 — RPC 컬럼 변경 필요라 별건
- 대회사 '지점' 라벨 — 문구 사안

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

- [ ] **Step 6: 최종 브랜치 상태 확인**

```bash
cd C:/Users/user/Desktop/T-HOLDEM-team-grid
git log --oneline 5b7daafdd..HEAD
git status --short
```

기대: 기존 8커밋 + 설계문서 2커밋 + 이번 4커밋 = 14커밋. 워킹트리에 의도치 않은 변경이 없어야 한다.

**push·PR 생성은 하지 않는다** — 사용자 명시 요청 전까지 브랜치를 보존한다.

---

## 완료 정의

- [ ] `npm run quality` exit 0
- [ ] 전체 jest 실패 0
- [ ] pgTAP `grid_auto_sync_required_count` 8/8 (거절 케이스 red-green 실측 완료)
- [ ] 대회가 지점 1개·0개 양쪽에서 자동 연결됨 (jest 실측)
- [ ] 지점 칩 선택이 대회에도 반영됨 (jest 실측)
- [ ] 이월 3건 TODOS.md 기록
- [ ] 브랜치 미push 보존
