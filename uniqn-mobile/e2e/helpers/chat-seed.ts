/**
 * 채팅 E2E 공용 — 전제 확인 + 채팅용 공고 시드
 *
 * 🔒 채팅 서버는 다크로 착지했다. e2e.yml 의 `npm run e2e:chat-enable` 스텝(로컬 스택 전용 GRANT +
 *    플래그 ON)이 전제다.
 * 🚨 로컬 스택이 아니면 준비 실패(null) — prod 오염 방지. **CI 에서 전제가 없으면 던진다** —
 *    skip 으로 두면 GRANT 스텝이 빠져도 초록이 된다(미실행 성공). 선례: chat-basic.spec.ts.
 */
import { E2E_CONFIG } from '../config';
import { getAdminClient, SUPABASE_QA_ACCOUNTS } from './supabase-admin';
import { ensureE2EWorkspace } from './workspace-seed';

type AdminClient = NonNullable<ReturnType<typeof getAdminClient>>;

const IS_CI = process.env['CI'] === 'true';
const IS_LOCAL_STACK = /127\.0\.0\.1|localhost/.test(E2E_CONFIG.supabase.url);

function fail(tag: string, message: string): never {
  throw new Error(`[${tag}] ${message}`);
}

/** 채팅 E2E 를 돌릴 수 있으면 admin 클라이언트, 로컬 실행에서 전제가 없으면 null(CI 는 throw) */
export async function prepareChatE2E(tag: string): Promise<AdminClient | null> {
  if (!IS_LOCAL_STACK) {
    if (IS_CI) fail(tag, 'CI 인데 로컬 Supabase 를 겨냥하지 않는다');
    return null;
  }
  const client = getAdminClient();
  if (!client) {
    if (IS_CI) fail(tag, 'E2E_SUPABASE_SERVICE_ROLE_KEY 가 없다');
    return null;
  }
  const { data } = await client
    .from('app_config')
    .select('value')
    .eq('key', 'chat_enabled')
    .maybeSingle();
  const enabled = (data?.value as { enabled?: unknown } | null)?.enabled === true;
  if (!enabled) {
    if (IS_CI) fail(tag, 'chat_enabled 플래그가 없다 — e2e.yml 의 e2e:chat-enable 스텝이 빠졌다');
    return null;
  }
  return client;
}

/** qa-employer 소유 active 공고 1건(구직자가 채팅을 걸 수 있는 상태) */
export async function seedChatPosting(
  admin: AdminClient,
  jobId: string,
  title: string,
  tag: string
): Promise<void> {
  const workspaceId = await ensureE2EWorkspace(admin, SUPABASE_QA_ACCOUNTS.employer.id);
  const date = new Date(Date.now() + 10 * 86_400_000).toISOString().slice(0, 10);
  const { error } = await admin.from('job_postings').insert({
    id: jobId,
    schema_version: 3,
    workspace_id: workspaceId,
    title,
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
  if (error) fail(tag, `공고 시드 실패: ${error.message}`);
}
