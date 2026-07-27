# 근무표(work-schedule) 전면 감사 — 로드맵 (2026-07-27)

> 방법: 7영역 병렬 감사(구인자 플로우 / 스태프 플로우 / 공고 연결 / 팀 연결 / 리네이밍 인벤토리 /
> 데이터·RPC / UI 품질) → CRITICAL·HIGH 48건 반증 검증 → 종합. 발견 107건, 판정 CONFIRMED 40 ·
> PARTIAL 8 · REFUTED 0.
> 관련 커밋: `15b22f94f`(리네이밍) · `6f9f2ebe9`(라이브 결함 6종) · `52e450a08`(의존성)

---

## ⚠️ 본문 전제 정정 — 반드시 먼저 읽을 것

아래 본문은 **"플래그가 꺼져 있어 아무도 못 쓴다(다크런치)"** 를 전제로 우선순위를 짰다.
그 전제는 **틀렸다**. 감사 에이전트가 마이그레이션 시드 파일
(`20260710000004_baseline_data_seed.sql:34`, 값 `false`)을 읽고 현재 prod 상태로 오인한 것이다.

prod 실측(2026-07-27):

| 확인 항목 | 실측값 |
|---|---|
| `app_config.weekly_grid_enabled` | `{"enabled": true}` — `updated_at 2026-07-19 11:54 UTC` |
| RLS 정책 | `config_select` = `USING (true)`, 대상 `{authenticated, anon}` |
| 테이블 권한 | authenticated·anon 모두 SELECT 보유 |
| 실사용 | `job_postings.status='container'` 4건 · `work_logs` 2건(전부 직접 배치) |

→ **근무표는 이미 라이브다.** 따라서 본문의 C급(조용한 오답)·B급(데드엔드)은 "출시 전 정비"가
아니라 **현재 열려 있는 결함**이다. 볼륨이 작아 실피해는 아직 없지만, 1.0.5 스토어 심사 통과가
진짜 마감선이다. 본문 §7 의 "다크런치는 방어막이니 걷지 마라"는 조언도 성립하지 않는다 —
방어막은 2026-07-19 에 이미 내려갔다. **P0-11(플래그 ON 절차)은 이미 완료된 항목이다.**

교훈: 시드 파일은 초기값이지 현재 상태가 아니다. 플래그·설정의 현재 값은 반드시 prod 실측으로
확인한다(같은 부류: `pitfall_last_work_date_never_written_dead_cron`).

## 이번 세션에 이미 처리한 것

- **리네이밍 완료** — `weeklyGrid` → `workSchedule`, 라우트 `/employer/work-schedule`.
  DB 플래그 키(`weekly_grid_enabled`)는 레거시 계약이라 **의도적으로 제외**(코드 주석으로 봉인).
  딥링크는 구 세그먼트 `weekly-grid` 하위호환 유지(이미 발송된 알림 보호).
- **빌드 fallback `false` → `true`** — 원격이 ON 인데 fallback 이 false 라 원격 조회 실패 시
  근무표가 사라지고 튕기던 문제. 원격 false 는 그대로 반영되므로 kill switch 는 유지.
- **본문 P0 중 코드 레벨 6종 수정** — P0-1(시간 덮어쓰기) · P0-5(월 이동 날짜 동기화) ·
  P0-6(조회 실패 위장, 지점목록+지점정산) · P0-9(골드 대비·무효 클래스) · P0-10(초대 고지) ·
  P1-4(공고 라이프사이클 → 근무표 캐시 무효화 5경로).

## 남은 것(우선순위 순)

1. **P0-2 / P0-3 / P0-4 — DB 마이그레이션 동반**(이번 세션 범위에서 사용자 결정으로 제외):
   빼기 하드 DELETE → 소프트 취소 전환, `update_venue_slot` SECDEF RPC 승격,
   컨테이너 배치의 지점명·장소·연락처를 스태프 화면에 전달. **셋 다 "스태프가 모른다" 계열**이라
   실사용이 늘기 전에 닫아야 한다.
2. **P0-7** 부족 뱃지 status 필터 1줄(마감·취소·만료 배제) — SQL 한 줄이지만 마이그레이션.
3. P1 이하는 본문 참조.
4. **근무표 e2e 커버리지 0건**(P2-9) — 이번 리네이밍도 유닛/타입으로만 검증했다.

---

# 근무표(weekly-grid) 기능 완성도 향상 로드맵

> 근거 기준: `C:/Users/user/Desktop/T-HOLDEM-schedule/uniqn-mobile` (읽기 전용 실측). REFUTED 판정 항목 제외, PARTIAL 항목은 교정된 내용으로 반영.

---

## 1. 한 줄 결론

근무표는 **DB 인가·SSOT·a11y 설계는 이 레포에서 가장 잘 만들어진 축인데, 원격 플래그가 꺼져 있어 아무도 못 쓰고, 켜는 순간 "빼기·시간변경이 스태프에게 통보되지 않고 · 시간 미정 슬롯이 18:00–02:00으로 조용히 덮어써지는" 데이터·신뢰 결함부터 맞는** — 도구는 다 지어놓고 문을 안 연 상태다.

---

## 2. 제품 판정

### 2-A. 홀덤펍 사장 (상시 단발 알바) — **현재 0점 / 결함 수정 후 60점**

하루 업무를 그대로 따라가면 이렇게 막힌다.

| 단계 | 사장이 하려는 것 | 실제 결과 | 근거 |
|---|---|---|---|
| ① 진입 | '내 공고' 탭에서 근무표 열기 | **버튼이 렌더되지 않음.** 딥링크로 직접 가도 workspace로 튕김 | `app/(app)/(tabs)/employer.tsx:354` `{weeklyGridEnabled ? <Button …>}` / `app/(employer)/weekly-grid.tsx:154-156` `<Redirect href="/(employer)/workspace" />` / 원격값 `{"enabled": false}` `supabase/migrations/20260710000004_baseline_data_seed.sql:34` + 빌드 fallback `src/config/featureFlags.ts:14` |
| ② 첫인상 | 내 지점 이름 확인 | 자동 생성 지점 이름이 **'홍길동 팀'**. ⚙를 눌러도 단가표만 열려 이름 변경 불가, 삭제 경로도 코드에 없음 | `src/hooks/weeklyGrid/useEnsureDefaultVenue.ts` `mutate(workspaceName)` / `src/components/weeklyGrid/VenueSettingsSheet.tsx:6` "v1 범위: 단가표만(지점 이름 변경 등 제외)" / `renameVenue|deleteVenueContainer` grep 0건 |
| ③ 한 달 세팅 | 매주 화·목 딜러2+서빙1 (27건) | **반복 입력 수단 0.** 배치 1건당 최소 4탭 → 108탭 + 날짜 이동 9탭. 있던 요일 벌크는 회귀 가드로 제거됨 | `src/components/weeklyGrid/__tests__/VenueDayPanel.test.tsx:2-7, 89-97` / `recurring\|repeat\|반복\|매주` weeklyGrid 전역 프로덕션 코드 0건 |
| ④ 목표 인원 | "오늘은 3명이면 된다" | 저장 성공 토스트가 뜨고 **숫자가 눈앞에서 5로 되돌아감**(공고 좌석합에 눌림). 이유 안내 없음 | `src/domains/weeklyGrid/buildGridCells.ts:36-37` `Math.max(manual, row.requiredCount ?? 0)` / `src/components/weeklyGrid/VenueDayPanel.tsx:184-187, 202, 213` |
| ⑤ 인원 빼기 | 목요일 딜러 A 제외 | **A에게 알림 0건.** 하드 DELETE라 트리거 자체가 없음 → A는 목요일에 출근함 | `supabase/migrations/20260718000000_seat_basis_filled_total_positions.sql:375` `DELETE FROM work_logs WHERE id = p_work_log_id` / work_logs 트리거 7종 전수(`baseline:12205/12303/12310/12499/12506/12513/12520`)에 DELETE 트리거 없음 |
| ⑥ 시간 변경 | 18:00 → 20:00 | **알림 0건.** 트리거는 `modification_history` 길이 증가로만 발화하는데 updateSlot이 그 필드를 안 건드림 | `src/repositories/supabase/WorkLogRepositoryVenue.ts:102-137` / `baseline:5546-5552` |
| ⑦ 메모만 수정 | 색상·메모만 고치고 저장 | **시간 미정 슬롯이 18:00–02:00 익일 8시간 근무로 확정됨** | `EditSlotSheet.tsx:57` `DEFAULT_END='02:00'`, `:88-90` `setEndTime(parts.end \|\| DEFAULT_END)`, `:152-163` 무조건 전송 → `WorkLogRepositoryVenue.ts:111-113` |
| ⑧ 월말 정산 | 직접 배치 3명 지급 완료 처리 | **버튼이 없음.** 컨테이너는 공고 상세 조회에서도 차단돼 우회 경로 없음 | `app/(employer)/venue-settlements.tsx:66-68` 주석("mutation 미배선이라 노출하지 않는다") / `src/repositories/supabase/JobPostingRepository.ts:216` `.neq('status', CONTAINER)` |

