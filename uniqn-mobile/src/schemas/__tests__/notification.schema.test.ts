/**
 * UNIQN Mobile - Notification Schema Tests
 *
 * @description notification.schema.ts Zod validation tests
 */

import {
  notificationTypeSchema,
  notificationCategorySchema,
  notificationPrioritySchema,
  createNotificationSchema,
  notificationFilterSchema,
  categoryNotificationSettingSchema,
  updateNotificationSettingsSchema,
  markNotificationReadSchema,
  deleteNotificationsSchema,
  markAllNotificationsReadSchema,
  notificationDocumentSchema,
  notificationSettingsDocumentSchema,
  parseNotificationDocument,
  parseNotificationDocuments,
  isNotificationDocument,
  parseNotificationSettingsDocument,
} from '../notification.schema';

// ============================================================================
// Mock Timestamp (jest.setup.js MockTimestamp)
// ============================================================================

const createMockTimestamp = (seconds = 1700000000, nanoseconds = 0) => ({
  seconds,
  nanoseconds,
  toDate: () => new Date(seconds * 1000),
  toMillis: () => seconds * 1000,
});

// ============================================================================
// notificationTypeSchema
// ============================================================================

describe('notificationTypeSchema', () => {
  const validTypes = [
    'new_application',
    'application_cancelled',
    'application_confirmed',
    'confirmation_cancelled',
    'application_rejected',
    'cancellation_approved',
    'cancellation_rejected',
    'staff_checked_in',
    'staff_checked_out',
    'check_in_confirmed',
    'check_out_confirmed',
    'checkin_reminder',
    'no_show_alert',
    'schedule_change',
    'schedule_created',
    'schedule_cancelled',
    'settlement_completed',
    'settlement_requested',
    'job_updated',
    'job_cancelled',
    'job_closed',
    'announcement',
    'maintenance',
    'app_update',
    'inquiry_answered',
    'report_resolved',
    'new_report',
    'new_inquiry',
    'tournament_approval_request',
  ];

  it.each(validTypes)('should accept valid type: %s', (type) => {
    expect(notificationTypeSchema.safeParse(type).success).toBe(true);
  });

  it('should reject invalid notification type', () => {
    const result = notificationTypeSchema.safeParse('invalid_type');
    expect(result.success).toBe(false);
  });

  it('should reject empty string', () => {
    expect(notificationTypeSchema.safeParse('').success).toBe(false);
  });

  it('should reject number', () => {
    expect(notificationTypeSchema.safeParse(123).success).toBe(false);
  });
});

// ============================================================================
// notificationCategorySchema
// ============================================================================

describe('notificationCategorySchema', () => {
  const validCategories = ['application', 'attendance', 'settlement', 'job', 'system', 'admin'];

  it.each(validCategories)('should accept valid category: %s', (cat) => {
    expect(notificationCategorySchema.safeParse(cat).success).toBe(true);
  });

  it('should reject invalid category', () => {
    expect(notificationCategorySchema.safeParse('unknown').success).toBe(false);
  });
});

// ============================================================================
// notificationPrioritySchema
// ============================================================================

describe('notificationPrioritySchema', () => {
  it.each(['low', 'normal', 'high', 'urgent'])('should accept priority: %s', (p) => {
    expect(notificationPrioritySchema.safeParse(p).success).toBe(true);
  });

  it('should reject invalid priority', () => {
    expect(notificationPrioritySchema.safeParse('critical').success).toBe(false);
  });
});

// ============================================================================
// createNotificationSchema
// ============================================================================

