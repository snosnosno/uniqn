# Firebase Functions API Reference

최종 업데이트: 2026-03-30  
기준 코드: `functions/src/index.ts`

이 문서는 현재 export 중인 Functions 이름만 정리합니다. 상세 동작이 필요하면 각 구현 파일을 직접 확인하세요.

## Export 구조

- `functions/src/api/`: callable / HTTP 엔트리
- `functions/src/triggers/`: Firestore 트리거
- `functions/src/scheduled/`: 스케줄 작업

## Auth / Profile

기준 파일: `functions/src/api/auth.ts`

| 이름 | 타입 | 설명 |
|---|---|---|
| `checkEmailExists` | onCall | 이메일 중복 확인 |
| `checkNicknameExists` | onCall | 닉네임 중복 확인 |
| `checkPhoneExists` | onCall | 전화번호 중복 확인 |
| `verifyAndSaveProfile` | onCall | 프로필 검증 및 저장 |
| `revokeAppleToken` | onCall | Apple 토큰 폐기 |

## Notifications Callable

기준 파일: `functions/src/api/notifications.ts`

| 이름 | 타입 | 설명 |
|---|---|---|
| `decrementUnreadCounter` | onCall | unread counter 감소 |
| `initializeUnreadCounter` | onCall | unread counter 초기화 |
| `resetUnreadCounter` | onCall | unread counter 재설정 |
| `sendJobPostingAnnouncement` | onCall | 공고 대상 공지 전송 |
| `sendSystemAnnouncement` | onCall | 시스템 공지 전송 |

## Account / Session

기준 파일: `functions/src/api/accounts.ts`, `functions/src/account/`

| 이름 | 타입 | 설명 |
|---|---|---|
| `forceDeleteAccount` | onCall | 계정 강제 삭제 |
| `sendLoginNotification` | onCall | 로그인 알림 전송 |
| `recordLoginFailure` | onCall | 로그인 실패 기록 |
| `processScheduledDeletions` | onSchedule | 삭제 예약 계정 처리 |
| `cleanupOrphanAccountsScheduled` | onSchedule | 고아 계정 정리 |

## Admin

기준 파일: `functions/src/api/admin.ts`

| 이름 | 타입 | 설명 |
|---|---|---|
| `requestRegistration` | onCall | 가입 요청 처리 |
| `processRegistration` | onCall | 가입 승인/거부 |
| `createUserAccount` | onCall | 관리자 계정 생성 |
| `getDashboardStats` | onCall | 관리자 통계 조회 |
| `updateUser` | onCall | 사용자 수정 |
| `deleteUser` | onCall | 사용자 삭제 |

## Job Posting Approval

기준 파일: `functions/src/api/jobPostings/`

| 이름 | 타입 | 설명 |
|---|---|---|
| `approveJobPosting` | onCall | 대회 공고 승인 |
| `rejectJobPosting` | onCall | 대회 공고 반려 |
| `resubmitJobPosting` | onCall | 반려 공고 재제출 |

## Telemetry

기준 파일: `functions/src/api/telemetry.ts`

| 이름 | 타입 | 설명 |
|---|---|---|
| `logAction` | onCall | 액션 로그 기록 |
| `logActionHttp` | onRequest | 액션 로그 HTTP 엔드포인트 |

## Firestore Triggers

기준 파일: `functions/src/triggers/`, `functions/src/notifications/`

| 이름 | 타입 | 설명 |
|---|---|---|
| `validateJobPostingData` | onDocumentWritten | 공고 canonical 필드 / search index 검증 및 동기화 |
| `updateJobPostingApplicantCount` | onDocumentWritten | 공고 지원자 수 집계 |
| `onJobPostingOGSync` | onDocumentWritten | OG projection 동기화 |
| `onUserRoleChange` | onDocumentWritten | 사용자 role claim 동기화 |
| `syncApplicationCompletionFromWorkLogs` | onDocumentWritten | work log 기반 완료 상태 동기화 |
| `onTournamentApprovalChange` | onDocumentUpdated | 대회 승인 상태 후처리 |
| `onFixedPostingExpired` | onDocumentUpdated | 고정 공고 만료 후처리 |
| `onWorkDateExpired` | onDocumentUpdated | 마지막 근무일 기반 만료 후처리 |
| `onApplicationSubmitted` | onDocumentCreated | 지원 제출 알림 |
| `onApplicationStatusChanged` | onDocumentUpdated | 지원 상태 변경 알림 |
| `onScheduleCreated` | onDocumentCreated | 일정 생성 알림 |
| `onScheduleCancelled` | onDocumentUpdated | 일정 취소 알림 |
| `onCheckInOut` | onDocumentUpdated | 출퇴근 알림 |
| `onWorkTimeChanged` | onDocumentCreated | 근무 시간 변경 알림 |
| `onSettlementCompleted` | onDocumentUpdated | 정산 완료 알림 |
| `onNegativeSettlement` | onDocumentUpdated | 음수 정산 경고 |
| `onNoShow` | onDocumentUpdated | 노쇼 알림 |
| `onReviewCreated` | onDocumentCreated | 평가 생성 알림 |
| `onReportCreated` | onDocumentCreated | 신고 생성 알림 |
| `onInquiryCreated` | onDocumentCreated | 문의 생성 알림 |
| `onTournamentPostingCreated` | onDocumentCreated | 대회 공고 생성 알림 |
| `onNotificationRead` | onDocumentUpdated | 알림 읽음 후처리 |
| `onNotificationDeleted` | onDocumentDeleted | 알림 삭제 후처리 |

## Scheduled Jobs

기준 파일: `functions/src/scheduled/`

| 이름 | 타입 | 설명 |
|---|---|---|
| `cleanupExpiredTokensScheduled` | onSchedule | 만료 푸시 토큰 정리 |
| `cleanupRateLimitsScheduled` | onSchedule | rate limit 레코드 정리 |
| `retryFailedCounterOpsScheduled` | onSchedule | 실패한 unread counter 재시도 |
| `sendReviewRemindersScheduled` | onSchedule | 평가 리마인더 발송 |
| `expireFixedPostings` | onSchedule | 고정 공고 만료 |
| `manualExpireFixedPostings` | onCall | 고정 공고 수동 만료 |
| `expireByLastWorkDate` | onSchedule | 마지막 근무일 기준 공고 만료 |

## 공통 메모

- 기본 region은 `asia-northeast3`입니다.
- 공개 이름은 `functions/src/index.ts` re-export 결과를 기준으로 봅니다.
- 미구현 결제/구독 API는 이 문서에 포함하지 않습니다.
