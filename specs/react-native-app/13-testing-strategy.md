# 13. 테스트 전략

> **최종 업데이트**: 2026-02-02
> **버전**: v1.0.0 (실제 구현 반영)
> **현재 커버리지**: ~14% (MVP 달성)

---

## 목차

1. [테스트 피라미드](#1-테스트-피라미드)
2. [테스트 환경 설정](#2-테스트-환경-설정)
3. [단위 테스트](#3-단위-테스트)
4. [통합 테스트](#4-통합-테스트)
5. [E2E 테스트](#5-e2e-테스트)
6. [테스트 커버리지](#6-테스트-커버리지)
7. [Mock Factory](#7-mock-factory)
8. [테스트 자동화](#8-테스트-자동화)
9. [테스트 작성 가이드](#9-테스트-작성-가이드)

---

## 1. 테스트 피라미드

### 현재 구현 상태

```
                    ┌─────────┐
                    │   E2E   │  미구현 (P2 계획)
                    │  Tests  │  Maestro (계획)
                   ┌┴─────────┴┐
                   │Integration│  10개 테스트
                   │   Tests   │  (Components + Hooks)
                  ┌┴───────────┴┐
                  │    Unit     │  28개 테스트
                  │   Tests     │  (Services, Utils, Stores, Errors)
                  └─────────────┘
```

### 테스트 파일 현황 (38개)

```
src/
├── components/
│   ├── auth/__tests__/
│   │   └── LoginForm.test.tsx
│   ├── jobs/__tests__/
│   │   └── JobCard.test.tsx
│   ├── schedule/helpers/__tests__/
│   │   ├── salaryHelpers.test.ts
│   │   ├── statusConfig.test.ts
│   │   └── timeHelpers.test.ts
│   └── ui/__tests__/
│       ├── Button.test.tsx
│       ├── Card.test.tsx
│       └── Input.test.tsx
│
├── constants/__tests__/
│   └── statusConfig.test.ts
│
├── domains/__tests__/
│   ├── ScheduleMerger.test.ts
│   └── SettlementCalculator.test.ts
│
├── errors/__tests__/
│   ├── AppError.test.ts
│   ├── BusinessErrors.test.ts
│   ├── errorUtils.test.ts
│   └── firebaseErrorMapper.test.ts
│
├── services/__tests__/
│   ├── applicationService.test.ts
│   └── authService.test.ts
│
├── shared/
│   ├── deeplink/__tests__/
│   │   ├── NotificationRouteMap.test.ts
│   │   └── RouteMapper.test.ts
│   ├── errors/__tests__/
│   │   └── hookErrorHandler.test.ts
│   ├── firestore/__tests__/
│   │   └── documentUtils.test.ts
│   └── __tests__/
│       ├── IdNormalizer.test.ts
│       ├── RoleResolver.test.ts
│       ├── StatusMapper.test.ts
│       └── TimeNormalizer.test.ts
│
├── stores/__tests__/
│   └── authStore.test.ts
│
├── utils/__tests__/
│   └── formatters.test.ts
│
└── __tests__/
    ├── hooks/
    │   ├── useApplicantManagement.test.ts
    │   ├── useApplications.test.tsx
    │   ├── useJobPostings.test.tsx
    │   ├── useQRCode.test.ts
    │   └── useSettlement.test.ts
    ├── services/
    │   ├── applicantManagementService.test.ts
    │   ├── jobManagementService.test.ts
    │   ├── scheduleService.test.ts
    │   └── settlementService.test.ts
    ├── mocks/
    │   └── factories.test.ts
    └── setup.test.ts
```

### 테스트 도구 스택

| 도구 | 버전 | 용도 |
|------|------|------|
| **Jest** | 29.x | 테스트 러너 |
| **jest-expo** | ~54.x | Expo 환경 프리셋 |
| **@testing-library/react-native** | 12.x | 컴포넌트 테스트 |
| **@testing-library/react-hooks** | 8.x | 훅 테스트 |
| **react-native-reanimated/mock** | - | Reanimated 모킹 |

### 커버리지 현황 vs 목표

```yaml
현재 (MVP):
  global:
    branches: 7%
    functions: 9%
    lines: 14%
    statements: 13%

  utils/:
    branches: 14%
    functions: 14%
    lines: 15%
    statements: 15%

  services/:
    branches: 30%
    functions: 30%
    lines: 40%
    statements: 40%

목표 [Phase 2]:
  global: 60%
  utils/: 80%
  services/: 70%
```

---

## 2. 테스트 환경 설정

### Jest 설정 (jest.config.js)

> **경로**: `uniqn-mobile/jest.config.js` (106줄)

```javascript
/** @type {import('jest').Config} */
module.exports = {
  // Expo Jest preset for React Native
  preset: 'jest-expo',

  // Test environment
  testEnvironment: 'node',

  // Supported file extensions
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],

  // Module path aliases (matching tsconfig.json)
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@expo/vector-icons$': '<rootDir>/src/__tests__/mocks/expoVectorIcons.js',
  },

  // Transform configuration
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg|firebase|@firebase/.*|nativewind|react-native-reanimated)',
  ],

  // Setup files
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],

  // Test file patterns
  testMatch: [
    '**/__tests__/**/*.test.[jt]s?(x)',
    '**/?(*.)+(spec|test).[jt]s?(x)',
  ],

  // Coverage configuration
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/index.ts',
    '!src/**/__tests__/**',
    '!src/**/*.stories.{ts,tsx}',
  ],

  // Coverage thresholds (MVP 현실적 임계값)
  coverageThreshold: {
    global: {
      branches: 7,
      functions: 9,
      lines: 14,
      statements: 13,
    },
    './src/utils/': {
      branches: 14,
      functions: 14,
      lines: 15,
      statements: 15,
    },
    './src/services/': {
      branches: 30,
      functions: 30,
      lines: 40,
      statements: 40,
    },
  },

  // Coverage report formats
  coverageReporters: ['text', 'text-summary', 'lcov', 'html'],

  // Performance
  maxWorkers: '50%',
  testTimeout: 10000,

  // Cleanup
  clearMocks: true,
  restoreMocks: true,

  // Ignore patterns
  testPathIgnorePatterns: ['/node_modules/', '/dist/', '/.expo/'],

  // Watch plugins
  watchPlugins: [
    'jest-watch-typeahead/filename',
    'jest-watch-typeahead/testname',
  ],
};
```

### Jest 셋업 (jest.setup.js)

> **경로**: `uniqn-mobile/jest.setup.js` (385줄)
> **목적**: Firebase, Expo, Reanimated 등 네이티브 모듈 모킹

#### 핵심 Mock 구조

```javascript
// ============================================================================
// 1. Expo 모듈 Mock (서비스 import 전에 설정 필수)
// ============================================================================

// expo-linking (deepLinkService 초기화 문제 해결)
jest.mock('expo-linking', () => ({
  createURL: jest.fn((path) => `uniqn://${path || ''}`),
  parse: jest.fn((_url) => ({ path: '', queryParams: {} })),
  addEventListener: jest.fn(() => ({ remove: jest.fn() })),
  getInitialURL: jest.fn(() => Promise.resolve(null)),
  canOpenURL: jest.fn(() => Promise.resolve(true)),
  openURL: jest.fn(() => Promise.resolve()),
}));

// expo-secure-store
jest.mock('expo-secure-store', () => ({
  setItemAsync: jest.fn(() => Promise.resolve()),
  getItemAsync: jest.fn(() => Promise.resolve(null)),
  deleteItemAsync: jest.fn(() => Promise.resolve()),
}));

// expo-router
jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    canGoBack: jest.fn(() => true),
  }),
  useLocalSearchParams: () => ({}),
  useSegments: () => [],
  usePathname: () => '/',
  Link: 'Link',
  Redirect: 'Redirect',
  Stack: { Screen: 'Stack.Screen' },
  Tabs: { Screen: 'Tabs.Screen' },
}));

// ============================================================================
// 2. React Native 모듈 Mock
// ============================================================================

// react-native-reanimated
jest.mock('react-native-reanimated', () => {
  const Reanimated = require('react-native-reanimated/mock');
  Reanimated.default.call = () => {};
  return Reanimated;
});

// NativeWind
jest.mock('nativewind', () => ({
  styled: (component) => component,
  useColorScheme: () => ({
    colorScheme: 'light',
    setColorScheme: jest.fn(),
    toggleColorScheme: jest.fn(),
  }),
}));

// NetInfo
jest.mock('@react-native-community/netinfo', () => ({
  addEventListener: jest.fn(() => jest.fn()),
  fetch: jest.fn(() => Promise.resolve({
    type: 'wifi',
    isConnected: true,
    isInternetReachable: true,
  })),
  useNetInfo: jest.fn(() => ({
    type: 'wifi',
    isConnected: true,
    isInternetReachable: true,
  })),
}));

// ============================================================================
// 3. Firebase Mock (class-based Timestamp for instanceof support)
// ============================================================================

class MockTimestamp {
  constructor(seconds, nanoseconds = 0) {
    this._seconds = seconds;
    this._nanoseconds = nanoseconds;
  }

  get seconds() { return this._seconds; }
  get nanoseconds() { return this._nanoseconds; }

  toDate() {
    return new Date(this._seconds * 1000 + this._nanoseconds / 1000000);
  }

  toMillis() {
    return this._seconds * 1000 + this._nanoseconds / 1000000;
  }

  static now() {
    const now = Date.now();
    return new MockTimestamp(Math.floor(now / 1000), (now % 1000) * 1000000);
  }

  static fromDate(date) {
    const ms = date.getTime();
    return new MockTimestamp(Math.floor(ms / 1000), (ms % 1000) * 1000000);
  }

  static fromMillis(milliseconds) {
    return new MockTimestamp(
      Math.floor(milliseconds / 1000),
      (milliseconds % 1000) * 1000000
    );
  }
}

// 전역 노출 (테스트에서 참조 가능)
global.MockTimestamp = MockTimestamp;

jest.mock('firebase/firestore', () => ({
  getFirestore: jest.fn(() => ({})),
  collection: jest.fn((db, path) => ({ path })),
  collectionGroup: jest.fn((db, collectionId) => ({ collectionId })),
  doc: jest.fn((db, ...pathSegments) => ({
    id: pathSegments[pathSegments.length - 1] || 'mock-doc-id',
    path: pathSegments.join('/'),
  })),
  getDoc: jest.fn(),
  getDocs: jest.fn(),
  setDoc: jest.fn(),
  updateDoc: jest.fn(),
  deleteDoc: jest.fn(),
  addDoc: jest.fn(),
  query: jest.fn((collectionRef, ...constraints) => ({
    collectionRef, constraints
  })),
  where: jest.fn((field, op, value) => ({ type: 'where', field, op, value })),
  orderBy: jest.fn((field, direction = 'asc') => ({
    type: 'orderBy', field, direction
  })),
  limit: jest.fn((n) => ({ type: 'limit', n })),
  onSnapshot: jest.fn((query, callback) => {
    callback({ docs: [] });
    return jest.fn();
  }),
  runTransaction: jest.fn(),
  writeBatch: jest.fn(() => ({
    set: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    commit: jest.fn(() => Promise.resolve()),
  })),
  serverTimestamp: jest.fn(() => ({ _serverTimestamp: true })),
  increment: jest.fn((n) => ({ _increment: n })),
  arrayUnion: jest.fn((...elements) => ({ _arrayUnion: elements })),
  arrayRemove: jest.fn((...elements) => ({ _arrayRemove: elements })),
  Timestamp: MockTimestamp,
}));

// ============================================================================
// 4. 내부 라이브러리 Mock
// ============================================================================

jest.mock('@/lib/firebase', () => ({
  db: {},
  auth: {},
  storage: {},
  functions: {},
  getFirebaseDb: jest.fn(() => ({})),
  getFirebaseAuth: jest.fn(() => ({
    currentUser: null,
    onAuthStateChanged: jest.fn((callback) => {
      callback(null);
      return jest.fn();
    }),
  })),
  getFirebaseStorage: jest.fn(() => ({})),
  getFirebaseFunctions: jest.fn(() => ({})),
  initializeFirebase: jest.fn(() => Promise.resolve()),
  isFirebaseInitialized: jest.fn(() => true),
}));

// TanStack Query
jest.mock('@tanstack/react-query', () => ({
  ...jest.requireActual('@tanstack/react-query'),
  useQuery: jest.fn(() => ({
    data: undefined,
    isLoading: false,
    error: null,
    refetch: jest.fn(),
  })),
  useMutation: jest.fn(() => ({
    mutate: jest.fn(),
    mutateAsync: jest.fn(),
    isLoading: false,
    error: null,
  })),
}));

// Zustand persist middleware
jest.mock('zustand/middleware', () => ({
  persist: (config) => config,
  createJSONStorage: () => ({
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
  }),
}));
```

#### 콘솔 경고 억제

```javascript
// 불필요한 테스트 로그 숨기기
const originalWarn = console.warn;
const originalError = console.error;

beforeAll(() => {
  console.warn = (...args) => {
    if (
      args[0]?.includes?.('Animated') ||
      args[0]?.includes?.('NativeWind') ||
      args[0]?.includes?.('deprecated')
    ) {
      return;
    }
    originalWarn.apply(console, args);
  };

  console.error = (...args) => {
    if (
      args[0]?.includes?.('Warning:') ||
      args[0]?.includes?.('act()')
    ) {
      return;
    }
    originalError.apply(console, args);
  };
});

afterAll(() => {
  console.warn = originalWarn;
  console.error = originalError;
});
```

---

## 3. 단위 테스트

### 에러 시스템 테스트

> **경로**: `src/errors/__tests__/`

#### AppError.test.ts

```typescript
// src/errors/__tests__/AppError.test.ts
import { AppError, ErrorCategory, ErrorSeverity } from '../AppError';

describe('AppError', () => {
  describe('constructor', () => {
    it('기본 속성이 올바르게 설정되어야 한다', () => {
      const error = new AppError({
        code: 'E1001',
        message: '네트워크 오류',
        userMessage: '인터넷 연결을 확인해주세요',
        category: ErrorCategory.NETWORK,
        severity: ErrorSeverity.MEDIUM,
      });

      expect(error.code).toBe('E1001');
      expect(error.message).toBe('네트워크 오류');
      expect(error.userMessage).toBe('인터넷 연결을 확인해주세요');
      expect(error.category).toBe(ErrorCategory.NETWORK);
      expect(error.severity).toBe(ErrorSeverity.MEDIUM);
      expect(error.isRetryable).toBe(true); // 네트워크 에러는 재시도 가능
    });
  });

  describe('toJSON', () => {
    it('직렬화 가능한 객체를 반환해야 한다', () => {
      const error = new AppError({
        code: 'E2001',
        message: '인증 실패',
        userMessage: '로그인에 실패했습니다',
        category: ErrorCategory.AUTH,
        severity: ErrorSeverity.HIGH,
      });

      const json = error.toJSON();

      expect(json).toHaveProperty('code', 'E2001');
      expect(json).toHaveProperty('message');
      expect(json).toHaveProperty('category', 'AUTH');
      expect(json).toHaveProperty('timestamp');
    });
  });
});
```

#### BusinessErrors.test.ts

```typescript
// src/errors/__tests__/BusinessErrors.test.ts
import {
  AlreadyAppliedError,
  ApplicationClosedError,
  MaxCapacityReachedError,
  InvalidQRCodeError,
  ExpiredQRCodeError,
  AlreadyCheckedInError,
  AlreadySettledError,
} from '../BusinessErrors';

describe('BusinessErrors', () => {
  describe('AlreadyAppliedError', () => {
    it('올바른 코드와 메시지를 가져야 한다', () => {
      const error = new AlreadyAppliedError('job-123');

      expect(error.code).toBe('E6001');
      expect(error.userMessage).toContain('이미 지원한 공고');
      expect(error.isRetryable).toBe(false);
    });
  });

  describe('ApplicationClosedError', () => {
    it('마감된 공고 에러를 생성해야 한다', () => {
      const error = new ApplicationClosedError('job-456');

      expect(error.code).toBe('E6002');
      expect(error.userMessage).toContain('마감');
    });
  });

  describe('MaxCapacityReachedError', () => {
    it('정원 초과 에러를 생성해야 한다', () => {
      const error = new MaxCapacityReachedError('dealer', 10);

      expect(error.code).toBe('E6003');
      expect(error.userMessage).toContain('정원');
    });
  });

  describe('InvalidQRCodeError', () => {
    it('잘못된 QR 코드 에러를 생성해야 한다', () => {
      const error = new InvalidQRCodeError();

      expect(error.code).toBe('E6010');
      expect(error.userMessage).toContain('QR 코드');
    });
  });

  describe('ExpiredQRCodeError', () => {
    it('만료된 QR 코드 에러를 생성해야 한다', () => {
      const error = new ExpiredQRCodeError();

      expect(error.code).toBe('E6011');
      expect(error.userMessage).toContain('만료');
    });
  });

  describe('AlreadyCheckedInError', () => {
    it('중복 출근 에러를 생성해야 한다', () => {
      const error = new AlreadyCheckedInError();

      expect(error.code).toBe('E6020');
      expect(error.userMessage).toContain('출근');
    });
  });

  describe('AlreadySettledError', () => {
    it('중복 정산 에러를 생성해야 한다', () => {
      const error = new AlreadySettledError('worklog-789');

      expect(error.code).toBe('E6030');
      expect(error.userMessage).toContain('정산');
    });
  });
});
```

### Shared 모듈 테스트

> **경로**: `src/shared/__tests__/`

#### IdNormalizer.test.ts

```typescript
// src/shared/__tests__/IdNormalizer.test.ts
import { IdNormalizer } from '../id/IdNormalizer';

describe('IdNormalizer', () => {
  describe('normalize', () => {
    it('언더스코어를 제거해야 한다', () => {
      expect(IdNormalizer.normalize('job_123')).toBe('job123');
    });

    it('하이픈을 제거해야 한다', () => {
      expect(IdNormalizer.normalize('job-123-abc')).toBe('job123abc');
    });

    it('이미 정규화된 ID는 그대로 반환해야 한다', () => {
      expect(IdNormalizer.normalize('job123')).toBe('job123');
    });

    it('null/undefined는 빈 문자열을 반환해야 한다', () => {
      expect(IdNormalizer.normalize(null)).toBe('');
      expect(IdNormalizer.normalize(undefined)).toBe('');
    });
  });

  describe('isEqual', () => {
    it('정규화 후 같은 ID는 true를 반환해야 한다', () => {
      expect(IdNormalizer.isEqual('job_123', 'job-123')).toBe(true);
      expect(IdNormalizer.isEqual('job123', 'job_123')).toBe(true);
    });

    it('다른 ID는 false를 반환해야 한다', () => {
      expect(IdNormalizer.isEqual('job_123', 'job_456')).toBe(false);
    });
  });
});
```

#### RoleResolver.test.ts

```typescript
// src/shared/__tests__/RoleResolver.test.ts
import { RoleResolver } from '../role/RoleResolver';
import type { UserProfile } from '@/types';

describe('RoleResolver', () => {
  describe('resolve', () => {
    it('admin 프로필에서 admin 역할을 반환해야 한다', () => {
      const profile: UserProfile = { role: 'admin' } as UserProfile;
      expect(RoleResolver.resolve(profile)).toBe('admin');
    });

    it('employer 프로필에서 employer 역할을 반환해야 한다', () => {
      const profile: UserProfile = { role: 'employer' } as UserProfile;
      expect(RoleResolver.resolve(profile)).toBe('employer');
    });

    it('staff 프로필에서 staff 역할을 반환해야 한다', () => {
      const profile: UserProfile = { role: 'staff' } as UserProfile;
      expect(RoleResolver.resolve(profile)).toBe('staff');
    });

    it('null 프로필에서 guest 역할을 반환해야 한다', () => {
      expect(RoleResolver.resolve(null)).toBe('guest');
    });
  });

  describe('hasPermission', () => {
    it('admin은 모든 권한을 가져야 한다', () => {
      expect(RoleResolver.hasPermission('admin', 'admin')).toBe(true);
      expect(RoleResolver.hasPermission('admin', 'employer')).toBe(true);
      expect(RoleResolver.hasPermission('admin', 'staff')).toBe(true);
    });

    it('employer는 staff 권한을 가져야 한다', () => {
      expect(RoleResolver.hasPermission('employer', 'staff')).toBe(true);
      expect(RoleResolver.hasPermission('employer', 'admin')).toBe(false);
    });

    it('staff는 staff 권한만 가져야 한다', () => {
      expect(RoleResolver.hasPermission('staff', 'staff')).toBe(true);
      expect(RoleResolver.hasPermission('staff', 'employer')).toBe(false);
    });
  });
});
```

#### StatusMapper.test.ts

```typescript
// src/shared/__tests__/StatusMapper.test.ts
import { StatusMapper, ApplicationStatus } from '../status/StatusMapper';

describe('StatusMapper', () => {
  describe('getNextStatuses', () => {
    it('pending 상태에서 가능한 다음 상태를 반환해야 한다', () => {
      const nextStatuses = StatusMapper.getNextStatuses('pending');
      expect(nextStatuses).toContain('confirmed');
      expect(nextStatuses).toContain('cancelled');
      expect(nextStatuses).toContain('rejected');
    });

    it('confirmed 상태에서 가능한 다음 상태를 반환해야 한다', () => {
      const nextStatuses = StatusMapper.getNextStatuses('confirmed');
      expect(nextStatuses).toContain('checked_in');
      expect(nextStatuses).toContain('cancelled');
    });

    it('settled 상태에서는 다음 상태가 없어야 한다', () => {
      const nextStatuses = StatusMapper.getNextStatuses('settled');
      expect(nextStatuses).toHaveLength(0);
    });
  });

  describe('canTransition', () => {
    it('유효한 상태 전이를 허용해야 한다', () => {
      expect(StatusMapper.canTransition('pending', 'confirmed')).toBe(true);
      expect(StatusMapper.canTransition('confirmed', 'checked_in')).toBe(true);
    });

    it('무효한 상태 전이를 거부해야 한다', () => {
      expect(StatusMapper.canTransition('pending', 'checked_in')).toBe(false);
      expect(StatusMapper.canTransition('settled', 'pending')).toBe(false);
    });
  });
});
```

#### TimeNormalizer.test.ts

```typescript
// src/shared/__tests__/TimeNormalizer.test.ts
import { TimeNormalizer } from '../time/TimeNormalizer';
import { Timestamp } from 'firebase/firestore';

describe('TimeNormalizer', () => {
  describe('toDate', () => {
    it('Timestamp를 Date로 변환해야 한다', () => {
      const timestamp = Timestamp.fromDate(new Date('2024-03-15'));
      const date = TimeNormalizer.toDate(timestamp);
      expect(date).toBeInstanceOf(Date);
    });

    it('Date를 그대로 반환해야 한다', () => {
      const date = new Date('2024-03-15');
      expect(TimeNormalizer.toDate(date)).toBe(date);
    });

    it('문자열을 Date로 변환해야 한다', () => {
      const date = TimeNormalizer.toDate('2024-03-15T10:00:00');
      expect(date).toBeInstanceOf(Date);
    });

    it('null을 null로 반환해야 한다', () => {
      expect(TimeNormalizer.toDate(null)).toBeNull();
    });
  });

  describe('toTimestamp', () => {
    it('Date를 Timestamp로 변환해야 한다', () => {
      const date = new Date('2024-03-15');
      const timestamp = TimeNormalizer.toTimestamp(date);
      expect(timestamp).toBeInstanceOf(Timestamp);
    });
  });

  describe('formatRelative', () => {
    beforeEach(() => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2024-03-15T12:00:00'));
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('방금 전을 표시해야 한다', () => {
      const date = new Date('2024-03-15T11:59:30');
      expect(TimeNormalizer.formatRelative(date)).toBe('방금 전');
    });

    it('N분 전을 표시해야 한다', () => {
      const date = new Date('2024-03-15T11:45:00');
      expect(TimeNormalizer.formatRelative(date)).toBe('15분 전');
    });
  });
});
```

### 도메인 로직 테스트

> **경로**: `src/domains/__tests__/`

#### SettlementCalculator.test.ts

```typescript
// src/domains/__tests__/SettlementCalculator.test.ts
import { SettlementCalculator } from '../settlement/SettlementCalculator';
import type { WorkLog, JobRole } from '@/types';

describe('SettlementCalculator', () => {
  describe('calculateAmount', () => {
    it('일급으로 정산 금액을 계산해야 한다', () => {
      const workLog: WorkLog = {
        id: 'wl-1',
        checkInAt: new Date('2024-03-15T09:00:00'),
        checkOutAt: new Date('2024-03-15T18:00:00'),
        role: 'dealer',
      } as WorkLog;

      const role: JobRole = {
        role: 'dealer',
        count: 2,
        salary: { type: 'daily', amount: 150000 },
      };

      const amount = SettlementCalculator.calculateAmount(workLog, role);
      expect(amount).toBe(150000);
    });

    it('시급으로 정산 금액을 계산해야 한다', () => {
      const workLog: WorkLog = {
        id: 'wl-1',
        checkInAt: new Date('2024-03-15T09:00:00'),
        checkOutAt: new Date('2024-03-15T18:00:00'), // 9시간
        role: 'server',
      } as WorkLog;

      const role: JobRole = {
        role: 'server',
        count: 2,
        salary: { type: 'hourly', amount: 15000 },
      };

      const amount = SettlementCalculator.calculateAmount(workLog, role);
      expect(amount).toBe(135000); // 9시간 * 15000원
    });
  });

  describe('calculateTotal', () => {
    it('여러 WorkLog의 총 정산 금액을 계산해야 한다', () => {
      const workLogs: WorkLog[] = [
        {
          id: 'wl-1',
          checkInAt: new Date('2024-03-15T09:00:00'),
          checkOutAt: new Date('2024-03-15T18:00:00'),
          role: 'dealer',
        } as WorkLog,
        {
          id: 'wl-2',
          checkInAt: new Date('2024-03-16T09:00:00'),
          checkOutAt: new Date('2024-03-16T18:00:00'),
          role: 'dealer',
        } as WorkLog,
      ];

      const roles: JobRole[] = [
        { role: 'dealer', count: 2, salary: { type: 'daily', amount: 150000 } },
      ];

      const total = SettlementCalculator.calculateTotal(workLogs, roles);
      expect(total).toBe(300000);
    });
  });
});
```

### 서비스 테스트

> **경로**: `src/services/__tests__/`, `src/__tests__/services/`

#### applicationService.test.ts

```typescript
// src/services/__tests__/applicationService.test.ts
import { applicationService } from '../applicationService';
import {
  AlreadyAppliedError,
  ApplicationClosedError,
  MaxCapacityReachedError,
} from '@/errors/BusinessErrors';

// Firebase mock은 jest.setup.js에서 설정됨

describe('applicationService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('applyToJob', () => {
    it('성공적으로 지원을 생성해야 한다', async () => {
      // 이 테스트는 Firebase 트랜잭션 mock 필요
      // 실제 구현에서는 runTransaction mock 설정
    });

    it('이미 지원한 공고에 재지원 시 AlreadyAppliedError를 던져야 한다', async () => {
      // Mock setup for existing application
    });

    it('마감된 공고에 지원 시 ApplicationClosedError를 던져야 한다', async () => {
      // Mock setup for closed job posting
    });

    it('정원 초과 시 MaxCapacityReachedError를 던져야 한다', async () => {
      // Mock setup for max capacity
    });
  });

  describe('cancelApplication', () => {
    it('pending 상태의 지원만 취소할 수 있어야 한다', async () => {
      // Test implementation
    });
  });
});
```

---

## 4. 통합 테스트

### 컴포넌트 테스트

> **경로**: `src/components/**/__tests__/`

#### Button.test.tsx

```typescript
// src/components/ui/__tests__/Button.test.tsx
import React from 'react';
import { render, fireEvent, screen } from '@testing-library/react-native';
import { Button } from '../Button';

