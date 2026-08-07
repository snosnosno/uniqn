# ops 완성도 결함 ②~⑦ + prod 미적용 마이그 — 다음 세션 착수 프롬프트 (2026-08-08)

> 상단 "프롬프트" 블록만 복사해 새 세션에 붙여넣으면 된다.
> 선행: 결함① 칩 카운트 ✅ **#438 `28d925824`** 머지·prod 적용 완료 — 아래 §0.

---

## 프롬프트 (복사해서 새 세션에 붙여넣기)

```
대회운영(ops) 엔진의 남은 완성도 결함을 닫고, prod 미적용 마이그 1건을 적용한다.

배경: 엔진은 서버 RPC 43종·콘솔 탭 7종·실시간 8테이블까지 만들어져 있으나
프로덕션 플래그(app_config.ops_hub_enabled)가 OFF 이고 실사용이 사실상 0이다.
"기능을 더 만드는" 문제가 아니라 "라이브 운영 루프의 구멍을 막고 켤 수 있는
상태로 만드는" 문제다. 결함①(칩 카운트)은 #438 로 닫혔다.

먼저 두 문서를 읽어라.
- docs/planning/2026-08-08-ops-defects-2-7-handoff.md  ← 이 문서(최신 상태·트랙)
- docs/planning/2026-08-07-ops-completeness-defects-handoff.md  ← 결함 원증거(§2)

착수 규칙:
- 전용 워크트리에서 작업한다. 메인 체크아웃은 읽기·계획 전용.
- 트랙 A(결함 ④ → ② → ③ → ⑤ → ⑥)와 트랙 B(prod 마이그 적용)는 독립이다.
  가장 싼 ④부터. ⑦은 범위 결정이라 ②~④ 를 닫기 전에는 착수하지 마라.
- 새 RPC 는 기존 ops SECDEF 규약을 따른다(actor 바인딩 → 값 검증 → 행 FOR UPDATE →
  is_ops_member → 상태 게이트 → P0001 → ops_events append → anon 명시 REVOKE).
  규약 전문 = wiki/architecture/ops-engine.md, 최신 실례 =
  supabase/migrations/20260807210000_ops_set_participant_chips.sql
- 마이그 파일 접두사는 짓기 전에 `git fetch` 후 origin/master 의 같은 날짜 접두사를
  확인하라. 파일명이 달라도 접두사가 같으면 CI 의 신선한 db reset 에서만 죽는다.
- 완료 주장 전에 이 세션에서 실행한 검증 출력을 제시한다.

먼저 착수할 결함의 수정 설계를 제시하고 승인을 받은 뒤 구현하라.
```

---

## §0. 결함① 착지 (2026-08-08, 중복 착수 금지)

**PR #438 → master `28d925824`** (squash). 워크트리·브랜치 정리 완료.

| 산출물 | 내용 |
|---|---|
| `ops_set_participant_chips(uuid, uuid, integer)` | SECDEF RPC. active+checked_in / 1~20억 / 동일값 no-op / `player_chips_set` 이벤트 |
| `ChipCountSheet.tsx` | `OpsParticipantActionSheet` 진입점. 저장 전 증감 델타 표시 |
| pgTAP `ops_set_participant_chips.test.sql` | 19항목 |

