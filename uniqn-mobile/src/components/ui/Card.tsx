/**
 * UNIQN Mobile - Card 컴포넌트
 *
 * @description 콘텐츠를 그룹화하는 카드 컨테이너
 * @version 1.0.0
 */

import React from 'react';
import { View, Pressable, ViewProps } from 'react-native';

type CardVariant = 'elevated' | 'outlined' | 'filled';
type CardPadding = 'none' | 'sm' | 'md' | 'lg';

export interface CardProps extends ViewProps {
  children: React.ReactNode;
  variant?: CardVariant;
  padding?: CardPadding;
  onPress?: () => void;
  className?: string;
  /** 접근성 라벨 (클릭 가능한 카드용) */
  accessibilityLabel?: string;
  /** 접근성 힌트 (클릭 가능한 카드용) */
  accessibilityHint?: string;
}

/**
 * elevation 은 그림자가 아니라 **배경 명도 단계**로 만든다(디자인 룰 14).
 *
 * 종전 `elevated` 는 `shadow-md` 를 달고 있었고, `variant` 를 안 주면 이게 기본이라
 * 앱 전체 67곳이 같은 높이로 떠 있었다 — 전부 떠 있으면 아무것도 강조되지 않는다.
 * 게다가 다크 배경은 `#0B0B0E` 라 **검정 위에 검은 그림자를 그리고 있었다**(보이지 않는다).
 *
 * 다크에는 이미 명도 +9 씩 올라가는 5단 사다리가 있다
 * (surface #0B0B0E → card #141418 → elevated #1C1C22 → overlay #26262C → hover #2E2E34).
 * 카드의 제자리는 `surface-card` 다 — 종전의 `dark:bg-surface-elevated` 는 그림자가
 * 안 보이니 배경을 한 단계 올려 벌충한 것이고, `surface-elevated` 는 시트·팝오버 자리다.
 * 경계는 헤어라인이 준다(라이트 `#D6D2CA` · 다크 `#222228`).
 *
 * 진짜로 떠야 하는 것들(Toast·FAB)은 Card 를 거치지 않고 자기 자리에서 `shadow-lg` 를 쓴다.
 *
 * 🔑 **라이트는 배경색이 그대로다** — `surface-card` 의 라이트 값이 `#FFFFFF` 라
 * `bg-white` 와 같다. 라이트에서 바뀌는 건 그림자가 빠지고 헤어라인이 생기는 것뿐이고,
 * 배경 하강은 다크에서만 일어난다.
 */
const variantStyles: Record<CardVariant, string> = {
  elevated: 'bg-surface-card border border-divider',
  outlined: 'bg-surface-card border border-secondary-200 dark:border-surface-overlay',
  filled: 'bg-secondary-50 dark:bg-surface',
};

const paddingStyles: Record<CardPadding, string> = {
  none: '',
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-6',
};

// Card is View-backed, so raw primitive children can crash on react-native-web.
// While flattening fragments, remap keys so nested fragment children stay unique.
function sanitizeViewChildren(children: React.ReactNode, path = 'card'): React.ReactNode[] {
  return React.Children.toArray(children).flatMap((child, index) => {
    const childPath = `${path}.${index}`;

    if (typeof child === 'string') {
      return [];
    }

    if (typeof child === 'number') {
      return [];
    }

    if (
      React.isValidElement<{ children?: React.ReactNode }>(child) &&
      child.type === React.Fragment
    ) {
      return sanitizeViewChildren(child.props.children, childPath);
    }

    if (React.isValidElement(child)) {
      const childKey =
        child.key === null || child.key === undefined
          ? childPath
          : `${childPath}:${String(child.key)}`;

      return [React.cloneElement(child, { key: childKey })];
    }

    return [child];
  });
}

export function Card({
  children,
  variant = 'elevated',
  padding = 'md',
  onPress,
  className = '',
  accessibilityLabel,
  accessibilityHint,
  ...props
}: CardProps) {
  const safeChildren = sanitizeViewChildren(children);

  const cardContent = (
    <View
      className={`rounded-md ${variantStyles[variant]} ${paddingStyles[padding]} ${className}`}
      {...props}
    >
      {safeChildren}
    </View>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        className="active:opacity-80"
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityHint={accessibilityHint ?? '탭하면 상세 정보를 볼 수 있습니다'}
      >
        {cardContent}
      </Pressable>
    );
  }

  return cardContent;
}
