/**
 * UNIQN Functions - Apple Token Revocation
 *
 * @description Apple 계정 탈퇴 시 토큰 파기 (App Store 심사 요구사항)
 *
 * 플로우:
 * 1. 클라이언트가 Apple 재인증 후 authorizationCode 전달
 * 2. authorizationCode → Apple token endpoint → refresh_token 획득
 * 3. refresh_token → Apple revoke endpoint → 토큰 파기
 *
 * @version 1.0.0
 */

import { onCall } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions';
import * as jwt from 'jsonwebtoken';
import { requireAuth } from '../errors/validators';
import { requireString } from '../errors/validators';
import { handleFunctionError } from '../errors/errorHandler';

// ============================================================================
// Constants
// ============================================================================

const APPLE_TOKEN_URL = 'https://appleid.apple.com/auth/token';
const APPLE_REVOKE_URL = 'https://appleid.apple.com/auth/revoke';

// ============================================================================
// Helpers
// ============================================================================

/**
 * Apple client_secret JWT 생성
 *
 * Apple OAuth2 API 호출에 필요한 ES256 서명 JWT
 * @see https://developer.apple.com/documentation/sign_in_with_apple/generate_and_validate_tokens
 */
function generateAppleClientSecret(): string {
  const privateKey = process.env.APPLE_PRIVATE_KEY;
  const keyId = process.env.APPLE_KEY_ID;
  const teamId = process.env.APPLE_TEAM_ID;
  const clientId = process.env.APPLE_CLIENT_ID;

  if (!privateKey || !keyId || !teamId || !clientId) {
    throw new Error(
      'Apple OAuth 시크릿 미설정: APPLE_PRIVATE_KEY, APPLE_KEY_ID, APPLE_TEAM_ID, APPLE_CLIENT_ID 확인 필요'
    );
  }

  return jwt.sign({}, privateKey.replace(/\\n/g, '\n'), {
    algorithm: 'ES256',
    expiresIn: '5m',
    issuer: teamId,
    audience: 'https://appleid.apple.com',
    subject: clientId,
    keyid: keyId,
  });
}

// ============================================================================
// Cloud Function
// ============================================================================

export const revokeAppleToken = onCall(
  {
    region: 'asia-northeast3',
    secrets: [
      'APPLE_PRIVATE_KEY',
      'APPLE_KEY_ID',
      'APPLE_TEAM_ID',
      'APPLE_CLIENT_ID',
    ],
  },
  async (request): Promise<{ success: boolean }> => {
    try {
      const uid = requireAuth(request);
      const authorizationCode = requireString(
        request.data?.authorizationCode,
        'authorizationCode'
      );

      const clientId = process.env.APPLE_CLIENT_ID;
      if (!clientId) {
        throw new Error('APPLE_CLIENT_ID 시크릿 미설정');
      }
      const clientSecret = generateAppleClientSecret();

      // Step 1: authorizationCode → refresh_token 교환
      const tokenBody = new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code: authorizationCode,
        grant_type: 'authorization_code',
      });

      const tokenResponse = await fetch(APPLE_TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: tokenBody.toString(),
      });

      if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text();
        logger.warn('Apple 토큰 교환 실패', {
          uid,
          status: tokenResponse.status,
          error: errorText,
        });
        // 토큰 교환 실패해도 탈퇴는 진행 (best-effort)
        return { success: false };
      }

      const tokenData = (await tokenResponse.json()) as {
        refresh_token?: string;
        access_token?: string;
      };

      const tokenToRevoke =
        tokenData.refresh_token || tokenData.access_token;

      if (!tokenToRevoke) {
        logger.warn('Apple 파기 대상 토큰 없음 (비정상 응답)', { uid });
        return { success: false };
      }

      // Step 2: 토큰 파기
      const revokeBody = new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        token: tokenToRevoke,
        token_type_hint: tokenData.refresh_token
          ? 'refresh_token'
          : 'access_token',
      });

      const revokeResponse = await fetch(APPLE_REVOKE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: revokeBody.toString(),
      });

      if (!revokeResponse.ok) {
        const errorText = await revokeResponse.text();
        logger.warn('Apple 토큰 파기 요청 실패', {
          uid,
          status: revokeResponse.status,
          error: errorText,
        });
        return { success: false };
      }

      logger.info('Apple 토큰 파기 완료', { uid });
      return { success: true };
    } catch (error) {
      throw handleFunctionError(error, {
        operation: 'revokeAppleToken',
        context: { uid: request.auth?.uid },
      });
    }
  }
);
