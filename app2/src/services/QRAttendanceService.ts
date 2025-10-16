/**
 * QR 출석 관리 서비스
 *
 * @version 1.0
 * @since 2025-01-16
 * @author T-HOLDEM Development Team
 *
 * 주요 기능:
 * - 일별 QR 시드 초기화
 * - 출근/퇴근 QR 스캔 처리
 * - 토큰 유효성 검증
 * - 중복 사용 방지
 * - 라운드업 시간 계산
 */

import {
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  Timestamp,
  getDocs,
  query,
  where
} from 'firebase/firestore';
import { db } from '../firebase';
import { logger } from '../utils/logger';
import {
  generateSeed,
  validateQRToken,
  roundUpTimestamp
} from '../utils/qrTokenGenerator';
import type {
  EventQRSeed,
  UsedToken,
  QRAttendanceResult,
  QRScanOptions
} from '../types/qrAttendance';
import type { UnifiedWorkLog } from '../types/unified/workLog';

/**
 * 일별 QR 시드 초기화
 *
 * @param eventId 공고(이벤트) ID
 * @param date 날짜 (YYYY-MM-DD 형식)
 * @param createdBy 생성자 ID
 * @param roundUpInterval 라운드업 간격 (15 또는 30분)
 * @returns 생성된 시드
 *
 * @description
 * - 이미 시드가 존재하면 기존 시드 반환
 * - 새로 생성 시 다음날 00:00에 만료되도록 설정
 */
export async function initializeDailyQRSeed(
  eventId: string,
  date: string,
  createdBy: string,
  roundUpInterval: 15 | 30 = 30
): Promise<EventQRSeed> {
  try {
    const seedId = `${eventId}_${date}`;
    const seedRef = doc(db, 'eventQRSeeds', seedId);

    // 기존 시드 확인
    const seedDoc = await getDoc(seedRef);

    if (seedDoc.exists()) {
      const existingSeed = seedDoc.data() as EventQRSeed;
      logger.info('기존 QR 시드 사용', { eventId, date });
      return existingSeed;
    }

    // 새 시드 생성
    const seed = generateSeed();
    const now = Timestamp.now();

    // 다음날 00:00 계산
    const expiryDate = new Date(date);
    expiryDate.setDate(expiryDate.getDate() + 1);
    expiryDate.setHours(0, 0, 0, 0);
    const expiresAt = Timestamp.fromDate(expiryDate);

    const newSeed: EventQRSeed = {
      eventId,
      date,
      seed,
      roundUpInterval,
      createdAt: now,
      createdBy,
      expiresAt
    };

    await setDoc(seedRef, newSeed);
    logger.info('새 QR 시드 생성', { data: { eventId, date, roundUpInterval } });

    return newSeed;
  } catch (error) {
    logger.error('QR 시드 초기화 실패', error as Error, { data: { eventId, date } });
    throw new Error('QR 시드 초기화에 실패했습니다.');
  }
}

/**
 * QR 시드 가져오기
 *
 * @param eventId 공고(이벤트) ID
 * @param date 날짜 (YYYY-MM-DD 형식)
 * @returns QR 시드 또는 null
 */
export async function getQRSeed(
  eventId: string,
  date: string
): Promise<EventQRSeed | null> {
  try {
    const seedId = `${eventId}_${date}`;
    const seedRef = doc(db, 'eventQRSeeds', seedId);
    const seedDoc = await getDoc(seedRef);

    if (!seedDoc.exists()) {
      logger.warn('QR 시드가 존재하지 않습니다', { data: { eventId, date } });
      return null;
    }

    return seedDoc.data() as EventQRSeed;
  } catch (error) {
    logger.error('QR 시드 가져오기 실패', error as Error, { data: { eventId, date } });
    return null;
  }
}

/**
 * 토큰 사용 여부 확인
 *
 * @param token 토큰
 * @returns 사용 여부
 */
async function isTokenUsed(token: string): Promise<boolean> {
  try {
    const tokenRef = doc(db, 'usedTokens', token);
    const tokenDoc = await getDoc(tokenRef);
    return tokenDoc.exists();
  } catch (error) {
    logger.error('토큰 사용 여부 확인 실패', error as Error, { data: { token } });
    return false;
  }
}

/**
 * 토큰 사용 기록
 *
 * @param token 토큰
 * @param eventId 공고(이벤트) ID
 * @param date 날짜
 * @param type QR 타입
 * @param staffId 스태프 ID
 */
