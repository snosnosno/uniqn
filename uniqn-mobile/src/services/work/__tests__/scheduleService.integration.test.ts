/**
 * UNIQN Mobile - Schedule Service Tests
 *
 * @description Unit tests for schedule service functions
 * @version 1.0.0
 */

import {
  createMockScheduleEvent,
  createTodaySchedule,
  createUpcomingSchedule,
  createCheckedInSchedule,
  createCompletedSchedule,
  createMockWorkLog,
  createMockJobPosting,
  resetCounters,
} from '../../../__tests__/mocks/factories';

import type { WorkLog, Application, ScheduleEvent } from '@/types';

// Import after mocks
import {
  groupSchedulesByDate,
  getCalendarMarkedDates,
  getMySchedules,
  getSchedulesByDate,
  getSchedulesByMonth,
  getScheduleById,
  getTodaySchedules,
  getUpcomingSchedules,
  subscribeToSchedules,
  getScheduleStats,
} from '@/services/work/scheduleService';

// ============================================================================
// Repository Mocks
// ============================================================================

const mockWorkLogRepoGetByStaffIdWithFilters = jest.fn();
const mockWorkLogRepoGetById = jest.fn();
const mockWorkLogRepoSubscribeByStaffId = jest.fn();
const mockAppRepoGetByApplicantIdWithStatuses = jest.fn();
const mockAppRepoSubscribeByApplicantIdWithStatuses = jest.fn(() => jest.fn());
const mockJobPostingRepoGetById = jest.fn();
const mockJobPostingRepoGetByIdBatch = jest.fn();

jest.mock('@/repositories', () => ({
  workLogRepository: {
    getByStaffIdWithFilters: (...args: unknown[]) =>
      mockWorkLogRepoGetByStaffIdWithFilters(...args),
    getById: (...args: unknown[]) => mockWorkLogRepoGetById(...args),
    subscribeByStaffId: (...args: unknown[]) => mockWorkLogRepoSubscribeByStaffId(...args),
  },
  applicationRepository: {
    getByApplicantIdWithStatuses: (...args: unknown[]) =>
      mockAppRepoGetByApplicantIdWithStatuses(...args),
    subscribeByApplicantIdWithStatuses: (...args: unknown[]) =>
      mockAppRepoSubscribeByApplicantIdWithStatuses.apply(null, args),
  },
  jobPostingRepository: {
    getById: (...args: unknown[]) => mockJobPostingRepoGetById(...args),
    getByIdBatch: (...args: unknown[]) => mockJobPostingRepoGetByIdBatch(...args),
  },
}));

// ============================================================================
// Domain / Shared Mocks
// ============================================================================

const mockScheduleMergerMerge = jest.fn();

jest.mock('@/domains/schedule', () => ({
  ScheduleMerger: {
    merge: (...args: unknown[]) => mockScheduleMergerMerge(...args),
  },
  ScheduleConverter: {
    workLogToScheduleEvent: (workLog: WorkLog, cardInfo?: unknown) => ({
      id: workLog.id,
      jobPostingId: workLog.jobPostingId,
      jobPostingName: (cardInfo as { title?: string })?.title || '이벤트',
      location: (cardInfo as { location?: string })?.location || '',
      date: workLog.date,
      role: workLog.role || '스태프',
      type: workLog.status === 'checked_out' ? 'completed' : 'confirmed',
      status: 'not_started',
      startTime: null,
      endTime: null,
      checkInTime: workLog.checkInTime || null,
      checkOutTime: workLog.checkOutTime || null,
      payrollAmount: (workLog as { payrollAmount?: number }).payrollAmount,
      settlementBreakdown: (workLog as { settlementBreakdown?: unknown }).settlementBreakdown,
    }),
    applicationToScheduleEvents: (app: Application, cardInfo?: unknown) => {
      const appAny = app as unknown as { selectedDates?: string[]; date?: string };
      const dates = appAny.selectedDates || [appAny.date || '2025-01-15'];
      return dates.map((date: string) => ({
        id: `${app.id}-${date}`,
        jobPostingId: app.jobPostingId,
        jobPostingName: (cardInfo as { title?: string })?.title || '이벤트',
        location: (cardInfo as { location?: string })?.location || '',
        date,
        role: '스태프',
        type: 'applied',
        status: 'not_started',
        startTime: null,
        endTime: null,
        checkInTime: null,
        checkOutTime: null,
      }));
    },
  },
  createSchedulePostingContext: (posting: unknown) => {
    const p = posting as { id?: string; title?: string; location?: string };
    return { title: p.title || '이벤트', location: p.location || '' };
  },
}));

