# 🚀 T-HOLDEM 아키텍처 최적화 실전 구현 가이드

> **목표**: 기존 기능과 UI를 100% 유지하면서 Event Sourcing 아키텍처로 안전하게 전환
> **기간**: 10일 (2025년 1월 기준)
> **원칙**: 안전성 최우선, 완벽한 백업, 철저한 테스트, 롤백 가능

## 📊 Executive Summary

### 현재 문제점
- **11개 컬렉션** 분산으로 인한 복잡성
- **3-4배 데이터 중복** (users, staff, workLogs.staffInfo)
- **비효율적 쿼리** (클라이언트 필터링, 다중 구독)
- **유지보수 어려움** (15,000줄 코드)

### 최적화 목표
- **2개 컬렉션**으로 통합 (users, events)
- **Event Sourcing + CQRS** 패턴
- **Materialized Views**로 읽기 최적화
- **94% 성능 개선** (로딩 시간 3.2초 → 0.2초)
- **80% 비용 절감** (Firebase 읽기 작업)
- **기능/UI 100% 유지**

## 🏗️ 새로운 아키텍처

### 1. 핵심 컬렉션 (2개)

```typescript
// 1️⃣ users - 사용자 마스터 데이터
interface User {
  uid: string;                    // Firebase UID (Primary Key)
  profile: {
    name: string;
    email: string;
    phone?: string;
    bankInfo?: {
      name: string;
      account: string;
    };
    gender?: string;
    age?: number;
    experience?: string;
    region?: string;
  };
  role: 'admin' | 'manager' | 'staff' | 'user';
  settings: {
    language: string;
    notifications: boolean;
    theme: 'light' | 'dark';
  };
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// 2️⃣ events - 모든 비즈니스 이벤트 (Event Sourcing)
interface Event {
  id: string;                    // Auto-generated
  type: EventType;               // 이벤트 타입 (30+ types)
  actorId: string;               // 행위자 (userId)
  targetId?: string;             // 대상 (postingId, applicationId 등)
  payload: Record<string, any>;  // 이벤트 데이터
  timestamp: Timestamp;
  metadata: {
    ip?: string;
    userAgent?: string;
    source: 'web' | 'mobile' | 'api';
    version: string;
  };
}
```

### 2. 이벤트 타입 정의

```typescript
type EventType =
  // 👤 사용자 관련
  | 'USER_REGISTERED'
  | 'PROFILE_UPDATED'
  | 'BANK_INFO_UPDATED'
  | 'ROLE_CHANGED'

  // 📋 구인구직
  | 'POSTING_CREATED'
  | 'POSTING_UPDATED'
  | 'POSTING_CLOSED'
  | 'APPLICATION_SUBMITTED'
  | 'APPLICATION_CONFIRMED'
  | 'APPLICATION_CANCELLED'

  // 💼 근무 관리
  | 'WORK_SCHEDULED'
  | 'WORK_STARTED'
  | 'WORK_COMPLETED'
  | 'ATTENDANCE_CHECKED_IN'
  | 'ATTENDANCE_CHECKED_OUT'

  // 💰 급여 정산
  | 'PAYROLL_CALCULATED'
  | 'PAYROLL_APPROVED'
  | 'PAYROLL_PAID'

  // 🎰 토너먼트
  | 'TABLE_ASSIGNED'
  | 'PARTICIPANT_SEATED'
  | 'TOURNAMENT_STARTED'
  | 'TOURNAMENT_ENDED';
```

### 3. Materialized Views (자동 생성)

```typescript
// Cloud Functions로 자동 생성되는 읽기 최적화 뷰
interface MaterializedViews {
  // 공고 목록 뷰
  'views/jobPostings': {
    id: string;
    title: string;
    location: string;
    status: string;
    applicantCount: number;
    lastUpdated: Timestamp;
  }[];

  // 사용자별 스케줄 뷰
  'views/mySchedule/{userId}': {
    upcoming: ScheduleEvent[];
    completed: ScheduleEvent[];
    cancelled: ScheduleEvent[];
    totalHours: number;
    totalEarnings: number;
  };

  // 사용자별 급여 뷰
  'views/payroll/{userId}': {
    pending: PayrollItem[];
    paid: PayrollItem[];
    totalPending: number;
    totalPaid: number;
  };

  // 공고별 지원 현황 뷰
  'views/applications/{postingId}': {
    pending: Application[];
    confirmed: Application[];
    cancelled: Application[];
    statistics: ApplicationStats;
  };
}
```

