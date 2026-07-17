---
area: decisions
updated: 2026-07-17
status: current
sources:
  - uniqn-mobile/global.css
  - uniqn-mobile/tailwind.config.js
  - uniqn-mobile/src/utils/confirmAction.ts
  - uniqn-mobile/src/utils/showAlert.ts
  - memory/pitfall_nativewind_dynamic_className_dark.md
  - memory/pitfall_rn_flex1_minh_collapse.md
  - memory/pitfall_link_aschild_bare_pressable_native.md
  - memory/pitfall_rnw_nested_button_accessibilityrole.md
  - PR#136
  - PR#264
tags: [nativewind, react-native, expo-router, ui, dark-mode, accessibility, web, alert]
---

# 결정: NativeWind / React Native UI 함정 모음

**한 줄:** 다크모드 유실·flex 붕괴·터치 유실·hydration 에러·웹 Alert 증발 — RN/NativeWind 프레젠테이션 레이어에서 조용히 재발하는 5함정과 회피 패턴.

## 동적 className은 `dark:`를 유실 → CSS var 토큰 사용 (검증 필요)
런타임에 문자열 조합으로 만든 className은 NativeWind가 `dark:` 배리언트를 정적 추출하지 못해 다크모드가 깨진다.
- 규칙: 조건부 색은 `dark:bg-...` 동적 조합 대신 **CSS 변수 토큰**(`text-content-primary`, `bg-surface` 등)으로 — 토큰이 테마 전환을 흡수.
- 출처: memory `pitfall_nativewind_dynamic_className_dark`.

## Yoga `flex-1` + `min-h` 붕괴 (검증 필요)
auto-height 부모 안에서 `flex-1`과 `min-h`가 겹치면 Yoga가 높이를 0으로 붕괴시킨다.
- 규칙: **auto-height 부모 안에 `flex-1` Pressable 배치 금지**. 높이는 명시하거나 부모를 고정 높이로.
- 출처: memory `pitfall_rn_flex1_minh_collapse`.

## expo-router `Link asChild` + bare Pressable → 네이티브 터치 유실 (검증 필요)
`Link asChild`로 감싼 맨 `Pressable`은 네이티브에서 탭이 안 먹는다.
- 규칙: 목록/카드 내 이동은 `Link asChild` 대신 **`router.push()` 명령형** 핸들러.
- 출처: memory `pitfall_link_aschild_bare_pressable_native`.

## 중첩 `accessibilityRole="button"` → RNW hydration 에러 (검증됨: PR#136)
React Native Web에서 `accessibilityRole="button"`은 `<button>`으로 렌더 → 버튼 중첩이 되어 hydration 에러.
- 규칙: 중첩되는 안쪽 `Pressable`은 **role 미지정**(role 없는 Pressable은 `<div>`라 안전). 바깥 하나에만 button role.
- 출처: memory `pitfall_rnw_nested_button_accessibilityrole`.

## rn-web `Alert.alert` 완전 no-op → 웹에서 다이얼로그 증발 (검증됨: PR#264)
react-native-web 의 `Alert.alert`는 `static alert() {}` — **완전 no-op**이다. 웹(uniqn.app)은 실배포 표면이라 확인 다이얼로그가 게이트인 액션이 반응 없이 조용히 죽는다(최악: PIN 최초 발급이 웹에서 영영 미노출).
- 규칙: **확인/취소형은 `confirmAction()`, 1버튼 안내형은 `showAlert()`**(둘 다 `@/utils`)만 사용 — 유틸 내부에서 웹은 `window.confirm`/`window.alert`로 분기.
- 불변식: `Alert.alert`·`window.confirm`·`window.alert` 원시 호출은 두 유틸 파일 안에만 존재. `eslint.config.js`의 `no-restricted-syntax`가 직접 호출을 **error**로 기계 강제(유틸 2개만 예외).
- 주의: `Share.share` 등 타 RN API는 이미 web 분기가 있었고, `Alert.alert`만이 "조용한 웹 스텁" 클래스였다.
- 출처: [[alert-web-noop]] · `src/utils/confirmAction.ts` · `src/utils/showAlert.ts`.

## 관련
- [[layers]] — Presentation 레이어(이 함정들이 사는 곳)
- [[alert-web-noop]] — 웹 Alert no-op 전수 교정 소스(수정 범위·검증 상세)
- [[order-sheet-form-contract]] — 단일화면 카드+중첩 Modal embedded(RN Modal/터치 처리 선례)
- [[ios-userflow-fixes]] — iOS UI 버그 실측 수정 묶음(같은 프레젠테이션 표면)