🔴 **prod 기록명 `20260807144558`(enum) · `20260807144632`(RPC) — 재적용 금지.**
레포 파일 접두사는 `20260807200000`/`210000` 로 **다르다**(#436 과 `190000` 충돌해 리네임).

부수 수확: `checked_in` 참가자는 그동안 **액션시트가 완전히 비어 있었다**(`active`/`busted` 분기만 존재). 칩 카운트가 그 자리의 첫 액션이다 — ②를 설계할 때 이 시트에 자리가 있다.

---

## §1. 확인된 사실 (2026-08-08 실측)

| 항목 | 값 | 근거 |
|---|---|---|
| prod 플래그 | `ops_hub_enabled = {"enabled": false}` | `app_config` 조회 |
| prod 실사용 | 대회 1 · 참가자 1 · 이벤트 2 · 테이블 1 · 스태프 0 · 상금 0 · 프리셋 0 | 카운트 쿼리(08-07) |
| prod 함수/정책 | **201 / 111** | `pg_proc`·`pg_policies` |
| repo·CI 기대값 | **202 / 111** | `parity_baseline_guard.test.sql` |
| anon 실행가능 ops SECDEF | **2** (`ops_get_monitor_snapshot`·`ops_get_player_view`) | 불변 계약 |
| `ops_event_type` | **32값** (`player_chips_set` 포함) | `enum_range` |
| E2E | ops 스펙 **0건** | `e2e/` |

**201 vs 202 차이의 정체** = `update_work_log_custom_settlement`(S-D, #436) 가 **prod 미적용**. 트랙 B 가 이걸 닫으면 202/111 로 일치한다. 주간 `parity-smoke`(PR 게이트 아님)는 그때까지 불일치를 보고한다.

---

## §2. 트랙 A — 결함 ②~⑦

증거(파일:줄, prod 실측) 전문은 **`docs/planning/2026-08-07-ops-completeness-defects-handoff.md` §2**. 아래는 2026-08-08 재확인 결과와 착수 메모만.

### ④ 대회 날짜가 무검증 자유 텍스트 — MEDIUM, **여기부터** (가장 쌈)
- `src/schemas/opsTournament.schema.ts` — `eventDate: z.string().optional()` 가 **`:46` 과 `:58` 두 곳**(create/update 추정). 한 곳만 고치면 반쪽이다 ✅재확인
- `app/(ops)/tournaments/new.tsx:196-203` — TextInput 손입력
- `src/domains/ops/resume/selectResumeTournament.ts` — '오늘' 판정이 KST +9h 하드코딩, 앱 표준 `getTodayString()`(로컬)과 이원화

**결과**: "7/1" 로 저장돼도 성공하고, '이어서 운영' 카드는 정확 문자열 비교라 영영 안 뜬다 — **조용한 실패**.
해법: 앱에 이미 있는 `DatePickerModal` 로 교체 + 스키마 `YYYY-MM-DD` 강제 + KST 하드코딩 통일. DB 컬럼은 이미 `date` 타입이라 서버 변경 불필요.

### ② 노쇼 처리 경로가 없다 — HIGH
`ops_participant_status` 에 `no_show` 가 있으나 **이 값을 쓰는 RPC 가 0개**다. ✅재확인 — `no_show` 를 언급하는 ops 함수는 `ops_assign_seat`·`ops_redraw_waitlist_fill`·`ops_import_staff_from_posting` **3개뿐이고 전부 제외 필터**다.

착수 메모: 진입점은 `OpsParticipantActionSheet` 의 `checked_in` 구역(§0 참조 — 지금 칩 카운트 하나뿐이라 자리가 있다). `registered` 도 도달 불가인지 함께 판정해 enum 정리 여부를 결정하라.

### ③ 참가자 정정·삭제, 대회 삭제가 불가능 — HIGH
참가자 수정/삭제 RPC 없음(이름 오타조차 못 고친다) · 대회 delete RPC·UI 없음(테스트 대회가 목록에 영구 잔존 — prod 의 대회 1건이 그 사례로 보인다).
삭제 대신 `archived` 상태가 나을 수 있다 — `ops_events` 가 append-only 감사 로그라 CASCADE 삭제와 충돌하는지 **먼저 확인**하라.

### ⑤ `ops_unclaim_participant` 죽은 회로 — LOW
DB 에 있으나 클라 참조 **0건** ✅재확인(`src/`·`app/` grep, 생성 타입 제외). **배선하거나 제거하거나** 결정하라.

### ⑥ `(ops)` 라우트가 플래그를 안 본다 — 판단 필요
`app/(ops)/_layout.tsx` 는 **인증만 검사**한다 ✅재확인(`<Redirect href="/(auth)/login" />` 뿐). 플래그 OFF 인데 딥링크·직접 URL 로 아무 로그인 사용자나 진입 가능하다.
(a) 레이아웃에 플래그 게이트 추가 / (b) "라우트는 의도적으로 열려 있다"를 주석·문서로 확정 — **둘 중 하나를 명시 결정**하고 근거를 남겨라. wiki `ops-engine.md` 는 (b) 로 기술돼 있다("`(ops)` 라우트 자체는 플래그 무관하게 접근 가능 — 발견 표면만 게이트").

### ⑦ 통합 공백 — 범위 결정 (②~④ 전에는 착수 금지)
알림 연동 0건 · 근무기록/정산 write-back 0건(단방향 스냅샷 import 만) · 오프라인 내성 0 · E2E 0건.

---

## §3. 트랙 B — prod 미적용 마이그 1건

**대상**: `uniqn-mobile/supabase/migrations/20260807190000_update_work_log_custom_settlement_rpc.sql` (S-D, #436)

**적용 경로가 바뀌었다.** 손으로 SQL 을 옮겨 적는 `mcp__supabase__apply_migration` 대신, 다른 세션이 만든 **`.github/workflows/prod-migrate.yml`** 을 쓴다 — 러너가 레포를 체크아웃해 `psql -f` 로 **파일 바이트를 그대로** 싣는다(전사 0회 = 정본 분열 0).

```bash
gh workflow run prod-migrate.yml \
  -f migration=20260807190000_update_work_log_custom_settlement_rpc.sql \
  -f confirm=20260807190000_update_work_log_custom_settlement_rpc.sql \
  -f verify_function=update_work_log_custom_settlement
```

- `confirm` 은 `migration` 과 **글자 그대로 같아야** 진행한다.
- 이미 `schema_migrations` 에 있는 버전이면 **중단**한다(재적용 금지 기계 강제).
- `--single-transaction` — 중간 실패 시 전량 롤백.
- `verify_function` 을 주면 적용 전후 md5 를 찍고 **같으면 실패로 접는다**.
- ⚠️ `PROD_DB_URL` 시크릿이 없으면 skip 이 아니라 **실패**한다.

**적용 후 확인**: prod 함수 수가 **201 → 202** 가 되어 `parity_baseline_guard` 기대값과 일치하는지. 그 뒤 `parity-smoke` 를 `workflow_dispatch` 로 한 번 돌려 초록을 확인하면 트랙 B 종료.

---

## §4. 금지사항

- `mcp__supabase__*` 로 **기존 마이그레이션을 수정하지 마라**. 신규 마이그만 추가한다.
- prod 에 이미 적용된 마이그를 재적용하지 마라 — 착수 전 `list_migrations` 로 실측하라.
  ⚠️ **레포 파일명과 prod 기록명이 다른 건이 여럿이다**(칩 카운트 2건 포함). 파일명만 보고 판단 금지.
- ops 의 **anon 실행가능 SECDEF 는 정확히 2개**라는 불변 계약을 깨지 마라. 신규 함수는 PUBLIC/anon EXECUTE 를 상속하므로 **매번 명시 REVOKE**.
- 돈-흐름(바이인 결제·상금 지급 레일)에는 관여하지 마라 — `wiki/decisions/ops-no-money-flow.md`.
- 상수·enum·사용자 문구를 바꾸면 `e2e/` 를 **별도 grep** 하라(eslint ignores 라 `npm run quality` 범위 밖).

---

## §5. 검증 요건

- 신규 RPC 는 pgTAP 로 증명하라. ⚠️ RLS 테이블의 "0건"은 "행이 없다"가 아니라 "안 보인다"일 수 있다 — 단언은 행이 보이는 역할에서.
- 회귀 테스트는 **Red-Green** 을 확인하라(수정을 되돌리면 실패하는지). 결함① 에서 실제로 4종을 돌렸다.
- 완료 주장 전 `npm run quality` + 관련 jest/pgTAP 출력을 제시하라.
- ⚠️ 로컬 Docker 스택은 **병렬 세션과 공유**다. pgTAP 실패가 내 변경 때문인지 남의 마이그 때문인지 먼저 가려라(카탈로그 카운트가 어긋나면 `pg_proc` 를 oid 역순으로 훑어 출처를 특정).

---

## §6. 결함① 에서 값이 있었던 함정 2개 (다음 세션도 밟기 쉽다)

**1. 관용구를 복제할 때 원본의 전제까지 복제됐는지 봐라.**
`ChipCountSheet` 는 `PrizeCorrectSheet` 폼을 복제했는데, 원본은 **호출부가 state 객체를 넘겨 아이덴티티가 안정적**이라는 전제가 있었다. 새 진입점은 인라인 객체를 넘겨 그 전제를 깼고, `ops_participants` realtime invalidate → refetch → 상위 재렌더마다 시드 effect 가 재발화해 **입력 중이던 값이 스냅샷으로 되돌아갔다**. 되돌아간 값은 **zod 도 서버도 유효**해서 어느 방어층에도 안 걸린다.
→ 시트류에 프리필 effect 를 쓸 때 deps 는 **원시값**(`id`)으로. 선례 = `WorkLogEditSheet.tsx:243-255`.

**2. 카운트 가드는 숫자가 우연히 같으면 머지 충돌이 안 난다.**
`parity_baseline_guard` 에서 두 레인이 각각 함수를 +1 했는데 **양쪽 브랜치가 모두 기대값을 "201" 로 적어** 텍스트 충돌이 설명 문구 줄에서만 났고 **리터럴은 조용히 자동 병합**됐다. 합집합은 202 다.
→ 머지 후 리터럴·`PARITY_EXPECT_FUNCS` 마커·헤더 내러티브를 **재산정**하라. 충돌이 안 났다는 게 안전 신호가 아니다.

---

## §7. 참고 문서

- 결함 원증거: `docs/planning/2026-08-07-ops-completeness-defects-handoff.md`
- 엔진 구조·쓰기 경계·불변 계약: `wiki/architecture/ops-engine.md`
- 돈-흐름 경계 결정: `wiki/decisions/ops-no-money-flow.md`
- 전체 앱 감사(ops 항목 포함): `docs/analysis/2026-08-07-full-app-audit.md`
- 결함① 세션 기록: `memory/project_ops_chip_count_defect1_20260808.md`
