# 배정 2종 (랜덤 / 칩 드래프트 전원 재배치) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** active+checked_in 참가자를 현재 열린 좌석 풀에 전원 재배치하는 두 알고리즘(랜덤·칩 드래프트)을, 클라 순수함수 미리보기 + 서버 확정 RPC(TOCTOU)로 구현한다.

**Architecture:** 순수 도메인 함수 3종(seatWithinTable/randomDraw/chipDraft)이 배정을 계산→RedrawModal 미리보기→`ops_reseat_participants` SECDEF RPC가 advisory→대회→참가자→좌석 락순서로 "전원 비우기→앉히기"(partial UNIQUE 회피) 원자 적용. 1a~1d 출하 패턴 재사용, 신규 테이블/트리거 0.

**Tech Stack:** Expo/RN, TypeScript strict, Supabase(plpgsql SECDEF), pgTAP, Jest, Zod, TanStack Query, NativeWind.

## Global Constraints

- 언어: 모든 주석·커밋·문서 **한글**(기술 식별자 제외). 작업 디렉토리 `uniqn-mobile/`.
- 아키텍처: Presentation→Hooks→Service→Repository→Supabase. Presentation/Hooks에서 Supabase 직접호출 금지.
- 쓰기 RPC: `LANGUAGE plpgsql SECURITY DEFINER SET search_path='public','extensions','pg_temp'`. 모든 비즈니스 거부 `RAISE ... USING ERRCODE='P0001'`, 메시지 `PREFIX: 한글`. anon REVOKE(monitor/player 2개만 anon-executable).
- 불변: 좌석 단일점유 partial UNIQUE `uniq_ops_seats_participant`. 잠금 순서 `advisory→대회→참가자(id asc)→좌석(id asc)`(1d 통일). 적격 테이블 `status='open' AND lock_type='none'`.
- 순수함수: 부수효과 0, `Math.random` 직접호출 금지(RNG 주입). `@/` 절대경로. logger.info(`console.log` 금지).
- 마이그: 신규 파일만(기존 수정 금지). MCP `apply_migration`은 **prod 전용·SDD 서브에이전트 절대 금지**. 로컬 검증=`npm run db:reset && npm run test:db:helpers && npx supabase test db`(reset이 ops_helpers 소거→재적재 필수).
- 브랜치: implementer는 **브랜치 생성/전환 금지**, `feat/ops-seat-assignment`에만 커밋.
- 에러코드 신규: `OPS_SEAT_ASSIGNMENT_INVALID='E6129'`·`OPS_INSUFFICIENT_SEATS='E6130'`·`OPS_INVALID_REDRAW_MODE='E6131'`(E6128=1d last_survivor 다음).
- 스펙 권위: `docs/superpowers/specs/2026-06-30-ops-seat-assignment-design.md`. 충돌 시 스펙 우선.

---

## 파일 구조 (생성/수정)

**생성:**

- `src/domains/ops/seatAssignment/reseat.types.ts` — 공유 타입(ReseatInput/SeatAssignment/ReseatResult).
- `src/domains/ops/seatAssignment/seatWithinTable.ts` — 공유 stage2(players↔seats 랜덤 매칭) + `shuffleInPlace`.
- `src/domains/ops/seatAssignment/randomDraw.ts` — 균일 랜덤 배정.
- `src/domains/ops/seatAssignment/chipDraft.ts` — 칩 스네이크 + 랜덤 좌석.
- `src/domains/ops/seatAssignment/__tests__/seatWithinTable.test.ts`
- `src/domains/ops/seatAssignment/__tests__/randomDraw.test.ts`
- `src/domains/ops/seatAssignment/__tests__/chipDraft.test.ts`
- `supabase/migrations/20260630160000_ops_seat_assignment_reseat_rpc.sql`
- `supabase/migrations/20260630160100_ops_seat_assignment_grants.sql`
- `supabase/tests/ops_reseat_participants.test.sql`
- `src/errors/__tests__/opsRpcError.reseat.test.ts`(또는 기존 opsRpcError.test.ts에 추가)

**수정:**

- `src/domains/ops/seatAssignment/index.ts` — 배럴에 신규 export 추가.
- `src/errors/AppError.ts` — E6129~E6131 코드+한글 메시지.
- `src/errors/opsRpcError.ts` — PREFIX_MAP에 `SEAT_ASSIGNMENT_INVALID`·`INVALID_REDRAW_MODE`(구체 토큰 우선).
- `src/schemas/opsSeat.schema.ts` — `reseatAssignmentsSchema`·`reseatModeSchema`.
- `src/repositories/supabase/OpsSeatRepository.ts` — `reseatParticipants`.
- `src/services/ops/opsSeatService.ts` — `reseatParticipants` 위임.
- `src/hooks/ops/useOpsMutations.ts` — `useReseatParticipants`.
- `src/components/ops/TablesTab.tsx` + `src/components/ops/RedrawModal.tsx` — 모드 선택(빈자리채움/랜덤/칩드래프트).

> ⚠️ 정확한 기존 파일 경로/줄번호는 implementer가 grep으로 확인(정찰 매핑 근거: `OpsSeatRepository.ts:30-92`, `useOpsMutations.ts:251-319`, `opsSeat.schema.ts:31-43`, `TablesTab.tsx:184-188/298`, `RedrawModal.tsx:45-62`, `AppError.ts:175-204`, `opsRpcError.ts:13-110`).

---

## Task 1: 공유 타입 + seatWithinTable (순수 stage2)

**Files:**

- Create: `src/domains/ops/seatAssignment/reseat.types.ts`
- Create: `src/domains/ops/seatAssignment/seatWithinTable.ts`
- Test: `src/domains/ops/seatAssignment/__tests__/seatWithinTable.test.ts`

**Interfaces:**

- Produces: `ReseatTable`,`ReseatSeat`,`ReseatPlayer`,`ReseatInput`,`SeatAssignment`,`ReseatResult` 타입 · `shuffleInPlace<T>(arr: T[], rng: () => number): void` · `seatWithinTable(players: ReseatPlayer[], seats: ReseatSeat[], rng: () => number): SeatAssignment[]`.

- [ ] **Step 1: 타입 작성** — `reseat.types.ts`

```ts
import type { OpsTableStatus, OpsTableLockType } from '@/types/ops'; // 기존 enum 타입 위치는 grep 확인; 없으면 string 리터럴 유니온 사용

export interface ReseatTable {
  id: string;
  status: OpsTableStatus; // 'open' | 'closed' | 'standby'
  lockType: OpsTableLockType; // 'none' | 'locked' | 'feature'
}
export interface ReseatSeat {
  id: string;
  tableId: string;
  tableNo: number;
  seatNo: number;
  participantId: string | null;
}
export interface ReseatPlayer {
  id: string;
  chips: number;
}
export interface ReseatInput {
  tables: ReseatTable[];
  seats: ReseatSeat[];
  players: ReseatPlayer[];
  rng: () => number; // [0,1)
}
export interface SeatAssignment {
  participantId: string;
  seatId: string;
}
export type ReseatResult =
  | { ok: true; assignments: SeatAssignment[] }
  | { ok: false; reason: 'INSUFFICIENT_SEATS'; available: number; required: number };
```

- [ ] **Step 2: 실패 테스트 작성** — `__tests__/seatWithinTable.test.ts`

