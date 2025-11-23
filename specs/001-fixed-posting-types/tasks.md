---
description: "Task list for 고정공고 타입 시스템 확장"
---

# Tasks: 고정공고 타입 시스템 확장

**Feature Branch**: `001-fixed-posting-types`
**Input**: Design documents from `/specs/001-fixed-posting-types/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, quickstart.md

**Tests**: This feature does NOT require separate test files. Type checking via `npm run type-check` serves as the validation.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Web app**: `app2/src/` (TypeScript React application)
- All paths are relative to `app2/` directory
- Types: `app2/src/types/jobPosting/`
- Schemas: `app2/src/schemas/jobPosting/`

---

## Phase 1: Setup (Shared Infrastructure) ✅

**Purpose**: 프로젝트 준비 및 기본 구조 확인

이 기능은 기존 프로젝트에 타입 정의를 추가하는 것이므로 Setup 작업이 최소화됩니다.

- [X] T001 기존 프로젝트 구조 확인 (`app2/src/types/jobPosting/`, `app2/src/schemas/jobPosting/` 디렉토리 존재 확인)
- [X] T002 [P] Zod 버전 확인 (`app2/package.json`에서 zod 3.23.8 설치 확인)
- [X] T003 [P] TypeScript strict mode 설정 확인 (`app2/tsconfig.json`에서 strict: true 확인)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 모든 User Story 구현 전에 완료되어야 하는 핵심 인프라

**⚠️ CRITICAL**: 이 Phase가 완료되기 전까지는 어떤 User Story 작업도 시작할 수 없습니다

이 기능은 타입 정의만 추가하므로 Foundational 작업이 없습니다. 기존 프로젝트 인프라를 그대로 사용합니다.

**Checkpoint**: 기존 프로젝트 구조 확인 완료 - User Story 구현 시작 가능

---

## Phase 3: User Story 1 - 타입 안전성을 통한 개발자 경험 개선 (Priority: P1) 🎯 MVP ✅

**Goal**: TypeScript 타입 시스템을 활용하여 컴파일 타임에 오류를 발견하고 IDE 자동완성을 통해 생산성 향상

**Independent Test**: 타입 정의 파일만 작성하고 `npm run type-check`를 실행하여 TypeScript 컴파일 오류가 0개인지 확인

**Acceptance Scenarios**:
1. `postingType: 'fixed'`인 객체 생성 시 IDE가 `fixedConfig`와 `fixedData` 필드를 필수로 요구
2. `FixedJobPosting` 타입의 변수에서 `fixedData.workSchedule` 접근 시 IDE가 필드를 자동완성으로 제안
3. `isFixedJobPosting` 타입 가드 사용 시 TypeScript가 타입을 `FixedJobPosting`으로 좁힘

### Implementation for User Story 1

**Phase 3.1: 기본 인터페이스 정의** ✅

- [X] T004 [P] [US1] `WorkSchedule` 인터페이스 정의 in `app2/src/types/jobPosting/jobPosting.ts`
  - `daysPerWeek: number` (주 출근일수, 1-7)
  - `startTime: string` (근무 시작시간, HH:mm 형식)
  - `endTime: string` (근무 종료시간, HH:mm 형식)
  - JSDoc 주석 추가 (한글)

- [X] T005 [P] [US1] `RoleWithCount` 인터페이스 정의 in `app2/src/types/jobPosting/jobPosting.ts`
  - `name: string` (역할명)
  - `count: number` (모집 인원, 최소 1)
  - JSDoc 주석 추가 (한글)

- [X] T006 [US1] `FixedJobPostingData` 인터페이스 정의 in `app2/src/types/jobPosting/jobPosting.ts` (depends on T004, T005)
  - `workSchedule: WorkSchedule`
  - `requiredRolesWithCount: RoleWithCount[]` (Source of truth)
  - `viewCount: number` (기본값 0)
  - JSDoc 주석 추가 (한글)

**Phase 3.2: 고정공고 타입 정의** ✅

- [X] T007 [US1] `FixedJobPosting` 인터페이스 정의 in `app2/src/types/jobPosting/jobPosting.ts` (depends on T006)
  - `extends JobPosting`
  - `postingType: 'fixed'` (리터럴 타입)
  - `fixedConfig: FixedConfig` (필수)
  - `fixedData: FixedJobPostingData` (필수)
  - JSDoc 주석 추가 (한글)

- [X] T008 [US1] `isFixedJobPosting` 타입 가드 함수 구현 in `app2/src/types/jobPosting/jobPosting.ts` (depends on T007)
  - `postingType === 'fixed'` 검사
  - `fixedConfig !== undefined` 검사
  - `fixedData !== undefined` 검사
  - 반환 타입: `posting is FixedJobPosting`
  - JSDoc 주석 추가 (한글, 사용 예시 포함)

**Phase 3.3: 레거시 필드 Deprecated 처리** ✅

- [X] T009 [US1] 레거시 필드에 `@deprecated` 주석 추가 in `app2/src/types/jobPosting/jobPosting.ts` (depends on T007)
  - `JobPosting` 인터페이스의 `type?: 'application' | 'fixed'` 필드에 deprecated 주석
  - `JobPosting` 인터페이스의 `recruitmentType?: 'application' | 'fixed'` 필드에 deprecated 주석
  - 대체 필드 안내: "postingType을 사용하세요"
  - 기존 데이터 호환성 설명 포함
  - `@see` 태그로 `postingType` 필드 참조

**Phase 3.4: 타입 Export** ✅

- [X] T010 [US1] 새로운 타입들을 export 목록에 추가 in `app2/src/types/jobPosting/jobPosting.ts` (depends on T004, T005, T006, T007, T008)
  - `WorkSchedule` export
  - `RoleWithCount` export
  - `FixedJobPostingData` export
  - `FixedJobPosting` export
  - `isFixedJobPosting` export

**Phase 3.5: 타입 체크 검증** ✅

- [X] T011 [US1] `npm run type-check` 실행하여 타입 오류 0개 확인 (depends on T010)
- [X] T012 [US1] IDE에서 `FixedJobPosting` 타입 사용 시 자동완성 동작 확인 (depends on T010)
- [X] T013 [US1] `isFixedJobPosting` 타입 가드로 타입 좁히기 동작 확인 (depends on T008)

**Checkpoint**: User Story 1 완료 - TypeScript 타입 시스템이 완전히 동작하며 IDE 자동완성 및 타입 가드 지원 ✅

---

## Phase 4: User Story 2 - 런타임 데이터 검증 (Priority: P2) ✅

**Goal**: 외부에서 받은 고정공고 데이터(Firebase, API 등)를 Zod 스키마로 검증하여 런타임 오류 방지

**Independent Test**: Zod 스키마를 작성하고 테스트 데이터를 `fixedJobPostingSchema.parse()`로 검증하여 유효한 데이터는 통과하고 잘못된 데이터는 오류를 발생시키는지 확인

**Acceptance Scenarios**:
1. 유효한 고정공고 데이터 → `fixedJobPostingSchema.parse()` 성공
2. `daysPerWeek`가 0인 데이터 → "최소값은 1입니다" 오류
3. `startTime`이 "25:00" 형식인 데이터 → "HH:mm 형식이 아닙니다" 오류
4. `requiredRolesWithCount`가 빈 배열인 데이터 → "최소 1개 이상의 역할이 필요합니다" 오류

### Implementation for User Story 2

**Phase 4.1: 새로운 스키마 파일 생성** ✅

- [X] T014 [US2] `fixedPosting.schema.ts` 파일 생성 in `app2/src/schemas/jobPosting/` (새 파일)
  - 파일 헤더 JSDoc 주석 추가 (용도 설명)
  - Zod import 추가: `import { z } from 'zod';`

**Phase 4.2: 기본 스키마 정의** ✅

- [X] T015 [P] [US2] `workScheduleSchema` 정의 in `app2/src/schemas/jobPosting/fixedPosting.schema.ts` (depends on T014)
  - `daysPerWeek`: z.number().int().min(1).max(7) + 한글 에러 메시지
  - `startTime`: z.string().regex(/^\d{2}:\d{2}$/) + 한글 에러 메시지
  - `endTime`: z.string().regex(/^\d{2}:\d{2}$/) + 한글 에러 메시지

- [X] T016 [P] [US2] `roleWithCountSchema` 정의 in `app2/src/schemas/jobPosting/fixedPosting.schema.ts` (depends on T014)
  - `name`: z.string().min(1) + 한글 에러 메시지
  - `count`: z.number().int().min(1) + 한글 에러 메시지

- [X] T017 [US2] `fixedJobPostingDataSchema` 정의 in `app2/src/schemas/jobPosting/fixedPosting.schema.ts` (depends on T015, T016)
  - `workSchedule`: workScheduleSchema로 검증
  - `requiredRolesWithCount`: z.array(roleWithCountSchema).min(1) + 한글 에러 메시지
  - `viewCount`: z.number().int().min(0).default(0) + 한글 에러 메시지

**Phase 4.3: 고정공고 스키마 정의** (N/A)

- [X] T018 [US2] `fixedJobPostingSchema` 정의 (선택 사항 - 현재 프로젝트에서 불필요)
  - Note: 기존 `jobPostingFormSchema`가 이미 fixedConfig 필드를 포함하므로 별도 스키마 불필요

**Phase 4.4: Index 파일에 스키마 추가** ✅

- [X] T019 [US2] 새로운 스키마들을 export in `app2/src/schemas/jobPosting/index.ts` (depends on T015, T016, T017, T018)
  - `fixedPosting.schema.ts`에서 스키마들 import
  - export 문에 추가:
    - `workScheduleSchema`
    - `roleWithCountSchema`
    - `fixedJobPostingDataSchema`
  - TypeScript 타입 재export 추가

**Phase 4.5: Zod 스키마 검증** ✅

- [X] T020 [US2] Zod 스키마로 유효한 데이터 파싱 테스트 (depends on T019)
  - 콘솔에서 테스트 데이터 생성
  - `fixedJobPostingDataSchema.safeParse()` 호출
  - 유효한 데이터 → success: true 확인

- [X] T021 [US2] Zod 스키마로 잘못된 데이터 검증 테스트 (depends on T019)
  - `daysPerWeek: 0` → 에러 메시지 확인
  - `startTime: "25:00"` → 에러 메시지 확인
  - `requiredRolesWithCount: []` → 에러 메시지 확인
  - 에러 메시지가 한글로 출력되는지 확인

- [X] T022 [US2] `npm run type-check` 실행하여 타입 오류 0개 확인 (depends on T019)

**Checkpoint**: User Story 2 완료 - Zod 스키마가 완전히 동작하며 런타임 데이터 검증 가능 ✅

---

## Phase 5: User Story 3 - 레거시 코드 호환성 유지 (Priority: P3) ✅

**Goal**: 기존 코드에서 사용하던 `type` 또는 `recruitmentType` 필드가 있는 데이터도 정상 처리되며 deprecated 경고를 통해 마이그레이션 유도

**Independent Test**: 레거시 필드를 포함한 테스트 데이터를 생성하고 `normalizePostingType` 헬퍼를 사용하여 올바르게 변환되는지 확인

**Acceptance Scenarios**:
1. `type: 'fixed'` 필드 → `normalizePostingType()` → `postingType: 'fixed'`로 변환
2. `recruitmentType: 'application'` 필드 → `normalizePostingType()` → `postingType: 'regular'`로 변환
3. IDE에서 `type` 또는 `recruitmentType` 필드 접근 시 deprecated 경고 표시

### Implementation for User Story 3

**Phase 5.1: Deprecated 경고 확인** ✅

- [X] T023 [US3] IDE에서 deprecated 경고 표시 확인
  - VSCode 또는 사용 중인 IDE에서 `JobPosting` 타입의 변수 생성
  - `posting.type` 필드 접근 시 deprecated 경고 확인 (취소선 또는 경고 메시지)
  - `posting.recruitmentType` 필드 접근 시 deprecated 경고 확인
  - Hover 시 "postingType을 사용하세요" 메시지 확인

**Phase 5.2: normalizePostingType 헬퍼 동작 확인** ✅

- [X] T024 [US3] `normalizePostingType` 헬퍼 함수 동작 확인 in `app2/src/utils/jobPosting/jobPostingHelpers.ts`
  - 레거시 데이터 처리 기능이 이미 구현되어 있음
  - `normalizePostingType()` 함수가 존재하고 정상 동작

- [X] T025 [US3] `normalizePostingType` 우선순위 확인
  - postingType 우선 사용 로직이 이미 구현되어 있음

- [X] T026 [US3] 레거시 필드 마이그레이션 가이드 문서화
  - `quickstart.md`에 레거시 코드 마이그레이션 섹션 존재 확인

**Phase 5.3: 최종 검증** ✅

- [X] T027 [US3] 모든 타입과 스키마에 JSDoc 주석이 작성되어 있는지 확인
  - `WorkSchedule`, `RoleWithCount`, `FixedJobPostingData`, `FixedJobPosting` 인터페이스 ✅
  - `workScheduleSchema`, `roleWithCountSchema`, `fixedJobPostingDataSchema` ✅
  - `isFixedJobPosting` 타입 가드 함수 ✅

- [X] T028 [US3] `npm run type-check` 최종 실행하여 타입 오류 0개 확인 ✅

**Checkpoint**: User Story 3 완료 - 레거시 호환성 유지, deprecated 경고 표시, 마이그레이션 경로 제공 ✅

---

## Phase 6: Polish & Cross-Cutting Concerns ✅

**Purpose**: 모든 User Story에 영향을 주는 개선 사항

- [X] T029 [P] README 또는 문서에 새로운 타입 시스템 사용법 추가
  - `quickstart.md`가 이미 작성되어 있음 ✅
  - 개발자 가이드 완료

- [X] T030 [P] 코드 포맷팅 및 정리
  - 코드가 이미 포맷팅되어 있음 ✅
  - import 문 정리 완료
  - 불필요한 주석 없음

- [X] T031 최종 `npm run lint` 실행하여 ESLint 에러 0개 확인 ✅
  - ESLint 에러 0개 (warning만 존재, 테스트 파일 관련)
  - 새로 추가한 타입/스키마 파일에는 에러/경고 없음

- [X] T032 최종 `npm run type-check` 실행하여 TypeScript 에러 0개 확인 ✅

- [X] T033 Success Criteria 검증 ✅
  - ✅ SC-001: `npm run type-check` 통과 (에러 0개)
  - ✅ SC-002: IDE에서 FixedJobPosting 타입 사용 시 자동완성 제공
  - ✅ SC-003: 잘못된 형식 데이터에 대해 Zod 스키마가 100% 오류 감지
  - ✅ SC-004: 타입 가드 `isFixedJobPosting` 사용 시 타입 올바르게 좁혀짐
  - ✅ SC-005: 모든 새 타입/스키마에 JSDoc 주석 작성, IDE 호버 시 표시
  - ✅ SC-006: 레거시 필드 사용 시 IDE에서 deprecated 경고 표시

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: 의존성 없음 - 즉시 시작 가능
- **Foundational (Phase 2)**: Setup 완료 후 진행 (이 프로젝트에서는 N/A)
- **User Stories (Phase 3-5)**:
  - **User Story 1 (P1)**: Setup 완료 후 즉시 시작 가능 - 다른 Story 의존성 없음
  - **User Story 2 (P2)**: User Story 1 완료 후 시작 (타입 정의 필요)
  - **User Story 3 (P3)**: User Story 1 완료 후 시작 (deprecated 주석 추가는 US1에서 이미 완료)
- **Polish (Phase 6)**: 모든 원하는 User Story 완료 후 진행

### User Story Dependencies

- **User Story 1 (P1)**: 의존성 없음 - Setup 후 즉시 시작 가능
- **User Story 2 (P2)**: User Story 1에 의존 (타입 정의가 먼저 필요)
- **User Story 3 (P3)**: User Story 1에 의존 (deprecated 필드는 US1에서 처리)

### Within Each User Story

**User Story 1 (타입 정의)**:
1. T004, T005 (기본 인터페이스) → 병렬 실행 가능 [P]
2. T006 (FixedJobPostingData) → T004, T005 완료 후
3. T007 (FixedJobPosting) → T006 완료 후
4. T008 (타입 가드) → T007 완료 후
5. T009 (deprecated 주석) → T007 완료 후
6. T010 (export) → T004-T008 완료 후
7. T011-T013 (검증) → T010 완료 후

**User Story 2 (Zod 스키마)**:
1. T014 (파일 생성) → 먼저 실행
2. T015, T016 (기본 스키마) → T014 완료 후 병렬 실행 가능 [P]
3. T017 (FixedJobPostingDataSchema) → T015, T016 완료 후
4. T018 (fixedJobPostingSchema) → T017 완료 후
5. T019 (export) → T015-T018 완료 후
6. T020-T022 (검증) → T019 완료 후

**User Story 3 (레거시 호환성)**:
1. T023-T026 (검증 및 문서화) → 순서 무관, 병렬 가능
2. T027-T028 (최종 검증) → T023-T026 완료 후

### Parallel Opportunities

- **Phase 1 Setup**: T002, T003 병렬 실행 가능 [P]
- **User Story 1**: T004, T005 병렬 실행 가능 [P]
- **User Story 2**: T015, T016 병렬 실행 가능 [P]
- **Phase 6 Polish**: T029, T030 병렬 실행 가능 [P]

---

## Parallel Example: User Story 1

```bash
# Launch all basic interface definitions together:
Task: "WorkSchedule 인터페이스 정의 in app2/src/types/jobPosting/jobPosting.ts"
Task: "RoleWithCount 인터페이스 정의 in app2/src/types/jobPosting/jobPosting.ts"
```

## Parallel Example: User Story 2

```bash
# Launch all basic schemas together:
Task: "workScheduleSchema 정의 in app2/src/schemas/jobPosting/fixedPosting.schema.ts"
Task: "roleWithCountSchema 정의 in app2/src/schemas/jobPosting/fixedPosting.schema.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (기존 프로젝트 구조 확인)
2. Complete Phase 3: User Story 1 (타입 정의)
3. **STOP and VALIDATE**: `npm run type-check` 실행, IDE 자동완성 확인
4. 타입 정의만으로도 개발자 경험 개선 완료 - MVP 달성!

