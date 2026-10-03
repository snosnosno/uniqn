/**
 * 자동화 — 레벨 자동 전환 · 레이트 등록 자동 마감 · 명단 일괄 등록 · 이력 기기 이름 (로컬 전용).
 * 테스트 전용 대회(테이블 2 · 10분 레벨 4개[레벨1 · 휴식 · 레벨2 · 레벨3])를 앱과 같은 RPC 로 만들고, 끝나면 종료·보관한다.
 * "시간이 흐른 상태"는 ops_clock.level_started_at 을 과거로 옮겨 만든다(10분을 실제로 기다리지 않는다).
 * 실행: node e2e/w11-auto.mjs
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
const one = (q) => sql(q)[0];

const TOURNAMENT_NAME = `E2E 자동 ${Date.now()}`;
const [tid] =
  asOwner(`SELECT (public.ops_create_tournament('${OWNER_ID}', '${TOURNAMENT_NAME}', 'E2E 홀', current_date, 'NLH',
  NULL, 10000, 9,
  '{"buy_in_chips":10000,"rebuy_chips":10000,"addon_chips":5000,"buy_in_cost":50000,"fee_cost":0,"rebuy_cost":50000,"addon_cost":30000,"bounty_cost":null}'::jsonb)->>'tournament_id');`).filter(
    (l) => /^[0-9a-f-]{36}$/.test(l)
  );
assert(tid, '테스트 대회 생성 실패');
asOwner(`SELECT public.ops_add_table('${tid}', '${OWNER_ID}', 9, NULL, 'none', NULL) \\g /dev/null
SELECT public.ops_add_table('${tid}', '${OWNER_ID}', 9, NULL, 'none', NULL) \\g /dev/null
SELECT public.ops_set_tournament_status('${tid}', '${OWNER_ID}', 'active') \\g /dev/null
SELECT public.ops_set_blind_levels('${tid}', '${OWNER_ID}', '[{"level":1,"small_blind":100,"big_blind":200,"ante":0,"duration_sec":600,"is_break":false},{"level":1,"small_blind":0,"big_blind":0,"ante":0,"duration_sec":600,"is_break":true},{"level":2,"small_blind":200,"big_blind":400,"ante":400,"duration_sec":600,"is_break":false},{"level":3,"small_blind":300,"big_blind":600,"ante":600,"duration_sec":600,"is_break":false}]'::jsonb) \\g /dev/null
SELECT public.ops_register_participant('${tid}', '${OWNER_ID}', '가선수', 'KR', NULL, 50000) \\g /dev/null
SELECT public.ops_clock_start('${tid}', '${OWNER_ID}') \\g /dev/null`);

/** 시계를 "sort 레벨이 sec 초 전에 시작된 상태"로 옮긴다 — 시간 경과 모사(로컬 DB 에 직접). */
const rewind = (sort, sec) =>
  sql(`UPDATE public.ops_clock SET current_level_sort = ${sort}, is_running = true, paused_remaining_sec = NULL,
       level_started_at = now() - interval '${sec} seconds' WHERE tournament_id = '${tid}';`);
const clockSort = () =>
  Number(one(`select current_level_sort from ops_clock where tournament_id='${tid}'`));
const tournamentRow = () =>
  one(
    `select registration_open::text || '|' || coalesce(registration_close_after_sort::text, 'NULL') from ops_tournaments where id='${tid}'`
  );
const participantCount = () =>
  Number(one(`select count(*) from ops_participants where tournament_id='${tid}'`));
const lastEvent = (type) =>
  one(`select coalesce(actor_device, 'NULL') || '|' || payload::text from ops_events
       where tournament_id='${tid}' and type='${type}' order by seq desc limit 1`);
const waitFor = async (ok, label, ms = 15_000) => {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    if (await ok()) return;
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`시간 초과: ${label}`);
};

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 1280, height: 900 },
  acceptDownloads: true,
});
const page = await ctx.newPage();

await page.goto(`${BASE}/login?redirect=${encodeURIComponent(`/tournaments/${tid}/status`)}`);
await login(page, OWNER);
await page.waitForURL(`**/tournaments/${tid}/status`);
const cutoffSelect = page.getByLabel('자동 마감', { exact: true });
await cutoffSelect.waitFor();
// 실시간 구독이 붙은 뒤에 시작한다 — 그 전에 DB 를 바꾸면 화면이 변경을 받지 못한다.
await page.getByText('실시간 연결').first().waitFor({ timeout: 15_000 });

