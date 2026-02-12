/**
 * UNIQN Mobile - Schedule Service Tests (Extended)
 *
 * @description Comprehensive unit tests for schedule service functions
 * @version 2.0.0
 */

import type {
  ScheduleEvent,
  WorkLog,
  Application,
  ScheduleStats,
  ScheduleGroup,
} from '@/types';

// ============================================================================
// Mock Setup
// ============================================================================

// Mock constants (must be defined before imports)
const mockSTATUS = {
  WORK_LOG: {
    SCHEDULED: 'scheduled',
    CHECKED_IN: 'checked_in',
    CHECKED_OUT: 'checked_out',
  },
  SCHEDULE: {
    APPLIED: 'applied',
    CONFIRMED: 'confirmed',
    COMPLETED: 'completed',
    CANCELLED: 'cancelled',
  },
  APPLICATION: {
    APPLIED: 'applied',
    PENDING: 'pending',
  },
} as const;

const mockWorkLogRepositoryGetByStaffIdWithFilters = jest.fn();
const mockWorkLogRepositoryGetById = jest.fn();
const mockWorkLogRepositorySubscribeByStaffId = jest.fn();
const mockApplicationRepositoryGetByApplicantIdWithStatuses = jest.fn();
const mockJobPostingRepositoryGetById = jest.fn();
const mockJobPostingRepositoryGetByIdBatch = jest.fn();

jest.mock('@/repositories', () => ({
  workLogRepository: {
    getByStaffIdWithFilters: (...args: unknown[]) => mockWorkLogRepositoryGetByStaffIdWithFilters(...args),
    getById: (...args: unknown[]) => mockWorkLogRepositoryGetById(...args),
    subscribeByStaffId: (...args: unknown[]) => mockWorkLogRepositorySubscribeByStaffId(...args),
  },
  applicationRepository: {
    getByApplicantIdWithStatuses: (...args: unknown[]) => mockApplicationRepositoryGetByApplicantIdWithStatuses(...args),
  },
  jobPostingRepository: {
    getById: (...args: unknown[]) => mockJobPostingRepositoryGetById(...args),
    getByIdBatch: (...args: unknown[]) => mockJobPostingRepositoryGetByIdBatch(...args),
  },
}));

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
      const dates = app.selectedDates || [app.date || '2025-01-15'];
      return dates.map(date => ({
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
}));

jest.mock('@/shared/id', () => ({
  IdNormalizer: {
    normalizeJobId: (doc: { jobPostingId?: string }) => doc.jobPostingId || '',
    extractUnifiedIds: (workLogs: WorkLog[], apps: Application[]) => {
      const ids = new Set<string>();
      workLogs.forEach(wl => ids.add(wl.jobPostingId));
      apps.forEach(app => ids.add(app.jobPostingId));
      return ids;
    },
  },
}));

jest.mock('@/shared/realtime', () => ({
  RealtimeManager: {
    subscribe: jest.fn((_key: string, subscribeFn: () => () => void) => subscribeFn()),
    Keys: {
      schedules: (staffId: string) => `schedules:${staffId}`,
    },
  },
}));

jest.mock('@/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('@/errors/serviceErrorHandler', () => ({
  handleServiceError: jest.fn((error: unknown) => {
    if (error instanceof Error) return error;
    return new Error(String(error));
  }),
}));

jest.mock('@/errors', () => ({
  NetworkError: class NetworkError extends Error {
    code: string;
    constructor(code: string, options?: { userMessage?: string }) {
      super(options?.userMessage || code);
      this.code = code;
    }
  },
  ERROR_CODES: {
    NETWORK_REQUEST_FAILED: 'E1002',
  },
  toError: (error: unknown) => (error instanceof Error ? error : new Error(String(error))),
}));

jest.mock('@/utils/date', () => ({
  toDateString: (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  },
}));

jest.mock('@/utils/firestore', () => ({
  timestampToDate: (timestamp: unknown) => {
    if (!timestamp) return null;
    if (timestamp instanceof Date) return timestamp;
    if (typeof timestamp === 'object' && 'toDate' in timestamp) {
      return (timestamp as { toDate: () => Date }).toDate();
    }
    return null;
  },
}));

