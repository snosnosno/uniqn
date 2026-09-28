#!/usr/bin/env node
/**
 * ops 도메인 정본(`uniqn-mobile/src`) → ops 웹 사본(`ops-web/src/core`) 동기화.
 *
 * 설계: docs/planning/2026-09-27-ops-web-design.md §3.2 — packages 공유 대신 **동기화 사본 + CI 파리티**.
 *
 *   node scripts/sync-ops-core.mjs          # 사본 재생성
 *   node scripts/sync-ops-core.mjs --check  # 정본과 사본이 다르면 exit 1 (CI 게이트)
 *
 * 하는 일
 * 1. 대상 파일을 복사하며 `@/x` import 를 `@/core/x` 로 치환한다(예외 매핑은 REMAP).
 * 2. 치환 후 모든 `@/core/*`·상대 import 가 사본 안에서 풀리는지 검사한다 — 새 의존이 생기면
 *    조용히 깨지지 않고 여기서 실패한다(대상 목록에 추가하거나 REMAP 으로 웹 소유 모듈에 연결).
 * 3. 통째로 옮기면 안 되는 파일은 **발췌**한다: supabase 생성 타입의 ops enum, common 의 uuid 스키마,
 *    UserProfile 의 socialProvider.
 * 4. 정본 테스트(jest 전역만 쓰는 것)를 vitest import 를 붙여 이식한다.
 * 5. 각 파일 상단에 "자동 생성" 헤더, `core/manifest.json` 에 정본 해시를 기록한다.
 *
 * 레포 루트엔 node_modules 가 없다 — Node 내장 모듈만 쓴다.
 */
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC_DIR = path.join(ROOT, 'uniqn-mobile', 'src');
const OUT_DIR = path.join(ROOT, 'ops-web', 'src', 'core');
const SRC_LABEL = 'uniqn-mobile/src';

/** 통째로 복사하는 정본 파일(SRC_DIR 기준). 디렉터리는 하위 .ts 전부(`__tests__` 제외). */
const COPY_DIRS = ['domains/ops'];
const COPY_FILES = [
  'types/ops.ts',
  'types/role.ts',
  'utils/security.ts',
  'utils/text/josa.ts',
  'constants/messages/index.ts',
  'constants/messages/failure.ts',
  'errors/AppError.ts',
  'hooks/ops/publicPollingPolicy.ts',
  'shared/navigation/authRedirect.ts',
  'repositories/supabase/opsRpcError.ts',
  // W2 — 로그인·비밀번호 재설정 입력 규칙(비밀번호 정책 포함)을 모바일과 같게
  'schemas/auth.schema.ts',
  // W3 — Repository·Service 도 사본으로 공유한다: RPC 이름·인자 매핑·경계 검증이 한 벌이어야
  //      두 UI 가 같은 서버 계약을 쓴다(손 이식은 인자명 드리프트가 조용히 난다).
  'errors/errorUtils.ts',
  'errors/serviceErrorHandler.ts',
  'repositories/ops.ts',
  // W4 — 화면 쪽 순수 헬퍼(금액 파싱·지급 대장 행·상금 문구). RN 의존 0.
  'utils/formatters/currency.ts',
  'components/ops/payoutRows.ts',
  'components/ops/payoutMessages.ts',
  // W6 — 근태 기록 정산 잠금 문구(단일 소스)
  'domains/settlement/settledLockMessage.ts',
];

/** 디렉터리별 파일명 규칙으로 고르는 사본. `exclude` 는 이유를 주석으로 남긴다. */
const PATTERN_COPIES = [
  { dir: 'schemas', re: /^ops.*\.schema\.ts$/ },
  { dir: 'repositories/interfaces', re: /^IOps.*Repository\.ts$/ },
  { dir: 'repositories/supabase', re: /^Ops.*Repository\.ts$/ },
  {
    dir: 'services/ops',
    re: /^ops.*Service\.ts$/,
  },
];

