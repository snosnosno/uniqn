# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

T-HOLDEM is a comprehensive web-based platform for managing Hold'em poker tournaments and operations. Built with React 18 + TypeScript + Firebase, it provides real-time dealer shift management, QR code attendance tracking, staff management, job posting system, tournament operations, payroll processing, and comprehensive administrative features.

### 🛠️ 기술 스택
- **Frontend**: React 18, TypeScript (Strict Mode), Tailwind CSS
- **Backend**: Firebase (Auth, Firestore, Functions, Storage)
- **State Management**: Context API (Auth, Tournament), Zustand (Toast, JobPosting 마이그레이션 완료)
- **Performance**: React Window (가상화), useMemo/useCallback 최적화, Code Splitting, 성능 모니터링 시스템
- **Testing**: Jest, React Testing Library (10개 테스트 파일 작성 완료)
- **Build**: Create React App, PostCSS
- **타입 시스템**: TypeScript Strict Mode (`strict: true`, `exactOptionalPropertyTypes: true`, `noUncheckedIndexedAccess: true`)
- **로깅**: 구조화된 로깅 시스템 (5단계 레벨, 컨텍스트 기반) - console 사용 70% 감소
- **보안**: CSP, XSS 방지 (DOMPurify), CSRF 토큰
- **모니터링**: PerformanceMonitor (Web Vitals, 번들 크기, 메모리 사용량), Sentry 에러 추적
- **CI/CD**: GitHub Actions (자동 빌드, 테스트, 배포)
- **추가 라이브러리**: 
  - @tanstack/react-table (^8.21.3) - 고성능 테이블 컴포넌트
  - @tanstack/react-query (^5.17.0) - 서버 상태 관리
  - date-fns (^4.1.0) - 날짜 처리 유틸리티
  - @heroicons/react (^2.2.0) - 아이콘 라이브러리 (react-icons 대체)
  - @dnd-kit - 드래그 앤 드롭 (react-dnd 완전 제거)
  - @sentry/react (^8.44.0) - 에러 모니터링

## 🔥 최근 주요 업데이트 (2025-08-04)

### 대규모 코드 품질 개선 및 인프라 구축 (2025-08-04) ✨
- **빌드 오류 완전 해결**: TypeScript strict mode 오류 0개 달성
- **테스트 인프라 구축**: Jest 환경 복구, Firebase 모킹 구현, 10개 테스트 파일 작성
- **CI/CD 파이프라인**: GitHub Actions 자동화 구축 완료
- **Sentry 통합**: 프로덕션 에러 모니터링 시스템 구현
- **라이브러리 최적화 완료**:
  - react-icons → @heroicons/react (완전 교체)
  - react-dnd → @dnd-kit (완전 통일)
  - FullCalendar → LightweightCalendar (구현 완료)
  - react-data-grid → 완전 제거
- **Console 사용 대폭 감소**: 구조화된 logger 시스템 도입
- **아이콘 시스템 표준화**: 전체 프로젝트 아이콘 크기 일관성 확보
- **상태 관리 현대화**: Context API → Zustand 마이그레이션 (Toast, JobPosting 완료)

### 대규모 코드 모듈화 및 UI 개선 (2025-08-03)
- **지원자 목록 모바일 UI 개선**: 반응형 디자인 최적화 및 이벤트 탭 제거
- **코드 모듈화**: JobBoardPage를 JobBoard/ 디렉토리로 완전 모듈화
- **구인공고 게시판 UI/UX 개선**: 사용자 경험 대폭 향상
- **Firebase 오류 해결**: INTERNAL ASSERTION FAILED 오류 수정 및 안정성 향상

### 환경 변수 설정 완료 ✅ (2025-08-02)
- **Firebase API 키 보호**: .env 파일로 모든 Firebase 설정 이동 완료
- **환경 변수 활용**: `REACT_APP_FIREBASE_*` 환경 변수로 안전한 관리
- **보안 강화**: API 키 노출 문제 해결


### 대규모 성능 최적화 및 코드 품질 개선 (2025-01-31)
- **성능 개선 성과**:
  - 번들 크기: 1.6MB → 890KB (44% 감소)
  - 초기 로딩 시간: 3.5초 → 2.0초 (43% 개선)
  - Lighthouse 성능 점수: 68 → 91 (34% 향상)
  - Firebase 구독: 9개 → 5개 (44% 감소)
