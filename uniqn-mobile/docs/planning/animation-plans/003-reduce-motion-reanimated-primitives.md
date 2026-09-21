# 003 — 공용 UI 프리미티브의 Reanimated 애니메이션에 reduceMotion 적용

- **Status**: TODO
- **Commit**: d824729
- **Severity**: HIGH
- **Category**: 접근성 (impeccable-design.md §8)
- **Estimated scope**: 3 files

## Problem

**1) `src/components/ui/SheetModal.tsx` (NativeSheetModal, 라인 301-352)**

```tsx
// 현재 코드 (296-352 발췌)
const fadeOpacity = useSharedValue(0);
const translateY = useSharedValue(isChainEntryRef.current ? 0 : windowHeight);
/* ... */
useEffect(() => {
  /* ... */
  if (visible) {
    if (isChainEntryRef.current) {
      fadeOpacity.value = 1;
      contentOpacity.value = withTiming(1, { duration: 160, easing: Easing.out(Easing.ease) });
      return;
    }
    fadeOpacity.value = withTiming(1, { duration: 200, easing: Easing.ease });
    translateY.value = withTiming(0, { duration: 300, easing: Easing.out(Easing.ease) });
  } else {
    fadeOpacity.value = withTiming(0, { duration: 200, easing: Easing.ease });
    translateY.value = withTiming(windowHeight, { duration: 250, easing: Easing.in(Easing.ease) });
  }
}, [visible, fadeOpacity, translateY, contentOpacity, windowHeight]);
```

이 파일 어디에도 `useReduceMotion` import/호출이 없다(grep 확인). `translateY`(위치 이동)는 순수 opacity가 아니므로 §8 필수 분기 대상.

**2) `src/components/ui/Modal.tsx` (WebModal, 라인 212-230)** — 계획 001에서 커브만 고친 바로 그 진입 애니메이션. `isAnimating` 기반 CSS `transition`이며 `reduceMotion` 참조 없음. 같은 파일의 NativeModal 경로(라인 430 등)는 이미 `reduceMotion` 분기가 있다.

**3) `src/components/ui/CircularProgress.tsx` (라인 105-129)**

```tsx
useEffect(() => {
  if (remainingSeconds <= DANGER_THRESHOLD && remainingSeconds > 0 && !isExpired) {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.1, duration: 500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    animation.start();
    return () => animation.stop();
  } else {
    pulseAnim.setValue(1);
    return undefined;
  }
}, [remainingSeconds, isExpired, pulseAnim]);
```

scale 기반 무한 펄스 루프인데 reduceMotion 체크가 파일 전체에 없다.

## Target

**1) SheetModal.tsx** — `translateY`(이동)는 reduceMotion 시 즉시 목표값, `fadeOpacity`/`contentOpacity`(투명도)는 정책상 유지(§8: "reduce motion이면 transform은 즉시 목표값, opacity 페이드만 유지"):

```tsx
import { useReduceMotion } from '@/hooks/useReduceMotion';

// 컴포넌트 본문
const reduceMotion = useReduceMotion();

// useEffect 내부
if (visible) {
  if (isChainEntryRef.current) {
    fadeOpacity.value = 1;
    contentOpacity.value = withTiming(1, { duration: 160, easing: Easing.out(Easing.ease) });
    return;
  }
  fadeOpacity.value = withTiming(1, { duration: 200, easing: Easing.ease });
  translateY.value = reduceMotion ? 0 : withTiming(0, { duration: 300, easing: Easing.out(Easing.ease) });
} else {
  fadeOpacity.value = withTiming(0, { duration: 200, easing: Easing.ease });
  translateY.value = reduceMotion ? windowHeight : withTiming(windowHeight, { duration: 250, easing: Easing.in(Easing.ease) });
}
```

useEffect deps 배열에 `reduceMotion` 추가.

**2) Modal.tsx WebModal** — `isAnimating` 값 자체는 그대로 쓰되, reduceMotion이면 transform 부분의 transition을 0ms로 만든다:

```tsx
const reduceMotion = useReduceMotion();

// position === 'center' 분기
{
  opacity: isAnimating ? 1 : 0,
  transform: [{ scale: isAnimating ? 1 : 0.9 }],
  // @ts-expect-error - 웹 전용 스타일
  transition: reduceMotion
    ? 'opacity 200ms ease'
    : 'opacity 200ms ease, transform 200ms cubic-bezier(0.23, 1, 0.32, 1)',
  pointerEvents: 'auto' as const,
}
// position !== 'center' 분기도 동일하게 transform transition만 reduceMotion 조건부
```