describe('Button', () => {
  it('children을 렌더링해야 한다', () => {
    render(<Button>테스트 버튼</Button>);
    expect(screen.getByText('테스트 버튼')).toBeTruthy();
  });

  it('onPress 핸들러가 호출되어야 한다', () => {
    const onPress = jest.fn();
    render(<Button onPress={onPress}>클릭</Button>);

    fireEvent.press(screen.getByText('클릭'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('disabled 상태에서 onPress가 호출되지 않아야 한다', () => {
    const onPress = jest.fn();
    render(<Button onPress={onPress} disabled>비활성</Button>);

    fireEvent.press(screen.getByText('비활성'));
    expect(onPress).not.toHaveBeenCalled();
  });

  it('loading 상태에서 로딩 인디케이터를 표시해야 한다', () => {
    render(<Button loading>로딩 중</Button>);
    expect(screen.getByTestId('button-loading')).toBeTruthy();
  });

  describe('variants', () => {
    it('primary variant를 렌더링해야 한다', () => {
      render(<Button variant="primary">Primary</Button>);
      // variant별 스타일 테스트
    });

    it('secondary variant를 렌더링해야 한다', () => {
      render(<Button variant="secondary">Secondary</Button>);
    });

    it('ghost variant를 렌더링해야 한다', () => {
      render(<Button variant="ghost">Ghost</Button>);
    });
  });
});
```

#### JobCard.test.tsx

```typescript
// src/components/jobs/__tests__/JobCard.test.tsx
import React from 'react';
import { render, fireEvent, screen } from '@testing-library/react-native';
import { JobCard } from '../JobCard';

const mockJob = {
  id: 'job-123',
  title: '홀덤 딜러 모집',
  location: { address: '서울시 강남구', coordinates: null },
  workDate: new Date('2024-03-20'),
  timeSlot: '18:00 ~ 02:00',
  roles: [
    { role: 'dealer', count: 3, salary: { type: 'daily', amount: 150000 } },
  ],
  status: 'active',
};

describe('JobCard', () => {
  it('공고 정보를 올바르게 표시해야 한다', () => {
    render(<JobCard job={mockJob} onPress={jest.fn()} />);

    expect(screen.getByText('홀덤 딜러 모집')).toBeTruthy();
    expect(screen.getByText('서울시 강남구')).toBeTruthy();
    expect(screen.getByText('18:00 ~ 02:00')).toBeTruthy();
    expect(screen.getByText(/150,000원/)).toBeTruthy();
  });

  it('카드 클릭 시 onPress가 호출되어야 한다', () => {
    const onPress = jest.fn();
    render(<JobCard job={mockJob} onPress={onPress} />);

    fireEvent.press(screen.getByTestId('job-card'));
    expect(onPress).toHaveBeenCalledWith(mockJob);
  });

  it('마감된 공고는 마감 뱃지를 표시해야 한다', () => {
    const closedJob = { ...mockJob, status: 'closed' };
    render(<JobCard job={closedJob} onPress={jest.fn()} />);

    expect(screen.getByText('마감')).toBeTruthy();
  });

  it('여러 역할이 있으면 역할 수를 표시해야 한다', () => {
    const multiRoleJob = {
      ...mockJob,
      roles: [
        { role: 'dealer', count: 3, salary: { type: 'daily', amount: 150000 } },
        { role: 'server', count: 2, salary: { type: 'daily', amount: 120000 } },
      ],
    };

    render(<JobCard job={multiRoleJob} onPress={jest.fn()} />);
    expect(screen.getByText('외 1개 역할')).toBeTruthy();
  });
});
```

### 훅 테스트

> **경로**: `src/__tests__/hooks/`

#### useApplications.test.tsx

```typescript
// src/__tests__/hooks/useApplications.test.tsx
import { renderHook, act, waitFor } from '@testing-library/react-hooks';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useApplications } from '@/hooks/useApplications';
import { applicationService } from '@/services/applicationService';

jest.mock('@/services/applicationService');

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
};

describe('useApplications', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('지원 성공 시 성공 상태를 반환해야 한다', async () => {
    const mockApplication = {
      id: 'app-123',
      status: 'pending',
      createdAt: new Date(),
    };

    (applicationService.applyToJob as jest.Mock).mockResolvedValue(
      mockApplication
    );

    const { result } = renderHook(() => useApplications('user-123'), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.applyToJob.mutate({
        jobPostingId: 'job-456',
        roleId: 'dealer',
      });
    });

    await waitFor(() => {
      expect(result.current.applyToJob.isSuccess).toBe(true);
    });
  });

  it('지원 취소 시 상태가 업데이트되어야 한다', async () => {
    (applicationService.cancelApplication as jest.Mock).mockResolvedValue(
      undefined
    );

    const { result } = renderHook(() => useApplications('user-123'), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.cancelApplication.mutate('app-123');
    });

    await waitFor(() => {
      expect(result.current.cancelApplication.isSuccess).toBe(true);
    });
  });
});
```

#### useSettlement.test.ts

```typescript
// src/__tests__/hooks/useSettlement.test.ts
import { renderHook, waitFor } from '@testing-library/react-hooks';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useSettlement } from '@/hooks/useSettlement';
import { settlementService } from '@/services/settlementService';

