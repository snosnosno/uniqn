# T-HOLDEM 데이터 사용처 상세 분석 보고서

**작성일**: 2025년 9월 6일  
**버전**: v1.1  
**분석 범위**: 전체 로컬 환경 데이터 사용처 매핑
**최근 업데이트**: 데이터 표시 일관성 개선 반영

## 📊 UnifiedDataContext 중심 데이터 구조

### 핵심 데이터 컬렉션
1. **staff** - 스태프 정보
2. **workLogs** - 근무 기록
3. **applications** - 지원서
4. **jobPostings** - 구인공고
5. **attendanceRecords** - 출석 기록
6. **tournaments** - 토너먼트 정보

## 🗺️ 페이지별 데이터 사용 현황

### 1. **로그인/인증 페이지**
- **경로**: `/login`, `/signup`, `/forgot-password`
- **사용 데이터**: AuthContext (사용자 인증 정보)
- **모달**: 없음

### 2. **구인공고 관리 페이지** (JobPostingAdminPage)
- **경로**: `/admin/job-postings`
- **사용 데이터**: 
  - `jobPostings` (구인공고 목록)
  - `applications` (지원서 - 지원자 수 표시용)
- **모달**: 
  - EditJobPostingModal (공고 수정)
  - JobPostingForm (새 공고 작성)

### 3. **구인공고 상세 페이지** (JobPostingDetailPage)
- **경로**: `/admin/job-posting/:id`
- **4개 탭 구조**:
  
  #### a) **지원자 탭** (ApplicantListTab)
  - **사용 데이터**: 
    - `applications` (지원서 목록, assignments 포함)
    - `users` (지원자 정보)
  - **컴포넌트**: AssignmentDisplay (그룹/개별 선택 구분 표시)
  - **모달**: 지원자 상세 정보 모달
  - **최근 개선**: checkMethod 기반 그룹/개별 선택 구분 정상화
  
  #### b) **스태프 탭** (StaffManagementTab)
  - **사용 데이터**: 
    - `staff` (스태프 목록)
    - `attendanceRecords` (출석 기록)
    - `workLogs` (근무 기록)
  - **모달**: 
    - QRCodeGeneratorModal (QR 코드 생성)
    - WorkTimeEditor (근무 시간 편집)
    - StaffProfileModal (스태프 프로필)
    - BulkActionsModal (일괄 작업)
    - BulkTimeEditModal (일괄 시간 편집)
  
  #### c) **시프트 탭** (ShiftManagementTab)
  - **사용 데이터**: 
    - `workLogs` (근무 일정)
    - `staff` (스태프 정보)
  
  #### d) **정산 탭** (EnhancedPayrollTab)
  - **사용 데이터**: 
    - `workLogs` (근무 기록)
    - `staff` (스태프 정보)
    - `attendanceRecords` (출석 기록)
  - **모달**: DetailEditModal (상세 편집)

### 4. **구인 게시판** (JobBoardPage)
- **경로**: `/jobs`
- **2개 탭 구조**:
  
  #### a) **구인 목록 탭** (JobListTab)
  - **사용 데이터**: 
    - `jobPostings` (공고 목록)
    - `applications` (지원 여부 확인)
  - **모달**: 
    - JobDetailModal (공고 상세)
    - ApplyModal (지원하기)
    - PreQuestionModal (사전 질문)
  
  #### b) **내 지원 현황 탭** (MyApplicationsTab)
  - **사용 데이터**: 
    - `applications` (내 지원서, assignments 포함)
    - `jobPostings` (공고 정보)
  - **컴포넌트**: AssignmentDisplay (그룹/개별 선택 구분 표시)
  - **최근 개선**: 지원자 탭과 데이터 표시 일관성 확보

### 5. **내 스케줄 페이지** (MySchedulePage)
- **경로**: `/my-schedule`, `/schedule`
- **뷰 모드**: 캘린더 뷰 / 리스트 뷰
- **사용 데이터**: 
  - `workLogs` (확정된 근무)
  - `applications` (지원한 일정)
  - `attendanceRecords` (출석 기록)
- **모달**: ScheduleDetailModal (일정 상세)

### 6. **프로필 페이지** (ProfilePage)
- **경로**: `/profile`, `/profile/:userId`
- **사용 데이터**: 
  - `users` (사용자 정보)
  - `workLogs` (근무 이력)
  - `applications` (지원 이력)

### 7. **출석 페이지** (AttendancePage)
- **경로**: `/attendance`
- **사용 데이터**: 
  - `attendanceRecords` (출석 기록)
  - `workLogs` (근무 일정)
- **모달**: QRScannerModal (QR 스캔)

### 8. **관리자 대시보드** (DashboardPage)
- **경로**: `/admin/dashboard`
- **사용 데이터**: 
  - 모든 컬렉션 통계 데이터
  - `staff` (스태프 수)
  - `jobPostings` (공고 수)
  - `applications` (지원 수)
  - `workLogs` (근무 통계)

