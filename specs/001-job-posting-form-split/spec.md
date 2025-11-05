# Feature Specification: JobPostingForm Component Refactoring

**Feature Branch**: `001-job-posting-form-split`
**Created**: 2025-11-05
**Updated**: 2025-11-05
**Status**: Clarified ✅
**Input**: User description: "Phase 1-4: JobPostingForm.tsx 대형 파일 분리 (988줄 → 5개 섹션 파일 + 메인 컨테이너)"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Independently Testable Form Sections (Priority: P1)

개발자는 각 폼 섹션을 독립적으로 테스트할 수 있어야 합니다. 현재 993줄의 단일 파일로 인해 특정 섹션의 테스트가 어렵고, 버그 발생 시 원인 파악이 지연됩니다.

**Why this priority**: 테스트 가능성은 코드 품질과 유지보수성의 핵심입니다. 각 섹션을 독립적으로 테스트할 수 있으면 버그를 조기에 발견하고 수정할 수 있습니다.

**Independent Test**: 각 섹션 컴포넌트(BasicInfoSection, DateRequirementsSection, PreQuestionsSection, SalarySection)를 개별적으로 렌더링하고, props를 전달하여 올바르게 동작하는지 확인할 수 있습니다.

**Acceptance Scenarios**:

1. **Given** BasicInfoSection 컴포넌트가 독립적으로 존재할 때, **When** 개발자가 해당 컴포넌트만 테스트할 때, **Then** 제목/장소/설명 입력 기능이 정상 작동해야 합니다.
2. **Given** DateRequirementsSection 컴포넌트가 분리되어 있을 때, **When** 날짜별 인원 요구사항을 추가/수정/삭제할 때, **Then** 해당 기능만 독립적으로 테스트 가능해야 합니다.
3. **Given** 각 섹션이 독립된 파일로 존재할 때, **When** TypeScript 타입 체크를 실행할 때, **Then** 각 섹션의 타입 오류를 명확하게 식별할 수 있어야 합니다.

---

### User Story 2 - Reusable Form Components (Priority: P2)

개발자는 폼 섹션을 다른 컨텍스트에서 재사용할 수 있어야 합니다. 현재 모든 로직이 하나의 파일에 결합되어 있어, 특정 섹션만 필요한 경우에도 전체 폼을 가져와야 합니다.

**Why this priority**: 컴포넌트 재사용성은 코드 중복을 줄이고 개발 속도를 향상시킵니다. 예를 들어, SalarySection은 다른 급여 관련 폼에서도 사용될 수 있습니다.

**Independent Test**: 각 섹션 컴포넌트를 다른 페이지나 폼에 import하여 독립적으로 사용할 수 있는지 확인합니다.

**Acceptance Scenarios**:

1. **Given** SalarySection이 독립된 컴포넌트로 분리되어 있을 때, **When** 개발자가 다른 급여 관련 폼에서 SalarySection을 import할 때, **Then** 추가 수정 없이 바로 사용 가능해야 합니다.
2. **Given** 각 섹션이 명확한 Props 인터페이스를 가질 때, **When** 개발자가 섹션을 새로운 컨텍스트에 통합할 때, **Then** TypeScript가 필요한 props를 명확하게 알려줘야 합니다.

---

### User Story 3 - Easy Maintenance and Navigation (Priority: P3)

유지보수 담당자는 특정 폼 섹션을 쉽게 찾아 수정할 수 있어야 합니다. 현재 993줄의 단일 파일에서는 특정 기능을 찾기 위해 많은 시간이 소요됩니다.

**Why this priority**: 코드 내비게이션과 수정 속도는 유지보수 비용과 직결됩니다. 명확한 파일 구조는 신규 개발자의 온보딩도 빠르게 합니다.

**Independent Test**: 특정 섹션(예: 사전 질문 섹션)의 버그를 수정해야 할 때, 해당 파일만 열어서 수정하고 테스트할 수 있는지 확인합니다.

**Acceptance Scenarios**:

1. **Given** 폼 섹션이 sections/ 디렉토리 내 개별 파일로 분리되어 있을 때, **When** 개발자가 날짜별 인원 요구사항 로직을 수정해야 할 때, **Then** DateRequirementsSection.tsx 파일만 열어서 수정할 수 있어야 합니다.
2. **Given** 각 파일이 300줄 이하로 유지될 때, **When** 개발자가 코드 리뷰를 진행할 때, **Then** 한 화면에서 전체 파일을 파악할 수 있어야 합니다.

