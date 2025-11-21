/**
 * useStaffActions.ts
 * 스태프 관리 액션 (삭제, 수정, 신고 등) 커스텀 훅
 *
 * @version 1.0
 * @since 2025-02-04
 */

import { useCallback } from 'react';
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
  deleteDoc,
  runTransaction,
} from 'firebase/firestore';
import { db } from '../../firebase';
import { toISODateString } from '../../utils/dateUtils';
import { logger } from '../../utils/logger';
import { useToast } from '../useToast';
import { getTodayString } from '../../utils/jobPosting/dateUtils';
import { createWorkLogId } from '../../utils/workLogSimplified';
import type { JobPosting } from '../../types/jobPosting/jobPosting';
import type { ConfirmedStaff } from '../../types/jobPosting/base';
import type { StaffData } from '../../utils/staff/staffDataTransformer';
import {
  canDeleteStaff as validateCanDeleteStaff,
  validateBulkDelete,
} from '../../utils/staff/staffValidation';
import { removeStaffIdDateSuffix } from '../../utils/staff/staffDataTransformer';
import {
  handleFirebaseError,
  isPermissionDenied,
  FirebaseError,
} from '../../utils/firebaseErrors';

export interface UseStaffActionsParams {
  jobPosting: JobPosting | null | undefined;
  staffData: StaffData[];
  canEdit: boolean;
  refresh: () => void;
}

export interface UseStaffActionsReturn {
  handleEditWorkTime: (
    staffId: string,
    timeType?: 'start' | 'end',
    targetDate?: string
  ) => Promise<any | null>;
  deleteStaff: (staffId: string, staffName: string, date: string) => Promise<void>;
  handleBulkDelete: (staffIds: string[]) => Promise<void>;
}

/**
 * 스태프 관리 액션 (삭제, 수정 등)
 *
 * @param params jobPosting, staffData, canEdit, refresh
 * @returns 액션 핸들러 함수들
 */
