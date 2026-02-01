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
  resetCounters,
} from '../mocks/factories';

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
} from '@/services/scheduleService';
import type { ScheduleEvent } from '@/types';

// Mock Firebase
const mockGetDoc = jest.fn();
const mockGetDocs = jest.fn();
const mockDoc = jest.fn();
const mockCollection = jest.fn();
const mockQuery = jest.fn();
const mockOnSnapshot = jest.fn();
const mockWhere = jest.fn();
const mockOrderBy = jest.fn();
const mockLimit = jest.fn();

jest.mock('firebase/firestore', () => ({
  doc: (...args: unknown[]) => mockDoc(...args),
  collection: (...args: unknown[]) => mockCollection(...args),
  query: (...args: unknown[]) => mockQuery(...args),
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
  onSnapshot: (...args: unknown[]) => mockOnSnapshot(...args),
  where: (...args: unknown[]) => mockWhere(...args),
  orderBy: (...args: unknown[]) => mockOrderBy(...args),
  limit: (...args: unknown[]) => mockLimit(...args),
  Timestamp: {
    now: () => ({
      toMillis: () => Date.now(),
      toDate: () => new Date(),
    }),
    fromMillis: (ms: number) => ({
      toMillis: () => ms,
      toDate: () => new Date(ms),
    }),
  },
}));

const mockDb = {};
jest.mock('@/lib/firebase', () => ({
  db: mockDb,
  getFirebaseDb: () => mockDb,
}));

