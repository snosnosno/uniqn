# 세션 프롬프트 — 시간 모델 재설계 잔여 (R0 착지 마무리 + R1 전체) (ULTRACODE)

> 사용법: 새 세션에 이 파일을 읽히고 시작한다. **ULTRACODE 옵트인** 전제.
> 설계 진실원: `docs/analysis/2026-08-03-time-model-redesign.md`
> 직전 세션 프롬프트: `docs/planning/2026-08-03-time-model-r0r1-session-prompt.md` (⚠️ 아래 §1 의 정정 항목 우선)
> 메모리 토픽: `project_time_model_no_scheduled_end.md`

---

## 0. 인계 시점 상태 (2026-08-03, 실측)

| 항목 | 값 |
|---|---|
| PR | **#409 OPEN** — `feat/time-model-r0-server-normalize` (커밋 2개: `abfc95f99` + `c93a499dd`) |
| CI | **9/10 pass**. DB Tests(pg_prove) **pass 2m8s** · Tests **pass 4m3s** · Quality 전부 pass |
| CI 실패 1건 | **E2E — 알려진 flake 확정.** `218 passed / 1 failed`, 실패는 `e2e/tests/p2-standard/board.spec.ts:88`(메모리 등재 flake). 실패 형태가 단언 실패가 아니라 `page.goto: net::ERR_ABORTED; maybe frame was detached?` + 60s 타임아웃이고, R0 은 SQL 전용이라 게시판 코드와 무관하다. **→ `gh run rerun --failed` 로 재실행하거나 그대로 머지 판단** |
| 충돌 | 없음 (`git merge-tree` 확인). master 는 #408 머지로 `0ebad0e67` |
| prod | 함수 **192** · 정책 **111** · `_normalize_time_slot` **미존재** = **R0 미적용** |
| 워크트리 | `C:\Users\user\Desktop\T-HOLDEM-timemodel` (node_modules 정션 완료, 워킹트리 clean) |
| 로컬 스택 | R0 적용된 상태. 전체 DB 스위트 98파일 **1049테스트 green** |

### R0 가 이미 한 일 (재구현 금지)
신규 헬퍼 `_normalize_time_slot(text)` 1개 + 재정의 4개(`_posting_slot_key` · `confirm_application` ·
`add_direct_staff` · `notify_on_job_posting_update`). 파리티 래칫 192 → **193** 갱신 완료.

---

## 1. ⚠️ 직전 프롬프트의 **틀린 지시** (실측으로 정정됨 — 반복하지 말 것)

1. **"seat-basis 정원 카운트 계열의 `'NEGOTIABLE'` 리터럴"은 존재하지 않는다.**
   prod `pg_proc.prosrc` 전수 결과 `'NEGOTIABLE'` 보유 함수는 정확히 3개:
   `confirm_application` · `add_direct_staff` · `notify_on_work_log_update`.
2. **`SET search_path` 는 함수마다 다르다.** 프롬프트의 "전부 `public, extensions, pg_temp`" 는 2개 함수에 틀렸다:
   `_posting_slot_key`=`pg_catalog, pg_temp` / `confirm_application`=`public, pg_temp`(**extensions 없음**) /
   `add_direct_staff`·`notify_on_job_posting_update`=`public, extensions, pg_temp`.
   `CREATE OR REPLACE` 는 명시하지 않은 속성을 기본값으로 되돌린다(proconfig 통째 교체) — 그대로 따랐으면 하드닝이 유실됐다.
