# UNIQN 코어 유저플로우 실측 감사 (2026-07-10)

> 읽기전용 멀티에이전트 감사. 코드 실측만 근거로 삼았고, 모든 결함은 적대적 검증(refute-by-default)을 통과한 것만 확정으로 올렸다.

## 한 줄 결론

**협업(collaborator / workspace member) 페르소나가 앱 전반에서 반쯤 부서져 있다.** DB의 RLS는 협업자에게 쓰기 권한을 이미 열어줬는데, 앱 레이어 가드가 `owner_id` 완전일치만 허용하도록 뒤처져 있어 — 확정 20건 중 6건이 이 한 뿌리에서 나왔다. 그 다음으로 무거운 것은 **확정 해제(un-confirm) 기능의 전면 파손**과 **정산 완료 금액의 소급 재계산**이다. 둘 다 금전·정원에 직결된다.

---

## 1. 감사 방법과 신뢰도

| 항목 | 값 |
|---|---|
| 대상 | 코어 10 flow (auth·jobs·applications·schedule·staff·worktime·settlement·share·workspace·notification) |
| 제외 | ops(대회운영툴)·weekly-grid **내부 로직** — 경계 정합성만 확인 |
| 에이전트 | 46개 전원 성공 (실패 0) |
| 소모 | 서브에이전트 토큰 5,113,521 · 도구호출 1,006 · 40분 |
| 원결함 | 39건 |
| **확정 (CONFIRMED)** | **20건** (중복 병합 후 **19건**) |
| **기각 (REFUTED)** | **17건 (44%)** |
| 미검증 (LOW) | 2건 |

파이프라인은 3단이다.

1. **flow 수직 추적** (sonnet ×10) — 라우트→훅→서비스→리포지토리→DB까지 따라가며 *계약카드*(진입점·상태기계·DB테이블·트랜잭션·에러경로·역할가드·알림트리거·불변식)를 만든다.
2. **횡단 렌즈** (sonnet ×5) — 렌즈 에이전트는 레포를 다시 읽지 않고 *카드 10장*만 교차대조한 뒤 표적 grep으로 실측한다. 한 flow 안에서는 보이지 않는 결함만 잡는다.
3. **적대검증** (opus, flow별 묶음) — 각 주장의 `file:line`을 실제로 Read하고, 코드 실측과 재현 가능성 두 각도로 **반증을 시도**한다. 확신이 없으면 기각이 기본값.

**기각률 44%가 이 감사의 핵심 산출물이다.** 검증을 붙이지 않았다면 백로그의 절반이 허위였을 것이다. 예를 들어 "확정 스태프 목록이 FlashList 규칙을 어겼다"는 주장은 코드 인용은 정확했지만, 검증관이 `SectionList`도 `VirtualizedList` 기반 windowing이라는 사실을 짚어 실패 메커니즘 자체가 틀렸음을 밝혔다.

### 기각 ≠ 무해 — 두 종류를 구분하라

기각 17건은 성격이 다르다.

- **진짜 반증 (10건)**: 도달 경로가 없거나(호출부 0건), 의도된 설계이거나(스케줄 통계의 forward-looking 필터), 상위 가드가 이미 막고 있거나, 실패 메커니즘 설명이 틀렸다. → **쫓지 말 것.**
- **코드 사실은 정확, prod 런타임 없이는 확정 불가 (7건)**: 검증관이 명시적으로 `prod 실측 필요`라고 적었다. 이 레포는 [prod↔레포 스키마가 대규모로 발산](../../README.md) 중이라(함수 prod163/레포142, 본문불일치 52건) 코드만 보고 DB 런타임을 주장할 수 없다. → **폐기 대상이 아니라 §5의 실측 대기 목록.**

---

## 2. 루트원인 클러스터

확정 결함 19건은 독립된 19개 작업이 아니라 **7개 뿌리**로 모인다.

### 클러스터 A — 앱레이어 권한 게이트가 DB RLS보다 좁다 (6건, 최대 뿌리)

DB는 `is_workspace_member` / `is_posting_collaborator`로 협업자의 쓰기를 이미 허용한다. 앱 레이어는 그걸 모른다.

| 결함 | 위치 | 증상 |
|---|---|---|
| `jpc-collaborator-mutate-access-stale-guard` (HIGH) | `JobPostingRepositoryHelpers.ts:130` | `loadAndVerifyMutateAccess`가 `is_posting_collaborator`를 호출하지 않아, 초대받은 협업자가 공고 수정·마감·재오픈·정산설정 4개 경로에서 **100% PermissionError** |
| `workspace-member-blocked-from-settlement-mutation` (HIGH) | `SettlementRepository.ts:632` | 정산 **조회**는 멤버 허용, **쓰기**는 `owner_id` 완전일치만 → 화면은 보이는데 버튼이 막힌다 |
| `workspace-collaborator-blocked-noshow-status` (MEDIUM) | `ConfirmedStaffRepository.ts:198` | 노쇼처리·상태변경은 막히는데, **바로 옆** 역할변경·시간수정은 소유권 체크가 아예 없어 통과된다 |
| `posting-collaborator-can-confirm-but-not-edit-or-settle` (MEDIUM) | `JobPostingRepositoryHelpers.ts:115` | 확정 RPC는 협업자를 인정(`is_posting_collaborator`), 후속 관리 경로는 인정하지 않음 → **확정은 되는데 그 뒤 아무것도 못 한다** |
| `staff-management-screen-inconsistent-collaborator-gates` (MEDIUM) | `ConfirmedStaffRepository.ts:368` | 한 화면 인접 버튼 4개가 서로 다른 게이트. 시각적으로 전부 활성. 안내 0줄 |
| `staff-role-collaborator-locked-out` (MEDIUM) | `app/(employer)/_layout.tsx:90` | staff-role 사용자를 협업자로 초대하면, 초대 알림을 눌러도 `useHasRole('employer')`가 false라 **조용히 튕겨난다**. 에러도 재시도도 없다 |

