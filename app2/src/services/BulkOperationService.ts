import { writeBatch, doc, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { logger } from '../utils/logger';
import { createWorkLogId, createWorkLog, SimpleWorkLogInput } from '../utils/workLogSimplified';
import { toISODateString } from '../utils/dateUtils';
import {
  handleFirebaseError,
  isPermissionDenied,
  FirebaseError,
} from '../utils/firebaseErrors';

interface StaffInfo {
  id: string;
  name: string;
  role?: string;  // 역할 추가
  assignedDate?: string;
  workLogId?: string;
}

interface BulkOperationResult {
  success: boolean;
  successCount: number;
  errorCount: number;
  errors: Array<{ staffId: string; error: Error }>;
}

export class BulkOperationService {
  /**
   * 일괄 시간 수정
   */
  static async bulkUpdateTime(
    staffList: StaffInfo[],
    eventId: string,
    startTime: Timestamp | null,
    endTime: Timestamp | null
  ): Promise<BulkOperationResult> {
    const batch = writeBatch(db);
    const now = Timestamp.now();
    const errors: Array<{ staffId: string; error: Error }> = [];
    let successCount = 0;

    try {
      for (const staff of staffList) {
        try {
          const dateString = staff.assignedDate || toISODateString(new Date()) || '';
          const workLogId = staff.workLogId || createWorkLogId(eventId, staff.id, dateString as string);
          const workLogRef = doc(db, 'workLogs', workLogId);

          const updateData: any = {
            updatedAt: now
          };

          if (startTime) {
            updateData.scheduledStartTime = startTime;
          }
          if (endTime) {
            updateData.scheduledEndTime = endTime;
          }

          // workLog가 없는 경우 새로 생성
          if (!staff.workLogId || staff.workLogId.startsWith('virtual_')) {
            // 시간을 HH:mm 형식으로 변환
            let timeSlot: string | null = null;
            if (startTime && endTime) {
              const startHours = startTime.toDate().getHours();
              const startMinutes = startTime.toDate().getMinutes();
              const endHours = endTime.toDate().getHours();
              const endMinutes = endTime.toDate().getMinutes();
              const startStr = `${String(startHours).padStart(2, '0')}:${String(startMinutes).padStart(2, '0')}`;
              const endStr = `${String(endHours).padStart(2, '0')}:${String(endMinutes).padStart(2, '0')}`;
              timeSlot = `${startStr}-${endStr}`;
            }
            
            const workLogInput: SimpleWorkLogInput = {
              eventId,
              staffId: staff.id,
              staffName: staff.name,
              role: staff.role || '',
              date: dateString as string,
              timeSlot
            };
            
            const newWorkLogData = createWorkLog(workLogInput);
            batch.set(workLogRef, newWorkLogData);
          } else {
            batch.update(workLogRef, updateData);
          }

          successCount++;
        } catch (error) {
          errors.push({
            staffId: staff.id,
            error: error instanceof Error ? error : new Error(String(error))
          });
          logger.error('스태프 시간 업데이트 실패', error instanceof Error ? error : new Error(String(error)), {
            component: 'BulkOperationService',
            data: { staffId: staff.id }
          });
        }
      }

      await batch.commit();

      return {
        success: errors.length === 0,
        successCount,
        errorCount: errors.length,
        errors
      };
    } catch (error) {
      // 🎯 Firebase Error Handling (Phase 3-2 Integration)
      if (isPermissionDenied(error)) {
        const permissionError = new Error('일괄 시간 수정 권한이 없습니다. 공고 작성자만 수정할 수 있습니다.');
        logger.error('일괄 시간 수정 권한 거부', permissionError, {
          component: 'BulkOperationService',
          data: { staffCount: staffList.length, eventId }
        });
        throw permissionError;
      }

      const message = handleFirebaseError(
        error as FirebaseError,
        {
          operation: 'bulkUpdateTime',
          staffCount: staffList.length,
          eventId,
          component: 'BulkOperationService',
        },
        'ko'
      );

      throw new Error(`일괄 시간 수정 실패: ${message}`);
    }
  }

  /**
   * 일괄 출석 상태 수정
   */
  static async bulkUpdateStatus(
    staffList: StaffInfo[],
    eventId: string,
    status: 'not_started' | 'checked_in' | 'checked_out' | 'absent'
  ): Promise<BulkOperationResult> {
    const batch = writeBatch(db);
    const now = Timestamp.now();
    const errors: Array<{ staffId: string; error: Error }> = [];
    let successCount = 0;

    try {
      for (const staff of staffList) {
        try {
          const dateString = staff.assignedDate || toISODateString(new Date()) || '';
          const workLogId = createWorkLogId(eventId, staff.id, dateString as string);
          const workLogRef = doc(db, 'workLogs', workLogId);

          const updateData: any = {
            status,
            updatedAt: now
          };

          // workLog가 없는 경우 새로 생성
          if (!staff.workLogId || staff.workLogId.startsWith('virtual_')) {
            const workLogInput: SimpleWorkLogInput = {
              eventId,
              staffId: staff.id,
              staffName: staff.name,
              role: staff.role || '',
              date: dateString as string,
              status: status as 'not_started' | 'checked_in' | 'completed' | 'absent'
            };
            
            const newWorkLogData = createWorkLog(workLogInput);
            batch.set(workLogRef, newWorkLogData);
          } else {
            batch.update(workLogRef, updateData);
          }

          successCount++;
        } catch (error) {
          errors.push({
            staffId: staff.id,
            error: error instanceof Error ? error : new Error(String(error))
          });
          logger.error('스태프 상태 업데이트 실패', error instanceof Error ? error : new Error(String(error)), {
            component: 'BulkOperationService',
            data: { staffId: staff.id }
          });
        }
      }

      await batch.commit();

      return {
        success: errors.length === 0,
        successCount,
        errorCount: errors.length,
        errors
      };
    } catch (error) {
      // 🎯 Firebase Error Handling (Phase 3-2 Integration)
      if (isPermissionDenied(error)) {
        const permissionError = new Error('일괄 상태 수정 권한이 없습니다. 공고 작성자만 수정할 수 있습니다.');
        logger.error('일괄 상태 수정 권한 거부', permissionError, {
          component: 'BulkOperationService',
          data: { staffCount: staffList.length, eventId, status }
        });
        throw permissionError;
      }

      const message = handleFirebaseError(
        error as FirebaseError,
        {
          operation: 'bulkUpdateStatus',
          staffCount: staffList.length,
          eventId,
          status,
          component: 'BulkOperationService',
        },
        'ko'
      );

      throw new Error(`일괄 상태 수정 실패: ${message}`);
    }
  }

  /**
   * 작업 결과 메시지 생성
   */
  static generateResultMessage(
    result: BulkOperationResult,
    operationType: 'time' | 'status',
    details?: any
  ): { type: 'success' | 'error'; message: string } {
    if (result.errorCount === 0) {
      let message = `✅ ${result.successCount}명의 `;
      
      if (operationType === 'time') {
        message += '근무 시간이 성공적으로 수정되었습니다.';
        if (details?.startTime || details?.endTime) {
          message += '\n';
          if (details.startTime) message += `출근: ${details.startTime}`;
          if (details.startTime && details.endTime) message += ' / ';
          if (details.endTime) message += `퇴근: ${details.endTime}`;
        }
      } else {
        const statusMap: Record<string, string> = {
          not_started: '출근 전',
          checked_in: '출근',
          checked_out: '퇴근'
        };
        const statusText = statusMap[details?.status || ''] || details?.status;
        message += `출석 상태가 "${statusText}"(으)로 변경되었습니다.`;
      }
      
      return { type: 'success', message };
    } else {
      const message = `⚠️ 일부 업데이트 실패\n성공: ${result.successCount}명 / 실패: ${result.errorCount}명`;
      return { type: 'error', message };
    }
  }
}