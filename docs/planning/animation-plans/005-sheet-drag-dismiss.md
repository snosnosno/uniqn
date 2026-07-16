# 005 — SheetModal 드래그 dismiss (제스처 + 속도 이양)

- **Status**: IMPLEMENTED(실기기 QA 대기) (2026-07-17, quality EXIT 0 · ui jest 16스위트 127통과 · SDD 리뷰 Approved(opus 폴백 — fable 529 과부하). Minor 관찰 3: panGesture 미메모화(안전 방향)·withSpring velocity 이양 큰 경우 단일 오버슈트 물리적 가능(스펙 값 준수, 실기기서 튐 관찰 시 튜닝 회부)·입장 백드롭 full 도달이 300ms 슬라이드 추종(스펙 공식의 결과). 임계값 400px/s·25%는 실기기 튜닝 대상)
- **Commit**: c0c6113e5
- **Severity**: 기회 (Missed opportunity — 추가적 개선)
- **Category**: 중단가능성·제스처 (Interruptibility)
- **Estimated scope**: 1파일 (SheetModal.tsx 네이티브 분기), 중규모
- **Depends on**: 001 (토큰), 004 (퇴장 커브·225ms 정렬)

## Problem

`SheetModal`(주문서·시간 피커 등 employer 핵심 플로우)은 백드롭 탭/닫기 버튼으로만 닫힌다. iOS 시트 관례인 **끌어내려 닫기**가 없어 조작감이 정적이고, `react-native-gesture-handler 2.30`이 이미 설치되어 있음에도 미활용이다.

```tsx
// uniqn-mobile/src/components/ui/SheetModal.tsx:336-352 — 현재 헤더 (제스처 없음)
<View className="flex-row items-center justify-between px-4 py-4 border-b border-divider">
  <Text className="text-lg font-display-semibold text-content-primary dark:text-off-white">
    {title}
  </Text>
  {showCloseButton && ( /* 닫기 버튼 */ )}
</View>
```

## Target

**헤더 영역 한정** Pan 제스처(내부 ScrollView와의 스크롤 충돌 회피):

- 드래그 중: 손가락과 1:1 추적(`translateY = translationY`), 위로는 러버밴드 저항.
- 놓을 때: `velocityY > 400`(px/s) **또는** `translationY > windowHeight * 0.25` → dismiss. 아니면 스프링 복귀(속도 이양, 오버슈트 없음 — bounce 금지 규약).
- 드래그 진행도에 비례해 백드롭 페이드.

```tsx
// SheetModal.tsx NativeSheetModal — 목표 (핵심 코드)
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { runOnJS, interpolate, Extrapolation, withSpring } from 'react-native-reanimated';
import { MOTION_EASING, MOTION_DURATION } from '@/constants/animation';

// 러버밴드: 경계 밖으로 갈수록 저항 증가 (Apple 공식)
function rubberband(overshoot: number, dimension: number, constant = 0.55): number {
  'worklet';
  return (overshoot * dimension * constant) / (dimension + constant * Math.abs(overshoot));
}

const panGesture = Gesture.Pan()
  .enabled(!isLoading)
  .onUpdate((e) => {
    translateY.value =
      e.translationY > 0 ? e.translationY : rubberband(e.translationY, windowHeight);
  })
  .onEnd((e) => {
    const shouldDismiss = e.velocityY > 400 || e.translationY > windowHeight * 0.25;
    if (shouldDismiss) {
      // 현재 위치에서 이어서 퇴장 (presentation value 기준 — 점프 금지)
      fadeOpacity.value = withTiming(0, { duration: MOTION_DURATION.base, easing: MOTION_EASING.fade });
      translateY.value = withTiming(
        windowHeight,
        { duration: MOTION_DURATION.sheetExit, easing: MOTION_EASING.exitTravel },
        (finished) => {
          if (finished) runOnJS(handleRequestClose)();
        }
      );
    } else {
      // 복귀: 릴리즈 속도를 스프링에 이양, 오버슈트 없음
      translateY.value = withSpring(0, {
        dampingRatio: 1,
        duration: 300,
        velocity: e.velocityY,
      });
    }
  });

// 백드롭이 드래그를 따라 옅어짐
const backdropAnimatedStyle = useAnimatedStyle(() => ({
  opacity:
    fadeOpacity.value *
    interpolate(translateY.value, [0, windowHeight], [1, 0], Extrapolation.CLAMP),
}));

// 헤더를 GestureDetector로 감싼다
<GestureDetector gesture={panGesture}>
  <View className="flex-row items-center justify-between px-4 py-4 border-b border-divider">
    ...기존 헤더 내용...
  </View>
</GestureDetector>
```