**한 문장 요약**: "협업자를 초대한다"는 기능이 초대까지만 되고, 초대받은 사람이 할 수 있는 일은 화면마다 무작위다.

### 클러스터 B — 확정 해제(un-confirm) 전면 파손 (1건, HIGH)

`ApplicationRepositoryTransactions.ts:226` — `executeCancelConfirmation`이 `p_actor_type`을 `'staff_initiates'`로 **하드코딩**한다. 구인자가 '확정 해제'를 누르면 자신의 uid가 `actor_id`로 실려 가는데, RPC의 `staff_initiates` 분기는 `applicant_id == actor_id`를 요구한다. owner uid가 applicant uid와 같을 수 없으므로 **항상 `{success:false, error:'unauthorized'}`**.

사용자에게는 "취소 권한이 없습니다"만 보인다. 결과: **일반 지원→확정 스태프를 구인자가 UI로 되돌릴 방법이 없다.** 자리 반납도, 정원 회수도 불가. (직접추가 스태프만 `remove_direct_staff` 경로로 제거된다.)

> 검증관 주: "노쇼 + 확정해제 파손 = 정원 영구 락"이라는 **결합 결론은 기각**되었다(노쇼 시 트리거 동작이 prod 미실측). 그러나 **두 코드 사실은 각각 확정**이다.

### 클러스터 C — 정산 금액의 진실원이 이원화 (4건, 금전 직결)

| 결함 | 증상 |
|---|---|
| `settled-amount-recomputed-live-not-frozen` (HIGH, `settlementGrouping.ts:140`) | 정산 **완료**된 건의 리스트 표시액을 `payroll_amount`(동결값)가 아니라 *현재* 공고 급여설정으로 **매번 재계산**한다. 사장이 나중에 시급을 올리면 과거 지급 완료 건의 표시 금액이 소급 변경된다. 반면 상단 '총 정산 완료 금액'은 `payrollAmount` 합계라 **둘이 어긋난다** |
| `rls-staff-self-write-payroll-inputs` (HIGH, `20260415130000_...sql:34`) | `wl_update` RLS가 `staff_id = auth.uid()` UPDATE를 허용하는데, 보호 트리거는 `payroll_amount/status/date/notes` 4개만 차단. 정산액을 좌우하는 `check_in_ts`·`check_out_ts`·`custom_salary_info`·`custom_allowances`·`custom_tax_settings`는 **무방비** |
| `qr-checkin-client-supplied-timestamp` (MEDIUM) | `process_qr_checkin_atomically`가 클라이언트가 보낸 `p_check_time`(디바이스 시각)을 그대로 기록. 서버 `clock_timestamp()` 대비 편차 검증 없음 |
| `custom-settlement-edit-missing-already-settled-guard` (MEDIUM) | 커스텀 급여정보 저장이 형제 메서드와 달리 `payrollStatus===COMPLETED`를 서버에서 검사하지 않음 (UI만 방어) |

카드에 명시된 계약이 이 균열을 정확히 예언한다:

> "정산 완료 시 `customAllowances`가 비어있으면 공고의 현재 allowances를 스냅샷으로 저장해 향후 공고 수정의 소급 영향을 막는다(ES-003) — **단, 이 보장은 급여(salary)에는 적용되지 않는다**"

수당은 동결하면서 급여는 동결하지 않았다.

### 클러스터 D — 대회 승인 게이트 우회 (1건, HIGH)

`JobPostingRepository.ts:416` — `tournament_config.approvalStatus`가 `job_postings.status` 컬럼과 **완전히 분리**되어 있다. 대회공고를 만들면 행은 즉시 `status='active'`, `approvalStatus='pending'`으로 들어간다. 상세 화면은 `status==='active'`만 검사하고 `approvalStatus`를 보지 않는다.

결과: 미승인 대회공고가 공개 별칭 라우트(`app/jobs/[id].tsx`, 비로그인 접근 가능)로 열람되고, **'지원하기' CTA까지 정상 노출되며 실제 지원도 완료된다.** 관리자 승인 워크플로우 전체가 우회된다.

### 클러스터 E — 알림·에러 문구 누락 (4건)

