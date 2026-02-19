/**
 * UNIQN Functions - Custom Token 생성
 *
 * @description Apple 소셜 로그인 후 Native SDK 동기화를 위한 Custom Token 발급
 *
 * Apple Sign-In은 credential이 1회용이라 Web SDK가 소비하면 Native SDK에 재사용 불가.
 * 이 함수로 Custom Token을 발급받아 Native SDK에 signInWithCustomToken() 호출.
 *
 * @version 1.0.0
 */

import { onCall } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions';
import * as admin from 'firebase-admin';
import { requireAuth } from '../errors/validators';
import { handleFunctionError } from '../errors/errorHandler';

interface CreateCustomTokenResponse {
  customToken: string;
}

export const createCustomToken = onCall(
  { region: 'asia-northeast3', enforceAppCheck: true },
  async (request): Promise<CreateCustomTokenResponse> => {
    try {
      const uid = requireAuth(request);

      logger.info('Custom Token 발급 요청', { uid });

      const customToken = await admin.auth().createCustomToken(uid);

      logger.info('Custom Token 발급 완료', { uid });
      return { customToken };
    } catch (error) {
      throw handleFunctionError(error, {
        operation: 'createCustomToken',
        context: { uid: request.auth?.uid },
      });
    }
  }
);
