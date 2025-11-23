/**
 * Contract: FixedJobCard Component
 *
 * 고정공고 정보를 카드 형식으로 표시하는 React 컴포넌트입니다.
 * 다크모드를 지원하며, React.memo로 메모이제이션되어 있습니다.
 *
 * @module contracts/FixedJobCard
 * @see ../research.md - R4, R5 참조
 */

import { FixedJobPosting } from '../../../app2/src/types/jobPosting/jobPosting';

/**
 * FixedJobCard 컴포넌트 Props
 *
 * @interface FixedJobCardProps
 */
export interface FixedJobCardProps {
  /**
   * 고정공고 데이터
   *
   * - FixedJobPosting 타입 (타입 가드 통과 필수)
   * - fixedData, fixedConfig 필드 포함
   *
   * @type {FixedJobPosting}
   */
  posting: FixedJobPosting;

  /**
   * 지원하기 버튼 클릭 핸들러
   *
   * - 지원 페이지로 이동 또는 지원 모달 표시
   * - useCallback으로 메모이제이션 필수
   *
   * @param {FixedJobPosting} posting - 클릭된 공고 데이터
   * @returns {void}
   */
  onApply: (posting: FixedJobPosting) => void;

  /**
   * 상세보기 핸들러
   *
   * - 상세 페이지(`/job-postings/:id`)로 이동
   * - 조회수 증가는 상세 페이지에서 처리
   * - useCallback으로 메모이제이션 필수
   *
   * @param {string} postingId - 공고 ID
   * @returns {void}
   */
  onViewDetail: (postingId: string) => void;
}

/**
 * FixedJobCard 컴포넌트 시그니처
 *
 * @param {FixedJobCardProps} props - 컴포넌트 Props
 * @returns {JSX.Element} 렌더링된 카드 컴포넌트
 *
 * @example
 * ```typescript
 * const JobBoardPage = () => {
 *   const { postings } = useFixedJobPostings();
 *   const navigate = useNavigate();
 *
 *   const handleApply = useCallback((posting: FixedJobPosting) => {
 *     navigate(`/apply/${posting.id}`);
 *   }, [navigate]);
 *
 *   const handleViewDetail = useCallback((postingId: string) => {
 *     navigate(`/job-postings/${postingId}`);
 *   }, [navigate]);
 *
 *   return (
 *     <>
 *       {postings.map(posting => (
 *         <FixedJobCard
 *           key={posting.id}
 *           posting={posting}
 *           onApply={handleApply}
 *           onViewDetail={handleViewDetail}
 *         />
 *       ))}
 *     </>
 *   );
 * };
 * ```
 */
export function FixedJobCard(props: FixedJobCardProps): JSX.Element;

/**
 * 표시 정보
 *
 * 1. 제목: posting.title
 * 2. 근무 일정:
 *    - "주 N일 근무" (posting.fixedData.workSchedule.daysPerWeek)
 *    - "HH:mm - HH:mm" (startTime - endTime)
 * 3. 모집 역할:
 *    - 배지 형태로 표시
 *    - "{역할명} {인원}명" (posting.fixedData.requiredRolesWithCount)
 * 4. 조회수:
 *    - "조회 N" (posting.fixedData.viewCount)
 * 5. 버튼:
 *    - "상세보기" (onViewDetail)
 *    - "지원하기" (onApply)
 */
export const CARD_DISPLAY = {
  title: 'posting.title',
  workSchedule: 'posting.fixedData.workSchedule',
  roles: 'posting.fixedData.requiredRolesWithCount',
  viewCount: 'posting.fixedData.viewCount',
} as const;

/**
 * 다크모드 스타일 (Tailwind CSS)
 *
 * - 카드 배경: bg-white dark:bg-gray-800
 * - 테두리: border-gray-200 dark:border-gray-700
 * - 제목: text-gray-900 dark:text-gray-100
 * - 본문: text-gray-600 dark:text-gray-300
 * - 보조 정보: text-gray-500 dark:text-gray-400
 * - 배지: bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-100
 * - 버튼 (primary): bg-blue-600 dark:bg-blue-700
 * - 버튼 (secondary): bg-gray-200 dark:bg-gray-700
 *
 * @see ../research.md#R5 - 다크모드 패턴
 */
export const DARK_MODE_CLASSES = {
  card: 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700',
  title: 'text-gray-900 dark:text-gray-100',
  text: 'text-gray-600 dark:text-gray-300',
  subtext: 'text-gray-500 dark:text-gray-400',
  badge: 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-100',
  buttonPrimary: 'bg-blue-600 dark:bg-blue-700 hover:bg-blue-700 dark:hover:bg-blue-600',
  buttonSecondary: 'bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600',
} as const;

/**
 * 구현 요구사항
 *
 * 1. 메모이제이션:
 *    - React.memo로 컴포넌트 래핑
 *    - 커스텀 비교 함수 불필요 (기본 얕은 비교)
 *
 * 2. Props 검증:
 *    - posting: FixedJobPosting 타입 (런타임 타입 가드 선택)
 *    - onApply, onViewDetail: 함수 타입
 *
 * 3. 다크모드:
 *    - 모든 UI 요소에 dark: 클래스 적용 필수
 *    - DARK_MODE_CLASSES 상수 참조
 *
 * 4. 접근성:
 *    - 버튼에 aria-label 또는 명확한 텍스트
 *    - 키보드 네비게이션 지원 (focus:ring)
 *
 * 5. 성능:
 *    - 부모 컴포넌트에서 onApply, onViewDetail을 useCallback으로 메모이제이션
 *    - 불필요한 리렌더링 방지
 *
 * @see ../research.md#R4 - React.memo + useCallback 패턴
 */
