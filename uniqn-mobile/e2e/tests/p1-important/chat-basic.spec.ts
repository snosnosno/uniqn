/**
 * 앱 내 채팅 S2a — 기본 흐름 E2E (텍스트)
 *
 * 구직자(staff storageState) ↔ 구인자(employer 컨텍스트) 1:1 방:
 *   1) 공고 상세 '채팅' → 새 방 → 첫 전송 → 방 화면으로 바뀜
 *   2) 구인자 소통 탭 '채팅' 칸 목록에 방이 뜬다(안 읽음)
 *   3) 구인자 답장이 구직자 화면에 새로고침 없이 나타난다(realtime → tail 무효화 → RLS SELECT)
 *   4) 공고 마감 후에도 대화는 이어지고, 방 카드에 '마감' 배지
 *   5) 구인자 '나가기' → 목록에서 사라짐 / 6) 구직자 새 메시지 → 다시 나타남
 *   7) 전송 실패 → '재전송' → 같은 p_client_message_id, 서버 행은 정확히 1개
 *
 * 🔒 서버는 다크로 착지했다. 이 스펙은 e2e.yml 의 `npm run e2e:chat-enable` 스텝(로컬 스택 전용
 *    GRANT + 플래그 ON)을 전제로 한다.
 * 🚨 가드: 로컬 스택이 아니면 skip(prod 오염 방지). **CI 에서 전제가 없으면 skip 이 아니라 fail** —
 *    skip 으로 두면 GRANT 스텝이 빠져도 초록이 된다(미실행 성공).
 */
import path from 'path';
import { test, expect, type Browser, type Page } from '@playwright/test';
import { E2E_CONFIG } from '../../config';
import { getAdminClient, SUPABASE_QA_ACCOUNTS } from '../../helpers/supabase-admin';
import { waitForAppReady } from '../../helpers/wait-helpers';
import { ensureE2EWorkspace } from '../../helpers/workspace-seed';

test.describe.configure({ mode: 'serial' });

const EMPLOYER_STATE = path.join(__dirname, '../../fixtures/storage-states/employer.json');
const IS_CI = process.env['CI'] === 'true';
const IS_LOCAL_STACK = /127\.0\.0\.1|localhost/.test(E2E_CONFIG.supabase.url);

const JOB_ID = crypto.randomUUID();
const JOB_TITLE = `채팅 E2E 공고 ${JOB_ID.slice(0, 6)}`;
const FIRST_MESSAGE = `안녕하세요 채팅 테스트 ${JOB_ID.slice(0, 4)}`;
const REPLY = `네 반갑습니다 ${JOB_ID.slice(0, 4)}`;

let admin: NonNullable<ReturnType<typeof getAdminClient>>;
let employerPage: Page;
let conversationId = '';

function fail(message: string): never {
  throw new Error(`[chat-basic] ${message}`);
}

async function assertPrerequisites(): Promise<boolean> {
  if (!IS_LOCAL_STACK) {
    if (IS_CI) fail('CI 인데 로컬 Supabase 를 겨냥하지 않는다');
    return false;
  }
  const client = getAdminClient();
  if (!client) {
    if (IS_CI) fail('E2E_SUPABASE_SERVICE_ROLE_KEY 가 없다');
    return false;
  }
  admin = client;
  const { data } = await admin
    .from('app_config')
    .select('value')
    .eq('key', 'chat_enabled')
    .maybeSingle();
  const enabled = (data?.value as { enabled?: unknown } | null)?.enabled === true;
  if (!enabled) {
    if (IS_CI) fail('chat_enabled 플래그가 없다 — e2e.yml 의 e2e:chat-enable 스텝이 빠졌다');
    return false;
  }
  return true;
}

