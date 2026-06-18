---
area: domain
updated: 2026-06-18
status: current
sources:
  - memory/project_target_market_pivot.md
tags: [domain, market, holdem-pub, tournament, target]
---

# 타깃 시장

**한 줄:** 홀덤펍(단발 알바) + 대회사(D-7~D-day 집중 인력) 두 주체. 포커룸은 타깃 아님. (주장: memory/project_target_market_pivot.md)

## 두 타깃 주체

### 홀덤펍 사장 (employer)
- 상시적이지 않은 단발성 인력 수요
- 딜러/플로어/서빙 역할군
- 소규모 운영, 마켓플레이스 적합도 높음

### 대회사 운영팀 (employer)
- 대회 D-7~D-day 집중 인력 수요
- 토너먼트 디렉터/칩러너/레지스트레이션 등 별도 역할군 필요 가능성 (주장)
- 최대 ARPU 잠재 세그먼트(현재 과금 0, [[revenue-model]] 참조)

## 포커룸 비타깃 이유 (주장: memory 기반)

포커룸은 자체 인력 풀/관리 시스템 보유 → 외부 앱 도입 의향 낮음. 도메인 분석·UX 설계 시 포커룸 시나리오 후순위 또는 제외.

## 설계 적용

- DB 스키마/RPC 설계 시 가정 주체: 홀덤펍 사장(상시 단발 알바) + 대회사 운영팀(집중 단기)
- `StaffRole`(`dealer/floor/serving`)도 두 주체 관점 재검토 필요 (주장)
- 스케줄 스키마 통일(SP1/SP2/SP3)은 두 주체의 불규칙 일정 요구에 대응하는 기반 (주장)

## CLAUDE.md 문구 정정

CLAUDE.md 1줄 "포커룸 스태프 관리 앱" 표현은 outdated. 실제: "홀덤펍·대회사 대상 단발 인력 매칭 앱" (검증됨: memory/project_target_market_pivot.md — 사용자 명시 2026-05-28).

## 관련

- [[revenue-model]] — 대회사가 최대 ARPU 잠재 세그먼트(현재 과금 미적용)
- [[roles]] — employer/staff UserRole과 타깃 매핑
- [[data-flow]] — 구인/구직 흐름의 비즈니스 컨텍스트
