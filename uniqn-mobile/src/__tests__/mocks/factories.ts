/**
 * UNIQN Mobile - Mock Data Factories
 *
 * @description Centralized mock data factories for testing
 * @version 1.0.0
 */

import type { UserRole } from '@/types';

// ============================================================================
// Types
// ============================================================================

export interface MockUser {
  uid: string;
  email: string;
  displayName: string;
  phoneNumber: string;
  emailVerified: boolean;
  photoURL: string | null;
}

export interface MockStaff {
  id: string;
  userId: string;
  name: string;
  role: UserRole;
  email: string;
  phone: string;
  profileImage: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MockJobPosting {
  id: string;
  title: string;
  description: string;
  location: string;
  address: string;
  salary: number;
  date: string;
  startTime: string;
  endTime: string;
  status: 'draft' | 'active' | 'closed' | 'cancelled';
  applicantCount: number;
  maxApplicants: number;
  employerId: string;
  createdAt: string;
  updatedAt: string;
}

export interface MockApplication {
  id: string;
  jobPostingId: string;
  applicantId: string;
  status: 'pending' | 'accepted' | 'rejected' | 'withdrawn';
  message: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MockWorkLog {
  id: string;
  staffId: string;
  jobPostingId: string;
  checkInTime: string | null;
  checkOutTime: string | null;
  status: 'scheduled' | 'checked_in' | 'checked_out' | 'completed' | 'no_show';
  notes: string | null;
  createdAt: string;
}

export interface MockNotification {
  id: string;
  userId: string;
  type: 'application' | 'schedule' | 'payment' | 'system';
  title: string;
  body: string;
  isRead: boolean;
  data: Record<string, unknown> | null;
  createdAt: string;
}

// ============================================================================
// Counters for unique IDs
// ============================================================================

let userCounter = 0;
let staffCounter = 0;
let jobCounter = 0;
let applicationCounter = 0;
let workLogCounter = 0;
let notificationCounter = 0;
let qrCodeCounter = 0;
let scheduleCounter = 0;

export function resetCounters(): void {
  userCounter = 0;
  staffCounter = 0;
  jobCounter = 0;
  applicationCounter = 0;
  workLogCounter = 0;
  notificationCounter = 0;
  qrCodeCounter = 0;
  scheduleCounter = 0;
}

// ============================================================================
// Factory Functions
// ============================================================================

export function createMockUser(overrides: Partial<MockUser> = {}): MockUser {
  userCounter++;
  return {
    uid: `user-${userCounter}`,
    email: `user${userCounter}@example.com`,
    displayName: `테스트 유저 ${userCounter}`,
    phoneNumber: `+8210${String(10000000 + userCounter).slice(-8)}`,
    emailVerified: true,
    photoURL: null,
    ...overrides,
  };
}

export function createMockStaff(overrides: Partial<MockStaff> = {}): MockStaff {
  staffCounter++;
  const now = new Date().toISOString();
  return {
    id: `staff-${staffCounter}`,
    userId: `user-${staffCounter}`,
    name: `스태프 ${staffCounter}`,
    role: 'staff',
    email: `staff${staffCounter}@example.com`,
    phone: `010-${String(1000 + staffCounter).slice(-4)}-${String(5000 + staffCounter).slice(-4)}`,
    profileImage: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

export function createMockJobPosting(
  overrides: Partial<MockJobPosting> = {}
): MockJobPosting {
  jobCounter++;
  const now = new Date().toISOString();
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  return {
    id: `job-${jobCounter}`,
    title: `테스트 구인공고 ${jobCounter}`,
    description: `이것은 테스트 구인공고 ${jobCounter}의 상세 설명입니다.`,
    location: '서울 강남구',
    address: '서울시 강남구 테헤란로 123',
    salary: 150000 + jobCounter * 10000,
    date: tomorrow.toISOString().split('T')[0],
    startTime: '18:00',
    endTime: '02:00',
    status: 'active',
    applicantCount: 0,
    maxApplicants: 10,
    employerId: 'employer-1',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

export function createMockApplication(
  overrides: Partial<MockApplication> = {}
): MockApplication {
  applicationCounter++;
  const now = new Date().toISOString();

  return {
    id: `application-${applicationCounter}`,
    jobPostingId: `job-${applicationCounter}`,
    applicantId: `staff-${applicationCounter}`,
    status: 'pending',
    message: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

export function createMockWorkLog(
  overrides: Partial<MockWorkLog> = {}
): MockWorkLog {
  workLogCounter++;
  const now = new Date().toISOString();

  return {
    id: `worklog-${workLogCounter}`,
    staffId: `staff-${workLogCounter}`,
    jobPostingId: `job-${workLogCounter}`,
    checkInTime: null,
    checkOutTime: null,
    status: 'scheduled',
    notes: null,
    createdAt: now,
    ...overrides,
  };
}

export function createMockNotification(
  overrides: Partial<MockNotification> = {}
): MockNotification {
  notificationCounter++;
  const now = new Date().toISOString();

  return {
    id: `notification-${notificationCounter}`,
    userId: `user-${notificationCounter}`,
    type: 'system',
    title: `알림 제목 ${notificationCounter}`,
    body: `알림 내용 ${notificationCounter}`,
    isRead: false,
    data: null,
    createdAt: now,
    ...overrides,
  };
}

// ============================================================================
// Batch Factory Functions
// ============================================================================

export function createMockUsers(count: number): MockUser[] {
  return Array.from({ length: count }, () => createMockUser());
}

export function createMockStaffList(count: number): MockStaff[] {
  return Array.from({ length: count }, () => createMockStaff());
}

export function createMockJobPostings(count: number): MockJobPosting[] {
  return Array.from({ length: count }, () => createMockJobPosting());
}

export function createMockApplications(count: number): MockApplication[] {
  return Array.from({ length: count }, () => createMockApplication());
}

export function createMockWorkLogs(count: number): MockWorkLog[] {
  return Array.from({ length: count }, () => createMockWorkLog());
}

export function createMockNotifications(count: number): MockNotification[] {
  return Array.from({ length: count }, () => createMockNotification());
}

// ============================================================================
// Specialized Factories
// ============================================================================

export function createMockAdmin(): MockStaff {
  return createMockStaff({
    role: 'admin',
    name: '관리자',
    email: 'admin@example.com',
  });
}

export function createMockEmployer(): MockStaff {
  return createMockStaff({
    role: 'employer',
    name: '구인자',
    email: 'employer@example.com',
  });
}

export function createMockStaffUser(): MockStaff {
  return createMockStaff({
    role: 'staff',
    name: '스태프',
    email: 'staff@example.com',
  });
}

export function createActiveJobPosting(): MockJobPosting {
  return createMockJobPosting({ status: 'active' });
}

export function createClosedJobPosting(): MockJobPosting {
  return createMockJobPosting({ status: 'closed' });
}

export function createAcceptedApplication(): MockApplication {
  return createMockApplication({ status: 'accepted' });
}

export function createRejectedApplication(): MockApplication {
  return createMockApplication({ status: 'rejected' });
}

export function createCheckedInWorkLog(): MockWorkLog {
  return createMockWorkLog({
    status: 'checked_in',
    checkInTime: new Date().toISOString(),
  });
}

export function createCompletedWorkLog(): MockWorkLog {
  const checkIn = new Date();
  const checkOut = new Date(checkIn.getTime() + 8 * 60 * 60 * 1000); // 8 hours later

  return createMockWorkLog({
    status: 'completed',
    checkInTime: checkIn.toISOString(),
    checkOutTime: checkOut.toISOString(),
  });
}

export function createUnreadNotification(): MockNotification {
  return createMockNotification({ isRead: false });
}

export function createReadNotification(): MockNotification {
  return createMockNotification({ isRead: true });
}

// ============================================================================
// QR Code Factories
// ============================================================================

export interface MockQRCodeData {
  id: string;
  eventId: string;
  staffId: string;
  action: 'checkIn' | 'checkOut';
  createdAt: { toMillis: () => number; toDate: () => Date };
  expiresAt: { toMillis: () => number; toDate: () => Date };
  isUsed: boolean;
  usedAt?: { toMillis: () => number; toDate: () => Date };
}

export function createMockQRCodeData(
  overrides: Partial<Omit<MockQRCodeData, 'createdAt' | 'expiresAt' | 'usedAt'>> & {
    createdAt?: Date;
    expiresAt?: Date;
    usedAt?: Date;
  } = {}
): MockQRCodeData {
  qrCodeCounter++;
  const now = new Date();
  const defaultExpiresAt = new Date(now.getTime() + 5 * 60 * 1000); // 5분 후

  const createTimestamp = (date: Date) => ({
    toMillis: () => date.getTime(),
    toDate: () => date,
  });

  // Extract non-timestamp overrides
  const { createdAt, expiresAt, usedAt, ...restOverrides } = overrides;

  return {
    id: `qr_${Date.now().toString(36)}_${qrCodeCounter}`,
    eventId: `event-${qrCodeCounter}`,
    staffId: `staff-${qrCodeCounter}`,
    action: 'checkIn',
    isUsed: false,
    ...restOverrides,
    createdAt: createTimestamp(createdAt ?? now),
    expiresAt: createTimestamp(expiresAt ?? defaultExpiresAt),
    ...(usedAt && { usedAt: createTimestamp(usedAt) }),
  };
}

export function createExpiredQRCode(): MockQRCodeData {
  const expired = new Date(Date.now() - 10 * 60 * 1000); // 10분 전 (이미 만료)
  return createMockQRCodeData({
    createdAt: new Date(expired.getTime() - 5 * 60 * 1000),
    expiresAt: expired,
  });
}

export function createUsedQRCode(): MockQRCodeData {
  return createMockQRCodeData({
    isUsed: true,
    usedAt: new Date(),
  });
}

export function createCheckInQRCode(): MockQRCodeData {
  return createMockQRCodeData({ action: 'checkIn' });
}

export function createCheckOutQRCode(): MockQRCodeData {
  return createMockQRCodeData({ action: 'checkOut' });
}

export interface MockScheduleEvent {
  id: string;
  type: 'applied' | 'confirmed' | 'completed' | 'cancelled';
  date: string;
  startTime: { toMillis: () => number; toDate: () => Date } | null;
  endTime: { toMillis: () => number; toDate: () => Date } | null;
  eventId: string;
  eventName: string;
  location: string;
  role: string;
  status: 'not_started' | 'checked_in' | 'checked_out';
  sourceCollection: 'workLogs' | 'applications';
  sourceId: string;
  workLogId?: string;
  applicationId?: string;
}

export function createMockScheduleEvent(
  overrides: Partial<Omit<MockScheduleEvent, 'startTime' | 'endTime'>> & {
    startTime?: Date | null;
    endTime?: Date | null;
  } = {}
): MockScheduleEvent {
  scheduleCounter++;
  const createTimestamp = (date: Date) => ({
    toMillis: () => date.getTime(),
    toDate: () => date,
  });

  const defaultStartTime = new Date();
  defaultStartTime.setHours(18, 0, 0, 0);
  const defaultEndTime = new Date();
  defaultEndTime.setHours(23, 0, 0, 0);

  // Extract non-timestamp overrides
  const { startTime, endTime, ...restOverrides } = overrides;

  return {
    id: `schedule-${scheduleCounter}`,
    type: 'confirmed',
    date: new Date().toISOString().split('T')[0],
    eventId: `event-${scheduleCounter}`,
    eventName: `테스트 이벤트 ${scheduleCounter}`,
    location: '서울 강남구',
    role: '딜러',
    status: 'not_started',
    sourceCollection: 'workLogs',
    sourceId: `worklog-${scheduleCounter}`,
    workLogId: `worklog-${scheduleCounter}`,
    ...restOverrides,
    startTime: startTime === null ? null : createTimestamp(startTime ?? defaultStartTime),
    endTime: endTime === null ? null : createTimestamp(endTime ?? defaultEndTime),
  };
}

export function createTodaySchedule(): MockScheduleEvent {
  return createMockScheduleEvent({
    date: new Date().toISOString().split('T')[0],
  });
}

export function createUpcomingSchedule(): MockScheduleEvent {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return createMockScheduleEvent({
    date: tomorrow.toISOString().split('T')[0],
  });
}

export function createCheckedInSchedule(): MockScheduleEvent {
  return createMockScheduleEvent({
    status: 'checked_in',
  });
}

export function createCompletedSchedule(): MockScheduleEvent {
  return createMockScheduleEvent({
    type: 'completed',
    status: 'checked_out',
  });
}
