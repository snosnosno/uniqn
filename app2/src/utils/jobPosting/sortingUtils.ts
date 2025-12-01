import { JobPosting } from '../../types/jobPosting';
import { logger } from '../logger';
import { toISODateString } from '../dateUtils';

/**
 * 구인공고를 오늘 날짜 기준 우선순위로 정렬
 *
 * 우선순위:
 * 1. 오늘 시작하는 공고
 * 2. 현재 진행 중인 공고 (오늘이 기간에 포함)
 * 3. 내일 시작하는 공고
 * 4. 그 외 미래 공고
 * 5. 지난 공고
 */
export const sortJobPostingsByPriority = (jobPostings: JobPosting[]): JobPosting[] => {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  logger.debug('📊 정렬 시작 - 오늘 날짜:', {
    component: 'sortingUtils',
    data: {
      today: toISODateString(today),
      totalPosts: jobPostings.length,
    },
  });

  /** 날짜 필드 입력 타입 */
  type DateFieldInput =
    | string
    | number
    | Date
    | { toDate: () => Date }
    | { seconds: number }
    | null
    | undefined;

  /** toDate 메서드를 가진 객체 타입 가드 */
  const hasToDate = (obj: unknown): obj is { toDate: () => Date } => {
    return (
      obj !== null &&
      typeof obj === 'object' &&
      'toDate' in obj &&
      typeof (obj as { toDate?: unknown }).toDate === 'function'
    );
  };

  /** seconds 속성을 가진 객체 타입 가드 */
  const hasSeconds = (obj: unknown): obj is { seconds: number } => {
    return (
      obj !== null &&
      typeof obj === 'object' &&
      'seconds' in obj &&
      typeof (obj as { seconds?: unknown }).seconds === 'number'
    );
  };

  // 원본 배열을 복사하여 정렬 (원본 수정 방지)
  const sorted = [...jobPostings].sort((a, b) => {
    try {
      // 날짜 변환 - Firestore Timestamp 또는 Date 객체 처리
      const getDateFromField = (dateField: DateFieldInput): Date => {
        if (!dateField) return new Date('9999-12-31'); // null/undefined는 최하위 우선순위

        // Firestore Timestamp 객체인 경우
        if (hasToDate(dateField)) {
          return dateField.toDate();
        }

        // seconds 필드가 있는 객체
        if (hasSeconds(dateField)) {
          return new Date(dateField.seconds * 1000);
        }

        // 이미 Date 객체인 경우
        if (dateField instanceof Date) {
          return dateField;
        }

        // 문자열이나 숫자인 경우
        return new Date(dateField);
      };

      // dateSpecificRequirements에서 시작일과 종료일 추출
      const getStartEndDates = (posting: JobPosting): { start: Date; end: Date } => {
        if (!posting.dateSpecificRequirements || posting.dateSpecificRequirements.length === 0) {
          return { start: new Date('9999-12-31'), end: new Date('9999-12-31') };
        }

        // 날짜를 정렬하여 첫 날과 마지막 날 찾기
        const dates = posting.dateSpecificRequirements
          .map((req) => getDateFromField(req.date))
          .sort((a, b) => a.getTime() - b.getTime());

        return {
          start: dates[0] || new Date('9999-12-31'),
          end: dates[dates.length - 1] || dates[0] || new Date('9999-12-31'),
        };
      };

      const { start: aStart, end: aEnd } = getStartEndDates(a);
      const { start: bStart, end: bEnd } = getStartEndDates(b);

      // 우선순위 계산 함수
      const getPriority = (start: Date, end: Date): number => {
        // 유효하지 않은 날짜는 최하위 우선순위
        if (isNaN(start.getTime())) return 999;

        // 날짜만 비교 (시간 제거)
        const startDateOnly = new Date(start.getFullYear(), start.getMonth(), start.getDate());
        const endDateOnly = new Date(end.getFullYear(), end.getMonth(), end.getDate());

        // 1순위: 오늘 시작
        if (startDateOnly.getTime() === today.getTime()) {
          return 1;
        }

        // 2순위: 현재 진행 중 (오늘이 기간에 포함)
        if (startDateOnly <= today && endDateOnly >= today) {
          return 2;
        }

        // 3순위: 내일 시작
        if (startDateOnly.getTime() === tomorrow.getTime()) {
          return 3;
        }

        // 4순위: 모레 이후 미래 공고
        if (startDateOnly > tomorrow) {
          // 가까운 미래일수록 우선순위 높음
          const daysFromNow = Math.floor(
            (startDateOnly.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
          );
          return 4 + Math.min(daysFromNow * 0.01, 1); // 4.00 ~ 5.00 사이 값
        }

        // 5순위: 지난 공고
        return 5;
      };

      const priorityA = getPriority(aStart, aEnd);
      const priorityB = getPriority(bStart, bEnd);

      // 우선순위가 다르면 우선순위로 정렬
      if (Math.floor(priorityA) !== Math.floor(priorityB)) {
        return priorityA - priorityB;
      }

      // 같은 우선순위 그룹 내에서의 정렬
      // 1,2,3,4순위는 시작일 오름차순 (빠른 날짜 우선)
      // 5순위(지난 공고)는 시작일 내림차순 (최근 우선)
      if (Math.floor(priorityA) <= 4) {
        return aStart.getTime() - bStart.getTime();
      } else {
        return bStart.getTime() - aStart.getTime();
      }
    } catch (error) {
      logger.error(
        '정렬 중 오류 발생:',
        error instanceof Error ? error : new Error(String(error)),
        {
          component: 'sortingUtils',
          data: { postA: a.id, postB: b.id },
        }
      );
      return 0; // 오류 시 순서 유지
    }
  });

  // 상위 5개 공고의 우선순위 로깅 (디버깅용)
  if (sorted.length > 0) {
    const topPosts = sorted.slice(0, 5).map((post) => {
      const dates =
        post.dateSpecificRequirements
          ?.map((req) => {
            const dateField = req.date;
            // Timestamp 타입 체크
            if (
              dateField &&
              typeof dateField === 'object' &&
              'toDate' in dateField &&
              typeof dateField.toDate === 'function'
            ) {
              return dateField.toDate();
            }
            // seconds 필드가 있는 객체
            if (dateField && typeof dateField === 'object' && 'seconds' in dateField) {
              return new Date((dateField as { seconds: number }).seconds * 1000);
            }
            // 문자열 또는 기타
            return new Date(dateField as string);
          })
          .sort((a, b) => a.getTime() - b.getTime()) || [];

      const start = dates[0] || new Date('9999-12-31');
      const end = dates[dates.length - 1] || start;

      return {
        id: post.id,
        title: post.title,
        startDate: toISODateString(start),
        priority: getPriorityLabel(start, end),
      };
    });

    logger.debug('📊 정렬 결과 (상위 5개):', {
      component: 'sortingUtils',
      data: topPosts,
    });
  }

  return sorted;
};

/** 우선순위 라벨용 날짜 입력 타입 */
type PriorityDateInput = Date | { toDate: () => Date } | string | number | null | undefined;

/**
 * 우선순위 라벨 반환 (디버깅/UI용)
 */
const getPriorityLabel = (startDate: PriorityDateInput, endDate?: PriorityDateInput): string => {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  /** toDate 메서드 체크 */
  const hasToDateMethod = (obj: unknown): obj is { toDate: () => Date } => {
    return (
      obj !== null &&
      typeof obj === 'object' &&
      'toDate' in obj &&
      typeof (obj as { toDate?: unknown }).toDate === 'function'
    );
  };

  const start =
    startDate instanceof Date
      ? startDate
      : hasToDateMethod(startDate)
        ? startDate.toDate()
        : startDate
          ? new Date(startDate as string | number)
          : new Date('9999-12-31');
  const end =
    endDate instanceof Date
      ? endDate
      : hasToDateMethod(endDate)
        ? endDate.toDate()
        : endDate
          ? new Date(endDate as string | number)
          : start;

  if (isNaN(start.getTime())) return '날짜 오류';

  const startDateOnly = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const endDateOnly = new Date(end.getFullYear(), end.getMonth(), end.getDate());

  if (startDateOnly.getTime() === today.getTime()) {
    return '🔥 오늘 시작';
  }

  if (startDateOnly <= today && endDateOnly >= today) {
    return '✅ 진행 중';
  }

  if (startDateOnly.getTime() === tomorrow.getTime()) {
    return '📅 내일 시작';
  }

  if (startDateOnly > tomorrow) {
    const daysFromNow = Math.floor(
      (startDateOnly.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
    );
    return `📆 ${daysFromNow}일 후`;
  }

  return '⏰ 종료됨';
};

/**
 * 공고에 우선순위 라벨 추가 (UI 표시용)
 */
export const addPriorityLabels = (
  jobPostings: JobPosting[]
): (JobPosting & { priorityLabel?: string })[] => {
  return jobPostings.map((post) => {
    const dates =
      post.dateSpecificRequirements
        ?.map((req) => {
          const dateField = req.date;
          // Timestamp 타입 체크
          if (
            dateField &&
            typeof dateField === 'object' &&
            'toDate' in dateField &&
            typeof dateField.toDate === 'function'
          ) {
            return dateField.toDate();
          }
          // seconds 필드가 있는 객체
          if (dateField && typeof dateField === 'object' && 'seconds' in dateField) {
            return new Date((dateField as { seconds: number }).seconds * 1000);
          }
          // 문자열 또는 기타
          return new Date(dateField as string);
        })
        .sort((a, b) => a.getTime() - b.getTime()) || [];

    const start = dates[0];
    const end = dates[dates.length - 1] || start;

    return {
      ...post,
      priorityLabel: getPriorityLabel(start, end),
    };
  });
};
