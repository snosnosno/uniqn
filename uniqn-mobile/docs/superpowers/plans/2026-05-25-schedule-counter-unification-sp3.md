# 스케줄 단일 카운터 + dead counter 제거 (SP3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** dead counter(`schedule...roles[].filled`)를 완전 제거하고, 역할별 표시를 work_logs 기반 hydrate 단일 소스로 정합시키며(fixed/grouped 포함), `filled_positions` 를 수동 RPC 갱신에서 `applications` status 트리거로 이관하여 drift 를 제거한다.

**Architecture:** A안 — work_logs 가 역할 단위 권위 소스, `get_posting_filled_counts` hydrate RPC **유지**. dead counter `filled` 는 타입/스키마/직렬화/표시에서 제거하되 기존 doc 의 잔류 `filled` 키는 마이그레이션 strip + deserialize 무시로 읽기 호환. `filled_positions`(슬롯 점유 인원, completed 후 유지)는 기존 `fn_update_job_posting_stats` 트리거에 통합하여 `status IN ('confirmed','cancellation_pending','completed')` delta 로 유지하고, confirm/cancel RPC 의 수동 ±1 을 제거한다.

**Tech Stack:** PostgreSQL plpgsql trigger (MCP `apply_migration`), TypeScript strict, Zod, Jest, TanStack Query.

**MCP 규칙:** 마이그레이션/트리거/RPC/execute_sql 검증은 **메인만**. 서브에이전트는 SQL·코드·검증절차를 작성하고 메인이 적용.

**의존:** SP1(스키마 통일) + SP2(fixed work_logs 생성·confirm 통일) 완료 후 누적.

---

## File Structure

| 파일                                                               | 책임                                                                   | Task |
| ------------------------------------------------------------------ | ---------------------------------------------------------------------- | ---- |
| `src/types/jobPosting.ts`                                          | `PostingSlotRoleRequirement.filled` 필드 제거                          | 1    |
| `src/schemas/jobPosting.schema.ts`                                 | 역할 zod 스키마 `filled` 제거 (strict 유지)                            | 1    |
| `src/domains/job-posting/serialization.ts`                         | `filled` 직렬화 출력 제거 + deserialize 잔류 `filled` strip(읽기 호환) | 1    |
| `src/utils/job-posting/draftAdapter.ts`                            | `filled` 매핑 제거                                                     | 1    |
| `src/domains/job-posting/stats.ts`                                 | `calculateFilledPositionsFromSchedule` 제거(컬럼 권위) + 소비자 정리   | 2    |
| `src/domains/job-posting/core.ts`                                  | `getPostingRoleStats` 등 `role.filled` 읽기 제거                       | 2    |
| `src/utils/normalizers/scheduleNormalizer.ts`, `roleNormalizer.ts` | `filled` 읽기 제거                                                     | 2    |
| `src/domains/application/slotCapacity.ts`                          | `filled` 읽기 제거(정원만; enforcement 는 서버 H1)                     | 2    |
| `src/domains/application/DateRequirementUpdater.ts`                | **파일 제거** + 호출부 정리(invalidate 대체)                           | 3    |
| `src/components/jobs/shared/postingSurfaceModel.ts`                | fixed/grouped 분기 hydrate 전달 + 범위 합산                            | 4    |
| `src/repositories/supabase/JobPostingRepository.ts`                | hydrate 서브맵 fixed/grouped 키 지원(필요 시)                          | 4    |
| `supabase/migrations/<ts>_strip_schedule_filled.sql`               | schedule JSONB `filled` strip(멱등)                                    | 5    |
| `supabase/migrations/<ts>_filled_positions_trigger.sql`            | `fn_update_job_posting_stats` 확장 + 백필                              | 6    |
| `supabase/migrations/<ts>_rpc_drop_manual_filled.sql`              | confirm/cancel RPC 수동 `filled_positions` 갱신 제거                   | 7    |

> **불변식**: 역할별 (filled/count) 표시가 fixed/grouped/dated 모두 work_logs 집계와 정합. `filled_positions` 가 confirm/cancel/complete 전 경로에서 `COUNT(filled-status apps)` 와 동치(drift 0).

---

## Task 1: dead counter `filled` 제거 — 타입/스키마/직렬화 + 읽기 호환

**Files:**

