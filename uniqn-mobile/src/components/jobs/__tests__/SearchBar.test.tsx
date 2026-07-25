import React from 'react';
import { Keyboard } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { SearchBar } from '../SearchBar';

/**
 * JobsScreen 테스트는 `jest.mock('@/components/jobs')` 로 SearchBar 를 통째로
 * 대체하기 때문에 이 컴포넌트는 실제로 렌더된 적이 없었다(2026-07-25 리뷰 지적).
 * 배경 클래스 제거 같은 변경이 무검증으로 지나가지 않도록 실렌더 계약을 고정한다.
 */
describe('SearchBar', () => {
  it('입력한 텍스트를 그대로 onChangeText 로 올린다', () => {
    const onChangeText = jest.fn();
    render(<SearchBar value="" onChangeText={onChangeText} />);

    fireEvent.changeText(screen.getByLabelText('공고 검색'), '홀덤');

    expect(onChangeText).toHaveBeenCalledWith('홀덤');
  });

  it('값이 없으면 지우기 버튼을 숨기고, 값이 있으면 노출한다', () => {
    const { rerender } = render(<SearchBar value="" onChangeText={jest.fn()} />);
    expect(screen.queryByLabelText('검색어 지우기')).toBeNull();

    rerender(<SearchBar value="홀덤" onChangeText={jest.fn()} />);
    expect(screen.getByLabelText('검색어 지우기')).toBeTruthy();
  });

  it('지우기 버튼은 빈 문자열로 초기화한다', () => {
    const onChangeText = jest.fn();
    render(<SearchBar value="홀덤" onChangeText={onChangeText} />);

    fireEvent.press(screen.getByLabelText('검색어 지우기'));

    expect(onChangeText).toHaveBeenCalledWith('');
  });

  it('검색 제출 시 키보드를 내린다', () => {
    const dismiss = jest.spyOn(Keyboard, 'dismiss').mockImplementation(() => undefined);
    render(<SearchBar value="홀덤" onChangeText={jest.fn()} />);

    fireEvent(screen.getByLabelText('공고 검색'), 'submitEditing');

    expect(dismiss).toHaveBeenCalled();
    dismiss.mockRestore();
  });

  it('50자 입력 상한과 검색 리턴키를 유지한다', () => {
    render(<SearchBar value="" onChangeText={jest.fn()} />);

    const input = screen.getByLabelText('공고 검색');
    expect(input.props.maxLength).toBe(50);
    expect(input.props.returnKeyType).toBe('search');
  });
});
