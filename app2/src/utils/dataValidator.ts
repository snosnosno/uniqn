/**
 * T-HOLDEM 전역 데이터 검증 유틸리티
 * 
 * 이 파일은 shiftValidation.ts 패턴을 기반으로 전역 데이터 검증 시스템을 제공합니다.
 * undefined 필터링, 타입 안전성, 데이터 일관성 검증을 위한 재사용 가능한 유틸리티들을 포함합니다.
 * 
 * @author Shrimp AI Assistant
 * @version 1.0.0
 * @created 2025-01-19
 */

import { logger } from './logger';

// 검증 결과 타입
export interface ValidationResult<T> {
  isValid: boolean;
  data: T;
  errors: string[];
  warnings: string[];
  originalData?: any;
}

// 검증 규칙 타입
export interface ValidationRule<T> {
  name: string;
  validator: (data: T) => boolean;
  errorMessage: string;
  warningMessage?: string;
}

// 필터링 결과 타입
export interface FilterResult<T> {
  valid: T[];
  invalid: T[];
  filtered: T[];
  stats: {
    total: number;
    valid: number;
    invalid: number;
    filtered: number;
  };
}

/**
 * 전역 데이터 검증 유틸리티 클래스
 */
export class DataValidator {
  
  /**
   * undefined 값을 필터링하여 유효한 배열 반환
   * @param array 필터링할 배열
   * @returns 유효한 값들만 포함된 배열
   */
  static filterUndefined<T>(array: (T | undefined | null)[]): T[] {
    return array.filter((item): item is T => item !== undefined && item !== null);
  }

  /**
   * 필수 필드 검증
   * @param value 검증할 값
   * @param fieldName 필드명
   * @returns 검증된 값
   * @throws Error 필드가 undefined인 경우
   */
  static validateRequired<T>(value: T | undefined | null, fieldName: string): T {
    if (value === undefined || value === null) {
      const error = `Required field '${fieldName}' is undefined or null`;
      logger.error(error, new Error(error), { 
        operation: 'validateRequired',
        fieldName 
      });
      throw new Error(error);
    }
    return value;
  }

  /**
   * 배열 보장 (단일 값 또는 배열을 배열로 변환)
   * @param value 변환할 값
   * @returns 항상 배열
   */
  static ensureArray<T>(value: T | T[] | undefined | null): T[] {
    if (value === undefined || value === null) return [];
    return Array.isArray(value) ? value : [value];
  }

  /**
   * 문자열 검증 및 정규화
   * @param value 검증할 문자열
   * @param fieldName 필드명
   * @param options 검증 옵션
   * @returns 검증된 문자열
   */
  static validateString(
    value: string | undefined | null,
    fieldName: string,
    options: {
      required?: boolean;
      minLength?: number;
      maxLength?: number;
      pattern?: RegExp;
      trim?: boolean;
    } = {}
  ): string {
    const { required = false, minLength, maxLength, pattern, trim = true } = options;

    // undefined/null 검증
    if (value === undefined || value === null) {
      if (required) {
        const error = `Required string field '${fieldName}' is undefined or null`;
        logger.error(error, new Error(error), { 
          operation: 'validateString',
          fieldName 
        });
        throw new Error(error);
      }
      return '';
    }

    let validatedValue = String(value);

    // 공백 제거
    if (trim) {
      validatedValue = validatedValue.trim();
    }

    // 최소 길이 검증
    if (minLength !== undefined && validatedValue.length < minLength) {
      const error = `String field '${fieldName}' is too short (${validatedValue.length} < ${minLength})`;
      logger.error(error, new Error(error), { 
        operation: 'validateString',
        fieldName,
        value: validatedValue,
        minLength 
      });
      throw new Error(error);
    }

    // 최대 길이 검증
    if (maxLength !== undefined && validatedValue.length > maxLength) {
      const error = `String field '${fieldName}' is too long (${validatedValue.length} > ${maxLength})`;
      logger.error(error, new Error(error), { 
        operation: 'validateString',
        fieldName,
        value: validatedValue,
        maxLength 
      });
      throw new Error(error);
    }

    // 패턴 검증
    if (pattern && !pattern.test(validatedValue)) {
      const error = `String field '${fieldName}' does not match required pattern`;
      logger.error(error, new Error(error), { 
        operation: 'validateString',
        fieldName,
        value: validatedValue,
        pattern: pattern.toString()
      });
      throw new Error(error);
    }

    return validatedValue;
  }

