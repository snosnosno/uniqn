---
area: sources
updated: 2026-07-19
status: current
sources:
  - uniqn-mobile/supabase/migrations/20260717093000_grid_order_sheet_security_hardening.sql
  - uniqn-mobile/supabase/tests/grid_order_sheet_security_hardening.test.sql
  - uniqn-mobile/supabase/migrations/20260710000002_baseline_schema_from_prod.sql
  - uniqn-mobile/src/components/employer/order-sheet/OrderSheetScreen.tsx
  - PR#267
  - memory/project_grid_order_sheet_security_hardening_20260717
tags: [security, secdef, rls, postgres, pgtap, weekly-grid, order-sheet, xss]
---

# 소스: 그리드+주문서 출시 전 보안 하드닝 (PR #267, 2026-07-17)

## 무엇을 했나
주간 배치 그리드(플래그 `weekly_grid_enabled` OFF 대기)와 주문서 통일 공고작성([[order-sheet-unification]])의 **출시 전 4축 병렬 리뷰**(주문서 정확성 / 그리드 정확성 / 보안 RLS·SECDEF / UX). 정확성·그리드·UX 3축은 Ready(Critical·High 0)였고 **보안 축만 HIGH 2건을 적발해 출시 판정을 뒤집었다**. 결과: HIGH 2 + MEDIUM 2 + LOW 6 전량 교정, prod 마이그 8/8 실측 적용, `3dcb1d9` squash 머지로 prod↔repo 드리프트 해소.

> 교훈: **"기능 리뷰 3축 Ready"는 출시 승인이 아니다.** 같은 코드에 보안 렌즈를 따로 대야 인가 결함이 나온다.

## HIGH-1 — NULL `owner_id` fail-open (이미 라이브였던 인가 우회) ★핵심

**코드로 검증됨** (`20260710000002_baseline_schema_from_prod.sql:678`):
```sql
IF NOT ( v_job.owner_id = v_owner OR public.is_workspace_member(...) ... ) THEN
```
`job_postings.owner_id`는 nullable — 계정삭제 시 `ON DELETE SET NULL`. 고아 공고에서 `NULL = v_owner`가 **false가 아니라 NULL**로 평가되고, `NOT (NULL OR false OR false OR false)` = NULL → `IF` 미발화 → **무관자가 게이트를 통과**한다.

- 영향 함수 3종(**코드로 검증됨**): `add_direct_staff`(baseline:638 정의, 게이트 :678) · `remove_direct_staff`(:8603) · `set_venue_soft_target`.
- ⚠️ `add_direct_staff`·`remove_direct_staff`는 PR#229로 **이미 프로덕션 라이브** — 그리드 플래그와 무관하게 노출 중이었다.
- **같은 baseline에 이미 방어 선례가 있었다**: `cancel_application_atomically`(baseline:1043)는 `COALESCE(v_job_posting.owner_id = p_actor_id, false)`로 fail-closed이고, 주석에 NULL 전파 메커니즘까지 적혀 있다(**코드로 검증됨**). 즉 **동일 클래스를 아는 상태에서 그리드 형제 3종만 누락**된 것 — 함정을 한 함수에서 고칠 때 같은 관용구의 형제 전수 grep이 없으면 재발한다.
- 수정: 3종 모두 `COALESCE(owner = caller, false)`로 통일(`20260717093000_...sql:75, :225, :315`, **코드로 검증됨**).

→ 이 사례는 [[secdef-hardening]] **규칙 3(plpgsql NULL fail-open 차단)**의 두 번째 실증이다. 기존 실증(정규식·`crypt` NULL)은 *입력값* NULL이었으나, 여기서는 **스키마가 허용한 nullable 컬럼(FK ON DELETE SET NULL)이 NULL 원천**이다.

## HIGH-2 — 대회 공고 자체승인

`jp_insert` WITH CHECK가 역할(admin/employer)만 검사하고 `tournament_config`는 무검사 → employer가 raw PostgREST로 `approvalStatus:'approved'`를 직접 INSERT/UPDATE하면 **admin 심사 없이 공개 + 지원 수락**이 가능했다(주장: 리뷰 판정, 익스플로잇 실행은 안 함).

- 수정: `enforce_tournament_approval_authority()` BEFORE INSERT/UPDATE 트리거(**코드로 검증됨** `:353~:413`). 대회 아님 / `approved` 아님 / 이미 approved면 통과, `auth.uid() IS NULL`이면 우회, admin이면 허용, 그 외 `42501` RAISE.
- 🔑 **`auth.uid() IS NULL` 우회가 왜 안전한가**: 정상 승인 경로는 Edge Function `approve-job-posting`의 **service_role UPDATE(=JWT 없음 → `auth.uid()`=NULL)**다. 이 관용구는 baseline의 `enforce_jp_status_transition`(:1822)이 먼저 쓰던 것을 미러링했다(**코드로 검증됨** — 해당 함수 COMMENT에 "service-side (no JWT) bypass" 명시).
- 신규 트리거 함수는 `REVOKE ALL ... FROM PUBLIC, anon, authenticated`([[secdef-hardening]] 규칙 1 준수, **코드로 검증됨** `:408`).

