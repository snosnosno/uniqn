import { useState, useCallback } from 'react';
import {
  doc,
  updateDoc,
  arrayUnion,
  runTransaction,
  getDoc,
  deleteDoc,
  collection,
  query,
  where,
  getDocs,
  setDoc,
  Timestamp,
  DocumentReference,
} from 'firebase/firestore';
import { useTranslation } from 'react-i18next';
import { logger } from '@/utils/logger';
import { toast } from '@/utils/toast';
import { db } from '@/firebase';
import { JobPostingUtils, JobPosting, ConfirmedStaff } from '@/types/jobPosting';
import { Assignment } from '@/types/application';
import { Applicant } from '../types';
import { jobRoleMap } from '@/utils/applicants';
import { ApplicationHistoryService } from '@/services/ApplicationHistoryService';
import { timestampToLocalDateString } from '@/utils/dateUtils';
import type { User } from 'firebase/auth';

interface UseApplicantActionsProps {
  jobPosting?: JobPosting | null;
  currentUser?: User | null;
  isAdmin?: boolean;
  onRefresh: () => void;
}

/**
 * 확정된 스태프를 위한 WorkLog 직접 생성 함수
 * promoteToStaff를 대체하여 persons 컬렉션 없이 WorkLog에 모든 정보를 embedded
 */
