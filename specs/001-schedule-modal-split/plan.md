# Implementation Plan: ScheduleDetailModal 컴포넌트 분리

**Branch**: `001-schedule-modal-split` | **Date**: 2025-11-05 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-schedule-modal-split/spec.md`

## Summary

1,123줄의 단일 파일 ScheduleDetailModal.tsx를 5개 파일로 분리하여 테스트 가능성, 재사용성, 유지보수성을 향상시킵니다. Props Drilling 패턴을 사용하여 명확한 데이터 흐름을 유지하고, React.memo + useCallback + useMemo 조합으로 성능을 최적화합니다.

**주요 개선사항**:
- 파일 분리: index.tsx (200줄), BasicInfoTab.tsx (150줄), WorkInfoTab.tsx (200줄), CalculationTab.tsx (250줄), types.ts (50줄)
- 독립 테스트 가능: 각 탭 컴포넌트를 개별적으로 마운트하여 테스트
- 타입 안전성 강화: types.ts에 모든 Props 인터페이스 중앙 집중
- 성능 유지: 메모이제이션으로 불필요한 리렌더링 방지

## Technical Context

**Language/Version**: TypeScript 4.9+ (strict mode)
**Primary Dependencies**: React 18.2, Tailwind CSS 3.3, Firebase 11.9, Zustand 5.0, date-fns 4.1
**Storage**: Firebase Firestore (실시간 구독 with onSnapshot)
**Testing**: Jest, React Testing Library (단위 테스트 및 통합 테스트)
**Target Platform**: Web (Chrome, Firefox, Safari, Edge), Progressive Web App (PWA), Capacitor 7.4 (iOS/Android)
**Project Type**: Web application (Frontend-heavy React SPA with Firebase backend)
**Performance Goals**:
- 초기 로드: < 3초 (3G 네트워크)
- Time to Interactive: < 5초
- 번들 크기: < 350KB (gzip)
- 탭 전환 응답 시간: < 100ms
**Constraints**:
- 기존 기능 100% 유지 (픽셀 단위 동일)
- 다크모드 스타일 모두 유지 (`dark:` Tailwind 클래스)
- useScheduleData Hook API 변경 금지
- 표준 필드명 사용 (`staffId`, `eventId`)
**Scale/Scope**:
- 1개 메인 컨테이너 컴포넌트
- 3개 탭 컴포넌트 (BasicInfoTab, WorkInfoTab, CalculationTab)
- 1개 타입 정의 파일 (types.ts)
- 총 ~850줄 (기존 1,123줄에서 ~24% 감소)

## Constitution Check

*GATE: 통과 확인 완료 (2025-11-05)*

### ✅ I. TypeScript 타입 안전성 (NON-NEGOTIABLE)
- **준수**: types.ts에 모든 인터페이스 명시적 정의, `any` 타입 사용 금지
- **검증**: data-model.md 검토 완료, 모든 Props에 명확한 타입 지정
- **승인**: ✅ 통과

### ✅ II. 테스트 우선 개발
- **준수**: 각 탭 컴포넌트를 독립적으로 테스트 가능하도록 설계
- **검증**: quickstart.md에 단위 테스트 및 통합 테스트 예제 포함
- **승인**: ✅ 통과 (실제 테스트 코드 작성은 구현 시)

### ✅ III. 사용자 경험 일관성 (NON-NEGOTIABLE)
- **준수**: 다크모드 스타일 100% 유지, 표준 필드명 사용, Toast 시스템 사용
- **검증**: research.md에 다크모드 유지 전략 명시, spec.md에 표준 필드명 요구사항 포함
- **승인**: ✅ 통과

### ✅ IV. 성능 표준
- **준수**: React.memo, useCallback, useMemo 활용, 번들 크기 < 350KB 유지
- **검증**: research.md에 메모이제이션 전략 상세 문서화
- **승인**: ✅ 통과

### ✅ V. 로깅 및 관찰성
- **준수**: `logger` 사용, `console.*` 직접 사용 금지
- **검증**: 프로젝트 전역 패턴 준수 (기존 코드에서 `logger` 사용 확인됨)
- **승인**: ✅ 통과

### 재검증 (Phase 1 설계 후)

모든 헌장 원칙이 설계 단계에서 준수되었습니다:
- **타입 안전성**: contracts/component-props.ts 및 data-model.md에 모든 인터페이스 정의 완료
- **테스트 가능성**: 각 컴포넌트가 독립적으로 마운트 가능하도록 설계
- **사용자 경험**: 다크모드 및 표준 필드명 유지 전략 명시
- **성능**: 메모이제이션 전략 상세 문서화
- **로깅**: 기존 프로젝트 패턴 준수

**최종 승인**: ✅ 모든 헌장 게이트 통과

## Project Structure

### Documentation (this feature)

```text
specs/001-schedule-modal-split/
├── spec.md              # Feature specification (/speckit.specify)
├── plan.md              # This file (/speckit.plan)
├── research.md          # Phase 0 output (기술적 결정사항 5개)
├── data-model.md        # Phase 1 output (Props 인터페이스 정의)
├── quickstart.md        # Phase 1 output (컴포넌트 사용 가이드)
├── contracts/           # Phase 1 output (TypeScript 인터페이스)
│   ├── component-props.ts  # 컴포넌트 Props 인터페이스
│   └── shared-types.ts     # 공유 타입 정의
├── checklists/          # Quality checklists (향후 생성)
└── tasks.md             # Phase 2 output (/speckit.tasks - 아직 생성 안 됨)
```

### Source Code (repository root)

```text
app2/src/pages/MySchedulePage/
├── index.tsx                        # 부모 페이지 (import 경로 업데이트 필요)
├── hooks/
│   └── useScheduleData.ts           # 기존 Hook (변경 없음, 323줄)
└── components/
    └── ScheduleDetailModal/         # 새 디렉토리 구조
        ├── index.tsx                # 메인 컨테이너 (200줄 이하)
        ├── types.ts                 # Props 인터페이스 (50줄 이하)
        └── tabs/
            ├── BasicInfoTab.tsx     # 기본 정보 탭 (150줄 이하)
            ├── WorkInfoTab.tsx      # 근무 정보 탭 (200줄 이하)
            └── CalculationTab.tsx   # 급여 계산 탭 (250줄 이하)