- **보안 강화**:
  - Content Security Policy (CSP) 구현
  - XSS 방지: DOMPurify 도입 및 모든 사용자 입력 sanitization
  - CSRF 토큰: 모든 state-changing 작업에 적용
- **성능 모니터링 시스템 구축**:
  - PerformanceMonitor 유틸리티 구현
  - Web Vitals 측정 (FCP, LCP, CLS)
  - 성능 보고서 페이지 구현
  - 컴포넌트별 렌더링 성능 추적

## Development Preferences

### 🌟 사용자 선호 방식
- **언어**: 항상 한국어로 응답 (`항상 한글로답변해줘`)
- **도구 선택**: 사용가능한 MCP, sub agents 도구 적극 사용
- **개발 철학**: 실시간 반영, 직관적 UI, 단순명확한 로직
- **Firebase 패턴**: 실시간 구독(onSnapshot) 우선, 수동 새로고침 최소화

### 🔧 기술적 가이드라인
- **데이터 관리**: workLogs 컬렉션을 staff 컬렉션보다 우선 사용 (날짜별 독립성)
- **실시간 동기화**: useStaffManagement, useAttendanceStatus 훅 모두 onSnapshot 구독 활용
- **타입 안전성**: 
  - TypeScript strict mode 준수 (모든 타입 명시적 정의)
  - 배열/객체 접근 시 undefined 체크 필수
  - dealerId/staffId 호환성 유지
- **디버깅**: 한국어 로그와 구조화된 logger로 투명한 디버깅

### 🎯 핵심 컴포넌트
- **WorkTimeEditor**: 통합 시간 편집 (예정시간 = scheduledStartTime/EndTime)
- **AttendanceStatusDropdown**: 출석 상태 직접 편집 (not_started, checked_in, checked_out, absent)
- **StaffRow/StaffCard**: workLogs 데이터 우선 표시, staff 데이터는 fallback
- **실시간 훅들**: 모든 데이터 변경은 Firebase 구독으로 자동 반영

## 🏗️ 프로젝트 구조 가이드

### 주요 디렉토리 구조
```
- app2/src/              # 메인 애플리케이션 소스
  - components/          # 재사용 가능한 컴포넌트
    - applicants/        # 지원자 관련 모듈화된 컴포넌트
    - common/            # 공통 UI 컴포넌트
    - jobPosting/        # 구인공고 관련 컴포넌트
  - pages/              
    - JobBoard/          # 모듈화된 구인공고 페이지
  - stores/             # Zustand 스토어
- SHRIMP/               # 태스크 관리 시스템
- claude_set/           # SuperClaude 설정
- scripts/              # 유틸리티 스크립트
```

### Firebase Collections 구조
```
- staff: 스태프 기본 정보 (이름, 연락처, 역할 등)
- workLogs: 날짜별 개별 근무 기록 (scheduledStartTime/EndTime, actualStartTime/EndTime)
- attendanceRecords: 출석 상태 및 실시간 추적
- jobPostings: 구인공고 정보
```

### 핵심 유틸리티
```typescript
- logger: 구조화된 로깅 시스템 (src/utils/logger.ts)
  - 5단계 로그 레벨 지원
  - 환경별 동작 (개발/프로덕션)
  - 성능 측정 및 에러 추적 기능
  - Firebase 에러 자동 복구

- performanceMonitor: 성능 모니터링 시스템 (src/utils/performanceMonitor.ts)
  - Web Vitals 측정 (FCP, LCP, CLS, TTFB)
  - 번들 크기 분석
  - 메모리 사용량 추적
  - 컴포넌트 렌더링 성능 측정

- dateUtils: 날짜 처리 유틸리티 (src/utils/dateUtils.ts)
  - Firebase Timestamp 안전한 변환
  - 타임존 처리 및 형식 변환
  - TypeScript strict mode 호환
```

### 핵심 Hook 구조
```typescript
- useStaffManagement: 스태프 목록 관리 + 실시간 구독
- useAttendanceStatus: 출석 상태 관리 + workLogs 실시간 구독  
- useJobPostingContext: 공고 데이터 컨텍스트
```