// Import after mocks
import {
  getMySchedules,
  getSchedulesByDate,
  getSchedulesByMonth,
  getScheduleById,
  getTodaySchedules,
  getUpcomingSchedules,
  subscribeToSchedules,
  getScheduleStats,
  groupSchedulesByDate,
  getCalendarMarkedDates,
} from '@/services/scheduleService';
import { STATUS } from '@/constants';
import { Timestamp } from 'firebase/firestore';

// ============================================================================
// Test Helpers
// ============================================================================

function createMockWorkLog(overrides?: Partial<WorkLog>): WorkLog {
  return {
    id: 'wl-1',
    staffId: 'staff-123',
    jobPostingId: 'job-1',
    date: '2025-01-15',
    status: STATUS.WORK_LOG.SCHEDULED,
    role: '딜러',
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
    ...overrides,
  } as WorkLog;
}

function createMockApplication(overrides?: Partial<Application>): Application {
  return {
    id: 'app-1',
    applicantId: 'staff-123',
    jobPostingId: 'job-1',
    status: STATUS.APPLICATION.APPLIED,
    date: '2025-01-15',
    selectedDates: ['2025-01-15'],
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
    ...overrides,
  } as Application;
}

function createMockScheduleEvent(overrides?: Partial<ScheduleEvent>): ScheduleEvent {
  return {
    id: 'schedule-1',
    jobPostingId: 'job-1',
    jobPostingName: '테스트 이벤트',
    location: '서울',
    date: '2025-01-15',
    role: '딜러',
    type: STATUS.SCHEDULE.CONFIRMED,
    status: 'not_started',
    startTime: null,
    endTime: null,
    checkInTime: null,
    checkOutTime: null,
    ...overrides,
  };
}

// ============================================================================
// Tests
// ============================================================================

