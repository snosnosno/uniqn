/**
 * W4 콘솔 1 완료 기준(설계 §9) — 로컬 전용.
 *   두 브라우저 realtime 반영 · 오프라인→복귀 동기화 · 클럭 서버시각 보정(기기 시계 +90초) ·
 *   참가자 액션(리바이 단축키·탈락 확인창·되돌리기 토스트·칩·등록) · 스크린샷
 * 1시간 방치 검증은 별도: e2e/w4-idle.mjs
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
  screenshots,
  sql,
  step,
} from './lib.mjs';

prepareLocal();
const [tid] = sql(
  `select id from ops_tournaments where owner_id='${OWNER_ID}' and name='시드 · 수요 딥스택'`
);
assert(tid, '시드 대회가 없습니다');
const consoleUrl = (tab) => `${BASE}/tournaments/${tid}/${tab}`;

const browser = await chromium.launch();
async function openConsole(tab, ctxOptions = {}, beforeGoto) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, ...ctxOptions });
  const page = await ctx.newPage();
  if (beforeGoto) await beforeGoto(page);
  await page.goto(`${BASE}/login?redirect=${encodeURIComponent(`/tournaments/${tid}/${tab}`)}`);
  await login(page, OWNER);
  await page.waitForURL(consoleUrl(tab));
  return page;
}
const participant = (name) =>
  sql(
    `select status||'|'||rebuys||'|'||chips from ops_participants where tournament_id='${tid}' and name='${name}'`
  )[0];

process.stdout.write('W4 콘솔 1\n');
const a = await openConsole('players');

await step('참가 탭: 18명 표·현황 통계 PLAYING 18', async () => {
  await a.getByRole('button', { name: '김민준' }).waitFor();
  const rows = await a.locator('tbody tr').count();
  assert(rows >= 18, `행 ${rows}`);
  await a.goto(consoleUrl('status'));
  const playing = a.getByLabel('라이브 통계').locator('div', { hasText: 'PLAYING' }).first();
  await playing.waitFor();
  assert(/\d+/.test(await playing.textContent()), 'PLAYING 값 없음');
  await a.goto(consoleUrl('players'));
});

await step('선택 + R 단축키 → 리바이(DB rebuys+1)', async () => {
  const before = participant('이서연');
  await a.getByRole('button', { name: '이서연' }).click();
  await a.getByText('선택됨 · #').waitFor();
  await a.locator('body').click({ position: { x: 5, y: 5 } }); // 입력칸 포커스 해제
  await a.getByRole('button', { name: '이서연' }).click();
  await a.keyboard.press('KeyR');
  let after = before;
  for (let i = 0; i < 20 && after === before; i += 1) {
    await a.waitForTimeout(200);
    after = participant('이서연');
  }
  const [, rb0] = before.split('|');
  const [, rb1] = after.split('|');
  assert(Number(rb1) === Number(rb0) + 1, `rebuys ${rb0} → ${rb1}`);
});

await step('X → 탈락 확인창(예상 순위 표시) → Enter → 탈락 → 되돌리기 토스트로 복구', async () => {
  await a.getByRole('button', { name: '박도윤' }).click();
  await a.keyboard.press('KeyX');
  const dialog = a.getByRole('dialog');
  await dialog.getByText('예상 순위').waitFor();
  await a.waitForTimeout(200);
  await a.keyboard.press('Enter');
  let st = '';
  for (let i = 0; i < 20 && !st.startsWith('busted'); i += 1) {
    await a.waitForTimeout(200);
    st = participant('박도윤');
  }
  assert(st.startsWith('busted'), `탈락 안 됨: ${st}`);
  await a.getByRole('button', { name: '되돌리기' }).click();
  for (let i = 0; i < 20 && st.startsWith('busted'); i += 1) {
    await a.waitForTimeout(200);
    st = participant('박도윤');
  }
  assert(st.startsWith('active'), `되돌리기 실패: ${st}`);
});

await step('C → 칩 카운트(증감 미리보기) → 저장', async () => {
  // 반복 실행에도 값이 바뀌도록 현재값 + 5,000 (같은 값이면 미리보기가 숨는 게 정상 동작)
  const next = Number(participant('최지우').split('|')[2]) + 5000;
  await a.getByRole('button', { name: '최지우' }).click();
  await a.keyboard.press('KeyC');
  const dialog = a.getByRole('dialog');
  await dialog.getByLabel('새 칩 수량').fill(String(next));
  await dialog.getByText(`→ ${next.toLocaleString('ko-KR')}`).waitFor();
  await dialog.getByRole('button', { name: '칩 수량 저장' }).click();
  await dialog.waitFor({ state: 'detached' });
  assert(participant('최지우').endsWith(`|${next}`), participant('최지우'));
});

const b = await openConsole('players');
const newName = `E2E선수${Date.now() % 100000}`;

await step('두 브라우저: A 에서 N 등록 → B 표에 새로고침 없이 나타남', async () => {
  await b.getByRole('button', { name: '김민준' }).waitFor();
  await a.keyboard.press('KeyN');
  const dialog = a.getByRole('dialog');
  await dialog.getByLabel('이름 *').fill(newName);
  await dialog.getByRole('button', { name: '등록' }).click();
  // 연속 등록 — 창은 열린 채 이름 칸이 비워진다
  await a.waitForFunction(() => document.activeElement?.id === 'reg-name');
  await a.keyboard.press('Escape');
  await b.getByRole('button', { name: newName }).waitFor({ timeout: 5000 });
});

await step('B 오프라인 중 A 변경 → B 온라인 복귀 시 동기화', async () => {
  // 새로 등록한 참가자는 좌석이 꽉 차 대기(checked_in)라 리바이 대상이 아니다 — 진행 중 참가자로.
  const target = '정하준';
  const rb0 = Number(participant(target).split('|')[1]);
  await b.context().setOffline(true);
  await b.waitForTimeout(500);
  await a.getByRole('button', { name: target }).click();
  await a.keyboard.press('KeyR');
  let rb1 = rb0;
  for (let i = 0; i < 20 && rb1 === rb0; i += 1) {
    await a.waitForTimeout(200);
    rb1 = Number(participant(target).split('|')[1]);
  }
  assert(rb1 === rb0 + 1, `A 리바이 실패 ${rb0} → ${rb1}`);
  await b.context().setOffline(false);
  await b.getByRole('row', { name: new RegExp(`${target}.*R${rb1}`) }).waitFor({ timeout: 8000 });
});

await step('클럭 서버시각 보정: 기기 시계 +90초 브라우저도 남은 시간이 같다(±2초)', async () => {
  // 시드 클럭은 오래전에 시작돼 00:00 일 수 있다 — 그러면 비교가 공허해진다. 앱과 같은 RPC 로
  // 레벨 앵커를 지금으로 다시 잡는다(ops_clock_set_level 은 level_started_at = now()).
  sql(`BEGIN;
SELECT set_config('request.jwt.claims', '{"sub":"${OWNER_ID}","role":"authenticated"}', true) \\g /dev/null
SET LOCAL ROLE authenticated;
SELECT public.ops_clock_set_level('${tid}', '${OWNER_ID}', 1) \\g /dev/null
SELECT public.ops_clock_start('${tid}', '${OWNER_ID}') \\g /dev/null
COMMIT;`);
  const skewed = await openConsole('status', {}, (p) =>
    p.clock.install({ time: Date.now() + 90_000 })
  );
  const normal = await openConsole('status');
  await skewed.waitForTimeout(3000); // 샘플 누적
  const read = async (p) => {
    const t = await p.getByRole('button', { name: /클럭 제어 열기/ }).getAttribute('aria-label');
    const m = /남은 시간 (\d+):(\d+)/.exec(t);
    return Number(m[1]) * 60 + Number(m[2]);
  };
  const [s, n] = await Promise.all([read(skewed), read(normal)]);
  assert(n > 60 && n < 1200, `정상 브라우저 클럭이 흐르지 않음: ${n}s`);
  assert(Math.abs(s - n) <= 2, `보정 실패: 기울어진 ${s}s vs 정상 ${n}s`);
  await skewed.context().close();
  await normal.context().close();
});

await step('스크린샷 375/768/1280 × 다크/라이트 (현황·참가)', async () => {
  const prepare = async (p) => {
    await p.goto(`${BASE}/login`);
    await login(p, OWNER);
    await p.waitForURL(`${BASE}/tournaments`);
  };
  await screenshots(browser, `/tournaments/${tid}/status`, 'w4-status', { prepare });
  await screenshots(browser, `/tournaments/${tid}/players`, 'w4-players', { prepare });
});

await browser.close();
finish();