**판정**: ①~③에서 이미 이탈한다. ①은 운영 결정(다크런치)이므로 "쓸 수 없다"가 아니라 "아직 안 열었다"가 정확하지만, ⑤⑥⑦은 열자마자 **가장 비싼 실패(헛걸음·시간 오인·정산 오염)** 를 만든다. 지금 켜면 안 된다.

### 2-B. 대회사 운영팀 (D-7 ~ D-day) — **현재 0점 / 결함 수정 후 35점**

| 단계 | 하려는 것 | 실제 결과 | 근거 |
|---|---|---|---|
| ① D-7 공고 | 대회 공고 발행 | 지점이 2개 이상이면 **지점 칩을 안 고르면 venue_id 없이 발행** → 어느 근무표에도 안 뜸. 수정 화면에 칩이 없어 **사후 연결 불가**(지원자 있으면 재작성도 못 함) | `src/services/jobs/jobManagementService.ts:113-114` / `app/(employer)/my-postings/create.tsx:239` / `app/(employer)/my-postings/[id]/edit.tsx` 에 `VenueSelectChips` 0건 |
| ② 목표 설정 | 딜러30·플로어6·서빙4 | 입력칸은 **숫자 하나**. '부족 12명'이 어느 역할인지 화면 어디에도 없음 | `src/domains/weeklyGrid/softTargets.ts:16` `Record<string, number>` / `useSetVenueSoftTarget.ts:14-18` |
| ③ D-day 배치 | 딜러 30명 | UI가 1건 고정이라 30사이클(≈120탭). 서버 RPC도 **스태프는 스칼라**라 30회 호출은 불가피 — UI가 막고 있는 건 "한 사람 × 여러 날"뿐 | `src/components/weeklyGrid/addSlotPayload.ts:115` `assignments: [assignment]` / `add_direct_staff(p_job_posting_id uuid, p_staff_id uuid, p_assignments jsonb)` (`20260718000000:196`) |
| ④ 동시 작업 | 팀장·매니저가 같이 편성 | **realtime 0건 + 월 요약 staleTime 5분.** 상대가 채운 4명이 최대 5분간 '부족'으로 남아 중복 공고를 유도하고, 시각만 다르면 서버 중복가드도 통과해 **이중 배치** | weeklyGrid 훅 `createRealtimeSubscription` 0건 / `useGridSummary.ts:45` `cachingPolicies.frequent`(5분) / 중복가드는 date+slot_key+role_key 동시 일치(`20260717093000:130-137`) |
| ⑤ 부족 판독 | 빨간 뱃지 신뢰 | 마감·취소·만료 공고 좌석이 **영구 산입**(status 필터 자체가 없음) → 손쓸 수 없는 빨간불이 상시 켜짐 | `supabase/migrations/20260719100000_grid_tournament_inclusion_reject_filter.sql:52-73` — WHERE에 `jp.status` 조건 0건 |
| ⑥ 협업자 초대 | 매니저에게 편집 권한 | 초대 고지는 "공고를 만들고 수정"인데 **실제로는 지점 단가(급여) 변경 + 전원 월 정산 열람 가능**. 클라 권한 분기 0건 | `app/(employer)/workspace/invite.tsx:143-144` vs `20260723100000_venue_role_salary_rpc.sql:64-71` / weeklyGrid·venue-settlements 프로덕션 코드에 `isOwner\|ownerId` 0건 |

**판정**: 대회사에게 근무표는 **역할 축이 없고(②), 반복이 없고(③), 동시 편집이 안전하지 않으며(④), 신호를 믿을 수 없다(⑤).** 월 캘린더 1차 뷰는 "D-7~D-day 역할별 충원 곡선"이라는 이들의 유일한 질문에 답하지 못한다. 홀덤펍보다 적합도가 더 낮다.

---

## 3. 치명적 차단 요인

**(A) 도달 불가 — 기능 자체에 못 감**

| # | 차단 | 근거 |
|---|---|---|
| A1 | `weekly_grid_enabled` 원격/빌드 모두 false, **앱 안에 켤 표면 0곳**(app_config 쓰기 코드 0건) → 진입 버튼·화면 Redirect·쿼리 enabled 4중 게이트가 전부 닫힘 | `featureFlags.ts:14` / `20260710000004:34` / `appConfigService.ts` 는 읽기 2함수뿐 / `weekly-grid.tsx:154` / `employer.tsx:354` |

**(B) 데드엔드 — 들어갔는데 나올 길이 없음**