async function markTokenAsUsed(
  token: string,
  eventId: string,
  date: string,
  type: 'check-in' | 'check-out',
  staffId: string
): Promise<void> {
  try {
    const now = Timestamp.now();
    const expiresAt = Timestamp.fromMillis(now.toMillis() + 2 * 60 * 1000); // 2분 후

    const usedToken: UsedToken = {
      token,
      eventId,
      date,
      type,
      staffId,
      usedAt: now,
      expiresAt
    };

    await setDoc(doc(db, 'usedTokens', token), usedToken);
    logger.info('토큰 사용 기록', { data: { token, staffId, type } });
  } catch (error) {
    logger.error('토큰 사용 기록 실패', error as Error, { data: { token, staffId } });
    throw new Error('토큰 사용 기록에 실패했습니다.');
  }
}

/**
 * 스태프의 WorkLog 찾기
 *
 * @param staffId 스태프 ID
 * @param eventId 공고(이벤트) ID
 * @param date 날짜 (YYYY-MM-DD 형식)
 * @returns WorkLog 또는 null
 */
async function findWorkLog(
  staffId: string,
  eventId: string,
  date: string
): Promise<UnifiedWorkLog | null> {
  try {
    const workLogsRef = collection(db, 'workLogs');
    const q = query(
      workLogsRef,
      where('staffId', '==', staffId),
      where('eventId', '==', eventId),
      where('date', '==', date)
    );

    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      logger.warn('WorkLog를 찾을 수 없습니다', { staffId, eventId, date });
      return null;
    }

    const workLogDoc = querySnapshot.docs[0];
    if (!workLogDoc) {
      return null;
    }

    return {
      id: workLogDoc.id,
      ...workLogDoc.data()
    } as UnifiedWorkLog;
  } catch (error) {
    logger.error('WorkLog 조회 실패', error as Error, { staffId, eventId, date });
    return null;
  }
}

/**
 * 출근 QR 처리
 *
 * @param options 스캔 옵션
 * @returns 처리 결과
 *
 * @description
 * 1. 토큰 유효성 검증
 * 2. 중복 사용 확인
 * 3. WorkLog 업데이트 (actualStartTime, status, qrCheckIn)
 * 4. scheduledStartTime은 변경하지 않음 (지각 감지용)
 */
export async function handleCheckInQR(
  options: QRScanOptions
): Promise<QRAttendanceResult> {
  const { payload, staffId, scannedAt = Timestamp.now() } = options;
  const { eventId, date, type, token } = payload;

  try {
    // 1. 타입 검증
    if (type !== 'check-in') {
      return {
        success: false,
        message: '출근용 QR 코드가 아닙니다.'
      };
    }

    // 2. 시드 가져오기
    const seedData = await getQRSeed(eventId, date);
    if (!seedData) {
      return {
        success: false,
        message: 'QR 코드 정보를 찾을 수 없습니다.'
      };
    }

    // 3. 토큰 유효성 검증
    const validation = validateQRToken(
      token,
      eventId,
      date,
      type,
      seedData.seed,
      scannedAt.toMillis(),
      2 // 2분 유효성 윈도우
    );

    if (!validation.isValid) {
      return {
        success: false,
        message: validation.error || '유효하지 않은 QR 코드입니다.'
      };
    }

    // 4. 중복 사용 확인
    const used = await isTokenUsed(token);
    if (used) {
      return {
        success: false,
        message: '이미 사용된 QR 코드입니다.'
      };
    }

    // 5. WorkLog 찾기
    const workLog = await findWorkLog(staffId, eventId, date);
    if (!workLog) {
      return {
        success: false,
        message: '근무 기록을 찾을 수 없습니다. 관리자에게 문의하세요.'
      };
    }

    // 6. 이미 출근한 경우
    if (workLog.status === 'checked_in' || workLog.status === 'checked_out') {
      return {
        success: false,
        message: '이미 출근 처리되었습니다.'
      };
    }

    // 7. WorkLog 업데이트
    const workLogRef = doc(db, 'workLogs', workLog.id);
    await updateDoc(workLogRef, {
      actualStartTime: scannedAt,
      status: 'checked_in',
      qrCheckIn: {
        token,
        scannedAt
      },
      updatedAt: Timestamp.now()
    });

    // 8. 토큰 사용 기록
    await markTokenAsUsed(token, eventId, date, type, staffId);

    logger.info('출근 처리 완료', { staffId, eventId, date });

    return {
      success: true,
      message: '출근이 완료되었습니다.',
      workLogId: workLog.id,
      actualTime: scannedAt
    };
  } catch (error) {
    logger.error('출근 QR 처리 실패', error as Error, { staffId, eventId, date });
    return {
      success: false,
      message: '출근 처리 중 오류가 발생했습니다.'
    };
  }
}

