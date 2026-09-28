/**
 * W5 — 테이블 탭(좌석 행렬표) — 로컬 전용.
 * 테스트 전용 대회(테이블 2 · 참가자 4)를 앱과 같은 RPC 로 만들고, 끝나면 종료·보관한다.
 * 실행: node e2e/w5-tables.mjs
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
  screenshots,
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

const [tid] =
  asOwner(`SELECT (public.ops_create_tournament('${OWNER_ID}', 'E2E W5 ${Date.now()}', 'E2E', current_date, 'NLH',
  NULL, 10000, 9,
  '{"buy_in_chips":10000,"rebuy_chips":10000,"addon_chips":5000,"buy_in_cost":100000,"fee_cost":0,"rebuy_cost":100000,"addon_cost":50000,"bounty_cost":null}'::jsonb)->>'tournament_id');`).filter(
    (l) => /^[0-9a-f-]{36}$/.test(l)
  );
assert(tid, '테스트 대회 생성 실패');
asOwner(`SELECT public.ops_add_table('${tid}', '${OWNER_ID}', 9, NULL, 'none', NULL) \\g /dev/null
SELECT public.ops_add_table('${tid}', '${OWNER_ID}', 9, NULL, 'none', NULL) \\g /dev/null
SELECT public.ops_set_tournament_status('${tid}', '${OWNER_ID}', 'active') \\g /dev/null
SELECT public.ops_register_participant('${tid}', '${OWNER_ID}', '가선수', 'KR', NULL, 100000) \\g /dev/null
SELECT public.ops_register_participant('${tid}', '${OWNER_ID}', '나선수', 'KR', NULL, 100000) \\g /dev/null
SELECT public.ops_register_participant('${tid}', '${OWNER_ID}', '다선수', 'KR', NULL, 100000) \\g /dev/null
SELECT public.ops_register_participant('${tid}', '${OWNER_ID}', '라선수', 'KR', NULL, 100000) \\g /dev/null`);

const count = (q) => Number(sql(q)[0]);
const seatOf = (name) =>
  sql(`select coalesce((select 'T'||s.table_no||'-'||s.seat_no from ops_seats s join ops_participants p on p.id=s.participant_id
       where p.tournament_id='${tid}' and p.name='${name}'), 'NONE')`)[0];
const seated = () =>
  count(
    `select count(*) from ops_seats where tournament_id='${tid}' and participant_id is not null`
  );

const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
const until = async (ok) => {
  for (let i = 0; i < 25 && !ok(); i += 1) await page.waitForTimeout(200);
};

await page.goto(`${BASE}/login?redirect=${encodeURIComponent(`/tournaments/${tid}/tables`)}`);
await login(page, OWNER);
await page.waitForURL(`${BASE}/tournaments/${tid}/tables`);

process.stdout.write('W5 테이블(좌석 행렬표)\n');

await step('행렬표: 테이블 2행 · 착석 인원 표시(DB 와 일치)', async () => {
  await page.getByRole('button', { name: 'T1 설정' }).waitFor();
  await page.getByRole('button', { name: 'T2 설정' }).waitFor();
  const shown = await page.locator('button[data-seat][aria-pressed]').count();
  assert(shown === seated(), `표시 ${shown} ≠ DB ${seated()}`);
});

await step('좌석 선택 → M → "T2-9" 입력 이동 → DB 반영', async () => {
  const from = seatOf('가선수');
  assert(from !== 'NONE', '가선수가 착석하지 않음(등록 자동 배정 전제)');
  await page.locator(`button[data-seat="${from}"]`).click();
  await page.keyboard.press('KeyM');
  const input = page.getByLabel('이동할 좌석(T5-2)');
  await input.fill('T2-9');
  await input.press('Enter');
  await until(() => seatOf('가선수') === 'T2-9');
  assert(seatOf('가선수') === 'T2-9', `이동 안 됨: ${seatOf('가선수')}`);
});

await step('비우기 → 빈 칸 클릭 → 대기 참가자 배정 → DB 반영', async () => {
  // 이동하면 선택이 새 좌석을 따라간다(다시 누르면 선택 해제)
  const moved = page.locator('button[data-seat="T2-9"]');
  assert((await moved.getAttribute('aria-pressed')) === 'true', '이동 후 새 좌석이 선택되지 않음');
  await page.getByRole('button', { name: '비우기' }).first().click();
  await until(() => seatOf('가선수') === 'NONE');
  assert(seatOf('가선수') === 'NONE', '비우기 안 됨');
  await page.locator('button[data-seat="T1-9"]').click();
  const dlg = page.getByRole('dialog');
  await dlg.getByRole('button', { name: /가선수/ }).click();
  await until(() => seatOf('가선수') === 'T1-9');
  assert(seatOf('가선수') === 'T1-9', `배정 안 됨: ${seatOf('가선수')}`);
});

await step('빈자리 채우기(W): 대기 1명 → 미리보기 → 배정 → 전원 착석', async () => {
  await page.locator('button[data-seat="T1-9"]').click();
  await page.getByRole('button', { name: '비우기' }).first().click();
  await until(() => seatOf('가선수') === 'NONE');
  await page.keyboard.press('Escape');
  await page.keyboard.press('KeyW');
  const dlg = page.getByRole('dialog');
  await dlg.getByText('가선수').waitFor();
  await dlg.getByRole('button', { name: '1명 배정' }).click();
  await until(() => seatOf('가선수') !== 'NONE');
  assert(seatOf('가선수') !== 'NONE', '빈자리 채우기 안 됨');
});

await step('테이블 설정: T1 잠금 → DB lock_type=locked, 행에 "잠금" 표시', async () => {
  await page.getByRole('button', { name: 'T1 설정' }).click();
  await page.getByRole('dialog').getByRole('radio', { name: '잠금' }).click();
  const lock = () =>
    sql(`select lock_type from ops_tables where tournament_id='${tid}' and table_no=1`)[0];
  await until(() => lock() === 'locked');
  assert(lock() === 'locked', `잠금 안 됨: ${lock()}`);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'T1 설정' }).getByText('잠금').waitFor();
});

await step('테이블 추가(6석) → DB 3테이블 · 행 추가', async () => {
  await page.getByRole('button', { name: '테이블', exact: true }).click();
  const dlg = page.getByRole('dialog');
  await dlg.getByLabel('좌석 수(1~11)').fill('6');
  await dlg.getByRole('button', { name: '테이블 추가' }).click();
  await until(() => count(`select count(*) from ops_tables where tournament_id='${tid}'`) === 3);
  assert(count(`select count(*) from ops_tables where tournament_id='${tid}'`) === 3, '추가 안 됨');
  await page.getByRole('button', { name: 'T3 설정' }).waitFor();
});

await step('랜덤 재배치: 미리보기 → 확인창(Enter) → 잠금 T1 점유자는 그대로', async () => {
  const lockedBefore = sql(
    `select p.name from ops_seats s join ops_participants p on p.id=s.participant_id where s.tournament_id='${tid}' and s.table_no=1 order by 1`
  ).join(',');
  await page.getByRole('button', { name: '랜덤 재배치' }).click();
  const dlg = page.getByRole('dialog');
  await dlg.getByRole('button', { name: /명 배정$/ }).click();
  await page.waitForTimeout(250);
  await page.keyboard.press('Enter');
  await page.getByText(/재배치 완료/).waitFor();
  const lockedAfter = sql(
    `select p.name from ops_seats s join ops_participants p on p.id=s.participant_id where s.tournament_id='${tid}' and s.table_no=1 order by 1`
  ).join(',');
  assert(
    lockedBefore === lockedAfter,
    `잠금 테이블 점유자가 바뀜: ${lockedBefore} → ${lockedAfter}`
  );
  assert(seated() === 4, `착석 ${seated()}명(4명이어야 함)`);
});

await step('스크린샷 375/768/1280 × 다크/라이트', async () => {
  const prepare = async (p) => {
    await p.goto(`${BASE}/login`);
    await login(p, OWNER);
    await p.waitForURL(`${BASE}/tournaments`);
  };
  await screenshots(browser, `/tournaments/${tid}/tables`, 'w5-tables', { prepare });
});

asOwner(
  `SELECT public.ops_set_tournament_status('${tid}', '${OWNER_ID}', 'completed') \\g /dev/null`
);
archiveAsOwner(OWNER_ID, [tid]);
await browser.close();
finish();
