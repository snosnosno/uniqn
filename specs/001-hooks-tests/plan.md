# Implementation Plan: 핵심 Hooks 단위 테스트 작성

**Branch**: `001-hooks-tests` | **Date**: 2025-11-06 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/001-hooks-tests/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

이 기능은 UNIQN 프로젝트의 3개 핵심 React Hook(`useNotifications`, `useScheduleData`, `useApplicantActions`)에 대한 종합적인 단위 테스트를 작성합니다. 각 Hook은 핵심 비즈니스 로직(알림 관리, 급여 계산, 지원자 관리)을 담당하며, 테스트를 통해 70% 이상의 코드 커버리지를 달성하고 모든 비동기 작업과 에러 케이스를 검증합니다. `@testing-library/react-hooks`의 `renderHook` 패턴을 사용하여 Firebase Mock과 함께 독립적인 테스트 환경을 구축하고, 8초 이내의 빠른 실행 시간을 목표로 합니다.

## Technical Context

**Language/Version**: TypeScript 4.9+ (React 18.2, strict mode 활성화)
**Primary Dependencies**:
- Jest 29.x (테스트 러너)
- @testing-library/react 14.x (React 컴포넌트 테스트)
- @testing-library/react-hooks 8.x (Hook 테스트)
- @testing-library/jest-dom 6.x (Jest 확장 매처)
- Firebase Test SDK 11.x (Firebase Mock)
**Storage**: N/A (테스트 코드, 실제 데이터베이스 사용 안 함)
**Testing**: Jest 단위 테스트 (renderHook, waitFor, act 패턴)
**Target Platform**: Node.js 18+ (테스트 실행 환경)
**Project Type**: Web (React SPA, app2/ 디렉토리)
**Performance Goals**:
- 전체 테스트 실행 시간 ≤ 8초
- 각 Hook별 커버리지 ≥ 70%
- 각 Hook당 에러 케이스 ≥ 5개
**Constraints**:
- 프로덕션 코드 수정 최소화 (Hook 인터페이스 변경 불가)
- 성능 저하 없음 (±5% 이내)
- 각 테스트 독립 실행 가능
- CI 환경 재현 가능
**Scale/Scope**:
- 3개 Hook 테스트 파일 (useNotifications, useScheduleData, useApplicantActions)
- 총 323줄 + 803줄 + α (useNotifications 파일 크기 확인 필요)
- 최소 15개 테스트 케이스 (각 Hook당 5개 에러 케이스 포함)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### I. TypeScript 타입 안전성 ✅ PASSED

**Status**: ✅ 준수
**Assessment**:
- 테스트 코드도 TypeScript strict mode 준수
- Mock 데이터는 명시적 타입 인터페이스 정의 필요
- `any` 타입 사용 금지 (Firebase Mock 포함)
- 테스트 헬퍼 함수도 완전한 타입 지정

**Implementation Notes**:
- 각 Hook의 반환 타입을 테스트에서 명시적으로 검증
- Mock Factory 함수는 타입 안전하게 구현
- Jest의 `jest.Mock<ReturnType, ArgsType>` 타입 활용

### II. 테스트 우선 개발 ✅ PASSED

**Status**: ✅ 준수 (이 기능 자체가 테스트 작성)
**Assessment**:
- 테스트 커버리지 목표: 각 Hook 70% 이상
- 모든 비동기 로직 테스트 포함
- 에러 케이스 각 Hook당 5개 이상
- TDD 원칙 적용 가능: 실패하는 테스트 먼저 작성 → 구현 확인 → 리팩토링

**Implementation Notes**:
- 단위 테스트 레벨: Hook의 독립적 동작 검증
- 통합 테스트 고려사항: Firebase 연동은 Mock으로 대체
- E2E 테스트는 Out of Scope (별도 작업)

### III. 사용자 경험 일관성 ⚠️ N/A

**Status**: ⚠️ N/A (테스트 코드)
**Assessment**:
- 다크모드: N/A (테스트 파일)
- Toast 시스템: N/A (UI 없음)
- 표준 필드명: ✅ 테스트에서 `staffId`, `eventId` 사용 검증
- i18n: N/A (테스트 파일)

**Implementation Notes**:
- 테스트는 프로덕션 코드가 표준 필드명을 사용하는지 검증
- Mock 데이터는 프로덕션 구조와 동일한 필드명 사용

### IV. 성능 표준 ✅ PASSED

**Status**: ✅ 준수
**Assessment**:
- 테스트 실행 시간 목표: 8초 이내 (전체)
- 각 Hook 테스트: 약 2-3초씩 배분
- Firebase Mock은 실제 네트워크 호출 없이 즉시 응답
- 메모이제이션은 테스트에서 동작 검증

**Implementation Notes**:
- 불필요한 대기 시간 최소화 (waitFor 타임아웃 적절히 설정)
- 병렬 실행 가능하도록 테스트 독립성 보장
- 무거운 Mock 데이터는 재사용

### V. 로깅 및 관찰성 ✅ PASSED

**Status**: ✅ 준수
**Assessment**:
- 테스트에서도 `console.log` 대신 `logger` 사용
- 테스트 실패 시 명확한 에러 메시지 제공
- Mock logger로 로그 호출 검증 가능

