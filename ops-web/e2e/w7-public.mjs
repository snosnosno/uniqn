/**
 * W7 — 공개뷰(전광판·플레이어뷰) + 운영자 전광판 섹션 — 로컬 전용.
 * 완료 기준(설계 §9): 비로그인 접근 · claim 왕복(ops 로그인 → 복귀) · 토큰 무효 시 폴링 정지.
 * 실행: node e2e/w7-public.mjs
 */
import {
  BASE,
  OWNER,
  OWNER_ID,
  archiveAsOwner,
  assert,
  chromium,
  finish,
  login,
  prepareLocal,
  SHOT_DIR,
  sql,
  step,
} from './lib.mjs';

prepareLocal();

const DEALER = 'ops-dealer@uniqn.test';
const DEALER_ID = '0a5e0000-0000-4000-8000-000000000003';
const asOwner = (body) =>
  sql(`BEGIN;
SELECT set_config('request.jwt.claims', '{"sub":"${OWNER_ID}","role":"authenticated"}', true) \\g /dev/null
SET LOCAL ROLE authenticated;
${body}
COMMIT;`);

const name = `E2E W7 ${Date.now()}`;
const [tid] =
  asOwner(`SELECT (public.ops_create_tournament('${OWNER_ID}', '${name}', 'E2E', current_date, 'NLH',
  NULL, 10000, 9,
  '{"buy_in_chips":10000,"rebuy_chips":10000,"addon_chips":5000,"buy_in_cost":100000,"fee_cost":0,"rebuy_cost":100000,"addon_cost":50000,"bounty_cost":null}'::jsonb)->>'tournament_id');`).filter(
    (l) => /^[0-9a-f-]{36}$/.test(l)
  );
assert(tid, '테스트 대회 생성 실패');
asOwner(`SELECT public.ops_add_table('${tid}', '${OWNER_ID}', 9, NULL, 'none', NULL) \\g /dev/null
SELECT public.ops_set_blind_levels('${tid}', '${OWNER_ID}', '[{"level":1,"small_blind":100,"big_blind":200,"ante":0,"duration_sec":1200,"is_break":false},{"level":2,"small_blind":200,"big_blind":400,"ante":400,"duration_sec":1200,"is_break":false}]'::jsonb) \\g /dev/null
SELECT public.ops_set_tournament_status('${tid}', '${OWNER_ID}', 'active') \\g /dev/null
SELECT public.ops_register_participant('${tid}', '${OWNER_ID}', '가선수', 'KR', NULL, 100000) \\g /dev/null
SELECT public.ops_register_participant('${tid}', '${OWNER_ID}', '나선수', 'KR', NULL, 100000) \\g /dev/null
SELECT public.ops_set_prize_structure('${tid}', '${OWNER_ID}', '[{"rank":1,"amount":120000},{"rank":2,"amount":80000}]'::jsonb) \\g /dev/null
SELECT public.ops_clock_start('${tid}', '${OWNER_ID}') \\g /dev/null`);

const browser = await chromium.launch();
const until = async (page, ok, n = 30) => {
  for (let i = 0; i < n && !ok(); i += 1) await page.waitForTimeout(200);
};

process.stdout.write('W7 공개뷰\n');

// 운영자
const opCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const op = await opCtx.newPage();
await op.goto(`${BASE}/login?redirect=${encodeURIComponent(`/tournaments/${tid}/status`)}`);
await login(op, OWNER);
await op.waitForURL(`${BASE}/tournaments/${tid}/status`);

let monitorToken = '';
await step(
  '운영자: 전광판 "링크 발급" → 토큰 발급 → "새 창"이 /monitor/<토큰> 을 연다',
  async () => {
    await op.getByRole('button', { name: '링크 발급' }).click();
    await op.getByRole('button', { name: /새 창/ }).waitFor();
    const [popup] = await Promise.all([
      op.waitForEvent('popup'),
      op.getByRole('button', { name: /새 창/ }).click(),
    ]);
    await popup.waitForURL(/\/monitor\/[A-Za-z0-9_-]{32,}/);
    monitorToken = sql(`select monitor_token from ops_tournaments where id='${tid}'`)[0];
    assert(popup.url().endsWith(`/monitor/${monitorToken}`), `팝업 주소 불일치: ${popup.url()}`);
    await popup.close();
  }
);

