# ops 결함 ⑦-2 — 근태 write-back 설계안 (2026-08-08)

> 브랜치 `feat/ops-attendance-writeback-20260808` · 워크트리 `T-HOLDEM-opswb` · 기준 `382123d4f`
> **1단계 산출물.** 구현은 이 문서가 커밋된 뒤 시작한다.

---

## 0. 결론 먼저

**새 근태 저장소를 만들지 않는다. `work_logs` 가 근태 SSOT 로 남고, ops 는 기존 `update_work_log_slot` RPC 를 호출한다.** 신규 함수는 **해석기(resolver) 1개**뿐이다.

| 축 | 결정 | 신규 |
|---|---|---|
| 근태 저장 위치 | `work_logs` 유지 — `ops_staff` 컬럼 확장도, 신규 테이블도 **안 만든다** | 없음 |
| 타깃 행 해석 | `(job_posting_id, staff_id, date = event_date)` — **`source_work_log_id` 를 쓰지 않는다** | RPC 1개 |
| 쓰기 경로 | 기존 `update_work_log_slot` 재사용 | 없음 |
| 되돌리기 | 기존 3상 계약(`checkOut: null`)이 **이미 지원** — UI 노출만 | 없음 |
| 일괄 처리 | **만들지 않는다** (알림 폭발 방어) | — |
| provenance | `'manual'` 유지 — **제3값 신설 안 함** | 없음 |
| 파리티 | 206 → **207** / 정책 111 불변 | — |

---

## 1. 원장의 전제가 틀렸다 — 실측 정정

원장은 이 작업을 "단방향을 양방향으로 바꾸는 **배선**"이라 적었다. 실측은 다르다.

| 원장의 전제 | 실측 | 근거 |
|---|---|---|
| ops 에 근태 데이터가 있고 되돌려보내면 된다 | **`ops_staff` 에 출퇴근 컬럼이 0개다** | `20260710000002_baseline_schema_from_prod.sql:10339-10351` — 전체 컬럼 = id·tournament_id·staff_id·role·custom_role·staff_name·staff_nickname·source·source_work_log_id·created_at |
| `ops_clock` 이 근태다 | **블라인드 클럭이다** (`current_level_sort`·`level_started_at`·`is_running`) | `baseline:10123-10131` |
| 클라 진입점 `src/domains/ops/...` | **오타.** 실제는 `src/services/ops/opsStaffService.ts:33` | 실측 |
| ops 에 정산 연동 코드가 일부 있다 | **0건이다** — `payroll`·`check_in`·`checkOut`·`출근`·`퇴근` 전부 0 히트. `work_log` 2건은 주석뿐 | `opsStaffService.ts:33`, `StaffAddSheet.tsx:7` |

→ 이것은 배선이 아니라 **"ops 에 근태 캡처를 신설하고 기존 정산 파이프라인에 접속시키는 신규 기능"** 이다. 원장 항목의 난이도·범위를 그에 맞게 다시 읽어야 한다.

---

## 2. 결정과 근거

### 결정 1 — 근태 저장소를 신설하지 않는다 (`work_logs` 단일 SSOT)

**기각한 대안 2종:**

| 대안 | 기각 사유 |
|---|---|
| A. `ops_staff` 에 `check_in_at`/`check_out_at` 컬럼 추가 | 근태가 **두 곳**에 생긴다. 정산은 `work_logs` 를 읽으므로 반드시 동기화 계층이 필요해지고, **그 동기화 공백이 바로 결함 ⑦ 자신**이다. 같은 병을 한 층 더 쌓는 꼴 |
| B. 신규 테이블 `ops_staff_attendance` | 위와 동일 + 테이블·RLS 정책 신설로 파리티 정책 수가 움직인다(111 → 112+). 드리프트 표면만 넓어진다 |

