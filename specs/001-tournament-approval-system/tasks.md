# Tasks: 대회공고 승인 시스템 완성

**Input**: Design documents from `/specs/001-tournament-approval-system/`
**Prerequisites**: plan.md, spec.md, research.md

**Note**: US2 (자동 pending 설정)와 US5 (Firestore 인덱스)는 이미 구현되어 있어 제외됨

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Frontend**: `app2/src/`
- **Functions**: `functions/src/`
- **Config**: Repository root

---

## Phase 1: Setup (확인 및 준비)

**Purpose**: 기존 구현 상태 확인 및 작업 준비

- [x] T001 기존 구현 확인: TournamentConfig 타입이 정의되어 있는지 확인 in `app2/src/types/jobPosting/jobPosting.ts`
- [x] T002 기존 구현 확인: useJobPostingApproval Hook의 approve/reject 함수 동작 확인 in `app2/src/hooks/useJobPostingApproval.ts`
- [x] T003 기존 구현 확인: ApprovalManagementPage가 pending 공고를 표시하는지 확인 in `app2/src/pages/ApprovalManagementPage.tsx`

---

## Phase 2: Foundational (의존성 없음 - 스킵)

**Purpose**: 모든 기반 시스템이 이미 구현되어 있음

✅ **이미 구현됨**:
- TournamentConfig 타입 정의
- 승인/거부 Firebase Functions
- 알림 트리거 (onTournamentApprovalChange)
- Firestore 복합 인덱스

**Checkpoint**: Foundation ready - 바로 User Story 구현 가능

---

## Phase 3: User Story 1 - 대회탭에서 승인된 공고만 조회 (Priority: P1) 🎯 MVP

**Goal**: 구인구직 페이지의 대회탭에서 approved 상태 공고만 표시

**Independent Test**: 대회탭 클릭 시 pending/rejected 공고는 표시되지 않고 approved 공고만 표시되는지 확인

**관련 요구사항**: FR-001, SC-001

### Implementation for User Story 1

- [x] T004 [US1] useJobPostings Hook에 tournament approvalStatus 필터 추가 in `app2/src/hooks/useJobPostings.ts`
- [x] T005 [US1] useInfiniteJobPostings에도 동일한 필터 적용 in `app2/src/hooks/useJobPostings.ts`
- [x] T006 [US1] 빈 목록 시 "등록된 대회 공고가 없습니다" 메시지 확인 (기존 UI 활용)

**구현 상세 (T004, T005)**:
```typescript
// postingType 필터 적용 후 추가
if (filters.postingType === 'tournament') {
  jobs = jobs.filter((job) =>
    job.tournamentConfig?.approvalStatus === 'approved'
  );
}
```

**Checkpoint**: User Story 1 완료 - 대회탭에서 승인된 공고만 표시됨

---

## Phase 4: User Story 3 - 거부된 공고의 사유 확인 (Priority: P2)

**Goal**: 업주가 거부된 공고의 사유를 알림 또는 내 공고 목록에서 확인

**Independent Test**: 거부된 공고가 있는 업주가 거부 사유를 2클릭 이내에 확인 가능한지 테스트

**관련 요구사항**: FR-004, FR-005, SC-003

**Note**: 알림 센터에서 거부 사유는 이미 표시됨 (onTournamentApprovalChange.ts). 내 공고 목록 UI만 추가 필요

### Implementation for User Story 3

- [x] T007 [P] [US3] RejectionReasonDisplay 컴포넌트 생성 in `app2/src/components/jobPosting/RejectionReasonDisplay.tsx`
- [x] T008 [US3] TournamentStatusBadge에 거부 시 툴팁 또는 사유 표시 연동 in `app2/src/components/jobPosting/TournamentStatusBadge.tsx`
- [x] T009 [US3] 내 공고 목록에서 거부된 공고에 거부 사유 표시 통합 (JobPostingCard, JobPostingList)

**RejectionReasonDisplay 컴포넌트 요구사항**:
- Props: `tournamentConfig: TournamentConfig`
- 표시 내용: rejectionReason, rejectedAt (format: yyyy.MM.dd HH:mm)
- 다크모드 지원 필수 (dark: 클래스)
- 접기/펼치기 기능 (선택)

**Checkpoint**: User Story 3 완료 - 거부 사유를 내 공고 목록에서 확인 가능

---

## Phase 5: User Story 4 - 거부된 공고 재제출 (Priority: P2)

**Goal**: 업주가 거부된 공고를 재제출하여 다시 승인 요청

