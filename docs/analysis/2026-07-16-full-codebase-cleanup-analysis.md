# UNIQN 전체 코드 정리 분석 — 오류·모순·중복·레거시 (2026-07-16)

> 범위: `uniqn-mobile/` 전체에서 **ops 제외**(`src/{components,domains,hooks,services}/ops`, `app/(ops)`), `__tests__` 제외. 약 165k 라인.
> 방법: 읽기 리더 7개(haiku/sonnet Explore) → 메인 세션 직접 재검증(grep/Read) → 중요 발견만 fable 적대검증 3개(money/datasec/types). fable 판정은 반증 우선 방식이며 zod 4.3.6 실물 재현 포함.
> 목적: **새 워크트리에서 기존 기능·UI 무변경으로 수행할 정리 작업**의 입력. 버그 수정은 정리와 분리해 별도 커밋.
> 기계 증거: `tsc --noEmit` EXIT 0 · `knip:gate` **EXIT 1**(이슈 2,363 > 래칫 2,344, 단 다른 세션 미커밋 수정 포함 트리에서 측정) · RN `<Image>` 0 · 웹 `alert()` 0 · wallet/다이아 잔재 0.

---

## A. 확정 버그 (정리가 아니라 **수정** 대상 — fable 검증 완료)

| # | 심각도 | 결함 | 근거 | 최소 수정 |
|---|---|---|---|---|
| A1 | **P0 유저가시 금액** | 정산 확인 모달이 **세전** 금액 표시, 목록 카드·저장값은 세후 — 같은 화면에 3개 숫자(예: 행 ₩96,700 / 모달 100,000원 / 저장 96,700). 원인: `SalaryConfig`(settlementCalc.ts:27-31)에 taxSettings 필드 자체가 없어 `useStaffSettlementsHandlers.ts:141-146`이 미전달. `SettlementRepository.ts:209-216`이 mismatch를 warn 로깅(설계자 인지 방증) | fable-money 실증 | SalaryConfig에 taxSettings 추가 + settlements.tsx→calculateWorkLogAmount 배선(3~4줄) |
| A2 | **P1 침묵 DB 부패** | `Assignment.duration`이 경과시간용 `durationSchema`(common.ts:75)에 오배선 — zod 4.3.6 재현: `{type:'consecutive',startDate,endDate}` → `{}`. 모든 지원서 읽기가 이 파싱 경유, **확정 1회에 DB의 duration이 `{}`로 영구 되쓰기**(ApplicationRepositoryTransactions.ts:84-125). 현재 duration 소비자 0이라 유저 가시 아님 — 읽는 기능 추가 즉시 P0 | fable-types CONFIRMED (zod 실물 재현) | application.schema.ts:179의 import를 **assignment.schema.ts:27-31의 올바른 durationSchema**로 교체(1줄) |
| A3 | **Med~High 프라이버시** | 로그아웃이 푸시토큰을 서버에서 해제하지 않음 — `authCoreService.signOut`(:382-410)에 unregisterPushToken 호출 없음, `unregisterToken` 소비처 실질 0. 공용 기기에서 이전 계정 푸시 계속 수신·계정 간 알림 노출 | fable-datasec 상위결함 확인 | signOut 서두(세션 유효 시점)에 unregisterPushToken + 인메모리 없으면 unregisterAllFCMTokens(userId) 폴백 |
| A4 | **Med (admin 전용)** | `AdminRepository.getUsers`(:211-252) 검색 필터를 페이지네이션 **이후** 클라에서 적용 — 타 페이지 매칭 유저 누락(검색 사실상 오작동), total/totalPages/hasNextPage 왜곡 | fable-datasec CONFIRMED | range 전에 서버측 `.or('name.ilike…,email.ilike…')` 적용 |
| A5 | **Low 현재 / Med 잠복** | 지원서 조인용 `JOB_POSTING_COLUMNS`(ApplicationRepositoryHelpers.ts:46)에 `conditions`,`venue_id` 누락 — "동기화 유지" 주석 위반. **3벌째 사본** SettlementRepository.ts:60-61은 ISSUE-003에서 제거된 컬럼까지 잔존. 현재 소비 필드가 좁아(title/workDate/location.name) 증상 0 — 지원내역·지원자 화면에 조건 표시가 붙는 순간 조용한 미표시(화이트리스트 증발 재발 클래스, wiki `whitelist-silent-drop`) | 메인 직접 확정 + fable-datasec 영향 추적 | 컬럼 추가보다 **TABLE_COLUMNS 단일 소스 import**로 근본 해소 |
| A6 | **P2 원라이너** | 에러코드 `E6080` 이중 할당 — `BUSINESS_TOURNAMENT_NOT_APPROVED`(AppError.ts:176) vs `WORKSPACE_NOT_FOUND`(workspace.ts:22) | 메인 직접 확정 | 워크스페이스 쪽 코드 재할당 |
| A7 | **P2 시한폭탄** | DB에 실기록되는 `status:'deactivated'`(UserRepository.ts:313,393)가 types/user.ts:124·user.schema.ts:26 유니온에 없음. 읽기 경로가 enum을 안 타서 증발은 없음(반증됨) — 단 strict zod가 붙는 순간 이 프로젝트 사고 이력(enum-divergence) 재발 | fable-types PARTIAL | 유니온·enum에 'deactivated' 추가 |
| A8 | **P1 잠재 트랩** | 세금 미리보기(TaxSettingsEditor.tsx:180-188)가 항목별 제외 미반영 산식 사용 — 현재 showPreview 4곳 전부 false라 도달 불가이나 **컴포넌트 기본값 true**라 신규 사용처에서 즉시 갈라진 금액 노출 | fable-money PARTIAL | 미리보기를 calculateTaxAmountByItems로 교체 또는 dead preview 제거 |

