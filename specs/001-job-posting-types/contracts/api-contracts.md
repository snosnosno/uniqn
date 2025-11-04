# API Contracts: 구인공고 타입 확장 시스템

**Feature**: 001-job-posting-types | **Date**: 2025-10-30
**Purpose**: Define API endpoints, request/response formats, and error handling

## Firebase Functions API

### 1. approveJobPosting (NEW)

**Purpose**: 대회 공고 승인 (admin 전용)

**Endpoint**: Firebase Callable Function
**Function Name**: `approveJobPosting`

**Request**:
```typescript
interface ApproveJobPostingRequest {
  postingId: string;               // 승인할 공고 ID
}
```

**Response**:
```typescript
interface ApproveJobPostingResponse {
  success: boolean;
  postingId: string;
  approvedAt: string;              // ISO 8601 timestamp
  approvedBy: string;              // Admin userId
}
```

**Error Cases**:
```typescript
// 권한 에러
{
  code: 'permission-denied',
  message: 'Admin 권한이 필요합니다'
}

// 공고 없음
{
  code: 'not-found',
  message: '공고를 찾을 수 없습니다'
}

// 이미 처리됨
{
  code: 'failed-precondition',
  message: '이미 승인/거부된 공고입니다'
}

// 타입 오류
{
  code: 'invalid-argument',
  message: '대회 공고만 승인 가능합니다'
}
```

**Authorization**: `request.auth.token.role === 'admin'`

**Side Effects**:
- Firestore 업데이트: `tournamentConfig.approvalStatus = 'approved'`
- 알림 전송 (Firestore Trigger): 작성자에게 승인 알림

---

### 2. rejectJobPosting (NEW)

**Purpose**: 대회 공고 거부 (admin 전용)

**Endpoint**: Firebase Callable Function
**Function Name**: `rejectJobPosting`

**Request**:
```typescript
interface RejectJobPostingRequest {
  postingId: string;               // 거부할 공고 ID
  reason: string;                  // 거부 사유 (최소 10자)
}
```

**Response**:
```typescript
interface RejectJobPostingResponse {
  success: boolean;
  postingId: string;
  rejectedAt: string;              // ISO 8601 timestamp
  rejectedBy: string;              // Admin userId
  reason: string;
}
```

**Error Cases**:
```typescript
// 권한 에러
{
  code: 'permission-denied',
  message: 'Admin 권한이 필요합니다'
}

// 거부 사유 누락/짧음
{
  code: 'invalid-argument',
  message: '거부 사유는 최소 10자 이상이어야 합니다'
}

// 공고 없음
{
  code: 'not-found',
  message: '공고를 찾을 수 없습니다'
}

// 타입 오류
{
  code: 'invalid-argument',
  message: '대회 공고만 거부 가능합니다'
}
```

**Authorization**: `request.auth.token.role === 'admin'`

**Side Effects**:
- Firestore 업데이트: `tournamentConfig.approvalStatus = 'rejected'`
- 알림 전송 (Firestore Trigger): 작성자에게 거부 알림 + 사유

---

### 3. expireFixedPostings (NEW - Scheduled)

**Purpose**: 만료된 고정 공고 자동 처리

**Endpoint**: Firebase Scheduled Function
**Schedule**: `every 1 hours` (매시간)

**Request**: None (scheduled)

**Response**: None (background)

**Logic**:
```typescript
// 만료된 고정 공고 조회
const now = Timestamp.now();
const query = db.collection('jobPostings')
  .where('postingType', '==', 'fixed')
  .where('fixedConfig.expiresAt', '<=', now)
  .where('status', '==', 'open')
  .limit(100);

// 배치 업데이트
const batch = db.batch();
snapshot.docs.forEach(doc => {
  batch.update(doc.ref, {
    status: 'closed',
    statusChangeReason: '고정 공고 기간 만료',
    statusChangedAt: FieldValue.serverTimestamp()
  });
});

await batch.commit();
```

**Side Effects**:
- Firestore 업데이트: `status = 'closed'`
- 알림 전송: 작성자에게 만료 알림 (선택적)

---

## Firestore Queries API

### 1. 타입별 공고 조회

**Purpose**: 특정 타입의 공고 목록 조회

