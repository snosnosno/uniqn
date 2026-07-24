/**
 * OpsTournamentDetailScreen — L7 등록 FAB 노출 게이트 테스트.
 *
 * 셸을 fab 슬롯·탭 전환 버튼을 노출하는 스텁으로 대체해 부모의 `tab === 'players'`
 * 게이트를 검증(기존 상세 화면 테스트 관례: OpsTournamentDetailScreen.test.tsx). 등록 시트는 스텁.
 */
import { render, fireEvent } from '@testing-library/react-native';
import { useOpsTournament } from '@/hooks/ops';
import OpsTournamentDetailScreen from '../[id]';

jest.mock('expo-router', () => ({ useLocalSearchParams: () => ({ id: 't1' }) }));
jest.mock('@/components/headers', () => ({ StackHeader: () => null }));
jest.mock('@/hooks/ops', () => ({
  useOpsTournament: jest.fn(),
  useOpsParticipants: jest.fn(() => ({ participants: [], isLoading: false })),
  useOpsStaff: jest.fn(() => ({ data: [] })),
}));

// 셸 스텁 — fab 슬롯 + 탭 전환 버튼을 노출해 부모의 tab 게이트를 검증.
jest.mock('@/components/ops', () => {
  const { View, Pressable, Text } = require('react-native');
  return {
    OpsConsoleShell: ({ activeTab, onTabChange, fab }: any) => (
      <View>
        <Text>{`TAB:${activeTab}`}</Text>
        <Pressable accessibilityLabel="go-players" onPress={() => onTabChange('players')}>
          <Text>players</Text>
        </Pressable>
        <Pressable accessibilityLabel="go-tables" onPress={() => onTabChange('tables')}>
          <Text>tables</Text>
        </Pressable>
        {fab}
      </View>
    ),
    OpsStatusTab: () => null,
    PlayersTab: () => null,
    TablesTab: () => null,
    BlindLevelsTab: () => null,
    StaffTab: () => null,
    HistoryTab: () => null,
    PayoutsTab: () => null,
    OpsRegisterParticipantSheet: () => null,
  };
});

beforeEach(() => {
  (useOpsTournament as jest.Mock).mockReturnValue({
    tournament: { id: 't1', name: 'T', status: 'active', registrationOpen: true },
    isLoading: false,
  });
});

it('참가 탭에서만 등록 FAB 노출', () => {
  const { queryByLabelText, getByLabelText } = render(<OpsTournamentDetailScreen />);
  // 기본 진입 = 현황(status) → FAB 없음
  expect(queryByLabelText('참가 등록')).toBeNull();
  // 참가 탭 진입 → FAB 노출
  fireEvent.press(getByLabelText('go-players'));
  expect(queryByLabelText('참가 등록')).not.toBeNull();
  // 다른 탭 전환 → FAB 사라짐
  fireEvent.press(getByLabelText('go-tables'));
  expect(queryByLabelText('참가 등록')).toBeNull();
});
