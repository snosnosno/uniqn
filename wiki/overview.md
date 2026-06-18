---
area: architecture
updated: 2026-06-18
status: current
sources:
  - CLAUDE.md
  - memory/project_target_market_pivot.md
  - memory/project_revenue_model_audit_20260609.md
tags: [overview, hub]
---

# T-HOLDEM 위키 — 여기서 시작

UNIQN은 홀덤펍·대회사 대상 단발 인력 매칭 앱이다. Expo 55 / RN 0.83.4 / React 19.2 / TypeScript strict / NativeWind 4.2 / Supabase 스택으로 구동된다. (검증됨: CLAUDE.md)

비즈니스 모델은 이중통화(하트·다이아) 기반 공고 게시 차감 + IAP 충전이지만, 현재 서버 게이트(`_calc_posting_cost`=0) 휴면 중이다. (주장: memory/project_revenue_model_audit_20260609.md)

코드베이스의 핵심 아키텍처 리스크는 반복 발생한 **enum 발산 → 읽기 레코드 증발** 패턴(3회)과 **RLS 재귀**(2건 함정)다.

## 허브 링크

### 아키텍처
- [[layers]] — 레이어별 의존 원칙 + 예외(TanStack Query 직접 호출)
- [[data-flow]] — 공고 조회·지갑 차감의 실제 흐름
- [[rls-model]] — RLS 3계층 + anon 독소 / JPC 재귀 / WITH CHECK 재귀 3가지 함정

### 도메인
- [[roles]] — UserRole(앱권한) ≠ StaffRole(직무) 혼동 주의
- [[target-market]] — 홀덤펍 단발 알바 + 대회사 D-day 집중 인력
- [[revenue-model]] — 이중통화 구조 + 출시 게이트 잔여 작업

### 결정(ADR·Pitfall)
- [[enum-divergence]] — 새 enum 값 추가 시 Zod + status reader 전수 갱신 체크리스트
- [[worktime-ssot]] — 근무시간 화면은 반드시 `WorkTimeDisplay.getDisplayInfo` 경유
- [[capacity-full]] — 정원마감 자동전이 트리거 + dead counter 단일화

## 운영

규약·워크플로우는 [[AGENTS]] 참조. 최신화 진단: `bash wiki/scripts/check-staleness.sh`.
