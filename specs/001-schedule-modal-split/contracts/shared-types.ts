/**
 * Shared Types for ScheduleDetailModal
 *
 * Feature: 001-schedule-modal-split
 * Created: 2025-11-05
 * Purpose: 공통 타입 정의 - 여러 컴포넌트에서 사용하는 타입
 *
 * 이 파일은 실제 구현에서 app2/src/pages/MySchedulePage/components/ScheduleDetailModal/types.ts로 복사됩니다.
 */

import { PayrollCalculationResult } from '../../../utils/payrollCalculations';

/**
 * 급여 정보
 *
 * 급여 계산 결과를 담는 인터페이스
 */
export interface SalaryInfo {
  /** 급여 타입 */
  salaryType: 'hourly' | 'daily' | 'monthly' | 'other';

  /** 기본 급여 (시급/일급/월급) */
  baseSalary: number;

  /** 총 근무 시간 */
  totalHours: number;

  /** 총 근무 일수 (일정은 항상 1) */
  totalDays: number;

  /** 기본급 계산 결과 (baseSalary × totalHours 또는 baseSalary × totalDays) */
  basePay: number;

  /** 수당 (식비, 교통비, 숙박비, 보너스, 기타) */
  allowances: PayrollCalculationResult['allowances'];

  /** 세금 (선택적, 세금 설정이 있을 때만) */
  tax?: number;

  /** 세율 (선택적, 세율 기반 계산일 때만) */
  taxRate?: number;

  /** 세후 금액 (선택적, 세금이 있을 때만) */
  afterTaxAmount?: number;
}

/**
 * 근무 내역 항목
 *
 * 근무 기록을 표시하기 위한 key-value 쌍
 */
export interface WorkHistoryItem {
  /** 항목 라벨 */
  label: string;

  /** 항목 값 */
  value: string | number;

  /** 표시 타입 (선택적) */
  type?: 'info' | 'warning' | 'success' | 'error';
}

/**
 * 탭 타입
 *
 * 활성 탭을 나타내는 리터럴 타입
 */
export type TabType = 'basic' | 'work' | 'calculation';

/**
 * 출석 상태
 *
 * WorkLog의 출석 상태를 나타내는 리터럴 타입
 */
export type AttendanceStatus = 'attended' | 'absent' | 'pending';

/**
 * 일정 상태 표시 정보
 *
 * 일정 타입에 따른 표시 텍스트 및 색상
 */
export interface ScheduleTypeDisplay {
  /** 표시 텍스트 */
  text: string;

  /** Tailwind CSS 색상 클래스 */
  color: string;

  /** 아이콘 (선택적) */
  icon?: React.ComponentType<{ className?: string }>;
}
