/**
 * W5(블라인드·프리셋) + W6(상금·스태프·이력) 콘솔 — 로컬 전용.
 * 테스트 전용 대회를 앱과 같은 RPC 로 만들고(참가자 3·테이블 1·공고 연결), 끝나면 보관한다.
 * 실행: node e2e/w56-console.mjs
 */
import {
  BASE,
  OWNER,
  OWNER_ID,
  SEED_POSTING_ID,
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

/** owner JWT 로 RPC 를 부르는 SQL 블록. */
const asOwner = (body) =>
  sql(`BEGIN;
SELECT set_config('request.jwt.claims', '{"sub":"${OWNER_ID}","role":"authenticated"}', true) \\g /dev/null
SET LOCAL ROLE authenticated;
${body}
COMMIT;`);

const name = `E2E W56 ${Date.now()}`;
const [tid] =
  asOwner(`SELECT (public.ops_create_tournament('${OWNER_ID}', '${name}', 'E2E', current_date, 'NLH',
  '${SEED_POSTING_ID}', 10000, 9,
  '{"buy_in_chips":10000,"rebuy_chips":10000,"addon_chips":5000,"buy_in_cost":100000,"fee_cost":0,"rebuy_cost":100000,"addon_cost":50000,"bounty_cost":null}'::jsonb)->>'tournament_id');`).filter(
    (l) => /^[0-9a-f-]{36}$/.test(l)
  );
assert(tid, '테스트 대회 생성 실패');
asOwner(`SELECT public.ops_add_table('${tid}', '${OWNER_ID}', 9, NULL, 'none', 0) \\g /dev/null
SELECT public.ops_set_blind_levels('${tid}', '${OWNER_ID}', '[{"level":1,"small_blind":100,"big_blind":200,"ante":0,"duration_sec":600,"is_break":false}]'::jsonb) \\g /dev/null
SELECT public.ops_set_tournament_status('${tid}', '${OWNER_ID}', 'active') \\g /dev/null
SELECT public.ops_register_participant('${tid}', '${OWNER_ID}', '가선수', 'KR', NULL, 100000) \\g /dev/null
SELECT public.ops_register_participant('${tid}', '${OWNER_ID}', '나선수', 'KR', NULL, 100000) \\g /dev/null
SELECT public.ops_register_participant('${tid}', '${OWNER_ID}', '다선수', 'KR', NULL, 100000) \\g /dev/null`);

const url = (tab) => `${BASE}/tournaments/${tid}/${tab}`;
const DEALER_ID = '0a5e0000-0000-4000-8000-000000000003';
const WORK_LOG_ID = '0a5e0000-0000-4000-8000-0000000000c1';
/** DB 반영 대기(최대 4초). */
const until = async (ok) => {
  for (let i = 0; i < 20 && !ok(); i += 1) await page.waitForTimeout(200);
};
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
await page.goto(`${BASE}/login?redirect=${encodeURIComponent(`/tournaments/${tid}/levels`)}`);
await login(page, OWNER);
await page.waitForURL(url('levels'));
const count = (q) => Number(sql(q)[0]);

process.stdout.write('W5·W6 콘솔\n');

await step('블라인드: 레벨 추가 → 칸 편집 → 저장(진행 중이면 재계산 확인) → DB 2레벨', async () => {
  await page.getByRole('button', { name: /레벨$/ }).click();
  await page.getByLabel('2번 SB').fill('200');
  await page.getByLabel('2번 BB').fill('400');
  await page.getByText('저장되지 않은 변경이 있습니다.').waitFor();
  await page.getByRole('button', { name: '구조 저장' }).click();
  // 클럭이 돌고 있지 않으면 확인창 없이 저장된다 — 둘 다 허용
  const dialog = page.getByRole('dialog');
  if (await dialog.isVisible().catch(() => false)) {
    await page.waitForTimeout(200);
    await page.keyboard.press('Enter');
  }
  for (
    let i = 0;
    i < 20 && count(`select count(*) from ops_blind_levels where tournament_id='${tid}'`) !== 2;
    i += 1
  ) {
    await page.waitForTimeout(200);
  }
  assert(
    count(`select count(*) from ops_blind_levels where tournament_id='${tid}'`) === 2,
    '저장 안 됨'
  );
  const bb = sql(
    `select big_blind from ops_blind_levels where tournament_id='${tid}' and sort=2`
  )[0];
  assert(bb === '400', `BB=${bb}`);
});

await step('블라인드 프리셋: 기본 30레벨 적용(교체 확인) → 저장 → DB 30레벨', async () => {
  await page.getByRole('button', { name: /^프리셋/ }).click();
  await page.getByRole('button', { name: /기본 30레벨/ }).click();
  await page.waitForTimeout(200);
  await page.keyboard.press('Enter'); // 교체 확인
  await page.getByRole('button', { name: /프리셋 · 기본 30레벨/ }).waitFor();
  await page.getByRole('button', { name: '구조 저장' }).click();
  const dialog = page.getByRole('dialog');
  if (await dialog.isVisible().catch(() => false)) {
    await page.waitForTimeout(200);
    await page.keyboard.press('Enter');
  }
  for (
    let i = 0;
    i < 20 && count(`select count(*) from ops_blind_levels where tournament_id='${tid}'`) !== 30;
    i += 1
  ) {
    await page.waitForTimeout(200);
  }
  assert(
    count(`select count(*) from ops_blind_levels where tournament_id='${tid}'`) === 30,
    '프리셋 저장 안 됨'
  );
});

await step('상금 구조: 금액 3순위 입력 → 저장(진행 중 소급 확인) → DB 3행', async () => {
  await page.goto(url('payouts'));
  for (let i = 0; i < 3; i += 1) await page.getByRole('button', { name: '순위 추가' }).click();
  await page.getByLabel('1위 금액').fill('150,000');
  await page.getByLabel('2위 금액').fill('100,000');
  await page.getByLabel('3위 금액').fill('50,000');
  await page.getByRole('button', { name: '상금 구조 저장' }).click();
  await page.getByRole('dialog').getByText('소급되지 않아요').waitFor();
  await page.waitForTimeout(200);
  await page.keyboard.press('Enter');
  for (
    let i = 0;
    i < 20 && count(`select count(*) from ops_prizes where tournament_id='${tid}'`) !== 3;
    i += 1
  ) {
    await page.waitForTimeout(200);
  }
  assert(
    count(`select count(*) from ops_prizes where tournament_id='${tid}'`) === 3,
    '상금 구조 저장 안 됨'
  );
});

await step('탈락(3위 상금) → 대장에 실지급 → 지급 완료 토글 → 정정', async () => {
  await page.goto(url('players'));
  await page.getByRole('button', { name: '다선수' }).click();
  await page.keyboard.press('KeyX');
  await page.getByRole('dialog').getByText('예상 순위').waitFor();
  const text = await page.getByRole('dialog').textContent();
  assert(text.includes('3위') && text.includes('50,000'), `확인창 예측 틀림: ${text}`);
  await page.waitForTimeout(200);
  await page.keyboard.press('Enter');
  for (
    let i = 0;
    i < 20 &&
    sql(`select status from ops_participants where tournament_id='${tid}' and name='다선수'`)[0] !==
      'busted';
    i += 1
  ) {
    await page.waitForTimeout(200);
  }
  const [fp, prize] = sql(
    `select finish_position||'|'||prize_amount from ops_participants where tournament_id='${tid}' and name='다선수'`
  )[0].split('|');
  assert(fp === '3' && prize === '50000', `서버 결과 ${fp}위 ${prize}`);
  await page.goto(url('payouts'));
  await page.getByRole('checkbox', { name: '3위 지급 완료' }).click();
  for (
    let i = 0;
    i < 20 &&
    sql(
      `select prize_paid_at is not null from ops_participants where tournament_id='${tid}' and name='다선수'`
    )[0] !== 't';
    i += 1
  ) {
    await page.waitForTimeout(200);
  }
  assert(
    sql(
      `select prize_paid_at is not null from ops_participants where tournament_id='${tid}' and name='다선수'`
    )[0] === 't',
    '지급 표시 안 됨'
  );
  await page.getByRole('button', { name: '다선수' }).click();
  const dlg = page.getByRole('dialog');
  await dlg.getByLabel('새 금액').fill('60000');
  await dlg.getByRole('button', { name: '저장' }).click();
  for (
    let i = 0;
    i < 20 &&
    sql(
      `select prize_amount from ops_participants where tournament_id='${tid}' and name='다선수'`
    )[0] !== '60000';
    i += 1
  ) {
    await page.waitForTimeout(200);
  }
  assert(
    sql(
      `select prize_amount from ops_participants where tournament_id='${tid}' and name='다선수'`
    )[0] === '60000',
    '정정 안 됨'
  );
});

await step(
  '스태프(수동): 공고 연결 표시 · 닉네임 검색 추가(딜러) · 근태 사유 안내 · 테이블 지정(목록 대화상자) · 삭제',
  async () => {
    await page.goto(url('staff'));
    await page.getByText('시드 · 금요 토너먼트 딜러 모집').first().waitFor();
    // 회귀(리뷰 W6 HIGH): 닫힌 select 에서 화살표를 눌러도 공고 연결이 바뀌면 안 된다
    const postingSelect = page.getByLabel('바꿀 공고 선택');
    await postingSelect.focus();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await page.waitForTimeout(600);
    assert(
      sql(`select job_posting_id from ops_tournaments where id='${tid}'`)[0] === SEED_POSTING_ID,
      '화살표 키로 공고 연결이 바뀜'
    );

    await page.getByRole('button', { name: '스태프 추가' }).click();
    const dlg = page.getByRole('dialog');
    await dlg.getByLabel('닉네임 검색').fill('ops-dealer');
    await dlg.getByRole('button', { name: '검색' }).click();
    await dlg.getByRole('button', { name: /ops-dealer/ }).click();
    await dlg.getByRole('radio', { name: '딜러' }).click();
    await dlg.getByRole('button', { name: /추가$/ }).click();
    await until(() => count(`select count(*) from ops_staff where tournament_id='${tid}'`) === 1);
    assert(
      count(`select count(*) from ops_staff where tournament_id='${tid}'`) === 1,
      '스태프 추가 안 됨'
    );
    await page.getByRole('button', { name: '근태' }).click();
    // 수동 추가 스태프는 공고 근무 기록과 연결되지 않는다 — 모바일과 같은 사유 안내, 기록 버튼 없음
    await page
      .getByRole('dialog')
      .getByText(/근무 기록이 없습니다|연결되지 않습니다/)
      .waitFor();
    assert(
      (await page.getByRole('button', { name: /지금 출근/ }).count()) === 0,
      '기록 버튼이 열림'
    );
    await page.keyboard.press('Escape');

    await page.getByRole('button', { name: /테이블 지정/ }).click();
    await page.getByRole('dialog').getByRole('button', { name: /^T\d/ }).first().click();
    const assigned = () =>
      count(
        `select count(*) from ops_tables where tournament_id='${tid}' and assigned_staff_id is not null`
      );
    await until(() => assigned() === 1);
    assert(assigned() === 1, '테이블 지정 안 됨');
    await page.getByRole('button', { name: '삭제' }).click();
    await page.waitForTimeout(200);
    await page.keyboard.press('Enter');
    await until(() => count(`select count(*) from ops_staff where tournament_id='${tid}'`) === 0);
    assert(
      count(`select count(*) from ops_staff where tournament_id='${tid}'`) === 0,
      '삭제 안 됨'
    );
    assert(assigned() === 0, '배정이 함께 해제되지 않음');
  }
);

await step(
  '스태프(확정): 공고 근무 기록 가져오기 → 근태 출근 기록 → 기록 취소 (ok 경로)',
  async () => {
    // 픽스처: ops-dealer 의 이 공고·대회일(current_date) 근무 기록 1건
    sql(`INSERT INTO public.work_logs (id, staff_id, job_posting_id, date, status, role, staff_name, staff_nickname)
VALUES ('${WORK_LOG_ID}', '${DEALER_ID}', '${SEED_POSTING_ID}', current_date::text, 'scheduled', 'dealer', '옵스딜러', 'ops-dealer')
ON CONFLICT (id) DO UPDATE SET date = EXCLUDED.date, status = 'scheduled', check_in_ts = NULL, check_out_ts = NULL \\g /dev/null`);
    await page.reload();
    await page.getByRole('button', { name: '확정 스태프 가져오기' }).click();
    await page.waitForTimeout(200);
    await page.keyboard.press('Enter');
    await until(() => count(`select count(*) from ops_staff where tournament_id='${tid}'`) === 1);
    assert(
      count(`select count(*) from ops_staff where tournament_id='${tid}'`) === 1,
      '확정 스태프 가져오기 안 됨'
    );
    const checkIn = () =>
      sql(`select coalesce(check_in_ts::text,'NULL') from work_logs where id='${WORK_LOG_ID}'`)[0];

    await page.getByRole('button', { name: '근태' }).click();
    await page.getByRole('dialog').getByRole('button', { name: '지금 출근' }).click();
    await page.waitForTimeout(200);
    await page.keyboard.press('Enter');
    await until(() => checkIn() !== 'NULL');
    assert(checkIn() !== 'NULL', '출근 시각이 기록되지 않음');

    await page
      .getByRole('dialog')
      .getByRole('button', { name: '출근 기록 취소' })
      .click({ timeout: 10_000 });
    await page.waitForTimeout(200);
    await page.keyboard.press('Enter');
    await until(() => checkIn() === 'NULL');
    assert(checkIn() === 'NULL', '출근 기록 취소가 반영되지 않음');
    await page.keyboard.press('Escape');
  }
);

await step('이력: 한글 라벨로 방금 동작이 보인다', async () => {
  await page.goto(url('history'));
  for (const label of ['탈락', '상금 구조 설정', '스태프 추가', '상금 지급 완료']) {
    await page.getByText(label, { exact: true }).first().waitFor();
  }
});

await step('스크린샷 375/768/1280 × 다크/라이트 (블라인드·상금·스태프·이력)', async () => {
  const prepare = async (p) => {
    await p.goto(`${BASE}/login`);
    await login(p, OWNER);
    await p.waitForURL(`${BASE}/tournaments`);
  };
  for (const tab of ['levels', 'payouts', 'staff', 'history']) {
    await screenshots(browser, `/tournaments/${tid}/${tab}`, `w56-${tab}`, { prepare });
  }
});

// 정리 — 진행 중 대회는 보관할 수 없어 먼저 종료한다(서버 규칙).
asOwner(
  `SELECT public.ops_set_tournament_status('${tid}', '${OWNER_ID}', 'completed') \\g /dev/null`
);
archiveAsOwner(OWNER_ID, [tid]);
sql(`DELETE FROM public.work_logs WHERE id='${WORK_LOG_ID}' \\g /dev/null`);
await browser.close();
finish();
