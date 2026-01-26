/**
 * UNIQN Mobile - 정산 그룹핑 타입 정의
 *
 * @description 같은 스태프(staffId)의 여러 WorkLog를 통합 표시
 * @version 1.0.0
 */

import type { WorkLog, PayrollStatus } from './schedule';

// ============================================================================
// Types
// ============================================================================

/**
 * 날짜별 정산 상태 (그룹 펼침 시 표시)
 */
export interface DateSettlementStatus {
  /** 날짜 (YYYY-MM-DD) */
  date: string;
  /** 포맷된 날짜 (예: "1/15(수)") */
  formattedDate: string;
  /** 정산 상태 */
  payrollStatus: PayrollStatus;
  /** 정산 금액 (세후) */
  amount: number;
  /** 해당 날짜의 원본 WorkLog ID */
  workLogId: string;
  /** 역할 */
  role: string;
  /** 커스텀 역할명 */
  customRole?: string;
  /** 출퇴근 완료 여부 */
  hasValidTimes: boolean;
}

/**
 * 통합 정산 그룹
 *
 * 같은 스태프(staffId)의 연속/비연속 다중 날짜를 하나의 카드로 통합 표시
 *
 * @example
 * 스태프 A의 3일 근무:
 * - 기존: 3개의 개별 SettlementCard
 * - 개선: 1개의 GroupedSettlementCard ("1월 15일 ~ 17일 (3건)")
 */
export interface GroupedSettlement {
  /** 고유 ID: "grouped_settlement_{staffId}" */
  id: string;

  /** 스태프 ID */
  staffId: string;

  /** 공고 ID - 첫 번째 WorkLog의 jobPostingId */
  jobPostingId: string;

  /** 스태프 프로필 정보 (비정규화) */
  staffProfile: {
    name?: string;
    nickname?: string;
    photoURL?: string;
  };

  /**
   * 날짜 범위 정보
   */
  dateRange: {
    /** 시작 날짜 (YYYY-MM-DD) */
    start: string;
    /** 종료 날짜 (YYYY-MM-DD) */
    end: string;
    /** 전체 날짜 배열 (정렬됨) */
    dates: string[];
    /** 총 근무일수 */
    totalDays: number;
    /** 연속 날짜 여부 */
    isConsecutive: boolean;
  };

  /**
   * 역할 목록 (다중 역할 통합 지원)
   * 예: ["딜러"], ["딜러", "플로어맨"]
   */
  roles: string[];

  /**
   * 커스텀 역할명 목록 (roles와 동일 인덱스로 매핑)
   */
  customRoles?: (string | undefined)[];

  /**
   * 날짜별 정산 상태 (펼침 시 표시)
   */
  dateStatuses: DateSettlementStatus[];

  /** 원본 WorkLog 배열 */
  originalWorkLogs: WorkLog[];

  /**
   * 정산 요약 정보
   */
  summary: {
    /** 총 근무 건수 */
    totalCount: number;
    /** 미정산 건수 */
    pendingCount: number;
    /** 정산 완료 건수 */
    completedCount: number;
    /** 총 금액 (세후) */
    totalAmount: number;
    /** 미정산 금액 */
    pendingAmount: number;
    /** 정산 완료 금액 */
    completedAmount: number;
    /** 정산 가능 건수 (출퇴근 완료 + 미정산) */
    settlableCount: number;
  };

  /**
   * 대표 정산 상태 (UI 배지 표시용)
   * - all_pending: 전체 미정산
   * - all_completed: 전체 정산완료
   * - partial: 일부 정산완료
   */
  overallStatus: 'all_pending' | 'all_completed' | 'partial';
}

/**
 * 그룹핑 옵션
 */
export interface GroupSettlementOptions {
  /** 그룹핑 활성화 여부 (기본: true) */
  enabled?: boolean;
  /** 최소 그룹 크기 (이 수 이상일 때만 그룹화, 기본: 1) */
  minGroupSize?: number;
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * GroupedSettlement인지 확인하는 타입 가드
 */
export function isGroupedSettlement(
  item: WorkLog | GroupedSettlement
): item is GroupedSettlement {
  return 'dateRange' in item && 'originalWorkLogs' in item && 'summary' in item;
}
