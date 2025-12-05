# Implementation Plan: 대회공고 승인 시스템 완성

**Branch**: `001-tournament-approval-system` | **Date**: 2025-12-01 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-tournament-approval-system/spec.md`

## Summary

대회공고(postingType: 'tournament') 승인 워크플로우를 완성합니다. 핵심 구현 사항:
1. 대회탭에서 승인된(approved) 공고만 표시되도록 필터링 추가
2. 거부된 공고의 사유 확인 UI 구현
3. 거부된 공고 재제출 기능 구현
4. 재제출 공고에 "재제출" 표시 추가

## Technical Context

**Language/Version**: TypeScript 4.9 (Strict Mode)
**Primary Dependencies**: React 18.2, Firebase 11.9, @tanstack/react-query, Tailwind CSS 3.3
**Storage**: Firebase Firestore
**Testing**: Jest, React Testing Library
**Target Platform**: Web (PWA), Mobile (Capacitor)
**Project Type**: Web application (React SPA)
**Performance Goals**: 대회탭 로딩 1초 이내 (100개 공고 기준)
**Constraints**: 다크모드 필수, logger 사용 (console.log 금지), any 타입 금지
**Scale/Scope**: 기존 구인구직 시스템 확장

## Constitution Check

*GATE: 기존 아키텍처 및 코딩 컨벤션 준수 확인*

- [x] TypeScript strict mode 준수
- [x] 다크모드 지원 (dark: 클래스)
- [x] logger 사용 (console.log 금지)
- [x] 표준 필드명 사용 (staffId, eventId)
- [x] Firebase onSnapshot 실시간 구독 패턴
- [x] React Query 캐싱 전략

## Project Structure

### Documentation (this feature)

```text
specs/001-tournament-approval-system/
├── spec.md              # Feature specification (완료)
├── plan.md              # This file
├── research.md          # Phase 0 output
├── checklists/
│   └── requirements.md  # Specification quality checklist (완료)
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (수정 대상)

```text
app2/src/
├── hooks/
│   ├── useJobPostings.ts           # [수정] tournament approvalStatus 필터 추가
│   └── useJobPostingApproval.ts    # [확인] 기존 승인/거부 로직 활용
├── components/jobPosting/
│   ├── TournamentStatusBadge.tsx   # [확인] 기존 상태 배지 활용
│   ├── RejectionReasonDisplay.tsx  # [생성] 거부 사유 표시 컴포넌트
│   └── ResubmitButton.tsx          # [생성] 재제출 버튼 컴포넌트
├── pages/
│   ├── ApprovalManagementPage.tsx  # [수정] 재제출 표시 추가
│   └── MyPostingsPage.tsx          # [생성/확인] 내 공고 관리 페이지
└── types/jobPosting/
    └── jobPosting.ts               # [확인] TournamentConfig 타입 (완료)

functions/src/
├── api/jobPostings/
│   ├── approveJobPosting.ts        # [확인] 기존 승인 로직 활용
│   └── rejectJobPosting.ts         # [확인] 기존 거부 로직 활용
└── triggers/
    └── onTournamentApprovalChange.ts # [확인] 알림 트리거 (완료)

firestore.indexes.json               # [확인] 인덱스 이미 존재
```

**Structure Decision**: 기존 프로젝트 구조 유지, 최소한의 파일 추가

## 기존 구현 현황 분석

### ✅ 이미 구현된 기능

| 기능 | 파일 | 상태 |
|------|------|------|
| TournamentConfig 타입 | `types/jobPosting/jobPosting.ts` | ✅ 완료 |
| 공고 생성 시 pending 설정 | `JobPostingForm/index.tsx:234-244` | ✅ 완료 |
| 승인 관리 페이지 | `ApprovalManagementPage.tsx` | ✅ 완료 |
| 승인/거부 모달 | `ApprovalModal.tsx` | ✅ 완료 |
| 승인/거부 Hook | `useJobPostingApproval.ts` | ✅ 완료 |
| Firebase Functions (승인/거부) | `approveJobPosting.ts`, `rejectJobPosting.ts` | ✅ 완료 |
| 알림 트리거 | `onTournamentApprovalChange.ts` | ✅ 완료 |
| 상태 배지 컴포넌트 | `TournamentStatusBadge.tsx` | ✅ 완료 |
| Firestore 복합 인덱스 | `firestore.indexes.json:83-90` | ✅ 완료 |

