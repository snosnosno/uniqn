# UNIQN 근무표·공고 도메인 종합 감사 보고서

- **감사 기준**: 2026-08-12 · master 트리(1.0.7 빌드 시점) · 정적 코드 감사(앱 코드·마이그레이션·테스트 실독, 읽기 전용)
- **원자료**: 확정 발견 64건(전건 독립 반증 패스 통과) + 크로스컷 5건(4건 미검증, 1건은 확정 발견 검증에서 이미 실증되어 흡수)
- **병합 후**: **61건** — 같은 뿌리는 하나로 합쳤다(병합 내역 §0-3)

---

## 0. 결론 먼저

**구직자가 공고를 못 찾고(목록 페이지네이션 파손), 스태프는 합의한 적 없는 금액을 받을 돈으로 믿으며(시급 15,000원 폴백), 지급 완료된 근무가 노쇼로 뒤집혀 모순 데이터가 쌓인다(단방향 정산 잠금).** 개별 화면의 마감 문제보다, 공고↔지원↔근무↔정산 **경계에서 계약이 어긋난 결함**이 상위 심각도의 대부분을 차지한다. 지금은 prod work_logs 6건·users 32명의 최저비용 구간이라, 데이터가 쌓이면 복구가 비싸지는 항목(모순 행 축적·무음 유실 클래스)을 먼저 쳐야 한다.

### 지금 당장 손대야 할 3건

| # | 항목 | 왜 지금인가 |
|---|---|---|
| 1 | **공고-1** 목록 커서·정렬 이중 파손 (`src/utils/supabase.ts:343`, `src/hooks/useJobPostings.ts:59`) | 구직 퍼널 그 자체. 공고 20건을 넘는 **순간** 고정 탭 영구 절단·동점 공고 유실·"가장 먼 미래 우선" 정렬이 동시에 발현 — 런칭 직후 최초로 터질 결함. 한 경로 수정으로 둘 다 잡힌다 (M) |
| 2 | **이음새-1** 합의 없는 시급 15,000원 표시 (`src/domains/settlement/helpers.ts:79`) | 스태프가 보는 돈이 근거 없는 숫자. 표면 4곳(정산탭·카드·InfoTab·salaryHelpers)이 한 뿌리라 지금 고치면 한 번에 끝난다. 지급액 분쟁으로 직결 (M) |
| 3 | **이음새-2** 정산 완료 근무의 노쇼 뒤집기 (`src/repositories/supabase/ConfirmedStaffRepository.ts:347`) | 유일하게 "**모순 행이 DB 에 축적**되는" 확정 결함('지급 완료'+'노쇼' 동시 성립, 스태프 월 수입에서 실지급액 증발). 사용자가 쌓일수록 복구 비용이 급증 (M) |

차순위: 이음새-4(정산 설정 저장 3중 무방비 — 금전), 이음새-6(S5-01 venueId 소실 — 그리드↔공고 연결 단절), 공고-6(staff 협업자 초대 무음 튕김), 그리고 **미검증 4건(GAP)의 검증 패스**(특히 GAP-04 다중일 하루 빼기=전체 취소는 대회사 핵심 시나리오다).

### 0-1. 전체 지형

| 절 | 높음 | 중간 | 낮음 | 소계 |
|---|---|---|---|---|
| 1. 근무표 | 2 | 10 | 3 | 15 |
| 2. 공고 | 6 | 15 | 7 | 28 |
| 3. 이음새 (확정) | 6 | 4 | 4 | 14 |
| 3. 이음새 (**미검증**) | 3 | 1 | 0 | 4 |
| **계** | **17** | **30** | **14** | **61** |

### 0-2. 읽는 법

- **심각도**: 검증자의 최종 판정(`severityFinal`)을 쓴다. 원 보고에서 상향/하향된 항목은 본문에 정정 사유를 남겼다.
- **미검증**: 반증 패스가 돌지 않은 것이다. **기각이 아니다** — 인용 근거는 전부 실코드이나 독립 검증 절차만 미수행.
- **규모**: S=수 시간·1~3파일 / M=1~3일·다파일 또는 마이그레이션 1건 / L=주 단위·스키마/RPC 설계 필요.

### 0-3. 중복 병합 내역

| 보고서 항목 | 병합된 원 ID | 병합 사유 |
|---|---|---|
| 근무표-1 | S1-02 + S3-02 | 같은 코드(`WorkTab.tsx:81`)의 두 증상(타 공고 출근 중 / 자정 넘김) |
| 근무표-5 | S1-06 + S3-03 | 같은 함수(`buildScheduleStatsCountKey`)의 양방향 집계 불일치 |
| 근무표-11 | S2-06 + GAP-05 | GAP-05 는 S2-06 검증 과정에서 이미 실증된 동일 결함(확정 취급) |
| 공고-1 | S7-01 + S7-02 | 같은 페이지네이션 경로 — 수정 지점이 동일 |
| 이음새-1 | S1-01 + S4-02 + S4-03 | 같은 해소기 폴백의 세 표면 |
| 이음새-4 | S8-02 + S8-07 | 같은 메서드(`updateSettlementSettings`)의 결함 2종 |
| 이음새-7 | S4-06 + S4-05 | '정산 대상' 술어 복제·분열 동일 클래스 |

---

## 1. 근무표 (스태프 일정 화면 · 구인자 근무표 그리드)

### 1-1. QR 버튼의 '출근/퇴근' 라벨이 이 일정이 아니라 '오늘 전역 출근 여부'로 결정된다 — **높음** · 규모 S
*(S1-02 + S3-02 병합)*

- **위치**: `uniqn-mobile/src/components/schedule/tabs/WorkTab.tsx:81,282,295` · 원천 `src/services/work/workLogService.ts:110-115,294` · `src/repositories/supabase/WorkLogRepository.ts:591-596`
- **결함**: 같은 화면에서 배지는 그 일정의 근태(`schedule.status`, :83·:246-248)를, 버튼 라벨·variant 는 전역 `useCurrentWorkStatus()`(오늘 날짜의 **아무** work_log 가 checked_in 이면 true)를 쓴다. 진실원이 둘. 대조군 `NextShiftCard.tsx:63` 은 일정별 판정.
- **사용자 영향**: ① 오늘 A공고 출근 중에 내일 B 근무 상세를 열면 배지 '출근 전' + 버튼 'QR 코드로 **퇴근**하기'. ② 18:00~02:00 야간 근무가 자정을 넘기면(work_logs.date=전날) 오늘 날짜 조회가 0행 → 근무 중인데 '**출근**하기'. 실제 판정은 서버 auto(`p_action='auto'`)라 기능 파손은 아니지만, 하루 두 탕·야간이 이 앱의 기본 패턴이라 출근 1순위 버튼이 상시 반대말을 한다.
- **수정**: 라벨/variant 를 `schedule.status === STATUS.ATTENDANCE.CHECKED_IN` 으로 교체. `useCurrentWorkStatus()` 호출 제거 가능(소비자가 이 컴포넌트뿐 — 실측. 상세 시트의 불필요한 realtime 구독도 함께 사라짐).
- **테스트**: WorkTab 테스트 파일 자체가 없음(`tabs/__tests__/` 에 2개뿐).

### 1-2. '필요 인원' 입력이 파생 정원과 수동 목표를 한 칸에 섞어, 저장 성공 토스트 뒤 값이 되돌아간다 — **높음** · 규모 M
*(S2-01)*

- **위치**: `src/components/workSchedule/VenueDayPanel.tsx:146-148,217-249` · `src/domains/workSchedule/buildGridCells.ts:35-43` · 서버 `supabase/migrations/20260717093000_grid_order_sheet_security_hardening.sql:321-327`
- **결함**: 입력칸 시드값은 `max(수동 softTarget, 공고 파생 requiredCount)` 합성값인데 저장은 수동축만 쓴다. dated 공고가 걸린 날짜는 파생값 아래로 **어떤 값으로도 못 내린다** — 저장 성공·토스트 후 재조회에서 옛 값으로 복귀. `requiredCount≥100` 이면 99 클램프 때문에 진입 즉시 dirty 가 되는 부속 결함도 있음(:227-235). max() 병합 자체는 의도된 설계(주석 실재) — 결함의 실체는 두 축을 한 입력칸에 섞은 UI 계약이다.
- **사용자 영향**: 구인자가 "앱이 내 입력을 버렸다"고 읽는다. 저장된 수동값은 화면 어디에도 표시되지 않음.
- **수정**: `GridDayCell` 에 `manualTarget`/`derivedRequired` 분리 탑재 → 입력칸은 수동값만 시드·저장, 파생 좌석합은 '공고 요건 N명' 읽기전용 표기. 셀 뱃지는 지금처럼 max() 유지.
- **테스트**: `VenueDayPanel.test.tsx:66-100` 은 `cell` prop 미전달로 softTarget=0 만 검증 — 무방어.

### 1-3. 다중일(그룹) 카드에 더블부킹 경고가 전달되지 않는다 — **중간** · 규모 M
*(S1-03 · 원 보고 high → 검증 하향)*

