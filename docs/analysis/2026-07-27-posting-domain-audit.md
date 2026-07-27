# 공고 도메인 전면 감사 — UX·플로우·기능 완성도 (2026-07-27)

> 범위: 공고와 연결된 전 기능 — 작성(주문서)·수정·운영 허브·지원자 관리·스태프/역할 변경·취소 요청·정산/시간수정/정산조건·QR·출퇴근·주간 근무표·스태프측 플로우
> 방법: 영역별 심층 리뷰 10 → 영역별 적대 검증 10 → 종합 1. 총 32 에이전트 · 서브에이전트 토큰 약 516만 · 도구 호출 1157회
> 기준 커밋: `f8c3acb11`. 이후 master 는 `254592ada` 로 이동했으며 공고 도메인과 겹치는 변경은 `serialization.ts` 1건뿐이라 아래 file:line 은 대부분 유효하다.

## 0. 이 감사의 한계 — 먼저 읽을 것

- **적대 검증이 189건 중 0건만 반박했다.** 확정 132 · 강등 56 · 격상 1 · 반박 0. 독립 검증자 10명이 한 건도 반박하지 못한 것은 이례적이며, 반대 의사를 REFUTED 대신 심각도 강등으로 표현했을 개연성이 높다. **확정(CONFIRMED)은 “증명됨”이 아니라 “근거가 인용된 유력 가설”로 읽어야 한다** — 구현 착수 전 건별 재확인이 필수다.
- 검증 깊이는 심각도에 비례 배분했다: CRITICAL/HIGH 는 호출부·서버 가드까지 직독(deep 75건), MEDIUM/LOW 는 주장 라인 확인(spot 114건).
- 1차 실행에서 Fable 5 한도로 검증 10 + 종합 1이 전멸했다. 폴백 사다리(fable→opus)로 재실행 — **판정 품질은 fable 이 아니라 opus 수준이다.**
- 실기기 터치·햅틱·성능은 코드 정독으로 판정 불가라 §5 보류로 분리했다.

## 1. 규모

| 구분 | 수 |
|---|---|
| 총 결함 | 189 |
| CRITICAL | 7 |
| HIGH | 37 |
| MEDIUM | 104 |
| LOW | 41 |
| 검증자가 추가 발견 | 30 |

## 2. 한 줄 결론

**189건은 10개 영역에 흩어진 개별 버그가 아니라 8개 구조적 패턴의 반복이다 — "돈 숫자가 화면마다 다르다"·"제출 결과를 안 보고 성공을 선언한다"·"파괴적 액션에 되돌리기 자산이 있는데 배선이 안 됐다" 이 셋이 전체의 절반을 설명한다. W1은 개별 수정 12건이 아니라 공통 관문 12개를 세우는 작업이다.**

## 3. 메타 패턴 — 영역을 가로지르는 반복 구조 8개

### 1. 금액 진실원(동결값) 계약이 SSOT 헬퍼로 문서화돼 있는데 소비처 5곳이 전부 우회한다

**근거**: src/utils/settlementGrouping.ts:44-58 이 `shouldUseFrozenPayrollAmount` 를 정의하며 주석으로 'Number.isFinite 로 판정 — 동결값 0도 존중, amount > 0 가드로 판정하면 어긋난다'고 명시적으로 금지했다. 그런데 `grep "payrollAmount && .*payrollAmount > 0"` 실측 결과 위반이 5곳: ScheduleDetailSheet.tsx:205, InfoTab.tsx:370, SettlementTab.tsx:348, WorkLogList.tsx:173, 그리고 감사가 놓친 scheduleService.ts:262(서비스 계층). 헬퍼를 쓰는 곳은 ScheduleCard.tsx:73 단 하나. 여기에 SettlementCard.tsx:70-73(무조건 재계산)과 venue-settlements.tsx:111-113(서비스가 계산한 canonical 을 버리고 salaryInfo 만 전달)까지 더하면 같은 근무 1건의 금액이 최대 4가지로 갈린다.

**함의**: 결함을 화면별로 고치면 6번째 위반이 다음 PR에서 다시 생긴다. 헬퍼를 유일 관문으로 만들고 `payrollAmount.*> 0` 패턴을 ESLint no-restricted-syntax 로 기계 차단해야 재발이 멈춘다.

### 2. 뮤테이션을 fire-and-forget 으로 쏘고 결과를 보기 전에 모달을 닫거나 성공을 선언한다

**근거**: APPL-7(확정/거절 모달이 mutate 직후 동기 close + setInputValue('')), CANCEL-14(거절 모달 동일, 그래서 :263 '처리 중...' 과 :277 isLoading 이 도달 불가한 죽은 코드), STAFF-4(스태프관리)(changeRole 이 mutate 라 throw 하지 않는데 try/catch 로 감싸고 성공 토스트를 먼저 발행 — catch 가 죽은 코드), ORDER-3(허브)(onSettled 에서 필터 전환 — 실패에도 실행), CANCEL-15(전역 isPending 을 모든 카드에 브로드캐스트). mutateAsync 는 hooks/applicant/index.ts:217·226·239 에 **이미 노출돼 있다**.

**함의**: '제출 중 잠금 → await → 성공에서만 닫기/이동' 공용 훅 1개로 5건이 동시에 닫힌다. 개별 수정하면 같은 실수가 다음 모달에서 반복된다.

### 3. 되돌리기(Undo)·확인 다이얼로그의 완성된 레퍼런스 구현이 코드베이스 안에 있는데 파괴적 액션 8곳이 그것을 안 쓴다

**근거**: OrderSheetScreen.tsx:442-480 handleDeleteGroup 은 깊은 복사 스냅샷 + 5초 Undo 토스트 + 대기 예약 무효화(clearPendingSwap)까지 갖춘 교과서 구현이고, toastStore.ts:23-26 에 `action:{label,onPress}` 필드가 정식으로 있으며 confirmAction 유틸도 src/utils/confirmAction.ts:20 에 있다. 그런데 같은 화면의 프리셋 적용(:568-596 form.reset 즉시)·타입 전환(:622-667 신호 0건)·시트 백드롭(SheetModal.tsx:360-367)·ScheduleSlotsSheet removeSlot(:109-117)·DatePickerModal handleClose(:152-155)는 확인도 Undo 도 없다. 화면 밖도 같다 — APPL-2, EDIT-11, GRID-18, SETTLE-3.

**함의**: 자산 부재가 아니라 배선 누락이다. `useUndoableAction` 헬퍼 + SheetModal `dismissGuard` prop 두 개면 신규 코드 거의 없이 8곳이 덮인다.

### 4. 클라이언트 직접 UPDATE 가 영향 행 수를 검사하지 않아 RLS·경합으로 0행이 갱신돼도 성공으로 보고된다

**근거**: JobPostingRepository.ts:665-668(`.eq('id',…)` 만, `.select()`/count 없음 → 671 이 DB 재조회 없이 로컬 validated 반환), ApplicationRepositoryTransactions.ts:393-404(거절, 조건부 UPDATE 인데 무검증 → useCancellationManagement.ts:54-57 이 성공 토스트), ApplicationRepository.ts:408-417(요청 제출 동일). PostgREST 는 RLS 로 0행이 갱신돼도 error 를 주지 않는다. JobPostingRepositoryHelpers.ts:107-110 주석이 바로 이 클래스를 문서화해 두고 admin 분기만 방어한다 — 방어 공백이 인지된 채 남아 있다.

**함의**: CLAUDE.md '다중 쓰기=RPC 필수' 규약 위반(CANCEL-4·STAFF-7(스태프관리)·SETTLE-10)과 같은 뿌리다. 리포지토리 공통 `assertAffectedRows` 헬퍼를 세우고 RPC 이관은 W3 로 분리하는 게 비용 대비 효과가 크다.

### 5. realtime 모드에서 훅의 error·refetch·낙관갱신이 통째로 죽는데 화면은 그 계약을 모른다

**근거**: useConfirmedStaff.ts:102 `enabled: !!jobPostingId && !realtime` + :375-376 `error: error ? toError(error) : null`(realtime 이면 항상 null) + :310-314 `if (!realtime) refetch()`. 결과: STAFF-1(스태프관리)은 구독 실패 시 ErrorState(:309-313)가 도달 불가한 죽은 코드가 되어 무한 스피너(CRITICAL), STAFF-11(스태프관리)은 새로고침 버튼과 pull-to-refresh 가 완전 no-op. 같은 계약이 useApplicantsByJobPosting 에도 있어 APPL-5(낙관갱신 3곳이 죽은 코드)와 ORDER-9(허브)(refetch throw 가 미처리 Promise 로 소실)를 만든다.

**함의**: 화면 4곳을 고칠 게 아니라 훅의 realtime 계약 자체를 고쳐야 한다 — 구독 실패를 error 로 승격하고 refresh 를 realtime 에서도 동작시키면 CRITICAL 1건 + HIGH 1건 + MEDIUM 2건이 한 번에 닫힌다.

### 6. 서버 가드가 블랙리스트·조건부여서 '조합이 매칭되지 않으면 통과'하는 fail-open 이 반복된다

**근거**: confirm_application(baseline:1349) `IF v_capacity > 0 AND v_existing + v_rec.requested > v_capacity` — 지원서가 가리키는 (날짜·슬롯·역할)이 스케줄에서 사라져 v_capacity=0 이면 정원 가드가 통째로 스킵된다(EDIT-9 의 고아 지원서가 확정까지 통과). add_direct_staff 도 같은 구조라 STAFF-9(스태프관리)의 무관 날짜·STAFF-15(스태프관리)의 자유 텍스트 '야간' 이 슬롯키와 안 맞아 가드를 우회한다. QR 출근 RPC(20260711030100:78)는 `IN ('checked_in','checked_out')` 블랙리스트라 no_show/cancelled/completed 가 통과해 노쇼를 스태프가 되돌릴 수 있다(RPC-1, 금전 영향).

**함의**: 가드를 '매칭 슬롯이 없으면 거부'하는 화이트리스트로 뒤집는 마이그레이션 하나가 4건을 덮는다. 클라 검증 추가로는 못 막는다(RPC 가 authenticated 에 GRANT 돼 있다).

### 7. 화면 카피가 코드와 정면으로 어긋나는 거짓 고지가 7건 — 그중 일부는 진짜 불일치를 정상처럼 보이게 가린다

**근거**: my-postings/[id]/index.tsx:544 **및 :602**(고정 분기 중복) '공고 내용과 상태를 수정합니다'인데 edit 화면에 status 축이 없다(orderRowMeta.ts:12-25 OrderRowKey 유니온에 status 부재). RoleChangeModal 이 '스태프에게 알림이 발송됩니다'라고 하는데 notify_on_work_log_update(baseline:5489-5668) 4개 분기 어디에도 role 비교가 없다(STAFF-6). SettlementSummaryCard.tsx:102-106 '스태프 확정 금액은 기본급 기준'인데 payroll_amount 는 SettlementRepository.ts:738 afterTaxPay(세후)다 — 이 거짓 설명이 SETTLE-5·8 의 진짜 금액 불일치를 '원래 다른 값'으로 정당화해 가린다.

**함의**: 카피 수정은 S 이지만 방치 비용이 크다. 특히 SETTLE-18 은 고쳐야 사용자·개발자 양쪽이 SETTLE-5/8 을 결함으로 인식하기 시작한다. 그리고 :544 만 고치면 고정공고 사용자에겐 그대로 남는다 — 중복 카피 전수 grep 이 필수.

### 8. 고정(fixed) 공고는 확정 이후 운영 수단 전체가 차단되고, 그 사유가 코드 주석에만 있고 화면에는 0글자다

**근거**: 차단 지점 7곳 실재: settlements.tsx:147-157·cancellation-requests.tsx:143-158 ErrorState, qr.tsx:71-73, ApplicantCard.tsx:115-119 `!isFixedMode`, my-postings/[id]/index.tsx:510·525·540·262 `!isFixed &&`, ApplicationRepository.ts:385-389 서버 throw. 근본 원인은 _layout.tsx:30-36 에 기록돼 있다 — 'confirm_application 이 FIXED_SCHEDULE 1행만 INSERT → 되돌리는 코드가 없어 D+1부터 영구 실패, 행 수명 재설계는 별도 PR'. 즉 **의도된 1차 스코프 제외**다.

**함의**: EDIT-3·ORDER-5(허브)·STAFF-10(스태프관리)·CANCEL-9·QR-6·APPL-12·GRID-4 를 개별 결함으로 고치면 안 된다. W1 은 허브에 사유 안내 한 줄만, 실제 해소는 work_logs 행 수명 재설계(W3)로. 다만 홀덤펍 상시 알바가 고정 공고의 주 타깃이라 W3 우선순위는 최상위다.

## 4. 실행 계획

### W1 — 즉시 (데이터·금전·막다른 길 + 압도적 퀵윈)

- **목표**: 지금 사용자의 돈·데이터·작업을 실제로 잃게 만드는 경로를 닫는다. 개별 수정이 아니라 재발을 막는 공통 관문 12개를 세운다. 각 항목 반나절~1.5일.
- **추정**: 약 2주 (1인 기준). CRITICAL 7건 + HIGH 14건 해소.

#### W1-1. [M] 취소 도메인 2대 CRITICAL — 승인한 지원서가 목록에서 증발하고, 사장님의 '확정 해제'는 100% 실패한다

- **결함**: CANCEL-1, CANCEL-2
- **왜**: 둘 다 지금 프로덕션에서 확실히 깨져 있고 사용자가 원인을 알 방법이 없다. ①승인 RPC 가 JSONB 에 snake_case 를 쓰는데 읽기 스키마는 camelCase 를 필수로 요구해 파싱 실패 → rowsToApplications 가 조용히 drop → 양쪽 목록에서 사라짐. ②구인자 화면의 '확정 해제'가 actorType 을 안 넘겨 기본값 'staff_initiates' 로 나가고, RPC 는 applicant_id 대조에서 무조건 unauthorized 를 던진다. ②는 APPL-1(부분 확정 복구)과 APPL-2(Undo 제안)의 전제까지 무너뜨린다.
- **어떻게**: ① 새 마이그레이션에서 `approve_cancellation` 의 `jsonb_build_object('status','approved','reviewed_at',v_now,'reviewed_by',p_actor_id)` 를 `'reviewedAt'`/`'reviewedBy'` 로 교체하고, 같은 마이그레이션에서 기존 오염 row 백필(`WHERE cancellation_request ? 'reviewed_at'` 조건으로 키 rename). ② `useStaffConversion.ts:66` 의 `cancelConfirmation(applicationId, user.uid, reason)` 에 4번째 인자 `'employer_initiates'` 추가 — 훅이 구인자 화면 전용임이 소비처 grep 으로 확정됨. ③ 재발 방어로 `cancellationRequestStoredSchema` 에 snake_case 를 관용하는 preprocess 를 얹어 레거시 row 를 복구 가능하게 한다(백필 실패분 안전망).
- **파일**: `uniqn-mobile/supabase/migrations/20260727100000_fix_cancellation_request_camel_keys.sql` · `uniqn-mobile/src/hooks/applicant/useStaffConversion.ts` · `uniqn-mobile/src/schemas/application.schema.ts` · `uniqn-mobile/src/repositories/supabase/ApplicationRepositoryHelpers.ts`
- **위험**: prod 에 이미 오염된 row 가 몇 건인지 미상 — 백필 UPDATE 전에 `SELECT count(*) FROM applications WHERE cancellation_request ? 'reviewed_at'` 로 규모를 먼저 재고, 마이그레이션은 MCP apply_migration 경유(db push 금지). actorType 변경은 RPC 분기를 바꾸므로 employer_initiates 경로의 알림 INSERT(20260718000000:489-511)가 새로 발화한다 — 의도된 동작인지 확인 필요.
- **완료 증명**: `npx jest src/schemas/__tests__/application.schema.test.ts` — approved 분기 케이스를 추가해 수정 전 RED, 수정 후 GREEN(현재 이 파일은 rejected 만 커버, approved 0건). `npx jest src/repositories/supabase/__tests__/ApplicationRepositoryTransactions.cancel.test.ts` + 신규 useStaffConversion 훅 테스트에서 `p_actor_type: 'employer_initiates'` 단언. `npm run test:db` 로 supabase/tests/cancel_application_employer_initiates.test.sql 을 확장해 승인 후 `cancellation_request ? 'reviewedAt'` 를 pgTAP 로 단언. 로컬 Supabase 에서 승인→지원자 목록에 취소 건이 남는지, 확정 해제 버튼이 성공하는지 육안 확인.

#### W1-2. [M] 보장시간이 수당 배지로는 보이는데 금액 계산에 단 한 줄도 반영되지 않는다

- **결함**: SETTLE-2
- **왜**: 앱이 '수당' 블록 안에서 보장시간을 약속해 놓고 금액은 그대로다. 서버 canonical 계산(SettlementRepository.ts:730-738)도 같은 함수를 쓰므로 DB 에 저장되는 지급액까지 동일하게 누락된다 — 조용히 틀린 숫자가 만들어지고 방어·가드·테스트가 전무하다. 실측으로 `guaranteedHours` 는 입력(WelfareSheet)·스키마·표시(allowanceUtils, SettlementTab)에만 존재하고 src/domains/settlement/ 전체에 0건이다.
- **어떻게**: 제품 결정을 먼저 확정한다 — (A) 최소 지급 보장이면 `calculateBasePay` 에서 `hours = Math.max(actualHours, guaranteedHours)` 를 적용하고 SettlementCalculator·helpers 양쪽 + 서버 canonical 경로가 같은 함수를 통과하는지 확인. (B) 표시 전용이면 WelfareSheet 에서 복지 3종(식사·교통·숙소)과 분리하고 스태프 화면 '수당' 블록 밖으로 빼고 '금액에 반영되지 않음' 을 명시. 어느 쪽이든 계산 함수에 guaranteedHours 를 받는 시그니처를 넣고 미사용이면 명시적으로 무시하는 주석을 남겨 다음 사람이 다시 헷갈리지 않게 한다.
- **파일**: `uniqn-mobile/src/domains/settlement/SettlementCalculator.ts` · `uniqn-mobile/src/domains/settlement/helpers.ts` · `uniqn-mobile/src/utils/allowanceUtils.ts` · `uniqn-mobile/src/components/schedule/tabs/SettlementTab.tsx` · `uniqn-mobile/src/components/employer/order-sheet/sheets/WelfareSheet.tsx`
- **위험**: (A)를 택하면 이미 발행된 공고의 지급액이 올라간다 — 완료 건은 동결값 경로가 보호하므로 pending 건만 영향받지만, 사장님에게는 예고 없는 인건비 상승이다. 공고 작성 시점 안내 문구 동반이 필수. (B)를 택하면 이미 '보장시간 5시간' 으로 공고를 낸 사장·지원한 스태프의 기대와 어긋난다 — 어느 쪽도 무해하지 않으므로 결정 자체가 이 항목의 핵심 산출물이다.
- **완료 증명**: `npx jest src/domains/settlement/__tests__/helpers.test.ts` 에 케이스 추가 — 실근무 3h·시급 10000·보장 5h 입력이 (A)면 50000, (B)면 30000. 수정 전 RED 확인 필수(현재 어떤 테스트도 이 필드를 계산에 넣지 않는다). `grep -rn "guaranteedHours" src/domains/ src/services/work/` 가 0건이 아니게 되는 것이 배선 증거.

#### W1-3. [M] 정산 금액 진실원 정렬 — 같은 근무 1건이 화면마다 최대 4가지 금액으로 보인다

- **결함**: SETTLE-5, SETTLE-8, STAFF-3(스태프측), SETTLE-18
- **왜**: SSOT 헬퍼가 계약을 문서로 못박아 뒀는데 소비처 전부가 우회한다. 특히 0원 정산 완료 건(노쇼 등)에서 `amount > 0` 가드가 동결값을 걸러내 재계산된 양수가 대신 표시되고, 같은 건의 ScheduleCard 는 0원을 보여줘 정면 모순한다. 여기에 SETTLE-18 의 거짓 안내('스태프 확정 금액은 기본급 기준')가 이 불일치를 '원래 다른 값'으로 정당화해 결함 인지 자체를 막는다 — 카피를 같이 고쳐야 수정이 의미를 갖는다.
- **어떻게**: ① `shouldUseFrozenPayrollAmount` 를 금액 표시의 유일 관문으로 만들고 위반 5곳을 교체: ScheduleDetailSheet.tsx:205, InfoTab.tsx:370, SettlementTab.tsx:348, WorkLogList.tsx:173, **scheduleService.ts:262(감사가 놓친 서비스 계층 5번째)**. ② SettlementDetailModal 과 SettlementCard 가 완료 건에 무조건 재계산하는 경로를 동결값 우선으로 전환. ③ 지점 정산은 서비스가 이미 만든 canonical(settlementVenueQuery.ts:53-68 calculatedAmount)을 버리지 말고 allowances/taxSettings 와 함께 카드·상세 모달에 주입. ④ SettlementSummaryCard.tsx:102-106 문구를 실제 저장 로직(세후 afterTaxPay)에 맞게 교정. ⑤ 재발 차단으로 ESLint no-restricted-syntax 에 `payrollAmount.*> 0` 패턴을 등록.
- **파일**: `uniqn-mobile/src/components/schedule/tabs/SettlementTab.tsx` · `uniqn-mobile/src/components/schedule/tabs/InfoTab.tsx` · `uniqn-mobile/src/components/schedule/ScheduleDetailSheet.tsx` · `uniqn-mobile/src/components/schedule/WorkLogList.tsx` · `uniqn-mobile/src/services/work/scheduleService.ts` · `uniqn-mobile/src/components/employer/settlement/SettlementCard.tsx` · `uniqn-mobile/app/(employer)/venue-settlements.tsx` · `uniqn-mobile/src/components/employer/settlement/SettlementSummaryCard.tsx` · `uniqn-mobile/.eslintrc.js`
- **위험**: 동결값 우선으로 바꾸면 지금까지 재계산으로 보이던 금액이 바뀐다 — 사용자 입장에선 '금액이 변했다'로 보인다. 변경 자체가 정상화지만 배포 노트에 명시 필요. 지점 정산에 allowances/taxSettings 를 주입하면 표시액이 올라가거나 내려간다(현재는 수당·세금을 통째로 누락 중).
- **완료 증명**: `npx jest src/utils/__tests__/settlementGrouping.test.ts` 에 payrollAmount=0 완료 건 케이스 추가. `npx jest src/services/work/settlement/__tests__/settlementVenueQuery.test.ts` 로 canonical 전달 회귀. 결정적 증거: `grep -rn "payrollAmount && .*payrollAmount > 0" src/` 가 **0건**이 되어야 한다(현재 5건). `npm run lint` 가 새 no-restricted-syntax 규칙으로 재도입을 차단하는지 임시 위반 코드로 RED 확인.

#### W1-4. [M] 정산이 한 방향으로만 굳는다 — 시간 수정해도 영원히 정산 불가, 지급 완료는 되돌릴 수 없다

