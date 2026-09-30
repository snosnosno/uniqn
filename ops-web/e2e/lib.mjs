/**
 * ops-web 로컬 E2E 공용 — Playwright 는 uniqn-mobile 쪽 설치본을 빌려 쓴다(ops-web 에 중복 설치하지 않음).
 * 전제: 로컬 Supabase + `npm run seed:local` + `npm run build && npx vite preview --port 4173`.
 * ⚠️ 로컬 전용. BASE 가 localhost 가 아니면 즉시 중단한다.
 */
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.join(here, '..', '..', 'uniqn-mobile', 'package.json'));
/**
 * 엔진 선택 — `OPS_E2E_BROWSER=webkit node e2e/w7-public.mjs` 로 Safari 엔진(WebKit) 대체 검증.
 * 이름은 기존 호출부 호환으로 `chromium` 그대로 둔다. 실제 Safari(팝업·클립보드 정책)와 같지는 않다.
 */
const ENGINE = process.env.OPS_E2E_BROWSER ?? 'chromium';
if (!['chromium', 'webkit', 'firefox'].includes(ENGINE)) {
  throw new Error(`OPS_E2E_BROWSER 는 chromium|webkit|firefox: ${ENGINE}`);
}
export const chromium = require('playwright')[ENGINE];

export const BASE = process.env.OPS_E2E_BASE ?? 'http://localhost:4173';
if (!/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(BASE)) {
  throw new Error(`로컬 주소만 허용합니다: ${BASE}`);
}
export const MAILPIT = 'http://127.0.0.1:54324';
export const PASSWORD = 'TestPass1!';
export const OWNER = 'ops-owner@uniqn.test';
export const INCOMPLETE = 'ops-incomplete@uniqn.test';

export const SHOT_DIR = path.join(here, '..', 'e2e-output');
fs.mkdirSync(SHOT_DIR, { recursive: true });

const WEB_ROOT = path.join(here, '..');

/** 로컬 anon 키(.env.development.local) — GoTrue 직접 호출(토큰 갱신 검증)에 쓴다. */
export function localAnonKey() {
  const env = fs.readFileSync(path.join(WEB_ROOT, '.env.development.local'), 'utf8');
  const key = /^VITE_SUPABASE_ANON_KEY=(.+)$/m.exec(env)?.[1]?.trim();
  if (!key) throw new Error('.env.development.local 에 VITE_SUPABASE_ANON_KEY 가 없습니다');
  return key;
}

/**
 * 실행 전 안전 점검 + 시드.
 * 🔒 `vite preview` 는 빌드 가드를 건너뛴다 — 마지막 빌드가 build:prod 였다면 E2E 가 prod Auth 로
 *    로그인·재설정 요청을 보낸다. dist 번들이 로컬 Supabase 를 가리키는지 먼저 확인한다(리뷰 W2).
 */
export function prepareLocal() {
  const assets = path.join(WEB_ROOT, 'dist', 'assets');
  const bundle = fs
    .readdirSync(assets)
    .filter((f) => f.endsWith('.js'))
    .map((f) => fs.readFileSync(path.join(assets, f), 'utf8'))
    .join('\n');
  // 실제 프로젝트 URL 모양만 본다 — supabase-js 내부에 와일드카드 문자열 `*.supabase.co` 가 있어
  // 단순 포함 검사는 항상 걸린다(실측).
  if (!bundle.includes('127.0.0.1:54321') || /https:\/\/[a-z0-9]{20}\.supabase\.co/.test(bundle)) {
    throw new Error(
      'dist 번들이 로컬 Supabase 를 가리키지 않습니다 — npm run build 로 다시 빌드하세요'
    );
  }
  const seed = spawnSync(process.execPath, [path.join(WEB_ROOT, 'scripts', 'seed-local.mjs')], {
    encoding: 'utf8',
  });
  if (seed.status !== 0) throw new Error(`시드 실패: ${seed.stderr}`);
}

let failures = 0;
export async function step(name, fn) {
  try {
    await fn();
    process.stdout.write(`  ✔ ${name}\n`);
  } catch (e) {
    failures += 1;
    const lines = String(e?.message ?? e).split('\n');
    // E2E_VERBOSE=1 이면 Playwright 호출 로그(가로막은 요소 등)까지 보여준다
    const shown = process.env.E2E_VERBOSE ? lines.slice(0, 14).join('\n    ') : lines[0];
    process.stdout.write(`  ✖ ${name}\n    ${shown}\n`);
  }
}
export function finish() {
  process.stdout.write(failures === 0 ? '\n모두 통과\n' : `\n실패 ${failures}건\n`);
  process.exit(failures === 0 ? 0 : 1);
}