const createWorkLogsForConfirmedStaff = async (
  staffId: string,
  applicantName: string,
  applicantUserId: string,
  jobRole: string,
  assignment: Assignment,
  assignedDate: string,
  postingId: string,
  managerId: string,
  jobPosting: JobPosting,
  email: string = '',
  phone: string = ''
) => {
  try {
    logger.info('🚀 WorkLog 직접 생성 시작', {
      component: 'createWorkLogsForConfirmedStaff',
      data: {
        staffId,
        applicantName,
        applicantUserId,
        jobRole,
        assignedDate,
        postingId,
        // 🔍 role 관련 디버깅 정보 추가
        roleDebug: {
          jobRole,
          assignmentRole: assignment.role,
          assignmentRoleLowerCase: assignment.role?.toLowerCase(),
          hasValidRole: !!(jobRole && jobRole !== ''),
          willUseFallback: !jobRole || jobRole === '',
        },
      },
    });

    // WorkLog ID 생성 패턴: ${postingId}_${staffId}_${date}
    const workLogId = `${postingId}_${staffId}_${assignedDate}`;

    logger.info('생성할 WorkLog ID:', {
      component: 'createWorkLogsForConfirmedStaff',
      workLogId,
    });

    // 🔥 시간 정보 처리 - assignment.timeSlot 우선, 없으면 공고 기본 시간 사용
    let timeSlot = assignment.timeSlot || '';

    if (!timeSlot && jobPosting) {
      // dateSpecificRequirements에서 해당 날짜의 시간대 찾기
      if (jobPosting.dateSpecificRequirements && assignedDate) {
        const dateReq = jobPosting.dateSpecificRequirements.find(
          (req) => timestampToLocalDateString(req.date) === assignedDate
        );
        if (dateReq && dateReq.timeSlots && dateReq.timeSlots.length > 0) {
          const firstTimeSlot = dateReq.timeSlots[0];
          timeSlot = firstTimeSlot?.time || '';
        }
      }
    }

    // 🔥 timeSlot을 Timestamp로 변환 (scheduledStartTime, scheduledEndTime 생성)
    const { parseAssignedTime, convertTimeToTimestamp } = await import(
      '../../../../utils/workLogUtils'
    );
    const { startTime, endTime } = parseAssignedTime(timeSlot);
    const scheduledStartTime = startTime
      ? convertTimeToTimestamp(startTime, assignedDate)
      : undefined;
    const scheduledEndTime = endTime ? convertTimeToTimestamp(endTime, assignedDate) : undefined;

    // WorkLog 문서 생성 (persons 데이터를 모두 embedded)
    const workLogData = {
      id: workLogId,
      staffId: staffId,
      staffName: applicantName, // 호환성을 위해 유지
      eventId: postingId,
      date: assignedDate,

      // 🚀 persons 컬렉션 통합 - 스태프 정보를 WorkLog에 embedded
      staffInfo: {
        userId: applicantUserId,
        name: applicantName,
        email: email || '',
        phone: phone || '',
        userRole: 'staff',
        jobRole: [jobRole],
        isActive: true,
        // undefined 필드 제거 - 필요시 나중에 업데이트로 추가
      },

      // 🚀 할당 정보 (persons 컬렉션의 할당 관련 정보)
      assignmentInfo: {
        role: jobRole || 'staff', // 🔥 fallback 추가: role이 빈 문자열이면 'staff' 사용
        assignedRole: assignment.role?.toLowerCase() || '',
        assignedTime: timeSlot, // 🔥 공고 시간 fallback 적용된 timeSlot 사용
        assignedDate: assignedDate,
        postingId: postingId,
        managerId: managerId,
        type: 'staff' as const,
      },

      // 기존 근무 관련 필드 (호환성 유지)
      role: jobRole || 'staff', // 🔥 fallback 추가: role이 빈 문자열이면 'staff' 사용
      assignedTime: timeSlot,

      // 🔥 예정 시간 추가 (Timestamp 형태)
      ...(scheduledStartTime && { scheduledStartTime }),
      ...(scheduledEndTime && { scheduledEndTime }),

      status: 'not_started' as const,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      createdBy: managerId,
    };

    // 🔍 Firebase Security Rules 검증을 위한 데이터 구조 로깅
    logger.info('WorkLog 데이터 구조 검증:', {
      component: 'createWorkLogsForConfirmedStaff',
      hasRequiredFields: {
        staffId: !!workLogData.staffId,
        eventId: !!workLogData.eventId,
        date: !!workLogData.date,
        staffInfo: !!workLogData.staffInfo,
        assignmentInfo: !!workLogData.assignmentInfo,
      },
      staffInfoKeys: workLogData.staffInfo ? Object.keys(workLogData.staffInfo) : [],
      assignmentInfoKeys: workLogData.assignmentInfo ? Object.keys(workLogData.assignmentInfo) : [],
    });

    // WorkLog 문서 생성
    await setDoc(doc(db, 'workLogs', workLogId), workLogData);

    logger.info('✅ WorkLog 직접 생성 완료', {
      component: 'createWorkLogsForConfirmedStaff',
      workLogId,
      staffInfo_userId: workLogData.staffInfo?.userId,
      assignmentInfo_role: workLogData.assignmentInfo?.role,
      assignmentInfo_postingId: workLogData.assignmentInfo?.postingId,
    });
  } catch (error) {
    // 🔍 더 자세한 에러 정보 로깅
    const errorMessage = error instanceof Error ? error.message : String(error);
    const isFirebaseError =
      errorMessage.includes('PERMISSION_DENIED') ||
      errorMessage.includes('permission-denied') ||
      errorMessage.includes('Missing or insufficient permissions');

    logger.error(
      '❌ WorkLog 직접 생성 실패:',
      error instanceof Error ? error : new Error(String(error)),
      {
        component: 'createWorkLogsForConfirmedStaff',
        isFirebasePermissionError: isFirebaseError,
        errorDetails: {
          workLogId: `${postingId}_${staffId}_${assignedDate}`,
          attemptedStaffId: staffId,
          attemptedPostingId: postingId,
          attemptedDate: assignedDate,
        },
      }
    );

    // Firebase 권한 오류인 경우 특별한 메시지 표시
    if (isFirebaseError) {
      logger.warn('🚨 Firebase Security Rules 위반 의심', {
        component: 'createWorkLogsForConfirmedStaff',
        suggestion: 'hasValidRole() 함수 또는 필수 필드 검증 실패 가능성',
      });
    }

    throw error;
  }
};

/**
 * 단일일 여러 개인지 확인하는 헬퍼 함수
 * @param assignments 배정 정보 배열
 * @param jobPosting 공고 정보
 * @returns 독립적인 단일일들인지 여부
 */