- `cancellation-request-no-owner-notification` (MEDIUM) — 스태프가 **취소 요청**을 제출해도 구인자에게 알림이 0건. 당일 임박 취소를 놓치면 무단결근처럼 보인다.
- `job-posting-error-english-usermessage` (MEDIUM) — 마감/재오픈/수정 BusinessError 5개가 영문 하드코딩. 사용자는 `공고 마감 실패: Job posting is already closed.` 토스트를 본다. (같은 파일 바로 아래 유사 케이스는 한글)
- `schedule-partial-fetch-warning-dropped` (MEDIUM) — 서비스가 만든 부분조회 실패 경고를 훅이 버린다. 근무 일부가 통째로 빠진 캘린더를 **정상 화면으로 오인**한다.
- `confirm-application-race-errors-collapse-to-unknown` (LOW) — 협업자 2명 동시 확정 시 늦은 쪽이 "알 수 없는 오류". 동료가 이미 확정했다는 사실을 알 수 없다.

### 클러스터 F — 워크스페이스 컨텍스트 불일치 (2건)

- `create-ignores-active-workspace` (MEDIUM) — 공고 생성은 항상 owner의 **가장 오래된** 워크스페이스에 붙는데, 목록 조회는 `activeWorkspace`로 스코프한다. 워크스페이스 B를 선택하고 공고를 만들면 **방금 만든 공고가 목록에서 사라진다.**
- `workspace-archive-orphan-navigation-deadend` (MEDIUM) — 유일한 워크스페이스를 보관하면 '보관함' 버튼이 렌더 조건(`isOwner && activeWorkspace`)에서 빠져 **복원 경로가 앱 내에서 소멸**한다. 새 워크스페이스를 먼저 만들어야만 되돌릴 수 있다.

### 클러스터 G — 초대 동의 계약 이원화 (1건, LOW이나 프라이버시 함의)

같은 앱에 "협업자를 추가한다"가 두 계약으로 존재한다.

- `job_posting_collaborators`: 대상자 **동의 없이 즉시 INSERT**. 수락/거절 UI 자체가 없다.
- `workspace_members`: 반드시 명시적 accept/reject.

결과적으로 초대받는 쪽은 **자신도 모르게** 특정 공고의 지원자 개인정보 열람·확정/거절 권한을 부여받을 수 있다.

---

## 3. 유저플로우 맵 — 페르소나별

### 스태프 (홀덤펍 단발 알바)

```
앱설치 → 가입(PortOne 본인인증 필수) → 프로필셋업 → home-jobs
          ↓
      공고 발견 ─── ⚠️ 공개 목록 라우트 없음 (LegacyPublicJobsEntryRoute가 리다이렉트만)
          ↓
      공고 상세 ─── ⚠️ 인증판/공개판 2중 구현
          ↓
      지원 (applications: applied) ─── ⚠️ 미승인 대회공고도 지원 가능 [클러스터 D]
          ↓
      확정 (confirmed, work_logs 생성, filled_positions 트리거 +1)
          ↓
      QR 출근 (check_in_ts) ─── ⚠️ 디바이스 시각 그대로 기록 [클러스터 C]
          ↓
      QR 퇴근 (check_out_ts)
          ↓
      정산 완료 알림 (DB 트리거 보장)

  [취소 경로] confirmed → 취소요청(cancellation_pending) ─── ⚠️ 구인자에게 알림 0건 [클러스터 E]
             fixed 공고는 취소요청 경로 자체가 없음 ─── ⚠️ 사유 안내 0줄 (기존 blocker B1)
```

### 구인자 (홀덤펍 사장 / 대회사 운영팀)

```
가입 → employer 신청 → 관리자 승인 → 워크스페이스
                                        ↓
                                   공고 등록 ─── ⚠️ activeWorkspace 무시 [클러스터 F]
                                        ↓
                                   지원자 확정 (confirm_application RPC)
                                        ↓
                                   확정 해제 ─── ❌ 항상 unauthorized [클러스터 B]
                                        ↓
                                   스태프 배치 (역할/시간/노쇼)
                                        ↓
                                   시간 확정 → 정산 ─── ⚠️ 완료 후 소급 재계산 [클러스터 C]

  [협업 경로] 협업자 초대 → 알림 발송 → 진입 시도
                                          ↓
                              staff-role이면 조용히 튕김 [A]
                              employer-role이면 진입은 되나
                              버튼 절반이 PermissionError [A]
```

### flow 계약 요약 (다른 flow가 의존해도 되는 불변식)