export function assert(cond, message) {
  if (!cond) throw new Error(message);
}

export async function login(page, email, password = PASSWORD) {
  await page.getByLabel('이메일').fill(email);
  await page.getByLabel('비밀번호', { exact: true }).fill(password);
  await page.getByRole('button', { name: '로그인' }).click();
}

/** 로컬 DB 조회(검증 전용, 읽기). 결과는 psql -tA 행 배열. 로컬 컨테이너에만 붙는다. */
export function sql(query) {
  const r = spawnSync(
    'docker',
    ['exec', '-i', 'supabase_db_uniqn', 'psql', '-U', 'postgres', '-tA', '-v', 'ON_ERROR_STOP=1'],
    { input: query, encoding: 'utf8' }
  );
  if (r.status !== 0) throw new Error(`sql 실패: ${r.stderr}`);
  return r.stdout.split('\n').filter((l) => l.length > 0);
}

/**
 * 모바일 앱이 보는 목록과 같은 조회 — owner JWT 로 RLS 를 태워 `ops_tournaments` 를 읽는다
 * (모바일 OpsTournamentRepository.listForUser 와 같은 테이블·정렬). 웹이 만든 대회가 모바일에도 보이는지 대조용.
 */
export function listAsMobile(userId) {
  return sql(`BEGIN;
SELECT set_config('request.jwt.claims', '{"sub":"${userId}","role":"authenticated"}', true) \\g /dev/null
SET LOCAL ROLE authenticated;
SELECT id || '|' || name || '|' || coalesce(job_posting_id::text, '') || '|' || coalesce(archived_at::text, '')
  FROM public.ops_tournaments ORDER BY event_date DESC NULLS LAST, created_at DESC;
ROLLBACK;`).filter((l) => l.includes('|'));
}

/**
 * E2E 가 만든 대회 정리 — 앱과 같은 RPC(ops_set_tournament_archived)로 보관한다.
 * (ops_events append-only 라 삭제는 불가능하고, 보관이 유일한 "치우기" 경로다.)
 */
export function archiveAsOwner(userId, tournamentIds) {
  if (tournamentIds.length === 0) return;
  const calls = tournamentIds
    .map(
      (id) => `SELECT public.ops_set_tournament_archived('${id}', '${userId}', true) \\g /dev/null`
    )
    .join('\n');
  sql(`BEGIN;
SELECT set_config('request.jwt.claims', '{"sub":"${userId}","role":"authenticated"}', true) \\g /dev/null
SET LOCAL ROLE authenticated;
${calls}
COMMIT;`);
}

export const OWNER_ID = '0a5e0000-0000-4000-8000-000000000001';
export const SEED_POSTING_ID = '0a5e0000-0000-4000-8000-0000000000b1';

/** 해당 주소로 온 가장 최근 메일 본문(text). */
export async function latestMailText(to, { after = 0, timeoutMs = 10_000 } = {}) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const res = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${to}`)}`);
    const body = await res.json();
    const hit = body.messages?.find((m) => Date.parse(m.Created) >= after);
    if (hit) {
      const msg = await (await fetch(`${MAILPIT}/api/v1/message/${hit.ID}`)).json();
      return msg.Text || msg.HTML;
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`${to} 로 온 메일이 없습니다`);
}

/** 375/768/1280 × 다크/라이트 스크린샷. 파일 경로 목록을 돌려준다. */
export async function screenshots(browser, url, name, { prepare } = {}) {
  const out = [];
  for (const theme of ['dark', 'light']) {
    for (const width of [375, 768, 1280]) {
      const ctx = await browser.newContext({
        viewport: { width, height: width === 375 ? 812 : 900 },
        colorScheme: theme,
      });
      await ctx.addInitScript((t) => {
        try {
          localStorage.setItem('ops-web:theme', t);
        } catch {
          /* 무시 */
        }
      }, theme);
      const page = await ctx.newPage();
      if (prepare) await prepare(page);
      await page.goto(`${BASE}${url}`);
      await page.waitForLoadState('networkidle');
      const file = path.join(SHOT_DIR, `${name}-${theme}-${width}.png`);
      await page.screenshot({ path: file, fullPage: true });
      out.push(file);
      await ctx.close();
    }
  }
  return out;
}
