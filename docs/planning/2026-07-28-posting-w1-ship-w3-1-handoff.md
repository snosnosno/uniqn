# 공고 도메인 — W1 출하(마이그·PR·머지) → W3-1 착수 핸드오프 (2026-07-28)

> 앞 세션 산출물: W1 12항목 전량 구현 완료. 이 문서는 **출하 → 다음 웨이브** 인계용.

## 0. 작업 위치 — 이미 있다 (새로 만들지 말 것)

- 워크트리: `C:\Users\user\Desktop\T-HOLDEM\.claude\worktrees\posting-flow-audit`
- 브랜치: `feat/posting-flow-completeness`, **미push**, 작업트리 clean
- `origin/master`(`638ef4110`) 대비 **+16 커밋**. 자체 변경 149파일 / +6,613 −1,278 (master 병합분 제외)
- 마지막 커밋: `bad5feb3a` (리뷰 CRITICAL 수정)
- 로컬 Supabase Docker 스택(`supabase_db_uniqn`)이 떠 있으면 pgTAP 을 실제로 돌릴 수 있다.

## 1. 필독 (순서대로)

1. `docs/analysis/2026-07-27-posting-domain-audit.md` — §0(한계) → §3(메타패턴 8) → §4 의 **W2·W3**.
   §4 가 작업 지시서다. W3-1 은 :294.
2. `docs/planning/2026-07-27-posting-w1-continuation-handoff-2.md` — 앞 세션의 함정 목록. 여전히 유효하다.
3. `git log --oneline origin/master..HEAD` — 16커밋이 맞는지 **직접 세라**(§4 함정 참조).

## 2. 이번 세션의 순서 — 출하가 먼저다

```
Phase 0  prod 마이그레이션 3개 적용  →  PR  →  CI green  →  머지  →  워크트리 정리
Phase 1  W3-1 고정 공고 1급 시민화 — 설계 먼저(HARD-GATE), 새 브랜치
Phase 2  W2 10항목 — 한 세션에 끝나지 않는다(감사 추정 4~5주). 착수 순서만 정하고 시작.
```

**Phase 0 을 건너뛰고 W3-1 로 가지 말 것.** W3-1 은 `confirm_application`·정원 트리거·정산
경로 전반에 파급되는데, W1 의 RPC 3건이 prod 에 없으면 어느 쪽이 원인인지 분리할 수 없다.

---

## Phase 0 — 출하

### 0-1. prod 마이그레이션 3개 (🔴 사용자 승인 필수 · 순서 중요)

```
1. 20260727100000_fix_cancellation_request_camel_keys.sql   (W1-1, 오염 row 백필 포함)
2. 20260727150000_restore_original_assignments_on_cancel.sql (W1-5)
3. 20260727160000_qr_checkin_status_whitelist.sql            (W1-8)
```

- 🚨 **2번은 1번의 함수 정의를 이어받는다. 2번만 적용하면 1번의 백필 UPDATE 가 실행되지 않는다.**
- **적용 전 반드시 `mcp__supabase__list_migrations` 로 미적용 여부를 실측**하라. 앞 세션 이후
  다른 세션이 적용했을 수 있다. 메모리의 "미적용" 표기는 그때 기준이다.
- 1번 적용 전 오염 규모를 먼저 재라:
  `SELECT count(*) FROM applications WHERE cancellation_request ? 'reviewed_at'`
- 적용은 `mcp__supabase__apply_migration` **전용**. `db push` 금지. 기존 마이그레이션 파일 수정 금지.
- 적용 후 parity 확인: 함수 수가 **183 미만으로 줄면 안 된다**(감소 = 뭔가 지웠다는 뜻).
- 3번은 **동작을 바꾼다** — 구 빌드 사용자의 QR 스캔이 no_show/cancelled/completed 상태에서
  거부되기 시작한다(의도된 수정). 현장에서 "스캔이 안 된다" 문의가 늘 수 있음을 사용자에게 알릴 것.

### 0-2. 머지 직전 최신 master 재통합

```bash
git fetch origin
git log --oneline HEAD..origin/master     # 새 커밋이 있으면 merge (rebase 금지 — squash 저장소)
git merge origin/master
cd uniqn-mobile && npm run quality && npx jest --silent
```

