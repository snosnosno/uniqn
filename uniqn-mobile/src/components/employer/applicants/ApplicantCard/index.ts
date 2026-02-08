/**
 * UNIQN Mobile - ApplicantCard 모듈 (구인자 뷰)
 *
 * @version 1.1.0
 *
 * @description
 * 이 모듈은 **구인자가 지원자를 관리**하는 용도입니다.
 *
 * - ApplicantCard: 지원자 확정/거절/프로필 보기 액션 제공
 * - SimpleAssignmentSelector: 일정 선택 기능
 * - StatusInfo: 상태 정보 표시
 *
 * @note
 * 스태프가 자신의 지원 내역을 확인하려면 applicant/StaffApplicantCard를 사용하세요:
 * `import { StaffApplicantCard } from '@/components/applicant';`
 *
 * @example
 * // 구인자 뷰에서 지원자 관리
 * import { ApplicantCard } from '@/components/employer/ApplicantCard';
 */

export { ApplicantCard, default } from './ApplicantCard';
export type { ApplicantCardProps } from './types';