## 🛡️ Phase 0: 백업 및 준비 (Day 0)

### 0.1 완전 백업 체계

```bash
# 1. Git 백업
git add .
git commit -m "backup: Event Sourcing 전환 전 최종 백업"
git tag v1.0.0-pre-eventsourcing
git push origin --tags

# 2. 새 브랜치 생성
git checkout -b feature/event-sourcing-migration
```

### 0.2 Firestore 백업

```typescript
// scripts/backup-firestore.ts
import { db } from '../app2/src/firebase';
import * as fs from 'fs';

async function backupFirestore() {
  const collections = [
    'users', 'staff', 'workLogs', 'attendanceRecords',
    'jobPostings', 'applications', 'tournaments',
    'tables', 'participants', 'reports', 'inquiries'
  ];

  const backup: Record<string, any> = {};

  for (const collectionName of collections) {
    const snapshot = await getDocs(collection(db, collectionName));
    backup[collectionName] = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  }

  // 백업 파일 저장
  const timestamp = new Date().toISOString().replace(/:/g, '-');
  fs.writeFileSync(
    `backups/firestore-${timestamp}.json`,
    JSON.stringify(backup, null, 2)
  );

  console.log(`✅ 백업 완료: backups/firestore-${timestamp}.json`);
}
```

### 0.3 환경 분리

```typescript
// .env.development
REACT_APP_FIREBASE_PROJECT_ID=tholdem-dev
REACT_APP_USE_EVENT_SOURCING=false

// .env.eventsourcing
REACT_APP_FIREBASE_PROJECT_ID=tholdem-dev
REACT_APP_USE_EVENT_SOURCING=true
```

### 0.4 롤백 계획

```yaml
롤백 트리거 조건:
  - 기능 테스트 실패율 > 5%
  - 성능 저하 발생
  - 데이터 무결성 오류

롤백 절차:
  1. git checkout main
  2. Firebase Console에서 이전 규칙 복원
  3. backups/에서 데이터 복원
  4. npm run rollback:firestore
```

## ✅ 구현 체크리스트 (10일)

### Phase 1: 기초 설정 (Day 1-2)

#### Day 1: Firebase 초기화 및 보안 설정
- [ ] 완전 백업 실행 (Git + Firestore)
- [ ] 개발 환경 분리 설정
- [ ] 새 컬렉션 생성 (users, events) - 기존 컬렉션 유지
- [ ] 듀얼 모드 보안 규칙 설정
  ```javascript
  // firestore.rules - 듀얼 모드 지원 (기존 규칙 유지)
  rules_version = '2';
  service cloud.firestore {
    match /databases/{database}/documents {
      // 기존 컬렉션 규칙 유지 (현재 기능 보장)
      match /{existingCollection}/{document=**} {
        allow read, write: if request.auth != null;
      }

      // 새 Event Sourcing 규칙 추가
      match /events/{eventId} {
        allow read: if request.auth != null;
        allow create: if request.auth != null
          && request.auth.uid == request.resource.data.actorId;
        allow update, delete: if false; // 이벤트는 불변
      }

      match /views/{viewType}/{document=**} {
        allow read: if request.auth != null;
        allow write: if false; // Cloud Functions만 쓰기 가능
      }
    }
  }
  ```

#### Day 2: 인덱스 & Cloud Functions 설정
- [ ] Firestore 복합 인덱스 생성
  ```javascript
  // firestore.indexes.json
  {
    "indexes": [
      {
        "collectionGroup": "events",
        "queryScope": "COLLECTION",
        "fields": [
          { "fieldPath": "actorId", "order": "ASCENDING" },
          { "fieldPath": "timestamp", "order": "DESCENDING" }
        ]
      },
      {
        "collectionGroup": "events",
        "queryScope": "COLLECTION",
        "fields": [
          { "fieldPath": "type", "order": "ASCENDING" },
          { "fieldPath": "timestamp", "order": "DESCENDING" }
        ]
      },
      {
        "collectionGroup": "events",
        "queryScope": "COLLECTION",
        "fields": [
          { "fieldPath": "targetId", "order": "ASCENDING" },
          { "fieldPath": "type", "order": "ASCENDING" }
        ]
      }
    ]
  }
  ```

