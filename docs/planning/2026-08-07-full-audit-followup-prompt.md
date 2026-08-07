# 전체 감사 후속 — 다음 세션 착수 프롬프트

> 감사 원본: `docs/analysis/2026-08-07-full-app-audit.md` (진실원)
> 이 문서는 **착수용**이다. 감사 재실행 금지 — 아래 "이미 확인된 사실"은 prod·소스로 검증됐다.

---

## 진행 상황

| 트랙 | 상태 |
|---|---|
| **A1 + A2 (탈퇴 파이프라인)** | ✅ **완료 — PR #427** (prod 마이그 `20260807022947`·`20260807023036` 적용됨, 재적용 금지) |
| **A3 알림 타입 정합** | ✅ **완료 — PR #429 머지 `fefe6b609`** (아래 "A3 교정" 참조). prod 마이그 `20260807052312`·`20260807052352` 적용됨, **재적용 금지** |
| A4 · B1 · B2 · B3 · 카피 가이드 | ⏸ 로드맵 참조 |

### 🚨 A1 착수 중 밝혀진 것 — 감사 기재를 교정한다

**감사(및 이 문서 초판)는 "prod `deactivated` 0건 → 아직 피해자 없음"이라고 적었으나 틀렸다.**
0건인 이유는 아직 탈퇴한 사람이 없어서가 아니라 **탈퇴가 구조적으로 불가능해서**였다.

prod `users_status_check` 가 `active|inactive|suspended|deleted` 만 허용하는데
`UserRepository.requestDeletion` 은 `'deactivated'` 를 쓴다 → CHECK 위반으로 **탈퇴 요청 자체가 100% 실패**.
로컬에서 동일 UPDATE 재현: `violates check constraint "users_status_check"`.

→ 크론 가드(A1)만 고쳤다면 삭제 대상 행이 영영 0건이라 **수선이 공허**했다. 두 마이그를 함께 적용한 이유다.

🔑 **교훈: "0건"은 그 자체로 아무것도 말해주지 않는다. 0인 원인을 확인해야 결론이 뒤집히지 않는다.**

부수 발견(A1 범위 밖, 별도 조치 완료): 공개 레포의 시드 마이그 평문 비밀번호가 prod
`review-admin`(role=admin) 과 실제로 일치했다 → 4계정 회전 + 세션 93·refresh token 108 파기.
상세는 PR #427 및 메모리 `pitfall_public_repo_seed_credentials_live_in_prod`.

### 🚨 A3 착수 중 밝혀진 것 — 감사 기재를 교정한다 (2건)

**교정 ①: 미등록 타입은 2종이 아니라 4종이었다.**
감사는 `work_log_check_in/out` 만 잡았으나, prod `pg_proc.prosrc` 대조로
`job_posting_collaborator_added` / `job_posting_collaborator_removed` 도 미등록임이 드러났다
(전자는 prod 2건 실발송). **사람이 손으로 대조하면 또 놓친다** — 이게 "DB 발송 타입" 축
드리프트 가드가 필요한 이유의 실증이다.

**교정 ②: 이건 결함이 아니라 리팩터 회귀였다. 그래서 해법이 감사 제안보다 싸다.**
2026-04-17 원설계(`archive/20260417050000`)는 출퇴근 알림을 수신자별로 나눠 보냈다 —
`check_in_confirmed`(스태프, `/schedule`) / `staff_checked_in`(구인자, `/employer/applicants/{id}`).
2026-04-21 timestamptz 전환(`archive/20260421190000`, 문서상 목표 "비파괴")이 이 넷을
`work_log_check_in/out` 두 종으로 **조용히 합쳤다.** 타입이 곧 딥링크 방향 판별자였으므로
그 순간 ①카테고리 탭 증발 ②푸시 게이트 fail-open ③구인자 오착지가 동시에 발생했다.

→ 클라 배선(라벨·라우트맵·EF맵·그룹핑)이 **원설계 시절 그대로 완비**돼 있었다.
   "클라가 새 값을 흡수"하는 대신 **DB 를 되돌리니** 셋이 한 번에 닫혔고,
   감사가 제안한 0-param 라우트맵 우회도 불필요해졌다.

🔑 **교훈: 미등록 값을 보면 "누가 등록을 빠뜨렸나"가 아니라 "언제부터 이 값이었나"를 먼저 물어라.**
   `git log -S` 로 값의 출생을 추적하면 결함이 아니라 회귀인 경우가 있고, 그때는 복원이 정답이다.

🔑 **부수 교훈(pgTAP): RLS 테이블의 "0건"은 "행이 없다"가 아니라 "안 보인다"일 수 있다.**
   `notifications` 단언을 admin 세션에서 하면 `notif_select`(recipient_id = auth.uid())가
   staff 수신 행을 통째로 숨긴다. 30분을 여기서 썼다. 단언은 **수신자 세션**에서 할 것 —
   덤으로 "수신자가 실제로 볼 수 있다"까지 증명된다.

