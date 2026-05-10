/**
 * P1 e2e — PortOne identity verification timestamp guard (PR-A).
 *
 * spec: docs/specs/apple-portone-caller-binding.md (v3, line 156-159 + 사용자 지시)
 *
 * 모든 시나리오는 PortOne mock infrastructure를 요구한다 (실 PortOne API
 * 호출 없이 verifiedAt만 임의 조작 → response). 현재 인프라가 없으므로 test.skip
 * 처리하고 시나리오만 명세화. 인프라 갖춰지면 unskip.
 *
 * 인프라 도입 시 필요:
 * - PortOne API endpoint를 staging/local mock으로 redirect (env override)
 * - mock fixture가 verifiedAt 값을 테스트별로 주입
 * - supabase staging anon-key + storeId staging 환경
 */
import { test, expect } from '@playwright/test';

test.describe('PortOne timestamp guard (PR-A)', () => {
  test.skip(true, 'PortOne mock infrastructure 미구현 — 도입 후 unskip');

  test('verifiedAt 4분 전 → 200 정상 가입 시나리오 (window 내)', async ({ request }) => {
    // TODO: PortOne mock으로 verifiedAt 4분 전 응답 주입
    // 1. supabase test user 생성
    // 2. mock PortOne: { status: 'VERIFIED', verifiedAt: <4min ago>, verifiedCustomer: {...} }
    // 3. POST /functions/v1/verify-and-save-portone-profile { mode:'signup', termsAgreed:true, ... }
    // 4. expect status === 200, body.success === true
    expect(request).toBeTruthy();
  });

  test('verifiedAt 6분 전 → 400 IV_TIMESTAMP_EXPIRED', async ({ request }) => {
    // TODO: mock PortOne으로 verifiedAt 6분 전 주입
    // expect status === 400, body.code === 'IV_TIMESTAMP_EXPIRED'
    // expect body.error === '본인인증 세션이 만료되었습니다. 다시 진행해주세요.'
    expect(request).toBeTruthy();
  });

  test('verifiedAt missing → 400 IV_TIMESTAMP_EXPIRED', async ({ request }) => {
    // TODO: mock PortOne 응답에서 verifiedAt 키 제거
    // expect status === 400, body.code === 'IV_TIMESTAMP_EXPIRED'
    expect(request).toBeTruthy();
  });

  test('verifiedAt invalid string → 400 IV_TIMESTAMP_EXPIRED', async ({ request }) => {
    // TODO: mock PortOne 응답에서 verifiedAt = 'not-a-date'
    // expect status === 400, body.code === 'IV_TIMESTAMP_EXPIRED'
    expect(request).toBeTruthy();
  });
});
