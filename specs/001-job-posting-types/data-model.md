# Data Model: 구인공고 타입 확장 시스템

**Feature**: 001-job-posting-types | **Date**: 2025-10-30
**Purpose**: Define data structures, relationships, and validation rules

## Entity Definitions

### 1. JobPosting (Extended)

**Purpose**: 구인공고 엔티티 (4가지 타입 지원)

**Fields**:
```typescript
interface JobPosting {
  // 기존 필드
  id: string;
  title: string;
  description: string;
  location: string;
  district?: string;
  detailedAddress?: string;
  contactPhone?: string;
  dateSpecificRequirements: DateSpecificRequirement[];
  requiredRoles?: string[];
  createdAt: Timestamp;
  updatedAt?: Timestamp;
  createdBy: string;
  status: 'open' | 'closed';
  applicants?: string[];
  confirmedStaff?: ConfirmedStaff[];
  preQuestions?: PreQuestion[];

  // 급여 정보
  salaryType?: 'hourly' | 'daily' | 'monthly' | 'negotiable' | 'other';
  salaryAmount?: string;
  benefits?: Benefits;
  useRoleSalary?: boolean;
  roleSalaries?: Record<string, RoleSalary>;
  taxSettings?: TaxSettings;

  // 자동 관리
  autoManageStatus?: boolean;
  statusChangeReason?: string;
  statusChangedAt?: Timestamp;
  statusChangedBy?: string;

  // ========== 새 필드 (확장) ==========

  // 공고 타입 (단일화된 필드)
  postingType: 'regular' | 'fixed' | 'tournament' | 'urgent';

  // 타입별 config (선택적, 해당 타입일 때만 존재)
  fixedConfig?: FixedConfig;         // postingType === 'fixed'일 때
  tournamentConfig?: TournamentConfig; // postingType === 'tournament'일 때
  urgentConfig?: UrgentConfig;       // postingType === 'urgent'일 때

  // 칩 시스템
  chipCost?: number;                 // 칩 비용 (fixed/urgent 타입)
  isChipDeducted: boolean;           // 칩 차감 여부 (기본값: false)

  // ========== 레거시 필드 (하위 호환성) ==========
  type?: 'application' | 'fixed';    // 읽기 전용, 유지
  recruitmentType?: 'application' | 'fixed'; // 읽기 전용, 유지
}
```

**Validation Rules**:
- `postingType`는 필수 필드
- `postingType === 'fixed'`일 때 `fixedConfig` 필수
- `postingType === 'tournament'`일 때 `tournamentConfig` 필수
- `postingType === 'urgent'`일 때 `urgentConfig` 필수
- `chipCost`는 fixed: 3/5/10, urgent: 5만 허용
- `isChipDeducted`는 기본값 false

**State Transitions**:
```
regular/fixed/urgent:
  draft → open → closed

tournament:
  draft → pending (승인 대기)
       → approved → open → closed
       → rejected (거부, 재신청 가능)
```

**Relationships**:
- `1:N` with Application (지원서)
- `1:N` with ConfirmedStaff (확정 스태프)
- `1:1` with User (createdBy)

---

### 2. FixedConfig (New)

**Purpose**: 고정 공고 설정

**Fields**:
```typescript
interface FixedConfig {
  durationDays: 7 | 30 | 90;         // 노출 기간
  chipCost: 3 | 5 | 10;              // 칩 비용 (기간에 따라)
  expiresAt: Timestamp;              // 만료일
  createdAt: Timestamp;              // 생성일
}
```

**Validation Rules**:
- `durationDays`와 `chipCost` 매핑 검증:
  - 7일 → 3칩
  - 30일 → 5칩
  - 90일 → 10칩
- `expiresAt = createdAt + durationDays`

**Computed Fields**:
- `isExpired`: `expiresAt < now()`
- `daysRemaining`: `Math.ceil((expiresAt - now()) / 86400000)`

---

### 3. TournamentConfig (New)

**Purpose**: 대회 공고 설정

