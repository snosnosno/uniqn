/**
 * TodayAttentionLine — 내 공고 탭 "오늘 한 줄" (구인자 IA S3)
 *
 * 규칙: 0건이면 렌더하지 않는다(조건부 숨김은 0개일 때만). 배지는 합치지 않는다.
 * 조회 실패는 "0건" 이 아니다 — 조용히 숨기면 안전망이 사라진 줄 모른다.
 */
import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { TodayAttentionLine } from '../TodayAttentionLine';

jest.mock('@/components/icons', () => ({ ChevronRightIcon: () => null }));

const ZERO = { absentCount: 0, missingCheckoutCount: 0, target: null };

describe('TodayAttentionLine', () => {
  it('신호가 0건이면 아무것도 렌더하지 않는다', () => {
    const { toJSON } = render(
      <TodayAttentionLine summary={ZERO} isError={false} onPress={jest.fn()} onRetry={jest.fn()} />
    );

    expect(toJSON()).toBeNull();
  });

  it('미출근·퇴근 미기록을 합치지 않고 각각 보여준다', () => {
    const { getByText, getByTestId } = render(
      <TodayAttentionLine
        summary={{
          absentCount: 2,
          missingCheckoutCount: 1,
          target: { kind: 'schedule', date: '2026-07-31' },
        }}
        isError={false}
        onPress={jest.fn()}
        onRetry={jest.fn()}
      />
    );

    expect(getByTestId('today-attention-line')).toBeTruthy();
    expect(getByText('미출근 2')).toBeTruthy();
    expect(getByText('퇴근 미기록 1')).toBeTruthy();
  });

  it('0건인 신호의 배지는 그리지 않는다', () => {
    const { queryByText, getByText } = render(
      <TodayAttentionLine
        summary={{
          absentCount: 0,
          missingCheckoutCount: 3,
          target: { kind: 'posting', jobPostingId: 'jp-1' },
        }}
        isError={false}
        onPress={jest.fn()}
        onRetry={jest.fn()}
      />
    );

    expect(getByText('퇴근 미기록 3')).toBeTruthy();
    expect(queryByText(/미출근/)).toBeNull();
  });

  it('누르면 집계의 이동 대상을 넘긴다', () => {
    const onPress = jest.fn();
    const target = { kind: 'posting', jobPostingId: 'jp-1' } as const;
    const { getByTestId } = render(
      <TodayAttentionLine
        summary={{ absentCount: 1, missingCheckoutCount: 0, target }}
        isError={false}
        onPress={onPress}
        onRetry={jest.fn()}
      />
    );

    fireEvent.press(getByTestId('today-attention-line'));

    expect(onPress).toHaveBeenCalledWith(target);
  });

  it('스크린리더 라벨에 두 신호의 건수가 모두 들어간다', () => {
    const { getByLabelText } = render(
      <TodayAttentionLine
        summary={{
          absentCount: 2,
          missingCheckoutCount: 1,
          target: { kind: 'schedule', date: '2026-07-31' },
        }}
        isError={false}
        onPress={jest.fn()}
        onRetry={jest.fn()}
      />
    );

    expect(getByLabelText(/미출근 2건.*퇴근 미기록 1건/)).toBeTruthy();
  });

  it('조회에 실패하면 숨기지 않고 실패를 알린 뒤 다시 시도할 수 있다', () => {
    const onRetry = jest.fn();
    const { getByTestId, getByText } = render(
      <TodayAttentionLine summary={ZERO} isError onPress={jest.fn()} onRetry={onRetry} />
    );

    expect(getByText('오늘 근무 현황을 확인하지 못했습니다')).toBeTruthy();
    fireEvent.press(getByTestId('today-attention-retry'));
    expect(onRetry).toHaveBeenCalled();
  });
});
