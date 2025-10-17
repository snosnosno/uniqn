/**
 * 스태프 QR 출석 스캔 처리 서비스
 *
 * @version 2.0
 * @since 2025-10-16
 * @author T-HOLDEM Development Team
 *
 * 주요 기능:
 * - QR 스캔 쿨다운 관리 (5분)
 * - WorkLog 찾기 (staffId + eventId + date)
 * - 스캔 이력 저장
 * - 출근/퇴근 처리 (라운드업 포함)
 */

import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  Timestamp,
  addDoc
} from 'firebase/firestore';
import { db } from '../firebase';
import {
  QRScanContext,
  ScanCooldown,
  ScanHistory,
  QRScanResult
} from '../types/staffQR';
import { UnifiedWorkLog } from '../types/unified/workLog';
import { ConfirmedStaff } from '../types/jobPosting/base';
import { normalizeDate } from '../utils/dateUtils';
import { roundUpTimestamp } from '../utils/timeUtils';
import { logger } from '../utils/logger';

/**
 * 스태프가 해당 공고에 확정되었는지 검증
 */
export async function checkStaffConfirmed(
  eventId: string,
  staffId: string
): Promise<{ isConfirmed: boolean; staffName?: string; role?: string }> {
  try {
    const jobPostingRef = doc(db, 'jobPostings', eventId);
    const jobPostingDoc = await getDoc(jobPostingRef);

    if (!jobPostingDoc.exists()) {
      logger.error('공고를 찾을 수 없음', undefined, { data: { eventId } });
      return { isConfirmed: false };
    }

    const jobPosting = jobPostingDoc.data();
    const confirmedStaff = (jobPosting.confirmedStaff || []) as ConfirmedStaff[];

    const staff = confirmedStaff.find((s: ConfirmedStaff) => s.userId === staffId);

    if (!staff) {
      logger.warn('확정되지 않은 스태프', {
        data: { staffId, eventId }
      });
      return { isConfirmed: false };
    }

    logger.info('스태프 확정 검증 성공', {
      data: {
        staffId,
        staffName: staff.name,
        role: staff.role,
        eventId
      }
    });

    return {
      isConfirmed: true,
      staffName: staff.name,
      role: staff.role
    };
  } catch (error) {
    logger.error('스태프 확정 검증 실패', error as Error, {
      data: { eventId, staffId }
    });
    return { isConfirmed: false };
  }
}

/**
 * 스캔 쿨다운 체크 (5분 중복 스캔 방지)
 */
export async function checkScanCooldown(
  staffId: string,
  eventId: string,
  date: string,
  mode: 'check-in' | 'check-out'
): Promise<{ allowed: boolean; remainingSeconds?: number }> {
  try {
    const cooldownKey = `${staffId}_${eventId}_${date}_${mode}`;
    const cooldownRef = doc(db, 'scanCooldowns', cooldownKey);
    const cooldownDoc = await getDoc(cooldownRef);

    if (!cooldownDoc.exists()) {
      return { allowed: true };
    }

    const cooldown = cooldownDoc.data() as ScanCooldown;
    const now = Timestamp.now();

    // 만료 시간 체크
    if (now.toMillis() > cooldown.expiresAt.toMillis()) {
      return { allowed: true };
    }

    // 남은 시간 계산
    const remainingMs = cooldown.expiresAt.toMillis() - now.toMillis();
    const remainingSeconds = Math.ceil(remainingMs / 1000);

    logger.warn('스캔 쿨다운 활성', {
      data: {
        staffId,
        eventId,
        mode,
        remainingSeconds
      }
    });

    return { allowed: false, remainingSeconds };
  } catch (error) {
    logger.error('스캔 쿨다운 체크 실패', error as Error, {
      data: {
        staffId,
        eventId,
        mode
      }
    });
    // 에러 시 스캔 허용 (안전장치)
    return { allowed: true };
  }
}

/**
 * 스캔 쿨다운 설정 (5분)
 */
