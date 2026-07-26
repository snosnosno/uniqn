#!/usr/bin/env node
/**
 * graph-db-deps — graphify 지식그래프에서 DB 의존성만 뽑아내는 조회 도구
 *
 * 배경: graphify(`graphify update uniqn-mobile --no-cluster`)가 만든 graph.json에는
 * SQL 트리거→함수(`triggers`)·함수→테이블(`reads_from`) 엣지가 EXTRACTED로 들어있다.
 * 다만 그대로 쓰면 전부 오탐이 되는 함정이 두 개 있어 이 스크립트가 보정한다.
 *
 *   1) `supabase/migrations/archive/` — squash된 과거 마이그레이션을 라이브 스키마처럼
 *      읽어서 "이미 고쳐진 버그"가 되살아난다. 기본 제외(--include-archive로 해제).
 *   2) 테이블 노드 라벨이 파일 경로로 오염돼 파편화된다
 *      (public.users가 4노드, public.job_postings가 8노드). 스키마.테이블로 정규화해 병합.
 *
 * graphify CLI의 affected/query는 SQL 함수명 매칭에 실패하고 기본 relation 목록에
 * triggers/reads_from이 빠져 있어 쓸 수 없다. 그래서 graph.json을 직접 읽는다.
 *
 * 사용법:
 *   node scripts/graph-db-deps.mjs stats
 *   node scripts/graph-db-deps.mjs triggers            # 중복 트리거 검사
 *   node scripts/graph-db-deps.mjs table work_logs     # 이 테이블을 읽는 함수 (변경 전 영향도)
 *   node scripts/graph-db-deps.mjs fn my_venue_role_salaries
 *
 * 옵션: --graph <path> | --include-archive | --allow-stale
 *
 * 그래프가 최신 .sql 보다 오래되면 **차단**한다(구 번들이 E2E를 거짓 통과시켰던 것과
 * 같은 계열의 함정). 재생성: graphify update uniqn-mobile --force --no-cluster
 */

import { readFileSync, existsSync, statSync, readdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_GRAPH = resolve(REPO_ROOT, 'uniqn-mobile/graphify-out/graph.json');

/** graphify가 테이블 노드 id 끝에 붙이는 스키마 마커 */
const SCHEMAS = ['public', 'auth', 'storage', 'extensions', 'realtime', 'vault', 'graphql', 'net', 'cron'];

// ---------------------------------------------------------------------------
// 로딩 · 정규화
// ---------------------------------------------------------------------------

const isArchive = (sourceFile) => String(sourceFile || '').includes('/migrations/archive/');

/**
 * 테이블 참조를 `스키마.테이블`로 정규화한다.
 *
 * ⚠️ `reads_from` 엣지의 target은 graph.json의 nodes에 **존재하지 않는 dangling id**다
 * (graphify가 테이블을 노드로 승격하지 않고 엣지 끝단으로만 남긴다). 그래서 노드 객체가
 * 아니라 **id 문자열**을 받아 파싱한다. 마이그레이션이 정의한 테이블만 깨끗한 라벨
 * (`public.users`) 노드로도 존재한다.
 *
 * 테이블로 해석되지 않으면 null.
 */
function normalizeTable(raw) {
  raw = String(raw ?? '');
  if (/^[a-z_]+\.[a-z0-9_]+$/i.test(raw) && !raw.endsWith(')')) return raw.toLowerCase();

  // 마지막에 등장하는 스키마 마커 기준으로 자른다 (테이블명에 _ 가 있어도 안전)
  let best = null;
  for (const schema of SCHEMAS) {
    const marker = `_${schema}_`;
    const at = raw.lastIndexOf(marker);
    if (at === -1) continue;
    const table = raw.slice(at + marker.length);
    if (!/^[a-z0-9_]+$/i.test(table)) continue;
    if (!best || at > best.at) best = { at, value: `${schema}.${table}`.toLowerCase() };
  }
  return best?.value ?? null;
}

const REBUILD_CMD = 'graphify update uniqn-mobile --force --no-cluster';

/** `supabase/` 아래 .sql 중 가장 최근 수정본 (archive 제외) */
function newestSqlFile(dir, acc = { at: 0, file: null }) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'archive' || entry.name === 'node_modules') continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) newestSqlFile(full, acc);
    else if (entry.name.endsWith('.sql')) {
      const at = statSync(full).mtimeMs;
      if (at > acc.at) Object.assign(acc, { at, file: full });
    }
  }
  return acc;
}

