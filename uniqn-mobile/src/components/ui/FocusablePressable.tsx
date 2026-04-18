/**
 * UNIQN Mobile - FocusablePressable
 *
 * 외부 키보드(iPad Magic Keyboard, 블루투스) 사용자를 위한
 * 포커스 링이 통합된 Pressable.
 *
 * 룰 근거: `.claude/rules/impeccable-design.md` §22
 * - 포커스 색: Info 블루 `#2563EB` 2px (골드 아님 — 골드는 CTA/금액 전용)
 * - 터치 네비게이션에서는 invisible (focused=false 유지)
 * - 기본 상태에서 transparent 2px border를 예약해 포커스 시 layout shift 방지
 */

import React, { forwardRef, useCallback, useState } from 'react';
import { Pressable, View, type PressableProps, type ViewStyle } from 'react-native';

export interface FocusablePressableProps extends PressableProps {
  /** 포커스 링 radius — 내부 컨테이너 rounded와 맞추면 자연스러움 */
  focusRingRadius?: number;
}

const FOCUS_COLOR = '#2563EB';

export const FocusablePressable = forwardRef<View, FocusablePressableProps>(
  function FocusablePressable(
    { children, focusRingRadius = 6, onFocus, onBlur, style, ...rest },
    ref
  ) {
    const [focused, setFocused] = useState(false);

    const handleFocus = useCallback(
      (event: Parameters<NonNullable<PressableProps['onFocus']>>[0]) => {
        setFocused(true);
        onFocus?.(event);
      },
      [onFocus]
    );

    const handleBlur = useCallback(
      (event: Parameters<NonNullable<PressableProps['onBlur']>>[0]) => {
        setFocused(false);
        onBlur?.(event);
      },
      [onBlur]
    );

    const focusStyle: ViewStyle = {
      borderWidth: 2,
      borderColor: focused ? FOCUS_COLOR : 'transparent',
      borderRadius: focusRingRadius,
    };

    // Pressable style은 ViewStyle | ((state) => ViewStyle) 두 형태를 모두 지원.
    // 함수형일 경우 focus 스타일을 state와 함께 머지.
    const mergedStyle: PressableProps['style'] =
      typeof style === 'function'
        ? (state) => {
            const fnResult = (style as (s: typeof state) => ViewStyle | ViewStyle[])(state);
            return [focusStyle, fnResult];
          }
        : [focusStyle, style as ViewStyle | ViewStyle[] | undefined];

    return (
      <Pressable ref={ref} onFocus={handleFocus} onBlur={handleBlur} style={mergedStyle} {...rest}>
        {children}
      </Pressable>
    );
  }
);

export default FocusablePressable;
