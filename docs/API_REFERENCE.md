# 🔌 T-HOLDEM API 레퍼런스

**최종 업데이트**: 2025년 9월 10일  
**버전**: v0.1.0 (개발 단계)  
**상태**: 🚧 **작성 중 - MVP 기준**

> [!NOTE]
> **안내**: 이 문서는 최종 버전을 기준으로 작성되었으며, 현재 MVP(v0.1.0) 단계에서 일부 API는 구현되지 않았거나 명세가 변경될 수 있습니다.

## 📋 목차

1. [API 개요](#-api-개요)
2. [인증 시스템](#-인증-시스템)
3. [Firestore API](#-firestore-api)
4. [Firebase Functions](#-firebase-functions)
5. [보안 규칙](#-보안-규칙)
6. [에러 처리](#-에러-처리)
7. [실시간 구독](#-실시간-구독)
8. [성능 최적화](#-성능-최적화)

## 🎯 API 개요

### 아키텍처
T-HOLDEM은 Firebase 서버리스 아키텍처를 사용하며, 모든 데이터는 Firestore를 통해 실시간 동기화됩니다.

### 기술 스택
```yaml
Database: Firestore (NoSQL, 실시간 동기화)
Functions: Firebase Functions (Node.js 20)
Authentication: Firebase Authentication
Storage: Firebase Storage
Hosting: Firebase Hosting
Monitoring: Firebase Performance + Sentry
```

### 엔드포인트
```
Production: https://us-central1-tholdem-ebc18.cloudfunctions.net/
Firestore: firestore.googleapis.com/v1/projects/tholdem-ebc18/
Storage: storage.googleapis.com/tholdem-ebc18.appspot.com/
```

## 🔐 인증 시스템

### Firebase Authentication

#### 로그인
```typescript
import { signInWithEmailAndPassword, getAuth } from 'firebase/auth';

const auth = getAuth();

// 이메일/비밀번호 로그인
const loginUser = async (email: string, password: string) => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const token = await userCredential.user.getIdToken();
    
    return {
      uid: userCredential.user.uid,
      email: userCredential.user.email,
      token
    };
  } catch (error) {
    throw new Error(`로그인 실패: ${error.message}`);
  }
};
```

#### 토큰 사용
```typescript
// HTTP 요청 헤더
const headers = {
  'Authorization': `Bearer ${token}`,
  'Content-Type': 'application/json'
};

// Firestore 클라이언트 인증
const auth = getAuth();
const user = auth.currentUser;
if (user) {
  const token = await user.getIdToken();
}
```

### 사용자 역할 시스템

| 역할 | 권한 | 접근 범위 |
|------|------|----------|
| `admin` | 전체 관리 | 모든 데이터 CRUD |
| `manager` | 운영 관리 | 이벤트 및 스태프 관리 |
| `staff` | 개인 데이터 | 본인 관련 데이터만 |
| `user` | 지원자 | 지원서 및 개인 정보 |

## 🗃️ Firestore API

### 컬렉션 구조

```
tholdem-ebc18 (Database)
├── users/                  # 사용자 정보
├── staff/                  # 스태프 정보  
├── jobPostings/            # 구인공고
├── applications/           # 지원서
├── workLogs/              # 근무 기록
├── attendanceRecords/     # 출석 기록
└── tournaments/           # 토너먼트
```

### 1. Users Collection

#### 스키마
```typescript
interface User {
  id: string;                // 문서 ID (Firebase Auth UID)
  email: string;             // 이메일 (Firebase Auth 동기화)
  displayName?: string;      // 표시 이름
  role: 'admin' | 'manager' | 'staff' | 'user';
  profile: {
    firstName: string;
    lastName: string;
    phoneNumber?: string;
    dateOfBirth?: string;
    address?: Address;
  };
  preferences: UserPreferences;
  isActive: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

#### API 작업

**사용자 생성**
```typescript
import { doc, setDoc } from 'firebase/firestore';

const createUser = async (userData: CreateUserData) => {
  const userRef = doc(db, 'users', userData.uid);
  await setDoc(userRef, {
    ...userData,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
};
```

**사용자 조회**
```typescript
import { doc, getDoc } from 'firebase/firestore';

const getUser = async (uid: string): Promise<User | null> => {
  const userRef = doc(db, 'users', uid);
  const userSnap = await getDoc(userRef);
  
  return userSnap.exists() ? userSnap.data() as User : null;
};
```

### 2. Staff Collection

#### 스키마 
```typescript
interface Staff {
  id: string;              // 문서 ID
  staffId: string;         // 표준 스태프 ID ✅
  name: string;            // 스태프 이름
  role: 'dealer' | 'server' | 'manager';
  phone?: string;          // 전화번호
  email?: string;          // 이메일
  hourlyRate?: number;     // 기본 시급
  isActive: boolean;       // 활성 상태
  specialties?: string[];  // 전문 분야
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string;
}
```

#### API 작업

**스태프 목록 조회**
```typescript
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore';

const getActiveStaff = async (): Promise<Staff[]> => {
  const q = query(
    collection(db, 'staff'),
    where('isActive', '==', true),
    orderBy('name', 'asc')
  );
  
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  } as Staff));
};
```

**스태프 업데이트**
```typescript
import { doc, updateDoc } from 'firebase/firestore';

const updateStaff = async (staffId: string, updates: Partial<Staff>) => {
  const staffRef = doc(db, 'staff', staffId);
  await updateDoc(staffRef, {
    ...updates,
    updatedAt: serverTimestamp()
  });
};
```

### 3. WorkLogs Collection

#### 스키마
```typescript
interface WorkLog {
  id: string;                    // 문서 ID (패턴: eventId_staffId_0_date)
  staffId: string;               // 표준 스태프 ID ✅
  staffName: string;             // 스태프 이름 (역정규화)
  eventId: string;               // 표준 이벤트 ID ✅
  date: string;                  // 근무 날짜 (YYYY-MM-DD)
  scheduledStartTime?: Timestamp; // 예정 시작 시간
  scheduledEndTime?: Timestamp;   // 예정 종료 시간
  actualStartTime?: Timestamp;    // 실제 시작 시간
  actualEndTime?: Timestamp;      // 실제 종료 시간
  hoursWorked?: number;           // 근무 시간
  totalPay?: number;              // 총 급여
  status: 'scheduled' | 'checked_in' | 'checked_out' | 'completed';
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

#### API 작업

**WorkLog 생성**
```typescript
const createWorkLog = async (workLogData: CreateWorkLogData) => {
  const workLogId = `${workLogData.eventId}_${workLogData.staffId}_0_${workLogData.date}`;
  const workLogRef = doc(db, 'workLogs', workLogId);
  
  await setDoc(workLogRef, {
    id: workLogId,
    ...workLogData,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
};
```

**이벤트별 WorkLog 조회**
```typescript
const getWorkLogsByEvent = async (eventId: string): Promise<WorkLog[]> => {
  const q = query(
    collection(db, 'workLogs'),
    where('eventId', '==', eventId),
    orderBy('date', 'desc')
  );
  
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => doc.data() as WorkLog);
};
```

### 4. Applications Collection

#### 스키마
```typescript
interface Application {
  id: string;                // 문서 ID
  eventId: string;           // 표준 이벤트 ID ✅
  applicantId: string;       // 지원자 ID
  postId: string;            // 구인공고 ID
  status: 'pending' | 'confirmed' | 'rejected' | 'cancelled';
  appliedRoles: string[];    // 지원한 역할들
  preferredDates: string[];  // 선호 날짜들
  assignments?: Assignment[]; // 배정 정보
  applicationMessage?: string; // 지원 메시지
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

interface Assignment {
  date: string;              // YYYY-MM-DD
  role: string;              // 배정된 역할
  checkMethod?: 'group' | 'individual'; // 그룹/개별 선택
}
```

#### API 작업

**지원서 제출**
```typescript
const submitApplication = async (applicationData: CreateApplicationData) => {
  const applicationRef = doc(collection(db, 'applications'));
  
  await setDoc(applicationRef, {
    id: applicationRef.id,
    eventId: applicationData.eventId, // ✅ eventId 필수
    ...applicationData,
    status: 'pending',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  
  return applicationRef.id;
};
```

## ⚡ Firebase Functions

### 1. HTTP Functions

#### sendNotification
이메일 알림 발송

```typescript
// 호출 방법
const response = await fetch('https://us-central1-tholdem-ebc18.cloudfunctions.net/sendNotification', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    to: 'user@example.com',
    subject: '지원서 승인 알림',
    template: 'application-approved',
    data: {
      userName: '홍길동',
      eventTitle: '포커 토너먼트 딜러 모집'
    }
  })
});
```

### 2. Firestore Triggers

#### onApplicationStatusChange
지원서 상태 변경 시 트리거

```typescript
// functions/src/index.ts
export const onApplicationStatusChange = functions.firestore
  .document('applications/{applicationId}')
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();
    
    if (before.status !== after.status && after.status === 'confirmed') {
      // 스태프 생성 및 WorkLog 사전 생성
      await createStaffFromApplication(after);
      await createWorkLogsForConfirmedStaff(after);
      await sendNotificationToApplicant(after.applicantId, 'approved');
    }
  });
```

## 🛡️ 보안 규칙

### Firestore Security Rules

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // 인증된 사용자만 접근
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
    
    // 지원서는 본인 것만 조회/수정
    match /applications/{applicationId} {
      allow read, write: if request.auth.uid == resource.data.applicantId
        || get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role in ['admin', 'manager'];
    }
    
    // WorkLog는 관리자만 수정
    match /workLogs/{workLogId} {
      allow read: if request.auth.uid == resource.data.staffId
        || get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role in ['admin', 'manager'];
      allow write: if get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role in ['admin', 'manager'];
    }
  }
}
```

## ❌ 에러 처리

### 에러 코드 체계

```typescript
enum ErrorCode {
  // 인증 에러
  UNAUTHORIZED = 'auth/unauthorized',
  INSUFFICIENT_PERMISSIONS = 'auth/insufficient-permissions',
  
  // 데이터 에러
  NOT_FOUND = 'data/not-found',
  INVALID_INPUT = 'data/invalid-input',
  
  // 시스템 에러
  INTERNAL_ERROR = 'system/internal-error',
  SERVICE_UNAVAILABLE = 'system/service-unavailable'
}

interface ApiError {
  code: ErrorCode;
  message: string;
  details?: any;
  timestamp: string;
}
```

## 🔄 실시간 구독

### onSnapshot 사용법

```typescript
import { collection, query, where, onSnapshot } from 'firebase/firestore';

// 실시간 스태프 데이터 구독
const subscribeToStaff = (callback: (staff: Staff[]) => void) => {
  const q = query(
    collection(db, 'staff'),
    where('isActive', '==', true)
  );
  
  return onSnapshot(q, (snapshot) => {
    const staffData = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as Staff));
    
    callback(staffData);
  }, (error) => {
    logger.error('Staff subscription error', { error });
  });
};
```

## 🚀 성능 최적화

### 쿼리 최적화

```typescript
// ✅ 인덱스를 활용한 효율적 쿼리
const getWorkLogsOptimized = async (eventId: string, limit = 50) => {
  return getDocs(query(
    collection(db, 'workLogs'),
    where('eventId', '==', eventId),
    orderBy('date', 'desc'),
    limitToLast(limit)
  ));
};
```

## 🔗 관련 문서

- **[ARCHITECTURE.md](./ARCHITECTURE.md)**: API 아키텍처 이해
- **[DATA_SCHEMA.md](./DATA_SCHEMA.md)**: 데이터 스키마 상세 정보
- **[DEVELOPMENT.md](./DEVELOPMENT.md)**: 개발 환경에서 API 사용법
- **[TROUBLESHOOTING.md](./TROUBLESHOOTING.md)**: API 관련 문제 해결

---

*마지막 업데이트: 2025년 9월 10일 - Firebase API 및 Functions 완전 정리*