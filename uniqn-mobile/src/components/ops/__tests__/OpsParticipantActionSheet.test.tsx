import { render, fireEvent } from '@testing-library/react-native';
import {
  useBustParticipant,
  useFreeSeat,
  useSetParticipantChips,
  useSetParticipantNoShow,
} from '@/hooks/ops';
import { OpsParticipantActionSheet } from '../OpsParticipantActionSheet';

jest.mock('@/hooks/ops', () => ({
  useAddRebuy: jest.fn(() => ({ mutate: jest.fn() })),
  useAddAddon: jest.fn(() => ({ mutate: jest.fn() })),
  useBustParticipant: jest.fn(() => ({ mutate: jest.fn() })),
  useReenterParticipant: jest.fn(() => ({ mutate: jest.fn() })),
  useUndoBust: jest.fn(() => ({ mutate: jest.fn() })),
  useFreeSeat: jest.fn(() => ({ mutate: jest.fn() })),
  useSetParticipantChips: jest.fn(() => ({ mutate: jest.fn(), isPending: false })),
  useSetParticipantNoShow: jest.fn(() => ({ mutate: jest.fn(), isPending: false })),
}));
// SheetModal 실물 대신 자식 통과 스텁(레포 관례: order-sheet RolesSheet.test.tsx:11-20).
// footer 도 통과시켜야 한다 — 시트의 주 액션 버튼은 footer 에만 있어서, 드랍하면
// "저장 눌러서 mutate" 경로가 통째로 미검증으로 남는다.
jest.mock('@/components/ui/SheetModal', () => ({
  SheetModal: ({ visible, children, footer }: any) => {
    const { View } = require('react-native');
    return visible ? (
      <View>
        {children}
        {footer}
      </View>
    ) : null;
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

  // ── 결함① 칩 카운트 진입점 ──
  it('active: 칩 카운트 버튼 노출', () => {
    const { getByText } = render(
      <OpsParticipantActionSheet tournament={tournament} participant={active} onClose={jest.fn()} />
    );
    expect(getByText('칩 카운트')).toBeTruthy();
  });

  it('checked_in(대기): 칩 카운트 + 노쇼 처리 — 리바이/탈락은 서버가 active 한정이라 숨김', () => {
    const { getByText, queryByText } = render(
      <OpsParticipantActionSheet
        tournament={tournament}
        participant={{ ...active, status: 'checked_in' }}
        onClose={jest.fn()}
      />
    );
    expect(getByText('칩 카운트')).toBeTruthy();
    expect(getByText('노쇼 처리')).toBeTruthy();
    expect(queryByText('리바이')).toBeNull();
    expect(queryByText('탈락 처리')).toBeNull();
  });

  it('busted: 칩 카운트 숨김(bust/undo 원자 경로 보호)', () => {
    const { queryByText } = render(
      <OpsParticipantActionSheet tournament={tournament} participant={busted} onClose={jest.fn()} />
    );
    expect(queryByText('칩 카운트')).toBeNull();
  });

  it('칩 카운트 누르면 부모 시트가 숨고 칩 입력 시트가 뜬다(SheetModal 중첩 회피)', () => {
    const { getByText, queryByText } = render(
      <OpsParticipantActionSheet tournament={tournament} participant={active} onClose={jest.fn()} />
    );
    fireEvent.press(getByText('칩 카운트'));
    expect(getByText('새 칩 수량')).toBeTruthy();
    expect(queryByText('리바이')).toBeNull(); // 부모 시트 숨김
  });

  // 회귀 고정: 시드 effect 가 participant 객체 아이덴티티에 반응하면, ops_participants realtime
  // invalidate → refetch → 상위 재렌더마다 입력이 스냅샷 칩으로 되돌아간다(칩카운트 라운드에서 상시 발생).
  it('입력 도중 상위 재렌더가 일어나도 입력값이 유지된다(realtime refetch 회귀)', () => {
    const view = render(
      <OpsParticipantActionSheet tournament={tournament} participant={active} onClose={jest.fn()} />
    );
    fireEvent.press(view.getByText('칩 카운트'));
    fireEvent.changeText(view.getByLabelText('새 칩 수량'), '253000');
    // 상위가 인라인 participant 객체를 다시 만드는 상황 재현(props 값은 동일).
    view.rerender(
      <OpsParticipantActionSheet tournament={tournament} participant={active} onClose={jest.fn()} />
    );
    expect(view.getByLabelText('새 칩 수량').props.value).toBe('253000');
  });

  it('칩 수량 저장 → 파싱된 정수로 mutate · 성공 시 부모 시트까지 닫힘', () => {
    const mutate = jest.fn();
    (useSetParticipantChips as jest.Mock).mockReturnValue({ mutate, isPending: false });
    const onClose = jest.fn();
    const { getByText, getByLabelText } = render(
      <OpsParticipantActionSheet tournament={tournament} participant={active} onClose={onClose} />
    );
    fireEvent.press(getByText('칩 카운트'));
    fireEvent.changeText(getByLabelText('새 칩 수량'), '253,000'); // 구분자 입력도 정수로
    fireEvent.press(getByText('칩 수량 저장'));
    expect(mutate).toHaveBeenCalledWith(
      { participantId: 'p1', chips: 253000 },
      expect.objectContaining({ onSuccess: expect.any(Function) })
    );
    // onSuccess 는 칩 시트와 부모 액션시트를 함께 닫아 참가자 목록으로 복귀시킨다.
    mutate.mock.calls[0][1].onSuccess();
    expect(onClose).toHaveBeenCalled();
  });

  // ── 결함② 노쇼 진입점 ──
  it('active: 노쇼 처리 숨김 — 착석 참가자는 노쇼가 아니다(그 경로는 탈락)', () => {
    const { queryByText } = render(
      <OpsParticipantActionSheet tournament={tournament} participant={active} onClose={jest.fn()} />
    );
    expect(queryByText('노쇼 처리')).toBeNull();
  });

  it('busted: 노쇼 처리·취소 모두 숨김', () => {
    const { queryByText } = render(
      <OpsParticipantActionSheet tournament={tournament} participant={busted} onClose={jest.fn()} />
    );
    expect(queryByText('노쇼 처리')).toBeNull();
    expect(queryByText('노쇼 취소')).toBeNull();
  });

  it('checked_in: 노쇼 처리 → confirmAction 후 {noShow:true} 로 mutate + 시트 닫힘', () => {
    const mutate = jest.fn();
    (useSetParticipantNoShow as jest.Mock).mockReturnValue({ mutate, isPending: false });
    jest
      .spyOn(require('@/utils/confirmAction'), 'confirmAction')
      .mockImplementation((o: any) => o.onConfirm());
    const onClose = jest.fn();
    const { getByTestId } = render(
      <OpsParticipantActionSheet
        tournament={tournament}
        participant={{ ...active, status: 'checked_in' }}
        onClose={onClose}
      />
    );
    fireEvent.press(getByTestId('ops-participant-mark-no-show'));
    expect(mutate).toHaveBeenCalledWith({ participantId: 'p1', noShow: true });
    expect(onClose).toHaveBeenCalled();
  });

  it('no_show: 노쇼 취소만 노출 → {noShow:false} 로 mutate(확인 다이얼로그 없음)', () => {
    const mutate = jest.fn();
    (useSetParticipantNoShow as jest.Mock).mockReturnValue({ mutate, isPending: false });
    const { getByText, queryByText } = render(
      <OpsParticipantActionSheet
        tournament={tournament}
        participant={{ ...active, status: 'no_show' }}
        onClose={jest.fn()}
      />
    );
    expect(queryByText('칩 카운트')).toBeNull(); // 서버가 active/checked_in 한정
    expect(queryByText('노쇼 처리')).toBeNull();
    fireEvent.press(getByText('노쇼 취소'));
    expect(mutate).toHaveBeenCalledWith({ participantId: 'p1', noShow: false });
  });

  it('participant=null 이면 아무것도 렌더 안 함', () => {
    const { toJSON } = render(
      <OpsParticipantActionSheet tournament={tournament} participant={null} onClose={jest.fn()} />
    );
    expect(toJSON()).toBeNull();
  });
});
