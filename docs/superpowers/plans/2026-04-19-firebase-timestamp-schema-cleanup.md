# Firebase Timestamp 스키마 청산 Implementation Plan (v3 — ISO string)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `timestampSchema`가 ISO string을 `{seconds, nanoseconds}` Firebase TimestampLike 객체로 변환하던 레거시를 제거하고, 모든 timestamp를 **ISO 8601 string**으로 통일 정규화한다. Supabase timestamptz는 string으로 주고받으므로 변환 자체를 view layer로 미루어 round-trip을 string-string으로 일관 유지한다. PostgreSQL `22007 invalid input syntax for type timestamp with time zone` 400 에러를 근본 차단하면서 JSONB 내부 timestamp 필드의 silent schema shift도 방지.

**Architecture:** outside voice가 지적한 핵심 통찰: Supabase는 string을 보내고 string을 받으니, **Date 변환 자체가 불필요**하다. `timestampSchema`는 모든 외부 입력 형태(Date/TimestampLike/`{seconds,nanoseconds}`/serverTimestamp 센티널/ISO string)를 ISO 8601 string으로 정규화한다. JSONB 내부 timestamp 필드도 string으로 유지되므로 외부 consumer(SQL 쿼리, edge function, 분석)와의 호환성이 깨지지 않는다. Date가 필요한 view layer 사이트만 `toDate(str)` 호출.

**Tech Stack:** Zod 4, Supabase JS v2, TypeScript strict, Jest, React Native 0.83.4 / Expo 55

**근본 원인 요약:**
- `src/schemas/common.ts:134` `timestampSchema`가 read 시 ISO string → TimestampLike 객체 변환 (Firebase 호환용)
- Firebase는 2026-04-11에 제거됐으므로 변환 자체가 불필요
- Repository update 경로에서 그 객체가 그대로 PATCH 본문에 들어가 Supabase가 22007로 거부

**v3 = ISO string 방향 채택 이유 (outside voice cross-model consensus):**
- Date 반환(v2 초안)은 JSONB 내부 timestamp 필드까지 Date로 파싱 → write 시 ISO string으로 직렬화 → 외부 consumer가 `stats.lastUpdatedAt.seconds` 읽으면 undefined (silent shape change)
- `cancellationRequestTimestampSchema = z.string().or(timestampSchema)` 같은 union이 `string | Date`로 어색해짐
- 11+ 테스트 파일의 `.toDate()` 호출 제거 + view 사이트의 Date 메서드 가정 등 cascade가 큼
- 반면 string 반환은 (a) round-trip 일관, (b) JSONB 무영향, (c) union 자연, (d) Date 변환을 view layer로 격리

---

## File Structure

### 변경 대상 파일 (직접 수정)

| 파일 | 변경 종류 | 책임 |
|------|----------|------|
| `uniqn-mobile/src/utils/date/core.ts` | 수정 | **`normalizeToIsoString(val): string` 헬퍼 신규**. `TimestampLike`/`SerializedTimestamp`/`hasToDate`/`hasSeconds` 모두 제거. `toDate()`는 보존 (string→Date lenient, view layer용) |
| `uniqn-mobile/src/schemas/common.ts` | 수정 | `timestampSchema` `normalizeToIsoString` 위임 — `string` 반환 |
| `uniqn-mobile/src/schemas/application.schema.ts` | 수정 | `cancellationRequestTimestampSchema` union 단순화 (`string \| string` = `timestampSchema`) |
| `uniqn-mobile/src/services/offline/criticalOfflineCache.ts` | 수정 | `isTimestampLike` 분기 제거. Date 입력은 `.toISOString()` (디버깅 친화) |
| `uniqn-mobile/src/shared/time/Timestamp.ts` | 삭제 | Firebase Timestamp 모방 클래스 |

### 신규 테스트

| 파일 | 책임 |
|------|------|
| `uniqn-mobile/src/utils/date/__tests__/normalizeToIsoString.test.ts` | 정규화 진실원의 단위 테스트 (모든 입력 형태 → ISO string) |
| `uniqn-mobile/src/schemas/__tests__/common.test.ts` | `timestampSchema` 출력이 string + JSON.stringify 시 그대로 통과 검증 |
| `uniqn-mobile/src/repositories/supabase/__tests__/JobPostingRepository.update.regression.test.ts` | 22007 회귀 가드 (`cur.createdAt` + `cur.closedAt` 모두) |

### 자동 영향 (TypeScript가 발견)

`timestampSchema`의 출력이 `TimestampLike` → `string`으로 바뀌면서 `z.infer` 결과 타입이 cascade. `.toDate()`/`.seconds`/`.nanoseconds` 호출 사이트가 모두 컴파일 에러로 노출됨. 단, **`as any`/`as TimestampLike` cast 사이트는 컴파일 에러 안 남** → 별도 grep task로 점검 (Phase 2).

영향 받는 파일군 (정확한 목록은 Phase 2의 type-check + grep으로 확정):
- `src/schemas/__tests__/*` — `.toDate()` 사용 테스트들
- `src/components/.../timestamp 사용` — UI 포맷팅 사이트
- `src/services/.../*` — schedule, work, settlement 등에서 Date 메서드 가정

### 변경하지 않는 파일 (리스크 노트)

- 모든 `*.schema.ts`(application/workLog/notification/jobPosting/report 등): `timestampSchema` import만 → 정의 변경 자동 반영. 출력 타입이 `string`으로 바뀌므로 사용처가 컴파일 에러로 발견됨.
- Repository write 경로: `serializeJobPostingV3` 결과가 자동으로 string 통일 → `toSnakeCase` 통과 → Supabase가 받음. 별도 변환 불필요.
- JSONB 컬럼(`stats`, `schedule`, `compensation`, `cancellation_request`, `questions`, `role_catalog`, `tournament_config`, `urgent_config`, `fixed_config`) 내부 timestamp: read 시 string 유지 → write 시 그대로 string 저장. **외부 consumer 호환성 보존.**

---

## 검증 전략

각 Phase는 다음 게이트를 통과해야 다음으로:

1. **Phase 1 (정규화 single source)** → `npm test -- normalizeToIsoString.test.ts && npm test -- common.test.ts` 통과
2. **Phase 2 (cascade fix + 사이트 점검)** → `npm run type-check` 0 에러 + cast/outbox grep 결과 0 leak
3. **Phase 3 (회귀 테스트)** → 강화된 회귀 가드가 Red-Green-Verify로 검출력 검증
4. **Phase 4 (데드코드 제거)** → `npm run quality` + `npx knip` 통과
5. **Phase 5 (E2E + DB state)** → 22007 미발생 + 실제 DB row의 timestamp 필드 string 형태 확인

---

## Phase 1 — 정규화 single source 신설 (TDD)

### Task 1: `normalizeToIsoString` 단위 테스트 (RED)

**Files:**
- Create: `uniqn-mobile/src/utils/date/__tests__/normalizeToIsoString.test.ts`

- [ ] **Step 1: 테스트 파일 작성**