// 비로그인(anon) 시청자
const tvCtx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
const tv = await tvCtx.newPage();
await step(
  '전광판(비로그인): 대회명·LEVEL·진행 중 클럭·PRIZE POOL 표시, 1초마다 줄어든다',
  async () => {
    await tv.goto(`${BASE}/monitor/${monitorToken}`);
    await tv.getByRole('heading', { name }).waitFor();
    await tv.getByText('LEVEL 1').waitFor();
    await tv.getByText('PRIZE POOL').waitFor();
    const clock = tv.getByLabel(/^남은 시간 /);
    const a = await clock.textContent();
    await tv.waitForTimeout(2200);
    const b = await clock.textContent();
    assert(a !== b && /^\d\d:\d\d$/.test(b ?? ''), `클럭이 흐르지 않음: ${a} → ${b}`);
    assert(
      (await tv.evaluate(() => document.documentElement.dataset.theme)) === 'dark',
      '전광판이 다크가 아님'
    );
    await tv.screenshot({ path: `${SHOT_DIR}/w7-monitor-full-1920.png` });
  }
);

await step(
  '운영자: TV 구성 클래식 저장 → 전광판(폴링)이 클래식으로 바뀐다(상금 열 없음)',
  async () => {
    await op.getByRole('radio', { name: /클래식/ }).click();
    await op.getByRole('button', { name: '저장', exact: true }).click();
    await until(
      op,
      () =>
        (sql(`select monitor_config->>'preset' from ops_tournaments where id='${tid}'`)[0] ??
          '') === 'classic'
    );
    await tv.locator('section[aria-label="상금"]').waitFor({ state: 'detached', timeout: 12_000 });
    await tv.screenshot({ path: `${SHOT_DIR}/w7-monitor-classic-1920.png` });
  }
);

await step('전광판 세로(390): 세로 스택으로 표시', async () => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const p = await ctx.newPage();
  await p.goto(`${BASE}/monitor/${monitorToken}`);
  await p.getByLabel(/^남은 시간 /).waitFor();
  const overflow = await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  assert(!overflow, '가로 넘침');
  await p.screenshot({ path: `${SHOT_DIR}/w7-monitor-390.png`, fullPage: true });
  await ctx.close();
});

await step('무효 토큰: "유효하지 않은 모니터 링크" + 폴링 정지(10초간 요청 0)', async () => {
  const ctx = await browser.newContext();
  const p = await ctx.newPage();
  let calls = 0;
  p.on('request', (r) => {
    if (r.url().includes('/rpc/ops_get_monitor_snapshot')) calls += 1;
  });
  await p.goto(`${BASE}/monitor/${'x'.repeat(40)}`);
  await p.getByText('유효하지 않은 모니터 링크입니다').waitFor();
  const settled = calls;
  await p.waitForTimeout(5_000);
  // 창 포커스·네트워크 복귀로도 다시 묻지 않아야 한다(전역 refetchOnWindowFocus/Reconnect — 리뷰 W7)
  await p.evaluate(() => {
    document.dispatchEvent(new Event('visibilitychange'));
    window.dispatchEvent(new Event('focus'));
    window.dispatchEvent(new Event('offline'));
    window.dispatchEvent(new Event('online'));
  });
  await p.waitForTimeout(5_000);
  assert(calls === settled, `무효 토큰인데 폴링 계속: ${settled} → ${calls}`);
  await ctx.close();
});

// 플레이어뷰
const [gaId] = sql(
  `select id from ops_participants where tournament_id='${tid}' and name='가선수'`
);
const cred = asOwner(
  `SELECT (r->>'viewToken')||'|'||(r->>'claimPin') FROM (SELECT public.ops_issue_player_credentials('${gaId}', '${OWNER_ID}') AS r) s;`
).find((l) => l.includes('|'));
const [viewToken, claimPin] = (cred ?? '|').split('|');

