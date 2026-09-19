---
name: pattern-empty-group-producer-sweep-and-zero-candidate-deadend
description: 머지 후 잔존결함 리뷰 2대 발견 — ① 정규화 '원형 보존' 예외로 들어오는 생산자를 grep 할 때 **화면 밖(app/ 라우트) 생산자**를 빼먹으면 같은 좀비가 살아남는다 ② "후보가 2개 미만이면 행을 숨긴다" 최적화 + "최소 1개 필수" 게이트가 합성되면 후보 0 에서 확인이 영구 잠긴다
metadata:
  type: feedback
---

PR#425(조건 유도 그룹핑, `f0b310205`) **머지 후** 잔존결함 리뷰 실증. 575/575 order-sheet 테스트 green·다크 래칫 green 인 상태에서 2건 검출.

## ① 생산자 전수 grep 은 `app/` 라우트까지 — 화면 파일만 보면 형제를 놓친다

선행 리뷰가 `templateToValues` 의 `{...g, dates: []}`(grouped:true 잔존)를 잡아 `grouped: false` 를 추가했는데,
**같은 형상을 만드는 형제가 `app/(employer)/my-postings/create.tsx:113` 에 있었다** — "마지막 공고" 프리셋의
`(values.scheduleGroups ?? []).map((g) => ({ ...g, dates: [] }))`. 이 파일은 PR diff 에 **없어서**
"이번에 바뀐 파일"만 훑으면 안 보인다. 프리셋 적용은 `form.reset(v)` 라 정규화를 안 타므로 그대로 폼에 앉는다.

증상: 날짜가 없는 동안 토글이 렌더되지 않아(`dates.length>1` 가드) `grouped:true` 가 **화면에서 사라진 채 잠복**하다가,
사장이 연속 2일을 고르는 순간 "통째로 지원받기"가 켜진 채 부활한다 = 사장이 켠 적 없는 지원 제한.

**How to apply:** 정규화 예외(빈 그룹 원형 보존 등)로 들어오는 생산자는 `grep -rn "dates: \[\]" src app` 처럼
**src 와 app 을 함께** 훑는다. 방어 가드(`dates.length>1`)가 있으면 결함이 **보이지 않게만** 되고 값은 남는다 —
가드 존재 ≠ 생산자 무결. 실증 프로브: 그 형상을 initialValues 로 주고 날짜 확정 후 `Switch.props.value` 단언.

## ② "후보 2개 미만이면 숨김" × "최소 1개 필수" = 후보 0 에서 영구 잠금

`ScheduleSlotsSheet` 는 `showDatePicker = candidates.length > (requiresDatePick ? 0 : 1)` 로 날짜 행을 숨기고,
`canConfirm = slotsComplete && (!requiresDatePick || picked.length > 0)` 로 확인을 잠근다.
후보 0 + requiresDatePick 이면 **고를 UI 가 없는데 고르라고 요구**해 확인이 영원히 disabled.
도달 경로 = 템플릿/마지막공고 프리셋 적용 직후(공고 날짜 0, 조건 카드 N개)에서 조건 행 탭.
같은 파일의 `openRow` 는 **'dates' 행**에 대해서만 `otherDates` 전제로 이 함정을 막아 놨다 —
**'time'/'roles' 행 진입은 같은 가드가 없다**(축 하나만 막은 비대칭).

**How to apply:** "필수 선택" 게이트와 "후보 적으면 UI 숨김" 최적화가 같은 컴포넌트에 있으면
**후보 0 케이스를 반드시 테스트한다**. 기존 테스트가 `requiresDatePick` 을 항상 후보 3개와 함께 넘기면
빈 통과다(실측: 전용 describe 3건 전부 `selectableDates=CARD_DATES`).

## 곁다리(같은 리뷰에서 확인)

- `diagnoseScheduleChange` 는 ②를 집합·③을 `expectedDateCount` 로 고쳐 선행 오발화 2건이 실제로 죽었다.
  남은 오발화 1건 = **묶음 토글 OFF** → 카드 재병합으로 `after.length < before.length` → "같은 조건이라
  하나로 합쳐졌어요" + `order_sheet.auto_merge` 발화. `bundleToggledByUser` 는 ②만 막는다.
- 날짜 시트(DatePickerModal)가 전 일정 스코프 **해제** 도구가 됐는데 확인 라벨은 여전히 `${n}개 추가`,
  0개 선택은 confirm disabled → 전체 해제 불가. 어휘가 스코프 전환을 안 따라갔다.
- 불변성 감사 무결: `mergeBySignature` 의 `existing.dates.push` 는 로컬 빌더, `withAdded[i]=` 는 map 사본.
  입력 무변형 테스트도 실재(`normalizeScheduleGroups.test.ts:262`).
- e2e 무사: `order-sheet-row-dates` 만 소비하고 빈/채움 양쪽 유지. 제거된 세그먼트 문구는 e2e 에 없음.

관련: [[pattern-condition-grouping-gate-retrofit-and-zombie-reentry]] · [[pattern-diff-diagnosis-notice-user-action-misfire]]
