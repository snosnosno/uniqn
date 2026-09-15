---
area: sources
updated: 2026-09-15
status: current
sources:
  - docs/planning/2026-09-13-employer-ia-session-prompts.md
  - docs/planning/2026-09-15-employer-ia-s5-session-prompt.md
  - uniqn-mobile/app/(employer)/my-postings/[id]/index.tsx
  - uniqn-mobile/src/features/employer/tab/EmployerMoreMenu.tsx
  - uniqn-mobile/src/components/workSchedule/VenueDayPanel.tsx
  - uniqn-mobile/src/components/job-posting/CollaboratorRow.tsx
  - uniqn-mobile/supabase/migrations/20260813150000_job_posting_collaborator_role.sql
  - PR#490
  - PR#492
  - PR#493
  - PR#494
  - PR#495
  - memory/project_employer_ia_redesign
tags: [employer, ia, work-schedule, workspace, collaborator, settlement, a11y, worktree]
---

# 구인자 IA 재설계 웨이브 (2026-09, S1~S5)

**한 줄:** 공고 상세 진입점 12→3, 정산 **워크플로우** 제거(금액만), 내 공고 탭 `[공고]/[근무표]` 세그먼트, 근무표 출처 표시, 팀·협업자 범위 문구까지 5 슬라이스. **DB 컬럼·RPC·트리거·pgTAP 변경 0** — 전량 클라이언트라 OTA 전에는 사용자에게 안 닿는다. 웨이브 전체를 관통한 규칙은 [[entry-point-stability]].

## 착지

| 슬라이스 | PR · 머지 | 내용 |
|---|---|---|
| 선행 | #490 `4135b757e` | 근무표 진입점 복원(#488 헤더 아이콘 되돌림) + P0 2건(목표 인원 덮어쓰기 → `manualTarget`/`derivedRequired` 분리 · 지점 미선택 무음 유실) |
| S1·S2·S1b | #492 `342a1b421` | 진입점 12→3(`지원자`·`근무`·`공고 수정`) · 구인자 정산 워크플로우 제거 · 구직자 지급 라벨 · [근무] 사람 줄 취소 요청 승인·거절·전화 |
| S3 | #493 `f327aeabd` | `[공고]/[근무표]` 세그먼트(기본 [공고]) · 오늘 한 줄(owner 기준 미출근·퇴근 미기록, 0건 미렌더, 실패는 숨기지 않고 재시도) · ⋯ 메뉴 |
| S4 | #494 `ed4ea0103` | 근무표 출처 칩(`직접 배치` / `{제목} 공고에서`) · 날짜 패널 한 줄 요약 · 지점 1곳이면 칩 줄만 접기 |
| S5 | #495 `79decb00b` | 팀 `이 팀의 모든 공고를 함께 봅니다` · 협업자 `이 공고 하나만 함께 봅니다` + `팀 보기 ›`(공고 소유자만) · 보기 전용 강등 확인창 노쇼 열람 안내 |

S3·S4·S5 는 로컬에 **스택**으로 쌓였다가 한 세션에서 순차 착지했다. 착지 절차는 [[semantic-merge-conflicts]] §스택 PR.

## 원천 계획에서 뒤집힌 항목 (⚠️ 기획 문서와 코드가 다르다)

`2026-09-13-employer-ia-session-prompts.md` §2 의 다음 항목은 **실행 중 사용자 결정으로 폐기**됐다. 문서만 읽고 되살리지 말 것.

- S3 "팀 링크: 멤버 2명 이상일 때만" · S5 "멤버가 본인뿐이면 팀 진입점 미노출" → **폐기**. 같은 자리에서 `팀원 초대` ↔ `팀` 으로 바뀐다(`EmployerMoreMenu.tsx:46`, 코드로 검증됨).
- S4 "지점·팀 선택기: 2개 이상일 때만" → 지점 1곳이면 **칩 줄만** 접고 ⚙설정·`+ 지점 추가` 는 남긴다(숨기면 지점을 늘릴 입구가 사라진다, `VenueSelector.test.tsx:7`).
- S4 "`GridBadgeLegend` 제거 검토" → **유지**.
- §5 체크리스트의 정션 생성 `cmd //c mklink` → 따옴표 문제로 실패, PowerShell `New-Item -ItemType Junction` 으로 대체(주장 — 세션 실측, S5 프롬프트 §5).

