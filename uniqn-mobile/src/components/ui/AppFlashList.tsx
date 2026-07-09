/**
 * UNIQN Mobile - AppFlashList 컴포넌트
 *
 * @description @shopify/flash-list FlashList의 thin 제네릭 래퍼.
 *   FlashList 2.x 타입에는 `estimatedItemSize` prop이 누락되어 있어
 *   사용처마다 `@ts-expect-error`를 복붙해야 했던 문제를 한 곳으로 캡슐화한다.
 *   제네릭 `<T>` 추론과 ref 전달을 보존하며, 그 외 모든 props는 passthrough한다.
 *   스타일(className/dark: 등)은 사용처가 직접 넘기므로 래퍼는 관여하지 않는다.
 * @version 1.0.0
 */

import { FlashList, type FlashListProps, type FlashListRef } from '@shopify/flash-list';
import React from 'react';

/**
 * FlashList 2.x 타입에 누락된 `estimatedItemSize`를 추가한 props 타입.
 * 값을 전달하면 그대로 FlashList에 넘긴다.
 */
export type AppFlashListProps<T> = FlashListProps<T> & {
  /** 아이템 추정 높이(px). FlashList 2.x 타입 누락분을 명시적으로 노출. */
  estimatedItemSize?: number;
  ref?: React.Ref<FlashListRef<T>>;
};

/**
 * FlashList를 감싸는 제네릭 래퍼.
 * 모든 props를 passthrough하며, 타입에 누락된 `estimatedItemSize`만 이 한 곳에서
 * `@ts-expect-error`로 처리한다.
 */
function AppFlashListInner<T>({ ref, estimatedItemSize, ...rest }: AppFlashListProps<T>) {
  return (
    <FlashList<T>
      ref={ref}
      // @ts-expect-error - estimatedItemSize is required in FlashList 2.x but types may be missing
      estimatedItemSize={estimatedItemSize}
      {...rest}
    />
  );
}

/**
 * 제네릭 추론을 보존하기 위한 타입 캐스트.
 * (함수 컴포넌트 형태라 `AppFlashList<T>` 호출 시 T가 props로부터 추론된다.)
 */
export const AppFlashList = AppFlashListInner as <T>(
  props: AppFlashListProps<T>
) => React.JSX.Element;