**Implementation Notes**:
- `logger.error`, `logger.warn` 호출을 테스트에서 검증
- 테스트 환경에서는 logger를 Mock으로 대체
- 민감한 정보 로깅 방지 검증 포함

### 품질 게이트 체크

**Gate 1: 타입 안전성** ✅
```bash
npm run type-check  # 테스트 파일도 TypeScript 에러 0개
```

**Gate 2: 코드 품질** ✅
```bash
npm run lint  # 테스트 파일도 ESLint 규칙 준수
```

**Gate 3: 테스트** ✅
```bash
npm run test  # 새로 작성된 테스트 모두 통과
npm run test:coverage  # 각 Hook 커버리지 ≥ 70%
```

**Gate 4: 빌드** ✅
```bash
npm run build  # 테스트 추가가 빌드에 영향 없음
```

**Gate 5: 모바일 동기화** ⚠️ N/A (테스트 코드)

### Constitution 준수 요약

| 원칙 | 상태 | 비고 |
|------|------|------|
| TypeScript 타입 안전성 | ✅ PASSED | 테스트 코드도 strict mode 준수 |
| 테스트 우선 개발 | ✅ PASSED | 이 기능이 테스트 작성 |
| 사용자 경험 일관성 | ⚠️ N/A | 테스트 코드 (표준 필드명만 검증) |
| 성능 표준 | ✅ PASSED | 8초 이내 실행 시간 목표 |
| 로깅 및 관찰성 | ✅ PASSED | 테스트에서도 logger 사용 |

**Overall**: ✅ **CONSTITUTION COMPLIANT** - 모든 적용 가능한 원칙 준수

**Phase 0 진행 승인**: ✅ 모든 게이트 통과, Research 단계 진행 가능

## Project Structure

### Documentation (this feature)

