# Quickstart: 고정공고 상세보기 및 Firestore 인덱스 설정

**Date**: 2025-11-23 | **Feature**: 001-fixed-job-detail | **Phase**: 4

---

## 목차

1. [조회수 증가 사용법](#1-조회수-증가-사용법)
2. [상세보기 모달 확인](#2-상세보기-모달-확인)
3. [Firestore 인덱스 배포](#3-firestore-인덱스-배포)
4. [테스트](#4-테스트)
5. [문제 해결](#5-문제-해결)

---

## 1. 조회수 증가 사용법

### 구현 예제

```typescript
import { incrementViewCount } from '@/services/fixedJobPosting';

const handleCardClick = async (posting: FixedJobPosting) => {
  // 카드 클릭 즉시 조회수 증가 (fire-and-forget)
  incrementViewCount(posting.id);

  // 모달 열기 (조회수 증가 실패와 무관하게 즉시 실행)
  openDetailModal(posting);
};
```

### 주요 특징

- **fire-and-forget 패턴**: 조회수 증가 실패가 사용자 경험을 방해하지 않음
- **원자적 연산**: Firestore `increment(1)` 사용으로 동시성 문제 없음
- **에러 처리**: logger.error로 기록만 하고 모달은 정상 오픈

---

## 2. 상세보기 모달 확인

### JobPostingDetailContent 섹션 추가

**파일**: `app2/src/components/jobPosting/JobPostingDetailContent.tsx`

**삽입 위치**: line ~228 (모집 시간대 섹션 직후, 사전질문 섹션 직전)

```tsx
{/* 기존 모집 시간대 섹션 끝 (line 228) */}

{/* ✨ Phase 4: 고정공고 전용 섹션 */}
{isFixedJobPosting(jobPosting) && (
  <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
    {/* 근무 조건 */}
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

    {/* 모집 역할 */}
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

{/* 사전질문 섹션 시작 (line 232) */}
```

### 다크모드 체크리스트

- [ ] 배경색: `bg-*`, `dark:bg-*`
- [ ] 테두리: `border-*`, `dark:border-*`
- [ ] 제목: `text-gray-900 dark:text-gray-100`
- [ ] 본문: `text-gray-700 dark:text-gray-300`
- [ ] 보조: `text-gray-600 dark:text-gray-400`
- [ ] 빈 상태: `text-gray-500 dark:text-gray-400`

---

## 3. Firestore 인덱스 배포

### 인덱스 정의

**파일**: `firestore.indexes.json` (프로젝트 루트)

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

### 배포 순서 (중요!)

#### Step 1: 개발 환경 배포

```bash
firebase deploy --only firestore:indexes --project dev
```

#### Step 2: Firebase Console 확인

- URL: https://console.firebase.google.com/project/dev/firestore/indexes
- 상태: "Building" → "Enabled" (보통 2-5분 소요)

#### Step 3: 개발 환경 쿼리 테스트

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

#### Step 4: 스테이징 환경 배포 (옵션)

```bash
firebase deploy --only firestore:indexes --project staging
```

#### Step 5: 프로덕션 환경 배포

```bash
firebase deploy --only firestore:indexes --project prod
```

### 배포 체크리스트

- [ ] firestore.indexes.json 업데이트
- [ ] 개발 환경 배포
- [ ] Firebase Console에서 "Enabled" 상태 확인
- [ ] 개발 환경 쿼리 테스트
- [ ] (옵션) 스테이징 환경 배포 및 테스트
- [ ] 프로덕션 환경 배포
- [ ] 프로덕션 Firebase Console 확인

---

## 4. 테스트

### 타입 체크

```bash
cd app2
npm run type-check
```

**기대 결과**: 에러 0개

### 린트 검사

```bash
npm run lint
```

**기대 결과**: 경고 없음

### 단위 테스트

```bash
npm test -- fixedJobPosting
```

**테스트 항목**:
- incrementViewCount 함수 동작
- fire-and-forget 에러 처리
- logger.error 호출 확인

### 통합 테스트

```bash
npm run test:integration -- fixedJobDetail
```

**테스트 항목**:
- Firestore increment() 정상 동작
- viewCount 값 실제 증가 확인
- 네트워크 오류 시 에러 처리

### E2E 테스트

```bash
npm run test:e2e -- fixedJobDetail
```

**테스트 시나리오**:
1. 고정공고 카드 클릭
2. 조회수 1 증가 확인
3. 모달 오픈 확인
4. 근무 조건 표시 확인
5. 모집 역할 목록 표시 확인
6. 빈 역할 목록 메시지 확인

### 빌드 테스트

```bash
npm run build
```

**기대 결과**: 빌드 성공, 번들 크기 300KB 이하

---

## 5. 문제 해결

### 문제: 인덱스 생성 중 쿼리 실패

**증상**: `failed-precondition` 에러

**원인**: Firestore 인덱스 생성 중 (2-5분 소요)

**해결**:
1. Firebase Console에서 인덱스 상태 확인
2. "Building" 상태면 대기
3. "Enabled" 상태 확인 후 재시도

### 문제: 조회수 증가하지 않음

**증상**: viewCount 값이 변하지 않음

**원인**: Firestore 권한 또는 네트워크 오류

**해결**:
1. 브라우저 콘솔에서 에러 확인
2. Firestore Security Rules 확인
3. 네트워크 연결 상태 확인

**Security Rules 예시**:
```javascript
match /jobPostings/{postingId} {
  allow read: if true;
  allow update: if request.resource.data.diff(resource.data).affectedKeys()
    .hasOnly(['fixedData.viewCount']);
}
```

### 문제: 다크모드 스타일 깨짐

**증상**: 다크모드에서 텍스트가 보이지 않음

**원인**: `dark:` 클래스 누락

**해결**:
1. 모든 텍스트 요소에 `dark:text-*` 클래스 추가
2. 배경색에 `dark:bg-*` 클래스 추가
3. 테두리에 `dark:border-*` 클래스 추가

**다크모드 체크리스트 참조**: [섹션 2](#2-상세보기-모달-확인)

### 문제: TypeScript 에러

**증상**: `Property 'fixedData' does not exist`

**원인**: Type Guard 누락

**해결**:
```typescript
import { isFixedJobPosting } from '@/types/jobPosting';

// ✅ Type Guard 사용
if (isFixedJobPosting(jobPosting)) {
  const { workSchedule } = jobPosting.fixedData;  // OK
}
```

---

## 추가 자료

- **Spec**: [spec.md](./spec.md)
- **Data Model**: [data-model.md](./data-model.md)
- **Research**: [research.md](./research.md)
- **Contracts**: [contracts/fixedJobPosting.ts](./contracts/fixedJobPosting.ts)
- **CLAUDE.md**: [프로젝트 가이드](../../CLAUDE.md)

---

*마지막 업데이트: 2025-11-23*
