/**
 * Test Data Factory
 *
 * Reusable mock data factories for creating consistent test data.
 * All factories follow TypeScript strict mode and return properly typed objects.
 */

// ========================================
// Type Imports
// ========================================

// Note: Types should be imported from actual source files
// For now, we define minimal interfaces matching the data-model.md specification

interface Notification {
  id: string;
  userId: string;
  type: 'system' | 'work' | 'schedule' | 'finance' | 'application';
  title: string;
  message: string;
  isRead: boolean;
  createdAt: Date;
  data?: Record<string, unknown>;
}

interface WorkLog {
  id: string;
  staffId: string;
  eventId: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  hourlyRate: number;
  isNightShift?: boolean;
  isHoliday?: boolean;
  isOvertime?: boolean;
  totalPay?: number;
  createdAt: Date;
  updatedAt: Date;
}

interface Applicant {
  id: string;
  eventId: string;
  userId?: string;
  name: string;
  phoneNumber: string;
  email?: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  appliedAt: Date;
  processedAt?: Date;
  processedBy?: string;
  notes?: string;
}

// ========================================
// 1. Notification Factories
// ========================================

/**
 * Create mock Notification
 * @param overrides - Partial fields to override
 * @returns Notification object
 */
export const createMockNotification = (overrides?: Partial<Notification>): Notification => ({
  id: `notif-${Date.now()}-${Math.random()}`,
  userId: 'test-user-1',
  type: 'work',
  title: '근무 배정 알림',
  message: '새로운 근무가 배정되었습니다.',
  isRead: false,
  createdAt: new Date('2025-11-06T10:00:00Z'),
  data: {},
  ...overrides,
});

/**
 * Create multiple mock Notifications
 * @param count - Number of notifications to create
 * @param baseOverrides - Common overrides for all notifications
 * @returns Array of Notification objects
 */
export const createMockNotifications = (
  count: number,
  baseOverrides?: Partial<Notification>
): Notification[] => {
  return Array.from({ length: count }, (_, index) =>
    createMockNotification({
      id: `notif-${index}`,
      message: `알림 ${index + 1}`,
      ...baseOverrides,
    })
  );
};

/**
 * Type-specific notification factories
 */
export const notificationFactories = {
  work: (overrides?: Partial<Notification>) =>
    createMockNotification({
      type: 'work',
      title: '근무 관련 알림',
      message: '새로운 근무가 배정되었습니다.',
      ...overrides,
    }),

  schedule: (overrides?: Partial<Notification>) =>
    createMockNotification({
      type: 'schedule',
      title: '일정 변경 알림',
      message: '일정이 변경되었습니다.',
      ...overrides,
    }),

  system: (overrides?: Partial<Notification>) =>
    createMockNotification({
      type: 'system',
      title: '시스템 공지',
      message: '시스템 점검 예정입니다.',
      ...overrides,
    }),

  finance: (overrides?: Partial<Notification>) =>
    createMockNotification({
      type: 'finance',
      title: '급여 관련 알림',
      message: '급여가 정산되었습니다.',
      ...overrides,
    }),

  application: (overrides?: Partial<Notification>) =>
    createMockNotification({
      type: 'application',
      title: '지원서 관련 알림',
      message: '지원서 상태가 변경되었습니다.',
      ...overrides,
    }),
};

// ========================================
// 2. WorkLog Factories
// ========================================

/**
 * Create mock WorkLog
 * @param overrides - Partial fields to override
 * @returns WorkLog object
 */
export const createMockWorkLog = (overrides?: Partial<WorkLog>): WorkLog => ({
  id: `worklog-${Date.now()}-${Math.random()}`,
  staffId: 'staff-1',
  eventId: 'event-1',
  date: '2025-11-06',
  startTime: '10:00',
  endTime: '18:00',
  hourlyRate: 15000,
  isNightShift: false,
  isHoliday: false,
  isOvertime: false,
  createdAt: new Date('2025-11-06T09:00:00Z'),
  updatedAt: new Date('2025-11-06T09:00:00Z'),
  ...overrides,
});

/**
 * Work type-specific factories
 */
export const workLogFactories = {
  /** Regular day shift (10:00-18:00) */
  regular: (overrides?: Partial<WorkLog>) =>
    createMockWorkLog({
      startTime: '10:00',
      endTime: '18:00',
      isNightShift: false,
      isHoliday: false,
      isOvertime: false,
      ...overrides,
    }),

  /** Night shift (22:00-06:00) */
  nightShift: (overrides?: Partial<WorkLog>) =>
    createMockWorkLog({
      startTime: '22:00',
      endTime: '06:00',
      isNightShift: true,
      ...overrides,
    }),

  /** Holiday shift */
  holiday: (overrides?: Partial<WorkLog>) =>
    createMockWorkLog({
      date: '2025-01-01', // New Year's Day
      isHoliday: true,
      ...overrides,
    }),

  /** Overtime shift (12+ hours) */
  overtime: (overrides?: Partial<WorkLog>) =>
    createMockWorkLog({
      startTime: '10:00',
      endTime: '22:00', // 12 hours
      isOvertime: true,
      ...overrides,
    }),

  /** Night + Holiday (maximum allowance) */
  nightHoliday: (overrides?: Partial<WorkLog>) =>
    createMockWorkLog({
      date: '2025-01-01',
      startTime: '22:00',
      endTime: '06:00',
      isNightShift: true,
      isHoliday: true,
      ...overrides,
    }),
};

