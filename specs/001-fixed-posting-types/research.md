# Research Document: 고정공고 타입 시스템 확장

**Feature**: 001-fixed-posting-types
**Date**: 2025-11-23
**Phase**: 0 - Outline & Research

## Overview

고정공고 타입 시스템 확장을 위한 기술 조사 및 설계 결정 문서입니다. TypeScript 타입 시스템, Zod 스키마 검증, 레거시 호환성 전략에 대한 연구 결과를 포함합니다.

---

## Research Area 1: Zod 스키마 패턴 연구

### 현재 프로젝트의 Zod 사용 패턴

#### 기존 스키마 구조 분석

**파일**: `app2/src/schemas/jobPosting/index.ts`

```typescript
// 패턴 1: 섹션별 스키마 분리
import { basicInfoSchema } from './basicInfo.schema';
import { dateRequirementsSchema } from './dateRequirements.schema';
import { preQuestionsSchemaBase } from './preQuestions.schema';
import { salarySchemaBase } from './salary.schema';

// 패턴 2: .merge()로 조합
export const jobPostingFormSchema = basicInfoSchema
  .merge(dateRequirementsSchema)
  .merge(preQuestionsSchemaBase)
  .merge(salarySchemaBase)
  .refine(...); // Cross-field 검증
```

**발견 사항**:
1. 각 섹션별로 독립적인 스키마 파일 유지
2. `index.ts`에서 `.merge()`로 조합
3. `.refine()`으로 필드 간 의존성 검증
4. Base 스키마와 확장 스키마 분리 패턴 (`preQuestionsSchemaBase` vs `preQuestionsSchema`)

#### 에러 메시지 국제화 패턴

**파일**: `app2/src/schemas/jobPosting/basicInfo.schema.ts`

```typescript
z.string().min(1, '제목을 입력해주세요')
z.string().min(1, '장소를 입력해주세요')
```

**발견 사항**:
- 에러 메시지를 한글로 직접 작성
- 별도의 i18n 시스템 사용하지 않음
- 간결하고 명확한 메시지 선호

### 설계 결정

**Decision**: 고정공고 전용 스키마를 `fixedPosting.schema.ts`에 분리

**Implementation**:

```typescript
// app2/src/schemas/jobPosting/fixedPosting.schema.ts

import { z } from 'zod';

export const workScheduleSchema = z.object({
  daysPerWeek: z.number().int().min(1, '최소 주 1일 이상 근무해야 합니다').max(7, '주 7일을 초과할 수 없습니다'),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, '시작 시간은 HH:mm 형식이어야 합니다 (예: 09:00)'),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, '종료 시간은 HH:mm 형식이어야 합니다 (예: 18:00)')
});

export const roleWithCountSchema = z.object({
  name: z.string().min(1, '역할명을 입력해주세요'),
  count: z.number().int().min(1, '최소 1명 이상 모집해야 합니다')
});

export const fixedJobPostingDataSchema = z.object({
  workSchedule: workScheduleSchema,
  requiredRolesWithCount: z.array(roleWithCountSchema).min(1, '최소 1개 이상의 역할을 추가해주세요'),
  viewCount: z.number().int().min(0).default(0)
});
```

**Rationale**:
- 기존 패턴과 일관성 유지
- 각 스키마의 독립적 테스트 가능
- 재사용성 향상

---

## Research Area 2: TypeScript 타입 가드 베스트 프랙티스

### `is` 키워드와 타입 좁히기

#### 베스트 프랙티스

**참조**: TypeScript Handbook - Narrowing

1. **타입 가드 함수 시그니처**:
   ```typescript
   function isType(value: ParentType): value is ChildType
   ```

2. **런타임 검증 필수**:
   - 모든 필수 필드 존재 여부 확인
   - `undefined` 체크 명시적으로 수행

3. **타입 좁히기 효과**:
   - `if (isType(value))` 블록 내에서 타입 자동 좁혀짐
   - IDE 자동완성 지원

### 설계 결정

**Decision**: 3가지 조건을 모두 체크하는 타입 가드 구현

**Implementation**:

