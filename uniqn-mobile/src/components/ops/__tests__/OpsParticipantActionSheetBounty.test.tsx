/**
 * OpsParticipantActionSheet — 바운티 탈락자 지정 피커(eliminator picker) 동작 등가 고정.
 * 현행 PlayersTab.tsx:288-324 의 문구·인자를 시트로 이관(게이트#1)했음을 검증한다.
 * SelectBottomSheet(=@gorhom 실물)는 provider 없이 jest 렌더 불가 → ui 배럴을 가벼운 스텁으로 대체.
 */
import { render, fireEvent } from '@testing-library/react-native';
import { useBustParticipant } from '@/hooks/ops';
import { OpsParticipantActionSheet } from '../OpsParticipantActionSheet';

jest.mock('@/hooks/ops', () => ({
  useAddRebuy: jest.fn(() => ({ mutate: jest.fn() })),
  useAddAddon: jest.fn(() => ({ mutate: jest.fn() })),
  useBustParticipant: jest.fn(() => ({ mutate: jest.fn() })),
  useReenterParticipant: jest.fn(() => ({ mutate: jest.fn() })),
  useUndoBust: jest.fn(() => ({ mutate: jest.fn() })),
  useFreeSeat: jest.fn(() => ({ mutate: jest.fn() })),
}));

// ui 배럴 전체 스텁 — SheetModal(자식 통과) + SelectBottomSheet(옵션→pressable, TablesTab.test 관례).
jest.mock('@/components/ui', () => {
  const { View, Text, Pressable } = require('react-native');
  return {
    SheetModal: ({ visible, children }: any) => (visible ? <View>{children}</View> : null),
    SelectBottomSheet: ({ visible, title, options, onSelect, onClose }: any) =>
      visible ? (
        <View>
          {title ? <Text>{title}</Text> : null}
          {options.map((o: any) => (
            <Pressable
              key={o.value === '' ? '__unset' : o.value}
              accessibilityRole="button"
              onPress={() => {
                onSelect(o.value);
                onClose();
              }}
            >
              <Text>{o.label}</Text>
            </Pressable>
          ))}
        </View>
      ) : null,
  };
});

const bounty = { id: 't1', status: 'active', bountyCost: 5000 } as any;
const target = { id: 'p1', name: 'Shimizu', status: 'active', entryNumber: 8 } as any;
const killer = { id: 'p3', name: 'Ivan', status: 'active', entryNumber: 3 } as any;
const out = { id: 'p4', name: 'Gone', status: 'busted', entryNumber: 4 } as any;
const roster = [target, killer, out];

function fireConfirmImmediately() {
  jest
    .spyOn(require('@/utils/confirmAction'), 'confirmAction')
    .mockImplementation((o: any) => o.onConfirm());
}

describe('OpsParticipantActionSheet — 바운티 eliminator picker', () => {
  it('바운티 탈락 → 피커 노출(지정 안 함 최상단 + active 후보만, 대상/탈락자 제외)', () => {
    const { getByText, queryByText } = render(
      <OpsParticipantActionSheet
        tournament={bounty}
        participant={target}
        participants={roster}
        onClose={jest.fn()}
      />
    );
    fireEvent.press(getByText('탈락 처리'));
    expect(getByText('Shimizu 님을 누가 눌렀나요?')).toBeTruthy();
    expect(getByText('지정 안 함')).toBeTruthy();
    expect(getByText('#3 Ivan')).toBeTruthy(); // active 후보
    expect(queryByText('#4 Gone')).toBeNull(); // busted 제외
    expect(queryByText('#8 Shimizu')).toBeNull(); // 대상 자신 제외
  });

  it('후보 선택 → 확인 후 {participantId, eliminatorId} 로 bust(H1 onSuccess 이관)', () => {
    fireConfirmImmediately();
    const mutate = jest.fn();
    (useBustParticipant as jest.Mock).mockReturnValue({ mutate });
    const { getByText } = render(
      <OpsParticipantActionSheet
        tournament={bounty}
        participant={target}
        participants={roster}
        onClose={jest.fn()}
      />
    );
    fireEvent.press(getByText('탈락 처리'));
    fireEvent.press(getByText('#3 Ivan'));
    expect(mutate).toHaveBeenCalledWith(
      { participantId: 'p1', eliminatorId: 'p3' },
      expect.objectContaining({ onSuccess: expect.any(Function) })
    );
  });

  it('피커 열림 동안 SheetModal 숨김(visible=false) — 네이티브 모달 뒤 가림 데드엔드 방지', () => {
    const { getByText, queryByText } = render(
      <OpsParticipantActionSheet
        tournament={bounty}
        participant={target}
        participants={roster}
        onClose={jest.fn()}
      />
    );
    // 피커 열기 전: 시트 본문(리바이 액션) 노출
    expect(getByText('리바이')).toBeTruthy();
    fireEvent.press(getByText('탈락 처리'));
    // 피커 열림: 시트 본문 사라지고 피커 타이틀만 남음
    expect(queryByText('리바이')).toBeNull();
    expect(getByText('Shimizu 님을 누가 눌렀나요?')).toBeTruthy();
  });

  it('지정 안 함 → eliminatorId=null 로 bust', () => {
    fireConfirmImmediately();
    const mutate = jest.fn();
    (useBustParticipant as jest.Mock).mockReturnValue({ mutate });
    const { getByText } = render(
      <OpsParticipantActionSheet
        tournament={bounty}
        participant={target}
        participants={roster}
        onClose={jest.fn()}
      />
    );
    fireEvent.press(getByText('탈락 처리'));
    fireEvent.press(getByText('지정 안 함'));
    expect(mutate).toHaveBeenCalledWith(
      { participantId: 'p1', eliminatorId: null },
      expect.objectContaining({ onSuccess: expect.any(Function) })
    );
  });
});
