---
area: sources
updated: 2026-08-09
status: current
sources:
  - uniqn-mobile/src/hooks/ops/useOpsMutations.ts
  - uniqn-mobile/src/hooks/ops/useOpsStaffWorkLogs.ts
  - uniqn-mobile/src/components/ops/StaffAttendanceSheet.tsx
  - uniqn-mobile/supabase/migrations/20260809100000_ops_staff_assignment_notification.sql
  - uniqn-mobile/supabase/migrations/20260809110000_ops_resolve_staff_work_logs.sql
  - PR#451
  - PR#452
  - PR#453
  - PR#455
  - PR#456
  - PR#449
tags: [ops, integration, offline, notification, attendance, work-logs, routing]
---

# 소스: ops 결함 ⑦ — ops 가 앱의 나머지와 통합되지 않은 4갈래 (PR#451~#456)

ops 허브는 자기 안에서는 완결돼 있었지만 **앱의 공용 자산 어느 것과도 배선돼 있지 않았다**.
`ops` 3개 트리(domains/services/hooks)에서 `offline` 참조 0건 · `notification` 참조 0건 ·
`payroll`/`check_in` 참조 0건이 그 증거였다. 네 갈래를 각각 닫았다.

## ⑦-3 오프라인 가드 — 자산은 이미 있었고 배선만 빠졌다 (PR#451)

앱에는 감지(`networkState`)·차단(`remoteMutationGuard`)·배너(`OfflineStatusBar`, `app/_layout.tsx:210`
전역이라 (ops)도 이미 덮는다)가 전부 있었다. ops 훅만 이 관행을 건너뛰어, 쓰기 뮤테이션 **44곳**이
오프라인에서 그대로 발사되고 실패해 원인 불명 토스트만 남겼다.

> 🔑 **큐잉은 범위 밖이다** — `queryClient.ts:193-198` 의 mutations 가 `networkMode:'offlineFirst'` +
> `retry:false` 라 **pause/resume 자체가 발생하지 않고** persist 라이브러리도 없다.
> "오프라인이면 나중에 보낸다"는 존재하지 않는 기능이라, 가드가 없으면 곧바로 실패다.

## ⑦-1 배정 알림 — RLS 가 못 열 화면으로 딥링크를 걸지 않았다 (PR#452)

공고 파이프라인으로 들어온 스태프(`source='snapshot_import'`)는 `work_logs` 트리거의
`schedule_created` 를 받지만, ops 안에서 직접 추가된 스태프(`source='manual'`)는
work_log 도 application 도 없어 **배정 사실을 앱 안에서 알 길이 전혀 없었다.**

딥링크를 일부러 걸지 않은 것이 이 PR 의 핵심 결정이다. ops 전 테이블의 SELECT 정책이
`is_ops_member`(대회 owner 또는 연결 공고 workspace 멤버) 하나에 달려 있는데 **`ops_staff` 는
그 정의에 포함되지 않는다.** 수동 추가 스태프를 ops 화면으로 보내면 RLS 가 막는 빈 화면에 도착하고,
좁은 SELECT 정책 1개를 열어봤자 `ops_tournaments` 부터 막혀 아무 화면도 열리지 않는다.
그래서 **알림 본문에 대회명·역할·날짜·장소를 전부 실었다**.

> 🔑 "알림에 링크를 다는 게 당연"해 보일 때, **그 링크가 도착할 화면의 RLS 를 먼저 확인**하라.
> 도착 못 하는 딥링크는 없는 것만 못하다(사용자는 자기 권한 문제로 읽는다).

## ⑦-2 근태 write-back — 새 저장소를 만들지 않았다 (PR#453 데이터 · PR#456 UI)

원장은 이 작업을 "단방향을 양방향으로 바꾸는 배선"이라 적었으나 실측은 달랐다. `ops_staff` 에
출퇴근 컬럼이 **0개**고 `ops_clock` 은 블라인드 클럭이다 — **돌려보낼 데이터 자체가 없어서**
이건 배선이 아니라 근태 캡처 신설이었다.

핵심 결정: **`work_logs` 가 SSOT 로 남는다.** 신규 함수는 읽기 전용 STABLE 해석기
`ops_resolve_staff_work_logs` **하나뿐**이고, 쓰기는 기존 `update_work_log_slot` 에 위임한다.
그래야 `ALREADY_SETTLED` 동결·이력 append·권한 술어가 **재구현 없이 그대로 산다**.

> 🔑 ops_staff 컬럼 확장도 신규 테이블도 기각했다 — **근태가 두 곳에 생기면 동기화 계층이
> 필요해지고, 그 계층의 공백이 바로 결함 ⑦ 자신**이기 때문이다.

