# Implementation Plan: 고정공고 조회 Hook 및 카드 컴포넌트

**Branch**: `001-fixed-job-listing` | **Date**: 2025-11-23 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-fixed-job-listing/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

고정공고 목록 조회 및 표시 기능을 구현합니다. Firestore 실시간 구독(onSnapshot)으로 초기 20개 공고를 조회하고, IntersectionObserver 기반 무한 스크롤로 추가 페이지를 일회성 조회(getDocs)합니다. FixedJobCard 컴포넌트는 다크모드를 지원하며, 조회수는 상세 페이지 이동 시 증가합니다.

## Technical Context

**Language/Version**: TypeScript 4.9.5, React 18.2.0
**Primary Dependencies**: Firebase 11.9.1 (Firestore), react-firebase-hooks 5.1.1, date-fns 4.1.0, Tailwind CSS 3.3.3, Zustand 5.0.7
**Storage**: Firestore (컬렉션: `jobPostings`, 인덱스: `postingType + status + createdAt`)
**Testing**: Jest 29.5.3 + React Testing Library 14.0.0
**Target Platform**: Web (React SPA), Capacitor 7.4.3 (모바일 앱)
**Project Type**: Web application (React frontend + Firebase backend)
**Performance Goals**: 초기 로딩 <500ms, 페이지 전환 <200ms, 무한 스크롤 <1초
**Constraints**: 타입 에러 0개 (strict mode), 다크모드 100% 지원, logger 사용 필수, React.memo/useCallback 최적화
**Scale/Scope**: 초기 20개 공고 실시간 구독, 페이지당 20개 추가 로드, 예상 최대 200-500개 공고

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Constitution 파일 상태**: 템플릿만 존재, 프로젝트별 원칙 미정의
**CLAUDE.md 기준 검증**:
- ✅ TypeScript strict mode 100% 준수 (any 타입 금지)
- ✅ Firebase onSnapshot 실시간 구독 사용
- ✅ logger 사용 (console.log 금지)
- ✅ 메모이제이션 활용 (React.memo, useCallback)
- ✅ 다크모드 필수 적용 (dark: 클래스)
- ✅ 표준 필드명 사용 (기존 타입 정의 준수)
- ✅ 상대 경로 사용 (절대 경로 금지)

