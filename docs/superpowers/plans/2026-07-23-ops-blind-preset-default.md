# ops 블라인드 기본 구조(1~30) + 프리셋 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 대회 생성 시 기본 1~30 블라인드 레벨을 자동 시드하고, 내 계정 전용 블라인드 프리셋을 저장·불러오기·삭제할 수 있게 한다.

**Architecture:** 편집·저장 하부(로컬 draft → `ops_set_blind_levels` 전체교체 RPC)는 이미 존재하므로 재사용. 신규는 ① 기본구조 상수 + 대회생성 시드 ② `ops_blind_presets`(owner RLS) 테이블 + save/delete SECDEF RPC ③ 레포·훅·UI(프리셋 바/시트). 프리셋 **적용**은 서버 불필요 — 클라가 `levels`를 draft에 로드 후 기존 저장 RPC 호출.

**Tech Stack:** Expo RN · TS strict · Supabase(Postgres + RLS + SECDEF plpgsql) · TanStack Query · Jest + pgTAP.

**설계 근거:** `docs/superpowers/specs/2026-07-23-ops-blind-preset-default-design.md` (결정 B1~B7).

## Global Constraints

- 모든 주석·커밋·문서·마이그 설명 **한글**. 코드 식별자만 원문.
- 필드명 camelCase(클라) / snake_case(DB). 경로 `@/` 절대.
- DB 접근: **Service → Repository → Supabase** 경유 필수. TanStack 읽기전용 조회만 Repository 직접 허용. Presentation/Hooks에서 Supabase 직접 호출 금지.
- 마이그레이션: 로컬 `supabase/migrations/` 파일 작성 → `npm run db:reset` + `npm run test:db` GREEN → **prod 적용은 MCP `apply_migration` 전용**(`db push` 금지). 기존 마이그 수정 금지. PROD 우회 금지. **순서 역전(선 prod) 금지** — 미검증 DDL prod 선적용 + 로컬 pgTAP 실패 이중 사고.
- **신규 SECDEF 함수는 PUBLIC/anon EXECUTE REVOKE 필수** — anon-executable ops SECDEF는 정확히 2개(monitor/player) 계약 보존. 회귀 가드 = 카탈로그 카운트 단언(=2).
- SECDEF 하드닝: `SECURITY DEFINER` + `SET search_path = public, extensions, pg_temp` + actor 바인딩(`auth.uid() IS NULL OR (auth.uid() IS DISTINCT FROM p_actor AND NOT is_admin())`) + 비즈 실패 `ERRCODE 'P0001'` + plpgsql NULL fail-open 차단.
- RLS: 신규 테이블 `ENABLE + FORCE RLS`. `is_admin()`은 `(SELECT …)` initplan 래핑.
- 착수 전 `/guard`(RLS·스키마 변경) → database-reviewer + security-reviewer 리뷰.
- 완료 주장 전 `npm run quality` + Jest/pgTAP 실행 증거. Red-Green(수정 되돌려 실패 확인)로 회귀 테스트 검증.
- 기존 `ops_set_blind_levels`(전체교체) 및 `OpsBlindLevel` 타입 **불변**.

---

### Task 1: 기본 블라인드 구조 상수(B1) + 시드 함수

**Files:**
- Create: `src/domains/ops/defaultBlindStructure.ts`
- Test: `src/domains/ops/__tests__/defaultBlindStructure.test.ts`

**Interfaces:**
- Consumes: `OpsBlindLevelInput` from `@/schemas/opsBlindLevel.schema`(:20, zod infer — 필드 6개 전부 필수: `level`,`smallBlind`,`bigBlind`,`ante`,`durationSec`,`isBreak`). ⚠️ `@/types/ops`에는 이 타입이 **없다** — 중복 타입 신설 금지.
- Produces: `DEFAULT_BLIND_LEVELS: OpsBlindLevelInput[]` (30개), `DEFAULT_LEVEL_DURATION_SEC = 1200`.

- [ ] **Step 1: 실패 테스트 작성**

```ts
// src/domains/ops/__tests__/defaultBlindStructure.test.ts
import { DEFAULT_BLIND_LEVELS } from '../defaultBlindStructure';

describe('DEFAULT_BLIND_LEVELS', () => {
  it('정확히 30레벨', () => {
    expect(DEFAULT_BLIND_LEVELS).toHaveLength(30);
  });

  it('level 1..30 연속', () => {
    DEFAULT_BLIND_LEVELS.forEach((lv, i) => expect(lv.level).toBe(i + 1));
  });

  it('사용자 확정 앞 3레벨(ante=BB)', () => {
    expect(DEFAULT_BLIND_LEVELS[0]).toMatchObject({ smallBlind: 100, bigBlind: 200, ante: 200 });
    expect(DEFAULT_BLIND_LEVELS[1]).toMatchObject({ smallBlind: 200, bigBlind: 300, ante: 300 });
    expect(DEFAULT_BLIND_LEVELS[2]).toMatchObject({ smallBlind: 200, bigBlind: 400, ante: 400 });
  });

  it('마지막 레벨 100K/200K', () => {
    expect(DEFAULT_BLIND_LEVELS[29]).toMatchObject({ smallBlind: 100000, bigBlind: 200000, ante: 200000 });
  });

  it('전 레벨 ante=BB · 20분 · 브레이크 아님(B1)', () => {
    DEFAULT_BLIND_LEVELS.forEach((lv) => {
      expect(lv.ante).toBe(lv.bigBlind);
      expect(lv.durationSec).toBe(1200);
      expect(lv.isBreak).toBe(false);
    });
  });

  it('BB 단조 증가', () => {
    for (let i = 1; i < DEFAULT_BLIND_LEVELS.length; i++) {
      expect(DEFAULT_BLIND_LEVELS[i].bigBlind).toBeGreaterThan(DEFAULT_BLIND_LEVELS[i - 1].bigBlind);
    }
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx jest src/domains/ops/__tests__/defaultBlindStructure.test.ts`
Expected: FAIL — 모듈 없음