**Independent Test**: 거부된 공고의 재제출 버튼 클릭 후 approvalStatus가 pending으로 변경되고 resubmittedAt이 기록되는지 확인

**관련 요구사항**: FR-006, FR-007, FR-008, SC-004

### Implementation for User Story 4

- [x] T010 [P] [US4] useJobPostingApproval Hook에 resubmit 함수 추가 in `app2/src/hooks/useJobPostingApproval.ts`
- [x] T011 [P] [US4] ResubmitButton 컴포넌트 생성 in `app2/src/components/jobPosting/ResubmitButton.tsx`
- [x] T012 [US4] 내 공고 목록에서 거부된 공고에 ResubmitButton 통합 (JobPostingCard, JobPostingList)
- [x] T013 [US4] ApprovalManagementPage에 재제출 배지 표시 추가 in `app2/src/pages/ApprovalManagementPage.tsx`

**resubmit 함수 요구사항 (T010)**:
```typescript
const resubmit = async (postingId: string) => {
  const postingRef = doc(db, 'jobPostings', postingId);
  await updateDoc(postingRef, {
    'tournamentConfig.approvalStatus': 'pending',
    'tournamentConfig.resubmittedAt': serverTimestamp(),
  });
};
```

**ResubmitButton 컴포넌트 요구사항 (T011)**:
- Props: `postingId: string`, `disabled?: boolean`, `onSuccess?: () => void`
- 버튼 텍스트: "재제출" 또는 "다시 승인 요청"
- 로딩 상태 표시
- 다크모드 지원 필수

**재제출 배지 요구사항 (T013)**:
- `resubmittedAt` 필드 존재 시 "재제출" 배지 표시
- 배지 색상: 파란색 (bg-blue-100 dark:bg-blue-900/30)

**Checkpoint**: User Story 4 완료 - 거부된 공고 재제출 가능, 관리자 페이지에서 재제출 표시

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: 전체 기능 통합 검증 및 마무리

- [x] T014 TypeScript strict mode 검증 (`npm run type-check`) - ✅ 통과
- [x] T015 린트 검증 (`npm run lint`) - ✅ 경고만 있음 (기존 테스트 파일)
- [x] T016 빌드 검증 (`npm run build`) - ✅ 성공
- [x] T017 다크모드 적용 확인 (모든 신규 컴포넌트) - ✅ 적용 완료
- [x] T018 tasks.md 최종 업데이트

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - 즉시 시작 가능
- **Foundational (Phase 2)**: ✅ 이미 완료됨 - 스킵
- **User Story 1 (Phase 3)**: Setup 확인 후 즉시 시작 가능
- **User Story 3 (Phase 4)**: Phase 3 완료 불필요 - 독립 구현 가능
- **User Story 4 (Phase 5)**: Phase 3 완료 불필요 - 독립 구현 가능 (단, US3의 UI와 통합 필요)
- **Polish (Phase 6)**: 모든 User Story 완료 후

### User Story Dependencies

- **US1 (P1)**: 독립 - 다른 스토리와 의존성 없음
- **US3 (P2)**: 독립 - 다른 스토리와 의존성 없음
- **US4 (P2)**: US3와 UI 통합 필요 (내 공고 목록)

### Within Each User Story

- Hook 수정/추가 → 컴포넌트 생성 → 페이지 통합
- 다크모드 적용 필수

### Parallel Opportunities

```
Phase 3 (US1): T004, T005 → T006 (순차)
Phase 4 (US3): T007 || T008 → T009 (T007, T008 병렬)
Phase 5 (US4): T010 || T011 → T012 → T013 (T010, T011 병렬)
```

---

## Parallel Example: User Story 4

