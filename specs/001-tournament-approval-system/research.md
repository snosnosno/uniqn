# Technical Research: 대회공고 승인 시스템 완성

**Branch**: `001-tournament-approval-system` | **Date**: 2025-12-01
**Purpose**: 기존 구현 분석 및 구현 필요 사항 도출

## 1. 기존 구현 분석

### 1.1 TournamentConfig 타입 (✅ 완료)

**파일**: `app2/src/types/jobPosting/jobPosting.ts:96-105`

```typescript
export interface TournamentConfig {
  approvalStatus: 'pending' | 'approved' | 'rejected'; // 승인 상태
  approvedBy?: string; // 승인자 userId (admin)
  approvedAt?: Timestamp; // 승인일
  rejectedBy?: string; // 거부자 userId (admin)
  rejectedAt?: Timestamp; // 거부일
  rejectionReason?: string; // 거부 사유 (최소 10자)
  resubmittedAt?: Timestamp; // 재신청일 (거부 후)
  submittedAt: Timestamp; // 최초 제출일
}
```

**분석 결과**: 모든 필요한 필드가 이미 정의되어 있음

### 1.2 공고 생성 시 자동 pending 설정 (✅ 완료)

**파일**: `app2/src/components/jobPosting/JobPostingForm/index.tsx:234-244`

```typescript
onPostingTypeChange: (postingType: 'regular' | 'fixed' | 'urgent' | 'tournament') => {
  if (postingType === 'tournament') {
    const { fixedConfig: _fixedConfig, urgentConfig: _urgentConfig, ...rest } = formData;
    setFormData({
      ...rest,
      postingType: 'tournament',
      tournamentConfig: {
        approvalStatus: 'pending' as const,
        submittedAt: Timestamp.fromDate(new Date()),
      },
    });
  }
  // ...
}
```

**분석 결과**: FR-002, FR-003 자동 구현됨

### 1.3 승인/거부 Hook (✅ 완료)

**파일**: `app2/src/hooks/useJobPostingApproval.ts`

제공 기능:
- `pendingPostings`: 승인 대기 공고 목록 (실시간 구독)
- `approve(postingId)`: 승인 처리 (Firebase Function 호출)
- `reject(postingId, reason)`: 거부 처리 (Firebase Function 호출)

### 1.4 Firebase Functions (✅ 완료)

**승인**: `functions/src/api/jobPostings/approveJobPosting.ts`
- admin 권한 체크
- approvalStatus → 'approved'
- approvedBy, approvedAt 설정

**거부**: `functions/src/api/jobPostings/rejectJobPosting.ts`
- admin 권한 체크
- approvalStatus → 'rejected'
- rejectedBy, rejectedAt, rejectionReason 설정
- rejectionReason 최소 10자 검증

### 1.5 알림 트리거 (✅ 완료)

**파일**: `functions/src/triggers/onTournamentApprovalChange.ts`

- approvalStatus 변경 감지
- approved → 승인 완료 알림 전송
- rejected → 거부 알림 (사유 포함) 전송

### 1.6 승인 관리 페이지 (✅ 완료)

**파일**: `app2/src/pages/ApprovalManagementPage.tsx`

- pending 상태 공고 목록 표시
- 승인/거부 버튼 및 모달

### 1.7 상태 배지 컴포넌트 (✅ 완료)

**파일**: `app2/src/components/jobPosting/TournamentStatusBadge.tsx`

- pending: 노란색 (⏳ 승인 대기)
- approved: 녹색 (✅ 승인 완료)
- rejected: 빨간색 (❌ 승인 거부)

### 1.8 Firestore 인덱스 (✅ 완료)

**파일**: `firestore.indexes.json:83-90`

```json
{
  "collectionId": "jobPostings",
  "queryScope": "COLLECTION",
  "fields": [
    {"fieldPath": "postingType", "order": "ASCENDING"},
    {"fieldPath": "tournamentConfig.approvalStatus", "order": "ASCENDING"},
    {"fieldPath": "createdAt", "order": "DESCENDING"}
  ]
}
```

