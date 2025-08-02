# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

T-HOLDEM is a comprehensive web-based platform for managing Hold'em poker tournaments and operations. Built with React 18 + TypeScript + Firebase, it provides real-time dealer shift management, QR code attendance tracking, staff management, job posting system, tournament operations, payroll processing, and comprehensive administrative features.

### 🛠️ 기술 스택
- **Frontend**: React 18, TypeScript (Strict Mode), Tailwind CSS
- **Backend**: Firebase (Auth, Firestore, Functions, Storage)
- **State Management**: Context API (Auth, Tournament, Toast, JobPosting), Zustand (마이그레이션 진행중)
- **Performance**: React Window (가상화), useMemo/useCallback 최적화, Code Splitting, 성능 모니터링 시스템
- **Testing**: Jest, React Testing Library (확장 필요)
- **Build**: Create React App, PostCSS
- **타입 시스템**: TypeScript Strict Mode (`strict: true`, `exactOptionalPropertyTypes: true`, `noUncheckedIndexedAccess: true`)
- **로깅**: 구조화된 로깅 시스템 (5단계 레벨, 컨텍스트 기반)
- **보안**: CSP, XSS 방지 (DOMPurify), CSRF 토큰
- **모니터링**: PerformanceMonitor (Web Vitals, 번들 크기, 메모리 사용량)

## 🔥 최근 주요 업데이트 (2025-01-31)

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
  - 실시간 성능 보고서 페이지 (/admin/performance)
  - 컴포넌트별 렌더링 성능 추적

### 구조화된 로깅 시스템 도입 (2025-01-31)
- **console.log 완전 제거**: 316개 파일의 모든 console.log를 구조화된 logger로 교체
- **로깅 시스템 구현**:
  - 5단계 로그 레벨: DEBUG 🔍, INFO ℹ️, WARN ⚠️, ERROR ❌, CRITICAL 🚨
  - 환경별 동작: 개발(컬러 콘솔), 프로덕션(서버 전송)
  - 상세 컨텍스트: component, userId, operation 등 40+ 필드
  - 성능 측정 및 에러 추적 내장
- **사용 패턴**:
  ```typescript
  // 기존: console.log('메시지', data);
  // 변경: logger.debug('메시지', { component: 'ComponentName', data });
  
  // 에러 처리
  logger.error('오류 발생', error, { component: 'Component' });
  
  // 성능 측정
  await logger.withPerformanceTracking(
    async () => await operation(),
    'Operation Name'
  );
  ```

### TypeScript Strict Mode 마이그레이션 완료
- **tsconfig.json 설정 강화**:
  ```json
  {
    "strict": true,
    "exactOptionalPropertyTypes": true,
    "noUncheckedIndexedAccess": true
  }
  ```
- **타입 안전성 개선**:
  - 모든 any 타입 제거 및 구체적인 인터페이스 정의
  - 배열/객체 접근 시 undefined 체크 필수화
  - 조건부 spread 패턴으로 optional property 처리
- **주요 패턴 적용**:
  ```typescript
  // 배열 접근 안전성
  const value = array[index] || defaultValue;
  
  // split() 결과 안전 처리
  const parts = str.split(':');
  const hour = parts[0] || '0';
  
  // 조건부 속성 처리
  const props = {
    ...baseProps,
    ...(optionalValue && { optionalProp: optionalValue })
  };
  ```

### 출석 관리 시스템 개선 (2025-01-31)
- **자동 상태 변경 기능 제거**: 퇴근시간 설정 시 자동 퇴근 상태 변경 기능 제거 (사용자 요청)
- **실시간 반영 개선**:
  - StaffRow memo 비교 함수 최적화로 상태 변경 즉시 반영
  - 새로고침 없이 모든 출석 상태 변경 실시간 업데이트
- **출근 시간 표시 수정**:
  - useStaffManagement의 workLogsMap 생성 로직 수정 (dealerId 사용)
  - 출근 상태일 때 "출근: HH:MM" 형식으로 실제 시간 정확히 표시