```ts
import { seatWithinTable, shuffleInPlace } from '../seatWithinTable';
import type { ReseatSeat, ReseatPlayer } from '../reseat.types';

// 결정적 rng: 시드 시퀀스 반환(테스트 재현)
function seqRng(seq: number[]): () => number {
  let i = 0;
  return () => seq[i++ % seq.length];
}

const seat = (id: string, seatNo: number): ReseatSeat => ({
  id,
  tableId: 't1',
  tableNo: 1,
  seatNo,
  participantId: null,
});
const player = (id: string): ReseatPlayer => ({ id, chips: 1000 });

describe('seatWithinTable', () => {
  it('각 플레이어를 좌석에 1:1 배정한다', () => {
    const players = [player('p1'), player('p2'), player('p3')];
    const seats = [seat('s1', 1), seat('s2', 2), seat('s3', 3)];
    const res = seatWithinTable(players, seats, seqRng([0, 0, 0]));
    expect(res).toHaveLength(3);
    const pids = res.map((a) => a.participantId).sort();
    expect(pids).toEqual(['p1', 'p2', 'p3']);
    const sids = res.map((a) => a.seatId).sort();
    expect(sids).toEqual(['s1', 's2', 's3']); // 모든 좌석 distinct 사용
  });

  it('좌석이 더 많으면 앞에서부터 채우고 나머지는 빈다', () => {
    const players = [player('p1')];
    const seats = [seat('s1', 1), seat('s2', 2)];
    const res = seatWithinTable(players, seats, seqRng([0]));
    expect(res).toHaveLength(1);
    expect(res[0].participantId).toBe('p1');
  });

  it('rng 시퀀스가 같으면 결과가 동일하다(결정성)', () => {
    const players = [player('p1'), player('p2')];
    const seats = [seat('s1', 1), seat('s2', 2)];
    const a = seatWithinTable(players, seats, seqRng([0.9, 0.1]));
    const b = seatWithinTable(players, seats, seqRng([0.9, 0.1]));
    expect(a).toEqual(b);
  });
});
```

- [ ] **Step 3: 테스트 실패 확인** — Run: `npx jest src/domains/ops/seatAssignment/__tests__/seatWithinTable.test.ts` · Expected: FAIL("Cannot find module '../seatWithinTable'").

- [ ] **Step 4: 구현 작성** — `seatWithinTable.ts`

```ts
import type { ReseatPlayer, ReseatSeat, SeatAssignment } from './reseat.types';

/** Fisher-Yates in-place 셔플(주입 rng). */
export function shuffleInPlace<T>(arr: T[], rng: () => number): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

/**
 * 주어진 players를 주어진 seats에 랜덤 1:1 배정.
 * seats를 seatNo 안정정렬 후 셔플 → players를 앞에서부터 매칭.
 * players.length <= seats.length 전제(호출부가 capacity 보장).
 */
export function seatWithinTable(
  players: ReseatPlayer[],
  seats: ReseatSeat[],
  rng: () => number
): SeatAssignment[] {
  const ordered = [...seats].sort((a, b) => a.tableNo - b.tableNo || a.seatNo - b.seatNo);
  shuffleInPlace(ordered, rng);
  return players.map((p, i) => ({ participantId: p.id, seatId: ordered[i].id }));
}
```

- [ ] **Step 5: 테스트 통과 확인** — Run: `npx jest src/domains/ops/seatAssignment/__tests__/seatWithinTable.test.ts` · Expected: PASS(3 tests).

- [ ] **Step 6: 커밋**

```bash
git add src/domains/ops/seatAssignment/reseat.types.ts src/domains/ops/seatAssignment/seatWithinTable.ts src/domains/ops/seatAssignment/__tests__/seatWithinTable.test.ts
git commit -m "feat(ops): 배정 공유 타입 + seatWithinTable 순수 함수(랜덤 좌석 매칭)"
```

---

## Task 2: randomDraw (균일 랜덤 배정)

**Files:**

- Create: `src/domains/ops/seatAssignment/randomDraw.ts`
- Test: `src/domains/ops/seatAssignment/__tests__/randomDraw.test.ts`

**Interfaces:**

- Consumes: `ReseatInput`,`ReseatResult`,`seatWithinTable` (Task 1).
- Produces: `randomDraw(input: ReseatInput): ReseatResult` · `eligibleSeats(input: ReseatInput): ReseatSeat[]`(export, chipDraft도 사용).

- [ ] **Step 1: 실패 테스트 작성** — `__tests__/randomDraw.test.ts`

```ts
import { randomDraw, eligibleSeats } from '../randomDraw';
import type { ReseatInput, ReseatTable, ReseatSeat, ReseatPlayer } from '../reseat.types';

function seqRng(seq: number[]): () => number {
  let i = 0;
  return () => seq[i++ % seq.length];
}
const tbl = (
  id: string,
  status: ReseatTable['status'] = 'open',
  lockType: ReseatTable['lockType'] = 'none'
): ReseatTable => ({ id, status, lockType });
const seat = (
  id: string,
  tableId: string,
  tableNo: number,
  seatNo: number,
  pid: string | null = null
): ReseatSeat => ({ id, tableId, tableNo, seatNo, participantId: pid });
const player = (id: string): ReseatPlayer => ({ id, chips: 1000 });

describe('eligibleSeats', () => {
  it('open·unlocked 테이블 좌석만 적격', () => {
    const input: ReseatInput = {
      tables: [tbl('t1'), tbl('t2', 'closed'), tbl('t3', 'open', 'locked'), tbl('t4', 'standby')],
      seats: [
        seat('s1', 't1', 1, 1),
        seat('s2', 't2', 2, 1),
        seat('s3', 't3', 3, 1),
        seat('s4', 't4', 4, 1),
      ],
      players: [],
      rng: seqRng([0]),
    };
    expect(eligibleSeats(input).map((s) => s.id)).toEqual(['s1']);
  });
});

describe('randomDraw', () => {
  it('전원을 적격 좌석에 배정(좌석≥인원)', () => {
    const input: ReseatInput = {
      tables: [tbl('t1'), tbl('t2')],
      seats: [seat('s1', 't1', 1, 1), seat('s2', 't1', 1, 2), seat('s3', 't2', 2, 1)],
      players: [player('p1'), player('p2')],
      rng: seqRng([0.5, 0.5, 0.5]),
    };
    const res = randomDraw(input);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.assignments).toHaveLength(2);
      expect(new Set(res.assignments.map((a) => a.seatId)).size).toBe(2); // 좌석 distinct
      expect(res.assignments.map((a) => a.participantId).sort()).toEqual(['p1', 'p2']);
      // 적격 좌석(s1,s2,s3)에만 배정
      res.assignments.forEach((a) => expect(['s1', 's2', 's3']).toContain(a.seatId));
    }
  });

  it('인원>적격좌석이면 INSUFFICIENT_SEATS', () => {
    const input: ReseatInput = {
      tables: [tbl('t1')],
      seats: [seat('s1', 't1', 1, 1)],
      players: [player('p1'), player('p2')],
      rng: seqRng([0]),
    };
    const res = randomDraw(input);
    expect(res).toEqual({ ok: false, reason: 'INSUFFICIENT_SEATS', available: 1, required: 2 });
  });

  it('잠긴/닫힌 테이블 좌석엔 배정 안 함', () => {
    const input: ReseatInput = {
      tables: [tbl('t1'), tbl('t2', 'open', 'locked')],
      seats: [seat('s1', 't1', 1, 1), seat('s2', 't2', 2, 1)],
      players: [player('p1')],
      rng: seqRng([0]),
    };
    const res = randomDraw(input);
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.assignments[0].seatId).toBe('s1');
  });
});
```

