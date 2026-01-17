# 10. 알림 시스템 설계

## 목차
1. [알림 시스템 개요](#1-알림-시스템-개요)
2. [알림 타입 정의](#2-알림-타입-정의)
3. [알림 트리거 포인트](#3-알림-트리거-포인트)
4. [FCM 푸시 알림](#4-fcm-푸시-알림)
5. [인앱 알림](#5-인앱-알림)
6. [알림 설정 관리](#6-알림-설정-관리)
7. [딥링크 처리](#7-딥링크-처리)
8. [알림 UI 컴포넌트](#8-알림-ui-컴포넌트)

---

## 1. 알림 시스템 개요

### 아키텍처

```
┌─────────────────────────────────────────────────────────────────────┐
│                     Notification Architecture                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────────┐                          ┌──────────────────────┐ │
│  │   Trigger    │                          │    Client App        │ │
│  │   Points     │                          │                      │ │
│  │              │                          │  ┌────────────────┐  │ │
│  │ • Apply      │    ┌─────────────┐       │  │ FCM Listener   │  │ │
│  │ • Confirm    │───▶│  Firebase   │──────▶│  │ (Background)   │  │ │
│  │ • Check-in   │    │  Functions  │       │  └────────────────┘  │ │
│  │ • Settle     │    │             │       │          │           │ │
│  │ • etc...     │    │  ┌───────┐  │       │          ▼           │ │
│  └──────────────┘    │  │  FCM  │  │       │  ┌────────────────┐  │ │
│                      │  └───────┘  │       │  │ Notification   │  │ │
│                      │             │       │  │ Handler        │  │ │
│  ┌──────────────┐    │  ┌───────┐  │       │  └────────────────┘  │ │
│  │  Firestore   │───▶│  │ Write │  │       │          │           │ │
│  │  Triggers    │    │  └───────┘  │       │          ▼           │ │
│  └──────────────┘    └─────────────┘       │  ┌────────────────┐  │ │
│                                            │  │ • Show Toast   │  │ │
│                                            │  │ • Update Badge │  │ │
│                                            │  │ • Navigate     │  │ │
│                                            │  └────────────────┘  │ │
│                                            └──────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

### 알림 전송 경로

| 경로 | 사용 시점 | 특징 |
|------|----------|------|
| **Push (FCM)** | 앱 백그라운드/종료 시 | 시스템 알림, 뱃지 업데이트 |
| **In-App** | 앱 포그라운드 시 | 토스트, 배너, 뱃지 |
| **Local** | 예약 알림, 리마인더 | 오프라인에서도 동작 |

---

## 2. 알림 타입 정의

### 알림 카테고리

```typescript
// src/types/notification.ts
export enum NotificationType {
  // === 지원 관련 ===
  /** 새로운 지원자 */
  NEW_APPLICATION = 'new_application',
  /** 지원 취소됨 */
  APPLICATION_CANCELLED = 'application_cancelled',
  /** 확정됨 (스태프에게) */
  APPLICATION_CONFIRMED = 'application_confirmed',
  /** 확정 취소됨 */
  CONFIRMATION_CANCELLED = 'confirmation_cancelled',
  /** 거절됨 */
  APPLICATION_REJECTED = 'application_rejected',

  // === 출퇴근 관련 ===
  /** 출근 체크인 알림 (구인자에게) */
  STAFF_CHECKED_IN = 'staff_checked_in',
  /** 퇴근 체크아웃 알림 (구인자에게) */
  STAFF_CHECKED_OUT = 'staff_checked_out',
  /** 출근 리마인더 (스태프에게) */
  CHECKIN_REMINDER = 'checkin_reminder',
  /** 노쇼 알림 */
  NO_SHOW_ALERT = 'no_show_alert',
  /** 근무 시간 변경 (스태프에게) - 관리자가 시간 수정 시 */
  SCHEDULE_CHANGE = 'schedule_change',

  // === 정산 관련 ===
  /** 정산 완료 (스태프에게) */
  SETTLEMENT_COMPLETED = 'settlement_completed',
  /** 정산 요청 (구인자에게) */
  SETTLEMENT_REQUESTED = 'settlement_requested',

  // === 공고 관련 ===
  /** 공고 마감 임박 */
  JOB_CLOSING_SOON = 'job_closing_soon',
  /** 새 공고 (관심 지역) */
  NEW_JOB_IN_AREA = 'new_job_in_area',
  /** 공고 수정됨 */
  JOB_UPDATED = 'job_updated',
  /** 공고 취소됨 */
  JOB_CANCELLED = 'job_cancelled',

  // === 시스템 ===
  /** 공지사항 */
  ANNOUNCEMENT = 'announcement',
  /** 시스템 점검 */
  MAINTENANCE = 'maintenance',
  /** 앱 업데이트 */
  APP_UPDATE = 'app_update',

  // === 관리자 ===
  /** 문의 답변 완료 */
  INQUIRY_ANSWERED = 'inquiry_answered',
  /** 신고 처리 완료 */
  REPORT_RESOLVED = 'report_resolved',
}

export interface NotificationData {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  /** 딥링크 경로 */
  link?: string;
  /** 추가 데이터 */
  data?: Record<string, string>;
  /** 읽음 여부 */
  isRead: boolean;
  /** 생성 시간 */
  createdAt: Timestamp;
  /** 수신자 ID */
  recipientId: string;
}
```

### 알림 메시지 템플릿

```typescript
// src/constants/notificationTemplates.ts
export interface NotificationTemplate {
  title: string | ((data: Record<string, unknown>) => string);
  body: string | ((data: Record<string, unknown>) => string);
  link: (data: Record<string, unknown>) => string;
}

export const NotificationTemplates: Record<NotificationType, NotificationTemplate> = {
  // === 지원 관련 ===
  [NotificationType.NEW_APPLICATION]: {
    title: '새로운 지원자',
    body: (d) => `${d.staffName}님이 "${d.jobTitle}" 공고에 지원했습니다.`,
    link: (d) => `/job-management/${d.jobPostingId}/applicants`,
  },

  [NotificationType.APPLICATION_CONFIRMED]: {
    title: '확정 알림',
    body: (d) => `"${d.jobTitle}" 공고에 확정되었습니다. ${d.workDate}에 출근해주세요.`,
    link: (d) => `/schedule?date=${d.workDate}`,
  },

  [NotificationType.APPLICATION_REJECTED]: {
    title: '지원 결과',
    body: (d) => `"${d.jobTitle}" 공고 지원이 거절되었습니다.`,
    link: (d) => `/job-board/${d.jobPostingId}`,
  },

  [NotificationType.CONFIRMATION_CANCELLED]: {
    title: '확정 취소',
    body: (d) => `"${d.jobTitle}" 확정이 취소되었습니다. 사유: ${d.reason || '미기재'}`,
    link: (d) => `/schedule`,
  },

  // === 출퇴근 관련 ===
  [NotificationType.STAFF_CHECKED_IN]: {
    title: '출근 알림',
    body: (d) => `${d.staffName}님이 ${d.checkInTime}에 출근했습니다.`,
    link: (d) => `/job-management/${d.jobPostingId}/attendance`,
  },

  [NotificationType.STAFF_CHECKED_OUT]: {
    title: '퇴근 알림',
    body: (d) => `${d.staffName}님이 퇴근했습니다. 근무시간: ${d.workHours}`,
    link: (d) => `/job-management/${d.jobPostingId}/settlement`,
  },

  [NotificationType.CHECKIN_REMINDER]: {
    title: (d) => `출근 30분 전 알림`,
    body: (d) => `"${d.jobTitle}" 출근 시간이 30분 남았습니다.`,
    link: (d) => `/schedule?date=${d.workDate}`,
  },

  [NotificationType.NO_SHOW_ALERT]: {
    title: '노쇼 알림',
    body: (d) => `${d.staffName}님이 출근하지 않았습니다.`,
    link: (d) => `/job-management/${d.jobPostingId}/attendance`,
  },

  [NotificationType.SCHEDULE_CHANGE]: {
    title: '⏰ 근무 시간 변경',
    body: (d) => `"${d.jobTitle}" 근무 시간이 변경되었습니다.\n${d.changeDescription || ''}`,
    link: (d) => `/schedule?date=${d.workDate}`,
  },

  // === 정산 관련 ===
  [NotificationType.SETTLEMENT_COMPLETED]: {
    title: '정산 완료',
    body: (d) => `"${d.jobTitle}" 정산이 완료되었습니다. 지급액: ${d.amount}원`,
    link: (d) => `/schedule/${d.workLogId}`,
  },

  [NotificationType.SETTLEMENT_REQUESTED]: {
    title: '정산 요청',
    body: (d) => `${d.staffName}님이 정산을 요청했습니다.`,
    link: (d) => `/job-management/${d.jobPostingId}/settlement`,
  },

  // === 공고 관련 ===
  [NotificationType.JOB_CLOSING_SOON]: {
    title: '마감 임박',
    body: (d) => `"${d.jobTitle}" 공고가 ${d.remainingTime}에 마감됩니다.`,
    link: (d) => `/job-board/${d.jobPostingId}`,
  },

  [NotificationType.NEW_JOB_IN_AREA]: {
    title: '새 공고',
    body: (d) => `${d.location}에 새로운 공고가 등록되었습니다. "${d.jobTitle}"`,
    link: (d) => `/job-board/${d.jobPostingId}`,
  },

  [NotificationType.JOB_CANCELLED]: {
    title: '공고 취소',
    body: (d) => `"${d.jobTitle}" 공고가 취소되었습니다.`,
    link: () => `/job-board`,
  },

  // === 시스템 ===
  [NotificationType.ANNOUNCEMENT]: {
    title: (d) => d.announcementTitle as string,
    body: (d) => d.announcementBody as string,
    link: (d) => `/announcements/${d.announcementId}`,
  },

  [NotificationType.INQUIRY_ANSWERED]: {
    title: '문의 답변',
    body: () => '문의하신 내용에 답변이 등록되었습니다.',
    link: (d) => `/support/inquiries/${d.inquiryId}`,
  },
};
```

---

## 3. 알림 트리거 포인트

### 비즈니스 플로우별 트리거

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     Complete Notification Flow                           │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────┐                                                         │
│  │ JOB POSTING │                                                         │
│  │   Created   │                                                         │
│  └──────┬──────┘                                                         │
│         │                                                                │
│         ▼                                                                │
│  ┌─────────────┐      ┌──────────────┐      ┌──────────────────────┐    │
│  │  Published  │─────▶│ NEW_JOB_IN   │─────▶│ 관심지역 설정 스태프 │    │
│  └──────┬──────┘      │    _AREA     │      │ (다수)               │    │
│         │             └──────────────┘      └──────────────────────┘    │
│         │                                                                │
│         ▼                                                                │
│  ┌─────────────┐      ┌──────────────┐      ┌──────────────────────┐    │
│  │ Application │─────▶│    NEW_      │─────▶│ 구인자               │    │
│  │   Submit    │      │ APPLICATION  │      │                      │    │
│  └──────┬──────┘      └──────────────┘      └──────────────────────┘    │
│         │                                                                │
│         ▼                                                                │
│  ┌─────────────┐      ┌──────────────┐      ┌──────────────────────┐    │
│  │  Confirm    │─────▶│ APPLICATION_ │─────▶│ 스태프               │    │
│  │             │      │  CONFIRMED   │      │                      │    │
│  └──────┬──────┘      └──────────────┘      └──────────────────────┘    │
│         │                                                                │
│         ▼                                                                │
│  ┌─────────────┐      ┌──────────────┐      ┌──────────────────────┐    │
│  │ D-1 / 30min │─────▶│   CHECKIN_   │─────▶│ 확정된 스태프        │    │
│  │   Before    │      │   REMINDER   │      │                      │    │
│  └──────┬──────┘      └──────────────┘      └──────────────────────┘    │
│         │                                                                │
│         ▼                                                                │
│  ┌─────────────┐      ┌──────────────┐      ┌──────────────────────┐    │
│  │  Check-In   │─────▶│ STAFF_CHECKED│─────▶│ 구인자               │    │
│  │    (QR)     │      │     _IN      │      │                      │    │
│  └──────┬──────┘      └──────────────┘      └──────────────────────┘    │
│         │                                                                │
│         │  ┌─────────┐      ┌──────────────┐      ┌────────────────┐    │
│         ├─▶│ No Show │─────▶│ NO_SHOW_ALERT│─────▶│ 구인자         │    │
│         │  │(+30min) │      │              │      │                │    │
│         │  └─────────┘      └──────────────┘      └────────────────┘    │
│         │                                                                │
│         ▼                                                                │
│  ┌─────────────┐      ┌──────────────┐      ┌──────────────────────┐    │
│  │  Check-Out  │─────▶│ STAFF_CHECKED│─────▶│ 구인자               │    │
│  │    (QR)     │      │     _OUT     │      │                      │    │
│  └──────┬──────┘      └──────────────┘      └──────────────────────┘    │
│         │                                                                │
│         ▼                                                                │
│  ┌─────────────┐      ┌──────────────┐      ┌──────────────────────┐    │
│  │  Settlement │─────▶│  SETTLEMENT_ │─────▶│ 스태프               │    │
│  │  Complete   │      │  COMPLETED   │      │                      │    │
│  └─────────────┘      └──────────────┘      └──────────────────────┘    │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Firebase Functions 트리거

```typescript
// functions/src/notifications/triggers.ts
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { NotificationType } from '../types';
import { sendNotification } from './sender';

/**
 * 지원 생성 시 → 구인자에게 알림
 */
export const onApplicationCreated = functions.firestore
  .document('applications/{applicationId}')
  .onCreate(async (snapshot, context) => {
    const application = snapshot.data();
    const { jobPostingId, applicantId, applicantName } = application;

    // 공고 정보 조회
    const jobPosting = await admin.firestore()
      .collection('jobPostings')
      .doc(jobPostingId)
      .get();

    const { title, ownerId } = jobPosting.data()!;

    // 구인자에게 알림 전송
    await sendNotification({
      recipientId: ownerId,
      type: NotificationType.NEW_APPLICATION,
      data: {
        jobPostingId,
        jobTitle: title,
        staffName: applicantName,
        applicationId: context.params.applicationId,
      },
    });
  });

/**
 * 확정 시 → 스태프에게 알림
 */
export const onApplicationConfirmed = functions.firestore
  .document('applications/{applicationId}')
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();

    // 상태가 'confirmed'로 변경된 경우만
    if (before.status !== 'confirmed' && after.status === 'confirmed') {
      const { jobPostingId, applicantId } = after;

      // 공고 정보 조회
      const jobPosting = await admin.firestore()
        .collection('jobPostings')
        .doc(jobPostingId)
        .get();

      const { title, workDate } = jobPosting.data()!;

      // 스태프에게 알림
      await sendNotification({
        recipientId: applicantId,
        type: NotificationType.APPLICATION_CONFIRMED,
        data: {
          jobPostingId,
          jobTitle: title,
          workDate: workDate.toDate().toISOString().split('T')[0],
        },
      });

      // 출근 리마인더 예약 (D-1, 30분 전)
      await scheduleCheckInReminders(applicantId, jobPostingId, workDate);
    }
  });

/**
 * 출근 체크인 시 → 구인자에게 알림
 */
export const onCheckIn = functions.firestore
  .document('workLogs/{workLogId}')
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();

    // 출근 시간이 기록된 경우
    if (!before.actualCheckIn && after.actualCheckIn) {
      const { jobPostingId, staffId, staffName, actualCheckIn } = after;

      // 공고 정보 조회
      const jobPosting = await admin.firestore()
        .collection('jobPostings')
        .doc(jobPostingId)
        .get();

      const { ownerId } = jobPosting.data()!;

      // 구인자에게 알림
      await sendNotification({
        recipientId: ownerId,
        type: NotificationType.STAFF_CHECKED_IN,
        data: {
          jobPostingId,
          staffName,
          checkInTime: formatTime(actualCheckIn.toDate()),
          workLogId: context.params.workLogId,
        },
      });
    }
  });

/**
 * 퇴근 체크아웃 시 → 구인자에게 알림
 */
export const onCheckOut = functions.firestore
  .document('workLogs/{workLogId}')
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();

    // 퇴근 시간이 기록된 경우
    if (!before.actualCheckOut && after.actualCheckOut) {
      const { jobPostingId, staffId, staffName, actualCheckIn, actualCheckOut } = after;

      // 근무시간 계산
      const workHours = calculateWorkHours(
        actualCheckIn.toDate(),
        actualCheckOut.toDate()
      );

      // 공고 정보 조회
      const jobPosting = await admin.firestore()
        .collection('jobPostings')
        .doc(jobPostingId)
        .get();

      const { ownerId } = jobPosting.data()!;

      // 구인자에게 알림
      await sendNotification({
        recipientId: ownerId,
        type: NotificationType.STAFF_CHECKED_OUT,
        data: {
          jobPostingId,
          staffName,
          workHours: `${workHours}시간`,
          workLogId: context.params.workLogId,
        },
      });
    }
  });

/**
 * 근무 시간 변경 시 → 스태프에게 알림
 * 관리자(구인자)가 시간을 수정하면 해당 스태프에게 알림 발송
 */
export const onWorkTimeChanged = functions.firestore
  .document('workLogs/{workLogId}')
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();

    // 시간 변경 감지 (출근 또는 퇴근 시간이 수정된 경우)
    const checkInChanged = before.actualCheckIn?.toMillis() !== after.actualCheckIn?.toMillis();
    const checkOutChanged = before.actualCheckOut?.toMillis() !== after.actualCheckOut?.toMillis();

    // 관리자에 의한 수정인지 확인 (updatedBy 필드 체크)
    const isAdminEdit = after.lastEditedBy && after.lastEditedBy !== after.staffId;

    if ((checkInChanged || checkOutChanged) && isAdminEdit) {
      const { staffId, jobPostingId, actualCheckIn, actualCheckOut, workDate } = after;

      // 공고 정보 조회
      const jobPosting = await admin.firestore()
        .collection('jobPostings')
        .doc(jobPostingId)
        .get();

      const { title } = jobPosting.data()!;

      // 변경 내용 설명 생성
      const changes: string[] = [];
      if (checkInChanged && actualCheckIn) {
        changes.push(`출근: ${formatTime(actualCheckIn.toDate())}`);
      }
      if (checkOutChanged && actualCheckOut) {
        changes.push(`퇴근: ${formatTime(actualCheckOut.toDate())}`);
      }

      // 스태프에게 알림
      await sendNotification({
        recipientId: staffId,
        type: NotificationType.SCHEDULE_CHANGE,
        data: {
          jobPostingId,
          jobTitle: title,
          workDate: workDate,
          changeDescription: changes.join(', '),
          workLogId: context.params.workLogId,
        },
      });
    }
  });

