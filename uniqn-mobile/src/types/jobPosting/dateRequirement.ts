/**
 * 날짜별 요구사항 타입 정의 (간소화 버전)
 *
 * @version 2.0.0
 * @description
 * - 종료시간 제거 (시작시간만 사용)
 * - periodType 제거 (단일 날짜만)
 * - 불필요한 메타데이터 제거
 *
 * @see specs/react-native-app/22-migration-mapping.md
 */

import { Timestamp } from 'firebase/firestore';
import { StaffRole } from '../common';

/**
 * 역할 요구사항
 *
 * @description 시간대별 필요한 역할과 인원수
 */
export interface RoleRequirement {
  /** 고유 ID (React Hook Form useFieldArray용) */
  id: string;

  /** 역할 (dealer, floorman, supervisor, chip_runner, other) */
  role: StaffRole | 'other';

  /** 커스텀 역할명 (role이 'other'일 때만 사용) */
  customRole?: string;

  /** 필요 인원 (1-200) */
  headcount: number;
}

/**
 * 시간대 정보 (간소화)
 *
 * @description
 * - 시작시간만 입력 (종료시간 제거)
 * - 시간 미정 지원
 * - 역할별 인원 관리
 */
export interface TimeSlot {
  /** 고유 ID (React Hook Form useFieldArray용) */
  id: string;

  /** 시작 시간 (HH:mm 형식) */
  startTime: string;

  /** 시간 미정 여부 */
  isTimeToBeAnnounced: boolean;

  /** 미정일 때 설명 (예: "토너먼트 진행 상황에 따라 결정") */
  tentativeDescription?: string;

  /** 역할별 필요 인원 */
  roles: RoleRequirement[];
}

/**
 * 날짜별 요구사항 (간소화)
 *
 * @description
 * - 각 날짜별 시간대와 역할 관리
 * - 불필요한 메타데이터 제거
 */
export interface DateSpecificRequirement {
  /** 날짜 (yyyy-MM-dd 형식 또는 Firebase Timestamp) */
  date: string | Timestamp | { seconds: number };

  /** 해당 날짜의 시간대별 요구사항 */
  timeSlots: TimeSlot[];
}

/**
 * 타입별 날짜 제약사항
 */
export interface DateConstraint {
  /** 최대 추가 가능한 날짜 개수 */
  maxDates: number;

  /** 라벨 (UI 표시용) */
  label: string;
}

/**
 * 날짜별 요구사항에서 날짜 문자열 추출
 */
export function getDateString(dateInput: string | Timestamp | { seconds: number }): string {
  if (typeof dateInput === 'string') {
    return dateInput;
  }

  // Timestamp 객체
  if (dateInput instanceof Timestamp) {
    return dateInput.toDate().toISOString().split('T')[0] ?? '';
  }

  // Legacy Timestamp 객체
  if ('seconds' in dateInput) {
    return new Date(dateInput.seconds * 1000).toISOString().split('T')[0] ?? '';
  }

  return '';
}

/**
 * 날짜별 요구사항 정렬 (날짜 오름차순)
 */
export function sortDateRequirements(
  requirements: DateSpecificRequirement[]
): DateSpecificRequirement[] {
  return [...requirements].sort((a, b) => {
    const dateA = getDateString(a.date);
    const dateB = getDateString(b.date);
    return dateA.localeCompare(dateB);
  });
}

/**
 * 기본 시간대 생성 (초기값)
 */
export function createDefaultTimeSlot(): TimeSlot {
  return {
    id: generateId(),
    startTime: '09:00',
    isTimeToBeAnnounced: false,
    roles: [createDefaultRole()],
  };
}

/**
 * 기본 역할 생성 (초기값)
 */
export function createDefaultRole(): RoleRequirement {
  return {
    id: generateId(),
    role: 'dealer',
    headcount: 1,
  };
}

/**
 * 고유 ID 생성 (간단한 UUID)
 */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}