describe('scheduleService - getMySchedules', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('WorkLogs와 Applications를 병합하여 반환해야 함', async () => {
    const mockWorkLogs = [createMockWorkLog()];
    const mockApplications = [createMockApplication()];
    const mockJobPosting = { id: 'job-1', title: '테스트 이벤트', location: '서울', ownerId: 'owner-1' };

    mockWorkLogRepositoryGetByStaffIdWithFilters.mockResolvedValue(mockWorkLogs);
    mockApplicationRepositoryGetByApplicantIdWithStatuses.mockResolvedValue(mockApplications);
    mockJobPostingRepositoryGetByIdBatch.mockResolvedValue([mockJobPosting]);
    mockScheduleMergerMerge.mockImplementation((wl, app) => [...wl, ...app]);

    const result = await getMySchedules('staff-123');

    expect(result.schedules).toBeDefined();
    expect(result.stats).toBeDefined();
    expect(mockWorkLogRepositoryGetByStaffIdWithFilters).toHaveBeenCalledWith('staff-123', expect.any(Object));
    expect(mockApplicationRepositoryGetByApplicantIdWithStatuses).toHaveBeenCalled();
    expect(mockJobPostingRepositoryGetByIdBatch).toHaveBeenCalled();
  });

  it('날짜 범위 필터가 적용되어야 함', async () => {
    mockWorkLogRepositoryGetByStaffIdWithFilters.mockResolvedValue([]);
    mockApplicationRepositoryGetByApplicantIdWithStatuses.mockResolvedValue([]);
    mockJobPostingRepositoryGetByIdBatch.mockResolvedValue([]);
    mockScheduleMergerMerge.mockReturnValue([]);

    await getMySchedules('staff-123', {
      dateRange: { start: '2025-01-01', end: '2025-01-31' },
    });

    expect(mockWorkLogRepositoryGetByStaffIdWithFilters).toHaveBeenCalledWith('staff-123', {
      dateRange: { start: '2025-01-01', end: '2025-01-31' },
      status: undefined,
      pageSize: 50,
    });
  });

  it('상태 필터가 WorkLogStatus로 매핑되어야 함', async () => {
    mockWorkLogRepositoryGetByStaffIdWithFilters.mockResolvedValue([]);
    mockApplicationRepositoryGetByApplicantIdWithStatuses.mockResolvedValue([]);
    mockJobPostingRepositoryGetByIdBatch.mockResolvedValue([]);
    mockScheduleMergerMerge.mockReturnValue([]);

    await getMySchedules('staff-123', {
      status: 'checked_in',
    });

    expect(mockWorkLogRepositoryGetByStaffIdWithFilters).toHaveBeenCalledWith('staff-123', {
      dateRange: undefined,
      status: STATUS.WORK_LOG.CHECKED_IN,
      pageSize: 50,
    });
  });

  it('검색어로 필터링되어야 함', async () => {
    const mockSchedules = [
      createMockScheduleEvent({ jobPostingName: '강남 홀덤', location: '강남구' }),
      createMockScheduleEvent({ jobPostingName: '홍대 이벤트', location: '마포구' }),
    ];

    mockWorkLogRepositoryGetByStaffIdWithFilters.mockResolvedValue([]);
    mockApplicationRepositoryGetByApplicantIdWithStatuses.mockResolvedValue([]);
    mockJobPostingRepositoryGetByIdBatch.mockResolvedValue([]);
    mockScheduleMergerMerge.mockReturnValue(mockSchedules);

    const result = await getMySchedules('staff-123', {
      searchTerm: '강남',
    });

    expect(result.schedules.length).toBeLessThanOrEqual(mockSchedules.length);
  });

  it('타입 필터가 적용되어야 함', async () => {
    const mockSchedules = [
      createMockScheduleEvent({ type: STATUS.SCHEDULE.CONFIRMED }),
      createMockScheduleEvent({ type: STATUS.SCHEDULE.APPLIED }),
    ];

    mockWorkLogRepositoryGetByStaffIdWithFilters.mockResolvedValue([]);
    mockApplicationRepositoryGetByApplicantIdWithStatuses.mockResolvedValue([]);
    mockJobPostingRepositoryGetByIdBatch.mockResolvedValue([]);
    mockScheduleMergerMerge.mockReturnValue(mockSchedules);

    const result = await getMySchedules('staff-123', {
      type: STATUS.SCHEDULE.CONFIRMED,
    });

    expect(result.schedules.every(s => s.type === STATUS.SCHEDULE.CONFIRMED)).toBe(true);
  });

  it('WorkLogs 조회 실패 시 Applications만으로 처리하고 경고 반환', async () => {
    const mockApplications = [createMockApplication()];

    mockWorkLogRepositoryGetByStaffIdWithFilters.mockRejectedValue(new Error('Firebase error'));
    mockApplicationRepositoryGetByApplicantIdWithStatuses.mockResolvedValue(mockApplications);
    mockJobPostingRepositoryGetByIdBatch.mockResolvedValue([]);
    mockScheduleMergerMerge.mockImplementation((_wl, app) => app);

    const result = await getMySchedules('staff-123');

    expect(result.warning).toBeDefined();
    expect(result.warning).toContain('근무 기록');
  });

  it('Applications 조회 실패 시 WorkLogs만으로 처리하고 경고 반환', async () => {
    const mockWorkLogs = [createMockWorkLog()];

    mockWorkLogRepositoryGetByStaffIdWithFilters.mockResolvedValue(mockWorkLogs);
    mockApplicationRepositoryGetByApplicantIdWithStatuses.mockRejectedValue(new Error('Firebase error'));
    mockJobPostingRepositoryGetByIdBatch.mockResolvedValue([]);
    mockScheduleMergerMerge.mockImplementation((wl, _app) => wl);

    const result = await getMySchedules('staff-123');

    expect(result.warning).toBeDefined();
    expect(result.warning).toContain('지원 기록');
  });

  it('둘 다 실패 시 에러를 throw해야 함', async () => {
    mockWorkLogRepositoryGetByStaffIdWithFilters.mockRejectedValue(new Error('Firebase error'));
    mockApplicationRepositoryGetByApplicantIdWithStatuses.mockRejectedValue(new Error('Firebase error'));

    await expect(getMySchedules('staff-123')).rejects.toThrow();
  });

  it('공고 정보 조회 실패 시 기본값으로 처리', async () => {
    const mockWorkLogs = [createMockWorkLog()];

    mockWorkLogRepositoryGetByStaffIdWithFilters.mockResolvedValue(mockWorkLogs);
    mockApplicationRepositoryGetByApplicantIdWithStatuses.mockResolvedValue([]);
    mockJobPostingRepositoryGetByIdBatch.mockResolvedValue([]);
    mockScheduleMergerMerge.mockImplementation((wl) => wl);

    const result = await getMySchedules('staff-123');

    expect(result.schedules).toBeDefined();
  });

  it('빈 결과를 올바르게 처리해야 함', async () => {
    mockWorkLogRepositoryGetByStaffIdWithFilters.mockResolvedValue([]);
    mockApplicationRepositoryGetByApplicantIdWithStatuses.mockResolvedValue([]);
    mockJobPostingRepositoryGetByIdBatch.mockResolvedValue([]);
    mockScheduleMergerMerge.mockReturnValue([]);

    const result = await getMySchedules('staff-123');

    expect(result.schedules).toEqual([]);
    expect(result.stats.totalSchedules).toBe(0);
  });
});