- **위치**: `app/(app)/(tabs)/schedule.tsx:726-748` · `src/components/schedule/GroupedScheduleCard.tsx:35-40` · `src/utils/scheduleGrouping.ts:213-216`
- **결함**: `renderScheduleItem` 이 `GroupedScheduleCard` 에는 `overlapWarning` 을 안 넘기고 props 에도 없다. overlapMap 키는 원본 이벤트 id 라 그룹 id 로는 조회 자체가 불성립.
- **사용자 영향**: 다중일 대회 그룹 카드에는 겹침 경고가 없다. 단, 통상 재현(그룹 vs 단일)에서는 상대편 단일 카드·NextShiftCard 에 경고가 남는다 — **완전 소실은 겹치는 양쪽이 모두 그룹일 때뿐**(하향 사유).
- **수정**: `GroupedScheduleCardProps` 에 `overlapWarning` 추가, `item.originalEvents.flatMap(e => overlapMap.get(e.id) ?? [])` 로 합산 전달. 상세 모달(WorkTab/InfoTab)에도 전달.

### 1-4. 실시간 스냅샷 전환 시 boundarySchedules 가 유실돼 월 경계 대회 일수가 줄었다 늘었다 한다 — **중간** · 규모 S
*(S1-04)*

- **위치**: `src/hooks/useSchedules.ts:271-280,389-416,689-698`
- **결함**: 소스 스위치에서 `warning` 만 폴백(`:393`)이 있고 `boundarySchedules`(`:416`)는 폴백이 없다. realtime payload 에는 애초에 boundary 가 없어 스냅샷 도착(정상 시퀀스) 즉시 유실.
- **사용자 영향**: 7/30~8/2 대회가 '4일'→'2일'로 조용히 줄고, PTR 하면 다시 4일. 8월 초 일정을 화면에서 놓친다.
- **수정**: `boundarySchedules: effectivePayload.boundarySchedules ?? queryPayload.boundarySchedules` 한 줄 + 스위치 후 잔존 단언 회귀 테스트(기존 두 테스트 모두 이 단언이 없음 — 실측).

### 1-5. 스케줄 집계 키가 화면 그룹핑과 다른 축을 써서 두 방향의 숫자 불일치를 만든다 — **중간** · 규모 M
*(S1-06 + S3-03 병합)*

- **위치**: `src/services/work/scheduleService.ts:55-67(:61),:326,:386,:390` · `src/utils/scheduleGrouping.ts:193-203` · 소비처 `app/(app)/(tabs)/schedule.tsx:290-318,903-909` · `src/components/schedule/ScheduleDashboard.tsx:87,100`
- **결함**: 통계 키는 `application:{id}` 하나(폴백 `posting:{id}` 에는 **날짜 축 없음**), 그룹 키는 `{applicationId}_{jobPostingId}_{type}_{timeSlot}`. 두 방향으로 어긋난다 — ① 같은 지원인데 날짜별 시간대가 다르면 필터탭 '확정 2' vs 상단 통계 '확정 1'(같은 박스 안에 동시 표시). ② 직접배치(applicationId NULL — `add_direct_staff` 현행 정의 `20260803120000:384` 실측) 다일 근무는 대시보드 '확정 **1**' vs 목록 카드 **N장**. 주석(:311-313)이 "통일했다"고 선언한 바로 그 증상이 축만 바꿔 남았다.
- **사용자 영향**: 지점 직접배치로 월 10일 잡힌 스태프의 대시보드가 '확정 1'. '완료' 타일만 `completedWorkDays` 병기로 부분 완화, '확정' 타일은 없음.
- **수정**: 집계 키 파생을 한 곳으로 통일 + posting 폴백에 `:{date}` 추가. '같은 입력 → countSchedulesByType == stats' 교차 단언 테스트 추가(현재 양쪽이 각자만 검증, posting 폴백 분기 커버 0건).

### 1-6. 노쇼·취소 그룹 카드의 날짜별 상세에 '출근 전' 배지가 붙는다 — **중간** · 규모 S
*(S1-07)*

- **위치**: `src/shared/status/StatusMapper.ts:19-33` · `src/domains/schedule/ScheduleConverter.ts:143,183` · `src/components/schedule/GroupedScheduleCard.tsx:283-305,327-336`
- **결함**: SCHEDULED/CANCELLED/NO_SHOW 3종이 모두 `not_started` 로 접혀 날짜 행 배지·접근성 라벨이 '출근 전'이 된다. 같은 카드 하단은 '무단결근(노쇼)으로 기록되었습니다'.
- **사용자 영향**: 이의 제기 기한이 있는 불리한 기록에서 신호 상충. 스크린리더는 "8/16 출근 전"으로 읽는다.
- **수정**: `DateStatus` 에 원본 타입을 싣고 그룹 type 이 no_show/cancelled 면 `SCHEDULE_STATUS` 라벨로 분기. (기존 테스트 2개는 `dateStatuses: []` 로 렌더 — 이 경로 미통과.)

### 1-7. 상태 필터가 걸린 캘린더에서 '가장 가까운 일정 보기'가 자기 자신을 가리키는 무한 루프 — **중간** · 규모 S
*(S1-05)*

- **위치**: `app/(app)/(tabs)/schedule.tsx:404-410` vs `:399-402,1099,1126-1143`
- **결함**: 버튼 목적지는 **필터 미적용** schedules 에서, 빈 화면 판정은 **필터 적용** 목록에서 계산 — 눌러도 같은 날짜·같은 버튼이 반복된다. 화면 어디에도 '필터 때문'이라는 단서가 없다.
- **수정**: 목적지를 `filterSchedulesByStatus` 적용 후로 계산, 후보 0건이면 '전체 보기'(`setStatusFilter('all')`) 액션으로 교체.

### 1-8. 인원 빼기·당겨서 새로고침이 settlement.byVenue 를 무효화하지 않는다 — **중간** · 규모 S
*(S2-03)*

- **위치**: `src/hooks/workSchedule/useDeleteSlot.ts:22-26` · `src/lib/queryClient.ts:747-757` · `app/(employer)/work-schedule.tsx:185-192` · 대조 `useUpdateSlot.ts:53`
- **결함**: 빼기 훅은 `settlement.byJobPosting` 만 버리고 배너·지점 정산이 쓰는 `settlement.byVenue` 는 안 버린다(편집 훅은 `settlement.all` 을 버림 — 비대칭). 당겨서 새로고침도 `workSchedule.all` 만.
- **사용자 영향**: 뺀 인원이 '퇴근 미기록 N건' 배너와 지점 정산에 최대 5분 잔존. 배너를 탭하면 빈 목록.
- **수정**: `useDeleteSlot.onSuccess` 에 `settlement.all` 무효화 추가 + `handleManualRefresh` 범위 확장. 근본적으로 `invalidateQueries.staffManagement` 에 venue 축 포함. (기존 테스트는 헬퍼를 빈 목으로 대체 — 무효화 범위 미검증.)

### 1-9. 퇴근 미기록 안전망 배너가 '보이는 달'만 조회한다 — **중간** · 규모 M
*(S2-04)*

- **위치**: `app/(employer)/work-schedule.tsx:150,144-146,154-157` · `src/hooks/workSchedule/useVenueSettlement.ts:11-25`
- **결함**: 배너 데이터가 `visibleMonth` 한 달로 고정. 코드 주석 스스로 "이 배너가 유일한 경로"(`:144-146`)라고 못박았는데, `missingCheckout.ts:13-14` 주석은 월 스코프 한계를 의식적으로 명시 — **스스로 사각을 인정하는 모순**. 추가로 `data ?? []` 처리로 조회 **실패도 '미기록 0건'으로 위장**된다.
- **사용자 영향**: 지난달 퇴근 미기록 근무는 영구히 비표면화 → 스태프 미지급으로 이어질 수 있는 조용한 누락.
- **수정**: 안전망 조회를 보기 상태에서 분리(과거 N개월 전용 리더) + `isError` 구분 표시.

### 1-10. '공고 모집 인원도 함께 옮겨져요' 안내가 서버의 3가지 스킵 사유를 모른다 — **중간** · 규모 M
*(S2-05)*

- **위치**: `src/components/workSchedule/SlotTimeChangeSheet.tsx:317-322,171-184` · 서버 `supabase/migrations/20260804120000_update_posting_slot_time_rpc.sql:526-537` · `src/repositories/interfaces/IWorkScheduleRepository.ts:11-35`
- **결함**: 사전 약속은 `isContainer` 단일 게이트인데 서버는 container/fixed/요건불일치 3사유로 정원 이동을 건너뛴다(클라 타입에 kind 자체가 없음). 사후 정정 토스트도 else-if 배타 분기라 skipped 가 있으면 삼켜진다.
- **사용자 영향**: 닫혔다고 믿은 원 시간대로 지원이 계속 들어온다 — 이 기능이 없애려던 바로 그 상황.
- **수정**: RPC 반환에 kind(또는 이동 가능 불리언) 추가 + 문구 약화('옮겨질 수 있어요') / 토스트를 문장 조립식으로.

### 1-11. '빼기'에 진행 피드백·중복 제출 가드가 없고, 출근 처리된 직접배치 인원은 서버가 영구 거부하는데 UI 는 삭제를 약속한다 — **중간** · 규모 S~M
*(S2-06, 검증에서 상향 + GAP-05 흡수 — GAP-05 는 이 검증에서 이미 실증된 동일 결함)*

