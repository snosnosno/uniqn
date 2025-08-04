import { Timestamp, doc, updateDoc, runTransaction } from 'firebase/firestore';
import { db } from '../firebase';
import { logger } from '../utils/logger';
import { Assignment } from '../components/applicants/ApplicantListTab/types';

/**
 * 지원 히스토리 정보
 */
export interface ApplicationHistoryEntry {
  confirmedAt: Timestamp;
  cancelledAt?: Timestamp;
  assignments: Assignment[];
}

/**
 * 지원 상태 정보
 */
export interface ApplicationStateInfo {
  status: 'applied' | 'confirmed' | 'cancelled';
  originalApplication: {
    roles: string[];
    times: string[];
    dates: string[];
    appliedAt: Timestamp;
  };
  confirmationHistory: ApplicationHistoryEntry[];
  lastModified: Timestamp;
}

/**
 * 지원자 상태 전환 히스토리를 관리하는 서비스 클래스
 * 
 * 핵심 기능:
 * 1. 상태 전환 시 원본 데이터 완전 보존
 * 2. 확정/취소 히스토리 추적
 * 3. 데이터 무결성 보장
 */
export class ApplicationHistoryService {
  
  /**
   * 지원자 확정 처리 (히스토리 기반)
   */
  static async confirmApplication(
    applicationId: string,
    assignments: Assignment[]
  ): Promise<void> {
    try {
      logger.debug('🏗️ ApplicationHistoryService.confirmApplication 시작:', {
        component: 'ApplicationHistoryService',
        data: { applicationId, assignmentsCount: assignments.length }
      });

      const applicationRef = doc(db, 'applications', applicationId);
      
      await runTransaction(db, async (transaction) => {
        // 현재 지원서 데이터 가져오기
        const applicationDoc = await transaction.get(applicationRef);
        if (!applicationDoc.exists()) {
          throw new Error('지원서를 찾을 수 없습니다.');
        }

        const currentData = applicationDoc.data();
        
        // 원본 지원 데이터 보존 (최초 확정 시에만)
        const originalApplication = currentData.originalApplication || {
          roles: currentData.assignedRoles || [currentData.assignedRole].filter(Boolean),
          times: currentData.assignedTimes || [currentData.assignedTime].filter(Boolean),
          dates: currentData.assignedDates || [currentData.assignedDate].filter(Boolean),
          appliedAt: currentData.appliedAt || Timestamp.now()
        };

        // 새로운 확정 히스토리 항목
        const newHistoryEntry: ApplicationHistoryEntry = {
          confirmedAt: Timestamp.now(),
          assignments: assignments
        };

        // 기존 히스토리에 추가
        const confirmationHistory = currentData.confirmationHistory || [];
        confirmationHistory.push(newHistoryEntry);

        // 지원서 업데이트
        transaction.update(applicationRef, {
          status: 'confirmed',
          confirmedAt: Timestamp.now(),
          
          // 🔄 원본 데이터 완전 보존
          originalApplication,
          confirmationHistory,
          
          // 단일 필드 (하위 호환성)
          assignedRole: assignments[0]?.role || '',
          assignedTime: assignments[0]?.timeSlot || '',
          assignedDate: assignments[0]?.date || '',
          
          // 다중 선택 필드
          assignedRoles: assignments.map(a => a.role),
          assignedTimes: assignments.map(a => a.timeSlot),
          assignedDates: assignments.map(a => String(a.date || '')),
          
          // 메타데이터
          lastModified: Timestamp.now(),
          updatedAt: Timestamp.now()
        });
      });

      logger.debug('✅ 지원자 확정 히스토리 저장 완료:', {
        component: 'ApplicationHistoryService',
        data: { applicationId, assignmentsCount: assignments.length }
      });

    } catch (error) {
      logger.error('❌ 지원자 확정 히스토리 저장 오류:', 
        error instanceof Error ? error : new Error(String(error)), 
        { component: 'ApplicationHistoryService' }
      );
      throw error;
    }
  }

