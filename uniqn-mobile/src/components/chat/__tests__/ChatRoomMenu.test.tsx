/**
 * ChatRoomMenu — (S4) 방 헤더 `⋯` 메뉴: 알림 끄기/켜기 · 차단하기/차단 해제 · 채팅방 나가기
 *
 * 차단은 확인(confirmAction) 뒤에만 실행한다. 문구는 확정 초안 A.
 */
import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { ChatRoomMenu, type ChatRoomMenuProps } from '../ChatRoomMenu';

jest.mock('@/components/ui/Modal', () => ({
  Modal: ({ visible, children }: { visible: boolean; children: React.ReactNode }) => {
    const { View } = jest.requireActual('react-native');
    return visible ? <View>{children}</View> : null;
  },
}));

const mockConfirm = jest.fn();
jest.mock('@/utils/confirmAction', () => ({
  confirmAction: (...a: unknown[]) => mockConfirm(...a),
}));

function renderMenu(overrides: Partial<ChatRoomMenuProps> = {}) {
  const props: ChatRoomMenuProps = {
    muted: false,
    blockState: 'none',
    onToggleMute: jest.fn(),
    onBlock: jest.fn(),
    onUnblock: jest.fn(),
    onLeave: jest.fn(),
    ...overrides,
  };
  const utils = render(<ChatRoomMenu {...props} />);
  fireEvent.press(utils.getByLabelText('채팅방 메뉴'));
  return { ...utils, props };
}

beforeEach(() => jest.clearAllMocks());

describe('ChatRoomMenu', () => {
  it('기본: 알림 끄기 · 차단하기 · 채팅방 나가기', () => {
    const { getByText, queryByText } = renderMenu();
    expect(getByText('이 대화 알림 끄기')).toBeTruthy();
    expect(getByText('차단하기')).toBeTruthy();
    expect(getByText('채팅방 나가기')).toBeTruthy();
    expect(queryByText('차단 해제')).toBeNull();
  });

  it('뮤트 중이면 "알림 켜기" — 누르면 onToggleMute(false)', () => {
    const { getByText, props } = renderMenu({ muted: true });
    fireEvent.press(getByText('이 대화 알림 켜기'));
    expect(props.onToggleMute).toHaveBeenCalledWith(false);
  });

  it('알림 끄기를 누르면 onToggleMute(true)', () => {
    const { getByText, props } = renderMenu();
    fireEvent.press(getByText('이 대화 알림 끄기'));
    expect(props.onToggleMute).toHaveBeenCalledWith(true);
  });

  it('차단하기는 확인 창을 거친다 — 확인하면 onBlock', () => {
    const { getByText, props } = renderMenu();
    fireEvent.press(getByText('차단하기'));

    expect(props.onBlock).not.toHaveBeenCalled();
    expect(mockConfirm).toHaveBeenCalledWith(
      expect.objectContaining({
        title: '대화 차단',
        message: '이 대화를 차단할까요? 서로 메시지를 보낼 수 없어요. 지원·근무에는 영향이 없어요.',
        destructive: true,
      })
    );
    const { onConfirm } = mockConfirm.mock.calls[0]?.[0] as { onConfirm: () => void };
    onConfirm();
    expect(props.onBlock).toHaveBeenCalledTimes(1);
  });

  it('내가 막았으면 "차단 해제" — 누르면 onUnblock', () => {
    const { getByText, queryByText, props } = renderMenu({ blockState: 'mine' });
    expect(queryByText('차단하기')).toBeNull();
    fireEvent.press(getByText('차단 해제'));
    expect(props.onUnblock).toHaveBeenCalledTimes(1);
  });

  it('상대만 막았으면 해제는 없고 내 차단은 걸 수 있다 — 상대가 풀어도 내 차단이 남게', () => {
    const { queryByText, getByText } = renderMenu({ blockState: 'theirs' });
    expect(getByText('차단하기')).toBeTruthy();
    expect(queryByText('차단 해제')).toBeNull();
  });

  it('채팅방 나가기 → onLeave', () => {
    const { getByText, props } = renderMenu();
    fireEvent.press(getByText('채팅방 나가기'));
    expect(props.onLeave).toHaveBeenCalledTimes(1);
  });
});