- Modify: `src/types/jobPosting.ts` (`PostingSlotRoleRequirement` 정의)
- Modify: `src/schemas/jobPosting.schema.ts` (`postingSlotRoleRequirementSchema`)
- Modify: `src/domains/job-posting/serialization.ts` (`filled` 직렬화 + deserialize strip)
- Modify: `src/utils/job-posting/draftAdapter.ts` (`filled` 매핑)
- Test: `src/domains/job-posting/__tests__/serialization.filled-removal.test.ts` (신규)

- [ ] **1.0 현재 코드 확인** — `PostingSlotRoleRequirement` 인터페이스(grep `interface PostingSlotRoleRequirement`), `postingSlotRoleRequirementSchema`, serialization 의 role 직렬화/역직렬화 헬퍼, draftAdapter 의 `filled` 매핑 위치를 읽어 정확한 라인 파악.

- [ ] **1.1 실패 테스트 작성** — `serialization.filled-removal.test.ts`:

```ts
import {
  serializeJobPostingV3,
  deserializeJobPostingDocument,
} from '@/domains/job-posting/serialization';
import type { CreateJobPostingInput, JobPostingDocumentV3 } from '@/types/jobPosting';

const base: Omit<CreateJobPostingInput, 'schedule'> = {
  postingType: 'dated',
  title: 'T',
  location: { name: 'Seoul' },
  roleCatalog: [{ role: 'dealer' }],
  compensation: { mode: 'shared' },
  questions: { items: [] },
};

describe('SP3 filled 제거', () => {
  it('직렬화 결과 role 에 filled 키가 없다', () => {
    const doc = serializeJobPostingV3(
      {
        ...base,
        schedule: {
          kind: 'dated',
          requirements: [
            {
              date: '2026-06-01',
              timeSlots: [
                {
                  startTime: '19:00',
                  isTimeToBeAnnounced: false,
                  roles: [{ role: 'dealer', count: 3 }],
                },
              ],
            },
          ],
        },
      },
      { ownerId: 'o1', workspaceId: '00000000-0000-0000-0000-000000000000' }
    );
    const roles = (doc.schedule as { requirements: { timeSlots: { roles: object[] }[] }[] })
      .requirements[0].timeSlots[0].roles;
    expect(roles[0]).not.toHaveProperty('filled');
  });

  it('레거시 doc 의 잔류 filled 키를 deserialize 가 무시(드롭)한다 (읽기 호환)', () => {
    const legacy = {
      id: 'j1',
      schemaVersion: 3,
      title: 'T',
      status: 'active',
      ownerId: 'o1',
      postingType: 'dated',
      workDate: '',
      totalPositions: 3,
      filledPositions: 1,
      location: { name: 'Seoul' },
      schedule: {
        kind: 'dated',
        requirements: [
          {
            date: '2026-06-01',
            timeSlots: [
              {
                startTime: '19:00',
                isTimeToBeAnnounced: false,
                roles: [{ role: 'dealer', count: 3, filled: 1 }],
              },
            ],
          },
        ],
      },
      roleCatalog: [{ role: 'dealer' }],
      compensation: { mode: 'shared' },
      questions: { items: [] },
    } as unknown as JobPostingDocumentV3;
    const posting = deserializeJobPostingDocument(legacy);
    const roles = (posting.schedule as { requirements: { timeSlots: { roles: object[] }[] }[] })
      .requirements[0].timeSlots[0].roles;
    expect(roles[0]).not.toHaveProperty('filled');
    expect(roles[0]).toMatchObject({ role: 'dealer', count: 3 });
  });
});
```

- [ ] **1.2 실패 확인** — `npx jest serialization.filled-removal` → FAIL (현재 `filled` 직렬화/보존).
- [ ] **1.3 타입 수정** — `PostingSlotRoleRequirement` 에서 `filled?: number;` 필드 삭제. `filled` 를 참조하던 타입 의존이 컴파일 에러를 내면 Task 2 에서 해소되는 사용처이므로 일시 허용(이 Task PASS 기준은 1.1 테스트 + serialization/types/schema 파일 컴파일).
- [ ] **1.4 zod 수정** — `postingSlotRoleRequirementSchema` 에서 `filled: z.number().optional()` 줄 삭제. `.strict()` 유지(잔류 filled 는 deserialize 가 사전 strip 하므로 zod 게이트에 도달 안 함).
- [ ] **1.5 serialization 수정**:
  - role 직렬화 헬퍼에서 `...(role.filled !== undefined ? { filled: role.filled } : {})` 류 출력 줄 삭제.
  - deserialize 의 역호환 흡수 지점(`buildFixedSyntheticRequirement` 및 dated requirement 매핑)에서 role 매핑 시 `filled` 를 **명시적으로 드롭**(즉 `{ id?, role?, customRole?, count }` 만 복사, `filled` 미복사). 이로써 잔류 `filled` doc 이 zod strict 게이트 전에 정규화됨.
  - `parseJobPostingDocument` 경로(JobPostingRepository/ApplicationRepositoryHelpers/SettlementRepository 가 호출)가 deserialize 정규화를 거치는지 확인 — 거치면 자동 호환. (SP1 back-compat 갭: safeParse 가 deserialize 앞에 있으면, strip 이 safeParse 전에 일어나도록 정규화 순서 점검. 필요 시 `parseJobPostingDocument` 가 raw doc 의 role 에서 `filled` 를 사전 strip 후 safeParse.)
