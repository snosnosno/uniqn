/**
 * 콘솔 도구 — 좌석 메뉴 · CSV 내보내기 · 플레이어 QR/슬립 인쇄 · 레벨 알림 · 이력 필터 (로컬 전용).
 * 테스트 전용 대회(테이블 2 · 참가자 4 · 10분 레벨 2개)를 앱과 같은 RPC 로 만들고, 끝나면 보관한다.
 * 실행: node e2e/w9-console-tools.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import {
  BASE,
  OWNER,
  OWNER_ID,
  SHOT_DIR,
  archiveAsOwner,
  assert,
  chromium,
  finish,
  login,
  prepareLocal,
  sql,
  step,
} from './lib.mjs';

prepareLocal();

const asOwner = (body) =>
  sql(`BEGIN;
SELECT set_config('request.jwt.claims', '{"sub":"${OWNER_ID}","role":"authenticated"}', true) \\g /dev/null
SET LOCAL ROLE authenticated;
${body}
COMMIT;`);

const TOURNAMENT_NAME = `E2E 도구 ${Date.now()}`;
const [tid] =
  asOwner(`SELECT (public.ops_create_tournament('${OWNER_ID}', '${TOURNAMENT_NAME}', 'E2E', current_date, 'NLH',
  NULL, 10000, 9,
  '{"buy_in_chips":10000,"rebuy_chips":10000,"addon_chips":5000,"buy_in_cost":100000,"fee_cost":0,"rebuy_cost":100000,"addon_cost":50000,"bounty_cost":null}'::jsonb)->>'tournament_id');`).filter(
    (l) => /^[0-9a-f-]{36}$/.test(l)
  );
assert(tid, '테스트 대회 생성 실패');
asOwner(`SELECT public.ops_add_table('${tid}', '${OWNER_ID}', 9, NULL, 'none', NULL) \\g /dev/null
SELECT public.ops_add_table('${tid}', '${OWNER_ID}', 9, NULL, 'none', NULL) \\g /dev/null
SELECT public.ops_set_tournament_status('${tid}', '${OWNER_ID}', 'active') \\g /dev/null
SELECT public.ops_set_blind_levels('${tid}', '${OWNER_ID}', '[{"level":1,"small_blind":100,"big_blind":200,"ante":0,"duration_sec":600,"is_break":false},{"level":2,"small_blind":200,"big_blind":400,"ante":400,"duration_sec":600,"is_break":false}]'::jsonb) \\g /dev/null
SELECT public.ops_register_participant('${tid}', '${OWNER_ID}', '가선수', 'KR', '01011112222', 100000) \\g /dev/null
SELECT public.ops_register_participant('${tid}', '${OWNER_ID}', '나선수', 'KR', NULL, 100000) \\g /dev/null
SELECT public.ops_register_participant('${tid}', '${OWNER_ID}', '=수식선수', 'KR', NULL, 100000) \\g /dev/null
SELECT public.ops_register_participant('${tid}', '${OWNER_ID}', '라선수', 'KR', NULL, 100000) \\g /dev/null`);

const one = (q) => sql(q)[0];
const seatOf = (name) =>
  one(`select coalesce((select 'T'||s.table_no||'-'||s.seat_no from ops_seats s join ops_participants p on p.id=s.participant_id
       where p.tournament_id='${tid}' and p.name='${name}'), 'NONE')`);
const rebuysOf = (name) =>
  Number(
    one(`select rebuys from ops_participants where tournament_id='${tid}' and name='${name}'`)
  );

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 1280, height: 900 },
  acceptDownloads: true,
});
// 알림음 검증 — AudioContext 의 오실레이터 생성 수를 센다(소리 자체는 headless 라 들을 수 없다).
await ctx.addInitScript(() => {
  window.__osc = 0;
  const Orig = window.AudioContext;
  if (!Orig) return;
  window.AudioContext = class extends Orig {
    createOscillator() {
      window.__osc += 1;
      return super.createOscillator();
    }
  };
});
const page = await ctx.newPage();
const until = async (ok, tries = 25) => {
  for (let i = 0; i < tries && !(await ok()); i += 1) await page.waitForTimeout(200);
};

await page.goto(`${BASE}/login?redirect=${encodeURIComponent(`/tournaments/${tid}/tables`)}`);
await login(page, OWNER);
await page.waitForURL(`${BASE}/tournaments/${tid}/tables`);

process.stdout.write('콘솔 도구\n');

await step('좌석 우클릭 메뉴 → 리바이 → DB rebuys+1 (선택 없이 바로)', async () => {
  const seat = seatOf('가선수');
  assert(seat !== 'NONE', '가선수 미착석');
  await page.locator(`button[data-seat="${seat}"]`).click({ button: 'right' });
  const menu = page.getByRole('menu');
  await menu.getByText('가선수').waitFor();
  await menu.getByRole('menuitem', { name: /리바이/ }).click();
  await until(() => rebuysOf('가선수') === 1);
  assert(rebuysOf('가선수') === 1, `rebuys=${rebuysOf('가선수')}`);
  await page.screenshot({ path: path.join(SHOT_DIR, 'w9-seat-menu-after.png') });
});

await step('좌석 메뉴 → 이동 → "T2-9" 입력 → DB 반영', async () => {
  await page.locator(`button[data-seat="${seatOf('나선수')}"]`).click({ button: 'right' });
  await page.getByRole('menu').getByRole('menuitem', { name: /이동/ }).click();
  const input = page.getByLabel('이동할 좌석(T5-2)');
  await input.fill('T2-9');
  await input.press('Enter');
  await until(() => seatOf('나선수') === 'T2-9');
  assert(seatOf('나선수') === 'T2-9', `이동 안 됨: ${seatOf('나선수')}`);
});

await step('좌석 메뉴 → 비우기 → DB 반영 · 빈 칸은 메뉴가 없다', async () => {
  await page.keyboard.press('Escape');
  await page.locator('button[data-seat="T2-9"]').click({ button: 'right' });
  await page.getByRole('menu').getByRole('menuitem', { name: '비우기' }).click();
  await until(() => seatOf('나선수') === 'NONE');
  assert(seatOf('나선수') === 'NONE', '비우기 안 됨');
  await page.locator('button[data-seat="T2-9"]').click({ button: 'right' });
  await page.waitForTimeout(300);
  assert((await page.getByRole('menu').count()) === 0, '빈 칸에 메뉴가 열렸다');
});

await step('참가 탭 CSV: BOM·머리글·전원·수식 차단·연락처 제외', async () => {
  await page.goto(`${BASE}/tournaments/${tid}/players`);
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'CSV' }).click(),
  ]);
  // 파일 이름(한글)은 단위 테스트(csvFileName)가 고정한다 — headless shell 은 비ASCII download 이름을
  // 버리고 "download" 로 저장한다(실측: 'a.csv' 는 유지, '한글.csv' 는 download). 실제 Chrome 은 유지.
  const fileName = download.suggestedFilename();
  assert(fileName.endsWith('.csv') || fileName === 'download', fileName);
  const text = fs.readFileSync(await download.path(), 'utf8');
  assert(text.charCodeAt(0) === 0xfeff, 'BOM 없음');
  const lines = text.slice(1).trimEnd().split('\r\n');
  assert(lines[0].startsWith('엔트리,이름,상태,좌석,칩'), `머리글: ${lines[0]}`);
  assert(lines.length === 5, `행 수 ${lines.length}`);
  assert(text.includes(",'=수식선수,"), '수식 주입 차단 안 됨');
  assert(!text.includes('01011112222'), '연락처가 들어갔다');
  fs.copyFileSync(await download.path(), path.join(SHOT_DIR, 'w9-export.csv'));
});

await step('PIN 발급 → QR 표시 · 인쇄하면 슬립만(대회명·이름·PIN·QR)', async () => {
  await page.getByRole('row', { name: /라선수/ }).click();
  await page.getByRole('button', { name: '플레이어 링크·PIN 발급' }).click();
  const dlg = page.getByRole('dialog');
  await dlg.getByRole('img', { name: /라선수 플레이어 화면 QR/ }).waitFor();
  const pin = (await dlg.locator('b.num').first().textContent())?.trim() ?? '';
  assert(/^[0-9A-Z]{8}$/.test(pin), `PIN 형식: ${pin}`);
  await dlg.getByRole('button', { name: '슬립 인쇄' }).waitFor();
  await page.screenshot({ path: path.join(SHOT_DIR, 'w9-credentials.png') });

  await page.emulateMedia({ media: 'print' });
  const slip = page.locator('.print-slip');
  assert(await slip.isVisible(), '인쇄 모드에서 슬립이 안 보인다');
  assert(!(await page.getByRole('dialog').isVisible()), '인쇄 모드에서 대화상자가 보인다');
  const slipText = (await slip.textContent()) ?? '';
  for (const want of [TOURNAMENT_NAME, '라선수', pin]) {
    assert(slipText.includes(want), `슬립에 ${want} 없음`);
  }
  // 대화상자가 열려 있는 동안 Radix 가 바깥 요소에 aria-hidden 을 걸어 getByRole 로는 안 잡힌다 — svg 로 센다
  assert((await slip.locator('svg').count()) === 1, '슬립에 QR 없음');
  await page.pdf({ path: path.join(SHOT_DIR, 'w9-slip.pdf'), width: '80mm', height: '160mm' });
  await page.emulateMedia({ media: 'screen' });
  await page.getByRole('dialog').getByRole('button', { name: '확인' }).click();
  assert((await page.locator('.print-slip').count()) === 0, '창을 닫았는데 슬립이 남았다');
});

await step(
  '레벨 알림: 켜기 → 1분 이하 경고색 + 1음 → 00:00 자동 전환 2음 → 남은 시간 5:00 맞추기',
  async () => {
    await page.getByRole('button', { name: /클럭 제어 열기/ }).click();
    const dlg = page.getByRole('dialog');
    await dlg.getByRole('button', { name: '꺼짐' }).click();
    await dlg.getByRole('button', { name: '켜짐' }).waitFor();
    await page.waitForTimeout(400);
    const afterToggle = await page.evaluate(() => window.__osc);
    assert(afterToggle === 1, `켤 때 미리듣기 1음이어야 함: ${afterToggle}`);
    await dlg.getByRole('button', { name: '클럭 시작' }).click();
    await dlg.getByRole('button', { name: '클럭 일시정지' }).waitFor();
    // 10분 → 1분 단축 9번 → 1분 안쪽으로 넘어간다
    for (let i = 0; i < 9; i += 1) {
      await dlg.getByRole('button', { name: '1분 단축' }).click();
      await page.waitForTimeout(250);
    }
    await until(async () => (await page.evaluate(() => window.__osc)) >= 2, 40);
    const afterWarn = await page.evaluate(() => window.__osc);
    assert(afterWarn === 2, `1분 경고 1음: ${afterWarn}`);
    await page.keyboard.press('Escape');
    const clockClass = await page.locator('.clock').first().getAttribute('class');
    assert(clockClass?.includes('text-warning'), `경고색 아님: ${clockClass}`);
    await page.screenshot({ path: path.join(SHOT_DIR, 'w9-clock-warning.png') });
    await page.getByRole('button', { name: /클럭 제어 열기/ }).click();
    // 1분 남짓에서 1분 더 단축 → 00:00 → 서버가 다음 레벨로 자동 전환 → 전환 2음
    // (다음 레벨이 있으면 '시간 종료' 3음은 울리지 않는다 — 두 소리가 겹치지 않게)
    await page.getByRole('dialog').getByRole('button', { name: '1분 단축' }).click();
    await until(async () => (await page.evaluate(() => window.__osc)) >= 4, 60);
    await page.waitForTimeout(600);
    const afterLevel = await page.evaluate(() => window.__osc);
    assert(afterLevel === 4, `자동 전환 2음(시간 종료음 없음): ${afterLevel}`);
    assert(
      one(`select current_level_sort from ops_clock where tournament_id='${tid}'`) === '2',
      '00:00 뒤 레벨 2 로 자동 전환되지 않았다'
    );
    // 남은 시간 직접 맞추기 — 기존 보정 RPC 로 차이만큼 증감(새 RPC 없음)
    const seek = page.getByRole('dialog').getByLabel('남은 시간 맞추기');
    await seek.fill('5:00');
    await seek.press('Enter');
    const remainingSec = async () => {
      const label = await page
        .getByRole('dialog')
        .getByLabel(/^남은 시간 \d/)
        .getAttribute('aria-label');
      const [mm, ss] = label.replace('남은 시간 ', '').split(':').map(Number);
      return mm * 60 + ss;
    };
    await until(async () => Math.abs((await remainingSec()) - 300) <= 2, 40);
    assert(Math.abs((await remainingSec()) - 300) <= 2, `시간 맞추기: ${await remainingSec()}초`);
    await seek.fill('1:5');
    await seek.press('Enter');
    await page.getByRole('dialog').getByRole('alert').waitFor();
    await page.keyboard.press('Escape');
  }
);

await step('이력: 분류 필터(참가자·클럭) · 다른 분류는 숨는다', async () => {
  await page.goto(`${BASE}/tournaments/${tid}/history`);
  const group = page.getByRole('radiogroup', { name: '이력 분류' });
  await group.waitFor();
  await group.getByRole('radio', { name: '참가자' }).click();
  await page.getByText('리바이', { exact: true }).first().waitFor();
  assert(
    (await page.getByText('레벨 시작', { exact: true }).count()) === 0,
    '참가자 분류에 클럭 기록'
  );
  await group.getByRole('radio', { name: '클럭' }).click();
  await page.getByText('레벨 시작', { exact: true }).first().waitFor();
  assert((await page.getByText('리바이', { exact: true }).count()) === 0, '클럭 분류에 리바이');
  await page.screenshot({ path: path.join(SHOT_DIR, 'w9-history-filter.png') });
});

await browser.close();
asOwner(
  `SELECT public.ops_set_tournament_status('${tid}', '${OWNER_ID}', 'completed') \\g /dev/null`
);
archiveAsOwner(OWNER_ID, [tid]);
finish();
