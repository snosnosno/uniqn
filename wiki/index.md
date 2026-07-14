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
- [[prod-parity-baseline]] — prod가 진실: baseline squash 채택 이유(함수163vs142·정책103vs173 발산) + 가드 2중 + MCP 핫픽스=같은 PR 가드 갱신 규율 (PR#241)
- [[whitelist-silent-drop]] — "화이트리스트 조용한 증발" 재발 클래스(3회 실증: #194 region·#243 filled counts·conditions 9지점) — 신규 필드는 지점 전수+읽기 방향 테스트+표시 UI 별도 확인
- [[order-sheet-form-contract]] — 주문서 폼 계약: 3제네릭 zodResolver(z.input/z.output)·canonical 매퍼 등가성·Design B(단일화면 카드+시트)·#244 지연전환·중첩Modal embedded (PR#246/#247)
- [[secdef-hardening]] — SECURITY DEFINER 함수 하드닝 3규칙: anon EXECUTE 명시 REVOKE·search_path에 extensions·plpgsql NULL fail-open 차단 (memory 졸업, PR#195)
- [[supabase-write-pitfalls]] — Supabase 쓰기 경로 함정 종합: 카운터 트리거·realtime publication·RPC 예외 매핑·시드 zod·storage 정책·존재하지 않는 테이블 (memory 졸업)
- [[nativewind-rn-pitfalls]] — NativeWind/RN UI 함정: 동적 className dark: 유실·flex-1 붕괴·Link asChild 터치 유실·중첩 accessibilityRole hydration (memory 졸업, PR#136)

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
- [[parity-baseline-squash]] — baseline squash 실행 기록: pg_dump 함정 5종 + E2E 함정 2종(프로필 시드 소실·master 거짓 GREEN) + prod 진실 교정 — ✅PR#241
- [[userflow-audit-2026-07]] — 코어 유저플로우 실측 감사→P0~P2 전항 수정(적대검증 44% 기각·prod 재판정·postingAuthority 신설) — ✅PR#242
- [[ios-userflow-fixes]] — iOS 유저플로우 버그 8종+신고모달 승격+타이머 후속(filled counts 서브맵 함정 포함) — ✅PR#243·#244
- [[job-posting-kiosk-order-sheet]] — 공고작성 키오스크 "주문서" 개편(단일화면 카드+프리셋+conditions) — ✅PR#246 본·#247 후속(모집조건 표시+폴리시)·마이그·OTA `4193f9ab`
