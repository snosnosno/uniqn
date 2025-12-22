/**
 * UNIQN Functions - 타입 정의
 */

// ============================================================================
// 알림 타입
// ============================================================================

export type NotificationType =
  // 지원 관련
  | 'new_application'
  | 'application_confirmed'
  | 'confirmation_cancelled'
  | 'application_rejected'
  // 출퇴근
  | 'staff_checked_in'
  | 'staff_checked_out'
  | 'checkin_reminder'
  | 'no_show_alert'
  | 'schedule_change'
  | 'work_time_changed'
  // 정산
  | 'settlement_completed'
  // 공고
  | 'new_job_in_area'
  | 'job_closing_soon'
  // 시스템
  | 'system_notice'
  | 'account_deleted';

export type NotificationCategory =
  | 'application'
  | 'schedule'
  | 'settlement'
  | 'job'
  | 'system';

export interface NotificationData {
  id?: string;
  userId: string;
  type: NotificationType;
  category: NotificationCategory;
  title: string;
  body: string;
  data?: Record<string, string>;
  link?: string;
  isRead: boolean;
  createdAt: admin.firestore.FieldValue | admin.firestore.Timestamp;
}

// ============================================================================
// FCM 메시지 타입
// ============================================================================

export interface FCMMessage {
  token: string;
  notification: {
    title: string;
    body: string;
  };
  data?: Record<string, string>;
  android?: {
    notification: {
      channelId: string;
      priority: 'high' | 'normal';
    };
  };
  apns?: {
    payload: {
      aps: {
        sound: string;
        badge?: number;
      };
    };
  };
}

// ============================================================================
// Firestore 문서 타입
// ============================================================================

export interface ApplicationDoc {
  id: string;
  jobPostingId: string;
  applicantId: string;
  applicantName: string;
  status: 'pending' | 'confirmed' | 'rejected' | 'waitlisted' | 'cancelled';
  createdAt: admin.firestore.Timestamp;
  updatedAt: admin.firestore.Timestamp;
}

export interface JobPostingDoc {
  id: string;
  title: string;
  employerId: string;
  location: string;
  eventDate: admin.firestore.Timestamp;
  startTime: string;
  status: 'draft' | 'open' | 'closed' | 'cancelled';
}

export interface WorkLogDoc {
  id: string;
  staffId: string;
  staffName: string;
  jobPostingId: string;
  scheduleId: string;
  checkInTime?: admin.firestore.Timestamp;
  checkOutTime?: admin.firestore.Timestamp;
  actualMinutes?: number;
  settlementStatus: 'pending' | 'calculated' | 'settled';
  settlementAmount?: number;
  modificationHistory?: Array<{
    modifiedAt: admin.firestore.Timestamp;
    modifiedBy: string;
    reason?: string;
    previousCheckIn?: admin.firestore.Timestamp;
    previousCheckOut?: admin.firestore.Timestamp;
  }>;
}

export interface ScheduleDoc {
  id: string;
  staffId: string;
  jobPostingId: string;
  date: admin.firestore.Timestamp;
  startTime: string;
  endTime: string;
  status: 'scheduled' | 'checked_in' | 'completed' | 'no_show';
}

export interface UserDoc {
  id: string;
  email: string;
  name: string;
  role: 'staff' | 'employer' | 'admin';
  fcmTokens?: string[];
  notificationSettings?: {
    enabled: boolean;
    application: boolean;
    schedule: boolean;
    settlement: boolean;
    marketing: boolean;
    quietHoursStart?: string;
    quietHoursEnd?: string;
  };
}

import * as admin from 'firebase-admin';