async function seedPosting(): Promise<void> {
  const workspaceId = await ensureE2EWorkspace(admin, SUPABASE_QA_ACCOUNTS.employer.id);
  const date = new Date(Date.now() + 10 * 86_400_000).toISOString().slice(0, 10);
  const { error } = await admin.from('job_postings').insert({
    id: JOB_ID,
    schema_version: 3,
    workspace_id: workspaceId,
    title: JOB_TITLE,
    description: 'E2E 채팅 테스트용 공고',
    status: 'active',
    owner_id: SUPABASE_QA_ACCOUNTS.employer.id,
    owner_name: SUPABASE_QA_ACCOUNTS.employer.name,
    posting_type: 'regular',
    work_date: date,
    work_dates: [date],
    total_positions: 1,
    filled_positions: 0,
    view_count: 0,
    contact_phone: '+82101234567',
    location: { name: 'E2E채팅홀덤펍', district: '강남구', detailedAddress: '테스트로 1' },
    schedule: {
      kind: 'dated',
      primaryDate: date,
      allDates: [date],
      requirements: [
        {
          date,
          timeSlots: [{ startTime: '18:00', roles: [{ role: 'dealer', count: 1, filled: 0 }] }],
        },
      ],
    },
    role_catalog: [{ role: 'dealer', salary: { type: 'daily', amount: 150000 } }],
    compensation: { mode: 'shared', defaultSalary: { type: 'daily', amount: 150000 } },
    questions: { items: [] },
    stats: {
      totalApplicants: 0,
      activeApplicants: 0,
      confirmedApplicants: 0,
      cancellationPendingApplicants: 0,
      filledPositions: 0,
    },
  });
  if (error) fail(`공고 시드 실패: ${error.message}`);
}

/** 방의 메시지 목록 안에서만 찾는다 — 스택 아래 숨은 목록 행 미리보기에 같은 문구가 있다 */
function inRoom(page: Page, text: string) {
  return page.getByTestId('chat-message-list').getByText(text);
}

async function sendText(page: Page, text: string): Promise<void> {
  await page.getByTestId('chat-composer-input').fill(text);
  await page.getByTestId('chat-composer-send').click();
}

async function openEmployerList(browser: Browser): Promise<void> {
  if (!employerPage) {
    const context = await browser.newContext({ storageState: EMPLOYER_STATE });
    employerPage = await context.newPage();
  }
  await employerPage.goto('/board/chat');
  await waitForAppReady(employerPage);
}

test.beforeAll(async () => {
  const ready = await assertPrerequisites();
  test.skip(
    !ready,
    '로컬 스택 + 채팅 GRANT/플래그 전제가 없어 건너뜀(로컬 실행 전용 안내: npm run e2e:chat-enable)'
  );
  await seedPosting();
});

test.afterAll(async () => {
  if (admin) await admin.from('job_postings').delete().eq('id', JOB_ID); // 방·메시지 CASCADE
  await employerPage?.context().close();
});

test('1) 구직자: 공고 상세 → 채팅 → 첫 전송 → 그 자리에서 방이 된다', async ({ page }) => {
  await page.goto(`/jobs/${JOB_ID}`);
  await waitForAppReady(page);
  await page.getByTestId('chat-start-button').click();
  await expect(page).toHaveURL(/\/chat\/new/);

  await sendText(page, FIRST_MESSAGE);

  // 방이 서버에 생겼다(첫 전송 때 open)
  await expect
    .poll(async () => {
      const { data } = await admin
        .from('chat_conversations')
        .select('id')
        .eq('job_posting_id', JOB_ID)
        .eq('seeker_id', SUPABASE_QA_ACCOUNTS.staff.id)
        .maybeSingle();
      return (data as { id?: string } | null)?.id ?? '';
    })
    .not.toBe('');
  const { data } = await admin
    .from('chat_conversations')
    .select('id')
    .eq('job_posting_id', JOB_ID)
    .maybeSingle();
  conversationId = (data as { id: string }).id;

  // 아웃박스 말풍선은 서버 행이 오면 빠진다 — 정확히 1개(숨은 화면에 남는 복제 없음)
  await expect(inRoom(page, FIRST_MESSAGE)).toHaveCount(1);
  await expect(inRoom(page, FIRST_MESSAGE)).toBeVisible();

  // 회귀: 뒤로 가면 공고 상세(처음엔 replace 로 숨은 new 화면이 남아 그리로 돌아갔다)
  await page.goBack();
  await expect(page).toHaveURL(new RegExp(`/jobs/${JOB_ID}`));
});

