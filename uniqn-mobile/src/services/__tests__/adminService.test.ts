/**
 * UNIQN Mobile - Admin Service Tests
 *
 * @description 관리자 대시보드 및 사용자 관리 서비스 테스트
 * @version 1.0.0
 */

// ============================================================================
// Mocks (jest.mock is hoisted, so use inline factory functions)
// ============================================================================

jest.mock('@/repositories', () => ({
  adminRepository: {
    getDashboardCounts: jest.fn(),
    getRecentUsers: jest.fn(),
    getUsers: jest.fn(),
    getUserById: jest.fn(),
    updateUserRole: jest.fn(),
    setUserActive: jest.fn(),
    getSystemMetrics: jest.fn(),
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

jest.mock('@/errors', () => {
  class MockBusinessError extends Error {
    code: string;
    userMessage: string;
    metadata?: Record<string, unknown>;
    constructor(code: string, options?: { userMessage?: string; metadata?: Record<string, unknown> }) {
      super(options?.userMessage ?? 'Business error');
      this.name = 'BusinessError';
      this.code = code;
      this.userMessage = options?.userMessage ?? 'Business error';
      this.metadata = options?.metadata;
    }
  }
  return {
    BusinessError: MockBusinessError,
    ERROR_CODES: {
      UNKNOWN: 'E7001',
      AUTH_USER_NOT_FOUND: 'E2004',
    },
    isAppError: jest.fn((e: unknown) => e instanceof MockBusinessError),
  };
});

jest.mock('@/errors/serviceErrorHandler', () => ({
  handleServiceError: jest.fn((error: unknown) => {
    if (error instanceof Error) return error;
    return new Error(String(error));
  }),
}));

// ============================================================================
// Imports (after mocks)
// ============================================================================

import {
  getDashboardStats,
  getUsers,
  getUserById,
  updateUserRole,
  setUserActive,
  getSystemMetrics,
  adminService,
} from '../adminService';
import { adminRepository } from '@/repositories';
import { handleServiceError } from '@/errors/serviceErrorHandler';

// Get typed mock reference
const mockRepo = adminRepository as jest.Mocked<typeof adminRepository>;
const mockHandleServiceError = handleServiceError as jest.Mock;

// ============================================================================
// Test Helpers
// ============================================================================

function createMockDashboardCounts() {
  return {
    totalUsers: 150,
    newUsersToday: 5,
    activeJobPostings: 20,
    applicationsToday: 12,
    pendingReports: 3,
    adminCount: 2,
    employerCount: 30,
    staffCount: 118,
  };
}

function createMockAdminUser(overrides: Record<string, unknown> = {}) {
  return {
    id: 'user-1',
    name: '테스트 유저',
    email: 'test@example.com',
    role: 'staff',
    isActive: true,
    createdAt: { seconds: 1700000000, nanoseconds: 0 },
    ...overrides,
  };
}

// ============================================================================
// Tests
// ============================================================================

describe('AdminService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ==========================================================================
  // getDashboardStats
  // ==========================================================================
  describe('getDashboardStats', () => {
    it('should return dashboard stats with counts and recent users', async () => {
      const mockCounts = createMockDashboardCounts();
      const mockRecentUsers = [
        createMockAdminUser({ id: 'user-1' }),
        createMockAdminUser({ id: 'user-2' }),
      ];

      mockRepo.getDashboardCounts.mockResolvedValue(mockCounts);
      mockRepo.getRecentUsers.mockResolvedValue(mockRecentUsers as any);

      const result = await getDashboardStats();

      expect(mockRepo.getDashboardCounts).toHaveBeenCalled();
      expect(mockRepo.getRecentUsers).toHaveBeenCalledWith(5);
      expect(result.totalUsers).toBe(150);
      expect(result.newUsersToday).toBe(5);
      expect(result.activeJobPostings).toBe(20);
      expect(result.applicationsToday).toBe(12);
      expect(result.pendingReports).toBe(3);
      expect(result.usersByRole).toEqual({
        admin: 2,
        employer: 30,
        staff: 118,
      });
      expect(result.recentUsers).toEqual(mockRecentUsers);
      expect(result.fetchedAt).toBeInstanceOf(Date);
    });

    it('should throw handled error when repository fails', async () => {
      const error = new Error('Dashboard fetch failed');
      mockRepo.getDashboardCounts.mockRejectedValue(error);
      mockRepo.getRecentUsers.mockResolvedValue([]);

      await expect(getDashboardStats()).rejects.toThrow();
      expect(mockHandleServiceError).toHaveBeenCalledWith(error, expect.objectContaining({
        operation: '대시보드 통계 조회',
        component: 'adminService',
      }));
    });
  });

  // ==========================================================================
  // getUsers
  // ==========================================================================
  describe('getUsers', () => {
    it('should return paginated users with default parameters', async () => {
      const mockResult = {
        users: [createMockAdminUser()],
        total: 1,
        page: 1,
        pageSize: 20,
      };
      mockRepo.getUsers.mockResolvedValue(mockResult as any);

      const result = await getUsers();

      expect(mockRepo.getUsers).toHaveBeenCalledWith({}, 1, 20);
      expect(result.users).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('should pass filters, page, and pageSize to repository', async () => {
      const filters = { role: 'employer' as const };
      const mockResult = { users: [], total: 0, page: 2, pageSize: 10 };
      mockRepo.getUsers.mockResolvedValue(mockResult as any);

      await getUsers(filters as any, 2, 10);

      expect(mockRepo.getUsers).toHaveBeenCalledWith(filters, 2, 10);
    });

    it('should handle empty result', async () => {
      mockRepo.getUsers.mockResolvedValue({
        users: [],
        total: 0,
        page: 1,
        pageSize: 20,
      } as any);

      const result = await getUsers();

      expect(result.users).toHaveLength(0);
      expect(result.total).toBe(0);
    });

    it('should throw handled error when repository fails', async () => {
      const error = new Error('Users fetch failed');
      mockRepo.getUsers.mockRejectedValue(error);

      await expect(getUsers()).rejects.toThrow();
      expect(mockHandleServiceError).toHaveBeenCalledWith(error, expect.objectContaining({
        operation: '사용자 목록 조회',
      }));
    });
  });

  // ==========================================================================
  // getUserById
  // ==========================================================================
  describe('getUserById', () => {
    it('should return user when found', async () => {
      const mockUser = createMockAdminUser({ id: 'user-1', name: '홍길동' });
      mockRepo.getUserById.mockResolvedValue(mockUser as any);

      const result = await getUserById('user-1');

      expect(mockRepo.getUserById).toHaveBeenCalledWith('user-1');
      expect(result.name).toBe('홍길동');
    });

    it('should throw BusinessError when user not found', async () => {
      mockRepo.getUserById.mockResolvedValue(null);

      await expect(getUserById('non-existent')).rejects.toThrow('사용자를 찾을 수 없습니다');
    });

    it('should throw handled error when repository fails', async () => {
      const error = new Error('Fetch error');
      mockRepo.getUserById.mockRejectedValue(error);

      await expect(getUserById('user-1')).rejects.toThrow();
      expect(mockHandleServiceError).toHaveBeenCalledWith(error, expect.objectContaining({
        operation: '사용자 조회',
        context: { userId: 'user-1' },
      }));
    });
  });

  // ==========================================================================
  // updateUserRole
  // ==========================================================================
  describe('updateUserRole', () => {
    it('should update user role via repository', async () => {
      mockRepo.updateUserRole.mockResolvedValue('staff' as any);

      await updateUserRole('user-1', 'employer' as any, 'Upgrade to employer');

      expect(mockRepo.updateUserRole).toHaveBeenCalledWith('user-1', 'employer');
    });

    it('should handle update without reason', async () => {
      mockRepo.updateUserRole.mockResolvedValue('staff' as any);

      await updateUserRole('user-1', 'admin' as any);

      expect(mockRepo.updateUserRole).toHaveBeenCalledWith('user-1', 'admin');
    });

    it('should throw handled error when repository fails', async () => {
      const error = new Error('Role update failed');
      mockRepo.updateUserRole.mockRejectedValue(error);

      await expect(updateUserRole('user-1', 'employer' as any)).rejects.toThrow();
      expect(mockHandleServiceError).toHaveBeenCalledWith(error, expect.objectContaining({
        operation: '사용자 역할 변경',
        context: { userId: 'user-1', newRole: 'employer' },
      }));
    });
  });

  // ==========================================================================
  // setUserActive
  // ==========================================================================
  describe('setUserActive', () => {
    it('should activate a user', async () => {
      mockRepo.setUserActive.mockResolvedValue(undefined);

      await setUserActive('user-1', true, 'Reactivation');

      expect(mockRepo.setUserActive).toHaveBeenCalledWith('user-1', true);
    });

    it('should deactivate a user', async () => {
      mockRepo.setUserActive.mockResolvedValue(undefined);

      await setUserActive('user-1', false, 'Violation');

      expect(mockRepo.setUserActive).toHaveBeenCalledWith('user-1', false);
    });

    it('should handle without reason', async () => {
      mockRepo.setUserActive.mockResolvedValue(undefined);

      await setUserActive('user-1', true);

      expect(mockRepo.setUserActive).toHaveBeenCalledWith('user-1', true);
    });

    it('should throw handled error when repository fails', async () => {
      const error = new Error('Status change failed');
      mockRepo.setUserActive.mockRejectedValue(error);

      await expect(setUserActive('user-1', false)).rejects.toThrow();
      expect(mockHandleServiceError).toHaveBeenCalledWith(error, expect.objectContaining({
        operation: '사용자 상태 변경',
        context: { userId: 'user-1', isActive: false },
      }));
    });
  });

  // ==========================================================================
  // getSystemMetrics
  // ==========================================================================
  describe('getSystemMetrics', () => {
    it('should return system metrics with healthy status', async () => {
      mockRepo.getSystemMetrics.mockResolvedValue({
        dailySignups: [
          { date: '2025-01-15', count: 10 },
          { date: '2025-01-16', count: 8 },
        ],
        dailyApplications: [
          { date: '2025-01-15', count: 20 },
          { date: '2025-01-16', count: 15 },
        ],
        isHealthy: true,
      });

      const result = await getSystemMetrics();

      expect(result.systemStatus).toBe('healthy');
      expect(result.dailySignups).toHaveLength(2);
      expect(result.dailyApplications).toHaveLength(2);
      expect(result.dailyActiveUsers).toHaveLength(2);
      // DAU is currently unimplemented, should be 0
      expect(result.dailyActiveUsers[0].count).toBe(0);
      expect(result.fetchedAt).toBeInstanceOf(Date);
    });

    it('should return degraded status when not healthy', async () => {
      mockRepo.getSystemMetrics.mockResolvedValue({
        dailySignups: [],
        dailyApplications: [],
        isHealthy: false,
      });

      const result = await getSystemMetrics();

      expect(result.systemStatus).toBe('degraded');
    });

    it('should throw handled error when repository fails', async () => {
      const error = new Error('Metrics fetch failed');
      mockRepo.getSystemMetrics.mockRejectedValue(error);

      await expect(getSystemMetrics()).rejects.toThrow();
      expect(mockHandleServiceError).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // Service Export
  // ==========================================================================
  describe('adminService export', () => {
    it('should export all functions', () => {
      expect(adminService.getDashboardStats).toBe(getDashboardStats);
      expect(adminService.getUsers).toBe(getUsers);
      expect(adminService.getUserById).toBe(getUserById);
      expect(adminService.updateUserRole).toBe(updateUserRole);
      expect(adminService.setUserActive).toBe(setUserActive);
      expect(adminService.getSystemMetrics).toBe(getSystemMetrics);
    });
  });
});