### 데이터 우선순위
1. **시간 표시**: workLogs.scheduledStartTime > staff.assignedTime > '미정'
2. **출석 상태**: attendanceRecords.status (독립적 관리)
3. **실시간 동기화**: 모든 변경사항은 Firebase 구독으로 즉시 반영

## ⚠️ 중요 주의사항

### 절대 하지 말 것
- **수동 새로고침 사용 금지**: onSnapshot 구독으로 실시간 동기화 필수
- **staff 컬렉션 시간 업데이트 금지**: 날짜별 독립성을 위해 workLogs만 사용
- **API 키 하드코딩 금지**: Firebase 설정은 환경 변수로 관리
- **any 타입 사용 금지**: TypeScript strict mode에서 구체적인 타입 정의 필수
- **undefined 체크 없는 배열/객체 접근 금지**: noUncheckedIndexedAccess 활성화로 인해 필수

### 필수 구현 패턴
- **실시간 구독**: `onSnapshot(query, callback)` 패턴 사용
- **구조화된 로깅**: 
  ```typescript
  // ❌ 금지
  console.log('에러 발생', error);
  
  // ✅ 권장
  logger.error('작업 실패', error, { 
    component: 'ComponentName',
    operation: 'operationName' 
  });
  ```
- **타입 안전성**: 
  - dealerId/staffId 호환성 유지
  - 모든 any 타입 제거 및 구체적 타입 정의
  - 배열/객체 접근 시 undefined 체크: `array[index] || defaultValue`
  - 조건부 속성: `...(value && { prop: value })`
- **UI 직관성**: 클릭 편집, 드롭다운 선택, '미정' 상태 표시
- **성능 최적화**: 
  - useMemo/useCallback 활용
  - 가상화 적용 (대량 데이터)
  - React.memo 적용 (자주 렌더링되는 컴포넌트)
- **코드 분할**: React.lazy()로 주요 라우트 동적 임포트
- **에러 처리**:
  ```typescript
  try {
    await operation();
  } catch (error) {
    logger.error('작업 실패', 
      error instanceof Error ? error : new Error(String(error)),
      { component: 'ComponentName' }
    );
  }
  ```

## 🚨 보안 및 성능 개선 사항 (Critical)

### 즉시 적용 필요
1. **ESLint 경고 해결** 🟡
   - 약 70개의 ESLint 경고 존재
   - 대부분 미사용 변수 및 의존성 배열 관련

### 완료된 항목 ✅
1. **환경 변수 설정** ✅ (2025-08-02 완료)
   - Firebase API 키를 .env 파일로 이동 완료
   - `REACT_APP_FIREBASE_API_KEY` 등 환경 변수 사용 중
   
2. **타입 안전성 강화** ✅ (2025-01-30 완료)
   - 모든 any 타입을 구체적 인터페이스로 교체
   - tsconfig.json에 strict 모드 활성화
   - TypeScript strict mode 마이그레이션 완료

3. **라이브러리 최적화** ✅ (2025-08-04 완료)
   - FullCalendar → LightweightCalendar 완전 교체
   - react-data-grid → 완전 제거
   - react-icons → @heroicons/react 완전 교체
   - react-dnd → @dnd-kit 통일

4. **테스트 인프라 구축** ✅ (2025-08-04 완료)
   - Jest + React Testing Library 환경 구성
   - Firebase 모킹 구현
   - 10개 주요 컴포넌트 테스트 작성

5. **CI/CD 파이프라인** ✅ (2025-08-04 완료)
   - GitHub Actions 워크플로우 구축
   - 자동 빌드, 테스트, 배포 프로세스

6. **에러 모니터링** ✅ (2025-08-04 완료)
   - Sentry 통합 완료
   - 실시간 에러 추적 시스템 구축

7. **상태 관리 개선** ✅ (2025-08-04 완료)
   - ToastContext → Zustand 마이그레이션
   - JobPostingContext → Zustand 마이그레이션

### 중기 개선 사항 (2-4주)
1. **코드 분할 구현**
   ```typescript
   const JobBoardPage = lazy(() => import('./pages/JobBoardPage'));
   const AdminDashboard = lazy(() => import('./pages/admin/DashboardPage'));
   ```

2. **라이브러리 최적화 완료**
   - FullCalendar → LightweightCalendar 완전 교체
   - react-data-grid → LightweightDataGrid 완전 교체
   - react-icons → 커스텀 SVG 아이콘 완전 교체