test('1-b) 방이 이미 있으면 다시 채팅을 눌러도 그 방이고, 뒤로 가기가 갇히지 않는다', async ({
  page,
}) => {
  await page.goto(`/jobs/${JOB_ID}`);
  await waitForAppReady(page);
  await page.getByTestId('chat-start-button').click();
  await expect(inRoom(page, FIRST_MESSAGE)).toHaveCount(1);

  await page.goBack();
  await expect(page).toHaveURL(new RegExp(`/jobs/${JOB_ID}`));
});

test('2) 구인자: 소통 탭 채팅 칸에 방이 안 읽음으로 뜬다', async ({ browser }) => {
  await openEmployerList(browser);
  const row = employerPage.getByRole('button', { name: new RegExp(JOB_TITLE) });
  await expect(row).toBeVisible();
  await expect(row).toHaveAccessibleName(/안 읽은 메시지 1개/);
});

test('3) 구인자 답장이 구직자 화면에 새로고침 없이 나타난다', async ({ page }) => {
  await page.goto(`/chat/${conversationId}`);
  await waitForAppReady(page);
  await expect(inRoom(page, FIRST_MESSAGE)).toBeVisible();

  await employerPage.getByRole('button', { name: new RegExp(JOB_TITLE) }).click();
  await expect(inRoom(employerPage, FIRST_MESSAGE)).toBeVisible();
  await sendText(employerPage, REPLY);

  await expect(inRoom(page, REPLY)).toBeVisible({ timeout: 20_000 });
});

test('4) 공고 마감 후에도 대화가 이어지고 방 카드에 마감 배지', async ({ page }) => {
  const { error } = await admin.from('job_postings').update({ status: 'closed' }).eq('id', JOB_ID);
  if (error) fail(`마감 전환 실패: ${error.message}`);

  // 목록을 거쳐 들어가야 방 카드가 목록 RPC 의 공고 상태를 안다
  await page.goto('/board/chat');
  await waitForAppReady(page);
  await page.getByRole('button', { name: new RegExp(JOB_TITLE) }).click();
  await expect(page.getByText('마감', { exact: true })).toBeVisible();

  await sendText(page, '마감 후에도 보낼 수 있나요');
  await expect(inRoom(page, '마감 후에도 보낼 수 있나요')).toBeVisible();
});

test('5·6) 구인자 나가기 → 목록에서 사라지고, 새 메시지가 오면 다시 나타난다', async ({ page }) => {
  await employerPage.goto(`/chat/${conversationId}`);
  await waitForAppReady(employerPage);
  employerPage.once('dialog', (dialog) => void dialog.accept());
  await employerPage.getByRole('button', { name: '채팅방 나가기' }).click();

  await openEmployerList(employerPage.context().browser() as Browser);
  await expect(employerPage.getByRole('button', { name: new RegExp(JOB_TITLE) })).toHaveCount(0);

  await page.goto(`/chat/${conversationId}`);
  await waitForAppReady(page);
  await sendText(page, '다시 연락드려요');
  await expect(inRoom(page, '다시 연락드려요')).toBeVisible();

  await openEmployerList(employerPage.context().browser() as Browser);
  await expect(employerPage.getByRole('button', { name: new RegExp(JOB_TITLE) })).toBeVisible();
});

test('7) 전송 실패 → 재전송은 같은 client_message_id, 서버 행은 1개', async ({ page }) => {
  const bodies: string[] = [];
  let aborted = false;
  await page.route('**/rest/v1/rpc/chat_send_message', async (route) => {
    bodies.push(route.request().postData() ?? '');
    if (!aborted) {
      aborted = true;
      await route.abort('failed');
      return;
    }
    await route.continue();
  });

  await page.goto(`/chat/${conversationId}`);
  await waitForAppReady(page);
  const text = `재전송 테스트 ${Date.now()}`;
  await sendText(page, text);

  const retry = page.getByRole('button', { name: '메시지 다시 보내기' });
  await expect(retry).toBeVisible();
  await retry.click();
  await expect(retry).toHaveCount(0);

  expect(bodies).toHaveLength(2);
  const ids = bodies.map(
    (b) => (JSON.parse(b) as { p_client_message_id: string }).p_client_message_id
  );
  expect(ids[0]).toBe(ids[1]);

  const { count } = await admin
    .from('chat_messages')
    .select('id', { count: 'exact', head: true })
    .eq('conversation_id', conversationId)
    .eq('client_message_id', ids[0]);
  expect(count).toBe(1);
});