/**
 * 정산 완료 시 → 스태프에게 알림
 */
export const onSettlementCompleted = functions.firestore
  .document('workLogs/{workLogId}')
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();

    // 정산 상태가 'settled'로 변경된 경우
    if (before.settlementStatus !== 'settled' && after.settlementStatus === 'settled') {
      const { staffId, staffName, jobPostingId, finalSalary } = after;

      // 공고 정보 조회
      const jobPosting = await admin.firestore()
        .collection('jobPostings')
        .doc(jobPostingId)
        .get();

      const { title } = jobPosting.data()!;

      // 스태프에게 알림
      await sendNotification({
        recipientId: staffId,
        type: NotificationType.SETTLEMENT_COMPLETED,
        data: {
          jobPostingId,
          jobTitle: title,
          amount: finalSalary.toLocaleString(),
          workLogId: context.params.workLogId,
        },
      });
    }
  });

/**
 * 노쇼 감지 (출근 시간 + 30분 경과)
 */
export const checkNoShow = functions.pubsub
  .schedule('every 5 minutes')
  .onRun(async () => {
    const now = admin.firestore.Timestamp.now();
    const thirtyMinAgo = new Date(now.toMillis() - 30 * 60 * 1000);

    // 출근 시간이 30분 전이고 아직 체크인하지 않은 workLogs
    const noShowLogs = await admin.firestore()
      .collection('workLogs')
      .where('scheduledCheckIn', '<=', admin.firestore.Timestamp.fromDate(thirtyMinAgo))
      .where('actualCheckIn', '==', null)
      .where('noShowNotified', '==', false)
      .get();

    for (const doc of noShowLogs.docs) {
      const workLog = doc.data();
      const { jobPostingId, staffName } = workLog;

      // 공고 정보 조회
      const jobPosting = await admin.firestore()
        .collection('jobPostings')
        .doc(jobPostingId)
        .get();

      const { ownerId } = jobPosting.data()!;

      // 구인자에게 노쇼 알림
      await sendNotification({
        recipientId: ownerId,
        type: NotificationType.NO_SHOW_ALERT,
        data: {
          jobPostingId,
          staffName,
          workLogId: doc.id,
        },
      });

      // 알림 전송 표시
      await doc.ref.update({ noShowNotified: true });
    }
  });

