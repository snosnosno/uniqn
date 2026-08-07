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
 * ops 대회 목록 — **그룹을 명시해야 한다.**
 *
 * `(ops)` 는 expo-router 그룹이라 URL 에서 빠지므로 정규 경로는 `/tournaments` 인데,
 * `app/(admin)/tournaments/index.tsx` 도 **같은 `/tournaments` 로 매핑된다**(라우트 충돌).
 * 맨 `/tournaments` 로 들어가면 admin 쪽이 이기고, `app/(admin)/_layout.tsx:23` 이
 * 비-admin 을 `/(app)/(tabs)/home-jobs` 로 돌려보낸다 — 2026-08-08 실측:
 *   staff → `/tournaments`      ⇒ 최종 `/home-jobs` (ops 화면 못 봄)
 *   staff → `/(ops)/tournaments` ⇒ 최종 `/tournaments` (ops 화면 정상)
 * 그룹을 명시하면 정상 진입하고 주소는 `/tournaments` 로 정규화된다.
 *
 * ⚠️ 이 우회는 **테스트를 통과시키기 위한 것이지, 충돌이 정상이라는 뜻이 아니다.**
 *    맨 URL·딥링크로 ops 목록에 못 가는 것은 별도 결함으로 보고돼 있다.
 */
const OPS_LIST_PATH = '/(ops)/tournaments';

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

  test('미인증 사용자는 로그인으로 리다이렉트된다', async ({ browser }) => {
    const context = await browser.newContext({ storageState: unauthenticatedState });
    const page = await context.newPage();

    // 반드시 그룹을 명시한 경로로 — 맨 `/tournaments` 를 쓰면 admin 레이아웃이 먼저 로그인으로
    // 보내므로 **ops 레이아웃을 한 번도 타지 않고** 통과한다(잘못된 이유로 초록).
    await page.goto(OPS_LIST_PATH, { waitUntil: 'domcontentloaded' });
    await page.waitForURL(/login|auth/, { timeout: 30_000 }).catch(() => {});

    // 인증 게이트는 남아 있어야 한다 — 결함⑥ 결정이 없앤 것은 **플래그** 게이트지 인증이 아니다.
    expect(new URL(page.url()).pathname).toMatch(/login|auth/);

    await context.close();
  });
});
