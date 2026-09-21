# 001 — Modal/SignupForm 바운스·오버슈트 제거

- **Status**: TODO
- **Commit**: d824729
- **Severity**: HIGH
- **Category**: 이징/지속시간 · 물리성 (impeccable-design.md §8 "금지: bounce/elastic" 정책 위반)
- **Estimated scope**: 2 files, 3개 지점

## Problem

`.claude/rules/impeccable-design.md` §8은 "금지: bounce/elastic. 실제 물체는 튕기지 않고 감속한다"를 명시적으로 정한다. 아래 3곳이 이 정책을 위반한다.

**1) `src/components/ui/Modal.tsx:220-222` (WebModal, position='center')**

```tsx
// 현재 코드
position === 'center'
  ? {
      opacity: isAnimating ? 1 : 0,
      transform: [{ scale: isAnimating ? 1 : 0.9 }],
      // @ts-expect-error - 웹 전용 스타일
      transition:
        'opacity 200ms ease, transform 200ms cubic-bezier(0.34, 1.56, 0.64, 1)',
      pointerEvents: 'auto' as const,
    }
```

`cubic-bezier(0.34, 1.56, 0.64, 1)`의 두 번째 제어점 y=1.56은 1을 초과 — 목표값을 넘어섰다가 되돌아오는 back-ease(오버슈트) 커브다.

**2) `src/components/ui/Modal.tsx:430` (NativeModal, 드래그 반동)**

```tsx
// 현재 코드
translateY.value = reduceMotion ? 0 : withSpring(0, { damping: 22, stiffness: 220 });
```

mass 기본값 1일 때 임계댐핑 `2*sqrt(stiffness*mass) = 2*sqrt(220) ≈ 29.66`. damping=22는 이보다 작아 감쇠비 ζ≈0.74(<1) — 언더댐프드 스프링이라 목표값을 지나쳤다가 돌아오는 시각적 바운스가 생긴다.

**3) `src/components/auth/signup/SignupForm.tsx:450-454`**

```tsx
// 현재 코드
<Animated.View
  key={currentStepKey}
  entering={FadeInRight.duration(200).springify()}
  className="flex-1"
>
```

`.springify()`는 Reanimated 프리셋에 스프링 물리(기본 바운스 포함)를 적용한다.

## Target

**1) Modal.tsx:220-222** — 오버슈트 없는 강한 ease-out으로 교체 (AUDIT.md §2 표준값):

```tsx
position === 'center'
  ? {
      opacity: isAnimating ? 1 : 0,
      transform: [{ scale: isAnimating ? 1 : 0.9 }],
      // @ts-expect-error - 웹 전용 스타일
      transition: 'opacity 200ms ease, transform 200ms cubic-bezier(0.23, 1, 0.32, 1)',
      pointerEvents: 'auto' as const,
    }
```

**2) Modal.tsx:430** — 임계댐핑 이상(ζ≥1)으로 조정. `stiffness=220` 유지 시 `damping ≥ 30`(여유 있게 32):

```tsx
translateY.value = reduceMotion ? 0 : withSpring(0, { damping: 32, stiffness: 220 });
```

**3) SignupForm.tsx:452** — `.springify()` 제거, duration 기반으로:

```tsx
<Animated.View
  key={currentStepKey}
  entering={FadeInRight.duration(200)}
  className="flex-1"
>
```

## Repo conventions to follow

- `src/constants/motion.ts`의 `MOTION_EASING.enter = Easing.bezier(0.25, 1, 0.5, 1)`가 이미 정책상의 "강한 ease-out" 값이다. 다만 이 파일(Modal.tsx:220-222)은 **웹 전용 CSS 문자열**이라 이 토큰을 그대로 못 쓴다 — CSS cubic-bezier 표기(AUDIT.md §2 예시값 `cubic-bezier(0.23, 1, 0.32, 1)`)를 직접 쓴다. `MOTION_EASING`을 CSS 문자열로 재사용하는 건 이번 범위 밖(별도 판단 필요).
- 스프링 파라미터는 이 저장소에 다른 예시가 없다 — Reanimated 문서 기준 `damping`/`stiffness`만으로 임계댐핑 계산: `criticalDamping = 2 * sqrt(stiffness * mass)`, mass 기본값 1.

## Steps

1. `src/components/ui/Modal.tsx:222` — `cubic-bezier(0.34, 1.56, 0.64, 1)`를 `cubic-bezier(0.23, 1, 0.32, 1)`로 교체. 문자열의 나머지 부분(`opacity 200ms ease, transform 200ms `)은 그대로 둔다.
2. `src/components/ui/Modal.tsx:430` — `damping: 22`를 `damping: 32`로 교체. `stiffness: 220`은 그대로 둔다.
3. `src/components/auth/signup/SignupForm.tsx:452` — `FadeInRight.duration(200).springify()`에서 `.springify()`를 제거해 `FadeInRight.duration(200)`으로 만든다.
4. 세 지점 외에 같은 파일 내 다른 애니메이션 값은 건드리지 않는다.

## Boundaries

- Modal.tsx의 다른 위치(`position !== 'center'`, NativeModal의 다른 애니메이션 등)는 이 계획 범위가 아니다 — 006(exit=75%), 007(토큰 소비) 계획에서 다룬다.
- 이 계획은 커브/스프링 파라미터 값만 바꾼다. `useReduceMotion` 적용 여부는 003/004/005 계획에서 다룬다(단, Modal.tsx:430은 이미 `reduceMotion` 분기가 있으므로 손대지 않는다).
- 새 의존성 추가 금지.
- 커밋 `d824729` 이후 이 파일들이 크게 바뀌었다면(라인 번호 불일치) 진행을 멈추고 보고한다.

## Verification

- **Mechanical**: `cd uniqn-mobile && npx tsc --noEmit` (타입 에러 없음), `npx eslint src/components/ui/Modal.tsx src/components/auth/signup/SignupForm.tsx`.
- **Feel check**:
  - iOS/Android 실기기 또는 시뮬레이터에서 가운데 정렬 Modal(예: 확인 다이얼로그)을 열어 스케일 진입 시 목표 크기를 넘어서서 커졌다가 줄어드는 "튕김"이 사라졌는지 확인.
  - 바텀시트를 드래그했다가 임계값 미만에서 손을 떼 원위치로 복귀할 때, 반동이 목표 위치를 지나치지 않고 매끄럽게 감속하며 멈추는지 확인.
  - 회원가입 스텝 전환 시 폼이 옆에서 들어올 때 튕기지 않고 한 번에 감속하며 정지하는지 확인.
  - 각각을 슬로모션(기기 설정 또는 화면 녹화 0.25배속)으로 재생해 오버슈트 여부를 프레임 단위로 확인.
- **Done when**: 세 지점 모두 코드가 Target과 일치하고, 위 3개 feel-check 시나리오에서 오버슈트가 관찰되지 않는다.