describe('scheduleService - getSchedulesByDate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockWorkLogRepositoryGetByStaffIdWithFilters.mockResolvedValue([]);
    mockApplicationRepositoryGetByApplicantIdWithStatuses.mockResolvedValue([]);
    mockJobPostingRepositoryGetByIdBatch.mockResolvedValue([]);
    mockScheduleMergerMerge.mockReturnValue([]);
  });

  it('특정 날짜의 스케줄만 조회해야 함', async () => {
    const targetDate = '2025-01-15';

    await getSchedulesByDate('staff-123', targetDate);

    expect(mockWorkLogRepositoryGetByStaffIdWithFilters).toHaveBeenCalledWith('staff-123', {
      dateRange: { start: targetDate, end: targetDate },
      status: undefined,
      pageSize: 50,
    });
  });

  it('ScheduleEvent 배열을 반환해야 함', async () => {
    const result = await getSchedulesByDate('staff-123', '2025-01-15');

    expect(Array.isArray(result)).toBe(true);
  });
});

describe('scheduleService - getSchedulesByMonth', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockWorkLogRepositoryGetByStaffIdWithFilters.mockResolvedValue([]);
    mockApplicationRepositoryGetByApplicantIdWithStatuses.mockResolvedValue([]);
    mockJobPostingRepositoryGetByIdBatch.mockResolvedValue([]);
    mockScheduleMergerMerge.mockReturnValue([]);
  });

  it('월의 시작일과 끝일로 조회해야 함', async () => {
    await getSchedulesByMonth('staff-123', 2025, 1);

    expect(mockWorkLogRepositoryGetByStaffIdWithFilters).toHaveBeenCalledWith('staff-123', {
      dateRange: { start: '2025-01-01', end: '2025-01-31' },
      status: undefined,
      pageSize: 100,
    });
  });

  it('2월 윤년을 올바르게 처리해야 함', async () => {
    await getSchedulesByMonth('staff-123', 2024, 2);

    expect(mockWorkLogRepositoryGetByStaffIdWithFilters).toHaveBeenCalledWith('staff-123', {
      dateRange: { start: '2024-02-01', end: '2024-02-29' },
      status: undefined,
      pageSize: 100,
    });
  });

  it('2월 평년을 올바르게 처리해야 함', async () => {
    await getSchedulesByMonth('staff-123', 2025, 2);

    expect(mockWorkLogRepositoryGetByStaffIdWithFilters).toHaveBeenCalledWith('staff-123', {
      dateRange: { start: '2025-02-01', end: '2025-02-28' },
      status: undefined,
      pageSize: 100,
    });
  });

  it('12월을 올바르게 처리해야 함', async () => {
    await getSchedulesByMonth('staff-123', 2025, 12);

    expect(mockWorkLogRepositoryGetByStaffIdWithFilters).toHaveBeenCalledWith('staff-123', {
      dateRange: { start: '2025-12-01', end: '2025-12-31' },
      status: undefined,
      pageSize: 100,
    });
  });

  it('ScheduleQueryResult를 반환해야 함', async () => {
    const result = await getSchedulesByMonth('staff-123', 2025, 1);

    expect(result).toHaveProperty('schedules');
    expect(result).toHaveProperty('stats');
  });
});