export function useStaffActions({
  jobPosting,
  staffData,
  canEdit,
  refresh,
}: UseStaffActionsParams): UseStaffActionsReturn {
  const { showError, showSuccess } = useToast();

  /**
   * 출퇴근 시간 수정 핸들러 (다중 날짜 지원)
   */
  const handleEditWorkTime = useCallback(
    async (
      staffId: string,
      timeType?: 'start' | 'end',
      targetDate?: string
    ): Promise<any | null> => {
      // 권한 체크
      if (!canEdit) {
        showError('이 공고를 수정할 권한이 없습니다.');
        return null;
      }

      const staff = staffData.find(s => s.id === staffId);
      if (!staff) {
        showError('스태프 정보를 찾을 수 없습니다.');
        return null;
      }

      // 대상 날짜 결정
      const workDate = targetDate || staff.assignedDate || getTodayString();

      // staffId에서 실제 ID 추출 (날짜 부분 제거)
      const actualStaffId = removeStaffIdDateSuffix(staffId);

      // Firebase에서 직접 최신 workLog 가져오기
      const workLogId = `${jobPosting?.id || 'default-event'}_${actualStaffId}_${workDate}`;
      const workLogRef = doc(db, 'workLogs', workLogId);

      try {
        const docSnap = await getDoc(workLogRef);

        if (docSnap.exists()) {
          // 실제 workLog가 있는 경우
          const data = docSnap.data();
          const workLogData = {
            ...data, // 모든 Firebase 데이터 포함 (Timestamp 객체 포함)
            id: workLogId,
            eventId: data.eventId || jobPosting?.id,
            staffId: data.staffId || actualStaffId,
            date: workDate,
            staffName: staff.name || data.staffName || '이름 미정',
            assignedRole: staff.assignedRole || data.assignedRole || '',
            role: data.role || staff.role || '',
          };
          return workLogData;
        } else {
          // 🚀 스태프 확정 시 사전 생성된 WorkLog를 찾아서 에러 메시지 표시
          logger.error(
            'WorkLog를 찾을 수 없습니다. 스태프 확정 시 사전 생성되어야 합니다.',
            new Error('WorkLog not found'),
            {
              component: 'useStaffActions',
              data: {
                staffId: actualStaffId,
                staffName: staff.name,
                workDate,
                expectedWorkLogId: workLogId,
              },
            }
          );

          showError(
            `${staff.name}님의 ${workDate} 근무 기록을 찾을 수 없습니다. 스태프 확정 시 자동 생성되어야 합니다.`
          );
          return null;
        }
      } catch (error) {
        // 🎯 Firebase Error Handling (Phase 3-2 Integration)
        if (isPermissionDenied(error)) {
          showError('근무 기록 조회 권한이 없습니다. 관리자에게 문의하세요.');
          return null;
        }

        const message = handleFirebaseError(
          error as FirebaseError,
          {
            operation: 'getWorkLog',
            staffId,
            workDate,
            component: 'useStaffActions',
          },
          'ko'
        );

        showError(`${staff.name}님의 근무 기록 조회 실패: ${message}`);
        return null;
      }
    },
    [canEdit, staffData, jobPosting?.id, showError]
  );

  /**
   * 스태프 삭제 핸들러 (Transaction 기반)
   */
  const deleteStaff = useCallback(
    async (staffId: string, staffName: string, date: string) => {
      try {
        if (!jobPosting?.id) {
          showError('공고 정보를 찾을 수 없습니다.');
          return;
        }

        // 1. 삭제 가능 여부 검증
        const { canDelete, reason } = await validateCanDeleteStaff(
          jobPosting.id,
          staffId,
          date
        );
        if (!canDelete) {
          showError(reason || '삭제할 수 없습니다.');
          return;
        }

        // 2. 삭제 전 인원 카운트 계산
        let staffRole = '';
        let staffTimeSlot = '';
        const baseStaffId = staffId.replace(/_\d+$/, '');

        if (jobPosting.confirmedStaff) {
          const targetStaff = jobPosting.confirmedStaff.find(
            (staff: ConfirmedStaff) =>
              staff.userId === baseStaffId && staff.date === date
          );
          staffRole = targetStaff?.role || '';
          staffTimeSlot = targetStaff?.timeSlot || '';
        }

        // 3. Transaction으로 원자적 처리
        await runTransaction(db, async transaction => {
          const jobPostingRef = doc(db, 'jobPostings', jobPosting.id);
          const jobPostingDoc = await transaction.get(jobPostingRef);

          if (!jobPostingDoc.exists()) {
            throw new Error('공고를 찾을 수 없습니다.');
          }

          const currentData = jobPostingDoc.data();
          const confirmedStaffArray = currentData?.confirmedStaff || [];

          // 해당 스태프의 해당 날짜 항목만 필터링
          const filteredConfirmedStaff = confirmedStaffArray.filter(
            (staff: ConfirmedStaff) => {
              const staffUserId = staff.userId;
              return !(staffUserId === baseStaffId && staff.date === date);
            }
          );

          transaction.update(jobPostingRef, {
            confirmedStaff: filteredConfirmedStaff,
          });

          const removedCount =
            confirmedStaffArray.length - filteredConfirmedStaff.length;
          logger.info(
            `confirmedStaff에서 제거: staffId=${staffId} (base: ${baseStaffId}), date=${date}, removed: ${removedCount}`,
            {
              component: 'useStaffActions',
            }
          );
        });

        // 4. WorkLog 삭제 (scheduled/not_started만)
        const workLogQuery = query(
          collection(db, 'workLogs'),
          where('eventId', '==', jobPosting.id),
          where('staffId', '==', staffId),
          where('date', '==', date),
          where('status', 'in', ['scheduled', 'not_started'])
        );

        const workLogSnapshot = await getDocs(workLogQuery);
        for (const workLogDoc of workLogSnapshot.docs) {
          await deleteDoc(workLogDoc.ref);
          logger.info(`WorkLog 삭제: ${workLogDoc.id}`, {
            component: 'useStaffActions',
          });
        }

        // 5. AttendanceRecord 삭제 (not_started만)
        const attendanceQuery = query(
          collection(db, 'attendanceRecords'),
          where('eventId', '==', jobPosting.id),
          where('staffId', '==', staffId),
          where('date', '==', date),
          where('status', '==', 'not_started')
        );

        const attendanceSnapshot = await getDocs(attendanceQuery);
        for (const attendanceDoc of attendanceSnapshot.docs) {
          await deleteDoc(attendanceDoc.ref);
          logger.info(`AttendanceRecord 삭제: ${attendanceDoc.id}`, {
            component: 'useStaffActions',
          });
        }

        // 6. 삭제 후 인원 변화 메시지 생성
        let roleInfo = '';
        if (staffRole && staffTimeSlot) {
          const currentCount =
            jobPosting.confirmedStaff?.filter(
              (staff: ConfirmedStaff) =>
                staff.role === staffRole &&
                staff.timeSlot === staffTimeSlot &&
                staff.date === date
            ).length || 0;

          roleInfo = ` (${staffRole} ${staffTimeSlot}: ${currentCount + 1} → ${currentCount}명)`;
        }

        showSuccess(`${staffName} 스태프가 ${date} 날짜에서 삭제되었습니다.${roleInfo}`);
        refresh();
      } catch (error) {
        // 🎯 Firebase Error Handling (Phase 3-2 Integration)
        if (isPermissionDenied(error)) {
          showError('스태프 삭제 권한이 없습니다. 공고 작성자만 삭제할 수 있습니다.');
          return;
        }

        const message = handleFirebaseError(
          error as FirebaseError,
          {
            operation: 'deleteStaff',
            staffId,
            staffName,
            date,
            jobPostingId: jobPosting?.id || 'unknown',
            component: 'useStaffActions',
          },
          'ko'
        );

        showError(`스태프 삭제 실패: ${message}`);
      }
    },
    [jobPosting, refresh, showSuccess, showError]
  );

  /**
   * 일괄 삭제 핸들러
   */
  const handleBulkDelete = useCallback(
    async (staffIds: string[]) => {
      try {
        if (!jobPosting?.id) {
          showError('공고 정보를 찾을 수 없습니다.');
          return;
        }

        // 1. 각 스태프의 삭제 가능 여부 확인
        const staffList = staffIds.map(staffId => {
          const staff = staffData.find(s => s.id === staffId);
          const staffName = staff?.name || '이름 미정';
          const date =
            staff?.assignedDate || toISODateString(new Date()) || '';
          return { staffId, staffName, date };
        });

        const { deletable, nonDeletable } = await validateBulkDelete(
          jobPosting.id,
          staffList
        );

        // 2. 삭제 불가능한 스태프가 있으면 안내
        if (nonDeletable.length > 0) {
          const nonDeletableMessage = nonDeletable
            .map(s => `• ${s.staffName}: ${s.reason}`)
            .join('\n');

          const hasDeleteableStaff = deletable.length > 0;

          if (!hasDeleteableStaff) {
            showError(
              `선택한 모든 스태프를 삭제할 수 없습니다:\n\n${nonDeletableMessage}`
            );
            return;
          } else {
            showError(
              `일부 스태프는 삭제할 수 없습니다:\n${nonDeletableMessage}\n\n나머지 ${deletable.length}명만 삭제합니다.`
            );
          }
        }

        // 3. 삭제 가능한 스태프만 처리
        let successCount = 0;
        let failCount = 0;

        for (const { staffId, staffName, date } of deletable) {
          try {
            await runTransaction(db, async transaction => {
              const jobPostingRef = doc(db, 'jobPostings', jobPosting.id);
              const jobPostingDoc = await transaction.get(jobPostingRef);

              if (jobPostingDoc.exists()) {
                const currentData = jobPostingDoc.data();
                const confirmedStaffArray = currentData?.confirmedStaff || [];

                const baseStaffId = staffId.replace(/_\d+$/, '');

                const filteredConfirmedStaff = confirmedStaffArray.filter(
                  (staff: ConfirmedStaff) => {
                    const staffUserId = staff.userId;
                    return !(staffUserId === baseStaffId && staff.date === date);
                  }
                );

                transaction.update(jobPostingRef, {
                  confirmedStaff: filteredConfirmedStaff,
                });
              }
            });

            // workLogs, attendanceRecords 삭제
            const deletionPromises = [];

            // WorkLog 삭제 (scheduled/not_started만)
            const workLogQuery = query(
              collection(db, 'workLogs'),
              where('eventId', '==', jobPosting.id),
              where('staffId', '==', staffId),
              where('date', '==', date),
              where('status', 'in', ['scheduled', 'not_started'])
            );
            deletionPromises.push(
              getDocs(workLogQuery).then(snapshot => {
                return Promise.all(snapshot.docs.map(doc => deleteDoc(doc.ref)));
              })
            );

            // AttendanceRecord 삭제 (not_started만)
            const attendanceQuery = query(
              collection(db, 'attendanceRecords'),
              where('eventId', '==', jobPosting.id),
              where('staffId', '==', staffId),
              where('date', '==', date),
              where('status', '==', 'not_started')
            );
            deletionPromises.push(
              getDocs(attendanceQuery).then(snapshot => {
                return Promise.all(snapshot.docs.map(doc => deleteDoc(doc.ref)));
              })
            );

            await Promise.all(deletionPromises);

            logger.info(`일괄 삭제 성공: ${staffName} (${staffId})`, {
              component: 'useStaffActions',
            });
            successCount++;
          } catch (error) {
            logger.error(
              `일괄 삭제 실패: ${staffName} (${staffId})`,
              error instanceof Error ? error : new Error(String(error))
            );
            failCount++;
          }
        }

        // 4. 결과 메시지
        let resultMessage = '';
        if (successCount > 0 && failCount === 0) {
          resultMessage = `${successCount}명의 스태프가 삭제되었습니다. 인원 카운트가 업데이트되었습니다.`;
          showSuccess(resultMessage);
        } else if (successCount > 0 && failCount > 0) {
          resultMessage = `${successCount}명 삭제 완료, ${failCount}명 삭제 실패했습니다.`;
          showError(resultMessage);
        } else {
          resultMessage = '선택한 스태프를 삭제할 수 없습니다.';
          showError(resultMessage);
        }

        refresh();
      } catch (error) {
        // 🎯 Firebase Error Handling (Phase 3-2 Integration)
        if (isPermissionDenied(error)) {
          showError('일괄 삭제 권한이 없습니다. 공고 작성자만 삭제할 수 있습니다.');
          return;
        }

        const message = handleFirebaseError(
          error as FirebaseError,
          {
            operation: 'bulkDeleteStaff',
            staffCount: staffIds.length,
            jobPostingId: jobPosting?.id || 'unknown',
            component: 'useStaffActions',
          },
          'ko'
        );

        showError(`스태프 일괄 삭제 실패: ${message}`);
      }
    },
    [jobPosting, staffData, refresh, showSuccess, showError]
  );

  return {
    handleEditWorkTime,
    deleteStaff,
    handleBulkDelete,
  };
}
