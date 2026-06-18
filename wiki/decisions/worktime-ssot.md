---
area: decisions
updated: 2026-06-18
status: current
sources:
  - memory/pitfall_worktime_display_ssot_divergence.md
  - uniqn-mobile/src/shared/time/WorkTimeDisplay.ts
  - PR#170
tags: [decisions, worktime, ssot, display, pitfall, staff-management]
---

# 결정: 근무시간 표시 SSOT — WorkTimeDisplay 경유 필수

**맥락:** 근무시간 표시가 화면마다 달랐음(카드: 예정시간 표시 / 시간수정·프로필·정산 모달: "미정"). 구인자 측 3개 화면이 `WorkTimeDisplay`를 우회하고 `checkInTime`만 직접 읽었기 때문. (검증됨: memory/pitfall_worktime_display_ssot_divergence.md, PR#170 머지 `9eae5146b`)

## SSOT 원칙 (검증됨)

`uniqn-mobile/src/shared/time/WorkTimeDisplay.ts:33` — `WorkTimeDisplay.getDisplayInfo()`:
```typescript
effective = actual(checkInTime/checkOutTime) ?? scheduled(timeSlot)
```

- 체크인 전: `timeSlot`(예정) 표시
- 체크인 후: `checkInTime/checkOutTime`(실제) 표시

## 수정 내용 (검증됨: PR#170)

| 화면 | 수정 전 | 수정 후 |
|---|---|---|
| `WorkTimeEditor` | `checkInTime` 직접 읽기 | `실제 > 예정 > 미정` 순서 초기화 |
| `StaffProfileModal` | `checkInTime` 직접 읽기 | `WorkTimeDisplay.getDisplayInfo` + "예정" 배지 |
| `SettlementDetailModal` | checkInTime 직접 읽기 | 예정 배지 표시, **정산 금액 계산은 실제시간 게이트 유지** |

저장 시 예정시간이 실제 출퇴근(`check_in_ts/check_out_ts`)으로 기록 — 사용자 결정("예정=실제 저장").

## 교훈 (핵심)

> 새 화면이 근무 출근/퇴근 시각을 그리면 **반드시 `WorkTimeDisplay.getDisplayInfo({checkInTime, checkOutTime, timeSlot, date})` 경유**.  
> `checkInTime` 직접 읽기 = 예정 폴백 누락 = "미정" 불일치 재발.

정산 표시는 통일, **금액 계산은 실제시간만** — `calculateSettlementFromWorkLog`는 `timeSlot` 안 읽음(검증됨).

## 한쪽만 기록된 중간 상태

`isEffectiveStartActual`/`isEffectiveEndActual` 개별 판단 필요. 단일 `isActualTime` 플래그로 양쪽에 "예정" 오라벨 주의.

## 관련

- [[layers]] — Presentation이 Hooks/Service 경유 없이 WorkTimeDisplay 직접 사용하는 예외
- [[enum-divergence]] — "표시 SSOT 우회" 계열(읽기 경로 단락 클래스 공유)
- [[capacity-full]] — 공고 상태와 함께 UI 표시 정합성 관리 사례