3. **상태 관리 개선**
   - Context API → Zustand 마이그레이션 확대
   - 전역 상태 최소화

### 장기 개선 사항 (1-2개월)
1. **테스트 커버리지**
   - 주요 컴포넌트 단위 테스트 추가
   - 통합 테스트 구현

2. **성능 모니터링**
   - Web Vitals 통합
   - 실시간 성능 대시보드 구축

## 📊 현재 프로젝트 상태

### 강점
- 체계적인 Firebase 보안 규칙 (역할 기반 접근 제어)
- 성능 최적화 도구 활용 (가상화, 메모이제이션)
- 한국어 중심 개발 문서화
- TypeScript Strict Mode 전면 적용 완료
- 번들 크기 44% 감소 (1.6MB → 890KB)
- 초기 로딩 시간 43% 개선 (3.5초 → 2.0초)
- Firebase API 키 환경 변수로 안전 관리 (.env 파일)

### 개선 완료 ✅
- ~~any 타입 과다 사용~~ → TypeScript strict mode로 해결
- ~~큰 라이브러리 의존성~~ → 경량 컴포넌트로 부분 교체
  - FullCalendar → LightweightCalendar 구현 (일부 페이지만 적용)
  - react-data-grid → LightweightDataGrid 구현 (일부 적용)
  - react-icons → 일부 커스텀 SVG 아이콘으로 교체
- ~~Context API 성능 이슈~~ → Zustand 도입 시작 (tournamentStore.ts)
- ~~console.log 사용~~ → 구조화된 logger 시스템으로 부분 교체 (67개 console 사용 잔존)
- ~~CEO 대시보드 성능~~ → 실시간 구독 9개 → 5개로 최적화 (44% 감소)
- ~~보안 취약점~~ → CSP, XSS 방지, CSRF 보호 구현 완료
- ~~환경 변수 미설정~~ → Firebase API 키를 .env 파일로 관리 (2025-08-02)
- ~~이벤트 탭~~ → 불필요한 기능 제거 완료 (2025-08-03)
- ~~코드 모듈화~~ → JobBoardPage 등 주요 컴포넌트 모듈화 완료

### 개선 필요
- 테스트 커버리지 확대 필요 (현재 10개 파일 → 목표 70%)
- ESLint 경고 해결 필요 (약 70개)
- SSR/SSG 도입 검토 (Next.js)
- TournamentContext의 Zustand 마이그레이션 필요

## 🚀 성능 최적화 현황

### 번들 분석 및 최적화 (2025-01-31)
- **번들 크기**: 1.6MB → 890KB (44% 감소)
- **초기 로딩**: 3.5초 → 2.0초 (43% 개선)
- **Lighthouse 점수**: Performance 68 → 91

### 라이브러리 최적화
| 라이브러리 | 이전 | 이후 | 절감률 |
|------------|------|------|--------|
| FullCalendar | ~500KB | ~20KB | 96% |
| react-data-grid | ~170KB | ~25KB | 85% |
| react-icons | ~60KB | ~5KB | 92% |
| Firebase (동적) | ~50KB | 0KB* | 100% |

*필요시에만 동적 로드

### 테스트 인프라
- Jest + React Testing Library 설정 완료
- 단위 테스트 및 통합 테스트 기반 구축
- Firebase 모킹 환경 구성


## 🚧 앞으로의 개발 방향

### 단기 목표 (1-2주)
1. **테스트 커버리지 확대**
   - 현재 10개 → 30개 테스트 파일로 확대
   - 비즈니스 로직 중심 테스트 작성
   - 테스트 커버리지 50% 달성

2. **ESLint 경고 해결**
   - 약 70개 경고 점진적 해결
   - 코드 품질 개선

3. **TournamentContext 마이그레이션**
   - Context API → Zustand 완전 전환
   - 상태 관리 현대화 완료

### 중기 목표 (1개월)
1. **상태 관리 최적화**
   - Context API → Zustand 마이그레이션 완료
   - 전역 상태 최소화
   - 로컬 상태 활용 증대

2. **성능 모니터링 고도화**
   - 실시간 성능 대시보드 구축
   - 사용자 행동 분석
   - 에러 트래킹 시스템 (Sentry)

3. **접근성 개선**
   - WCAG 2.1 AA 준수
   - 키보드 네비게이션 완벽 지원
   - 스크린 리더 호환성

