#!/usr/bin/env node
/**
 * UNIQN Mobile - 클라이언트 RPC 호출 ↔ 마이그레이션 함수 존재 대조 가드
 *
 * @description 앱 코드가 호출하는 Supabase RPC 이름이 실제로 마이그레이션에
 *   정의돼 있는지 대조한다. 정의가 없으면 런타임에 PGRST202
 *   ("Could not find the function ... in the schema cache") 404 로 죽는다.
 *
 * 실제 사고 (2026-07-25, Sentry UNIQN-MOBILE-1N / PR#326):
 *   Supabase 전환 커밋이 InquiryRepository 의 respond_inquiry ·
 *   update_inquiry_status 호출부만 출하하고 함수 마이그레이션을 만들지 않아
 *   관리자 문의 응답이 prod 에서 전 구간 404 였다. 3개월간 아무도 못 잡았다.
 *
 * ⚠️ parity 가드(supabase/tests/parity_baseline_guard.test.sql)는 이 클래스를
 *    못 잡는다 — prod 와 repo 양쪽에서 대칭으로 누락되면 함수 카운트가 일치한다.
 *    "레포가 아는 것과 prod 가 아는 것"이 아니라 "코드가 부르는 것과 스키마가
 *    가진 것"을 대조해야 잡힌다.
 *
 * 대조 방식:
 *   호출부  — src/ + app/ 의 *.ts(x) 에서 .rpc('name') / .rpc<T>('name') / runRpc<T>('name')
 *   정의부  — supabase/migrations/*.sql 의 CREATE [OR REPLACE] FUNCTION [public.]name
 *            (archive/ 는 재실행되지 않으므로 제외)
 *
 * ⚠️ 호출부는 **파일 전체를 한 번에** 스캔해야 한다. 라인 단위로 훑으면
 *    prettier 가 감싼 멀티라인 호출을 통째로 놓친다 —
 *      const { data } = await supabase.rpc(
 *        'search_collaborator_candidates_by_nickname',   // ← .rpc( 와 다른 줄
 *    초판이 정확히 이 형태 1건(전체 91종 중)을 못 보고 있었고, "✅ 통과"는
 *    그 호출에 대해 아무것도 증명하지 못했다. 정규식의 `\s*` 는 개행도 먹으므로
 *    전체 내용 스캔이면 그대로 잡힌다. **red-green 통과는 커버리지를 증명하지 않는다**
 *    (graphify 트리거 추출 46% 누락과 같은 클래스).
 *
 * 한계(의도적):
 *   - 동적 이름(변수로 조립한 RPC 명)은 정적 추출 불가 — 리터럴만 검사한다.
 *   - 시그니처(파라미터)까지는 보지 않는다. 그건 pgTAP 이
 *     pg_get_function_identity_arguments 리터럴 비교로 고정한다
 *     (예: supabase/tests/inquiry_admin_rpcs.test.sql).
 *   - Edge Function(supabase/functions/)은 Deno 런타임이라 대상 밖이다.
 *
 * 사용: node scripts/check-rpc-migrations.js
 * flags: --json (기계 판독용 출력)
 */

const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
// 앱 코드는 src/ 와 app/(Expo Router 화면) 두 뿌리에 나뉘어 있다. 화면에서 RPC 를
// 부르는 코드가 아직 0건이라도 뿌리를 빠뜨리면 그 순간부터 조용히 감시 밖이 된다.
const SOURCE_DIRS = [path.join(projectRoot, 'src'), path.join(projectRoot, 'app')];
const MIGRATIONS_DIR = path.join(projectRoot, 'supabase', 'migrations');

