/**
 * T-HOLDEM 다중 선택 기능을 위한 데이터 검증 및 마이그레이션 유틸리티
 * 
 * 이 파일은 기존 단일 선택 데이터와 새로운 다중 선택 데이터 간의 호환성을 보장하고,
 * 안전한 데이터 변환 및 검증 기능을 제공합니다.
 * 
 * @author Shrimp AI Assistant
 * @version 1.0.0
 * @created 2025-01-08
 */

import { Applicant, MultipleSelection, SelectionItem } from '../types/jobPosting';

// 로깅 레벨 정의
export enum LogLevel {
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
  DEBUG = 'DEBUG'
}

// 마이그레이션 결과 타입
export interface MigrationResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  warnings: string[];
  migrated: boolean; // 데이터가 변환되었는지 여부
}

// 유효성 검사 결과 타입
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * 마이그레이션 유틸리티 클래스
 * 단일 선택과 다중 선택 데이터 간의 변환, 검증, 호환성 관리를 담당
 */
export class MigrationUtils {
  
  /**
   * 로깅 함수 (개발/디버깅용)
   * @param level 로그 레벨
   * @param message 로그 메시지
   * @param data 추가 데이터 (선택적)
   */
  private static log(level: LogLevel, message: string, data?: any): void {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${level}] [MigrationUtils] ${message}`;
    
    switch (level) {
      case LogLevel.ERROR:
        console.error(logMessage, data);
        break;
      case LogLevel.WARN:
        console.warn(logMessage, data);
        break;
      case LogLevel.DEBUG:
        if (process.env.NODE_ENV === 'development') {
          console.debug(logMessage, data);
        }
        break;
      default:
        console.log(logMessage, data);
    }
  }

  /**
   * 기존 형식(레거시) 지원자 데이터인지 확인
   * @param applicant 지원자 데이터
   * @returns 레거시 데이터 여부
   */
  static isLegacyApplication(applicant: Applicant): boolean {
    this.log(LogLevel.DEBUG, 'Checking if application is legacy format', { applicantId: applicant.id });
    
    const hasLegacyFields = !!(applicant.role && applicant.timeSlot);
    const hasNewFields = !!(applicant.assignedRoles?.length || 
                           applicant.assignedTimes?.length || 
                           applicant.assignedDates?.length);
    
    // 레거시 필드만 있고 새 필드가 없으면 레거시
    const isLegacy = hasLegacyFields && !hasNewFields;
    
    this.log(LogLevel.DEBUG, 'Legacy check result', {
      applicantId: applicant.id,
      hasLegacyFields,
      hasNewFields,
      isLegacy
    });
    
    return isLegacy;
  }

  /**
   * 단일 선택 데이터를 다중 선택 형식으로 변환
   * @param applicant 지원자 데이터
   * @returns 마이그레이션 결과
   */
  static convertSingleToMultiple(applicant: Applicant): MigrationResult<Applicant> {
    this.log(LogLevel.INFO, 'Converting single selection to multiple format', { applicantId: applicant.id });
    
    const warnings: string[] = [];
    
    try {
      // 이미 다중 선택 형식이면 변환하지 않음
      if (!this.isLegacyApplication(applicant)) {
        this.log(LogLevel.DEBUG, 'Application already in new format, skipping conversion', { applicantId: applicant.id });
        return {
          success: true,
          data: applicant,
          warnings: [],
          migrated: false
        };
      }

      // 단일 선택 데이터 검증
      if (!applicant.role || !applicant.timeSlot) {
        const error = 'Invalid legacy data: missing role or timeSlot';
        this.log(LogLevel.ERROR, error, { applicant });
        return {
          success: false,
          error,
          warnings,
          migrated: false
        };
      }

      // 새로운 형식으로 변환
      const convertedApplicant: Applicant = {
        ...applicant,
        assignedRoles: [applicant.role],
        assignedTimes: [applicant.timeSlot],
        assignedDates: applicant.assignedDate ? [applicant.assignedDate] : []
      };

      this.log(LogLevel.INFO, 'Successfully converted single to multiple selection', {
        applicantId: applicant.id,
        original: {
          role: applicant.role,
          time: applicant.timeSlot,
          date: applicant.assignedDate
        },
        converted: {
          roles: convertedApplicant.assignedRoles,
          times: convertedApplicant.assignedTimes,
          dates: convertedApplicant.assignedDates
        }
      });

      return {
        success: true,
        data: convertedApplicant,
        warnings,
        migrated: true
      };

    } catch (error) {
      const errorMessage = `Conversion failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
      this.log(LogLevel.ERROR, errorMessage, { applicant, error });
      
