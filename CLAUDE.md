# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 📌 프로젝트 개요

**T-HOLDEM**은 홀덤 포커 토너먼트 운영을 위한 종합 관리 플랫폼입니다.

- **프로젝트 ID**: tholdem-ebc18
- **배포 URL**: https://tholdem-ebc18.web.app
- **상태**: Production-Ready
- **주요 기능**: 토너먼트 운영, 스태프 관리, 구인공고 시스템, 실시간 출석 추적, 급여 정산

## 🛠️ 기술 스택

### Frontend
- **Framework**: React 18 + TypeScript (Strict Mode)
- **Styling**: Tailwind CSS
- **State**: Context API + Zustand
- **Table**: @tanstack/react-table
- **Icons**: @heroicons/react
- **DnD**: @dnd-kit
- **Date**: date-fns

### Backend & Infrastructure
- **Firebase**: Auth, Firestore, Functions, Storage, Performance
- **Monitoring**: Sentry
- **Testing**: Jest, React Testing Library
- **CI/CD**: GitHub Actions
- **Build**: Create React App

## 🚀 최근 업데이트 (2025-01-18)

### 완료된 작업
- ✅ **Firebase 마이그레이션**: dealerId → staffId, 시간 필드 표준화
- ✅ **코드 최적화**: 번들 크기 83% 감소 (1.6MB → 272.8KB)
- ✅ **TypeScript Strict**: 100% 준수
- ✅ **불필요 코드 제거**: 
  - 삭제된 페이지: AnnouncementsPage, HistoryPage, MigrationPage
  - 삭제된 유틸: compatibilityAdapter, dateUtilsSimple
  - 삭제된 훅: useStaffManagementV2
  - 삭제된 서비스: PersonMigrationService
- ✅ **UI/UX 개선**: 역할별 급여 설정, 정산 모달 개선

## 📁 프로젝트 구조

```
T-HOLDEM/
├── app2/src/
│   ├── components/        # UI 컴포넌트
│   │   ├── common/       # 공통 컴포넌트
│   │   ├── staff/        # 스태프 관련
│   │   ├── payroll/      # 급여 관련
│   │   ├── jobPosting/   # 구인공고 관련
│   │   └── applicants/   # 지원자 관련
│   ├── hooks/            # 커스텀 훅
│   ├── pages/            # 페이지 컴포넌트
│   ├── stores/           # Zustand 스토어
│   ├── types/            # TypeScript 타입
│   └── utils/            # 유틸리티 함수
├── docs/                 # 프로젝트 문서
├── scripts/              # 마이그레이션 스크립트
└── backup/               # Firestore 백업
```

## 🔥 Firebase 구조

### 핵심 컬렉션
- `staff`: 스태프 기본 정보
- `workLogs`: 근무 기록 (staffId, eventId, date, 시간)
- `attendanceRecords`: 출석 기록 (staffId, status)
- `jobPostings`: 구인공고 (title, location, hourlyWages)
- `applications`: 지원서
- `applicants`: 지원자 정보
- `tournaments`: 토너먼트
- `participants`: 참가자 (chipCount, tableNumber)
- `tables`: 테이블 정보

## 💡 개발 가이드

### 핵심 원칙
- **한글 응답**: 항상 한국어로 답변
- **실시간 동기화**: Firebase onSnapshot 사용
- **타입 안전성**: TypeScript strict mode 준수
- **에러 로깅**: 구조화된 logger 사용

### 주요 훅
- `useFirebaseCollection`: 범용 Firebase 컬렉션 관리
- `useStaffManagement`: 스태프 관리
- `useAttendanceStatus`: 출석 상태 관리
- `useEnhancedPayroll`: 급여 정산
- `usePersons`: 통합 인물 데이터
- `useJobPostingForm`: 구인공고 폼

### 주요 유틸리티
- `logger`: 구조화된 로깅
- `dateUtils`: 날짜 처리
- `workLogUtils`: 작업 로그 처리
- `dataTransformUtils`: 데이터 변환
- `firebasePerformance`: 성능 모니터링

## 📝 npm 스크립트

```bash
# 개발
npm start                # 개발 서버
npm run dev             # 에뮬레이터 + 개발 서버

# 빌드 & 배포
npm run build           # 프로덕션 빌드
npm run deploy:all      # Firebase 전체 배포

# 품질 관리
npm run lint            # ESLint 검사
npm run type-check      # TypeScript 체크
npm run test            # 테스트 실행

# Firebase 백업
npm run backup:admin    # Firestore 백업
npm run migrate:admin   # 데이터 마이그레이션
```

## ⚠️ 주의사항

### 절대 하지 말 것
- ❌ any 타입 사용
- ❌ console.log 직접 사용 (logger 사용)
- ❌ 수동 새로고침 (onSnapshot 사용)
- ❌ staff 컬렉션 시간 직접 업데이트 (workLogs 사용)

### 필수 구현 패턴
- ✅ Firebase onSnapshot 실시간 구독
- ✅ undefined/null 안전한 처리
- ✅ 메모이제이션 (useMemo, useCallback)
- ✅ 에러 처리 및 로깅

## 📊 성능 지표

- **번들 크기**: 272.8KB (gzipped)
- **초기 로딩**: 2.0초
- **Lighthouse**: 91점
- **의존성**: 43개 패키지

## 📚 문서

- [프로젝트 구조](docs/PROJECT_STRUCTURE.md)
- [Firebase 데이터 흐름](docs/FIREBASE_DATA_FLOW.md)
- [기능 명세서](docs/T-HOLDEM_기능명세서.md)
- [마이그레이션 가이드](scripts/firebase-migration/README.md)

## 🔄 진행 중인 작업

- ESLint 경고 해결 (약 70개)
- 테스트 커버리지 확대 (10% → 70%)
- TournamentContext Zustand 마이그레이션
- 모바일 반응형 UI 개선