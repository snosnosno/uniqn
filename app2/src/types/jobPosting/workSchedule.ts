/**
 * 스태프 역할 유형
 */
export type StaffRole = '딜러' | '플로어' | '서빙' | '매니저' | '직원' | '기타';

/**
 * 역할 목록 상수
 */
export const STAFF_ROLES: StaffRole[] = ['딜러', '플로어', '서빙', '매니저', '직원', '기타'];

/**
 * 근무 일정 정보
 *
 * @property {number} daysPerWeek - 주 출근일수 (1-7)
 * @property {string} startTime - 근무 시작시간 (HH:mm 형식, 예: "18:00")
 * @property {string} endTime - 근무 종료시간 (HH:mm 형식, 예: "02:00")
 *
 * @example
 * ```typescript
 * const schedule: WorkSchedule = {
 *   daysPerWeek: 5,
 *   startTime: '18:00',
 *   endTime: '02:00'
 * };
 * ```
 */
export interface WorkSchedule {
  /** 주 출근일수 (1-7 범위) */
  daysPerWeek: number;

  /** 근무 시작시간 (HH:mm) */
  startTime: string;

  /** 근무 종료시간 (HH:mm, 익일 새벽 시간 허용) */
  endTime: string;
}

/**
 * 역할별 필요 인원 정보
 *
 * @property {string} id - 고유 식별자 (동적 추가/삭제를 위한 React key)
 * @property {StaffRole} role - 역할 유형
 * @property {number} count - 필요 인원수 (양의 정수)
 *
 * @example
 * ```typescript
 * const roleWithCount: RoleWithCount = {
 *   id: '1732348800000',
 *   role: '딜러',
 *   count: 3
 * };
 * ```
 */
export interface RoleWithCount {
  /** 고유 식별자 (timestamp 또는 UUID) */
  id: string;

  /** 역할 유형 */
  role: StaffRole;

  /** 필요 인원수 (최소 1명) */
  count: number;
}

/**
 * FixedWorkScheduleSection Props
 *
 * Props Grouping 패턴:
 * - data: 근무일정 데이터
 * - handlers: 이벤트 핸들러
 * - validation: 검증 에러 (선택)
 *
 * Note: role은 string 타입으로 JobPostingFormData와 호환
 */
export interface FixedWorkScheduleSectionProps {
  /** 근무일정 데이터 */
  data: {
    /** 근무 일정 (주 출근일수, 시간대) */
    workSchedule: WorkSchedule;

    /** 역할별 필요 인원 목록 */
    requiredRolesWithCount: Array<{
      id: string;
      role: string; // JobPostingFormData 호환을 위해 string 사용
      count: number;
    }>;
  };

  /** 이벤트 핸들러 */
  handlers: {
    /** 근무일정 변경 핸들러 */
    onWorkScheduleChange: (schedule: WorkSchedule) => void;

    /** 역할 목록 변경 핸들러 */
    onRolesChange: (roles: Array<{ id: string; role: string; count: number }>) => void;
  };

  /** 유효성 검증 (선택) */
  validation?: {
    /** 필드별 에러 메시지 */
    errors: Record<string, string>;

    /** 필드 터치 여부 */
    touched: Record<string, boolean>;
  };
}