3. **`_posting_slot_key` 호출자는 4개**(프롬프트/탐색 에이전트는 3개로 봤다):
   위 두 RPC + `count_posting_confirmed_by_slot` + `update_work_log_slot`(#407, 신규라 누락됨).

---

## 2. 남은 작업 A — R0 착지 (최우선, 순서 엄수)

```
① E2E green 확인 → ② prod 적용 → ③ 머지
```

- **① E2E**: `gh pr checks 409`. ⚠️ `board.spec:88` 은 **알려진 flake** — 그것만 red 면 재실행(`gh run rerun --failed`).
- **② prod 적용**: `mcp__supabase__apply_migration` **전용**(db push 금지).
  - `name`: `time_slot_sentinel_unification`
  - `query`: `uniqn-mobile/supabase/migrations/20260803120000_time_slot_sentinel_unification.sql` **전문 그대로**.
    🚨 손으로 줄이지 말 것 — 레포와 조용히 갈라진다.
  - **적용 후 실측 대조**(로컬 = 정답 기준, 이 md5 와 일치해야 한다):
    | 함수 | md5(prosrc) |
    |---|---|
    | `_normalize_time_slot` | `defb3cb8e788bb4c903e3bd41eacb6d7` |
    | `_posting_slot_key` | `c97839dd91007bc9b24530aba7f22a54` |
    | `confirm_application` | `cfb3a5001399e85a50138e539779a732` |
    | `add_direct_staff` | `9f1b65c8b8c4e96b761cf7f1fe145af4` |
    | `notify_on_job_posting_update` | `a232f82648e8adce9650ef79cb9d0df4` |
  - 함수 수 **192 → 193**, 정책 111 불변. 오버로드가 5함수 전부 **1** 인지 확인
    (`pg_get_function_arguments` — DEFAULT 하나만 빠져도 새 오버로드가 생겨 옛 함수가 살아남는다).
  - 🔴 **적용된 prod 기록명을 메모리에 "재적용 금지"로 등재**. (apply_migration 이 적용 시각으로 버전을 새로 채번하므로 레포 파일명 `20260803120000` 과 다르다.)
- **③ 머지**: `gh pr merge 409 --squash --delete-branch`. 레포는 **squash 전용**(merge/rebase 비활성).
  ⚠️ 워크트리가 브랜치를 점유하면 **로컬 삭제만** 실패한다(머지는 정상) — 워크트리 정리 후 `git branch -D`.

---

## 3. 남은 작업 B — R1 클라이언트 통일 (R0 **prod 적용 후**에만 착수)

### 3-0. 브랜치
**R0 머지 후 최신 master 에서 새로 분기**한다. 🚨 R0 브랜치 위에 스택하지 말 것 —
squash 머지라 R0 커밋이 master 의 조상이 되지 않아 R1 PR 이 R0 diff 를 통째로 중복 표시한다.

### 3-1. 전환기 원칙 (R1 전체를 지배 — 위반 시 실사고)
- **읽기는 관용, 쓰기는 보수.** prod 기존 센티널·범위형 행은 R3 백필까지 남고, R2 이후에도 구버전 사장 앱(엄격 `z.string()`)이 공존한다.
- ①읽기: NULL+센티널+범위형 **전부 수용** ②쓰기: **null 전송 금지 — `'미정'` 문자열로 통일**(`'NEGOTIABLE'` 도 `'미정'` 으로).
- **null 쓰기 전환과 레거시 읽기 경로 삭제는 R3 의 일이다.**

### 3-2. 실측 인벤토리 (직전 세션 Explore 4회 결과 — 재조사 불필요)

**마커 정의(유일한 정의 지점)**: `src/types/assignment.ts:19,22,25`
`FIXED_DATE_MARKER='FIXED_SCHEDULE'` / `FIXED_TIME_MARKER='NEGOTIABLE'` / `TBA_TIME_MARKER='미정'`

**쓰기 경로 — `'NEGOTIABLE'` 을 서버로 보내는 곳 (여기를 `'미정'` 으로)**
| 파일:줄 | 현재 |
|---|---|
| `src/repositories/supabase/ApplicationRepositoryHelpers.ts:225` | `timeSlot: jobData.schedule.startTime ?? FIXED_TIME_MARKER` |
| `src/components/jobs/ApplicationForm.tsx:140` | `postingFacts.application.fixedAssignmentTimeSlot \|\| FIXED_TIME_MARKER` |
| `src/domains/job-posting/facts.ts:161-163` | `fixedAssignmentTimeSlot: ... startTime \|\| FIXED_TIME_MARKER : FIXED_TIME_MARKER` |

**키 빌더 — R0 새 규약(`'미정'`)과 맞출 곳**
| 파일:줄 | 비고 |
|---|---|
| `src/components/jobs/shared/postingSurfaceModel.ts:199` | `const fixedSlotKey = timeValue \|\| FIXED_TIME_MARKER` → `UNKNOWN_TIME_KEY` |
| `src/domains/application/slotCapacity.ts:58-60` | `slot.startTime \|\| (kind==='fixed' ? FIXED_TIME_MARKER : '')` — ⚠️ `''` 폴백도 서버(`'미정'`)와 불일치 |
| `src/domains/schedule/postingHydrateKeys.ts:13,50-56` | **이미 서버와 완전 일치**(TBA→`'미정'`, 폴백 `'미정'`). ✅ 이 파일을 정본으로 삼아라 |

**미정 판정이 6갈래로 쪼개져 있다 → `isTimeTBD` 하나로 수렴**
1. `src/shared/time/WorkTimeDisplay.ts:92-97` — `scheduleTimeState` 3상태(사실상 공통 헬퍼)
2. `src/components/jobs/shared/postingSurfaceModel.ts` — 로컬 `NEGOTIABLE_LABEL='협의'` 독립 구현
3. `src/domains/job-posting/core.ts:269-284` `getPostingLegacyTimeSlot`
4. `src/components/employer/order-sheet/*` — `isTimeToBeAnnounced` **boolean** 모델 (`SlotCard.tsx:30-32` 는 `'미정'` 리터럴 하드코딩)
5. `src/types/unified/schedule.ts:211-217` — `isStartTimeNegotiable` **boolean** 모델
6. `src/domains/schedule/ScheduleConverter.ts:281-283` — `FIXED_TIME_MARKER`·`TBA_TIME_MARKER`·리터럴`'미정'` **3중 비교**(뒤 둘은 동일값이라 중복)

**zod**
| 파일:줄 | 현재 | 처분 |
|---|---|---|
| `src/schemas/application.schema.ts:177` | `assignmentInnerSchema.timeSlot: z.string()` (**읽기 파싱**) | → `.nullable()` (읽기 관용) |
| `src/schemas/workLog.schema.ts:168` | `z.string().nullable().optional()` | 이미 정합 — 변경 불필요 |
| `src/schemas/workLog.schema.ts:72` | `createWorkLogSchema.timeSlot: z.string().optional()` | **호출부 0건(死스키마)** — 손대지 말 것 |

**에러 매핑**: `src/utils/supabase.ts:134-140` — 23514 + `work_logs_time_slot_format` 특례.
현행 문구 "시간을 다시 선택해 주세요"는 **사장이 고칠 수 없는 원인**(구클라 지원서)이라 오도 → "지원자의 앱 업데이트가 필요합니다" 계열 분기 추가.

### 3-3. 🚨 직전 세션이 발견한 함정 (설계 문서에 없음)

**`src/components/schedule/helpers/timeHelpers.ts:163`**
```ts
const raw = info.rawTimeSlot?.trim();
if (raw && raw !== TBA_TIME_MARKER) return raw;   // ← 레거시 자유텍스트 보존 목적
```
`negotiable` 상태만 제거하면 `rawTimeSlot === 'NEGOTIABLE'` 이 이 분기에 떨어져
**사용자에게 `"NEGOTIABLE"` 영문 토큰이 그대로 노출된다.**
→ 이 조건을 `isTimeTBD(raw)` 로 바꿔야 한다. **`isTimeTBD` 헬퍼가 필요한 정확한 이유가 이것이다.**

### 3-4. 깨질 테스트 (위험도 순 — 재작성 대상)
1. `src/shared/time/__tests__/WorkTimeDisplay.test.ts:96-137` — **describe 블록 전체가 D4 의 정반대를 단언**. 특히 112-117 "고정공고의 NEGOTIABLE 만 negotiable — 미정과 섞이면 안 된다"
2. `src/components/jobs/shared/__tests__/postingSurfaceModel.hydrate.test.ts:11,29,58` — 키에 `'NEGOTIABLE'` **리터럴 하드코딩**. 🚨 에러가 아니라 **filled 값이 조용히 0** 이 되는 형태로 깨진다
3. `src/components/schedule/helpers/__tests__/timeHelpers.test.ts:179-190` — `scheduleTimeState:'negotiable'` 수동 주입. union 에서 멤버 제거 시 **tsc 가 먼저** 잡는다
4. `src/domains/application/__tests__/slotCapacity.fixed.test.ts` — 상수 import 라 단언은 살아남지만 **주석이 stale** 이 된다(의미 표류)
5. `src/services/work/__tests__/selectWorkLogForQR.test.ts:37` — 저위험(둘 다 파싱 실패→null)

### 3-5. 안내 문구 2건
- ① 공고 시간 수정 시 확정자 존재하면: "이미 확정된 N명에게는 적용되지 않습니다. 근무표에서 변경하세요"
- ② 공고 작성 화면에 새벽 근무 날짜 관례(D3: 새벽 시작 근무 = **실제 시작 날짜**로 공고)

### 3-6. R1 검증 게이트
- `npm run quality` + `npm test` 실행 출력 필수. **jest 는 타입을 안 본다** — `tsc --noEmit` 별도 확인(pre-commit 훅도 tsc 를 안 돈다).
- red-green: 미정 통일 가드는 **가드를 제거해 red 를 실제로 확인**할 것.
- 상수·문구 변경 시 **`e2e/` 별도 Grep 필수**(eslint·quality 사각지대). e2e 는 `'18:00'` 24곳 하드코딩이고 **시간 미정 어설션은 사실상 0건** — 방어 수정이 아니라 신규 커버리지가 필요한 쪽.
- ⚠️ `/미정산/`(정산 탭 라벨)·'날짜 미정'·'위치 미정'·'급여 미정'·'상금 미정' 은 **동음이의 오탐**이다. 시간 미정과 무관.
- R1 기준선(직전 세션 실측): jest **611스위트 6661테스트 green**.

---

## 4. 운용 규율 (실사고 기반 — 전부 이번 세션에서 실제로 물림)

- `docker exec ... psql -f /tmp/x.sql` 은 **`MSYS_NO_PATHCONV=1`** 없으면 `/tmp` 가 Windows 경로로 변환돼 실패한다.
- 로컬 DB 시드: `auth.users` INSERT 의 `handle_new_user` 트리거가 `public.users` 를 **이미 만든다**(중복키). 그리고 `public.users.role` 을 나중에 바꾸면 `prevent_role_self_escalation` 이 막는다 → **역할은 `auth.users.raw_app_meta_data` 로 정할 것**.
- pgTAP 에서 `ORDER BY created_at` 금지 — 한 트랜잭션의 `now()` 라 전 행 동률이고 순서가 비결정(flaky).
- 마이그 슬롯 점유 판정: `list_migrations` 로는 **미머지 브랜치가 안 보인다**. 타 워크트리의 `supabase/migrations/` 를 직접 `ls` 할 것.
- pre-push 훅이 `npm run quality` + functions 빌드를 돌아 **push 1회에 ~5분**. 타임아웃 넉넉히 잡거나 백그라운드로.
- 리뷰 지적은 **재현 프로브로 판정**하라. (이번 세션은 14건 전부 재현돼 기각 0건이었지만, 과거엔 5건 중 2건이 오탐이었다.)

---

## 5. 완료 기준 & 마무리

- [ ] R0 prod 적용 실측(md5 5종 + 함수 193 + 오버로드 1) → 기록명 메모리 등재
- [ ] PR #409 머지
- [ ] R1 PR 머지 (R0 prod 적용이 **선행 조건** — 순서 뒤집기 금지)
- [ ] 메모리 `project_time_model_no_scheduled_end.md` 갱신 + 실행 원장(`docs/planning/2026-07-31-execution-session-prompts.md`) §5 인계 로그
- [ ] 워크트리 `T-HOLDEM-timemodel` 정리 (+ 선재 정리 대상: `T-HOLDEM-cleanup`, `T-HOLDEM-followups`)
- [ ] 잔여 게이트 인계: **R2(웹 배포·OTA)=사용자 게이트** → R3(백필 + CHECK 강화 + 클라 null 쓰기 전환 + 레거시 읽기 경로·`TBA_TIME_MARKER` 삭제, 센티널 신규 기록률 0 근접 측정 후) → R4(REVOKE)
- 마무리는 `/session-end`

### R3 로 미룬 것 (의도적 — 이번에 손대지 말 것)
- `notify_on_work_log_update` 의 `'NEGOTIABLE'`→`'협의'` 라벨: 직접 UPDATE 로 구 값이 여전히 들어올 수 있는 전환기에는 **그 라벨이 오히려 정확하다**.
- `_posting_slot_key` 의 0패딩: 정본화는 저장 시점 `_normalize_time_slot` 이 담당. prod 공고 시각은 전부 0패딩이라 실익 0.
- CHECK 제약 `work_logs_time_slot_format` 변경 — 에러 매핑이 **제약명을 문자열로 참조** 중이라 재생성 시 **같은 이름 유지** 필수.