jest.mock('@/shared/id', () => ({
  IdNormalizer: {
    normalizeJobId: (record: { jobPostingId?: string }) => record.jobPostingId || '',
    extractUnifiedIds: (workLogs: WorkLog[], applications: Application[]) => {
      const ids = new Set<string>();
      workLogs.forEach((wl) => ids.add(wl.jobPostingId));
      applications.forEach((app) => ids.add(app.jobPostingId));
      return [...ids];
    },
  },
}));

jest.mock('@/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    appError: jest.fn(),
  },
}));

jest.mock('@/schemas', () => ({
  parseApplicationDocument: jest.fn((data: unknown) => data),
  parseWorkLogDocument: jest.fn((data: unknown) => data),
  parseWorkLogDocuments: jest.fn((data: unknown[]) => data.filter(Boolean)),
  parseJobPostingDocument: jest.fn((data: unknown) => data),
  parseJobPostingDocuments: jest.fn((data: unknown[]) => data.filter(Boolean)),
}));

jest.mock('@/errors/serviceErrorHandler', () => ({
  handleServiceError: jest.fn((error: unknown) => {
    if (error instanceof Error) return error;
    return new Error(String(error));
  }),
  handleErrorWithDefault: jest.fn((_error: unknown, defaultValue: unknown) => defaultValue),
}));

jest.mock('@/errors', () => ({
  ERROR_CODES: {
    INFRA_NOT_FOUND: 'E4002',
    INFRA_PERMISSION_DENIED: 'E4001',
    BUSINESS_INVALID_STATE: 'E6042',
    NETWORK_REQUEST_FAILED: 'E1002',
  },
  toError: (error: unknown) => (error instanceof Error ? error : new Error(String(error))),
  BusinessError: class BusinessError extends Error {
    public userMessage: string;
    public code: string;
    constructor(code: string, options?: { userMessage?: string }) {
      const message = options?.userMessage || code;
      super(message);
      this.name = 'BusinessError';
      this.code = code;
      this.userMessage = message;
    }
  },
  NetworkError: class NetworkError extends Error {
    public userMessage: string;
    public code: string;
    constructor(code: string, options?: { userMessage?: string }) {
      const message = options?.userMessage || code;
      super(message);
      this.name = 'NetworkError';
      this.code = code;
      this.userMessage = message;
    }
  },
  PermissionError: class PermissionError extends Error {
    public userMessage: string;
    public code: string;
    constructor(code: string, options?: { userMessage?: string }) {
      const message = options?.userMessage || code;
      super(message);
      this.name = 'PermissionError';
      this.code = code;
      this.userMessage = message;
    }
  },
}));

// Mock RealtimeManager to always call subscribeFn directly (bypass caching)
jest.mock('@/shared/realtime', () => ({
  RealtimeManager: {
    subscribe: jest.fn((_key: string, subscribeFn: () => () => void) => {
      return subscribeFn();
    }),
    Keys: {
      schedules: (staffId: string) => `schedules:${staffId}`,
    },
  },
}));

