/**
 * UNIQN Mobile - 수당 관리 훅
 *
 * @description SalarySection에서 수당 관련 상태 및 핸들러 관리
 * @version 1.0.0
 */

import { useCallback } from 'react';
import { PROVIDED_FLAG } from '@/utils/settlement';
import { parseCurrency } from '@/utils/salary';
import type { Allowances, JobPostingFormData } from '@/types';

// ============================================================================
// Types
// ============================================================================

export interface UseAllowancesResult {
  /** 보장시간 변경 핸들러 */
  handleGuaranteedHoursChange: (value: string) => void;
  /** 수당 금액 변경 핸들러 */
  handleAllowanceChange: (key: string, value: string) => void;
  /** 수당 "제공" 토글 핸들러 */
  handleAllowanceProvidedToggle: (key: string, isProvided: boolean) => void;
  /** 수당 값이 "제공" 상태인지 확인 */
  isAllowanceProvided: (value: number | undefined) => boolean;
}

// ============================================================================
// Hook
// ============================================================================

/**
 * 수당 관리 훅
 *
 * @description
 * - 보장시간, 식비, 교통비, 숙박비 등 수당 입력 핸들러 제공
 * - PROVIDED_FLAG (-1)로 "제공" 상태 관리
 * - 금액이 0이면 undefined로 변환 (필드 제거)
 *
 * @param allowances - 현재 수당 값
 * @param onUpdate - 폼 데이터 업데이트 콜백
 * @returns 수당 핸들러 및 유틸리티 함수
 *
 * @example
 * const {
 *   handleGuaranteedHoursChange,
 *   handleAllowanceChange,
 *   handleAllowanceProvidedToggle,
 *   isAllowanceProvided
 * } = useAllowances(data.allowances, onUpdate);
 */
export function useAllowances(
  allowances: Allowances | undefined,
  onUpdate: (data: Partial<JobPostingFormData>) => void
): UseAllowancesResult {
  // 보장시간 변경
  const handleGuaranteedHoursChange = useCallback(
    (value: string) => {
      const hours = parseInt(value.replace(/[^0-9]/g, ''), 10) || 0;
      onUpdate({
        allowances: {
          ...allowances,
          guaranteedHours: hours > 0 ? hours : undefined,
        },
      });
    },
    [allowances, onUpdate]
  );

  // 수당 금액 변경
  const handleAllowanceChange = useCallback(
    (key: string, value: string) => {
      const amount = parseCurrency(value);
      onUpdate({
        allowances: {
          ...allowances,
          [key]: amount > 0 ? amount : undefined,
        },
      });
    },
    [allowances, onUpdate]
  );

  // 수당 "제공" 토글
  const handleAllowanceProvidedToggle = useCallback(
    (key: string, isProvided: boolean) => {
      onUpdate({
        allowances: {
          ...allowances,
          [key]: isProvided ? PROVIDED_FLAG : undefined,
        },
      });
    },
    [allowances, onUpdate]
  );

  // 수당 값이 "제공" 상태인지 확인
  const isAllowanceProvided = useCallback(
    (value: number | undefined): boolean => {
      return value === PROVIDED_FLAG;
    },
    []
  );

  return {
    handleGuaranteedHoursChange,
    handleAllowanceChange,
    handleAllowanceProvidedToggle,
    isAllowanceProvided,
  };
}
