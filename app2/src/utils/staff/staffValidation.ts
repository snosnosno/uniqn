/**
 * staffValidation.ts
 * 스태프 삭제 가능 여부 검증 로직
 *
 * @version 1.0
 * @since 2025-02-04
 */

import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../firebase';
import { logger } from '../logger';

export interface ValidationResult {
  canDelete: boolean;
  reason?: string;
}

/**
 * 스태프 삭제 가능 조건 검증
 *
 * 삭제 불가 조건:
 * 1. WorkLog 상태가 checked_in, checked_out, completed, cancelled
 * 2. 급여가 이미 지급됨 (isPaid = true)
 * 3. AttendanceRecord 상태가 checked_in, checked_out
 *
 * @param eventId 공고 ID
 * @param staffId 스태프 ID
 * @param date 근무 날짜
 * @returns 삭제 가능 여부 및 불가 사유
 */
export async function canDeleteStaff(
  eventId: string,
  staffId: string,
  date: string
): Promise<ValidationResult> {
  try {
    // 1. WorkLog 상태 확인
    const workLogQuery = query(
      collection(db, 'workLogs'),
      where('eventId', '==', eventId),
      where('staffId', '==', staffId),
      where('date', '==', date)
    );

    const workLogSnapshot = await getDocs(workLogQuery);
    if (!workLogSnapshot.empty) {
      const workLogDoc = workLogSnapshot.docs[0];
      const workLogData = workLogDoc?.data();
      const status = workLogData?.status;

      // 2. 삭제 가능 상태 체크
      const deletableStatuses = ['scheduled', 'not_started'];
      if (status && !deletableStatuses.includes(status)) {
        const statusMessages: Record<string, string> = {
          checked_in: '이미 출근한 스태프는 삭제할 수 없습니다.',
          checked_out: '퇴근 처리된 스태프는 삭제할 수 없습니다.',
          completed: '근무 완료된 스태프는 삭제할 수 없습니다.',
          cancelled: '이미 취소된 스태프입니다.',
        };
        return {
          canDelete: false,
          reason: statusMessages[status] || '삭제할 수 없는 상태입니다.',
        };
      }

      // 3. 급여 지급 확인
      if (workLogData?.isPaid) {
        return {
          canDelete: false,
          reason: '급여가 지급된 스태프는 삭제할 수 없습니다.',
        };
      }
    }

    // 4. AttendanceRecord 확인
    const attendanceQuery = query(
      collection(db, 'attendanceRecords'),
      where('eventId', '==', eventId),
      where('staffId', '==', staffId),
      where('date', '==', date)
    );

    const attendanceSnapshot = await getDocs(attendanceQuery);
    if (!attendanceSnapshot.empty) {
      const hasActiveAttendance = attendanceSnapshot.docs.some((doc) => {
        const data = doc.data();
        return data.status === 'checked_in' || data.status === 'checked_out';
      });

      if (hasActiveAttendance) {
        return {
          canDelete: false,
          reason: '출퇴근 기록이 있는 스태프는 삭제할 수 없습니다.',
        };
      }
    }

    return { canDelete: true };
  } catch (error) {
    logger.error(
      '삭제 가능 여부 확인 실패',
      error instanceof Error ? error : new Error(String(error))
    );
    return {
      canDelete: false,
      reason: '삭제 가능 여부를 확인할 수 없습니다.',
    };
  }
}

/**
 * 여러 스태프의 삭제 가능 여부를 일괄 검증
 *
 * @param eventId 공고 ID
 * @param staffList 스태프 목록 (staffId, date 포함)
 * @returns 삭제 가능한 스태프와 불가능한 스태프 목록
 */
export async function validateBulkDelete(
  eventId: string,
  staffList: Array<{ staffId: string; staffName: string; date: string }>
): Promise<{
  deletable: Array<{ staffId: string; staffName: string; date: string }>;
  nonDeletable: Array<{ staffId: string; staffName: string; reason: string }>;
}> {
  const deletable: Array<{ staffId: string; staffName: string; date: string }> = [];
  const nonDeletable: Array<{
    staffId: string;
    staffName: string;
    reason: string;
  }> = [];

  for (const { staffId, staffName, date } of staffList) {
    if (!date) {
      nonDeletable.push({
        staffId,
        staffName,
        reason: '날짜 정보가 없습니다',
      });
      continue;
    }

    const { canDelete, reason } = await canDeleteStaff(eventId, staffId, date);
    if (canDelete) {
      deletable.push({ staffId, staffName, date });
    } else {
      nonDeletable.push({
        staffId,
        staffName,
        reason: reason || '알 수 없는 이유',
      });
    }
  }

  return { deletable, nonDeletable };
}