**Fields**:
```typescript
interface TournamentConfig {
  approvalStatus: 'pending' | 'approved' | 'rejected'; // 승인 상태
  approvedBy?: string;               // 승인자 userId (admin)
  approvedAt?: Timestamp;            // 승인일
  rejectedBy?: string;               // 거부자 userId (admin)
  rejectedAt?: Timestamp;            // 거부일
  rejectionReason?: string;          // 거부 사유
  resubmittedAt?: Timestamp;         // 재신청일 (거부 후)
  submittedAt: Timestamp;            // 최초 제출일
}
```

**Validation Rules**:
- `approvalStatus === 'approved'`일 때 `approvedBy`, `approvedAt` 필수
- `approvalStatus === 'rejected'`일 때 `rejectedBy`, `rejectedAt`, `rejectionReason` 필수
- `rejectionReason`은 최소 10자 이상
- 재신청 시 `approvalStatus`를 'pending'으로 재설정, `resubmittedAt` 갱신

**State Transitions**:
```
pending → approved (admin 승인)
       → rejected (admin 거부)
          → pending (재신청)
```

---

### 4. UrgentConfig (New)

**Purpose**: 긴급 공고 설정

**Fields**:
```typescript
interface UrgentConfig {
  chipCost: 5;                       // 고정 5칩
  createdAt: Timestamp;              // 생성일
  priority: 'high';                  // 우선순위 (향후 확장 대비)
}
```

**Validation Rules**:
- `chipCost`는 항상 5
- `priority`는 현재 'high'만 지원 (향후 'critical' 등 추가 가능)

---

### 5. BoardTab (New)

**Purpose**: 게시판 탭 설정 (동적 탭 생성용)

**Fields**:
```typescript
interface BoardTab {
  id: string;                        // 고유 ID (regular, fixed, tournament, urgent, myApplications)
  labelKey: string;                  // i18n 키 (jobBoard.tabs.regular)
  icon: string;                      // 이모지 아이콘
  postingType?: PostingType;         // 필터링할 공고 타입 (내지원 탭은 null)
  order: number;                     // 표시 순서
  enabled: boolean;                  // Feature Flag로 제어
}
```

**Validation Rules**:
- `id`는 고유해야 함
- `order`는 1부터 시작
- `enabled === false`일 때 UI에 표시 안 됨

---

### 6. ChipPricing (New)

**Purpose**: 칩 가격 중앙 관리

**Fields**:
```typescript
interface ChipPricing {
  postingType: 'fixed' | 'urgent';   // 유료 타입만
  durationDays?: 7 | 30 | 90;        // fixed 타입일 때만
  chipCost: number;                  // 칩 비용
}
```

**Data**:
```typescript
const CHIP_PRICING: ChipPricing[] = [
  { postingType: 'fixed', durationDays: 7, chipCost: 3 },
  { postingType: 'fixed', durationDays: 30, chipCost: 5 },
  { postingType: 'fixed', durationDays: 90, chipCost: 10 },
  { postingType: 'urgent', chipCost: 5 }
];
```

---

## Firestore Collections

### jobPostings (Extended)

**Collection Path**: `/jobPostings/{postingId}`

**Indexes Required**:
```text
1. postingType (ASC) + status (ASC) + createdAt (DESC)
   - 타입별 공고 조회

2. postingType (ASC) + createdBy (ASC) + createdAt (DESC)
   - 내 공고 조회

3. postingType (ASC) + tournamentConfig.approvalStatus (ASC) + createdAt (DESC)
   - 승인 대기 공고 조회 (admin)
```

