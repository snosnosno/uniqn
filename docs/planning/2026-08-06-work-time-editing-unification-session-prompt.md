# 세션 프롬프트 — 근무 시간 편집 통일 구현 (서브에이전트 주도)

> 사용법: 새 세션에서 **이 파일을 읽히고 시작**한다.
> 실행 방식: `superpowers:subagent-driven-development` — 태스크마다 새 서브에이전트, 사이사이 메인이 검토.
> **설계 진실원**: `docs/planning/2026-08-06-work-time-editing-unification-design.md`
> **구현 계획(태스크 정본)**: `docs/planning/2026-08-06-work-time-editing-unification-plan.md`

---

## 0. 인계 시점 상태 (2026-08-06, 실측)

| 항목 | 값 |
|---|---|
| 브랜치 | `docs/work-time-editing-unification-design` — **커밋 4개, PR 미생성, master 미반영** |
| 커밋 | `71675d08e`(설계 초안) → `73a7dce7b`(개정) → `39dc3689a`(D6·D7) → `575c9a221`(구현 계획) |
| 내용 | **문서 2개뿐. 코드·마이그레이션 변경 0.** 구현 미착수 |
| master | `8d1d8534c` (#420 정산 payroll 직접쓰기 차단) |
| 워크트리 | **없음 — 이 세션에서 만들어야 한다** |
| prod | 함수 **200** · 정책 **111** (2026-08-06 기준, MEMORY 기록) |

### 이 작업이 무엇인가 (한 문단)

공고 스태프관리에서 시간을 수정하면 손대지 않은 근태 상태가 "출근"으로 뒤집히는 결함이 신고됐다.
원인은 `WorkTimeEditor.tsx:114-121` 이 실제 출근 기록이 없을 때 **출근 예정 시각을 실적 칸에 프리필**하고
`미정=false` 로 두는 것이다. 조사 과정에서 시간 편집 표면이 4곳으로 갈라져 화면마다 고칠 수 있는 항목이
다르다는 더 큰 문제가 드러나, **한 사람의 하루 = 한 시트**로 수렴하는 설계로 확장됐다.

---

## 1. 착수 전 필수 (순서 엄수)

- [ ] **전용 워크트리 생성** — 메모리 규칙상 모든 구현 세션은 워크트리에서(2026-07-31 상시 격상)

```bash
cd C:/Users/user/Desktop/T-HOLDEM
git worktree add ../T-HOLDEM-worktime -b feat/work-time-editing-unification docs/work-time-editing-unification-design
```

- [ ] **node_modules 정션** — 5분짜리 `npm install` 회피

```cmd
mklink /J C:\Users\user\Desktop\T-HOLDEM-worktime\uniqn-mobile\node_modules C:\Users\user\Desktop\T-HOLDEM\uniqn-mobile\node_modules
```

⚠️ MSYS 경로 변환 주의 — Git Bash 에서 실패하면 PowerShell `New-Item -ItemType Junction` 을 쓴다.
⚠️ 정션 상태로 `expo start` 를 하면 라우트 0 이 된다 — `EXPO_ROUTER_APP_ROOT` 절대경로 + `--clear` 필요.

- [ ] **로컬 Supabase 기동** (Task 1~3 은 pgTAP 필수)

```bash
cd uniqn-mobile && npm run db:start
```

⚠️ 공유 Docker 스택이라 병렬 세션이 상존한다. pgTAP 전에 `npm run db:status` 로 재확인.

- [ ] **베이스라인 green 확인** — 착수 전 red 를 내 것으로 착각하지 않기 위해

```bash
cd uniqn-mobile && npm run test:db 2>&1 | tail -20
```

---

## 2. 실행 방식 — 서브에이전트 주도

`superpowers:subagent-driven-development` 를 호출하고, 계획 문서의 **Task 1~9 를 순서대로** 진행한다.

### 태스크별 서브에이전트 모델 라우팅

| 태스크 | 성격 | 모델 |
|---|---|---|
| Task 1·2·3 (마이그레이션) | 구현 | `opus` |
| Task 1·2·3 착수 전 설계 확인 | 판정 | `fable` (database-reviewer) |
| Task 4~8 (클라 구현) | 구현 | `opus` |
| 각 태스크 직후 리뷰 | 판정 | `fable` (code-reviewer) |
| Task 9 (회귀) | 검증 | `fable` (verify-agent) |

### 서브에이전트 디스패치 시 반드시 금지 명시

```
금지: mcp__supabase__* 직접 호출 · 기존 마이그레이션 파일 수정 · PROD 우회 ·
      DROP FUNCTION (CREATE OR REPLACE 만) · 계획에 없는 리팩터링
```

### 검증 규율

에이전트의 "성공" 보고는 **그대로 신뢰하지 않는다.** 각 태스크 후 메인이 직접:
1. `git diff` 로 실제 변경 확인
2. 해당 태스크의 테스트 명령을 **직접 실행**
3. 출력을 읽고 나서 다음 태스크 디스패치

---

## 3. prod 적용 순서 (역순 금지)

```
Task 1 (알림 병합) → Task 2 (읽기 RPC) → Task 3 (쓰기 RPC)
```

**역순이면 통합 RPC 가 스태프에게 알림 2통을 낸다.** Task 1 이 먼저 들어가야 병합 가드가 자리를 잡는다.

적용은 **MCP `apply_migration` 전용**. `supabase db push` 금지.

---

## 4. 반복 확인된 함정 (전부 이 레포에서 실제로 터진 것)

| 함정 | 방어 |
|---|---|
| 정의 md5 대조가 전부 불일치로 보임 | `md5(replace(pg_get_functiondef(oid), chr(13), ''))` — **`chr(13)` 제거 필수**(CRLF) |
| `DROP FUNCTION` 후 재생성 | 금지. `20260731090000` 이 회수한 PUBLIC EXECUTE 가 되살아난다 |
| `SET search_path` 에서 `pg_temp` 누락 | `parity_baseline_guard.test.sql:134` red. `CREATE OR REPLACE` 는 proconfig 를 통째로 갈아치운다 |
| 3상 계약을 `??`/truthy 로 판정 | `null`(삭제)이 조용히 무시된다. `!== undefined` 로 본다 |
| jsonb 이력 append | 기존 `FOR UPDATE` 스냅샷 안에서. 다시 SELECT 하면 Lost Update |
| `e2e/` 단언이 안 잡힘 | `eslint.config.js` ignores 라 `npm run quality` 범위 밖 — **별도 Grep 필수**. 시트 제목이 "근무 시간 수정" → "근무 수정"으로 바뀐다 |
| 트리거로 쓰기 채널 변경 | 착수 전 `supabase/tests/` 전수 grep (#420 교훈 — 기존 pgTAP 가 깨졌다) |
| `Bash grep` 이 `app/` 트리에서 0건 | Grep 도구 + `tsc` 교차검증. 이 결과로 삭제 판정 금지 |
| MSYS 경로 변환 | `.` 붙은 경로엔 `MSYS_NO_PATHCONV=1` |
| 마이그 기록 없어도 함수는 있을 수 있음 | `list_migrations` + `pg_proc` 카운트 **병행** 대조 |

---

## 5. 확정된 도메인 결정 — 재논의 금지

설계 문서 §0 의 D1~D7 은 사용자가 확정한 것이다. 구현 중 "이게 더 나은데" 가 떠올라도 **바꾸지 말고 보고**한다.

- **D1** 예정 = 안내값(상태 무관) / 실적 = QR 또는 직접수정만 상태 전환
- **D2** 3곳(근무표·스태프관리·정산) 동일 시트
- **D3** 시간뿐 아니라 역할·색·메모까지 통합
- **D4** 정산 완료 건은 **전체** 읽기 전용 (현행 대비 축소임을 알고 내린 결정)
- **D5** 일괄 변경 제외 — 3-C(`update_posting_slot_time`)는 축이 달라 **그대로 둔다**
- **D6** 예정·역할 섹션 기본 접힘 + 한 줄 요약, 실제 출퇴근만 펼침
- **D7** 역할 정원 마감 **차단하지 않음** — 표기만, 선택 허용. **서버 정원 거부도 넣지 않는다**

⚠️ **D7 때문에 "결함 ④(정원 검사 부재)"는 고치지 않는다.** 계획에 그렇게 적혀 있다. 좋은 뜻으로 정원 검사를 추가하면 D7 위반이고 구클라가 막힌다.

---

## 6. 범위 밖 — 손대지 말 것

- `update_posting_slot_time`(3-C 일괄 변경) · `SlotTimeChangeSheet.tsx` · `useUpdatePostingSlotTime.ts`
- QR 체크인 RPC (SECDEF, 별도 축)
- 직접 UPDATE **REVOKE** 실행 — 시간모델 R4 트랙. 본 작업은 **선행 조건 해소까지**
- `applications.notes`(확정 시 메모) — `work_logs.notes`(배치 메모)와 다른 컬럼
- 예정 퇴근 시각 — 시간모델 D0 에서 폐기 확정

---

## 7. 완료 정의

- [ ] Task 1~9 전부 green
- [ ] `npm test` + `npm run quality` 통과 (출력 직접 확인)
- [ ] `npm run test:db` 전체 스위트 green — 특히 `parity_baseline_guard`
- [ ] `npx knip` 미사용 export 수가 래칫(**2189**) 이하
- [ ] `e2e/` Grep 으로 문구 단언 갱신 확인
- [ ] prod 파리티: 함수 **200 불변**(전부 `CREATE OR REPLACE`, 신설·삭제 없음) · 정책 111
- [ ] PR 생성 (사용자 명시 요청 시에만 — 로컬 커밋은 사전 승인)

### 잔여로 넘길 것 (이 세션에서 하지 않음)

- 🔴 실기기 QA (시트 접힘·휠 피커·키보드)
- 🔴 웹 배포 · OTA
- 🔴 시간모델 R4 REVOKE (구버전 앱 공존 종료 후)
- ⚠️ P2 배포 노트: **`RoleChangeModal` 의 마감 역할 비활성이 풀린다** — 기존에 막혀 있던 게 열리는 변화라 사용자 고지 필요

---

## 8. 세션 시작 시 첫 5분

```bash
# 1. 최신화
cd C:/Users/user/Desktop/T-HOLDEM && git fetch origin && git log --oneline -3 origin/master

# 2. 워크트리 (§1)
# 3. 계획 문서 통독
#    docs/planning/2026-08-06-work-time-editing-unification-plan.md

# 4. Task 1 의 전제 실측 — prod 트리거 본문이 레포와 같은지
#    MCP execute_sql:
#    SELECT md5(replace(pg_get_functiondef(oid), chr(13), '')), length(prosrc)
#    FROM pg_proc WHERE proname = 'notify_on_work_log_update';
#    → 20260802093000_...sql 본문 md5 와 대조. 다르면 중단하고 보고.
```

그다음 `superpowers:subagent-driven-development` 호출 → Task 1 부터.