/**
 * 퇴근 QR 처리
 *
 * @param options 스캔 옵션
 * @returns 처리 결과
 *
 * @description
 * 1. 토큰 유효성 검증
 * 2. 중복 사용 확인
 * 3. WorkLog 업데이트 (actualEndTime, status, qrCheckOut)
 * 4. scheduledEndTime 라운드업 (15분 또는 30분 간격)
 * 5. originalScheduledEndTime 보존
 */
export async function handleCheckOutQR(
  options: QRScanOptions
): Promise<QRAttendanceResult> {
  const { payload, staffId, scannedAt = Timestamp.now() } = options;
  const { eventId, date, type, token } = payload;

  try {
    // 1. 타입 검증
    if (type !== 'check-out') {
      return {
        success: false,
        message: '퇴근용 QR 코드가 아닙니다.'
      };
    }

    // 2. 시드 가져오기
    const seedData = await getQRSeed(eventId, date);
    if (!seedData) {
      return {
        success: false,
        message: 'QR 코드 정보를 찾을 수 없습니다.'
      };
    }

    // 3. 토큰 유효성 검증
    const validation = validateQRToken(
      token,
      eventId,
      date,
      type,
      seedData.seed,
      scannedAt.toMillis(),
      2 // 2분 유효성 윈도우
    );

    if (!validation.isValid) {
      return {
        success: false,
        message: validation.error || '유효하지 않은 QR 코드입니다.'
      };
    }

    // 4. 중복 사용 확인
    const used = await isTokenUsed(token);
    if (used) {
      return {
        success: false,
        message: '이미 사용된 QR 코드입니다.'
      };
    }

    // 5. WorkLog 찾기
    const workLog = await findWorkLog(staffId, eventId, date);
    if (!workLog) {
      return {
        success: false,
        message: '근무 기록을 찾을 수 없습니다. 관리자에게 문의하세요.'
      };
    }

    // 6. 출근하지 않은 경우
    if (workLog.status !== 'checked_in') {
      // 이미 퇴근했거나 아직 출근하지 않은 경우
      if (workLog.status === 'checked_out') {
        return {
          success: false,
          message: '이미 퇴근 처리되었습니다.'
        };
      }
      return {
        success: false,
        message: '먼저 출근 처리를 해주세요.'
      };
    }

    // 8. 라운드업 간격 (시드 설정 또는 기본값 30분)
    const roundUpInterval = seedData.roundUpInterval || 30;

    // 9. scheduledEndTime 라운드업 계산
    const roundedEndTime = roundUpTimestamp(
      scannedAt.toMillis(),
      roundUpInterval
    );
    const adjustedScheduledEndTime = Timestamp.fromMillis(roundedEndTime);

    // 10. WorkLog 업데이트
    const workLogRef = doc(db, 'workLogs', workLog.id);
    const updateData: Partial<UnifiedWorkLog> = {
      actualEndTime: scannedAt,
      status: 'checked_out',
      qrCheckOut: {
        token,
        scannedAt
      },
      updatedAt: Timestamp.now()
    };

    // originalScheduledEndTime 보존 (처음 퇴근 시에만)
    if (!workLog.originalScheduledEndTime && workLog.scheduledEndTime) {
      updateData.originalScheduledEndTime = workLog.scheduledEndTime;
    }

    // scheduledEndTime 라운드업
    updateData.scheduledEndTime = adjustedScheduledEndTime;

    await updateDoc(workLogRef, updateData);

    // 11. 토큰 사용 기록
    await markTokenAsUsed(token, eventId, date, type, staffId);

    logger.info('퇴근 처리 완료', {
      data: {
        staffId,
        eventId,
        date,
        roundUpInterval,
        adjustedScheduledEndTime: adjustedScheduledEndTime.toDate()
      }
    });

    return {
      success: true,
      message: '퇴근이 완료되었습니다.',
      workLogId: workLog.id,
      actualTime: scannedAt,
      adjustedScheduledTime: adjustedScheduledEndTime
    };
  } catch (error) {
    logger.error('퇴근 QR 처리 실패', error as Error, { staffId, eventId, date });
    return {
      success: false,
      message: '퇴근 처리 중 오류가 발생했습니다.'
    };
  }
}
