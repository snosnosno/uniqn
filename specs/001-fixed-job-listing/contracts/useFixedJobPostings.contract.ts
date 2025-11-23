/**
 * Contract: useFixedJobPostings Hook
 *
 * 고정공고 목록을 Firestore에서 실시간으로 조회하고, 무한 스크롤을 지원하는 React Hook입니다.
 *
 * @module contracts/useFixedJobPostings
 * @see ../research.md - R1, R2, R3 참조
 */

import { FixedJobPosting } from '../../../app2/src/types/jobPosting/jobPosting';

/**
 * useFixedJobPostings Hook 반환 타입
 *
 * @interface UseFixedJobPostingsReturn
 */
export interface UseFixedJobPostingsReturn {
  /**
   * 고정공고 목록 (createdAt 내림차순 정렬)
   *
   * - 초기 20개: onSnapshot으로 실시간 구독
   * - 추가 페이지: getDocs로 일회성 조회
   *
   * @type {FixedJobPosting[]}
   */
  postings: FixedJobPosting[];

  /**
   * 로딩 상태
   *
   * - 초기 로딩: true (첫 번째 onSnapshot 응답 대기 중)
   * - 추가 페이지 로딩: false (loadMore 호출 시에만 일시적으로 true)
   *
   * @type {boolean}
   */
  loading: boolean;

  /**
   * 에러 정보
   *
   * - Firestore 연결 실패, 타임아웃 등
   * - null: 에러 없음
   *
   * @type {Error | null}
   */
  error: Error | null;

  /**
   * 추가 페이지 존재 여부
   *
   * - true: 더 많은 공고 존재 (loadMore 호출 가능)
   * - false: 모든 공고 로드 완료
   *
   * @type {boolean}
   */
  hasMore: boolean;

  /**
   * 다음 페이지 로드 함수
   *
   * - 무한 스크롤 트리거 시 호출
   * - getDocs로 다음 20개 공고 조회
   * - startAfter(lastDoc) 커서 사용
   *
   * @returns {void}
   */
  loadMore: () => void;
}

/**
 * useFixedJobPostings Hook 시그니처
 *
 * @returns {UseFixedJobPostingsReturn} Hook 반환값
 *
 * @example
 * ```typescript
 * const { postings, loading, error, hasMore, loadMore } = useFixedJobPostings();
 *
 * if (loading) return <div>로딩 중...</div>;
 * if (error) return <div>에러: {error.message}</div>;
 *
 * return (
 *   <>
 *     {postings.map(posting => (
 *       <FixedJobCard key={posting.id} posting={posting} />
 *     ))}
 *     {hasMore && <button onClick={loadMore}>더 보기</button>}
 *   </>
 * );
 * ```
 */
export function useFixedJobPostings(): UseFixedJobPostingsReturn;

/**
 * Firestore 쿼리 조건
 *
 * - postingType === 'fixed'
 * - status === 'open'
 * - orderBy('createdAt', 'desc')
 * - limit(20) - 초기 및 추가 페이지
 */
export const QUERY_CONDITIONS = {
  postingType: 'fixed' as const,
  status: 'open' as const,
  pageSize: 20,
} as const;

/**
 * 구현 요구사항
 *
 * 1. 초기 로딩:
 *    - onSnapshot으로 첫 20개 실시간 구독
 *    - loading: true → 첫 번째 응답 후 false
 *
 * 2. 추가 페이지 로딩:
 *    - getDocs로 일회성 조회
 *    - startAfter(lastDoc) 커서 사용
 *    - 중복 방지: isFetching 플래그
 *
 * 3. 상태 관리:
 *    - postings: 배열에 추가 (덮어쓰기 ❌)
 *    - lastDoc: 마지막 문서 커서 저장
 *    - hasMore: 조회 결과가 pageSize 미만이면 false
 *
 * 4. Cleanup:
 *    - useEffect cleanup에서 unsubscribe() 호출
 *
 * 5. 에러 처리:
 *    - Firestore 에러는 error 상태로 설정
 *    - logger.error로 로깅
 *    - 자동 재시도 ❌ (수동 재시도만)
 *
 * @see ../research.md#R2 - Firestore 페이지네이션 패턴
 * @see ../research.md#R3 - onSnapshot 성능 최적화
 */
