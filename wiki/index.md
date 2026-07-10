# Wiki Index

> 전 위키 페이지 카탈로그. 질문 답변 시 여기부터 읽고 페이지로 드릴다운.
> 규약: [[AGENTS]] · 시작점: [[overview]]

## architecture
- [[layers]] — Presentation→Hooks→Service→Repository→Supabase 단방향 5레이어
- [[data-flow]] — 대표 데이터 흐름(읽기 TanStack Query 예외 + 쓰기 Service 경유)
- [[rls-model]] — RLS 정책 3계층 + 재귀/SECDEF 함정 3건
- [[ops-engine]] — 대회 운영 엔진(ops 1a~1f): 이벤트 스파인·SECDEF 쓰기 경계·anon SECDEF 2 불변·서버앵커 클럭

## decisions
- [[enum-divergence]] — enum 발산 → 읽기 레코드 증발 방지 규칙 (3회 재발 클래스)
- [[worktime-ssot]] — 근무시간 표시 SSOT(WorkTimeDisplay) 우회 금지
- [[capacity-full]] — 공고 자동마감 capacity_full + dead counter 제거
- [[test-db-grants]] — 테스트 DB는 명시 GRANT + setup-cli 버전 pin (기본 default-privilege 의존 금지)
- [[wallet-pgtap-caller-binding]] — 변이 RPC auth.uid() 바인딩 하드닝이 pgTAP db-tests 깨뜨림 (PR#195→#198, JWT 주입 수정)
- [[knip-signal-hygiene]] — knip 신호 정화: 래칫 게이트 + 안전 삭제 프로토콜(미사용≠죽음 ~65% 보존, tsc 오라클, 배럴 협응삭제, stale-base 안전망) (PR#231)
- [[migration-timestamp-collision]] — 병렬 세션이 같은 마이그 타임스탬프 → 병합 후 db reset `schema_migrations_pkey` 23505, 신규분 리네임 해소 (MCP-apply prod는 무관)
- [[ops-no-money-flow]] — ops 엔진 돈-흐름 비관여 경계: 프라이즈 계산만, 바이인 결제·시드권 발급·상금 정산 금지 (관광진흥법 카지노업 유사행위 리스크)

## domain
- [[roles]] — UserRole(앱권한: admin/employer/staff) vs StaffRole(직무: dealer/floor/serving)
- [[target-market]] — 홀덤펍 + 대회사 (포커룸 비타깃)
- [[revenue-model]] — ⚠️ 이중통화(하트·다이아)·IAP — **전체 제거 완료**(PR#196 머지 `967e9f5e2`, [[wallet-iap-removal]])

## sources
- [[db-tests-cli-grant-drift]] — pg_prove red 근본원인: setup-cli `version:latest` 드리프트로 implicit 테이블 GRANT 소실 (PR#179/#180)
- [[e2e-cli-grant-drift]] — e2e ~96% red 같은 드리프트, pin(2.107.0)으론 미해결 → 명시 GRANT 마이그레이션이 수정 (PR#183)
- [[wallet-iap-removal]] — 지갑/IAP 수익모델 전체 제거 (구인구직엔 불필요) — ✅PR#196/#198 머지·prod 마이그·웹 배포
- [[knip-unused-export-triage]] — 미사용 export ~3000건 단계별 정리 (2951→2313, 래칫+리프 죽은코드) — ✅PR#231 머지 `c75d78add`
- [[ops-1e-staff-integration]] — 대회 스태프 슬라이스: ops_staff·공고 N:1 연결(owner)·work_logs 스냅샷 import(읽기 전용)·딜러 배정(move) — ✅PR#230 머지·prod 마이그
