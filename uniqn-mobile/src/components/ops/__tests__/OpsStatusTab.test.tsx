import { render, fireEvent } from '@testing-library/react-native';
import { useToggleRegistration } from '@/hooks/ops';
import { OpsStatusTab } from '../OpsStatusTab';

jest.mock('@/hooks/ops', () => ({
  useToggleRegistration: jest.fn(() => ({ mutate: jest.fn() })),
  useSetTournamentStatus: jest.fn(() => ({ mutate: jest.fn() })),
}));
jest.mock('../LiveStatsPanel', () => ({ LiveStatsPanel: () => null }));
jest.mock('../MonitorLinkButton', () => ({ MonitorLinkButton: () => null }));
jest.mock('../MonitorConfigCard', () => ({ MonitorConfigCard: () => null }));
jest.mock('../TournamentResultCard', () => ({
  TournamentResultCard: () => {
    const { Text } = require('react-native');
    return <Text>결과카드</Text>;
  },
}));

const base = {
  id: 't1',
  name: 'T',
  status: 'active',
  registrationOpen: true,
  monitorToken: 'm',
  monitorConfig: null,
} as any;

describe('OpsStatusTab', () => {
  it('진행 중: 등록 토글 노출(클럭 없음)', () => {
    const { getByText, queryByText } = render(<OpsStatusTab tournament={base} />);
    expect(getByText(/등록/)).toBeTruthy();
    expect(queryByText('결과카드')).toBeNull();
  });

  it('완료: 결과카드 노출 + 등록 토글 숨김(H7)', () => {
    const { getByText, queryByText } = render(
      <OpsStatusTab tournament={{ ...base, status: 'completed' }} />
    );
    expect(getByText('결과카드')).toBeTruthy();
    expect(queryByText('열림 (마감하기)')).toBeNull();
  });

  it('등록 토글 탭 → toggleMut.mutate(반대값)', () => {
    const mutate = jest.fn();
    (useToggleRegistration as jest.Mock).mockReturnValue({ mutate });
    const { getByText } = render(<OpsStatusTab tournament={base} />);
    fireEvent.press(getByText('열림 (마감하기)'));
    expect(mutate).toHaveBeenCalledWith(false);
  });
});
