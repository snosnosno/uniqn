import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
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

// 아이콘 스텁
jest.mock('@/components/icons', () => ({
  ChevronLeftIcon: () => null,
  ChevronRightIcon: () => null,
  CalendarIcon: () => null,
  XIcon: () => null,
}));

function renderWithClient(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

describe('DateCalendar 상태머신', () => {
  beforeEach(() => {
    mockGetRegularDateCounts.mockReset();
    mockGetRegularDateCounts.mockResolvedValue({ '2026-04-18': 12 });
    // Date.now()만 고정하고 setTimeout 등은 실제 유지
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

  it('마운트 시 selectedDate=null이면 expanded (calendar grid 렌더)', async () => {
    const { findByTestId } = renderWithClient(
      <DateCalendar selectedDate={null} onDateSelect={jest.fn()} />
    );
    expect(await findByTestId('calendar-cell-2026-04-18')).toBeTruthy();
  });

  it('날짜 셀 탭 시 onDateSelect + 상태 collapsed로 전환', async () => {
    const onSelect = jest.fn();
    const { findByTestId, queryByTestId, getByLabelText, findByText } = renderWithClient(
      <DateCalendar selectedDate={null} onDateSelect={onSelect} />
    );
    // 카운트 데이터 로드 완료(뱃지 "12건" 등장)까지 대기 → 셀이 활성화된 상태
    await findByText('12건');
    const cell = await findByTestId('calendar-cell-2026-04-18');
    fireEvent.press(cell);
    expect(onSelect).toHaveBeenCalled();
    await waitFor(() => {
      expect(getByLabelText(/날짜 필터 펼치기/)).toBeTruthy();
      expect(queryByTestId('calendar-cell-2026-04-18')).toBeNull();
    });
  });

  it('selectedDate가 주어지면 초기 collapsed, 헤더 탭 시 expanded 복귀', async () => {
    const { findByTestId, getByLabelText } = renderWithClient(
      <DateCalendar selectedDate={new Date('2026-04-18T00:00:00')} onDateSelect={jest.fn()} />
    );
    const header = getByLabelText(/날짜 필터 펼치기/);
    fireEvent.press(header);
    expect(await findByTestId('calendar-cell-2026-04-18')).toBeTruthy();
  });

  it('collapsed ✕ 탭 시 onDateSelect(null) + expanded 복귀', async () => {
    const onSelect = jest.fn();
    const { getByLabelText, findByTestId } = renderWithClient(
      <DateCalendar selectedDate={new Date('2026-04-18T00:00:00')} onDateSelect={onSelect} />
    );
    fireEvent.press(getByLabelText('날짜 필터 해제'));
    expect(onSelect).toHaveBeenCalledWith(null);
    expect(await findByTestId('calendar-cell-2026-04-18')).toBeTruthy();
  });

  it('selectedDate prop이 외부에서 null로 바뀌면 expanded 복귀', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { rerender, findByTestId, queryByTestId } = render(
      <QueryClientProvider client={client}>
        <DateCalendar selectedDate={new Date('2026-04-18T00:00:00')} onDateSelect={jest.fn()} />
      </QueryClientProvider>
    );
    // 초기 collapsed — 셀 없음
    expect(queryByTestId('calendar-cell-2026-04-18')).toBeNull();
    rerender(
      <QueryClientProvider client={client}>
        <DateCalendar selectedDate={null} onDateSelect={jest.fn()} />
      </QueryClientProvider>
    );
    expect(await findByTestId('calendar-cell-2026-04-18')).toBeTruthy();
  });
});
