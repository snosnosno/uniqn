# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

T-HOLDEM is a comprehensive web-based platform for managing Hold'em poker tournaments and operations. Built with React 18 + TypeScript + Firebase, it provides real-time dealer shift management, QR code attendance tracking, staff management, job posting system, tournament operations, payroll processing, and comprehensive administrative features.

### 🛠️ 기술 스택
- **Frontend**: React 18, TypeScript, Tailwind CSS
- **Backend**: Firebase (Auth, Firestore, Functions, Storage)
- **State Management**: Context API (Auth, Tournament, Toast, JobPosting)
- **Performance**: React Window (가상화), useMemo/useCallback 최적화
- **Testing**: Jest, React Testing Library (확장 필요)
- **Build**: Create React App, PostCSS

## 🔥 최근 주요 업데이트 (2025-01-28)

### 스태프 관리 시스템 고도화 완료
- **날짜별 개별 시간 관리**: workLogs 컨렉션 기반으로 각 날짜별 독립적 시간 설정 가능
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
- **타입 안전성**: TypeScript 인터페이스 확장 시 dealerId/staffId 호환성 유지
- **디버깅**: 한국어 로그와 상세한 console.log로 투명한 디버깅

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
- **시간 수정 시 출석 상태 자동 변경 금지**: actualStartTime/actualEndTime 설정 금지
- **수동 새로고침 사용 금지**: onSnapshot 구독으로 실시간 동기화 필수
- **staff 컬렉션 시간 업데이트 금지**: 날짜별 독립성을 위해 workLogs만 사용
- **API 키 하드코딩 금지**: Firebase 설정은 환경 변수로 관리
- **any 타입 남발 금지**: 구체적인 타입 정의 필수

### 필수 구현 패턴
- **실시간 구독**: `onSnapshot(query, callback)` 패턴 사용
- **한국어 로깅**: 모든 console.log는 한국어로 명확하게 작성
- **타입 안전성**: dealerId/staffId 호환성 유지, any 타입 제거
- **UI 직관성**: 클릭 편집, 드롭다운 선택, '미정' 상태 표시
- **성능 최적화**: useMemo/useCallback 활용, 가상화 적용
- **코드 분할**: React.lazy()로 주요 라우트 동적 임포트

## 🚨 보안 및 성능 개선 사항 (Critical)

### 즉시 적용 필요 (1-2주)
1. **환경 변수 설정**
   - Firebase API 키를 .env 파일로 이동
   - `REACT_APP_FIREBASE_API_KEY` 등 환경 변수 사용
   
2. **타입 안전성 강화**
   - any 타입을 구체적 인터페이스로 교체
   - tsconfig.json에 strict 모드 활성화

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

### 개선 필요
- any 타입 과다 사용 (50+ 인스턴스)
- React.lazy 미사용 (1개 파일만 사용)
- 환경 변수 미설정 (API 키 노출)
- 테스트 파일 부족

## Memories

- `항상 한글로 답변해줘`: 클로드와의 대화에서 한국어로 응답하도록 요청하는 메모
- `도구사용`: 사용가능한 MCP, SUB AGENTS 모두 적극 사용
- `실시간반영중시`: Firebase onSnapshot 구독으로 즉시 UI 업데이트, 수동 새로고침 제거
- `날짜별시간관리`: workLogs 컬렉션 기반으로 각 날짜별 독립적인 시간 설정 시스템 구현 완료
- `출석상태분리`: 시간 수정과 출석 상태를 완전 분리, AttendancePopover으로 관리
- `workLogs우선`: workLogs 데이터를 staff 데이터보다 우선하여 날짜별 독립성 보장
- `타입안전성강화필요`: any 타입 제거 및 strict TypeScript 설정 필요
- `환경변수설정필요`: Firebase API 키 등 민감 정보 보호 필요
- `코드분할필요`: 주요 라우트 동적 임포트로 초기 로딩 개선 필요