| flow | 핵심 불변식 |
|---|---|
| auth | 진입 라우트는 `phoneVerified`/`identityVerified`/`profileCompleted` **3필드만**으로 결정되고 role은 반영하지 않는다 |
| jobs | `filledPositions > 0`이면 일정·역할 변경과 삭제를 서버가 차단. `cancelled`는 영구 종착 |
| applications | `filled_positions`는 **DB 트리거가 전담** 증감 — 클라이언트가 직접 건드리지 않는다 |
| schedule | 같은 `jobPostingId+date`에 WorkLog가 있으면 Application 기반 스케줄보다 **항상 우선** |
| staff | 확정 시 work_logs가 **같은 트랜잭션**에서 INSERT. `payrollStatus='completed'`면 시간수정 불가 |
| worktime | `process_qr_checkin_atomically`는 `FOR UPDATE` 행잠금으로 이중 체크인 방지 |
| settlement | 금액은 항상 `SettlementCalculator.calculate` 단일 공식으로 **서버가 재계산**하고 클라이언트 값은 무시 |
| share | 협업자 추가(INSERT)는 **RLS `jpc_insert_ws_owner`가 유일 진실**, 서비스는 UX 보조 |
| workspace | 모든 멤버/초대 쓰기는 SECURITY DEFINER RPC **단일 트랜잭션**으로만 발생 |
| notification | `notifications` INSERT는 SQL 문 단위로 **정확히 1회** push를 트리거하고 예외를 삼킨다 |

---

## 4. 우선순위 백로그

### P0 — 출시 차단 후보 (금전·정원·승인게이트)

| # | 클러스터 | 작업 | 근거 |
|---|---|---|---|
| 1 | B | ✅ **완료 (§9)** — `employer_initiates` RPC 분기 신설 + 합성 applicationId 제거, prod 적용 | `ApplicationRepositoryTransactions.ts:226` |
| 2 | C | ✅ **완료 (§9)** — 완료 건 표시액 `payroll_amount` 동결값 사용(레거시 fallback) | `settlementGrouping.ts:140` |
| 3 | C | ✅ **대체 해소 (§6)** — 트리거 확장은 QR을 깨뜨려(SECDEF+GUC) RLS 축소로 해결 | `20260415130000_...sql:34` |
| 4 | D | ✅ **완료 (§9)** — `isTournamentApprovalBlocked` SSOT + 상세 2화면·지원 서비스 게이트 | `JobPostingRepository.ts:416` |
| 5 | A | ✅ **완료 (§8)** — `postingAuthority` 모듈로 3개 가드 통합 + 무검증 2경로 방어 | 6건 중 5건 해소 |

**P0 전항 완료(2026-07-11).** 상세 실행 기록: #5=§8, #1·#2·#4=§9, #3=§6.

**#5가 이 감사의 최대 레버리지였다.** 세 개의 서로 다른 소유권 판정 함수가 각자 다른 규칙을 갖고 있어 클러스터 A 6건이 발생했다. 하나로 합쳐 5건을 닫았다. 잔여 1건(`staff-role-collaborator-locked-out`, 라우트 role 게이트)은 제품 결정이 필요해 별도 슬라이스로 남았다.

### P1 — 마찰·정합성

| # | 클러스터 | 작업 |
|---|---|---|
| 6 | C | 커스텀 급여정보 저장에 서버측 `COMPLETED` 가드 추가 |
| 7 | C | QR 체크인 시각을 서버 `clock_timestamp()` 기준으로 하거나 편차 임계 검증 |
| 8 | F | 공고 생성 시 `activeWorkspace.id`를 명시 전달 |
| 9 | F | 워크스페이스 0개 EmptyState에 '보관함' 진입점 추가 |
| 10 | E | 취소 요청 제출 시 owner/협업자 알림 트리거 추가 |
| 11 | E | 스케줄 부분조회 warning을 화면에 노출 |
| 12 | E | 영문 BusinessError userMessage 5개 한글화 |

### P2 — 낮음

13. `confirm_application` 동시성 예외를 사용자 문구로 매핑 (LOW)
14. JPC 초대에 수락/거절 계약 도입 — 프라이버시 (LOW, 설계 필요)
15. `CollaboratorSearch.tsx:56` `not_registered` 죽은 분기 제거 (LOW, 미검증)
16. `useWorkspaces.ts:229` 초대 실패 시 캐시 무효화 누락 (LOW, 미검증)

### 기존 blocker (이번 감사 범위 밖, 여전히 미해결)

- **B1** fixed 공고 취소 차단 사유 미노출
- **B2** 자정 넘는 근무(`crossesMidnight`) 미지원 — 시급·정산 계산 직결

---

## 5. prod 라이브 실측 결과 (2026-07-10 완료)

읽기 전용 쿼리로 7건 전부 판정했다. **결과가 백로그를 다시 썼다.** PR #235와 중복 없음(그 PR은 `rate_limit`·`toggle_vote` IDOR·`job_postings_select_all`·`bc_select`를 다뤘고 `notifications` 정책은 손대지 않았다).

