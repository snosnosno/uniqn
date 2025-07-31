// 공통 타입 정의
import { Timestamp } from 'firebase/firestore';

// Firebase 문서 기본 타입
export interface FirebaseDocument {
  id: string;
  createdAt?: Timestamp | Date;
  updatedAt?: Timestamp | Date;
}

// 스태프 관련 타입
export interface Staff extends FirebaseDocument {
  name: string;
  phone: string;
  role: 'dealer' | 'manager' | 'chiprunner' | 'admin';
  status: 'active' | 'inactive';
  assignedTime?: string;
  email?: string;
  bankName?: string;
  accountNumber?: string;
  notes?: string;
}

// WorkLog 타입
export interface WorkLog extends FirebaseDocument {
  staffId: string;
  dealerId?: string; // 호환성을 위해 유지
  date: string;
  scheduledStartTime?: string;
  scheduledEndTime?: string;
  actualStartTime?: string;
  actualEndTime?: string;
  status?: 'scheduled' | 'completed' | 'cancelled';
  notes?: string;
}

// 출석 기록 타입
export interface AttendanceRecord extends FirebaseDocument {
  staffId: string;
  dealerId?: string; // 호환성을 위해 유지
  date: string;
  status: 'not_started' | 'checked_in' | 'checked_out';
  checkInTime?: Timestamp | Date;
  checkOutTime?: Timestamp | Date;
  qrCodeId?: string;
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

// 테이블 타입
export interface Table extends FirebaseDocument {
  number: number;
  seats: number;
  participants: Participant[];
  dealerId?: string;
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

// 사용자 타입
export interface User extends FirebaseDocument {
  email: string;
  name: string;
  role: 'admin' | 'manager' | 'dealer' | 'staff' | 'user';
  phone?: string;
  profileImage?: string;
  isActive: boolean;
}