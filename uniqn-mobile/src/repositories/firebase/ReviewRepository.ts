/**
 * UNIQN Mobile - Firebase Review Repository
 *
 * @description Firebase Firestore 기반 Review Repository 구현
 * @version 1.0.0
 *
 * 책임:
 * 1. 리뷰 CRUD (결정적 문서 ID 활용)
 * 2. 트랜잭션 캡슐화 (중복 방지 + 버블 점수 원자적 업데이트)
 * 3. 블라인드 조회 로직
 *
 * 문서 ID 설계: `{workLogId}_{reviewerType}`
 * - 트랜잭션 내 getDoc으로 중복 확인 (Race Condition 완전 해결)
 * - workLogId당 최대 2개 리뷰 (employer + staff)
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit as firestoreLimit,
  runTransaction,
  serverTimestamp,
} from 'firebase/firestore';
import { getFirebaseDb } from '@/lib/firebase';
import { logger } from '@/utils/logger';
import { isAppError } from '@/errors';
import { handleServiceError } from '@/errors/serviceErrorHandler';
import {
  AlreadyReviewedError,
  ReviewNotFoundError,
  CannotReviewSelfError,
  ReviewPeriodExpiredError,
  UnauthorizedReviewError,
} from '@/errors';
import { COLLECTIONS } from '@/constants';
import {
  calculateNewBubbleScore,
  getSentimentScoreChange,
  REVIEW_DEADLINE_DAYS,
} from '@/types/review';
import { ReviewValidator } from '@/domains/review';
import type { WorkLogForReview } from '@/domains/review';
import type {
  IReviewRepository,
  CreateReviewContext,
} from '../interfaces/IReviewRepository';
import type { DocumentData, DocumentSnapshot } from 'firebase/firestore';
import type {
  Review,
  CreateReviewInput,
  ReviewerType,
  ReviewBlindResult,
} from '@/types/review';

// ============================================================================
// Helpers
// ============================================================================

/** Firestore DocumentSnapshot → Review 변환 */
function toReview(docSnap: DocumentSnapshot<DocumentData>): Review {
  const data = docSnap.data()!;
  return {
    workLogId: data.workLogId as string,
    jobPostingId: data.jobPostingId as string,
    jobPostingTitle: data.jobPostingTitle as string,
    workDate: data.workDate as string,
    reviewerId: data.reviewerId as string,
    reviewerName: data.reviewerName as string,
    reviewerType: data.reviewerType as ReviewerType,
    revieweeId: data.revieweeId as string,
    revieweeName: data.revieweeName as string,
    sentiment: data.sentiment as Review['sentiment'],
    tags: data.tags as string[],
    comment: data.comment as string | undefined,
    bubbleScoreChange: data.bubbleScoreChange as number,
    createdAt: data.createdAt,
  };
}

// ============================================================================
// Repository Implementation
// ============================================================================

/**
 * Firebase Review Repository
 */
export class FirebaseReviewRepository implements IReviewRepository {
  private readonly validator = new ReviewValidator();

  // ==========================================================================
  // 조회 (Read)
  // ==========================================================================

