import { useState, useCallback } from 'react';
import { doc, updateDoc, arrayUnion, runTransaction, getDoc, deleteDoc, collection, query, where, getDocs, setDoc, Timestamp } from 'firebase/firestore';
import { useTranslation } from 'react-i18next';
import { logger } from '../../../../utils/logger';
import { toast } from '../../../../utils/toast';
import { db } from '../../../../firebase';
import { JobPostingUtils, JobPosting } from '../../../../types/jobPosting';
import { Assignment } from '../../../../types/application';
import { Applicant } from '../types';
import { jobRoleMap } from '../utils/applicantHelpers';
import { ApplicationHistoryService } from '../../../../services/ApplicationHistoryService';

interface UseApplicantActionsProps {
  jobPosting?: any;
  currentUser?: any;
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
  email: string = '',
  phone: string = ''
) => {
  try {
    logger.info('🚀 WorkLog 직접 생성 시작', {
      component: 'createWorkLogsForConfirmedStaff',
      staffId,
      applicantName,
      applicantUserId,
      jobRole,
      assignedDate,
      postingId
    });

    // WorkLog ID 생성 패턴: ${postingId}_${staffId}_${date}
    const workLogId = `${postingId}_${staffId}_${assignedDate}`;
    
    logger.info('생성할 WorkLog ID:', {
      component: 'createWorkLogsForConfirmedStaff',
      workLogId
    });
    
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
        isActive: true
        // undefined 필드 제거 - 필요시 나중에 업데이트로 추가
      },
      
      // 🚀 할당 정보 (persons 컬렉션의 할당 관련 정보)
      assignmentInfo: {
        role: jobRole,
        assignedRole: assignment.role?.toLowerCase() || '',
        assignedTime: assignment.timeSlot,
        assignedDate: assignedDate,
        postingId: postingId,
        managerId: managerId,
        type: 'staff' as const,
      },
      
      // 기존 근무 관련 필드 (호환성 유지)
      role: jobRole,
      assignedTime: assignment.timeSlot,
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
        assignmentInfo: !!workLogData.assignmentInfo
      },
      staffInfoKeys: workLogData.staffInfo ? Object.keys(workLogData.staffInfo) : [],
      assignmentInfoKeys: workLogData.assignmentInfo ? Object.keys(workLogData.assignmentInfo) : []
    });

    // WorkLog 문서 생성
    await setDoc(doc(db, 'workLogs', workLogId), workLogData);
    
    logger.info('✅ WorkLog 직접 생성 완료', {
      component: 'createWorkLogsForConfirmedStaff',
      workLogId,
      staffInfo_userId: workLogData.staffInfo?.userId,
      assignmentInfo_role: workLogData.assignmentInfo?.role,
      assignmentInfo_postingId: workLogData.assignmentInfo?.postingId
    });

  } catch (error) {
    // 🔍 더 자세한 에러 정보 로깅
    const errorMessage = error instanceof Error ? error.message : String(error);
    const isFirebaseError = errorMessage.includes('PERMISSION_DENIED') || 
                          errorMessage.includes('permission-denied') ||
                          errorMessage.includes('Missing or insufficient permissions');
    
    logger.error('❌ WorkLog 직접 생성 실패:', 
      error instanceof Error ? error : new Error(String(error)), 
      { 
        component: 'createWorkLogsForConfirmedStaff',
        isFirebasePermissionError: isFirebaseError,
        errorDetails: {
          workLogId: `${postingId}_${staffId}_${assignedDate}`,
          attemptedStaffId: staffId,
          attemptedPostingId: postingId,
          attemptedDate: assignedDate
        }
      }
    );

    // Firebase 권한 오류인 경우 특별한 메시지 표시
    if (isFirebaseError) {
      logger.warn('🚨 Firebase Security Rules 위반 의심', {
        component: 'createWorkLogsForConfirmedStaff',
        suggestion: 'hasValidRole() 함수 또는 필수 필드 검증 실패 가능성'
      });
    }
    
    throw error;
  }
};

/**
 * 지원자 확정/취소 액션을 관리하는 Custom Hook
 */