- **위치**: `src/components/workSchedule/VenueDayPanel.tsx:186-213(:198 고정 실패 문구)` · `src/components/employer/applicants/ConfirmedStaffCard.tsx:100-103,307-320` · 서버 `20260727120000...sql:62-64`(`STAFF_ALREADY_CHECKED_IN`), `20260727180000...sql:85-86` · 버려지는 매핑 문구 `ConfirmedStaffRepository.ts:131-139`
- **결함**: ① `deleteSlot.isPending` 소비처 0 — 모달 즉시 닫힘·카드 잔존·이중 탭 가능(지원확정분 이중 탭은 `invalid_status_for_cancellation` 실패 토스트, 직접배치분은 서버 멱등 흡수). ② **상위 결함**: 클라는 'QR 오인식 복구' 용도로 출근 처리된 인원의 빼기를 일부러 열어뒀고(`VenueDayPanel.tsx:169-171` 주석·`allowDeleteAnyStatus`) 확인 모달은 "기록된 출퇴근 시각도 함께 사라져요"라고 약속하는데, 서버는 checked_in 이상을 **범주적으로 거부** — 실패 토스트는 '잠시 후 다시 시도해주세요'(고정 문구)라 영원히 같은 실패를 반복한다. 유일한 우회로(편집 시트로 출근 기록 클리어 → scheduled 파생 → 빼기)는 어디에도 안내되지 않는다.
- **수정**: onError 에서 `AppError.userMessage`('출근 처리된 스태프는 삭제할 수 없습니다' — 이미 존재) 우선 노출, `hasRecord` 분기 문구를 실제 경로 안내로 교체, `isPending` 소비 + 확인 버튼 loading.

### 1-12. 근무표 진입만으로 닫힌 인원추가 시트가 지점 전 기간 work_logs + users N+1 을 발사한다 — **중간** · 규모 M
*(S2-02)*

- **위치**: `src/components/workSchedule/AddSlotSheet.tsx:126-131`(무게이트) vs `:149-151`(JIT 게이트 — 비대칭) · `src/hooks/useConfirmedStaff.ts:110` · `src/repositories/supabase/ConfirmedStaffRepository.ts:237-246`(기간·limit 없음) · `src/services/work/confirmedStaffService.ts:59-70,31`(스태프별 users 단건)
- **사용자 영향**: 오래 운영한 지점일수록 화면 첫 렌더 지연·데이터 낭비·요청량 증가 — 아직 열지도 않은 시트를 위해.
- **수정**: `useConfirmedStaff` 에 `enabled` 게이트(visible 연동) + 기간 한정 리더 + `getStaffName` 배치 조회.

### 1-13~15. 낮음 (근무표)

| # | 제목(원 ID) | 위치 | 결함 / 영향 | 수정 | 규모 |
|---|---|---|---|---|---|
| 13 | 인원 추가 실패 토스트 2중 노출 (S2-07) | `AddSlotSheet.tsx:299-322` · `useConfirmedStaff.ts:317-323,378-380` · `toastStore.ts:68-71` | try 가 `mutateAsync` 까지 감싸 훅 onError 와 이중 발화. 폴백 문구가 서로 달라('스태프 추가에…'/'인원 추가에…') dedupe 미작동 — AppError 아닌 실패에서 에러 토스트 2개 | try 를 빌더만 감싸고 변이 rejection 은 훅 한 곳에서만 토스트 | S |
| 14 | 취소 요청 버튼 raw `orange` 토큰 (S1-08) | `ScheduleDetailModal.tsx:545,547` (tailwind.config.js 에 orange 정의 0건) | 시맨틱 토큰 규약 위반. **정정**: 단독 일탈이 아니라 raw orange 가 최소 6파일(CancellationRequestCard 등) — 사실상 '취소요청=orange' 관행이라 이 버튼만 고치면 새 불일치 발생 | 취소요청 계열 전체를 한 번에 warning 토큰화 | M |
| 15 | 상태 필터 '취소'·'노쇼' 옵션 도달 불가 (S1-09) | `schedule.tsx:100-108` vs `:305-318` · `scheduleGrouping.ts:386-393,421-427` | 라벨·필터 로직·건수 계산은 5종인데 옵션은 4종+조건부 unpaid — 데드코드. 부수: unpaid 0건 전환 시 선택값 고아화(리셋 가드 없음) | 건수>0 옵션 추가 또는 타입에서 제거 + 고아값 리셋 가드 | S |

---

## 2. 공고 (작성 · 목록 · 지원 · 관리 · 협업)

### 2-1. 무한스크롤 커서 + 정렬 방향 — 목록 계약 이중 파손 — **높음** · 규모 M
*(S7-01 + S7-02 병합 · 원 보고 critical → 검증 하향: 데이터 유실이 아닌 '발견 불가' 클래스, 검색이 부분 우회)*

- **위치**: `src/utils/supabase.ts:341-359(:343)` · `src/repositories/supabase/JobPostingRepository.ts:438-444` · `src/hooks/useJobPostings.ts:42-67(:59)` · `src/utils/jobPostingSorter.ts:100-129` · `src/domains/job-posting/serialization.ts:80-85`
- **결함 ①(커서)**: 비유일 `work_date` 에 lt/gt keyset → 페이지 경계 동점 공고 통째 유실. 고정 공고는 work_date=''(구형 행 null 이어도 결과 동일 — lastDoc null → 다음 페이지 없음 판정) → **고정 탭 20건 영구 절단**. 같은 파일 `:282-284` 주석이 이 결함 클래스를 문자로 인정하고 급여 정렬만 offset 으로 고쳤다.
- **결함 ②(정렬)**: 서버는 DESC(가장 먼 미래 우선)로 페이지를 주는데 클라는 누적 결과를 매번 ASC(임박 우선)로 재정렬 — 첫 페이지가 3개월 뒤 공고 20건, 더보기마다 목록 상단이 통째로 재배치된다.
- **사용자 영향**: 존재하고 RLS 상 보이는 공고가 목록에 영영 안 나온다(구인자에겐 신호 0). 오늘·내일 근무(핵심 상품)는 마지막 페이지. 커서만 고치면 방향 모순은 남으므로 **한 번에** 처리해야 한다.
- **수정**: 서버 정렬을 `ascending:true` + 오늘 하한으로 클라 계약과 일치시키고, (work_date,id) 복합 keyset 또는 `salarySortedPage`(:287-317) 동형 offset 으로 교체. 고정 탭은 `created_at` 분기.
- **테스트**: 커서 경계를 실행하는 테스트 0건(useJobPostings.test 전부 단일 페이지, supabase.test 에 paginatedQuery 단언 없음).

### 2-2. 급구 7일 창 게이트가 프로덕션 경로에 0곳 — **높음** · 규모 S
*(S5-02)*

- **위치**: `src/components/employer/order-sheet/hooks/usePostingTypeSwitch.ts:105-121` · `src/schemas/orderSheet.schema.ts:270-278`(개수만 검사) · `src/schemas/jobPosting.schema.ts:336-348`(유일한 7일 게이트 — **미배선**: 정의+배럴+테스트뿐) · `src/components/employer/job-form/modals/DatePickerModal.tsx:99-104`
- **결함**: dated→dated 타입 전환 시 날짜 재검증 없음. 유일한 7일 refine 은 아무도 안 부르는 스키마 안에 있고, 그걸 검증하는 테스트(`jobPosting.schema.test.ts:210`)는 **실행되지 않는 게이트를 초록으로 만든다**. 캘린더 셀로는 범위 밖 날짜 해제 불가(칩 X·전체 해제로는 가능 — 정정).
- **사용자 영향**: '오늘부터 7일'이 계약인 급구가 한 달 뒤 날짜로 발행·우선 노출된다. 편집 화면은 타입 세그먼트가 잠겨 있어 인앱 복구 곤란.
- **수정**: `orderSheetValuesSchema.superRefine` dated 분기에 urgent 창 검사 추가 + 전환 시 창 밖 날짜 제거·고지.

### 2-3. 사전질문 시트 — 확인 게이트가 zod 보다 느슨 + 행 에러 침묵 = '이대로 등록' 무한 루프 — **높음** · 규모 M
*(S5-03)*

- **위치**: `src/components/employer/order-sheet/sheets/PreQuestionsSheet.tsx:206-217,225,62-67` · `src/schemas/preQuestion.schema.ts:29-48` · `src/components/employer/order-sheet/orderRowMeta.ts:317-318,582-590`
- **결함**: 확인 버튼은 무조건 활성이고 질문 2자·select 옵션≥2 를 검사하지 않는다(select 전환 시 빈 옵션 1개 시드). 제출 시 zod 가 거부하면 시트만 재오픈되는데, `errors.preQuestions` 는 배열형이라 `errorMessageForRow` 가 undefined 를 반환 — **어디에도 이유가 표시되지 않는다**.
- **사용자 영향**: 확인 → 등록 → 시트 재오픈 → 확인 → … 사장이 공고 등록을 포기하는 무한 루프.
- **수정**: ① 시트 확인 게이트를 zod 와 동일 조건으로 좁히고 잠금 사유 노출(ScheduleSlotsSheet 의 lockReason 패턴) ② `errorMessageForRow` 에 배열형 필드 폴백 추가.

### 2-4. 조건 카드 2장 이상 공고의 템플릿 저장이 2번째 이후 조건을 침묵 유실 — **높음** · 규모 M
*(S5-04)*

