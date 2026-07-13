# 핸드오프 — iOS 유저플로우 버그 수정: 리뷰 + 남은 작업 (2026-07-13)

> 다음 세션 메인 프롬프트. fresh context 기준으로 작성됨. CWD 는 `uniqn-mobile/`.

## 0. 이 세션 한 일 (요약)

사용자가 iOS 실기기 스크린샷으로 버그 8종을 제보 → 5개 서브에이전트로 근본원인 조사 → 수정.

- 브랜치: `fix/ios-userflow-bugs-20260713` (master 기준, **미push**)
- 커밋 3개:
  - `cf7f44eae` #1·#5·#6·#2·#8 (안전영역·세금미리보기·사전질문대비·스케줄통계·공유날짜분해)
  - `7acbb5f4f` #4 (확정 인원 카운터 배선 + 협의 슬롯 키 통일)
  - `33a3a5c1b` #3·#7 (중첩 Modal 터치 먹통 + 스태프 footer 화면밖)
- 로컬 검증: `tsc --noEmit` 0 · jest 76개 통과(scheduleService 49 / jobShareMessage 15 / postingSurfaceModel 12) · #2·#4 Red-Green 회귀 사이클 확인.

## 1. 먼저 — 코드 리뷰

```
git diff master...fix/ios-userflow-bugs-20260713
```

`/review` 또는 code-reviewer(fable) 로 3커밋 리뷰. **중점 검토 지점**:

- **#4 슬롯 키 통일** (`postingSurfaceModel.ts` `buildFixedScheduleModel`): `fixedSlotKey = timeValue || FIXED_TIME_MARKER` 로 바꿔 확정경로(`facts.ts:150-153`)·DB(`_posting_slot_key`)와 startTime-우선 규칙을 맞췄다. **DB 정규화 규칙과 진짜 일치하는지 재확인** (fixed + negotiable + startTime 조합 라이브 데이터).
- **#2 통계 의미 변경** (`scheduleService.ts` `calculateScheduleStats`): `date>=today` 필터를 제거해 "확정" 카운트를 월 스코프 전체로. 과거 확정건이 이제 확정에 잡힘 — 제품 의미상 맞는지(과거 미완료 confirmed 를 "확정"으로 셀지) 확인. 라벨 재검토 여지.
- **#3 타이밍** (`schedule.tsx` handleQRScan, `ScheduleDetailModal.tsx` 취소 핸들러): `setTimeout(..., 300)` 매직넘버. 시트 dismiss 애니메이션과 동기. 300ms 가 실기기서 충분한지.
- **#8 공유 재구성** (`jobShareMessage.ts`): `buildDateLines`+`buildRoleLine` → `aggregateRoles`+`buildScheduleBlocks`, `JobShareParts` 스키마 변경(`scheduleBlocks`). export 소비처는 테스트뿐(프로덕션은 `buildJobShareText`만), 시그니처 유지됨.

## 2. 남은 구현 작업

### 2a. #3 신고 버튼 (터치 먹통 미해결분) — 후속 리팩터

QR·취소요청·지원취소는 "시트 닫고 300ms 후 2차 모달" 로 고쳤으나, **신고 버튼은 제외**했다.

- 원인: `ScheduleDetailModal.tsx:500` `<ReportModal>` 이 시트 `<Modal>` 의 children 이고, 컴포넌트가 `if (!schedule) return null`(277행) 이라 시트를 닫아(=schedule null) 버리면 ReportModal 이 언마운트됨.
- 해결안: ReportModal 을 상위(`schedule.tsx`)로 승격 — 신고 대상(reportTarget, jobPostingId, jobPostingTitle) 을 schedule.tsx state 로 올리고, `<QRCodeScanner>` 형제로 렌더. 그러면 시트를 닫고 신고 모달을 띄울 수 있음.
- 대안(작음): ScheduleDetailModal 에서 신고 정보를 별도 state 로 스냅샷 + ReportModal 을 `<Modal>` 밖 Fragment 형제로 + null 가드 조건 완화. 단 버그 소지 있어 승격안 권장.

### 2b. (선택) #7 근본대응 심화

