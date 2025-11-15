# Implementation Plan: UnifiedDataContext를 Zustand Store로 전면 교체

**Branch**: `001-zustand-migration` | **Date**: 2025-11-14 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-zustand-migration/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

기존 Context API + useReducer 기반의 UnifiedDataContext (782줄)를 Zustand Store로 완전히 교체하여 코드 간결화(400줄 목표), 리렌더링 최적화, Redux DevTools 연동, 타입 안전성 향상을 달성한다. 5개 Firebase 컬렉션(staff, workLogs, applications, attendanceRecords, jobPostings)의 실시간 구독 기능을 유지하면서, 20개+ 컴포넌트를 점진적으로 마이그레이션하고, 기존 Context API를 완전히 제거한다.

## Technical Context

**Language/Version**: TypeScript 4.9+ (strict mode)
**Primary Dependencies**:
- Zustand 5.0 (이미 설치됨)
- immer (Zustand 미들웨어용)
- zustand/middleware (devtools, immer)
- React 18.2
- Firebase SDK 11.9

**Storage**: Firebase Firestore (실시간 구독)
**Testing**: Jest + React Testing Library (단위 테스트 70% 커버리지 목표)
**Target Platform**: Web (React SPA), 모바일 앱 (Capacitor 7.4)
**Project Type**: Web application (app2/ 디렉토리)
**Performance Goals**:
- 리렌더링 횟수: 기존 대비 동일 또는 감소
- 실시간 구독: 3초 이내 데이터 반영
- 메모리: 누수 없이 10분간 안정적 작동

**Constraints**:
- 기존 기능 100% 호환 (회귀 방지)
- 실시간 구독 기능 유지
- TypeScript strict mode 에러 0개
- any 타입 사용 금지
- 성능 저하 없어야 함

**Scale/Scope**:
- 5개 Firebase 컬렉션
- 20개+ 컴포넌트 마이그레이션
- 782줄 → 400줄 목표 (50% 감소)
- Production Ready 앱 (v0.2.3)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Constitution 파일 없음**: 프로젝트에 constitution.md가 비어 있어 기본 체크만 수행합니다.

### 기본 품질 게이트

✅ **TypeScript Strict Mode**: 모든 코드는 strict mode에서 에러 없이 컴파일되어야 함
✅ **타입 안전성**: any 타입 사용 금지
✅ **테스트 커버리지**: 단위 테스트 70% 이상
✅ **린트 규칙**: ESLint 에러 0개
✅ **빌드 성공**: npm run build 성공
✅ **성능**: 기존 대비 동일 또는 향상
✅ **메모리 안전성**: 메모리 누수 없음

**게이트 평가**: ✅ **모든 기본 게이트 통과**

## Project Structure

### Documentation (this feature)

```text
specs/001-zustand-migration/
├── spec.md              # Feature specification
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (기술 조사 결과)
├── data-model.md        # Phase 1 output (데이터 모델 정의)
├── quickstart.md        # Phase 1 output (개발자 가이드)
├── contracts/           # Phase 1 output (Store 인터페이스)
│   └── unifiedDataStore.interface.ts
├── checklists/          # 검증 체크리스트
│   └── requirements.md
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```text
# Web application structure (app2/)
app2/
├── src/
│   ├── stores/                          # 🆕 Zustand Stores
│   │   ├── unifiedDataStore.ts         # Main store (400줄 목표)
│   │   └── __tests__/
│   │       └── unifiedDataStore.test.ts
│   │
│   ├── contexts/                        # ❌ 삭제 예정
│   │   └── UnifiedDataContext.tsx      # 782줄 (제거 대상)
│   │
│   ├── pages/                           # 🔄 마이그레이션 대상
│   │   ├── MySchedulePage/
│   │   ├── JobPostingPage/
│   │   ├── ApplicantListPage/
│   │   ├── StaffManagementPage/
│   │   └── AttendancePage/
│   │
│   ├── components/                      # 🔄 마이그레이션 대상
│   │   ├── ScheduleDetailModal/
│   │   ├── StaffSelector.tsx
│   │   ├── WorkLogList.tsx
│   │   ├── ApplicationList.tsx
│   │   └── AttendanceRecordList.tsx
│   │
│   ├── services/                        # 기존 유지
│   │   └── OptimizedUnifiedDataService.ts
│   │
│   ├── types/                           # 기존 유지 + 확장
│   │   └── unifiedData.ts
│   │
│   └── utils/                           # 기존 유지
│       └── logger.ts
│
└── tests/                               # 테스트
    ├── unit/
    └── integration/