  async getByWorkLogAndType(
    workLogId: string,
    reviewerType: ReviewerType
  ): Promise<Review | null> {
    try {
      logger.info('리뷰 조회', { workLogId, reviewerType });

      const reviewId = `${workLogId}_${reviewerType}`;
      const docRef = doc(getFirebaseDb(), COLLECTIONS.REVIEWS, reviewId);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        return null;
      }

      return toReview(docSnap);
    } catch (error) {
      throw handleServiceError(error, {
        operation: '리뷰 조회',
        component: 'ReviewRepository',
        context: { workLogId, reviewerType },
      });
    }
  }

  async getReviewsWithBlindCheck(
    workLogId: string,
    myReviewerType: ReviewerType,
    currentUserId: string
  ): Promise<ReviewBlindResult> {
    try {
      logger.info('블라인드 리뷰 조회', { workLogId, myReviewerType });

      const opponentType: ReviewerType =
        myReviewerType === 'employer' ? 'staff' : 'employer';

      const db = getFirebaseDb();

      // 결정적 ID로 getDoc 2회 (쿼리 X, 인덱스 불필요)
      const [mySnap, opponentSnap] = await Promise.all([
        getDoc(doc(db, COLLECTIONS.REVIEWS, `${workLogId}_${myReviewerType}`)),
        getDoc(doc(db, COLLECTIONS.REVIEWS, `${workLogId}_${opponentType}`)),
      ]);

      const myReviewRaw = mySnap.exists() ? toReview(mySnap) : null;
      const opponentReviewRaw = opponentSnap.exists() ? toReview(opponentSnap) : null;

      // 현재 사용자의 리뷰인지 검증 (권한 체크)
      const isMyReview = myReviewRaw?.reviewerId === currentUserId;
      const myReview = isMyReview ? myReviewRaw : null;

      // 블라인드: 내 리뷰 작성 후에만 상대 리뷰 열람 가능
      const canViewOpponent = isMyReview;

      return {
        myReview,
        opponentReview: canViewOpponent ? opponentReviewRaw : null,
        canViewOpponent,
      };
    } catch (error) {
      throw handleServiceError(error, {
        operation: '블라인드 리뷰 조회',
        component: 'ReviewRepository',
        context: { workLogId, myReviewerType },
      });
    }
  }

  async getByRevieweeId(revieweeId: string, queryLimit = 20): Promise<Review[]> {
    try {
      logger.info('받은 리뷰 목록 조회', { revieweeId, limit: queryLimit });

      const q = query(
        collection(getFirebaseDb(), COLLECTIONS.REVIEWS),
        where('revieweeId', '==', revieweeId),
        orderBy('createdAt', 'desc'),
        firestoreLimit(queryLimit)
      );

      const snapshot = await getDocs(q);
      return snapshot.docs.map(toReview);
    } catch (error) {
      throw handleServiceError(error, {
        operation: '받은 리뷰 목록 조회',
        component: 'ReviewRepository',
        context: { revieweeId },
      });
    }
  }

  async getByReviewerId(reviewerId: string, queryLimit = 20): Promise<Review[]> {
    try {
      logger.info('작성한 리뷰 목록 조회', { reviewerId, limit: queryLimit });

      const q = query(
        collection(getFirebaseDb(), COLLECTIONS.REVIEWS),
        where('reviewerId', '==', reviewerId),
        orderBy('createdAt', 'desc'),
        firestoreLimit(queryLimit)
      );

      const snapshot = await getDocs(q);
      return snapshot.docs.map(toReview);
    } catch (error) {
      throw handleServiceError(error, {
        operation: '작성한 리뷰 목록 조회',
        component: 'ReviewRepository',
        context: { reviewerId },
      });
    }
  }

  // ==========================================================================
  // 트랜잭션 (Write)
  // ==========================================================================

  async createWithTransaction(
    input: CreateReviewInput,
    context: CreateReviewContext
  ): Promise<string> {
    try {
      // 본인 평가 방지 (트랜잭션 전 빠른 체크)
      if (input.revieweeId === context.reviewerId) {
        throw new CannotReviewSelfError({
          userMessage: '본인을 평가할 수 없습니다',
        });
      }

      logger.info('리뷰 생성 트랜잭션 시작', {
        workLogId: input.workLogId,
        reviewerType: input.reviewerType,
        sentiment: input.sentiment,
      });

      const db = getFirebaseDb();
      const reviewId = `${input.workLogId}_${input.reviewerType}`;
      const reviewRef = doc(db, COLLECTIONS.REVIEWS, reviewId);

      await runTransaction(db, async (transaction) => {
        // 1. 읽기 (모두 먼저 — Firestore 트랜잭션 규칙)
        const existingReview = await transaction.get(reviewRef);
        const workLogRef = doc(db, COLLECTIONS.WORK_LOGS, input.workLogId);
        const workLogSnap = await transaction.get(workLogRef);
        const userRef = doc(db, COLLECTIONS.USERS, input.revieweeId);
        const userSnap = await transaction.get(userRef);

        // 2. 검증: 중복 확인
        if (existingReview.exists()) {
          throw new AlreadyReviewedError({
            userMessage: '이미 평가를 완료하셨습니다',
            workLogId: input.workLogId,
          });
        }

        // 3. 검증: WorkLog 존재 + 상태
        if (!workLogSnap.exists()) {
          throw new ReviewNotFoundError({
            userMessage: '평가 대상을 찾을 수 없습니다',
            workLogId: input.workLogId,
          });
        }

        const rawWorkLog = workLogSnap.data();
        if (!rawWorkLog?.staffId || !rawWorkLog?.ownerId || !rawWorkLog?.status) {
          throw new ReviewNotFoundError({
            userMessage: '근무 기록 데이터가 불완전합니다',
            workLogId: input.workLogId,
          });
        }
        const workLogData: WorkLogForReview = {
          id: input.workLogId,
          staffId: rawWorkLog.staffId as string,
          ownerId: rawWorkLog.ownerId as string,
          jobPostingId: rawWorkLog.jobPostingId as string,
          status: rawWorkLog.status as string,
          date: rawWorkLog.date as string,
          completedAt: rawWorkLog.completedAt,
        };

        // 4. 검증: 도메인 규칙 (상태, 권한, 기한)
        const eligibility = this.validator.checkEligibility(
          workLogData,
          context.reviewerId,
          input.reviewerType
        );

        if (!eligibility.eligible) {
          switch (eligibility.code) {
            case 'REVIEW_PERIOD_EXPIRED':
              throw new ReviewPeriodExpiredError({
                userMessage: eligibility.reason,
                workLogId: input.workLogId,
                deadlineDays: REVIEW_DEADLINE_DAYS,
              });
            case 'CANNOT_REVIEW_SELF':
              throw new CannotReviewSelfError({
                userMessage: eligibility.reason,
              });
            case 'UNAUTHORIZED_REVIEWER':
              throw new UnauthorizedReviewError({
                userMessage: eligibility.reason,
                workLogId: input.workLogId,
                reviewerType: input.reviewerType,
              });
            default:
              throw new ReviewNotFoundError({
                userMessage: eligibility.reason,
                workLogId: input.workLogId,
              });
          }
        }

        // 5. 쓰기: 리뷰 문서 생성
        const bubbleScoreChange = getSentimentScoreChange(input.sentiment);

        const reviewData: Record<string, unknown> = {
          workLogId: input.workLogId,
          jobPostingId: input.jobPostingId,
          jobPostingTitle: input.jobPostingTitle,
          workDate: input.workDate,
          reviewerId: context.reviewerId,
          reviewerName: context.reviewerName,
          reviewerType: input.reviewerType,
          revieweeId: input.revieweeId,
          revieweeName: input.revieweeName,
          sentiment: input.sentiment,
          tags: input.tags,
          bubbleScoreChange,
          createdAt: serverTimestamp(),
        };

        if (input.comment) {
          reviewData.comment = input.comment;
        }

        transaction.set(reviewRef, reviewData);

        // 6. 쓰기: 피평가자 bubbleScore 업데이트
        if (!userSnap.exists()) {
          logger.warn('피평가자 user 문서 없음 — bubbleScore 업데이트 건너뜀', {
            component: 'ReviewRepository',
            revieweeId: input.revieweeId,
            workLogId: input.workLogId,
          });
        }
        if (userSnap.exists()) {
          const userData = userSnap.data();
          const newScore = calculateNewBubbleScore(
            userData?.bubbleScore,
            input.sentiment
          );

          transaction.update(userRef, {
            bubbleScore: {
              ...newScore,
              lastUpdatedAt: serverTimestamp(),
            },
          });
        }
      });

      logger.info('리뷰 생성 트랜잭션 완료', {
        reviewId,
        reviewerType: input.reviewerType,
      });

      return reviewId;
    } catch (error) {
      // 비즈니스 에러는 그대로 throw
      if (isAppError(error)) {
        throw error;
      }

      throw handleServiceError(error, {
        operation: '리뷰 생성',
        component: 'ReviewRepository',
        context: {
          workLogId: input.workLogId,
          reviewerType: input.reviewerType,
          revieweeId: input.revieweeId,
        },
      });
    }
  }
}
