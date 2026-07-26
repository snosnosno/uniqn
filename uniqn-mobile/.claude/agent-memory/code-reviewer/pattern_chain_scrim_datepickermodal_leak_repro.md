---
name: chain-scrim-datepickermodal-leak-repro
description: 연쇄 딤(scrim) 리셋이 "표시 완료 통지" 콜백 1종에만 의존하면, 그 콜백을 안 부르는 형제 Modal 경로에서 영구잔존 — 4단 변이(true 제거/onEntered 제거/clearPendingSwap 리셋 제거/ref 고정 무시) 중 실물 재현이 결정적이었던 사례
metadata:
  type: project
---

주문서 Task 3(전환 연출: `SheetChainContext` + 딤 인수인계, `feat/order-sheet-unset-chain` `e06b86fbd`) 리뷰에서 CRITICAL 발견. 상세 배경·일반화된 교훈은 메인 저장소 [[sheet-chain-context-dismiss-notification-gap]](`C:\Users\user\.claude\agent-memory\code-reviewer\pattern_sheet_chain_context_dismiss_notification_gap.md`) 참조 — 이 파일은 **이 리포 시리즈용 변이축 메모**만 남긴다.

**4단 변이 결과**:

1. `confirmRow`의 `setChainSwapping(true)` 제거 → 딤-등장 테스트 red (기대대로 가드됨)
2. `handleChainEntered`(onEntered 배선) 무력화 → 딤-해제 테스트 red (기대대로 가드됨)
3. `clearPendingSwap` 끝의 `setChainSwapping(false)` 제거 → **10/10 green, 무가드**
4. `SheetModal`의 `isChainEntryRef` 고정을 무시하고 live context 값 사용 → **259/259, 732/732 green, 무가드**(SheetModal 실물 렌더 테스트가 이 리포에 0건이라 구조적으로 관측 불가 — 실기기 전용 리스크로 확정)

**3·4는 "무가드"로 끝내지 않고 실물 재현이 필요했다**: `secondGroupDatesMissing()`(그룹0 완성·그룹1 dates 미설정) 픽스처로 title만 확인해도 `nextUnsetRowAfter`가 전체 폼을 순회하므로 연쇄가 그룹1 dates(=`ScheduleDatesSheet`→`DatePickerModal`→`ui/Modal`, `SheetChainContext` 미소비)로 간다. 임시 테스트를 추가해 실행:

- 스왑 후 실제 `DatePickerModal`(`job-posting-date-cancel-button` 존재)이 뜬 상태에서 딤이 안 걷힘 확인
- 취소 버튼을 눌러 시트를 닫은 **후에도 딤이 그대로 남음**을 확인(정적 추론만으론 "닫히면 초기화되겠지"라는 반박이 가능했음 — 실행으로 이 반박을 봉쇄)
  → green(pass) 확인 후 `git checkout --` 로 즉시 원복.

**교훈**: 변이 3(clearPendingSwap 리셋 누락)은 "무가드"만으로는 실전 영향력이 안 보인다 — `closeSheet`/`confirmRow`의 `next===null` 종료 경로 둘 다 chainSwapping을 안 건드리므로, **날짜 시트가 연쇄의 종착점이거나 취소되는 모든 경우**가 이미 실제 결함이었다(변이를 가할 필요조차 없이 베이스 코드가 이미 이 버그를 갖고 있음 — 변이 3의 "무가드"는 리스크 신호였지, 버그 자체의 발견 경로는 아니었다). 이번처럼 **"무가드 발견 → 그 라인이 지켜야 했을 실제 시나리오를 fixture로 만들어 베이스 코드에서 직접 재현"** 순서가 정확한 심각도 판정(HIGH 추정 vs CRITICAL 확정)을 갈랐다.