jest.mock('@/services/settlementService');

describe('useSettlement', () => {
  const createWrapper = () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    return ({ children }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };

  it('정산 요약 데이터를 조회해야 한다', async () => {
    const mockSummary = {
      totalAmount: 1500000,
      settledAmount: 1000000,
      pendingAmount: 500000,
      workLogCount: 10,
    };

    (settlementService.getSettlementSummary as jest.Mock).mockResolvedValue(
      mockSummary
    );

    const { result } = renderHook(
      () => useSettlement('job-123'),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current.summary.data).toEqual(mockSummary);
    });
  });

  it('정산 처리 후 캐시가 무효화되어야 한다', async () => {
    (settlementService.processSettlement as jest.Mock).mockResolvedValue({
      success: true,
    });

    const { result } = renderHook(
      () => useSettlement('job-123'),
      { wrapper: createWrapper() }
    );

    // 정산 처리
    await result.current.processSettlement.mutateAsync(['wl-1', 'wl-2']);

    // 캐시 무효화 확인
    expect(settlementService.getSettlementSummary).toHaveBeenCalled();
  });
});
```

---

## 5. E2E 테스트

> **상태**: Phase 2 계획 (미구현)

### Maestro 설정 (계획)

```yaml
# maestro/config.yaml
appId: com.uniqn.app
name: UNIQN E2E Tests

