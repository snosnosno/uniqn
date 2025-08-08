# T-HOLDEM 플랫폼 v2.0 - 상세 기능 명세서

## 📋 문서 개요

**문서 버전**: 2.0  
**작성일**: 2025-01-08  
**문서 목적**: T-HOLDEM 플랫폼의 모든 기능에 대한 상세한 기술적 명세와 구현 가이드

---

## 🔐 인증 및 권한 시스템

### 1. 사용자 인증

#### 1.1 회원가입 (SignUp)
```typescript
// 경로: /signup
// 컴포넌트: app2/src/pages/SignUp.tsx

interface SignUpData {
  email: string;
  password: string;
  name: string;
  phone: string;
  role: 'staff' | 'manager' | 'admin';
}

// 프로세스
1. 이메일 중복 검사
2. 비밀번호 강도 검증 (최소 6자)
3. Firebase Auth 계정 생성
4. Firestore users 컬렉션에 프로필 저장
5. 이메일 인증 발송
```

**예외 처리**:
- 이메일 중복: "이미 사용 중인 이메일입니다"
- 약한 비밀번호: "비밀번호는 6자 이상이어야 합니다"
- 네트워크 오류: 자동 재시도 (3회)

#### 1.2 로그인 (Login)
```typescript
// 경로: /login
// 컴포넌트: app2/src/pages/Login.tsx

// 지원 방식
- 이메일/비밀번호 로그인
- Google OAuth 로그인
- 자동 로그인 (Remember Me)

// 세션 관리
- Firebase Auth 세션 유지
- Context API를 통한 전역 상태 관리
- 30일 자동 로그아웃
```

#### 1.3 권한 관리 (RBAC)
```typescript
// Hook: app2/src/hooks/usePermissions.ts

interface Permissions {
  role: 'admin' | 'manager' | 'staff';
  resources: {
    jobPostings: string[];
    staff: string[];
    schedules: string[];
    payroll: string[];
  };
}

// 권한 체계
admin: 모든 리소스에 대한 전체 권한
manager: 자신의 공고/스태프 관리 권한
staff: 읽기 권한 + 자신의 정보 수정
```

---

## 📝 구인/구직 시스템

### 2. 구인 공고 관리

#### 2.1 공고 등록
```typescript
// 경로: /admin/job-postings
// 컴포넌트: app2/src/pages/JobPostingAdminPage.tsx

interface JobPosting {
  id: string;
  title: string;
  description: string;
  location: string;
  dates: string[];
  schedules: Schedule[];
  requiredStaff: {
    role: string;
    count: number;
    hourlyRate?: number;
  }[];
  benefits?: {
    meals?: boolean;
    transportation?: boolean;
    accommodation?: boolean;
  };
  status: 'draft' | 'open' | 'closed';
  createdBy: string;
  createdAt: Timestamp;
}
```

**입력 검증**:
- 제목: 5-100자
- 설명: 20-2000자
- 날짜: 현재 이후 날짜만
- 시급: 최저시급 이상

#### 2.2 지원자 관리
```typescript
// 컴포넌트: app2/src/components/tabs/ApplicantListTab.tsx

interface Application {
  id: string;
  jobPostingId: string;
  applicantId: string;
  applicantName: string;
  applicantPhone: string;
  selectedSchedules: string[];
  status: 'pending' | 'accepted' | 'rejected';
  appliedAt: Timestamp;
  confirmedAt?: Timestamp;
}

// 주요 기능
- 지원자 목록 조회 (실시간 구독)
- 일정별 그룹화 표시
- 일괄 채용/거절
- 확정 취소 (5분 이내)
```

#### 2.3 모바일 최적화
```typescript
// 반응형 디자인
- 2x2 그리드 일정 표시
- 스와이프 제스처 지원
- 축소된 카드 레이아웃
- 최적화된 터치 타겟 (최소 44px)
```

---

## 👥 스태프 관리 시스템

### 3. 출석 관리

