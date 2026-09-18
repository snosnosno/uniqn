# DB Tests red 잔여 + 릴리스 파이프라인 — 다음 세션 프롬프트

> ⛔ **대체됨 → [`2026-09-18-red-fix-review-merge-session-prompt.md`](2026-09-18-red-fix-review-merge-session-prompt.md)**
> 09-18 판이 범위를 **배포 직전까지**로 좁히고(prod-migrate·OTA·웹배포 제외) 최종 리뷰·머지를
> 넣었으며, 그 사이 움직인 값(origin/master `3b34e4c4b`→`3a7e8645e`, #498 머지, #497 이 2커밋
> 뒤처짐, Tests·E2E 는 pass 로 전환)을 반영했다. **09-18 판을 읽어라.**
> 아래는 red 4건의 조사 내용이 상세해 참고용으로만 남긴다.

> 작성 2026-09-15. 선택지 **A**(남은 red 전부 판 뒤 배포까지) 실행용.
> 이 문서만 읽고 시작할 수 있게 썼다. 값은 전부 실측이며, 실행 직전 재실측할 것.

---

## 0. 시작 지점

| 항목 | 값 |
|---|---|
| 작업 워크트리 | `C:/Users/user/Desktop/T-HOLDEM-ia-followup` |
| 브랜치 | `feat/employer-ia-followup` (HEAD `47b4184e2`) |
| PR | **#497** OPEN · MERGEABLE · base `master` |
| origin/master | `3b34e4c4b` (wiki PR #496 머지 반영분) |
| 로컬 Supabase | Docker 스택 `supabase_db_uniqn`, 마이그 126개 적용 완료 |

```bash
cd C:/Users/user/Desktop/T-HOLDEM-ia-followup
git fetch origin && git log --oneline origin/master..HEAD   # 커밋 6개 확인
gh pr view 497 --json state,mergeable
docker ps --format "{{.Names}}" | grep supabase_db_uniqn      # 없으면 npm run db:start
```

⚠️ 워크트리 `node_modules` 는 메인 정션이다. **`npm install` 금지**(다른 워크트리까지 바뀐다).
정션이 끊겨 있으면:
```powershell
New-Item -ItemType Junction -Path 'C:\Users\user\Desktop\T-HOLDEM-ia-followup\uniqn-mobile\node_modules' -Target 'C:\Users\user\Desktop\T-HOLDEM\uniqn-mobile\node_modules'
```

---

## 1. 이전 세션이 한 것 (재조사 금지)

커밋 6개. 요점만:

- **구인자 IA 후속 3건** — 정산 알림 문구에서 송금 보증 제거(마이그 `20260915122335`) ·
  출처 칩 캐시 회귀 테스트 · ConfirmedStaffCard hex 토큰화
- **🔴 보안 드리프트 복원**(마이그 `20260915133500`) — 레포 체인이 prod 보다 열려 있었다.
  `db:reset` 로 세우면 anon 실행 가능 함수가 **108개**, prod 는 **26개**.
  초과분에 `permanently_delete_user` · `update_user_role` · ops 쓰기 RPC 35종이 있었다.
  복원 후 실측 anon 26 / authenticated 거부 77 = prod 와 일치.
- **pgTAP 2종 복구** — 나중에 들어온 제약보다 오래돼 INSERT 단계에서 죽던 것들
  (Bad plan: 계획 N개 중 0개 실행 = 초록도 빨강도 아닌 '측정 안 됨' 상태였다)

**pgTAP 실패 22 → 4. 새로 깨진 것 0건**(마이그 포함/제외 두 번 돌려 차분으로 확인).

🔑 **마이그 2개 다 prod 미적용이다.** 아래 §3 에서 적용한다.

---

## 2. 남은 red 4건 — 각각 다른 성격이다

먼저 현재 상태를 재현한다:
```bash
cd C:/Users/user/Desktop/T-HOLDEM-ia-followup/uniqn-mobile
npm run db:reset && npm run test:db 2>&1 | tail -30
```

### 2-1. `parity_baseline_guard.test.sql` — **조사 끝남, 장부 갱신만 남음**

실측: prod = 로컬 = **함수 225 / 정책 102**. 테스트 기대값은 **216 / 113**.

정책이 11개 줄어든 이유를 추적해 찾았다 — **의도적 통합 2건**이다:

| 마이그 | 내용 | 정책 증감 |
|---|---|---|
| `20260809140000_rls_cost_hygiene…` | 감사 cost-01 이 지목한 **글자 그대로 중복** 정책 제거(`jp_select_public_search` 가 `job_postings_select_all` 과 동일 qual) + `ops_prizes_select` | DROP 2 / CREATE 1 |
| `20260910002240_harden_communication_board` | free/tda/substitute 게시판 폐지 + 투표 폐지, 정책 10개를 3개로 통합 | DROP 10 / CREATE 3 |

→ 메모리의 "정책 감소 미조사" 항목은 이것으로 풀렸다. **소실이 아니라 통합이다.**

**할 일**: `supabase/tests/parity_baseline_guard.test.sql` 의 append-only 장부에
2026-09-15 항목을 추가하고 기대값을 **225 / 102** 로 올린다. 위 두 마이그와 함수 +9 의
출처를 각각 적는다(장부 규약이 "왜 늘었나/줄었나"를 줄마다 적는 것이다).

⚠️ **기대값을 그냥 실측으로 덮지 말 것.** 반드시 증감 사유를 함께 적는다 — 이 가드의
목적이 "레포만 아는 오브젝트 검출"이라 근거 없는 숫자 갱신은 가드를 죽이는 것이다.
함수 +9 의 출처는 아직 안 뽑았다. 이렇게 뽑는다:
```bash
# 장부 마지막 갱신 시점 이후 마이그에서 CREATE FUNCTION 신설분 세기
grep -l "CREATE OR REPLACE FUNCTION\|CREATE FUNCTION" supabase/migrations/2026090*.sql supabase/migrations/2026091*.sql
```

### 2-2. `posting_qr_attendance.test.sql` — **실제 UX 결함 발견, 제품 결정 필요**

이전 세션이 두 단계를 고쳐 **마지막 단언까지 도달시켰고**, 거기서 결함이 드러났다.
(고친 것: ① `status='checked_out'` 만 세워 CHECK 위반 → 퇴근 시각 동반 ②
픽스처를 스태프 JWT 로 실행해 payroll 가드에 차단 → 역할 전환 명시)

🔴 **결함**: 퇴근 후보 조건이
`v_scanned_at BETWEEN check_in_ts AND check_in_ts + 16h` 인데,
`20260909135618` 의 15분 정규화가 `check_in_ts` 를 **올림(ceil)** 한다.
출근 직후 `check_in_ts` 는 최대 15분 **미래**라 스캔 시각이 구간 아래로 떨어져 후보가 0 →
`checkout_too_early` 가 아니라 `no_eligible_work_log` 가 나온다.

막히는 것 자체는 맞다(0시간 기록은 안 생긴다). 문제는 **막히는 이유가 다르게 보인다**는
것 — 스태프는 출근 직후 최대 15분간 "방금 찍었으니 잠시 후" 대신 **"해당 근무가 없습니다"**
를 본다.

**할 일**: 둘 중 하나를 사람에게 물어 정하고 구현한다.
- **(a)** 후보 구간 하한을 `check_in_ts` 가 아니라 원본 스캔 시각 `check_in_scanned_at` 으로
  둔다 → 기존 `checkout_too_early` 가 살아난다. 마이그 필요(`process_posting_qr_attendance`).
- **(b)** 올림 정규화를 유지하고 이 구간 전용 에러/문구를 분리한다. 클라 문구도 함께.

⚠️ 기대값을 `no_eligible_work_log` 로 바꿔 통과시키지 말 것 — **UX 결함을 계약으로 굳히는
것**이다. 선택지는 테스트 주석에 이미 적어 뒀다.

### 2-3. `work_schedule_qr_container_auto.test.sql` — 미조사

증상(`pgtap5.log` 기준):
```
Failed test 5: "auto 분기: checked_in→checkOut 도출"   have: NULL   want: checkOut
Failed test 6: "auto checkOut 후 status=checked_out"   have: checked_in  want: checked_out
Failed test 7: "checkOut 시 기존 clocked_out_raw 원본 불변(덮어쓰기 금지)"
```
2-2 와 **같은 뿌리일 가능성이 높다**(15분 올림 → 퇴근 도출 실패). 2-2 를 먼저 결정하고
고치면 같이 풀릴 수 있으니 순서를 그렇게 잡는다. 아니면 별도 조사.

### 2-4. `communication_comment_update_hardening.test.sql` — 미조사

증상: 가드 **발화 순서**가 기대와 다르다.
```
Failed test 5: "an author cannot pin their own comment"
  caught: 42501: PERMISSION_DENIED: pinned comments require pin metadata
  wanted: 42501: PERMISSION_DENIED: authors cannot moderate comments
Failed test 2: "authenticated cannot update immutable comment routing columns"
Failed test 3: "authenticated cannot update comment identity columns"
```
`enforce_board_comment_update_scope` / `enforce_board_comment_pin_invariants` 두 트리거의
검사 순서 문제로 보인다. 관련 마이그: `20260910002240` · `20260910123555` ·
`20260910153217`. **어느 쪽이 옳은지**(메타데이터 검사가 먼저인가 권한 검사가 먼저인가)를
정하고 고친다 — 사용자가 보는 메시지가 달라진다.

---

## 3. red 를 닫은 뒤 — 릴리스 파이프라인

⚠️ 순서를 지킨다. 각 단계 **전후로 `git rev-parse HEAD` 를 대조**한다(긴 명령 도중 메인
체크아웃이 바뀐 사고가 2회 있었다).

### 3-1. 머지
```bash
cd C:/Users/user/Desktop/T-HOLDEM-ia-followup
git fetch origin && git log --oneline HEAD..origin/master   # 비어야 함. 아니면 merge 재통합 후 재검증
git push
gh pr checks 497                                            # 전 항목 확인
gh pr merge 497 --squash --delete-branch
```
- squash 저장소다. **rebase 금지**, master 재통합은 `merge` 로.
- DB Tests 가 아직 red 면 **왜 red 인지 이 문서로 설명 가능해야** 머지한다.

### 3-2. 정리 (정션이 원본을 날린 이력이 있다 — 절차 준수)
```bash
# 1) 정션인지 확인 (0xa0000003 = MOUNT_POINT)
MSYS_NO_PATHCONV=1 cmd.exe /c "fsutil reparsepoint query C:\Users\user\Desktop\T-HOLDEM-ia-followup\uniqn-mobile\node_modules"
# 2) 원본 기준선 (818개)
ls "C:/Users/user/Desktop/T-HOLDEM/uniqn-mobile/node_modules" | wc -l
# 3) 재귀 없이 링크만 끊기
MSYS_NO_PATHCONV=1 cmd.exe /c "rmdir C:\Users\user\Desktop\T-HOLDEM-ia-followup\uniqn-mobile\node_modules"
# 4) 부재 확인 + 원본 무손상 확인
test -e "C:/Users/user/Desktop/T-HOLDEM-ia-followup/uniqn-mobile/node_modules" && echo "🔴 남음" || echo "✅"
ls "C:/Users/user/Desktop/T-HOLDEM/uniqn-mobile/node_modules" | wc -l    # 818 이어야 함
# 5) 그 다음에만 워크트리 제거
cd C:/Users/user/Desktop/T-HOLDEM && git worktree remove C:/Users/user/Desktop/T-HOLDEM-ia-followup
git tag archive/employer-ia-followup-20260915 <머지 전 HEAD> && git push origin <태그>
```
🔥 `git worktree remove --force` 를 정션 해제 **전에** 쓰지 말 것. 09-14 에 원본
node_modules 가 818→0 이 됐다.

### 3-3. 🔴 로컬 master 정렬 (배포 전 필수)

메인 체크아웃의 `master` 가 **IA 웨이브 이전 상태**로 갈라져 있다.
```
로컬 master = b67ad14b7   (S4·S5 파일 없음, S2 가 지운 파일 살아있음)
origin/master = 3b34e4c4b
```
9개 커밋은 upstream 에 squash 로 들어간 것들이고, 아카이브 태그
`archive/local-master-prewave-20260915` 로 **이미 원격에 보존**돼 있다.

⚠️ `git reset --hard` 는 이 환경의 권한 설정이 **차단**한다(이전 세션에서 2회 거부됨).
사용자에게 아래를 직접 실행하도록 요청한다(`!` 접두사로 세션에서 실행 가능):
```
! cd C:/Users/user/Desktop/T-HOLDEM && git reset --hard origin/master
```
정렬 없이는 배포하지 말 것 — **낡은 트리로 웹 번들을 만들면 웨이브가 통째로 빠진다.**

### 3-4. prod 마이그레이션 (2개)

적용 대상: `20260915122335`(정산 알림 문구) · `20260915133500`(권한 하드닝).

- 경로는 **`prod-migrate` 워크플로우(#437)** — `--single-transaction` + `ON_ERROR_STOP=1`
  이라 두 마이그의 자기검증 `DO` 블록이 실패하면 **적용 자체가 롤백**된다.
- `20260915133500` 은 prod 에서 **no-op 이어야 한다**(이미 안전). 회수 건수 NOTICE 가
  0 이 아니면 그 자체가 조사 대상이다 — 그새 누가 anon 에 열었다는 뜻.
- 적용 후 실측 확인:
```sql
-- anon 실행 가능 public 함수 = 26 이어야 함
SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND p.prokind='f' AND has_function_privilege('anon', p.oid,'EXECUTE');
-- 알림 문구 교체 확인
SELECT position('정산 금액이 %s원으로 확정' in prosrc) > 0
FROM pg_proc WHERE proname='notify_on_work_log_update';
```
- `mcp__supabase__list_migrations` 로 기록 확인. ⚠️ **기록이 없어도 함수는 있을 수 있다** —
  `pg_proc` 실측을 병행한다.

### 3-5. OTA 발행

- 메인 체크아웃 `master` 에서, 워크트리 금지.
- 직전에 `git fetch` + ff-merge 로 최신화하고 `git rev-parse HEAD` 를 기록해 둔다.
- 🚨 `eas update` 는 **shell env 만 평가한다** — `.env` 파일을 읽지 않는다.
- 🚨 `app_config` 는 반드시 `{ios, android, web}` 객체.
- 🚨 **함대가 갈렸다** — 1.0.6 잔존 기기용 수정은 태그 `ota/1.0.6-production` 트리에서
  **따로 한 번 더** 발행해야 한다. 이번 건이 거기 해당하는지 판단할 것.
- 발행 후 group id 를 회수해 메모리 "라이브 값"에 기록한다.

### 3-6. 웹 배포

```bash
cd C:/Users/user/Desktop/T-HOLDEM/uniqn-mobile
node scripts/deploy-cloudflare.js --force --branch=master
```
- 🚨 **워크트리에서 배포하면 빈 번들**이 나간다(정션 탓에 expo-router 앱루트 실패).
  반드시 메인 체크아웃에서.
- 🚨 **detached HEAD 는 Preview 로 간다** — `--branch=master` 명시 필수.
- 배포 후 번들 검증 시 **거짓 음성 2종** 주의: 한글은 `\uXXXX` 로 이스케이프되고, CDN
  엣지 캐시가 옛 번들을 준다. **대조군을 동시 검사**(`grep -F`)할 것.
- 과거 **빈 번들이 21시간 배포된 사고**가 있다. 배포 후 실제 페이지를 열어 확인한다.

---

## 4. 검증 명령 (완료 주장 전 필수)

```bash
cd C:/Users/user/Desktop/T-HOLDEM-ia-followup/uniqn-mobile
npm run quality                 # 진짜 종료코드를 봐라: npm run quality > /tmp/q.log 2>&1; echo $?
npx tsc --noEmit
npm run db:reset && npm run test:db
npx jest src/services/notifications src/hooks/workSchedule src/components/employer/applicants
```

🔑 **파이프 끝의 exit code 를 진짜 결과로 착각하지 말 것.**
`npm run quality | tail -30` 의 종료코드는 `tail` 의 것이다. 이전 세션이 이걸로 한 번
"exit 0" 을 잘못 읽었다. 반드시 `> log 2>&1; echo $?` 로 받는다.

🔑 **"영향권 jest" 를 파일명 패턴으로 고르면 뚫린다.** 이전 세션이
`jest notificationMessageNormalizer` 로 초록을 봤지만 같은 문구를 단언하는
`notificationService.test.ts` 는 이름이 달라 매칭되지 않아 CI 에서야 빨개졌다.
**패턴 말고 디렉터리로** 돌린다.

🔑 pgTAP 실패를 볼 때는 **반드시 baseline 과 차분**한다. 내 변경 탓인지 기존 red 인지
추정하지 말 것. 방법: 대상 마이그를 잠시 빼고 `db:reset` + `test:db` 를 한 번 더 돌려
실패 집합을 비교한다(이전 세션이 이 방법으로 "신규 파손 0건"을 증명했다).

---

## 5. 사람 게이트 (코드로 못 닫음)

- **실기기 QA** — 기존 5건 + **신규**: 출근 직후 퇴근 시도 시 문구(§2-2 결함)
- PR 프리뷰 4건(탭바 여백 · 근무표 픽셀 비교 · 오늘 한 줄 숫자 일치 · 목업 대조)
- Supabase 콘솔 2건(Leaked Password Protection · Token refresh rate limit)
- 출퇴근 QR 지점당 1장 — **보류 결정, 건드리지 말 것**

---

## 6. 하지 말 것

- 기존 마이그레이션 파일 **수정 금지**(새 파일로만)
- `parity_baseline_guard` 기대값을 **근거 없이** 실측으로 덮기
- `posting_qr_attendance` 기대값을 `no_eligible_work_log` 로 바꿔 통과시키기
- 정션을 재귀 삭제(`rm -rf`)하거나 `worktree remove --force` 를 해제 전에 쓰기
- `master` 직접 push(E2E 우회) · rebase(squash 저장소)
- `npm install` 을 워크트리에서
