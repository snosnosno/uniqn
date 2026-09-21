# 009 — Accordion 셰브론 회전의 죽은 CSS 클래스 정리 + 실제 애니메이션 적용

- **Status**: TODO
- **Commit**: d824729
- **Severity**: MEDIUM
- **Category**: 정확성 버그 (물리성/원점 겸 해당)
- **Estimated scope**: 1 file

## Problem

`src/components/ui/Accordion.tsx:104-109`

```tsx
<View
  className={`ml-2 transition-transform ${isExpanded ? 'rotate-180' : 'rotate-0'}`}
  style={{ transform: [{ rotate: isExpanded ? '180deg' : '0deg' }] }}
>
  <ChevronDownIcon size={20} color={SECONDARY_PALETTE[400]} />
</View>
```

NativeWind의 `transition-transform`은 **웹 전용**으로만 CSS `transition`을 생성하는 클래스다(react-native-web 빌드에서만 의미가 있고, 순수 네이티브 iOS/Android에서는 아무 효과가 없다). 실제 회전은 인라인 `style`의 `transform: [{ rotate }]`가 담당하는데, 이 값은 `isExpanded`가 바뀔 때 React가 그냥 새 스타일로 리렌더할 뿐 애니메이션 트윈이 없다 — 네이티브에서는 셰브론이 180도 즉시 스냅 전환된다. 코드만 보면 "애니메이션되는 것처럼" 보이지만 실기기에서는 아니다.

## Target

`react-native-reanimated`의 `useAnimatedStyle` + `withTiming`으로 실제 회전 애니메이션을 적용한다. 계획 002에서 이미 `useReduceMotion`을 이 컴포넌트에 추가했다는 전제로 작성:

```tsx
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { MOTION_EASING, MOTION_DURATION } from '@/constants/motion';

// AccordionItem 컴포넌트 본문 (reduceMotion은 계획 002에서 이미 추가됨)
const rotation = useSharedValue(isExpanded ? 180 : 0);

useEffect(() => {
  rotation.value = reduceMotion
    ? isExpanded ? 180 : 0
    : withTiming(isExpanded ? 180 : 0, { duration: MOTION_DURATION.fast, easing: MOTION_EASING.enter });
}, [isExpanded, reduceMotion, rotation]);

const chevronAnimatedStyle = useAnimatedStyle(() => ({
  transform: [{ rotate: `${rotation.value}deg` }],
}));

// JSX
<Animated.View className="ml-2" style={chevronAnimatedStyle}>
  <ChevronDownIcon size={20} color={SECONDARY_PALETTE[400]} />
</Animated.View>
```

`transition-transform` 클래스와 인라인 `style={{ transform: ... }}`(정적 버전)는 모두 제거한다.

## Repo conventions to follow

- `@/constants/motion` 직접 경로로 `MOTION_EASING`/`MOTION_DURATION` 소비(계획 007과 같은 원칙). `MOTION_DURATION.fast`(150ms)는 AUDIT.md 듀레이션표의 "즉시 피드백/버튼 누름" 구간에 해당하며, 셰브론 회전처럼 작은 UI 요소의 상태 표시에 적합.
- 파일 상단에 이미 `react-native-reanimated`를 import하고 있는지 확인(Accordion.tsx는 현재 `LayoutAnimation`만 쓰므로 신규 import일 가능성이 높다 — 이 저장소는 이미 `reanimated`를 의존성으로 갖고 있으므로 새 패키지 설치는 아니다).

## Steps

1. 계획 002가 이 파일에 먼저 적용되어 `reduceMotion` 변수가 이미 있는지 확인(없다면 이 계획 실행 전에 002부터 적용하거나, 이 계획에서 `useReduceMotion`을 함께 추가).
2. `react-native-reanimated`에서 `Animated`, `useAnimatedStyle`, `useSharedValue`, `withTiming` import(이미 일부 import돼 있다면 병합). `@/constants/motion`에서 `MOTION_EASING`, `MOTION_DURATION` import.
3. `AccordionItem` 컴포넌트 본문에 `useSharedValue`, `useEffect`, `useAnimatedStyle` 정의를 Target대로 추가.
4. 104-109 라인의 `<View className="ml-2 transition-transform ...">`를 `<Animated.View className="ml-2" style={chevronAnimatedStyle}>`로 교체하고 정적 `style={{ transform: ... }}`는 제거.

## Boundaries

- `LayoutAnimation.configureNext(...)` 호출(펼침/접힘 본체)은 건드리지 않는다 — 이 계획은 **셰브론 회전만** 다룬다. 본체 애니메이션 전환은 계획 010(LayoutAnimation→Reanimated 전환) 범위.
- `AccordionGroup`(같은 파일의 다른 export)이 있다면 그쪽은 건드리지 않는다.
- 코드가 위 인용과 다르면 멈추고 보고한다.

## Verification

- **Mechanical**: `npx tsc --noEmit`, `npx eslint src/components/ui/Accordion.tsx`, `jest src/components/ui`.
- **Feel check**: 아코디언을 펼치고 접으며 셰브론이 순간 스냅이 아니라 150ms 동안 부드럽게 회전하는지 슬로모션으로 확인. "동작 줄이기" ON 상태에서는 회전이 즉시 목표 각도로 전환되는지(애니메이션 없음) 확인.
- **Done when**: `transition-transform` 클래스가 파일에서 사라지고, 셰브론이 실제로 트윈 애니메이션되며, reduceMotion 시 즉시 전환된다.