  /**
   * 숫자 검증 및 변환
   * @param value 검증할 값
   * @param fieldName 필드명
   * @param options 검증 옵션
   * @returns 검증된 숫자
   */
  static validateNumber(
    value: number | string | undefined | null,
    fieldName: string,
    options: {
      required?: boolean;
      min?: number;
      max?: number;
      integer?: boolean;
    } = {}
  ): number {
    const { required = false, min, max, integer = false } = options;

    // undefined/null 검증
    if (value === undefined || value === null) {
      if (required) {
        const error = `Required number field '${fieldName}' is undefined or null`;
        logger.error(error, new Error(error), { 
          operation: 'validateNumber',
          fieldName 
        });
        throw new Error(error);
      }
      return 0;
    }

    // 숫자 변환
    const numValue = Number(value);
    
    if (isNaN(numValue)) {
      const error = `Field '${fieldName}' is not a valid number`;
      logger.error(error, new Error(error), { 
        operation: 'validateNumber',
        fieldName,
        value 
      });
      throw new Error(error);
    }

    // 정수 검증
    if (integer && !Number.isInteger(numValue)) {
      const error = `Field '${fieldName}' must be an integer`;
      logger.error(error, new Error(error), { 
        operation: 'validateNumber',
        fieldName,
        value: numValue 
      });
      throw new Error(error);
    }

    // 최소값 검증
    if (min !== undefined && numValue < min) {
      const error = `Number field '${fieldName}' is too small (${numValue} < ${min})`;
      logger.error(error, new Error(error), { 
        operation: 'validateNumber',
        fieldName,
        value: numValue,
        min 
      });
      throw new Error(error);
    }

    // 최대값 검증
    if (max !== undefined && numValue > max) {
      const error = `Number field '${fieldName}' is too large (${numValue} > ${max})`;
      logger.error(error, new Error(error), { 
        operation: 'validateNumber',
        fieldName,
        value: numValue,
        max 
      });
      throw new Error(error);
    }

    return numValue;
  }

  /**
   * 날짜 검증 및 변환
   * @param value 검증할 값
   * @param fieldName 필드명
   * @param options 검증 옵션
   * @returns 검증된 Date 객체
   */
  static validateDate(
    value: string | Date | undefined | null,
    fieldName: string,
    options: {
      required?: boolean;
      minDate?: Date;
      maxDate?: Date;
    } = {}
  ): Date {
    const { required = false, minDate, maxDate } = options;

    // undefined/null 검증
    if (value === undefined || value === null) {
      if (required) {
        const error = `Required date field '${fieldName}' is undefined or null`;
        logger.error(error, new Error(error), { 
          operation: 'validateDate',
          fieldName 
        });
        throw new Error(error);
      }
      return new Date();
    }

    // Date 객체 변환
    const dateValue = value instanceof Date ? value : new Date(value);
    
    if (isNaN(dateValue.getTime())) {
      const error = `Field '${fieldName}' is not a valid date`;
      logger.error(error, new Error(error), { 
        operation: 'validateDate',
        fieldName,
        value 
      });
      throw new Error(error);
    }

    // 최소 날짜 검증
    if (minDate && dateValue < minDate) {
      const error = `Date field '${fieldName}' is too early (${dateValue} < ${minDate})`;
      logger.error(error, new Error(error), { 
        operation: 'validateDate',
        fieldName,
        value: dateValue,
        minDate 
      });
      throw new Error(error);
    }

    // 최대 날짜 검증
    if (maxDate && dateValue > maxDate) {
      const error = `Date field '${fieldName}' is too late (${dateValue} > ${maxDate})`;
      logger.error(error, new Error(error), { 
        operation: 'validateDate',
        fieldName,
        value: dateValue,
        maxDate 
      });
      throw new Error(error);
    }

    return dateValue;
  }

