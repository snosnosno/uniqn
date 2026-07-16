# 001 — 모션 토큰 신설: MOTION_EASING · MOTION_DURATION

- **Status**: DONE (2026-07-17, quality EXIT 0 · ui jest 16스위트 127통과 · fable 리뷰 APPROVE)
- **Commit**: c0c6113e5
- **Severity**: HIGH
- **Category**: 응집·토큰 (Cohesion & tokens)
- **Estimated scope**: 2파일 (constants 확장 + LoadingOverlay 소비 전환), 소규모

## Problem

프로젝트 규약(`.claude/rules/impeccable-design.md` 룰 8)은 권장 커브 `Easing.bezier(0.25, 1, 0.5, 1)`을 명시하지만, 코드베이스 24개 모션 파일 중 이 커브를 쓰는 곳은 **0개**다. 모든 컴포넌트가 `Easing.ease`·duration 값을 손으로 하드코딩해 화면마다 질감이 미묘하게 다르고, 커브 개선이 전파될 경로가 없다.

```ts
// uniqn-mobile/src/components/ui/LoadingOverlay.tsx:127-147 — 현재
if (visible) {
  animatedOpacity.value = withTiming(1, {
    duration: 200,
    easing: Easing.ease,
  });
  animatedScale.value = withTiming(1, {
    duration: 250,
    easing: Easing.out(Easing.cubic),
  });
} else {
  animatedOpacity.value = withTiming(0, {
    duration: 150,
    easing: Easing.ease,
  });
  animatedScale.value = withTiming(0.9, {
    duration: 150,
    easing: Easing.ease,
  });
}
```

같은 패턴이 `Toast.tsx:78-89`, `Modal.tsx:300-323`, `SheetModal.tsx:262-272`에도 각자 다른 값으로 존재한다(각각 002·004 계획이 수정).

## Target

`uniqn-mobile/src/constants/animation.ts`(기존 파일 — `SHEET_DISMISS_ANIMATION_MS` 보유)를 아래로 **확장**한다. 새 파일을 만들지 말 것.

```ts
// uniqn-mobile/src/constants/animation.ts — 기존 SHEET_DISMISS_ANIMATION_MS 아래에 추가
import { Easing } from 'react-native-reanimated';

/**
 * 공용 모션 이징 토큰 (impeccable 룰 8).
 * 컴포넌트에서 Easing.* 를 직접 쓰지 말고 이 토큰을 소비한다.
 */
export const MOTION_EASING = {
  /** 입장·상태변경 기본 — 강한 ease-out (cubic-bezier(0.25, 1, 0.5, 1)) */
  enter: Easing.bezier(0.25, 1, 0.5, 1),
  /** 시트/드로어 travel — iOS 드로어 커브 (cubic-bezier(0.32, 0.72, 0, 1)) */
  sheet: Easing.bezier(0.32, 0.72, 0, 1),
  /** opacity 페이드 전용 (백드롭·크로스페이드) */
  fade: Easing.ease,
  /** 화면 밖 퇴장 travel — 가속 (룰 25의 exit ease-in 관례) */
  exitTravel: Easing.in(Easing.ease),
} as const;

/** 공용 모션 duration 토큰 (ms). 퇴장 = 입장 × 0.75 규칙(룰 8). */
export const MOTION_DURATION = {
  /** 퇴장·즉시 피드백 */
  fast: 150,
  /** 토스트·페이드 입장 */
  base: 200,
  /** 시트 퇴장 (= sheet 300 × 0.75) */
  sheetExit: 225,
  /** 모달 스케일 입장 */
  emphasized: 250,
  /** 시트 travel 입장 */
  sheet: 300,
} as const;
```

LoadingOverlay는 이 계획에서 첫 소비처로 전환한다:

```ts
// uniqn-mobile/src/components/ui/LoadingOverlay.tsx — 목표
import { MOTION_EASING, MOTION_DURATION } from '@/constants/animation';

if (visible) {
  animatedOpacity.value = withTiming(1, {
    duration: MOTION_DURATION.base,
    easing: MOTION_EASING.fade,
  });
  animatedScale.value = withTiming(1, {
    duration: MOTION_DURATION.emphasized,
    easing: MOTION_EASING.enter,
  });
} else {
  animatedOpacity.value = withTiming(0, {
    duration: MOTION_DURATION.fast,
    easing: MOTION_EASING.fade,
  });
  animatedScale.value = withTiming(0.9, {
    duration: MOTION_DURATION.fast,
    easing: MOTION_EASING.fade,
  });
}
```

주: `Easing.out(Easing.cubic)` → `MOTION_EASING.enter`는 커브가 살짝 강해지는 **의도된 변경**이다(규약 커브로 수렴).

## Repo conventions to follow

- 상수는 `uniqn-mobile/src/constants/` 도메인별 파일 — 이 건은 기존 `animation.ts` 확장. import는 `@/constants/animation` 직접 경로 사용(barrel `index.ts` 수정 불필요).
- 주석은 한글, JSDoc 스타일 — `animation.ts:5-11`의 기존 `SHEET_DISMISS_ANIMATION_MS` 주석을 모방.
- 경로 alias `@/` 필수(시스템 절대경로 금지).

## Steps

1. `uniqn-mobile/src/constants/animation.ts`에 위 Target의 `MOTION_EASING`·`MOTION_DURATION`을 추가 (기존 상수·주석은 그대로 유지).
2. `uniqn-mobile/src/components/ui/LoadingOverlay.tsx`의 `useEffect` 애니메이션 블록(127-147행 부근)을 Target 코드로 교체하고 import 추가.
3. `cd uniqn-mobile && npm run quality` 실행, 에러 0 확인.

## Boundaries

- Toast/Modal/SheetModal은 손대지 않는다(각각 002·004 계획).
- 시각 값 자체(스케일 0.9, duration 숫자)를 바꾸지 않는다 — LoadingOverlay의 easing 수렴 1건만 예외.
- 새 의존성 금지. 커밋 스탬프 이후 코드가 달라져 스텝이 안 맞으면 **중단하고 보고**.

## Verification

- **Mechanical**: `cd uniqn-mobile && npm run quality` → type-check·lint·format 모두 통과(exit 0).
- **Feel check**: 앱 실행 → 로딩이 걸리는 액션(로그인 등) 수행 → LoadingOverlay(`animationType='scale'` 사용처)가 이전과 동급 이상으로 또렷하게 떠오르는지 확인. duration을 임시 ×5 해 슬로모션으로 스케일 정착이 부드러운지 본 뒤 원복.
- **Done when**: quality 통과 + `grep -r "MOTION_EASING" uniqn-mobile/src` 에 constants 정의부와 LoadingOverlay 소비부가 잡힌다.
