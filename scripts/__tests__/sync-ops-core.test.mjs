// sync-ops-core 순수 함수 회귀 테스트 — `node --test scripts/__tests__/sync-ops-core.test.mjs`
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  buildOutputs,
  globMatches,
  rewriteSpecifier,
  rewriteImports,
  injectVitestImports,
  extractConsts,
  extractFunction,
  findLeftoverAliases,
  extractOpsEnums,
  extractInterfaceFields,
  compareMajorVersions,
} from '../sync-ops-core.mjs';

test('rewriteSpecifier: 일반 @/ 경로는 @/core/ 로', () => {
  assert.equal(rewriteSpecifier('@/types/ops'), '@/core/types/ops');
  assert.equal(rewriteSpecifier('@/domains/ops/opsEventDate'), '@/core/domains/ops/opsEventDate');
});

test('rewriteSpecifier: 예외 매핑이 일반 규칙보다 우선', () => {
  assert.equal(rewriteSpecifier('@/errors'), '@/core/errors/AppError');
  assert.equal(rewriteSpecifier('@/types/supabase'), '@/core/opsEnums');
  assert.equal(rewriteSpecifier('@/types'), '@/core/types');
  assert.equal(rewriteSpecifier('@/utils/supabase'), '@/lib/supabaseUtils');
  assert.equal(rewriteSpecifier('@/utils/logger'), '@/lib/logger');
  assert.equal(rewriteSpecifier('@/lib/supabase'), '@/lib/supabase');
});

test('rewriteSpecifier: 상대·패키지 경로는 그대로', () => {
  assert.equal(rewriteSpecifier('./common'), './common');
  assert.equal(rewriteSpecifier('zod'), 'zod');
  assert.equal(rewriteSpecifier('date-fns/locale/ko'), 'date-fns/locale/ko');
});

test('rewriteImports: import/export from 과 여러 줄 import 모두 치환', () => {
  const src = [
    "import { z } from 'zod';",
    'import {',
    '  a,',
    "} from '@/types/ops';",
    "export { b } from '@/errors';",
    "import type { UserProfile } from '@/types';",
  ].join('\n');
  const out = rewriteImports(src);
  assert.match(out, /from '@\/core\/types\/ops'/);
  assert.match(out, /from '@\/core\/errors\/AppError'/);
  assert.match(out, /from '@\/core\/types'/);
  assert.match(out, /from 'zod'/);
});

test('rewriteImports: 주석 속 예시 import 는 건드리지 않는다', () => {
  const src = " * import type { UserRole } from '@/types/role';";
  assert.equal(rewriteImports(src), src);
});

test('injectVitestImports: 실제로 쓴 전역만 가져온다(noUnusedLocals)', () => {
  const src = "describe('x', () => {\n  it('y', () => {\n    expect(1).toBe(1);\n  });\n});\n";
  const out = injectVitestImports(src);
  assert.match(out, /^import \{ describe, expect, it \} from 'vitest';\n/);
});

test('injectVitestImports: jest API 를 쓰는 테스트는 거부', () => {
  assert.throws(() => injectVitestImports("jest.fn();\nit('a', () => {});"), /jest/);
});

test('extractConsts: 여러 줄 선언을 세미콜론까지 발췌', () => {
  const src = [
    "import { z } from 'zod';",
    'export const A = 1;',
    'export const B = z',
    '  .string()',
    "  .refine((v) => v.length > 0, 'x');",
    'export const C = 3;',
  ].join('\n');
  assert.equal(
    extractConsts(src, ['B']),
    "export const B = z\n  .string()\n  .refine((v) => v.length > 0, 'x');"
  );
  assert.throws(() => extractConsts(src, ['Missing']), /Missing/);
});

test('extractConsts: export 없는 const·타입 주석도 발췌하고 export 를 붙인다', () => {
  const src = "const MAP: Record<string, number> = {\n  a: 1,\n};\n";
  assert.equal(extractConsts(src, ['MAP']), 'export const MAP: Record<string, number> = {\n  a: 1,\n};');
});

test("extractConsts: 문자열 속 ')' 로 깊이가 음수가 되면 잘못 자르지 않고 실패", () => {
  const src = "export const M = ':)';\nfunction f() {\n  return 1;\n}\n";
  assert.throws(() => extractConsts(src, ['M']), /음수/);
});

test('rewriteImports: 앞 줄 코드에서 시작해 뒤 주석·템플릿 문자열까지 넘어가지 않는다', () => {
  const src = "export function f() {}\n// copied from '@/foo'\nconst s = `x from '@/zzz'`;";
  assert.equal(rewriteImports(src), src);
});