  /**
   * 객체 검증
   * @param value 검증할 객체
   * @param fieldName 필드명
   * @param requiredFields 필수 필드 목록
   * @returns 검증된 객체
   */
  static validateObject<T extends Record<string, any>>(
    value: T | undefined | null,
    fieldName: string,
    requiredFields: (keyof T)[] = []
  ): T {
    // undefined/null 검증
    if (value === undefined || value === null) {
      const error = `Required object field '${fieldName}' is undefined or null`;
      logger.error(error, new Error(error), { 
        operation: 'validateObject',
        fieldName 
      });
      throw new Error(error);
    }

    // 객체 타입 검증
    if (typeof value !== 'object' || Array.isArray(value)) {
      const error = `Field '${fieldName}' is not a valid object`;
      logger.error(error, new Error(error), { 
        operation: 'validateObject',
        fieldName,
        value 
      });
      throw new Error(error);
    }

    // 필수 필드 검증
    const missingFields: string[] = [];
    requiredFields.forEach(field => {
      if (!(field in value) || value[field] === undefined || value[field] === null) {
        missingFields.push(String(field));
      }
    });

    if (missingFields.length > 0) {
      const error = `Object field '${fieldName}' is missing required fields: ${missingFields.join(', ')}`;
      logger.error(error, new Error(error), { 
        operation: 'validateObject',
        fieldName,
        missingFields 
      });
      throw new Error(error);
    }

    return value;
  }

  /**
   * 배열 검증 및 필터링
   * @param value 검증할 배열
   * @param fieldName 필드명
   * @param options 검증 옵션
   * @returns 검증 결과
   */
  static validateArray<T>(
    value: T[] | undefined | null,
    fieldName: string,
    options: {
      required?: boolean;
      minLength?: number;
      maxLength?: number;
      itemValidator?: (item: T, index: number) => boolean;
      filterInvalid?: boolean;
    } = {}
  ): FilterResult<T> {
    const { required = false, minLength, maxLength, itemValidator, filterInvalid = true } = options;

    // undefined/null 검증
    if (value === undefined || value === null) {
      if (required) {
        const error = `Required array field '${fieldName}' is undefined or null`;
        logger.error(error, new Error(error), { 
          operation: 'validateArray',
          fieldName 
        });
        throw new Error(error);
      }
      return {
        valid: [],
        invalid: [],
        filtered: [],
        stats: { total: 0, valid: 0, invalid: 0, filtered: 0 }
      };
    }

    // 배열 타입 검증
    if (!Array.isArray(value)) {
      const error = `Field '${fieldName}' is not a valid array`;
      logger.error(error, new Error(error), { 
        operation: 'validateArray',
        fieldName,
        value 
      });
      throw new Error(error);
    }

    const total = value.length;
    const valid: T[] = [];
    const invalid: T[] = [];

    // 각 항목 검증
    value.forEach((item, index) => {
      if (itemValidator) {
        try {
          if (itemValidator(item, index)) {
            valid.push(item);
          } else {
            invalid.push(item);
            logger.warn(`Array item validation failed`, { component: 'dataValidator', data: {  
              operation: 'validateArray',
              fieldName,
              index,
              item 
             } });
          }
        } catch (error) {
          invalid.push(item);
          logger.error(`Array item validation error`, error as Error, { 
            operation: 'validateArray',
            fieldName,
            index,
            item 
          });
        }
      } else {
        valid.push(item);
      }
    });

    // 길이 검증
    if (minLength !== undefined && valid.length < minLength) {
      const error = `Array field '${fieldName}' has too few valid items (${valid.length} < ${minLength})`;
      logger.error(error, new Error(error), { 
        operation: 'validateArray',
        fieldName,
        validLength: valid.length,
        minLength 
      });
      throw new Error(error);
    }

    if (maxLength !== undefined && valid.length > maxLength) {
      const error = `Array field '${fieldName}' has too many valid items (${valid.length} > ${maxLength})`;
      logger.error(error, new Error(error), { 
        operation: 'validateArray',
        fieldName,
        validLength: valid.length,
        maxLength 
      });
      throw new Error(error);
    }

    const filtered = filterInvalid ? valid : [...valid, ...invalid];

    return {
      valid,
      invalid,
      filtered,
      stats: {
        total,
        valid: valid.length,
        invalid: invalid.length,
        filtered: filtered.length
      }
    };
  }

