/**
 * Review 테스트 데이터 팩토리
 */

type Sentiment = 'positive' | 'neutral' | 'negative';

interface ReviewData {
  workLogId: string;
  revieweeId: string;
  revieweeName: string;
  reviewerType: 'employer' | 'staff';
  jobPostingId: string;
  jobPostingTitle: string;
  workDate: string;
  sentiment: Sentiment;
  tags: string[];
  comment: string;
}

let reviewCounter = 0;

/**
 * 리뷰 작성용 테스트 데이터 생성
 */
export function createReviewData(
  options: Partial<ReviewData> = {}
): ReviewData {
  reviewCounter++;
  return {
    workLogId: options.workLogId ?? `work-log-${reviewCounter}`,
    revieweeId: options.revieweeId ?? `reviewee-${reviewCounter}`,
    revieweeName: options.revieweeName ?? `테스트직원${reviewCounter}`,
    reviewerType: options.reviewerType ?? 'employer',
    jobPostingId: options.jobPostingId ?? `posting-${reviewCounter}`,
    jobPostingTitle: options.jobPostingTitle ?? `테스트공고${reviewCounter}`,
    workDate: options.workDate ?? '2026-03-01',
    sentiment: options.sentiment ?? 'positive',
    tags: options.tags ?? ['성실함', '시간 엄수'],
    comment: options.comment ?? `테스트 리뷰 코멘트 ${reviewCounter}`,
  };
}

/**
 * 리뷰 히스토리 시딩용 데이터 생성
 */
export function createReviewHistoryItem(
  options: Partial<{
    sentiment: Sentiment;
    reviewerName: string;
    reviewerType: 'employer' | 'staff';
    tags: string[];
    comment: string;
    createdAt: string;
  }> = {}
) {
  reviewCounter++;
  return {
    id: `review-${reviewCounter}`,
    sentiment: options.sentiment ?? 'positive',
    reviewerName: options.reviewerName ?? `리뷰어${reviewCounter}`,
    reviewerType: options.reviewerType ?? 'employer',
    tags: options.tags ?? ['성실함'],
    comment: options.comment ?? '',
    createdAt: options.createdAt ?? '2026-03-01T09:00:00Z',
  };
}

/**
 * 감정 이모지 매핑
 */
export const SENTIMENT_EMOJI: Record<Sentiment, string> = {
  positive: '😊',
  neutral: '😐',
  negative: '😔',
};

/**
 * 감정 라벨 매핑
 */
export const SENTIMENT_LABELS: Record<Sentiment, string> = {
  positive: '좋았어요',
  neutral: '보통이에요',
  negative: '별로였어요',
};