env:
  TEST_EMAIL: test@example.com
  TEST_PASSWORD: TestPassword123!

timeout: 30000
retries: 2
```

### 계획된 E2E 플로우

| 플로우 | 파일 | 우선순위 |
|--------|------|----------|
| 로그인 | flows/auth/login.yaml | P0 |
| 회원가입 (4단계) | flows/auth/signup.yaml | P0 |
| 공고 지원 | flows/job/apply.yaml | P0 |
| QR 출퇴근 | flows/attendance/qr-checkin.yaml | P1 |
| 정산 처리 | flows/settlement/settle.yaml | P1 |

### 로그인 플로우 예시 (계획)

```yaml
# maestro/flows/auth/login.yaml
appId: com.uniqn.app
name: Login Flow
---
- launchApp

- assertVisible: "로그인"

- tapOn:
    id: "email-input"
- inputText: ${TEST_EMAIL}

- tapOn:
    id: "password-input"
- inputText: ${TEST_PASSWORD}

- tapOn: "로그인"

- waitForAnimationToEnd

- assertVisible: "홈"
- assertVisible:
    id: "tab-bar"

- takeScreenshot: "login_success"
```

---

## 6. 테스트 커버리지

### 현재 커버리지 상태

```
-----------------------------|---------|----------|---------|---------|
File                         | % Stmts | % Branch | % Funcs | % Lines |
-----------------------------|---------|----------|---------|---------|
All files                    |   13.XX |    7.XX  |   9.XX  |  14.XX  |
 src/errors                  |   85.XX |   70.XX  |  80.XX  |  85.XX  |
 src/shared                  |   75.XX |   60.XX  |  70.XX  |  75.XX  |
 src/services                |   40.XX |   30.XX  |  30.XX  |  40.XX  |
 src/utils                   |   15.XX |   14.XX  |  14.XX  |  15.XX  |
 src/components/ui           |   20.XX |   15.XX  |  18.XX  |  20.XX  |
