---
area: sources
updated: 2026-07-19
status: current
sources:
  - uniqn-mobile/supabase/migrations/20260718120000_nickname_search_rpcs.sql
  - uniqn-mobile/supabase/migrations/20260718120100_drop_legacy_search_rpcs.sql
  - uniqn-mobile/supabase/migrations/20260718120200_collaborator_search_hardening.sql
  - uniqn-mobile/supabase/migrations/20260719061931_nickname_search_rate_limit.sql
  - uniqn-mobile/supabase/migrations/20260719070500_rate_limit_insert_atomic.sql
  - uniqn-mobile/supabase/tests/weekly_grid_security_regression.test.sql
  - uniqn-mobile/src/components/staffPicker/SearchErrorNotice.tsx
  - uniqn-mobile/src/utils/supabase.ts
  - PR#273
  - memory/project_nickname_search_unification_20260718
tags: [search, nickname, rpc, secdef, rate-limit, pii, pgtap]
---

# 소스: 스태프·협업자 검색 닉네임 통일 + 서버 rate limit (PR #273, 2026-07-18~19)

머지 `b832a9f75`. 마이그 파일 5 + pgTAP 1 + 클라 33파일.

## 근본 결함 — 커버리지가 아니라 포맷 버그

전화번호 검색이 **실사용자 100% 실패**하고 있었다. DB는 E.164(`+8210…`)로 저장하는데 사장은 `010…`을 입력 → 완전일치 검색이 영원히 미스매치(memory 기준, prod 실측 서술).

부차 원인은 **코드로 검증됨**: `handle_new_user` 트리거는 `users`에 `id, email, name, role, social_provider`만 INSERT한다(`20260710000002_baseline_schema_from_prod.sql:3247-3257`). **phone 컬럼을 아예 기록하지 않는다** — 소셜로그인 유저는 전화번호가 없으므로 전화 검색은 구조적으로 성립 불가였다.

## 왜 닉네임이 검색키인가

- profile-setup **필수** 입력이라 실사용자 100% 보유(`@uniqn.app` 시드계정만 예외 — memory 주장).
- **UNIQUE 제약** `users_nickname_key`가 baseline에 실재(`20260710000002_baseline_schema_from_prod.sql:11187-11191`) — 코드로 검증됨.
- 이미 카드에 노출되는 공개값이라 검색 노출이 새 PII 표면을 만들지 않는다.

## 서버 계약 (RPC 2종 신설 · 구 2종 DROP)

| 항목 | `search_users_by_nickname` (스태프) | `search_collaborator_candidates_by_nickname` (협업자) |
|---|---|---|
| 인가 게이트 | `role IN ('employer','admin')` (`:39`) | workspace owner (`:107`, `42501`) |
| 최소 길이 | 2자 (`:47`) | 2자 (`:111`) |
| 매칭 | `nickname ILIKE v_escaped \|\| '%' ESCAPE '\'` (`:60`) | 동일 (`:54` 하드닝판) |
| 상한 | `LIMIT 8` (`:62`) | `LIMIT 10` (`:58` 하드닝판) |
| 제외 | `COALESCE(status,'active') NOT IN ('deleted','deactivated')` (`:58`) | 동일 (`:56` 하드닝판) |

- 인용값은 `20260718120000_nickname_search_rpcs.sql` / `20260718120200_collaborator_search_hardening.sql` 기준. **모두 코드로 검증됨.**
- **PII 하드닝**: 협업자 후보의 `email` 반환을 제거했다 — 공개·UNIQUE 값(닉네임)을 키로 비공개 PII를 되돌려주면 email 하베스팅 벡터가 된다(`20260718120200:3-5`). 반환 타입 변경이라 DROP+CREATE. 이미 추가된 협업자 리스트의 email은 존치(정상 표시).
- 구 RPC `search_users_by_phone` · `search_users_for_collaborator_invite` DROP(`20260718120100_drop_legacy_search_rpcs.sql:11-12`). `ops_add_staff`의 `search_users_by_phone` 언급은 **주석뿐**이라 런타임 무영향 — `pg_proc.prosrc` 실측으로 확인했다(같은 파일 `:5-6`). plpgsql 늦은바인딩 함정 회피 절차는 [[supabase-write-pitfalls]] 계열.

## exact→prefix가 연 열거 표면 → 서버 rate limit

완전일치를 prefix로 바꾸면 2자 조합을 훑어 가입자 명부를 복원할 수 있다. 기존 `check_user_rate_limit` 인프라를 재사용해 **검색별 키 분리·분당 20회**로 차단(`20260719061931_nickname_search_rate_limit.sql:73`, `:144`). 초과 시 `RAISE EXCEPTION 'SEARCH_RATE_LIMITED: …'`(`:75`, `:146`).

이 과정에서 나온 재발 클래스 교훈 3건은 [[secdef-replace-search-path-loss]]로 분리했다(REPLACE 시 `search_path` 유실 · "STABLE이면 중첩 DML 거부" 반증 · 가드 설계).

## 리뷰가 잡은 것 (3축, 머지 차단 0)

