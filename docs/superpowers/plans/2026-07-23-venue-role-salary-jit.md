# 지점 역할별 급여 (JIT) 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 근무표 직접 배치의 조용한 ₩15,000 폴백 정산을 지점 역할별 단가표(JIT 입력)로 교정한다 — 배치 시 미설정 역할만 그 자리서 묻고(접점 1), 지점 정산 화면에서 폴백을 배지로 가시화·탭 구제하고(접점 2), 지점 설정 시트에서 일괄 관리한다(접점 3).

**Architecture:** 저장 = 컨테이너 `job_postings.schedule.roleSalaries`(JSONB 배열, `PostingRoleCatalogEntry[]`). 쓰기 = 신규 SECDEF RPC `set_venue_role_salary`(RESTRICTIVE `jp_container_no_direct_update`가 직접 UPDATE 차단 — `set_venue_soft_target` 관용구 복제). 정산 해소 = `settlementVenueQuery.ts`의 폴백 컨텍스트를 컨테이너 단가표로 교체 + 해소 출처(`override|roleTable|fallback`) 반환 헬퍼 신규.

**Tech Stack:** Expo 55 / RN 0.83 / TS strict / NativeWind 4.2 / TanStack Query / Supabase (pgTAP), Jest + @testing-library/react-native.

**Spec:** `docs/superpowers/specs/2026-07-23-venue-role-salary-jit-design.md`

## Global Constraints

- 모든 응답·커밋·주석 **한글**. 커밋 형식 `<type>(<scope>): <한글>`.
- 작업 디렉토리 `uniqn-mobile/`. 테스트 실행: `cd uniqn-mobile && npx jest <경로> --silent`.
- **실행 세션 시작 시 워크트리 격리 필수** — 메인 체크아웃에 다른 세션의 미커밋 변경 존재(superpowers:using-git-worktrees, node_modules는 `mklink /J` junction — 메모리 `feedback_worktree_node_modules_junction`).
- `console.log()` 금지 → `logger`. 알림은 `toast`/`addToast`. 다크모드 `dark:` 필수. 경로 `@/` 절대경로.
- DB 마이그레이션 적용은 **MCP `mcp__supabase__apply_migration` 전용**(`db push` 금지). 단, 구현 서브에이전트는 `mcp__supabase__*` 직접 호출 금지 — 마이그 적용은 메인 세션이 수행.
- SECDEF 3규칙(wiki `decisions/secdef-hardening`): anon EXECUTE REVOKE · `search_path 'public','extensions','pg_temp'` · NULL fail-open 차단(COALESCE).
- pgTAP JWT 주입은 singular(`request.jwt.claim.sub`)+plural(`request.jwt.claims`) 동시 설정 헬퍼 경유(인라인 plural 단독 금지 — wiki `sources/jpc-rls-stale-guc`).
- 급여 타입은 **시급/일급/월급만**('협의' 제외 — 자동 계산 목적상 amount:0은 폴백과 같은 오답).
- 금액 상한 `MAX_SALARY_AMOUNT = 100_000_000`(`@/constants/jobPosting`). 시급 기본 `DEFAULT_ROLE_HOURLY`(dealer 20,000/floor 30,000/그 외 20,000).
- 불변성: 배열/객체 spread, 원본 변형 금지.

---

### Task 1: 도메인 — roleSalaries 파서 + VenueContainer 확장

**Files:**
- Create: `uniqn-mobile/src/domains/weeklyGrid/roleSalaries.ts`
- Modify: `uniqn-mobile/src/domains/weeklyGrid/venueContainer.ts`
- Modify: `uniqn-mobile/src/domains/weeklyGrid/index.ts` (배럴 export 추가)
- Test: `uniqn-mobile/src/domains/weeklyGrid/__tests__/roleSalaries.test.ts`

**Interfaces:**
- Consumes: `PostingRoleCatalogEntry`, `SalaryInfo`(`@/types`) — `{role: StaffRole|'other', customRole?, salary?: {type, amount}}`.
- Produces: `getRoleSalaries(schedule: unknown): PostingRoleCatalogEntry[]` · `findRoleSalary(entries, role, customRole?): SalaryInfo | undefined` · `hasRoleSalary(entries, role, customRole?): boolean` · `VenueContainer.roleSalaries: PostingRoleCatalogEntry[]` 필드. Task 3~8이 전부 이 시그니처를 소비한다.

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
// uniqn-mobile/src/domains/weeklyGrid/__tests__/roleSalaries.test.ts
import { getRoleSalaries, findRoleSalary, hasRoleSalary } from '../roleSalaries';
import { parseVenueContainer } from '../venueContainer';

const dealer = { role: 'dealer', salary: { type: 'hourly', amount: 20000 } };
const chipRunner = { role: 'other', customRole: '칩 러너', salary: { type: 'daily', amount: 150000 } };

describe('getRoleSalaries', () => {
  it('정상 배열을 파싱한다', () => {
    expect(getRoleSalaries({ roleSalaries: [dealer, chipRunner] })).toEqual([dealer, chipRunner]);
  });
  it('없거나 배열이 아니면 빈 배열(증발 회피)', () => {
    expect(getRoleSalaries(undefined)).toEqual([]);
    expect(getRoleSalaries({})).toEqual([]);
    expect(getRoleSalaries({ roleSalaries: 'oops' })).toEqual([]);
    expect(getRoleSalaries(null)).toEqual([]);
  });
  it('이형 항목은 건너뛰고 정상 항목만 남긴다', () => {
    expect(getRoleSalaries({ roleSalaries: [dealer, { bogus: 1 }, 42] })).toEqual([dealer]);
  });
});

describe('findRoleSalary / hasRoleSalary', () => {
  const entries = getRoleSalaries({ roleSalaries: [dealer, chipRunner] });
  it('표준 역할 매칭', () => {
    expect(findRoleSalary(entries, 'dealer')).toEqual({ type: 'hourly', amount: 20000 });
    expect(hasRoleSalary(entries, 'dealer')).toBe(true);
  });
  it('커스텀 역할은 other:<customRole> 단위 매칭', () => {
    expect(findRoleSalary(entries, 'other', '칩 러너')).toEqual({ type: 'daily', amount: 150000 });
    expect(findRoleSalary(entries, 'other', '서빙 헬퍼')).toBeUndefined();
    expect(hasRoleSalary(entries, 'other', '서빙 헬퍼')).toBe(false);
  });
  it('미매칭이면 undefined/false', () => {
    expect(findRoleSalary(entries, 'serving')).toBeUndefined();
    expect(hasRoleSalary([], 'dealer')).toBe(false);
  });
});