- **결함**: SET-1, SETTLE-3
- **왜**: SET-1 은 완전한 막다른 길이다. 정산 화면의 '시간 수정' 이 status 를 승격하지 않아(SettlementRepository.ts:151-168 에 status 키 없음) UI 게이트는 타임스탬프 기준으로 통과시키는데 서버 게이트는 status 기준으로 영구 거부한다 — 정산 탭 내부에 탈출구가 0개다. 형제 경로(ConfirmedStaffRepository.ts:382-386)는 승격하고 있어 비대칭이 명백하다. SETTLE-3 은 `updateStatus` 가 구현·반환까지 돼 있는데 소비처가 레포 전체에 0곳이라 오지급 정정 수단이 없다.
- **어떻게**: ① SettlementRepository 의 시간 수정 updateData 에 status 승격을 추가(형제 경로 ConfirmedStaffRepository.ts:382-386 과 동일 규칙 재사용). 두 경로가 같은 헬퍼를 호출하도록 승격 로직을 추출한다. ② `useSettlement.updateStatus` 를 정산 상세 모달에 배선 — 완료 건에서 '지급 완료 취소' 를 confirmAction(destructive) + 사유 입력으로 노출. 서버측 AlreadySettledError 가드(:133-135, :584-586)와 RLS 잠금(20260712010000)은 되돌리기 RPC 를 새로 정의해야 통과하므로 마이그레이션 동반.
- **파일**: `uniqn-mobile/src/repositories/supabase/SettlementRepository.ts` · `uniqn-mobile/src/services/work/settlement/settlementMutation.ts` · `uniqn-mobile/src/hooks/useSettlement.ts` · `uniqn-mobile/src/components/employer/settlement/SettlementDetailModal` · `uniqn-mobile/supabase/migrations/20260727110000_revert_payroll_completion.sql`
- **위험**: 지급 완료 되돌리기는 금전 상태를 역행시킨다 — 반드시 감사 로그(누가·언제·왜)를 동반하고 RLS 에서 owner/워크스페이스 멤버로 제한해야 한다. status 승격 추가는 기존 정산 목록에 갑자기 정산 가능 건이 나타나게 하므로(현재 막혀 있던 건들) 배포 전 규모 추정 권장.
- **완료 증명**: `npx jest src/services/work/settlement/__tests__/settlementMutation.test.ts` — 시간 수정 후 updateData 에 status 가 포함되는지 단언, 수정 전 RED. 통합 재현: 로컬에서 scheduled 근무의 시간을 정산 화면에서 수정 → 같은 화면에서 '지급 완료로 표시' 가 성공하는지(현재는 '출퇴근이 완료되지 않았습니다' 로 영구 실패). 되돌리기는 `npm run test:db` 에 신규 pgTAP 으로 non-owner 거부 + owner 성공 + 감사행 생성 3항목.

#### W1-5. [L] 부분 확정하면 나머지 지원 일정이 지워지고 확정 해제해도 복구되지 않는다

- **결함**: APPL-1, EDIT-9
- **왜**: UI 기본 경로가 부분 확정이다 — 초기 selectedKeys 가 빈 Set 이고 1건 이상 선택해야 확정 버튼이 활성이므로 '전체 확정' 이 오히려 예외다. 그런데 RPC 가 `assignments = COALESCE(p_assignments_v3, assignments)` 로 선택분만 남기고 덮어쓰고, 확정 해제 RPC 는 status·history 만 되돌릴 뿐 assignments 를 원복하지 않는다. 원본 복원 함수(applicationHistoryService.ts:141 getOriginalApplicationData)는 존재하는데 구인자 화면 호출처가 0곳이다. 여기에 EDIT-9 의 고아 지원서가 겹치면 confirm_application 의 fail-open 가드(v_capacity=0 시 스킵)로 존재하지 않는 슬롯에 work_log 가 생성된다.
- **어떻게**: ① 확정 RPC 가 원본 assignments 를 별도 컬럼/JSONB 키(`original_assignments`)에 보존하도록 마이그레이션. 확정 해제 RPC 는 그 값으로 원복. ② 클라이언트는 선택분만 보내되 서버가 원본을 잃지 않게 계약을 바꾼다. ③ confirm_application 의 정원 가드를 `IF v_capacity > 0 AND …` 에서 '매칭 슬롯이 없으면 거부' 화이트리스트로 뒤집어 고아 지원서 확정을 차단하고 명확한 에러 코드를 반환. ④ 부분 확정 시 '선택하지 않은 N개 일정은 확정에서 제외됩니다' 를 확정 모달에 명시.
- **파일**: `uniqn-mobile/supabase/migrations/20260727120000_preserve_original_assignments.sql` · `uniqn-mobile/src/repositories/supabase/ApplicationRepositoryTransactions.ts` · `uniqn-mobile/src/components/employer/applicants/ConfirmModal.tsx` · `uniqn-mobile/src/services/jobs/applicationHistoryService.ts`
- **위험**: RPC 시그니처·JSONB 구조 변경이라 이미 부분 확정된 기존 행은 원본이 이미 소실됐다 — 백필 불가, 신규 건부터만 보호된다는 점을 명시해야 한다. 정원 가드를 화이트리스트로 뒤집으면 지금까지 통과하던 엣지 케이스가 거부되기 시작하므로 에러 문구가 '무엇+왜+어떻게' 를 갖춰야 한다.
- **완료 증명**: `npm run test:db` 에 신규 pgTAP — 3일 지원 → 1일만 확정 → assignments 3일 유지 단언, 확정 해제 후 원본 3일 복원 단언. 고아 지원서 시나리오(스케줄에서 슬롯 제거 후 확정 시도)가 MAX_CAPACITY_REACHED 또는 신규 SLOT_NOT_FOUND 로 거부되는지 단언(현재는 통과). `npx jest src/repositories/supabase/__tests__/ApplicationRepositoryTransactions.confirm.test.ts` 회귀.

#### W1-6. [M] realtime 훅 계약 수정 — 구독이 실패하면 영구 스피너, 새로고침은 완전 no-op

- **결함**: STAFF-1(스태프관리), STAFF-11(스태프관리), APPL-5, ORDER-9(허브)
- **왜**: 화면 4곳의 개별 버그가 아니라 훅 계약 하나의 결함이다. `enabled: !realtime` + `error: realtime ? null` 조합 때문에 realtime 모드에서는 ①에러가 절대 표면화되지 않아 ErrorState 가 도달 불가한 죽은 코드가 되고(무한 스피너, 재시도 수단이 앱 재실행뿐) ②refetch 가 스킵돼 새로고침 버튼과 pull-to-refresh 가 시각 피드백조차 없이 아무 일도 안 하며 ③낙관 갱신 3곳이 죽은 코드가 되고 ④refetch throw 가 미처리 Promise 로 소실된다. 이 화면은 대회 D-day 40명 운영의 주 화면이라 스피너 고착은 운영 중단과 같다.
- **어떻게**: ① `useConfirmedStaff`/`useApplicantsByJobPosting` 에서 구독 실패를 훅 error 로 승격 — 토스트 1회로 끝내지 말고 상태로 보존한다. ② `refresh` 를 realtime 모드에서도 동작시킨다(TanStack v5 는 enabled:false 쿼리도 수동 refetch 를 허용하므로 refreshRealtimeData 경로를 항상 노출). ③ isRefreshing 을 realtime 경로의 실제 진행 상태에 바인딩. ④ 화면의 handleRefresh 에 try/catch + 실패 토스트 추가. ⑤ realtime 모드에서 무의미한 낙관 갱신은 제거하거나 realtimeData 에도 반영되게 통일 — 죽은 코드를 남기지 않는다.
- **파일**: `uniqn-mobile/src/hooks/useConfirmedStaff.ts` · `uniqn-mobile/src/hooks/applicant/useApplicantsByJobPosting.ts` · `uniqn-mobile/src/components/employer/applicants/StaffManagementTab.tsx` · `uniqn-mobile/app/(employer)/my-postings/[id]/index.tsx` · `uniqn-mobile/src/hooks/applicant/useApplicantMutations.ts`
- **위험**: 에러 승격은 지금까지 조용히 넘어가던 일시적 구독 실패를 화면 전체 ErrorState 로 바꿀 수 있다 — 초기 데이터가 이미 있으면 배너 수준으로 강등하는 2단 처리가 필요(전체 화면 에러는 데이터가 0건일 때만).
- **완료 증명**: `npx jest src/hooks/__tests__/useConfirmedStaff*.test.ts`(없으면 신규) — 구독 onError 주입 시 훅의 error 가 non-null 이 되는지, realtime:true 에서 refresh() 가 실제로 조회 함수를 호출하는지 단언. 수정 전 RED 필수. 수동 재현: 네트워크를 끊고 스태프 관리 탭 진입 → 무한 스피너가 아니라 ErrorState+재시도가 뜨는지, 새로고침 버튼이 스피너를 돌리는지 육안 확인.

#### W1-7. [L] work_logs 쓰기 무결성 — 상태 변경이 출퇴근 기록을 확인·이력·가드 없이 지우거나 조작한다

- **결함**: ATT-1, ATT-2, ATT-3, STAFF-2(스태프관리), STAFF-3(스태프관리), GRID-1
- **왜**: work_logs 는 금전의 근거 데이터인데 상태 변경 경로만 형제 경로들이 갖춘 방어를 전부 빠뜨렸다. ①'출근 예정으로 변경' 이 check_in_ts/check_out_ts 를 확인 없이 null 로 지우고 modification_history 도 안 남긴다(시간 수정 경로는 사유 강제 + 이력 append 를 한다). ②updateStatus·markAsNoShow 에 정산 완료 가드가 없어 지급 완료된 근무의 근거 시각을 지우거나 노쇼로 뒤집을 수 있다(형제 cancelNoShow 는 막는다, RPC 쪽도 already_settled 로 막는다 — 클라 경로만 구멍). ③출근 기록 없는 스태프에 '퇴근 처리' 하면 check_in/check_out 이 같은 now 가 되어 근무 0분·정산 0원으로 굳는다. ④settlement_breakdown 무효화 누락으로 옛 시각 기반 금액이 스태프 화면에 남는다. ⑤근무표 수정 시트는 사장이 입력한 적 없는 종료시각 02:00 을 무조건 저장해 허위 8시간 근무를 만든다. ⑥settlement_breakdown 컬럼이 마이그레이션 전체에 0건인데 두 곳에서 UPDATE 한다(파리티 위반).
- **어떻게**: ① ConfirmedStaffRepository 에 work_logs 상태 쓰기 공통 관문을 만든다 — 정산 완료 가드(형제 :340/:459 와 동일) + modification_history append + settlement_breakdown null 리셋을 updateStatus·markAsNoShow 가 반드시 통과하게 한다. ② 시각을 지우는 전이(SCHEDULED)와 시각을 만드는 전이(CHECKED_OUT/COMPLETED, 출근 기록 없음)는 confirmAction destructive 로 승격하고 결과를 문구에 명시('출퇴근 기록이 삭제됩니다' / '근무 0분으로 기록됩니다'). ③ EditSlotSheet 는 endTime 이 원본에 없으면 전송에서 제외 — `if (input.startTime && input.endTime)` 이 항상 참이 되던 DEFAULT_END 상수 주입을 제거. ④ settlement_breakdown 은 prod 실측(`list_migrations`+정보스키마 조회)으로 존재 여부를 먼저 확정하고, 없으면 두 writer 를 제거하거나 컬럼을 정식 마이그레이션으로 추가해 파리티를 맞춘다.
- **파일**: `uniqn-mobile/src/repositories/supabase/ConfirmedStaffRepository.ts` · `uniqn-mobile/src/components/employer/applicants/StaffManagementTab.tsx` · `uniqn-mobile/src/components/weeklyGrid/EditSlotSheet.tsx` · `uniqn-mobile/src/repositories/supabase/WorkLogRepositoryVenue.ts` · `uniqn-mobile/src/repositories/supabase/SettlementRepository.ts` · `uniqn-mobile/supabase/migrations/20260727130000_worklogs_settlement_breakdown_parity.sql`
- **위험**: settlement_breakdown 은 prod 에만 존재하는 드리프트일 개연성이 높다(이 코드는 최초 구현부터 있었고 시간 수정은 출하·디버깅된 기능이다). **실측 없이 컬럼을 DROP 하거나 writer 를 지우면 안 된다** — 반드시 prod 정보스키마 조회가 선행. 정산 완료 가드 추가는 지금까지 가능하던 조작을 막으므로 운영 중 예외 요청이 나올 수 있다(관리자 우회 경로 설계 필요).
- **완료 증명**: `npx jest src/repositories/supabase/__tests__/ConfirmedStaffRepository.statusTimestamp.test.ts` 확장 — 정산 완료 행에 updateStatus/markAsNoShow 호출 시 AlreadySettledError, 상태 변경 시 modification_history 길이 증가, settlement_breakdown null 세팅을 각각 단언(수정 전 RED). `npx jest src/components/weeklyGrid/__tests__/` 에 EditSlotSheet 케이스 추가 — 원본 timeSlot 이 '18:00' 이면 저장 payload 에 endTime 이 없어야 한다. 파리티: `mcp__supabase__execute_sql` 로 `SELECT column_name FROM information_schema.columns WHERE table_name='work_logs' AND column_name='settlement_breakdown'` 실측 결과를 근거로 첨부.

#### W1-8. [M] QR 출퇴근 무결성 — 서버 가드가 노쇼를 되돌려주고, 실패한 스캔이 '스캔 완료!' 초록으로 표시된다

- **결함**: RPC-1, QR-2, QR-7
- **왜**: RPC-1 은 금전 영향이 있는 서버측 구멍이다. 출근 가드가 `IN ('checked_in','checked_out')` 블랙리스트라 no_show/cancelled/completed 가 전부 통과하고, RPC 는 authenticated 에 GRANT 돼 있어 클라 방어(selectWorkLogForQR.ts:151-164)를 우회할 수 있다. 노쇼는 check_in_ts 를 안 남기므로 직접 호출로 checked_in 을 만든 뒤에는 **정상 인앱 스캔만으로 퇴근까지 완료**되어 없던 유급 근무가 생긴다. QR-2 는 실패한 시도에서 이미 throttle 타임스탬프를 갱신해(성공 검사보다 먼저 실행) 재스캔이 무음으로 먹히는데 화면은 초록 '스캔 완료!' 를 그린다 — 거짓 성공이다.
- **어떻게**: ① 마이그레이션으로 출근 가드를 화이트리스트 전환 — `IF v_status NOT IN ('scheduled')` 이면 거부하고, p_action='auto' 해소도 checked_in 이 아닌 모든 status 를 checkIn 으로 보내지 않게 명시 분기. no_show/cancelled/completed 각각에 구분된 에러 코드 반환. ② `useQRCode.ts:64` 의 `lastScanTimeRef.current = now` 를 `result.success` 검사 **뒤로** 이동해 실패는 throttle 을 걸지 않게 한다. ③ throttle 로 무시할 때도 토스트/lastError 를 남겨 침묵을 없앤다. ④ QRCodeScanner 가 훅의 isProcessing 을 받아 서버 왕복 동안 '처리 중' 을 표시하고, 성공 응답 뒤에만 '스캔 완료!' 초록으로 전환한다(현재 인식 즉시 초록).
- **파일**: `uniqn-mobile/supabase/migrations/20260727140000_qr_checkin_status_whitelist.sql` · `uniqn-mobile/src/hooks/useQRCode.ts` · `uniqn-mobile/src/components/qr/QRCodeScanner.tsx` · `uniqn-mobile/app/(app)/qr/scan.tsx`
- **위험**: 화이트리스트 전환은 지금까지 통과하던 상태 조합을 거부하므로 현장에서 '스캔이 안 된다' 가 늘 수 있다 — 거부 사유가 스태프에게 명확히 전달되는지(무엇+왜+어떻게)를 함께 확인해야 한다. QR 소지 증명 부재(QR-1)는 이 항목으로 해결되지 않는다(W3).
- **완료 증명**: `npm run test:db` 신규 pgTAP — no_show/cancelled/completed 상태의 work_log 에 대해 RPC 직접 호출이 거부되는지 3케이스 단언(현재는 통과하므로 수정 전 RED). `npx jest src/hooks/__tests__/useQRCode*.test.ts` — 실패 결과 후 즉시 재호출이 throttle 되지 않고 실제로 처리되는지 단언. 스캐너: 성공 응답 전에는 '스캔 완료!' 텍스트가 렌더되지 않는지 RTL 로 단언.

#### W1-9. [L] 공고 수정이 무음으로 덮어쓴다 — 편집 중 확정이 발생하면 일정이 버려지고, 협업자 동시 저장은 뒤가 이긴다

- **결함**: EDIT-1, EDIT-2
- **왜**: EDIT-1 은 성공 토스트와 함께 데이터가 사라지는 최악의 조합이다. 레이아웃의 realtime useJobDetail 과 편집 화면이 **같은 queryKey** 를 써서, 편집 도중 확정이 들어오면 setQueryData 가 existingJob 을 갈아치우고 hasConfirmedApplicants 가 false→true 로 뒤집힌다. 제출은 그 최신 값을 소비해 축소 payload 에서 schedule 키를 제거하고, 직렬화가 현행 스케줄을 복원한 뒤 성공 토스트를 띄운다 — 날짜·시각·인원이 조용히 유실된다. EDIT-2 는 낙관적 잠금이 없어 전송 payload 가 patch 가 아니라 문서 전체이므로 협업자의 변경이 통째로 사라진다. 여기에 영향 행 수 미검사(:668)까지 겹쳐 RLS 로 0행이 갱신돼도 false success 가 된다.
- **어떻게**: ① 편집 화면은 realtime 갱신을 받지 않는 별도 queryKey 또는 진입 시점 스냅샷을 쓰게 분리한다 — 확정이 발생하면 즉시 폼을 갈아치우는 대신 '편집 중 확정이 발생했습니다. 최신 상태로 다시 불러올까요?' 배너로 사용자에게 선택권을 준다. ② updateWithTransaction 에 낙관적 잠금 추가 — `.eq('id', …).eq('updated_at', expectedUpdatedAt)` 로 조건부 UPDATE 하고 `.select()` 로 영향 행 수를 검사, 0행이면 '다른 사람이 먼저 수정했습니다' ConflictError. ③ 리포지토리 공통 `assertAffectedRows` 헬퍼를 세우고 같은 무검증 패턴 3곳(ApplicationRepositoryTransactions.ts:393-404, ApplicationRepository.ts:408-417)에도 적용.
- **파일**: `uniqn-mobile/app/(employer)/my-postings/[id]/edit.tsx` · `uniqn-mobile/src/hooks/useJobDetail.ts` · `uniqn-mobile/src/repositories/supabase/JobPostingRepository.ts` · `uniqn-mobile/src/repositories/supabase/JobPostingRepositoryHelpers.ts` · `uniqn-mobile/src/repositories/supabase/ApplicationRepositoryTransactions.ts` · `uniqn-mobile/src/repositories/supabase/ApplicationRepository.ts`
- **위험**: 낙관적 잠금 도입은 지금까지 성공하던 저장을 거부하기 시작한다 — 충돌 시 사용자가 무엇을 해야 하는지(내 변경 보존 + 재적용) 경로가 없으면 오히려 데드엔드가 된다. 최소한 '내 입력을 복사해 둘 수 있는' 안내나 재시도 경로를 동반해야 한다. queryKey 분리는 편집 화면이 stale 데이터를 쓰게 되므로 배너가 필수.
- **완료 증명**: `npx jest src/repositories/supabase/__tests__/JobPostingRepository.*.test.ts` 에 신규 케이스 — updated_at 불일치 시 ConflictError, 0행 갱신 시 성공 반환하지 않음(수정 전 RED, 현재는 로컬 validated 를 그대로 반환). `npx jest src/components/employer/order-sheet/__tests__/OrderSheetScreen.edit.test.tsx` 확장 — 편집 중 detailQueryKey 가 갱신돼도 폼의 scheduleGroups 가 바뀌지 않는지 단언. 수동: 두 세션에서 같은 공고를 동시 저장해 뒤가 거부되는지 확인.

#### W1-10. [S] 취소 사유 원문이 실명과 함께 공개 게시판에 자동 게시된다 — 기본 ON, 사장 승인 전

- **결함**: CANCEL-12
- **왜**: 개인정보 노출이다. '대타 구인 글 자동 등록' 체크박스가 기본 true 이고 재열림 시에도 true 로 리셋되는데, 설명 문구는 '게시판에 대타 구인 글이 자동으로 올라갑니다' 라고만 하고 **무엇이 실리는지 고지하지 않는다**. 실제로는 취소 사유 원문이 본문 첫 줄이고 작성자는 실명/닉네임이다. 게다가 요청 성공 직후 즉시 게시되므로 사장이 아직 검토도 안 한 시점에 공개된다. 사용자는 사장에게만 말한다고 믿고 사적 사유(질병·가족 문제 등)를 쓴다.
- **어떻게**: ① 체크박스 기본값을 false 로. ② 게시 본문에서 취소 사유 원문을 제거하고 일정·역할·지점 정보만 싣는다(사유는 사장에게만 전달). ③ 체크 시 미리보기를 노출 — '게시판에 이렇게 올라갑니다' 로 실제 본문을 보여준다. ④ 게시 시점을 사장 승인 이후로 이동(현재는 요청 직후 createSubstitutePost 호출). ⑤ 작성자 표기를 실명 대신 익명/닉네임 옵션으로.
- **파일**: `uniqn-mobile/src/components/applications/CancellationRequestForm.tsx` · `uniqn-mobile/src/services/board/boardSubstituteService.ts` · `uniqn-mobile/src/services/jobs/applicationService.ts`
- **위험**: 게시 시점을 승인 이후로 옮기면 대타 모집이 늦어져 사장에게는 손해다 — 승인 전 게시를 유지하되 '사유 미포함 + 미리보기 + 기본 OFF' 만으로 개인정보 문제를 해소하는 절충이 더 실용적일 수 있다. 이미 게시된 기존 글에 사유가 남아 있는지 확인·정리 필요.
- **완료 증명**: `npx jest src/services/board/__tests__/boardSubstituteService*.test.ts`(없으면 신규) — 생성된 post body 에 input.reason 문자열이 **포함되지 않는지** 단언(수정 전 RED). `npx jest src/components/applications/__tests__/CancellationRequestForm*.test.tsx` — 초기 체크 상태가 false 인지, 재열림 후에도 false 인지 단언. 기존 데이터: `SELECT count(*) FROM board_posts WHERE title LIKE '대타 구해요%'` 로 정리 대상 규모 확인.

#### W1-11. [M] 제출 피드백 공통화 — 결과를 보기 전에 모달을 닫고 성공을 선언하는 5개 경로 + 이중 에러 토스트

- **결함**: APPL-7, CANCEL-14, STAFF-4(스태프관리), ORDER-3(허브), CANCEL-15, ORDER-5(주문서)
- **왜**: 같은 실수가 5곳에서 반복된다: mutate 를 fire-and-forget 으로 쏘고 동기적으로 모달을 닫아, 실패 시 사용자가 입력한 200자 사유가 통째로 사라지고 에러 토스트만 남는다. 그 결과 '처리 중...' 라벨과 isLoading prop 이 렌더될 일이 없는 **죽은 코드**가 되고, 느린 네트워크에서 재탭→중복 제출 경로가 열린다. STAFF-4 는 더 나빠서 서버 결과와 무관하게 성공 토스트가 먼저 뜨고 실패해도 '변경되었습니다' 가 남는다. ORDER-5(주문서)는 반대 방향으로, 훅이 이미 띄운 토스트 위에 화면이 원시 error.message(Supabase 영문 원문)를 한 장 더 얹는다. mutateAsync 는 이미 노출돼 있어 수정 비용이 낮다.
- **어떻게**: ① 공용 `useSubmitGate` 훅 — mutateAsync 를 await 하고, 진행 중 입력/버튼을 잠그고, 성공에서만 close/navigate 하며, 실패 시 모달과 입력을 그대로 유지한다. 5개 호출부를 이 훅으로 교체. ② CANCEL-15 는 전역 isPending 대신 `mutation.variables` 로 대상 카드만 잠근다(ORDER-6(허브)의 목록 전체 잠금도 같은 처방). ③ ORDER-5(주문서)는 edit.tsx:97 이 이미 남긴 주석대로 create.tsx 의 catch 에서 addToast 를 제거하고 logger.error 만 남긴다 — 원시 message 를 화면에 재노출하지 않는다. ④ TextInput 에 maxLength 를 서버 zod 한도(사유 200자/메모 500자)와 맞춰 초과 자체를 막는다.
- **파일**: `uniqn-mobile/src/hooks/useSubmitGate.ts` · `uniqn-mobile/src/components/employer/applicants/ConfirmModal.tsx` · `uniqn-mobile/app/(employer)/my-postings/[id]/applicants.tsx` · `uniqn-mobile/src/components/employer/applicants/CancellationRequestCard.tsx` · `uniqn-mobile/app/(employer)/my-postings/[id]/cancellation-requests.tsx` · `uniqn-mobile/src/features/employer/settlements/useStaffSettlementsHandlers.ts` · `uniqn-mobile/app/(app)/(tabs)/employer.tsx` · `uniqn-mobile/app/(employer)/my-postings/create.tsx`
- **위험**: 모달을 열어둔 채 await 하면 사용자가 배경을 탭해 닫으려 할 수 있다 — 진행 중에는 백드롭 dismiss 를 막아야 한다. 낮음.
- **완료 증명**: `npx jest src/components/employer/applicants/__tests__/ConfirmModal*.test.tsx` — mutateAsync reject 를 주입했을 때 모달이 열려 있고 입력값이 보존되는지 단언(수정 전 RED). `npx jest app/(employer)/my-postings/__tests__/` 에서 create 실패 시 addToast 호출이 1회인지 단언(현재 2회). CANCEL-15: 카드 2개 렌더 후 1개 처리 시 나머지 카드가 disabled 가 아닌지 단언.