| # | 차단 | 근거 |
|---|---|---|
| B1 | **스태프가 직접배치 근무를 거절·취소할 수단이 0.** `application_id=NULL`이라 취소 버튼 두 개가 렌더 자체를 안 함. 남는 건 '신고'뿐이고, 구인자 연락처 섹션도 사라져 앱 밖으로 나가는 수밖에 없음 | `20260718000000:306` `p_staff_id, p_job_posting_id, NULL,` / `ScheduleDetailModal.tsx:425-428, 444-447, 463` / `InfoTab.tsx:236` |
| B2 | **직접 배치 인원의 지급 확정 경로가 앱 안에 없음.** 지점 정산은 읽기 전용, 공고 정산은 컨테이너 차단 | `venue-settlements.tsx:66-68` / `JobPostingRepository.ts:216` |
| B3 | **필요 인원을 공고 좌석합보다 낮출 수 없는데 성공 토스트만 뜸.** 같은 값 입력 시엔 저장 버튼이 비활성이라 "내 목표"를 시스템에 남길 방법 자체가 없음 | `buildGridCells.ts:36-37` / `VenueDayPanel.tsx:184-187, 202, 310` |
| B4 | **지점 이름 변경·삭제 기능이 코드에 없음.** 오타/중복 지점이 영구 잔존 | `VenueSettingsSheet.tsx:6` / rename·delete 훅 grep 0건 |
| B5 | **다지점 공고의 venue 연결을 사후에 못 고침**(edit 화면에 지점 칩 없음) | `app/(employer)/my-postings/[id]/edit.tsx` 에 venue 0건 |
| B6 | **QR 출근이 구조적으로 불가능한데 스태프에겐 QR 버튼이 계속 보임.** DB는 컨테이너를 허용하는데 QR을 띄우는 화면이 컨테이너를 배제 | `baseline:8335`(container 허용) vs `my-postings/[id]/qr.tsx:38,68` + `JobPostingRepository.ts:216` / `WorkTab.tsx:89-90` |
| B7 | **팀을 보관하면 근무표가 통째로 사라지고, 근무표는 복원 대신 '내 팀'을 새로 만들어 사고를 은폐.** 확인 문구는 "공고와 기록은 보존"만 말함 (팀 화면에는 보관함 진입점이 있으므로 데이터 소실은 아님 — 근무표에서만 길이 끊김) | `workspace/index.tsx:66-67` / `archive_workspace` `baseline:971-973`(container 미차단) / `list_my_workspaces:4057` / `weekly-grid.tsx:84-88` |

**(C) 조용한 오답 — 화면이 사실이 아닌 것을 단언**

| # | 차단 | 근거 |
|---|---|---|
| C1 | **시간 미정 슬롯을 편집 저장하면 18:00–02:00 익일 8시간으로 확정.** 되돌릴 UI 없음, 정산 입력값 오염 | `EditSlotSheet.tsx:57, 88-90, 152-163` → `WorkLogRepositoryVenue.ts:111-113` |
| C2 | **빼기·시간변경·역할변경이 스태프에게 무통보** (헛걸음/2시간 손해) | `20260718000000:375` / `WorkLogRepositoryVenue.ts:102-137` vs `baseline:5546-5552` |
| C3 | **직접배치 근무가 스태프 앱에 '이벤트'로, 장소 공란, 연락처 섹션 소실.** 알림 본문은 지점명을 말하는데 화면은 '이벤트' → 다른 근무로 오인 | `scheduleService.ts:131, 562` (title 인자 미전달) → `ScheduleConverter.ts:69` `title \|\| '이벤트'` / RPC `20260724130000` RETURNS TABLE에 `jp.title` 없음 |
| C4 | **월을 넘기면 요약 칩은 '현재 0명', 그 아래 카드는 3명** — 같은 화면이 같은 날에 대해 두 값을 동시에 말함. 그 상태로 필요 인원을 저장하면 **이전 달 날짜에 저장됨** | `weekly-grid.tsx:98, 131-132, 51-66, 317` / `VenueDayPanel.tsx:103-105, 211` vs `VenueDayDetail`(date 직접 조회) |
| C5 | **지점 정산 조회 실패가 "이 달 정산할 근무가 없어요"로 위장.** 에러 분기·재시도·PTR 전부 없음 (금전 화면) | `venue-settlements.tsx:59`(isError 미수용), `:175-194` |
| C6 | **지점 목록 조회 실패가 "지점이 없어요"로 위장** → 시키는 대로 지점을 새로 만들면 이름이 한 글자만 달라도 진짜 중복 지점이 생기고(B4로 삭제 불가) | `weekly-grid.tsx:209-243` 에 `containersQuery.isError` 분기 0건 |
| C7 | **마감·취소·만료 공고 좌석이 필요 인원에 영구 산입** → 부족 뱃지 신뢰도 붕괴 | `20260719100000:52-73` |
| C8 | **고정(상시) 공고는 근무표에 3중으로 안 보임** — 필요 인원·공고·배치 뱃지 모두 0. 확정자마저 `date='FIXED_SCHEDULE'` 문자열 비교에서 탈락해 headcount에도 안 잡힘. **1차 타깃(홀덤펍 상시 인력)의 주 경로가 통째로 비어 있음** | `draftAdapter.ts:351` `date: null` / `20260719100000:63` `req->>'date' IS NOT NULL` / staffed CTE의 `wl.date >= p_from` 텍스트 비교 |

---

## 4. 양방향 연결성 지도

### 4-A. 공고 ↔ 근무표

**(a) 이어져 있는 것**
- 근무표 → 공고: 부족 셀 CTA가 `venueId/date/count`를 실어 보내고 폼과 DB(`venue_id`)까지 전달, 발행 후 `router.back()`으로 근무표 복귀 — `VenueDayPanel.tsx:278-282` → `src/utils/order-sheet/mappers.ts:498-519` → `create.tsx`
- 공고 → 근무표: dated 공고의 `requirements` 좌석합이 `required_count`로 파생돼 필요 인원에 자동 반영 — `20260719100000:52-73`
- 공고 **생성** 시에만 그리드 캐시 무효화 — `useJobManagement.ts:131` `queryKeys.weeklyGrid.all`

**(b) 끊긴 것**

| 끊김 | 근거 |
|---|---|
| 공고를 발행해도 **셀이 1픽셀도 안 변함**(이미 목표를 저장한 날). `max(manual, required)` 병합 + headcount 0 → 부족 뱃지·칩·CTA 전부 그대로 → 같은 날 중복 공고 유도 | `buildGridCells.ts:37` / `gridSlotState.ts:48, 56-59` / `VenueDayPanel.tsx:272-289` |
| 공고 **수정·마감·삭제·재개방·일괄상태변경**이 그리드 캐시를 무효화하지 않음. `invalidationStrategy.ts`에 `weeklyGrid.all`이 선언돼 있으나 `invalidateRelated('jobPosting.*')` 호출처가 프로덕션 0건(테스트만) | `useJobManagement.ts` 의 update/delete/close/reopen/bulk onSuccess에 weeklyGrid 없음 / `invalidationStrategy.ts` weeklyGrid 12건은 전부 선언부 |
| **'지원자가 왔다'는 신호가 근무표에 도달 안 함.** weeklyGrid 전 모듈에 applications 조회 0건 | `VenueDayPanel.tsx:108, 117-122` 만 소비 |
| '공고' 뱃지가 **열린 공고 수가 아니라 배치가 발생한 공고 수** — 주석·범례와 SQL 불일치, `meta.unit`('건')은 렌더되지도 않는 dead field | `20260719100000:45` vs `gridSlotState.ts:20`, `gridBadgeMeta.ts:26-31`, `CalendarCell.tsx:140-144`, `GridBadgeLegend.tsx:29-33` |
| **고정(상시) 공고 전면 미반영** (C8) | 위 표 |
| 마감·취소 좌석 영구 산입 (C7) | 위 표 |
| **공고 → 근무표 역방향 진입점 0개.** 공고 상세 어디에도 "어느 지점 근무표에 반영됨"이 없음 | `app/(employer)/my-postings/[id]/` 에 venue·지점·근무표 문자열 0건 |
| 같은 화면 안 두 '공고 열기' 진입점이 다른 프리필(패널=부족수, 시트=항상 1명) | `VenueDayPanel.tsx:278-281` vs `AddSlotSheet.tsx:321-328` + `mappers.ts:501` |

