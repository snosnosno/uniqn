# 핸드오프 — 주문서 연쇄 연출/a11y 잔여 (다음 세션 메인 프롬프트)

> 아래 `---` 아래 블록 전체를 다음 세션 첫 프롬프트로 붙여넣는다.

---

주문서 연쇄 입력 후속 폴리시의 **잔여 3~4건**(B1 딤 헤더 커버 · B3① CTA 라벨 예고 · C2 포커스 이동 · C3 판단 확인)을 이어서 진행한다. 직전 세션에서 **A(리뷰 MEDIUM)·B2·C1·B3② 완료**했다. 원 계획서 = `docs/planning/2026-07-23-order-sheet-polish-a11y-medium-handoff.md`(§진행 결과에 완료·보류 근거·앵커 정정 전부 기록됨) — **진실원, 먼저 읽어라.**

## 착수 전 필수

1. **⚠️ 브랜치 위생 먼저 결정.** 직전 세션의 코드 4커밋(`c2d57f276`·`b26a6ee58`·`89904e546`·`9273fcf1b`)이 브랜치 `feat/order-sheet-chain-polish`에 있는데, **다른 세션이 같은 워킹트리에서 salary JIT·headcount 설계 docs 커밋을 같은 브랜치에 뒤섞어** 놓았다(코드 파일과 서로 disjoint, 충돌·오염 없음). `git log --oneline origin/master..HEAD`로 현 상태 확인 후:
   - 깨끗한 PR을 원하면 → 코드 4커밋만 새 브랜치로 `git cherry-pick` 후 그 위에서 잔여 작업.
   - 다른 세션이 여전히 활성이면(`git status`에 내가 안 만든 미커밋 코드) → **새 워크트리+브랜치 격리**(메모리 `feedback_isolate_worktree_parallel_session`·`feedback_worktree_node_modules_junction` mklink /J).
2. `git fetch origin master` 재통합(stale base 무효). push는 pre-push 훅 hang → `--no-verify`, auto-merge는 Quality만으로 발동(머지 직후 push 금지).
3. **`git add .` 절대 금지** — 경로 명시 add만(공유 워킹트리).
4. 판단 기준: `.claude/rules/impeccable-design.md`(룰 8 모션·11 라벨·17 햅틱·12 절제) + 로컬 스킬 `emil-design-eng`·`apple-design`. TDD = `superpowers:test-driven-development`(RED→GREEN→변이 red 엄수, fablize 게이트).

## 잔여 작업 (우선순위·근거는 원 핸드오프 §진행 결과 참조)