- [ ] **1.6 draftAdapter 수정** — `filled` 매핑(`buildFixedSyntheticRequirement`/`draftToCreateJobPostingInput`/`buildFixedDraftFromPosting` 의 `...(role.filled !== undefined ? { filled } : {})`) 삭제.
- [ ] **1.7 통과 확인** — `npx jest serialization.filled-removal` → PASS. `npx jest src/domains/job-posting/__tests__/serialization` 회귀 갱신.
- [ ] **1.8 커밋** — `git add src/types/jobPosting.ts src/schemas/jobPosting.schema.ts src/domains/job-posting/serialization.ts src/utils/job-posting/draftAdapter.ts src/domains/job-posting/__tests__/serialization.filled-removal.test.ts && git commit -m "refactor(jobPosting): schedule dead counter filled 제거 + 레거시 doc 읽기 호환"`

---

## Task 2: `filled` 읽기 사용처 제거 (stats/core/normalizers/slotCapacity)

**Files:**

- Modify: `src/domains/job-posting/stats.ts`, `core.ts`, `src/utils/normalizers/scheduleNormalizer.ts`, `roleNormalizer.ts`, `src/domains/application/slotCapacity.ts`
- Test: 각 파일 기존 테스트 갱신 + `core.role-stats.test.ts`

- [ ] **2.0 현재 코드 확인** — `grep -rn "\.filled" src/domains src/utils/normalizers` 로 `role.filled`/`requirement...filled` 읽기 전수 파악(테스트 제외).
- [ ] **2.1 실패 테스트 작성/갱신** — `getPostingRoleStats` 가 `filled` 없이 정원만 집계(역할별 filled 는 hydrate 소관)하는지:

```ts
it('getPostingRoleStats 는 filled 를 0 또는 미포함으로 반환(정원만 권위)', () => {
  // 통일 schedule(dated, dealer count 3) posting → role stats count=3
  const stats = getPostingRoleStats(posting);
  expect(stats.find((s) => s.role === 'dealer')?.count).toBe(3);
  // filled 는 표시 단계 hydrate 가 채움 — 여기선 0
  expect(stats.find((s) => s.role === 'dealer')?.filled ?? 0).toBe(0);
});
```

- [ ] **2.2 실패 확인** — 현재 `role.filled` 읽어 합산하므로 타입 에러 또는 값 불일치 → FAIL/컴파일에러.
- [ ] **2.3 구현**:
  - `stats.ts`: `calculateFilledPositionsFromSchedule` **제거**(filled_positions 는 컬럼·트리거 권위). 이 함수 호출처를 `posting.filledPositions ?? 0` 또는 stats 컬럼 읽기로 대체(grep 호출처). `calculateTotalPositionsFromSchedule` 는 `filled` 미사용이므로 유지.
  - `core.ts getPostingRoleStats`: `existing.filled += role.filled ?? 0` 등 filled 누적 줄 삭제. `JobRoleStats.filled` 타입이 required 면 `filled: 0` 초기화(표시 단계 hydrate 가 덮음) 또는 타입에서 filled optional 화 — 소비자 점검 후 결정(권장: `filled: 0` 고정, hydrate 가 표시 시 대체).
  - `scheduleNormalizer.ts`/`roleNormalizer.ts`: `filled: role.filled ?? 0` → `filled: 0`(또는 필드 제거, 소비자 정합).
  - `slotCapacity.ts`: `filled: role.filled ?? 0`(line 68) → `filled: 0`, `remaining: Math.max(0, role.count - (role.filled ?? 0))` → `remaining: role.count`. (클라 capacity 는 정원 형태 검증용; 실 overfill enforcement 는 서버 H1 — SP2.) 주석으로 명시.
