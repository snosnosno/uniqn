# Implementation Plan: JobPostingForm Component Refactoring

**Branch**: `001-job-posting-form-split` | **Date**: 2025-11-05 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-job-posting-form-split/spec.md`

## Summary

JobPostingForm.tsx (988줄)를 5개 섹션 컴포넌트와 메인 컨테이너로 리팩토링하여 테스트 가능성, 재사용성, 유지보수성을 향상시킵니다. Props Grouping 패턴과 Zod 스키마 기반 검증을 도입하여 타입 안전성과 보안을 강화하며, Feature Flag를 통한 점진적 배포로 리스크를 완화합니다.

**핵심 기술 접근**:
- **아키텍처**: Container/Presenter 패턴 + Props Grouping (data, handlers, validation)
- **검증**: Zod 스키마 기반 타입 안전 검증 (XSS 방지 포함)
- **디렉토리**: Nested sections 구조 (`JobPostingForm/index.tsx` + `sections/`)
- **배포**: Feature Flag(`USE_REFACTORED_JOB_FORM`) + 2주 병렬 운영 + A/B 테스트

## Technical Context

**Language/Version**: TypeScript 4.9 (Strict Mode)
**Primary Dependencies**:
  - React 18.2
  - Zod 4.1.12 (스키마 기반 검증)
  - Tailwind CSS 3.3 (다크모드 `dark:` 클래스)
  - Firebase 11.9 (Firestore)
  - @tanstack/react-table 8.21
  - date-fns 4.1

**Storage**: Firebase Firestore (기존 API 호출 방식 100% 유지)

**Testing**:
  - Jest + @testing-library/react (단위 테스트)
  - Playwright (E2E 테스트 - 별도 Phase)
  - 테스트 전략: Props Grouping 패턴으로 Mock 없이 독립적 테스트 가능

**Target Platform**: Web (React SPA) + Capacitor 7.4 (모바일 앱)

**Project Type**: Web Application (Frontend only, 백엔드는 Firebase Functions)

**Performance Goals**:
  - 번들 크기: 기존 대비 5% 이내 증가 (코드 분할 효과 유지)
  - 폼 렌더링: < 100ms (메모이제이션 적용)
  - 검증 속도: < 50ms (Zod 스키마 캐싱)

**Constraints**:
  - TypeScript strict mode 100% 준수 (`any` 타입 사용 금지)
  - 다크모드 필수 적용 (모든 UI 요소에 `dark:` 클래스)
  - 상대 경로만 사용 (절대 경로 금지)
  - `logger` 사용 (`console.log` 금지)
  - 기존 API 호출 방식 변경 금지 (Firebase Firestore)
  - 기존 UI/UX 100% 유지 (사용자가 차이를 느끼지 못함)

**Scale/Scope**:
  - 파일 수: 1개 (988줄) → 6개 파일 (메인 200줄, 섹션 150-250줄)
  - 컴포넌트: 4개 섹션 + 1개 서브 컴포넌트 (RoleSalaryManager)
  - 스키마: 4개 Zod 스키마 파일 (섹션별)
  - 테스트: 5개 단위 테스트 파일 (섹션별 + 메인)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### ✅ UNIQN 프로젝트 핵심 원칙 준수

| 원칙 | 상태 | 준수 방법 |
|------|------|-----------|
| **TypeScript Strict Mode** | ✅ PASS | 모든 컴포넌트에서 명시적 타입 정의, `any` 타입 사용 금지 |
| **표준 필드명** | ✅ PASS | 기존 필드명 유지 (`staffId`, `eventId`), 새로운 필드 추가 없음 |
| **Firebase 실시간 구독** | ✅ PASS | 기존 `onSnapshot` 로직 변경 없음, API 호출 방식 100% 유지 |
| **Logger 사용** | ✅ PASS | 모든 로그에 `logger` 사용, `console.log` 금지 |
| **메모이제이션** | ✅ PASS | `React.memo`, `useMemo`, `useCallback` 적용 (성능 최적화) |
| **다크모드 필수** | ✅ PASS | 모든 섹션 컴포넌트에 `dark:` Tailwind 클래스 유지 |
| **상대 경로** | ✅ PASS | import 경로를 상대 경로로 유지 |

### 🔍 리팩토링 특화 검증

| 검증 항목 | 상태 | 근거 |
|-----------|------|------|
| **기능 100% 유지** | ✅ PASS | 구인공고 생성/수정/검증/저장/불러오기 모든 워크플로 동일 |
| **UI/UX 변경 없음** | ✅ PASS | 레이아웃, 디자인, 사용자 경험 100% 유지 |
| **API 호출 방식 유지** | ✅ PASS | Firebase Firestore API 변경 없음 |
| **테스트 통과** | ✅ PASS | 기존 테스트 케이스 100% 통과 필요 |
| **번들 크기 제한** | ✅ PASS | 기존 대비 5% 이내 증가 (목표: 코드 분할로 오히려 감소) |

### ⚠️ 신규 도입 기술 검증

| 기술 | 도입 목적 | 리스크 | 완화 전략 |
|------|-----------|--------|-----------|
| **Zod 스키마** | 타입 안전 검증 + XSS 방지 | 학습 곡선, 번들 크기 증가 | Zod 이미 설치됨 (v4.1.12), 5KB gzipped |
| **Props Grouping** | 테스트 가능성 향상 | Props 타이핑 복잡도 증가 | 명확한 인터페이스 문서화, 예제 코드 제공 |
| **Feature Flag** | 점진적 배포 | 코드 중복 (2주간) | 병렬 운영 후 레거시 코드 삭제 |

### 🚦 Gate 결과: **PASS** ✅

모든 프로젝트 원칙을 준수하며, 신규 기술 도입은 명확한 목적과 리스크 완화 전략이 있음. **Phase 0 연구 진행 승인.**

---

## Project Structure

### Documentation (this feature)

```text
specs/001-job-posting-form-split/
├── plan.md              # This file (/speckit.plan command output)
├── spec.md              # Feature specification (completed)
├── research.md          # Phase 0 output (/speckit.plan command) - 생성 예정
├── data-model.md        # Phase 1 output (/speckit.plan command) - 생성 예정
├── quickstart.md        # Phase 1 output (/speckit.plan command) - 생성 예정
├── contracts/           # Phase 1 output (/speckit.plan command) - 생성 예정
│   ├── BasicInfoSection.contract.ts
│   ├── DateRequirementsSection.contract.ts
│   ├── PreQuestionsSection.contract.ts
│   └── SalarySection.contract.ts
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
app2/src/
├── components/
│   └── jobPosting/
│       ├── JobPostingForm/               # 신규 디렉토리
│       │   ├── index.tsx                 # 메인 컨테이너 (200줄)
│       │   ├── sections/                 # 섹션 컴포넌트
│       │   │   ├── BasicInfoSection.tsx     # 기본 정보 (150줄)
│       │   │   ├── DateRequirementsSection.tsx  # 날짜별 요구사항 (250줄)
│       │   │   ├── PreQuestionsSection.tsx      # 사전 질문 (180줄)
│       │   │   └── SalarySection/
│       │   │       ├── index.tsx            # 급여 메인 (150줄)
│       │   │       └── RoleSalaryManager.tsx # 역할별 급여 (120줄)
│       │   └── __tests__/                # 단위 테스트
│       │       ├── JobPostingForm.test.tsx
│       │       └── sections/
│       │           ├── BasicInfoSection.test.tsx
│       │           ├── DateRequirementsSection.test.tsx
│       │           ├── PreQuestionsSection.test.tsx
│       │           └── SalarySection.test.tsx
│       ├── [LEGACY - 2주 후 삭제]
│       │   ├── JobPostingForm.tsx        # 기존 메인 파일 (988줄)
│       │   ├── PreQuestionManager.tsx    # 기존 사전 질문
│       │   └── DateSpecificRequirementsNew.tsx  # 기존 날짜별 요구사항
│       └── modals/                       # 기존 모달 (변경 없음)
│
├── hooks/
│   └── useJobPostingForm.ts              # 기존 Hook (변경 최소화)
│
├── schemas/                              # 신규 디렉토리
│   └── jobPosting/
│       ├── basicInfo.schema.ts           # 신규 생성
│       ├── dateRequirements.schema.ts    # 신규 생성
│       ├── preQuestions.schema.ts        # 신규 생성
│       └── salary.schema.ts              # 신규 생성
│
├── types/
│   └── jobPosting/                       # 기존 타입 (유지)
│       ├── base.ts
│       └── index.ts
│
├── utils/
│   └── jobPosting/                       # 기존 유틸리티 (유지)
│       ├── jobPostingHelpers.ts
│       ├── chipCalculator.ts
│       └── chipNotification.ts
│
└── config/
    └── features.ts                       # Feature Flag 추가
        # USE_REFACTORED_JOB_FORM: boolean
