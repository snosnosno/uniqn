---
area: decisions
updated: 2026-08-08
status: current
sources:
  - uniqn-mobile/supabase/migrations/20260419042012_seed_app_review_accounts.sql
  - PR#427
  - PR#428
  - memory/pitfall_public_repo_seed_credentials_live_in_prod.md
tags: [security, seed, migration, credentials, prod]
---

# 결정: 시드 마이그레이션은 "로컬 전용"을 스스로 보장하지 않는다

## 결론 — 결함을 어디에 두느냐가 중요하다

공개 레포에 평문 비밀번호가 있었고, 그 계정이 **prod 에서 살아 있었다**(PR#427·#428).

문제를 *"평문이 레포에 있다"* 로 잡으면 대응은 "문서에서 비밀번호를 지운다"에서 끝난다.
실제 결함은 그게 아니다:

> 🔑 **로컬 전용으로 쓰인 시드 마이그레이션이 prod 에 그대로 적용됐다.**

레포에서 문자열을 지워도 **prod 의 계정은 그대로 살아 있다.** 이 레포의 마이그 관례상
`supabase/migrations/` 에 있는 파일은 로컬 `db reset` 과 prod 적용 **양쪽에서** 도는데,
"심사용/QA용 시드"라는 의도는 파일명과 주석에만 있고 **실행 경로에는 없었다.**

## 규율

1. 심사·QA·데모 계정 시드는 **prod 에 적용하지 않는다.** 의도를 주석이 아니라
   적용 경로로 표현할 것(별도 디렉토리 / 로컬 전용 스크립트 / 환경 가드).
2. 레포에서 크리덴셜을 지우는 것은 **노출 차단이지 무효화가 아니다.**
   반드시 **회전(rotate)** 이 뒤따라야 하고, 회전은 prod 에서 확인해야 한다.
3. **계정 수를 코드가 아니라 prod 에서 센다.** 이번에 시드 계정은
   문서가 말하던 4개가 아니라 **5개**였다 — 1건이 회전 누락으로 남았다.
   "몇 개인가"를 레포 기준으로 세면 남는 하나를 영원히 못 찾는다.

## 연결

- prod↔레포가 갈라지는 일반 문제: [[prod-parity-baseline]]
- 권한/노출 하드닝의 원칙: [[secdef-hardening]]
- RLS 로 접근을 좁히는 층: [[rls-model]]
- 같은 날 드러난 다른 prod 드리프트: [[migration-timestamp-collision]]
