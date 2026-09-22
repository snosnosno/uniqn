# 007 — MOTION_EASING/MOTION_DURATION 토큰 소비로 통일

- **Status**: DONE (2026-09-22)
- **Commit**: d824729
- **Severity**: MEDIUM
- **Category**: 응집성/토큰 (impeccable-design.md §8: "컴포넌트에서 Easing.*를 직접 쓰지 말고 이 토큰을 소비한다")
- **Estimated scope**: 4 files (네이티브 Reanimated 사용처만 — CSS 문자열 기반 Modal.tsx WebModal, RN 구버전 Animated 기반 CircularProgress/SlotCard의 특수 케이스는 Boundaries 참고)

## Problem

`src/constants/motion.ts`가 정의한 `MOTION_EASING`(enter/sheet/fade/exitTravel)과 `MOTION_DURATION`(fast/base/sheetExit/emphasized/sheet)을 소비하지 않고 `Easing.*`를 인라인으로 쓰는 곳:

**1) `src/components/ui/SheetModal.tsx:337,340,343,346,349`**

```tsx
contentOpacity.value = withTiming(1, { duration: 160, easing: Easing.out(Easing.ease) });
fadeOpacity.value = withTiming(1, { duration: 200, easing: Easing.ease });
translateY.value = withTiming(0, { duration: 300, easing: Easing.out(Easing.ease) });
// (퇴장 부분은 계획 006에서 이미 MOTION_DURATION.sheetExit로 교체됨을 전제)
fadeOpacity.value = withTiming(0, { duration: 200, easing: Easing.ease });
```

**2) `src/components/ui/Skeleton.tsx:92`**

```tsx
easing: Easing.inOut(Easing.ease),
```

**3) `src/components/ui/OfflineStatusBar.tsx:153`**

```tsx
const easing = show ? Easing.out(Easing.quad) : Easing.in(Easing.quad);
```

(duration은 이미 §25 스펙대로 300/225 — easing만 드리프트)

**4) `src/components/employer/order-sheet/sheets/SlotCard.tsx:87-88`**

```tsx
entering={reduceMotion ? undefined : FadeIn.duration(300)}
exiting={reduceMotion ? undefined : FadeOut.duration(225)}
```

값은 `MOTION_DURATION.sheet`(300)/`sheetExit`(225)와 정확히 일치하지만 토큰을 import하지 않고 리터럴 재입력.

## Target

**1) SheetModal.tsx**

> ⚠️ 160ms(chain-entry 분기)는 `MOTION_DURATION`에 정확히 일치하는 값이 없다(`fast=150`, `base=200`). **리터럴 160을 그대로 유지**하고 easing만 토큰화한다 — 값을 임의로 150/200으로 반올림하지 않는다. 연쇄 시트 진입 타이밍은 `SHEET_CHAIN_SWAP_MS`(180, `@/constants/animation`)와 맞물려 조율된 값이라 반올림이 이음매를 깨뜨릴 수 있다.

```tsx
import { MOTION_EASING, MOTION_DURATION } from '@/constants/motion';

contentOpacity.value = withTiming(1, { duration: 160, easing: MOTION_EASING.fade });
fadeOpacity.value = withTiming(1, { duration: MOTION_DURATION.base, easing: MOTION_EASING.fade }); // 200
translateY.value = withTiming(0, { duration: MOTION_DURATION.sheet, easing: MOTION_EASING.sheet }); // 300 — sheet travel 커브
// 퇴장(계획 006 적용 후)
translateY.value = withTiming(windowHeight, { duration: MOTION_DURATION.sheetExit, easing: MOTION_EASING.exitTravel });
fadeOpacity.value = withTiming(0, { duration: MOTION_DURATION.base, easing: MOTION_EASING.fade }); // 200
```

**2) Skeleton.tsx**

```tsx
import { MOTION_EASING } from '@/constants/motion';

easing: MOTION_EASING.fade, // shimmer는 opacity 전용이므로 fade 토큰이 적합
```

**3) OfflineStatusBar.tsx**

```tsx
import { MOTION_EASING } from '@/constants/motion';

const easing = show ? MOTION_EASING.enter : MOTION_EASING.exitTravel;
```

**4) SlotCard.tsx**

```tsx
import { MOTION_DURATION } from '@/constants/motion';

entering={reduceMotion ? undefined : FadeIn.duration(MOTION_DURATION.sheet)}
exiting={reduceMotion ? undefined : FadeOut.duration(MOTION_DURATION.sheetExit)}
```

