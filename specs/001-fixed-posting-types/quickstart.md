# Quickstart Guide: 고정공고 타입 시스템

**Feature**: 001-fixed-posting-types
**Date**: 2025-11-23
**Target Audience**: 개발자

## Overview

고정공고 타입 시스템을 사용하는 개발자를 위한 빠른 시작 가이드입니다. TypeScript 타입 정의, Zod 스키마 검증, 타입 가드 함수 사용법을 실제 예제와 함께 설명합니다.

---

## 1. 기본 사용법

### 1.1 타입 Import

```typescript
// TypeScript 타입
import {
  WorkSchedule,
  RoleWithCount,
  FixedJobPostingData,
  FixedJobPosting,
  isFixedJobPosting
} from '@/types/jobPosting/jobPosting';

// Zod 스키마
import {
  workScheduleSchema,
  roleWithCountSchema,
  fixedJobPostingDataSchema,
  fixedJobPostingSchema
} from '@/schemas/jobPosting';
```

### 1.2 타입 사용 예시

```typescript
// WorkSchedule 정의
const schedule: WorkSchedule = {
  daysPerWeek: 5,
  startTime: "09:00",
  endTime: "18:00"
};

// RoleWithCount 정의
const role: RoleWithCount = {
  name: "딜러",
  count: 3
};

// FixedJobPostingData 정의
const fixedData: FixedJobPostingData = {
  workSchedule: schedule,
  requiredRolesWithCount: [
    { name: "딜러", count: 3 },
    { name: "플로어 매니저", count: 1 }
  ],
  viewCount: 0
};

// FixedJobPosting 정의
const posting: FixedJobPosting = {
  id: "post123",
  title: "강남 홀덤펍 딜러 모집",
  postingType: 'fixed',
  fixedConfig: {
    durationDays: 30,
    chipCost: 5,
    expiresAt: Timestamp.now(),
    createdAt: Timestamp.now()
  },
  fixedData: fixedData,
  // ... 기타 JobPosting 필드
};
```

---

## 2. Zod 스키마 검증

### 2.1 기본 검증

```typescript
// WorkSchedule 검증
const scheduleResult = workScheduleSchema.safeParse({
  daysPerWeek: 5,
  startTime: "09:00",
  endTime: "18:00"
});

if (scheduleResult.success) {
  console.log("유효한 일정:", scheduleResult.data);
} else {
  console.error("검증 실패:", scheduleResult.error.errors);
}
```

### 2.2 폼 데이터 검증

```typescript
import { fixedJobPostingSchema } from '@/schemas/jobPosting';

function validateFormData(formData: unknown) {
  // safeParse로 안전하게 검증
  const result = fixedJobPostingSchema.safeParse(formData);

  if (result.success) {
    // 유효한 데이터 - TypeScript 타입 자동 추론
    const validData: FixedJobPosting = result.data;
    return { success: true, data: validData };
  } else {
    // 검증 실패 - 에러 메시지 추출
    const errors = result.error.errors.map(err => ({
      path: err.path.join('.'),
      message: err.message
    }));
    return { success: false, errors };
  }
}

// 사용 예시
const validation = validateFormData(userInput);
if (validation.success) {
  // 유효한 데이터 처리
  saveToFirestore(validation.data);
} else {
  // 에러 메시지 표시
  validation.errors.forEach(err => {
    toast.error(`${err.path}: ${err.message}`);
  });
}
```

### 2.3 부분 검증 (개별 필드)

```typescript
// 근무 일정만 검증
const scheduleData = { daysPerWeek: 5, startTime: "09:00", endTime: "18:00" };
const scheduleResult = workScheduleSchema.safeParse(scheduleData);

// 역할만 검증
const roleData = { name: "딜러", count: 3 };
const roleResult = roleWithCountSchema.safeParse(roleData);

// 역할 배열 검증
const rolesData = [
  { name: "딜러", count: 3 },
  { name: "플로어 매니저", count: 1 }
];
const rolesResult = z.array(roleWithCountSchema).safeParse(rolesData);
```

---

## 3. 타입 가드 사용

### 3.1 기본 타입 가드

