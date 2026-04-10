/**
 * UNIQN Mobile - 리뷰/평가 관련 타입 정의
 *
 * @description 버블 (Bubble) 상호 평가 시스템 타입
 *   - 구인자 → 스태프 평가
 *   - 스태프 → 구인자 평가
 * @version 1.0.0
 */

// ============================================================================
// 기본 타입
// ============================================================================

/**
 * 평가자 유형
 */
export type ReviewerType = 'employer' | 'staff';

/** 평가자 유형 배열 (런타임 검증용) */
export const REVIEWER_TYPES: readonly ReviewerType[] = ['employer', 'staff'] as const;

/**
 * 감성 (긍정/보통/부정)
 */
export type ReviewSentiment = 'positive' | 'neutral' | 'negative';

// ============================================================================
// 태그 시스템
// ============================================================================

/**
 * 구인자가 스태프를 평가할 때 태그
 */
export type EmployerToStaffTag =
  | 'punctual' // 시간 약속 잘 지킴
  | 'skilled' // 업무 능력 우수
  | 'polite' // 예의 바름
  | 'responsive' // 소통 원활
  | 'proactive' // 적극적인 태도
  | 'reliable' // 믿을 수 있음
  | 'late' // 지각
  | 'unprepared' // 준비 부족
  | 'unresponsive' // 소통 어려움
  | 'careless'; // 부주의함

/**
 * 스태프가 구인자를 평가할 때 태그
 */
export type StaffToEmployerTag =
  | 'fair_pay' // 급여 정확/공정
  | 'good_environment' // 근무 환경 좋음
  | 'clear_instructions' // 업무 지시 명확
  | 'respectful' // 존중하는 태도
  | 'well_organized' // 잘 정리됨
  | 'supportive' // 배려심 있음
  | 'delayed_pay' // 급여 지연
  | 'poor_environment' // 근무 환경 열악
  | 'unclear_instructions' // 지시 불명확
  | 'disrespectful'; // 무례한 태도

/**
 * 통합 태그 타입
 */
export type ReviewTag = EmployerToStaffTag | StaffToEmployerTag;

/**
 * 태그 정보
 */
export interface ReviewTagInfo<T extends string = string> {
  key: T;
  label: string;
  sentiment: ReviewSentiment;
}

// ============================================================================
// 태그 목록 상수
// ============================================================================

/**
 * 구인자 → 스태프 태그 목록
 */
export const EMPLOYER_TO_STAFF_TAGS: ReviewTagInfo<EmployerToStaffTag>[] = [
  // 긍정
  { key: 'punctual', label: '시간 약속 잘 지킴', sentiment: 'positive' },
  { key: 'skilled', label: '업무 능력 우수', sentiment: 'positive' },
  { key: 'polite', label: '예의 바름', sentiment: 'positive' },
  { key: 'responsive', label: '소통 원활', sentiment: 'positive' },
  { key: 'proactive', label: '적극적인 태도', sentiment: 'positive' },
  { key: 'reliable', label: '믿을 수 있음', sentiment: 'positive' },
  // 부정
  { key: 'late', label: '지각', sentiment: 'negative' },
  { key: 'unprepared', label: '준비 부족', sentiment: 'negative' },
  { key: 'unresponsive', label: '소통 어려움', sentiment: 'negative' },
  { key: 'careless', label: '부주의함', sentiment: 'negative' },
];

/**
 * 스태프 → 구인자 태그 목록
 */
export const STAFF_TO_EMPLOYER_TAGS: ReviewTagInfo<StaffToEmployerTag>[] = [
  // 긍정
  { key: 'fair_pay', label: '급여 정확/공정', sentiment: 'positive' },
  { key: 'good_environment', label: '근무 환경 좋음', sentiment: 'positive' },
  { key: 'clear_instructions', label: '업무 지시 명확', sentiment: 'positive' },
  { key: 'respectful', label: '존중하는 태도', sentiment: 'positive' },
  { key: 'well_organized', label: '잘 정리됨', sentiment: 'positive' },
  { key: 'supportive', label: '배려심 있음', sentiment: 'positive' },
  // 부정
  { key: 'delayed_pay', label: '급여 지연', sentiment: 'negative' },
  { key: 'poor_environment', label: '근무 환경 열악', sentiment: 'negative' },
  { key: 'unclear_instructions', label: '지시 불명확', sentiment: 'negative' },
  { key: 'disrespectful', label: '무례한 태도', sentiment: 'negative' },
];

/**
 * reviewerType별 허용 태그 목록 반환
 */
export function getTagsForReviewerType(reviewerType: ReviewerType): ReviewTagInfo[] {
  return reviewerType === 'employer' ? EMPLOYER_TO_STAFF_TAGS : STAFF_TO_EMPLOYER_TAGS;
}

/**
 * reviewerType별 허용 태그 키 집합
 */
export function getAllowedTagKeys(reviewerType: ReviewerType): Set<string> {
  const tags = getTagsForReviewerType(reviewerType);
  return new Set(tags.map((t) => t.key));
}

