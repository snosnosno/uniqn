/**
 * Staff Management Types
 *
 * 이 파일은 스태프 관련 타입 정의를 제공합니다.
 * Hook 로직은 제거되었으며, 실제 스태프 데이터는 JobPostingContext에서 관리됩니다.
 *
 * @see contexts/JobPostingContextAdapter.tsx - 실제 스태프/워크로그 데이터 관리
 */

// 계정 권한 - types/unifiedData.ts에서 정의된 UserRole 사용
// ⚠️ 중복 정의 제거됨 (2025-01-08)
// @see types/unifiedData.ts - UserRole enum (SSOT)
import { UserRole } from '@/types/unifiedData';
export { UserRole };

// 업무 역할 정의
export type JobRole =
  | 'Dealer' // 딜러
  | 'Floor' // 플로어
  | 'Server' // 서빙
  | 'Tournament Director' // 토너먼트 디렉터
  | 'Chip Master' // 칩 마스터
  | 'Registration' // 레지
  | 'Security' // 보안요원
  | 'Cashier'; // 캐셔

export interface StaffData {
  id: string;
  userId: string;
  name?: string;
  email?: string;
  phone?: string;
  role?: JobRole; // 업무 역할 (딜러, 플로어 등)
  userRole?: UserRole; // 계정 권한 (staff, employer, admin)
  gender?: string;
  age?: number;
  experience?: string;
  nationality?: string;
  region?: string; // 지역 정보
  history?: string;
  notes?: string;
  postingId: string;
  postingTitle: string;

  // 은행 정보
  bankName?: string;
  bankAccount?: string;
  residentId?: string;
  assignedEvents?: string[];
  assignedRole?: string;
  /** @deprecated - workLog의 scheduledStartTime/scheduledEndTime 사용 권장 */
  assignedTime?: string;
  assignedDate?: string;
}

export interface StaffFilters {
  searchTerm: string;
  selectedDate: string;
  selectedRole: string;
  selectedStatus: string;
}

export interface GroupedStaffData {
  grouped: Record<string, StaffData[]>;
  sortedDates: string[];
}
