# 004 — 시트류 travel 커브 교체 + 75% 퇴장 규칙 정렬

- **Status**: DONE (2026-07-17, quality EXIT 0 · ui jest 16스위트 127통과 · fable 리뷰 APPROVE. LOW 관찰: RNModal visible 직결+animationType="none" 구조라 네이티브 퇴장 애니메이션이 안 보일 수 있음 — 선재 구조, 실기기 QA 시 참고)
- **Commit**: c0c6113e5
- **Severity**: HIGH
- **Category**: 이징·지속시간 (Easing & duration)
- **Estimated scope**: 2파일 (SheetModal.tsx, Modal.tsx bottom 분기), 소규모
- **Depends on**: 001 (MOTION_EASING.sheet / MOTION_DURATION 토큰)

## Problem

시트류는 **화면 전체 높이**(SheetModal: `windowHeight`, Modal bottom: 100px)를 이동하는데 커브가 약한 `Easing.out(Easing.ease)`라 붕 뜬(floaty) 느낌을 준다. 긴 이동 거리일수록 초반 속도가 실린 강한 커브가 필요하다. 또 SheetModal 퇴장 250ms는 75% 규칙(300×0.75=225ms) 초과, Modal bottom 퇴장 200ms는 미달이다.

```ts
// uniqn-mobile/src/components/ui/SheetModal.tsx:261-273 — 현재
if (visible) {
  fadeOpacity.value = withTiming(1, { duration: 200, easing: Easing.ease });
  translateY.value = withTiming(0, {
    duration: 300,
    easing: Easing.out(Easing.ease),
  });
} else {
  fadeOpacity.value = withTiming(0, { duration: 200, easing: Easing.ease });
  translateY.value = withTiming(windowHeight, {
    duration: 250,
    easing: Easing.in(Easing.ease),
  });
}
```

```ts
// uniqn-mobile/src/components/ui/Modal.tsx:307-312, 319-324 — 현재 (bottom 분기)
translateY.value = withTiming(0, {
  duration: 300,
  easing: Easing.out(Easing.ease),
});
...
translateY.value = withTiming(100, {
  duration: 200,
  easing: Easing.in(Easing.ease),
});
```

## Target

입장 travel = iOS 드로어 커브 300ms, 퇴장 travel = 225ms `exitTravel`. 페이드는 토큰화만(값 불변).

```ts
// SheetModal.tsx — 목표
import { MOTION_EASING, MOTION_DURATION } from '@/constants/animation';

if (visible) {
  fadeOpacity.value = withTiming(1, { duration: MOTION_DURATION.base, easing: MOTION_EASING.fade });
  translateY.value = withTiming(0, {
    duration: MOTION_DURATION.sheet,        // 300
    easing: MOTION_EASING.sheet,            // bezier(0.32, 0.72, 0, 1)
  });
} else {
  fadeOpacity.value = withTiming(0, { duration: MOTION_DURATION.base, easing: MOTION_EASING.fade });
  translateY.value = withTiming(windowHeight, {
    duration: MOTION_DURATION.sheetExit,    // 225 (기존 250)
    easing: MOTION_EASING.exitTravel,
  });
}
```

```ts
// Modal.tsx bottom 분기 — 목표
translateY.value = withTiming(0, {
  duration: MOTION_DURATION.sheet,          // 300
  easing: MOTION_EASING.sheet,
});
...
translateY.value = withTiming(100, {
  duration: MOTION_DURATION.sheetExit,      // 225 (기존 200)
  easing: MOTION_EASING.exitTravel,
});
```

Modal center 분기(scale 0.9↔1, `Easing.out(Easing.cubic)` 250ms)는 `MOTION_EASING.enter` + `MOTION_DURATION.emphasized`로 토큰화(001 LoadingOverlay와 동일한 수렴). 퇴장 fade/scale 150ms는 `fast`+`fade`로 토큰화(값 불변).

## Repo conventions to follow

- 토큰 import `@/constants/animation` — 001의 LoadingOverlay 전환부 모방.
- `isFirstRender` 스킵 로직·Keyboard 리스너·백드롭 구조는 불변.

## Steps

1. 001 완료 확인.
2. `SheetModal.tsx`의 네이티브 분기(`NativeSheetModal`) useEffect(251-274행 부근)를 Target대로 교체.
3. `Modal.tsx` useEffect(285-326행 부근)의 bottom·center 분기를 Target대로 교체.
4. `cd uniqn-mobile && npm run quality && npx jest src/components/ui --silent`.

## Boundaries

- `WebSheetModal`(CSS 전환 + 300ms setTimeout)·Modal의 웹 분기는 범위 외.
- `SHEET_DISMISS_ANIMATION_MS`(300)는 iOS 중첩 모달 회피용 **대기 시간**이므로 건드리지 않는다 — 퇴장이 225ms로 줄어도 300ms 대기는 여전히 안전 마진으로 유효.
- reduce motion 분기(003)와 순서 무관하게 적용 가능하나, 둘 다 적용 시 충돌 없는지 diff 확인.
- 드리프트 발견 시 중단·보고.

## Verification

- **Mechanical**: `npm run quality` exit 0 + ui jest 통과.
- **Feel check** (실기기 권장 — 시트는 손맛):
  - 주문서(공고 작성)·시간 피커 등 SheetModal 사용처 열기 → 시트가 **잡아채듯 빠르게 출발해 부드럽게 정착**하는지(붕 뜨는 감 소멸)
  - 닫기 → 이전(250ms)보다 반 박자 경쾌하게 사라지는지, 백드롭 페이드와 어긋나 보이지 않는지
  - duration 임시 ×5 슬로모션: 입장 마지막 10%가 스르륵 정착(오버슈트 0 — bounce 금지 규약)하는지 확인 후 원복.
- **Done when**: 두 파일에 `Easing.out(Easing.ease)`/`Easing.in(Easing.ease)` 리터럴이 남지 않고, quality·jest 통과 + feel check 확인.