  /**
   * 복합 검증 (여러 규칙 적용)
   * @param data 검증할 데이터
   * @param rules 검증 규칙 배열
   * @returns 검증 결과
   */
  static validateWithRules<T>(
    data: T,
    rules: ValidationRule<T>[]
  ): ValidationResult<T> {
    const errors: string[] = [];
    const warnings: string[] = [];

    rules.forEach(rule => {
      try {
        if (!rule.validator(data)) {
          errors.push(rule.errorMessage);
        }
      } catch (error) {
        errors.push(`${rule.name}: ${error instanceof Error ? error.message : 'Validation failed'}`);
      }
    });

    const isValid = errors.length === 0;

    if (!isValid) {
      logger.warn(`Data validation failed`, { component: 'dataValidator', data: {  
        operation: 'validateWithRules',
        errors,
        warnings 
       } });
    }

    return {
      isValid,
      data,
      errors,
      warnings
    };
  }

  /**
   * 안전한 데이터 변환 (에러 복구 포함)
   * @param operation 변환 작업
   * @param fallback 기본값
   * @param operationName 작업명
   * @returns 변환 결과
   */
  static safeTransform<T, R>(
    operation: (data: T) => R,
    fallback: R,
    operationName: string
  ): (data: T) => R {
    return (data: T): R => {
      try {
        return operation(data);
      } catch (error) {
        logger.error(`Safe transform failed: ${operationName}`, error as Error, { 
          operation: operationName,
          data 
        });
        return fallback;
      }
    };
  }

  /**
   * 데이터 정규화 (일관된 형식으로 변환)
   * @param data 정규화할 데이터
   * @param normalizers 정규화 함수들
   * @returns 정규화된 데이터
   */
  static normalizeData<T>(
    data: T,
    normalizers: ((data: T) => T)[]
  ): T {
    let normalizedData = data;
    
    normalizers.forEach((normalizer, index) => {
      try {
        normalizedData = normalizer(normalizedData);
      } catch (error) {
        logger.error(`Data normalization failed at step ${index}`, error as Error, { 
          operation: 'normalizeData',
          step: String(index),
          data: normalizedData 
        });
      }
    });

    return normalizedData;
  }

  /**
   * 데이터 무결성 검사
   * @param data 검사할 데이터
   * @param integrityChecks 무결성 검사 함수들
   * @returns 무결성 검사 결과
   */
  static checkDataIntegrity<T>(
    data: T,
    integrityChecks: ((data: T) => boolean)[]
  ): ValidationResult<T> {
    const errors: string[] = [];
    const warnings: string[] = [];

    integrityChecks.forEach((check, index) => {
      try {
        if (!check(data)) {
          errors.push(`Integrity check ${index + 1} failed`);
        }
      } catch (error) {
        errors.push(`Integrity check ${index + 1} error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    });

    const isValid = errors.length === 0;

    if (!isValid) {
      logger.error(`Data integrity check failed`, new Error('Data integrity violation'), { 
        operation: 'checkDataIntegrity',
        errors,
        warnings 
      });
    }

    return {
      isValid,
      data,
      errors,
      warnings
    };
  }
}

// 편의를 위한 함수 export
export const {
  filterUndefined,
  validateRequired,
  ensureArray,
  validateString,
  validateNumber,
  validateDate,
  validateObject,
  validateArray,
  validateWithRules,
  safeTransform,
  normalizeData,
  checkDataIntegrity
} = DataValidator;

export default DataValidator;