**(c) 끊긴 걸 잇는 최소 작업**
1. `useJobManagement.ts` 의 update/delete/close/reopen/bulk `onSuccess`에 `queryClient.invalidateQueries({ queryKey: queryKeys.weeklyGrid.all })` **5줄 추가** (create:131과 동일).
2. `20260719100000` required CTE WHERE에 `AND jp.status NOT IN ('closed','cancelled','expired','rejected','draft','pending')` **1줄** (반환 타입 불변 → `CREATE OR REPLACE` 멱등).
3. `GridDayCell`에 `manualTarget`/`derivedRequired` **분리 전달** → 입력칸은 manual만 바인딩, 부족 계산만 max 유지, "공고 5석이 있어 5명 아래로 못 내려가요" 인라인 안내.
4. `get_venue_grid_summary`에 `open_job_count`(열린 공고 수) 컬럼 추가 → 뱃지 종류 `recruiting` 신설, 기존 `job`은 라벨을 '공고배치'로 정정.
5. `my-postings/[id]/index.tsx` 상단에 '{지점명} 근무표에 반영됨' 배지 + 미연결 시 '지점 연결하기' CTA, `edit.tsx`에 `VenueSelectChips` 배선(`serialization.ts:333-336`이 이미 venueId 보존).
6. `AddSlotSheet.handleOpenPosting`에 `count` 전달 — 두 진입점이 `buildGridPostingParams(venueId, date, shortage)` 공용 헬퍼를 쓰게.

### 4-B. 팀(workspace) ↔ 근무표

**(a) 이어져 있는 것**
- 서버 인가는 견고: 읽기 2종·쓰기 3종 모두 SECDEF + `search_path` 고정 + `auth.uid()` NULL 거부 + `is_workspace_member` fail-closed, 컨테이너 행은 RESTRICTIVE 정책으로 직접 UPDATE 차단.
- 안전망 2겹(워크스페이스 자동생성 + 지점 자동생성)이 "0개 → 데드엔드"는 확실히 막음 — `weekly-grid.tsx:84-88, 108-113`.
- 팀이 1개면 팀 칩 줄을 숨겨 "1가게 사장에게 팀을 감춤" — `VenueSelector.tsx:85`.

**(b) 끊긴 것**

| 끊김 | 근거 |
|---|---|
| 팀 보관 → 근무표 소실 + 새 팀 자동 생성으로 은폐 (B7) | 위 |
| 지점 이름 변경·삭제 부재 (B4) | 위 |
| **팀 화면에 지점이 하나도 안 보임** → 2계층 구조를 한 화면에서 이해할 수 없고, 그래서 B7 사고를 예측할 수 없음 | `workspace/index.tsx` 에 venue·지점·근무표 0건 |
| **근무표에서 팀 관리·멤버 초대로 가는 길 없음.** 팀 전환 UI도 화면마다 다름(근무표=가로 칩 / 내 공고=드롭다운) | `weekly-grid.tsx` 에 `/(employer)/workspace` push 없음(`fallbackHref`는 뒤로가기용) / `VenueSelector.tsx:85-104` vs `WorkspaceSwitcher.tsx:75-104` |
| **편집자 권한 고지 불일치** — 고지는 '공고', 실제는 급여 열람 + 단가 변경. 클라 권한 분기 0건 | `invite.tsx:143-144`, `invitations.tsx:93-95` vs `20260723100000:64-71`, `20260717093000:314-321` / weeklyGrid·venue-settlements 프로덕션 `isOwner` 0건 |
| **남의 팀 칩을 훑기만 해도 그 팀에 지점이 자동 생성됨**(owner_id=방문자) | `useEnsureDefaultVenue.ts` 에 소유 판정 없음 / `baseline:2954-2976` |
| 근무표 전 경로 realtime 0건 → 다중 운영자 중복 배치 | 위 2-B ④ |
| 팀 자동 생성 실패 시 진짜 원인(WORKSPACE_CAP_REACHED / PERMISSION_DENIED)을 숨기고 "잠시 후 다시 시도"만 반복 | `weekly-grid.tsx:225-232` (mutation error 미수용) vs `baseline:1667-1677` |

**(c) 끊긴 걸 잇는 최소 작업**
1. `archive_workspace` 반환값에 `container_count`를 실어 보내고, 보관 확인 문구에 "지점 N곳의 근무표도 함께 숨겨집니다" 명시.
2. `weekly-grid.tsx:84-88` 의 자동 생성 게이트를 `workspaces.length === 0 && archived.length === 0`으로 좁히고, 보관 팀이 있으면 '보관함에서 복원' EmptyState.
3. `rename_venue_container` / `archive_venue_container` SECDEF RPC 신설(인가 관용구는 `set_venue_role_salary` 복제) + `VenueSettingsSheet` 상단에 이름 편집 행.
4. `useEnsureDefaultVenue`에 `isOwner` 입력 + `if (!isOwner) return;` 가드.
5. 초대 문구를 실제 권한과 일치시키고(**S, 즉시**), 급여 열람·단가 변경을 owner 전용으로 좁힐지 결정(**M, 서버+클라+pgTAP 동시**).
6. `workspace/index.tsx` 에 '지점' 섹션 추가(계층을 처음으로 눈에 보이게) + 근무표 헤더 오버플로 메뉴에 '팀 관리'.

### 4-C. 구인자 ↔ 구직자

**(a) 이어져 있는 것**
- **추가**는 통보됨: `work_log_notify_insert` → "'강남점' 근무가 2026-07-30 (18:00)에 배정되었습니다" (`baseline:12499`, 본문 `:5361-5381`).
- 스태프 일정 화면 자체는 완성도 높음(캘린더/리스트 이중 뷰, 월 통계, 상태 필터, 3탭 상세, 부분실패 경고).
- 지점 단가표가 스태프 급여 표시에 주입되는 경로는 살아 있음(`get_my_venue_role_salaries` → `createScheduleContainerContext`).

**(b) 끊긴 것 — 이 축이 가장 심하다**

| 방향 | 끊김 | 근거 |
|---|---|---|
| 구인자→구직자 | **빼기 무통보**(하드 DELETE) | `20260718000000:375` |
| 구인자→구직자 | **시간·역할 변경 무통보** | `WorkLogRepositoryVenue.ts:102-137` |
| 구인자→구직자 | **근무 이름이 '이벤트', 장소 공란, 연락처 섹션 소실** | `scheduleService.ts:131, 562` |
| 구인자→구직자 | 구인자 **내부용 '배치 메모'가 스태프 상세에 그대로 노출**. 같은 필드가 지원 경로에선 스태프 본인 글이라 라벨이 '메모'로 겹침. 고지 0건 | `EditSlotSheet.tsx:391-399` → `WorkLogRepositoryVenue.ts:127` → `ScheduleConverter.ts:147` → `InfoTab.tsx:383-389` vs `ScheduleConverter.ts:211` |
| 구인자→구직자 | 노쇼가 스태프에겐 '취소된 일정'으로만 보임(사유·이의제기 없음) | `StatusMapper.ts:43-45` → `ScheduleCard.tsx:267-273` |
| 구직자→구인자 | **취소·거절 경로 0** (B1) | 위 |
| 구직자→구인자 | **QR 출근 불가한데 버튼은 노출** (B6) | 위 |
| 양방향 | 스태프 화면의 `realtime: true`가 work_logs에 대해선 **1회 fetch + noop unsubscribe** — 실제 채널 없음(포커스 복귀 시 5분 staleTime 기준 자동 재조회는 됨) | `WorkLogRepository.ts:508-518` vs `:532 subscribeById` |
| 양방향 | 배정 알림 딥링크에 date 미탑재 → 다른 달이면 오늘 화면에 착지(알림 본문에 날짜는 있어 월만 넘기면 됨) | `baseline:5382` / `NotificationRouteMap.ts:54` |