- **위치**: `src/types/jobTemplate.ts:81-105(:83)` · 저장 `app/(employer)/my-postings/create.tsx:148-158` → `TemplateRepository.ts:91` · 복원 `src/utils/order-sheet/mappers.ts:305-325,366-380`
- **결함**: `buildTemplateDatedSchedule` 이 `requirements` 를 통째로 버리고 첫 requirement 의 timeSlots 1벌만 남긴다 → 복원 시 항상 카드 1장. 같은 캐러셀의 '마지막 공고' 프리셋은 N그룹 보존 — 보존 계약 비대칭. 이를 막아야 할 테스트(`mappers.test.ts:657-696`)는 **실제 생산자(`extractTemplateData`)를 우회**해 프로덕션에서 생성 불가능한 형상으로 `toHaveLength(2)` 를 통과시킨다.
- **사용자 영향**: 대회사의 시간대별 편성 템플릿이 첫 카드만 남고 고지 0 — 인원 빠진 공고 발행.
- **수정**: 날짜만 비우고 requirements 는 보존(`normalizeScheduleGroups` 규칙 0 이 이미 하류를 지원). 테스트는 실제 저장 경로를 통과시켜 단언.

### 2-5. 좌석 수(filled_positions)를 '명'으로 표시 — 화면마다 '확정' 숫자가 다르다 — **높음** · 규모 M
*(S6-01)*

- **위치**: `app/(employer)/my-postings/[id]/edit.tsx:56-58,190` · `[id]/index.tsx:283,289,476-480,497-506,553` · `[id]/applicants.tsx:240-248` · 근거 `src/domains/job-posting/facts.ts:35-55` · `supabase/migrations/20260718000000_seat_basis_filled_total_positions.sql`
- **결함**: `filled_positions` 는 work_logs **행(좌석)** 카운터인데(마이그 실측: 행마다 ±1, 사람 단위는 `confirmedApplicants` 별도) 세 화면이 '명'·'확정'으로 라벨링. 1명이 3일 확정되면 상세 '확정 1' / 지원자 관리 '확정 3 / 정원 9 명' / 수정 배너 "이미 확정된 **3명**에게는…".
- **사용자 영향**: 연락할 사람 수를 오판. 다일 대회가 핵심 타깃이라 도달성 높음.
- **수정**: 수정 배너는 `stats.confirmedApplicants`(사람)로, 좌석 표기는 '자리/배정'으로 라벨 교정. 근본은 `filledSeats`/`confirmedPeople` 처럼 단위가 이름에 박힌 필드 분리.

### 2-6. staff 사용자를 협업자로 초대 가능 — 초대 알림 탭이 무음 리다이렉트로 끝난다 — **높음** · 규모 M
*(S6-02 · 축 정정: 권한 상승은 없음(RLS·게이트가 실제로 막음) — 실체는 **무signal 실패** UX 결함)*

- **위치**: 검색 RPC `supabase/migrations/20260718120200_collaborator_search_hardening.sql:51-58`(역할 조건 없음) · `src/repositories/supabase/JobPostingCollaboratorRepository.ts:264-273` · `src/components/job-posting/CollaboratorSearch.tsx:36-52` · 게이트 `app/(employer)/_layout.tsx:88-91`
- **결함**: 후보 검색·분류 어디에도 역할 축이 없어 staff 계정이 '추가' 가능 후보로 뜬다. 추가하면 DB 트리거가 '🤝 공고 관리 초대' 알림 발송 — 초대받은 staff 가 알림을 탭하면 (employer) 게이트가 **토스트·안내 없이** 홈으로 튕긴다. (정정: staff 의 '내 공고' 탭 공유 카드 렌더는 반증됨 — NonEmployerView 라 도달 표면은 알림 1건.)
- **사용자 영향**: 사장은 '공유했다'고 믿고 검토를 맡기고, 초대받은 쪽은 앱이 고장 났다고 판단.
- **수정**: 3겹 — RPC 에 `role IN ('employer','admin')`, 후보 status 에 `not_employer` + 힌트, INSERT RLS/트리거에 대상 role 검사.

### 2-7. 필수 사전질문 게이트가 answers 기준이라, 질문이 늘면 검사가 조용히 무효화된다 — **중간** · 규모 M
*(S7-08 · 정정으로 강화: 진짜 서버 RPC 는 사전질문을 **아예 검증하지 않고** 저장(`baseline:855,868`) — 방어선이 원 서술보다 더 없다)*

- **위치**: `src/components/jobs/ApplicationForm.tsx:116-119,170-180` · `src/components/jobs/PreQuestionForm.tsx:246-249`(`if (!answer) return null` — 질문 무음 증발) · `src/types/preQuestion.ts:86,95-97`
- **결함**: answers 는 lazy 초기화 1회뿐 — job 재조회(staleTime:0 + 포그라운드 복귀)로 questions 가 늘어도 재동기화 없음. 새 질문은 화면에서 사라지고 게이트도 서버도 통과.
- **사용자 영향**: 필수 답변이 빈 지원서가 저장된다. 헤더는 '필수 1/2' 같은 도달 불가 상태.
- **수정**: questions 변경 시 병합 재동기화 + 판정 모수를 questions 로 + 빈 답변 폴백 렌더 + RPC 검증 추가 검토.

### 2-8. 지원 라우트에 공고 상태 게이트가 없다 — 다 작성한 뒤에야 거절 — **중간** · 규모 S
*(S7-07)*

- **위치**: `app/(app)/jobs/[id]/apply.tsx:267-356`(가드 체인에 `job.status` 검사 0곳, 제출 시점 `:202-211` 만) · 같은 파일 `:342-345` 주석이 동일 클래스(fixed)만 고친 이력 명시
- **사용자 영향**: 딥링크·로그인 리다이렉트로 마감/정원마감 공고 폼 진입 → 사전질문·동의까지 입력 후 '지원 불가'. 제출 전 검증 fetch 실패는 catch 가 삼키고 진행(추가 관찰).
- **수정**: `isFixed` 앞에 `buildPostingFacts(job).application.canApply` 분기 — reason 별 상태 화면 착지.

### 2-9. 캘린더 날짜별 건수가 필터·capacity_full 을 모른다 — **중간** · 규모 M
*(S7-03 · 원 보고 high → 하향: 빈 목록에 '필터 초기화' 복구 경로 존재, 실체는 마찰·혼란)*

- **위치**: `src/hooks/useRegularDateCounts.ts:26-31` · RPC `archive/20260419012456...sql`(`status='active'` 만, 필터 파라미터 없음) vs 목록 `JobPostingRepository.ts:392,398-401`(active+capacity_full+스코프) · `src/components/jobs/DateCalendar/CalendarCell.tsx:62`(count 0 → **셀 disabled**)
- **사용자 영향**: 필터 켠 상태에서 '3건' 날짜 탭 → 0건. capacity_full 만 있는 날짜는 탭 자체가 불가. 칩 카운트에서 이미 고친 결함(EF-jsearch-11)이 캘린더에만 남았다.
- **수정**: RPC 에 스코프 파라미터 + `status = any(['active','capacity_full'])`. 임시 완화로 count 0 disabled 해제.

### 2-10. 확정 인원 배치 쿼리 키가 '보이는 id 목록' — 더보기마다 마감 카드가 (0/N) 모집중으로 되돌아간다 — **중간** · 규모 S
*(S7-04)*

- **위치**: `app/(app)/(tabs)/home-jobs.tsx:223-227` · `src/hooks/usePostingFilledCounts.ts:10-17`(placeholderData 없음) · `src/components/jobs/shared/postingSurfaceModel.ts:467-481` · `src/domains/job-posting/core.ts:95`(`filled: 0` — hydrate 전제)
- **사용자 영향**: 페이지 로딩·검색 입력마다 (3/3) 마감 카드가 (0/3)으로 뒤집혀 이미 찬 자리에 지원 시도. 페이지 늘수록 전체 재조회+전 카드 리렌더.
- **수정**: `placeholderData: keepPreviousData` 한 줄(형제 훅 `usePostingTypeCounts` 가 이미 쓰는 패턴).

### 2-11. 오프라인+무캐시 상세 = '공고를 찾을 수 없습니다' + 죽은 '다시 시도' — **중간** · 규모 S
*(S7-05)*

- **위치**: `src/hooks/useJobDetail.ts:80-83,152-156,167-173` · `app/(app)/jobs/[id]/index.tsx:123-141` · 별칭 `app/jobs/[id].tsx:109-123`
- **결함**: 오프라인이면 쿼리 비활성 → job=null·isLoading=false·error=null 3중주(TanStack v5 실측) → '없는 공고' 문구 착지. `refresh` 는 오프라인에서 무피드백 즉시 return.
- **수정**: `unavailableReason: 'offline'|'not_found'|'error'` 반환 + 오프라인 전용 착지·자동 재조회.

### 2-12. 필터 시트 '공고 N건 보기'가 4개 타입 합계 — 목록은 1개 타입만 — **중간** · 규모 S
*(S7-06)*

- **위치**: `src/components/jobs/filters/RegionFilterSheet.tsx:164` · `RoleFilterSheet.tsx:71` · `SalaryFilterSheet.tsx:135`(모두 `counts.total`) vs `home-jobs.tsx:150-152,179-182`
- **수정**: 라벨을 `counts[selectedType]` 기준으로, 날짜 선택 시 '적용' 폴백.

