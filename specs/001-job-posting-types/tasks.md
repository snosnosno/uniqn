# Implementation Tasks: 구인공고 타입 확장 시스템

**Branch**: `001-job-posting-types` | **Date**: 2025-10-30
**Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

## Task Format

```
- [ ] [TASK-###] [P] [US#] Description (path/to/file.ts)
```

- `[TASK-###]`: 고유 Task ID
- `[P]`: 병렬 실행 가능 여부 (parallelizable)
- `[US#]`: User Story 번호 (1-6)
- `Description`: 작업 설명
- `(path/to/file.ts)`: 영향받는 파일 경로

---

## Phase 0: Setup & Prerequisites ✅ COMPLETED

**목적**: 프로젝트 환경 준비 및 기초 설정

- [x] [TASK-001] Feature branch 생성 (`001-job-posting-types`)
- [x] [TASK-002] 기획 문서 작성 (spec.md, plan.md, research.md, data-model.md, contracts/, quickstart.md)
- [x] [TASK-003] Agent context 업데이트 (CLAUDE.md)
- [x] [TASK-004] Constitution 검증 완료 (5개 게이트 통과)

---

## Phase 1: Foundational Types & Config (P1 - Core Foundation) ✅ COMPLETED

**목적**: 타입 시스템 및 중앙 설정 구축

### 타입 정의 (모든 User Story 의존)

- [x] [TASK-101] [P] `PostingType` 타입 정의 (`app2/src/types/jobPosting/jobPosting.ts`)
  - `type PostingType = 'regular' | 'fixed' | 'tournament' | 'urgent';`
  - 기존 JobPosting 인터페이스에 `postingType: PostingType` 필드 추가
  - 레거시 필드 유지: `type?`, `recruitmentType?` (읽기 전용)
  - **검증**: ✅ `npm run type-check` 에러 0개

- [x] [TASK-102] [P] `FixedConfig` 인터페이스 정의 (US2) (`app2/src/types/jobPosting/jobPosting.ts`)
  - 필드: `durationDays: 7 | 30 | 90`, `chipCost: 3 | 5 | 10`, `expiresAt: Timestamp`, `createdAt: Timestamp`
  - JobPosting에 `fixedConfig?: FixedConfig` 추가
  - **검증**: ✅ TypeScript strict mode 통과

- [x] [TASK-103] [P] `TournamentConfig` 인터페이스 정의 (US3) (`app2/src/types/jobPosting/jobPosting.ts`)
  - 필드: `approvalStatus: 'pending' | 'approved' | 'rejected'`, `approvedBy?: string`, `approvedAt?: Timestamp`, `rejectedBy?: string`, `rejectedAt?: Timestamp`, `rejectionReason?: string`, `submittedAt: Timestamp`
  - JobPosting에 `tournamentConfig?: TournamentConfig` 추가
  - **검증**: ✅ TypeScript strict mode 통과

- [x] [TASK-104] [P] `UrgentConfig` 인터페이스 정의 (US4) (`app2/src/types/jobPosting/jobPosting.ts`)
  - 필드: `chipCost: 5`, `priority: 'high'`, `createdAt: Timestamp`
  - JobPosting에 `urgentConfig?: UrgentConfig` 추가
  - **검증**: ✅ TypeScript strict mode 통과

- [x] [TASK-105] [P] `BoardTab` 인터페이스 정의 (US5) (`app2/src/types/jobPosting/boardTab.ts` - NEW)
  - 필드: `id: string`, `labelKey: string`, `icon: string`, `postingType?: PostingType`, `order: number`, `enabled: boolean`
  - **검증**: ✅ TypeScript strict mode 통과

- [x] [TASK-106] [P] `ChipPricing` 인터페이스 정의 (US2, US4) (`app2/src/types/jobPosting/chipPricing.ts` - NEW)
  - 필드: `postingType: 'fixed' | 'urgent'`, `durationDays?: 7 | 30 | 90`, `chipCost: number`
  - **검증**: ✅ TypeScript strict mode 통과

### 중앙 설정 파일

- [x] [TASK-107] 칩 가격 설정 파일 생성 (US2, US4) (`app2/src/config/chipPricing.ts` - NEW)
  - `CHIP_PRICING` 상수 정의 (고정: 7일=3칩, 30일=5칩, 90일=10칩; 긴급: 5칩)
  - Export: `getChipCost(postingType, durationDays?)` 함수
  - **검증**: ✅ 설정 파일 생성 완료

- [x] [TASK-108] 게시판 탭 설정 파일 생성 (US5) (`app2/src/config/boardTabs.ts` - NEW)
  - `BOARD_TABS` 상수 정의 (5개 탭: regular, fixed, tournament, urgent, myApplications)
  - 각 탭: id, labelKey (i18n), icon, postingType, order, enabled (Feature Flag)
  - **검증**: ✅ 5개 탭 모두 정의 완료

- [x] [TASK-109] Tailwind 애니메이션 설정 추가 (US4) (`app2/tailwind.config.js`)
  - `animate-pulse-border` 키프레임 정의 (긴급 공고 깜빡임 효과)
  - 다크모드 대응 색상 추가
  - **검증**: ✅ 애니메이션 설정 완료

**Phase 1 완료 조건**: ✅ PASS
- ✅ TypeScript strict mode 에러 0개
- ✅ 모든 타입 인터페이스 정의 완료
- ✅ 중앙 설정 파일 생성 완료

---

## Phase 2: Core Logic & Utilities (P1 - Business Logic) ✅ COMPLETED

**목적**: 타입 변환, 칩 계산, 날짜 필터링 등 핵심 로직 구현

### 레거시 데이터 호환성 (US6 - 최우선)

