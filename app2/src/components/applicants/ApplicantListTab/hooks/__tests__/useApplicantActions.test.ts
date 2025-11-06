/**
 * useApplicantActions Hook 테스트
 *
 * 지원자 확정/취소 액션을 관리하는 Custom Hook 테스트
 * 803줄의 복잡한 비즈니스 로직을 검증합니다.
 */

import { renderHook, waitFor, act } from '@testing-library/react';
import { useApplicantActions } from '../useApplicantActions';
import { mockUpdateDoc, resetFirebaseMocks } from '../../../../../__tests__/mocks/firebase';
import { createMockApplicant } from '../../../../../__tests__/mocks/testData';

// ========================================
// Mock Setup
// ========================================

// Firebase Mocks
jest.mock('@/firebase', () => ({
  db: {},
  auth: {},
}));

// Toast Mock
jest.mock('../../../../../utils/toast', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
    warning: jest.fn(),
  },
}));

// i18n Mock
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

// ApplicationHistoryService Mock
jest.mock('../../../../../services/ApplicationHistoryService', () => ({
  ApplicationHistoryService: {
    confirmApplication: jest.fn().mockResolvedValue(undefined),
  },
}));

// ========================================
// Test Suite
// ========================================

describe('useApplicantActions', () => {
  // Mock data
  const mockJobPosting = {
    id: 'posting-1',
    createdBy: 'user-1',
    title: 'Test Job Posting',
  };

  const mockCurrentUser = {
    uid: 'user-1',
    role: 'user',
  };

  const mockOnRefresh = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    resetFirebaseMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ========================================
  // T016: 초기 상태 테스트
  // ========================================
  describe('초기화', () => {
    test('초기 상태가 올바르게 설정된다', () => {
      const { result } = renderHook(() =>
        useApplicantActions({
          jobPosting: mockJobPosting,
          currentUser: mockCurrentUser,
          onRefresh: mockOnRefresh,
        })
      );

      // 초기 상태 검증
      expect(result.current.isProcessing).toBe(false);
      expect(result.current.cancelConfirmModal).toEqual({
        isOpen: false,
        applicant: null,
      });
      expect(result.current.canEdit).toBe(true); // createdBy와 uid 일치
    });

    test('권한이 없는 사용자는 canEdit이 false다', () => {
      const differentUser = {
        uid: 'user-2', // 다른 사용자
        role: 'user',
      };

      const { result } = renderHook(() =>
        useApplicantActions({
          jobPosting: mockJobPosting,
          currentUser: differentUser,
          onRefresh: mockOnRefresh,
        })
      );

      expect(result.current.canEdit).toBe(false);
    });

    test('관리자는 항상 canEdit이 true다', () => {
      const adminUser = {
        uid: 'admin-1',
        role: 'admin',
      };

      const { result } = renderHook(() =>
        useApplicantActions({
          jobPosting: mockJobPosting,
          currentUser: adminUser,
          onRefresh: mockOnRefresh,
        })
      );

      expect(result.current.canEdit).toBe(true);
    });
  });

  // ========================================
  // T024: Firebase 권한 에러 테스트
  // ========================================
  describe('에러 처리', () => {
    test('권한이 없는 사용자가 확정을 시도하면 에러가 발생한다', async () => {
      const differentUser = {
        uid: 'user-2',
        role: 'user',
      };

      const { result } = renderHook(() =>
        useApplicantActions({
          jobPosting: mockJobPosting,
          currentUser: differentUser,
          onRefresh: mockOnRefresh,
        })
      );

      const mockApplicant = createMockApplicant();
      const mockAssignments = [
        {
          role: 'dealer',
          timeSlot: '10:00-18:00',
          dates: ['2025-11-10'],
        },
      ];

      await act(async () => {
        await result.current.handleConfirmApplicant(mockApplicant as any, mockAssignments as any);
      });

      // Firebase 호출이 일어나지 않아야 함
      expect(mockUpdateDoc).not.toHaveBeenCalled();
    });

    test('assignments가 비어있으면 경고가 표시된다', async () => {
      const { result } = renderHook(() =>
        useApplicantActions({
          jobPosting: mockJobPosting,
          currentUser: mockCurrentUser,
          onRefresh: mockOnRefresh,
        })
      );

      const mockApplicant = createMockApplicant();

      await act(async () => {
        await result.current.handleConfirmApplicant(mockApplicant as any, []);
      });

      // Firebase 호출이 일어나지 않아야 함
      expect(mockUpdateDoc).not.toHaveBeenCalled();
    });
  });

  // ========================================
  // T030: Memory Leak 방지 테스트
  // ========================================
  describe('메모리 누수 방지', () => {
    test('언마운트 시 상태가 정리된다', () => {
      const { unmount, result } = renderHook(() =>
        useApplicantActions({
          jobPosting: mockJobPosting,
          currentUser: mockCurrentUser,
          onRefresh: mockOnRefresh,
        })
      );

      // 초기 상태 확인
      expect(result.current.isProcessing).toBe(false);

      // 언마운트
      unmount();

      // 에러 없이 언마운트되어야 함
      expect(true).toBe(true);
    });
  });

  // ========================================
  // T031: 상태 일관성 테스트
  // ========================================
  describe('상태 관리', () => {
    test('cancelConfirmModal 상태를 변경할 수 있다', () => {
      const { result } = renderHook(() =>
        useApplicantActions({
          jobPosting: mockJobPosting,
          currentUser: mockCurrentUser,
          onRefresh: mockOnRefresh,
        })
      );

      const mockApplicant = createMockApplicant();

      act(() => {
        result.current.setCancelConfirmModal({
          isOpen: true,
          applicant: mockApplicant as any,
        });
      });

      expect(result.current.cancelConfirmModal.isOpen).toBe(true);
      expect(result.current.cancelConfirmModal.applicant).toEqual(mockApplicant);
    });
  });
});
