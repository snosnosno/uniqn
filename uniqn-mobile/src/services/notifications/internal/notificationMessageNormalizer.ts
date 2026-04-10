import { Timestamp } from 'firebase/firestore';
import {
  NotificationType as NotificationTypeEnum,
  NOTIFICATION_TYPE_LABELS,
} from '@/types/notification';
import type { NotificationData, NotificationType } from '@/types/notification';
import type { NotificationPayload } from '../pushNotificationService';

type LocalizedNotificationMessage = Pick<NotificationData, 'title' | 'body'>;

const ENGLISH_NOTIFICATION_TITLES: Partial<Record<NotificationType, readonly string[]>> = {
  [NotificationTypeEnum.APPLICATION_CONFIRMED]: ['Application confirmed'],
  [NotificationTypeEnum.CONFIRMATION_CANCELLED]: ['Confirmation cancelled'],
  [NotificationTypeEnum.APPLICATION_REJECTED]: ['Application rejected'],
  [NotificationTypeEnum.CANCELLATION_APPROVED]: ['Cancellation approved'],
  [NotificationTypeEnum.CANCELLATION_REJECTED]: ['Cancellation rejected'],
  [NotificationTypeEnum.SCHEDULE_CREATED]: ['New schedule confirmed'],
  [NotificationTypeEnum.SCHEDULE_CANCELLED]: ['Schedule cancelled'],
  [NotificationTypeEnum.CHECK_IN_CONFIRMED]: ['Check-in confirmed'],
  [NotificationTypeEnum.CHECK_OUT_CONFIRMED]: ['Check-out confirmed'],
  [NotificationTypeEnum.STAFF_CHECKED_IN]: ['Staff checked in'],
  [NotificationTypeEnum.STAFF_CHECKED_OUT]: ['Staff checked out'],
  [NotificationTypeEnum.REVIEW_REQUEST]: ['Leave a review'],
  [NotificationTypeEnum.SETTLEMENT_COMPLETED]: ['Settlement completed'],
  [NotificationTypeEnum.SCHEDULE_CHANGE]: ['Work time updated'],
  [NotificationTypeEnum.BOARD_COMMENT]: ['New comment'],
  [NotificationTypeEnum.BOARD_REPLY]: ['New reply'],
  [NotificationTypeEnum.BOARD_MENTION]: ['Mention'],
  [NotificationTypeEnum.BOARD_LOCKED]: ['Post locked'],
};

const ENGLISH_NOTIFICATION_BODY_FRAGMENTS: Partial<Record<NotificationType, readonly string[]>> = {
  [NotificationTypeEnum.APPLICATION_CONFIRMED]: ['has been confirmed.'],
  [NotificationTypeEnum.CONFIRMATION_CANCELLED]: ['was cancelled.'],
  [NotificationTypeEnum.APPLICATION_REJECTED]: ['was rejected.'],
  [NotificationTypeEnum.CANCELLATION_APPROVED]: ['cancellation was approved.'],
  [NotificationTypeEnum.CANCELLATION_REJECTED]: ['cancellation was rejected.'],
  [NotificationTypeEnum.SCHEDULE_CREATED]: ['is scheduled for'],
  [NotificationTypeEnum.SCHEDULE_CANCELLED]: ['has been cancelled.'],
  [NotificationTypeEnum.CHECK_IN_CONFIRMED]: ['check-in was recorded'],
  [NotificationTypeEnum.CHECK_OUT_CONFIRMED]: ['check-out was recorded'],
  [NotificationTypeEnum.STAFF_CHECKED_IN]: ['checked in at'],
  [NotificationTypeEnum.STAFF_CHECKED_OUT]: ['checked out at'],
  [NotificationTypeEnum.REVIEW_REQUEST]: ['Please leave a review.', 'Please review'],
  [NotificationTypeEnum.SETTLEMENT_COMPLETED]: ['Settlement for', 'Settlement is complete.'],
  [NotificationTypeEnum.SCHEDULE_CHANGE]: ['was updated:'],
  [NotificationTypeEnum.BOARD_COMMENT]: ['left a comment on'],
  [NotificationTypeEnum.BOARD_REPLY]: ['left a reply on'],
  [NotificationTypeEnum.BOARD_MENTION]: ['mentioned you in'],
  [NotificationTypeEnum.BOARD_LOCKED]: ['has been locked.'],
};

function hasText(value: string | undefined | null): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function getNotificationDataValue(
  data: Record<string, string> | undefined,
  ...keys: string[]
): string {
  for (const key of keys) {
    const value = data?.[key];
    if (hasText(value)) {
      return value.trim();
    }
  }

  return '';
}

