# Research: 고정공고 상세보기 및 Firestore 인덱스 설정

**Date**: 2025-11-23
**Feature**: 001-fixed-job-detail
**Purpose**: Phase 0 연구 결과 - 기존 구조 분석 및 구현 패턴 확인

---

## 1. JobDetailModal 현재 구조 분석

### 현재 구조

**파일 위치**: `app2/src/pages/JobBoard/components/JobDetailModal.tsx`

**구조**:
```
JobDetailModal (39 lines)
├── Props: isOpen, onClose, jobPosting
├── customTitle: recruitmentType에 따른 뱃지 표시
│   ├── 'fixed' → 보라색 "고정" 뱃지
│   └── 'apply' → 파란색 "지원" 뱃지
└── Modal 컴포넌트
    └── JobPostingDetailContent (실제 컨텐츠)
```

**JobPostingDetailContent 구조** (`app2/src/components/jobPosting/JobPostingDetailContent.tsx`):
```
JobPostingDetailContent (250+ lines)
├── 기본 정보 섹션 (title, description, 기간, 지역, 연락처, 급여)
├── 역할별 급여 섹션 (useRoleSalary)
├── 복리후생 섹션 (benefits)
├── 모집 시간대 및 역할 섹션 (dateSpecificRequirements)
│   └── 날짜별 → 시간대별 → 역할별 인원
└── 사전질문 섹션 (preQuestions)
```

### 고정공고 섹션 추가 위치

**Decision**: `모집 시간대 및 역할` 섹션 **직후**, `사전질문` 섹션 **직전**에 추가

**Rationale**:
1. 고정공고는 `dateSpecificRequirements` 대신 `fixedData`를 사용
2. 근무 일정 정보는 기존 시간대 섹션과 유사한 맥락
3. 사전질문 섹션 전이 논리적 흐름상 적절

**Implementation Point** (line ~228):
```tsx
// 모집 시간대 및 역할 정보 섹션 끝 (line 228)

{/* ✨ Phase 4: 고정공고 전용 섹션 추가 위치 */}
{isFixedJobPosting(jobPosting) && (
  <div className="border-b border-gray-200 dark:border-gray-700 pb-4">
    {/* 고정공고 근무 조건 및 역할 */}
  </div>
)}

{/* 사전질문 섹션 시작 (line 232) */}
```

---

## 2. Firestore increment() 모범 사례

### Firebase 공식 패턴