```text
specs/001-hooks-tests/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
│   ├── test-patterns.md # 테스트 패턴 및 베스트 프랙티스
│   └── mock-factory.md  # Mock 데이터 팩토리 사양
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

**Structure Decision**: Web Application (React SPA) - 테스트 파일은 각 Hook과 동일한 디렉토리의 `__tests__/` 폴더에 위치

```text
app2/
├── src/
│   ├── hooks/
│   │   ├── useNotifications.ts           # 알림 시스템 Hook (프로덕션)
│   │   └── __tests__/
│   │       └── useNotifications.test.ts  # 🆕 알림 Hook 테스트
│   │
│   ├── pages/MySchedulePage/components/hooks/
│   │   ├── useScheduleData.ts            # 급여 계산 Hook (323줄)
│   │   └── __tests__/
│   │       └── useScheduleData.test.ts   # 🆕 급여 계산 Hook 테스트
│   │
│   ├── components/applicants/ApplicantManagement/hooks/
│   │   ├── useApplicantActions.ts        # 지원자 관리 Hook (803줄)
│   │   └── __tests__/
│   │       └── useApplicantActions.test.ts  # 🆕 지원자 관리 Hook 테스트
│   │
│   └── __tests__/
│       ├── setup/
│       │   ├── setupTests.ts             # Jest 글로벌 설정 (기존)
│       │   └── mockFactories.ts          # 🆕 재사용 가능한 Mock Factory
│       └── mocks/
│           ├── firebase.ts               # 🆕 Firebase Mock 설정
│           ├── logger.ts                 # 🆕 Logger Mock 설정
│           └── testData.ts               # 🆕 공통 테스트 데이터
│
├── jest.config.js                        # Jest 설정 (기존)
└── package.json                          # 테스트 의존성 (기존)
```

**Key Design Decisions**:
1. **Colocation Pattern**: 테스트 파일은 각 Hook과 같은 디렉토리에 배치하여 유지보수성 향상
2. **Shared Test Utilities**: 공통 Mock과 Factory는 `src/__tests__/` 하위에 중앙 집중화
3. **No Duplication**: 기존 Jest 설정 및 setupTests.ts 재사용
4. **Type Safety**: 모든 테스트 파일도 TypeScript로 작성 (.test.ts)

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

**Status**: ✅ **No Violations** - 모든 Constitution 원칙 준수, 복잡도 추가 없음

이 기능은 기존 시스템에 테스트를 추가하는 작업으로, 새로운 복잡도를 도입하지 않습니다. 모든 Constitution 원칙을 준수하며 추가 정당화가 필요한 위반 사항이 없습니다.

---

# Phase 0: Research & Technical Decisions ✅ COMPLETE

**Status**: ✅ All research items resolved

**Output**: [research.md](research.md)

## Research Summary

모든 기술적 불명확성이 해결되었으며 다음 항목에 대한 의사결정이 완료되었습니다:

1. **Testing Library 선택**: @testing-library/react 14.x 내장 `renderHook` 사용
2. **Firebase Mocking 전략**: Jest의 `jest.mock()` 모듈 수준 Mock
3. **비동기 테스트 패턴**: `waitFor` + `act` 조합
4. **Hook별 테스트 전략**: 각 Hook의 특성에 맞는 테스트 접근법 정의
5. **테스트 커버리지 도구**: Jest 내장 Coverage (Istanbul)
6. **공통 테스트 유틸리티**: 중앙화된 Mock Factory 및 Test Data
7. **성능 최적화**: 병렬 실행 + 타임아웃 최적화
8. **CI/CD 통합**: GitHub Actions 기존 워크플로우 활용

**자세한 내용**: [research.md](research.md) 참조

---

# Phase 1: Design & Contracts ✅ COMPLETE

**Status**: ✅ All design artifacts generated

## Generated Artifacts

### 1. Data Model ✅

**Output**: [data-model.md](data-model.md)

**정의된 엔티티**:
- `Notification`: 알림 데이터 구조, 상태 전이, 검증 규칙
- `WorkLog`: 근무 기록 구조, 급여 계산 로직, 검증 규칙
- `Applicant`: 지원자 데이터 구조, 상태 전이, 검증 규칙
- `Firebase Mock Structures`: Firestore Snapshot, Document Reference 구조

**Factory 함수**: 각 엔티티별 Mock 데이터 생성 함수 및 특수 케이스 Factory

### 2. Contracts ✅

**Output**: [contracts/](contracts/)

#### 2.1 Test Patterns

**파일**: [contracts/test-patterns.md](contracts/test-patterns.md)

**정의된 패턴** (8개):
1. 기본 Hook 테스트 구조
2. 비동기 상태 업데이트 패턴 (waitFor, act)
3. Firebase Mock 패턴 (onSnapshot, updateDoc, 에러 시뮬레이션)
4. 계산 로직 테스트 패턴 (급여, 수당, 캐싱)
5. 일괄 작업 테스트 패턴 (Promise.all, 부분 실패)
6. 에러 처리 테스트 패턴 (네트워크, 권한, 검증)
7. 메모리 누수 방지 패턴 (Cleanup, unmount)
8. 성능 테스트 패턴 (실행 시간, 재렌더링)

#### 2.2 Mock Factory Specification

**파일**: [contracts/mock-factory.md](contracts/mock-factory.md)

**정의된 Factory** (6개 카테고리):
1. Entity Mock Factories: `createMockNotification`, `createMockWorkLog`, `createMockApplicant`
2. Type-specific Factories: 타입/상태별 Factory 함수
3. Bulk Factories: 대량 데이터 생성 함수
4. Firebase Mock Factories: `createMockSnapshot`, `createMockOnSnapshot`, `createMockUpdateDoc`
5. Common Test Data Sets: 최소, 현실적, 엣지 케이스 데이터셋
6. Factory Testing: Factory 자체의 테스트 가능성

### 3. Quickstart Guide ✅

**Output**: [quickstart.md](quickstart.md)

**포함 내용**:
- Prerequisites 및 환경 확인
- 첫 번째 테스트 작성 (5분 가이드)
- Firebase Mock 설정 (10분 가이드)
- Mock Factory 생성 (10분 가이드)
- 실시간 구독 테스트 (15분 가이드)
- 테스트 커버리지 확인 (5분 가이드)
- 전체 워크플로우 (30분 예시)
- 자주 사용하는 명령어 모음
- Troubleshooting 가이드

### 4. Agent Context Update ✅

**Output**: CLAUDE.md 업데이트 완료

**추가된 컨텍스트**:
- Language: TypeScript 4.9+ (React 18.2, strict mode)
- Database: N/A (테스트 코드)
- Project Type: Web (React SPA, app2/ 디렉토리)

## Constitution Re-Check ✅

**Status**: ✅ **CONSTITUTION COMPLIANT** - 모든 설계가 헌장 원칙 준수

Design 단계에서도 모든 Constitution 원칙을 준수합니다:
- TypeScript 타입 안전성: ✅ 모든 Mock과 Factory가 명시적 타입 정의
- 테스트 우선 개발: ✅ 테스트 작성 자체가 목표
- 성능 표준: ✅ 8초 이내 실행 시간 목표 유지
- 로깅 및 관찰성: ✅ 테스트에서도 logger 사용 명시

**Phase 1 완료**: ✅ 모든 설계 아티팩트 생성 완료, 구현 준비 완료

---

# Phase 2: Task Generation (Next Step)

**Command**: `/speckit.tasks`

**Purpose**: 구현 계획을 실행 가능한 작업 목록으로 변환

Phase 1이 완료되었으므로 다음 명령어를 실행하여 Phase 2로 진행할 수 있습니다:

```bash
/speckit.tasks
```

이 명령어는 다음을 생성합니다:
- `tasks.md`: 우선순위가 지정된 구현 작업 목록
- 각 작업의 예상 시간 및 의존성
- 체크리스트 및 검증 기준

**구현 순서 권장**:
1. 공통 Mock 설정 (`firebase.ts`, `testData.ts`) - 2시간
2. `useNotifications` 테스트 - 4시간
3. `useScheduleData` 테스트 - 6시간
4. `useApplicantActions` 테스트 - 8시간
5. 커버리지 검증 및 리팩토링 - 2시간

**총 예상 시간**: 22시간 (약 2.5일)