export const useApplicantActions = ({ jobPosting, currentUser, onRefresh }: UseApplicantActionsProps) => {
  const { t } = useTranslation();
  const [isProcessing, setIsProcessing] = useState(false);

  // 권한 체크 - 공고 작성자 또는 관리자만 수정 가능
  const canEdit = currentUser?.uid && (
    currentUser.uid === jobPosting?.createdBy || 
    currentUser.role === 'admin'
  );
  
  // canEdit 값 확인


  /**
   * 지원자를 확정하는 함수
   */
  const handleConfirmApplicant = useCallback(async (applicant: Applicant, assignments: Assignment[]) => {
    // 권한 체크
    if (!canEdit) {
      toast.error('이 공고를 수정할 권한이 없습니다. 공고 작성자만 수정할 수 있습니다.');
      return;
    }
    
    
    if (!assignments || assignments.length === 0) {
      toast.warning(t('jobPostingAdmin.alerts.selectRoleToAssign'));
      return;
    }
    if (!jobPosting) return;
    
    setIsProcessing(true);
    
    try {
      const jobPostingRef = doc(db, "jobPostings", jobPosting.id);
      
      // 🔍 같은 날짜 중복 확정 방지 검사 (개선된 버전)
      const targetDates = assignments
        .flatMap(a => a.dates)
        .filter(date => date && date.trim() !== '');
      
      if (targetDates.length > 0) {
        // jobPosting의 최신 상태를 다시 확인
        const jobPostingDoc = await getDoc(jobPostingRef);
        const latestData = jobPostingDoc.data();
        const latestConfirmedStaff = latestData?.confirmedStaff || [];
        
        const existingConfirmations = latestConfirmedStaff.filter((staff: any) => 
          (staff.userId || staff.staffId) === applicant.applicantId && 
          targetDates.includes(staff.date)
        );

        if (existingConfirmations.length > 0) {
          const duplicateDates = existingConfirmations.map((s: any) => s.date).join(', ');
          toast.warning(`같은 날짜에 중복 확정할 수 없습니다.\n중복 날짜: ${duplicateDates}`);
          return;
        }
      }

      // 선택된 역할들이 마감되었는지 확인
      const fullRoles = assignments.filter(assignment => {
        // dates 배열에서 첫 번째 날짜 사용
        const assignmentDate = assignment.dates && assignment.dates.length > 0 ? assignment.dates[0] : '';
        if (!assignmentDate) return false;
        
        return JobPostingUtils.isRoleFull(
          jobPosting,
          assignment.timeSlot,
          assignment.role || '',
          assignmentDate
        );
      });
      
      if (fullRoles.length > 0) {
        const fullRoleMessages = fullRoles.map(assignment => {
          const assignmentDate = assignment.dates && assignment.dates.length > 0 ? assignment.dates[0] : '';
          return `${assignmentDate ? `${assignmentDate} ` : ''}${assignment.timeSlot} - ${assignment.role || ''}`;
        }).join(', ');
        toast.warning(`다음 역할은 이미 마감되어 확정할 수 없습니다:\n${fullRoleMessages}`);
        return;
      }

      const _applicationRef = doc(db, "applications", applicant.id);

      // 🏗️ ApplicationHistory 서비스를 통한 확정 처리 (데이터 무결성 보장)
      await ApplicationHistoryService.confirmApplication(applicant.id, assignments);
      
      // 🔄 jobPosting의 confirmedStaff 배열 업데이트 (v2.1: 지원서 메타데이터 추가)
      await runTransaction(db, async (transaction) => {
        // 🆕 지원 타입 판별 (날짜 수에 따라)
        const totalDates = assignments.reduce((total, assignment) => total + assignment.dates.length, 0);
        const applicationType: 'single' | 'multi' = totalDates > 1 ? 'multi' : 'single';
        const applicationGroupId = applicationType === 'multi' ? `${applicant.id}_group_${Date.now()}` : null;

        assignments.forEach(assignment => {
          const { timeSlot, role, dates } = assignment;
          // dates 배열의 각 날짜에 대해 staffEntry 생성
          dates.forEach(date => {
            const staffEntry: any = {
              userId: applicant.applicantId,  // ✅ 타입 정의와 일치하는 필드명 사용
              name: applicant.applicantName,
              role,
              timeSlot,
              confirmedAt: new Date(),

              // 🆕 v2.1: 지원서 구분 메타데이터
              applicationId: applicant.id,
              applicationType
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
              confirmedStaff: arrayUnion(staffEntry)
            });
          });
        });
      });

      // 각 assignment마다 별도의 스태프 문서 생성 (다중 날짜/시간대 지원)
      const assignmentsWithStaffIds: { assignment: Assignment; staffDocId: string }[] = []; // ✅ staffDocId 수집용 배열
      
      if (assignments.length > 0) {
        logger.info('🚀 [확정] WorkLog 생성 시작', {
          component: 'useApplicantActions'
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
              if (jobPosting.eventDate) {
                finalAssignedDate = jobPosting.eventDate;
              } else {
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
                applicant.email || '',
                applicant.phone || ''
              );
              
              // ✅ WorkLog 생성용으로 assignment와 staffDocId 저장
              assignmentsWithStaffIds.push({ assignment, staffDocId });
              
              logger.info(`✅ WorkLog 생성 성공: ${staffDocId} for date ${finalAssignedDate}`, {
                component: 'useApplicantActions'
              });
              
            } catch (workLogError) {
              logger.error(`❌ WorkLog 생성 오류 ${assignmentIndex + 1}:`, 
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
      
      const totalAssignments = assignments.reduce((total, assignment) => total + assignment.dates.length, 0);
      toast.success(`${t('jobPostingAdmin.alerts.applicantConfirmSuccess')} (${totalAssignments}개 시간대 확정, WorkLog 자동 생성 완료)`);
      
      // 자동 마감 로직 체크
      await checkAutoCloseJobPosting(jobPostingRef);
      
      // 지원자 목록 새로고침
      onRefresh();
      
    } catch (error) {
      logger.error('Error confirming applicant: ', error instanceof Error ? error : new Error(String(error)), { 
        component: 'useApplicantActions' 
      });
      toast.error(t('jobPostingAdmin.alerts.applicantConfirmFailed'));
    } finally {
      setIsProcessing(false);
    }
  }, [canEdit, jobPosting, currentUser, t, onRefresh]);

  /**
   * 지원자 확정을 취소하는 함수
   */
  const handleCancelConfirmation = useCallback(async (applicant: Applicant) => {
    if (!jobPosting) return;
    
    // 권한 체크
    if (!canEdit) {
      toast.error('이 공고를 수정할 권한이 없습니다. 공고 작성자만 수정할 수 있습니다.');
      return;
    }

    // 확정 취소 확인 대화상자
    const confirmed = window.confirm(
      `${applicant.applicantName}님의 확정을 취소하시겠습니까?\n\n취소 시 다음 작업이 수행됩니다:\n• 지원자 상태가 '지원함'으로 변경됩니다\n• 원래 지원한 시간대는 유지됩니다\n• 확정 스태프 목록에서 제거됩니다\n• 다시 확정 선택이 가능해집니다`
    );

    if (!confirmed) return;

    setIsProcessing(true);

    try {
      const jobPostingRef = doc(db, "jobPostings", jobPosting.id);

      // 🏗️ ApplicationHistory 서비스를 통한 확정 취소 (완전한 원본 데이터 복원)
      await ApplicationHistoryService.cancelConfirmation(applicant.id);
      
      // 🔄 jobPostings 컬렉션의 confirmedStaff 배열에서 해당 지원자 항목들 제거 (필터링 방식)
      await runTransaction(db, async (transaction) => {
        // 최신 jobPosting 데이터를 transaction 내에서 가져오기
        const jobPostingDoc = await transaction.get(jobPostingRef);
        if (!jobPostingDoc.exists()) {
          throw new Error('공고를 찾을 수 없습니다.');
        }

        const currentData = jobPostingDoc.data();
        const confirmedStaffArray = currentData?.confirmedStaff ?? [];
        
        if (confirmedStaffArray.length > 0) {
          // userId 기준으로 해당 지원자의 모든 항목 필터링 (완전 제거)
          const filteredConfirmedStaff = confirmedStaffArray.filter(
            (staff: any) => (staff.userId || staff.staffId) !== applicant.applicantId
          );

          const removedCount = confirmedStaffArray.length - filteredConfirmedStaff.length;


          // 전체 confirmedStaff 배열을 필터링된 배열로 교체
          transaction.update(jobPostingRef, {
            confirmedStaff: filteredConfirmedStaff
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

      toast.success(`${applicant.applicantName}님의 확정이 취소되었습니다. (WorkLog도 함께 삭제됨)`);

      // 지원자 목록 새로고침
      onRefresh();

    } catch (error) {
      logger.error('Error cancelling confirmation:', error instanceof Error ? error : new Error(String(error)), { 
        component: 'useApplicantActions' 
      });
      toast.error('확정 취소 중 오류가 발생했습니다.');
    } finally {
      setIsProcessing(false);
    }
  }, [canEdit, jobPosting, onRefresh]);

  /**
   * 공고 자동 마감 체크 함수
   */
  const checkAutoCloseJobPosting = async (jobPostingRef: any) => {
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
        if (updatedPost.dateSpecificRequirements && updatedPost.dateSpecificRequirements.length > 0) {
          const progressMap = JobPostingUtils.getRequirementProgress(updatedPost);
          let allFulfilled = true;
          Array.from(progressMap.entries()).forEach(([_date, progress]) => {
            const percentage = progress.required > 0 ? (progress.confirmed / progress.required) * 100 : 0;
            if (percentage < 100) {
              allFulfilled = false;
            }
          });
          if (allFulfilled) {
            shouldClose = true;
            closeMessage = '모든 날짜의 인원이 충족되어 공고가 마감되었습니다.';
          }
        } else {
          // 기존 방식의 경우
          const progressMap = JobPostingUtils.getRequirementProgress(updatedPost);
          const allProgress = progressMap.get('all');
          if (allProgress) {
            const percentage = allProgress.required > 0 ? (allProgress.confirmed / allProgress.required) * 100 : 0;
            if (percentage >= 100) {
              shouldClose = true;
              closeMessage = '필요 인원이 모두 충족되어 공고가 마감되었습니다.';
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
        component: 'useApplicantActions' 
      });
    }
  };

  /**
   * 공고 자동 재개방 체크 함수
   */
  const checkAutoReopenJobPosting = async (jobPostingRef: any) => {
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
        if (updatedPost.dateSpecificRequirements && updatedPost.dateSpecificRequirements.length > 0) {
          const progressMap = JobPostingUtils.getRequirementProgress(updatedPost);
          Array.from(progressMap.entries()).some(([date, progress]) => {
            const percentage = progress.required > 0 ? (progress.confirmed / progress.required) * 100 : 0;
            if (percentage < 100) {
              shouldReopen = true;
              reopenMessage = `${date} 날짜의 인원이 부족하여 공고가 다시 열렸습니다.`;
              return true; // break the loop
            }
            return false;
          });
        } else {
          // 기존 방식의 경우
          const progressMap = JobPostingUtils.getRequirementProgress(updatedPost);
          const allProgress = progressMap.get('all');
          if (allProgress) {
            const percentage = allProgress.required > 0 ? (allProgress.confirmed / allProgress.required) * 100 : 0;
            if (percentage < 100) {
              shouldReopen = true;
              reopenMessage = '필요 인원이 부족하여 공고가 다시 열렸습니다.';
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
      logger.error('자동 마감 해제 처리 중 오류:', err instanceof Error ? err : new Error(String(err)), { 
        component: 'useApplicantActions' 
      });
      toast.error('자동 마감 해제 처리 중 오류가 발생했습니다.');
    }
  };

  /**
   * 확정 취소 후 데이터 정합성 검증 함수
   */
  const verifyDataIntegrityAfterCancel = async (jobPostingRef: any, applicantId: string) => {
    try {
      
      // jobPosting의 최종 상태 확인
      const finalDoc = await getDoc(jobPostingRef);
      if (!finalDoc.exists()) {
        logger.error('❌ 검증: jobPosting 문서가 존재하지 않음', undefined, { 
          component: 'useApplicantActions' 
        });
        return;
      }

      const finalData = finalDoc.data() as any;
      const remainingConfirmedStaff = finalData?.confirmedStaff || [];
      
      // 해당 지원자의 잔여 데이터 확인
      const remainingApplicantEntries = remainingConfirmedStaff.filter(
        (staff: any) => (staff.userId || staff.staffId) === applicantId
      );

      if (remainingApplicantEntries.length > 0) {
        logger.error('❌ 데이터 정합성 오류: confirmedStaff에 잔여 데이터 발견:', 
          new Error('Data integrity violation'), {
          component: 'useApplicantActions',
          data: {
            applicantId,
            remainingEntries: remainingApplicantEntries.map((s: any) => ({
              userId: s.userId || s.staffId,
              role: s.role,
              timeSlot: s.timeSlot,
              date: s.date
            }))
          }
        });
        
        // 강제로 다시 한번 정리 시도
        await runTransaction(db, async (transaction) => {
          const cleanedArray = remainingConfirmedStaff.filter(
            (staff: any) => (staff.userId || staff.staffId) !== applicantId
          );
          transaction.update(jobPostingRef, {
            confirmedStaff: cleanedArray
          });
        });
        
      } else {
      }
      
    } catch (err) {
      logger.error('데이터 정합성 검증 중 오류:', err instanceof Error ? err : new Error(String(err)), { 
        component: 'useApplicantActions' 
      });
    }
  };

  /**
   * 확정 취소 시 관련 WorkLog 삭제 함수 (완전 개선: 두 가지 방법 병행)
   */
  const deleteWorkLogsForCancelledStaff = async (applicantId: string, postingId: string) => {
    try {

      let deletedCount = 0;

      // 🎯 방법 1: eventId로 모든 WorkLog를 가져온 후 클라이언트에서 필터링
      const allWorkLogsQuery = query(
        collection(db, 'workLogs'),
        where('eventId', '==', postingId)
      );

      const allWorkLogsSnapshot = await getDocs(allWorkLogsQuery);

      // 클라이언트에서 staffId 필터링 (더 정확함)
      const targetWorkLogs = allWorkLogsSnapshot.docs.filter(workLogDoc => {
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
          logger.error('❌ 개별 WorkLog 삭제 실패:', 
            deleteError instanceof Error ? deleteError : new Error(String(deleteError)), {
            component: 'useApplicantActions',
            data: { 
              workLogId: workLogDoc.id,
              staffId: workLogDoc.data()?.staffId
            }
          });
        }
      }


      // 삭제 결과 검증
      if (deletedCount === 0 && targetWorkLogs.length === 0) {
      } else if (deletedCount !== targetWorkLogs.length) {
      }

    } catch (err) {
      logger.error('WorkLog 삭제 중 심각한 오류:', err instanceof Error ? err : new Error(String(err)), {
        component: 'useApplicantActions',
        data: { applicantId, postingId }
      });
      // 에러가 발생해도 전체 프로세스는 계속 진행 (확정 취소는 성공)
    }
  };

  /**
   * staff 문서 삭제 함수
   */
  const deleteStaffDocuments = async (applicantId: string, postingId: string) => {
    try {
      
      // 🚫 persons 컬렉션 삭제 로직 제거 (WorkLog 통합으로 인해 불필요)
      logger.info(`persons 삭제 스킵 (WorkLog 통합): applicantId=${applicantId}, postingId=${postingId}`, { 
        component: 'useApplicantActions'
      });
    } catch (err) {
      logger.error('staff 컬렉션 자동 삭제 중 오류:', err instanceof Error ? err : new Error(String(err)), { 
        component: 'useApplicantActions' 
      });
      toast.error('staff 컬렉션 자동 삭제 중 오류가 발생했습니다.');
    }
  };

  return {
    canEdit,
    isProcessing,
    handleConfirmApplicant,
    handleCancelConfirmation
  };
};