# 008 — DateCalendar/SlotCard의 reduceMotion 로컬 재구현을 공유 훅으로 전환

- **Status**: DONE (2026-09-22)
- **Commit**: d824729
- **Severity**: MEDIUM
- **Category**: 응집성/토큰 (SSOT 위반 — impeccable-design.md §8 "컴포넌트 안에 useState+AccessibilityInfo로 다시 구현하지 말 것")
- **Estimated scope**: 2 files

## Problem

**1) `src/components/jobs/DateCalendar/DateCalendar.tsx:85-99`**

```tsx
// Reduce Motion 감지 (Rule 8)
const reduceMotionRef = useRef(false);
useEffect(() => {
  let mounted = true;
  AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
    if (mounted) reduceMotionRef.current = enabled;
  });
  const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', (enabled: boolean) => {
    reduceMotionRef.current = enabled;
  });
  return () => {
    mounted = false;
    sub?.remove?.();
  };
}, []);
```

`ref` 기반이라 값이 바뀌어도 리렌더를 트리거하지 않는다 — 렌더 시점에 `reduceMotionRef.current`를 읽는 코드가 있다면 stale 값을 볼 수 있다. 또한 공유 훅 `@/hooks/useReduceMotion`이 이미 해결한 "마운트 첫 1~2프레임 재생 후 스냅" 문제(프리페치 캐시)를 이 컴포넌트는 갖고 있지 않다.

**2) `src/components/employer/order-sheet/sheets/SlotCard.tsx:56-65`**

```tsx
// 동작 줄이기 — 프로젝트 기존 패턴(Skeleton.tsx:68, OfflineStatusBar.tsx:69) 승계.
// ON 이면 진입/종료 애니메이션 없이 즉시 전환한다.
const [reduceMotion, setReduceMotion] = useState(false);
useEffect(() => {
  let mounted = true;
  AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
    if (mounted) setReduceMotion(enabled);
  });
  return () => {
    mounted = false;
  };
}, []);
```

이 컴포넌트가 참고했다는 `Skeleton.tsx:68`/`OfflineStatusBar.tsx:69`는 이미 공유 훅(`@/hooks/useReduceMotion`)으로 리팩터링되어 더 이상 이 패턴을 쓰지 않는다 — 주석의 전제가 낡았다. 또한 `reduceMotionChanged` 이벤트 리스너가 없어 앱 사용 중 설정을 바꿔도 이 컴포넌트는 반영되지 않는다(공유 훅은 리스너 포함).

## Target

**1) DateCalendar.tsx**

```tsx
import { useReduceMotion } from '@/hooks/useReduceMotion';

export const DateCalendar = memo(function DateCalendar({ selectedDate, onDateSelect, className = '' }: DateCalendarProps) {
  const [mode, setMode] = useState<Mode>('collapsed');
  const [visibleMonth, setVisibleMonth] = useState<Date>(/* 기존과 동일 */);

  // Reduce Motion 감지 — 공유 훅(SSOT)
  const reduceMotion = useReduceMotion();

  /* 이하 기존 코드에서 reduceMotionRef.current를 읽던 곳을 reduceMotion으로 교체 */
```

**2) SlotCard.tsx**

```tsx
import { useReduceMotion } from '@/hooks/useReduceMotion';

export function SlotCard({ slot, index, expanded, removable, onExpand, onPressTime, onChangeRoles, onRemove }: SlotCardProps) {
  const reduceMotion = useReduceMotion();

  /* 기존 useState/useEffect 블록 삭제 */
```

## Repo conventions to follow

- 직접 경로 import만: `@/hooks/useReduceMotion`.
- 공유 훅은 `useState` 기반이라 리렌더를 트리거한다 — DateCalendar.tsx가 기존에 `.current`로 참조하던 모든 위치를 훅 반환값(`reduceMotion`)으로 바꿔야 한다. `.current` 참조가 여러 곳이면 전부 찾아 교체.

## Steps

1. `DateCalendar.tsx`: `AccessibilityInfo` import가 이 용도로만 쓰였다면 제거(다른 용도로도 쓰이는지 먼저 grep 확인). `useReduceMotion` import 추가. 85-99 라인의 `reduceMotionRef`/`useEffect` 블록 전체를 삭제하고 `const reduceMotion = useReduceMotion();`로 교체. 파일 내 `reduceMotionRef.current`를 참조하는 모든 위치를 `reduceMotion`으로 교체(grep으로 전체 위치 확인 후 진행).
2. `SlotCard.tsx`: `AccessibilityInfo`/`useState`/`useEffect` import가 이 용도로만 쓰였다면 정리(다른 용도 사용 여부 확인). `useReduceMotion` import 추가. 56-65 라인의 `useState`/`useEffect` 블록 전체를 삭제하고 `const reduceMotion = useReduceMotion();`로 교체. 주석("Skeleton.tsx:68, OfflineStatusBar.tsx:69 승계")도 함께 정리(낡은 참조이므로 삭제하거나 "공유 훅 사용"으로 갱신).

## Boundaries

- 두 파일의 애니메이션 로직 자체(FadeIn/FadeOut 등)는 변경하지 않는다 — reduceMotion 값의 **출처**만 바꾼다.
- `AccessibilityInfo`/`useState`/`useEffect` import를 제거하기 전, 같은 파일 내 다른 용도로 쓰이고 있지 않은지 반드시 확인한다(무단 제거 시 컴파일 에러).
- 코드가 위 인용과 다르면 멈추고 보고한다.

## Verification

- **Mechanical**: `npm run type-check`, `npx eslint src/components/jobs/DateCalendar/DateCalendar.tsx src/components/employer/order-sheet/sheets/SlotCard.tsx`, `npx jest src/components/jobs src/components/employer`(디렉터리 단위). PR 전 `npm run quality`.
- **Feel check**: "동작 줄이기"를 앱 실행 **중에** 켜고 끄면서(재시작 없이) DateCalendar와 SlotCard의 애니메이션이 실시간으로 반영되는지 확인 — 이전 SlotCard는 마운트 시점에만 값을 읽었으므로 이 부분이 실질적 개선점.
- **Done when**: 두 파일 모두 로컬 `AccessibilityInfo` 재구현이 사라지고 공유 훅만 참조하며, 런타임 설정 변경에 반응한다.