- [x] [TASK-201] `normalizePostingType` 함수 구현 (US6) (`app2/src/utils/jobPosting/jobPostingHelpers.ts`)
  - 입력: `Partial<JobPosting>`
  - 출력: `PostingType`
  - 로직: `postingType` 우선, 없으면 `type`/`recruitmentType` 변환, 없으면 'regular' 기본값
  - 로깅: `logger.warn` for legacy conversion
  - **검증**: ✅ 함수 구현 완료, TypeScript 에러 0개

### 칩 시스템 (US2, US4)

- [x] [TASK-202] [P] 칩 비용 계산 함수 구현 (US2, US4) (`app2/src/utils/jobPosting/chipCalculator.ts` - NEW)
  - 함수: `calculateChipCost(postingType: PostingType, durationDays?: number): number`
  - 로직: CHIP_PRICING config 참조
  - 검증: postingType, durationDays 유효성 체크
  - 로깅: `logError` for invalid values
  - **검증**: ✅ 함수 구현 완료, TypeScript 에러 0개

- [x] [TASK-203] [P] 칩 차감 예정 알림 함수 구현 (US2, US4) (`app2/src/utils/jobPosting/chipNotification.ts` - NEW)
  - 함수: `notifyChipDeduction(postingType: PostingType, chipCost: number): void`
  - 로직: Toast 메시지 표시 (예: "공고 생성 시 5칩이 차감될 예정입니다")
  - **검증**: ✅ 함수 구현 완료, toast 시스템 통합 완료

### 날짜 필터링 (US1, US5)

- [x] [TASK-204] [P] 날짜 범위 생성 함수 구현 (US1) (`app2/src/utils/jobPosting/dateFilter.ts` - NEW)
  - 함수: `generateDateRange(fromDate: Date, dayCount: number): Date[]`
  - 로직: date-fns `addDays` 사용, 어제부터 +14일까지 16일 생성
  - **검증**: ✅ 함수 구현 완료

- [x] [TASK-205] [P] 날짜별 공고 필터링 함수 구현 (US1) (`app2/src/utils/jobPosting/dateFilter.ts`)
  - 함수: `filterPostingsByDate(postings: JobPosting[], selectedDate: Date | null): JobPosting[]`
  - 로직: `dateSpecificRequirements` 배열에서 `isSameDay` 비교
  - null일 때 전체 반환
  - **검증**: ✅ 함수 구현 완료, Firestore Timestamp 처리 포함

**Phase 2 완료 조건**: ✅ PASS
- ✅ TypeScript strict mode 에러 0개
- ✅ 모든 유틸리티 함수 구현 완료
- ✅ logger 사용 (console.* 없음)

---

## Phase 3: User Story 1 & 5 (P1 - 지원 공고 & 탭 시스템) ✅ COMPLETED (9/9 완료)

**목적**: 기본 공고 작성 및 타입별 탭 조회 기능 구현

### Hook 확장 (US1, US5)

- [x] [TASK-301] `useJobPostings` Hook 확장 (US1, US5) (`app2/src/hooks/useJobPostings.ts`)
  - 기존 Hook에 `postingType` 필터 파라미터 추가
  - Firestore 쿼리: `where('postingType', '==', postingType)`
  - normalizePostingType 함수 적용
  - **검증**: ✅ Hook 확장 완료, TypeScript 에러 0개

- [x] [TASK-302] `useJobPostingOperations` Hook 확장 (US1) (`app2/src/hooks/useJobPostingOperations.ts`)
  - `createPosting` 함수에 postingType 파라미터 추가
  - chipCost 계산 로직 추가 (`calculateChipCost`)
  - chipCost, isChipDeducted 필드 설정
  - 로깅: `logger.info` for posting creation
  - **검증**: ✅ Hook 확장 완료, TypeScript 에러 0개

### UI 컴포넌트 (US1, US5)

- [x] [TASK-303] 날짜 슬라이더 컴포넌트 생성 (US1) (`app2/src/components/jobPosting/DateSlider.tsx` - NEW)
  - 어제~+14일 날짜 버튼 생성
  - "전체" 버튼 추가
  - 오늘 날짜 파란색 강조 (`bg-blue-500 dark:bg-blue-600`)
  - 가로 스크롤 지원 (`overflow-x-auto`)
  - IntersectionObserver로 오늘 날짜 자동 스크롤
  - useMemo로 날짜 범위 메모이제이션
  - **검증**: ✅ 컴포넌트 생성 완료, TypeScript 에러 0개

- [x] [TASK-304] [P] JobPostingCard 타입별 스타일 확장 (US5) (`app2/src/components/common/JobPostingCard.tsx`)
  - `POSTING_STYLES` 맵 정의 (4가지 타입별 border, icon, bg)
  - normalizePostingType 함수 적용
  - 긴급 공고 깜빡이는 배지 추가 (`animate-pulse`)
  - 칩 비용 표시 (`chipCost` 필드)
  - 타입 아이콘 표시 (📋📌🏆🚨)
  - 다크모드 완벽 지원 (`dark:` 클래스)
  - **검증**: ✅ 스타일 확장 완료, TypeScript 에러 0개

- [x] [TASK-305] 게시판 탭 컴포넌트 생성 (US5) (`app2/src/pages/JobBoard/components/JobBoardTabs.tsx` - NEW)
  - BOARD_TABS config 기반 동적 탭 생성
  - Feature Flag 체크 (`enabled` 필드)
  - 탭 클릭 시 postingType 변경
  - 활성 탭 스타일링 (파란색 언더라인)
  - i18n 키 사용 (`t(tab.labelKey)`)
  - 다크모드 지원
  - **검증**: ✅ 컴포넌트 생성 완료, TypeScript 에러 0개