## MEDIUM 2

- **M-1 `jp_insert` owner_id 바인딩** — [[rls-model]]의 "job_postings INSERT는 의도적으로 느슨" 원칙에서 *"별도 PR 사안"으로 지연*됐던 건. impersonation(owner_id를 피해자로 위조 → 피해자 명의 스캠 공고) 방어. 마이그에 **적용 전 QA 3경로를 섹션 주석으로 명시**하고 "위험하면 이 섹션만 제외하라"는 탈출구를 남겼다(**코드로 검증됨** `:416~:432`). 안전 실측 근거: `useJobManagement.ts:116` → `createJobPosting(input, user.uid, ...)`로 멤버도 자기 uid로 생성(대리 생성 경로 없음, 주장: memory 실측 기록) → 전량 적용.
  최종 정책: `역할 ∈ {admin, employer} AND (owner_id = auth.uid() OR 역할 = admin)`.
- **M-2 XSS 서버 경계 확대** — `work_logs(notes, custom_role)` · `job_postings(+contact_phone)`에 `check_xss_fields` 트리거 추가(**코드로 검증됨** `:438, :445`). `applications(message, notes)` 선례와 동형. RN은 textContent 렌더라 현 스택에서는 inert — **defense-in-depth 목적**임을 명시.

## LOW 6 (UI, 커밋 `b5328ffda`)
L2 소프트타깃 클라 상한 99(서버는 음수만 거부) · L3 `EditSlotSheet` 저장실패 `isAppError` 메시지 분화 · L4 `VenueDayDetail` 비가상화 임계 50 경고 · L5 선택칩 `dark:bg-primary-900/30` 일관화 · L6 `PreQuestionsSheet` Switch a11yLabel · L7 `OrderSheetScreen` 하단 CTA safe-area inset. **L1은 보류**(매퍼 catalog 재조립이 `scheduleLocked` 가드를 깰 위험 대비 LOW·미확증).

- 🔑 **테스트 함정(재발 방지)**: `useSafeAreaInsets`는 `SafeAreaProvider` 없는 테스트에서 **throw**하지만 `SafeAreaView` **컴포넌트는 안 던진다** — 그래서 일부 스위트만 선택적으로 죽는다(OrderSheetScreen 7스위트). 해소: `jest.setup.js`에 `react-native-safe-area-context`를 `requireActual` + `useSafeAreaInsets`만 0으로 오버라이드하는 전역 목 추가(자체 목 파일이 우선). 부수피해 0 확인.

## 검증 (전부 실행 증거)
| 항목 | 증거 |
|---|---|
| pgTAP | `grid_order_sheet_security_hardening.test.sql` **`plan(11)`** red-green (**코드로 검증됨**). RED=고아공고+무관자 fail-open 재현, GREEN=차단+정상 4경로 무회귀 |
| prod 적용 | `mcp__supabase__apply_migration` 후 사후 검증 **8/8**(COALESCE 3·트리거·work_logs XSS·jp_insert 바인딩·contact_phone·신규함수 anon EXECUTE=false) |
| advisor | Supabase security advisor **0 ERROR·신규 경보 0** |
| 앱 | `tsc` 0 · `eslint` 0 · `jest` **480 스위트 / 5570 tests** 통과 |

**적용 전 라이브 파리티 실측**을 먼저 했다 — prod의 3함수가 bare 비교이고 트리거/XSS 부재임을 확인해 `CREATE OR REPLACE`가 **어떤 prod 핫픽스도 덮지 않음**을 보장했다. 이는 [[prod-parity-baseline]]의 "MCP 핫픽스는 같은 PR에서 repo 마이그 동시 갱신" 규율을 역방향으로 지킨 것이고, PR #267 squash(`3dcb1d9`)가 그 파리티를 닫았다([[parity-baseline-squash]] 가드 체계).

## 잔여 = 사용자 게이트 (⚠️ 순서 엄수)
1. **iOS 실기기 QA (BLOCKING)** — 그리드 휠피커/중첩시트/N→N+1 + 주문서 스모크 5 + L7 노치. M-1 생성 3경로(employer 본인·워크스페이스 멤버·admin) 스모크.
2. **OTA**(주문서·UI 배포)
3. **`weekly_grid_enabled` ON — 맨 마지막**

역순 금지: 서버 마이그는 이미 prod에 있으므로 플래그를 먼저 켜면 OTA 안 받은 **구 클라이언트가 신 정책/트리거와 만나 파손**된다. 같은 "마이그 → OTA → 플래그" 배포 순서 계약이 [[ops-engine]] S1에도 있다.

## 부수 관찰
`owner_id` UPDATE 시 기존 `notify_on_job_posting_update`가 `malformed array literal: "schedule"` 경고를 자체 삼킴 — 범위 밖 기존 트리거 quirk(미수정, 주장).

## 관련
[[secdef-hardening]] · [[rls-model]] · [[prod-parity-baseline]] · [[parity-baseline-squash]] · [[order-sheet-unification]] · [[ops-engine]] · [[supabase-write-pitfalls]] · [[whitelist-silent-drop]]