추가 필수 배선:

- **Android 함정**: RN `Modal` 내부에서 gesture-handler가 동작하려면 Modal 콘텐츠 최상단을 `GestureHandlerRootView`(style={{ flex: 1 }})로 감싸야 한다. `KeyboardAvoidingView` 바깥(RNModal 직계 자식)에 배치.
- dismiss 후 재오픈 대비: `visible`이 true로 바뀌는 기존 useEffect가 `translateY`를 다시 0으로 애니메이트하므로 별도 리셋 불필요 — 단, 제스처 dismiss 시 `handleRequestClose()`가 부모 `visible=false`로 이어지는 계약을 그대로 사용한다(직접 상태 조작 금지).
- 헤더에 시각적 드래그 핸들(상단 중앙 36×4px `rounded-full` 바)을 추가해 어포던스 제공 — 색 `bg-secondary-300 dark:bg-secondary-600`.

## Repo conventions to follow

- worklet 함수는 `'worklet'` 지시어 명시. JS 콜백은 `runOnJS`로만 호출 — `Toast.tsx:79-83`의 완료 콜백 패턴 모방.
- `isLoading` 시 닫기 방지 계약(`handleRequestClose`)을 제스처에도 동일 적용(`.enabled(!isLoading)`).
- 중첩 RN Modal iOS 터치 함정(메모리 `pitfall_nested_rn_modal_touch_dead`) — `overlay` prop 렌더 위치를 바꾸지 말 것.

## Steps

1. 001·004 완료 확인.
2. `GestureHandlerRootView` 배선(RNModal 직계) 추가.
3. 러버밴드 worklet·panGesture·백드롭 interpolate·드래그 핸들 UI를 Target대로 추가.
4. `cd uniqn-mobile && npm run quality && npx jest src/components/ui --silent`.
5. 실기기(Android 우선 — Windows 환경 제약) feel check 수행.

## Boundaries

- `WebSheetModal` 범위 외. `Modal.tsx`도 범위 외(bottom Modal은 100px 이동뿐이라 제스처 대상 아님).
- 콘텐츠 영역(ScrollView)에는 제스처를 달지 않는다 — 스크롤 충돌. 헤더 한정.
- 새 의존성 금지(gesture-handler는 기설치). 드리프트 발견 시 중단·보고.

## Verification

- **Mechanical**: `npm run quality` exit 0 + ui jest 통과.
- **Feel check** (실기기 필수 — 제스처는 시뮬레이터로 판정 불가):
  - 헤더를 잡고 천천히 끌기 → 시트가 손가락에 1:1 밀착(그랩 오프셋 점프 없음)
  - 빠른 플릭(짧은 거리) → 거리 무관하게 dismiss(속도 기준 동작 확인)
  - 중간까지 끌다 놓기 → 릴리즈 속도가 자연스럽게 복귀 스프링으로 이어지는지(벽에 부딪히는 감 없음), 오버슈트/바운스 0
  - 위로 끌기 → 러버밴드 저항(딱딱한 정지 아님)
  - 드래그 중 백드롭이 비례해 옅어지는지
  - `isLoading` 중 드래그 무반응 확인
- **Tuning note** (정직한 불확실성): 속도 임계 400px/s·거리 임계 25%는 시트용 출발값(참고: 토스트 스와이프는 110px/s). 실기기에서 "너무 쉽게/어렵게 닫힘"이면 300~600px/s 범위에서 조정하고 결과를 이 파일에 기록.
- **Done when**: 위 feel check 전 항목 통과 + 기존 백드롭 탭/버튼 닫기 회귀 없음.