// .rpc('x') / .rpc<T>('x') / runRpc<T>('x') / runRpc('x') 의 리터럴 이름만 추출.
const RPC_CALL_RE = /\b(?:runRpc|\.rpc)\s*(?:<[^>(]*>)?\s*\(\s*['"]([a-zA-Z_][a-zA-Z0-9_]*)['"]/g;
// CREATE FUNCTION / CREATE OR REPLACE FUNCTION [public.]name
const CREATE_FN_RE =
  /CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+(?:public\.)?"?([a-zA-Z_][a-zA-Z0-9_]*)"?/gi;

/** 디렉토리를 재귀 순회하며 확장자가 맞는 파일 경로를 모은다. */
function collectFiles(dir, extensions, out = []) {
  if (!fs.existsSync(dir)) {
    return out;
  }
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      // archive/ 는 재실행되지 않는 보존용이라 정의 소스로 치지 않는다.
      if (entry.name === 'archive' || entry.name === 'node_modules') {
        continue;
      }
      collectFiles(full, extensions, out);
      continue;
    }
    if (extensions.some((ext) => entry.name.endsWith(ext))) {
      out.push(full);
    }
  }
  return out;
}

/**
 * 소스 파일들에서 RPC 호출 이름 → [파일:줄] 목록을 만든다.
 *
 * 파일 **전체 내용**을 한 번에 스캔한다(라인 단위 금지 — 상단 ⚠️ 참고).
 * 줄 번호는 매치 시작 오프셋에서 역산한다.
 */
function collectRpcCalls(files) {
  const calls = new Map();
  for (const file of files) {
    const content = fs.readFileSync(file, 'utf8');
    const rel = path.relative(projectRoot, file).replace(/\\/g, '/');
    RPC_CALL_RE.lastIndex = 0;
    let match;
    while ((match = RPC_CALL_RE.exec(content)) !== null) {
      const name = match[1];
      const line = content.slice(0, match.index).split(/\r?\n/).length;
      const location = `${rel}:${line}`;
      const existing = calls.get(name);
      calls.set(name, existing ? [...existing, location] : [location]);
    }
  }
  return calls;
}

/** 마이그레이션 SQL 에서 정의된 함수 이름 집합을 만든다. */
function collectDefinedFunctions(files) {
  const defined = new Set();
  for (const file of files) {
    const content = fs.readFileSync(file, 'utf8');
    CREATE_FN_RE.lastIndex = 0;
    let match;
    while ((match = CREATE_FN_RE.exec(content)) !== null) {
      defined.add(match[1]);
    }
  }
  return defined;
}

function findMissing(calls, defined) {
  return [...calls.entries()]
    .filter(([name]) => !defined.has(name))
    .map(([name, locations]) => ({ name, locations }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function main() {
  const asJson = process.argv.includes('--json');

  const sourceFiles = SOURCE_DIRS.reduce(
    (acc, dir) => collectFiles(dir, ['.ts', '.tsx'], acc),
    /** @type {string[]} */ ([])
  );
  const migrationFiles = collectFiles(MIGRATIONS_DIR, ['.sql']);

  if (migrationFiles.length === 0) {
    throw new Error(
      `마이그레이션 파일을 찾지 못했습니다: ${path.relative(projectRoot, MIGRATIONS_DIR)}`
    );
  }

  const calls = collectRpcCalls(sourceFiles);
  const defined = collectDefinedFunctions(migrationFiles);
  const missing = findMissing(calls, defined);

  if (asJson) {
    console.log(JSON.stringify({ checked: calls.size, missing }, null, 2));
  }

  if (missing.length > 0) {
    const detail = missing
      .map((item) => `${item.name}\n      호출: ${item.locations.join(', ')}`)
      .join('\n  - ');
    throw new Error(
      `마이그레이션에 정의되지 않은 RPC ${missing.length}건 (런타임 PGRST202 404):\n  - ${detail}\n\n` +
        `해결: supabase/migrations/ 에 CREATE FUNCTION 을 추가하거나, 호출부를 제거하세요.\n` +
        `      (동적 이름이면 이 정적 가드가 잡을 수 없으니 예외 처리를 검토하세요.)`
    );
  }

  if (!asJson) {
    console.log(
      `✅ RPC 대조 통과 — 호출 ${calls.size}종 전부 마이그레이션에 정의됨 ` +
        `(소스 ${sourceFiles.length}파일 / 마이그 ${migrationFiles.length}파일)`
    );
  }
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error('\n❌', error.message);
    process.exit(1);
  }
}

module.exports = { collectRpcCalls, collectDefinedFunctions, findMissing };