- [x] [TASK-306] 공고 작성 폼 타입 선택 추가 (US1) (`app2/src/components/jobPosting/JobPostingForm.tsx`)
  - 4가지 타입 라디오 버튼 추가 (지원/고정/대회/긴급)
  - 타입 선택 시 칩 비용 표시 (고정: 3-10칩, 긴급: 5칩)
  - 타입별 아이콘 표시 (📋📌🏆🚨)
  - 칩 차감 예정 알림 UI 추가 (노란색 박스)
  - 다크모드 지원
  - **검증**: ✅ 폼 UI 추가 완료, TypeScript 에러 0개

### 페이지 통합 (US5)

- [x] [TASK-307] JobBoardPage 탭 시스템 통합 (US5) (`app2/src/pages/JobBoard/index.tsx`)
  - JobBoardTabs 컴포넌트 추가
  - DateSlider 컴포넌트 추가 (지원 탭에만)
  - 탭별 공고 필터링 로직 (postingType, 날짜)
  - activePostingType 상태 관리
  - 로딩/에러 상태 표시
  - 다크모드 지원
  - **검증**: ✅ 탭 시스템 통합 완료, TypeScript 에러 0개

### i18n (US1, US5)

- [x] [TASK-308] [P] 한국어/영어 번역 추가 (US1, US5) (`app2/public/locales/*/translation.json`)
  - ✅ `jobBoard.tabs.regular`: "지원" / "Regular"
  - ✅ `jobBoard.tabs.fixed`: "고정" / "Fixed"
  - ✅ `jobBoard.tabs.tournament`: "대회" / "Tournament"
  - ✅ `jobBoard.tabs.urgent`: "긴급" / "Urgent"
  - ✅ `jobBoard.tabs.myApplications`: "내지원" / "My Applications"
  - **검증**: ✅ 번역 추가 완료

- [x] [TASK-309] [P] 추가 helpers 함수 업데이트 (US1) (`app2/src/utils/jobPosting/jobPostingHelpers.ts`)
  - createInitialFormData에 postingType 필드 추가 (기본값: 'regular')
  - **검증**: ✅ 함수 업데이트 완료

**Phase 3 완료 상황**: ✅ 100% 완료
- ✅ 완료: 9/9 tasks (100%)
  - TASK-301, 302, 303, 304, 305, 306, 307, 308, 309
- 📊 품질 검증: TypeScript 에러 0개
- 🎨 다크모드: 모든 컴포넌트 완벽 지원

**Phase 3 완료 조건**: ✅ PASS
- ✅ User Story 1 & 5 UI 구현 완료
- ✅ 타입별 탭 시스템 정상 작동
- ✅ 날짜 슬라이더 정상 작동
- ✅ 다크모드 완벽 지원
- ✅ TypeScript strict mode 에러 0개

---

## Phase 4: User Story 6 (P1 - 레거시 데이터 호환성) ✅ COMPLETED (3/3 완료)

**목적**: 기존 데이터 자동 변환 및 하위 호환성 보장

### 통합 테스트 (US6)

- [x] [TASK-401] 레거시 데이터 변환 Integration Test (US6) (`app2/src/__tests__/integration/legacyDataConversion.test.ts` - NEW)
  - 시나리오 1: type='application' → postingType='regular'
  - 시나리오 2: recruitmentType='fixed' → postingType='fixed'
  - 시나리오 3: 필드 없음 → postingType='regular' + 경고 로그
  - 시나리오 4: 전체 타입 변환 매핑 검증 (8개 케이스)
  - 시나리오 5: 잘못된 값 처리 (3개 케이스)
  - **검증**: ✅ 17개 테스트 모두 통과

- [x] [TASK-402] 레거시 공고 조회 통합 테스트 (US6) (`app2/src/__tests__/integration/legacyJobPostingQuery.test.ts` - NEW)
  - 시나리오 1: 공고 배열 정규화 (3개 케이스)
  - 시나리오 2: 타입별 필터링 (4개 케이스)
  - 시나리오 3: 레거시/신규 필드 혼합 (3개 케이스)
  - 시나리오 4: 전체 공고 조회 (2개 케이스)
  - **검증**: ✅ 12개 테스트 모두 통과

### 데이터 마이그레이션 스크립트 (선택적)

- [x] [TASK-403] 배치 마이그레이션 스크립트 작성 (US6) (`functions/src/migrations/addPostingType.ts` - NEW, 선택적)
  - Firestore 공고 조회 (postingType 없는 것만)
  - convertLegacyType 함수로 변환 (type/recruitmentType → postingType)
  - 배치 업데이트 (500개 제한)
  - admin 권한 체크 (migratePostingTypesCallable)
  - 로깅: `logger.info` for migration progress
  - Dry-run 모드 지원 (dryRun: true/false)
  - 단일 문서 마이그레이션 함수 (migrateSinglePosting)
  - **검증**: ✅ 스크립트 작성 완료, Production 실행은 선택적

**Phase 4 완료 상황**: ✅ 100% 완료
- ✅ 완료: 3/3 tasks (100%)
  - TASK-401, 402, 403
- 📊 품질 검증: TypeScript 에러 0개, 총 29개 테스트 통과
- 🔄 레거시 호환성: normalizePostingType 자동 적용

**Phase 4 완료 조건**: ✅ PASS
- ✅ User Story 6 레거시 변환 로직 검증 완료
- ✅ Integration Test 29개 모두 통과
- ✅ 배치 마이그레이션 스크립트 작성 완료
- ✅ TypeScript strict mode 에러 0개

---

## Phase 5: User Story 2 (P2 - 고정 공고)

**목적**: 유료 고정 공고 작성 및 기간 관리 기능 구현

### UI 컴포넌트 (US2)

