---
area: sources
updated: 2026-08-08
status: current
sources:
  - uniqn-mobile/app/(app)/settings/delete-account.tsx
  - uniqn-mobile/supabase/migrations/20260807140000_withdrawal_users_status_and_reason.sql
  - uniqn-mobile/supabase/migrations/20260807150000_permanently_delete_user_service_role_gate.sql
  - PR#427
tags: [account, withdrawal, deletion, rls, audit]
---

# 소스: 탈퇴가 요청 단계부터 막혀 있었다 — 감사 A1·A2 (PR#427)

## "0건"은 피해자가 없다는 뜻이 아니었다

탈퇴 요청 테이블의 건수가 0 이었다. 이걸 "탈퇴하려는 사람이 없다"로 읽으면 결론이 정반대가 된다.
실제로는 **요청 단계부터 기능이 불능**이라 아무도 성공하지 못한 것이었다.

> 🔑 **0 을 만나면 "왜 0인가"를 먼저 확인한다.** 정상 0(수요 없음)과 이상 0(경로 차단)은
> 같은 숫자로 보이지만 정반대의 결론을 낳는다. 이 감사에서 0 의 원인을 확인하지 않았다면
> "탈퇴는 문제없음"으로 종결됐을 것이다.
>
> 🚨 RLS 가 걸린 테이블에서는 **"안 보이는 것"이 "없는 것"으로 보인다** — pgTAP 의 0건 단언은
> 행이 보이는 역할에서 해야 한다. 에러도 WARNING 도 뜨지 않아 마이그 결함으로 오판하기 쉽다.

## 함께 닫은 것

- `users.status` 와 탈퇴 사유 컬럼 정합(`20260807140000`, prod 기록명 `20260807022947`)
- `permanently_delete_user` 를 **service_role 게이트**로 좁힘(`20260807150000`, prod 기록명 `20260807023036`)

⚠️ `DeletionRequest.status` 와 `users.status` 는 **이름만 같고 다른 enum** 이다 — 혼동 주의.

같은 PR 에서 공개 레포 시드 크리덴셜 문제도 함께 닫았다 → [[local-only-seed-reached-prod]].

## 연결

- 같은 PR 의 크리덴셜 축: [[local-only-seed-reached-prod]]
- RLS 가시성 모델: [[rls-model]]
- SECDEF/권한 게이트 원칙: [[secdef-hardening]]
- "없음"으로 위장되는 다른 형태: [[error-vs-empty-state]]