**기준선: 562 스위트 / 6,124 테스트 / 0 실패.** 이보다 줄면 누가 테스트를 지운 것이니 원인을 찾아라.

### 0-3. PR (🔴 사용자 승인 필수)

- `git push -u origin feat/posting-flow-completeness`
- PR 본문은 **W1 12항목 + 리뷰 수정** 을 웨이브 단위로 요약. 커밋 메시지가 이미 상세하니
  `git log origin/master..HEAD` 를 근거로 쓰면 된다.
- **CI 전량 green 확인 후 머지.** master 에 branch protection 이 없어 CI 가 required 가 아니다 —
  사람이 직접 봐야 한다. E2E 포함.
- 머지 방식은 **squash**(저장소 관례).

### 0-4. 머지 후 정리

- 아카이브 태그: `git tag archive/2026-07-28/feat-posting-flow-completeness <머지전 SHA>`
- 원격 브랜치 삭제: `gh api -X DELETE repos/:owner/:repo/git/refs/heads/feat/posting-flow-completeness`
- 워크트리 정리 — ⚠️ `node_modules` 정션 해제 선행. `graphify-out` 삭제 금지.
- 메모리 동기화(`/memory-sync`) + wiki 졸업(`/ingest`) — W1 의 교훈 중 영속 가치가 있는 것:
  - `assertUpdated` 가 존재하는데 호출부 0곳이었다(메타패턴 3의 재현)
  - **timestamptz μs vs 클라 ms 절단** — 낙관적 잠금은 `.eq` 로 성립하지 않는다
  - 감사 문서의 file 경로가 틀릴 수 있다(CalendarPicker)

### 0-5. 배포 (🔴 별도 게이트)

실기기 QA → 웹/OTA 는 **사용자가 명시적으로 요청할 때만**. W1-8(QR 카메라 실물 경로)은
유닛으로 못 덮으니 실기기 확인이 필수다: 실패 후 즉시 재스캔 / 느린 네트워크에서 '확인 중...' 표시.

---

## Phase 1 — W3-1 고정(fixed) 공고를 1급 시민으로

> 감사 §4 :294. 결함 7건: EDIT-3 · ORDER-5(허브) · STAFF-10 · CANCEL-9 · QR-6 · APPL-12 · GRID-4

### 왜 최우선인가

홀덤펍 상시 단발 알바가 이 앱의 **1차 타깃**인데, 고정 공고는 확정 이후 운영 수단이 통째로
없다. 정산·스태프관리·취소요청·QR·확정해제가 전부 차단되고, 차단 지점 7곳이 실측으로
확인됐다. 지금은 "고정 공고로 사람을 뽑을 수는 있는데 그 뒤로 앱이 아무것도 못 한다".

### 근본 원인 (코드 주석에 이미 기록돼 있다)

`app/(employer)/my-postings/[id]/_layout.tsx:30-36` —
`confirm_application` 이 `FIXED_SCHEDULE` 마커 **1행만** INSERT 하고 그걸 되돌리는 코드가
없어 D+1 부터 영구 실패한다. **개별 화면을 여는 방식으로는 못 고친다 — 행 수명 모델 재설계다.**

### 설계 선행 (HARD-GATE — 코드 먼저 쓰지 말 것)

핵심 제약: **주 N회는 "어느 날인지"가 데이터에 없다.** `FixedScheduleInfo` 에 요일 정보 자체가
없다. 두 갈래 중 하나를 사용자와 함께 정해야 한다:

- (a) **요일 축을 스키마에 추가** — 고정 공고 작성 시 요일을 고르게 한다. 주문서 UI 변경 동반.
- (b) **사장이 근무표에서 배정** — 스키마 최소 변경, 대신 운영 부담이 사장에게 간다.

이 결정 없이는 work_log 생성 시점·주체·개수가 정해지지 않는다. `planner`(model: fable) 또는
`/autoplan` 으로 설계안을 먼저 받고 **사용자 승인 후** 착수하라.

### 구현 순서 (감사 처방)

