---
area: sources
updated: 2026-07-24
status: current
sources:
  - uniqn-mobile/docs/superpowers/specs/2026-07-23-headcount-daily-basis-display-design.md
  - uniqn-mobile/docs/superpowers/plans/2026-07-23-headcount-daily-basis-display.md
  - uniqn-mobile/src/components/jobs/shared/postingSurfaceModel.ts
  - uniqn-mobile/src/domains/schedule/postingHydrateKeys.ts
  - uniqn-mobile/src/components/jobs/AssignmentSelector/AssignmentSelector.tsx
  - uniqn-mobile/src/utils/date/timeSlotOrder.ts
  - PR#309
  - memory/project_headcount_daily_display_20260723.md
tags: [headcount, display, order-sheet, assignment, hydrate-keys, sort]
---

# 소스: 인원카운트 하루 기준 표시 통일 (PR#309, 2026-07-23~24)

**한 줄:** 그룹 공고 인원 표시를 "하루 기준 분수(분자=날짜별 확정 max)"로 전 화면 통일 — 표시 계층 전용, DB/트리거/저장 형식 완전 불변. squash 머지 `ceb420ac9`.

## 문제 (실측 3종)

1. **화면 간 발산**: 카드는 `딜러 65명 (0/65)`(하루×일수 곱셈), 상세는 `딜러 5명 (0/5)` — 같은 공고가 화면마다 다른 수.
2. **지원화면 마감 절대 미표시**: `AssignmentSelector`가 dead counter(`schedule.roles[].filled`=항상 0)만 읽어 확정이 쌓여도 (0/N) 고정.
3. **시간 슬롯 등록 순서 노출**: `10:00→11:00→10:30` 그대로 렌더(스크린샷 실측).

## 결정·구현 (계약은 [[headcount-daily-basis]] 참조)

- 그룹 요약 분모=하루 요구·분자=**일별 확정 max** (`postingSurfaceModel.ts` buildGroupedSection). 자리 총계(Σ일별)는 `section.totalCount/filledCount`로 보존, 구인자 카드만 `자리 M/T 채움` 병기(`computeSeatTotals`).
- 지원화면에 `extractPostingFilledSubmap` 서브맵 주입 + 그룹 분자 일별 max 승격(인덱스 아닌 **키 매칭**). 마감 역할은 `마감 · 대기 지원 가능` 뱃지 + 선택 허용(RoleCheckbox 비활성 제거).
- `sortTimeSlotsByStart`(utils/date, domains 무의존) — 시작시간 오름차순·TBA 뒤. days/summary가 **같은 정렬 배열을 공유**해 slotIndex 결합 유지, hydrate 매칭은 content 기반 키라 재정렬에 안전.
- `formatDateRangeWithCount` 단일 행화(`8/22(토) ~ 8/23(일) · 2일`) — 카드/상세/지원화면 3소비처가 같은 함수라 한 곳 수정으로 정합.
- 그룹 경계 단일 기준: 지원화면 `getRoleStructureKey`에 `#${requiredCount ?? 0}` — 카드 `areRolesEqual`(headcount)과 동일 축.

## 핵심 교훈

1. **hydrate 키 파생 규칙 중복 = 조용한 (0/N) 회귀 클래스.** 서버 `_posting_slot_key`/`_posting_role_key` 정합 규칙이 `postingSurfaceModel`과 `AssignmentSelector`에 각각 구현돼 있었다 — 드리프트하면 마감이 소리 없이 사라진다([[whitelist-silent-drop]]의 키스페이스 변형). 후속으로 `src/domains/schedule/postingHydrateKeys.ts` 공용 추출(옛 두 구현 전 조합 대조 0 mismatch). **키 규칙은 반드시 단일 소스.**
2. **표시 정렬 도입 시 인덱스 결합을 먼저 찾아라.** days↔summary가 slotIndex로 결합돼 있었고, 같은 정렬 배열 공유가 유일하게 안전한 형태였다. 그룹 max 승격은 처음부터 키 매칭으로 작성해 날짜 간 순서 차이를 견딘다.
3. **광역 스위트가 선행 태스크의 단언 누락을 잡는다.** Task 1이 명시 스위트만 돌려 `PostingSharedContent.test.tsx`의 곱셈 단언을 놓쳤고, 후행 태스크의 광역 실행에서 발견(base 스태시로 선행성 격리 후 별도 커밋 수정). 계약 변경 태스크는 소비처 테스트 전수 스위프 필요.
4. **프로세스 실측**: auto-merge는 Quality Gate(필수 체크)만으로 즉시 발동(E2E 진행 중이어도) — 재확인 2회차. push는 pre-push 훅 hang으로 `--no-verify` 필요(게이트를 직접 실행해 통과 확인한 뒤). Git Bash에서 `cmd /c mklink`는 MSYS 경로 변환으로 실패 — PowerShell `New-Item -ItemType Junction`이 안정.

## 잔여 (머지 시점)

실기기/웹 QA 4항목(PR#309 테스트 플랜: 상세 한 행 정렬·자리 총계 카드 높이·마감 뱃지 줄바꿈·시간 정렬 3면 일치) · 웹/OTA 배포(네이티브 0·마이그 0, 사용자 진행).

## 관련

- [[headcount-daily-basis]] — 이 출하가 확립한 표시 계약(결정)
- [[capacity-full]] — 공고 단위 자동마감(서버 상태)과의 층위 구분
- [[seat-basis-e2e-seed-drift]] — 분모의 원천(좌석 기준 filled_positions)
- [[whitelist-silent-drop]] — 키스페이스 조용한 증발 재발 클래스
- [[order-sheet-form-contract]] — 같은 표시 모델을 쓰는 공고작성 계열
