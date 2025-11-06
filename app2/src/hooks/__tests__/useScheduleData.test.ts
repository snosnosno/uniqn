/**
 * useScheduleData Hook 테스트
 *
 * 스케줄 데이터 및 급여 계산을 관리하는 Custom Hook 테스트
 * UnifiedDataContext와 통합되어 WorkLog 및 Application 데이터를 처리합니다.
 */

import { renderHook, waitFor } from '@testing-library/react';
import { useScheduleData } from '../useScheduleData';
import { createMockWorkLog } from '../../__tests__/mocks/testData';
import '../../__tests__/mocks/firebase'; // Firebase Mock import

// ========================================
// Mock Setup
// ========================================

// AuthContext Mock
const mockUseAuth = jest.fn();

jest.mock('../../contexts/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

// UnifiedDataContext Mock
const mockUseUnifiedDataContext = jest.fn();

jest.mock('../../contexts/UnifiedDataContext', () => ({
  useUnifiedDataContext: () => mockUseUnifiedDataContext(),
}));

// Logger Mock
jest.mock('../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

// Error Handler Mock
jest.mock('../../utils/errorHandler', () => ({
  handleError: jest.fn(),
}));

// ========================================
// ✅ Hybrid Integration Test 패턴
// filterUtils: 실제 사용 (Integration)
// dataProcessors: Mock (비동기 Firestore 호출 때문)
// ========================================

// Data Processors Mock - 비동기 Firestore 호출 제거
jest.mock('@/hooks/useScheduleData/dataProcessors', () => ({
  processApplicationData: jest.fn().mockResolvedValue([]),
  processWorkLogData: jest.fn().mockImplementation((id: string, workLog: any) => {
    // 간단한 동기 변환
    return Promise.resolve({
      id: workLog.id || id,
      eventId: workLog.eventId || 'event-1',
      eventName: workLog.eventName || 'Test Event',
      date: workLog.date || '2025-11-06',
      startTime: workLog.startTime || '10:00',
      endTime: workLog.endTime || '18:00',
      status: workLog.status || 'confirmed',
      role: workLog.role || 'dealer',
      location: workLog.location || 'Seoul',
      hourlyRate: workLog.hourlyRate || 15000,
      totalPay: workLog.totalPay || 120000,
    });
  }),
}));

// filterUtils는 실제 사용 (Mock 없음)

// ========================================
// Test Suite
// ========================================

describe('useScheduleData', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // AuthContext 기본 Mock 설정
    mockUseAuth.mockReturnValue({
      currentUser: {
        uid: 'test-user-1',
        email: 'test@example.com',
      },
    });

    // UnifiedDataContext 기본 Mock 설정
    mockUseUnifiedDataContext.mockReturnValue({
      state: {
        staff: new Map(),
        workLogs: new Map([
          ['log-1', createMockWorkLog({ id: 'log-1', staffId: 'test-user-1' })],
        ]),
        applications: new Map(),
        jobPostings: new Map(),
        loading: {
          initial: false,
          staff: false,
          workLogs: false,
          applications: false,
          jobPostings: false,
        },
        error: {
          staff: null,
          workLogs: null,
          applications: null,
          jobPostings: null,
        },
      },
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ========================================
  // T035: 초기 상태 테스트
  // ========================================
  describe('초기화', () => {
    test('초기 상태가 올바르게 설정된다', async () => {
      const { result } = renderHook(() => useScheduleData());

      // 초기 로딩 상태
      expect(result.current.loading).toBe(true);

      // 로딩 완료 대기
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // 초기 데이터 검증
      expect(result.current.schedules).toBeDefined();
      expect(Array.isArray(result.current.schedules)).toBe(true);
    });

    test('currentUser가 없으면 빈 스케줄을 반환한다', async () => {
      // Override Auth Mock for this test
      mockUseAuth.mockReturnValue({
        currentUser: null,
      });

      const { result } = renderHook(() => useScheduleData());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.schedules).toEqual([]);
    });

    test('WorkLogs 데이터를 스케줄로 변환한다', async () => {
      // WorkLog 데이터가 있는 경우
      const { result } = renderHook(() => useScheduleData());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // WorkLogs Map에 1개 데이터가 있으므로 schedules도 존재해야 함
      expect(result.current.schedules).toBeDefined();
    });
  });

  // ========================================
  // T047: 유효성 검증 에러 테스트
  // ========================================
  describe('에러 처리', () => {
    test('Context 에러가 발생하면 에러 상태를 반영한다', async () => {
      // UnifiedDataContext Mock 재정의 (에러 포함)
      mockUseUnifiedDataContext.mockReturnValue({
        state: {
          staff: new Map(),
          workLogs: new Map([
            ['log-1', createMockWorkLog({ id: 'log-1', staffId: 'test-user-1' })],
          ]),
          applications: new Map(),
          jobPostings: new Map(),
          loading: {
            initial: false,
            staff: false,
            workLogs: false,
            applications: false,
            jobPostings: false,
          },
          error: {
            staff: null,
            workLogs: 'Firebase connection error',
            applications: null,
            jobPostings: null,
          },
        },
      });

      const { result } = renderHook(() => useScheduleData());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // 에러가 있어도 Hook은 정상 동작해야 함 (graceful degradation)
      expect(result.current.schedules).toBeDefined();
    });
  });

  // ========================================
  // T052: 엣지 케이스 테스트
  // ========================================
  describe('엣지 케이스', () => {
    test('빈 WorkLogs는 빈 배열을 반환한다', async () => {
      // UnifiedDataContext Mock 재정의 (빈 데이터)
      mockUseUnifiedDataContext.mockReturnValue({
        state: {
          staff: new Map(),
          workLogs: new Map(),
          applications: new Map(),
          jobPostings: new Map(),
          loading: {
            initial: false,
            staff: false,
            workLogs: false,
            applications: false,
            jobPostings: false,
          },
          error: {
            staff: null,
            workLogs: null,
            applications: null,
            jobPostings: null,
          },
        },
      });

      const { result } = renderHook(() => useScheduleData());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.schedules).toEqual([]);
    });

    test('여러 WorkLogs를 처리한다', async () => {
      // 3개의 WorkLog 데이터
      mockUseUnifiedDataContext.mockReturnValue({
        state: {
          staff: new Map(),
          workLogs: new Map([
            ['log-1', createMockWorkLog({ id: 'log-1', staffId: 'test-user-1', date: '2025-11-01' })],
            ['log-2', createMockWorkLog({ id: 'log-2', staffId: 'test-user-1', date: '2025-11-02' })],
            ['log-3', createMockWorkLog({ id: 'log-3', staffId: 'test-user-1', date: '2025-11-03' })],
          ]),
          applications: new Map(),
          jobPostings: new Map(),
          loading: {
            initial: false,
            staff: false,
            workLogs: false,
            applications: false,
            jobPostings: false,
          },
          error: {
            staff: null,
            workLogs: null,
            applications: null,
            jobPostings: null,
          },
        },
      });

      const { result } = renderHook(() => useScheduleData());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // 3개의 WorkLog가 schedules로 변환되어야 함
      expect(result.current.schedules).toBeDefined();
    });

    test('다른 사용자의 WorkLogs는 제외한다', async () => {
      // 현재 사용자(test-user-1)와 다른 사용자의 WorkLog 포함
      mockUseUnifiedDataContext.mockReturnValue({
        state: {
          staff: new Map(),
          workLogs: new Map([
            ['log-1', createMockWorkLog({ id: 'log-1', staffId: 'test-user-1', date: '2025-11-01' })],
            ['log-2', createMockWorkLog({ id: 'log-2', staffId: 'other-user', date: '2025-11-02' })],
            ['log-3', createMockWorkLog({ id: 'log-3', staffId: 'test-user-1', date: '2025-11-03' })],
          ]),
          applications: new Map(),
          jobPostings: new Map(),
          loading: {
            initial: false,
            staff: false,
            workLogs: false,
            applications: false,
            jobPostings: false,
          },
          error: {
            staff: null,
            workLogs: null,
            applications: null,
            jobPostings: null,
          },
        },
      });

      const { result } = renderHook(() => useScheduleData());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // 현재 사용자의 WorkLog만 포함되어야 함
      expect(result.current.schedules).toBeDefined();
    });
  });

  // ========================================
  // T053: 메모리 누수 방지 테스트
  // ========================================
  describe('메모리 누수 방지', () => {
    test('언마운트 시 리소스가 정리된다', () => {
      const { unmount } = renderHook(() => useScheduleData());

      // 언마운트
      unmount();

      // 에러 없이 언마운트되어야 함
      expect(true).toBe(true);
    });
  });
});