- [ ] Cloud Functions 프로젝트 설정
  ```typescript
  // functions/src/index.ts
  import * as functions from 'firebase-functions';
  import { updateMaterializedViews } from './views';

  // 이벤트 생성시 자동으로 뷰 업데이트
  export const onEventCreated = functions.firestore
    .document('events/{eventId}')
    .onCreate(async (snap, context) => {
      const event = snap.data();
      await updateMaterializedViews(event);
    });
  ```

### Phase 2: 듀얼 모드 서비스 구현 (Day 3-5) - 기존 기능 100% 유지

#### Day 3: 듀얼 모드 Service 구현
- [ ] `app2/src/services/DualModeService.ts` 생성
  ```typescript
  export class DualModeService {
    private useEventSourcing: boolean;
    private eventService: EventService;

    constructor() {
      // 환경변수로 모드 전환
      this.useEventSourcing = process.env.REACT_APP_USE_EVENT_SOURCING === 'true';
      this.eventService = new EventService();
    }

    // 구인공고 생성 (기존 UI 그대로 사용)
    async createJobPosting(data: JobPostingData) {
      if (this.useEventSourcing) {
        // 새 방식: Event 생성
        return await this.eventService.emit('POSTING_CREATED', data);
      } else {
        // 기존 방식: 직접 Firestore 쓰기
        return await addDoc(collection(db, 'jobPostings'), data);
      }
    }

    // 구인공고 조회 (UI 변경 없음)
    async getJobPostings() {
      if (this.useEventSourcing) {
        // 새 방식: Materialized View 읽기
        const snapshot = await getDocs(collection(db, 'views/jobPostings'));
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      } else {
        // 기존 방식: jobPostings 컬렉션 읽기
        const snapshot = await getDocs(collection(db, 'jobPostings'));
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      }
    }
  }

  // Event Service - 실제 이벤트 처리
  class EventService {
    // 이벤트 생성
    async emit(type: EventType, payload: any, targetId?: string) {
      const event = {
        type,
        actorId: auth.currentUser?.uid,
        targetId,
        payload,
        timestamp: serverTimestamp(),
        metadata: {
          source: 'web',
          version: '1.0.0'
        }
      };

      return addDoc(collection(db, 'events'), event);
    }

    // 구인공고 생성
    async createJobPosting(data: JobPostingData) {
      return this.emit('POSTING_CREATED', data);
    }

    // 지원서 제출
    async submitApplication(postingId: string, assignments: Assignment[]) {
      return this.emit('APPLICATION_SUBMITTED',
        { assignments },
        postingId
      );
    }

    // 지원 확정
    async confirmApplication(applicationId: string) {
      return this.emit('APPLICATION_CONFIRMED',
        { applicationId },
        applicationId
      );
    }
  }
  ```

#### Day 4: Query Service 구현
- [ ] `app2/src/services/QueryService.ts` 생성
  ```typescript
  class QueryService {
    // 내 스케줄 조회 (Materialized View)
    async getMySchedule(userId: string) {
      const doc = await getDoc(doc(db, `views/mySchedule/${userId}`));
      return doc.data();
    }

    // 공고 목록 조회 (Cached View)
    async getJobPostings() {
      const snapshot = await getDocs(collection(db, 'views/jobPostings'));
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }

    // 이벤트 히스토리 조회
    async getUserEvents(userId: string, limit = 50) {
      const q = query(
        collection(db, 'events'),
        where('actorId', '==', userId),
        orderBy('timestamp', 'desc'),
        limit(limit)
      );

      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => doc.data());
    }
  }
  ```

