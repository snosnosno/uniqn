# 핸드오프 — 주문서 미설정 항목 연쇄 입력: 전체 리뷰 + 출하 게이트 (다음 세션 메인 프롬프트)

> 아래 "메인 프롬프트" 블록을 새 세션에 그대로 붙여넣어 시작한다.

---

## 메인 프롬프트

`feat/order-sheet-unset-chain` 브랜치(로컬, 미push)의 전체 리뷰를 신선한 컨텍스트로 수행하고, 통과하면 출하 게이트(push → PR)로 진행해줘.

### 무엇이 구현됐나

공고작성 주문서(`OrderSheetScreen`)에서 **미설정 항목의 `확인`을 누르면 목록 복귀 없이 다음 미설정 항목 시트로 이어지는** 연쇄 입력. 구현 세션은 SDD(태스크별 구현자+fable 리뷰어)로 진행했고 최종 브랜치 리뷰까지 1회 완료 — 이번 세션의 목적은 **구현 세션의 맥락을 공유하지 않는 눈으로 다시 보는 것**이다.

- 설계 스펙: `docs/superpowers/specs/2026-07-23-order-sheet-unset-chain-design.md`
- 구현 계획: `docs/superpowers/plans/2026-07-23-order-sheet-unset-chain.md`
- SDD 진행 원장(리뷰 이력·변이 실측·이월 전부): `.superpowers/sdd/progress.md`

### 브랜치 상태 (base `0b2b7c3cd`, 총 10커밋 = 코드 6 + 문서 4)

```
ece8ca9ee fix: 연쇄 대기 창 레이스 3종 — 타입전환·프리셋·잠금차단   ← 최종 리뷰 지적 해소
230f01ad1 docs: 변경 이력 기록 (wiki/log.md + CHANGELOG)
7d1aa391a fix: 연쇄 딤 영구 잔존 차단 — 날짜 시트 경로 + 예약취소 안전망
e06b86fbd feat(ui): 전환 연출 — 딤 인수인계 + 제자리 fade 진입
79ae03886 fix: 그룹 삭제 시 예약 취소 + getValues 계약 회귀 가드
e9352547e feat: 연쇄 입력 배선 — 확인 시 다음 미설정 시트로
453ca0b7a test: nextUnsetRowAfter groupIndex 매칭 회귀 가드
a6c39c222 feat: 행 순회 함수 — orderedRowTargets · nextUnsetRowAfter
```

위 8커밋(코드 6 + 이력 문서 2)이 리뷰 대상 코드 상태. 이후 문서 2커밋(이 핸드오프 + 계획서 `SheetChainContext` 경로 as-built 정합)이 더 얹혀 있다 — 코드 diff 없음.

코드 변경 7파일: `orderRowMeta.ts`(+54) · `OrderSheetScreen.tsx`(실질 +~150, 대부분 리인덴트) · `SheetChainContext.tsx`(신규 22줄, `ui/`) · `SheetModal.tsx`(+30) · `animation.ts`(+14) · 테스트 2신규(chain 16건 + 순회 12건). **시트 12개(`sheets/*.tsx`) 변경 0줄.**

### 구현 세션 종료 시점의 게이트 실측 (2026-07-23)

- `npm test`: **491 suites / 5667 tests / 122 snapshots 전건 green, exit 0** (ece8ca9ee 포함)
- `npm run quality`: exit 0 (경고 64건은 선재 no-empty-function 등)
- `tsc --noEmit`: 0 에러 · knip: 신규 export 전부 소비 확인
- controller 독립 변이 검증 5회 — 전부 대응 테스트만 red 후 원복 확인

### 핵심 설계 결정 (리뷰 시 전제)

1. **A+ 아키텍처**: 연쇄는 `OrderSheetScreen` 라우팅 문제로 취급, 시트 12개 무수정. 전환 연출은 `SheetChainContext`(Context, 기본값 null)로 `SheetModal`에만 전달.
2. **순회는 `nextUnsetRowAfter`** — current **다음부터** 순환(전역 첫 미설정 아님), 한 바퀴 돌면 null(확인 후에도 unset인 행의 무한 재오픈 구조적 차단).
3. **무장(arm) 판정** — 미설정 행으로 열었을 때만 연쇄. 채워진 행 수정은 단발 편집.
4. **`SHEET_CHAIN_SWAP_MS=180`** — 주문서 시트는 조건부 렌더라 exit 애니메이션이 없고, 대기는 iOS 네이티브 모달 겹침 회피용(시각 대기 아님). 문제 시 300 상향 여지를 상수로 분리.
5. **날짜 시트 절충** — `ScheduleDatesSheet`만 `DatePickerModal`(ui/Modal) 래핑이라 Context 미소비. 연쇄가 dates로 갈 때는 `openRow`에서 딤을 걷는다(연출 미적용, 스펙 수용 절충).

### 이번 리뷰에서 봐줬으면 하는 것

