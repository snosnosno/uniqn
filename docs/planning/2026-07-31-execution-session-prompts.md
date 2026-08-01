# 실행 세션 프롬프트 원장 (2026-07-31)

> venue 근무표·내 스케줄 재설계 + 주소 검색 3단계를 **세션 단위로 이어서** 실행하기 위한 문서.
> 각 세션은 §0 공통 블록 + 해당 세션 블록을 **통째로 복사해 붙여넣는다.**
> 세션이 끝나면 §1 상태 보드를 갱신한다 — 이 문서가 세션 간 유일한 인수인계 수단이다.
>
> 원천 설계: [`2026-07-28-venue-schedule-redesign-handoff.md`](2026-07-28-venue-schedule-redesign-handoff.md) ·
> [`2026-07-31-address-search-3phase-design.md`](2026-07-31-address-search-3phase-design.md)

---

## 1. 상태 보드 (세션 종료 시 반드시 갱신)

| 세션 | 범위 | 브랜치 | 상태 | PR | 비고 |
|---|---|---|---|---|---|
| 0-1 | 병렬 워크트리 미커밋 정리 | `fix/sheet-drag-map-phone` | ✅ | #366 | `b2064c8c4`. `mapLink`·`InfoTab`·`ScheduleConverter` 점유 해제됨 |
| 0-2 | 알림 착지 브랜치 머지 | `fix/notification-landing-and-apply-success` | ✅ | #365 | `8fb10f5d2` |
| 0-3 | 핸드오프 문서 1-A 완료 반영 | — | ✅ | — | 2026-07-31 |
| ~~**0-4**~~ | Supabase 안전 정리 | — | ✅ | **#367** | 사용자는 "보류"로 결정했으나 **병렬 세션이 PR#367 로 머지**(`5aeab44b3`). 로컬 `chore/supabase-safe-cleanup-20260731` 브랜치는 이제 불필요 — 삭제 가능 |
| **S1** | 1-B + 1-C | ~~`feat/venue-profile`~~ | ✅ **머지** | **#370** | `dbf1e49d1`. CI 11잡 green(E2E 는 러너 포트 충돌로 1회 fail → 재실행 pass). 브랜치·워크트리 정리 완료 |
| **S2** | 2-A + 2-B | ~~`fix/worklog-time-model`~~ | ✅ **머지** | **#374** | `a06f5311`. CI 9잡 green(E2E 1회 통과). 브랜치·워크트리 정리 완료. 클라 전용·**마이그 0건**. master(#370·#371·#373) 재통합 완료 — 파리티 충돌은 master 판 **184** 채택 |
| **S3** | 2-C + 2-D + 별-2 | ~~`feat/worklog-time-notify`~~ | ✅ **머지** | **#382** | `11a2390a0`. CI 9잡 green(E2E 포함 1회 통과). 브랜치 삭제됨, 워크트리는 유지. | HEAD `fd8d7b52b`(5커밋). 🔴 **마이그 1건 prod 미적용** |
| **S4** | 3-B + 3-E + 별-1 | ~~`feat/qr-badge-and-entry`~~ | ✅ **머지** | **#384** | `40dc21779`. CI **9잡 전부 SUCCESS**(E2E 9m55s 포함, 재실행 없이 1회 통과). 브랜치·워크트리 정리 완료. **마이그 0건** — 파리티 **184/111 불변**(prod 실측 재확인). 리뷰 opus→fable 2회, HIGH 2건 포함 지적 전량 반영 |
| **S5** | 3-A + 3-D | ~~`feat/settlement-and-rename`~~ | ✅ **머지** | **#387** | `97bf7e85c`. CI **10잡 전부 SUCCESS**(E2E 10m14s 포함, 재실행 없이 1회 통과). 브랜치·워크트리 정리 완료. 마이그 2건은 **PR 이전에 prod 선적용**됨 — 재적용 금지. 상세=§5 |
| **S5-후속** | SETTLE-3 되돌리기 + 정산 게이트 status 축 | ~~`feat/settlement-revert-entry`~~ | ✅ **머지** | **#388** | `0ec9abc2c`. CI **9잡 전부 SUCCESS**(E2E 9m56s 포함, 재실행 없이 1회 통과. DB Tests 는 마이그 0건이라 미실행). 브랜치·워크트리 정리 완료. 마이그 **0건** — 파리티 **184/111 불변**(prod 실측). 상세=§5 |
| **A-감사** | A레인 전체 사후 감사 | ~~`docs/wave-audit-20260801`~~ | ✅ **머지** | **#390** | `16a5bb1fa`. 분석은 메인 체크아웃에서 **읽기 전용**, 문서 커밋만 워크트리 `T-HOLDEM-audit` 에서. 산출물=[`docs/analysis/2026-08-01-work-schedule-wave-audit.md`](../analysis/2026-08-01-work-schedule-wave-audit.md). **코드 변경 0건.** CRITICAL 0 / HIGH 1(선재) / MEDIUM 11 / LOW 12. 파리티 **184/111 prod 실측 일치**. 상세=§5 |
| **B1** | 주소 1단계 | `claude/job-posting-address-map-lbrvzd` | 🔨 **구현완료·리뷰반영 완료·PR 미생성** | | HEAD `ccd1cbe26`(4커밋). 마이그 **0건** — 파리티 184/111 불변. quality exit 0 · jest **599스위트 6573테스트 전량 통과** · knip 델타 0 · 브라우저 실관찰 통과(CSP 위반 0건, 리뷰 수정 후 재관찰까지). 리뷰 fable **APPROVE**(HIGH 0) / opus HIGH 3건 **전량 반영**. 🔴 **머지 전 P4(M9) 선행 필수**(단, B1 diff 자체는 M9 를 활성화하지 않음 — §5 참조) |
| **B2** | 주소 2단계 | `feat/posting-geocoding` | ⬜ | | 🔴 REST 키 재발급 선행 |
| **S6** | 3-C 설계 | — | ⬜ | | 사용자 결정 필요 |
| **S7** | 3-C 구현 | `feat/posting-time-change` | ⬜ | | S6 승인 후 |

### 워크트리 배정 (🔴 모든 세션 예외 없이 격리)

