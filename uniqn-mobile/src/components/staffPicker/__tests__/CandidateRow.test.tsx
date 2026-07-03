/**
 * CandidateRow — 후보 한 줄 프리미티브 단위 테스트
 *
 * 렌더(이름/닉네임/지역), 탭 콜백, 선택 상태(시각 "선택됨" + a11y selected)를 검증한다.
 */
import { render, fireEvent, screen } from '@testing-library/react-native';
import React from 'react';
import { CandidateRow } from '../CandidateRow';

describe('CandidateRow', () => {
  it('이름만 있을 때 이름을 렌더한다', () => {
    render(<CandidateRow name="김딜러" picked={false} onPress={jest.fn()} />);

    expect(screen.getByText('김딜러')).toBeTruthy();
  });

  it('닉네임·지역을 함께 렌더한다', () => {
    render(
      <CandidateRow
        name="김딜러"
        nickname="jjang"
        region="서울"
        picked={false}
        onPress={jest.fn()}
      />
    );

    expect(screen.getByText(/jjang/)).toBeTruthy();
    expect(screen.getByText('서울')).toBeTruthy();
  });

  it('탭하면 onPress가 호출된다', () => {
    const onPress = jest.fn();
    render(<CandidateRow name="김딜러" picked={false} onPress={onPress} />);

    fireEvent.press(screen.getByRole('button'));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('picked=true 이면 선택 표시와 selected a11y 상태를 노출한다', () => {
    render(<CandidateRow name="김딜러" picked onPress={jest.fn()} />);

    expect(screen.getByText('선택됨')).toBeTruthy();
    expect(screen.getByRole('button').props.accessibilityState).toEqual(
      expect.objectContaining({ selected: true })
    );
  });

  it('picked=false 이면 선택 표시가 없다', () => {
    render(<CandidateRow name="김딜러" picked={false} onPress={jest.fn()} />);

    expect(screen.queryByText('선택됨')).toBeNull();
  });
});