1. `FIXED_SCHEDULE` 마커 대신 **실제 근무일별 work_log** 를 만드는 모델 확정
2. 전이·정리 RPC 정의 → 확정 해제·취소 경로 개방
3. 차단 지점 7곳을 **순차** 해제, 단계마다 pgTAP 게이트

W1/W2 범위에서는 허브에 "고정 공고는 확정 이후 운영 기능을 준비 중입니다" 안내 한 줄만
넣어 침묵을 없애는 것으로 갈음했었다 — 그 안내가 아직 없다면 W3-1 착수 전에 먼저 넣어라.

### 위험

가장 큰 구조 변경이다. `confirm_application`·정원 트리거·정산 경로 전반에 파급되고,
**기존 고정 공고 데이터의 마이그레이션 경로**가 필요하다. 잘못하면 dated 공고까지 회귀한다.

### 완료 증명

- `npm run test:db` 전량 PASS + **parity 함수 수 대조(183 기준, 감소 없어야 함)**
- 신규 pgTAP — 고정 공고에서 **확정 → 확정해제 → 재확정** 사이클이 **D+1 에도** 성공하는지
- `npx jest` 전량
- 수동: 고정 공고로 확정한 뒤 정산·스태프관리·QR **3화면이 ErrorState 없이 열리는지**

---

## Phase 2 — W2 10항목 (감사 추정 4~5주)

한 세션에 끝나지 않는다. W1 의 공용 자산(`useSubmitGate`·`assertUpdated`·Undo 토스트 패턴)을
전제로 하는 항목이 다수다.

| # | 항목 | 규모 |
|---|---|---|
| W2-1 | 주문서 임시저장(draft) 영속화 + 시트 dirty 가드 | L |
| W2-2 | Undo 토스트 공통화 — 파괴적 액션 전 구간 배선 (백로그 M9) | M |
| W2-3 | 일괄 작업 신뢰 계층 — 부분 실패 리포터 + 선택 모집단 정합 | L |
| W2-4 | 잠금·상태 설명 SSOT + 대안 경로 | L |
| W2-5 | 취소·거절 커뮤니케이션 완결 | L |
| W2-6 | 운영 허브를 실제 운영 화면으로 | L |
| W2-7 | 지원자 판단·처리 도구 | L |
| W2-8 | 근무표 신호 정확도 | L |
| W2-9 | 스태프측 신뢰 회복 | L |
| W2-10 | 정산 운영 완성도 | L |

**착수 권장 순서**: W2-2(M, 가장 싸고 W1 자산 그대로 확장) → W2-1(입력 유실 마지막 두 경로,
W1-12 와 같은 뿌리) → 나머지는 사용자 우선순위.

⚠️ **W2-1 착수 시 주의**: W1-12 에서 타입 전환 스태시를 `useRef`→폼 상태로 승격하는 건을
범위 초과로 **미이행**했다. 화면 이탈 시 스태시가 증발하는 문제가 그대로 남아 있고,
W2-1(draft 영속화)이 정확히 그 축이다 — 같이 처리하면 싸다.

---

## 3. 함정 (앞 세션에서 실제로 걸린 것)

- 🚨 **감사 결과를 그대로 믿지 마라.** 적대 검증 189건 중 반박 0건이라 "확정"은 유력 가설이다.
  앞 두 세션에서 REFUTED 는 적었지만 **처방이 틀린 건이 4건**이었다:
  ① `assertAffectedRows` 신설 불필요(동일 헬퍼가 이미 있었고 호출부 0곳)
  ② W1-5 신규 컬럼 불필요(`original_application` 이 이미 있었다)
  ③ **CalendarPicker 경로가 실재하지 않는다** — 완료 증명을 그대로 실행하면 다른 컴포넌트가
     green 을 내는 **거짓 증거**가 된다
  ④ `startTime` 시드 처방은 무음 유실을 무음 확정으로 바꿀 뿐
  → 항목 착수 전 **주장을 코드로 재확인**하고, 완료 증명 명령의 **경로가 실재하는지** 확인하라.
- 🚨 **`.eq('updated_at', …)` 류의 timestamptz 등호 비교는 성립하지 않는다.** DB 는 마이크로초,
  클라이언트는 `Date.toISOString()` 으로 밀리초 절단이다. 로컬 DB 실측으로 0행을 재현했다.
  시간 비교가 필요하면 **구간(`gte`/`lt`)** 을 쓰고, 회귀 테스트 baseline 은 **실 DB 포맷**
  (`...427647+00:00`)에서 계산하라 — `.000Z` 상수는 절단을 통과시켜 결함을 숨긴다.