### 스태프 관리 시스템 고도화 완료
- **날짜별 개별 시간 관리**: workLogs 컬렉션 기반으로 각 날짜별 독립적 시간 설정 가능
- **실시간 데이터 동기화**: Firebase onSnapshot을 통한 즉시 UI 반영
- **출석 상태 분리 관리**: 시간 수정과 출석 상태를 완전 분리, AttendanceStatusDropdown으로 직접 편집
- **UI 개선**: '시간' 열을 '출근'/'퇴근' 분리, '미정' 상태 표시, 드롭다운 시간 선택

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

### Firebase Collections 구조
```
- staff: 스태프 기본 정보 (이름, 연락처, 역할 등)
- workLogs: 날짜별 개별 근무 기록 (scheduledStartTime/EndTime, actualStartTime/EndTime)
- attendanceRecords: 출석 상태 및 실시간 추적
- jobPostings: Initialize 공고 정보
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

### 즉시 적용 필요 (1-2주)
1. **환경 변수 설정**
   - Firebase API 키를 .env 파일로 이동
   - `REACT_APP_FIREBASE_API_KEY` 등 환경 변수 사용
   
2. **타입 안전성 강화** ✅ (2025-01-30 완료)
   - ~~any 타입을 구체적 인터페이스로 교체~~
   - ~~tsconfig.json에 strict 모드 활성화~~
   - TypeScript strict mode 마이그레이션 완료

### 중기 개선 사항 (2-4주)
1. **코드 분할 구현**
   ```typescript
   const JobBoardPage = lazy(() => import('./pages/JobBoardPage'));
   const AdminDashboard = lazy(() => import('./pages/admin/DashboardPage'));
   ```

2. **Firebase 쿼리 최적화**
   - 복합 인덱스 추가로 쿼리 성능 개선
   - 불필요한 실시간 구독 정리

3. **상태 관리 개선**
   - Context API 과다 사용 검토
   - 필요시 Zustand/Jotai 도입 고려

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

### 개선 완료 ✅
- ~~any 타입 과다 사용~~ → TypeScript strict mode로 해결
- ~~큰 라이브러리 의존성~~ → 경량 컴포넌트로 교체
  - FullCalendar → LightweightCalendar (96% 크기 감소)
  - react-data-grid → LightweightDataGrid (85% 크기 감소)
  - react-icons → 커스텀 SVG 아이콘 (92% 크기 감소)
- ~~Context API 성능 이슈~~ → Zustand 마이그레이션 준비
- ~~console.log 사용~~ → 구조화된 logger 시스템으로 완전 교체 (316개 파일)
- ~~CEO 대시보드 성능~~ → 실시간 구독 9개 → 5개로 최적화 (44% 감소)
- ~~보안 취약점~~ → CSP, XSS 방지, CSRF 보호 구현 완료

### 개선 필요
- 환경 변수 미설정 (API 키 노출) ⚠️ **[최우선]**
- 테스트 커버리지 부족 (~15%) → 목표 70%
- CI/CD 파이프라인 부재
- SSR/SSG 도입 검토 (Next.js)
- 에러 모니터링 도구 필요 (Sentry 등)

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

## 📋 구인공고 시스템 개선 (2025-01-31)

### 🎯 개선 완료 사항

#### 1. 날짜 표시 형식 개선
- **이전**: 2025-08-01 형식의 긴 날짜 표시
- **개선**: 08-01(금) 형식의 간결하고 직관적인 표시
- **효과**: 사용자가 날짜를 더 빠르게 인식하고, 요일 정보로 일정 파악이 용이해짐

#### 2. 확정 인원 실시간 표시
- **구인공고 게시판**: 각 역할별로 "딜러: 3명 (1/3)", "플로어: 1명 (1/1 - 마감)" 형식으로 모집 현황 한눈에 파악
- **공고 상세 관리**: 날짜별, 시간대별로 세분화된 인원 현황 표시
- **지원자 목록**: 각 지원자별로 선택 가능한 시간대와 마감 여부 실시간 표시

#### 3. 마감 상태 자동 관리
- 모집 인원이 다 찬 역할은 자동으로 "마감" 표시
- 지원자가 선택할 수 없도록 비활성화 처리
- 확정 취소 시 자동으로 마감 해제되어 다시 지원 가능

### 💡 사용자 경험 개선

#### 1. 운영자 편의성
- 각 공고의 모집 현황을 목록에서 바로 확인 가능
- 어떤 날짜/시간/역할이 부족한지 즉시 파악
- 확정/취소 작업이 실시간으로 반영되어 수동 새로고침 불필요

#### 2. 지원자 편의성
- 마감된 포지션이 명확히 표시되어 헛수고 방지
- 남은 자리 수를 보고 지원 우선순위 결정 가능
- 날짜와 요일이 함께 표시되어 일정 조율 용이

#### 3. 데이터 정확성
- Firebase Timestamp와 문자열 날짜 형식 간 호환성 문제 해결
- 모든 페이지에서 일관된 데이터 표시
- 실시간 동기화로 항상 최신 정보 제공

### 🔧 기술적 개선사항
- TypeScript strict mode 준수로 타입 안전성 강화
- Firebase Timestamp 변환 로직을 공통 유틸리티로 통합하여 일관성 확보
- 날짜 형식 변환 유틸리티로 코드 재사용성 향상
- 사용하지 않는 import 및 변수 제거로 코드 품질 개선

## 🚧 앞으로의 개발 방향

### 단기 목표 (1-2주)
1. **환경 변수 설정** 🔴 [긴급]
   ```bash
   # .env.local 파일 생성
   REACT_APP_FIREBASE_API_KEY=your-api-key
   REACT_APP_FIREBASE_AUTH_DOMAIN=your-auth-domain
   REACT_APP_FIREBASE_PROJECT_ID=your-project-id
   ```

2. **테스트 인프라 구축**
   - 주요 컴포넌트 단위 테스트 작성
   - 통합 테스트 추가
   - 테스트 커버리지 70% 달성

3. **CI/CD 파이프라인**
   - GitHub Actions 설정
   - 자동 빌드 및 테스트
   - 자동 배포 프로세스

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

## 🔑 개발 체크리스트

### 새로운 기능 개발 시
- [ ] TypeScript strict mode 준수 (any 타입 사용 금지)
- [ ] 구조화된 logger 사용 (console.log 금지)
- [ ] Firebase 실시간 구독 사용 (onSnapshot)
- [ ] 메모이제이션 적용 (useMemo, useCallback)
- [ ] 에러 처리 및 로깅
- [ ] 테스트 코드 작성
- [ ] 성능 측정 및 최적화

### 코드 리뷰 체크포인트
- [ ] 타입 안전성 검증
- [ ] 성능 영향 평가
- [ ] 보안 취약점 검사
- [ ] 접근성 준수 확인
- [ ] 코드 가독성 및 유지보수성

## Memories

- `항상 한글로 답변해줘`: 클로드와의 대화에서 한국어로 응답하도록 요청하는 메모
- `도구사용`: 사용가능한 MCP, SUB AGENTS 모두 적극 사용
- `실시간반영중시`: Firebase onSnapshot 구독으로 즉시 UI 업데이트, 수동 새로고침 제거
- `날짜별시간관리`: workLogs 컬렉션 기반으로 각 날짜별 독립적인 시간 설정 시스템 구현 완료
- `출석상태분리`: 시간 수정과 출석 상태를 완전 분리, AttendancePopover으로 관리
- `출석자동변경제거`: 퇴근시간 설정 시 자동 상태 변경 기능 제거 (2025-01-31)
- `workLogs우선`: workLogs 데이터를 staff 데이터보다 우선하여 날짜별 독립성 보장
- `타입안전성강화완료`: TypeScript strict mode 적용 완료 (2025-01-30)
- `번들최적화완료`: 주요 라이브러리 교체로 44% 크기 감소 (2025-01-31)
- `환경변수설정필요`: Firebase API 키 등 민감 정보 보호 필요 ⚠️
- `테스트커버리지개선필요`: 현재 15% → 목표 70%
- `logger시스템도입완료`: console.log 316개 → 구조화된 logger로 완전 교체 (2025-01-31)
- `성능모니터링구축완료`: PerformanceMonitor 유틸리티 및 보고서 페이지 구현 (2025-01-31)
- `보안강화완료`: CSP, XSS 방지, CSRF 토큰 구현 (2025-01-31)