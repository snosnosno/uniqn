/**
 * UNIQN Mobile - NumericText 헬퍼 컴포넌트
 *
 * @description 숫자(금액/날짜/시간/통계)를 tabular-nums로 렌더링하는 Text 래퍼.
 *              NativeWind 4.2는 fontVariant를 className으로 지원하지 않으므로
 *              inline style로 적용한다.
 * @version 1.0.0
 *
 * @example
 * <NumericText className="text-base font-bold">{amount.toLocaleString()}원</NumericText>
 */

import React from 'react';
import { Text, type TextProps } from 'react-native';

export type NumericTextProps = TextProps;

/**
 * tabular-nums가 적용된 Text 컴포넌트.
 * - 숫자 폭이 일정하게 정렬되어 리스트/정산/통계에서 시각적 안정성 제공
 * - 기존 `style`은 병합되며, 호출자 스타일이 우선 적용됨 (배열 뒤쪽)
 */
export function NumericText({ children, style, ...rest }: NumericTextProps) {
  return (
    <Text style={[{ fontVariant: ['tabular-nums'] }, style]} {...rest}>
      {children}
    </Text>
  );
}
