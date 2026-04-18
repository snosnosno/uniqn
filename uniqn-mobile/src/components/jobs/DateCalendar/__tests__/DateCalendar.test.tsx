import React, { useState } from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DateCalendar } from '../DateCalendar';

const mockGetRegularDateCounts = jest.fn();

jest.mock('@/repositories', () => ({
  jobPostingRepository: {
    getRegularDateCounts: (...args: unknown[]) => mockGetRegularDateCounts(...args),
  },
}));

jest.mock('@tanstack/react-query', () => jest.requireActual('@tanstack/react-query'));

jest.mock('@/utils/haptics', () => ({ triggerHaptic: jest.fn() }));

jest.mock('@/components/icons', () => ({
  ChevronLeftIcon: () => null,
  ChevronRightIcon: () => null,
  CalendarIcon: () => null,
  XIcon: () => null,
}));

/**
 * Controlled parent wrapper — 실제 부모가 selectedDate를 useState로 관리하는 패턴 재현.
 */
function ControlledParent({
  initial = null,
  onSelectSpy,
}: {
  initial?: Date | null;
  onSelectSpy?: jest.Mock;
}) {
  const [selectedDate, setSelectedDate] = useState<Date | null>(initial);
  return (
    <DateCalendar
      selectedDate={selectedDate}
      onDateSelect={(d) => {
        setSelectedDate(d);
        onSelectSpy?.(d);
      }}
    />
  );
}

function renderWithClient(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

describe('DateCalendar 상태머신', () => {
  beforeEach(() => {
    mockGetRegularDateCounts.mockReset();
    mockGetRegularDateCounts.mockResolvedValue({ '2026-04-18': 12 });
    jest.useFakeTimers({
      doNotFake: [
        'setTimeout',
        'setInterval',
        'clearTimeout',
        'clearInterval',
        'nextTick',
        'queueMicrotask',
        'setImmediate',
        'requestAnimationFrame',
      ],
    });
    jest.setSystemTime(new Date('2026-04-19T00:00:00'));
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('마운트 시 selectedDate=null이면 expanded', async () => {
    const { findByTestId } = renderWithClient(<ControlledParent />);
    expect(await findByTestId('calendar-cell-2026-04-18')).toBeTruthy();
  });

  it('날짜 셀 탭 → onDateSelect + collapsed 전환', async () => {
    const onSelect = jest.fn();
    const { findByTestId, queryByTestId, getByLabelText, findByText } = renderWithClient(
      <ControlledParent onSelectSpy={onSelect} />
    );
    // 카운트 데이터 로드 완료(뱃지 "12건" 등장)까지 대기 → 셀이 활성화(count>0)된 상태
    await findByText('12건');
    const cell = await findByTestId('calendar-cell-2026-04-18');
    fireEvent.press(cell);
    expect(onSelect).toHaveBeenCalled();
    await waitFor(() => {
      expect(getByLabelText(/날짜 필터 펼치기/)).toBeTruthy();
      expect(queryByTestId('calendar-cell-2026-04-18')).toBeNull();
    });
  });

  it('selectedDate=값 초기 진입 → collapsed, 헤더 탭 시 expanded 복귀', async () => {
    const { findByTestId, getByLabelText } = renderWithClient(
      <ControlledParent initial={new Date('2026-04-18T00:00:00')} />
    );
    const header = getByLabelText(/날짜 필터 펼치기/);
    fireEvent.press(header);
    expect(await findByTestId('calendar-cell-2026-04-18')).toBeTruthy();
  });

  it('collapsed ✕ 탭 → onDateSelect(null) + expanded 복귀', async () => {
    const onSelect = jest.fn();
    const { getByLabelText, findByTestId } = renderWithClient(
      <ControlledParent initial={new Date('2026-04-18T00:00:00')} onSelectSpy={onSelect} />
    );
    fireEvent.press(getByLabelText('날짜 필터 해제'));
    expect(onSelect).toHaveBeenCalledWith(null);
    expect(await findByTestId('calendar-cell-2026-04-18')).toBeTruthy();
  });

  it('selectedDate prop이 외부에서 null로 바뀌면 expanded 복귀', async () => {
    // 외부 상태 전환을 직접 제어하는 래퍼
    let externalSetter: ((d: Date | null) => void) | null = null;
    function ExternalController() {
      const [d, setD] = useState<Date | null>(new Date('2026-04-18T00:00:00'));
      externalSetter = setD;
      return <DateCalendar selectedDate={d} onDateSelect={() => undefined} />;
    }
    const { findByTestId, queryByTestId } = renderWithClient(<ExternalController />);
    expect(queryByTestId('calendar-cell-2026-04-18')).toBeNull();

    act(() => {
      externalSetter?.(null);
    });

    expect(await findByTestId('calendar-cell-2026-04-18')).toBeTruthy();
  });
});