/**
 * 출근 리마인더 예약
 */
async function scheduleCheckInReminders(
  staffId: string,
  jobPostingId: string,
  workDate: admin.firestore.Timestamp
): Promise<void> {
  const workDateTime = workDate.toDate();

  // D-1 오후 8시 리마인더
  const dayBefore = new Date(workDateTime);
  dayBefore.setDate(dayBefore.getDate() - 1);
  dayBefore.setHours(20, 0, 0, 0);

  // 30분 전 리마인더
  const thirtyMinBefore = new Date(workDateTime.getTime() - 30 * 60 * 1000);

  // Cloud Tasks로 예약 (또는 Firestore 스케줄 문서 생성)
  await admin.firestore().collection('scheduledNotifications').add({
    recipientId: staffId,
    type: NotificationType.CHECKIN_REMINDER,
    scheduledAt: admin.firestore.Timestamp.fromDate(dayBefore),
    data: { jobPostingId },
    sent: false,
  });

  await admin.firestore().collection('scheduledNotifications').add({
    recipientId: staffId,
    type: NotificationType.CHECKIN_REMINDER,
    scheduledAt: admin.firestore.Timestamp.fromDate(thirtyMinBefore),
    data: { jobPostingId },
    sent: false,
  });
}
```

---

## 4. FCM 푸시 알림

### 알림 전송 서비스

```typescript
// functions/src/notifications/sender.ts
import * as admin from 'firebase-admin';
import { NotificationType, NotificationTemplates } from '../types';

