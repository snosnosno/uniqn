---
area: sources
updated: 2026-07-24
status: current
sources:
  - uniqn-mobile/src/components/ops/OpsConsoleShell.tsx
  - uniqn-mobile/src/components/ops/OpsClockStrip.tsx
  - uniqn-mobile/src/components/ops/BlindPresetSheet.tsx
  - uniqn-mobile/src/components/ops/OpsRegisterParticipantSheet.tsx
  - uniqn-mobile/src/components/ui/Modal.tsx
  - uniqn-mobile/src/components/ui/SheetModal.tsx
  - uniqn-mobile/src/hooks/ops/useOpsBlindPresets.ts
  - uniqn-mobile/supabase/migrations/20260724000000_ops_blind_presets.sql
  - uniqn-mobile/supabase/migrations/20260724000100_ops_blind_preset_rpcs.sql
  - uniqn-mobile/supabase/tests/parity_baseline_guard.test.sql
  - PR#313
  - memory/project_ops_console_redesign_20260723.md
tags: [ops, ui, redesign, blind-presets, rnw, web, a11y]
---

# 소스: ops 운영 콘솔 리디자인 + 블라인드 프리셋 (PR#313, 2026-07-23~24)

**한 줄:** ops 콘솔 레이아웃 전면 개편(요약/클럭 스트립·탭 재편·태블릿 사이드바) + 블라인드 프리셋(테이블+SECDEF RPC 2종) + 후속 3묶음(a11y·등록 FAB·프리셋 UX). SDD 13태스크, fable 리뷰 2회 APPROVE, squash `b76668b5e`.

## 출하 범위 (코드 검증됨)
- **계획 A(레이아웃 T1~T7)**: `OpsConsoleShell` 신설 — 요약 스트립·클럭 스트립(`OpsClockStrip`)·탭 재편·태블릿 600dp 사이드바·⋯ 오버플로 시트.
- **계획 B(프리셋 T1~T6)**: `ops_blind_presets` 테이블(FORCE RLS, 소유자 전용 정책 1종) + `ops_save_blind_preset`/`ops_delete_blind_preset` SECDEF RPC(anon REVOKE·search_path 하드닝). prod 마이그 2건 **적용완료 — 재적용 금지**. anon SECDEF =2 불변 계약 유지([[ops-engine]]).
- **후속 3묶음**: ①a11y(탭 role/selected·클럭 동적 라벨·프리셋 행 44px) ②참가 등록 인라인 폼→FAB+시트(`OpsRegisterParticipantSheet`) ③프리셋 UX(이름 60자·levels 클라 상한 100 — 서버 상한은 후속 마이그).

## 교훈 ① RNW는 style 안의 `pointerEvents:'box-none'`을 드롭 (검증됨: 웹 실관찰)
React Native Web에서 `style={{pointerEvents:'box-none'}}`은 computed `auto`로 드롭됨 — 딤 호스트가 클릭을 삼켜 웹 백드롭 탭 닫기가 죽는다. **prop `pointerEvents="box-none"`으로** 전달해야 한다. `Modal.tsx`·`SheetModal.tsx` 수정, 정적 export 실관찰로 닫힘 검증.

## 교훈 ② 행 Pressable 중첩 = 웹 button-in-button 하이드레이션 에러 (검증됨)
프리셋 행(선택 Pressable) 안에 삭제 Pressable을 넣으면 RNW가 `<button>` 중첩 렌더 → 하이드레이션 에러. 행/액션을 형제로 분리. 기존 [[nativewind-rn-pitfalls]]의 중첩 accessibilityRole 함정(PR#136)과 같은 클래스의 재발.

## 교훈 ③ RNModal + gorhom 시트 동시 오픈 = 피커 가림 (검증됨: fable Critical)
gorhom BottomSheet 위에서 RNModal 피커(바운티 탈락 피커)를 열면 z-순서상 가려진다. 부모 시트 `visible` 게이트로 상호 배타 오픈.

## 교훈 ④ 워크트리 expo dev = EMFILE 크래시 → 정적 export+serve
node_modules junction 워크트리에서 `expo start`는 파일 워처 EMFILE로 크래시. 웹 실관찰은 `expo export -p web --clear`(캐시 필수 클리어) + `npx serve`로 대체. [[parity-baseline-squash]] 시절의 워크트리 라우트0 함정과 별개의 신규 함정.

## 교훈 ⑤ parity 가드 갱신 누락 = master red 파급 (검증됨: #311→#313)
PR#311이 `set_venue_role_salary` RPC를 추가하며 [[prod-parity-baseline]] 가드 기대값 갱신을 누락 → master DB Tests red, master를 merge한 본 브랜치도 동반 red. #313에서 소급 갱신(함수 176→177, `parity_baseline_guard.test.sql`). "함수/정책 변경 PR = 같은 PR에서 가드 갱신" 규율의 실패 사례.

## 검증 (실측)
로컬: 전체 Jest 532스위트/5926 PASS(#312·#314 merge 후 재검증)·quality exit 0·pgTAP 74파일/827 PASS. CI: PR#313 전 체크 green. prod: 정책 111·anon ops SECDEF=2·함수 177.

## 관련
- [[ops-engine]] — 콘솔이 운영하는 엔진 본체(아키텍처)
- [[nativewind-rn-pitfalls]] — 교훈 ①②③ 합류처(RN/RNW UI 함정 모음)
- [[prod-parity-baseline]] — 교훈 ⑤의 가드 규율
- [[secdef-hardening]] — 프리셋 RPC 하드닝 규율