**산출물**: 마이그 2건(`20260807160000` 트리거 복원 · `20260807170000` inquiry 발송) +
드리프트 가드 3파일 + pgTAP 신규 1파일(+기존 1파일 확장) + 클라 7파일.

🔴 **prod 기록명이 레포 파일명과 다르다 — 재적용 금지**: `20260807160000`→**`20260807052312`** ·
`20260807170000`→**`20260807052352`**. 파리티 **200/111 불변**, 레포↔prod md5 일치(`chr(13)` 제거 후).

**잔여**: 🔴웹배포/OTA · 🔴실기기 QA ·
⚠️EF 는 머지 즉시 자동배포라 OTA 전까지 "푸시는 끊겼는데 앱 표시는 아직 회색 시스템" 구간이 있다(고지 필요).

---

## 다음 세션에 붙여넣을 프롬프트

> ⚠️ 아래 블록은 **A1·A2 용이며 이미 완료**됐다. 다음 세션은 **A3** 다 —
> 이 블록의 §0(착수 전 상태 확인)·§2(작업 규율)·§3(하지 말 것)은 그대로 재사용하고,
> §1 범위만 로드맵 S+1 의 A3 로 바꿔서 쓸 것.
> A1 세션에서 §0-3(착수 대상 파일 실재 대조)이 감사에 없던 상류 결함을 잡아냈다 — **생략 금지**.