const checkIfIndependentDates = (assignments: Assignment[], jobPosting: JobPosting): boolean => {
  if (!jobPosting.dateSpecificRequirements) return true;

  // 모든 날짜 수집
  const allDates = assignments
    .flatMap((assignment) => assignment.dates)
    .filter((date) => date && date.trim() !== '')
    .sort();

  if (allDates.length <= 1) return true;

  // 각 날짜가 독립적인 dateSpecificRequirement를 가지고 있는지 확인
  const independentDates = allDates.every((date) => {
    const dateReq = jobPosting.dateSpecificRequirements?.find((req) => {
      const reqDateStr = timestampToLocalDateString(req.date);
      return reqDateStr === date;
    });

    if (!dateReq) return false;

    // 해당 날짜의 timeSlots이 multi duration을 가지지 않는지 확인
    const hasMultiDuration = dateReq.timeSlots.some((ts) => ts.duration?.type === 'multi');

    return !hasMultiDuration; // multi duration이 없으면 독립적인 단일일
  });

  logger.info(
    `🔍 단일일 여러 개 판별 결과: ${independentDates ? '독립적 단일일' : '멀티데이'} (날짜: ${allDates.join(', ')})`,
    {
      component: 'useApplicantActions',
    }
  );

  return independentDates;
};

/**
 * 지원자 확정/취소 액션을 관리하는 Custom Hook
 */
