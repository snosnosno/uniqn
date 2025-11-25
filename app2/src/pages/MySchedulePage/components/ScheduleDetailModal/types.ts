/**
 * Component Props Interfaces for ScheduleDetailModal
 *
 * Feature: 001-schedule-modal-split
 * Created: 2025-11-05
 * Purpose: TypeScript 인터페이스 정의 - 각 컴포넌트의 Props 및 공통 타입
 */

import { ScheduleEvent } from '@/types/schedule';
import { JobPosting } from '@/types/jobPosting/jobPosting';
import { UnifiedWorkLog } from '@/types/unified/workLog';
import { PayrollCalculationResult } from '@/utils/payrollCalculations';

/**
 * ScheduleDetailModal 컨테이너 컴포넌트 Props
 */
export interface ScheduleDetailModalProps {
  /** 모달 열림 상태 */
  isOpen: boolean;

  /** 모달 닫기 핸들러 */
  onClose: () => void;

  /** 표시할 일정 데이터 (null이면 모달 숨김) */
  schedule: ScheduleEvent | null;

  /** 퇴근 처리 핸들러 (선택적) */
  onCheckOut?: (scheduleId: string) => void;

  /** 지원 취소 핸들러 (선택적) */
  onCancel?: (scheduleId: string) => void;

  /** 일정 삭제 핸들러 (선택적, 향후 구현) */
  onDelete?: (scheduleId: string) => void;
}

/**
 * BasicInfoTab 컴포넌트 Props
 *
 * 기본 정보 탭: 일정 정보, 장소, 시간, 상태, 급여 정보 표시
 */
export interface BasicInfoTabProps {
  /** 일정 데이터 */
  schedule: ScheduleEvent;

  /** JobPosting 데이터 (null이면 스냅샷 사용) */
  jobPosting: JobPosting | null;

  /** 필드 업데이트 핸들러 (향후 편집 기능용, 현재 미사용) */
  onUpdate?: (field: keyof ScheduleEvent, value: unknown) => void;

  /** 읽기 전용 모드 (현재 항상 true) */
  isReadOnly: boolean;
}

/**
 * WorkInfoTab 컴포넌트 Props
 *
 * 근무 정보 탭: 스태프 배정, 출석 상태, 근무 기록 표시
 */
export interface WorkInfoTabProps {
  /** 일정 데이터 */
  schedule: ScheduleEvent;

  /** 실시간 WorkLog 리스트 */
  workLogs: UnifiedWorkLog[];

  /** 퇴근 처리 핸들러 */
  onCheckOut: (scheduleId: string) => void;

  /** 읽기 전용 모드 */
  isReadOnly: boolean;
}

/**
 * CalculationTab 컴포넌트 Props
 *
 * 급여 계산 탭: 기본급, 수당, 세금, 총 지급액 상세 표시
 */
export interface CalculationTabProps {
  /** 급여 정보 (계산된 데이터) */
  salaryInfo: SalaryInfo;

  /** 근무 내역 리스트 */
  workHistory: WorkHistoryItem[];
}

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