---

### Edge Cases

- **대형 폼 데이터 처리**: 날짜별 인원 요구사항이 50개 이상일 때 DateRequirementsSection의 성능이 저하되지 않아야 합니다.
- **메모리 누수 방지**: 각 섹션 컴포넌트가 언마운트될 때 이벤트 리스너와 타이머가 정리되어야 합니다.
- **순환 의존성**: 섹션 간 import 순환 참조가 발생하지 않도록 해야 합니다.
- **Props 불일치**: 메인 폼과 각 섹션 간 props 인터페이스 불일치로 인한 런타임 오류가 발생하지 않아야 합니다.
- **다크모드 스타일 누락**: 분리 과정에서 다크모드 Tailwind 클래스(`dark:`)가 누락되지 않아야 합니다.

---

## Architecture Decisions *(clarified)*

### AD-001: 파일 분리 전략 - 완전 재구성 (Complete Restructuring)

**결정**: 기존 컴포넌트를 `sections/` 디렉토리로 이동 및 리팩토링하여 일관된 패턴 구축

**근거**:
- **확장성**: 일관된 네이밍과 구조로 향후 섹션 추가 용이
- **보안**: 전체 코드 리뷰 기회를 통한 보안 취약점 검증
- **의존성 관리**: 명확한 계층 구조로 순환 참조 방지
- **데이터 흐름**: 통일된 props 인터페이스로 데이터 흐름 명확화

**구현 방식**:
```
components/jobPosting/
├── JobPostingForm/
│   ├── index.tsx                    # 메인 컨테이너 (200줄)
│   └── sections/
│       ├── BasicInfoSection.tsx     # 신규 생성 (150줄)
│       ├── DateRequirementsSection.tsx  # PreQuestionManager 리팩토링 (250줄)
│       ├── PreQuestionsSection.tsx      # DateSpecificRequirementsNew 리팩토링 (180줄)
│       └── SalarySection/           # 신규 생성
│           ├── index.tsx            # 메인 급여 섹션 (150줄)
│           └── RoleSalaryManager.tsx # 역할별 급여 관리 (120줄)
└── [LEGACY] (2주 후 삭제 예정)
    ├── PreQuestionManager.tsx
    └── DateSpecificRequirementsNew.tsx
```

**리스크 완화**:
- Feature Flag를 통한 점진적 활성화 (`USE_REFACTORED_JOB_FORM`)
- 병렬 운영 2주 후 A/B 테스트 진행
- 레거시 코드는 완전 검증 후 삭제

---

### AD-002: Props 전달 패턴 - Props Grouping

**결정**: Props Drilling 방식 + 관련 props를 객체로 그룹핑

**근거**:
- **테스트 가능성**: Mock 없이 props 전달로 독립적 테스트 가능
- **재사용성**: Hook 의존성 없이 다른 컨텍스트에서 재사용 가능
- **타입 안전성**: 명시적 인터페이스로 TypeScript 타입 체크 강화
- **데이터 흐름**: 단방향 데이터 흐름 (Unidirectional Data Flow) 명확화

**구현 예시**:
```typescript
interface BasicInfoSectionProps {
  data: {
    title: string;
    location: string;
    description: string;
    postingType: PostingType;
  };
  handlers: {
    onFormChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onLocationChange: (location: string, district?: string) => void;
  };
  validation?: {
    errors: BasicInfoErrors;
    touched: Record<string, boolean>;
  };
}

// 데이터 흐름
useJobPostingForm → JobPostingForm/index.tsx → Props → Section → Events → Handlers
```

**대안 배제 이유**:
- Hook 직접 사용(Context 패턴): 테스트 시 Hook Mock 필요, 재사용성 저하
- 섹션별 커스텀 Hook: 복잡도 증가, 데이터 흐름 불명확

---

### AD-003: SalarySection 범위 - 전체 급여 도메인 통합

**결정**: 급여 관련 모든 기능을 SalarySection에 통합, 복잡한 UI는 서브 컴포넌트로 분리

**포함 기능**:
| 기능 | 포함 여부 | 구현 위치 |
|------|-----------|-----------|
| 기본 급여 타입 선택 (시급/일급/월급) | ✅ | SalarySection/index.tsx |
| 급여 금액 입력 | ✅ | SalarySection/index.tsx |
| Benefits (식비, 교통비, 숙박비) | ✅ | SalarySection/index.tsx (토글 UI) |
| 역할별 차등 급여 | ✅ | RoleSalaryManager.tsx (서브 컴포넌트) |
| 칩 비용 계산 표시 | ✅ | SalarySection/index.tsx (읽기 전용) |

