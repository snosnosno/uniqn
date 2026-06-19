# Wiki Log

> 시간순 append-only. 포맷: `## [YYYY-MM-DD] <op> | <제목>` (op = bootstrap | ingest | query | lint)
> 최근 5건: `grep "^## \[" wiki/log.md | tail -5`

## [2026-06-18] bootstrap | 위키 초기화 (골격 + 백본 시드 + 커맨드 + 감지 스크립트)

## [2026-06-18] bootstrap | 백본 시드 완료 — 9페이지 (architecture×3 + domain×3 + decisions×3), stale 0, 링크 9/9, citation 10/10 OK

## [2026-06-19] ingest | db-tests CLI grant 드리프트 — sources/db-tests-cli-grant-drift + decisions/test-db-grants 생성, rls-model 갱신(테이블 GRANT 레이어 보강). 출처 PR#179/#180

## [2026-06-19] ingest | e2e CLI grant 드리프트 — sources/e2e-cli-grant-drift 생성(같은 드리프트가 e2e도 타격, pin 2.107.0으론 미해결 반증, 명시 GRANT 마이그레이션이 수정). decisions/test-db-grants 보정(pin≠fix, 무대별 grant 위치). 출처 PR#183(run 27769458739/27787809344/27829125384)
