# Implementation Plan: 고정공고 근무일정 입력 섹션

**Branch**: `001-fixed-schedule-section` | **Date**: 2025-11-23 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/001-fixed-schedule-section/spec.md`

## Summary

고정공고 작성 폼에 근무일정 입력 섹션을 추가합니다. 주 출근일수(1-7), 근무 시간대(시작/종료), 역할별 필요 인원을 동적으로 입력할 수 있는 UI 컴포넌트를 구현하며, 기존 JobPostingForm의 Props Grouping 패턴과 섹션별 컴포넌트 분리 아키텍처를 준수합니다.

## Technical Context

**Language/Version**: TypeScript 4.9 (strict mode enabled)
**Primary Dependencies**: React 18.2, Tailwind CSS 3.3, date-fns 4.1
**Storage**: Firebase Firestore (기존 시스템)
**Testing**: Jest + React Testing Library + @testing-library/user-event
**Target Platform**: Web (Chrome, Firefox, Safari), iOS/Android (Capacitor 7.4)
**Project Type**: web (frontend-only, React SPA)
**Performance Goals**: 입력 완료 1분 이내 (SC-001), 역할 추가/삭제 2분 이내 (SC-002)
**Constraints**: WCAG 2.1 AA (색상 대비 4.5:1), TypeScript strict mode (any 타입 금지)
**Scale/Scope**: 단일 섹션 컴포넌트 (~200 LOC), 2개 타입 정의, 3개 핸들러 함수

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Note**: 프로젝트에 constitution.md 파일이 템플릿 상태이므로, UNIQN 프로젝트의 핵심 원칙을 CLAUDE.md에서 추출하여 검증합니다.

### 핵심 원칙 준수 여부

✅ **한글 우선**: 모든 문서와 코멘트를 한글로 작성
✅ **TypeScript Strict Mode**: any 타입 사용 금지, noImplicitAny, noUncheckedIndexedAccess 활성화
✅ **다크모드 필수**: 모든 UI 요소에 dark: 클래스 적용
✅ **Logger 사용**: console.log 금지, logger 사용
✅ **메모이제이션**: React.memo, useCallback, useMemo 활용
✅ **기존 패턴 준수**: JobPostingForm의 Props Grouping 패턴, 섹션별 컴포넌트 분리
✅ **표준 필드명**: WorkSchedule (daysPerWeek, startTime, endTime), RoleWithCount (role, count)
✅ **접근성 표준**: WCAG 2.1 AA, 모든 input에 label 연결

### 검증 결과

**Status**: ✅ **PASSED** - 모든 핵심 원칙 준수

이 기능은 기존 코드베이스의 패턴을 따르며, 새로운 라이브러리나 복잡도 증가 없이 단일 섹션 컴포넌트를 추가하는 작업입니다.

## Project Structure

### Documentation (this feature)

```text
specs/001-fixed-schedule-section/
├── spec.md              # Feature specification (/speckit.specify output)
├── plan.md              # This file (/speckit.plan output)
├── research.md          # Phase 0: 기술 조사 결과
├── data-model.md        # Phase 1: 데이터 모델 정의
├── quickstart.md        # Phase 1: 빠른 시작 가이드
└── tasks.md             # Phase 2: 구현 태스크 (/speckit.tasks output)
```

### Source Code (repository root)

```text
app2/                                    # React 프론트엔드 애플리케이션
├── src/
│   ├── components/
│   │   └── jobPosting/
│   │       └── JobPostingForm/
│   │           ├── index.tsx            # (수정) 섹션 조건부 렌더링 추가
│   │           └── sections/
│   │               ├── index.ts         # (수정) FixedWorkScheduleSection export 추가
│   │               ├── BasicInfoSection.tsx
│   │               ├── SalarySection/
│   │               ├── DateRequirementsSection.tsx  # 기존: 날짜별 공고용
│   │               └── FixedWorkScheduleSection.tsx # (신규) 고정공고용 근무일정
│   ├── hooks/
│   │   └── useJobPostingForm.ts        # (수정) workSchedule, requiredRolesWithCount 핸들러 추가
│   ├── types/
│   │   └── jobPosting/
│   │       ├── index.ts                 # (수정) WorkSchedule, RoleWithCount 타입 export
│   │       └── workSchedule.ts          # (신규) 근무일정 타입 정의
│   └── utils/
│       └── jobPosting/
│           └── validation.ts            # (수정) 역할 최소 1개 검증 로직 추가
└── tests/
    └── components/
        └── jobPosting/
            └── JobPostingForm/
                └── sections/
                    └── FixedWorkScheduleSection.test.tsx  # (신규) 컴포넌트 테스트
```

**Structure Decision**: Web application (frontend-only) 구조를 사용합니다. 기존 app2/ 디렉토리 내에서 JobPostingForm 컴포넌트를 확장하며, 섹션별 컴포넌트 분리 패턴을 준수합니다.

## Complexity Tracking

> **Note**: Constitution Check 위반 사항 없음 - 이 섹션은 비어 있습니다.

이 기능은 기존 아키텍처 패턴을 따르며, 새로운 복잡도를 도입하지 않습니다.