/**
 * stale 그래프 = 거짓 결과. `dist/` 구 번들이 E2E를 거짓 통과시켰던 것과 같은 계열이므로
 * 경고가 아니라 **차단**한다. 이 스크립트는 SQL 사실만 보고하므로 .sql 기준으로만 비교.
 */
function assertFresh(graphPath, allowStale) {
  const sqlRoot = resolve(REPO_ROOT, 'uniqn-mobile/supabase');
  if (!existsSync(sqlRoot)) return;
  const newest = newestSqlFile(sqlRoot);
  if (!newest.file || statSync(graphPath).mtimeMs >= newest.at) return;

  const msg = [
    '그래프가 SQL보다 오래됐습니다 — 결과가 거짓일 수 있습니다.',
    `  그래프: ${new Date(statSync(graphPath).mtimeMs).toISOString()}`,
    `  최신 SQL: ${new Date(newest.at).toISOString()}  ${newest.file.replace(REPO_ROOT, '.')}`,
    `  재생성: ${REBUILD_CMD}`,
  ].join('\n');
  if (allowStale) {
    console.error(`[경고] ${msg}\n  (--allow-stale 지정되어 계속 진행)\n`);
    return;
  }
  console.error(`[차단] ${msg}\n  무시하려면 --allow-stale`);
  process.exit(2);
}

function loadGraph({ graphPath, includeArchive, allowStale }) {
  if (!existsSync(graphPath)) {
    console.error(`그래프를 찾을 수 없습니다: ${graphPath}`);
    console.error(`먼저 생성하세요: ${REBUILD_CMD}`);
    console.error('(graphify-out/ 은 gitignore 대상이라 새 워크트리·머신에는 없습니다)');
    process.exit(1);
  }
  assertFresh(graphPath, allowStale);
  const g = JSON.parse(readFileSync(graphPath, 'utf8'));
  const nodes = new Map(g.nodes.map((n) => [n.id, n]));
  const links = includeArchive
    ? g.links
    : g.links.filter((l) => !isArchive(l.source_file) && !isArchive(nodes.get(l.source)?.source_file));
  return { g, nodes, links };
}

const labelOf = (nodes, id) => nodes.get(id)?.label ?? id;

/** SQL 함수명을 `스키마.함수()` 로 정규화 (경로 오염된 라벨 보정) */
function normalizeFn(raw) {
  raw = String(raw ?? '');
  if (/^[a-z_]+\.[a-z0-9_]+\(\)$/i.test(raw)) return raw.toLowerCase();
  for (const schema of SCHEMAS) {
    const at = raw.lastIndexOf(`_${schema}_`);
    if (at !== -1) return `${schema}.${raw.slice(at + schema.length + 2)}()`.toLowerCase();
  }
  return raw.toLowerCase();
}

/** CREATE TRIGGER 문을 소스에서 읽어 대상 테이블을 확정한다 (그래프 엣지엔 없는 정보) */
function triggerTable(link) {
  const file = resolve(REPO_ROOT, String(link.source_file || ''));
  const lineNo = Number(String(link.source_location || '').replace(/^L/, ''));
  if (!existsSync(file) || !Number.isFinite(lineNo)) return null;
  const lines = readFileSync(file, 'utf8').split(/\r?\n/);
  // CREATE TRIGGER 는 여러 줄에 걸칠 수 있어 앞뒤로 넉넉히 본다
  const window = lines.slice(Math.max(0, lineNo - 2), lineNo + 8).join(' ');
  return window.match(/\bON\s+([A-Za-z_][\w.]*)/i)?.[1]?.toLowerCase() ?? null;
}

// ---------------------------------------------------------------------------
// 명령
// ---------------------------------------------------------------------------

function cmdStats({ g, nodes, links }) {
  const byRelation = {};
  for (const l of links) byRelation[l.relation] = (byRelation[l.relation] ?? 0) + 1;
  // 테이블은 reads_from 엣지의 끝단에만 존재한다 (노드가 아니다) — 그 집합만 센다
  const tables = new Set();
  for (const l of links.filter((x) => x.relation === 'reads_from')) {
    const t = normalizeTable(l.target);
    if (t) tables.add(t);
  }
  return {
    노드: g.nodes.length,
    엣지_archive제외: links.length,
    엣지_전체: g.links.length,
    LLM토큰: { in: g.input_tokens, out: g.output_tokens },
    테이블_정규화후: tables.size,
    관계: Object.fromEntries(Object.entries(byRelation).sort((a, b) => b[1] - a[1]).slice(0, 12)),
  };
}

