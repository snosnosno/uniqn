# 다음 세션 착수 프롬프트 — 조건 유도 그룹핑 구현

> 설계 정본: `docs/planning/2026-08-06-condition-derived-grouping-design.md` (커밋 `58214308e`)
> 이 트랙은 `2026-07-31-execution-session-prompts.md` 실행 원장 **밖**의 독립 트랙이다.

---

## 붙여넣을 프롬프트

```
공고 작성 일정 섹션 "조건 유도 그룹핑"을 구현한다.

설계 정본을 먼저 Read: docs/planning/2026-08-06-condition-derived-grouping-design.md
§3(핵심 설계) · §3.9(화면 명세) · §9(테스트) · §11(결정 감사) · §12(태스크 17건)이 계약이다.
autoplan 3페이즈 리뷰(CEO·Design·Eng)를 이미 완주했고 미결 결정은 0건이다 — 설계를
재논의하지 말고 §12 순서대로 TDD로 구현하라.

착수 순서 (§12):
1. T1/E1/E3 — normalizeScheduleGroups 신설 (규칙 0~4 + 정준 시그니처 + setRunGrouped)
2. T2/D3 — ScheduleSection 신설 (단일 카드 축약·빈 상태·미완성 muted·캡션)
3. D1/E2 — 체이닝 보존 + orderRowMeta 날짜집합 좌표계
4. T3/D2 — 예외 추출 (시트 0개 선택 시작 · 3중 진입로)
5. T4/E4 — 고지 4종 + 소멸 Undo + dedupe 고지
6. T6 세그먼트 제거 · D4/D5 모션·a11y · T5 관측 이벤트 · E5/T7 검증 게이트

각 단계는 테스트 먼저(RED) → 구현(GREEN) → 다음 단계. 단계마다 커밋.
```

---

## 세션 시작 전 확정 사항 (재논의 금지)

| 항목 | 확정 |
|---|---|
| 범위 | 전면 재설계 — 리뷰어의 "단계 출하 강등" 권고는 사용자가 기각(정식 출시 전) |
| 승계 UX | **A안** — 인접 카드 휴리스틱 + 토스트 + [다른 조건으로] 액션시트 |
| grouped 싱글턴 | **강등 승인** — 신 정규형. 행동 중립(지원자 화면 무영향) 검증됨 |
| 채택 확장 | 관측 이벤트 4종(§8.6) · 암묵 동작 고지(병합·승계) |
| 이연 | 기간 템플릿 프리셋 · 공고 복제 버튼 → `TODOS.md` 기록 완료 |

## 워크트리 / 브랜치

현재 워크트리 `C:\Users\user\Desktop\T-HOLDEM-datepick`, 브랜치 `fix/date-picker-guidance-merge`에
**문구 개선 3커밋 + 설계 1커밋**이 있다. 둘 중 하나 선택:

- **(a) 권장** — 문구 3커밋을 먼저 PR·머지(즉시 개선, 리스크 0) → 머지 후 `origin/master`에서
  새 브랜치 `feat/condition-derived-grouping` + 새 워크트리로 구현 착수.
- (b) 같은 브랜치에서 계속 — 문구 커밋이 어차피 세그먼트 삭제로 대체되므로 PR 하나로 합침.

새 워크트리를 만들면 `node_modules` 정션 필수:
`powershell -NoProfile -Command "New-Item -ItemType Junction -Path '<새워크트리>\uniqn-mobile\node_modules' -Target 'C:\Users\user\Desktop\T-HOLDEM\uniqn-mobile\node_modules'"`

## 착수 즉시 밟는 함정 (설계에 근거 있음)

1. **`mappers.test.ts:296`·`:317`은 "그린 유지"가 아니라 단언 교체 대상** — 강등 신 정규형 때문.
   그린으로 만들려고 구현을 비틀지 말 것(§3.1 규칙 2).
2. **빈 `dates` 그룹은 원형 보존**(규칙 0) — 없으면 템플릿 프리셋의 2번째 조건이 침묵 유실된다.
3. **confirm 핸들러는 `form.getValues()` 필수** — watch/렌더 클로저 금지(정규화 재정렬 후 stale
   클로저가 엉뚱한 카드에 덮어쓴다). 현행 `OrderSheetScreen.tsx:1104`가 이미 그 형태다.
4. **`normalize`를 watch 기반 useEffect에서 호출 금지** — 무한 재검증 루프.
5. **orderRowMeta는 과소 견적** — `OrderRowTarget{key,groupIndex}`·`nextUnsetRowAfter`·
   `getRowState`·submit 에러 라우팅·CTA 라벨이 전부 인덱스 좌표계다(§5 표).
6. **`e2e/`는 `npm run quality` 범위 밖** — 삭제하는 문구·testID(`order-sheet-dates-segment-*`,
   `+ 일정 추가`)를 page object 간접 참조까지 Grep하고 **0건도 명시 기록**.
7. Bash `grep`이 `app/` 트리에서 조용히 0건 나오는 이력이 있다 — **Grep 도구 + tsc 교차검증**.

## 금지 (설계 비목표)

- 저장 형식·왕복 매퍼 쓰기 방향·지원자 화면(`AssignmentSelector`)·zod 스키마 변경 **0건**
- 마이그레이션·RPC·Edge Function 손대지 않는다(순수 클라이언트 변경)
- 비연속 날짜 묶음지원 구현 시도 금지(스키마 한계, 명시적 포기)

## 검증 명령 (완료 주장 전 실행)

```bash
cd uniqn-mobile
npx jest src/utils/order-sheet src/components/employer/order-sheet src/components/employer/job-form/modals
npx tsc --noEmit
npm run quality
```

E5(edit 로드→무편집 저장 의미 동등)는 가장 값싼 안전망이므로 **마지막이 아니라 T1 직후** 추가해도 좋다.

## 참고 아티팩트

- 화면 목업(HTML): https://claude.ai/code/artifact/1ced75ac-9b7b-4b75-9c89-7b6bb7aa0d91
- 테스트 플랜 / 태스크 JSONL: `~/.gstack/projects/snosnosno-uniqn/`
  (`user-fix-date-picker-guidance-merge-test-plan-*.md`, `tasks-{ceo,design,eng}-review-*.jsonl`)
- Codex는 이 머신에서 `gpt-5.4` 미지원 400으로 실패한다 — 리뷰는 subagent(fable)로 갈 것.