-----------------------------|---------|----------|---------|---------|
```

### 커버리지 목표 로드맵

```yaml
Phase 1 (MVP) - 완료:
  global: 14%
  services/: 40%
  errors/: 85%
  shared/: 75%

Phase 2 - 목표:
  global: 60%
  services/: 70%
  utils/: 80%
  components/ui: 60%

Phase 3 - 목표:
  global: 80%
  services/: 90%
  utils/: 95%
  components/: 70%
```

### 커버리지 명령어

```bash
# 전체 커버리지 실행
npm run test:coverage

# 특정 디렉토리 커버리지
npm test -- --coverage --collectCoverageFrom='src/services/**/*.ts'

# 커버리지 리포트 열기
open coverage/lcov-report/index.html
```

---

## 7. Mock Factory

> **경로**: `src/__tests__/mocks/factories.ts`

### 테스트 유틸리티 (jest.setup.js)

```typescript
// global.testUtils로 접근 가능
global.testUtils = {
  // 비동기 작업 대기
  flushPromises: () => new Promise((resolve) => setImmediate(resolve)),

  // Mock 사용자 생성
  createMockUser: (overrides = {}) => ({
    uid: 'test-user-id',
    email: 'test@example.com',
    displayName: 'Test User',
    phoneNumber: '+821012345678',
    ...overrides,
  }),

  // Mock 스태프 생성
  createMockStaff: (overrides = {}) => ({
    id: 'staff-id-1',
    userId: 'test-user-id',
    name: '테스트 스태프',
    role: 'staff',
    email: 'staff@example.com',
    phone: '010-1234-5678',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  }),

  // Mock 공고 생성 (v2.0 - roles[].salary 구조)
  createMockJobPosting: (overrides = {}) => ({
    id: 'job-id-1',
    title: '테스트 공고',
    description: '테스트 설명',
    location: '서울',
    defaultSalary: { type: 'daily', amount: 150000 },
    roles: [
      { role: 'dealer', count: 2, salary: { type: 'daily', amount: 150000 } },
    ],
    date: new Date().toISOString(),
    status: 'active',
    createdAt: new Date().toISOString(),
    ...overrides,
  }),
};
```

### Mock Factory 패턴

```typescript
// src/__tests__/mocks/factories.ts

