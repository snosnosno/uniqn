/**
 * Feature Flag 설정
 *
 * 애플리케이션의 기능을 동적으로 활성화/비활성화하는 설정 파일입니다.
 * 초기 출시 시 일부 기능을 비공개하고, 향후 쉽게 활성화할 수 있도록 관리합니다.
 *
 * @example
 * // 기능 활성화 확인
 * if (FEATURE_FLAGS.TOURNAMENTS) {
 *   // 토너먼트 기능 표시
 * }
 */

/**
 * 기능 플래그 타입 정의
 */
export type FeatureFlag = keyof typeof FEATURE_FLAGS;

/**
 * 기능 플래그 설정
 *
 * true: 기능 활성화 (공개)
 * false: 기능 비활성화 (준비 중)
 */
export const FEATURE_FLAGS = {
  // ========================================
  // 비공개 기능 (초기 출시 시)
  // ========================================

  /**
   * 토너먼트 관리 기능
   * - 경로: /app/tournaments
   * - 설명: 토너먼트 생성, 조회, 수정, 삭제 관리
   */
  TOURNAMENTS: true,

  /**
   * 참가자 관리 기능
   * - 경로: /app/participants
   * - 설명: 토너먼트 참가자 등록 및 관리
   */
  PARTICIPANTS: true,

  /**
   * 테이블 관리 기능
   * - 경로: /app/tables
   * - 설명: 게임 테이블 생성 및 배치 관리
   */
  TABLES: true,

  /**
   * 교대 관리 기능
   * - 경로: /app/admin/shift-schedule
   * - 설명: 스태프 교대 스케줄 관리
   */
  SHIFT_SCHEDULE: false,

  /**
   * 상금 관리 기능
   * - 경로: /app/admin/prizes
   * - 설명: 토너먼트 상금 분배 및 관리
   */
  PRIZES: false,

  // ========================================
  // 공개 기능 (초기 출시 포함)
  // ========================================

  /**
   * 구인구직 게시판
   * - 경로: /app/jobs
   * - 설명: 딜러 구인공고 조회 및 지원
   */
  JOB_BOARD: true,

  /**
   * 프로필 관리
   * - 경로: /app/profile
   * - 설명: 사용자 프로필 조회 및 수정
   */
  PROFILE: true,

  /**
   * 스케줄 조회
   * - 경로: /app/schedule, /app/my-schedule
   * - 설명: 개인 근무 스케줄 확인
   */
  SCHEDULE: true,

  /**
   * 출석 관리
   * - 경로: /app/attendance
   * - 설명: 출석 체크 및 기록
   */
  ATTENDANCE: true,

  /**
   * 알림 시스템
   * - 경로: /app/notifications
   * - 설명: 푸시 알림 및 공지사항
   */
  NOTIFICATIONS: true,

  /**
   * 관리자 대시보드
   * - 경로: /app/admin/ceo-dashboard
   * - 설명: CEO/관리자 전용 대시보드
   */
  ADMIN_DASHBOARD: true,

  /**
   * 구인공고 관리
   * - 경로: /app/admin/job-postings
   * - 설명: 구인공고 작성 및 관리
   */
  JOB_POSTING_MANAGEMENT: true,

  /**
   * 사용자 관리
   * - 경로: /app/admin/user-management
   * - 설명: 사용자 권한 및 승인 관리
   */
  USER_MANAGEMENT: true,

  /**
   * 문의 관리
   * - 경로: /app/admin/inquiries
   * - 설명: 사용자 문의 처리
   */
  INQUIRY_MANAGEMENT: true,

  /**
   * 지원서 승인
   * - 경로: /app/admin/approvals
   * - 설명: 딜러 지원서 승인/거절
   */
  APPROVALS: true,

  // ========================================
  // 리팩토링 기능 (점진적 배포)
  // ========================================

  /**
   * 리팩토링된 구인공고 폼
   * - 설명: JobPostingForm 컴포넌트 분리 (988줄 → 6개 파일)
   * - 목적: 테스트 가능성, 재사용성, 유지보수성 향상
   * - 배포 전략: 2주간 병렬 운영 후 전환
   */
  USE_REFACTORED_JOB_FORM: false,
} as const;

/**
 * Feature Flag 활성화 여부 확인 헬퍼 함수
 *
 * @param feature - 확인할 기능 플래그
 * @returns 기능 활성화 여부
 *
 * @example
 * if (isFeatureEnabled('TOURNAMENTS')) {
 *   // 토너먼트 기능 표시
 * }
 */
export const isFeatureEnabled = (feature: FeatureFlag): boolean => {
  return FEATURE_FLAGS[feature] === true;
};

/**
 * 환경별 Feature Flag 오버라이드
 *
 * 개발 환경에서는 모든 기능을 활성화하여 테스트할 수 있습니다.
 *
 * @example
 * // 개발 환경에서 모든 기능 활성화
 * export const isDevelopment = process.env.NODE_ENV === 'development';
 *
 * if (isDevelopment) {
 *   // 개발 환경에서는 모든 기능 활성화
 *   Object.keys(FEATURE_FLAGS).forEach(key => {
 *     (FEATURE_FLAGS as any)[key] = true;
 *   });
 * }
 */
export const isDevelopment = process.env.NODE_ENV === 'development';

/**
 * 비활성 기능 목록 조회
 *
 * @returns 비활성화된 기능 플래그 목록
 */
export const getDisabledFeatures = (): FeatureFlag[] => {
  return (Object.keys(FEATURE_FLAGS) as FeatureFlag[]).filter(
    (key) => FEATURE_FLAGS[key] === false
  );
};

/**
 * 활성 기능 목록 조회
 *
 * @returns 활성화된 기능 플래그 목록
 */
export const getEnabledFeatures = (): FeatureFlag[] => {
  return (Object.keys(FEATURE_FLAGS) as FeatureFlag[]).filter(
    (key) => FEATURE_FLAGS[key] === true
  );
};
