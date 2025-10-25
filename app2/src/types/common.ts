/**
 * 공통 타입 정의
 * 
 * 이 파일은 T-HOLDEM 프로젝트 전반에서 사용되는 공통 타입들을 정의합니다.
 * 
 * @version 2.0
 * @since 2025-01-01
 * @author T-HOLDEM Development Team
 * 
 * 주요 표준화 사항:
 * - staffId (표준)
 * - scheduledStartTime/EndTime (표준)
 * - 모든 Firebase 문서는 FirebaseDocument를 상속받습니다.
 */
import { Timestamp } from 'firebase/firestore';

/**
 * Firebase 문서 기본 타입
 * @description 모든 Firebase 문서가 공통으로 가져야 하는 필드들을 정의합니다.
 */
export interface FirebaseDocument {
  /** 문서 고유 ID */
  id: string;
  
  /** 문서 생성 시간 */
  createdAt?: Timestamp | Date;
  
  /** 문서 수정 시간 */
  updatedAt?: Timestamp | Date;
}

/**
 * 스태프 관련 타입
 * @description 스태프의 기본 정보를 저장합니다.
 * 
 * 필드 우선순위:
 * - 시간 정보는 workLogs 컬렉션의 scheduledStartTime/EndTime을 우선 사용
 * - assignedTime은 fallback용으로만 사용
 */
export interface Staff extends FirebaseDocument {
  /** 스태프 이름 */
  name: string;
  
  /** 전화번호 */
  phone: string;
  
  /** 역할 */
  role: 'dealer' | 'manager' | 'chiprunner' | 'admin';
  
  /** 상태 */
  status: 'active' | 'inactive';
  
  /** 
   * @deprecated assignedTime은 workLogs의 scheduledStartTime/EndTime으로 대체되었습니다.
   * 하위 호환성을 위해 유지되며, 시간 정보는 workLogs 컬렉션에서 조회하세요.
   * 
   * 마이그레이션 가이드:
   * ```typescript
   * // ❌ 기존 방식
   * const assignedTime = staff.assignedTime;
   * 
   * // ✅ 권장 방식
   * // workLogs 컬렉션에서 해당 날짜의 scheduledStartTime/EndTime 조회
   * const workLog = await getWorkLogByDate(staff.id, date);
   * const scheduledTime = `${workLog.scheduledStartTime} - ${workLog.scheduledEndTime}`;
   * ```
   */
  assignedTime?: string;
  
  /** 이메일 주소 */
  email?: string;
  
  /** 은행명 */
  bankName?: string;
  
  /** 계좌번호 */
  accountNumber?: string;
  
  /** 비고 */
  notes?: string;
}

/**
 * WorkLog 타입 (공통 버전)
 * @description 기본 WorkLog 타입입니다. 더 자세한 기능은 types/attendance.ts 또는 types/unified/workLog.ts를 참조하세요.
 * 
 * 표준 필드: staffId 사용
 * 
 * @see types/attendance.ts - 출석 관련 확장 WorkLog
 * @see types/unified/workLog.ts - 통합 WorkLog (권장)
 */
export interface WorkLog extends FirebaseDocument {
  /** 스태프 ID (표준 필드) */
  staffId: string;
  
  
  /** 근무 날짜 (YYYY-MM-DD 형식) */
  date: string;
  
  /** 예정 시작 시간 */
  scheduledStartTime?: string;
  
  /** 예정 종료 시간 */
  scheduledEndTime?: string;
  
  /** 실제 시작 시간 */
  actualStartTime?: string;
  
  /** 실제 종료 시간 */
  actualEndTime?: string;
  
  /** 근무 상태 */
  status?: 'scheduled' | 'completed' | 'cancelled';
  
  /** 비고 */
  notes?: string;
}

/**
 * 출석 기록 타입 (공통 버전)
 * @description 기본 AttendanceRecord 타입입니다. 더 자세한 기능은 types/attendance.ts를 참조하세요.
 * 
 * 표준 필드: staffId, actualStartTime/EndTime 사용
 * 
 * @see types/attendance.ts - 완전한 AttendanceRecord 정의
 */
export interface AttendanceRecord extends FirebaseDocument {
  /** 스태프 ID (표준 필드) */
  staffId: string;
  
  
  /** 출석 날짜 (YYYY-MM-DD 형식) */
  date: string;
  
  /** 출석 상태 */
  status: 'not_started' | 'checked_in' | 'checked_out';
  
  /** 실제 출근 시간 (표준 필드) */
  actualStartTime?: Timestamp | Date;
  
  /** 실제 퇴근 시간 (표준 필드) */
  actualEndTime?: Timestamp | Date;
  