```
UNIQN 전체 감사 후속 작업이다.
docs/analysis/2026-08-07-full-app-audit.md 를 먼저 읽어라. 감사 재실행 금지 —
그 문서의 발견은 prod Supabase + 소스로 검증된 것이고, 2026-08-07 에 주요 8건
잔존을 재확인했다.

## 0. 착수 전 상태 확인 (순서 엄수)
1. `git status` — 내가 만들지 않은 미커밋 변경이 있으면 **워크트리 격리**
   (전역 규칙: 모든 구현 세션 = 전용 워크트리. clean 이어도 워크트리)
   node_modules 는 `mklink /J` 정션으로 5분 npm install 회피
2. `git log --oneline -15` + `grep "^## \[" wiki/log.md | tail -5`
   — 감사(08-07) 이후 머지로 이미 해결된 항목이 있는지 확인
3. **착수 대상 파일을 열어 감사 기재가 지금도 유효한지 대조**
   (감사 한계: 에이전트 보고분은 전수 재검증되지 않았다)
4. prod 마이그 이력 확인 — `list_migrations` 실측.
   ⚠️ 기록이 없어도 함수는 있을 수 있다. `pg_proc` 카운트 대조 병행
   (현재 파리티 기준 200/111)

## 1. 이번 세션 범위: P0 A1 + A2 (탈퇴 파이프라인)

다른 P0/P1 은 손대지 말 것. 한 세션 한 트랙.

### A1 — 영구삭제 크론이 100% 실패하는 구조 수정
문제: `permanently_delete_user` 첫 줄 `IF auth.uid() IS NULL → PERMISSION_DENIED`
가드가, service_role 로 호출하는 크론 EF 를 전부 막는다.
(service_role JWT 에 sub 없음 → auth.uid()=NULL. prod 에서 클레임 재현 실행 확인)

수정 방향 2택 — **설계 판정을 model:"fable" 서브에이전트에 위임**하고 사용자 승인 후 착수:
  ① RPC 가드에 service_role 분기 추가
     (`current_setting('request.jwt.claims')::jsonb->>'role' = 'service_role'`)
  ② EF 를 admin JWT 경유로 전환

⚠️ 필수 사전 조사:
- `supabase/tests/` **pgTAP 전수 grep** — 가드 변경이 기존 테스트를 깨뜨린 선례(#420)
- 마이그 재정의 베이스는 **가장 최근 정의**:
  `grep -l "CREATE OR REPLACE FUNCTION permanently_delete_user" supabase/migrations/*.sql | sort | tail -1`
- 마이그는 **MCP `apply_migration` 전용** (`db push` 금지)
- 적용 직후 정의 대조: `md5(replace(pg_get_functiondef(oid), chr(13), ''))`
  (chr(13) 없으면 CRLF 때문에 전부 가짜 불일치)

⚠️ 검증 딜레마: prod `status='deactivated'` 가 **0건**이라 동적 검증이 공허하다
(sparse-data 함정). 로컬 Supabase(`npm run db:reset`)에 탈퇴 행을 심어
크론 경로를 실제로 태워 **삭제 성공 1건**을 관측할 것. "고쳤다"의 증거는 그것뿐이다.

### A2 — 탈퇴 안내 문구와 실제 동작 정합
현재 `delete-account.tsx:234-238` 이 "진행 중인 지원 내역이 모두 취소됩니다",
"모든 데이터가 영구 삭제됩니다"라고 하는데 실제는 익명화이고 지원은 취소되지 않는다.

두 방향 중 **사용자 결정 필요** (착수 전 물어볼 것):
  (a) 문구를 실제에 맞춘다 (싸다. 단 "지원 취소" 기대가 깨진 채 남는다)
  (b) RPC 가 실제로 지원을 취소하고 정원을 회수하게 한다 (맞지만 범위가 커진다)
→ 🔴 **이 결정 없이 코드 작성 금지.**

덤(범위 내): 필수로 받는 탈퇴 사유가 저장되지 않는다
(`UserRepository.ts:301-313` UPDATE 에 reason 없음). 컬럼 추가 or 수집 제거 택일.

## 2. 작업 규율
- 신규 3+ 파일 = **설계 먼저**(HARD-GATE). `/autoplan`, 판정은 model:"fable" 위임
- TDD: RED → GREEN → IMPROVE. 회귀 테스트는 **Red-Green 사이클 검증**
  (수정 되돌렸을 때 실패하는지 확인 — 단일 통과는 증거가 아니다)
- 코드 작성 직후 code-reviewer(fable) 자동 디스패치
- 완료 주장 전 `npm run quality` + `npm test` **이 세션에서 실행한 출력** 제시
- ⚠️ 상수·enum·사용자 문구를 바꾸면 `e2e/` **별도 Grep 필수**
  (eslint ignores 라 `npm run quality` 범위 밖 — PR#353 실사고)
- 커밋은 사전승인(로컬 자율). push/PR 은 명시 요청 시에만

## 3. 이번 세션에 하지 말 것
- 감사 재실행 · 다른 P0/P1 항목 착수 · 리팩터링 곁다리
- 기존 마이그레이션 파일 수정 · PROD 우회 · `graphify install`
```

---

## 이미 확인된 사실 (재조사 금지 — prod·소스 검증됨)

| 사실 | 근거 |
|---|---|
| 크론 `process-scheduled-deletions` 매일 02:13 KST `active=true` | prod `cron.job` |
| EF 가 service_role 로 `permanently_delete_user` 호출 | `supabase/functions/process-scheduled-deletions/index.ts:51-86` |
| 가드 `IF auth.uid() IS NULL → RAISE 'PERMISSION_DENIED'` prod 에 현존 | prod `pg_get_functiondef` |
| service_role 클레임 재현 시 `auth.uid()`=NULL, 가드 발동=true | prod 실행 |
| ~~prod `status='deactivated'` **0건** → 아직 피해자 없음~~ **← 오귀인. 교정됨(위 "진행 상황" 참조)**: 0건인 이유는 `users_status_check` 가 그 값을 거부해 **탈퇴 자체가 불가능**했기 때문 | prod `users` 집계 + prod `pg_constraint` |
| uid 요구 SECDEF 56개 중 service_role 경로 호출은 이것 **하나뿐** | EF 전체 `.rpc()` 4종 대조 |
| RPC 는 applications·work_logs 를 **취소가 아니라 익명화** | 함수 본문 (baseline `20260710000002:8236-8267`) |
| 탈퇴 사유 저장 경로 없음 | `UserRepository.ts:301-313`, `:222` 주석 자인 |

---

## 이후 세션 로드맵 (한 세션 한 트랙)

| 순서 | 트랙 | 범위 |
|---|---|---|
| ~~S+0~~ | ~~**A1+A2 탈퇴 파이프라인**~~ | ✅ **완료 — PR #427** |
| ~~S+1~~ | ~~**A3 알림 타입 정합**~~ | ✅ **완료 — PR #429 머지 `fefe6b609`.** 실제 해법은 "클라 흡수"가 아니라 **DB 트리거 복원**이었다(위 교정 ② 참조). 잔여=웹배포/OTA·실기기 QA |
| **S+2 (다음)** | **A4 ErrorState 배선** | 12화면. 리뷰 허브 우선(`useReviews` 가 error 를 반환조차 안 함 → 훅 수정 선행) |
| S+3 | **B1 배선 안 된 8개 — 완성/제거 결정** | 🔴사용자 결정 필요. 북마크·지원자검색·구인처평점·대타글연결 / 죽은 알림 5종·statusFlow 는 제거 후보 |
| S+4 | **B2 정산 3건** | ⚠️메모리의 "R4 선행=`SettlementRepository.ts:372`·`:648` RPC 화"와 같은 트랙인지 먼저 대조 |
| S+5 | **B3 막다른 골목 4건** | profile-setup 탈출구 · 거절 재지원 · 사장탈퇴 통보 · 사용자 차단(Apple 1.2) |
| S+6 | **카피 가이드 1페이지 → 문체·용어 일괄 치환** | 가이드 확정 전 개별 수선 금지. 색상·토스트는 ESLint 로 재발 차단 |

⚠️ **P2/P3 은 위 트랙에 곁다리로 끼우지 말 것.** 별도 정리 세션에서 묶음 처리.
