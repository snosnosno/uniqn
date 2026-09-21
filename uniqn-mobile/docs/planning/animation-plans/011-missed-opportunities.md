# 011 — 놓친 기회 4건: 상태 변화에 전환 모션 추가

- **Status**: TODO
- **Commit**: d824729
- **Severity**: LOW-MEDIUM (additive — 정책 위반 아님, 누락된 다듬기)
- **Category**: 놓친 기회 (AUDIT.md §8)
- **Estimated scope**: 4 files, 서로 독립적인 4개 변경

## Problem & Target (파일별)

### 1) `src/components/workLogEdit/CollapsibleSection.tsx:38-42,70`

```tsx
// 현재 — 애니메이션 전혀 없음
const [expanded, setExpanded] = useState(defaultExpanded);
const handleToggle = useCallback(() => {
  setExpanded((previous) => !previous);
}, []);
// ...
{expanded ? <View className="px-4 pb-4">{children}</View> : null}
```

접기/펼치기 시 콘텐츠가 즉시 마운트/언마운트되어 카드 높이가 순간 점프한다.

**Target**: `Accordion.tsx`(계획 009/010 적용 후)와 동일한 Reanimated 패턴 적용:

```tsx
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';
import { MOTION_DURATION } from '@/constants/motion';
import { useReduceMotion } from '@/hooks/useReduceMotion';

export function CollapsibleSection({ title, summary, defaultExpanded = false, children }: CollapsibleSectionProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const reduceMotion = useReduceMotion();
  const handleToggle = useCallback(() => {
    setExpanded((previous) => !previous);
  }, []);
  const Chevron = expanded ? ChevronUpIcon : ChevronDownIcon;

  return (
    <Animated.View
      layout={reduceMotion ? undefined : LinearTransition.duration(MOTION_DURATION.base)}
      className="mb-3 overflow-hidden rounded-lg border border-secondary-200 bg-surface-card dark:border-surface-overlay dark:bg-surface"
    >
      {/* ...Pressable 헤더 동일... */}
      {expanded ? (
        <Animated.View
          entering={reduceMotion ? undefined : FadeIn.duration(MOTION_DURATION.base)}
          exiting={reduceMotion ? undefined : FadeOut.duration(MOTION_DURATION.fast)}
          className="px-4 pb-4"
        >
          {children}
        </Animated.View>
      ) : null}
    </Animated.View>
  );
}
```

### 2) `src/components/board/BoardImageViewerOverlay.tsx:84-92,113-121`

```tsx
// 현재 — 이전/다음 전환 시 즉시 스냅
<Pressable onPress={() => onChangeIndex(currentIndex - 1)} ...>
<Pressable onPress={() => onChangeIndex(currentIndex + 1)} ...>
```

**Target**: 이미지 자체를 `key={currentIndex}`로 감싼 `Animated.View`에 방향성 fade를 추가(전체 슬라이드 캐러셀로 재작성하지 않고 최소 변경):

```tsx
import Animated, { FadeIn } from 'react-native-reanimated';

// 이미지 렌더 부분(정확한 JSX 구조는 실제 코드 확인 후 적용)
<Animated.View key={currentIndex} entering={FadeIn.duration(200)} style={{ flex: 1 }}>
  {/* 기존 <Image> ... */}
</Animated.View>
```

> 이 항목은 실제 이미지 렌더 JSX 구조를 먼저 읽고, `key` prop을 이미지 컨테이너에 추가할 수 있는 위치를 찾아 적용한다(현재 인용은 버튼 핸들러 부분만 확인된 상태 — 실행자는 이미지 렌더 블록을 먼저 Read로 확인).

### 3) `src/components/employer/order-sheet/ScheduleConditionCard.tsx:106-113`

```tsx
// 현재 — layout만 있고 entering/exiting 없음
<Animated.View
  layout={reduceMotion ? undefined : LinearTransition.duration(MOTION_DURATION.base)}
  onLayout={(e) => onLayoutY?.(index, e.nativeEvent.layout.y)}
  className={highlighted ? 'bg-primary-50 dark:bg-primary-900/20' : ''}
  testID={`order-sheet-card-${index}`}
>
```

카드 병합/분리 시 형제는 리플로우되지만 삭제/신규 카드 자체는 순간이동한다.

**Target**:

```tsx
import { FadeIn, FadeOut } from 'react-native-reanimated'; // LinearTransition과 함께 이미 import된 모듈에 추가

<Animated.View
  layout={reduceMotion ? undefined : LinearTransition.duration(MOTION_DURATION.base)}
  entering={reduceMotion ? undefined : FadeIn.duration(MOTION_DURATION.base)}
  exiting={reduceMotion ? undefined : FadeOut.duration(MOTION_DURATION.fast)}
  onLayout={(e) => onLayoutY?.(index, e.nativeEvent.layout.y)}
  className={highlighted ? 'bg-primary-50 dark:bg-primary-900/20' : ''}
  testID={`order-sheet-card-${index}`}
>
```