/** 이식하는 정본 테스트. 디렉터리는 하위 `__tests__/*.test.ts` 전부. */
const TEST_DIRS = ['domains/ops'];
const TEST_FILES = [
  'schemas/__tests__/ops.schema.test.ts',
  'schemas/__tests__/opsBlindLevel.schema.test.ts',
  'schemas/__tests__/opsPrize.schema.test.ts',
  'schemas/__tests__/opsSeat.schema.test.ts',
  'hooks/ops/__tests__/publicPollingPolicy.test.ts',
  'shared/navigation/__tests__/authRedirect.test.ts',
  'components/ops/__tests__/payoutRows.test.ts',
  'components/ops/__tests__/payoutMessages.test.ts',
];

/**
 * 일반 규칙(`@/x` → `@/core/x`)보다 우선하는 예외.
 * - `@/errors`: 배럴(index)이 채팅·알림 에러까지 끌고 온다 → 클래스·코드·문구가 있는 AppError 만.
 * - `@/types/supabase`: 생성 타입 파일은 옮기지 않고 ops enum 만 발췌(`opsEnums.ts`).
 * - `@/types`: 배럴 대신 authRedirect 가 쓰는 UserProfile 필드만 발췌(`types/index.ts`).
 * - `@/utils/supabase`: 모바일 싱글턴·로거에 묶여 있다 → 웹 소유 `lib/supabaseUtils.ts`
 *   (분류표·toCamelCase 는 그 파일이 사본 `supabaseTables.ts` 에서 가져온다).
 * - `@/utils/logger`·`@/lib/supabase`: 같은 모양의 웹 소유 모듈(로거·브라우저 클라이언트 싱글턴).
 */
const REMAP = {
  '@/errors': '@/core/errors/AppError',
  '@/types/supabase': '@/core/opsEnums',
  '@/types': '@/core/types',
  '@/utils/supabase': '@/lib/supabaseUtils',
  '@/utils/logger': '@/lib/logger',
  '@/lib/supabase': '@/lib/supabase',
  // opsStaffService 의 근태 기록 → 웹 소유 update_work_log_slot 래퍼(근무표 그리드 전체는 옮기지 않는다)
  '@/services/workSchedule/gridWriteService': '@/lib/workLogSlot',
};

/** 웹이 직접 소유하는(사본이 아닌) import 대상 — 폐포 검사에서 존재만 확인한다. */
const webFile = (rel) => path.join(ROOT, 'ops-web', 'src', ...rel.split('/'));
const WEB_OWNED = {
  '@/lib/supabaseUtils': webFile('lib/supabaseUtils.ts'),
  '@/lib/logger': webFile('lib/logger.ts'),
  '@/lib/supabase': webFile('lib/supabase.ts'),
  '@/lib/workLogSlot': webFile('lib/workLogSlot.ts'),
};

/** 두 앱이 같은 메이저를 써야 하는 런타임 의존(설계 §3.2 — 버전 드리프트 방지). */
const PINNED_DEPS = ['zod', 'date-fns'];

const VITEST_GLOBALS = [
  'afterAll',
  'afterEach',
  'beforeAll',
  'beforeEach',
  'describe',
  'expect',
  'it',
  'test',
];

// ─── 순수 함수 (scripts/__tests__/sync-ops-core.test.mjs) ─────────────────────

export function rewriteSpecifier(spec) {
  if (Object.hasOwn(REMAP, spec)) return REMAP[spec];
  if (spec.startsWith('@/')) return `@/core/${spec.slice(2)}`;
  return spec;
}

/**
 * 줄 시작(공백 허용)의 import/export … from '…' 만 치환 — 주석 속 예시는 ` * ` 로 시작해 제외된다.
 * 첫 분기는 줄을 넘지 않는다(`\n`·`;` 제외) — 여러 줄 import 는 `} from` 분기가 맡는다.
 * 넘게 두면 앞 줄의 코드에서 시작해 뒤 주석·템플릿 문자열의 `from '@/…'` 까지 치환한다(리뷰 W1).
 */