```typescript
import { JobPosting, FixedJobPosting, isFixedJobPosting } from '@/types/jobPosting/jobPosting';

function processPosting(posting: JobPosting) {
  // 타입 가드로 고정공고 확인
  if (isFixedJobPosting(posting)) {
    // ✅ 여기서 posting은 FixedJobPosting 타입으로 자동 좁혀짐
    console.log(`주 ${posting.fixedData.workSchedule.daysPerWeek}일 근무`);
    console.log(`역할: ${posting.fixedData.requiredRolesWithCount.map(r => r.name).join(', ')}`);
    console.log(`조회수: ${posting.fixedData.viewCount}`);
  } else {
    // posting은 여전히 JobPosting 타입
    console.log("고정공고가 아닙니다");
  }
}
```

### 3.2 React 컴포넌트에서 사용

```typescript
import { useEffect, useState } from 'react';
import { JobPosting, isFixedJobPosting } from '@/types/jobPosting/jobPosting';

function PostingDetail({ posting }: { posting: JobPosting }) {
  if (isFixedJobPosting(posting)) {
    // 고정공고 UI 렌더링
    return (
      <div>
        <h2>{posting.title}</h2>
        <div className="schedule">
          <p>주 {posting.fixedData.workSchedule.daysPerWeek}일 근무</p>
          <p>
            {posting.fixedData.workSchedule.startTime} - {posting.fixedData.workSchedule.endTime}
          </p>
        </div>
        <div className="roles">
          <h3>모집 역할</h3>
          <ul>
            {posting.fixedData.requiredRolesWithCount.map((role, idx) => (
              <li key={idx}>
                {role.name}: {role.count}명
              </li>
            ))}
          </ul>
        </div>
      </div>
    );
  }

  // 일반 공고 UI 렌더링
  return <div>{posting.title} (일반 공고)</div>;
}
```

### 3.3 필터링 예시

```typescript
function getFixedPostings(postings: JobPosting[]): FixedJobPosting[] {
  // 고정공고만 필터링 - 타입 안전성 보장
  return postings.filter(isFixedJobPosting);
}

// 사용 예시
const allPostings: JobPosting[] = await loadPostingsFromFirestore();
const fixedPostings: FixedJobPosting[] = getFixedPostings(allPostings);

fixedPostings.forEach(posting => {
  // TypeScript가 posting이 FixedJobPosting임을 알고 있음
  console.log(posting.fixedData.viewCount); // ✅ 타입 안전
});
```

---

## 4. 실전 예제

### 4.1 고정공고 생성 폼