#### 3.1 QR 코드 시스템
```typescript
// 컴포넌트: app2/src/pages/AttendancePage.tsx

interface QRCheckIn {
  eventId: string;
  staffId: string;
  checkInTime: string;
  location?: GeolocationCoordinates;
  method: 'qr' | 'manual';
}

// QR 생성
- 이벤트별 고유 코드
- 10분마다 자동 갱신
- Base64 인코딩

// QR 스캔
- 모바일 카메라 활용
- 실시간 검증
- 위치 정보 기록 (선택)
```

#### 3.2 workLogs 시스템
```typescript
// Collection: workLogs
// 특징: 날짜별 독립적 근무 기록

interface WorkLog {
  id: string;
  dealerId: string;  // staffId와 호환
  dealerName: string;
  date: string;  // YYYY-MM-DD
  eventId?: string;
  scheduledStartTime?: string;
  scheduledEndTime?: string;
  actualStartTime?: string;
  actualEndTime?: string;
  status: 'not_started' | 'checked_in' | 'checked_out';
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// 실시간 구독
useEffect(() => {
  const unsubscribe = onSnapshot(
    query(collection(db, 'workLogs'), 
    where('date', '==', selectedDate)),
    (snapshot) => {
      // 실시간 업데이트 처리
    }
  );
}, [selectedDate]);
```

#### 3.3 StaffCard 컴포넌트
```typescript
// 컴포넌트: app2/src/components/StaffCard.tsx
// 모듈화: 4개 하위 컴포넌트로 분리

- StaffCardHeader: 이름, 역할 표시
- StaffCardTime: 시간 편집 (WorkTimeEditor)
- StaffCardAttendance: 출석 상태 (AttendanceStatusPopover)
- StaffCardActions: 액션 버튼

// 성능 최적화
- React.memo 적용
- useMemo/useCallback 활용
- 37-44% 렌더링 성능 개선
```

---

## 💰 간편 정산 시스템

### 4. 단순 계산 방식

#### 4.1 계산 로직
```typescript
// 유틸리티: app2/src/utils/simplePayrollCalculator.ts

// 기본 계산식
일급 = 근무시간(시) × 시급(원)

// 직무별 기본 시급
const DEFAULT_HOURLY_RATES = {
  default: 15000,
  dealer: 20000,
  floor: 18000,
  chipRunner: 15000,
};

// 계산 함수
export function calculateDailyPay(
  hours: number, 
  hourlyRate?: number
): number {
  const rate = hourlyRate ?? DEFAULT_HOURLY_RATES.default;
  return Math.floor(hours * rate);
}
```

#### 4.2 SimplePayrollPage
```typescript
// 경로: /simple-payroll
// 컴포넌트: app2/src/pages/SimplePayrollPage.tsx

// 주요 기능
- 날짜 범위 선택
- 스태프별/날짜별 그룹화
- 실시간 계산
- CSV 내보내기
- 요약 통계 표시

// 데이터 구조
interface SimplePayrollData {
  staffId: string;
  staffName: string;
  date: string;
  workHours: number;
  hourlyRate: number;
  dailyPay: number;
  eventId?: string;
  eventName?: string;
}
```

#### 4.3 Hooks
```typescript
// Hook: app2/src/hooks/useSimplePayroll.ts

// 특징
- Firestore 직접 쿼리 (Functions 미사용)
- workLogs 컬렉션 기반
- 실시간 구독 지원
- 에러 복구 메커니즘

const { 
  payrollData, 
  summary, 
  loading, 
  error 
} = useSimplePayroll({
  startDate,
  endDate,
  staffId,
  eventId,
});
```

---

## 🎮 토너먼트 운영

### 5. 대회 관리

#### 5.1 블라인드 구조
```typescript
// 컴포넌트: app2/src/pages/BlindsPage.tsx

interface BlindLevel {
  level: number;
  smallBlind: number;
  bigBlind: number;
  ante?: number;
  duration: number;  // 분
  breakAfter?: boolean;
}

// 템플릿 제공
- 터보 (15분)
- 스탠다드 (20분)
- 딥스택 (30분)
```

#### 5.2 테이블 관리
```typescript
// 컴포넌트: app2/src/pages/TablesPage.tsx

interface Table {
  id: string;
  number: number;
  seats: number;
  currentPlayers: number;
  dealerId?: string;
  status: 'active' | 'break' | 'closed';
}

// 자동 밸런싱
- 테이블당 최대 인원차 1명
- 자동 브레이크 테이블 추천
```

