# 핸드오프 — 주문서 연쇄 입력 후속: 연출 🟡 + a11y 🟢 + 리뷰 MEDIUM (다음 세션 메인 프롬프트)

> 아래 "메인 프롬프트" 블록을 새 세션에 그대로 붙여넣어 시작한다.

---

## 메인 프롬프트

주문서 연쇄 입력(PR #306 `6035b5e4e` + 후속 결함 PR #307 `8d703956a` 머지완료)의 잔여 3묶음을 진행해줘 — **리뷰 MEDIUM 1건(우선, 최소) + 연출 🟡 3건 + a11y 🟢 3건**. 기본은 한 브랜치/한 PR, 단 딤 헤더 커버(B1)가 구조 변경으로 커지면 분리 판단 허용. 원래 "실기기 QA 이후"로 미뤄졌던 항목이나 사용자 결정으로 선진행한다 — QA 종속 판단(180ms 상향 등)은 코드에 주석으로 남기고 값 변경은 보류.

### 착수 전 필수

1. `git status` — 타 세션 미커밋 상존 가능. `git fetch origin master` 후 **master 기준 새 브랜치** `feat/order-sheet-chain-polish`. 내가 안 만든 미커밋이 **코드 파일**에 있으면 워크트리 격리(메모리 `feedback_isolate_worktree_parallel_session`).
2. **`git add .` 절대 금지** — 경로 명시 add만(공유 워킹트리).
3. 맥락: PR #306·#307 본문. 연출 판단 기준 = `.claude/rules/impeccable-design.md`(룰 8 모션·11 라벨·17 햅틱) + 로컬 스킬 `emil-design-eng`·`apple-design`(존재함, 필요 시 로드).

### A — 리뷰 MEDIUM: slotComplete 빈 배열 진공참 (우선, 최소)

**결함**: `ScheduleSlotsSheet.tsx:45-46`의 `slotComplete`를 `disabled={!slots.every(slotComplete)}`(~:137)로 소비 — `Array.every`는 빈 배열에서 진공적 참이라 `slots.length===0`이면 확인이 활성이다. 현재는 seed(마운트 시 ≥1 보장, :61)와 `removable={slots.length>1}`(SlotCard.tsx:104)이 차단해 **라이브 결함 아님** — 암묵 불변식일 뿐.

**수정 방향(리뷰 권장)**: 완성 판정을 `orderRowMeta.ts`로 export(예: `isSlotComplete`)해 `getRowState('time')`(:405-407)·`getRowState('roles')`(:445)·`ScheduleSlotsSheet`가 **한 함수를 공유** — 현재 같은 로직이 3중 구현(orderRowMeta 2곳 + 시트 1곳)이라 헤더 주석(orderRowMeta.ts:4-6)이 경고하는 드리프트 위험. 시트 적용부는 `slots.length > 0 && slots.every(...)`로. TDD: export 헬퍼 단위 테스트로 빈 배열→미완성(=확인 잠김 방향) 고정 — 컴포넌트 경유로는 도달 불가한 상태라 헬퍼 직접 테스트가 유일 경로.

### B — 연출 🟡 3건

**B1. 딤이 헤더(StackHeader) 미커버** — 전환마다 상단 띠 깜빡임. 딤은 `OrderSheetScreen.tsx:874-880`의 화면 내부 absolute View(`order-sheet-chain-scrim`, pointerEvents none)라 내비 헤더 위엔 안 깔린다. **설계 필요**: 중첩 RN Modal 금지(#244·#186) 제약 하에서 헤더까지 덮는 방법 — 후보: ① 주문서 화면(create/edit)의 헤더 구성 실측 후 헤더 배경/틴트 동기화 ② 루트 포털(있다면) ③ 헤더가 이미 시트 백드롭에 덮이는 구조면 무해로 판정하고 문서만 정정. **실물 렌더 관찰 필수**(fablize 그라운딩 — 웹 `npm start` 후 실제 확인, 정적 파싱으로 단정 금지).

**B2. 180ms 대기 플랫폼 분기** — `SHEET_CHAIN_SWAP_MS=180`(`constants/animation.ts:26`)은 **iOS 네이티브 Modal dismiss 커밋 여유분**(주석 :14-25). Android/웹은 이 제약이 다르므로 `Platform.select` 분기 검토(웹은 0~짧게). ⚠️ 주의: ① 웹 딤 조기 해제 수정(#306 `87bef9cfe`)·`SHEET_CHAIN_DATES_SCRIM_HOLD_MS=200`(:37, ui/Modal fade 200 동조)과의 상호작용 회귀 ② chain 테스트가 상수를 직접 import해 타이머를 감으므로 분기 시 테스트도 같은 소스에서 값을 읽게 ③ iOS 300 상향 여부(:24 "실기기 QA 대상")는 QA 결과 종속 — 이번엔 건드리지 말 것.

**B3. 연쇄 CTA 라벨 + 완료 신호** — ① 연쇄 무장 시(미설정 행을 연 경우) 시트 확인 버튼을 "다음: 장소"처럼 다음 목적지 예고로(impeccable 룰 11 구체 라벨). 다음 타깃은 확인 시점에야 확정되므로 라벨 계산은 열 때의 `nextUnsetRowAfter` 예측 — 확인 중 폼 변화로 어긋날 수 있음(부정확 라벨 vs 무라벨 트레이드오프, 제품 판단). ② 연쇄 완료(다음 미설정 없음) 시 긍정 신호 — 토스트 또는 햅틱(룰 17: 결정적 순간만, `src/utils/haptics.ts` throttle 경유). 과하면 빼는 쪽 우선(룰: 절제).

### C — a11y 🟢 3건

1. **전환 안내**: 연쇄 예약 시 `AccessibilityInfo.announceForAccessibility('다음 항목: 장소')` — 딤 180ms 동안 스크린리더가 침묵하지 않게.
2. **포커스 이동**: 연쇄로 새 시트가 열리면 시트 제목/첫 입력으로 접근성 포커스(웹은 focus, 네이티브는 `setAccessibilityFocus` — 플랫폼 차이 실측).
3. **Reduce Motion**: 딤/전환에 `isReduceMotionEnabled` 분기 — 기존 패턴 `SlotCard.tsx:56-65`·`Skeleton.tsx:68` 승계. ON이면 딤 페이드 없이 즉시 전환(또는 딤 생략) 판단.

### TDD 엄수 (fablize)

- 각 항목: 실패 테스트 먼저(RED 관찰) → 최소 수정 → GREEN → **대표 가드 제거 변이 red 재확인 후 원복**. 공허 통과 차단: 전제 고정 단언(예약 존재 `getTimerCount()===1` 등)을 같은 테스트 안에 먼저.
- A: 헬퍼 단위(빈 배열·시간미정·역할0) + 기존 시트 게이팅 테스트 green 유지.
- B2: 플랫폼별 값 단위 + 기존 chain 타이머 테스트 전부 green.
- B3/C: 라벨·announce 모킹 단언(`jest.spyOn(AccessibilityInfo, 'announceForAccessibility')`).

### 함정 (실측 이월 — #306·#307 세션)

- **행≠시트 1:1** — 시간·역할 두 행=`ScheduleSlotsSheet` 하나, 확인은 `roles`+`SLOTS_SHEET_ROWS` 보고. coveredKeys(그룹 스코프)·skipKeys(그룹 불문, 잠금) 가드 둘 다 유지.
- 시트 확인은 `onConfirm(...); onClose();` **동기 연쇄** — `confirmRow`를 `onClose`로 옮기면 연쇄 침묵사.
- **예약취소 딤 해제 테스트는 SheetModal 계열 시트 탭으로는 공허** — onEntered가 딤을 대신 걷어 변이해도 green(chain.test.tsx:470-473 주석). 일정추가·그룹삭제·언마운트 경로로만 검증.
- `ScheduleDatesSheet`만 `DatePickerModal`(ui/Modal) 래핑 — SheetChainContext 계약 밖. ui/Modal fade(200) 바꾸면 `SHEET_CHAIN_DATES_SCRIM_HOLD_MS` 동조 필수.
- hooks barrel을 리프 UI에서 import 금지(순환 크래시) — 직접 경로 import.
- 단일 그룹 행 testID는 `order-sheet-row-time`(접미사 없음), 다그룹만 `-N`.
- jest 전체 "worker process has failed to exit gracefully" = 선재 베이스라인(exit 0). knip 래칫 판정은 **이슈 총계≤2189**(설정 힌트 3건이 exit 1 유발).
- push는 pre-push 훅 hang → `git push --no-verify`. 원격 브랜치 삭제 `gh api -X DELETE`. **auto-merge는 Quality만으로 발동** — 머지 직후 브랜치 push 금지(고아 커밋).

### 완료 게이트 (exit proof)

- 신규+기존 테스트 green 실측 출력 · `npm run quality` exit 0(파이프 없이 exit 실측) · 변이 red 기록(항목 묶음별 대표 1+).
- B1은 실물 렌더 관찰 1회(웹) 증거 포함.
- master 재통합 후 재검증 → push(`--no-verify`) → PR. PR 본문에 실기기 QA 목록(연출 체감·iOS 180ms·Reduce Motion 실기기) 명시. **머지는 사용자 승인 후**.

### 이번 범위 아님 (재발견 금지)

OrderSheetScreen 1056줄 분할 · SheetModal 실물 렌더 테스트 · closeSheet 죽은 가드 정리 · 실기기 QA 수행 자체 · 웹/OTA 배포 · `SHEET_CHAIN_SWAP_MS` iOS 값 변경(QA 종속).

---

## 진행 결과 (2026-07-23 실행 세션 — 브랜치 `feat/order-sheet-chain-polish`, 미push)

TDD(RED→GREEN→변이 red)로 4개 항목 구현 완료. `npm run quality` exit 0(타입 0에러·lint 0에러·포맷 통과), 주문서+animation 30 suites/286 green.

| 항목 | 상태 | 커밋 | 비고 |
|---|---|---|---|
| **A** slotComplete 진공참 | ✅ 완료 | `c2d57f276` | 공유 술어 3 + `areSlotsComplete`(length>0 가드). 3중 구현 통합. 헬퍼 단위 12건 + 빈 배열 변이 red |
| **B2** 180ms 플랫폼 분기 | ✅ 완료 | `b26a6ee58` | `sheetChainSwapMs(os)` 순수함수, 웹 0/네이티브 180. 기존 chain 테스트 회귀 없음 |
| **C1** 전환 안내 | ✅ 완료 | `89904e546` | `confirmRow`에서 `announceForAccessibility('다음 항목: …')`. 스왑 이전 단언으로 침묵창 메움 |
| **B3② 완료 신호** | ✅ 완료 | `9273fcf1b` | 연쇄 완료(next===null) 시 `triggerHaptic('success')`. 토스트는 절제로 생략. 완료/중간 대조군 |

### 미완 — 판단·관찰·제품결정 종속 (다음 세션/사용자 게이트)

- **B1 딤 헤더 미커버** — 🔑 **정밀 특성화 완료(핸드오프 옵션 ③ 오답)**: `StackHeader`는 Expo 내비 헤더가 아니라 `create.tsx`/`edit.tsx`의 `SafeAreaView` 안에서 `OrderSheetScreen`의 **형제 View**(+`VenueSelectChips`)다. 스크림은 `OrderSheetScreen` 내부라 그 형제 헤더 띠를 못 덮어, 180ms 스왑 갭 동안 상단이 번쩍인다. 실제 결함이지만 🟡. **남은 이유**: 수정은 스크림을 헤더 위 레이어로 올리는 설계 변경(옵션 ②류)이고, 클린한 후보들이 중첩 Modal 위험(#244)·호스트 2파일로 연쇄 관심사 확산·SafeAreaView 레이아웃 영향을 동반 → 핸드오프가 명시한 **실물 렌더 관찰(웹)** 없이 blind 구조 변경은 fablize 그라운딩 위반. 관찰 가능한 세션에서 착수.
- **B3① CTA 라벨 예고("다음: 장소")** — **제품 판단 종속**. 라벨은 열 때 `nextUnsetRowAfter` 예측이라 확인 중 폼 변화로 어긋날 수 있고(부정확 라벨 리스크, 핸드오프 명시), 시트 8종 확인 버튼에 `confirmLabel` prop 주입이 필요(넓은 표면). "부정확 라벨 vs 무라벨" 제품 결정 후 착수.
- **C2 포커스 이동** — **선례 0 + 인프라 부재**로 🟢치고 리스크 과다. `setAccessibilityFocus`/`findNodeHandle` 코드베이스 선례 없음, SheetModal 테스트 인프라 없음. 네이티브는 RNModal 재마운트가 VoiceOver 포커스를 부분 자동 이동. 웹 focus-to-heading은 RN-web focusability 검증 필요. 가치 있는 웹 경로만 별도 착수 권장.
- **C3 Reduce Motion** — **판단: 무변경 적정**. 연쇄 전환은 이미 reduce-motion 친화(딤 무애니메이션 즉시 · 슬라이드 없음 · 내용은 cross-fade만 = 권장 대체형). `SlotCard`(:56-65) 아코디언은 이미 게이팅됨. SheetModal의 유일한 연쇄 fade(160ms)는 **명령형** shared value(`contentOpacity.value = withTiming`)라 선언적 게이팅 불가 + `isReduceMotionEnabled` 비동기라 1회성 마운트 fade 시점엔 값 미준비 → 깔끔·안전한 게이팅 경로 없음.

### 앵커 정정 (실행 중 실측)

- A항목의 `removable={slots.length>1}` 인용은 `SlotCard.tsx:104`가 아니라 **`ScheduleSlotsSheet.tsx:172`** (104는 소비부 `{removable && (`).
- A "한 함수 공유"의 실제 형태 = 반쪽 술어 2(`isSlotTimeSet`·`slotHasRoles`) + 합성(`isSlotComplete`) + 배열 가드(`areSlotsComplete`). time/roles는 반쪽만 소비. → 구현 반영됨.

## 세션 기록 (참고)

- 2026-07-23: PR #306 머지(`6035b5e4e`) — 연쇄 입력 + 5관점 리뷰 CRITICAL 3·HIGH 2 수정.
- 2026-07-23: PR #307 머지(`8d703956a`) — 🔴 결함 2건(역할0 급여시트 데드엔드→`ScheduleSlotsSheet` 확인 `disabled` 근원 차단 · 잠긴 행 연쇄 조기종료→`nextUnsetRowAfter` `skipKeys` 그룹 불문 스킵). TDD RED→GREEN→변이 red 2건, 전체 493 suites/5723 green, fable 리뷰 APPROVE(CRITICAL/HIGH 0, MEDIUM 1=본 문서 A항목).
- 이 문서의 A·B·C는 그 리뷰·#306 트리아지의 비차단 후속 — 사용자 결정으로 QA 전 선진행.