await step('자동 마감 설정 — 고르기만 해서는 저장되지 않고, "적용"을 눌러야 저장된다', async () => {
  await cutoffSelect.selectOption({ label: '레벨 1 종료 시' });
  assert(tournamentRow() === 'true|NULL', `고르기만 했는데 저장됨: ${tournamentRow()}`);
  await page.getByRole('button', { name: '자동 마감 적용' }).click();
  await waitFor(() => tournamentRow() === 'true|1', '설정 저장');
  await page.getByText('레벨 1 종료 후 다음으로 넘어가면').waitFor({ timeout: 5_000 });
  const event = lastEvent('registration_toggled');
  assert(/"action": "cutoff_set"/.test(event), `설정 이벤트: ${event}`);
  // 이름을 정하지 않은 기기는 브라우저·OS 로 기록된다
  assert(/^Chrome · /.test(event), `기본 기기 이름: ${event}`);
});

await step('마지막 순번(레벨 3)은 고를 수 없다 — 넘어갈 레벨이 없어 발동하지 않는다', async () => {
  const labels = await cutoffSelect.locator('option').allInnerTexts();
  assert(labels.includes('레벨 2 종료 시'), `옵션: ${labels}`);
  assert(labels.includes('레벨 1 뒤 휴식 종료 시'), `옵션: ${labels}`);
  assert(!labels.includes('레벨 3 종료 시'), `마지막 레벨이 옵션에 있다: ${labels}`);
});

await step('레벨 시간이 0 이 되면 콘솔이 다음 레벨(휴식)로 자동으로 넘긴다', async () => {
  rewind(1, 596); // 4초 남음
  await waitFor(() => clockSort() === 2, '자동 전환(1 → 2)');
  await page.getByText('휴식', { exact: true }).first().waitFor({ timeout: 10_000 });
  const event = lastEvent('level_set');
  assert(/"action": "auto_advance"/.test(event), `자동 전환 이벤트: ${event}`);
  // 앵커 보존 — 넘어간 직후 휴식은 거의 10분이 남아 있어야 한다(늦게 넘어가도 시계가 밀리지 않는다)
  const elapsed = Number(
    one(
      `select extract(epoch from (now() - level_started_at))::int from ops_clock where tournament_id='${tid}'`
    )
  );
  assert(elapsed >= 0 && elapsed < 15, `휴식 경과 초: ${elapsed}`);
});

await step('기준 레벨이 끝나 넘어가는 순간 등록이 자동으로 닫히고 화면에 표시된다', async () => {
  await waitFor(() => tournamentRow() === 'false|1', '자동 마감');
  await page.getByText('레벨 1 종료로 등록이 자동 마감됐어요').waitFor({ timeout: 10_000 });
  await page.getByRole('button', { name: '등록 열기' }).waitFor();
  const event = lastEvent('registration_toggled');
  assert(/"auto": true/.test(event), `자동 마감 이벤트: ${event}`);
  await page.screenshot({ path: path.join(SHOT_DIR, 'w11-cutoff-closed-1280.png') });
});

await step('수동으로 다시 열면 자동 마감 설정이 해제된다', async () => {
  await page.getByRole('button', { name: '등록 열기' }).click();
  await waitFor(() => tournamentRow() === 'true|NULL', '수동 개방 + 설정 해제');
  await waitFor(async () => (await cutoffSelect.inputValue()) === '', '선택값이 "사용 안 함"으로');
});

await step('운영자가 "다음"으로 넘겨도 기준을 넘으면 마감된다', async () => {
  await cutoffSelect.selectOption({ label: '레벨 1 뒤 휴식 종료 시' });
  await page.getByRole('button', { name: '자동 마감 적용' }).click();
  await waitFor(() => tournamentRow() === 'true|2', '설정 저장(휴식)');
  await page.getByRole('button', { name: '다음' }).click();
  await waitFor(() => clockSort() === 3 && tournamentRow() === 'false|2', '수동 전환 + 마감');
  // 다음 단계(일괄 등록)를 위해 다시 연다
  await page.getByRole('button', { name: '등록 열기' }).click();
  await waitFor(() => tournamentRow() === 'true|NULL', '재개방');
});

// ── 명단 일괄 등록 ───────────────────────────────────────────────────────────
await page.goto(`${BASE}/tournaments/${tid}/players`);
await page.getByRole('button', { name: /명단/ }).waitFor();