const FROM_RE =
  /^(\s*(?:import|export)\b[^'"\n;]*?\bfrom\s+|\s*\}\s*from\s+|\s*import\s+)(['"])([^'"]+)\2/gm;

/** 치환 후에도 남은 `@/` 경로(동적 import·import 타입·한 줄 두 import 등 FROM_RE 사각지대). */
const LEFTOVER_ALIAS_RE = new RegExp(
  `(['"])@\\/(?!core\\/|(?:${Object.keys(WEB_OWNED)
    .map((k) => k.slice(2))
    .join('|')})\\1)`
);

/** 주석 줄(`//`, ` * `, `/*`)을 뺀 코드 줄에서 사각지대 `@/` 를 찾는다. */
export function findLeftoverAliases(source) {
  return source
    .split('\n')
    .map((line, i) => ({ line, no: i + 1 }))
    .filter(({ line }) => !/^\s*(\/\/|\*|\/\*)/.test(line) && LEFTOVER_ALIAS_RE.test(line))
    .map(({ line, no }) => `${no}: ${line.trim()}`);
}

export function rewriteImports(source) {
  return source.replace(
    FROM_RE,
    (_m, head, quote, spec) => `${head}${quote}${rewriteSpecifier(spec)}${quote}`
  );
}

export function collectSpecifiers(source) {
  return [...source.matchAll(FROM_RE)].map((m) => m[3]);
}

export function injectVitestImports(source) {
  if (/\bjest\./.test(source)) {
    throw new Error('jest API(jest.fn 등)를 쓰는 테스트는 이식할 수 없습니다 — TEST_FILES 에서 빼세요');
  }
  const used = VITEST_GLOBALS.filter((name) => new RegExp(`\\b${name}\\s*[(.]`).test(source));
  if (used.length === 0) return source;
  return `import { ${used.join(', ')} } from 'vitest';\n${source}`;
}

/**
 * 최상위 `const NAME`(export 유무 무관) 선언을 세미콜론(괄호 깊이 0)까지 발췌한다.
 * 결과는 항상 `export const` 로 시작한다(생성 파일에서 가져다 쓰게).
 * 괄호 깊이가 음수가 되면(문자열 속 `)` 등) 잘못 자른 것이므로 즉시 실패한다.
 */
export function extractConsts(source, names) {
  const lines = source.split('\n');
  return names
    .map((name) => {
      const start = lines.findIndex((l) =>
        new RegExp(`^(export )?const ${name}[\\s:=]`).test(l)
      );
      if (start < 0) throw new Error(`발췌 대상 const ${name} 를 찾지 못했습니다`);
      let depth = 0;
      for (let i = start; i < lines.length; i += 1) {
        for (const ch of lines[i]) {
          if ('([{'.includes(ch)) depth += 1;
          else if (')]}'.includes(ch)) depth -= 1;
          if (depth < 0) throw new Error(`const ${name} 발췌 중 괄호 깊이가 음수 — 규칙 점검 필요`);
        }
        if (depth === 0 && lines[i].trimEnd().endsWith(';')) {
          const block = lines.slice(start, i + 1).join('\n');
          return block.startsWith('export ') ? block : `export ${block}`;
        }
      }
      throw new Error(`const ${name} 의 끝(;)을 찾지 못했습니다`);
    })
    .join('\n\n');
}

/**
 * 최상위 `function NAME`(export 유무 무관)을 본문 끝 `}`(중괄호 깊이 0)까지 발췌, `export` 를 붙인다.
 * 문자열 속 중괄호로 깊이가 음수가 되면 실패한다.
 */