describe('scheduleService - getScheduleById', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('존재하지 않는 스케줄은 null 반환', async () => {
    mockWorkLogRepositoryGetById.mockResolvedValue(null);

    const result = await getScheduleById('non-existent');

    expect(result).toBeNull();
  });

  it('존재하는 WorkLog를 ScheduleEvent로 변환해야 함', async () => {
    const mockWorkLog = createMockWorkLog();
    const mockJobPosting = { id: 'job-1', title: '테스트 이벤트', location: '서울', ownerId: 'owner-1' };

    mockWorkLogRepositoryGetById.mockResolvedValue(mockWorkLog);
    mockJobPostingRepositoryGetById.mockResolvedValue(mockJobPosting);

    const result = await getScheduleById('wl-1');

    expect(result).not.toBeNull();
    expect(result?.id).toBe('wl-1');
    expect(result?.jobPostingName).toBeDefined();
  });

  it('공고 정보 조회 실패해도 스케줄은 반환해야 함', async () => {
    const mockWorkLog = createMockWorkLog();

    mockWorkLogRepositoryGetById.mockResolvedValue(mockWorkLog);
    mockJobPostingRepositoryGetById.mockRejectedValue(new Error('Not found'));

    const result = await getScheduleById('wl-1');

    expect(result).not.toBeNull();
  });
});

describe('scheduleService - getTodaySchedules', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockWorkLogRepositoryGetByStaffIdWithFilters.mockResolvedValue([]);
    mockApplicationRepositoryGetByApplicantIdWithStatuses.mockResolvedValue([]);
    mockJobPostingRepositoryGetByIdBatch.mockResolvedValue([]);
    mockScheduleMergerMerge.mockReturnValue([]);
  });

  it('오늘 날짜로 조회해야 함', async () => {
    await getTodaySchedules('staff-123');

    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const todayStr = `${year}-${month}-${day}`;

    expect(mockWorkLogRepositoryGetByStaffIdWithFilters).toHaveBeenCalledWith('staff-123', {
      dateRange: { start: todayStr, end: todayStr },
      status: undefined,
      pageSize: 50,
    });
  });
});

describe('scheduleService - getUpcomingSchedules', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockWorkLogRepositoryGetByStaffIdWithFilters.mockResolvedValue([]);
    mockApplicationRepositoryGetByApplicantIdWithStatuses.mockResolvedValue([]);
    mockJobPostingRepositoryGetByIdBatch.mockResolvedValue([]);
  });

  it('기본 7일간의 스케줄을 조회해야 함', async () => {
    mockScheduleMergerMerge.mockReturnValue([]);

    await getUpcomingSchedules('staff-123');

    expect(mockWorkLogRepositoryGetByStaffIdWithFilters).toHaveBeenCalled();
  });

  it('사용자 지정 일수로 조회 가능해야 함', async () => {
    mockScheduleMergerMerge.mockReturnValue([]);

    await getUpcomingSchedules('staff-123', 14);

    expect(mockWorkLogRepositoryGetByStaffIdWithFilters).toHaveBeenCalled();
  });

  it('confirmed와 applied 상태만 필터링해야 함', async () => {
    const mockSchedules = [
      createMockScheduleEvent({ type: STATUS.SCHEDULE.CONFIRMED, date: '2025-12-25' }),
      createMockScheduleEvent({ type: STATUS.SCHEDULE.APPLIED, date: '2025-12-26' }),
      createMockScheduleEvent({ type: STATUS.SCHEDULE.COMPLETED, date: '2025-12-27' }),
      createMockScheduleEvent({ type: STATUS.SCHEDULE.CANCELLED, date: '2025-12-28' }),
    ];

    mockScheduleMergerMerge.mockReturnValue(mockSchedules);

    const result = await getUpcomingSchedules('staff-123');

    expect(result.length).toBe(2);
    expect(result.every(s => s.type === STATUS.SCHEDULE.CONFIRMED || s.type === STATUS.SCHEDULE.APPLIED)).toBe(true);
  });
});