interface SendNotificationParams {
  recipientId: string;
  type: NotificationType;
  data: Record<string, string>;
}

export async function sendNotification(params: SendNotificationParams): Promise<void> {
  const { recipientId, type, data } = params;

  // 1. 사용자 알림 설정 확인
  const userSettings = await getUserNotificationSettings(recipientId);
  if (!userSettings.enabled || !userSettings.types[type]) {
    console.log(`Notification skipped: user ${recipientId} disabled ${type}`);
    return;
  }

  // 2. FCM 토큰 조회
  const fcmTokens = await getUserFcmTokens(recipientId);
  if (fcmTokens.length === 0) {
    console.log(`No FCM tokens for user ${recipientId}`);
  }

  // 3. 알림 템플릿 적용
  const template = NotificationTemplates[type];
  const title = typeof template.title === 'function'
    ? template.title(data)
    : template.title;
  const body = typeof template.body === 'function'
    ? template.body(data)
    : template.body;
  const link = template.link(data);

  // 4. Firestore에 알림 저장 (인앱 알림용)
  const notificationDoc = await admin.firestore()
    .collection('notifications')
    .add({
      recipientId,
      type,
      title,
      body,
      link,
      data,
      isRead: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

  // 5. FCM 전송
  if (fcmTokens.length > 0) {
    const message: admin.messaging.MulticastMessage = {
      tokens: fcmTokens,
      notification: {
        title,
        body,
      },
      data: {
        notificationId: notificationDoc.id,
        type,
        link,
        ...data,
      },
      android: {
        priority: 'high',
        notification: {
          channelId: getAndroidChannelId(type),
          icon: '@drawable/ic_notification',
          color: '#4F46E5',
        },
      },
      apns: {
        payload: {
          aps: {
            badge: await getUnreadCount(recipientId),
            sound: 'default',
            category: type,
          },
        },
      },
    };

    const response = await admin.messaging().sendEachForMulticast(message);

    // 실패한 토큰 정리
    response.responses.forEach((res, idx) => {
      if (!res.success && res.error?.code === 'messaging/registration-token-not-registered') {
        removeInvalidToken(recipientId, fcmTokens[idx]);
      }
    });
  }
}

function getAndroidChannelId(type: NotificationType): string {
  const channelMap: Record<string, string> = {
    [NotificationType.NEW_APPLICATION]: 'applications',
    [NotificationType.APPLICATION_CONFIRMED]: 'applications',
    [NotificationType.CHECKIN_REMINDER]: 'reminders',
    [NotificationType.SETTLEMENT_COMPLETED]: 'settlement',
    [NotificationType.ANNOUNCEMENT]: 'announcements',
  };
  return channelMap[type] || 'default';
}

async function getUserNotificationSettings(userId: string): Promise<NotificationSettings> {
  const doc = await admin.firestore()
    .collection('userSettings')
    .doc(userId)
    .get();

  return doc.exists
    ? doc.data()!.notifications
    : { enabled: true, types: {} }; // 기본값: 모두 허용
}

async function getUserFcmTokens(userId: string): Promise<string[]> {
  const doc = await admin.firestore()
    .collection('users')
    .doc(userId)
    .get();

  return doc.data()?.fcmTokens || [];
}

async function getUnreadCount(userId: string): Promise<number> {
  const snapshot = await admin.firestore()
    .collection('notifications')
    .where('recipientId', '==', userId)
    .where('isRead', '==', false)
    .count()
    .get();

  return snapshot.data().count;
}

async function removeInvalidToken(userId: string, token: string): Promise<void> {
  await admin.firestore()
    .collection('users')
    .doc(userId)
    .update({
      fcmTokens: admin.firestore.FieldValue.arrayRemove(token),
    });
}
```

### 클라이언트 FCM 설정

```typescript
// src/services/fcmService.ts
import messaging from '@react-native-firebase/messaging';
import notifee, { AndroidImportance } from '@notifee/react-native';
import { Platform } from 'react-native';
import { router } from 'expo-router';

class FCMService {
  async init(): Promise<void> {
    // 권한 요청
    const authStatus = await messaging().requestPermission();
    const enabled =
      authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
      authStatus === messaging.AuthorizationStatus.PROVISIONAL;

    if (!enabled) {
      console.log('FCM permission denied');
      return;
    }

    // Android 채널 생성
    if (Platform.OS === 'android') {
      await this.createNotificationChannels();
    }

    // 포그라운드 메시지 핸들러
    messaging().onMessage(this.handleForegroundMessage);

    // 백그라운드 메시지 핸들러 (앱 종료 시)
    messaging().setBackgroundMessageHandler(this.handleBackgroundMessage);

    // 알림 클릭 핸들러 (앱이 백그라운드에서 열릴 때)
    messaging().onNotificationOpenedApp(this.handleNotificationOpen);

    // 앱이 완전히 종료된 상태에서 열릴 때
    const initialNotification = await messaging().getInitialNotification();
    if (initialNotification) {
      this.handleNotificationOpen(initialNotification);
    }
  }

  async getToken(): Promise<string | null> {
    try {
      const token = await messaging().getToken();
      return token;
    } catch (error) {
      console.error('Failed to get FCM token:', error);
      return null;
    }
  }

  async registerToken(userId: string): Promise<void> {
    const token = await this.getToken();
    if (!token) return;

    // Firestore에 토큰 저장
    await firestore()
      .collection('users')
      .doc(userId)
      .update({
        fcmTokens: firestore.FieldValue.arrayUnion(token),
        lastTokenUpdate: firestore.FieldValue.serverTimestamp(),
      });

    // 토큰 갱신 리스너
    messaging().onTokenRefresh(async (newToken) => {
      await firestore()
        .collection('users')
        .doc(userId)
        .update({
          fcmTokens: firestore.FieldValue.arrayUnion(newToken),
        });
    });
  }

  async unregisterToken(userId: string): Promise<void> {
    const token = await this.getToken();
    if (!token) return;

    await firestore()
      .collection('users')
      .doc(userId)
      .update({
        fcmTokens: firestore.FieldValue.arrayRemove(token),
      });
  }

  private async createNotificationChannels(): Promise<void> {
    await notifee.createChannelGroup({
      id: 'uniqn',
      name: 'UNIQN 알림',
    });

    const channels = [
      {
        id: 'applications',
        name: '지원/확정 알림',
        importance: AndroidImportance.HIGH,
      },
      {
        id: 'reminders',
        name: '출근 리마인더',
        importance: AndroidImportance.HIGH,
      },
      {
        id: 'settlement',
        name: '정산 알림',
        importance: AndroidImportance.DEFAULT,
      },
      {
        id: 'announcements',
        name: '공지사항',
        importance: AndroidImportance.LOW,
      },
      {
        id: 'default',
        name: '일반 알림',
        importance: AndroidImportance.DEFAULT,
      },
    ];

    for (const channel of channels) {
      await notifee.createChannel({
        ...channel,
        groupId: 'uniqn',
      });
    }
  }

  private handleForegroundMessage = async (message: any): Promise<void> => {
    // 포그라운드에서는 notifee로 로컬 알림 표시
    await notifee.displayNotification({
      title: message.notification?.title,
      body: message.notification?.body,
      android: {
        channelId: message.data?.channelId || 'default',
        pressAction: {
          id: 'default',
        },
      },
      data: message.data,
    });

    // 배지 업데이트
    await this.updateBadgeCount();
  };

  private handleBackgroundMessage = async (message: any): Promise<void> => {
    console.log('Background message:', message);
    // 백그라운드에서는 시스템이 자동 표시
  };

  private handleNotificationOpen = (message: any): void => {
    const link = message.data?.link;
    if (link) {
      // 딥링크로 이동
      router.push(link);
    }
  };

  private async updateBadgeCount(): Promise<void> {
    // iOS에서 배지 업데이트
    if (Platform.OS === 'ios') {
      const count = await this.getUnreadCount();
      await notifee.setBadgeCount(count);
    }
  }

  private async getUnreadCount(): Promise<number> {
    // Firestore에서 읽지 않은 알림 수 조회
    const { currentUser } = auth();
    if (!currentUser) return 0;

    const snapshot = await firestore()
      .collection('notifications')
      .where('recipientId', '==', currentUser.uid)
      .where('isRead', '==', false)
      .count()
      .get();

    return snapshot.data().count;
  }
}

export const fcmService = new FCMService();
```

---

## 5. 인앱 알림

### 알림 스토어

```typescript
// src/stores/notificationStore.ts
import { create } from 'zustand';
import { NotificationData, NotificationType } from '@/types/notification';

interface NotificationState {
  notifications: NotificationData[];
  unreadCount: number;
  isLoading: boolean;
  hasMore: boolean;

  // Actions
  setNotifications: (notifications: NotificationData[]) => void;
  addNotification: (notification: NotificationData) => void;
  markAsRead: (notificationId: string) => void;
  markAllAsRead: () => void;
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  isLoading: false,
  hasMore: true,

  setNotifications: (notifications) => {
    set({
      notifications,
      unreadCount: notifications.filter((n) => !n.isRead).length,
    });
  },

  addNotification: (notification) => {
    set((state) => ({
      notifications: [notification, ...state.notifications],
      unreadCount: state.unreadCount + (notification.isRead ? 0 : 1),
    }));
  },

  markAsRead: async (notificationId) => {
    // Firestore 업데이트
    await firestore()
      .collection('notifications')
      .doc(notificationId)
      .update({ isRead: true });

    set((state) => ({
      notifications: state.notifications.map((n) =>
        n.id === notificationId ? { ...n, isRead: true } : n
      ),
      unreadCount: Math.max(0, state.unreadCount - 1),
    }));
  },

  markAllAsRead: async () => {
    const { currentUser } = auth();
    if (!currentUser) return;

    // 배치 업데이트
    const batch = firestore().batch();
    const unread = get().notifications.filter((n) => !n.isRead);

    unread.forEach((n) => {
      batch.update(
        firestore().collection('notifications').doc(n.id),
        { isRead: true }
      );
    });

    await batch.commit();

    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, isRead: true })),
      unreadCount: 0,
    }));
  },

  loadMore: async () => {
    const state = get();
    if (state.isLoading || !state.hasMore) return;

    set({ isLoading: true });

    const lastNotification = state.notifications[state.notifications.length - 1];
    const { currentUser } = auth();

    const snapshot = await firestore()
      .collection('notifications')
      .where('recipientId', '==', currentUser?.uid)
      .orderBy('createdAt', 'desc')
      .startAfter(lastNotification?.createdAt)
      .limit(20)
      .get();

    const newNotifications = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as NotificationData[];

    set((state) => ({
      notifications: [...state.notifications, ...newNotifications],
      hasMore: newNotifications.length === 20,
      isLoading: false,
    }));
  },

  refresh: async () => {
    const { currentUser } = auth();
    if (!currentUser) return;

    set({ isLoading: true });

    const snapshot = await firestore()
      .collection('notifications')
      .where('recipientId', '==', currentUser.uid)
      .orderBy('createdAt', 'desc')
      .limit(20)
      .get();

    const notifications = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as NotificationData[];

    set({
      notifications,
      unreadCount: notifications.filter((n) => !n.isRead).length,
      hasMore: notifications.length === 20,
      isLoading: false,
    });
  },
}));
```

### 실시간 알림 리스너

```typescript
// src/hooks/useNotificationListener.ts
import { useEffect } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { useNotificationStore } from '@/stores/notificationStore';
import { useToastStore } from '@/stores/toastStore';