### 2-13. 타입 전환으로 상한 초과된 날짜는 캘린더에서 해제도 차단 + 반대 의미 토스트 — **중간** · 규모 S
*(S5-05 · 경로 정정: 해제 분기는 `src/components/ui/CalendarPicker.tsx:330-338`)*

- **위치**: `src/components/employer/job-form/modals/DatePickerModal.tsx:108-121`(결과 길이만 검사, 증감 미구분) · `src/components/ui/CalendarPicker.tsx:330-338`
- **사용자 영향**: 대회 10일 → '지원' 전환 후 날짜를 하나 빼려 해도 "최대 7개까지 선택할 수 있습니다" 반복. 탈출로(칩 X·전체 해제)는 있으나 안내 없음.
- **수정**: `dates.length > selectedDates.length` 일 때만 차단(감소 항상 허용) + 전환 시 초과분 잘라내고 되돌리기 고지.

### 2-14. 시간대·역할 개수 상한이 시트에 미반영 — 제출 순간에야 거부 — **중간** · 규모 S
*(S5-06)*

- **위치**: `src/components/employer/order-sheet/sheets/ScheduleSlotsSheet.tsx:153-162,301-310` · `RoleCountEditor.tsx:76-87` vs `src/constants/jobPosting.ts:57,64` · `orderSheet.schema.ts:67-70,88-91,112-116`
- **결함**: 같은 파일이 count 상한은 "세 곳 전부 맞아야 한다"고 규율하면서 개수 상한만 그 규율 밖. 11번째 슬롯 입력이 헛수고가 된다.
- **수정**: PreQuestionsSheet 의 `{n}/{max}` + 조건부 추가 버튼 패턴 이식, 상수 직접 import.

### 2-15. 타입 전환 스태시 — 지운 날짜가 고정↔지원 왕복에서 되살아난다 — **중간** · 규모 S
*(S5-07)*

- **위치**: `src/components/employer/order-sheet/hooks/usePostingTypeSwitch.ts:88-92,111-120` · 빈 확정 경로 `scheduleCardEdits.ts:50-58`
- **결함**: 스태시 갱신은 '의미 있는 입력이 있을 때만'(없으면 옛 값 잔존), 복원은 신선도를 안 봄 → 유령 날짜 부활, 고지 없음, 그대로 발행.
- **수정**: 전환마다 스태시를 현재 상태로 덮되 없으면 null(고지 판정은 기존 기준 유지 — 소음 억제 테스트 보존).

### 2-16. 삭제 버튼 활성 조건(지원자 수)과 서버 거부 조건(좌석 수)이 다른 값 — **중간** · 규모 S
*(S6-03)*

- **위치**: `app/(employer)/my-postings/[id]/index.tsx:282-285,221-227` · `src/domains/job-posting/selectors.ts:39-47`(주석은 work_logs 를 근거로 적고 인자는 applications) · `JobPostingRepository.ts:854-859`
- **사용자 영향**: 직접배치만 있는 공고 — 지원자 0인데 "확정된 지원자가 있는 공고는 삭제할 수 없습니다" 로 거절, 모달은 열린 채(onError 미처리), 원인 추적 불가.
- **수정**: 클라 게이트 입력을 `filledPositions` 로 통일 + 캡션 교정 + onError 로 모달 닫기.

### 2-17. 협업자 화면이 공고 조회 실패/지연 시 owner 를 비-owner 로 취급 — **중간** · 규모 S
*(S6-04)*

- **위치**: `app/(employer)/my-postings/[id]/collaborators.tsx:28,34,56` · `src/hooks/useJobDetail.ts:150` — 같은 스택의 edit.tsx 는 jobError 로 에러 화면을 렌더(누락임을 방증)
- **사용자 영향**: 공고 주인이 자기 공고에서 추가 UI 전체를 잃고 "공고 작성자가 협업자를 추가하면…"이라는 남 얘기 문구를 본다. 재시도 버튼 없음.
- **수정**: 컨텍스트에 이미 실린 error/isLoading 소비 + `ownerState: 'loading'|'owner'|'collaborator'|'unknown'` 분리.

### 2-18. 빈 상태가 '이메일로 추가'를 지시하는데 검색은 닉네임 전용 — **중간** · 규모 S
*(S6-05)*

- **위치**: `src/components/job-posting/CollaboratorList.tsx:50-54` · `CollaboratorSearch.tsx:111,148-153` · RPC COMMENT 가 이메일 검색 폐기를 명시(`20260718120200:69`)
- **사용자 영향**: 이메일 입력 → 0건 → 'UNIQN 에 가입한 사용자만 추가할 수 있어요' → 동료를 미가입자로 오판. 공유 기능 첫 경험이 실패로 끝난다.
- **수정**: 문구 3곳(빈상태·placeholder·0건 안내) 교정 + 문구 상수 단일화.

### 2-19. getTypeCounts 가 전 행을 내려받고 1000행 상한에서 조용히 잘린다 — **중간** · 규모 S~M
*(S8-04 · 현재 규모에선 휴면이지만 데이터 성장만으로 무신호 발현되는 클래스)*

- **위치**: `src/repositories/supabase/JobPostingRepository.ts:516-556` · `supabase/config.toml:13 (max_rows=1000)` · 소비 `home-jobs.tsx:107-113`(첫 탭 자동선택까지 결정)
- **수정**: `GROUP BY posting_type` SECDEF RPC, 최소 조치는 타입별 `count:'exact', head:true` 4회.

### 2-20. 협업자 제거가 RLS 0행이어도 '제거했습니다' 성공 토스트 — **중간** · 규모 S
*(S8-06 · 재현 경로 정정: editor 는 버튼 도달 불가 — 실제 경로는 **공고 owner ≠ workspace owner**)*

- **위치**: `src/repositories/supabase/JobPostingCollaboratorRepository.ts:190-207`(`.select()` 없음) · `src/hooks/job-posting/useJobPostingCollaborators.ts:96-103`
- **결함**: 워크스페이스 **멤버**가 만든 공고의 owner 는 ws owner 가 아니다(`jobManagementService.ts:77-85` 가 멤버 생성 허용) → 그 owner 는 UI 게이트(공고 owner)로 제거 버튼을 보지만 RLS(`jpc_delete_owner_or_self` = ws owner)에 막혀 0행 → 무음 → 거짓 성공 토스트. **회수됐다고 믿은 공고 접근권이 살아 있다.** 같은 사용자의 '추가'는 시끄럽게 실패하고 '제거'만 조용히 실패한다.
- **수정**: delete 에 `.select('id')` + 0행이면 PermissionError. UI/RLS 게이트 기준 통일은 별도 결정.

### 2-21. ApplicationForm 테스트가 핵심 계약을 전부 목으로 제거 — 무효 스위트 — **중간(테스트 갭)** · 규모 M
*(S7-09)*

- **위치**: `src/components/jobs/__tests__/ApplicationForm.test.tsx:6-21,23-28,43-48`
- **결함**: buildPostingFacts·AssignmentSelector·PreQuestionForm 전부 목 — 목 구조상 선택 자체가 불가능해 `onSubmit` 이 **한 번도 실행되지 않는다**(payload 4인자 미검증). 화면 레벨 테스트(ApplyScreen)도 폼을 목으로 대체. 2-7(사전질문 무효화) 같은 회귀가 전부 이 스위트를 통과한다. 같은 파일 :58-59 주석이 기록한 '목이 계약을 버린 전례'와 동형.
- **수정**: 실제 픽스처 주입 + 선택→제출 흐름 실행 + `(assignments, message, preQuestionAnswers, provisionConsent)` 단언.

### 2-22~28. 낮음 (공고)