| 주장 | 판정 | 근거 (prod 실측) |
|---|---|---|
| `notifications` INSERT RLS 소유권 미검증 (**CRITICAL 주장**) | **기각** | RLS 활성 + INSERT/ALL 정책 **0개** → 위조 INSERT 거부. 알림 생성 트리거 6종은 전부 `SECURITY DEFINER`(owner=postgres)라 정상 경로만 통과 |
| `users.nickname` UNIQUE 부재 | **기각** | `users_nickname_key UNIQUE (nickname)` 존재 |
| weekly-grid 컨테이너가 게이트 우회 | **기각** | 검증관 판정 유지 (`parseJobPostingDocument` strict 실패로 선차단) |
| 확정취소 알림 오발송 | **확정** | `notify_on_application_update`가 `OLD.status='confirmed'`를 검사하지 않음 → `applied→cancelled`(자진 철회)에도 "확정 취소" 알림이 **본인에게** 발송 |
| 알림 삭제 시 unread 이중차감 | **확정** | `fn_notification_delete_decrement` 트리거 ENABLED(−1) + 클라이언트가 `decrement-unread-counter` Edge Function 추가 호출(−1) = **−2**. `deleteMany`는 **−2N**. `GREATEST(0,…)`은 음수만 막고 언더카운트는 방치 |
| 로그인 잠금 클라이언트 전용 | **부분 확정** | `rate_limits` 테이블과 `check_rate_limit`/`check_ip_rate_limit`/`check_user_rate_limit` 함수가 **존재하지만 PR #235가 전부 dead code로 판정해 EXECUTE 회수**. 즉 서버측 로그인 카운터는 실제로 미사용. 남은 방어는 GoTrue 플랫폼 레이트리밋 — 대시보드 확인 필요 |
| 확정스태프 시간수정 ownerId·row-count 미확인 | **강등 (LOW)** | `wl_update`가 owner·staff·workspace member·collaborator를 모두 허용 → 무관한 제3자는 0건 UPDATE(조용한 성공 오보)만 발생하고 **타인 데이터 변조는 불가** |

### 실측이 새로 확정하거나 뒤집은 것

**① 클러스터 C가 CRITICAL로 승격된다.**

```sql
-- prod: work_logs RLS
wl_update USING (staff_id = auth.uid() OR owner_id = auth.uid() OR job_posting_id IN (...))

-- prod: protect_work_log_payroll_columns 는 이 4개만 막는다
payroll_amount / payroll_status / payroll_date / payroll_notes
```

`check_in_ts`·`check_out_ts`·`custom_salary_info`·`custom_allowances`·`custom_tax_settings`는 **보호 목록에 없다.** 그리고 `wl_update`는 스태프가 자기 행을 UPDATE하는 것을 허용한다. 따라서 **스태프는 자기 JWT로 Supabase REST에 직접 PATCH를 보내 자신의 근무시각과 급여정보를 조작할 수 있다.**

`payroll_amount` 자체는 트리거가 막지만, 정산 금액은 서버가 *이 입력값으로* 재계산한다. 최종 금액 쓰기를 막아도 **입력을 조작하면 결과가 조작된다.** 인증된 사용자가 자기 이익을 위해 단독 실행 가능하고, 앱 UI를 전혀 거치지 않는다.

**② 클러스터 A가 prod 실측으로 확정된다.** `wl_update` 정책이 `is_workspace_member(...) OR is_posting_collaborator(...)`를 **명시적으로 허용**한다. DB는 협업자의 쓰기를 이미 열어줬고, 앱 레이어만 `owner_id` 완전일치를 요구한다. 추측이 아니라 정책 본문이다.

**③ 확정 결함 하나가 거짓이었다.** `cancellation-request-no-owner-notification`(MEDIUM)은 **틀렸다.** prod에 `tr_notify_cancellation_request` 트리거가 활성이고 `fn_notify_cancellation_request`가 `status → 'cancellation_pending'` 전이 시 owner에게 알림을 INSERT한다. 코드 감사만으로는 알 수 없었다.

다만 **축소된 갭은 남는다**: 이 트리거는 `job_postings.owner_id` **한 명에게만** 보낸다. 워크스페이스 멤버와 공고 협업자는 취소 요청 알림을 받지 못한다.

**④ 새 결함: prod↔레포 파리티 부채 (양방향)**

| 항목 | prod | 레포 |
|---|---|---|
| `notifications` INSERT 정책 | 없음 (안전) | `base_schema.sql:654-655`에 `auth.uid() IS NOT NULL OR is_admin()` **느슨한 정책** |
| `users.nickname` UNIQUE | 있음 | 없음 |

레포가 prod보다 **위험하다.** `supabase db reset`이나 신규 환경 부트스트랩 시 알림 위조 구멍이 열린다. 로컬 dev 스택에서 재현되는 보안 테스트는 prod를 대표하지 못한다.

**⑤ 새 결함: `anon` write grant 잔존.** `notifications`·`applications`·`work_logs` 모두 `anon`에게 INSERT/UPDATE/DELETE **grant**가 남아 있다. 현재는 RLS가 막고 있지만 defense-in-depth가 없다 — PR #235가 함수 EXECUTE에 적용한 것과 같은 계열의 부채다.

### 갱신된 P0

| 순위 | 작업 | 등급 변화 |
|---|---|---|
| **1** | ✅ **완료** — 스태프 자기행 `work_logs` UPDATE 회수 (§7) | HIGH → **CRITICAL** (prod 실측) |
| 2 | 확정 해제 `actor_type` 하드코딩 제거 | HIGH 유지 |
| 3 | 세 개의 소유권 판정 함수를 단일 함수로 통합 (6건 동시 해소) | HIGH 유지, prod 근거 확보 |
| 4 | 정산 완료 건은 동결된 `payroll_amount` 표시 | HIGH 유지 |
| 5 | 대회공고 `approvalStatus` 게이트 추가 | HIGH 유지 |
| 6 | 레포 `base_schema.sql` 느슨한 notifications INSERT 정책 제거 + nickname UNIQUE 추가 | **신규** (파리티) |

