---
area: sources
updated: 2026-07-19
status: current
sources:
  - uniqn-mobile/src/shared/time/overnightPreview.ts
  - uniqn-mobile/src/shared/time/TimeNormalizer.ts
  - uniqn-mobile/src/components/employer/settlement/WorkTimeEditor.tsx
  - uniqn-mobile/src/components/weeklyGrid/addSlotPayload.ts
  - uniqn-mobile/src/domains/weeklyGrid/slotEdit.ts
  - docs/superpowers/specs/2026-07-17-overnight-worktime-design.md
  - PR#271
  - PR#272
  - memory/project_overnight_worktime_20260718
tags: [worktime, overnight, ssot, settlement, weekly-grid, schedule, client-only]
---

# 소스: 자정 넘는 근무시간 SSOT 통일 (PR #271, 2026-07-19)

## 핵심 사실

홀덤펍 표준 근무는 **18:00~익일 04:00**([[target-market]] 업종 특성)인데, 같은 값(시작 18:00·종료 02:00)이 화면마다 다르게 취급됐다. 규칙 자체는 이미 있었고(`parseTimeSlotToDate` — `src/utils/date/ranges.ts:101`, `end < start → +1일`), **문제는 소비의 불일치**였다(검증됨: 설계 스펙 §2 실측 감사표).

| 갈래 | 종료<시작 입력 시 (수정 전) |
|---|---|
| 근무표 슬롯 편집 | 무검증 통과, 익일 안내 없음 |
| 근무표 인원 추가 | 자유 텍스트(XSS 검증만) → 임의 문자열이 `work_logs.time_slot` 직행 |
| 정산 실측시간 | **오류 차단** + "새벽은 25:00 형식으로" 24+ 수동 표기 강요 |

여기에 [[worktime-ssot]] 우회 3곳(ScheduleDetailSheet·WorkTimeSection·GroupedScheduleCard)이 겹쳐 익일 라벨이 소실됐다. **3입력 모델 + 3표시 우회 = 6갈래**를 하나로 수렴한 것이 이 PR이다.

