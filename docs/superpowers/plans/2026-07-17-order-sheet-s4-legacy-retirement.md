# S4 레거시 은퇴 (공고작성 주문서 통일 완결) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** S1~S3로 주문서가 전 타입 생성·편집을 단일 경로로 흡수한 상태에서, 도달 경로 0인 레거시 섹션 폼 체인과 formData 방향 유틸을 참조 무결성 단위로 은퇴시키고 S3 이월(가드 테스트·unsaved guard stale)을 정리해 재구축을 완결한다.

**Architecture:** 삭제는 "소비자 제거(Task 1) → 파일 삭제(Task 2) → 유틸 슬림화(Task 3~4)" 순의 참조 무결성 사슬. `valuesToCreateInput`/`valuesToUpdateInput`의 draftAdapter 위임은 **존치**(위임 대상에 S3 conditions 계약 테스트가 직접 물려 있음 — 이주 비용>가치). draftAdapter는 **부분 은퇴**: draft→formData 방향(`draftToFormData`·`applyFormDataPatch`)만 제거, draft←formData 방향(`formDataToDraft`)은 템플릿 백컴팻 라이브 의존으로 존치.

**Tech Stack:** Expo 55 / RN 0.83 / TS strict / jest / knip 6.25

## Global Constraints

- 모든 주석·커밋·문구 **한글**. 커밋 형식 `<type>(<scope>): <한글>`.
- `logger.info()`(no console.log) · `dark:` 상시 · `@/` 절대 경로 · camelCase.
- **서버 무변경**: `supabase/**`·`functions/**`·`src/domains/job-posting/serialization.ts` diff 0 (JSON-only OTA 유지). 매 태스크 커밋 전 `git diff --stat HEAD -- supabase src/domains/job-posting/serialization.ts` 가 빈 출력이어야 한다.
- **커밋 직전마다** `git branch --show-current` == `docs/order-sheet-unification-design` 재확인(단일트리 동시세션 master 되돌림 실증). master 직접 커밋 금지. append 커밋만 — 리베이스·리셋·amend 금지.
- `git add`는 **항상 명시 경로**(워킹트리에 타 세션 산출물: ` M TODOS.md`·untracked docs/`.claude/skills/` — 절대 스테이징 금지).
- 삭제 태스크마다 빌드(tsc)·초점 테스트 green 후 커밋(대량 삭제 한 커밋 금지).
- 게이트 명령(레포 루트 기준): `cd uniqn-mobile && npx tsc --noEmit` · `cd uniqn-mobile && npx jest <초점 경로>`.
- **무조치 확정(재제안 금지)**: 스키마 상호배타 반강제 · WorkConditionSheet rounded-lg 통일 · hasConfirmedApplicants TOCTOU · T2 toEqual(approvedConfig) 확장 · **update 경로 conditions 상시 명시 전달(`draftToUpdateJobPostingInput` 양분기 `conditions: draft.conditions ?? {}`, 커밋 6faa74ad3)은 확정 계약 — 되돌리기 금지**.

## 실측 확정 의존 그래프 (2026-07-17, 이 계획의 근거 — 구현자는 삭제 직전 재검증 grep만 수행)

