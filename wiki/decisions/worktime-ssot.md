---
area: decisions
updated: 2026-09-19
status: current
sources:
  - memory/pitfall_worktime_display_ssot_divergence.md
  - uniqn-mobile/src/shared/time/WorkTimeDisplay.ts
  - PR#170
  - PR#271
  - PR#497
  - uniqn-mobile/supabase/migrations/20260918105900_qr_checkout_candidate_uses_scan_time.sql
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

## 확장 — 자정을 넘는 근무 (PR#271)

같은 SSOT 원칙을 **계산(duration)** 축으로 확장했다. 자정을 넘는 근무에서 입력 3경로·표시 3우회가 각자 계산하던 것을 단일 지점으로 수렴시키고, 음수 `work_duration` 저장을 차단했다(`endTimeForSave`). 클라이언트 전용 변경이라 **서버측 정산 클램프는 아직 없다** — 잔여 리스크. 상세: [[overnight-worktime-ssot]].

## 확장 — 정규화된 시각과 원본 스캔 시각은 다른 축이다 (2026-09-19, 서버)

`check_in_ts` 는 15분 단위로 **올림(ceil) 정규화**된 값이고(`20260909135618`),
`check_in_scanned_at` 은 실제로 QR 을 찍은 **원본 시각**이다. 이 둘을 같은 축으로 쓰면 파생 구간이
깨진다.

실사고: 퇴근 후보 구간이 `v_scanned_at BETWEEN check_in_ts AND check_in_ts + 16h` 였는데
정규화 때문에 `check_in_ts` 가 최대 15분 **미래**라, 출근 직후 재스캔하면 후보가 0 이 됐다.
막히는 것 자체는 옳지만(0시간 기록 방지) 스태프가 보는 문구가
`checkout_too_early`("잠시 후") 대신 `no_eligible_work_log`("해당 근무가 없습니다")로 바뀐다.

🔑 **표시·정산용 정규화 시각과 "언제 실제로 찍었나"는 별개다. 구간·후보 판정의 하한은
원본 스캔 시각을 쓴다** — `COALESCE(wl.check_in_scanned_at, wl.check_in_ts)`
(`20260918105900`, prod 적용 완료).

⚠️ **미해결 선재 갭**: `check_in_scanned_at` 은 보호 트리거로 불변인데 `check_in_ts` 는
`update_work_log_slot` 으로 자유롭게 수정되고, 둘의 관계를 강제하는 CHECK·트리거가 없다
(`pg_constraint` 실측). 관리자가 출근을 16시간 이상 앞당기면 구간이 역전된다. 회귀는 아니다
(옛 구간도 같은 시나리오에서 0건) — 근본 해결은 `update_work_log_slot` 이 원본 스캔시각을 함께
클램프할지의 **제품 판단**이다. 상세는 마이그 헤더 주석 · [[db-red-fix-and-release-2026-09]].

## 관련

- [[overnight-worktime-ssot]] — 자정 넘는 근무시간 SSOT 확장(PR#271)
- [[layers]] — Presentation이 Hooks/Service 경유 없이 WorkTimeDisplay 직접 사용하는 예외
- [[enum-divergence]] — "표시 SSOT 우회" 계열(읽기 경로 단락 클래스 공유)
- [[capacity-full]] — 공고 상태와 함께 UI 표시 정합성 관리 사례
- [[error-vs-empty-state]] — "막혔다"를 "없다"로 보여주면 사용자가 원인을 오인한다(위 QR 사례의 UX 축)