#### 5.3 실시간 모니터링
```typescript
// 컴포넌트: app2/src/pages/ParticipantLivePage.tsx

// 공개 URL: /live/:tournamentId
// 실시간 정보
- 현재 블라인드 레벨
- 남은 참가자 수
- 평균 칩 스택
- 다음 브레이크까지 시간
```

---

## 📊 관리자 대시보드

### 6. CEO Dashboard

#### 6.1 핵심 지표
```typescript
// 컴포넌트: app2/src/pages/admin/CEODashboard.tsx

// 실시간 메트릭
- 활성 사용자 수
- 진행 중인 토너먼트
- 오늘의 수익
- 월간 성장률

// 성능 최적화
- Firebase 구독 5개로 제한
- 1분 단위 캐싱
- 증분 업데이트만 처리
```

#### 6.2 운영 현황
```typescript
// 섹션별 구성
1. 구인/구직 현황
   - 활성 공고 수
   - 대기 중 지원자
   - 채용 성공률

2. 스태프 현황
   - 출근 중 스태프
   - 예정된 근무
   - 출석률 통계

3. 정산 현황
   - 대기 중 정산
   - 이번 달 정산액
   - 평균 시급
```

---

## 🔧 기술 구현 세부사항

### 7. 성능 최적화

#### 7.1 번들 최적화
```typescript
// 동적 임포트
const JobBoardPage = lazy(() => import('./pages/JobBoardPage'));

// 트리 쉐이킹
- 미사용 코드 제거
- 사이드 이펙트 프리 모듈

// 결과
- 번들 크기: 890KB (44% 감소)
- 초기 로딩: 2.0초
```

#### 7.2 React 최적화
```typescript
// 메모이제이션
const MemoizedComponent = React.memo(Component);

const memoizedValue = useMemo(
  () => computeExpensiveValue(a, b),
  [a, b]
);

const memoizedCallback = useCallback(
  () => { /* ... */ },
  [dependency]
);

// 가상화
import { FixedSizeList } from 'react-window';
```

#### 7.3 Firebase 최적화
```typescript
// 실시간 구독 관리
- 컴포넌트 언마운트 시 구독 해제
- 쿼리 최적화 (인덱스 활용)
- 배치 작업 활용

// 자동 복구
firebaseConnectionManager.enableAutoRecovery();
```

---

## 🛡️ 보안 구현

### 8. 보안 정책

#### 8.1 인증 보안
```typescript
// Multi-factor Authentication
- 이메일 인증 필수
- 2FA 지원 (선택)
- 세션 타임아웃 (30일)
```

#### 8.2 데이터 보안
```typescript
// Firestore Rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read: if request.auth != null;
      allow write: if request.auth.uid == userId;
    }
    
    match /jobPostings/{postingId} {
      allow read: if request.auth != null;
      allow write: if request.auth.token.role in ['admin', 'manager'];
    }
  }
}
```

#### 8.3 XSS/CSRF 방지
```typescript
// DOMPurify 사용
import DOMPurify from 'dompurify';
const clean = DOMPurify.sanitize(dirty);

// CSRF 토큰
const csrfToken = generateToken();
```

---

## 📱 모바일 대응

### 9. 반응형 디자인

#### 9.1 브레이크포인트
```css
/* Tailwind CSS 기준 */
sm: 640px   /* 모바일 가로 */
md: 768px   /* 태블릿 */
lg: 1024px  /* 노트북 */
xl: 1280px  /* 데스크톱 */
```

#### 9.2 터치 최적화
```typescript
// 최소 터치 영역: 44x44px
// 스와이프 제스처 지원
// 햅틱 피드백 (진동)
```

---

## 🧪 테스트 전략

### 10. 테스트 구조

#### 10.1 단위 테스트
```typescript
// Jest + React Testing Library
describe('SimplePayrollCalculator', () => {
  it('should calculate daily pay correctly', () => {
    const result = calculateDailyPay(8, 20000);
    expect(result).toBe(160000);
  });
});
```