**반증되어 기각된 주장(재제기 방지)**: 초대 딥링크 workspaceId 소실(생산자 없음·실경로는 정상 전달, 계약-구현 스멜만) · 승인 게이트 3중 판정 발산(4곳 모두 fail-closed 동일, SSOT 주석만 거짓) · users.status 레코드 증발(읽기 경로 enum 미경유) · 정산 산식 현행 드리프트(현재 라인 동치 — 단 발산 **재발 이력**은 helpers.test.ts:1-7에 실재).

## B. 모순 (같은 개념, 다른 정의 — 동작 보존 정정)

- **@deprecated 마커 역전 3종** (그대로 믿고 삭제하면 사고):
  - `WorkLogRepository.ts:551,598,620` — "polling 전환됨" 주석과 달리 `subscribeByStaffId`/`subscribeByStaffIdWithFilters`/`subscribeTodayActive`는 scheduleService.ts:667·workLogService.ts:345,386에서 **실사용 중**(메인 직접 검증). `subscribeByDate`(:537)만 진짜 죽은 코드.
  - `FirebaseDocument`(common.ts:34) — deprecated 별칭이 실제 정본: 8파일 14인터페이스의 상속 베이스. "정본" BaseDocument 직접 사용은 고아 타입뿐.
  - `FirestoreUserProfile`(user.ts:150) — repository층 정본(6파일). 앱층은 UserProfile 사용 — 분할 상태. 권장: 별칭 승격보다 **전체 치환+authTypes.ts:19 동명 재수출 제거**.
- **"legacy" 명명 역전**: `JobPostingCard`(jobPosting.ts:555 "Legacy compatibility alias")가 실은 주력(22파일 70회), "신형" PostingCardViewModel은 5파일. `variant:'legacy'`(:342)도 정상 fallback 분기. **오삭제 최우선 경고**.
- 환경 판별 이원화: `config/env.ts:47-60 detectEnvironment` vs `lib/env.ts:101-118` — NODE_ENV=production+RELEASE_CHANNEL 미설정 시 다른 답(확신 높음, fable 미검증).
- 리뷰 마감 이원 산식: `reviewDeadline.ts:10-23`(ms) vs `ReviewValidator.ts:87-96`(setDate) — 소비처 분리, 엣지에서 갈림(중간).
- 근무시간 계산 3중: `date/ranges.ts:168` vs `TimeNormalizer.ts:68`(호출자 보정 의존) vs `WorkTimeDisplay.ts:98`(자체 +24h) — 정산과 화면표시가 다른 경로.
- 타입↔스키마 불일치: `workspaceId`(타입 optional vs 스키마 required)·`workDate`(반대, `as unknown as` 우회)·`applicantName`·`report createdAt`·`notificationSettings.categories` 구조 상이·`SocialProvider` naver 유무(auth.ts:78 vs user.ts:88).
- `phoneSchema` 동명 이규칙(auth vs common) — common 쪽은 **importer 0 죽은 코드**(fable 확인) → 삭제로 일원화.
- `requireAuth` 동명 이시그니처: guardErrors.ts:36(string) vs hookErrorHandler.ts:141(객체).
- featureFlags.ts:9,14 — `home_dashboard_enabled`/`weekly_grid_enabled` snake_case 키(camelCase 규칙 위반).
- Firebase 잔재 주석/이름: jobService.ts:8·scheduleService.ts:4·workLogService.ts:7·searchService.ts:49 헤더, AppError.ts:74 "E4xxx: Firebase", useStaffSettlementsHandlers.ts:244, auth.ts:22 emailVerified.

