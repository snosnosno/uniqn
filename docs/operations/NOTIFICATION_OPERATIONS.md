# 알림 시스템 운영 가이드

**최종 업데이트**: 2026년 3월 14일
**기준 코드**: `functions/src/index.ts`, `functions/src/notifications/*`, `uniqn-mobile/src/services/notifications/*`

> 모바일앱 푸시 알림은 `FCM + expo-notifications` 기반입니다.
> 서버 측 소스 오브 트루스는 [`functions/src/index.ts`](../../functions/src/index.ts)와 `functions/src/notifications/`입니다.

## 개요

알림 시스템은 크게 두 층으로 동작합니다.

- 서버: Firestore 트리거 / callable function이 알림 문서와 푸시를 생성
- 앱: `uniqn-mobile`이 알림 목록 동기화, 읽음 처리, 카운터 표시를 담당

## 현재 배포 기준 알림 관련 Functions

### 수동 발송

| 함수명 | 타입 | 용도 |
|---|---|---|
| `sendSystemAnnouncement` | HTTPS onCall | 전체 사용자 대상 시스템 공지 발송 |
| `sendJobPostingAnnouncement` | HTTPS onCall | 특정 공고 대상 스태프 공지 발송 |

### Firestore 트리거

| 함수명 | 타입 | 트리거 |
|---|---|---|
| `onApplicationSubmitted` | Firestore | 지원서 생성 |
| `onApplicationStatusChanged` | Firestore | 지원 상태 변경 |
| `onScheduleCreated` | Firestore | `workLogs` 생성 |
| `onScheduleCancelled` | Firestore | `workLogs.status` 취소 변경 |
| `onCheckInOut` | Firestore | 출퇴근 시간 기록 |
| `onWorkTimeChanged` | Firestore | 근무 시간 변경 |
| `onReviewCreated` | Firestore | 리뷰 생성 |
| `onJobPostingUpdated` | Firestore | 공고 수정 |
| `onJobPostingCancelled` | Firestore | 공고 취소 |
| `onJobPostingClosed` | Firestore | 공고 마감 |
| `onNoShow` | Firestore | 노쇼 처리 |
| `onSettlementCompleted` | Firestore | 정산 완료 |
| `onNegativeSettlement` | Firestore | 음수 정산 |
| `onReportCreated` | Firestore | 신고 생성 |
| `onInquiryCreated` | Firestore | 문의 생성 |
| `onTournamentPostingCreated` | Firestore | 대회 공고 생성 |
| `onTournamentApprovalChange` | Firestore | 대회 공고 승인 상태 변경 |
| `onNotificationRead` | Firestore | 읽음 처리 |
| `onNotificationDeleted` | Firestore | 삭제 처리 |

### 카운터 / 보조 작업

| 함수명 | 타입 | 용도 |
|---|---|---|
| `initializeUnreadCounter` | HTTPS onCall | 미읽음 카운터 초기화 |
| `decrementUnreadCounter` | HTTPS onCall | 읽음 처리 시 카운터 감소 |
| `resetUnreadCounter` | HTTPS onCall | 카운터 재설정 |
| `cleanupExpiredTokensScheduled` | Scheduled | 만료 토큰 정리 |

## 운영 명령어

```bash
# 전체 함수 목록
firebase functions:list

# 알림 함수 로그
firebase functions:log --only onApplicationStatusChanged
firebase functions:log --only onScheduleCreated
firebase functions:log --only sendSystemAnnouncement

# 전체 함수 재배포
firebase deploy --only functions

# 특정 알림 함수 재배포
firebase deploy --only functions:onApplicationStatusChanged
firebase deploy --only functions:sendSystemAnnouncement
```

## 주의할 점

- 과거 문서에 있던 예전 함수명은 현재 배포 기준 함수명이 아닙니다.
- 현재 스케줄 배정/취소 알림은 `onScheduleCreated`, `onScheduleCancelled`가 담당합니다.
- 지원 상태 알림은 `onApplicationStatusChanged`가 담당합니다.
- 시스템 공지는 `sendSystemAnnouncement`, 공고 공지는 `sendJobPostingAnnouncement`입니다.

## 장애 대응

### 알림이 생성되지 않을 때

1. `firebase functions:log --only <FUNCTION_NAME>`로 최근 오류 확인
2. Firebase Console에서 트리거 대상 컬렉션 변경 여부 확인
3. Firestore `notifications` 문서 생성 여부 확인
4. 사용자 문서의 FCM 토큰 상태 확인

### 알림 폭주 시

```bash
# 원인 함수 로그 확인
firebase functions:log --only FUNCTION_NAME

# 긴급 차단이 필요하면 해당 함수만 삭제 후 수정/재배포
firebase functions:delete FUNCTION_NAME --force
firebase deploy --only functions:FUNCTION_NAME
```

### 미읽음 카운터 이상 시

- `initializeUnreadCounter`
- `decrementUnreadCounter`
- `resetUnreadCounter`

위 3개 callable 함수와 알림 읽음/삭제 트리거를 함께 확인해야 합니다.

## 참고 문서

- [`functions/src/index.ts`](../../functions/src/index.ts)
- [`docs/reference/API_REFERENCE.md`](../reference/API_REFERENCE.md)
- [`specs/react-native-app/10-notifications.md`](../../specs/react-native-app/10-notifications.md)