      return {
        success: false,
        error: errorMessage,
        warnings,
        migrated: false
      };
    }
  }

  /**
   * 다중 선택 데이터에서 첫 번째 값을 단일 선택으로 추출 (폴백용)
   * @param applicant 지원자 데이터
   * @returns 마이그레이션 결과
   */
  static convertMultipleToSingle(applicant: Applicant): MigrationResult<Applicant> {
    this.log(LogLevel.INFO, 'Converting multiple selection to single format (fallback)', { applicantId: applicant.id });
    
    const warnings: string[] = [];
    
    try {
      // 이미 단일 선택 형식이면 변환하지 않음
      if (this.isLegacyApplication(applicant)) {
        this.log(LogLevel.DEBUG, 'Application already in legacy format, skipping conversion', { applicantId: applicant.id });
        return {
          success: true,
          data: applicant,
          warnings: [],
          migrated: false
        };
      }

      // 다중 선택 데이터 검증
      const hasMultipleData = applicant.assignedRoles?.length || 
                             applicant.assignedTimes?.length || 
                             applicant.assignedDates?.length;

      if (!hasMultipleData) {
        const error = 'No multiple selection data to convert';
        this.log(LogLevel.ERROR, error, { applicant });
        return {
          success: false,
          error,
          warnings,
          migrated: false
        };
      }

      // 첫 번째 값들 추출
      const firstRole = applicant.assignedRoles?.[0];
      const firstTime = applicant.assignedTimes?.[0];
      const firstDate = applicant.assignedDates?.[0];

      if (!firstRole || !firstTime) {
        const error = 'Invalid multiple selection data: missing role or time';
        this.log(LogLevel.ERROR, error, { applicant });
        return {
          success: false,
          error,
          warnings,
          migrated: false
        };
      }

      // 데이터 손실 경고
      const multipleSelections = Math.max(
        applicant.assignedRoles?.length || 0,
        applicant.assignedTimes?.length || 0,
        applicant.assignedDates?.length || 0
      );

      if (multipleSelections > 1) {
        warnings.push(`Data loss warning: Converting ${multipleSelections} selections to single selection. Only first selection will be preserved.`);
        this.log(LogLevel.WARN, 'Data loss during conversion to single format', {
          applicantId: applicant.id,
          selectionsLost: multipleSelections - 1
        });
      }

      // 단일 선택 형식으로 변환
      const convertedApplicant: Applicant = {
        ...applicant,
        role: firstRole,
        timeSlot: firstTime,
        ...(firstDate && { assignedDate: firstDate })
      };

      this.log(LogLevel.INFO, 'Successfully converted multiple to single selection', {
        applicantId: applicant.id,
        original: {
          roles: applicant.assignedRoles,
          times: applicant.assignedTimes,
          dates: applicant.assignedDates
        },
        converted: {
          role: firstRole,
          timeSlot: firstTime,
          assignedDate: firstDate
        }
      });

      return {
        success: true,
        data: convertedApplicant,
        warnings,
        migrated: true
      };

    } catch (error) {
      const errorMessage = `Conversion failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
      this.log(LogLevel.ERROR, errorMessage, { applicant, error });
      
      return {
        success: false,
        error: errorMessage,
        warnings,
        migrated: false
      };
    }
  }

  /**
   * 다중 선택 데이터의 유효성 검증
   * @param selection 다중 선택 데이터
   * @returns 검증 결과
   */
  static validateMultipleSelections(selection: MultipleSelection): ValidationResult {
    this.log(LogLevel.DEBUG, 'Validating multiple selections', selection);
    
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // 기본 구조 검증
      if (!selection || typeof selection !== 'object') {
        errors.push('Invalid selection object');
        return { valid: false, errors, warnings };
      }

      // 배열 필드 검증
      if (!Array.isArray(selection.roles)) {
        errors.push('roles must be an array');
      }
      if (!Array.isArray(selection.times)) {
        errors.push('times must be an array');
      }
      if (!Array.isArray(selection.dates)) {
        errors.push('dates must be an array');
      }

      // 최소한 하나의 선택이 있어야 함
      if (selection.roles.length === 0 && selection.times.length === 0) {
        errors.push('At least one role and time must be selected');
      }

      // 배열 길이 일치 검증
      const maxLength = Math.max(selection.roles.length, selection.times.length);
      if (selection.roles.length !== selection.times.length) {
        warnings.push('Roles and times arrays have different lengths - data may be inconsistent');
      }

      // 날짜 배열 길이 검증 (선택적)
      if (selection.dates.length > 0 && selection.dates.length !== maxLength) {
        warnings.push('Dates array length does not match roles/times - some entries may not have dates');
      }

      // 빈 문자열 검증
      if (selection.roles.some(role => !role || role.trim() === '')) {
        errors.push('Roles cannot be empty');
      }
      if (selection.times.some(time => !time || time.trim() === '')) {
        errors.push('Times cannot be empty');
      }

      // 중복 검증
      const duplicateRoles = selection.roles.filter((role, index, arr) => arr.indexOf(role) !== index);
      if (duplicateRoles.length > 0) {
        warnings.push(`Duplicate roles found: ${duplicateRoles.join(', ')}`);
      }

      const duplicateTimes = selection.times.filter((time, index, arr) => arr.indexOf(time) !== index);
      if (duplicateTimes.length > 0) {
        warnings.push(`Duplicate times found: ${duplicateTimes.join(', ')}`);
      }

      const isValid = errors.length === 0;
      this.log(isValid ? LogLevel.DEBUG : LogLevel.WARN, 'Validation completed', {
        valid: isValid,
        errorsCount: errors.length,
        warningsCount: warnings.length
      });

      return { valid: isValid, errors, warnings };

    } catch (error) {
      const errorMessage = `Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
      this.log(LogLevel.ERROR, errorMessage, { selection, error });
      errors.push(errorMessage);
      return { valid: false, errors, warnings };
    }
  }

  /**
   * 지원자 데이터 자동 마이그레이션 (읽기 시점에 수행)
   * @param applicant 원본 지원자 데이터
   * @returns 마이그레이션된 지원자 데이터
   */
  static autoMigrateApplicant(applicant: Applicant): Applicant {
    this.log(LogLevel.DEBUG, 'Auto-migrating applicant data', { applicantId: applicant.id });

    try {
      // 이미 새 형식이면 그대로 반환
      if (!this.isLegacyApplication(applicant)) {
        this.log(LogLevel.DEBUG, 'No migration needed', { applicantId: applicant.id });
        return applicant;
      }

      // 단일 선택을 다중 선택으로 변환
      const result = this.convertSingleToMultiple(applicant);
      
      if (result.success && result.data) {
        this.log(LogLevel.INFO, 'Auto-migration completed successfully', { 
          applicantId: applicant.id,
          migrated: result.migrated
        });
        return result.data;
      } else {
        this.log(LogLevel.WARN, 'Auto-migration failed, returning original data', {
          applicantId: applicant.id,
          error: result.error
        });
        return applicant;
      }

    } catch (error) {
      this.log(LogLevel.ERROR, 'Auto-migration error, returning original data', {
        applicantId: applicant.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return applicant;
    }
  }

  /**
   * SelectionItem 배열을 MultipleSelection으로 변환
   * @param items 선택 항목 배열
   * @returns 다중 선택 데이터
   */
  static selectionItemsToMultiple(items: SelectionItem[]): MultipleSelection {
    this.log(LogLevel.DEBUG, 'Converting selection items to multiple format', { itemsCount: items.length });

    const roles: string[] = [];
    const times: string[] = [];
    const dates: string[] = [];

    items.forEach((item, index) => {
      if (item.role) roles.push(item.role);
      if (item.timeSlot) times.push(item.timeSlot);
      if (item.date) dates.push(item.date);
    });

    const result = { roles, times, dates };
    this.log(LogLevel.DEBUG, 'Conversion completed', result);
    return result;
  }

  /**
   * MultipleSelection을 SelectionItem 배열로 변환
   * @param selection 다중 선택 데이터
   * @returns 선택 항목 배열
   */
  static multipleToSelectionItems(selection: MultipleSelection): SelectionItem[] {
    this.log(LogLevel.DEBUG, 'Converting multiple selection to items array', selection);

    const items: SelectionItem[] = [];
    const maxLength = Math.max(selection.roles.length, selection.times.length);

    for (let i = 0; i < maxLength; i++) {
      const item: SelectionItem = {
        role: selection.roles[i] || '',
        timeSlot: selection.times[i] || ''
      };
      
      const date = selection.dates[i];
      if (date) {
        item.date = date;
      }
      
      items.push(item);
    }

    this.log(LogLevel.DEBUG, 'Conversion completed', { itemsCount: items.length });
    return items;
  }

  /**
   * 배치 마이그레이션 (여러 지원자 동시 처리)
   * @param applicants 지원자 배열
   * @returns 마이그레이션 결과 배열
   */
  static batchMigrateApplicants(applicants: Applicant[]): MigrationResult<Applicant[]> {
    this.log(LogLevel.INFO, 'Starting batch migration', { count: applicants.length });

    const warnings: string[] = [];
    const migratedApplicants: Applicant[] = [];
    let migrationCount = 0;

    try {
      for (const applicant of applicants) {
        const migratedApplicant = this.autoMigrateApplicant(applicant);
        migratedApplicants.push(migratedApplicant);
        
        if (!this.isLegacyApplication(migratedApplicant) && this.isLegacyApplication(applicant)) {
          migrationCount++;
        }
      }

      this.log(LogLevel.INFO, 'Batch migration completed', {
        total: applicants.length,
        migrated: migrationCount,
        success: true
      });

      return {
        success: true,
        data: migratedApplicants,
        warnings,
        migrated: migrationCount > 0
      };

    } catch (error) {
      const errorMessage = `Batch migration failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
      this.log(LogLevel.ERROR, errorMessage, { error });
      
      return {
        success: false,
        error: errorMessage,
        warnings,
        migrated: false
      };
    }
  }

  /**
   * 마이그레이션 통계 생성
   * @param applicants 지원자 배열
   * @returns 통계 정보
   */
  static getMigrationStats(applicants: Applicant[]): {
    total: number;
    legacy: number;
    modern: number;
    percentage: number;
  } {
    const total = applicants.length;
    const legacy = applicants.filter(app => this.isLegacyApplication(app)).length;
    const modern = total - legacy;
    const percentage = total > 0 ? Math.round((modern / total) * 100) : 0;

    const stats = { total, legacy, modern, percentage };
    this.log(LogLevel.INFO, 'Migration statistics generated', stats);
    
    return stats;
  }
}

// 편의를 위한 함수 export
export const {
  isLegacyApplication,
  convertSingleToMultiple,
  convertMultipleToSingle,
  validateMultipleSelections,
  autoMigrateApplicant,
  selectionItemsToMultiple,
  multipleToSelectionItems,
  batchMigrateApplicants,
  getMigrationStats
} = MigrationUtils;

export default MigrationUtils;