## C. 중복 (동작 동치 확인/추정 — 통합 후보)

**정산·급여 (최우선, fable로 현행 동치 확인·재발 이력 있음)**
- 계산 4중 복제: `SettlementCalculator.ts` ↔ `domains/settlement/helpers.ts`(자체 주석이 "동치" 명시) ↔ `allowanceUtils.ts:68-95`(프로덕션 import 0) ↔ `AllowanceEditor.tsx:94-119`(로컬 재구현). 실사용: 서비스/레포 5곳=Calculator, 프레젠테이션=helpers. 등가성 게이트는 basePay·수당만 커버(세금·역할조회 무게이트). → helpers 계산 계열을 Calculator 위임 래퍼로.
- 역할급여 조회 2계열 이형: `getSalaryForRole`(useSameSalary 반영) vs `getRoleSalaryFromRoles`(미반영) — 라이브 경로는 후자로 수렴 중, 잠재 분기.
- 급여 표기 4곳 재구현(₩/원/공백 상이): SalarySheet.tsx:250,403 · RoleSalaryInput.tsx:99 · RoleSalaryDisplay.tsx:54-67 · SettlementModals.tsx:149-150 — 공용 `formatCurrency` 미배선(impeccable-design 룰19 위반).
- `TaxCalculator.ts` vs `utils/settlement/tax.ts` — 동일 taxCore 이중 파사드.
- `SALARY_TYPE_LABELS` 3중(constants/index.ts:188 · utils/settlement/constants.ts · RoleSalaryDisplay.tsx 로컬).

**모듈 그림자·재수출 사고 지형**
- `src/utils/formatters.ts`(파일) vs `src/utils/formatters/`(디렉토리) 공존 — bare import는 파일이 승리, 디렉토리 index.ts의 "canonical 단일 진입점" 주석은 거짓(메인 직접 확정). 4단 재노출 체인.
- `lib/queryClient.ts:763-797` invalidationGraph — invalidationStrategy.ts와 중복, queryClient판은 죽은 코드.

**레포지토리 계층**
- 35컬럼 `TABLE_COLUMNS`+`applyTsPreference` 3파일 바이트 동일 복제(WorkLogRepositoryHelpers.ts:21 · SettlementRepository.ts:58 · ConfirmedStaffRepository.ts:42) — A5의 근본 원인과 동족.
- `toJobPosting` 2벌(JobPostingRepositoryHelpers:32 화이트리스트 필터 vs ApplicationRepositoryHelpers:70 무필터).
- 권한판정 블록 중복: SettlementRepository.ts:612 vs ConfirmedStaffRepository.ts:183.
- `app_config` 읽기 중복: appConfigService vs versionService(:67-140).
- `sentryService.ts` vs `.web.ts` — 플랫폼 분기 불필요한 핵심 로직 복붙(참고: rootSentry 쌍은 진짜 분기라 정상).

**타입/스키마**
- "날짜-시간대-역할" 3단 구조 2벌: `jobPosting/dateRequirement.ts` vs `jobPosting.ts`(PostingSlot*) + postingConfig.ts 재수출로 import 경로 3개. 필드명·필수성까지 갈림(headcount? vs count).
- Assignment zod 2벌: application.schema.ts:163-189 vs assignment.schema.ts:37-51 (A2 수정 시 후자로 수렴).
- orderSheet.schema.ts:24-127 — role/salaryType/postingType enum을 jobPosting.schema의 기존 스키마 재사용 없이 하드코딩 재정의.
- `jobPostingDraft.ts` vs `jobPostingForm.ts` — 작성 상태 이중 shape(draftAdapter가 수동 매핑; S4 은퇴와 연동).
- 기본 역할(딜러+플로어) 3중 하드코딩, POSTING_TYPE_LABELS 2중, JOB_STATUS_LABELS 부분집합 중복, userRoleSchema 2중, ScheduleGroup↔ConfirmedStaffGroup, WorkLogStatus↔ConfirmedStaffStatus.

