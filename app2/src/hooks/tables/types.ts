/**
 * 테이블 관련 공통 타입 정의
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
}

export interface BalancingResult {
  participantId: string;
  fromTableNumber: number;
  fromSeatIndex: number;
  toTableNumber: number;
  toSeatIndex: number;
}

export interface TableState {
  id: string;
  tableNumber: number;
  participants: string[];
  totalChips: number;
  maxSeats: number;
  chipGroups: { top: number; middle: number; bottom: number };
}
