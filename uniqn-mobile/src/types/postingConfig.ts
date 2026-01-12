/**
 * UNIQN Mobile - 공고 타입별 설정 타입 정의
 *
 * @description 웹앱(app2/)과 호환되는 PostingType 및 관련 설정 타입
 * 4가지 공고 타입: regular, fixed, tournament, urgent
 *
 * @version 1.0.0
 * @see app2/src/types/jobPosting/jobPosting.ts
 */

import { Timestamp } from 'firebase/firestore';
import type {
  DateSpecificRequirement as DateSpecificRequirementV2,
  TimeSlot as TimeSlotV2,
} from './jobPosting/dateRequirement';
import type { SalaryInfo } from './jobPosting';

/**
 * 공고 타입 (4가지)
 *
 * - regular: 일반 공고 (기본)
 * - fixed: 고정 공고 (기간제, 칩 소모)
 * - tournament: 대회 공고 (관리자 승인 필요)
 * - urgent: 긴급 공고 (칩 소모, 우선 노출)
 */
export type PostingType = 'regular' | 'fixed' | 'tournament' | 'urgent';

/**
 * 고정 공고 설정
 *
 * @description 기간제 상시 채용 공고 설정
 */
export interface FixedConfig {
  /** 게시 기간 (일) */
  durationDays: 7 | 30 | 90;

  /** 칩 소모량 */
  chipCost: 3 | 5 | 10;

  /** 만료 시간 */
  expiresAt: Timestamp;

  /** 생성 시간 */
  createdAt: Timestamp;
}

/**
 * 고정 공고 데이터 (근무 스케줄 포함)
 */
export interface FixedJobPostingData {
  /** 근무 스케줄 */
  workSchedule?: WorkSchedule;

  /** 역할별 모집 인원 */
  requiredRolesWithCount?: RoleWithCount[];
}

/**
 * 근무 스케줄 (고정공고용)
 */
export interface WorkSchedule {
  /** 근무 요일 */
  weekdays?: string[];

  /** 근무 시간대 */
  timeSlots?: string[];

  /** 추가 설명 */
  description?: string;
}

/**
 * 역할별 모집 인원
 */
export interface RoleWithCount {
  /** 역할 ID (dealer, manager 등) */
  role?: string;
  /** 역할 이름 (직원, 매니저 등 - FormRoleWithCount 호환) */
  name?: string;
  /** 필요 인원 */
  count: number;
  /** 충원된 인원 */
  filled?: number;
  /** 역할별 급여 */
  salary?: SalaryInfo;
}

/**
 * 대회 공고 설정
 *
 * @description 관리자 승인이 필요한 공식 대회/토너먼트 공고
 */
export interface TournamentConfig {
  /** 승인 상태 */
  approvalStatus: 'pending' | 'approved' | 'rejected';

  /** 승인한 관리자 ID */
  approvedBy?: string;

  /** 승인 시간 */
  approvedAt?: Timestamp;

  /** 거절한 관리자 ID */
  rejectedBy?: string;

  /** 거절 시간 */
  rejectedAt?: Timestamp;

  /** 거절 사유 */
  rejectionReason?: string;

  /** 재제출 시간 (거절 후 수정하여 재제출) */
  resubmittedAt?: Timestamp;

  /** 최초 제출 시간 */
  submittedAt: Timestamp;
}

/**
 * 긴급 공고 설정
 *
 * @description 급하게 인원이 필요한 경우의 공고 (우선 노출)
 */
export interface UrgentConfig {
  /** 칩 소모량 (고정) */
  chipCost: 5;

  /** 생성 시간 */
  createdAt: Timestamp;

  /** 우선순위 */
  priority: 'high';
}

/**
 * 역할별 모집 인원 (레거시)
 *
 * @deprecated types/jobPosting/dateRequirement.ts의 RoleRequirement 사용 권장
 * @description 레거시 호환성을 위해 유지. 새 코드에서는 사용하지 않음
 */
export interface LegacyRoleRequirement {
  /** 역할 이름 */
  name: string;

  /** 필요 인원 */
  count: number;
}

/**
 * @deprecated LegacyRoleRequirement로 대체됨
 */
export type RoleRequirement = LegacyRoleRequirement;

/**
 * 시간대 정보 (레거시 - 확장형)
 *
 * @deprecated types/jobPosting/dateRequirement.ts의 TimeSlot 사용 권장
 * @description 레거시 호환성을 위해 유지. 새 코드에서는 간소화된 버전 사용
 */
export interface LegacyTimeSlot {
  /** 시작 시간 (HH:mm 형식) */
  time: string;

  /** 역할별 필요 인원 */
  roles: LegacyRoleRequirement[];

  /** 특정 날짜에만 적용될 때 사용 (yyyy-MM-dd 형식) */
  date?: string;

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

  /** 미정 여부 */
  isTimeToBeAnnounced?: boolean;

  /** 미정인 경우 추가 설명 */
  tentativeDescription?: string;
}

/**
 * 시간대 정보 (v2.0)
 *
 * @description v2.0 타입을 사용. 레거시 호환을 위해 LegacyTimeSlot도 유지
 * @see types/jobPosting/dateRequirement.ts
 */
