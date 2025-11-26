/**
 * applicantFormat.ts - 지원자 데이터 포맷팅 유틸리티
 *
 * 주요 기능:
 * - 날짜 범위 포맷팅
 * - 날짜 범위 생성
 * - 연속 날짜 검증
 * - 역할 이름 매핑
 *
 * @module utils/applicants/applicantFormat
 */

import { formatDateDisplay } from './applicantTransform';

/**
 * 역할 이름을 소문자로 통일 변환하는 맵
 */
export const jobRoleMap: { [key: string]: string } = {
  dealer: 'dealer',
  floor: 'floor',
  serving: 'server',
  tournament_director: 'tournament_director',
  chip_master: 'chip_master',
  registration: 'registration',
  security: 'security',
  other: 'other',
};

/**
 * 날짜 범위 생성 함수
 */
export const generateDateRange = (startDate: string, endDate: string): string[] => {
  const dates: string[] = [];
  const start = new Date(startDate);
  const end = new Date(endDate);

  for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    dates.push(`${year}-${month}-${day}`);
  }

  return dates;
};

/**
 * 날짜 배열을 사용자 친화적인 범위 문자열로 변환
 */
export const formatDateRange = (dates: string[]): string => {
  if (dates.length === 0) return '날짜 미정';

  const validDates = dates.filter((date): date is string => !!date);
  if (validDates.length === 0) return '날짜 미정';
  if (validDates.length === 1) {
    const firstDate = validDates[0];
    return firstDate ? formatDateDisplay(firstDate) : '날짜 미정';
  }

  const sortedDates = validDates.sort();

  // 연속된 날짜인지 확인
  if (isConsecutiveDates(sortedDates)) {
    const firstDate = sortedDates[0];
    const lastDate = sortedDates[sortedDates.length - 1];
    if (firstDate && lastDate) {
      const first = formatDateDisplay(firstDate);
      const last = formatDateDisplay(lastDate);
      return `${first} ~ ${last}`;
    }
  }

  // 개별 날짜 표시
  return validDates.map((d) => formatDateDisplay(d)).join(', ');
};

/**
 * 날짜 배열이 연속된 날짜인지 확인
 */
export const isConsecutiveDates = (sortedDates: string[]): boolean => {
  if (sortedDates.length <= 1) return true;

  for (let i = 1; i < sortedDates.length; i++) {
    const prevDateStr = sortedDates[i - 1];
    const currentDateStr = sortedDates[i];

    if (!prevDateStr || !currentDateStr) continue;

    const prevDate = new Date(prevDateStr);
    const currentDate = new Date(currentDateStr);

    if (isNaN(prevDate.getTime()) || isNaN(currentDate.getTime())) {
      continue;
    }

    const diffDays = Math.round((currentDate.getTime() - prevDate.getTime()) / (1000 * 3600 * 24));
    if (diffDays !== 1) {
      return false;
    }
  }

  return true;
};

/**
 * 날짜 배열에서 연속된 날짜 구간들을 찾아내는 함수
 */
export const findConsecutiveDateGroups = (sortedDates: string[]): string[][] => {
  if (sortedDates.length === 0) return [];
  if (sortedDates.length === 1) return [sortedDates];

  const groups: string[][] = [];
  const firstDate = sortedDates[0];
  if (!firstDate) return [];

  let currentGroup: string[] = [firstDate];

  for (let i = 1; i < sortedDates.length; i++) {
    const prevDateStr = sortedDates[i - 1];
    const currentDateStr = sortedDates[i];

    if (!prevDateStr || !currentDateStr) continue;

    const prevDate = new Date(prevDateStr);
    const currentDate = new Date(currentDateStr);

    const diffDays = Math.round((currentDate.getTime() - prevDate.getTime()) / (1000 * 3600 * 24));

    if (diffDays === 1) {
      currentGroup.push(currentDateStr);
    } else {
      groups.push([...currentGroup]);
      currentGroup = [currentDateStr];
    }
  }

  groups.push([...currentGroup]);

  return groups;
};