## 2. 구현 필요 사항

### 2.1 대회탭 approved 필터링 (❌ 미구현)

**파일**: `app2/src/hooks/useJobPostings.ts`

**현재 상태** (lines 42-45):
```typescript
if (filters.postingType && filters.postingType !== 'all') {
  jobs = jobs.filter((job) => normalizePostingType(job) === filters.postingType);
}
// approvalStatus 필터링 없음!
```

**문제점**: 대회 공고 조회 시 pending/rejected 상태도 모두 표시됨

**해결 방안**:
```typescript
if (filters.postingType && filters.postingType !== 'all') {
  jobs = jobs.filter((job) => normalizePostingType(job) === filters.postingType);

  // 대회 공고는 승인된 것만 표시
  if (filters.postingType === 'tournament') {
    jobs = jobs.filter((job) =>
      job.tournamentConfig?.approvalStatus === 'approved'
    );
  }
}
```

### 2.2 거부 사유 표시 UI (❌ 미구현)

**현재 상태**: 알림 메시지에 거부 사유 포함되어 전송됨 (onTournamentApprovalChange.ts)

**추가 필요**:
- 내 공고 목록에서 거부 사유 확인 가능하도록 UI 컴포넌트 생성
- TournamentStatusBadge 옆에 "사유 보기" 버튼 또는 툴팁

### 2.3 재제출 기능 (❌ 미구현)

**현재 상태**: resubmittedAt 필드만 타입 정의됨

**추가 필요**:
1. `useJobPostingApproval.ts`에 `resubmit(postingId)` 함수 추가
2. ResubmitButton 컴포넌트 생성
3. ApprovalManagementPage에서 재제출 표시

### 2.4 재제출 표시 (❌ 미구현)

**현재 상태**: ApprovalManagementPage에 재제출 여부 표시 없음

**추가 필요**:
- resubmittedAt 존재 시 "재제출" 배지 추가

## 3. 기술적 고려사항

### 3.1 동시성 처리

기존 Firebase Functions에서 Transaction을 사용하여 동시성 이슈 방지됨.
재제출 기능도 동일 패턴 적용 필요.

### 3.2 레거시 데이터 호환성

일부 공고에 tournamentConfig가 없을 수 있음.
Optional chaining (`?.`) 사용하여 안전하게 처리.

### 3.3 성능

Firestore 복합 인덱스가 이미 설정되어 있어 쿼리 성능 보장됨.
클라이언트 사이드 필터링 추가해도 성능 영향 미미.

## 4. 테스트 시나리오

### 4.1 대회탭 필터링 테스트

1. approved/pending/rejected 공고 각 1개 생성
2. 대회탭 조회
3. approved 공고만 표시되는지 확인

### 4.2 거부 사유 확인 테스트

1. 대회 공고 생성 (pending)
2. 관리자가 거부 (사유: "테스트 거부 사유입니다")
3. 업주가 알림 확인 → 거부 사유 표시 확인
4. 내 공고 목록에서 거부 사유 확인

### 4.3 재제출 테스트

1. 거부된 공고의 "재제출" 버튼 클릭
2. approvalStatus가 'pending'으로 변경 확인
3. resubmittedAt 필드 설정 확인
4. 관리자 페이지에서 "재제출" 배지 표시 확인

## 5. 결론

대부분의 기반 시스템이 이미 구현되어 있으며, 다음 4가지 작업만 추가하면 됨:

| 작업 | 복잡도 | 예상 시간 |
|------|--------|-----------|
| 대회탭 approved 필터링 | 낮음 | 15분 |
| 거부 사유 표시 UI | 중간 | 30분 |
| 재제출 기능 | 중간 | 45분 |
| 재제출 표시 (관리자) | 낮음 | 15분 |

**총 예상 구현 시간**: 약 2시간