export function useNotificationListener() {
  const { user } = useAuthStore();
  const { addNotification } = useNotificationStore();
  const { addToast } = useToastStore();

  useEffect(() => {
    if (!user) return;

    // 새 알림 실시간 구독
    const unsubscribe = firestore()
      .collection('notifications')
      .where('recipientId', '==', user.uid)
      .orderBy('createdAt', 'desc')
      .limit(1)
      .onSnapshot(
        (snapshot) => {
          snapshot.docChanges().forEach((change) => {
            if (change.type === 'added') {
              const notification = {
                id: change.doc.id,
                ...change.doc.data(),
              } as NotificationData;

              // 스토어에 추가
              addNotification(notification);

              // 인앱 토스트 표시 (앱이 포그라운드일 때)
              addToast({
                type: 'info',
                message: notification.body,
                action: notification.link
                  ? {
                      label: '보기',
                      onPress: () => router.push(notification.link!),
                    }
                  : undefined,
              });
            }
          });
        },
        (error) => {
          console.error('Notification listener error:', error);
        }
      );

    return () => unsubscribe();
  }, [user?.uid]);
}
```

---

## 6. 알림 설정 관리

### 알림 설정 타입

```typescript
// src/types/notificationSettings.ts
export interface NotificationSettings {
  /** 전체 알림 ON/OFF */
  enabled: boolean;

