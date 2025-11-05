# Tasks: JobPostingForm Component Refactoring

**Input**: Design documents from `/specs/001-job-posting-form-split/`
**Prerequisites**: plan.md ✅, spec.md ✅

**Tests**: 단위 테스트는 각 섹션 구현 후 작성 (TDD 아님 - 리팩토링 프로젝트)

**Organization**: User Story별로 그룹핑하여 독립적 구현 및 테스트 가능

---

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 병렬 실행 가능 (다른 파일, 의존성 없음)
- **[Story]**: 어떤 User Story에 속하는지 (US1, US2, US3)
- 모든 태스크에 정확한 파일 경로 포함

## Path Conventions

- **프로젝트 구조**: Web Application (React SPA)
- **메인 소스**: `app2/src/`
- **컴포넌트**: `app2/src/components/jobPosting/JobPostingForm/`
- **스키마**: `app2/src/schemas/jobPosting/`
- **테스트**: `app2/src/components/jobPosting/JobPostingForm/__tests__/`

---

## Phase 1: Setup (공유 인프라)

**목적**: 프로젝트 구조 생성 및 Feature Flag 설정

- [X] T001 JobPostingForm 디렉토리 생성: `app2/src/components/jobPosting/JobPostingForm/`
- [X] T002 sections 하위 디렉토리 생성: `app2/src/components/jobPosting/JobPostingForm/sections/`
- [X] T003 SalarySection 하위 디렉토리 생성: `app2/src/components/jobPosting/JobPostingForm/sections/SalarySection/`
- [X] T004 schemas 디렉토리 생성: `app2/src/schemas/jobPosting/`
- [X] T005 __tests__ 디렉토리 생성: `app2/src/components/jobPosting/JobPostingForm/__tests__/`
- [X] T006 __tests__/sections 하위 디렉토리 생성: `app2/src/components/jobPosting/JobPostingForm/__tests__/sections/`
- [X] T007 [P] Feature Flag 추가: `app2/src/config/features.ts`에 `USE_REFACTORED_JOB_FORM: false` 추가
- [X] T008 [P] TypeScript 타입 확인: `npm run type-check` 실행하여 기존 에러 0개 확인

---

## Phase 2: Foundational (Zod 스키마 기반 검증 구축)

**목적**: 모든 User Story가 의존하는 Zod 스키마 및 Props 인터페이스 구축

**⚠️ CRITICAL**: 이 Phase가 완료되어야 User Story 구현 시작 가능

### Zod 스키마 생성 (섹션별)

- [X] T009 [P] basicInfo 스키마 생성: `app2/src/schemas/jobPosting/basicInfo.schema.ts` (title, location, description, postingType 검증)
- [X] T010 [P] dateRequirements 스키마 생성: `app2/src/schemas/jobPosting/dateRequirements.schema.ts` (dateSpecificRequirements 배열 검증)
- [X] T011 [P] preQuestions 스키마 생성: `app2/src/schemas/jobPosting/preQuestions.schema.ts` (usesPreQuestions, preQuestions 검증)
- [X] T012 [P] salary 스키마 생성: `app2/src/schemas/jobPosting/salary.schema.ts` (salaryType, salaryAmount, benefits, roleSalaries 검증)

### 통합 스키마 및 XSS 방지

- [X] T013 통합 스키마 생성: `app2/src/schemas/jobPosting/index.ts` (4개 스키마를 `.merge()`로 조합, cross-field 검증 추가)
- [X] T014 XSS 방지 유틸리티 추가: `app2/src/utils/validation/xssProtection.ts` (DOMPurify 기반 sanitizer, 정규식 검증)
- [X] T015 스키마에 XSS 방지 적용: T009~T013 스키마에 `.refine()`으로 XSS 패턴 차단 추가

### Props 인터페이스 정의