## Repo conventions to follow

- **직접 경로 import만**: `@/constants/motion` (배럴 금지 — 순환 참조로 모듈스코프 값이 `undefined`가 되는 함정이 3회 재발했다고 파일 주석에 명시).
- `MOTION_EASING.sheet = Easing.bezier(0.32, 0.72, 0, 1)`은 "시트/드로어 travel"용으로 정의됨 — SheetModal의 진입 이동에 정확히 해당하는 의미론적 토큰.
- `MOTION_EASING.fade`는 "opacity 페이드 전용(백드롭·크로스페이드)" — Skeleton shimmer, backdrop fade에 해당.
- `MOTION_EASING.exitTravel`은 "화면 밖 퇴장 travel"용 — SheetModal 퇴장, OfflineStatusBar hide에 해당.
- `@/constants/animation`(다른 파일)과 절대 혼동하지 않는다 — 그쪽은 네이티브 dismiss 커밋 대기 개념.

## Steps

1. `SheetModal.tsx`: `@/constants/motion`에서 `MOTION_EASING`, `MOTION_DURATION` import 추가. 337,340,343,346,349 라인의 `Easing.*` 호출을 Target대로 교체(160ms 리터럴은 유지, easing만 토큰화; 200/300/225는 각각 `MOTION_DURATION.base`/`sheet`/`sheetExit`로 교체).
2. `Skeleton.tsx`: `MOTION_EASING` import 추가. 92 라인 `Easing.inOut(Easing.ease)`를 `MOTION_EASING.fade`로 교체.
3. `OfflineStatusBar.tsx`: `MOTION_EASING` import 추가. 153 라인을 Target대로 교체.
4. `SlotCard.tsx`: `MOTION_DURATION` import 추가. 87-88 라인의 `300`/`225` 리터럴을 각각 `MOTION_DURATION.sheet`/`MOTION_DURATION.sheetExit`로 교체.

## Boundaries

- **CircularProgress.tsx는 이 계획에서 제외**: RN 구버전 `Animated.timing`(reanimated 아님)을 쓰고 `MOTION_EASING`은 reanimated `Easing`을 재노출한 토큰이라 타입 호환은 되지만, 이 컴포넌트가 구버전 `Animated` API를 쓰는 이유가 별도로 있을 수 있어(계획 003에서 reduceMotion만 다룸) 토큰화는 이번 범위에서 제외하고 후속 판단으로 남긴다.
- Modal.tsx(WebModal)는 CSS 문자열 기반이라 `MOTION_EASING`(JS 객체)을 그대로 넣을 수 없다 — 이 계획 범위 아님(계획 001에서 CSS 값만 직접 수정 완료).
- 계획 006(exit=75%)에서 SheetModal.tsx의 퇴장 duration을 이미 `MOTION_DURATION.sheetExit`로 바꿨다면, 이 계획의 4번 항목 관련 부분은 자동 충족 — 중복 편집 금지, 실제 코드 확인 후 진행.
- 값 자체(duration 숫자)는 바꾸지 않는다 — 토큰 참조로 교체만 한다(160ms처럼 토큰에 없는 값은 리터럴 유지).
- 코드가 위 인용과 다르면 멈추고 보고한다.

## Verification

- **Mechanical**: `npm run type-check`, `npx eslint src/components/ui/SheetModal.tsx src/components/ui/Skeleton.tsx src/components/ui/OfflineStatusBar.tsx src/components/employer/order-sheet/sheets/SlotCard.tsx`, `npx jest src/components/ui src/components/employer`(디렉터리 단위). PR 전 `npm run quality`.
- **Feel check**: 이 계획은 값을 바꾸지 않으므로(160ms 제외 전부 동일 수치) 시각적으로는 **아무것도 달라지지 않아야 한다** — 바텀시트 열기/닫기, 스켈레톤 shimmer, 오프라인 배너 등장/퇴장, 주문서 슬롯 펼침이 이전과 동일하게 보이면 성공. 달라 보인다면 토큰 값이 원래 리터럴과 실제로 일치하는지(`src/constants/motion.ts` 재확인) 검토.
- **Done when**: 4개 파일 모두 `Easing.*` 직접 호출 없이 `MOTION_EASING`/`MOTION_DURATION` 토큰만 참조하며, 시각적 회귀가 없다.
