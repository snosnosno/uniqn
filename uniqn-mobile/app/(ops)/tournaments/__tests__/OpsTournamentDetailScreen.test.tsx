import { render } from '@testing-library/react-native';
import { useOpsTournament } from '@/hooks/ops';
import OpsTournamentDetailScreen from '../[id]';

jest.mock('expo-router', () => ({ useLocalSearchParams: () => ({ id: 't1' }) }));
// StackHeader→HeaderBackButton 이 useRouter/useNavigation/usePathname 호출 — 미모킹 시 크래시
// (기존 화면 테스트 관례: OpsTournamentListScreen.test.tsx:33-35)
jest.mock('@/components/headers', () => ({ StackHeader: () => null }));
jest.mock('@/hooks/ops', () => ({
  useOpsTournament: jest.fn(),
  useOpsParticipants: jest.fn(() => ({ participants: [], isLoading: false })),
  useOpsStaff: jest.fn(() => ({ data: [] })),
}));
// 셸은 렌더 확인만 — 활성 탭 라벨 스텁(factory 안 JSX 관례)
jest.mock('@/components/ops', () => ({
  OpsConsoleShell: ({ activeTab }: { activeTab: string }) => {
    const { Text } = require('react-native');
    return <Text>{`SHELL:${activeTab}`}</Text>;
  },
  OpsStatusTab: () => null,
  PlayersTab: () => null,
  TablesTab: () => null,
  BlindLevelsTab: () => null,
  StaffTab: () => null,
  HistoryTab: () => null,
  PayoutsTab: () => null,
}));

describe('OpsTournamentDetailScreen', () => {
  it('기본 진입 탭 = status(현황)', () => {
    (useOpsTournament as jest.Mock).mockReturnValue({
      tournament: { id: 't1', name: 'T', status: 'active' },
      isLoading: false,
    });
    const { getByText } = render(<OpsTournamentDetailScreen />);
    expect(getByText('SHELL:status')).toBeTruthy();
  });

  it('대회 없음 → 접근 안내', () => {
    (useOpsTournament as jest.Mock).mockReturnValue({ tournament: null, isLoading: false });
    const { getByText } = render(<OpsTournamentDetailScreen />);
    expect(getByText(/접근 권한/)).toBeTruthy();
  });
});