```typescript
/**
 * 고정공고 타입 가드
 *
 * JobPosting이 FixedJobPosting인지 확인합니다.
 *
 * @param posting - 검사할 JobPosting 객체
 * @returns posting이 FixedJobPosting이면 true
 *
 * @example
 * if (isFixedJobPosting(posting)) {
 *   console.log(posting.fixedData.workSchedule.daysPerWeek);
 * }
 */
export function isFixedJobPosting(posting: JobPosting): posting is FixedJobPosting {
  return posting.postingType === 'fixed'
    && posting.fixedConfig !== undefined
    && posting.fixedData !== undefined;
}
```

**Rationale**:
- 리터럴 타입 검사 (`postingType === 'fixed'`)로 1차 필터링
- 필수 필드 존재 확인으로 런타임 안전성 보장
- TypeScript 컴파일러가 타입을 올바르게 좁힐 수 있음

**테스트 케이스**:

```typescript
// Case 1: 완전한 고정공고 → true
const validFixed: JobPosting = {
  postingType: 'fixed',
  fixedConfig: { ... },
  fixedData: { ... },
  // ... 기타 필드
};
isFixedJobPosting(validFixed); // true

// Case 2: postingType만 fixed → false
const incomplete: JobPosting = {
  postingType: 'fixed',
  // fixedConfig, fixedData 없음
  // ... 기타 필드
};
isFixedJobPosting(incomplete); // false

// Case 3: 다른 타입 → false
const regular: JobPosting = {
  postingType: 'regular',
  // ... 기타 필드
};
isFixedJobPosting(regular); // false
```

---

## Research Area 3: 레거시 호환성 전략

### 현재 레거시 필드 상황

**파일**: `app2/src/types/jobPosting/jobPosting.ts`

```typescript
export interface JobPosting {
  type?: 'application' | 'fixed';  // 레거시 필드
  // ...
}

export interface JobPostingFormData {
  type?: 'application' | 'fixed';  // 레거시 필드
  postingType: PostingType;        // 새 필드
  // ...
}
```

**파일**: `app2/src/utils/jobPosting/jobPostingHelpers.ts`

```typescript
export function normalizePostingType(data: Partial<JobPosting>): PostingType {
  // postingType이 있으면 우선 사용
  if (data.postingType) {
    return data.postingType;
  }

  // 레거시 필드 변환
  if (data.type === 'fixed') {
    return 'fixed';
  }
  if (data.type === 'application' || data.recruitmentType === 'application') {
    return 'regular';
  }

  return 'regular'; // 기본값
}
```

### 설계 결정

**Decision**: JSDoc `@deprecated` 주석으로 점진적 마이그레이션 유도

**Implementation**:

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
   * - regular: 일반 공고
   * - fixed: 고정 공고
   * - tournament: 대회 공고
   * - urgent: 긴급 공고
   */
  postingType: PostingType;
}
```

**Rationale**:
1. **IDE 경고**: 개발자가 deprecated 필드 사용 시 즉시 경고 확인
2. **데이터 안전성**: 기존 Firestore 데이터 손상 방지
3. **점진적 마이그레이션**: 새 코드는 `postingType` 사용, 기존 코드는 점진적 전환
4. **문서화**: `@see` 태그로 대체 필드 안내

**마이그레이션 경로**:

```typescript
// ❌ 레거시 방식 (deprecated 경고 표시)
if (posting.type === 'fixed') { }

// ✅ 새로운 방식
if (posting.postingType === 'fixed') { }
if (isFixedJobPosting(posting)) { } // 타입 가드 사용
```

---

## Research Area 4: Firestore 타입 호환성

### Timestamp 타입 처리

**현재 패턴**:

```typescript
import { Timestamp } from 'firebase/firestore';