**근거**:
- **도메인 응집성**: 급여 관련 모든 로직이 한 곳에 집중 (High Cohesion)
- **확장성**: 향후 보너스, 지급 일정 등 추가 기능 통합 용이
- **사용자 경험**: 급여 정보를 한 섹션에서 입력하는 것이 직관적

**Benefits를 별도 섹션으로 분리하지 않는 이유**: Benefits는 급여의 부가 요소로, 별도 섹션 생성 시 과도한 분리

---

### AD-004: 폼 검증 전략 - Zod 스키마 기반 검증

**결정**: Zod 라이브러리를 도입하여 스키마 기반 검증 및 타입 자동 생성

**근거**:
- **타입 안전성**: 스키마에서 TypeScript 타입 자동 생성 (`z.infer`)
- **보안 강화**: XSS, Injection 방지를 위한 명시적 검증 규칙
- **확장성**: 스키마 재사용 및 조합 가능 (compose, extend)
- **에러 처리**: 일관된 에러 포맷 및 다국어 메시지 지원

**구현 예시**:
```typescript
// schemas/jobPosting/basicInfo.schema.ts
import { z } from 'zod';

export const basicInfoSchema = z.object({
  title: z.string()
    .min(1, '제목을 입력하세요')
    .max(100, '제목은 100자 이하여야 합니다')
    .refine(val => !/<script>/i.test(val), {
      message: '스크립트 태그는 사용할 수 없습니다'
    }),
  location: z.string().min(1, '장소를 선택하세요'),
  description: z.string()
    .min(10, '상세 설명은 최소 10자 이상이어야 합니다')
    .max(2000, '상세 설명은 2000자 이하여야 합니다')
});

export type BasicInfoFormData = z.infer<typeof basicInfoSchema>;

// useJobPostingForm.ts
const validateBasicInfo = () => {
  try {
    basicInfoSchema.parse(formData);
    return { isValid: true, errors: {} };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        isValid: false,
        errors: error.flatten().fieldErrors
      };
    }
  }
};
```

**대안 배제 이유**:
- 중앙 집중식 수동 검증: 타입 불일치 위험, 보안 규칙 누락 가능성
- 섹션별 분산 검증: 검증 로직 중복, 일관성 결여

---

### AD-005: 디렉토리 구조 - Nested sections 디렉토리

**결정**: `JobPostingForm/` 디렉토리 생성 후 `sections/` 서브 디렉토리로 섹션 컴포넌트 그룹핑

**최종 구조**:
```
components/jobPosting/
├── JobPostingForm/
│   ├── index.tsx                    # 메인 컨테이너
│   ├── sections/
│   │   ├── BasicInfoSection.tsx
│   │   ├── DateRequirementsSection.tsx
│   │   ├── PreQuestionsSection.tsx
│   │   └── SalarySection/
│   │       ├── index.tsx
│   │       └── RoleSalaryManager.tsx
│   └── __tests__/                   # 테스트 파일
│       ├── JobPostingForm.test.tsx
│       └── sections/
│           ├── BasicInfoSection.test.tsx
│           ├── DateRequirementsSection.test.tsx
│           ├── PreQuestionsSection.test.tsx
│           └── SalarySection.test.tsx
├── [LEGACY - 2주 후 삭제]
│   ├── PreQuestionManager.tsx
│   └── DateSpecificRequirementsNew.tsx
└── modals/
```

**근거**:
- **명확한 계층 구조**: 폼 관련 파일들이 한 디렉토리에 집중
- **의존성 관리**: 섹션 간 순환 참조 방지 (sections/는 index.tsx에만 의존)
- **테스트 구조**: 테스트 파일이 컴포넌트 구조와 병렬로 위치
- **확장성**: 향후 `hooks/`, `utils/` 등 추가 서브 디렉토리 생성 용이