// Application Factory
export const createMockApplication = (overrides = {}) => ({
  id: `app-${Date.now()}`,
  jobPostingId: 'job-123',
  applicantId: 'user-123',
  roleId: 'dealer',
  status: 'pending',
  appliedAt: new Date(),
  ...overrides,
});

// WorkLog Factory
export const createMockWorkLog = (overrides = {}) => ({
  id: `wl-${Date.now()}`,
  applicationId: 'app-123',
  jobPostingId: 'job-123',
  staffId: 'staff-123',
  role: 'dealer',
  date: new Date().toISOString().split('T')[0],
  checkInAt: null,
  checkOutAt: null,
  status: 'scheduled',
  ...overrides,
});

// Settlement Factory
export const createMockSettlement = (overrides = {}) => ({
  id: `settle-${Date.now()}`,
  workLogId: 'wl-123',
  staffId: 'staff-123',
  jobPostingId: 'job-123',
  amount: 150000,
  status: 'pending',
  ...overrides,
});

// Notification Factory
export const createMockNotification = (overrides = {}) => ({
  id: `notif-${Date.now()}`,
  userId: 'user-123',
  type: 'application_accepted',
  title: '지원 승인',
  body: '지원이 승인되었습니다',
  isRead: false,
  createdAt: new Date(),
  ...overrides,
});
```

---

## 8. 테스트 자동화

### npm 스크립트

```json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "test:ci": "jest --ci --coverage --reporters=default --reporters=jest-junit",
    "test:unit": "jest --testPathPattern='src/(services|utils|stores|errors)'",
    "test:components": "jest --testPathPattern='src/components'",
    "test:hooks": "jest --testPathPattern='hooks'",
    "test:shared": "jest --testPathPattern='src/shared'"
  }
}
```

### Pre-commit 훅 (계획)

```bash
# .husky/pre-commit
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

