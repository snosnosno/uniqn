# Data Model: 고정공고 상세보기

**Date**: 2025-11-23
**Feature**: 001-fixed-job-detail
**Purpose**: Phase 1 데이터 모델 정의

---

## Overview

고정공고 상세보기 기능은 Phase 1-3에서 정의된 기존 타입 시스템을 활용합니다. Phase 4에서는 새로운 타입을 추가하지 않고, 기존 `FixedJobPosting` 타입의 필드를 화면에 표시하고 `viewCount`를 증가시키는 로직만 구현합니다.

---

## Existing Entities (Phase 1-3)

### FixedJobPosting

**정의 위치**: `app2/src/types/jobPosting/index.ts`

```typescript
interface FixedJobPosting extends BaseJobPosting {
  postingType: 'fixed';  // 고정공고 구분자
  fixedData: FixedJobPostingData;
}
```

### FixedJobPostingData

```typescript
interface FixedJobPostingData {
  workSchedule: WorkSchedule;                       // 근무 일정
  requiredRolesWithCount: RequiredRoleWithCount[];  // 모집 역할 및 인원
  viewCount: number;                                // ✨ 조회수 (Phase 4에서 사용)
  // ... 기타 필드 (Phase 1-3에서 정의됨)
}
```

### WorkSchedule

```typescript
interface WorkSchedule {
  daysPerWeek: number;    // 주 출근일수 (예: 5)
  startTime: string;      // 근무 시작시간 (예: "09:00")
  endTime: string;        // 근무 종료시간 (예: "18:00")
}
```

### RequiredRoleWithCount

```typescript
interface RequiredRoleWithCount {
  name: string;    // 역할 이름 (예: "딜러", "플로어")
  count: number;   // 필요 인원 (예: 3)
}
```

---

## Phase 4 Additions

### ViewCountService Interface

**새 파일**: `specs/001-fixed-job-detail/contracts/fixedJobPosting.ts`

```typescript
export interface ViewCountService {
  /**
   * 고정공고 조회수 증가
   * @param postingId - 공고 ID
   * @throws 네트워크 오류 시 에러 발생하지만 사용자 경험 방해하지 않음
   */
  incrementViewCount(postingId: string): Promise<void>;
}
```

**구현 위치**: `app2/src/services/fixedJobPosting.ts` (Phase 2에서 생성)

---

## Data Flow

### 1. 조회수 증가 플로우

```
사용자 카드 클릭
  ↓
handleCardClick()
  ↓
incrementViewCount(postingId) ← Firestore increment()
  ↓ (비동기, fire-and-forget)
Firestore: fixedData.viewCount += 1
  ↓ (실패 시 logger.error, 사용자는 모르게)
openDetailModal(posting) ← 모달 즉시 오픈
```

### 2. 상세보기 데이터 플로우

```
useFixedJobPostings() Hook (Phase 3)
  ↓
Firestore onSnapshot('jobPostings')
  ↓
FixedJobPosting[] (viewCount 포함)
  ↓
JobDetailModal → JobPostingDetailContent
  ↓
고정공고 섹션 렌더링
  ├── workSchedule 표시
  └── requiredRolesWithCount 표시
```

---

## Firestore Schema

### Collection: `jobPostings`

**Document Structure**:
```json
{
  "id": "posting-123",
  "postingType": "fixed",
  "title": "홀덤 토너먼트 정규직 딜러 모집",
  "location": "서울",
  "status": "active",
  "createdAt": "2025-11-23T00:00:00Z",

  "fixedData": {
    "workSchedule": {
      "daysPerWeek": 5,
      "startTime": "09:00",
      "endTime": "18:00"
    },
    "requiredRolesWithCount": [
      { "name": "딜러", "count": 3 },
      { "name": "플로어", "count": 2 }
    ],
    "viewCount": 42  // ← Phase 4에서 증가
  }
}
```

### Index: `jobPostings_postingType_status_createdAt`

**필드**:
- `postingType` (ASC)
- `status` (ASC)
- `createdAt` (DESC)

**쿼리 예시**:
```typescript
const q = query(
  collection(db, 'jobPostings'),
  where('postingType', '==', 'fixed'),
  where('status', '==', 'active'),
  orderBy('createdAt', 'desc')
);
```

---

## Validation Rules

### WorkSchedule

- `daysPerWeek`: 1-7 범위
- `startTime`, `endTime`: "HH:mm" 형식, startTime < endTime

### RequiredRoleWithCount

- `name`: 비어있지 않은 문자열
- `count`: 1 이상의 정수

### viewCount

- **초기값**: 0 (고정공고 생성 시)
- **증가**: increment(1) 사용 (동시성 안전)
- **범위**: 0 이상의 정수 (음수 불가)

---

## State Transitions

### viewCount 상태 변화

```
고정공고 생성 → viewCount = 0
  ↓
사용자 카드 클릭 (1회) → viewCount = 1
  ↓
사용자 카드 클릭 (2회) → viewCount = 2
  ↓
...
  ↓
viewCount = N (N → ∞)
```

**참고**:
- viewCount는 단방향 증가만 가능 (감소 로직 없음)
- 사용자별 중복 조회 카운트 (Out of Scope: 중복 방지 로직 없음)

---

## Relationships

### FixedJobPosting ↔ Firestore

```
FixedJobPosting (TypeScript)
  ↕ (Firestore SDK)
jobPostings/{docId} (Firestore Document)
```

### JobDetailModal ↔ FixedJobPosting

```
JobDetailModal (Component)
  ↓ (receives)
jobPosting: FixedJobPosting | null
  ↓ (passes to)
JobPostingDetailContent
  ↓ (renders)
고정공고 섹션 (조건부)
```

---

## Data Constraints (CLAUDE.md 준수)

### TypeScript Strict Mode

- [x] 모든 타입 명시 (no `any`)
- [x] Optional chaining 사용 (`posting.fixedData?.viewCount`)
- [x] Nullability 체크 (`if (!jobPosting) return null`)

### 표준 필드명

- [x] `fixedData` (not `fixed_data`, `fixedJobData`)
- [x] `viewCount` (not `view_count`, `views`)
- [x] `requiredRolesWithCount` (not `required_roles`)

### Firestore 규칙

- [x] `onSnapshot` 사용 (실시간 구독, Phase 3에서 구현됨)
- [x] `increment()` 사용 (조회수 원자적 증가)
- [x] 상대 경로만 사용 (import 경로)

---

## Summary

- **기존 타입 활용**: FixedJobPosting, WorkSchedule, RequiredRoleWithCount
- **새 타입 없음**: Phase 4는 기존 타입만 사용
- **Firestore 인덱스**: postingType, status, createdAt 복합 인덱스
- **조회수 증가**: increment() 원자적 연산
- **빈 역할 처리**: `requiredRolesWithCount.length === 0` 체크

**다음 단계**: contracts/fixedJobPosting.ts 생성
