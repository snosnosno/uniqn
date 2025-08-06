import { writeBatch, doc, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { logger } from '../utils/logger';
import { generateWorkLogId, createWorkLogData } from '../utils/workLogUtils';

interface StaffInfo {
  id: string;
  name: string;
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
          const dateString = staff.assignedDate || new Date().toISOString().split('T')[0];
          const workLogId = staff.workLogId || generateWorkLogId(eventId, staff.id, dateString as string);
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
            const newWorkLogData = createWorkLogData({
              eventId,
              staffId: staff.id,
              staffName: staff.name,
              date: dateString as string,
              scheduledStartTime: startTime,
              scheduledEndTime: endTime
            });
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
      logger.error('일괄 시간 수정 실패', error instanceof Error ? error : new Error(String(error)), {
        component: 'BulkOperationService'
      });
      throw error;
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
          const dateString = staff.assignedDate || new Date().toISOString().split('T')[0];
          const workLogId = generateWorkLogId(eventId, staff.id, dateString as string);
          const workLogRef = doc(db, 'workLogs', workLogId);

          const updateData: any = {
            status,
            updatedAt: now
          };

          // workLog가 없는 경우 새로 생성
          if (!staff.workLogId || staff.workLogId.startsWith('virtual_')) {
            const newWorkLogData = createWorkLogData({
              eventId,
              staffId: staff.id,
              staffName: staff.name,
              date: dateString as string,
              status
            });
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
      logger.error('일괄 상태 수정 실패', error instanceof Error ? error : new Error(String(error)), {
        component: 'BulkOperationService'
      });
      throw error;
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
          checked_out: '퇴근',
          absent: '결근'
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