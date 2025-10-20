/**
 * useTables.ts - 리팩토링 버전
 *
 * 테이블 관리 메인 Hook (통합 인터페이스)
 * - 외부 API 100% 동일하게 유지 (하위 호환성 보장)
 * - 내부 로직은 모듈화된 Hook들로 분리
 *
 * 변경 전: 1,305줄 (단일 파일)
 * 변경 후: ~150줄 (통합 인터페이스) + 5개 모듈 파일
 *
 * 모듈 구조:
 * - useTableSubscription: 실시간 구독
 * - useTableOperations: CRUD 작업
 * - useTableAssignment: 참가자 배정
 * - participantMover: 공통 로직 (중복 제거)
 * - tableHelpers: 유틸리티
 */

import { Dispatch, SetStateAction } from 'react';
import { Participant } from './useParticipants';

// 하위 Hook imports
import { useTableSubscription } from './tables/useTableSubscription';
import { useTableOperations } from './tables/useTableOperations';
import { useTableAssignment, AssignmentResult } from './tables/useTableAssignment';

/**
 * 테이블 인터페이스 (외부 export)
 */
export interface Table {
  id: string;
  name: string;
  tableNumber: number;
  seats: (string | null)[];
  status?: 'open' | 'closed' | 'standby';
  borderColor?: string;
  position?: { x: number; y: number };
  assignedStaffId?: string | null;
  assignedDealerId?: string | null; // @deprecated - assignedStaffId 사용 권장. 하위 호환성을 위해 유지
  tournamentId?: string | null; // 소속 토너먼트 ID (전체 보기 기능용)
  tournamentColor?: string | null; // 소속 토너먼트 색상 (전체 보기 기능용)
}

/**
 * 참가자 이동 결과 인터페이스 (외부 export)
 */
export interface BalancingResult {
  participantId: string;
  participantName: string;
  fromTableNumber: number;
  fromSeatIndex: number;
  toTableNumber: number;
  toSeatIndex: number;
}

/**
 * useTables Hook 반환 타입
 */
export interface UseTablesReturn {
  // 상태 (4개)
  tables: Table[];
  setTables: Dispatch<SetStateAction<Table[]>>;
  loading: boolean;
  error: Error | null;
  maxSeatsSetting: number;

  // 테이블 CRUD (11개)
  updateTableDetails: (tableId: string, data: { name?: string; borderColor?: string }) => Promise<void>;
  updateTablePosition: (tableId: string, position: { x: number; y: number }) => Promise<void>;
  updateTableOrder: (tables: Table[]) => Promise<void>;
  openNewTable: () => Promise<void>;
  openNewTableInTournament: (targetTournamentId: string) => Promise<void>;
  activateTable: (tableId: string) => Promise<void>;
  closeTable: (tableId: string) => Promise<BalancingResult[]>;
  deleteTable: (tableId: string) => Promise<BalancingResult[]>;
  updateTableMaxSeats: (
    tableId: string,
    newMaxSeats: number,
    getParticipantName: (id: string) => string
  ) => Promise<void>;
  assignTableToTournament: (tableIds: string[], targetTournamentId: string) => Promise<void>;

  // 참가자 배정 (5개)
  autoAssignSeats: (participants: Participant[]) => Promise<AssignmentResult[]>; // alias for rebalanceAndAssignAll
  assignWaitingParticipants: (participants: Participant[]) => Promise<AssignmentResult[]>;
  autoBalanceByChips: (participants: Participant[]) => Promise<AssignmentResult[]>;
  moveSeat: (
    participantId: string,
    from: { tableId: string; seatIndex: number },
    to: { tableId: string; seatIndex: number }
  ) => Promise<void>;
  bustOutParticipant: (participantId: string) => Promise<void>;
}

/**
 * 테이블 관리 메인 Hook
 *
 * @param userId 사용자 ID
 * @param tournamentId 토너먼트 ID (또는 'ALL')
 * @returns 테이블 상태 및 작업 함수들
 *
 * @example
 * ```typescript
 * const {
 *   tables,
 *   loading,
 *   error,
 *   openNewTable,
 *   closeTable,
 *   autoAssignSeats
 * } = useTables(userId, tournamentId);
 * ```
 */
export const useTables = (userId: string | null, tournamentId: string | null): UseTablesReturn => {
  // 1. 실시간 구독 (ALL 모드 지원)
  const subscriptionData = useTableSubscription(userId, tournamentId);

  // 2. CRUD 작업
  const operations = useTableOperations(
    userId,
    tournamentId,
    subscriptionData.tables,
    subscriptionData.maxSeatsSetting
  );

  // 3. 참가자 배정
  const assignments = useTableAssignment(
    userId,
    tournamentId,
    subscriptionData.tables,
    subscriptionData.maxSeatsSetting
  );

  // 4. 외부 API 통합 반환 (🔒 기존 API 100% 유지)
  return {
    // 상태 (4개)
    tables: subscriptionData.tables,
    setTables: subscriptionData.setTables,
    loading: subscriptionData.loading || operations.loading || assignments.loading,
    error: subscriptionData.error || operations.error || assignments.error,
    maxSeatsSetting: subscriptionData.maxSeatsSetting,

    // 테이블 CRUD (11개) - 순서 동일하게 유지
    updateTableDetails: operations.updateTableDetails,
    updateTablePosition: operations.updateTablePosition,
    updateTableOrder: operations.updateTableOrder,
    openNewTable: operations.openNewTable,
    openNewTableInTournament: operations.openNewTableInTournament,
    activateTable: operations.activateTable,
    closeTable: operations.closeTable,
    deleteTable: operations.deleteTable,
    updateTableMaxSeats: operations.updateTableMaxSeats,
    assignTableToTournament: operations.assignTableToTournament,

    // 참가자 배정 (5개) - 순서 동일하게 유지
    autoAssignSeats: assignments.rebalanceAndAssignAll, // ⚠️ alias 유지 (기존 API)
    assignWaitingParticipants: assignments.assignWaitingParticipants,
    autoBalanceByChips: assignments.autoBalanceByChips,
    moveSeat: assignments.moveSeat,
    bustOutParticipant: assignments.bustOutParticipant,
  };
};

/**
 * 기본 export (기존 코드 호환성)
 */
export default useTables;