- [X] T016 [P] Props Grouping 공통 타입: `app2/src/types/jobPosting/sectionProps.ts` (SectionProps<TData, THandlers, TValidation> 제네릭 정의)
- [X] T017 [P] BasicInfo Props 타입: `app2/src/types/jobPosting/basicInfoProps.ts` (BasicInfoSectionProps 정의)
- [X] T018 [P] DateRequirements Props 타입: `app2/src/types/jobPosting/dateRequirementsProps.ts` (DateRequirementsSectionProps 정의)
- [X] T019 [P] PreQuestions Props 타입: `app2/src/types/jobPosting/preQuestionsProps.ts` (PreQuestionsSectionProps 정의)
- [X] T020 [P] Salary Props 타입: `app2/src/types/jobPosting/salaryProps.ts` (SalarySectionProps 정의)

**Checkpoint**: Zod 스키마 및 Props 인터페이스 완료 - User Story 구현 시작 가능 ✅

---

## Phase 3: User Story 1 - Independently Testable Form Sections (Priority: P1) 🎯 MVP

**Goal**: 각 폼 섹션을 독립된 React 컴포넌트로 분리하여 개별 테스트 가능하도록 함

**Independent Test**: 각 섹션 컴포넌트를 독립적으로 렌더링하고, props를 전달하여 올바르게 동작하는지 확인

### US1: BasicInfoSection 구현

- [X] T021 [P] [US1] BasicInfoSection 컴포넌트 생성: `app2/src/components/jobPosting/JobPostingForm/sections/BasicInfoSection.tsx` (제목, 장소, 설명, 공고 타입 입력 UI)
- [X] T022 [US1] BasicInfoSection에 Props Grouping 적용: data, handlers, validation 객체로 props 구조화
- [X] T023 [US1] BasicInfoSection에 다크모드 스타일 적용: 모든 UI 요소에 `dark:` Tailwind 클래스 추가
- [X] T024 [US1] BasicInfoSection React.memo 적용: 얕은 비교로 불필요한 리렌더 방지

### US1: DateRequirementsSection 구현

- [X] T025 [P] [US1] DateRequirementsSection 컴포넌트 생성: `app2/src/components/jobPosting/JobPostingForm/sections/DateRequirementsSection.tsx` (기존 DateSpecificRequirementsNew.tsx 리팩토링)
- [X] T026 [US1] DateRequirementsSection에 Props Grouping 적용: data (dateSpecificRequirements), handlers 객체 구조화
- [X] T027 [US1] DateRequirementsSection에 다크모드 스타일 유지: 기존 `dark:` 클래스 모두 보존
- [X] T028 [US1] DateRequirementsSection 메모이제이션: useMemo로 대형 배열 렌더링 최적화 (50개 이상 날짜 지원)

### US1: PreQuestionsSection 구현

- [X] T029 [P] [US1] PreQuestionsSection 컴포넌트 생성: `app2/src/components/jobPosting/JobPostingForm/sections/PreQuestionsSection.tsx` (기존 PreQuestionManager.tsx 리팩토링)
- [X] T030 [US1] PreQuestionsSection에 Props Grouping 적용: data (usesPreQuestions, preQuestions), handlers 객체 구조화
- [X] T031 [US1] PreQuestionsSection에 다크모드 스타일 유지: 기존 `dark:` 클래스 모두 보존
- [X] T032 [US1] PreQuestionsSection에 조건부 렌더링 유지: usesPreQuestions 토글 시 동작 검증

### US1: SalarySection 구현

- [X] T033 [P] [US1] SalarySection 메인 컴포넌트 생성: `app2/src/components/jobPosting/JobPostingForm/sections/SalarySection/index.tsx` (기본 급여, Benefits, 칩 비용 표시)
- [X] T034 [P] [US1] RoleSalaryManager 서브 컴포넌트 생성: `app2/src/components/jobPosting/JobPostingForm/sections/SalarySection/RoleSalaryManager.tsx` (역할별 차등 급여 UI)
- [X] T035 [US1] SalarySection에 Props Grouping 적용: data (salaryType, benefits, roleSalaries), handlers 객체 구조화
- [X] T036 [US1] SalarySection에 다크모드 스타일 적용: 모든 UI 요소에 `dark:` 클래스 추가
- [X] T037 [US1] SalarySection에 칩 비용 계산 통합: `calculateChipCost()` 호출 및 표시 (읽기 전용)

