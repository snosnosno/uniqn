---
area: architecture
updated: 2026-06-18
status: current
sources:
  - uniqn-mobile/supabase/migrations/20260525153952_fix_job_postings_anon_public_select.sql
  - uniqn-mobile/supabase/migrations/20260515030000_jpc_extend_existing_rls.sql
  - memory/pitfall_anon_rls_secdef_function_poison.md
  - memory/pitfall_rls_jpc_recursion_widespread.md
  - memory/pitfall_rls_with_check_self_select_recursion.md
  - PR#91
  - PR#92
tags: [rls, postgres, security, supabase, recursion, secdef]
---

# RLS 모델

**한 줄:** Row Level Security 3계층(anon·authenticated·service_role) + SECURITY DEFINER 헬퍼 함수 패턴. 3가지 함정 실전 발생 이력.

## 역할 계층

| 역할 | 가시성 |
|---|---|
| `anon` | 공개 공고(`jp_select_public_search`) 읽기만 |
| `authenticated` | 본인 데이터 + 워크스페이스 멤버십 범위 |
| `service_role` | RLS 우회(Edge Function, pgTAP) |

## 핵심 원칙

1. **permissive 정책은 OR 합산** — 하나라도 USING 절에서 함수 권한 실패 시 쿼리 전체 abort.
2. **RLS 안에서 같은 테이블 inline SELECT → cycle 감지(42P17)** — SECURITY DEFINER plpgsql 함수로 wrap 필수.
3. **SECDEF 함수는 절대 anon에 노출 금지** — 멤버십 논리는 `authenticated`에만 부여.

## 함정 1: anon + SECDEF 헬퍼 → 42501 (검증됨)

마이그레이션 `uniqn-mobile/supabase/migrations/20260525153952_fix_job_postings_anon_public_select.sql`:
> `jp_select_managed`(TO PUBLIC)이 `is_workspace_member()` 호출 → anon이 함수 권한에서 abort.

수정: `ALTER POLICY jp_select_managed ON public.job_postings TO authenticated;`
(주장: `pitfall_anon_rls_secdef_function_poison.md` 기반 — 현재 코드 마이그레이션 파일로 검증됨)

## 함정 2: JPC JOIN inline → 재귀 42P17 (주장)

마이그레이션 `uniqn-mobile/supabase/migrations/20260515030000_jpc_extend_existing_rls.sql`에서 `workspaces_select_owner_or_member` USING에 `EXISTS(SELECT 1 FROM job_postings JOIN job_posting_collaborators ...)` inline 추가 → jp DELETE 시 cycle (memory `pitfall_rls_jpc_recursion_widespread.md`).

수정 방향: JPC 존재 여부를 plpgsql SECURITY DEFINER 함수 `is_workspace_jpc_member()`로 격리 (PR#91/PR#92 기반, 주장).

## 함정 3: WITH CHECK self-SELECT → 재귀 (주장)

WITH CHECK 안 `SELECT count(*) FROM workspaces WHERE owner_id = auth.uid()` → PostgreSQL cycle 가드 트리거 (memory `pitfall_rls_with_check_self_select_recursion.md`, 2026-05-08 hotfix).

수정 패턴: self-SELECT를 `plpgsql STABLE SECURITY DEFINER` 함수로 분리. SQL 함수는 inline 가능성 있어 SECDEF 무효화 위험.

## 주요 테이블별 RLS 요약 (주장: memory 기반)

| 테이블 | anon | authenticated |
|---|---|---|
| `job_postings` | 공개 status만 읽기 | 본인 workspace + collaborator |
| `workspaces` | 없음 | owner or member (SECDEF helper) |
| `wallets` | 없음 | 본인만(DML REVOKE, PR#168) |
| `applications` | 없음 | 본인 지원 or 공고 소유자 |

## 관련

- [[layers]] — Service/Repository에서 Supabase 호출 방식
- [[roles]] — UserRole과 RLS authenticated 계층 매핑
- [[enum-divergence]] — RLS와 함께 발생한 읽기 증발 패턴