- [ ] **2.4 통과 확인** — 관련 Jest 갱신 통과 + `npx jest src/domains/job-posting src/domains/application/__tests__/slotCapacity` PASS.
- [ ] **2.5 커밋** — `git commit -m "refactor(jobPosting): role.filled 읽기 제거 — 정원은 schedule, filled 는 hydrate 단일 소스"`

---

## Task 3: `DateRequirementUpdater` 제거 + 호출부 invalidate 대체

**Files:**

- Delete: `src/domains/application/DateRequirementUpdater.ts`
- Delete: `src/domains/application/__tests__/DateRequirementUpdater.test.ts`
- Modify: 호출부(grep) + `src/domains/application/index.ts` export
- Test: 호출부 동작 테스트(invalidate)

- [ ] **3.0 호출부 전수 파악** — `grep -rn "updateDateSpecificRequirementsFilled\|updatePostingScheduleFilled\|DateRequirementUpdater" src` (테스트 제외). 각 호출이 (a) 낙관적 UI 갱신용인지 (b) 영속화용인지 분류.
- [ ] **3.1 실패 테스트 작성** — confirm/cancel 성공 후 `usePostingFilledCounts` 쿼리가 invalidate 되는지(낙관적 schedule 갱신 대체). 호출부가 훅/서비스면 해당 레벨에서:

```ts
it('확정 성공 후 filledCounts 쿼리를 invalidate 한다', async () => {
  const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');
  await confirmMutation.mutateAsync({ applicationId: 'app1' });
  expect(invalidateSpy).toHaveBeenCalledWith(
    expect.objectContaining({ queryKey: expect.arrayContaining(['postingFilledCounts']) })
  );
});
```

> 실제 query key 는 `usePostingFilledCounts.ts` 의 key 를 확인해 정확히 매칭.

- [ ] **3.2 실패 확인** — invalidate 미구현 → FAIL.
- [ ] **3.3 구현**:
  - `DateRequirementUpdater.ts` + 테스트 파일 삭제. `index.ts` 의 export 제거.
  - 낙관적 갱신 호출부를 제거하고, confirm/cancel mutation 의 `onSuccess` 에서 `queryClient.invalidateQueries({ queryKey: [<postingFilledCounts key>] })` + 공고 상세 쿼리 invalidate 로 대체. (work_logs 가 변했으니 hydrate 재조회.)
  - 호출부가 순수 함수 합성(schedule 반환)이었다면, 해당 반환을 소비하던 곳이 hydrate 로 전환됐는지 Task 4 와 정합 확인.
- [ ] **3.4 통과 확인** — `npx jest` 관련 PASS + 삭제로 인한 import 에러 0(`npm run quality`).
- [ ] **3.5 커밋** — `git commit -m "refactor(application): DateRequirementUpdater 제거 — 낙관적 filled 갱신을 hydrate invalidate 로 대체"`

---

## Task 4: 표시 단일 소스 — fixed/grouped hydrate 정합

**Files:**

- Modify: `src/components/jobs/shared/postingSurfaceModel.ts` (`buildPostingScheduleModel` fixed/grouped 분기, `toRoleModels`)
- Modify: `src/repositories/supabase/JobPostingRepository.ts` (필요 시 서브맵 헬퍼)
- Test: `src/components/jobs/shared/__tests__/postingSurfaceModel.hydrate.test.ts`

- [ ] **4.0 현재 코드 확인** — `buildPostingScheduleModel` 의 fixed 분기(ctx 없이 `toRoleModels` 호출)·dated 분기·grouped(`matchDate: undefined`) 분기, `toRoleModels` 의 hydrate 키 조합(`${date}__${slotKey}__${roleKey}`), `extractPostingFilledSubmap`/`buildSlotRoleKey` 를 읽어 정확한 라인·키 형태 파악.

- [ ] **4.1 실패 테스트 작성** — fixed/grouped 가 hydrate 값을 노출하는지:

```ts
describe('postingSurfaceModel hydrate (SP3)', () => {
  it('fixed 공고가 FIXED_SCHEDULE/NEGOTIABLE 키로 hydrate filled 를 노출', () => {
    const filledCounts = new Map<string, number>([['FIXED_SCHEDULE__NEGOTIABLE__dealer', 1]]);
    const model = buildPostingScheduleModel(fixedSource, filledCounts);
    // fixed 역할 모델의 dealer filled === 1
    expect(/* fixed dealer role filled */).toBe(1);
  });

  it('grouped 날짜범위 공고가 범위 내 work_log 날짜들을 slot+role 별 합산', () => {
    // 섹션 범위 2026-06-01~2026-06-03, dealer 슬롯 19:00
    const filledCounts = new Map<string, number>([
      ['2026-06-01__19:00__dealer', 1],
      ['2026-06-02__19:00__dealer', 1],
      ['2026-06-05__19:00__dealer', 1], // 범위 밖 — 제외
    ]);
    const model = buildPostingScheduleModel(groupedSource, filledCounts);
    expect(/* grouped dealer filled */).toBe(2);
  });
});
```

