import { Timestamp, doc, updateDoc, runTransaction } from 'firebase/firestore';
import { db } from '../firebase';
import { logger } from '../utils/logger';
import { 
  Application, 
  Assignment, 
  ApplicationHistoryEntry,
  LegacyApplication 
} from '../types/application';
// ApplicationMigration import 제거 - 개발 단계에서 불필요

/**
 * 🔄 v2.0 지원 상태 정보 (새 구조)
 */
export interface ApplicationStateInfo {
  status: 'applied' | 'confirmed' | 'cancelled';
  originalApplication: {
    assignments: Assignment[];
    appliedAt: Timestamp;
  };
  confirmationHistory: ApplicationHistoryEntry[];
  lastModified: Timestamp;
}

/**
 * 🎯 지원자 상태 전환 히스토리를 관리하는 서비스 클래스 (v2.0)
 * 
 * 🚀 v2.0 개선사항:
 * - 통합된 assignments 배열 사용 (Single Source of Truth)
 * - 레거시 필드 제거 (assignedRoles, assignedTimes, assignedDates 등)
 * - 자동 마이그레이션 지원
 * - 타입 안전성 강화
 * 
 * 핵심 기능:
 * 1. 상태 전환 시 원본 데이터 완전 보존 
 * 2. 확정/취소 히스토리 추적
 * 3. 데이터 무결성 보장
 * 4. 레거시 데이터 자동 마이그레이션
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
        
        // 🎯 개발 단계: 모든 데이터는 새 구조 (마이그레이션 불필요)
        const processedData: Application = currentData as Application;
        
        // 원본 지원 데이터 보존 (최초 확정 시에만)
        const originalApplication = processedData.originalApplication || {
          assignments: processedData.assignments || [],
          appliedAt: processedData.appliedAt || Timestamp.now()
        };

        // 새로운 확정 히스토리 항목
        const newHistoryEntry: ApplicationHistoryEntry = {
          confirmedAt: Timestamp.now(),
          assignments: assignments
        };

        // 기존 히스토리에 추가
        const confirmationHistory = processedData.confirmationHistory || [];
        confirmationHistory.push(newHistoryEntry);

        // 🎯 새 구조로 지원서 업데이트 (v2.0)
        const updatedData: Partial<Application> = {
          status: 'confirmed',
          confirmedAt: Timestamp.now(),
          
          // 핵심 배정 정보 (Single Source of Truth)
          assignments,
          
          // 히스토리 정보
          originalApplication,
          confirmationHistory,
          
          // 메타데이터
          lastModified: Timestamp.now(),
          updatedAt: Timestamp.now()
        };

        transaction.update(applicationRef, updatedData);
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
        
        // 🎯 개발 단계: 모든 데이터는 새 구조 (마이그레이션 불필요)
        const processedData: Application = currentData as Application;
        
        // 원본 지원 데이터 확인
        const originalApplication = processedData.originalApplication;
        if (!originalApplication) {
          throw new Error('원본 지원 데이터를 찾을 수 없습니다.');
        }

        // 최신 확정 히스토리에 취소 시간 추가
        const confirmationHistory = processedData.confirmationHistory || [];
        if (confirmationHistory.length > 0) {
          const lastEntry = confirmationHistory[confirmationHistory.length - 1];
          if (lastEntry) {
            lastEntry.cancelledAt = Timestamp.now();
          }
        }

        // 🎯 새 구조로 지원서 상태를 'applied'로 복원 (v2.0)
        const restoredData: Partial<Application> = {
          status: 'applied',
          
          // 원본 assignments 완전 복원
          assignments: originalApplication.assignments,
          
          // 확정 관련 필드 제거 (타입 호환성 위해 제거)
          // confirmedAt: null,
          cancelledAt: Timestamp.now(),
          
          // 히스토리 업데이트
          confirmationHistory,
          
          // 메타데이터
          lastModified: Timestamp.now(),
          updatedAt: Timestamp.now()
        };

        transaction.update(applicationRef, restoredData);
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
   * 🎯 지원자의 원본 지원 데이터 가져오기 (v2.0)
   * 
   * @param applicantData 지원자 데이터 (레거시 또는 새 구조)
   * @returns 원본 assignments 배열
   */
  static getOriginalApplicationData(applicantData: Application | LegacyApplication): Assignment[] {
    // 🎯 개발 단계: 모든 데이터는 새 구조 (마이그레이션 불필요)
    const processedData: Application = applicantData as Application;

    // 히스토리에서 원본 데이터 우선 사용
    if (processedData.originalApplication?.assignments) {
      return processedData.originalApplication.assignments;
    }

    // 현재 assignments 사용 (원본이 없는 경우)
    if (processedData.assignments && Array.isArray(processedData.assignments)) {
      return processedData.assignments;
    }

    return [];
  }

  /**
   * 지원자의 확정 히스토리 가져오기
   */
  static getConfirmationHistory(applicantData: Application | LegacyApplication): ApplicationHistoryEntry[] {
    return (applicantData as Application).confirmationHistory || [];
  }

  /**
   * 지원자의 현재 활성 확정 정보 가져오기 (취소되지 않은 최신 확정)
   */
  static getCurrentConfirmation(applicantData: Application | LegacyApplication): ApplicationHistoryEntry | null {
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
   * 🎯 확정된 지원자의 실제 선택사항 가져오기 (v2.0)
   * 
   * @param applicantData 지원자 데이터 (레거시 또는 새 구조)
   * @returns 확정된 assignments 배열
   */
  static getConfirmedSelections(applicantData: Application | LegacyApplication): Assignment[] {
    // 🎯 개발 단계: 모든 데이터는 새 구조 (마이그레이션 불필요)
    const processedData: Application = applicantData as Application;

    if (processedData.status !== 'confirmed') {
      return [];
    }

    // 현재 활성 확정 정보 가져오기
    const currentConfirmation = this.getCurrentConfirmation(processedData);
    
    if (currentConfirmation && currentConfirmation.assignments) {
      // 확정 히스토리에서 실제 선택된 assignments 반환
      return currentConfirmation.assignments;
    }

    // 히스토리가 없는 경우 현재 assignments 사용
    if (processedData.assignments && Array.isArray(processedData.assignments)) {
      return processedData.assignments;
    }
    
    return [];
  }

  /**
   * 🎯 데이터 무결성 검증 (v2.0)
   */
  static validateApplicationData(applicantData: Application | LegacyApplication): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    // 🎯 개발 단계: 모든 데이터는 새 구조 (마이그레이션 불필요)
    const dataToValidate: Application = applicantData as Application;

    // 기본 필드 검증
    if (!dataToValidate.applicantId) {
      errors.push('applicantId가 없습니다.');
    }

    if (!dataToValidate.status || !['applied', 'confirmed', 'cancelled'].includes(dataToValidate.status)) {
      errors.push('유효하지 않은 status입니다.');
    }

    // assignments 배열 검증
    if (!dataToValidate.assignments || !Array.isArray(dataToValidate.assignments)) {
      errors.push('assignments 배열이 없습니다.');
    } else if (dataToValidate.assignments.length === 0) {
      errors.push('assignments 배열이 비어있습니다.');
    } else {
      // 각 assignment 검증
      dataToValidate.assignments.forEach((assignment: any, index: number) => {
        if (!assignment.role) errors.push(`assignments[${index}]: role 누락`);
        if (!assignment.timeSlot) errors.push(`assignments[${index}]: timeSlot 누락`);
        if (!assignment.dates || !Array.isArray(assignment.dates) || assignment.dates.length === 0) {
          errors.push(`assignments[${index}]: dates 배열이 비어있음`);
        }
      });
    }

    // 확정된 경우 추가 검증
    if (dataToValidate.status === 'confirmed') {
      const originalApp = dataToValidate.originalApplication;
      if (!originalApp || !originalApp.assignments?.length) {
        errors.push('확정된 지원서에 원본 assignments가 없습니다.');
      }

      if (!dataToValidate.confirmationHistory?.length) {
        errors.push('확정된 지원서에 히스토리가 없습니다.');
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}