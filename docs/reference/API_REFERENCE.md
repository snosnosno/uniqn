# API Reference (Firebase Functions)

**최종 업데이트**: 2026년 3월 14일
**기준 코드**: [`functions/src/index.ts`](../../functions/src/index.ts)

> 이 문서는 현재 export 중인 Firebase Functions 기준의 축약 레퍼런스입니다.
> 현재 코드에 없는 과거 결제 API는 이 레퍼런스 범위에 포함하지 않습니다.

## 개요

현재 서버 API의 기준은 `functions/src/index.ts`입니다. 아래는 실제 export 기준 분류입니다.

## Auth / Profile

| 함수명 | 타입 | 설명 |
|---|---|---|
| `checkEmailExists` | HTTPS onCall | 이메일 중복 확인 |
| `checkPhoneExists` | HTTPS onCall | 전화번호 중복 확인 |
| `checkNicknameExists` | HTTPS onCall | 닉네임 중복 확인 |
| `verifyAndSaveProfile` | HTTPS onCall | 프로필 검증 및 저장 |
| `revokeAppleToken` | HTTPS onCall | Apple 토큰 해제 |

## Notifications

| 함수명 | 타입 | 설명 |
|---|---|---|
| `sendSystemAnnouncement` | HTTPS onCall | 전체 시스템 공지 발송 |
| `sendJobPostingAnnouncement` | HTTPS onCall | 공고 대상 공지 발송 |
| `onApplicationSubmitted` | Firestore | 지원 제출 알림 |
| `onApplicationStatusChanged` | Firestore | 지원 상태 변경 알림 |
| `onScheduleCreated` | Firestore | 새 근무 배정 알림 |
| `onScheduleCancelled` | Firestore | 근무 취소 알림 |
| `onCheckInOut` | Firestore | 출퇴근 확인 알림 |
| `onWorkTimeChanged` | Firestore | 근무 시간 변경 알림 |
| `onReviewCreated` | Firestore | 리뷰 생성 알림 |
| `onJobPostingUpdated` | Firestore | 공고 수정 알림 |
| `onJobPostingCancelled` | Firestore | 공고 취소 알림 |
| `onJobPostingClosed` | Firestore | 공고 마감 알림 |
| `onNoShow` | Firestore | 노쇼 알림 |
| `onSettlementCompleted` | Firestore | 정산 완료 알림 |
| `onNegativeSettlement` | Firestore | 음수 정산 알림 |
| `onReportCreated` | Firestore | 신고 생성 알림 |
| `onInquiryCreated` | Firestore | 문의 생성 알림 |
| `onTournamentPostingCreated` | Firestore | 대회 공고 생성 알림 |
| `onTournamentApprovalChange` | Firestore | 대회 공고 승인 상태 알림 |
| `onNotificationRead` | Firestore | 읽음 후처리 |
| `onNotificationDeleted` | Firestore | 삭제 후처리 |
| `initializeUnreadCounter` | HTTPS onCall | 미읽음 카운터 초기화 |
| `decrementUnreadCounter` | HTTPS onCall | 미읽음 카운터 감소 |
| `resetUnreadCounter` | HTTPS onCall | 미읽음 카운터 재설정 |

## Account

| 함수명 | 타입 | 설명 |
|---|---|---|
| `processScheduledDeletions` | Scheduled/HTTPS export source | 예약 삭제 처리 |
| `forceDeleteAccount` | HTTPS onCall | 계정 강제 삭제 |
| `sendLoginNotification` | HTTPS/trigger export source | 로그인 알림 |
| `recordLoginFailure` | HTTPS/trigger export source | 로그인 실패 기록 |
| `cleanupOrphanAccountsScheduled` | Scheduled | 고아 계정 정리 |

## Job Posting Approval

| 함수명 | 타입 | 설명 |
|---|---|---|
| `approveJobPosting` | HTTPS onCall | 관리자 대회 공고 승인 |
| `rejectJobPosting` | HTTPS onCall | 관리자 대회 공고 거부 |
| `resubmitJobPosting` | HTTPS onCall | 작성자 대회 공고 재제출 |
| `onTournamentApprovalChange` | Firestore | 승인 상태 변경 후처리 |