# 변경된 파일에 대한 테스트만 실행
npm run test -- --onlyChanged --passWithNoTests

# 타입 체크
npm run type-check
```

### GitHub Actions (계획)

```yaml
# .github/workflows/test.yml
name: Tests

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run unit tests
        run: npm run test:ci

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/lcov.info
          fail_ci_if_error: false
```

---

## 9. 테스트 작성 가이드

### 테스트 파일 명명 규칙

```
src/
├── services/
│   ├── applicationService.ts
│   └── __tests__/
│       └── applicationService.test.ts  # 같은 폴더 내 __tests__
│
├── components/
│   └── ui/
│       ├── Button.tsx
│       └── __tests__/
│           └── Button.test.tsx
```

### 테스트 구조 (AAA 패턴)

```typescript
describe('서비스/컴포넌트명', () => {
  // Setup
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('메서드/기능명', () => {
    it('기대 동작을 설명 (한글)', async () => {
      // Arrange (준비)
      const input = { ... };

      // Act (실행)
      const result = await service.method(input);

      // Assert (검증)
      expect(result).toEqual(expected);
    });

    it('에러 케이스도 테스트', async () => {
      // Arrange
      mockFunction.mockRejectedValue(new Error('에러'));

      // Act & Assert
      await expect(service.method()).rejects.toThrow('에러');
    });
  });
});
```

### 필수 테스트 케이스

```yaml
서비스 테스트:
  - 정상 동작 (happy path)
  - 에러 처리 (error cases)
  - 경계값 (edge cases)
  - 권한 검증 (permission checks)

