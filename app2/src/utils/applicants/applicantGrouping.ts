/**
 * applicantGrouping.ts - 지원자 선택사항 그룹화 유틸리티
 *
 * 주요 기능:
 * - 연속 날짜 그룹화
 * - 시간-역할별 그룹화
 * - 다중일/단일일 선택 그룹화
 *
 * @module utils/applicants/applicantGrouping
 */

import type { Selection, DateGroupedSelections } from '../../types/applicants/selection';
import { convertDateToString, formatDateDisplay } from './applicantTransform';
import {
  isConsecutiveDates,
  findConsecutiveDateGroups,
  generateDateRange,
} from './applicantFormat';

/**
 * 연속된 날짜들을 그룹화하는 인터페이스
 */
export interface ConsecutiveDateGroup {
  time: string;
  roles: string[];
  dates: string[];
  isConsecutive: boolean;
  displayDateRange: string;
  confirmedCount: number;
  requiredCount: number;
}

/**
 * 지원자 선택사항 그룹 인터페이스 (레거시)
 */
export interface LegacyApplicationGroup {
  time: string;
  role: string;
  dates: string[];
  confirmedCount: number;
  requiredCount: number;
}

/**
 * 연속된 날짜 그룹 인터페이스 (미확정 지원자용)
 */
export interface ConsecutiveDateGroupForUnconfirmed {
  dates: string[];
  displayDateRange: string;
  dayCount: number;
  isConsecutive: boolean;
  timeRoleSelections: Array<{
    time: string;
    role: string;
    originalSelections: Selection[];
  }>;
}

/**
 * 지원자의 선택사항을 연속된 날짜별로 그룹화하는 함수
 * checkMethod에 따라 그룹화/개별 표시 구분
 */
export const groupApplicationsByConsecutiveDates = (
  selections: Selection[]
): ConsecutiveDateGroup[] => {
  // checkMethod 기반 그룹화
  if (selections.length > 0 && selections[0]?.dates) {
    const actualGroups = new Map<
      string,
      { dates: string[]; time: string; roles: string[]; checkMethod?: string }
    >();
    const individualSelections: Selection[] = [];

    selections.forEach((selection) => {
      // checkMethod가 'group'이고 이미 그룹화된 경우
      if (selection.checkMethod === 'group' && selection.dates && selection.dates.length > 1) {
        const key = `${selection.groupId || 'group'}|${selection.time || '시간 미정'}`;

        if (!actualGroups.has(key)) {
          actualGroups.set(key, {
            dates: selection.dates.sort(),
            time: selection.time || '시간 미정',
            roles: [],
            checkMethod: selection.checkMethod,
          });
        }

        const group = actualGroups.get(key)!;
        if (selection.role && !group.roles.includes(selection.role)) {
          group.roles.push(selection.role);
        }
      } else {
        // 개별 체크인 경우 또는 단일 날짜인 경우
        individualSelections.push(selection);
      }
    });

    const finalGroups: ConsecutiveDateGroup[] = [];

    // 실제 그룹 처리
    actualGroups.forEach(({ dates, time, roles }) => {
      const isConsecutive = dates.length > 1 && isConsecutiveDates(dates);
      let displayRange: string;

      if (isConsecutive && dates.length > 1) {
        const firstDate = dates[0];
        const lastDate = dates[dates.length - 1];
        if (firstDate && lastDate) {
          const firstFormatted = formatDateDisplay(firstDate);
          const lastFormatted = formatDateDisplay(lastDate);
          displayRange = `${firstFormatted}~${lastFormatted}`;
        } else {
          displayRange = dates.map((d) => formatDateDisplay(d)).join(', ');
        }
      } else {
        displayRange = dates.map((d) => formatDateDisplay(d)).join(', ');
      }

      finalGroups.push({
        time,
        roles,
        dates,
        isConsecutive,
        displayDateRange: displayRange,
        confirmedCount: 0,
        requiredCount: 0,
      });
    });

    // 개별 선택들을 각각 별도 그룹으로 처리
    individualSelections.forEach((selection) => {
      const dates = selection.dates || [selection.date || ''];
      finalGroups.push({
        time: selection.time || '시간 미정',
        roles: [selection.role || '역할 미정'],
        dates,
        isConsecutive: false,
        displayDateRange: dates.map((d) => formatDateDisplay(d)).join(', '),
        confirmedCount: 0,
        requiredCount: 0,
      });
    });

    return finalGroups;
  }

  // 기존 그룹화 로직 (하위 호환성)
  const dateTimeGroups = new Map<string, { time: string; roles: string[]; dates: string[] }>();

  selections.forEach((selection) => {
    const time = selection.time || '시간 미정';
    const role = selection.role || '역할 미정';
    const date = selection.date && selection.date !== 'no-date' ? selection.date : 'no-date';

    const key = `${date}|${time}`;

    if (!dateTimeGroups.has(key)) {
      dateTimeGroups.set(key, {
        time,
        roles: [],
        dates: date === 'no-date' ? ['no-date'] : [date],
      });
    }

    const group = dateTimeGroups.get(key)!;
    if (!group.roles.includes(role)) {
      group.roles.push(role);
    }
  });

  const finalGroups: ConsecutiveDateGroup[] = [];

  dateTimeGroups.forEach(({ time, roles, dates }) => {
    let displayRange: string;

    if (dates[0] === 'no-date') {
      displayRange = '날짜 미정';
    } else {
      const sortedDates = dates.sort();
      const isConsecutive = sortedDates.length > 1 && isConsecutiveDates(sortedDates);

      if (isConsecutive && sortedDates.length > 1) {
        const firstDate = sortedDates[0];
        const lastDate = sortedDates[sortedDates.length - 1];
        if (firstDate && lastDate) {
          const firstFormatted = formatDateDisplay(firstDate);
          const lastFormatted = formatDateDisplay(lastDate);
          displayRange = `${firstFormatted}~${lastFormatted}`;
        } else {
          displayRange = sortedDates.map((d) => formatDateDisplay(d)).join(', ');
        }
      } else {
        displayRange = sortedDates.map((d) => formatDateDisplay(d)).join(', ');
      }
    }

    finalGroups.push({
      time,
      roles,
      dates: dates[0] === 'no-date' ? ['no-date'] : dates.sort(),
      isConsecutive:
        dates.length > 1 && dates[0] !== 'no-date' ? isConsecutiveDates(dates.sort()) : false,
      displayDateRange: displayRange,
      confirmedCount: 0,
      requiredCount: 0,
    });
  });

  return finalGroups;
};