`Keyboard.dismiss()`(H1) 로 국소 수정함. 실기기서 여전히 footer 가 잘리면 → `SheetModal.tsx` `NativeSheetModal` 의 `RNModal` 내부(KeyboardAvoidingView 안쪽)에 `<SafeAreaProvider>` 재래핑(H2). **공통 컴포넌트라 모든 SheetModal 사용처 회귀 위험** — 반드시 실기기 확인 후.

## 3. 게이트 (사용자 확인 필요)

- **실기기 검증**: #1(헤더 안전영역)·#3(모달 터치)·#7(스태프 footer) 은 iOS 네이티브 동작이라 로컬 tsc/jest 로 재현 불가 → **OTA 배포 후 실기기 확인 필수**.
- **push / PR / OTA**: 아직 안 함. 사용자 명시 요청 시.
- **환경 관찰(중요)**: 워킹트리에 내가 안 만든 `M app/(auth)/signup.tsx` 미커밋 변경 + 브랜치 base 에 `9bd2a48f1 fix(deps): react-refresh` 커밋(다른 세션 것). 내 3커밋엔 없으나 **PR/머지 시 base 커밋이 함께 올라감** — 정리 판단 필요.

## 4. 버그별 근본원인 (리뷰 참고표)

| #   | 파일                                                                  | 근본원인                                                                    | 수정                                                   |
| --- | --------------------------------------------------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------ |
| 1   | `app/_layout.tsx`                                                     | 루트 SafeAreaProvider `initialMetrics` 미주입 → 콜드/딥링크 첫 프레임 top:0 | `initialMetrics={initialWindowMetrics}`                |
| 2   | `services/work/scheduleService.ts`                                    | `date>=today` 필터가 월 스코프에 겹쳐 과거 확정건 누락                      | 필터 제거(리스트 기준 통일)                            |
| 3   | `schedule.tsx`, `ScheduleDetailModal.tsx`                             | 시트(자체 Modal) 안 닫고 2차 네이티브 Modal 겹쳐 present → iOS 터치 붕괴    | 시트 닫고 300ms 후 2차 모달, applicationId 클로저 캡처 |
| 4   | `(tabs)/employer.tsx`, `JobPostingCard.tsx`, `postingSurfaceModel.ts` | ①내 공고 탭 usePostingFilledCounts 미배선 ②협의+startTime 슬롯 키 미스매치  | ①filledCounts prop 관통 ②startTime 우선 통일           |
| 5   | `SalarySection/SalarySection.tsx`                                     | 공고작성만 `showPreview={true}`                                             | `false`                                                |
| 6   | `jobs/PreQuestionForm.tsx`                                            | 배경이 모달 셸과 동색(대비0)                                                | `bg-surface-page dark:bg-surface`                      |
| 7   | `ops/StaffAddSheet.tsx`, `applicants/AddStaffModal.tsx`               | 검색 후 키보드 미해제 → KAV 가 footer 밀어냄                                | 검색 시 `Keyboard.dismiss()`                           |
| 8   | `utils/jobShareMessage.ts`                                            | 역할을 날짜 무시 합산, 날짜-역할 페어 스키마 없음                           | `buildScheduleBlocks` 로 날짜/시간대별 분해            |

## 5. 세션 함정 메모 (다음 세션 실수 방지)

- **jest/tsc 는 반드시 CWD=`uniqn-mobile` 에서 실행.** 레포 루트(`T-HOLDEM`)에서 돌리면 tsconfig 없어 tsc 가 도움말만 출력하고, jest 는 `.claude/worktrees/*`(다른 세션 워크트리)까지 스캔해 bun cache picomatch haste 중복으로 전 스위트가 0 tests 로 죽는다. (이 세션서 실제 겪음 — CWD 문제였음)
- 커밋 시 pre-commit 훅이 ESLint --fix + Prettier --write + 재스테이징 함. 내 파일만 add 할 것(signup.tsx 등 다른 세션 변경 섞지 말 것).
- 관련 메모리: `pitfall_nested_rn_modal_touch_dead`(#186, #3 과 동일 계열) · `project_schedule_counter_unification_sp2_sp3`(#4 filled_positions) · `pitfall_denormalized_counter_drift`.