### 백로그에서 삭제

- ~~`notifications` INSERT 위조~~ — prod에서 불가
- ~~닉네임 중복 생성~~ — prod에 UNIQUE 존재
- ~~취소 요청 알림 0건~~ — prod에 트리거 존재. **"수신자를 owner+협업자로 확장"으로 재작성**
- ~~weekly-grid 컨테이너 우회~~ — 선차단 확인

### 백로그에 추가

- 알림 삭제 unread 이중차감 제거 — 트리거와 Edge Function 중 하나를 폐기 (MEDIUM)
- `notify_on_application_update`에 `OLD.status='confirmed'` 가드 추가 (LOW)
- `anon` write grant 회수 — `notifications`·`applications`·`work_logs` (MEDIUM, defense-in-depth)
- GoTrue 로그인 레이트리밋 설정 확인 + dead `rate_limits` 인프라 정리 또는 연결 (MEDIUM)

---

## 6. P0#1 실행 기록 — 스태프 정산 입력값 조작 차단 (완료)

커밋 `729b7d14f` · prod 마이그레이션 `wl_update_revoke_staff_self` 적용 완료.

**선택한 접근**: 컬럼 단위 트리거 확장이 아니라 **RLS 축소**. 이유는 트리거를 손대면 QR 체크인이 깨지기 때문이다 — `protect_work_log_payroll_columns`는 `SECURITY DEFINER`라 내부에서 `current_user`가 항상 `postgres`이고, `auth.jwt()`는 GUC를 읽어 DEFINER RPC 안에서도 여전히 스태프의 JWT를 본다. 즉 `check_in_ts`를 차단 목록에 넣으면 `process_qr_checkin_atomically`를 통한 정상 출퇴근까지 함께 막힌다.

RLS를 축소하면 QR은 무사하다. RPC가 `SECURITY DEFINER`(owner=postgres)라 RLS를 우회하고, 자체적으로 `auth.uid() = p_staff_id`를 검증한다.

**구현 중 발견한 추가 결함**

- **`work_logs_update_involved`** — `base_schema.sql`이 만드는 레포 전용 permissive UPDATE 정책(`staff_id = auth.uid() OR owner_id = auth.uid() OR is_admin()`). prod엔 없다. RLS permissive 정책은 **OR로 합산**되므로, 이게 남아 있으면 `wl_update`만 고쳐도 구멍이 그대로 열려 있다. 같은 마이그레이션에서 제거(prod에선 no-op).
- **기존 pgTAP가 취약점을 정상으로 고정하고 있었다.** `jpc_work_logs_rls.test.sql`이 `work_logs UPDATE: staff 본인 → ALLOW(1)`을 단언하고 있었다. 회귀 테스트가 구멍을 지키고 있던 셈이다. 단언을 뒤집었다.
- **[신규 백로그] `work_logs` INSERT/DELETE 정책 파리티** — 레포엔 `work_logs_insert_owner_or_admin`·`work_logs_delete_admin`이 있는데 prod엔 **UPDATE/SELECT 정책 2개뿐**이다. prod에서는 클라이언트 INSERT/DELETE가 전면 거부되고 모든 생성·삭제가 `SECURITY DEFINER` RPC를 지난다. 레포가 더 넓다.
- **[신규 백로그] `notify_on_job_posting_update` 런타임 실패** — pgTAP 실행 중 `malformed array literal: "status"` WARNING이 반복 발생한다. 트리거가 실패하는데 예외를 삼켜(WARNING) 공고 수정 알림이 조용히 누락될 수 있다. prod 재현 여부 미확인.

**Red-Green 증거**

```
RED  (수정 전, 로컬):  not ok 1 - wl_update USING 에 staff_id 자기행 분기가 없다
                       not ok 2 - staff 가 자기 work_log 의 check_in_ts 를 직접 수정할 수 없다
                       not ok 3 - staff 가 자기 work_log 의 custom_salary_info 를 직접 수정할 수 없다
                       ok 4~8   - 회귀(조회·owner·collaborator·QR RPC) 통과

GREEN (수정 후, 로컬):  npx supabase test db
                       Files=55, Tests=652, Result: PASS

prod 실측:              wl_update USING 에 staff_id 없음 / work_logs UPDATE 정책 1개
                       wl_select 는 staff_id 유지 (조회 정상)
                       advisor ERROR 0, WARN 178 (work_logs 신규 항목 없음)
```

**검증하지 않은 것**: prod에서 실제 스태프 JWT로 PATCH를 쏴보는 라이브 재현. prod 실데이터에 쓰기를 시도해야 해서 하지 않았다. 행위 검증은 정책 텍스트가 동일한 로컬에서 수행했다.

