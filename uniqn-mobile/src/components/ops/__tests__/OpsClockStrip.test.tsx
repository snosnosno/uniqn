import { render, fireEvent } from '@testing-library/react-native';
import { useOpsClock } from '@/hooks/ops';
import { OpsClockStrip } from '../OpsClockStrip';

jest.mock('@/hooks/ops', () => ({
  useOpsClock: jest.fn(),
}));
// 시트 본문은 무거운 의존(ClockControl) → 가벼운 스텁.
// 모킹 문형은 레포 관례(factory 안 JSX — TablesTab.test.tsx:55-63): 컴포넌트 직접 함수호출 금지.
jest.mock('../OpsClockControlSheet', () => ({
  OpsClockControlSheet: ({ visible }: { visible: boolean }) => {
    const { Text } = require('react-native');
    return visible ? <Text>SHEET_OPEN</Text> : null;
  },
}));

describe('OpsClockStrip', () => {
  it('레벨·남은시간 표시(MM:SS)', () => {
    (useOpsClock as jest.Mock).mockReturnValue({
      clock: { levelStartedAt: null, isRunning: false },
      currentLevel: { level: 19, smallBlind: 5000, bigBlind: 10000, ante: 10000 },
      remainingSec: 493,
      levelMissing: false,
    });
    const { getByText } = render(
      <OpsClockStrip tournamentId="t1" onNavigateToLevels={jest.fn()} />
    );
    expect(getByText(/LV 19|LEVEL 19/)).toBeTruthy();
    expect(getByText('08:13')).toBeTruthy();
  });

  it('접근성 라벨에 현재 레벨·남은 시간을 동적으로 포함', () => {
    (useOpsClock as jest.Mock).mockReturnValue({
      clock: { isRunning: false },
      currentLevel: { level: 1, smallBlind: 100, bigBlind: 200, ante: 0 },
      remainingSec: 1200,
      levelMissing: false,
    });
    const { getByLabelText } = render(
      <OpsClockStrip tournamentId="t1" onNavigateToLevels={jest.fn()} />
    );
    expect(getByLabelText('클럭 제어 열기, 레벨 1, 남은 시간 20분 0초')).toBeTruthy();
  });

  it('블라인드 미설정 시 라벨은 미설정 안내', () => {
    (useOpsClock as jest.Mock).mockReturnValue({
      clock: { isRunning: false },
      currentLevel: null,
      remainingSec: 0,
      levelMissing: true,
    });
    const { getByLabelText } = render(
      <OpsClockStrip tournamentId="t1" onNavigateToLevels={jest.fn()} />
    );
    expect(getByLabelText('클럭 제어 열기, 블라인드 미설정')).toBeTruthy();
  });

  it('탭하면 제어 시트 open', () => {
    (useOpsClock as jest.Mock).mockReturnValue({
      clock: { isRunning: false },
      currentLevel: { level: 1, smallBlind: 100, bigBlind: 200, ante: 200 },
      remainingSec: 60,
      levelMissing: false,
    });
    const { getByRole, getByText } = render(
      <OpsClockStrip tournamentId="t1" onNavigateToLevels={jest.fn()} />
    );
    fireEvent.press(getByRole('button'));
    expect(getByText('SHEET_OPEN')).toBeTruthy();
  });
});
