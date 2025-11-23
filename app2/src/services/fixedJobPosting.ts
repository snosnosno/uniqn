/**
 * 고정공고 서비스
 *
 * Phase 4 - 조회수 증가 및 상세보기 관련 서비스
 */

import { doc, updateDoc, increment } from 'firebase/firestore';
import { db } from '../firebase';
import { logger } from '../utils/logger';
import type { ViewCountService, ViewCountError } from '../types/jobPosting';

/**
 * 고정공고 조회수 증가
 *
 * @param postingId - 공고 ID
 *
 * @description
 * Firestore increment() 원자적 연산으로 조회수를 1 증가시킵니다.
 * fire-and-forget 패턴: 에러 발생 시 logger.error로 기록만 하고 사용자 경험을 방해하지 않습니다.
 *
 * @example
 * ```typescript
 * // 카드 클릭 핸들러
 * const handleCardClick = async (posting: FixedJobPosting) => {
 *   // 조회수 증가 (즉시, 모달 렌더링 전)
 *   incrementViewCount(posting.id);
 *
 *   // 모달 열기 (조회수 증가 실패와 무관)
 *   openDetailModal(posting);
 * };
 * ```
 */
export const incrementViewCount = async (postingId: string): Promise<void> => {
  try {
    const docRef = doc(db, 'jobPostings', postingId);
    await updateDoc(docRef, {
      'fixedData.viewCount': increment(1)
    });

    logger.info('조회수 증가 성공', { postingId });
  } catch (error) {
    // fire-and-forget 패턴: 에러를 로그에만 기록하고 사용자 방해 금지
    const errorMessage = error instanceof Error ? error.message.toLowerCase() : '';
    const viewCountError: ViewCountError = {
      type: errorMessage.includes('permission')
        ? 'permission'
        : errorMessage.includes('network')
        ? 'network'
        : 'unknown',
      message: error instanceof Error ? error.message : 'Unknown error'
    };

    logger.error('조회수 증가 실패', error instanceof Error ? error : undefined, {
      postingId,
      errorCode: viewCountError.type,
      errorMessage: viewCountError.message
    });

    // 사용자 경험을 방해하지 않으므로 throw하지 않음
  }
};

/**
 * ViewCountService 인터페이스 구현
 *
 * @description
 * ViewCountService 타입을 준수하는 서비스 객체
 */
export const viewCountService: ViewCountService = {
  incrementViewCount
};
