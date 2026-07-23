import { render, fireEvent } from '@testing-library/react-native';
import { Text } from 'react-native';
import { useOpsConsoleLayout } from '@/hooks/ops';
import { OpsConsoleShell } from '../OpsConsoleShell';

jest.mock('@/hooks/ops', () => ({ useOpsConsoleLayout: jest.fn() }));
// @gorhom/bottom-sheet 실물은 Provider 부재로 jest 렌더 불가(레포 probe 관례: StaffTab.test.tsx:3-5) → ui 배럴 모킹
jest.mock('@/components/ui', () => ({
  SelectBottomSheet: ({ visible, options, onSelect }: any) => {
    const { Text, Pressable } = require('react-native');
    if (!visible) return null;
    return options.map((o: any) => (
      <Pressable key={o.value} onPress={() => onSelect(o.value)}>
        <Text>{o.label}</Text>
      </Pressable>
    ));
  },
}));
jest.mock('../OpsClockStrip', () => ({
  OpsClockStrip: () => {
    const { Text } = require('react-native');
    return <Text>CLOCK</Text>;
  },
}));
jest.mock('../OpsSummaryStrip', () => ({
  OpsSummaryStrip: () => {
    const { Text } = require('react-native');
    return <Text>SUMMARY</Text>;
  },
}));

const baseProps = {
  tournamentId: 't1',
  isCompleted: false,
  playersCount: 57,
  staffCount: 4,
  activeTab: 'status' as const,
  onTabChange: jest.fn(),
  renderTab: (t: string) => <Text>TAB:{t}</Text>,
  fab: <Text>FAB</Text>,
};

describe('OpsConsoleShell', () => {
  it('폰: 5탭 상시 노출 + 클럭/요약 스트립', () => {
    (useOpsConsoleLayout as jest.Mock).mockReturnValue({ isWide: false, width: 390 });
    const { getByText, queryByText } = render(<OpsConsoleShell {...baseProps} />);
    expect(getByText('CLOCK')).toBeTruthy();
    expect(getByText('SUMMARY')).toBeTruthy();
    expect(getByText('현황')).toBeTruthy();
    expect(getByText('참가 57')).toBeTruthy();
    // 상금/이력은 상시 탭바에 없음(⋯ 오버플로)
    expect(queryByText('상금')).toBeNull();
  });

  it('폰: 탭 누르면 onTabChange', () => {
    (useOpsConsoleLayout as jest.Mock).mockReturnValue({ isWide: false, width: 390 });
    const onTabChange = jest.fn();
    const { getByText } = render(<OpsConsoleShell {...baseProps} onTabChange={onTabChange} />);
    fireEvent.press(getByText('테이블'));
    expect(onTabChange).toHaveBeenCalledWith('tables');
  });

  it('태블릿: 7탭 전부 노출', () => {
    (useOpsConsoleLayout as jest.Mock).mockReturnValue({ isWide: true, width: 834 });
    const { getByText } = render(<OpsConsoleShell {...baseProps} />);
    expect(getByText('상금')).toBeTruthy();
    expect(getByText('이력')).toBeTruthy();
  });

  it('활성 탭 콘텐츠 렌더', () => {
    (useOpsConsoleLayout as jest.Mock).mockReturnValue({ isWide: false, width: 390 });
    const { getByText } = render(<OpsConsoleShell {...baseProps} activeTab="players" />);
    expect(getByText('TAB:players')).toBeTruthy();
  });
});