```typescript
import { normalizeToIsoString, toDate } from '../core';

describe('normalizeToIsoString (정규화 single source)', () => {
  describe('입력 → ISO string 정규화', () => {
    it('Date를 ISO string으로 변환', () => {
      const d = new Date('2026-04-19T15:30:00.000Z');
      expect(normalizeToIsoString(d)).toBe('2026-04-19T15:30:00.000Z');
    });

    it('strict ISO string은 정규화 후 통과', () => {
      expect(normalizeToIsoString('2026-04-19T15:30:00.000Z')).toBe('2026-04-19T15:30:00.000Z');
    });

    it('Supabase timestamptz 형태("+00:00")도 통과', () => {
      const result = normalizeToIsoString('2026-04-19T15:30:00+00:00');
      expect(result).toBe('2026-04-19T15:30:00.000Z');
    });

    it('epoch ms(number)를 ISO string으로 변환', () => {
      expect(normalizeToIsoString(1776525546985)).toBe('2026-04-18T15:19:06.985Z');
    });

    it('Firestore TimestampLike({toDate})를 ISO string으로 변환', () => {
      const inner = new Date('2026-04-19T15:30:00.000Z');
      expect(normalizeToIsoString({ toDate: () => inner })).toBe('2026-04-19T15:30:00.000Z');
    });

    it('{seconds, nanoseconds} 객체를 ISO string으로 변환', () => {
      const result = normalizeToIsoString({ seconds: 1776525546, nanoseconds: 985000000 });
      expect(result).toBe('2026-04-18T15:19:06.985Z');
    });

    it('serverTimestamp 센티널을 현재 시각 ISO string으로 변환', () => {
      const before = Date.now();
      const result = normalizeToIsoString({ _methodName: 'serverTimestamp' });
      const after = Date.now();
      const ms = new Date(result).getTime();
      expect(ms).toBeGreaterThanOrEqual(before);
      expect(ms).toBeLessThanOrEqual(after);
    });
  });

  describe('strict 거부 (loose Date.parse fallback 차단)', () => {
    it('numeric string("12345")을 거부 (Date.parse는 통과시키지만 ISO 8601 아님)', () => {
      expect(() => normalizeToIsoString('12345')).toThrow();
    });

    it('YYYY-MM-DD only는 거부 (timezone 모호)', () => {
      expect(() => normalizeToIsoString('2026-04-19')).toThrow();
    });

    it('자유 형식 문자열("April 19 2026") 거부', () => {
      expect(() => normalizeToIsoString('April 19 2026')).toThrow();
    });

    it('빈 문자열, null, undefined, 임의 객체는 throw', () => {
      expect(() => normalizeToIsoString('')).toThrow();
      expect(() => normalizeToIsoString(null)).toThrow();
      expect(() => normalizeToIsoString(undefined)).toThrow();
      expect(() => normalizeToIsoString({})).toThrow();
      expect(() => normalizeToIsoString({ foo: 'bar' })).toThrow();
    });

    it('Invalid Date 인스턴스 거부', () => {
      expect(() => normalizeToIsoString(new Date('invalid'))).toThrow();
    });

    it('NaN/Infinity number 거부', () => {
      expect(() => normalizeToIsoString(NaN)).toThrow();
      expect(() => normalizeToIsoString(Infinity)).toThrow();
    });
  });
});

describe('toDate (lenient string→Date for view layer)', () => {
  it('null/undefined/빈문자열에 null 반환', () => {
    expect(toDate(null)).toBeNull();
    expect(toDate(undefined)).toBeNull();
    expect(toDate('')).toBeNull();
  });

  it('정규화 실패 시 null 반환 (throw 안 함)', () => {
    expect(toDate('invalid' as string)).toBeNull();
    expect(toDate({} as unknown as Date)).toBeNull();
  });

  it('성공 시 Date 인스턴스 반환', () => {
    const d = toDate('2026-04-19T15:30:00.000Z');
    expect(d).toBeInstanceOf(Date);
    expect(d?.toISOString()).toBe('2026-04-19T15:30:00.000Z');
  });
});
```

- [ ] **Step 2: 테스트 실행 — 모두 fail 확인 (RED)**

```bash
cd uniqn-mobile
npm test -- src/utils/date/__tests__/normalizeToIsoString.test.ts
```

Expected: FAIL — `normalizeToIsoString`가 아직 export 안 됨.

- [ ] **Step 3: 커밋 (RED 상태 보존)**

```bash
cd uniqn-mobile
git add src/utils/date/__tests__/normalizeToIsoString.test.ts
git commit -m "test(utils/date): normalizeToIsoString 단위 테스트 추가 (RED)"
```

---

### Task 2: `src/utils/date/core.ts` — `normalizeToIsoString` 신설 + 레거시 청산 (GREEN)

**Files:**
- Modify: `uniqn-mobile/src/utils/date/core.ts:1-86`

- [ ] **Step 1: 1~86번 라인 전체 교체**

```typescript
import { isValid, parseISO } from 'date-fns';

export type DateInput = Date | string | number | null | undefined;

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

// strict ISO 8601 (date + time + timezone). Date.parse가 통과시키는 loose 형식 차단.
const STRICT_ISO_8601 = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:?\d{2})$/;

export function isValidDate(value: unknown): value is Date {
  return value instanceof Date && isValid(value);
}

function parseStrictIsoString(value: string): Date | null {
  if (!STRICT_ISO_8601.test(value)) return null;
  const parsed = parseISO(value);
  return isValid(parsed) ? parsed : null;
}

function parseLenientStringDate(value: string): Date | null {
  // view layer용 lenient 파싱 — toDate() 전용
  const isoParsed = parseISO(value);
  if (isValid(isoParsed)) return isoParsed;

  if (DATE_ONLY_PATTERN.test(value)) return null;

  const parsed = new Date(value);
  return isValid(parsed) ? parsed : null;
}

// ============================================================================
// normalizeToIsoString — 모든 timestamp 입력을 ISO 8601 string으로 정규화
// ============================================================================
// 이 함수가 timestamp 정규화 진실원이다. timestampSchema(Zod throw)가 위임.
// Supabase timestamptz는 ISO string으로 주고받으므로 변환 없이 round-trip.

function isFirestoreTimestampLike(value: unknown): value is { toDate: () => Date } {
  return (
    value !== null &&
    typeof value === 'object' &&
    'toDate' in value &&
    typeof (value as { toDate?: unknown }).toDate === 'function'
  );
}

function isSecondsObject(value: unknown): value is { seconds: number; nanoseconds: number } {
  return (
    value !== null &&
    typeof value === 'object' &&
    'seconds' in value &&
    'nanoseconds' in value &&
    typeof (value as { seconds: unknown }).seconds === 'number' &&
    typeof (value as { nanoseconds: unknown }).nanoseconds === 'number'
  );
}

function isServerTimestampSentinel(value: unknown): value is { _methodName: 'serverTimestamp' } {
  return (
    value !== null &&
    typeof value === 'object' &&
    '_methodName' in value &&
    (value as { _methodName: unknown })._methodName === 'serverTimestamp'
  );
}

/**
 * 모든 timestamp 입력을 ISO 8601 string으로 정규화. 실패 시 throw.
 *
 * 지원 입력:
 *  - strict ISO 8601 string (그대로 정규화 후 통과)
 *  - Date 인스턴스 (.toISOString())
 *  - epoch milliseconds (number)
 *  - Firebase Firestore TimestampLike ({ toDate(): Date })
 *  - { seconds, nanoseconds } JSON 직렬화 형태
 *  - serverTimestamp() 센티널 ({ _methodName: 'serverTimestamp' })
 *
 * 거부:
 *  - YYYY-MM-DD only (timezone 모호)
 *  - "12345" 같은 numeric string (ISO 아님)
 *  - "April 19 2026" 같은 free-form (ISO 아님)
 *  - Invalid Date, NaN, Infinity
 */
export function normalizeToIsoString(val: unknown): string {
  if (typeof val === 'string') {
    const parsed = parseStrictIsoString(val);
    if (parsed) return parsed.toISOString();
    throw new Error('Invalid timestamp format: not strict ISO 8601');
  }

  if (val instanceof Date) {
    if (isValidDate(val)) return val.toISOString();
    throw new Error('Invalid timestamp format: invalid Date');
  }

  if (typeof val === 'number' && Number.isFinite(val)) {
    const date = new Date(val);
    if (isValidDate(date)) return date.toISOString();
    throw new Error('Invalid timestamp format: out of range number');
  }

  if (isFirestoreTimestampLike(val)) {
    const date = val.toDate();
    if (isValidDate(date)) return date.toISOString();
    throw new Error('Invalid timestamp format: TimestampLike returned invalid Date');
  }

  if (isSecondsObject(val)) {
    const ms = val.seconds * 1000 + val.nanoseconds / 1_000_000;
    const date = new Date(ms);
    if (isValidDate(date)) return date.toISOString();
    throw new Error('Invalid timestamp format: invalid {seconds, nanoseconds}');
  }

  if (isServerTimestampSentinel(val)) {
    return new Date().toISOString();
  }

  throw new Error('Invalid timestamp format');
}

/**
 * Lenient string→Date 변환. 정규화 실패 시 null 반환.
 * View layer (포맷팅, 비교 등)에서 schema가 반환한 ISO string을 Date로 변환할 때 사용.
 */
export function toDate(value: DateInput | unknown): Date | null {
  if (value === null || value === undefined || value === '') return null;
  if (value instanceof Date) return isValidDate(value) ? value : null;
  if (typeof value === 'string') return parseLenientStringDate(value);
  if (typeof value === 'number') {
    const parsed = new Date(value);
    return isValidDate(parsed) ? parsed : null;
  }
  return null;
}
```