#### 10.2 통합 테스트
```typescript
// Firebase 모킹
jest.mock('../firebase', () => ({
  auth: { /* mock */ },
  db: { /* mock */ },
}));
```

#### 10.3 E2E 테스트 (계획)
```typescript
// Playwright 활용
- 사용자 시나리오 테스트
- 크로스 브라우저 테스트
- 성능 측정
```

---

## 📈 모니터링

### 11. 성능 모니터링

#### 11.1 Web Vitals
```typescript
// app2/src/utils/performanceMonitor.ts

측정 지표:
- FCP (First Contentful Paint)
- LCP (Largest Contentful Paint)
- CLS (Cumulative Layout Shift)
- TTFB (Time to First Byte)
```

#### 11.2 에러 추적
```typescript
// Sentry 통합
Sentry.init({
  dsn: process.env.REACT_APP_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1,
});
```

#### 11.3 사용자 분석
```typescript
// Google Analytics (계획)
- 페이지뷰 추적
- 이벤트 추적
- 사용자 플로우 분석
```

---

## 🔄 CI/CD

### 12. 배포 파이프라인

#### 12.1 GitHub Actions
```yaml
# .github/workflows/deploy.yml
name: Deploy to Firebase
on:
  push:
    branches: [main]
    
jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - run: npm ci
      - run: npm test
      - run: npm run build
      - uses: FirebaseExtended/action-hosting-deploy@v0
```

#### 12.2 환경 관리
```bash
# 환경별 설정
.env.development
.env.staging
.env.production

# Firebase 프로젝트
- t-holdem-dev
- t-holdem-staging
- t-holdem-prod
```

---

## 📚 API 레퍼런스

### 13. 주요 API

#### 13.1 Firestore 쿼리
```typescript
// 페이지네이션
const q = query(
  collection(db, 'jobPostings'),
  where('status', '==', 'open'),
  orderBy('createdAt', 'desc'),
  limit(10)
);

// 실시간 구독
onSnapshot(q, (snapshot) => {
  snapshot.docChanges().forEach((change) => {
    // 처리
  });
});
```

#### 13.2 Cloud Functions (최소 사용)
```typescript
// 정산 집계 (필요시)
exports.aggregatePayroll = functions.https.onCall(async (data) => {
  // 복잡한 집계 로직
});
```

---

## 🆘 문제 해결 가이드

### 14. 일반적인 문제

#### 14.1 Firebase 연결 오류
```typescript
// 증상: INTERNAL ASSERTION FAILED
// 해결: 자동 복구 메커니즘
firebaseConnectionManager.handleConnectionError();
```

#### 14.2 TypeScript 오류
```typescript
// Strict Mode 관련
// exactOptionalPropertyTypes 오류
// 해결: 조건부 스프레드 연산자 사용
{...(value && { prop: value })}
```

#### 14.3 성능 문제
```typescript
// 증상: 느린 렌더링
// 해결:
1. React DevTools Profiler 확인
2. 불필요한 리렌더링 찾기
3. memo/useMemo/useCallback 적용
```

---

## 📝 부록

### A. 파일 구조
```
app2/src/
├── components/       # 재사용 컴포넌트
│   ├── common/      # 공통 UI
│   ├── jobPosting/  # 구인공고 관련
│   └── tabs/        # 탭 컴포넌트
├── contexts/        # Context API
├── hooks/           # Custom Hooks
├── pages/           # 페이지 컴포넌트
├── stores/          # Zustand 스토어
├── types/           # TypeScript 타입
└── utils/           # 유틸리티 함수
```

### B. 명명 규칙
```typescript
// 컴포넌트: PascalCase
StaffCard.tsx

// 함수: camelCase
calculateDailyPay()

// 상수: UPPER_SNAKE_CASE
DEFAULT_HOURLY_RATES

// 타입/인터페이스: PascalCase
interface JobPosting {}
```

### C. 코드 스타일
```typescript
// ESLint + Prettier 설정
{
  "extends": ["react-app"],
  "rules": {
    "no-console": "warn",
    "no-unused-vars": "error"
  }
}
```

---

**© 2025 T-HOLDEM. All rights reserved.**