# 삭제될 파일 (Git rename 추적)
app2/src/pages/MySchedulePage/components/ScheduleDetailModal.tsx (기존 1,123줄)
```

**구조 결정 근거**:
- **Web application 구조 선택**: 이 프로젝트는 React 기반 SPA로 frontend/ 디렉토리 내에서 관리됩니다.
- **컴포넌트 기반 구조**: MySchedulePage 내부에 ScheduleDetailModal 컴포넌트를 배치하여 도메인 경계 유지
- **탭 컴포넌트 분리**: tabs/ 서브디렉토리로 명확한 계층 구조 제공
- **타입 정의 중앙집중**: types.ts로 타입 재사용성 및 순환 참조 방지

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

이 프로젝트는 모든 헌장 원칙을 준수하므로, 예외 사항이 없습니다.

## Phase 0: Research (✅ 완료)

**생성 파일**: [research.md](./research.md)

**주요 결정사항**:
1. **상태 공유 패턴**: Props Drilling (Presentational/Container)
   - 근거: 간단한 계층 구조 (1단계 깊이), 명확한 데이터 흐름
   - 대안 거부: Context API (불필요한 복잡도), Compound Component (유연성 불필요)

2. **메모이제이션 전략**: React.memo + useCallback + useMemo
   - 근거: 불필요한 리렌더링 방지, 성능 유지
   - 대안 거부: React.memo 없이 (성능 저하), 과도한 useMemo (메모리 오버헤드)

3. **타입 정의 위치**: types.ts 별도 파일 (중앙 집중)
   - 근거: 타입 재사용성, 순환 참조 방지, 프로젝트 일관성
   - 대안 거부: Inline 타입 (중복 정의), 전역 types/ (도메인 경계 불명확)

4. **파일 이동 전략**: 단계적 이동 (Git Rename 추적)
   - 근거: 히스토리 보존, 리뷰 용이성, 테스트 안정성
   - 단계: types.ts → 탭 컴포넌트 → index.tsx → import 경로 업데이트

5. **다크모드 유지 전략**: 기존 Tailwind `dark:` 클래스 모두 복사
   - 근거: 픽셀 단위 동일성, Constitution 준수
   - 검증: 각 탭마다 라이트/다크 모드 수동 테스트

## Phase 1: Design & Contracts (✅ 완료)

**생성 파일**:
- [data-model.md](./data-model.md) - Props 인터페이스 및 데이터 구조 정의
- [contracts/component-props.ts](./contracts/component-props.ts) - 컴포넌트 Props 인터페이스
- [contracts/shared-types.ts](./contracts/shared-types.ts) - 공유 타입 (SalaryInfo, WorkHistoryItem 등)
- [quickstart.md](./quickstart.md) - 컴포넌트 사용 가이드 및 예제

**주요 설계 산출물**:
1. **컨테이너 Props**: ScheduleDetailModalProps
   - 필수: isOpen, onClose, schedule
   - 선택: onCheckOut, onCancel, onDelete

2. **탭 Props 인터페이스**:
   - BasicInfoTabProps: schedule, jobPosting, onUpdate?, isReadOnly
   - WorkInfoTabProps: schedule, workLogs, onCheckOut, isReadOnly
   - CalculationTabProps: salaryInfo, workHistory

3. **공유 타입**:
   - SalaryInfo: 급여 계산 결과 (salaryType, baseSalary, allowances, tax, etc.)
   - WorkHistoryItem: 근무 내역 항목 (label, value, type?)

4. **데이터 흐름**:
   ```
   ScheduleDetailModal (Container)
   ├── Props: schedule, onClose, onCheckOut, onCancel, onDelete
   ├── State: activeTab, jobPosting, realTimeWorkLogs
   ├── Computed: salaryInfo (useMemo), workHistory (useMemo)
   └── Renders:
       ├── BasicInfoTab (Props: schedule, jobPosting, isReadOnly)
       ├── WorkInfoTab (Props: schedule, workLogs, onCheckOut, isReadOnly)
       └── CalculationTab (Props: salaryInfo, workHistory)
   ```

**Agent Context Update**: ✅ 완료 예정 (다음 단계에서 실행)

## Phase 2: Task Generation (⏳ 대기 중)

**생성 명령어**: `/speckit.tasks`

이 명령어는 다음을 생성합니다:
- **tasks.md**: 의존성 기반으로 정렬된 구현 작업 목록
- **체크리스트**: 각 작업의 완료 기준 및 검증 항목

**예상 작업 항목** (tasks.md 생성 전 미리보기):
1. types.ts 생성 (모든 Props 인터페이스 정의)
2. BasicInfoTab.tsx 생성 (기본 정보 탭 구현)
3. WorkInfoTab.tsx 생성 (근무 정보 탭 구현)
4. CalculationTab.tsx 생성 (급여 계산 탭 구현)
5. index.tsx 생성 (메인 컨테이너, 기존 파일에서 마이그레이션)
6. MySchedulePage import 경로 업데이트
7. 품질 게이트 검증 (type-check, lint, 수동 테스트)

## Risk Assessment

| 위험 | 가능성 | 영향도 | 완화 전략 |
|------|--------|--------|----------|
| 메모이제이션 누락으로 성능 저하 | 중간 | 높음 | React DevTools Profiler로 리렌더링 측정, useCallback/React.memo 철저히 적용 |
| Import 경로 변경 누락 | 낮음 | 높음 | TypeScript 컴파일 에러로 즉시 발견, IDE의 "Find All References" 사용 |
| 다크모드 스타일 누락 | 중간 | 중간 | 각 탭마다 라이트/다크 모드 수동 테스트, 체크리스트 활용 |
| Git 히스토리 손실 | 낮음 | 중간 | 단계적 이동으로 rename 추적, `git log --follow` 확인 |
| 기존 기능 동작 변경 | 낮음 | 매우 높음 | 단위 테스트 및 통합 테스트 작성, 수동 E2E 테스트 |

## Next Steps

1. **Agent Context Update 실행** (현재):
   ```bash
   powershell.exe -ExecutionPolicy Bypass -File ".specify/scripts/powershell/update-agent-context.ps1" -AgentType claude
   ```

2. **Task 생성** (`/speckit.tasks`):
   - 의존성 기반 작업 목록 생성
   - 각 작업의 체크리스트 및 검증 기준 정의

3. **구현 시작** (`/speckit.implement`):
   - tasks.md에 따라 순차적으로 구현
   - 각 작업 완료 후 품질 게이트 검증

4. **최종 검증**:
   - `npm run type-check` (TypeScript 에러 0개)
   - `npm run lint` (ESLint 경고 0개)
   - 수동 테스트 (모든 탭, 라이트/다크 모드)
   - 성능 측정 (React DevTools Profiler)

## Validation Checklist

### Constitution Compliance
- [x] TypeScript strict mode 준수 (`any` 타입 없음)
- [x] 테스트 가능한 구조 설계 (각 탭 독립 테스트 가능)
- [x] 다크모드 스타일 유지 전략 명시
- [x] 표준 필드명 사용 (`staffId`, `eventId`)
- [x] 성능 최적화 전략 (메모이제이션)

### Design Quality
- [x] 모든 Props 인터페이스 정의 완료
- [x] 데이터 흐름 명확히 문서화
- [x] 컴포넌트 계층 구조 명확
- [x] 파일 크기 목표 설정 (각 파일 < 300줄)

### Documentation Quality
- [x] research.md: 5개 기술적 결정사항 문서화
- [x] data-model.md: Props 및 타입 정의 완료
- [x] quickstart.md: 사용 가이드 및 예제 완료
- [x] contracts/: TypeScript 인터페이스 파일 생성

**최종 상태**: ✅ Phase 0 및 Phase 1 완료, Phase 2 (Task 생성) 대기 중