async function setScanCooldown(
  staffId: string,
  eventId: string,
  date: string,
  mode: 'check-in' | 'check-out'
): Promise<void> {
  try {
    const cooldownKey = `${staffId}_${eventId}_${date}_${mode}`;
    const cooldownRef = doc(db, 'scanCooldowns', cooldownKey);

    const now = Timestamp.now();
    const expiresAt = Timestamp.fromMillis(now.toMillis() + 5 * 60 * 1000); // 5분

    const cooldown: ScanCooldown = {
      key: cooldownKey,
      staffId,
      eventId,
      date,
      mode,
      lastScanAt: now,
      expiresAt
    };

    await setDoc(cooldownRef, cooldown);

    logger.debug('스캔 쿨다운 설정 완료', {
      data: {
        staffId,
        eventId,
        mode,
        expiresAt: expiresAt.toDate().toISOString()
      }
    });
  } catch (error) {
    logger.error('스캔 쿨다운 설정 실패', error as Error, {
      data: {
        staffId,
        eventId,
        mode
      }
    });
    // 쿨다운 설정 실패는 치명적이지 않으므로 throw하지 않음
  }
}

/**
 * WorkLog 찾기 (staffId + eventId + date)
 * 배정 인덱스 패턴 지원 (staffId_0, staffId_1 등)
 */
export async function findWorkLog(
  staffId: string,
  eventId: string,
  date: string
): Promise<UnifiedWorkLog | null> {
  try {
    const normalizedDate = normalizeDate(date);

    if (!normalizedDate) {
      logger.error('유효하지 않은 날짜 형식', undefined, { data: { date } });
      return null;
    }

    logger.debug('WorkLog 검색 시작', {
      data: {
        staffId,
        eventId,
        date: normalizedDate
      }
    });

    const workLogsRef = collection(db, 'workLogs');

    // 1차 시도: 정확한 staffId로 검색
    let q = query(
      workLogsRef,
      where('staffId', '==', staffId),
      where('eventId', '==', eventId),
      where('date', '==', normalizedDate)
    );

    let querySnapshot = await getDocs(q);

    // 2차 시도: staffId에 _0 접미사 추가하여 검색 (배정 인덱스 패턴)
    if (querySnapshot.empty && !staffId.match(/_\d+$/)) {
      logger.debug('배정 인덱스 패턴으로 재검색', {
        data: { staffId: `${staffId}_0`, eventId, date: normalizedDate }
      });

      q = query(
        workLogsRef,
        where('staffId', '==', `${staffId}_0`),
        where('eventId', '==', eventId),
        where('date', '==', normalizedDate)
      );

      querySnapshot = await getDocs(q);
    }

    // 3차 시도: userId 필드로 검색 (fallback)
    if (querySnapshot.empty) {
      logger.debug('userId 필드로 재검색', {
        data: { userId: staffId, eventId, date: normalizedDate }
      });

      q = query(
        workLogsRef,
        where('userId', '==', staffId),
        where('eventId', '==', eventId),
        where('date', '==', normalizedDate)
      );

      querySnapshot = await getDocs(q);
    }

    if (querySnapshot.empty) {
      logger.warn('WorkLog를 찾을 수 없음', {
        data: {
          staffId,
          eventId,
          date: normalizedDate
        }
      });
      return null;
    }

    if (querySnapshot.docs.length > 1) {
      logger.warn('다중 WorkLog 발견 - 첫 번째 항목 사용', {
        data: {
          staffId,
          eventId,
          date: normalizedDate,
          count: querySnapshot.docs.length,
          workLogIds: querySnapshot.docs.map(doc => doc.id)
        }
      });
    }

    const workLogDoc = querySnapshot.docs[0];
    if (!workLogDoc) {
      logger.error('WorkLog 문서를 찾을 수 없음', undefined, { data: { staffId, eventId, date: normalizedDate } });
      return null;
    }

    const workLog = {
      id: workLogDoc.id,
      ...workLogDoc.data()
    } as UnifiedWorkLog;

    logger.info('WorkLog 찾기 성공', {
      data: {
        staffId,
        eventId,
        workLogId: workLog.id
      }
    });

    return workLog;
  } catch (error) {
    logger.error('WorkLog 검색 실패', error as Error, {
      data: {
        staffId,
        eventId,
        date
      }
    });
    return null;
  }
}

/**
 * 스캔 이력 저장
 */