### 장기 목표 (3-6개월)
1. **Next.js 마이그레이션**
   - SSR/SSG 도입으로 초기 로딩 개선
   - SEO 최적화
   - 이미지 최적화

2. **마이크로 프론트엔드**
   - 모듈별 독립 배포
   - 팀별 독립 개발
   - 버전 관리 개선

3. **AI/ML 기능 도입**
   - 스태프 스케줄 자동 최적화
   - 토너먼트 결과 예측
   - 이상 탐지 시스템

## 📚 기술 문서

### 주요 가이드
- **[최적화 가이드](app2/docs/OPTIMIZATION_GUIDE.md)**: 번들 분석, 라이브러리 최적화, 성능 측정
- **[마이그레이션 가이드](app2/docs/MIGRATION_GUIDES.md)**: TypeScript, 라이브러리 교체, 상태 관리
- **[기술 보고서](app2/docs/TECHNICAL_REPORTS.md)**: 상태 관리 분석, 성능 측정, 로드맵
- **[성능 측정 보고서](app2/docs/PERFORMANCE_MEASUREMENT_REPORT.md)**: 최적화 결과 및 성과 분석

## 🛡️ TypeScript Strict Mode 오류 방지 가이드

### 자주 발생하는 오류와 해결 방법

#### 1. **undefined 처리 패턴**
```typescript
// ❌ 오류 발생 코드
const value = formData.startDate;  // Type: string | undefined
toDropdownValue(value);  // Error: Argument of type 'string | undefined' is not assignable

// ✅ 올바른 처리
const value = formData.startDate || '';  // 기본값 제공
const value = formData.startDate ?? '';  // null/undefined만 체크
const value = typeof formData.startDate === 'string' ? formData.startDate : '';  // 타입 체크
```

#### 2. **배열/객체 접근 안전성**
```typescript
// ❌ 오류 발생 코드
const item = array[index];  // Type: T | undefined
item.property;  // Error: Object is possibly 'undefined'

// ✅ 올바른 처리
const item = array[index];
if (item) {
  item.property;  // 타입 가드로 안전 보장
}
// 또는
const item = array[index] || defaultItem;
const property = array[index]?.property || defaultValue;
```

#### 3. **빈 객체 타입 처리**
```typescript
// ❌ 오류 발생 코드
const benefits = {};  // Type: {}
benefits.guaranteedHours;  // Error: Property 'guaranteedHours' does not exist

// ✅ 올바른 처리
const benefits = {} as Benefits;  // 타입 캐스팅
const benefits: Benefits = {};  // 타입 명시
const benefits: Partial<Benefits> = {};  // 부분 타입 사용
```

#### 4. **Union 타입 처리**
```typescript
// ❌ 오류 발생 코드
function processDate(date: string | Timestamp | undefined) {
  date.toDate();  // Error: Property 'toDate' does not exist on type 'string'
}

// ✅ 올바른 처리
function processDate(date: string | Timestamp | undefined) {
  if (!date) return '';
  
  if (typeof date === 'string') {
    return date;
  }
  
  if (date && typeof date === 'object' && 'toDate' in date) {
    return date.toDate().toISOString();
  }
  
  return '';
}
```

#### 5. **Optional 속성 처리**
```typescript
// ❌ 오류 발생 코드
<Component items={data.items} />  // Type 'undefined' is not assignable

// ✅ 올바른 처리
<Component items={data.items || []} />
<Component items={data.items ?? []} />
<Component {...(data.items && { items: data.items })} />
```

### 개발 시 필수 체크사항

#### 타입 정의 시
- [ ] Optional 속성은 `?`로 명확히 표시
- [ ] Union 타입은 모든 경우를 처리하는 타입 가드 작성
- [ ] `any` 타입 절대 사용 금지 - 구체적인 타입 정의
- [ ] 빈 객체는 타입 캐스팅 또는 인터페이스 지정

#### 컴포넌트 Props 처리
- [ ] Optional props는 기본값 제공
- [ ] 배열 props는 빈 배열 `[]` 기본값
- [ ] 객체 props는 타입에 맞는 초기값 제공

#### Firebase 데이터 처리
- [ ] Timestamp는 항상 string과 구분하여 처리
- [ ] Firestore 데이터는 undefined 가능성 항상 체크
- [ ] 날짜 변환 시 타입 체크 필수