**도메인/유틸**
- `facts.ts:98-163 buildPostingFacts` vs `selectors.ts` 3함수(프로덕션 참조 0) — 라인 단위 중복.
- `getMonthRange` 2벌(ranges.ts:52 vs scheduleService.ts:84) · `parseTimeSlot` 2벌(ranges.ts:86 vs WorkLogCreator.ts:120) · `makeSelectionKey` 2벌(utils판 도달불가).
- `roleNormalizer.ts` vs `RoleResolver.ts` — role 정규화 병렬 파이프라인(출력 타입 상이). RoleResolver는 두 관심사 혼재로 분리 여지.
- 그리드 프리필 2벌: gridPrefill.ts:37(호출 0) vs order-sheet/mappers.ts:482.
- `isPhoneOnlySignup*` 타입별 재구현 2벌(Firebase판 미사용).

**job-form ↔ order-sheet 8쌍** (구=편집 전용 활성 레거시, S3/S4 계획 존재 — **이번 정리에서 건드리지 않음**): Salary/Roles/Dates/Schedule/BasicInfo/PreQuestions/TypeSelector/Region 계열. 예외: DatePickerModal은 의도적 공유.

## D. 죽은 코드 (호출 0 확인 — 삭제 후보, 삭제 직전 grep 재확인 필수)

**services/repos**: `authCoreService.getCurrentUser`(:487, 항상 null) · `UserRepository.registerAsEmployer`(:420-503, **즉시 role 승격 RPC 래퍼 — 보안상 삭제 가치 높음**) · `crashlyticsService.ts` 전체 · `ApplicationRepositoryTransactions.createWorkLogsForConfirmation`(:320-370) · `BoardRepository.getCommentReaction`(:461-502, 실행되면 에러나는 버그이자 죽은 코드) · boardScheduleService 3함수(:213-321, T-B12 완료) · `WorkLogRepository.subscribeByDate`(:537).

**hooks 3종**: `useAllowances` · `useAssignmentSelection`(console 위반도 동반) · `useUnsavedChangesGuard`.

**UI 5종**: `LoadingOverlay`(+InlineLoadingOverlay export) · `ScreenSkeleton` · `Radio` · `FormSelect` — 0 사용처. (극저사용 4종 ActionSheet/PressableCard/Checkbox/FormField는 보류 — 삭제 아닌 재검토.)

**utils/domains**: `SettlementCache.ts` 전체(188줄)+calculateWithCache/calculateBatch("Phase 6" 잔재) · `salary/roleExtractor.ts`+`costCalculator.ts`(JSDoc 깨진 참조 포함) · selectors.ts 3함수 · buildGridPrefillDraft · isPhoneOnlySignupFirebaseUser · IdNormalizer.toStaffId/toApplicantId(항등함수) · selectionUtils.makeSelectionKey · date/ranges·validation·grouping 일부 함수(테스트 전용) · WorkLogCreator의 SERVER_TIMESTAMP_SENTINEL/create 계열(Firestore 잔재, parseTimeSlot/extractStartTime만 실사용) · formatters/ 일부 export.

**schemas/types**: assignment.schema.ts — **주의: 전체 삭제 금지.** durationSchema(:27-31)는 A2 수정의 올바른 대체재. A2 재배선 후 잔여만 정리 · jobFilterSchema/basicInfoSchema/dateTimeSchema · types/auth.ts 6종(SignUpRequest 등) · staffProfileSchema/employerProfileSchema/userSettingsSchema/employerRegisterSchema · common.ts User/Staff(고아) · commonPhoneSchema 별칭 · `CurrencyYenIcon`.

**barrel 위생**: stores/index.ts 3종 누락 · errors/index.ts EmployerApp*Error 4종 등 누락(호출부가 직접 import로 우회 중) · 중복 export 53건(대부분 icons 별칭).

## E. 레거시 (은퇴 대기 / 의도적 유지 — 삭제 금지 목록 포함)