| # | 제목(원 ID) | 위치 | 결함 / 영향 | 수정 | 규모 |
|---|---|---|---|---|---|
| 22 | 검색 모드 안내('전체') ↔ 날짜 필터 계속 적용 (S7-10) | `home-jobs.tsx:195-214,291-296,312-314,330` | 선택된 날짜가 검색 결과를 조용히 좁히는데 빈 문구는 검색어 탓만. JobList 는 emptyAction prop 을 이미 지원 | 검색 모드에서 날짜 제외 또는 문구+'날짜 해제' 액션 | S |
| 23 | 취소 요청 조회 경로 2벌 — 서버 체인 소비처 0 (S6-06 · medium→low: 현재 오동작 없음, 유지보수 함정) | `src/hooks/applicant/useCancellationManagement.ts:22-31` · `invalidationStrategy.ts:226,521-524` | 무효화 그래프가 마운트되지 않는 쿼리를 씻고, 테스트가 죽은 훅을 살아있는 것처럼 고정 | 클라 필터를 정본으로 확정하고 서버 체인·키·무효화 타깃 일괄 제거 | S |
| 24 | realtime 300건 상한에서 stats 집계, PTR 은 무상한 경로 (S6-07) | `ApplicationRepositoryQueries.ts:333-343,382-397` · `ApplicationRepositoryHelpers.ts:41,243-250` | 지원 301건+ 공고에서 당기기 전후 숫자 왕복. 현 운영 규모에선 원거리 경계 | stats 는 서버 집계 분리 + truncated 노출 | M |
| 25 | '공유 관리'만 헤더 계약(제목·QR)에서 빠짐 (S6-08 · 정정: 본문 제목은 고정 영역이라 스크롤로 안 사라짐, 가드 테스트는 등록 요구 장치) | `collaborators.tsx:41` vs `_layout.tsx:78-81` 계약 · `__tests__/headerQRGate.test.ts:30-36,71-77` | 진입 시 공고 제목·QR 진입점이 사라졌다 복귀 — 주석이 막겠다던 그 현상 | titleSuffix·rightAction 추가 + KNOWN_CONSUMERS 등록 | S |
| 26 | updateStatus — 게이트 없는 임의 상태 변경 API, 호출자 0 (S8-05 · medium→low: 'container' 전이는 RESTRICTIVE WITH CHECK 가 차단, cancelled 는 트리거 차단 — 반증됨. 실체는 열린 인터페이스 footgun) | `JobPostingRepository.ts:686-698` · `IJobPostingRepository.ts:306` · 고정 테스트 `workspace.regression.test.ts:139-143` | 다음 사람이 갖다 쓰는 순간 다른 write 경로가 좁혀둔 범위(admin 명시 차단)를 우회 | 인터페이스·구현·고정 테스트 함께 삭제 | S |
| 27 | collaboratorService 의 supabase.auth 직접 호출 (S8-08 · 정정: requireCurrentUser 에 재시도·타임아웃 없음 — '하드닝 우회' 불성립, 실체는 규약 위반+중복) | `collaboratorService.ts:18,37-47` · `JobPostingCollaboratorRepository.ts:234` | 세션 획득 경로 2벌 — 인증 정책 변경 시 한쪽 누락 위험 | requireCurrentUser 로 교체, repo 는 userId 주입 | S |
| 28 | SlotCard 의 reduce-motion 로컬 재구현 (S5-08 · 정정: 테스트 5건 실재 — '방어 없음' 아님. 미커버는 런타임 변경 반응·첫 프레임 시딩) | `SlotCard.tsx:54-65` vs `src/hooks/useReduceMotion.ts:20-64` · 규칙 impeccable §8 | PR #350 이 없앤 결함 클래스 재발 + 폐기된 선례를 근거로 단 주석 | 공유 훅 교체 + 주석 제거 | S |

---

## 3. 이음새 (공고↔지원↔근무↔정산 경계)

### 3-1. 합의한 적 없는 시급 15,000원이 확정 금액처럼 표시된다 — **높음** · 규모 M
*(S1-01 + S4-02 + S4-03 병합 — 한 뿌리, 세 표면)*

- **위치(뿌리)**: `src/domains/settlement/helpers.ts:73-103(:79,:94)` · `src/utils/settlement/constants.ts:8-11` · `src/domains/schedule/ScheduleConverter.ts:110-119(:118 — 컨테이너 경로에 DEFAULT 명시 주입)`
- **위치(표면)**: `src/components/schedule/tabs/SettlementTab.tsx:90-115,297-306` · `src/components/schedule/ScheduleCard.tsx:88-96` · `src/components/schedule/helpers/salaryHelpers.ts:15-38` · InfoTab(같은 해소기)
- **결함**: `getRoleSalaryFromRoles/FromSettlementSource` 가 **모든 분기에서** `defaultSalary ?? DEFAULT_SALARY_INFO(시급 15,000)` 를 반환 — undefined 불가. 소비처의 `?? null`·`if (!agreedSalary)`·`if (!salary)` 가드가 전부 죽은 코드다. 범위는 컨테이너 직속 배치 + defaultSalary 없는 일반 공고. '급여가 아직 정해지지 않았어요' 안내(:297-306)는 **정확히 그 문구가 겨냥한 케이스에서만 도달 불가**('협의' 급여로는 도달 — 정정 반영). 같은 행을 사장 화면은 '기본 단가 적용' 경고 배지로 표시(`venue-settlements.tsx:258-269`) — 한쪽엔 미정, 한쪽엔 확정.
- **사용자 영향**: 스태프가 15,000원 기준 '총 정산 금액'을 받을 돈으로 믿고 근무·이의 제기를 판단. 실제 지급과 어긋나면 분쟁.
- **수정**: 표시 계층을 폴백 없는 해소기로 전환 — 기존 `resolveEffectiveSalaryWithSource`(helpers.ts:274-298)의 `source==='fallback'` 판정을 null 로 접는 방식이 최소 침습(지점 정산 배지가 이미 사용). `ScheduleConverter.ts:118` 의 DEFAULT 주입 제거/실단가 대체. **주의**: `salaryHelpers.test.ts:48-60` 이 폴백을 의도 계약으로 고정 중이고 `SettlementTab.preCheckout.test.tsx:36-37` 은 이 분기를 명시적으로 회피 — 계약 결정을 먼저 뒤집고 테스트를 red→green 으로 재고정해야 한다.

### 3-2. 정산 완료 근무를 노쇼로 뒤집을 수 있는데 되돌리기만 잠겨 있다 (단방향 비대칭) — **높음** · 규모 M
*(S3-01)*

- **위치**: `src/repositories/supabase/ConfirmedStaffRepository.ts:346-356`(markAsNoShow — 정산 잠금 **없음**) vs `:390-395`(cancelNoShow — BUSINESS_ALREADY_SETTLED 로 거부) · UI `src/domains/staff/statusTransitions.ts:81-89`(상태 무관 노출) · 서버 무방어 `20260712010000...sql:64-91`(custom_* 3컬럼만 동결, status 는 안 봄)
- **결함**: 선언된 상태기계(`statusFlow.ts:3-10`)는 completed→no_show 를 금지하지만 `canTransition` 의 런타임 호출부는 0곳. 서버 RPC 주석이 "노쇼 경로는 markAsNoShow/cancelNoShow 가 정본"(`20260810100000:285-290`)이라 지목한 그 정본에 잠금이 없다.
- **사용자 영향**: ① '지급 완료 + 노쇼' 모순 행이 DB 에 남는다. ② 스태프 월 수입 합계에서 **실제 받은 급여가 사라진다**(수입 합산은 completed 만 — `scheduleService.ts:324`). ③ 노쇼 취소는 거부되고 탈출 경로(정산 되돌리기 → 노쇼 취소 2단계)는 어디에도 안내 안 됨.
- **수정**: ① markAsNoShow 에 cancelNoShow 와 대칭인 정산 잠금(이미 행을 읽고 있어 한 블록) ② `getManualStatusTransitions` 에 정산 상태 반영 ③ 서버 트리거에 `payroll_status='completed' AND status 변경` 거부 블록 ④ 회귀 테스트+pgTAP(현재 역방향만 고정 — `cancelNoShow.test.ts:152-166`).

### 3-3. 지점 정산 상세 모달이 수당·세금 없이 재계산한 금액을 표시한다 — **높음** · 규모 S
*(S4-01)*

- **위치**: `app/(employer)/venue-settlements.tsx:395-401`(allowances/taxSettings 미전달) · `SettlementDetailModal.tsx:105-109` · `helpers.ts:180-182`(undefined → 수당 0·세금 0) · 대조군 `SettlementModals.tsx:132-139` 는 둘 다 전달
- **사용자 영향**: 같은 근무가 카드(canonical `afterTaxPay`)와 상세 모달에서 다른 금액 — 사장은 이 모달에서 지급 취소를 판단한다. 지급 완료 행조차 동결값이 아닌 실시간 재계산 표시(카드=동결/상세=재계산/취소모달=동결 3숫자 동시 가능). SETTLE-8 로 고친 결함이 모달에만 남은 형태.
- **수정**: `settlementVenueQuery.toSettlementWorkLog` 가 이미 해소한 allowances/taxSettings 를 실어 전달, 또는 모달에 `calculatedAmount` + 동결 우선순위 적용. (모달 금액 단언 테스트 0건.)

### 3-4. 정산 설정 저장 — 낙관적 잠금·0행 검증·금액 검증 3중 무방비 — **높음** · 규모 M
*(S8-02 + S8-07 병합)*

- **위치**: `src/repositories/supabase/JobPostingRepository.ts:996-1037(:1036)` · `jobManagementService.ts:403-424`(입력 무검증 통과) · `useStaffSettlementsHandlers.ts:316-325`(무조건 성공 토스트) · 대조 형제 `:790-812`(잠금+select+assert 3종 완비, 사유 주석까지)
- **결함**: ① **잠금 없음** — payload 가 문서 전체(`serialization.ts:399-402`: filledPositions·viewCount·stats 포함)라 조건 없이 쓰면 타인의 저장·트리거 갱신분이 되감긴다(last-writer-wins, 조건 없이 성립). ② **`.select()` 없음** — RLS 0행이어도 error=null → '정산 설정이 저장되었습니다' 거짓 토스트(권한 게이트 선행으로 좁은 경합 한정 — 정정 반영). ③ **검증 없음** — 주문서 경로는 `int`+1억 상한 강제인데 이 경로는 min(0)뿐, 세액 무제한. UI 로도 1억 초과 시급·무상한 고정세액 도달 가능(소수점·음수 세율은 입력기가 차단 — 정정 반영).
- **사용자 영향**: 정산은 JIT 로 이 문서를 다시 읽어 계산 — 오염·유실된 단가가 **곧 지급액 오류**다.
- **수정**: `updateWithTransaction` 과 동형으로(expectedUpdatedAt+잠금 필터+`.select('id')`+`assertPostingUpdateApplied` 재사용) + `settlementSettingsSchema` 신설(`MAX_SALARY_AMOUNT` 재사용). optimisticLock.test 하네스로 회귀 케이스 추가.