**채택안 근거:** `work_logs` 는 이미 근태 SSOT 이고(`baseline:6962` 주석이 명시), `update_work_log_slot` 은 **이미 완성된 하드닝 쓰기 채널**이다 — 정산 동결·퇴근≥출근 검증·상태 파생·수정 이력·알림 병합·`end_time_source` 되돌림을 한 트랜잭션에 갖고 있다(`20260806140000` 이 흡수, `20260808120000` 이 현행). ops 가 여기에 얹히면 이 계약 전부를 **공짜로 상속**한다.

**트레이드오프 (명시적 범위 밖):** `source='manual'` 로 수동 추가된 ops 스태프는 `source_work_log_id` 가 NULL 이라 대응 `work_log` 가 없다 → **근태 캡처 불가**. UI 는 이 스태프를 "공고 미연동" 으로 표시하고 근태 컨트롤을 숨긴다. 억지로 `work_logs` 행을 만들어주면 지원서 없는 유령 근무가 정산에 들어간다.

### 결정 2 — 타깃 행은 `source_work_log_id` 가 **아니라** event_date 로 해석한다

`source_work_log_id` 를 그대로 타깃으로 쓰면 **잘못된 날짜 행에 시간이 박힌다**. import 가 `DISTINCT ON (wl.staff_id) ... ORDER BY wl.staff_id, wl.date DESC`(`baseline:6964,6971`) 로 **스태프당 1건(최신 날짜)** 만 붙들고, `ops_staff_tournament_id_staff_id_key UNIQUE(tournament_id, staff_id)`(`baseline:11087`) 가 그 1:1 을 고정하기 때문이다. 다일 공고에서 8/10 대회를 운영하는데 8/12 행에 출근이 찍힌다.

**해석 키:** `work_logs.job_posting_id = ops_tournaments.job_posting_id` AND `staff_id` AND `date = ops_tournaments.event_date`.

**fail-closed 사유 코드** (자동 추측 금지 — 애매하면 아무것도 안 한다):

| 사유 | 조건 | 근거 |
|---|---|---|
| `no_event_date` | `ops_tournaments.event_date IS NULL` | 컬럼이 nullable 이다 (`baseline:10407`) |
| `no_posting` | `job_posting_id IS NULL` | 공고 미연결 대회 |
| `not_linked` | `ops_staff.source='manual'` 등 대응 행 없음 | 결정 1 트레이드오프 |
| `ambiguous` | 같은 (posting, staff, date) 에 **2건 이상** | 🔴 `work_logs` 에 (job_posting_id, staff_id, date) **UNIQUE 제약이 없다** — 실측. 같은 날 복수 시간대가 가능하다. 임의 1건을 고르면 절반의 확률로 오답이므로 **거부하고 사람에게 넘긴다** |
| `settled` | `payroll_status='completed'` | 결정 3 의 서버 가드를 UI 가 미리 알도록 |

`date` 는 **text** 타입이다(`baseline:3863`) — `event_date`(date)를 비교할 때 `to_char(event_date,'YYYY-MM-DD')` 로 문자열 정규화한다. 클라 `opsEventDate.ts` 의 형식 계약(`YYYY-MM-DD`)과 동일.

### 결정 3 — 쓰기는 기존 `update_work_log_slot` 재사용 (신규 쓰기 RPC 없음)

🔴 **가장 위험한 오답을 여기서 차단한다.** ops 훅에서 `supabase.from('work_logs').update({check_in_ts})` 를 그냥 쓰면 **통과한다** — `work_logs_payroll_direct_write_block`(`20260805120000`)의 판별식은 payroll 4컬럼 변경 여부만 보고(`:90-97`), `check_in_ts`/`check_out_ts` 는 판별 대상이 아니다. RLS `wl_update` 는 employer 직접 PATCH 를 허용한다. 즉 **감사·이력·알림·정산동결을 전부 우회한 잘못된 구현이 조용히 성공한다.**

기존 RPC 경유로 상속하는 계약:

| 계약 | 위치 |
|---|---|
| 정산 완료 동결 (실적 축 한정) | `20260808120000:362-364` `ALREADY_SETTLED` |
| 퇴근 > 출근 순서 검증 (등호도 거부) | `:394-400` |
| 상태 파생 (`checked_in`/`checked_out`) | `:404-420` |
| `modification_history` append (FOR UPDATE 스냅샷 → Lost Update 안전) | `:422-448` |
| `end_time_source` 되돌림 (`checkOut:null` → NULL) | `:516-521` |
| 알림 병합 (예정+실적 한 UPDATE = 1통) | `20260806120000` |

호출부는 **이미 존재한다** — `WorkLogRepositoryVenue.updateSlot`(`src/repositories/supabase/WorkLogRepositoryVenue.ts:195`, RPC 호출 `:260`)이 코드베이스 유일 호출 지점이다. ops 서비스는 이것을 재사용한다(신규 레포지토리 함수 없음, CLAUDE.md 아키텍처 준수).

`reason` 은 선택값이고 200자·XSS 검증을 받는다(`:259-263`). ops 는 `'ops 콘솔 근태 기록'` 을 싣는다.

### 결정 4 — 신규 함수는 해석기 1개

```
ops_resolve_staff_work_logs(p_tournament_id uuid, p_actor_id uuid)
  RETURNS TABLE(ops_staff_id uuid, staff_id uuid, work_log_id uuid,
                wl_status text, payroll_status text, reason text)
  LANGUAGE sql STABLE SECURITY DEFINER
  SET search_path TO 'public', 'pg_temp'
```

**왜 SECDEF 읽기 RPC 인가 — 평범한 SELECT 로는 안 되는 이유:** RLS 테이블에서 "0건" 은 "행이 없다" 가 아니라 **"안 보인다"** 일 수 있고, 에러도 경고도 뜨지 않는다. ops 축 권한자가 공고 축 권한이 없으면 평범한 조회는 조용히 빈 결과를 주고, UI 는 "근무 기록 없음" 이라는 **거짓 안내**를 띄운다. 해석기가 definer 로 실측한 뒤 `forbidden` 과 `not_linked` 를 **구분해서** 돌려줘야 한다.

**권한 (함정 5 — 축이 다르다):** 해석기는 `is_ops_member`(`baseline:3543-3561`, 대회 owner **또는** 연결공고 workspace 멤버)로 **입장**을 판정하되, 각 행의 `write_allowed` 는 `update_work_log_slot` 과 **똑같은 공고 축 술어**(`20260808120000:335-345` — owner_id / `is_workspace_member` / `is_posting_collaborator`)로 따로 판정한다. 🔴 **"ops 멤버면 통과" 로 완화하지 않는다** — 대회 owner 이지만 공고 워크스페이스 밖인 사용자가 실재하고, 완화하면 정산 권한 경계가 무너진다. 서버 쓰기 가드는 어차피 `update_work_log_slot` 이 재검증하므로, 해석기의 역할은 **UI 가 미리 알아 버튼을 숨기게 하는 것**뿐이다.

### 결정 5 — 일괄 write-back 을 만들지 않는다 (알림 폭발 방어)

`tr_notify_work_log_checkinout` 은 `AFTER UPDATE OF check_in_ts, check_out_ts ... FOR EACH ROW` 다(`baseline:12303`). **트리거를 새로 다는 게 아니라 잠든 트리거를 깨우는 형태**다.

실측이 예상보다 나쁘다 — `node scripts/graph-db-deps.mjs triggers` 출력상 `work_logs` **AFTER UPDATE 에 notify 트리거가 3개** 걸려 있다: `tr_notify_work_log_checkinout` · `work_log_notify_no_show_update` · `work_log_notify_update`. 딜러 20명 일괄 처리 = 최대 60회 트리거 발화.

**대응 = 억제가 아니라 범위.** 근태 캡처를 **스태프 1인 단위 액션**으로만 만든다. 1행 = 1알림은 **올바른 동작**이다(스태프는 자기 출근이 기록된 걸 알아야 한다). 일괄 버튼은 이 PR 범위 밖이며, 필요해지면 **알림 배칭 설계가 선행**돼야 한다. 배칭 없이 일괄 버튼만 먼저 만드는 것이 이 함정의 실제 발현 경로다.

