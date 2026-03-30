# 알림 시스템 운영 가이드

최종 업데이트: 2026-03-30  
기준 코드: `functions/src/api/notifications.ts`, `functions/src/triggers/notifications.ts`, `functions/src/scheduled/cleanupExpiredTokens.ts`, `uniqn-mobile/src/services/notifications/`, `uniqn-mobile/src/components/notifications/NotificationSettings.tsx`

모바일 푸시 알림의 현재 운영 기준은 `FCM + expo-notifications`입니다.

## 현재 구조

- 서버는 Firebase Functions에서 알림 문서 생성, 발송, 미읽음 카운터 보정을 담당합니다.
- 앱은 알림 목록 조회, 읽음 처리, 푸시 권한 요청, 디바이스 토큰 등록, 사용자 알림 설정 저장을 담당합니다.
- Android 푸시 채널은 `default`, `applications`, `reminders`, `settlement`, `announcements`를 사용합니다.

## 현재 배포 기준 Functions

### Callable / onCall

| 함수명 | 용도 |
|---|---|
| `sendSystemAnnouncement` | 전체 사용자 대상 시스템 공지 발송 |
| `sendJobPostingAnnouncement` | 특정 공고 관련 공지 발송 |
| `initializeUnreadCounter` | 사용자 미읽음 카운터 초기화 |
| `decrementUnreadCounter` | 읽음/삭제 이후 미읽음 카운터 감소 |
| `resetUnreadCounter` | 미읽음 카운터 재설정 |

### Firestore 트리거

| 함수명 | 트리거 요약 |
|---|---|
| `onApplicationSubmitted` | 지원서 생성 |
| `onApplicationStatusChanged` | 지원 상태 변경 |
| `onScheduleCreated` | 근무 일정 생성 |
| `onScheduleCancelled` | 근무 일정 취소 |
| `onCheckInOut` | 출퇴근 기록 |
| `onWorkTimeChanged` | 근무 시간 변경 |
| `onReviewCreated` | 리뷰 생성 |
| `onJobPostingUpdated` | 공고 수정 |
| `onJobPostingCancelled` | 공고 취소 |
| `onJobPostingClosed` | 공고 마감 |
| `onNoShow` | 노쇼 처리 |
| `onSettlementCompleted` | 정산 완료 |
| `onNegativeSettlement` | 회수/음수 정산 알림 |
| `onReportCreated` | 신고 생성 |
| `onInquiryCreated` | 문의 생성 |
| `onTournamentPostingCreated` | 대회 공고 생성 |
| `onTournamentApprovalChange` | 대회 승인 상태 변경 |
| `onNotificationRead` | 알림 읽음 처리 |
| `onNotificationDeleted` | 알림 삭제 처리 |

### Scheduled

| 함수명 | 용도 |
|---|---|
| `cleanupExpiredTokensScheduled` | 만료된 토큰 정리 |

## 앱 측 기준 구현

### 알림 서비스

- `uniqn-mobile/src/services/notifications/notificationService.ts`
- `uniqn-mobile/src/services/notifications/pushNotificationService.ts`
- `uniqn-mobile/src/services/notifications/notificationSyncService.ts`

### 사용자 설정

- 알림 전체 on/off
- 카테고리별 on/off 및 푸시 on/off
- 방해 금지 시간
- 그룹핑 설정

현재 설정 카테고리는 `application`, `attendance`, `settlement`, `job`, `system`, `admin`, `review`입니다.

## 운영 명령

```bash
cd functions
firebase functions:list
firebase functions:log --only onApplicationStatusChanged
firebase functions:log --only onScheduleCreated
firebase functions:log --only sendSystemAnnouncement
firebase deploy --only functions
firebase deploy --only functions:sendSystemAnnouncement
```

## 점검 순서

### 알림이 생성되지 않을 때

1. `firebase functions:log --only <FUNCTION_NAME>`로 최근 오류를 확인합니다.
2. Firestore `notifications` 문서가 실제로 생성되는지 봅니다.
3. 해당 사용자 문서의 푸시 토큰이 살아 있는지 확인합니다.
4. 앱에서 알림 설정이나 방해 금지 시간이 발송 체감에 영향을 주는지 확인합니다.

### 미읽음 카운터가 어긋날 때

1. `initializeUnreadCounter`
2. `decrementUnreadCounter`
3. `resetUnreadCounter`
4. `onNotificationRead`
5. `onNotificationDeleted`

위 다섯 흐름을 함께 확인해야 합니다.

### Android 푸시가 오지 않을 때

1. 디바이스 실기기 여부를 확인합니다.
2. Expo 권한 상태와 FCM 토큰 등록 상태를 확인합니다.
3. 채널 ID가 `default`, `applications`, `reminders`, `settlement`, `announcements` 중 올바른지 확인합니다.

## 현재 제외 범위

- 과거 설계 문서의 알림 함수명
- 존재하지 않는 웹 푸시 운영 화면
- 구 버전 테스트 전용 알림 경로

## 관련 문서

- `docs/reference/API_REFERENCE.md`
- `docs/operations/TROUBLESHOOTING.md`
- `uniqn-mobile/docs/PUSH_NOTIFICATION_TEST_CHECKLIST.md`
