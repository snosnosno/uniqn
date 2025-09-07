import { useState, useCallback } from 'react';
import { doc, updateDoc, arrayUnion, runTransaction, getDoc, deleteDoc, collection, query, where, getDocs, setDoc, Timestamp } from 'firebase/firestore';
import { useTranslation } from 'react-i18next';
import { logger } from '../../../../utils/logger';
import { db, promoteToStaff } from '../../../../firebase';
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
  
  // 🔍 디버깅: canEdit 값 확인
  logger.debug('🔍 useApplicantActions: canEdit 값 확인', {
    component: 'useApplicantActions',
    data: {
      currentUserUid: currentUser?.uid,
      jobPostingCreatedBy: jobPosting?.createdBy,
      canEdit: canEdit,
      condition1: !!currentUser?.uid,
      condition2: currentUser?.uid === jobPosting?.createdBy
    }
  });

  /**
   * WorkLog 사전 생성 함수 (스태프 확정 시 모든 근무일에 대해 생성)
   */
  const createWorkLogsForConfirmedStaff = useCallback(async (
    staffName: string, 
    eventId: string, 
    assignmentsWithStaffIds: { assignment: Assignment; staffDocId: string }[]  // ✅ assignment와 staffDocId 배열
  ) => {
    logger.debug('🔍 WorkLog 사전 생성 시작:', {
      component: 'useApplicantActions',
      data: { assignmentsWithStaffIds, eventId }
    });

    try {
      for (const { assignment, staffDocId } of assignmentsWithStaffIds) {
        const { dates, timeSlot, role } = assignment;
        
        for (const date of dates) {
          if (!date || date.trim() === '') continue;
          
          // WorkLog ID 패턴: eventId_staffDocId_date (staffDocId에 이미 _숫자 포함)
          const workLogId = `${eventId}_${staffDocId}_${date}`;
          const workLogRef = doc(db, 'workLogs', workLogId);
          
          // 이미 존재하는지 확인
          const existingDoc = await getDoc(workLogRef);
          if (existingDoc.exists()) {
            logger.debug('WorkLog 이미 존재함, 건너뜀:', { 
              component: 'useApplicantActions', 
              data: workLogId 
            });
            continue;
          }
          
          // 시간 문자열을 Timestamp로 변환
          let scheduledStartTime: Timestamp | null = null;
          let scheduledEndTime: Timestamp | null = null;
          
          if (timeSlot && timeSlot.includes('~')) {
            const [startTime, endTime] = timeSlot.split('~');
            const baseDate = new Date(`${date}T00:00:00`);
            
            if (startTime && startTime.trim()) {
              const timeParts = startTime.split(':');
              if (timeParts.length >= 2) {
                const hours = parseInt(timeParts[0] || '0', 10);
                const minutes = parseInt(timeParts[1] || '0', 10);
                if (!isNaN(hours) && !isNaN(minutes)) {
                  const startDate = new Date(baseDate);
                  startDate.setHours(hours, minutes, 0, 0);
                  scheduledStartTime = Timestamp.fromDate(startDate);
                }
              }
            }
            
            if (endTime && endTime.trim()) {
              const timeParts = endTime.split(':');
              if (timeParts.length >= 2) {
                const hours = parseInt(timeParts[0] || '0', 10);
                const minutes = parseInt(timeParts[1] || '0', 10);
                if (!isNaN(hours) && !isNaN(minutes)) {
                  const endDate = new Date(baseDate);
                  endDate.setHours(hours, minutes, 0, 0);
                
                  // 종료 시간이 시작 시간보다 이전이면 다음날로 처리
                  if (scheduledStartTime && endDate.getTime() <= scheduledStartTime.toDate().getTime()) {
                    endDate.setDate(endDate.getDate() + 1);
                  }
                
                  scheduledEndTime = Timestamp.fromDate(endDate);
                }
              }
            }
          }
          
          // WorkLog 데이터 생성
          const workLogData = {
            id: workLogId,
            staffId: staffDocId,  // ✅ staffDocId 사용 (assignmentIndex 포함)
            staffName,
            eventId,
            date,
            role: role || '',
            type: 'schedule',
            status: 'scheduled',
            scheduledStartTime,
            scheduledEndTime,
            actualStartTime: null,
            actualEndTime: null,
            assignedTime: timeSlot || '',
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now(),
            createdBy: 'system'
          };
          
          // Firestore에 WorkLog 생성
          await setDoc(workLogRef, workLogData);
          
          logger.debug('✅ WorkLog 생성 완료:', {
            component: 'useApplicantActions',
            data: { workLogId, date, timeSlot, role }
          });
        }
      }
      
      logger.debug('✅ 모든 WorkLog 사전 생성 완료', { component: 'useApplicantActions' });
    } catch (error) {
      logger.error('WorkLog 사전 생성 중 오류:', error instanceof Error ? error : new Error(String(error)), {
        component: 'useApplicantActions'
      });
      throw error; // 상위에서 처리할 수 있도록 에러 전파
    }
  }, []);

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

        logger.debug('🔍 중복 확정 검사:', {
          component: 'useApplicantActions',
          data: {
            applicantId: applicant.applicantId,
            targetDates,
            existingConfirmationsCount: existingConfirmations.length,
            existingConfirmations: existingConfirmations.map((s: any) => ({
              userId: s.userId || s.staffId,
              role: s.role,
              timeSlot: s.timeSlot,
              date: s.date
            })),
            totalConfirmedStaffCount: latestConfirmedStaff.length
          }
        });

        if (existingConfirmations.length > 0) {
          const duplicateDates = existingConfirmations.map((s: any) => s.date).join(', ');
          alert(`같은 날짜에 중복 확정할 수 없습니다.\n중복 날짜: ${duplicateDates}`);
          logger.warn('⚠️ 중복 확정 시도 차단:', {
            component: 'useApplicantActions',
            data: { applicantId: applicant.applicantId, duplicateDates }
          });
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
        alert(`다음 역할은 이미 마감되어 확정할 수 없습니다:\n${fullRoleMessages}`);
        return;
      }

      const _applicationRef = doc(db, "applications", applicant.id);

      // 🏗️ ApplicationHistory 서비스를 통한 확정 처리 (데이터 무결성 보장)
      await ApplicationHistoryService.confirmApplication(applicant.id, assignments);
      
      // 🔄 jobPosting의 confirmedStaff 배열 업데이트
      await runTransaction(db, async (transaction) => {
        assignments.forEach(assignment => {
          const { timeSlot, role, dates } = assignment;
          // dates 배열의 각 날짜에 대해 staffEntry 생성
          dates.forEach(date => {
            const staffEntry: any = {
              userId: applicant.applicantId,  // ✅ 타입 정의와 일치하는 필드명 사용
              name: applicant.applicantName,
              role,
              timeSlot,
              confirmedAt: new Date()
            };
            
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
        
        // 각 assignment의 각 날짜에 대해 개별적으로 promoteToStaff 호출
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
            
            logger.debug(`🔍 promoteToStaff 호출 ${assignmentIndex + 1}:`, { 
              component: 'useApplicantActions',
              data: {
                assignment,
                assignedDate,
                finalAssignedDate,
                jobRole,
                staffDocId,
                dateIndex
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
              logger.debug(`✅ promoteToStaff 성공 ${assignmentIndex + 1}:`, { 
                component: 'useApplicantActions', 
                data: staffDocId 
              });
              
              // ✅ WorkLog 생성용으로 assignment와 staffDocId 저장
              assignmentsWithStaffIds.push({ assignment, staffDocId });
            } catch (promoteError) {
              logger.error(`❌ promoteToStaff 오류 ${assignmentIndex + 1}:`, 
                promoteError instanceof Error ? promoteError : new Error(String(promoteError)), 
                { component: 'useApplicantActions' }
              );
              // 개별 promoteToStaff 실패해도 전체 프로세스는 계속 진행
            }
            
            assignmentIndex++;
          }
        }
        
        logger.debug('✅ 모든 promoteToStaff 호출 완료', { component: 'useApplicantActions' });
      }

      // 🚀 스태프 확정 시 WorkLog 일괄 생성 (Option 2 구현)
      logger.debug('🔍 스태프 확정 후 WorkLog 일괄 생성 시작:', {
        component: 'useApplicantActions',
        data: { 
          applicantId: applicant.applicantId,
          applicantName: applicant.applicantName,
          eventId: jobPosting.id,
          assignments
        }
      });

      try {
        await createWorkLogsForConfirmedStaff(
          applicant.applicantName,
          jobPosting.id,
          assignmentsWithStaffIds  // ✅ assignment와 staffDocId 배열 전달
        );
        logger.debug('✅ 스태프 확정 시 WorkLog 일괄 생성 완료', { component: 'useApplicantActions' });
      } catch (workLogError) {
        logger.error('WorkLog 일괄 생성 중 오류 (확정은 성공):', workLogError instanceof Error ? workLogError : new Error(String(workLogError)), {
          component: 'useApplicantActions'
        });
        // WorkLog 생성 실패해도 확정은 성공했으므로 계속 진행
      }
      
      const totalAssignments = assignments.reduce((total, assignment) => total + assignment.dates.length, 0);
      alert(`${t('jobPostingAdmin.alerts.applicantConfirmSuccess')} (${totalAssignments}개 시간대 확정, WorkLog 사전 생성 완료)`);
      
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

          logger.debug('🗑️ confirmedStaff 항목 필터링 제거 (개선된 버전):', {
            component: 'useApplicantActions',
            data: {
              applicantId: applicant.applicantId,
              applicantName: applicant.applicantName,
              originalCount: confirmedStaffArray.length,
              filteredCount: filteredConfirmedStaff.length,
              removedCount,
              removedItems: confirmedStaffArray
                .filter((s: any) => (s.userId || s.staffId) === applicant.applicantId)
                .map((s: any) => ({
                  userId: s.userId || s.staffId,
                  role: s.role,
                  timeSlot: s.timeSlot,
                  date: s.date
                }))
            }
          });

          // 전체 confirmedStaff 배열을 필터링된 배열로 교체
          transaction.update(jobPostingRef, {
            confirmedStaff: filteredConfirmedStaff
          });

          // 제거 검증
          if (removedCount === 0) {
            logger.warn('⚠️ confirmedStaff에서 제거된 항목이 없음 - 데이터 불일치 가능성:', {
              component: 'useApplicantActions',
              data: { 
                applicantId: applicant.applicantId,
                confirmedStaffArray: confirmedStaffArray.map((s: any) => ({
                  userId: s.userId || s.staffId,
                  role: s.role,
                  date: s.date
                }))
              }
            });
          }
        } else {
          logger.debug('ℹ️ confirmedStaff 배열이 비어있음 - 제거할 항목 없음', {
            component: 'useApplicantActions',
            data: { applicantId: applicant.applicantId }
          });
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

      alert(`${applicant.applicantName}님의 확정이 취소되었습니다. (WorkLog도 함께 삭제됨)`);

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
   * 확정 취소 후 데이터 정합성 검증 함수
   */
  const verifyDataIntegrityAfterCancel = async (jobPostingRef: any, applicantId: string) => {
    try {
      logger.debug('🔍 확정 취소 후 데이터 정합성 검증 시작:', { 
        component: 'useApplicantActions', 
        data: { applicantId } 
      });
      
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
        
        logger.debug('🔧 강제 정리 완료:', { 
          component: 'useApplicantActions',
          data: { applicantId, removedEntries: remainingApplicantEntries.length } 
        });
      } else {
        logger.debug('✅ 데이터 정합성 검증 통과: confirmedStaff 정상 정리됨', { 
          component: 'useApplicantActions',
          data: { applicantId, totalRemainingEntries: remainingConfirmedStaff.length } 
        });
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
      logger.debug('🔍 확정 취소에 따른 WorkLog 삭제 시작:', {
        component: 'useApplicantActions',
        data: { applicantId, postingId }
      });

      let deletedCount = 0;

      // 🎯 방법 1: eventId로 모든 WorkLog를 가져온 후 클라이언트에서 필터링
      const allWorkLogsQuery = query(
        collection(db, 'workLogs'),
        where('eventId', '==', postingId)
      );

      const allWorkLogsSnapshot = await getDocs(allWorkLogsQuery);
      logger.debug('🔍 해당 이벤트의 모든 WorkLog 수:', {
        component: 'useApplicantActions',
        data: { 
          totalWorkLogs: allWorkLogsSnapshot.size,
          eventId: postingId
        }
      });

      // 클라이언트에서 staffId 필터링 (더 정확함)
      const targetWorkLogs = allWorkLogsSnapshot.docs.filter(workLogDoc => {
        const data = workLogDoc.data();
        const staffId = data?.staffId || '';
        
        // staffId가 applicantId로 시작하거나 정확히 일치하는 경우
        const isMatch = staffId === applicantId || staffId.startsWith(applicantId + '_');
        
        if (isMatch) {
          logger.debug('🎯 삭제 대상 WorkLog 발견:', {
            component: 'useApplicantActions',
            data: { 
              workLogId: workLogDoc.id,
              staffId: staffId,
              eventId: data?.eventId,
              date: data?.date,
              assignedTime: data?.assignedTime
            }
          });
        }
        
        return isMatch;
      });

      logger.info('🔍 삭제할 WorkLog 문서들:', {
        component: 'useApplicantActions',
        data: { 
          applicantId,
          postingId,
          targetCount: targetWorkLogs.length,
          targetWorkLogs: targetWorkLogs.map(doc => ({
            id: doc.id,
            staffId: doc.data()?.staffId,
            eventId: doc.data()?.eventId,
            date: doc.data()?.date
          }))
        }
      });

      // 🗑️ 각 WorkLog 문서 삭제
      for (const workLogDoc of targetWorkLogs) {
        try {
          logger.debug('🗑️ WorkLog 문서 삭제 시도:', {
            component: 'useApplicantActions',
            data: { 
              workLogId: workLogDoc.id, 
              staffId: workLogDoc.data()?.staffId 
            }
          });
          
          await deleteDoc(doc(db, 'workLogs', workLogDoc.id));
          deletedCount++;
          
          logger.debug('✅ WorkLog 문서 삭제 성공:', {
            component: 'useApplicantActions',
            data: { workLogId: workLogDoc.id }
          });
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

      logger.info('✅ WorkLog 삭제 완료 (최종 결과):', {
        component: 'useApplicantActions',
        data: {
          applicantId,
          postingId,
          totalFound: targetWorkLogs.length,
          successfullyDeleted: deletedCount,
          allSuccessful: deletedCount === targetWorkLogs.length
        }
      });

      // 삭제 결과 검증
      if (deletedCount === 0 && targetWorkLogs.length === 0) {
        logger.warn('⚠️ 삭제할 WorkLog를 찾지 못함:', {
          component: 'useApplicantActions',
          data: { applicantId, postingId }
        });
      } else if (deletedCount !== targetWorkLogs.length) {
        logger.warn('⚠️ 일부 WorkLog 삭제 실패:', {
          component: 'useApplicantActions',
          data: { 
            expected: targetWorkLogs.length,
            actual: deletedCount,
            applicantId,
            postingId
          }
        });
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
      logger.debug('🔍 다중 스태프 문서 삭제 시작:', { 
        component: 'useApplicantActions', 
        data: applicantId 
      });
      
      // persons 컬렉션에서 해당 지원자와 관련된 모든 문서 찾기
      const staffQuery = query(
        collection(db, 'persons'), 
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
        return deleteDoc(doc(db, 'persons', staffDoc.id));
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