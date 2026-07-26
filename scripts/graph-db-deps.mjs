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
 * ⚠️ 단, `triggers` 명령만은 그래프를 **쓰지 않는다**. graphify 의 trigger 추출이
 * baseline 기준 69개 중 37개만 잡아(46% 누락) "중복 0건"이 거짓 안전 신호가 되기 때문이다.
 * triggers 는 .sql 을 직접 스캔하므로 그래프 설치·신선도와 무관하게 항상 동작한다.
 *
 * 사용법:
 *   node scripts/graph-db-deps.mjs triggers            # 중복 트리거 검사 (그래프 불필요)
 *   node scripts/graph-db-deps.mjs stats               # 이하 3개는 graph.json 필요
 *   node scripts/graph-db-deps.mjs table work_logs     # 이 테이블을 읽는 함수 (변경 전 영향도)
 *   node scripts/graph-db-deps.mjs fn my_venue_role_salaries
 *
 * 옵션: --graph <path> | --include-archive | --allow-stale | --verbose(triggers)
 *
 * 그래프가 최신 .sql 보다 오래되면 **차단**한다(구 번들이 E2E를 거짓 통과시켰던 것과
 * 같은 계열의 함정). 재생성: graphify update uniqn-mobile --force --no-cluster
 * graphify 미설치 시: uv tool install "graphifyy[sql,mcp]"
 *
 * ## triggers 결과 읽는 법 (중요)
 * `중복_후보`는 **판정이 아니라 순위 매긴 힌트**다. 같은 테이블·시점에 트리거가 여럿인 건
 * 대부분 정상이므로(updated_at + 상태전이 + XSS검사...), 함수명 토큰이 겹치는 쌍만 올린다.
 * 테이블명 유래 토큰과 범용 동사(enforce/sync/check…)는 제외하고 비교한다.
 * 0건이 "안전 확정"은 아니다 — 이름이 전혀 안 겹치는 중복은 사람이 봐야 한다.
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

// ---------------------------------------------------------------------------
// 트리거 스캔 — 그래프를 쓰지 않고 .sql 을 직접 읽는다
// ---------------------------------------------------------------------------
//
// ⚠️ graphify 의 `triggers` 엣지는 쓰면 안 된다. baseline 한 파일만 봐도
// CREATE TRIGGER 69개 중 37개만 추출됐다(46% 누락 — `review_notify_insert` 는
// 포맷이 동일한데도 통째로 빠졌다). 누락된 트리거는 중복 검사에 영원히 안 걸리므로
// "중복 0건"이 거짓 안전 신호가 된다. 그래서 여기서는 정규식으로 직접 스캔한다.
//
// 그리고 CREATE 만 세면 안 된다. 나중 마이그레이션이 DROP 한 트리거는 이미 죽었는데
// 살아있는 것으로 세면 해소된 중복이 계속 재검출된다. 파일명(타임스탬프) 순으로
// CREATE/DROP 을 재생해 **현재 살아있는 트리거 집합**을 구한다.