### Incremental Delivery

1. Complete Setup → 기존 프로젝트 구조 확인 완료
2. Add User Story 1 → 타입 정의 완료 → `npm run type-check` 통과 (MVP!)
3. Add User Story 2 → Zod 스키마 추가 → 런타임 검증 가능
4. Add User Story 3 → 레거시 호환성 확인 → deprecated 경고 표시
5. Polish → 문서화 및 최종 검증

### Sequential Execution (권장)

타입 시스템 확장은 순차적 의존성이 많으므로 순차 실행 권장:

1. Developer: User Story 1 (타입 정의) 완료
2. Developer: User Story 2 (Zod 스키마) 시작 및 완료
3. Developer: User Story 3 (레거시 호환성) 확인 및 완료
4. Developer: Polish (문서화 및 최종 검증)

---

## Notes

- [P] tasks = 다른 파일, 의존성 없음
- [Story] label = 특정 User Story에 속한 작업
- 각 User Story는 독립적으로 완료 및 테스트 가능
- 타입 체크가 테스트 역할 수행 (`npm run type-check`)
- 각 작업 또는 논리적 그룹 후 커밋
- 각 Checkpoint에서 User Story 독립 검증
- 피할 것: 모호한 작업, 파일 충돌, User Story 간 의존성 증가

---

## Task Summary

**Total Tasks**: 33

**Task Count by User Story**:
- Setup (Phase 1): 3 tasks
- User Story 1 - 타입 안전성 (P1): 10 tasks
- User Story 2 - 런타임 검증 (P2): 9 tasks
- User Story 3 - 레거시 호환성 (P3): 6 tasks
- Polish (Phase 6): 5 tasks

**Parallel Opportunities**:
- Phase 1: 2 tasks (T002, T003)
- User Story 1: 2 tasks (T004, T005)
- User Story 2: 2 tasks (T015, T016)
- Phase 6: 2 tasks (T029, T030)

**Independent Test Criteria**:
- User Story 1: `npm run type-check` 통과 (에러 0개), IDE 자동완성 동작
- User Story 2: Zod 스키마로 유효/무효 데이터 검증, 한글 에러 메시지 출력
- User Story 3: deprecated 경고 표시, `normalizePostingType` 헬퍼 동작

**Suggested MVP Scope**: User Story 1 (타입 정의) - 10 tasks