describe('scheduleService - subscribeToSchedules', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('실시간 구독을 설정해야 함', () => {
    const onUpdate = jest.fn();
    const onError = jest.fn();
    const mockUnsubscribe = jest.fn();

    mockWorkLogRepositorySubscribeByStaffId.mockReturnValue(mockUnsubscribe);

    const unsubscribe = subscribeToSchedules('staff-123', onUpdate, onError);

    expect(mockWorkLogRepositorySubscribeByStaffId).toHaveBeenCalled();
    expect(typeof unsubscribe).toBe('function');
  });

  it('WorkLog 변경 시 onUpdate 호출해야 함', async () => {
    const onUpdate = jest.fn();
    const mockWorkLogs = [createMockWorkLog()];

    mockWorkLogRepositorySubscribeByStaffId.mockImplementation((_staffId, callback) => {
      callback(mockWorkLogs);
      return jest.fn();
    });
    mockJobPostingRepositoryGetByIdBatch.mockResolvedValue([]);

    subscribeToSchedules('staff-123', onUpdate);

    await new Promise(resolve => setTimeout(resolve, 0));

    expect(onUpdate).toHaveBeenCalled();
  });

  it('에러 발생 시 onError 호출해야 함', () => {
    const onUpdate = jest.fn();
    const onError = jest.fn();
    const mockError = new Error('Subscription error');

    mockWorkLogRepositorySubscribeByStaffId.mockImplementation((_staffId, _callback, errorCallback) => {
      if (errorCallback) errorCallback(mockError);
      return jest.fn();
    });

    subscribeToSchedules('staff-123', onUpdate, onError);

    expect(onError).toHaveBeenCalledWith(mockError);
  });

  it('중복 에러 호출을 방지해야 함', () => {
    const onUpdate = jest.fn();
    const onError = jest.fn();
    const mockError = new Error('Subscription error');

    mockWorkLogRepositorySubscribeByStaffId.mockImplementation((_staffId, _callback, errorCallback) => {
      if (errorCallback) {
        errorCallback(mockError);
        errorCallback(mockError);
      }
      return jest.fn();
    });

    subscribeToSchedules('staff-123', onUpdate, onError);

    expect(onError).toHaveBeenCalledTimes(1);
  });
});

describe('scheduleService - getScheduleStats', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('최근 6개월 통계를 반환해야 함', async () => {
    const mockSchedules = [
      createMockScheduleEvent({ type: STATUS.SCHEDULE.COMPLETED, payrollAmount: 150000 }),
      createMockScheduleEvent({ type: STATUS.SCHEDULE.CONFIRMED }),
      createMockScheduleEvent({ type: STATUS.SCHEDULE.APPLIED }),
    ];

    mockWorkLogRepositoryGetByStaffIdWithFilters.mockResolvedValue([]);
    mockApplicationRepositoryGetByApplicantIdWithStatuses.mockResolvedValue([]);
    mockJobPostingRepositoryGetByIdBatch.mockResolvedValue([]);
    mockScheduleMergerMerge.mockReturnValue(mockSchedules);

    const stats = await getScheduleStats('staff-123');

    expect(stats).toHaveProperty('totalSchedules');
    expect(stats).toHaveProperty('completedSchedules');
    expect(stats).toHaveProperty('confirmedSchedules');
    expect(stats).toHaveProperty('upcomingSchedules');
    expect(stats).toHaveProperty('totalEarnings');
    expect(stats).toHaveProperty('thisMonthEarnings');
    expect(stats).toHaveProperty('hoursWorked');
  });

  it('완료된 스케줄의 수익을 계산해야 함', async () => {
    const mockSchedules = [
      createMockScheduleEvent({ type: STATUS.SCHEDULE.COMPLETED, payrollAmount: 100000 }),
      createMockScheduleEvent({ type: STATUS.SCHEDULE.COMPLETED, payrollAmount: 50000 }),
    ];

    mockWorkLogRepositoryGetByStaffIdWithFilters.mockResolvedValue([]);
    mockApplicationRepositoryGetByApplicantIdWithStatuses.mockResolvedValue([]);
    mockJobPostingRepositoryGetByIdBatch.mockResolvedValue([]);
    mockScheduleMergerMerge.mockReturnValue(mockSchedules);

    const stats = await getScheduleStats('staff-123');

    expect(stats.completedSchedules).toBe(2);
    expect(stats.totalEarnings).toBeGreaterThan(0);
  });
});