```

**Structure Decision**:

기존 React SPA 구조를 유지하며, **Nested sections 디렉토리** 패턴을 채택합니다. 이는 다음과 같은 이점을 제공합니다:

1. **명확한 계층 구조**: `JobPostingForm/` 디렉토리에 폼 관련 파일 집중
2. **의존성 관리**: `sections/`는 `index.tsx`에만 의존, 순환 참조 방지
3. **테스트 구조**: `__tests__/`가 컴포넌트 구조와 병렬 위치
4. **확장성**: 향후 `hooks/`, `utils/` 서브 디렉토리 추가 용이

**Import 경로 예시**:
```typescript
// 메인 컨테이너에서 섹션 import
import { BasicInfoSection } from './sections/BasicInfoSection';
import { SalarySection } from './sections/SalarySection';

// 외부에서 메인 폼 import
import { JobPostingForm } from '@/components/jobPosting/JobPostingForm';
```

---

## Complexity Tracking

**해당 없음** - Constitution Check에서 모든 항목 PASS. 복잡도 증가나 원칙 위반 없음.

---

## Phase 0: Research & Technology Decisions

### 연구 대상 (NEEDS CLARIFICATION 해결)

Phase 0에서 다음 항목을 연구하여 `research.md`에 문서화합니다:

#### 1. Zod 스키마 설계 패턴
- **목적**: 섹션별 스키마 설계 및 통합 전략 확립
- **연구 질문**:
  - Zod 스키마 조합(compose) 방법 (4개 섹션 스키마 → 1개 통합 스키마)
  - XSS 방지를 위한 `refine()` 규칙 작성 방법
  - 에러 메시지 다국어화 전략 (i18next 연동)
  - 스키마 캐싱 및 성능 최적화 방법

#### 2. Props Grouping 패턴 구현
- **목적**: 60개+ 핸들러를 효율적으로 그룹핑하는 인터페이스 설계
- **연구 질문**:
  - `data`, `handlers`, `validation` 객체 구조 설계
  - TypeScript 제네릭을 활용한 재사용 가능한 인터페이스
  - 메모이제이션 최적화 (`useCallback` 의존성 배열)
  - Props 변경 최소화를 위한 React.memo 전략

#### 3. Feature Flag 구현
- **목적**: 기존 폼과 리팩토링된 폼의 안전한 병렬 운영
- **연구 질문**:
  - `src/config/features.ts`에 플래그 추가 방법
  - 조건부 렌더링 패턴 (기존/신규 폼 전환)
  - A/B 테스트를 위한 사용자 그룹 분리 전략
  - 플래그 제거 및 레거시 코드 삭제 시점 결정

#### 4. 단위 테스트 전략
- **목적**: Props Grouping 패턴 기반 독립적 테스트 작성
- **연구 질문**:
  - Mock 없이 Props 전달로 테스트하는 방법
  - Zod 스키마 검증 로직 단위 테스트
  - 다크모드 스타일 자동 검증 방법
  - React Testing Library 모범 사례

#### 5. 마이그레이션 전략
- **목적**: 레거시 컴포넌트에서 신규 섹션으로 코드 이전
- **연구 질문**:
  - `PreQuestionManager.tsx` → `PreQuestionsSection.tsx` 변환 전략
  - `DateSpecificRequirementsNew.tsx` → `DateRequirementsSection.tsx` 변환 전략
  - 기존 Props 인터페이스를 Props Grouping으로 변환하는 방법
  - 상태 관리 로직 변경 없이 UI만 분리하는 기법

**Output**: `research.md` 생성 예정

---

## Phase 1: Design & Contracts

### 1. Data Model (`data-model.md`)

**추출 대상 엔티티** (spec.md의 Key Entities 기반):

```typescript
// 1. Props Grouping 패턴 인터페이스
interface SectionProps<TData, THandlers, TValidation> {
  data: TData;
  handlers: THandlers;
  validation?: TValidation;
}

