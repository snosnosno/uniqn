# 자정 넘는 근무시간 근본 처리 — 설계 스펙

> 작성: 2026-07-17 · 상태: 사용자 검토 대기
> 배경: 세 기능(공유·워크스페이스·주간그리드) 통합 분석에서 우선작업으로 지정.
> 실측 근거: 본 세션 자정 처리 전수 감사(Explore, 파일:라인 전부 실측).

## 1. 한 줄 목적

홀덤펍의 기본 근무(18:00~익일 04:00)가 앱 전체에서 **하나의 해석 규칙·하나의 표시·하나의 계산**으로 동작하게 한다. 필요인원 자동 파생(후속 작업)의 기반.

## 2. 현재 상태 (실측 요약)

**규칙은 이미 있다.** `parseTimeSlotToDate`(`src/utils/date/ranges.ts:139-142`)가 `end < start → +1일`을 구현하고, `WorkTimeDisplay.isEndNextDay`(`src/shared/time/WorkTimeDisplay.ts:52-58`)가 "익일" 표시 플래그를 제공하며, 테스트 7건(ranges 1·WorkTimeDisplay 4·SettlementCalculator 2)이 고정한다.

**문제는 불일치다.** 같은 값(예: 18:00 시작, 02:00 종료)이 화면마다 다르게 취급된다:

| 경로 | 파일:라인 | 종료<시작 입력 시 |
|---|---|---|
| 근무표 슬롯 편집 | `EditSlotSheet.tsx:60-67, 202-231` | 무검증 통과. 피커 0~23 클램프로 익일 여부 안내 없음. 표시 시점에만 암묵적 익일 |
| 근무표 인원 추가 | `AddSlotSheet.tsx:386-391` | 자유 텍스트(XSS 검증만) — 임의 문자열이 그대로 `work_logs.time_slot` 저장 |
| 정산 실측시간 수정 | `WorkTimeEditor.tsx:231-235, 409-417` | **오류 차단** + "새벽은 25:00 형식으로 입력하세요"(24+ 수동 표기 강요) |
| 공고 주문서 | `orderSheet.schema.ts:49-52` | endTime 필드 없음 — 구조적으로 발생 불가 |

**SSOT 우회 3곳** (wiki `decisions/worktime-ssot` 위반):

| 화면 | 파일:라인 | 증상 |
|---|---|---|
| ScheduleDetailSheet | `ScheduleDetailSheet.tsx:179` | `formatTime` 직접 포맷 → "18:00 - 02:00"만 표시, **익일 라벨 소실** |
| WorkTimeSection(정산 상세) | `WorkTimeSection.tsx:59-60,109-115` | `isOvernight` 독립 재구현(3중 구현), **테스트 0** |
| GroupedScheduleCard | `GroupedScheduleCard.tsx:167-172` | `timeSlot` 원문 pass-through, 익일 라벨 없음 |

**미정의 엣지**: `end == start` → duration 계산 2곳(`WorkTimeDisplay.calculateDuration:98-121`, `TimeNormalizer.calculateDurationInHours:68-71`) 모두 0시간. `TimeNormalizer`는 자정 보정 자체가 없어 "HH:mm" 직접 호출 경로가 생기면 조용히 0시간 버그 재발 가능. 충돌 감지(`slotEdit.ts:206-221`)는 같은 시작시각만 비교 — 익일 구간 겹침 미감지.

## 3. 스펙 규칙 (확정)

### R1 — 해석 규칙은 하나, 묻지 않는다
- `종료 < 시작 → 익일(+1일)`. 파서 SSOT = 기존 `parseTimeSlotToDate` (신규 구현 금지, 소비 통일).
- `종료 == 시작 → 검증 오류` ("시작과 종료 시간이 같아요. 다시 확인해주세요."). 24시간 근무 해석은 채택하지 않는다 — 이 업종에서 비현실적이며 오타일 확률이 압도적.
- 토글·체크박스 없음. 자동 판정 결과를 즉시 보여주고 확인만 받는다.

