# 핸드오프 — UX M 중형 4건 + 정산 라벨 SSOT (다음 세션 메인 프롬프트)

> 선행 세션(2026-07-10)이 UX 품질 감사 → 퀵윈 20건 구현·검증·커밋까지 완료했다.
> 이 문서는 그 다음 배치(사용자가 지목한 M 중형 4건 + SSOT 리팩토링 1건)의 착수 프롬프트다.

## 0. 컨텍스트 복원 (착수 전 필독)

| 항목        | 값                                                                                                                      |
| ----------- | ----------------------------------------------------------------------------------------------------------------------- |
| 브랜치      | `analysis/ux-flow-review-20260710` (**미push**, 로컬 전용)                                                              |
| 워크트리    | `C:\Users\user\Desktop\T-HOLDEM\.claude\worktrees\ux-flow-review-20260710` (keep 상태. 없으면 브랜치 체크아웃으로 대체) |
| 완료 커밋   | `4b13ffc60` 감사 리포트 · `2f77e4156` QW 20건 (tsc0·lint0·prettier clean·jest 381스위트/4886 전건)                      |
| 감사 리포트 | `docs/analysis/2026-07-10-ux-flow-review.md` — 발견·백로그·재설계 전체                                                  |
| 메모리      | `project_ux_flow_review_20260710.md` (사용자 결정·후속 목록)                                                            |

**착수 절차**:

1. `git status` — 병렬 세션 미커밋 변경 확인(있으면 새 워크트리 격리, 전역 규칙)
2. **`git merge origin/master` 먼저** — 선행 세션 이후 master가 전진함(#222 grid `e26553d4d`·#233 문서 `fb4d0302f`·#234·#235). stale-base 함정(메모리 `기타 주의` 참조): rebase 금지(squash 저장소), merge 후 tsc·jest로 재검증하고 시작
3. node_modules 정션 확인: `uniqn-mobile/node_modules`가 깨져 있으면 `powershell -Command "New-Item -ItemType Junction -Path node_modules -Target 'C:\Users\user\Desktop\T-HOLDEM\uniqn-mobile\node_modules'"`
4. push/PR은 사용자 명시 요청 시에만. 로컬 커밋은 사전 승인(작업 단위별 분할 커밋 권장)

**오케스트레이션 계약** (선행 세션 검증된 방식):

- 메인 세션(fable) = 스펙 확정·diff 실측 리뷰·통합 게이트·종합. sonnet 에이전트 = 대량 읽기·구현
- 구현 에이전트는 **파일 충돌 없는 묶음**으로 분할, 한 번에 ≤5개 병렬
- 에이전트 프롬프트에 불변 규칙 명시: git 상태 변경 금지(파일 수정만)·mcp**supabase**\* 호출 금지·전체 tsc/jest 금지(타깃 테스트만)·CLAUDE.md 컨벤션(한글 주석·logger·dark:·camelCase·@/)
- 에이전트 "성공" 보고 불신 — 메인이 diff 직접 리뷰 후 통합 게이트(`npm run quality` + jest 전체) 실행, 증거 확보 후 커밋
- 선행 감사에서 에이전트 보고 오류율: 핵심 주장 21건 중 4건 정정 — 검증 생략 금지

---

## 1. 작업 목록 (5건, 의존 순서 없음 — 단 T0을 먼저 하면 M1이 깨끗해짐)

### T0. 정산 라벨 하드코딩 4곳 → SSOT 통합 (소형, 반나절)

QW에서 `src/shared/status/types.ts`의 `PAYROLL_STATUS_LABELS`를 "정산 대기/정산 중/정산 완료/정산 실패"로 통일했으나, 이를 우회하는 로컬 재정의 4곳이 남아 있다(선행 세션 impl-staffops 실측):

1. `src/components/employer/settlement/helpers/settlementConfig.ts` — "미정산/처리중/정산완료/정산실패" (띄어쓰기 없음)
2. `src/components/employer/settlement/SettlementDetailModal/constants.ts` — 1과 동일 값 재정의
3. `src/components/employer/settlement/GroupedSettlementCard.tsx` — 로컬 재정의
4. ~~`src/components/schedule/WorkLogList.tsx`~~ — **2026-07-27 삭제됨**(rank41). 여기 남겼던 "부활 후보이니 삭제하지 말 것" 판단은 M1 의 필수 스펙(리스트 뷰 상태 필터 탭)이 `schedule.tsx` 에 직접 구현되면서 무효가 됐다 — 이 컴포넌트는 그 뒤로도 소비자 0인 채 유지비만 냈다. 근무 이력 화면이 다시 필요해지면 git 이력에서 복원할 것.

스펙: 4곳 전부 `PAYROLL_STATUS_LABELS` import로 교체. "미정산"처럼 짧은 라벨이 필터 칩 등에서 필요하면 SSOT에 `PAYROLL_STATUS_SHORT_LABELS` 변형을 추가하는 방식으로 해결(로컬 재정의 금지). 라벨 문자열을 기대하는 테스트 전수 grep 후 갱신.

### M1. 스케줄탭 지원현황 보강 (⚠️사용자 결정: **전용 화면 신설 금지**)

근거: 감사 S4(캘린더가 "확정 일정"과 "지원 추적"을 겸용, applied 점이 색상만으로 구분)·재설계 R6. 사용자가 "신설하지 말고 기존 스케줄탭 UI 보강"으로 확정.

스펙 방향(설계 재량 있음, 구현 전 메인이 확정할 것):

- 리스트 뷰에 상태 필터 탭(전체/지원중/확정/완료) — 기존 `groupedByApplication` 데이터 재사용 (`app/(app)/(tabs)/schedule.tsx`)
- 캘린더의 applied 점을 confirmed와 다른 시각 언어로(테두리만/반투명) — `src/components/schedule/CalendarView.tsx:67-72` `SCHEDULE_DOT_COLORS` 참조. 색상 단독 의존(색약 취약) 해소가 목적
- (선택) "지원 현황 N건" 접이식 카드를 리스트 상단에
- (선택) 과거 이력 접근 개선 — `MonthNavigator` 월 타이틀 탭 → 연/월 피커 바텀시트(감사 S1). ~~죽은 코드 `WorkLogList` 부활도 검토~~ → 2026-07-27 삭제(위 4번 참조)
- QW에서 상세화면(`jobs/[id]`)에 applied 취소 진입점을 이미 넣었으므로, 스케줄탭 쪽 흐름과 문구 일관성 확인

### M2. 노쇼 되돌리기 (서버 경로 포함 — `/guard` 먼저)

근거: 감사 확정 — 노쇼가 UI+데이터 이중으로 비가역(`no-show-status-irreversible-dead-end`).

실측된 차단 구조(전부 선행 세션 검증):

- `ConfirmedStaffCard.tsx` `canChangeStatus`/`canDelete`가 NO_SHOW 명시 제외 → 진입점 자체 없음
- `ConfirmedStaffRepository.updateStatus`(:390-425)가 `no_show_at`/`no_show_reason`을 절대 클리어하지 않음
- `src/domains/staff/confirmedStaff.ts:59,71` `isNoShow = Boolean(workLog.noShowAt)`가 status 컬럼 무시하고 영구 no_show 표시

스펙: "노쇼 취소" 전용 액션 — status 원복 + `no_show_at`/`no_show_reason` clear를 한 경로로. 주의사항:

- **DB/RLS 접근 전 `/guard` 스킬 먼저.** 마이그레이션 필요 시 MCP `apply_migration` 전용(db push 금지), 기존 마이그레이션 수정 금지
- 기존 감사 P0#1이 prod 적용됨(`wl_update_revoke_staff_self` — 스태프 자기행 UPDATE 회수). **owner/협업자 UPDATE 경로가 여전히 열려 있는지 prod 실측 후 설계**(prod↔레포 스키마 대규모 발산 — 레포만 보고 판단 금지, 메모리 `pitfall_prod_repo_schema_drift_massive`)
- `protect_work_log_payroll_columns` 보호 트리거가 no_show 컬럼을 막는지 확인
- 정산 완료(payrollStatus=completed) 건의 노쇼 취소는 차단할지 정책 결정 필요 — 사용자에게 1회 확인 권장

### M3. 알림 카테고리 설정 UI (배선 위주)

근거: 감사 N3 — 스토어·타입은 완성, UI만 없음.

- 이미 존재: `src/stores/notificationStore.ts:466-479` `updateCategorySetting`(현재 앱 내 호출 0, 테스트만 존재) + `src/types/notification.ts:349-369`(카테고리 5종 enabled/pushEnabled·quietHours·grouping)
- 스펙: `app/(app)/settings/index.tsx` 알림 카드(현재 마스터 토글 1개, :303-315)에 카테고리 5종(지원/출근/정산/공고/시스템) 토글 + 방해금지시간(quietHours) 섹션
- **착수 전 실측 1건**: 이 설정이 로컬(store persist)만인지 서버(users 테이블/별도 테이블) 동기화인지 — 서버 필드가 없으면 "로컬 전용 + 푸시 필터링이 실제 동작하는지"를 확인하고, 발송측(Edge Function/트리거)이 카테고리 설정을 존중하지 않으면 UI만 붙이는 건 **가짜 설정**이 된다. 발송 경로가 설정을 안 보면 범위를 "클라이언트 표시/로컬 알림 필터"로 축소하고 서버 연동은 후속으로 분리

### M4. 당일 운영 요약 스트립 (소형)

근거: 감사(ux-staffops 재설계안) — "출근 3/4 · 정산대기 2건"을 탭 전환 없이.

- `app/(employer)/my-postings/[id]/settlements.tsx:171-176` TabHeader가 이미 staffCount/settlementCount 배지 계산 중 — 이 카운트를 탭바 위 고정 스트립으로 승격
- QW6(스태프 리스트 realtime)이 이미 켜져 있어 스트립도 실시간 갱신됨 — 시너지 확인
- 출근 카운트 정의: check_in_ts 기준 "출근 N / 확정 M" 형태 권장(스펙은 메인이 확정)

---

## 2. 검증 게이트 (전 작업 공통)

1. 묶음별 타깃 테스트(에이전트) → 메인이 diff 전수 리뷰
2. 통합: `npm run quality`(tsc·eslint·prettier) EXIT 0 + `npx jest` 전체 전건 통과 — 수치 증거 없이 완료 주장 금지
3. M2(DB 변경 시): Supabase advisor ERROR 0 + pgTAP(해당 시) + **prod 실측으로 RLS/트리거 동작 확인**
4. 커밋은 작업 단위별 분할(T0/M1/M2/M3/M4), 형식 `<type>(<scope>): <한글>`. push 금지

## 3. 이번 범위에서 제외 (재제안 금지 — 사용자 확정)

- 지원 내역 **전용 화면 신설** (스케줄탭 보강으로 대체)
- 공고 작성 로컬 임시저장(MMKV)
- R1 이중 홈 해소 · R4 공고폼 IA 일원화/긴급 경량 플로우

## 4. 잔여 백로그 (이번 배치 이후 후보 — 감사 리포트 §4 참조)

리뷰 CTA 내재화(M8) · 공고 복제/재게시(M9) · 관리 허브 마감/재오픈 카드(M10) · 취소요청 거절 흔적 영속화(M11) · employer pending 개선+**전역 포그라운드 리페치 수리**(M12, `queryClient.ts:86-92` handleAppStateChange가 logger만 호출) · bulk 정산 실패자 노출(M13) · QR 실패 대체 경로(M14) · 프로필 조회 실패 명시적 에러 상태(M3′) · R2 협업 단일화(기존 감사 P2#14와 같은 슬라이스, P0#3 이후) · R7 디자인시스템 계약 6종+lint 게이트 · 운영시간 상수 실제값 확정(`src/constants/support.ts` — 사용자 확인 필요)