1. **다각 리뷰** (구현 세션이 못 본 관점): 설계 정합성 재검 + **UX 관점**(연쇄 흐름이 실제로 "끊기지 않는 입력"인가 — 특히 딤 인수인계·제자리 fade가 목적을 달성하는 구조인지) + 보안 관점(입력 경로 변화 없음 확인) + 테스트 포착력 표본 재검(원장의 변이 기록을 그대로 믿지 말 것).
2. **레이스 조합 재수색**: 구현 세션이 잡은 레이스는 그룹삭제·타입전환·프리셋적용·잠금차단 4종. `clearPendingSwap` 호출부는 현재 6곳(handleRowPress·handleDeleteGroup·handleAddSchedule·handleTypeChange·handleApplyPreset·unmount) — **아직 안 잡힌 폼 구조 변경 경로가 남았는지** 전수 수색(딤은 pointerEvents:none이라 대기 창 중 화면 전체가 탭 가능함을 전제로).
3. **H4 (LOW, 최종 리뷰 발견)**: 스펙의 "+ 일정 추가 → 날짜 확인 후 시간·역할로 이어진다"는 대부분 거짓 — add 분기가 직전 그룹 timeSlots를 깊은복사 시드하므로 직전 그룹이 완료면 즉시 set 판정되어 연쇄가 멈춘다. 실동작이 오히려 방어적이라 코드가 아니라 **스펙 문서를 고칠지, 제품 의도(새 그룹은 시드를 무시하고 시간·역할 확인을 강제)로 코드를 바꿀지** 제품 판단이 필요하다.
4. 통과 시 **출하 게이트**: push + PR 생성 (master 직접 push 금지 — branch protection이 e2e를 우회함, 메모리 규칙). PR 본문에 실기기 QA 잔여를 명시.

### 알려진 잔여 (재발견에 시간 쓰지 말 것)

- **실기기 QA 전용** (jsdom 관측 불가): iOS 180ms 터치 라우팅 / 번쩍임·이중 어두워짐 / Android 키보드 열린 시트 전환 / 웹 WebSheetModal 연출 / Reduce Motion / `isChainEntryRef` 마운트 고정(SheetModal 실물 렌더 테스트가 레포 전체 0건 — 29개 소비처 전부 모킹)
- **후속 PR 후보** (이번 머지 비차단, 최종 리뷰 트리아지 완료): ①`OrderSheetScreen.tsx` 1056줄 분할(base부터 800 초과) ②SheetModal 실물 렌더 테스트(e2e/Detox 과제)
- **불필요 판정 완료**: `getRowState` optional 하드코딩(선재 죽은 분기) / SheetChainContext 미소비 래퍼 재발 클래스(주석+리뷰어 메모리로 방어)

### 함정 (구현 세션 실측)

- **변이 검증 후 반드시 `git checkout -- <파일>` 원복 + `git status` 확인.** 워킹트리에 타 세션 미커밋 변경(.mcp.json·docs/planning/*·.claude/) 상존 — **`git add .`/`git add docs/` 절대 금지**, 경로 명시 add만.
- jest 전체 실행 시 "A worker process has failed to exit gracefully" 경고는 **선재 베이스라인**(exit 0, 이전 원장에도 기록). 실패로 오인 금지.
- jest 경로 패턴 `'app/(employer)/my-postings'`는 Windows에서 0건 매치 — `my-postings`로 쓸 것.
- 예약 취소 시 딤 해제를 SheetModal 계열 시트 탭으로 검증하면 **onEntered가 딤을 대신 걷어 가드를 제거해도 green**(공허). `clearPendingSwap`이 유일 해제 주체인 경로(그룹삭제·일정추가·언마운트)로만 검증 가능.
- 모든 시트는 `onConfirm` 직후 `onClose` 호출 — `confirmRow`를 `onClose`로 옮기면 연쇄가 침묵으로 죽는다. `closeSheet`의 딤 해제는 예약 존재로 분기해야 한다(무조건 해제 시 번쩍임 복귀).

### 착수 명령

```bash
cd /c/Users/user/Desktop/T-HOLDEM && git checkout feat/order-sheet-unset-chain
git log --oneline 0b2b7c3cd..HEAD           # 10커밋 확인 (코드 6 + 문서 4)
cat .superpowers/sdd/progress.md             # 구현·리뷰 이력 전체
cd uniqn-mobile && npx jest src/components/employer/order-sheet my-postings   # 265+/265+ 기대
```

---

## 세션 기록 (참고)

- 구현 세션: 2026-07-23, SDD 4태스크 + 태스크별 fable 리뷰 + 최종 브랜치 리뷰 1회
- 리뷰가 잡아낸 것: groupIndex 매칭 무검증(T1) · 그룹삭제 silent data loss + getValues 계약 무가드(T2) · **딤 영구 잔존 CRITICAL**(T3, 날짜 시트 Context 미소비) · 레이스 3종(최종, 타입전환 phantom '근무조건' 시트 실측 포함)
- 브리프 오류를 구현자가 잡은 것: 테스트 건수 오산 2건 · getByText 중복 매치 · getTimerCount 공허 단언 · Windows 경로 패턴 0매치 · 예약취소 딤 테스트 공허성