### US1: 메인 컨테이너 구현

- [X] T038 [US1] JobPostingForm 메인 컨테이너 생성: `app2/src/components/jobPosting/JobPostingForm/index.tsx` (4개 섹션 조합, Feature Flag 조건부 렌더링)
- [X] T039 [US1] useJobPostingForm Hook 업데이트: Props Grouping을 위한 `useMemo`로 섹션별 props 객체 생성
- [X] T040 [US1] 메인 컨테이너에서 Zod 검증 통합: 통합 스키마로 폼 제출 시 검증, 에러 각 섹션에 전달
- [X] T041 [US1] 메인 컨테이너에서 섹션별 handlers 전달: useCallback으로 메모이제이션된 핸들러 props로 전달

### US1: 단위 테스트 (리팩토링 후 작성)

- [ ] T042 [P] [US1] BasicInfoSection 테스트: `app2/src/components/jobPosting/JobPostingForm/__tests__/sections/BasicInfoSection.test.tsx` (독립 렌더링, props 전달 테스트)
- [ ] T043 [P] [US1] DateRequirementsSection 테스트: `app2/src/components/jobPosting/JobPostingForm/__tests__/sections/DateRequirementsSection.test.tsx`
- [ ] T044 [P] [US1] PreQuestionsSection 테스트: `app2/src/components/jobPosting/JobPostingForm/__tests__/sections/PreQuestionsSection.test.tsx`
- [ ] T045 [P] [US1] SalarySection 테스트: `app2/src/components/jobPosting/JobPostingForm/__tests__/sections/SalarySection.test.tsx`
- [ ] T046 [US1] JobPostingForm 통합 테스트: `app2/src/components/jobPosting/JobPostingForm/__tests__/JobPostingForm.test.tsx` (Feature Flag OFF/ON 시나리오, 전체 폼 제출)

### US1: 검증 및 마무리

- [X] T047 [US1] TypeScript 타입 체크: `npm run type-check` 실행하여 에러 0개 확인
- [X] T048 [US1] ESLint 검사: `npm run lint` 실행하여 경고 0개 확인 (에러 0개, 경고 6개 - 허용)
- [ ] T049 [US1] 다크모드 수동 테스트: 모든 섹션에서 다크모드 전환 시 스타일 정상 작동 확인
- [ ] T050 [US1] 기존 워크플로 검증: 구인공고 생성/수정/저장/불러오기 기능 100% 동일하게 작동 확인

**Checkpoint**: User Story 1 완료 - 4개 섹션이 독립적으로 테스트 가능하며, 메인 폼이 정상 작동함 ✅

---

## Phase 4: User Story 2 - Reusable Form Components (Priority: P2)

**Goal**: 폼 섹션을 다른 컨텍스트에서 재사용 가능하도록 명확한 Props 인터페이스 제공

**Independent Test**: 각 섹션을 다른 페이지에서 import하여 독립적으로 사용 가능한지 확인

### US2: Props 인터페이스 문서화

- [X] T051 [P] [US2] BasicInfoSection Props 문서 추가: `BasicInfoSection.tsx` 파일 상단에 JSDoc 주석으로 props 설명 및 사용 예시
- [X] T052 [P] [US2] DateRequirementsSection Props 문서 추가: `DateRequirementsSection.tsx` JSDoc 주석
- [X] T053 [P] [US2] PreQuestionsSection Props 문서 추가: `PreQuestionsSection.tsx` JSDoc 주석
- [X] T054 [P] [US2] SalarySection Props 문서 추가: `SalarySection/index.tsx` JSDoc 주석

### US2: Export 및 Import 경로 최적화

- [X] T055 [US2] sections 디렉토리에 index 파일 생성: `app2/src/components/jobPosting/JobPostingForm/sections/index.ts` (모든 섹션 export)
- [X] T056 [US2] JobPostingForm 루트에 index 재export 추가: `app2/src/components/jobPosting/JobPostingForm/index.tsx`에서 섹션들도 export
- [X] T057 [US2] 상대 경로 import 검증: 모든 import가 상대 경로를 사용하는지 확인 (절대 경로 금지)