const REVIEW_TAG_INFO_BY_KEY: Record<ReviewTag, ReviewTagInfo<ReviewTag>> = {
  ...Object.fromEntries(
    EMPLOYER_TO_STAFF_TAGS.map((tag) => [tag.key, tag as ReviewTagInfo<ReviewTag>])
  ),
  ...Object.fromEntries(
    STAFF_TO_EMPLOYER_TAGS.map((tag) => [tag.key, tag as ReviewTagInfo<ReviewTag>])
  ),
} as Record<ReviewTag, ReviewTagInfo<ReviewTag>>;

export interface SentimentTagConsistencyResult {
  consistent: boolean;
  invalidTags: string[];
  message?: string;
}

export function getReviewTagInfo(tagKey: string): ReviewTagInfo | undefined {
  return REVIEW_TAG_INFO_BY_KEY[tagKey as ReviewTag];
}

export function normalizeReviewText(value?: string | null): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

export function getReviewTextFallback(
  ...values: (string | null | undefined)[]
): string | undefined {
  for (const value of values) {
    const normalized = normalizeReviewText(value);
    if (normalized) {
      return normalized;
    }
  }

  return undefined;
}

export function getVisibleTagsForSentiment(
  reviewerType: ReviewerType,
  sentiment: ReviewSentiment
): ReviewTagInfo[] {
  const tags = getTagsForReviewerType(reviewerType);

  if (sentiment === 'neutral') {
    return tags;
  }

  return tags.filter((tag) => tag.sentiment === sentiment);
}

export function getIncompatibleTagsForSentiment(
  sentiment: ReviewSentiment,
  tags: readonly string[]
): string[] {
  if (sentiment === 'neutral') {
    return [];
  }

  return tags.filter((tag) => {
    const tagInfo = getReviewTagInfo(tag);
    return Boolean(tagInfo && tagInfo.sentiment !== sentiment);
  });
}

export function filterTagsForSentiment(
  sentiment: ReviewSentiment,
  tags: readonly ReviewTag[]
): ReviewTag[] {
  const incompatibleTags = new Set(getIncompatibleTagsForSentiment(sentiment, tags));
  return tags.filter((tag) => !incompatibleTags.has(tag));
}

export function getSentimentTagConsistency(
  sentiment: ReviewSentiment,
  tags: readonly string[]
): SentimentTagConsistencyResult {
  const invalidTags = getIncompatibleTagsForSentiment(sentiment, tags);

  if (invalidTags.length === 0) {
    return { consistent: true, invalidTags: [] };
  }

  const message =
    sentiment === 'positive'
      ? '긍정 리뷰에는 긍정 태그만 선택할 수 있어요.'
      : '부정 리뷰에는 부정 태그만 선택할 수 있어요.';

  return {
    consistent: false,
    invalidTags,
    message,
  };
}

// ============================================================================
// 버블 점수 상수
// ============================================================================

export const BUBBLE_SCORE = {
  INITIAL: 50.0,
  MIN: 0,
  MAX: 100,
  POSITIVE_CHANGE: 1.0,
  NEUTRAL_CHANGE: 0,
  NEGATIVE_CHANGE: -1.0,
  DECIMAL_PLACES: 1,
} as const;

/**
 * 평가 가능한 WorkLog 상태
 */
export const REVIEWABLE_STATUSES: ReadonlySet<string> = new Set(['checked_out', 'completed']);

/**
 * 평가 기한 (일)
 */
export const REVIEW_DEADLINE_DAYS = 7;

/**
 * 태그 제한
 */
export const REVIEW_TAG_LIMITS = {
  MIN: 1,
  MAX: 5,
} as const;

/**
 * 코멘트 제한
 */
export const REVIEW_COMMENT_MAX_LENGTH = 200;

// ============================================================================
// 버블 점수 타입
// ============================================================================

/**
 * 버블 점수 (users 컬렉션 비정규화 필드)
 */
export interface BubbleScore<T = Date> {
  score: number;
  totalReviewCount: number;
  positiveCount: number;
  neutralCount: number;
  negativeCount: number;
  lastUpdatedAt: T;
}

// ============================================================================
// 리뷰 문서 타입
// ============================================================================

/**
 * 리뷰 문서 (reviews 컬렉션)
 *
 * 문서 ID: `{workLogId}_{reviewerType}`
 */
export interface Review {
  workLogId: string;
  jobPostingId: string;
  jobPostingTitle: string;
  workDate: string;
  reviewerId: string;
  reviewerName: string;
  reviewerType: ReviewerType;
  revieweeId: string;
  revieweeName: string;
  sentiment: ReviewSentiment;
  tags: ReviewTag[];
  comment?: string;
  bubbleScoreChange: number;
  createdAt: Date;
}

/**
 * 리뷰 생성 입력
 */
export interface CreateReviewInput {
  workLogId: string;
  jobPostingId: string;
  jobPostingTitle: string;
  workDate: string;
  revieweeId: string;
  revieweeName: string;
  reviewerType: ReviewerType;
  sentiment: ReviewSentiment;
  tags: ReviewTag[];
  comment?: string;
}

