/**
 * Component Props Interfaces for ScheduleDetailModal
 *
 * Feature: 001-schedule-modal-split
 * Created: 2025-11-05
 * Purpose: TypeScript 인터페이스 정의 - 각 컴포넌트의 Props
 *
 * 이 파일은 실제 구현에서 app2/src/pages/MySchedulePage/components/ScheduleDetailModal/types.ts로 복사됩니다.
 */

import { ScheduleEvent } from '../../../types/schedule';
import { JobPosting } from '../../../types/jobPosting/jobPosting';
import { UnifiedWorkLog } from '../../../types/unified/workLog';
import { SalaryInfo, WorkHistoryItem } from './shared-types';

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