  /**
   * 지원자 확정 취소 처리 (원본 데이터 완전 복원)
   */
  static async cancelConfirmation(applicationId: string): Promise<void> {
    try {
      logger.debug('🔄 ApplicationHistoryService.cancelConfirmation 시작:', {
        component: 'ApplicationHistoryService',
        data: { applicationId }
      });

      const applicationRef = doc(db, 'applications', applicationId);
      
      await runTransaction(db, async (transaction) => {
        // 현재 지원서 데이터 가져오기
        const applicationDoc = await transaction.get(applicationRef);
        if (!applicationDoc.exists()) {
          throw new Error('지원서를 찾을 수 없습니다.');
        }

        const currentData = applicationDoc.data();
        
        // 원본 지원 데이터 확인
        const originalApplication = currentData.originalApplication;
        if (!originalApplication) {
          throw new Error('원본 지원 데이터를 찾을 수 없습니다.');
        }

        // 최신 확정 히스토리에 취소 시간 추가
        const confirmationHistory = currentData.confirmationHistory || [];
        if (confirmationHistory.length > 0) {
          const lastEntry = confirmationHistory[confirmationHistory.length - 1];
          lastEntry.cancelledAt = Timestamp.now();
        }

        // 지원서 상태를 'applied'로 복원하고 원본 데이터 완전 복원
        transaction.update(applicationRef, {
          status: 'applied',
          
          // 🔄 원본 지원 데이터 완전 복원
          assignedRoles: originalApplication.roles,
          assignedTimes: originalApplication.times,
          assignedDates: originalApplication.dates,
          
          // 단일 필드도 원본으로 복원 (첫 번째 값)
          assignedRole: originalApplication.roles[0] || null,
          assignedTime: originalApplication.times[0] || null,
          assignedDate: originalApplication.dates[0] || null,
          
          // 확정 관련 필드 제거
          confirmedAt: null,
          cancelledAt: Timestamp.now(),
          
          // 히스토리 업데이트
          confirmationHistory,
          
          // 메타데이터
          lastModified: Timestamp.now(),
          updatedAt: Timestamp.now()
        });
      });

      logger.debug('✅ 확정 취소 및 원본 데이터 복원 완료:', {
        component: 'ApplicationHistoryService',
        data: { applicationId }
      });

    } catch (error) {
      logger.error('❌ 확정 취소 처리 오류:', 
        error instanceof Error ? error : new Error(String(error)), 
        { component: 'ApplicationHistoryService' }
      );
      throw error;
    }
  }

  /**
   * 지원자 지원 취소 처리
   */
  static async cancelApplication(applicationId: string): Promise<void> {
    try {
      logger.debug('❌ ApplicationHistoryService.cancelApplication 시작:', {
        component: 'ApplicationHistoryService',
        data: { applicationId }
      });

      const applicationRef = doc(db, 'applications', applicationId);
      
      await updateDoc(applicationRef, {
        status: 'cancelled',
        cancelledAt: Timestamp.now(),
        lastModified: Timestamp.now(),
        updatedAt: Timestamp.now()
      });

      logger.debug('✅ 지원 취소 처리 완료:', {
        component: 'ApplicationHistoryService',
        data: { applicationId }
      });

    } catch (error) {
      logger.error('❌ 지원 취소 처리 오류:', 
        error instanceof Error ? error : new Error(String(error)), 
        { component: 'ApplicationHistoryService' }
      );
      throw error;
    }
  }

