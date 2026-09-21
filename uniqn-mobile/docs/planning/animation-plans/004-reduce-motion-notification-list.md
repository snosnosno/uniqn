# 004 — 알림 리스트 컴포넌트에 reduceMotion 적용

- **Status**: TODO
- **Commit**: d824729
- **Severity**: HIGH
- **Category**: 접근성 (impeccable-design.md §8) — 알림 리스트는 "tens of times/day" 빈도(AUDIT.md §1)라 파급이 큼
- **Estimated scope**: 2 files (NotificationBadge는 opacity 전용이라 이 계획 범위 아님 — 근거는 아래 참고)

## Problem

**1) `src/components/notifications/NotificationItem.tsx:135-139`**

```tsx
if (animated) {
  return (
    <Animated.View
      entering={FadeInRight.duration(200)}
      exiting={FadeOutLeft.duration(200)}
      layout={Layout.duration(200)}
    >
      {content}
    </Animated.View>
  );
}
```

`FadeInRight`/`FadeOutLeft`는 opacity + translateX 복합 애니메이션이다. reduceMotion 분기가 없어 좌우 이동이 항상 재생된다.

**2) `src/components/notifications/NotificationGroupItem.tsx:79-82`**

```tsx
<Animated.View
  entering={FadeIn.duration(200)}
  exiting={FadeOut.duration(200)}
  layout={Layout.duration(200)}
  className={`...`}
>
```

`FadeIn`/`FadeOut` 자체는 opacity 전용이지만 `layout={Layout.duration(200)}`은 펼침/접힘 시 형제 요소 위치가 바뀌는 layout transition — 이동을 유발하므로 reduceMotion 대상.

**참고 — NotificationBadge.tsx는 이번 계획에서 제외**: `src/components/notifications/NotificationBadge.tsx:69-71`은 `entering={FadeIn.duration(200)} exiting={FadeOut.duration(200)}`만 있고 `layout` prop이 없다 — 순수 opacity 전용이며, §8 "reduce motion이면... opacity 페이드만 유지"가 명시적으로 허용하는 케이스라 접근성 관점에서는 이미 정책 준수 상태다(토큰 미소비 문제는 계획 007에서 다룸).

## Target

**1) NotificationItem.tsx**

```tsx
import { useReduceMotion } from '@/hooks/useReduceMotion';

// 컴포넌트 본문 상단
const reduceMotion = useReduceMotion();

// 라인 135-139 대체
if (animated) {
  return (
    <Animated.View
      entering={reduceMotion ? FadeIn.duration(200) : FadeInRight.duration(200)}
      exiting={reduceMotion ? FadeOut.duration(150) : FadeOutLeft.duration(150)}
      layout={reduceMotion ? undefined : Layout.duration(200)}
    >
      {content}
    </Animated.View>
  );
}
```

(exiting duration 150은 계획 006에서 다루는 75% 규칙을 여기서 함께 반영 — 이동 없는 순수 fade로 대체하되 exit는 enter의 75%)

**2) NotificationGroupItem.tsx**

```tsx
import { useReduceMotion } from '@/hooks/useReduceMotion';

// 컴포넌트 본문 상단
const reduceMotion = useReduceMotion();

<Animated.View
  entering={FadeIn.duration(200)}
  exiting={FadeOut.duration(150)}
  layout={reduceMotion ? undefined : Layout.duration(200)}
  className={`...`}
>
```

(`entering`/`exiting`은 이미 순수 opacity라 조건부 불필요 — `layout`만 reduceMotion 시 제거. duration 150은 계획 006과 동기화)

## Repo conventions to follow

- 직접 경로 import만: `@/hooks/useReduceMotion`.
- `import { FadeIn, FadeOut, ... } from 'react-native-reanimated'` 등 기존 import에 `FadeIn`/`FadeOut`이 이미 있는지 먼저 확인(NotificationItem.tsx는 `FadeInRight`/`FadeOutLeft`만 import했을 수 있음 — `FadeIn`/`FadeOut` 추가 필요).

## Steps

1. `NotificationItem.tsx`: reanimated import 목록에 `FadeIn`, `FadeOut`이 없다면 추가. `useReduceMotion` import 추가. 컴포넌트 본문에 `const reduceMotion = useReduceMotion();` 추가. 135-139 라인을 Target대로 교체.
2. `NotificationGroupItem.tsx`: `useReduceMotion` import 추가. 컴포넌트 본문에 `const reduceMotion = useReduceMotion();` 추가. 79-82 라인의 `layout` prop만 `reduceMotion ? undefined : Layout.duration(200)`로 교체하고 `exiting`의 duration을 150으로 변경.

## Boundaries

- `NotificationBadge.tsx`는 건드리지 않는다(Problem 절 참고 — 이미 정책 준수, exit duration만 계획 006에서 별도 처리).
- exit duration을 150으로 바꾸는 것은 계획 006(75% 규칙)의 값과 동일하다 — 이 계획과 006을 별개 PR로 나눠 실행할 경우, 어느 쪽이 먼저 적용되든 최종 코드는 동일해야 한다(둘 다 이 값을 목표로 함). 두 계획을 같은 실행자가 순서대로 적용한다면 006의 해당 항목은 자동으로 충족된다.
- MOTION_EASING/MOTION_DURATION 토큰 적용은 계획 007에서 다룬다 — 여기서는 리터럴 값(150/200)을 그대로 쓴다.
- 코드가 위 인용과 다르면 멈추고 보고한다.

## Verification

- **Mechanical**: `npx tsc --noEmit`, `npx eslint src/components/notifications/NotificationItem.tsx src/components/notifications/NotificationGroupItem.tsx`, `jest src/components/notifications`.
- **Feel check**: "동작 줄이기" ON 상태에서 알림 목록 화면을 열어:
  - 알림 항목이 좌우로 슬라이드하지 않고 제자리 페이드로만 나타나는지.
  - 그룹 알림을 펼치거나 접을 때 다른 항목들이 이동(layout shift)하지 않는지.
  - OFF 상태에서는 기존처럼 좌우 슬라이드 + layout transition이 재생되는지(회귀 없음).
- **Done when**: 두 파일 모두 Target과 일치, ON/OFF 양쪽 feel-check 통과.