**남긴 잔여 벡터 (P1)**: `wl_update`의 `is_posting_collaborator` 분기 때문에, 공고 협업자로 추가된 staff-role 사용자는 여전히 자기 work_log를 PATCH할 수 있다. 협업자 추가는 워크스페이스 owner만 가능하므로(`jpc_insert_ws_owner`) 외부인은 스스로 진입할 수 없다 — 광역 벡터는 닫혔고 내부자 벡터가 남는다. `wl_update_staff_self_revoke.test.sql` 케이스 6이 이 동작을 명시적으로 고정한다. 컬럼 단위 방어(트리거 확장 + 신뢰경로 플래그)는 별도 PR.

---

## 7. 이 감사가 볼 수 없었던 것

정직하게 적는다.

- **prod DB 런타임** — 트리거 활성 여부, 실제 RLS 정책 본문, 인덱스. 레포와 발산 중이다.
- **실기기 UX** — iOS 피커, 터치, 다크모드 실렌더.
- **성능 실측** — N+1·리렌더 주장은 프로파일링 없이는 추정이다. (실제로 성능 결함 주장 2건 모두 검증에서 기각됐다)
- **ops·weekly-grid 내부** — 의도적 제외. 경계 정합성만 확인했고 위반은 발견되지 않았다.
- **`(admin)` 그룹** — 감사 범위 밖.

---

## 부록: 감사 재현

```bash
# 워크플로우 스크립트 (세션 디렉토리에 자동 보존)
# .claude/projects/<proj>/<session>/workflows/scripts/uniqn-userflow-audit-v2-*.js
```

교훈 2건은 프로젝트 메모리에 기록했다.

- `pitfall_workflow_burst_agent_limit` — 에이전트 17개 동시 디스패치 = 버스트 한도 전원 실패 + 603k 토큰 소각 + 캐시 0건. 5개씩 순차 배치할 것.
- `pitfall_fable_arithmetic_unreliable` — fable이 `2+3=6`. 판단·검증·종합 자리에 두지 말 것.

---

## 8. P0#3 실행 기록 — 소유권 판정 통합 (클러스터 A, 완료)

브랜치 `analysis/userflow-audit-20260710` 커밋 `2a66d14fc`..`d3f331440` (7커밋). **DB 무변경** — 앱레이어만 prod RLS에 맞췄다.

**핵심 판단**: prod RLS 실측이 방향을 정했다. `work_logs` UPDATE는 `owner OR is_workspace_member OR is_posting_collaborator`(admin 없음), `job_postings` UPDATE는 거기에 `is_admin` 추가. 즉 DB는 협업자에게 이미 쓰기를 열어줬고 앱 레이어만 `owner_id` 완전일치를 요구하고 있었다. 단일 boolean이 아니라 **역량(capability) 판정**으로 통합했다 — admin을 mutate/근무기록 쓰기에서 계속 거부해야 하기 때문이다(PR3-A.2: 후속 RLS에 admin 분기가 없어 UPDATE가 0행 silent no-op이 되고 caller가 false success를 인식한다).

**한 모듈, 4개 가드 통합 + 무검증 2경로 방어**

| 대상 | 변경 |
|---|---|
| `postingAuthority.ts` (신규) | `resolvePostingAuthority`(owner short-circuit → 멤버 → 협업자) + `canManagePosting`(admin 미포함) |
| `loadAndVerifyMutateAccess` | 협업자 인식 → 공고 수정·마감·재오픈·정산설정 4경로 |
| `validateWorkLogOwnership` + bulk | 정산 쓰기가 멤버·협업자 허용. bulk는 공고당 1회 판정(N+1 방지) |
| `verifyPostingAuthority` (구 `verifyJobPostingOwnership`) | 노쇼·상태변경 |
| **`updateRole` / `updateWorkTime`** | **소유권 검증이 아예 없던 2경로에 가드 신설** — `workLog.jobPostingId`로만 판정(클라 주입 불신) |

이로써 "같은 화면 인접 버튼 4개가 서로 다른 권한으로 동작"(클러스터 A의 UX 증상)이 사라졌다.

**적대 리뷰 2종 (code-reviewer + security-reviewer, opus 병렬)** — 둘 다 CRITICAL/HIGH 0건, APPROVE. fail-open 경로 부재 확인(`handleSupabaseError` 반환형 `never`, RPC null → `=== true` 불일치로 fail-closed). `actorId`는 전부 세션(`requireCurrentUser`/`user.uid`)에서 파생돼 클라 스푸핑 불가.

**리뷰가 잡은 것 (두 리뷰 독립 지적)**

- **[수정함, MEDIUM]** bulk 공고조회 실패(`jpError`)를 삼켜 "권한 없는 공고"로 오표기 → `logger.warn` 추가(fail-closed 유지). 커밋 `d3f331440`.
- **[후속 백로그, 실제 결함]** `useStaffSettlementsHandlers.ts:255,282,348`이 `posting.ownerId`를 actorId로 넘겨 앱레이어 인가가 no-op이 된다(owner short-circuit 항상 참). 정산 커스텀 설정 수정 경로. **이 슬라이스 밖의 선재 패턴**이고 실제 쓰기는 RLS가 막지만, 통합의 신뢰성을 갉으므로 세션 uid로 교체 필요.
- **[후속 백로그, LOW]** `markAsNoShow`/`updateStatus`/Settlement의 `ownerId` 파라미터명을 `actorId`로 통일(의미와 불일치, 미래 과잉조임 위험).

