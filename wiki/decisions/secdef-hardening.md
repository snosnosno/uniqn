---
area: decisions
updated: 2026-07-19
status: current
sources:
  - uniqn-mobile/supabase/tests/ops_player_view_security.test.sql
  - memory/pitfall_supabase_new_function_anon_default_grant.md
  - memory/pitfall_secdef_search_path_extensions.md
  - memory/pitfall_plpgsql_null_through_regex_fail_open.md
  - PR#195
  - PR#267
  - PR#273
tags: [secdef, security, postgres, plpgsql, grants, supabase]
---

# 결정: SECURITY DEFINER 함수 하드닝 3규칙

**한 줄:** SECDEF 함수를 새로 만들거나 고칠 때 반드시 ① anon EXECUTE 명시 REVOKE, ② `search_path`에 `extensions` 포함, ③ NULL fail-open을 `IS NULL`/`IS DISTINCT FROM`로 차단 — 셋 다 조용히 뚫리는 보안 결함으로 실증됐다. RLS 재귀/anon poison은 [[rls-model]] 참조(자매 함정).

## 왜 SECDEF가 위험 표면인가
SECDEF 함수는 **정의자(대개 postgres) 권한으로 실행**되므로 RLS를 우회한다. 그래서 "누가 실행할 수 있나(GRANT)"와 "함수 본문이 입력을 어떻게 검증하나"가 곧 인가 경계다. 아래 3규칙은 그 경계가 실전에서 뚫린 방식이다.

## 규칙 1 — 신규 함수는 anon EXECUTE 명시 REVOKE (검증 필요)
PostgreSQL 신규 함수는 **기본 `EXECUTE`가 `PUBLIC`(=anon 포함)에 부여**된다. SECDEF 함수를 만들고 GRANT를 신경 안 쓰면 anon이 RLS 우회 경로를 얻는다.
- 규칙: 위험 SECDEF는 `REVOKE EXECUTE ON FUNCTION ... FROM anon, PUBLIC;` 명시. DDL 직후 `has_function_privilege('anon', 'fn(sig)', 'EXECUTE')`로 실측.
- 실전: 위험 RPC 32종 anon REVOKE + 4종 `auth.uid()` 바인딩(PR#195, memory `pitfall_supabase_new_function_anon_default_grant`).
- **불변 예외**: anon 실행이 의도된 SECDEF는 화이트리스트로만 — ops의 `ops_get_monitor_snapshot`·`ops_get_player_view` 2개뿐, 반환값도 비-PII 투영([[ops-engine]]).

## 규칙 2 — SECDEF `search_path`에 `extensions` 포함 (검증 필요)
SECDEF 함수는 안전을 위해 `search_path`를 고정하는데, `public, pg_temp`만 넣으면 `pgcrypto`(`crypt`/`gen_salt`)가 `extensions` 스키마에 있어 **함수 미해결로 실패**한다.
- 규칙: pgcrypto 등 확장 함수를 쓰는 SECDEF는 `SET search_path = public, extensions, pg_temp`.
- 출처: memory `pitfall_secdef_search_path_extensions`.

## 규칙 3 — plpgsql NULL fail-open 차단 (검증됨: ops STEP A 적발)
plpgsql에서 NULL은 정규식·비교를 **거짓이 아니라 NULL로** 통과시켜, `IF NOT (...)` 게이트를 조용히 뚫는다.
- `NOT (NULL ~ regex) = NULL` → IF-false → 통과.
- `crypt(NULL, hash) = NULL → (NULL <> hash) = NULL` → IF-false → **PIN 없이 바인딩**.
- 규칙: 보안 게이트는 `IS NULL` 명시 선검사 + 비교는 `IS DISTINCT FROM`. pgTAP에 NULL/빈문자열/공백 회귀 필수.
- 출처: memory `pitfall_plpgsql_null_through_regex_fail_open`([[wallet-pgtap-caller-binding]] 계열의 캘러 바인딩 하드닝과 같은 세션 맥락).
- **2회차 실증(PR#267, HIGH)**: 그리드/주문서 RPC에서 `owner_id`가 NULL일 때 소유권 비교가 NULL로 통과 → **라이브 노출**. 같은 규칙(`IS NULL` 선검사)이 2개 도메인에서 독립적으로 뚫린 것이므로, 신규 SECDEF 리뷰의 **고정 체크 항목**으로 취급한다. 상세: [[grid-order-sheet-security-hardening]].

## 재정의(REPLACE)는 별개 문제
위 3규칙은 함수를 **작성할 때**의 규칙이다. 이미 하드닝된 함수를 `CREATE OR REPLACE`로 재정의하면 DDL에 다시 적지 않은 `search_path`·volatility가 **원본형으로 되돌아가** 규칙 2가 조용히 풀린다 — [[secdef-replace-search-path-loss]](PR#273 실증).

## 관련
- [[rls-model]] — SECDEF로 wrap해야 하는 RLS 재귀·anon poison 3함정(본 페이지의 전제)
- [[test-db-grants]] — 테이블 GRANT 레이어와 pgTAP 명시 GRANT(함수 GRANT와 짝)
- [[wallet-pgtap-caller-binding]] — 변이 RPC `auth.uid()` 바인딩 하드닝이 pgTAP를 깬 회귀
- [[supabase-write-pitfalls]] — 쓰기 경로 함정(users cross-lookup SECDEF RPC 등 자매 규칙)
- [[ops-engine]] — anon-executable SECDEF 2 불변(화이트리스트 예외의 근거)