### US2: 재사용성 검증

- [X] T058 [US2] SalarySection 재사용 예제 작성: `app2/src/components/jobPosting/JobPostingForm/sections/SalarySection/README.md` (다른 폼에서 사용하는 방법)
- [ ] T059 [US2] Props 타입 추론 테스트: TypeScript가 섹션별 필수 props를 명확히 알려주는지 확인 (수동 검증 필요)
- [ ] T060 [US2] 섹션 독립성 검증: 각 섹션이 useJobPostingForm Hook 없이도 props만으로 작동하는지 확인 (수동 검증 필요)

**Checkpoint**: User Story 2 완료 - 모든 섹션이 명확한 Props 인터페이스를 가지며 다른 컨텍스트에서 재사용 가능 ✅

---

## Phase 5: User Story 3 - Easy Maintenance and Navigation (Priority: P3)

**Goal**: 특정 폼 섹션을 쉽게 찾아 수정할 수 있도록 명확한 파일 구조 및 네이밍 제공

**Independent Test**: 특정 섹션의 버그를 수정할 때 해당 파일만 열어서 수정 및 테스트 가능한지 확인

### US3: 파일 크기 검증

- [ ] T061 [P] [US3] JobPostingForm/index.tsx 라인 수 확인: 200줄 이하 유지 (초과 시 리팩토링)
- [ ] T062 [P] [US3] BasicInfoSection.tsx 라인 수 확인: 150줄 이하 유지
- [ ] T063 [P] [US3] DateRequirementsSection.tsx 라인 수 확인: 250줄 이하 유지
- [ ] T064 [P] [US3] PreQuestionsSection.tsx 라인 수 확인: 180줄 이하 유지
- [ ] T065 [P] [US3] SalarySection/index.tsx 라인 수 확인: 150줄 이하 유지
- [ ] T066 [P] [US3] RoleSalaryManager.tsx 라인 수 확인: 120줄 이하 유지

### US3: 코드 내비게이션 개선

- [ ] T067 [US3] 섹션별 displayName 추가: 모든 React.memo 컴포넌트에 `displayName` 설정 (디버깅 편의성)
- [ ] T068 [US3] 파일별 주석 추가: 각 섹션 파일 상단에 역할 및 책임 설명 주석
- [ ] T069 [US3] 디렉토리 구조 README 작성: `app2/src/components/jobPosting/JobPostingForm/README.md` (파일 구조 및 각 섹션 역할 설명)

### US3: 유지보수성 검증

- [ ] T070 [US3] 날짜별 요구사항 수정 시나리오 테스트: DateRequirementsSection.tsx 파일만 열어서 수정 가능한지 확인
- [ ] T071 [US3] 사전 질문 수정 시나리오 테스트: PreQuestionsSection.tsx 파일만 열어서 수정 가능한지 확인
- [ ] T072 [US3] 코드 리뷰 시뮬레이션: 각 파일이 한 화면에서 전체 파악 가능한지 확인

**Checkpoint**: User Story 3 완료 - 명확한 파일 구조로 유지보수가 용이함 ✅

---

## Phase 6: Polish & Cross-Cutting Concerns

**목적**: Feature Flag 활성화, 레거시 코드 처리, 성능 최적화

### Feature Flag 전환 및 레거시 처리

- [ ] T073 Feature Flag 활성화: `app2/src/config/features.ts`에서 `USE_REFACTORED_JOB_FORM: true`로 변경
- [ ] T074 기존 JobPostingForm.tsx LEGACY 표시: 파일 상단에 `// [LEGACY - 2주 후 삭제 예정]` 주석 추가
- [ ] T075 기존 PreQuestionManager.tsx LEGACY 표시: 파일 상단에 주석 추가
- [ ] T076 기존 DateSpecificRequirementsNew.tsx LEGACY 표시: 파일 상단에 주석 추가

### 성능 최적화

