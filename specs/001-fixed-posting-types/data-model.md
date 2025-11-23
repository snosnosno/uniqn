# Data Model: 고정공고 타입 시스템

**Feature**: 001-fixed-posting-types
**Date**: 2025-11-23
**Phase**: 1 - Design & Contracts

## Overview

고정공고 타입 시스템의 데이터 모델 정의 문서입니다. TypeScript 인터페이스와 Zod 스키마의 구조, 검증 규칙, 필드 관계를 상세히 설명합니다.

---

## Entity Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                        JobPosting                           │
│  (기존 인터페이스 - 확장만 가능)                               │
├─────────────────────────────────────────────────────────────┤
│ + id: string                                                │
│ + title: string                                             │
│ + postingType: PostingType ('regular'|'fixed'|...)          │
│ + fixedConfig?: FixedConfig                                 │
│ + fixedData?: FixedJobPostingData                           │
│ + type?: 'application'|'fixed' [@deprecated]                │
│ + recruitmentType?: 'application'|'fixed' [@deprecated]     │
│ + ... (기타 필드)                                            │
└─────────────────────────────────────────────────────────────┘
                          ▲
                          │ extends
                          │
┌─────────────────────────────────────────────────────────────┐
│                   FixedJobPosting                           │
│  (고정공고 전용 타입)                                          │
├─────────────────────────────────────────────────────────────┤
│ + postingType: 'fixed' (literal)                            │
│ + fixedConfig: FixedConfig (필수)                           │
│ + fixedData: FixedJobPostingData (필수)                     │
└─────────────────────────────────────────────────────────────┘
                          │
                          │ contains
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                FixedJobPostingData                          │
├─────────────────────────────────────────────────────────────┤
│ + workSchedule: WorkSchedule                                │
│ + requiredRolesWithCount: RoleWithCount[] (min 1)          │
│ + viewCount: number (default 0)                             │
└─────────────────────────────────────────────────────────────┘
            │                            │
            │ contains                   │ contains array of
            ▼                            ▼
┌──────────────────────────┐    ┌──────────────────────────┐
│     WorkSchedule         │    │    RoleWithCount         │
├──────────────────────────┤    ├──────────────────────────┤
│ + daysPerWeek: number    │    │ + name: string           │
│   (1-7)                  │    │   (min 1 char)           │
│ + startTime: string      │    │ + count: number          │
│   (HH:mm)                │    │   (min 1)                │
│ + endTime: string        │    └──────────────────────────┘
│   (HH:mm)                │
└──────────────────────────┘
```

---

## Entity Definitions

### 1. WorkSchedule

**목적**: 고정공고의 주간 근무 일정 정보

**TypeScript 인터페이스**:

```typescript
/**
 * 고정공고 근무 일정
 *
 * 주간 출근일수와 근무 시작/종료 시간을 정의합니다.
 * 시간은 24시간제 HH:mm 형식을 사용합니다.
 */
export interface WorkSchedule {
  /**
   * 주 출근일수 (1-7일)
   * @example 5 // 주 5일 근무
   */
  daysPerWeek: number;

  /**
   * 근무 시작 시간 (HH:mm 형식, 24시간제)
   * @example "09:00"
   */
  startTime: string;

  /**
   * 근무 종료 시간 (HH:mm 형식, 24시간제)
   * @example "18:00"
   */
  endTime: string;
}
```

**Zod 스키마**:

```typescript
export const workScheduleSchema = z.object({
  daysPerWeek: z.number()
    .int({ message: '출근일수는 정수여야 합니다' })
    .min(1, { message: '최소 주 1일 이상 근무해야 합니다' })
    .max(7, { message: '주 7일을 초과할 수 없습니다' }),

  startTime: z.string()
    .regex(/^\d{2}:\d{2}$/, {
      message: '시작 시간은 HH:mm 형식이어야 합니다 (예: 09:00)'
    }),

  endTime: z.string()
    .regex(/^\d{2}:\d{2}$/, {
      message: '종료 시간은 HH:mm 형식이어야 합니다 (예: 18:00)'
    })
});
```

**검증 규칙**:
- `daysPerWeek`: 1 이상 7 이하의 정수
- `startTime`, `endTime`: 정규식 `/^\d{2}:\d{2}$/` 매칭 (2자리 시:2자리 분)

**엣지 케이스**:
- ❌ "9:00" (한 자리 시간) → 정규식 실패
- ❌ "09:00:00" (초 포함) → 정규식 실패
- ❌ "25:00" (잘못된 시간) → 정규식 통과하지만 논리적 오류 (추가 검증 고려)
- ✅ "00:00" (자정) → 유효
- ✅ "23:59" (자정 직전) → 유효

**사용 예시**:

```typescript
const schedule: WorkSchedule = {
  daysPerWeek: 5,
  startTime: "09:00",
  endTime: "18:00"
};

// Zod 검증
const result = workScheduleSchema.safeParse(schedule);
if (result.success) {
  console.log("유효한 일정:", result.data);
}
```

---

### 2. RoleWithCount

**목적**: 모집하려는 역할과 인원수 정보

**TypeScript 인터페이스**:

```typescript
/**
 * 역할별 모집 인원
 *
 * 고정공고에서 모집하려는 역할명과 필요 인원수를 정의합니다.
 */
