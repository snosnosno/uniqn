# Implementation Plan: Phase 2-4 Critical UI Component Tests

**Branch**: `003-ui-component-tests` | **Date**: 2025-11-06 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/003-ui-component-tests/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

NotificationDropdown과 JobPostingCard 컴포넌트에 대한 종합 테스트 작성 프로젝트입니다. React Testing Library와 Jest를 사용하여 렌더링, 사용자 인터랙션, 다크모드, 접근성(WCAG 2.1 AA) 테스트를 구현합니다. NotificationDropdown은 신규 테스트 작성이 필요하며, JobPostingCard는 기존 테스트(343줄, 다크모드 포함)에 인터랙션 및 접근성 테스트를 추가합니다.

## Technical Context

**Language/Version**: TypeScript 4.9 (Strict Mode)
**Primary Dependencies**: React 18.2, React Testing Library, Jest, @testing-library/user-event, axe-core (접근성), @testing-library/jest-dom
**Storage**: N/A (테스트 프로젝트)
**Testing**: Jest 29 + React Testing Library + axe-core
**Target Platform**: Web (Chrome, Firefox, Safari 최신 버전)
**Project Type**: Web (기존 React 프로젝트에 테스트 추가)
**Performance Goals**: 각 테스트 스위트 실행 시간 3초 이내
**Constraints**:
  - 커버리지: NotificationDropdown 85% 이상, JobPostingCard 90% 이상
  - 접근성: axe-core 위반 0개 (WCAG 2.1 AA)
  - 테스트 통과율: 100% (0 failures)
**Scale/Scope**:
  - NotificationDropdown: 신규 테스트 파일 (예상 200-300줄)
  - JobPostingCard: 기존 테스트 확장 (343줄 → 500줄 예상)
  - 총 테스트 케이스: 50-70개 예상

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### CLAUDE.md 핵심 원칙 준수 검증

| 원칙 | 요구사항 | 이 프로젝트 준수 여부 | 비고 |
|------|----------|----------------------|------|
| **TypeScript Strict Mode** | any 타입 사용 금지, 100% 타입 안전성 | ✅ PASS | 테스트 코드에서 mock 타입 명시적 선언 |
| **Logger 사용** | console.log 금지, logger 사용 | ✅ PASS | 테스트는 console 사용 허용 (Jest 표준) |
| **다크모드 필수** | 모든 UI에 `dark:` 클래스 적용 | ✅ PASS | 다크모드 테스트 검증 포함 |
| **메모이제이션** | useMemo, useCallback 활용 | N/A | 테스트 코드는 해당 없음 |
| **Firebase onSnapshot** | 실시간 구독 사용 | ✅ PASS | NotificationDropdown mock에 반영 |
| **표준 필드명** | staffId, eventId 사용 | ✅ PASS | 기존 코드 패턴 준수 |

### 프로젝트 특화 원칙

| 원칙 | 요구사항 | 준수 여부 |
|------|----------|-----------|
| **테스트 패턴** | React Testing Library 사용자 중심 쿼리 | ✅ PASS |
| **Mock 전략** | Firebase, React Router 외부 의존성 mock | ✅ PASS |
| **커버리지 목표** | NotificationDropdown 85%, JobPostingCard 90% | ✅ PASS |
| **접근성 표준** | WCAG 2.1 AA, axe-core 검증 | ✅ PASS |

**전체 평가**: ✅ **모든 원칙 준수** - Phase 0 진행 가능

## Project Structure

### Documentation (this feature)

```text
specs/003-ui-component-tests/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output - 테스트 베스트 프랙티스 조사
├── data-model.md        # Phase 1 output - 테스트 데이터 모델 (mock, fixtures)
├── quickstart.md        # Phase 1 output - 테스트 실행 가이드
├── contracts/           # Phase 1 output - 컴포넌트 인터페이스 정의
│   ├── NotificationDropdown.interface.md
│   └── JobPostingCard.interface.md
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (기존 프로젝트 구조)

```text
app2/                                    # 메인 애플리케이션 루트
├── src/
│   ├── components/
│   │   ├── common/
│   │   │   └── JobPostingCard.tsx      # 테스트 대상 1 (기존 854줄)
│   │   └── notifications/
│   │       ├── NotificationDropdown.tsx # 테스트 대상 2
│   │       ├── NotificationItem.tsx
│   │       └── NotificationBadge.tsx
│   │
│   ├── hooks/
│   │   └── useNotifications.ts         # NotificationDropdown 의존성
│   │
│   └── __tests__/
│       └── unit/
│           ├── components/
│           │   ├── jobPosting/
│           │   │   └── JobPostingCard.test.tsx           # 기존 테스트 (343줄)
│           │   │
│           │   └── notifications/                         # 신규 생성 필요
│           │       ├── NotificationDropdown.test.tsx     # 신규 작성
│           │       ├── NotificationDropdown.interaction.test.tsx  # 신규
│           │       └── NotificationDropdown.accessibility.test.tsx # 신규
│           │
│           └── testUtils/                                 # 테스트 유틸리티
│               ├── mockNotifications.ts                   # 신규 생성
│               └── accessibilityHelpers.ts                # 신규 생성
│
└── package.json                         # 의존성: axe-core 추가 필요
```

**Structure Decision**:

**Web Application (React)** 구조를 따릅니다. 기존 UNIQN 프로젝트의 `app2/` 디렉토리에 테스트 파일을 추가하는 방식입니다.

**핵심 결정 사항**:
1. **테스트 파일 위치**: `app2/src/__tests__/unit/components/` 하위에 컴포넌트별 디렉토리 생성
2. **NotificationDropdown 테스트 분리**:
   - 기본 렌더링: `NotificationDropdown.test.tsx`
   - 인터랙션: `NotificationDropdown.interaction.test.tsx`
   - 접근성: `NotificationDropdown.accessibility.test.tsx`
3. **JobPostingCard 테스트 확장**: 기존 `JobPostingCard.test.tsx`에 describe 블록 추가
4. **테스트 유틸리티**: `testUtils/` 디렉토리에 재사용 가능한 mock 및 helper 함수 배치

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

**N/A** - 모든 Constitution 원칙을 준수하므로 복잡도 예외 사항 없음.
