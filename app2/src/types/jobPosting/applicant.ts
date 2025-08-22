import { Timestamp } from 'firebase/firestore';

/**
 * 지원자 타입 정의
 */
export interface Applicant {
  id: string;
  userId: string;
  name: string;
  email?: string;
  phone?: string;
  role: string;
  timeSlot: string;
  date?: string; // 지원 날짜 (기존 호환성)
  assignedDate?: string; // yyyy-MM-dd format - 확정된 스태프 할당 날짜
  createdAt: Timestamp; // Firebase Timestamp
  status: 'pending' | 'confirmed' | 'rejected';
  eventId: string;
  additionalInfo?: string;
  
  // 다중 선택 지원을 위한 새로운 필드들 (하위 호환성을 위해 선택적)
  assignedRoles?: string[]; // 선택한 역할들
  assignedTimes?: string[]; // 선택한 시간들
  assignedDates?: string[]; // 선택한 날짜들
}

/**
 * 지원자 통계
 */
export interface ApplicantStats {
  total: number;
  byStatus: {
    pending: number;
    confirmed: number;
    rejected: number;
  };
  byRole: { [role: string]: number };
  byTimeSlot: { [timeSlot: string]: number };
}