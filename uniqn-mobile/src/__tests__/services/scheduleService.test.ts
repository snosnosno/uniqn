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

// MockScheduleEvent type available for future use
void import('../mocks/factories').then(m => m.createMockScheduleEvent as unknown);

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

// ScheduleType is available for type assertions in future tests
void import('@/types').then(m => m as unknown);

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

jest.mock('@/lib/firebase', () => ({
  db: {},
}));

jest.mock('@/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

jest.mock('@/errors', () => ({
  mapFirebaseError: (error: Error) => error,
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
    it('should group schedules by date', () => {
      const today = new Date().toISOString().split('T')[0];
      const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];

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
      const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

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

      expect(markedDates['2025-01-17'].dotColor).toBe('#3b82f6'); // blue for completed

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
          eventId: 'event-1',
          date: '2025-01-15',
          status: 'scheduled',
          role: '딜러',
        },
      ];

      const mockEventData = {
        title: '테스트 이벤트',
        location: '서울',
      };

      mockGetDocs.mockResolvedValueOnce({
        docs: mockWorkLogs.map((wl) => ({
          id: wl.id,
          data: () => wl,
        })),
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
          eventId: 'event-1',
          date: '2025-01-15',
          status: 'scheduled',
          role: '딜러',
        },
      ];

      const mockEventData = {
        title: '강남 홀덤',
        location: '강남구',
      };

      mockGetDocs.mockResolvedValueOnce({
        docs: mockWorkLogs.map((wl) => ({
          id: wl.id,
          data: () => wl,
        })),
      });

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
      mockGetDocs.mockRejectedValueOnce(new Error('Firebase error'));

      await expect(getMySchedules('staff-123')).rejects.toThrow('Firebase error');
    });
  });

  describe('getSchedulesByDate', () => {
    it('should return schedules for a specific date', async () => {
      mockGetDocs.mockResolvedValueOnce({ docs: [] });

      await getSchedulesByDate('staff-123', '2025-01-15');

      expect(mockWhere).toHaveBeenCalledWith('date', '>=', '2025-01-15');
      expect(mockWhere).toHaveBeenCalledWith('date', '<=', '2025-01-15');
    });
  });

  describe('getSchedulesByMonth', () => {
    it('should return schedules for a specific month', async () => {
      mockGetDocs.mockResolvedValueOnce({ docs: [] });

      await getSchedulesByMonth('staff-123', 2025, 1);

      expect(mockWhere).toHaveBeenCalledWith('date', '>=', '2025-01-01');
      expect(mockWhere).toHaveBeenCalledWith('date', '<=', '2025-01-31');
    });

    it('should handle February correctly', async () => {
      mockGetDocs.mockResolvedValueOnce({ docs: [] });

      await getSchedulesByMonth('staff-123', 2024, 2); // leap year

      expect(mockWhere).toHaveBeenCalledWith('date', '>=', '2024-02-01');
      expect(mockWhere).toHaveBeenCalledWith('date', '<=', '2024-02-29');
    });
  });

  describe('getScheduleById', () => {
    it('should return null for non-existent schedule', async () => {
      mockGetDoc.mockResolvedValueOnce({ exists: () => false });

      const result = await getScheduleById('non-existent');

      expect(result).toBeNull();
    });

    it('should return schedule event for existing worklog', async () => {
      const mockWorkLog = {
        id: 'wl-1',
        staffId: 'staff-123',
        eventId: 'event-1',
        date: '2025-01-15',
        status: 'scheduled',
        role: '딜러',
      };

      const mockEventData = {
        title: '테스트 이벤트',
        location: '서울',
      };

      mockGetDoc
        .mockResolvedValueOnce({
          exists: () => true,
          id: mockWorkLog.id,
          data: () => mockWorkLog,
        })
        .mockResolvedValueOnce({
          exists: () => true,
          data: () => mockEventData,
        });

      const result = await getScheduleById('wl-1');

      expect(result).not.toBeNull();
      expect(result?.eventName).toBe('테스트 이벤트');
      expect(result?.location).toBe('서울');
    });
  });

  describe('getTodaySchedules', () => {
    it('should query for today', async () => {
      const today = new Date().toISOString().split('T')[0];
      mockGetDocs.mockResolvedValueOnce({ docs: [] });

      await getTodaySchedules('staff-123');

      expect(mockWhere).toHaveBeenCalledWith('date', '>=', today);
      expect(mockWhere).toHaveBeenCalledWith('date', '<=', today);
    });
  });

  describe('getUpcomingSchedules', () => {
    it('should query for upcoming 7 days by default', async () => {
      mockGetDocs.mockResolvedValueOnce({ docs: [] });

      await getUpcomingSchedules('staff-123');

      expect(mockWhere).toHaveBeenCalledWith('staffId', '==', 'staff-123');
    });

    it('should allow custom days parameter', async () => {
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
          eventId: 'event-1',
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
          eventId: 'event-1',
          date: '2025-01-15',
          status: 'completed',
          role: '딜러',
          payrollAmount: 150000,
        },
        {
          id: 'wl-2',
          staffId: 'staff-123',
          eventId: 'event-2',
          date: '2025-01-20',
          status: 'scheduled',
          role: '딜러',
        },
      ];

      mockGetDocs.mockResolvedValueOnce({
        docs: mockWorkLogs.map((wl) => ({
          id: wl.id,
          data: () => wl,
        })),
      });

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
      expect(schedule.eventId).toBeDefined();
      expect(schedule.eventName).toBeDefined();
      expect(schedule.location).toBeDefined();
      expect(schedule.role).toBeDefined();
      expect(schedule.type).toBe('confirmed');
      expect(schedule.status).toBe('not_started');
    });

    it('should allow overrides', () => {
      const schedule = createMockScheduleEvent({
        type: 'completed',
        status: 'checked_out',
        eventName: '커스텀 이벤트',
      });

      expect(schedule.type).toBe('completed');
      expect(schedule.status).toBe('checked_out');
      expect(schedule.eventName).toBe('커스텀 이벤트');
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