> 정확한 `buildPostingScheduleModel` 시그니처(filledCounts 전달 방식)·반환 모델 형태는 4.0 에서 확인해 테스트를 맞춘다.

- [ ] **4.2 실패 확인** — fixed 는 ctx 미전달이라 0, grouped 는 스킵이라 0 → FAIL.
- [ ] **4.3 구현**:
  - **fixed 분기**: `toRoleModels(fixedRoles, undefined)` → `toRoleModels(fixedRoles, { date: 'FIXED_SCHEDULE', slotKey: <슬롯의 협의/미정/시각 키>, filledCounts })`. 슬롯 키는 slot.isTimeToBeAnnounced ? '미정' : (slot.startTime ?? 'NEGOTIABLE') 로 SP2 work_logs/`_posting_slot_key` 와 정합.
  - **grouped 분기**: `matchDate: undefined` 로 스킵하던 곳을, 섹션의 날짜 범위에 속하는 hydrate 엔트리들을 slot+role 별 합산하는 헬퍼로 대체. 헬퍼(예: `sumHydrateForRange(filledCounts, startDate, endDate, slotKey, roleKey)`)를 추가 — 키 prefix 파싱(`date__slot__role`) 후 `startDate <= date <= endDate` 필터 합산.
  - **toRoleModels**: Task2 에서 `role.filled` fallback 제거됨 → hydrate 값만. fixed/grouped 모두 동일 경로.
- [ ] **4.4 통과 확인** — `npx jest postingSurfaceModel` PASS (fixed/grouped/dated 전부).
- [ ] **4.5 커밋** — `git commit -m "feat(jobPosting): fixed/grouped 역할별 표시를 hydrate 단일 소스로 정합"`

---

## Task 5: 마이그레이션 — schedule `filled` strip (멱등)

**Files:**

- Create: `supabase/migrations/<ts>_strip_schedule_filled.sql`

> DB Task — 메인이 적용. 서브에이전트는 SQL 작성.

- [ ] **5.1 RED/검증 SQL (메인, execute_sql 롤백)** — 잔류 filled 가 있는 doc 을 시드 후 strip 적용해 사라지는지 + 멱등:

```sql
BEGIN;
-- 시드: roles 에 filled 박힌 schedule
UPDATE job_postings SET schedule = jsonb_set(schedule, '{requirements,0,timeSlots,0,roles,0,filled}', '5')
WHERE id = (SELECT id FROM job_postings LIMIT 1);
-- (strip 쿼리 실행)
-- 검증: 어떤 role 에도 filled 키 없음
SELECT count(*) FROM job_postings jp,
  jsonb_array_elements(COALESCE(jp.schedule->'requirements','[]'::jsonb)) req,
  jsonb_array_elements(COALESCE(req->'timeSlots','[]'::jsonb)) ts,
  jsonb_array_elements(COALESCE(ts->'roles','[]'::jsonb)) r
WHERE r ? 'filled';  -- Expected 0 after strip
ROLLBACK;
```

- [ ] **5.2 strip 마이그레이션 작성** — `requirements[].timeSlots[].roles[]` 각 role 에서 `filled` 키 제거. jsonb 재구성(중첩 배열이라 `jsonb_set` 단순 적용 불가 → 재구성 쿼리):

```sql
UPDATE job_postings jp SET schedule = jsonb_set(
  jp.schedule, '{requirements}',
  (SELECT jsonb_agg(
     jsonb_set(req, '{timeSlots}',
       (SELECT jsonb_agg(
          jsonb_set(ts, '{roles}',
            (SELECT jsonb_agg(r - 'filled') FROM jsonb_array_elements(COALESCE(ts->'roles','[]'::jsonb)) r))
        ) FROM jsonb_array_elements(COALESCE(req->'timeSlots','[]'::jsonb)) ts))
   ) FROM jsonb_array_elements(COALESCE(jp.schedule->'requirements','[]'::jsonb)) req)
)
WHERE jp.schedule ? 'requirements'
  AND EXISTS (
    SELECT 1 FROM jsonb_array_elements(jp.schedule->'requirements') req2,
      jsonb_array_elements(COALESCE(req2->'timeSlots','[]'::jsonb)) ts2,
      jsonb_array_elements(COALESCE(ts2->'roles','[]'::jsonb)) r2
    WHERE r2 ? 'filled'
  );  -- 멱등: filled 없으면 WHERE 가 0 row
```

