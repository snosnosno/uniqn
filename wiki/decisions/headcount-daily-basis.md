---
area: decisions
updated: 2026-07-24
status: current
sources:
  - uniqn-mobile/docs/superpowers/specs/2026-07-23-headcount-daily-basis-display-design.md
  - uniqn-mobile/src/components/jobs/shared/postingSurfaceModel.ts
  - uniqn-mobile/src/domains/schedule/postingHydrateKeys.ts
  - uniqn-mobile/src/components/jobs/AssignmentSelector/RoleCheckbox.tsx
  - PR#309
tags: [decisions, headcount, display-contract, waitlist, hydrate-keys]
---

# 결정: 인원 표시는 하루 기준 분수 — 분자=일별 max, 마감=대기 지원

**맥락:** 그룹(다일) 공고에서 인원을 어떻게 세어 보여줄지가 화면마다 달랐다(카드=곱셈, 상세=하루, 지원화면=항상 0). 사용자 확정(2026-07-23, 재논의 금지)으로 전 화면 단일 계약 수립. (검증됨: PR#309 머지 `ceb420ac9`)

## 표시 계약 (C안)

| 항목 | 계약 | 근거 |
|---|---|---|
| 형식 | 분수 유지 `딜러 5명 (2/5)` — "남은 자리" 표기 금지 | 사용자 확정 |
| 분모 | **하루 요구**(`schedule.roles[].count` 그대로) — 곱셈(`하루×일수`) 폐기 | 저장 형식이 이미 하루치 |
| 분자 | **날짜별 확정의 max** — 합·평균 금지 | 통지원(그룹 일괄 배정) 전제에서 `분모−max`만이 실제 추가 수용 인원 |
| 마감 | `max ≥ 하루 요구` → 마감 표시, **지원은 계속 허용**(대기 성격) | 뱃지 `마감 · 대기 지원 가능`. 자동 승계 기능 없음 — "자동 배정" 류 문구 금지 |
| 자리 총계 | 구인자 카드만 `자리 M/T 채움` 병기(Σ일별, `computeSeatTotals`) — 구직자 카드·구인자 상세 불변 | 다일 그룹만(단일 날짜=요약과 동일해 생략) |
| DB | **완전 불변** — 트리거·저장 형식·`MAX_CAPACITY_REACHED` 서버 가드 무접촉 | 표시 계층 전용 |

## 파생 규칙 (코드로 검증됨)

- **hydrate 키 단일 소스**: `date__slotKey__roleKey` 파생은 `src/domains/schedule/postingHydrateKeys.ts`의 `slotHydrateKey`/`roleHydrateKey`만 사용(TBA→`미정`, other→`other:${custom ?? ''}`). 클라 어디서든 재구현 금지 — 중복 구현 드리프트는 조용한 (0/N) 회귀([[headcount-daily-basis-display]] 교훈 1).
- **dead counter 금지 계승**: `schedule.roles[].filled`는 표시·판정 어디서도 읽지 않는다([[capacity-full]] 결정 2와 동일 축).
- **그룹 승격은 키 매칭**: 그룹 표시 분자 계산은 slotIndex가 아닌 키 매칭 — 표시 정렬(시작시간 순)과 독립.

## 층위 구분 — [[capacity-full]]과의 관계

- 이 계약의 "마감"은 **역할·하루 단위 표시**이며 지원을 막지 않는다(대기 접수).
- 공고 단위 자동마감은 여전히 서버 `capacity_full` 상태 전이(job_postings BEFORE 트리거) 소관 — 좌석(Σ) 기준.
- 즉 분자=max(표시)와 filled_positions=Σ좌석(서버 상태)은 **의도된 이원화**: 전자는 "지금 통지원 가능한가", 후자는 "공고 전체가 찼는가"에 답한다. 모순 아님.

## 관련

- [[headcount-daily-basis-display]] — 출하 기록·교훈(PR#309)
- [[capacity-full]] — 공고 단위 자동마감·dead counter 제거
- [[seat-basis-e2e-seed-drift]] — filled_positions 좌석 기준의 원천
- [[whitelist-silent-drop]] — 키스페이스 드리프트 재발 클래스
