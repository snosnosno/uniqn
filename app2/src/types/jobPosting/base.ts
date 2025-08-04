import { Timestamp } from 'firebase/firestore';

/**
 * 사전 질문 타입 정의
 */
export interface PreQuestion {
  id: string;
  question: string;
  required: boolean;
  type: 'text' | 'textarea' | 'select';
  options?: string[]; // select 타입일 때만 사용
}

/**
 * 사전 질문 답변 타입 정의
 */
export interface PreQuestionAnswer {
  questionId: string;
  question?: string; // 질문 텍스트 (호환성을 위해 optional)
  answer: string;
  required?: boolean; // 필수 여부 (호환성을 위해 optional)
}

/**
 * 복리후생 정보 타입
 */
export interface Benefits {
  guaranteedHours?: string; // 보장시간
  clothing?: string;        // 복장
  meal?: string;           // 식사
  transportation?: string;  // 교통비
  mealAllowance?: string;   // 식비
  accommodation?: string;   // 숙소
}

/**
 * 역할 요구사항
 */
export interface RoleRequirement {
  name: string;
  count: number;
}

/**
 * 시간대 정보
 */
export interface TimeSlot {
  time: string;
  roles: RoleRequirement[];
  date?: string; // 선택적 필드: yyyy-MM-dd 형식, 특정 날짜에만 적용될 때 사용
  
  // 미정 기능 지원
  isTimeToBeAnnounced?: boolean;
  tentativeDescription?: string; // 미정인 경우 추가 설명 (예: "토너먼트 진행 상황에 따라 결정")
}

/**
 * 날짜별 요구사항
 */
export interface DateSpecificRequirement {
  date: string | Timestamp | { seconds: number }; // yyyy-MM-dd 형식 또는 Firebase Timestamp
  timeSlots: TimeSlot[];
}

/**
 * 확정된 스태프 정보
 */
export interface ConfirmedStaff {
  userId: string;        // 실제 사용하는 필드명으로 수정 (staffId → userId)
  name: string;
  role: string;
  timeSlot: string;
  date?: string;
  confirmedAt: Timestamp;
}

/**
 * 선택 항목 (지원 시 사용)
 */
export interface SelectionItem {
  timeSlot: string;
  role: string;
  date?: string;
}

/**
 * 다중 선택 관련 유틸리티 타입
 */
export interface MultipleSelection {
  roles: string[];
  times: string[];
  dates: string[];
}