타깃 행은 `source_work_log_id` 가 아니라 **`event_date`** 로 해석한다. import 의 `DISTINCT ON` 이
스태프당 최신 1건만 붙들어 다일 공고에서 오답이 되기 때문이다.

### UI 가 지킨 규칙 (전부 회귀 테스트로 고정 — PR#456)

- **`reason === 'ok' && writeAllowed` 일 때만 컨트롤을 연다.** `ambiguous`(같은 날 2건)·`cancelled`
  에서 버튼을 열면 **틀린 행에 시각이 박히고, 되돌려도 스태프에게 나간 푸시는 회수되지 않는다.**
  막힌 사유 5종을 `it.each` 로 고정했다.
- **일괄 버튼을 만들지 않는다.** `work_logs` AFTER UPDATE 에 notify 트리거가 3개라
  20명 일괄이면 최대 **60회 발화**다. 이 금지 자체를 테스트로 박았다.
- **되돌리기를 같은 화면에 낸다.** 밀어 넣는 액션만 있으면 오조작이 곧 확정이다.
  그럼에도 **기록도 확인 다이얼로그를 거친다** — 되돌려도 푸시는 안 돌아오니까.
- 3상 계약(키 없음=미변경 / null=삭제 / 값=기록)을 지켜 안 건드리는 축의 키는 **아예 싣지 않는다**
  (`'checkOut' in arg === false` 로 단언).
- 사유 문구는 **exhaustive `Record`** 라 `OpsStaffWorkLogReason` 에 값이 추가되면 타입 에러가 난다.
- 배지는 **로딩(null)과 '기록 없음'을 구분**한다. 빈 상태를 '미출근'으로 그리면 아직 안 온 데이터를
  사실로 보여주는 것이다([[error-vs-empty-state]] 와 같은 계열).
- 시트 주입 키는 `staffId` 가 아니라 **`opsStaffId`**(해석기 행이 `ops_staff` 축).

## 파리티 리터럴이 실제로 충돌했다

⑦-1 과 ⑦-2 가 각각 함수를 1개씩 추가하며 **둘 다 207 을 적어** rebase 충돌이 났다.
마커(`PARITY_EXPECT_FUNCS`) + 단언 리터럴 + 설명 문구 **3곳 동시** 갱신으로 208 로 해소.
[[ops-followups-2026-08]] 이 경고한 "숫자가 우연히 같으면 병합이 조용히 통과한다"의
**2회차**이며, 이번엔 충돌이 나 줘서 잡혔다 — 규율은 [[prod-parity-baseline]].

## 곁가지: `/tournaments` 가 (admin)·(ops) 양쪽에 매치됐다 (PR#449 `fa8c614c9`)

같은 URL 이 두 라우트 그룹에 존재했다. 원인은 **metro 의 사전순 정렬**
(`contextModuleTemplates.js:38-40`)이라 `(admin)` 이 **항상** 이긴다.

- 🚫 **"정렬을 뒤집는" 해법은 금지** — 우연에 의존하는 수정이다.
- ✅ 해법은 `app/(admin)/tournaments/` → **`tournament-approvals/`** 리네임.
  그 화면의 실제 정체가 '대회공고 승인'이라, 이름을 바로잡는 것이 곧 수정이었다.
- 🔑 **`webRouteAliases` 는 반환 타깃만 바꿨다.** alias **키** `'tournaments'` 를 건드리면
  prod `notifications.link='/admin/tournaments'` 가 전부 admin 으로 샌다 — 이미 발송된
  알림의 링크는 **되돌릴 수 없는 계약**이다.
- E2E 의 우회(`OPS_LIST_PATH`)를 걷고 맨 URL 단언으로 교체했다. 우회가 남아 있으면 다음 충돌을
  테스트가 다시 못 잡는다. URL 충돌은 총 5건이었으나 나머지 4건은 실행으로 무해 확인.

## 검증 (커밋 메시지에 기록된 실행 증거)

- ⑦-2 UI: Red(스위트 실패) → Green **20/20** · StaffTab **23/23** · ops 전 계층 **31 suites / 257 tests**
- `npm run quality` type-check 0 · lint 0 errors · format 통과 · CI 12/12
- ⑦-4 E2E(PR#446): 라이브 운영 루프 6건, CI E2E Tests 9m26s pass

## 연결

- ops 엔진 구조: [[ops-engine]]
- ops 는 돈 흐름에 관여하지 않는다: [[ops-no-money-flow]]
- 직전 ops 후속(도메인·칩카운트): [[ops-followups-2026-08]]
- 트리거 함수 GRANT 규약 이탈(같은 웨이브, PR#455): [[secdef-hardening]]
- 이 웨이브가 배포 순서에서 배운 것: [[deploy-channel-skew]]
- 근태 쓰기의 상류 계약: [[worktime-ssot]] · [[settlement-rpc-wave-2026-08]]
