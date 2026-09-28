/**
 * 로컬 수동 테스트 한 번에 띄우기 — `npm run local` (빌드 생략: `npm run local -- --no-build`).
 *
 * 1) 로컬 Supabase(Docker `supabase_db_uniqn`) 연결 확인  2) 시드(계정·대회) 멱등 적용
 * 3) 수동 테스트용 링크 준비 — 시드 대회의 전광판 토큰(멱등 발급)과 플레이어 링크·PIN(재발급, 연결 해제)
 * 4) 개발 모드 빌드  5) http://localhost:4173 미리보기 서버(Ctrl+C 로 종료)
 *
 * ⚠️ 로컬 전용 — 알려진 비밀번호 계정과 로컬 DB 컨테이너에만 붙는다. prod 에는 절대 쓰지 않는다.
 * 선행: uniqn-mobile 에서 `npx supabase start` · `.env.development.local`(로컬 URL·anon 키)
 */
import { spawn, spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const OWNER_ID = '0a5e0000-0000-4000-8000-000000000001';
const SEED_TOURNAMENT = '시드 · 수요 딥스택';
const PLAYER_NAME = '김민준';
const PORT = 4173;
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';

function sql(query) {
  const r = spawnSync(
    'docker',
    ['exec', '-i', 'supabase_db_uniqn', 'psql', '-U', 'postgres', '-tA', '-v', 'ON_ERROR_STOP=1'],
    { input: query, encoding: 'utf8' }
  );
  if (r.status !== 0) throw new Error(r.stderr || r.error?.message || 'psql 실패');
  return r.stdout.split('\n').filter((l) => l.length > 0);
}

/** owner 로그인 상태로 RPC 를 부른다(앱과 같은 권한 경로). */
const asOwner = (body) =>
  sql(`BEGIN;
SELECT set_config('request.jwt.claims', '{"sub":"${OWNER_ID}","role":"authenticated"}', true) \\g /dev/null
SET LOCAL ROLE authenticated;
${body}
COMMIT;`);

function run(cmd, args, label) {
  process.stdout.write(`\n▶ ${label}\n`);
  const r = spawnSync(cmd, args, {
    cwd: root,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  if (r.status !== 0) {
    process.stderr.write(`✖ ${label} 실패\n`);
    process.exit(1);
  }
}

try {
  sql('select 1');
} catch {
  process.stderr.write(
    '✖ 로컬 Supabase 에 연결할 수 없습니다. Docker Desktop 을 켜고 uniqn-mobile 에서 `npx supabase start` 후 다시 실행하세요.\n'
  );
  process.exit(1);
}

run('node', ['scripts/seed-local.mjs'], '시드 적용(계정·대회)');

const [tid] = sql(
  `select id from ops_tournaments where owner_id='${OWNER_ID}' and name='${SEED_TOURNAMENT}'`
);
if (!tid) {
  process.stderr.write(`✖ 시드 대회 "${SEED_TOURNAMENT}" 를 찾지 못했습니다\n`);
  process.exit(1);
}
const monitorToken = asOwner(
  `SELECT public.ops_rotate_monitor_token('${tid}', '${OWNER_ID}', false)->>'monitorToken';`
).find((l) => l.length >= 32);
const [pid] = sql(
  `select id from ops_participants where tournament_id='${tid}' and name='${PLAYER_NAME}' limit 1`
);
// 계정 연결을 다시 해 볼 수 있게 로컬에서만 연결을 풀고 PIN 을 새로 뽑는다
sql(`update ops_participants set player_user_id = null where id='${pid}'`);
const cred = asOwner(
  `SELECT (r->>'viewToken')||'|'||(r->>'claimPin') FROM (SELECT public.ops_issue_player_credentials('${pid}', '${OWNER_ID}') AS r) s;`
).find((l) => l.includes('|'));
const [viewToken, claimPin] = (cred ?? '|').split('|');

if (!process.argv.includes('--no-build')) run(npm, ['run', 'build'], '개발 모드 빌드');

const base = `http://localhost:${PORT}`;
process.stdout.write(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 ops-web 로컬 테스트 준비 완료 — 체크리스트: docs/qa/ops-web-local-manual-test.md
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 로그인          ${base}/login
 운영자 계정     ops-owner@uniqn.test / TestPass1!
 선수 계정       ops-dealer@uniqn.test / TestPass1!   (계정 연결 테스트용)
 미완성 계정     ops-incomplete@uniqn.test / TestPass1! (가입 미완료 안내 확인용)

 콘솔(시드 대회) ${base}/tournaments/${tid}/status
 전광판(TV)      ${base}/monitor/${monitorToken}
 플레이어뷰      ${base}/live/${viewToken}
 연결 PIN        ${claimPin}   (${PLAYER_NAME} — 실행할 때마다 새로 발급·연결 해제)

 메일(비밀번호 재설정 확인) http://127.0.0.1:54324
 종료: Ctrl+C
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);

const preview = spawn(
  npm,
  ['exec', '--', 'vite', 'preview', '--port', String(PORT), '--strictPort'],
  {
    cwd: root,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  }
);
preview.on('exit', (code) => process.exit(code ?? 0));