#### W1-12. [M] 주문서 무음 유실·데드엔드 퀵윈 5종 — 프리셋 1탭 덮어쓰기, 타입 전환 소거, 고정 공고 닫힌 고리

- **결함**: ORDER-3(주문서), ORDER-11(주문서), ORDER-4(주문서), ORDER-8(주문서), ORDER-9(주문서)
- **왜**: 전부 S 규모인데 첫 공고 작성 완주율에 직접 붙는다. ①프리셋 카드 1탭이 form.reset 으로 폼 전체를 확인·Undo 없이 교체하고, reset 이 isDirty 를 false 로 떨어뜨려 이탈 경고까지 무장 해제한다 — 같은 파일에 완성된 Undo 구현이 있는데 안 쓴다. ②타입 전환이 날짜를 지우면서 신호를 0개 낸다(스태시는 하지만 useRef 라 화면 이탈 시 증발). ③고정 공고는 근무조건 시트 확인 버튼에 게이트가 없어 출근시간 없이 확인해도 행이 미설정으로 남고 연쇄가 같은 자리를 반복한다 — 홀덤펍 상시 알바의 주력 타입에서 닫힌 고리. ④날짜 상한 소진 시 '＋ 일정 추가' 가 열리고 '최대 0개까지 선택할 수 있습니다' 라는 사람이 안 쓰는 문장을 띄운다. ⑤프리셋 로딩 중 '아직 프리셋이 없어요' 를 단정해 재방문 사장에게 거짓말한다.
- **어떻게**: ①handleDeleteGroup(:442-480)의 스냅샷+5초 Undo 토스트 패턴을 handleApplyPreset 에 그대로 이식(폼이 dirty 일 때만). ②handleTypeChange 에서 실제로 데이터를 치웠을 때 info 토스트+되돌리기 액션 발행, 스태시를 useRef 대신 폼 상태로 승격. ③WorkConditionSheet 확인 버튼에 `disabled={!negotiable && !startTime}` + PlaceSheet:95-99 의 사유 힌트 패턴 이식, defaultFixedSchedule 에 startTime 시드. ④상한 도달 시 '＋ 일정 추가' 를 비활성+캡션으로 바꾸고, CalendarPicker.tsx:341 의 `if (maxSelections && …)` falsy 버그(maxSelections=0 이 가드를 무력화)를 `!= null` 로 수정. ⑤PresetCarousel 에 isLoading prop 추가 + Skeleton 노출.
- **파일**: `uniqn-mobile/src/components/employer/order-sheet/OrderSheetScreen.tsx` · `uniqn-mobile/src/components/employer/order-sheet/sheets/WorkConditionSheet.tsx` · `uniqn-mobile/src/components/employer/order-sheet/PresetCarousel.tsx` · `uniqn-mobile/src/components/employer/job-form/modals/DatePickerModal.tsx` · `uniqn-mobile/src/components/jobs/DateCalendar/CalendarPicker.tsx` · `uniqn-mobile/app/(employer)/my-postings/create.tsx`
- **위험**: PresetCarousel 의 빈 상태 동작은 PresetCarousel.test.tsx:29 가 '저장 카드는 숨긴다' 를 의도로 못박아 뒀다 — 로딩 스켈레톤 추가는 안전하지만 저장 카드 노출(ORDER-10)은 의도 변경이므로 별도 결정(W2/deferred). CalendarPicker 가드 수정은 다른 호출부에 영향 가능성이 있어 maxSelections 사용처 전수 확인 필요.
- **완료 증명**: `npx jest src/components/employer/order-sheet/__tests__/OrderSheetScreen.presets.test.tsx` — 프리셋 적용 후 Undo 액션이 담긴 토스트가 발행되고 실행 시 이전 값이 복원되는지 단언. `npx jest src/components/employer/order-sheet/__tests__/orderRowMeta.fixed.test.ts` + `OrderSheetScreen.fixed.test.tsx` — startTime 없이 확인 시 버튼이 disabled 인지, 확인 후 workConditions 행이 set 이 되는지(현재 영원히 unset) 단언. `npx jest src/components/jobs/DateCalendar/__tests__/` — maxSelections=0 에서 onMultiSelectChange 가 호출되지 않는지 단언.

### W2 — 핵심 완성도 (여정을 실제로 편하게)

- **목표**: '카톡+엑셀보다 편하다'를 성립시키는 중형 작업. 화면 신설·구조 변경 포함. 개별 결함 나열이 아니라 반복 패턴을 공용 자산으로 묶는다.
- **추정**: 약 4~5주 (1인 기준). W1 완료 후 착수 — W1 의 공용 훅·헬퍼를 전제로 하는 항목이 다수.

#### W2-1. [L] 주문서 임시저장(draft) 영속화 + 시트 dirty 가드 — 입력을 잃는 마지막 두 경로

- **결함**: ORDER-1(주문서), ORDER-2(주문서)
- **왜**: 영업 중 한 손으로 조작하는 사장님에게 인터럽트(주문·전화·손님)는 상시다. 15탭 넘게 채운 공고가 OS 킬·웹 탭 종료로 통째로 날아가면 재시도 자체를 포기한다. 유일한 방어인 useUnsavedChangesGuard 는 `navigation.addListener('beforeRemove')` 하나뿐이라 백그라운드 킬을 못 잡고 beforeunload 는 레포 전체에 0건이다. 시트 백드롭 1탭도 같은 계열 — 슬롯 3개×역할 4개를 15탭에 걸쳐 만든 뒤 여백 오탭 한 번에 전부 사라진다.
- **어떻게**: ① `react-native-mmkv` 4.1.2 와 기존 래퍼 `src/lib/mmkvStorage.ts` 를 재사용한다. OrderSheetScreen 의 form.watch 구독에 debounce(1~2초)를 걸고 기존 `formValuesToDraft`(mappers.ts:453)로 직렬화해 `orderSheetDraft:{userId}` 로 저장. create.tsx 진입 시 키가 있으면 '작성 중이던 공고가 있어요 — 이어서 / 새로 시작' 배너를 띄우고 draftToValues 로 복원(프리셋 적용과 동일한 form.reset 경로 재사용). 제출 성공·'새로 시작'에서 키 삭제. 웹은 beforeunload 에 flush. ② SheetModal 에 `dismissGuard?: () => boolean` prop 을 추가하고, 편집이 발생하는 5개 시트가 seed↔현재 state 비교로 dirty 를 넘긴다. dirty 면 백드롭/X 에서 confirmAction(destructive) 을 태운다. ③ 같은 계열의 무확인 파기 2곳도 처리 — ScheduleSlotsSheet.removeSlot(시간+역할 다 채운 슬롯이 X 한 번에 소멸), DatePickerModal.handleClose(선택한 날짜 7개 전량 폐기).
- **파일**: `uniqn-mobile/src/components/employer/order-sheet/OrderSheetScreen.tsx` · `uniqn-mobile/app/(employer)/my-postings/create.tsx` · `uniqn-mobile/src/lib/mmkvStorage.ts` · `uniqn-mobile/src/components/ui/SheetModal.tsx` · `uniqn-mobile/src/components/employer/order-sheet/sheets/ScheduleSlotsSheet.tsx` · `uniqn-mobile/src/components/employer/job-form/modals/DatePickerModal.tsx`
- **위험**: draft 에 개인정보(연락처)가 로컬 저장되므로 로그아웃 시 삭제가 필요하다. form.watch 전체 구독에 debounce 를 얹으면 리렌더 부하가 늘 수 있어(감사 미포함 성능 축) 구독을 필요한 키로 좁히는 작업과 함께 진행하는 게 안전. dismissGuard 를 전 시트에 걸면 가벼운 시트에서 확인 다이얼로그가 소음이 되므로 dirty 판정 기준을 시트별로 조정해야 한다.
- **완료 증명**: `npx jest src/components/employer/order-sheet/__tests__/OrderSheetScreen.*.test.tsx` 신규 — mmkvStorage 를 mock 하고 값 변경 후 debounce 경과 시 저장 호출, 재마운트 시 복원, 제출 성공 시 삭제 3단계 단언. 시트: dirty 상태에서 백드롭 press 시 onClose 가 호출되지 않고 confirmAction 이 호출되는지 단언. 수동: 웹에서 입력 중 탭 새로고침 → 배너 노출 확인.

#### W2-2. [M] Undo 토스트 공통화 — 파괴적 액션 전 구간에 되돌리기를 배선한다(백로그 M9)

- **결함**: APPL-2, EDIT-11, GRID-18, SETTLE-3
- **왜**: toastStore 에 action 필드가 있고 OrderSheetScreen 에 완성된 레퍼런스 구현이 있는데도 파괴적 액션 대부분이 되돌리기 없이 굳는다. 공고 수정은 이력도 되돌리기도 없어 잘못 저장한 순간 이전 내용이 앱 어디에서도 복구 불가(`posting_history|editHistory|job_posting_revisions` grep 0건). 근무에서 뺀 인원은 지원 확정 해제까지 일어나는데 Undo 가 없다. 개별 화면마다 구현하면 5번째 구현이 또 달라진다.
- **어떻게**: ① `useUndoableAction({ snapshot, execute, undo, message })` 공용 훅을 만들고 OrderSheetScreen.handleDeleteGroup 을 그 위로 이식해 레퍼런스로 삼는다(clearPendingSwap 같은 부수 정리도 훅 계약에 포함). ② 확정(APPL-2)·그리드 슬롯 제거(GRID-18)·정산 완료(SETTLE-3 되돌리기와 연동)에 배선. ③ 공고 수정(EDIT-11)은 Undo 로는 부족하므로 최소 이력 1세대를 남긴다 — 저장 직전 문서 스냅샷을 별도 테이블/JSONB 컬럼에 보관하고 '이전 내용으로 되돌리기' 를 성공 토스트 액션으로 제공(전체 이력 화면은 W3).
- **파일**: `uniqn-mobile/src/hooks/useUndoableAction.ts` · `uniqn-mobile/src/components/employer/order-sheet/OrderSheetScreen.tsx` · `uniqn-mobile/src/hooks/applicant/useStaffConversion.ts` · `uniqn-mobile/src/components/weeklyGrid/EditSlotSheet.tsx` · `uniqn-mobile/supabase/migrations/20260728100000_job_posting_previous_snapshot.sql`
- **위험**: 확정 Undo 는 W1 의 CANCEL-2 수정(actorType)이 선행돼야 동작한다 — cancelConfirmationAsync 재사용이 전제이기 때문. 서버 상태를 되돌리는 Undo(확정 해제·정산 취소)는 그 사이 다른 변경이 끼면 실패하므로 실패 처리와 5초 창 설계가 필요.
- **완료 증명**: `npx jest src/hooks/__tests__/useUndoableAction.test.ts` 신규 — 실행 후 토스트 action 발행, undo 호출 시 스냅샷 복원, 5초 후 액션 만료 단언. 각 배선 지점별로 기존 테스트에 'Undo 액션이 토스트에 포함된다' 단언 추가. 공고 이력: `npm run test:db` 로 저장 시 이전 스냅샷 1세대가 남는지 pgTAP 단언.

#### W2-3. [L] 일괄 작업 신뢰 계층 — 부분 실패 리포터 + 선택 모집단 정합 + 대상별 잠금

- **결함**: APPL-3, SETTLE-10, SETTLE-11, SETTLE-12, ORDER-6(허브), STAFF-16(스태프관리)
- **왜**: 대회 D-day 40명 운영이 이 앱의 핵심 시나리오인데 일괄 작업이 전부 불신 상태다. ①일괄 확정 부분 실패 시 서비스는 failed[{applicationId,code,reason}] 를 정확히 반환하는데 훅이 개수 토스트로 접어버려 '누가' 실패했는지 알 수 없다. ②정산은 '선택 N건' 과 '선택 금액' 이 서로 다른 모집단을 집계해 '5건 선택 / ₩0' 을 표시한 뒤 실제로 5건을 처리한다. ③그룹 카드 전체선택이 정산 불가 건까지 담아 서버 실패를 자초한다(같은 파일 :223-230 에 올바른 필터가 계산돼 있는데 안 쓴다). ④한 건 처리 중 전 카드가 잠긴다. ⑤확정 스태프 목록에는 일괄 작업 자체가 없어 40명 출근 처리에 120탭이 필요하다.
- **어떻게**: ① 공용 `BulkResultSheet` — 성공/실패를 이름과 사유로 나열하고 '실패분만 재시도' 버튼을 제공. 서비스가 이미 실패 상세를 반환하므로 훅에서 접지 말고 그대로 올린다. ② 선택 모집단 SSOT — selectedIds 를 필터 적용본 기준으로 정규화하고, 필터 변경 시 선택에서 사라진 항목을 정리(APPL-18 의 유령 선택도 같은 처방). 금액 집계와 개수 집계가 같은 배열을 순회하게 한다. ③ GroupedSettlementCard 전체선택이 settlableWorkLogs 를 쓰게 교체하고 부분 선택을 indeterminate 로 표현. ④ 전역 isPending 대신 mutation.variables 로 대상만 잠금(W1-11 과 동일 처방을 목록에 확대). ⑤ ConfirmedStaffList 에 SettlementList 의 선택/일괄 액션 바 패턴을 이식.
- **파일**: `uniqn-mobile/src/components/shared/BulkResultSheet.tsx` · `uniqn-mobile/src/hooks/applicant/useApplicantMutations.ts` · `uniqn-mobile/src/components/employer/settlement/SettlementList.tsx` · `uniqn-mobile/src/components/employer/settlement/GroupedSettlementCard.tsx` · `uniqn-mobile/src/components/employer/applicants/ApplicantList.tsx` · `uniqn-mobile/src/components/employer/applicants/ConfirmedStaffList.tsx` · `uniqn-mobile/app/(app)/(tabs)/employer.tsx`
- **위험**: SETTLE-10 의 RPC 이관(다중 쓰기 규약 위반)은 이 항목에 포함하지 않는다 — 적대 검증에서 '행 간 교차 불변식이 없고 상태 가드가 멱등이라 부분 실패가 데이터를 오염시키지 않는다'로 확인됐으므로 UX 층(실패 리포터)이 먼저고 RPC 이관은 W3. 여기서 RPC 까지 손대면 범위가 터진다.
- **완료 증명**: `npx jest src/components/employer/settlement/__tests__/SettlementList*.test.tsx` — 필터 변경 후 selectedCount 와 selectedAmount 가 같은 모집단을 집계하는지 단언(현재 어긋남, 수정 전 RED). `npx jest src/components/employer/settlement/__tests__/GroupedSettlementCard*.test.tsx` — 전체선택이 완료·미완료 건을 제외하는지 단언. `npx jest src/hooks/applicant/__tests__/useApplicantMutations*.test.ts` — 부분 실패 시 실패 상세가 콜백/상태로 전달되는지 단언. 수동: 10건 중 3건 실패하도록 mock 하고 시트에 3명의 이름·사유가 나오는지 확인.

#### W2-4. [L] 잠금·상태 설명 SSOT + 대안 경로 — 같은 제약을 5가지 문구로 말하면서 '그럼 어떻게' 를 아무도 말하지 않는다

- **결함**: EDIT-3, EDIT-12, EDIT-4, EDIT-5, EDIT-13, ORDER-4(허브), ORDER-2(허브), EDIT-14
- **왜**: 확정 스태프 1명이면 공고 전체의 날짜·시간·역할이 영구 동결되는데, 증원·일정 추가 같은 대안 경로가 상세 화면 관리 카드 6종 어디에도 없다. 서버는 변경 방향과 무관하게(순증도) 거부한다. 그런데 이 제약을 설명하는 문구가 5곳에서 5가지이고 전부 '무엇+왜' 까지만이라 impeccable §10(무엇+왜+어떻게)을 정면 위반한다. 여기에 상태 투명성 결함이 겹친다 — 마감·취소·만료 공고도 수정 화면에 그대로 들어가지고 편집 화면에 상태 표시가 없으며, 관리 카드 5종 중 posting.status 를 보는 것이 하나도 없고, '공고 내용과 **상태**를 수정합니다' 라는 거짓 카피가 두 곳(:544, :602 고정 분기)에 있는데 편집 화면에는 상태 축 자체가 없다.
- **어떻게**: ① 잠금 사유·대안을 한 곳에서 만드는 `describePostingLock(posting)` SSOT 를 만들고 5개 표시 지점이 전부 이걸 쓰게 한다. 문구는 '무엇+왜+어떻게' 3요소 필수 — '확정된 스태프가 있어 일정·역할을 바꿀 수 없어요. 인원을 늘리려면 새 공고를 내거나, 확정을 해제한 뒤 수정하세요' + 해당 액션 버튼. ② 서버 가드를 방향 인식으로 완화 — 순증(인원 추가·일정 추가)은 허용하고 축소·변경만 거부(마이그레이션). ③ 관리 카드 5종에 status 분기를 넣어 종료된 공고에서 무의미한 액션을 숨기거나 비활성+사유로 바꾼다. ④ 거짓 카피 2곳 동시 수정 + 허브에 마감/재오픈 액션 추가(현재 목록 카드에만 있어 헛걸음). ⑤ 잠긴 행이 unset 인 레거시 공고의 저장 불가(EDIT-4)는 firstUnsetRow 에 skipKeys 를 넘겨 해소.
- **파일**: `uniqn-mobile/src/utils/jobPostingVisibility.ts` · `uniqn-mobile/src/components/employer/order-sheet/orderRowMeta.ts` · `uniqn-mobile/src/components/employer/order-sheet/OrderSheetScreen.tsx` · `uniqn-mobile/app/(employer)/my-postings/[id]/edit.tsx` · `uniqn-mobile/app/(employer)/my-postings/[id]/index.tsx` · `uniqn-mobile/src/repositories/supabase/JobPostingRepository.ts` · `uniqn-mobile/supabase/migrations/20260728110000_allow_schedule_increase_with_confirmed.sql`
- **위험**: 서버 가드 완화(순증 허용)는 정원 계산·work_logs 정합에 영향을 준다 — filled/total positions 트리거와 confirm_application 의 v_capacity 계산이 순증을 올바르게 반영하는지 pgTAP 로 먼저 확인해야 한다. 잘못하면 EDIT-9 의 고아 지원서 문제를 키운다(W1-5 선행 필수).
- **완료 증명**: `npx jest src/components/employer/order-sheet/__tests__/orderRowMeta.test.ts` — 잠긴 행이 unset 이어도 firstUnsetRow 가 그 행을 반환하지 않는지 단언(EDIT-4 회귀). `grep -rn "일정과 역할" src/ app/` 결과가 SSOT 함수 1곳으로 수렴하는지 확인. `grep -rn "공고 내용과 상태를 수정" app/` 이 0건이 되는지. `npm run test:db` 로 순증 허용 pgTAP — 확정자 있는 공고에 인원 +1 은 성공, -1 은 거부.

#### W2-5. [L] 취소·거절 커뮤니케이션 완결 — 수집한 사유가 상대에게 도달하지 않고, 한 번 거절당하면 영구 봉쇄된다

- **결함**: APPL-4, CANCEL-5, CANCEL-6, CANCEL-11, CANCEL-3, CANCEL-10, CANCEL-13, CANCEL-8
- **왜**: 사장님이 입력한 거절 사유가 스태프에게 한 글자도 도달하지 않는다(알림 본문이 '지원이 거절되었습니다' 고정, 같은 트리거의 cancellation_rejected 는 사유를 싣고 있어 누락이 명백). 취소 거절 사유도 스태프 화면 소비처가 0곳이다. 더 나쁜 건 CANCEL-6 — 한 번 거절당하면 재요청이 영구 차단되는데(rejected 를 초기화하는 코드가 어디에도 없다) 화면은 '취소 요청' 버튼을 계속 보여주고 확인 다이얼로그까지 통과시킨 뒤에야 '구인자에게 직접 문의하세요' 토스트를 띄운다. 앱 안에 그 '직접 문의' 경로가 없다. 파괴적 액션의 영향 범위 표시도 과소 — 승인 RPC 는 그 지원서의 **모든** 예정 근무를 지우는데 양쪽 UI 는 첫 일정 1건만 보여주고, 승인 확인 모달에는 대상 스태프 이름조차 없다.
- **어떻게**: ① application_rejected 알림 본문·data 에 rejectionReason 을 싣는다(같은 트리거의 cancellation_rejected 구현을 그대로 따름). 스태프 화면에 거절 사유 표시 지점 신설. ② 취소 거절 후 재요청 정책을 결정한다 — 영구 봉쇄 대신 '거절 사유 확인 + 사장에게 문의' 경로를 열거나 N일 후 재요청 허용. 최소한 버튼을 비활성+사유로 바꿔 헛탭을 없앤다. ③ 취소 요청 철회(스태프)를 상태 머신에 추가. ④ 승인/거절 모달에 대상 스태프·전체 일정 목록·정원 영향을 표시(파괴적 액션의 영향 범위를 정확히). ⑤ 임박 취소(D-0/D-1) 경고 배너. ⑥ 승인 후 '자리가 비었습니다 — 대기 지원자 확인' CTA.
- **파일**: `uniqn-mobile/supabase/migrations/20260728120000_application_rejected_reason_in_notification.sql` · `uniqn-mobile/src/components/employer/applicants/CancellationRequestCard.tsx` · `uniqn-mobile/app/(employer)/my-postings/[id]/cancellation-requests.tsx` · `uniqn-mobile/src/components/applications/CancellationRequestForm.tsx` · `uniqn-mobile/src/components/schedule/ScheduleDetailModal.tsx` · `uniqn-mobile/src/domains/application/ApplicationStatusMachine.ts` · `uniqn-mobile/app/(app)/(tabs)/schedule.tsx`
- **위험**: 거절 사유를 스태프에게 노출하면 사장님이 솔직한 사유를 안 쓰게 될 수 있다 — 내부 메모와 전달 사유를 분리하는 설계가 나을 수 있다(제품 결정). 재요청 허용은 사장님 업무 부하를 늘리므로 정책 결정 필요.
- **완료 증명**: `npm run test:db` — status→rejected 전이 시 생성된 notification 의 body/data 에 rejectionReason 이 포함되는지 pgTAP 단언(현재 미포함, 수정 전 RED). `npx jest src/components/employer/applicants/__tests__/CancellationRequestCard*.test.tsx` — assignments 가 3일이면 3일이 모두 렌더되는지 단언(현재 [0] 만). 수동: 거절 후 스태프 화면에서 사유가 보이는지, 재요청 버튼이 비활성+사유인지 확인.

#### W2-6. [L] 운영 허브를 실제 운영 화면으로 — 당일 지표·상태 정합·탭 가능한 숫자

