/**
 * SlotColorChips — 퇴역 팔레트 보존 계약 테스트
 *
 * 🔴 이 스위트의 핵심은 4번째 describe 다. 옛 팔레트(15종)로 저장된 슬롯의 색은 피커에 없다.
 *    그대로 두면 **아무것도 선택되지 않은 것처럼** 보여, 색만 확인하려던 사장이 멀쩡한 색을
 *    갈아치운다. `EditSlotSheet.tsx:527-539` 가 그 답으로 별도 스와치 + 안내 문구를 뒀고,
 *    이 컴포넌트가 그 동작을 이어받는다 — 지우면 회귀다.
 *
 * ⚠️ 선택 상태를 `accessibilityState.selected` 로 단언하지 않는다(react-native-web 0.21.2 미처리).
 *    스와치는 글자가 없으므로 선택 표식(체크)의 렌더 여부로 본다.
 */
import { render, screen, fireEvent } from '@testing-library/react-native';

import { SlotColorChips } from '../SlotColorChips';

describe('SlotColorChips — 현행 팔레트', () => {
  it('현행 4색을 모두 렌더한다', () => {
    render(<SlotColorChips value={null} onChange={jest.fn()} />);

    ['청록', '하늘', '보라', '자홍'].forEach((label) => {
      expect(screen.getByLabelText(`색상 ${label}`)).toBeTruthy();
    });
  });

  it('칩을 누르면 그 토큰을 통지한다', () => {
    const onChange = jest.fn();
    render(<SlotColorChips value={null} onChange={onChange} />);

    fireEvent.press(screen.getByLabelText('색상 보라'));

    expect(onChange).toHaveBeenCalledWith('slot-violet');
  });

  it('선택된 칩에만 선택 표식이 보인다', () => {
    render(<SlotColorChips value="slot-sky" onChange={jest.fn()} />);

    expect(screen.getByTestId('color-chip-selected-slot-sky')).toBeTruthy();
    expect(screen.queryByTestId('color-chip-selected-slot-teal')).toBeNull();
  });

  it('색이 없으면 어느 칩에도 선택 표식이 없다', () => {
    render(<SlotColorChips value={null} onChange={jest.fn()} />);

    ['slot-teal', 'slot-sky', 'slot-violet', 'slot-pink'].forEach((token) => {
      expect(screen.queryByTestId(`color-chip-selected-${token}`)).toBeNull();
    });
  });

  it('readOnly 면 눌러도 통지하지 않는다', () => {
    const onChange = jest.fn();
    render(<SlotColorChips value="slot-teal" onChange={onChange} readOnly />);

    fireEvent.press(screen.getByLabelText('색상 보라'));

    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('SlotColorChips — 퇴역 팔레트로 저장된 색', () => {
  it('현재 색이 옛 팔레트면 별도 스와치와 안내 문구를 함께 보여준다', () => {
    render(<SlotColorChips value="primary-600" onChange={jest.fn()} />);

    expect(screen.getByLabelText('현재 색상 (지난 팔레트)')).toBeTruthy();
    expect(
      screen.getByText('지난 팔레트로 지정된 색이에요. 위에서 고르면 새 색으로 바뀝니다.')
    ).toBeTruthy();
  });

  it('옛 색일 때 현행 칩 중에는 선택된 것이 없다', () => {
    render(<SlotColorChips value="primary-600" onChange={jest.fn()} />);

    ['slot-teal', 'slot-sky', 'slot-violet', 'slot-pink'].forEach((token) => {
      expect(screen.queryByTestId(`color-chip-selected-${token}`)).toBeNull();
    });
  });

  it('현행 색이면 옛 스와치도 안내 문구도 없다', () => {
    render(<SlotColorChips value="slot-pink" onChange={jest.fn()} />);

    expect(screen.queryByLabelText('현재 색상 (지난 팔레트)')).toBeNull();
    expect(
      screen.queryByText('지난 팔레트로 지정된 색이에요. 위에서 고르면 새 색으로 바뀝니다.')
    ).toBeNull();
  });

  it('색이 없으면 옛 스와치를 렌더하지 않는다', () => {
    render(<SlotColorChips value={null} onChange={jest.fn()} />);

    expect(screen.queryByLabelText('현재 색상 (지난 팔레트)')).toBeNull();
  });

  it('화이트리스트에 없는 값이면 옛 스와치를 렌더하지 않는다', () => {
    // slotColorSwatchClassName 이 null 을 돌려주는 값(자유 hex 등). className 을 조립하지 않고
    // 스와치를 통째로 생략한다 — NativeWind 가 못 보는 클래스가 생기지 않게.
    render(<SlotColorChips value={'#FF00AA' as never} onChange={jest.fn()} />);

    expect(screen.queryByLabelText('현재 색상 (지난 팔레트)')).toBeNull();
  });
});