| 세션 | 워크트리 경로 | 상태 |
|---|---|---|
| 0-4 | — | ✅ 불필요(PR#367 로 머지됨) |
| S1 | ~~`T-HOLDEM-venue`~~ | ✅ 정리완료(정션 해제 → worktree remove 순서 준수) |
| S2 | ~~`T-HOLDEM-time`~~ | ✅ 정리완료(정션 해제 → worktree remove 순서 준수) |
| S3 | ~~`T-HOLDEM-notify`~~ | ✅ 정리완료(S4 착수 시 — 정션 해제 선행 → `worktree remove`, 원본 `node_modules` 821 무손상 확인) |
| S4 | ~~`T-HOLDEM-qr`~~ | ✅ 정리완료(정션 해제 → `worktree remove` → 브랜치 삭제, 원본 `node_modules` 821 무손상) |
| S5 | ~~`T-HOLDEM-settle`~~ | ✅ 정리완료(정션 해제 선행 → `worktree remove` → 브랜치 삭제. 원본 `node_modules` **818** 무손상 확인) |
| S5-후속 | ~~`T-HOLDEM-revert`~~ | ✅ 정리완료(정션 해제 선행 → `worktree remove` → 브랜치 삭제. 원본 `node_modules` **818** 무손상 확인) |
| B1·B2 | `T-HOLDEM-address` | 🔨 **유지 중**(B1 구현완료, PR 미생성). 정션은 PowerShell `New-Item -ItemType Junction` 으로 생성(818 확인). `.env.local`·`.env.development.local` 은 gitignore 라 메인에서 복사해야 앱이 뜬다 |
| A-감사 | ~~`T-HOLDEM-audit`~~ | ✅ **머지 완료(#390)** — 정리 대상(정션 없음. `worktree remove` → 브랜치 삭제) |
| S7 | `T-HOLDEM-timechange` | ⬜ |

전부 `C:/Users/user/Desktop/` 아래. 머지 완료 세션의 워크트리는 다음 세션 착수 시 정리한다
(⚠️ **정션 해제 선행** — `rmdir` 로 `node_modules` 정션을 먼저 끊지 않으면 원본이 지워질 수 있다).

**prod 파리티 추적**: **함수 183 / 정책 111** — 2026-07-31 S1 착수 시 재실측 확정.
0-4(`632adcbae`)는 EXECUTE 권한만 회수했으므로 함수·정책 **수는 불변**이었다(183/111 그대로).
prod 최신 마이그 = `20260730174826_cron_run_details_retention`.

⚠️ **다른 레인 미커밋 마이그 1건 발견** (2026-07-31): 워크트리 `T-HOLDEM-wt-board-body`
(`fix/schedule-board-body-array-literal`)에 미추적 파일
`20260731100000_fix_schedule_board_body_array_literal.sql` 이 있다. **prod 미적용**.
"마이그는 전 레인 동시 1건" 규칙 대상 — S1 마이그 적용 시 이 파일과 순서가 엇갈릴 수 있다.

| 세션 | 마이그 | 적용 후 함수/정책 |
|---|---|---|
| S1 | `20260731120000_venue_profile_rpcs` (RPC 2개 신설) | 레포 기대 **185 / 111** (PR#370 머지). ⚠️ 아래 경고 참조 |
| S3 (#382) | 알림 트리거 | **184 / 111 불변**. ✅ **prod 적용 완료(2026-08-01, S5 세션이 레인 정리 차원에서 적용)**. 적용 후 실측 184/111, `proconfig = public, extensions, pg_temp` 보존, PUBLIC/anon EXECUTE 0 확인 |
| S5 (#387) | `20260801100000_rename_default_venue_containers` | **184 / 111 불변** — 데이터 UPDATE 전용(DDL 없음). prod 적용 완료, 4행 rename, 충돌 0건. ⚠️ **prod 기록명은 `20260731195336_rename_default_venue_containers`** — 파일명으로 `list_migrations` 대조하면 못 찾는다 |
| S5-후속 | 없음 | **184 / 111 불변**(2026-08-01 prod 실측) |
| B2 | 컬럼 추가 | 불변 예상 |

> 🚨 **파리티 레포↔prod 불일치 (2026-07-31, S1 머지 직후)** — 레포 기대 **185**, prod 실측 **184**.
> 원인은 S1 이 아니다. 병렬 세션(`fix/notification-counter-guard`, `T-HOLDEM-noti`)이 함수 1개를
> 줄이는 마이그를 **PR 보다 먼저 prod 에 적용**해 놓았고 그 PR 이 아직 미머지다.
> 183(master) + 2(S1) − 1(알림 카운터) = **184** 가 prod 값이다.
> → **그 PR 이 머지될 때 `PARITY_EXPECT_FUNCS` 를 182 가 아니라 `184` 로 적어야 한다**(베이스가 185 로 바뀌었으므로).
> 그때까지 주간 `parity-smoke`(월 01:17 UTC)와 일간 `prod-health` 는 이 항목에서 red 일 수 있다.
>
> ✅ **해소됨 (2026-07-31, S2 세션 실측)** — 그 PR 은 **#371 로 머지됐다**(`605cc1bf4`). master 의 `PARITY_EXPECT_FUNCS` 는 이미 **184**, 정책 **111** 이고 단언 리터럴도 일치한다. S2(#374)는 마이그 0건이라 이 값을 건드리지 않는다 — **레포↔prod 불일치는 남아 있지 않다.**

---

## 2. 공통 블록 (모든 세션 프롬프트 앞에 붙인다)

```
## 팀 편성 (이 세션 고정)

| 역할 | 모델 | 에이전트 |
|---|---|---|
| 설계·계획·판정 | fable | planner / architect / Plan |
| 탐색·수집 | sonnet | Explore / general-purpose |
| 구현·작성 | opus | 메인 세션 · tdd-guide |
| 중간 리뷰 | opus | code-reviewer |
| **최종 리뷰** | **fable** | code-reviewer (PR 직전 1회) |

- 독립 작업 2개 이상이면 한 메시지에 병렬 디스패치. 팬아웃은 5개 단위 배치.
- 서브에이전트 보고의 "성공"은 그대로 믿지 말고 diff·테스트 실행으로 독립 검증.
- 디스패치 프롬프트에 금지사항 명시: mcp__supabase__* 직접 호출 금지 ·
  기존 마이그레이션 파일 수정 금지 · PROD 우회 금지.
- 한도(429) 시 폴백 사다리 fable→opus→sonnet, 보고에 다운그레이드 명시.

## 착수 전 필수 — 🔴 격리 워크트리 상시 규칙

**이 프로젝트의 모든 실행 세션은 예외 없이 전용 워크트리에서 진행한다.**
미커밋 변경이 없어도, 혼자 작업 중이어도 마찬가지다. 메인 체크아웃(`T-HOLDEM`)에서는
읽기·계획·문서만 하고 코드를 고치지 않는다.

1. `git fetch origin && git log --oneline origin/master -3` — 최신 master 확인
2. 전용 워크트리 생성 (§1 워크트리 배정 표에서 경로 확인):
   ```bash
   git worktree add C:/Users/user/Desktop/<워크트리명> -b <브랜치명> origin/master
   ```
   ```cmd
   mklink /J C:\Users\user\Desktop\<워크트리명>\uniqn-mobile\node_modules C:\Users\user\Desktop\T-HOLDEM\uniqn-mobile\node_modules
   ```
   ⚠️ MSYS 경로 변환 주의 — 실패하면 PowerShell `New-Item -ItemType Junction` 대안
   ⚠️ expo 실행 시 `EXPO_ROUTER_APP_ROOT` 절대경로 + `--clear` (정션이면 라우트 0건 함정)
   ⚠️ 워크트리 안 코드는 시스템 절대경로 하드코딩 금지 — `@/` alias 강제
3. `git status` — 내가 만들지 않은 미커밋 변경이 남아 있으면 그것부터 사용자에게 보고
4. `docs/planning/2026-07-31-execution-session-prompts.md` §1 상태 보드로 선행 세션 완료 확인
5. DB를 건드리는 세션이면 `mcp__supabase__list_migrations` 로 대기 마이그 0건 확인
   (마이그는 전 레인 통틀어 **동시 1건**만)
6. §1 워크트리 배정 표의 해당 행을 🔨(진행중)으로 갱신

## 프로젝트 규율 (위반 시 사고 이력 있음)

- 언어: 응답·커밋·문서·주석 전부 한글
- 마이그레이션 = Supabase MCP `apply_migration` 전용. `db push` 금지
- 마이그 재정의 베이스는 "가장 최근 정의":
  `grep -l "CREATE OR REPLACE FUNCTION <name>" supabase/migrations/*.sql | sort | tail -1`
- `e2e/` 는 `npm run quality` 범위 밖 — 상수·enum·문구를 바꿨으면 **별도 Grep 필수**
- `functions/` 는 ESLint·tsc·prettier가 전부 건너뛴다 (Jest만 잡음)
- 커밋 사전승인 O · **push/PR 은 사용자 명시 요청 시에만**
- 완료 주장 전 이 세션에서 실행한 증거 필수

## 실기기 QA 생략 결정 (2026-07-31 사용자 확정)

실기기 QA 게이트는 제외한다. 대신 **아래 3개로 대체하며, 이건 생략 불가**:
1. 금액·시간에 닿는 변경은 **Jest 회귀 테스트 red→green** 확인 (예상액 0원 사고 이력)
2. 묶음별 PR 유지 — 여러 묶음을 한 번에 배포하지 않는다
3. 웹 렌더가 걸린 변경(CSP·WebView)은 **브라우저 콘솔 직접 관찰**. 정적 검사 불충분

## 🔴 세션 종료 프로토콜 (미완료여도 반드시 실행 — 이어가기의 유일한 수단)

컨텍스트가 차거나 사용자가 중단하면, **끝나지 않았어도** 아래를 실행하고 끝낸다.
"다음에 이어서 하겠다"고 말만 하고 종료하지 말 것.

1. **작업 보존** — 미완이어도 커밋한다(커밋 사전승인 O). 커밋 못 할 상태면
   `git stash` 대신 `wip:` 커밋을 남긴다. **워크트리는 지우지 않는다.**
2. **종료 게이트 실행** → 출력을 읽고 결과를 보고 (통과/실패 모두 사실대로)
3. **§1 상태 보드 갱신** — 상태·PR 번호·파리티 카운트·워크트리 상태
4. **§5 인수인계 로그에 항목 추가** — 아래 형식 그대로:
   ```
   ### <세션ID> — <날짜> · 상태: 완료 | 중단(사유)
   - 워크트리/브랜치: <경로> / <브랜치> · HEAD <sha>
   - 끝난 것: (검증 증거와 함께)
   - 안 끝난 것: (다음 세션이 손댈 첫 파일:줄까지)
   - 막힌 지점: (있으면 증상·시도·실패 지점)
   - 다음 세션에 넘기는 주의: (이 세션에서 새로 알아낸 것만)
   ```
5. **새로 드러난 함정은 메모리에 기록** — 이 문서에는 한 줄 포인터만
6. 마지막 줄에 **다음 세션이 붙여넣을 프롬프트**를 출력한다
   (§3 의 다음 세션 블록 + 4번에서 적은 이어가기 지점)
```

---

## 3. 세션별 프롬프트

### S1 — 지점 프로필 (1-B + 1-C)

```
[§2 공통 블록 붙여넣기]

UNIQN 근무표 재설계 세션 1이다.
docs/planning/2026-07-28-venue-schedule-redesign-handoff.md 를 먼저 읽어라.
"이미 확인된 사실"은 file:line 까지 검증됐다 — 재조사 금지.

범위: 1-B + 1-C. 브랜치 feat/venue-profile.

1-B — DB
- `update_venue_container(p_container_id, p_name, p_location, p_contact_phone, p_description, p_defaults)`
- `get_my_venue_contexts(p_ids uuid[])`
- 둘 다 SECDEF + search_path + anon REVOKE + authenticated GRANT + is_workspace_member 게이트
- 🔴 unique 인덱스 23505 → `INVALID_INPUT: 같은 이름의 지점이 이미 있습니다` 로 변환
- 권한 술어는 20260728185802 와 동일 (soft cancel 필터, .claude/rules/supabase-patterns.md §11)
- ⚠️ `get_my_venue_role_salaries` 를 확장하지 말 것 (CROSS JOIN LATERAL → 빈 배열이면 0행, §C)
- pgTAP 작성 + 파리티 카운트 기록 (183/111 → 185 예상)

1-C — 클라 배선
- scheduleService.ts:160,647 → createScheduleContainerContext 에 title/location/phone 전달
- ScheduleConverter.ts:64 시그니처 확장
  ⚠️ 0-1 세션이 SchedulePostingContext 에 `locationAddress` 를 이미 추가했다.
     그 위에 얹을 것 — 같은 인터페이스다.
- venueContainer.ts: VenueContainer + VENUE_CONTAINER_COLUMNS 갱신
- VenueSettingsSheet.tsx: 단가표 전용 → 지점 설정 전체
- useEnsureDefaultVenue.ts: 워크스페이스명 복사 중단 → `{닉네임}의 지점`
- 기본명 SSOT 통합: useEnsureDefaultWorkspace.ts:20 + workspaceService.ts:91 + workspace/index.tsx:125

금지
- '내 팀' 일괄 rename 마이그는 S5(3-D) 몫 — 여기서 하지 말 것
- 지점 설정에 **기본 근무시간 넣지 말 것** (결정 4 · §J)
- 지점 "주소" 입력 필드를 자유 텍스트로 만들지 말 것 — 주소검색 컴포넌트(B1)가 머지된 뒤 얹는다.
  이번엔 **장소명·연락처만** 받는다.
- 1-C 를 쪼개지 말 것 — 입력만 배포하면 안 보이고 표시만 배포하면 볼 게 없다

종료 게이트
1. npm run quality   2. npm test   3. pgTAP + 파리티 카운트 기록
4. code-reviewer(opus) → 수정 → **최종 code-reviewer(fable) 1회**
```

---

### S2 — 시간 모델 (2-A + 2-B)

```
[§2 공통 블록 붙여넣기]

UNIQN 근무표 재설계 세션 2다.
docs/planning/2026-07-28-venue-schedule-redesign-handoff.md §K + §J 를 먼저 읽어라.
§J 의 "시작+종료 둘 다 입력" 지침은 폐기됐고 §K 가 정본이다.

범위: 2-A + 2-B. 브랜치 fix/worklog-time-model.
선행: S1 머지 완료 상태여야 한다 (scheduleService.ts 의미 접점).

2-A — 시간 저장 규약 (🔴 반드시 단일 PR)
- time_slot = **출근 예정 시각 단일값** 'HH:mm' 또는 미기록(=미정)
- composeTimeSlot 의 슬롯 쓰기 소비를 끊는다.
  parseTimeSlotParts 는 **기존 범위 데이터 읽기 하위호환으로 유지**
- EditSlotSheet: 종료 입력 제거 → 출근 예정 단일 칸 + 실제 출퇴근 섹션
- AddSlotSheet: 프리필 제거(빈 값 시작). 출근시간 하나만 받는 현행 구조는 **정본이므로 유지**
- 저장 게이트: 시간 선택 or '미정' 명시 체크 전까지 저장 비활성
- AddStaffModal.tsx:69 자유 텍스트 → 피커 전환 (addSlotPayload.ts:9 규약)
- ⚠️ DEFAULT_SLOT_START_TIME 상수 자체는 지우지 말 것 —
  utils/order-sheet/mappers.ts:505 가 다른 맥락에서 소비한다
- 🔴 **"계산 전" 표시를 같은 PR에** — 직접 배치는 예상 금액 미표시, 공고 근무는 예상액 유지.
  종료 제거만 배포하면 calculateSettlementBreakdown 이 duration 을 못 내
  "정산 예정(추정)"이 **조용히 0원**이 된다. 동일 사고 이력 있음.
- 🔴 대체 검증: 예상액 회귀 테스트를 **red→green 으로 확인**하고 출력을 보고할 것

2-B — 근무 수정 창 통합 (근무표 경로만)
- EditSlotSheet / VenueDayPanel / ConfirmedStaffCard
- ⚠️ EditSlotSheet(예정) 과 WorkTimeEditor(실제)는 중복이 아니다 — §D 표 확인.
  WorkTimeEditor 사용처 3곳은 건드리지 말 것

종료 게이트
1. npm run quality   2. npm test (예상액 회귀 포함)   3. e2e/ Grep (시간 문구 변경분)
4. 구 빌드 하위호환 확인 — parseTimeSlotToDate 가 end 없으면 duration '-'
5. code-reviewer(opus) → **최종 code-reviewer(fable)**
```

---

### S3 — 알림·표시 (2-C + 2-D + 별-2)

```
[§2 공통 블록 붙여넣기]

UNIQN 근무표 재설계 세션 3이다. 브랜치 feat/worklog-time-notify.
선행: S2 머지 완료 (같은 EditSlotSheet.tsx 를 만진다).

2-C — 출근 예정 변경 알림 배선
- 🔴 알림이 거꾸로다: 트리거 notify_on_work_log_update Case 2 는
  modification_history 배열 길이 증가로만 발화하는데,
  updateSlot(WorkLogRepositoryVenue.ts:112)은 이력을 안 써서 무음이다
- time_slot 쓰기 경로는 updateSlot 단 하나 — 여기에 이력 기록을 붙인다
- 사용자 결정 1: 변경 시 **즉시 알림 + 이전값 병기**, 구직자 **취소 요청 경로 필수**.
  무음 변경 절대 금지
- 트리거 변경 시 `node scripts/graph-db-deps.mjs triggers` (레포 루트)

2-D — 구직자 카드 출근시간 3상태
- ScheduleCard / NextShiftCard / WorkTimeDisplay / InfoTab
- '미정'은 명시 선택으로만 도달 → "출근 시간 미정 · 정해지면 알려드려요"

별-2 — 색상 팔레트
- slotEdit.ts:55 SLOT_COLOR_CHIPS 15종 → 구분되는 4개 기준으로 재구성
- ⚠️ 토큰 제거 시 기존 저장값이 slotColorSwatchClassName 에서 null → **색이 조용히 사라진다.**
  하위호환 필수
- ⚠️ 시맨틱색을 배치색으로 쓰지 말 것 (상태 배지와 충돌)

종료 게이트
1. npm run quality   2. npm test   3. 파리티 카운트 기록 (트리거 변경분)
4. code-reviewer(opus) → **최종 code-reviewer(fable)**
```

---

### S4 — 저위험 묶음 (3-B + 3-E + 별-1)

```
[§2 공통 블록 붙여넣기]

UNIQN 근무표 재설계 세션 4다. 브랜치 feat/qr-badge-and-entry.
선행: S1(3-E), S3(별-1 은 독립이나 ScheduleCard 접점) 머지 완료.

3-B — QR 표시 보강 + 퇴근 미기록 배지 + 리마인더 정리
- QR 기록 vs 수동 수정 구분 표시 (`19:04 ✓QR`)
- 근무표에 "퇴근 미기록 N건" 배지 — 🔴 자동 퇴근을 만들지 않기로 했으므로
  **이 배지가 유일한 안전망**이다. 빼먹지 말 것
- shiftReminderPlan.ts:17 HOURS_BEFORE_START 제거, DAY_BEFORE_HOUR=20 은 **현행 유지**
  ⚠️ "정확히 24시간 전"으로 바꾸지 말 것 — 새벽 2시 근무면 전날 새벽 2시에 발송된다
- 퇴근 리마인드는 만들지 않는다 (스태프 독촉 금지)

3-E — 진입점 정리 (팀↔근무표)
- VenueSettingsSheet.tsx · employer.tsx:123

별-1 — 대시보드 접기 + 필터 이동
- app/(app)/(tabs)/schedule.tsx
- 🔴 statusFilter 의 `unpaid` 축은 **미지급 근무를 찾는 유일한 경로** — 삭제 금지,
  접힌 대시보드 안으로 이동
- 소비 3곳(리스트·캘린더 dot·선택일 카드) 전부 갱신. 줄번호는 이동했으니 grep 으로 재확인
- ⚠️ e2e/ 필터 셀렉터 별도 Grep

종료 게이트
1. npm run quality   2. npm test   3. e2e/ Grep
4. code-reviewer(opus) → **최종 code-reviewer(fable)**
```

---

### S5 — 되돌리기 어려운 것 (3-A + 3-D) 🔴 착수 전 사용자 승인

```
[§2 공통 블록 붙여넣기]

✅ **착수 승인 완료 (2026-08-01)** — ①3-A 지급완료 알림 ②3-D rename, 둘 다 사용자가 승인했다.
🔴 그러나 **3-D 의 UPDATE 는 여전히 멈춰서 보고한다.** 승인은 '착수' 에 대한 것이지
   '카운트를 안 보여주고 실행' 에 대한 것이 아니다. 아래 순서 ①→②를 건너뛰지 말 것.
   (3-A 의 지급완료 알림은 **회수 불가** — 발송 경로를 붙이되 테스트 발송 금지)

UNIQN 근무표 재설계 세션 5다. 브랜치 feat/settlement-and-rename.
선행: S1(1-C) 머지 완료 — 이름이 바뀐 사용자가 즉시 고칠 화면이 먼저 있어야 한다.

3-A — 정산 2단 축소 + 지점 정산 확정 배선 + 지급 알림
- venue-settlements.tsx 는 **읽기 전용이 의도된 상태**였다(half-wired 회피).
  useSettleWorkLog 를 재사용해 배선한다
- payrollStatus 참조는 소스 36파일 110곳 — **전면 제거 금지, UI 어휘만 2단 축소**
- 죽은 상태 2종 정리: 'processing'(DB enum 에 없는 UI 전용값, GroupedSettlementCard.tsx:251) ·
  'failed'(scheduleService.ts:326)
- 사용자 결정 2: 지급완료 알림 O, **일괄 체크는 묶어서 1통**, **체크 취소 시 알림 없음**

3-D — '내 팀' 일괄 rename 마이그
- 🔴 순서: ① 사전 카운트 실측 → ② 사용자 보고·승인 → ③ 충돌 검사 → ④ UPDATE
- 사용자 결정 3: **미변경 기본값만** 대상(사용자가 지은 이름 불가침),
  unique 충돌 사전 카운트, 대상자에게 **1회 인앱 안내**
- workspaces 와 job_postings(container) **양쪽** 대상.
  지점은 unique 인덱스(workspace_id, lower(title), schedule->>'kind') 때문에 더 위험

종료 게이트
1. npm run quality   2. npm test   3. pgTAP + 파리티 카운트 기록
4. security-reviewer(fable) — 알림 발신 경로
5. code-reviewer(opus) → **최종 code-reviewer(fable)**
```

---

### B1 — 주소 검색 1단계 (독립 워크트리, A레인과 동시 가능)

```
[§2 공통 블록 붙여넣기]

docs/planning/2026-07-31-address-search-3phase-design.md 를 읽고 **1단계**를 구현해라.
"이미 확인된 사실"은 file:line 까지 검증됐다 — 재조사 금지.
§3 "원안 대비 정정" 5건을 반드시 먼저 읽어라.

브랜치: claude/job-posting-address-map-lbrvzd
워크트리: 별도 생성 (A레인과 파일이 겹치지 않으므로 동시 진행 가능)
  git worktree add C:/Users/user/Desktop/T-HOLDEM-address -b claude/job-posting-address-map-lbrvzd master
  mklink /J ...\T-HOLDEM-address\uniqn-mobile\node_modules ...\T-HOLDEM\uniqn-mobile\node_modules
  ⚠️ expo 실행 시 EXPO_ROUTER_APP_ROOT 절대경로 + --clear (정션이면 라우트 0건 함정)

1단계는 외부 키가 전혀 필요 없고 DB 마이그레이션도 없다.
2·3단계는 이번 범위가 아니다.

핵심
- district = roadAddress · region = `${sido} ${sigungu}` slug · detailedAddress = 층/호 신규 UI
- region 폴백 4단 — ④ 실패 시 mode:'region' 수동 선택으로. **조용히 넘어가지 말 것**(제출 필수 게이트)
- findRegionByAddress(regions.ts:707) 재사용 — 새 매핑 유틸을 만들면 4번째 구현체다
- 🔴 중첩 RN Modal 금지 → `mode: 'postcode'` 인라인 렌더 (PlaceSheet.tsx:4-8, iOS 터치먹통 이력)
- CSP: script-src += https://t1.daumcdn.net · frame-src += https://postcode.map.kakao.com
  ⚠️ iframe 오리진은 daum.net 이 아니라 **postcode.map.kakao.com**

🔴 종료 게이트 — 브라우저 렌더 관찰은 대체 불가
1. npm run quality   2. npm test (sido+sigungu 조합 유닛 테스트 신규)
3. e2e/ Grep   4. **웹 브라우저에서 실제로 우편번호 검색이 뜨는지 + 콘솔 CSP 위반 0건 확인**
   (CSP 위반은 에러 없이 빈 화면이라 정적 검사로 안 잡힌다)
5. code-reviewer(opus) → **최종 code-reviewer(fable)**
```

---

### B2 — 주소 2단계 (좌표) 🔴 REST 키 재발급 선행

```
[§2 공통 블록 붙여넣기]

🔴 착수 조건: 카카오 REST API 키 **재발급 완료 + Supabase EF 시크릿 KAKAO_REST_API_KEY 등록**.
   미완이면 이 세션을 시작하지 말 것.

docs/planning/2026-07-31-address-search-3phase-design.md §5 2단계를 구현해라.
브랜치 feat/posting-geocoding. 선행: B1 머지.

핵심
- 지오코딩은 **쓰기 시점 1회**, Edge Function 에서. 읽기 경로에 키가 안 붙는다
- 🔴 좌표를 location jsonb 에 넣지 말 것 — 구버전 앱에서 **공고가 통째로 사라진다**(§2-A)
- 새 컬럼(geo_lat/geo_lng)은 **3곳에 동시 등록**:
  ① TABLE_COLUMNS (JobPostingRepositoryHelpers.ts:18-19)
  ② ALLOWED_CAMEL_COLUMNS (위에서 자동 파생)
  ③ jobPostingDocumentSchema (jobPosting.schema.ts:464-508)
  한 곳만 빠져도 read 증발 또는 assertCanonical throw (#194 클래스)
- 🔴 REST 키에 EXPO_PUBLIC_ 접두사 금지
- ⚠️ eas update 는 shell env 만 평가 — app.config fallback + 명시 export
- mapLink.ts 좌표 승격: link/search/{주소} → link/to/{이름},{lat},{lng}
  ⚠️ 0-1 세션이 resolveMapQuery/looksLikeAddress 를 추가했다 — 그 위에 얹을 것
- 지오코딩 실패 시 NULL 허용 → 기존 텍스트 폴백 (fail-open 금지)

종료 게이트
1. npm run quality   2. npm test   3. 컬럼 3곳 등록 확인 (read 왕복 테스트)
4. 파리티 카운트 기록 (컬럼만 추가이므로 불변 예상)
5. security-reviewer(fable) — 키 노출 경로   6. **최종 code-reviewer(fable)**
```

---

### S6 — 3-C 설계 세션 (구현 금지)

```
[§2 공통 블록 붙여넣기]

3-C(공고 시간 전체/개인 2축 변경) **설계만** 하는 세션이다. 코드 작성 금지.
설계 판정은 model:"fable" 서브에이전트에 위임하라.

미결 질문 — 사용자 결정이 필요하다
1. "확정 전원의 시간 일괄 변경"은 단순 UPDATE 가 아닐 수 있다.
   이미 그 시간에 맞춰 다른 일정을 잡은 스태프가 있으면 **거절/재확인 흐름**이 필요한가?
2. 거절이 나오면 그 자리는 어떻게 되나 — 자동 취소? 구인자 수동 처리?
3. 개인 시간 변경과 전체 변경이 충돌하면(개인이 이미 조정됨) 어느 쪽이 이기나?

산출물: 설계 문서 1개 (docs/planning/) + S7 프롬프트를 이 문서 §3 에 추가
```

---

### S7 — 3-C 구현

```
[§2 공통 블록 붙여넣기]

S6 설계 문서를 읽고 3-C 를 구현한다. 브랜치 feat/posting-time-change.
(S6 종료 시 이 블록을 구체화할 것 — 설계 전에는 상세를 쓸 수 없다)
```

---

## 4. 레인 간 규칙 (세션이 바뀌어도 유지)

1. **마이그레이션은 전 레인 통틀어 동시 1건.** S1·S3·S5·B2 가 전부 DB를 건드린다.
2. **A레인이 머지될 때마다 B 워크트리는 즉시 재베이스** (`git fetch && git merge origin/master`).
3. **한 파일은 한 레인만.** 충돌 핫스팟:
   `ScheduleConverter.ts`·`InfoTab.tsx`·`types/schedule.ts` (0-1 · S1 · S3) ·
   `EditSlotSheet.tsx` (S2 · S3) · `scheduleService.ts` (S1 · S2 · S5) ·
   `ScheduleCard.tsx` (S2 · S3 · S4) · `mapLink.ts` (0-1 · B2)
4. **누적 배포 금지** — 실기기 QA를 뺀 대가로 묶음별 PR·배포를 유지한다.
5. 새로 드러난 함정은 **이 문서가 아니라 메모리**에 기록하고, 이 문서에는 한 줄 포인터만 남긴다.
6. **워크트리는 머지 확인 후에만 정리한다.** 정리 순서: 정션 해제(`rmdir node_modules`) →
   `git worktree remove` → 브랜치 삭제. 순서를 바꾸면 원본 `node_modules` 가 지워질 수 있다.

---

## 5. 인수인계 로그 (세션 종료 시 append — 최신이 위)

> 형식은 §2 세션 종료 프로토콜 4번 참조. **삭제하지 말고 쌓는다** —
> 중단된 세션을 다시 여는 사람이 읽을 유일한 기록이다.

### A-감사 (A레인 전체 사후 감사) — 2026-08-01 · 상태: 완료

- 워크트리/브랜치: 분석은 메인 체크아웃 `T-HOLDEM` / `master` `0d4d99309` 에서 **읽기 전용**으로 수행(**소스 코드 변경 0건**). 아래 '막힌 지점'의 세션 충돌 때문에 문서 커밋만 `C:/Users/user/Desktop/T-HOLDEM-audit` / `docs/wave-audit-20260801` 에서 했다(커밋 1건). → **PR #390 머지 완료** (`16a5bb1fa`). 정리 순서는 §4-6 준수.
- **산출물**: [`docs/analysis/2026-08-01-work-schedule-wave-audit.md`](../analysis/2026-08-01-work-schedule-wave-audit.md)
- **DB 마이그레이션 0건.** 파리티 **prod 실측 184 / 111** = 레포 기대값(`parity_baseline_guard.test.sql:91-92`) 일치.

- **끝난 것** (전부 이 세션의 도구 출력 기준)
  - 감사 축 **A~G 7축 전부** 수행(탐색 sonnet 7 → 적대적 검증 fable 6, 13 에이전트 0 실패) + 메인 세션 prod 실측 독립 재검증.
  - 판정 **CRITICAL 0 / HIGH 1 / MEDIUM 11 / LOW 12**. HIGH 1건은 이 웨이브 산물이 아니라 **선재**(#356).
  - 🔑 **핵심 발견 — 판정 복제 누락 2건 추가.** 둘 다 #388 이 `isSettlableWorkLogStatus` SSOT 를 세우며 소비처를 빠뜨린 것: ①`settlementGrouping.ts:251-253` 집계에 `status` 축 누락 ②`GroupedSettlementCard.tsx:258` 그룹 체크박스가 '전체 행수' 축으로 남아 **혼합 그룹에서 해제 불가**(신규 회귀).
  - 게이트: `npm test` **598 스위트 / 6534 테스트 / 122 스냅샷 전량 통과 exit 0**(기준값 정확 일치) · 파리티 prod 재실측 184/111 · 마이그 4건 **스네이크 본명 대조 완료** · `e2e/` 별도 Grep **파급 0건** · `npm run quality` **해당 없음**(코드 변경 0건).
  - 최종 검증: 산출물을 code-reviewer(fable)에 근거 검증 디스패치 → **수정 후 APPROVE, 기각 0건**. 인용 정정 3건 반영(상세=산출물 §9).

- **안 끝난 것**
  - 🔴 **결함 수선 0건** — 감사가 범위였다. 후속 PR 6묶음(P1~P6)은 산출물 §7.
  - 🔴 **E축 red-green 실증 미수행**(읽기 전용이라 소스를 되돌릴 수 없었다). 최우선 후보 3건은 산출물 §5.
  - 🔴 **M4 익스플로잇 미실행** — prod 무단 쓰기 회피. 정책·권한·트리거 실측 근거 판정.
  - ✅ **PR #390 머지 완료**(`16a5bb1fa`) — 워크트리 `T-HOLDEM-audit` 는 정리 대상(정션 없음 → `worktree remove` → 브랜치 삭제).
  - jest "worker process failed to exit gracefully" 원인 스위트 미특정(exit 0·전량 통과 확인까지만).

- **막힌 지점**: 🚨 **세션 충돌 — 메인 체크아웃 git 상태가 다른 세션 소유다.** B1 세션이 메인 체크아웃 `master` 에서 원장을 커밋(`6e7a98384`, 13:18)하면서 **내 미커밋 편집을 함께 삼켰고**, 이후 `reset` 으로 master 가 `0d4d99309` 로 되돌아가 그 커밋이 dangling 이 됐다(내 편집도 작업 트리에서 소실 → 재적용함). 추가로 **7/20 자 stale cherry-pick 상태**가 남아 있다(`.git/sequencer/` Jul 20, `CHERRY_PICK_HEAD` 빈 파일) — 내 것이 아니라 손대지 않았다.
  - 🔴 **B1 세션이 확인할 것**: dangling 커밋 `6e7a98384` 에는 **B1 의 원장 갱신분(주소 검색 1단계 인수인계 로그)이 들어 있고 현재 어느 브랜치에도 없다.** reflog 에서만 접근 가능하니 필요하면 `git show 6e7a98384` 로 회수할 것. 이 감사 세션은 그 커밋에서 **내 몫만** 재적용했고 B1 몫은 건드리지 않았다.
  - 해결 방식: 메인 체크아웃에서 브랜치를 만들면 HEAD 가 움직여 B1 을 방해하므로, **전용 워크트리 `T-HOLDEM-audit`** 를 파서 거기서만 커밋했다. 메인 체크아웃은 발견 당시 상태(`0d4d99309` 클린)로 되돌려 놓았다.

- **다음 세션에 넘기는 주의** (이 세션에서 새로 알아낸 것만)
  - ⚠️ ~~**B1 머지 전에 M9 를 먼저 넣어라.**~~ → **B1 세션 실측으로 정정됨**(아래 B1 항목 주의 4번): B1 은 공고 `location` 만 건드리고 지점 컨테이너 `location` 의 유일한 writer 는 `VenueSettingsSheet` 뿐이라 **B1 diff 는 M9 를 활성화하지 않는다**. M9 는 선재 결함이며 지점 시트에 주소를 넣는 순간 활성화된다. 원문: `VenueSettingsSheet.tsx:108` 이 `location: { name }` 으로 **전체 교체**하고 서버 RPC 도 `'{}'` 에서 재구성해 교체한다(`20260731120000...sql:147-174,212`) → B1 이 `district`/`detailedAddress` 를 추가하는 순간 저장 버튼이 주소를 **소거**한다.
  - 🚨 **"막는 계층이 없다" ≠ "새로 할 수 있는 일이 있다".** 선재 MEDIUM(`wl_update` WITH CHECK 부재)을 가설 3개로 쪼개 2개를 기각했다(`fn_work_logs_pin_posting_id` 가 `job_posting_id` 고정, `protect_work_log_payroll_columns` 가 payroll 고정). 남은 `staff_id` 도 "위조 알림"은 증분이 아니다 — **`add_direct_staff` 가 `authenticated` 에 GRANT + 동의 검사 없음**(prod 실측). 진짜 증분은 *출근·정산 완료 기록의 무음 삭제* 하나. **권한 결함은 차분으로 판정할 것.**
  - 🚨 **알림 계약을 세우는 마이그가 그 계약을 스스로 어길 수 있다.** `20260731140000...sql:163-168` 이 *"버튼이 실제로 있을 때만 말한다"* 를 주석으로 못박고도 조건을 클라(`ScheduleDetailModal.tsx:536-539`)의 **진부분집합**으로 잡아 `cancellation_pending` 을 놓쳤다. **트리거 조건은 클라 게이트와 집합 연산으로 대조할 것.**
  - 🔑 **`settleWorkLogWithTransaction` 은 DB RPC 가 아니다** — prod 에 `%settle%` 함수 **0개**. 클라 TS 메서드이고 정산은 원시 `.update()` 로 나간다(CLAUDE.md '정산=RPC 필수' 위반, LOW 기록). 문서·주석 여러 곳이 이걸 "서버 게이트"라 부른다.
  - 🔑 **`e2e/` 시드와 prod 분포가 어긋나 있다** — prod `work_logs` 3행 중 **2행이 레거시 범위 `time_slot`**, **2행이 `application_id` NULL** 인데 e2e 시드는 전부 단일값·정상.
  - 🔑 **잔여 목록은 줄지 않는 경향이 있다** — F축 재판정 16건 중 **2건이 이미 해소**돼 있었다(`handle_new_user` 는 `{이름} 팀` 이 맞고 S1 기재가 stale · 레거시 색상 15종은 정확히 구현). 주기적 재판정이 값어치가 있다.
  - ⚠️ **`proconfig` 하드닝은 실제로는 안 터졌다** — 재정의 4함수 전부 `pg_temp` 보존(prod 실측). 가장 크게 걱정한 함정이 무사했다는 사실도 기록해 둔다.
  - 🔴 **메인 체크아웃에서 커밋하지 말 것** — 이 세션이 실증했듯 두 세션이 같은 트리를 쓰면 한쪽의 미커밋 편집이 다른 쪽 커밋에 조용히 삼켜진다. 문서만 고치는 세션도 예외가 아니다.

### B1 (주소 검색 1단계) — 2026-08-01 · 상태: **구현 완료 · PR 미생성**(push/PR 은 사용자 명시 요청 대기)

- 워크트리/브랜치: `C:/Users/user/Desktop/T-HOLDEM-address` / `claude/job-posting-address-map-lbrvzd` · HEAD `41da9114d`(1커밋, master `0d4d99309` 기준)
- **마이그 0건** — 파리티 **184/111 불변**(DB 미접촉)

**끝난 것** (검증 증거와 함께)
- 우편번호 검색 전환: `PlaceSheet` 에 `mode:'postcode'` 인라인 추가(중첩 RN Modal 금지 준수), 주소 TextInput → 검색 버튼, 상세주소(층/호) 입력 신설, region 4단 폴백
- 신규 `src/utils/address/postcodeAddress.ts`(zod 경계 검증 + region 해석) · `src/components/address/PostcodeSearch{,.web}.tsx`
- CSP: `script-src += t1.daumcdn.net` · `frame-src += postcode.map.kakao.com`
- **같이 고친 결함**(이번 변경이 만들어낼 것): `resolveMapQuery` 가 `detailedAddress` 최우선이라 '3층 301호'가 지도 검색어가 되는 문제 → `composeFullAddress` SSOT 로 교체(red→green 확인). `InfoTab` 주소 줄 동반 수정. `orderSheet.schema` district 50→200.
- 검증: `npm run quality` **exit 0**(lint 0 errors) · jest **599 스위트 / 6573 테스트 전량 통과** · e2e 축 확인(PlaceSheet testID 0건, 주소 표시·길찾기 단언 0건) · knip **델타 0**(master 2223 / 브랜치 2223 실측 대조, 래칫 red 는 master 부터 선재)
- **브라우저 실관찰**(정적 검사 대체 불가 게이트): ①프로덕션 CSP 를 실제 헤더로 붙인 페이지에서 위젯 정상 렌더 + 콘솔 위반 **0건** ②실제 앱(주문서→장소→주소 검색)에서 검색·선택·지역 자동선택·상세주소 노출 확인. 리뷰 수정 후 **재관찰까지 완료**
- **리뷰 2회**(opus 중간 → fable 최종). fable = **APPROVE**(CRITICAL 0 / HIGH 0), opus = REQUEST CHANGES(HIGH 3). **HIGH 3건 전부 반영**(`ccd1cbe26`):
  ① `text-status-error` 는 이 레포에 없는 토큰이라 실패 안내가 다크모드에서 사실상 투명했다 → `error-600/dark:error-400`
  ② 네이티브 WebView 가 SheetModal 의 ScrollView 안이라 Android 가 제스처를 가져간다(`nestedScrollEnabled` 기본 false) → prop 추가
  ③ 이 기능의 린치핀인 `district` 동시 쓰기에 회귀 가드 0건 → PlaceSheet 컴포넌트 테스트 4건 신설, **red-green 확인**(`district: address` 제거 시 정확히 2건 red)
  MEDIUM 도 반영: 상세주소 렌더 조건 `address || detailedAddress`(주소를 지우면 상세주소가 숨겨진 채 제출되던 경로) · 브릿지 파싱 실패 `onError` · `originWhitelist` 축소 + `domStorageEnabled` · 네이티브 HTML 이 위젯 옵션을 리터럴 재선언하던 드리프트 제거

**안 끝난 것**
- 🔴 **PR 미생성** — push/PR 은 사용자 명시 요청 시에만(원장 §2 규율). 워크트리·브랜치 유지 중
- 🔴 **네이티브 WebView 실기기 미검증** — 실기기 QA 제외 결정이라 이 경로는 검증 수단이 0이다. 브릿지 파싱만 유닛 테스트로 고정했고 WebView 렌더·가상키보드·iframe 입력은 미검증
- knip 래칫 미확인(종료 게이트 밖)

**막힌 지점**: 없음

**다음 세션에 넘기는 주의** (이 세션에서 새로 알아낸 것만)
1. 🚨 **설계 문서 §2-H 가 틀렸다** — `react-native-webview` 를 `src/` 에서 직접 import 하는 코드는 **0건**이었다(PortOne RN SDK 가 내부적으로 쓸 뿐). 이번이 레포 최초 직접 사용이고, **jest 목이 없어 order-sheet 계열 10개 스위트가 통째로 실행조차 안 됐다**(실패 테스트 1개인데 실패 스위트 11개면 이 신호). `jest.setup.js` 에 목 추가로 해결.
2. 🚨 **CSP 검증은 dev 서버로 불가** — `_headers` 는 Cloudflare Pages 파일이라 `expo start --web` 에 적용되지 않는다. 또 위젯 iframe **스킴이 페이지 프로토콜을 따라간다**(`postcode.v2.js`: `w = "http:" !== CONT.PROTOCOL`) → http 로컬 프로브는 `frame-src https://...` 에 걸린다. playwright 는 self-signed 인증서를 거부하므로 https 프로브 불가.
3. 🚨 **`district` 는 시군구가 아니라 주소다.** `district ?? address` 붕괴가 **4곳 전부 district 우선**이라, 편집 화면에서 `address` 만 갱신하면 stale district 가 이겨 새 주소가 조용히 사라진다.
4. 🔑 **M9 는 B1 diff 가 활성화하지 않는다**(실측 정정) — B1 은 공고 location 만 건드리고, 지점 컨테이너 location 의 **유일한 writer** 는 `VenueSettingsSheet` 뿐이다(`update_venue_container` 호출부 전수 확인). 감사 문서는 B1 이 지점 시트에도 주소를 넣는다고 가정했으나 1단계 범위가 아니다. M9 는 선재 결함이며 **지점 시트에 주소를 넣는 순간** 활성화된다.
5. ⚠️ **`update_venue_profile` RPC 는 district 100자 서버 게이트**(`20260731120000_venue_profile_rpcs.sql:168-170`) — 클라 200 / 지점서버 100 / 공고 무제한 **3원 불일치**. B2 나 지점 주소 확장 시 서버가 거부한다.
6. 🔑 **지역 택소노미는 2026-07 개편이 이미 반영돼 있다**(설계 문서 §8 미확인 항목의 답) — 인천 신설 4구·화성시 4구 전부 존재. 위험은 반대 방향(위젯이 개편 전 구명을 줄 때)이라 ②단계 폴백이 그걸 받는다.
7. 🔑 **위젯 실응답은 39개 키** — 우리가 쓰는 건 5개뿐이라 zod `.strict()` 금지. `sido` 축약형(`경기`)·`sigungu` 2단계 문자열(`성남시 분당구`)을 **관찰로** 확정해 픽스처에 고정했다.
8. 🔑 새 워크트리는 `.env.local`·`.env.development.local`(gitignore)을 메인에서 복사해야 앱이 뜬다 — 없으면 "환경변수 검증 실패"로 부팅 실패.
9. 🔑 **`composeFullAddress` 의 포함 검사는 완전 토큰이어야 한다** — 단순 `includes` 면 `'강남구청길 5'` 가 `'강남구'` 를 품은 것으로 판정돼 **시·구가 조용히 사라진다**. 역방향 포함, 그리고 "주소 칸이 주소 꼴이 아니면 앞에 붙이지 않는다"(레거시 자유텍스트 별칭 방어)까지 세 갈래가 필요하다.
10. ⚠️ **`fullLabel`(`core.ts:44`)은 이 PR 이 건드리지 않았다** — 구직자 화면 `근무지` 행은 `name [+detailedAddress] · regionLabel` 이고 **도로명주소는 원래부터 안 보인다**(확정 스태프의 `InfoTab` 에서만 보인다). B1 이 뺏은 게 아니라 선재 경계다. 지원 전 주소 공개 여부는 **제품 결정**이라 범위 밖으로 남겼다 — 바꾸려면 사용자 확인 먼저.
11. 🔑 **리뷰 에이전트가 0바이트로 멈출 수 있다** — opus 리뷰가 13분간 출력 0바이트인 채 살아 있었다(형제 fable 은 211KB 작성 중). 출력 파일 크기·mtime 으로 생사를 판별해 재디스패치했고, 원래 것도 결국 18분 만에 완주했다(둘 다 유효). 판정이 갈리면 **양쪽 근거를 직접 실측해 채택**할 것 — 이번에도 `composeFullAddress` 반례에서 두 리뷰가 정면 충돌했고 opus 가 맞았다.

---
### S5-후속 (SETTLE-3 + 정산 게이트 status 축) — 2026-08-01 · 상태: 완료 (**PR #388 머지** `0ec9abc2c`)

- 워크트리/브랜치: ~~`C:/Users/user/Desktop/T-HOLDEM-revert`~~ / ~~`feat/settlement-revert-entry`~~ · 머지 전 HEAD `d707fb6fc`(커밋 5개, base `97bf7e85c`) → **머지 `0ec9abc2c`**. 브랜치·워크트리 **정리 완료**
- **DB 마이그레이션 0건.** 파리티 **prod 실측 184 / 111** = 레포 기대값 일치(세션 시작·종료 두 번 측정, 동일).
- 착수 시 정리: **S5 를 PR #387 로 착지**(사용자 결정). CI **10잡 전부 SUCCESS**(E2E 10m14s 포함, 재실행 없이 1회 통과) → 스쿼시 머지 `97bf7e85c`. 워크트리 `T-HOLDEM-settle` 제거(정션 해제 선행, 원본 `node_modules` 818 무손상), 브랜치 삭제.

- **끝난 것** (전부 이 세션에서 실행한 출력 기준)
  - **SETTLE-3 지급 완료 취소 진입점** `741f9cf00` — `venue-settlements.tsx` 에 `useUpdateSettlementStatus` + `SettlementRevertModal` 배선. 상세 모달에 `onRevertSettlement` 를 넘겨 취소 버튼이 렌더된다. 전환 대기는 `SHEET_DISMISS_ANIMATION_MS` SSOT. 실패 시 모달 유지(성공에서만 닫음).
  - **정산 게이트 status 축** `e01011032` → `564614f9d` → `00d900693` — 서버(`settleWorkLogWithTransaction`, `status ∈ {checked_out, completed}`)와 UI 축을 맞춰 "누르면 항상 실패하는 버튼" 을 제거. 술어 `isSettlableWorkLogStatus` 를 `@/shared/status` 에 SSOT 로 신설하고 **정산 어포던스 4곳 전부**를 통과시켰다.
  - **차단 사유 노출** — 개별 카드는 안내 배너, 그룹 행은 배지 `'출퇴근 미확정'`(+ accessibilityLabel 동일 값 합성).
  - 게이트: `npm run quality` **exit 0**(0 errors / 97 warnings = S4·S5 baseline 동일) · `npm test` **598 스위트 / 6534 테스트 / 122 스냅샷 전량 통과 exit 0** · `e2e/` 별도 Grep **파급 0건**.
  - 리뷰: code-reviewer(opus) CRITICAL 0 / HIGH 0 / MEDIUM 3 / LOW 5 → **MEDIUM 3 + LOW 2 반영** · 최종 code-reviewer(fable) **APPROVE**(MEDIUM 1 = 선재 결함 잔존) → **그 MEDIUM 도 마저 반영**.

- **안 끝난 것**
  - ~~push / PR~~ → ✅ **PR #388 머지**(`0ec9abc2c`).
  - 🔴 **되돌리기 경로 실사용 검증 없음.** prod 에서 눌러보지 않았다. 유닛·타입·레포 진입점·화면 진입점까지만 검증됨.
  - ⚠️ **`GroupedSettlementCard` 는 렌더 레벨 테스트가 여전히 0건**(선재 갭). 배지·라벨은 `statusText` 한 값에서 합성해 원리적으로 갈라질 수 없게 해 뒀지만, 그 행 자체를 렌더하는 테스트는 없다.
  - ⚠️ 정산 라벨 맵은 아직 **4곳**에 흩어져 있다(S5 에서 이월된 항목, 색/variant 통합은 시각 확인 필요).
  - 비차단: `handleOpenRevert` 의 `workLog as SettlementWorkLog` 캐스트(`onRevertSettlement` 제네릭화가 더 정직하나 소비 필드가 id/staffName/payrollAmount 뿐이라 실해 없음).
  - 비차단: 되돌리기 사실이 **스태프에게 통지되지 않는다**(트리거가 `completed` 전이에서만 발화 — 코드는 의도대로 동작). 금전 상태 역행이므로 제품 결정으로 명시해 둘 값어치가 있다.

- **막힌 지점**: 없음.

- **다음 세션에 넘기는 주의** (이 세션에서 새로 알아낸 것만)
  - 🚨 **`SettlementCard` 는 공유 컴포넌트가 아니다.** 원장 S5 백로그와 내 첫 커밋 메시지가 둘 다 "공고 정산 화면 동시 영향" 이라고 적었는데 **사실이 아니었다** — `SettlementCard` 의 렌더 소비처는 `venue-settlements.tsx` **단 1곳**이고, 공고 정산 화면(`SettlementList`)이 쓰는 것은 이름만 닮은 **별개 컴포넌트 `GroupedSettlementCard`** 다. 그 전제대로 한 곳만 고치면 "고쳤다고 적힌 채 공고 화면엔 결함이 그대로" 가 된다. **이름이 닮았다는 이유로 공유를 가정하지 말고 렌더 소비처를 grep 할 것.**
  - 🔑 **같은 판정이 4곳에 복제돼 있었다** — 개별 카드 버튼 · 그룹 행 버튼 · 그룹 일괄 집계 · 리스트 선택 모집합. 넷 중 **서버 축을 보는 곳이 0곳**이었고, 그룹 카드는 자기 파일 안에서 `getSettlableWorkLogIds` 와 인라인 복제본을 **동시에** 갖고 있었다(복제본에만 축이 빠짐). 판정을 고칠 땐 술어를 SSOT 로 세우고 **소비처를 전수로 세어 볼 것**.
  - 🔑 **필수 필드로 추가하면 tsc 가 누락 생성 지점을 전수로 잡아 준다.** `DateSettlementStatus.isSettlableStatus` 를 optional 로 뒀다면 기존 픽스처 5곳이 조용히 `undefined` 가 돼 게이트가 전부 닫히는(=정산 불가) 반대 방향 사고가 났을 것이다. 필수로 두니 tsc exit 2 로 5곳을 정확히 지목했다.
  - 🚨 **RN `Pressable` 함정 재확인** — 배지를 그려도 명시 `accessibilityLabel` 이 자식 텍스트를 덮으므로 스크린리더엔 아무것도 안 간다. 이번엔 배지 문구와 라벨을 **한 값(`statusText`)에서 합성**해 구조적으로 못 갈라지게 했다. 문구를 두 번 쓰면 다음에 또 갈라진다.
  - 🔑 **컨테이너 되돌리기는 확정과 같은 소유권 검증 경로**(`validateWorkLogOwnership` → `toJobPosting`)를 탄다. 즉 S5 가 봉합한 컨테이너 증발 결함이 살아 있었다면 확정뿐 아니라 취소도 함께 죽어 **완전한 편도 문**이 됐을 것이다. 레포 진입점 테스트는 `parseJobPostingDocument` 를 **항상 null 로 목**한 채 통과해야 증거가 된다(비컨테이너 행으로 `/파싱/` 거부를 단언해 그 목이 load-bearing 임을 반증해 둠).
  - 🔑 **`e2e/` 는 문자열 grep 만으로 판정하지 말 것.** 이번 변경은 문구가 아니라 **게이트 축**을 바꿨으므로, 시드 데이터의 `status` 축을 봐야 파급을 안다. 실측: `employer-settlement.spec.ts:134`·`work-log.factory.ts:28` 이 미정산 행을 `checked_out` 으로 심는다 → 새 게이트를 그대로 통과, 파급 0건.
  - 🔑 **pre-push 훅이 `npm run quality` 전체를 돈다** — push 가 2분 넘게 "멈춘 것처럼" 보인다. 죽은 게 아니니 타임아웃 늘리거나 백그라운드로 돌릴 것.
  - ⚠️ **전체 jest 에서 "A worker process has failed to exit gracefully" 경고가 뜬다**(exit 0, 598/598 통과). 신규 테스트 3파일을 개별 실행했을 땐 안 뜬다 — 이 브랜치가 만든 것이 아니라 기존 스위트발이다. 원인 스위트는 미특정.

### S5 (3-A + 3-D) — 2026-08-01 · 상태: 완료 (**PR #387 머지** `97bf7e85c`)

- 리뷰 3종 전부 통과: security-reviewer(fable) **CRITICAL 0 / HIGH 0**(MEDIUM 1 은 선재 — RLS `wl_update` WITH CHECK 부재로 `staff_id` 재지정 알림 위조 가능, 별도 PR 권고) · code-reviewer(opus) CRITICAL 1·HIGH 1·MEDIUM 3·LOW 2 **전량 반영** · 최종 code-reviewer(fable) **APPROVE**(LOW 3 비차단).
- 최종 게이트 실행 증거: `npm run quality` exit 0(0 errors / 97 warnings = S4 baseline) · `npm test` **595 스위트 / 6503 테스트 / 122 스냅샷 전량 통과** · `tsc --noEmit` exit 0 · `e2e/` Grep 파급 0건.

- 워크트리/브랜치: `C:/Users/user/Desktop/T-HOLDEM-settle` / `feat/settlement-and-rename` · 커밋 4개
- ⚠️ **prod 기록명 ≠ 레포 파일명이다.** `mcp__supabase__apply_migration` 이 적용 시각으로 자체 버전을 매기기 때문에, 레포 `20260801100000_rename_default_venue_containers.sql` 은 prod 에 `20260731195336_rename_default_venue_containers` 로, 레포 `20260731140000_notify_on_time_slot_change.sql` 은 `20260731195045_notify_on_time_slot_change` 로 기록돼 있다. **`list_migrations` 로 "재적용 금지" 를 대조할 때 파일명으로 찾으면 못 찾는다 — 이름 뒷부분(스네이크 케이스 본명)으로 대조할 것.**
- **DB 마이그레이션 2건 prod 적용.** 파리티 **184 / 111 불변**(적용 전·후 실측 동일, 레포 기대값 `parity_baseline_guard.test.sql:91-92` 와 일치)
  - `20260731195045_notify_on_time_slot_change` — **S3(#382)가 남긴 미적용분**. 레인을 막고 있어 사용자 승인 후 먼저 적용했다. 적용 후 신규 `time_slot` 분기 존재·`settlement_completed` 보존·`proconfig = public, extensions, pg_temp` 보존·PUBLIC/anon EXECUTE 0 전부 실측 확인.
  - `20260731195336_rename_default_venue_containers` — 이번 세션 신규(데이터 UPDATE 전용, DDL 없음).

- **끝난 것**
  - **3-D 지점 기본명 소급 rename** `9e5389880` — 게이트 순서 준수(①사전 카운트 실측 → ②사용자 보고·승인 → ③충돌 검사 → ④UPDATE). prod 4행 rename, unique 충돌 **0건**, 발송 알림 **0건**(적용 후 실측). `'기본 지점'→'로즈의 지점'` / `'기본 지점'→'정태규의 지점'` / `'내 팀'→'스노의 지점'` / `'ㅇ 팀'→'ㅋ의 지점'`.
  - **3-A 정산 UI 어휘 2단 축소** `92ee16dee` — `PayrollStatus` 에서 `'processing'` 제거, `SettlementDisplayStatus`(2값)+`toSettlementDisplayStatus()` 신설, 표시 맵 4종을 2키로 축소, 인덱싱 7곳에 fold 적용.
  - **3-A 지점 정산 확정 배선** `453db187e` — `venue-settlements.tsx` 에 개별+일괄 정산. 배선 전에 컨테이너 단가표 canonical 불일치를 먼저 봉합(아래 주의 참조).
  - 게이트: `npm run quality` **exit 0**(0 errors / 97 warnings = S4 baseline 동일) · `tsc --noEmit` exit 0 · `e2e/` 별도 Grep **파급 0건**(e2e 는 이미 `'pending'|'completed'` 2값만 씀).

  - **리뷰 반영** `90006d3e5` — opus 리뷰가 잡은 **CRITICAL 1건**(아래 주의 참조) + MEDIUM 3 + LOW 2. 레포 진입점 테스트 신설로 HIGH(vacuous green) 도 해소.

- **안 끝난 것**
  - ~~push / PR~~ → ✅ **PR #387 머지**(`97bf7e85c`). CI 10잡 전부 SUCCESS(E2E 10m14s 포함, 재실행 없이 1회 통과).
  - 🔴 **정산 확정 경로 실사용 검증 없음.** prod 에서 한 번도 눌러보지 않았다(확정은 스태프에게 회수 불가 알림이 나가므로 테스트 발송 금지 지시를 지켰다). 유닛·타입·레포 진입점까지만 검증됨.
  - 🔴 **지점 정산에 "지급 완료 취소"(SETTLE-3) 진입점이 없다 — 편도 문.** `SettlementDetailModal` 에 `onRevertSettlement` 를 안 넘겨 되돌리기 버튼이 안 뜬다. 컨테이너 직속 행은 공고 정산 화면에 아예 나오지 않으므로 **오지급 정정 경로가 앱 전체에 존재하지 않는다.** 확정 문구는 비가역성을 고지하는데 정정 수단이 없어 반쪽이다. 이번엔 세션 후반 신규 기능 추가(사유 입력 포함)를 QA 없이 얹는 위험이 더 크다고 판단해 남긴다 — **다음 세션 최우선.**
  - ⚠️ **rename 마이그의 fail-closed 가드가 후보 간(intra-batch) 충돌을 못 본다.** 한 워크스페이스에 컨테이너 2건(`'내 팀'`+`'기본 지점'`)이 있으면 목표명이 **같아지는데**, 가드의 `EXISTS` 는 "이미 존재하는" title 만 보므로 서로를 못 본다 → `uniq_venue_container` raw 위반으로 마이그 전체 abort. **prod 는 4행·충돌 0으로 이미 통과했고 파일은 적용된 내용의 기록이므로 수정하지 않았다**(기존 마이그 수정 금지). `db:reset`·새 환경에서 재생 시 터질 수 있다 — 그때는 `ROW_NUMBER() OVER (PARTITION BY workspace_id, lower(new_title), kind)` 로 후보 간 중복을 먼저 걸러야 한다.
  - ⚠️ 마이그 UPDATE 가 `job_postings_updated_at` 을 발화시켰다 → **"대상 행은 rename UI 도입 이전에 마지막 수정" 이라는 판별 근거는 이 마이그 실행 후로는 더 이상 성립하지 않는다.** 재실행·재판정 시 다른 근거가 필요하다.
  - 라벨 맵이 아직 **4곳**에 흩어져 있다(라벨 문자열만 SSOT 로 모았고 색/variant 는 화면별로 달라 통합 보류 — 합치면 배지 음영이 바뀌어 시각 확인이 필요하다).
  - 비차단: 개별 "지급 완료" 버튼이 `isSettling` 중 얼리 리턴으로 **무피드백 무시**된다(`SettlementCard` 에 `disabled` prop 부재).
  - 비차단(최종 fable 리뷰 LOW): **개별 카드 버튼은 `status` 축을 안 본다.** 일괄 바는 `status ∈ {checked_out, completed}` 를 보는데 `SettlementCard.tsx:192` 게이트는 `pending && hasValidTimes` 뿐이라, 시각은 있고 status 미승격인 레거시 행에서 개별 버튼만 "누르면 항상 실패" 로 남는다. 선재 공유 컴포넌트 게이트라 공고 정산 화면에 동시 영향 — **별도 커밋 권장**(`canSettle` prop 개방 또는 게이트에 status 축 추가).
  - 비차단(최종 fable 리뷰 LOW): `'failed'` 행은 배지가 '정산 대기' 로 접히는데 필터·버튼 게이트는 raw `pending` 비교라 제외된다 → "대기 배지인데 필터에서 사라지고 버튼도 없는" 행이 된다. **현재 `'failed'` writer 가 UI 에 0곳이라 발화 불가.** `'failed'` 전이 경로를 만들 때 필터·게이트도 `toSettlementDisplayStatus` 축으로 통일할 것.

- **막힌 지점**: 없음.

- **다음 세션에 넘기는 주의** (이 세션에서 새로 알아낸 것만)
  - 🚨 **세션 프롬프트의 전제 2건이 실측으로 뒤집혔다.**
    ① "지급완료 알림 발송 경로를 붙여라" → **이미 있다.** prod 트리거 `notify_on_work_log_update` Case 3 가 `payroll_status → 'completed'` 전이에서 행마다 1통 INSERT 한다. 클라에 발송 코드를 넣으면 중복이 된다. 그래서 "일괄 체크 1통" 은 클라가 아니라 **트리거** 작업이었고, 사용자가 "행당 1통 유지" 로 결정해 트리거는 건드리지 않았다.
    ② "`handle_new_user` 트리거가 `{닉네임} 워크스페이스` 를 만든다" → **stale.** 최신 정의(`20260719233000_team_terminology_unification.sql:30`)는 `{이름|이메일로컬|'내'} 팀` 을 만들고 같은 마이그가 `' 워크스페이스$' → ' 팀'` 소급 UPDATE 까지 끝냈다(prod 에 `~워크스페이스` 0건). 고칠 결함이 없어 **트리거는 그대로 두고 주석만 정정**했다(사용자 결정).
  - 🚨🚨 **컨테이너 공고는 `parseJobPostingDocument` 를 통과하지 못한다 — 정산 경로 전체가 여기서 죽었다.** 컨테이너 `schedule` 은 `{kind, softTargets, roleSalaries}` 인데 dated 분기가 `.strict()` + `primaryDate/allDates/requirements` 필수라 `"Unrecognized key: softTargets"` 로 거부된다(prod 행 전체를 파서에 넣어 재현, 결과 null). 증발하면 개별 경로는 '공고 데이터를 파싱할 수 없습니다', 일괄 경로는 `jobPostingMap` 미등록으로 '권한이 없는 공고입니다'(**소유자인데도**)가 된다. 레포는 이 계약을 이미 문서화하고 있었다 — `JobPostingRepository.venue.test.ts:1-6`. 🔑 **교훈: 컨테이너를 일반 공고 경로에 태우는 코드는 타입도 tsc 도 안 잡는다. 런타임에만 죽고, 그것도 "권한 없음" 이라는 엉뚱한 메시지로 죽는다.** 새 기능이 컨테이너를 만지면 반드시 레포 진입점까지 태우는 테스트를 쓸 것.
  - 🚨 **순수 헬퍼만 검증하는 테스트는 이런 결함을 못 잡는다.** 첫 시도의 회귀 테스트 3건은 `as unknown as JobPosting` 캐스트로 픽스처를 만들어 zod 게이트를 건너뛰었고, **CRITICAL 이 살아 있는 상태에서도 green** 이었다. 지금은 `parseJobPostingDocument` 를 항상 null 로 목한 레포 진입점 테스트가 있다 — 성공 자체가 우회 증거가 되도록.
  - 🚨 **`getPostingSettlementContext` 를 컨테이너에 쓰면 안 된다.** 그 함수는 `schedule.requirements[]` 를 훑는데 컨테이너엔 requirements 가 없어 **roles 가 빈 배열**이 된다 → 지점 역할별 단가표가 통째로 무시되고 폴백(시급 15,000원)으로 계산된다. 그리고 이 canonical 값은 **호출자가 넘긴 amount 를 덮어쓴다**. 즉 배선만 했으면 화면 20,000원 / 지급 기록 15,000원이 됐을 것이다. 읽기·쓰기 공용 헬퍼 `domains/settlement/venueSettlementContext.ts` 로 봉합했고 회귀 테스트 3건을 걸어 뒀다.
  - 🔑 **컨테이너 `title` UPDATE 는 알림을 깨울 수 있다.** `notify_on_job_posting_update` 가 `OLD.title IS DISTINCT FROM NEW.title` 로 `job_updated` 를 보낸다. 다만 수신자가 `applications` 행이고 컨테이너엔 지원 행이 붙지 않아 이번엔 0건이었다. **일반 공고 title 을 건드리는 마이그는 이 경로를 반드시 먼저 세어 볼 것.**
  - 🔑 `'failed'` 는 UI 어휘에선 `'정산 대기'` 로 접히지만 **금액 집계에서는 접으면 안 된다**(`scheduleService`) — 지급 무산 건을 "받을 예정" 으로 세면 오지 않을 돈을 약속하게 된다.
  - 🔑 `settlement.byVenue` 는 `settlement.all` 접두라 기존 `invalidateRelated('settlement.process')` 가 지점 화면까지 그대로 덮는다(`queryClient.ts:376`). 별도 무효화 배선 불요.

### S4 (3-B + 3-E + 별-1) — 2026-07-31 · 상태: 완료 (**PR #384 머지** `40dc21779`)

- 워크트리/브랜치: ~~`C:/Users/user/Desktop/T-HOLDEM-qr`~~ / ~~`feat/qr-badge-and-entry`~~ · 머지 전 HEAD `4ec631230`(커밋 8개) → **머지 `40dc21779`**. 브랜치·워크트리 **정리 완료**
- **DB 마이그레이션 0건.** 파리티 **prod 실측 184 / 111** = 레포 기대값(`parity_baseline_guard.test.sql:91-92`) 일치.
- 착수 시 정리: 머지 완료된 S3 워크트리 `T-HOLDEM-notify` 제거(정션 해제 선행, 원본 `node_modules` 821 무손상 확인).
- **끝난 것** (전부 이 세션에서 실행한 출력 기준)
  - **3-B QR 출처 표시** `da1a735c4` — 실측이 원안을 두 군데 고쳤다. ①`✓QR` 은 **퇴근에만** 붙는다(출근축엔 출처 컬럼이 스키마에 없다). ②레거시 행은 QR 퇴근을 수동 수정해도 `'qr'` 로 남아 있어, `modification_history` 의 해당 축 수정 이력을 먼저 보고 근거 없으면 아무것도 주장하지 않는다. 수동 경로 3곳이 이제 `end_time_source`·`edited_by` 를 남긴다.
  - **3-B 리마인더** `da1a735c4` — `hours-before` 제거, `DAY_BEFORE_HOUR=20` 현행 유지(근거를 상수 주석에 못박음).
  - **3-B 퇴근 미기록 배너** `113fe0863` + `92f3e5ef2` — 지점 스팬 리더 기반, 지난 날짜만, 누르면 가장 오래된 미기록 날짜로 이동.
  - **3-E 진입점** `2a54183e9` — 팀 화면에 근무표 진입 행 신설(기존 링크 **0개**였다). `VenueSelector` ⚙ a11y 라벨을 "단가 설정"→"설정" 로 정정(S1 이 시트를 확장했는데 라벨이 안 따라왔다).
  - **별-1 대시보드 접기** `f587a8eba` — 요약+필터를 한 덩어리로 접고 MMKV 에 영속. 접어도 활성 필터·미지급 건수는 계속 보인다(칩 제거 시 red 로 실증). 부수로 `schedule.tsx` 1412→1203줄, `ScheduleDashboard` 분리.
  - **리뷰 반영** `92f3e5ef2` — opus 리뷰 HIGH 1 + MEDIUM 6 + LOW 2 반영(아래 '주의' 참조).
  - **최종 리뷰 반영** `6dd836b74` — fable 리뷰가 잡은 HIGH 1건. 앞 커밋에서 얼리 리턴을 없앤 것이 새 결함을 만들었다(로딩·에러 구간의 빈 배열로 유효 예약 전체 취소). 게이트 축을 "비었나"→"로드가 끝났나" 로 바꾸고 `shouldSyncShiftReminders` 순수 함수로 분리. fable 판정: 이 1건 외 **CRITICAL 0 / 나머지 비차단**.
  - 최종 게이트: `npm run quality` **exit 0**(0 errors / 97 warnings = baseline) · `npm test` **593 스위트 / 6496 테스트 / 122 스냅샷 전량 통과 exit 0** · `e2e/` 별도 Grep **파급 0건** · knip **델타 0**(master 1249/911 == 브랜치, 동일 명령 실측).
- **안 끝난 것**
  - ~~push / PR~~ → ✅ **PR #384 머지**(`40dc21779`). CI 9잡 전부 SUCCESS, 재실행 없이 1회 통과.
  - ⚠️ fable 리뷰의 **비차단 백로그**: ①리마인더 sync 입력이 **월 스코프**라 다른 달의 유효 예약을 "사라진 계획" 으로 오판한다(선재 결함 — 8/1 근무 알림은 8월 화면을 봐야 예약되고 7월로 돌아오면 취소된다). ②`timeProvenance` 는 "수동 수정 → checked_in 복귀 → 재QR" 시퀀스에서 이력이 이겨 '수정됨' 오라벨(보수적 방향이라 비차단). ③배너 쿼리 **에러가 무음**이라 조회 실패와 "0건" 이 화면상 같다.
  - ⚠️ 배너 스코프 = **보이는 달**. 더 오래된 미기록은 사용자가 월을 넘겨야 발견된다(의도된 한계, 주석에 명시).
  - ⚠️ 출근축은 원리적으로 QR 판정 불가 — `start_time_source` 컬럼을 추가하는 마이그레이션은 별도 세션 몫.
- **막힌 지점**: 없음.
- **다음 세션에 넘기는 주의** (이 세션에서 새로 알아낸 것만)
  - 🚨 **`work_logs.date` 로 "지났다" 를 판정하지 말 것.** 홀덤펍 표준 18:00~02:00 근무는 date 가 전날이라 새벽엔 이미 "어제" 다 — 사전 비교만 쓰면 **근무 중인 사람이 매일 밤 집계에 잡힌다**. 내가 그 실패 모드를 주석에 써 놓고도 `isToday` 축만 막아 리뷰가 잡았다. 야간 유예(`OVERNIGHT_GRACE_HOUR`) 필요.
  - 🚨 **지점 단위 집계는 `useConfirmedStaff`(= `job_posting_id` 단일 매칭)로 하면 안 된다.** 컨테이너 직속 배치만 잡혀 공고로 뽑은 스태프가 통째로 빠진다. 지점 스팬은 `venue_span_posting_ids` RPC 경유(`getByVenueSpanInRange`).
  - 🔑 **`end_time_source` 는 절반만 배선돼 있었다** — QR RPC 퇴근 분기만 쓰고, SELECT 화이트리스트엔 없었다. 이런 "DB엔 있는데 안 읽는 컬럼" 은 타입에도 없어 존재 자체가 안 보인다.
  - 🚨 **RN `Pressable` 은 기본 `accessible=true` 라 자식 텍스트를 한 노드로 병합하고, 명시 `accessibilityLabel` 이 그걸 덮어쓴다.** 눌리는 영역 안에 상태 칩을 그려도 스크린리더엔 **아무것도 안 간다** — 라벨을 상태에서 합성할 것. `queryByText` 테스트는 이 갭을 못 잡는다.
  - 🔑 **동기화 함수의 얼리 리턴은 "정리" 까지 같이 죽인다** — `syncShiftReminders` 는 예약뿐 아니라 원장 정리도 하는데 `length===0` 리턴이 폐지된 알림 종류의 취소를 막고 있었다.
  - 🔑 `git worktree`/jest 경로에 괄호가 있으면(`app/(employer)/`) `npx jest <path>` 가 정규식으로 먹혀 0건이 된다 — `--runTestsByPath` 사용.

### S2 (2-A + 2-B) — 2026-07-31 · 상태: 완료 (**PR #374 머지** `a06f5311`)
- 워크트리/브랜치: `C:/Users/user/Desktop/T-HOLDEM-time` / `fix/worklog-time-model` · HEAD `3a6c53f8e`
- 커밋 5개: `5d7a614c1`(2-A+2-B 본체) → `5f6b91bd5`(인계 순서 가드) → `1d1e79b5e`(master 재통합)
  → `20273ba28`(타입 수정) → `3a6c53f8e`(리뷰 반영)
- **DB 마이그레이션 0건** (클라 전용). 파리티 기대값은 master 판 **184/111** 채택 — 내 브랜치는
  함수·정책을 건드리지 않으므로 `PARITY_EXPECT_FUNCS` 를 손대지 말 것.
- **끝난 것** (전부 이 세션에서 실행한 출력 기준):
  - 2-A: `time_slot` 정본을 출근 예정 단일값으로 통일. **범위를 생산하던 유일한 지점이
    `updateSlot` 이었다** — 시작 하나로 갱신 + 미정은 명시적 null. 형식 검증(`assertSlotStartTime`)을
    도메인 SSOT 로 올려 인원추가·편집 두 경로가 같은 관문을 쓴다.
  - `EditSlotSheet` 재구성(종료 입력·익일 프리뷰·시작==종료 가드 제거, 실적 섹션 신설),
    `AddSlotSheet`·`AddStaffModal` 프리필 제거 + 저장 게이트. **AddStaffModal 은 자유 텍스트였다** —
    검증 0으로 임의 문자열이 `time_slot` 에 들어가던 구멍을 닫았다.
  - "계산 전" 표시: 근무 전에는 금액을 못 낸다. "정산 정보를 계산할 수 없습니다"(고장으로 읽힘)를
    교체하고, 결과 없이 예상액 배너만 뜨던 모순도 함께 막았다.
  - 2-B: 카드의 '시간 수정' 버튼을 없애고 예정·실적 입구를 근무 수정 시트 하나로 통합.
    `WorkTimeEditor` 사용처 3곳 렌더는 **불변**(`StaffManagementTab:349`·`VenueDayPanel:385`·
    `SettlementModals:147`), `DEFAULT_SLOT_START_TIME` 과 `mappers.ts:505` 소비도 **존치**.
  - 리뷰: opus 중간 + fable 최종이 **독립적으로 같은 HIGH 2건** 지적 → 전부 반영(아래 주의 참조).
  - 최종 게이트: `npm run quality` **exit 0**(0 errors/97 warnings=기존 baseline) ·
    `npm test` **588 스위트 / 6436 테스트 / 122 스냅샷 전량 통과 exit 0** ·
    `e2e/` 별도 Grep **파급 0건**(시딩이 이미 단일값 `'18:00'`) ·
    knip 은 **2209 통과/2189 실패 = master baseline 과 동일**(악화 없음).
  - red→green 실증 2건: ①"계산 전" 표시 — 수정 원복 시 2건 실패 ②모달 인계 순서 — 지연 제거 시 1건 실패.
- **안 끝난 것**:
  - 🔴 **iOS 실기기 QA 1건은 유닛으로 대체 불가**: 근무 수정 시트 → '출퇴근 시간 수정' → 저장/취소 후
    터치 반응. 모달 전환은 jsdom 이 최종 상태만 보므로 지연이 실제로 충분한지는 실기기에서만 안다.
  - ⚠️ 확정 스태프 로딩 중에는 시트에 실적 섹션이 아예 안 보인다(로딩 완료 시 자가치유). 예전 카드
    버튼은 "불러오는 중" 토스트라도 줬다. 부수로 `resolveAttendanceTarget` 의 로딩 갈래는 이 경로에서
    도달 불가 방어코드가 됐다.
- **막힌 지점**: 없음.
- **다음 세션에 넘기는 주의**:
  - 🔑 **`time_slot` 판정 갈래를 늘릴 일이 생기면 `slotsOverlap`(domains/workSchedule/slotEdit) 한
    곳만 고칠 것.** 구인자(`detectSlotConflicts`)와 구직자(`detectScheduleOverlaps`)가 이걸 공유한다.
    이번에 내가 한쪽만 고쳐 "사장 화면엔 경고, 스태프 화면엔 침묵" 을 만들었고 리뷰가 잡았다.
  - 🔑 **모달→모달 전환에는 `SHEET_DISMISS_ANIMATION_MS`(constants/animation.ts) 를 쓸 것.**
    닫기·열기를 한 핸들러에서 부르면 React 가 한 커밋으로 배칭해 "먼저 닫는" 구간이 **없다**.
    레포에 이미 지연 상수가 있으니 로컬 복제하지 말 것(하마터면 네 번째 복사본을 만들 뻔했다).
  - 🚨 **pre-commit 훅은 eslint/prettier 만 돌고 tsc 는 안 돈다.** 테스트 파일의 타입 오류가
    jest(babel)를 통과해 커밋됐다가 `npm run quality` 에서 잡혔다. 커밋 전 type-check 를 따로 볼 것.
  - 🔑 **S3 은 같은 `EditSlotSheet.tsx` 를 만진다** — 시간 상태가 `pickedTime`/`timeUndecided` 파생
    구조로 바뀌었고 `timeDirty` 는 **상태가 아니라 파생값**이다. 상태로 되돌리면 "미정 체크했다
    해제" 가 레거시 범위를 조용히 자른다.
  - ⚠️ **DB 는 여전히 굵은 값을 심을 수 있다** — 이번 변경은 클라 전용이라 `add_direct_staff`·
    `confirm_application` RPC 가 `time_slot` 에 무엇을 쓰는지는 손대지 않았다(현재는 단일값).

### S1 (1-B + 1-C) — 2026-07-31 · 상태: 완료 (PR 미생성)
- 워크트리/브랜치: `C:/Users/user/Desktop/T-HOLDEM-venue` / `feat/venue-profile` · HEAD `0752c09c6`
- 커밋 4개: `de79d4095`(1-B DB) → `b0619c0fc`(1-C 클라) → `092310611`(master 재통합) → `0752c09c6`(리뷰 반영)
- **끝난 것** (전부 이 세션에서 실행한 출력 기준):
  - 1-B: 마이그 `20260731120000_venue_profile_rpcs` **prod 적용 완료**. 파리티 실측 **183 → 185 / 정책 111**.
    pgTAP 15/15 신규(`venue_profile_rpcs.test.sql`). schedule 형제 키 보존 단언은 **red→green 실증**.
  - 1-C: 컨테이너 read 3컬럼 확장 · ScheduleConverter 시그니처 확장 · scheduleService 2차 해소를
    두 RPC **키 합집합** 순회로 · VenueSettingsSheet 지점 설정 전체화 · 기본명 SSOT(`constants/defaultNames.ts`).
  - 리뷰: code-reviewer(fable) HIGH 1건 반영(P0001 접두사 매핑 신설 + vacuous 테스트 실질화).
  - 최종 게이트: `npm run quality` **exit 0** · `npm test` **584 스위트 / 6400 테스트 / 122 스냅샷 전부 통과 exit 0** ·
    pgTAP 22/22(파리티 가드 포함) · `e2e/` 별도 Grep 파급 **0건**.
  - `PARITY_EXPECT_FUNCS` 183 → **185** 갱신(방치 시 주간 parity-smoke red).
  - 최신 master(#367·#368·#369) 재통합 완료 — 무충돌, 마이그 정렬 무결(내 것이 마지막).
- **안 끝난 것**:
  - 🔴 **push/PR 미실행** — 사용자 명시 요청 대기(커밋 사전승인 범위 밖).
  - ⚠️ `p_defaults` 는 계약 예약 상태(UI 없음). 요소 검증(문자열·길이·개수 상한)은
    소비 UI 를 붙이는 후속 마이그에서 반드시 추가할 것 — 지금은 소비자 0이라 실해 없음.
  - ⚠️ `VenueSettingsSheet` `saveProfile` 이 `location` 을 항상 `{name}` 으로 **전체 교체**한다.
    B1(주소검색) 머지로 district/detailedAddress 가 생기면 이 저장 버튼이 주소를 **소거**한다 —
    그때 기존 location 병합 필수.
  - ⚠️ DB `handle_new_user` 는 여전히 `{닉네임} 워크스페이스` 를 만든다 → **3-D 범위에 트리거 수정 포함 필수**.
    안 하면 기본명 SSOT 통합이 신규 가입자에게 효과 없다.
- **막힌 지점**: 없음. 다만 세션 중 **공유 `node_modules` 가 외부 요인으로 손상**(818→345 엔트리)돼
  테스트가 대량 red 였다. `npm ci` 로 복구 후 재실행해 확정. 상세=메모리
  `pitfall_shared_node_modules_corruption_junction`.
- **다음 세션에 넘기는 주의**:
  - 🔑 **XSS 트리거 인자는 레포↔prod 가 어긋나 있다** — 레포 baseline 은 `('title','description')`,
    **prod 실측은 `('title','description','contact_phone')`**. `location` 은 여전히 대상 밖.
    트리거 인자는 **prod 에서 확인**할 것.
  - 🔑 **`jpc_test_set_user` 는 role GUC 까지 `authenticated` 로 바꾼다**(= `SET LOCAL ROLE`).
    이후 픽스처 INSERT 가 RLS 에 막히고 TEMP 테이블 쓰기도 권한 오류가 난다. SECDEF RPC 의
    `auth.uid()` 게이트만 볼 때는 JWT 주입 직후 role 만 postgres 로 되돌리는 `pg_temp` 래퍼를 쓸 것.
  - 🚨 **커밋 메시지에 백틱 금지** — 큰따옴표 안에서 명령 치환으로 먹혀 문장이 조용히 사라진다.
    히어독(`-F -`)을 쓸 것.
  - ⚠️ 0-4 는 사용자가 "보류"로 결정했으나 **병렬 세션이 PR#367 로 이미 머지**했다.
    로컬 `chore/supabase-safe-cleanup-20260731` 브랜치는 정리 가능.

### 계획 세션 — 2026-07-31 · 상태: 완료
- 워크트리/브랜치: `T-HOLDEM`(메인) / `chore/supabase-safe-cleanup-20260731`
- 끝난 것: 0단계 완료 확인(#365·#366 머지 실측) · 두 계획 문서 교차 검증 ·
  실행 순서/병렬 매트릭스 확정 · 이 원장 작성 · 핸드오프 문서 1-A 완료 반영
- 안 끝난 것: 0-4(미푸시 `632adcbae` Supabase 안전 정리) 처리 미결
- 다음 세션에 넘기는 주의:
  - 파리티 183/111 은 0-4 때문에 **신뢰 불가** — S1 착수 시 재실측
  - PR#366 이 `SchedulePostingContext.locationAddress` 를 이미 추가함 — 1-C 는 그 위에 얹을 것
  - 계획 문서 3개는 미추적 상태 (커밋 여부 사용자 결정 대기)

### S3 (2-C + 2-D + 별-2) — 2026-07-31 · 상태: 완료 (**PR #382 머지** `11a2390a0`)

- 워크트리/브랜치: `C:/Users/user/Desktop/T-HOLDEM-notify` / `feat/worklog-time-notify` · HEAD `fd8d7b52b` (5커밋, `d3d484a07`(#375) 리베이스) · **PR #382**
- 끝난 것
  - **2-C** `407063fb4` — 트리거 `notify_on_work_log_update` 에 Case 2-B 신설. `time_slot` 변경 자체를 감지(이력 배열 경유 안 함). 알림 타입은 기존 `schedule_change` 재사용, `data.applicationId` 로 스케줄 상세 정밀 착지. 로컬 Docker 무오염 red→green 4케이스.
  - **2-D** `9e2990a85` — `WorkTimeDisplay.scheduleTimeState`(confirmed/undecided/negotiable) 신설. 미정을 '시간 협의'라 부르던 거짓 표시 제거. `WorkTab`(헬퍼 미사용 재구현)·`GroupedScheduleCard`(시간 행 은닉) 두 갈래를 SSOT 로 흡수. red 4건 → green.
  - **별-2** `597eca3fe` — tailwind `slot.*` 4종 신설(청록·하늘·보라·자홍), 레거시 15종은 읽기·쓰기 모두 보존.
  - **리뷰 반영** `9b8eb9d80` + `fd8d7b52b` — 아래 '막힌 지점' 참조.
  - 게이트: `npm run quality` exit 0 · `npm test` 588 suites / 6452 tests · `e2e/` 별도 Grep 0건 · code-reviewer opus → fable **"PR 진행 가능"(CRITICAL/HIGH 0)**
- 안 끝난 것 (🔴 사용자 결정 대기)
  1. **마이그레이션 prod 미적용** — `uniqn-mobile/supabase/migrations/20260731140000_notify_on_time_slot_change.sql`. prod 실측 `case_2b_applied=0`. 적용해도 파리티 184/111 불변(`CREATE OR REPLACE`).
  2. ~~push / PR~~ → ✅ **PR #382 머지**(`11a2390a0`). CI 9잡 green — `DB Tests (pg_prove)` 가 신규 pgTAP 과 `parity_baseline_guard` 를 모두 통과했다(로컬에서 red 이던 함수 수 항목은 CI 의 새 스택에서 green — 로컬 드리프트 확정).
  3. 이 원장 파일은 **메인 체크아웃에 미커밋** 상태(S2 세션 종료분 + 이 S3 항목이 함께 쌓여 있음). 커밋 주체 미정.
- 막힌 지점: 없음. 다만 리뷰가 잡은 함정 2개는 재발 위험이 크다 —
  - 🚨 **`CREATE OR REPLACE` 의 `SET` 절은 proconfig 를 통째로 갈아치운다.** baseline 의 `search_path` 를 그대로 베끼면 그 뒤 `ALTER FUNCTION` 으로 얹은 `pg_temp` 하드닝(`20260711100000`)이 조용히 사라진다. **베이스는 baseline 이 아니라 `pg_proc.proconfig` 실측값**이어야 한다. `parity_baseline_guard.test.sql:134` 가 CI 에서 잡는다(RED 재현 완료).
  - 🚨 **알림 본문이 약속한 버튼이 실제로 있는지 확인할 것.** 취소 요청 버튼은 `schedule.applicationId` 로 게이트되는데, 근무표 직접 배치 work_log 는 `application_id` 가 NULL 이다(prod 3건 중 2건).
- 다음 세션에 넘기는 주의
  - `EditSlotSheet.tsx` 는 S2·S3 가 연속으로 만졌다. S4 는 이 파일을 피한다.
  - `ScheduleCard.tsx` 는 S3·S4(별-1) 접점 — S3 머지 후 착수 권장.
  - 신규 pgTAP `supabase/tests/worklog_time_slot_change_notify.test.sql` 은 마이그 적용 후에만 통과한다. prod/로컬 적용 전에 `npm run test:db` 를 돌리면 T1 이 red 다(정상).