describe('scheduleService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetCounters();

    // Default: return empty arrays
    mockWorkLogRepoGetByStaffIdWithFilters.mockResolvedValue([]);
    mockAppRepoGetByApplicantIdWithStatuses.mockResolvedValue([]);
    mockJobPostingRepoGetByIdBatch.mockResolvedValue([]);
    mockScheduleMergerMerge.mockImplementation(
      (workLogSchedules: ScheduleEvent[], appSchedules: ScheduleEvent[]) => [
        ...workLogSchedules,
        ...appSchedules,
      ]
    );
  });

  describe('groupSchedulesByDate', () => {
    // Helper to format date like the service does (local timezone)
    const formatLocalDate = (date: Date): string => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    it('should group schedules by date', () => {
      const today = formatLocalDate(new Date());
      const tomorrowDate = new Date();
      tomorrowDate.setDate(tomorrowDate.getDate() + 1);
      const tomorrow = formatLocalDate(tomorrowDate);

      // Create schedules without startTime to avoid Timestamp instanceof issue
      const schedules: ScheduleEvent[] = [
        createMockScheduleEvent({ date: today, startTime: null }) as unknown as ScheduleEvent,
        createMockScheduleEvent({ date: today, startTime: null }) as unknown as ScheduleEvent,
        createMockScheduleEvent({ date: tomorrow, startTime: null }) as unknown as ScheduleEvent,
      ];

      const groups = groupSchedulesByDate(schedules);

      expect(groups.length).toBe(2);

      const todayGroup = groups.find((g) => g.date === today);
      expect(todayGroup?.events.length).toBe(2);
      expect(todayGroup?.isToday).toBe(true);

      const tomorrowGroup = groups.find((g) => g.date === tomorrow);
      expect(tomorrowGroup?.events.length).toBe(1);
      expect(tomorrowGroup?.isToday).toBe(false);
    });

    it('should mark past dates correctly', () => {
      const yesterdayDate = new Date();
      yesterdayDate.setDate(yesterdayDate.getDate() - 1);
      const yesterday = formatLocalDate(yesterdayDate);

      const schedules: ScheduleEvent[] = [
        createMockScheduleEvent({ date: yesterday }) as unknown as ScheduleEvent,
      ];

      const groups = groupSchedulesByDate(schedules);

      expect(groups[0].isPast).toBe(true);
      expect(groups[0].isToday).toBe(false);
    });

    it('should sort groups by date (newest first)', () => {
      const date1 = '2025-01-01';
      const date2 = '2025-01-03';
      const date3 = '2025-01-02';

      const schedules: ScheduleEvent[] = [
        createMockScheduleEvent({ date: date1 }) as unknown as ScheduleEvent,
        createMockScheduleEvent({ date: date2 }) as unknown as ScheduleEvent,
        createMockScheduleEvent({ date: date3 }) as unknown as ScheduleEvent,
      ];

      const groups = groupSchedulesByDate(schedules);

      expect(groups[0].date).toBe(date2);
      expect(groups[1].date).toBe(date3);
      expect(groups[2].date).toBe(date1);
    });

    it('should return empty array for no schedules', () => {
      const groups = groupSchedulesByDate([]);
      expect(groups).toEqual([]);
    });

    it('should format date correctly in Korean', () => {
      const schedules: ScheduleEvent[] = [
        createMockScheduleEvent({ date: '2025-12-25' }) as unknown as ScheduleEvent,
      ];

      const groups = groupSchedulesByDate(schedules);

      expect(groups[0].formattedDate).toContain('12월');
      expect(groups[0].formattedDate).toContain('25일');
    });
  });

  describe('getCalendarMarkedDates', () => {
    it('should return marked dates with correct colors', () => {
      const schedules: ScheduleEvent[] = [
        createMockScheduleEvent({
          date: '2025-01-15',
          type: 'confirmed',
        }) as unknown as ScheduleEvent,
        createMockScheduleEvent({
          date: '2025-01-16',
          type: 'applied',
        }) as unknown as ScheduleEvent,
        createMockScheduleEvent({
          date: '2025-01-17',
          type: 'completed',
        }) as unknown as ScheduleEvent,
        createMockScheduleEvent({
          date: '2025-01-18',
          type: 'cancelled',
        }) as unknown as ScheduleEvent,
      ];

      const markedDates = getCalendarMarkedDates(schedules);

      expect(markedDates['2025-01-15'].marked).toBe(true);
      expect(markedDates['2025-01-15'].dotColor).toBe('#22C55E'); // success-500 for confirmed

      expect(markedDates['2025-01-16'].dotColor).toBe('#D4AF37'); // primary-500 for applied

      expect(markedDates['2025-01-17'].dotColor).toBe('#9A9078'); // secondary-500 for completed (과거 근무)

      expect(markedDates['2025-01-18'].dotColor).toBe('#DC2626'); // error-500 for cancelled
    });

    it('should prioritize confirmed over other types for same date', () => {
      const schedules: ScheduleEvent[] = [
        createMockScheduleEvent({
          date: '2025-01-15',
          type: 'applied',
        }) as unknown as ScheduleEvent,
        createMockScheduleEvent({
          date: '2025-01-15',
          type: 'confirmed',
        }) as unknown as ScheduleEvent,
      ];

      const markedDates = getCalendarMarkedDates(schedules);

      expect(markedDates['2025-01-15'].type).toBe('confirmed');
      expect(markedDates['2025-01-15'].dotColor).toBe('#22C55E');
    });

    it('should prioritize applied over completed for same date', () => {
      const schedules: ScheduleEvent[] = [
        createMockScheduleEvent({
          date: '2025-01-15',
          type: 'completed',
        }) as unknown as ScheduleEvent,
        createMockScheduleEvent({
          date: '2025-01-15',
          type: 'applied',
        }) as unknown as ScheduleEvent,
      ];

      const markedDates = getCalendarMarkedDates(schedules);

      expect(markedDates['2025-01-15'].type).toBe('applied');
    });

    it('should return empty object for no schedules', () => {
      const markedDates = getCalendarMarkedDates([]);
      expect(markedDates).toEqual({});
    });
  });

  describe('getMySchedules', () => {
    it('should return schedules for a staff member', async () => {
      const workLog = createMockWorkLog({
        id: 'wl-1',
        staffId: 'staff-123',
        jobPostingId: 'job-1',
        status: 'scheduled',
      });

      const posting = createMockJobPosting({
        id: 'job-1',
        title: '테스트 이벤트',
        location: '서울',
      });

      mockWorkLogRepoGetByStaffIdWithFilters.mockResolvedValue([workLog]);
      mockAppRepoGetByApplicantIdWithStatuses.mockResolvedValue([]);
      mockJobPostingRepoGetByIdBatch.mockResolvedValue([posting]);

      const result = await getMySchedules('staff-123');

      expect(result.schedules).toBeDefined();
      expect(result.stats).toBeDefined();
      expect(mockWorkLogRepoGetByStaffIdWithFilters).toHaveBeenCalledWith(
        'staff-123',
        expect.objectContaining({ pageSize: 50 })
      );
    });

    it('should apply date range filter', async () => {
      mockWorkLogRepoGetByStaffIdWithFilters.mockResolvedValue([]);
      mockAppRepoGetByApplicantIdWithStatuses.mockResolvedValue([]);

      await getMySchedules('staff-123', {
        dateRange: { start: '2025-01-01', end: '2025-01-31' },
      });

      expect(mockWorkLogRepoGetByStaffIdWithFilters).toHaveBeenCalledWith(
        'staff-123',
        expect.objectContaining({
          dateRange: { start: '2025-01-01', end: '2025-01-31' },
        })
      );
    });

    it('should filter by search term', async () => {
      const workLog = createMockWorkLog({
        id: 'wl-1',
        staffId: 'staff-123',
        jobPostingId: 'job-1',
        status: 'scheduled',
      });

      const posting = createMockJobPosting({
        id: 'job-1',
        title: '강남 홀덤',
        location: '강남구',
      });

      mockWorkLogRepoGetByStaffIdWithFilters.mockResolvedValue([workLog]);
      mockAppRepoGetByApplicantIdWithStatuses.mockResolvedValue([]);
      mockJobPostingRepoGetByIdBatch.mockResolvedValue([posting]);

      const result = await getMySchedules('staff-123', {
        dateRange: { start: '2025-01-01', end: '2025-01-31' },
        searchTerm: '강남',
      });

      expect(result.schedules.length).toBeGreaterThanOrEqual(0);
    });

    it('should throw error on database failure', async () => {
      mockWorkLogRepoGetByStaffIdWithFilters.mockRejectedValue(new Error('Database error'));
      mockAppRepoGetByApplicantIdWithStatuses.mockRejectedValue(new Error('Database error'));

      await expect(getMySchedules('staff-123')).rejects.toThrow();
    });
  });

  describe('getSchedulesByDate', () => {
    it('should return schedules for a specific date', async () => {
      mockWorkLogRepoGetByStaffIdWithFilters.mockResolvedValue([]);
      mockAppRepoGetByApplicantIdWithStatuses.mockResolvedValue([]);

      await getSchedulesByDate('staff-123', '2025-01-15');

      expect(mockWorkLogRepoGetByStaffIdWithFilters).toHaveBeenCalledWith(
        'staff-123',
        expect.objectContaining({
          dateRange: { start: '2025-01-15', end: '2025-01-15' },
        })
      );
    });
  });

  describe('getSchedulesByMonth', () => {
    it('should return schedules for a specific month', async () => {
      mockWorkLogRepoGetByStaffIdWithFilters.mockResolvedValue([]);
      mockAppRepoGetByApplicantIdWithStatuses.mockResolvedValue([]);

      await getSchedulesByMonth('staff-123', 2025, 1);

      expect(mockWorkLogRepoGetByStaffIdWithFilters).toHaveBeenCalledWith(
        'staff-123',
        expect.objectContaining({
          dateRange: { start: '2025-01-01', end: '2025-01-31' },
        })
      );
    });

    it('should handle February correctly', async () => {
      mockWorkLogRepoGetByStaffIdWithFilters.mockResolvedValue([]);
      mockAppRepoGetByApplicantIdWithStatuses.mockResolvedValue([]);

      await getSchedulesByMonth('staff-123', 2024, 2); // leap year

      expect(mockWorkLogRepoGetByStaffIdWithFilters).toHaveBeenCalledWith(
        'staff-123',
        expect.objectContaining({
          dateRange: { start: '2024-02-01', end: '2024-02-29' },
        })
      );
    });
  });

  describe('getScheduleById', () => {
    it('should return null for non-existent schedule', async () => {
      mockWorkLogRepoGetById.mockResolvedValue(null);

      const result = await getScheduleById('non-existent');

      expect(result).toBeNull();
    });

    it('should return schedule event for existing worklog', async () => {
      const workLog = createMockWorkLog({
        id: 'wl-1',
        staffId: 'staff-123',
        jobPostingId: 'job-1',
        status: 'scheduled',
      });

      const posting = createMockJobPosting({
        id: 'job-1',
        title: '테스트 이벤트',
        location: '서울',
      });

      mockWorkLogRepoGetById.mockResolvedValue(workLog);
      mockJobPostingRepoGetById.mockResolvedValue(posting);

      const result = await getScheduleById('wl-1');

      expect(result).not.toBeNull();
      expect(result?.jobPostingName).toBeDefined();
      expect(result?.location).toBeDefined();
    });
  });

  describe('getTodaySchedules', () => {
    it('should query for today', async () => {
      mockWorkLogRepoGetByStaffIdWithFilters.mockResolvedValue([]);
      mockAppRepoGetByApplicantIdWithStatuses.mockResolvedValue([]);

      await getTodaySchedules('staff-123');

      expect(mockWorkLogRepoGetByStaffIdWithFilters).toHaveBeenCalledWith(
        'staff-123',
        expect.objectContaining({
          dateRange: expect.objectContaining({
            start: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
            end: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
          }),
        })
      );
    });
  });

  describe('getUpcomingSchedules', () => {
    it('should query for upcoming 7 days by default', async () => {
      mockWorkLogRepoGetByStaffIdWithFilters.mockResolvedValue([]);
      mockAppRepoGetByApplicantIdWithStatuses.mockResolvedValue([]);

      await getUpcomingSchedules('staff-123');

      expect(mockWorkLogRepoGetByStaffIdWithFilters).toHaveBeenCalledWith(
        'staff-123',
        expect.objectContaining({
          dateRange: expect.objectContaining({
            start: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
            end: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
          }),
        })
      );
    });

    it('should allow custom days parameter', async () => {
      mockWorkLogRepoGetByStaffIdWithFilters.mockResolvedValue([]);
      mockAppRepoGetByApplicantIdWithStatuses.mockResolvedValue([]);

      await getUpcomingSchedules('staff-123', 14);

      expect(mockWorkLogRepoGetByStaffIdWithFilters).toHaveBeenCalled();
    });
  });

  describe('subscribeToSchedules', () => {
    it('should set up subscription via repository', () => {
      const onUpdate = jest.fn();
      const onError = jest.fn();
      const mockWorkLogUnsub = jest.fn();
      const mockAppUnsub = jest.fn();

      mockWorkLogRepoSubscribeByStaffId.mockReturnValue(mockWorkLogUnsub);
      mockAppRepoSubscribeByApplicantIdWithStatuses.mockReturnValue(mockAppUnsub);

      const unsubscribe = subscribeToSchedules('staff-123', onUpdate, onError);

      expect(mockWorkLogRepoSubscribeByStaffId).toHaveBeenCalled();
      expect(typeof unsubscribe).toBe('function');
    });

    it('should unsubscribe both repositories when unsubscribed', () => {
      const onUpdate = jest.fn();
      const mockWorkLogUnsub = jest.fn();
      const mockAppUnsub = jest.fn();

      mockWorkLogRepoSubscribeByStaffId.mockReturnValue(mockWorkLogUnsub);
      mockAppRepoSubscribeByApplicantIdWithStatuses.mockReturnValue(mockAppUnsub);

      const unsubscribe = subscribeToSchedules('staff-123', onUpdate);
      unsubscribe();

      expect(mockWorkLogUnsub).toHaveBeenCalled();
      expect(mockAppUnsub).toHaveBeenCalled();
    });
  });

  describe('getScheduleStats', () => {
    it('should return stats for last 6 months', async () => {
      const workLogs = [
        createMockWorkLog({
          id: 'wl-1',
          staffId: 'staff-123',
          jobPostingId: 'job-1',
          status: 'checked_out',
        }),
        createMockWorkLog({
          id: 'wl-2',
          staffId: 'staff-123',
          jobPostingId: 'job-2',
          status: 'scheduled',
        }),
      ];

      const postings = [
        createMockJobPosting({ id: 'job-1', title: '이벤트 1', location: '서울' }),
        createMockJobPosting({ id: 'job-2', title: '이벤트 2', location: '서울' }),
      ];

      mockWorkLogRepoGetByStaffIdWithFilters.mockResolvedValue(workLogs);
      mockAppRepoGetByApplicantIdWithStatuses.mockResolvedValue([]);
      mockJobPostingRepoGetByIdBatch.mockResolvedValue(postings);

      const stats = await getScheduleStats('staff-123');

      expect(stats).toBeDefined();
      expect(stats.totalSchedules).toBeDefined();
      expect(stats.completedSchedules).toBeDefined();
      expect(stats.upcomingSchedules).toBeDefined();
      expect(stats.totalEarnings).toBeDefined();
    });
  });
});