**Import 경로 예시**:
```typescript
// ✅ 명확하고 확장 가능
import { BasicInfoSection } from './JobPostingForm/sections/BasicInfoSection';
import { SalarySection } from './JobPostingForm/sections/SalarySection';
```

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: 시스템은 기존 JobPostingForm.tsx의 모든 기능을 100% 유지해야 합니다 (구인공고 생성, 수정, 검증, 저장, 불러오기).
- **FR-002**: 각 폼 섹션(BasicInfoSection, DateRequirementsSection, PreQuestionsSection, SalarySection)은 독립된 React 컴포넌트로 분리되어야 합니다.
- **FR-003**: 각 섹션 컴포넌트는 Props Grouping 패턴을 사용하여 `data`, `handlers`, `validation` 객체로 props를 그룹핑해야 합니다 (AD-002 참조).
- **FR-004**: 메인 컨테이너(JobPostingForm/index.tsx)는 각 섹션을 조합하고, 전체 폼 상태를 useJobPostingForm Hook으로 관리해야 합니다.
- **FR-005**: 폼 검증 로직은 Zod 스키마 기반으로 구현되어야 하며, 각 섹션별 스키마를 정의해야 합니다 (AD-004 참조).
- **FR-006**: SalarySection은 기본 급여, Benefits, 역할별 차등 급여, 칩 비용 계산 표시를 모두 포함해야 하며, RoleSalaryManager를 서브 컴포넌트로 분리해야 합니다 (AD-003 참조).
- **FR-007**: 모든 컴포넌트는 다크모드 스타일(`dark:` Tailwind 클래스)을 유지해야 합니다.
- **FR-008**: 성능 최적화를 위해 메모이제이션(`React.memo`, `useMemo`, `useCallback`)이 적절히 적용되어야 합니다.
- **FR-009**: TypeScript strict mode를 100% 준수해야 하며, `any` 타입 사용이 금지됩니다.
- **FR-010**: 각 파일은 300줄 이하로 유지되어야 합니다 (index.tsx: 200줄, 섹션: 250줄 이하).
- **FR-011**: API 호출 방식과 데이터 구조는 변경되지 않아야 합니다.
- **FR-012**: 기존 PreQuestionManager.tsx와 DateSpecificRequirementsNew.tsx는 리팩토링 후 LEGACY로 표시하고, 2주 검증 기간 후 삭제해야 합니다 (AD-001 참조).
- **FR-013**: Feature Flag(`USE_REFACTORED_JOB_FORM`)를 통해 리팩토링된 폼과 기존 폼을 병렬 운영할 수 있어야 합니다.

### Key Entities

- **JobPostingFormData**: 구인공고 폼의 전체 데이터 구조 (제목, 장소, 설명, 날짜별 요구사항, 사전 질문, 급여 정보 포함)
- **DateRequirement**: 특정 날짜의 인원 요구사항 (날짜, 필요 인원 수, 역할, 시간대)
- **PreQuestion**: 지원자에게 묻는 사전 질문 (질문 텍스트, 필수 여부, 옵션)
- **SalaryInfo**: 급여 정보 (급여 타입, 금액, Benefits, 역할별 차등 급여)
- **SectionProps**: 각 섹션 컴포넌트가 받는 props 인터페이스 (data, handlers, validation 객체로 그룹핑)
- **ValidationSchema**: Zod 스키마 객체 (basicInfoSchema, dateRequirementsSchema, preQuestionsSchema, salarySchema)
- **ValidationErrors**: 섹션별 검증 에러 타입 (BasicInfoErrors, DateRequirementsErrors, PreQuestionsErrors, SalaryErrors)

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: JobPostingForm/index.tsx는 200줄 이하, 각 섹션 파일은 250줄 이하로 유지됩니다.
- **SC-002**: 디렉토리 구조가 AD-005에 정의된 대로 생성되어야 합니다 (JobPostingForm/, sections/, __tests__/).
- **SC-003**: `npm run type-check` 실행 시 TypeScript 에러가 0개여야 합니다.
- **SC-004**: `npm run lint` 실행 시 ESLint 경고가 0개여야 합니다.
- **SC-005**: 기존 구인공고 생성 워크플로우가 변경 없이 100% 동일하게 작동해야 합니다 (사용자가 차이를 느끼지 못함).
- **SC-006**: 기존 구인공고 수정 워크플로우가 변경 없이 100% 동일하게 작동해야 합니다.
- **SC-007**: Zod 스키마 기반 폼 검증이 정상 작동하며, 기존과 동일한 검증 규칙을 유지해야 합니다.
- **SC-008**: 다크모드 전환 시 모든 폼 섹션이 올바른 다크모드 스타일을 표시해야 합니다.
- **SC-009**: 각 섹션 컴포넌트가 Props Grouping 패턴(data, handlers, validation)을 사용하여 독립적으로 테스트 가능해야 합니다.
- **SC-010**: SalarySection이 기본 급여, Benefits, 역할별 차등 급여, 칩 비용 계산 표시를 모두 포함하며, RoleSalaryManager 서브 컴포넌트가 정상 작동해야 합니다.
- **SC-011**: Feature Flag(`USE_REFACTORED_JOB_FORM`)를 통해 기존 폼과 리팩토링된 폼을 전환할 수 있어야 합니다.
- **SC-012**: 번들 크기가 기존 대비 5% 이상 증가하지 않아야 합니다 (코드 분할 효과 유지).
- **SC-013**: 각 섹션별 Zod 스키마 파일(basicInfo.schema.ts, dateRequirements.schema.ts, preQuestions.schema.ts, salary.schema.ts)이 생성되어야 합니다.

