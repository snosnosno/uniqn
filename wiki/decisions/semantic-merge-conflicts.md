---
area: decisions
updated: 2026-07-28
status: current
sources:
  - uniqn-mobile/src/domains/schedule/StatusMapper.ts
  - uniqn-mobile/supabase/migrations/20260727180000_cancel_rpc_rebase_on_seat_basis.sql
  - uniqn-mobile/supabase/migrations/20260727120000_work_schedule_soft_cancel_and_required_status_filter.sql
  - PR#356
  - PR#357
  - PR#360
  - memory/project_posting_domain_audit_w1_20260728
tags: [merge, regression, ci, migration, review, worktree]
---

# 결정: 병합은 텍스트가 아니라 **의미**에서 충돌한다

**한 줄:** `git merge` 가 충돌 마커를 하나도 안 내고 끝났다는 사실은 **아무것도 보증하지 않는다** — 두 브랜치가 같은 결함을 서로 다르게 고쳤거나, 한쪽 변경이 다른 쪽이 새로 추가한 테스트의 전제를 죽였거나, 산술적으로 합산되는 래칫이 넘어가는 경우 자동병합은 **양쪽을 다 살려둔 채 조용히 성공**한다. 텍스트 충돌 0 = 검토 불필요가 아니라, **검토 대상이 diff 에 안 보이는 상태**다.

병렬 세션이 상시인 이 저장소([[e2e-gate-absence]]·memory `feedback_isolate_worktree_parallel_session`)에서는 이 클래스가 기본값에 가깝다. 2026-07-27~28 한 주에만 아래 5종이 실증됐다.

## 실증 5종

### 1. 같은 결함을 양쪽이 다르게 고쳐 두 상태가 동시에 살아남음 (PR#360)
`timeDecided` 플래그가 "시작 시각만 골라도 true" 였다. 한쪽은 플래그 판정을 고치고 다른 쪽은 저장 경로를 고쳤는데, 자동병합이 둘 다 채택해 **종료 기본값이 저장에 실리는** 새 경로가 생겼다. 해소는 축 분리(시작/종료를 독립 플래그로) — 어느 한쪽 hunk 채택으로는 못 푼다. 코드로 검증됨.

### 2. 내 변경이 상대 브랜치가 **새로 추가한** 테스트를 죽임 (PR#360)
master 가 그 사이 추가한 "예정액" 단언을, 내 브랜치의 계산 변경이 0원으로 만들었다. 내 브랜치에는 그 테스트 파일이 없었으므로 **분기 시점 기준으로는 무결**했다. 발견 수단은 CI 뿐이었다.

### 3. 상대가 삭제한 파일을 내가 수정 (PR#360)
git 은 이 경우 modify/delete 충돌을 내주기도 하지만, 리네임이 끼면(`weeklyGrid→workSchedule`, PR#354) 유사도 임계 아래에서 **양쪽 파일이 모두 남는다**.

### 4. 래칫이 **병합 산술**로 터짐 (PR#360)
다크모드 bare 클래스 상한 150. 두 브랜치가 각각 149 이하인데 합치면 150 이 된다. 올바른 조치는 상한 상향이 아니라 **내가 추가한 bare 를 찾아 없애는 것** — 상한을 올리면 래칫이 래칫이기를 그만둔다. 같은 함정이 knip 래칫에도 있다([[knip-signal-hygiene]]).

### 5. **DB 전용 PR 이어도 클라이언트 상태 매핑이 흔들림** (PR#357 → PR#356)
PR#357 은 SQL 파일만 바꿔 텍스트 충돌이 0 이었다. 그러나 근무표 빼기를 하드 `DELETE` → `status='cancelled'` 소프트 취소로 바꾸면서 **취소 행이 스태프 목록에 계속 남는다**. 마침 PR#356 이 `StatusMapper.workLogToSchedule` + `SCHEDULE_TYPE_LABELS` 에서 파생시킨 zod 를 도입해 둔 덕에 '취소' 카드로 정상 표시되고 통계(완료/확정/지원)엔 미산입됐다 — **운이 좋았던 것이지 자동으로 안전했던 게 아니다**. 하드코딩된 enum 이었다면 신규 상태가 조용히 drop 됐을 것이다([[enum-divergence]]·[[whitelist-silent-drop]]).

## 규칙

- **머지 직전 최신 master 재통합은 필수이되, "충돌 0" 을 종료 조건으로 삼지 말 것.** 종료 조건은 재통합 **후** 전체 검증(quality + jest + CI)이 green 인 것이다. PR#356 은 master 를 4번 재통합했다.
- **`git log origin/master..HEAD` 로 커밋 수를 직접 세라.** `git status` 가 clean 이어도 내 브랜치 밑에 타 세션 커밋이 깔려 있을 수 있다(PR#354 때 9커밋). 문서에 적힌 커밋 수도 틀린다(PR#360 은 16/17 로 기재됐고 실제 19였다).
- **SQL 전용 PR 을 병합했어도 클라이언트 상태 매핑을 실측하라.** 상태 집합이 넓어지는 변경(soft delete·신규 status)은 파일이 안 겹쳐도 의미가 겹친다.
- **래칫 위반은 상한을 올려 풀지 않는다.** 내가 더한 몫을 찾아 없앤다.
- 병렬 세션이 감지되면 워크트리로 격리한다(전역 `git-workflow` 규칙) — 이 클래스를 없애지는 못하지만 **커밋 섞임**이라는 더 나쁜 변종은 막는다.

## 왜 CI 가 최후 방어선인가

위 5종 중 리뷰어의 눈으로 잡히는 건 1·5 정도다. 2·4 는 **정의상 diff 에 안 보인다**(내 변경 + 상대 변경의 곱). 그래서 이 저장소에서 CI 를 required check 로 올리는 문제는 스타일이 아니라 **정확성 문제**다 — 현재 master 에는 branch protection 자체가 없다([[e2e-gate-absence]]).
