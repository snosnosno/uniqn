/**
 * FixedPostingWorkNotice — 상시 공고의 [근무] 도착지 (구인자 IA S1).
 *
 * 상시 공고는 날짜가 없어 출퇴근·정산이 없다. 종전에는 "지원하지 않는 화면입니다"라는
 * 막다른 에러를 띄웠는데, 사장이 할 일은 따로 있다 — 실제 근무일을 근무표에서 배치하는 것.
 */
import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { FixedPostingWorkNotice } from '../FixedPostingWorkNotice';

describe('FixedPostingWorkNotice', () => {
  it('공고의 용도를 말하고 근무표로 데려간다', () => {
    const onOpenWorkSchedule = jest.fn();
    const { getByText, getByTestId, queryByText } = render(
      <FixedPostingWorkNotice onOpenWorkSchedule={onOpenWorkSchedule} />
    );

    expect(getByText('이 공고는 사람을 모으는 용도예요')).toBeTruthy();
    expect(getByText('실제 근무일은 근무표에서 배치하세요.')).toBeTruthy();
    // 막다른 에러 문구로 되돌아가지 않는다.
    expect(queryByText('지원하지 않는 화면입니다')).toBeNull();

    fireEvent.press(getByTestId('fixed-posting-open-work-schedule'));
    expect(onOpenWorkSchedule).toHaveBeenCalledTimes(1);
  });
});