### 4) `src/components/tutorial/TutorialOverlay.tsx:279-285`

```tsx
// 현재 — exiting 없음, key 변경 시 이전 텍스트 즉시 사라짐
<Animated.Text
  key={isLastPage ? 'cta' : 'next'}
  entering={FadeIn.duration(200)}
  className="text-content-onGold font-sans-semibold text-base"
>
```

**Target**:

```tsx
<Animated.Text
  key={isLastPage ? 'cta' : 'next'}
  entering={FadeIn.duration(200)}
  exiting={FadeOut.duration(150)}
  className="text-content-onGold font-sans-semibold text-base"
>
```

## Repo conventions to follow

- `MOTION_DURATION.base`(200)/`fast`(150) 토큰, `@/constants/motion` 직접 경로 — 계획 007과 동일 원칙.
- `useReduceMotion`은 `@/hooks/useReduceMotion` 직접 경로.
- `ScheduleConditionCard.tsx`는 이미 `useReduceMotion`과 `LinearTransition`을 쓰고 있으므로(계획 파일 상단 Problem 절 참고) 이 파일은 항목 3만 추가하면 되고 새 훅 도입이 필요 없다.

## Steps

1. `CollapsibleSection.tsx`: `react-native-reanimated`(`Animated`, `FadeIn`, `FadeOut`, `LinearTransition`), `@/constants/motion`(`MOTION_DURATION`), `@/hooks/useReduceMotion` import 추가. 컴포넌트 본문에 `const reduceMotion = useReduceMotion();` 추가. 최상위 `View`를 `Animated.View`+`layout`으로, 조건부 렌더 블록을 `Animated.View`+`entering`/`exiting`으로 교체.
2. `BoardImageViewerOverlay.tsx`: 먼저 파일 전체를 Read해 이미지 렌더 JSX의 정확한 구조를 확인한다. 이미지를 감싼 컨테이너(또는 이미지 자체를 감싸는 새 `Animated.View`)에 `key={currentIndex}`와 `entering={FadeIn.duration(200)}`을 추가.
3. `ScheduleConditionCard.tsx`: 기존 `react-native-reanimated` import에 `FadeIn`, `FadeOut` 추가(이미 있다면 생략). `Animated.View`(라인 106-113)에 `entering`/`exiting` prop 추가.
4. `TutorialOverlay.tsx`: 기존 `FadeIn` import에 `FadeOut` 추가. 279-285 라인의 `Animated.Text`에 `exiting={FadeOut.duration(150)}` 추가.

## Boundaries

- 4개 항목은 서로 독립적 — 하나만 선택해 적용해도 무방하다(전부 적용이 기본 권장이지만 개별 커밋으로 나눠도 됨).
- `BoardImageViewerOverlay.tsx` 항목은 실제 JSX 구조 확인 없이 인용된 코드가 버튼 핸들러뿐이므로, 실행자가 반드시 파일을 먼저 읽고 이미지 렌더 부분의 실제 구조에 맞춰 적용 위치를 정한다 — 구조가 이 계획의 가정과 크게 다르면 멈추고 보고한다.
- 새 캐러셀/페이저 라이브러리를 추가하지 않는다 — 기존 `onChangeIndex` 상태 전환 로직은 그대로 두고 시각 전환만 추가한다.
- 코드가 위 인용과 다르면 해당 항목만 멈추고 보고한 뒤 나머지 항목은 계속 진행한다.

## Verification

- **Mechanical**: `npx tsc --noEmit`, `npx eslint src/components/workLogEdit/CollapsibleSection.tsx src/components/board/BoardImageViewerOverlay.tsx src/components/employer/order-sheet/ScheduleConditionCard.tsx src/components/tutorial/TutorialOverlay.tsx`, `jest src/components/workLogEdit src/components/board src/components/employer src/components/tutorial`.
- **Feel check**:
  - CollapsibleSection: 접기/펼치기 시 높이가 점프 없이 부드럽게 전환되는지.
  - BoardImageViewerOverlay: 이전/다음 이미지 전환 시 즉시 스냅이 아니라 짧은 페이드가 있는지.
  - ScheduleConditionCard: 주문서에서 날짜 조건을 삭제하거나 카드가 갈라질 때, 사라지는/나타나는 카드 자체도 순간이동이 아니라 페이드로 처리되는지.
  - TutorialOverlay: 마지막 페이지 도달 시 "다음"→CTA 텍스트 전환이 겹치는 크로스페이드로 보이는지(이전 텍스트가 뚝 끊기지 않는지).
- **Done when**: 4개 파일 모두 Target과 일치하고, 각 feel-check 항목이 관찰 가능하다.