/**
 * 중복 트리거 검사 — 같은 테이블에서 같은 함수를 호출하는 트리거가 2개 이상이면 진짜 중복.
 * (서로 다른 테이블이 공용 set_updated_at() 함수를 쓰는 건 정상 설계이므로 걸러진다.)
 */
function cmdTriggers({ nodes, links }) {
  const groups = new Map();
  for (const l of links.filter((x) => x.relation === 'triggers')) {
    const fn = normalizeFn(labelOf(nodes, l.target));
    const table = triggerTable(l);
    const key = `${table ?? '(테이블미상)'}::${fn}`;
    if (!groups.has(key)) groups.set(key, { table, fn, triggers: new Map() });
    groups.get(key).triggers.set(labelOf(nodes, l.source), `${l.source_file}:${l.source_location}`);
  }
  const dupes = [...groups.values()]
    .filter((entry) => entry.triggers.size > 1)
    .map((entry) => ({
      테이블: entry.table,
      함수: entry.fn,
      트리거: [...entry.triggers.entries()].map(([name, at]) => ({ name, at })),
    }));
  return { 트리거_총계: groups.size, 중복_후보: dupes };
}

/** 이 테이블을 읽는 SQL 함수 — 컬럼/테이블 변경 전 영향도 조회 */
function cmdTable({ nodes, links }, needle) {
  const want = needle.includes('.') ? needle.toLowerCase() : null;
  const hits = [];
  for (const l of links.filter((x) => x.relation === 'reads_from')) {
    const table = normalizeTable(l.target);
    if (!table) continue;
    const bare = table.split('.')[1];
    if (want ? table !== want : bare !== needle.toLowerCase()) continue;
    hits.push({ 함수: normalizeFn(labelOf(nodes, l.source)), 테이블: table, 위치: `${l.source_file}:${l.source_location}` });
  }
  const seen = new Set();
  const unique = hits.filter((h) => !seen.has(h.함수 + h.테이블) && seen.add(h.함수 + h.테이블));
  return { 질의: needle, 의존_함수_수: unique.length, 함수: unique };
}

/** 이 함수가 읽는 테이블 */
function cmdFn({ nodes, links }, needle) {
  const key = needle.toLowerCase().replace(/\(\)$/, '');
  const tables = new Map();
  for (const l of links.filter((x) => x.relation === 'reads_from')) {
    if (!labelOf(nodes, l.source).toLowerCase().includes(key)) continue;
    const table = normalizeTable(l.target);
    if (table) tables.set(table, `${l.source_file}:${l.source_location}`);
  }
  return { 질의: needle, 테이블_수: tables.size, 테이블: [...tables.entries()].map(([t, at]) => ({ t, at })) };
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function main() {
  const argv = process.argv.slice(2);
  const flag = (name) => argv.includes(name);
  const opt = (name) => {
    const i = argv.indexOf(name);
    return i === -1 ? null : argv[i + 1];
  };
  const positional = argv.filter((a, i) => !a.startsWith('--') && argv[i - 1] !== '--graph');
  const [command, arg] = positional;

  if (!command || flag('--help')) {
    console.log(readFileSync(fileURLToPath(import.meta.url), 'utf8').split('*/')[0].replace(/^#!.*\n/, ''));
    process.exit(command ? 0 : 1);
  }

  const ctx = loadGraph({
    graphPath: opt('--graph') ? resolve(opt('--graph')) : DEFAULT_GRAPH,
    includeArchive: flag('--include-archive'),
    allowStale: flag('--allow-stale'),
  });

  let result;
  if (command === 'stats') result = cmdStats(ctx);
  else if (command === 'triggers') result = cmdTriggers(ctx);
  else if (command === 'table') result = arg ? cmdTable(ctx, arg) : null;
  else if (command === 'fn') result = arg ? cmdFn(ctx, arg) : null;
  else {
    console.error(`알 수 없는 명령: ${command} (stats|triggers|table|fn)`);
    process.exit(1);
  }

  if (!result) {
    console.error(`${command} 명령은 인자가 필요합니다. 예: node scripts/graph-db-deps.mjs ${command} work_logs`);
    process.exit(1);
  }
  console.log(JSON.stringify(result, null, 2));
}

main();