```bash
# 병렬 실행 가능 (서로 다른 파일):
Task T010: "useJobPostingApproval Hook에 resubmit 함수 추가"
Task T011: "ResubmitButton 컴포넌트 생성"

# 순차 실행 필요 (의존성):
Task T012: "내 공고 목록에서 ResubmitButton 통합" (T010, T011 완료 후)
Task T013: "ApprovalManagementPage에 재제출 배지 표시" (T010 완료 후)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. ✅ Setup 확인 (T001-T003)
2. ✅ Foundational 확인 (이미 구현됨)
3. Phase 3: User Story 1 (T004-T006)
4. **STOP and VALIDATE**: 대회탭에서 approved만 표시되는지 확인
5. 필요 시 배포

### Incremental Delivery

1. US1 완료 → 대회탭 필터링 작동 (MVP!)
2. US3 완료 → 거부 사유 확인 가능
3. US4 완료 → 재제출 기능 작동
4. 전체 워크플로우 검증 → 배포

### Estimated Time

| Phase | Tasks | 예상 시간 |
|-------|-------|-----------|
| Phase 1: Setup | T001-T003 | 10분 |
| Phase 3: US1 | T004-T006 | 15분 |
| Phase 4: US3 | T007-T009 | 30분 |
| Phase 5: US4 | T010-T013 | 45분 |
| Phase 6: Polish | T014-T018 | 20분 |
| **Total** | **18 tasks** | **약 2시간** |

---

## Notes

- [P] tasks = 서로 다른 파일, 의존성 없음
- [Story] label = 해당 User Story와 매핑
- 다크모드 필수: 모든 UI 컴포넌트에 `dark:` 클래스 적용
- logger 사용: `console.log` 대신 `logger` 사용
- any 타입 금지: TypeScript strict mode 준수
- 이미 구현된 기능 (US2, US5)은 태스크에서 제외됨

---

## Completion Summary

**완료일**: 2025-12-05
**상태**: ✅ 모든 태스크 완료 및 master 브랜치 머지 완료

### 구현된 기능

1. **대회탭 필터링 (US1)**
   - `useJobPostings.ts`, `useInfiniteJobPostings`에 tournament approved 필터 추가
   - 대회탭에서 승인된 공고만 표시

2. **거부 사유 표시 UI (US3)**
   - `RejectionReasonDisplay.tsx` 컴포넌트 생성
   - `TournamentStatusBadge.tsx`에 툴팁으로 거부 사유 표시
   - `JobPostingCard.tsx`에 승인 상태 배지 및 거부 사유 통합

3. **재제출 기능 (US4)**
   - `useJobPostingApproval.ts`에 `resubmit` 함수 추가 (Firebase Function 연동)
   - `ResubmitButton.tsx` 컴포넌트 생성
   - `ApprovalManagementPage.tsx`에 재제출 배지 표시

4. **Firebase Functions (백엔드)**
   - `approveJobPosting` - 대회 공고 승인
   - `rejectJobPosting` - 대회 공고 거부
   - `resubmitJobPosting` - 거부된 공고 재제출
   - `onTournamentApprovalChange` - 승인 상태 변경 시 알림 트리거

5. **승인 관리 페이지 개선 (2025-12-05)**
   - `ApprovalManagementPage.tsx` - JobPostingCard 컴포넌트 재사용으로 리팩토링
   - 공고카드 UI를 공고관리 페이지와 동일하게 통일
   - `JobDetailModal` 추가로 상세보기 기능 구현

### 수정된 파일

| 파일 | 변경 내용 |
|------|----------|
| `app2/src/hooks/useJobPostings.ts` | tournament approved 필터 추가 |
| `app2/src/hooks/useJobPostingApproval.ts` | resubmit 함수 추가 (Firebase Function 연동) |
| `app2/src/components/jobPosting/RejectionReasonDisplay.tsx` | 신규 생성 |
| `app2/src/components/jobPosting/TournamentStatusBadge.tsx` | 툴팁 기능 추가 |
| `app2/src/components/jobPosting/ResubmitButton.tsx` | 신규 생성 |
| `app2/src/components/common/JobPostingCard.tsx` | 승인 상태/거부 사유/재제출 버튼 통합 |
| `app2/src/components/jobPosting/JobPostingList.tsx` | 대회 상태 표시 활성화 |
| `app2/src/pages/ApprovalManagementPage.tsx` | JobPostingCard 재사용 리팩토링 + 자세히보기 모달 |
| `app2/src/locales/ko/translation.json` | 재제출 관련 번역 추가 |
| `functions/src/api/jobPostings/approveJobPosting.ts` | 신규 생성 |
| `functions/src/api/jobPostings/rejectJobPosting.ts` | 신규 생성 |
| `functions/src/api/jobPostings/resubmitJobPosting.ts` | 신규 생성 |
| `functions/src/triggers/onTournamentApprovalChange.ts` | 신규 생성 |
| `functions/src/index.ts` | 신규 함수 export 추가 |

### 검증 결과

- ✅ TypeScript strict mode: 에러 0개
- ✅ ESLint: 경고만 있음 (기존 테스트 파일)
- ✅ Production build: 성공
- ✅ master 브랜치 머지 완료 (2025-12-05)
- ✅ origin/master 푸시 완료