(주의: 87번 라인 이후 `toISODateString`, `getTodayString`, `toDateString`, `parseDateString`, `toDateValue`, `generateId` re-export 모두 그대로 보존)

**핵심 결정:**
- `normalizeToIsoString` = strict 정규화 진실원 (Zod throw 호환)
- `toDate` = lenient view 변환 (null fallback)
- `STRICT_ISO_8601` 정규식 — `"12345"`, `"2026-04-19"`, `"April 19 2026"` 차단 (outside voice H2)
- `TimestampLike`/`SerializedTimestamp` 타입 export 모두 제거 (Issue 2A 완전 청산)

- [ ] **Step 2: 단위 테스트 GREEN 확인**

```bash
cd uniqn-mobile
npm test -- src/utils/date/__tests__/normalizeToIsoString.test.ts
```

Expected: 모든 테스트 PASS.

- [ ] **Step 3: 87번 라인 이후 함수 보존 확인**

```bash
cd uniqn-mobile
grep -n "toISODateString\|getTodayString\|toDateValue" src/utils/date/core.ts
```

Expected: 함수들이 모두 보존되어 출력.

- [ ] **Step 4: 커밋**

```bash
cd uniqn-mobile
git add src/utils/date/core.ts
git commit -m "refactor(utils/date): normalizeToIsoString single source 신설, 레거시 분기 완전 제거

- TimestampLike, SerializedTimestamp, hasToDate, hasSeconds export 모두 제거
- normalizeToIsoString(val): string — 모든 입력 형태를 ISO 8601 string으로 정규화 (strict)
- toDate(): Date | null — string→Date lenient 변환 (view layer 전용, null fallback)
- STRICT_ISO_8601 정규식으로 numeric string / date-only / free-form 거부"
```

---

### Task 3: `timestampSchema` 단위 테스트 (RED)

**Files:**
- Create: `uniqn-mobile/src/schemas/__tests__/common.test.ts`

- [ ] **Step 1: 테스트 작성**

```typescript
import { timestampSchema, optionalTimestampSchema, nullableTimestampSchema } from '../common';

describe('timestampSchema (ISO string 반환)', () => {
  it('Supabase ISO string("+00:00")을 정규화', () => {
    expect(timestampSchema.parse('2026-04-19T15:30:00+00:00')).toBe('2026-04-19T15:30:00.000Z');
  });

  it('strict ISO Z 문자열은 그대로', () => {
    expect(timestampSchema.parse('2026-04-19T15:30:00.000Z')).toBe('2026-04-19T15:30:00.000Z');
  });

  it('Date 객체를 ISO string으로 변환', () => {
    const d = new Date('2026-04-19T15:30:00.000Z');
    expect(timestampSchema.parse(d)).toBe('2026-04-19T15:30:00.000Z');
  });

  it('Firebase TimestampLike({toDate})를 ISO string으로 변환', () => {
    const ts = {
      toDate: () => new Date('2026-04-19T15:30:00.000Z'),
      seconds: 1776525546,
      nanoseconds: 0,
    };
    expect(timestampSchema.parse(ts)).toBe('2026-04-19T15:30:00.000Z');
  });

  it('{seconds, nanoseconds} 객체를 ISO string으로 변환 (회귀 가드: 22007 차단)', () => {
    expect(timestampSchema.parse({ seconds: 1776525546, nanoseconds: 985000000 })).toBe(
      '2026-04-18T15:19:06.985Z'
    );
  });

  it('serverTimestamp 센티널을 현재 시각 ISO string으로 변환', () => {
    const before = Date.now();
    const result = timestampSchema.parse({ _methodName: 'serverTimestamp' });
    const after = Date.now();
    expect(typeof result).toBe('string');
    const ms = new Date(result as string).getTime();
    expect(ms).toBeGreaterThanOrEqual(before);
    expect(ms).toBeLessThanOrEqual(after);
  });

  describe('JSON 직렬화 (Supabase write 호환성)', () => {
    it('parse 결과를 JSON.stringify하면 그대로 ISO string (PostgreSQL timestamptz 호환)', () => {
      const result = timestampSchema.parse('2026-04-19T15:30:00.000Z');
      const json = JSON.stringify({ created_at: result });
      expect(json).toBe('{"created_at":"2026-04-19T15:30:00.000Z"}');
    });

    it('{seconds, nanoseconds} 입력도 결국 ISO string으로 직렬화 (회귀 가드)', () => {
      const result = timestampSchema.parse({ seconds: 1776525546, nanoseconds: 985000000 });
      const json = JSON.stringify({ created_at: result });
      expect(json).not.toContain('seconds');
      expect(json).not.toContain('nanoseconds');
      expect(json).toMatch(/"created_at":"\d{4}-\d{2}-\d{2}T/);
    });

    it('Firebase TimestampLike 입력도 ISO string으로 직렬화', () => {
      const ts = {
        toDate: () => new Date('2026-04-19T15:30:00.000Z'),
        seconds: 0,
        nanoseconds: 0,
      };
      const result = timestampSchema.parse(ts);
      expect(JSON.stringify({ created_at: result })).toBe(
        '{"created_at":"2026-04-19T15:30:00.000Z"}'
      );
    });
  });

  describe('잘못된 입력 거부', () => {
    it('numeric string("12345") 거부', () => {
      expect(() => timestampSchema.parse('12345')).toThrow();
    });

    it('YYYY-MM-DD only 거부', () => {
      expect(() => timestampSchema.parse('2026-04-19')).toThrow();
    });

    it('빈 문자열 거부', () => {
      expect(() => timestampSchema.parse('')).toThrow();
    });

    it('null은 timestampSchema에서 거부', () => {
      expect(() => timestampSchema.parse(null)).toThrow();
    });
  });

  describe('optionalTimestampSchema', () => {
    it('null/undefined 허용 (round-trip 검증)', () => {
      expect(optionalTimestampSchema.parse(null)).toBeNull();
      expect(optionalTimestampSchema.parse(undefined)).toBeUndefined();
    });

    it('유효한 입력은 ISO string으로 변환', () => {
      expect(optionalTimestampSchema.parse('2026-04-19T15:30:00.000Z')).toBe(
        '2026-04-19T15:30:00.000Z'
      );
    });
  });

  describe('nullableTimestampSchema', () => {
    it('null만 허용 (undefined 거부)', () => {
      expect(nullableTimestampSchema.parse(null)).toBeNull();
      expect(() => nullableTimestampSchema.parse(undefined)).toThrow();
    });
  });
});
```