- [x] [TASK-501] 고정 공고 기간 선택 UI 추가 (US2) (`app2/src/components/jobPosting/JobPostingForm.tsx`)
  - 7일/30일/90일 라디오 버튼 추가
  - 기간별 칩 비용 표시 (3/5/10칩)
  - fixedConfig 생성 로직
  - **검증**: ✅ JobPostingForm.tsx 수정 완료, 다크모드 적용
  - 검증: durationDays와 chipCost 매핑 체크
  - **검증**: E2E Test (jobPosting.spec.ts) - 고정 공고 작성 시나리오

- [x] [TASK-502] [P] 고정 공고 만료일 표시 컴포넌트 (US2) (`app2/src/components/jobPosting/FixedPostingBadge.tsx` - NEW)
  - 만료일 계산 (expiresAt)
  - "D-7" 형식 표시
  - 만료 임박 시 빨간색 강조 (D-3 이하)
  - 다크모드 지원
  - **검증**: ✅ FixedPostingBadge.tsx 생성 완료, date-fns 사용, 3가지 상태 구현

### Backend (US2)

- [x] [TASK-503] 고정 공고 만료 처리 Scheduled Function (US2) (`functions/src/scheduled/expireFixedPostings.ts` - NEW)
  - Schedule: `every 1 hours`
  - 로직: `expiresAt <= now()` 조회 → status='closed' 업데이트
  - 배치 처리 (100개 제한)
  - 로깅: `logger.info` for expired postings
  - **검증**: ✅ expireFixedPostings.ts 생성 완료, manualExpireFixedPostings callable 함수 포함

- [x] [TASK-504] [P] 고정 공고 만료 알림 Trigger (US2) (`functions/src/triggers/onFixedPostingExpired.ts` - NEW, 선택적)
  - Firestore Trigger: status 변경 감지
  - 작성자에게 만료 알림 전송
  - **검증**: ✅ onFixedPostingExpired.ts 생성 완료, notifications 컬렉션 연동

### i18n (US2)

- [x] [TASK-505] [P] 고정 공고 i18n 추가 (`app2/src/locales/*/translation.json`)
  - `jobBoard.fixed.durationLabel`: "노출 기간"
  - `jobBoard.fixed.7days`: "7일 (3칩)"
  - `jobBoard.fixed.30days`: "30일 (5칩)"
  - `jobBoard.fixed.90days`: "90일 (10칩)"
  - `jobBoard.fixed.expiresIn`: "만료: D-{days}"
  - **검증**: ✅ 한국어/영어 번역 파일에 fixed 섹션 추가 완료 (14개 키)

**Phase 5 완료 상황**: ✅ 100% 완료
- ✅ 완료: 5/5 tasks (100%)
  - TASK-501, 502, 503, 504, 505
- 📊 품질 검증: TypeScript 에러 0개
- 🎨 UI: 고정 공고 기간 선택 UI, 만료일 배지 (3가지 상태)
- ⚙️ Backend: Scheduled Function (매 1시간), Firestore Trigger (만료 알림)
- 🌐 i18n: 한국어/영어 14개 번역 키 추가

**Phase 5 완료 조건**: ✅ PASS
- ✅ User Story 2 고정 공고 UI/Backend 완성
- ✅ Scheduled Function 및 Trigger 작성 완료
- ✅ i18n 번역 추가 완료
- ✅ TypeScript strict mode 에러 0개

---

## Phase 6: User Story 4 (P2 - 긴급 공고) ✅ COMPLETED (4/4 완료)

**목적**: 유료 긴급 공고 작성 및 시각적 강조 기능 구현

### UI 컴포넌트 (US4)

- [x] [TASK-601] 긴급 공고 작성 UI 추가 (US4) (`app2/src/components/jobPosting/JobPostingForm.tsx`)
  - ✅ 긴급 타입 선택 시 5칩 고정 비용 표시
  - ✅ urgentConfig 생성 로직 (chipCost: 5, priority: 'high')
  - ✅ 칩 차감 예정 알림 표시 ("긴급 공고 생성 시 5칩이 차감됩니다")
  - **검증**: ✅ JobPostingForm.tsx 수정 완료

- [x] [TASK-602] [P] 긴급 공고 깜빡이는 배지 컴포넌트 (US4) (`app2/src/components/common/JobPostingCard.tsx`)
  - ✅ "긴급" 텍스트 + 🚨 아이콘
  - ✅ 빨간색 배경 + `animate-pulse` 애니메이션
  - ✅ 다크모드 지원 (`bg-red-100 dark:bg-red-900/30`)
  - **검증**: ✅ 이미 구현되어 있음

### Styling (US4)

- [x] [TASK-603] 긴급 공고 카드 스타일 적용 (US4) (`app2/src/components/common/JobPostingCard.tsx`)
  - ✅ 빨간색 테두리 (`border-2 border-red-500 dark:border-red-400`)
  - ✅ `animate-pulse-border` 애니메이션 적용
  - ✅ 긴급 배지 컴포넌트 추가
  - **검증**: ✅ POSTING_STYLES 맵에 urgent 스타일 정의 완료

### i18n (US4)

- [x] [TASK-604] [P] 긴급 공고 i18n 추가 (`app2/public/locales/*/translation.json`)
  - ✅ `jobBoard.urgent.label`: "긴급" / "Urgent"
  - ✅ `jobBoard.urgent.chipCost`: "5칩 (고정)" / "5 chips (fixed)"
  - ✅ `jobBoard.urgent.badge`: "긴급 모집" / "Urgent Hiring"
  - ✅ `jobBoard.urgent.description`: "긴급 공고로 상단에 노출됩니다" / "Featured at the top as urgent posting"
  - **검증**: ✅ 한국어/영어 번역 파일에 urgent 섹션 추가 완료