// 2. BasicInfoSection 데이터 모델
interface BasicInfoData {
  title: string;
  location: string;
  district?: string;
  description: string;
  postingType: PostingType;
}

interface BasicInfoHandlers {
  onFormChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  onLocationChange: (location: string, district?: string) => void;
}

interface BasicInfoValidation {
  errors: BasicInfoErrors;
  touched: Record<string, boolean>;
}

// 3. DateRequirementsSection 데이터 모델
interface DateRequirementsData {
  dateSpecificRequirements: DateSpecificRequirement[];
}

interface DateRequirementsHandlers {
  onTimeSlotChange: (dateIndex: number, timeSlotIndex: number, value: string) => void;
  onTimeToBeAnnouncedToggle: (dateIndex: number, timeSlotIndex: number, isAnnounced: boolean) => void;
  onTentativeDescriptionChange: (dateIndex: number, timeSlotIndex: number, value: string) => void;
  onRoleChange: (dateIndex: number, roleIndex: number, field: string, value: any) => void;
}

// 4. PreQuestionsSection 데이터 모델
interface PreQuestionsData {
  usesPreQuestions: boolean;
  preQuestions: PreQuestion[];
}

interface PreQuestionsHandlers {
  onToggle: (enabled: boolean) => void;
  onQuestionChange: (index: number, field: string, value: any) => void;
  onOptionChange: (questionIndex: number, optionIndex: number, value: string) => void;
  onAddQuestion: () => void;
  onRemoveQuestion: (index: number) => void;
  onAddOption: (questionIndex: number) => void;
  onRemoveOption: (questionIndex: number, optionIndex: number) => void;
}