- [ ] **Step 2: 실행 — fail 확인**

```bash
cd uniqn-mobile
npm test -- src/schemas/__tests__/common.test.ts
```

Expected: FAIL — 현재 schema는 TimestampLike 객체 반환.

- [ ] **Step 3: 커밋**

```bash
cd uniqn-mobile
git add src/schemas/__tests__/common.test.ts
git commit -m "test(schemas): timestampSchema string 반환 테스트 추가 (RED)"
```

---

### Task 4: `timestampSchema`를 string 반환으로 변경 (GREEN)

**Files:**
- Modify: `uniqn-mobile/src/schemas/common.ts:1-195`

- [ ] **Step 1: 1~195번 라인 전체 교체**

```typescript
/**
 * UNIQN Mobile - 공통 Zod 스키마
 *
 * @description 여러 스키마에서 재사용되는 공통 타입 정의
 * @version 3.0.0 - Firebase Timestamp 레거시 청산 (2026-04-19)
 *                  timestampSchema가 모든 입력 형태를 ISO 8601 string으로 정규화.
 *                  Supabase timestamptz round-trip이 string-string으로 일관 유지.
 *                  정규화 진실원: utils/date/core의 normalizeToIsoString.
 *
 * @example
 * import { timestampSchema, optionalTimestampSchema } from './common';
 *
 * const mySchema = z.object({
 *   createdAt: timestampSchema,    // string (ISO 8601)
 *   deletedAt: optionalTimestampSchema,  // string | null | undefined
 * });
 */

import { z } from 'zod';
import { normalizeToIsoString } from '@/utils/date/core';

// ============================================================================
// Timestamp Schemas (ISO string 반환)
// ============================================================================

/**
 * Timestamp 검증 및 ISO string 정규화
 *
 * 지원 입력 (모두 ISO 8601 string으로 정규화):
 *  - Supabase ISO string ("2026-04-19T15:30:00+00:00")
 *  - Date 인스턴스
 *  - Firebase Timestamp 호환 객체 (toDate() 메서드)
 *  - { seconds, nanoseconds } JSON 직렬화 형태
 *  - serverTimestamp() 센티널
 *  - epoch milliseconds (number)
 *
 * 출력은 string이므로 JSON.stringify 시 그대로 통과 → Supabase timestamptz 호환.
 * View layer에서 Date가 필요하면 utils/date의 toDate()로 변환.
 */
export const timestampSchema = z.unknown().transform((val, ctx): string => {
  try {
    return normalizeToIsoString(val);
  } catch {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Timestamp 형식이 아닙니다',
    });
    return z.NEVER;
  }
});

/**
 * 선택적 Timestamp 스키마 (null/undefined 허용)
 */
export const optionalTimestampSchema = timestampSchema.optional().nullable();

/**
 * Nullable Timestamp 스키마 (null 허용, undefined는 거부)
 */
export const nullableTimestampSchema = timestampSchema.nullable();

// ============================================================================
// Duration Schema
// ============================================================================
```

(주의: 200번 라인 이하 Duration Schema 등 기존 코드는 그대로 보존)

- [ ] **Step 2: common.test.ts GREEN 확인**

```bash
cd uniqn-mobile
npm test -- src/schemas/__tests__/common.test.ts
```

Expected: 모든 테스트 PASS.

- [ ] **Step 3: 커밋**

```bash
cd uniqn-mobile
git add src/schemas/common.ts
git commit -m "refactor(schemas): timestampSchema가 ISO string 반환으로 통일

- normalizeToIsoString 위임 (정규화 진실원 single source)
- 출력 타입: TimestampLike → string (ISO 8601)
- Supabase round-trip이 string-string으로 일관 (22007 근본 차단)
- JSONB 내부 timestamp 형태 보존 (외부 consumer 호환성 유지)"
```

---

## Phase 2 — TypeScript Cascade Fix + 사이트 점검

### Task 5: 전체 type-check 실행 + 영향 범위 캡처

**Files:** 없음 (조사)

- [ ] **Step 1: 전체 프로젝트 type-check (single-file 아님)**

```bash
cd uniqn-mobile
npm run type-check 2>&1 | tee /tmp/typecheck-cascade.log
```

Expected: `.toDate()`, `.seconds`, `.nanoseconds` 호출 사이트들이 컴파일 에러로 노출됨. 예:
```
src/components/somefile.tsx:42:30 - error TS2339: Property 'toDate' does not exist on type 'string'.
```

- [ ] **Step 2: 영향 파일 목록 캡처**

```bash
cd uniqn-mobile
grep -E "^[^ ]+\.tsx?:" /tmp/typecheck-cascade.log | cut -d: -f1 | sort -u | tee /tmp/affected-files.txt
wc -l /tmp/affected-files.txt
```

이 목록이 Phase 2 전체 작업의 진실원.

---

### Task 6: cascade 에러를 디렉토리 단위로 분할 commit하며 fix

**Files:** Task 5에서 캡처된 모든 파일

- [ ] **Step 1: 패턴별 fix 가이드**

| 에러 패턴 | 변경 |
|-----------|------|
| `parsed.createdAt.toDate()` | `toDate(parsed.createdAt)` (utils/date에서 import) |
| `parsed.createdAt.toDate().getTime()` | `toDate(parsed.createdAt)?.getTime() ?? 0` |
| `parsed.createdAt.seconds` | `Math.floor(new Date(parsed.createdAt).getTime() / 1000)` (드물 것) |
| `formatDate(timestamp.toDate())` | `formatDate(timestamp)` (date utils가 string 직접 받음) |
| `expect(parsed.createdAt).toBeInstanceOf(Object)` | `expect(typeof parsed.createdAt).toBe('string')` |
| `if (value instanceof Timestamp)` | `if (typeof value === 'string')` 또는 제거 |
| `import { TimestampLike } from '@/utils/date'` | 제거 (export 더 이상 없음) |
| 함수 시그니처 `(t: TimestampLike)` | `(t: string)` |

- [ ] **Step 2: 디렉토리별 분할 commit**

각 디렉토리 fix → 즉시 commit. PR 리뷰 가능성 + bisect 친화.

```bash
cd uniqn-mobile

# 1. utils
git add src/utils/
git commit -m "fix(utils): timestampSchema string 반환 cascade fix"

# 2. components
git add src/components/
git commit -m "fix(components): timestampSchema string 반환 cascade fix"

# 3. services
git add src/services/
git commit -m "fix(services): timestampSchema string 반환 cascade fix"

# 4. hooks + stores
git add src/hooks/ src/stores/
git commit -m "fix(hooks,stores): timestampSchema string 반환 cascade fix"

# 5. domains + repositories (필요한 경우)
git add src/domains/ src/repositories/
git commit -m "fix(domains,repos): timestampSchema string 반환 cascade fix"

# 6. app/ (Expo router)
git add app/
git commit -m "fix(app): timestampSchema string 반환 cascade fix"
```

- [ ] **Step 3: 전체 type-check 0 에러 확인**

```bash
cd uniqn-mobile
npm run type-check
```

Expected: `Found 0 errors.`

---

### Task 7: cast 사이트 점검 (`as any`/`as TimestampLike`) — outside voice H3

**Files:** 없음 (조사 + 발견 시 fix)

- [ ] **Step 1: 위험 cast 패턴 grep**