  /** 타입별 설정 */
  types: {
    /** 지원/확정 알림 */
    applications: boolean;
    /** 출퇴근 알림 */
    attendance: boolean;
    /** 정산 알림 */
    settlement: boolean;
    /** 공고 알림 */
    jobs: boolean;
    /** 공지사항 */
    announcements: boolean;
  };

  /** 방해금지 시간 */
  quietHours: {
    enabled: boolean;
    startTime: string; // "22:00"
    endTime: string; // "08:00"
  };

  /** 진동 */
  vibration: boolean;

  /** 소리 */
  sound: boolean;
}

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  enabled: true,
  types: {
    applications: true,
    attendance: true,
    settlement: true,
    jobs: true,
    announcements: true,
  },
  quietHours: {
    enabled: false,
    startTime: '22:00',
    endTime: '08:00',
  },
  vibration: true,
  sound: true,
};
```

### 설정 서비스

```typescript
// src/services/notificationSettingsService.ts
import { NotificationSettings, DEFAULT_NOTIFICATION_SETTINGS } from '@/types';

export const notificationSettingsService = {
  async getSettings(userId: string): Promise<NotificationSettings> {
    const doc = await firestore()
      .collection('userSettings')
      .doc(userId)
      .get();

    if (!doc.exists) {
      return DEFAULT_NOTIFICATION_SETTINGS;
    }

    return {
      ...DEFAULT_NOTIFICATION_SETTINGS,
      ...doc.data()?.notifications,
    };
  },

  async updateSettings(
    userId: string,
    settings: Partial<NotificationSettings>
  ): Promise<void> {
    await firestore()
      .collection('userSettings')
      .doc(userId)
      .set(
        {
          notifications: settings,
          updatedAt: firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
  },

  async toggleType(
    userId: string,
    type: keyof NotificationSettings['types'],
    enabled: boolean
  ): Promise<void> {
    await firestore()
      .collection('userSettings')
      .doc(userId)
      .set(
        {
          [`notifications.types.${type}`]: enabled,
          updatedAt: firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
  },
};
```

### 설정 화면

```typescript
// src/app/(app)/settings/notifications.tsx
import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Switch } from '@/components/ui/Switch';
import { useAuthStore } from '@/stores/authStore';
import { notificationSettingsService } from '@/services/notificationSettingsService';

export default function NotificationSettingsScreen() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useQuery({
    queryKey: ['notificationSettings', user?.uid],
    queryFn: () => notificationSettingsService.getSettings(user!.uid),
    enabled: !!user,
  });

  const updateMutation = useMutation({
    mutationFn: (newSettings: Partial<NotificationSettings>) =>
      notificationSettingsService.updateSettings(user!.uid, newSettings),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notificationSettings'] });
    },
  });

  if (isLoading || !settings) {
    return <LoadingSpinner />;
  }

  const toggleSetting = (key: string, value: boolean) => {
    updateMutation.mutate({ [key]: value });
  };

  const toggleType = (type: keyof typeof settings.types) => {
    updateMutation.mutate({
      types: { ...settings.types, [type]: !settings.types[type] },
    });
  };

  return (
    <ScrollView className="flex-1 bg-gray-50 dark:bg-gray-900">
      {/* 전체 알림 */}
      <View className="bg-white dark:bg-gray-800 p-4 mb-4">
        <SettingRow
          title="알림 받기"
          description="모든 알림을 켜거나 끕니다"
          value={settings.enabled}
          onToggle={(v) => toggleSetting('enabled', v)}
        />
      </View>

      {/* 알림 종류 */}
      <View className="bg-white dark:bg-gray-800 p-4 mb-4">
        <Text className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-4">
          알림 종류
        </Text>

        <SettingRow
          title="지원/확정 알림"
          description="새 지원자, 확정/거절 알림"
          value={settings.types.applications}
          onToggle={() => toggleType('applications')}
          disabled={!settings.enabled}
        />

        <SettingRow
          title="출퇴근 알림"
          description="출근 리마인더, 체크인/아웃 알림"
          value={settings.types.attendance}
          onToggle={() => toggleType('attendance')}
          disabled={!settings.enabled}
        />

        <SettingRow
          title="정산 알림"
          description="정산 완료 알림"
          value={settings.types.settlement}
          onToggle={() => toggleType('settlement')}
          disabled={!settings.enabled}
        />

        <SettingRow
          title="공고 알림"
          description="새 공고, 마감 임박 알림"
          value={settings.types.jobs}
          onToggle={() => toggleType('jobs')}
          disabled={!settings.enabled}
        />

        <SettingRow
          title="공지사항"
          description="서비스 공지사항"
          value={settings.types.announcements}
          onToggle={() => toggleType('announcements')}
          disabled={!settings.enabled}
        />
      </View>

      {/* 방해금지 시간 */}
      <View className="bg-white dark:bg-gray-800 p-4 mb-4">
        <Text className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-4">
          방해금지 시간
        </Text>

        <SettingRow
          title="방해금지 모드"
          description={
            settings.quietHours.enabled
              ? `${settings.quietHours.startTime} ~ ${settings.quietHours.endTime}`
              : '사용 안함'
          }
          value={settings.quietHours.enabled}
          onToggle={(v) =>
            updateMutation.mutate({
              quietHours: { ...settings.quietHours, enabled: v },
            })
          }
          disabled={!settings.enabled}
        />

        {settings.quietHours.enabled && (
          <TimeRangePicker
            startTime={settings.quietHours.startTime}
            endTime={settings.quietHours.endTime}
            onChange={(start, end) =>
              updateMutation.mutate({
                quietHours: { enabled: true, startTime: start, endTime: end },
              })
            }
          />
        )}
      </View>

      {/* 알림 방식 */}
      <View className="bg-white dark:bg-gray-800 p-4">
        <Text className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-4">
          알림 방식
        </Text>

        <SettingRow
          title="진동"
          value={settings.vibration}
          onToggle={(v) => toggleSetting('vibration', v)}
          disabled={!settings.enabled}
        />

        <SettingRow
          title="소리"
          value={settings.sound}
          onToggle={(v) => toggleSetting('sound', v)}
          disabled={!settings.enabled}
        />
      </View>
    </ScrollView>
  );
}

interface SettingRowProps {
  title: string;
  description?: string;
  value: boolean;
  onToggle: (value: boolean) => void;
  disabled?: boolean;
}

function SettingRow({ title, description, value, onToggle, disabled }: SettingRowProps) {
  return (
    <View className="flex-row justify-between items-center py-3 border-b border-gray-100 dark:border-gray-700">
      <View className="flex-1">
        <Text className={`text-base ${disabled ? 'text-gray-400' : 'text-gray-900 dark:text-white'}`}>
          {title}
        </Text>
        {description && (
          <Text className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            {description}
          </Text>
        )}
      </View>
      <Switch
        value={value}
        onValueChange={onToggle}
        disabled={disabled}
      />
    </View>
  );
}
```

---

## 7. 딥링크 처리

> **상세 가이드**: [17-deep-linking.md](./17-deep-linking.md) 참조
> - 알림 탭 시 화면 이동 상세 구현
> - 포그라운드/백그라운드/종료 상태별 처리
> - 미인증 시 대기 딥링크 처리
> - 분석 추적 연동

### 딥링크 설정

```typescript
// app.config.ts
export default {
  expo: {
    scheme: 'uniqn',
    // ...
    android: {
      intentFilters: [
        {
          action: 'VIEW',
          autoVerify: true,
          data: [
            {
              scheme: 'https',
              host: 'uniqn.app',
              pathPrefix: '/',
            },
          ],
          category: ['BROWSABLE', 'DEFAULT'],
        },
      ],
    },
    ios: {
      associatedDomains: ['applinks:uniqn.app'],
    },
  },
};
```

### 딥링크 라우터

```typescript
// src/lib/deeplink/router.ts
import { router } from 'expo-router';
import { Linking } from 'react-native';
import { useEffect } from 'react';

export function useDeepLinkRouter() {
  useEffect(() => {
    // 앱이 열려있을 때 딥링크 처리
    const subscription = Linking.addEventListener('url', handleDeepLink);

    // 앱이 딥링크로 열렸을 때 처리
    Linking.getInitialURL().then((url) => {
      if (url) handleDeepLink({ url });
    });

    return () => subscription.remove();
  }, []);
}

function handleDeepLink({ url }: { url: string }) {
  const path = parseDeepLinkPath(url);
  if (path) {
    router.push(path);
  }
}

function parseDeepLinkPath(url: string): string | null {
  // uniqn://job-board/123 → /job-board/123
  // https://uniqn.app/job-board/123 → /job-board/123

  try {
    const parsed = new URL(url);

    // 커스텀 스킴
    if (parsed.protocol === 'uniqn:') {
      return `/${parsed.hostname}${parsed.pathname}${parsed.search}`;
    }

    // 유니버설 링크
    if (parsed.hostname === 'uniqn.app') {
      return `${parsed.pathname}${parsed.search}`;
    }

    return null;
  } catch {
    return null;
  }
}
```

### 알림에서 딥링크 처리

```typescript
// src/hooks/useNotificationNavigation.ts
import { useEffect } from 'react';
import messaging from '@react-native-firebase/messaging';
import { router } from 'expo-router';

export function useNotificationNavigation() {
  useEffect(() => {
    // 앱이 백그라운드에서 알림 클릭으로 열릴 때
    const unsubscribe = messaging().onNotificationOpenedApp((message) => {
      const link = message.data?.link as string;
      if (link) {
        // 약간의 딜레이 후 이동 (앱 초기화 대기)
        setTimeout(() => {
          router.push(link);
        }, 100);
      }
    });

    // 앱이 종료 상태에서 알림 클릭으로 열릴 때
    messaging()
      .getInitialNotification()
      .then((message) => {
        if (message) {
          const link = message.data?.link as string;
          if (link) {
            setTimeout(() => {
              router.push(link);
            }, 500); // 앱 초기화 시간 고려
          }
        }
      });

    return unsubscribe;
  }, []);
}
```

---

## 8. 알림 UI 컴포넌트

### 알림 목록 화면

```typescript
// src/app/(app)/notifications/index.tsx
import React, { useCallback } from 'react';
import { View, Text, Pressable, RefreshControl } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { router } from 'expo-router';
import { useNotificationStore } from '@/stores/notificationStore';
import { NotificationData } from '@/types/notification';
import { formatRelativeTime } from '@/utils/date';

export default function NotificationsScreen() {
  const {
    notifications,
    isLoading,
    hasMore,
    refresh,
    loadMore,
    markAsRead,
    markAllAsRead,
  } = useNotificationStore();

  const handlePress = useCallback((notification: NotificationData) => {
    if (!notification.isRead) {
      markAsRead(notification.id);
    }
    if (notification.link) {
      router.push(notification.link);
    }
  }, []);

  const renderItem = useCallback(({ item }: { item: NotificationData }) => (
    <NotificationItem
      notification={item}
      onPress={() => handlePress(item)}
    />
  ), [handlePress]);

  return (
    <View className="flex-1 bg-gray-50 dark:bg-gray-900">
      {/* 헤더 액션 */}
      <View className="px-4 py-2 flex-row justify-end">
        <Pressable onPress={markAllAsRead}>
          <Text className="text-blue-600 dark:text-blue-400">
            모두 읽음
          </Text>
        </Pressable>
      </View>

      <FlashList
        data={notifications}
        renderItem={renderItem}
        estimatedItemSize={80}
        onEndReached={hasMore ? loadMore : undefined}
        onEndReachedThreshold={0.5}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={refresh}
          />
        }
        ListEmptyComponent={
          <View className="flex-1 items-center justify-center py-20">
            <Text className="text-gray-500 dark:text-gray-400">
              알림이 없습니다
            </Text>
          </View>
        }
      />
    </View>
  );
}

