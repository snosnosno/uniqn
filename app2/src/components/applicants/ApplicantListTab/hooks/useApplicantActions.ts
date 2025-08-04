import { useState, useCallback } from 'react';
import { doc, updateDoc, arrayUnion, arrayRemove, runTransaction, getDoc, deleteDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { useTranslation } from 'react-i18next';
import { logger } from '../../../../utils/logger';
import { db, promoteToStaff } from '../../../../firebase';
import { JobPostingUtils, JobPosting } from '../../../../types/jobPosting';
import { Applicant, Assignment } from '../types';
import { jobRoleMap } from '../utils/applicantHelpers';

interface UseApplicantActionsProps {
  jobPosting?: any;
  currentUser?: any;
  onRefresh: () => void;
}

/**
 * 지원자 확정/취소 액션을 관리하는 Custom Hook
 */
export const useApplicantActions = ({ jobPosting, currentUser, onRefresh }: UseApplicantActionsProps) => {
  const { t } = useTranslation();
  const [isProcessing, setIsProcessing] = useState(false);

  // 권한 체크 - 공고 작성자만 수정 가능
  const canEdit = currentUser?.uid && currentUser.uid === jobPosting?.createdBy;

  /**
   * 지원자를 확정하는 함수
   */
  const handleConfirmApplicant = useCallback(async (applicant: Applicant, assignments: Assignment[]) => {
    // 권한 체크
    if (!canEdit) {
      alert('이 공고를 수정할 권한이 없습니다. 공고 작성자만 수정할 수 있습니다.');
      return;
    }
    
    logger.debug('🔍 handleConfirmApplicant 시작:', { 
      component: 'useApplicantActions',
      data: {
        applicantId: applicant.id,
        applicantName: applicant.applicantName,
        assignments,
        assignmentsLength: assignments?.length
      }
    });
    
    if (!assignments || assignments.length === 0) {
      alert(t('jobPostingAdmin.alerts.selectRoleToAssign'));
      return;
    }
    if (!jobPosting) return;
    
    setIsProcessing(true);
    
    try {
      // 같은 날짜 중복 확정 방지 검사
      const targetDates = assignments
        .map(a => a.date)
        .filter(date => date && date.trim() !== '');
      
      if (targetDates.length > 0) {
        const existingConfirmations = (jobPosting.confirmedStaff || []).filter((staff: any) => 
          staff.userId === applicant.applicantId && 
          targetDates.includes(staff.date)
        );

        if (existingConfirmations.length > 0) {
          alert(`같은 날짜에 중복 확정할 수 없습니다.`);
          return;
        }
      }

      // 선택된 역할들이 마감되었는지 확인
      const fullRoles = assignments.filter(assignment => {
        // 날짜별 요구사항만 사용하므로 date는 필수
        if (!assignment.date) return false;
        
        return JobPostingUtils.isRoleFull(
          jobPosting,
          assignment.timeSlot,
          assignment.role,
          assignment.date
        );
      });
      
      if (fullRoles.length > 0) {
        const fullRoleMessages = fullRoles.map(assignment => 
          `${assignment.date ? `${assignment.date} ` : ''}${assignment.timeSlot} - ${assignment.role}`
        ).join(', ');
        alert(`다음 역할은 이미 마감되어 확정할 수 없습니다:\n${fullRoleMessages}`);
        return;
      }

      const jobPostingRef = doc(db, "jobPostings", jobPosting.id);
      const applicationRef = doc(db, "applications", applicant.id);

      await runTransaction(db, async (transaction) => {
        // Update job posting with all confirmed staff assignments
        assignments.forEach(assignment => {
          const { timeSlot, role, date } = assignment;
          const staffEntry: any = {
            userId: applicant.applicantId,
            role,
            timeSlot
          };
          
          // date가 존재하고 유효한 값일 때만 추가
          if (date && date.trim() !== '') {
            staffEntry.date = date;
          }
          
          transaction.update(jobPostingRef, {
            confirmedStaff: arrayUnion(staffEntry)
          });
        });
        
        // Update application status with multiple assignments
        const confirmedAt = new Date();
        
        transaction.update(applicationRef, {
          status: 'confirmed',
          confirmedAt: confirmedAt,
          // 기존 단일 필드는 첫 번째 항목으로 설정 (하위 호환성)
          assignedRole: assignments[0]?.role || '',
          assignedTime: assignments[0]?.timeSlot || '',
          assignedDate: assignments[0]?.date || '',
          // 새로운 다중 선택 필드들
          assignedRoles: assignments.map(a => a.role),
          assignedTimes: assignments.map(a => a.timeSlot),
          assignedDates: assignments.map(a => String(a.date || '')),
        });
      });

      // 각 assignment마다 별도의 스태프 문서 생성 (다중 날짜/시간대 지원)
      if (currentUser && assignments.length > 0) {
        logger.debug('🔍 다중 promoteToStaff 호출 시작:', { 
          component: 'useApplicantActions',
          data: {
            assignments,
            assignmentsCount: assignments.length,
            applicantId: applicant.applicantId,
            applicantName: applicant.applicantName
          }
        });
        
        // 각 assignment에 대해 개별적으로 promoteToStaff 호출
        for (let i = 0; i < assignments.length; i++) {
          const assignment = assignments[i];
          const assignedDate = String(assignment?.date || '');
          
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
          
          // 고유한 문서 ID 생성 (userId + assignment index)
          const staffDocId = `${applicant.applicantId}_${i}`;
          
          logger.debug(`🔍 promoteToStaff 호출 ${i + 1}/${assignments.length}:`, { 
            component: 'useApplicantActions',
            data: {
              assignment,
              assignedDate,
              finalAssignedDate,
              jobRole,
              staffDocId
            }
          });
          
          try {
            await promoteToStaff(
              staffDocId, // 고유한 문서 ID 사용
              applicant.applicantName, 
              jobRole, 
              jobPosting.id, 
              currentUser.uid,
              assignment?.role || '',      // assignedRole - 지원자에서 확정된 역할
              assignment?.timeSlot || '',  // assignedTime - 지원자에서 확정된 시간
              applicant.email || '', // email 정보
              applicant.phone || '',  // phone 정보
              finalAssignedDate, // assignedDate - 지원자에서 확정된 날짜 (기본값 포함)
              applicant.applicantId // 실제 사용자 ID
            );
            logger.debug(`✅ promoteToStaff 성공 ${i + 1}/${assignments.length}:`, { 
              component: 'useApplicantActions', 
              data: staffDocId 
            });
          } catch (promoteError) {
            logger.error(`❌ promoteToStaff 오류 ${i + 1}/${assignments.length}:`, 
              promoteError instanceof Error ? promoteError : new Error(String(promoteError)), 
              { component: 'useApplicantActions' }
            );
            // 개별 promoteToStaff 실패해도 전체 프로세스는 계속 진행
          }
        }
        
        logger.debug('✅ 모든 promoteToStaff 호출 완료', { component: 'useApplicantActions' });
      }
      
      alert(`${t('jobPostingAdmin.alerts.applicantConfirmSuccess')} (${assignments.length}개 시간대 확정)`);
      
      // 자동 마감 로직 체크
      await checkAutoCloseJobPosting(jobPostingRef);
      
      // 지원자 목록 새로고침
      onRefresh();
      
    } catch (error) {
      logger.error('Error confirming applicant: ', error instanceof Error ? error : new Error(String(error)), { 
        component: 'useApplicantActions' 
      });
      alert(t('jobPostingAdmin.alerts.applicantConfirmFailed'));
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
      alert('이 공고를 수정할 권한이 없습니다. 공고 작성자만 수정할 수 있습니다.');
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
      const applicationRef = doc(db, "applications", applicant.id);

      await runTransaction(db, async (transaction) => {
        // 1. applications 컬렉션에서 상태 변경 (원래 지원 정보는 유지)
        transaction.update(applicationRef, {
          status: 'applied',
          // 확정 시 추가된 단일 선택 필드들은 제거
          assignedRole: null,
          assignedTime: null,
          assignedDate: null,
          // 확정 관련 필드 제거
          confirmedAt: null,
          cancelledAt: new Date()
          // 원래 지원 정보(assignedRoles[], assignedTimes[], assignedDates[])는 유지
        });

        // 2. jobPostings 컬렉션의 confirmedStaff 배열에서 해당 지원자 항목들 제거
        if (jobPosting.confirmedStaff && jobPosting.confirmedStaff.length > 0) {
          const staffEntriesToRemove = jobPosting.confirmedStaff.filter(
            (staff: any) => staff.userId === applicant.applicantId
          );

          // 각 항목을 개별적으로 제거
          staffEntriesToRemove.forEach((staffEntry: any) => {
            transaction.update(jobPostingRef, {
              confirmedStaff: arrayRemove(staffEntry)
            });
          });
        }
      });

      // 자동 마감 해제 체크
      await checkAutoReopenJobPosting(jobPostingRef);

      // staff 컬렉션 자동 삭제 (다중 문서 지원)
      await deleteStaffDocuments(applicant.applicantId, jobPosting.id);

      alert(`${applicant.applicantName}님의 확정이 취소되었습니다.`);

      // 지원자 목록 새로고침
      onRefresh();

    } catch (error) {
      logger.error('Error cancelling confirmation:', error instanceof Error ? error : new Error(String(error)), { 
        component: 'useApplicantActions' 
      });
      alert('확정 취소 중 오류가 발생했습니다.');
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
          Array.from(progressMap.entries()).forEach(([date, progress]) => {
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
          alert(closeMessage);
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
          alert(reopenMessage);
        }
      }
    } catch (err) {
      logger.error('자동 마감 해제 처리 중 오류:', err instanceof Error ? err : new Error(String(err)), { 
        component: 'useApplicantActions' 
      });
      alert('자동 마감 해제 처리 중 오류가 발생했습니다.');
    }
  };

  /**
   * staff 문서 삭제 함수
   */
  const deleteStaffDocuments = async (applicantId: string, postingId: string) => {
    try {
      logger.debug('🔍 다중 스태프 문서 삭제 시작:', { 
        component: 'useApplicantActions', 
        data: applicantId 
      });
      
      // 해당 지원자와 관련된 모든 스태프 문서 찾기
      const staffQuery = query(
        collection(db, 'staff'), 
        where('userId', '==', applicantId),
        where('postingId', '==', postingId)
      );
      
      const staffSnapshot = await getDocs(staffQuery);
      logger.debug('🔍 삭제할 스태프 문서 수:', { 
        component: 'useApplicantActions', 
        data: staffSnapshot.size 
      });
      
      // 각 스태프 문서 개별 삭제
      const deletePromises = staffSnapshot.docs.map(async (staffDoc) => {
        logger.debug('🗑️ 스태프 문서 삭제:', { 
          component: 'useApplicantActions', 
          data: staffDoc.id 
        });
        return deleteDoc(doc(db, 'staff', staffDoc.id));
      });
      
      await Promise.all(deletePromises);
      logger.debug('✅ 모든 스태프 문서 삭제 완료', { component: 'useApplicantActions' });
    } catch (err) {
      logger.error('staff 컬렉션 자동 삭제 중 오류:', err instanceof Error ? err : new Error(String(err)), { 
        component: 'useApplicantActions' 
      });
      alert('staff 컬렉션 자동 삭제 중 오류가 발생했습니다.');
    }
  };

  return {
    canEdit,
    isProcessing,
    handleConfirmApplicant,
    handleCancelConfirmation
  };
};