**(c) 끊긴 걸 잇는 최소 작업**
1. **`remove_direct_staff`를 하드 DELETE → `status='cancelled'` 소프트 취소로 전환.** 기존 `notify_on_work_log_update` Case1이 그대로 발화하고, 스태프 화면에 '취소됨' 카드가 남아 근거가 보존되며, 되돌리기도 status 복원으로 가능해진다. `add_direct_staff` 중복가드가 이미 `cancelled`를 제외(`20260717093000:130-137`)해 부작용이 적다. **(단일 수정으로 3개 결함 동시 해소 — 최고 ROI)**
2. `updateSlot`을 `update_venue_slot` SECDEF RPC로 승격: `edited_by := auth.uid()` 서버 스탬프 + time_slot/role 변경 시 `modification_history` append(→ 기존 알림 트리거 발화) + role 변경 시 `custom_role` 정리(DB `_posting_role_key`가 custom_role 우선이라 중복가드가 어긋남) + `checked_in/checked_out/completed/payroll completed` 가드.
3. `get_my_venue_role_salaries` RETURNS TABLE에 `venue_title`(+`location`, `contact_phone`, `owner_id`) 추가 → `createScheduleContainerContext(roleSalaries, title, …)` 두 호출부에 전달.
4. `request_direct_assignment_release(p_work_log_id, p_reason)` RPC 신설 + `ScheduleDetailModal.tsx:444` 를 `applicationId ? 취소요청 : 해제요청` 분기로 교체. 근무표 `ConfirmedStaffCard`에 '해제 요청' 뱃지.
5. `app/(employer)/venue-qr.tsx?venueId=` 컨테이너 전용 QR 화면(렌더에 필요한 건 `buildVenueQRString(venueId)` + 지점명뿐). 그 전까지는 `WorkTab.tsx:89` 를 컨테이너 판정으로 게이트해 '사장님이 출퇴근을 기록해요' 안내로 대체.
6. `EditSlotSheet` 메모 라벨을 '스태프에게 보이는 안내'로 정직화 + `InfoTab` 섹션 제목을 소스별 분기.
7. `WorkLogRepository.subscribeByStaffId`를 `subscribeById` 패턴으로 실제 구독 구현(work_logs가 `supabase_realtime` publication에 있는지 실측 선행).

---

## 5. 우선순위 작업 목록

> 형식: **[제목]** / 근거 / 사용자 이득 / 작업량 / 의존관계

### P0 — 플래그를 켜기 **전에** 반드시 닫아야 할 것 (데이터 오염·거짓 통보·거짓 표시)

| # | 제목 | 근거 file:line | 사용자 이득 | 량 | 의존 |
|---|---|---|---|---|---|
| **P0-1** | 편집 시트가 시간 미정 슬롯을 18:00–02:00으로 덮어쓰는 것 차단 | `EditSlotSheet.tsx:57, 88-90, 152-163`; `WorkLogRepositoryVenue.ts:111-113` | 색상만 고쳤는데 근무 8시간·정산액이 조작되는 사고가 사라짐 | **S** | 없음 (최우선) |
| **P0-2** | `remove_direct_staff` 하드 DELETE → 소프트 취소 전환 (취소 알림 자동 발화 + 이력 보존 + 되돌리기 기반) | `20260718000000:375`; 트리거 `baseline:12499/12506/12513`에 DELETE 없음 | 스태프가 뺀 근무를 알게 되어 헛걸음이 없어짐 | **M** | 없음. `filled_positions` 회계 분기 회귀 pgTAP 필수 |
| **P0-3** | `update_venue_slot` SECDEF RPC 신설 — `edited_by` 서버 스탬프 + `modification_history` append(→ 시간·역할 변경 알림) + custom_role 정리 + 확정 상태 가드 | `WorkLogRepositoryVenue.ts:102-137` vs `baseline:5546-5552`; 정본 `ConfirmedStaffRepository.ts:278-322` | 시간이 바뀐 걸 스태프가 알게 됨(2시간 손해 제거) + 감사 이력 확보 | **M** | P0-2와 같은 마이그레이션 배치 권장 |
| **P0-4** | 컨테이너 배치의 지점명·장소·연락처를 스태프 화면에 전달 (`get_my_venue_role_salaries` 컬럼 확장 → `createScheduleContainerContext` 인자) | `20260724130000:18-24`(title 없음); `scheduleService.ts:131, 562`; `ScheduleConverter.ts:69` | 알림 문구와 화면 문구가 일치하고, 어느 가게로 갈지 앱에서 확인 가능 | **M** | 없음. P1-1(해제 요청)의 선행 |
| **P0-5** | 월 이동 시 `selectedDate` 동기화 (`isSameMonth ? 오늘 : startOfMonth`) | `weekly-grid.tsx:98, 131-132, 51-66, 317`; `VenueDayPanel.tsx:103-105, 211` | '현재 0명 vs 카드 3명' 모순 제거 + 이전 달에 조용히 저장되는 오기록 제거 | **S** | 없음 |
| **P0-6** | 조회 실패를 '없음'으로 위장하지 않기 — `containersQuery.isError` 분기 + 지점 정산 `isError`/`refetch`/PTR | `weekly-grid.tsx:209-243`(isError 0건); `venue-settlements.tsx:59, 175-194` | 중복 지점 생성 사고 차단 + 금전 화면 신뢰 회복 | **S** | 없음 |
| **P0-7** | `required_count` status 필터 1줄 추가 (마감·취소·만료 배제) | `20260719100000:52-73` | "손쓸 수 없는 빨간불" 제거 → 부족 뱃지 신뢰 회복 | **S** | 없음 (`CREATE OR REPLACE` 멱등) |
| **P0-8** | 필요 인원 manual/derived 분리 — 입력칸은 manual 바인딩, 부족 계산만 max 유지, 인라인 사유 안내 | `buildGridCells.ts:36-37`; `VenueDayPanel.tsx:184-187, 202, 213, 310` | "저장했다는데 숫자가 되돌아감" 데드엔드 제거 | **M** | P0-7 이후(자동값 정확해진 뒤) |
| **P0-9** | 골드 위 흰 전경 → `text-content-onGold` (2.1:1 → 9.5:1) + `bg-warning/10` 무효 클래스 교정 | `AddSlotSheet.tsx:108, 396, 409, 423`; `RoleSalaryField.tsx:101`; `venue-settlements.tsx:126`(warning 팔레트에 DEFAULT 없음, `tailwind.config.js:84-95`) | 선택 상태·경고 배지가 실제로 보임 | **S** | 없음 |
| **P0-10** | 편집자 초대 고지를 실제 권한과 일치시키기(문구만) | `invite.tsx:143-144`; `invitations.tsx:93-95` vs `20260723100000:64-71` | 사장이 급여 권한을 넘긴다는 사실을 알고 초대 | **S** | 없음 (권한 축소는 P1-6) |
| **P0-11** | **플래그 ON 절차 완주** — prod 마이그 실측(`list_migrations`) → OTA → `UPDATE app_config SET value='{"enabled":true}'` + admin 화면에 원격 플래그 토글 신설 | `featureFlags.ts:14`; `20260710000004:34`; `appConfigService.ts`(쓰기 0건) | 기능이 비로소 존재하게 됨 | **S**(토글 화면은 M) | **P0-1~P0-10 전부 완료 후** |