const CREATE_TRIGGER_RE =
  /CREATE\s+(?:OR\s+REPLACE\s+)?(?:CONSTRAINT\s+)?TRIGGER\s+([A-Za-z_]\w*)\s+(BEFORE|AFTER|INSTEAD\s+OF)\s+([\s\S]*?)\s+ON\s+([A-Za-z_][\w.]*)([\s\S]*?)EXECUTE\s+(?:PROCEDURE|FUNCTION)\s+([A-Za-z_][\w.]*)\s*\(/gi;
const DROP_TRIGGER_RE =
  /DROP\s+TRIGGER\s+(?:IF\s+EXISTS\s+)?([A-Za-z_]\w*)\s+ON\s+([A-Za-z_][\w.]*)/gi;

const EVENT_RE = /\b(INSERT|UPDATE|DELETE|TRUNCATE)\b/gi;
const qualify = (name) => (name.includes('.') ? name.toLowerCase() : `public.${name}`.toLowerCase());
const lineOf = (text, index) => text.slice(0, index).split('\n').length;

/** 마이그레이션을 시간순으로 재생해 현재 살아있는 트리거를 구한다 */
function scanLiveTriggers({ includeArchive, extraDirs = [] }) {
  const roots = [resolve(REPO_ROOT, 'uniqn-mobile/supabase/migrations'), ...extraDirs];
  const files = [];
  const walk = (dir) => {
    if (!existsSync(dir)) return;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === 'archive' && !includeArchive) continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.sql')) files.push(full);
    }
  };
  roots.forEach(walk);
  // 파일명(타임스탬프) 순 — 경로가 아니라 basename 기준이어야 archive 와 섞여도 순서가 맞다
  files.sort((a, b) => (a.split(/[\\/]/).pop() < b.split(/[\\/]/).pop() ? -1 : 1));

  const live = new Map(); // "table::triggerName" -> 정보
  for (const file of files) {
    const sql = readFileSync(file, 'utf8');
    const rel = file.replace(REPO_ROOT, '.').replace(/\\/g, '/');

    for (const m of sql.matchAll(DROP_TRIGGER_RE)) {
      live.delete(`${qualify(m[2])}::${m[1].toLowerCase()}`);
    }
    for (const m of sql.matchAll(CREATE_TRIGGER_RE)) {
      const [, name, timing, eventPart, table, , fn] = m;
      const events = [...new Set([...eventPart.matchAll(EVENT_RE)].map((e) => e[1].toUpperCase()))];
      live.set(`${qualify(table)}::${name.toLowerCase()}`, {
        name,
        table: qualify(table),
        timing: timing.replace(/\s+/g, ' ').toUpperCase(),
        events,
        fn: qualify(fn) + '()',
        at: `${rel}:L${lineOf(sql, m.index)}`,
      });
    }
  }
  return [...live.values()];
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
 * 중복 트리거 검사 — **같은 테이블 + 같은 타이밍 + 겹치는 이벤트**에 트리거가 2개 이상이면 후보.
 *
 * 🔑 함수명으로 묶으면 안 된다. 실제로 터진 중복(20260726000000 이 해소한 리뷰·문의·대회 알림
 * 3쌍)은 `review_notify_insert → notify_on_review_insert()` 와
 * `tr_notify_review_created → fn_notify_review_created()` 처럼 **함수가 서로 다른데** 같은
 * 테이블·같은 이벤트에 둘 다 걸려 알림이 2번 나가는 형태였다. 함수 기준 그룹핑은 이걸 못 잡는다.
 *
 * 대신 공용 함수 오탐(여러 테이블이 fn_ops_set_updated_at() 공유)은 테이블이 다르므로 자연히 빠진다.
 */
