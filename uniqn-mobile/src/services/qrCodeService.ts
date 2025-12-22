/**
 * UNIQN Mobile - QR 코드 서비스
 *
 * @description QR 코드 생성 및 검증 서비스
 * @version 1.0.0
 */

import {
  doc,
  getDoc,
  setDoc,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { logger } from '@/utils/logger';
import { mapFirebaseError } from '@/errors';
import type {
  QRCodeData,
  QRCodeAction,
  CreateQRCodeRequest,
  QRCodeValidationResult,
} from '@/types';

// ============================================================================
// Constants
// ============================================================================

const QR_CODES_COLLECTION = 'qrCodes';

/** QR 코드 유효 시간 (5분) */
const QR_VALIDITY_DURATION_MS = 5 * 60 * 1000;

// ============================================================================
// QR Code Generation
// ============================================================================

/**
 * 고유한 QR 코드 ID 생성
 */
function generateQRCodeId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `qr_${timestamp}_${random}`;
}

/**
 * QR 코드 생성 (관리자/구인자용)
 */
export async function createQRCode(
  staffId: string,
  request: CreateQRCodeRequest
): Promise<QRCodeData> {
  try {
    logger.info('QR 코드 생성 시작', { staffId, request });

    const qrCodeId = generateQRCodeId();
    const now = Timestamp.now();
    const expiresAt = Timestamp.fromMillis(now.toMillis() + QR_VALIDITY_DURATION_MS);

    const qrData: QRCodeData = {
      id: qrCodeId,
      eventId: request.eventId,
      staffId,
      action: request.action,
      createdAt: now,
      expiresAt,
      isUsed: false,
    };

    const qrRef = doc(db, QR_CODES_COLLECTION, qrCodeId);
    await setDoc(qrRef, qrData);

    logger.info('QR 코드 생성 완료', { qrCodeId });

    return qrData;
  } catch (error) {
    logger.error('QR 코드 생성 실패', error as Error, { staffId, request });
    throw mapFirebaseError(error);
  }
}

// ============================================================================
// QR Code Validation
// ============================================================================

/**
 * QR 코드 검증
 */
export async function validateQRCode(
  qrCodeId: string,
  expectedAction?: QRCodeAction
): Promise<QRCodeValidationResult> {
  try {
    logger.info('QR 코드 검증 시작', { qrCodeId, expectedAction });

    const qrRef = doc(db, QR_CODES_COLLECTION, qrCodeId);
    const qrDoc = await getDoc(qrRef);

    if (!qrDoc.exists()) {
      return {
        isValid: false,
        error: '유효하지 않은 QR 코드입니다.',
        errorCode: 'INVALID',
      };
    }

    const qrData = qrDoc.data() as QRCodeData;

    // 만료 확인
    const now = Date.now();
    const expiresAt = qrData.expiresAt.toMillis();

    if (now > expiresAt) {
      return {
        isValid: false,
        qrData,
        error: 'QR 코드가 만료되었습니다. 새 QR 코드를 요청해주세요.',
        errorCode: 'EXPIRED',
      };
    }

    // 사용 여부 확인
    if (qrData.isUsed) {
      return {
        isValid: false,
        qrData,
        error: '이미 사용된 QR 코드입니다.',
        errorCode: 'USED',
      };
    }

    // 액션 타입 확인 (expectedAction이 있는 경우)
    if (expectedAction && qrData.action !== expectedAction) {
      const actionLabel = expectedAction === 'checkIn' ? '출근' : '퇴근';
      return {
        isValid: false,
        qrData,
        error: `${actionLabel}용 QR 코드가 아닙니다.`,
        errorCode: 'WRONG_ACTION',
      };
    }

    logger.info('QR 코드 검증 완료', { qrCodeId, isValid: true });

    return {
      isValid: true,
      qrData,
    };
  } catch (error) {
    logger.error('QR 코드 검증 실패', error as Error, { qrCodeId });
    throw mapFirebaseError(error);
  }
}

/**
 * QR 코드 ID로 데이터 조회
 */
export async function getQRCodeById(qrCodeId: string): Promise<QRCodeData | null> {
  try {
    const qrRef = doc(db, QR_CODES_COLLECTION, qrCodeId);
    const qrDoc = await getDoc(qrRef);

    if (!qrDoc.exists()) {
      return null;
    }

    return qrDoc.data() as QRCodeData;
  } catch (error) {
    logger.error('QR 코드 조회 실패', error as Error, { qrCodeId });
    throw mapFirebaseError(error);
  }
}

export default {
  createQRCode,
  validateQRCode,
  getQRCodeById,
};