export async function saveScanHistory(
  staffId: string,
  staffName: string,
  eventId: string,
  date: string,
  mode: 'check-in' | 'check-out',
  workLogId: string,
  scannedBy: string,
  location?: { lat: number; lng: number }
): Promise<void> {
  try {
    const scanHistoryRef = collection(db, 'scanHistory');

    const history: Omit<ScanHistory, 'id'> = {
      staffId,
      staffName,
      eventId,
      date,
      mode,
      scannedAt: Timestamp.now(),
      workLogId,
      scannedBy,
      ...(location && { location })
    };

    await addDoc(scanHistoryRef, history);

    logger.info('스캔 이력 저장 완료', {
      data: {
        staffId,
        staffName,
        eventId,
        mode,
        workLogId
      }
    });
  } catch (error) {
    logger.error('스캔 이력 저장 실패', error as Error, {
      data: {
        staffId,
        eventId,
        mode,
        workLogId
      }
    });
    // 이력 저장 실패는 치명적이지 않으므로 throw하지 않음
  }
}

/**
 * QR 메타데이터 업데이트 (마지막 사용 시간, 총 스캔 횟수)
 */
async function updateQRMetadata(staffId: string): Promise<void> {
  try {
    const qrMetadataRef = doc(db, 'users', staffId, 'qrMetadata', 'primary');
    const qrMetadataDoc = await getDoc(qrMetadataRef);

    if (!qrMetadataDoc.exists()) {
      logger.warn('QR 메타데이터를 찾을 수 없음', { data: { staffId } });
      return;
    }

    const currentCount = qrMetadataDoc.data().totalScanCount || 0;

    await updateDoc(qrMetadataRef, {
      lastUsedAt: Timestamp.now(),
      totalScanCount: currentCount + 1
    });

    logger.debug('QR 메타데이터 업데이트 완료', {
      data: {
        staffId,
        newCount: currentCount + 1
      }
    });
  } catch (error) {
    logger.error('QR 메타데이터 업데이트 실패', error as Error, { data: { staffId } });
    // 메타데이터 업데이트 실패는 치명적이지 않으므로 throw하지 않음
  }
}

/**
 * 출근 처리
 */
export async function handleCheckIn(
  context: QRScanContext,
  staffId: string,
  staffName: string
): Promise<QRScanResult> {
  try {
    logger.info('출근 처리 시작', {
      data: {
        staffId,
        staffName,
        eventId: context.eventId,
        date: context.date
      }
    });

    // 1. 스태프 확정 검증
    const confirmCheck = await checkStaffConfirmed(context.eventId, staffId);

    if (!confirmCheck.isConfirmed) {
      return {
        success: false,
        message: '이 공고에 확정된 스태프가 아닙니다.'
      };
    }

    // staffName 업데이트
    if (confirmCheck.staffName) {
      staffName = confirmCheck.staffName;
    }

    // 2. 쿨다운 체크
    const cooldownCheck = await checkScanCooldown(
      staffId,
      context.eventId,
      context.date,
      'check-in'
    );

    if (!cooldownCheck.allowed) {
      return {
        success: false,
        message: `${cooldownCheck.remainingSeconds}초 후에 다시 시도해주세요.`,
        ...(cooldownCheck.remainingSeconds !== undefined && { remainingCooldown: cooldownCheck.remainingSeconds })
      };
    }

    // 3. WorkLog 찾기
    const workLog = await findWorkLog(staffId, context.eventId, context.date);

    if (!workLog) {
      return {
        success: false,
        message: '오늘 근무 일정이 없습니다.'
      };
    }

    // 4. 상태 검증
    if (workLog.status === 'checked_in') {
      return {
        success: false,
        message: '이미 출근 처리되었습니다.'
      };
    }

    if (workLog.status === 'checked_out' || workLog.status === 'completed') {
      return {
        success: false,
        message: '이미 퇴근한 근무입니다.'
      };
    }

    if (workLog.status === 'cancelled') {
      return {
        success: false,
        message: '취소된 근무입니다.'
      };
    }

    // 5. 출근 시간 기록
    const now = Timestamp.now();
    const workLogRef = doc(db, 'workLogs', workLog.id);

    await updateDoc(workLogRef, {
      actualStartTime: now,
      status: 'checked_in',
      qrCheckIn: {
        token: `${staffId}_${Date.now()}`,
        scannedAt: now
      },
      updatedAt: now
    });

    // 6. 쿨다운 설정
    await setScanCooldown(staffId, context.eventId, context.date, 'check-in');

    // 7. 스캔 이력 저장
    await saveScanHistory(
      staffId,
      staffName,
      context.eventId,
      context.date,
      'check-in',
      workLog.id,
      context.activatedBy,
      context.location
    );

    // 8. QR 메타데이터 업데이트
    await updateQRMetadata(staffId);

    logger.info('출근 처리 완료', {
      data: {
        staffId,
        staffName,
        workLogId: workLog.id,
        actualTime: now.toDate().toISOString()
      }
    });

    return {
      success: true,
      message: '출근 처리가 완료되었습니다.',
      workLogId: workLog.id,
      actualTime: now,
      staffName
    };
  } catch (error) {
    logger.error('출근 처리 실패', error as Error, {
      data: {
        staffId,
        eventId: context.eventId
      }
    });

    return {
      success: false,
      message: '출근 처리 중 오류가 발생했습니다.'
    };
  }
}