export function extractFunction(source, name) {
  const lines = source.split('\n');
  const start = lines.findIndex((l) => new RegExp(`^(export )?function ${name}[<(]`).test(l));
  if (start < 0) throw new Error(`발췌 대상 function ${name} 를 찾지 못했습니다`);
  let depth = 0;
  let opened = false;
  for (let i = start; i < lines.length; i += 1) {
    for (const ch of lines[i]) {
      if (ch === '{') {
        depth += 1;
        opened = true;
      } else if (ch === '}') depth -= 1;
      if (depth < 0) throw new Error(`function ${name} 발췌 중 중괄호 깊이가 음수 — 규칙 점검 필요`);
    }
    if (opened && depth === 0) {
      const block = lines.slice(start, i + 1).join('\n');
      return block.startsWith('export ') ? block : `export ${block}`;
    }
  }
  throw new Error(`function ${name} 의 끝을 찾지 못했습니다`);
}

/** supabase 생성 타입의 `Constants.public.Enums` 에서 `ops_*` 만 꺼낸다. */
export function extractOpsEnums(source) {
  const block = extractConsts(source, ['Constants']);
  const literal = block
    .replace(/^export const Constants\s*=\s*/, '')
    .replace(/\s*as const;\s*$/, '');
  // 생성 파일은 문자열 배열로만 된 객체 리터럴이다 — 식별자·호출이 섞이면 거부한다.
  if (/[^\s\w'",:[\]{}-]/.test(literal)) {
    throw new Error('Constants 리터럴에 예상 밖 문법이 있습니다 — 발췌 규칙을 점검하세요');
  }
  const json = literal
    .replace(/'/g, '"')
    .replace(/([{,\s])(\w+):/g, '$1"$2":')
    .replace(/,(\s*[}\]])/g, '$1');
  const enums = JSON.parse(json).public.Enums;
  return Object.fromEntries(
    Object.keys(enums)
      .filter((k) => k.startsWith('ops_'))
      .sort()
      .map((k) => [k, enums[k]])
  );
}

/** `export interface NAME { … }` 안에서 지정 필드 선언 줄만 꺼낸다(문서 주석 제외). */
export function extractInterfaceFields(source, iface, fields) {
  const lines = source.split('\n');
  const start = lines.findIndex((l) => l.startsWith(`export interface ${iface} `));
  if (start < 0) throw new Error(`interface ${iface} 를 찾지 못했습니다`);
  const end = lines.findIndex((l, i) => i > start && l.startsWith('}'));
  const body = lines.slice(start + 1, end);
  return fields.map((field) => {
    const line = body.find((l) => new RegExp(`^\\s+${field}\\??:`).test(l));
    if (!line) throw new Error(`${iface}.${field} 필드를 찾지 못했습니다`);
    return line;
  });
}

const major = (range) => (range ? (/(\d+)/.exec(range)?.[1] ?? null) : null);

export function compareMajorVersions(mobileDeps, webDeps, names) {
  return names
    .filter((n) => major(mobileDeps[n]) !== major(webDeps[n]))
    .map((n) => `${n}: 모바일 ${mobileDeps[n] ?? '(없음)'} ↔ 웹 ${webDeps[n] ?? '(없음)'}`);
}

// ─── 파일 생성 ─────────────────────────────────────────────────────────────────

const toPosix = (p) => p.split(path.sep).join('/');
const readSource = (rel) => fs.readFileSync(path.join(SRC_DIR, rel), 'utf8').replace(/\r\n/g, '\n');
const sha256 = (text) => createHash('sha256').update(text).digest('hex');

/**
 * 디렉터리의 .ts(`tests=false`) 또는 `__tests__/*.test.ts`(`tests=true`).
 * 이 규칙 밖의 파일(.tsx·__tests__ 하위 폴더·__tests__ 밖 테스트)은 조용히 빠지지 않게 실패시킨다.
 */
function walkTs(relDir, { tests }) {
  const out = [];
  const unsupported = (rel) => {
    throw new Error(`동기화 규칙 밖의 파일: ${rel} — scripts/sync-ops-core.mjs 의 walkTs 를 확장하세요`);
  };
  const visit = (rel) => {
    for (const entry of fs.readdirSync(path.join(SRC_DIR, rel), { withFileTypes: true })) {
      const childRel = `${rel}/${entry.name}`;
      if (entry.isSymbolicLink()) unsupported(childRel);
      if (entry.isDirectory()) {
        if (entry.name === '__tests__') {
          for (const t of fs.readdirSync(path.join(SRC_DIR, childRel), { withFileTypes: true })) {
            if (!t.isFile() || !t.name.endsWith('.test.ts')) unsupported(`${childRel}/${t.name}`);
            if (tests) out.push(`${childRel}/${t.name}`);
          }
          continue;
        }
        visit(childRel);
      } else if (entry.name.endsWith('.tsx') || /\.test\.ts$/.test(entry.name)) {
        unsupported(childRel);
      } else if (!tests && entry.name.endsWith('.ts')) {
        out.push(childRel);
      }
    }
  };
  visit(relDir);
  return out;
}

const header = (sources) =>
  `// ⚠️ 자동 생성 파일 — 직접 수정 금지. 정본: ${sources
    .map((s) => `${SRC_LABEL}/${s}`)
    .join(', ')}\n// 갱신: node scripts/sync-ops-core.mjs (설계 docs/planning/2026-09-27-ops-web-design.md §3.2)\n`;

/** 워크플로 paths 필터 글롭(`*`·`**`)이 레포 상대경로에 맞는가. */
export function globMatches(pattern, repoPath) {
  const re = pattern
    .split('**')
    .map((part) => part.split('*').map((s) => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('[^/]*'))
    .join('.*');
  return new RegExp(`^${re}$`).test(repoPath);
}

/** @returns {Map<string, {content: string, sources: string[]}>} 출력 상대경로 → 내용 */
export function buildOutputs() {
  const outputs = new Map();
  const put = (outRel, sources, body) => outputs.set(outRel, { sources, content: header(sources) + body });

  const patternFiles = PATTERN_COPIES.flatMap(({ dir, re, exclude = [] }) =>
    fs
      .readdirSync(path.join(SRC_DIR, dir))
      .filter((f) => re.test(f) && !exclude.includes(f))
      .sort()
      .map((f) => `${dir}/${f}`)
  );
  const copies = [
    ...COPY_DIRS.flatMap((d) => walkTs(d, { tests: false })),
    ...COPY_FILES,
    ...patternFiles,
  ];
  for (const rel of copies) put(rel, [rel], rewriteImports(readSource(rel)));

  const tests = [...TEST_DIRS.flatMap((d) => walkTs(d, { tests: true })), ...TEST_FILES];
  for (const rel of tests) {
    try {
      put(rel, [rel], injectVitestImports(rewriteImports(readSource(rel))));
    } catch (e) {
      throw new Error(`${rel}: ${e.message}`);
    }
  }

  // 발췌 1 — ops enum (supabase gen types 정본은 옮기지 않는다)
  const enums = extractOpsEnums(readSource('types/supabase.ts'));
  const enumBody = Object.entries(enums)
    .map(([k, vals]) => `      ${k}: [${vals.map((v) => `'${v}'`).join(', ')}],`)
    .join('\n');
  put(
    'opsEnums.ts',
    ['types/supabase.ts'],
    `/** supabase 생성 타입 \`Constants\` 에서 ops enum 만 발췌 — 모양은 원본과 같다. */\nexport const Constants = {\n  public: {\n    Enums: {\n${enumBody}\n    },\n  },\n} as const;\n`
  );

  // 발췌 2 — uuid 스키마 (common.ts 전체는 utils/date 를 끌고 온다)
  put(
    'schemas/common.ts',
    ['schemas/common.ts'],
    `import { z } from 'zod';\n\n${extractConsts(readSource('schemas/common.ts'), [
      'UUID_LIKE_RE',
      'uuidLikeSchema',
    ])}\n`
  );

  // 발췌 4 — Supabase 에러 분류표 + snake→camel 변환. 웹 소유 lib/supabaseUtils.ts 가 이 사본을
  // import 해서 모바일이 코드·규칙을 바꾸면 --check 가 드러낸다(손 이식본 드리프트 방지, 리뷰 W1).
  // 네트워크 문구 패턴은 errors/errorUtils.ts 사본(isNetworkErrorMessage)을 그대로 쓴다.
  const supabaseUtils = readSource('utils/supabase.ts');
  put(
    'supabaseTables.ts',
    ['utils/supabase.ts'],
    `import { ERROR_CODES } from '@/core/errors/AppError';\n\n${extractConsts(supabaseUtils, [
      'POSTGREST_ERROR_MAP',
      'KNOWN_ACRONYMS',
    ])}\n\n${extractFunction(supabaseUtils, 'toCamelCase')}\n`
  );

  // 발췌 5 — 이력 탭 이벤트 한글 라벨 + payload 요약(모바일 HistoryTab.tsx 안에 있다).
  //   Record<OpsEventType, …> 라 enum 이 늘면 모바일이 먼저 채우고, 사본은 --check 로 따라온다.
  const historyTab = readSource('components/ops/HistoryTab.tsx');
  put(
    'historyLabels.ts',
    ['components/ops/HistoryTab.tsx'],
    `import type { OpsEventType } from '@/core/types/ops';

${extractConsts(historyTab, [
      'EVENT_LABEL',
    ])}

${extractFunction(historyTab, 'summarizePayload')}
`
  );

  // 발췌 6 — 근태 기록 불가 사유 안내(모바일 StaffAttendanceSheet.tsx 안의 상수).
  const attendanceSheet = readSource('components/ops/StaffAttendanceSheet.tsx');
  put(
    'staffAttendanceNotices.ts',
    ['components/ops/StaffAttendanceSheet.tsx'],
    `import type { OpsStaffWorkLogReason } from '@/core/types/ops';

${extractConsts(
      attendanceSheet,
      ['REASON_NOTICE', 'NO_PERMISSION_NOTICE']
    )}
`
  );

  // 발췌 3 — authRedirect 가 쓰는 UserProfile 필드
  const fields = extractInterfaceFields(readSource('types/user.ts'), 'UserProfile', ['socialProvider']);
  put(
    'types/index.ts',
    ['types/user.ts'],
    `/** UserProfile 발췌 — 진입 판정(authRedirect)이 읽는 필드만. */\nexport interface UserProfile {\n${fields.join('\n')}\n}\n`
  );

  // 해시는 **생성 결과** 기준 — 발췌 원본(supabase.ts 등)의 무관한 부분이 바뀌어도 매니페스트가
  // 흔들리지 않는다(마이그레이션 PR 마다 빨간불이 나면 진짜 드리프트가 묻힌다, 리뷰 W1).
  const manifest = {
    note: '자동 생성 — node scripts/sync-ops-core.mjs. 사본 sha256·정본 경로 기록(검증은 --check 가 내용 전체로 한다).',
    files: Object.fromEntries(
      [...outputs.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([outRel, { sources, content }]) => [
          outRel,
          { sources: sources.map((s) => `${SRC_LABEL}/${s}`), sha256: sha256(content) },
        ])
    ),
  };
  outputs.set('manifest.json', { sources: [], content: `${JSON.stringify(manifest, null, 2)}\n` });
  return outputs;
}

/** 치환 후 import 가 사본(또는 웹 소유 모듈) 안에서 모두 풀리는지. */
export function assertClosure(outputs) {
  const exists = (outRelNoExt) =>
    outputs.has(`${outRelNoExt}.ts`) || outputs.has(`${outRelNoExt}/index.ts`);
  const problems = [];
  for (const [outRel, { content }] of outputs) {
    if (!outRel.endsWith('.ts')) continue;
    for (const spec of collectSpecifiers(content)) {
      if (Object.hasOwn(WEB_OWNED, spec)) {
        if (!fs.existsSync(WEB_OWNED[spec])) problems.push(`${outRel}: 웹 소유 모듈 없음 ${spec}`);
      } else if (spec.startsWith('@/core/')) {
        if (!exists(spec.slice('@/core/'.length))) problems.push(`${outRel}: 사본에 없음 ${spec}`);
      } else if (spec.startsWith('.')) {
        const target = toPosix(path.posix.join(path.posix.dirname(outRel), spec));
        if (!exists(target)) problems.push(`${outRel}: 사본에 없음 ${spec}`);
      } else if (spec.startsWith('@/')) {
        problems.push(`${outRel}: 치환되지 않은 경로 ${spec}`);
      }
    }
    for (const hit of findLeftoverAliases(content)) {
      problems.push(`${outRel}: 치환 규칙이 못 잡은 @/ 경로(동적 import 등) — ${hit}`);
    }
  }
  if (problems.length > 0) {
    throw new Error(
      `의존 폐포가 닫히지 않았습니다 — COPY_FILES 에 추가하거나 REMAP 으로 연결하세요:\n  ${problems.join('\n  ')}`
    );
  }
}

function listExisting(dir, base = dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    return e.isDirectory() ? listExisting(full, base) : [toPosix(path.relative(base, full))];
  });
}

