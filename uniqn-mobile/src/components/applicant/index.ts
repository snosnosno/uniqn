/**
 * UNIQN Mobile - 지원자 관련 컴포넌트 (스태프/지원자 뷰)
 *
 * @version 1.2.0
 *
 * @description
 * 이 모듈은 **지원자(스태프)가 자신의 지원 내역을 확인**하는 용도입니다.
 *
 * - ApplicantCard: 지원 상태 및 확정/취소 이력 표시 (스태프 뷰)
 * - ConfirmationHistoryTimeline: 확정/취소 이력 타임라인
 *
 * @note
 * 구인자가 지원자를 관리(확정/거절)하려면 employer/ApplicantCard를 사용하세요:
 * `import { ApplicantCard } from '@/components/employer/ApplicantCard';`
 *
 * @example
 * // 스태프 뷰에서 자신의 지원 내역 확인
 * import { ApplicantCard, ConfirmationHistoryTimeline } from '@/components/applicant';
 */

// ============================================================================
// Applicant Card (스태프/지원자 뷰용)
// ============================================================================

export { ApplicantCard } from './ApplicantCard';

// ============================================================================
// History Components
// ============================================================================

export { ConfirmationHistoryTimeline } from './ConfirmationHistoryTimeline';