/**
 * 퇴근 처리 (라운드업 포함)
 */
export async function handleCheckOut(
  context: QRScanContext,
  staffId: string,
  staffName: string
): Promise<QRScanResult> {
  try {
    logger.info('퇴근 처리 시작', {
      data: {
        staffId,
        staffName,
        eventId: context.eventId,
        date: context.date,
        roundUpInterval: context.roundUpInterval
      }
    });

    // 1. 스태프 확정 검증
    const confirmCheck = await checkStaffConfirmed(context.eventId, staffId);

    if (!confirmCheck.isConfirmed) {
      return {
        success: false,
        message: '이 공고에 확정된 스태프가 아닙니다.'
      };
    }

    // staffName 업데이트
    if (confirmCheck.staffName) {
      staffName = confirmCheck.staffName;
    }

    // 2. 쿨다운 체크
    const cooldownCheck = await checkScanCooldown(
      staffId,
      context.eventId,
      context.date,
      'check-out'
    );

    if (!cooldownCheck.allowed) {
      return {
        success: false,
        message: `${cooldownCheck.remainingSeconds}초 후에 다시 시도해주세요.`,
        ...(cooldownCheck.remainingSeconds !== undefined && { remainingCooldown: cooldownCheck.remainingSeconds })
      };
    }

    // 3. WorkLog 찾기
    const workLog = await findWorkLog(staffId, context.eventId, context.date);

    if (!workLog) {
      return {
        success: false,
        message: '오늘 근무 일정이 없습니다.'
      };
    }

    // 4. 상태 검증
    if (workLog.status !== 'checked_in') {
      return {
        success: false,
        message: '출근 처리가 되지 않았습니다.'
      };
    }

    // 5. 퇴근 시간 계산 (라운드업)
    const now = Timestamp.now();
    const roundedTimestamp = roundUpTimestamp(
      now.toMillis(),
      context.roundUpInterval
    );
    const adjustedScheduledEndTime = Timestamp.fromMillis(roundedTimestamp);

    // 6. 퇴근 시간 기록
    const workLogRef = doc(db, 'workLogs', workLog.id);

    await updateDoc(workLogRef, {
      actualEndTime: now,
      originalScheduledEndTime: workLog.scheduledEndTime, // 원본 보존
      scheduledEndTime: adjustedScheduledEndTime, // 라운드업된 시간
      status: 'checked_out',
      qrCheckOut: {
        token: `${staffId}_${Date.now()}`,
        scannedAt: now
      },
      updatedAt: now
    });

    // 7. 쿨다운 설정
    await setScanCooldown(staffId, context.eventId, context.date, 'check-out');

    // 8. 스캔 이력 저장
    await saveScanHistory(
      staffId,
      staffName,
      context.eventId,
      context.date,
      'check-out',
      workLog.id,
      context.activatedBy,
      context.location
    );

    // 9. QR 메타데이터 업데이트
    await updateQRMetadata(staffId);

    logger.info('퇴근 처리 완료', {
      data: {
        staffId,
        staffName,
        workLogId: workLog.id,
        actualTime: now.toDate().toISOString(),
        adjustedTime: adjustedScheduledEndTime.toDate().toISOString(),
        roundUpInterval: context.roundUpInterval
      }
    });

    return {
      success: true,
      message: '퇴근 처리가 완료되었습니다.',
      workLogId: workLog.id,
      actualTime: now,
      adjustedScheduledTime: adjustedScheduledEndTime,
      staffName
    };
  } catch (error) {
    logger.error('퇴근 처리 실패', error as Error, {
      data: {
        staffId,
        eventId: context.eventId
      }
    });

    return {
      success: false,
      message: '퇴근 처리 중 오류가 발생했습니다.'
    };
  }
}
