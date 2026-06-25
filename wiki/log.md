# Wiki Log

> 시간순 append-only. 포맷: `## [YYYY-MM-DD] <op> | <제목>` (op = bootstrap | ingest | query | lint | note)
> `note` = 프로젝트 마일스톤/스택 변경 이력(CLAUDE.md는 규칙만 유지, 변경 이력은 여기 + `CHANGELOG.md`).
> 최근 5건: `grep "^## \[" wiki/log.md | tail -5`

## [2026-06-18] bootstrap | 위키 초기화 (골격 + 백본 시드 + 커맨드 + 감지 스크립트)

## [2026-06-18] bootstrap | 백본 시드 완료 — 9페이지 (architecture×3 + domain×3 + decisions×3), stale 0, 링크 9/9, citation 10/10 OK

## [2026-06-19] ingest | db-tests CLI grant 드리프트 — sources/db-tests-cli-grant-drift + decisions/test-db-grants 생성, rls-model 갱신(테이블 GRANT 레이어 보강). 출처 PR#179/#180

## [2026-06-19] ingest | e2e CLI grant 드리프트 — sources/e2e-cli-grant-drift 생성(같은 드리프트가 e2e도 타격, pin 2.107.0으론 미해결 반증, 명시 GRANT 마이그레이션이 수정). decisions/test-db-grants 보정(pin≠fix, 무대별 grant 위치). 출처 PR#183(run 27769458739/27787809344/27829125384)

## [2026-06-23] ingest | 지갑/IAP 수익모델 전체 제거 + db-tests 회귀 — sources/wallet-iap-removal + decisions/wallet-pgtap-caller-binding 생성. revenue-model 휴면→폐기 전환(모순 플래그), rls-model 느슨 INSERT 의도 원칙 보강, test-db-grants allowlist 함수 grant 예외 명확화. 출처 memory(project_wallet_iap_removal_20260622·pitfall 2건)·PR#196(제거,✅머지 967e9f5e2+prod마이그+웹배포)·PR#198(db-tests green)

## [2026-06-25] note | CLAUDE.md 변경이력 이관 — CLAUDE.md를 "규칙 전용"으로 정리하면서 날짜 노트 5건을 여기로 옮김:
- [2026-06-25] 지갑/IAP 수익모델 전체 제거 완료(#196~206, prod 마이그·웹배포·모바일 OTA). 앱 결제표면 0. 신규 수익모델 작업 전 폐기 이력 확인. 타깃=홀덤펍+대회사(포커룸 비타깃). → `sources/wallet-iap-removal`, `domain/target-market`
- [2026-06-19] 공고 `posting_status` enum에 `capacity_full`(PR#155). 신규 status값 도입 시 read/filter Zod·공개 RLS·통계 reader 전수 갱신. LLM Wiki 운영. db-tests pgTAP는 fixture 명시 GRANT + setup-cli pin(#179/#180). → `decisions/capacity-full`, `decisions/test-db-grants`
- [2026-04-18] `job_posting_templates.description` 컬럼 추가(migration+types). JobPostingTemplate 리팩토링(userId/updatedAt 추가, createdBy/lastUsedAt 제거, usageCount 필수). edit.tsx 템플릿 저장 + TemplateModal 통합.
- [2026-04-17] Firebase 레거시 규칙/스펙 archive(docs/archive/firebase-legacy/2026-04/), Firebase MCP 제거.
- [2026-04-13] Expo 55/RN 0.83.4 업그레이드, Supabase 이전 완료, Black & Gold 완료.
