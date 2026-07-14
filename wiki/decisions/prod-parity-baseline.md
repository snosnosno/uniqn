---
area: decisions
updated: 2026-07-14
status: current
sources:
  - uniqn-mobile/supabase/tests/parity_baseline_guard.test.sql
  - .github/workflows/parity-smoke.yml
  - PR#241
  - memory/pitfall_prod_repo_schema_drift_massive
tags: [database, migration, parity, adr]
---

# 결정: prod가 진실이다 — baseline squash로 파리티 확립 + 2중 가드

## 문제 (2026-07-10 실측)
prod DB와 레포 마이그레이션이 대규모 발산: 함수 prod 163 vs 레포 142(본문 불일치 52 — 일부는 레포에 미커밋된 prod 핫픽스), RLS 정책 prod 103 vs 레포 **173**(긴이름/짧은이름 세트 공존 → permissive OR 합산으로 **로컬이 prod보다 느슨**), PG 메이저 불일치(17.6 vs 15.8). MCP `apply_migration`이 자체 타임스탬프를 부여해 `schema_migrations` 버전 대조는 무의미 — 유일 오라클은 실제 객체 정의(`pg_proc.prosrc`/`pg_policies`) 비교뿐이었다. 결과: **로컬 pgTAP GREEN이 prod 증거가 못 됨**, 일부 테스트는 로컬 잔상(느슨 정책)을 계약으로 고정하고 있었다.

## 결정
마이그 히스토리 재구성(replay 정합화)이 아니라 **prod 스냅샷을 새 baseline으로 채택**: 구 마이그 248개 archive/ 이동 + prod pg_dump 재기록 + 덤프 밖 산물(glue) 코드화. 재발산은 가드 2중으로 기계 감시 — 로컬 pgTAP `parity_baseline_guard`(함수 163·정책 104·gen-1 부활 0·SECDEF pg_temp 0) + 주간 CI `parity-smoke`(prod 라이브 대조).

## 이후 규율
1. **DB 보안/스키마 주장의 증거 계층**: prod 라이브 실측 > 로컬 fresh reset(이제 prod 대표) > 문서/기억. baseline 이전 문서·테스트가 말하는 "정책/함수 계약"은 잔상일 수 있다([[parity-baseline-squash]]의 prod 진실 교정 목록).
2. **prod MCP 핫픽스 = 같은 PR에서 repo 마이그 + 가드 기대값 동시 갱신** (그게 가드의 존재 이유 — 안 하면 가드가 red로 잡는다).
3. 함수·정책을 만들거나 지우는 마이그는 가드 카운트 갱신 필수. **additive 컬럼은 무영향**(가드는 테이블/컬럼을 세지 않음 — 2026-07-14 conditions 컬럼 실측).
4. 병렬 세션 마이그 타임스탬프 충돌은 [[migration-timestamp-collision]] 규칙 유지.

## 판정이 뒤집힌 사례 (재발견 금지)
"공고 INSERT RLS 느슨 계약"은 로컬 gen-1 잔상이었고 prod 진실은 `jp_insert` 역할게이트([[rls-model]]). baseline 직후 e2e red 2건은 테스트 버그가 아니라 **master가 숨겨온 prod 실결함**(board_reports UPDATE 갭)과 시드 공백이었다.

관련: [[parity-baseline-squash]] · [[rls-model]] · [[test-db-grants]] · [[userflow-audit-2026-07]]