컴포넌트 테스트:
  - 렌더링 (rendering)
  - 사용자 상호작용 (interactions)
  - Props 변화 (prop changes)
  - 접근성 (accessibility)

훅 테스트:
  - 초기 상태 (initial state)
  - 상태 변화 (state changes)
  - 부수 효과 (side effects)
  - 정리 (cleanup)
```

### 테스트 작성 시 주의사항

```typescript
// ❌ 구현 세부사항 테스트
it('내부 상태가 업데이트되어야 한다', () => {
  expect(component.state.isLoading).toBe(true);
});

// ✅ 동작/결과 테스트
it('로딩 중에 로딩 인디케이터를 표시해야 한다', () => {
  expect(screen.getByTestId('loading-indicator')).toBeTruthy();
});

// ❌ 타임아웃 의존 테스트
it('2초 후 메시지가 사라져야 한다', async () => {
  await new Promise(resolve => setTimeout(resolve, 2000));
});

// ✅ fake timers 사용
it('2초 후 메시지가 사라져야 한다', () => {
  jest.useFakeTimers();
  // render component
  jest.advanceTimersByTime(2000);
  expect(screen.queryByText('메시지')).toBeNull();
});
```

---

## 요약

### 현재 상태 (v1.0.0)

| 영역 | 파일 수 | 커버리지 | 상태 |
|------|---------|----------|------|
| **Unit Tests** | 28개 | ~40% (서비스) | MVP 달성 |
| **Integration Tests** | 10개 | ~20% | 진행 중 |
| **E2E Tests** | 0개 | - | P2 계획 |
| **전체** | 38개 | ~14% | MVP 달성 |

### Phase 2 계획

- [ ] 전체 커버리지 60% 달성
- [ ] Maestro E2E 테스트 도입
- [ ] 주요 플로우 E2E 테스트 (로그인, 지원, 출퇴근)
- [ ] CI/CD 파이프라인에 테스트 통합
- [ ] Pre-commit 훅 설정

### 관련 문서

- [01-architecture.md](./01-architecture.md) - 아키텍처 설계
- [12-security.md](./12-security.md) - 보안 전략
- [15-cicd.md](./15-cicd.md) - CI/CD 파이프라인

---

*최종 업데이트: 2026-02-02*
*테스트 파일 기준: uniqn-mobile/src/*