interface NotificationItemProps {
  notification: NotificationData;
  onPress: () => void;
}

function NotificationItem({ notification, onPress }: NotificationItemProps) {
  return (
    <Pressable
      onPress={onPress}
      className={`
        px-4 py-3 border-b border-gray-100 dark:border-gray-800
        ${notification.isRead ? 'bg-white dark:bg-gray-900' : 'bg-blue-50 dark:bg-blue-900/20'}
      `}
    >
      <View className="flex-row items-start">
        {/* 읽음 표시 */}
        {!notification.isRead && (
          <View className="w-2 h-2 rounded-full bg-blue-600 mt-2 mr-2" />
        )}

        <View className="flex-1">
          {/* 제목 */}
          <Text
            className={`
              text-base
              ${notification.isRead
                ? 'text-gray-700 dark:text-gray-300'
                : 'text-gray-900 dark:text-white font-medium'
              }
            `}
          >
            {notification.title}
          </Text>

          {/* 본문 */}
          <Text
            className="text-sm text-gray-500 dark:text-gray-400 mt-0.5"
            numberOfLines={2}
          >
            {notification.body}
          </Text>

          {/* 시간 */}
          <Text className="text-xs text-gray-400 dark:text-gray-500 mt-1">
            {formatRelativeTime(notification.createdAt.toDate())}
          </Text>
        </View>

        {/* 아이콘 */}
        <NotificationIcon type={notification.type} />
      </View>
    </Pressable>
  );
}
```

### 알림 뱃지 컴포넌트

```typescript
// src/components/ui/NotificationBadge.tsx
import React from 'react';
import { View, Text } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

