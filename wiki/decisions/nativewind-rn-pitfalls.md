---
area: decisions
updated: 2026-07-25
status: current
sources:
  - uniqn-mobile/global.css
  - uniqn-mobile/tailwind.config.js
  - uniqn-mobile/src/utils/confirmAction.ts
  - uniqn-mobile/src/utils/showAlert.ts
  - uniqn-mobile/src/components/ui/Modal.tsx
  - uniqn-mobile/src/components/ui/SheetModal.tsx
  - memory/pitfall_nativewind_dynamic_className_dark.md
  - memory/pitfall_rn_flex1_minh_collapse.md
  - memory/pitfall_link_aschild_bare_pressable_native.md
  - memory/pitfall_rnw_nested_button_accessibilityrole.md
  - uniqn-mobile/src/components/ui/ModalManager.tsx
  - uniqn-mobile/src/components/region/RegionTaxonomyBrowser.tsx
  - PR#136
  - PR#264
  - PR#313
  - PR#332
tags:
  [nativewind, react-native, expo-router, ui, dark-mode, accessibility, web, alert, modal, overflow]
---

# 결정: NativeWind / React Native UI 함정 모음

**한 줄:** 다크모드 유실·flex 붕괴·터치 유실·hydration 에러·웹 Alert 증발·pointerEvents 드롭·모달 z-순서·**웹 모달 높이 픽셀 계산과 footer prop 미사용** — RN/NativeWind 프레젠테이션 레이어에서 조용히 재발하는 함정 모음과 회피 패턴.

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