export interface RoleWithCount {
  /**
   * 역할명
   * @example "딜러"
   * @example "플로어 매니저"
   */
  name: string;

  /**
   * 모집 인원 (1명 이상)
   * @example 3
   */
  count: number;
}
```

**Zod 스키마**:

```typescript
export const roleWithCountSchema = z.object({
  name: z.string()
    .min(1, { message: '역할명을 입력해주세요' }),

  count: z.number()
    .int({ message: '모집 인원은 정수여야 합니다' })
    .min(1, { message: '최소 1명 이상 모집해야 합니다' })
});
```

**검증 규칙**:
- `name`: 최소 1글자 이상의 문자열
- `count`: 1 이상의 정수

**엣지 케이스**:
- ❌ "" (빈 문자열) → `min(1)` 실패
- ❌ 0 → `min(1)` 실패
- ❌ -1 (음수) → `min(1)` 실패
- ✅ "기타" → 유효
- ✅ 100 → 유효 (상한 없음)

**사용 예시**:

```typescript
const role: RoleWithCount = {
  name: "딜러",
  count: 3
};

// Zod 검증
const result = roleWithCountSchema.safeParse(role);
```

---

### 3. FixedJobPostingData

**목적**: 고정공고 전용 메타데이터 (근무 일정, 역할별 인원, 조회수)

**TypeScript 인터페이스**:

```typescript
/**
 * 고정공고 전용 데이터
 *
 * 고정공고에서만 사용하는 추가 정보를 정의합니다.
 * - 근무 일정 (WorkSchedule)
 * - 역할별 모집 인원 (RoleWithCount[])
 * - 조회수
 */
export interface FixedJobPostingData {
  /**
   * 근무 일정
   */
  workSchedule: WorkSchedule;

  /**
   * 역할별 모집 인원 (Source of truth)
   *
   * 이 필드가 고정공고의 역할 및 인원 정보의 신뢰 원천입니다.
   * 최소 1개 이상의 역할을 포함해야 합니다.
   */
  requiredRolesWithCount: RoleWithCount[];

  /**
   * 조회수 (기본값: 0)
   */
  viewCount: number;
}
```

**Zod 스키마**:

```typescript
export const fixedJobPostingDataSchema = z.object({
  workSchedule: workScheduleSchema,

  requiredRolesWithCount: z.array(roleWithCountSchema)
    .min(1, { message: '최소 1개 이상의 역할을 추가해주세요' }),

  viewCount: z.number()
    .int({ message: '조회수는 정수여야 합니다' })
    .min(0, { message: '조회수는 0 이상이어야 합니다' })
    .default(0)
});
```

**검증 규칙**:
- `workSchedule`: `workScheduleSchema` 검증 통과
- `requiredRolesWithCount`: 최소 1개 이상의 유효한 `RoleWithCount` 배열
- `viewCount`: 0 이상의 정수, 기본값 0

**엣지 케이스**:
- ❌ `requiredRolesWithCount: []` (빈 배열) → `.min(1)` 실패
- ❌ `viewCount: -1` (음수) → `.min(0)` 실패
- ✅ `requiredRolesWithCount: [{name: "딜러", count: 1}]` → 유효
- ✅ `viewCount` 생략 → 기본값 0 사용

**사용 예시**:

```typescript
const fixedData: FixedJobPostingData = {
  workSchedule: {
    daysPerWeek: 5,
    startTime: "09:00",
    endTime: "18:00"
  },
  requiredRolesWithCount: [
    { name: "딜러", count: 3 },
    { name: "플로어 매니저", count: 1 }
  ],
  viewCount: 0
};
```

---

### 4. FixedJobPosting

**목적**: 고정공고 타입의 완전한 정의 (JobPosting 확장)

**TypeScript 인터페이스**:

```typescript
/**
 * 고정공고 타입
 *
 * JobPosting을 확장하여 고정공고 전용 필드를 필수로 요구합니다.
 * - postingType은 리터럴 타입 'fixed'로 좁혀짐
 * - fixedConfig와 fixedData는 필수 필드
 */
export interface FixedJobPosting extends JobPosting {
  /**
   * 공고 타입 (리터럴 타입 'fixed')
   */
  postingType: 'fixed';

  /**
   * 고정 공고 설정 (필수)
   *
   * 노출 기간, 칩 비용, 만료일 등의 정보를 포함합니다.
   */
  fixedConfig: FixedConfig;

