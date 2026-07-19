# 핸드오프 — `jpc_job_postings_rls` CI red 조사 + 검색 rate limit 후속 (다음 세션 메인 프롬프트)

> 작성: 2026-07-19 · 선행 작업: PR #273 머지(master `b832a9f75`)
> 우선순위: **A(CI red 조사) > B(후속 3건)**. A만 해도 세션 가치 충분.

---

## 0. 30초 컨텍스트

직전 세션에서 검색 닉네임 통일 + 서버 rate limit(#273)을 머지했다. 그 과정에서 **CI `DB Tests`가 계속 red**인 것을 발견했고, 조사 결과 두 종류가 섞여 있었다:

1. **내가 만든 회귀** — `check_rate_limit`의 `search_path`에서 `pg_temp` 유실. 발견 즉시 복구했고 `parity_baseline_guard.test.sql`이 green으로 돌아왔다. **해결됨.**
2. **선재 실패** — `jpc_job_postings_rls.test.sql`의 test 5·6·7. #273 이전부터 master에서 실패 중이었고 아직 **미해결**. 이번 세션의 A 과제다.

---

## A. `jpc_job_postings_rls` test 5-7 조사 [주 과제]

### 증상 (실측)

```
# Failed test 5: "job_postings INSERT: owner (employer 역할 게이트 통과)"
# Failed test 6: "job_postings INSERT: ws_editor (employer 역할 게이트 통과)"
# Failed test 7: "job_postings INSERT: collaborator (employer-tier 역할 게이트 통과)"
# Looks like you failed 3 tests of 16
Files=71, Tests=802 → Result: FAIL
```

- 파일: `uniqn-mobile/supabase/tests/jpc_job_postings_rls.test.sql` (단언 위치 L82·L98·L114 부근)
- 형태: 세 건 모두 `lives_ok(...)` INSERT — **성공해야 할 INSERT가 실패**하고 있다
- master 실패 런에서도 **글자까지 동일**하게 재현됨 (run `29675441993`)

### 이미 배제된 가설

- ❌ **#273(검색 rate limit) 탓** — `git diff origin/master...HEAD --name-only`에 jpc/job_postings/rls 파일 **0건**. 머지 전 master에서도 동일 실패.
- ❌ **일시적 러너 경합** — 서로 다른 커밋의 여러 런에서 같은 3건이 결정적으로 실패.

### 조사 착수점

INSERT 컬럼 목록이 단서다. 테스트는 이렇게 넣는다:

```sql
INSERT INTO public.job_postings (owner_id, owner_name, workspace_id, title, status, posting_type,
                                 work_date, work_dates, total_positions, filled_positions, view_count,
                                 schema_version, contact_phone)
VALUES (..., 'active', 'regular', (current_date+1)::text, ARRAY[(current_date+1)::text], 1, 0, 0, 3, '+82101234567')
```

**경쟁 가설 3개 이상을 세우고 각각 증거를 모을 것** (fablize investigation-protocol):

- **H1 — 좌석 기준 전환의 잔여 영향.** `filled_positions`/`total_positions`가 좌석(work_logs) 기준으로 바뀌면서 트리거·제약이 추가됐다(#269, wiki `sources/seat-basis-e2e-seed-drift`). 테스트가 직접 넣는 `filled_positions=0`·`total_positions=1`이 새 불변식과 충돌하는가?
- **H2 — #274 대회 포함/자동 파생.** `20260718100000_grid_auto_sync_required_count.sql`, `20260719100000_grid_tournament_inclusion_reject_filter.sql`이 job_postings에 트리거를 걸었는가? 다만 **실패는 #274 이전부터**였으므로 단독 원인은 아니다(복합 요인일 수는 있다).
- **H3 — RLS `jp_insert` 역할 게이트.** 메모리 `pitfall_job_postings_insert_loose_rls_by_design`: prod 진실은 `jp_insert` 역할게이트(admin/employer) + container 금지. 테스트 픽스처의 role/app_metadata 세팅이 게이트를 못 통과하는가? 세 케이스(owner/ws_editor/collaborator)가 **동시에** 깨진 점이 공통 원인을 시사한다.
- **H4 — 스키마 드리프트.** `schema_version=3`·`contact_phone` 형식·`work_dates` 배열 타입 등이 이후 마이그와 어긋났는가.

### 필수 규율

- **재현 먼저.** 로컬 Docker 스택(`npm run db:start` / `db:reset`)을 띄우고 `pg_prove`로 해당 파일만 돌려 red를 눈으로 확인한 뒤 가설 검증에 들어갈 것. 로그만 읽고 추정하지 말 것.
- **에러 원문을 확보하라.** `lives_ok` 실패 시 pgTAP이 출력하는 실제 SQLSTATE/메시지가 가설을 즉시 좁힌다. 이번 세션은 CI 로그 요약만 봐서 원문을 못 봤다.
- **"테스트가 낡았다"로 결론 내기 전에 라이브 영향을 먼저 확인하라.** 좌석 전환 때 **vacuous green**(공허한 통과)에 데인 이력이 있다 — wiki `decisions/test-seed-contract-drift`. 테스트를 고치는 게 답일 수도 있지만, **prod RLS가 실제로 employer INSERT를 막고 있는지**를 먼저 실측할 것. 막고 있다면 이건 테스트 문제가 아니라 **라이브 장애**다.
- prod 확인은 읽기 전용으로. `mcp__supabase__execute_sql`로 정책·트리거 조회는 가능하나 **DDL·INSERT 금지**.

---

## B. 검색 rate limit 후속 3건 [여유 있으면]

우선순위 순.

### B1. 차단 이벤트를 `action_logs`에 기록 [권장]

지금 rate limit은 예외만 던지고 **아무 기록도 남기지 않는다.** 보안 리뷰 표현대로 "막는" 게 아니라 "느리게 하는" 상태다. 계정 1개로 분당 20회 = 라틴 2자 prefix 공간(36²=1,296)을 수십 분에 완주할 수 있는데, **아무도 보고 있지 않으면 그 시간은 그냥 흘러간다.**

- 대상: `search_users_by_nickname`, `search_collaborator_candidates_by_nickname`의 차단 분기
- `public.action_logs`(baseline에 존재)에 actor·operation·시각 1행
- 같은 계정이 24h 내 N회 이상 차단되면 admin 알림 — 설계 필요

### B2. ILIKE prefix 인덱스

`users.nickname`의 UNIQUE btree는 `ILIKE`를 못 탄다 → 검색마다 users 전체 seq scan. 지금은 rate limit이 빈도 상한(계정당 20회/분)을 정해 완화 중이다. 유입 전 대응:

```sql
CREATE INDEX users_nickname_lower_idx ON public.users (lower(nickname) text_pattern_ops)
  WHERE nickname IS NOT NULL;
-- 함수 본문도 lower(u.nickname) LIKE lower(v_escaped) || '%' 로 전환 필요
```

### B3. pgTAP 파일 분리

닉네임 검색 가드(E1~E5b, 6건)가 `weekly_grid_security_regression.test.sql`에 얹혀 있다. 응집도가 낮다 → `nickname_search_security.test.sql`로 분리하고 `plan()` 재계산.

---

## C. 반드시 지킬 것 (이번 세션에서 데인 것들)

| 함정 | 규율 |
|---|---|
| **`CREATE OR REPLACE`가 `ALTER FUNCTION SET search_path` 보정을 유실시킨다** | SECDEF 함수를 REPLACE하기 전 **현재 `proconfig`를 실측**하고 그대로 옮겨 적을 것. `20260711100000`이 62종에 `pg_temp`를 일괄 보정해뒀다. 이번에 `check_rate_limit`이 여기 걸려 prod까지 나갔고 CI parity 가드가 잡았다. |
| **"STABLE이면 중첩 DML이 거부된다"는 거짓** | read-only 강제는 함수 자신의 `provolatile` 기준이며 **전파되지 않는다**. VOLATILE이 필요한 진짜 이유는 플래너 폴딩으로 인한 **조용한 카운트 누락** 방지. |
| **가드가 통제가 아니라 증상을 테스트하면 무용** | `provolatile='v'`만 보면 rate limit 블록만 삭제한 회귀를 못 잡는다(계속 GREEN). `prosrc` 호출 존재 + 실동작 단언을 병행할 것. |
| **UI 문구 상수는 실재를 확인하고 쓸 것** | `text-danger-600`을 썼는데 이 프로젝트엔 `error-*`만 있다. NativeWind는 없는 클래스를 조용히 무시한다. |
| **한 컴포넌트만 보고 "두 검색 모두 ~"라고 단정하지 말 것** | 협업자 검색이 debounce인 걸 놓쳐 커밋 메시지에 거짓 근거를 썼다. 리뷰 3축이 전부 잡아냈다. |
| **stale base** | 머지 직전 항상 `origin/master` 재통합 + 재검증. 이번에 #274가 리뷰 도중 들어왔다. |

---

## D. 상태 스냅샷

- **master**: `08e40a060` (#278 wiki 졸업까지)
- **#273 머지 완료**: `b832a9f75` — prod 마이그 **6개 적용 완료**, ⚠️ **재적용 금지**
- **prod 실측 상태**: 검색 RPC 2종 `provolatile=v`·SECDEF·`search_path="",pg_temp`·anon 차단 / rate limit 20회차 허용·21회차 차단 / SECDEF `pg_temp` 누락 함수 **0** / advisor ERROR **0**
- **worktree `T-HOLDEM-nickname`**: 머지 완료, **정리 가능**(현재 master 체크아웃 상태)
- **사장님 게이트(미완)**: OTA · 실기기 QA — 특히 **협업자 검색이 타이핑식→버튼식으로 바뀌었다**. 구 클라는 여전히 debounce라 OTA 전까지 이론상 한도 소진 가능(실사용자 0명이라 실질 위험은 없음)

## E. 참고

- 메모리: `project_nickname_search_unification_20260718.md`(전체 경위·함정), `pitfall_job_postings_insert_loose_rls_by_design.md`(A 과제 직결)
- wiki: `decisions/secdef-hardening`, `decisions/test-seed-contract-drift`, `sources/seat-basis-e2e-seed-drift`
- 규율: `~/.claude/fablize/packs/investigation-protocol.txt` (A는 디버깅 과제 — 재현 → 경쟁가설 3+ → 가설별 증거 → 인과사슬 끝까지 → 기각한 가설 보고)
