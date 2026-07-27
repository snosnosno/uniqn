/**
 * UNIQN Mobile - Schedule Service Tests (Extended)
 *
 * @description Comprehensive unit tests for schedule service functions
 * @version 2.0.0
 */

import type { ScheduleEvent, WorkLog, Application, ScheduleFilters } from '@/types';

// Import after mocks
import {
  getMySchedules,
  getSchedulesByDate,
  getSchedulesByMonth,
  getScheduleById,
  getTodaySchedules,
  subscribeToSchedules,
  groupSchedulesByDate,
  calculateScheduleStats,
} from '@/services/work/scheduleService';
import { STATUS } from '@/constants';

// ============================================================================
// Mock Setup
// ============================================================================

// Mock constants (must be defined before imports)
const _mockSTATUS = {
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
void _mockSTATUS;

const mockWorkLogRepositoryGetByStaffIdWithFilters = jest.fn();
const mockWorkLogRepositoryGetById = jest.fn();
const mockWorkLogRepositorySubscribeByStaffId = jest.fn();
const mockApplicationRepositoryGetByApplicantIdWithStatuses = jest.fn();
const mockApplicationRepositorySubscribeByApplicantIdWithStatuses = jest.fn(() => jest.fn());
const mockJobPostingRepositoryGetById = jest.fn();
const mockJobPostingRepositoryGetByIdBatch = jest.fn();
// 기본은 빈 Map — 대부분 테스트에서 2차 해소가 아무것도 붙이지 않아 기존 동작 유지.
// jest.fn(impl) 의 구현은 clearAllMocks(mockClear) 로 지워지지 않는다(mockReset 만 제거).
const mockJobPostingRepositoryGetMyVenueRoleSalaries = jest.fn((..._args: unknown[]) =>
  Promise.resolve(new Map())
);

jest.mock('@/repositories', () => ({
  workLogRepository: {
    getByStaffIdWithFilters: (...args: unknown[]) =>
      mockWorkLogRepositoryGetByStaffIdWithFilters(...args),
    getById: (...args: unknown[]) => mockWorkLogRepositoryGetById(...args),
    subscribeByStaffId: (...args: unknown[]) => mockWorkLogRepositorySubscribeByStaffId(...args),
  },
  applicationRepository: {
    getByApplicantIdWithStatuses: (...args: unknown[]) =>
      mockApplicationRepositoryGetByApplicantIdWithStatuses(...args),
    subscribeByApplicantIdWithStatuses: (...args: unknown[]) =>
      mockApplicationRepositorySubscribeByApplicantIdWithStatuses.apply(null, args),
  },
  jobPostingRepository: {
    getById: (...args: unknown[]) => mockJobPostingRepositoryGetById(...args),
    getByIdBatch: (...args: unknown[]) => mockJobPostingRepositoryGetByIdBatch(...args),
    getMyVenueRoleSalaries: (...args: unknown[]) =>
      mockJobPostingRepositoryGetMyVenueRoleSalaries(...args),
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
  // 컨테이너 2차 해소(#6) — 근무표 직접배치 급여 복구용. 기본은 호출되지 않음(getMyVenueRoleSalaries=빈 Map).
  createScheduleContainerContext: (_roleSalaries: unknown, title?: string) => ({
    title: title || '이벤트',
    location: '',
    settlement: { roles: [], defaultSalary: { type: 'hourly', amount: 15000 } },
  }),
}));

jest.mock('@/shared/id', () => ({
  IdNormalizer: {
    normalizeJobId: (doc: { jobPostingId?: string }) => doc.jobPostingId || '',
    extractUnifiedIds: (workLogs: WorkLog[], apps: Application[]) => {
      const ids = new Set<string>();
      workLogs.forEach((wl) => ids.add(wl.jobPostingId));
      apps.forEach((app) => ids.add(app.jobPostingId));
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
  // scheduleService.ts:629 가 isAppError(error) 호출 — duck-typed 체크로 충분
  // (실제 AppError.isAppError 는 instanceof AppError 또는 __isAppError 마커 검사)
  isAppError: (error: unknown): boolean =>
    error !== null &&
    typeof error === 'object' &&
    ('__isAppError' in error || 'isRetryable' in error || 'code' in error),
}));

jest.mock('@/utils/date', () => ({
  toDateString: (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  },
  formatDateWithDay: (dateStr: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return '';
    }
    const [year, month, day] = dateStr.split('-').map(Number);
    const parsed = new Date(year, month - 1, day);
    const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
    return `${month}월 ${day}일 (${weekdays[parsed.getDay()]})`;
  },
}));

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
    createdAt: new Date(),
    updatedAt: new Date(),
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
    createdAt: new Date(),
    updatedAt: new Date(),
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
    sourceCollection: 'workLogs',
    sourceId: 'wl-1',
    ...overrides,
  } as ScheduleEvent;
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
    const mockJobPosting = {
      id: 'job-1',
      title: '테스트 이벤트',
      location: '서울',
      ownerId: 'owner-1',
    };

    mockWorkLogRepositoryGetByStaffIdWithFilters.mockResolvedValue(mockWorkLogs);
    mockApplicationRepositoryGetByApplicantIdWithStatuses.mockResolvedValue(mockApplications);
    mockJobPostingRepositoryGetByIdBatch.mockResolvedValue([mockJobPosting]);
    mockScheduleMergerMerge.mockImplementation((wl, app) => [...wl, ...app]);

    const result = await getMySchedules('staff-123');

    expect(result.schedules).toBeDefined();
    expect(result.stats).toBeDefined();
    expect(mockWorkLogRepositoryGetByStaffIdWithFilters).toHaveBeenCalledWith(
      'staff-123',
      expect.any(Object)
    );
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
    } as Partial<ScheduleFilters> as ScheduleFilters);

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
    } as Partial<ScheduleFilters> as ScheduleFilters);

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
    } as Partial<ScheduleFilters> as ScheduleFilters);

    expect(result.schedules.every((s) => s.type === STATUS.SCHEDULE.CONFIRMED)).toBe(true);
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
    mockApplicationRepositoryGetByApplicantIdWithStatuses.mockRejectedValue(
      new Error('Firebase error')
    );
    mockJobPostingRepositoryGetByIdBatch.mockResolvedValue([]);
    mockScheduleMergerMerge.mockImplementation((wl, _app) => wl);

    const result = await getMySchedules('staff-123');

    expect(result.warning).toBeDefined();
    expect(result.warning).toContain('지원 기록');
  });

  it('둘 다 실패 시 에러를 throw해야 함', async () => {
    mockWorkLogRepositoryGetByStaffIdWithFilters.mockRejectedValue(new Error('Firebase error'));
    mockApplicationRepositoryGetByApplicantIdWithStatuses.mockRejectedValue(
      new Error('Firebase error')
    );

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
  it('빈 날짜 schedule은 목록과 통계에서 제외한다', async () => {
    const mockSchedules = [
      createMockScheduleEvent({ id: 'dated', date: '2025-01-15', type: STATUS.SCHEDULE.CONFIRMED }),
      createMockScheduleEvent({
        id: 'undated',
        date: '',
        type: STATUS.SCHEDULE.COMPLETED,
        // payroll_amount 는 항상 payroll_status='completed' 와 **함께만** 기록된다
        // (SettlementRepository :276-278 개별 · :490-492 일괄). 동결값 판정이 정산 축으로
        // 통일되면서 이 픽스처도 실제 데이터 모양을 따른다.
        payrollStatus: STATUS.PAYROLL.COMPLETED,
        payrollAmount: 120000,
      } as Partial<ScheduleEvent>),
    ];

    mockWorkLogRepositoryGetByStaffIdWithFilters.mockResolvedValue([]);
    mockApplicationRepositoryGetByApplicantIdWithStatuses.mockResolvedValue([]);
    mockJobPostingRepositoryGetByIdBatch.mockResolvedValue([]);
    mockScheduleMergerMerge.mockReturnValue(mockSchedules);

    const result = await getMySchedules('staff-123');

    expect(result.schedules).toHaveLength(1);
    expect(result.schedules[0]?.id).toBe('dated');
    expect(result.stats.totalSchedules).toBe(2);
    expect(result.stats.completedSchedules).toBe(1);
    expect(result.stats.totalEarnings).toBe(120000);
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
  // 조회 범위는 월 경계를 넘는 연속 근무를 한 그룹으로 잡기 위해 앞뒤 7일 패딩된다.
  // (표시·집계 기준은 그대로 '그 달' — 아래 '그 달 밖 근무일' 테스트가 그 계약을 지킨다)
  beforeEach(() => {
    jest.clearAllMocks();
    mockWorkLogRepositoryGetByStaffIdWithFilters.mockResolvedValue([]);
    mockApplicationRepositoryGetByApplicantIdWithStatuses.mockResolvedValue([]);
    mockJobPostingRepositoryGetByIdBatch.mockResolvedValue([]);
    mockScheduleMergerMerge.mockReturnValue([]);
  });

  // 회귀 방어: 조회는 앞뒤 7일 넓게 하되, **표시·집계 기준은 그대로 그 달**이어야 한다.
  // 패딩분이 schedules 로 새면 남의 달 일정이 캘린더 dot·통계·필터에 섞인다.
  it('패딩으로 딸려온 그 달 밖 근무일은 schedules 가 아니라 boundarySchedules 로 분리한다', async () => {
    const july = (date: string, applicationId: string, id: string) => ({
      id,
      applicationId,
      date,
      type: STATUS.SCHEDULE.CONFIRMED,
    });

    mockScheduleMergerMerge.mockReturnValue([
      july('2025-01-30', 'app-1', 's1'),
      july('2025-01-31', 'app-1', 's2'),
      july('2025-02-02', 'app-1', 's3'), // 같은 지원의 다음 달 근무일 — 그룹핑 재료
      july('2025-02-05', 'app-other', 's4'), // 그 달에 근무가 없는 지원 — 끌고 오지 않는다
    ]);

    const result = await getSchedulesByMonth('staff-123', 2025, 1);

    expect(result.schedules.map((s) => s.id)).toEqual(['s1', 's2']);
    expect(result.boundarySchedules?.map((s) => s.id)).toEqual(['s3']);
    // 통계도 그 달 기준이라 경계 근무일이 건수를 부풀리지 않는다.
    expect(result.stats.confirmedSchedules).toBe(1);
  });

  it('월의 시작일과 끝일로 조회해야 함', async () => {
    await getSchedulesByMonth('staff-123', 2025, 1);

    expect(mockWorkLogRepositoryGetByStaffIdWithFilters).toHaveBeenCalledWith('staff-123', {
      dateRange: { start: '2024-12-25', end: '2025-02-07' },
      status: undefined,
      pageSize: 100,
    });
  });

  it('2월 윤년을 올바르게 처리해야 함', async () => {
    await getSchedulesByMonth('staff-123', 2024, 2);

    expect(mockWorkLogRepositoryGetByStaffIdWithFilters).toHaveBeenCalledWith('staff-123', {
      dateRange: { start: '2024-01-25', end: '2024-03-07' },
      status: undefined,
      pageSize: 100,
    });
  });

  it('2월 평년을 올바르게 처리해야 함', async () => {
    await getSchedulesByMonth('staff-123', 2025, 2);

    expect(mockWorkLogRepositoryGetByStaffIdWithFilters).toHaveBeenCalledWith('staff-123', {
      dateRange: { start: '2025-01-25', end: '2025-03-07' },
      status: undefined,
      pageSize: 100,
    });
  });

  it('12월을 올바르게 처리해야 함', async () => {
    await getSchedulesByMonth('staff-123', 2025, 12);

    expect(mockWorkLogRepositoryGetByStaffIdWithFilters).toHaveBeenCalledWith('staff-123', {
      dateRange: { start: '2025-11-24', end: '2026-01-07' },
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
    const mockJobPosting = {
      id: 'job-1',
      title: '테스트 이벤트',
      location: '서울',
      ownerId: 'owner-1',
    };

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

describe('scheduleService - subscribeToSchedules', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockScheduleMergerMerge.mockImplementation(
      (workLogs: ScheduleEvent[], apps: ScheduleEvent[]) => [...workLogs, ...apps]
    );
    mockApplicationRepositorySubscribeByApplicantIdWithStatuses.mockImplementation(
      (...params: unknown[]) => {
        const callback = params[2] as (applications: Application[]) => void;
        callback([]);
        return jest.fn();
      }
    );
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

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(onUpdate).toHaveBeenCalled();
  });

  it('첫 realtime emit은 WorkLog와 Application 초기 스냅샷이 모두 도착한 뒤에만 발생해야 함', async () => {
    const onUpdate = jest.fn();
    let workLogCallback: ((workLogs: WorkLog[]) => void) | undefined;
    let applicationCallback: ((applications: Application[]) => void) | undefined;

    mockWorkLogRepositorySubscribeByStaffId.mockImplementation((_staffId, callback) => {
      workLogCallback = callback;
      return jest.fn();
    });
    mockApplicationRepositorySubscribeByApplicantIdWithStatuses.mockImplementation(
      (...args: unknown[]) => {
        const callback = args[2] as ((applications: Application[]) => void) | undefined;
        applicationCallback = callback;
        return jest.fn();
      }
    );
    mockJobPostingRepositoryGetByIdBatch.mockResolvedValue([]);

    subscribeToSchedules('staff-123', onUpdate);

    workLogCallback?.([createMockWorkLog()]);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(onUpdate).not.toHaveBeenCalled();

    applicationCallback?.([createMockApplication()]);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(onUpdate).toHaveBeenCalledTimes(1);
  });

  it('에러 발생 시 onError 호출해야 함', () => {
    const onUpdate = jest.fn();
    const onError = jest.fn();
    const mockError = new Error('Subscription error');

    mockWorkLogRepositorySubscribeByStaffId.mockImplementation(
      (_staffId, _callback, errorCallback) => {
        if (errorCallback) errorCallback(mockError);
        return jest.fn();
      }
    );

    subscribeToSchedules('staff-123', onUpdate, onError);

    expect(onError).toHaveBeenCalledWith(mockError);
  });

  it('중복 에러 호출을 방지해야 함', () => {
    const onUpdate = jest.fn();
    const onError = jest.fn();
    const mockError = new Error('Subscription error');

    mockWorkLogRepositorySubscribeByStaffId.mockImplementation(
      (_staffId, _callback, errorCallback) => {
        if (errorCallback) {
          errorCallback(mockError);
          errorCallback(mockError);
        }
        return jest.fn();
      }
    );

    subscribeToSchedules('staff-123', onUpdate, onError);

    expect(onError).toHaveBeenCalledTimes(1);
  });
  it('realtime update에서도 빈 날짜 schedule은 제외한다', async () => {
    const onUpdate = jest.fn();
    const mockWorkLogs = [
      createMockWorkLog({ id: 'dated', date: '2025-01-15' }),
      createMockWorkLog({ id: 'undated', date: '' }),
    ];

    mockWorkLogRepositorySubscribeByStaffId.mockImplementation((_staffId, callback) => {
      callback(mockWorkLogs);
      return jest.fn();
    });
    mockJobPostingRepositoryGetByIdBatch.mockResolvedValue([]);

    subscribeToSchedules('staff-123', onUpdate);

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(onUpdate).toHaveBeenCalledWith([
      expect.objectContaining({
        id: 'dated',
        date: '2025-01-15',
      }),
    ]);
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
    expect(groups.find((g) => g.date === today)?.events.length).toBe(2);
    expect(groups.find((g) => g.date === tomorrow)?.events.length).toBe(1);
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

describe('scheduleService - invalid date fallback', () => {
  it('keeps the raw date label when grouping invalid dates', () => {
    const groups = groupSchedulesByDate([createMockScheduleEvent({ date: 'invalid-date' })]);

    expect(groups[0].formattedDate).toBe('invalid-date');
  });
});

describe('scheduleService - calculateScheduleStats', () => {
  // 홈 대시보드 삭제로 래퍼 getScheduleStats 는 사라졌지만, 실로직인 calculateScheduleStats 는
  // 스케줄 탭 통계로 그대로 렌더된다. 아래 두 건은 과거 실제 회귀의 가드이므로 순수 함수 직접
  // 호출로 이식해 유지한다 (리포지토리 mock 불필요).

  it('과거 날짜의 확정 스케줄도 확정 카운트에 포함한다 (리스트 표시 기준과 통일)', () => {
    // 근무일이 지났지만 아직 완료(WorkLog) 전환 전인 confirmed 지원 — 리스트/캘린더엔 확정으로 뜨는데
    // 통계에서만 누락되던 회귀(과거 `date >= today` 필터). 이제 날짜 무관 confirmed 전체를 센다.
    const stats = calculateScheduleStats([
      createMockScheduleEvent({
        id: 'past-confirmed',
        applicationId: 'app-past',
        date: '2020-06-06',
        type: STATUS.SCHEDULE.CONFIRMED,
      }),
    ]);

    expect(stats.confirmedSchedules).toBe(1);
  });

  // 회귀 방어: 완료만 원본 row 를 그대로 세서, 3일 대회 1건이 상단 통계엔 '완료 3',
  // 목록 필터탭엔 '완료 1' 로 동시에 나왔다. 세 지표의 단위를 '건' 으로 통일한다.
  it('하나의 지원이 여러 일정으로 펼쳐져도 완료는 1건으로 집계하고 근무 일수를 따로 센다', () => {
    const stats = calculateScheduleStats(
      ['2026-07-15', '2026-07-16', '2026-07-17'].map((date, index) =>
        createMockScheduleEvent({
          id: `done-${index + 1}`,
          applicationId: 'app-done',
          date,
          type: STATUS.SCHEDULE.COMPLETED,
        })
      )
    );

    expect(stats.completedSchedules).toBe(1);
    expect(stats.completedWorkDays).toBe(3);
  });

  it('정산 완료분과 정산 예정분을 분리해 집계한다', () => {
    const stats = calculateScheduleStats([
      createMockScheduleEvent({
        id: 'paid',
        applicationId: 'app-paid',
        date: '2026-07-10',
        type: STATUS.SCHEDULE.COMPLETED,
        payrollAmount: 200000,
        payrollStatus: STATUS.PAYROLL.COMPLETED,
      }),
      createMockScheduleEvent({
        id: 'pending',
        applicationId: 'app-pending',
        date: '2026-07-11',
        type: STATUS.SCHEDULE.COMPLETED,
        payrollAmount: 150000,
        payrollStatus: STATUS.PAYROLL.PENDING,
      }),
    ]);

    expect(stats.settledEarnings).toBe(200000);
    expect(stats.estimatedEarnings).toBe(150000);
    expect(stats.thisMonthEarnings).toBe(350000);
  });

  it('하나의 지원이 여러 일정으로 펼쳐져도 지원중은 1건으로 집계한다', () => {
    const stats = calculateScheduleStats(
      ['2099-01-15', '2099-01-16', '2099-01-17'].map((date, index) =>
        createMockScheduleEvent({
          id: `app-1-${index + 1}`,
          applicationId: 'app-1',
          date,
          type: STATUS.SCHEDULE.APPLIED,
        })
      )
    );

    expect(stats.upcomingSchedules).toBe(1);
  });

  // --- 동결값 SSOT (SETTLE-5) -------------------------------------------------
  // `payrollAmount > 0` 가드는 **정산 0원 완료 건**(노쇼 등)을 동결값으로 인정하지 않고
  // settlementBreakdown 재계산으로 흘려보낸다. 그러면 실제로 0원을 지급한 근무가 수입
  // 합계에 양수로 잡힌다 — 5개 위반 지점 중 유일하게 금액 오차가 실제로 발생하는 곳.
  it('정산 0원으로 완료된 근무는 수입 합계에 0원으로 잡힌다 (재계산으로 새지 않는다)', () => {
    const stats = calculateScheduleStats([
      createMockScheduleEvent({
        id: 'zero-settled',
        applicationId: 'app-zero',
        date: '2025-01-15',
        type: STATUS.SCHEDULE.COMPLETED,
        payrollStatus: STATUS.PAYROLL.COMPLETED,
        payrollAmount: 0,
        settlementBreakdown: {
          basePay: 90000,
          totalPay: 90000,
          afterTaxPay: 90000,
          taxSettings: { type: 'none' },
        },
      } as Partial<ScheduleEvent>),
    ]);

    expect(stats.totalEarnings).toBe(0);
  });

  it('정산 완료 건은 동결값을 쓰고 settlementBreakdown 재계산을 무시한다', () => {
    const stats = calculateScheduleStats([
      createMockScheduleEvent({
        id: 'settled',
        applicationId: 'app-settled',
        date: '2025-01-15',
        type: STATUS.SCHEDULE.COMPLETED,
        payrollStatus: STATUS.PAYROLL.COMPLETED,
        payrollAmount: 80000,
        settlementBreakdown: {
          basePay: 120000,
          totalPay: 120000,
          afterTaxPay: 120000,
          taxSettings: { type: 'none' },
        },
      } as Partial<ScheduleEvent>),
    ]);

    expect(stats.totalEarnings).toBe(80000);
  });

  it('정산 미완료 건은 settlementBreakdown 재계산으로 폴백한다', () => {
    const stats = calculateScheduleStats([
      createMockScheduleEvent({
        id: 'pending',
        applicationId: 'app-pending',
        date: '2025-01-15',
        type: STATUS.SCHEDULE.COMPLETED,
        payrollStatus: STATUS.PAYROLL.PENDING,
        settlementBreakdown: {
          basePay: 70000,
          totalPay: 70000,
          afterTaxPay: 70000,
          taxSettings: { type: 'none' },
        },
      } as Partial<ScheduleEvent>),
    ]);

    expect(stats.totalEarnings).toBe(70000);
  });
});