**Query**:
```typescript
const q = query(
  collection(db, 'jobPostings'),
  where('postingType', '==', postingType),  // 'regular' | 'fixed' | 'tournament' | 'urgent'
  where('status', '==', 'open'),
  orderBy('createdAt', 'desc'),
  limit(20)
);

const snapshot = await getDocs(q);
const postings = snapshot.docs.map(doc => ({
  id: doc.id,
  ...doc.data()
}));
```

**Required Index**: `postingType (ASC) + status (ASC) + createdAt (DESC)`

**Filters**:
- `postingType`: 공고 타입 (필수)
- `status`: 'open' | 'closed' (선택)
- `district`: 지역 (선택, 추가 인덱스 필요)

**Pagination**: `startAfter(lastDoc)` 사용

---

### 2. 승인 대기 대회 공고 조회 (Admin)

**Purpose**: admin이 승인 대기 중인 대회 공고 조회

**Query**:
```typescript
const q = query(
  collection(db, 'jobPostings'),
  where('postingType', '==', 'tournament'),
  where('tournamentConfig.approvalStatus', '==', 'pending'),
  orderBy('createdAt', 'desc')
);

const snapshot = await getDocs(q);
const pendingPostings = snapshot.docs.map(doc => ({
  id: doc.id,
  ...doc.data()
}));
```

**Required Index**: `postingType (ASC) + tournamentConfig.approvalStatus (ASC) + createdAt (DESC)`

**Authorization**: `role === 'admin'` (클라이언트 측 체크)

---

### 3. 내 공고 조회

**Purpose**: 사용자가 작성한 공고 조회 (모든 타입)

**Query**:
```typescript
const q = query(
  collection(db, 'jobPostings'),
  where('createdBy', '==', userId),
  orderBy('createdAt', 'desc')
);

const snapshot = await getDocs(q);
const myPostings = snapshot.docs.map(doc => ({
  id: doc.id,
  ...doc.data()
}));
```

**Required Index**: `createdBy (ASC) + createdAt (DESC)` (자동 생성)

**Filters**:
- `status`: 'open' | 'closed' (선택)
- `postingType`: 특정 타입만 (선택)

---

### 4. 날짜별 공고 필터링 (클라이언트 측)

**Purpose**: 클라이언트 측에서 날짜로 필터링 (Firestore 비용 절감)

**Client-side Filter**:
```typescript
const filteredPostings = postings.filter(posting =>
  posting.dateSpecificRequirements.some(req =>
    isSameDay(parseISO(req.date), selectedDate)
  )
);
```

**Rationale**:
- Firestore에서 배열 필드(`dateSpecificRequirements`) 쿼리는 복잡하고 비효율적
- 클라이언트 측 필터링이 더 빠르고 저렴함
- 16일 범위는 충분히 작아서 성능 문제 없음

---

## Client-side API (Hooks)

### 1. useJobPostings (Extended)

**Purpose**: 공고 목록 조회 (타입별 쿼리)

**Hook Signature**:
```typescript
interface UseJobPostingsOptions {
  postingType?: PostingType;        // 타입 필터 (선택)
  status?: 'open' | 'closed';       // 상태 필터 (선택)
  district?: string;                // 지역 필터 (선택)
  limit?: number;                   // 페이지 크기 (기본값: 20)
}

function useJobPostings(options: UseJobPostingsOptions): {
  postings: JobPosting[];
  loading: boolean;
  error: Error | null;
  hasMore: boolean;
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
}
```

**Usage**:
```typescript
// 지원 공고만 조회
const { postings, loading } = useJobPostings({
  postingType: 'regular',
  status: 'open'
});

// 모든 공고 조회
const { postings } = useJobPostings({});
```

---

### 2. useJobPostingApproval (NEW)

**Purpose**: 승인 시스템 (admin 전용)

**Hook Signature**:
```typescript
function useJobPostingApproval(): {
  pendingPostings: JobPosting[];    // 승인 대기 공고
  loading: boolean;
  error: Error | null;
  approve: (postingId: string) => Promise<void>;
  reject: (postingId: string, reason: string) => Promise<void>;
}
```

**Usage**:
```typescript
const { pendingPostings, approve, reject } = useJobPostingApproval();

// 승인
await approve('posting123');

// 거부
await reject('posting456', '공고 내용이 부적절합니다');
```