**기존 코드 패턴 준수**:
- ✅ `FixedJobPosting` 타입 정의 존재 확인 ([jobPosting.ts:287-313](../../app2/src/types/jobPosting/jobPosting.ts#L287-L313))
- ✅ `logger` 유틸리티 존재 확인 ([logger.ts](../../app2/src/utils/logger.ts))
- ✅ 기존 컴포넌트 패턴 참고 가능 (JobPostingList, FixedPostingBadge 등)

## Project Structure

### Documentation (this feature)

```text
specs/[###-feature]/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
app2/src/
├── hooks/
│   └── useFixedJobPostings.ts          # NEW: 고정공고 조회 Hook (onSnapshot + getDocs)
├── components/
│   └── jobPosting/
│       └── FixedJobCard.tsx             # NEW: 고정공고 카드 컴포넌트
├── pages/
│   └── JobBoardPage.tsx                 # MODIFY: FixedJobCard 사용
├── types/
│   └── jobPosting/
│       └── jobPosting.ts                # EXISTING: FixedJobPosting 타입 정의됨
├── utils/
│   ├── logger.ts                        # EXISTING: 로거 유틸리티
│   └── jobPosting/
│       └── validation.ts                # NEW: validateFixedJobPosting 함수
└── __tests__/
    ├── unit/
    │   ├── hooks/
    │   │   └── useFixedJobPostings.test.ts    # NEW: Hook 단위 테스트
    │   ├── components/
    │   │   └── jobPosting/
    │   │       └── FixedJobCard.test.tsx       # NEW: 컴포넌트 테스트
    │   └── utils/
    │       └── jobPosting/
    │           └── validation.test.ts          # NEW: 검증 함수 테스트
    └── integration/
        └── FixedJobListing.integration.test.tsx # NEW: 통합 테스트
```

**Structure Decision**: React 웹 애플리케이션 구조 사용. 기존 `app2/src/` 디렉토리 구조를 유지하며, Hook과 컴포넌트를 각각 `hooks/`, `components/jobPosting/` 디렉토리에 배치합니다. 타입 정의는 기존 `types/jobPosting/jobPosting.ts`를 재사용하고, 검증 로직만 `utils/jobPosting/validation.ts`에 신규 추가합니다.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

**결과**: 위반 사항 없음. 모든 구현이 CLAUDE.md 및 기존 코드 패턴을 준수합니다.

---

## Phase 0: Research

**목표**: 기술적 불확실성 해소 및 구현 패턴 확정

### Research Tasks

#### R1: IntersectionObserver + React 통합 패턴 조사
- **질문**: React에서 IntersectionObserver를 Hook으로 구현하는 Best Practice는?
- **조사 항목**:
  - useEffect cleanup에서 observer.disconnect() 호출 패턴
  - 무한 스크롤 중복 요청 방지 (debounce/throttle)
  - React 18 Strict Mode에서 observer 재구독 문제 해결
- **결과 산출물**: `research.md` 섹션 "IntersectionObserver 패턴"

#### R2: Firestore 커서 기반 페이지네이션 조사
- **질문**: onSnapshot과 getDocs를 혼용한 페이지네이션 패턴은?
- **조사 항목**:
  - startAfter() 커서를 사용한 페이지 전환
  - 실시간 구독 중 커서 업데이트 전략
  - 페이지 경계에서 중복 문서 방지
- **결과 산출물**: `research.md` 섹션 "Firestore 페이지네이션"

#### R3: onSnapshot 성능 최적화 조사
- **질문**: 20개 문서 실시간 구독 시 성능 및 비용 최적화 방법은?
- **조사 항목**:
  - unsubscribe 시점 최적화 (컴포넌트 언마운트 vs 페이지 전환)
  - 복합 인덱스 구성 (postingType + status + createdAt)
  - React.memo와 useCallback을 활용한 리렌더링 최소화
- **결과 산출물**: `research.md` 섹션 "성능 최적화"

#### R4: React.memo + useCallback 패턴 조사
- **질문**: 리스트 렌더링에서 메모이제이션 최적화 전략은?
- **조사 항목**:
  - FixedJobCard를 React.memo로 래핑 시 비교 함수 필요 여부
  - onApply, onViewDetail 콜백의 useCallback 의존성 배열 설정
  - 부모 컴포넌트 리렌더링 시 자식 컴포넌트 재렌더링 방지
- **결과 산출물**: `research.md` 섹션 "메모이제이션 전략"

#### R5: 다크모드 Tailwind CSS 패턴 조사
- **질문**: 기존 프로젝트에서 사용 중인 다크모드 클래스 패턴은?
- **조사 항목**:
  - 기존 컴포넌트에서 dark: 클래스 사용 예시 확인
  - 카드 컴포넌트 배경/텍스트 색상 조합 (gray-50/800, gray-900/100 등)
  - 호버 및 포커스 상태 다크모드 스타일
- **결과 산출물**: `research.md` 섹션 "다크모드 패턴"

---

## Phase 1: Design

**목표**: 데이터 모델, API 계약, 개발 가이드 작성

### Artifacts

#### A1: data-model.md
- **FixedJobPosting 엔티티 정의** (기존 타입 참조)
  - 주요 속성: id, title, postingType, status, fixedConfig, fixedData, requiredRoles, createdAt
  - fixedData 구조: workSchedule, requiredRolesWithCount, viewCount
- **FixedData 엔티티 정의**
  - workSchedule: daysPerWeek, startTime, endTime
  - requiredRolesWithCount: RoleWithCount[] (name, count)
  - viewCount: number
- **관계 및 제약사항**
  - requiredRoles는 requiredRolesWithCount에서 name만 추출하여 자동 동기화
  - postingType === 'fixed' AND status === 'open' 조건으로 필터링

#### A2: contracts/
- **contracts/useFixedJobPostings.contract.ts**
  ```typescript
  // Hook 인터페이스 정의
  interface UseFixedJobPostingsReturn {
    postings: FixedJobPosting[];
    loading: boolean;
    error: Error | null;
    hasMore: boolean;
    loadMore: () => void;
  }
  ```
- **contracts/FixedJobCard.contract.ts**
  ```typescript
  // 컴포넌트 Props 정의
  interface FixedJobCardProps {
    posting: FixedJobPosting;
    onApply: (posting: FixedJobPosting) => void;
    onViewDetail: (postingId: string) => void;
  }
  ```
- **contracts/validation.contract.ts**
  ```typescript
  // 검증 함수 시그니처
  function validateFixedJobPosting(posting: FixedJobPosting): boolean;
  ```

#### A3: quickstart.md
- **개발 환경 설정**
  - Firebase 에뮬레이터 실행: `npm run emulators`
  - 개발 서버 실행: `npm start`
- **Hook 사용 예시**
  ```typescript
  const { postings, loading, error, hasMore, loadMore } = useFixedJobPostings();
  ```
- **컴포넌트 사용 예시**
  ```typescript
  <FixedJobCard
    posting={posting}
    onApply={handleApply}
    onViewDetail={handleViewDetail}
  />
  ```
- **무한 스크롤 구현 예시**
  ```typescript
  const observerRef = useRef<IntersectionObserver | null>(null);
  useEffect(() => {
    if (!loading && hasMore) {
      observerRef.current = new IntersectionObserver(([entry]) => {
        if (entry.isIntersecting) loadMore();
      });
      // ...
    }
  }, [loading, hasMore, loadMore]);
  ```

---

## Phase 2: Task Generation

**Phase 2는 `/speckit.tasks` 명령으로 별도 실행됩니다.**

`tasks.md` 파일은 Phase 1 완료 후 `/speckit.tasks` 명령을 통해 생성됩니다. 이 계획 문서에는 포함되지 않습니다.

---

## 완료 상태

### Phase 0: Research ✅
- [x] R1: IntersectionObserver + React 통합 패턴 조사
- [x] R2: Firestore 커서 기반 페이지네이션 조사
- [x] R3: onSnapshot 성능 최적화 조사
- [x] R4: React.memo + useCallback 패턴 조사
- [x] R5: 다크모드 Tailwind CSS 패턴 조사
- **결과물**: [research.md](./research.md)

### Phase 1: Design ✅
- [x] A1: data-model.md 작성
  - FixedJobPosting, FixedJobPostingData, WorkSchedule, RoleWithCount 엔티티 정의
  - 관계 및 제약사항 문서화
  - **결과물**: [data-model.md](./data-model.md)
- [x] A2: contracts/ 디렉토리 생성
  - useFixedJobPostings.contract.ts
  - FixedJobCard.contract.ts
  - validation.contract.ts
  - **결과물**: [contracts/](./contracts/)
- [x] A3: quickstart.md 작성
  - 개발 환경 설정 가이드
  - Hook 및 컴포넌트 사용법
  - 무한 스크롤 구현 패턴
  - 다크모드 지원 가이드
  - 테스트 및 디버깅 방법
  - **결과물**: [quickstart.md](./quickstart.md)

### Phase 2: Task Generation ⏳
- [ ] `/speckit.tasks` 명령 실행 대기
- [ ] tasks.md 생성 (의존성 기반 작업 순서 정의)

---

## 다음 단계

**Phase 1 완료**되었습니다. 다음 명령으로 Phase 2를 진행하세요:

```bash
/speckit.tasks
```

이 명령은 다음을 수행합니다:
1. spec.md, plan.md, data-model.md, contracts/ 분석
2. 구현 작업을 의존성 기반으로 정렬하여 tasks.md 생성
3. 각 작업에 우선순위, 예상 시간, 검증 기준 포함

**예상 작업 순서** (tasks.md에서 확정):
1. utils/jobPosting/validation.ts - validateFixedJobPosting 함수
2. hooks/useFixedJobPostings.ts - 고정공고 조회 Hook
3. components/jobPosting/FixedJobCard.tsx - 카드 컴포넌트
4. pages/JobBoardPage.tsx - 무한 스크롤 통합
5. __tests__/ - 단위 및 통합 테스트
