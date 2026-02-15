/**
 * UNIQN Mobile - accountDeletionService 테스트
 *
 * @description 회원탈퇴 및 개인정보 관리 서비스 테스트
 */

import { Timestamp } from 'firebase/firestore';
import { reauthenticateWithCredential } from 'firebase/auth';
import { getFirebaseAuth } from '@/lib/firebase';
import {
  requestAccountDeletion,
  cancelAccountDeletion,
  getMyData,
  updateMyData,
  exportMyData,
  permanentlyDeleteAccount,
  getDeletionStatus,
  DELETION_REASONS,
} from '../accountDeletionService';
import { AuthError } from '@/errors';
import { STATUS } from '@/constants';
import type { FirestoreUserProfile } from '@/types';
import type { DeletionRequest, UserDataExport } from '@/repositories';

// ============================================================================
// Mocks
// ============================================================================

// Firebase Auth Mock
jest.mock('@/lib/firebase', () => ({
  getFirebaseAuth: jest.fn(),
}));

jest.mock('firebase/auth', () => ({
  reauthenticateWithCredential: jest.fn(),
  EmailAuthProvider: {
    credential: jest.fn((email, password) => ({ email, password })),
  },
}));

// Repository Mock
const mockGetById = jest.fn();
const mockUpdateProfile = jest.fn();
const mockRequestDeletion = jest.fn();
const mockCancelDeletion = jest.fn();
const mockGetExportData = jest.fn();
const mockPermanentlyDeleteWithBatch = jest.fn();
const mockGetDeletionStatus = jest.fn();

jest.mock('@/repositories', () => ({
  userRepository: {
    getById: (...args: unknown[]) => mockGetById(...args),
    updateProfile: (...args: unknown[]) => mockUpdateProfile(...args),
    requestDeletion: (...args: unknown[]) => mockRequestDeletion(...args),
    cancelDeletion: (...args: unknown[]) => mockCancelDeletion(...args),
    getExportData: (...args: unknown[]) => mockGetExportData(...args),
    permanentlyDeleteWithBatch: (...args: unknown[]) => mockPermanentlyDeleteWithBatch(...args),
    getDeletionStatus: (...args: unknown[]) => mockGetDeletionStatus(...args),
  },
}));

// Logger Mock
jest.mock('@/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    appError: jest.fn(),
  },
}));

const mockGetFirebaseAuth = getFirebaseAuth as jest.MockedFunction<typeof getFirebaseAuth>;
const mockReauthenticateWithCredential = reauthenticateWithCredential as jest.MockedFunction<
  typeof reauthenticateWithCredential
>;

const mockCurrentUser = {
  uid: 'user123',
  email: 'test@example.com',
};

const mockAuth = {
  currentUser: mockCurrentUser,
};

// ============================================================================
// Test Data
// ============================================================================

const mockUserProfile: FirestoreUserProfile = {
  uid: 'user123',
  email: 'test@example.com',
  photoURL: undefined,
  role: 'staff',
  name: '홍길동',
  nickname: 'tester',
  phone: '01012345678',
  createdAt: Timestamp.now(),
  updatedAt: Timestamp.now(),
};

const mockDeletionRequest: DeletionRequest = {
  userId: 'user123',
  reason: 'no_longer_needed',
  reasonDetail: '더 이상 사용하지 않아요',
  requestedAt: Timestamp.now(),
  scheduledDeletionAt: Timestamp.fromDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)),
  status: STATUS.DELETION_REQUEST.PENDING,
};

const mockExportData: UserDataExport = {
  profile: mockUserProfile,
  applications: [
    {
      id: 'app1',
      jobPostingTitle: '토너먼트 딜러',
      status: 'confirmed',
      createdAt: '2024-01-01T00:00:00Z',
    },
  ],
  workLogs: [
    {
      id: 'wl1',
      date: '2024-01-15',
      checkInAt: '09:00',
      checkOutAt: '18:00',
    },
  ],
  exportedAt: new Date().toISOString(),
};

// ============================================================================
// Tests
// ============================================================================