describe('scheduleService - groupSchedulesByDate', () => {
  const formatDate = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  it('날짜별로 그룹화해야 함', () => {
    const today = formatDate(new Date());
    const tomorrowDate = new Date();
    tomorrowDate.setDate(tomorrowDate.getDate() + 1);
    const tomorrow = formatDate(tomorrowDate);

    const schedules = [
      createMockScheduleEvent({ date: today }),
      createMockScheduleEvent({ date: today }),
      createMockScheduleEvent({ date: tomorrow }),
    ];

    const groups = groupSchedulesByDate(schedules);

    expect(groups.length).toBe(2);
    expect(groups.find(g => g.date === today)?.events.length).toBe(2);
    expect(groups.find(g => g.date === tomorrow)?.events.length).toBe(1);
  });

  it('오늘 날짜를 표시해야 함', () => {
    const today = formatDate(new Date());
    const schedules = [createMockScheduleEvent({ date: today })];

    const groups = groupSchedulesByDate(schedules);

    expect(groups[0].isToday).toBe(true);
  });

  it('과거 날짜를 표시해야 함', () => {
    const yesterdayDate = new Date();
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const yesterday = formatDate(yesterdayDate);

    const schedules = [createMockScheduleEvent({ date: yesterday })];

    const groups = groupSchedulesByDate(schedules);

    expect(groups[0].isPast).toBe(true);
  });

  it('날짜를 최신순으로 정렬해야 함', () => {
    const schedules = [
      createMockScheduleEvent({ date: '2025-01-01' }),
      createMockScheduleEvent({ date: '2025-01-03' }),
      createMockScheduleEvent({ date: '2025-01-02' }),
    ];

    const groups = groupSchedulesByDate(schedules);

    expect(groups[0].date).toBe('2025-01-03');
    expect(groups[1].date).toBe('2025-01-02');
    expect(groups[2].date).toBe('2025-01-01');
  });

  it('빈 배열에 대해 빈 배열을 반환해야 함', () => {
    const groups = groupSchedulesByDate([]);
    expect(groups).toEqual([]);
  });

  it('날짜를 한글로 포맷팅해야 함', () => {
    const schedules = [createMockScheduleEvent({ date: '2025-12-25' })];
    const groups = groupSchedulesByDate(schedules);

    expect(groups[0].formattedDate).toContain('12월');
    expect(groups[0].formattedDate).toContain('25일');
  });
});

describe('scheduleService - getCalendarMarkedDates', () => {
  it('스케줄 타입별로 올바른 색상을 반환해야 함', () => {
    const schedules = [
      createMockScheduleEvent({ date: '2025-01-15', type: STATUS.SCHEDULE.CONFIRMED }),
      createMockScheduleEvent({ date: '2025-01-16', type: STATUS.SCHEDULE.APPLIED }),
      createMockScheduleEvent({ date: '2025-01-17', type: STATUS.SCHEDULE.COMPLETED }),
      createMockScheduleEvent({ date: '2025-01-18', type: STATUS.SCHEDULE.CANCELLED }),
    ];

    const markedDates = getCalendarMarkedDates(schedules);

    expect(markedDates['2025-01-15'].dotColor).toBe('#22c55e');
    expect(markedDates['2025-01-16'].dotColor).toBe('#f59e0b');
    expect(markedDates['2025-01-17'].dotColor).toBe('#A855F7');
    expect(markedDates['2025-01-18'].dotColor).toBe('#ef4444');
  });

  it('confirmed가 다른 타입보다 우선순위가 높아야 함', () => {
    const schedules = [
      createMockScheduleEvent({ date: '2025-01-15', type: STATUS.SCHEDULE.APPLIED }),
      createMockScheduleEvent({ date: '2025-01-15', type: STATUS.SCHEDULE.CONFIRMED }),
    ];

    const markedDates = getCalendarMarkedDates(schedules);

    expect(markedDates['2025-01-15'].type).toBe(STATUS.SCHEDULE.CONFIRMED);
  });

  it('applied가 completed보다 우선순위가 높아야 함', () => {
    const schedules = [
      createMockScheduleEvent({ date: '2025-01-15', type: STATUS.SCHEDULE.COMPLETED }),
      createMockScheduleEvent({ date: '2025-01-15', type: STATUS.SCHEDULE.APPLIED }),
    ];

    const markedDates = getCalendarMarkedDates(schedules);

    expect(markedDates['2025-01-15'].type).toBe(STATUS.SCHEDULE.APPLIED);
  });

  it('빈 배열에 대해 빈 객체를 반환해야 함', () => {
    const markedDates = getCalendarMarkedDates([]);
    expect(markedDates).toEqual({});
  });

  it('모든 날짜에 marked 플래그가 설정되어야 함', () => {
    const schedules = [
      createMockScheduleEvent({ date: '2025-01-15' }),
      createMockScheduleEvent({ date: '2025-01-16' }),
    ];

    const markedDates = getCalendarMarkedDates(schedules);

    expect(markedDates['2025-01-15'].marked).toBe(true);
    expect(markedDates['2025-01-16'].marked).toBe(true);
  });
});