**P0 실행 순서**: P0-1 → (P0-2 + P0-3 한 마이그레이션 배치) → P0-4 → P0-5·P0-6·P0-9(병렬, 화면 3파일) → P0-7 → P0-8 → P0-10 → **게이트: 실기기 QA(추가/빼기/시간변경 3경로에서 스태프 단말 알림 실수신 확인)** → P0-11.

### P1 — ON 직후 1~2주 (운영 도구로 성립시키기)

| # | 제목 | 근거 file:line | 사용자 이득 | 량 | 의존 |
|---|---|---|---|---|---|
| **P1-1** | 직접배치 해제 요청 RPC + 스태프 UI 분기 (`applicationId ? 취소요청 : 해제요청`) | `ScheduleDetailModal.tsx:425-428, 444-447`; `20260718000000:306` | 스태프가 앱 안에서 사정을 알릴 수 있음 → 노쇼·평판 손상 방지 | **L** | P0-2(소프트 취소), P0-4(연락처) |
| **P1-2** | 반복 배치 — `AddSlotSheet`에 '이 배치를 반복'(요일 칩 + 종료일) → `assignments` 배열을 여러 날짜로 확장 | `addSlotPayload.ts:115` `assignments: [assignment]`; RPC는 이미 `jsonb_array_elements` 루프(`20260718000000:196, 282`) | 홀덤펍 한 달 세팅 108탭 → 10탭대. **서버 변경 0** | **M** | 없음 (P0 이후) |
| **P1-3** | 직접 배치 인원 지급 확정 배선 (`venue-settlements`에 mutation + 캐시 무효화 + 컨테이너 work_log 권한 pgTAP) | `venue-settlements.tsx:66-68`; `settlementMutation.ts`(workLogId 단위라 그대로 사용 가능) | 근무표로 시작한 운영이 정산까지 끝남 | **L** | P0-3(상태 가드) |
| **P1-4** | 공고 라이프사이클 → 근무표 캐시 무효화 5줄 + 근무표 화면 새로고침 범위 확장(confirmedStaff/settlement 포함) | `useJobManagement.ts` update/delete/close/reopen/bulk; `weekly-grid.tsx:139-146` | 화면이 거짓말하는 창이 사라짐 | **S** | 없음 |
| **P1-5** | 근무표 realtime — `useVenueDaySlots`/`useGridSummary`에 work_logs 구독(콜백은 invalidate만) + `AddSlotSheet`에 `detectSlotConflicts` 배선 + 서버 시간겹침 가드 | weeklyGrid `createRealtimeSubscription` 0건; `EditSlotSheet.tsx:107`만 충돌 검사; 중복가드 `20260717093000:130-137` | 대회사 동시 편성에서 이중 배치·중복 공고 제거 | **M** | 없음 |
| **P1-6** | 급여 열람·단가 변경 owner 전용화 (서버 인가 + 클라 게이트 + pgTAP 편집자 42501) | `weekly-grid.tsx:168-188`; `venue-settlements.tsx:90-105`; `20260723100000:64-71` | 사장이 의도한 권한 경계가 실제로 성립 | **M** | P0-10(고지) 이후 |
| **P1-7** | 지점 이름 변경·보관 RPC + 시트 배선 / `useEnsureDefaultVenue`에 `isOwner` 가드 / 자동 생성 시 이름 확정 온보딩 | `VenueSettingsSheet.tsx:6`; rename·delete grep 0건; `baseline:2954-2976` | '홍길동 팀' 지점과 중복 지점 영구 잔존 해소 | **M** | 없음 |
| **P1-8** | 팀 보관 안전망 — 확인 문구에 지점 수 명시 + 근무표에서 보관 팀 감지 시 자동 생성 대신 '복원' 유도 | `workspace/index.tsx:66-67`; `baseline:971-973`; `weekly-grid.tsx:84-88` | 근무표가 통째로 사라지는 사고 차단 | **M** | 없음 |
| **P1-9** | 다지점 공고 venue 연결 복구 — `create.tsx` 프리셀렉트 + '연결 안 함' 명시 선택 + `edit.tsx`에 `VenueSelectChips` | `jobManagementService.ts:113-114`; `create.tsx:239`; `edit.tsx`(venue 0건); `serialization.ts:333-336` | 공고가 근무표에서 사라지는 사고와 복구 불가 상태 해소 | **M** | 없음 |
| **P1-10** | 지원자 신호를 근무표에 노출 — `get_venue_grid_summary`에 `pendingApplicants`/`open_job_count` + 4번째 뱃지 + '지원자 N명 확인' 딥링크 | `VenueDayPanel.tsx:108, 117-122`(applications 0건); `20260719100000:45` | 부족→공고→확정 깔때기가 닫힘, 중복 모집 방지 | **M** | P0-7, P0-8 |
| **P1-11** | '오늘' 버튼 + 날짜 탭 시 패널로 스크롤/페이드 + 햅틱 재배치(날짜 탭 제거 → 추가·빼기 성공에 부여) | `weekly-grid.tsx:262-282`(오늘 0건) vs `schedule.tsx:116-128`; `CalendarCell.tsx:71` | 매일 여는 화면의 복귀 비용 O(n)→O(1), 조작 성공 신호 | **S** | P0-5 (같은 헬퍼 공유) |
| **P1-12** | 메모 라벨 정직화(구인자=‘스태프에게 보이는 안내’ / 스태프=소스별 섹션 제목) + 노쇼 사유 표시 | `EditSlotSheet.tsx:391-399`; `InfoTab.tsx:383-389`; `StatusMapper.ts:43-45` | 기대 불일치·평판 불이익의 침묵 제거 | **S** | 없음 |

**P1 실행 순서**: P1-4·P1-11·P1-12(S, 하루) → P1-2(반복) → P1-5(realtime) → P1-9 → P1-7·P1-8(팀/지점 안전망) → P1-1 → P1-6 → P1-10 → P1-3.

### P2 — 구조 개선 (P1 이후, 별도 설계)

