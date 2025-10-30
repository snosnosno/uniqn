# Implementation Plan: 구인공고 타입 확장 시스템

**Branch**: `001-job-posting-types` | **Date**: 2025-10-30 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-job-posting-types/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

구인공고 시스템을 2가지 타입(application/fixed)에서 4가지 타입(regular/fixed/tournament/urgent)으로 확장하고, 향후 신규 타입 추가를 고려한 확장 가능한 아키텍처를 구축합니다.

**핵심 기능**:
- 4가지 공고 타입 지원 (regular, fixed, tournament, urgent)
- 5개 탭 게시판 구조 (지원, 고정, 대회, 긴급, 내지원)
- 날짜 슬라이더 필터링 (어제~+14일, 총 16일)
- 타입별 시각적 차별화 (색상, 아이콘, 애니메이션)
- 칩 시스템 (고정: 3/5/10칩, 긴급: 5칩)
- 승인 시스템 (대회 공고 admin 승인)
- 레거시 데이터 호환성 (normalizePostingType)
- 확장 가능한 아키텍처 (동적 탭, 중앙 집중식 설정)

**기술적 접근**:
- TypeScript strict mode로 타입 안전성 보장
- Firestore 타입별 쿼리 분리로 성능 최적화
- 클라이언트 측 날짜 필터링으로 비용 절감
- Feature Flag 기반 점진적 롤아웃
- 다크모드 완벽 지원

## Technical Context

**Language/Version**: TypeScript 4.9 (React 18.2)
**Primary Dependencies**:
- React 18.2, React Router 6.14
- Firebase 11.9 (Firestore, Auth, Functions)
- Tailwind CSS 3.3
- Zustand 5.0 (상태 관리)
- date-fns 4.1 (날짜 처리)
- i18next 23.15 (다국어)
- @tanstack/react-table 8.21 (테이블)

**Storage**: Firebase Firestore (NoSQL, 실시간 구독)
**Testing**: Jest, React Testing Library, Firebase Emulator
**Target Platform**: Web (PWA) + Mobile (Capacitor 7.4 - iOS/Android)
**Project Type**: Web application (Frontend + Firebase Backend)
**Performance Goals**:
- 번들 크기 ≤ 350KB
- 초기 로드 < 3초 (3G)
- Firestore 조회 최적화 (타입별 쿼리)
- 캐싱 전략 (5분 TTL)

**Constraints**:
- TypeScript strict mode 100% 준수
- any 타입 사용 금지
- 다크모드 필수 적용
- logger 사용 (console.* 금지)
- 표준 필드명 (staffId, eventId)

**Scale/Scope**:
- 4개 공고 타입 (현재 2개에서 확장)
- 5개 게시판 탭
- 향후 신규 타입 추가 대비 (premium, sponsored 등)
- 레거시 데이터 호환성 유지

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Gate 1: TypeScript 타입 안전성 ✅ PASS
- ✅ TypeScript strict mode 100% 준수
- ✅ `any` 타입 사용 금지
- ✅ 모든 타입 정의 (postingType, fixedConfig, tournamentConfig, urgentConfig)
- ✅ Firebase 데이터 구조 인터페이스 정의
- ✅ `npm run type-check` 에러 0개 목표

**적용 계획**:
- JobPosting 인터페이스에 postingType 필드 추가
- 타입별 config 인터페이스 정의 (FixedConfig, TournamentConfig, UrgentConfig)
- normalizePostingType 함수 타입 안전성 보장
- ChipPricing, BoardTab 인터페이스 정의

### Gate 2: 테스트 우선 개발 ✅ PASS
- ✅ TDD Red-Green-Refactor 적용
- ✅ 핵심 로직 80% 커버리지 목표
- ✅ 통합 테스트 (Firestore 타입별 쿼리, 승인 시스템, 날짜 필터링)
- ✅ E2E 테스트 (6개 User Story 시나리오)

**테스트 계획**:
- Unit Tests: normalizePostingType, 칩 가격 계산, 날짜 필터링 로직
- Integration Tests: Firestore 타입별 쿼리, 승인 워크플로우, 레거시 데이터 변환
- E2E Tests: 공고 작성/조회, 탭 전환, 날짜 슬라이더, 승인 프로세스

### Gate 3: 사용자 경험 일관성 ✅ PASS
- ✅ 모든 UI 컴포넌트 다크모드 지원 (`dark:` 클래스)
- ✅ Toast 시스템 사용 (`alert()` 금지)
- ✅ 표준 필드명 (staffId, eventId) - 기존 시스템과 일관성 유지
- ✅ i18n 키 사용 (jobBoard.tabs.regular, jobBoard.tabs.fixed 등)
- ✅ 로딩/에러 상태 명확히 표시