**Authorization**: admin 권한 체크 (클라이언트 + 서버)

---

### 3. useJobPostingOperations (Extended)

**Purpose**: 공고 CRUD (타입별 config 지원)

**Hook Signature**:
```typescript
interface CreateJobPostingData {
  // 기존 필드 + 새 필드
  postingType: PostingType;
  fixedConfig?: Omit<FixedConfig, 'createdAt' | 'expiresAt'>; // 기간만 입력
  tournamentConfig?: Pick<TournamentConfig, 'submittedAt'>;
  urgentConfig?: Pick<UrgentConfig, 'priority'>;
  // ... 기타 필드
}

function useJobPostingOperations(): {
  createPosting: (data: CreateJobPostingData) => Promise<string>; // postingId 반환
  updatePosting: (id: string, data: Partial<CreateJobPostingData>) => Promise<void>;
  deletePosting: (id: string) => Promise<void>;
  processing: boolean;
  error: Error | null;
}
```

**Usage**:
```typescript
const { createPosting } = useJobPostingOperations();

// 고정 공고 작성
await createPosting({
  title: '홀덤 딜러 모집',
  postingType: 'fixed',
  fixedConfig: {
    durationDays: 30,  // 30일
    chipCost: 5        // 5칩
  },
  // ... 기타 필드
});

// 대회 공고 작성
await createPosting({
  title: '대규모 토너먼트',
  postingType: 'tournament',
  tournamentConfig: {
    submittedAt: Timestamp.now()
  },
  // ... 기타 필드
});
```

**Validation**: 클라이언트 측 타입 검증 + Firestore Security Rules

---

## Error Handling

### Standard Error Format

```typescript
interface APIError {
  code: string;                     // Firebase error code
  message: string;                  // 사용자 친화적 메시지
  details?: Record<string, any>;    // 추가 정보
}
```

### Common Error Codes

| Code | 의미 | 사용자 메시지 |
|------|------|---------------|
| `permission-denied` | 권한 없음 | "이 작업을 수행할 권한이 없습니다" |
| `not-found` | 리소스 없음 | "요청한 공고를 찾을 수 없습니다" |
| `invalid-argument` | 잘못된 입력 | "입력 값을 확인해 주세요" |
| `failed-precondition` | 전제 조건 실패 | "현재 상태에서 이 작업을 수행할 수 없습니다" |
| `unauthenticated` | 인증 필요 | "로그인이 필요합니다" |
| `resource-exhausted` | 할당량 초과 | "잠시 후 다시 시도해 주세요" |

### Error Handling Pattern

```typescript
try {
  await approve(postingId);
  toast.success('공고가 승인되었습니다');
} catch (error) {
  if (error.code === 'permission-denied') {
    toast.error('Admin 권한이 필요합니다');
  } else if (error.code === 'not-found') {
    toast.error('공고를 찾을 수 없습니다');
  } else {
    logger.error('공고 승인 실패', { error, postingId });
    toast.error('공고 승인 중 오류가 발생했습니다');
  }
}
```

---

## Rate Limiting

### Firestore Reads
- **타입별 쿼리**: 캐싱 (5분 TTL) 적용
- **승인 대기 조회**: admin만 접근, 제한 없음
- **내 공고 조회**: 사용자당 제한 없음

### Firestore Writes
- **공고 작성**: 사용자당 10개/분
- **승인/거부**: admin 제한 없음
- **업데이트**: 사용자당 5개/분

### Firebase Functions
- **approveJobPosting**: 10 req/s (admin)
- **rejectJobPosting**: 10 req/s (admin)
- **expireFixedPostings**: 1 req/hour (scheduled)

---

## Summary

**New Functions**: `approveJobPosting`, `rejectJobPosting`, `expireFixedPostings` (scheduled)

**Extended Hooks**: `useJobPostings` (타입별 쿼리), `useJobPostingOperations` (타입별 config)

**New Hooks**: `useJobPostingApproval` (승인 시스템)

**Error Handling**: 표준 에러 형식 + 사용자 친화적 메시지

**Rate Limiting**: Firestore 읽기/쓰기 + Functions 호출 제한

**Next Steps**: quickstart.md 작성