**Phase 6 완료 상황**: ✅ 100% 완료
- ✅ 완료: 4/4 tasks (100%)
  - TASK-601, 602, 603, 604
- 📊 품질 검증: TypeScript 에러 0개
- 🎨 UI: 긴급 공고 UI, 깜빡이는 배지, 빨간색 테두리
- 🌐 i18n: 한국어/영어 4개 번역 키 추가

**Phase 6 완료 조건**: ✅ PASS
- ✅ User Story 4 긴급 공고 UI/스타일 완성
- ✅ 애니메이션 적용 완료 (animate-pulse, animate-pulse-border)
- ✅ i18n 번역 추가 완료
- ✅ TypeScript strict mode 에러 0개

---

## Phase 7: User Story 3 (P3 - 대회 공고 승인 시스템) ✅ COMPLETED (10/10 완료)

**목적**: admin 승인 시스템 구현 (복잡도 높음)

### Hook (US3)

- [x] [TASK-701] `useJobPostingApproval` Hook 구현 (US3) (`app2/src/hooks/useJobPostingApproval.ts` - NEW)
  - ✅ Firestore 쿼리: `where('postingType', '==', 'tournament')` + `where('tournamentConfig.approvalStatus', '==', 'pending')`
  - ✅ `approve(postingId)` 함수 (Firebase Function 호출)
  - ✅ `reject(postingId, reason)` 함수 (Firebase Function 호출)
  - ✅ admin 권한 체크 (클라이언트 측)
  - **검증**: ✅ Hook 생성 완료, Firebase Functions와 연동

### Backend (US3)

- [x] [TASK-702] `approveJobPosting` Firebase Function (US3) (`functions/src/api/jobPostings/approveJobPosting.ts` - NEW)
  - ✅ Callable Function
  - ✅ admin 권한 체크 (`request.auth.token.role === 'admin'`)
  - ✅ tournamentConfig 업데이트: `approvalStatus='approved'`, `approvedBy`, `approvedAt`
  - ✅ 로깅: `logger.info` for approval
  - **검증**: ✅ Firebase Function 생성 완료

- [x] [TASK-703] `rejectJobPosting` Firebase Function (US3) (`functions/src/api/jobPostings/rejectJobPosting.ts` - NEW)
  - ✅ Callable Function
  - ✅ admin 권한 체크
  - ✅ 거부 사유 검증 (최소 10자)
  - ✅ tournamentConfig 업데이트: `approvalStatus='rejected'`, `rejectedBy`, `rejectedAt`, `rejectionReason`
  - ✅ 로깅: `logger.info` for rejection
  - **검증**: ✅ Firebase Function 생성 완료

- [x] [TASK-704] [P] 승인/거부 알림 Trigger (US3) (`functions/src/triggers/onTournamentApprovalChange.ts` - NEW)
  - ✅ Firestore Trigger: `tournamentConfig.approvalStatus` 변경 감지
  - ✅ 작성자에게 승인/거부 알림 전송 (거부 사유 포함)
  - **검증**: ✅ Firestore Trigger 생성 완료

### UI 컴포넌트 (US3)

- [x] [TASK-705] 대회 공고 작성 UI 추가 (US3) (`app2/src/components/jobPosting/JobPostingForm.tsx`)
  - ✅ 대회 타입 선택 시 "admin 승인 필요" 안내 표시
  - ✅ tournamentConfig 생성 로직 (`approvalStatus='pending'`, `submittedAt`)
  - **검증**: ✅ JobPostingForm.tsx 수정 완료, 안내 메시지 추가

- [x] [TASK-706] 승인/거부 모달 컴포넌트 생성 (US3) (`app2/src/components/jobPosting/ApprovalModal.tsx` - NEW)
  - ✅ 공고 정보 표시
  - ✅ 승인 버튼 (녹색)
  - ✅ 거부 버튼 (빨간색) + 사유 입력 textarea (최소 10자)
  - ✅ admin 권한 체크
  - ✅ useJobPostingApproval Hook 사용
  - ✅ 다크모드 지원
  - **검증**: ✅ ApprovalModal 컴포넌트 생성 완료

- [x] [TASK-707] 승인 관리 페이지 생성 (US3) (`app2/src/pages/ApprovalManagementPage.tsx` - NEW)
  - ✅ 승인 대기 공고 리스트
  - ✅ ApprovalModal 컴포넌트 통합
  - ✅ admin 권한 체크 (페이지 접근)
  - ✅ 로딩/에러 상태 표시
  - ✅ 다크모드 지원
  - **검증**: ✅ ApprovalManagementPage 생성 완료

- [x] [TASK-708] [P] 대회 공고 상태 배지 컴포넌트 (US3) (`app2/src/components/jobPosting/TournamentStatusBadge.tsx` - NEW)
  - ✅ 승인 대기: 노란색 배지 "승인 대기 중"
  - ✅ 승인됨: 녹색 배지 "승인됨"
  - ✅ 거부됨: 빨간색 배지 "거부됨"
  - ✅ 다크모드 지원
  - **검증**: ✅ TournamentStatusBadge 컴포넌트 생성 완료

### 라우팅 (US3)

- [x] [TASK-709] Admin 승인 페이지 라우트 추가 (US3) (`app2/src/App.tsx`)
  - ✅ `/admin/job-posting-approvals` 라우트 추가
  - ✅ admin 권한 체크 (RoleBasedRoute)
  - **검증**: ✅ App.tsx에 라우트 추가 완료

### i18n (US3)

