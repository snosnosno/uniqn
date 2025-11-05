# Implementation Plan: useJobPostingForm.ts any 타입 완전 제거

**Branch**: `001-remove-any-types-job-posting-form` | **Date**: 2025-11-05 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-remove-any-types-job-posting-form/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

useJobPostingForm.ts Hook에서 28회 사용 중인 `any` 타입을 완전히 제거하고, TypeScript strict mode를 100% 준수하는 타입 안전성을 확보합니다. JobPostingFormData 인터페이스를 완전히 정의하고, 중첩 객체 타입(DateSpecificRequirement, PreQuestion, Benefits 등)을 명시적으로 정의하여, 런타임 에러를 컴파일 타임에 방지하고 IDE 자동완성 기능을 최대한 활용할 수 있도록 개선합니다.

## Technical Context

**Language/Version**: TypeScript 4.9.5 (React 18.2.0 사용)
**Primary Dependencies**:
- React 18.2.0 (useState, useCallback, useMemo)
- Firebase 11.9.1 (Firestore Timestamp 타입)
- 기존 타입 정의: `app2/src/types/jobPosting/jobPosting.ts`, `app2/src/types/jobPosting/base.ts`
- 유틸리티 함수: `app2/src/utils/jobPosting/jobPostingHelpers.ts`

**Storage**: Firebase Firestore (jobPostings 컬렉션)
**Testing**:
- Jest (단위 테스트)
- React Testing Library (컴포넌트 테스트)
- Playwright (E2E 테스트)
- `npm run type-check` (TypeScript 타입 검증)

**Target Platform**: Web (React SPA), iOS/Android (Capacitor 7.4)
**Project Type**: Single Web Application (app2/ 디렉토리)
**Performance Goals**:
- 타입 체크 시간 < 5초
- IDE 자동완성 응답 시간 < 100ms
- 메모이제이션 성능 기존 수준 유지

**Constraints**:
- 기존 컴포넌트 API 변경 금지 (Breaking Change 없음)
- JobPostingForm.tsx, JobPostingCard.tsx 수정 최소화 (0줄 변경 목표)
- 프로덕션 번들 크기 증가 < 5KB
- TypeScript strict mode 100% 준수

**Scale/Scope**:
- 수정 대상 파일: 1개 (useJobPostingForm.ts, 370줄)
- 영향 받는 컴포넌트: 2개 (JobPostingForm.tsx 993줄, JobPostingCard.tsx 854줄)
- 타입 정의: 7개 인터페이스 (JobPostingFormData, DateSpecificRequirement, TimeSlot, PreQuestion, Benefits, RoleRequirement, SalaryInfo)
- any 타입 제거: 28회 → 0회

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Gate 1: TypeScript 타입 안전성 (NON-NEGOTIABLE)
- ✅ **목표**: `any` 타입 완전 제거 (28회 → 0회)
- ✅ **검증**: `npm run type-check` 에러 0개
- ✅ **준수 방법**: 모든 useState, setFormData 콜백에 명시적 타입 지정
- **상태**: 🔴 **현재 위반 중** (28회 any 타입 사용) → ✅ **작업 후 준수 예정**

### Gate 2: 테스트 우선 개발
- ✅ **목표**: 타입 변경 후 기존 기능 정상 작동 확인
- ✅ **검증**: 기존 테스트 100% 통과, 수동 폼 테스트 통과
- ✅ **준수 방법**: 기존 E2E 테스트 스위트 실행, 새로운 타입 가드 함수에 대한 단위 테스트 추가 (선택)
- **상태**: ✅ **준수 예정** (기존 기능 호환성 유지)

### Gate 3: 사용자 경험 일관성 (NON-NEGOTIABLE)
- ✅ **영향 없음**: 다크모드, 표준 필드명(staffId, eventId) 변경 없음
- ✅ **준수 방법**: 타입 정의만 수정, UI 로직 변경 없음
- **상태**: ✅ **준수** (UI 변경 없음)

### Gate 4: 성능 표준
- ✅ **목표**: 메모이제이션 성능 유지 또는 향상
- ✅ **검증**: useCallback 의존성 배열 정확도 100%
- ✅ **준수 방법**: 의존성 배열 명시적 정의, 불필요한 리렌더링 방지
- **상태**: ✅ **준수 예정** (성능 최적화 유지)

### Gate 5: 로깅 및 관찰성
- ✅ **영향 없음**: logger 사용 규칙 준수 (console.log 금지)
- ✅ **준수 방법**: 기존 logger 패턴 유지
- **상태**: ✅ **준수** (로깅 변경 없음)

### Gate 요약
- **현재 위반**: Gate 1 (TypeScript 타입 안전성) - 28회 any 타입 사용
- **작업 후 준수**: 모든 Gate 통과 예정
- **예외 없음**: 모든 헌장 원칙 준수 가능

## Project Structure

### Documentation (this feature)

```text
specs/001-remove-any-types-job-posting-form/
├── spec.md              # Feature specification (/speckit.specify command output)
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── checklists/
│   └── requirements.md  # Spec quality checklist
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created yet)
```

### Source Code (repository root)

```text
app2/                              # React 애플리케이션 루트
├── src/
│   ├── hooks/
│   │   └── useJobPostingForm.ts   # 🎯 수정 대상 (370줄)
│   ├── types/
│   │   └── jobPosting/
│   │       ├── jobPosting.ts      # 기존 타입 정의 (참조용)
│   │       └── base.ts            # 기존 기본 타입 (참조용)
│   ├── utils/
│   │   └── jobPosting/
│   │       └── jobPostingHelpers.ts # 유틸리티 함수 (참조용)
│   └── components/
│       └── JobPosting/
│           ├── JobPostingForm.tsx  # 영향 받는 컴포넌트 (993줄)
│           └── JobPostingCard.tsx  # 영향 받는 컴포넌트 (854줄)
└── tests/                         # 테스트 디렉토리 (선택)
    ├── unit/
    │   └── useJobPostingForm.test.ts # 타입 가드 테스트 (선택)
    └── integration/
        └── JobPostingForm.test.tsx # 기존 테스트 (검증용)
```

**Structure Decision**: Single Web Application 구조 사용. React Hook 파일 1개만 수정하며, 기존 컴포넌트와 타입 정의는 참조만 합니다. 테스트는 기존 테스트 실행으로 검증하며, 타입 가드 함수에 대한 추가 테스트는 선택 사항입니다.

## Complexity Tracking

> **이 기능은 헌장 위반이 없으므로 이 섹션은 비어 있습니다.**

모든 작업은 헌장의 원칙을 준수하며, 특히 Gate 1(TypeScript 타입 안전성)의 위반 사항을 해결하는 것이 핵심 목표입니다. 추가적인 복잡성이나 예외 처리는 필요하지 않습니다.
