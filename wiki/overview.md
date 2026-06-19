---
area: architecture
updated: 2026-06-19
status: current
sources:
  - CLAUDE.md
  - memory/project_target_market_pivot.md
  - memory/project_revenue_model_audit_20260609.md
tags: [overview, hub, moc]
---

# T-HOLDEM 위키 — 여기서 시작 (MOC)

UNIQN은 홀덤펍·대회사 대상 단발 인력 매칭 앱이다. Expo 55 / RN 0.83.4 / React 19.2 / TypeScript strict / NativeWind 4.2 / Supabase 스택으로 구동된다. (검증됨: CLAUDE.md)

비즈니스 모델은 이중통화(하트·다이아) 기반 공고 게시 차감 + IAP 충전이지만, 현재 서버 게이트(`_calc_posting_cost`=0) 휴면 중이다. (주장: memory/project_revenue_model_audit_20260609.md)

코드베이스의 핵심 아키텍처 리스크는 반복 발생한 **enum 발산 → 읽기 레코드 증발** 패턴(3회)과 **RLS 재귀**(2건 함정)다.

> 📊 아래 표는 **Dataview 플러그인**이 설치돼 있으면 자동 생성된다(미설치 시 코드블록 그대로 표시). 플러그인 없이도 맨 아래 **정적 허브 링크**로 탐색 가능.

## ⚠️ 주의 필요 (자동)

`status`가 `current`가 아닌(= stale·draft) 페이지. 비어 있으면 건강한 상태:

```dataview
table status, updated, file.mtime as "수정됨"
from "wiki"
where status != "current" and file.name != "overview"
sort updated asc
```

> file 소스가 없는 페이지(memory/PR# 전용)는 staleness 자동추적 대상이 아니다 → 터미널 `bash wiki/scripts/check-staleness.sh`의 **UNVERIFIABLE** 목록으로 별도 확인.

## 🗺️ 영역별 카탈로그 (자동)

### architecture
```dataview
table updated, status, join(file.tags, ", ") as tags
from "wiki/architecture"
sort file.name asc
```

### decisions
```dataview
table updated, status, join(file.tags, ", ") as tags
from "wiki/decisions"
sort file.name asc
```

### domain
```dataview
table updated, status, join(file.tags, ", ") as tags
from "wiki/domain"
sort file.name asc
```

### sources
```dataview
table updated, join(file.tags, ", ") as tags
from "wiki/sources"
sort file.name asc
```

## 🔗 허브 링크 (정적 폴백 — 플러그인 없이도 동작)

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

- 규약·워크플로우: [[AGENTS]]
- 질문: `/query` · 소스 반영: `/ingest` · 건강진단: `/lint`
- 최신화 진단: `bash wiki/scripts/check-staleness.sh` (stale / UNVERIFIABLE)
