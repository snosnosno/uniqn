import { addDays, subDays, isSameDay, parseISO } from 'date-fns';
import { JobPosting } from '../../types/jobPosting/jobPosting';

/**
 * 날짜 범위 생성 함수
 *
 * @param fromDate - 시작 날짜
 * @param dayCount - 생성할 날짜 수
 * @returns 날짜 배열
 *
 * @example
 * // 어제부터 16일 생성 (어제 + 오늘 + 14일)
 * const dates = generateDateRange(subDays(new Date(), 1), 16);
 */
export const generateDateRange = (fromDate: Date, dayCount: number): Date[] => {
  return Array.from({ length: dayCount }, (_, i) => addDays(fromDate, i));
};

/**
 * 날짜별 공고 필터링 함수
 *
 * @param postings - 공고 목록
 * @param selectedDate - 선택된 날짜 (null일 때 전체 반환)
 * @returns 필터링된 공고 목록
 *
 * @example
 * // 특정 날짜 필터링
 * const filtered = filterPostingsByDate(postings, new Date('2025-11-01'));
 *
 * // 전체 공고 반환
 * const all = filterPostingsByDate(postings, null);
 */
export const filterPostingsByDate = (
  postings: JobPosting[],
  selectedDate: Date | null
): JobPosting[] => {
  // null일 때 전체 반환
  if (!selectedDate) {
    return postings;
  }

  // dateSpecificRequirements 배열에서 선택된 날짜와 일치하는 공고만 필터링
  return postings.filter(posting => {
    // dateSpecificRequirements가 없으면 제외
    if (!posting.dateSpecificRequirements || posting.dateSpecificRequirements.length === 0) {
      return false;
    }

    // 하나라도 일치하는 날짜가 있으면 포함
    return posting.dateSpecificRequirements.some(req => {
      try {
        // req.date가 Timestamp 객체일 수도 있으므로 처리
        let reqDate: Date;

        if (typeof req.date === 'string') {
          reqDate = parseISO(req.date);
        } else if (req.date && typeof req.date === 'object' && 'toDate' in req.date) {
          // Firestore Timestamp
          reqDate = (req.date as any).toDate();
        } else if (req.date instanceof Date) {
          reqDate = req.date;
        } else {
          return false;
        }

        return isSameDay(reqDate, selectedDate);
      } catch (error) {
        // 날짜 파싱 에러는 무시하고 제외
        return false;
      }
    });
  });
};

/**
 * 오늘인지 확인하는 함수
 *
 * @param date - 확인할 날짜
 * @returns 오늘이면 true
 */
export const isToday = (date: Date): boolean => {
  return isSameDay(date, new Date());
};

/**
 * 어제인지 확인하는 함수
 *
 * @param date - 확인할 날짜
 * @returns 어제면 true
 */
export const isYesterday = (date: Date): boolean => {
  const yesterday = subDays(new Date(), 1);
  return isSameDay(date, yesterday);
};
