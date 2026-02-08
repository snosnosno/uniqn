/**
 * UNIQN Mobile - 지원자 관련 컴포넌트 (스태프/지원자 뷰)
 *
 * @version 1.3.0
 *
 * @description
 * 이 모듈은 **지원자(스태프)가 자신의 지원 내역을 확인**하는 용도입니다.
 *
 * - StaffApplicantCard: 지원 상태 및 확정/취소 이력 표시 (스태프 뷰)
 * - ConfirmationHistoryTimeline: 확정/취소 이력 타임라인
 *
 * @note
 * 구인자가 지원자를 관리(확정/거절)하려면 employer/ApplicantCard를 사용하세요:
 * `import { ApplicantCard } from '@/components/employer/applicants/ApplicantCard';`
 *
 * @example
 * // 스태프 뷰에서 자신의 지원 내역 확인
 * import { StaffApplicantCard, ConfirmationHistoryTimeline } from '@/components/applicant';
 */

// ============================================================================
// Applicant Card (스태프/지원자 뷰용)
// ============================================================================

export { StaffApplicantCard } from './StaffApplicantCard';

// 하위 호환성 유지용 alias (전환기간 후 제거 예정)
export { StaffApplicantCard as ApplicantCard } from './StaffApplicantCard';

// ============================================================================
// History Components
// ============================================================================

export { ConfirmationHistoryTimeline } from './ConfirmationHistoryTimeline';