/**
 * 블라인드 조회 결과
 */
export interface ReviewBlindResult {
  myReview: Review | null;
  opponentReview: Review | null;
  canViewOpponent: boolean;
}

// ============================================================================
// 감성 라벨 + 색상
// ============================================================================

export const SENTIMENT_LABELS: Record<ReviewSentiment, string> = {
  positive: '좋았어요',
  neutral: '보통이에요',
  negative: '별로였어요',
};

export const SENTIMENT_EMOJI: Record<ReviewSentiment, string> = {
  positive: '😊',
  neutral: '😐',
  negative: '😞',
};

/**
 * 감성별 NativeWind 색상 클래스
 */
export const SENTIMENT_COLORS: Record<
  ReviewSentiment,
  { bg: string; border: string; text: string; darkBg: string }
> = {
  positive: {
    bg: 'bg-green-50',
    border: 'border-green-500',
    text: 'text-green-700',
    darkBg: 'dark:bg-green-900/30',
  },
  neutral: {
    bg: 'bg-gray-50',
    border: 'border-gray-400',
    text: 'text-gray-600',
    darkBg: 'dark:bg-gray-800/50',
  },
  negative: {
    bg: 'bg-red-50',
    border: 'border-red-500',
    text: 'text-red-700',
    darkBg: 'dark:bg-red-900/30',
  },
};

// ============================================================================
// 버블 점수 색상
// ============================================================================

export interface BubbleScoreColorRange {
  min: number;
  max: number;
  bg: string;
  darkBg: string;
  text: string;
  hex: string;
  label: string;
}

export const BUBBLE_SCORE_COLORS: BubbleScoreColorRange[] = [
  {
    min: 0,
    max: 30,
    bg: 'bg-red-500',
    darkBg: 'dark:bg-red-400',
    text: 'text-white',
    hex: '#EF4444',
    label: '주의',
  },
  {
    min: 30,
    max: 45,
    bg: 'bg-orange-500',
    darkBg: 'dark:bg-orange-400',
    text: 'text-white',
    hex: '#F97316',
    label: '보통 이하',
  },
  {
    min: 45,
    max: 55,
    bg: 'bg-yellow-500',
    darkBg: 'dark:bg-yellow-400',
    text: 'text-gray-900',
    hex: '#EAB308',
    label: '보통',
  },
  {
    min: 55,
    max: 70,
    bg: 'bg-green-500',
    darkBg: 'dark:bg-green-400',
    text: 'text-white',
    hex: '#22C55E',
    label: '좋음',
  },
  {
    min: 70,
    max: 100,
    bg: 'bg-primary-500',
    darkBg: 'dark:bg-primary-400',
    text: 'text-white',
    hex: '#6366F1',
    label: '우수',
  },
];

/**
 * 점수 → 색상 범위 반환
 *
 * 경계값 규칙: min 이상, max 미만 (마지막 범위만 max 이하)
 * 예: 30 → '보통 이하', 70 → '우수', 100 → '우수'
 */
export function getBubbleScoreColor(score: number): BubbleScoreColorRange {
  const lastIdx = BUBBLE_SCORE_COLORS.length - 1;
  return (
    BUBBLE_SCORE_COLORS.find(
      (range, idx) =>
        score >= range.min && (idx === lastIdx ? score <= range.max : score < range.max)
    ) ?? BUBBLE_SCORE_COLORS[lastIdx]
  );
}

// ============================================================================
// 점수 계산 유틸
// ============================================================================

/**
 * 감성에 따른 점수 변화량 반환
 */
export function getSentimentScoreChange(sentiment: ReviewSentiment): number {
  switch (sentiment) {
    case 'positive':
      return BUBBLE_SCORE.POSITIVE_CHANGE;
    case 'neutral':
      return BUBBLE_SCORE.NEUTRAL_CHANGE;
    case 'negative':
      return BUBBLE_SCORE.NEGATIVE_CHANGE;
  }
}

/**
 * 새 버블 점수 계산
 */
export function calculateNewBubbleScore(
  current: BubbleScore | undefined,
  sentiment: ReviewSentiment
): Omit<BubbleScore, 'lastUpdatedAt'> {
  const score = current?.score ?? BUBBLE_SCORE.INITIAL;
  const change = getSentimentScoreChange(sentiment);
  const factor = 10 ** BUBBLE_SCORE.DECIMAL_PLACES;
  const newScore =
    Math.round(Math.max(BUBBLE_SCORE.MIN, Math.min(BUBBLE_SCORE.MAX, score + change)) * factor) /
    factor;

  return {
    score: newScore,
    totalReviewCount: (current?.totalReviewCount ?? 0) + 1,
    positiveCount: (current?.positiveCount ?? 0) + (sentiment === 'positive' ? 1 : 0),
    neutralCount: (current?.neutralCount ?? 0) + (sentiment === 'neutral' ? 1 : 0),
    negativeCount: (current?.negativeCount ?? 0) + (sentiment === 'negative' ? 1 : 0),
  };
}