test('findLeftoverAliases: 동적 import·import 타입의 @/ 는 잡고, core·주석은 통과', () => {
  const src = [
    "const m = await import('@/lib/env');",
    "type T = import('@/types/ops').X;",
    "import { a } from '@/core/x';",
    "import { h } from '@/lib/supabaseUtils';",
    " * import type { UserRole } from '@/types/role';",
  ].join('\n');
  assert.deepEqual(findLeftoverAliases(src), [
    "1: const m = await import('@/lib/env');",
    "2: type T = import('@/types/ops').X;",
  ]);
});

test('extractOpsEnums: Constants 에서 ops_ enum 만 남긴다', () => {
  const src = [
    'export type Json = string;',
    'export const Constants = {',
    '  public: {',
    '    Enums: {',
    "      board_type: ['notice'],",
    "      ops_table_status: ['open', 'closed'],",
    "      ops_event_type: [",
    "        'a',",
    "        'b',",
    '      ],',
    '    },',
    '  },',
    '} as const;',
  ].join('\n');
  assert.deepEqual(extractOpsEnums(src), {
    ops_event_type: ['a', 'b'],
    ops_table_status: ['open', 'closed'],
  });
});

test('extractInterfaceFields: 인터페이스에서 지정 필드 줄만', () => {
  const src = [
    'export interface UserProfile {',
    '  uid: string;',
    "  socialProvider?: 'apple' | 'google';",
    '}',
  ].join('\n');
  assert.deepEqual(extractInterfaceFields(src, 'UserProfile', ['socialProvider']), [
    "  socialProvider?: 'apple' | 'google';",
  ]);
  assert.throws(() => extractInterfaceFields(src, 'UserProfile', ['nope']), /nope/);
});

test('compareMajorVersions: 메이저가 다르면 목록으로 돌려준다', () => {
  assert.deepEqual(
    compareMajorVersions({ zod: '^4.1.13', 'date-fns': '^4.1.0' }, { zod: '^4.6.5', 'date-fns': '^4.1.0' }, [
      'zod',
      'date-fns',
    ]),
    []
  );
  assert.deepEqual(compareMajorVersions({ zod: '^4.1.0' }, { zod: '^3.9.0' }, ['zod']), [
    'zod: 모바일 ^4.1.0 ↔ 웹 ^3.9.0',
  ]);
  assert.deepEqual(compareMajorVersions({ zod: '^4.1.0' }, {}, ['zod']), ['zod: 모바일 ^4.1.0 ↔ 웹 (없음)']);
});

test('globMatches: * 는 한 단계, ** 는 여러 단계', () => {
  assert.ok(globMatches('uniqn-mobile/src/domains/ops/**', 'uniqn-mobile/src/domains/ops/clock/a.ts'));
  assert.ok(globMatches('uniqn-mobile/src/schemas/ops*.schema.ts', 'uniqn-mobile/src/schemas/opsSeat.schema.ts'));
  assert.ok(!globMatches('uniqn-mobile/src/schemas/ops*.schema.ts', 'uniqn-mobile/src/schemas/x/opsSeat.schema.ts'));
});

// 🔑 워크플로 paths 에 정본이 빠지면 모바일만 고친 PR 이 --check 를 건너뛰어 드리프트가 머지된다.
test('ops-web 워크플로 paths(pull_request·push)가 모든 동기화 정본을 덮는다', () => {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
  const yml = fs.readFileSync(path.join(root, '.github', 'workflows', 'ops-web.yml'), 'utf8');
  const blocks = [...yml.matchAll(/^\s{4}paths:\n((?:\s{6}- '.*'\n)+)/gm)].map((m) =>
    [...m[1].matchAll(/- '([^']+)'/g)].map((x) => x[1])
  );
  assert.equal(blocks.length, 2, 'pull_request·push 두 곳의 paths 블록을 찾지 못했습니다');
  const sources = new Set(
    [...buildOutputs().values()].flatMap(({ sources: s }) => s.map((rel) => `uniqn-mobile/src/${rel}`))
  );
  for (const patterns of blocks) {
    const missing = [...sources].filter((src) => !patterns.some((p) => globMatches(p, src)));
    assert.deepEqual(missing, []);
  }
});

test('extractFunction: 본문 끝까지 발췌하고 export 를 붙인다', () => {
  const src = [
    'const X = 1;',
    'function toCamel<T>(o: Record<string, unknown>): T {',
    '  if (o) {',
    '    return o as T;',
    '  }',
    '  return {} as T;',
    '}',
    'export const Y = 2;',
  ].join('\n');
  assert.equal(
    extractFunction(src, 'toCamel'),
    'export function toCamel<T>(o: Record<string, unknown>): T {\n  if (o) {\n    return o as T;\n  }\n  return {} as T;\n}'
  );
  assert.throws(() => extractFunction(src, 'nope'), /nope/);
});