```bash
cd uniqn-mobile
grep -rn "as TimestampLike\|as { toDate\|as { seconds" src/ app/ --include="*.ts" --include="*.tsx"
grep -rn "createdAt as any\|updatedAt as any\|closedAt as any\|submittedAt as any" src/ app/ --include="*.ts" --include="*.tsx"
```

Expected: cast로 timestamp를 우회하는 사이트가 보이면 컴파일러가 못 잡음 → 수동 점검.

- [ ] **Step 2: 발견된 cast 사이트별 처리**

각 사이트:
- 진짜 우회 필요했던 거라면 → string 가정으로 변경 (`as string`)
- 잘못된 cast였다면 → cast 제거하고 적절한 타입 사용

- [ ] **Step 3: 커밋 (변경 있다면)**

```bash
cd uniqn-mobile
git add -A
git commit -m "fix(types): TimestampLike cast 사이트 정리 (string 가정으로 통일)"
```

---

### Task 8: outbox/큐 payload 점검 — Issue 3A

**Files:** 없음 (조사 + 발견 시 fix)

- [ ] **Step 1: 임의 payload를 JSONB로 저장하는 사이트 grep**

```bash
cd uniqn-mobile
grep -rn "payload:\s*\|payload\s*=" src/repositories/ src/services/ --include="*.ts" | grep -v __tests__
```

Expected: outbox/큐로 보내는 payload 사이트들이 보임.

- [ ] **Step 2: 각 사이트에서 cur 객체나 schema 결과를 통째로 넘기는지 확인**

`enqueueScheduleBoardSync(jobPostingId, action, payload)` 같은 시그니처를 보고:
- payload가 `{jobPostingId, ownerId}` 같은 단순 객체면 OK
- payload에 `cur` 또는 `serializedJobPosting`을 통째로 넘기면 → schema가 string으로 정규화하므로 이제 안전. 단, **변경 전 코드가 객체 형태를 가정해서 payload 사용했다면 마이그레이션 필요**.

- [ ] **Step 3: 발견 결과 정리 (없으면 "없음" 명시)**

이 task는 진짜 변경이 없을 가능성도 큼. 그래도 점검은 필수.

---

### Task 9: `cancellationRequestTimestampSchema` 정합성 — outside voice C2

**Files:**
- Modify: `uniqn-mobile/src/schemas/application.schema.ts:209-225` (정확한 라인은 grep으로 확인)

- [ ] **Step 1: 현재 정의 확인**

```bash
cd uniqn-mobile
grep -n "cancellationRequestTimestampSchema" src/schemas/application.schema.ts
```

기존: `cancellationRequestTimestampSchema = z.string().or(timestampSchema)` 같은 union.

- [ ] **Step 2: 정의 단순화**

`timestampSchema`가 이미 string을 받으므로 union 자체가 불필요. 제거 또는 alias.

```typescript
// Before:
const cancellationRequestTimestampSchema = z.string().or(timestampSchema);

// After:
const cancellationRequestTimestampSchema = timestampSchema; // 또는 직접 timestampSchema 사용
```

또는 union을 유지하되 명시:
```typescript
// 외부 consumer가 raw string을 그대로 보낼 가능성 대응
const cancellationRequestTimestampSchema = timestampSchema; // string 통일
```

- [ ] **Step 3: 사용처 영향 점검**

```bash
cd uniqn-mobile
grep -rn "cancellationRequestTimestampSchema\|cancellationRequest" src/ app/ --include="*.ts" --include="*.tsx" | grep -v __tests__
```

downstream에서 `requestedAt.toDate()` 같은 호출이 있으면 fix.

- [ ] **Step 4: 커밋**

```bash
cd uniqn-mobile
git add src/schemas/application.schema.ts
git commit -m "refactor(schemas): cancellationRequestTimestampSchema union 단순화

- timestampSchema가 이미 string 통일이므로 z.string().or(...) union 불필요
- 출력 타입이 string으로 자연스럽게 정리됨"
```

---

### Task 10: criticalOfflineCache.ts 정리

**Files:**
- Modify: `uniqn-mobile/src/services/offline/criticalOfflineCache.ts:31-87`

- [ ] **Step 1: isTimestampLike 분기 제거 + Date → ISO string 직렬화**

```typescript
// uniqn-mobile/src/services/offline/criticalOfflineCache.ts (라인 31~87 교체)

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isDate(value: unknown): value is Date {
  return value instanceof Date;
}

/**
 * MMKV 직렬화 — Date → ISO string으로 저장. 다음 read 시 timestampSchema가 string을
 * 그대로 통과시킴 (이미 string이라 정규화 작업 없음, fast path).
 */
function serializeValue(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (isDate(value)) return value.toISOString();

  if (Array.isArray(value)) {
    return value.map((item) => serializeValue(item));
  }

  if (isPlainObject(value)) {
    return Object.entries(value).reduce<Record<string, unknown>>((acc, [key, entryValue]) => {
      if (typeof entryValue === 'function' || entryValue === undefined) return acc;
      acc[key] = serializeValue(entryValue);
      return acc;
    }, {});
  }

  return value;
}
```

**Issue 4A 결정:** 기존 사용자 디바이스의 `{seconds, nanoseconds}` 형태로 저장된 캐시는 다음 read 시 변경된 timestampSchema가 자동으로 ISO string으로 정규화하므로 마이그레이션 불필요.

- [ ] **Step 2: 단위 테스트 갱신**

```bash
cd uniqn-mobile
npm test -- src/services/offline/__tests__/criticalOfflineCache.test.ts
```

기존 TimestampLike 입력 가정 테스트가 fail하면 Date 또는 string 입력으로 변경.

- [ ] **Step 3: 커밋**

```bash
cd uniqn-mobile
git add src/services/offline/criticalOfflineCache.ts src/services/offline/__tests__/
git commit -m "refactor(offline): MMKV 직렬화에서 isTimestampLike 분기 제거

- Date → ISO string 직렬화 (디버깅 친화 + schema 통일)
- 기존 {seconds, nanoseconds} 캐시는 schema가 자동 정규화하므로 마이그레이션 불필요"
```

---

## Phase 3 — 회귀 테스트 강화 (outside voice C3)

### Task 11: JobPostingRepository update 회귀 가드 (cur.createdAt + cur.closedAt)

**Files:**
- Create: `uniqn-mobile/src/repositories/supabase/__tests__/JobPostingRepository.update.regression.test.ts`

- [ ] **Step 1: 기존 Repository 테스트 패턴 확인 (Issue 9A)**

```bash
cd uniqn-mobile
find src/repositories/supabase/__tests__ -name "*.test.ts" 2>/dev/null
ls src/__mocks__/ 2>/dev/null
```

기존 패턴이 있으면 그것을 따라가기. 없으면 `jest.mock('@/lib/supabase')` 직접 mock.

- [ ] **Step 2: 사전 조사 — `cur.createdAt`이 진짜 update payload에 들어가는지 확인 (outside voice C3)**

```bash
cd uniqn-mobile
grep -n "createdAt" src/domains/job-posting/serialization.ts
```

`serializeJobPostingV3`(line ~238)이 `createdAt: options.createdAt ?? current?.createdAt`을 반환 → top-level 필드로 포함됨 → `toSnakeCase` → `created_at`으로 update payload에 들어감을 코드로 확인.

이게 확인 안 되면 회귀 테스트가 false negative. 코드 inspection 결과를 plan 본 task의 주석으로 기록.

- [ ] **Step 3: 회귀 테스트 작성**

