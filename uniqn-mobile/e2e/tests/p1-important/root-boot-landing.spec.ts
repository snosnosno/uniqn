/**
 * 루트 부팅 착지 — Staff E2E 회귀 테스트
 *
 * 배경(2026-07-19 리뷰 반증):
 *   홈 대시보드 삭제 커밋(9aed39b28)이 `home-navigation-staff.spec.ts` 를 통째로
 *   삭제하면서, 그 안의 "앱 진입 시 홈 대시보드가 표시된다" 테스트가 실은
 *   단언 문자열('다음 근무')만 죽었을 뿐 검증 대상인 "인증 사용자가 '/' 로 부팅하면
 *   올바른 진입 화면에 착지한다"는 `useAuthGuard.ts` 의 살아있는 분기였음이 드러났다.
 *   그 착지 라우트는 홈 대시보드 삭제로 `/(app)/home` → `/(app)/(tabs)/home-jobs`
 *   로 바뀐 바로 그 대상이다.
 *
 *   잔존 커버리지 전수 조사 결과 대체재 없음:
 *     - smoke.spec.ts:19        — 공허 단언(항상 참)
 *     - auth-login.spec.ts:24   — 폼 제출 경로(로그인 직후), '/' 재부팅 경로 아님
 *     - auth-logout-session.spec.ts:11 — `.or()` 갈래로 이 경로를 명시 단언하지 않음
 *     - rbac-access.spec.ts:163 — 미인증 케이스, 인증 착지 케이스 아님
 *
 *   즉 재방문 사용자의 가장 흔한 경로(앱 재실행 → '/' 부팅 → 착지)에 회귀 테스트가
 *   없었다. 이 파일이 그 공백을 메운다.
 *
 * 시나리오:
 *   1. Staff storageState 로 '/' 부팅 (앱 재실행 시뮬레이션)
 *   2. useAuthGuard 의 인증 루트 리다이렉트 발동 확인
 *   3. 구인구직 탭(SearchBar) 표시 + URL '/home-jobs' 착지 확인
 */

import { test, expect } from '@playwright/test';
import path from 'path';
import { waitForAppReady } from '../../helpers/wait-helpers';

const staffState = path.join(__dirname, '../../fixtures/storage-states/staff.json');

test.use({ storageState: staffState });

test.describe('루트 부팅 착지 — Staff', () => {
  test('인증 staff가 / 로 부팅하면 구인구직 탭에 착지한다', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await waitForAppReady(page);

    // useAuthGuard 의 인증 루트 리다이렉트가 해결한 진입점.
    // SearchBar 사용처가 home-jobs.tsx 1곳뿐이라 .first() 없이 strict 통과한다.
    await expect(page.getByPlaceholder('제목, 장소로 검색')).toBeVisible({ timeout: 15_000 });

    expect(new URL(page.url()).pathname).toBe('/home-jobs');
  });
});