function checkPinnedDeps() {
  const read = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p, 'package.json'), 'utf8'));
  const mobile = read('uniqn-mobile');
  const web = read('ops-web');
  return compareMajorVersions(
    { ...mobile.devDependencies, ...mobile.dependencies },
    { ...web.devDependencies, ...web.dependencies },
    PINNED_DEPS
  );
}

function main() {
  const check = process.argv.includes('--check');
  const outputs = buildOutputs();
  assertClosure(outputs);

  const depDrift = checkPinnedDeps();
  const existing = new Set(listExisting(OUT_DIR));

  if (check) {
    const diffs = [];
    for (const [outRel, { content }] of outputs) {
      const full = path.join(OUT_DIR, outRel);
      if (!existing.has(outRel)) diffs.push(`없음: ${outRel}`);
      else if (fs.readFileSync(full, 'utf8').replace(/\r\n/g, '\n') !== content) diffs.push(`다름: ${outRel}`);
    }
    for (const rel of existing) if (!outputs.has(rel)) diffs.push(`남는 파일: ${rel}`);
    const failures = [...diffs, ...depDrift.map((d) => `버전 메이저 불일치: ${d}`)];
    if (failures.length > 0) {
      process.stderr.write(
        `✖ ops-web/src/core 가 정본과 다릅니다 (${failures.length}건):\n  ${failures.join('\n  ')}\n` +
          '→ 사본 차이: node scripts/sync-ops-core.mjs 로 재생성해 같은 PR 에 커밋하세요.\n' +
          '→ 버전 불일치: ops-web/package.json 을 모바일과 같은 메이저로 맞추세요.\n'
      );
      process.exit(1);
    }
    process.stdout.write(`✔ ops-web/src/core 동기화 상태 일치 (${outputs.size}개 파일)\n`);
    return;
  }

  for (const rel of existing) if (!outputs.has(rel)) fs.rmSync(path.join(OUT_DIR, rel));
  for (const [outRel, { content }] of outputs) {
    const full = path.join(OUT_DIR, outRel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content);
  }
  process.stdout.write(`✔ ops-web/src/core 재생성 (${outputs.size}개 파일)\n`);
  if (depDrift.length > 0) {
    process.stderr.write(`⚠ 버전 메이저 불일치 — --check 가 실패합니다:\n  ${depDrift.join('\n  ')}\n`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main();
  } catch (e) {
    process.stderr.write(`✖ sync-ops-core: ${e.message}\n`);
    process.exit(1);
  }
}
