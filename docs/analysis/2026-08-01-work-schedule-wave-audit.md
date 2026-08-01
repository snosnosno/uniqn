# A레인 근무표 재설계 웨이브 사후 감사 (2026-08-01)

> 감사 레인지 `3c3b50266..0d4d99309` · 143파일 / +8761 −1046 · PR #370~#389 · 세션 S1~S5-후속 6개
> 방법: 7축 병렬 탐색(sonnet) → 축별 적대적 검증(fable) → 메인 세션 독립 재검증(prod 실측 + 코드 직독)

---

## 1. 한 줄 결론

**배포를 막는 것은 없다 — CRITICAL 0건, HIGH 1건이고 그 HIGH 는 이 웨이브가 만든 것이 아니라 선재 결함(#356)이다.**

이 세션의 핵심 질문("①②③ 같은 계열, 즉 *같은 판정이 복제됐는데 일부만 고쳐진* 자리가 더 있는가")에 대한 답은 **"그렇다, 2건 더 있다"** 이다. 둘 다 **S5-후속(#388)이 `isSettlableWorkLogStatus` SSOT 를 세우면서 소비처 하나씩을 빠뜨린 것**이고, 둘 다 같은 파일군 안에 있다:

- `settlementGrouping.ts` 의 **summary 집계 루프**에 **`status` 축이 빠졌다**(3축 중 2축만 커버) → 배지가 약속한 정산 가능 건수와 실제 버튼 유무가 어긋난다.
- `GroupedSettlementCard` 의 **그룹 체크박스**가 '선택 가능 행' 축이 아니라 '전체 행수' 축으로 남았다 → 혼합 그룹에서 **체크된 체크박스를 눌러도 해제되지 않는다**(신규 회귀).

즉 S5-후속이 "소비처를 전수로 세라"고 스스로 남긴 교훈이 **바로 그 커밋 안에서 두 번 더 어긋났다.** 이것이 이 감사의 가장 값어치 있는 발견이다.

**게이트 결과**: `npm test` 598 스위트 / 6534 테스트 전량 통과(exit 0, 기준값과 정확히 일치) · 파리티 **184/111 prod 실측 일치** · 마이그 4건 전부 적용 확인 · `e2e/` 파급 0건 · 코드 변경 **0건**(순수 읽기 전용 감사라 `npm run quality` 는 해당 없음).

---

## 2. 결함 표

심각도는 **재현 경로의 구체성**으로 판정했다. "그럴 수 있다"·"일관성이 없다"는 MEDIUM 이하다.
`선재` = 이 레인지 이전부터 있던 것 · `신규` = 이 웨이브가 만든 것.

### CRITICAL — 0건

없다. 억지로 채우지 않았다.

### HIGH — 1건

| # | 결함 | 파일:줄 | 재현 경로 | 구분 |
|---|---|---|---|---|
| **H1** | **근무 리마인더가 월 스코프로 동기화돼 다른 달의 유효 예약을 침묵 취소한다** | `app/(app)/(tabs)/schedule.tsx:333-336`(호출부) · `src/hooks/useSchedules.ts:568-579`(`useCalendarView` = `currentMonth` state) · `src/services/work/shiftReminderScheduler.ts:85-91`(planned 에 없는 원장 키 전량 취소) | 스태프가 8/1 확정 근무를 갖고 8월 화면을 열면 '전날 20시' 로컬 알림이 예약된다. 지난 정산을 보려고 **7월로 한 번 넘기면** 같은 `useEffect` 가 7월 `schedules` 로 재실행되고, 8/1 항목이 planned 에 없으므로 "계획에서 사라진 예약"으로 판정돼 **즉시 취소**된다. 8월로 돌아오지 않은 채 7/31 20시가 지나면 알림이 오지 않는다. 더 나쁜 하위 케이스: **다음 달 초 근무는 기본 뷰(이번 달)에 아예 없어**, '다음 달 보기 → 돌아오기'만으로 예약이 파괴되고 현재 달 재방문으로는 복원되지 않는다. | **선재**(#356 `26345059d`. S4 `40dc21779` 는 로딩 게이트만 추가했고 월 스코프는 도입도 수정도 안 했다) |

> 왜 CRITICAL 이 아닌가: 피해가 로컬 알림 소실이지 데이터·금전·권한이 아니고, 같은 달 재방문 시 당월 예약은 자가 치유된다.
> 왜 MEDIUM 이 아닌가: **평범한 달력 탐색 한 번**이 트리거이고, 기능의 존재 이유(확정 근무를 잊지 않게 하는 것) 자체가 무음으로 무력화된다.

### MEDIUM — 11건

| # | 결함 | 파일:줄 | 재현 경로 | 구분 |
|---|---|---|---|---|
| **M1** | **정산 그룹 배지의 `settlableCount` 에 `status` 축이 빠졌다** — 판정 복제 누락 ① | `src/utils/settlementGrouping.ts:243-248`(`else` 분기가 `!completed` 커버) + `:251-253`(`hasValidTimes` 만 추가 검사 → **`isSettlableStatus` 누락**, 3축 중 2축) ↔ `:377-386`(`getSettlableWorkLogIds` = 3축 전부) · 소비 `GroupedSettlementCard.tsx:395-401` | 정산 대기 2건 중 1건이 **시각은 있으나 status 미승격**(레거시 배치)인 스태프. summary 는 그 행을 `settlableCount` 에 넣어 배지를 "출퇴근 미완료 **1건**"으로 그린다(= 나머지 1건은 정산 가능하다는 뜻). 그러나 일괄 정산 버튼(`:447`)이 쓰는 `settlableWorkLogs` 는 3축을 다 보므로 **0건** → 버튼이 아예 렌더되지 않는다. 구인자는 "1건은 된다는데 버튼이 없다"를 설명 없이 마주한다. | **신규**(`564614f9d` → #388. 같은 커밋이 `createDateSettlementStatus`·`getSettlableWorkLogIds` 만 갱신) |
| **M2** | **혼합 그룹의 체크박스가 편도 토글 — 해제 불가** — 판정 복제 누락 ② | `GroupedSettlementCard.tsx:258`(`isAllSelected = selectedCount === group.originalWorkLogs.length`) · `:291-308`(해제 분기는 `isAllSelected` 일 때만) · `:324`(`checked` 는 `selectedCount>0`) ↔ 올바른 축 `SettlementList.tsx:318-319`(`selectableWorkLogs.length` 기준) · 원인 `SettlementList.tsx:228-240`(신설된 `selectableIds` 거부) | 일괄 정산 선택 모드 진입 → **지급완료 1건 + 정산가능 2건이 섞인** 흔한 스태프 그룹의 헤더 체크박스 탭 → 2건만 선택(`selectedCount=2 < 3` 이라 `isAllSelected` 영구 false, 그런데 체크박스는 **체크 표시**) → 해제하려고 다시 탭 → 선택 분기만 타고 지급완료 행 추가는 거부돼 **아무 일도 안 일어난다**. 탈출구는 카드 펼쳐 행별 해제 / 액션바 전체선택 후 해제 / 모드 이탈뿐. | **신규**(#388 이 `handleSelect` 에 `selectableIds` 게이트를 신설해, 이전엔 도달 가능하던 `isAllSelected` 를 그룹 레벨에서만 도달 불가로 만들었다) |
| **M3** | **알림이 약속한 '취소 요청' 버튼이 이미 취소 요청 중이면 없다** | 마이그 `20260731140000_notify_on_time_slot_change.sql:169-173`(`application_id IS NOT NULL AND status='scheduled'` 만) ↔ 클라 `ScheduleDetailModal.tsx:536-539`(`applicationId && !hasPendingCancellation`) | 스태프가 취소를 요청(`applications.status → cancellation_pending`, `work_logs.status` 는 `scheduled` 유지)한 뒤 구인자가 아직 처리하지 않은 상태에서 출근 예정 시각을 수정 → 알림 본문에 "어려우시면 취소를 요청할 수 있어요" 가 붙는다 → 눌러서 들어가면 '취소 요청 검토 중' 배지만 있고 **버튼은 숨겨져 있다**. 시각 수정에 `cancellation_pending` 가드도 없다(`WorkLogRepositoryVenue.ts` · `src/components/workSchedule/` grep 0건). | **신규**(#382). ⚠️ 같은 파일 163-168줄이 *"그 버튼이 실제로 있을 때만 말한다"* 는 불변식을 명시하고 있는데 **조건 집합을 클라의 진부분집합으로 잡아** 스스로 어겼다 |
| **M4** | **`wl_update` 에 `staff_id`·`owner_id` 를 막는 계층이 하나도 없다** | prod 실측: `wl_update` USING 에 두 컬럼 부재·`WITH CHECK` NULL · `authenticated` 에 두 컬럼 UPDATE 컬럼권한 존재 · `work_logs` 트리거 10개 중 `staff_id` 고정 0개(`fn_work_logs_pin_posting_id` 는 `job_posting_id` 전용) | 워크스페이스 멤버가 raw PostgREST 로 자기 공고의 work_log `staff_id` 를 타인 UUID 로 재지정. **증분은 하나뿐이다: 출근·정산이 끝난 근무 기록을 스태프 본인 이력에서 무음으로 지우는 것.** 정상 경로 `remove_direct_staff` 는 `checked_in/checked_out/completed` 를 거부하고 소프트 취소라 알림이 반드시 나가며, `work_logs` 에 DELETE 정책은 아예 없다 — 이 재지정이 그 가드를 우회하는 유일한 무음 삭제 수단이다. | **선재**(#242). #382 의 Case 2-B 가 발화면을 넓혔다 |
| **M5** | **지급 완료 취소가 스태프에게 완전 무음** | 발신 `20260731140000...sql:206-231`(`NEW.payroll_status='completed'` 전이에서만 INSERT, 역방향 Case 없음) · 클라 `SettlementRepository.ts:637-670`(원시 update, 알림 0) · 진입점 확대 `venue-settlements.tsx`(#388) | 스태프가 "정산이 완료되었습니다. 지급액 500,000원" 알림을 받는다 → 구인자가 되돌린다 → `payroll_status` 는 `pending`, `payroll_date` 는 null 이 되지만 **어떤 알림도 가지 않는다.** 손에는 완료 알림만 남고 화면만 조용히 '정산 대기'로 되돌아가 이의 제기 시점을 놓친다. | **선재 구조 + 신규 진입점**. ⚠️ **세션 경계 원칙 역전**: 같은 웨이브의 #382 가 "무음 변경은 결함"이라며 시각 변경 알림을 신설했는데, **금전 상태 역행이 시각 변경보다 덜 통지된다** |
| **M6** | **오프라인 MMKV 캐시 TTL 에 온라인 `staleTime` 을 그대로 재사용하는 훅 4곳** | `useJobPostings.ts:78`(10분) · `useWorkLogs.ts:86,150`(**30초**) · `useApplications.ts:122`(10분) · `useJobDetail.ts:139`(10분) ↔ 금지 사유를 명시한 주석 `queryClient.ts:627-645` · 삭제 효과 `criticalOfflineCache.ts:124-138` | 지하 홀덤펍에서 네트워크가 30초~10분 끊긴 채 '내 근무기록'을 열면 `query.data` 는 undefined 이고 오프라인 캐시는 TTL 초과로 null 을 반환 → **"근무 기록이 없어요"** 로 렌더된다. `schedules` 는 이미 `offlineCachePolicies.schedules`(24시간)로 분리돼 있어 패턴이 존재한다. | **선재**(메모리에 "4개 훅 잔존"으로 기록된 항목 — **실측으로 4곳 그대로 확인**) |
| **M7** | **`timeProvenance` 가 과거 수정 이력을 영구 보존해 신선한 QR 을 '수정됨'으로 오라벨** | `src/shared/time/timeProvenance.ts:48-55`(이력 전체에서 키 존재만 스캔, 시각 선후 비교 없음)·`:62-70`(이력 우선) · QR RPC 는 `modification_history` 미접촉 `20260727160000...sql:128-135` | ①QR 정상 출퇴근 → ②구인자가 퇴근시각 수정(이력 append, status 가 `checked_in` 강등) → ③현장 재QR 스캔(`end_time_source='qr'` 재기록) → ④정산 상세에서 **방금 찍힌 QR 기록이 영구히 '수정됨'** 으로 표시. 정산 분쟁 시 신뢰 근거가 뒤집힌다. | **신규**(S4 신설 모듈). 오라벨 방향이 보수적(QR→수정됨)이라 거짓 신뢰 부여는 아님 |
| **M8** | **퇴근 미기록 배너의 기반 쿼리 에러가 무음** | `app/(employer)/work-schedule.tsx:150`(`useVenueSettlement`) · `:154-156`(`summarizeMissingCheckouts(missingCheckoutQuery.data ?? [], ...)`) — `isError` 를 보는 곳이 없다 | 쿼리가 에러로 끝나면 `data` 가 undefined → `?? []` 가 빈 배열로 접어 **집계가 0건**이 된다. 조회 실패와 "미기록 0건"이 화면상 **완전히 같다.** 이 배너는 *자동 퇴근을 만들지 않기로 한 결정의 유일한 안전망*인데, 실패했을 때 안전망이 있는 척한다. | **신규**(S4) |
| **M9** | **`VenueSettingsSheet.saveProfile` 이 `location` 을 통째로 새 객체로 교체** | `src/components/workSchedule/VenueSettingsSheet.tsx:97`(`saveProfile`) · **`:108` `location: { name: placeName.trim() }`** — 기존 `location` 을 읽지도 병합하지도 않는다 · 서버도 병합하지 않는다: `20260731120000_venue_profile_rpcs.sql:147-174,212`(`'{}'` 에서 재구성 후 전체 교체) | 현재는 휴면(주소 필드가 아직 없음). **그러나 B1 세션이 지금 `district`/`detailedAddress` 를 추가하고 있다** — 머지되는 순간 지점 설정 저장 버튼이 사용자가 입력한 주소를 **소거**한다. | **신규**(S1). ⚠️ **B1 머지 전에 반드시 처리** |
| **M10** | **`GroupedSettlementCard` 렌더 테스트 0건** | `Grep GroupedSettlementCard` → `__tests__` 매치 **0건**(독립 확인). 렌더 소비처는 `SettlementList.tsx:279` 단 1곳 | 현재 결함이 아니라 커버리지 갭이다. 그런데 **M1·M2 가 정확히 이 컴포넌트에서 나왔다** — 갭이 이론이 아님을 이번 감사가 실증했다. 형제 `SettlementCard` 는 이번 웨이브에서 `SettlementCard.gate.test.tsx` 로 보호받았다. | **신규 갭**(선재 컴포넌트) |
| **M11** | **`'failed'` 를 어느 분기도 받지 않는 2값 비교 5곳** | 모달의 상호배타 쌍: `SettlementDetailModal.tsx:213`(`=== COMPLETED`) + `:276`(`=== PENDING`) — 둘 다 거짓이 되는 제3값이 있다 · `SettlementCard.tsx:182,208`(`=== PENDING`) · `SettlementList.tsx:152`(`=== PENDING`) · `:135`(필터 `=== selectedFilter`, `'failed'` 는 어느 필터에도 안 걸림) ↔ 올바른 형태 `GroupedSettlementCard.tsx:120-123`(`!== COMPLETED`) | `payroll_status='failed'` 행이면 모달의 두 분기가 **둘 다 거짓** → 버튼이 하나도 없는 빈 화면인데 배지는 '정산 대기'로 접혀 보인다. **현재 휴면**: `'failed'` 를 쓰는 경로가 앱 0곳·마이그 0곳·e2e 0곳(실측)이라 도달 불가. | **선재 4곳 + 신규 1곳**(`SettlementCard.tsx:182` 배너 블록은 레인지 내). 기준(2단 fold SSOT)은 #387 이 신설 |

### LOW — 12건 (요약)

| # | 결함 | 근거 | 구분 |
|---|---|---|---|
| L1 | 정산 확정·되돌리기가 **RPC 없이 클라 직접 `.update()`** — `status` 게이트·되돌리기 사유 필수가 서버에 없다. CLAUDE.md "정산=RPC 필수" 규약 위반 | `SettlementRepository.ts:286-293,336-339,637-667` · prod 에 `%settle%` 함수 **0개** 실측 | 선재 |
| L2 | `updateSlot` 의 `time_slot`·`color` 형식 검증이 클라 전용 — DB 에 CHECK·트리거 없음 | `WorkLogRepositoryVenue.ts:116-144` · `work_logs_xss_check` 대상은 `notes`,`custom_role` 둘뿐 | 선재 |
| L3 | rename 마이그 가드가 **동일 배치 내 목표명 수렴**을 못 본다 | `20260801100000...sql:47-62` 의 `EXISTS` 는 기존 title 만 조회 | 신규 |
| L4 | 다일 확정 지원의 알림 딥링크가 `applicationId` 만으로 착지 스케줄을 고른다 — 변경된 날짜가 아닌 날짜가 열릴 수 있다 | S3 알림 경로 | 선재 |
| L5 | `work_logs.time_slot` DB 레벨 형식 강제 부재 — S2 단일값 전제의 backstop 없음 | baseline CHECK 부재 | 선재 |
| L6 | 개별 '지급 완료' 버튼이 `isSettling` 중 얼리 리턴으로 **무피드백 무시**(`disabled` prop 부재) | `SettlementCard` | 신규 |
| L7 | 확정 스태프 로딩 중 근무 수정 시트의 실적 섹션 미표시 + `resolveAttendanceTarget` 방어 분기 도달 불가 | 자기문서화됨 | 신규 |
| L8 | `handleOpenRevert` 의 `workLog as SettlementWorkLog` 캐스트 — 현재 안전하나 검증 없는 단언 | `venue-settlements.tsx` | 신규 |
| L9 | 정산 라벨 맵 4곳 중복(`statusConfig.ts` · `settlementConfig.ts` · `SettlementDetailModal/constants.ts` · `GroupedSettlementCard.tsx` 로컬) — **라벨 텍스트는 SSOT 통합 완료**, 색/variant 만 분산 | `GroupedSettlementCard.tsx:69-73` 주석이 이미 자인 | 선재 |
| L10 | `update_venue_container` 의 `p_defaults` 는 여전히 소비 UI 0곳 + 요소 검증 얕음 | prod 함수 본문 | 불명 |
| L11 | `work_logs.start_time_source` 컬럼 여전히 부재 — 출근축은 원리적으로 QR 판정 불가 | 스키마 실측 | 선재 |
| L12 | rename 가드의 `COALESCE(kind,'')` 가 인덱스의 NULL-distinct 의미론보다 보수적(가짜 충돌 과차단 가능) | `20260801100000...sql` | 신규 |

---

## 3. 누적 잔여 재판정 표 (F축)

문서가 그렇다고 적은 것은 근거로 치지 않고 **코드·prod 를 직접 열어** 판정했다.

| # | 인수인계 로그의 주장 | 판정 | 근거 |
|---|---|---|---|
| 1 | S1 — `saveProfile` 이 `location` 전체 교체 → B1 머지 시 주소 소거 | **유효** | → M9. B1 진행 중이라 시급도 상승 |
| 2 | S1 — `p_defaults` 소비 UI 0곳, 요소 검증 없음 | **유효** | → L10 |
| 3 | S1↔S5 — `handle_new_user` 기본명 충돌 | **✅ 해소** | S5 판정이 정확했다. prod 실측 `handle_new_user` = `{이름} 팀`, `defaultNames.ts` 와 정합. **S1 의 "`{닉네임} 워크스페이스`" 기재가 stale 이었던 것** |
| 4 | S2 — 로딩 중 실적 섹션 미표시 / `resolveAttendanceTarget` 도달 불가 | **유효(LOW)** | → L7. 코드가 이미 정확히 자기문서화 |
| 5 | S2 — `add_direct_staff`·`confirm_application` 이 범위 `time_slot` 을 심을 수 있는가 | **재분류 → LOW** | prod 함수 본문 실측: 두 RPC 모두 `time_slot` 을 **읽기(`_posting_slot_key`)로만** 쓴다. 다만 DB 레벨 형식 강제가 없어 backstop 은 여전히 부재 → L5. **부수 실측: prod work_logs 3행 중 2행이 아직 레거시 범위 문자열이다** |
| 6 | S3 — 레거시 슬롯 색상 15종 하위호환 | **✅ 해소** | 정확히 구현됨. 퇴역 토큰 className 리터럴도 표에 보존돼 NativeWind purge 회피 |
| 7 | S4 — 리마인더 sync 월 스코프 오판 | **유효 · HIGH 로 격상** | → H1. 로그가 "선재 비차단"으로 적었으나 재현 경로가 '달력 한 번 넘기기'라 비차단으로 두기 어렵다 |
| 8 | S4 — `timeProvenance` 오라벨 시퀀스 | **유효** | → M7 |
| 9 | S4 — 배너 쿼리 에러 무음 | **유효** | → M8 |
| 10 | S4 — `start_time_source` 컬럼 부재 | **유효** | → L11 |
| 11 | S5 — 개별 지급완료 버튼 `isSettling` 무피드백 | **유효** | → L6 |
| 12 | S5 — `'failed'` 행 배지/필터 축 불일치, writer 0곳 | **유효(휴면)** | → M11. writer 0곳을 앱·마이그·e2e 3중 실측으로 재확인 |
| 13 | S5-후속 — 정산 라벨 맵 4곳 산재 | **재분류 → LOW** | 4곳 특정 완료. **라벨 텍스트는 이미 `PAYROLL_STATUS_LABELS` SSOT 경유**라 갈라질 수 없다. 남은 건 색/variant 뿐이고 코드가 이미 자인 → L9 |
| 14 | S5-후속 — 되돌리기 무통지 | **유효 · 격상** | → M5. "의도된 동작"이 아니라 **같은 웨이브가 세운 원칙과 정면 배치**로 재규정 |
| 15 | S5-후속 — `workLog as SettlementWorkLog` 캐스트 | **유효(LOW)** | → L8 |
| 16 | 웨이브 — 오프라인 TTL 겸용 훅 4곳 | **유효** | → M6. 4곳 전부 file:line 특정 |

---

## 4. 파리티 실측 기록 (prod `ygfxukhktpqymahfrvbz`, 2026-08-01)

| 항목 | 실측 | 레포 기대 | 판정 |
|---|---|---|---|
| public 함수 수 | **184** | `parity_baseline_guard.test.sql:91,111` = 184 | ✅ 일치 |
| public 정책 수 | **111** | `:92` = 111 | ✅ 일치 |
| SECDEF 함수 수 | 168 | — | 참고 |

**마이그 4건 prod 대조 — 스네이크 본명 기준**(파일명으로 찾으면 못 찾는다):

| 레포 파일명 | prod 기록 버전 | 상태 |
|---|---|---|
| `20260731120000_venue_profile_rpcs.sql` | `20260730185559 venue_profile_rpcs` | ✅ 적용 |
| `20260731130000_notification_counter_insert_guard.sql` | `20260730203014 notification_counter_insert_guard` | ✅ 적용 |
| `20260731140000_notify_on_time_slot_change.sql` | `20260731195045 notify_on_time_slot_change` | ✅ 적용 |
| `20260801100000_rename_default_venue_containers.sql` | `20260731195336 rename_default_venue_containers` | ✅ 적용 |

**함수 수 산식 검증**: 185(S1 이 RPC 2개 신설) − 1(`fn_notification_insert_increment` DROP) = **184**. `fn_notification_insert_increment` 는 prod `pg_proc` 에서 **소멸 확인**.

**`proconfig` 하드닝 보존 — 재정의된 4함수 전수 실측**(`CREATE OR REPLACE` 의 `SET` 절이 `ALTER FUNCTION` 하드닝을 지웠는지):

| 함수 | prod `proconfig` | `pg_temp` |
|---|---|---|
| `update_venue_container` | `search_path=public, extensions, pg_temp` | ✅ |
| `get_my_venue_contexts` | `search_path=public, extensions, pg_temp` | ✅ |
| `notify_on_work_log_update` | `search_path=public, extensions, pg_temp` | ✅ |
| `increment_unread_counter` | `search_path=pg_catalog, public, pg_temp` | ✅ |

**EXECUTE 권한**: 신설 RPC 2종 모두 `authenticated`/`postgres`/`service_role` 만 — **PUBLIC·anon 0** 확인.

**rename 마이그 재실행 안전성**: prod 컨테이너 4행 전부 rename 완료, 워크스페이스당 1건, 현재 title 로 candidate 재산출 시 **0건 → 완전 멱등**. L3 의 intra-batch 위험은 `db:reset`·신규 환경 재생에 한정된다.

**부수 실측**: `work_logs` 3행 — `application_id` NULL **2건**(M3 이 걸리는 비율) · 레거시 범위 `time_slot` **2건** · `time_slot IS NULL` 0건.
**피처플래그**: `ops_hub_enabled = false`(OFF 유지) · `weekly_grid_enabled = true`(키 보존). `runtimeVersion.policy = 'appVersion'`(`app.config.ts:418`).

---

## 5. 축별 커버리지 — 무엇을 어떻게 봤는가

| 축 | 결과 | 비고 |
|---|---|---|
| **A** 판정 복제 전수 | 2건(M1, M11) | 씨앗 6개 전수. `slotsOverlap` 은 **clean**(구인자 `detectSlotConflicts`·구직자 `detectScheduleOverlaps` 둘 다 SSOT 경유, 제3 재구현 없음). `scheduleTimeState` 도 clean(`WorkTab`·`GroupedScheduleCard` 흡수 확인). `isSettlableWorkLogStatus` 소비처 7파일 전수 → **누락 1건 발견(M1)** |
| **B** 클라↔서버 게이트 | 3건(M4, L1, L2) + 신규 1건(M5) | 선재 MEDIUM(`wl_update` WITH CHECK)을 **가설 3개로 분해해 2개 기각**(아래 §6) |
| **C** 알림 계약 | 3건(M3, M5, L4) | 클라 중복 발송 코드 **0건 확인**(지급완료는 트리거 전담이 맞다) |
| **D** 마이그 재생 | 1건(L3) + L12 | 레포 측은 에이전트, **prod 실측은 메인 세션**이 전담(§4) |
| **E** vacuous 테스트 | 1건(M10) + 신규 1건(M2) | **신규 테스트 20개 전부 정독**. `as unknown as` 캐스트는 전부 이미 파싱된 도메인 타입 픽스처용이고 **zod 게이트 우회 용도 0건** — S5 사고의 재발 없음. `SettlementRepository.venueContainer.test.ts` 는 파서를 **항상 null 로 목**하는 올바른 형태. 수정된 기존 테스트에서 **약화된 단언 0건** |
| **F** 잔여 재판정 | 16항목 전수(§3) | 2건 해소, 2건 재분류, 12건 유효 |
| **G** 리네임 금지 계약 | **0건** | 9개 대상 전부 `git log -S` 로 레인지 내 이동 여부 확인 → 전부 미변경. 에이전트 결과와 **내 prod 실측이 독립적으로 일치** |

**다루지 못한 것(정직한 명시)**
- **E축 red-green 실증 미수행.** 읽기 전용 감사라 소스를 되돌려 red 를 확인하지 못했다. 정적 논증까지만이다. 최우선 후보 3건: ①`SettlementRepository.venueContainer.test.ts:126-142` ②`venue_profile_rpcs.test.sql:253,268` ③`SettlementCard.gate.test.tsx:60-66`.
- **M4 의 실제 익스플로잇 미실행.** prod 데이터에 무단 쓰기를 하지 않기 위해 의도적으로 실행하지 않았다. 정책·권한·트리거 실측에 근거한 판정이다.
- **jest worker 경고의 원인 스위트 미특정**(선택 과제였고, exit 0·전량 통과이므로 신규 결함 아님을 확인하는 데서 멈췄다).
- 축 B 에서 `confirm_application`/`cancel_application` 내부 게이트, QR 체크인 내부, 역할 자기승격 방지는 얕게만 훑었다.

---

## 6. 방법 노트 — 기각한 가설 (조사 규율)

선재 MEDIUM("`wl_update` 에 WITH CHECK 부재 → 위조 알림")을 그대로 받아쓰지 않고 3가설로 분해해 prod 실측으로 판정했다.

| 가설 | 판정 | 근거 |
|---|---|---|
| H2 — `job_posting_id` 를 타 워크스페이스 공고로 재지정(교차 테넌트 오염) | **❌ 기각** | `fn_work_logs_pin_posting_id` 트리거가 **어떤 변경이든** 42501 로 차단(prod `prosrc` 실측) |
| H3 — payroll 컬럼 임의 조작 | **❌ 기각** | `protect_work_log_payroll_columns` 가 staff 를 차단. employer 허용은 설계 의도 |
| H1 — `staff_id`/`owner_id` 재지정 | **✅ 성립하되 증분은 좁다** | 방어층 0개는 사실. 그러나 "위조 알림·타인 스케줄 오염"은 **증분이 아니다** — `add_direct_staff`(SECDEF, `authenticated` 에 GRANT, **동의 검사 없음** prod 실측)가 이미 같은 행위자에게 임의 활성 사용자를 붙일 권한을 준다. 진짜 증분은 **출근·정산 완료 기록의 무음 삭제** 하나 → M4(MEDIUM) |

> 이 분해가 없었다면 M4 를 HIGH 로 잘못 올렸을 것이다. **"막는 계층이 없다"와 "그래서 새로 할 수 있는 일이 있다"는 다른 명제다.**

---

## 7. 후속 PR 제안

| 묶음 | 내용 | 왜 한 PR 인가 |
|---|---|---|
| **P1 — 정산 선택/집계 축 마무리** (권장 최우선) | M1(`settlementGrouping.ts:252-254` 에 `isSettlableStatus` 추가) + M2(그룹 `isAllSelected` 를 선택가능 축으로) + M10(`GroupedSettlementCard` 렌더 테스트 신설) | **셋 다 같은 미완의 산물**이다 — #388 이 "선택 가능"이라는 새 축을 도입하며 소비처 2곳을 빠뜨렸고, 그 컴포넌트에 렌더 테스트가 없어서 둘 다 통과했다. 테스트를 같이 넣어야 세 번째 누락이 안 생긴다 |
| **P2 — 알림 계약 정합** | M5(되돌리기 알림 Case 3-B 신설) + M3(`v_cancel_hint` 에 `cancellation_pending` 조건 추가) | 같은 트리거 함수(`notify_on_work_log_update`) 하나를 고친다. **마이그 1건으로 끝나므로 쪼개면 레인을 두 번 막는다.** ⚠️ `CREATE OR REPLACE` + `SET search_path TO 'public','extensions','pg_temp'` 유지 필수(DROP 하면 PUBLIC EXECUTE 부활) |
| **P3 — 리마인더 스코프 수선** | H1 단독 | **유일한 HIGH 이고 독립적이다.** 다른 것과 묶으면 롤백 단위가 커진다. 회귀 테스트(8월 예약 후 7월 navigate → 원장에 8월 키 잔존 단언)가 이 PR 의 본체다 |
| **P4 — B1 머지 직전 차단** | M9(`saveProfile` 의 `location` 병합) | **B1 이 머지되기 전에 들어가야 한다.** 순서를 놓치면 사용자 주소가 소거된다. 한 줄짜리라도 별도 PR 이어야 순서를 강제할 수 있다 |
| **P5 — 방어심화(선택)** | M4(`REVOKE UPDATE (staff_id, owner_id) ON work_logs FROM authenticated`) + L1(정산 RPC 화) + L2(`time_slot` CHECK) | 전부 "정상 경로엔 영향 0, 우회 경로만 닫는" 성격. **M4 는 수선이 유난히 싸다** — 클라 경로에 두 컬럼 쓰기가 **0건**(레포 전수 grep)이고 정당 변경자는 SECDEF RPC 2개(`permanently_delete_user`·`remove_direct_staff`)뿐이라 컬럼 REVOKE 만으로 닫힌다(SECDEF 는 owner 권한이라 무영향) |
| **P6 — 오프라인 표시(선택)** | M6(훅 4곳에 `offlineCachePolicies` 전용 항목) | `schedules` 가 이미 쓴 패턴의 기계적 복제 4회. 한 PR 이 자연스럽다 |

---

## 8. 감사가 확인한 "안전"

억지로 결함을 만들지 않기 위해, **찾아봤으나 깨끗했던 것**도 남긴다.

- `slotsOverlap` — S2 가 남긴 최대 위험(구인자/구직자 판정 분기)은 **완전히 SSOT 로 수렴**. 제3의 겹침 재구현 없음.
- `scheduleTimeState` 3상태 — `WorkTab`·`GroupedScheduleCard` 두 갈래가 실제로 SSOT 로 흡수됨. 4번째 재구현 없음.
- **지급완료 알림 중복 발송 없음** — 클라에 발송 코드 0건. 트리거 전담이 맞다.
- **신규 테스트 20개 중 zod 게이트 우회 0건.** S5 의 vacuous 사고가 재발하지 않았고, `parseJobPostingDocument` 를 항상 null 로 목하는 올바른 형태가 정착했다.
- **기존 테스트의 단언 약화 0건.**
- **리네임 금지 계약 4종 전부 무사**(G축 0건 + prod 실측 교차 확인).
- **`proconfig` 하드닝 4함수 전부 보존** — 이 웨이브가 가장 크게 걱정한 함정이 실제로는 안 터졌다.
- `e2e/` 시드가 새 정산 게이트 축(`checked_out`)을 그대로 통과 — 파급 0건.

**단 하나 남는 커버리지 공백**: prod work_logs 의 2/3 가 레거시 범위 `time_slot` 인데 **e2e 시드는 전부 단일값**이다. 즉 실제 데이터 다수가 밟는 경로를 E2E 가 한 번도 밟지 않는다. 유닛(`EditSlotSheet.legacyRange.test.tsx`)은 있으니 차단 사유는 아니지만, 레거시 범위 시드를 한 건 추가하면 값어치가 크다.

---

## 9. 이 문서 자체의 검증 이력

이 감사 문서는 **code-reviewer(fable)에 근거 검증을 디스패치**해 "근거 없는 단정·재현 불가 주장"을 거르는 게이트를 통과했다.

- **판정: 수정 후 APPROVE · 기각해야 할 주장 0건.**
- 우선 검증 대상(H1 · M1 · M2 · M3 · M4/§6 · §3 해소 2건) 전부 **인용·재현 경로·선재/신규 귀속이 실코드와 일치**. M2 의 "신규 회귀" 귀속은 `git show 3c3b50266:...SettlementList.tsx` 로 구버전 `handleSelect` 가 **무게이트**였음을 확인해 독립 재현됐다.
- **반영한 정정 3건**(전부 표현·인용 정밀도, 결론 불변):
  1. M1 — "3축 중 1축만" → **`status` 축 1개 누락(2/3 커버)**. summary 의 `else` 분기(`:243-248`)가 `!completed` 를 이미 커버한다.
  2. M11 — `SettlementDetailModal.tsx:213` 은 `=== PENDING` 이 아니라 **`=== COMPLETED`** 다. 제목을 "`'failed'` 를 어느 분기도 받지 않는 2값 비교"로 교체. `SettlementList.tsx:135` 도 리터럴이 아니라 `selectedFilter` 비교(효과 동일).
  3. M9 — 서버 측 전체 교체 근거(`20260731120000...sql:147-174,212`) 추가. M8 의 `file:line` 도 감사 중 보강했다.
- 심각도 조정 권고 **0건** — H1 의 HIGH 와 M4 의 MEDIUM 이 근거 대비 적정하다는 판정.
- 검증에서 재독하지 않은 범위: E축의 "신규 테스트 20개 전독"·"기존 단언 약화 0건"(원 탐색 에이전트 결과에 의존).