```typescript
import { useState } from 'react';
import { FixedJobPostingData } from '@/types/jobPosting/jobPosting';
import { fixedJobPostingDataSchema } from '@/schemas/jobPosting';

function FixedPostingForm() {
  const [formData, setFormData] = useState<Partial<FixedJobPostingData>>({
    workSchedule: {
      daysPerWeek: 5,
      startTime: "09:00",
      endTime: "18:00"
    },
    requiredRolesWithCount: [],
    viewCount: 0
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Zod 검증
    const result = fixedJobPostingDataSchema.safeParse(formData);

    if (result.success) {
      // 유효한 데이터 - Firestore에 저장
      saveToFirestore(result.data);
      toast.success("고정공고가 생성되었습니다!");
    } else {
      // 검증 실패 - 에러 메시지 표시
      const newErrors: Record<string, string> = {};
      result.error.errors.forEach(err => {
        const path = err.path.join('.');
        newErrors[path] = err.message;
      });
      setErrors(newErrors);
    }
  };

  const addRole = () => {
    setFormData(prev => ({
      ...prev,
      requiredRolesWithCount: [
        ...(prev.requiredRolesWithCount || []),
        { name: "", count: 1 }
      ]
    }));
  };

  return (
    <form onSubmit={handleSubmit}>
      <h2>고정공고 작성</h2>

      {/* 근무 일정 */}
      <section>
        <h3>근무 일정</h3>
        <label>
          주 출근일수:
          <input
            type="number"
            min="1"
            max="7"
            value={formData.workSchedule?.daysPerWeek}
            onChange={e => setFormData(prev => ({
              ...prev,
              workSchedule: {
                ...prev.workSchedule!,
                daysPerWeek: parseInt(e.target.value)
              }
            }))}
          />
          {errors['workSchedule.daysPerWeek'] && (
            <span className="error">{errors['workSchedule.daysPerWeek']}</span>
          )}
        </label>

        <label>
          시작 시간:
          <input
            type="time"
            value={formData.workSchedule?.startTime}
            onChange={e => setFormData(prev => ({
              ...prev,
              workSchedule: {
                ...prev.workSchedule!,
                startTime: e.target.value
              }
            }))}
          />
          {errors['workSchedule.startTime'] && (
            <span className="error">{errors['workSchedule.startTime']}</span>
          )}
        </label>

        <label>
          종료 시간:
          <input
            type="time"
            value={formData.workSchedule?.endTime}
            onChange={e => setFormData(prev => ({
              ...prev,
              workSchedule: {
                ...prev.workSchedule!,
                endTime: e.target.value
              }
            }))}
          />
          {errors['workSchedule.endTime'] && (
            <span className="error">{errors['workSchedule.endTime']}</span>
          )}
        </label>
      </section>

      {/* 역할 추가 */}
      <section>
        <h3>모집 역할</h3>
        {formData.requiredRolesWithCount?.map((role, idx) => (
          <div key={idx}>
            <input
              type="text"
              placeholder="역할명"
              value={role.name}
              onChange={e => {
                const newRoles = [...formData.requiredRolesWithCount!];
                newRoles[idx] = { ...role, name: e.target.value };
                setFormData(prev => ({ ...prev, requiredRolesWithCount: newRoles }));
              }}
            />
            <input
              type="number"
              min="1"
              placeholder="인원"
              value={role.count}
              onChange={e => {
                const newRoles = [...formData.requiredRolesWithCount!];
                newRoles[idx] = { ...role, count: parseInt(e.target.value) };
                setFormData(prev => ({ ...prev, requiredRolesWithCount: newRoles }));
              }}
            />
          </div>
        ))}
        <button type="button" onClick={addRole}>역할 추가</button>
        {errors['requiredRolesWithCount'] && (
          <span className="error">{errors['requiredRolesWithCount']}</span>
        )}
      </section>

      <button type="submit">공고 작성</button>
    </form>
  );
}
```

### 4.2 Firestore 연동

```typescript
import { collection, addDoc, getDocs } from 'firebase/firestore';
import { db } from '@/firebase';
import { FixedJobPosting, isFixedJobPosting } from '@/types/jobPosting/jobPosting';
import { fixedJobPostingSchema } from '@/schemas/jobPosting';

// 고정공고 저장
async function saveFixedPosting(data: FixedJobPosting) {
  // Zod 검증
  const result = fixedJobPostingSchema.safeParse(data);
  if (!result.success) {
    throw new Error('Invalid data: ' + result.error.message);
  }

  // Firestore에 저장
  const docRef = await addDoc(collection(db, 'jobPostings'), result.data);
  return docRef.id;
}

// 고정공고 불러오기
async function loadFixedPostings(): Promise<FixedJobPosting[]> {
  const snapshot = await getDocs(collection(db, 'jobPostings'));
  const postings: FixedJobPosting[] = [];

  snapshot.forEach(doc => {
    const data = { id: doc.id, ...doc.data() } as JobPosting;

    // 타입 가드로 고정공고만 필터링
    if (isFixedJobPosting(data)) {
      postings.push(data);
    }
  });

  return postings;
}
```

---

## 5. 에러 처리 패턴

### 5.1 Zod 에러 메시지 추출

```typescript
import { ZodError } from 'zod';

function extractZodErrors(error: ZodError): Record<string, string> {
  const errors: Record<string, string> = {};

  error.errors.forEach(err => {
    const path = err.path.join('.');
    errors[path] = err.message;
  });

  return errors;
}

// 사용 예시
const result = fixedJobPostingDataSchema.safeParse(data);
if (!result.success) {
  const errors = extractZodErrors(result.error);
  console.log(errors);
  // {
  //   'workSchedule.daysPerWeek': '최소 주 1일 이상 근무해야 합니다',
  //   'requiredRolesWithCount': '최소 1개 이상의 역할을 추가해주세요'
  // }
}
```

