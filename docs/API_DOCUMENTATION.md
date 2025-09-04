# 🔌 T-HOLDEM API 문서

**최종 업데이트**: 2025년 2월 4일  
**상태**: 🏆 **Week 4 완료 - 프로덕션 배포 최적화**  
**버전**: v5.0.0

## 📋 목차

1. [개요](#개요)
2. [인증](#인증)
3. [Firestore 컬렉션](#firestore-컬렉션)
4. [Firebase Functions API](#firebase-functions-api)
5. [보안 규칙](#보안-규칙)
6. [에러 처리](#에러-처리)
7. [Rate Limiting](#rate-limiting)

## 🎯 개요

T-HOLDEM은 Firebase를 기반으로 하는 서버리스 아키텍처를 사용합니다.

### 기술 스택
- **Database**: Firestore (NoSQL)
- **Functions**: Firebase Functions (Node.js 20)
- **Authentication**: Firebase Auth
- **Storage**: Firebase Storage
- **Hosting**: Firebase Hosting

### API 엔드포인트
- **Production**: `https://us-central1-tholdem-ebc18.cloudfunctions.net`
- **Firestore**: `firestore.googleapis.com/v1/projects/tholdem-ebc18`

## 🔐 인증

### Firebase Authentication
```javascript
// 로그인
const auth = getAuth();
const userCredential = await signInWithEmailAndPassword(auth, email, password);
const token = await userCredential.user.getIdToken();

// 토큰 사용
headers: {
  'Authorization': `Bearer ${token}`
}
```

### 사용자 역할
| 역할 | 권한 | 설명 |
|------|------|------|
| `admin` | 전체 권한 | 시스템 관리자 |
| `manager` | 관리 권한 | 이벤트 관리자 |
| `staff` | 제한된 권한 | 일반 스태프 |

## 📚 Firestore 컬렉션

### 1. users
사용자 정보 관리
```typescript
interface User {
  uid: string;
  email: string;
  displayName?: string;
  role: 'admin' | 'manager' | 'staff';
  createdAt: Timestamp;
  updatedAt?: Timestamp;
  photoURL?: string;
  phoneNumber?: string;
}
```

### 2. jobPostings
구인공고 관리
```typescript
interface JobPosting {
  id: string;
  title: string;
  description: string;
  location: string;
  detailedAddress?: string;
  status: 'open' | 'closed';
  dates: Array<{
    date: string;
    roles: Array<{
      role: string;
      personnel: number;
      timeSlots: Array<{
        startTime: string;
        endTime: string;
        personnel: number;
      }>;
    }>;
  }>;
  benefits?: {
    meal?: string;
    parking?: boolean;
    accommodation?: boolean;
  };
  preQuestions?: string[];
  createdBy: string;
  createdAt: Timestamp;
  updatedBy?: string;
  updatedAt?: Timestamp;
}

// 하위 컬렉션
jobPostings/{postId}/staff/{staffId}
jobPostings/{postId}/workLogs/{workLogId}
```

### 3. applications
지원서 관리
```typescript
interface Application {
  id: string;
  eventId: string;  // jobPostingId
  applicantId: string;
  applicantName: string;
  applicantPhone: string;
  status: 'pending' | 'approved' | 'rejected';
  preQuestionAnswers?: string[];
  appliedAt: Timestamp;
  reviewedAt?: Timestamp;
  reviewedBy?: string;
}
```

### 4. workLogs
근무 기록 관리
```typescript
interface WorkLog {
  id: string;
  staffId: string;  // 이전 dealerId
  staffName: string;
  eventId: string;  // 이전 jobPostingId
  date: string;
  role: string;
  times: {
    scheduledStartTime: string;
    scheduledEndTime: string;
    actualStartTime?: string;  // 이전 checkInTime
    actualEndTime?: string;    // 이전 checkOutTime
  };
  status: 'scheduled' | 'working' | 'completed';
  createdAt: Timestamp;
  updatedAt?: Timestamp;
}
```

### 5. attendanceRecords
출석 기록 관리
```typescript
interface AttendanceRecord {
  id: string;
  staffId: string;
  eventId: string;
  date: string;
  checkInTime?: Timestamp;
  checkOutTime?: Timestamp;
  status: 'absent' | 'present' | 'late' | 'early_leave';
  location?: {
    latitude: number;
    longitude: number;
  };
  notes?: string;
}
```

### 6. tournaments
토너먼트 관리
```typescript
interface Tournament {
  id: string;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  location: string;
  status: 'upcoming' | 'ongoing' | 'completed';
  buyIn: number;
  prizePool: number;
  participants: number;
  maxParticipants: number;
  blindStructure: Array<{
    level: number;
    smallBlind: number;
    bigBlind: number;
    ante?: number;
    duration: number;
  }>;
  createdBy: string;
  createdAt: Timestamp;
}
```

### 7. participants
참가자 관리
```typescript
interface Participant {
  id: string;
  tournamentId: string;
  name: string;
  phoneNumber: string;
  email?: string;
  chipCount: number;
  tableNumber?: number;
  seatNumber?: number;
  status: 'registered' | 'playing' | 'eliminated';
  eliminatedAt?: Timestamp;
  rank?: number;
  prize?: number;
}
```

### 8. tables
테이블 관리
```typescript
interface Table {
  id: string;
  tournamentId: string;
  tableNumber: number;
  maxSeats: number;
  currentPlayers: number;
  dealerId?: string;
  status: 'waiting' | 'active' | 'break' | 'closed';
  seats: Array<{
    seatNumber: number;
    participantId?: string;
    chipCount?: number;
  }>;
}
```

## ⚡ Firebase Functions API

### 1. 사용자 관리
```typescript
// 사용자 역할 설정
exports.setUserRole = functions.https.onCall(async (data, context) => {
  const { userId, role } = data;
  
  // 권한 확인
  if (context.auth?.token?.role !== 'admin') {
    throw new functions.https.HttpsError('permission-denied');
  }
  
  // Custom Claims 설정
  await admin.auth().setCustomUserClaims(userId, { role });
  
  return { success: true };
});
```

### 2. 출석 체크
```typescript
// QR 코드 출석 체크
exports.checkInWithQR = functions.https.onCall(async (data, context) => {
  const { qrCode, location } = data;
  const userId = context.auth?.uid;
  
  if (!userId) {
    throw new functions.https.HttpsError('unauthenticated');
  }
  
  // QR 코드 검증 및 출석 처리
  const attendance = await processCheckIn(qrCode, userId, location);
  
  return attendance;
});
```

### 3. 급여 계산
```typescript
// 급여 자동 계산
exports.calculatePayroll = functions.https.onCall(async (data, context) => {
  const { eventId, staffId, period } = data;
  
  // 권한 확인
  if (!['admin', 'manager'].includes(context.auth?.token?.role)) {
    throw new functions.https.HttpsError('permission-denied');
  }
  
  // 근무 기록 조회 및 급여 계산
  const payroll = await calculateStaffPayroll(eventId, staffId, period);
  
  return payroll;
});
```

### 4. 데이터 마이그레이션
```typescript
// 레거시 필드 마이그레이션
exports.migrateFields = functions.https.onRequest(async (req, res) => {
  // Admin SDK를 사용한 일괄 업데이트
  const batch = admin.firestore().batch();
  
  // dealerId → staffId 변환
  // jobPostingId → eventId 변환
  // checkInTime → actualStartTime 변환
  
  await batch.commit();
  res.json({ success: true });
});
```

## 🔒 보안 규칙

### 인증 규칙
```javascript
// 로그인 확인
function isSignedIn() {
  return request.auth != null;
}

// 권한 확인
function isPrivileged() {
  return request.auth.token.role == 'admin' || 
         request.auth.token.role == 'manager';
}

// 소유자 확인
function isOwner(userId) {
  return request.auth.uid == userId;
}
```

### 데이터 검증
```javascript
// XSS 방지
function hasNoXSS(text) {
  return !text.matches('.*<script.*>.*</script>.*') &&
         !text.matches('.*javascript:.*') &&
         !text.matches('.*on\\w+\\s*=.*');
}

// SQL Injection 방지
function hasNoSQLInjection(text) {
  return !text.matches('.*union.*select.*') &&
         !text.matches('.*select.*from.*') &&
         !text.matches('.*delete.*from.*');
}

// 안전한 텍스트 검증
function isSafeText(text, maxLength) {
  return text is string && 
         text.size() <= maxLength &&
         hasNoXSS(text) && 
         hasNoSQLInjection(text);
}
```

### 컬렉션별 권한
| 컬렉션 | 읽기 | 쓰기 | 삭제 |
|--------|------|------|------|
| users | 본인/관리자 | 본인/관리자 | 관리자 |
| jobPostings | 모든 사용자 | 인증된 사용자 | 작성자/관리자 |
| applications | 본인/관리자 | 본인 | 본인/관리자 |
| workLogs | 본인/관리자 | 관리자 | 관리자 |
| tournaments | 모든 사용자 | 관리자 | 관리자 |

## ❌ 에러 처리

### HTTP 상태 코드
| 코드 | 의미 | 설명 |
|------|------|------|
| 200 | OK | 성공 |
| 400 | Bad Request | 잘못된 요청 |
| 401 | Unauthenticated | 인증 필요 |
| 403 | Permission Denied | 권한 없음 |
| 404 | Not Found | 리소스 없음 |
| 500 | Internal Error | 서버 에러 |

### 에러 응답 형식
```json
{
  "error": {
    "code": "permission-denied",
    "message": "You don't have permission to perform this action",
    "details": {
      "requiredRole": "admin",
      "currentRole": "staff"
    }
  }
}
```

### 에러 처리 예시
```typescript
try {
  const result = await functions.httpsCallable('setUserRole')({
    userId: 'user123',
    role: 'admin'
  });
} catch (error) {
  if (error.code === 'permission-denied') {
    console.error('권한이 없습니다');
  } else if (error.code === 'unauthenticated') {
    console.error('로그인이 필요합니다');
  } else {
    console.error('알 수 없는 에러:', error);
  }
}
```

## ⏱️ Rate Limiting

### 제한 정책
| 엔드포인트 | 제한 | 단위 |
|------------|------|------|
| 읽기 작업 | 1000 | 분당 |
| 쓰기 작업 | 100 | 분당 |
| Functions 호출 | 60 | 분당 |
| 파일 업로드 | 10 | 분당 |

### Rate Limit 헤더
```http
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 950
X-RateLimit-Reset: 1643723400
```

## 📊 모니터링

### Firebase Performance
- 자동 API 호출 추적
- 커스텀 트레이스 설정
- 네트워크 지연 모니터링

### Sentry Integration
```javascript
// 에러 트래킹
Sentry.captureException(error, {
  tags: {
    section: 'api',
    action: 'firestore-write'
  },
  extra: {
    userId: user.uid,
    collection: 'workLogs'
  }
});
```

## 🔗 참고 자료

- [Firebase 공식 문서](https://firebase.google.com/docs)
- [Firestore 보안 규칙](https://firebase.google.com/docs/firestore/security/get-started)
- [Firebase Functions](https://firebase.google.com/docs/functions)
- [Firebase Auth](https://firebase.google.com/docs/auth)

---

*API 관련 문의는 개발팀에 연락하세요.*