- [x] [TASK-710] [P] 대회 공고 i18n 추가 (`app2/public/locales/*/translation.json`)
  - ✅ `jobBoard.tournament.needApproval`: "admin 승인 필요"
  - ✅ `jobBoard.tournament.statusPending`: "승인 대기 중"
  - ✅ `jobBoard.tournament.statusApproved`: "승인됨"
  - ✅ `jobBoard.tournament.statusRejected`: "거부됨"
  - ✅ `jobBoard.tournament.approveButton`: "승인"
  - ✅ `jobBoard.tournament.rejectButton`: "거부"
  - ✅ `jobBoard.tournament.rejectReasonLabel`: "거부 사유 (최소 10자)"
  - ✅ `jobBoard.tournament.rejectReasonRequired`: "거부 사유는 최소 10자 이상이어야 합니다"
  - ✅ 한국어/영어 31개 번역 키 추가 완료
  - **검증**: ✅ tournament 섹션에 approval, status 등 모든 번역 추가

**Phase 7 완료 상황**: ✅ 100% 완료
- ✅ 완료: 10/10 tasks (100%)
  - TASK-701, 702, 703, 704, 705, 706, 707, 708, 709, 710
- 📊 품질 검증: TypeScript 에러 0개
- 🔧 Hook: useJobPostingApproval (approve/reject 함수)
- ⚙️ Backend: Firebase Functions 3개 (approve, reject, trigger)
- 🎨 UI: ApprovalModal, ApprovalManagementPage, TournamentStatusBadge, Form 안내 메시지
- 🛣️ Routing: /admin/job-posting-approvals (admin 전용)
- 🌐 i18n: 한국어/영어 31개 번역 키 추가

**Phase 7 완료 조건**: ✅ PASS
- ✅ User Story 3 대회 공고 승인 시스템 완성
- ✅ Firebase Functions 3개 생성 (approveJobPosting, rejectJobPosting, onTournamentApprovalChange)
- ✅ Admin 페이지 및 모달 컴포넌트 완성
- ✅ i18n 번역 추가 완료
- ✅ TypeScript strict mode 에러 0개

---

## Phase 8: Firestore & Security (모든 User Story) ✅ COMPLETED (2/3 완료, 1 보류)

**목적**: Firestore 인덱스, Security Rules, 쿼리 최적화

### Firestore 인덱스

- [x] [TASK-801] Firestore 인덱스 추가 (US1, US5) (`firestore.indexes.json`)
  - ✅ Index 1: `postingType (ASC) + status (ASC) + createdAt (DESC)`
  - ✅ Index 2: `postingType (ASC) + createdBy (ASC) + createdAt (DESC)`
  - ✅ Index 3: `postingType (ASC) + tournamentConfig.approvalStatus (ASC) + createdAt (DESC)`
  - **검증**: ✅ firestore.indexes.json 업데이트 완료

### Security Rules

- [x] [TASK-802] Firestore Security Rules 업데이트 (`firestore.rules`)
  - ✅ `postingType` 필드 필수 검증 (create 시)
  - ✅ 타입별 config 검증 함수 추가
    - ✅ `validateFixedConfig(config)`: durationDays, chipCost 매핑 검증 (7→3칩, 30→5칩, 90→10칩)
    - ✅ `validateTournamentConfig(config)`: approvalStatus, submittedAt 필수 체크, rejectionReason 최소 10자
    - ✅ `validateUrgentConfig(config)`: chipCost=5, priority='high' 검증
  - ✅ admin만 승인 권한 (update 규칙에서 tournamentConfig.approvalStatus 변경 차단)
  - ✅ 작성자는 본인 공고 수정 가능, 단 승인 상태는 변경 불가
  - **검증**: ✅ firestore.rules 업데이트 완료

- [ ] [TASK-803] Security Rules 배포 (`firestore.rules`) - ⏸️ **배포 보류** (Phase 10에서 일괄 배포)
  - `firebase deploy --only firestore:rules,firestore:indexes`
  - **검증**: Production 환경에서 권한 체크 동작 확인

**Phase 8 완료 상황**: ✅ 준비 완료 (배포 보류)
- ✅ 완료: 2/3 tasks (67%)
  - TASK-801, 802
- ⏸️ 보류: TASK-803 (Phase 10 배포 단계에서 일괄 처리)
- 📊 품질 검증: Firestore 인덱스 3개, Security Rules 검증 함수 3개 추가
- 🔒 보안: postingType 필수, config 타입 검증, admin 승인 권한 분리

**Phase 8 완료 조건**: ✅ PASS
- ✅ Firestore 인덱스 3개 정의 완료
- ✅ Security Rules 검증 함수 추가 완료
- ✅ 권한 체크 로직 구현 완료 (배포는 Phase 10)

---

## Phase 9: Testing & Quality Assurance (모든 User Story)

**목적**: 전체 기능 테스트 및 품질 검증

### Unit Tests

- [ ] [TASK-901] [P] normalizePostingType 테스트 (`app2/tests/unit/normalizePostingType.test.ts`)
  - 5개 시나리오 (새 필드, type 변환, recruitmentType 변환, 필드 없음, 잘못된 값)
  - **목표**: 100% 커버리지

- [ ] [TASK-902] [P] chipCalculator 테스트 (`app2/tests/unit/chipCalculator.test.ts`)
  - 6개 시나리오 (fixed 7/30/90일, urgent, 잘못된 값)
  - **목표**: 100% 커버리지

- [ ] [TASK-903] [P] dateFilter 테스트 (`app2/tests/unit/dateFilter.test.ts`)
  - 7개 시나리오 (날짜 범위 생성, 날짜 필터링, null 처리, 빈 배열)
  - **목표**: 100% 커버리지