describe('parseVenueContainer.roleSalaries', () => {
  const row = {
    id: 'v1', title: '강남점', workspace_id: 'w1', owner_id: 'u1', venue_id: 'v1',
    status: 'container', schedule: { kind: 'dated', softTargets: {}, roleSalaries: [dealer] },
  };
  it('schedule.roleSalaries 를 파싱해 싣는다', () => {
    expect(parseVenueContainer(row)?.roleSalaries).toEqual([dealer]);
  });
  it('roleSalaries 부재 시 빈 배열', () => {
    expect(parseVenueContainer({ ...row, schedule: { kind: 'dated' } })?.roleSalaries).toEqual([]);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `cd uniqn-mobile && npx jest src/domains/weeklyGrid/__tests__/roleSalaries.test.ts --silent`
Expected: FAIL — `Cannot find module '../roleSalaries'`

- [ ] **Step 3: 구현**

```ts
// uniqn-mobile/src/domains/weeklyGrid/roleSalaries.ts
/**
 * roleSalaries — 지점(컨테이너) 역할별 단가표 경량 파서 + 조회 (JIT 급여 설계 §A)
 *
 * 컨테이너 schedule.roleSalaries(JSONB 배열)를 PostingRoleCatalogEntry[] 로 관대하게 파싱한다.
 * 이형/부재는 빈 배열(strict null 증발 회피 — venueContainer 패턴). 쓰기는 SECDEF RPC
 * set_venue_role_salary 단일 경로(클라 직접 UPDATE 는 jp_container_no_direct_update 가 차단).
 * 키 규약: 표준 역할=role, 커스텀=other:<customRole> (getPostingRoleKey 와 동일).
 */
import { z } from 'zod';
import type { PostingRoleCatalogEntry, SalaryInfo } from '@/types';

const salarySchema = z.object({
  type: z.enum(['hourly', 'daily', 'monthly', 'other']),
  amount: z.number(),
});

const entrySchema = z.object({
  role: z.string().min(1),
  customRole: z.string().optional(),
  salary: salarySchema.optional(),
});

/** schedule(unknown)에서 roleSalaries 배열을 관대 파싱. 이형 항목은 개별 스킵. */
export function getRoleSalaries(schedule: unknown): PostingRoleCatalogEntry[] {
  if (!schedule || typeof schedule !== 'object') return [];
  const raw = (schedule as { roleSalaries?: unknown }).roleSalaries;
  if (!Array.isArray(raw)) return [];
  const out: PostingRoleCatalogEntry[] = [];
  for (const item of raw) {
    const parsed = entrySchema.safeParse(item);
    if (parsed.success) out.push(parsed.data as PostingRoleCatalogEntry);
  }
  return out;
}

const entryKey = (role: string, customRole?: string): string =>
  role === 'other' && customRole ? `other:${customRole}` : role;

/** 역할(커스텀은 other:<customRole> 단위)에 설정된 단가. 미설정이면 undefined. */
export function findRoleSalary(
  entries: PostingRoleCatalogEntry[],
  role: string,
  customRole?: string
): SalaryInfo | undefined {
  const key = entryKey(role, customRole);
  return entries.find((e) => entryKey(e.role, e.customRole) === key)?.salary;
}

/** JIT 노출 조건 판정 — 해당 역할 단가 설정 여부. */
export function hasRoleSalary(
  entries: PostingRoleCatalogEntry[],
  role: string,
  customRole?: string
): boolean {
  return findRoleSalary(entries, role, customRole) !== undefined;
}
```

`venueContainer.ts` 수정 — import 추가·인터페이스 필드·파서 한 줄:

```ts
// 파일 상단 import 에 추가
import { getRoleSalaries } from './roleSalaries';
import type { PostingRoleCatalogEntry } from '@/types';

// VenueContainer 인터페이스에 필드 추가 (softTargets 아래)
  /** 역할별 단가표 (schedule.roleSalaries) — JIT 급여 설계 §A */
  roleSalaries: PostingRoleCatalogEntry[];

// parseVenueContainer 반환 객체에 추가 (softTargets 아래)
    roleSalaries: getRoleSalaries(r.schedule),
```

`domains/weeklyGrid/index.ts` 배럴에 추가:

```ts
export { getRoleSalaries, findRoleSalary, hasRoleSalary } from './roleSalaries';
```

- [ ] **Step 4: 통과 확인 + 기존 파서 회귀**

Run: `cd uniqn-mobile && npx jest src/domains/weeklyGrid --silent`
Expected: PASS (roleSalaries 신규 + venueContainer/softTargets 기존 스위트 전부)

- [ ] **Step 5: 커밋**

```bash
git add uniqn-mobile/src/domains/weeklyGrid
git commit -m "feat(salary): 지점 단가표 도메인 파서 — schedule.roleSalaries 경량 읽기"
```

---

### Task 2: DB — SECDEF RPC `set_venue_role_salary` 마이그 + pgTAP 회귀

**Files:**
- Create: `uniqn-mobile/supabase/migrations/20260723100000_venue_role_salary_rpc.sql`
- Create: `uniqn-mobile/supabase/tests/venue_role_salary.test.sql`

**Interfaces:**
- Consumes: 기존 `is_workspace_member` / `is_posting_collaborator` / `is_admin` / `get_or_create_venue_container`.
- Produces: RPC `set_venue_role_salary(p_venue uuid, p_role text, p_custom_role text DEFAULT NULL, p_salary_type text DEFAULT NULL, p_amount integer DEFAULT NULL) RETURNS jsonb` — `p_salary_type IS NULL`이면 해당 역할 엔트리 **삭제**, 아니면 upsert. 반환 `{venueId, roleSalaries}`. Task 3의 레포가 이 시그니처로 호출.

- [ ] **Step 1: 마이그레이션 SQL 작성**

```sql
-- uniqn-mobile/supabase/migrations/20260723100000_venue_role_salary_rpc.sql
-- 지점(컨테이너) 역할별 단가표 쓰기 RPC (JIT 급여 설계 §A, 2026-07-23)
--
-- 컨테이너 행은 jp_container_no_direct_update(RESTRICTIVE)가 직접 UPDATE 를 차단하므로
-- softTargets(set_venue_soft_target)와 동일하게 SECDEF RPC 단일 경로로만 쓴다.
-- 인가 게이트: COALESCE(owner=caller,false) OR 워크스페이스 멤버 OR 콜라보 OR admin (fail-closed).
-- upsert 단위: 표준 역할=role, 커스텀=other+customRole. p_salary_type NULL = 해당 엔트리 삭제.
-- '협의(other)' 타입 불허 — 단가표 목적이 자동 정산 계산이므로 amount:0 은 폴백과 같은 오답.

CREATE OR REPLACE FUNCTION public.set_venue_role_salary(
  p_venue uuid,
  p_role text,
  p_custom_role text DEFAULT NULL,
  p_salary_type text DEFAULT NULL,
  p_amount integer DEFAULT NULL
) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'extensions', 'pg_temp'
    AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_ws uuid;
  v_owner_id uuid;
  v_schedule jsonb;
  v_entries jsonb;
  v_entry jsonb;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 인증이 필요합니다';
  END IF;

  IF p_role IS NULL OR length(trim(p_role)) = 0 THEN
    RAISE EXCEPTION 'INVALID_INPUT: 역할이 필요합니다';
  END IF;
  IF p_role = 'other' AND (p_custom_role IS NULL OR length(trim(p_custom_role)) = 0) THEN
    RAISE EXCEPTION 'INVALID_INPUT: 커스텀 역할명이 필요합니다';
  END IF;
  IF p_custom_role IS NOT NULL AND length(p_custom_role) > 50 THEN
    RAISE EXCEPTION 'INVALID_INPUT: 역할명은 50자 이하여야 합니다';
  END IF;

  IF p_salary_type IS NOT NULL THEN
    IF p_salary_type NOT IN ('hourly', 'daily', 'monthly') THEN
      RAISE EXCEPTION 'INVALID_INPUT: 급여 유형이 올바르지 않습니다 (%)', p_salary_type;
    END IF;
    IF p_amount IS NULL OR p_amount < 0 OR p_amount > 100000000 THEN
      RAISE EXCEPTION 'INVALID_INPUT: 금액은 0~100,000,000 사이여야 합니다';
    END IF;
  END IF;

  SELECT workspace_id, owner_id, schedule
    INTO v_ws, v_owner_id, v_schedule
  FROM public.job_postings
  WHERE id = p_venue AND status = 'container'::posting_status
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'VENUE_NOT_FOUND: %', p_venue;
  END IF;

  IF NOT (
    COALESCE(v_owner_id = v_caller, false)
    OR public.is_workspace_member(v_ws, v_caller)
    OR public.is_posting_collaborator(p_venue, v_caller)
    OR public.is_admin()
  ) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 운영처 관리 권한이 없습니다';
  END IF;

  -- 같은 역할(커스텀은 customRole 단위) 기존 엔트리 제거 후, 삭제 요청이 아니면 새 엔트리 추가.
  SELECT COALESCE(jsonb_agg(e), '[]'::jsonb) INTO v_entries
  FROM jsonb_array_elements(COALESCE(v_schedule -> 'roleSalaries', '[]'::jsonb)) AS e
  WHERE NOT (
    e ->> 'role' = p_role
    AND (p_role <> 'other' OR COALESCE(e ->> 'customRole', '') = COALESCE(p_custom_role, ''))
  );

  IF p_salary_type IS NOT NULL THEN
    v_entry := jsonb_build_object(
      'role', p_role,
      'salary', jsonb_build_object('type', p_salary_type, 'amount', p_amount)
    );
    IF p_role = 'other' THEN
      v_entry := v_entry || jsonb_build_object('customRole', p_custom_role);
    END IF;
    v_entries := v_entries || jsonb_build_array(v_entry);
  END IF;

  UPDATE public.job_postings
  SET schedule = jsonb_set(COALESCE(v_schedule, '{}'::jsonb), '{roleSalaries}', v_entries, true),
      updated_at = now()
  WHERE id = p_venue;

  RETURN jsonb_build_object('venueId', p_venue, 'roleSalaries', v_entries);
END;
$$;

-- SECDEF 하드닝: anon/public 실행 차단, authenticated 만 허용.
REVOKE EXECUTE ON FUNCTION public.set_venue_role_salary(uuid, text, text, text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_venue_role_salary(uuid, text, text, text, integer) TO authenticated;
```

- [ ] **Step 2: pgTAP 회귀 테스트 작성**

```sql
-- uniqn-mobile/supabase/tests/venue_role_salary.test.sql
-- set_venue_role_salary 회귀 (2026-07-23) — 마이그 20260723100000
-- 검증: (1) owner upsert (2) 커스텀 역할 upsert — customRole 단위 구분
--       (3) 같은 역할 재설정 = 교체(중복 없음) (4) 삭제(p_salary_type NULL)
--       (5) 무관 사용자 PERMISSION_DENIED (6) orphan(owner NULL)+무관 → fail-closed
--       (7) '협의(other)' 타입 거부 (8) softTargets 보존
-- 안전: BEGIN/ROLLBACK + 마커 이메일(__sql_fixture_vrs_*@test.local)

BEGIN;
SELECT plan(8);

CREATE TEMP TABLE _t (k text PRIMARY KEY, v text);

-- JWT 주입 헬퍼 — singular+plural 동시 설정(wiki jpc-rls-stale-guc: plural 단독 주입 금지)
CREATE OR REPLACE FUNCTION t_set_user(p_user_id uuid)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claim.sub', p_user_id::text, true);
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', p_user_id, 'role', 'authenticated')::text, true);
END;
$$;

DO $$
DECLARE
  v_owner uuid := gen_random_uuid();
  v_outsider uuid := gen_random_uuid();
  v_ws uuid := gen_random_uuid();
  v_container uuid;
  v_res jsonb;
  v_deny boolean := false;
  v_deny_orphan boolean := false;
  v_reject_other boolean := false;
BEGIN
  INSERT INTO auth.users (id, email, aud, role, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  VALUES
    (v_owner,    '__sql_fixture_vrs_owner@test.local',    'authenticated', 'authenticated', '', '{"role":"employer"}'::jsonb, '{"name":"VRS_OWNER"}'::jsonb, now(), now()),
    (v_outsider, '__sql_fixture_vrs_outsider@test.local', 'authenticated', 'authenticated', '', '{"role":"staff"}'::jsonb,    '{"name":"VRS_OUT"}'::jsonb,   now(), now());
  INSERT INTO public.users (id, email, name, role, is_active, created_at, updated_at)
  VALUES
    (v_owner,    '__sql_fixture_vrs_owner@test.local',    'VRS_OWNER', 'employer'::user_role, true, now(), now()),
    (v_outsider, '__sql_fixture_vrs_outsider@test.local', 'VRS_OUT',   'staff'::user_role,    true, now(), now())
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role;
  INSERT INTO public.workspaces (id, name, owner_id, created_at, updated_at)
  VALUES (v_ws, '__sql_fixture_vrs_ws', v_owner, now(), now());

  PERFORM t_set_user(v_owner);
  v_container := (public.get_or_create_venue_container(v_ws, '운영처VRS', 'dated') ->> 'containerId')::uuid;
  -- softTargets 보존 검증용 선행 데이터
  PERFORM public.set_venue_soft_target(v_container, '2026-08-01', 3);

  -- (1) owner upsert
  v_res := public.set_venue_role_salary(v_container, 'dealer', NULL, 'hourly', 20000);
  INSERT INTO _t VALUES ('t1_dealer', (v_res -> 'roleSalaries' -> 0 -> 'salary' ->> 'amount'));

  -- (2) 커스텀 역할 upsert
  v_res := public.set_venue_role_salary(v_container, 'other', '칩 러너', 'daily', 150000);
  INSERT INTO _t VALUES ('t2_count', jsonb_array_length(v_res -> 'roleSalaries')::text);

  -- (3) 같은 역할 재설정 = 교체
  v_res := public.set_venue_role_salary(v_container, 'dealer', NULL, 'hourly', 22000);
  INSERT INTO _t VALUES ('t3_count', jsonb_array_length(v_res -> 'roleSalaries')::text);

  -- (4) 삭제
  v_res := public.set_venue_role_salary(v_container, 'other', '칩 러너', NULL, NULL);
  INSERT INTO _t VALUES ('t4_count', jsonb_array_length(v_res -> 'roleSalaries')::text);

  -- (7) '협의' 거부
  BEGIN
    PERFORM public.set_venue_role_salary(v_container, 'dealer', NULL, 'other', 0);
  EXCEPTION WHEN others THEN
    IF SQLERRM LIKE 'INVALID_INPUT%' THEN v_reject_other := true; END IF;
  END;
  INSERT INTO _t VALUES ('t7_reject_other', v_reject_other::text);

  -- (8) softTargets 보존
  INSERT INTO _t
  SELECT 't8_soft', schedule -> 'softTargets' ->> '2026-08-01'
  FROM public.job_postings WHERE id = v_container;

  -- (5) 무관 사용자 차단
  PERFORM t_set_user(v_outsider);
  BEGIN
    PERFORM public.set_venue_role_salary(v_container, 'dealer', NULL, 'hourly', 9999);
  EXCEPTION WHEN others THEN
    IF SQLERRM LIKE 'PERMISSION_DENIED%' THEN v_deny := true; END IF;
  END;
  INSERT INTO _t VALUES ('t5_deny', v_deny::text);

  -- (6) orphan(owner NULL) fail-closed
  UPDATE public.job_postings SET owner_id = NULL WHERE id = v_container;
  BEGIN
    PERFORM public.set_venue_role_salary(v_container, 'dealer', NULL, 'hourly', 9999);
  EXCEPTION WHEN others THEN
    IF SQLERRM LIKE 'PERMISSION_DENIED%' THEN v_deny_orphan := true; END IF;
  END;
  INSERT INTO _t VALUES ('t6_deny_orphan', v_deny_orphan::text);
END;
$$;

SELECT is((SELECT v FROM _t WHERE k = 't1_dealer'), '20000', 'owner 가 dealer 시급을 설정한다');
SELECT is((SELECT v FROM _t WHERE k = 't2_count'), '2', '커스텀 역할이 별도 엔트리로 추가된다');
SELECT is((SELECT v FROM _t WHERE k = 't3_count'), '2', '같은 역할 재설정은 교체(중복 없음)');
SELECT is((SELECT v FROM _t WHERE k = 't4_count'), '1', 'p_salary_type NULL 은 해당 엔트리 삭제');
SELECT is((SELECT v FROM _t WHERE k = 't5_deny'), 'true', '무관 사용자는 PERMISSION_DENIED');
SELECT is((SELECT v FROM _t WHERE k = 't6_deny_orphan'), 'true', 'orphan 컨테이너도 fail-closed');
SELECT is((SELECT v FROM _t WHERE k = 't7_reject_other'), 'true', '협의(other) 타입은 거부');
SELECT is((SELECT v FROM _t WHERE k = 't8_soft'), '3', 'softTargets 는 보존된다');

SELECT * FROM finish();
ROLLBACK;
```

- [ ] **Step 3: 로컬 DB 적용 + pgTAP 실행 (RED→GREEN)**

먼저 마이그 없이 테스트 실행 → 함수 부재로 실패(RED) 확인 후, 로컬 스택에 마이그 적용 → 재실행.

```bash
cd uniqn-mobile
npm run db:start          # 로컬 Docker 스택 (이미 떠 있으면 생략)
npx supabase test db --file supabase/tests/venue_role_salary.test.sql   # RED: function does not exist
npm run db:reset          # 마이그 일괄 재적용 (공유 Docker 스택 병렬세션 주의 — 실행 전 재확인)
npx supabase test db --file supabase/tests/venue_role_salary.test.sql   # GREEN: 8/8
```

Expected: 최종 8/8 pass. (⚠️ 정확한 test 커맨드는 `package.json`의 `db:test` 스크립트가 있으면 그것을 우선 사용.)

- [ ] **Step 4: 커밋**

```bash
git add uniqn-mobile/supabase/migrations/20260723100000_venue_role_salary_rpc.sql uniqn-mobile/supabase/tests/venue_role_salary.test.sql
git commit -m "feat(salary): set_venue_role_salary SECDEF RPC + pgTAP 회귀 8종"
```

**주의**: prod 적용은 전체 구현·리뷰 완료 후 메인 세션이 MCP `apply_migration`으로 수행(이 태스크에서는 로컬만). 구현 서브에이전트는 `mcp__supabase__*` 호출 금지.

---

### Task 3: 쓰기 경로 — Repository → Service → Hook

**Files:**
- Modify: `uniqn-mobile/src/repositories/supabase/WeeklyGridRepository.ts` (setVenueSoftTarget 아래 메서드 추가)
- Modify: `uniqn-mobile/src/repositories/interfaces/IWeeklyGridRepository.ts`
- Modify: `uniqn-mobile/src/services/weeklyGrid/gridWriteService.ts`
- Create: `uniqn-mobile/src/hooks/weeklyGrid/useSetVenueRoleSalary.ts`
- Modify: `uniqn-mobile/src/hooks/weeklyGrid/index.ts`
- Modify: `uniqn-mobile/src/lib/queryClient.ts:580` (weeklyGrid 키에 `container` 추가)
- Test: `uniqn-mobile/src/repositories/supabase/__tests__/WeeklyGridRepository.roleSalary.test.ts`

**Interfaces:**
- Consumes: RPC `set_venue_role_salary`(Task 2 시그니처).
- Produces:
  - `weeklyGridRepository.setVenueRoleSalary(venueId: string, input: SetVenueRoleSalaryInput): Promise<void>`
  - `export interface SetVenueRoleSalaryInput { role: string; customRole?: string; salary: { type: 'hourly'|'daily'|'monthly'; amount: number } | null }` (salary:null=삭제)
  - `gridWriteService.setVenueRoleSalary(venueId, input)` (얇은 위임)
  - `useSetVenueRoleSalary()` — TanStack mutation, onSuccess 시 `queryKeys.weeklyGrid.all` + `queryKeys.settlement.all` invalidate
  - `queryKeys.weeklyGrid.container(venueId)` 신규 키. Task 6~8이 소비.

- [ ] **Step 1: 실패하는 레포 테스트 작성** — 기존 `WeeklyGridRepository.test.ts:127`의 `mockRpc` 패턴을 그대로 복제해 새 파일 작성:

```ts
// uniqn-mobile/src/repositories/supabase/__tests__/WeeklyGridRepository.roleSalary.test.ts
// mock 셋업(supabase.rpc mock)은 형제 파일 WeeklyGridRepository.test.ts 상단 블록을 그대로 복제한다.
import { weeklyGridRepository } from '@/repositories/weeklyGrid';

// ... (형제 파일과 동일한 jest.mock('@/lib/supabase') 셋업, mockRpc 획득) ...

describe('setVenueRoleSalary', () => {
  it('upsert — RPC 파라미터 매핑', async () => {
    mockRpc.mockResolvedValueOnce({ data: {}, error: null });
    await weeklyGridRepository.setVenueRoleSalary('v1', {
      role: 'other', customRole: '칩 러너', salary: { type: 'hourly', amount: 20000 },
    });
    expect(mockRpc).toHaveBeenCalledWith('set_venue_role_salary', {
      p_venue: 'v1', p_role: 'other', p_custom_role: '칩 러너',
      p_salary_type: 'hourly', p_amount: 20000,
    });
  });
  it('삭제 — salary:null 이면 p_salary_type/p_amount 미전달(NULL)', async () => {
    mockRpc.mockResolvedValueOnce({ data: {}, error: null });
    await weeklyGridRepository.setVenueRoleSalary('v1', { role: 'dealer', salary: null });
    expect(mockRpc).toHaveBeenCalledWith('set_venue_role_salary', {
      p_venue: 'v1', p_role: 'dealer', p_custom_role: null,
      p_salary_type: null, p_amount: null,
    });
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `cd uniqn-mobile && npx jest src/repositories/supabase/__tests__/WeeklyGridRepository.roleSalary.test.ts --silent`
Expected: FAIL — `setVenueRoleSalary is not a function`

- [ ] **Step 3: 구현**

`IWeeklyGridRepository.ts` — setVenueSoftTarget 선언 아래 추가:

```ts
  /**
   * 지점 역할별 단가 upsert/삭제. 컨테이너 schedule.roleSalaries — RESTRICTIVE 정책 우회
   * 유일 경로인 SECDEF RPC(set_venue_role_salary) 전용. salary:null = 해당 역할 삭제.
   */
  setVenueRoleSalary(venueId: string, input: SetVenueRoleSalaryInput): Promise<void>;
```

같은 파일(또는 인접 위치)에 타입 export:

```ts
export interface SetVenueRoleSalaryInput {
  role: string;
  customRole?: string;
  salary: { type: 'hourly' | 'daily' | 'monthly'; amount: number } | null;
}
```

`WeeklyGridRepository.ts` — setVenueSoftTarget 아래 추가(동일 에러 관용구):

```ts
  async setVenueRoleSalary(venueId: string, input: SetVenueRoleSalaryInput): Promise<void> {
    try {
      logger.info('지점 역할 단가 설정', { venueId, role: input.role, remove: input.salary === null });
      const { error } = await supabase.rpc('set_venue_role_salary', {
        p_venue: venueId,
        p_role: input.role,
        p_custom_role: input.customRole ?? null,
        p_salary_type: input.salary?.type ?? null,
        p_amount: input.salary?.amount ?? null,
      });
      if (error) handleSupabaseError(error, { operation: '지점 역할 단가 설정', table: TABLE });
    } catch (error) {
      if (isAppError(error)) throw error;
      handleSupabaseError(error, { operation: '지점 역할 단가 설정', table: TABLE });
    }
  }
```

`gridWriteService.ts` — setVenueSoftTarget 아래 추가:

```ts
/** 지점 역할별 단가 upsert/삭제(salary:null=삭제). 권한·검증은 RPC(레포 경계)가 담당. */
export function setVenueRoleSalary(
  venueId: string,
  input: SetVenueRoleSalaryInput
): Promise<void> {
  return weeklyGridRepository.setVenueRoleSalary(venueId, input);
}
```
(import에 `type SetVenueRoleSalaryInput` 추가)

`queryClient.ts` weeklyGrid 키 그룹(573~581행)에 추가:

```ts
    container: (venueId: string) => [...queryKeys.weeklyGrid.all, 'container', venueId] as const,
```

`useSetVenueRoleSalary.ts` 신규 — `useSetVenueSoftTarget.ts` 관용구 복제:

```ts
// uniqn-mobile/src/hooks/weeklyGrid/useSetVenueRoleSalary.ts
/**
 * useSetVenueRoleSalary — 지점 역할별 단가 쓰기 변이 훅.
 * onSuccess: weeklyGrid(컨테이너 roleSalaries 재조회) + settlement(폴백→단가 재계산) 무효화.
 * 토스트/실패 UX 는 호출부 책임(JIT 는 실패해도 배치 진행 — 설계 §B).
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryClient';
import { setVenueRoleSalary } from '@/services/weeklyGrid/gridWriteService';
import type { SetVenueRoleSalaryInput } from '@/repositories';

export interface SetVenueRoleSalaryVars extends SetVenueRoleSalaryInput {
  venueId: string;
}

export function useSetVenueRoleSalary() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ venueId, ...input }: SetVenueRoleSalaryVars) =>
      setVenueRoleSalary(venueId, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.weeklyGrid.all });
      qc.invalidateQueries({ queryKey: queryKeys.settlement.all });
    },
  });
}
```
(배럴 `hooks/weeklyGrid/index.ts`에 export 추가. `SetVenueRoleSalaryInput`이 `@/repositories` 배럴에서 export되는지 확인, 없으면 배럴에 추가.)

- [ ] **Step 4: 통과 확인**

Run: `cd uniqn-mobile && npx jest src/repositories/supabase/__tests__ src/hooks --silent && npx tsc --noEmit`
Expected: PASS + 타입 에러 0

- [ ] **Step 5: 커밋**

```bash
git add uniqn-mobile/src/repositories uniqn-mobile/src/services/weeklyGrid uniqn-mobile/src/hooks/weeklyGrid uniqn-mobile/src/lib/queryClient.ts
git commit -m "feat(salary): 지점 단가 쓰기 경로 — repo/service/mutation 훅 + container 쿼리키"
```

---

### Task 4: 정산 해소 — 출처 반환 헬퍼 + settlementVenueQuery 교체

**Files:**
- Modify: `uniqn-mobile/src/domains/settlement/helpers.ts` (getEffectiveSalaryInfoFromRoles 아래)
- Modify: `uniqn-mobile/src/domains/settlement/index.ts` (배럴 export)
- Modify: `uniqn-mobile/src/services/work/settlement/types.ts:35` (SettlementWorkLog 확장)
- Modify: `uniqn-mobile/src/services/work/settlement/settlementVenueQuery.ts`
- Test: `uniqn-mobile/src/domains/settlement/__tests__/resolveEffectiveSalary.test.ts`
- Test: 기존 `settlementVenueQuery` 테스트 파일에 케이스 추가 (경로는 `npx jest --listTests | grep -i venue`로 확인)

**Interfaces:**
- Consumes: Task 1 `VenueContainer.roleSalaries` · `jobPostingRepository.getVenueContainerById(id)`(기존).
- Produces:
  - `export type SalaryResolutionSource = 'override' | 'roleTable' | 'fallback'`
  - `resolveEffectiveSalaryWithSource(workLog: WorkLogWithOverrides, roles, defaultSalary?): { salaryInfo: SalaryInfo; source: SalaryResolutionSource }`
  - `SettlementWorkLog.salaryInfo?: SalaryInfo` · `SettlementWorkLog.salarySource?: SalaryResolutionSource` — Task 8 배지가 소비.

- [ ] **Step 1: 실패하는 헬퍼 테스트 작성**

```ts
// uniqn-mobile/src/domains/settlement/__tests__/resolveEffectiveSalary.test.ts
import { resolveEffectiveSalaryWithSource, getEffectiveSalaryInfoFromRoles } from '../helpers';

const roles = [
  { role: 'dealer', salary: { type: 'hourly' as const, amount: 20000 } },
  { role: 'other', customRole: '칩 러너', salary: { type: 'daily' as const, amount: 150000 } },
];
const override = { type: 'hourly' as const, amount: 30000 };

describe('resolveEffectiveSalaryWithSource', () => {
  it('1순위 — customSalaryInfo override', () => {
    const r = resolveEffectiveSalaryWithSource({ role: 'dealer', customSalaryInfo: override }, roles);
    expect(r).toEqual({ salaryInfo: override, source: 'override' });
  });
  it('2순위 — 역할 단가표(커스텀은 customRole 단위)', () => {
    expect(resolveEffectiveSalaryWithSource({ role: 'dealer' }, roles).source).toBe('roleTable');
    expect(
      resolveEffectiveSalaryWithSource({ role: 'other', customRole: '칩 러너' }, roles)
    ).toEqual({ salaryInfo: { type: 'daily', amount: 150000 }, source: 'roleTable' });
  });
  it('3순위 — 미매칭/빈 표는 fallback', () => {
    expect(resolveEffectiveSalaryWithSource({ role: 'serving' }, roles).source).toBe('fallback');
    expect(resolveEffectiveSalaryWithSource({ role: 'dealer' }, []).source).toBe('fallback');
    expect(resolveEffectiveSalaryWithSource({}, roles).source).toBe('fallback');
  });
  it('기존 getEffectiveSalaryInfoFromRoles 와 salaryInfo 등가(전 케이스)', () => {
    const cases = [
      { role: 'dealer' }, { role: 'other', customRole: '칩 러너' },
      { role: 'serving' }, { role: 'dealer', customSalaryInfo: override }, {},
    ];
    for (const wl of cases) {
      expect(resolveEffectiveSalaryWithSource(wl as never, roles).salaryInfo).toEqual(
        getEffectiveSalaryInfoFromRoles(wl as never, roles)
      );
    }
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `cd uniqn-mobile && npx jest src/domains/settlement/__tests__/resolveEffectiveSalary.test.ts --silent`
Expected: FAIL — `resolveEffectiveSalaryWithSource` export 부재

- [ ] **Step 3: 헬퍼 구현** — `helpers.ts`의 `getEffectiveSalaryInfoFromRoles`(249행) 바로 아래:

```ts
export type SalaryResolutionSource = 'override' | 'roleTable' | 'fallback';

export interface ResolvedSalary {
  salaryInfo: SalaryInfo;
  source: SalaryResolutionSource;
}

/**
 * getEffectiveSalaryInfoFromRoles 의 형제 — 같은 서열(override > 단가표 > 폴백)로 해소하되
 * 출처를 함께 반환한다. 기존 헬퍼는 미매칭을 조용히 폴백하므로 "기본 단가 적용" 배지
 * (조용한 오답 금지 — 정책 결정 2026-07-22)는 이 함수로만 만들 수 있다.
 * salaryInfo 는 getEffectiveSalaryInfoFromRoles 와 항상 등가(회귀 테스트로 고정).
 */
export function resolveEffectiveSalaryWithSource(
  workLog: WorkLogWithOverrides,
  roles: { role?: string; name?: string; customRole?: string; salary?: SalaryInfo }[] | undefined,
  defaultSalary?: SalaryInfo
): ResolvedSalary {
  if (workLog.customSalaryInfo) {
    return { salaryInfo: workLog.customSalaryInfo, source: 'override' };
  }
  const fallback = defaultSalary ?? DEFAULT_SALARY_INFO;
  if (!workLog.role || !roles?.length) {
    return { salaryInfo: fallback, source: 'fallback' };
  }
  const effectiveRole =
    workLog.role === 'other' && workLog.customRole ? workLog.customRole : workLog.role;
  const roleData = roles.find((role) => {
    const roleKey = role.role || role.name;
    if (roleKey === 'other' && role.customRole) {
      return role.customRole === effectiveRole;
    }
    return roleKey === effectiveRole;
  });
  return roleData?.salary
    ? { salaryInfo: roleData.salary, source: 'roleTable' }
    : { salaryInfo: fallback, source: 'fallback' };
}
```
(배럴 `domains/settlement/index.ts`에서 helpers 재수출 형태 확인 후 `resolveEffectiveSalaryWithSource`, `SalaryResolutionSource` export 추가. `DEFAULT_SALARY_INFO`·`WorkLogWithOverrides`는 파일 내 기존 import 재사용.)

- [ ] **Step 4: SettlementWorkLog 확장** — `services/work/settlement/types.ts:35`:

```ts
export interface SettlementWorkLog extends WorkLog {
  staffName?: string;
  jobPostingTitle?: string;
  calculatedAmount?: number;
  hoursWorked?: number;
  /** 계산에 실제 사용된 급여(카드 재계산용) + 해소 출처(폴백 배지용) — venue 경로가 채운다 */
  salaryInfo?: UtilitySalaryInfo;
  salarySource?: SalaryResolutionSource;
}
```
(`SalaryResolutionSource`는 `@/domains/settlement`에서 import.)

- [ ] **Step 5: settlementVenueQuery 교체** — `settlementVenueQuery.ts` 수정:

```ts
// import 추가
import { resolveEffectiveSalaryWithSource } from '@/domains/settlement';

// toSettlementWorkLog(40행) — getEffectiveSalaryInfoFromRoles 호출을 교체하고 결과에 출처 부가:
function toSettlementWorkLog(
  workLog: WorkLog,
  context: PostingSettlementContext,
  jobPostingTitle?: string
): SettlementWorkLog {
  const wlWithOverrides = workLog as WorkLogWithOverrides;
  const { salaryInfo, source } = resolveEffectiveSalaryWithSource(
    wlWithOverrides,
    context.roles,
    context.defaultSalary
  );
  const allowances = getEffectiveAllowances(wlWithOverrides, context.allowances);
  const taxSettings = getEffectiveTaxSettings(wlWithOverrides, context.taxSettings);

  const result = SettlementCalculator.calculate({
    startTime: workLog.checkInTime,
    endTime: workLog.checkOutTime,
    salaryInfo,
    allowances,
    taxSettings,
  });

  return {
    ...workLog,
    jobPostingTitle,
    hoursWorked: result.hoursWorked,
    calculatedAmount: result.afterTaxPay,
    salaryInfo,
    salarySource: source,
  };
}

// getVenueSettlementWorkLogs 본문 — 컨테이너 단가표 컨텍스트 삽입(101행 postingIds 계산 위에):
    // 컨테이너 직속 배치(jobPostingId=venueId)의 2순위 해소 — 지점 역할별 단가표(설계 §A).
    const container = await jobPostingRepository.getVenueContainerById(venueId);
    const venueContext: PostingSettlementContext = {
      roles: container?.roleSalaries ?? [],
      defaultSalary: DEFAULT_SALARY_INFO,
      allowances: undefined,
      taxSettings: undefined,
    };

// 119~122행 매핑을 교체:
    let result = workLogs.map((wl) => {
      const found = wl.jobPostingId ? contextByPosting.get(wl.jobPostingId) : undefined;
      return toSettlementWorkLog(
        wl,
        found?.context ?? venueContext,
        found?.title ?? container?.name
      );
    });
```
(기존 `FALLBACK_SETTLEMENT_CONTEXT` 상수(30행)와 `getEffectiveSalaryInfoFromRoles` import는 미사용이 되면 제거 — knip 래칫 보호.)

- [ ] **Step 6: venue 쿼리 테스트 케이스 추가** — 기존 settlementVenueQuery 테스트 파일(`npx jest --listTests 2>/dev/null | grep -i "settlementVenue"` 로 경로 확인)의 mock 셋업을 재사용해 3케이스 추가:
  1. 컨테이너 직속 배치 + 단가표 매칭 → `salarySource='roleTable'`, 금액이 단가표 기준으로 계산.
  2. 컨테이너 직속 배치 + 단가표 미매칭 → `salarySource='fallback'`(₩15,000 계산 유지 — 기존 동작 무회귀).
  3. `customSalaryInfo` 보유 → `salarySource='override'`(단가표보다 우선).
  (jobPostingRepository mock에 `getVenueContainerById` 반환값으로 `roleSalaries` 포함 컨테이너 주입.)

- [ ] **Step 7: 통과 확인**

Run: `cd uniqn-mobile && npx jest src/domains/settlement src/services/work/settlement --silent && npx tsc --noEmit`
Expected: PASS(신규 + 기존 정산 스위트 전부) + 타입 에러 0

- [ ] **Step 8: 커밋**

```bash
git add uniqn-mobile/src/domains/settlement uniqn-mobile/src/services/work/settlement
git commit -m "feat(salary): 정산 해소에 지점 단가표 삽입 + 출처(override/roleTable/fallback) 반환 헬퍼"
```

---

### Task 5: RoleSalaryField — 공유 급여 입력 컴포넌트

**Files:**
- Create: `uniqn-mobile/src/components/weeklyGrid/RoleSalaryField.tsx`
- Test: `uniqn-mobile/src/components/weeklyGrid/__tests__/RoleSalaryField.test.tsx`

**Interfaces:**
- Consumes: `DEFAULT_ROLE_HOURLY`/`DEFAULT_ROLE_HOURLY_FALLBACK`/`DEFAULT_SALARY_BY_TYPE`/`MAX_SALARY_AMOUNT`(`@/constants/jobPosting`), `HOURLY_STEP`(`@/utils/order-sheet/mappers` — 값 1,000).
- Produces:
  ```ts
  export type VenueSalaryDraft = { type: 'hourly' | 'daily' | 'monthly'; amount: number };
  export function defaultVenueSalaryDraft(role: string): VenueSalaryDraft; // 시급 + 역할별 기본단가
  export interface RoleSalaryFieldProps {
    roleLabel: string;                       // 예: '딜러', '칩 러너'
    value: VenueSalaryDraft;
    onChange: (next: VenueSalaryDraft) => void;
    onDismiss?: () => void;                  // '나중에 설정' — 제공 시 노출(JIT 전용)
    caption?: string;                        // 안내 문구 오버라이드
  }
  export function RoleSalaryField(props: RoleSalaryFieldProps): JSX.Element;
  ```
  Task 6(JIT)·7(설정 시트)·8(배지 시트)이 공용.

- [ ] **Step 1: 실패하는 렌더 테스트 작성**

```tsx
// uniqn-mobile/src/components/weeklyGrid/__tests__/RoleSalaryField.test.tsx
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { RoleSalaryField, defaultVenueSalaryDraft } from '../RoleSalaryField';

describe('defaultVenueSalaryDraft', () => {
  it('역할별 시급 기본값(딜러 2만/플로어 3만/그 외 2만)', () => {
    expect(defaultVenueSalaryDraft('dealer')).toEqual({ type: 'hourly', amount: 20000 });
    expect(defaultVenueSalaryDraft('floor')).toEqual({ type: 'hourly', amount: 30000 });
    expect(defaultVenueSalaryDraft('other')).toEqual({ type: 'hourly', amount: 20000 });
  });
});

describe('RoleSalaryField', () => {
  const value = { type: 'hourly' as const, amount: 20000 };
  it('역할명 안내 + 타입 세그먼트 3종(협의 없음)을 렌더한다', () => {
    const { getByText, queryByText } = render(
      <RoleSalaryField roleLabel="딜러" value={value} onChange={jest.fn()} />
    );
    expect(getByText(/딜러/)).toBeTruthy();
    expect(getByText('시급')).toBeTruthy();
    expect(getByText('일급')).toBeTruthy();
    expect(getByText('월급')).toBeTruthy();
    expect(queryByText('협의')).toBeNull();
  });
  it('시급 스테퍼 ±1,000', () => {
    const onChange = jest.fn();
    const { getByLabelText } = render(
      <RoleSalaryField roleLabel="딜러" value={value} onChange={onChange} />
    );
    fireEvent.press(getByLabelText('금액 올리기'));
    expect(onChange).toHaveBeenCalledWith({ type: 'hourly', amount: 21000 });
    fireEvent.press(getByLabelText('금액 내리기'));
    expect(onChange).toHaveBeenCalledWith({ type: 'hourly', amount: 19000 });
  });
  it('타입 전환 시 해당 타입 기본 금액으로 재시드', () => {
    const onChange = jest.fn();
    const { getByText } = render(
      <RoleSalaryField roleLabel="딜러" value={value} onChange={onChange} />
    );
    fireEvent.press(getByText('일급'));
    expect(onChange).toHaveBeenCalledWith({ type: 'daily', amount: 200000 });
  });
  it('onDismiss 제공 시 "나중에 설정" 노출·탭 전달', () => {
    const onDismiss = jest.fn();
    const { getByText } = render(
      <RoleSalaryField roleLabel="딜러" value={value} onChange={jest.fn()} onDismiss={onDismiss} />
    );
    fireEvent.press(getByText('나중에 설정'));
    expect(onDismiss).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `cd uniqn-mobile && npx jest src/components/weeklyGrid/__tests__/RoleSalaryField.test.tsx --silent`
Expected: FAIL — 모듈 부재

- [ ] **Step 3: 구현**

```tsx
// uniqn-mobile/src/components/weeklyGrid/RoleSalaryField.tsx
/**
 * RoleSalaryField — 지점 역할 단가 입력 프리미티브 (JIT 급여 설계 §B, 3표면 공용)
 *
 * AddSlotSheet JIT 인라인 / VenueSettingsSheet 행 편집 / 지점 정산 배지 시트가 공유한다.
 * 타입 세그먼트는 시급/일급/월급 3종 — '협의' 없음(자동 계산 목적상 amount:0 은 폴백과 같은 오답).
 * 시급은 ±1,000 스테퍼 + 직접입력, 일/월급은 직접입력. 금액은 MAX_SALARY_AMOUNT 클램프.
 * SalarySheet(주문서) 행 패턴의 축소판 — 여기서는 단일 역할 1행만 다룬다.
 */
import React, { useCallback, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { useThemeStore } from '@/stores/themeStore';
import { SECONDARY_PALETTE } from '@/constants/colors';
import { MinusIcon, PlusIcon } from '@/components/icons';
import {
  DEFAULT_ROLE_HOURLY,
  DEFAULT_ROLE_HOURLY_FALLBACK,
  DEFAULT_SALARY_BY_TYPE,
  MAX_SALARY_AMOUNT,
} from '@/constants/jobPosting';
import { HOURLY_STEP } from '@/utils/order-sheet/mappers';

export type VenueSalaryDraft = { type: 'hourly' | 'daily' | 'monthly'; amount: number };

const TYPE_LABELS = [
  { type: 'hourly', label: '시급' },
  { type: 'daily', label: '일급' },
  { type: 'monthly', label: '월급' },
] as const;

/** 역할별 초기 드래프트 — 시급 + 역할 차등 기본단가(주문서 프리필과 동일 상수). */
export function defaultVenueSalaryDraft(role: string): VenueSalaryDraft {
  return { type: 'hourly', amount: DEFAULT_ROLE_HOURLY[role] ?? DEFAULT_ROLE_HOURLY_FALLBACK };
}

const clamp = (amount: number) => Math.max(0, Math.min(MAX_SALARY_AMOUNT, amount));

export interface RoleSalaryFieldProps {
  roleLabel: string;
  value: VenueSalaryDraft;
  onChange: (next: VenueSalaryDraft) => void;
  onDismiss?: () => void;
  caption?: string;
}

export function RoleSalaryField({
  roleLabel,
  value,
  onChange,
  onDismiss,
  caption,
}: RoleSalaryFieldProps) {
  const isDarkMode = useThemeStore((s) => s.isDarkMode);
  const [editing, setEditing] = useState(false);
  const [draftText, setDraftText] = useState('');

  const handleType = useCallback(
    (type: VenueSalaryDraft['type']) => () => {
      if (type === value.type) return;
      onChange({ type, amount: DEFAULT_SALARY_BY_TYPE[type] });
    },
    [value.type, onChange]
  );

  const step = useCallback(
    (dir: 1 | -1) => () => onChange({ ...value, amount: clamp(value.amount + dir * HOURLY_STEP) }),
    [value, onChange]
  );

  const commitDirect = useCallback(() => {
    const parsed = parseInt(draftText.replace(/[^0-9]/g, ''), 10);
    if (!Number.isNaN(parsed)) onChange({ ...value, amount: clamp(parsed) });
    setEditing(false);
  }, [draftText, value, onChange]);

  return (
    <View className="gap-2 rounded-md border border-secondary-200 bg-surface-page p-3 dark:border-surface-overlay dark:bg-surface-elevated">
      <Text className="text-sm font-sans-medium text-content-primary">
        {caption ?? `${roleLabel} 단가 미설정 — 지금 입력하면 이후 자동으로 적용돼요`}
      </Text>

      {/* 급여 타입 세그먼트 (협의 없음) */}
      <View className="flex-row gap-1 rounded-lg bg-surface-card p-1 dark:bg-surface">
        {TYPE_LABELS.map(({ type, label }) => (
          <Pressable
            key={type}
            onPress={handleType(type)}
            accessibilityRole="tab"
            accessibilityState={{ selected: value.type === type }}
            className={`flex-1 items-center rounded-md py-2 active:opacity-80 ${
              value.type === type ? 'bg-primary-500 dark:bg-primary-600' : ''
            }`}
          >
            <Text
              className={`text-sm font-sans-medium ${
                value.type === type ? 'text-white' : 'text-content-secondary'
              }`}
            >
              {label}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* 금액 — 시급은 스테퍼, 금액 탭 시 직접입력 */}
      <View className="flex-row items-center justify-between">
        {value.type === 'hourly' ? (
          <Pressable
            onPress={step(-1)}
            accessibilityRole="button"
            accessibilityLabel="금액 내리기"
            hitSlop={10}
            className="h-11 w-11 items-center justify-center rounded-md bg-surface-card dark:bg-surface"
          >
            <MinusIcon size={18} color={SECONDARY_PALETTE[isDarkMode ? 400 : 500]} />
          </Pressable>
        ) : (
          <View className="w-11" />
        )}

        {editing ? (
          <TextInput
            value={draftText}
            onChangeText={setDraftText}
            onBlur={commitDirect}
            onSubmitEditing={commitDirect}
            keyboardType="number-pad"
            returnKeyType="done"
            accessibilityLabel="금액 직접 입력"
            className="min-w-[120px] rounded-md border border-primary-400 px-3 py-2 text-center text-base font-sans-semibold text-content-primary"
          />
        ) : (
          <Pressable
            onPress={() => {
              setDraftText(String(value.amount));
              setEditing(true);
            }}
            accessibilityRole="button"
            accessibilityLabel="금액 직접 입력 열기"
            className="min-h-[44px] justify-center px-3"
          >
            <Text className="text-lg font-sans-bold text-content-primary">
              {value.amount.toLocaleString('ko-KR')}원
            </Text>
          </Pressable>
        )}

        {value.type === 'hourly' ? (
          <Pressable
            onPress={step(1)}
            accessibilityRole="button"
            accessibilityLabel="금액 올리기"
            hitSlop={10}
            className="h-11 w-11 items-center justify-center rounded-md bg-surface-card dark:bg-surface"
          >
            <PlusIcon size={18} color={SECONDARY_PALETTE[isDarkMode ? 400 : 500]} />
          </Pressable>
        ) : (
          <View className="w-11" />
        )}
      </View>

      {onDismiss ? (
        <Pressable
          onPress={onDismiss}
          accessibilityRole="button"
          className="min-h-[44px] items-center justify-center"
        >
          <Text className="text-sm text-content-secondary underline">나중에 설정</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
```

- [ ] **Step 4: 통과 확인**

Run: `cd uniqn-mobile && npx jest src/components/weeklyGrid/__tests__/RoleSalaryField.test.tsx --silent`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add uniqn-mobile/src/components/weeklyGrid/RoleSalaryField.tsx uniqn-mobile/src/components/weeklyGrid/__tests__/RoleSalaryField.test.tsx
git commit -m "feat(salary): RoleSalaryField 공유 단가 입력 컴포넌트 — 3표면 공용"
```

---

### Task 6: 접점 1 — AddSlotSheet JIT 인라인 필드

**Files:**
- Create: `uniqn-mobile/src/hooks/weeklyGrid/useVenueContainer.ts`
- Modify: `uniqn-mobile/src/hooks/weeklyGrid/index.ts`
- Modify: `uniqn-mobile/src/components/weeklyGrid/AddSlotSheet.tsx`
- Test: 기존 `AddSlotSheet` 테스트 파일에 케이스 추가(경로: `npx jest --listTests | grep -i addslot`으로 확인; 없으면 `uniqn-mobile/src/components/weeklyGrid/__tests__/AddSlotSheet.jit.test.tsx` 신규 — 형제 시트 테스트의 mock 셋업 복제)

**Interfaces:**
- Consumes: `useVenueContainer(venueId)`(신규) · `hasRoleSalary`(Task 1) · `RoleSalaryField`/`defaultVenueSalaryDraft`(Task 5) · `useSetVenueRoleSalary`(Task 3).
- Produces: 동작 계약 —
  1. 역할 선택 완료(표준: 칩 / 커스텀: 이름 입력) 시 단가표 미설정이면 RoleSalaryField 노출, 설정돼 있으면 미노출.
  2. "나중에 설정" 탭 → 필드 숨김(역할 변경 시 재노출 조건 리셋).
  3. 추가 시 **단가 먼저 저장 → 슬롯 추가**. 단가 저장 실패는 토스트 후 슬롯 추가 계속.

- [ ] **Step 1: `useVenueContainer` 훅 작성** (TanStack 읽기 전용 조회 — Repository 직접 호출 허용 규칙)

```ts
// uniqn-mobile/src/hooks/weeklyGrid/useVenueContainer.ts
/**
 * useVenueContainer — 컨테이너 단건 조회(roleSalaries 포함). JIT 노출 판정용.
 * 읽기 전용 TanStack 조회는 Repository 직접 호출 허용(아키텍처 규칙).
 */
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryClient';
import { jobPostingRepository } from '@/repositories';

export function useVenueContainer(venueId: string | null) {
  return useQuery({
    queryKey: queryKeys.weeklyGrid.container(venueId ?? ''),
    queryFn: () => jobPostingRepository.getVenueContainerById(venueId as string),
    enabled: !!venueId,
  });
}
```
(배럴 export 추가.)

- [ ] **Step 2: 실패하는 JIT 테스트 작성** — 핵심 케이스 4개(기존 AddSlotSheet 테스트의 provider/mock 셋업 재사용):

```tsx
// (기존 셋업에 추가) jobPostingRepository.getVenueContainerById mock:
//   { ...컨테이너, roleSalaries: [{ role: 'dealer', salary: { type: 'hourly', amount: 20000 } }] }
// useSetVenueRoleSalary 의 service(gridWriteService.setVenueRoleSalary) mock.

it('미설정 역할(serving) 선택 시 JIT 단가 필드가 나타난다', async () => {
  // 후보 선택 → 역할 칩 'serving' 탭 → getByText(/서빙 단가 미설정/) 존재
});
it('설정된 역할(dealer) 선택 시 JIT 필드가 없다', async () => {
  // 역할 칩 'dealer' 탭 → queryByText(/단가 미설정/) === null
});
it('추가 시 단가 먼저 저장 후 슬롯 추가(호출 순서)', async () => {
  // serving 선택 + 기본값 유지 → '추가' 탭
  // expect(setVenueRoleSalaryMock).toHaveBeenCalledWith('container-1',
  //   { role: 'serving', customRole: undefined, salary: { type: 'hourly', amount: 20000 } });
  // expect(setVenueRoleSalaryMock.mock.invocationCallOrder[0])
  //   .toBeLessThan(addStaffMock.mock.invocationCallOrder[0]);
});
it('단가 저장 실패해도 슬롯 추가는 진행되고 토스트 안내', async () => {
  // setVenueRoleSalaryMock.mockRejectedValueOnce(new Error('fail'))
  // → addStaffMock 여전히 호출됨 + addToast({type:'info'|'error', ...}) 호출
});
```
(실제 렌더 상호작용 코드는 기존 스위트의 관용구(fireEvent + findBy*)를 따른다.)

- [ ] **Step 3: 실패 확인**

Run: `cd uniqn-mobile && npx jest src/components/weeklyGrid --silent`
Expected: 신규 케이스 FAIL

- [ ] **Step 4: AddSlotSheet 수정** — 변경 지점(기존 코드 기준):

```tsx
// import 추가
import { hasRoleSalary } from '@/domains/weeklyGrid';
import { useVenueContainer, useSetVenueRoleSalary } from '@/hooks/weeklyGrid';
import { RoleSalaryField, defaultVenueSalaryDraft, type VenueSalaryDraft } from './RoleSalaryField';
import { getRoleDisplayName } from '@/types/unified';

// 컴포넌트 본문 상단(useConfirmedStaff 아래)에 추가
const { data: container } = useVenueContainer(visible ? containerId : null);
const setRoleSalary = useSetVenueRoleSalary();
const [jitDraft, setJitDraft] = useState<VenueSalaryDraft | null>(null);
const [jitDismissed, setJitDismissed] = useState(false);

// 역할 선택 완료 여부 + JIT 필요 판정 (isCustomRole/canSubmit 근처)
const roleReady = !!roleKey && (!isCustomRole || customRole.trim().length > 0);
const needsJitSalary =
  roleReady &&
  !jitDismissed &&
  !hasRoleSalary(
    container?.roleSalaries ?? [],
    roleKey,
    isCustomRole ? customRole.trim() : undefined
  );

// 역할/커스텀명 변경 시 JIT 상태 리셋 + 기본값 시드
useEffect(() => {
  setJitDismissed(false);
  setJitDraft(roleReady ? defaultVenueSalaryDraft(roleKey) : null);
  // roleReady 파생값 자체가 roleKey/customRole 에 의존 — 둘만 의존성으로 둔다.
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [roleKey, customRole]);

// handleSubmit 시작부(payload 빌드 전)에 삽입 — 단가 먼저, 실패해도 계속:
if (needsJitSalary && jitDraft) {
  try {
    await setRoleSalary.mutateAsync({
      venueId: containerId,
      role: roleKey,
      customRole: isCustomRole ? customRole.trim() : undefined,
      salary: jitDraft,
    });
  } catch (error) {
    logger.warn('지점 단가 JIT 저장 실패 — 배치는 계속', { containerId, roleKey });
    addToast({ type: 'info', message: '단가 저장에 실패했어요. 다음 배치 때 다시 물어볼게요.' });
  }
}

// JSX — StartTimeField 위에 조건부 렌더 삽입:
{needsJitSalary && jitDraft ? (
  <RoleSalaryField
    roleLabel={getRoleDisplayName(roleKey, isCustomRole ? customRole.trim() : undefined)}
    value={jitDraft}
    onChange={setJitDraft}
    onDismiss={() => setJitDismissed(true)}
  />
) : null}

// handleSubmit useCallback 의존성 배열에 needsJitSalary, jitDraft, setRoleSalary 추가.
```

- [ ] **Step 5: 통과 확인**

Run: `cd uniqn-mobile && npx jest src/components/weeklyGrid --silent && npx tsc --noEmit`
Expected: PASS(신규 4케이스 + 기존 AddSlotSheet 스위트 무회귀)

- [ ] **Step 6: 커밋**

```bash
git add uniqn-mobile/src/components/weeklyGrid uniqn-mobile/src/hooks/weeklyGrid
git commit -m "feat(salary): AddSlotSheet JIT 단가 입력 — 미설정 역할만 그 자리서 묻고 단가표 저장"
```

---

### Task 7: 접점 3 — VenueSettingsSheet + ⚙ 진입점

**Files:**
- Create: `uniqn-mobile/src/components/weeklyGrid/VenueSettingsSheet.tsx`
- Modify: `uniqn-mobile/src/components/weeklyGrid/VenueSelector.tsx` (선택 칩 ⚙)
- Modify: `uniqn-mobile/app/(employer)/weekly-grid.tsx` (시트 배선)
- Test: `uniqn-mobile/src/components/weeklyGrid/__tests__/VenueSettingsSheet.test.tsx`

**Interfaces:**
- Consumes: `VenueContainer`(roleSalaries 포함, Task 1) · `useSetVenueRoleSalary`(Task 3) · `RoleSalaryField`/`defaultVenueSalaryDraft`(Task 5) · `RoleChips`(`@/components/staffPicker`) · `getRoleDisplayName`(`@/types/unified`) · `SheetModal`.
- Produces:
  ```ts
  export interface VenueSettingsSheetProps {
    visible: boolean;
    onClose: () => void;
    container: VenueContainer | null;
  }
  ```
  `VenueSelectorProps`에 `onOpenSettings?: (venueId: string) => void` 추가 — 선택된 칩 옆 ⚙ 노출.

- [ ] **Step 1: 실패하는 테스트 작성**

```tsx
// uniqn-mobile/src/components/weeklyGrid/__tests__/VenueSettingsSheet.test.tsx
// (SheetModal/테마 mock 은 형제 시트 테스트 셋업 복제. useSetVenueRoleSalary 는
//  gridWriteService.setVenueRoleSalary mock 경유.)
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { VenueSettingsSheet } from '../VenueSettingsSheet';

const container = {
  id: 'v1', name: '강남점', workspaceId: 'w1', ownerId: 'u1', venueId: 'v1',
  kind: 'dated', softTargets: {},
  roleSalaries: [
    { role: 'dealer', salary: { type: 'hourly', amount: 20000 } },
    { role: 'other', customRole: '칩 러너', salary: { type: 'daily', amount: 150000 } },
  ],
};

it('등록된 역할 행을 라벨+단가로 렌더한다', () => {
  const { getByText } = render(
    <VenueSettingsSheet visible onClose={jest.fn()} container={container as never} />
  );
  expect(getByText('딜러')).toBeTruthy();
  expect(getByText('시급 20,000원')).toBeTruthy();
  expect(getByText('칩 러너')).toBeTruthy();
  expect(getByText('일급 150,000원')).toBeTruthy();
});
it('행 삭제 → salary:null 로 mutate', () => {
  const { getByLabelText } = render(
    <VenueSettingsSheet visible onClose={jest.fn()} container={container as never} />
  );
  fireEvent.press(getByLabelText('딜러 단가 삭제'));
  // expect(setVenueRoleSalaryMock).toHaveBeenCalledWith('v1', { role: 'dealer', customRole: undefined, salary: null });
});
it('빈 단가표는 온보딩 빈 상태(인지+가치+행동)를 보여준다', () => {
  const { getByText } = render(
    <VenueSettingsSheet visible onClose={jest.fn()}
      container={{ ...container, roleSalaries: [] } as never} />
  );
  expect(getByText(/아직 설정된 단가가 없어요/)).toBeTruthy();
  expect(getByText(/배치할 때 자동으로 물어봐요/)).toBeTruthy();
});
```

- [ ] **Step 2: 실패 확인**

Run: `cd uniqn-mobile && npx jest src/components/weeklyGrid/__tests__/VenueSettingsSheet.test.tsx --silent`
Expected: FAIL — 모듈 부재

- [ ] **Step 3: VenueSettingsSheet 구현**

```tsx
// uniqn-mobile/src/components/weeklyGrid/VenueSettingsSheet.tsx
/**
 * VenueSettingsSheet — 지점 역할별 단가표 관리 시트 (JIT 급여 설계 §C, 보조 진입점)
 *
 * 주 입력은 배치 시 JIT(AddSlotSheet) — 이 시트는 일괄 조회·수정(시급 인상 등)·삭제용.
 * 행 편집/역할 추가 폼은 RoleSalaryField 재사용. 저장은 useSetVenueRoleSalary 단일 경로.
 * v1 범위: 단가표만(지점 이름 변경 등 기타 설정 제외 — 설계 §C 범위 컷).
 */
import React, { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { SheetModal } from '@/components/ui/SheetModal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { TrashIcon } from '@/components/icons';
import { SECONDARY_PALETTE } from '@/constants/colors';
import { RoleChips } from '@/components/staffPicker';
import { getRoleDisplayName } from '@/types/unified';
import { useSetVenueRoleSalary } from '@/hooks/weeklyGrid';
import { useToastStore } from '@/stores/toastStore';
import type { VenueContainer } from '@/domains/weeklyGrid';
import type { PostingRoleCatalogEntry } from '@/types';
import { RoleSalaryField, defaultVenueSalaryDraft, type VenueSalaryDraft } from './RoleSalaryField';

const TYPE_LABEL: Record<string, string> = { hourly: '시급', daily: '일급', monthly: '월급' };

const entryLabel = (e: PostingRoleCatalogEntry) => getRoleDisplayName(e.role, e.customRole);
const salaryLabel = (e: PostingRoleCatalogEntry) =>
  e.salary ? `${TYPE_LABEL[e.salary.type] ?? e.salary.type} ${e.salary.amount.toLocaleString('ko-KR')}원` : '미설정';
const entryKey = (e: { role: string; customRole?: string }) =>
  e.role === 'other' && e.customRole ? `other:${e.customRole}` : e.role;

export interface VenueSettingsSheetProps {
  visible: boolean;
  onClose: () => void;
  container: VenueContainer | null;
}

export function VenueSettingsSheet({ visible, onClose, container }: VenueSettingsSheetProps) {
  const { addToast } = useToastStore();
  const mutation = useSetVenueRoleSalary();
  const entries = container?.roleSalaries ?? [];

  // 편집 중인 행 키 / 추가 폼 상태
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<VenueSalaryDraft | null>(null);
  const [adding, setAdding] = useState(false);
  const [addRole, setAddRole] = useState('');
  const [addCustomRole, setAddCustomRole] = useState('');
  const [addDraft, setAddDraft] = useState<VenueSalaryDraft | null>(null);

  const save = useCallback(
    async (role: string, customRole: string | undefined, salary: VenueSalaryDraft | null) => {
      if (!container) return;
      try {
        await mutation.mutateAsync({ venueId: container.id, role, customRole, salary });
        addToast({
          type: 'success',
          message: salary ? '단가를 저장했어요' : '단가를 삭제했어요 — 다음 배치 때 다시 물어봐요',
        });
        setEditingKey(null);
        setAdding(false);
        setAddRole('');
        setAddCustomRole('');
        setAddDraft(null);
      } catch {
        addToast({ type: 'error', message: '단가 저장에 실패했어요. 잠시 후 다시 시도해주세요.' });
      }
    },
    [container, mutation, addToast]
  );

  const addRoleReady = !!addRole && (addRole !== 'other' || addCustomRole.trim().length > 0);

  return (
    <SheetModal visible={visible} onClose={onClose} title="역할별 단가" isLoading={mutation.isPending}>
      <View className="gap-3 p-5">
        <Text className="text-sm text-content-secondary font-sans">
          처음 쓰는 역할은 배치할 때 자동으로 물어봐요. 여기서는 한 번에 확인·수정할 수 있어요.
        </Text>

        {entries.length === 0 ? (
          <View className="items-center gap-2 py-8">
            <Text className="text-base font-sans-semibold text-content-primary">
              아직 설정된 단가가 없어요
            </Text>
            <Text className="text-center text-sm text-content-secondary font-sans">
              근무표에서 인원을 배치할 때 자동으로 물어봐요. 미리 넣고 싶으면 아래에서 추가하세요.
            </Text>
          </View>
        ) : (
          <View className="gap-1">
            {entries.map((e) => {
              const key = entryKey(e);
              const isEditing = editingKey === key;
              return (
                <View key={key} className="border-b border-secondary-200 py-1 dark:border-surface-overlay">
                  <View className="flex-row items-center justify-between py-2">
                    <Pressable
                      className="min-h-[44px] flex-1 flex-row items-center justify-between pr-2"
                      accessibilityRole="button"
                      accessibilityLabel={`${entryLabel(e)} 단가 수정`}
                      onPress={() => {
                        setEditingKey(isEditing ? null : key);
                        setEditDraft(
                          e.salary && e.salary.type !== 'other'
                            ? { type: e.salary.type, amount: e.salary.amount }
                            : defaultVenueSalaryDraft(e.role)
                        );
                      }}
                    >
                      <Text className="text-base text-content-primary font-sans-medium">
                        {entryLabel(e)}
                      </Text>
                      <Text className="text-base text-content-secondary font-sans">
                        {salaryLabel(e)}
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => save(e.role, e.customRole, null)}
                      accessibilityRole="button"
                      accessibilityLabel={`${entryLabel(e)} 단가 삭제`}
                      hitSlop={10}
                      className="h-11 w-11 items-center justify-center"
                    >
                      <TrashIcon size={18} color={SECONDARY_PALETTE[400]} />
                    </Pressable>
                  </View>
                  {isEditing && editDraft ? (
                    <View className="gap-2 pb-2">
                      <RoleSalaryField
                        roleLabel={entryLabel(e)}
                        caption={`${entryLabel(e)} 단가 수정`}
                        value={editDraft}
                        onChange={setEditDraft}
                      />
                      <Button variant="primary" onPress={() => save(e.role, e.customRole, editDraft)} fullWidth>
                        단가 저장
                      </Button>
                    </View>
                  ) : null}
                </View>
              );
            })}
          </View>
        )}

        {/* 역할 추가 */}
        {adding ? (
          <View className="gap-3 pt-2">
            <Text className="text-sm font-sans-medium text-content-secondary">역할</Text>
            <RoleChips
              value={addRole}
              onChange={(role) => {
                setAddRole(role);
                setAddDraft(defaultVenueSalaryDraft(role));
              }}
            />
            {addRole === 'other' ? (
              <Input
                label="역할명 직접 입력"
                value={addCustomRole}
                onChangeText={setAddCustomRole}
                placeholder="예: 칩 러너"
              />
            ) : null}
            {addRoleReady && addDraft ? (
              <RoleSalaryField
                roleLabel={getRoleDisplayName(addRole, addRole === 'other' ? addCustomRole.trim() : undefined)}
                caption="단가 입력"
                value={addDraft}
                onChange={setAddDraft}
              />
            ) : null}
            <Button
              variant="primary"
              disabled={!addRoleReady || !addDraft}
              onPress={() =>
                addDraft &&
                save(addRole, addRole === 'other' ? addCustomRole.trim() : undefined, addDraft)
              }
              fullWidth
            >
              단가 추가
            </Button>
          </View>
        ) : (
          <Button variant="outline" onPress={() => setAdding(true)} fullWidth>
            역할 추가
          </Button>
        )}
      </View>
    </SheetModal>
  );
}
```
(⚠️ `TrashIcon`이 `@/components/icons`에 없으면 기존 삭제 아이콘 이름(`Trash2Icon` 등)을 icons/index에서 확인해 사용 — `lucide-react-native` 직접 import는 ESLint 차단.)

- [ ] **Step 4: VenueSelector ⚙ + weekly-grid 배선**

`VenueSelector.tsx` — props에 `onOpenSettings?: (venueId: string) => void` 추가. 선택된 칩(`c.id === selectedVenueId`) 오른쪽에 ⚙ 렌더:

```tsx
// containers.map 내부 — 기존 Chip 을 View 로 감싸 ⚙ 동반:
containers.map((c) => (
  <View key={c.id} className="flex-row items-center">
    <Chip
      label={c.name}
      selected={c.id === selectedVenueId}
      onPress={handleSelectVenue(c.id)}
      a11yLabel={`지점 ${c.name}`}
    />
    {onOpenSettings && c.id === selectedVenueId ? (
      <Pressable
        onPress={() => onOpenSettings(c.id)}
        accessibilityRole="button"
        accessibilityLabel={`지점 ${c.name} 단가 설정`}
        hitSlop={10}
        className="-ml-1 mr-2 h-10 w-10 items-center justify-center"
      >
        <SettingsIcon size={18} color={SECONDARY_PALETTE[400]} />
      </Pressable>
    ) : null}
  </View>
))
```
(`SettingsIcon`/`SECONDARY_PALETTE` import 추가 — 아이콘 실명은 `@/components/icons` index에서 확인, 톱니류(`SettingsIcon`/`CogIcon` 등) 기존 export 재사용.)

`app/(employer)/weekly-grid.tsx` — 상태·배선 추가:

```tsx
const [settingsOpen, setSettingsOpen] = useState(false);
const selectedContainer = containers.find((c) => c.id === selectedVenueId) ?? null;

// <VenueSelector ...> 에 prop 추가:
onOpenSettings={() => setSettingsOpen(true)}

// 화면 말미(다른 시트들 옆)에:
<VenueSettingsSheet
  visible={settingsOpen}
  onClose={() => setSettingsOpen(false)}
  container={selectedContainer}
/>
```

- [ ] **Step 5: 통과 확인**

Run: `cd uniqn-mobile && npx jest src/components/weeklyGrid --silent && npx tsc --noEmit`
Expected: PASS + 타입 에러 0

- [ ] **Step 6: 커밋**

```bash
git add uniqn-mobile/src/components/weeklyGrid "uniqn-mobile/app/(employer)/weekly-grid.tsx"
git commit -m "feat(salary): 지점 단가표 시트 + VenueSelector 설정 진입점(접점 3)"
```

---

### Task 8: 접점 2 — 지점 정산 화면 + 폴백 배지 + 탭 구제

**Files:**
- Create: `uniqn-mobile/src/hooks/weeklyGrid/useVenueSettlement.ts`
- Create: `uniqn-mobile/app/(employer)/venue-settlements.tsx`
- Modify: `uniqn-mobile/src/lib/queryClient.ts:367` (settlement 키에 `byVenue` 추가)
- Modify: `uniqn-mobile/app/(employer)/weekly-grid.tsx:158` (StackHeader rightAction "정산")
- Modify: `uniqn-mobile/src/services/work/settlement/index.ts` (`getVenueSettlementWorkLogs` export 확인 — 이미 42행에 존재)
- Test: `uniqn-mobile/src/hooks/weeklyGrid/__tests__/useVenueSettlement.test.tsx` (월 경계 계산)

**Interfaces:**
- Consumes: `getVenueSettlementWorkLogs(venueId, {start, end})`(기존, 소비처 0이던 서비스) · `SettlementWorkLog.salarySource/salaryInfo`(Task 4) · `SettlementCard`(`@/components/employer/settlement` — props `{workLog, salaryInfo, onPress?}`) · `RoleSalaryField`(Task 5) · `useSetVenueRoleSalary`(Task 3).
- Produces: 라우트 `/(employer)/venue-settlements?venueId=<id>&month=<YYYY-MM>` · `useVenueSettlement(venueId, month)` — `queryKeys.settlement.byVenue` 기반 useQuery.

- [ ] **Step 1: queryKeys 추가** — `queryClient.ts` settlement 그룹(367행)에:

```ts
    byVenue: (venueId: string, start: string, end: string) =>
      [...queryKeys.settlement.all, 'byVenue', venueId, start, end] as const,
```

- [ ] **Step 2: 실패하는 훅 테스트 작성** (월 경계 — date-fns 사용, 손계산 금지)

```tsx
// uniqn-mobile/src/hooks/weeklyGrid/__tests__/useVenueSettlement.test.tsx
import { monthToRange } from '../useVenueSettlement';

describe('monthToRange', () => {
  it('YYYY-MM 을 월 시작·끝(YYYY-MM-DD, inclusive)으로 변환한다', () => {
    expect(monthToRange('2026-07')).toEqual({ start: '2026-07-01', end: '2026-07-31' });
    expect(monthToRange('2026-02')).toEqual({ start: '2026-02-01', end: '2026-02-28' });
    expect(monthToRange('2028-02')).toEqual({ start: '2028-02-01', end: '2028-02-29' }); // 윤년
  });
});
```

- [ ] **Step 3: 훅 구현**

```ts
// uniqn-mobile/src/hooks/weeklyGrid/useVenueSettlement.ts
/**
 * useVenueSettlement — 지점(컨테이너) 월 단위 정산 조회 (JIT 급여 설계 §D).
 * getVenueSettlementWorkLogs(서비스)의 첫 UI 소비처. 날짜범위는 SQL 경계(repo)에서 적용됨.
 */
import { useQuery } from '@tanstack/react-query';
import { endOfMonth, format, parse, startOfMonth } from 'date-fns';
import { queryKeys } from '@/lib/queryClient';
import { getVenueSettlementWorkLogs } from '@/services/work/settlement';

/** 'YYYY-MM' → 월 경계(YYYY-MM-DD inclusive). date-fns 사용(수동 날짜계산 금지 규칙). */
export function monthToRange(month: string): { start: string; end: string } {
  const base = parse(month, 'yyyy-MM', new Date());
  return {
    start: format(startOfMonth(base), 'yyyy-MM-dd'),
    end: format(endOfMonth(base), 'yyyy-MM-dd'),
  };
}

export function useVenueSettlement(venueId: string | null, month: string) {
  const { start, end } = monthToRange(month);
  return useQuery({
    queryKey: queryKeys.settlement.byVenue(venueId ?? '', start, end),
    queryFn: () => getVenueSettlementWorkLogs(venueId as string, { start, end }),
    enabled: !!venueId,
  });
}
```
(배럴 export 추가.)

- [ ] **Step 4: 훅 테스트 통과 확인**

Run: `cd uniqn-mobile && npx jest src/hooks/weeklyGrid/__tests__/useVenueSettlement.test.tsx --silent`
Expected: PASS

- [ ] **Step 5: 화면 구현**

```tsx
// uniqn-mobile/app/(employer)/venue-settlements.tsx
/**
 * 지점 정산 — 근무표 직접 배치분 월 단위 정산 (JIT 급여 설계 §D)
 *
 * 폴백(₩15,000) 계산 건은 "기본 단가 적용" 배지로 가시화(조용한 오답 금지 — 정책 2026-07-22),
 * 배지 탭 → RoleSalaryField 시트로 그 역할 단가를 즉시 설정 → 쿼리 invalidate 재계산
 * (정산은 read-time 계산이라 refetch 로 충분). 건별 예외는 기존 공고 정산의 customSalaryInfo 경로.
 */
import React, { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { format } from 'date-fns';
import { StackHeader } from '@/components/headers';
import { EmptyState } from '@/components/ui/EmptyState';
import { Loading } from '@/components/ui/Loading';
import { Button } from '@/components/ui/Button';
import { SheetModal } from '@/components/ui/SheetModal';
import { SettlementCard } from '@/components/employer/settlement/SettlementCard';
import { BanknotesIcon, ChevronLeftIcon, ChevronRightIcon } from '@/components/icons';
import { SECONDARY_PALETTE } from '@/constants/colors';
import { getRoleDisplayName } from '@/types/unified';
import { useVenueSettlement, useSetVenueRoleSalary } from '@/hooks/weeklyGrid';
import { useToastStore } from '@/stores/toastStore';
import {
  RoleSalaryField,
  defaultVenueSalaryDraft,
  type VenueSalaryDraft,
} from '@/components/weeklyGrid/RoleSalaryField';
import type { SettlementWorkLog } from '@/services/work/settlement/types';

/** 배지 탭으로 여는 단가 설정 대상(역할 단위) */
interface FixTarget {
  role: string;
  customRole?: string;
}

function addMonths(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return format(d, 'yyyy-MM');
}

export default function VenueSettlementsScreen() {
  const params = useLocalSearchParams<{ venueId?: string; month?: string }>();
  const venueId = typeof params.venueId === 'string' ? params.venueId : null;
  const initialMonth =
    typeof params.month === 'string' && /^\d{4}-\d{2}$/.test(params.month)
      ? params.month
      : format(new Date(), 'yyyy-MM');

  const [month, setMonth] = useState(initialMonth);
  const { data: workLogs, isLoading, refetch } = useVenueSettlement(venueId, month);
  const mutation = useSetVenueRoleSalary();
  const { addToast } = useToastStore();

  const [fixTarget, setFixTarget] = useState<FixTarget | null>(null);
  const [fixDraft, setFixDraft] = useState<VenueSalaryDraft | null>(null);

  const fallbackCount = useMemo(
    () => (workLogs ?? []).filter((wl) => wl.salarySource === 'fallback').length,
    [workLogs]
  );

  const openFix = useCallback((wl: SettlementWorkLog) => {
    const role = wl.role ?? '';
    if (!role) return;
    setFixTarget({ role, customRole: wl.customRole });
    setFixDraft(defaultVenueSalaryDraft(role));
  }, []);

  const saveFix = useCallback(async () => {
    if (!venueId || !fixTarget || !fixDraft) return;
    try {
      await mutation.mutateAsync({ venueId, ...fixTarget, salary: fixDraft });
      addToast({ type: 'success', message: '단가를 저장했어요. 정산을 다시 계산합니다.' });
      setFixTarget(null);
      await refetch();
    } catch {
      addToast({ type: 'error', message: '단가 저장에 실패했어요. 잠시 후 다시 시도해주세요.' });
    }
  }, [venueId, fixTarget, fixDraft, mutation, addToast, refetch]);

  const renderItem = useCallback(
    ({ item }: { item: SettlementWorkLog }) => (
      <View className="mb-2">
        {item.salaryInfo ? (
          <SettlementCard workLog={item} salaryInfo={item.salaryInfo} />
        ) : null}
        {item.salarySource === 'fallback' ? (
          <Pressable
            onPress={() => openFix(item)}
            accessibilityRole="button"
            accessibilityLabel={`${getRoleDisplayName(item.role ?? '', item.customRole)} 기본 단가 적용 — 탭해서 단가 설정`}
            className="mt-1 min-h-[44px] flex-row items-center gap-2 rounded-md bg-warning/10 px-3 py-2"
          >
            <BanknotesIcon size={16} color={SECONDARY_PALETTE[500]} />
            <Text className="flex-1 text-sm text-content-secondary font-sans">
              기본 단가(시급 15,000원)로 계산됐어요 — 탭해서{' '}
              {getRoleDisplayName(item.role ?? '', item.customRole)} 단가를 설정하면 다시 계산돼요.
            </Text>
          </Pressable>
        ) : null}
      </View>
    ),
    [openFix]
  );

  return (
    <View className="flex-1 bg-surface-page dark:bg-surface">
      <StackHeader title="지점 정산" fallbackHref="/(employer)/weekly-grid" />

      {/* 월 네비게이션 */}
      <View className="flex-row items-center justify-center gap-4 py-3">
        <Pressable
          onPress={() => setMonth((m) => addMonths(m, -1))}
          accessibilityRole="button"
          accessibilityLabel="이전 달"
          hitSlop={10}
          className="h-11 w-11 items-center justify-center"
        >
          <ChevronLeftIcon size={20} color={SECONDARY_PALETTE[500]} />
        </Pressable>
        <Text className="text-base font-sans-semibold text-content-primary">
          {month.replace('-', '년 ')}월
        </Text>
        <Pressable
          onPress={() => setMonth((m) => addMonths(m, 1))}
          accessibilityRole="button"
          accessibilityLabel="다음 달"
          hitSlop={10}
          className="h-11 w-11 items-center justify-center"
        >
          <ChevronRightIcon size={20} color={SECONDARY_PALETTE[500]} />
        </Pressable>
      </View>

      {fallbackCount > 0 ? (
        <Text className="px-4 pb-2 text-sm text-content-secondary font-sans">
          기본 단가로 계산된 근무 {fallbackCount}건 — 배지를 탭해 단가를 설정하세요.
        </Text>
      ) : null}

      {isLoading ? (
        <View className="items-center py-10">
          <Loading size="small" />
        </View>
      ) : (workLogs ?? []).length === 0 ? (
        <View className="px-4 py-8">
          <EmptyState
            icon={<BanknotesIcon size={40} color={SECONDARY_PALETTE[400]} />}
            title="이 달 정산할 근무가 없어요"
            description="근무표에서 인원을 배치하면 여기서 월별 정산을 확인할 수 있어요."
          />
        </View>
      ) : (
        <FlatList
          data={workLogs}
          keyExtractor={(item) => item.id ?? `${item.staffId}-${item.date}`}
          renderItem={renderItem}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
        />
      )}

      {/* 배지 탭 → 단가 설정 시트 (RoleSalaryField 재사용 — 접점 1과 동일 컴포넌트) */}
      <SheetModal
        visible={!!fixTarget}
        onClose={() => setFixTarget(null)}
        title="단가 설정"
        isLoading={mutation.isPending}
        footer={
          <Button variant="primary" onPress={saveFix} loading={mutation.isPending} fullWidth>
            단가 저장하고 다시 계산
          </Button>
        }
      >
        <View className="p-5">
          {fixTarget && fixDraft ? (
            <RoleSalaryField
              roleLabel={getRoleDisplayName(fixTarget.role, fixTarget.customRole)}
              caption={`${getRoleDisplayName(fixTarget.role, fixTarget.customRole)} 단가를 설정하면 이 지점의 같은 역할 정산에 모두 적용돼요.`}
              value={fixDraft}
              onChange={setFixDraft}
            />
          ) : null}
        </View>
      </SheetModal>
    </View>
  );
}
```
(⚠️ 정산 목록은 소형 리스트(월 단위 수십 건)라 FlatList 사용 — 규칙 합치. `SettlementCard`의 정확한 named export 경로는 `@/components/employer/settlement` 배럴 존재 시 그쪽 우선. `keyExtractor`의 `item.id`/`item.date` 필드명은 `WorkLog` 타입 확인 후 실제 필드로 조정. 아이콘 실명은 icons/index에서 확인.)

- [ ] **Step 6: weekly-grid 진입점** — `weekly-grid.tsx:158` StackHeader에 rightAction:

```tsx
<StackHeader
  title="근무표"
  fallbackHref="/(employer)/workspace"
  rightAction={
    hasVenue ? (
      <Pressable
        onPress={() =>
          router.push({
            pathname: '/(employer)/venue-settlements',
            params: { venueId: selectedVenueId as string, month: format(visibleMonth, 'yyyy-MM') },
          })
        }
        accessibilityRole="button"
        accessibilityLabel="지점 정산 보기"
        hitSlop={10}
        className="min-h-[44px] justify-center px-2"
      >
        <Text className="text-base font-sans-medium text-primary-500">정산</Text>
      </Pressable>
    ) : undefined
  }
/>
```
(`router`는 파일 내 기존 `useRouter()` 인스턴스 재사용, 없으면 추가.)

- [ ] **Step 7: 렌더 검증 (fablize 그라운딩 — 실기기/웹 실행 관찰)**

```bash
cd uniqn-mobile && npx expo start --web
```
웹에서 employer 로그인 → 근무표 → "정산" 진입 → 월 네비·빈 상태·(시드 데이터 있으면) 배지 렌더를 **실제로 관찰**. 관찰이 드러낸 문제를 수정 후 재실행. (정적 통과만으로 완료 주장 금지.)

- [ ] **Step 8: 통과 확인**

Run: `cd uniqn-mobile && npx jest src/hooks/weeklyGrid src/components/weeklyGrid --silent && npx tsc --noEmit`
Expected: PASS + 타입 에러 0

- [ ] **Step 9: 커밋**

```bash
git add "uniqn-mobile/app/(employer)" uniqn-mobile/src/hooks/weeklyGrid uniqn-mobile/src/lib/queryClient.ts uniqn-mobile/src/components/weeklyGrid
git commit -m "feat(salary): 지점 정산 화면 — 폴백 배지 가시화 + 탭 구제(접점 2)"
```

---

### Task 9: 통합 검증 + 리뷰 게이트

**Files:** (수정 없음 — 검증·리뷰만)

- [ ] **Step 1: 품질 파이프라인 전체**

```bash
cd uniqn-mobile && npm run quality && npx jest --silent
```
Expected: type-check/lint/format 통과 + 테스트 0 fail. knip 래칫: `npx knip` 실행해 미사용 export 증가 없는지 확인(현행 래칫 2189+α — 신규 export 는 전부 소비처 존재해야 함).

- [ ] **Step 2: 리뷰 디스패치** (메인 세션이 수행, 병렬)
  - **code-reviewer**(`model: fable`): 전체 diff — 특히 배지·재계산 경로(설계 §F 필수 게이트), AddSlotSheet 2쓰기 순서, JIT 상태 리셋 엣지.
  - **security-reviewer**(`model: fable`): Task 2 마이그 — 인가 게이트·anon REVOKE·search_path·입력 검증(50자·금액 상한·타입 화이트리스트).
  - **database-reviewer**(`model: fable`): RPC jsonb 조작·FOR UPDATE 잠금·pgTAP 커버리지.
  - 디스패치 프롬프트에 금지사항 명시: `mcp__supabase__*` 직접 호출 금지·기존 마이그레이션 수정 금지·PROD 우회 금지.

- [ ] **Step 3: CRITICAL/HIGH 이슈 수정 후 재검증** — 수정 발생 시 해당 태스크 테스트 + `npm run quality` 재실행.

- [ ] **Step 4: prod 마이그 적용(메인 세션·사용자 확인 후)** — MCP `mcp__supabase__apply_migration`으로 `20260723100000_venue_role_salary_rpc.sql` 적용. ⚠️ 적용 후 메모리에 "재적용 금지" 기록.

- [ ] **Step 5: 최종 커밋·브랜치 정리** — superpowers:finishing-a-development-branch 스킬로 머지/PR 선택지 제시(push/PR은 사용자 명시 요청 시만).

---

## Self-Review 결과 (계획 작성 시점)

- Spec §A~§F 전 항목이 Task 1~9에 매핑됨(§A→1·2·3·4, §B→5·6, §C→7, §D→8, §E→각 태스크 내 검증·클램프, §F→9).
- EditSlotSheet override는 spec대로 v1 컷 — 태스크 없음(의도).
- 실행 시 확인 필요로 명시한 지점: 형제 테스트 mock 셋업 복제(Task 3·6·7), 아이콘 실명(Task 7·8), `SettlementCard` 배럴 경로·`WorkLog` 필드명(Task 8), `db:test` 스크립트(Task 2). 이 4종은 실행자가 해당 파일을 열어 실측 후 대입한다.