- [ ] **Step 2: 테스트 실패 확인** — Run: `npx jest src/domains/ops/seatAssignment/__tests__/randomDraw.test.ts` · Expected: FAIL(module 없음).

- [ ] **Step 3: 구현 작성** — `randomDraw.ts`

```ts
import type { ReseatInput, ReseatResult, ReseatSeat } from './reseat.types';
import { seatWithinTable } from './seatWithinTable';

/** open·unlocked 테이블에 속한 좌석만 적격(점유/빈 무관 — 전원 재배치). */
export function eligibleSeats(input: ReseatInput): ReseatSeat[] {
  const okTables = new Set(
    input.tables.filter((t) => t.status === 'open' && t.lockType === 'none').map((t) => t.id)
  );
  return input.seats.filter((s) => okTables.has(s.tableId));
}

export function randomDraw(input: ReseatInput): ReseatResult {
  const seats = eligibleSeats(input);
  if (input.players.length > seats.length) {
    return {
      ok: false,
      reason: 'INSUFFICIENT_SEATS',
      available: seats.length,
      required: input.players.length,
    };
  }
  return { ok: true, assignments: seatWithinTable(input.players, seats, input.rng) };
}
```

- [ ] **Step 4: 테스트 통과 확인** — Run: `npx jest src/domains/ops/seatAssignment/__tests__/randomDraw.test.ts` · Expected: PASS.

- [ ] **Step 5: 커밋**

```bash
git add src/domains/ops/seatAssignment/randomDraw.ts src/domains/ops/seatAssignment/__tests__/randomDraw.test.ts
git commit -m "feat(ops): randomDraw 균일 랜덤 배정 + eligibleSeats(적격 좌석 필터)"
```

---

## Task 3: chipDraft (칩 스네이크 + 랜덤 좌석)

**Files:**

- Create: `src/domains/ops/seatAssignment/chipDraft.ts`
- Test: `src/domains/ops/seatAssignment/__tests__/chipDraft.test.ts`

**Interfaces:**

- Consumes: `ReseatInput`,`ReseatResult`,`eligibleSeats`(Task 2),`seatWithinTable`(Task 1).
- Produces: `chipDraft(input: ReseatInput): ReseatResult`.

- [ ] **Step 1: 실패 테스트 작성** — `__tests__/chipDraft.test.ts`

```ts
import { chipDraft } from '../chipDraft';
import type { ReseatInput, ReseatTable, ReseatSeat, ReseatPlayer } from '../reseat.types';

function seqRng(seq: number[]): () => number {
  let i = 0;
  return () => seq[i++ % seq.length];
}
const tbl = (id: string): ReseatTable => ({ id, status: 'open', lockType: 'none' });
const seat = (id: string, tableId: string, tableNo: number, seatNo: number): ReseatSeat => ({
  id,
  tableId,
  tableNo,
  seatNo,
  participantId: null,
});
const player = (id: string, chips: number): ReseatPlayer => ({ id, chips });

// 칩 합 계산 헬퍼: 배정 결과 → 테이블별 칩 합
function tableChipTotals(
  input: ReseatInput,
  assignments: { participantId: string; seatId: string }[]
): number[] {
  const seatToTable = new Map(input.seats.map((s) => [s.id, s.tableId]));
  const chips = new Map(input.players.map((p) => [p.id, p.chips]));
  const totals = new Map<string, number>();
  for (const a of assignments) {
    const t = seatToTable.get(a.seatId)!;
    totals.set(t, (totals.get(t) ?? 0) + (chips.get(a.participantId) ?? 0));
  }
  return [...totals.values()];
}

describe('chipDraft', () => {
  it('스네이크로 테이블 칩 합을 균형있게 분배', () => {
    // 2테이블 각 2석, 4명(칩 4000/3000/2000/1000) → 스네이크: t1[4000,1000]=5000, t2[3000,2000]=5000
    const input: ReseatInput = {
      tables: [tbl('t1'), tbl('t2')],
      seats: [
        seat('s1', 't1', 1, 1),
        seat('s2', 't1', 1, 2),
        seat('s3', 't2', 2, 1),
        seat('s4', 't2', 2, 2),
      ],
      players: [player('a', 4000), player('b', 3000), player('c', 2000), player('d', 1000)],
      rng: seqRng([0, 0, 0, 0]),
    };
    const res = chipDraft(input);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.assignments).toHaveLength(4);
      const totals = tableChipTotals(input, res.assignments).sort((x, y) => x - y);
      expect(totals).toEqual([5000, 5000]); // 완전 균형
    }
  });

  it('칩 동점은 id 오름차순 tie-break(결정성)', () => {
    const input: ReseatInput = {
      tables: [tbl('t1'), tbl('t2')],
      seats: [seat('s1', 't1', 1, 1), seat('s2', 't2', 2, 1)],
      players: [player('z', 1000), player('a', 1000)],
      rng: seqRng([0, 0]),
    };
    const r1 = chipDraft(input);
    const r2 = chipDraft({ ...input, rng: seqRng([0, 0]) });
    expect(r1).toEqual(r2);
  });

  it('인원>적격좌석이면 INSUFFICIENT_SEATS', () => {
    const input: ReseatInput = {
      tables: [tbl('t1')],
      seats: [seat('s1', 't1', 1, 1)],
      players: [player('a', 1000), player('b', 500)],
      rng: seqRng([0]),
    };
    expect(chipDraft(input)).toEqual({
      ok: false,
      reason: 'INSUFFICIENT_SEATS',
      available: 1,
      required: 2,
    });
  });

  it('전원 distinct 좌석 배정', () => {
    const input: ReseatInput = {
      tables: [tbl('t1'), tbl('t2')],
      seats: [seat('s1', 't1', 1, 1), seat('s2', 't1', 1, 2), seat('s3', 't2', 2, 1)],
      players: [player('a', 3000), player('b', 2000), player('c', 1000)],
      rng: seqRng([0.4, 0.4, 0.4]),
    };
    const res = chipDraft(input);
    expect(res.ok).toBe(true);
    if (res.ok) expect(new Set(res.assignments.map((a) => a.seatId)).size).toBe(3);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인** — Run: `npx jest src/domains/ops/seatAssignment/__tests__/chipDraft.test.ts` · Expected: FAIL(module 없음).

- [ ] **Step 3: 구현 작성** — `chipDraft.ts`

```ts
import type { ReseatInput, ReseatResult, ReseatSeat, SeatAssignment } from './reseat.types';
import { eligibleSeats } from './randomDraw';
import { seatWithinTable } from './seatWithinTable';

/**
 * 1단계: chips 내림차순(동점 id asc) 정렬 → 적격 테이블에 스네이크 분배(capacity=빈 적격좌석 수, 찬 테이블 스킵).
 * 2단계: 각 테이블 버킷 → seatWithinTable(랜덤 좌석).
 */
