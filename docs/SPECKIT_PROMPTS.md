# 📋 T-HOLDEM 프로젝트 개선 SpecKit 프롬프트 모음

**작성일**: 2025-01-05
**대상 프로젝트**: T-HOLDEM (UNIQN)
**목적**: 6개월 개선 로드맵 실행을 위한 SpecKit 워크플로우 프롬프트

---

## 📚 목차

- [Phase 1: Quick Wins (1개월)](#phase-1-quick-wins-1개월) 
  - [Phase 1-1: useJobPostingForm.ts any 타입 제거] 완료(#phase-1-1-usejobpostingformts-any-타입-제거)
  - [Phase 1-2: MultiSelectControls.tsx any 타입 제거] 완료 (#phase-1-2-multiselectcontrolstsx-any-타입-제거)
  - [Phase 1-3: ScheduleDetailModal.tsx 대형 파일 분리](#phase-1-3-scheduledetailmodaltsx-대형-파일-분리)
  - [Phase 1-4: JobPostingForm.tsx 대형 파일 분리](#phase-1-4-jobpostingformtsx-대형-파일-분리)
- [Phase 2: 테스트 강화 (2개월)](#phase-2-테스트-강화-2개월)
  - [Phase 2-1: AuthContext 테스트 작성](#phase-2-1-authcontext-테스트-작성)
  - [Phase 2-2: UnifiedDataContext 테스트 작성](#phase-2-2-unifieddatacontext-테스트-작성)
  - [Phase 2-3: 핵심 Hooks 테스트 작성](#phase-2-3-핵심-hooks-테스트-작성)
  - [Phase 2-4: Critical UI 컴포넌트 테스트](#phase-2-4-critical-ui-컴포넌트-테스트)
- [Phase 3: 아키텍처 개선 (3개월)](#phase-3-아키텍처-개선-3개월)
  - [Phase 3-1: UnifiedDataContext → Zustand 마이그레이션](#phase-3-1-unifieddatacontext--zustand-마이그레이션)
  - [Phase 3-2: 공통 Hook 라이브러리 구축](#phase-3-2-공통-hook-라이브러리-구축)
  - [Phase 3-3: DateFilterContext → Zustand 마이그레이션](#phase-3-3-datefiltercontext--zustand-마이그레이션)
  - [Phase 3-4: 중복 코드 제거](#phase-3-4-중복-코드-제거)
- [전체 타임라인](#전체-타임라인)

---

## 🎯 Phase 1: Quick Wins (1개월)

### Phase 1-1: useJobPostingForm.ts any 타입 제거

```bash
/speckit.specify "Phase 1-1: useJobPostingForm.ts any 타입 완전 제거 및 타입 안전성 확보

**현재 상황**:
- 파일 경로: app2/src/hooks/useJobPostingForm.ts
- 발견된 문제: any 타입 28회 사용
- 주요 패턴: setFormData((prev: any) => ...) 반복
- 영향 범위: JobPostingForm.tsx (993줄), JobPostingCard.tsx (854줄)
- 심각도: HIGH - 폼 데이터 무결성에 직접 영향

**개선 목표**:
1. any 타입 완전 제거 (28회 → 0회)
2. JobPostingFormData 인터페이스 완전 정의
3. 중첩 객체 타입 정의:
   - DateRequirement (날짜별 인원 요구사항)
   - PreQuestion (사전 질문)
   - SalaryInfo (급여 정보)
4. 타입 안전성 100% 보장
5. 폼 검증 로직 타입 가드 추가

**기술 요구사항**:
- TypeScript Strict Mode 100% 준수
- 모든 useState에 명시적 타입 지정
- useCallback 의존성 배열 정확히 명시
- 타입 가드 함수 추가 (런타임 검증)
- Zod 스키마 추가 고려 (선택)

**제약사항**:
- 기존 컴포넌트 API 변경 금지
- JobPostingForm.tsx 수정 최소화
- 다른 Hook과의 인터페이스 유지
- 성능 저하 없어야 함 (메모이제이션 유지)
- logger 사용 규칙 준수

**기존 코드 참고**:
- 표준 필드명: staffId, eventId 사용
- Firebase 필드명과 일치시킬 것
- 다크모드 관련 코드는 건드리지 않음

**성공 기준**:
- npm run type-check 에러 0개
- any 타입 사용 0회 확인
- 기존 폼 저장/로드 기능 100% 동작
- 폼 검증 로직 정상 작동
- 코드 리뷰 승인
- ESLint 경고 0개

**우선순위**: HIGH
**예상 작업 시간**: 8시간 (1일)
**담당자**: Claude AI
**검증 방법**:
- npm run type-check
- npm run lint
- 수동 폼 테스트 (생성/수정/조회)
- 기존 구인공고 데이터 호환성 확인"
```

---

### Phase 1-2: MultiSelectControls.tsx any 타입 제거

```bash
/speckit.specify "Phase 1-2: MultiSelectControls.tsx any 타입 제거 및 타입 안전성 강화

**현재 상황**:
- 파일 경로: app2/src/components/applicants/ApplicantListTab/MultiSelectControls.tsx
- 발견된 문제: any 타입 13회 사용
- 주요 문제:
  - 선택된 항목 타입이 any
  - 이벤트 핸들러 파라미터 any
  - 상태 업데이트 로직 타입 불안정
- 영향 범위: 지원자 관리 전체 워크플로우
- 심각도: HIGH - 다중 선택 작업의 핵심 컴포넌트

**개선 목표**:
1. any 타입 완전 제거 (13회 → 0회)
2. 선택된 항목 타입 명확히 정의
3. Generic 타입 활용하여 재사용성 확보
4. 이벤트 핸들러 타입 안전성 보장
5. Props 인터페이스 명확화

**기술 요구사항**:
- Generic 컴포넌트로 리팩토링:
  ```typescript
  interface MultiSelectControlsProps<T> {
    selectedItems: T[];
    onActionComplete: (action: string, items: T[]) => void;
    // ...
  }
  ```
- React 이벤트 타입 명시
- 상태 업데이트 로직 타입 가드 추가
- TypeScript Strict Mode 준수

**제약사항**:
- 기존 사용처 API 변경 최소화
- ApplicantListTab 컴포넌트와 호환성 유지
- 다크모드 스타일 유지
- 성능 저하 없어야 함

**성공 기준**:
- npm run type-check 에러 0개
- any 타입 사용 0회
- 다중 선택/해제 기능 정상 작동
- 일괄 작업(승인/거부/삭제) 정상 작동
- 기존 사용처 모두 호환
- ESLint 경고 0개

**우선순위**: HIGH
**예상 작업 시간**: 4시간
**담당자**: Claude AI
**의존성**: Phase 1-1 완료 후 진행
**검증 방법**:
- npm run type-check
- 지원자 다중 선택 테스트
- 일괄 작업 기능 테스트"
```

---

### Phase 1-3: ScheduleDetailModal.tsx 대형 파일 분리

```bash
/speckit.specify "Phase 1-3: ScheduleDetailModal.tsx 대형 파일 분리 (1,123줄 → 5개 파일)

**현재 상황**:
- 파일 경로: app2/src/pages/MySchedulePage/components/ScheduleDetailModal.tsx
- 현재 라인 수: 1,123줄 (프로젝트 최대)
- 주요 문제:
  - 단일 파일에 6가지 책임 혼재
  - 테스트 불가능한 구조
  - 유지보수 어려움
  - 코드 리뷰 시 부담
- 복잡도: 매우 높음
- 심각도: HIGH - 단일 책임 원칙 심각한 위반

**현재 책임 분석**:
1. Modal 컨테이너 및 레이아웃 (~150줄)
2. 기본 정보 탭 (일정/장소/시간) (~250줄)
3. 근무 정보 탭 (배정/출석) (~300줄)
4. 급여 계산 탭 (시급/수당/정산) (~250줄)
5. 상태 관리 및 API 호출 (~150줄)
6. 유효성 검증 및 에러 처리 (~23줄)

**개선 목표**:
1. 5개 파일로 분리:
   - ScheduleDetailModal.tsx (200줄) - 메인 컨테이너
   - tabs/BasicInfoTab.tsx (150줄) - 기본 정보
   - tabs/WorkInfoTab.tsx (200줄) - 근무 정보
   - tabs/CalculationTab.tsx (250줄) - 급여 계산
   - hooks/useScheduleData.ts (323줄) - 이미 분리됨 ✅
2. 각 탭 독립적으로 테스트 가능하게
3. Props 인터페이스 명확히 정의
4. 공통 로직은 Hook으로 추출
5. 타입 안전성 유지

**기술 요구사항**:
- 각 파일 500줄 이하로 제한
- Props Drilling 최소화 (Context 또는 Compound Component 패턴)
- 각 탭 컴포넌트 독립적 테스트 가능
- 기존 useScheduleData Hook 활용
- 메모이제이션 유지 (성능 저하 방지)
- 다크모드 스타일 모두 유지

**제약사항**:
- 기존 기능 100% 유지
- API 호출 로직 변경 금지
- 사용자 경험 동일하게 유지
- 성능 저하 없어야 함
- MySchedulePage에서 호출 방식 동일

**파일 구조**:
```
pages/MySchedulePage/components/
├── ScheduleDetailModal/
│   ├── index.tsx (200줄) - 메인 컨테이너
│   ├── tabs/
│   │   ├── BasicInfoTab.tsx (150줄)
│   │   ├── WorkInfoTab.tsx (200줄)
│   │   └── CalculationTab.tsx (250줄)
│   ├── types.ts (50줄) - 공통 타입
│   └── hooks/
│       └── useScheduleData.ts (323줄) - 기존 ✅
```

**성공 기준**:
- 각 파일 500줄 이하
- npm run type-check 에러 0개
- 기존 기능 100% 동작 (저장/조회/수정/삭제)
- 탭 전환 정상 작동
- 급여 계산 정확성 유지
- ESLint 경고 0개
- 단위 테스트 작성 가능한 구조

**우선순위**: HIGH
**예상 작업 시간**: 12시간 (1.5일)
**담당자**: Claude AI
**의존성**: Phase 1-1, 1-2 완료 후 진행
**검증 방법**:
- npm run type-check
- 각 탭 기능 수동 테스트
- 급여 계산 검증
- 저장/조회 기능 테스트"
```

---

### Phase 1-4: JobPostingForm.tsx 대형 파일 분리

```bash
/speckit.specify "Phase 1-4: JobPostingForm.tsx 대형 파일 분리 (993줄 → 5개 파일)

**현재 상황**:
- 파일 경로: app2/src/components/jobPosting/JobPostingForm.tsx
- 현재 라인 수: 993줄
- 주요 문제:
  - 복잡한 폼 로직이 한 파일에 집중
  - 섹션별 책임 분리 부족
  - 재사용 어려움
  - 테스트 어려움
- 복잡도: 높음
- 심각도: MEDIUM - 기능은 동작하나 유지보수 어려움

**현재 책임 분석**:
1. 메인 폼 컨테이너 및 레이아웃 (~150줄)
2. 기본 정보 섹션 (제목/장소/설명) (~150줄)
3. 날짜별 인원 요구사항 섹션 (~250줄)
4. 사전 질문 섹션 (~200줄)
5. 급여 정보 섹션 (~93줄)
6. 폼 검증 및 제출 로직 (~150줄)

**개선 목표**:
1. 5개 파일로 분리:
   - JobPostingForm.tsx (300줄) - 메인 컨테이너
   - sections/BasicInfoSection.tsx (150줄)
   - sections/DateRequirementsSection.tsx (250줄)
   - sections/PreQuestionsSection.tsx (200줄)
   - sections/SalarySection.tsx (93줄) - 이미 분리? 확인 필요
2. 각 섹션 독립적으로 개발/테스트 가능
3. useJobPostingForm Hook 활용 (Phase 1-1에서 개선됨)
4. Props 인터페이스 명확화

**기술 요구사항**:
- 각 섹션 컴포넌트 독립성 확보
- Controlled Components 패턴 유지
- useJobPostingForm의 타입 안전한 인터페이스 활용
- 폼 검증 로직은 Hook으로 통합
- 다크모드 스타일 모두 유지
- 메모이제이션 유지

**제약사항**:
- 기존 폼 동작 100% 유지
- API 호출 방식 변경 금지
- 구인공고 생성/수정 워크플로우 동일
- 사용자 경험 동일
- 성능 저하 없어야 함

**파일 구조**:
```
components/jobPosting/
├── JobPostingForm/
│   ├── index.tsx (300줄) - 메인 컨테이너
│   ├── sections/
│   │   ├── BasicInfoSection.tsx (150줄)
│   │   ├── DateRequirementsSection.tsx (250줄)
│   │   ├── PreQuestionsSection.tsx (200줄)
│   │   └── SalarySection.tsx (93줄)
│   └── types.ts (50줄) - 공통 타입
```

**성공 기준**:
- 각 파일 300줄 이하
- npm run type-check 에러 0개
- 구인공고 생성 기능 정상 작동
- 구인공고 수정 기능 정상 작동
- 폼 검증 정상 작동
- 저장/불러오기 기능 정상
- ESLint 경고 0개

**우선순위**: MEDIUM
**예상 작업 시간**: 10시간 (1.5일)
**담당자**: Claude AI
**의존성**: Phase 1-1 (useJobPostingForm.ts) 완료 필수
**검증 방법**:
- npm run type-check
- 구인공고 생성 테스트
- 구인공고 수정 테스트
- 각 섹션 폼 검증 테스트"
```

---

## 🧪 Phase 2: 테스트 강화 (2개월)

### Phase 2-1: AuthContext 테스트 작성

```bash
/speckit.specify "Phase 2-1: AuthContext 단위 테스트 및 통합 테스트 작성

**현재 상황**:
- 파일 경로: app2/src/contexts/AuthContext.tsx
- 현재 라인 수: 약 250줄
- 테스트 현황: 0% (테스트 파일 없음)
- 주요 기능:
  - 사용자 인증 (로그인/로그아웃)
  - 역할 관리 (admin/staff)
  - 세션 관리
  - Firebase Auth 연동
- 심각도: HIGH - 보안 및 권한의 핵심 컴포넌트

**개선 목표**:
1. 단위 테스트 작성 (80% 커버리지)
2. 통합 테스트 작성 (주요 시나리오)
3. Mock 전략 수립 (Firebase Auth)
4. 에러 케이스 테스트
5. 로그인/로그아웃 플로우 테스트

**테스트 범위**:
1. **단위 테스트**:
   - useAuth Hook 테스트
   - 역할 검증 로직 테스트
   - 세션 상태 관리 테스트
   - 에러 핸들링 테스트

2. **통합 테스트**:
   - 로그인 → 역할 확인 → 페이지 접근
   - 로그아웃 → 세션 정리 → 리다이렉트
   - 권한 없는 페이지 접근 시도
   - 토큰 만료 시나리오

3. **엣지 케이스**:
   - 네트워크 에러
   - Firebase Auth 에러
   - 중복 로그인 시도
   - 세션 만료

**기술 요구사항**:
- React Testing Library 사용
- @testing-library/react-hooks 활용
- Firebase Auth Mock 전략:
  - firebase-mock 또는 수동 Mock
  - Jest manual mocks
- MSW (Mock Service Worker) 고려
- 테스트 격리 (각 테스트 독립적)
- cleanup 철저히

**제약사항**:
- 기존 코드 수정 최소화
- 테스트를 위한 코드 변경은 허용
- 프로덕션 코드 영향 없어야 함
- 테스트 실행 시간 5초 이내

**파일 구조**:
```
contexts/
├── AuthContext.tsx
└── __tests__/
    ├── AuthContext.test.tsx (단위 테스트)
    ├── AuthContext.integration.test.tsx (통합)
    └── __mocks__/
        └── firebase.ts (Firebase Mock)
```

**성공 기준**:
- 테스트 커버리지 80% 이상
- 모든 테스트 통과
- 테스트 실행 시간 5초 이내
- CI/CD 통합 가능
- 에러 케이스 10개 이상 커버
- npm run test 통과

**우선순위**: HIGH
**예상 작업 시간**: 16시간 (2일)
**담당자**: Claude AI
**의존성**: Phase 1 완료 후 진행
**검증 방법**:
- npm run test:coverage
- 커버리지 리포트 확인
- CI/CD 테스트 실행"
```

---

### Phase 2-2: UnifiedDataContext 테스트 작성

```bash
/speckit.specify "Phase 2-2: UnifiedDataContext 테스트 작성 (복잡한 상태 관리 테스트)

**현재 상황**:
- 파일 경로: app2/src/contexts/UnifiedDataContext.tsx
- 현재 라인 수: 782줄 (프로젝트 최대 Context)
- 테스트 현황: 0%
- 주요 기능:
  - 5개 Firebase 컬렉션 통합 관리
  - 실시간 구독 (onSnapshot)
  - 메모이제이션 기반 캐싱
  - 복잡한 데이터 변환 로직
- 복잡도: 매우 높음
- 심각도: HIGH - 데이터 관리의 핵심

**개선 목표**:
1. 단위 테스트 작성 (70% 커버리지 - 복잡도 고려)
2. 통합 테스트 (Firestore 연동)
3. 성능 테스트 (메모이제이션 효과)
4. 메모리 누수 테스트
5. 구독 관리 테스트 (cleanup)

**테스트 범위**:
1. **단위 테스트**:
   - Map 기반 상태 관리 테스트
   - 메모이제이션 캐싱 테스트
   - getStaffById 등 조회 함수 테스트
   - scheduleEvents 변환 로직 테스트
   - 에러 핸들링 테스트

2. **통합 테스트**:
   - Firestore onSnapshot 연동
   - 5개 컬렉션 동시 구독
   - 역할별 쿼리 필터링 (admin vs staff)
   - 실시간 업데이트 반영
   - cleanup (unsubscribe) 검증

3. **성능 테스트**:
   - 메모이제이션 효과 측정
   - 1000개 데이터 처리 시간
   - 렌더링 최적화 검증
   - 메모리 사용량 측정

4. **엣지 케이스**:
   - 빈 데이터 처리
   - 네트워크 에러
   - Firestore 권한 에러
   - 중복 구독 방지

**기술 요구사항**:
- React Testing Library + renderHook
- Firestore Emulator 사용 (통합 테스트)
- fake-indexeddb (로컬 테스트)
- Performance.now() 사용 (성능 측정)
- act() 올바르게 사용
- cleanup 철저히
- 테스트 격리

**제약사항**:
- 프로덕션 코드 수정 최소화
- 메모이제이션 로직 유지
- 성능 저하 없어야 함
- 테스트 실행 시간 10초 이내 (복잡도 고려)

**파일 구조**:
```
contexts/
├── UnifiedDataContext.tsx
└── __tests__/
    ├── UnifiedDataContext.test.tsx (단위)
    ├── UnifiedDataContext.integration.test.tsx (통합)
    ├── UnifiedDataContext.performance.test.tsx (성능)
    └── __fixtures__/
        ├── mockStaff.ts
        ├── mockWorkLogs.ts
        └── mockApplications.ts
```

**성공 기준**:
- 테스트 커버리지 70% 이상 (복잡도 고려)
- 모든 테스트 통과
- 성능 테스트: 메모이제이션 효과 80%+ 확인
- 메모리 누수 없음
- 구독 cleanup 100% 검증
- npm run test 통과

**우선순위**: HIGH
**예상 작업 시간**: 24시간 (3일)
**담당자**: Claude AI
**의존성**: Phase 2-1 완료 후 진행
**검증 방법**:
- npm run test:coverage
- 성능 벤치마크 확인
- 메모리 프로파일링"
```

---

### Phase 2-3: 핵심 Hooks 테스트 작성

```bash
/speckit.specify "Phase 2-3: 핵심 Hooks 단위 테스트 작성 (useNotifications, useScheduleData, useApplicantActions)

**현재 상황**:
- 대상 파일:
  1. app2/src/hooks/useNotifications.ts (알림 시스템)
  2. app2/src/pages/MySchedulePage/components/hooks/useScheduleData.ts (323줄)
  3. app2/src/components/applicants/.../useApplicantActions.ts (803줄)
- 테스트 현황: 0%
- 심각도: HIGH - 핵심 비즈니스 로직

**개선 목표**:
1. 3개 핵심 Hook 단위 테스트 작성
2. 테스트 커버리지 각 Hook당 70% 이상
3. 비즈니스 로직 검증
4. 에러 케이스 커버
5. 비동기 로직 테스트

**테스트 범위**:

### 1. useNotifications
- Firestore 실시간 구독 테스트
- 알림 필터링 (읽음/안읽음)
- 알림 마크 읽음 처리
- 알림 삭제
- 에러 핸들링

### 2. useScheduleData (323줄)
- 스케줄 데이터 로드
- 급여 계산 로직 검증
- 수당 계산 (야간/휴일/연장)
- 데이터 변환 로직
- 캐싱 동작 검증

### 3. useApplicantActions (803줄)
- 지원자 승인/거부
- 일괄 작업 (다중 선택)
- 상태 변경 로직
- Firebase 업데이트 검증
- 에러 복구

**기술 요구사항**:
- @testing-library/react-hooks 사용
- renderHook 패턴
- waitFor, act 올바르게 사용
- Firebase Mock (Firestore, Functions)
- 비동기 테스트 철저히
- 타임아웃 처리

**제약사항**:
- 프로덕션 코드 수정 최소화
- Hook 인터페이스 변경 금지
- 성능 저하 없어야 함
- 각 Hook 테스트 독립적

**파일 구조**:
```
hooks/
├── useNotifications.ts
└── __tests__/
    └── useNotifications.test.ts

pages/MySchedulePage/components/hooks/
├── useScheduleData.ts
└── __tests__/
    └── useScheduleData.test.ts

components/applicants/.../
├── useApplicantActions.ts
└── __tests__/
    └── useApplicantActions.test.ts
```

**성공 기준**:
- 각 Hook 테스트 커버리지 70% 이상
- 모든 비동기 로직 테스트
- 에러 케이스 각 Hook당 5개 이상
- 모든 테스트 통과
- 테스트 실행 시간 8초 이내
- npm run test 통과

**우선순위**: HIGH
**예상 작업 시간**: 20시간 (2.5일)
**담당자**: Claude AI
**의존성**: Phase 2-2 완료 후 진행
**검증 방법**:
- npm run test:coverage
- 각 Hook별 커버리지 확인"
```

---

### Phase 2-4: Critical UI 컴포넌트 테스트

```bash
/speckit.specify "Phase 2-4: Critical UI 컴포넌트 테스트 작성 (JobPostingCard, NotificationDropdown)

**현재 상황**:
- 대상 컴포넌트:
  1. app2/src/components/common/JobPostingCard.tsx (854줄)
  2. app2/src/components/notifications/NotificationDropdown.tsx
- 테스트 현황: 0%
- 심각도: MEDIUM - 사용자 인터페이스 핵심

**개선 목표**:
1. 2개 컴포넌트 테스트 작성
2. 사용자 인터랙션 테스트
3. 렌더링 테스트
4. 다크모드 테스트
5. 접근성 테스트

**테스트 범위**:

### 1. JobPostingCard (854줄)
- **렌더링 테스트**:
  - 구인공고 정보 표시
  - 날짜별 인원 표시
  - 급여 정보 표시
  - 상태 배지 (모집중/마감)

- **인터랙션 테스트**:
  - 카드 클릭 → 상세 페이지
  - 지원 버튼 클릭
  - 북마크 토글
  - 공유 버튼

- **상태별 렌더링**:
  - 모집중 상태
  - 마감 상태
  - 임박 상태

- **다크모드 테스트**:
  - dark: 클래스 적용 확인
  - 색상 대비 확인

### 2. NotificationDropdown
- **렌더링 테스트**:
  - 알림 목록 표시
  - 읽음/안읽음 표시
  - 빈 상태 (알림 없음)

- **인터랙션 테스트**:
  - 알림 클릭 → 상세 페이지
  - 읽음 처리
  - 전체 읽음 처리
  - 알림 삭제

- **실시간 업데이트**:
  - 새 알림 도착
  - 배지 카운트 업데이트

**기술 요구사항**:
- React Testing Library 사용
- screen, render, fireEvent
- userEvent (클릭, 키보드 이벤트)
- 접근성 쿼리 (getByRole, getByLabelText)
- 다크모드 테스트 (data-theme 또는 클래스)
- Mock Context (ThemeContext)

**제약사항**:
- 프로덕션 코드 수정 최소화
- 컴포넌트 API 변경 금지
- 다크모드 스타일 유지
- 성능 저하 없어야 함

**파일 구조**:
```
components/
├── common/
│   ├── JobPostingCard.tsx
│   └── __tests__/
│       ├── JobPostingCard.test.tsx
│       └── JobPostingCard.accessibility.test.tsx
└── notifications/
    ├── NotificationDropdown.tsx
    └── __tests__/
        └── NotificationDropdown.test.tsx
```

**성공 기준**:
- 각 컴포넌트 테스트 커버리지 60% 이상
- 모든 인터랙션 테스트
- 접근성 테스트 통과 (axe)
- 다크모드 렌더링 확인
- 모든 테스트 통과
- npm run test 통과

**우선순위**: MEDIUM
**예상 작업 시간**: 16시간 (2일)
**담당자**: Claude AI
**의존성**: Phase 2-3 완료 후 진행
**검증 방법**:
- npm run test:coverage
- 접근성 테스트 (axe-core)
- 시각적 확인 (Storybook 고려)"
```

---

## 🏗️ Phase 3: 아키텍처 개선 (3개월)

### Phase 3-1: UnifiedDataContext → Zustand 마이그레이션

```bash
/speckit.specify "Phase 3-1: UnifiedDataContext를 Zustand Store로 마이그레이션

**현재 상황**:
- 파일 경로: app2/src/contexts/UnifiedDataContext.tsx (782줄)
- 현재 구조: Context API + useReducer
- 주요 기능:
  - 5개 Firebase 컬렉션 관리 (staff, workLogs, applications, attendanceRecords, jobPostings)
  - 실시간 구독 (onSnapshot)
  - 메모이제이션 기반 캐싱
- 문제점:
  - Context 복잡도 높음
  - 리렌더링 최적화 어려움
  - 디버깅 어려움
- 심각도: MEDIUM - 장기적 유지보수성 확보

**개선 목표**:
1. Zustand Store로 완전 마이그레이션
2. 기존 Context API 제거
3. 타입 안전성 향상
4. 개발자 도구 지원 (Redux DevTools)
5. 코드 간결화 (782줄 → 500줄 목표)

**마이그레이션 전략**:
1. **점진적 마이그레이션**:
   - Phase A: Zustand Store 생성 (Context와 병행)
   - Phase B: 사용처 하나씩 마이그레이션
   - Phase C: Context 제거

2. **Store 구조**:
```typescript
// stores/unifiedDataStore.ts
interface UnifiedDataStore {
  // State
  staff: Map<string, Staff>;
  workLogs: Map<string, WorkLog>;
  applications: Map<string, Application>;
  attendanceRecords: Map<string, AttendanceRecord>;
  jobPostings: Map<string, JobPosting>;

  // Computed (selectors)
  scheduleEvents: ScheduleEvent[];
  getStaffById: (id: string) => Staff | undefined;

  // Actions
  subscribeAll: (userId: string, role: string) => void;
  unsubscribeAll: () => void;
  updateStaff: (staff: Staff) => void;
  // ...
}
```

3. **호환성 레이어**:
```typescript
// hooks/useUnifiedData.ts (기존 인터페이스 유지)
export function useUnifiedData() {
  const store = useUnifiedDataStore();
  return {
    staff: store.staff,
    workLogs: store.workLogs,
    // ... 기존과 동일한 인터페이스
  };
}
```

**기술 요구사항**:
- Zustand 5.0 사용 (이미 설치됨 ✅)
- TypeScript 타입 정의 완벽히
- immer 미들웨어 활용 (불변성)
- persist 미들웨어 고려 (선택)
- devtools 미들웨어 (개발 환경)
- 메모이제이션 유지 (성능)

**제약사항**:
- 기존 사용처 API 100% 호환
- 단계적 마이그레이션 (한 번에 전체 변경 금지)
- 성능 저하 없어야 함
- 실시간 구독 기능 유지
- cleanup 로직 유지

**마이그레이션 단계**:
```
Step 1: Store 생성 (2일)
Step 2: 병행 운영 (Context + Zustand) (1주)
Step 3: 사용처 마이그레이션 (2주)
  - MySchedulePage
  - JobPostingPage
  - ApplicantListPage
  - ...
Step 4: Context 제거 (1일)
Step 5: 테스트 및 검증 (3일)
```

**파일 구조**:
```
stores/
├── unifiedDataStore.ts (500줄)
├── slices/
│   ├── staffSlice.ts
│   ├── workLogsSlice.ts
│   └── applicationsSlice.ts
└── __tests__/
    └── unifiedDataStore.test.ts

hooks/
└── useUnifiedData.ts (호환성 레이어)
```

**성공 기준**:
- Context 코드 완전 제거
- 모든 기능 정상 작동
- 성능 동일 또는 향상
- 테스트 커버리지 70% 이상
- Redux DevTools 연동
- npm run type-check 에러 0개
- 기존 테스트 모두 통과

**우선순위**: MEDIUM
**예상 작업 시간**: 80시간 (2주)
**담당자**: Claude AI
**의존성**: Phase 2 완료 후 진행
**검증 방법**:
- npm run type-check
- npm run test
- 전체 기능 수동 테스트
- 성능 벤치마크 비교"
```

---

### Phase 3-2: 공통 Hook 라이브러리 구축

```bash
/speckit.specify "Phase 3-2: 공통 Firestore Hook 라이브러리 구축 (중복 코드 제거)

**현재 상황**:
- 중복 패턴: Firebase 구독 패턴이 31개 파일에 반복
- 코드 예시:
```typescript
useEffect(() => {
  const unsubscribe = onSnapshot(query(...), (snapshot) => {
    setData(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  });
  return () => unsubscribe();
}, [deps]);
```
- 심각도: LOW - 기능 동작하나 유지보수성 저하

**개선 목표**:
1. 재사용 가능한 Firestore Hook 4개 생성
2. 중복 코드 제거 (31개 파일 → Hook 사용)
3. 타입 안전성 확보
4. 에러 핸들링 통합
5. 로딩 상태 관리 통합

**구현할 Hook**:

### 1. useFirestoreCollection<T>
```typescript
function useFirestoreCollection<T>(
  collectionPath: string,
  queryConstraints?: QueryConstraint[]
): {
  data: T[];
  loading: boolean;
  error: Error | null;
  refetch: () => void;
}
```

### 2. useFirestoreDocument<T>
```typescript
function useFirestoreDocument<T>(
  documentPath: string
): {
  data: T | null;
  loading: boolean;
  error: Error | null;
  update: (data: Partial<T>) => Promise<void>;
}
```

### 3. useFirestoreQuery<T>
```typescript
function useFirestoreQuery<T>(
  query: Query<DocumentData>
): {
  data: T[];
  loading: boolean;
  error: Error | null;
  refetch: () => void;
}
```

### 4. useFirestoreMutation<T>
```typescript
function useFirestoreMutation<T>(): {
  create: (collectionPath: string, data: T) => Promise<string>;
  update: (docPath: string, data: Partial<T>) => Promise<void>;
  delete: (docPath: string) => Promise<void>;
  loading: boolean;
  error: Error | null;
}
```

**기술 요구사항**:
- TypeScript Generic 활용
- 타입 안전성 100%
- cleanup 자동 처리
- 에러 핸들링 통합
- logger 사용 (console.log 금지)
- 메모이제이션 적용
- React Query 패턴 참고

**제약사항**:
- 기존 코드 점진적 마이그레이션
- 성능 저하 없어야 함
- Firebase SDK 버전 호환
- 실시간 구독 유지

**마이그레이션 전략**:
```
Step 1: Hook 라이브러리 생성 (1주)
Step 2: 테스트 작성 (3일)
Step 3: 점진적 마이그레이션 (2주)
  - 우선순위: 자주 사용되는 패턴부터
  - 파일 5개씩 마이그레이션
Step 4: 문서화 (1일)
```

**파일 구조**:
```
hooks/firestore/
├── index.ts (export all)
├── useFirestoreCollection.ts
├── useFirestoreDocument.ts
├── useFirestoreQuery.ts
├── useFirestoreMutation.ts
├── types.ts
└── __tests__/
    ├── useFirestoreCollection.test.ts
    ├── useFirestoreDocument.test.ts
    ├── useFirestoreQuery.test.ts
    └── useFirestoreMutation.test.ts
```

**사용 예시**:
```typescript
// Before (중복 코드)
const [staff, setStaff] = useState<Staff[]>([]);
useEffect(() => {
  const q = query(collection(db, 'staff'), where('active', '==', true));
  const unsubscribe = onSnapshot(q, (snapshot) => {
    setStaff(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Staff)));
  });
  return () => unsubscribe();
}, []);

// After (Hook 사용)
const { data: staff, loading, error } = useFirestoreCollection<Staff>(
  'staff',
  [where('active', '==', true)]
);
```

**성공 기준**:
- 4개 Hook 구현 완료
- 테스트 커버리지 80% 이상
- 최소 20개 파일 마이그레이션
- 코드 중복 50% 감소
- npm run type-check 에러 0개
- 기존 기능 100% 동작
- 문서화 완료 (JSDoc + README)

**우선순위**: LOW
**예상 작업 시간**: 60시간 (1.5주)
**담당자**: Claude AI
**의존성**: Phase 3-1 완료 후 진행
**검증 방법**:
- npm run test
- 마이그레이션된 기능 수동 테스트
- 성능 벤치마크"
```

---

### Phase 3-3: DateFilterContext → Zustand 마이그레이션

```bash
/speckit.specify "Phase 3-3: DateFilterContext를 Zustand Store로 마이그레이션

**현재 상황**:
- 파일 경로: app2/src/contexts/DateFilterContext.tsx
- 현재 라인 수: 약 100줄
- 주요 기능: 날짜 필터 상태 관리 (시작일/종료일)
- 사용처: MySchedulePage, WorkLogPage 등
- 심각도: LOW - 간단한 Context

**개선 목표**:
1. Zustand Store로 마이그레이션
2. localStorage 연동 (persist)
3. 타입 안전성 확보
4. 코드 간결화 (100줄 → 50줄)

**Store 구조**:
```typescript
interface DateFilterStore {
  startDate: Date | null;
  endDate: Date | null;
  setStartDate: (date: Date | null) => void;
  setEndDate: (date: Date | null) => void;
  setDateRange: (start: Date | null, end: Date | null) => void;
  reset: () => void;
}
```

**기술 요구사항**:
- Zustand persist 미들웨어 사용
- localStorage에 저장
- 날짜 직렬화/역직렬화 처리
- TypeScript 타입 안전

**제약사항**:
- 기존 사용처 API 호환
- 성능 저하 없어야 함
- 사용자 경험 동일

**파일 구조**:
```
stores/
└── dateFilterStore.ts (50줄)

hooks/
└── useDateFilter.ts (호환성 레이어)
```

**성공 기준**:
- Context 제거 완료
- localStorage 연동 확인
- 모든 사용처 정상 작동
- npm run type-check 에러 0개

**우선순위**: LOW
**예상 작업 시간**: 8시간 (1일)
**담당자**: Claude AI
**의존성**: Phase 3-1 완료 후 진행
**검증 방법**:
- 날짜 필터 기능 테스트
- localStorage 저장 확인"
```

---

### Phase 3-4: 중복 코드 제거

```bash
/speckit.specify "Phase 3-4: 중복 코드 패턴 제거 및 공통 유틸리티 생성

**현재 상황**:
- 중복 패턴 발견:
  1. 날짜 포맷팅: \`date.toISOString().split('T')[0]\` (15개 파일)
  2. 이메일 검증: \`/^\S+@\S+\.\S+$/.test(email)\` (8개 파일)
  3. Firebase 에러 처리: 동일 패턴 20개 파일
  4. 폼 핸들러: setFormData((prev) => ({ ...prev, ... })) 패턴
- 심각도: LOW - 유지보수성 저하

**개선 목표**:
1. 공통 유틸리티 함수 생성
2. 중복 코드 50% 이상 제거
3. 타입 안전성 확보
4. 단위 테스트 작성

**구현할 유틸리티**:

### 1. 날짜 유틸리티
```typescript
// utils/dateUtils.ts
export function formatDate(date: Date | string, format: 'YYYY-MM-DD' | 'YYYY-MM-DD HH:mm'): string;
export function parseDate(dateString: string): Date;
export function isValidDate(date: any): boolean;
```

### 2. 검증 유틸리티
```typescript
// utils/validation.ts
export function validateEmail(email: string): boolean;
export function validatePhone(phone: string): boolean;
export function validateRequired(value: any): boolean;
```

### 3. Firebase 유틸리티
```typescript
// utils/firebaseErrors.ts
export function getFirebaseErrorMessage(error: FirebaseError): string;
export function isPermissionDenied(error: unknown): boolean;
export function handleFirebaseError(error: unknown): void;
```

### 4. 폼 유틸리티
```typescript
// utils/formUtils.ts
export function createFormHandler<T>(
  setState: React.Dispatch<React.SetStateAction<T>>
) => (name: keyof T, value: any) => void;
```

**기술 요구사항**:
- TypeScript 타입 안전성
- 단위 테스트 80% 커버리지
- JSDoc 주석
- 에러 핸들링
- logger 사용

**제약사항**:
- 기존 동작 100% 유지
- 성능 저하 없어야 함
- 점진적 마이그레이션

**파일 구조**:
```
utils/
├── dateUtils.ts
├── validation.ts
├── firebaseErrors.ts
├── formUtils.ts
└── __tests__/
    ├── dateUtils.test.ts
    ├── validation.test.ts
    ├── firebaseErrors.test.ts
    └── formUtils.test.ts
```

**마이그레이션 전략**:
```
Step 1: 유틸리티 생성 (3일)
Step 2: 테스트 작성 (2일)
Step 3: 파일 10개씩 마이그레이션 (1주)
Step 4: 검증 (1일)
```

**성공 기준**:
- 중복 코드 50% 감소
- 유틸리티 테스트 80% 커버리지
- 최소 30개 파일 마이그레이션
- npm run type-check 에러 0개
- 기존 기능 100% 동작

**우선순위**: LOW
**예상 작업 시간**: 40시간 (1주)
**담당자**: Claude AI
**의존성**: Phase 3-2 완료 후 진행
**검증 방법**:
- npm run test
- 전체 기능 회귀 테스트"
```

---

## 📊 전체 타임라인

### Phase별 요약

```
┌─────────────────────────────────────────────────────────────────┐
│ Phase 1: Quick Wins (1개월)                                     │
├─────────────────────────────────────────────────────────────────┤
│ Week 1-2: any 타입 제거                                         │
│   - useJobPostingForm.ts (1일)                                  │
│   - MultiSelectControls.tsx (0.5일)                             │
│ Week 2-3: 대형 파일 분리                                        │
│   - ScheduleDetailModal.tsx (1.5일)                             │
│ Week 4: 폼 컴포넌트 분리                                         │
│   - JobPostingForm.tsx (1.5일)                                  │
│ Total: 4.5일 실작업                                             │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ Phase 2: 테스트 강화 (2개월)                                    │
├─────────────────────────────────────────────────────────────────┤
│ Week 1-2: AuthContext 테스트 (2일)                              │
│ Week 3-5: UnifiedDataContext 테스트 (3일)                       │
│ Week 6-8: 핵심 Hooks 테스트 (2.5일)                             │
│ Week 9-10: UI 컴포넌트 테스트 (2일)                             │
│ Total: 9.5일 실작업                                             │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ Phase 3: 아키텍처 개선 (3개월)                                  │
├─────────────────────────────────────────────────────────────────┤
│ Week 1-2: UnifiedDataContext → Zustand (2주)                    │
│ Week 3-4: 공통 Hook 라이브러리 (1.5주)                          │
│ Week 5: DateFilterContext → Zustand (1일)                       │
│ Week 6-7: 중복 코드 제거 (1주)                                  │
│ Total: 4.5주 실작업                                             │
└─────────────────────────────────────────────────────────────────┘

전체 기간: 약 6개월 (여유 및 버퍼 포함)
실작업 시간: 약 2.5개월
```

### 우선순위별 실행 순서

```
🔴 HIGH (즉시 시작)
  1. Phase 1-1: useJobPostingForm.ts
  2. Phase 1-2: MultiSelectControls.tsx
  3. Phase 1-3: ScheduleDetailModal.tsx

🟡 MEDIUM (1개월 내)
  4. Phase 1-4: JobPostingForm.tsx
  5. Phase 2-1: AuthContext 테스트
  6. Phase 2-2: UnifiedDataContext 테스트
  7. Phase 2-3: 핵심 Hooks 테스트
  8. Phase 2-4: UI 컴포넌트 테스트

🟢 LOW (장기 개선)
  9. Phase 3-1: Zustand 마이그레이션
  10. Phase 3-2: Hook 라이브러리
  11. Phase 3-3: DateFilter 마이그레이션
  12. Phase 3-4: 중복 코드 제거
```

---

## 🚀 시작하기

### 추천 시작 순서

1️⃣ **Phase 1-1부터 시작** (가장 빠른 성과)
```bash
/speckit.specify [위의 Phase 1-1 프롬프트 복사]
```

2️⃣ **SpecKit 워크플로우 진행**
```bash
/speckit.clarify   # 명세 검증 (선택)
/speckit.plan      # 설계 문서 생성
/speckit.tasks     # 작업 목록 생성
/speckit.analyze   # 일관성 검사 (선택)
/speckit.implement # 실제 구현
```

3️⃣ **완료 후 다음 Phase로**
- Phase 1-1 완료 → Phase 1-2
- Phase 1 완료 → Phase 2
- 순차적으로 진행

---

## 📝 체크리스트

### 각 Phase 시작 전
- [ ] 이전 Phase 완료 확인
- [ ] npm run type-check 통과
- [ ] npm run test 통과
- [ ] git 커밋 완료

### 각 Phase 완료 후
- [ ] 성공 기준 모두 충족
- [ ] 문서 업데이트 (CHANGELOG.md)
- [ ] 코드 리뷰 완료
- [ ] 배포 (필요 시)

---

**문서 버전**: v1.0
**최종 업데이트**: 2025-01-05
**담당자**: Claude AI (SuperClaude Framework)
**참고 문서**: [CRITICAL_ANALYSIS_V2.md](./CRITICAL_ANALYSIS_V2.md)