| # | 제목 | 근거 | 이득 | 량 | 의존 |
|---|---|---|---|---|---|
| P2-1 | 역할별 목표 인원 (`softTargets`를 `number \| Record<roleKey, number>` 관대 스키마로 + 역할별 부족 칩 + CTA 역할 전달) | `softTargets.ts:16, 30-35, 60-62`; `useSetVenueSoftTarget.ts:14-18`; 수신부는 이미 딜러 N석 프리필 `mappers.ts:504-506` | 대회사의 "딜러 부족 5 / 서빙 부족 2" 판독 | L | P0-8 |
| P2-2 | 1차 뷰에 '주(7일) × 스태프' 매트릭스 추가(월 뷰는 토글 뒤 보존), 빈 셀 탭 = 1탭 배치 | `weekly-grid.tsx:285-294`; `gridSlotState.ts:55-59`(날짜당 숫자 1개); 주 단위 뷰 코드 0건 | 두 타깃의 실제 질문("오늘 누가 오나"/"충원 곡선")에 1차 뷰가 답함. 반복·복사의 자연스러운 그릇 | L | P1-2, P2-1 |
| P2-3 | 고정(상시) 공고 ↔ 근무표 연결 설계 (요일 정보 부재 → 자동 반영 불가, 사용자 선택 UI 선행) | `draftAdapter.ts:351`; `20260719100000:63`; `PostingFixedSchedule`에 날짜축 없음 | 1차 타깃의 주 경로가 근무표에 보임 | L | P2-1 |
| P2-4 | 성능 — `useConfirmedStaff(venueId, { date })`로 스코프 축소 + `getByIdBatch`로 N+1 제거 + `getByJobPostingId`에 상한/경고 | `VenueDayPanel.tsx:117-122`; `ConfirmedStaffRepository.ts:238-249`(date/limit 없음); `confirmedStaffService.ts:68-72`; `UserRepository.ts:101` | 오래 운영한 지점의 첫 진입 지연·조용한 잘림 제거 | M | 없음 |
| P2-5 | 낙관적 업데이트 + '되돌리기' 토스트 | `useUpdateSlot.ts:23-26`, `useDeleteSlot.ts:18-22`(onMutate 없음) | 이중 추가·실수 삭제 복구 | M | P0-2 |
| P2-6 | 공용 `MonthNavigator` 추출(3종 통일) + 로딩 표현 스켈레톤 통일 + 라이트모드 아이콘 대비 3:1 + PTR_REFRESH_PROPS 적용 | `weekly-grid.tsx:262-282` / `schedule.tsx:93-157` / `venue-settlements.tsx:145-167`; `VenueDayDetail.tsx:102-108`; `constants/colors.ts:22-23`; `constants/ptr.ts:32-36` | 화면 간 학습 전이, 저조도/고조도 가독 | M | 없음 |
| P2-7 | 색상 칩 정리(개발 토큰명 → 사장 어휘, 다크에서 구분 불가 4개 제거, 44px, '색 없음') + 스와치 a11y 라벨 | `slotEdit.ts:55-71`; `EditSlotSheet.tsx:378-384`; `ConfirmedStaffCard.tsx:149-152` | 색 태그가 실제로 쓰이는 기능이 됨 | M | 없음 |
| P2-8 | 용어 통일(인원/근무/추가·빼기) + 토스트 어투 해요체 통일 + '확정 스태프 풀' 카피 교체 | `VenueDayPanel.tsx:224, 241`; `gridBadgeMeta.ts:35`; `useConfirmedStaff.ts:300`; `AddSlotSheet.tsx:466-468` | 한 작업에 4개 명사·2개 말투를 만나지 않음 | M | 없음 |
| P2-9 | 근무표 e2e page object + 스모크(진입→월 이동→날짜 탭→슬롯 추가) | `e2e/` 에 weekly 매치 0건 | 이후 리네이밍·리팩터 회귀 게이트 | M | P0-11 |
| P2-10 | anon EXECUTE 명시 회수 3종 + pgTAP 어서션(SECDEF 함수에 anon EXECUTE 없음) | `baseline:14699, 15652, 14663` vs 규약 `20260718100000` | 반환 타입 변경 시 조용히 열리는 것 방지 | S | P1-10(RPC 변경 시 동반) |
| P2-11 | 읽기/쓰기 인가 게이트를 `can_manage_venue()` 단일 헬퍼로 수렴(현재는 앱에서 재현 불가한 API 표면 비대칭) | 읽기 `20260719100000:29` vs 쓰기 `20260717093000:314-320` | 다음 RPC 추가 때 다시 갈라지지 않음 | M | P1-6 결정 후 |
| P2-12 | `app/(app)/(tabs)/schedule.tsx` 894줄 분해(5파일) + 미사용 `ScheduleDetailSheet`/`WorkLogList` 제거 | 프로젝트 규칙 800줄 초과; import 0건 | 이후 수정 리스크 감소, knip 래칫 개선 | M | 없음 |

---

## 6. "주간" 표현 제거 계획

### 6-0. 먼저: 실측 인벤토리 (이번 세션 재측정)

| 항목 | 측정값 | 명령 |
|---|---|---|
| 파일·폴더명에 `weekly` | **19개** (폴더 5 + 파일 14, pgTAP 5 포함) | `find src app e2e supabase/tests -iname "*weekly*"` |
| `weekly` 문자열 포함 파일 | **81개** (테스트 제외 53개) | `grep -rli weekly src app --include=*.ts --include=*.tsx` |
| 한글 `주간` 포함 파일 | **45개** | `grep -rl 주간 src app --include=*.ts --include=*.tsx` |
| `queryKeys.weeklyGrid.*` 소비 지점 | **23곳**(테스트 제외) + `invalidationStrategy.ts` 문자열 12건 | `grep -rn "queryKeys.weeklyGrid" src app` |
| 라우트/딥링크 지점 | **9곳** (`RouteRegistry.ts:43`, `types.ts:37`, `RouteMapper.ts:100`, `deepLinkRouteParser.ts:183-184`, `deepLinkRouteSerializer.ts:77-78`, `employer.tsx:308`, `venue-settlements.tsx:142`, 라우트 파일 자체) | 위 |
| DB 계약 값 | **1개** `app_config.weekly_grid_enabled` (+ 소스 참조 8곳) | `20260710000004:34` |

**결정적 사실: `주간`은 사용자 화면에 단 한 번도 노출되지 않는다.** 45개 파일의 히트는 전부 주석·docstring·logger 메시지이며(예: `AddSlotSheet.tsx:2`, `:300`, `weekly-grid.tsx:2`, `CalendarCell.tsx:43`), 화면 제목은 이미 `StackHeader title="근무표"`(`weekly-grid.tsx:167`)다. → **이 작업은 사용자 가치가 0이고 개발자 인지 부채 정리다. P2 하단이 정확한 위치이고, P0/P1과 절대 섞지 않는다.**

### 6-1. 단계별 실행 순서