### 결정 6 — `end_time_source` 제3값을 신설하지 않는다

두 가지 독립 근거로 기각한다.

1. **의미상 `'manual'` 이 맞다.** ops 근태는 운영자가 콘솔에서 버튼을 누르는 것이다. 자동 계측이 아니라 사람이 기록한 값이므로 `'manual'` 은 왜곡이 아니라 사실이다.
2. **제3값을 넣어도 배지가 안 바뀐다.** 표시 판정은 `end_time_source` 가 아니라 **`modification_history` 를 먼저 본다** — "수정 이력이 그 시간축을 건드렸으면 출처가 무엇이라 적혀 있든 '수정됨'"(`src/shared/time/timeProvenance.ts:16-18`, 판정 우선순위 `:60`). `update_work_log_slot` 은 실적을 쓸 때 반드시 이력을 append 하므로, 제3값을 만들어도 화면은 여전히 '수정됨' 이다. 비용만 남고 효과가 0이다.

(참고: `end_time_source` 에 **CHECK 제약이 없다** — 실측. 값 2종은 관례이지 스키마 강제가 아니다. 그래서 "제약을 못 고쳐서" 가 아니라 위 두 근거로 기각하는 것이다.)

### 결정 7 — 되돌리기 경로는 같은 PR 에, 그리고 이미 존재한다

**편도 문 금지**(`wiki/sources/settlement-rpc-wave-2026-08.md:21-28`): write-back → `checked_out` 파생 → 정산 게이트 통과가 자동으로 이어지므로, 밀어 넣는 액션만 만들면 오조작이 곧 확정이 된다.

다행히 서버는 이미 되돌릴 수 있다. `update_work_log_slot` 의 3상 계약 — **키 없음=미변경 / JSON null=삭제 / 값=기록** — 이 `checkIn: null`·`checkOut: null` 을 지원하고, `checkOut: null` 은 `end_time_source` 까지 NULL 로 되돌린다(`20260808120000:516-521`). 출근 시각을 지우면 상태도 `scheduled` 로 강등된다(`:415-420`).

→ **서버 작업 없음. ops UI 에 "기록 취소" 를 같은 PR 에서 노출**하기만 하면 된다.

---

## 3. 함정 10종 대응표

| # | 함정 | 대응 | 위치 |
|---|---|---|---|
| 1 | import 단방향 계약 (`baseline:6962`) | import 함수는 **손대지 않는다**. write-back 은 별도 경로 | 결정 3 |
| 2 | `payroll_status='completed'` 동결은 출퇴근 축에만 | RPC 재사용으로 상속 + 해석기가 `settled` 를 미리 알림 | 결정 3·4 |
| 3 | 소프트 취소 필터 | 해석기가 import 와 **동일 필터** `status NOT IN ('cancelled','no_show')` 적용 | 결정 2 |
| 4 | 직접 PATCH 가 뚫린다 | ops 는 raw PATCH 를 **쓰지 않는다**. RPC 전용 + pgTAP 로 핀 | 결정 3 |
| 5 | 권한 축이 다르다 | 해석기는 `is_ops_member` 로 입장, `write_allowed` 는 **공고 축**으로 별도 판정. 완화 없음 | 결정 4 |
| 6 | 카디널리티 (`DISTINCT ON` 1건) | `source_work_log_id` **미사용**. event_date 로 해석 | 결정 2 |
| 7 | 취소 행에 시간만 박힌다 | 해석기에서 제외 (**아래 ⚠️ 참조**) | 결정 2 |
| 8 | 알림 폭발 (FOR EACH ROW ×3) | 일괄 액션 **미구현**. 1인 단위만 | 결정 5 |
| 9 | provenance 왜곡 | 제3값 기각 — 의미상 manual 이 맞고, 배지는 이력 우선이라 안 바뀜 | 결정 6 |
| 10 | 편도 문 | 되돌리기 이미 서버 지원 → UI 노출을 같은 PR 에 | 결정 7 |

