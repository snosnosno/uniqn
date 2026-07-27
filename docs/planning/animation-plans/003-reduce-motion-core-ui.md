# 003 — 코어 UI 4종 Reduce Motion 대응 + 공유 훅 추출

- **Status**: **PARTIAL** (PR #350 `ab097c0fc`) — "코어 4종" 중 실제 반영은 **2종**뿐이다.
  - ✅ 공유 훅 `src/hooks/useReduceMotion.ts` 추출 + Skeleton·OfflineStatusBar 중복 정의 제거.
    단 **`hooks/index.ts` 배럴에는 export 하지 않는다**(배럴 상수 순환 3회 재발) — Target 1의
    "barrel 에 export 추가"는 폐기됐다. 소비처는 `@/hooks/useReduceMotion` 직접 경로.
  - ✅ `Modal.tsx`(NativeModal) · `Toast.tsx` reduce motion 분기.
  - ⏸ `SheetModal.tsx` — 미착수, B 묶음으로 이월(핸드오프 §5).
  - ❌ `LoadingOverlay.tsx` — 대상 소멸(#263 `cbeaad9dd` 에서 삭제).
- **Commit**: c0c6113e5
- **Severity**: HIGH
- **Category**: 접근성 (Accessibility)
- **Estimated scope**: 7파일 (신규 훅 1 + 소비 4 + 중복 제거 2), 중규모

## Problem

프로젝트 규약(impeccable 룰 8)은 `AccessibilityInfo.isReduceMotionEnabled()` 분기를 **필수**로 규정하지만, 코어 UI 4종(`Modal.tsx`, `SheetModal.tsx`, `Toast.tsx`, `LoadingOverlay.tsx`)은 OS의 "동작 줄이기" 설정과 무관하게 transform 애니메이션을 무조건 실행한다. 준수 컴포넌트는 Skeleton·DateCalendar·OfflineStatusBar 3개뿐이며, 그마저 `useReduceMotion` 훅이 `Skeleton.tsx:62-83`과 `OfflineStatusBar.tsx`에 **중복 정의**되어 있다.

```ts
// uniqn-mobile/src/components/ui/Skeleton.tsx:62-83 — 현재 (로컬 중복 훅)
function useReduceMotion(): boolean {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    let mounted = true;

    AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (mounted) setEnabled(value);
    });

    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', (value: boolean) => {
      if (mounted) setEnabled(value);
    });

    return () => {
      mounted = false;
      sub?.remove?.();
    };
  }, []);

  return enabled;
}
```

## Target

1. 위 구현을 **그대로** `uniqn-mobile/src/hooks/useReduceMotion.ts`로 이동(export function으로 변경, JSDoc 한글 주석 포함), `src/hooks/index.ts` barrel에 export 추가.
2. Skeleton·OfflineStatusBar는 로컬 정의를 지우고 `@/hooks`에서 import.
3. 코어 4종에 분기 추가 — 원칙: **transform은 즉시 목표값, opacity 페이드만 유지** (reduce motion은 "0"이 아니라 "완화").

컴포넌트별 목표 (visible 분기 안에서):

```ts
// Modal.tsx (열기 — center 예시)
const reduceMotion = useReduceMotion();
...
if (visible) {
  fadeOpacity.value = withTiming(1, { duration: 200, easing: Easing.ease });
  if (reduceMotion) {
    scale.value = 1;           // transform 즉시 적용
    translateY.value = 0;
  } else if (position === 'center') {
    /* 기존 withTiming 유지 */
  } else {
    /* 기존 withTiming 유지 */
  }
} else {
  fadeOpacity.value = withTiming(0, { duration: 150, easing: Easing.ease });
  if (reduceMotion) {
    scale.value = 0.9;
    translateY.value = 100;
  } else { /* 기존 유지 */ }
}
```

- `SheetModal.tsx`: reduceMotion 시 `translateY.value = 0`(열기) / `= windowHeight`(닫기) 즉시 세팅, `fadeOpacity` withTiming 유지.
- `Toast.tsx`: reduceMotion 시 `translateY.value = 0`(입장) / `= -20`(퇴장) 즉시 세팅, opacity withTiming 유지. 퇴장 완료 콜백(runOnJS)은 opacity 쪽 withTiming의 완료 콜백으로 이동(translateY가 즉시 세팅되면 콜백이 사라지므로).
- `LoadingOverlay.tsx`: reduceMotion 시 `animatedScale.value = 1`(표시) / `= 0.9`(숨김) 즉시 세팅, opacity withTiming 유지.
- 각 `useEffect` 의존성 배열에 `reduceMotion` 추가.

## Repo conventions to follow

- 훅 파일: `src/hooks/useXxx.ts` 플랫 파일 + `src/hooks/index.ts` barrel — 기존 `useAuth.ts` 등과 동일 배치.
- 준수 모범: `Skeleton.tsx:108-131` (reduceMotion 시 `cancelAnimation` + 정적 값).
- reanimated의 내장 `useReducedMotion`을 **쓰지 않는다** — 레포는 AccessibilityInfo 구독 방식이 기존 관례(테스트 mock 포함)이며 런타임 변경 반응성이 검증됨.

## Steps

1. `src/hooks/useReduceMotion.ts` 생성(Skeleton의 구현 이동 + `export`), `src/hooks/index.ts`에 export 추가.
2. `Skeleton.tsx`·`OfflineStatusBar.tsx`의 로컬 정의 삭제 → import 교체. 기존 테스트(`src/components/ui/__tests__/Skeleton.test.tsx`)가 AccessibilityInfo를 mock하는 방식 확인 — 훅 이동으로 mock 경로가 깨지면 테스트의 mock 대상을 훅 모듈로 갱신.
3. Modal → SheetModal → Toast → LoadingOverlay 순으로 분기 추가(위 Target).
4. `cd uniqn-mobile && npm run quality && npx jest src/components/ui --silent`.

## Boundaries

- reduce motion **미설정** 시의 기존 애니메이션 값·타이밍은 1비트도 바꾸지 않는다 (001·002·004와 충돌 방지 — 이 계획은 분기만 추가).
- WebModal/WebSheetModal(웹 분기)은 범위 외 — 후속에서 `prefers-reduced-motion` CSS로 별도 처리.
- 드리프트 발견 시 중단·보고.

## Verification

- **Mechanical**: `npm run quality` exit 0 + `npx jest src/components/ui --silent` 통과.
- **Feel check** (실기기):
  - iOS: 설정 > 손쉬운 사용 > 동작 > '동작 줄이기' ON / Android: 접근성 > '애니메이션 제거' ON
  - 모달 열기·시트 열기·토스트 트리거 → **이동/스케일 없이 페이드만**으로 나타나는지
  - 토스트가 자동 닫힐 때 onDismiss가 정상 호출되어 목록에서 제거되는지(콜백 이동 검증)
  - 설정 OFF로 되돌리면 기존 모션이 그대로 복원되는지
- **Done when**: `grep -rn "function useReduceMotion" uniqn-mobile/src/components` 결과 0건(컴포넌트 내 중복 소멸), 코어 4종 모두 `useReduceMotion()` 소비, 위 feel check 통과.
