---
area: sources
updated: 2026-07-17
status: current
sources:
  - uniqn-mobile/src/utils/confirmAction.ts
  - uniqn-mobile/src/utils/showAlert.ts
  - uniqn-mobile/eslint.config.js
  - PR#264
  - memory/project_alert_web_noop_audit_20260717
tags: [alert, react-native-web, confirm, dialog, eslint, web]
---

# 소스: Alert.alert 웹 no-op 전수 교정 (PR #264, 2026-07-17)

## 핵심 사실
react-native-web 의 `Alert.alert` 는 **완전 no-op**(`static alert() {}`)이다. 웹(uniqn.app)은 실배포 표면이므로, 확인 다이얼로그가 게이트인 액션이 웹에서 **통째로 죽는다**(사용자 반응 없이 조용히 증발). Share.share 등 다른 RN API는 전부 web 분기·try-catch로 처리돼 있었고, `Alert.alert`만이 "조용한 웹 스텁" 클래스였다(부가 스윕은 rn-web dist 소스 직독으로 판정).

## 최악 사례
- `PlayerClaimButton` PIN 최초 발급 — 서버 mutation 성공 후 평문 PIN을 보여주는 수단이 Alert뿐 → **웹에선 PIN을 영영 못 봄**.
- `PortOneIdentityVerification.web.tsx` — web-only 파일에 native Alert 직호출(100% 결정적 실패).
- ops 라우트는 `(ops)/_layout` 인증만 게이트라 웹에서도 접근됨.

## 수정 — 유틸 2개로 단일화
- 확인/취소형 17건 → `confirmAction()`(`src/utils/confirmAction.ts`): 웹은 `window.confirm(title\n\nmessage)`, 네이티브는 `Alert.alert` 2버튼. 웹 confirm에 title 프리픽스 추가 외 동작 동일.
- 1버튼 안내형 6건 → 신규 `showAlert()`(`src/utils/showAlert.ts`): 웹=`window.alert`, 네이티브=`Alert.alert`.
- 2차(298380bae): 인라인 web 분기 3곳(`useUnsavedChangesGuard`·profile 로그아웃·PortOne native)도 수렴.
- **최종 불변식**: `Alert.alert`/`window.confirm`/`window.alert` 원시 호출은 `confirmAction`·`showAlert` **유틸 2개 파일 안에만** 존재. 총 10파일+유틸+테스트=12파일. `+367/−231`.

## 재발 방지 2중
- **ESLint `no-restricted-syntax`**(`eslint.config.js:189-208`): `Alert.alert`·`window.confirm/alert` 직접 호출 = **error**. 두 유틸 파일만 규칙 off(`:208-210`)로 예외 — 프로브로 발화 실증.
- CLAUDE.md 알림 규칙 갱신(확인형→confirmAction·안내형→showAlert).

## 검증 증거
신규 유닛 5 PASS(웹/네이티브 분기, Platform defineProperty 관례+restoreMocks 함정 반영)·기존 4스위트 40 PASS·`npm run quality` EXIT 0·변경분 eslint 0건. CI 8/8 green(E2E 포함).

## 관련
- [[nativewind-rn-pitfalls]] — 이 함정의 결정 섹션(회피 패턴 상시 규칙)
- [[codebase-cleanup-2026-07]] — 같은 시기 별개 정리(버그·죽은코드)
- [[layers]] — Presentation 레이어(다이얼로그 호출부가 사는 곳)
- [[ops-engine]] — PlayerClaimButton PIN이 사는 ops 표면(anon SECDEF·토큰 분리)
