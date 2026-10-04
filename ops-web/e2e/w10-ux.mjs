/**
 * 운영 편의 — 칩 검산 · 이력 CSV · 지난 대회 설정 불러오기 · 전 상태 복제 · 플레이어뷰 변화 알림 (로컬 전용).
 * 테스트 전용 대회(테이블 2 · 참가자 3 · 10분 레벨 3개)를 앱과 같은 RPC 로 만들고, 끝나면 보관한다.
 * 실행: node e2e/w10-ux.mjs
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

const TOURNAMENT_NAME = `E2E 편의 ${Date.now()}`;
const [tid] =
  asOwner(`SELECT (public.ops_create_tournament('${OWNER_ID}', '${TOURNAMENT_NAME}', 'E2E 홀', current_date, 'NLH',
  NULL, 12000, 8,
  '{"buy_in_chips":12000,"rebuy_chips":10000,"addon_chips":5000,"buy_in_cost":70000,"fee_cost":0,"rebuy_cost":60000,"addon_cost":30000,"bounty_cost":null}'::jsonb)->>'tournament_id');`).filter(
    (l) => /^[0-9a-f-]{36}$/.test(l)
  );
assert(tid, '테스트 대회 생성 실패');
asOwner(`SELECT public.ops_add_table('${tid}', '${OWNER_ID}', 8, NULL, 'none', NULL) \\g /dev/null
SELECT public.ops_add_table('${tid}', '${OWNER_ID}', 8, NULL, 'none', NULL) \\g /dev/null
SELECT public.ops_set_tournament_status('${tid}', '${OWNER_ID}', 'active') \\g /dev/null
SELECT public.ops_set_blind_levels('${tid}', '${OWNER_ID}', '[{"level":1,"small_blind":100,"big_blind":200,"ante":0,"duration_sec":600,"is_break":false},{"level":2,"small_blind":200,"big_blind":400,"ante":400,"duration_sec":600,"is_break":false},{"level":3,"small_blind":0,"big_blind":0,"ante":0,"duration_sec":600,"is_break":true}]'::jsonb) \\g /dev/null
SELECT public.ops_register_participant('${tid}', '${OWNER_ID}', '가선수', 'KR', '01011112222', 70000) \\g /dev/null
SELECT public.ops_register_participant('${tid}', '${OWNER_ID}', '나선수', 'KR', NULL, 70000) \\g /dev/null
SELECT public.ops_register_participant('${tid}', '${OWNER_ID}', '다선수', 'KR', NULL, 70000) \\g /dev/null`);

const pidOf = (name) =>
  one(`select id from ops_participants where tournament_id='${tid}' and name='${name}'`);
const [viewToken] = asOwner(
  `SELECT public.ops_issue_player_credentials('${pidOf('가선수')}', '${OWNER_ID}')->>'viewToken';`
).filter((l) => l.length >= 32);
assert(viewToken, '플레이어 링크 발급 실패');

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 1280, height: 900 },
  acceptDownloads: true,
});
const page = await ctx.newPage();

await page.goto(`${BASE}/login?redirect=${encodeURIComponent(`/tournaments/${tid}/status`)}`);
await login(page, OWNER);
await page.waitForURL(`**/tournaments/${tid}/status`);

/** 칩 검산 줄의 글자(공백 정리). 조건이 맞을 때까지 최대 10초 기다린다 — 실시간 반영을 기다리는 용도. */
const auditText = async (ok) => {
  const audit = page.getByRole('region', { name: '칩 검산' });
  let text = '';
  for (let i = 0; i < 50; i += 1) {
    text = (await audit.innerText()).replace(/\s+/g, ' ');
    if (ok(text)) break;
    await page.waitForTimeout(200);
  }
  return text;
};

await step('칩 검산 — 등록 직후에는 발행 36,000 = 기록, "맞음"', async () => {
  const audit = page.getByRole('region', { name: '칩 검산' });
  await audit.waitFor();
  const text = (await audit.innerText()).replace(/\s+/g, ' ');
  assert(/발행 칩 36,000/.test(text), `발행 칩 표시: ${text}`);
  assert(/맞음/.test(text), `등록 직후 차이: ${text}`);
});

await step('칩 검산 — 탈락시키면 기록이 모자란 만큼 차이(−12,000)와 안내가 뜬다', async () => {
  asOwner(
    `SELECT public.ops_bust_participant('${pidOf('다선수')}', '${OWNER_ID}', NULL) \\g /dev/null`
  );
  const text = await auditText((t) => /기록 칩 24,000/.test(t));
  assert(/기록 칩 24,000/.test(text), `기록 칩 표시: ${text}`);
  assert(/차이 −12,000/.test(text), `차이 표시: ${text}`);
  assert(/칩 카운트를 다시 적으면/.test(text), `안내 문구: ${text}`);
  await page.screenshot({ path: path.join(SHOT_DIR, 'w10-chip-audit-1280.png') });
});

await step('칩 검산 — 받은 사람의 칩을 다시 적으면 "맞음"으로 돌아온다', async () => {
  asOwner(
    `SELECT public.ops_set_participant_chips('${pidOf('가선수')}', '${OWNER_ID}', 24000) \\g /dev/null`
  );
  const text = await auditText((t) => /기록 칩 36,000/.test(t));
  assert(/기록 칩 36,000/.test(text) && /맞음/.test(text), `다시 적은 뒤: ${text}`);
});

await step('이력 CSV — 머리줄·한글 라벨이 있고 참가자 이름·연락처는 없다', async () => {
  // 이름·연락처가 payload 에 실리는 이벤트를 만든다(참가자 정보 수정)
  asOwner(
    `SELECT public.ops_update_participant('${pidOf('나선수')}', '${OWNER_ID}', '나선수수정', 'KR', '01099998888') \\g /dev/null`
  );
  await page.goto(`${BASE}/tournaments/${tid}/history`);
  await page.getByText('참가자 정보 수정').first().waitFor();
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: '이력 CSV 내려받기' }).click(),
  ]);
  const file = path.join(SHOT_DIR, 'w10-history.csv');
  await download.saveAs(file);
  const csv = fs.readFileSync(file, 'utf8');
  assert(csv.startsWith('﻿시각,분류,내용,요약,기기'), `머리줄: ${csv.slice(0, 40)}`);
  assert(/참가자,탈락,/.test(csv), '탈락 행이 없다');
  assert(/참가자,참가자 정보 수정,/.test(csv), '정보 수정 행이 없다');
  assert(!/나선수|01099998888|01011112222/.test(csv), '이름·연락처가 CSV 에 실렸다');
  assert(/_이력_\d{8}\.csv$/.test(download.suggestedFilename()), download.suggestedFilename());
});

await step('대회 목록 — 진행 중 대회에도 복제 버튼이 있다', async () => {
  await page.goto(`${BASE}/tournaments`);
  await page
    .getByRole('button', { name: `${TOURNAMENT_NAME} 설정으로 새 대회 복제` })
    .waitFor({ timeout: 10_000 });
});

await step('새 대회 — 고르기만 해서는 안 바뀌고, "불러오기"를 눌러야 칸이 채워진다', async () => {
  await page.goto(`${BASE}/tournaments/new`);
  await page.getByLabel('대회 이름 *').fill('불러오기 확인');
  const select = page.getByLabel('대회', { exact: true });
  await select.waitFor();
  await select.selectOption(tid);
  assert(
    (await page.getByLabel('시작 칩').inputValue()) === '30000',
    '고르기만 했는데 값이 바뀌었다'
  );
  await page.getByRole('button', { name: '불러오기' }).click();
  assert((await page.getByLabel('시작 칩').inputValue()) === '12000', '시작 칩이 안 채워졌다');
  assert((await page.getByLabel('테이블당 좌석').inputValue()) === '8', '좌석 수가 안 채워졌다');
  assert((await page.getByLabel('장소').inputValue()) === 'E2E 홀', '장소가 안 채워졌다');
  assert(
    (await page.getByLabel('리바이 금액').inputValue()) === '60000',
    '리바이 금액이 안 채워졌다'
  );
  assert(
    (await page.getByLabel('대회 이름 *').inputValue()) === '불러오기 확인',
    '이름이 덮어써졌다'
  );
  await page.screenshot({ path: path.join(SHOT_DIR, 'w10-prefill-1280.png'), fullPage: true });
});

// ── 플레이어뷰(비로그인, 폰) ─────────────────────────────────────────────────
const phone = await browser.newContext({ viewport: { width: 375, height: 812 } });
await phone.addInitScript(() => {
  window.__osc = 0;
  window.__vib = 0;
  const Orig = window.AudioContext;
  if (Orig) {
    window.AudioContext = class extends Orig {
      createOscillator() {
        window.__osc += 1;
        return super.createOscillator();
      }
    };
  }
  navigator.vibrate = () => {
    window.__vib += 1;
    return true;
  };
});
const player = await phone.newPage();
await player.goto(`${BASE}/live/${viewToken}`);
await player.getByText('내 자리').waitFor();

const seatIdOf = (name) =>
  one(`select s.id from ops_seats s join ops_participants p on p.id=s.participant_id
       where p.tournament_id='${tid}' and p.name='${name}'`);
const emptySeat = () =>
  one(
    `select id from ops_seats where tournament_id='${tid}' and participant_id is null and table_no=2 order by seat_no limit 1`
  );

await step('플레이어뷰 — 처음 열었을 때는 알림이 없다', async () => {
  assert((await player.getByText('자리가 바뀌었어요').count()) === 0, '첫 화면에 자리 알림이 떴다');
  assert((await player.getByText('레벨 변경').count()) === 0, '첫 화면에 레벨 알림이 떴다');
});

await step('플레이어뷰 — 알림을 끈 기기는 자리 이동에 배너만 뜨고 소리·진동은 없다', async () => {
  asOwner(
    `SELECT public.ops_move_seat('${seatIdOf('가선수')}', '${emptySeat()}', '${OWNER_ID}') \\g /dev/null`
  );
  await player.getByText('자리가 바뀌었어요').waitFor({ timeout: 12_000 });
  const banner = (await player.getByRole('alert').innerText()).replace(/\s+/g, ' ');
  assert(/T2 · 1번/.test(banner), `새 자리 표시: ${banner}`);
  const counts = await player.evaluate(() => [window.__osc, window.__vib]);
  assert(counts[0] === 0 && counts[1] === 0, `꺼져 있는데 울렸다: ${counts}`);
  await player.screenshot({ path: path.join(SHOT_DIR, 'w10-player-seat-375.png'), fullPage: true });
  await player.getByRole('button', { name: '확인' }).click();
  assert((await player.getByText('자리가 바뀌었어요').count()) === 0, '확인 뒤에도 배너가 남았다');
});

await step('플레이어뷰 — 알림을 켜면 레벨 전환에 배너 + 소리 + 진동', async () => {
  await player.getByRole('button', { name: '꺼짐' }).click();
  await player.getByRole('button', { name: '켜짐' }).waitFor();
  const before = await player.evaluate(() => [window.__osc, window.__vib]);
  assert(before[0] > 0 && before[1] === 1, `켤 때 확인음·진동: ${before}`);
  asOwner(`SELECT public.ops_clock_set_level('${tid}', '${OWNER_ID}', 2) \\g /dev/null`);
  await player.getByText('레벨 변경').waitFor({ timeout: 12_000 });
  const text = (
    await player
      .getByText(/LEVEL 2 · 200 \/ 400/)
      .first()
      .innerText()
  ).trim();
  assert(/\(400\)/.test(text), `앤티 표시: ${text}`);
  const after = await player.evaluate(() => [window.__osc, window.__vib]);
  assert(after[0] > before[0] && after[1] === 2, `레벨 전환 알림음·진동: ${before} → ${after}`);
  await player.screenshot({
    path: path.join(SHOT_DIR, 'w10-player-level-375.png'),
    fullPage: true,
  });
});

await step('플레이어뷰 — 휴식으로 넘어가면 휴식 알림', async () => {
  asOwner(`SELECT public.ops_clock_set_level('${tid}', '${OWNER_ID}', 3) \\g /dev/null`);
  await player.getByText('휴식 시간이 시작됐어요').waitFor({ timeout: 12_000 });
});

await browser.close();
// 진행 중 대회는 보관할 수 없다 — 종료한 뒤 보관한다.
asOwner(
  `SELECT public.ops_set_tournament_status('${tid}', '${OWNER_ID}', 'completed') \\g /dev/null`
);
archiveAsOwner(OWNER_ID, [tid]);
finish();