```

**Structure Decision**:

UNIQN 프로젝트는 `app2/` 디렉토리를 메인 애플리케이션으로 사용하는 웹 애플리케이션 구조입니다. Zustand Store는 `src/stores/` 디렉토리에 추가하고, 기존 `src/contexts/UnifiedDataContext.tsx`는 마이그레이션 완료 후 삭제합니다.

**마이그레이션 경로**:
1. `app2/src/stores/unifiedDataStore.ts` 생성 (신규)
2. `app2/src/pages/` 및 `app2/src/components/` 내 20개+ 파일 수정 (기존)
3. `app2/src/contexts/UnifiedDataContext.tsx` 삭제 (기존)
4. `app2/src/App.tsx`에서 UnifiedDataProvider 제거 (기존)

## Complexity Tracking

> **Constitution Check 위반 없음 - 이 섹션 생략**

이 마이그레이션은 기존 복잡도를 **감소**시키는 작업입니다:
- 782줄 → 400줄 (50% 감소)
- Context API의 복잡한 reducer 로직 → 간결한 Zustand actions
- 리렌더링 최적화 개선

따라서 복잡도 위반 사항이 없습니다.

## Phase 0: Research & Technical Decisions

### Research Topics

이 섹션은 `/speckit.plan` 명령어가 자동으로 research.md 파일을 생성할 때 채워집니다.

**주요 조사 항목**:
1. Zustand 5.0 베스트 프랙티스
2. immer 미들웨어 사용법
3. devtools 미들웨어 설정
4. Firebase 실시간 구독과 Zustand 통합 패턴
5. Map 데이터 구조 메모이제이션 전략
6. shallow 비교 최적화 기법
7. TypeScript strict mode에서의 Zustand 타입 정의

**출력**: [research.md](./research.md)

## Phase 1: Design & Contracts

### Data Model

이 섹션은 `/speckit.plan` 명령어가 자동으로 data-model.md 파일을 생성할 때 채워집니다.

**주요 엔티티**:
- Staff (스태프 정보)
- WorkLog (근무 기록)
- Application (지원서)
- AttendanceRecord (출석 기록)
- JobPosting (구인 공고)
- UnifiedDataStore (전역 상태)

**출력**: [data-model.md](./data-model.md)

### API Contracts

이 섹션은 `/speckit.plan` 명령어가 자동으로 contracts/ 디렉토리를 생성할 때 채워집니다.

**Store 인터페이스**:
- State: 5개 Map 컬렉션 + loading/error 상태
- Selectors: getStaffById, getWorkLogsByStaffId 등
- Actions: subscribeAll, unsubscribeAll, setStaff, updateStaff, deleteStaff 등

**출력**: [contracts/unifiedDataStore.interface.ts](./contracts/unifiedDataStore.interface.ts)

### Quickstart Guide

이 섹션은 `/speckit.plan` 명령어가 자동으로 quickstart.md 파일을 생성할 때 채워집니다.

**내용**:
- Zustand Store 사용법
- 마이그레이션 가이드
- 테스트 작성 방법
- Redux DevTools 사용법

**출력**: [quickstart.md](./quickstart.md)

## Implementation Strategy

### Step 1: Zustand Store 완전 구현 (3일)

**목표**: 기존 Context API 기능을 완전히 대체하는 Zustand Store 생성

**작업**:
1. `app2/src/stores/unifiedDataStore.ts` 생성
2. TypeScript 인터페이스 정의 (UnifiedDataStore)
3. immer + devtools 미들웨어 설정
4. 5개 컬렉션 상태 정의 (Map 구조)
5. Selectors 구현 (getStaffById, getWorkLogsByStaffId 등)
6. Actions 구현 (setStaff, updateStaff, deleteStaff 등)
7. Firebase 실시간 구독 로직 이전 (subscribeAll, unsubscribeAll)
8. cleanup 로직 구현 (메모리 누수 방지)
9. 단위 테스트 작성 (`__tests__/unifiedDataStore.test.ts`)
10. `npm run type-check` 통과 확인

**검증**:
- TypeScript 에러 0개
- 단위 테스트 통과
- Redux DevTools 연동 확인

### Step 2: 모든 사용처 일괄 변경 (3일)

**목표**: 20개+ 컴포넌트를 Context API에서 Zustand Store로 마이그레이션

**작업**:
1. grep으로 `useUnifiedData` 사용처 전체 검색
2. 마이그레이션 대상 컴포넌트 목록 작성
3. 각 컴포넌트 순차적으로 변경:
   - import 문 변경: `../contexts/UnifiedDataContext` → `../stores/unifiedDataStore`
   - hook 사용법 변경: `useUnifiedData()` → `useUnifiedDataStore(selector, shallow)`
   - 타입 체크 (`npm run type-check`)
   - 린트 체크 (`npm run lint`)
   - 수동 테스트
4. 주요 페이지별 기능 테스트:
   - MySchedulePage: 스케줄 이벤트 조회
   - StaffManagementPage: staff 추가/수정/삭제
   - AttendancePage: 출석 상태 변경
   - JobPostingPage: 공고 조회
   - ApplicantListPage: 지원서 목록

**검증**:
- 모든 페이지 수동 테스트 통과
- TypeScript 에러 0개
- ESLint 에러 0개
- 기존 E2E 테스트 통과

### Step 3: Context 완전 제거 (0.5일)

**목표**: 기존 Context API 코드 완전 제거

**작업**:
1. `app2/src/contexts/UnifiedDataContext.tsx` 파일 삭제
2. `app2/src/App.tsx`에서 `<UnifiedDataProvider>` 제거
3. 불필요한 import 문 정리
4. `npm run type-check` 재확인
5. `npm run lint` 재확인
6. `npm run build` 성공 확인

**검증**:
- 빌드 성공
- TypeScript 에러 0개
- ESLint 에러 0개

### Step 4: 테스트 및 검증 (2일)

**목표**: 전체 시스템 검증 및 성능 벤치마크

**작업**:
1. 단위 테스트 커버리지 확인 (70% 이상)
2. 통합 테스트: 전체 페이지 수동 테스트
3. 성능 벤치마크:
   - React DevTools Profiler로 리렌더링 횟수 측정
   - Chrome Memory Profiler로 메모리 사용량 측정
   - Firebase 구독 성능 확인 (3초 이내)
4. Redux DevTools 상태 추적 확인
5. 최종 빌드 테스트

**검증**:
- 테스트 커버리지 70% 이상
- 리렌더링 횟수 동일 또는 감소
- 메모리 누수 없음
- 모든 기능 정상 작동

## Testing Strategy

### Unit Tests

**대상**: `app2/src/stores/unifiedDataStore.ts`

**테스트 케이스**:
1. Store 초기화 테스트
2. Selectors 테스트 (getStaffById, getWorkLogsByStaffId 등)
3. Actions 테스트 (setStaff, updateStaff, deleteStaff 등)
4. Firebase 구독 mock 테스트
5. cleanup 로직 테스트 (메모리 누수 방지)
6. Error 상태 처리 테스트
7. Loading 상태 처리 테스트

**도구**: Jest + React Testing Library

### Integration Tests

**대상**: 마이그레이션된 컴포넌트

**테스트 시나리오**:
1. 페이지 로드 시 데이터 조회
2. 데이터 추가/수정/삭제
3. 실시간 구독 업데이트
4. Optimistic update
5. 에러 처리
6. 로그아웃 시 cleanup

### Performance Tests

**측정 항목**:
1. 리렌더링 횟수 (React DevTools Profiler)
2. 메모리 사용량 (Chrome Memory Profiler)
3. 실시간 구독 반영 시간 (<3초)
4. 초기 로딩 시간
5. 업데이트 응답 시간

**기준**: Context API 대비 동등 또는 향상

## Risk Mitigation

### 리스크 1: 리렌더링 성능 저하
**완화 전략**:
- React DevTools Profiler로 사전 측정
- shallow 비교 적극 활용
- useMemo, useCallback 추가 최적화

### 리스크 2: 실시간 구독 로직 이전 시 버그
**완화 전략**:
- Context 구독 로직 한 줄씩 검토
- 단위 테스트 작성
- 개발 환경 충분히 테스트

### 리스크 3: 컴포넌트 마이그레이션 중 누락
**완화 전략**:
- grep 자동 검색으로 목록 작성
- 체크리스트 작성
- 전체 페이지 수동 테스트

### 리스크 4: TypeScript 타입 에러
**완화 전략**:
- 자주 `npm run type-check` 실행
- 타입 정의 먼저 완성
- ESLint 규칙으로 any 금지

### 리스크 5: 메모리 누수
**완화 전략**:
- unsubscribeAll() 철저히 구현
- Memory Profiler 모니터링
- 로그아웃/로그인 반복 테스트

## Success Criteria

### 기능 검증
- [ ] Context 코드 완전 제거 (UnifiedDataContext.tsx 삭제)
- [ ] 모든 기능 정상 작동 (20개+ 페이지 테스트)
- [ ] Firebase 실시간 구독 정상 작동 (3초 이내)
- [ ] Redux DevTools 연동 확인

### 성능 검증
- [ ] 리렌더링 횟수 동일 또는 감소
- [ ] 메모리 누수 없음 (10분간 안정적 작동)
- [ ] 초기 로딩 시간 동등 또는 향상

### 품질 검증
- [ ] `npm run type-check` 에러 0개
- [ ] `npm run lint` 통과
- [ ] `npm run build` 성공
- [ ] 단위 테스트 커버리지 70% 이상
- [ ] 코드 라인 수 782 → 400 이하 (50% 감소)

## Next Steps

1. ✅ **Phase 0 완료**: `/speckit.plan` 명령어가 research.md 생성 (진행 중)
2. ⏳ **Phase 1 대기**: data-model.md, contracts/, quickstart.md 생성 (진행 중)
3. ⏳ **Phase 2 대기**: `/speckit.tasks` 명령어로 tasks.md 생성 (별도 명령어 필요)
4. ⏳ **구현 시작**: tasks.md 기반 개발 시작

**현재 상태**: Planning phase 진행 중