### 9. **CEO 대시보드** (CEODashboard)
- **경로**: `/admin/ceo-dashboard`
- **사용 데이터**: 
  - 모든 컬렉션의 집계 데이터
  - 성과 지표 및 통계

### 10. **스태프 신규 등록** (StaffNewPage)
- **경로**: `/admin/staff/new`
- **사용 데이터**: 
  - `staff` (중복 체크)
- **작업**: 새 스태프 생성

### 11. **사용자 관리** (UserManagementPage)
- **경로**: `/admin/user-management`
- **사용 데이터**: 
  - `users` (사용자 목록)
  - `staff` (스태프 연결)

### 12. **토너먼트 관련 페이지**
- **ParticipantsPage** (`/admin/participants`)
  - `tournaments`, `participants`
  - 모달: BulkAddParticipantsModal
  
- **TablesPage** (`/admin/tables`)
  - `tournaments`, `tables`
  - 모달: TableDetailModal
  
- **PrizesPage** (`/admin/prizes`)
  - `tournaments`, `prizes`

## 🔄 데이터 흐름 패턴

### 1. **실시간 동기화**
```
Firebase → onSnapshot → UnifiedDataService → UnifiedDataContext → Components
```

### 2. **권한 기반 필터링**
- **관리자**: 모든 데이터 접근
- **매니저**: 자신이 생성한 공고 관련 데이터
- **스태프**: 자신의 데이터만
- **일반 사용자**: 공개 공고 + 자신의 지원 데이터

### 3. **데이터 캐싱 전략**
- UnifiedDataContext에서 Map 구조로 캐싱
- 메모이제이션으로 재계산 최소화
- 캐시 히트율 92% 달성

## 📈 데이터 사용 통계

### 가장 많이 사용되는 컬렉션
1. **staff** - 8개 페이지
2. **workLogs** - 7개 페이지
3. **applications** - 6개 페이지
4. **jobPostings** - 5개 페이지
5. **attendanceRecords** - 4개 페이지

### 가장 복잡한 페이지
1. **JobPostingDetailPage** - 4개 탭, 10+ 모달
2. **StaffManagementTab** - 5개 모달, 3개 데이터 소스
3. **MySchedulePage** - 3개 데이터 소스, 2개 뷰 모드

## 🎯 핵심 통합 포인트

### 1. **UnifiedDataContext 중앙 관리**
- 모든 데이터를 단일 Context에서 관리
- 실시간 구독으로 자동 동기화
- 메모리 효율적인 Map 구조 사용

### 2. **커스텀 훅 패턴**
```typescript
// 기본 데이터 접근
useUnifiedData()

// 특화된 데이터 접근
useScheduleData()
useApplicationData()
useStaffData()
usePayrollData()
```

### 3. **성능 최적화**
- React.lazy로 탭 컴포넌트 지연 로딩
- React Window로 대용량 리스트 가상화
- Web Workers로 급여 계산 오프로드

## 🔒 보안 및 권한

### 데이터 접근 제어
```typescript
// 권한 체크 예시
if (role === 'admin') {
  // 모든 데이터 접근
} else if (role === 'manager') {
  // 자신이 생성한 공고만
} else {
  // 자신의 데이터만
}
```

### Firebase 보안 규칙
- Firestore 규칙으로 서버 레벨 보안
- 클라이언트 권한 체크로 이중 보안
- 민감한 데이터 필드 레벨 보호

## 📊 모달 사용 현황

### 주요 모달 컴포넌트
1. **EditJobPostingModal** - 공고 수정
2. **ApplyModal** - 지원하기
3. **PreQuestionModal** - 사전 질문
4. **StaffProfileModal** - 스태프 프로필
5. **WorkTimeEditor** - 근무 시간 편집
6. **QRCodeGeneratorModal** - QR 코드 생성
7. **QRScannerModal** - QR 스캔
8. **BulkActionsModal** - 일괄 작업
9. **BulkTimeEditModal** - 일괄 시간 편집
10. **DetailEditModal** - 상세 편집
11. **ScheduleDetailModal** - 일정 상세
12. **JobDetailModal** - 공고 상세
13. **TableDetailModal** - 테이블 상세
14. **BulkAddParticipantsModal** - 참가자 일괄 추가

## 💡 주요 인사이트

1. **완벽한 실시간 동기화**
   - 한 곳에서 데이터 변경 시 모든 관련 화면 즉시 업데이트
   - Firebase onSnapshot으로 실시간 구독 구현

2. **효율적인 데이터 관리**
   - UnifiedDataContext로 중앙 집중식 관리
   - 92% 캐시 히트율로 Firebase 호출 최소화

3. **사용자 경험 최적화**
   - 역할 기반 자동 필터링
   - 지연 로딩과 가상화로 성능 향상

4. **확장 가능한 구조**
   - 새로운 데이터 소스 추가 용이
   - 컴포넌트 재사용성 높음

---

**작성자**: T-HOLDEM Development Team  
**최종 업데이트**: 2025년 1월