describe('accountDeletionService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetFirebaseAuth.mockReturnValue(mockAuth as unknown as ReturnType<typeof getFirebaseAuth>);
    mockGetById.mockReset();
    mockUpdateProfile.mockReset();
    mockRequestDeletion.mockReset();
    mockCancelDeletion.mockReset();
    mockGetExportData.mockReset();
    mockPermanentlyDeleteWithBatch.mockReset();
    mockGetDeletionStatus.mockReset();
  });

  // ==========================================================================
  // DELETION_REASONS
  // ==========================================================================

  describe('DELETION_REASONS', () => {
    it('모든 탈퇴 사유가 한글 레이블을 가져야 함', () => {
      const reasons = Object.keys(DELETION_REASONS);
      expect(reasons.length).toBeGreaterThan(0);

      reasons.forEach((key) => {
        expect(DELETION_REASONS[key as keyof typeof DELETION_REASONS]).toBeTruthy();
        expect(typeof DELETION_REASONS[key as keyof typeof DELETION_REASONS]).toBe('string');
      });
    });

    it('필수 탈퇴 사유들이 포함되어야 함', () => {
      expect(DELETION_REASONS.no_longer_needed).toBe('더 이상 서비스를 이용하지 않아요');
      expect(DELETION_REASONS.found_better_service).toBe('다른 서비스를 이용하게 되었어요');
      expect(DELETION_REASONS.privacy_concerns).toBe('개인정보가 걱정돼요');
      expect(DELETION_REASONS.too_many_notifications).toBe('알림이 너무 많아요');
      expect(DELETION_REASONS.difficult_to_use).toBe('사용하기 어려워요');
      expect(DELETION_REASONS.other).toBe('기타');
    });
  });

  // ==========================================================================
  // requestAccountDeletion
  // ==========================================================================

  describe('requestAccountDeletion', () => {
    it('비밀번호 재인증 후 탈퇴 요청을 처리해야 함', async () => {
      mockReauthenticateWithCredential.mockResolvedValue(undefined as never);
      mockRequestDeletion.mockResolvedValue(undefined);

      const result = await requestAccountDeletion('no_longer_needed', 'password123');

      expect(mockReauthenticateWithCredential).toHaveBeenCalled();
      expect(mockRequestDeletion).toHaveBeenCalledWith(
        'user123',
        expect.objectContaining({
          reason: 'no_longer_needed',
          status: STATUS.DELETION_REQUEST.PENDING,
        })
      );
      expect(result.userId).toBe('user123');
      expect(result.reason).toBe('no_longer_needed');
    });

    it('상세 사유와 함께 탈퇴 요청을 처리해야 함', async () => {
      mockReauthenticateWithCredential.mockResolvedValue(undefined as never);
      mockRequestDeletion.mockResolvedValue(undefined);

      const reasonDetail = '개인적인 사정으로 탈퇴합니다';
      const result = await requestAccountDeletion('other', 'password123', reasonDetail);

      expect(mockRequestDeletion).toHaveBeenCalledWith(
        'user123',
        expect.objectContaining({
          reason: 'other',
          reasonDetail,
        })
      );
      expect(result.reasonDetail).toBe(reasonDetail);
    });

    it('30일 유예 기간을 설정해야 함', async () => {
      mockReauthenticateWithCredential.mockResolvedValue(undefined as never);
      mockRequestDeletion.mockResolvedValue(undefined);

      const result = await requestAccountDeletion('no_longer_needed', 'password123');

      const scheduledDate = result.scheduledDeletionAt.toDate();
      const expectedDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      const diffInDays =
        Math.abs(scheduledDate.getTime() - expectedDate.getTime()) / (1000 * 60 * 60 * 24);

      expect(diffInDays).toBeLessThan(1); // 1일 이내 차이 허용
    });

    it('로그인하지 않은 경우 에러를 발생시켜야 함', async () => {
      mockGetFirebaseAuth.mockReturnValue({
        currentUser: null,
      } as unknown as ReturnType<typeof getFirebaseAuth>);

      await expect(requestAccountDeletion('no_longer_needed', 'password123')).rejects.toThrow(
        AuthError
      );
    });

    it('이메일이 없는 경우 에러를 발생시켜야 함', async () => {
      mockGetFirebaseAuth.mockReturnValue({
        currentUser: { uid: 'user123', email: null },
      } as unknown as ReturnType<typeof getFirebaseAuth>);

      await expect(requestAccountDeletion('no_longer_needed', 'password123')).rejects.toThrow(
        AuthError
      );
    });

    it('잘못된 비밀번호 입력 시 AuthError를 발생시켜야 함', async () => {
      const wrongPasswordError = new Error('Wrong password');
      (wrongPasswordError as { code?: string }).code = 'auth/wrong-password';
      mockReauthenticateWithCredential.mockRejectedValue(wrongPasswordError);

      await expect(requestAccountDeletion('no_longer_needed', 'wrongpassword')).rejects.toThrow(
        AuthError
      );
    });

    it('재인증 실패 시 적절한 에러 메시지를 포함해야 함', async () => {
      const wrongPasswordError = new Error('Wrong password');
      (wrongPasswordError as { code?: string }).code = 'auth/wrong-password';
      mockReauthenticateWithCredential.mockRejectedValue(wrongPasswordError);

      await expect(requestAccountDeletion('no_longer_needed', 'wrongpassword')).rejects.toThrow(
        '비밀번호가 올바르지 않습니다'
      );
    });

    it('Repository 에러를 올바르게 처리해야 함', async () => {
      mockReauthenticateWithCredential.mockResolvedValue(undefined as never);
      mockRequestDeletion.mockRejectedValue(new Error('Repository error'));

      await expect(requestAccountDeletion('no_longer_needed', 'password123')).rejects.toThrow();
    });

    it('모든 탈퇴 사유 타입을 지원해야 함', async () => {
      mockReauthenticateWithCredential.mockResolvedValue(undefined as never);
      mockRequestDeletion.mockResolvedValue(undefined);

      const reasons = Object.keys(DELETION_REASONS);
      for (const reason of reasons) {
        const result = await requestAccountDeletion(
          reason as keyof typeof DELETION_REASONS,
          'password123'
        );
        expect(result.reason).toBe(reason);
      }
    });
  });

  // ==========================================================================
  // cancelAccountDeletion
  // ==========================================================================

  describe('cancelAccountDeletion', () => {
    it('탈퇴 요청을 취소해야 함', async () => {
      mockCancelDeletion.mockResolvedValue(undefined);

      await cancelAccountDeletion('user123');

      expect(mockCancelDeletion).toHaveBeenCalledWith('user123');
    });

    it('Repository 에러를 올바르게 처리해야 함', async () => {
      mockCancelDeletion.mockRejectedValue(new Error('Cancel failed'));

      await expect(cancelAccountDeletion('user123')).rejects.toThrow();
    });

    it('다른 사용자 ID로도 취소 가능해야 함', async () => {
      mockCancelDeletion.mockResolvedValue(undefined);

      await cancelAccountDeletion('differentUser456');

      expect(mockCancelDeletion).toHaveBeenCalledWith('differentUser456');
    });
  });

  // ==========================================================================
  // getMyData
  // ==========================================================================

  describe('getMyData', () => {
    it('사용자 프로필을 조회해야 함', async () => {
      mockGetById.mockResolvedValue(mockUserProfile);

      const result = await getMyData('user123');

      expect(mockGetById).toHaveBeenCalledWith('user123');
      expect(result).toEqual(mockUserProfile);
    });

    it('존재하지 않는 사용자의 경우 null을 반환해야 함', async () => {
      mockGetById.mockResolvedValue(null);

      const result = await getMyData('nonexistent');

      expect(result).toBeNull();
    });

    it('Repository 에러를 올바르게 처리해야 함', async () => {
      mockGetById.mockRejectedValue(new Error('Get failed'));

      await expect(getMyData('user123')).rejects.toThrow();
    });
  });

  // ==========================================================================
  // updateMyData
  // ==========================================================================

  describe('updateMyData', () => {
    it('닉네임을 수정해야 함', async () => {
      mockUpdateProfile.mockResolvedValue(undefined);

      await updateMyData('user123', { nickname: '새닉네임' });

      expect(mockUpdateProfile).toHaveBeenCalledWith('user123', {
        nickname: '새닉네임',
      });
    });

    it('여러 필드를 동시에 수정해야 함', async () => {
      mockUpdateProfile.mockResolvedValue(undefined);

      const updates = {
        nickname: '새닉네임',
        photoURL: 'https://example.com/photo.jpg',
      };

      await updateMyData('user123', updates);

      expect(mockUpdateProfile).toHaveBeenCalledWith('user123', updates);
    });

    it('빈 업데이트도 처리해야 함', async () => {
      mockUpdateProfile.mockResolvedValue(undefined);

      await updateMyData('user123', {});

      expect(mockUpdateProfile).toHaveBeenCalledWith('user123', {});
    });

    it('Repository 에러를 올바르게 처리해야 함', async () => {
      mockUpdateProfile.mockRejectedValue(new Error('Update failed'));

      await expect(updateMyData('user123', { nickname: '새닉네임' })).rejects.toThrow();
    });
  });

  // ==========================================================================
  // exportMyData
  // ==========================================================================

  describe('exportMyData', () => {
    it('사용자 데이터를 내보내야 함', async () => {
      mockGetExportData.mockResolvedValue(mockExportData);

      const result = await exportMyData('user123');

      expect(mockGetExportData).toHaveBeenCalledWith('user123');
      expect(result).toEqual(mockExportData);
    });

    it('프로필 정보를 포함해야 함', async () => {
      mockGetExportData.mockResolvedValue(mockExportData);

      const result = await exportMyData('user123');

      expect(result.profile).toBeDefined();
      expect(result.profile.uid).toBe('user123');
    });

    it('지원 내역을 포함해야 함', async () => {
      mockGetExportData.mockResolvedValue(mockExportData);

      const result = await exportMyData('user123');

      expect(result.applications).toBeDefined();
      expect(Array.isArray(result.applications)).toBe(true);
    });

    it('근무 기록을 포함해야 함', async () => {
      mockGetExportData.mockResolvedValue(mockExportData);

      const result = await exportMyData('user123');

      expect(result.workLogs).toBeDefined();
      expect(Array.isArray(result.workLogs)).toBe(true);
    });

    it('내보낸 시간을 포함해야 함', async () => {
      mockGetExportData.mockResolvedValue(mockExportData);

      const result = await exportMyData('user123');

      expect(result.exportedAt).toBeDefined();
    });

    it('데이터가 없는 사용자도 처리해야 함', async () => {
      const emptyExportData: UserDataExport = {
        profile: mockUserProfile,
        applications: [],
        workLogs: [],
        exportedAt: new Date().toISOString(),
      };
      mockGetExportData.mockResolvedValue(emptyExportData);

      const result = await exportMyData('user123');

      expect(result.applications).toHaveLength(0);
      expect(result.workLogs).toHaveLength(0);
    });

    it('Repository 에러를 올바르게 처리해야 함', async () => {
      mockGetExportData.mockRejectedValue(new Error('Export failed'));

      await expect(exportMyData('user123')).rejects.toThrow();
    });
  });

  // ==========================================================================
  // permanentlyDeleteAccount
  // ==========================================================================

  describe('permanentlyDeleteAccount', () => {
    it('계정을 완전히 삭제해야 함', async () => {
      mockPermanentlyDeleteWithBatch.mockResolvedValue(undefined);

      await permanentlyDeleteAccount('user123');

      expect(mockPermanentlyDeleteWithBatch).toHaveBeenCalledWith('user123');
    });

    it('Repository 에러를 올바르게 처리해야 함', async () => {
      mockPermanentlyDeleteWithBatch.mockRejectedValue(new Error('Delete failed'));

      await expect(permanentlyDeleteAccount('user123')).rejects.toThrow();
    });

    it('다른 사용자 ID로도 삭제 가능해야 함', async () => {
      mockPermanentlyDeleteWithBatch.mockResolvedValue(undefined);

      await permanentlyDeleteAccount('anotherUser789');

      expect(mockPermanentlyDeleteWithBatch).toHaveBeenCalledWith('anotherUser789');
    });
  });

  // ==========================================================================
  // getDeletionStatus
  // ==========================================================================

  describe('getDeletionStatus', () => {
    it('탈퇴 요청 상태를 조회해야 함', async () => {
      mockGetDeletionStatus.mockResolvedValue(mockDeletionRequest);

      const result = await getDeletionStatus('user123');

      expect(mockGetDeletionStatus).toHaveBeenCalledWith('user123');
      expect(result).toEqual(mockDeletionRequest);
    });

    it('탈퇴 요청이 없는 경우 null을 반환해야 함', async () => {
      mockGetDeletionStatus.mockResolvedValue(null);

      const result = await getDeletionStatus('user123');

      expect(result).toBeNull();
    });

    it('pending 상태를 올바르게 반환해야 함', async () => {
      const pendingRequest = {
        ...mockDeletionRequest,
        status: STATUS.DELETION_REQUEST.PENDING,
      } as DeletionRequest;
      mockGetDeletionStatus.mockResolvedValue(pendingRequest);

      const result = await getDeletionStatus('user123');

      expect(result?.status).toBe(STATUS.DELETION_REQUEST.PENDING);
    });

    it('cancelled 상태를 올바르게 반환해야 함', async () => {
      const cancelledRequest = {
        ...mockDeletionRequest,
        status: STATUS.DELETION_REQUEST.CANCELLED,
      } as DeletionRequest;
      mockGetDeletionStatus.mockResolvedValue(cancelledRequest);

      const result = await getDeletionStatus('user123');

      expect(result?.status).toBe(STATUS.DELETION_REQUEST.CANCELLED);
    });

    it('completed 상태를 올바르게 반환해야 함', async () => {
      const completedRequest = {
        ...mockDeletionRequest,
        status: STATUS.DELETION_REQUEST.COMPLETED,
      } as DeletionRequest;
      mockGetDeletionStatus.mockResolvedValue(completedRequest);

      const result = await getDeletionStatus('user123');

      expect(result?.status).toBe(STATUS.DELETION_REQUEST.COMPLETED);
    });

    it('Repository 에러를 올바르게 처리해야 함', async () => {
      mockGetDeletionStatus.mockRejectedValue(new Error('Status check failed'));

      await expect(getDeletionStatus('user123')).rejects.toThrow();
    });
  });
});