function getQuotedLabel(value: string): string {
  return `'${value}'`;
}

function getJobTitle(data: Record<string, string> | undefined): string {
  return getNotificationDataValue(data, 'jobPostingTitle', 'jobTitle', 'title');
}

function getBoardTitle(data: Record<string, string> | undefined): string {
  return getNotificationDataValue(data, 'boardTitle', 'title', 'jobPostingTitle');
}

function getJobReference(data: Record<string, string> | undefined): string {
  const jobTitle = getJobTitle(data);
  return jobTitle ? getQuotedLabel(jobTitle) : '해당 공고';
}

function getWorkReference(data: Record<string, string> | undefined): string {
  const jobTitle = getJobTitle(data);
  return jobTitle ? getQuotedLabel(jobTitle) : '해당';
}

function getDateTimeLabel(data: Record<string, string> | undefined): string {
  const date = getNotificationDataValue(data, 'date', 'workDate');
  const time = getNotificationDataValue(data, 'timeSlot', 'startTime');

  if (date && time) {
    return `${date} (${time})`;
  }

  return date || time;
}

function getTimeLabel(data: Record<string, string> | undefined): string {
  return getNotificationDataValue(data, 'checkTime', 'timeSlot', 'startTime');
}

function getReasonLabel(data: Record<string, string> | undefined): string {
  return getNotificationDataValue(data, 'rejectionReason', 'reason');
}

function getAmountLabel(data: Record<string, string> | undefined): string {
  const rawAmount = getNotificationDataValue(data, 'payrollAmount', 'amount');
  if (!rawAmount) {
    return '';
  }

  const parsedAmount = Number(rawAmount.replaceAll(',', ''));
  return Number.isFinite(parsedAmount) ? parsedAmount.toLocaleString('ko-KR') : rawAmount;
}

function getStaffName(data: Record<string, string> | undefined): string {
  return getNotificationDataValue(data, 'staffName', 'applicantName', 'authorName') || '스태프';
}