/**
 * 지원자의 선택사항을 시간대-역할별로 그룹화하는 함수
 * @deprecated 새로운 groupApplicationsByConsecutiveDates 함수 사용 권장
 */
export const groupApplicationsByTimeAndRole = (
  selections: Selection[]
): LegacyApplicationGroup[] => {
  const groups = new Map<string, LegacyApplicationGroup>();

  selections.forEach((selection) => {
    const key = `${selection.time}|${selection.role}`;

    if (!groups.has(key)) {
      groups.set(key, {
        time: selection.time || '시간 미정',
        role: selection.role || '',
        dates: [],
        confirmedCount: 0,
        requiredCount: 0,
      });
    }

    const group = groups.get(key);
    if (group && selection.date && selection.date !== 'no-date') {
      if (!group.dates.includes(selection.date)) {
        group.dates.push(selection.date);
      }
    }
  });

  groups.forEach((group) => {
    group.dates.sort();
  });

  return Array.from(groups.values());
};

/**
 * 다중일 선택사항 그룹화
 * @deprecated 새로운 groupApplicationsByTimeAndRole 함수 사용 권장
 */
export const groupMultiDaySelections = (selections: Selection[]) => {
  const dateRangeGroups = new Map<string, any>();

  selections.forEach((selection) => {
    if (selection.duration?.type === 'multi' && selection.duration?.endDate && selection.date) {
      const endDate = convertDateToString(selection.duration.endDate);
      const dateRangeKey = `${selection.date}_${endDate}`;

      if (!dateRangeGroups.has(dateRangeKey)) {
        const dates = generateDateRange(selection.date, endDate);
        dateRangeGroups.set(dateRangeKey, {
          startDate: selection.date,
          endDate: endDate,
          dates: dates,
          dayCount: dates.length,
          displayDateRange:
            dates.length === 1
              ? formatDateDisplay(selection.date)
              : `${formatDateDisplay(selection.date)} ~ ${formatDateDisplay(endDate)}`,
          timeSlotRoles: [],
        });
      }

      const group = dateRangeGroups.get(dateRangeKey);
      const existingRole = group.timeSlotRoles.find(
        (tr: any) => tr.timeSlot === selection.time && tr.role === selection.role
      );

      if (!existingRole) {
        group.timeSlotRoles.push({
          timeSlot: selection.time,
          role: selection.role,
          selection: selection,
        });
      }
    }
  });

  return Array.from(dateRangeGroups.values());
};