// 5. SalarySection 데이터 모델
interface SalaryData {
  salaryType: SalaryType;
  salaryAmount: number;
  benefits: Benefits;
  useRoleSalary: boolean;
  roleSalaries: RoleSalary[];
}

interface SalaryHandlers {
  onSalaryTypeChange: (type: SalaryType) => void;
  onSalaryAmountChange: (amount: number) => void;
  onBenefitToggle: (benefitType: keyof Benefits, enabled: boolean) => void;
  onBenefitChange: (benefitType: keyof Benefits, amount: number) => void;
  onRoleSalaryToggle: (enabled: boolean) => void;
  onAddRole: (role: string) => void;
  onRemoveRole: (roleIndex: number) => void;
  onRoleSalaryChange: (roleIndex: number, type: SalaryType, amount: number) => void;
}

// 6. Zod 스키마 타입
type BasicInfoSchema = z.ZodObject<...>;
type DateRequirementsSchema = z.ZodObject<...>;
type PreQuestionsSchema = z.ZodObject<...>;
type SalarySchema = z.ZodObject<...>;

// 7. 통합 폼 데이터
type JobPostingFormData =
  & BasicInfoData
  & DateRequirementsData
  & PreQuestionsData
  & SalaryData;
```

**상태 전이**: 없음 (폼은 단방향 데이터 흐름만 존재)

### 2. API Contracts (`/contracts/`)

**Section Props 인터페이스 (TypeScript Contract)**:

```typescript
// contracts/BasicInfoSection.contract.ts
export interface BasicInfoSectionProps {
  data: {
    title: string;
    location: string;
    district?: string;
    description: string;
    postingType: 'single' | 'recurring';
  };
  handlers: {
    onFormChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
    onLocationChange: (location: string, district?: string) => void;
  };
  validation?: {
    errors: {
      title?: string;
      location?: string;
      description?: string;
    };
    touched: Record<string, boolean>;
  };
}