### `approveJobPosting`

- Trigger: HTTPS onCall
- 입력: `postingId: string`
- 권한: `admin`
- 동작:
  1. 인증 및 권한 검증
  2. rate limit 검사
  3. `jobPostings/{postingId}` 조회
  4. `postingType === 'tournament'` 확인
  5. `tournamentConfig.approvalStatus === 'pending'` 확인
  6. 승인 정보 업데이트

### `rejectJobPosting`

- Trigger: HTTPS onCall
- 입력:
  - `postingId: string`
  - `reason: string` (최소 10자)
- 권한: `admin`
- 동작: pending 상태의 tournament 공고를 rejected로 변경

### `resubmitJobPosting`

- Trigger: HTTPS onCall
- 입력: `postingId: string`
- 권한: 인증 사용자, 공고 작성자 본인
- 동작: rejected 상태의 tournament 공고를 pending으로 되돌리고 이전 거부 정보를 보존

## Scheduled / Maintenance

| 함수명 | 타입 | 설명 |
|---|---|---|
| `cleanupRateLimitsScheduled` | Scheduled | rate limit 레코드 정리 |
| `retryFailedCounterOpsScheduled` | Scheduled | 실패한 카운터 연산 재시도 |
| `cleanupExpiredTokensScheduled` | Scheduled | 만료 알림 토큰 정리 |
| `sendReviewRemindersScheduled` | Scheduled | 리뷰 리마인더 발송 |
| `expireFixedPostings` | Scheduled | 고정 공고 만료 |
| `manualExpireFixedPostings` | HTTPS/Manual | 고정 공고 수동 만료 |
| `expireByLastWorkDate` | Scheduled | 마지막 근무일 기준 만료 |
| `onFixedPostingExpired` | Firestore/Trigger | 고정 공고 만료 후처리 |
| `onWorkDateExpired` | Firestore/Trigger | 근무일 만료 후처리 |

## Data / Admin Utilities

| 함수명 | 타입 | 설명 |
|---|---|---|
| `validateJobPostingData` | Firestore | 공고 데이터 자동 보정 |
| `migrateJobPostings` | HTTPS onCall | 공고 데이터 마이그레이션 |
| `requestRegistration` | HTTPS onCall | 회원가입 요청 처리 |
| `processRegistration` | HTTPS onCall | 관리자 가입 승인/거부 |
| `createUserAccount` | HTTPS onCall | 관리자 사용자 생성 |
| `onUserRoleChange` | Firestore | 사용자 role claim 동기화 |
| `getDashboardStats` | HTTPS onRequest | 대시보드 통계 |
| `updateUser` | HTTPS onCall | 사용자 수정 |
| `deleteUser` | HTTPS onCall | 사용자 삭제 |
| `logAction` | HTTPS onCall | 액션 로그 기록 |
| `logActionHttp` | HTTPS onRequest | 액션 로그 HTTP 엔드포인트 |
| `updateJobPostingApplicantCount` | Firestore | 지원자 수 집계 |
| `updateEventParticipantCount` | Firestore | 참가자 수 집계 |
| `onJobPostingOGSync` | Firestore/Trigger | OG 메타 동기화 |

## 주의사항

- 문서보다 코드가 우선입니다. 새 함수 추가/삭제 시 반드시 `functions/src/index.ts`를 기준으로 확인해야 합니다.
- 현재 코드에 없는 결제/구독 흐름은 별도 설계 문서로 분리해서 다뤄야 합니다.
- 함수 region은 특별한 예외가 없으면 `asia-northeast3`입니다.

## 참고 문서

- [`functions/src/index.ts`](../../functions/src/index.ts)
- [`docs/operations/NOTIFICATION_OPERATIONS.md`](../operations/NOTIFICATION_OPERATIONS.md)
- [`docs/reference/DATA_SCHEMA.md`](./DATA_SCHEMA.md)
