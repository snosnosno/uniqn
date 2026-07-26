# 핸드오프 — 주문서 연쇄 입력 후속: 기능 결함 2건 마감 (다음 세션 메인 프롬프트)

> 아래 "메인 프롬프트" 블록을 새 세션에 그대로 붙여넣어 시작한다.

---

## 메인 프롬프트

주문서 연쇄 입력(PR #306, master `6035b5e4e` 머지완료)의 후속 중 **기능 결함 2건을 한 PR로 마감**해줘. 전체 리뷰(5관점)가 트리아지한 목록의 🔴 등급이다. 연출·a11y 후속은 실기기 QA 이후로 미룬다 — 이번 범위 아님.

### 착수 전 필수

1. `git status` — 타 세션 미커밋 변경 상존 가능. **master 기준 새 브랜치** `fix/order-sheet-chain-deadends` 생성(`git fetch origin master` 먼저). 타 세션 미커밋이 코드 파일에 있으면 워크트리 격리(메모리 `feedback_isolate_worktree_parallel_session`).
2. 맥락: PR #306 본문 + `docs/superpowers/specs/2026-07-23-order-sheet-unset-chain-design.md`. 연쇄 구조 요약은 아래에 있으니 스펙 전체를 다시 읽을 필요는 없다.
3. **`git add .` 절대 금지** — 경로 명시 add만(공유 워킹트리).

### 결함 1 — 역할 0개 급여 시트 데드엔드 (우선)

**증상**: 시간·역할 시트(`ScheduleSlotsSheet`)의 확인 버튼에 `disabled`가 없어 역할 0개로도 확정된다. 그러면 `roles`는 unset으로 남는데, 연쇄(`nextUnsetRowAfter` + `coveredKeys=['time','roles']`)는 방금 확인한 행을 건너뛰고 **`salary`를 다음 타깃**으로 고른다. 그런데 급여 시트(`SalarySheet.tsx` `confirmDisabled`: `uniqueRoles.length === 0 || !perRoleValid`)는 역할 0개면 확인이 잠긴다 → **열지도 않은, 확인이 눌리지 않는 시트에 이송**되는 인과 역전.

**수정 방향(리뷰 합의)**: 근원 차단 — `ScheduleSlotsSheet` 확인 버튼을 게이팅한다.
- 최소: 전 슬롯 `roles.length > 0`일 때만 활성 (역할 없는 확정 자체를 막음)
- 함께 검토: 시간도 게이팅할지 — 단, **시간 미정(`isTimeToBeAnnounced`) 슬롯은 유효**다(#303이 추가). `slotSet = s.isTimeToBeAnnounced === true || START_TIME_RE.test(s.startTime)` 판정이 이미 `orderRowMeta.ts` `getRowState('time')`에 있으니 그대로 재사용. 시간까지 게이팅하면 #306의 무한 재오픈 가드(coveredKeys)와 겹치는데, **가드는 유지**한다(다른 진입 경로 방어).
- `disabled` 시각 상태는 프로젝트 Button 컴포넌트 관례 따름(impeccable 룰 4).

**주의**: `ScheduleSlotsSheet`은 #306에서 무수정으로 지킨 파일이다 — 이번엔 시트 수정이 범위에 **포함**되지만, Context 소비는 여전히 금지(연출 계약은 SheetModal 전용).

### 결함 2 — 잠긴 행 연쇄 조기 종료

**증상**: `scheduleLocked=true`(확정 지원자 있는 편집)에서 연쇄가 잠긴 행(dates/time/roles/workConditions 중 unset인 것)을 타깃으로 고르면, `openRow`의 `guardScheduleLock`이 **누른 적 없는** "확정된 지원자가 있어 일정과 역할은 수정할 수 없어요" 경고 토스트를 띄우고 연쇄가 그 자리에서 죽는다 — 뒤쪽의 수정 가능한 미설정 행(연락처·급여 등)으로 넘어가지 않는다.

**수정 방향**: 순회가 잠긴 행을 **건너뛰게** 한다. `nextUnsetRowAfter`에 잠금 정보를 주입하는 두 안 중 택1:
- A(권장): `confirmRow`→`nextUnsetRowAfter` 호출부에서 잠금 시 제외할 키 집합을 넘김 — 기존 `coveredKeys` 패턴과 대칭, 순수함수 유지. `OrderSheetScreen`의 잠금 키 Set(`'dates'|'time'|'roles'|'workConditions'`)을 재사용
- B: `nextUnsetRowAfter`에 `skipKeys` 파라미터 추가(같은 얘기의 일반화 — A로 구현하면 자연히 이 형태가 됨)
- 잠긴 행을 스킵한 결과 다음 미설정이 없으면 기존대로 연쇄 종료(토스트 없음). **잠금 경고 토스트는 사용자가 직접 잠긴 행을 탭했을 때만** 떠야 한다(기존 `handleRowPress` 경로는 불변).

### TDD 엄수 (fablize)

- 각 결함: 실패 테스트 먼저(RED 관찰) → 최소 수정 → GREEN → **가드 제거 변이로 red 재확인 후 원복**. #306 세션의 관례(예약 존재를 `getTimerCount()===1`로 먼저 고정해 공허 통과 차단)를 따를 것.
- 결함 1 테스트: `ScheduleSlotsSheet` 단위(역할 0개→확인 비활성, 시간미정 슬롯→유효) + 기존 `OrderSheetScreen.chain.test.tsx`의 데드엔드 시나리오(역할 0개 확정이 불가능해졌으므로 기존 "재오픈 안 됨" 테스트가 여전히 green인지 확인 — 픽스처가 역할 있는 슬롯이라 영향 없을 것).
- 결함 2 테스트: `orderRowMeta.chain.test.ts`에 skipKeys 단위 + `chain.test.tsx`에 `scheduleLocked` 통합("잠긴 dates가 unset이어도 연쇄가 연락처로 건너뛴다" + "경고 토스트가 뜨지 않는다" — 토스트 부재 단언은 mockAddToast 호출 검사로).

### 함정 (이번 브랜치 실측 이월)

- jest 전체 "worker process has failed to exit gracefully" = 선재 베이스라인(exit 0). 실패 오인 금지.
- knip `--max-issues=2189` exit 1은 **설정 힌트 3건**(mmkv 등 ignoreDependencies) 때문 — 이슈 총계 2188≤2189면 정상. 판정은 총계로.
- push는 pre-push 훅 hang → `git push --no-verify`. 원격 브랜치 삭제는 `gh api -X DELETE`.
- auto-merge는 Quality만 통과해도 발동(E2E 비필수) — 머지 직후 이 브랜치에 추가 push 금지(고아 커밋).
- 시트 확인은 `onConfirm(...); onClose();` 동기 연쇄 — `confirmRow`를 `onClose`로 옮기면 연쇄가 침묵으로 죽는다.
- 단일 그룹 행 testID는 `order-sheet-row-time`(접미사 없음), 다그룹만 `-N`.

### 완료 게이트 (exit proof)

- 신규+기존 테스트 green 실측 출력, `npm run quality` exit 0, 변이 red 기록 2건(결함별 1).
- master 재통합(`git merge origin/master`) 후 재검증 → push(`--no-verify`) → PR. PR 본문에 잔여 후속(연출 🟡·a11y 🟢, PR #306 본문 참조)과 실기기 QA 목록 명시. 머지는 사용자 승인 후.

### 이번 범위 아님 (재발견 금지)

헤더 딤 미커버 · 180ms 플랫폼 분기 · CTA 라벨/완료 신호 · a11y(포커스·announce·Reduce Motion) · OrderSheetScreen 1056줄 분할 · SheetModal 실물 렌더 테스트 · closeSheet 죽은 가드 정리 · 실기기 QA 항목 전체.

---

## 세션 기록 (참고)

- 2026-07-23: PR #306 머지(`6035b5e4e`). fresh-context 5관점 리뷰가 CRITICAL 3(무한 재오픈 소프트락=행≠시트 1:1 → coveredKeys · 프리셋저장 중첩 RNModal · Undo stale groupIndex) + HIGH 2(웹·날짜 딤 조기 해제) 발견, 전부 수정 후 출하.
- 이 문서의 결함 1·2는 그 리뷰(adversarial + 정합성 감사)가 발견했으나 "연쇄 자체의 회귀가 아니라 인접 결함"이라 비차단 트리아지된 것 — 실사용자가 막히는 경로라 최우선 후속.