#### 에러 방지 코딩 습관
1. **Early Return 패턴 활용**
   ```typescript
   if (!data) return defaultValue;
   if (typeof data !== 'string') return '';
   ```

2. **Optional Chaining 적극 활용**
   ```typescript
   const value = data?.nested?.property ?? defaultValue;
   ```

3. **타입 가드 함수 작성**
   ```typescript
   function isTimestamp(value: unknown): value is Timestamp {
     return value != null && 
            typeof value === 'object' && 
            'toDate' in value;
   }
   ```

4. **Nullish Coalescing (`??`) 활용**
   ```typescript
   const result = value ?? defaultValue;  // null/undefined만 체크
   ```

## 🔑 개발 체크리스트

### 새로운 기능 개발 시
- [ ] TypeScript strict mode 준수 (any 타입 사용 금지)
- [ ] 모든 optional 값에 대한 undefined 처리
- [ ] Union 타입의 모든 경우 처리
- [ ] 구조화된 logger 사용 (console.log 금지)
- [ ] Firebase 실시간 구독 사용 (onSnapshot)
- [ ] 메모이제이션 적용 (useMemo, useCallback)
- [ ] 에러 처리 및 로깅
- [ ] 테스트 코드 작성
- [ ] 성능 측정 및 최적화

### 코드 리뷰 체크포인트
- [ ] 타입 안전성 검증 (undefined, null 처리)
- [ ] Union 타입 완전성 검사
- [ ] Optional chaining 적절한 사용
- [ ] 성능 영향 평가
- [ ] 보안 취약점 검사
- [ ] 접근성 준수 확인
- [ ] 코드 가독성 및 유지보수성

## Memories

- `항상 한글로 답변해줘`: 클로드와의 대화에서 한국어로 응답하도록 요청하는 메모
- `도구사용`: 사용가능한 MCP, SUB AGENTS 모두 적극 사용
- `실시간반영중시`: Firebase onSnapshot 구독으로 즉시 UI 업데이트, 수동 새로고침 제거
- `날짜별시간관리`: workLogs 컬렉션 기반으로 각 날짜별 독립적인 시간 설정 시스템 구현 완료
- `출석상태분리`: 시간 수정과 출석 상태를 완전 분리, AttendanceStatusDropdown으로 관리
- `출석자동변경제거`: 퇴근시간 설정 시 자동 상태 변경 기능 제거 (2025-01-31)
- `workLogs우선`: workLogs 데이터를 staff 데이터보다 우선하여 날짜별 독립성 보장
- `타입안전성강화완료`: TypeScript strict mode 적용 완료 (2025-01-30)
- `번들최적화진행중`: 주요 라이브러리 부분 교체로 크기 감소, 완전 교체 필요
- `환경변수설정완료`: Firebase API 키 등 민감 정보 .env 파일로 보호 완료 ✅ (2025-08-02)
- `테스트인프라구축완료`: Jest 환경 설정, Firebase 모킹, 10개 테스트 파일 작성 ✅ (2025-08-04)
- `logger시스템도입완료`: 구조화된 logger 시스템 전면 도입 ✅ (2025-08-04)
- `성능모니터링구축완료`: PerformanceMonitor 유틸리티 및 보고서 페이지 구현 (2025-01-31)
- `보안강화완료`: CSP, XSS 방지, CSRF 토큰 구현 (2025-01-31)
- `CI/CD구축완료`: GitHub Actions 파이프라인 구현 ✅ (2025-08-04)
- `Zustand마이그레이션진행중`: Toast, JobPosting 완료, Tournament 필요
- `모듈화완료`: JobBoardPage 등 주요 컴포넌트 모듈화 (2025-08-03)
- `이벤트탭제거완료`: 불필요한 이벤트 탭 기능 제거 (2025-08-03)
- `모바일UI개선완료`: 구인공고 및 지원자 목록 반응형 개선 (2025-08-03)
- `라이브러리최적화완료`: FullCalendar, react-data-grid, react-icons 완전 교체 ✅ (2025-08-04)
- `Sentry통합완료`: 에러 모니터링 시스템 구축 ✅ (2025-08-04)
- `DnD통일완료`: @dnd-kit으로 완전 통일 ✅ (2025-08-04)