## Assumptions

- **현재 코드 상태**: JobPostingForm.tsx가 988줄이며, PreQuestionManager.tsx(6.5KB)와 DateSpecificRequirementsNew.tsx(29KB)가 별도 파일로 존재합니다.
- **Phase 1-1 완료**: useJobPostingForm.ts Hook이 이미 타입 안전성과 재사용성이 개선되어 있으며, 60개 이상의 핸들러를 반환합니다.
- **기존 테스트 케이스**: 리팩토링 후에도 기존 테스트 케이스가 통과해야 하며, 새로운 단위 테스트가 추가됩니다.
- **데이터 의존성**: 폼 섹션 간 데이터 의존성은 최소화되어 있으며, 대부분의 데이터는 useJobPostingForm Hook에서 관리됩니다.
- **다크모드 구현**: Tailwind CSS `dark:` 클래스를 사용하여 다크모드가 구현되어 있습니다.
- **Feature Flag 시스템**: 프로젝트에 Feature Flag 시스템이 구축되어 있어 `USE_REFACTORED_JOB_FORM` 플래그를 추가할 수 있습니다.
- **Zod 미설치**: 현재 프로젝트에 Zod가 설치되어 있지 않으므로, 신규 설치가 필요합니다.

## Dependencies

### Technical Dependencies
- **React 18.2+**: 기존 환경 (설치 완료)
- **TypeScript 4.9+**: Strict mode 환경 (설치 완료)
- **Tailwind CSS 3.3+**: 다크모드 클래스 지원 (설치 완료)
- **Firebase Firestore**: API 호출 방식 유지 (설치 완료)
- **Zod 3.x**: 신규 설치 필요 (5KB gzipped)
  ```bash
  cd app2
  npm install zod
  ```

### Code Dependencies
- **Phase 1-1 완료 필수**: useJobPostingForm.ts Hook의 타입 안전성 및 인터페이스 개선이 완료되어야 합니다.
- **기존 컴포넌트 유지**: 리팩토링 중에도 PreQuestionManager.tsx와 DateSpecificRequirementsNew.tsx가 정상 작동해야 합니다 (2주 병렬 운영).

### Feature Flag Dependencies
- **Feature Flag 시스템**: src/config/features.ts에 `USE_REFACTORED_JOB_FORM` 플래그 추가
- **조건부 렌더링**: 메인 페이지에서 플래그에 따라 기존/리팩토링 폼을 전환

## Out of Scope

- **UI/UX 개선**: 폼의 레이아웃, 디자인, 사용자 경험 개선은 포함하지 않습니다 (기존 디자인 100% 유지).
- **새로운 폼 필드**: 구인공고 데이터 스키마 변경이나 새로운 필드 추가는 별도 작업입니다.
- **검증 규칙 변경**: Zod로 전환하지만, 기존 검증 규칙(필수 필드, 형식, 범위)은 그대로 유지합니다.
- **성능 최적화**: 코드 분할, lazy loading, 추가 메모이제이션 등의 성능 개선은 선택 사항입니다.
- **E2E 테스트**: 통합 테스트 및 E2E 테스트 작성은 별도 Phase에서 진행합니다.
- **레거시 코드 즉시 삭제**: PreQuestionManager.tsx와 DateSpecificRequirementsNew.tsx는 2주 검증 후 삭제합니다 (즉시 삭제 금지).
- **API 변경**: Firebase Firestore API 호출 방식, 데이터 구조, 컬렉션 스키마는 변경하지 않습니다.
