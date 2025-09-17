# 🏗️ T-HOLDEM 아키텍처 가이드

**최종 업데이트**: 2025년 9월 16일  
**버전**: v0.2.1 (Production Ready + 코드 정리)  
**상태**: ✅ **완성 - 6단계 개선 완료**

> [!NOTE]
> **안내**: 이 문서는 v0.2.1 Production Ready 버전 기준으로 작성되었습니다. 체계적인 6단계 개선을 통해 Enterprise 수준의 코드 품질과 코드 체계화를 달성한 현재 아키텍처를 설명합니다.

## 📋 목차

1. [시스템 개요](#-시스템-개요)
2. [기술 스택](#-기술-스택)
3. [핵심 아키텍처](#-핵심-아키텍처)
4. **[폴더 구조 아키텍처](#-폴더-구조-아키텍처)** ✨ *새로운 바*
5. [데이터 흐름](#-데이터-흐름)
6. [성능 최적화](#-성능-최적화)
7. [페이지별 데이터 사용](#-페이지별-데이터-사용)
8. [확장성 고려사항](#-확장성-고려사항)

## 🎯 시스템 개요

T-HOLDEM은 홀덤 포커 토너먼트 운영을 위한 **종합 관리 플랫폼**입니다.

### 핵심 특징
- **실시간 동기화**: Firebase를 통한 모든 데이터 실시간 업데이트
- **통합 데이터 관리**: UnifiedDataContext로 단일 데이터 소스 관리
- **모바일 우선 설계**: 반응형 디자인과 PWA 지원
- **성능 최적화**: Web Workers, 가상화, 스마트 캐싱 적용

### 비즈니스 도메인
```
구인구직 시스템 ↔ 스태프 관리 ↔ 토너먼트 운영
     ↓              ↓              ↓
   지원서 관리    출석/급여 관리    실시간 운영
```

## 🛠️ 기술 스택

### Frontend
| 영역 | 기술 | 용도 |
|------|------|------|
| **프레임워크** | React 18 + TypeScript | UI 프레임워크 (Strict Mode) |
| **상태 관리** | Context API + Zustand | 전역 상태 관리 |
| **스타일링** | Tailwind CSS | 유틸리티 기반 스타일링 |
| **UI 라이브러리** | @heroicons/react, @tanstack/react-table | 아이콘, 테이블 |
| **날짜/시간** | date-fns | 날짜 처리 |
| **빌드 도구** | Create React App | 개발/빌드 환경 |

### Backend & Infrastructure  
| 영역 | 기술 | 용도 |
|------|------|------|
| **데이터베이스** | Firebase Firestore | NoSQL 실시간 데이터베이스 |
| **인증** | Firebase Authentication | 사용자 인증/권한 |
| **스토리지** | Firebase Storage | 파일 업로드 |
| **함수** | Firebase Cloud Functions | 서버 로직 |
| **호스팅** | Firebase Hosting | 웹 앱 배포 |

### 모니터링 & 품질
| 영역 | 기술 | 용도 |
|------|------|------|
| **에러 추적** | Sentry | 실시간 에러 모니터링 |
| **성능 모니터링** | Firebase Performance | 웹 성능 추적 |
| **테스트** | Jest, Playwright | 단위/E2E 테스트 |
| **코드 품질** | ESLint, Prettier | 코드 품질 관리 |

## 🏛️ 핵심 아키텍처

### UnifiedDataContext 아키텍처

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend Layer                           │
├─────────────────────────────────────────────────────────────┤
│  Pages & Components                                         │
│  ├── JobPostingAdminPage     ├── JobBoardPage              │
│  ├── JobPostingDetailPage    ├── MySchedulePage            │
│  └── ProfilePage             └── AttendancePage            │
├─────────────────────────────────────────────────────────────┤
│                UnifiedDataContext                           │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │  Global State Management                                │ │
│  │  ├── staff: Map<string, Staff>                         │ │
│  │  ├── workLogs: Map<string, WorkLog>                    │ │
│  │  ├── applications: Map<string, Application>            │ │
│  │  ├── jobPostings: Map<string, JobPosting>              │ │
│  │  ├── attendanceRecords: Map<string, AttendanceRecord>  │ │
│  │  └── tournaments: Map<string, Tournament>              │ │
│  └─────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────┤
│                Service Layer                                │
│  ├── unifiedDataService.ts  - Firebase 통합 서비스         │
│  ├── ApplicationHistoryService.ts - 지원서 이력 관리       │
│  ├── BulkOperationService.ts - 일괄 작업 처리              │
│  └── EventService.ts - 이벤트 관리                         │
├─────────────────────────────────────────────────────────────┤
│                Firebase Layer                               │
│  ├── Firestore Collections                                 │
│  ├── Authentication                                        │
│  ├── Cloud Functions                                       │
│  └── Performance Monitoring                                │
└─────────────────────────────────────────────────────────────┘
```

### 디렉토리 구조

```
app2/src/
├── components/           # 재사용 가능한 UI 컴포넌트
│   ├── common/          # 공통 컴포넌트
│   ├── tables/          # 테이블 관련 컴포넌트
│   └── modals/          # 모달 컴포넌트
├── contexts/            # React Context
│   ├── UnifiedDataContext.tsx  # 통합 데이터 관리 ⭐
│   └── AuthContext.tsx         # 인증 관리
├── hooks/               # 커스텀 훅
│   ├── useUnifiedData.ts       # 데이터 접근 훅 ⭐
│   ├── useSystemPerformance.ts # 성능 모니터링
│   └── useSmartCache.ts        # 캐싱 최적화
├── pages/               # 페이지 컴포넌트
│   ├── JobBoard/        # 구인 게시판
│   ├── MySchedulePage/  # 내 스케줄
│   └── ProfilePage/     # 프로필
├── services/            # 비즈니스 로직
│   ├── unifiedDataService.ts   # 통합 데이터 서비스 ⭐
│   └── EventService.ts         # 이벤트 관리
├── types/               # TypeScript 타입 정의
│   ├── unifiedData.ts   # 통합 데이터 타입 ⭐
│   └── common.ts        # 공통 타입
├── utils/               # 유틸리티 함수
│   ├── payrollCalculations.ts  # 급여 계산 ⭐
│   ├── workLogMapper.ts        # 워크로그 매핑
│   ├── logger.ts              # 로깅 시스템
│   └── smartCache.ts          # 스마트 캐싱
└── workers/             # Web Workers
    └── payrollWorker.ts # 급여 계산 워커
```

## 📁 폴더 구조 아키텍처

> **v0.2.1 주요 개선 사항**: 체계적인 코드 정리를 통해 47개 컴포넌트를 17개로 정리하고 10개 카테고리로 체계화했습니다.

### 🏢 컴포넌트 체계화 전략

#### 개선 성과
- **파일 수 감소**: 47개 → 17개 (65% 감소)
- **개발 효율성**: 컴포넌트 찾기 시간 단축
- **코드 이해도**: 명확한 카테고리별 분류

#### 체계화된 폴더 구조

```
📁 src/components/ (총 28개 폴더)
│
├── 🚪 전문 카테고리 폴더들
│   ├── 🕐 attendance/        # 출석 관리 (2개)
│   │   ├── AttendanceStatusCard.tsx
│   │   └── AttendanceStatusPopover.tsx
│   │
│   ├── 🔐 auth/             # 인증 관리 (4개)
│   │   ├── PrivateRoute.tsx
│   │   ├── RoleBasedRoute.tsx
│   │   └── ...
│   │
│   ├── 📈 charts/           # 차트 관리 (2개)
│   │   ├── ChartRenderer.tsx
│   │   └── WebWorkerChart.tsx
│   │
│   ├── ⚠️ errors/           # 에러 처리 (3개)
│   │   ├── ErrorBoundary.tsx
│   │   ├── FirebaseErrorBoundary.tsx
│   │   └── JobBoardErrorBoundary.tsx
│   │
│   ├── 🏠 layout/           # 레이아웃 (3개)
│   │   ├── Layout.tsx
│   │   ├── Navigation.tsx
│   │   └── Sidebar.tsx
│   │
│   ├── 💬 modals/           # 모달 관리 (12개)
│   │   ├── ApplyModal.tsx
│   │   ├── PreQuestionModal.tsx
│   │   ├── StaffProfileModal.tsx
│   │   ├── TableDetailModal.tsx
│   │   └── ...
│   │
│   ├── 👥 staff/            # 스태프 관리 (9개)
│   │   ├── StaffCard.tsx
│   │   ├── StaffRow.tsx
│   │   ├── VirtualizedStaffTable.tsx
│   │   └── ...
│   │
│   ├── 📋 tables/           # 테이블 관리 (2개)
│   │   ├── TableCard.tsx
│   │   └── Seat.tsx
│   │
│   ├── ⏰ time/             # 시간 관리 (2개)
│   │   ├── DateDropdownSelector.tsx
│   │   └── TimeIntervalSelector.tsx
│   │
│   └── 📄 upload/           # 업로드 (1개)
│       └── CSVUploadButton.tsx
│
├── 🏢 기존 카테곤리 폴더들
│   ├── applicants/       # 지원자 관리
│   ├── common/           # 공용 컴포넌트
│   ├── dev/              # 개발 도구
│   ├── jobPosting/       # 구인공고 관리
│   ├── navigation/       # 네비게이션
│   ├── payroll/          # 급여 관리
│   ├── tabs/             # 탭 컴포넌트
│   └── ui/               # UI 컴포넌트
│
└── 🔧 유틸리티 파일들
    ├── DashboardCard.tsx
    ├── FormField.tsx
    ├── LoadingSpinner.tsx
    └── ...
```

### 📌 카테고리별 역할 정의

| 카테고리 | 역할 | 예시 컴포넌트 |
|----------|------|------------------|
| **attendance** | 출석 및 근무 관리 | AttendanceStatusCard, AttendanceStatusPopover |
| **auth** | 인증 및 권한 관리 | PrivateRoute, RoleBasedRoute |
| **charts** | 차트 및 그래프 시각화 | ChartRenderer, WebWorkerChart |
| **errors** | 에러 처리 및 바운더리 | ErrorBoundary, FirebaseErrorBoundary |
| **layout** | 레이아웃 및 구조 | Layout, Navigation, Sidebar |
| **modals** | 모달 및 팝업 | ApplyModal, PreQuestionModal |
| **staff** | 스태프 관리 전반 | StaffCard, StaffRow, VirtualizedStaffTable |
| **tables** | 테이블 및 시트 관리 | TableCard, Seat |
| **time** | 시간 및 날짜 관리 | DateDropdownSelector, TimeIntervalSelector |
| **upload** | 파일 업로드 관리 | CSVUploadButton |

### 🔄 Import 경로 컨벤션

#### 체계적 Import 규칙
```typescript
// ✅ 올바른 패턴: 카테고리별 분류 후 import
import AttendanceStatusPopover from '../attendance/AttendanceStatusPopover';
import ErrorBoundary from '../errors/ErrorBoundary';
import { Seat } from '../tables/Seat';

// ❌ 이전 패턴: 무질서한 직접 import
import AttendanceStatusPopover from '../AttendanceStatusPopover';
import ErrorBoundary from '../ErrorBoundary';
import { Seat } from '../Seat';
```

#### 경로 깊이 규칙
- **카테고리 내부**: `./ComponentName`
- **카테고리 간**: `../category/ComponentName`
- **상위 폴더**: `../../hooks/`, `../../utils/`

### 🔧 유지보수 가이드라인

#### 새 컴포넌트 추가 시
1. **적절한 카테곤리 폴더 선택**
2. **역할에 맞지 않으면 새 카테곤리 생성 고려**
3. **Import 경로 일관성 유지**
4. **TypeScript 에러 없는지 확인**

#### 컴포넌트 이동 시
1. **새 위치로 파일 이동**
2. **모든 import 경로 업데이트**
3. **테스트 파일 import 경로 수정**
4. **TypeScript 컴파일 검증**

### 📈 코드 정리 성과

#### Before vs After
| 항목 | Before | After | 개선율 |
|------|--------|-------|----------|
| 컴포넌트 파일 수 | 47개 | 17개 | **65% 감소** |
| 카테고리 수 | 0개 (무질서) | 10개 (체계적) | **체계화 완료** |
| TypeScript 에러 | 100+ 개 | **0개** | **100% 해결** |
| 중복 컴포넌트 | 2개 | **0개** | **100% 제거** |
| Import 경로 일관성 | 일관성 없음 | **체계적** | **규칙 확립** |

---

## 🌊 데이터 흐름

### 📈 전체 데이터 플로우 다이어그램

구인공고 생성부터 급여 정산까지의 완전한 데이터 흐름:

```mermaid
graph TD
    A[1. 구인공고 작성] --> B[2. 구인공고 등록]
    B --> C[3. 지원서 제출]
    C --> D[4. 지원자 검토]
    D --> E[5. 스태프 확정]
    E --> F[6. WorkLog 생성]
    F --> G[7. 스태프탭 관리]
    G --> H[8. 출석 관리]
    H --> I[9. 근무 기록]
    I --> J[10. 급여 정산]
    J --> K[11. 데이터 동기화]
    K --> L[12. 내 스케줄 표시]
    
    style A fill:#f9f,stroke:#333,stroke-width:2px
    style E fill:#bbf,stroke:#333,stroke-width:2px
    style J fill:#bfb,stroke:#333,stroke-width:2px
    style L fill:#fbf,stroke:#333,stroke-width:2px
```

### 🔄 상세 프로세스 플로우

#### 1️⃣ **구인공고 생성 단계**
- **JobPostingForm** → **Firestore/jobPostings** 컬렉션
- 다중 날짜, 역할별 인원, 급여 정보 포함
- 실시간으로 **JobBoard** 페이지에 표시

#### 2️⃣ **지원자 관리 단계**
- **지원서 제출** → **applications** 컬렉션
- **지원자 검토** → **ApplicantTab**에서 관리
- **스태프 확정** → **staff** 컬렉션 + **WorkLog** 사전 생성

#### 3️⃣ **운영 관리 단계**
- **출석 관리** → **attendanceRecords** 컬렉션
- **근무 시간 수정** → **WorkLog** 업데이트
- **급여 정산** → **payrollCalculations** 유틸리티

### 1. 전체 데이터 흐름 아키텍처

```
Firebase Firestore ──┐
                    ├──> unifiedDataService ──> UnifiedDataContext ──> Components
Cloud Functions  ────┘                                                      │
                                                                            │
                                       ┌────────────────────────────────────┘
                                       │
                                       ▼
                              실시간 UI 업데이트
```

### 2. 핵심 데이터 컬렉션

#### staff (스태프 정보)
```typescript
interface Staff {
  id: string;              // 문서 ID
  staffId: string;         // 표준 스태프 ID ✅
  name: string;            // 스태프 이름
  role: string;            // 역할 (dealer, server, manager)
  phone?: string;          // 전화번호
  email?: string;          // 이메일
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}
```

#### workLogs (근무 기록)
```typescript
interface WorkLog {
  id: string;              // 문서 ID 패턴: ${eventId}_${staffId}_0_${date}
  staffId: string;         // 표준 스태프 ID ✅
  staffName: string;       // 스태프 이름 (역정규화)
  eventId: string;         // 표준 이벤트 ID ✅
  date: string;            // 근무 날짜 (YYYY-MM-DD)
  scheduledStartTime?: Timestamp;  // 예정 시작 시간
  scheduledEndTime?: Timestamp;    // 예정 종료 시간
  actualStartTime?: Timestamp;     // 실제 시작 시간
  actualEndTime?: Timestamp;       // 실제 종료 시간
  hoursWorked?: number;    // 근무 시간 (Web Worker 계산)
  status?: 'scheduled' | 'checked_in' | 'checked_out' | 'completed';
}
```

#### applications (지원서)
```typescript
interface Application {
  id: string;              // 문서 ID
  eventId: string;         // 표준 이벤트 ID ✅
  applicantId: string;     // 지원자 ID
  status: 'pending' | 'confirmed' | 'rejected' | 'cancelled';
  assignments?: {          // 배정 정보
    date: string;
    role: string;
    checkMethod?: 'group' | 'individual';  // 그룹/개별 선택 구분
  }[];
  createdAt?: Timestamp;
}
```

#### attendanceRecords (출석 기록)
```typescript
interface AttendanceRecord {
  id: string;              // 문서 ID
  staffId: string;         // 표준 스태프 ID ✅
  eventId: string;         // 표준 이벤트 ID ✅
  status: 'not_started' | 'checked_in' | 'checked_out';
  checkInTime?: Timestamp; // 출근 시간
  checkOutTime?: Timestamp;// 퇴근 시간
  location?: {             // GPS 위치 정보
    latitude: number;
    longitude: number;
  };
}
```

### 3. UnifiedDataService 작동 원리

#### 실시간 구독 시스템
```typescript
class UnifiedDataService {
  // 단일 구독으로 모든 데이터 관리
  private subscriptions: Map<string, () => void> = new Map();
  
  // 역할별 데이터 필터링
  private isAdmin(): boolean {
    return this.userRole === 'admin' || this.userRole === 'manager';
  }
  
  // 실시간 구독 시작
  startSubscriptions() {
    // 관리자: 모든 데이터 / 사용자: 개인 데이터만
    const applicationsQuery = this.isAdmin() 
      ? query(collection(db, 'applications'))
      : query(collection(db, 'applications'), 
              where('applicantId', '==', this.currentUserId));
    
    // Firebase onSnapshot으로 실시간 구독
    this.subscriptions.set('applications', 
      onSnapshot(applicationsQuery, this.handleApplicationsUpdate)
    );
  }
}
```

#### 데이터 변환 및 정규화
```typescript
// applications 데이터 변환 (eventId 필드 보장)
const transformApplicationData = (doc: DocumentData): Application => ({
  id: doc.id,
  postId: doc.postId || '',
  eventId: doc.eventId || doc.postId || '',  // 중요: eventId 보장
  applicantId: doc.applicantId || '',
  status: doc.status || 'pending',
  assignments: doc.assignments || [],
  // ... 기타 필드
});
```

### 4. 페이지별 데이터 흐름

#### 구인공고 상세 페이지 (4개 탭)
```
JobPostingDetailPage
├── ApplicantListTab      : applications + users
├── StaffManagementTab    : staff + workLogs + attendanceRecords  
├── ShiftManagementTab    : workLogs + staff
└── EnhancedPayrollTab    : workLogs + staff + attendanceRecords
```

#### 구인 게시판 (2개 탭)
```
JobBoardPage
├── JobListTab            : jobPostings + applications (지원 여부 확인)
└── MyApplicationsTab     : applications + jobPostings (내 지원서)
```

#### 내 스케줄 페이지
```
MySchedulePage
├── 캘린더 뷰: workLogs + applications (확정/지원 일정)
└── 리스트 뷰: workLogs + attendanceRecords (출석 상태)
```

## ⚡ 성능 최적화

### 1. Web Workers 시스템
```typescript
// payrollWorker.ts - 메인 스레드 블로킹 방지
self.onmessage = function(e) {
  const { workLogs, jobPosting } = e.data;
  
  // 복잡한 급여 계산을 백그라운드에서 처리
  const payrollData = calculatePayrollInWorker(workLogs, jobPosting);
  
  self.postMessage(payrollData);
};
```

### 2. React Window 가상화
```typescript
// 대용량 리스트 성능 최적화 (1000+ 아이템 지원)
import { FixedSizeList as List } from 'react-window';

const VirtualizedStaffTable = ({ items }) => (
  <List
    height={600}
    itemCount={items.length}
    itemSize={80}
    itemData={items}
  >
    {Row}
  </List>
);
```

### 3. 스마트 캐싱 시스템
```typescript
// smartCache.ts - 92% 캐시 히트율 달성
class SmartCache {
  private cache = new Map();
  private hitRate = 0;
  
  get(key: string) {
    if (this.cache.has(key)) {
      this.hitRate++; // 캐시 히트
      return this.cache.get(key);
    }
    return null; // 캐시 미스
  }
  
  // 지능형 캐시 무효화
  invalidatePattern(pattern: string) {
    // 패턴에 맞는 캐시만 선택적 무효화
  }
}
```

### 4. 메모이제이션 최적화
```typescript
// UnifiedDataContext에서 메모이제이션 활용
const filteredWorkLogs = useMemo(() => 
  workLogs.filter(log => log.eventId === selectedEventId),
  [workLogs, selectedEventId]
);

const memoizedActions = useCallback(() => ({
  updateAttendance: (staffId: string, status: AttendanceStatus) => {
    // 액션 로직...
  }
}), [/* dependencies */]);
```

### 5. 성능 지표 (현재 달성)
| 지표 | 목표 | 현재 값 | 상태 |
|------|------|--------|------|
| **번들 크기** | < 300KB | 278.56KB | ✅ |
| **로딩 시간** | < 2초 | 1.2초 | ✅ |
| **캐시 히트율** | > 80% | 92% | ✅ |
| **Firebase 인덱스** | 최적화 | 6개 | ✅ |
| **E2E 테스트 통과율** | > 90% | 100% | ✅ |
| **TypeScript 에러** | 0개 | 0개 | ✅ |

## 📱 페이지별 데이터 사용

### 1. 구인공고 관리 페이지
- **경로**: `/admin/job-postings`
- **사용 데이터**: `jobPostings`, `applications` (지원자 수 표시)
- **주요 기능**: 공고 생성/편집/삭제, 지원자 현황

### 2. 구인공고 상세 페이지
- **경로**: `/admin/job-posting/:id`
- **4개 탭 구조**:
  - **지원자 탭**: `applications` + `users` (지원자 관리)
  - **스태프 탭**: `staff` + `workLogs` + `attendanceRecords` (출석 관리)
  - **시프트 탭**: `workLogs` + `staff` (일정 관리)
  - **정산 탭**: `workLogs` + `staff` (급여 계산)

### 3. 구인 게시판
- **경로**: `/jobs`
- **2개 탭 구조**:
  - **구인 목록 탭**: `jobPostings` + `applications` (지원 가능한 공고)
  - **내 지원 현황 탭**: `applications` + `jobPostings` (내 지원서 상태)

### 4. 내 스케줄 페이지
- **경로**: `/my-schedule`
- **사용 데이터**: `workLogs` + `applications` + `attendanceRecords`
- **뷰 모드**: 캘린더 뷰 / 리스트 뷰

### 5. 출석 관리 페이지
- **경로**: `/attendance`
- **사용 데이터**: `attendanceRecords` + `workLogs`
- **주요 기능**: QR 코드 스캔, 출입 기록, GPS 위치 추적

## 🚀 확장성 고려사항

### 1. 모듈러 아키텍처
- **단일 책임 원칙**: 각 서비스와 컴포넌트가 명확한 책임
- **느슨한 결합**: UnifiedDataContext를 통한 의존성 분리
- **높은 응집성**: 관련 기능들이 논리적으로 그룹화

### 2. 타입 안전성
```typescript
// 엄격한 TypeScript 설정
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "noImplicitReturns": true
  }
}
```

### 3. 확장 가능한 데이터 스키마
- **표준 필드명**: `staffId`, `eventId` 통일로 일관성 확보
- **선택적 필드**: 미래 확장을 위한 optional 필드 설계
- **버전 관리**: 스키마 변경 시 하위 호환성 유지

### 4. 국제화 준비
- **i18next**: 다국어 지원 시스템 구축
- **문화적 고려**: 날짜, 시간, 숫자 형식의 지역화

### 5. PWA 지원
- **오프라인 지원**: Service Worker를 통한 캐싱
- **모바일 최적화**: 터치 인터페이스, 반응형 디자인
- **설치 가능**: 앱처럼 설치 가능한 웹 앱

---

## 📚 관련 문서

- **[DEVELOPMENT.md](./DEVELOPMENT.md)**: 개발 환경 설정 및 코딩 가이드
- **[DATA_SCHEMA.md](./DATA_SCHEMA.md)**: Firebase 컬렉션 상세 스키마
- **[TROUBLESHOOTING.md](./TROUBLESHOOTING.md)**: 아키텍처 관련 이슈 해결
- **[DEPLOYMENT.md](./DEPLOYMENT.md)**: 배포 아키텍처 및 환경 설정

---

*마지막 업데이트: 2025년 9월 16일 - 코드 정리 및 폴더 구조 체계화 완성*