- **[HIGH] rate limit 안내의 UI 도달 경로가 0이었다.** 소비처 4곳이 훅의 `error`를 구조분해하지 않아 실패가 "결과 0건" 분기로 흡수 → 실존 유저에게 "UNIQN 에 가입한 사용자만 추가할 수 있어요"로 오도. 공용 `SearchErrorNotice`를 만들고 **빈 결과보다 먼저** 분기하도록 4곳 수정(`src/components/staffPicker/SearchErrorNotice.tsx:1-10`에 이 규칙이 주석으로 봉인됨). [[whitelist-silent-drop]]의 "조용한 증발"과 같은 계열 — 이번엔 필드가 아니라 **에러가** 증발했다.
- **[HIGH] 한도 산정 전제가 거짓이었다.** 협업자 검색은 수동 버튼이 아니라 300ms debounce였다 → `CollaboratorSearch`를 명시 제출(버튼·엔터)로 전환하고 `SEARCH_DEBOUNCE_MS` 제거. 주석의 "수동 제출" 근거가 그제서야 사실이 됨.
- **[MED] 토큰 과포획**: `includes('RATE_LIMITED')`가 기존 `ANALYTICS_/OPS_REPORT_RATE_LIMITED`까지 잡았다 → 고유 토큰 + `startsWith`로 좁힘(`src/utils/supabase.ts:125-130`). 회귀 테스트 2건.
- **[MED] 최초 INSERT 레이스**: 행이 없으면 `SELECT … FOR UPDATE`가 잠글 행이 없어 동시 진입 시 둘 다 INSERT → `23505` → 클라 매핑상 사장에게 **"형식 오류"**로 표시. `ON CONFLICT (key) DO UPDATE`로 원자화(`20260719070500_rate_limit_insert_atomic.sql:3-16`). 도달 경로 실재: `expires_at`이 120초인데 정리 cron은 하루 1회라 "그날 첫 검색 + 연타"에서 적중.

## 검증 증거

- 클라: `tsc --noEmit` exit 0 · `jest` 496/496 스위트·5635/5635 테스트 · `eslint` exit 0(warning 61 = 기존 baseline). (PR#273 본문 + memory)
- prod 실측(2026-07-19): 두 RPC `provolatile=v`·`prosecdef=t`·`search_path="",pg_temp`·rate limit 호출 존재·anon EXECUTE 차단·authenticated 허용. 스모크 **20회차 allowed=true / 21회차 false**. advisor ERROR 0.
- pgTAP은 로컬 스택 부재로 **엔드투엔드 미실행** — 신규 단언은 정적 작성 + prod 권한 실측으로 참 확인(갭 명시).

## 배포 상태 / 잔여

- **prod 마이그는 적용 완료 — 머지 후 재적용 금지.** 파일명(`20260718120000` 계열) ≠ prod 버전(`20260717193342` 계열)은 MCP apply 경로의 알려진 드리프트로 무해(PR#273 본문). 같은 종류의 타임스탬프 함정은 [[migration-timestamp-collision]].
- 클라 **OTA 미배포**. 구 클라는 협업자 검색이 여전히 debounce라 이론상 한도를 소진할 수 있으나 실사용자 0명이라 실질 위험 없음.
- 후속(별도 PR): ① 차단 이벤트 `action_logs` 기록 — 없으면 "막음"이 아니라 "느리게 함"(계정당 분당 20회면 라틴 2자 prefix 공간을 수십 분에 완주) ② `lower(nickname) text_pattern_ops` 함수형 인덱스 — **ILIKE prefix는 btree `users_nickname_key`를 못 쓴다**(대소문자 비의존) → 현재는 seq scan, 트래픽 유입 전까지 LIMIT+2자로 방어 ③ pgTAP을 `nickname_search_security.test.sql`로 분리(현재 `weekly_grid_security_regression.test.sql`에 동거).

## 함정 메모

- `supabase.rpc`는 `src/types/supabase.ts`의 Functions 타입에 strict 바인딩 → 신규 RPC는 수동 추가 또는 `generate_typescript_types` 재생성 필요(regen 대조로 시그니처 정합 확인).
- UI: `PhoneSearchField`의 `flex-row items-end` + hint가 검색 버튼을 2줄 안내문 옆으로 밀어냈다 → `NicknameSearchField`에서 라벨/안내문을 행 밖으로 분리 + `items-center`. 같은 계열 레이아웃 함정은 [[nativewind-rn-pitfalls]].

## 관련

- [[secdef-replace-search-path-loss]] — 이 PR이 낳은 재발 클래스 규칙(REPLACE 유실·volatility·가드 설계)
- [[secdef-hardening]] — SECDEF 3규칙(anon REVOKE·search_path·NULL fail-open). 두 RPC가 그 규칙 위에 서 있다
- [[prod-parity-baseline]] — parity 가드가 이번 회귀를 잡아낸 근거 체계
- [[rls-model]] — SECDEF가 RLS를 우회하므로 인가는 함수 본문 게이트가 담당
- [[roles]] — employer/admin vs workspace owner 두 게이트의 역할 구분