- [ ] **Step 3: 구현 (spec §2 표 그대로)**

```ts
// src/domains/ops/defaultBlindStructure.ts
/** 기본 블라인드 구조(B1, spec §2 확정). ante=BB, 20분/레벨, 브레이크 없음. 시드·앱 기본 프리셋 단일 소스. */
import type { OpsBlindLevelInput } from '@/schemas/opsBlindLevel.schema';

export const DEFAULT_LEVEL_DURATION_SEC = 1200;

const PAIRS: readonly [sb: number, bb: number][] = [
  [100, 200], [200, 300], [200, 400], [300, 500], [300, 600],
  [400, 800], [500, 1000], [600, 1200], [800, 1500], [1000, 2000],
  [1500, 2500], [1500, 3000], [2000, 4000], [2500, 5000], [3000, 6000],
  [4000, 8000], [5000, 10000], [6000, 12000], [8000, 16000], [10000, 20000],
  [15000, 25000], [15000, 30000], [20000, 40000], [25000, 50000], [30000, 60000],
  [40000, 80000], [50000, 100000], [60000, 120000], [80000, 150000], [100000, 200000],
];

export const DEFAULT_BLIND_LEVELS: OpsBlindLevelInput[] = PAIRS.map(([sb, bb], i) => ({
  level: i + 1,
  smallBlind: sb,
  bigBlind: bb,
  ante: bb,
  durationSec: DEFAULT_LEVEL_DURATION_SEC,
  isBreak: false,
}));
```

> 검증됨(리뷰): 필드 6개는 `opsBlindLevelSchema`(`src/schemas/opsBlindLevel.schema.ts`)와 정확히 일치, `level` 포함 전부 필수.

- [ ] **Step 4: 통과 확인**

Run: `npx jest src/domains/ops/__tests__/defaultBlindStructure.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: 커밋**

```bash
git add src/domains/ops/defaultBlindStructure.ts src/domains/ops/__tests__/defaultBlindStructure.test.ts
git commit -m "feat(ops): 기본 블라인드 1~30 구조 상수(ante=BB·20분)"
```

---

### Task 2: 대회 생성 시 기본 30레벨 시드(B2-a, 클라 주도)

**Files:**
- Modify: `app/(ops)/tournaments/new.tsx` (create onSuccess에서 시드)
- Test: `app/(ops)/tournaments/__tests__/OpsTournamentCreateScreen.test.tsx` (기존 확장)

**Interfaces:**
- Consumes: `DEFAULT_BLIND_LEVELS` (Task 1), `useSetBlindLevels(tournamentId)` from `@/hooks/ops`, 기존 `useCreateOpsTournament`.

> `new.tsx:77-99`의 `createMut.mutate(..., { onSuccess: (r) => router.replace(...) })`에 시드 1콜을 끼운다. 시드 실패가 생성을 롤백하지 않도록(대회는 이미 생성됨) 실패는 toast 경고만 — 사용자는 블라인드 탭에서 수동 재설정 가능.

- [ ] **Step 1: 실패 테스트 작성**

```tsx
// 기존 OpsTournamentCreateScreen.test.tsx 에 케이스 추가
import { opsBlindLevelService } from '@/services/ops';
import { DEFAULT_BLIND_LEVELS } from '@/domains/ops/defaultBlindStructure';