- [ ] **5.3 GREEN/멱등 (메인)** — 5.1 검증 0 + 두 번 적용 동일(WHERE EXISTS 가 멱등 보장). prod 2건 적용.
- [ ] **5.4 적용 + 커밋** — `apply_migration` 후 `git add ... && git commit -m "fix(db): schedule roles[].filled dead counter strip (멱등)"`

---

## Task 6: `filled_positions` 트리거化 + 백필

**Files:**

- Create: `supabase/migrations/<ts>_filled_positions_trigger.sql`

> DB Task — 메인 적용. 현행 `fn_update_job_posting_stats` 본문을 `pg_get_functiondef` 로 재확인 후 diff.

- [ ] **6.1 현행 본문 재확인 (메인)** — `fn_update_job_posting_stats` 본문(이미 분석: stats 4종 delta + 단일 UPDATE).
- [ ] **6.2 RED 검증 (메인, execute_sql 롤백)** — 트리거 확장 **전**, status 전이별 filled_positions 가 자동 갱신 안 됨을 확인(현재는 RPC 수동만). 각 전이 후 `filled_positions == COUNT(filled-status apps)` 불일치 = RED.
- [ ] **6.3 트리거 함수 확장 작성** — 현행에 `v_filled_delta` 추가:

```sql
CREATE OR REPLACE FUNCTION public.fn_update_job_posting_stats()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_counted_statuses TEXT[] := ARRAY['applied','confirmed','cancellation_pending'];
  v_filled_statuses  TEXT[] := ARRAY['confirmed','cancellation_pending','completed'];  -- [신규] 슬롯 점유
  v_old_counted BOOLEAN; v_new_counted BOOLEAN;
  v_old_filled BOOLEAN; v_new_filled BOOLEAN;  -- [신규]
  v_total_delta INT := 0; v_active_delta INT := 0; v_confirmed_delta INT := 0; v_cp_delta INT := 0;
  v_filled_delta INT := 0;  -- [신규]
  v_job_posting_id UUID;
BEGIN
  v_job_posting_id := COALESCE(NEW.job_posting_id, OLD.job_posting_id);
  IF v_job_posting_id IS NULL THEN RETURN NULL; END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.status::text = ANY(v_counted_statuses) THEN
      v_total_delta := 1;
      IF NEW.status::text = 'applied' THEN v_active_delta := 1;
      ELSIF NEW.status::text = 'confirmed' THEN v_confirmed_delta := 1;
      ELSIF NEW.status::text = 'cancellation_pending' THEN v_cp_delta := 1; END IF;
    END IF;
    IF NEW.status::text = ANY(v_filled_statuses) THEN v_filled_delta := 1; END IF;  -- [신규]

  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.status::text = ANY(v_counted_statuses) THEN
      v_total_delta := -1;
      IF OLD.status::text = 'applied' THEN v_active_delta := -1;
      ELSIF OLD.status::text = 'confirmed' THEN v_confirmed_delta := -1;
      ELSIF OLD.status::text = 'cancellation_pending' THEN v_cp_delta := -1; END IF;
    END IF;
    IF OLD.status::text = ANY(v_filled_statuses) THEN v_filled_delta := -1; END IF;  -- [신규]

  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.status::text = NEW.status::text THEN RETURN NULL; END IF;
    v_old_counted := OLD.status::text = ANY(v_counted_statuses);
    v_new_counted := NEW.status::text = ANY(v_counted_statuses);
    IF v_old_counted AND NOT v_new_counted THEN v_total_delta := -1;
    ELSIF NOT v_old_counted AND v_new_counted THEN v_total_delta := 1; END IF;
    IF OLD.status::text = 'applied' AND NEW.status::text <> 'applied' THEN v_active_delta := -1;
    ELSIF NEW.status::text = 'applied' AND OLD.status::text <> 'applied' THEN v_active_delta := 1; END IF;
    IF OLD.status::text = 'confirmed' AND NEW.status::text <> 'confirmed' THEN v_confirmed_delta := -1;
    ELSIF NEW.status::text = 'confirmed' AND OLD.status::text <> 'confirmed' THEN v_confirmed_delta := 1; END IF;
    IF OLD.status::text = 'cancellation_pending' AND NEW.status::text <> 'cancellation_pending' THEN v_cp_delta := -1;
    ELSIF NEW.status::text = 'cancellation_pending' AND OLD.status::text <> 'cancellation_pending' THEN v_cp_delta := 1; END IF;
    -- [신규] filled delta
    v_old_filled := OLD.status::text = ANY(v_filled_statuses);
    v_new_filled := NEW.status::text = ANY(v_filled_statuses);
    IF v_old_filled AND NOT v_new_filled THEN v_filled_delta := -1;
    ELSIF NOT v_old_filled AND v_new_filled THEN v_filled_delta := 1; END IF;
  END IF;

  IF v_total_delta = 0 AND v_active_delta = 0 AND v_confirmed_delta = 0 AND v_cp_delta = 0
     AND v_filled_delta = 0 THEN  -- [신규] guard 에 포함
    RETURN NULL;
  END IF;

  UPDATE public.job_postings
  SET filled_positions = GREATEST(0, filled_positions + v_filled_delta),  -- [신규] 컬럼
      stats = jsonb_set(jsonb_set(jsonb_set(jsonb_set(jsonb_set(
        COALESCE(stats, '{}'::jsonb),
        '{totalApplicants}', to_jsonb(GREATEST(0, COALESCE((stats->>'totalApplicants')::int,0) + v_total_delta))),
        '{activeApplicants}', to_jsonb(GREATEST(0, COALESCE((stats->>'activeApplicants')::int,0) + v_active_delta))),
        '{confirmedApplicants}', to_jsonb(GREATEST(0, COALESCE((stats->>'confirmedApplicants')::int,0) + v_confirmed_delta))),
        '{cancellationPendingApplicants}', to_jsonb(GREATEST(0, COALESCE((stats->>'cancellationPendingApplicants')::int,0) + v_cp_delta))),
        '{filledPositions}', to_jsonb(GREATEST(0, COALESCE((stats->>'filledPositions')::int,0) + v_filled_delta)))  -- [신규] stats 동기
  WHERE id = v_job_posting_id;

  RETURN NULL;
END;
$function$;
```

