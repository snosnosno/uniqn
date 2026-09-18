# DB red 잔여 → 최종 리뷰 → 머지 → **배포 직전 상태**까지 — 다음 세션 프롬프트

> 작성 2026-09-18. **09-15 판(`2026-09-15-db-red-and-release-session-prompt.md`)을 대체한다** —
> 그 문서는 배포까지 포함했지만 이번 범위는 **배포 직전에서 멈춘다**.
> 값은 2026-09-18 재실측. ⚠️ 실행 직전 한 번 더 재실측할 것(3일 만에 master 가 움직였다).

---

## 0. 이번 세션의 완료 조건 (exit proof)

**끝났다고 말할 수 있는 상태:** — ✅ **6/6 전부 충족 (2026-09-19 종결)**

1. ✅ DB red **4건 전부 닫힘**. baseline 차분으로 귀책(마이그 제외/포함 두 번 실행), 신규 파손 0건.
   남긴 red 없음 → "왜 남기는지" 항목은 해당 없음.
2. ✅ 이 세션에서 실행·기록: `npm run quality` exit 0 · `npx tsc --noEmit` exit 0 ·
   **전체** jest 691/691 suites·7753/7753 tests · `db:reset && test:db` 123 files/**1394** tests/PASS.
   (영향권을 파일명 패턴으로 고르지 않고 전체를 돌렸다 — §7의 교훈 적용)
3. ✅ fable 리뷰 2종 병렬 수령. code-reviewer = **APPROVE**(CRITICAL/HIGH 0, MEDIUM 1 + LOW 1),
   database-reviewer = MEDIUM 1. **지적 3건 전부 반영**(상세는 §6-4 및 각 커밋 메시지).
4. ✅ PR #497 **MERGED** = `e058f3215`. 원격 브랜치 삭제, 로컬 브랜치 삭제,
   워크트리 제거(정션 4단계 준수 — 원본 818 무손상), 아카이브 태그 2개 원격 보존.
5. ✅ 로컬 `master` = `origin/master` = `e058f3215` (ahead 0 / behind 0).
6. ✅ §6 이 **실측 사실로 채워짐** — prod 사전검증(마이그 4건 미적용 확증·파리티 225/102 일치·
   함대 갈림 판정) 완료. 사람이 "가자"만 하면 되는 상태.

🔴 **하지 않는 것**: `prod-migrate` 실행 · OTA 발행 · 웹 배포. 전부 다음 단계다.

---

## 1. 시작 지점 (2026-09-18 실측)

| 항목 | 값 |
|---|---|
| 작업 워크트리 | `C:/Users/user/Desktop/T-HOLDEM-ia-followup` (node_modules 정션 **살아 있음**) |
| 브랜치 | `feat/employer-ia-followup` · HEAD `3ed8b748f` |
| PR | **#497** OPEN · MERGEABLE · **UNSTABLE** |
| origin/master | **`3a7e8645e`** ← 09-15 이후 움직였다 (#498 체불사업주 명단 안내 링크) |
| #497 이 뒤처진 커밋 | **2개** (`3b34e4c4b` #496 · `3a7e8645e` #498) |
| 로컬 Supabase | **꺼져 있음** → `npm run db:start` 필요 |
| 메인 체크아웃 | `master` = `b67ad14b7` (**낡음**, §5 참조) |

```bash
cd C:/Users/user/Desktop/T-HOLDEM-ia-followup
git fetch origin
git log --oneline HEAD..origin/master     # 재통합 필요분
gh pr checks 497
cd uniqn-mobile && npm run db:start        # Docker Desktop 먼저 켤 것
```

### #497 체크 현황 (09-18 실측)

**`DB Tests (pg_prove)` 만 fail. 나머지 13종 전부 pass** — Tests(jest) · E2E · Quality 5종 ·
Bundle · EAS Config 포함. 즉 **남은 red 는 DB Tests 하나뿐**이고 그게 이번 세션의 본체다.

---

## 2. 이전 세션이 이미 한 것 (재조사 금지)

브랜치에 커밋 7개. 요약:

- 구인자 IA 후속 3건 — 정산 알림 문구 송금보증 제거(마이그 `20260915122335`) · 출처 칩 캐시
  회귀 테스트 · ConfirmedStaffCard hex 토큰화
- 🔴 **보안 드리프트 복원**(마이그 `20260915133500`) — 레포 체인이 prod 보다 **82개 더 열려
  있었다**. `db:reset` 로 세우면 anon 실행가능 함수 108개, prod 는 26개. 초과분에
  `permanently_delete_user` · `update_user_role` · ops 쓰기 RPC 35종.
  복원 후 실측 anon 26 / authenticated 거부 77 = prod 와 일치.
- pgTAP 2종 복구 — 나중에 들어온 제약보다 오래돼 INSERT 에서 죽던 것들

**pgTAP 실패 22 → 4** (마이그 포함/제외 두 번 돌려 차분, 신규 파손 0건으로 확인).
🔑 **마이그 2개 다 prod 미적용** — 이번 세션에서도 적용하지 않는다.

---

## 3. 남은 red 4건 — 처리 순서와 판단 기준

먼저 재현한다:
```bash
cd C:/Users/user/Desktop/T-HOLDEM-ia-followup/uniqn-mobile
npm run db:reset && npm run test:db > /tmp/pgtap_now.log 2>&1; echo "EXIT=$?"
grep -E "Looks like|Result:" /tmp/pgtap_now.log | tail -20
```

### 3-1. `parity_baseline_guard` — **조사 끝남. 장부 갱신만**  ← 가장 먼저

실측 prod = 로컬 = **함수 225 / 정책 102**. 테스트 기대값 **216 / 113**.

정책 −11 의 출처를 추적해 찾았다. **소실이 아니라 의도적 통합 2건**:

| 마이그 | 내용 | 정책 |
|---|---|---|
| `20260809140000_rls_cost_hygiene…` | 감사 cost-01 이 지목한 **글자 그대로 중복** 정책 제거(`jp_select_public_search` 가 `job_postings_select_all` 과 동일 qual) + `ops_prizes_select` | DROP2 / CREATE1 |
| `20260910002240_harden_communication_board` | free/tda/substitute 게시판·투표 폐지, 정책 10→3 | DROP10 / CREATE3 |

**할 일**: `supabase/tests/parity_baseline_guard.test.sql` 의 append-only 장부에 2026-09-18
항목을 추가하고 기대값을 **225 / 102** 로 올린다. 위 두 마이그를 사유로 적는다.

⚠️ **함수 +9 의 출처는 아직 안 뽑았다.** 숫자만 덮지 말고 출처를 세서 적을 것:
```bash
# 장부 마지막 갱신 이후 신설된 함수 찾기
grep -l "CREATE OR REPLACE FUNCTION\|CREATE FUNCTION" supabase/migrations/20260{8,9}*.sql
```
🔑 이 가드의 목적은 "레포만 아는 오브젝트 검출"이다. **근거 없는 숫자 갱신은 가드를 죽인다.**

### 3-2. `posting_qr_attendance` — **제품 결정이 필요하다. 사람에게 먼저 물어라**

이전 세션이 두 단계를 고쳐 마지막 단언까지 도달시켰고, 거기서 **실제 결함**이 드러났다.

🔴 퇴근 후보 조건이 `v_scanned_at BETWEEN check_in_ts AND check_in_ts + 16h` 인데
`20260909135618` 의 15분 정규화가 `check_in_ts` 를 **올림(ceil)** 한다. 출근 직후
`check_in_ts` 는 최대 15분 **미래**라 후보가 0 → `checkout_too_early` 가 아니라
`no_eligible_work_log` 가 나온다.

막히는 것 자체는 맞다(0시간 기록은 안 생긴다). 문제는 **막히는 이유가 다르게 보인다** —
스태프는 출근 직후 최대 15분간 "방금 찍었으니 잠시 후" 대신 **"해당 근무가 없습니다"** 를 본다.

**AskUserQuestion 으로 물을 것:**
- **(a)** 후보 구간 하한을 `check_in_ts` → 원본 스캔 시각 `check_in_scanned_at` 으로.
  기존 `checkout_too_early` 가 살아난다. **마이그 필요**(`process_posting_qr_attendance`).
- **(b)** 올림 정규화를 유지하고 이 구간 전용 에러/문구를 분리. 클라 문구도 함께.
- **(c)** 이번엔 두지 않고 red 로 남긴 채 머지(문서에 사유 기록).

⚠️ 기대값을 `no_eligible_work_log` 로 바꿔 통과시키지 말 것 — **UX 결함을 계약으로 굳히는
것**이다. 선택지는 테스트 주석에 이미 적혀 있다.

### 3-3. `work_schedule_qr_container_auto` — 3-2 와 같은 뿌리일 가능성 높음

```
Failed 5: "auto 분기: checked_in→checkOut 도출"   have: NULL       want: checkOut
Failed 6: "auto checkOut 후 status=checked_out"   have: checked_in want: checked_out
Failed 7: "checkOut 시 기존 clocked_out_raw 원본 불변"
```
**3-2 를 먼저 결정·구현하고 이걸 다시 돌려라.** 같이 풀릴 수 있다. 안 풀리면 별도 조사.

### 3-4. `communication_comment_update_hardening` — 미조사. 가드 발화 **순서** 문제

```
Failed 5: "an author cannot pin their own comment"
  caught: PERMISSION_DENIED: pinned comments require pin metadata
  wanted: PERMISSION_DENIED: authors cannot moderate comments
Failed 2·3: immutable routing / identity 컬럼 업데이트 차단
```
`enforce_board_comment_update_scope` / `enforce_board_comment_pin_invariants` 두 트리거의
검사 순서로 보인다. 관련 마이그 `20260910002240` · `20260910123555` · `20260910153217`.

**메타데이터 검사가 먼저인가, 권한 검사가 먼저인가**를 정해야 한다 — 사용자가 보는
메시지가 달라진다. 일반적으로 **권한이 먼저**다(권한 없는 사람에게 내부 구조를 알려주지
않는다). 그 방향이면 트리거 순서 또는 가드 내부 순서를 고치고, 테스트는 그대로 둔다.

---

## 4. 최종 리뷰

red 를 닫은 뒤, 머지 **전에**:

```
Agent(subagent_type: "code-reviewer",     model: "fable")  # 전체 diff
Agent(subagent_type: "database-reviewer", model: "fable")  # 마이그 2개 + 새 마이그
```
- 두 개를 **한 메시지에 병렬** 디스패치.
- 디스패치 프롬프트에 금지사항 명시: `mcp__supabase__*` 직접 호출 금지(PROD) · 기존
  마이그 수정 금지 · 파일 수정 금지(판정만).
- ⚠️ 에이전트의 "성공" 보고를 그대로 믿지 말 것 — diff·테스트로 독립 검증한 뒤 반영.
- 이전 세션에서 fable 리뷰가 **실제 결함 3건**을 잡았다(자기검증 블록의 NULL 구멍 ·
  COALESCE sentinel 이 가드를 무력화 · 오버로드 조회). 형식적으로 돌리지 말 것.

---

## 5. 머지 + 정리 + master 정렬

### 5-1. master 재통합 (필수 — 2커밋 뒤처져 있다)
```bash
cd C:/Users/user/Desktop/T-HOLDEM-ia-followup
git fetch origin && git merge origin/master      # 🚨 rebase 금지 (squash 저장소)
# 재통합 후 반드시 재검증
cd uniqn-mobile && npm run quality > /tmp/q.log 2>&1; echo $?
npx tsc --noEmit; echo $?
npm run db:reset && npm run test:db > /tmp/t.log 2>&1; echo $?
git push
```

### 5-2. 머지
```bash
gh pr checks 497                                  # 전 항목 확인
gh pr merge 497 --squash --delete-branch
gh pr view 497 --json state,mergeCommit
```
DB Tests 가 여전히 red 라면 **왜 red 인지 이 문서로 설명 가능해야** 머지한다.

### 5-3. 정리 — 🔥 정션이 원본을 날린 이력이 있다. 순서 엄수
```bash
# 1) 정션 확인 (0xa0000003 = MOUNT_POINT)
MSYS_NO_PATHCONV=1 cmd.exe /c "fsutil reparsepoint query C:\Users\user\Desktop\T-HOLDEM-ia-followup\uniqn-mobile\node_modules"
# 2) 원본 기준선 (818개)
ls "C:/Users/user/Desktop/T-HOLDEM/uniqn-mobile/node_modules" | wc -l
# 3) 재귀 없이 링크만 끊기
MSYS_NO_PATHCONV=1 cmd.exe /c "rmdir C:\Users\user\Desktop\T-HOLDEM-ia-followup\uniqn-mobile\node_modules"
# 4) 부재 + 원본 무손상 확인 (818 이어야 함)
test -e "C:/Users/user/Desktop/T-HOLDEM-ia-followup/uniqn-mobile/node_modules" && echo "🔴 남음" || echo "✅"
ls "C:/Users/user/Desktop/T-HOLDEM/uniqn-mobile/node_modules" | wc -l
# 5) 그 다음에만
cd C:/Users/user/Desktop/T-HOLDEM
git tag archive/employer-ia-followup-20260918 <머지 전 브랜치 HEAD>
git push origin archive/employer-ia-followup-20260918
git worktree remove C:/Users/user/Desktop/T-HOLDEM-ia-followup
```
🔥 `git worktree remove --force` 를 정션 해제 **전에** 쓰면 원본이 818→0 이 된다(09-14 실사고).

### 5-4. 🔴 로컬 master 정렬 — **배포 직전 상태의 필수 조건**

메인 체크아웃 `master` 가 **IA 웨이브 이전 상태**다.
```
로컬  b67ad14b7   (S4·S5 파일 없음, S2 가 지운 파일 살아있음)
원격  3a7e8645e
```
9개 커밋은 upstream 에 squash 로 들어간 것들이고 아카이브 태그
`archive/local-master-prewave-20260915` 로 **원격에 보존돼 있다**.

⚠️ `git reset --hard` 는 이 환경의 권한 설정이 **차단**한다(이전 세션 2회 거부).
사용자에게 직접 실행을 요청한다:
```
! cd C:/Users/user/Desktop/T-HOLDEM && git reset --hard origin/master
```
**정렬 없이는 배포 준비 완료로 보고하지 말 것** — 낡은 트리로 번들을 만들면 웨이브가
통째로 빠진다.

---

## 6. 배포 직전 상태 — ✅ **사실로 채움 (2026-09-19 실측)**

> 이 절은 계획이 아니라 **실측 기록**이다. 다음 세션은 여기 값을 그대로 쓰고 판단을 반복하지 않는다.
> 🔴 이번 세션에서 실행하지 않은 것: `prod-migrate` · OTA 발행 · 웹 배포. 전부 다음 단계다.

### 6-0. 착지 결과

| 항목 | 값 |
|---|---|
| PR #497 | **MERGED** (2026-09-18T02:52:45Z) |
| **머지 후 `origin/master`** | **`e058f3215`** — `fix(notify): 정산 알림 문구에서 송금 보증 제거 + 구인자 IA 후속 2건 (#497)` |
| 로컬 `master` | **`e058f3215`** — ahead 0 / behind 0 (정렬 완료) |
| 원격 브랜치 | `feat/employer-ia-followup` **삭제됨** |
| 아카이브 태그 | `archive/employer-ia-followup-20260918` = `de734b729` (원격 push) · `archive/local-master-prewave-20260915` = `b67ad14b7` (정렬 전 로컬 master) |
| 워크트리 | `T-HOLDEM-ia-followup` 제거 완료 — 정션 4단계 절차 준수, 원본 `node_modules` **818 → 818 무손상** |
| DB red | **0건**. `db:reset && test:db` = 123 files / **1394 tests** / PASS |
| CI (`de734b729`) | **14/14 pass** — DB Tests · E2E · Quality 5종 포함 |

### 6-1. prod 마이그 **4건** 대기 — 사전 검증 완료 (적용하지 않았다)

⚠️ 09-18 판은 2건으로 적었으나 이번 세션이 2건을 더 만들었다. **적용 순서 = 접두사 순**:

| 마이그 | 내용 | 적용 시 함수/정책 증감 |
|---|---|---|
| `20260915122335` | 정산 알림 문구 송금보증 제거 | 0 (CREATE OR REPLACE 2종) |
| `20260915133500` | 권한 하드닝 복원 | 0 (GRANT/REVOKE 전용) |
| `20260918105900` | QR 퇴근 후보 하한 = 원본 스캔시각 | 0 (CREATE OR REPLACE 1종) |
| `20260918110000` | 댓글 권한 검사를 핀 불변식보다 먼저 | 0 (트리거 재등록) |

**`list_migrations` 실측**: prod 최신 = **`20260911053907`**(work_schedule_safety_contract). 위 4건 **전부 기록 없음**.
🔑 **`pg_proc`·트리거 실측 병행**(기록이 없어도 오브젝트는 있을 수 있으므로) — 4건 모두 미적용 확증:

| 읽기 전용 확인 | prod 실측 | 기대 | 판정 |
|---|---|---|---|
| anon 실행가능 public 함수 | **26** | 26 | ✅ `20260915133500` 은 prod 에서 **no-op**(레포만 열려 있었다) |
| authenticated 거부 함수 | **77** | 77 | ✅ 동일 |
| `notify_on_work_log_update` 에 구 문구(`정산이 완료되었습니다`) | **있음** | 있음 | ✅ `20260915122335` 미적용 |
| `board_comments` pin 트리거 이름 | **`board_comment_pin_invariants`**(구 이름) | 구 이름 | ✅ `20260918110000` 미적용 |
| `board_comments` attacl (authenticated UPDATE) | body,image_attachments,is_pinned,mentioned_user_ids,pinned_at,pinned_by,status,updated_at | 동일 8컬럼 | ✅ 새 pgTAP 단언이 prod 에도 유효 |
| `board_comments` attacl (anon) | **0** | 0 | ✅ |

⚠️ **레포↔prod 기록명 어긋남 재확인** — 9월 마이그 7건은 prod 에 **다른 접두사**로 이미 있다. 재적용 금지:
`20260909135618`→prod `20260910163934` · `20260910002240`→`20260910003856` · `20260910104500`→`20260910103444` ·
`20260910110000`→`20260910103943` · `20260910123553`→`20260910163945` · `20260910123555`→`20260910163957` ·
`20260910153217`→`20260910164009`

### 6-2. 파리티 — **장부와 prod 가 일치한다**

- 새 기준선 = **함수 225 / 정책 102** (`parity_baseline_guard.test.sql`, 기계 마커 `PARITY_EXPECT_FUNCS=225` / `_POLICIES=102` 동시 갱신)
- **prod 실측 = 225 / 102** — 정확히 일치. 대기 4건은 전부 증감 0이므로 **적용 후에도 불변**.
- 따라서 `parity-smoke`(주간)는 이제 통과 상태다. 09-12 판이 남긴 "정책 11개 감소의 정체를 밝혀라"는 **규명 완료**:
  차이의 전부는 장부에 누락된 9월 마이그 7건이고, 정책 −11 은 `20260910002240` 한 건에서
  정책 순감 7 + **`DROP TABLE board_votes` 로 함께 사라진 `bv_*` 정책 4** 다.
  (09-18 판이 지목한 `20260809140000` 은 원인이 아니다 — 이미 장부에 반영돼 있었다.)

### 6-3. OTA / 웹 배포 — 사실값

| 항목 | 값 (근거) |
|---|---|
| 앱 `version` | **1.0.7** (`uniqn-mobile/package.json`) |
| `runtimeVersion` 정책 | `{ policy: 'appVersion' }` (`app.config.ts:449`) → OTA 대상 = **1.0.7 함대** |
| version bump 필요? | **불필요** — 이 PR 에 `package.json`·`app.config.ts`·`ios/`·`android/`·`plugins/` 변경 **0건**(네이티브 무변경) |
| 🚨 **1.0.6 함대 추가 발행 필요?** | **불필요**. 근거: 사용자가 보는 정산 알림 문구의 실질 정본은 **DB 트리거**다 — `20260915122335` 가 prod 에 적용되면 **1.0.6 포함 전 함대**가 새 문구를 그대로 렌더한다. 클라 사본 변경(`notificationMessageNormalizer.ts`)은 `normalizeNotification` 을 타는데, 그것은 `shouldNormalizeNotification` 이 **영어 레거시 문구**(`ENGLISH_NOTIFICATION_TITLES` / `..._BODY_FRAGMENTS`)를 감지했을 때만 도는 폴백이라 한글 body 는 통과시킨다. 나머지 `notificationTemplates.ts` 는 로컬 근무 리마인더(`shiftReminderScheduler.ts`) 전용 경로다. |

⚠️ 실행 시 그대로 적용되는 기존 함정(변동 없음 — 재조사 불필요):
- `eas update` 는 **shell env 만 평가**한다(`.env` 파일을 읽지 않는다)
- `app_config` 는 반드시 `{ios, android, web}` 객체
- 웹배포는 **메인 체크아웃에서만**(워크트리면 빈 번들) · `--branch=master` 명시(detached HEAD 는 Preview 로 간다)
- 배포 후 번들 검증 거짓음성 2종: 한글은 `\uXXXX` 이스케이프 · CDN 엣지캐시 → **대조군 동시검사**(`grep -F`)
- 🚨 긴 배포·OTA 실행 **도중**에도 메인 체크아웃이 바뀐 이력이 있다 → 긴 명령 전후로 `git rev-parse HEAD` 대조

### 6-4. 이번 세션이 남긴 후속 과제 (코드 잔여 아님 — 판단 필요)

1. **QR 출근시각 정정과 원본 스캔시각의 관계** (fable DB 리뷰 MEDIUM, 선재 갭)
   `check_in_scanned_at` 은 보호 트리거로 불변인데 `check_in_ts` 는 `update_work_log_slot` 로
   자유롭게 수정되고 둘의 관계를 강제하는 CHECK·트리거가 없다(`pg_constraint` 실측).
   관리자가 출근을 16시간 이상 앞당기면 퇴근 후보 구간이 역전된다.
   🔑 **회귀는 아니다** — 같은 시나리오에서 옛 구간도 0건이었고, 도달 가능한 퇴근 스캔시각
   범위에서 새 구간은 옛 구간을 포함한다(실측 대조). 근본 해결은
   `update_work_log_slot` 이 원본 스캔시각을 함께 클램프할지의 **제품 판단**이다.
   상세는 `20260918105900` 헤더 주석.
2. **픽스처 블랭킷 GRANT 와 컬럼 ACL 단언** — 해결책은 확립됐다(`pg_attribute.attacl` 로 단언하면
   픽스처의 `pg_class.relacl` 오염과 무관하다). 같은 함정이 걸린 다른 테이블이 있으면 같은 방식으로 옮긴다.


## 7. 검증 규율 (이전 세션이 전부 실제로 물린 것들)

```bash
# ✅ 진짜 종료코드
npm run quality > /tmp/q.log 2>&1; echo $?
# ❌ npm run quality | tail -30   ← 이 exit code 는 tail 의 것이다
```

- 🔑 **"영향권 jest" 를 파일명 패턴으로 고르면 뚫린다.** `jest notificationMessageNormalizer`
  로 초록을 봤지만 같은 문구를 단언하는 `notificationService.test.ts` 는 이름이 달라
  매칭되지 않아 CI 에서야 빨개졌다. → **디렉터리로** (`jest src/services/notifications`).
- 🔑 **pgTAP 실패 귀책은 baseline 차분으로만.** 대상 마이그를 잠시 빼고
  `db:reset`+`test:db` 를 한 번 더 돌려 실패 집합을 비교한다. 추정 금지.
- 🔑 **plpgsql 검증 블록은 대조군을 돌려야 한다.** `SELECT INTO` 0행 → 변수 NULL →
  `NULL NOT LIKE '…'` 는 TRUE 가 아니라 NULL → `IF` 가 거짓으로 접혀 최악의 경우가
  조용히 통과한다. 통과만 보면 "실패할 수 없는 검증"과 구분이 안 된다.
- 🔑 `MSYS_NO_PATHCONV=1` — `git show "origin/master:경로"` · `docker cp` 가 없으면 **거짓 실패**.
  SQL 주입은 `docker exec -i ... psql < file`(`-i` 없으면 출력 0줄 성공처럼 끝난다).

---

## 8. 하지 말 것

- `prod-migrate` 실행 · OTA 발행 · 웹 배포 — **이번 범위 밖**
- 기존 마이그레이션 파일 수정(새 파일로만)
- `parity_baseline_guard` 기대값을 **근거 없이** 실측으로 덮기
- `posting_qr_attendance` 기대값을 `no_eligible_work_log` 로 바꿔 통과시키기
- 정션 재귀 삭제 · `worktree remove --force` 를 해제 전에
- `master` 직접 push(E2E 우회) · rebase(squash 저장소)
- 워크트리에서 `npm install`

---

## 9. 세션 종료 시 남길 것

- 이 문서 §6 체크리스트를 **사실로 채운** 상태
- 메모리 갱신: 머지 커밋 SHA · red 최종 상태 · 배포 대기 항목
- red 를 남겼다면 **왜 남겼는지**와 다음 수순