function cmdTriggers({ includeArchive, verbose }) {
  const triggers = scanLiveTriggers({ includeArchive });
  const groups = new Map();
  for (const t of triggers) {
    for (const event of t.events.length ? t.events : ['(이벤트미상)']) {
      const key = `${t.table}::${t.timing}::${event}`;
      if (!groups.has(key)) groups.set(key, { table: t.table, timing: t.timing, event, list: [] });
      groups.get(key).list.push(t);
    }
  }
  // 같은 테이블·시점에 트리거가 여럿인 건 정상이 대부분이다(updated_at + 상태전이 + XSS검사...).
  // 진짜 중복은 **두 트리거가 같은 일을 하는** 경우다. 함수명 토큰이 2개 이상 겹치면 강한 후보로 본다.
  // 실측: notify_on_review_insert vs fn_notify_review_created → {notify, review} 2개 겹침 → 적발.
  //       enforce_jp_status_transition vs enforce_tournament_approval_authority → {enforce} 1개 → 제외.
  const scored = [...groups.values()]
    .filter((entry) => entry.list.length > 1)
    .map((entry) => {
      const pairs = [];
      for (let i = 0; i < entry.list.length; i++) {
        for (let j = i + 1; j < entry.list.length; j++) {
          const [a, b] = [entry.list[i], entry.list[j]];
          const skip = tableTokens(entry.table);
          const tb = fnTokens(b.fn, skip);
          const shared = [...fnTokens(a.fn, skip)].filter((t) => tb.has(t));
          if (a.fn === b.fn || shared.length >= 1) {
            pairs.push({ 겹침: a.fn === b.fn ? ['(동일 함수)'] : shared, 쌍: [a, b] });
          }
        }
      }
      return { entry, pairs };
    });

  const strong = scored
    .filter((s) => s.pairs.length)
    .map(({ entry, pairs }) => ({
      테이블: entry.table,
      시점: `${entry.timing} ${entry.event}`,
      의심쌍: pairs.map((p) => ({
        겹치는_토큰: p.겹침,
        트리거: p.쌍.map((t) => ({ name: t.name, fn: t.fn, at: t.at })),
      })),
    }));

  return {
    살아있는_트리거: triggers.length,
    중복_후보: strong,
    참고_동일시점_다중트리거: scored.length, // 대부분 정상. 전체는 --verbose
    ...(verbose
      ? {
          전체_동일시점_그룹: scored.map(({ entry }) => ({
            테이블: entry.table,
            시점: `${entry.timing} ${entry.event}`,
            트리거: entry.list.map((t) => ({ name: t.name, fn: t.fn, at: t.at })),
          })),
        }
      : {}),
  };
}

/**
 * 함수명에서 "무슨 일을 하는가"를 나타내는 토큰만 남긴다.
 *
 * 제거 대상 세 부류:
 *  1) 스키마·관용 접두사(fn/tr/trg) 와 DML 키워드
 *  2) **테이블명에서 유래한 토큰** — board_comments 테이블의 두 트리거는 함수명에
 *     board·comment 가 당연히 들어가므로 그대로 두면 전부 겹친다(실측 오탐).
 *  3) 범용 동사 — enforce/sync/check 류는 하는 일이 달라도 이름만 겹친다.
 *     단 `notify` 는 제거하지 않는다. 실제 중복 3쌍의 유일한 공통 신호였다.
 */
const FN_STOPWORDS = new Set([
  'public', 'fn', 'tr', 'trg', 'tg', 'on', 'set', 'at', 'insert', 'delete', 'update', 'updated',
  'check', 'enforce', 'sync', 'recalc', 'validate', 'guard', 'prevent', 'log', 'audit', 'count',
]);
const singular = (t) => (t.length > 3 && t.endsWith('s') ? t.slice(0, -1) : t);

function fnTokens(fn, skip = new Set()) {
  return new Set(
    fn
      .replace(/^[a-z_]+\./, '')
      .replace(/\(\)$/, '')
      .split('_')
      .map(singular)
      .filter((t) => t && !FN_STOPWORDS.has(t) && !skip.has(t)),
  );
}

/** 테이블명 유래 토큰 (단복수 통일) */
function tableTokens(table) {
  return new Set(table.replace(/^[a-z_]+\./, '').split('_').map(singular));
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

  const includeArchive = flag('--include-archive');

  // triggers 는 .sql 을 직접 스캔하므로 그래프도, 신선도 검사도 필요 없다 (항상 최신).
  if (command === 'triggers') {
    console.log(JSON.stringify(cmdTriggers({ includeArchive, verbose: flag('--verbose') }), null, 2));
    return;
  }

  const ctx = loadGraph({
    graphPath: opt('--graph') ? resolve(opt('--graph')) : DEFAULT_GRAPH,
    includeArchive,
    allowStale: flag('--allow-stale'),
  });

  let result;
  if (command === 'stats') result = cmdStats(ctx);
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
