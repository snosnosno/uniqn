/**
 * 대회운영(ops) 라우트 접근 계약 — 결함⑥ 결정의 회귀망.
 *
 * `app/(ops)/_layout.tsx` 는 **인증만** 검사한다. `ops_hub_enabled` 플래그를 보지 않는 것이
 * 의도된 결정이다(플래그는 발견 표면 게이트일 뿐, 라우트 접근은 권한이 아니다 — 데이터 경계는
 * RLS 가 잡는다). 그 결정은 지금 주석과 유닛 테스트에만 적혀 있어, 누군가 "플래그 OFF 인데
 * 들어와진다"를 결함으로 오인하고 레이아웃에 게이트를 추가하면 **진행 중인 라이브 대회 운영이
 * 원격 킬스위치로 끊긴다**. 이 스펙이 그 회귀를 브라우저 레벨에서 잡는다.
 *
 * 근거: `app/(ops)/_layout.tsx` 헤더 주석 · `wiki/architecture/ops-engine.md`
 */
import { test, expect, type Page } from '@playwright/test';
import path from 'path';
import { waitForAppReady } from '../../helpers/wait-helpers';

const unauthenticatedState = path.join(
  __dirname,
  '../../fixtures/storage-states/unauthenticated.json'
);

/**
 * ops 대회 목록 — 정규 경로는 맨 `/tournaments` 다.
 *
 * `(ops)` 는 expo-router 그룹이라 URL 에서 빠진다. 예전엔 `app/(admin)/tournaments/index.tsx`
 * 가 **같은 `/tournaments` 로 매핑돼**(라우트 충돌) 맨 URL 에서 admin 이 이겼고,
 * `app/(admin)/_layout.tsx:23` 이 비-admin 을 `/(app)/(tabs)/home-jobs` 로 돌려보냈다.
 * 그래서 이 스펙은 한동안 `/(ops)/tournaments` 로 그룹을 명시해 **우회**하고 있었다.
 *
 * 그 충돌은 admin 쪽 세그먼트를 `tournament-approvals` 로 갈라 없앴다(그 화면의 실제 정체가
 * '관리자 대회공고 승인 관리'다). 이제 맨 `/tournaments` 는 `(ops)` 하나만 매치하므로
 * 우회를 걷고 **정규 경로를 그대로 쓴다** — 우회를 남겨두면 충돌이 되살아나도 초록으로 지나간다.
 */
const OPS_LIST_PATH = '/tournaments';

async function gotoOps(page: Page): Promise<void> {
  await page.goto(OPS_LIST_PATH, { waitUntil: 'domcontentloaded' });
  await waitForAppReady(page);
}

test.describe('ops 라우트 접근', () => {
  test.setTimeout(60_000);

  test('인증된 사용자는 플래그 OFF 여도 진입한다 (결함⑥ 결정)', async ({ page }) => {
    // 기본 storageState = staff. ops 는 **역할 무관**(인증만)이라 staff 로 들어가지는 것 자체가 계약이다.
    // 역할 게이트가 잘못 추가되면 여기서 로그인 화면이나 권한 안내로 튕겨 실패한다.
    await gotoOps(page);

    // 로그인으로 튕기지 않았다 = 게이트 통과.
    expect(new URL(page.url()).pathname).not.toMatch(/login|auth/);

    // "라이브 운영" 헤더가 이 화면의 신원이다. 목록/빈상태/에러 어느 분기든 헤더는 항상 렌더된다.
    await expect(page.getByText('라이브 운영')).toBeVisible({ timeout: 15_000 });
  });

  test('맨 URL /tournaments 로도 ops 목록에 도달한다 (라우트 충돌 회귀망)', async ({ page }) => {
    // 이것이 충돌 수정의 직접 증거다. 충돌이 되살아나면(=admin 쪽에 `tournaments` 세그먼트가
    // 다시 생기면) staff 는 `app/(admin)/_layout.tsx:23` 에 의해 home-jobs 로 튕겨 여기서 실패한다.
    // 주소창 직접 입력·딥링크·웹 새로고침이 전부 이 경로를 탄다.
    await page.goto('/tournaments', { waitUntil: 'domcontentloaded' });
    await waitForAppReady(page);

    expect(new URL(page.url()).pathname).not.toMatch(/home-jobs/);
    await expect(page.getByText('라이브 운영')).toBeVisible({ timeout: 15_000 });
  });

  test('미인증 사용자는 로그인으로 리다이렉트된다', async ({ browser }) => {
    const context = await browser.newContext({ storageState: unauthenticatedState });
    const page = await context.newPage();

    await page.goto(OPS_LIST_PATH, { waitUntil: 'domcontentloaded' });
    await page.waitForURL(/login|auth/, { timeout: 30_000 }).catch(() => {});

    // 인증 게이트는 남아 있어야 한다 — 결함⑥ 결정이 없앤 것은 **플래그** 게이트지 인증이 아니다.
    expect(new URL(page.url()).pathname).toMatch(/login|auth/);

    await context.close();
  });
});