- **결함**: ORDER-1(허브), ORDER-2(허브), ORDER-7(허브), ORDER-11(허브), ORDER-12(허브), ORDER-16(허브), ORDER-17(허브), ORDER-18(허브), ORDER-15(허브)
- **왜**: 허브가 '관리 카드 목록' 이지 운영 대시보드가 아니다. 당일 운영 지표('오늘 출근 X/Y', '정산 대기 N')가 한 화면 안쪽에 숨어 있고, 지표 숫자 3종이 탭 불가한 정적 View 라 스크린리더에 6조각으로 흩어져 읽힌다(같은 코드베이스의 TodayOpsStrip 은 Pressable+목적지 포함 라벨을 제대로 쓴다). 라이브 운영 배지는 completed 대회에도 '진행 중' 이라고 거짓말한다(소스 쿼리에 status 필터가 없다). 필터 탭은 승인대기·임시저장·만료·취소를 어디에도 매핑하지 않아 카운트 합이 전체와 어긋나는데 숫자를 그대로 노출한다. 정렬은 비교마다 buildPostingFacts(3중 reduce+파생 5종)를 재계산한다.
- **어떻게**: ① 허브 최상단에 당일 운영 스트립(출근 X/Y, 정산 대기 N, 취소 요청 N)을 배치하고 각 숫자를 목적지 포함 Pressable 로 만든다(핸들러 handleApplicants·handleSettlements 는 이미 존재). ② 라이브 운영 배지는 OpsTournamentRepository.listByPosting 에 status 필터를 추가하거나 배지 라벨을 실제 status 로 계산. ③ STATUS_FILTER_BUCKET 에 미매핑 status 를 흡수하는 '기타' 버킷을 추가하거나 카운트 합 불일치를 없애도록 all 정의를 맞춘다. ④ buildPostingFacts 결과를 사전 계산해 Map 으로 들고 sort 비교자는 조회만 하게 한다. ⑤ 카피 정합 — '0명의 지원자가 대기중입니다', 항상 뜨는 삭제 불가 캡션, 필터 무관 빈 상태 문구를 상태 인식형으로.
- **파일**: `uniqn-mobile/app/(employer)/my-postings/[id]/index.tsx` · `uniqn-mobile/app/(app)/(tabs)/employer.tsx` · `uniqn-mobile/src/features/employer/settlements/TodayOpsStrip.tsx` · `uniqn-mobile/src/utils/employerPostingFilter.ts` · `uniqn-mobile/src/repositories/supabase/OpsTournamentRepository.ts` · `uniqn-mobile/src/components/employer/posting/PostingSurfaceState.tsx`
- **위험**: 당일 지표를 허브 상단에 올리면 추가 쿼리가 발생한다 — 이미 realtime 구독이 여러 개 걸린 화면이라 GRID-8·STAFF-18 계열의 N+1 과 겹치지 않는지 확인 필요. TodayOpsStrip 재사용 시 정산 화면과의 중복 마운트를 dedupe 해야 한다.
- **완료 증명**: `npx jest app/(employer)/my-postings/[id]/__tests__/` — 지표 3종이 accessibilityRole='button' + 목적지 포함 label 을 갖는지, completed 대회만 있을 때 배지가 '진행 중' 이 아닌지 단언. `npx jest src/utils/__tests__/employerPostingFilter*.test.ts` — 전 status 를 입력했을 때 버킷 카운트 합 == 전체 단언(현재 어긋남). 성능: buildPostingFacts 호출 횟수를 spy 로 세어 N개 공고에 N회 이하인지 단언(현재 O(N log N)회).

#### W2-7. [L] 지원자 판단·처리 도구 — 점수 하나로 40명을 고르게 하고, 프로필을 열면 결정할 수 없다

- **결함**: APPL-6, APPL-8, APPL-9, APPL-11, APPL-13, APPL-14, APPL-19, APPL-20, APPL-10, CANCEL-7
- **왜**: 대회 D-day 40명을 확정해야 하는데 판단 근거가 점수 숫자 하나뿐이다. 리뷰 본문도 과거 근무 이력도 볼 수 없고(useReceivedReviews 는 구현돼 있으나 구인자 화면 호출처 0곳), 프로필을 열어 판단해도 그 자리에서 확정/거절할 수 없다(모달에 footer·액션 prop 자체가 없다). 검색·정렬도 없다 — filterApplicants(역할 필터+3종 정렬)가 완전 구현돼 있는데 프로덕션 호출처가 0곳이고 테스트에서만 쓰인다. 목록은 300건에서 조용히 잘리고(안내·더보기 없음) 통계·필터 카운트가 잘린 집합으로 계산된다. 정원 마감 거절은 '어느 날짜의 어느 역할' 인지 알려주지 않는데, 클라·서버 둘 다 그 정보를 만들어 놓고 버린다.
- **어떻게**: ① ApplicantProfileModal 에 footer 액션(확정/거절)을 추가 — ConfirmModal 이 이미 쓰는 footer prop 패턴 재사용, 화면의 handleConfirm/handleReject 를 그대로 주입. ② 구현돼 있는 filterApplicants 를 화면에 배선하고 검색 입력 + 정렬 컨트롤을 노출. ③ 카드에 최근 근무 이력 요약(N회 근무·노쇼 M회)과 리뷰 본문 진입점 추가, BubbleScoreBadge 를 Pressable+라벨로. ④ 300건 절단을 명시하고 더보기/페이지네이션 제공, 통계는 절단 전 집합에서 계산. ⑤ 정원 마감 에러 메시지를 서버 상세(`role=% date=% slot=%`)로 조립 — utils/supabase.ts 의 파싱을 추가하면 클라 firstIssue 도 살아난다. ⑥ 취소요청·거절 필터 탭 추가(FILTER_OPTIONS 4→6). ⑦ '같은 날짜엔 하나만' 자동 해제 규칙을 GroupedAssignmentSelector 헤더에 명시.
- **파일**: `uniqn-mobile/src/components/employer/applicants/ApplicantProfileModal.tsx` · `uniqn-mobile/src/components/employer/applicants/ApplicantList.tsx` · `uniqn-mobile/src/components/employer/applicants/ApplicantCard` · `uniqn-mobile/src/hooks/applicant/index.ts` · `uniqn-mobile/src/repositories/supabase/ApplicationRepositoryQueries.ts` · `uniqn-mobile/src/utils/supabase.ts` · `uniqn-mobile/src/components/jobs/AssignmentSelector/GroupedAssignmentSelector.tsx`
- **위험**: 300건 절단 해제는 realtime 재조회 비용을 키운다 — APPL-15(변경 1건마다 300행 전체 재조회) 를 먼저 디바운스/부분갱신으로 고치지 않으면 상황이 나빠진다. 과거 근무 이력 노출은 개인정보 범위 검토 필요.
- **완료 증명**: `npx jest src/components/employer/applicants/__tests__/ApplicantProfileModal*.test.tsx` — 확정/거절 버튼 렌더 및 핸들러 호출 단언. `npx jest src/hooks/applicant/__tests__/useApplicantManagement.test.ts` — filterApplicants 가 프로덕션 경로에서 호출되는지(현재 테스트 전용). `grep -rn "filterApplicants" src/components/ app/` 가 0건이 아니게 되는 것이 배선 증거. 에러 메시지: 정원 초과 RPC 에러를 mock 하고 토스트 문구에 날짜·역할이 포함되는지 단언.

#### W2-8. [L] 근무표 신호 정확도 — 부족 인원이 거짓말을 하고, 그 거짓말이 중복 공고를 유도한다

- **결함**: GRID-2, GRID-3, GRID-5, GRID-6, GRID-14, GRID-13, GRID-11, GRID-12, GRID-8
- **왜**: 근무표의 유일한 가치는 '어느 날 몇 명 부족한가' 인데 그 숫자가 틀린다. ①마감·취소된 공고의 좌석이 계속 합산돼(required CTE 에 status 조건 전무) 끝난 공고 때문에 부족 신호가 영구히 남는다. ②이미 낸 공고의 미충원 좌석이 '부족' 으로 잡히는데 패널의 유일한 조치가 '공고로 모집' 이라 같은 자리에 공고를 두 번 낸다 — 게다가 '+N 공고' 뱃지는 work_logs 기준 COUNT 라 **확정 0명인 갓 낸 공고는 뱃지가 아예 안 뜬다**(뱃지가 필요한 바로 그 상황에서 침묵). ③'필요 인원' 입력칸이 자동 파생 목표를 표시해 사장이 저장한 수동 목표를 볼 수도 낮출 수도 없다. ④월을 넘기면 요약 칩이 전부 0으로 무너지는데 아래 배치 목록에는 실제 인원이 그대로 있다. ⑤100 이상 입력은 아무 말 없이 99로 잘린다(대회 D-day 100명+ 시나리오에서 21명 증발).
- **어떻게**: ① required CTE 에 `jp.status IN ('active','capacity_full')` 필터 추가(마이그레이션). ② 셀에 '공고 있음' 신호를 job_postings 기준으로 다시 계산해 확정 0명 공고도 잡히게 하고, 패널에 해당 공고 목록 + '지원자 보기' 진입점을 추가해 '공고로 모집' 단일 조치를 없앤다. ③ GridDayCell 에 manualTarget 을 별도 필드로 반환해 입력칸이 파생값이 아닌 저장값을 보여주게 한다. ④ 월 이동 시 selectedDate 를 보이는 달로 클램프하거나 셀을 selectedDate 기준으로 조회. ⑤ 클램프 발생 시 토스트로 알리고 서버 상한과 정렬. ⑥ 단가 저장 실패 문구가 서비스의 구체 사유를 덮는 catch 를 isAppError 분기로 교체(대조군이 같은 폴더에 있다). ⑦ 슬롯 출처(공고 확정분 vs 직접 추가)와 소속 공고를 카드에 표시(리포지토리가 이미 반환하는데 투영이 버린다). ⑧ '기타' 역할명 편집 지원. ⑨ 패널의 전기간 무제한 조회를 하루치 경로로 좁힌다(훅이 이미 지원).
- **파일**: `uniqn-mobile/supabase/migrations/20260728130000_grid_required_status_filter.sql` · `uniqn-mobile/src/domains/weeklyGrid/gridSlotState.ts` · `uniqn-mobile/src/domains/weeklyGrid/buildGridCells.ts` · `uniqn-mobile/src/components/weeklyGrid/VenueDayPanel.tsx` · `uniqn-mobile/app/(employer)/weekly-grid.tsx` · `uniqn-mobile/src/components/weeklyGrid/VenueSettingsSheet.tsx` · `uniqn-mobile/src/components/weeklyGrid/EditSlotSheet.tsx` · `uniqn-mobile/src/domains/weeklyGrid/venueDayDetailMapping.ts`
- **위험**: status 필터 추가는 부족 숫자를 갑자기 낮춘다 — 사장님에게는 '어제까지 5명 부족이더니 오늘 0명' 으로 보인다. 배포 노트 필요. jobCount 재계산은 SQL 함수 시그니처 변경이라 파리티 검증 필수(현재 parity 함수 수를 먼저 기록).
- **완료 증명**: `npm run test:db` — supabase/tests/grid_auto_sync_required_count.test.sql 확장: 취소·마감 공고의 좌석이 required 에 합산되지 않는지, 확정 0명 공고가 jobCount 에 잡히는지 pgTAP 단언(둘 다 현재 실패). `npx jest src/domains/weeklyGrid/__tests__/buildGridCells*.test.ts` — manualTarget 이 파생값과 분리 반환되는지. `npx jest src/components/weeklyGrid/__tests__/VenueDayPanel*.test.tsx` — 100 입력 시 클램프 토스트가 값을 언급하는지.

#### W2-9. [L] 스태프측 신뢰 회복 — 지원할 수 없는 공고에 '지원하기' 를 띄우고, 확정 알림을 누르면 '취소되었을 수 있어요' 라고 답한다

- **결함**: STAFF-1(스태프측), STAFF-2(스태프측), STAFF-5(스태프측), STAFF-12(스태프측), SCH-1, STAFF-7(스태프측), STAFF-15(스태프측), STAFF-11(스태프측), STAFF-4(스태프측)
- **왜**: 스태프가 떠나면 사장님 가치도 무너진다. ①거절 이력이 있으면 서버가 재지원을 막는데 화면은 그 사실을 모르고(hasApplied 판정이 rejected 를 제외) '지원하기' 를 띄운다 — 지원서를 다 쓴 뒤 다이얼로그로 실패한다. 게다가 hasApplied 는 `catch { return false }` fail-open 이라 일시적 오류에도 같은 막다른 길이 재현된다. ②확정 알림 딥링크가 현재 표시 월의 일정만 뒤져서, 근무일이 다음 달이면 무조건 '지원이 거절되었거나 취소되어 목록에 없을 수 있어요' 라고 오안내한다 — 앱 신규 진입 시 다음 달 근무는 **항상** 이 문구를 본다. ③같은 세션 두 번째 알림 딥링크는 조용히 무시된다(가드를 false 로 되돌리는 지점이 0곳). ④QR 버튼 라벨이 '오늘 아무 데나 출근중인지' 로 결정돼 다른 현장에서 출근 중이면 오늘 다른 일정에도 '퇴근하기' 로 뜨고, 그 구독은 1회 조회 후 noop 을 반환하는 가짜라 스캔 후에도 영구 stale 이다. ⑤사전질문 카운터가 '1000자' 를 약속하면서 maxLength 가 없다.
- **어떻게**: ① ACTIVE_APPLICATION_STATUSES 에 rejected 를 포함시켜 재지원 불가를 CTA 단계에서 알리고, hasApplied 의 fail-open 을 fail-closed(불확실하면 확인 유도)로 전환. ② 딥링크 판정 시 대상 일정의 월로 캘린더를 자동 이동한 뒤 재조회하고, 그래도 없을 때만 안내 문구. ③ 딥링크 가드를 파라미터 변경 시 리셋. ④ QR 라벨을 전역 isWorking 대신 해당 schedule.status/workLogId 로 결정하고(화면이 이미 갖고 있다) 표시 조건에 날짜 가드 추가. ⑤ 지원 버튼 비활성 사유를 명시(현재 canSubmit 이 3가지 원인을 한 값으로 삼켜 죽은 코드까지 생겼다). ⑥ maxLength 배선. ⑦ 구인자 연락처 노출 규칙을 InfoTab/WorkTab/SettlementTab 3가지에서 하나로 통일. ⑧ 근무 당일 화면에 복장 규정 + 공고 원문 링크 + 탭 가능한 주소.
- **파일**: `uniqn-mobile/src/hooks/useApplications.ts` · `uniqn-mobile/src/repositories/supabase/ApplicationRepositoryQueries.ts` · `uniqn-mobile/app/(app)/(tabs)/schedule.tsx` · `uniqn-mobile/src/utils/scheduleDeepLink.ts` · `uniqn-mobile/src/components/schedule/tabs/WorkTab.tsx` · `uniqn-mobile/src/components/schedule/ScheduleDetailSheet.tsx` · `uniqn-mobile/src/hooks/useWorkLogs.ts` · `uniqn-mobile/src/components/jobs/ApplicationForm.tsx` · `uniqn-mobile/src/components/jobs/PreQuestionForm.tsx`
- **위험**: hasApplied 를 fail-closed 로 바꾸면 네트워크가 불안정할 때 지원 가능한 공고에도 CTA 가 막힌다 — '확인 중' 상태와 재시도를 함께 제공해야 한다. useCurrentWorkStatus 의 가짜 구독을 진짜로 만들면 추가 realtime 채널이 생기므로 구독 수 상한 확인 필요.
- **완료 증명**: `npx jest src/hooks/__tests__/useApplications*.test.ts` — rejected 이력에서 hasApplied 가 true 인지, 조회 실패 시 false 를 단정하지 않는지 단언(수정 전 RED). `npx jest app/(app)/(tabs)/__tests__/schedule*.test.tsx` — 다음 달 일정 딥링크에서 캘린더가 해당 월로 이동하고 오안내 토스트가 뜨지 않는지 단언. `npx jest src/components/schedule/tabs/__tests__/WorkTab*.test.tsx` — 다른 근무가 checked_in 이어도 이 일정의 라벨이 '출근하기' 인지 단언.

#### W2-10. [L] 정산 운영 완성도 — 협의 0원·음수 세후·코드값 CSV·조회 실패를 빈 상태로 위장

- **결함**: SETTLE-1, SETTLE-4, SETTLE-6, SETTLE-13, SETTLE-14, SETTLE-15, SETTLE-19, SETTLE-9
- **왜**: W1 에서 금액 진실원을 정렬한 뒤 남는 것은 '정산을 실제로 굴릴 수 있는가' 다. ①급여 유형 '협의(other)' 는 기본급 0원으로 계산되는데 정산 모달을 안 거쳐도 공고 작성 SalarySheet 가 '협의' 를 `{type:'other', amount:0}` 로 정식 저장하므로 그 공고 전원이 0원이 된다. ②고정 금액 세금이 근무 1건마다 전액 공제되고 클램프가 없어 세후가 음수가 될 수 있다(서버 트리거가 음수를 감지해 admin 에게 urgent 알림을 broadcast 하는 관측은 있지만 예방은 없다). ③세금 '적용 대상' 체크박스가 고정 금액 모드에서 아무 효과가 없는데 '체크된 항목에만 세금이 적용됩니다' 라는 거짓 캡션과 함께 노출된다. ④CSV 가 역할을 DB 코드값('dealer')으로 뱉고 금액 분해·날짜별 행이 없어 세무 증빙으로 못 쓴다(기존 테스트가 `roles:['딜러']` 라는 비현실 픽스처로 결함을 가리고 있다). ⑤지점 정산은 조회 실패를 '정산할 근무가 없어요' 로 위장하고 새로고침 경로도 없다.
- **어떻게**: ①'협의' 선택 시 정산 단계에서 실제 금액 입력을 강제하거나(0원 정산 차단 게이트) 최소한 공고 작성·정산 양쪽에 경고를 노출. ②세후 금액에 `Math.max(0, …)` 클램프 + 고정 세액이 총액을 초과하면 저장 차단, workLog.schema 파싱에 min(0) 추가. ③fixed 모드에서 taxableItems 체크박스를 숨기고 캡션 제거. ④CSV 에 getRoleDisplayName 적용 + 기본급/수당/세금/날짜별 행 추가, 테스트 픽스처를 실데이터 코드값으로 교정. ⑤venue-settlements 에 isError 수신 + ErrorState(onRetry) + RefreshControl(같은 도메인 SettlementList 가 이미 하는 방식). ⑥그룹 카드의 프로필 N+1 을 배치 프리페치로. ⑦근무시간 수정 15분 격자를 5분으로 완화(TimeWheelPicker 기본값이 이미 5).
- **파일**: `uniqn-mobile/src/domains/settlement/SettlementCalculator.ts` · `uniqn-mobile/src/utils/settlement/tax.ts` · `uniqn-mobile/src/domains/settlement/TaxCalculator.ts` · `uniqn-mobile/src/components/employer/settlement/TaxSettingsEditor.tsx` · `uniqn-mobile/src/utils/settlement/settlementExport.ts` · `uniqn-mobile/app/(employer)/venue-settlements.tsx` · `uniqn-mobile/src/components/employer/settlement/GroupedSettlementCard.tsx` · `uniqn-mobile/src/components/employer/settlement/WorkTimeEditor.tsx` · `uniqn-mobile/src/components/employer/order-sheet/sheets/SalarySheet.tsx`
- **위험**: 음수 클램프는 서버 트리거의 negative_settlement_alert 를 무력화한다 — 클램프 대신 저장 차단이 더 안전할 수 있다(관측을 유지). '협의' 0원 차단은 실제로 협의로 운영하는 사장님을 막을 수 있어 정책 확인 필요.
- **완료 증명**: `npx jest src/utils/settlement/__tests__/tax.test.ts` — 고정 세액 > 총액 케이스에서 결과가 음수가 아닌지/차단되는지 단언. `npx jest src/utils/settlement/__tests__/settlementExport.test.ts` — 픽스처를 `roles:['dealer']` 로 교정하면 현재 RED, 한글화 후 GREEN. `npx jest src/domains/settlement/__tests__/helpers.test.ts` — type:'other' 에서 0원 산출 시 경고 플래그가 반환되는지. 수동: venue-settlements 에서 네트워크 차단 후 EmptyState 가 아니라 ErrorState 가 뜨는지.

### W3 — 구조 (별도 세션 필요)

- **목표**: 설계 판단이 선행돼야 하는 항목. 각각 독립 세션에서 계획→구현→검증. W1/W2 의 공용 자산을 전제로 한다.
- **추정**: 항목당 1~2 세션. 우선순위는 ①고정공고 ②RPC/인가 계층 ③디자인 규약 기계 강제 순.

#### W3-1. [L] 고정(fixed) 공고를 1급 시민으로 — work_logs 행 수명 재설계(백로그 M10)

- **결함**: EDIT-3, ORDER-5(허브), STAFF-10(스태프관리), CANCEL-9, QR-6, APPL-12, GRID-4
- **왜**: 홀덤펍 상시 단발 알바가 이 앱의 1차 타깃인데, 고정 공고는 확정 이후 운영 수단이 통째로 없다 — 정산·스태프관리·취소요청·QR·확정해제가 전부 차단되고 7곳의 차단 지점이 실측으로 확인됐다. 근본 원인은 코드 주석에 명확히 기록돼 있다: confirm_application 이 FIXED_SCHEDULE 마커 1행만 INSERT 하고 그걸 되돌리는 코드가 없어 D+1부터 영구 실패한다. 즉 개별 화면을 여는 방식으로는 못 고치고 행 수명 모델을 다시 설계해야 한다. 지금 상태는 '고정 공고로 사람을 뽑을 수는 있는데 그 뒤로는 앱이 아무것도 못 한다' 이고, 이건 타깃 시장의 주력 사용 방식을 사실상 미지원으로 두는 것과 같다.
- **어떻게**: 별도 세션에서: ①FIXED_SCHEDULE 마커 행 대신 실제 근무일별 work_log 를 생성하는 모델을 설계(주 N회 → 어느 날인지가 데이터에 없다는 제약이 핵심 — FixedScheduleInfo 에 요일 정보 자체가 없다). 요일 축을 스키마에 추가할지, 사장이 근무표에서 배정하는 방식으로 갈지 결정. ②전이·정리 RPC 를 정의하고 확정 해제·취소 경로를 열기. ③7개 차단 지점을 순차 해제하며 각 단계마다 pgTAP 게이트. W1/W2 에서는 허브에 '고정 공고는 확정 이후 운영 기능을 준비 중입니다' 안내 한 줄만 넣어 침묵을 없앤다.
- **파일**: `uniqn-mobile/supabase/migrations/` · `uniqn-mobile/src/types/unified/schedule.ts` · `uniqn-mobile/app/(employer)/my-postings/[id]/_layout.tsx` · `uniqn-mobile/src/utils/jobPostingVisibility.ts` · `uniqn-mobile/src/repositories/supabase/ApplicationRepository.ts`
- **위험**: 가장 큰 구조 변경이고 confirm_application·정원 트리거·정산 경로 전반에 파급된다. 기존 고정 공고 데이터의 마이그레이션 경로가 필요하다. 잘못하면 dated 공고까지 회귀시킨다 — 반드시 pgTAP 전체 통과 + parity 함수 수 대조 후 진행.
- **완료 증명**: `npm run test:db` 전량 PASS + parity 함수 수 대조(현재 183 기준, 감소 없어야 함). 신규 pgTAP — 고정 공고에서 확정→확정해제→재확정 사이클이 D+1 에도 성공하는지. `npx jest` 전량. 수동: 고정 공고로 확정한 뒤 정산·스태프관리·QR 3화면이 ErrorState 없이 열리는지.

#### W3-2. [L] 다중 쓰기 RPC 이관 + 서버 인가·가드 계층 정비