const pvCtx = await browser.newContext({ viewport: { width: 390, height: 844 } });
// 이 앱의 테마는 브라우저 선호가 아니라 저장값(ops-web:theme)으로 정한다 — 라이트를 실제로 켠다
await pvCtx.addInitScript(() => localStorage.setItem('ops-web:theme', 'light'));
const pv = await pvCtx.newPage();
await step('플레이어뷰(비로그인): 이름·내 자리·스택·클럭, 로그인 CTA', async () => {
  assert(viewToken && claimPin, `자격 발급 실패: ${cred}`);
  await pv.goto(`${BASE}/live/${viewToken}`);
  await pv.getByText('내 자리').waitFor();
  // 비가역 연결 전에 본인 기록인지 확인할 이름·번호가 화면에 보여야 한다(리뷰 W7)
  assert(
    await pv
      .getByText(/#\d+ 가선수/)
      .first()
      .isVisible(),
    '이름·엔트리 번호가 화면에 안 보임'
  );
  assert(
    (await pv.evaluate(() => document.documentElement.dataset.theme)) === 'light',
    '라이트 테마가 적용되지 않음'
  );
  await pv.getByLabel(/^남은 시간 /).waitFor();
  await pv.getByRole('link', { name: '로그인하고 연결하기' }).waitFor();
  await pv.screenshot({ path: `${SHOT_DIR}/w7-player-light-390.png`, fullPage: true });
});

await step(
  'claim 왕복: 로그인하고 연결하기 → ops 로그인 → /live 로 복귀 → PIN → DB 연결',
  async () => {
    await pv.getByRole('link', { name: '로그인하고 연결하기' }).click();
    await pv.waitForURL(/\/login\?redirect=/);
    await login(pv, DEALER);
    await pv.waitForURL(`${BASE}/live/${viewToken}`);
    await pv.getByRole('button', { name: '내 계정에 연결하기' }).click();
    await pv.getByLabel('연결 PIN').fill(claimPin.toLowerCase());
    await pv.getByRole('button', { name: '연결하기', exact: true }).click();
    const linked = () =>
      sql(`select coalesce(player_user_id::text,'') from ops_participants where id='${gaId}'`)[0];
    await until(pv, () => linked() === DEALER_ID);
    assert(linked() === DEALER_ID, `연결 안 됨: ${linked()}`);
    await pv.getByText('내 계정에 연결했습니다').waitFor();
  }
);

await step('익명 신고: 사유를 화살표 키로 선택(끝에서 돈다) → 접수 → DB 1건', async () => {
  const ctx = await browser.newContext();
  const p = await ctx.newPage();
  const before = Number(
    sql(`select count(*) from ops_public_reports where tournament_id='${tid}'`)[0]
  );
  await p.goto(`${BASE}/live/${viewToken}`);
  await p.getByRole('button', { name: '이 대회 신고하기' }).click();
  const radios = p.getByRole('radio');
  const checkedIndex = () =>
    radios.evaluateAll((els) => els.findIndex((e) => e.getAttribute('aria-checked') === 'true'));
  const tabStops = () =>
    radios.evaluateAll((els) => els.filter((e) => e.getAttribute('tabindex') === '0').length);
  assert((await checkedIndex()) === 0, '처음엔 첫 사유가 선택');
  assert((await tabStops()) === 1, 'Tab 으로 들어오는 칸은 하나');
  await radios.nth(0).focus();
  await p.keyboard.press('ArrowDown');
  assert((await checkedIndex()) === 1, 'ArrowDown → 두 번째');
  await p.keyboard.press('ArrowUp');
  await p.keyboard.press('ArrowUp');
  assert((await checkedIndex()) === 2, '처음에서 ArrowUp → 끝(기타)');
  const focusedIsOther = await p.evaluate(
    () => document.activeElement?.textContent?.trim() === '기타'
  );
  assert(focusedIsOther, '포커스도 선택된 칸(기타)으로 옮겨 간다');
  assert((await tabStops()) === 1, '이동 후에도 Tab 칸은 하나');
  await p.getByRole('button', { name: '신고', exact: true }).click();
  await p.getByText('신고가 접수됐어요').waitFor();
  const after = Number(
    sql(`select count(*) from ops_public_reports where tournament_id='${tid}'`)[0]
  );
  assert(after === before + 1, `신고 건수 ${before} → ${after}`);
  await ctx.close();
});

await step('플레이어뷰 다크 390 스크린샷 · 무효 뷰 토큰 안내', async () => {
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    colorScheme: 'dark',
  });
  const p = await ctx.newPage();
  await p.goto(`${BASE}/live/${viewToken}`);
  await p.getByText('내 자리').waitFor();
  await p.screenshot({ path: `${SHOT_DIR}/w7-player-dark-390.png`, fullPage: true });
  await p.goto(`${BASE}/live/${'y'.repeat(40)}`);
  await p.getByText('유효하지 않은 플레이어 링크입니다').waitFor();
  await ctx.close();
});

asOwner(
  `SELECT public.ops_set_tournament_status('${tid}', '${OWNER_ID}', 'completed') \\g /dev/null`
);
await step(
  '완료 대회도 현황 탭에 전광판 섹션이 보인다(최종 순위를 TV 에 — 모바일과 같다)',
  async () => {
    await op.reload();
    await op.getByRole('region', { name: '전광판' }).waitFor();
    await op.getByRole('button', { name: /링크 복사/ }).waitFor();
  }
);
archiveAsOwner(OWNER_ID, [tid]);
await browser.close();
finish();