export function chipDraft(input: ReseatInput): ReseatResult {
  const seats = eligibleSeats(input);
  if (input.players.length > seats.length) {
    return {
      ok: false,
      reason: 'INSUFFICIENT_SEATS',
      available: seats.length,
      required: input.players.length,
    };
  }

  // 테이블별 적격 좌석 그룹(tableNo asc 안정 순서)
  const seatsByTable = new Map<string, ReseatSeat[]>();
  const tableOrder: string[] = [];
  for (const s of [...seats].sort((a, b) => a.tableNo - b.tableNo || a.seatNo - b.seatNo)) {
    if (!seatsByTable.has(s.tableId)) {
      seatsByTable.set(s.tableId, []);
      tableOrder.push(s.tableId);
    }
    seatsByTable.get(s.tableId)!.push(s);
  }

  // 1단계: 스네이크 버킷
  const sorted = [...input.players].sort(
    (a, b) => b.chips - a.chips || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  );
  const buckets = new Map<string, typeof sorted>(tableOrder.map((t) => [t, []]));
  const capacity = new Map(tableOrder.map((t) => [t, seatsByTable.get(t)!.length]));
  let dir = 1;
  let idx = 0;
  for (const p of sorted) {
    // capacity 남은 테이블을 만날 때까지 스네이크 진행
    let guard = 0;
    while (buckets.get(tableOrder[idx])!.length >= capacity.get(tableOrder[idx])!) {
      idx += dir;
      if (idx >= tableOrder.length) {
        dir = -1;
        idx = tableOrder.length - 1;
      } else if (idx < 0) {
        dir = 1;
        idx = 0;
      }
      if (++guard > tableOrder.length * 2) break; // 모든 테이블 만석 방어(capacity 사전검증으로 도달 불가)
    }
    buckets.get(tableOrder[idx])!.push(p);
    // 다음 플레이어를 위해 한 칸 진행(스네이크)
    idx += dir;
    if (idx >= tableOrder.length) {
      dir = -1;
      idx = tableOrder.length - 1;
    } else if (idx < 0) {
      dir = 1;
      idx = 0;
    }
  }

  // 2단계: 테이블 내 랜덤 좌석
  const assignments: SeatAssignment[] = [];
  for (const t of tableOrder) {
    const bp = buckets.get(t)!;
    if (bp.length === 0) continue;
    assignments.push(...seatWithinTable(bp, seatsByTable.get(t)!, input.rng));
  }
  return { ok: true, assignments };
}
```

> ⚠️ implementer 주의: 스네이크 인덱스 진행 로직은 위 테스트(완전 균형 5000/5000)를 반드시 통과해야 한다. capacity 스킵이 균형을 약간 무너뜨릴 수 있으나 테스트는 균등 capacity 케이스. 비균등 capacity는 "찬 테이블 스킵"으로 처리(테스트 4가 distinct 보장). 통과 안 하면 스네이크 진행/스킵 순서를 재점검.

- [ ] **Step 4: 테스트 통과 확인** — Run: `npx jest src/domains/ops/seatAssignment/__tests__/chipDraft.test.ts` · Expected: PASS(4 tests).

- [ ] **Step 5: 커밋**

```bash
git add src/domains/ops/seatAssignment/chipDraft.ts src/domains/ops/seatAssignment/__tests__/chipDraft.test.ts
git commit -m "feat(ops): chipDraft 칩 스네이크 버킷 + 랜덤 좌석 배정"
```

---

## Task 4: 배럴 export + 에러코드

**Files:**

- Modify: `src/domains/ops/seatAssignment/index.ts`
- Modify: `src/errors/AppError.ts`
- Modify: `src/errors/opsRpcError.ts`
- Test: `src/errors/__tests__/opsRpcError.reseat.test.ts`(또는 기존 opsRpcError 테스트 파일에 describe 추가)

**Interfaces:**

- Produces: 배럴에서 `randomDraw`,`chipDraft`,`seatWithinTable`,`eligibleSeats`,타입 re-export. AppError 코드 `OPS_SEAT_ASSIGNMENT_INVALID`/`OPS_INSUFFICIENT_SEATS`/`OPS_INVALID_REDRAW_MODE`. opsRpcError가 `SEAT_ASSIGNMENT_INVALID`·`INVALID_REDRAW_MODE` prefix 매핑.

- [ ] **Step 1: 배럴 수정** — `index.ts`에 추가(기존 `computeWaitlistFill` export 유지)

```ts
export * from './reseat.types';
export { seatWithinTable, shuffleInPlace } from './seatWithinTable';
export { randomDraw, eligibleSeats } from './randomDraw';
export { chipDraft } from './chipDraft';
```

- [ ] **Step 2: 실패 테스트 작성** — `__tests__/opsRpcError.reseat.test.ts`

```ts
import { mapOpsRpcError } from '@/errors/opsRpcError';