| 단계 | 범위 | 위험 | 검증 방법 |
|---|---|---|---|
| **S0. 이름 확정** | 도메인 `workSchedule` / 라우트 `work-schedule` / 플래그 `work_schedule_enabled`. **스태프용 `schedule` 도메인과 접두어로 분리 필수** — `src/domains/schedule/`, `src/components/schedule/`, `app/(app)/(tabs)/schedule.tsx`, `e2e/pages/app/tabs/schedule.page.ts`가 이미 존재 | 이름 충돌 시 리뷰어·신규 합류자가 두 기능을 혼동 | 결정을 `wiki/decisions/`에 기록, PR 설명에 두 도메인의 관점 차이 명시 |
| **S1. 주석·docstring·logger 문구** | 45개 파일의 `주간` → `근무표` | **0** (런타임 무영향) | `grep -rl 주간 src app` = 0건 |
| **S2. 쿼리키** | `queryKeys.weeklyGrid` → `queryKeys.workSchedule` (`queryClient.ts:586-594`) + 소비 23곳 + `invalidationStrategy.ts` 문자열 12건 | **부분 rename 시 캐시 무효화 조용한 회귀.** 특히 도메인 밖인 `useConfirmedStaff.ts:299`, `useJobManagement.ts:131`, `queryClient.ts:732` 누락 위험 | **한 커밋 동시 치환** 후 `grep -rn "weeklyGrid" src app` = 0건 + 관련 훅 jest 스위트 전량 재실행 + 수동: 인원 추가 → 셀 즉시 갱신, 공고 생성 → 셀 갱신 |
| **S3. 폴더·파일·타입** | `domains/weeklyGrid`, `components/weeklyGrid`, `hooks/weeklyGrid`, `services/weeklyGrid`, `repositories/weeklyGrid.ts`, `IWeeklyGridRepository`, `WeeklyGridRepository`, `useWeeklyGridEnabled`, pgTAP 5개 | 배럴 export 누락, `@/` 경로 깨짐 | `npm run quality`(tsc + eslint + prettier) exit 0 + `npm test` 전량 |
| **S4. 라우트** | `app/(employer)/weekly-grid.tsx` → `work-schedule.tsx`, `RouteRegistry.ts:43`, `types.ts:37`, `RouteMapper.ts:100`, serializer `:77-78`, push 2곳 | **과거 발송 알림의 딥링크 파싱 실패.** 현재 이 링크를 생성하는 코드는 레포에 0건이지만 외부 링크는 언제든 올 수 있음 | `deepLinkRouteParser.ts:183` 의 **구 세그먼트 `weekly-grid` 파싱을 최소 1릴리스 하위호환으로 유지**(신규 `work-schedule`와 둘 다 수용). `deepLinkService.test.ts:344-348, 472-481` 회귀 테스트를 구/신 2케이스로 확장 |
| **S5. DB 플래그** | `weekly_grid_enabled` → `work_schedule_enabled` | **최고 위험.** 코드만 바꾸면 원격 조회가 행을 못 찾고 `getWeeklyGridFlagRaw`가 `data?.value ?? null`로 **에러 없이 null 반환**(`appConfigService.ts:41`) → fallback(false)로 떨어져 **로그도 에러도 없이 화면 전체가 사라짐** | **2단계 전환 필수**: ①마이그레이션으로 신규 키 INSERT(현재 값 복제) + 코드가 신규키 우선·구키 폴백 → 배포·실측 확인 → ②다음 릴리스에서 구키 DELETE + 폴백 제거. 검증: 신규 키 UPDATE로 ON/OFF 토글 후 실기기에서 진입 버튼 노출 변화 관찰(정적 파싱 아님) |

### 6-2. 전제 조건

- **S4·S5는 P0-11(플래그 ON) 이후 최소 1릴리스가 지나고, P2-9(e2e 스모크)가 존재할 때만 착수한다.** 지금은 회귀를 잡아줄 자동 테스트가 없다(`e2e/`에 weekly 매치 0건).
- S1~S3은 P1 완료 후 언제든 가능(런타임 계약 무변경).

---

## 7. 하지 말아야 할 것

| 유혹 | 왜 하면 안 되는가 |
|---|---|
| **"주간" 리네이밍을 먼저 한다** | 사용자에게 `주간`은 **한 글자도 노출되지 않는다**(화면 제목은 이미 '근무표'). 45개 파일을 건드려 얻는 사용자 가치는 0인데, 쿼리키 23곳·라우트 9곳·DB 계약 1개를 흔들어 P0 수정의 회귀 표면만 넓힌다. **P2 하단, e2e 스모크 확보 후.** |
| **P0 전에 플래그를 켠다** | 켜는 순간 첫날에 ①시간 미정 슬롯 덮어쓰기(정산 오염) ②빼기 무통보(헛걸음) ③'이벤트' 표시(장소 모름)가 동시에 터진다. 다크런치는 실수가 아니라 방어막이다 — 방어막을 먼저 걷지 마라. |
| **월 캘린더를 버리고 주 매트릭스로 갈아엎는다(P2-2를 지금)** | `densifyMonthCells`·`GridDayCell`·`gridBadgeMeta` SSOT·a11y 라벨은 잘 만들어진 자산이다. 새 뷰는 **토글 뒤 추가**이지 교체가 아니다. 그리고 P0의 데이터 결함이 남은 채로 뷰만 바꾸면 더 많은 거짓 정보를 더 예쁘게 보여주게 된다. |
| **`add_direct_staff`를 다중 스태프 배열로 확장한다** | 시그니처가 `(p_job_posting_id, p_staff_id, p_assignments)`로 **스태프는 스칼라**다(`20260718000000:196`). 정원가드·중복가드·`filled_positions` 회계가 전부 그 전제 위에 서 있어, 배열화는 seat-basis 전환(`20260718000000`)을 되돌리는 규모의 작업이다. **지금 공짜로 얻을 수 있는 건 "한 사람 × 여러 날"뿐**(P1-2). 30명 배치는 RPC 30회가 정상이며, 줄여야 할 건 호출 수가 아니라 **탭 수**(시트 유지 '추가하고 계속' 2탭 사이클)다. |
| **역할별 목표를 P0에서 도입한다** | `softTargets`는 `Record<string, number>` 스칼라이고 셀 뱃지·부족 계산·CTA·`buildGridCells` max 병합이 전부 그 위에 있다(`softTargets.ts:16, 30-35, 60-62`). P0-8(manual/derived 분리)이 먼저 서지 않으면 두 개의 미완성 축이 얽힌다. 그리고 **"서빙 지원자만 12명 붙는다"는 시나리오는 성립하지 않는다** — 부족 CTA는 이미 딜러 N석으로 프리필된다(`mappers.ts:504-506`). 실제 갭은 "판독 불가"이지 "오모집"이 아니다. |
| **`updateSlot` 감사 구멍을 "권한 있는 운영자만 쓰니 괜찮다"로 덮는다** | `edited_by`가 클라이언트 값이라는 것은 같은 도메인의 명시적 계약(`confirmedStaffService.ts:122` "클라이언트가 넘긴 값은 무시(위조 방지)")과 정반대다. 다만 **표시·단가는 어긋나지 않는다**(role='other'일 때만 customRole 사용). 실제 위험은 DB `_posting_role_key`가 custom_role을 우선해 중복·정원 가드가 다른 키로 판정되는 것 — 과장도 축소도 말고 **P0-3 RPC 승격 한 번에 같이 닫아라.** |
| **realtime을 "전 화면 실시간"으로 설계한다** | `work_logs`에는 venue 단위 필터 컬럼이 없어 스팬 공고까지 덮으려면 `venue_id` 미러가 필요하다. 1단계는 **컨테이너 직속 배치만 구독 + 요약은 daySlots 무효화에 편승 + staleTime 5분→30초**로 충분하다. 전면 설계를 기다리다 지금의 5분 창을 방치하지 마라. |
| **에러 상태·빈 상태를 "나중에 카피만 고치면 되는 것"으로 미룬다** | C5·C6는 카피 문제가 아니라 **오진**이다. "지점이 없어요"를 믿고 지점을 새로 만들면 삭제 불가능한 중복 지점이 생기고(B4), "정산할 근무가 없어요"를 믿으면 돈 계산을 잘못한다. 각각 5줄이다. |
| **직접배치 스태프의 취소 경로를 "일방 배치가 설계 의도"라며 덮는다** | 일방 배치가 의도인 것은 맞다(설계문서 전문에 '거절/수락' 0건). 하지만 **안전장치가 함께 설계되지 않았다**. 취소도, 전화도, 메시지도 없이 남는 액션이 '신고'뿐인 상태는 의도가 아니라 누락이다. |