## 설계 요점

- **지원자 ↔ 근무는 합치지 않는다** — 축이 다르다(지원=공고 단위 1줄, 근무=날짜 단위 N줄). 배지도 합치지 않는다(`할 일 6` 은 눌러봐야 안다).
- **정산은 워크플로우만 지우고 금액은 남긴다.** 부수 효과: 아무도 `지급 완료` 를 누르지 않으면 `protect_work_log_payroll_columns()` 잠금이 발동하지 않아 퇴근시간 정정이 항상 열린다 — 잠금 제거 없이 "준 뒤 금액 변경" 문제가 풀렸다(주장 — 기획 문서 §1). 돈 흐름 경계는 [[ops-no-money-flow]] 와 같은 원칙.
- **미출근 정의 = 공고 상세 `todayAbsentCount`** 와 동일(숫자 일치 우선). ⚠️ `getAttentionByOwnerId` 의 `.or(and(..),and(..))` 필터는 실DB 미검증.
- **출처 제목은 RPC 변경 없이** 기존 `getByIdBatch` 로 읽는다(RLS `jp_select_managed`, [[rls-model]]).
- **보기 전용도 지원자 노쇼 횟수를 본다** — 08-16 사용자 승인으로 연 프라이버시 예외이며, 조건이 "지정하는 사장이 알아야 한다"였다(`20260813150000_job_posting_collaborator_role.sql:236-245`). 협업자는 DB 기본값 `manager` 로 추가되고 `collaboratorService.add` 에 role 인자가 없어 viewer 지정 경로는 `CollaboratorRow` 확인창 하나 → 거기에 안내(`CollaboratorRow.tsx:74`, fable 리뷰가 호출처 전수로 검증).

## 접근성·터치 (리뷰에서 반복 지적)

- 접기·펼치기 토글은 `accessibilityState.expanded` + 상태별 라벨(`VenueDayPanel.tsx:320`). 화면은 `닫기` 인데 낭독은 "눌러서 편집"이던 결함(S4 리뷰).
- 작은 칩은 `hitSlop` 상하 12 로 실효 44px(`ConfirmedStaffCard.tsx:342`) — 칩 높이 ~20px 에 hitSlop 8 이면 36px.
- `accessible` + 명시 `accessibilityLabel` 컨테이너 안의 안내문은 **라벨에도** 넣는다(자식 Text 는 낭독 안 됨). 상세 함정은 [[nativewind-rn-pitfalls]].

## 운영 교훈

- jest 에 괄호 경로 전달 시 이스케이프(`"app/\(employer\)/..."`) 또는 `--runTestsByPath` — 안 하면 0 suites 로 무음 통과([[vacuous-verification]] 도구 사각지대).
- 워크트리 정리는 **정션 해제 → 원본 존재 확인 → `git worktree remove`**(`--force` 금지). 09-14 에 `--force` 가 정션을 따라 공유 node_modules 를 비웠다(memory `pitfall_shared_node_modules_corruption_junction`). S5 착지 시 `[System.IO.Directory]::Delete(path, $false)` 로 3개 무사고 해제.
- 원격 브랜치는 머지 시 자동 삭제되는 설정이라 `gh api -X DELETE` 가 422 를 낸다 — 오류가 아니다. 아카이브 태그 `archive/employer-ia-s{3,4,5}-20260915` 로 보존.

## 잔여 (사람 게이트 · 후속)

- 실기기 QA: iOS 공유 시트 퇴장 후 OS 공유창 · 계산 근거→평가 전환 · 대시보드 금액 낭독 · [근무] 전화 · 취소 요청 띠 낭독 · 출처 칩 탭이 공고 상세로 가는지(Pressable 3중 중첩 — RNTL 로는 증명 불가).
- PR 프리뷰: 탭바 하단 여백 · 근무표 Before/After · 오늘 한 줄 숫자 = 공고 상세 미출근.
- 후속: 출처 제목 캐시 최대 10분 · `notify_on_work_log_update` 의 "정산 완료"·"지급 완료 취소" 푸시 문구(컬럼·RPC 정리 웨이브) · `ConfirmedStaffCard` 아이콘 hex 고정.
- 보류(건드리지 말 것): 출퇴근 QR 지점당 1장 / 구인자가 스태프 QR 스캔.