| 심볼/파일 | 판정 | 근거(소비자) |
|---|---|---|
| `JobPostingScrollForm`·sections/**·cards/**·shared/**(PostingTypeSelector) | **삭제** | 외부 소비자 = create.tsx 사문 분기뿐. `from '@/components/employer/job-form` 전수 grep 6건: create×3·edit×1(TemplateModal)·create-success×1(TemplateModal)·ScheduleDatesSheet×1(DatePickerModal). employer/index.ts 재수출 없음 |
| `LoadTemplateModal`·`GroupingConfirmModal`·`NumberPickerModal`·`RoleSelectModal`·`RegionSelectModal`·`modals/index.ts`·`job-form/index.ts` | **삭제** | 소비자 전부 사멸 체인 내부. RegionSelectModal 언급 2건(RegionFilterSheet:7,49·RegionTaxonomyBrowser:50)은 prose 주석뿐 |
| `TemplateModal`·`DatePickerModal`(+test) | **존치(제자리)** | 라이브: create/edit/create-success · ScheduleDatesSheet 래핑 |
| `validation.ts` 전체 | **삭제** | 유일 소비자 JobPostingScrollForm(validateAllSections·getFirstErrorSection). 전용 테스트 파일 없음 |
| `useAllowances`(+hooks/index.ts:136) | **삭제** | 유일 소비자 SalarySection. 전용 테스트 없음 |
| `useTemplateManager` | **무변경** | 라이브(저장 경로). LoadTemplateModal 전용 멤버(open/close/isLoadTemplateModalOpen·handleLoadTemplate·handleDeleteTemplate 등)는 고아화되지만 export 아님(knip 무영향)·delete Undo 테스트 보유·삭제 UI 복귀 여지 — PR 본문에 고아 멤버 후속 관찰 명기 |
| submission.ts: `buildCreateJobPostingInput`·`buildUpdateJobPostingInput`·`buildJobPostingFormData`·`buildJobPostingDraftFromFormData`·`patchJobPostingDraft`·재export(:60) | **삭제** | 라이브 소비자 0(전부 create.tsx 사문 분기 또는 테스트 전용). `buildJobPostingDraft`만 라이브(edit.tsx:17·create.tsx 프리셋:103) → **존치** |
| draftAdapter: `draftToFormData`·`applyFormDataPatch` | **삭제** | prod 소비자 = create.tsx 사문·submission 사멸분·jobTemplate.templateToFormData(테스트 전용)뿐 |
| draftAdapter: `formDataToDraft`·`jobPostingToDraft`·`draftToCreateJobPostingInput`·`draftToUpdateJobPostingInput`·`buildFixedSyntheticRequirement` | **존치** | 라이브: TemplateRepository:79,224·jobTemplate:120(백컴팻)·mappers 위임:506,521·mappers:184·jobTemplate:212·serialization.conditions.test(S3 계약) |
| `jobTemplate.templateToFormData` | **삭제** | 테스트 전용(jobTemplate.test·draftRoles.test). `templateToDraft`·`extractTemplateData`는 라이브 — 존치 |
| `gridPrefill.buildGridPrefillDraft`(+gridPrefill.test.ts) | **삭제** | 유일 소비자 create.tsx 사문 draft state. `GridPrefillParams` 타입은 mappers.ts:23 라이브 → gridPrefill.ts에 타입만 남기거나 mappers로 이주 |
| `serialization.ts`의 동명 `buildFixedSyntheticRequirement` | **무접촉** | 서버 계약 동결. draftAdapter 것과 별개 함수(시그니처 다름) |
| knip:gate | **현재 EXIT 1** | 실측 2363(exports 1342+types 967+dup 53+devDeps 1) > 2344 — S4 삭제로 회복 후 래칫 하향 필수 |

---

### Task 1: create.tsx 사문 분기 삭제 + OrderSheetScreen onSwitchToLegacyForm prop 제거

**Files:**
- Modify: `uniqn-mobile/app/(employer)/my-postings/create.tsx`
- Modify: `uniqn-mobile/src/components/employer/order-sheet/OrderSheetScreen.tsx:96-98,117`
- Modify(테스트 mock 정리): `uniqn-mobile/src/components/employer/order-sheet/__tests__/OrderSheetScreen.{tournament,timeSlots,scheduleGroups,salarySync,presets,fixed}.test.tsx`

**Interfaces:**
- Consumes: 없음(첫 태스크)
- Produces: 이 커밋 후 레거시 폼 체인·`buildCreateJobPostingInput`·`patchJobPostingDraft`·`draftToFormData`·`buildGridPrefillDraft`의 앱(prod) 참조 0 — Task 2~4의 전제. `OrderSheetScreenProps`에서 `onSwitchToLegacyForm` 소멸.

- [ ] **Step 1: 삭제 직전 재검증 grep** — 실행: `cd uniqn-mobile && grep -rn "onSwitchToLegacyForm\|isLegacyForm\|legacyType" src app --include='*.ts*' | grep -v __tests__` → 기대: create.tsx·OrderSheetScreen.tsx(prop 선언·주석)만.
- [ ] **Step 2: create.tsx 사문 분기 제거.** 삭제 목록(현행 라인 기준): RN import 정리(:2 — `KeyboardAvoidingView, Platform, Alert` 소비 소멸로 라인 전체 삭제) · `JobPostingFormData` 타입(:12) · submission import를 `buildJobPostingDraft`만 남기고 축소(:14-19) · `buildGridPrefillDraft` import(:20) · `JobPostingScrollForm`(:32)·`LoadTemplateModal`(:34) import · `useAuth()`의 `user` 구조분해(:42, 소비 소멸) · `draft`/`setDraft` state(:60-62) · `legacyType`/`isLegacyForm`(:64-67) · `formData` memo(:68) · `updateFormData`(:149-156) · 레거시 `handleSaveTemplate`(:158-160) · `handleLoadTemplateFromModal`(:162-172) · 레거시 `handleSubmit`(:174-214) · `handleSwitchToLegacyForm`(:287-311) · `if (!isLegacyForm)` 게이트(:313-314, 주문서 return을 무조건 반환으로) · OrderSheetScreen `onSwitchToLegacyForm` prop 전달(:322) · 레거시 렌더 블록(:346-390). **존치**: `isDirty`/`setIsDirty`·`useUnsavedChangesGuard`·`initialValues`·프리셋 memo(:85-131)·주문서 템플릿 저장 플로우(:133-147)·`handleOrderSheetSubmit`(:216-285)·TemplateModal 렌더(:330-341). 결과 import 블록:

```tsx
import React, { useState, useCallback, useMemo } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/hooks/useAuth';
import { useCreateJobPosting, useMyJobPostings } from '@/hooks/useJobManagement';
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard';
import { useTemplateManager } from '@/hooks/useTemplateManager';
import { useToastStore } from '@/stores/toastStore';
import { logger } from '@/utils/logger';
import { toError } from '@/errors';
import type { JobPostingDraft } from '@/types/jobPostingDraft';
import { buildJobPostingDraft } from '@/utils/job-posting/submission';
import {
  draftToValues,
  formValuesToDraft,
  gridParamsToValues,
  primaryScheduleInfo,
  templateToValues,
  valuesToCreateInput,
  valuesToDraft,
} from '@/utils/order-sheet/mappers';
import { setLastSubmittedDraft } from '@/utils/order-sheet/lastSubmitted';
import { formatShortDate } from '@/utils/formatters/date';
import { TemplateModal } from '@/components/employer/job-form/modals/TemplateModal';
import { StackHeader } from '@/components/headers';
import { OrderSheetScreen } from '@/components/employer/order-sheet/OrderSheetScreen';
import type { OrderSheetPreset } from '@/components/employer/order-sheet/PresetCarousel';
import type { OrderSheetFormValues, OrderSheetValues } from '@/schemas/orderSheet.schema';
```

- [ ] **Step 3: OrderSheetScreen prop 소멸.** `OrderSheetScreen.tsx:96-98`의 `onSwitchToLegacyForm?: (type: 'fixed' | 'tournament') => void;`와 계약 주석, `:117`의 "구조분해하지 않는다" 주석 제거. props 문서 주석에서 S2 사문 언급도 함께 제거.
- [ ] **Step 4: 테스트 mock 정리.** 6개 테스트 파일에서 `onSwitchToLegacyForm: jest.fn()` 라인 삭제. `OrderSheetScreen.tournament.test.tsx:36-44`·`OrderSheetScreen.fixed.test.tsx:49-64`의 "미호출" 서브테스트는 prop 소멸로 계약이 타입 차원에서 소거됨 — **서브테스트 삭제**(잔여 어서션이 배너/내부 처리 동작을 이미 고정: 삭제 전 해당 describe의 다른 it가 tournament 배너·fixed 내부 전환을 커버하는지 눈으로 확인하고, 커버가 그 서브테스트뿐이면 어서션을 "배너 렌더/타입 유지" 검증으로 대체).
- [ ] **Step 5: 게이트.** 실행: `cd uniqn-mobile && npx tsc --noEmit` → 기대: 에러 0. 실행: `cd uniqn-mobile && npx jest src/components/employer/order-sheet app/\(employer\)/my-postings --silent` → 기대: 전 스위트 PASS.
- [ ] **Step 6: 커밋** (직전 `git branch --show-current` 확인):

```bash
git add "uniqn-mobile/app/(employer)/my-postings/create.tsx" uniqn-mobile/src/components/employer/order-sheet/OrderSheetScreen.tsx uniqn-mobile/src/components/employer/order-sheet/__tests__/
git commit -m "refactor(jobs): create 사문 레거시 분기 제거 — 주문서 단일 경로 확정(S4)"
```

### Task 2: 레거시 폼 파일 일괄 삭제 (참조 0 실증 후)

**Files:**
- Delete: `uniqn-mobile/src/components/employer/job-form/JobPostingScrollForm.tsx` · `job-form/index.ts` · `job-form/sections/**`(SectionCard·BasicInfoSection+`__tests__/BasicInfoSection.test.tsx`·ScheduleSection·RolesSection·SalarySection/ 폴더 5파일·PreQuestionsSection·DateRequirementsSection·sections/index.ts) · `job-form/shared/**`(PostingTypeSelector·index.ts) · `job-form/cards/**`(DateRangeCard·DateRequirementCard·TimeSlotCard·index.ts) · `job-form/modals/{LoadTemplateModal,GroupingConfirmModal,NumberPickerModal,RoleSelectModal,RegionSelectModal,index.ts}.tsx|ts`
- Delete: `uniqn-mobile/src/utils/job-posting/validation.ts`
- Delete: `uniqn-mobile/src/hooks/useAllowances.ts` + Modify: `uniqn-mobile/src/hooks/index.ts:136`(해당 export 라인 삭제)
- Modify(stale prose 주석 2건): `uniqn-mobile/src/components/jobs/filters/RegionFilterSheet.tsx:7,49` · `uniqn-mobile/src/components/region/RegionTaxonomyBrowser.tsx:50` — "RegionSelectModal" 언급을 "구 공고작성 폼 단일선택 모달(은퇴)"로 치환하거나 문맥상 불필요하면 언급 제거.
- **존치 확인**: `modals/TemplateModal.tsx` · `modals/DatePickerModal.tsx` · `modals/__tests__/DatePickerModal.test.tsx`

**Interfaces:**
- Consumes: Task 1 완료(레거시 폼 참조 0).
- Produces: job-form 디렉토리 = 라이브 모달 2종+테스트만 잔존. Task 7 knip 카운트 하락의 주 재료.

- [ ] **Step 1: 삭제 직전 재검증 grep(파일별 소비자 0 실증).** 실행: `cd uniqn-mobile && grep -rn "JobPostingScrollForm\|PostingTypeSelector\|LoadTemplateModal\|RegionSelectModal\|RoleSelectModal\|NumberPickerModal\|GroupingConfirmModal\|validateAllSections\|useAllowances\|BasicInfoSection\|DateRequirementsSection\|RolesSection\|SalarySection\|ScheduleSection\|PreQuestionsSection\|SectionCard\|DateRangeCard\|DateRequirementCard\|TimeSlotCard" src app --include='*.ts*'` → 기대: 삭제 대상 파일 내부 상호참조·prose 주석(위 2건+jobTemplate.test:54·constants/jobPosting.ts:21·WorkConditionSheet:5·PreQuestionsSheet:4·TypeSegment:15·mappers.ts:104 등 역사 주석)만. **예상 밖 라이브 소비자가 1건이라도 나오면 삭제를 멈추고 컨트롤러에 보고.**
- [ ] **Step 2: 파일 삭제** (`git rm` 명시 경로, 위 Delete 목록 그대로). 역사 주석 중 삭제 파일을 "현존 코드"처럼 가리키는 것(constants/jobPosting.ts:21 "DateRequirementsSection 사용 안 함" 등)은 놔둔다 — 도메인 이력 서술로 무해. 단 RegionFilterSheet·RegionTaxonomyBrowser 2건은 현행 대조 서술이라 위 Modify대로 갱신.
- [ ] **Step 3: 게이트.** 실행: `cd uniqn-mobile && npx tsc --noEmit` → 기대: 0 에러. 실행: `cd uniqn-mobile && npx jest src/components/employer src/hooks src/utils/job-posting --silent` → 기대: PASS (BasicInfoSection.test는 삭제됐으므로 실행 대상 아님).
- [ ] **Step 4: 커밋**: `refactor(jobs): 레거시 섹션 폼 체인 일괄 은퇴 — 소비자 0 실측(S4)`

### Task 3: submission.ts 슬림화 + gridPrefill 은퇴

**Files:**
- Modify: `uniqn-mobile/src/utils/job-posting/submission.ts` (아래 최종 형태로 전체 대체)
- Modify: `uniqn-mobile/src/utils/order-sheet/__tests__/mappers.test.ts:11,567` (재배선)
- Rewrite: `uniqn-mobile/src/utils/job-posting/__tests__/submission.test.ts` (disposition 표)
- Delete: `uniqn-mobile/src/utils/job-posting/gridPrefill.ts` + `__tests__/gridPrefill.test.ts` / Modify: `uniqn-mobile/src/utils/order-sheet/mappers.ts:23`(GridPrefillParams 타입 이주)

**Interfaces:**
- Consumes: Task 1(사문 소비자 제거).
- Produces: `submission.ts` = `buildJobPostingDraft(posting: JobPosting): JobPostingDraft` 단일 export. `GridPrefillParams`는 `mappers.ts` 로컬 정의로 이주(기존 필드 그대로: `{ venueId?: string; date?: string; count?: number }` — 이주 시 gridPrefill.ts 원문과 필드 대조).

- [ ] **Step 1: submission.ts 최종 형태로 대체**:

```ts
import type { JobPosting } from '@/types';
import type { JobPostingDraft } from '@/types/jobPostingDraft';
import { jobPostingToDraft } from './draftAdapter';

/** 공고 엔티티 → 편집/프리셋용 draft (읽기 하이드레이션 단일 진입점 — edit.tsx·create.tsx 프리셋) */
export function buildJobPostingDraft(posting: JobPosting): JobPostingDraft {
  return jobPostingToDraft(posting);
}
```

- [ ] **Step 2: mappers.test.ts:567 재배선** — `import { buildCreateJobPostingInput } from '@/utils/job-posting/submission';`(:11) →

```ts
import { draftToCreateJobPostingInput, formDataToDraft } from '@/utils/job-posting/draftAdapter';
// :567
const legacy = draftToCreateJobPostingInput(formDataToDraft(legacyFormData));
```

- [ ] **Step 3: submission.test.ts 재편(disposition 표).** 원칙: draft 렌즈에 동일 계약이 이미 있으면 삭제, 유일 계약이면 draftAdapter 직접 경로로 이식. 이식 패턴: `buildCreateJobPostingInput(formData)` → `draftToCreateJobPostingInput(formDataToDraft(formData))`, `buildUpdateJobPostingInput(x, opts)` → `draftToUpdateJobPostingInput(formDataToDraft(x), opts)`.

| it (현행 라인) | 처분 |
|---|---|
| :128 dated create canonical | 삭제(중복: mappers.test 등가성·draftAdapter.test) |
| :175 confirmed 축소 payload | 삭제(중복: mappers.update.test 축소 payload 게이트) |
| :203 fixed update canonical | 삭제(중복: mappers.update.test fixed 케이스) |
| :237 pre-question 토글 off 드롭 | **이식**(draft 렌즈 유일 계약 여부 grep 후 — draftAdapter.test에 동등 어서션 없으면 이식) |
| :256 buildJobPostingFormData | 삭제(대상 함수 은퇴) |
| :270 optional 필드 clear-intent update+serialize | **이식**(conditions 외 optional 필드 계약 — serialization.conditions.test와 중복 아닌 부분만) |
| :309 nested detailedAddress 우선 | **이식**(formDataToDraft 라이브 계약) |
| :326 location serialize→parse→form 왕복 | **이식하되 렌즈 교체**: form 방향 사멸 → `jobPostingToDraft(parsed)` draft 렌즈로 location 보존 어서션 |

이식분은 새 describe `formData 백컴팻(draftAdapter 직접 경로)`로 같은 파일에 유지(파일명 유지 — 경로 이력 보존).
- [ ] **Step 4: gridPrefill 은퇴** — `GridPrefillParams`를 mappers.ts 로컬로 정의 후 gridPrefill.ts·gridPrefill.test.ts `git rm`. mappers의 `gridParamsToValues` 기존 테스트가 NaN/0/소수 정규화를 커버하는지 확인(`grep -n "gridParamsToValues" src/utils/order-sheet/__tests__/mappers.test.ts`), 미커버 경계값(gridPrefill.test:30-48 동형)이 있으면 mappers.test에 해당 케이스만 이식.
- [ ] **Step 5: 게이트.** `npx tsc --noEmit` 0 에러 · `npx jest src/utils --silent` PASS.
- [ ] **Step 6: 커밋**: `refactor(jobs): submission 래퍼·gridPrefill 은퇴 — buildJobPostingDraft 단일 존치(S4)`

### Task 4: draftAdapter 부분 은퇴 — formData 읽기 방향 제거

**Files:**
- Modify: `uniqn-mobile/src/utils/job-posting/draftAdapter.ts` — `draftToFormData`(:449)·`applyFormDataPatch`(:494) 및 이들 전용 내부 헬퍼(buildDatedFormRoles 등 — 삭제 후 tsc/미참조로 식별) 제거. `formDataToDraft`·`buildFixedSyntheticRequirement`·`draftToCreateJobPostingInput`·`draftToUpdateJobPostingInput`(**conditions ?? {} 양분기 무접촉**)·`jobPostingToDraft` 존치.
- Modify: `uniqn-mobile/src/types/jobTemplate.ts` — `templateToFormData`(:253-255) 삭제 + import 정리(`draftToFormData` 제거, `buildFixedSyntheticRequirement`·`formDataToDraft` 존치).
- Rewrite(렌즈 이주): `uniqn-mobile/src/utils/job-posting/__tests__/draftAdapter.test.ts` · `uniqn-mobile/src/types/__tests__/jobTemplate.test.ts` · `uniqn-mobile/src/utils/job-posting/__tests__/draftRoles.test.ts`

**Interfaces:**
- Consumes: Task 1~3(형상 참조 소멸).
- Produces: draftAdapter 공개 표면 = 존치 5종 + 타입. 라이브 읽기 렌즈는 `draftToValues`(mappers)로 단일화.

- [ ] **Step 1: 삭제 직전 재검증** — `grep -rn "draftToFormData\|applyFormDataPatch\|templateToFormData" src app --include='*.ts*' | grep -v __tests__` → 기대: 정의부만(소비자 0).
- [ ] **Step 2: 프로덕션 삭제** (위 Modify 명세). **금지**: `draftToUpdateJobPostingInput`의 conditions 분기(S3 fix 6faa74ad3)·`formDataToDraft` 본문·serialization.ts 접촉.
- [ ] **Step 3: 테스트 렌즈 이주(disposition).** 이주 렌즈 = `draftToValues`(주문서 라이브 읽기) 또는 draft 직접 어서션. 계약 보존 원칙: **각 삭제 테스트가 고정하던 시맨틱이 라이브 경로 테스트로 존재하는지 확인 후 삭제, 없으면 이주**.

`draftAdapter.test.ts`: :93/:108(dated seed 기본 역할, draftToFormData 렌즈) → `draftToValues` 렌즈로 이주(역할 surfacing은 values.scheduleGroups[].timeSlots[].roles로 어서션) · :121/:159/:194/:237/:287/:333(applyFormDataPatch 계열) → **삭제**(패치 기계 자체 은퇴 — 라이브 동등물은 order-sheet salarySync/scheduleGroups 스위트가 이미 커버, 삭제 전 해당 스위트 존재 grep) · :388(fixed draft→form 왕복) → 삭제(중복: mappers fixed 왕복) · :405(region draftToFormData) → `draftToValues` region 보존으로 이주(mappers.test에 동일 어서션 있으면 삭제) · :415/:448/:453/:464/:471 존치(라이브 함수만 사용) · :443/:458(venueId form 렌즈) → `draftToValues` venueId 보존 이주 + form 왕복분 삭제 · :479/:494 form 레그만 어서션에서 제거.

`jobTemplate.test.ts`: :55/:93(fixed 템플릿 저장→로드 왕복, templateToFormData 렌즈) → `templateToDraft` 결과의 `schedule.requirements[0].timeSlots[0]` draft 렌즈로 이주(:26 기존 draft 렌즈 관례와 동형) · :117/:213 내부의 templateToFormData 호출부 → templateToDraft+draftToValues 렌즈로 치환(고정하던 계약: per-date seed 슬롯·salary-only 편집 시 타이밍 보존 — 어서션 의미 불변).

`draftRoles.test.ts`: 4개 it 전부 templateToFormData 렌즈 → `templateToDraft` 후 `draftToValues` 렌즈로 이주(고정 계약: 템플릿 로드 역할 보존·기본값 커버·빈 draft 미보존·seed 슬롯 재생성). 파일 이름 유지.
- [ ] **Step 4: 게이트.** `npx tsc --noEmit` 0 · `npx jest src/utils/job-posting src/types src/utils/order-sheet src/domains/job-posting --silent` PASS · `git diff --stat HEAD -- src/domains/job-posting/serialization.ts supabase` 빈 출력.
- [ ] **Step 5: 커밋**: `refactor(jobs): draftAdapter formData 읽기방향 은퇴 — 테스트 draft/values 렌즈 이주(S4)`

### Task 5: unsaved guard stale 수정 — markClean (S3 이월 ④, TDD)

**Files:**
- Modify: `uniqn-mobile/src/hooks/useUnsavedChangesGuard.ts`
- Create: `uniqn-mobile/src/__tests__/hooks/useUnsavedChangesGuard.test.tsx`
- Modify: `uniqn-mobile/app/(employer)/my-postings/[id]/edit.tsx:89-91` · `uniqn-mobile/app/(employer)/my-postings/create.tsx`(handleOrderSheetSubmit 내 setIsDirty(false) 2곳)

**Interfaces:**
- Consumes: 없음(독립).
- Produces: `useUnsavedChangesGuard(hasUnsavedChanges: boolean): { markClean: () => void }` — 기존 소비자(반환값 미사용)와 후방호환.

- [ ] **Step 1: 실패 테스트 작성.** 결함: `setIsDirty(false)` 직후 같은 틱의 `router.back()`은 재구독 전 stale 리스너에 걸려 저장 완료에도 "변경사항 저장 안 됨" Alert가 뜬다.

```tsx
import React from 'react';
import { Alert } from 'react-native';
import { renderHook, act } from '@testing-library/react-native';
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard';