- **결함**: CANCEL-4, STAFF-7(스태프관리), SETTLE-10, STAFF-9(스태프관리), STAFF-15(스태프관리), EDIT-9
- **왜**: CLAUDE.md 가 '다중 쓰기는 RPC 필수(지원/취소/출퇴근/정산/역할 변경)' 를 규약으로 못박았는데 4개 경로가 클라이언트 직접 UPDATE 다. 취소 '거절' 은 applications 의 UPDATE 정책에 **WITH CHECK 절 자체가 없고** 지원자 본인도 통과하며 상태전이 인가 트리거도 없다 — 즉 서버 방어선이 사실상 비어 있고 권한 검증이 클라이언트 코드 안에만 있다. 역할 변경은 4단계 read-modify-write 라 이력 유실 경합이 있고 정원 가드·정산완료 가드가 둘 다 없다. 여기에 fail-open 가드 패턴(v_capacity=0 이면 스킵)이 3곳에서 반복돼 무관 날짜·자유 텍스트 시간대·고아 지원서가 가드를 우회한다.
- **어떻게**: 별도 세션에서: ①취소 거절·요청 제출·역할 변경을 RPC 로 이관하고 각각 actor 인가 + 상태 전이 검증을 서버에서 수행. ②applications UPDATE 정책에 WITH CHECK 추가 + 상태전이 인가 트리거 신설. ③fail-open 가드를 화이트리스트로 전환(매칭 슬롯 없음 = 거부). ④일괄 정산은 행 간 불변식이 없어 우선순위 최하 — UX 층(W2)이 먼저다. ⑤리포지토리 공통 `assertAffectedRows` 를 전 쓰기 경로에 강제하고 `npm run check:rpc-migrations` 게이트를 확장해 신규 직접 UPDATE 를 CI 에서 차단.
- **파일**: `uniqn-mobile/supabase/migrations/` · `uniqn-mobile/src/repositories/supabase/ApplicationRepositoryTransactions.ts` · `uniqn-mobile/src/repositories/supabase/ConfirmedStaffRepository.ts` · `uniqn-mobile/src/repositories/supabase/SettlementRepository.ts` · `uniqn-mobile/scripts/check-rpc-migrations.js`
- **위험**: RLS·정책 변경은 조용히 fail-closed 를 만들어 정상 동작을 막을 수 있다(감사가 지적한 '0행 갱신인데 성공 보고' 가 정책 강화 후 대량 발생 가능). W1 의 assertAffectedRows 도입이 **선행 조건** — 그게 없으면 정책 강화의 부작용이 무음으로 숨는다.
- **완료 증명**: `npm run test:db` — 각 RPC 에 대해 owner/워크스페이스멤버/협업자/타인/지원자본인 5역할 매트릭스 pgTAP. `npm run check:rpc-migrations` 확장 규칙이 신규 `.update(` 직접 호출을 잡는지 임시 위반 코드로 RED 확인. parity 함수 수 증가분 기록.

#### W3-3. [L] 디자인·접근성 규약을 기계로 강제 — 영역별 수정은 오히려 불일치를 키운다

