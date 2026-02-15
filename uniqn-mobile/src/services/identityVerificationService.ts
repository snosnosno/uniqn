/**
 * UNIQN Mobile - 본인인증 서비스
 *
 * @description 포트원 V2 본인인증 연동 서비스
 * @version 1.0.0
 *
 * 플로우:
 * 1. requestVerification(): 포트원 SDK로 본인인증 창 호출
 * 2. verifyResult(): Cloud Function으로 인증 결과 조회 + CI/DI 중복 확인
 */

import { httpsCallable } from 'firebase/functions';
import * as Crypto from 'expo-crypto';
import { getFirebaseFunctions } from '@/lib/firebase';
import { logger } from '@/utils/logger';
import { handleServiceError } from '@/errors/serviceErrorHandler';

// ============================================================================
// Types
// ============================================================================

/** 포트원 본인인증 결과 (Cloud Function 응답 - CI/DI 미포함) */
export interface VerifiedIdentityData {
  name: string;
  phone: string;
  birthDate: string; // YYYYMMDD
  gender: 'male' | 'female';
}

interface VerifyIdentityResponse {
  success: boolean;
  data?: VerifiedIdentityData;
  error?: string;
}

// ============================================================================
// Constants
// ============================================================================

const PORTONE_STORE_ID = 'store-c1b44e1c-7620-445b-bb6c-9b6b62e7ab93';
const PORTONE_CHANNEL_KEY = 'channel-key-a604c350-4a1e-42e6-b6f3-64c7ea7bde72';

// ============================================================================
// Service
// ============================================================================

/**
 * 고유한 본인인증 ID 생성 (CSPRNG 사용)
 *
 * pendingVerifications 문서 키로 사용되므로 추측 불가능해야 함
 */
export function generateIdentityVerificationId(): string {
  const bytes = Crypto.getRandomBytes(16);
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return `identity-${hex}`;
}

/**
 * 포트원 SDK 호출을 위한 파라미터 반환
 */
export function getPortOneParams(identityVerificationId: string) {
  return {
    storeId: PORTONE_STORE_ID,
    identityVerificationId,
    channelKey: PORTONE_CHANNEL_KEY,
  };
}

/**
 * Cloud Function으로 본인인증 결과 조회 + CI/DI 중복 확인
 *
 * @param identityVerificationId 포트원 본인인증 ID
 * @returns 검증된 개인정보 (CI/DI는 서버에만 저장, 클라이언트 미반환)
 */
export async function verifyIdentityResult(
  identityVerificationId: string
): Promise<VerifiedIdentityData> {
  try {
    logger.info('본인인증 결과 검증 요청', { identityVerificationId });

    const functions = getFirebaseFunctions();
    const verifyFunction = httpsCallable<
      { identityVerificationId: string },
      VerifyIdentityResponse
    >(functions, 'verifyIdentity');

    const result = await verifyFunction({ identityVerificationId });

    if (!result.data.success || !result.data.data) {
      throw new Error(result.data.error || '본인인증 검증에 실패했습니다.');
    }

    logger.info('본인인증 결과 검증 완료', {
      name: result.data.data.name,
    });

    return result.data.data;
  } catch (error) {
    throw handleServiceError(error, {
      operation: '본인인증 검증',
      component: 'identityVerificationService',
      context: { identityVerificationId },
    });
  }
}

/**
 * 회원가입 후 본인인증 정보(CI/DI)를 사용자 문서에 연결
 *
 * pendingVerifications에 저장된 CI/DI를 users/{uid}에 서버 측에서 복사
 *
 * @param identityVerificationId 포트원 본인인증 ID
 */
export async function linkIdentityVerification(identityVerificationId: string): Promise<void> {
  try {
    logger.info('본인인증 연결 요청', { identityVerificationId });

    const functions = getFirebaseFunctions();
    const linkFunction = httpsCallable<
      { identityVerificationId: string },
      { success: boolean; error?: string }
    >(functions, 'linkIdentityVerification');

    const result = await linkFunction({ identityVerificationId });

    if (!result.data.success) {
      throw new Error(result.data.error || '본인인증 연결에 실패했습니다.');
    }

    logger.info('본인인증 연결 완료', { identityVerificationId });
  } catch (error) {
    throw handleServiceError(error, {
      operation: '본인인증 연결',
      component: 'identityVerificationService',
      context: { identityVerificationId },
    });
  }
}