### ❌ 구현 필요 기능

| 기능 | 파일 | 우선순위 |
|------|------|----------|
| 대회탭 approved 필터링 | `useJobPostings.ts` | P1 |
| 거부 사유 표시 UI | 신규 컴포넌트 | P2 |
| 재제출 기능 | 신규 컴포넌트 + Hook 수정 | P2 |
| 재제출 표시 (관리자) | `ApprovalManagementPage.tsx` | P2 |

## Implementation Phases

### Phase 1: 대회탭 필터링 (P1) - FR-001

**목표**: 대회탭에서 approved 상태의 공고만 표시

**수정 파일**: `app2/src/hooks/useJobPostings.ts`

**변경 내용**:
```typescript
// postingType 필터 적용 후 tournament일 경우 approvalStatus 필터 추가
if (filters.postingType && filters.postingType !== 'all') {
  jobs = jobs.filter((job) => normalizePostingType(job) === filters.postingType);

  // 대회 공고는 승인된 것만 표시 (NEW)
  if (filters.postingType === 'tournament') {
    jobs = jobs.filter((job) =>
      job.tournamentConfig?.approvalStatus === 'approved'
    );
  }
}
```

**테스트**:
- approved/pending/rejected 공고 3개 생성 후 대회탭에서 approved만 표시 확인

### Phase 2: 거부 사유 표시 (P2) - FR-004, FR-005

**목표**: 업주가 거부된 공고의 사유를 확인할 수 있는 UI

**신규 파일**: `app2/src/components/jobPosting/RejectionReasonDisplay.tsx`

**컴포넌트 요구사항**:
- TournamentConfig의 rejectionReason, rejectedAt 표시
- 다크모드 지원
- 접기/펼치기 기능 (선택)

**통합 위치**:
- 알림 센터 (notifications): 기존 알림 메시지에 포함됨 (onTournamentApprovalChange.ts)
- 내 공고 목록: MyPostingsPage에 통합

### Phase 3: 재제출 기능 (P2) - FR-006, FR-007, FR-008

**목표**: 거부된 공고를 재제출하여 pending 상태로 전환

**신규 파일**: `app2/src/components/jobPosting/ResubmitButton.tsx`

**수정 파일**: `app2/src/hooks/useJobPostingApproval.ts`

**추가 함수**:
```typescript
const resubmit = async (postingId: string) => {
  const postingRef = doc(db, 'jobPostings', postingId);
  await updateDoc(postingRef, {
    'tournamentConfig.approvalStatus': 'pending',
    'tournamentConfig.resubmittedAt': serverTimestamp(),
    // 기존 거부 정보는 유지 (이력 확인용)
  });
};
```

**ApprovalManagementPage 수정**:
- resubmittedAt이 존재하면 "재제출" 배지 표시

## Risk Assessment

| 리스크 | 확률 | 영향 | 대응 방안 |
|--------|------|------|-----------|
| 동시성 이슈 (동시 승인/거부) | 낮음 | 중간 | Firebase Transaction 사용 (기존 구현 활용) |
| 레거시 데이터 호환성 | 중간 | 낮음 | tournamentConfig 없는 공고 필터링에서 제외 |
| 성능 저하 | 낮음 | 낮음 | Firestore 인덱스 이미 존재 |

## Complexity Tracking

> 구현 복잡도가 낮음 - Constitution 위반 없음

이 기능은 기존 아키텍처를 활용한 확장으로, 새로운 패턴이나 복잡한 추상화가 필요하지 않습니다.

## Success Metrics

| 지표 | 목표 | 측정 방법 |
|------|------|-----------|
| SC-001 | 대회탭 pending/rejected 0% | 자동화 테스트 |
| SC-002 | pending 자동 설정 100% | 기존 구현 확인 완료 ✅ |
| SC-003 | 거부 사유 2클릭 이내 확인 | UX 테스트 |
| SC-004 | 재제출 성공률 100% | 통합 테스트 |
| SC-005 | 대회탭 로딩 1초 이내 | 성능 테스트 |

## Next Steps

1. `/speckit.tasks` 실행하여 구체적인 task 목록 생성
2. Phase 1 (대회탭 필터링)부터 순차 구현
3. 각 Phase 완료 후 테스트 실행