function buildLocalizedNotificationMessage(
  type: NotificationType,
  data: Record<string, string> | undefined
): LocalizedNotificationMessage | null {
  const when = getDateTimeLabel(data);
  const reason = getReasonLabel(data);
  const time = getTimeLabel(data);
  const amount = getAmountLabel(data);
  const staffName = getStaffName(data);
  const boardTitle = getBoardTitle(data) || '게시글';

  switch (type) {
    case NotificationTypeEnum.APPLICATION_CONFIRMED:
      return {
        title: '지원 확정',
        body: `${getJobReference(data)} 지원이 확정되었습니다.`,
      };
    case NotificationTypeEnum.CONFIRMATION_CANCELLED:
      return {
        title: '확정 취소',
        body: `${getJobReference(data)} 확정이 취소되었습니다.${reason ? ` 사유: ${reason}` : ''}`,
      };
    case NotificationTypeEnum.APPLICATION_REJECTED:
      return {
        title: '지원 거절',
        body: `${getJobReference(data)} 지원이 거절되었습니다.${reason ? ` 사유: ${reason}` : ''}`,
      };
    case NotificationTypeEnum.CANCELLATION_APPROVED:
      return {
        title: '취소 요청 승인',
        body: `${getJobReference(data)} 취소 요청이 승인되었습니다.`,
      };
    case NotificationTypeEnum.CANCELLATION_REJECTED:
      return {
        title: '취소 요청 거절',
        body: `${getJobReference(data)} 취소 요청이 거절되었습니다.${reason ? ` 사유: ${reason}` : ''}`,
      };
    case NotificationTypeEnum.SCHEDULE_CREATED:
      return {
        title: '새 근무 배정',
        body: when
          ? `${getWorkReference(data)} 근무가 ${when}에 배정되었습니다.`
          : `${getWorkReference(data)} 근무가 배정되었습니다.`,
      };
    case NotificationTypeEnum.SCHEDULE_CANCELLED:
      return {
        title: '근무 취소',
        body: when
          ? `${getWorkReference(data)} ${when} 근무가 취소되었습니다.`
          : `${getWorkReference(data)} 근무가 취소되었습니다.`,
      };
    case NotificationTypeEnum.CHECK_IN_CONFIRMED:
      return {
        title: '출근 확인',
        body: `${getWorkReference(data)} 출근이${time ? ` ${time}에` : ''} 기록되었습니다.`,
      };
    case NotificationTypeEnum.STAFF_CHECKED_IN:
      return {
        title: '출근 알림',
        body: `${staffName}님이${time ? ` ${time}에` : ''} 출근했습니다.`,
      };
    case NotificationTypeEnum.CHECK_OUT_CONFIRMED:
      return {
        title: '퇴근 확인',
        body: `${getWorkReference(data)} 퇴근이${time ? ` ${time}에` : ''} 기록되었습니다.`,
      };
    case NotificationTypeEnum.STAFF_CHECKED_OUT:
      return {
        title: '퇴근 알림',
        body: `${staffName}님이${time ? ` ${time}에` : ''} 퇴근했습니다.`,
      };
    case NotificationTypeEnum.REVIEW_REQUEST:
      return {
        title: '평가 요청',
        body: data?.staffName
          ? `${getWorkReference(data)} 근무가 완료되었습니다. ${staffName}님에 대한 평가를 남겨주세요.`
          : `${getWorkReference(data)} 근무가 완료되었습니다. 평가를 남겨주세요.`,
      };
    case NotificationTypeEnum.SETTLEMENT_COMPLETED:
      return {
        title: '정산 완료',
        body: amount
          ? `${getJobReference(data)} 정산이 완료되었습니다. 지급액: ${amount}원`
          : `${getJobReference(data)} 정산이 완료되었습니다.`,
      };
    case NotificationTypeEnum.SCHEDULE_CHANGE: {
      const start = getNotificationDataValue(data, 'checkInTime');
      const end = getNotificationDataValue(data, 'checkOutTime');
      const latestTime = start && end ? `${start} - ${end}` : start || end || when;

      return {
        title: '근무 시간 변경',
        body: `${getWorkReference(data)} 근무 시간이 변경되었습니다.${
          latestTime ? ` 현재 시간: ${latestTime}` : ''
        }`,
      };
    }
    case NotificationTypeEnum.BOARD_COMMENT:
      return {
        title: '새 댓글',
        body: `${staffName}님이 '${boardTitle}'에 댓글을 남겼습니다.`,
      };
    case NotificationTypeEnum.BOARD_REPLY:
      return {
        title: '새 답글',
        body: `${staffName}님이 '${boardTitle}'에 답글을 남겼습니다.`,
      };
    case NotificationTypeEnum.BOARD_MENTION:
      return {
        title: '멘션',
        body: `${staffName}님이 '${boardTitle}'에서 회원님을 멘션했습니다.`,
      };
    case NotificationTypeEnum.BOARD_LOCKED:
      return {
        title: '게시글 잠금',
        body: `'${boardTitle}' 글이 잠겼습니다.`,
      };
    default:
      return null;
  }
}

function shouldNormalizeNotification(
  notification: Pick<NotificationData, 'type' | 'title' | 'body'>
): boolean {
  if (!hasText(notification.title) || !hasText(notification.body)) {
    return true;
  }

  const englishTitles = ENGLISH_NOTIFICATION_TITLES[notification.type] ?? [];
  if (englishTitles.includes(notification.title.trim())) {
    return true;
  }

  const englishFragments = ENGLISH_NOTIFICATION_BODY_FRAGMENTS[notification.type] ?? [];
  return englishFragments.some((fragment) => notification.body.includes(fragment));
}

export function normalizeNotification(notification: NotificationData): NotificationData {
  if (!shouldNormalizeNotification(notification)) {
    return notification;
  }

  const localized = buildLocalizedNotificationMessage(notification.type, notification.data);
  if (!localized) {
    return notification;
  }

  return {
    ...notification,
    title: localized.title || notification.title || NOTIFICATION_TYPE_LABELS[notification.type],
    body: localized.body || notification.body || '새로운 알림이 있습니다.',
  };
}

export function createNotificationFromFCM(
  payload: NotificationPayload,
  userId: string
): NotificationData | null {
  const notificationId =
    typeof payload.data?.notificationId === 'string' ? payload.data.notificationId : undefined;
  if (!notificationId) {
    return null;
  }

  const rawType = typeof payload.data?.type === 'string' ? payload.data.type : '';
  const link = typeof payload.data?.link === 'string' ? payload.data.link : undefined;
  const validTypes = Object.values(NotificationTypeEnum) as string[];
  const type: NotificationType = validTypes.includes(rawType)
    ? (rawType as NotificationType)
    : NotificationTypeEnum.ANNOUNCEMENT;

  return normalizeNotification({
    id: notificationId,
    recipientId: userId,
    type,
    title: payload.title || '',
    body: payload.body || '',
    link,
    data: payload.data as Record<string, string> | undefined,
    isRead: false,
    createdAt: Timestamp.now(),
  });
}