```typescript
// uniqn-mobile/src/repositories/supabase/__tests__/JobPostingRepository.update.regression.test.ts
import { SupabaseJobPostingRepository } from '../JobPostingRepository';

jest.mock('@/lib/supabase', () => ({
  supabase: { from: jest.fn() },
}));

import { supabase } from '@/lib/supabase';

describe('SupabaseJobPostingRepository.updateWithTransaction (회귀: 22007 차단)', () => {
  const repo = new SupabaseJobPostingRepository();
  let capturedUpdatePayload: Record<string, unknown> | null = null;

  function setupMock(existingRow: Record<string, unknown>) {
    capturedUpdatePayload = null;
    const updateMock = jest.fn().mockImplementation((payload) => {
      capturedUpdatePayload = payload;
      return {
        eq: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ error: null }),
        }),
      };
    });
    (supabase.from as jest.Mock).mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          maybeSingle: jest.fn().mockResolvedValue({ data: existingRow, error: null }),
        }),
      }),
      update: updateMock,
    });
  }

  const baseRow = {
    id: 'job-1',
    title: '기존 공고',
    schema_version: 3,
    status: 'active',
    owner_id: 'owner-1',
    owner_name: 'Owner',
    posting_type: 'regular',
    work_date: '2026-04-20',
    role_keys: ['dealer'],
    total_positions: 1,
    filled_positions: 0,
    view_count: 0,
    stats: {},
    created_at: '2026-04-19T10:00:00.000Z',
    updated_at: '2026-04-19T11:00:00.000Z',
    location: { name: '강남' },
    schedule: {
      kind: 'dated',
      primaryDate: '2026-04-20',
      allDates: ['2026-04-20'],
      requirements: [],
    },
    role_catalog: [{ role: 'dealer' }],
    compensation: { mode: 'hourly' },
    questions: { items: [] },
  };

  it('cur.createdAt이 string인 경우 update payload에 string으로 들어간다', async () => {
    setupMock(baseRow);
    await repo.updateWithTransaction('job-1', { title: '수정' }, 'owner-1');

    expect(capturedUpdatePayload).not.toBeNull();
    const json = JSON.stringify(capturedUpdatePayload);
    expect(json).not.toContain('"seconds"');
    expect(json).not.toContain('"nanoseconds"');

    if (capturedUpdatePayload?.created_at !== undefined) {
      expect(typeof capturedUpdatePayload.created_at).toBe('string');
      expect(capturedUpdatePayload.created_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    }
  });

  it('cur.createdAt이 과거의 {seconds, nanoseconds} 객체로 저장돼있던 경우도 string으로 정규화', async () => {
    setupMock({
      ...baseRow,
      created_at: { seconds: 1776525546, nanoseconds: 985000000 } as unknown as string,
    });
    await repo.updateWithTransaction('job-1', { title: '수정' }, 'owner-1');

    const json = JSON.stringify(capturedUpdatePayload);
    expect(json).not.toContain('"seconds"');
    expect(json).not.toContain('"nanoseconds"');
  });

  it('마감된 공고(cur.closedAt 존재)도 update payload에 string으로 들어간다 (closedAt 회귀 가드)', async () => {
    setupMock({
      ...baseRow,
      status: 'closed',
      closed_at: '2026-04-19T12:00:00.000Z',
      closed_reason: 'manual',
    });
    await repo.updateWithTransaction('job-1', { title: '수정' }, 'owner-1');

    const json = JSON.stringify(capturedUpdatePayload);
    expect(json).not.toContain('"seconds"');
    expect(json).not.toContain('"nanoseconds"');

    if (capturedUpdatePayload?.closed_at !== undefined) {
      expect(typeof capturedUpdatePayload.closed_at).toBe('string');
    }
  });

  it('updated_at은 항상 새로 생성된 ISO string', async () => {
    setupMock(baseRow);
    await repo.updateWithTransaction('job-1', { title: '수정' }, 'owner-1');

    expect(typeof capturedUpdatePayload?.updated_at).toBe('string');
    expect(capturedUpdatePayload?.updated_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});
```

- [ ] **Step 4: GREEN 확인**

```bash
cd uniqn-mobile
npm test -- src/repositories/supabase/__tests__/JobPostingRepository.update.regression.test.ts
```

Expected: 모두 PASS.

- [ ] **Step 5: Red-Green-Verify (검출력 검증)**

```bash
cd uniqn-mobile
git stash --keep-index   # schema 변경 잠시 revert
# common.ts와 core.ts를 git stash로 복원했으므로 이전 동작
npm test -- src/repositories/supabase/__tests__/JobPostingRepository.update.regression.test.ts
# Expected: FAIL — payload에 {seconds, nanoseconds} 객체 포함됨
git stash pop
npm test -- src/repositories/supabase/__tests__/JobPostingRepository.update.regression.test.ts
# Expected: PASS
```

이 사이클을 건너뛰면 회귀 가드의 검출력 미검증.

- [ ] **Step 6: 커밋**

```bash
cd uniqn-mobile
git add src/repositories/supabase/__tests__/JobPostingRepository.update.regression.test.ts
git commit -m "test(repositories): JobPostingRepository 22007 timestamp 회귀 가드

- cur.createdAt이 객체 형태였던 경우 + string인 경우 모두 검증
- cur.closedAt(마감된 공고) 회귀 가드 추가
- updated_at은 항상 새 ISO string 생성 검증
- Red-Green-Verify로 검출력 확인"
```

---

## Phase 4 — 데드코드 제거

### Task 12: `Timestamp` 클래스 삭제

**Files:**
- Delete: `uniqn-mobile/src/shared/time/Timestamp.ts`

- [ ] **Step 1: 모든 Timestamp 클래스 import 제거 확인**

```bash
cd uniqn-mobile
grep -rn "from.*shared/time/Timestamp\|from.*shared/time'" src/ app/ --include="*.ts" --include="*.tsx"
```

Expected: 출력 없음. 있다면 Phase 2 cascade fix가 누락된 것 → 보강.

- [ ] **Step 2: 테스트 파일들의 Timestamp 사용 마이그레이션 (Phase 2에서 cascade로 못 잡았으면)**

테스트 fixture 패턴:
| 기존 | 교체 |
|------|------|
| `Timestamp.now()` | `new Date().toISOString()` |
| `Timestamp.fromDate(d)` | `d.toISOString()` |
| `Timestamp.fromMillis(ms)` | `new Date(ms).toISOString()` |
| `new Timestamp(s, ns)` | `new Date(s * 1000 + ns / 1_000_000).toISOString()` |

(테스트가 timestampSchema 입력으로 쓰면 Date 객체나 ISO string 모두 받지만, 출력 비교는 string 기준)

- [ ] **Step 3: 파일 + 디렉토리 삭제 (Windows 호환 — outside voice Medium 11)**

```bash
cd uniqn-mobile
git rm -r src/shared/time/
```

`rmdir` 가드 패턴 안 씀(MSYS brittle 회피).

- [ ] **Step 4: type-check + 테스트**

```bash
cd uniqn-mobile
npm run type-check && npm test
```

Expected: 모두 PASS.

- [ ] **Step 5: 커밋**

```bash
cd uniqn-mobile
git add -A
git commit -m "chore(shared): Timestamp 클래스 삭제 (Firebase Firestore 모방 데드코드)

- 런타임/테스트 모두 ISO string 마이그레이션 완료
- 0 import 확인됨"
```

---

### Task 13: knip 데드코드 검증

**Files:** 없음 (검증)

- [ ] **Step 1: knip 실행**

```bash
cd uniqn-mobile
npx knip
```

Expected: TimestampLike 관련 export 잔존 시 보고. 없으면 통과.

- [ ] **Step 2: 발견 데드코드 정리 (있다면)**

진짜 데드코드면 제거. 동적 사용/peer dep이면 `knip.json`에 ignore 추가.