  /**
   * 지원자의 원본 지원 데이터 가져오기
   */
  static getOriginalApplicationData(applicantData: any): {
    roles: string[];
    times: string[];  
    dates: string[];
  } {
    // 히스토리에서 원본 데이터 우선 사용
    if (applicantData.originalApplication) {
      return {
        roles: applicantData.originalApplication.roles || [],
        times: applicantData.originalApplication.times || [],
        dates: applicantData.originalApplication.dates || []
      };
    }

    // 히스토리가 없는 경우 현재 배열 데이터 사용
    if (applicantData.assignedRoles?.length || 
        applicantData.assignedTimes?.length || 
        applicantData.assignedDates?.length) {
      return {
        roles: applicantData.assignedRoles || [],
        times: applicantData.assignedTimes || [],
        dates: applicantData.assignedDates || []
      };
    }

    // 배열 데이터도 없는 경우 단일 필드 사용
    return {
      roles: applicantData.assignedRole ? [applicantData.assignedRole] : [],
      times: applicantData.assignedTime ? [applicantData.assignedTime] : [],
      dates: applicantData.assignedDate ? [applicantData.assignedDate] : []
    };
  }

  /**
   * 지원자의 확정 히스토리 가져오기
   */
  static getConfirmationHistory(applicantData: any): ApplicationHistoryEntry[] {
    return applicantData.confirmationHistory || [];
  }

  /**
   * 지원자의 현재 활성 확정 정보 가져오기 (취소되지 않은 최신 확정)
   */
  static getCurrentConfirmation(applicantData: any): ApplicationHistoryEntry | null {
    const history = this.getConfirmationHistory(applicantData);
    
    // 취소되지 않은 가장 최근 확정 찾기
    for (let i = history.length - 1; i >= 0; i--) {
      const entry = history[i];
      if (entry && !entry.cancelledAt) {
        return entry;
      }
    }
    
    return null;
  }

  /**
   * 확정된 지원자의 실제 선택사항만 가져오기 (확정된 assignments만)
   * 
   * @param applicantData 지원자 데이터
   * @returns 확정된 선택사항 배열 (role, time, date)
   */
  static getConfirmedSelections(applicantData: any): Array<{role: string, time: string, date: string}> {
    if (applicantData.status !== 'confirmed') {
      return [];
    }

    // 현재 활성 확정 정보 가져오기
    const currentConfirmation = this.getCurrentConfirmation(applicantData);
    
    if (currentConfirmation && currentConfirmation.assignments) {
      // 확정 히스토리에서 실제 선택된 assignments 반환
      return currentConfirmation.assignments.map(assignment => ({
        role: assignment.role,
        time: assignment.timeSlot,
        date: assignment.date
      }));
    }

    // 히스토리가 없는 경우 현재 저장된 확정 데이터 사용
    const confirmedRoles = applicantData.assignedRoles || [];
    const confirmedTimes = applicantData.assignedTimes || [];
    const confirmedDates = applicantData.assignedDates || [];
    
    const selections = [];
    const maxLength = Math.max(confirmedRoles.length, confirmedTimes.length, confirmedDates.length);
    
    for (let i = 0; i < maxLength; i++) {
      selections.push({
        role: confirmedRoles[i] || '',
        time: confirmedTimes[i] || '',
        date: confirmedDates[i] || ''
      });
    }
    
    return selections;
  }

  /**
   * 데이터 무결성 검증
   */
  static validateApplicationData(applicantData: any): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    // 기본 필드 검증
    if (!applicantData.applicantId) {
      errors.push('applicantId가 없습니다.');
    }

    if (!applicantData.status || !['applied', 'confirmed', 'cancelled'].includes(applicantData.status)) {
      errors.push('유효하지 않은 status입니다.');
    }

    // 원본 데이터 검증 (확정된 경우)
    if (applicantData.status === 'confirmed') {
      const originalApp = applicantData.originalApplication;
      if (!originalApp || 
          !originalApp.roles?.length || 
          !originalApp.times?.length || 
          !originalApp.dates?.length) {
        errors.push('확정된 지원서에 원본 데이터가 없습니다.');
      }

      if (!applicantData.confirmationHistory?.length) {
        errors.push('확정된 지원서에 히스토리가 없습니다.');
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}