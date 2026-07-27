import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { CalendarGrid } from '../CalendarGrid';
import { computeDayCell } from '@/domains/workSchedule';

jest.mock('@/utils/haptics', () => ({ triggerHaptic: jest.fn() }));

describe('CalendarGrid', () => {
  it('요일 헤더 7개 렌더 (일~토)', () => {
    const { getByText } = render(
      <CalendarGrid
        visibleMonth={new Date('2026-04-15T00:00:00')}
        selectedDate={null}
        counts={{}}
        onDateSelect={jest.fn()}
      />
    );
    ['일', '월', '화', '수', '목', '금', '토'].forEach((d) => {
      expect(getByText(d)).toBeTruthy();
    });
  });

  it('2026-04 기준 날짜 35칸 (5주) 렌더 — 4월 1일=수, 30일=목, 5주로 커버', () => {
    const { getAllByTestId } = render(
      <CalendarGrid
        visibleMonth={new Date('2026-04-15T00:00:00')}
        selectedDate={null}
        counts={{}}
        onDateSelect={jest.fn()}
      />
    );
    // Sun Mar 29 ~ Sat May 2 = 35 days
    const cells = getAllByTestId(/^calendar-cell-/);
    expect(cells.length).toBe(35);
  });

  it('카운트 맵에 있는 날짜만 뱃지 표시', () => {
    const { getByText, queryAllByText } = render(
      <CalendarGrid
        visibleMonth={new Date('2026-04-15T00:00:00')}
        selectedDate={null}
        counts={{ '2026-04-18': 12, '2026-04-14': 2 }}
        onDateSelect={jest.fn()}
      />
    );
    expect(getByText('12건')).toBeTruthy();
    expect(getByText('2건')).toBeTruthy();
    // 다른 날짜엔 "건" 텍스트가 그 2개뿐
    expect(queryAllByText(/건$/).length).toBe(2);
  });

  it('셀 탭 시 onDateSelect 호출', () => {
    const onSelect = jest.fn();
    const { getByTestId } = render(
      <CalendarGrid
        visibleMonth={new Date('2026-04-15T00:00:00')}
        selectedDate={null}
        counts={{ '2026-04-18': 12 }}
        onDateSelect={onSelect}
      />
    );
    fireEvent.press(getByTestId('calendar-cell-2026-04-18'));
    expect(onSelect).toHaveBeenCalledWith(expect.any(Date));
    const calledDate: Date = onSelect.mock.calls[0][0];
    const localDateStr = `${calledDate.getFullYear()}-${String(calledDate.getMonth() + 1).padStart(2, '0')}-${String(calledDate.getDate()).padStart(2, '0')}`;
    expect(localDateStr).toBe('2026-04-18');
  });

  it('gridCells 제공 시 해당 날짜 셀이 그리드 뱃지(부족 글리프) 렌더', () => {
    const gridCells = {
      '2026-04-18': computeDayCell({
        dateKey: '2026-04-18',
        headcount: 1,
        jobCount: 0,
        softTarget: 4,
      }),
    };
    const { getByText, queryByText } = render(
      <CalendarGrid
        visibleMonth={new Date('2026-04-15T00:00:00')}
        selectedDate={null}
        counts={{}}
        onDateSelect={jest.fn()}
        gridCells={gridCells}
      />
    );
    // shortage=3 → "!3" 그리드 뱃지
    expect(getByText('!3')).toBeTruthy();
    // gridCells 없는 날짜엔 그리드 뱃지 미표시
    expect(queryByText('✓')).toBeNull();
  });

  it('gridCells 미제공 시 기존 동작 그대로(공개 캘린더 무회귀)', () => {
    const { getByText, queryByText } = render(
      <CalendarGrid
        visibleMonth={new Date('2026-04-15T00:00:00')}
        selectedDate={null}
        counts={{ '2026-04-18': 7 }}
        onDateSelect={jest.fn()}
      />
    );
    expect(getByText('7건')).toBeTruthy();
    expect(queryByText('!3')).toBeNull();
  });
});