**UI 컴포넌트**:
- JobPostingCard: 타입별 시각적 차별화 (색상, 아이콘, 애니메이션)
- DateSlider: 날짜 슬라이더 (가로 스크롤, 오늘 강조)
- JobBoardTabs: 5개 탭 (동적 생성)
- ApprovalModal: 승인/거부 모달 (admin 전용)

### Gate 4: 성능 표준 ✅ PASS
- ✅ 번들 크기 ≤ 350KB (현재 299KB, 여유 51KB)
- ✅ 메모이제이션: useMemo (날짜 필터링), useCallback (탭 전환)
- ✅ Firestore 타입별 쿼리 분리 (전체 조회 금지)
- ✅ 클라이언트 측 날짜 필터링 (Firestore 비용 절감)
- ✅ 캐싱 전략 (5분 TTL)

**성능 최적화**:
- 타입별 쿼리: `where('postingType', '==', 'regular')`
- 날짜 필터링: 클라이언트 측 filter
- 캐싱: Zustand store + 5분 TTL
- 가상화: react-window (대용량 리스트)

### Gate 5: 로깅 및 관찰성 ✅ PASS
- ✅ `logger` 사용 (`console.*` 금지)
- ✅ 로그 레벨: error (타입 검증 실패), warn (레거시 변환), info (공고 생성/승인)
- ✅ 충분한 컨텍스트 (postingType, userId, chipCost)
- ✅ 민감 정보 제외

**로깅 전략**:
- `logger.error`: 타입 검증 실패, config 검증 실패, 승인 권한 에러
- `logger.warn`: 레거시 데이터 자동 변환, postingType 기본값 설정
- `logger.info`: 공고 생성, 승인/거부, 칩 차감 준비

### Constitution Compliance Summary ✅ ALL GATES PASSED

**모든 헌장 원칙 준수**:
- ✅ I. TypeScript 타입 안전성 (NON-NEGOTIABLE)
- ✅ II. 테스트 우선 개발
- ✅ III. 사용자 경험 일관성 (NON-NEGOTIABLE)
- ✅ IV. 성능 표준
- ✅ V. 로깅 및 관찰성

**No violations. No complexity justification required.**

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
app2/                                    # React 애플리케이션 (메인 워크스페이스)
├── src/
│   ├── types/jobPosting/
│   │   ├── jobPosting.ts                # JobPosting 타입 정의 (postingType 추가)
│   │   ├── base.ts                      # 기본 타입 (DateSpecificRequirement 등)
│   │   └── index.ts                     # 타입 Export
│   │
│   ├── config/
│   │   ├── chipPricing.ts               # 칩 가격 중앙 관리 (NEW)
│   │   ├── boardTabs.ts                 # 동적 탭 설정 (NEW)
│   │   └── featureFlags.ts              # Feature Flag 관리 (기존)
│   │
│   ├── utils/jobPosting/
│   │   ├── jobPostingHelpers.ts         # normalizePostingType 함수 (NEW)
│   │   ├── chipCalculator.ts            # 칩 비용 계산 (NEW)
│   │   └── dateFilter.ts                # 날짜 필터링 로직 (NEW)
│   │
│   ├── hooks/
│   │   ├── useJobPostings.ts            # 공고 조회 (타입별 쿼리 추가)
│   │   ├── useJobPostingOperations.ts   # 공고 CRUD (타입별 config 추가)
│   │   └── useJobPostingApproval.ts     # 승인 시스템 (NEW)
│   │
│   ├── stores/
│   │   └── jobPostingStore.ts           # Zustand store (캐싱 전략)
│   │
│   ├── components/
│   │   ├── jobPosting/
│   │   │   ├── JobPostingForm.tsx       # 공고 작성 폼 (타입 선택 추가)
│   │   │   ├── JobPostingCard.tsx       # 공고 카드 (타입별 스타일)
│   │   │   ├── DateSlider.tsx           # 날짜 슬라이더 (NEW)
│   │   │   ├── ApprovalModal.tsx        # 승인/거부 모달 (NEW)
│   │   │   └── modals/
│   │   │       └── EditJobPostingModal.tsx  # 공고 수정 모달
│   │   │
│   │   └── common/
│   │       └── JobPostingCard.tsx       # 공통 카드 컴포넌트
│   │
│   ├── pages/
│   │   ├── JobBoard/
│   │   │   ├── index.tsx                # 게시판 메인 (5개 탭)
│   │   │   ├── JobFilters.tsx           # 필터 컴포넌트
│   │   │   ├── components/
│   │   │   │   ├── JobListTab.tsx       # 공고 리스트 탭
│   │   │   │   └── MyApplicationsTab.tsx  # 내지원 탭
│   │   │   └── hooks/
│   │   │       └── useJobBoard.ts       # 게시판 로직
│   │   │
│   │   └── JobPostingAdminPage.tsx      # Admin 승인 관리 페이지
│   │
│   └── locales/                         # i18n 번역 파일
│       ├── ko/translation.json          # 한국어 (탭 라벨 추가)
│       └── en/translation.json          # 영어 (탭 라벨 추가)
│
└── tests/
    ├── unit/
    │   ├── normalizePostingType.test.ts
    │   ├── chipCalculator.test.ts
    │   └── dateFilter.test.ts
    │
    ├── integration/
    │   ├── jobPostingQueries.test.ts    # Firestore 타입별 쿼리
    │   ├── approvalWorkflow.test.ts     # 승인 워크플로우
    │   └── legacyDataConversion.test.ts # 레거시 데이터 변환
    │
    └── e2e/
        ├── jobPosting.spec.ts           # 공고 작성/조회
        ├── boardTabs.spec.ts            # 탭 전환
        ├── dateSlider.spec.ts           # 날짜 슬라이더
        └── approval.spec.ts             # 승인 프로세스

