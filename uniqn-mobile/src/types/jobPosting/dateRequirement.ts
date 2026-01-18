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
import type { SalaryInfo } from '../jobPosting';

/**
 * 역할 요구사항
 *
 * @description 시간대별 필요한 역할과 인원수
 * @note 레거시 호환을 위해 일부 필드가 선택적입니다. 새 코드에서는 id, role, headcount를 사용하세요.
 */
export interface RoleRequirement {
  /** 고유 ID (React Hook Form useFieldArray용) */
  id?: string;

  /** 역할 (dealer, floorman, supervisor, chip_runner, other) */
  role?: StaffRole | 'other';

  /** 커스텀 역할명 (role이 'other'일 때만 사용) */
  customRole?: string;

  /** 필요 인원 (1-200) */
  headcount?: number;

  /** 역할별 급여 */
  salary?: SalaryInfo;

  // === 레거시 호환 필드 ===
  /** @deprecated role 사용 권장 - 역할 이름 (레거시 데이터 호환용) */
  name?: StaffRole | string;

  /** @deprecated headcount 사용 권장 - 필요 인원 (레거시 데이터 호환용) */
  count?: number;

  /** @deprecated 충원된 인원 (레거시 데이터 호환용) */
  filled?: number;
}

/**
 * 시간대 정보 (간소화)
 *
 * @description
 * - 시작시간만 입력 (종료시간 제거)
 * - 시간 미정 지원
 * - 역할별 인원 관리
 * @note 레거시 호환을 위해 일부 필드가 선택적입니다. 새 코드에서는 id, startTime을 사용하세요.
 */
export interface TimeSlot {
  /** 고유 ID (React Hook Form useFieldArray용) */
  id?: string;

  /** 시작 시간 (HH:mm 형식) */
  startTime?: string;

  /** 시간 미정 여부 */
  isTimeToBeAnnounced?: boolean;

  /** 미정일 때 설명 (예: "토너먼트 진행 상황에 따라 결정") */
  tentativeDescription?: string;

  /** 역할별 필요 인원 */
  roles: RoleRequirement[];

  // === 레거시 호환 필드 ===
  /** @deprecated startTime 사용 권장 - 레거시 데이터 호환용 */
  time?: string;

  /** @deprecated 종료 시간 (HH:mm 형식) - 레거시 데이터 호환용 */
  endTime?: string;

  /** @deprecated 종일 여부 - 레거시 데이터 호환용 */
  isFullDay?: boolean;
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

  /**
   * 그룹화 여부
   * - true: 연속 날짜를 하나의 그룹으로 표시 (시간대 공유)
   * - false/undefined: 개별 날짜로 표시
   */
  isGrouped?: boolean;

  // === 레거시 호환 필드 ===
  /** @deprecated 메인 행사 날짜 여부 - 레거시 데이터 호환용 */
  isMainDate?: boolean;

  /** @deprecated 표시 순서 (정렬용) - 레거시 데이터 호환용 */
  displayOrder?: number;

  /** @deprecated 날짜 설명 (예: "Day 1", "예선전") - 레거시 데이터 호환용 */
  description?: string;
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
 * 시간대 정렬 (빠른 시간 순서)
 */
function sortTimeSlots(timeSlots: TimeSlot[]): TimeSlot[] {
  return [...timeSlots].sort((a, b) => {
    // 시간 미정인 경우 맨 뒤로
    if (a.isTimeToBeAnnounced && !b.isTimeToBeAnnounced) return 1;
    if (!a.isTimeToBeAnnounced && b.isTimeToBeAnnounced) return -1;
    if (a.isTimeToBeAnnounced && b.isTimeToBeAnnounced) return 0;

    // 시작 시간 비교 (HH:mm 형식)
    const timeA = a.startTime ?? a.time ?? '99:99';
    const timeB = b.startTime ?? b.time ?? '99:99';
    return timeA.localeCompare(timeB);
  });
}

/**
 * 날짜별 요구사항 정렬
 *
 * @description 오늘 기준으로 가까운 미래 날짜 순, 같은 날짜 내에서는 빠른 시간 순
 */
export function sortDateRequirements(
  requirements: DateSpecificRequirement[]
): DateSpecificRequirement[] {
  const today = new Date().toISOString().split('T')[0] ?? '';

  return [...requirements]
    .map((req) => ({
      ...req,
      timeSlots: sortTimeSlots(req.timeSlots),
    }))
    .sort((a, b) => {
      // displayOrder가 있으면 우선 (레거시)
      if (a.displayOrder !== undefined && b.displayOrder !== undefined) {
        return a.displayOrder - b.displayOrder;
      }

      const dateA = getDateString(a.date);
      const dateB = getDateString(b.date);

      // 오늘 기준 분류
      const aIsFuture = dateA >= today;
      const bIsFuture = dateB >= today;

      // 미래 날짜가 과거 날짜보다 먼저
      if (aIsFuture && !bIsFuture) return -1;
      if (!aIsFuture && bIsFuture) return 1;

      // 둘 다 미래: 가까운 날짜 먼저
      if (aIsFuture && bIsFuture) {
        return dateA.localeCompare(dateB);
      }

      // 둘 다 과거: 최근 날짜 먼저
      return dateB.localeCompare(dateA);
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
