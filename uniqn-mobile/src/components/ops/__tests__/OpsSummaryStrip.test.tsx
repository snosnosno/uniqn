import { render, fireEvent } from '@testing-library/react-native';
import { useOpsLiveStats } from '@/hooks/ops';
import { OpsSummaryStrip } from '../OpsSummaryStrip';

jest.mock('@/hooks/ops', () => ({ useOpsLiveStats: jest.fn() }));

describe('OpsSummaryStrip', () => {
  it('PLAYING·ENTRY·AVG BB 를 한 줄로 표시', () => {
    (useOpsLiveStats as jest.Mock).mockReturnValue({
      stats: { playing: 9, entries: 57, avgStackBb: 19 },
    });
    const { getByText } = render(<OpsSummaryStrip tournamentId="t1" />);
    expect(getByText('9')).toBeTruthy();
    expect(getByText('57')).toBeTruthy();
    expect(getByText('19')).toBeTruthy();
  });

  it('탭하면 onPress 호출(현황 점프)', () => {
    (useOpsLiveStats as jest.Mock).mockReturnValue({
      stats: { playing: 0, entries: 0, avgStackBb: 0 },
    });
    const onPress = jest.fn();
    const { getByRole } = render(<OpsSummaryStrip tournamentId="t1" onPress={onPress} />);
    fireEvent.press(getByRole('button'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
