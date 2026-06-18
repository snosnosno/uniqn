# Wiki Index

> 전 위키 페이지 카탈로그. 질문 답변 시 여기부터 읽고 페이지로 드릴다운.
> 규약: [[AGENTS]] · 시작점: [[overview]]

## architecture
- [[layers]] — Presentation→Hooks→Service→Repository→Supabase 단방향 5레이어
- [[data-flow]] — 대표 데이터 흐름(읽기 TanStack Query 예외 + 쓰기 Service 경유)
- [[rls-model]] — RLS 정책 3계층 + 재귀/SECDEF 함정 3건

## decisions
- [[enum-divergence]] — enum 발산 → 읽기 레코드 증발 방지 규칙 (3회 재발 클래스)
- [[worktime-ssot]] — 근무시간 표시 SSOT(WorkTimeDisplay) 우회 금지
- [[capacity-full]] — 공고 자동마감 capacity_full + dead counter 제거
- [[test-db-grants]] — 테스트 DB는 명시 GRANT + setup-cli 버전 pin (기본 default-privilege 의존 금지)

## domain
- [[roles]] — UserRole(앱권한: admin/employer/staff) vs StaffRole(직무: dealer/floor/serving)
- [[target-market]] — 홀덤펍 + 대회사 (포커룸 비타깃)
- [[revenue-model]] — 이중통화(하트·다이아)·IAP·RevenueCat (게이트 OFF 휴면)

## sources
- [[db-tests-cli-grant-drift]] — pg_prove red 근본원인: setup-cli `version:latest` 드리프트로 implicit 테이블 GRANT 소실 (PR#179/#180)