- [ ] **Step 3: 커밋 (변경 있다면)**

```bash
cd uniqn-mobile
git add -A
git commit -m "chore: knip 데드코드 정리 (Timestamp 청산 부산물)"
```

---

## Phase 5 — 최종 검증

### Task 14: Quality Gate

- [ ] **Step 1: quality 체크**

```bash
cd uniqn-mobile
npm run quality
```

Expected: type-check + lint + format:check 모두 PASS.

- [ ] **Step 2: 전체 테스트**

```bash
cd uniqn-mobile
npm test
```

Expected: 모든 테스트 PASS.

- [ ] **Step 3: evidence 캡처**

콘솔에:
- type-check: `Found 0 errors`
- lint: `0 errors, 0 warnings`
- format: `All matched files use Prettier code style!`
- test: `Tests: N passed, M total`

---

### Task 15: E2E 검증 + DB state 확인 (outside voice Medium 12)

- [ ] **Step 1: 개발 서버 실행**

```bash
cd uniqn-mobile
npm start
```

- [ ] **Step 2: 시나리오 1 — 공고 생성 → 즉시 수정**

웹 또는 시뮬레이터에서:
1. employer 로그인 → 공고 작성 → 저장 (생성 200 확인)
2. 같은 공고 수정 → 저장 (수정 200 확인)

기대: 22007 에러 없음.

- [ ] **Step 3: 시나리오 2 — 마감 → 재오픈 → 다시 수정 (Issue 8A)**

1. 위 공고를 마감
2. 재오픈
3. 다시 수정 → 저장 (200 확인)

기대: 22007 에러 없음. closedAt이 객체로 저장됐던 경우의 회귀 시나리오.

- [ ] **Step 4: DB state 확인 (outside voice Medium 12)**

Supabase MCP 또는 SQL Editor에서:

```sql
SELECT id, created_at, updated_at, closed_at,
       jsonb_typeof(stats->'lastUpdatedAt') as stats_ts_type,
       jsonb_typeof(tournament_config->'submittedAt') as tournament_ts_type
FROM job_postings
WHERE owner_id = '<test owner>'
ORDER BY updated_at DESC
LIMIT 5;
```

기대:
- `created_at`, `updated_at`, `closed_at`이 timestamptz 형태(string)
- JSONB 내부 timestamp 필드가 `string`(ISO) — `object`가 아님

JSONB 내부가 `object`면 schema 변경 후 silent shape change. C1 회귀 발생 → 즉시 plan에 추가 fix 등록.

- [ ] **Step 5: 콘솔 로그 / 디바이스 로그 확인**

기대: `invalid input syntax for type timestamp` 메시지 없음. `[INFO] 공고 수정 완료` 정상 출력.

- [ ] **Step 6: evidence 기록**

스크린샷 + DB 쿼리 결과 → PR description에 첨부.

---

### Task 16: 메모리 + Rules 업데이트

**Files:**
- Create: `C:\Users\user\.claude\projects\C--Users-user-Desktop-T-HOLDEM\memory\project_firebase_timestamp_cleanup.md`
- Modify: `C:\Users\user\.claude\projects\C--Users-user-Desktop-T-HOLDEM\memory\MEMORY.md`
- Modify: `uniqn-mobile/.claude/rules/supabase-patterns.md`

- [ ] **Step 1: 프로젝트 메모리 작성**

```markdown
---
name: Firebase Timestamp 스키마 청산 (2026-04-19)
description: timestampSchema가 ISO string을 {seconds, nanoseconds} 객체로 변환하던 Firebase 호환 레거시를 제거. ISO string 통일로 Supabase round-trip 일관 + JSONB nested timestamp 호환성 보존.
type: project
---

## 배경
2026-04-11 Firebase → Supabase 이전 시 `timestampSchema`(common.ts) 변환 로직 미정리.
ISO string을 read 시 `{toDate, seconds, nanoseconds}` 객체로 변환하다가, Repository update에서
그 객체가 그대로 PATCH 본문에 들어가 PostgreSQL 22007 (invalid input syntax for type
timestamp with time zone) 발생.

## 해결 (v3 — outside voice 권장 채택)
Date 반환이 아닌 **ISO string 반환**으로 통일.
- Supabase는 string으로 주고받으니 변환 자체가 불필요
- JSONB 내부 timestamp 필드도 string 유지 → 외부 consumer 호환성 보존
- Date가 필요한 view layer 사이트만 `toDate(str)` 호출

## 진실원
`utils/date/core.ts:normalizeToIsoString(val): string` — 모든 입력 형태(Date/TimestampLike/{seconds,nanoseconds}/sentinel/ISO string)를 strict ISO 8601로 정규화.
- timestampSchema(Zod)가 위임 (throw → ZodIssue)
- toDate()는 string→Date lenient (null fallback, view layer 전용)

## 영향 (검증 완료)
- 공고 수정/생성/마감/재오픈 정상 동작 (E2E 확인)
- DB JSONB 내부 timestamp 형태 string 유지 확인
- 22007 회귀 가드 (createdAt + closedAt 모두 커버)

**Why:** Firebase 레거시는 Supabase 마이그레이션과 함께 청산되어야 하나 schema layer만 잔존했음. 22007 에러로 표면화. v2(Date 반환)는 JSONB silent shape change 위험 → v3(string 반환)로 pivot.

**How to apply:** 이후 timestamp 처리는 모두 ISO string 기반. timestampSchema는 모든 외부 입력 형태를 받지만 항상 string으로 정규화. Date가 필요한 view 사이트만 `toDate(str)` 호출. `.toDate()`/`.seconds`/`.nanoseconds`는 코드베이스에서 제거됨 — 새로 추가하지 말 것.
```

- [ ] **Step 2: MEMORY.md 인덱스에 한 줄 추가**

```markdown
- [Firebase Timestamp 스키마 청산 (2026-04-19)](project_firebase_timestamp_cleanup.md) — timestampSchema ISO string 통일, 22007 + JSONB shape change 동시 차단
```

- [ ] **Step 3: supabase-patterns.md 패턴 #10 추가**

```markdown
## 패턴 #10: Timestamp는 ISO string으로 통일

**규칙:** 모든 timestamp는 ISO 8601 string으로 다룬다. `{seconds, nanoseconds}` 객체나 `.toDate()` 메서드 schema 결과에서 호출 금지.

**이유:** Firebase Firestore 레거시. Supabase는 timestamptz를 ISO string으로 주고받음. string 통일로 (a) round-trip 일관, (b) JSONB nested timestamp 호환성 보존, (c) view layer 변환 격리.

**진실원:** `src/utils/date/core.ts:normalizeToIsoString(val): string` (Zod throw 호환). View layer는 `toDate(str): Date | null` (null fallback).

**예외:** `criticalOfflineCache`의 MMKV 직렬화는 Date → ISO string 저장 (디버깅 친화).

**금지:** `Timestamp.now()`, `new Timestamp()`, `value.toDate()` (schema 결과에서), `value.seconds`, `value.nanoseconds`. 모두 코드베이스에서 제거됨.
```

- [ ] **Step 4: 커밋**

```bash
cd C:/Users/user/Desktop/T-HOLDEM
git add uniqn-mobile/.claude/rules/supabase-patterns.md
git commit -m "docs(rules): supabase-patterns.md 패턴 #10 (Timestamp ISO string 통일) 추가"
```

(메모리 파일은 git tracking 외부 — 별도 커밋 불필요)

---

## Phase 6 — PR

### Task 17: PR 생성

- [ ] **Step 1: 전체 diff 검토**

```bash
git log master..HEAD --oneline
```