  /**
   * 고정공고 전용 데이터 (필수)
   *
   * 근무 일정, 역할별 인원, 조회수 등의 정보를 포함합니다.
   */
  fixedData: FixedJobPostingData;
}
```

**Zod 스키마**:

```typescript
// 기존 jobPostingFormSchema를 확장
export const fixedJobPostingSchema = jobPostingFormSchema.extend({
  postingType: z.literal('fixed'),

  fixedConfig: fixedConfigSchema, // 기존 스키마 재사용

  fixedData: fixedJobPostingDataSchema
});
```

**검증 규칙**:
- `postingType`: 정확히 'fixed' 문자열이어야 함 (리터럴 타입)
- `fixedConfig`: `fixedConfigSchema` 검증 통과
- `fixedData`: `fixedJobPostingDataSchema` 검증 통과

**타입 가드 함수**:

```typescript
/**
 * 고정공고 타입 가드
 *
 * JobPosting이 FixedJobPosting인지 런타임에 확인합니다.
 * 타입 가드를 통과하면 TypeScript가 타입을 FixedJobPosting으로 좁힙니다.
 *
 * @param posting - 검사할 JobPosting 객체
 * @returns posting이 FixedJobPosting이면 true
 *
 * @example
 * if (isFixedJobPosting(posting)) {
 *   // 여기서 posting은 FixedJobPosting 타입
 *   console.log(posting.fixedData.workSchedule.daysPerWeek);
 * }
 */
export function isFixedJobPosting(posting: JobPosting): posting is FixedJobPosting {
  return posting.postingType === 'fixed'
    && posting.fixedConfig !== undefined
    && posting.fixedData !== undefined;
}
```

**사용 예시**:

```typescript
function processPosting(posting: JobPosting) {
  if (isFixedJobPosting(posting)) {
    // TypeScript가 타입을 FixedJobPosting으로 좁힘
    const daysPerWeek = posting.fixedData.workSchedule.daysPerWeek;
    const roles = posting.fixedData.requiredRolesWithCount;

    console.log(`주 ${daysPerWeek}일 근무`);
    console.log(`모집 역할: ${roles.map(r => r.name).join(', ')}`);
  } else {
    console.log('고정공고가 아닙니다');
  }
}
```

---

## Relationship & Dependencies

### 필드 의존성

```
FixedJobPosting
├── postingType: 'fixed' (리터럴)
├── fixedConfig: FixedConfig (기존 타입 재사용)
└── fixedData: FixedJobPostingData
    ├── workSchedule: WorkSchedule
    │   ├── daysPerWeek: number (1-7)
    │   ├── startTime: string (HH:mm)
    │   └── endTime: string (HH:mm)
    ├── requiredRolesWithCount: RoleWithCount[] (min 1)
    │   └── RoleWithCount
    │       ├── name: string (min 1 char)
    │       └── count: number (min 1)
    └── viewCount: number (min 0, default 0)
```

### 타입 계층

```
JobPosting (기존)
  ↓ extends
FixedJobPosting (새로운 타입)
  ↓ contains
FixedJobPostingData (새로운 타입)
  ↓ contains
WorkSchedule + RoleWithCount[] (새로운 타입)
```

---

## 레거시 필드 처리

### Deprecated 필드

```typescript
export interface JobPosting {
  /**
   * @deprecated 이 필드는 더 이상 사용되지 않습니다. postingType을 사용하세요.
   * 기존 데이터 호환성을 위해 유지됩니다.
   *
   * @see {@link postingType}
   */
  type?: 'application' | 'fixed';

  /**
   * @deprecated 이 필드는 더 이상 사용되지 않습니다. postingType을 사용하세요.
   * 기존 데이터 호환성을 위해 유지됩니다.
   *
   * @see {@link postingType}
   */
  recruitmentType?: 'application' | 'fixed';

  /**
   * 공고 타입 (4가지)
   */
  postingType: PostingType;
}
```

### 변환 헬퍼 (`normalizePostingType`)

**동작 방식**:

```typescript
export function normalizePostingType(data: Partial<JobPosting>): PostingType {
  // 1순위: postingType
  if (data.postingType) {
    return data.postingType;
  }

  // 2순위: type (레거시)
  if (data.type === 'fixed') {
    return 'fixed';
  }
  if (data.type === 'application') {
    return 'regular';
  }

  // 3순위: recruitmentType (레거시)
  if (data.recruitmentType === 'application') {
    return 'regular';
  }

  // 기본값
  return 'regular';
}
```

**우선순위**:
1. `postingType` (새 필드)
2. `type` (레거시 필드)
3. `recruitmentType` (레거시 필드)
4. 기본값: `'regular'`

---

## 마이그레이션 전략

### 읽기 (Firestore → 앱)

```typescript
function loadPosting(firestoreData: FirestoreDocument): JobPosting {
  // 레거시 필드 변환
  const postingType = normalizePostingType(firestoreData);

  // fixedData가 없으면 기본값 (임시)
  const fixedData = firestoreData.fixedData || null;

  return {
    ...firestoreData,
    postingType,
    fixedData
  };
}
```

### 쓰기 (앱 → Firestore)

```typescript
function savePosting(formData: JobPostingFormData): FirestoreData {
  // 새 필드만 사용
  return {
    postingType: formData.postingType,
    fixedData: formData.fixedData,
    // type, recruitmentType 제거
  };
}
```

---

## 다음 단계

1. ✅ Data Model 정의 완료
2. 🔄 `quickstart.md` 작성 (개발자 가이드)
3. ⏭️ `/speckit.tasks`로 구현 작업 목록 생성