### R2 — 입력 UX 통일 (3모델 → 1모델)
- 피커는 **0~23 유지** (사장의 자연 어휘). 24+/"25:00" 표기 강요 제거.
- 종료 < 시작이 되는 순간 인라인 프리뷰: **"익일 HH:mm 종료 · 총 N시간"** (기존 WorkTimeEditor 경고 배너 패턴 재사용, 색은 info).
- `WorkTimeEditor`(정산)의 차단 검증 제거 → 동일한 자동 판정 + 프리뷰로 전환. 단 실측시간은 금전 직결이므로 **총 근무시간 12시간 초과 시 비차단 강조 배너**("근무 시간이 N시간이에요. 맞는지 확인해주세요.")를 노출. (차단형 다이얼로그는 중첩 RN Modal 함정·confirmAction 시그니처 미검증 리스크로 후속 과제로 분리 — 구현 계획 Task 4 참조.)
- 24+ 입력(`timeEditorUtils.parseTimeInput` 0~47)은 **입력 별칭으로 유지**하되 내부에서 즉시 0~23 + 익일로 정규화 (기존 사용자 습관 보호).
- `AddSlotSheet` 자유 텍스트 시간대 → 시작/종료 구조화 입력(EditSlotSheet과 동일 패턴)으로 교체. 최소 범위: `HH:mm~HH:mm` 정규식 검증 + 동일 프리뷰.

### R3 — 표시는 WorkTimeDisplay 단일 경유
- 우회 3곳 교정: ScheduleDetailSheet(`getDisplayInfo` 경유 + 익일 라벨), WorkTimeSection(`isOvernight` 재구현 삭제 → `isEndNextDay` 소비), GroupedScheduleCard(SSOT 경유 라벨).
- 표기 통일: `"18:00 – 익일 04:00"` (기존 ConfirmedStaffCard 패턴).

### R4 — 파생 계산 방어 내재화
- `TimeNormalizer.calculateDurationInHours`에 자정 보정 내재화(end < start → +24h) 또는 순수 HH:mm 직접 호출을 타입으로 차단 — 구현 계획에서 택1 (기본 권고: 보정 내재화 + 기존 timestamptz 경로 무영향 확인 테스트).
- 날짜 귀속은 **시작일 기준** 현행 유지·명문화 (`get_venue_day_slots`의 `wl.date` exact match). 다음날 셀 분할은 비목표.

### R5 — 저장 모델 불변 (DB 마이그레이션 없음)
- `work_logs.date`(text)·`time_slot`(text) 스키마 그대로. 서버(add_direct_staff)는 pass-through 유지.
- 정규화 책임은 클라이언트 단일 파서(R1). 이 결정으로 본 작업은 **클라이언트 전용 PR** — prod 마이그레이션 게이트 없음.

### R6 — 충돌 감지 구간화 (P2, 별도 커밋)
- `detectSlotConflicts`를 시작시각 동일성 → **익일 확장 후 실제 구간 겹침**으로 확장. 기존처럼 경고(차단 아님) 유지.

## 4. 비목표 (Non-goals)

- 자정 넘는 슬롯의 다음날 셀 분할 표시 (귀속은 시작일 고정)
- 공고 requirements에 endTime 추가 (주문서는 startTime-only 유지 — 제품 결정 별도)
- work_logs 스키마 변경·서버 RPC 수정
- 필요인원 자동 파생 (후속 작업 — 본 작업이 그 기반)

## 5. 구현 대상 (감사 우선순위 승계)

| 순위 | 대상 | 작업 |
|---|---|---|
| P0 | `WorkTimeEditor.tsx` + `timeEditorUtils.ts` | 차단 제거 → 자동 판정+프리뷰, 24+ 별칭 정규화, 12h 확인 다이얼로그 |
| P0 | `EditSlotSheet.tsx` | 저장 전 판정(R1), 익일 프리뷰, end==start 오류 |
| P1 | `ScheduleDetailSheet.tsx:179` | SSOT 경유 + 익일 라벨 |
| P1 | `WorkTimeSection.tsx` | isOvernight 삭제 → isEndNextDay + 테스트 신설 |
| P1 | `GroupedScheduleCard.tsx` | SSOT 경유 라벨 |
| P1 | `TimeNormalizer.ts:68-71` | 자정 보정 내재화 |
| P2 | `AddSlotSheet.tsx` + `addSlotPayload.ts` | 구조화 시간 입력 + 정규식 검증 |
| P2 | `slotEdit.ts:206-221` | 구간 겹침 충돌 감지 |
| P3 | 테스트 | 아래 §6 |

## 6. 테스트 계획

- **기존 유지**: ranges 1 · WorkTimeDisplay 4 · SettlementCalculator 2 (회귀 기준선).
- **신규**: EditSlotSheet 저장 시 익일 판정/end==start 오류 · WorkTimeSection 익일 배지(현재 커버리지 0) · TimeNormalizer 보정(18:00→02:00=8h; end==start는 순수 함수에선 0 유지 — 검증 오류는 입력 계층(R1) 책임) · timeEditorUtils "25:00→01:00 익일" 정규화 · ScheduleDetailSheet 익일 라벨.
- **재작성**: WorkTimeEditor "24+ 강제" 테스트들 → "자동 익일 추론 + 12h 확인" 시나리오로.
- Red-Green: 우회 3곳은 수정 전 실패 테스트 먼저(익일 라벨 부재를 잡는 테스트).