- **결함**: EDIT-15, ORDER-13(허브), ORDER-14(허브), ORDER-19(허브), GRID-16, GRID-17, STAFF-19(스태프관리), CANCEL-16, CANCEL-17, CANCEL-18, STAFF-17(스태프측), A11Y-1, A11Y-2, SETTLE-16, SETTLE-17, APPL-17
- **왜**: 아이콘 size 22(화이트리스트 위반)가 레포 전역 18곳, 44px 터치타깃 미달이 8개 영역, raw hex 하드코딩이 5곳(#8B5CF6 은 nativewind-patterns §5 가 명시 금지한 violet 계열), 접근성 role/label 누락이 10곳 이상이다. 결정적으로 이건 **영역 단독 수정 시 오히려 불일치가 커지는** 클래스다 — 감사 자신이 ORDER-19 에서 그렇게 지적했다. 같은 코드베이스 안에 규약을 지키는 대조군이 항상 존재한다(hitSlop={8} 쓰는 곳, accessibilityRole="checkbox" 붙은 곳)는 것은 규율이 사람 기억에 의존하고 있다는 뜻이다.
- **어떻게**: 별도 세션에서: ①레포 전역 일괄 치환 — size 22→20 또는 24, raw hex→토큰, 파괴적/단독 버튼에 min-h-[44px]+hitSlop, 아이콘 전용 버튼에 accessibilityRole+Label. ②ESLint 커스텀 룰로 기계 강제: 아이콘 size 화이트리스트, `className` 내 raw Tailwind 색상(orange-*/violet-* 등) 금지, `dark:` 페어 누락 감지. ③impeccable-design 규칙 문서와 룰을 연결해 신규 위반이 CI 에서 막히게 한다.
- **파일**: `uniqn-mobile/.eslintrc.js` · `uniqn-mobile/eslint-rules/` · `uniqn-mobile/src/components/` · `uniqn-mobile/app/` · `uniqn-mobile/tailwind.config.js`
- **위험**: 대규모 기계 치환은 시각 회귀를 만든다 — size 22→24 는 레이아웃을 밀 수 있다. 영역별로 나눠 커밋하고 스크린샷 대조가 필요하며, 이 항목은 실기기/웹 QA 게이트가 실질적으로 필수다.
- **완료 증명**: `grep -rn "size={22}" src/ app/` 이 0건. `grep -rnE "(orange|violet|purple)-[0-9]" src/ app/ --include=*.tsx` 이 0건. `grep -rnE "#[0-9A-Fa-f]{6}" src/components/ app/ --include=*.tsx` 가 허용 목록 외 0건. `npm run lint` 가 임시 위반 코드에 대해 RED. `npm run quality` 전량 통과.

#### W3-4. [L] 공고 편집 이력·변경 알림 정확도 — 저장할 때마다 새 UUID 를 부여해 지원자 전원에게 알림이 나간다

- **결함**: EDIT-11, EDIT-7, EDIT-6
- **왜**: 검증자가 발견한 증폭기가 핵심이다: `toPostingTimeSlots` 가 저장할 때마다 모든 슬롯·역할에 새 UUID 를 부여하고 그게 JSONB 에 기록되므로, 설명·연락처만 고쳐도 `OLD.schedule IS DISTINCT FROM NEW.schedule` 이 **매번 참**이 되어 지원자 전원에게 '📝 공고 수정 안내' 가 발송된다. 즉 EDIT-6 의 결론(알림 남발)은 맞고 근거는 틀렸다. 여기에 changedFields 가 트리거에서 계산되지만 소비처가 0곳이라 스태프는 '무엇이' 바뀌었는지 모르고, roleCatalog 를 슬롯 역할만으로 재조립해 레거시 공고는 제목만 고쳐도 서버가 '역할 변경' 으로 오판해 전량 거부한다.
- **어떻게**: 별도 세션에서: ①슬롯·역할 id 를 안정 키로 만든다 — 기존 id 가 있으면 보존하고 신규만 생성. 이게 알림 남발의 근본 해소다. ②changedFields 를 알림 본문에 반영해 '무엇이 바뀌었는지' 를 전달하고, 변경 감지 필드 목록에 description·contactPhone·conditions·questions 를 추가할지 결정(현재 누락돼 그 항목만 고치면 알림이 안 간다 — 의도인지 확인 필요). ③roleCatalog 재조립을 합집합 방식으로 되돌리고 서버 판정이 키 개수 비교가 아니라 실제 정체성 비교를 하게 한다. ④편집 이력 화면(W2 의 1세대 스냅샷을 N세대로 확장).
- **파일**: `uniqn-mobile/src/utils/order-sheet/mappers.ts` · `uniqn-mobile/src/utils/order-sheet/serialization.ts` · `uniqn-mobile/src/repositories/supabase/JobPostingRepositorySettlement.ts` · `uniqn-mobile/supabase/migrations/`
- **위험**: id 안정화는 기존 JSONB 구조와의 호환을 깨뜨릴 수 있다 — 슬롯 id 를 참조하는 지원서·work_logs 가 있는지 전수 확인 필요. 알림 필드 목록 변경은 발송량을 바꾸므로 푸시 비용·사용자 피로도 영향 평가 필요.
- **완료 증명**: `npx jest src/utils/order-sheet/__tests__/mappers*.test.ts` — 같은 입력을 두 번 직렬화하면 동일한 JSONB 가 나오는지 단언(현재 매번 다름, 수정 전 RED). `npm run test:db` — description 만 바꾼 UPDATE 가 notifications 를 생성하지 않는지 pgTAP 단언. `npx jest src/components/employer/order-sheet/__tests__/OrderSheetScreen.edit.test.tsx` 회귀.

#### W3-5. [L] QR 출퇴근에 소지 증명 도입 — 지금은 공고ID만으로 재구성 가능하고 무효화 수단이 없다

- **결함**: QR-1
- **왜**: `buildVenueQRString` 이 `JSON.stringify({type:'venue', jobPostingId})` 를 그대로 반환하고 코드 주석 자체가 '생성·만료·갱신 개념이 없다' 고 명시한다. 서버 RPC 시그니처에 토큰·위치 파라미터가 아예 없고 가드는 auth.uid 대조 + 공고 일치 + 날짜 + active + already_settled 뿐이라 **소지 증명이 0** 이다. 즉 공고 상세를 본 사람은 누구나 현장에 오지 않고 출근을 찍을 수 있고, QR 이 유출돼도 무효화할 방법이 없다. 이건 정책·설계 결정이 필요한 항목이지 코드 수정이 아니다.
- **어떻게**: 별도 세션에서 위협 모델을 먼저 정한다 — 홀덤펍 단발 알바에서 현장 부재 출근이 실제 리스크인지, 사장이 QR 을 눈앞에 두고 보여주는 운영이면 회전 토큰만으로 충분한지. 선택지: ①시간 기반 회전 토큰(TOTP 유사) — 서버가 검증, 무효화는 시크릿 회전. ②서명된 단기 토큰 + 서버 클럭 클램프(이미 있음). ③위치 검증(권한·정확도 리스크 큼, 실내 홀덤펍에서 실효성 의문). W1 의 RPC-1 화이트리스트 가드가 선행되어야 이 작업이 의미를 갖는다.
- **파일**: `uniqn-mobile/src/services/work/eventQRService.ts` · `uniqn-mobile/supabase/migrations/` · `uniqn-mobile/app/(employer)/my-postings/[id]/qr.tsx`
- **위험**: 토큰 도입은 오프라인·시계 스큐에서 출근 실패를 만든다 — QR-5 가 지적한 대체 경로(구인자 수동 출근 처리) 안내가 반드시 함께 있어야 한다. 과잉 설계 위험이 크므로 위협 모델 합의 없이 착수 금지.
- **완료 증명**: `npm run test:db` — 만료 토큰·재사용 토큰·타 공고 토큰 3케이스 거부 pgTAP. 회전 후 구 QR 이 거부되는지. 실기기에서 시계를 ±10분 틀어도 정상 출근되는지(클램프 범위 확인).

#### W3-6. [L] 금전 이의제기 채널 — 스태프가 '금액이 다르다' 고 말할 수 있는 곳이 앱에 없다

- **결함**: SETTLE-7, STAFF-13(스태프측), CANCEL-6, SETTLE-14
- **왜**: 스태프 정산 화면 361줄 전체에 Pressable/Button 이 0개이고 'dispute'·'이의제기' 문자열은 src·app 전역 0건이다. 1:1 문의 화면은 존재하지만 정산 컨텍스트(workLogId·계산 스냅샷) 프리필 진입점이 없어 스태프가 상황을 처음부터 설명해야 한다. 임금 문제는 신고 타입에서도 독립 항목이 아니라 '부당한 대우' 안에 묻혀 있다. 취소 요청 거절 후에도 '구인자에게 직접 문의하세요' 라고만 하고 그 경로가 없다. 금전 분쟁이 앱 밖(카카오톡)에서 벌어지면 플랫폼으로서의 신뢰와 기록이 동시에 사라진다.
- **어떻게**: 별도 세션에서: ①정산 상세에 '금액이 다른가요?' 진입점을 추가하고 workLogId + 계산 스냅샷(기본급/수당/세금 분해)을 문의에 프리필. ②사장 쪽에 이의 접수 알림 + 응답 경로. ③수정 이력에 '누가' 를 표시(modifiedBy 는 이미 저장되는데 ModificationHistoryItem 이 참조조차 안 한다 — 이의 처리의 기본 재료). ④신고 타입에 임금 관련 독립 항목 신설 검토. ⑤취소 거절 후 문의 경로 연결(W2 의 CANCEL-6 와 연동).
- **파일**: `uniqn-mobile/src/components/schedule/tabs/SettlementTab.tsx` · `uniqn-mobile/app/(app)/support/create-inquiry.tsx` · `uniqn-mobile/src/components/employer/settlement/ModificationHistoryItem.tsx` · `uniqn-mobile/src/types/report.ts`
- **위험**: 이의제기 채널은 운영 부하를 만든다 — 사장님이 대응할 수 있는 SLA·에스컬레이션 정책 없이 열면 방치된 이의가 쌓여 신뢰가 더 나빠진다. 제품·운영 결정이 코드보다 먼저다.
- **완료 증명**: `grep -rn "이의\|dispute" src/ app/` 이 0건이 아니게 되는 것이 배선 증거. `npx jest app/(app)/support/__tests__/` — 정산에서 진입 시 workLogId 와 금액 분해가 폼에 프리필되는지 단언. `npx jest src/components/employer/settlement/__tests__/` — 수정 이력에 modifiedBy 표시 단언.

## 5. 하지 않을 것

- **실기기 QA 게이트 없이는 판정 불가** — SETTLE-21/CANCEL-19(햅틱 중복·누락), EDIT-16/ORDER-15(허브)/STAFF-16(스태프측)/검증자 `form.watch()` 지적(리렌더 성능), GRID-15(좁은 화면 스크롤 왕복). 전부 '측정 없는 추정' 이거나 실기기에서만 확인 가능하다. 특히 성능 3건은 적대 검증에서 '체감 지연 실측 없음'·'FlashList 라 실제 마운트는 화면분'·'useMemo 안이라 아이덴티티 변경 시에만 실행' 으로 근거가 약화됐다 — 프로파일러 실측을 먼저 하고 수치가 나오면 그때 착수한다. 지금 고치면 회귀 위험만 사는 셈이다.
- **prod 실측 없이 착수 금지** — ①STAFF-3(스태프관리) settlement_breakdown: 마이그레이션 전체에 0건인데 두 곳에서 UPDATE 하고 그 기능은 #319(07-25)까지 실사용·디버깅된 출하 기능이다. 즉 '전량 400 실패' 보다 prod 드리프트일 개연성이 높다. `information_schema.columns` 실측으로 분기가 갈리므로 W1-7 안에서 실측을 선행 조건으로 걸었다. ②EDIT-7(레거시 roleCatalog row)·EDIT-4(잠긴 행이 unset 인 손상 row): 둘 다 '그런 row 가 prod 에 실재하는가' 가 전제인데 미확인이다. 방어 코드는 넣되(W2) 마이그레이션·백필은 실재 확인 후.
- **의도된 설계라 결함이 아님** — ①ORDER-10(주문서, 프리셋 0개일 때 저장 카드 숨김): PresetCarousel.test.tsx:29 가 '프리셋이 없으면 저장 카드는 숨긴다' 를 명시적 의도로 못박고 있고, create-success.tsx 가 프리셋 0개 사용자에게 항상 저장 카드를 띄우므로 대체 경로도 있다. 바꾸려면 테스트가 선언한 의도를 먼저 뒤집는 제품 결정이 필요. ②GRID-4(고정 공고 좌석이 부족 인원 미반영): SQL 주석이 'dated only (fixed 제외)' 로 의도를 명시했고, 더 중요하게는 **구현이 불가능**하다 — FixedScheduleInfo 에 요일 정보가 아예 없어(daysPerWeek 숫자만) 고정 좌석을 특정 날짜에 귀속시킬 데이터가 존재하지 않는다. W3-1(고정 공고 재설계)에서 요일 축을 도입하면 그때 자동 해소된다.
- **신규 기능이라 결함 목록과 분리** — ATT-4(지각·조퇴·결근 자동 판정), SETTLE-20(여러 공고 합산 월간 인건비 화면), STAFF-6(스태프측, 북마크 목록 화면), GRID-10(지점 이름 변경·삭제), GRID-7(인원 다건 추가), GRID-19(월 점프·'오늘로'), SETTLE-9(15분 격자 완화는 W2 에 포함하되 정밀 시각 입력 자체는 별건). 전부 '지금 잘못 동작한다' 가 아니라 '아직 없다' 이고 백로그 M8/M11 범주다. 감사 결과에 섞어두면 결함 189건의 긴급도를 희석시킨다 — 별도 로드맵으로 분리해 제품 우선순위 회의에서 다룬다.
- **W1 결과를 봐야 판단 가능** — SETTLE-10 의 RPC 이관은 W3-2 에 넣었지만 실제 착수 여부는 W2-3(부분 실패 리포터) 이후 재평가한다. 적대 검증이 '행 간 교차 불변식이 없고 상태 가드가 멱등이라 부분 실패가 데이터를 오염시키지 않으며, work_logs UPDATE 는 RLS 로 이미 보호된다' 고 확인했으므로, UX 층을 고치고 나면 규약 위반 이외의 실피해가 남지 않을 수 있다. 규약 준수만을 위해 L 규모 RPC 이관을 하는 것은 사용자 가치 순서에 어긋난다.
- **EDIT-8/EDIT-10/ORDER-8(허브)/STAFF-8(스태프측)/STAFF-9(스태프측)/CANCEL-20/QR-3/QR-4/QR-5/GRID-15/ORDER-16~18(주문서) 등 LOW 21건** — 적대 검증에서 대부분 '대체 경로가 실재해 막다른 길이 아니다'(헤더 fallbackHref, 공고 상세 취소 버튼, 자가 회복되는 재스캔 등)로 영향이 축소 확인됐다. W1/W2 에서 같은 파일을 건드릴 때 곁다리로 처리하는 것이 효율적이고, 이것만을 위한 별도 작업은 만들지 않는다. 단 ORDER-17(주문서, 상한 상수가 정의만 되고 소비처 0곳)은 W2-1 에서 주문서를 손볼 때 함께 배선한다 — 팀이 정한 의도가 코드로 전달되지 않은 상태를 남겨두면 다음 사람이 상한이 없다고 오해한다.

## 6. 영역별 강점 — 회귀 금지

**공고 수정 — 조건·역할·일정·인원 수정 (S3 주문서 편집 경로)**

- 확정 지원자 잠금이 UI와 서버 양쪽에 대칭으로 배선돼 있다 — OrderSheetScreen.tsx:283-298(행 가드)·734-745(상시 배너)·389-394(연쇄 skipKeys) 와 JobPostingRepository.ts:639-647(서버 최종 게이트). 한쪽만 있는 흔한 형태가 아니므로 잠금 범위를 좁힐 때도 이 대칭 구조는 유지해야 한다.
- 대회 공고 편집이 approvalStatus를 건드릴 수 없게 타입 계약으로 봉인돼 있다 — UpdateJobPostingInput에 tournamentConfig가 아예 없고(mappers.ts:526-532 주석), serialization.ts:376-378이 current에서 보존한다. 편집이 재승인 요청으로 오작동하지 않는 구조적 보장이라 리팩터링 시 깨뜨리면 안 된다.
- update 경로가 conditions를 항상 명시 전달한다 — draftAdapter.ts:417 `const conditionsPatch = { conditions: draft.conditions ?? {} };`. patch 시맨틱에서 '전량 해제가 키 부재로 표현되어 조용히 부활'하는 클래스를 정면으로 막은 의도적 설계다(주석 411-416). 축소 payload(447)에도 동일하게 포함돼 있다.
- useUnsavedChangesGuard + markClean() 동기 표식 조합이 '저장 성공했는데 변경사항 저장 안 됨 다이얼로그가 뜨는' 오탐을 제거했다 — edit.tsx:96 주석과 useUnsavedChangesGuard.ts:29-37 `cleanRef`. 저장 경로를 손댈 때 markClean 호출 순서(setIsDirty(false) → markClean() → 이동)를 흔들지 말 것.
- 일정 그룹 삭제에 5초 Undo 토스트가 이미 구현돼 있고, 되돌리기·삭제 양쪽 모두 clearPendingSwap()으로 연쇄 예약 stale을 차단한다 — OrderSheetScreen.tsx:442-481. Undo 패턴의 사내 레퍼런스로 재사용 가치가 높다.
- errorRowTargets/firstUnsetRow가 '어떤 zod 에러도 반드시 한 행으로 흘러간다'를 보장해 죽은 제출 버튼을 구조적으로 막는다 — orderRowMeta.ts errorRowTargets(폴백 다중 배선) + OrderSheetScreen.tsx:676-690(3순위 토스트 폴백). EDIT-4를 고칠 때 이 보장을 깨지 않도록 skipKeys만 추가해야 한다.

**공고 상세 — 운영 허브·당일 운영 (app/(employer)/my-postings/[id] + (app)/(tabs)/employer)**

- 고정 공고 QR 게이트가 진입점 5곳 전수 + 도착지(qr.tsx:72)까지 fail-closed로 막혀 있고, headerQRGate.test.ts가 '새 소비처가 게이트 없이 추가되는' 실패 양식을 소스 구조 검사로 자동 검출한다 — 렌더 테스트로는 못 잡는 결함을 정확히 겨냥한 설계다.
- index.tsx:296 `!(contextIsFixed || isFixed)` — 레이아웃 컨텍스트와 화면 자체 두 소스를 OR로 합산해 로딩 타이밍이 어긋나도 버튼이 깜빡이지 않는다. 주석에 이유까지 남아 있다.
- 확정 인원 표기가 usePostingFilledCounts 전역맵 → extractPostingFilledSubmap 서브맵 추출이라는 단일 키 규약으로 카드·상세·정산·역할변경 모달 전부에서 재사용된다(JobPostingCard.tsx:62-67, settlements.tsx:100-107) — 0/N 드리프트 재발 방지 장치다.
- 삭제 가드가 도메인 셀렉터 isPostingDeletable로 단일화되고, 확정 인원 소스가 '실측(applicantData) 우선 → 모델 fallback' 순서라 실시간 값이 없을 때도 안전한 쪽으로 판정된다(index.tsx:262-264).
- TodayOpsStrip의 a11y 설계 — 정산 배지가 Pressable일 때 요약 accessibilityLabel에서 그 항목을 빼 TalkBack 이중 낭독을 막는다(TodayOpsStrip.tsx:41-44). 이런 수준의 배려는 드물다.
- 공유 차단이 canShareJob 단일 게이트로 runJobShare 한 곳에 모여 있어 죽은 링크(승인대기 대회·마감 공고)가 7개 진입점 전체에서 동일하게 막힌다(useShare.ts:163-169).

**정산 — 금액·시간수정·수당·세금·정산조건**

- 정산 완료 금액 동결 계약이 SSOT 헬퍼로 뽑혀 있다 — `settlementGrouping.ts:54~59 shouldUseFrozenPayrollAmount` 가 `Number.isFinite` 로 0원 완료까지 존중하고 그 이유를 주석으로 남겼으며, `ScheduleCard.tsx:73` 이 이를 공유한다. 이 헬퍼 자체는 절대 건드리지 말고, 오히려 아직 안 쓰는 소비처를 여기에 맞춰야 한다.
- 서버가 클라이언트 금액을 신뢰하지 않는다 — `SettlementRepository.ts:218~230` 이 canonical 금액을 재계산해 저장하고 요청값과 다르면 `logger.warn` 으로 관측을 남긴다. 클라이언트 계산이 틀려도 DB 는 오염되지 않는 구조다.
- 정산 완료 후 변경을 서버에서 fail-closed 로 막고(`:133~135`, `:584~586` AlreadySettledError) 완료 시점 수당 스냅샷을 저장한다(ES-003, `:245~251`, `:459~464`). 공고 급여 설정을 나중에 바꿔도 과거 정산이 소급 변동하지 않는다.
- 자정 넘김 입력 처리가 정교하다 — 종료<시작은 오류가 아니라 자동 익일로 해석하고(`WorkTimeEditor.tsx:239~243`), 0~23 입력의 실제 Date 를 익일로 올리는 `endTimeForSave` 보정(`:251~262`)까지 있으며, 익일·12시간 초과 배너는 비차단이고 `시작==종료` 만 저장을 막는다. `WorkTimeEditor.overnight.test.tsx` 로 회귀가 고정돼 있다.
- '지급 완료로 표시'가 실제 이체가 아님을 세 지점에서 일관되게 고지한다 — 버튼 라벨(`SettlementActionButtons.tsx:90~92`), accessibilityHint(`:86`, `SettlementCard.tsx:177`), 확인 모달 문구(`SettlementModals.tsx:141~144` '실제 이체는 앱 밖에서 진행해요'). QW4 의도가 잘 살아 있다.
- 지점 정산의 폴백 단가를 조용히 넘기지 않는다 — `venue-settlements.tsx:120~134` 가 '기본 단가(시급 15,000원)로 계산됐어요' 배지를 44px 터치 타깃 + accessibilityLabel 과 함께 띄우고, 탭하면 `RoleSalaryField` 시트로 즉시 고쳐 재계산까지 이어진다. 공고 스팬 행에는 거짓 배지가 되지 않도록 `jobPostingId === venueId` 로 좁힌 판단도 정확하다.

**지원자 관리 — 확정·거절·일괄·프로필**

- 확정/취소 다중 쓰기가 전부 RPC(`confirm_application`, `cancel_application_atomically`)로 원자화되어 있고 `FOR UPDATE` + 호출자 바인딩(`auth.uid()` 대조) + 워크스페이스/협업자/admin 인가까지 서버에서 판정한다 — 클라이언트 다단계 뮤테이션이 한 곳도 없다(ApplicationRepositoryTransactions.ts:120-128, 235-241).
- 일괄 확정을 의도적으로 순차 실행하고 그 이유(RPC가 job_postings FOR UPDATE로 직렬화 → 병렬화는 선착순 비결정성만 유발)를 코드 주석으로 고정해 두었다(applicantManagementService.ts:195-197). 되돌리지 말 것.
- 개별 실패를 `BulkConfirmFailure{applicationId, code, reason}` 구조로 격리 수집하는 서비스 계약이 이미 있다(applicantManagementService.ts:43-61) — UI만 붙이면 되는 상태라 서버 재작업이 불필요하다.
- 확정/거절/확정취소/취소요청 승인·거절 알림이 DB 트리거(`notify_on_application_update`)에 단일화되어 있어 클라이언트 경로가 달라져도 알림이 누락되지 않는다(20260710000002_baseline_schema_from_prod.sql:4265-4400).
- 지원자 프로필 배치 프리페치가 Repository 직접 호출이 아니라 훅(useApplicantProfiles) 경유로 캡슐화되어 아키텍처 레이어를 지킨다(ApplicantList.tsx:95, useApplicantProfiles.ts:7-9).
- 확정 이력 타임라인(ConfirmationHistoryTimeline)이 최초 지원 → N차 확정 → 취소를 한 축으로 보여주고, 카드에서도 compact 모드로 재사용된다 — 재확정 이력이 있는 지원자의 맥락 파악에 유일한 자산이다.

**근무표(주간 그리드) — 고정 공고 슬롯 운영**

- 도메인 순수함수 SSOT 분리가 실제로 작동한다 — GRID_BADGE_META(gridBadgeMeta.ts:19-41)를 CalendarCell(:104-119)과 GridBadgeLegend(:14-16)가 공유해 셀 뱃지와 범례가 구조적으로 어긋날 수 없다. 범례 없이는 !/+/✓ 글리프를 못 읽는데 이 연결이 그걸 막고 있다.
- 중첩 RN Modal 회피 패턴(iOS 터치먹통 #186/#188 대응) — 시간 휠 피커와 삭제 확인 패널을 SheetModal의 overlay 슬롯에 단일 렌더한다(EditSlotSheet.tsx:250-303, AddSlotSheet.tsx:358-370). 재발 방지 자산이므로 confirmAction 일원화 리팩터링 시에도 이 구조는 유지해야 한다.
- 콜드스타트 데드엔드 3중 방어 — useEnsureDefaultWorkspace → useEnsureDefaultVenue → selectedVenueId 자기치유 useEffect + 단계별 EmptyState 분기(weekly-grid.tsx:84-123, 209-243). 신규 사장이 '지점 만들기 버튼이 영구 비활성'에 빠지는 경로를 실제로 닫아 놨다.
- write 경계 검증이 한 곳에 모여 있다 — addSlotPayload(TIME_RE 형식·xssValidation·toDateString 정규화, :50-96)와 레포 경계의 assertSlotColor/assertSlotMemo(slotEdit.ts:92-141). 자유 hex·자유 텍스트 시간 입력이 부활할 수 없는 구조다.
- JIT 단가 오노출 게이트 — containerFetched 이전에는 hasRoleSalary 판정을 아예 하지 않아(AddSlotSheet.tsx:219-229) 기존 단가를 기본 드래프트가 덮어쓰는 사고를 막는다. 주석에 그 이유까지 남아 있다.
- 모든 쓰기 훅이 queryKeys.weeklyGrid.all prefix 무효화로 통일돼 있어(useUpdateSlot/useDeleteSlot/useSetVenueSoftTarget/useSetVenueRoleSalary) 부족셀·하루 상세·컨테이너가 한 번에 동기화된다. 무효화 누락형 유령 데이터가 없다.

**스태프 관리 — 확정 인원·역할 변경·직접 추가**

- 정산 완료 건에 대한 가드가 서버·클라 양쪽에 이중으로 걸려 있고 버튼 단계에서 미리 숨긴다 — `canEditTime`/`canCancelNoShow`(ConfirmedStaffCard.tsx:84~97)와 서버의 BUSINESS_ALREADY_SETTLED(ConfirmedStaffRepository.ts:340~344, 460~464)가 짝을 이룬다. 사용자가 막다른 에러를 만나기 전에 UI가 먼저 차단하는 올바른 방향.
- 권한 검증이 클라이언트가 넘긴 jobPostingId 가 아니라 workLog 에서 얻은 값으로만 판정된다(ConfirmedStaffRepository.ts:285~287 주석 '클라이언트가 넘긴 jobPostingId 를 신뢰하면 타 공고 권한으로 우회 가능'). 우회 시나리오까지 주석에 남겨 둔 점이 특히 좋다 — 리팩터 시 절대 되돌리지 말 것.
- 닉네임 검색이 실패를 '결과 0건'으로 흡수하지 않는다 — `SearchErrorNotice` 가 빈 결과보다 먼저 분기하고(AddStaffModal.tsx:238~243), 훅은 `latestRequestId` 로 연타 시 순서 역전까지 막는다(useStaffNicknameSearch.ts:31~52). '실존하는 사용자를 미가입자로 오도'하는 함정을 정확히 겨냥한 설계.
- 커스텀 역할 스태프의 역할 키 정규화(`currentRoleKey`, RoleChangeModal.tsx:190~193)로 본인 역할이 '(마감)'으로 오표기되는 것을 막고, 마감 역할에 warning 배지 + accessibilityHint 까지 붙였다(70~79, 117~120행). 접근성 힌트가 상태 이유까지 설명하는 드문 사례.
- 수동 상태 변경 시 타임스탬프 정합을 맞추는 `buildStatusTimestampPatch` 가 순수 함수로 분리·export 되어 테스트 가능하고, '정산 게이트가 status 가 아닌 타임스탬프로 판정한다'는 근거가 주석에 남아 있다(ConfirmedStaffRepository.ts:67~93, 506~509). ※ 데이터 삭제 문제(STAFF-2)는 이 설계가 아니라 SCHEDULED 케이스의 정책 선택 문제다.
- AddStaffModal 이 모달 숨김 시 검색 결과·선택된 인물(PII)을 전량 리셋하고(89~93행), 날짜 오버레이가 열린 동안 Android 하드웨어 백을 소비해 부모 시트가 통째로 닫히는 회귀를 막는다(98~105행). 중첩 RN Modal iOS 터치 먹통 회피(overlay 패턴)도 함께 지켜지고 있다.

**스태프측 — 공고 탐색·지원·내 일정·근무 상세**

- 오프라인 크리티컬 캐시가 스케줄 전 경로에 배선되어 있다 — `useCachedSchedulePayload` + `setCriticalOfflineCache`(hooks/useSchedules.ts:88-100, 145-149, 262-266)로 지하 홀덤펍·지하철에서도 근무 일정이 열린다. 스키마 버전(`SCHEDULE_CACHE_SCHEMA_VERSION = 3`)까지 관리 중이므로 캐시 형태를 바꿀 때 반드시 함께 올려야 한다.
- 부분 실패를 삼키지 않는다 — `Promise.allSettled` 로 work_logs/applications 를 따로 받고 한쪽만 실패하면 경고를 만들어(services/work/scheduleService.ts:387-428) 화면에 `accessibilityRole="alert"` 배너로 노출한다(schedule.tsx:666-679). 일정 일부가 빠진 캘린더를 정상으로 오인하지 않게 하는 핵심 방어라 제거 금지.
- iOS 중첩 모달 회피 패턴이 정교하다 — `closeSheetThen` + `pendingActionRef` 재진입 차단 + `useFocusEffect` 블러 시 예약 취소(ScheduleDetailModal.tsx:161-191), QR 이동도 같은 규약(schedule.tsx:591-614). 실기기에서 얻은 대가라 리팩터링 시 통째로 보존해야 한다.
- 확정 인원 hydrate 키가 카드·상세·지원폼에서 단일 규칙이다 — `${date}__${slotHydrateKey(slot)}__${roleHydrateKey(role)}`(postingSurfaceModel.ts:466, AssignmentSelector.tsx:70-74). 덕분에 목록에서 본 '남은 자리'와 지원 화면 숫자가 어긋나지 않는다.
- 그룹 날짜 요약의 분자를 '일별 확정의 최대값'으로 고정하고 그 이유까지 주석으로 못박아 뒀다(postingSurfaceModel.ts:300-354). 과거 범위합산 과다집계 회귀를 막는 장치라 합·평균으로 되돌리면 안 된다.
- 지원 제출의 중복 방지가 이중으로 걸려 있다 — `submitInFlightRef` 더블탭 가드(apply.tsx:99-100, 132-135)와 제출 직전 `staleTime: 0` 최신 공고 재조회(:145-164). STAFF-14 는 이 구조 자체가 아니라 catch 처리만 고치면 된다.

**취소 요청 — 스태프 요청 · 사장 승인**

- 승인 경로가 `cancel_application_atomically` 단일 RPC로 원자화되어 있다 — `FOR UPDATE` 행 잠금 → 멱등 반환 → 체크인 가드(`staff_already_checked_in`) → work_logs DELETE 후 좌석 트리거로 filled 재계산 → closed(비만료) 재개 순서가 명시적이다. 이 순서(20260718000000 §7 'DELETE-먼저 재배열')는 절대 건드리면 안 된다.
- 취소요청 알림 수신자가 owner ∪ 워크스페이스 owner/멤버 ∪ 공고 협업자로 확장되고 신청자 본인은 `IS DISTINCT FROM` 으로 제외된다(20260711030000). 대회사 운영팀처럼 여러 명이 한 공고를 보는 구조에 맞는 설계다.
- 거절 알림이 `priority='high'` + 본문에 거절 사유를 직접 끼워 넣는다(baseline notify_on_application_update). '출근 의무가 살아났다'는 신호를 알림 레벨로 구분한 것은 옳다.
- 거절 사유 모달이 `footer` prop 으로 액션을 분리해 키보드/오버플로 회귀를 막고, `isProcessing` 중복 제출을 차단한다(CancellationRequestCard.tsx:118-125). EF-CAN-2 회귀 테스트가 이 계약을 고정하고 있으니 mock 계약까지 함께 유지할 것.
- 대타 글 생성·아카이브가 best-effort non-blocking 이고, 생성 실패는 `CancellationResult.substitutePost` 로 UI까지 보고돼 토스트로 안내된다(applicationService.ts:238-259, schedule.tsx:453-458). 서비스가 UI 의존성을 갖지 않으면서 부수효과 상태를 전달하는 좋은 패턴.
- 입력 검증이 `cancellationRequestSchema`/`reviewCancellationSchema` 단일소스이고 둘 다 `xssValidation` refine + 길이 경계를 갖는다(application.schema.ts:110-146). 서버측 repository 에도 동일 길이 가드가 이중으로 있다.

**QR·출퇴근 — 스캔·출근시간 관리**

- 출퇴근 쓰기가 단일 RPC(process_qr_checkin_atomically)로 원자화돼 있다 — work_log 와 job_posting 을 FOR UPDATE 로 잠그고 'auto' 액션을 서버가 현재 status 로 해소해 TOCTOU 를 없앴다. 클라이언트 다단계 뮤테이션이 없다.
- 클라 시각 조작 방어가 서버에 있다 — p_check_time 이 서버 now() 와 300초 이상 어긋나면 서버 시각으로 클램프한다(20260711030100 마이그레이션). 정산액 부풀리기를 막는 지점이라 건드리면 안 된다.
- 자정 넘김 근무 대응이 세밀하다 — findQRCandidates 가 today/yesterday/FIXED_SCHEDULE 를 한 쿼리로 조회하고(WorkLogRepository.ts:473~478), p_expected_date 로 오늘 날짜를 고정하지 않고 선택된 work_log 자신의 date 를 넘겨 RPC 의 date_mismatch 가드를 통과시킨다(eventQRService.ts:189).
- selectWorkLogForQR 이 부수효과 없는 순수 함수이고, 순환 거리·'이미 시작 우선'·id 오름차순 타이브레이크로 결과가 결정적이다(배열 순서 무보장 문제를 명시적으로 처리). 테스트도 함께 있다.
- 시간 수정 경로의 감사·알림 배선이 완성돼 있다 — assertWorkTimeReason 의 XSS 검증 + appendWorkTimeModification 이력 append 가 DB 트리거(notify_on_work_log_update)를 발화시켜 스태프에게 변경 알림이 나간다. 정산 재계산도 settlement_breakdown=null 로 무효화한다.
- 사장 화면의 실시간 반영이 실제로 동작한다 — work_logs 가 supabase_realtime publication 에 포함되고(baseline_platform_glue.sql:147), useConfirmedStaff(realtime:true) 구독이 스태프 QR 스캔 즉시 목록과 TodayOpsStrip('출근 N/M')을 갱신한다. 구독 채널은 refCount 로 dedup 된다.

**공고 작성 — 주문서(order-sheet) 연쇄 입력**

- 연쇄 입력의 무한 재오픈이 구조적으로 차단돼 있다 — `nextUnsetRowAfter`가 current 다음 위치부터 **순환** 순회하고 한 바퀴 돌면 null을 반환하며(orderRowMeta.ts:609-628), 시트와 행이 1:N인 지점(시간·역할 두 행 ↔ ScheduleSlotsSheet 하나)은 `coveredKeys=SLOTS_SHEET_ROWS`로 함께 소비한다(OrderSheetScreen.tsx:80, :1055). 확인 후에도 unset인 값(금액 0 등)에서의 재오픈 루프까지 같은 장치로 막힌다 — 회귀 시 orderRowMeta.chain.test.ts가 잡는다.
- 제출 버튼이 죽는 경로가 3단 폴백으로 봉쇄돼 있다 — `firstUnsetRow` → `errorRowTargets`[0] → 토스트 순으로 흘러가고(OrderSheetScreen.tsx:676-690), `errorRowTargets`는 zodResolver가 내는 배열/루트/중첩 어떤 형상이든 최소 한 행으로 떨어뜨린다(orderRowMeta.ts:117-177). 행 unset 판정과 zod superRefine이 같은 술어(`isSlotTimeSet`·by_role 커버 키 규칙 `other:customRole`)를 공유해 "라벨은 이대로 등록인데 눌러도 무반응"이 재발할 수 없다.
- 확정 지원자 잠금이 UI·연쇄·서버 세 층에서 정렬돼 있다 — `guardScheduleLock`이 일정·역할 행 탭을 막고(OrderSheetScreen.tsx:287-298), 잠금 차단 시 `updateChainSwapping(false)`로 딤 고착(화면 전체가 어두운 데드엔드)까지 걷어내며(:310-313), 연쇄 순회는 `skipKeys`로 잠긴 행을 아예 후보에서 제외해 누른 적 없는 경고 토스트가 뜨지 않는다(orderRowMeta.ts:604-607).
- 일정 그룹 삭제가 Undo 규율을 제대로 지킨다 — 즉시 제거 + 5초 되돌리기 토스트 + 깊은 복사 스냅샷(dates·timeSlots·roles 3중, OrderSheetScreen.tsx:452-456)이고, 삭제·복원 양쪽에서 `clearPendingSwap()`을 호출해 대기 중인 연쇄 예약의 groupIndex가 stale해지며 phantom 시트가 뜨는 경로까지 닫아 뒀다(:447, :468).
- 역할 인원 편집기의 편집 상태 오염이 이중 식별자로 차단돼 있다 — `editing`이 `{ key, index }`를 **둘 다** 들고 둘 다 일치할 때만 커밋한다(RoleCountEditor.tsx:66, :108-114). key는 행 승계 시 다른 역할에 값이 커밋되는 것을, index는 rowKeyOf가 같은 중복 행끼리 편집 텍스트를 덮어쓰는 것을 각각 막는다. 같은 규율이 ScheduleSlotsSheet의 안정 slotId(:65-75)에도 적용돼 펼친 슬롯 삭제 시 상태 누수가 없다.
- 시트가 RN 중첩 Modal(#186/#243/#244)을 구조적으로 회피한다 — 시간 휠은 SheetModal의 `overlay` 슬롯에 embedded로 얹고(ScheduleSlotsSheet.tsx:135-156, WorkConditionSheet.tsx:83-98), 지역 선택은 RegionTaxonomyBrowser 인라인 렌더(PlaceSheet.tsx:203-227), 사전질문 답변유형은 ActionSheet 대신 인라인 라디오(PreQuestionsSheet.tsx:108-138)다. 연쇄 스왑도 딤 + 지연 마운트로 겹침을 피하고 호스트(create.tsx)가 StackHeader까지 한 장으로 덮는다.

## 7. 전체 결함 목록

| 심각도 | 영역 | ID | 제목 | 위치 | 판정 |
|---|---|---|---|---|---|
| CRITICAL | 정산 | SETTLE-2 | 보장시간(guaranteedHours)이 수당 배지로는 보이는데 금액 계산에는 전혀 반영되지 않는다 | `src/domains/settlement/SettlementCalculator.ts:126` | CONFIRMED/deep |
| CRITICAL | 정산 | SETTLE-3 | '지급 완료로 표시'를 되돌리는 경로가 앱 어디에도 없고, 완료 후 시간·금액 수정도 서버가 막는다 | `src/hooks/useSettlement.ts:454` | CONFIRMED/deep |
| CRITICAL | 지원자 관리 | APPL-1 | 부분 확정하면 나머지 지원 일정이 지워지고, 확정 해제해도 복구되지 않는다 | `src/repositories/supabase/ApplicationRepositoryTransactions.ts:127` | CONFIRMED/deep |
| CRITICAL | 스태프 관리 | STAFF-1 | 실시간 구독이 실패하면 '불러오는 중' 스피너에 영구히 갇힌다 — ErrorState·재시도 경로 없음 | `src/hooks/useConfirmedStaff.ts:375` | CONFIRMED/deep |
| CRITICAL | 취소 요청 | CANCEL-1 | 취소 승인 직후 지원서가 파싱 실패로 양쪽 목록에서 조용히 증발한다 (RPC snake_case ↔ Zod camelCase) | `src/schemas/application.schema.ts:234` | CONFIRMED/deep |
| CRITICAL | 취소 요청 | CANCEL-2 | 사장님의 '확정 해제' 버튼이 항상 '취소 권한이 없습니다'로 실패한다 (actorType 누락) | `src/hooks/applicant/useStaffConversion.ts:66` | CONFIRMED/deep |
| CRITICAL | QR·출퇴근 | SET-1 | 정산 화면의 '시간 수정'은 status를 갱신하지 않아 정산이 영구 거부된다(완전한 막다른 길) | `src/repositories/supabase/SettlementRepository.ts:151` | CONFIRMED/deep |
| HIGH | 공고 수정 | EDIT-1 | 편집 도중 확정이 발생하면 이미 입력한 일정·역할 변경이 성공 토스트와 함께 조용히 버려진다 | `app/(employer)/my-postings/[id]/edit.tsx:91` | DOWNGRADED/deep |
| HIGH | 공고 수정 | EDIT-2 | 공고 수정에 낙관적 잠금이 없어 협업자 두 명이 동시에 저장하면 뒤에 저장한 쪽이 앞의 변경을 통째로 덮어쓴다 | `src/repositories/supabase/JobPostingRepository.ts:668` | DOWNGRADED/deep |
| HIGH | 공고 수정 | EDIT-3 | 확정 스태프 1명이면 공고 전체의 날짜·시간·역할이 영구 동결되고, 증원·일정 추가 대안 경로가 어디에도 없다 | `src/repositories/supabase/JobPostingRepository.ts:639` | CONFIRMED/deep |
| HIGH | 정산 | SETTLE-1 | 급여 유형 '협의(other)' 선택 시 기본급이 0원으로 계산되는데 아무 경고도 없다 | `src/domains/settlement/SettlementCalculator.ts:108` | DOWNGRADED/deep |
| HIGH | 정산 | SETTLE-4 | 고정 금액 세금이 근무 1건마다 전액 공제되고 상한이 없어 세후 금액이 음수가 될 수 있다 | `src/utils/settlement/tax.ts:41` | DOWNGRADED/deep |
| HIGH | 정산 | SETTLE-5 | 정산 완료 건 금액이 목록(동결값)과 상세 모달(현재 설정 재계산)에서 서로 다르게 보인다 | `src/components/employer/settlement/SettlementDetailModal/SettlementDetailModal.tsx:102` | CONFIRMED/deep |
| HIGH | 정산 | SETTLE-8 | 0원으로 정산 완료된 건에서 스태프는 '확정 금액'을 못 보고 재계산된 다른 금액을 본다 | `src/components/schedule/tabs/SettlementTab.tsx:348` | CONFIRMED/deep |
| HIGH | 지원자 관리 | APPL-7 | 확정/거절 모달이 전송과 동시에 닫혀 실패 시 입력한 사유가 통째로 날아간다 | `app/(employer)/my-postings/[id]/applicants.tsx:155` | CONFIRMED/deep |
| HIGH | 근무표(주간 그리드) | GRID-1 | 근무 수정 시트가 사장이 입력한 적 없는 종료시각(02:00)을 무조건 저장하고, 그 값이 정산 금액 계산에 그대로 쓰인다 | `src/components/weeklyGrid/EditSlotSheet.tsx:90` | DOWNGRADED/deep |
| HIGH | 근무표(주간 그리드) | GRID-3 | 이미 낸 공고의 미충원 좌석이 '부족'으로 잡히는데 패널의 유일한 조치가 '공고로 모집'이라, 사장이 같은 자리에 공고를 두 번 낸다 | `src/components/weeklyGrid/VenueDayPanel.tsx:272` | CONFIRMED/deep |
| HIGH | 근무표(주간 그리드) | GRID-5 | 마감·취소·초안 공고의 좌석까지 부족 인원에 합산돼, 끝난 공고 때문에 부족 신호가 영구히 남는다 | `supabase/migrations/20260719100000_grid_tournament_inclusion_reject_filter.sql:52` | CONFIRMED/deep |
| HIGH | 스태프 관리 | STAFF-10 | 고정(fixed) 공고는 확정 스태프 관리 화면 전체가 차단 — 노쇼·출근·제거·역할변경 경로가 통째로 없다 | `app/(employer)/my-postings/[id]/settlements.tsx:147` | CONFIRMED/deep |
| HIGH | 스태프 관리 | STAFF-11 | '새로고침' 버튼과 pull-to-refresh 가 이 화면에서 완전한 no-op — 아무 반응이 없다 | `src/hooks/useConfirmedStaff.ts:310` | CONFIRMED/deep |
| HIGH | 스태프 관리 | STAFF-2 | '출근 예정으로 변경'이 출퇴근 기록(check_in_ts/check_out_ts)을 확인·이력·되돌리기 없이 영구 삭제한다 | `src/repositories/supabase/ConfirmedStaffRepository.ts:83` | DOWNGRADED/deep |
| HIGH | 스태프 관리 | STAFF-3 | 근무 시간 수정이 스키마에 존재하지 않는 컬럼(settlement_breakdown)을 UPDATE 한다 | `src/repositories/supabase/ConfirmedStaffRepository.ts:366` | DOWNGRADED/deep |
| HIGH | 스태프 관리 | STAFF-4 | 역할 변경 성공 토스트가 서버 결과와 무관하게 먼저 뜨고, 실패해도 '변경되었습니다'가 남는다 | `src/features/employer/settlements/useStaffSettlementsHandlers.ts:64` | CONFIRMED/deep |
| HIGH | 스태프 관리 | STAFF-6 | '스태프에게 알림이 발송됩니다' 문구가 사실이 아니다 — 역할 변경 알림 트리거가 존재하지 않는다 | `src/components/employer/applicants/RoleChangeModal.tsx:319` | CONFIRMED/deep |
| HIGH | 스태프 관리 | STAFF-7 | 역할 변경이 RPC 없이 클라 read-modify-write 로 처리된다 — 이력 유실 경합 + 정원 가드 부재 | `src/repositories/supabase/ConfirmedStaffRepository.ts:278` | CONFIRMED/deep |
| HIGH | 스태프측 | STAFF-1 | 거절된 지원은 화면 어디에도 안 보이는데 재지원은 서버가 막는다 — 지원서를 다 쓴 뒤에야 알게 되는 막다른 길 | `src/repositories/supabase/ApplicationRepository.ts:249` | DOWNGRADED/deep |
| HIGH | 스태프측 | STAFF-2 | 확정 알림을 눌렀는데 '거절되었거나 취소되어 목록에 없을 수 있어요' — 근무일이 이번 달이 아니면 무조건 오안내 | `app/(app)/(tabs)/schedule.tsx:491` | CONFIRMED/deep |
| HIGH | 스태프측 | STAFF-3 | 정산 탭 '총 정산 금액'이 동결값을 무시하고 재계산 — 카드 금액·시트 총액·확정 금액이 서로 다른 숫자 | `src/components/schedule/tabs/SettlementTab.tsx:126` | CONFIRMED/deep |
| HIGH | 취소 요청 | CANCEL-12 | 대타 구인 글이 기본 ON + 취소 사유 원문을 공개 게시판에 그대로 올리고, 사장 승인 전에 이미 공개된다 | `src/components/applications/CancellationRequestForm.tsx:62` | UPGRADED/deep |
| HIGH | 취소 요청 | CANCEL-3 | 취소 단위는 '지원서 전체(모든 확정 일자)'인데 양쪽 UI가 첫 일정 1건만 보여준다 | `src/components/employer/applicants/CancellationRequestCard.tsx:176` | CONFIRMED/deep |
| HIGH | 취소 요청 | CANCEL-4 | 취소 요청 '거절'만 RPC를 안 쓰고 클라이언트 직접 UPDATE — 서버측 권한·상태 가드가 없다 | `src/repositories/supabase/ApplicationRepositoryTransactions.ts:393` | CONFIRMED/deep |
| HIGH | 취소 요청 | CANCEL-6 | 한 번 거절당하면 재요청이 영구 차단되고 대안 연락 경로가 앱에 없다 (완전한 막다른 길) | `app/(app)/(tabs)/schedule.tsx:411` | CONFIRMED/deep |
| HIGH | 취소 요청 | CANCEL-9 | 고정공고는 확정 이후 취소 경로가 스태프·사장 양쪽 모두 0 — 확정이 영구 고정된다 | `app/(employer)/my-postings/[id]/cancellation-requests.tsx:143` | CONFIRMED/deep |
| HIGH | QR·출퇴근 | ATT-1 | '출근 예정으로 변경'이 실제 출퇴근 시각을 확인·되돌리기·이력·알림 없이 삭제한다 | `src/repositories/supabase/ConfirmedStaffRepository.ts:83` | DOWNGRADED/deep |
| HIGH | QR·출퇴근 | ATT-2 | 사장님의 수동 출근/퇴근 처리에 감사 로그가 전혀 남지 않는다(시간 수정 경로와 비대칭) | `src/repositories/supabase/ConfirmedStaffRepository.ts:518` | CONFIRMED/deep |
| HIGH | QR·출퇴근 | QR-1 | 출퇴근 QR에 비밀값이 없다 — 공고ID만으로 재구성되어 현장 부재 출근을 막지 못하고 무효화 수단도 없다 | `src/services/work/eventQRService.ts:229` | CONFIRMED/deep |
| HIGH | QR·출퇴근 | QR-2 | 실패 후 재스캔이 5초 throttle에 무음으로 먹히는데 화면은 '스캔 완료!' 초록으로 바뀐다(거짓 성공) | `src/hooks/useQRCode.ts:61` | CONFIRMED/deep |
| HIGH | QR·출퇴근 | RPC-1 | 서버 출근 가드가 no_show/cancelled/completed를 막지 않는다 — 노쇼 처리를 스태프가 되돌릴 수 있다 | `supabase/migrations/20260711030100_qr_checkin_server_time_clamp.sql:78` | CONFIRMED/deep |
| HIGH | QR·출퇴근 | SCH-1 | 'QR 코드로 출근/퇴근하기' 라벨이 그 일정이 아니라 '오늘 아무 데나 출근중인지'로 결정되고, 갱신도 되지 않는다 | `src/components/schedule/ScheduleDetailSheet.tsx:254` | CONFIRMED/deep |
| HIGH | 공고 작성 | ORDER-1 | 작성 중 이탈·OS 킬·웹 탭 종료 시 주문서 입력 전량 소실 — 로컬 임시저장 부재 | `app/(employer)/my-postings/create.tsx:70` | CONFIRMED/deep |
| HIGH | 공고 작성 | ORDER-2 | 시트 백드롭 1탭이 확인 없이 시트 내 전 편집을 폐기 — 시간·역할/사전질문에서 최대 손실 | `src/components/ui/SheetModal.tsx:360` | CONFIRMED/deep |
| HIGH | 공고 작성 | ORDER-3 | 프리셋 카드 1탭이 확인·Undo 없이 주문서 전체를 덮어쓴다 | `src/components/employer/order-sheet/OrderSheetScreen.tsx:568` | CONFIRMED/deep |
| HIGH | 공고 작성 | ORDER-5 | 공고 등록 실패 시 에러 토스트가 2개 뜨고 그중 하나가 원시 error.message | `app/(employer)/my-postings/create.tsx:218` | CONFIRMED/deep |
| HIGH | 공고 작성 | ORDER-6 | 급구(urgent) 7일 창이 어느 쓰기 경로에서도 검증되지 않는다 — 타입 전환으로 우회 가능 | `src/schemas/orderSheet.schema.ts:247` | CONFIRMED/deep |
| MEDIUM | 공고 수정 | EDIT-11 | 공고 수정에 이력도 되돌리기도 없다 — 잘못 저장한 순간 이전 내용은 앱 어디에서도 복구할 수 없다 | `src/repositories/supabase/JobPostingRepository.ts:665` | CONFIRMED/spot |
| MEDIUM | 공고 수정 | EDIT-12 | 같은 잠금을 설명하는 문구가 네 곳에서 네 가지이고, 어느 것도 '그럼 어떻게 해야 하는지'를 말하지 않는다 | `src/components/employer/order-sheet/OrderSheetScreen.tsx:742` | CONFIRMED/spot |
| MEDIUM | 공고 수정 | EDIT-4 | 잠긴 행이 미설정 상태인 레거시 공고는 저장 버튼이 영원히 '…부터 선택하기'이고 눌러도 경고 토스트만 떠 아무것도 저장할 수 없다 | `src/components/employer/order-sheet/OrderSheetScreen.tsx:693` | DOWNGRADED/deep |
| MEDIUM | 공고 수정 | EDIT-5 | 마감·취소·만료된 공고도 수정 화면에 그대로 들어가지고, 편집 화면 어디에도 그 상태가 표시되지 않는다 | `app/(employer)/my-postings/[id]/edit.tsx:53` | DOWNGRADED/deep |
| MEDIUM | 공고 수정 | EDIT-6 | 수정 시 지원자·확정 스태프 전원에게 알림이 나가는데 사장님에게는 그 사실도 대상 수도 안 보이고, 스태프가 받는 알림은 '무엇이' 바뀌었는지 말하지 않는다 | `supabase/migrations/20260710000002_baseline_schema_from_prod.sql:5052` | DOWNGRADED/deep |
| MEDIUM | 공고 수정 | EDIT-7 | roleCatalog를 슬롯 역할만으로 재조립해, 레거시 카탈로그 공고는 제목만 고쳐도 서버가 '역할 변경'으로 오판해 전량 거부한다 | `src/utils/order-sheet/mappers.ts:102` | CONFIRMED/spot |
| MEDIUM | 공고 수정 | EDIT-9 | 대기중(applied) 지원자는 잠금 판정에 전혀 반영되지 않아, 지원서가 가리키는 시간·역할을 경고 없이 바꿔 지원서를 고아로 만든다 | `app/(employer)/my-postings/[id]/edit.tsx:54` | CONFIRMED/spot |
| MEDIUM | 공고 상세 | ORDER-1 | 운영 허브에 '오늘 출근 X/Y'와 '정산 대기 N'이 없다 — 당일 운영 지표가 전부 한 화면 안쪽에 숨어 있다 | `app/(employer)/my-postings/[id]/index.tsx:442` | DOWNGRADED/deep |
| MEDIUM | 공고 상세 | ORDER-10 | 공유 실패가 조용히 삼켜진다 — 눌러도 아무 일도 안 일어난 것처럼 보인다 | `src/hooks/useShare.ts:220` | CONFIRMED/spot |
| MEDIUM | 공고 상세 | ORDER-11 | 라이브 운영 배지가 이미 끝난 대회에도 '진행 중'이라고 표시한다 | `app/(employer)/my-postings/[id]/index.tsx:572` | CONFIRMED/spot |
| MEDIUM | 공고 상세 | ORDER-12 | 허브 지표 숫자가 탭할 수 없고 스크린리더에 6조각으로 흩어져 읽힌다 | `app/(employer)/my-postings/[id]/index.tsx:443` | CONFIRMED/spot |
| MEDIUM | 공고 상세 | ORDER-13 | 목록 카드의 공유·QR·마감·재오픈 버튼이 28~30px로 WCAG 44px에 미달하고 hitSlop도 없다 | `src/components/employer/posting/JobPostingCard.tsx:100` | CONFIRMED/spot |
| MEDIUM | 공고 상세 | ORDER-14 | 허브 아이콘에 보라(#8B5CF6)·파랑(#3B82F6) 하드코딩 — 팔레트 규칙 위반이고 같은 개념이 목록 화면과 다른 색이다 | `app/(employer)/my-postings/[id]/index.tsx:561` | CONFIRMED/spot |
| MEDIUM | 공고 상세 | ORDER-15 | 목록 정렬이 비교마다 buildPostingFacts 를 재계산한다 — 공고가 늘수록 탭 전환이 눈에 띄게 느려진다 | `app/(app)/(tabs)/employer.tsx:218` | CONFIRMED/spot |
| MEDIUM | 공고 상세 | ORDER-2 | 허브에 마감·재오픈 액션이 아예 없고, '공고 수정' 설명은 '상태를 수정합니다'라고 거짓 안내한다 | `app/(employer)/my-postings/[id]/index.tsx:544` | DOWNGRADED/deep |
| MEDIUM | 공고 상세 | ORDER-3 | 마감·재오픈이 실패해도 필터 탭이 전환돼 성공한 것처럼 보인다 (onSettled 오용) | `app/(app)/(tabs)/employer.tsx:277` | DOWNGRADED/deep |
| MEDIUM | 공고 상세 | ORDER-4 | 공고 상태(마감·만료·취소)와 무관하게 동일한 관리 카드가 노출된다 — 끝난 공고에서도 '지원자 대기중'을 권한다 | `app/(employer)/my-postings/[id]/index.tsx:497` | DOWNGRADED/deep |
| MEDIUM | 공고 상세 | ORDER-5 | 고정(fixed) 공고는 확정 이후 운영 수단이 전부 사라지는데 이유 설명이 없다 | `app/(employer)/my-postings/[id]/index.tsx:510` | DOWNGRADED/deep |
| MEDIUM | 공고 상세 | ORDER-6 | 목록에서 한 공고를 마감하는 동안 모든 카드의 마감/재오픈 버튼이 '처리중...'으로 잠긴다 | `app/(app)/(tabs)/employer.tsx:424` | CONFIRMED/spot |
| MEDIUM | 공고 상세 | ORDER-7 | 승인대기·임시저장·만료·취소 공고는 어떤 필터 탭에도 잡히지 않아 탭 카운트 합이 전체와 어긋난다 | `src/utils/employerPostingFilter.ts:16` | CONFIRMED/spot |
| MEDIUM | 공고 상세 | ORDER-9 | 당겨서 새로고침·재시도가 실패하면 아무 피드백 없이 미처리 Promise 거부만 남는다 | `app/(employer)/my-postings/[id]/index.tsx:231` | CONFIRMED/spot |
| MEDIUM | 정산 | SETTLE-10 | 일괄 정산이 RPC 없이 클라이언트에서 N회 개별 UPDATE — 부분 실패 시 재시도·롤백 경로가 없다 | `src/repositories/supabase/SettlementRepository.ts:391` | DOWNGRADED/deep |
| MEDIUM | 정산 | SETTLE-11 | 그룹 카드 체크박스가 정산 불가 건(완료·출퇴근 미완료)까지 선택해 서버 실패를 자초한다 | `src/components/employer/settlement/GroupedSettlementCard.tsx:278` | CONFIRMED/spot |
| MEDIUM | 정산 | SETTLE-12 | 필터를 바꾸면 '선택 N건'과 '선택 금액'이 서로 다른 모집단을 집계해 어긋난다 | `src/components/employer/settlement/SettlementList.tsx:206` | CONFIRMED/spot |
| MEDIUM | 정산 | SETTLE-13 | CSV 내보내기가 역할을 DB 코드값으로 뱉고 금액 분해·날짜별 행이 없어 세무 증빙으로 못 쓴다 | `src/utils/settlement/settlementExport.ts:61` | CONFIRMED/spot |
| MEDIUM | 정산 | SETTLE-14 | 수정 이력에 '누가' 고쳤는지가 저장은 되는데 화면에는 안 나온다 | `src/components/employer/settlement/SettlementDetailModal/ModificationHistoryItem.tsx:46` | CONFIRMED/spot |
| MEDIUM | 정산 | SETTLE-15 | 지점 정산 화면이 조회 실패를 '정산할 근무가 없어요' 빈 상태로 오표시하고 새로고침 경로도 없다 | `app/(employer)/venue-settlements.tsx:59` | CONFIRMED/spot |
| MEDIUM | 정산 | SETTLE-17 | '미정' 체크박스가 터치 타깃 미달이고 스크린리더에 체크박스로 노출되지 않는다 | `src/components/employer/settlement/TimeInputField.tsx:68` | CONFIRMED/spot |
| MEDIUM | 정산 | SETTLE-18 | 정산 요약 카드의 안내 문구가 실제 저장 로직과 어긋난다 ('스태프 확정 금액은 기본급 기준') | `src/components/employer/settlement/SettlementSummaryCard.tsx:102` | CONFIRMED/spot |
| MEDIUM | 정산 | SETTLE-19 | 정산 목록이 스태프 수만큼 프로필 쿼리를 개별 발사한다 (N+1) | `src/components/employer/settlement/GroupedSettlementCard.tsx:204` | CONFIRMED/spot |
| MEDIUM | 정산 | SETTLE-20 | 월간 총 인건비 집계가 공고 정산 쪽에는 없고, 지점 정산도 한 달씩만 이동 가능하다 | `app/(employer)/venue-settlements.tsx:38` | CONFIRMED/spot |
| MEDIUM | 정산 | SETTLE-6 | 세금 '적용 대상' 체크박스가 고정 금액 모드에서는 아무 효과가 없는데 그대로 노출되고, 설명 문구까지 거짓이다 | `src/components/employer/settlement/TaxSettingsEditor.tsx:325` | DOWNGRADED/deep |
| MEDIUM | 정산 | SETTLE-7 | 스태프 정산 화면에 이의제기·문의 경로가 하나도 없다 | `src/components/schedule/tabs/SettlementTab.tsx:230` | DOWNGRADED/deep |
| MEDIUM | 정산 | SETTLE-9 | 근무시간 수정이 15분 단위로만 가능해 QR 실측 분을 그대로 둘 수 없다 | `src/components/employer/settlement/WorkTimeEditor.tsx:381` | DOWNGRADED/deep |
| MEDIUM | 지원자 관리 | APPL-10 | '같은 날짜엔 하나만' 자동 해제 규칙이 말없이 동작한다 — 설명 문구는 안 쓰이는 컴포넌트에만 있다 | `src/components/employer/applicants/ApplicantCard/useAssignmentSelection.ts:170` | CONFIRMED/spot |
| MEDIUM | 지원자 관리 | APPL-11 | 지원자 검색·정렬이 없다 — 정렬 로직은 훅에 구현돼 있는데 화면에 연결되지 않았다 | `src/components/employer/applicants/ApplicantList.tsx:57` | CONFIRMED/spot |
| MEDIUM | 지원자 관리 | APPL-12 | 고정공고는 확정 해제 버튼 자체가 없어 지원자 관리 화면에서 막다른 길이 된다 | `src/components/employer/applicants/ApplicantCard/ApplicantCard.tsx:115` | CONFIRMED/spot |
| MEDIUM | 지원자 관리 | APPL-13 | 취소 요청 중(cancellation_pending) 지원자는 목록에서 필터도 액션도 없이 방치된다 | `src/components/employer/applicants/ApplicantList.tsx:57` | CONFIRMED/spot |
| MEDIUM | 지원자 관리 | APPL-14 | 실시간 목록이 300건에서 조용히 잘린다 — 잘렸다는 표시가 없다 | `src/repositories/supabase/ApplicationRepositoryQueries.ts:372` | CONFIRMED/spot |
| MEDIUM | 지원자 관리 | APPL-15 | 지원 변경 1건마다 300행 전체를 다시 읽어 일괄 확정 시 조회가 폭주한다 | `src/repositories/supabase/ApplicationRepositoryQueries.ts:400` | CONFIRMED/spot |
| MEDIUM | 지원자 관리 | APPL-16 | 프로필 배치 프리페치가 첫 렌더의 N+1을 막지 못한다 — 배치와 개별 조회가 동시에 나간다 | `src/hooks/useApplicantProfiles.ts:55` | CONFIRMED/spot |
| MEDIUM | 지원자 관리 | APPL-17 | 일정 선택 체크박스에 접근성 정보가 전혀 없고 펼침 버튼은 28px이다 | `src/components/employer/applicants/ApplicantCard/components/GroupedAssignmentSelector.tsx:156` | CONFIRMED/spot |
| MEDIUM | 지원자 관리 | APPL-18 | 선택해 둔 지원자 ID가 목록 변화에 맞춰 정리되지 않아 유령 선택이 남는다 | `src/components/employer/applicants/ApplicantList.tsx:119` | CONFIRMED/spot |
| MEDIUM | 지원자 관리 | APPL-3 | 일괄 확정 부분 실패 시 '누가' 실패했는지 알 수 없고, 화면은 전원 확정된 것처럼 남는다 | `src/hooks/applicant/useApplicantMutations.ts:221` | DOWNGRADED/deep |
| MEDIUM | 지원자 관리 | APPL-4 | 사장님이 입력한 거절 사유가 스태프에게 한 글자도 도달하지 않는다 | `src/components/employer/applicants/ConfirmModal.tsx:71` | DOWNGRADED/deep |
| MEDIUM | 지원자 관리 | APPL-5 | 확정·거절 후 목록 갱신이 realtime 이벤트 단 하나에만 걸려 있다 — 낙관 갱신도 invalidate도 이 화면에선 무효 | `src/hooks/applicant/useApplicantsByJobPosting.ts:216` | DOWNGRADED/deep |
| MEDIUM | 지원자 관리 | APPL-6 | 정원 마감으로 확정이 막혀도 '어느 날짜의 어느 역할'인지 알려주지 않는다 | `src/repositories/supabase/ApplicationRepositoryTransactions.ts:314` | DOWNGRADED/deep |
| MEDIUM | 지원자 관리 | APPL-8 | 지원자 프로필을 열어 판단해도 그 자리에서 확정/거절할 수 없다 | `src/components/employer/applicants/ApplicantProfileModal.tsx:42` | CONFIRMED/spot |
| MEDIUM | 지원자 관리 | APPL-9 | 지원자 판단 근거가 점수 숫자 하나뿐 — 리뷰 본문도 과거 근무 이력도 볼 수 없다 | `src/components/employer/applicants/ApplicantCard/components/CardHeader.tsx:92` | CONFIRMED/spot |
| MEDIUM | 근무표(주간 그리드) | GRID-10 | 자동 생성된 지점의 이름을 바꾸거나 지울 방법이 없어, 잘못된 이름의 지점이 목록에 영구히 남는다 | `src/components/weeklyGrid/VenueSettingsSheet.tsx:6` | CONFIRMED/spot |
| MEDIUM | 근무표(주간 그리드) | GRID-11 | 슬롯이 공고 지원 확정분인지 사장이 직접 꽂은 인원인지, 어느 공고 소속인지 카드에서 전혀 드러나지 않는다 | `src/components/weeklyGrid/venueDayDetailMapping.ts:30` | CONFIRMED/spot |
| MEDIUM | 근무표(주간 그리드) | GRID-12 | '기타' 역할 슬롯을 수정할 수 없다 — 편집 시트에 역할명 입력이 없고, 표준 역할로 바꿔도 옛 역할명이 DB에 남는다 | `src/components/weeklyGrid/EditSlotSheet.tsx:337` | CONFIRMED/spot |
| MEDIUM | 근무표(주간 그리드) | GRID-13 | 단가 저장 실패 메시지가 원인을 지운다 — 서비스가 만든 '무엇+왜'가 일반 문구로 덮인다 | `src/components/weeklyGrid/VenueSettingsSheet.tsx:80` | CONFIRMED/spot |
| MEDIUM | 근무표(주간 그리드) | GRID-14 | 필요 인원 100 이상을 입력하면 아무 말 없이 99로 잘려 저장되고 성공 토스트가 뜬다 | `src/components/weeklyGrid/VenueDayPanel.tsx:194` | CONFIRMED/spot |
| MEDIUM | 근무표(주간 그리드) | GRID-2 | '필요 인원' 입력칸이 자동 파생 목표를 표시해, 사장이 저장한 수동 목표를 볼 수도 낮출 수도 없다(입력하면 원래 값으로 되돌아감) | `src/components/weeklyGrid/VenueDayPanel.tsx:184` | DOWNGRADED/deep |
| MEDIUM | 근무표(주간 그리드) | GRID-4 | 고정(fixed) 공고 좌석은 필요 인원 자동 반영에서 통째로 제외돼, 상시 모집 중인 지점의 근무표가 '부족 없음'으로 보인다 | `supabase/migrations/20260719100000_grid_tournament_inclusion_reject_filter.sql:62` | DOWNGRADED/deep |
| MEDIUM | 근무표(주간 그리드) | GRID-6 | 월을 넘기면 선택 날짜가 보이는 달 밖으로 나가 요약 칩이 전부 0으로 무너지는데, 아래 배치 목록에는 실제 인원이 그대로 있다 | `app/(employer)/weekly-grid.tsx:317` | DOWNGRADED/deep |
| MEDIUM | 근무표(주간 그리드) | GRID-7 | 인원 추가가 '한 명 × 하루'로 고정돼 있다 — RPC는 여러 날짜를 한 번에 받는데 UI가 항상 1건만 만들고 추가 즉시 시트를 닫는다 | `src/components/weeklyGrid/addSlotPayload.ts:115` | DOWNGRADED/deep |
| MEDIUM | 근무표(주간 그리드) | GRID-8 | 인원 추가 시트가 상시 마운트돼, 날짜를 볼 때마다 지점의 전체 기간 확정 스태프를 통째로 내려받는다 | `src/components/weeklyGrid/VenueDayPanel.tsx:330` | CONFIRMED/spot |
| MEDIUM | 근무표(주간 그리드) | GRID-9 | 그 날 이미 배치된 사람인지 추가 전에 알 수 없고, 중복은 다 입력한 뒤 에러 토스트 2개로 통보된다 | `src/components/weeklyGrid/AddSlotSheet.tsx:180` | CONFIRMED/spot |
| MEDIUM | 스태프 관리 | STAFF-12 | 확정 스태프에게 전화·문자를 한 번에 걸 수 없다 — 번호가 선택 불가 텍스트로만 표시된다 | `src/components/employer/applicants/ProfileInfoSections.tsx:171` | CONFIRMED/spot |
| MEDIUM | 스태프 관리 | STAFF-13 | 확정 스태프 카드 전체 탭이 chevron 만 보여주고 아무 동작도 하지 않는다 | `src/components/employer/applicants/StaffManagementTab.tsx:102` | CONFIRMED/spot |
| MEDIUM | 스태프 관리 | STAFF-14 | 방금 추가한 스태프가 접힌 날짜 섹션에 숨어 보이지 않는다 — 추가 성공을 눈으로 확인할 수 없다 | `src/components/employer/applicants/ConfirmedStaffList.tsx:132` | CONFIRMED/spot |
| MEDIUM | 스태프 관리 | STAFF-15 | 직접 추가에서 시간대가 자유 텍스트 — 형제 화면이 금지한 입력 방식이고, 형식이 어긋나면 정원 가드가 무력화된다 | `src/components/employer/applicants/AddStaffModal.tsx:304` | CONFIRMED/spot |
| MEDIUM | 스태프 관리 | STAFF-16 | 확정 스태프 목록에 일괄 작업이 없다 — 40명 출근 처리에 120번 탭 | `src/components/employer/applicants/ConfirmedStaffList.tsx:196` | CONFIRMED/spot |
| MEDIUM | 스태프 관리 | STAFF-17 | 노쇼 처리 후 '빈자리 채우기' 경로가 없다 — 대타 투입이 3화면 우회 | `src/components/employer/applicants/StaffManagementTab.tsx:210` | CONFIRMED/spot |
| MEDIUM | 스태프 관리 | STAFF-18 | 확정 스태프 이름을 매번 1인 1쿼리로 두 경로에서 중복 조회한다 (실시간 이벤트마다 재실행 × 구독자 2개) | `src/services/work/confirmedStaffService.ts:69` | CONFIRMED/spot |
| MEDIUM | 스태프 관리 | STAFF-19 | 접근성 — 아이콘 전용 삭제 버튼에 라벨이 없고, 카드 액션·상태 배지가 44px 터치 타깃과 role/label 을 모두 놓친다 | `src/components/employer/applicants/ConfirmedStaffCard.tsx:290` | CONFIRMED/spot |
| MEDIUM | 스태프 관리 | STAFF-5 | 역할 변경 모달이 '시급이 적용된다'고만 말하고 얼마로 바뀌는지 보여주지 않는다 | `src/components/employer/applicants/RoleChangeModal.tsx:316` | DOWNGRADED/spot |
| MEDIUM | 스태프 관리 | STAFF-8 | 지급 완료한 스태프도 카드에 '정산 대기' 배지가 그대로 — 이중 지급 위험 | `src/components/employer/applicants/ConfirmedStaffCard.tsx:177` | DOWNGRADED/spot |
| MEDIUM | 스태프 관리 | STAFF-9 | 스태프 직접 추가에서 공고와 무관한 날짜를 고를 수 있고, 그 경우 서버 정원 가드가 조용히 꺼진다 | `src/components/employer/applicants/AddStaffModal.tsx:184` | DOWNGRADED/spot |
| MEDIUM | 스태프측 | STAFF-10 | '취소 요청'을 확인한 뒤 수 초간 아무 일도 일어나지 않는다 — 시트는 이미 닫혔고 로딩 표시가 없다 | `app/(app)/(tabs)/schedule.tsx:374` | CONFIRMED/spot |
| MEDIUM | 스태프측 | STAFF-11 | 같은 시트 안에서 구인자 연락처 규칙이 충돌 — 정보 탭은 지원 단계부터 열고, 근무 탭은 확정 후에만 연다 | `src/components/schedule/tabs/InfoTab.tsx:236` | CONFIRMED/spot |
| MEDIUM | 스태프측 | STAFF-12 | QR 버튼 라벨이 전역 근무중 상태로 결정된다 — 다른 현장에서 출근 중이면 오늘 다른 일정에도 '퇴근하기'로 뜬다 | `src/components/schedule/tabs/WorkTab.tsx:74` | CONFIRMED/spot |
| MEDIUM | 스태프측 | STAFF-13 | 정산 금액이 다를 때 스태프가 취할 행동이 없다 — '신고'만 있고 그것도 금액과 연결되지 않는다 | `src/components/schedule/tabs/SettlementTab.tsx:330` | CONFIRMED/spot |
| MEDIUM | 스태프측 | STAFF-15 | 사전질문 textarea 가 '1000자' 카운터를 보여주면서 입력 제한을 걸지 않는다 | `src/components/jobs/PreQuestionForm.tsx:186` | CONFIRMED/spot |
| MEDIUM | 스태프측 | STAFF-4 | 근무 당일 화면에 복장 규정이 없고 공고 원문으로 돌아갈 링크도 없다 — 주소는 탭도 안 된다 | `src/components/schedule/tabs/InfoTab.tsx:188` | DOWNGRADED/deep |
| MEDIUM | 스태프측 | STAFF-5 | 두 번째 알림 딥링크가 조용히 무시된다 — 스케줄 탭이 살아있는 동안 최초 1회만 동작 | `app/(app)/(tabs)/schedule.tsx:473` | DOWNGRADED/deep |
| MEDIUM | 스태프측 | STAFF-6 | 공고 하트(북마크)는 저장만 되고 볼 수 있는 화면이 앱에 없다 — 100개 넘으면 조용히 지워진다 | `src/hooks/useBookmarks.ts:7` | DOWNGRADED/deep |
| MEDIUM | 스태프측 | STAFF-7 | '지원하기' 버튼이 비활성인 이유를 아무 데서도 말해주지 않는다 (에러 표시 코드는 도달 불가) | `src/components/jobs/ApplicationForm.tsx:161` | CONFIRMED/spot |
| MEDIUM | 취소 요청 | CANCEL-10 | 승인 확인 모달에 대상 스태프·일정·정원 영향이 하나도 없다 — 누구를 승인하는지 모른 채 승인 | `app/(employer)/my-postings/[id]/cancellation-requests.tsx:244` | CONFIRMED/spot |
| MEDIUM | 취소 요청 | CANCEL-11 | 스태프가 제출한 취소 요청을 철회할 수 없고, 대기 중 상태에 경과·응답 예정 정보가 없다 | `src/domains/application/ApplicationStatusMachine.ts:46` | CONFIRMED/spot |
| MEDIUM | 취소 요청 | CANCEL-13 | 당일·임박 취소에 대한 경고나 페널티 표기가 없다 — D-30과 D-0의 화면이 똑같다 | `src/components/applications/CancellationRequestForm.tsx:229` | CONFIRMED/spot |
| MEDIUM | 취소 요청 | CANCEL-14 | 거절 모달이 결과를 확인하기 전에 닫히고 입력한 200자 사유가 소실된다 | `src/components/employer/applicants/CancellationRequestCard.tsx:119` | CONFIRMED/spot |
| MEDIUM | 취소 요청 | CANCEL-15 | 처리 중 플래그를 모든 카드가 공유해 한 건 처리 중 전체 목록이 얼어붙고, 진행 중인 건을 식별할 수 없다 | `app/(employer)/my-postings/[id]/cancellation-requests.tsx:110` | CONFIRMED/spot |
| MEDIUM | 취소 요청 | CANCEL-5 | 스태프가 거절 사유를 앱 안에서 볼 수 있는 화면이 한 곳도 없다 | `src/components/employer/applicants/CancellationRequestCard.tsx:217` | DOWNGRADED/deep |
| MEDIUM | 취소 요청 | CANCEL-7 | 사장님이 취소요청을 처리하려면 전용 화면으로 이동해야 한다 — 지원자 목록에 필터·배지·인라인 액션이 전무 | `src/components/employer/applicants/ApplicantList.tsx:57` | DOWNGRADED/spot |
| MEDIUM | 취소 요청 | CANCEL-8 | 승인해서 자리가 비어도 후속 행동 신호가 0 — 대기 지원자 승격·알림·재모집 CTA가 없다 | `src/hooks/applicant/useCancellationManagement.ts:49` | DOWNGRADED/spot |
| MEDIUM | QR·출퇴근 | ATT-3 | 상태 시트가 확인 없이 파괴적 조합을 실행한다 — 출근 전 스태프에 '퇴근 처리'하면 근무 0분으로 굳는다 | `src/components/employer/applicants/StaffManagementTab.tsx:256` | CONFIRMED/spot |
| MEDIUM | QR·출퇴근 | QR-3 | 16시간 초과·시계 스큐로 후보가 걸러지면 '배정된 근무가 없습니다'라는 틀린 안내만 남고 회복 경로가 없다 | `src/services/work/eventQRService.ts:112` | DOWNGRADED/deep |
| MEDIUM | QR·출퇴근 | QR-4 | 어느 근무가 처리됐는지 알려주지 않아, 다중 배정 스태프가 엉뚱한 근무를 퇴근시킨다 | `src/services/work/eventQRService.ts:208` | DOWNGRADED/deep |
| MEDIUM | QR·출퇴근 | QR-5 | 카메라 권한 거부·오프라인·QR 훼손 시 대체 출근 경로가 0개다 | `src/components/qr/QRCodeScanner.tsx:288` | DOWNGRADED/deep |
| MEDIUM | QR·출퇴근 | QR-7 | 서버 처리 중 로딩 상태가 없어 스캔 즉시 '스캔 완료!'가 뜬다 | `app/(app)/scan.tsx:43` | CONFIRMED/spot |
| MEDIUM | QR·출퇴근 | WEB-1 | 웹 스캐너의 권한 거부 판정이 에러 메시지 문자열 매칭이라 브라우저에 따라 안 잡히고 영문 원문이 그대로 노출된다 | `src/components/qr/QRCodeScanner.web.tsx:111` | CONFIRMED/spot |
| MEDIUM | QR·출퇴근 | WEB-2 | 웹 스캐너에 플래시 토글과 실패 표시가 없어 네이티브와 실패 경로가 어긋난다 | `src/components/qr/QRCodeScanner.web.tsx:23` | CONFIRMED/spot |
| MEDIUM | 공고 작성 | ORDER-11 | 공고 타입 전환이 날짜·시간 입력을 무경고로 지운다 — 스태시는 되지만 사용자에게 보이지 않는다 | `src/components/employer/order-sheet/OrderSheetScreen.tsx:629` | CONFIRMED/spot |
| MEDIUM | 공고 작성 | ORDER-12 | 필수/선택 구분이 '미설정 배지 유무'라는 간접 신호로만 전달된다 | `src/components/employer/order-sheet/OrderRow.tsx:31` | CONFIRMED/spot |
| MEDIUM | 공고 작성 | ORDER-13 | '연속 날짜 묶음 지원' 3지 선택이 캘린더 아래에 묻혀 있다 — 지원 방식이 바뀌는 결정인데 못 본다 | `src/components/employer/job-form/modals/DatePickerModal.tsx:266` | CONFIRMED/spot |
| MEDIUM | 공고 작성 | ORDER-14 | 금액 직접입력에 천단위 구분·단위가 없고 상한 초과분을 조용히 잘라낸다 | `src/components/employer/order-sheet/sheets/SalarySheet.tsx:264` | CONFIRMED/spot |
| MEDIUM | 공고 작성 | ORDER-15 | 공고 타입 세그먼트에 설명이 없다 — 급구 7일·고정 게시 7일 규칙이 선택 시점에 보이지 않는다 | `src/components/employer/order-sheet/TypeSegment.tsx:44` | CONFIRMED/spot |
| MEDIUM | 공고 작성 | ORDER-4 | 고정(fixed) 공고 데드엔드 — 근무조건 시트 확인에 게이트가 없어 확인해도 미설정이 풀리지 않는다 | `src/components/employer/order-sheet/sheets/WorkConditionSheet.tsx:70` | DOWNGRADED/deep |
| MEDIUM | 공고 작성 | ORDER-7 | 시트 '확인' 버튼이 왜 비활성인지 말해주지 않는다 — PlaceSheet만 예외 | `src/components/employer/order-sheet/sheets/ScheduleSlotsSheet.tsx:130` | CONFIRMED/spot |
| MEDIUM | 공고 작성 | ORDER-8 | 날짜 상한을 다 쓴 상태에서 '＋ 일정 추가'가 아무것도 못 하는 데드엔드 + "최대 0개까지 선택할 수 있습니다" 문구 | `src/components/employer/order-sheet/OrderSheetScreen.tsx:855` | CONFIRMED/spot |
| MEDIUM | 공고 작성 | ORDER-9 | 프리셋 로딩 중 "아직 프리셋이 없어요"를 단정해 보여준다 — 재방문 사장님에게 거짓 + 레이아웃 점프 | `src/components/employer/order-sheet/PresetCarousel.tsx:30` | CONFIRMED/spot |
| LOW | 공고 수정 | EDIT-10 | 데이터 손상으로 편집 폼을 만들지 못한 경우와 네트워크 실패가 같은 화면으로 수렴하고, 회복 수단이 '돌아가기' 버튼 하나뿐이다 | `app/(employer)/my-postings/[id]/edit.tsx:139` | DOWNGRADED/spot |
| LOW | 공고 수정 | EDIT-13 | 고정(fixed) 공고의 '공고 수정' 카드에만 확정 인원 경고 배지가 빠져 있어 잠금을 모른 채 진입한다 | `app/(employer)/my-postings/[id]/index.tsx:597` | DOWNGRADED/spot |
| LOW | 공고 수정 | EDIT-14 | '공고 내용과 상태를 수정합니다'라고 안내하지만 수정 화면에는 상태를 바꾸는 UI가 하나도 없다 | `app/(employer)/my-postings/[id]/index.tsx:544` | CONFIRMED/spot |
| LOW | 공고 수정 | EDIT-15 | 편집 화면 헤더 QR 아이콘이 사이즈 화이트리스트를 벗어난 22px | `app/(employer)/my-postings/[id]/_layout.tsx:87` | CONFIRMED/spot |
| LOW | 공고 수정 | EDIT-16 | 편집 폼이 전체 폼을 watch + onChange 모드로 굴려, 값 하나 확정할 때마다 전 그룹 스키마 superRefine과 1100줄 트리 전체가 재실행된다 | `src/components/employer/order-sheet/OrderSheetScreen.tsx:135` | CONFIRMED/spot |
| LOW | 공고 수정 | EDIT-8 | 저장 성공 후 canGoBack 확인 없이 router.back()을 호출해, 딥링크·웹 새로고침으로 진입한 사용자는 편집 화면에 갇힌다 | `app/(employer)/my-postings/[id]/edit.tsx:98` | DOWNGRADED/spot |
| LOW | 공고 상세 | ORDER-16 | 빈 상태 문구가 필터와 무관하게 '새 공고를 작성해 보세요'이고 행동 버튼이 없다 | `app/(app)/(tabs)/employer.tsx:402` | CONFIRMED/spot |
| LOW | 공고 상세 | ORDER-17 | 지원자 0명일 때도 '0명의 지원자가 대기중입니다'라고 안내한다 | `app/(employer)/my-postings/[id]/index.tsx:500` | CONFIRMED/spot |
| LOW | 공고 상세 | ORDER-18 | 삭제 불가 캡션이 항상 떠 있고, 비활성 버튼을 눌러도 이유를 알려주지 않는다 | `app/(employer)/my-postings/[id]/index.tsx:698` | CONFIRMED/spot |
| LOW | 공고 상세 | ORDER-19 | 헤더 공유·QR 아이콘이 size 22 — 아이콘 사이즈 화이트리스트(14/16/18/20/24) 위반 | `app/(employer)/my-postings/[id]/index.tsx:291` | CONFIRMED/spot |
| LOW | 공고 상세 | ORDER-8 | 삭제 성공 후 무조건 router.back() — 딥링크·푸시로 들어온 경우 삭제된 공고 화면에 갇힌다 | `app/(employer)/my-postings/[id]/index.tsx:214` | DOWNGRADED/spot |
| LOW | 정산 | SETTLE-16 | 날짜별 행의 '지급 완료' 버튼이 터치 24px에 중첩 Pressable — 오탭으로 금전 상태가 바뀐다 | `src/components/employer/settlement/GroupedSettlementCard.tsx:167` | DOWNGRADED/spot |
| LOW | 정산 | SETTLE-21 | 일괄 정산 종료 햅틱이 서로 모순된 인자로 두 번 발화한다 | `src/hooks/useSettlement.ts:264` | CONFIRMED/spot |
| LOW | 지원자 관리 | APPL-19 | 확정 버튼이 비활성 상태에서 '0개 확정'이라고만 말하고 무엇을 해야 하는지 알려주지 않는다 | `src/components/employer/applicants/ApplicantCard/components/AppliedActions.tsx:44` | CONFIRMED/spot |
| LOW | 지원자 관리 | APPL-2 | 확정에 Undo가 없고 확인 다이얼로그조차 없어 오탭이 즉시 확정으로 굳는다 | `app/(employer)/my-postings/[id]/applicants.tsx:138` | DOWNGRADED/deep |
| LOW | 지원자 관리 | APPL-20 | 전화번호가 카드에서는 +82 원문, 프로필에서는 하이픈 형식으로 서로 다르게 보이고 어디서도 전화를 걸 수 없다 | `src/components/employer/applicants/ApplicantCard/components/ContactInfo.tsx:50` | CONFIRMED/spot |
| LOW | 근무표(주간 그리드) | GRID-15 | 날짜를 탭해도 상세 패널로 이동하지 않아, 좁은 화면에서는 선택의 결과가 화면 밖에서 일어난다 | `app/(employer)/weekly-grid.tsx:133` | DOWNGRADED/spot |
| LOW | 근무표(주간 그리드) | GRID-16 | 같은 화면 안에서 역할 칩과 확인 UI가 각각 두 벌씩 구현돼 있다 | `src/components/weeklyGrid/EditSlotSheet.tsx:337` | CONFIRMED/spot |
| LOW | 근무표(주간 그리드) | GRID-17 | 월 네비게이션 아이콘 크기 22 — 아이콘 사이즈 화이트리스트 위반 | `app/(employer)/weekly-grid.tsx:270` | CONFIRMED/spot |
| LOW | 근무표(주간 그리드) | GRID-18 | 근무에서 뺀 인원을 되돌릴 수 없다 — 지원 확정 해제까지 일어나는데 Undo가 없다 | `src/components/weeklyGrid/EditSlotSheet.tsx:195` | CONFIRMED/spot |
| LOW | 근무표(주간 그리드) | GRID-19 | 월 점프·'오늘로' 진입점이 없어 먼 달에서 돌아오려면 화살표를 그만큼 눌러야 한다 | `app/(employer)/weekly-grid.tsx:131` | CONFIRMED/spot |
| LOW | 스태프 관리 | STAFF-20 | 필터 탭에 '노쇼'·'취소됨'이 없어 노쇼 인원을 골라 볼 수 없고, 취소 라벨은 도달 불가능한 죽은 값이다 | `src/components/employer/applicants/ConfirmedStaffList.tsx:49` | CONFIRMED/spot |
| LOW | 스태프측 | STAFF-14 | 지원 전 정원 재검증이 실패하면 조용히 삼키고 그대로 제출 — 서버에도 정원 가드가 없다 | `app/(app)/jobs/[id]/apply.tsx:144` | DOWNGRADED/deep |
| LOW | 스태프측 | STAFF-16 | 목록의 확정 인원 서브맵 추출이 카드마다 전체 맵을 순회 — 무한스크롤에서 O(N²) + 전 페이지 재조회 | `src/hooks/usePostingFilledCounts.ts:20` | DOWNGRADED/spot |
| LOW | 스태프측 | STAFF-17 | 그룹 일정 시트의 날짜 이동 버튼이 32×32 — hitSlop 없이 44px 미만 | `src/components/schedule/ScheduleDetailModal.tsx:273` | CONFIRMED/spot |
| LOW | 스태프측 | STAFF-18 | 같은 화면을 '내 스케줄'과 '내 일정'으로 번갈아 부른다 | `app/(app)/jobs/[id]/index.tsx:276` | CONFIRMED/spot |
| LOW | 스태프측 | STAFF-8 | '내 일정 보기'로 들어갔는데 캘린더 아래가 완전 백지 — 선택 날짜에 일정이 없을 때 아무 문구도 없다 | `app/(app)/(tabs)/schedule.tsx:749` | DOWNGRADED/spot |
| LOW | 스태프측 | STAFF-9 | 지원 취소 버튼이 시트 최하단 스크롤 끝에 있다 — 주석은 '고정 푸터'라고 하지만 실제로는 같이 스크롤된다 | `src/components/schedule/ScheduleDetailModal.tsx:422` | DOWNGRADED/deep |
| LOW | 취소 요청 | CANCEL-16 | 승인 확인이 공용 confirmAction() 대신 손수 만든 RN Modal — 알림 규약 이탈 + 모달 접근성·스크림 규격 미준수 | `app/(employer)/my-postings/[id]/cancellation-requests.tsx:230` | CONFIRMED/spot |
| LOW | 취소 요청 | CANCEL-17 | 승인/거절 버튼이 44px 터치 타깃 미달이고 accessibilityRole/Label이 없다 | `src/components/employer/applicants/CancellationRequestCard.tsx:229` | CONFIRMED/spot |
| LOW | 취소 요청 | CANCEL-18 | '취소' 개념 색이 디자인 토큰을 벗어난 raw orange-* 팔레트로 3곳에 흩어져 있다 | `src/components/employer/applicants/CancellationRequestCard.tsx:201` | CONFIRMED/spot |
| LOW | 취소 요청 | CANCEL-19 | 사장님 승인/거절에 햅틱이 없다 — 스태프 요청 제출에는 있는데 결정 순간에는 무반응 | `app/(employer)/my-postings/[id]/cancellation-requests.tsx:83` | CONFIRMED/spot |
| LOW | 취소 요청 | CANCEL-20 | 취소요청 화면이 공고를 중복 조회하고 전체화면 스피너로 게이트한다 (레이아웃 계약 위반 + 스켈레톤 규칙 이탈) | `app/(employer)/my-postings/[id]/cancellation-requests.tsx:47` | CONFIRMED/spot |
| LOW | QR·출퇴근 | A11Y-1 | 카메라 화면의 닫기·플래시 버튼만 44px 미만 + role 누락(같은 파일 안에서 비대칭) | `src/components/qr/QRCodeScanner.tsx:225` | CONFIRMED/spot |
| LOW | QR·출퇴근 | A11Y-2 | 스캔 실패 안내가 스크린리더에 알려지지 않는다 | `src/components/qr/QRCodeScanner.tsx:288` | CONFIRMED/spot |
| LOW | QR·출퇴근 | ATT-4 | 지각·조퇴·결근 판정이 시스템에 없어 사장님이 운영 사실을 알 수 없다 | `src/shared/status/types.ts:32` | DOWNGRADED/spot |
| LOW | QR·출퇴근 | QR-6 | 고정 공고는 스캔 로직만 지원하고 QR 발급 화면이 막혀 있어 출퇴근 경로가 사실상 없다 | `app/(employer)/my-postings/[id]/qr.tsx:72` | DOWNGRADED/spot |
| LOW | 공고 작성 | ORDER-10 | 프리셋이 0개면 '＋ 저장' 카드가 사라져 첫 공고 구성을 등록 전에 저장할 수 없다 | `src/components/employer/order-sheet/PresetCarousel.tsx:30` | DOWNGRADED/spot |
| LOW | 공고 작성 | ORDER-16 | 주간 그리드에서 진입하면 완료 화면을 건너뛰어 공유 CTA와 프리셋 저장 제안을 못 받는다 | `app/(employer)/my-postings/create.tsx:164` | CONFIRMED/spot |
| LOW | 공고 작성 | ORDER-17 | 시간대·역할 개수 상한이 상수로만 존재하고 어디서도 적용되지 않는다 | `src/constants/jobPosting.ts:45` | CONFIRMED/spot |
| LOW | 공고 작성 | ORDER-18 | 급여 타입을 '협의'로 갔다가 되돌아오면 역할별 금액이 전부 0으로 리셋된다 | `src/components/employer/order-sheet/sheets/SalarySheet.tsx:100` | CONFIRMED/spot |

---

원자료(영역별 리뷰 전문·판정·계획 JSON)는 세션 스크래치패드에 보관: `C:/Users/user/AppData/Local/Temp/claude/C--Users-user-Desktop-T-HOLDEM/3fdc13ba-17b0-4048-a499-c0a1dba01836/scratchpad/audit`