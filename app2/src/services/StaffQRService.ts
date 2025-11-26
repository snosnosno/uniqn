/**
 * 스태프 QR 생성 및 관리 서비스
 *
 * @version 2.0
 * @since 2025-10-16
 * @author T-HOLDEM Development Team
 *
 * 주요 기능:
 * - 스태프별 QR 메타데이터 생성
 * - QR 재생성
 * - 동적 QR 페이로드 생성 (3분 만료)
 * - QR 검증
 */

import { doc, getDoc, setDoc, updateDoc, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { v4 as uuidv4 } from 'uuid';
import { StaffQRMetadata, StaffQRPayload } from '../types/staffQR';
import { logger } from '../utils/logger';

/**
 * 스태프 QR 메타데이터 생성 또는 가져오기
 */
export async function getOrCreateStaffQR(
  userId: string,
  userName: string
): Promise<StaffQRMetadata> {
  try {
    const qrRef = doc(db, 'users', userId, 'qrMetadata', 'primary');
    const qrDoc = await getDoc(qrRef);

    if (qrDoc.exists()) {
      return qrDoc.data() as StaffQRMetadata;
    }

    // 신규 생성
    const newMetadata: StaffQRMetadata = {
      securityCode: uuidv4(),
      createdAt: Timestamp.now(),
      regenerationCount: 0,
      totalScanCount: 0,
    };

    await setDoc(qrRef, newMetadata);

    logger.info('스태프 QR 생성 완료', { data: { userId, userName } });

    return newMetadata;
  } catch (error) {
    logger.error('스태프 QR 생성 실패', error as Error, { data: { userId } });
    throw error;
  }
}

/**
 * 스태프 QR 재생성
 */
export async function regenerateStaffQR(userId: string): Promise<StaffQRMetadata> {
  try {
    const qrRef = doc(db, 'users', userId, 'qrMetadata', 'primary');
    const currentDoc = await getDoc(qrRef);

    const currentCount = currentDoc.exists()
      ? (currentDoc.data() as StaffQRMetadata).regenerationCount
      : 0;

    const newMetadata: Partial<StaffQRMetadata> = {
      securityCode: uuidv4(),
      lastRegeneratedAt: Timestamp.now(),
      regenerationCount: currentCount + 1,
    };

    await updateDoc(qrRef, newMetadata);

    logger.info('스태프 QR 재생성 완료', { data: { userId, newCount: currentCount + 1 } });

    const updatedDoc = await getDoc(qrRef);
    return updatedDoc.data() as StaffQRMetadata;
  } catch (error) {
    logger.error('스태프 QR 재생성 실패', error as Error, { userId });
    throw error;
  }
}

/**
 * 동적 QR 페이로드 생성 (3분 만료)
 */
export function generateDynamicQRPayload(staffId: string, securityCode: string): StaffQRPayload {
  return {
    type: 'staff-attendance',
    version: '2.0',
    staffId,
    securityCode,
    generatedAt: Date.now(),
  };
}

/**
 * QR 페이로드 검증
 */
export function validateQRPayload(
  payload: StaffQRPayload,
  storedMetadata: StaffQRMetadata
): { isValid: boolean; error?: string } {
  // 타입 검증
  if (payload.type !== 'staff-attendance') {
    return { isValid: false, error: '올바른 출석 QR이 아닙니다.' };
  }

  // 버전 검증
  if (payload.version !== '2.0') {
    return { isValid: false, error: '지원하지 않는 QR 버전입니다.' };
  }

  // 보안 코드 검증
  if (payload.securityCode !== storedMetadata.securityCode) {
    return { isValid: false, error: '유효하지 않은 QR 코드입니다.' };
  }

  // 시간 만료 검증 (3분)
  const elapsedMinutes = (Date.now() - payload.generatedAt) / 1000 / 60;
  if (elapsedMinutes > 3) {
    return { isValid: false, error: 'QR 코드가 만료되었습니다. (3분 제한)' };
  }

  return { isValid: true };
}