- [ ] **6.4 백필 (메인, 같은 마이그레이션 내)** — 트리거 정의 후 기존 drift 청산:

```sql
UPDATE job_postings jp SET
  filled_positions = sub.cnt,
  stats = jsonb_set(COALESCE(stats,'{}'::jsonb), '{filledPositions}', to_jsonb(sub.cnt))
FROM (SELECT job_posting_id, COUNT(*)::int AS cnt FROM applications
      WHERE status IN ('confirmed','cancellation_pending','completed') GROUP BY job_posting_id) sub
WHERE jp.id = sub.job_posting_id;
-- filled-status app 0건인 공고는 0으로
UPDATE job_postings SET filled_positions = 0,
  stats = jsonb_set(COALESCE(stats,'{}'::jsonb), '{filledPositions}', '0')
WHERE id NOT IN (SELECT DISTINCT job_posting_id FROM applications
  WHERE status IN ('confirmed','cancellation_pending','completed'));
```

- [ ] **6.5 GREEN 검증 (메인, execute_sql 롤백, Red-Green)** — 각 전이 후 `filled_positions == COUNT(filled-status apps)`:
  - applied→confirmed: +1 / confirmed→applied: -1 / confirmed→cancellation_pending: **불변** / cancellation_pending→cancelled: -1 / confirmed→completed: **불변** / completed delete: -1 / applied delete: 불변.
  - 각 전이 직후 `SELECT filled_positions` == `(SELECT COUNT(*) FROM applications WHERE job_posting_id=... AND status IN filled)`.
- [ ] **6.6 적용 + 커밋** — `apply_migration` 후 `git commit -m "fix(db): filled_positions 를 applications status 트리거로 이관 + 백필"`

---

## Task 7: confirm/cancel RPC 수동 `filled_positions` 갱신 제거

**Files:**

- Create: `supabase/migrations/<ts>_rpc_drop_manual_filled.sql`

> Task 6 의 트리거가 자동 유지하므로, RPC 의 수동 ±1 을 제거(이중 갱신 방지). **현행 본문(SP2 Task1 적용본 포함) diff 필수.**