/**
 * 단일 날짜 선택사항 그룹화
 */
export const groupSingleDaySelections = (selections: Selection[]) => {
  const groups = new Map<string, any>();

  selections.forEach((selection) => {
    const dateKey = selection.date || 'no-date';

    if (!groups.has(dateKey)) {
      groups.set(dateKey, {
        date: dateKey,
        displayDate: dateKey === 'no-date' ? '날짜 미정' : formatDateDisplay(dateKey),
        selections: [],
      });
    }

    groups.get(dateKey).selections.push(selection);
  });

  return Array.from(groups.values()).sort((a, b) => {
    if (a.date === 'no-date') return 1;
    if (b.date === 'no-date') return -1;
    return a.date.localeCompare(b.date);
  });
};

/**
 * 미확정 지원자의 연속된 날짜들을 그룹화하는 함수
 */
export const groupConsecutiveDatesForUnconfirmed = (
  selections: Selection[]
): {
  consecutiveGroups: ConsecutiveDateGroupForUnconfirmed[];
  singleDateGroups: DateGroupedSelections[];
} => {
  if (!selections || selections.length === 0) {
    return { consecutiveGroups: [], singleDateGroups: [] };
  }

  // 모든 고유 날짜 추출 및 정렬
  const allDates: string[] = Array.from(
    new Set(
      selections
        .map((s) => s.date)
        .filter((date): date is string => date !== undefined && date !== null && date !== 'no-date')
    )
  ).sort();

  if (allDates.length === 0) {
    const singleDateGroups = groupSingleDaySelections(selections);
    return { consecutiveGroups: [], singleDateGroups };
  }

  // 연속된 날짜 구간 찾기
  const consecutiveRanges = findConsecutiveDateGroups(allDates);

  const consecutiveGroups: ConsecutiveDateGroupForUnconfirmed[] = [];
  const processedSelections = new Set<string>();

  // 연속된 날짜 구간별로 처리
  consecutiveRanges.forEach((range) => {
    if (range.length > 1) {
      const firstDate = range[0];
      const lastDate = range[range.length - 1];

      if (!firstDate || !lastDate) return;

      const rangeSelections = selections.filter((s) => s.date && range.includes(s.date));

      // 시간-역할 조합별로 그룹화
      const timeRoleMap = new Map<
        string,
        { time: string; role: string; originalSelections: Selection[] }
      >();

      rangeSelections.forEach((selection) => {
        const key = `${selection.time}_${selection.role}`;
        if (!timeRoleMap.has(key)) {
          timeRoleMap.set(key, {
            time: selection.time || '',
            role: selection.role || '',
            originalSelections: [],
          });
        }
        timeRoleMap.get(key)!.originalSelections.push(selection);
      });

      const group: ConsecutiveDateGroupForUnconfirmed = {
        dates: range,
        displayDateRange:
          range.length === 1
            ? formatDateDisplay(firstDate)
            : `${formatDateDisplay(firstDate)} ~ ${formatDateDisplay(lastDate)}`,
        dayCount: range.length,
        isConsecutive: true,
        timeRoleSelections: Array.from(timeRoleMap.values()),
      };

      consecutiveGroups.push(group);

      rangeSelections.forEach((s) => processedSelections.add(`${s.date}_${s.time}_${s.role}`));
    }
  });

  // 처리되지 않은 selection들을 단일 날짜 그룹으로 분류
  const remainingSelections = selections.filter(
    (s) => !processedSelections.has(`${s.date}_${s.time}_${s.role}`)
  );

  const singleDateGroups = groupSingleDaySelections(remainingSelections);

  return { consecutiveGroups, singleDateGroups };
};
