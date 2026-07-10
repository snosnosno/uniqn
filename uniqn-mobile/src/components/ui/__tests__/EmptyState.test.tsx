/**
 * EmptyState — 액션 렌더 테스트(P0-2 보조 액션 확장 포함)
 *
 * (1) 기본 액션(actionLabel+onAction) 렌더·호출, (2) 보조 액션(secondaryActionLabel+
 * onSecondaryAction) 렌더·호출, (3) 보조 액션 미지정 시 미렌더를 검증한다.
 */
import { render, fireEvent } from '@testing-library/react-native';
import React from 'react';
import { EmptyState } from '../EmptyState';

it('기본 액션: 라벨 렌더 + 탭 시 onAction 호출', () => {
  const onAction = jest.fn();
  const { getByText } = render(
    <EmptyState title="비어 있어요" actionLabel="만들기" onAction={onAction} />
  );

  fireEvent.press(getByText('만들기'));
  expect(onAction).toHaveBeenCalledTimes(1);
});

it('보조 액션: 라벨 렌더 + 탭 시 onSecondaryAction 호출', () => {
  const onAction = jest.fn();
  const onSecondaryAction = jest.fn();
  const { getByText } = render(
    <EmptyState
      title="비어 있어요"
      actionLabel="공고로 모집하기"
      onAction={onAction}
      secondaryActionLabel="전화번호로 찾기"
      onSecondaryAction={onSecondaryAction}
    />
  );

  fireEvent.press(getByText('전화번호로 찾기'));
  expect(onSecondaryAction).toHaveBeenCalledTimes(1);
  expect(onAction).not.toHaveBeenCalled();
});

it('보조 액션 미지정 시 미렌더', () => {
  const { queryByText } = render(
    <EmptyState title="비어 있어요" actionLabel="만들기" onAction={jest.fn()} />
  );

  expect(queryByText('전화번호로 찾기')).toBeNull();
});
