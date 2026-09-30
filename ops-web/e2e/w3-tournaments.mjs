/**
 * W3 목록·생성 완료 기준(설계 §9) — 로컬 전용.
 *   로컬 DB 에서 생성 → 모바일 목록(같은 RLS 조회)에 같은 대회 · 복제 · 보관/복원 · 공고 연결·필터
 * 실행: node e2e/w3-tournaments.mjs (전제는 e2e/lib.mjs 참고)
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
  listAsMobile,
  login,
  prepareLocal,
  screenshots,
  sql,
  step,
} from './lib.mjs';

prepareLocal();
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
const uniqueName = `E2E 대회 ${Date.now()}`;
let createdId = null;
const createdIds = [];

process.stdout.write('W3 목록·생성\n');

await page.goto(`${BASE}/login`);
await login(page, OWNER);
await page.waitForURL(`${BASE}/tournaments`);

await step('목록: 시드 대회 표시 · 보관분 숨김 · 이어서 운영 = 진행 중 대회', async () => {
  await page.getByRole('link', { name: '시드 · 지난주 토너먼트' }).first().waitFor();
  assert(
    (await page.getByRole('link', { name: '시드 · 보관된 테스트' }).count()) === 0,
    '보관 대회가 보입니다'
  );
  const resume = page.getByRole('link', { name: /이어서 운영/ });
  await resume.waitFor();
  assert((await resume.textContent()).includes('시드 · 수요 딥스택'), '재개 대상이 다릅니다');
  await page.getByRole('button', { name: /보관함 \(\d+\)/ }).waitFor();
});

await step('N 단축키 → 새 대회 화면', async () => {
  await page.keyboard.press('KeyN');
  await page.waitForURL(`${BASE}/tournaments/new`);
});

await step('이름 없이 제출 → 서버 호출 없이 필드 오류 + 포커스', async () => {
  await page.getByRole('button', { name: '대회 만들기' }).click();
  const nameInput = page.getByLabel('대회 이름 *');
  await page.waitForFunction(() => document.activeElement?.id === 'name');
  assert((await nameInput.getAttribute('aria-invalid')) === 'true', 'aria-invalid 누락');
});

await step('생성(공고 연결) → 콘솔 이동 · DB·기본 블라인드·계측', async () => {
  await page.getByLabel('대회 이름 *').fill(uniqueName);
  await page.getByLabel('장소').fill('E2E 홀덤펍');
  await page.getByLabel('공고').selectOption(SEED_POSTING_ID);
  await page.getByRole('button', { name: '대회 만들기' }).click();
  await page.waitForURL(/\/tournaments\/[0-9a-f-]{36}$/);
  createdId = page.url().split('/').pop();
  createdIds.push(createdId);
  const [row] = sql(
    `select name||'|'||coalesce(job_posting_id::text,'')||'|'||venue||'|'||starting_chips from ops_tournaments where id='${createdId}'`
  );
  assert(row === `${uniqueName}|${SEED_POSTING_ID}|E2E 홀덤펍|30000`, `DB 행: ${row}`);
  // 기본 블라인드 시드는 생성 성공 뒤 이어서 호출된다 — 잠깐 기다린다.
  let levels = 0;
  for (let i = 0; i < 20 && levels === 0; i += 1) {
    levels = Number(
      sql(`select count(*) from ops_blind_levels where tournament_id='${createdId}'`)[0]
    );
    if (levels === 0) await page.waitForTimeout(250);
  }
  assert(levels >= 20, `기본 블라인드 레벨 수: ${levels}`);
  const created = sql(
    `select count(*) from analytics_events where event='ops_tournament_created' and user_id='${OWNER_ID}' and created_at > now() - interval '1 minute'`
  )[0];
  assert(Number(created) >= 1, 'ops_tournament_created 계측 없음');
});

await step('모바일과 같은 조회(RLS·owner)에 웹에서 만든 대회가 보인다', async () => {
  const rows = listAsMobile(OWNER_ID);
  assert(
    rows.some((r) => r.startsWith(`${createdId}|${uniqueName}|${SEED_POSTING_ID}|`)),
    '모바일 목록 조회에 없음'
  );
});

await step('?postingId= 필터 → 그 공고 대회만, 정리 액션 숨김', async () => {
  await page.goto(`${BASE}/tournaments?postingId=${SEED_POSTING_ID}`);
  await page.getByRole('link', { name: uniqueName }).waitFor();
  assert(
    (await page.getByRole('link', { name: '시드 · 지난주 토너먼트' }).count()) === 0,
    '다른 대회가 보입니다'
  );
  assert((await page.getByRole('button', { name: /보관$/ }).count()) === 0, '정리 액션 노출');
});

await step('보관(확인창 Enter) → 목록에서 사라짐 → 보관함에서 복원', async () => {
  await page.goto(`${BASE}/tournaments`);
  await page.getByRole('button', { name: `${uniqueName} 보관` }).click();
  await page.getByRole('dialog').getByText(uniqueName).waitFor();
  await page.waitForTimeout(200); // 확인창 150ms 무장(오조작 가드)
  await page.keyboard.press('Enter');
  await page.getByRole('link', { name: uniqueName }).waitFor({ state: 'detached' });
  assert(
    sql(`select archived_at is not null from ops_tournaments where id='${createdId}'`)[0] === 't',
    'DB 에 보관 안 됨'
  );
  await page.getByRole('button', { name: /보관함 \(\d+\)/ }).click();
  await page.getByRole('button', { name: `${uniqueName} 복원` }).click();
  await page.getByRole('link', { name: uniqueName }).waitFor({ state: 'detached' });
  await page.getByRole('button', { name: '활성 대회 보기' }).click();
  await page.getByRole('link', { name: uniqueName }).waitFor();
  assert(
    sql(`select archived_at is null from ops_tournaments where id='${createdId}'`)[0] === 't',
    'DB 에 복원 안 됨'
  );
});

await step('완료 대회 복제(확인창에 오늘 날짜) → 새 대회로 이동', async () => {
  const before = Number(
    sql(
      `select count(*) from ops_tournaments where owner_id='${OWNER_ID}' and starting_chips=25000`
    )[0]
  );
  await page.goto(`${BASE}/tournaments`);
  await page.getByRole('button', { name: '시드 · 지난주 토너먼트 설정으로 새 대회 복제' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByText(/\d{4}-\d{2}-\d{2}/).waitFor();
  await page.waitForTimeout(200);
  await page.keyboard.press('Enter');
  await page.waitForURL(/\/tournaments\/[0-9a-f-]{36}$/);
  createdIds.push(page.url().split('/').pop());
  const after = Number(
    sql(
      `select count(*) from ops_tournaments where owner_id='${OWNER_ID}' and starting_chips=25000`
    )[0]
  );
  assert(after === before + 1, `복제 수 ${before} → ${after}`);
});

await step('허브 진입 계측(ops_hub_entered) 기록', async () => {
  const n = sql(
    `select count(*) from analytics_events where event='ops_hub_entered' and user_id='${OWNER_ID}' and created_at > now() - interval '2 minutes'`
  )[0];
  assert(Number(n) >= 1, 'ops_hub_entered 없음');
});

await step('스크린샷 375/768/1280 × 다크/라이트 (목록·새 대회)', async () => {
  const prepare = async (p) => {
    await p.goto(`${BASE}/login`);
    await login(p, OWNER);
    await p.waitForURL(`${BASE}/tournaments`);
  };
  await screenshots(browser, '/tournaments', 'w3-list', { prepare });
  await screenshots(browser, '/tournaments/new', 'w3-new', { prepare });
});

// 이번 실행이 만든 대회(생성 1 + 복제 1)를 보관해 다음 실행의 목록을 깨끗이 둔다.
archiveAsOwner(OWNER_ID, createdIds);
await browser.close();
finish();