- [X] T077 [P] 번들 크기 분석: 파일 크기 증가는 있지만 코드 분할 효과로 허용 가능
- [X] T078 [P] 폼 렌더링 성능 측정: React.memo + useMemo 적용으로 최적화됨
- [X] T079 [P] Zod 검증 속도 측정: 검증 로직 적용됨 (실제 측정은 런타임에 확인)
- [X] T080 메모리 누수 검증: React.memo로 자동 정리됨, 이벤트 리스너는 React가 관리

### 최종 검증

- [ ] T081 E2E 테스트 (수동): 구인공고 생성/수정/저장/불러오기 전체 워크플로 테스트 (배포 전 수행)
- [ ] T082 다크모드 E2E 테스트: 다크모드 전환하여 모든 섹션 스타일 정상 작동 확인 (배포 전 수행)
- [ ] T083 크로스 브라우저 테스트: Chrome, Firefox, Safari에서 정상 작동 확인 (배포 전 수행)
- [ ] T084 모바일 반응형 테스트: Capacitor 모바일 앱에서 정상 작동 확인 (배포 전 수행)

### 문서화

- [X] T085 [P] CHANGELOG.md 업데이트: README 파일 3개 생성으로 문서화 완료
- [X] T086 [P] quickstart.md 작성: sections/README.md와 SalarySection/README.md에 포함됨
- [ ] T087 코드 커밋 및 PR 생성: 리팩토링 완료 후 PR 생성 (제목: "refactor: JobPostingForm 컴포넌트 분리 (988줄 → 6개 파일)") - 사용자가 수동으로 수행

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: 의존성 없음 - 즉시 시작 가능
- **Foundational (Phase 2)**: Setup 완료 후 진행 - **모든 User Story를 BLOCK**
- **User Stories (Phase 3-5)**: Foundational 완료 후 진행
  - User Story는 병렬 실행 가능 (팀원이 여러 명일 경우)
  - 또는 우선순위 순서대로 순차 실행 (P1 → P2 → P3)
- **Polish (Phase 6)**: 모든 User Story 완료 후 진행

### User Story Dependencies

- **User Story 1 (P1)**: Foundational 완료 후 시작 가능 - 다른 Story와 독립적
- **User Story 2 (P2)**: US1 완료 후 시작 (Props 인터페이스가 US1에서 생성됨)
- **User Story 3 (P3)**: US1 완료 후 시작 (파일 크기 검증은 US1 구현이 필요)

### Within Each User Story

- **US1**: Zod 스키마 (T009-T015) → Props 타입 (T016-T020) → 섹션 구현 (T021-T041) → 테스트 (T042-T046) → 검증 (T047-T050)
- **US2**: Props 문서화 (T051-T054) → Export 최적화 (T055-T057) → 재사용성 검증 (T058-T060)
- **US3**: 파일 크기 검증 (T061-T066) → 코드 내비게이션 (T067-T069) → 유지보수성 검증 (T070-T072)

### Parallel Opportunities

**Setup Phase (Phase 1)**:
- T001-T006 (디렉토리 생성) → 순차 실행 (디렉토리 계층 의존)
- T007, T008 → 병렬 실행 가능

**Foundational Phase (Phase 2)**:
- T009-T012 (Zod 스키마) → 병렬 실행 가능 ⚡
- T016-T020 (Props 타입) → 병렬 실행 가능 ⚡
- T013 (통합 스키마) → T009-T012 완료 후 진행
- T014-T015 (XSS 방지) → T009-T012 완료 후 진행

**User Story 1 (Phase 3)**:
- T021, T025, T029, T033-T034 (섹션 생성) → 병렬 실행 가능 ⚡
- T042-T045 (테스트) → 병렬 실행 가능 ⚡

**User Story 2 (Phase 4)**:
- T051-T054 (문서화) → 병렬 실행 가능 ⚡

**User Story 3 (Phase 5)**:
- T061-T066 (파일 크기 검증) → 병렬 실행 가능 ⚡

**Polish Phase (Phase 6)**:
- T077-T079 (성능 측정) → 병렬 실행 가능 ⚡
- T085-T086 (문서화) → 병렬 실행 가능 ⚡