describe('opsRpcError — 배정 신규 prefix', () => {
  it('SEAT_ASSIGNMENT_INVALID → E6129', () => {
    const e = mapOpsRpcError({
      message: 'SEAT_ASSIGNMENT_INVALID: 좌석 배정 정보가 올바르지 않아요.',
    } as any);
    expect(e.code).toBe('E6129');
  });
  it('INVALID_REDRAW_MODE → E6131', () => {
    const e = mapOpsRpcError({
      message: 'INVALID_REDRAW_MODE: 지원하지 않는 배정 방식이에요.',
    } as any);
    expect(e.code).toBe('E6131');
  });
  it('SEAT_ASSIGNMENT_INVALID가 SEAT_TAKEN/SEAT_VERSION_CONFLICT보다 우선 매칭', () => {
    // 부분문자열 충돌 회귀: 'SEAT_ASSIGNMENT_INVALID'는 'SEAT_'로 시작하지만 전용 코드여야 함
    const e = mapOpsRpcError({ message: 'SEAT_ASSIGNMENT_INVALID: x' } as any);
    expect(e.code).toBe('E6129');
    expect(e.code).not.toBe('E6106'); // SEAT_TAKEN 아님
  });
});
```

- [ ] **Step 3: 테스트 실패 확인** — Run: `npx jest src/errors/__tests__/opsRpcError.reseat.test.ts` · Expected: FAIL(E6129 미정의 → 폴백 코드 반환).

- [ ] **Step 4: AppError 코드 추가** — `AppError.ts` ops 범위(E6128 다음)에 추가. 기존 패턴(예: `OPS_PARTICIPANT_LAST_SURVIVOR` 정의 형태)을 grep으로 확인 후 동일 형식:

```ts
// (ops 에러코드 블록 내, E6128 다음)
OPS_SEAT_ASSIGNMENT_INVALID: 'E6129',
OPS_INSUFFICIENT_SEATS: 'E6130',
OPS_INVALID_REDRAW_MODE: 'E6131',
```

그리고 한글 메시지 맵(기존 코드→메시지 구조와 동일 위치):

```ts
// E6129: '좌석 배정 정보가 올바르지 않아요.'
// E6130: '빈 좌석이 부족해 전원을 앉힐 수 없어요.'
// E6131: '지원하지 않는 배정 방식이에요.'
```

- [ ] **Step 5: opsRpcError PREFIX_MAP 추가** — `opsRpcError.ts` PREFIX_MAP에 추가. **`SEAT_ASSIGNMENT_INVALID`를 `SEAT_TAKEN`/`SEAT_VERSION_CONFLICT`보다 앞**(includes 부분일치라 구체 토큰 우선). `INVALID_REDRAW_MODE`는 충돌 없음.

```ts
// PREFIX_MAP 배열 상단부(SEAT_ 계열보다 앞)에:
['SEAT_ASSIGNMENT_INVALID', 'OPS_SEAT_ASSIGNMENT_INVALID'],
['INVALID_REDRAW_MODE', 'OPS_INVALID_REDRAW_MODE'],
// (INSUFFICIENT_SEATS는 RPC가 raise 안 함 — 클라 순수함수 신호라 PREFIX_MAP 등록 불요)
```

- [ ] **Step 6: 테스트 통과 + 전체 회귀** — Run: `npx jest src/errors src/domains/ops/seatAssignment` · Expected: PASS(신규+기존 opsRpcError 회귀 0).

- [ ] **Step 7: 커밋**

```bash
git add src/domains/ops/seatAssignment/index.ts src/errors/AppError.ts src/errors/opsRpcError.ts src/errors/__tests__/opsRpcError.reseat.test.ts
git commit -m "feat(ops): 배정 배럴 export + 에러코드 E6129~E6131(배정무효/좌석부족/모드무효)"
```

---

## Task 5: 확정 RPC 마이그레이션 `ops_reseat_participants`

**Files:**

- Create: `supabase/migrations/20260630160000_ops_seat_assignment_reseat_rpc.sql`

**Interfaces:**

- Produces: `ops_reseat_participants(p_tournament_id uuid, p_actor_id uuid, p_assignments jsonb, p_mode text) RETURNS jsonb` — `{moved, seated, mode}`.

- [ ] **Step 1: 기존 RPC 골격 확인** — `supabase/migrations/20260625130100_ops_1b_seat_rpcs.sql`의 `ops_redraw_waitlist_fill`(:268-343)·`ops_move_seat`(:183-236) 락순서/가드 관용구, `20260630120100_ops_1d_bust_reenter_prize_rpcs.sql`의 advisory 락+참가자 FOR UPDATE 패턴을 읽어 동일 스타일 차용.

- [ ] **Step 2: 마이그 작성** — 전체 RPC. ⚠️기존 마이그 수정 금지, 신규 파일만.

```sql
-- 배정 2종 확정 RPC: 전원 재배치(랜덤/칩 드래프트 공통 적용기)
-- 잠금 순서: advisory(대회) → 대회 FOR UPDATE → 참가자 FOR UPDATE(id asc) → 좌석 FOR UPDATE(id asc)
CREATE OR REPLACE FUNCTION public.ops_reseat_participants(
  p_tournament_id uuid,
  p_actor_id uuid,
  p_assignments jsonb,
  p_mode text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'extensions', 'pg_temp'
AS $$
DECLARE
  v_pids uuid[];
  v_seat_ids uuid[];
  v_n int;
  v_t_status text;
  v_moved int := 0;
  v_seated int := 0;
  r record;
BEGIN
  -- 1. actor 가드
  IF auth.uid() IS NULL OR (auth.uid() IS DISTINCT FROM p_actor_id AND NOT public.is_admin()) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 권한이 없어요.' USING ERRCODE = 'P0001';
  END IF;

  -- 2. mode 검증
  IF p_mode IS NULL OR p_mode NOT IN ('random_draw', 'chip_draft') THEN
    RAISE EXCEPTION 'INVALID_REDRAW_MODE: 지원하지 않는 배정 방식이에요.' USING ERRCODE = 'P0001';
  END IF;

  -- 3. assignments 파싱·구조 검증
  IF p_assignments IS NULL OR jsonb_typeof(p_assignments) <> 'array' OR jsonb_array_length(p_assignments) = 0 THEN
    RAISE EXCEPTION 'SEAT_ASSIGNMENT_INVALID: 좌석 배정 정보가 올바르지 않아요.' USING ERRCODE = 'P0001';
  END IF;
  SELECT array_agg((e->>'participant_id')::uuid), array_agg((e->>'seat_id')::uuid)
    INTO v_pids, v_seat_ids
    FROM jsonb_array_elements(p_assignments) e;
  IF array_position(v_pids, NULL) IS NOT NULL OR array_position(v_seat_ids, NULL) IS NOT NULL THEN
    RAISE EXCEPTION 'SEAT_ASSIGNMENT_INVALID: 좌석 배정 정보가 올바르지 않아요.' USING ERRCODE = 'P0001';
  END IF;
  v_n := array_length(v_pids, 1);
  -- 참가자/좌석 중복 금지
  IF (SELECT count(DISTINCT x) FROM unnest(v_pids) x) <> v_n
     OR (SELECT count(DISTINCT x) FROM unnest(v_seat_ids) x) <> v_n THEN
    RAISE EXCEPTION 'SEAT_ASSIGNMENT_INVALID: 좌석 배정 정보가 올바르지 않아요.' USING ERRCODE = 'P0001';
  END IF;

  -- 4. advisory → 대회 FOR UPDATE → 멤버십
  PERFORM pg_advisory_xact_lock(hashtext('ops_tournament_' || p_tournament_id::text)::bigint);
  SELECT status INTO v_t_status FROM public.ops_tournaments WHERE id = p_tournament_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'TOURNAMENT_NOT_FOUND: 대회를 찾을 수 없어요.' USING ERRCODE = 'P0001';
  END IF;
  IF v_t_status = 'completed' THEN
    RAISE EXCEPTION 'INVALID_STATUS: 종료된 대회는 재배치할 수 없어요.' USING ERRCODE = 'P0001';
  END IF;
  IF NOT (public.is_ops_member(p_tournament_id, p_actor_id) OR public.is_admin()) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 권한이 없어요.' USING ERRCODE = 'P0001';
  END IF;

  -- 5. 참가자 잠금·가드(id asc)
  PERFORM 1 FROM public.ops_participants
    WHERE tournament_id = p_tournament_id AND id = ANY(v_pids)
    ORDER BY id FOR UPDATE;
  IF (SELECT count(*) FROM public.ops_participants WHERE tournament_id = p_tournament_id AND id = ANY(v_pids)) <> v_n THEN
    RAISE EXCEPTION 'PARTICIPANT_NOT_FOUND: 참가자를 찾을 수 없어요.' USING ERRCODE = 'P0001';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.ops_participants
    WHERE tournament_id = p_tournament_id AND id = ANY(v_pids) AND status NOT IN ('active', 'checked_in')
  ) THEN
    RAISE EXCEPTION 'PARTICIPANT_NOT_ACTIVE: 활성/대기 상태 참가자만 배정할 수 있어요.' USING ERRCODE = 'P0001';
  END IF;

  -- 6. 좌석 잠금(id asc): 목표 좌석 ∪ 풀 플레이어 현재 좌석
  PERFORM 1 FROM public.ops_seats
    WHERE tournament_id = p_tournament_id AND (id = ANY(v_seat_ids) OR participant_id = ANY(v_pids))
    ORDER BY id FOR UPDATE;

  -- 7. 목표 좌석 가드: 존재·동일대회·적격 테이블·외부인 미점유
  FOR r IN SELECT unnest(v_seat_ids) AS seat_id LOOP
    PERFORM 1 FROM public.ops_seats s JOIN public.ops_tables t ON t.id = s.table_id
      WHERE s.id = r.seat_id AND s.tournament_id = p_tournament_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'SEAT_ASSIGNMENT_INVALID: 좌석 배정 정보가 올바르지 않아요.' USING ERRCODE = 'P0001';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.ops_seats s JOIN public.ops_tables t ON t.id = s.table_id
      WHERE s.id = r.seat_id AND t.status = 'open' AND t.lock_type = 'none'
    ) THEN
      RAISE EXCEPTION 'TABLE_NOT_OPEN: 닫혔거나 잠긴 테이블에는 배정할 수 없어요.' USING ERRCODE = 'P0001';
    END IF;
    -- 외부인(풀에 없는 참가자) 동시 착석 → TOCTOU 충돌
    IF EXISTS (
      SELECT 1 FROM public.ops_seats s
      WHERE s.id = r.seat_id AND s.participant_id IS NOT NULL AND NOT (s.participant_id = ANY(v_pids))
    ) THEN
      RAISE EXCEPTION 'SEAT_VERSION_CONFLICT: 좌석 상태가 바뀌었어요. 다시 계산해 주세요.' USING ERRCODE = 'P0001';
    END IF;
  END LOOP;

  -- 9. 전원 비우기(풀 플레이어 현재 좌석 vacate) — moved 계산용 현재 점유 집계
  SELECT count(*) INTO v_moved FROM public.ops_seats
    WHERE tournament_id = p_tournament_id AND participant_id = ANY(v_pids);
  UPDATE public.ops_seats SET participant_id = NULL
    WHERE tournament_id = p_tournament_id AND participant_id = ANY(v_pids);

  -- 10. 목표 앉히기
  FOR r IN SELECT (e->>'participant_id')::uuid AS pid, (e->>'seat_id')::uuid AS sid
           FROM jsonb_array_elements(p_assignments) e LOOP
    UPDATE public.ops_seats SET participant_id = r.pid WHERE id = r.sid;
  END LOOP;
  -- moved = 좌석 점유가 실제로 바뀐 수(전부 비우고 다시 앉혔으므로 배정 수 기준)
  v_moved := v_n;

  -- 11. checked_in → active 승급
  WITH upd AS (
    UPDATE public.ops_participants SET status = 'active'
    WHERE tournament_id = p_tournament_id AND id = ANY(v_pids) AND status = 'checked_in'
    RETURNING 1
  )
  SELECT count(*) INTO v_seated FROM upd;

  -- 12. 이벤트
  INSERT INTO public.ops_events (tournament_id, actor_id, event_type, payload)
  VALUES (p_tournament_id, p_actor_id, 'table_redraw',
          jsonb_build_object('mode', p_mode, 'moved', v_moved, 'seated', v_seated));

  -- 13. 반환
  RETURN jsonb_build_object('moved', v_moved, 'seated', v_seated, 'mode', p_mode);
