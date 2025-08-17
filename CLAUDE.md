# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

T-HOLDEM은 홀덤 포커 토너먼트 운영을 위한 종합 웹 플랫폼입니다. React 18 + TypeScript + Firebase로 구축되어 실시간 딜러 교대 관리, QR 코드 출석 추적, 스태프 관리, 구인공고 시스템, 토너먼트 운영, 급여 처리 등 포괄적인 관리 기능을 제공합니다.

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

## 🔥 최근 주요 업데이트

### 2025년 1월 업데이트
- **토너먼트 참가자 관리 시스템**: 칩 카운트 표시, 자동 재배치 알고리즘, CSV 업로드
- **번들 크기 최적화**: 273KB (gzipped) 달성 - 84% 감소
- **TypeScript Strict Mode**: 100% 준수
- **Deprecated 필드 제거**: dealerId, checkInTime, checkOutTime 완전 제거 (2025-01-17)
- **사용하지 않는 기능 제거**: AnnouncementsPage, HistoryPage 완전 삭제 (2025-01-17)
- **정산 시스템 단순화**: SimplePayrollPage 구현, Firebase Functions 제거로 90% 성능 개선
- **StaffCard 모듈화**: 658줄 → 407줄, 4개 컴포넌트 분리, 성능 37-44% 향상
- **대규모 클린업**: 의존성 69% 감소, 패키지 98개 제거
- **라이브러리 최적화**: react-icons → @heroicons/react, FullCalendar → LightweightCalendar

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
- **AttendanceStatusDropdown**: 출석 상태 직접 편집 (not_started, checked_in, checked_out)
- **StaffRow/StaffCard**: workLogs 데이터 우선 표시, staff 데이터는 fallback
  - **StaffCard 모듈화 완료 (2025-08-07)**: 
    - StaffCardHeader: 스태프 이름, 역할, 날짜 표시 (React.memo 최적화)
    - StaffCardTimeSection: 출/퇴근 시간 표시 및 편집 (React.memo 최적화)
    - StaffCardActions: 스와이프 액션 메뉴 (AttendanceStatusPopover 통합)
    - StaffCardContactInfo: 연락처 정보 및 공고 정보 (React.memo 최적화)
  - **공통 유틸리티 함수**: normalizeStaffDate, generateVirtualWorkLogId (코드 중복 제거)
- **실시간 훅들**: 모든 데이터 변경은 Firebase 구독으로 자동 반영

## 🏗️ 프로젝트 구조 가이드

### 주요 디렉토리 구조
```
T-HOLDEM/
├── app2/src/              # 메인 애플리케이션 소스
│   ├── components/        # 재사용 가능한 컴포넌트
│   │   ├── applicants/    # 지원자 관련 모듈화된 컴포넌트
│   │   ├── common/        # 공통 UI 컴포넌트
│   │   ├── jobPosting/    # 구인공고 관련 컴포넌트
│   │   ├── staff/         # 스태프 관련 모듈화된 컴포넌트 (2025-01-07)
│   │   │   ├── StaffCardHeader.tsx      # 66줄 - 헤더 정보 표시
│   │   │   ├── StaffCardTimeSection.tsx # 63줄 - 시간 관리 UI
│   │   │   ├── StaffCardActions.tsx     # 133줄 - 액션 메뉴 및 상태 변경
│   │   │   └── StaffCardContactInfo.tsx # 78줄 - 연락처 정보
│   │   └── payroll/       # 급여 관련 컴포넌트 (2025-01-17)
│   ├── pages/              
│   │   └── JobBoard/      # 모듈화된 구인공고 페이지
│   └── stores/            # Zustand 스토어 (3개)
├── docs/                  # 프로젝트 문서
│   └── PROJECT_STRUCTURE.md # 상세 구조도
├── SHRIMP/               # 태스크 관리 시스템
├── claude_set/           # SuperClaude 설정
└── scripts/              # 유틸리티 스크립트
```

> 📌 상세한 구조는 [docs/PROJECT_STRUCTURE.md](docs/PROJECT_STRUCTURE.md) 참조

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

- workLogUtils: 작업 로그 유틸리티 (src/utils/workLogUtils.ts) - 2025-08-07 추가
  - normalizeStaffDate: Firebase Timestamp, Date, string 통합 날짜 정규화
  - generateVirtualWorkLogId: 날짜별 고유 workLogId 생성
  - 코드 중복 제거 및 일관성 보장
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

## 🚨 개선 현황

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

8. **사용하지 않는 기능 제거** ✅ (2025-01-17 완료)
   - AnnouncementsPage 완전 삭제 (공지사항 기능)
   - HistoryPage 및 HistoryDetailPage 삭제 (기록 페이지)
   - 관련 아이콘 및 의존성 제거
   - 번들 크기 272.8KB 유지

### 개선 필요 사항
- ESLint 경고 해결 (약 70개)
- 테스트 커버리지 확대 (현재 10개 → 목표 70%)
- TournamentContext의 Zustand 마이그레이션
- SSR/SSG 도입 검토 (Next.js)

## 📊 프로젝트 성과

### 성능 지표
- **번들 크기**: 1.6MB → 272.8KB (84% 감소)
- **초기 로딩**: 3.5초 → 2.0초 (43% 개선)
- **Lighthouse 점수**: 68 → 91
- **TypeScript Strict Mode**: 100% 준수
- **의존성 관리**: 141개 → 43개 패키지 (69% 감소)



## 📚 기술 문서

### 프로젝트 문서
- **[서브에이전트 가이드](docs/CLAUDE_SUBAGENTS_GUIDE.md)**: Claude Code 서브에이전트 기능 및 사용법
- **[기능 명세서](docs/T-HOLDEM_기능명세서.md)**: T-HOLDEM 전체 기능 명세
- **[워크플로우](docs/T-HOLDEM_워크플로우.md)**: 운영 워크플로우 가이드
- **[프로젝트 구조](docs/PROJECT_STRUCTURE.md)**: 상세 디렉토리 구조

### 기술 가이드
- **[최적화 가이드](app2/docs/OPTIMIZATION_GUIDE.md)**: 번들 분석, 라이브러리 최적화
- **[마이그레이션 가이드](app2/docs/MIGRATION_GUIDES.md)**: TypeScript, 라이브러리 교체
- **[기술 보고서](app2/docs/TECHNICAL_REPORTS.md)**: 상태 관리 분석, 성능 측정

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

## 📝 프로젝트 메모리

### 핵심 원칙
- `항상 한글로 답변해줘`: 한국어로 응답
- `도구사용`: MCP, SUB AGENTS 적극 활용
- `실시간반영중시`: Firebase onSnapshot 구독으로 실시간 동기화

### 주요 완료 사항
- `TypeScript Strict Mode`: 100% 준수 완료
- `번들최적화`: 1.6MB → 261KB (84% 감소)
- `라이브러리교체`: FullCalendar, react-icons, react-dnd 완전 교체
- `모듈화완료`: StaffCard (658줄→407줄), JobBoardPage 등
- `정산시스템단순화`: SimplePayrollPage 구현
- `토너먼트참가자관리`: 칩 카운트, CSV 업로드 완료