export const useApplicantActions = ({
  jobPosting,
  currentUser,
  isAdmin,
  onRefresh,
}: UseApplicantActionsProps) => {
  const { t } = useTranslation();
  const [isProcessing, setIsProcessing] = useState(false);
  const [cancelConfirmModal, setCancelConfirmModal] = useState<{
    isOpen: boolean;
    applicant: Applicant | null;
  }>({
    isOpen: false,
    applicant: null,
  });

  // 권한 체크 - 공고 작성자 또는 관리자만 수정 가능
  const canEdit = Boolean(
    currentUser?.uid && (currentUser.uid === jobPosting?.createdBy || isAdmin)
  );

  // canEdit 값 확인

  /**
   * 지원자를 확정하는 함수
   */
  const handleConfirmApplicant = useCallback(
    async (applicant: Applicant, assignments: Assignment[]) => {
      // 권한 체크
      if (!canEdit) {
        toast.error(t('toast.jobPosting.noEditPermission'));
        return;
      }

      if (!assignments || assignments.length === 0) {
        toast.warning(t('jobPostingAdmin.alerts.selectRoleToAssign'));
        return;
      }
      if (!jobPosting) return;

      setIsProcessing(true);

      try {
        const jobPostingRef = doc(db, 'jobPostings', jobPosting.id);

        // 🔍 같은 날짜 중복 확정 방지 검사 (개선된 버전)
        const targetDates = assignments
          .flatMap((a) => a.dates)
          .filter((date) => date && date.trim() !== '');

        if (targetDates.length > 0) {
          // jobPosting의 최신 상태를 다시 확인
          const jobPostingDoc = await getDoc(jobPostingRef);
          const latestData = jobPostingDoc.data();
          const latestConfirmedStaff = latestData?.confirmedStaff || [];

          const existingConfirmations = latestConfirmedStaff.filter(
            (staff: ConfirmedStaff) =>
              staff.userId === applicant.applicantId &&
              staff.date &&
              targetDates.includes(staff.date)
          );

          if (existingConfirmations.length > 0) {
            const duplicateDates = existingConfirmations
              .map((s: ConfirmedStaff) => s.date)
              .join(', ');
            toast.warning(t('toast.jobPosting.duplicateConfirm', { duplicateDates }));
            return;
          }
        }

        // 선택된 역할들이 마감되었는지 확인
        const fullRoles = assignments.filter((assignment) => {
          // dates 배열에서 첫 번째 날짜 사용
          const assignmentDate =
            assignment.dates && assignment.dates.length > 0 ? assignment.dates[0] : '';
          if (!assignmentDate) return false;

          return JobPostingUtils.isRoleFull(
            jobPosting,
            assignment.timeSlot,
            assignment.role || '',
            assignmentDate
          );
        });

        if (fullRoles.length > 0) {
          const fullRoleMessages = fullRoles
            .map((assignment) => {
              const assignmentDate =
                assignment.dates && assignment.dates.length > 0 ? assignment.dates[0] : '';
              return `${assignmentDate ? `${assignmentDate} ` : ''}${assignment.timeSlot} - ${assignment.role || ''}`;
            })
            .join(', ');
          toast.warning(t('toast.jobPosting.rolesClosed', { roles: fullRoleMessages }));
          return;
        }

        // 🏗️ ApplicationHistory 서비스를 통한 확정 처리 (데이터 무결성 보장)
        await ApplicationHistoryService.confirmApplication(applicant.id, assignments);

        // 🔄 jobPosting의 confirmedStaff 배열 업데이트 (v2.1: 지원서 메타데이터 추가)
        await runTransaction(db, async (transaction) => {
          // 🆕 지원 타입 판별 개선 (단일일 여러 개 vs 멀티데이 구분)
          const totalDates = assignments.reduce(
            (total, assignment) => total + assignment.dates.length,
            0
          );

          // 🛠️ 임시 해결책: 단일일 여러 개는 항상 'single'로 처리
          const isIndependentDates = checkIfIndependentDates(assignments, jobPosting);
          const applicationType: 'single' | 'multi' = isIndependentDates
            ? 'single'
            : totalDates > 1
              ? 'multi'
              : 'single';

          const applicationGroupId =
            applicationType === 'multi' ? `${applicant.id}_group_${Date.now()}` : null;

          logger.info(
            `🎯 지원 타입 판별 결과: ${applicationType} (총 ${totalDates}개 날짜, 독립적: ${isIndependentDates})`,
            {
              component: 'useApplicantActions',
            }
          );

          assignments.forEach((assignment) => {
            const { timeSlot, role, dates } = assignment;
            // dates 배열의 각 날짜에 대해 staffEntry 생성
            dates.forEach((date) => {
              const staffEntry: Omit<ConfirmedStaff, 'confirmedAt'> & {
                confirmedAt: Date;
                date?: string;
              } = {
                userId: applicant.applicantId, // ✅ 타입 정의와 일치하는 필드명 사용
                name: applicant.applicantName,
                role: role || '',
                timeSlot,
                phone: applicant.phone || '', // ✅ 연락처 정보 추가
                email: applicant.email || '', // ✅ 이메일 정보 추가
                confirmedAt: new Date(),

                // 🆕 v2.1: 지원서 구분 메타데이터
                applicationId: applicant.id,
                applicationType,
              };

              // 🔧 멀티데이일 때만 applicationGroupId 추가 (undefined 방지)
              if (applicationType === 'multi' && applicationGroupId) {
                staffEntry.applicationGroupId = applicationGroupId;
              }

              // date가 존재하고 유효한 값일 때만 추가
              if (date && date.trim() !== '') {
                staffEntry.date = date;
              }

              transaction.update(jobPostingRef, {
                confirmedStaff: arrayUnion(staffEntry),
              });
            });
          });
        });

        // 각 assignment마다 별도의 스태프 문서 생성 (다중 날짜/시간대 지원)
        const assignmentsWithStaffIds: { assignment: Assignment; staffDocId: string }[] = []; // ✅ staffDocId 수집용 배열

        if (assignments.length > 0) {
          logger.info('🚀 [확정] WorkLog 생성 시작', {
            component: 'useApplicantActions',
          });

          // 각 assignment의 각 날짜에 대해 개별적으로 WorkLog 생성
          let assignmentIndex = 0;
          for (let i = 0; i < assignments.length; i++) {
            const assignment = assignments[i];
            if (!assignment) continue;
            const assignmentDates = assignment.dates || [];

            for (let dateIndex = 0; dateIndex < assignmentDates.length; dateIndex++) {
              const assignedDate = assignmentDates[dateIndex] || '';

              // 날짜가 빈 문자열이면 기본값 설정 (오늘 날짜 또는 공고의 기본 날짜)
              let finalAssignedDate = assignedDate;
              if (!finalAssignedDate || finalAssignedDate.trim() === '') {
                // 공고에 날짜 정보가 있으면 사용, 없으면 오늘 날짜
                const firstDateReq = jobPosting.dateSpecificRequirements?.[0];
                if (firstDateReq?.date) {
                  finalAssignedDate = timestampToLocalDateString(firstDateReq.date) || '';
                }
                if (!finalAssignedDate) {
                  const isoString = new Date().toISOString();
                  const datePart = isoString.split('T')[0];
                  finalAssignedDate = datePart || ''; // yyyy-MM-dd 형식
                }
              }

              const jobRole = jobRoleMap[assignment?.role || ''] || 'Other';

              // 고유한 문서 ID 생성 (userId + assignment index + date index)
              const staffDocId = `${applicant.applicantId}_${assignmentIndex}`;

              try {
                // 🚀 WorkLog 직접 생성 (promoteToStaff 대신)
                await createWorkLogsForConfirmedStaff(
                  staffDocId,
                  applicant.applicantName,
                  applicant.applicantId,
                  jobRole,
                  assignment,
                  finalAssignedDate,
                  jobPosting.id,
                  currentUser?.uid || 'system',
                  jobPosting, // 🔥 jobPosting 전체 객체 전달
                  applicant.email || '',
                  applicant.phone || ''
                );

                // ✅ WorkLog 생성용으로 assignment와 staffDocId 저장
                assignmentsWithStaffIds.push({ assignment, staffDocId });

                logger.info(`✅ WorkLog 생성 성공: ${staffDocId} for date ${finalAssignedDate}`, {
                  component: 'useApplicantActions',
                });
              } catch (workLogError) {
                logger.error(
                  `❌ WorkLog 생성 오류 ${assignmentIndex + 1}:`,
                  workLogError instanceof Error ? workLogError : new Error(String(workLogError)),
                  { component: 'useApplicantActions' }
                );
                // 개별 WorkLog 생성 실패해도 전체 프로세스는 계속 진행
              }

              // 🔧 각 날짜마다 assignmentIndex 증가 (중복 ID 방지)
              assignmentIndex++;
            }
          }
        }

        // 🚀 WorkLog 직접 생성 완료
        // assignmentsWithStaffIds는 이미 createWorkLogsForConfirmedStaff 호출 시 WorkLog가 생성됨

        const totalAssignments = assignments.reduce(
          (total, assignment) => total + assignment.dates.length,
          0
        );
        toast.success(
          t('toast.jobPosting.confirmSuccessWithWorkLog', {
            message: t('jobPostingAdmin.alerts.applicantConfirmSuccess'),
            count: totalAssignments,
          })
        );

        // 자동 마감 로직 체크
        await checkAutoCloseJobPosting(jobPostingRef);

        // 지원자 목록 새로고침
        onRefresh();
      } catch (error) {
        logger.error(
          'Error confirming applicant: ',
          error instanceof Error ? error : new Error(String(error)),
          {
            component: 'useApplicantActions',
          }
        );
        toast.error(t('jobPostingAdmin.alerts.applicantConfirmFailed'));
      } finally {
        setIsProcessing(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [canEdit, jobPosting, currentUser, t, onRefresh]
  );

  /**
   * 확정 취소 확인 모달을 여는 함수
   */
  const handleCancelConfirmation = useCallback(
    (applicant: Applicant) => {
      if (!jobPosting) return;

      // 권한 체크
      if (!canEdit) {
        toast.error(t('toast.jobPosting.noEditPermission'));
        return;
      }

      // 확인 모달 열기
      setCancelConfirmModal({
        isOpen: true,
        applicant,
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [canEdit, jobPosting]
  );

  /**
   * 지원자 확정을 실제로 취소하는 함수
   */
  const performCancelConfirmation = useCallback(async () => {
    const applicant = cancelConfirmModal.applicant;
    if (!applicant || !jobPosting) return;

    // 확정 취소 작업 수행 (Toast로 안내)
    setIsProcessing(true);

    try {
      const jobPostingRef = doc(db, 'jobPostings', jobPosting.id);

      // 🏗️ ApplicationHistory 서비스를 통한 확정 취소 (완전한 원본 데이터 복원)
      await ApplicationHistoryService.cancelConfirmation(applicant.id);

      // 🔄 jobPostings 컬렉션의 confirmedStaff 배열에서 해당 지원자 항목들 제거 (필터링 방식)
      await runTransaction(db, async (transaction) => {
        // 최신 jobPosting 데이터를 transaction 내에서 가져오기
        const jobPostingDoc = await transaction.get(jobPostingRef);
        if (!jobPostingDoc.exists()) {
          throw new Error(t('errors.postingNotFound'));
        }

        const currentData = jobPostingDoc.data();
        const confirmedStaffArray = currentData?.confirmedStaff ?? [];

        if (confirmedStaffArray.length > 0) {
          // userId 기준으로 해당 지원자의 모든 항목 필터링 (완전 제거)
          const filteredConfirmedStaff = confirmedStaffArray.filter(
            (staff: ConfirmedStaff) => staff.userId !== applicant.applicantId
          );

          const removedCount = confirmedStaffArray.length - filteredConfirmedStaff.length;

          // 전체 confirmedStaff 배열을 필터링된 배열로 교체
          transaction.update(jobPostingRef, {
            confirmedStaff: filteredConfirmedStaff,
          });

          // 제거 검증
          if (removedCount === 0) {
          }
        } else {
        }
      });

      // 자동 마감 해제 체크
      await checkAutoReopenJobPosting(jobPostingRef);

      // staff 컬렉션 자동 삭제 (다중 문서 지원)
      await deleteStaffDocuments(applicant.applicantId, jobPosting.id);

      // 🚀 확정 취소 시 관련 WorkLog 삭제
      await deleteWorkLogsForCancelledStaff(applicant.applicantId, jobPosting.id);

      // 🔍 취소 후 데이터 정합성 검증
      await verifyDataIntegrityAfterCancel(jobPostingRef, applicant.applicantId);

      toast.success(t('toast.jobPosting.cancelConfirmSuccess', { name: applicant.applicantName }));

      // 모달 닫기
      setCancelConfirmModal({
        isOpen: false,
        applicant: null,
      });

      // 지원자 목록 새로고침
      onRefresh();
    } catch (error) {
      logger.error(
        'Error cancelling confirmation:',
        error instanceof Error ? error : new Error(String(error)),
        {
          component: 'useApplicantActions',
        }
      );
      toast.error(t('toast.jobPosting.cancelConfirmError'));
    } finally {
      setIsProcessing(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cancelConfirmModal.applicant, jobPosting, onRefresh]);

  /**
   * 공고 자동 마감 체크 함수
   */
  const checkAutoCloseJobPosting = async (jobPostingRef: DocumentReference) => {
    try {
      const jobPostingDoc = await getDoc(jobPostingRef);
      if (jobPostingDoc.exists()) {
        const data = jobPostingDoc.data();
        if (!data) return;
        const updatedPost = { ...data, id: jobPostingDoc.id } as JobPosting;

        // 모든 요구사항이 충족되었는지 확인
        let shouldClose = false;
        let closeMessage = '';

        // 날짜별 요구사항 확인
        if (
          updatedPost.dateSpecificRequirements &&
          updatedPost.dateSpecificRequirements.length > 0
        ) {
          const progressMap = JobPostingUtils.getRequirementProgress(updatedPost);
          let allFulfilled = true;
          Array.from(progressMap.entries()).forEach(([_date, progress]) => {
            const percentage =
              progress.required > 0 ? (progress.confirmed / progress.required) * 100 : 0;
            if (percentage < 100) {
              allFulfilled = false;
            }
          });
          if (allFulfilled) {
            shouldClose = true;
            closeMessage = t('toast.jobPosting.allDatesFulfilled');
          }
        } else {
          // 기존 방식의 경우
          const progressMap = JobPostingUtils.getRequirementProgress(updatedPost);
          const allProgress = progressMap.get('all');
          if (allProgress) {
            const percentage =
              allProgress.required > 0 ? (allProgress.confirmed / allProgress.required) * 100 : 0;
            if (percentage >= 100) {
              shouldClose = true;
              closeMessage = t('toast.jobPosting.allSlotsFulfilled');
            }
          }
        }

        // 공고 상태 업데이트
        if (shouldClose && updatedPost.status === 'open') {
          await updateDoc(jobPostingRef, { status: 'closed' });
          toast.info(closeMessage);
        }
      }
    } catch (err) {
      logger.error('자동 마감 처리 중 오류:', err instanceof Error ? err : new Error(String(err)), {
        component: 'useApplicantActions',
      });
    }
  };

  /**
   * 공고 자동 재개방 체크 함수
   */
  const checkAutoReopenJobPosting = async (jobPostingRef: DocumentReference) => {
    try {
      const jobPostingDoc = await getDoc(jobPostingRef);
      if (jobPostingDoc.exists()) {
        const data = jobPostingDoc.data();
        if (!data) return;
        const updatedPost = { ...data, id: jobPostingDoc.id } as JobPosting;

        // JobPostingUtils를 사용하여 모든 요구사항이 충족되었는지 확인
        let shouldReopen = false;
        let reopenMessage = '';

        // 날짜별 요구사항 확인
        if (
          updatedPost.dateSpecificRequirements &&
          updatedPost.dateSpecificRequirements.length > 0
        ) {
          const progressMap = JobPostingUtils.getRequirementProgress(updatedPost);
          Array.from(progressMap.entries()).some(([date, progress]) => {
            const percentage =
              progress.required > 0 ? (progress.confirmed / progress.required) * 100 : 0;
            if (percentage < 100) {
              shouldReopen = true;
              reopenMessage = t('toast.jobPosting.dateShortage', { date });
              return true; // break the loop
            }
            return false;
          });
        } else {
          // 기존 방식의 경우
          const progressMap = JobPostingUtils.getRequirementProgress(updatedPost);
          const allProgress = progressMap.get('all');
          if (allProgress) {
            const percentage =
              allProgress.required > 0 ? (allProgress.confirmed / allProgress.required) * 100 : 0;
            if (percentage < 100) {
              shouldReopen = true;
              reopenMessage = t('toast.jobPosting.personnelShortage');
            }
          }
        }

        // 공고 상태 업데이트
        if (shouldReopen && updatedPost.status === 'closed') {
          await updateDoc(jobPostingRef, { status: 'open' });
          toast.info(reopenMessage);
        }
      }
    } catch (err) {
      logger.error(
        '자동 마감 해제 처리 중 오류:',
        err instanceof Error ? err : new Error(String(err)),
        {
          component: 'useApplicantActions',
        }
      );
      toast.error(t('toast.jobPosting.autoCloseError'));
    }
  };

  /**
   * 확정 취소 후 데이터 정합성 검증 함수
   */
  const verifyDataIntegrityAfterCancel = async (
    jobPostingRef: DocumentReference,
    applicantId: string
  ) => {
    try {
      // jobPosting의 최종 상태 확인
      const finalDoc = await getDoc(jobPostingRef);
      if (!finalDoc.exists()) {
        logger.error('❌ 검증: jobPosting 문서가 존재하지 않음', undefined, {
          component: 'useApplicantActions',
        });
        return;
      }

      const finalData = finalDoc.data() as { confirmedStaff?: ConfirmedStaff[] };
      const remainingConfirmedStaff = finalData?.confirmedStaff || [];

      // 해당 지원자의 잔여 데이터 확인
      const remainingApplicantEntries = remainingConfirmedStaff.filter(
        (staff: ConfirmedStaff) => staff.userId === applicantId
      );

      if (remainingApplicantEntries.length > 0) {
        logger.error(
          '❌ 데이터 정합성 오류: confirmedStaff에 잔여 데이터 발견:',
          new Error('Data integrity violation'),
          {
            component: 'useApplicantActions',
            data: {
              applicantId,
              remainingEntries: remainingApplicantEntries.map((s: ConfirmedStaff) => ({
                userId: s.userId,
                role: s.role,
                timeSlot: s.timeSlot,
                date: s.date,
              })),
            },
          }
        );

        // 강제로 다시 한번 정리 시도
        await runTransaction(db, async (transaction) => {
          const cleanedArray = remainingConfirmedStaff.filter(
            (staff: ConfirmedStaff) => staff.userId !== applicantId
          );
          transaction.update(jobPostingRef, {
            confirmedStaff: cleanedArray,
          });
        });
      } else {
      }
    } catch (err) {
      logger.error(
        '데이터 정합성 검증 중 오류:',
        err instanceof Error ? err : new Error(String(err)),
        {
          component: 'useApplicantActions',
        }
      );
    }
  };

  /**
   * 확정 취소 시 관련 WorkLog 삭제 함수 (완전 개선: 두 가지 방법 병행)
   */
  const deleteWorkLogsForCancelledStaff = async (applicantId: string, postingId: string) => {
    try {
      let deletedCount = 0;

      // 🎯 방법 1: eventId로 모든 WorkLog를 가져온 후 클라이언트에서 필터링
      const allWorkLogsQuery = query(collection(db, 'workLogs'), where('eventId', '==', postingId));

      const allWorkLogsSnapshot = await getDocs(allWorkLogsQuery);

      // 클라이언트에서 staffId 필터링 (더 정확함)
      const targetWorkLogs = allWorkLogsSnapshot.docs.filter((workLogDoc) => {
        const data = workLogDoc.data();
        const staffId = data?.staffId || '';

        // staffId가 applicantId로 시작하거나 정확히 일치하는 경우
        const isMatch = staffId === applicantId || staffId.startsWith(applicantId + '_');

        return isMatch;
      });

      // 🗑️ 각 WorkLog 문서 삭제
      for (const workLogDoc of targetWorkLogs) {
        try {
          await deleteDoc(doc(db, 'workLogs', workLogDoc.id));
          deletedCount++;
        } catch (deleteError) {
          logger.error(
            '❌ 개별 WorkLog 삭제 실패:',
            deleteError instanceof Error ? deleteError : new Error(String(deleteError)),
            {
              component: 'useApplicantActions',
              data: {
                workLogId: workLogDoc.id,
                staffId: workLogDoc.data()?.staffId,
              },
            }
          );
        }
      }

      // 삭제 결과 검증
      if (deletedCount === 0 && targetWorkLogs.length === 0) {
      } else if (deletedCount !== targetWorkLogs.length) {
      }
    } catch (err) {
      logger.error(
        'WorkLog 삭제 중 심각한 오류:',
        err instanceof Error ? err : new Error(String(err)),
        {
          component: 'useApplicantActions',
          data: { applicantId, postingId },
        }
      );
      // 에러가 발생해도 전체 프로세스는 계속 진행 (확정 취소는 성공)
    }
  };

  /**
   * staff 문서 삭제 함수
   */
  const deleteStaffDocuments = async (applicantId: string, postingId: string) => {
    try {
      // 🚫 persons 컬렉션 삭제 로직 제거 (WorkLog 통합으로 인해 불필요)
      logger.info(
        `persons 삭제 스킵 (WorkLog 통합): applicantId=${applicantId}, postingId=${postingId}`,
        {
          component: 'useApplicantActions',
        }
      );
    } catch (err) {
      logger.error(
        'staff 컬렉션 자동 삭제 중 오류:',
        err instanceof Error ? err : new Error(String(err)),
        {
          component: 'useApplicantActions',
        }
      );
      toast.error(t('toast.jobPosting.staffDeleteError'));
    }
  };

  return {
    canEdit,
    isProcessing,
    handleConfirmApplicant,
    handleCancelConfirmation,
    cancelConfirmModal,
    setCancelConfirmModal,
    performCancelConfirmation,
  };
};
