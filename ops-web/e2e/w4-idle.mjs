/**
 * W4 — 1시간 방치 후 realtime 유지(설계 §5: 토큰 갱신이 realtime 소켓에 반영되는지).
 * 로컬 JWT 만료 = 3600초. 로그인 → 콘솔 참가 탭을 연 채 IDLE_MIN 분 방치(포커스·가시성 이벤트 없음,
 * 쿼리 자동 재조회 없음) → DB 를 앱과 같은 RPC 로 바꿈 → 새로고침 없이 표가 바뀌어야 한다.
 * 실행: IDLE_MIN=66 node e2e/w4-idle.mjs  (기본 66분)
 */
import {
  BASE,
  OWNER,
  OWNER_ID,
  assert,
  chromium,
  finish,
  login,
  prepareLocal,
  sql,
  step,
} from './lib.mjs';

const IDLE_MIN = Number(process.env.IDLE_MIN ?? 66);
prepareLocal();
const [tid] = sql(
  `select id from ops_tournaments where owner_id='${OWNER_ID}' and name='시드 · 수요 딥스택'`
);
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
await page.goto(`${BASE}/login?redirect=${encodeURIComponent(`/tournaments/${tid}/players`)}`);
await login(page, OWNER);
await page.waitForURL(`${BASE}/tournaments/${tid}/players`);
await page.getByRole('button', { name: '김민준' }).waitFor();
const startedAt = new Date().toISOString();

process.stdout.write(`W4 방치 검증 — ${IDLE_MIN}분 대기 시작 ${startedAt}\n`);
await page.waitForTimeout(IDLE_MIN * 60_000);

await step(`${IDLE_MIN}분 방치 후 DB 변경(리바이 RPC) → 새로고침 없이 표 반영`, async () => {
  const [pid, rb0] = sql(
    `select id||'|'||rebuys from ops_participants where tournament_id='${tid}' and name='김민준'`
  )[0].split('|');
  sql(`BEGIN;
SELECT set_config('request.jwt.claims', '{"sub":"${OWNER_ID}","role":"authenticated"}', true) \\g /dev/null
SET LOCAL ROLE authenticated;
SELECT public.ops_add_rebuy('${pid}', '${OWNER_ID}') \\g /dev/null
COMMIT;`);
  const want = Number(rb0) + 1;
  await page
    .getByRole('row', { name: new RegExp(`김민준.*R${want}`) })
    .waitFor({ timeout: 15_000 });
});

await step('세션이 갱신돼 로그인 상태 유지(로그인 화면으로 튕기지 않음)', async () => {
  assert(page.url().endsWith(`/tournaments/${tid}/players`), page.url());
});

process.stdout.write(`종료 ${new Date().toISOString()}\n`);
await browser.close();
finish();
