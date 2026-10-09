/**
 * OpsBulkRegisterSheet — 명단 붙여넣기 등록(모바일).
 *
 * 고정하는 계약:
 *  1. 붙여넣은 줄을 해석해 이름·연락처로 보낸다(앞 번호는 뗀다) — 해석은 웹 콘솔과 같은 순수 함수.
 *  2. 서버가 전부 성공하거나 전부 취소하므로, 오류 줄이 하나라도 있으면 보내지 않는다.
 *  3. 성공했을 때만 닫고 비운다 — 실패하면 명단이 남아야 고쳐서 다시 보낸다.
 */
import { act, render, fireEvent } from '@testing-library/react-native';
import { OpsBulkRegisterSheet } from '../OpsBulkRegisterSheet';

const mockMutate = jest.fn();
jest.mock('@/hooks/ops', () => ({
  useRegisterParticipantsBulk: jest.fn(() => ({ mutate: mockMutate, isPending: false })),
}));

// SheetModal 실물 대신 children+footer 통과 스텁(레포 관례).
jest.mock('@/components/ui', () => ({
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

beforeEach(() => {
  mockMutate.mockReset();
});

function open(existingNames: string[] = []) {
  const onClose = jest.fn();
  const utils = render(
    <OpsBulkRegisterSheet
      tournamentId="t1"
      visible
      onClose={onClose}
      existingNames={existingNames}
    />
  );
  return { ...utils, onClose };
}

describe('OpsBulkRegisterSheet', () => {
  it('비어 있으면 0명 등록 버튼이 막혀 있다', () => {
    const { getByLabelText } = open();
    fireEvent.press(getByLabelText('0명 등록'));
    expect(mockMutate).not.toHaveBeenCalled();
  });

  it('줄을 해석해 이름·연락처로 보낸다 — 앞 번호를 떼고 바이인은 숫자로', () => {
    const { getByLabelText } = open();
    fireEvent.changeText(getByLabelText('등록할 명단'), '홍길동\n김철수 010-1234-5678\n3. 이영희');
    fireEvent.changeText(getByLabelText('바이인 금액'), '100,000');
    fireEvent.press(getByLabelText('3명 등록'));

    expect(mockMutate).toHaveBeenCalledTimes(1);
    expect(mockMutate.mock.calls[0][0]).toEqual({
      rows: [
        { name: '홍길동', phone: undefined },
        { name: '김철수', phone: '010-1234-5678' },
        { name: '이영희', phone: undefined },
      ],
      buyInAmount: 100000,
    });
  });

  it('바이인을 안 적으면 금액 없이 보낸다(0원으로 기록하지 않는다)', () => {
    const { getByLabelText } = open();
    fireEvent.changeText(getByLabelText('등록할 명단'), '홍길동');
    fireEvent.press(getByLabelText('1명 등록'));
    expect(mockMutate.mock.calls[0][0].buyInAmount).toBeUndefined();
  });

  it('오류 줄이 하나라도 있으면 보내지 않는다 — 전부 성공하거나 전부 취소라서', () => {
    const { getByLabelText, getByText } = open();
    // '이름' 은 표 머리글 — 사람 이름으로 등록되면 안 된다
    fireEvent.changeText(getByLabelText('등록할 명단'), '이름\n홍길동');
    expect(getByText('머리글 줄이에요. 지워 주세요')).toBeTruthy();
    fireEvent.press(getByLabelText('1명 등록'));
    expect(mockMutate).not.toHaveBeenCalled();
  });

  it('이미 등록된 이름은 막지 않고 표시만 한다(동명이인)', () => {
    const { getByLabelText, getByText } = open(['홍길동']);
    fireEvent.changeText(getByLabelText('등록할 명단'), '홍길동');
    expect(getByText('이미 등록된 이름이에요')).toBeTruthy();
    fireEvent.press(getByLabelText('1명 등록'));
    expect(mockMutate).toHaveBeenCalledTimes(1);
  });

  it('숫자가 없는 금액은 막는다', () => {
    const { getByLabelText, getByText } = open();
    fireEvent.changeText(getByLabelText('등록할 명단'), '홍길동');
    fireEvent.changeText(getByLabelText('바이인 금액'), 'abc');
    expect(getByText('금액은 숫자로 입력해 주세요')).toBeTruthy();
    fireEvent.press(getByLabelText('1명 등록'));
    expect(mockMutate).not.toHaveBeenCalled();
  });

  it('성공하면 닫고 비운다 · 실패하면 명단을 그대로 둔다', () => {
    const { getByLabelText, onClose } = open();
    fireEvent.changeText(getByLabelText('등록할 명단'), '홍길동');
    fireEvent.press(getByLabelText('1명 등록'));

    // 실패 — onSuccess 가 안 불린다
    expect(onClose).not.toHaveBeenCalled();
    expect(getByLabelText('등록할 명단').props.value).toBe('홍길동');

    // 성공
    act(() => {
      mockMutate.mock.calls[0][1].onSuccess();
    });
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(getByLabelText('등록할 명단').props.value).toBe('');
  });
});