await step('명단 붙여넣기 — 오류 줄이 있으면 등록 버튼이 막힌다', async () => {
  await page.keyboard.press('b');
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('명단').fill(`나선수\n${'가'.repeat(51)}`);
  await dialog.getByText('오류 1줄').waitFor();
  const submit = dialog.getByRole('button', { name: /명 등록$/ });
  assert(await submit.isDisabled(), '오류가 있는데 등록 버튼이 열려 있다');
});

await step('명단 붙여넣기 — 번호·연락처를 가르고 중복을 표시한 뒤 한 번에 등록', async () => {
  const dialog = page.getByRole('dialog');
  await dialog
    .getByLabel('명단')
    .fill('1. 나선수\n2. 다선수 010-2222-3333\n라선수\t01044445555\n가선수');
  await dialog.getByText('이미 등록된 이름이에요').waitFor();
  await page.screenshot({ path: path.join(SHOT_DIR, 'w11-bulk-preview-1280.png') });
  const before = participantCount();
  await dialog.getByRole('button', { name: '4명 등록' }).click();
  await waitFor(() => participantCount() === before + 4, '4명 등록');
  await page.getByRole('dialog').waitFor({ state: 'hidden' });
  const rows = sql(
    `select entry_number || ':' || name || ':' || coalesce(phone, '') from ops_participants where tournament_id='${tid}' order by entry_number`
  );
  assert(
    rows.join(',') === '1:가선수:,2:나선수:,3:다선수:010-2222-3333,4:라선수:01044445555,5:가선수:',
    `등록 결과: ${rows.join(',')}`
  );
  await page.getByText('라선수').first().waitFor({ timeout: 10_000 });
});

// ── 이력 기기 이름 ───────────────────────────────────────────────────────────
await step('이 기기 이름을 정하면 이후 조작이 그 이름으로 이력에 남는다', async () => {
  await page.goto(`${BASE}/tournaments/${tid}/history`);
  await page.getByRole('button', { name: /이 기기 이름/ }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('이름').fill('등록데스크 1');
  await dialog.getByRole('button', { name: '저장' }).click();
  await page.getByRole('button', { name: '이 기기 이름: 등록데스크 1 — 바꾸기' }).waitFor();

  await page.goto(`${BASE}/tournaments/${tid}/status`);
  await page.getByRole('button', { name: '등록 마감하기' }).click();
  await waitFor(() => /^등록데스크 1\|/.test(lastEvent('registration_toggled')), '기기 이름 기록');

  await page.goto(`${BASE}/tournaments/${tid}/history`);
  await page.getByText('등록데스크 1').first().waitFor({ timeout: 10_000 });
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: '이력 CSV 내려받기' }).click(),
  ]);
  const file = path.join(SHOT_DIR, 'w11-history.csv');
  await download.saveAs(file);
  const csv = fs.readFileSync(file, 'utf8');
  assert(/등록 전환,[^\r\n]*,등록데스크 1\r\n/.test(csv), 'CSV 기기 열에 이름이 없다');
  assert(!/나선수|01044445555/.test(csv), 'CSV 에 이름·연락처가 실렸다');
  await page.screenshot({ path: path.join(SHOT_DIR, 'w11-history-device-1280.png') });
});

// ── 콘솔이 꺼져 있어도 전광판이 시계를 넘긴다 ────────────────────────────────
await step('콘솔을 닫아도 전광판 폴링이 끝난 레벨을 넘긴다', async () => {
  const [token] = asOwner(
    `SELECT public.ops_rotate_monitor_token('${tid}', '${OWNER_ID}')->>'monitorToken';`
  ).filter((l) => l.length >= 32);
  assert(token, '모니터 링크 발급 실패');
  await ctx.close();
  rewind(3, 640); // 레벨 2(sort 3)가 40초 전에 끝난 상태 — 아무 화면도 없으니 그대로 멈춰 있다
  const tv = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const monitor = await tv.newPage();
  await monitor.goto(`${BASE}/monitor/${token}`);
  await waitFor(() => clockSort() === 4, '전광판이 일으킨 자동 전환(3 → 4)');
  await monitor.getByText('LEVEL 3').first().waitFor({ timeout: 12_000 });
  await monitor.screenshot({ path: path.join(SHOT_DIR, 'w11-monitor-advanced-1280.png') });
  await tv.close();
});

await browser.close();
// 진행 중 대회는 보관할 수 없다 — 종료한 뒤 보관한다.
asOwner(
  `SELECT public.ops_set_tournament_status('${tid}', '${OWNER_ID}', 'completed') \\g /dev/null`
);
archiveAsOwner(OWNER_ID, [tid]);
finish();
