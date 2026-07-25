---
area: decisions
updated: 2026-07-24
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
   - 실패 사례(2026-07-24): PR#311이 `set_venue_role_salary` 추가하며 갱신 누락 → **master DB Tests red + master를 merge한 인접 브랜치 동반 red**. PR#313에서 소급 177 갱신([[ops-console-redesign]]). 누락은 본인 PR이 아니라 머지 후 master와 후속 PR들에서 터진다 — CI green 확인은 머지 **후** master 런까지.
4. 병렬 세션 마이그 타임스탬프 충돌은 [[migration-timestamp-collision]] 규칙 유지.
5. **prod측 가드(`parity-smoke`)는 시크릿이 없으면 조용히 꺼진다.** 워크플로가 `PROD_DB_URL` 미설정 시 notice만 남기고 `exit 0` 하도록 설계돼 있어, **skip이 success로 집계**된다. 초록 배지가 "대조했고 일치"가 아니라 "대조를 안 했다"일 수 있다. 가드를 신설할 때 fail-open 폴백은 반드시 **가시적으로** 만들 것.

## parity-smoke 첫 실가동 (2026-07-25)

07-11 설계 이래 처음으로 실제 대조가 돌았다. 그전까지는 `PROD_DB_URL` 미설정으로 **매주 skip을 성공 처리**하고 있었다(마지막 07-20 실행 로그가 skip notice). 그 기간에 prod로 마이그레이션 12건이 직접 들어갔다 — 드리프트는 없었지만(첫 실측 `repo 기대값 180/111/0 == prod 180/111/0`), 감시가 꺼진 채 변경이 누적된 구간이 존재했다는 뜻이다.

시크릿 등록 시 3회 실패한 접속 함정 2종:

- **Session pooler 사용자명은 `postgres.<프로젝트ref>`** 다. `postgres`만 쓰면 호스트는 붙지만 `FATAL: password authentication failed for user "postgres"`로 떨어진다. Direct connection(`db.<ref>.supabase.co`) 쪽 문자열의 사용자명과 다르다. 접속 문자열은 대시보드 Settings가 아니라 상단 **Connect** 버튼(`?showConnect=true&method=session`)에 있다.
- **비밀번호의 `@ # / : %`는 퍼센트 인코딩 필수** — 안 하면 URI 파싱이 깨진다. 손으로 바꾸지 말고 `[uri]::EscapeDataString()`(PowerShell)로 변환할 것.
- 부수 사실: **Supabase DB 비밀번호는 프로젝트 생성 시 1회만 노출**되고 이후 조회할 수 없다. 분실 시 재설정 외에 방법이 없다.

## 판정이 뒤집힌 사례 (재발견 금지)
"공고 INSERT RLS 느슨 계약"은 로컬 gen-1 잔상이었고 prod 진실은 `jp_insert` 역할게이트([[rls-model]]). baseline 직후 e2e red 2건은 테스트 버그가 아니라 **master가 숨겨온 prod 실결함**(board_reports UPDATE 갭)과 시드 공백이었다.

관련: [[parity-baseline-squash]] · [[rls-model]] · [[test-db-grants]] · [[userflow-audit-2026-07]]