export interface FixedConfig {
  expiresAt: Timestamp;   // Firebase Timestamp
  createdAt: Timestamp;
}
```

**발견 사항**:
- Firebase `Timestamp` 타입 직접 사용
- 날짜 변환은 컴포넌트 레벨에서 처리 (`toISODateString` 헬퍼)

### 옵셔널 vs 필수 필드 전략

**분석**:

| 필드 타입 | 전략 | 이유 |
|---------|------|------|
| `fixedConfig` | 필수 (FixedJobPosting에서) | 고정공고의 핵심 데이터 |
| `fixedData` | 필수 (FixedJobPosting에서) | 고정공고의 핵심 데이터 |
| `type` | 옵셔널 | 레거시 호환성 |
| `recruitmentType` | 옵셔널 | 레거시 호환성 |

### 설계 결정

**Decision**: FixedJobPosting에서는 필수, JobPosting에서는 옵셔널

**Implementation**:

```typescript
// 기본 JobPosting (기존과 동일)
export interface JobPosting {
  postingType: PostingType;
  fixedConfig?: FixedConfig;      // 옵셔널 (다른 타입에서는 불필요)
  fixedData?: FixedJobPostingData; // 옵셔널
  // ...
}

// 고정공고 전용 타입 (필수로 강제)
export interface FixedJobPosting extends JobPosting {
  postingType: 'fixed';            // 리터럴 타입으로 좁힘
  fixedConfig: FixedConfig;        // 필수
  fixedData: FixedJobPostingData;  // 필수
}
```

**Rationale**:
- **타입 안전성**: `isFixedJobPosting` 가드 통과 후에는 필드 존재 보장
- **유연성**: 다른 공고 타입에서는 불필요한 필드 강제하지 않음
- **명확성**: 고정공고는 반드시 필요한 데이터 보유

---

## 데이터 마이그레이션 전략

### 현재 상황

- 기존 Firestore에 `type: 'fixed'` 필드를 가진 문서 존재 가능
- 새로운 필드 (`fixedData`) 없음

### 마이그레이션 접근법

**Option 1: 즉시 마이그레이션** (비추천)
- Firestore 모든 문서 업데이트
- 위험: 대량 쓰기 작업, 데이터 손상 위험

**Option 2: 점진적 마이그레이션** (추천)
- 읽기 시 레거시 필드 처리
- 쓰기 시 새 필드 사용
- 기존 데이터는 자연스럽게 교체

**Decision**: 점진적 마이그레이션

**Implementation**:

```typescript
// 읽기 로직 (컴포넌트)
function loadPosting(data: FirestoreData): JobPosting {
  const postingType = normalizePostingType(data); // 레거시 필드 변환

  // 새 필드가 없으면 기본값 사용 (migration 대상)
  const fixedData = data.fixedData || {
    workSchedule: { daysPerWeek: 5, startTime: '09:00', endTime: '18:00' },
    requiredRolesWithCount: [],
    viewCount: 0
  };

  return { ...data, postingType, fixedData };
}

// 쓰기 로직 (폼 제출)
function savePosting(formData: JobPostingFormData) {
  // 항상 새 필드 사용
  return {
    postingType: formData.postingType,
    fixedData: formData.fixedData, // 필수
    // type, recruitmentType 제거
  };
}
```

**Rationale**:
- 안전성: 기존 데이터 손상 없음
- 점진성: 사용자가 수정할 때마다 자연스럽게 업데이트
- 호환성: 레거시 필드 계속 읽기 가능

---

## 요약 및 다음 단계

### 주요 결정 사항

| 영역 | 결정 | 파일 |
|-----|------|------|
| Zod 스키마 | `fixedPosting.schema.ts` 분리 | `app2/src/schemas/jobPosting/` |
| 타입 가드 | `jobPosting.ts`에 배치 | `app2/src/types/jobPosting/` |
| 레거시 호환성 | `@deprecated` 주석 + 점진적 마이그레이션 | 기존 파일 수정 |
| 필드 전략 | FixedJobPosting에서 필수, JobPosting에서 옵셔널 | `jobPosting.ts` |

### 다음 단계

1. ✅ Research 완료
2. 🔄 `data-model.md` 작성 (Phase 1)
3. 🔄 `quickstart.md` 작성 (Phase 1)
4. ⏭️ `/speckit.tasks`로 작업 목록 생성 (Phase 2)

### 참조 문서

- [TypeScript Handbook - Narrowing](https://www.typescriptlang.org/docs/handbook/2/narrowing.html)
- [Zod Documentation](https://zod.dev/)
- [Firebase Timestamp API](https://firebase.google.com/docs/reference/js/firestore_.timestamp)