functions/                               # Firebase Functions (백엔드)
├── src/
│   ├── api/
│   │   └── jobPostings/
│   │       ├── approveJobPosting.ts     # 승인 함수 (NEW)
│   │       └── rejectJobPosting.ts      # 거부 함수 (NEW)
│   │
│   └── scheduled/
│       └── expireFixedPostings.ts       # 고정 공고 만료 처리 (NEW)
│
└── tests/
    └── jobPostingFunctions.test.ts

firestore.rules                          # Security Rules (타입별 검증 추가)
```

**Structure Decision**: Web application (React Frontend + Firebase Backend)

UNIQN 프로젝트는 `app2/` 디렉토리에서 React 애플리케이션을 개발하며, Firebase Functions를 백엔드로 사용합니다. 구인공고 타입 확장 기능은 기존 구조를 활용하되, 타입 시스템, 설정 파일, 새로운 컴포넌트/함수를 추가하여 구현됩니다.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

**No violations.** 모든 헌장 원칙을 준수하므로 복잡도 정당화가 필요하지 않습니다.

---

## Phase 0: Research (✅ Completed)

**Output**: [research.md](./research.md)

**Resolved Unknowns**:
1. ✅ Firestore 타입별 쿼리 최적화 → 타입별 쿼리 분리 + 복합 인덱스
2. ✅ 날짜 슬라이더 구현 패턴 → date-fns + 가로 스크롤 + 클라이언트 필터링
3. ✅ 타입별 시각적 차별화 → Tailwind CSS + 조건부 클래스 + Keyframe 애니메이션
4. ✅ 승인 시스템 아키텍처 → Firebase Functions + Security Rules
5. ✅ 레거시 데이터 마이그레이션 → 런타임 변환 + 점진적 마이그레이션
6. ✅ 확장 가능한 아키텍처 → 설정 기반 + Feature Flag + 동적 탭 생성
7. ✅ 성능 최적화 전략 → 메모이제이션 + 캐싱 (5분 TTL) + 가상화

**Key Decisions Made**:
- Firestore: 타입별 쿼리 + 3개 복합 인덱스
- Client-side: 날짜 필터링 (Firestore 비용 절감)
- UI: Tailwind CSS + 다크모드 (프로젝트 표준)
- Backend: Firebase Functions + Firestore Trigger (기존 패턴)
- Migration: 런타임 변환 (즉시 배포 가능)
- Extensibility: 설정 기반 (향후 타입 추가 대비)
- Performance: 메모이제이션 + 캐싱 + 가상화

---

## Phase 1: Design & Contracts (✅ Completed)

**Outputs**:
- [data-model.md](./data-model.md) - Entity 정의, 관계, 검증 규칙
- [contracts/api-contracts.md](./contracts/api-contracts.md) - API 엔드포인트, 요청/응답 형식
- [quickstart.md](./quickstart.md) - 빠른 시작 가이드

**Entities Defined**:
1. ✅ JobPosting (Extended) - `postingType`, 타입별 config 추가
2. ✅ FixedConfig (New) - 고정 공고 설정
3. ✅ TournamentConfig (New) - 대회 공고 승인 시스템
4. ✅ UrgentConfig (New) - 긴급 공고 설정
5. ✅ BoardTab (New) - 동적 탭 생성 시스템
6. ✅ ChipPricing (New) - 칩 가격 중앙 관리

**API Contracts Defined**:
1. ✅ `approveJobPosting` - Firebase Callable Function (admin)
2. ✅ `rejectJobPosting` - Firebase Callable Function (admin)
3. ✅ `expireFixedPostings` - Scheduled Function (매시간)
4. ✅ Firestore Queries - 타입별 조회, 승인 대기 조회
5. ✅ Client Hooks - `useJobPostings`, `useJobPostingApproval`, `useJobPostingOperations`

**Firestore Indexes Required**:
1. `postingType (ASC) + status (ASC) + createdAt (DESC)`
2. `postingType (ASC) + createdBy (ASC) + createdAt (DESC)`
3. `postingType (ASC) + tournamentConfig.approvalStatus (ASC) + createdAt (DESC)`

**Security Rules**:
- ✅ `postingType` 필드 필수 검증
- ✅ 타입별 config 검증 (fixedConfig, tournamentConfig, urgentConfig)
- ✅ chipCost 값 검증 (fixed: 3/5/10, urgent: 5)
- ✅ admin만 승인 권한
- ✅ 작성자만 수정/삭제

---

## Phase 2: Constitution Re-Check (✅ Passed)

**Post-Design Validation**: 모든 헌장 원칙을 준수합니다.

### Gate 1: TypeScript 타입 안전성 ✅ PASS (재확인)
- ✅ 모든 Entity 타입 정의 완료 (JobPosting, FixedConfig, TournamentConfig, UrgentConfig)
- ✅ API 계약 타입 정의 완료 (Request/Response)
- ✅ normalizePostingType 함수 타입 안전성 보장
- ✅ any 타입 사용 없음

### Gate 2: 테스트 우선 개발 ✅ PASS (재확인)
- ✅ Unit Test 계획 (normalizePostingType, chipCalculator, dateFilter)
- ✅ Integration Test 계획 (Firestore 쿼리, 승인 워크플로우, 레거시 변환)
- ✅ E2E Test 계획 (6개 User Story 시나리오)

### Gate 3: 사용자 경험 일관성 ✅ PASS (재확인)
- ✅ 모든 UI 컴포넌트 다크모드 지원 설계
- ✅ Toast 시스템 사용 계획
- ✅ i18n 키 정의 (jobBoard.tabs.*)
- ✅ 로딩/에러 상태 설계

### Gate 4: 성능 표준 ✅ PASS (재확인)
- ✅ 타입별 쿼리 분리 (전체 조회 금지)
- ✅ 클라이언트 측 날짜 필터링 (Firestore 비용 절감)
- ✅ 메모이제이션 계획 (useMemo, useCallback)
- ✅ 캐싱 전략 (5분 TTL)
- ✅ 번들 크기 예상 (현재 299KB + 새 코드 < 50KB = 350KB 이하)

### Gate 5: 로깅 및 관찰성 ✅ PASS (재확인)
- ✅ logger 사용 계획 (error, warn, info)
- ✅ 충분한 컨텍스트 포함 (postingType, userId, chipCost)
- ✅ 민감 정보 제외

**No violations. Ready for implementation (Phase 2: Tasks).**

---

## Implementation Readiness

### ✅ Prerequisites Met
- [x] Constitution Check 통과 (모든 게이트)
- [x] Technical unknowns 해결 (research.md)
- [x] Data model 정의 (data-model.md)
- [x] API contracts 정의 (contracts/)
- [x] Quickstart guide 작성 (quickstart.md)
- [x] Agent context 업데이트 (CLAUDE.md)

### 📋 Next Phase
**Phase 2**: `/speckit.tasks` 명령으로 implementation tasks 생성

**Task Categories** (예상):
1. 🔧 **Setup**: 타입 정의, config 파일, Feature Flag
2. 🧩 **Core Logic**: normalizePostingType, chipCalculator, dateFilter
3. 🎨 **UI Components**: DateSlider, JobPostingCard 타입별 스타일, ApprovalModal
4. 🔌 **Integration**: useJobPostings 확장, useJobPostingApproval 신규, Firestore 쿼리
5. 🔐 **Backend**: Firebase Functions (approve/reject/expire), Security Rules
6. 🧪 **Testing**: Unit/Integration/E2E 테스트
7. 🌐 **i18n**: 한국어/영어 번역 추가
8. 📖 **Documentation**: README 업데이트, API 문서

### 🎯 Success Criteria
- TypeScript strict mode 에러 0개
- 모든 테스트 통과 (80%+ 커버리지)
- 번들 크기 ≤ 350KB
- 다크모드 완벽 지원
- 레거시 데이터 정상 작동

---

## Summary

**Branch**: `001-job-posting-types`
**Status**: Phase 1 Complete, Ready for Phase 2 (Tasks)

**Completed Artifacts**:
- ✅ plan.md (this file)
- ✅ research.md
- ✅ data-model.md
- ✅ contracts/api-contracts.md
- ✅ quickstart.md

**Next Command**: `/speckit.tasks`

**Estimated Implementation Time**: 3-5 days (P1 우선순위 기준)

**Risk Assessment**: 🟢 Low
- 기존 시스템 확장이므로 위험 낮음
- 레거시 호환성 보장
- 점진적 롤아웃 가능 (Feature Flag)
- Constitution 완전 준수
