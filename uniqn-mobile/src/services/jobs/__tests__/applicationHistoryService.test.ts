import {
  cancelConfirmation,
  confirmApplicationWithHistory,
  getApplicationHistorySummary,
  getConfirmedSelections,
  getOriginalApplicationData,
  isV2Application,
} from '../applicationHistoryService';
import { isAppError } from '@/errors';
import { applicationRepository } from '@/repositories';
import { findActiveConfirmation } from '@/domains/application';
import { handleServiceError } from '@/errors/serviceErrorHandler';

jest.mock('@/repositories', () => ({
  applicationRepository: {
    confirmWithHistoryTransaction: jest.fn(),
    cancelConfirmationTransaction: jest.fn(),
    getById: jest.fn(),
  },
}));

jest.mock('@/domains/application', () => ({
  findActiveConfirmation: jest.fn(),
}));

jest.mock('@/errors/serviceErrorHandler', () => ({
  handleServiceError: jest.fn((error: unknown) => {
    if (error instanceof Error) {
      return error;
    }

    return new Error(String(error));
  }),
}));

jest.mock('@/errors', () => {
  // Phase 0 N1 hotfix: jobManagementService 가 workspaceService 를 transitive 하게 import →
  // ERROR_CODES 가 module-load 시점에 필요해짐. requireActual 로 실제 코드 그대로 사용.
  const actual = jest.requireActual('@/errors');
  return {
    ...actual,
    isAppError: jest.fn(() => false),
  };
});