**Document**: [Firebase Increment Documentation](https://firebase.google.com/docs/firestore/manage-data/add-data#increment_a_numeric_value)

**Pattern**: Atomic increment using `increment()` function
```typescript
import { doc, updateDoc, increment } from 'firebase/firestore';

// ✅ 올바른 패턴: increment() 사용
const docRef = doc(db, 'jobPostings', postingId);
await updateDoc(docRef, {
  'fixedData.viewCount': increment(1)
});
```

### Fire-and-Forget 에러 처리

**Decision**: 조회수 증가 실패는 사용자 경험을 방해하지 않도록 비동기 처리

**Implementation**:
```typescript
export const incrementViewCount = async (postingId: string): Promise<void> => {
  try {
    const docRef = doc(db, 'jobPostings', postingId);
    await updateDoc(docRef, {
      'fixedData.viewCount': increment(1)
    });
  } catch (error) {
    // ✅ logger 사용 (CLAUDE.md 규칙)
    logger.error('조회수 증가 실패', {
      postingId,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    // ❌ 사용자에게 에러를 표시하지 않음 (UX 방해 금지)
  }
};
```

**Usage in Component**:
```typescript
const handleCardClick = async (posting: FixedJobPosting) => {
  // 조회수 증가 (fire-and-forget, await하지만 에러는 무시)
  incrementViewCount(posting.id);

  // 모달 즉시 오픈 (조회수 증가 실패와 무관)
  openDetailModal(posting);
};
```

**Rationale**:
- 조회수는 부가 기능이므로 실패해도 상세보기는 정상 작동해야 함
- Firestore increment()는 원자적 연산이므로 동시성 문제 없음
- 네트워크 오류 시 로그만 기록하고 사용자는 모달을 정상적으로 봄

---

## 3. Firestore 복합 인덱스 배포 전략

### 인덱스 정의

**File**: `firestore.indexes.json` (루트)
```json
{
  "indexes": [
    {
      "collectionId": "jobPostings",
      "queryScope": "COLLECTION",
      "fields": [
        {"fieldPath": "postingType", "order": "ASCENDING"},
        {"fieldPath": "status", "order": "ASCENDING"},
        {"fieldPath": "createdAt", "order": "DESCENDING"}
      ]
    }
  ]
}
```

### 배포 순서 (개발 → 스테이징 → 프로덕션)

**Step 1: 개발 환경 배포**
```bash
firebase deploy --only firestore:indexes --project dev
```

**Step 2: Firebase Console 확인**
- URL: https://console.firebase.google.com/project/dev/firestore/indexes
- 상태: "Building" → "Enabled" (보통 2-5분 소요)

**Step 3: 개발 환경 쿼리 테스트**
```typescript
const q = query(
  collection(db, 'jobPostings'),
  where('postingType', '==', 'fixed'),
  where('status', '==', 'active'),
  orderBy('createdAt', 'desc')
);

const snapshot = await getDocs(q);
// ✅ 성공: 인덱스 생성 완료
// ❌ 실패: 인덱스 생성 미완료 또는 진행 중
```

**Step 4: 스테이징 환경 배포 (옵션)**
```bash
firebase deploy --only firestore:indexes --project staging
```

**Step 5: 프로덕션 환경 배포**
```bash
firebase deploy --only firestore:indexes --project prod
```

### 인덱스 생성 중 쿼리 처리

**Decision**: 인덱스 생성 중에는 쿼리가 실패하므로, 사용자에게 임시 오류 메시지 표시

**Error Handling**:
```typescript
try {
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => doc.data());
} catch (error) {
  if (error.code === 'failed-precondition') {
    // 인덱스 미생성 오류
    logger.error('Firestore 인덱스 생성 필요', { error });
    toast.error('잠시 후 다시 시도해주세요. (인덱스 생성 중)');
  } else {
    throw error;
  }
}
```

**Deployment Checklist**:
- [ ] firestore.indexes.json 업데이트
- [ ] 개발 환경 배포
- [ ] Firebase Console에서 "Enabled" 상태 확인
- [ ] 개발 환경 쿼리 테스트
- [ ] (옵션) 스테이징 환경 배포 및 테스트
- [ ] 프로덕션 환경 배포
- [ ] 프로덕션 Firebase Console 확인

---

## 4. 다크모드 스타일링 패턴

### 프로젝트 다크모드 패턴 분석

**검색 결과**: `app2/src/components/**`, `app2/src/pages/**`

**Pattern**: Tailwind `dark:` 클래스 사용

**기존 패턴 예시**:
```tsx
// JobPostingDetailContent.tsx에서 발견된 패턴
<div className="border-gray-200 dark:border-gray-700">
  <h4 className="text-gray-900 dark:text-gray-100">제목</h4>
  <p className="text-gray-700 dark:text-gray-300">본문</p>
  <span className="text-gray-600 dark:text-gray-400">보조 텍스트</span>
</div>
```

### 고정공고 섹션 다크모드 적용

**Template**:
```tsx
{isFixedJobPosting(jobPosting) && (
  <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
    <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-3">
      🏢 근무 조건
    </h3>

    <div className="grid grid-cols-2 gap-4 text-sm">
      <div>
        <label className="text-gray-600 dark:text-gray-400">주 출근일수</label>
        <p className="text-gray-900 dark:text-gray-100 font-medium">
          {jobPosting.fixedData.workSchedule.daysPerWeek}일
        </p>
      </div>
      <div>
        <label className="text-gray-600 dark:text-gray-400">근무시간</label>
        <p className="text-gray-900 dark:text-gray-100 font-medium">
          {jobPosting.fixedData.workSchedule.startTime} ~
          {jobPosting.fixedData.workSchedule.endTime}
        </p>
      </div>
    </div>

    <h4 className="font-semibold text-gray-900 dark:text-gray-100 mt-4 mb-2">
      👥 모집 역할
    </h4>

    {jobPosting.fixedData.requiredRolesWithCount.length > 0 ? (
      <ul className="space-y-2">
        {jobPosting.fixedData.requiredRolesWithCount.map(role => (
          <li key={role.name} className="flex justify-between text-sm">
            <span className="text-gray-700 dark:text-gray-300">{role.name}</span>
            <span className="text-gray-900 dark:text-gray-100 font-medium">
              {role.count}명
            </span>
          </li>
        ))}
      </ul>
    ) : (
      <p className="text-gray-500 dark:text-gray-400 text-sm">
        모집 역할이 없습니다
      </p>
    )}
  </div>
)}
```

**Validation Checklist**:
- [ ] 배경색: `bg-*`, `dark:bg-*`
- [ ] 테두리: `border-*`, `dark:border-*`
- [ ] 제목: `text-gray-900 dark:text-gray-100`
- [ ] 본문: `text-gray-700 dark:text-gray-300`
- [ ] 보조: `text-gray-600 dark:text-gray-400`
- [ ] 빈 상태: `text-gray-500 dark:text-gray-400`

---

## 5. 빈 역할 목록 UI 패턴

### 프로젝트 빈 상태 패턴

**검색 결과**: JobPostingDetailContent.tsx line 224-226

**Pattern**:
```tsx
<div className="text-sm text-gray-600 dark:text-gray-400">
  모집 시간대 정보가 없습니다.
</div>
```

**Decision**: 동일한 패턴 사용, 단 단락 태그로 변경

**Implementation**:
```tsx
{jobPosting.fixedData.requiredRolesWithCount.length > 0 ? (
  <ul className="space-y-2">
    {/* 역할 목록 */}
  </ul>
) : (
  <p className="text-sm text-gray-500 dark:text-gray-400">
    모집 역할이 없습니다
  </p>
)}
```

**Rationale**:
- 기존 프로젝트 패턴과 일관성 유지
- `text-gray-500 dark:text-gray-400`는 빈 상태에 적합한 색상
- `text-sm`으로 크기 통일

---

## Summary

### 해결된 NEEDS CLARIFICATION

| 항목 | 결정 사항 | 근거 |
|------|----------|------|
| JobDetailModal 수정 위치 | JobPostingDetailContent line ~228 | 기존 시간대 섹션 직후가 논리적 |
| Firestore increment() 패턴 | fire-and-forget, logger 사용 | 사용자 경험 방해 금지, CLAUDE.md 준수 |
| 인덱스 배포 순서 | 개발 → 스테이징 → 프로덕션 | 쿼리 실패 방지 |
| 다크모드 클래스 | Tailwind `dark:` 모든 요소 적용 | 기존 패턴 일관성 |
| 빈 역할 목록 UI | `text-gray-500 dark:text-gray-400` | 기존 빈 상태 패턴 재사용 |

### 다음 단계

**Phase 1**: data-model.md, contracts/, quickstart.md 생성