## 중첩 `accessibilityRole="button"` / Pressable 중첩 → RNW hydration 에러 (검증됨: PR#136·PR#313)
React Native Web에서 `accessibilityRole="button"`은 `<button>`으로 렌더 → 버튼 중첩이 되어 hydration 에러. **행 Pressable 안의 액션 Pressable도 같은 클래스**(PR#313 프리셋 행에서 재발).
- 규칙: 중첩되는 안쪽 `Pressable`은 **role 미지정**(role 없는 Pressable은 `<div>`라 안전). 바깥 하나에만 button role. 행+행내 액션(삭제 등)은 중첩 대신 **형제로 분리**.
- 출처: memory `pitfall_rnw_nested_button_accessibilityrole` · [[ops-console-redesign]].

## RNW는 style 안의 `pointerEvents:'box-none'`을 드롭 → 웹 딤 클릭 삼킴 (검증됨: PR#313)
`style={{pointerEvents:'box-none'}}`은 RNW에서 computed `auto`로 드롭된다(웹 실관찰 실측). 모달 딤 호스트가 클릭을 삼켜 **웹 백드롭 탭 닫기가 조용히 죽는다**.
- 규칙: pointerEvents는 style이 아니라 **컴포넌트 prop**(`pointerEvents="box-none"`)으로. `Modal.tsx`·`SheetModal.tsx`가 준거 구현.
- 출처: [[ops-console-redesign]].

## RNModal + gorhom BottomSheet 동시 오픈 → 피커 가림 (검증됨: PR#313)
gorhom 시트 위에서 RNModal(피커 등)을 열면 z-순서상 RNModal이 가려지거나 상호작용 불능.
- 규칙: 부모 시트의 `visible`을 게이트로 **상호 배타 오픈**(피커 열 때 시트 숨김). 동시 표시 설계 금지.
- 출처: [[ops-console-redesign]] (바운티 탈락 피커, fable Critical).

## rn-web `Alert.alert` 완전 no-op → 웹에서 다이얼로그 증발 (검증됨: PR#264)
react-native-web 의 `Alert.alert`는 `static alert() {}` — **완전 no-op**이다. 웹(uniqn.app)은 실배포 표면이라 확인 다이얼로그가 게이트인 액션이 반응 없이 조용히 죽는다(최악: PIN 최초 발급이 웹에서 영영 미노출).
- 규칙: **확인/취소형은 `confirmAction()`, 1버튼 안내형은 `showAlert()`**(둘 다 `@/utils`)만 사용 — 유틸 내부에서 웹은 `window.confirm`/`window.alert`로 분기.
- 불변식: `Alert.alert`·`window.confirm`·`window.alert` 원시 호출은 두 유틸 파일 안에만 존재. `eslint.config.js`의 `no-restricted-syntax`가 직접 호출을 **error**로 기계 강제(유틸 2개만 예외).
- 주의: `Share.share` 등 타 RN API는 이미 web 분기가 있었고, `Alert.alert`만이 "조용한 웹 스텁" 클래스였다.
- 출처: [[alert-web-noop]] · `src/utils/confirmAction.ts` · `src/utils/showAlert.ts`.

## 웹 모달 높이를 `innerHeight` 픽셀로 계산 → 주소창 변화와 어긋나 푸터 잘림 (검증됨: PR#332)
`useWindowDimensions()` 높이로 `maxHeight: windowHeight * 0.9` 처럼 **픽셀**을 계산하면, 모바일 브라우저 주소창이 접히고 펴질 때 실제 가시 영역과 어긋나 카드 하단(=액션 버튼)이 화면 밖으로 나간다.
- 규칙(웹): 카드 상한은 **`'90%'` 같은 % 문자열**로. 부모가 `position:fixed`(뷰포트 확정)라 브라우저가 자동 추종한다. `Modal.tsx` WebModal · `SheetModal.tsx` WebSheetModal 이 준거 구현.
- ⚠️ **네이티브는 고치지 말 것**: 주소창이 없어 픽셀 계산이 정확하다. `Modal.tsx` NativeModal 과 `SheetModal.tsx:417`은 의도적으로 픽셀을 유지한다. 웹/네이티브를 한 번에 바꾸면 네이티브가 회귀한다.
- 함께: 고정 높이 스크롤 예산(`maxHeight: windowHeight*0.7`)도 헤더/푸터 고정 높이와 합쳐지면 상한을 넘긴다 → `flexShrink: 1` 로 **스크롤 영역만 줄여** 헤더/푸터를 가시 영역에 남긴다.
- 출처: PR#332 · [[modal-overflow-contract]](없으면 이 노트가 원장).

## `Modal`에 `footer` prop 이 있는데 안 쓰는 것이 오버플로 결함의 실제 원인 (검증됨: PR#332)
`Modal`/`SheetModal`은 `footer` prop 을 **스크롤 영역 밖 형제**로 sticky 렌더한다. 그런데 액션 버튼을 `children` 끝에 두는 소비처가 다수 남아, 본문이 길면(가변 사용자 입력·긴 목록) 버튼이 스크롤 아래로 밀려 저높이 뷰포트에서 도달이 어려웠다.
- 규칙: **모달 레벨 확인/취소는 반드시 `footer` prop**. `children` 끝의 버튼 행은 리뷰에서 결함으로 취급한다.
- 예외: 목록 끝의 인라인 어포던스("역할 추가" 등)나 인라인 폼 컨트롤은 맥락상 본문에 속하므로 footer 로 올리지 않는다(`VenueSettingsSheet` 판정).
- `ModalManager`의 `bottomSheet` 케이스는 confirm/cancel 을 아예 렌더하지 않아 호출부가 넘긴 버튼이 **조용히 증발**했다 — 타입별 계약 차이를 없애고 공용 푸터를 공유한다.
- 출처: PR#332 (ReportModal·ConfirmModal·RoleChangeModal·ModalManager·CancellationRequestCard·DeletionScheduledModal).

## `flex-1` 루트 컴포넌트는 "부모가 높이를 bound" 를 요구 → 시트를 flex 로 못 바꾼다 (검증됨: PR#332)
`RegionTaxonomyBrowser` 는 루트가 `flex-1` 이고 주석에 **"부모가 높이를 bound 해야 한다"**고 명시돼 있다. 이걸 쓰는 시트를 고정 픽셀 높이 → flex 로 바꾸면 내부 2패널 스크롤이 죽는다(부모가 auto-height 면 `flex-1` 이 콘텐츠 높이로 붕괴 — 위 Yoga 함정과 같은 뿌리).
- 규칙: 이런 컴포넌트를 담는 시트는 **고정 높이를 유지**하되, 그 값이 모달 카드 예산(90%/95%)에서 **크롬(헤더+패딩) 몫을 뺀 값**을 넘지 않도록 상한만 조인다. `RegionFilterSheet` · `PlaceSheet` 가 준거.
- 증상: 본문만 `0.72H` 를 잡으면 헤더·패딩과 합쳐 카드 90% 를 넘겨 하단 "적용" 버튼이 잘린다.
- 출처: PR#332.

## 관련
- [[layers]] — Presentation 레이어(이 함정들이 사는 곳)
- [[ops-console-redesign]] — pointerEvents 드롭·Pressable 중첩 재발·모달 z-순서 함정의 출처(PR#313)
- [[alert-web-noop]] — 웹 Alert no-op 전수 교정 소스(수정 범위·검증 상세)
- [[order-sheet-form-contract]] — 단일화면 카드+중첩 Modal embedded(RN Modal/터치 처리 선례)
- [[ios-userflow-fixes]] — iOS UI 버그 실측 수정 묶음(같은 프레젠테이션 표면)
