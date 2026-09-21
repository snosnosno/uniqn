# 006 — 퇴장 애니메이션을 "입장 × 75%" 규칙에 맞게 정정

- **Status**: TODO
- **Commit**: d824729
- **Severity**: MEDIUM
- **Category**: 이징/지속시간 (impeccable-design.md §8: "퇴장(exit) = 시작의 75%")
- **Estimated scope**: 2 files (수치만 변경 — 저비용/고임팩트)

## Problem

**1) `src/components/ui/SheetModal.tsx:341-350`**

```tsx
// 입장
translateY.value = withTiming(0, { duration: 300, easing: Easing.out(Easing.ease) });
// 퇴장
translateY.value = withTiming(windowHeight, { duration: 250, easing: Easing.in(Easing.ease) });
```

300 × 0.75 = 225인데 퇴장이 250(83%)으로 하드코딩되어 있다. 참고로 `src/constants/motion.ts`의 `MOTION_DURATION.sheetExit = 225`가 정확히 이 "300의 75%" 값으로 이미 정의되어 있다 — 즉 이 파일이 그 토큰과 다른 값을 쓰고 있는 상태.

**2) `src/components/notifications/NotificationItem.tsx:136-138`, `NotificationGroupItem.tsx:79-82`**

계획 004에서 이미 `exiting` duration을 150으로 바꾸는 작업을 포함했다 — 이 계획은 004가 아직 적용되지 않은 경우를 위한 것이다. 200(입장) × 0.75 = 150.

## Target

**1) SheetModal.tsx** — 하드코딩된 `250`을 `MOTION_DURATION.sheetExit`(225)로 교체하면서 동시에 토큰화(계획 007과 겹치는 부분이지만, 값 자체가 이 계획의 핵심이므로 여기서 함께 처리):

```tsx
import { MOTION_DURATION } from '@/constants/motion';

// 퇴장
translateY.value = withTiming(windowHeight, {
  duration: MOTION_DURATION.sheetExit, // 225 — 입장 300의 75%
  easing: Easing.in(Easing.ease),
});
```

**2) NotificationItem.tsx / NotificationGroupItem.tsx** — 계획 004가 이미 적용됐다면 이 항목은 자동 충족(둘 다 exiting duration을 150으로 목표함). 004 미적용 상태에서 이 계획만 단독 실행할 경우:

```tsx
// NotificationItem.tsx
exiting={FadeOutLeft.duration(150)}
// NotificationGroupItem.tsx
exiting={FadeOut.duration(150)}
```

## Repo conventions to follow

- `src/constants/motion.ts`의 `MOTION_DURATION.sheetExit = 225`가 정확히 SheetModal.tsx의 300ms 입장에 대응하는 75% 값으로 이미 준비되어 있다 — 새 상수를 만들 필요 없이 그대로 가져다 쓴다.
- import는 배럴이 아니라 `@/constants/motion` 직접 경로.

## Steps

1. `SheetModal.tsx`: 상단에 `import { MOTION_DURATION } from '@/constants/motion';` 추가(이미 다른 모션 관련 import가 있다면 그 근처에). 341-350 라인 중 퇴장 블록의 `duration: 250`을 `duration: MOTION_DURATION.sheetExit`로 교체.
2. 계획 004가 아직 적용되지 않았다면: `NotificationItem.tsx`의 `exiting={FadeOutLeft.duration(200)}`을 `exiting={FadeOutLeft.duration(150)}`로, `NotificationGroupItem.tsx`의 `exiting={FadeOut.duration(200)}`을 `exiting={FadeOut.duration(150)}`로 교체. (이미 적용됐다면 이 스텝은 건너뛴다 — 실행 전에 먼저 확인.)

## Boundaries

- SheetModal.tsx의 입장 duration(300), 다른 이징 값은 건드리지 않는다.
- `GroupedScheduleCard.tsx`/`app/(app)/(tabs)/schedule.tsx`/`GroupedDateRequirementDisplay.tsx`의 `LayoutAnimation.Presets.easeInEaseOut` 방향 비대칭 문제는 **이 계획에서 다루지 않는다** — `LayoutAnimation.Presets`는 RN 내장 프리셋이라 입장/퇴장 duration을 개별 지정할 수 없고, 커스텀 `LayoutAnimation.create()`로 바꿔야 하는데 이는 계획 010(LayoutAnimation→Reanimated 전환)에서 함께 처리하는 것이 효율적이다. 이 계획에서 어설프게 손대면 010과 충돌한다.
- 코드가 위 인용과 다르면(특히 004가 이미 적용됐는지 여부) 멈추고 실제 상태를 보고한 뒤 진행한다.

## Verification

- **Mechanical**: `npm run type-check`, `npx eslint src/components/ui/SheetModal.tsx src/components/notifications/NotificationItem.tsx src/components/notifications/NotificationGroupItem.tsx`, `npx jest src/components/ui src/components/notifications`(디렉터리 단위). PR 전 `npm run quality`.
- **Feel check**: 바텀시트를 열고 닫아, 닫힘 애니메이션이 열림보다 눈에 띄게 빠르게(하지만 급작스럽지 않게) 느껴지는지 슬로모션으로 확인. Chrome/RN DevTools의 애니메이션 패널 또는 화면 녹화 0.25배속으로 225ms가 실제 적용됐는지 프레임 카운트로 대략 확인(60fps 기준 약 13-14프레임).
- **Done when**: SheetModal.tsx가 `MOTION_DURATION.sheetExit`를 참조하고, 값이 225로 렌더링된다.
