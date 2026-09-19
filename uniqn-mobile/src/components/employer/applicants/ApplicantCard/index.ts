/**
 * UNIQN Mobile - ApplicantCard 모듈 (구인자 뷰)
 *
 * @version 1.1.0
 *
 * @description
 * 이 모듈은 **구인자가 지원자를 관리**하는 용도입니다.
 *
 * - ApplicantCard: 지원자 확정/거절/프로필 보기 액션 제공
 * - GroupedAssignmentSelector / AssignmentReadOnly: 일정 선택·조회
 * - StatusInfo: 상태 정보 표시
 *
 * @note
 * 스태프 뷰 전용 카드(applicant/StaffApplicantCard)는 소비처가 사라져 2026-08-13 에 제거됐다.
 * 확정/취소 이력 타임라인만 `@/components/applicant/ConfirmationHistoryTimeline` 로 살아남아
 * StatusInfo 에서 직접 import 한다.
 *
 * @example
 * // 구인자 뷰에서 지원자 관리
 * import { ApplicantCard } from '@/components/employer/ApplicantCard';
 */

export { ApplicantCard } from './ApplicantCard';
export type { ApplicantCardProps } from './types';
