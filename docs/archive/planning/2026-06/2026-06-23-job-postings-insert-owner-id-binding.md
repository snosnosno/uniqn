# 공고 INSERT owner_id 바인딩 조임 — 설계 초안 (DRAFT)

> 상태: **DRAFT / 제안만** — 코드/마이그레이션 미적용. 리뷰·제품 결정 후 별도 구현 PR로 진행.
> 작성: 2026-06-23 · 맥락: 지갑/IAP 제거(PR #196) 후 결제 RPC가 가졌던 `owner_id = auth.uid()` 바인딩이 사라지면서, 직접 INSERT 경로의 느슨한 RLS가 다시 표면화됨.

## 한 줄 결론
`job_postings` INSERT RLS는 현재 **의도적으로 느슨**(`auth.uid() IS NOT NULL`)하다. 순진하게 `owner_id = auth.uid()`로 조이면 워크스페이스 editor·collaborator의 정당한 INSERT가 깨진다(실측 4/16 pgTAP fail). 안전한 조임은 **UPDATE 정책과 동일하게 워크스페이스 멤버십에 바인딩**하는 것이며, collaborator의 신규 공고 생성 허용 여부는 **제품 결정**이 필요하다.

## 현재 계약 (증거)
- INSERT 정책: `job_postings_insert_authenticated` `WITH CHECK (auth.uid() IS NOT NULL)` (base_schema) **OR** `jp_insert`(employer/admin, `20260414015346`). permissive OR라 사실상 **모든 인증 사용자 ALLOW**.
- pgTAP `uniqn-mobile/supabase/tests/jpc_job_postings_rls.test.sql`가 계약으로 명시:
  - `job_postings INSERT: owner` → ALLOW
  - `job_postings INSERT: ws_editor` → ALLOW
  - `job_postings INSERT: collaborator (정책상 ALLOW)` → ALLOW
  - `job_postings INSERT: outsider (정책상 ALLOW — app layer 권한 검사 필수)` → ALLOW
- 대비되는 **UPDATE** 정책(조임의 모델): `jp_update_workspace_member` = `is_workspace_member(workspace_id, auth.uid())` OR admin (+ `is_posting_collaborator`) → owner/editor/collab ALLOW, **outsider DENY**.

## 위협 / 동기
- 인증된 임의 사용자가 **아무 workspace_id로** 공고를 INSERT할 수 있다(소속 무관). `owner_id`·`owner_name`도 위조 가능.
- 앱 레이어가 막고 있으나(서비스 경유), RLS는 마지막 방어선이 아니라 사실상 무방비. anon은 차단되지만 authenticated는 무제한.
- 실 영향도는 낮음(공고는 공개 자원이고 악용 시 스팸 수준)이나, 결제 RPC 제거로 "DB가 owner를 강제하던 유일한 경로"가 사라져 명시적 정리가 필요.

## 옵션
| 옵션 | WITH CHECK | editor | collaborator | outsider | 평가 |
|------|-----------|--------|--------------|----------|------|
| **A. owner_id 단독** | `owner_id = auth.uid()` | ❌ 깨짐 | ❌ 깨짐 | ✅ 차단 | **기각** — editor/collab 정당 INSERT 차단(실측 4/16 fail) |
| **B. 워크스페이스 멤버십** (권장) | `is_workspace_member(workspace_id, auth.uid()) OR is_admin()` | ✅ | ⚠️ 멤버면 OK, 비멤버면 차단 | ✅ 차단 | **권장** — UPDATE 정책과 대칭. collab 시맨틱만 결정 필요 |
| **C. 느슨 유지 + 앱 하드닝** | 변경 없음 | ✅ | ✅ | ✅(허용) | RLS 방어선 포기. 현행 유지안 |

## 권장: 옵션 B
UPDATE와 동일하게 `is_workspace_member` 바인딩. editor(워크스페이스 멤버)는 유지, outsider는 차단, owner_id 위조는 "소속 워크스페이스 한정"으로 축소된다.

### 미해결 제품 결정 — collaborator의 신규 공고 생성
`job_posting_collaborators`는 **기존 공고 단위** 공유다(공고를 만든 뒤 협업자 추가). 협업자가 **새 공고를 생성**할 시나리오가 실제로 있는가?
- 없다(협업자는 기존 공고만 관리) → 옵션 B 그대로. pgTAP `collaborator INSERT`는 ALLOW→DENY로 계약 변경.
- 있다 → WITH CHECK에 `OR exists(해당 workspace의 공고 중 내가 collaborator)` 같은 분기 추가 필요(복잡·재귀 주의).

→ **이 결정 없이는 구현 불가.** 기본 가정은 "없음"(옵션 B 순정).

## 후보 마이그레이션 (검토용 — 미적용)
```sql
-- 20260624000000_tighten_job_postings_insert_to_workspace_member.sql (제안)
-- 느슨한 INSERT 정책을 워크스페이스 멤버십 바인딩으로 교체. UPDATE 정책과 대칭.
DROP POLICY IF EXISTS job_postings_insert_authenticated ON public.job_postings;
DROP POLICY IF EXISTS jp_insert ON public.job_postings;

CREATE POLICY jp_insert_workspace_member ON public.job_postings
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_workspace_member(workspace_id, (SELECT auth.uid()))
    OR public.is_admin()
  );
-- 주의: is_workspace_member 는 SECURITY DEFINER plpgsql(STABLE) 여야 anon-poison/inline 회피
--       ([[rls-model]] SECDEF 함정). is_admin() 시그니처/존재 확인 필요.
```

### 동반 pgTAP 변경 (계약 갱신)
`jpc_job_postings_rls.test.sql`:
- `job_postings INSERT: outsider` → `lives_ok` → **`throws_ok`(42501)** 로 변경
- `job_postings INSERT: collaborator` → 제품 결정에 따라 ALLOW 유지 or DENY 전환
- 헤더 주석의 "INSERT 4 모두 ALLOW" 계약 문구 갱신

## 검증 계획 (구현 PR에서)
1. 로컬: `npm run db:reset` + `npm run test:db:helpers` 후 `npm run test:db` — INSERT 매트릭스 RED→GREEN 확인.
2. Red-Green: 새 정책 없이 갱신된 pgTAP 실행 → outsider INSERT가 여전히 통과(RED) 확인 → 정책 적용 후 GREEN.
3. 앱 회귀: employer 직접 생성 / 워크스페이스 editor 생성 / (가능하면) collaborator 흐름 e2e.
4. prod 적용 전 read-only로 현행 정책 dump 대조.

## 관련
- 메모리 `pitfall_job_postings_insert_loose_rls_by_design` — 순진 조임이 4/16 깬 실측
- 위키 `[[rls-model]]` — 느슨 INSERT 의도 원칙 + SECDEF 함정
- 위키 `[[wallet-iap-removal]]` — 결제 RPC 바인딩 제거 맥락