#### Day 5: 실시간 구독 서비스
- [ ] `app2/src/services/SubscriptionService.ts` 생성
  ```typescript
  class SubscriptionService {
    // 단일 구독으로 모든 데이터 처리
    subscribeToUserEvents(userId: string, callback: (events: Event[]) => void) {
      return onSnapshot(
        query(
          collection(db, 'events'),
          where('actorId', '==', userId),
          orderBy('timestamp', 'desc'),
          limit(50)
        ),
        { includeMetadataChanges: false },
        (snapshot) => {
          const events = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          })) as Event[];

          callback(events);
        }
      );
    }

    // 공고별 구독 (관리자용)
    subscribeToPosting(postingId: string, callback: (data: any) => void) {
      return onSnapshot(
        doc(db, `views/applications/${postingId}`),
        (doc) => {
          callback(doc.data());
        }
      );
    }
  }
  ```

### Phase 3: UI 레이어 재구성 (Day 6-7)

#### Day 6: Context 어댑터 구현 (기존 컴포넌트 수정 불필요)
- [ ] `app2/src/contexts/UnifiedDataContext.tsx` 수정
  ```typescript
  // 기존 인터페이스 100% 유지
  export const UnifiedDataProvider: React.FC = ({ children }) => {
    const dualService = new DualModeService();

    // 기존과 동일한 state 구조 유지
    const [state, setState] = useState({
      staff: [],
      workLogs: [],
      attendanceRecords: [],
      jobPostings: [],
      applications: [],
      tournaments: [],
      loading: false,
      error: null
    });

    useEffect(() => {
      if (dualService.useEventSourcing) {
        // Event Sourcing 모드: 단일 구독
        const unsubscribe = onSnapshot(
          query(collection(db, 'events'),
                 where('actorId', '==', currentUser?.uid),
                 orderBy('timestamp', 'desc'),
                 limit(100)),
          (snapshot) => {
            // 이벤트를 기존 state 구조로 변환
            const convertedData = convertEventsToLegacyState(snapshot.docs);
            setState(convertedData);
          }
        );
        return () => unsubscribe();
      } else {
        // 기존 모드: 11개 구독 유지
        // ... 현재 코드 그대로
      }
    }, [currentUser]);

    // 기존 actions 인터페이스 유지
    const actions = {
      createJobPosting: dualService.createJobPosting,
      updateJobPosting: dualService.updateJobPosting,
      // ... 모든 기존 액션 유지
    };

    return (
      <UnifiedDataContext.Provider value={{ ...state, actions }}>
        {children}
      </UnifiedDataContext.Provider>
    );
  };
  ```

- [ ] UnifiedDataContext에 듀얼 모드 로직 추가
- [ ] 기존 컴포넌트는 수정 불필요 (100% 호환)

#### Day 7: 주요 페이지 업데이트
- [ ] `JobBoardPage` - Event 기반으로 변경
- [ ] `MySchedulePage` - View 직접 읽기
- [ ] `AttendancePage` - Event emit 사용
- [ ] `ProfilePage` - User + Events 조합
- [ ] `JobPostingDetailPage` - Event 구독

### Phase 3: 테스트 및 검증 (Day 6-7)

#### Day 6: 자동화된 기능 테스트

```typescript
// app2/src/__tests__/eventSourcing.test.ts

describe('Event Sourcing 기능 테스트', () => {
  beforeAll(() => {
    process.env.REACT_APP_USE_EVENT_SOURCING = 'true';
  });

  describe('기존 기능 100% 동작 검증', () => {
    test('구인공고 CRUD', async () => {
      // 생성
      const posting = await createJobPosting(mockData);
      expect(posting).toHaveProperty('id');

      // 조회
      const postings = await getJobPostings();
      expect(postings).toContainEqual(expect.objectContaining({ id: posting.id }));

      // 수정
      const updated = await updateJobPosting(posting.id, { title: 'Updated' });
      expect(updated.title).toBe('Updated');

      // 삭제
      await deleteJobPosting(posting.id);
      const afterDelete = await getJobPostings();
      expect(afterDelete).not.toContainEqual(expect.objectContaining({ id: posting.id }));
    });

    test('지원서 관리', async () => {
      // 기존 플로우 그대로 테스트
    });

    test('스태프 관리', async () => {
      // 기존 플로우 그대로 테스트
    });

    test('출석 체크', async () => {
      // 기존 플로우 그대로 테스트
    });

    test('급여 계산', async () => {
      // 기존 플로우 그대로 테스트
    });
  });
});
```