**검증 증거**

```
tsc --noEmit           exit 0
eslint (변경 5파일)     0 errors 0 warnings
jest 전체              383 스위트 / 4904 테스트 PASS
pgTAP                  Files=55 Tests=652 PASS (DB 무변경 확인)
adversarial review     code+security 2종, CRITICAL/HIGH 0
```

**잔여 (클러스터 A 6건 중 1건)**: `staff-role-collaborator-locked-out` — `app/(employer)/_layout.tsx`의 `useHasRole('employer')` 게이트가 staff-role 협업자를 조용히 튕겨낸다. "staff-role 사용자에게 employer 화면을 보여줄 것인가"라는 제품 결정이 필요해 별도 슬라이스로 남긴다.

---

## 9. P0 B·C(표시)·D + actorId 후속 실행 기록 (2026-07-11, 완료)

브랜치 `analysis/userflow-audit-20260710` 커밋 `79ef444eb`..`4e4418396` (5커밋). 오케스트레이션: 메인 세션(설계·prod 실측·검증·커밋) + opus 구현자 3명 병렬(파일 집합 상호 배타) + 적대 리뷰(code/security).

| 커밋 | 슬라이스 | 내용 |
|---|---|---|
| `79ef444eb` | actorId 후속(§8 백로그) | 정산 커스텀설정 2서비스가 `requireCurrentUser()`로 actorId 파생, 훅의 `posting.ownerId` 전달 제거 + `modifiedBy` 서비스 스탬핑 |
| `d82ecaba0` | P0#2 (C 표시) | 완료 건 표시액 `payrollAmount` 동결값(Number.isFinite), 레거시·미완료는 재계산 fallback. 그룹 summary 자동 반영 |
| `d0cf940b1` | P0#4 (D) | `isTournamentApprovalBlocked` SSOT(fail-closed) + `applyToJobV2` 게이트(E6080) + 공개/인증 상세 2화면 |
| `82d0bc92d` | P0#1 (B) | RPC `employer_initiates` 분기 신설 + 클라 4계층 actorType 배관 + **합성 applicationId 제거**(22P02 이중결함) + pgTAP 7케이스 |
| `4e4418396` | B 보안 하드닝 | 인가 OR-체인 `COALESCE(owner_id = actor, false)` — NULL owner_id fail-open 방어(pgTAP E8) |

**prod 실측이 뒤집은 핸드오프 전제 (B)**: ① RPC에 `employer_initiates` 분기가 아예 없어 클라 수정만으론 `invalid_actor_type` — 마이그레이션 필수. ② `buildApplicationId`가 `${jobPostingId}_${staffId}` 합성 문자열을 uuid 파라미터에 넘겨 unauthorized 이전에 22P02로 즉사(이중 파손). ③ 알림 트리거에 confirmed→applied 분기가 없어 RPC 분기 내 직접 INSERT(예외 삼킴)로 스태프 통지.

**보안 리뷰가 잡은 것 (MEDIUM, 수정함)**: `job_postings.owner_id`는 nullable(ON DELETE SET NULL) — 고아 공고에서 `NULL = actor` 전파로 인가 IF 미발화 → fail-open. **하드닝 전 본문에서 외부인이 고아 공고 확정을 실제 해제함을 pgTAP E8 RED로 라이브 실증** 후 COALESCE로 fail-closed(기존 staff_approves 분기 동시 하드닝). 이 fail-open은 prod에 선재하던 것이다.

**prod 적용·검증**: `apply_migration` 후 prod↔로컬 함수 정의 **md5 완전 일치**(`66af3a45...`) — pgTAP 653건이 통과한 본문 그대로. grants anon=false/authenticated=true, advisor ERROR 0(WARN 175 전역 기지). D는 prod tournament 공고 0건 실측으로 차단 회귀 없음 확인.

**검증 증거 종합**: 전체 jest 386스위트/4935 PASS · 전체 pgTAP 56파일/653 PASS(E8 RED→GREEN 포함) · tsc 0 · 슬라이스별 TDD RED 확인 · 보안 적대리뷰 APPROVE(조건 반영). 코드 리뷰는 슬라이스1만 완료(APPROVE), 나머지 3슬라이스는 리뷰어 세션 한도로 중단 — 마이그레이션 SQL은 기존정의↔적용본 diff 실측(의도 변경 4종 외 무변경)으로 대체, 앱레이어 정식 재리뷰는 후속.

**신규 후속 백로그**: ①applications INSERT RLS에 approvalStatus 방어심화(LOW, 보안리뷰) ②ScheduleCard `payrollAmount > 0` 가드 — 동결값 0 처리 SSOT 통일(LOW) ③`CancelActorType` 인터페이스 배럴 재수출(LOW) ④confirmedStaffService 감사필드 클라값 fallback 제거(LOW, 기존 지적 재확인).