/**
 * Create weekly work logs (Mon-Fri)
 * @param staffId - Staff ID
 * @param weekStart - Week start date (YYYY-MM-DD, Monday)
 * @returns Array of 5 WorkLog objects
 */
export const createWeeklyWorkLogs = (staffId: string, weekStart: string): WorkLog[] => {
  const addDays = (date: string, days: number): string => {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d.toISOString().split('T')[0] as string;
  };

  return [0, 1, 2, 3, 4].map((dayOffset) =>
    createMockWorkLog({
      staffId,
      date: addDays(weekStart, dayOffset),
      startTime: '10:00',
      endTime: '18:00',
    })
  );
};

// ========================================
// 3. Applicant Factories
// ========================================

/**
 * Create mock Applicant
 * @param overrides - Partial fields to override
 * @returns Applicant object
 */
export const createMockApplicant = (overrides?: Partial<Applicant>): Applicant => ({
  id: `app-${Date.now()}-${Math.random()}`,
  eventId: 'event-1',
  name: '테스트 사용자',
  phoneNumber: '010-1234-5678',
  email: 'test@example.com',
  status: 'pending',
  appliedAt: new Date('2025-11-05T14:00:00Z'),
  ...overrides,
});

/**
 * Status-specific applicant factories
 */
export const applicantFactories = {
  /** Pending applicant */
  pending: (overrides?: Partial<Applicant>) =>
    createMockApplicant({
      status: 'pending',
      ...overrides,
    }),

  /** Approved applicant */
  approved: (overrides?: Partial<Applicant>) =>
    createMockApplicant({
      status: 'approved',
      processedAt: new Date('2025-11-06T10:00:00Z'),
      processedBy: 'admin-1',
      ...overrides,
    }),

  /** Rejected applicant */
  rejected: (overrides?: Partial<Applicant>) =>
    createMockApplicant({
      status: 'rejected',
      processedAt: new Date('2025-11-06T11:00:00Z'),
      processedBy: 'admin-1',
      notes: '경력 부족',
      ...overrides,
    }),

  /** Cancelled applicant */
  cancelled: (overrides?: Partial<Applicant>) =>
    createMockApplicant({
      status: 'cancelled',
      processedAt: new Date('2025-11-06T12:00:00Z'),
      ...overrides,
    }),
};

/**
 * Create bulk applicants for performance testing
 * @param count - Number of applicants to create
 * @param eventId - Event ID for all applicants
 * @returns Array of Applicant objects
 */
export const createBulkApplicants = (count: number, eventId: string): Applicant[] => {
  return Array.from({ length: count }, (_, index) =>
    createMockApplicant({
      id: `app-${index}`,
      eventId,
      name: `지원자 ${index + 1}`,
      phoneNumber: `010-${String(index).padStart(4, '0')}-${String(index).padStart(4, '0')}`,
      email: `applicant${index}@example.com`,
    })
  );
};

// ========================================
// 4. Common Test Data Sets
// ========================================

/**
 * Minimal test data (fast tests)
 */
export const minimalTestData = {
  notifications: [createMockNotification()],
  workLogs: [createMockWorkLog()],
  applicants: [createMockApplicant()],
};

/**
 * Realistic test data (integration tests)
 */
export const realisticTestData = {
  notifications: [
    notificationFactories.work(),
    notificationFactories.schedule(),
    notificationFactories.system({ isRead: true }),
    notificationFactories.finance({ isRead: true }),
    notificationFactories.application(),
  ],
  workLogs: [
    workLogFactories.regular(),
    workLogFactories.nightShift(),
    workLogFactories.holiday(),
    workLogFactories.overtime(),
  ],
  applicants: [
    applicantFactories.pending(),
    applicantFactories.approved(),
    applicantFactories.rejected(),
  ],
};

/**
 * Edge case test data
 */
export const edgeCaseTestData = {
  emptyNotifications: [] as Notification[],
  emptyWorkLogs: [] as WorkLog[],
  emptyApplicants: [] as Applicant[],

  invalidWorkLog: createMockWorkLog({
    startTime: '18:00',
    endTime: '10:00', // Invalid: end before start
  }),

  bulkApplicants: createBulkApplicants(100, 'event-1'),

  veryLongWorkLog: createMockWorkLog({
    startTime: '00:00',
    endTime: '23:59', // Nearly 24 hours
  }),
};