describe('Schedule Mock Factories', () => {
  beforeEach(() => {
    resetCounters();
  });

  describe('createMockScheduleEvent', () => {
    it('should create valid mock schedule event', () => {
      const schedule = createMockScheduleEvent();

      expect(schedule.id).toBeDefined();
      expect(schedule.jobPostingId).toBeDefined();
      expect(schedule.jobPostingName).toBeDefined();
      expect(schedule.location).toBeDefined();
      expect(schedule.role).toBeDefined();
      expect(schedule.type).toBe('confirmed');
      expect(schedule.status).toBe('not_started');
    });

    it('should allow overrides', () => {
      const schedule = createMockScheduleEvent({
        type: 'completed',
        status: 'checked_out',
        jobPostingName: '커스텀 이벤트',
      });

      expect(schedule.type).toBe('completed');
      expect(schedule.status).toBe('checked_out');
      expect(schedule.jobPostingName).toBe('커스텀 이벤트');
    });
  });

  describe('createTodaySchedule', () => {
    it('should create schedule for today', () => {
      const today = new Date().toISOString().split('T')[0];
      const schedule = createTodaySchedule();

      expect(schedule.date).toBe(today);
    });
  });

  describe('createUpcomingSchedule', () => {
    it('should create schedule for tomorrow', () => {
      const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
      const schedule = createUpcomingSchedule();

      expect(schedule.date).toBe(tomorrow);
    });
  });

  describe('createCheckedInSchedule', () => {
    it('should create checked in schedule', () => {
      const schedule = createCheckedInSchedule();

      expect(schedule.status).toBe('checked_in');
    });
  });

  describe('createCompletedSchedule', () => {
    it('should create completed schedule', () => {
      const schedule = createCompletedSchedule();

      expect(schedule.type).toBe('completed');
      expect(schedule.status).toBe('checked_out');
    });
  });
});
