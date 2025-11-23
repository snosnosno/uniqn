# Data Model: 고정공고 조회 Hook 및 카드 컴포넌트

**Branch**: `001-fixed-job-listing` | **Date**: 2025-11-23
**Phase**: Phase 1 - Design
**Spec**: [spec.md](./spec.md) | **Research**: [research.md](./research.md)

## 개요

이 문서는 고정공고 조회 기능에서 사용하는 데이터 모델을 정의합니다. 모든 타입은 기존 `app2/src/types/jobPosting/jobPosting.ts`에 정의되어 있으며, 이 문서는 해당 타입의 사용 방법과 제약사항을 설명합니다.

---

## 핵심 엔티티

### 1. FixedJobPosting

**정의**: 고정공고 정보를 나타내는 엔티티

**타입 정의 위치**: [app2/src/types/jobPosting/jobPosting.ts:287-313](../../app2/src/types/jobPosting/jobPosting.ts#L287-L313)

**주요 속성**:

| 속성 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `id` | string | ✅ | Firestore 문서 ID |
| `title` | string | ✅ | 공고 제목 |
| `postingType` | `'fixed'` | ✅ | 공고 타입 (리터럴 타입) |
| `status` | `'open' \| 'closed'` | ✅ | 공고 상태 |
| `fixedConfig` | FixedConfig | ✅ | 고정공고 설정 (노출 기간, 칩 비용 등) |
| `fixedData` | FixedJobPostingData | ✅ | 고정공고 전용 데이터 (근무 일정, 모집 역할, 조회수) |
| `requiredRoles` | string[] | ❌ | 역할 이름 배열 (fixedData.requiredRolesWithCount와 동기화) |
| `createdAt` | Timestamp | ✅ | 생성 시각 (정렬 기준) |
| `description` | string | ✅ | 공고 설명 |
| `location` | string | ✅ | 근무 지역 |
| `createdBy` | string | ✅ | 작성자 userId |

**예시**:
```typescript
const posting: FixedJobPosting = {
  id: 'abc123',
  title: '딜러 모집',
  postingType: 'fixed',
  status: 'open',
  fixedConfig: {
    durationDays: 30,
    chipCost: 5,
    expiresAt: Timestamp.now(),
    createdAt: Timestamp.now()
  },
  fixedData: {
    workSchedule: {
      daysPerWeek: 5,
      startTime: '14:00',
      endTime: '22:00'
    },
    requiredRolesWithCount: [
      { name: '딜러', count: 3 },
      { name: '플로어 매니저', count: 1 }
    ],
    viewCount: 42
  },
  requiredRoles: ['딜러', '플로어 매니저'], // fixedData.requiredRolesWithCount에서 추출
  createdAt: Timestamp.now(),
  description: '홀덤 토너먼트 딜러를 모집합니다.',
  location: '서울 강남구',
  createdBy: 'userId123',
  dateSpecificRequirements: []
};
```

---

### 2. FixedJobPostingData (fixedData)

**정의**: 고정공고의 실제 운영 데이터

**타입 정의 위치**: [app2/src/types/jobPosting/jobPosting.ts:78-96](../../app2/src/types/jobPosting/jobPosting.ts#L78-L96)

**주요 속성**:

| 속성 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `workSchedule` | WorkSchedule | ✅ | 근무 일정 (주 출근일수, 시작/종료 시간) |
| `requiredRolesWithCount` | RoleWithCount[] | ✅ | 역할별 모집 인원 (Source of truth) |
| `viewCount` | number | ✅ | 조회수 (기본값: 0) |

**예시**:
```typescript
const fixedData: FixedJobPostingData = {
  workSchedule: {
    daysPerWeek: 5,
    startTime: '14:00',
    endTime: '22:00'
  },
  requiredRolesWithCount: [
    { name: '딜러', count: 3 },
    { name: '플로어 매니저', count: 1 }
  ],
  viewCount: 0
};
```

---

### 3. WorkSchedule

**정의**: 고정공고 근무 일정

**타입 정의 위치**: [app2/src/types/jobPosting/jobPosting.ts:30-48](../../app2/src/types/jobPosting/jobPosting.ts#L30-L48)

**주요 속성**:

| 속성 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `daysPerWeek` | number | ✅ | 주 출근일수 (1-7일) |
| `startTime` | string | ✅ | 근무 시작 시간 (HH:mm 형식, 24시간제) |
| `endTime` | string | ✅ | 근무 종료 시간 (HH:mm 형식, 24시간제) |

**예시**:
```typescript
const workSchedule: WorkSchedule = {
  daysPerWeek: 5,
  startTime: '09:00',
  endTime: '18:00'
};
```

**제약사항**:
- `daysPerWeek`: 1 이상 7 이하의 정수
- `startTime`, `endTime`: HH:mm 형식 (예: "09:00", "14:30")
- `startTime`은 `endTime`보다 이전 시각이어야 함

---

### 4. RoleWithCount

**정의**: 역할별 모집 인원

**타입 정의 위치**: [app2/src/types/jobPosting/jobPosting.ts:55-68](../../app2/src/types/jobPosting/jobPosting.ts#L55-L68)

**주요 속성**:

| 속성 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `name` | string | ✅ | 역할명 (예: "딜러", "플로어 매니저") |
| `count` | number | ✅ | 모집 인원 (1명 이상) |

**예시**:
```typescript
const roles: RoleWithCount[] = [
  { name: '딜러', count: 3 },
  { name: '플로어 매니저', count: 1 },
  { name: '칩러너', count: 2 }
];
```

**제약사항**:
- `count`: 1 이상의 정수
- `name`: 비어 있지 않은 문자열

---

## 데이터 관계 및 제약사항

### 1. requiredRoles 동기화

**규칙**: `requiredRoles` 배열은 `fixedData.requiredRolesWithCount`에서 `name`만 추출하여 자동으로 동기화되어야 합니다.

**예시**:
```typescript
// fixedData.requiredRolesWithCount
[
  { name: '딜러', count: 3 },
  { name: '플로어 매니저', count: 1 }
]

// requiredRoles (자동 동기화)
['딜러', '플로어 매니저']
```

**구현 위치**:
- 공고 저장 시 자동 동기화 (Firebase Functions 또는 클라이언트 로직)
- 검증 함수 `validateFixedJobPosting`에서 불일치 검증

### 2. Firestore 필터링 조건

**쿼리 조건**:
```typescript
where('postingType', '==', 'fixed')
where('status', '==', 'open')
orderBy('createdAt', 'desc')
```

**인덱스 구성** (필수):
```
컬렉션: jobPostings
필드:
  - postingType (오름차순)
  - status (오름차순)
  - createdAt (내림차순)
```

### 3. viewCount 증가 시점

**규칙**: 사용자가 상세 페이지(`/job-postings/:id`)로 이동할 때마다 1 증가

**구현 방법**:
- 상세 페이지 컴포넌트에서 `useEffect`로 조회수 증가 API 호출
- 중복 방지 로직 없음 (동일 사용자도 방문할 때마다 카운트)

---

## 타입 가드

### isFixedJobPosting

**정의**: JobPosting 객체가 FixedJobPosting 타입인지 런타임에 검증

**타입 정의 위치**: [app2/src/types/jobPosting/jobPosting.ts:396-403](../../app2/src/types/jobPosting/jobPosting.ts#L396-L403)

**시그니처**:
```typescript
function isFixedJobPosting(posting: JobPosting): posting is FixedJobPosting
```

**사용 예시**:
```typescript
const posting: JobPosting = await fetchPosting(id);

if (isFixedJobPosting(posting)) {
  // ✅ 타입 안전: posting은 FixedJobPosting
  console.log(posting.fixedData.workSchedule.startTime);
  console.log(posting.fixedConfig.durationDays);
} else {
  // ❌ posting.fixedData는 존재하지 않을 수 있음
  console.log(posting.fixedData?.workSchedule); // 옵셔널 체이닝 필요
}
```

---

## 검증 규칙

### validateFixedJobPosting

**목적**: FixedJobPosting 데이터의 무결성 검증

**검증 항목**:
1. `fixedConfig` 필드 존재 여부
2. `fixedData` 필드 존재 여부
3. `requiredRoles`와 `requiredRolesWithCount` 동기화 상태
4. `workSchedule.daysPerWeek` 범위 (1-7)
5. `requiredRolesWithCount` 배열 비어있지 않음
6. `viewCount` >= 0

**반환값**: `boolean` (검증 통과 시 `true`)

**경고 로깅**: 불일치 발견 시 `logger.warn`으로 경고 기록

**예시**:
```typescript
const posting: FixedJobPosting = { /* ... */ };

if (!validateFixedJobPosting(posting)) {
  logger.error('Invalid FixedJobPosting', { postingId: posting.id });
  return; // 처리 중단
}

// 검증 통과 후 처리
renderCard(posting);
```

---

## Firestore 데이터 구조

### jobPostings 컬렉션

**경로**: `jobPostings/{postingId}`

**문서 예시**:
```json
{
  "id": "abc123",
  "title": "딜러 모집",
  "postingType": "fixed",
  "status": "open",
  "fixedConfig": {
    "durationDays": 30,
    "chipCost": 5,
    "expiresAt": { "_seconds": 1700000000, "_nanoseconds": 0 },
    "createdAt": { "_seconds": 1699000000, "_nanoseconds": 0 }
  },
  "fixedData": {
    "workSchedule": {
      "daysPerWeek": 5,
      "startTime": "14:00",
      "endTime": "22:00"
    },
    "requiredRolesWithCount": [
      { "name": "딜러", "count": 3 },
      { "name": "플로어 매니저", "count": 1 }
    ],
    "viewCount": 42
  },
  "requiredRoles": ["딜러", "플로어 매니저"],
  "createdAt": { "_seconds": 1699000000, "_nanoseconds": 0 },
  "description": "홀덤 토너먼트 딜러를 모집합니다.",
  "location": "서울 강남구",
  "createdBy": "userId123",
  "dateSpecificRequirements": []
}
```

---

## 참조

- **TypeScript 타입 정의**: [app2/src/types/jobPosting/jobPosting.ts](../../app2/src/types/jobPosting/jobPosting.ts)
- **Firestore 컬렉션**: `jobPostings`
- **관련 Spec**: [spec.md](./spec.md)
- **Research**: [research.md](./research.md)