#### Day 7: 성능 벤치마크 및 데이터 일관성 검증

```typescript
// scripts/performance-benchmark.ts

async function runBenchmark() {
  const metrics = {
    legacy: {},
    eventSourcing: {}
  };

  // 기존 시스템 벤치마크
  process.env.REACT_APP_USE_EVENT_SOURCING = 'false';
  const legacyStart = performance.now();
  await loadAllData();
  metrics.legacy.loadTime = performance.now() - legacyStart;

  // Event Sourcing 벤치마크
  process.env.REACT_APP_USE_EVENT_SOURCING = 'true';
  const esStart = performance.now();
  await loadAllData();
  metrics.eventSourcing.loadTime = performance.now() - esStart;

  // 결과 비교
  console.log(`
    ========== 성능 비교 ==========
    초기 로딩:
      Legacy: ${metrics.legacy.loadTime}ms
      Event Sourcing: ${metrics.eventSourcing.loadTime}ms
      개선율: ${((1 - metrics.eventSourcing.loadTime / metrics.legacy.loadTime) * 100).toFixed(2)}%
  `);

  // 목표: 94% 개선 (3.2초 → 0.2초)
  expect(metrics.eventSourcing.loadTime).toBeLessThan(200);
}
```

```typescript
// scripts/data-consistency-check.ts

async function verifyDataConsistency() {
  // 1. 기존 시스템 데이터 스냅샷
  const legacyData = await fetchLegacyData();

  // 2. Event Sourcing 데이터 스냅샷
  const eventSourcingData = await fetchEventSourcingData();

  // 3. 완전 일치 검증
  const differences = [];

  // 구인공고 검증
  for (const posting of legacyData.jobPostings) {
    const esPosting = eventSourcingData.jobPostings.find(p => p.id === posting.id);
    if (!deepEqual(posting, esPosting)) {
      differences.push({ type: 'jobPosting', id: posting.id, legacy: posting, es: esPosting });
    }
  }

  // 차이점 리포트
  if (differences.length > 0) {
    console.error('❌ 데이터 불일치 발견:', differences);
    throw new Error('Data consistency check failed');
  }

  console.log('✅ 데이터 일관성 검증 통과');
}
```

### Phase 4: 성능 최적화 (Day 8-9)

#### Day 8: 캐싱 & 번들 최적화
- [ ] 3-Level 캐싱 구현
  ```typescript
  class CacheService {
    private memoryCache = new Map();  // 5분 TTL
    private indexedDB = new IndexedDBCache();  // 30일 TTL

    async get(key: string) {
      // L1: Memory
      if (this.memoryCache.has(key)) {
        return this.memoryCache.get(key);
      }

      // L2: IndexedDB
      const cached = await this.indexedDB.get(key);
      if (cached && !this.isStale(cached)) {
        this.memoryCache.set(key, cached);
        return cached;
      }

      // L3: Firestore
      const fresh = await this.fetchFromFirestore(key);
      await this.updateAllCaches(key, fresh);
      return fresh;
    }
  }
  ```

- [ ] Webpack 설정 최적화
  ```javascript
  // webpack.config.js
  module.exports = {
    optimization: {
      splitChunks: {
        chunks: 'all',
        cacheGroups: {
          vendor: {
            test: /[\\/]node_modules[\\/]/,
            priority: 10
          },
          common: {
            minChunks: 2,
            priority: 5
          }
        }
      },
      usedExports: true,  // Tree shaking
      minimize: true
    }
  };
  ```

#### Day 9: 쿼리 최적화
- [ ] Pagination 구현
- [ ] Debouncing 적용
- [ ] Virtual scrolling 적용
- [ ] Image lazy loading
- [ ] Code splitting

### Phase 5: 최종 검증 및 전환 (Day 10)

#### Day 10: 최종 테스트 및 전환 스크립트

**기능 테스트 체크리스트 (100% 통과 필수)**
  ✓ 회원가입/로그인
  ✓ 프로필 수정
  ✓ 구인공고 CRUD
  ✓ 지원서 제출/확정/취소
  ✓ 스태프 관리
  ✓ 출석 체크
  ✓ 급여 계산
  ✓ 토너먼트 관리
  ✓ 테이블/참가자 관리
  ✓ 신고/문의

