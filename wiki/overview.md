---
area: architecture
updated: 2026-07-28
status: current
sources:
  - CLAUDE.md
  - docs/analysis/2026-07-27-operations-billing-design.md
  - memory/project_target_market_pivot.md
  - memory/project_wallet_iap_removal_20260622.md
tags: [overview, hub, moc]
---

# T-HOLDEM 위키 — 여기서 시작 (MOC)

UNIQN은 홀덤펍·대회사 대상 단발 인력 매칭 앱이다. Expo 55 / RN 0.83.4 / React 19.2 / TypeScript strict / NativeWind 4.2 / Supabase 스택으로 구동된다. (검증됨: CLAUDE.md)

과거 비즈니스 모델의 이중통화(하트·다이아)·IAP는 **전체 제거됐다**(구인구직엔 불필요, PR#196/#198). 신규 수익모델은 2026-07-27 **설계 확정·구현 미착수** 상태다 — 매칭은 영구 무료, 과금은 매칭 이후 운영 레이어(매장 월 5만 / 대회 건당 10만 / 긴급공고 1만). ([[revenue-model]] · [[revenue-model-rebuild-2026-07]] · [[wallet-iap-removal]])

코드베이스의 핵심 아키텍처 리스크는 반복 발생한 **enum 발산 → 읽기 레코드 증발** 패턴(3회)과 **RLS 재귀**(2건 함정)다. 매칭 앱과 별개로 **대회 라이브 운영 엔진**(ops 1a~1f)이 대형 서브시스템으로 prod 출하됐다 — [[ops-engine]].

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
- [[data-flow]] — 공고 조회의 실제 흐름
- [[rls-model]] — RLS 3계층 + anon 독소 / JPC 재귀 / WITH CHECK 재귀 3가지 함정
- [[ops-engine]] — 대회 운영 엔진(이벤트 스파인·SECDEF 쓰기·anon SECDEF 2 계약)

### 도메인
- [[roles]] — UserRole(앱권한) ≠ StaffRole(직무) 혼동 주의
- [[target-market]] — 홀덤펍 단발 알바 + 대회사 D-day 집중 인력
- [[revenue-model]] — 매칭 무료 · 운영 레이어 과금(설계 확정, 구현 미착수). 폐기된 이중통화·IAP 이력은 페이지 하단

### 결정(ADR·Pitfall)
- [[enum-divergence]] — 새 enum 값 추가 시 Zod + status reader 전수 갱신 체크리스트
- [[worktime-ssot]] — 근무시간 화면은 반드시 `WorkTimeDisplay.getDisplayInfo` 경유
- [[capacity-full]] — 정원마감 자동전이 트리거 + dead counter 단일화

## 운영

- 규약·워크플로우: [[AGENTS]]
- 질문: `/query` · 소스 반영: `/ingest` · 건강진단: `/lint`
- 최신화 진단: `bash wiki/scripts/check-staleness.sh` (stale / UNVERIFIABLE)