**3) CircularProgress.tsx** — reduceMotion이면 펄스 루프 자체를 시작하지 않는다(정적 상태 유지, §8 "transform은 즉시 목표값"):

```tsx
import { useReduceMotion } from '@/hooks/useReduceMotion';

// 컴포넌트 본문
const reduceMotion = useReduceMotion();

useEffect(() => {
  if (reduceMotion) {
    pulseAnim.setValue(1);
    return undefined;
  }
  if (remainingSeconds <= DANGER_THRESHOLD && remainingSeconds > 0 && !isExpired) {
    const animation = Animated.loop(/* 기존과 동일 */);
    animation.start();
    return () => animation.stop();
  } else {
    pulseAnim.setValue(1);
    return undefined;
  }
}, [remainingSeconds, isExpired, pulseAnim, reduceMotion]);
```

## Repo conventions to follow

- 직접 경로 import만: `@/hooks/useReduceMotion`.
- SheetModal.tsx는 이미 `useSheetChain`, `useMemo`, `useRef` 등 다양한 훅을 쓰는 복잡한 컴포넌트다 — `useReduceMotion()` 호출은 다른 훅 호출들과 같은 블록(컴포넌트 최상단)에 추가한다.
- Modal.tsx는 WebModal/NativeModal 두 개의 별도 함수 컴포넌트를 한 파일에 정의한다 — `useReduceMotion()`을 **WebModal 함수에만** 추가한다(NativeModal은 이미 `reduceMotion` prop/변수가 있음, 그 이름과 겹치지 않는지 실제 코드에서 확인 후 진행).

## Steps

1. `SheetModal.tsx`: import 추가, `useReduceMotion()` 호출 추가, `useEffect` 내부 `translateY.value` 대입 두 곳(입장/퇴장)을 Target대로 수정, deps 배열에 `reduceMotion` 추가.
2. `Modal.tsx`: WebModal 함수 컴포넌트 본문에 `useReduceMotion()` 추가(이미 동명 변수/prop이 있는지 먼저 확인 — 있다면 이름 충돌 회피 방법을 정하고 진행). `position === 'center'`와 `position !== 'center'` 두 분기의 `transition` 문자열을 Target대로 조건부화.
3. `CircularProgress.tsx`: import 추가, `useReduceMotion()` 호출 추가, `useEffect` 최상단에 `if (reduceMotion) { pulseAnim.setValue(1); return undefined; }` 추가, deps 배열에 `reduceMotion` 추가.

## Boundaries

- 계획 001에서 이미 바뀐 cubic-bezier 값(`cubic-bezier(0.23, 1, 0.32, 1)`)을 전제로 작성됨 — 001을 먼저 적용한 뒤 이 계획을 실행한다. 001이 아직 적용 안 됐다면 기존 값(`cubic-bezier(0.34, 1.56, 0.64, 1)`)을 그대로 두고 조건부 처리만 추가해도 되지만, 두 계획을 같은 PR에 묶는 것을 권장.
- SheetModal.tsx의 `MOTION_EASING`/`MOTION_DURATION` 토큰 미사용 문제는 건드리지 않는다(계획 007).
- Modal.tsx의 NativeModal 경로, SheetModal.tsx의 chain-entry 분기(`isChainEntryRef`) 로직은 변경하지 않는다.
- 코드가 위 인용과 다르면 멈추고 보고한다.

## Verification

- **Mechanical**: `npx tsc --noEmit`, `npx eslint src/components/ui/SheetModal.tsx src/components/ui/Modal.tsx src/components/ui/CircularProgress.tsx`, `jest src/components/ui`.
- **Feel check**: 기기 "동작 줄이기" ON 상태에서:
  - 바텀시트(SheetModal 기반 화면 아무거나)를 열고 닫아 슬라이드 이동 없이 즉시 나타나고 사라지는지, 배경 딤(fade)은 여전히 부드럽게 전환되는지 확인.
  - 가운데 정렬 Modal을 열어 스케일 확대 없이 즉시 나타나는지(opacity 페이드는 유지) 확인.
  - 초 단위 카운트다운이 있는 화면(정산 마감 임박 등 CircularProgress 사용처)에서 위험 구간(마지막 10초 이하) 진입 시 펄스가 재생되지 않고 정적으로 유지되는지 확인.
  - 설정 OFF 상태에서 위 세 가지가 기존처럼 애니메이션되는지(회귀 없음) 확인.
- **Done when**: 3개 파일 모두 Target 코드와 일치하고, ON/OFF 양쪽 feel-check를 통과한다.