interface NotificationBadgeProps {
  count: number;
  maxCount?: number;
}

export function NotificationBadge({
  count,
  maxCount = 99,
}: NotificationBadgeProps) {
  if (count === 0) return null;

  const displayCount = count > maxCount ? `${maxCount}+` : String(count);

  return (
    <Animated.View
      entering={FadeIn.duration(200)}
      exiting={FadeOut.duration(200)}
      className="absolute -top-1 -right-1 bg-red-500 rounded-full min-w-[18px] h-[18px] items-center justify-center px-1"
    >
      <Text className="text-white text-xs font-bold">
        {displayCount}
      </Text>
    </Animated.View>
  );
}
```

### 탭바 알림 아이콘

```typescript
// src/components/navigation/TabBarIcon.tsx
import React from 'react';
import { View } from 'react-native';
import { BellIcon } from '@heroicons/react/24/outline';
import { NotificationBadge } from '@/components/ui/NotificationBadge';
import { useNotificationStore } from '@/stores/notificationStore';

interface TabBarIconProps {
  focused: boolean;
  color: string;
  size: number;
}

export function NotificationTabBarIcon({ focused, color, size }: TabBarIconProps) {
  const { unreadCount } = useNotificationStore();

  return (
    <View>
      <BellIcon
        width={size}
        height={size}
        color={color}
        strokeWidth={focused ? 2 : 1.5}
      />
      <NotificationBadge count={unreadCount} />
    </View>
  );
}
```

---

## 요약

### 알림 체크리스트

- [x] FCM 푸시 알림 설정
- [x] 인앱 알림 (포그라운드)
- [x] 알림 타입별 템플릿
- [x] 딥링크 연동
- [x] 실시간 알림 구독
- [x] 알림 설정 화면
- [x] 알림 목록 UI
- [x] 뱃지 카운트

### 트리거 포인트 요약

| 이벤트 | 수신자 | 알림 타입 |
|--------|--------|-----------|
| 지원 생성 | 구인자 | NEW_APPLICATION |
| 확정 | 스태프 | APPLICATION_CONFIRMED |
| 거절 | 스태프 | APPLICATION_REJECTED |
| 확정 취소 | 스태프 | CONFIRMATION_CANCELLED |
| D-1 / 30분 전 | 스태프 | CHECKIN_REMINDER |
| 출근 체크인 | 구인자 | STAFF_CHECKED_IN |
| 노쇼 (+30분) | 구인자 | NO_SHOW_ALERT |
| 퇴근 체크아웃 | 구인자 | STAFF_CHECKED_OUT |
| 시간 변경 (관리자) | 스태프 | SCHEDULE_CHANGE |
| 정산 완료 | 스태프 | SETTLEMENT_COMPLETED |
| 새 공고 | 관심지역 스태프 | NEW_JOB_IN_AREA |
| 공고 마감 임박 | 지원자 | JOB_CLOSING_SOON |
| 문의 답변 | 문의자 | INQUIRY_ANSWERED |
