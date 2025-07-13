# T-HOLDEM 프로젝트 AI 개발 규칙

## 프로젝트 개요

- **프로젝트명**: T-HOLDEM (홀덤 토너먼트 운영 플랫폼)
- **기술 스택**: React 18 + TypeScript + Firebase + Tailwind CSS
- **아키텍처**: SPA with Firebase Backend (Firestore + Functions + Auth)
- **핵심 기능**: 구인구직, 급여 관리, 교대 스케줄, 토너먼트 운영

## 필수 디렉토리 구조 규칙

### React 애플리케이션 (app2/)
- **app2/src/pages/**: 페이지 컴포넌트 (admin/, staff/ 하위 디렉토리로 역할별 분리)
- **app2/src/components/**: 재사용 가능한 컴포넌트
- **app2/src/components/tabs/**: 탭 기반 컴포넌트 모음
- **app2/src/hooks/**: 커스텀 훅 (use로 시작하는 명명 규칙)
- **app2/src/contexts/**: React Context (AuthContext, ToastContext, TournamentContext)
- **app2/src/types/**: TypeScript 타입 정의 파일
- **app2/src/utils/**: 유틸리티 함수 및 헬퍼
- **app2/public/locales/**: 다국어 번역 파일 (ko/, en/)

### Firebase 백엔드 (functions/)
- **functions/src/**: Cloud Functions 소스코드
- **functions/test/**: 함수 테스트 코드

## 타입 정의 우선 개발 규칙

### 새로운 기능 개발시 순서
1. **타입 정의 먼저**: app2/src/types/에서 인터페이스 정의
2. **Firebase 스키마**: Firestore 컬렉션 구조 설계
3. **컴포넌트 구현**: 타입 안전성 보장하며 구현
4. **번역 키 추가**: 다국어 지원 필수

### 타입 정의 규칙
- **인터페이스 명명**: PascalCase 사용 (예: JobPosting, UserProfile)
- **Firebase 타입**: Timestamp 처리를 위한 any 타입 허용
- **하위 호환성**: 기존 데이터 구조 파괴 금지
- **선택적 필드**: 새 필드는 optional(?:) 사용

## Firebase 사용 필수 규칙

### Firestore 컬렉션 표준
- **users**: 사용자 프로필 및 인증 정보
- **events**: 토너먼트 이벤트
- **jobPostings**: 구인 공고
- **applications**: 지원 내역
- **shiftSchedules**: 교대 스케줄
- **workLogs**: 근무 기록

### Firebase 타입 안전성 규칙
- **Timestamp 변환**: 직접 사용 금지, 변환 함수 필수 사용
- **실시간 동기화**: useCollection 훅 사용
- **에러 처리**: try-catch 블록 및 Toast 메시지 필수

### Firebase Functions 규칙
- **함수 명명**: camelCase 사용 (예: recordAttendance, logAction)
- **CORS 설정**: 프론트엔드 도메인 허용 필수
- **인증 검증**: 모든 민감한 함수에서 사용자 인증 확인

## 역할 기반 접근 제어 필수 규칙

### 역할 분류 (role 필드)
- **admin**: 전체 시스템 관리 권한
- **manager**: 이벤트 및 스태프 관리 권한  
- **staff**: 개인 업무 및 출석 관리 권한

### 라우팅 보안 규칙
- **PrivateRoute**: 로그인 필수 페이지에 사용
- **RoleBasedRoute**: 역할별 접근 제한 페이지에 사용
- **권한 검증**: useAuth 훅의 isAdmin, currentUser 활용

### 페이지 접근 권한
- **admin/**: admin 역할만 접근 가능
- **staff/**: staff, manager, admin 역할 접근 가능
- **공통 페이지**: 모든 로그인 사용자 접근 가능

## 다국어 지원 필수 규칙

### 번역 파일 구조
- **app2/public/locales/ko/translation.json**: 한국어 (기본)
- **app2/public/locales/en/translation.json**: 영어

### 번역 사용 규칙
- **useTranslation 훅**: const { t } = useTranslation() 필수
- **번역 키 사용**: t('keyName') 형태로 사용
- **하드코딩 금지**: 직접 텍스트 작성 절대 금지
- **키 명명 규칙**: 점(.) 표기법 사용 (예: 'jobBoard.apply.title')

### 번역 키 추가 순서
1. **한국어 번역 먼저**: ko/translation.json에 추가
2. **영어 번역 후**: en/translation.json에 동일 키 추가
3. **컴포넌트 적용**: t() 함수로 사용

## 반응형 디자인 필수 규칙

### Tailwind CSS 사용 규칙
- **모바일 우선**: 기본 스타일 → sm: → md: → lg: 순서
- **그리드 시스템**: grid-cols-1 md:grid-cols-2 lg:grid-cols-3 패턴
- **버튼 크기**: 모바일에서 최소 48px 높이 (min-h-[48px])
- **모달 크기**: 모바일에서 전체 너비, 데스크톱에서 적절한 최대 너비

### 모달 반응형 규칙
- **모바일**: w-full max-w-[95%] min-h-[80vh]
- **태블릿**: max-w-2xl 
- **데스크톱**: max-w-4xl max-h-[90vh]

## 컴포넌트 개발 필수 규칙

### 컴포넌트 구조 규칙
- **함수형 컴포넌트**: React.FC 타입 사용 선택적
- **Props 인터페이스**: 컴포넌트별 Props 인터페이스 정의
- **기본값 설정**: defaultProps 또는 ES6 기본 매개변수 사용
- **메모이제이션**: React.memo 적절히 활용

### 커스텀 훅 규칙
- **명명 규칙**: use로 시작 (예: useAuth, useToast)
- **의존성 배열**: useEffect, useMemo, useCallback 의존성 정확히 명시
- **에러 처리**: 훅 내부에서 에러 상태 관리

### 상태 관리 규칙
- **로컬 상태**: useState 사용
- **전역 상태**: React Context 사용 (AuthContext, ToastContext)
- **서버 상태**: react-firebase-hooks 사용

## 에러 처리 및 사용자 경험 규칙

### Toast 메시지 규칙
- **성공 메시지**: useToast 훅의 showToast('message', 'success')
- **에러 메시지**: useToast 훅의 showToast('message', 'error')  
- **로딩 상태**: LoadingSpinner 컴포넌트 사용
- **사용자 친화적**: 기술적 오류 메시지 대신 이해하기 쉬운 메시지

### 폼 검증 규칙
- **실시간 검증**: onChange 이벤트에서 검증
- **제출 전 검증**: onSubmit에서 최종 검증
- **에러 표시**: 필드별 에러 메시지 표시
- **비활성화**: 검증 실패시 제출 버튼 비활성화

## 데이터 호환성 유지 규칙

### 기존 데이터 보호
- **필드 추가**: 기존 필드 유지하며 새 필드는 optional
- **타입 변경**: 기존 타입과 호환 가능한 형태로만 변경
- **마이그레이션**: 데이터 구조 변경시 마이그레이션 스크립트 필요

### 하위 호환성 패턴
- **다중 선택 지원**: 기존 단일 선택 + 새로운 다중 선택 동시 지원
- **타입 체크**: JobPostingUtils.hasMultipleSelections() 같은 유틸리티 사용
- **폴백 처리**: 새 필드 없을 때 기존 필드 사용하는 로직

## 멀티파일 조정 필수 규칙

### 타입 정의 수정시
1. **app2/src/types/**: 타입 인터페이스 수정
2. **관련 컴포넌트**: 타입 사용하는 모든 컴포넌트 업데이트
3. **번역 파일**: 새로운 필드에 대한 번역 키 추가

### 새로운 페이지 추가시
1. **app2/src/pages/**: 페이지 컴포넌트 생성
2. **app2/src/App.tsx**: 라우팅 설정 추가
3. **app2/src/components/Layout.tsx**: 네비게이션 메뉴 추가
4. **RoleBasedRoute**: 필요시 권한 설정

### API/Firebase Functions 변경시
1. **functions/src/**: Cloud Functions 수정
2. **프론트엔드**: 함수 호출 부분 업데이트
3. **타입 정의**: 요청/응답 타입 업데이트

## 절대 금지 사항

### 보안 관련 금지사항
- **클라이언트 권한 검증 의존**: 서버에서 권한 재검증 필수
- **민감 정보 로깅**: 개인정보, 인증 토큰 로그 출력 금지
- **하드코딩된 시크릿**: API 키, 비밀번호 코드에 포함 금지

### 데이터 관련 금지사항
- **직접 Timestamp 사용**: Firebase Timestamp 변환 함수 사용 필수
- **undefined Firebase 저장**: undefined 값 Firestore 저장 금지
- **타입 안전성 무시**: any 타입 남용 금지

### UI/UX 관련 금지사항
- **하드코딩된 텍스트**: 다국어 지원 위반하는 직접 텍스트 금지
- **접근성 무시**: 키보드 내비게이션, 스크린 리더 고려 필수
- **모바일 미고려**: 데스크톱만 고려한 UI 금지

## 파일 명명 및 구조 규칙

### 파일 명명 규칙
- **컴포넌트**: PascalCase.tsx (예: JobBoardPage.tsx)
- **훅**: camelCase.ts (예: useAuth.ts)
- **유틸리티**: camelCase.ts (예: timeUtils.ts)
- **타입**: camelCase.ts (예: jobPosting.ts)

### 컴포넌트 내부 구조
- **Import 순서**: React → 라이브러리 → 프로젝트 내부
- **인터페이스 정의**: 컴포넌트 위에 Props 인터페이스 정의
- **스타일**: Tailwind CSS 클래스 사용, 인라인 스타일 최소화

## 성능 최적화 규칙

### React 최적화
- **불필요한 리렌더링**: React.memo, useMemo, useCallback 적절히 사용
- **키 속성**: 리스트 렌더링시 고유한 key 속성 필수
- **코드 분할**: React.lazy로 필요시 동적 import

### Firebase 최적화
- **쿼리 최적화**: where 절 사용하여 필요한 데이터만 조회
- **인덱스 활용**: 복합 쿼리시 Firestore 인덱스 설정
- **실시간 리스너**: 필요한 경우만 실시간 업데이트 사용

---

**마지막 업데이트**: 2025년 1월
**적용 범위**: T-HOLDEM 프로젝트 전체
**준수 의무**: AI 에이전트 필수 준수