  /** QR 코드 ID */
  qrCodeId?: string;
  
  /** 비고 */
  notes?: string;
}

// 참가자 타입
export interface Participant extends FirebaseDocument {
  name: string;
  phoneNumber: string;
  tableNumber: number;
  seatNumber: number;
  buyIn: number;
  stack: number;
  status: 'active' | 'eliminated';
  notes?: string;
}

/**
 * 테이블 타입
 * @description 토너먼트 테이블 정보를 저장합니다.
 * 
 * 표준 필드: staffId 사용
 */
export interface Table extends FirebaseDocument {
  /** 테이블 번호 */
  number: number;
  
  /** 좌석 수 */
  seats: number;
  
  /** 참가자 목록 */
  participants: Participant[];
  
  /** 담당 스태프 ID (표준 필드) */
  staffId?: string;
  
  
  /** 테이블 상태 */
  status: 'active' | 'inactive' | 'break';
}

// 토너먼트 타입
export interface Tournament extends FirebaseDocument {
  name: string;
  date: string;
  startTime: string;
  endTime?: string;
  status: 'upcoming' | 'ongoing' | 'completed' | 'cancelled';
  participants: number;
  prizePool?: number;
  notes?: string;
}

// API 응답 타입
export interface ApiResponse<T> {
  data: T;
  error?: string;
  success: boolean;
}

// 페이지네이션 타입
export interface PaginationInfo {
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
}

// 쿼리 제약 타입
export interface QueryConstraint {
  field: string;
  operator: '<' | '<=' | '==' | '>' | '>=' | '!=' | 'array-contains' | 'array-contains-any' | 'in' | 'not-in';
  value: any;
}

// 폼 에러 타입
export interface FormErrors {
  [key: string]: string | undefined;
}

/**
 * 사용자 타입
 * @description 시스템 사용자 정보를 저장합니다.
 */
export interface User extends FirebaseDocument {
  /** 이메일 주소 */
  email: string;

  /** 사용자 이름 */
  name: string;

  /** 닉네임 */
  nickname?: string;

  /** 사용자 역할 */
  role: 'admin' | 'manager' | 'dealer' | 'staff' | 'user';

  /** 전화번호 */
  phone?: string;

  /** 프로필 이미지 URL */
  profileImage?: string;

  /** 활성 상태 */
  isActive: boolean;
}

// ============================================================================
// 마이그레이션 가이드 및 표준화된 필드 매핑
// ============================================================================

/**
 * T-HOLDEM 공통 타입 표준화 가이드
 * 
 * 이 파일의 타입들은 프로젝트 전반에서 사용되는 기본 타입들입니다.
 * 
 * 주요 표준화 원칙:
 * 1. 모든 Firebase 문서는 FirebaseDocument를 상속받습니다.
 * 2. staffId를 표준 식별자로 사용합니다.
 * 3. 시간 관련 필드는 명확한 의미를 가집니다 (scheduled, actual 구분).
 * 4. 모든 필드는 명확한 JSDoc 주석을 가집니다.
 * 
 * 필드 매핑 규칙:
 * - staffId (표준 필드)
 * - scheduledStartTime/EndTime (표준 시간 필드)
 * - actualStartTime/EndTime (표준) ← checkInTime/checkOutTime (deprecated)
 * 
 * 사용 예시:
 * ```typescript
 * // ✅ 권장 패턴
 * const staff: Staff = {
 *   id: 'staff-123',
 *   name: '김딜러',
 *   phone: '010-1234-5678',
 *   role: 'dealer',
 *   status: 'active',
 *   createdAt: Timestamp.now(),
 *   updatedAt: Timestamp.now()
 * };
 * 
 * // WorkLog 생성 시
 * const workLog: WorkLog = {
 *   id: 'worklog-456',
 *   staffId: staff.id, // 표준 필드 사용
 *   date: '2025-01-28',
 *   scheduledStartTime: '18:00',
 *   scheduledEndTime: '02:00',
 *   status: 'scheduled',
 *   createdAt: Timestamp.now(),
 *   updatedAt: Timestamp.now()
 * };
 * 
 * // staffId 사용 예시
 * const staffId = workLog.staffId;
 * ```
 * 
 * 타입 확장 가이드:
 * - 새로운 필드 추가 시 optional(?)로 시작하여 하위 호환성 보장
 * - 필드 이름 변경 시 기존 필드는 @deprecated로 표시
 * - 필수 필드 추가 시 마이그레이션 스크립트 제공
 * 
 * @version 2.0
 * @since 2025-01-01
 * @author T-HOLDEM Development Team
 */