export type TimeSlot = TimeSlotV2;

/**
 * 날짜별 요구사항 (레거시 - 확장형)
 *
 * @deprecated types/jobPosting/dateRequirement.ts의 DateSpecificRequirement 사용 권장
 * @description 레거시 호환성을 위해 유지. 새 코드에서는 간소화된 버전 사용
 */
export interface LegacyDateSpecificRequirement {
  /** 날짜 (yyyy-MM-dd 형식 또는 Firebase Timestamp) */
  date: string | Timestamp | { seconds: number };

  /** 해당 날짜의 시간대별 요구사항 */
  timeSlots: LegacyTimeSlot[];

  /** 메인 행사 날짜 여부 */
  isMainDate?: boolean;

  /** 표시 순서 (정렬용) */
  displayOrder?: number;

  /** 날짜 설명 (예: "Day 1", "예선전") */
  description?: string;
}

/**
 * 날짜별 요구사항 (v2.0)
 *
 * @description v2.0 타입을 사용. 레거시 호환을 위해 LegacyDateSpecificRequirement도 유지
 * @see types/jobPosting/dateRequirement.ts
 */
export type DateSpecificRequirement = DateSpecificRequirementV2;

/**
 * 공고 타입별 라벨
 */
export const POSTING_TYPE_LABELS: Record<PostingType, string> = {
  regular: '일반',
  fixed: '고정',
  tournament: '대회',
  urgent: '긴급',
};

/**
 * 공고 타입별 배지 스타일 (NativeWind)
 */
export const POSTING_TYPE_BADGE_STYLES: Record<
  PostingType,
  { bgClass: string; textClass: string; darkBgClass: string; darkTextClass: string }
> = {
  regular: {
    bgClass: 'bg-gray-100',
    textClass: 'text-gray-700',
    darkBgClass: 'dark:bg-gray-800',
    darkTextClass: 'dark:text-gray-300',
  },
  fixed: {
    bgClass: 'bg-blue-100',
    textClass: 'text-blue-700',
    darkBgClass: 'dark:bg-blue-900/30',
    darkTextClass: 'dark:text-blue-300',
  },
  tournament: {
    bgClass: 'bg-purple-100',
    textClass: 'text-purple-700',
    darkBgClass: 'dark:bg-purple-900/30',
    darkTextClass: 'dark:text-purple-300',
  },
  urgent: {
    bgClass: 'bg-red-100',
    textClass: 'text-red-700',
    darkBgClass: 'dark:bg-red-900/30',
    darkTextClass: 'dark:text-red-300',
  },
};

/**
 * 날짜별 요구사항에서 날짜 문자열 추출
 *
 * @description 간소화된 버전과 레거시 버전 모두 지원
 */
export function getDateFromRequirement(req: DateSpecificRequirement): string {
  if (typeof req.date === 'string') {
    return req.date;
  }
  if (req.date instanceof Timestamp) {
    return req.date.toDate().toISOString().split('T')[0] ?? '';
  }
  if ('seconds' in req.date) {
    return new Date(req.date.seconds * 1000).toISOString().split('T')[0] ?? '';
  }
  return '';
}

/**
 * 시간대 정렬 (빠른 시간 순서)
 *
 * @description 시작 시간 기준으로 오름차순 정렬
 */
function sortTimeSlots(timeSlots: TimeSlotV2[]): TimeSlotV2[] {
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
 * - 오늘 이후 날짜: 가까운 날짜부터 (오름차순)
 * - 오늘 이전 날짜: 맨 뒤로 (최근 날짜부터)
 * - 같은 날짜 내 시간대: 빠른 시간 순
 */
export function sortDateRequirements(
  requirements: DateSpecificRequirement[]
): DateSpecificRequirement[] {
  const today = new Date().toISOString().split('T')[0] ?? '';

  return [...requirements]
    .map((req) => ({
      ...req,
      // 시간대도 정렬
      timeSlots: sortTimeSlots(req.timeSlots),
    }))
    .sort((a, b) => {
      // displayOrder가 있으면 우선 (레거시 타입 지원)
      const aOrder = 'displayOrder' in a ? a.displayOrder : undefined;
      const bOrder = 'displayOrder' in b ? b.displayOrder : undefined;
      if (aOrder !== undefined && bOrder !== undefined) {
        return aOrder - bOrder;
      }

      // 날짜 추출
      const dateA = getDateFromRequirement(a);
      const dateB = getDateFromRequirement(b);

      // 오늘 기준 분류
      const aIsFuture = dateA >= today;
      const bIsFuture = dateB >= today;

      // 미래 날짜가 과거 날짜보다 먼저
      if (aIsFuture && !bIsFuture) return -1;
      if (!aIsFuture && bIsFuture) return 1;

      // 둘 다 미래: 가까운 날짜 먼저 (오름차순)
      if (aIsFuture && bIsFuture) {
        return dateA.localeCompare(dateB);
      }

      // 둘 다 과거: 최근 날짜 먼저 (내림차순)
      return dateB.localeCompare(dateA);
    });
}
