import { expect, test, type Page } from '@playwright/test';
import { getAdminClient, SUPABASE_QA_ACCOUNTS } from '../../helpers/supabase-admin';
import { getDefaultWorkspaceId } from '../../helpers/workspace-seed';
import { TEST_ACCOUNTS } from '../../fixtures/test-accounts';

// ============================================================
// 공고 인원마감 자동 전이(capacity_full) ↔ 복귀(active) e2e
// ------------------------------------------------------------
// 시나리오(spec §5 e2e):
//   1) 정원 1명 active 공고에 confirmed 1건 → 트리거가 capacity_full 로 자동 마감
//      → 구인자 목록에서 "정원 마감" 라벨(회색) 노출
//   2) 1건 취소(confirmed→cancelled) → 트리거가 active 로 자동 복귀
//      → 목록에서 "모집중" 라벨 노출
//
// 좌석 기준 정렬(Task 5):
//   - 이 픽스처는 단일날짜(workDate)·단일역할(dealer count 1)·total_positions 1 →
//     좌석 총합 = 사람 총합 = 1. 따라서 "1건 확정 → capacity_full" 기대는 좌석 기준에서도
//     동일하다. 시나리오 수정 불요, 기대값 그대로 유지.
//
// 주의:
//   - 파일명 employer- 접두사 필수: playwright.config.ts 의 chromium-employer
//     프로젝트(employer.json storageState, role=employer)로 라우팅되어야 /employer
//     탭이 EmployerView 로 렌더된다. 접두사 없으면 기본 chromium(staff.json)으로
//     실행되어 NonEmployerView 가 떠 UI 단언이 전부 실패한다.
//   - state-dependent 순차 시나리오 → describe serial mode 필수
//     (pitfall_e2e_fullyparallel_serial_mode)
//   - review-* 계정 사용 (pitfall: project_e2e_review_accounts)
//   - 시딩은 service_role 필요 → 키 미설정 시 skip (repo 관례)
//   - 트리거 전이는 pgTAP(capacity_full_transition.test.sql)에서 결정적으로 검증됨.
//     본 e2e 는 실제 스택+구인자 UI 통합을 확인한다.
// ============================================================

test.describe.configure({ mode: 'serial' });

const admin = getAdminClient();

async function waitForReady(page: Page): Promise<void> {
  await page.waitForLoadState('domcontentloaded');
  await page.locator('body').waitFor({ state: 'visible', timeout: 30_000 });
  await page.waitForTimeout(1_000);
}

test.describe('공고 인원마감 자동 전이/복귀', () => {
  test.skip(!admin, 'E2E_SUPABASE_SERVICE_ROLE_KEY 미설정 — 시딩 불가로 skip');
  test.setTimeout(90_000);

  const TITLE = `capacity-recovery-${Date.now()}`;
  let jobId = '';
  let appId = '';

  test.afterAll(async () => {
    if (!admin) return;
    if (appId) await admin.from('applications').delete().eq('id', appId);
    if (jobId) await admin.from('job_postings').delete().eq('id', jobId);
  });

  test('정원 도달 → capacity_full 자동 마감 (DB 검증)', async () => {
    if (!admin) return;
    const workDate = new Date(Date.now() + 10 * 86_400_000).toISOString().slice(0, 10);
    const workspaceId = await getDefaultWorkspaceId(admin, TEST_ACCOUNTS.employer.uid);

    // 정원 1명 active 공고
    const { data: jp, error: jpErr } = await admin
      .from('job_postings')
      .insert({
        title: TITLE,
        status: 'active',
        workspace_id: workspaceId,
        owner_id: TEST_ACCOUNTS.employer.uid,
        owner_name: TEST_ACCOUNTS.employer.displayName,
        work_date: workDate,
        work_dates: [workDate],
        posting_type: 'regular',
        total_positions: 1,
        filled_positions: 0,
        view_count: 0,
        schema_version: 3,
        description: `E2E capacity 공고 — ${TITLE}`,
        contact_phone: '+82101234567',
        location: { name: '테스트홀덤펍', district: '강남구', detailedAddress: '테스트로 1' },
        schedule: {
          kind: 'dated',
          primaryDate: workDate,
          allDates: [workDate],
          requirements: [
            {
              date: workDate,
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
      })
      .select('id')
      .single();
    if (jpErr) throw new Error(`job_postings INSERT 실패: ${jpErr.message}`);
    jobId = (jp as { id: string }).id;

    // confirmed 1건 INSERT → fn_update_job_posting_stats 트리거가 filled +1 → capacity_full 전이
    const { data: app, error: appErr } = await admin
      .from('applications')
      .insert({
        job_posting_id: jobId,
        applicant_id: SUPABASE_QA_ACCOUNTS.staff.id,
        applicant_name: SUPABASE_QA_ACCOUNTS.staff.name,
        applicant_phone: '+82101234567',
        applicant_role: 'staff',
        job_posting_title: TITLE,
        status: 'confirmed',
        assignments: [
          { roleIds: ['dealer'], timeSlot: '18:00', dates: [workDate], isGrouped: false },
        ],
        is_read: false,
        recruitment_type: 'event',
      })
      .select('id')
      .single();
    if (appErr) throw new Error(`applications INSERT 실패: ${appErr.message}`);
    appId = (app as { id: string }).id;

    // DB 결정적 검증: 트리거가 capacity_full 로 전이했는지
    // (좌석 기준에서도 동일 기대 — 단일날짜·단일역할이라 좌석 1 = 사람 1)
    const { data: row } = await admin
      .from('job_postings')
      .select('status, filled_positions')
      .eq('id', jobId)
      .single();
    expect((row as { status: string }).status).toBe('capacity_full');
    expect((row as { filled_positions: number }).filled_positions).toBe(1);
  });

  // 구인자 UI 통합: capacity_full 공고가 목록에 "정원 마감" 라벨로 노출되는지.
  // 파일명 employer- 접두사 → chromium-employer 프로젝트(employer.json storageState,
  // role=employer)로 실행되어 /employer 탭에서 EmployerView 가 렌더된다.
  // serial 순서상 capacity_full 마감 직후·active 복귀 전에 실행되어야 라벨이 유효하다.
  // ("정원 마감"은 카드 상태 라벨에만 존재 — 필터 탭엔 없어 page-level 단언이 견고함)
  test('구인자 UI: capacity_full 공고에 "정원 마감" 라벨 노출', async ({ page }) => {
    if (!admin) return;
    await page.goto('/employer', { waitUntil: 'domcontentloaded' });
    await waitForReady(page);
    await expect(page.locator(`button:has-text("${TITLE}"):visible`).first()).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText('정원 마감', { exact: false }).first()).toBeVisible({
      timeout: 10_000,
    });
  });

  test('빈자리 발생(취소) → active 자동 복귀 (DB 검증)', async () => {
    if (!admin) return;
    // confirmed → cancelled: 트리거가 filled -1 → capacity_full→active 복귀
    const { error: updErr } = await admin
      .from('applications')
      .update({ status: 'cancelled' })
      .eq('id', appId);
    if (updErr) throw new Error(`applications UPDATE 실패: ${updErr.message}`);

    const { data: row } = await admin
      .from('job_postings')
      .select('status, filled_positions')
      .eq('id', jobId)
      .single();
    expect((row as { status: string }).status).toBe('active');
    expect((row as { filled_positions: number }).filled_positions).toBe(0);
  });
});