jest.mock('@/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

const mockApplicationRepository = applicationRepository as jest.Mocked<
  typeof applicationRepository
>;
const mockFindActiveConfirmation = findActiveConfirmation as jest.MockedFunction<
  typeof findActiveConfirmation
>;
const mockHandleServiceError = handleServiceError as jest.MockedFunction<typeof handleServiceError>;
const mockIsAppError = isAppError as jest.MockedFunction<typeof isAppError>;

function createHistoryEntry(overrides: Record<string, unknown> = {}): Record<string, unknown> & {
  confirmedAt: { seconds: number; nanoseconds: number };
  assignments: unknown[];
  cancelledAt?: { seconds: number; nanoseconds: number };
} {
  return {
    confirmedAt: { seconds: 1700000000, nanoseconds: 0 },
    assignments: [] as unknown[],
    ...overrides,
  };
}

function createApplication(overrides: Record<string, unknown> = {}) {
  return {
    id: 'app-1',
    status: 'applied',
    assignments: [{ roleIds: ['dealer'], dates: ['2025-01-20'], timeSlot: '18:00~02:00' }],
    confirmationHistory: [],
    ...overrides,
  };
}

describe('applicationHistoryService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsAppError.mockReturnValue(false);
  });

  describe('confirmApplicationWithHistory', () => {
    it('delegates confirmation to the repository transaction', async () => {
      const selectedAssignments = [
        { roleIds: ['dealer'], dates: ['2025-01-20'], timeSlot: '18:00~02:00' },
      ];
      const repositoryResult = {
        applicationId: 'app-1',
        workLogIds: ['wl-1'],
        message: 'confirmed',
      };
      mockApplicationRepository.confirmWithHistoryTransaction.mockResolvedValue(
        repositoryResult as never
      );

      const result = await confirmApplicationWithHistory(
        'app-1',
        selectedAssignments as never,
        'owner-1',
        'Confirmed'
      );

      expect(mockApplicationRepository.confirmWithHistoryTransaction).toHaveBeenCalledWith(
        'app-1',
        selectedAssignments,
        'owner-1',
        'Confirmed'
      );
      expect(result).toEqual(repositoryResult);
    });

    it('rethrows AppError instances without remapping', async () => {
      const appError = new Error('business error');
      mockApplicationRepository.confirmWithHistoryTransaction.mockRejectedValue(appError);
      mockIsAppError.mockReturnValue(true);

      await expect(confirmApplicationWithHistory('app-1', undefined, 'owner-1')).rejects.toBe(
        appError
      );
      expect(mockHandleServiceError).not.toHaveBeenCalled();
    });

    it('wraps unknown errors through handleServiceError', async () => {
      const error = new Error('firestore failed');
      mockApplicationRepository.confirmWithHistoryTransaction.mockRejectedValue(error);
      mockHandleServiceError.mockReturnValue(error as never);

      await expect(confirmApplicationWithHistory('app-1', undefined, 'owner-1')).rejects.toBe(
        error
      );
      expect(mockHandleServiceError).toHaveBeenCalledWith(
        error,
        expect.objectContaining({
          component: 'applicationHistoryService',
          context: { applicationId: 'app-1' },
        })
      );
    });

    it('rejects unsafe confirmation notes before reaching the repository', async () => {
      await expect(
        confirmApplicationWithHistory('app-1', undefined, 'owner-1', '<script>alert(1)</script>')
      ).rejects.toThrow();

      expect(mockApplicationRepository.confirmWithHistoryTransaction).not.toHaveBeenCalled();
    });
  });

  describe('cancelConfirmation', () => {
    // actorType 은 기본값이 없다 — 조용한 기본값이 구인자 경로를 항상 unauthorized 로 떨어뜨렸다.
    it('delegates cancellation to the repository transaction (staff_initiates 명시)', async () => {
      const repositoryResult = {
        applicationId: 'app-1',
        restoredStatus: 'applied',
        cancelledAt: { seconds: 1700001000, nanoseconds: 0 },
      };
      mockApplicationRepository.cancelConfirmationTransaction.mockResolvedValue(
        repositoryResult as never
      );

      const result = await cancelConfirmation(
        'app-1',
        'owner-1',
        'Release slot',
        'staff_initiates'
      );

      expect(mockApplicationRepository.cancelConfirmationTransaction).toHaveBeenCalledWith(
        'app-1',
        'owner-1',
        'Release slot',
        'staff_initiates'
      );
      expect(result).toEqual(repositoryResult);
    });

    it('employer_initiates actorType 을 repository 트랜잭션으로 배관한다', async () => {
      const repositoryResult = {
        applicationId: 'app-1',
        restoredStatus: 'applied',
        cancelledAt: { seconds: 1700001000, nanoseconds: 0 },
      };
      mockApplicationRepository.cancelConfirmationTransaction.mockResolvedValue(
        repositoryResult as never
      );

      await cancelConfirmation('app-1', 'owner-1', '구인자 해제', 'employer_initiates');

      expect(mockApplicationRepository.cancelConfirmationTransaction).toHaveBeenCalledWith(
        'app-1',
        'owner-1',
        '구인자 해제',
        'employer_initiates'
      );
    });

    it('rethrows AppError instances without remapping', async () => {
      const appError = new Error('already cancelled');
      mockApplicationRepository.cancelConfirmationTransaction.mockRejectedValue(appError);
      mockIsAppError.mockReturnValue(true);

      await expect(
        cancelConfirmation('app-1', 'owner-1', undefined, 'staff_initiates')
      ).rejects.toBe(appError);
      expect(mockHandleServiceError).not.toHaveBeenCalled();
    });

    it('wraps unknown errors through handleServiceError', async () => {
      const error = new Error('cancel failed');
      mockApplicationRepository.cancelConfirmationTransaction.mockRejectedValue(error);
      mockHandleServiceError.mockReturnValue(error as never);

      await expect(
        cancelConfirmation('app-1', 'owner-1', undefined, 'staff_initiates')
      ).rejects.toBe(error);
      expect(mockHandleServiceError).toHaveBeenCalledWith(
        error,
        expect.objectContaining({
          component: 'applicationHistoryService',
          context: { applicationId: 'app-1' },
        })
      );
    });
  });

  describe('getOriginalApplicationData', () => {
    it('prefers original assignments when present', () => {
      const originalAssignments = [
        { roleIds: ['dealer'], dates: ['2025-01-20'], timeSlot: '18:00~02:00' },
      ];

      expect(
        getOriginalApplicationData(
          createApplication({
            originalApplication: { assignments: originalAssignments },
            assignments: [{ roleIds: ['floor'], dates: ['2025-01-21'], timeSlot: '09:00~17:00' }],
          }) as never
        )
      ).toBe(originalAssignments);
    });

    it('falls back to current assignments and then to an empty array', () => {
      const assignments = [{ roleIds: ['dealer'], dates: ['2025-01-20'], timeSlot: '18:00~02:00' }];

      expect(getOriginalApplicationData(createApplication({ assignments }) as never)).toBe(
        assignments
      );
      expect(getOriginalApplicationData({} as never)).toEqual([]);
    });
  });

  describe('getConfirmedSelections', () => {
    it('returns assignments from the active confirmation', () => {
      const assignments = [{ roleIds: ['dealer'], dates: ['2025-01-20'], timeSlot: '18:00~02:00' }];
      mockFindActiveConfirmation.mockReturnValue(createHistoryEntry({ assignments }) as never);

      expect(
        getConfirmedSelections(
          createApplication({
            confirmationHistory: [createHistoryEntry({ assignments })],
          }) as never
        )
      ).toBe(assignments);
    });

    it('returns an empty array when there is no active confirmation', () => {
      mockFindActiveConfirmation.mockReturnValue(null);
      expect(getConfirmedSelections(createApplication() as never)).toEqual([]);
    });
  });

  describe('isV2Application', () => {
    it('returns true only when assignments are present', () => {
      expect(isV2Application(createApplication() as never)).toBe(true);
      expect(isV2Application(createApplication({ assignments: [] }) as never)).toBe(false);
      expect(isV2Application({ assignments: undefined } as never)).toBe(false);
    });
  });

  describe('getApplicationHistorySummary', () => {
    it('builds a summary from repository data', async () => {
      const cancelledEntry = createHistoryEntry({
        cancelledAt: { seconds: 1700000500, nanoseconds: 0 },
      });
      const activeEntry = createHistoryEntry({
        confirmedAt: { seconds: 1700001000, nanoseconds: 0 },
      });
      mockApplicationRepository.getById.mockResolvedValue(
        createApplication({
          confirmationHistory: [cancelledEntry, activeEntry],
        }) as never
      );
      mockFindActiveConfirmation.mockReturnValue(activeEntry as never);

      const result = await getApplicationHistorySummary('app-1');

      expect(mockApplicationRepository.getById).toHaveBeenCalledWith('app-1');
      expect(result).toEqual({
        totalConfirmations: 2,
        cancellations: 1,
        isCurrentlyConfirmed: true,
        lastConfirmedAt: activeEntry.confirmedAt,
        lastCancelledAt: cancelledEntry.cancelledAt,
      });
    });

    it('returns null when the repository cannot find the application', async () => {
      mockApplicationRepository.getById.mockResolvedValue(null);

      await expect(getApplicationHistorySummary('missing')).resolves.toBeNull();
    });

    it('wraps unknown summary errors through handleServiceError', async () => {
      const error = new Error('summary failed');
      mockApplicationRepository.getById.mockRejectedValue(error);
      mockHandleServiceError.mockReturnValue(error as never);

      await expect(getApplicationHistorySummary('app-1')).rejects.toBe(error);
      expect(mockHandleServiceError).toHaveBeenCalledWith(
        error,
        expect.objectContaining({
          component: 'applicationHistoryService',
          context: { applicationId: 'app-1' },
        })
      );
    });
  });
});