type BeforeRemoveHandler = (e: {
  preventDefault: jest.Mock;
  data: { action: Record<string, unknown> };
}) => void;

const listeners: BeforeRemoveHandler[] = [];
const mockDispatch = jest.fn();
jest.mock('expo-router', () => ({
  useNavigation: () => ({
    addListener: (_: string, cb: BeforeRemoveHandler) => {
      listeners.push(cb);
      return () => listeners.splice(listeners.indexOf(cb), 1);
    },
    dispatch: (...args: unknown[]) => mockDispatch(...args),
  }),
}));

const fireBeforeRemove = () => {
  const e = { preventDefault: jest.fn(), data: { action: {} } };
  listeners.forEach((cb) => cb(e));
  return e;
};

describe('useUnsavedChangesGuard — 저장 직후 stale 리스너', () => {
  beforeEach(() => {
    listeners.length = 0;
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  });

  it('dirty면 뒤로가기를 차단한다(기존 계약)', () => {
    renderHook(() => useUnsavedChangesGuard(true));
    const e = fireBeforeRemove();
    expect(e.preventDefault).toHaveBeenCalled();
  });

  it('markClean() 후 같은 틱 뒤로가기는 차단하지 않는다(저장 완료 시퀀스)', () => {
    const view = renderHook(() => useUnsavedChangesGuard(true));
    // setIsDirty(false)의 리렌더가 아직 반영되지 않은 창을 재현: rerender 없이 즉시 발화
    act(() => view.result.current.markClean());
    const e = fireBeforeRemove();
    expect(e.preventDefault).not.toHaveBeenCalled();
  });

  it('markClean 후 다시 dirty가 되면 차단이 복원된다', () => {
    const view = renderHook(({ dirty }) => useUnsavedChangesGuard(dirty), {
      initialProps: { dirty: true },
    });
    act(() => view.result.current.markClean());
    view.rerender({ dirty: false });
    view.rerender({ dirty: true });
    const e = fireBeforeRemove();
    expect(e.preventDefault).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: RED 확인.** 실행: `npx jest src/__tests__/hooks/useUnsavedChangesGuard.test.tsx` → 기대: FAIL(`markClean` 부재 — TypeError/컴파일 에러).
- [ ] **Step 3: 구현.**

```ts
import { useCallback, useEffect, useRef } from 'react';
// ... 기존 import 유지

export function useUnsavedChangesGuard(hasUnsavedChanges: boolean): { markClean: () => void } {
  const navigation = useNavigation();
  // 저장 직후 setIsDirty(false)의 리렌더 전에 실행되는 내비게이션이 stale 리스너에
  // 걸리지 않도록, 동기 갱신되는 ref로 최신 clean 상태를 우선한다.
  const cleanRef = useRef(false);

  useEffect(() => {
    cleanRef.current = false; // dirty 상태가 갱신되면 markClean 효과 해제
  }, [hasUnsavedChanges]);

  const markClean = useCallback(() => {
    cleanRef.current = true;
  }, []);

  useEffect(() => {
    if (!hasUnsavedChanges) return;
    const unsubscribe = navigation.addListener('beforeRemove', (e) => {
      if (cleanRef.current) return; // 저장 완료 — 통과
      e.preventDefault();
      // ... 기존 Alert/confirm 분기 그대로
    });
    return unsubscribe;
  }, [hasUnsavedChanges, navigation]);

  return { markClean };
}
```

- [ ] **Step 4: GREEN 확인.** 같은 명령 → 기대: 3/3 PASS.
- [ ] **Step 5: 화면 배선.** edit.tsx: `const { markClean } = useUnsavedChangesGuard(isDirty);`(:44), handleSubmit 성공부(:89-91)를 `setIsDirty(false); markClean(); router.back();`로. create.tsx: `useUnsavedChangesGuard(isDirty)`(:80) 동일 치환, `handleOrderSheetSubmit`의 `setIsDirty(false)` 직후(그리드 복귀 `router.back()` 분기와 완료화면 `router.replace` 분기 공통 지점) `markClean()` 추가.
- [ ] **Step 6: 게이트+커밋.** `npx tsc --noEmit` 0 · `npx jest src/__tests__/hooks app/\(employer\)/my-postings --silent` PASS → 커밋: `fix(jobs): 저장 직후 뒤로가기 stale 미저장 경고 제거 — unsaved guard markClean(S3 이월)`

### Task 6: S3 이월 테스트 하드닝 (테스트 전용 + 주석 2건)

**Files:**
- Modify: `uniqn-mobile/src/components/employer/order-sheet/__tests__/OrderSheetScreen.edit.test.tsx` (가드 3종+ghost 렌더 추가)
- Modify: `uniqn-mobile/src/utils/order-sheet/__tests__/orderSheetTestHelpers.ts` (stripIds 이주·경로 스코프) + `mappers.test.ts:52-53`·`mappers.update.test.ts:12-13`(로컬 정의 제거, 헬퍼 import)
- Modify(주석): `uniqn-mobile/src/utils/order-sheet/__tests__/mappers.update.test.ts:1-8` 헤더에 "위임 해제 시 실질 게이트" 명기

**Interfaces:**
- Consumes: Task 1(onSwitchToLegacyForm 소멸된 props 형상).
- Produces: `stripKnownGeneratedIds(obj)` — orderSheetTestHelpers export.

- [ ] **Step 1: scheduleLocked 부가 가드 테스트 3종.** OrderSheetScreen.edit.test.tsx의 기존 렌더 관례(baseProps+mode='edit'+scheduleLocked)를 따라 추가 — 실측 testID: 그룹 삭제 `order-sheet-group-delete-${gi}`(:701) · 일정 추가 `order-sheet-add-schedule`(:725) · 날짜 시트 제목 '날짜 선택'(파일 헤더 관례).

```tsx
it('잠금: 그룹 삭제 버튼이 토스트만 내고 그룹을 제거하지 않는다', async () => {
  // 2그룹 initialValues로 렌더(삭제 버튼은 2그룹부터 노출) — 기존 스위트의 그룹 픽스처 재사용
  // fireEvent.press(getByTestId('order-sheet-group-delete-0'))
  // expect(addToast).toHaveBeenCalledWith(expect.objectContaining({ type: 'warning' }))
  // expect(queryAllByTestId(/order-sheet-group-dates-/)).toHaveLength(2) — 그룹 수 불변
});
it('잠금: 일정 추가 버튼이 날짜 시트를 열지 않는다', async () => {
  // fireEvent.press(getByTestId('order-sheet-add-schedule'))
  // expect(queryByText('날짜 선택')).toBeNull() + 토스트 warning 1회
});
it('잠금 토스트 문구 고정 — 확정 지원자 안내', async () => {
  // expect(addToast).toHaveBeenCalledWith(expect.objectContaining({
  //   message: '확정된 지원자가 있어 일정과 역할은 수정할 수 없어요.' }))
});
```

(주석 골격은 의도 — 실제 코드는 이 파일의 기존 toast mock·픽스처 헬퍼를 그대로 재사용해 완성한다. 기존 스위트가 이미 mock한 toastStore 형상과 다르게 새 mock을 만들지 말 것.)
- [ ] **Step 2: edit 템플릿 저장 렌더 테스트(ghost 이월 ③).** mode='edit'+`onSaveTemplate` 전달 렌더 → `getByTestId('order-sheet-edit-save-template')`(:744) 존재 + press 시 `onSaveTemplate`이 현재 폼 값으로 1회 호출.
- [ ] **Step 3: stripIds 경로 스코프(이월 ①).** 두 파일의 동일 로컬 헬퍼를 orderSheetTestHelpers로 단일화하고, 전 깊이 무차별 제거 대신 **알려진 생성 id 경로만** 제거 + 예상 밖 id 발견 시 throw:

```ts
/** draft/values의 하네스 생성 id(scheduleGroups·timeSlots·roles·requirements)만 제거.
 *  알려지지 않은 깊이의 id는 의미 있는 필드일 수 있어 throw — 침묵 통과 금지(S3 T1 이월). */
export function stripKnownGeneratedIds(obj: unknown): unknown {
  const KNOWN_PARENTS = new Set(['scheduleGroups', 'timeSlots', 'roles', 'requirements']);
  const walk = (node: unknown, parentArrayKey: string | null): unknown => {
    if (Array.isArray(node)) return node.map((v) => walk(v, parentArrayKey));
    if (node && typeof node === 'object') {
      return Object.fromEntries(
        Object.entries(node as Record<string, unknown>).flatMap(([k, v]) => {
          if (k === 'id') {
            if (parentArrayKey && KNOWN_PARENTS.has(parentArrayKey)) return [];
            throw new Error(`예상 밖 id 경로: ${parentArrayKey ?? '(root)'} — stripIds 화이트리스트 재검토`);
          }
          return [[k, walk(v, Array.isArray(v) ? k : null)]];
        })
      );
    }
    return node;
  };
  return walk(obj, null);
}
```

두 테스트 파일에서 `stripIds` 호출부를 `stripKnownGeneratedIds`로 치환하고 GREEN 확인(throw가 나면 화이트리스트 누락 실측 — 해당 경로가 생성 id인지 mappers.ts/draftAdapter.ts의 generateId 부여 지점과 대조 후 추가).
- [ ] **Step 4: T1 등가성 명기 + 프리셋 주석 재확인.** mappers.update.test.ts 헤더(:3)에 한 줄 추가: `위임 구조(valuesToUpdateInput→draftToUpdateJobPostingInput)에서는 동어반복이며, 위임을 해제(mappers 자체 조립)하는 순간 이 스위트가 실질 등가성 게이트가 된다(S3 최종리뷰 명기).` — create.tsx:97-98 프리셋 주석은 실측상 이미 S2에서 갱신됨(S1 이월 ⑤ 해소 확인만, 무변경).
- [ ] **Step 5: 게이트+커밋.** `npx jest src/components/employer/order-sheet src/utils/order-sheet --silent` PASS → 커밋: `test(jobs): 잠금 가드·편집 템플릿 저장 렌더·stripIds 경로 스코프 — S3 이월 정리(S4)`

### Task 7: knip 래칫 하향 + 최종 게이트

**Files:**
- Modify: `uniqn-mobile/package.json:16` (`knip:gate` max-issues 하향)

**Interfaces:**
- Consumes: Task 1~6 전부.
- Produces: 브랜치 전체 green 증거(최종 리뷰·머지 입력).

- [ ] **Step 1: knip 실측.** 실행: `cd uniqn-mobile && npx knip --max-issues=0 2>&1 | grep -E '^(Unused|Duplicate)'` → 섹션별 합산. 기대: 2363 대비 순감(레거시 폼이 얹은 미사용 export/type 소거). **함정**: `knip.ignoreDependencies`의 mmkv/nitro/babel/expo-modules-core 항목 제거 금지(Configuration hints가 제거를 권해도 무시 — peer-only 네이티브 오탐, `pitfall_knip_falsepositive_build_config`).
- [ ] **Step 2: 래칫 하향.** package.json `"knip:gate": "knip --max-issues=<실측 합산치>"`로 갱신(현행 2344 → 실측치. 실측치가 2344보다 크면 원인 목록을 컨트롤러에 보고하고 중단). 실행: `npm run knip:gate; echo EXIT=$?` → 기대: EXIT=0.
- [ ] **Step 3: 전체 게이트.** `cd uniqn-mobile && npm run quality` → EXIT 0. `npx jest src/utils src/types src/components/employer src/domains/job-posting app/\(employer\) src/__tests__/hooks --silent` → 전 스위트 PASS(수치 기록). `git diff --stat origin/master...HEAD -- supabase src/domains/job-posting/serialization.ts` 관련 산출 0 확인(로컬 master 기준도 병기).
- [ ] **Step 4: 커밋**: `chore(jobs): knip 래칫 하향 — S4 은퇴분 반영(게이트 EXIT 0)`

## Self-Review 결과

- 범위 대조: 핸드오프 S4 항목 ①레거시 폼(T1·T2) ②create 사문(T1) ③onSwitchToLegacyForm(T1) ④레거시 유틸(T3·T4) ⑤knip(T7) ⑥S3 이월 5건(①T6-3 ②T6-1 ③T6-2 ④T5 ⑤T6-4 확인) — 전항 매핑 완료.
- 서버 무변경·conditions 계약 보존 가드 각 태스크에 내장.
- 알려진 편차: Task 3/4/6 테스트 수술은 disposition 표+렌즈 패턴+골격 제공(전문 복붙 아님) — 구현자가 기존 픽스처 관례를 재사용해야 하며, per-task fable 리뷰가 계약 보존을 판정한다.