- [ ] **7.1 현행 본문 재확인 (메인)** — `confirm_application`(SP2 적용본), `cancel_application_atomically` 본문.
- [ ] **7.2 RED (메인)** — 트리거+수동 양쪽 살아있는 현재, confirm 1회 후 filled_positions 가 **+2**(트리거 +1, 수동 +1) 되는 이중증가 확인 = RED.
- [ ] **7.3 confirm 수정** — `UPDATE job_postings SET filled_positions = filled_positions + 1, stats = jsonb_set(...,'{filledPositions}',...+1), updated_at = v_now WHERE id = v_app.job_posting_id;` 블록 **제거**(트리거가 applications status='confirmed' UPDATE 로 처리). 나머지 본문 전부 보존.
- [ ] **7.4 cancel 수정** — 수동 filled 계산·갱신 제거하되 **reopen 로직 보존**:

```sql
-- 기존:
--   v_new_filled := GREATEST(0, v_job_posting.filled_positions - 1);
--   UPDATE job_postings SET filled_positions = v_new_filled,
--     stats = jsonb_set(...,'{filledPositions}', to_jsonb(v_new_filled)),
--     status = CASE WHEN status='closed' AND v_new_filled<total_positions THEN 'active' ELSE status END,
--     updated_at = v_now_ts WHERE id = v_job_posting.id;
-- 변경 (filled 는 트리거가 이미 status UPDATE 에서 감소시킴 → reopen 만 + 재조회):
UPDATE job_postings SET
  status = CASE WHEN status = 'closed' AND filled_positions < total_positions THEN 'active'::posting_status ELSE status END,
  updated_at = v_now_ts
WHERE id = v_job_posting.id;
SELECT filled_positions INTO v_new_filled FROM job_postings WHERE id = v_job_posting.id;
```

> `v_new_filled` 는 반환 JSON(`new_filled_positions`)에 쓰이므로 트리거 후 재조회 값으로 교체. 트리거는 `UPDATE applications SET status=v_new_status`(이 함수 앞부분)에서 이미 발화 → reopen UPDATE 시점엔 filled_positions 가 감소 반영됨(AFTER row trigger 는 직전 statement 종료 시 발화).

- [ ] **7.5 GREEN (메인, execute_sql 롤백)** — confirm 1회 후 filled_positions **+1**(이중증가 해소). cancel 후 -1 + reopen 동작 + 반환 `new_filled_positions` 정확. dated/fixed 양쪽.
- [ ] **7.6 적용 + 커밋** — `apply_migration` 후 `git commit -m "fix(db): confirm/cancel RPC 수동 filled_positions 갱신 제거 (트리거 단일화)"`

---

## Task 8: SP3 통합 게이트 + 회귀

- [ ] **8.1** `npm run quality` exit 0 (error 0).
- [ ] **8.2** `npm test` 전체 0 fail.
- [ ] **8.3 동적 정합 증거 (메인)** — 역할별 0/N 해소(fixed/grouped/dated hydrate) + filled_positions drift 0(전이별) + overfill 차단(SP2 회귀 없음) 결과를 PR 본문/커밋에 기록.
- [ ] **8.4 타입 재생성 점검** — RPC 시그니처 변화 없음(filled_positions 내부 로직만) → `generate_typescript_types` 불요(확인).

---

## Self-Review 결과 (작성자)

- **Spec 커버리지**: §3.1(dead counter+호환)→Task1/5, §3.2(표시 hydrate)→Task2/4, §3.3(트리거)→Task6/7, §3.4(DateRequirementUpdater)→Task3. ✅
- **Placeholder**: 트리거·RPC SQL 전체 기재. 클라 Task 는 4.0/2.0/3.0 에서 현재 코드 확인 후 구체 편집(필드 삭제는 기계적) + 테스트 코드 기재. 표시 모델 테스트의 `expect(/* ... */)` 는 4.0 확인 후 정확화하도록 명시. ⚠️ 일부 표시 단언은 모델 형태 확인 의존(의도적, 4.0 가드).
- **타입 일관성**: `filled` 제거(Task1) → 읽기 제거(Task2) → 표시 hydrate(Task4) 순서 정합. `JobRoleStats.filled` 처리(0 고정 vs optional)는 Task2 에서 소비자 점검 후 결정 — 표시(Task4)가 hydrate 로 덮으므로 0 고정 권장.
- **회귀 가드**: confirm/cancel 본문 보존(변경 블록만), reopen 로직 보존, 이중증가 RED-GREEN(Task7.2/7.5), filled_positions 의미(completed 유지) 보존. ✅
- **순서 의존**: Task6(트리거 추가) → Task7(수동 제거) 순서 필수(역순이면 카운터 0 구간 발생). Task5(strip) 는 Task1(읽기 호환) 후 안전.