### 3-5. 탈퇴 회원의 공고가 모든 읽기 경로에서 무음 증발 — 스키마가 DB 진실보다 낡음 — **높음** · 규모 M
*(S8-01)*

- **위치**: `src/schemas/jobPosting.schema.ts:473`(ownerId 필수) · `:506`(closedReason enum 에 `owner_deleted` 없음 — 대신 DB CHECK 가 금지하는 유령값 'filled' 보유) · DB `20260807150000...sql:114-118`(owner_id=NULL + closed_reason='owner_deleted' 기록) · `JobPostingRepositoryHelpers.ts:41-47`(null → 키 소실) · `jobPosting.schema.ts:576-585`(파스 실패 = logger.warn + null)
- **사용자 영향**: employer 탈퇴 시 그 공고 전량이 이중 파스 실패로 스케줄 하이드레이션·지원이력·상세에서 **무음 증발**(#194 클래스 — RLS 는 행을 정상 반환하는데 클라가 버림). (정정: '정산 영구 불능'은 ownerId 소유권 비교가 원인이라 스키마를 고쳐도 별도 정책 결정 필요.)
- **수정**: `closedReason` enum 을 DB CHECK 와 일치, `ownerId` 를 `.nullable().optional()` 로 + 소비자 '탈퇴한 회원' 분기 + `{owner_id:null, closed_reason:'owner_deleted'}` 통과 회귀 테스트(현재 0건).

### 3-6. 근무표 '공고 열기' → 프리셋 1탭 = venueId 무음 소실/오염 — **높음** · 규모 S
*(S5-01 · 원 보고 critical → 하향: 공고는 정상 생성, venue 연결 누락/오기록 + 인앱 복구 곤란 클래스)*

- **위치**: `src/components/employer/order-sheet/hooks/useOrderSheetPresets.ts:87-113(:94)`(form.reset 전체 교체, venueId 보존 0건 — order-sheet 트리 전체 Grep 0건) · `create.tsx:66,70-76,165` · `venueSelection.ts:14-19,30-38` · `mappers.ts:162`
- **결함**: 그리드 진입 시 venueId 가 폼 값에 실리는데 프리셋 적용이 폼 전체를 교체 — 보존 로직 없음. 그리드 진입이면 지점 칩도 안 뜨고(routeVenueId 조건) 제출 보정도 없어 복구 경로 0. '마지막 공고' 프리셋이 타 지점 venueId 를 실으면 **엉뚱한 지점에 연결**(정정: 저장 템플릿은 venueId 를 아예 안 담아 항상 '유실' 쪽). 진입 직후엔 isDirty=false 라 되돌리기 토스트조차 없음. 편집 화면에 venue 재연결 UI 없음.
- **사용자 영향**: 부족 셀에서 만든 공고가 그리드 +N 뱃지·부족 집계에 영영 안 잡힌다 — 사장에겐 공고가 근무표에서 사라진 것처럼 보인다.
- **수정**: 프리셋 적용 시 구조 메타(venueId) 분리 보존(현재 폼의 venueId 를 reset 값 위에 유지, 프리셋 쪽 venueId 는 항상 버림) + 'venueId 실린 폼에 프리셋 적용 후 잔존' 회귀 1건.

### 3-7. SettlementBreakdown 이 taxableItems 를 버려 스태프 재계산 세금이 부푼다 — **중간** · 규모 S
*(S4-04)*

- **위치**: `src/domains/settlement/helpers.ts:463-469` · 타입 `src/types/schedule.ts:66-70` · 소비 `SettlementTab.tsx:128-152` · 서버 canonical 은 보존 `20260802160000...sql:322-336`
- **사용자 영향**: '기본급 과세 제외' 설정 공고에서 스태프 표시 금액이 실지급보다 **낮게**(재계산이 전 항목 과세로 회귀) — "앱 금액과 통장이 다르다" 문의 직결. 파리티 테스트는 Calculator 직접 호출이라 이 체인 미검증.
- **수정**: 타입에 `taxableItems` 추가 + `serializeTaxSettings`(이미 보존 구현 존재) 사용, 또는 breakdown 존재 시 재계산 금지.

### 3-8. '정산 대상' 술어가 SSOT 를 우회해 화면·서비스마다 복제·분열 — **중간** · 규모 S
*(S4-06 + S4-05 병합)*

- **표면 ① (medium)**: `src/services/work/settlement/settlementQuery.ts:31-33` 이 cancelled 만 제외하고 **no_show 통과** — venue 경로는 SQL 에서 둘 다 제외(`WorkLogRepositoryVenue.ts:83`), 규약(supabase-patterns §11)도 둘 다 요구. 서버는 no_show 정산을 거부하므로 공고 정산 배지 `pendingSettlementCount`(`settlements.tsx:182-184`)가 **영원히 0 으로 안 내려간다**. (정정: totalPendingAmount 는 게이트 때문에 노쇼 금액을 더하지 않음 — 피해는 목록 잔존+배지.)
- **표면 ② (low·휴면)**: `venue-settlements.tsx:117-127` 이 `isSettlableWorkLogStatus` SSOT 를 인라인 복제하고 payroll 축을 `=== PENDING` 으로 씀(형제 3곳은 전부 `!== COMPLETED`). 'failed' writer 가 현재 0곳이라 휴면이나 서버 RPC 는 이미 failed 를 허용 — writer 가 생기는 순간 카드 버튼과 일괄 바가 다른 모집단을 본다.
- **수정**: ① `isSettlementVisibleWorkLog` 에 no_show 추가(또는 SQL 통일) + 노쇼 '0원 확정' 정책 별도 결정 ② SSOT 술어로 교체.

### 3-9. 지점 정산 목록 — FlatList + 1000건 무신호 절단이 합계·일괄 정산에 그대로 반영 — **중간** · 규모 M
*(S4-08 · 정정: FlatList 도 기본 윈도잉은 있음 — 핵심은 정합성 절반)*

- **위치**: `venue-settlements.tsx:341-346,129-132,353` · `WorkLogRepositoryVenue.ts:85(limit 1000),91-99(logger.warn 만)`
- **사용자 영향**: 월 1000건 초과 지점(대회사 규모에서 도달 가능)에서 목록·'미정산 N건·합계 M원'·'전체 정산' 대상이 조용히 잘린다 — 남은 근무의 존재를 알 방법이 없다.
- **수정**: repo 가 `{items, truncated}` 반환 + 절단 배너·일괄 바 경고, `AppFlashList` 교체(형제 화면 관용구).

### 3-10. 음수 정산 감지 플래그가 존재하지 않는 컬럼 3개에 UPDATE — 한 번도 동작한 적 없는 안전망 — **중간** · 규모 S
*(S3-04)*

- **위치**: `src/repositories/supabase/WorkLogRepository.ts:633-650(:638)` · 쓰기 정본 39컬럼에 부재(`workLogColumns.ts:27-67`) · 호출부 `settlementCalculation.ts:113-125`(catch 삼킴, 주석은 폐기된 Firestore 인프라 지칭)
- **결함**: 항상 PGRST204 실패 → logger.error 만. 이 사고 클래스를 막으려 만든 회귀 가드(`workLogWriteColumns.test.ts`)의 검사 대상 밖. (정정: 서버에 negative_settlement_alert 트리거는 실재하나 payroll_amount<0 **저장 시**만 발화 — 이 경로는 0 클램프라 그 트리거도 미커버, '이 케이스 관리자 신호 0' 결론 유지.)
- **수정**: 제거(+Sentry 이벤트) 또는 컬럼/감사 테이블 신설 — 어느 쪽이든 코드가 결정을 말하게. 가드 대상에 WorkLogRepository 추가.

### 3-11~14. 낮음 (이음새)

| # | 제목(원 ID) | 위치 | 결함 / 영향 | 수정 | 규모 |
|---|---|---|---|---|---|
| 11 | 슬롯 패치 가드 키 목록이 서버 계약보다 낡음 (S3-05) | `workLogWriteColumns.test.ts:143-153` vs `WorkLogRepositoryVenue.ts:226-228,269-271` · 서버 `20260810100000:291-297` | customRole·status 누락 — 가드를 서버 사본으로 믿고 경로를 추가하면 정상 동작이 거짓 red | 목록을 프로덕션 타입에서 파생 + pgTAP 허용 키 단언 | S |
| 12 | 지점 역할 단가 0원 저장의 가시화 부재 (S4-07 · medium→low: '협의 불허' 불변식은 집행 중, confirm 문구가 0원을 노출 — 실체는 배지 없음) | `RoleSalaryField.tsx:35` · `20260723100000:51-53` · `helpers.ts:295-297`(0원도 source:'roleTable') | 0원 단가가 '정상 설정'처럼 보임 — 폴백 배지 미대상 | 하한 1 집행 또는 `source:'zero'` 경고 배지, 주석·테스트 의도 일치화 | S |
| 13 | 생성 타입 supabase.ts 가 prod 보다 낡음 — 컬럼 4개 누락 (S8-03 · high→low: posting_status enum 은 현재 동기 — '공고 증발'은 미래 enum 추가 시 조건부) | `src/types/supabase.ts:987-1024`(geo_lat/geo_lng/venue_id/conditions 부재) · SSOT 소비 `jobPosting.schema.ts:19,26` | 이 파일이 status enum SSOT — 낡은 채 enum 이 추가되면 해당 공고 전량 무음 증발 클래스 | 타입 재생성 + quality 에 신선도 가드 or pgTAP enum 집합 단언 | S |
| 14 | 재오픈이 closed_at·closed_reason 을 안 지움 (S8-09) | `JobPostingRepository.ts:883-891` vs `:924-928` · `serialization.ts:405-406`(편집마다 재기록) | 'active'+'manual 마감 흔적' 모순 상태 영구화 — 현재 오동작 소비자는 없으나 GAP-02 와 얽힘 | reopen payload 에 null 2개 추가(+bulk 경로) | S |

### 3-라. ⚠️ 미검증 발견 4건 — 크로스컷 (검증 패스 미수행. **기각 아님** — 인용은 실코드이나 독립 반증 절차만 안 돌았다)

#### GAP-01. 공고 삭제(cancelled)가 미확정·취소대기 지원서를 영구 방치 — **높음(미검증)** · 규모 M

- **위치**: `JobPostingRepository.ts:860-864`(status 만 변경, applications 무접촉) · 종결 트리거는 'closed' 전이에만 발화(`20260727000000:105`) · 스태프 캘린더는 공고 상태 무관 applied 탑재(`scheduleService.ts:45-49,487-491`)
- **영향**: 스태프 캘린더에 '지원' 카드 영구 잔존, cancellation_pending 은 심사자가 사라져 '취소 대기' 고착.
- **수정 방향**: 종결 트리거 WHEN 을 `('closed','cancelled')` 로 확장 + cancelled 분기 종결 처리 + 클라 '마감됨' 강등 표시.

#### GAP-02. 인원 빼기·지원 취소가 수동 마감 공고를 무통지 재개방 — **높음(미검증)** · 규모 S

- **위치**: `20260727120000...sql:111-117`(재개방 UPDATE 가 `closed_reason NOT IN ('expired','expired_by_work_date')` — **'manual' 통과**) · 동일 UPDATE `20260727180000:150-154` · 재개방 무통지(`20260727000000:483` status 의도적 제외) · 앱 스스로 "삭제 대신 마감" 안내(`JobPostingRepository.ts:857`)
- **영향**: 사장이 명시적으로 닫은 모집이 조용히 다시 열려 신규 지원 유입 — 앱이 안내한 동선("마감 후 인원 정리")에서 정확히 재현.
- **수정 방향**: 두 RPC 에 `AND closed_reason <> 'manual'` 추가(재개방은 명시 경로 전용). 유지 결정 시 owner 고지 + closed_* 정리(3-14 연동).

#### GAP-04. 다중일 지원확정 스태프의 하루 '빼기'가 지원서 전체 취소로 실행 — **높음(미검증)** · 규모 L

- **위치**: 문구 `VenueDayPanel.tsx:212`("이 날 근무에서 뺄까요?") vs 실행 `confirmedStaffService.ts:159-167` → `cancel_application_atomically`(날짜·workLogId 파라미터 자체가 없음) → `20260727180000:147`(`DELETE ... WHERE application_id = … AND status='scheduled'` — **전량 하드 DELETE**)
- **영향**: 대회사 D-7 다중일 확정에서 하루 조정 의도가 전체 배정 소멸+지원서 cancelled — 스태프에겐 전체 취소 알림. 메모·시각 조정 복구 불가.
- **수정 방향**: 단기 — 문구를 실제 범위('모든 날짜 N일 함께 취소')로 고지. 근본 — 부분 취소 RPC(p_work_log_ids) 신설. (관련 테스트는 전부 해당 함수를 목으로 대체 — '하루 빼기=하루만' 계약을 고정하는 테스트 0건.)

#### GAP-03. confirm_application 에 공고 status 게이트 부재 — 취소된 공고에서 확정 성공 — **중간(미검증)** · 규모 S

- **위치**: `20260803120000...sql:145-169(:160)`(v_job 로드 후 status 미검사) · 클라 게이트도 없음(`ApplicationRepositoryHelpers.ts:170-207`) · 취소 공고는 '전체' 탭 노출(`employerPostingFilter.ts:13-14`)
- **영향**: GAP-01 과 결합 시 — 취소된 공고에 scheduled work_logs 생성 + 스태프 '지원 확정' 알림 → 취소된 행사에 실제 출근 가능.
- **수정 방향**: RPC 에 `v_job.status='cancelled'` fail-closed 게이트(closed 포함 여부는 정책 결정) + 클라 사전 거부.

---

## 4. 개선사항 (결함 아님 — 구조·재발 방지 제안)

1. **목-갭 방지 체계**: 이번 감사에서 "테스트가 있어도 목이 계약을 버려 무효"인 사례가 다수(2-21, 2-4 의 생산자 우회, 1-8 의 빈 목 헬퍼, 3-1 의 의도적 회피 등). 핵심 컴포넌트(SheetModal·useMutation·서비스)의 **공유 목 팩토리**를 두고, 목이 버리는 prop/콜백을 팩토리 한 곳에서만 결정하게 하라. 기존 메모리의 3건 함정과 동일 클래스다.
2. **단위가 이름에 박힌 필드**: `filledPositions` 라는 중립 이름이 2-5 를 낳았다. `filledSeats`/`confirmedPeople` 분리(`projections.ts:96-108`).
3. **집계·술어의 단일 파생**: 근무표-5(집계 키), 3-8(정산 술어)처럼 "같은 개념을 두 곳에서 계산"이 반복 뿌리다. 키/술어를 도메인 모듈에서 export 하고 화면은 소비만.
4. **keyset 커서 유틸의 (orderBy,id) 복합화**: `paginatedQuery` 를 고치면 2-1 클래스가 구조적으로 재발 불가.
5. **raw Tailwind 색상 차단**: 1-14 에서 orange 가 6개 파일로 번식 — eslint 규칙 또는 tailwind 기본 팔레트 차단.
6. **생성 타입 신선도 가드**: `npm run quality` 에 '생성 타입 < 최신 마이그레이션이면 실패' + pgTAP 'DB enum 라벨 집합 == 레포 상수' 단언(3-13 재발 방지).
7. **0행 검증 관용구의 전면 적용**: `assertPostingUpdateApplied`/`.select('id')` 패턴이 있는데 안 쓴 곳에서만 사고가 났다(3-4, 2-20). 리포지토리 write 경로 전수 체크리스트화.
8. **문구 상수 단일화**: 협업자 검색 대상(닉네임)이 3곳에 흩어져 2-18 발생 — 기능당 문구 상수 모듈.
9. **`invalidateQueries.staffManagement` 헬퍼에 venue 축 포함**: 1-8 의 근본 — venue 스팬 리더 도입 이후 낡은 계약.
10. **errorMessageForRow 배열형 필드 일반화**: 2-3 의 절반 — roles/roleSalaries 에 이미 있는 순회 패턴을 공통화.
11. **필터 옵션-선택값 정합 가드**: 옵션 목록에서 사라진 값이 selected 로 남지 않게 하는 공통 훅(1-15, unpaid 고아화).

---

## 5. 감사 한계

1. **정적 분석 전용** — 실기기/시뮬레이터 렌더 관찰, 실 DB 실행, 네트워크 재현을 하지 않았다. 재현 시나리오는 전부 코드 추적 기반 필연성 논증이며, 특히 애니메이션·레이아웃·실측 성능(1-12, 3-9 의 체감)은 실기기 확인이 필요하다.
2. **미검증 4건(GAP-01~04)** — 인용은 실코드이나 확정 발견 64건에 적용한 독립 반증 패스를 돌지 못했다. 특히 GAP-02·04 는 서버 RPC 본문 전체 흐름(조건 분기 도달성)의 재확인이 필요하다. **착수 전 검증 패스 1회를 권한다.**
3. **prod 데이터 실측 불가** — 고정 공고 구형 행의 work_date 가 ''인지 null 인지 분포(2-1), 1000건 상한 도달 여부(2-19, 3-9), 'failed' payroll 행 존재 여부(3-8②)는 prod 쿼리로 확정해야 한다.
4. **RLS 실동작은 마이그레이션 텍스트 기반** — pgTAP 를 실행하지 않았다(로컬 Supabase 신선도 함정 이력 감안). 2-6·2-20 의 RLS 판정은 정책 정의문 실독 기반이다.
5. **경합(race) 시나리오는 추론** — 3-4 의 last-writer-wins, 1-11 의 이중 제출은 코드상 필연이나 실제 동시 실행 재현은 하지 않았다.
6. **범위 밖 영역** — 알림/푸시 파이프라인 상세, 인증·온보딩, ops 허브, admin 화면, 오프라인 쓰기 큐, E2E 스위트 자체의 정합, realtime 재연결 동작은 이번 감사 대상이 아니었다.
7. **테스트 스위트 전수 감사 아님** — 무효 테스트는 발견 항목에 딸린 것만 확인했다. 목-갭 전례(3건)와 이번 추가 확인(2-21 등)을 보면 다른 스위트에도 같은 클래스가 있을 개연성이 높다.