**클라이언트 전용 — DB 마이그레이션·서버 RPC 변경 0**(검증됨: PR#271 변경파일 28개 전부 `uniqn-mobile/src` + `docs/`). 저장 모델(`work_logs.date`·`time_slot` text) 불변, 정규화 책임을 클라 단일 파서에 둔 설계 결정(스펙 R5)의 귀결 — 덕분에 prod 마이그레이션 게이트가 없다.

## 신규 SSOT 헬퍼 — `deriveOvernightPreview`

`src/shared/time/overnightPreview.ts:44` — 입력 화면 전용 **파생** 헬퍼(저장/표시의 진실원은 여전히 `parseTimeSlotToDate` + `WorkTimeDisplay`, 파일 헤더 주석에 명시).

### 🔑 T1: `isEqual` → 0 봉인 (검증됨)

`overnightPreview.ts:49-59` — 시작 == 종료면 `durationMinutes: 0` / `durationLabel: '-'`로 **조기 반환**한다.

> `// 시작==종료는 검증 오류 상태 — 24시간으로 해석하지 않고 duration 미산정.`

**왜 중요한가:** 조기 반환이 없으면 `end <= start` 분기가 걸려 +24h 보정 → 24시간 근무로 해석되고, 12시간 초과 배너가 오발한다. "24시간 해석 없음"을 **소스 레벨에서 봉인**한 것(스펙 R1: 이 업종에서 24시간은 비현실적이며 오타일 확률이 압도적).

## 🔑 T4: `endTimeForSave` — 음수 `work_duration` 저장 차단 (검증됨, 금전 경로)

정산은 금전 직결이라 **차단 검증 제거만으론 부족했다**. `WorkTimeEditor.tsx:254-262`:

- `parseTimeInput`은 24+ 표기(26:00)만 익일 처리 → `"02:00"` 같은 **0~23 익일 입력은 same-day Date로 잔류**
- 그대로 저장하면 `checkOut < checkIn` → 영속 경로에 **음수 `work_duration` 기록**
- 대응: `timePreview.isNextDay && endTime <= startTime`일 때만 `setDate(+1)` 보정 → `handleSave`가 `endTime` 대신 `endTimeForSave` 전송(`:274`)

**이중 bump 없음** — 24+ 별칭은 이미 `parseTimeInput`이 익일화해 `endTime > startTime`이므로 조건에서 탈락한다. 표시 경로의 +24h 보정과 상보 관계.

교훈: **차단 검증을 걷어낼 땐 그 검증이 막고 있던 하류 영속 경로를 반드시 같이 본다.** 입력 UX 개선이 조용한 데이터 오염으로 번지는 전형.

## 표시 SSOT 통일 (우회 3곳, 검증됨)

전부 `WorkTimeDisplay.getDisplayInfo` 경유 + `"HH:mm – 익일 HH:mm"` 표기로 수렴:

- `ScheduleDetailSheet.tsx:135-143` — `formatTime` 직접 포맷 제거
- `WorkTimeSection.tsx:60-68` — `isOvernight` **독립 재구현(3중 구현) 삭제** → `isEndNextDay` 소비. 수정 전 테스트 커버리지 0이었음
- `GroupedScheduleCard.tsx:60-72` — `timeSlot` 원문 pass-through 제거

## 파생 계산 방어 내재화

`TimeNormalizer.calculateDurationInHours`(`TimeNormalizer.ts:68-76`)에 `diffMs < 0 → +24h` 보정 내재화. 실제 timestamptz 경로는 `end > start`라 **무영향**이고, 순수 HH:mm 직접 호출 경로가 새로 생겼을 때의 **조용한 0시간 버그**를 막는 회귀 방어다(주석에 명시).

## 인원 추가 재설계 (Task 8b) — 지원/확정 모델 정합

브리프는 시작~종료 구조화 입력이었으나, 사용자 지시로 **출근시간 단일 + "미정" 토글**로 재설계(commit `44d61c549`).

- 신규 `StartTimeField.tsx` — 정산 `TimeInputField`의 미정 체크박스 패턴을 그리드 톤으로 **로컬 미러링**(cross-domain import 지양, 파일 주석 근거)
- `addSlotPayload.ts:62` `buildTimeSlot` — 미정/미입력이면 `timeSlot` **자체를 생략**(시간 미기록). 입력 시엔 단일 `"HH:mm"`
- 근거: 지원/확정 흐름·`AddStaffModal`이 이미 "출근만 받고 퇴근은 현장에서" 모델 — 퇴근 시각을 사전에 아는 사장이 없다
- `EditSlotSheet`(시작~종료 범위)는 **불변** — 확정된 슬롯 편집은 양쪽을 다 안다

⚠️ `AddSlotSheet`는 `Modal` → `SheetModal` + overlay로 재작성됐다. 휠 피커의 **중첩 RN Modal iOS 터치 먹통**([[nativewind-rn-pitfalls]]) 회피 목적이며, **실기기 QA 미검증**이 남아 있다.

## 🔑 T7: 브리프 결함 2건 교정 (검증됨: memory 토픽)

핸드오프 브리프를 맹종하지 않고 잡은 것 — **계획서의 파일 포인터·가드 조건은 실측 대상이다**:

1. 브리프의 `rawTimeSlot` 가드는 **무력**(입력을 그대로 에코) → `parseTimeSlot().end` 게이트로 교체
2. 브리프가 지시한 `group.date`는 **부재** → `dateRange.start` 사용

같은 계열의 오진 회피가 후속에서 재현됐다(아래 HIGH 후속). 이 프로젝트의 반복 패턴: **핸드오프 문서의 파일 포인터를 코드로 재확인**.

## 검증 증거 (세션 내 실측)

- `npm run quality`: type-check **0 error** / eslint **0 error**(61건은 무관 파일 기존 warning) / prettier pass
- 관련 jest **40 suites / 258 tests PASS**(shared/time·weeklyGrid·settlement·schedule·domains/weeklyGrid)
- 우회 3곳 **Red-Green 스팟체크**: SSOT 라인 임시 파괴 → 익일 라벨/배지 3건 FAIL, 복구 → 9/9 PASS
- T6(충돌 감지 구간화)은 패리티 리팩터(달력 날짜 비교와 동치)라 **자연 RED 불가** → 통제 파괴로 테스트 유효성 검증. `slotEdit.ts:221` 표준 반열림 겹침식 `aStart < bEnd && bStart < aEnd`(경계 맞닿음은 겹침 아님)
- fable 2인 + opus 교차 리뷰, 최종 whole-branch = Merge-ready(신규 Critical/Important 0)
- 머지: squash `32ac45040`. 직전 origin/master(#269 [[seat-basis-e2e-seed-drift]]) 재통합 후 재검증 GREEN

## HIGH 후속의 결말 — "재현 불가 → 데드코드였다" (PR#272)

PR#271 본문은 `executeUpdateWorkTime` **서버측 클램프**를 HIGH 후속으로 남겼으나, 조사 결과 **위험 경로 자체가 존재하지 않았다**(PR#272 머지 `5b7daafd`, 검증됨: `grep executeUpdateWorkTime src/` → **0건**).

- 라이브 시간수정 경로 2곳(`SettlementRepository.updateWorkTimeWithTransaction` · `ConfirmedStaffRepository.updateWorkTimeWithTransaction`)은 미정(null) 시 `check_in_ts` 삭제 + `work_duration` **미기록** → 음수 발생 불가
- 음수를 쓰던 `executeUpdateWorkTime`(null-skip·무클램프)은 `workLogService.updateWorkTime`만 호출했고 그 함수는 **라이브 UI 소비자 0** = 사실상 데드코드 → 안전 제거
- 급여 금액은 애초에 `check_in/out`에서 재계산(`work_duration` 컬럼 미사용, `calculatePayByType` 음수 방어) → **머니 경로 무영향**

🔑 **#271 리뷰가 지목한 파일이 라이브 경로가 아니었다.** "함수명 재확인" 지시가 실제 라이브 repo 추적으로 이어져 오진을 회피했다 — T7과 같은 클래스의 교훈.

**현재 상태(정직한 표기):** 서버측 클램프는 여전히 **없다**. 다만 음수를 기록하던 클라 경로가 제거돼 알려진 도달 경로가 0이다. 서버는 pass-through이므로 **DB 레벨 방어는 미구현**이며, 향후 새 쓰기 경로가 `work_duration`을 직접 기록하면 재발 가능(주장: 미검증 — 새 경로 추가 시 재평가 필요).

## 잔여

- **실기기 QA(iOS/Android)** — 인원 추가 시계 선택기(`SheetModal`) 탭 동작. web/OTA 배포 **전** 수행
- web = `node scripts/deploy-cloudflare.js --force`(수동) · OTA = `eas update`(수동, 직전 origin/master 재fetch)
- Minor 정리: `TIME_RE`/`DEFAULT_END` 중복

## 관련

- [[worktime-ssot]] — 이 작업이 준수·강화한 표시 SSOT 결정(우회 3곳을 실제로 되돌린 기록)
- [[layers]] — Presentation이 Hooks/Service 경유 없이 `WorkTimeDisplay`를 직접 쓰는 예외가 적용되는 지점
- [[nativewind-rn-pitfalls]] — `AddSlotSheet`의 `SheetModal` 전환 근거(중첩 Modal iOS 터치 먹통)
- [[target-market]] — 18:00~04:00이 표준인 홀덤펍 업종 특성이 R1 규칙의 전제
- [[seat-basis-e2e-seed-drift]] — 머지 직전 재통합한 선행 master(#269)