**성능 벤치마크**
  ✓ 초기 로딩: 3.2초 → 0.2초 이하
  ✓ Firebase 읽기: 11,000/일 → 500/일 이하
  ✓ 메모리 사용: 120MB → 10MB 이하
  ✓ 코드 크기: 15,000줄 → 3,000줄 이하

**데이터 검증**
  ✓ 기존 데이터 100% 마이그레이션
  ✓ 데이터 일관성 검증
  ✓ 백업 복원 테스트

**보안 검증**
  ✓ Firebase Rules 테스트
  ✓ 권한 검증
  ✓ 이벤트 위변조 방지

**전환 스크립트**

```bash
#!/bin/bash
# scripts/switch-to-event-sourcing.sh

echo "🚀 Event Sourcing 전환 시작"

# 1. 백업 생성
npm run backup:all

# 2. 테스트 실행
npm run test:event-sourcing
if [ $? -ne 0 ]; then
  echo "❌ 테스트 실팔. 전환 중단."
  exit 1
fi

# 3. 환경 변수 설정
export REACT_APP_USE_EVENT_SOURCING=true

# 4. 빌드
npm run build

# 5. 배포
npm run deploy

echo "✅ Event Sourcing 전환 완료!"
```

**롤백 스크립트**

```bash
#!/bin/bash
# scripts/rollback.sh

echo "⏪ 롤백 시작"

# 1. 환경 변수 복원
export REACT_APP_USE_EVENT_SOURCING=false

# 2. 이전 버전 체크아웃
git checkout v1.0.0-pre-eventsourcing

# 3. 빌드 및 배포
npm run build
npm run deploy

# 4. 데이터 복원 (필요시)
npm run restore:firestore

echo "✅ 롤백 완료"
```

## 📊 예상 결과

### 성능 개선
| 메트릭 | 현재 | 최적화 후 | 개선율 |
|--------|------|-----------|--------|
| **초기 로딩** | 3.2초 | 0.2초 | 94% ⬇️ |
| **메모리 사용** | 120MB | 10MB | 92% ⬇️ |
| **Firebase 읽기** | 11,000/일 | 500/일 | 95% ⬇️ |
| **코드 라인** | 15,000 | 3,000 | 80% ⬇️ |

### 비용 절감
```yaml
현재:
  월간: $50-100
  연간: $600-1,200

최적화 후:
  월간: $10-20
  연간: $120-240

절감액: 연간 $480-960 (80% 절감)
```

## 🎯 성공 기준

1. **기능 유지**: 모든 기존 기능 100% 동작
2. **UI 불변**: 사용자 인터페이스 변경 없음
3. **성능 개선**: 목표 지표 달성
4. **안정성**: 에러율 0.1% 미만
5. **롤백 가능**: 언제든 이전 버전으로 복원 가능

## ⚠️ 주의사항

### 관리 가능한 리스크
| 리스크 | 대응 방안 |
|--------|-----------|
| **학습 곡선** | 충분한 문서와 예제 코드 제공 |
| **Cloud Functions 비용** | 효율적인 트리거 설계로 최소화 |
| **초기 복잡성** | 단계별 구현으로 점진적 전환 |
| **디버깅 어려움** | 이벤트 로깅 시스템 구축 |

### 롤백 보장
- 모든 단계에서 롤백 가능
- 기존 데이터 완전 백업
- 환경 변수로 즉시 전환
- 다운타임 없는 전환

## 🚀 다음 단계

1. **Day 0**: 완전 백업 및 환경 준비
2. **Day 1-2**: 기초 설정 (듀얼 모드 구현)
3. **Day 3-5**: 서비스 구현 (기능 100% 유지)
4. **Day 6-7**: 테스트 및 검증
5. **Day 8-9**: 성능 최적화
6. **Day 10**: 최종 검증 및 전환

---

*작성일: 2025년 1월*
*버전: 2.0.0 (실전 구현용)*
*작성자: T-HOLDEM Development Team*
*원칙: 안전성 최우선, 기능/UI 100% 유지, 완벽한 테스트*