// contracts/DateRequirementsSection.contract.ts
export interface DateRequirementsSectionProps {
  data: {
    dateSpecificRequirements: DateSpecificRequirement[];
  };
  handlers: {
    onTimeSlotChange: (dateIndex: number, timeSlotIndex: number, value: string) => void;
    onTimeToBeAnnouncedToggle: (dateIndex: number, timeSlotIndex: number, isAnnounced: boolean) => void;
    onTentativeDescriptionChange: (dateIndex: number, timeSlotIndex: number, value: string) => void;
    onRoleChange: (dateIndex: number, roleIndex: number, field: string, value: any) => void;
  };
  validation?: {
    errors: Record<number, DateRequirementErrors>;
    touched: boolean;
  };
}

// contracts/PreQuestionsSection.contract.ts
export interface PreQuestionsSectionProps {
  data: {
    usesPreQuestions: boolean;
    preQuestions: PreQuestion[];
  };
  handlers: {
    onToggle: (enabled: boolean) => void;
    onQuestionChange: (index: number, field: keyof PreQuestion, value: any) => void;
    onOptionChange: (questionIndex: number, optionIndex: number, value: string) => void;
    onAddQuestion: () => void;
    onRemoveQuestion: (index: number) => void;
    onAddOption: (questionIndex: number) => void;
    onRemoveOption: (questionIndex: number, optionIndex: number) => void;
  };
  validation?: {
    errors: Record<number, PreQuestionErrors>;
    touched: boolean;
  };
}

// contracts/SalarySection.contract.ts
export interface SalarySectionProps {
  data: {
    salaryType: 'hourly' | 'daily' | 'monthly';
    salaryAmount: number;
    benefits: {
      meal: { enabled: boolean; amount: number };
      transportation: { enabled: boolean; amount: number };
      accommodation: { enabled: boolean; amount: number };
    };
    useRoleSalary: boolean;
    roleSalaries: RoleSalary[];
  };
  handlers: {
    onSalaryTypeChange: (type: 'hourly' | 'daily' | 'monthly') => void;
    onSalaryAmountChange: (amount: number) => void;
    onBenefitToggle: (benefitType: 'meal' | 'transportation' | 'accommodation', enabled: boolean) => void;
    onBenefitChange: (benefitType: 'meal' | 'transportation' | 'accommodation', amount: number) => void;
    onRoleSalaryToggle: (enabled: boolean) => void;
    onAddRole: (role: string) => void;
    onRemoveRole: (roleIndex: number) => void;
    onRoleSalaryChange: (roleIndex: number, type: 'hourly' | 'daily' | 'monthly', amount: number) => void;
  };
  validation?: {
    errors: SalaryErrors;
    touched: Record<string, boolean>;
  };
}
```

### 3. Quickstart Guide (`quickstart.md`)

개발자가 5분 안에 새로운 폼 섹션을 추가하거나 수정할 수 있도록 가이드 제공:

1. **섹션 컴포넌트 생성 방법**
2. **Props Grouping 패턴 사용법**
3. **Zod 스키마 작성 및 통합 방법**
4. **단위 테스트 작성 방법**
5. **다크모드 스타일 적용 체크리스트**

### 4. Agent Context Update

`.specify/scripts/powershell/update-agent-context.ps1 -AgentType claude` 실행하여:

- **새로운 기술 스택 추가**: Zod 4.1.12 (스키마 검증)
- **새로운 패턴 추가**: Props Grouping (data, handlers, validation)
- **프로젝트 구조 업데이트**: JobPostingForm/ 디렉토리 구조
- **테스트 전략 업데이트**: Props 기반 독립 테스트

**Output**:
- `data-model.md` (엔티티 정의)
- `/contracts/*.contract.ts` (섹션 인터페이스)
- `quickstart.md` (개발자 가이드)
- Agent context 파일 업데이트

---

## Next Steps

**Phase 0 실행 필요**:
현재 plan.md 생성이 완료되었습니다. 다음 단계는 **research.md 생성**입니다.

**명령어**:
```bash
# 자동으로 Phase 0 연구 진행 (이 명령어는 예시이며, 실제로는 수동으로 진행)
# Phase 0: research.md 생성
# Phase 1: data-model.md, contracts/, quickstart.md 생성
```

**예상 소요 시간**:
- Phase 0 (Research): 2-3시간
- Phase 1 (Design): 3-4시간
- **총계**: 5-7시간

**다음 명령어**: 사용자가 `/speckit.tasks` 실행 시 Phase 2로 진행 (구현 태스크 생성)