END;
$$;
```

> ⚠️ implementer 검증 포인트(코드 대조): ①`ops_events` 컬럼명(actor_id/event_type/payload)·`is_ops_member`/`is_admin` 시그니처를 기존 1b/1d RPC와 grep 대조(불일치 시 기존 본문 따름). ②`ops_tournaments.status` enum 값 확인 — `completed`만 거부, 그 외 허용. 만약 enum에 'completed' 외 종료성 값이 더 있으면 스펙대로 'completed'만 명시 거부(나머지 허용). ③`moved`는 비우기 전 점유 수가 아니라 배정 수(v_n)로 단순화(스펙 §4.3-12 의도=좌석 점유 변경 수, 전원 재배치라 = 배정 수). ④P0001 메시지 PREFIX는 PREFIX_MAP과 정확히 일치해야 함.

- [ ] **Step 3: 로컬 적용·스모크** — Run: `npm run db:reset && npm run test:db:helpers` 후 psql로 함수 존재 확인:

```bash
npx supabase db reset
# 또는 npm run db:reset
```

Expected: 마이그 에러 0, `ops_reseat_participants` 생성됨(pgTAP는 Task 7).

- [ ] **Step 4: 커밋**

```bash
git add supabase/migrations/20260630160000_ops_seat_assignment_reseat_rpc.sql
git commit -m "feat(ops): ops_reseat_participants 확정 RPC(전원 비우기→앉히기·TOCTOU·락순서)"
```

---

## Task 6: grants 마이그레이션

**Files:**

- Create: `supabase/migrations/20260630160100_ops_seat_assignment_grants.sql`

- [ ] **Step 1: 작성** — 1a/1b/1d grants DO 루프 패턴 동일(`20260630120200_ops_1d_grants.sql` 참조).

```sql
-- ops_reseat_participants grants: anon REVOKE, authenticated/service_role GRANT
DO $$
DECLARE
  fn text := 'public.ops_reseat_participants(uuid, uuid, jsonb, text)';
BEGIN
  EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', fn);
  EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', fn);
END $$;
```

- [ ] **Step 2: 로컬 적용 + grant 확인** — Run: `npm run db:reset && npm run test:db:helpers` 후

```bash
# anon이 EXECUTE 못하는지 확인(psql)
# SELECT has_function_privilege('anon', 'public.ops_reseat_participants(uuid,uuid,jsonb,text)', 'EXECUTE'); → f
```

Expected: anon=false, authenticated=true.

- [ ] **Step 3: 커밋**

```bash
git add supabase/migrations/20260630160100_ops_seat_assignment_grants.sql
git commit -m "feat(ops): ops_reseat_participants grants(anon REVOKE·authenticated GRANT)"
```

---

## Task 7: pgTAP 테스트 `ops_reseat_participants.test.sql`

**Files:**

- Create: `supabase/tests/ops_reseat_participants.test.sql`

**Interfaces:**

- Consumes: `ops_reseat_participants`(Task 5). 시드 헬퍼 `ops_test_seed`/`ops_test_seed_players`(1d 추가분 — 없으면 postgres role 직접 INSERT).

- [ ] **Step 1: 헬퍼 확인** — `supabase/tests/` 기존 ops pgTAP(`ops_redraw_toctou.test.sql`·1d `ops_bust_participant.test.sql`)에서 시드 패턴·`ops_test_seed_players(t_id, n)` 존재 여부 확인. 없으면 테스트 내 postgres role로 `ops_tournaments`/`ops_tables`/`ops_seats`/`ops_participants` 직접 INSERT.

- [ ] **Step 2: 테스트 작성** — 단일 txn BEGIN/plan/finish/ROLLBACK. 시나리오(스펙 §8.1):

```sql
BEGIN;
SELECT plan(13);
-- (시드: 1대회·2테이블(open·none)·각 2좌석·참가자 active/checked_in 다수. 기존 ops pgTAP 시드 관용구 복제)