it('대회 생성 성공 시 기본 30레벨 시드 호출', async () => {
  const seedSpy = jest
    .spyOn(opsBlindLevelService, 'setLevels')
    .mockResolvedValue(undefined as never);
  (useCreateOpsTournament as jest.Mock).mockReturnValue({
    mutate: (_input: unknown, opts: { onSuccess: (r: { tournamentId: string }) => void }) =>
      opts.onSuccess({ tournamentId: 't-new' }),
    isPending: false,
  });
  const { getByText, getByPlaceholderText } = render(<OpsTournamentCreateScreen />);
  fireEvent.changeText(getByPlaceholderText('예: 수요 딥스택'), '수요일 딕 야간');
  fireEvent.press(getByText('대회 만들기'));
  expect(seedSpy).toHaveBeenCalledWith('t-new', expect.any(String), DEFAULT_BLIND_LEVELS);
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx jest "app/(ops)/tournaments/__tests__/OpsTournamentCreateScreen.test.tsx" -t "시드"`
Expected: FAIL — 시드 호출 없음

- [ ] **Step 3: `new.tsx` onSuccess에 시드 추가**

기존 컴포넌트에 훅 추가 후 onSuccess 수정:

```tsx
// 상단 import
import { useSetBlindLevels } from '@/hooks/ops';
import { DEFAULT_BLIND_LEVELS } from '@/domains/ops/defaultBlindStructure';

// 컴포넌트 내부 — createMut 아래
// (setLevels 는 tournamentId 를 받아야 하므로, onSuccess 안에서 생성된 id 로 즉시 호출)
```

`createMut.mutate`의 `onSuccess`를 다음으로 교체:

```tsx
onSuccess: (r) => {
  // 기본 블라인드 30레벨 시드(B2). 실패해도 대회는 생성됨 → 경고만, 수동 재설정 가능.
  seedBlindLevels({ tournamentId: r.tournamentId, levels: DEFAULT_BLIND_LEVELS });
  router.replace(`/(ops)/tournaments/${r.tournamentId}`);
},
```

`useSetBlindLevels`가 tournamentId를 훅 인자로 받는 형태라, 생성 전 id를 모르는 문제가 있다. 두 경로 중 택1:
- **(권장)** 시드 전용 얇은 함수를 서비스에 노출: `opsBlindLevelService.setLevels(tournamentId, actorId, levels)` 직접 호출(레포 계층은 이미 존재). onSuccess에서 `await opsBlindLevelService.setLevels(r.tournamentId, actorId, DEFAULT_BLIND_LEVELS)`.
- (대안) 생성 직후 상세 화면 진입 시 "블라인드 0개면 기본 시드" 최초 1회 — 복잡, 기각.

권장안 코드:

```tsx
import { opsBlindLevelService } from '@/services/ops';
import { logger } from '@/utils/logger';
import { useToastStore } from '@/stores/toastStore'; // 프로젝트 관례(@/utils/toast 없음)
import { useAuthStore } from '@/stores/authStore'; // ops 관례: actorId = useAuthStore((s) => s.user?.uid)

// onSuccess — fire-and-forget: 시드가 내비게이션을 지연시키지 않는다.
onSuccess: (r) => {
  opsBlindLevelService.setLevels(r.tournamentId, actorId, DEFAULT_BLIND_LEVELS).catch((e) => {
    logger.error('기본 블라인드 시드 실패(수동 설정 가능)', { error: e });
    useToastStore.getState().error('기본 블라인드 설정에 실패했어요. 블라인드 탭에서 직접 설정할 수 있어요.');
  });
  router.replace(`/(ops)/tournaments/${r.tournamentId}`);
},
```

> 검증됨(리뷰): `opsBlindLevelService.setLevels(tournamentId, actorId, levels)`(`src/services/ops/opsBlindLevelService.ts:12-16`). 화면에서 서비스 직접 호출은 선례 다수(employer-register.tsx 등) — 아키텍처 위반 아님. 기존 테스트의 `jest.mock('@/hooks/ops')` 노출 목록은 구현안 확정 후 재정렬.

- [ ] **Step 4: 통과 확인**

Run: `npx jest "app/(ops)/tournaments/__tests__/OpsTournamentCreateScreen.test.tsx"`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add "app/(ops)/tournaments/new.tsx" "app/(ops)/tournaments/__tests__/OpsTournamentCreateScreen.test.tsx"
git commit -m "feat(ops): 대회 생성 시 기본 블라인드 30레벨 자동 시드"
```

---

### Task 3: `/guard` + `ops_blind_presets` 테이블 + RLS 마이그레이션(B3)

**Files:**
- Create: `supabase/migrations/<ts>_ops_blind_presets.sql` (로컬 파일 — 로컬 GREEN 후 MCP로 prod 적용)
- Test: `supabase/tests/ops_blind_presets_rls.test.sql` (pgTAP — 기존 74개 전부 `*.test.sql` 관례)

**선행:** `/guard` 실행(신규 테이블·RLS). database-reviewer로 스키마 리뷰.

- [ ] **Step 1: `/guard` 실행 + 설계 확인**

Run: `/guard` — 신규 테이블·RLS 위험 체크. anon REVOKE·FORCE RLS·owner 스코프 확인.

- [ ] **Step 2: pgTAP 회귀 테스트 먼저 작성 (RED)**

```sql
-- supabase/tests/ops_blind_presets_rls.test.sql
BEGIN;
SELECT plan(4);

-- 헬퍼로 owner A/B JWT 주입(인라인 set_config 금지 — 헬퍼 경유)
-- (프로젝트 pgTAP 헬퍼 규약 준수: wiki decisions/wallet-pgtap-caller-binding)

-- 1) 테이블 존재
SELECT has_table('public', 'ops_blind_presets', 'ops_blind_presets 테이블 존재');
-- 2) RLS 강제
SELECT is(relforcerowsecurity, true, 'FORCE RLS') FROM pg_class WHERE relname = 'ops_blind_presets';
-- 3) owner A 는 자기 프리셋 조회
-- 4) owner B 는 A 프리셋 조회 불가(0행)

SELECT * FROM finish();
ROLLBACK;
```

(3·4의 구체 시드/JWT 주입은 프로젝트 pgTAP 헬퍼 패턴을 따른다 — `supabase/tests/` 기존 파일 참조.)

- [ ] **Step 3: 마이그레이션 파일 작성(로컬)**

`supabase/migrations/<ts>_ops_blind_presets.sql`로 아래 DDL 작성. ⚠️ **MCP 선적용 금지** — MCP `apply_migration`은 원격(prod) 적용이며 로컬 마이그 파일을 만들지 않는다. 로컬 GREEN 후 Step 4에서 prod 적용:

```sql
-- ops_blind_presets: 내 계정 전용 블라인드 프리셋(B3)
CREATE TABLE public.ops_blind_presets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 60),
  levels jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ops_blind_presets_owner_name_key UNIQUE (owner_id, name)  -- 동명 갱신(upsert, spec §3.2) 지지
);
CREATE INDEX ops_blind_presets_owner_idx ON public.ops_blind_presets (owner_id, created_at DESC);

ALTER TABLE public.ops_blind_presets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ops_blind_presets FORCE ROW LEVEL SECURITY;

-- anon 표면 차단(Supabase 기본 privilege가 anon 에 테이블 GRANT — RLS 0행이어도 명시 회수)
REVOKE ALL ON TABLE public.ops_blind_presets FROM PUBLIC, anon;

-- 소유자 전용(+admin). is_admin() 은 initplan 래핑. 정책은 authenticated 한정.
CREATE POLICY ops_blind_presets_owner_all ON public.ops_blind_presets
  FOR ALL TO authenticated
  USING (owner_id = (SELECT auth.uid()) OR (SELECT public.is_admin()))
  WITH CHECK (owner_id = (SELECT auth.uid()) OR (SELECT public.is_admin()));
```

- [ ] **Step 4: 로컬 검증 → prod 적용(MCP)**

Run: `npm run db:reset && npm run test:db` (package.json:21 — 헬퍼 선주입 포함, `db:test` 아님)
Expected: `ops_blind_presets_rls.test.sql` 4/4 PASS. owner B의 A 프리셋 조회 0행.
로컬 GREEN + database-reviewer 리뷰 통과 후에만 MCP `apply_migration`으로 prod에 동일 SQL 적용.

- [ ] **Step 5: 커밋**

```bash
git add supabase/tests/ops_blind_presets_rls.test.sql supabase/migrations/<생성된_마이그>.sql
git commit -m "feat(ops): ops_blind_presets 테이블 + owner RLS(FORCE)"
```

---

### Task 4: save/delete SECDEF RPC(B6) + anon REVOKE 회귀 가드

**Files:**
- Create: `supabase/migrations/<ts>_ops_blind_preset_rpcs.sql` (로컬 파일 — 로컬 GREEN 후 MCP로 prod 적용)
- Test: `supabase/tests/ops_blind_preset_rpcs.test.sql` (pgTAP)

**Interfaces (RPC 시그니처):**
- `ops_save_blind_preset(p_actor_id uuid, p_name text, p_levels jsonb) RETURNS uuid`
- `ops_delete_blind_preset(p_actor_id uuid, p_preset_id uuid) RETURNS void`

- [ ] **Step 1: pgTAP 먼저 작성 (RED) — anon =2 계약 포함**

```sql
-- supabase/tests/ops_blind_preset_rpcs.test.sql
BEGIN;
SELECT plan(6);

-- 1) save: owner A 저장 → 행 1개, owner_id=A (JWT 주입은 헬퍼 ops_test_set_user(uuid) — 인라인 set_config 금지)
-- 2) save: 동명 재저장 → 행 수 그대로 1, levels 갱신 (upsert 검증)
-- 3) save: p_actor 위조(auth.uid()≠actor, non-admin) → P0001
-- 4) delete: owner B 가 A 프리셋 삭제 시도 → 삭제 0(RLS) 또는 P0001
-- 5) anon-executable ops SECDEF 정확히 2개 유지 — ⚠️ 기존 가드(ops_staff_security.test.sql:54-68)와
--    동일 쿼리를 복제할 것: prosecdef 필터 + 'ops\_test\_%' 헬퍼 제외 + '\_' 이스케이프.
--    셋 중 하나라도 빠지면 로컬 픽스처(ops_test_set_user 등, PUBLIC EXECUTE 기본)가 섞여 false-RED.
SELECT is(
  (SELECT count(*) FROM pg_proc p
     JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef
      AND p.proname LIKE 'ops\_%' ESCAPE '\'
      AND p.proname NOT LIKE 'ops\_test\_%' ESCAPE '\'
      AND has_function_privilege('anon', p.oid, 'EXECUTE')),
  2::bigint,
  'anon-executable ops SECDEF =2 (신규 RPC REVOKE 확인)'
);
-- 6) search_path 하드닝 확인(proconfig)
SELECT * FROM finish();
ROLLBACK;
```

- [ ] **Step 2: 실패 확인**

Run: `npm run test:db`
Expected: `ops_blind_preset_rpcs.test.sql` FAIL — 함수 없음(또는 anon 카운트 불일치)

- [ ] **Step 3: 마이그레이션 파일 작성(로컬)**

`supabase/migrations/<ts>_ops_blind_preset_rpcs.sql`:

```sql
-- 저장(신규 or 동명 갱신 — upsert). levels 는 화이트리스트 재조립.
CREATE OR REPLACE FUNCTION public.ops_save_blind_preset(
  p_actor_id uuid, p_name text, p_levels jsonb
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_id uuid;
  v_levels jsonb;
BEGIN
  -- actor 바인딩(위조 차단)
  IF auth.uid() IS NULL OR (auth.uid() IS DISTINCT FROM p_actor_id AND NOT public.is_admin()) THEN
    RAISE EXCEPTION 'actor 불일치' USING ERRCODE = 'P0001';
  END IF;
  IF p_name IS NULL OR char_length(p_name) = 0 THEN
    RAISE EXCEPTION '이름 필요' USING ERRCODE = 'P0001';
  END IF;
  -- 입력 형태 검증(기존 ops_set_blind_levels :7637-7649 미러링) — 비배열/결손/음수/0분 차단
  IF p_levels IS NULL OR jsonb_typeof(p_levels) <> 'array' THEN
    RAISE EXCEPTION 'levels 배열 필요' USING ERRCODE = 'P0001';
  END IF;
  PERFORM 1
  FROM jsonb_array_elements(p_levels) e
  WHERE (e->>'durationSec') IS NULL OR (e->>'durationSec')::int <= 0
     OR (e->>'bigBlind') IS NULL OR (e->>'bigBlind')::bigint < 0
     OR (e->>'smallBlind') IS NULL OR (e->>'smallBlind')::bigint < 0
     OR (e->>'ante') IS NULL OR (e->>'ante')::bigint < 0;
  IF FOUND THEN
    RAISE EXCEPTION '레벨 값 불량' USING ERRCODE = 'P0001';
  END IF;

  -- 화이트리스트 재조립(임의 필드 유입 차단)
  SELECT jsonb_agg(jsonb_build_object(
    'level', (e->>'level')::int,
    'smallBlind', (e->>'smallBlind')::bigint,
    'bigBlind', (e->>'bigBlind')::bigint,
    'ante', (e->>'ante')::bigint,
    'durationSec', (e->>'durationSec')::int,
    'isBreak', (e->>'isBreak')::boolean
  )) INTO v_levels
  FROM jsonb_array_elements(p_levels) e;

  INSERT INTO public.ops_blind_presets (owner_id, name, levels)
  VALUES (p_actor_id, p_name, COALESCE(v_levels, '[]'::jsonb))
  ON CONFLICT (owner_id, name)                    -- spec §3.2 "동명 갱신"(upsert)
  DO UPDATE SET levels = EXCLUDED.levels, updated_at = now()
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.ops_delete_blind_preset(
  p_actor_id uuid, p_preset_id uuid
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NULL OR (auth.uid() IS DISTINCT FROM p_actor_id AND NOT public.is_admin()) THEN
    RAISE EXCEPTION 'actor 불일치' USING ERRCODE = 'P0001';
  END IF;
  DELETE FROM public.ops_blind_presets
   WHERE id = p_preset_id AND owner_id = p_actor_id;
END;
$$;

-- anon 계약 보존 — 신규 함수 PUBLIC/anon EXECUTE 회수 필수
REVOKE ALL ON FUNCTION public.ops_save_blind_preset(uuid, text, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.ops_delete_blind_preset(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ops_save_blind_preset(uuid, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ops_delete_blind_preset(uuid, uuid) TO authenticated;
```

- [ ] **Step 4: 로컬 검증 → security-reviewer → prod 적용(MCP)**

Run: `npm run db:reset && npm run test:db`
Expected: `ops_blind_preset_rpcs.test.sql` 6/6 PASS (특히 anon =2 유지·upsert).
로컬 GREEN + security-reviewer 리뷰 통과 후에만 MCP `apply_migration`으로 prod에 동일 SQL 적용.

- [ ] **Step 5: 커밋**

```bash
git add supabase/tests/ops_blind_preset_rpcs.test.sql supabase/migrations/<생성된_마이그>.sql
git commit -m "feat(ops): 블라인드 프리셋 save/delete SECDEF RPC + anon REVOKE 가드"
```

---

### Task 5: 레포·서비스·훅 (조회/저장/삭제)

**Files:**
- Create: `src/repositories/supabase/OpsBlindPresetRepository.ts`
- Modify: `src/repositories/ops.ts` (싱글톤 배럴 :53-66 — `ops/index.ts` 아님. interface 생략은 OpsStaffRepository 선례 :38 허용)
- Create: `src/services/ops/opsBlindPresetService.ts` (또는 기존 서비스 확장)
- Create: `src/hooks/ops/useOpsBlindPresets.ts`
- Modify: `src/hooks/ops/index.ts`
- Test: `src/hooks/ops/__tests__/useOpsBlindPresets.test.tsx`

**Interfaces:**
- `OpsBlindPreset { id: string; ownerId: string; name: string; levels: OpsBlindLevelInput[]; createdAt: string }`
- Repo: `listMine(): Promise<OpsBlindPreset[]>`, `save(actorId, name, levels): Promise<string>`, `remove(actorId, presetId): Promise<void>`.
- Hooks: `useOpsBlindPresets()` → `{ presets, isLoading }`; `useSaveBlindPreset()` / `useDeleteBlindPreset()` → mutation.

- [ ] **Step 1: 훅 테스트 작성 (RED)**

```tsx
// src/hooks/ops/__tests__/useOpsBlindPresets.test.tsx
import { renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { opsBlindPresetRepository } from '@/repositories/ops';
import { useOpsBlindPresets } from '../useOpsBlindPresets';

jest.mock('@/repositories/ops', () => ({
  opsBlindPresetRepository: { listMine: jest.fn() },
}));

const wrapper = ({ children }: { children: React.ReactNode }) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
};

it('내 프리셋 목록 조회', async () => {
  (opsBlindPresetRepository.listMine as jest.Mock).mockResolvedValue([
    { id: 'x', ownerId: 'A', name: '기본 30레벨', levels: [], createdAt: '2026-07-23' },
  ]);
  const { result } = renderHook(() => useOpsBlindPresets(), { wrapper });
  await waitFor(() => expect(result.current.presets).toHaveLength(1));
  expect(result.current.presets[0].name).toBe('기본 30레벨');
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx jest src/hooks/ops/__tests__/useOpsBlindPresets.test.tsx`
Expected: FAIL — 모듈 없음

- [ ] **Step 3: 레포 구현** (기존 `OpsBlindLevelRepository` 패턴 복제)

```ts
// src/repositories/supabase/OpsBlindPresetRepository.ts
import { supabase } from '@/lib/supabase';
import type { OpsBlindPreset } from '@/types/ops';

export class SupabaseOpsBlindPresetRepository {
  async listMine(): Promise<OpsBlindPreset[]> {
    const { data, error } = await supabase
      .from('ops_blind_presets')
      .select('id, owner_id, name, levels, created_at')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []).map((r) => ({
      id: r.id, ownerId: r.owner_id, name: r.name,
      levels: r.levels ?? [], createdAt: r.created_at,
    }));
  }
  async save(actorId: string, name: string, levels: unknown): Promise<string> {
    const { data, error } = await supabase.rpc('ops_save_blind_preset', {
      p_actor_id: actorId, p_name: name, p_levels: levels,
    });
    if (error) throw error;
    return data as string;
  }
  async remove(actorId: string, presetId: string): Promise<void> {
    const { error } = await supabase.rpc('ops_delete_blind_preset', {
      p_actor_id: actorId, p_preset_id: presetId,
    });
    if (error) throw error;
  }
}
```

- [ ] **Step 4: 훅 구현 + 타입 추가**

`src/types/ops.ts`에 `OpsBlindPreset` 추가. 훅:

```ts
// src/hooks/ops/useOpsBlindPresets.ts
import { useQuery } from '@tanstack/react-query';
import { opsBlindPresetRepository } from '@/repositories/ops';

export function useOpsBlindPresets() {
  const query = useQuery({
    queryKey: ['ops', 'blindPresets'],
    queryFn: () => opsBlindPresetRepository.listMine(),
  });
  return { presets: query.data ?? [], isLoading: query.isLoading };
}
```

서비스는 입력 검증 담당(시스템 경계 규칙 — name은 자유 텍스트 사용자 입력):

```ts
// src/services/ops/opsBlindPresetService.ts
import { z } from 'zod';
import { xssValidation } from '@/utils/security';
import { opsBlindLevelsSchema } from '@/schemas/opsBlindLevel.schema';
import { opsBlindPresetRepository } from '@/repositories/ops';

const presetNameSchema = z.string().trim().min(1).max(60).refine(xssValidation);

export const opsBlindPresetService = {
  save(actorId: string, name: string, levels: unknown) {
    return opsBlindPresetRepository.save(
      actorId,
      presetNameSchema.parse(name),
      opsBlindLevelsSchema.parse(levels)
    );
  },
  remove(actorId: string, presetId: string) {
    return opsBlindPresetRepository.remove(actorId, presetId);
  },
};
```

> `xssValidation`(`src/utils/security.ts:263`)·levels 스키마의 정확한 export 명은 해당 파일에서 확인해 맞춘다.

(save/delete 뮤테이션 훅 `useSaveBlindPreset`/`useDeleteBlindPreset`는 `useOpsMutations` 패턴으로 추가 — **서비스 경유**, `onSuccess`에서 `['ops','blindPresets']` invalidate + toast.)

- [ ] **Step 5: 배럴 등록 + 통과 확인**

Run: `npx jest src/hooks/ops/__tests__/useOpsBlindPresets.test.tsx && npm run quality`
Expected: PASS, quality exit 0

- [ ] **Step 6: 커밋**

```bash
git add src/repositories/supabase/OpsBlindPresetRepository.ts src/repositories/ops.ts src/services/ops/ src/hooks/ops/useOpsBlindPresets.ts src/hooks/ops/index.ts src/types/ops.ts src/hooks/ops/__tests__/useOpsBlindPresets.test.tsx
git commit -m "feat(ops): 블라인드 프리셋 레포·서비스·훅"
```

---

### Task 6: 프리셋 바/시트 UI + BlindLevelsTab 배선(B4·B5·B7)

**Files:**
- Create: `src/components/ops/BlindPresetSheet.tsx`
- Modify: `src/components/ops/BlindLevelsTab.tsx` (상단 프리셋 바 + 시트)
- Modify: `src/components/ops/index.ts`
- Test: `src/components/ops/__tests__/BlindPresetSheet.test.tsx`

**Interfaces:**
- Consumes: `useOpsBlindPresets`, `useSaveBlindPreset`, `useDeleteBlindPreset`, `DEFAULT_BLIND_LEVELS`.
- Produces: `BlindPresetSheet({ visible, onClose, currentLevels, onApply })` — 앱 기본(기본30) + 내 프리셋 목록. 항목 탭 = `onApply(levels)`(전체교체 확인, B5). "현재 구조 저장" → 이름 입력 → save.

- [ ] **Step 1: 실패 테스트 작성**

```tsx
// src/components/ops/__tests__/BlindPresetSheet.test.tsx
import { render, fireEvent } from '@testing-library/react-native';
import { useOpsBlindPresets, useSaveBlindPreset, useDeleteBlindPreset } from '@/hooks/ops';
import { BlindPresetSheet } from '../BlindPresetSheet';

jest.mock('@/hooks/ops', () => ({
  useOpsBlindPresets: jest.fn(() => ({ presets: [], isLoading: false })),
  useSaveBlindPreset: jest.fn(() => ({ mutate: jest.fn() })),
  useDeleteBlindPreset: jest.fn(() => ({ mutate: jest.fn() })),
}));

it('앱 기본 프리셋(기본 30레벨) 항상 노출', () => {
  const { getByText } = render(
    <BlindPresetSheet visible onClose={jest.fn()} currentLevels={[]} onApply={jest.fn()} />
  );
  expect(getByText('기본 30레벨')).toBeTruthy();
});

it('프리셋 적용 → 확인 후 onApply(levels)', () => {
  const onApply = jest.fn();
  jest.spyOn(require('@/utils/confirmAction'), 'confirmAction').mockImplementation((o: any) => o.onConfirm());
  const { getByText } = render(
    <BlindPresetSheet visible onClose={jest.fn()} currentLevels={[]} onApply={onApply} />
  );
  fireEvent.press(getByText('기본 30레벨'));
  expect(onApply).toHaveBeenCalled();
  expect(onApply.mock.calls[0][0]).toHaveLength(30); // 기본 30레벨 적용
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx jest src/components/ops/__tests__/BlindPresetSheet.test.tsx`
Expected: FAIL — 모듈 없음

- [ ] **Step 3: `BlindPresetSheet` 구현**

```tsx
// src/components/ops/BlindPresetSheet.tsx
/** 블라인드 프리셋 시트(B4·B5). 앱 기본 + 내 저장 목록. 적용=전체교체 확인. */
import { Pressable, Text, View } from 'react-native';
import { SheetModal } from '@/components/ui';
import { confirmAction } from '@/utils/confirmAction';
import { useOpsBlindPresets, useDeleteBlindPreset } from '@/hooks/ops';
import { DEFAULT_BLIND_LEVELS } from '@/domains/ops/defaultBlindStructure';
import type { OpsBlindLevelInput } from '@/schemas/opsBlindLevel.schema';

interface BlindPresetSheetProps {
  visible: boolean;
  onClose: () => void;
  currentLevels: OpsBlindLevelInput[];
  onApply: (levels: OpsBlindLevelInput[]) => void;
}

const APP_PRESETS: { name: string; levels: OpsBlindLevelInput[] }[] = [
  { name: '기본 30레벨', levels: DEFAULT_BLIND_LEVELS },
];

export function BlindPresetSheet({ visible, onClose, currentLevels, onApply }: BlindPresetSheetProps) {
  const { presets } = useOpsBlindPresets();
  const deleteMut = useDeleteBlindPreset();

  const apply = (name: string, levels: OpsBlindLevelInput[]) => {
    confirmAction({
      title: '프리셋 적용',
      message: `현재 블라인드 구조를 "${name}"(으)로 교체할까요?\n기존 편집 내용은 사라집니다.`,
      confirmText: '교체',
      destructive: true,
      onConfirm: () => { onApply(levels); onClose(); },
    });
  };

  const Row = ({ name, levels, onDelete }: { name: string; levels: OpsBlindLevelInput[]; onDelete?: () => void }) => (
    <Pressable
      onPress={() => apply(name, levels)}
      accessibilityRole="button"
      className="min-h-[44px] flex-row items-center justify-between border-b border-gray-200 px-4 py-3 active:bg-gray-50 dark:border-gray-700 dark:active:bg-gray-800"
    >
      <Text className="text-content-primary dark:text-off-white">{name}</Text>
      <View className="flex-row items-center gap-3">
        <Text className="text-xs text-secondary-500 dark:text-secondary-400">{levels.length}레벨</Text>
        {onDelete && (
          <Pressable onPress={onDelete} hitSlop={10} accessibilityRole="button" accessibilityLabel="프리셋 삭제">
            <Text className="text-xs text-error-600 dark:text-error-400">삭제</Text>
          </Pressable>
        )}
      </View>
    </Pressable>
  );

  return (
    <SheetModal visible={visible} onClose={onClose} title="블라인드 프리셋">
      <View>
        {APP_PRESETS.map((p) => <Row key={p.name} name={p.name} levels={p.levels} />)}
        {presets.map((p) => (
          <Row
            key={p.id}
            name={p.name}
            levels={p.levels}
            onDelete={() =>
              confirmAction({
                title: '프리셋 삭제',
                message: `"${p.name}" 프리셋을 삭제할까요?`,
                confirmText: '삭제',
                destructive: true,
                onConfirm: () => deleteMut.mutate(p.id),
              })
            }
          />
        ))}
      </View>
    </SheetModal>
  );
}
```

> "현재 구조 저장": 프로젝트에 입력 다이얼로그 유틸이 **없다**(confirmAction/showAlert뿐) — 시트 하단에 `TextInput`(이름) + 저장 버튼을 직접 배치하고 `useSaveBlindPreset`(서비스 경유 zod+XSS 검증) 호출. 프리셋 바의 "프리셋 · <이름>" 표시는 마지막 적용 프리셋명을 로컬 state로 추적하고, 이후 draft 편집(dirty) 발생 시 "사용자 정의"로 표시.

- [ ] **Step 4: 통과 확인**

Run: `npx jest src/components/ops/__tests__/BlindPresetSheet.test.tsx`
Expected: PASS (2 tests)

- [ ] **Step 5: `BlindLevelsTab` 배선 — 프리셋 바**

`BlindLevelsTab.tsx` 상단에 프리셋 바(`프리셋 · <이름> ▾` + `구조 저장`) 추가. `▾` → `BlindPresetSheet` open. `onApply(levels)` → 로컬 `draft` 교체 + **`setDirty(true)` 필수**(`BlindLevelsTab.tsx:75` 저장 버튼 활성 조건이 dirty — 누락 시 적용해도 저장 버튼 비활성) → 사용자가 기존 "블라인드 구조 저장" 버튼으로 `ops_set_blind_levels` 커밋(B5·B6). 저장(save preset)은 현재 draft를 `useSaveBlindPreset`으로.

- [ ] **Step 6: 배럴 + 전체 검증**

```ts
export { BlindPresetSheet } from './BlindPresetSheet';
```

Run: `npx jest src/components/ops/__tests__/ && npm run quality`
Expected: 관련 스위트 PASS, quality exit 0

- [ ] **Step 7: 커밋**

```bash
git add src/components/ops/BlindPresetSheet.tsx src/components/ops/BlindLevelsTab.tsx src/components/ops/index.ts src/components/ops/__tests__/BlindPresetSheet.test.tsx
git commit -m "feat(ops): 블라인드 프리셋 바/시트 + 탭 배선(적용=전체교체 확인)"
```

---

## Self-Review 결과 (작성자 점검)

- **Spec 커버리지**: B1(상수 T1)·B2(시드 T2)·B3(테이블·RLS T3)·B4(앱기본+커스텀 T6)·B5(적용=전체교체 확인 T6)·B6(신규 RPC 분리 T4·기존 저장 재사용 T2/T6)·B7(편집 자유도 — 기존 draft 유지 T6) 전부 태스크 존재.
- **Placeholder 스캔**: 없음. 단, T2·T5·T6에 "프로젝트 유틸/훅 실제 시그니처 확인" 주의 노트(actorId 소스·서비스 배럴·입력 다이얼로그) — 실행 시 코드 확인 필요 지점을 명시적으로 표기(placeholder 아님, 검증 지시).
- **타입 일관성**: `OpsBlindLevelInput`(T1 소비) · `OpsBlindPreset`(T5 정의, T6 소비) 일관. RPC 인자명 `p_actor_id`/`p_name`/`p_levels`/`p_preset_id` T4↔T5 일치.
- **보안 회귀 가드**: anon-executable ops SECDEF =2 단언을 T4 pgTAP에 포함(신규 RPC REVOKE 누락 = 즉시 RED).

## 실행 순서 의존성

T1 → T2(T1 소비). T3 → T4(T3 테이블 소비) → T5(T4 RPC 소비) → T6(T5 훅·T1 상수 소비). T1·T3는 상호 독립 병렬 가능. **T3·T4는 /guard·DB 리뷰 게이트 통과 후 진행.**

## 리뷰 반영 이력 (2026-07-23 fable 검증 리뷰 — 판정 "수정 후 실행" → 반영 완료)

- **HIGH 5건**: ① `OpsBlindLevelInput` import를 `@/schemas/opsBlindLevel.schema`로 고정(types/ops 중복 신설 차단) ② anon =2 가드 쿼리를 기존 가드(ops_staff_security.test.sql:54-68) 복제로 교체(prosecdef·`ops\_test\_%` 제외·이스케이프 — false-RED 차단) ③ save upsert(`UNIQUE(owner_id,name)` + `ON CONFLICT DO UPDATE`) ④ 마이그 순서를 로컬 파일→`db:reset`+`test:db` GREEN→MCP prod 적용으로 교정(선 prod 금지) ⑤ 프리셋 name zod+xssValidation 서비스 계층 명세.
- **MEDIUM**: toast→`useToastStore` 관례·`confirmAction`=`@/utils/confirmAction`·actorId=`useAuthStore`·배럴=`src/repositories/ops.ts`·삭제 UI 배선(Row onDelete)·이름 입력=시트 내 TextInput 직접·RPC 입력 검증(비배열/결손/음수/0분 P0001)·T2 테스트 placeholder 실문구화.
- **LOW**: pgTAP 파일명 `*.test.sql`·실행 `npm run test:db`·시드 fire-and-forget+`logger.error`·테이블 anon REVOKE+`TO authenticated`·onApply 시 `setDirty(true)`.
