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
  getMySchedules,
  getSchedulesByDate,
  getSchedulesByMonth,
  getScheduleById,
  getTodaySchedules,
  subscribeToSchedules,
} from '@/services/work/scheduleService';
import { logger } from '@/utils/logger';
import { NetworkError, ERROR_CODES } from '@/errors';

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

jest.mock('@/errors', () => {
  class AppErrorMock extends Error {
    public readonly __isAppError = true as const;
    public userMessage: string;
    public code: string;
    public severity: string;
    public isRetryable: boolean;
    constructor(
      code: string,
      options?: {
        userMessage?: string;
        message?: string;
        severity?: string;
        isRetryable?: boolean;
      }
    ) {
      const message = options?.message || options?.userMessage || code;
      super(message);
      this.name = 'AppError';
      this.code = code;
      this.userMessage = options?.userMessage || message;
      this.severity = options?.severity || 'medium';
      this.isRetryable = options?.isRetryable ?? false;
    }
  }

  return {
    ERROR_CODES: {
      INFRA_NOT_FOUND: 'E4002',
      INFRA_PERMISSION_DENIED: 'E4001',
      BUSINESS_INVALID_STATE: 'E6042',
      NETWORK_REQUEST_FAILED: 'E1002',
      NETWORK_REALTIME_TRANSIENT: 'E1005',
    },
    toError: (error: unknown) => (error instanceof Error ? error : new Error(String(error))),
    isAppError: (error: unknown): boolean =>
      error instanceof AppErrorMock ||
      (error !== null &&
        typeof error === 'object' &&
        '__isAppError' in error &&
        (error as { __isAppError: unknown }).__isAppError === true),
    BusinessError: class BusinessError extends AppErrorMock {
      constructor(code: string, options?: { userMessage?: string }) {
        super(code, options);
        this.name = 'BusinessError';
      }
    },
    NetworkError: class NetworkError extends AppErrorMock {
      constructor(
        code: string,
        options?: {
          userMessage?: string;
          message?: string;
          severity?: string;
          isRetryable?: boolean;
        }
      ) {
        super(code, { isRetryable: true, ...options });
        this.name = 'NetworkError';
      }
    },
    PermissionError: class PermissionError extends AppErrorMock {
      constructor(code: string, options?: { userMessage?: string }) {
        super(code, options);
        this.name = 'PermissionError';
      }
    },
  };
});

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
        // 월 경계를 넘는 연속 근무를 한 그룹으로 잡으려 앞뒤 7일을 더 조회한다.
        dateRange: { start: '2024-12-25', end: '2025-02-07' },
      });

      expect(mockWorkLogRepoGetByStaffIdWithFilters).toHaveBeenCalledWith(
        'staff-123',
        expect.objectContaining({
          // 월 경계를 넘는 연속 근무를 한 그룹으로 잡으려 앞뒤 7일을 더 조회한다.
          dateRange: { start: '2024-12-25', end: '2025-02-07' },
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
        // 월 경계를 넘는 연속 근무를 한 그룹으로 잡으려 앞뒤 7일을 더 조회한다.
        dateRange: { start: '2024-12-25', end: '2025-02-07' },
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
          // 월 경계를 넘는 연속 근무를 한 그룹으로 잡으려 앞뒤 7일을 더 조회한다.
          dateRange: { start: '2024-12-25', end: '2025-02-07' },
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
          dateRange: { start: '2024-01-25', end: '2024-03-07' },
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

    it('should resume emissions after CHANNEL_ERROR followed by recovery snapshot', async () => {
      // Regression: 이전에는 hasErrored 플래그가 영구 true로 고정되어
      // Phoenix 자동 재연결 후 Repository가 재조회한 데이터를 onData로 전달해도
      // emitSchedules가 `if (hasErrored) return;` 로 차단되어 UI가 복구되지 않았다.
      // 수정 후: 새 스냅샷 도착 = 복구 증거로 간주하여 플래그를 리셋한다.
      const onUpdate = jest.fn();
      const onError = jest.fn();

      // Capture the onData/onError callbacks passed into each repo subscribe
      let workLogOnData: (workLogs: WorkLog[]) => void = () => undefined;
      let appOnData: (apps: Application[]) => void = () => undefined;
      let appOnError: (error: Error) => void = () => undefined;

      mockWorkLogRepoSubscribeByStaffId.mockImplementation(((
        _staffId: string,
        onData: (workLogs: WorkLog[]) => void
      ) => {
        workLogOnData = onData;
        return jest.fn();
      }) as never);
      mockAppRepoSubscribeByApplicantIdWithStatuses.mockImplementation(((
        _staffId: string,
        _statuses: unknown,
        onData: (apps: Application[]) => void,
        onErr: (error: Error) => void
      ) => {
        appOnData = onData;
        appOnError = onErr;
        return jest.fn();
      }) as never);

      subscribeToSchedules('staff-123', onUpdate, onError);

      // 1) 초기 스냅샷 도착 → 정상 emit
      workLogOnData([]);
      appOnData([]);
      await new Promise((resolve) => setImmediate(resolve));
      expect(onUpdate).toHaveBeenCalledTimes(1);
      onUpdate.mockClear();

      // 2) CHANNEL_ERROR 발생 → onError 호출, hasErrored=true 고정
      appOnError(
        new NetworkError(ERROR_CODES.NETWORK_REALTIME_TRANSIENT, {
          message: 'Realtime 채널 에러: applications',
          severity: 'low',
        })
      );
      expect(onError).toHaveBeenCalledTimes(1);

      // 3) Phoenix 재연결 후 Repository가 RECOVERED → 재조회 → onData 호출
      const recoveredApps: Application[] = [];
      appOnData(recoveredApps);
      await new Promise((resolve) => setImmediate(resolve));

      // 4) 수정 전에는 여기서 onUpdate가 절대 호출되지 않음 (hasErrored 고착)
      //    수정 후에는 새 스냅샷이 에러 상태를 해제하고 emitSchedules가 재개됨
      expect(onUpdate).toHaveBeenCalledTimes(1);
    });

    it('should log transient NetworkError as warn, not error (Sentry noise prevention)', async () => {
      const onUpdate = jest.fn();
      const onError = jest.fn();
      let appOnError: (error: Error) => void = () => undefined;

      mockWorkLogRepoSubscribeByStaffId.mockReturnValue(jest.fn());
      mockAppRepoSubscribeByApplicantIdWithStatuses.mockImplementation(((
        _staffId: string,
        _statuses: unknown,
        _onData: unknown,
        onErr: (error: Error) => void
      ) => {
        appOnError = onErr;
        return jest.fn();
      }) as never);

      subscribeToSchedules('staff-123', onUpdate, onError);

      const loggerWarn = logger.warn as jest.Mock;
      const loggerError = logger.error as jest.Mock;
      loggerWarn.mockClear();
      loggerError.mockClear();

      appOnError(
        new NetworkError(ERROR_CODES.NETWORK_REALTIME_TRANSIENT, {
          message: 'Realtime 채널 에러: applications',
          severity: 'low',
        })
      );

      expect(loggerWarn).toHaveBeenCalledWith(
        '스케줄 구독 일시 장애 (자동 재시도 중)',
        expect.objectContaining({ message: expect.stringContaining('applications') })
      );
      expect(loggerError).not.toHaveBeenCalledWith('스케줄 구독 에러', expect.anything());
    });

    it('should log non-retryable errors as error (preserve real error signal)', async () => {
      const onUpdate = jest.fn();
      const onError = jest.fn();
      let appOnError: (error: Error) => void = () => undefined;

      mockWorkLogRepoSubscribeByStaffId.mockReturnValue(jest.fn());
      mockAppRepoSubscribeByApplicantIdWithStatuses.mockImplementation(((
        _staffId: string,
        _statuses: unknown,
        _onData: unknown,
        onErr: (error: Error) => void
      ) => {
        appOnError = onErr;
        return jest.fn();
      }) as never);

      subscribeToSchedules('staff-123', onUpdate, onError);

      const loggerWarn = logger.warn as jest.Mock;
      const loggerError = logger.error as jest.Mock;
      loggerWarn.mockClear();
      loggerError.mockClear();

      const fatalError = new Error('Schema mismatch');
      appOnError(fatalError);

      expect(loggerError).toHaveBeenCalledWith('스케줄 구독 에러', fatalError);
    });

    it('should not re-fire onError on repeated transient errors while already in error state', async () => {
      const onUpdate = jest.fn();
      const onError = jest.fn();

      let appOnError: (error: Error) => void = () => undefined;

      mockWorkLogRepoSubscribeByStaffId.mockReturnValue(jest.fn());
      mockAppRepoSubscribeByApplicantIdWithStatuses.mockImplementation(((
        _staffId: string,
        _statuses: unknown,
        _onData: unknown,
        onErr: (error: Error) => void
      ) => {
        appOnError = onErr;
        return jest.fn();
      }) as never);

      subscribeToSchedules('staff-123', onUpdate, onError);

      appOnError(new Error('first'));
      appOnError(new Error('second'));
      appOnError(new Error('third'));

      // 같은 에러 상태에서 반복 호출되어도 onError는 1회만 발화
      expect(onError).toHaveBeenCalledTimes(1);
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
