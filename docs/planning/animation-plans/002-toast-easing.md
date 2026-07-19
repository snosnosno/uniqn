# 002 — Toast 입장 이징 강화 (최고빈도 모션)

- **Status**: TODO
- **Commit**: c0c6113e5
- **Severity**: HIGH
- **Category**: 이징·지속시간 (Easing & duration)
- **Estimated scope**: 1파일 (Toast.tsx), 소규모
- **Depends on**: 001 (MOTION_EASING/MOTION_DURATION 토큰)

## Problem

Toast는 모든 성공/에러 액션마다 뜨는 **앱 최고빈도 애니메이션 요소**인데, 입장·퇴장 모두 약한 내장 커브 `Easing.ease`(CSS `ease` 상당)를 쓴다. 입장 첫 프레임의 움직임이 느려 사용자가 가장 주시하는 순간(피드백 도착)에 무딘 인상을 준다. 고빈도 요소일수록 이징은 강한 ease-out이어야 체감 반응성이 산다.

```ts
// uniqn-mobile/src/components/ui/Toast.tsx:76-89 — 현재
const handleDismiss = useCallback(() => {
  // 퇴장 애니메이션
  opacity.value = withTiming(0, { duration: 150, easing: Easing.ease });
  translateY.value = withTiming(-20, { duration: 150, easing: Easing.ease }, (finished) => {
    if (finished) {
      runOnJS(callOnDismiss)(toast.id);
    }
  });
}, [opacity, translateY, callOnDismiss, toast.id]);

useEffect(() => {
  // 입장 애니메이션
  opacity.value = withTiming(1, { duration: 200, easing: Easing.ease });
  translateY.value = withTiming(0, { duration: 200, easing: Easing.ease });
  ...
```

## Target

입장은 강한 ease-out 토큰, 퇴장은 페이드 토큰. duration은 현행 유지(200/150 — 이미 75% 규칙 충족).

```ts
// uniqn-mobile/src/components/ui/Toast.tsx — 목표
import { MOTION_EASING, MOTION_DURATION } from '@/constants/animation';

// 퇴장 (handleDismiss 내부)
opacity.value = withTiming(0, { duration: MOTION_DURATION.fast, easing: MOTION_EASING.fade });
translateY.value = withTiming(-20, { duration: MOTION_DURATION.fast, easing: MOTION_EASING.fade }, (finished) => {
  if (finished) {
    runOnJS(callOnDismiss)(toast.id);
  }
});

// 입장 (useEffect 내부)
opacity.value = withTiming(1, { duration: MOTION_DURATION.base, easing: MOTION_EASING.enter });
translateY.value = withTiming(0, { duration: MOTION_DURATION.base, easing: MOTION_EASING.enter });
```

## Repo conventions to follow

- 토큰 import: `@/constants/animation` (001에서 신설). 001의 LoadingOverlay 전환부를 모범 예로 모방.
- runOnJS 콜백·자동 닫기 타이머 로직은 현행 유지.

## Steps

1. 001 완료 확인 (`MOTION_EASING`가 constants에 존재).
2. `Toast.tsx`의 `handleDismiss`·`useEffect` 블록을 Target대로 교체, import 추가, 하드코딩 `Easing.ease` 제거.
3. `cd uniqn-mobile && npm run quality` + `npx jest src/components/ui --silent` 실행.

## Boundaries

- Toast의 레이아웃·스타일·자동닫기 시간(`toast.duration`)은 변경 금지.
- 액션 버튼(되돌리기) 렌더 로직 불변.
- 코드가 스텝과 다르면(드리프트) 중단하고 보고.

## Verification

- **Mechanical**: `npm run quality` exit 0, ui 대상 jest 통과.
- **Feel check**: 실기기/시뮬레이터에서 `toast.success` 연속 트리거(설정 저장 등 반복) —
  - 입장 첫 프레임부터 즉시 내려오기 시작하는지(뜸 들이지 않는지)
  - 연타 시 애니메이션이 0에서 재시작하지 않고 현재 위치에서 이어지는지(withTiming 재타게팅)
  - duration 임시 ×5 슬로모션으로 정착 구간이 부드러운지 확인 후 원복.
- **Done when**: Toast.tsx에 `Easing.ease` 리터럴이 남아있지 않고, quality·jest 통과.
