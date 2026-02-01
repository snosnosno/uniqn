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

/** 급여 정보 */
export interface MockSalaryInfo {
  type: 'hourly' | 'daily' | 'monthly' | 'other';
  amount: number;
}

/** 역할 + 급여 정보 */
export interface MockRoleWithSalary {
  role: string;
  customRole?: string;
  count: number;
  filled?: number;
  salary?: MockSalaryInfo;
}

export interface MockJobPosting {
  id: string;
  title: string;
  description: string;
  location: string;
  address: string;
  /** 기본 급여 (v2.0 - useSameSalary=true일 때 사용) */
  defaultSalary?: MockSalaryInfo;
  /** 역할 목록 (급여 포함) */
  roles?: MockRoleWithSalary[];
  date: string;
  startTime: string;
  endTime: string;
  status: 'active' | 'closed' | 'cancelled';
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
  status:
    | 'pending'
    | 'accepted'
    | 'rejected'
    | 'withdrawn'
    | 'applied'
    | 'confirmed'
    | 'cancelled'
    | 'completed'
    | 'cancellation_pending';
  message: string | null;
  /** v3.0 필수 필드 - 지원 일정 정보 */
  assignments: { roleIds: string[]; dates: string[]; timeSlot?: string }[];
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
let scheduleCounter = 0;

export function resetCounters(): void {
  userCounter = 0;
  staffCounter = 0;
  jobCounter = 0;
  applicationCounter = 0;
  workLogCounter = 0;
  notificationCounter = 0;
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

export function createMockJobPosting(overrides: Partial<MockJobPosting> = {}): MockJobPosting {
  jobCounter++;
  const now = new Date().toISOString();
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  const baseSalary = 150000 + jobCounter * 10000;

  return {
    id: `job-${jobCounter}`,
    title: `테스트 구인공고 ${jobCounter}`,
    description: `이것은 테스트 구인공고 ${jobCounter}의 상세 설명입니다.`,
    location: '서울 강남구',
    address: '서울시 강남구 테헤란로 123',
    defaultSalary: { type: 'daily', amount: baseSalary },
    roles: [
      { role: 'dealer', count: 2, filled: 0, salary: { type: 'daily', amount: baseSalary } },
      { role: 'floor', count: 1, filled: 0, salary: { type: 'daily', amount: baseSalary - 20000 } },
    ],
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

export function createMockApplication(overrides: Partial<MockApplication> = {}): MockApplication {
  applicationCounter++;
  const now = new Date().toISOString();

  // v3.0 기본 assignment (레거시 appliedRole/appliedDate/appliedTimeSlot 대체)
  const defaultAssignments = [
    {
      roleIds: ['dealer'],
      dates: ['2025-01-20'],
      timeSlot: '18:00~02:00',
    },
  ];

  return {
    id: `application-${applicationCounter}`,
    jobPostingId: `job-${applicationCounter}`,
    applicantId: `staff-${applicationCounter}`,
    status: 'applied',
    message: null,
    assignments: defaultAssignments,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

export function createMockWorkLog(overrides: Partial<MockWorkLog> = {}): MockWorkLog {
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
export interface MockScheduleEvent {
  id: string;
  type: 'applied' | 'confirmed' | 'completed' | 'cancelled';
  date: string;
  startTime: { toMillis: () => number; toDate: () => Date } | null;
  endTime: { toMillis: () => number; toDate: () => Date } | null;
  // 공고 정보
  jobPostingId: string;
  jobPostingName: string;
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

  const jobPostingId = `event-${scheduleCounter}`;
  const jobPostingName = `테스트 이벤트 ${scheduleCounter}`;

  return {
    id: `schedule-${scheduleCounter}`,
    type: 'confirmed',
    date: new Date().toISOString().split('T')[0],
    // 공고 정보
    jobPostingId,
    jobPostingName,
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