- [ ] [TASK-904] [P] 컴포넌트 Unit Tests (`app2/tests/unit/components/`)
  - JobPostingCard.test.tsx
  - DateSlider.test.tsx
  - FixedPostingBadge.test.tsx
  - UrgentBadge.test.tsx
  - TournamentStatusBadge.test.tsx
  - ApprovalModal.test.tsx
  - **목표**: 80%+ 커버리지

### Integration Tests

- [ ] [TASK-905] [P] Firestore 타입별 쿼리 테스트 (`app2/tests/integration/jobPostingQueries.test.ts`)
  - 4가지 타입별 쿼리 동작 확인
  - normalizePostingType 자동 적용 확인
  - **목표**: 100% 시나리오 커버

- [ ] [TASK-906] [P] 승인 워크플로우 테스트 (`app2/tests/integration/approvalWorkflow.test.ts`)
  - 승인/거부 프로세스 전체 테스트
  - admin 권한 체크
  - **목표**: 100% 시나리오 커버

- [ ] [TASK-907] [P] 레거시 데이터 변환 테스트 (`app2/tests/integration/legacyDataConversion.test.ts`)
  - 4개 시나리오 (type/recruitmentType 변환, 필드 없음, 수정)
  - **목표**: 100% 시나리오 커버

### E2E Tests

- [ ] [TASK-908] 공고 작성/조회 E2E 테스트 (`app2/tests/e2e/jobPosting.spec.ts`)
  - 지원 공고 작성 (US1)
  - 고정 공고 작성 (US2)
  - 대회 공고 작성 (US3)
  - 긴급 공고 작성 (US4)
  - **목표**: 6개 User Story 주요 시나리오 커버

- [ ] [TASK-909] 게시판 탭 전환 E2E 테스트 (`app2/tests/e2e/boardTabs.spec.ts`)
  - 5개 탭 전환 동작 (US5)
  - 타입별 필터링 확인
  - **목표**: 5개 탭 모두 테스트

- [ ] [TASK-910] 날짜 슬라이더 E2E 테스트 (`app2/tests/e2e/dateSlider.spec.ts`)
  - 날짜 선택 및 필터링 (US1)
  - 오늘 강조 확인
  - **목표**: 날짜 필터링 시나리오 커버

- [ ] [TASK-911] 승인 프로세스 E2E 테스트 (`app2/tests/e2e/approval.spec.ts`)
  - admin 승인/거부 전체 프로세스 (US3)
  - 권한 체크
  - **목표**: 승인 시스템 전체 시나리오 커버

### 품질 게이트 검증

- [ ] [TASK-912] TypeScript strict mode 에러 0개 확인
  - `npm run type-check`
  - **목표**: 에러 0개

- [ ] [TASK-913] ESLint 에러 0개 확인
  - `npm run lint`
  - **목표**: 에러 0개

- [ ] [TASK-914] 테스트 커버리지 확인
  - `npm run test:coverage`
  - **목표**: Unit 80%+, Integration 70%+

- [ ] [TASK-915] 빌드 성공 및 번들 크기 확인
  - `npm run build`
  - **목표**: 번들 크기 ≤ 350KB

- [ ] [TASK-916] 다크모드 완전성 검증
  - 모든 UI 요소에 `dark:` 클래스 적용 확인
  - **목표**: 누락 0개

**Phase 9 완료 조건**:
- 모든 Unit/Integration/E2E Test 통과
- 테스트 커버리지 목표 달성
- 5개 품질 게이트 모두 통과

---

## Phase 10: Documentation & Deployment (최종 단계)

**목적**: 문서 업데이트 및 배포

### 문서 업데이트

- [ ] [TASK-1001] [P] README 업데이트 (`README.md`)
  - 4가지 공고 타입 설명 추가
  - 사용법 예시 추가
  - 스크린샷 업데이트 (선택적)
  - **검증**: 문서 정확성 확인

- [ ] [TASK-1002] [P] CHANGELOG 업데이트 (`CHANGELOG.md`)
  - 버전 업데이트 (v0.3.0)
  - 변경사항 요약 (4가지 타입, 5개 탭, 날짜 슬라이더, 승인 시스템)
  - Breaking Changes 없음 (레거시 호환성)
  - **검증**: 버전 형식 확인

- [ ] [TASK-1003] [P] API 문서 업데이트 (`docs/reference/API_REFERENCE.md`)
  - useJobPostings Hook 파라미터 업데이트
  - useJobPostingApproval Hook 추가
  - Firebase Functions API 추가 (approve, reject, expire)
  - **검증**: API 스펙 정확성 확인

### 배포

- [ ] [TASK-1004] Firebase Functions 배포 (`functions/`)
  - `npm run deploy`
  - Functions: approveJobPosting, rejectJobPosting, expireFixedPostings
  - **검증**: Functions 정상 작동 확인 (로그 모니터링)

- [ ] [TASK-1005] Firebase Hosting 배포 (`app2/`)
  - `npm run build`
  - `firebase deploy --only hosting`
  - **검증**: Production URL 접속 확인

- [ ] [TASK-1006] Security Rules 배포 (`firestore.rules`)
  - `firebase deploy --only firestore:rules`
  - **검증**: Rules 정상 작동 확인

- [ ] [TASK-1007] Capacitor 동기화 (모바일 앱) (`app2/`)
  - `npx cap sync`
  - iOS/Android 빌드 확인
  - **검증**: 모바일 앱 정상 작동 확인

### 최종 검증

- [ ] [TASK-1008] Production 환경 최종 검증
  - 6개 User Story Acceptance Scenario 재테스트
  - 다크모드 동작 확인
  - 레거시 데이터 정상 작동 확인
  - 칩 시스템 UI 표시 확인 (실제 차감은 미구현)
  - **검증**: 모든 기능 정상 작동

**Phase 10 완료 조건**:
- 모든 문서 업데이트 완료
- Production 배포 완료
- 최종 검증 통과