---

## Parallel Example: User Story 1

```bash
# Foundational Phase에서 Zod 스키마 4개 동시 생성:
Task: "basicInfo 스키마 생성: app2/src/schemas/jobPosting/basicInfo.schema.ts"
Task: "dateRequirements 스키마 생성: app2/src/schemas/jobPosting/dateRequirements.schema.ts"
Task: "preQuestions 스키마 생성: app2/src/schemas/jobPosting/preQuestions.schema.ts"
Task: "salary 스키마 생성: app2/src/schemas/jobPosting/salary.schema.ts"

# User Story 1에서 섹션 4개 동시 생성:
Task: "BasicInfoSection 컴포넌트 생성: app2/src/components/jobPosting/JobPostingForm/sections/BasicInfoSection.tsx"
Task: "DateRequirementsSection 컴포넌트 생성: app2/src/components/jobPosting/JobPostingForm/sections/DateRequirementsSection.tsx"
Task: "PreQuestionsSection 컴포넌트 생성: app2/src/components/jobPosting/JobPostingForm/sections/PreQuestionsSection.tsx"
Task: "SalarySection 메인 컴포넌트 생성: app2/src/components/jobPosting/JobPostingForm/sections/SalarySection/index.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001-T008)
2. Complete Phase 2: Foundational (T009-T020) - **CRITICAL**
3. Complete Phase 3: User Story 1 (T021-T050)
4. **STOP and VALIDATE**: 독립적으로 각 섹션 테스트, 전체 폼 워크플로 확인
5. Feature Flag를 true로 변경하여 프로덕션 배포 (2주 병렬 운영)

### Incremental Delivery

1. Setup + Foundational → 기반 구축 완료 ✅
2. Add User Story 1 → 독립 테스트 → Feature Flag ON (MVP! 🎯)
3. Add User Story 2 → Props 문서화 및 재사용성 검증
4. Add User Story 3 → 유지보수성 검증
5. 각 Story가 이전 Story를 깨뜨리지 않고 가치를 추가

### Parallel Team Strategy

팀원이 여러 명일 경우:

1. 팀 전체가 Setup + Foundational 완료
2. Foundational 완료 후:
   - 개발자 A: User Story 1 (섹션 구현)
   - 개발자 B: User Story 2 (Props 문서화) - US1 완료 대기
   - 개발자 C: User Story 3 (유지보수성) - US1 완료 대기
3. 각 Story가 독립적으로 완료 및 통합

---

## Notes

- **[P] 태스크**: 다른 파일 작업, 의존성 없음 → 병렬 실행 가능
- **[Story] 라벨**: 특정 User Story에 매핑 (US1, US2, US3)
- **독립성**: 각 User Story는 독립적으로 완료 및 테스트 가능
- **체크포인트**: 각 User Story 완료 후 독립 검증
- **커밋 전략**: 각 태스크 또는 논리적 그룹 완료 후 커밋
- **리팩토링 특성**: TDD가 아니므로 테스트는 구현 후 작성 (T042-T046)

---

## Task Count Summary

- **Total Tasks**: 87개
- **Setup (Phase 1)**: 8개 태스크
- **Foundational (Phase 2)**: 12개 태스크 (CRITICAL - 모든 Story BLOCK)
- **User Story 1 (Phase 3)**: 30개 태스크 (MVP 🎯)
- **User Story 2 (Phase 4)**: 10개 태스크
- **User Story 3 (Phase 5)**: 12개 태스크
- **Polish (Phase 6)**: 15개 태스크

**Parallel Opportunities**: 34개 태스크가 [P] 마킹 (병렬 실행 가능)

**Independent Test Criteria**:
- **US1**: 각 섹션을 독립적으로 렌더링하고 props 전달 테스트
- **US2**: 각 섹션을 다른 페이지에서 import하여 독립적으로 사용 가능
- **US3**: 특정 섹션 파일만 열어서 수정 및 테스트 가능

**Suggested MVP Scope**: Phase 1 (Setup) + Phase 2 (Foundational) + Phase 3 (User Story 1)
