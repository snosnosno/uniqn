/**
 * 구인공고 기본 타입 정의
 * 
 * 이 파일은 T-HOLDEM 프로젝트의 구인공고 시스템을 위한 기본 타입들을 정의합니다.
 * 
 * @version 2.0
 * @since 2025-01-01
 * @author T-HOLDEM Development Team
 * 
 * 주요 특징:
 * - 구인공고 관련 모든 기본 타입 정의
 * - 사전 질문, 복리후생, 역할 요구사항 등 포함
 * - 표준화된 필드명 사용
 * - 타입 안전성 보장
 */

import { Timestamp } from 'firebase/firestore';

/**
 * 사전 질문 타입 정의
 * @description 구인공고 지원 시 추가로 물어보는 질문들을 정의합니다.
 */
export interface PreQuestion {
  /** 질문 고유 ID */
  id: string;
  
  /** 질문 내용 */
  question: string;
  
  /** 필수 응답 여부 */
  required: boolean;
  
  /** 질문 타입 */
  type: 'text' | 'textarea' | 'select';
  
  /** 선택형 질문의 옵션들 (select 타입일 때만 사용) */
  options?: string[];
}

/**
 * 사전 질문 답변 타입 정의
 * @description 지원자가 사전 질문에 대한 답변을 저장하는 타입입니다.
 */
export interface PreQuestionAnswer {
  /** 질문 ID (PreQuestion.id와 매칭) */
  questionId: string;
  
  /** 질문 텍스트 (호환성을 위해 optional, 실제로는 PreQuestion에서 참조) */
  question?: string;
  
  /** 답변 내용 */
  answer: string;
  
  /** 필수 여부 (호환성을 위해 optional, 실제로는 PreQuestion에서 참조) */
  required?: boolean;
}

/**
 * 복리후생 정보 타입
 * @description 구인공고에서 제공하는 복리후생 정보를 정의합니다.
 */
export interface Benefits {
  /** 보장시간 */
  guaranteedHours?: string;
  
  /** 복장 관련 지원 */
  clothing?: string;
  
  /** 식사 제공 여부 */
  meal?: string;
  
  /** 교통비 지원 */
  transportation?: string;
  
  /** 식비 지원 */
  mealAllowance?: string;
  
  /** 숙소 제공 여부 */
  accommodation?: string;
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
 * @description 각 시간대별 근무 정보를 정의합니다.
 * 당일 종료, 다음날 종료, 여러날 연속 근무 등을 지원합니다.
 */
export interface TimeSlot {
  /** 시작 시간 (HH:mm 형식) */
  time: string;
  
  /** 역할별 필요 인원 */
  roles: RoleRequirement[];
  
  /** 특정 날짜에만 적용될 때 사용 (yyyy-MM-dd 형식) */
  date?: string;
  
  // 미정 기능 지원
  isTimeToBeAnnounced?: boolean;
  tentativeDescription?: string; // 미정인 경우 추가 설명 (예: "토너먼트 진행 상황에 따라 결정")
  
  // 🆕 종료 시간 및 날짜 설정
  /** 종료 시간 (HH:mm 형식) */
  endTime?: string;
  
  /** 다른 날짜에 종료되는 경우 종료 날짜 (yyyy-MM-dd 형식) */
  endDate?: string;
  
  /** 당일 전체 운영 여부 (00:00 ~ 23:59) */
  isFullDay?: boolean;
  
  /** 다음날 종료 여부 (자정을 넘는 경우) */
  endsNextDay?: boolean;
  
  /** 기간 설정 (여러 날 연속 근무) */
  duration?: {
    /** 단일 날짜 또는 여러 날짜 */
    type: 'single' | 'multi';
    /** multi일 때 종료 날짜 */
    endDate?: string;
  };
}

/**
 * 날짜별 요구사항
 * @description 각 날짜별 인원 요구사항과 시간대 정보를 정의합니다.
 */
export interface DateSpecificRequirement {
  /** 날짜 (yyyy-MM-dd 형식 또는 Firebase Timestamp) */
  date: string | Timestamp | { seconds: number };
  
  /** 해당 날짜의 시간대별 요구사항 */
  timeSlots: TimeSlot[];
  
  // 🆕 표시용 메타데이터
  /** 메인 행사 날짜 여부 */
  isMainDate?: boolean;
  
  /** 표시 순서 (정렬용) */
  displayOrder?: number;
  
  /** 날짜 설명 (예: "Day 1", "예선전") */
  description?: string;
}

/**
 * 확정된 스태프 정보
 * @description 구인공고에 확정된 스태프 정보를 저장합니다.
 * 
 * 필드 표준화:
 * - userId 필드는 다른 컬렉션의 staffId와 동일한 의미입니다.
 * - 구인공고 컨텍스트에서는 userId를 사용하지만, 실제로는 스태프 ID를 의미합니다.
 */
export interface ConfirmedStaff {
  /** 
   * 사용자 ID (실제로는 스태프 ID와 동일한 의미)
   * @description 다른 컬렉션의 staffId와 동일한 값을 가집니다.
   */
  userId: string;
  
  /** 스태프 이름 */
  name: string;
  
  /** 역할 */
  role: string;
  
  /** 시간대 */
  timeSlot: string;
  
  /** 날짜 (특정 날짜에만 적용되는 경우) */
  date?: string;
  
  /** 확정 시간 */
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