---

## Phase 11: Polish & Performance (선택적 개선)

**목적**: 성능 최적화 및 사용자 경험 개선

### 성능 최적화

- [ ] [TASK-1101] [P] Zustand store 캐싱 전략 구현 (`app2/src/stores/jobPostingStore.ts`)
  - 타입별 공고 캐싱 (5분 TTL)
  - 캐시 무효화 로직
  - **검증**: Firestore 조회 50% 감소 확인

- [ ] [TASK-1102] [P] React.memo 적용 (`app2/src/components/jobPosting/`)
  - JobPostingCard 메모이제이션
  - DateSlider 메모이제이션
  - **검증**: 리렌더링 횟수 감소 확인

- [ ] [TASK-1103] [P] 가상화 적용 (대용량 리스트) (`app2/src/pages/JobBoard/components/JobList.tsx`)
  - react-window FixedSizeList 적용
  - **검증**: 100개+ 공고 성능 개선 확인

### UX 개선

- [ ] [TASK-1104] [P] 로딩 스켈레톤 추가 (`app2/src/components/common/JobPostingSkeleton.tsx` - NEW)
  - 공고 카드 스켈레톤
  - 날짜 슬라이더 스켈레톤
  - **검증**: 로딩 상태 UX 개선 확인

- [ ] [TASK-1105] [P] 에러 바운더리 추가 (`app2/src/components/common/JobPostingErrorBoundary.tsx` - NEW)
  - 게시판 에러 처리
  - 재시도 버튼
  - **검증**: 에러 발생 시 UX 개선 확인

- [ ] [TASK-1106] [P] 애니메이션 개선 (`app2/src/components/jobPosting/`)
  - 탭 전환 fade-in 애니메이션
  - 공고 카드 hover 효과
  - **검증**: 애니메이션 부드러움 확인

**Phase 11 완료 조건** (선택적):
- 성능 목표 달성 (초기 로드 < 3초, Firestore 조회 50% 감소)
- UX 개선 항목 적용 완료

---

## Summary

### 작업 단계 개요
1. **Phase 0**: Setup ✅ (COMPLETED)
2. **Phase 1**: Foundational Types (9 tasks) - P1
3. **Phase 2**: Core Logic (5 tasks) - P1
4. **Phase 3**: User Story 1 & 5 (9 tasks) - P1
5. **Phase 4**: User Story 6 (3 tasks) - P1
6. **Phase 5**: User Story 2 (5 tasks) - P2
7. **Phase 6**: User Story 4 (4 tasks) - P2
8. **Phase 7**: User Story 3 (10 tasks) - P3
9. **Phase 8**: Firestore & Security (3 tasks) - All
10. **Phase 9**: Testing & QA (16 tasks) - All
11. **Phase 10**: Documentation & Deployment (8 tasks) - Final
12. **Phase 11**: Polish (6 tasks) - Optional

### User Story 우선순위별 작업
- **P1 (Critical)**: US1, US5, US6 - 26 tasks (Phase 1-4)
- **P2 (High)**: US2, US4 - 9 tasks (Phase 5-6)
- **P3 (Medium)**: US3 - 10 tasks (Phase 7)
- **All**: Firestore, Security, Testing - 27 tasks (Phase 8-10)
- **Optional**: Performance, UX - 6 tasks (Phase 11)

### 총 작업 수
- **Total**: 78 tasks (Phase 11 제외 시 72 tasks)
- **Parallelizable**: 28 tasks (P 마크)

### 병렬 실행 예시 (Phase별)
- **Phase 1**: TASK-101~106 병렬 실행 (타입 정의 6개)
- **Phase 2**: TASK-202~205 병렬 실행 (유틸리티 함수 4개)
- **Phase 3**: TASK-308~309 병렬 실행 (i18n 2개)
- **Phase 9**: TASK-901~907 병렬 실행 (Unit/Integration Tests 7개)

### 예상 소요 시간
- **P1 (Critical)**: 2-3일
- **P2 (High)**: 1-2일
- **P3 (Medium)**: 1-2일
- **Testing & Deployment**: 1일
- **Total**: 5-8일 (Full-time 작업 기준)

---

## Dependencies

### User Story 의존성
```
US6 (레거시 호환성) ← 모든 User Story가 의존
US1 (지원 공고) → US5 (탭 시스템)
US2 (고정 공고) → 독립적
US3 (대회 공고) → 독립적 (가장 복잡)
US4 (긴급 공고) → 독립적
```

### Phase 의존성
```
Phase 0 (Setup) → Phase 1 (Types) → Phase 2 (Logic) → Phase 3-7 (User Stories)
Phase 8 (Firestore) ← Phase 1-7 완료 필요
Phase 9 (Testing) ← Phase 1-8 완료 필요
Phase 10 (Deployment) ← Phase 9 완료 필요
Phase 11 (Polish) ← Phase 10 완료 필요 (선택적)
```

### Task 의존성 예시
- TASK-301 (useJobPostings 확장) ← TASK-201 (normalizePostingType)
- TASK-303 (DateSlider) ← TASK-204, 205 (dateFilter 함수)
- TASK-701 (useJobPostingApproval) ← TASK-702, 703 (Firebase Functions)
- TASK-801 (Firestore 인덱스) ← Phase 1-7 완료

---

## Next Steps

1. `/speckit.tasks` 명령 완료 확인 (tasks.md 생성됨)
2. Phase 1부터 시작: TASK-101~109 (Foundational Types)
3. TDD Red-Green-Refactor 적용
4. 각 Phase 완료 시 Constitution Check 재검증
5. P1 우선순위 완료 후 PR 생성 고려 (점진적 배포)

**Happy Coding! 🚀**