-- 1. 랜덤: 전원 1좌석 배정(중복 좌석 0)
-- 2. 칩 스네이크: 테이블 칩합 균형
-- 3. 전 순열 재배치 → 23505 미발생(lives_ok)
-- 4. checked_in→active 승급
-- 5. 동시 bust 참가자 섞임 → PARTICIPANT_NOT_ACTIVE (throws_like)
-- 6. 외부인 점유 목표좌석 → SEAT_VERSION_CONFLICT (throws_like)
-- 7. 인원>좌석 배정 직접 호출 시 좌석 부족(클라 차단이나, 잘못된 배정=중복좌석 등은 SEAT_ASSIGNMENT_INVALID)
-- 8. closed/standby/locked 목표 → TABLE_NOT_OPEN (throws_like)
-- 9. actor 위조/비멤버 → PERMISSION_DENIED (throws_like) x2
-- 10. completed 대회 → INVALID_STATUS (throws_like)
-- 11. 중복 참가자/좌석·빈 배정 → SEAT_ASSIGNMENT_INVALID (throws_like)
-- 12. live_stats playing/total_chips 재배치 후 정합
-- 13. 이벤트 table_redraw {mode} 1행 append

SELECT finish();
ROLLBACK;
```

> implementer: 위 주석을 실제 `is(...)`/`throws_like(...)`/`lives_ok(...)` 단언으로 채운다. 시드/단언 형태는 `ops_redraw_toctou.test.sql`(stale→conflict, locked→TABLE_NOT_OPEN, cross-tenant)·1d `ops_bust_participant.test.sql`(actor 가드·live_stats 정합·이벤트 append) 패턴을 그대로 복제. RPC 호출은 `SELECT public.ops_reseat_participants(...)`. plan(N) 수는 실제 단언 수와 일치.

- [ ] **Step 3: RED-GREEN 검증** — Run(전체 DB 테스트 하니스):

```bash
npm run db:reset && npm run test:db:helpers && npx supabase test db
```

Expected: `ops_reseat_participants.test.sql` ok(전 단언 PASS), 기존 ops pgTAP 회귀 0(1a~1d·redraw). RED-GREEN: 전순열(테스트3)·TOCTOU(5/6)는 RPC 로직 의존이라 RPC 버그 시 FAIL해야 함(헬퍼로 사전 확인).

- [ ] **Step 4: 커밋**

```bash
git add supabase/tests/ops_reseat_participants.test.sql
git commit -m "test(ops): ops_reseat_participants pgTAP(전순열·TOCTOU·적격성·승급·이벤트 13단언)"
```

---

## Task 8: Zod 스키마

**Files:**

- Modify: `src/schemas/opsSeat.schema.ts`
- Test: 기존 `opsSeat.schema` 테스트 파일 또는 신규 `__tests__`

**Interfaces:**

- Produces: `reseatModeSchema`(`z.enum(['random_draw','chip_draft'])`), `reseatAssignmentsSchema`(`z.array(z.object({participantId, seatId})).min(1)` + 중복 refine).

- [ ] **Step 1: 실패 테스트 작성**

```ts
import { reseatAssignmentsSchema, reseatModeSchema } from '@/schemas/opsSeat.schema';

describe('reseat 스키마', () => {
  const a = (pid: string, sid: string) => ({ participantId: pid, seatId: sid });
  it('정상 배정 통과', () => {
    expect(
      reseatAssignmentsSchema.safeParse([
        a('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222'),
      ]).success
    ).toBe(true);
  });
  it('빈 배열 거부', () => {
    expect(reseatAssignmentsSchema.safeParse([]).success).toBe(false);
  });
  it('참가자 중복 거부', () => {
    const p = '11111111-1111-1111-1111-111111111111';
    expect(
      reseatAssignmentsSchema.safeParse([
        a(p, '22222222-2222-2222-2222-222222222222'),
        a(p, '33333333-3333-3333-3333-333333333333'),
      ]).success
    ).toBe(false);
  });
  it('좌석 중복 거부', () => {
    const s = '22222222-2222-2222-2222-222222222222';
    expect(
      reseatAssignmentsSchema.safeParse([
        a('11111111-1111-1111-1111-111111111111', s),
        a('44444444-4444-4444-4444-444444444444', s),
      ]).success
    ).toBe(false);
  });
  it('mode enum', () => {
    expect(reseatModeSchema.safeParse('random_draw').success).toBe(true);
    expect(reseatModeSchema.safeParse('chip_draft').success).toBe(true);
    expect(reseatModeSchema.safeParse('bogus').success).toBe(false);
  });
});
```

- [ ] **Step 2: 실패 확인** — Run: `npx jest src/schemas` (해당 테스트) · Expected: FAIL(export 없음).

- [ ] **Step 3: 구현** — `opsSeat.schema.ts`에 추가(기존 `redrawWaitlistFillSchema` 옆)

```ts
export const reseatModeSchema = z.enum(['random_draw', 'chip_draft']);

export const reseatAssignmentsSchema = z
  .array(z.object({ participantId: z.string().uuid(), seatId: z.string().uuid() }))
  .min(1)
  .refine((arr) => new Set(arr.map((x) => x.participantId)).size === arr.length, {
    message: '참가자가 중복됐어요.',
  })
  .refine((arr) => new Set(arr.map((x) => x.seatId)).size === arr.length, {
    message: '좌석이 중복됐어요.',
  });