- 🚨 **머지 전 `git log origin/master..HEAD` 로 커밋 수를 세라.** 내 브랜치 밑에 타 세션 커밋이
  깔려 있어도 `git status` 는 clean 이다(07-27 실제 사고: 9커밋 혼입).
- 🚨 **테스트 mock 이 결함을 숨긴다.** 앞 세션에서 3건: ① Modal mock 이 `visible` 을 무시해
  '실패 시 모달 유지'를 관측 불가(고치자 기존 2케이스가 모달을 연 적조차 없었음), ② addToast 가
  호출마다 새 `jest.fn` 이라 횟수 단언 불가, ③ update mock 이 `.eq` 1단이라 `const {error} = 객체`
  가 undefined 로 떨어져 **우연히** 통과 중이었다.
- 🚨 **`jest.setup.js` 가 `useQuery`/`useMutation` 을 전역 모의**한다(`isPending` 없이 `isLoading` 만).
  훅 테스트는 파일 단위로 재모의하는 것이 이 레포의 확립된 패턴이다.
- 🚨 pgTAP 은 로컬에서 실제로 돌릴 수 있다. 공유 스택을 더럽히지 않으려면 마이그레이션 +
  `CREATE EXTENSION IF NOT EXISTS pgtap` 을 테스트의 `BEGIN…ROLLBACK` 안에 주입해 한 파일로 합쳐라.
  `MSYS_NO_PATHCONV=1 docker cp <파일> supabase_db_uniqn:/tmp/x.sql` — **플래그 없으면 Git Bash 가
  경로를 Windows 로 바꿔 실패**한다. RED 는 수정 전 함수 정의를 대신 주입해서 만든다.
- 🚨 리포 루트 `supabase/` 를 grep 하면 조용히 0건. 마이그레이션은 `uniqn-mobile/supabase/migrations`.
- 🚨 Bash grep 이 `app/` 트리에서 조용히 0건을 낸다 — **Grep 도구 + tsc 교차검증**.
- 🚨 **기본값 제거가 최고의 검출 도구다.** W1-9 에서 `expectedUpdatedAt` 에 기본값을 두지 않아
  컴파일러가 호출부 전량을 잡아냈다. 인가·분기를 바꾸는 인자에 기본값을 두지 말 것.
- 🚨 **Fable 5 한도**에 걸리면 서브에이전트가 전멸한다(앞 세션 적대검증 3건 전멸). 폴백 사다리
  fable→opus→sonnet 로 재디스패치하고 보고에 다운그레이드를 명시하라.

## 4. 사용자 게이트 — 임의 진행 금지

- **prod 조회·마이그레이션 적용·push·PR·머지·배포는 전부 사용자 승인.** 로컬 커밋만 자율.
- W3-1 의 요일 축 설계 (a)/(b) 결정은 **사용자 결정 사항**이다. 임의로 고르지 말 것.
- 실기기 QA·웹/OTA 는 별도 게이트.

## 5. 작업 방식 (앞 세션에서 통한 것 — 그대로 쓰면 된다)

1. 항목 착수 전 **감사 주장을 코드로 재확인**. 라인이 어긋났으면 주변을 찾는다.
2. **TDD**: 실패 테스트 먼저 → RED 를 **실제 출력으로 확인** → 최소 구현 → GREEN.
   되돌리기 어려운 경우 `git stash push <파일>` 로 잠깐 되돌려 RED 를 찍고 복원했다.
3. 항목 1개 = 커밋 1개. 커밋 전 `cd uniqn-mobile && npm run quality` **exit 0** + 관련 jest green.
4. 마지막에 code-reviewer(`model: fable`, 한도 시 opus) → CRITICAL/HIGH 수정 → 재검증.
   ⚠️ 리뷰가 CRITICAL 을 올리면 **에이전트 보고를 그대로 믿지 말고 직접 실측**하라 —
   앞 세션에서 로컬 DB 로 재현해 확정했다.