### ⚠️ 함정 7 — `update_work_log_slot` 에 거부 가드를 넣지 않는 이유 (증거)

"취소 행에는 아예 시간을 못 쓰게 서버를 조이자" 가 자연스러운 반응이지만, **기존 pgTAP 이 그 반대를 의도적으로 핀하고 있다**:

```
supabase/tests/work_log_slot_attendance_rpc.test.sql:220-231
-- 11) 노쇼는 상태 파생에서 제외
PERFORM public.update_work_log_slot(..., jsonb_build_object('checkIn', '...', 'reason', '기록 보정'));
SELECT is(..., 'no_show|true', '노쇼는 시각을 기록해도 상태가 뒤집히지 않는다');
```

노쇼 행에 시각을 남기는 것은 **"기록 보정" 이라는 정당한 용례**로 이미 계약에 박혀 있다. 서버에 거부 가드를 넣으면 이 테스트가 깨지고 기존 계약이 파괴된다(PR#420 과 동형의 사고 — 쓰기 채널을 좁혀 기존 pgTAP 을 깬 건). **따라서 방어는 해석기(=ops 가 그 행을 타깃으로 잡지 못하게)에서만 한다.**

---

## 4. 마이그레이션 계획

배정 슬롯 2개 중 **1개만 사용**한다.

| 파일 | 내용 |
|---|---|
| `20260809110000_ops_resolve_staff_work_logs.sql` | 해석기 RPC 신설 + `REVOKE ... FROM PUBLIC, anon` + `GRANT EXECUTE TO authenticated` (prod 하드닝 관례 `20260731090000` 정합) |
| ~~`20260809120000_`~~ | **미사용** (예비 슬롯 반납) |

기존 마이그레이션 파일은 **수정하지 않는다**. `update_work_log_slot` 도 그대로 둔다.

## 5. 파리티 영향

함수 **206 → 207** (해석기 1개 신설) · 정책 **111 불변** (테이블·RLS 미변경).

`supabase/tests/parity_baseline_guard.test.sql` **두 곳 동시 갱신** — 기계용 마커 `:155` `PARITY_EXPECT_FUNCS=206` 과 단언 리터럴 `:176` 은 별개다. 한쪽만 고치면 `.github/workflows/parity-smoke.yml` 의 prod 대조와 로컬 pgTAP 이 어긋난다.

## 6. 테스트 계획

**신설** `supabase/tests/ops_staff_work_log_resolve.test.sql`:
- 정상 해석 1건
- `no_event_date` / `not_linked` / `ambiguous`(같은 날 2행) / `settled` / 취소·노쇼 제외
- 🔴 **권한 경계**: 대회 owner 이지만 공고 워크스페이스 밖 → `write_allowed=false` (함정 5 회귀 가드)
- 🔴 단언은 **행이 보이는 역할**에서 수행한다 — RLS 테이블의 "0건" 은 "안 보인다" 일 수 있다

**기존 회귀 확인 (쓰기 채널 불변이므로 깨질 이유는 없으나 실행으로 확인):** `work_log_slot_attendance_rpc` · `work_log_slot_sync_rpc` · `settlement_settle_rpcs` · `settlement_payroll_status_rpc` · `work_logs_payroll_pin` · `worklog_settled_custom_lock` · `ops_staff_link_import` · `ops_staff_schema` · `ops_staff_security` · `parity_baseline_guard`.

## 7. 명시적 범위 밖

- **일괄 근태 처리** — 알림 배칭 설계 선행 필요 (결정 5)
- **`source='manual'` ops 스태프의 근태** — 대응 work_log 부재 (결정 1)
- **`ambiguous` 자동 해소** — 같은 날 복수 시간대 선택 UI. 이번엔 fail-closed
- **`update_work_log_slot` 수정** — 기존 계약 보존 (함정 7 ⚠️)
- 돈-흐름(바이인·상금) — `wiki/decisions/ops-no-money-flow.md`. 스태프 인건비는 금지 대상이 아니므로 이 작업은 저촉되지 않는다