## 7. 리스크

| 리스크 | 대응 |
|---|---|
| WorkTimeEditor는 정산(금전) 직결 — UX 변경 회귀 | 12h 확인 다이얼로그 + 기존 timeEditorUtils 테스트 재작성으로 이중 안전망 |
| 24+ 표기에 익숙해진 기존 사용자 | 별칭 입력 유지(내부 정규화)로 습관 보호 |
| KST 자정 경계 테스트 플레이크 | 기존 함정 메모(toISOString KST 00~09시) 준수 — 고정 시각 픽스처 사용 |
| e2e 부재 | 본 PR 범위에서는 유닛/컴포넌트 테스트로 한정, e2e는 후속 |

## 8. 구현 반영 (2026-07-18, 브랜치 `feat/overnight-worktime`)

Task 1~10 SDD 구현 완료. 각 Task = TDD 사이클 1커밋(+ 필요 시 리뷰 fix 커밋). 서버/DB 무변경(클라이언트 전용).

### 스펙 대비 실현 및 조정
- **R1/R2 확정 반영**: 해석 규칙(종료<시작=익일, 종료==시작=오류)·0~23 피커·24+ 별칭 정규화·인라인 프리뷰 전부 구현. **12h는 비차단 강조 배너**로 확정(차단 다이얼로그 아님 — 중첩 RN Modal 함정·confirmAction 미검증 회피).
- **R1 엣지 봉인(Task 1)**: `deriveOvernightPreview`가 시작==종료 시 `durationMinutes:0/durationLabel:'-'`를 반환하도록 조기반환 — "24시간 해석 없음" 규칙을 소스에서 강제(후속 소비 화면의 12h 배너 오발 차단).
- **R2 정산 안전(Task 4)**: 차단검증 제거만으로는 0~23 익일 입력(예: 02:00)이 same-day Date로 남아 영속경로 `work_duration` 음수 기록 위험 → 입력계층 `endTimeForSave` 익일 보정 추가(24+ 별칭은 이중 bump 없음). Task 2의 표시경로 +24h 보정과 상보(이중보정 아님, 리뷰 실측 확인).
- **R3 표시 SSOT(Task 5·6·7)**: 우회 3곳 교정. Task 7에서 브리프 스니펫 2결함 실측 교정(`rawTimeSlot` 가드 무력→`parseTimeSlot().end` 게이트, `group.date` 부재→`dateRange.start`). Task 6는 패리티 리팩터(달력날짜 비교 동치)로 배지 동작 보존.
- **R4(Task 2)/R6(Task 9)**: TimeNormalizer 자정 보정 내재화 / detectSlotConflicts 시작동일성→반열림 구간 겹침(자정 포함). Task 9 유일 소비처(EditSlotSheet) 경고 문구도 "구간 겹침" 의미로 정정.

### P2 범위 확장 (Task 8 — 사용자 결정 대기)
- AddSlotSheet 자유텍스트→구조화 입력 구현 과정에서 휠 피커 호스팅을 위해 `Modal`→`SheetModal`+overlay 이관 필요(중첩 Modal iOS 터치먹통 회피, AddStaffModal 검증 패턴). 공용 `OvernightPreviewBanner`·`SlotTimeField` 추출(EditSlotSheet도 소비).
- **사용자 결정 2건**: (a) 시간 "선택" 옵션 소멸(구조화 피커 기본값 18:00–02:00, 비울 방법 없음) = 제품 결정, (b) SheetModal 이관 실기기 QA 필요.

### 후속 백로그
- **[HIGH]** 정산 영속경로 최종 클램프: `startTime:null` 전송 시 `WorkLogRepositoryTransactions`가 기존 check-in 미삭제+음수 `work_duration` 기록 가능(구 코드에도 존재). `executeUpdateWorkTime`에서 `finalCheckOut<=finalCheckIn` 익일보정/거부 = 서버측 최종 방어(별도 태스크).
- Minor 다수(TIME_RE/DEFAULT_END 중복, 테스트 설명 언어 등) — 최종 whole-branch 리뷰 triage.

### 검증 증거 (2026-07-18 세션 내 실측)
- `npm run quality`: type-check 0 error / eslint 0 error(61 pre-existing warning, 무관 파일) / prettier pass.
- 관련 jest: `src/shared/time·components/weeklyGrid·components/employer/settlement·components/schedule·domains/weeklyGrid` = **40 suites / 257 tests PASS**.
- 우회 3곳 Red-Green 스팟체크: SSOT 라인 임시 파괴 시 익일 라벨/배지 테스트 3건 FAIL, 복구 시 9/9 PASS.