```

- [ ] **Step 4: 통과 확인** — Run: `npx jest src/schemas` · Expected: PASS.

- [ ] **Step 5: 커밋**

```bash
git add src/schemas/opsSeat.schema.ts src/schemas/**/*.test.ts
git commit -m "feat(ops): reseat Zod 스키마(배정 중복 refine·모드 enum)"
```

---

## Task 9: Repository + Service

**Files:**

- Modify: `src/repositories/supabase/OpsSeatRepository.ts`
- Modify: `src/services/ops/opsSeatService.ts`

**Interfaces:**

- Consumes: `SeatAssignment`(Task1), `reseatModeSchema`(Task8), `mapOpsRpcError`(Task4).
- Produces: `OpsSeatRepository.reseatParticipants(tournamentId: string, actorId: string, assignments: SeatAssignment[], mode: 'random_draw'|'chip_draft'): Promise<{ moved: number; seated: number; mode: string }>` · `opsSeatService.reseatParticipants(...)` 동일 시그니처.

- [ ] **Step 1: Repository 메서드 추가** — 기존 `redrawWaitlistFill`(:80-92) 패턴 미러. snake_case 인자 매핑·snake→camel 반환 수동.

```ts
async reseatParticipants(
  tournamentId: string,
  actorId: string,
  assignments: { participantId: string; seatId: string }[],
  mode: 'random_draw' | 'chip_draft',
): Promise<{ moved: number; seated: number; mode: string }> {
  const { data, error } = await this.supabase.rpc('ops_reseat_participants', {
    p_tournament_id: tournamentId,
    p_actor_id: actorId,
    p_assignments: assignments.map((a) => ({ participant_id: a.participantId, seat_id: a.seatId })),
    p_mode: mode,
  });
  if (error) throw mapOpsRpcError(error);
  const row = data as { moved: number; seated: number; mode: string };
  return { moved: row.moved, seated: row.seated, mode: row.mode };
}
```

> ⚠️ `IOpsSeatRepository` 인터페이스에도 시그니처 추가. `supabase.rpc` 타입이 stale하면 1d처럼 `as never`/`as unknown` 캐스트(주석으로 "supabase.ts 수술적 정합은 prod 게이트 후" 명시).

- [ ] **Step 2: Service 위임 추가** — `opsSeatService.ts`(기존 `redrawWaitlistFill` 위임 미러 + `handleServiceError`).

```ts
async reseatParticipants(tournamentId, actorId, assignments, mode) {
  try {
    return await this.repository.reseatParticipants(tournamentId, actorId, assignments, mode);
  } catch (error) {
    throw handleServiceError(error, 'opsSeatService.reseatParticipants');
  }
}
```

- [ ] **Step 3: 타입체크** — Run: `npx tsc --noEmit` · Expected: 0 errors(stale supabase.ts 캐스트 처리 시).

- [ ] **Step 4: 커밋**

```bash
git add src/repositories/supabase/OpsSeatRepository.ts src/services/ops/opsSeatService.ts
git commit -m "feat(ops): reseatParticipants repository+service(RPC 호출·snake/camel 매핑)"
```

---

## Task 10: Hook `useReseatParticipants`

**Files:**

- Modify: `src/hooks/ops/useOpsMutations.ts`

**Interfaces:**

- Consumes: `opsSeatService.reseatParticipants`(Task9), `queryKeys.ops`(기존).
- Produces: `useReseatParticipants()` mutation hook.

- [ ] **Step 1: 훅 추가** — 기존 `useRedrawWaitlistFill`(:~251-319) 패턴 미러. onSuccess 무효화 = seats/participants/liveStats + 결과 토스트.

```ts
export function useReseatParticipants() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (v: {
      tournamentId: string;
      actorId: string;
      assignments: { participantId: string; seatId: string }[];
      mode: 'random_draw' | 'chip_draft';
    }) => opsSeatService.reseatParticipants(v.tournamentId, v.actorId, v.assignments, v.mode),
    onSuccess: (res, v) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.ops.seats(v.tournamentId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.ops.participants(v.tournamentId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.ops.liveStats(v.tournamentId) });
      toast.success(`${res.moved}명 재배치 완료`);
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });
}
```

> ⚠️ `queryKeys.ops.seats/participants/liveStats` 정확한 호출 형태·`toast`/`getErrorMessage` import는 기존 훅에서 grep 확인.

- [ ] **Step 2: 타입체크** — Run: `npx tsc --noEmit` · Expected: 0 errors.

- [ ] **Step 3: 커밋**

```bash
git add src/hooks/ops/useOpsMutations.ts
git commit -m "feat(ops): useReseatParticipants 훅(seats/participants/liveStats 무효화)"
```

---

## Task 11: UI — TABLES 탭 모드 선택 + RedrawModal 확장

**Files:**

- Modify: `src/components/ops/RedrawModal.tsx`
- Modify: `src/components/ops/TablesTab.tsx`

**Interfaces:**

- Consumes: `randomDraw`/`chipDraft`/`computeWaitlistFill`(도메인), `useReseatParticipants`(Task10), `useRedrawWaitlistFill`(기존).

- [ ] **Step 1: RedrawModal에 모드 prop 추가** — 기존 미리보기(before→after)·"다시 계산"·"확인" 구조 유지. `mode: 'waitlist_fill' | 'random_draw' | 'chip_draft'` prop. mode에 따라 배정 계산 함수 분기:
  - `waitlist_fill` → 기존 `computeWaitlistFill`(빈자리만, `reseatMut` 아님 기존 `redrawMut`).
  - `random_draw`/`chip_draft` → `randomDraw`/`chipDraft`(active+checked_in 풀, RNG=`Math.random` 주입), 결과 `ok:false`(INSUFFICIENT_SEATS)면 "빈 좌석 부족"(E6130 메시지) 안내+확인 비활성. `ok:true`면 미리보기 후 "확인"=`reseatMut.mutate({tournamentId, actorId, assignments, mode})`.

```tsx
// 풀 구성(active+checked_in), RNG 주입
const rng = () => Math.random();
const input: ReseatInput = {
  tables: tables.map((t) => ({ id: t.id, status: t.status, lockType: t.lockType })),
  seats: seats.map((s) => ({
    id: s.id,
    tableId: s.tableId,
    tableNo: s.tableNo,
    seatNo: s.seatNo,
    participantId: s.participantId,
  })),
  players: participants
    .filter((p) => p.status === 'active' || p.status === 'checked_in')
    .map((p) => ({ id: p.id, chips: p.chips })),
  rng,
};
const result = mode === 'random_draw' ? randomDraw(input) : chipDraft(input);
```

- [ ] **Step 2: TablesTab Redraw 버튼 → 모드 선택** — 기존 Redraw 버튼(:298 `setShowRedraw(true)`)을 SelectBottomSheet 또는 3버튼(빈자리 채움/랜덤 배정/칩 드래프트)으로. 선택 시 해당 mode로 RedrawModal 오픈. 파괴적(전원 재배치) 모드는 확인 다이얼로그(impeccable 룰11/12). dark: 토큰·44px 터치 유지.

- [ ] **Step 3: 웹/타입 검증** — Run: `npx tsc --noEmit && npm run quality` · Expected: tsc 0, quality 0 errors(기존 warn 제외).

- [ ] **Step 4: 커밋**

```bash
git add src/components/ops/RedrawModal.tsx src/components/ops/TablesTab.tsx
git commit -m "feat(ops): TABLES 배정 모드 선택(빈자리/랜덤/칩드래프트) + RedrawModal 확장"
```

---

## Task 12: 전체 검증 게이트 (머지 전)

**Files:** 없음(검증만).

- [ ] **Step 1: 순수/단위 jest** — Run: `npx jest src/domains/ops src/schemas src/errors src/services/ops` · Expected: 전 PASS(신규 알고리즘·스키마·에러매핑·서비스).

- [ ] **Step 2: 전체 jest 회귀** — Run: `npx jest` · Expected: 기존 스위트 회귀 0(1d 기준 338/4533 + 신규).

- [ ] **Step 3: DB 테스트** — Run: `npm run db:reset && npm run test:db:helpers && npx supabase test db` · Expected: 신규 `ops_reseat_participants` ok + 기존 ops pgTAP(1a~1d·redraw) 회귀 0.

- [ ] **Step 4: 타입·품질** — Run: `npx tsc --noEmit && npm run quality` · Expected: tsc 0 errors, quality 0 errors.

- [ ] **Step 5: 증거 수집** — 각 명령 출력(PASS 수/0 errors)을 기록. **prod 게이트는 사용자 "go" 후**(MCP apply→get_advisors→supabase.ts 수술적 정합→push+PR+CI+머지). OTA 보류(prod ops 0행).

---

## 회귀 주의 (적대검증·pgTAP 필수 커버, 스펙 §9)

1. partial UNIQUE 단일점유: 전원 비우기→앉히기 순서(중간상태 충돌 금지). ❌seat-by-seat set 우선.
2. 잠금 순서: advisory→대회→참가자(id asc)→좌석(id asc) = 1b/1d 통일.
3. TOCTOU: 동시 bust(PARTICIPANT_NOT_ACTIVE)·외부 착석(SEAT_VERSION_CONFLICT).
4. 적격성 서버강제: closed/standby/locked 거부.
5. live_stats: seats/participants 변경→트리거 자동(소스 추가 불요).
6. 반환 매핑: snake→camel 수동.
7. 에러매핑 substring: SEAT*ASSIGNMENT_INVALID를 SEAT*\* 앞에.
8. LS-매개 데드락 인접(reseat가 live_stats 트리거 표면 확대) — TODOS 추적·후속 DEFERRED CONSTRAINT TRIGGER PR과 함께.
