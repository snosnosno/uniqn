/**
 * CancellationRequestsBanner — [근무] 화면 맨 위 취소 요청 한 줄 (구인자 IA S1).
 *
 * 공고 상세의 `취소 요청 관리` 타일을 없애고 [근무] 로 흡수했다. 고정하는 계약 둘.
 *  1. 0건이면 그리지 않는다 — "조건부 숨김은 0개일 때만" 규칙. 요청이 있는 동안에는 늘 같은 자리다.
 *  2. 건수를 말하고, 누르면 검토 화면으로 데려간다(스크린리더도 목적지를 듣는다).
 */
import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { CancellationRequestsBanner } from '../CancellationRequestsBanner';

describe('CancellationRequestsBanner', () => {
  it('0건이면 렌더하지 않는다', () => {
    const { queryByTestId } = render(<CancellationRequestsBanner count={0} onPress={jest.fn()} />);

    expect(queryByTestId('work-cancellation-banner')).toBeNull();
  });

  it('건수를 보여주고 누르면 검토 화면으로 보낸다', () => {
    const onPress = jest.fn();
    const { getByTestId, getByText } = render(
      <CancellationRequestsBanner count={2} onPress={onPress} />
    );

    expect(getByText('취소 요청 2건')).toBeTruthy();
    const banner = getByTestId('work-cancellation-banner');
    expect(banner.props.accessibilityLabel).toBe('취소 요청 2건, 검토 화면으로 이동');

    fireEvent.press(banner);
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
