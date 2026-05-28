# 공고 자동마감 — 인원마감 자동전환 + reopen 가드 (Approach B) 설계

**상태**: Draft (autoplan CEO 리뷰 반영, pivot 후)
**작성일**: 2026-05-28 (v1: Approach A) → 2026-05-29 (v2: Approach B)
**Supersedes**: 동일 파일 v1 (Approach A — derived effective_status VIEW)
**작성자**: Codex via brainstorming → eng-review → autoplan CEO

**관련 메모리**:

- `pitfall_posting_role_filled_dead_counter` (인원 카운터 dead 이슈, PR #139)
- `project_schedule_counter_unification_sp2_sp3` (SP2/SP3 카운터 통일, prod 적용 미push)
- `project_target_market_pivot` (타깃 = 홀덤펍 사장 + 대회사 운영팀, 2026-05-28)

---

## 0. 변경 이력 — 왜 v1(접근 A) 에서 v2(접근 B) 로 바뀌었나

| 항목              | v1 (Approach A)                    | v2 (Approach B)                     |
| ----------------- | ---------------------------------- | ----------------------------------- |
| 핵심 아이디어     | status = 의도 / VIEW = 사실 분리   | status enum 확장 + reopen 가드 강화 |
| 마이그레이션 수   | 10~13개                            | 3개                                 |
| 인간 시간 추정    | ~5일                               | ~8시간                              |
| CC 시간 추정      | ~3시간                             | ~70분                               |
| 다루는 충돌       | ①②③④ + dangling 가드 + race window | ① reopen 가드 + ④ 인원마감 비대칭   |
| 자동 재노출 (UC2) | 유지 ✅                            | 유지 ✅                             |

### Pivot 근거 (autoplan CEO subagent + 사용자 결정)

CEO 단일 보이스(Claude subagent, Codex 모델 호환성 fail) 가 4가지 critical을 raised:

1. **우선순위 (#1)** — prod 2건 pre-launch 상태에서 5일 짜리 구조 리팩토링은 premature optimization. 같은 6주간 SP1/SP2/SP3 등 5회 연속 schema refactor.
2. **untested premise (#2)** — auto-reopen이 사장 의도와 충돌 가능성, 검증 안 됨.
3. **scaling cliff (#3)** — VIEW의 `compute_effective_status(NOW())` 가 partial index 무효화 (EXPLAIN 검증 완료, prod에서 Seq Scan + Filter 확인).
4. **시장 표준 (#5)** — 알바몬/알바천국 등 한국 staffing 표준은 simple status, derived state 차별점 없음.

**사용자 결정** (autoplan UC1=B, UC2=A, UC3=A, UC4=B):

- UC1 → Approach B로 축소
- UC2 → 자동 재노출은 유지 (브레인스토밍 결정 보존)
- UC3 → effective_status 같은 derived 분리는 over-engineering, 사용자에게 노출 안 함
- UC4 → spec 재설계

v1(Approach A) 내용은 본 spec 끝 부록 A에 "deferred — launch 후 100+ 공고 시 재검토" 로 보존.

---

## 1. 다루는 범위

### ✅ 이번 PR 범위

- **충돌 ①** — `cancel_application_atomically:200` 의 reopen CASE가 `closed_reason` 무관하게 closed→active 복귀. 구인자 수동 마감 의도 무시.
- **충돌 ④** — 인원 정원 도달해도 status='active' 유지 → UI에 active로 노출되는데 confirm은 실패하는 UX 모순.

### ❌ 이번 PR 범위 밖 (TODOS 또는 deferred)

- **충돌 ③** (cron race window) — prod 2건에서 race 발생 가능성 0. 시장 표준 대비 차별점 없음. 향후 공고 100+/day 도달 시 재검토.
- **충돌 ② 영구 해소** — SP3 후속 `20260525190100_rpc_drop_manual_filled.sql` 에서 이미 처리됨.
- **VIEW + 헬퍼 함수 + 알림 인프라 전면 교체** — 부록 A 참조. paused/archived 같은 신규 상태 도입 시 재검토.
- **OG 메시지 분기 세분화** — 현재 status='closed' 단일 메시지 유지. closed_reason 별 분기는 별도 PR.

---

## 2. 설계 — 3 마이그레이션

### M1 — `posting_status` enum 에 `capacity_full` 추가

```sql
ALTER TYPE posting_status ADD VALUE IF NOT EXISTS 'capacity_full' AFTER 'active';
```

**의미**: "정원 도달로 자동 마감되었으나 빈자리 생기면 자동 복귀 대기 중" 상태. closed/cancelled 와 구분.

### M2 — 인원마감 자동 전이 (`fn_update_job_posting_stats` 확장)

기존 trigger 가 `filled_positions` 만 갱신하던 부분 끝에 status 자동 전이 추가:

```sql
-- 트리거 본문 끝부분 (UPDATE job_postings ... 직후)
-- 자동 전이: active → capacity_full → active
UPDATE public.job_postings jp
SET status = CASE
      -- 정원 도달 → capacity_full
      WHEN jp.status = 'active'
       AND jp.total_positions > 0
       AND jp.filled_positions >= jp.total_positions
       THEN 'capacity_full'::posting_status
      -- 빈자리 생김 → active 복귀
      WHEN jp.status = 'capacity_full'
       AND jp.filled_positions < jp.total_positions
       THEN 'active'::posting_status
      ELSE jp.status
    END,
    updated_at = CASE
      WHEN (jp.status = 'active' AND jp.filled_positions >= jp.total_positions AND jp.total_positions > 0)
        OR (jp.status = 'capacity_full' AND jp.filled_positions < jp.total_positions)
      THEN now() ELSE jp.updated_at
    END
WHERE jp.id = v_job_posting_id;
```

**전이 매트릭스**:
| 기존 status | filled 변화 | total | 새 status |
|---|---|---|---|
| active | ↑ filled >= total | total > 0 | capacity_full |
| capacity_full | ↓ filled < total | total > 0 | active |
| closed | (모든 변화) | — | closed (불변, 의도 보존) |
| cancelled | (모든 변화) | — | cancelled (불변) |
| draft | (모든 변화) | — | draft (불변) |

### M3 — `cancel_application_atomically` reopen 가드 강화

기존 `20260525190100:200` 의 CASE:

```sql
status = CASE WHEN status = 'closed' AND filled_positions < total_positions THEN 'active' ELSE status END
```

→ 변경:

```sql
status = CASE
  -- capacity_full → active (자동 재노출, UC2=A 유지)
  WHEN status = 'capacity_full' AND filled_positions < total_positions THEN 'active'::posting_status
  -- 구인자 수동 마감(manual) 또는 삭제(owner_deleted)는 reopen 안 함
  WHEN status = 'closed' THEN 'closed'::posting_status
  ELSE status
END
```

이제 cancel 시 status 결정 단순:

- `capacity_full` 이면 → `active` (재노출)
- `closed` 면 → `closed` 유지 (의도 보존, dangling 가드 해소)
- `manual` / `owner_deleted` / `expired` 등 모든 closed_reason 일관 처리

`substitute_feature.sql:134` 의 가드 패턴과 동일 의도, 이제 cancel 경로에도 적용.

### M2 + M3 상호작용

- cancel 시 application status 변경 → `fn_update_job_posting_stats` 트리거 발화 → filled_positions 감소 → 자동 capacity_full→active 전이 (M2)
- M3의 cancel RPC 수동 status 변경은 capacity_full→active 만 처리 (M2와 idempotent)
- 둘 다 같은 결과 도달 (멱등성, GREATEST(0, ...) 가드 활용)

---

## 3. 마이그레이션 단계 (실행 순서)

prod 데이터 2건이라 마이그레이션 위험 극소.

| 단계          | 작업                                                                  | 비고                              |
| ------------- | --------------------------------------------------------------------- | --------------------------------- |
| M1            | `posting_status` enum 에 `capacity_full` 추가                         | `ADD VALUE IF NOT EXISTS`, 멱등   |
| M2            | `fn_update_job_posting_stats` 트리거 확장 (capacity_full 자동 전이)   | `CREATE OR REPLACE FUNCTION`      |
| M3            | `cancel_application_atomically` reopen CASE 보강 (closed_reason 가드) | `CREATE OR REPLACE FUNCTION`      |
| (optional) M4 | 백필: 이미 정원 도달한 active 공고를 capacity_full 로 일괄 전환       | prod 0건 → no-op. 멱등 UPDATE 1회 |

---

## 4. 클라이언트 변경 (최소)

| 영역                                     | 변경                                                                          |
| ---------------------------------------- | ----------------------------------------------------------------------------- |
| `JobPostingRepository.getList` 디폴트    | `status='active'` (변경 없음). capacity_full은 별도 toggle                    |
| `JobPostingRepository.getList` 필터 옵션 | 회색 처리 보여주려면 `.in('status', ['active', 'capacity_full'])` 호출 가능   |
| `JobPostingRepository.getById`           | 변경 없음 (모든 status 반환)                                                  |
| `JobPostingRepository.closePosting`      | 변경 없음 (`status='closed'`, `closed_reason='manual'`)                       |
| `src/domains/job-posting/facts.ts`       | `postingFull` 로컬 derived 로직 제거 → `status === 'capacity_full'` 직접 비교 |
| `src/domains/job-posting/types.ts`       | `JobPostingStatus` union 에 `'capacity_full'` 추가                            |
| `STATUS.JOB_POSTING` 상수                | `CAPACITY_FULL: 'capacity_full'` 추가                                         |
| Supabase TypeScript types                | `npm run db:gen-types` 재생성 후 status enum 확장 반영                        |

UI 표시 가이드:

- `status === 'capacity_full'` → 카드 회색 처리 + "정원 마감" 라벨 (apply 버튼 비활성)
- `status === 'closed'` → 카드 숨김(목록) / "구인자가 마감" 메시지(상세)
- `status === 'active'` → 정상 노출

---

## 5. 테스트 전략

### pgTAP — M2 자동 전이

1. `status='active'`, filled=2, total=3, applications 1건 confirm → filled=3, status='capacity_full' 자동 전이
2. `status='capacity_full'`, filled=3, total=3, 1건 cancel → filled=2, status='active' 자동 복귀
3. `status='closed'`, closed_reason='manual', filled=3, total=3, 1건 cancel → filled=2, **status='closed' 유지** (의도 보존)
4. `status='closed'`, closed_reason='expired', filled=3, total=3, 1건 cancel → filled=2, **status='closed' 유지** (cron 만료 의도)
5. `status='draft'` → 어떤 변화도 status 불변

### pgTAP — M3 reopen 가드

1. `status='capacity_full'`, 1건 cancel → `cancel_application_atomically` 반환에 new_status='active' 포함
2. `status='closed', closed_reason='manual'`, 1건 cancel → `cancel_application_atomically` 반환에 new_status='closed' (M3 가드)

### disabled 테스트 부활

`supabase/tests/cancel_application_expired_guard.test.sql.disabled` → 활성화. S1(manual), S2(expired), S3(expired_by_work_date) 시나리오가 이제 모두 작동 (M3 가드).

### e2e — capacity_full ↔ active 회복

1. 정원 N=2 공고에 2명 confirm → 목록에서 capacity_full 카드 회색 처리
2. 1명 취소 → 목록 카드 다시 active 색상
3. apply 가능 상태 복귀

### 회귀 가드

`supabase/tests/posting_role_filled_dead_counter.test.sql` 와 SP2+SP3 기존 테스트 모두 통과 확인.

---

## 6. 영향 분석

### 자동 재노출 정책 (UC2=A 유지)

- capacity_full → active 자동 복귀는 트리거 기반, 즉시 반영
- 구인자가 "정원 채워서 안심" 상태에서 1명 취소되면 자동 다른 staff 가 채울 수 있는 상태
- 사장 입장에서 surprise 가능성 인지 (subagent #2 지적). launch 후 5명 인터뷰로 검증 예정 → TODOS 항목

### 시장 표준 정합 (UC3=A)

- `posting_status` enum {draft, active, closed, cancelled, capacity_full} 5개. 알바몬류 simple status + 1개 추가.
- UI는 active / capacity_full / closed 3가지 시각 구분만 사용자에게 노출
- "effective_status" 같은 derived 용어는 코드에 없음 → 시장 표준 정합

### 알림 (변경 없음)

- 기존 `notify_on_job_posting_owner_expired` 트리거 그대로 동작 (cron이 status='closed' 변경 시 발송)
- capacity_full 은 별도 알림 없음 (사장이 admin/대시보드에서 즉시 인지 가능)

---

## 7. 롤백 전략

문제 발생 시:

1. M3 → M2 → M1 역순
2. M1 (enum 추가) 은 ALTER TYPE으로 자동 롤백 불가 → 새 마이그레이션으로 capacity_full 사용 row 를 active 로 일괄 변경 후 enum 그대로 두면 안전 (잔재 enum 값은 무해)
3. trigger / RPC 는 CREATE OR REPLACE 로 이전 버전 복원

prod 데이터 2건 + 멱등 마이그레이션이라 롤백 risk 거의 0.

---

## 8. NOT in scope

- VIEW + 헬퍼 함수 (`compute_effective_status`) — 부록 A의 Approach A 내용. 향후 공고 100+/day 또는 paused/archived 상태 추가 시 재검토.
- cron jobs 제거 — 시간/날짜 만료 cron 2개 유지 (race 무영향).
- 알림 인프라 교체 (`*_notified_at` 컬럼 도입) — 현재 트리거 기반 알림이 정상 동작 중. 변경 불필요.
- OG 메시지 분기 세분화 — 별도 PR.
- 이벤트 소싱 / state transition 감사 로그 — 별도 spec.
- 관리자 화면 capacity_full 필터 UI — 별도 admin spec.

---

## 9. Implementation Tasks (v2)

- [ ] **T1 (P1, human: ~2h / CC: ~15min)** — DB enum 확장
  - Surfaced by: 충돌 ④ + UC1 결정
  - Files: `supabase/migrations/20260529_M1_posting_status_capacity_full.sql`
  - Verify: `SELECT unnest(enum_range(NULL::posting_status))` 에 `capacity_full` 포함

- [ ] **T2 (P1, human: ~1h / CC: ~10min)** — `fn_update_job_posting_stats` 트리거 확장
  - Surfaced by: 충돌 ④ 자동 전이 구현
  - Files: `supabase/migrations/20260529_M2_trigger_capacity_full_transition.sql`
  - Verify: pgTAP 자동 전이 5개 시나리오

- [ ] **T3 (P1, human: ~1h / CC: ~10min)** — `cancel_application_atomically` reopen 가드
  - Surfaced by: 충돌 ① + disabled 테스트 dangling 가드
  - Files: `supabase/migrations/20260529_M3_cancel_reopen_guard.sql`
  - Verify: pgTAP — closed_reason='manual' 유지, capacity_full→active 복귀

- [ ] **T4 (P1, human: ~1h / CC: ~10min)** — 클라이언트 타입/로직 보정
  - Surfaced by: 섹션 4
  - Files: `src/domains/job-posting/types.ts`, `src/domains/job-posting/facts.ts`, `src/constants/status.ts`, types 재생성
  - Verify: `npm run quality` exit 0

- [ ] **T5 (P1, human: ~2h / CC: ~15min)** — pgTAP 테스트 추가 + disabled 부활
  - Surfaced by: 섹션 5
  - Files: `supabase/tests/capacity_full_transition.test.sql` (신규), `cancel_application_expired_guard.test.sql.disabled` → 활성
  - Verify: `supabase test db` 모두 pass

- [ ] **T6 (P2, human: ~1h / CC: ~10min)** — e2e 시나리오 추가
  - Surfaced by: 섹션 5 (e2e)
  - Files: `e2e/tests/p2-medium/posting-capacity-recovery.spec.ts`
  - Verify: Playwright run pass

- [ ] **T7 (P2, human: ~30min / CC: ~5min)** — UI 회색 처리 + 라벨
  - Surfaced by: 섹션 4 (UI 표시 가이드)
  - Files: 공고 카드/상세 화면에 `status='capacity_full'` 케이스 추가
  - Verify: 수동 dev 서버 확인

**Total**: ~8h human / ~75min CC. v1 (Approach A) 대비 80% 단축.

---

## 10. TODOS 명시 (deferred)

| 항목                           | 조건 / 시점                                          | 메모                                      |
| ------------------------------ | ---------------------------------------------------- | ----------------------------------------- |
| 자동 재노출 UX 검증            | 사장 5명 인터뷰                                      | subagent #2 지적, launch 후 즉시          |
| VIEW + 헬퍼 함수 (부록 A)      | 공고 100+/day 도달 또는 paused/archived 추가 필요 시 | 본 spec 부록 A 내용 그대로 활용 가능      |
| cron race window 제거          | 공고 1000+ 도달 시                                   | 현재 race 무영향                          |
| OG 메시지 분기 (closed_reason) | UC3 재검토 시                                        | 사용자에게 derived 노출 의향 있을 때만    |
| 관리자 화면 capacity_full 필터 | admin spec 작성 시                                   |                                           |
| paused / archived 상태 도입    | lifecycle 확장 요구 시                               | 신규 spec, 본 spec 의 enum 확장 패턴 참고 |

---

## 부록 A — Approach A (deferred, launch 후 재검토)

v1에 작성된 derived `effective_status` VIEW + 헬퍼 함수 + 마이그레이션 10단계 + 알림 인프라 교체 + partial index 등 모든 설계. autoplan CEO 리뷰 결과 pre-launch 시점에서 premature optimization 으로 deferred. 다음 조건 만족 시 재검토:

1. prod 공고 100+/day 도달 또는 active 공고 1000+
2. 신규 `posting_status` 값 추가 필요성 발생 (`paused`, `archived`, `draft_review` 등)
3. cron race window가 실제 사용자 컴플레인 발생

재검토 시 본 PR (Approach B) 의 마이그레이션 위에 추가 적용 가능. enum의 `capacity_full` 은 VIEW의 `effective_status='capacity_full'` 분기와 의미 일치하므로 호환됨.

v1 spec 전체는 git history 에서 복원 (`git show 2c3bf9c72:uniqn-mobile/docs/superpowers/specs/2026-05-28-job-posting-auto-close-design.md`).

---

## GSTACK REVIEW REPORT

| Review        | Trigger                            | Why                             | Runs                 | Status                    | Findings                                                               |
| ------------- | ---------------------------------- | ------------------------------- | -------------------- | ------------------------- | ---------------------------------------------------------------------- |
| Eng Review    | `/plan-eng-review`                 | Architecture & tests (required) | 1                    | CLEAR (PLAN)              | v1 7건 처리됨. v2 pivot 후 마이그레이션 7→3개 단축, 동일 패턴 유지     |
| CEO Review    | `/plan-ceo-review` via `/autoplan` | Scope & strategy                | 1                    | CLEAR (PLAN via autoplan) | 4 critical raised (subagent-only), 4 User Challenges 사용자 결정 완료  |
| Codex Review  | `/codex review`                    | Independent 2nd opinion         | 0 (모델 호환성 fail) | —                         | ChatGPT 계정 + Codex CLI v0.117 호환성 이슈. fallback to subagent-only |
| Design Review | `/plan-design-review`              | UI/UX gaps                      | 0                    | skipped                   | UI 변경 최소 (회색 처리만), skip                                       |
| DX Review     | `/plan-devex-review`               | Developer experience gaps       | 0                    | skipped                   | 내부 인프라, 공개 API/CLI/SDK 없음, skip                               |

**Pivot 결정**:

- v1(Approach A, derived VIEW + 헬퍼 함수, 7~13 마이그레이션) → v2(Approach B, status enum + reopen 가드, 3 마이그레이션)
- 트리거: autoplan CEO subagent 5건 critical (우선순위/premise/scaling cliff/dismissed alternative/시장 차별점)
- 사용자 결정 (UC1=B + UC2=A + UC3=A + UC4=B): 자동 재노출은 유지하되 구조 리팩토링은 launch 후로 보류

**CRITICAL TECHNICAL FIX (CEO subagent #3)**:

- v1 partial index가 무효 (`compute_effective_status(...) = 'active'` 함수 inline 실패, EXPLAIN 검증 완료)
- v2에서는 불필요 (VIEW 미사용)

**UNRESOLVED**:

- 0 (모든 finding 처리 완료)

**CRITICAL GAPS**:

- 0 (v1의 알림 인프라 race window는 prod 2건 컨텍스트에서 무영향)

**TODOS 보류** (5건):

- 자동 재노출 UX 검증 (사장 5명 인터뷰, launch 후)
- VIEW + 헬퍼 함수 (공고 100+/day 도달 시)
- cron race window (공고 1000+ 도달 시)
- OG 메시지 분기 세분화 (UC3 재검토 시)
- 관리자 capacity_full 필터 UI (admin spec)

**VERDICT**: CEO + ENG CLEARED — Approach B 로 구현 시작 가능. T1~T7 P1+P2 순서 진행 권장.

**Cross-phase 테마**: 없음 — Eng와 CEO 가 같은 차원에서 충돌하지 않음. Eng는 v1 내 정합성, CEO는 v1 자체의 scope/timing.

**다음 단계 권장**:

1. T1~T5 (P1) 즉시 구현 시작
2. T6~T7 (P2) follow-up
3. launch 후 사장 5명 인터뷰로 UC2(자동 재노출) UX 검증
4. 공고 수 100+/day 도달 시 부록 A (Approach A) 재검토