| 항목 | 상태 | 처분 |
|---|---|---|
| job-form 트리 전체 | 편집 전용 활성 레거시 | **S3(전타입 편집) 완료 후 S4에서 은퇴** — 계획 문서 존재, 이번 정리 제외 |
| create.tsx:64-67,287-391 legacyType 분기 | 사문(주석 자체가 명시) | S4와 결합 제거 |
| draftAdapter.ts(739줄)·jobPostingForm 파이프라인 | 활성 사용 중 | S4 은퇴 대기 표시만 |
| scheduleNormalizer.ts legacy 흡수 | #146 의도된 백컴팻 SSOT | **유지** |
| serialization.ts:172-212 buildFixedSyntheticRequirement | SSOT와 별개의 우발적 이원 흡수 | scheduleNormalizer로 수렴 검토(중간 확신) |
| utils/date/core.ts Firestore 변환 | 레거시 데이터 호환, lint로 봉인됨 | **유지 — 삭제 위험** |
| jobTemplate.ts legacy* 11회 | 살아있는 하위호환 흡수 | **유지** |
| constants supervisor 라벨 | 기존 데이터 호환 | **유지** |
| confirmedStaff modifiedBy/changedBy | 값은 서버가 덮어씀 | 호출부(useConfirmedStaff) 전달 코드 정리 |

## F. 크기/규칙 위반

- 800줄 초과: `JobPostingRepository.ts` 875줄 · `OrderSheetScreen.tsx` 1,007줄(**진행중 디렉토리 — 제외**). 근접: queryClient 797 · utils/supabase 775 · useBoard 775(17 export SRP) · BusinessErrors 766 · NotificationRepository 755 · scheduleService 772 · draftAdapter 739.
- console.* 위반 4파일 7회: workLogService.ts(2) · types/assignment.ts(1) · useAssignmentSelection.ts(1) · logger.ts(구현체, 정상).
- 계층 위반(Service→supabase 직행): workspaceService.ts:216 · appConfigService.ts:23 · versionService.ts:71 · authCoreService checkEmail/Nickname/PhoneExists(rpc 직행) · collaboratorService.ts:18,40(auth.getUser) · sessionService.ts:87,98,124.
- fail-open: loginAttemptService(:27-85 — fable 판정: 기기 로컬 UX 보조 통제라 결함 아님, 의도 주석만 추가) · pushTokenService(:169-172 — A3의 하위 항목).
- ConfirmedStaffList.tsx가 RN SectionList(FlashList 아님) — 대규모 대회에서 성능 우려(중간).
- QRPanel.tsx:276-324 `text-secondary-800` 5회 dark: 짝 없음(실기기 미검증).

## G. 실행 계획 (새 워크트리 · 기능/UI 무변경 게이트)

**워크트리 준비**: `git worktree add` + 새 브랜치. node_modules는 `mklink /J`(memory: feedback_worktree_node_modules_junction). expo 구동 필요 시 `EXPO_ROUTER_APP_ROOT` 함정 주의.

**Phase 0 — 버그 수정 (정리와 분리, 커밋별 red-green)**: A1(세금 배선) → A2(duration 재배선, 1줄) → A3(로그아웃 푸시 해제) → A4(admin 서버 검색) → A5(TABLE_COLUMNS 단일소스) → A6(E6080) → A7('deactivated') → A8(미리보기). 각각 회귀 테스트 동반. A1·A2·A3는 유저 영향이라 우선.

**Phase 1 — 무위험 삭제 (D 목록)**: 항목별 삭제 직전 `grep` 재확인 → 삭제 → `npm run quality` + 관련 스위트. knip 래칫을 2344 아래로 복구(현재 2363).

**Phase 2 — 동작 보존 통합 (C 목록)**: 급여 표기 formatCurrency 수렴 → formatters 그림자 해소(파일→디렉토리 단일화) → helpers→Calculator 위임 래퍼(+세금·역할조회 등가성 게이트 확장) → TABLE_COLUMNS/권한판정/app_config/sentry 통합 → 타입·스키마 SSOT(재수출 체인 축소).

**Phase 3 — 마커·주석 정정 (B 목록)**: deprecated 역전 3종 · "legacy" 명명 역전 · Firebase 잔재 주석 · SSOT 거짓 주석 · featureFlags 키. (문서만 바꾸는 것과 코드 치환을 커밋 분리.)

**건드리지 않음**: order-sheet 디렉토리(타 세션 작업 중) · job-form/draftAdapter(S3/S4 계획) · 의도적 유지 목록(E).

**완료 게이트**: `npm run quality` EXIT 0 · `npm test` 초점 스위트 green · `npm run knip:gate` EXIT 0 · UI 스냅샷 무변경(기능/UI 보존 증명).

---
*검증 수준 표기: fable 판정 항목은 CONFIRMED/PARTIAL/REFUTED 명시. 그 외 리더 보고 항목은 확신도(높음/중간)를 원문 유지. 삭제 전 개별 grep 재확인은 모든 항목 공통 필수.*