### 5.2 사용자 친화적 에러 메시지

```typescript
function showValidationErrors(error: ZodError) {
  const errors = extractZodErrors(error);

  Object.entries(errors).forEach(([path, message]) => {
    // 필드명을 한글로 매핑
    const fieldNames: Record<string, string> = {
      'workSchedule.daysPerWeek': '주 출근일수',
      'workSchedule.startTime': '시작 시간',
      'workSchedule.endTime': '종료 시간',
      'requiredRolesWithCount': '모집 역할'
    };

    const fieldName = fieldNames[path] || path;
    toast.error(`${fieldName}: ${message}`);
  });
}
```

---

## 6. 레거시 코드 마이그레이션

### 6.1 deprecated 필드 대체

```typescript
// ❌ 레거시 방식 (deprecated 경고 표시)
if (posting.type === 'fixed') {
  // ...
}

// ✅ 새로운 방식
if (posting.postingType === 'fixed') {
  // ...
}

// ✅ 타입 가드 사용 (권장)
if (isFixedJobPosting(posting)) {
  // TypeScript 타입 좁히기 지원
  console.log(posting.fixedData.viewCount);
}
```

### 6.2 normalizePostingType 헬퍼 사용

```typescript
import { normalizePostingType } from '@/utils/jobPosting/jobPostingHelpers';

// Firestore에서 불러온 레거시 데이터 처리
function loadLegacyPosting(firestoreData: any): JobPosting {
  return {
    ...firestoreData,
    postingType: normalizePostingType(firestoreData) // 레거시 필드 자동 변환
  };
}
```

---

## 7. 테스트 예제

### 7.1 Zod 스키마 테스트

```typescript
import { workScheduleSchema, roleWithCountSchema } from '@/schemas/jobPosting';

describe('WorkSchedule 스키마', () => {
  it('유효한 데이터를 통과시킨다', () => {
    const data = { daysPerWeek: 5, startTime: "09:00", endTime: "18:00" };
    const result = workScheduleSchema.safeParse(data);
    expect(result.success).toBe(true);
  });

  it('잘못된 daysPerWeek를 거부한다', () => {
    const data = { daysPerWeek: 0, startTime: "09:00", endTime: "18:00" };
    const result = workScheduleSchema.safeParse(data);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.errors[0].message).toContain('최소 주 1일');
    }
  });

  it('잘못된 시간 형식을 거부한다', () => {
    const data = { daysPerWeek: 5, startTime: "9:00", endTime: "18:00" };
    const result = workScheduleSchema.safeParse(data);
    expect(result.success).toBe(false);
  });
});
```

### 7.2 타입 가드 테스트

```typescript
import { isFixedJobPosting } from '@/types/jobPosting/jobPosting';

describe('isFixedJobPosting 타입 가드', () => {
  it('완전한 고정공고를 인식한다', () => {
    const posting = {
      postingType: 'fixed' as const,
      fixedConfig: { /* ... */ },
      fixedData: { /* ... */ }
    };
    expect(isFixedJobPosting(posting as any)).toBe(true);
  });

  it('불완전한 고정공고를 거부한다', () => {
    const posting = {
      postingType: 'fixed' as const
      // fixedConfig, fixedData 없음
    };
    expect(isFixedJobPosting(posting as any)).toBe(false);
  });

  it('다른 타입을 거부한다', () => {
    const posting = {
      postingType: 'regular' as const
    };
    expect(isFixedJobPosting(posting as any)).toBe(false);
  });
});
```

---

## 8. 다음 단계

1. ✅ Quickstart 가이드 완료
2. ⏭️ `/speckit.tasks` 명령으로 구현 작업 목록 생성
3. ⏭️ TypeScript 타입 정의 구현
4. ⏭️ Zod 스키마 구현
5. ⏭️ 테스트 작성 및 검증

---

## 참조

- [spec.md](./spec.md) - Feature Specification
- [plan.md](./plan.md) - Implementation Plan
- [data-model.md](./data-model.md) - Data Model
- [research.md](./research.md) - Research Document