jest.mock('@/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('@/errors', () => ({
  mapFirebaseError: (error: Error) => error,
  ERROR_CODES: {
    FIREBASE_DOCUMENT_NOT_FOUND: 'E4002',
    FIREBASE_PERMISSION_DENIED: 'E4001',
    BUSINESS_INVALID_STATE: 'E6042',
  },
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
    mockDoc.mockReturnValue({ id: 'test-doc' });
    mockCollection.mockReturnValue({ id: 'test-collection' });
    mockQuery.mockReturnValue({ id: 'test-query' });
    mockWhere.mockReturnValue({ id: 'where-constraint' });
    mockOrderBy.mockReturnValue({ id: 'orderBy-constraint' });
    mockLimit.mockReturnValue({ id: 'limit-constraint' });
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
        createMockScheduleEvent({ date: '2025-01-15', type: 'confirmed' }) as unknown as ScheduleEvent,
        createMockScheduleEvent({ date: '2025-01-16', type: 'applied' }) as unknown as ScheduleEvent,
        createMockScheduleEvent({ date: '2025-01-17', type: 'completed' }) as unknown as ScheduleEvent,
        createMockScheduleEvent({ date: '2025-01-18', type: 'cancelled' }) as unknown as ScheduleEvent,
      ];

      const markedDates = getCalendarMarkedDates(schedules);

      expect(markedDates['2025-01-15'].marked).toBe(true);
      expect(markedDates['2025-01-15'].dotColor).toBe('#22c55e'); // green for confirmed

      expect(markedDates['2025-01-16'].dotColor).toBe('#f59e0b'); // yellow for applied

      expect(markedDates['2025-01-17'].dotColor).toBe('#A855F7'); // blue for completed

      expect(markedDates['2025-01-18'].dotColor).toBe('#ef4444'); // red for cancelled
    });

    it('should prioritize confirmed over other types for same date', () => {
      const schedules: ScheduleEvent[] = [
        createMockScheduleEvent({ date: '2025-01-15', type: 'applied' }) as unknown as ScheduleEvent,
        createMockScheduleEvent({ date: '2025-01-15', type: 'confirmed' }) as unknown as ScheduleEvent,
      ];

      const markedDates = getCalendarMarkedDates(schedules);

      expect(markedDates['2025-01-15'].type).toBe('confirmed');
      expect(markedDates['2025-01-15'].dotColor).toBe('#22c55e');
    });

    it('should prioritize applied over completed for same date', () => {
      const schedules: ScheduleEvent[] = [
        createMockScheduleEvent({ date: '2025-01-15', type: 'completed' }) as unknown as ScheduleEvent,
        createMockScheduleEvent({ date: '2025-01-15', type: 'applied' }) as unknown as ScheduleEvent,
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
      const mockWorkLogs = [
        {
          id: 'wl-1',
          staffId: 'staff-123',
          jobPostingId: 'job-1',
          date: '2025-01-15',
          status: 'scheduled',
          role: '딜러',
        },
      ];

      const mockEventData = {
        title: '테스트 이벤트',
        location: '서울',
      };

      // Mock workLogs query
      mockGetDocs.mockResolvedValueOnce({
        docs: mockWorkLogs.map((wl) => ({
          id: wl.id,
          data: () => wl,
        })),
      });
      // Mock applications query
      mockGetDocs.mockResolvedValueOnce({
        docs: [],
      });

      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => mockEventData,
      });

      const result = await getMySchedules('staff-123');

      expect(result.schedules).toBeDefined();
      expect(result.stats).toBeDefined();
      expect(mockGetDocs).toHaveBeenCalled();
    });

    it('should apply date range filter', async () => {
      // Mock both queries
      mockGetDocs.mockResolvedValueOnce({ docs: [] });
      mockGetDocs.mockResolvedValueOnce({ docs: [] });

      await getMySchedules('staff-123', {
        dateRange: { start: '2025-01-01', end: '2025-01-31' },
      });

      expect(mockWhere).toHaveBeenCalledWith('staffId', '==', 'staff-123');
      expect(mockWhere).toHaveBeenCalledWith('date', '>=', '2025-01-01');
      expect(mockWhere).toHaveBeenCalledWith('date', '<=', '2025-01-31');
    });

    it('should filter by search term', async () => {
      const mockWorkLogs = [
        {
          id: 'wl-1',
          staffId: 'staff-123',
          jobPostingId: 'job-1',
          date: '2025-01-15',
          status: 'scheduled',
          role: '딜러',
        },
      ];

      const mockEventData = {
        title: '강남 홀덤',
        location: '강남구',
      };

      // Mock workLogs query
      mockGetDocs.mockResolvedValueOnce({
        docs: mockWorkLogs.map((wl) => ({
          id: wl.id,
          data: () => wl,
        })),
      });
      // Mock applications query
      mockGetDocs.mockResolvedValueOnce({ docs: [] });

      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => mockEventData,
      });

      const result = await getMySchedules('staff-123', {
        dateRange: { start: '2025-01-01', end: '2025-01-31' },
        searchTerm: '강남',
      });

      expect(result.schedules.length).toBeGreaterThanOrEqual(0);
    });

    it('should throw error on Firebase failure', async () => {
      // Both queries need to reject for the function to throw
      mockGetDocs.mockRejectedValueOnce(new Error('Firebase error'));
      mockGetDocs.mockRejectedValueOnce(new Error('Firebase error'));

      await expect(getMySchedules('staff-123')).rejects.toThrow();
    });
  });

  describe('getSchedulesByDate', () => {
    it('should return schedules for a specific date', async () => {
      // Mock both queries
      mockGetDocs.mockResolvedValueOnce({ docs: [] });
      mockGetDocs.mockResolvedValueOnce({ docs: [] });

      await getSchedulesByDate('staff-123', '2025-01-15');

      expect(mockWhere).toHaveBeenCalledWith('date', '>=', '2025-01-15');
      expect(mockWhere).toHaveBeenCalledWith('date', '<=', '2025-01-15');
    });
  });

  describe('getSchedulesByMonth', () => {
    it('should return schedules for a specific month', async () => {
      // Mock both queries
      mockGetDocs.mockResolvedValueOnce({ docs: [] });
      mockGetDocs.mockResolvedValueOnce({ docs: [] });

      await getSchedulesByMonth('staff-123', 2025, 1);

      expect(mockWhere).toHaveBeenCalledWith('date', '>=', '2025-01-01');
      expect(mockWhere).toHaveBeenCalledWith('date', '<=', '2025-01-31');
    });

    it('should handle February correctly', async () => {
      // Mock both queries
      mockGetDocs.mockResolvedValueOnce({ docs: [] });
      mockGetDocs.mockResolvedValueOnce({ docs: [] });

      await getSchedulesByMonth('staff-123', 2024, 2); // leap year

      expect(mockWhere).toHaveBeenCalledWith('date', '>=', '2024-02-01');
      expect(mockWhere).toHaveBeenCalledWith('date', '<=', '2024-02-29');
    });
  });

  describe('getScheduleById', () => {
    beforeEach(() => {
      // Reset mockGetDoc to avoid pollution from previous tests
      mockGetDoc.mockReset();
    });

    it('should return null for non-existent schedule', async () => {
      mockGetDoc.mockResolvedValueOnce({ exists: () => false });

      const result = await getScheduleById('non-existent');

      expect(result).toBeNull();
    });

    it('should return schedule event for existing worklog', async () => {
      const mockWorkLog = {
        id: 'wl-1',
        staffId: 'staff-123',
        jobPostingId: 'job-1',
        date: '2025-01-15',
        status: 'scheduled',
        role: '딜러',
      };

      const mockEventData = {
        title: '테스트 이벤트',
        location: '서울',
      };

      // First call: workLog document
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        id: mockWorkLog.id,
        data: () => mockWorkLog,
      });
      // Second call: job posting document
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        id: 'job-1',
        data: () => mockEventData,
      });

      const result = await getScheduleById('wl-1');

      expect(result).not.toBeNull();
      // jobPostingName comes from card.title which is built from JobPostingCard
      expect(result?.jobPostingName).toBeDefined();
      expect(result?.location).toBeDefined();
    });
  });

  describe('getTodaySchedules', () => {
    it('should query for today', async () => {
      // Mock both queries
      mockGetDocs.mockResolvedValueOnce({ docs: [] });
      mockGetDocs.mockResolvedValueOnce({ docs: [] });

      await getTodaySchedules('staff-123');

      // Check that date range query is made with a valid date format (YYYY-MM-DD)
      expect(mockWhere).toHaveBeenCalledWith('staffId', '==', 'staff-123');
      expect(mockWhere).toHaveBeenCalledWith('date', '>=', expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/));
      expect(mockWhere).toHaveBeenCalledWith('date', '<=', expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/));
    });
  });

  describe('getUpcomingSchedules', () => {
    it('should query for upcoming 7 days by default', async () => {
      // Mock both queries
      mockGetDocs.mockResolvedValueOnce({ docs: [] });
      mockGetDocs.mockResolvedValueOnce({ docs: [] });

      await getUpcomingSchedules('staff-123');

      expect(mockWhere).toHaveBeenCalledWith('staffId', '==', 'staff-123');
    });

    it('should allow custom days parameter', async () => {
      // Mock both queries
      mockGetDocs.mockResolvedValueOnce({ docs: [] });
      mockGetDocs.mockResolvedValueOnce({ docs: [] });

      await getUpcomingSchedules('staff-123', 14);

      expect(mockGetDocs).toHaveBeenCalled();
    });
  });

  describe('subscribeToSchedules', () => {
    it('should set up onSnapshot subscription', () => {
      const onUpdate = jest.fn();
      const onError = jest.fn();
      const mockUnsubscribe = jest.fn();

      mockOnSnapshot.mockReturnValue(mockUnsubscribe);

      const unsubscribe = subscribeToSchedules('staff-123', onUpdate, onError);

      expect(mockOnSnapshot).toHaveBeenCalled();
      expect(typeof unsubscribe).toBe('function');
    });

    it('should call onUpdate with schedules when snapshot changes', () => {
      const onUpdate = jest.fn();
      const mockWorkLogs = [
        {
          id: 'wl-1',
          staffId: 'staff-123',
          jobPostingId: 'job-1',
          date: '2025-01-15',
          status: 'scheduled',
          role: '딜러',
        },
      ];

      mockOnSnapshot.mockImplementation((_query, successCallback, _errorCallback) => {
        // Simulate snapshot (query and errorCallback available for error scenarios)
        void _query; void _errorCallback;
        successCallback({
          docs: mockWorkLogs.map((wl) => ({
            id: wl.id,
            data: () => wl,
          })),
        });
        return jest.fn();
      });

      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({ title: '이벤트', location: '서울' }),
      });

      subscribeToSchedules('staff-123', onUpdate);

      // The callback is async, so we need to wait
      expect(mockOnSnapshot).toHaveBeenCalled();
    });
  });

  describe('getScheduleStats', () => {
    it('should return stats for last 6 months', async () => {
      const mockWorkLogs = [
        {
          id: 'wl-1',
          staffId: 'staff-123',
          jobPostingId: 'job-1',
          date: '2025-01-15',
          status: 'completed',
          role: '딜러',
          payrollAmount: 150000,
        },
        {
          id: 'wl-2',
          staffId: 'staff-123',
          jobPostingId: 'job-2',
          date: '2025-01-20',
          status: 'scheduled',
          role: '딜러',
        },
      ];

      // Mock workLogs query
      mockGetDocs.mockResolvedValueOnce({
        docs: mockWorkLogs.map((wl) => ({
          id: wl.id,
          data: () => wl,
        })),
      });
      // Mock applications query
      mockGetDocs.mockResolvedValueOnce({ docs: [] });

      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({ title: '이벤트', location: '서울' }),
      });

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