**Security Rules**:
```javascript
match /jobPostings/{postingId} {
  // 읽기: 로그인한 사용자 + 조건부
  allow read: if request.auth != null
    && (resource.data.postingType != 'tournament'
        || resource.data.tournamentConfig.approvalStatus == 'approved');

  // 생성: 로그인한 사용자
  allow create: if request.auth != null
    && request.resource.data.createdBy == request.auth.uid
    && validatePostingType(request.resource.data);

  // 업데이트: 작성자 또는 admin (승인만)
  allow update: if request.auth != null
    && (request.resource.data.createdBy == request.auth.uid
        || (request.auth.token.role == 'admin'
            && onlyApprovalFieldsChanged()));

  // 삭제: 작성자만
  allow delete: if request.auth != null
    && resource.data.createdBy == request.auth.uid;

  // 검증 함수
  function validatePostingType(data) {
    return data.postingType in ['regular', 'fixed', 'tournament', 'urgent']
      && (data.postingType != 'fixed' || validateFixedConfig(data.fixedConfig))
      && (data.postingType != 'tournament' || validateTournamentConfig(data.tournamentConfig))
      && (data.postingType != 'urgent' || validateUrgentConfig(data.urgentConfig));
  }

  function validateFixedConfig(config) {
    return config != null
      && config.durationDays in [7, 30, 90]
      && ((config.durationDays == 7 && config.chipCost == 3)
          || (config.durationDays == 30 && config.chipCost == 5)
          || (config.durationDays == 90 && config.chipCost == 10));
  }

  function validateTournamentConfig(config) {
    return config != null
      && config.approvalStatus in ['pending', 'approved', 'rejected']
      && config.submittedAt != null;
  }

  function validateUrgentConfig(config) {
    return config != null
      && config.chipCost == 5
      && config.createdAt != null;
  }

  function onlyApprovalFieldsChanged() {
    return request.resource.data.diff(resource.data).affectedKeys()
      .hasOnly(['tournamentConfig.approvalStatus', 'tournamentConfig.approvedBy',
                'tournamentConfig.approvedAt', 'tournamentConfig.rejectedBy',
                'tournamentConfig.rejectedAt', 'tournamentConfig.rejectionReason']);
  }
}
```

---

## Data Transformation

### normalizePostingType Function

**Purpose**: 레거시 데이터를 새 형식으로 변환

**Implementation**:
```typescript
export const normalizePostingType = (
  posting: Partial<JobPosting>
): PostingType => {
  // 1. 새 필드 우선
  if (posting.postingType) {
    return posting.postingType;
  }

  // 2. 레거시 필드 변환
  const legacyType = posting.type || posting.recruitmentType;

  if (legacyType === 'application') {
    logger.warn('레거시 application 타입을 regular로 변환', {
      postingId: posting.id,
      legacyType
    });
    return 'regular';
  }

  if (legacyType === 'fixed') {
    logger.warn('레거시 fixed 타입을 fixed로 유지', {
      postingId: posting.id,
      legacyType
    });
    return 'fixed';
  }

  // 3. 기본값 (에러 케이스)
  logger.error('postingType 필드 없음, regular로 기본 설정', {
    postingId: posting.id,
    type: posting.type,
    recruitmentType: posting.recruitmentType
  });
  return 'regular';
};
```

---

## Data Migration Strategy

### Phase 1: Immediate (런타임 변환)
- `normalizePostingType` 함수 배포
- 기존 공고 정상 작동
- 레거시 필드 유지

### Phase 2: Gradual (신규 공고)
- 새 공고는 `postingType` 사용
- 1주일 후 대부분 새 형식

### Phase 3: Batch (선택적 마이그레이션)
- Firebase Functions 배치 스크립트
- 기존 공고에 `postingType` 추가
- 레거시 필드 유지 (하위 호환성)

### Phase 4: Cleanup (6개월 후 고려)
- 레거시 필드 제거 검토
- 모든 공고 새 형식 확인 후

**Migration Script** (선택적):
```typescript
// functions/src/migrations/addPostingType.ts
export const addPostingTypeToExistingPostings = onRequest(async (req, res) => {
  // admin 권한 체크
  if (!req.auth || req.auth.token.role !== 'admin') {
    res.status(403).send('Admin 권한 필요');
    return;
  }

  const batch = db.batch();
  let count = 0;

  // postingType 없는 공고 조회
  const snapshot = await db.collection('jobPostings')
    .where('postingType', '==', null)
    .limit(500)  // 배치 제한
    .get();

  snapshot.docs.forEach(doc => {
    const data = doc.data();
    const postingType = normalizePostingType(data);

    batch.update(doc.ref, { postingType });
    count++;
  });

  await batch.commit();

  res.send({ success: true, updatedCount: count });
});
```

---

## Summary

**New Entities**: FixedConfig, TournamentConfig, UrgentConfig, BoardTab, ChipPricing

**Extended Entities**: JobPosting (postingType, configs, chipCost)

**Validation**: Security Rules + 타입별 config 검증

**Migration**: 런타임 변환 + 점진적 마이그레이션 (하위 호환성 유지)

**Next Steps**: API Contracts 정의 (contracts/)
