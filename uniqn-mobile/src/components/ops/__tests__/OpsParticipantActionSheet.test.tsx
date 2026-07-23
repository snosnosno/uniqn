import { render, fireEvent } from '@testing-library/react-native';
import { useBustParticipant, useFreeSeat } from '@/hooks/ops';
import { OpsParticipantActionSheet } from '../OpsParticipantActionSheet';

jest.mock('@/hooks/ops', () => ({
  useAddRebuy: jest.fn(() => ({ mutate: jest.fn() })),
  useAddAddon: jest.fn(() => ({ mutate: jest.fn() })),
  useBustParticipant: jest.fn(() => ({ mutate: jest.fn() })),
  useReenterParticipant: jest.fn(() => ({ mutate: jest.fn() })),
  useUndoBust: jest.fn(() => ({ mutate: jest.fn() })),
  useFreeSeat: jest.fn(() => ({ mutate: jest.fn() })),
}));
// SheetModal 실물 대신 자식 통과 스텁(레포 관례: order-sheet RolesSheet.test.tsx:11-22)
jest.mock('@/components/ui/SheetModal', () => ({
  SheetModal: ({ visible, children }: any) => {
    const { View } = require('react-native');
    return visible ? <View>{children}</View> : null;
  },
}));

const tournament = { id: 't1', status: 'active', bountyCost: null } as any;
const active = {
  id: 'p1',
  name: 'Shimizu',
  status: 'active',
  chips: 480000,
  entryNumber: 8,
} as any;
const busted = {
  id: 'p2',
  name: 'Hsieh',
  status: 'busted',
  finishPosition: 11,
  entryNumber: 11,
} as any;
const seat = { id: 's1', participantId: 'p1' } as any;

describe('OpsParticipantActionSheet', () => {
  it('참가 행 진입(seat 없음): 리바이/애드온/탈락 노출, 좌석 액션 숨김', () => {
    const { getByText, queryByText } = render(
      <OpsParticipantActionSheet tournament={tournament} participant={active} onClose={jest.fn()} />
    );
    expect(getByText('리바이')).toBeTruthy();
    expect(getByText('애드온')).toBeTruthy();
    expect(getByText('탈락 처리')).toBeTruthy();
    expect(queryByText('좌석 비우기')).toBeNull();
    expect(queryByText('자리 이동')).toBeNull();
  });

  it('좌석 진입(seat 있음): 좌석 비우기=seat.id · 자리 이동=onRequestMove(seat)', () => {
    const free = jest.fn();
    const onRequestMove = jest.fn();
    (useFreeSeat as jest.Mock).mockReturnValue({ mutate: free });
    const { getByText } = render(
      <OpsParticipantActionSheet
        tournament={tournament}
        participant={active}
        seat={seat}
        onClose={jest.fn()}
        onRequestMove={onRequestMove}
      />
    );
    fireEvent.press(getByText('좌석 비우기'));
    expect(free).toHaveBeenCalledWith('s1'); // C1: seatId — participantId 아님
    fireEvent.press(getByText('자리 이동'));
    expect(onRequestMove).toHaveBeenCalledWith(seat); // C2: 기존 moveMode 재사용
  });

  it('좌석 비우기는 destructive 스타일(error 색상) — 리디자인 중 소실 복원', () => {
    const { getByText } = render(
      <OpsParticipantActionSheet
        tournament={tournament}
        participant={active}
        seat={seat}
        onClose={jest.fn()}
        onRequestMove={jest.fn()}
      />
    );
    // 파괴적 액션은 error 색상 텍스트로 구분(자리 이동=중립 gray 와 대비).
    expect(getByText('좌석 비우기').props.className).toContain('text-error');
    expect(getByText('자리 이동').props.className).not.toContain('text-error');
  });

  it('비바운티 탈락 → confirmAction 후 {participantId} + onSuccess 콜백(H1)', () => {
    const mutate = jest.fn();
    (useBustParticipant as jest.Mock).mockReturnValue({ mutate });
    // confirmAction 은 즉시 onConfirm 실행하도록 모킹
    jest
      .spyOn(require('@/utils/confirmAction'), 'confirmAction')
      .mockImplementation((o: any) => o.onConfirm());
    const { getByText } = render(
      <OpsParticipantActionSheet tournament={tournament} participant={active} onClose={jest.fn()} />
    );
    fireEvent.press(getByText('탈락 처리'));
    expect(mutate).toHaveBeenCalledWith(
      { participantId: 'p1' },
      expect.objectContaining({ onSuccess: expect.any(Function) }) // handleBustSuccess 이관
    );
  });

  it('busted + 대회 active: 재진입/탈락취소 노출(리바이 없음)', () => {
    const { getByText, queryByText } = render(
      <OpsParticipantActionSheet tournament={tournament} participant={busted} onClose={jest.fn()} />
    );
    expect(getByText('재진입')).toBeTruthy();
    expect(getByText('탈락 취소')).toBeTruthy();
    expect(queryByText('리바이')).toBeNull();
  });

  it('busted + 대회 completed: 탈락취소 숨김(H8 게이트)', () => {
    const { queryByText } = render(
      <OpsParticipantActionSheet
        tournament={{ ...tournament, status: 'completed' }}
        participant={busted}
        onClose={jest.fn()}
      />
    );
    expect(queryByText('탈락 취소')).toBeNull();
  });

  it('participant=null 이면 아무것도 렌더 안 함', () => {
    const { toJSON } = render(
      <OpsParticipantActionSheet tournament={tournament} participant={null} onClose={jest.fn()} />
    );
    expect(toJSON()).toBeNull();
  });
});