### B1 — 딤이 헤더 미커버 (🟡, 최우선, **실물 렌더 관찰 필수**)
- **정밀 특성화 완료(직전 세션)**: `StackHeader`는 Expo 내비 헤더가 아니라 `app/(employer)/my-postings/create.tsx:234`·`[id]/edit.tsx`의 `SafeAreaView` 안에서 `OrderSheetScreen`의 **형제 View**(+`VenueSelectChips`)로 렌더된다. 스크림(`OrderSheetScreen.tsx:885` 근처 `order-sheet-chain-scrim`, absolute-fill)은 `OrderSheetScreen` 내부라 그 형제인 상단 헤더 띠를 **못 덮는다** → 180ms 스왑 갭 동안 헤더가 번쩍인다. (핸드오프 원문 옵션 ③"이미 덮임"은 **오답**으로 확정.)
- **해야 할 것**: 스크림을 헤더 위 레이어로 올리는 설계. 후보 — ① `chainSwapping`을 호스트로 노출(콜백)해 `SafeAreaView` 레벨에서 헤더까지 덮는 스크림 렌더(호스트 2파일) · ② 웹 포털/네이티브 처리. **제약**: 중첩 RN Modal 금지(#244) — 스왑 갭엔 다른 Modal이 없어 스크림-only Modal은 비중첩이나, 다음 시트 마운트와 겹치는 순간 위험. `SafeAreaView` 레이아웃 회귀 주의.
- **fablize 그라운딩 강제**: 웹 `npm start` 후 **실제 렌더에서 갭 구간 관찰**(정적 파싱 금지). 관찰로 드러난 것만 수정→재실행. 관찰 불가면 착수 보류하고 그 사유 명시.

### B3① — 연쇄 CTA 라벨 예고 "다음: 장소" (🟡, **제품 판단 종속**)
- 미설정 행을 연 경우(연쇄 무장) 시트 확인 버튼을 "다음: <목적지>"로. 다음 타깃은 열 때 `nextUnsetRowAfter`(orderRowMeta.ts:609) 예측 → 확인 중 폼 변화로 **어긋날 수 있음**(부정확 라벨 vs 무라벨 트레이드오프). 시트 8종 확인 버튼에 `confirmLabel` prop 주입 필요(넓은 표면).
- **먼저 사용자에게 "부정확 라벨 감수 vs 무라벨 유지" 확인** 후 착수. 라벨 소스 = `getRowState(values, next.key, next.groupIndex).label`(직전 세션 C1이 같은 소스 사용).

### C2 — 연쇄 새 시트 포커스 이동 (🟢, 리스크 높음)
- `setAccessibilityFocus`/`findNodeHandle` **코드베이스 선례 0** + SheetModal 테스트 인프라 없음. 네이티브는 RNModal 재마운트가 VoiceOver 포커스를 부분 자동 이동(OS). **웹 경로만** 가치 큼(WebSheetModal은 이전 포커스 blur만 하고 신규 미설정) — RN-web focusability(title에 tabIndex + focus()) 검증 후 웹-only로 착수 권장. SheetModal 테스트 신설 필요.

### C3 — Reduce Motion (판단: **무변경 적정 — 재확인만**)
- 직전 세션 판정: 연쇄 전환은 이미 reduce-motion 친화(딤 `OrderSheetScreen.tsx:885` 무애니메이션 즉시 · 슬라이드 없음 · SheetModal 연쇄는 cross-fade 160ms만 = 권장 대체형). `SlotCard.tsx:56-65` 아코디언 이미 게이팅. SheetModal의 유일 fade는 **명령형** `contentOpacity.value = withTiming`(SheetModal.tsx:316) + `isReduceMotionEnabled` 비동기라 1회성 마운트 시점 값 미준비 → 깔끔한 게이팅 경로 없음. **새 근거 없으면 무변경 유지, 문서로 종결.**

## TDD·완료 게이트 (fablize)
- 각 항목: 실패 테스트 먼저(RED 관찰) → 최소 수정 → GREEN → 대표 가드 제거 변이 red 후 원복. 공허 통과 차단(전제 고정 단언 먼저).
- 완료 주장 전 이 세션 실행 출력으로만: 신규+기존 테스트 green · `npm run quality` exit 0(파이프 없이 실측) · 변이 red 기록. B1은 실물 렌더 관찰 1회(웹) 증거.
- 머지는 사용자 승인 후. PR 본문에 실기기 QA 목록(연출 체감·iOS 180ms·Reduce Motion 실기기·연쇄 완료 햅틱) 명시.

## 함정 (직전 세션 실측 이월)
- **행≠시트 1:1** — 시간·역할 두 행 = `ScheduleSlotsSheet` 하나. coveredKeys(그룹 스코프)·skipKeys(그룹 불문, 잠금) 가드 유지.
- 시트 확인은 `onConfirm(...); onClose();` **동기 연쇄** — `confirmRow`를 `onClose`로 옮기면 연쇄 침묵사.
- **예약취소 딤 해제 테스트는 SheetModal 계열 시트 탭으로는 공허**(chain.test.tsx:470 주석) — 일정추가·그룹삭제·언마운트 경로로만.
- chain.test.tsx는 SheetModal을 **완전 모킹** → C2 포커스 등 SheetModal 실동작은 이 파일로 검증 불가. SheetModal 단위 테스트 신설 필요.
- 완료 신호 햅틱은 `triggerHaptic('success')`(src/utils/haptics.ts, 200ms throttle). chain.test에서 `jest.mock('@/utils/haptics')` 후 spy.
- `SHEET_CHAIN_SWAP_MS`는 이제 `sheetChainSwapMs(Platform.OS)` 파생(jest=ios→180). 테스트가 상수 직접 import해 타이머 감음 — 회귀 없음.
- 단일 그룹 행 testID는 `order-sheet-row-time`(접미사 없음), 다그룹만 `-N`. jest 전체 "worker process failed to exit"는 선재 베이스라인(exit 0). knip 래칫 이슈 총계≤2189.

## 이번 범위 아님 (재발견 금지)
OrderSheetScreen 1056줄 분할 · SheetModal 실물 렌더 테스트(C2 신설 제외) · 실기기 QA 수행 자체 · 웹/OTA 배포 · `SHEET_CHAIN_SWAP_MS` iOS 값 변경(QA 종속) · "워크스페이스"→"사업장" 개명.

---

## 진행 결과 (2026-07-23 실행 세션 — 워크트리 `T-HOLDEM-chain-polish`, 브랜치 `feat/order-sheet-chain-polish-v2`)

**브랜치 위생**: 구 브랜치 `feat/order-sheet-chain-polish`에 타 세션 docs 커밋 4개 혼입 + 워킹트리에 타 세션 미커밋 코드(`PostingScheduleContent.tsx`) 상존 → **새 워크트리 + origin/master 기준 새 브랜치**에 코드 4커밋만 cherry-pick(충돌 0) 후 작업. ⚠️ 워크트리에 `.env.local` 미존재 → 웹 앱 초기화 실패(환경변수 zod) — 메인에서 복사 필요(신규 함정).

| 항목 | 판정 | 커밋 | 근거 |
|---|---|---|---|
| **B1** 딤 헤더 커버 | ✅ 구현 | `299cd96ae` | 후보 ① 채택: `onChainSwappingChange` prop(제공 시 내부 딤 미렌더=이중 적층 방지, `updateChainSwapping` 단일 경로) + 공용 `OrderSheetChainScrim`(View, 非Modal=#244 무위험)을 create/edit가 SafeAreaView 마지막 자식으로 렌더. TDD RED→GREEN(28/28)→통지 제거 변이 red→원복 |
| **B3①** CTA 라벨 예고 | ❌ 무라벨 유지 | — | **사용자 결정(2026-07-23)**: 부정확 라벨 리스크·시트 8종 표면 확대 대비 이득 부족. C1 스크린리더 안내가 전환 예고를 이미 제공. 종결 |
| **C2** 포커스 이동 | ✅ 웹 전용 구현 | `e054955cf` | WebSheetModal 연쇄 진입 이중 rAF 뒤 제목 래퍼(tabIndex -1)에 `focusIfPossible`(DOM 가드 헬퍼, 네이티브 no-op). 일반 오픈 무변경(절제). SheetModal 단위 테스트 신설(`SheetModal.chainFocus.test.tsx`, platform 모킹+rAF flush). TDD RED→GREEN(4/4)→focus 제거 변이 red→원복 |
| **C3** Reduce Motion | ✅ 무변경 종결 | — | 재확인 실측: 연쇄 fade는 여전히 명령형 `contentOpacity.value=withTiming(160ms)`(네이티브)/CSS transition 160ms(웹)·딤은 무애니메이션 즉시 — cross-fade 자체가 reduce-motion 권장 대체형. 새 근거 없음 |

**실물 렌더 관찰(fablize 그라운딩, 웹 localhost:8090 — 워크트리 서버·employer 리뷰계정)**: 제목 확인→장소 연쇄 전환 중 MutationObserver 계측 — 호스트 스크림 rect `{top:0,left:0,1049×869}`=**뷰포트 전체(StackHeader 포함) 커버** 4회 일관, 내부 스크림 미등장(이중 딤 없음). 전환 후 `document.activeElement`=tabIndex -1 DIV("어디서 일하나요?")=**C2 포커스 실동작 확인**.

**검증**: 주문서+ui+헬퍼 52 suites/456 green · `npm run quality` exit 0(0 errors) · 변이 red 2건(B1 통지 제거·C2 focus 제거) 기록.

**리뷰 판정(전부 완료)**: opus 태스크 리뷰 2건 APPROVE(B1 MEDIUM=안정 콜백 footgun→`7948ed083` JSDoc 반영 · C2 LOW 2=header role 부재·이중 낭독 가능성→실기기 QA 항목화) + **fable 최종 게이트 APPROVE**(CRITICAL/HIGH 0. 비차단: 동일 MEDIUM — 구조 해소는 cleanup ref 분리 선택 후속 · LOW 선재=WebSheetModal visible=true 언마운트 시 body overflow/포커스 복원 미실행 — 이 diff 무관, 웹 QA 참고).

**잔여(사용자 게이트)**: ①push/PR 승인 ②실기기 QA(iOS 헤더 커버 체감·VoiceOver 이중 낭독·웹 body overflow 참고) ③웹/OTA(요청 시) ④구 브랜치 `feat/order-sheet-chain-polish`(docs 4커밋 혼입) 정리 방침 — docs 커밋은 headcount/salary 세션 소유라 임의 삭제 금지.