describe('createNotificationSchema', () => {
  const validData = {
    recipientId: 'user-123',
    type: 'new_application' as const,
    title: '새로운 지원',
    body: '새로운 지원자가 있습니다.',
  };

  it('should accept valid notification data', () => {
    const result = createNotificationSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it('should accept with optional fields', () => {
    const result = createNotificationSchema.safeParse({
      ...validData,
      link: '/jobs/123',
      data: { jobId: 'job-123' },
      priority: 'high',
    });
    expect(result.success).toBe(true);
  });

  it('should reject empty recipientId', () => {
    const result = createNotificationSchema.safeParse({
      ...validData,
      recipientId: '',
    });
    expect(result.success).toBe(false);
  });

  it('should reject empty title', () => {
    const result = createNotificationSchema.safeParse({
      ...validData,
      title: '',
    });
    expect(result.success).toBe(false);
  });

  it('should reject title over 100 characters', () => {
    const result = createNotificationSchema.safeParse({
      ...validData,
      title: 'x'.repeat(101),
    });
    expect(result.success).toBe(false);
  });

  it('should reject empty body', () => {
    const result = createNotificationSchema.safeParse({
      ...validData,
      body: '',
    });
    expect(result.success).toBe(false);
  });

  it('should reject body over 500 characters', () => {
    const result = createNotificationSchema.safeParse({
      ...validData,
      body: 'x'.repeat(501),
    });
    expect(result.success).toBe(false);
  });

  it('should reject invalid type', () => {
    const result = createNotificationSchema.safeParse({
      ...validData,
      type: 'invalid',
    });
    expect(result.success).toBe(false);
  });

  it('should reject missing required fields', () => {
    const result = createNotificationSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('should reject invalid priority', () => {
    const result = createNotificationSchema.safeParse({
      ...validData,
      priority: 'extreme',
    });
    expect(result.success).toBe(false);
  });
});

// ============================================================================
// notificationFilterSchema
// ============================================================================

describe('notificationFilterSchema', () => {
  it('should accept empty object (all optional)', () => {
    const result = notificationFilterSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('should accept valid filter with isRead', () => {
    const result = notificationFilterSchema.safeParse({ isRead: false });
    expect(result.success).toBe(true);
  });

  it('should accept valid filter with category', () => {
    const result = notificationFilterSchema.safeParse({ category: 'application' });
    expect(result.success).toBe(true);
  });

  it('should accept valid filter with types', () => {
    const result = notificationFilterSchema.safeParse({
      types: ['new_application', 'application_confirmed'],
    });
    expect(result.success).toBe(true);
  });

  it('should accept valid filter with date range', () => {
    const result = notificationFilterSchema.safeParse({
      startDate: '2025-01-01T00:00:00Z',
      endDate: '2025-12-31T23:59:59Z',
    });
    expect(result.success).toBe(true);
  });

  it('should reject invalid category', () => {
    const result = notificationFilterSchema.safeParse({ category: 'invalid' });
    expect(result.success).toBe(false);
  });

  it('should reject invalid types in array', () => {
    const result = notificationFilterSchema.safeParse({ types: ['bad_type'] });
    expect(result.success).toBe(false);
  });

  it('should reject non-datetime strings for startDate', () => {
    const result = notificationFilterSchema.safeParse({ startDate: 'not-a-date' });
    expect(result.success).toBe(false);
  });
});

// ============================================================================
// categoryNotificationSettingSchema
// ============================================================================

describe('categoryNotificationSettingSchema', () => {
  it('should accept valid setting', () => {
    const result = categoryNotificationSettingSchema.safeParse({
      enabled: true,
      pushEnabled: false,
    });
    expect(result.success).toBe(true);
  });

  it('should reject missing enabled', () => {
    const result = categoryNotificationSettingSchema.safeParse({
      pushEnabled: true,
    });
    expect(result.success).toBe(false);
  });

  it('should reject missing pushEnabled', () => {
    const result = categoryNotificationSettingSchema.safeParse({
      enabled: true,
    });
    expect(result.success).toBe(false);
  });

  it('should reject non-boolean values', () => {
    const result = categoryNotificationSettingSchema.safeParse({
      enabled: 'yes',
      pushEnabled: 1,
    });
    expect(result.success).toBe(false);
  });
});

// ============================================================================
// updateNotificationSettingsSchema
// ============================================================================

describe('updateNotificationSettingsSchema', () => {
  it('should accept empty object (all optional)', () => {
    const result = updateNotificationSettingsSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('should accept valid enabled toggle', () => {
    const result = updateNotificationSettingsSchema.safeParse({
      enabled: true,
      pushEnabled: false,
    });
    expect(result.success).toBe(true);
  });

  it('should accept valid categories', () => {
    const result = updateNotificationSettingsSchema.safeParse({
      categories: {
        application: { enabled: true, pushEnabled: true },
      },
    });
    expect(result.success).toBe(true);
  });

  it('should accept valid quietHours', () => {
    const result = updateNotificationSettingsSchema.safeParse({
      quietHours: {
        enabled: true,
        start: '22:00',
        end: '08:00',
      },
    });
    expect(result.success).toBe(true);
  });

  it('should reject invalid quietHours time format', () => {
    const result = updateNotificationSettingsSchema.safeParse({
      quietHours: {
        enabled: true,
        start: '10pm',
        end: '8am',
      },
    });
    expect(result.success).toBe(false);
  });

  it('should reject quietHours without enabled field', () => {
    const result = updateNotificationSettingsSchema.safeParse({
      quietHours: {
        start: '22:00',
        end: '08:00',
      },
    });
    expect(result.success).toBe(false);
  });
});

// ============================================================================
// markNotificationReadSchema
// ============================================================================

describe('markNotificationReadSchema', () => {
  it('should accept valid notification IDs', () => {
    const result = markNotificationReadSchema.safeParse({
      notificationIds: ['notif-1', 'notif-2'],
    });
    expect(result.success).toBe(true);
  });

  it('should reject empty array', () => {
    const result = markNotificationReadSchema.safeParse({
      notificationIds: [],
    });
    expect(result.success).toBe(false);
  });

  it('should reject empty string in array', () => {
    const result = markNotificationReadSchema.safeParse({
      notificationIds: [''],
    });
    expect(result.success).toBe(false);
  });

  it('should reject missing field', () => {
    const result = markNotificationReadSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

// ============================================================================
// deleteNotificationsSchema
// ============================================================================

describe('deleteNotificationsSchema', () => {
  it('should accept valid notification IDs', () => {
    const result = deleteNotificationsSchema.safeParse({
      notificationIds: ['notif-1'],
    });
    expect(result.success).toBe(true);
  });

  it('should reject empty array', () => {
    const result = deleteNotificationsSchema.safeParse({
      notificationIds: [],
    });
    expect(result.success).toBe(false);
  });
});

// ============================================================================
// markAllNotificationsReadSchema
// ============================================================================

describe('markAllNotificationsReadSchema', () => {
  it('should accept empty object', () => {
    const result = markAllNotificationsReadSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('should accept with category', () => {
    const result = markAllNotificationsReadSchema.safeParse({
      category: 'application',
    });
    expect(result.success).toBe(true);
  });

  it('should accept with beforeDate', () => {
    const result = markAllNotificationsReadSchema.safeParse({
      beforeDate: '2025-06-01T00:00:00Z',
    });
    expect(result.success).toBe(true);
  });

  it('should reject invalid category', () => {
    const result = markAllNotificationsReadSchema.safeParse({
      category: 'nonexistent',
    });
    expect(result.success).toBe(false);
  });
});

// ============================================================================
// notificationDocumentSchema
// ============================================================================

describe('notificationDocumentSchema', () => {
  const validDoc = {
    id: 'notif-1',
    recipientId: 'user-1',
    type: 'new_application' as const,
    title: '새 지원',
    body: '새로운 지원자가 있습니다.',
    isRead: false,
    createdAt: createMockTimestamp(),
  };

  it('should accept valid notification document', () => {
    const result = notificationDocumentSchema.safeParse(validDoc);
    expect(result.success).toBe(true);
  });

  it('should accept with optional fields', () => {
    const result = notificationDocumentSchema.safeParse({
      ...validDoc,
      category: 'application',
      link: '/jobs/123',
      data: { jobId: 'job-1' },
      priority: 'high',
      readAt: createMockTimestamp(1700001000),
    });
    expect(result.success).toBe(true);
  });

  it('should accept with passthrough (unknown) fields', () => {
    const result = notificationDocumentSchema.safeParse({
      ...validDoc,
      customField: 'extra data',
    });
    expect(result.success).toBe(true);
  });

  it('should accept Date as createdAt', () => {
    const result = notificationDocumentSchema.safeParse({
      ...validDoc,
      createdAt: new Date(),
    });
    expect(result.success).toBe(true);
  });

  it('should accept seconds/nanoseconds object as createdAt', () => {
    const result = notificationDocumentSchema.safeParse({
      ...validDoc,
      createdAt: { seconds: 1700000000, nanoseconds: 0 },
    });
    expect(result.success).toBe(true);
  });

  it('should reject missing id', () => {
    const { id, ...noId } = validDoc;
    const result = notificationDocumentSchema.safeParse(noId);
    expect(result.success).toBe(false);
  });

  it('should reject missing recipientId', () => {
    const { recipientId, ...noRecipient } = validDoc;
    const result = notificationDocumentSchema.safeParse(noRecipient);
    expect(result.success).toBe(false);
  });

  it('should reject invalid type', () => {
    const result = notificationDocumentSchema.safeParse({
      ...validDoc,
      type: 'invalid_type',
    });
    expect(result.success).toBe(false);
  });

  it('should reject non-boolean isRead', () => {
    const result = notificationDocumentSchema.safeParse({
      ...validDoc,
      isRead: 'false',
    });
    expect(result.success).toBe(false);
  });

  it('should reject invalid createdAt', () => {
    const result = notificationDocumentSchema.safeParse({
      ...validDoc,
      createdAt: 'not-a-timestamp',
    });
    expect(result.success).toBe(false);
  });

  it('should accept null readAt', () => {
    const result = notificationDocumentSchema.safeParse({
      ...validDoc,
      readAt: null,
    });
    expect(result.success).toBe(true);
  });
});

// ============================================================================
// parseNotificationDocument
// ============================================================================

describe('parseNotificationDocument', () => {
  const validDoc = {
    id: 'notif-1',
    recipientId: 'user-1',
    type: 'announcement',
    title: '공지',
    body: '시스템 점검 안내',
    isRead: true,
    createdAt: createMockTimestamp(),
  };

  it('should return parsed data for valid document', () => {
    const result = parseNotificationDocument(validDoc);
    expect(result).not.toBeNull();
    expect(result).toHaveProperty('id', 'notif-1');
  });

  it('should return null for invalid document', () => {
    const result = parseNotificationDocument({ invalid: true });
    expect(result).toBeNull();
  });

  it('should return null for null input', () => {
    const result = parseNotificationDocument(null);
    expect(result).toBeNull();
  });
});

// ============================================================================
// parseNotificationDocuments
// ============================================================================

describe('parseNotificationDocuments', () => {
  const validDoc = {
    id: 'notif-1',
    recipientId: 'user-1',
    type: 'announcement',
    title: '공지',
    body: '테스트',
    isRead: false,
    createdAt: createMockTimestamp(),
  };

  it('should parse valid documents and filter invalid ones', () => {
    const results = parseNotificationDocuments([
      validDoc,
      { invalid: true },
      { ...validDoc, id: 'notif-2' },
    ]);
    expect(results).toHaveLength(2);
    expect(results[0]).toHaveProperty('id', 'notif-1');
    expect(results[1]).toHaveProperty('id', 'notif-2');
  });

  it('should return empty array for all invalid', () => {
    const results = parseNotificationDocuments([{ bad: 'data' }, null]);
    expect(results).toHaveLength(0);
  });

  it('should return empty array for empty input', () => {
    const results = parseNotificationDocuments([]);
    expect(results).toHaveLength(0);
  });
});

// ============================================================================
// isNotificationDocument
// ============================================================================

describe('isNotificationDocument', () => {
  const validDoc = {
    id: 'notif-1',
    recipientId: 'user-1',
    type: 'maintenance',
    title: '점검',
    body: '서버 점검',
    isRead: false,
    createdAt: createMockTimestamp(),
  };

  it('should return true for valid document', () => {
    expect(isNotificationDocument(validDoc)).toBe(true);
  });

  it('should return false for invalid document', () => {
    expect(isNotificationDocument({ random: 'data' })).toBe(false);
  });

  it('should return false for null', () => {
    expect(isNotificationDocument(null)).toBe(false);
  });
});

// ============================================================================
// notificationSettingsDocumentSchema
// ============================================================================

describe('notificationSettingsDocumentSchema', () => {
  const validSettings = {
    enabled: true,
    categories: {
      application: { enabled: true, pushEnabled: true },
      attendance: { enabled: true, pushEnabled: false },
      settlement: { enabled: false, pushEnabled: false },
      job: { enabled: true, pushEnabled: true },
      system: { enabled: true, pushEnabled: true },
      admin: { enabled: false, pushEnabled: false },
    },
  };

  it('should accept valid settings', () => {
    const result = notificationSettingsDocumentSchema.safeParse(validSettings);
    expect(result.success).toBe(true);
  });

  it('should accept with optional pushEnabled', () => {
    const result = notificationSettingsDocumentSchema.safeParse({
      ...validSettings,
      pushEnabled: true,
    });
    expect(result.success).toBe(true);
  });

  it('should accept with quietHours', () => {
    const result = notificationSettingsDocumentSchema.safeParse({
      ...validSettings,
      quietHours: { enabled: true, start: '22:00', end: '07:00' },
    });
    expect(result.success).toBe(true);
  });

  it('should accept with updatedAt timestamp', () => {
    const result = notificationSettingsDocumentSchema.safeParse({
      ...validSettings,
      updatedAt: createMockTimestamp(),
    });
    expect(result.success).toBe(true);
  });

  it('should accept with passthrough fields', () => {
    const result = notificationSettingsDocumentSchema.safeParse({
      ...validSettings,
      extraField: 'data',
    });
    expect(result.success).toBe(true);
  });

  it('should reject missing enabled', () => {
    const { enabled, ...noEnabled } = validSettings;
    const result = notificationSettingsDocumentSchema.safeParse(noEnabled);
    expect(result.success).toBe(false);
  });

  it('should reject missing categories', () => {
    const { categories, ...noCategories } = validSettings;
    const result = notificationSettingsDocumentSchema.safeParse(noCategories);
    expect(result.success).toBe(false);
  });

  it('should reject incomplete categories (missing admin)', () => {
    const result = notificationSettingsDocumentSchema.safeParse({
      ...validSettings,
      categories: {
        application: { enabled: true, pushEnabled: true },
        attendance: { enabled: true, pushEnabled: false },
        // missing settlement, job, system, admin
      },
    });
    expect(result.success).toBe(false);
  });
});

// ============================================================================
// parseNotificationSettingsDocument
// ============================================================================

describe('parseNotificationSettingsDocument', () => {
  const validSettings = {
    enabled: true,
    categories: {
      application: { enabled: true, pushEnabled: true },
      attendance: { enabled: true, pushEnabled: true },
      settlement: { enabled: true, pushEnabled: true },
      job: { enabled: true, pushEnabled: true },
      system: { enabled: true, pushEnabled: true },
      admin: { enabled: true, pushEnabled: true },
    },
  };

  it('should return parsed data for valid settings', () => {
    const result = parseNotificationSettingsDocument(validSettings);
    expect(result).not.toBeNull();
    expect(result).toHaveProperty('enabled', true);
  });

  it('should return null for invalid settings', () => {
    const result = parseNotificationSettingsDocument({ bad: 'data' });
    expect(result).toBeNull();
  });

  it('should return null for null input', () => {
    const result = parseNotificationSettingsDocument(null);
    expect(result).toBeNull();
  });
});