- [ ] **Step 2: 별도 브랜치로 분기 (현재 master 작업 중이라면)**

```bash
git checkout -b fix/firebase-timestamp-schema-cleanup
git push -u origin fix/firebase-timestamp-schema-cleanup
```

- [ ] **Step 3: PR 생성**

```bash
gh pr create --title "fix(schemas): Firebase Timestamp 레거시 청산 — ISO string 통일 + 22007 차단" --body "$(cat <<'EOF'
## 요약
- `timestampSchema`가 ISO string을 `{seconds, nanoseconds}` 객체로 변환하던 Firebase Firestore 호환 레거시 제거
- 모든 timestamp 입력 형태를 ISO 8601 string으로 통일 정규화
- Repository write 시 객체 leak으로 발생하던 PostgreSQL 22007 400 에러 근본 차단
- JSONB 내부 timestamp 필드의 silent schema shift도 동시 방지 (외부 consumer 호환성 보존)

## 왜 ISO string 반환인가 (Date 반환이 아닌)
Outside voice 검토 결과:
1. Supabase는 timestamptz를 string으로 주고받음 → 변환 자체가 불필요
2. Date 반환은 JSONB 내부 timestamp까지 Date로 파싱 → write 시 ISO string으로 직렬화 → 외부 SQL/edge function/분석이 `stats.lastUpdatedAt.seconds` 읽으면 undefined (silent shape change)
3. ISO string 반환은 round-trip 일관 + JSONB 무영향 + view layer만 `toDate(str)` 호출

## 변경
- `src/utils/date/core.ts`: `normalizeToIsoString(val): string` 신설 (정규화 진실원)
- `src/schemas/common.ts`: `timestampSchema` `normalizeToIsoString` 위임
- `src/schemas/application.schema.ts`: `cancellationRequestTimestampSchema` union 단순화
- `src/services/offline/criticalOfflineCache.ts`: `isTimestampLike` 분기 제거
- `src/shared/time/Timestamp.ts`: 클래스 삭제
- 회귀 테스트: `JobPostingRepository.update.regression.test.ts` (createdAt + closedAt)
- TypeScript cascade fix: 디렉토리별 commit 분할

## 영향
- 공고 수정/생성/마감/재오픈 정상 동작 (E2E + DB state 확인)
- 같은 패턴 잠복 가능성이 있던 다른 Repository(application/workLog/notification) 자동 보호
- JSONB 내부 timestamp 필드 string 형태 유지 (외부 consumer 호환)

## Test plan
- [ ] `npm run quality` PASS (type-check + lint + format)
- [ ] `npm test` 전체 PASS (신규 회귀 테스트 + normalizeToIsoString + common.test 포함)
- [ ] E2E: 공고 생성/수정 시 22007 에러 없음
- [ ] E2E: 마감 → 재오픈 → 다시 수정 시 22007 에러 없음
- [ ] DB state: JSONB 내부 timestamp 필드가 `string` 형태로 저장됨 (object 아님)
- [ ] knip dead code 0
EOF
)"
```

- [ ] **Step 4: PR URL 사용자에게 전달**

---

## Self-Review (Plan v3 자체 점검)

### 1. Spec coverage
- ✅ 근본 원인(timestampSchema 변환) → Task 4
- ✅ 정규화 진실원 신설 → Task 2 (`normalizeToIsoString`)
- ✅ 모든 `.toDate()` cascade fix → Task 6
- ✅ TimestampLike 인터페이스 제거 → Task 2
- ✅ Timestamp 클래스 삭제 → Task 12
- ✅ 회귀 테스트 (createdAt + closedAt) → Task 11
- ✅ E2E + DB state → Task 15
- ✅ outbox/큐 점검 → Task 8
- ✅ cast 사이트 점검 → Task 7
- ✅ cancellationRequest union → Task 9
- ✅ 데드코드 검증 → Task 13
- ✅ 메모리/룰 → Task 16

### 2. Outside voice findings 반영
- ✅ C1 (JSONB silent shape change) → string 반환 채택으로 근본 해소 + Task 15 Step 4 DB state 확인
- ✅ C2 (cancellationRequestTimestampSchema) → Task 9
- ✅ C3 (회귀 테스트 false negative) → Task 11 Step 2 사전 코드 inspection
- ✅ H1 (optional null round-trip) → Task 3 단위 테스트에 round-trip 검증
- ✅ H2 (`"12345"` numeric string) → STRICT_ISO_8601 정규식 + Task 1 단위 테스트
- ✅ H3 (`as any` cast 사이트) → Task 7
- ✅ H4 (single-file type-check 무의미) → Task 5는 전체 프로젝트 type-check
- ✅ Medium 11 (rmdir Windows brittle) → Task 12 Step 3 `git rm -r`
- ✅ Medium 12 (E2E DB state check) → Task 15 Step 4

### 3. Placeholder scan
- "각 파일을 확인" 같은 vague step 없음
- 모든 step에 명시 코드/명령

### 4. Type consistency
- `normalizeToIsoString` 시그니처 (val: unknown): string — Task 1, 2, 4 모두 일치
- `toDate` 시그니처 변경(DateInput | unknown) → null — Task 2, 6 일치

### 5. 위험 노트
- Task 6 (cascade fix)이 가장 큰 단위 작업. 디렉토리 분할 commit으로 리뷰 가능성 확보.
- Task 11 Step 5 (Red-Green-Verify with stash)는 회귀 가드 검출력 검증. 건너뛰면 false negative 위험.
- Task 15 Step 4 (DB state 확인)는 outside voice C1의 진짜 회귀 가드. JSONB 내부가 object면 plan에 추가 fix 등록 필요.

---

## Worktree Parallelization

| Lane | Task | Depends |
|------|------|---------|
| **A (sequential)** | 1 → 2 → 3 → 4 | (Phase 1) |
| **B (sequential)** | 5 → 6 | A 완료 후 |
| **C (parallel after Task 4)** | 7, 8, 9, 10 | Task 4 후 병렬 가능 |
| **D (sequential)** | 11 (Red-Green-Verify) | A+B+C |
| **E (sequential)** | 12 → 13 → 14 → 15 → 16 → 17 | D 후 |

**실용 권장:** subagent-driven 직렬 실행. 각 task가 5~30분 단위라 worktree 오버헤드 > 병렬 이득.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-04-19-firebase-timestamp-schema-cleanup.md` (v3 — ISO string).

**1. Subagent-Driven (recommended)** - Fresh subagent per task, two-stage review between tasks. Phase 2 cascade fix가 파일 수 가변이라 fresh context 유리.

**2. Inline Execution** - Phase 단위 checkpoint.

권장: **Subagent-Driven**.

---

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 0 | — | — |
| Codex Review | `/codex review` | Independent 2nd opinion | 1 | rate-limit | codex usage limit hit, fell back to Claude subagent |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 1 | issues_resolved | 9 issues found + outside voice 5 critical/4 high — all resolved by v3 pivot |
| Design Review | `/plan-design-review` | UI/UX gaps | 0 | — | — |
| DX Review | `/plan-devex-review` | Developer experience gaps | 0 | — | — |

**OUTSIDE VOICE:** Claude subagent (codex 사용한도 초과로 fallback). C1 JSONB silent shape change 발견이 v3 pivot 결정 driver. C2 cancellationRequest union, C3 회귀 false negative 등 모두 v3에 반영.

**CROSS-MODEL:** Claude main(Date 반환) vs Subagent(string 반환) tension. 사용자 결정으로 string 채택 — 더 근본적 + JSONB 호환성 보존.

**UNRESOLVED:** 0

**VERDICT:** ENG CLEARED — outside voice findings 모두 plan에 반영. 실행 준비 완료.
