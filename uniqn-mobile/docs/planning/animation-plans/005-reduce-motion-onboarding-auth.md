# 005 — 온보딩/회원가입 진입 애니메이션에 reduceMotion 적용

- **Status**: TODO
- **Commit**: d824729
- **Severity**: HIGH (정책 위반이지만 1회성 화면이라 빈도는 낮음 — AUDIT.md 빈도표 기준 "rare/first-time"이라 delight 여지는 있으나 §8 필수 요구사항 자체는 빈도와 무관하게 적용)
- **Category**: 접근성
- **Estimated scope**: 2 files (SignupForm.tsx의 bounce 제거는 계획 001에서 이미 처리 — 이 계획은 reduceMotion 분기만 추가)

## Problem

**1) `src/components/tutorial/TutorialPage.tsx` (전체, 라인 35,42,49,56)**

```tsx
<Animated.View entering={FadeInUp.delay(200).duration(500)}>
  {/* 아이콘 */}
</Animated.View>
<Animated.View entering={FadeInUp.delay(350).duration(500)} className="mt-8">
  {/* 제목 */}
</Animated.View>
<Animated.View entering={FadeInUp.delay(450).duration(500)} className="mt-2">
  {/* 부제 */}
</Animated.View>
<Animated.View entering={FadeInUp.delay(550).duration(500)} className="mt-6 px-4">
  {/* 설명 */}
</Animated.View>
```

4곳 모두 `FadeInUp`(translateY 포함)이고 파일 전체에 `useReduceMotion` 참조가 없다.

**2) `src/components/onboarding/NotificationPermissionScreen.tsx` (라인 126-127, 146-148, 167)**

```tsx
<Animated.View entering={FadeInUp.delay(100).duration(500)} className="mb-8 items-center pt-4">
  {/* 헤더 */}
</Animated.View>
{/* ...map 내부... */}
<Animated.View key={item.title} entering={FadeInUp.delay(200 + index * 100).duration(500)} className="mb-3 ...">
  {/* 리스트 아이템 */}
</Animated.View>
{/* ... */}
<Animated.View entering={FadeInDown.delay(600).duration(500)} className="mt-auto pb-4">
  {/* CTA */}
</Animated.View>
```

동일하게 translateY 트랜스폼인데 reduceMotion 분기 없음.

**3) `src/components/auth/signup/SignupForm.tsx:450-454`** — bounce 제거는 계획 001에서 처리 완료 가정. 이 계획은 reduceMotion 분기 추가만:

```tsx
<Animated.View key={currentStepKey} entering={FadeInRight.duration(200)} className="flex-1">
  {renderStep()}
</Animated.View>
```

## Target

**공통 패턴**: `FadeInUp`/`FadeInDown`(이동 포함) → reduceMotion 시 `FadeIn`(순수 opacity)으로 대체. delay는 유지해도 되지만(순차 등장 자체는 UX 목적 유효), 단순화를 위해 이 계획에서는 delay도 유지한다.

**1) TutorialPage.tsx**

```tsx
import { useReduceMotion } from '@/hooks/useReduceMotion';

export function TutorialPage({ page, width, iconBgClass }: TutorialPageProps) {
  const reduceMotion = useReduceMotion();
  const IconComponent = page.icon;

  return (
    <View style={{ width }} className="flex-1 justify-center items-center px-8">
      <Animated.View entering={reduceMotion ? FadeIn.delay(200).duration(500) : FadeInUp.delay(200).duration(500)}>
        {/* 아이콘 */}
      </Animated.View>
      <Animated.View entering={reduceMotion ? FadeIn.delay(350).duration(500) : FadeInUp.delay(350).duration(500)} className="mt-8">
        {/* 제목 */}
      </Animated.View>
      <Animated.View entering={reduceMotion ? FadeIn.delay(450).duration(500) : FadeInUp.delay(450).duration(500)} className="mt-2">
        {/* 부제 */}
      </Animated.View>
      <Animated.View entering={reduceMotion ? FadeIn.delay(550).duration(500) : FadeInUp.delay(550).duration(500)} className="mt-6 px-4">
        {/* 설명 */}
      </Animated.View>
    </View>
  );
}
```

**2) NotificationPermissionScreen.tsx** — 동일 패턴으로 3곳(`FadeInUp.delay(100)...`, `FadeInUp.delay(200 + index * 100)...`, `FadeInDown.delay(600)...`)을 `reduceMotion ? FadeIn.delay(...).duration(500) : 기존값`으로 감싼다.

**3) SignupForm.tsx**

```tsx
import { useReduceMotion } from '@/hooks/useReduceMotion';

// 컴포넌트 본문
const reduceMotion = useReduceMotion();

<Animated.View
  key={currentStepKey}
  entering={reduceMotion ? FadeIn.duration(200) : FadeInRight.duration(200)}
  className="flex-1"
>
  {renderStep()}
</Animated.View>
```

## Repo conventions to follow

- 직접 경로 import만: `@/hooks/useReduceMotion`.
- `FadeIn`을 새로 import해야 하는 파일이 있는지 확인(TutorialPage.tsx, NotificationPermissionScreen.tsx는 현재 `FadeInUp`/`FadeInDown`만 쓸 가능성이 높음).

## Steps

1. `TutorialPage.tsx`: `useReduceMotion`, `FadeIn` import 추가(둘 다 없다면). 컴포넌트 본문에 `const reduceMotion = useReduceMotion();` 추가. 4곳의 `entering` prop을 Target대로 조건부화.
2. `NotificationPermissionScreen.tsx`: 동일하게 훅 추가 후 3곳의 `entering` prop을 조건부화. `index`를 쓰는 두 번째 위치는 map 콜백 내부이므로 `reduceMotion`은 바깥 스코프에서 클로저로 접근(추가 prop drilling 불필요).
3. `SignupForm.tsx`: `useReduceMotion` import 추가(계획 001 적용 후 `.springify()`는 이미 제거된 상태). 컴포넌트 본문에 훅 추가. `entering` prop을 Target대로 조건부화.

## Boundaries

- 계획 001(bounce 제거)이 SignupForm.tsx에 이미 적용됐다고 가정한다 — 아직이면 이 계획 실행 전에 001부터 적용한다.
- MOTION_DURATION 토큰 적용(500ms를 토큰화할지 여부)은 이 계획 범위가 아니다 — AUDIT.md 듀레이션 표에서 500ms는 "마케팅/설명" 성격이라 별도 판단 필요(계획 007에서도 이 세 파일은 제외됨).
- delay 순차 등장 로직 자체는 변경하지 않는다.
- 코드가 위 인용과 다르면 멈추고 보고한다.

## Verification

- **Mechanical**: `npx tsc --noEmit`, `npx eslint src/components/tutorial/TutorialPage.tsx src/components/onboarding/NotificationPermissionScreen.tsx src/components/auth/signup/SignupForm.tsx`, `jest src/components/tutorial src/components/onboarding src/components/auth`.
- **Feel check**: "동작 줄이기" ON 상태에서:
  - 튜토리얼 화면을 넘겨 아이콘/제목/부제/설명이 아래에서 올라오지 않고 제자리 페이드로만 순차 등장하는지.
  - 알림 권한 온보딩 화면에서 헤더/리스트/CTA가 동일하게 이동 없이 페이드만 되는지.
  - 회원가입 스텝 전환 시 옆에서 밀려들어오지 않고 페이드만 되는지.
  - OFF 상태에서는 기존처럼 이동+페이드가 재생되는지(회귀 없음).
- **Done when**: 3개 파일 모두 Target과 일치, ON/OFF 양쪽 feel-check 통과.
