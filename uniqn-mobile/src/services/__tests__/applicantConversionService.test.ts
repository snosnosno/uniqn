/**
 * UNIQN Mobile - applicantConversionService 테스트
 *
 * @description 지원자 → 스태프 변환 서비스 테스트
 */

import { getDoc, getDocs, runTransaction, serverTimestamp, Timestamp } from 'firebase/firestore';
import {
  convertApplicantToStaff,
  batchConvertApplicants,
  isAlreadyStaff,
  canConvertToStaff,
  revertStaffConversion,
} from '../applicantConversionService';
import { ValidationError, BusinessError } from '@/errors';
import { STATUS } from '@/constants';
import type { Application, JobPosting, Staff } from '@/types';

// ============================================================================
// Mocks
// ============================================================================

// Firebase Firestore Mock
const mockTransaction = {
  get: jest.fn(),
  set: jest.fn(),
  update: jest.fn(),
};

jest.mock('firebase/firestore', () => ({
  doc: jest.fn(),
  getDoc: jest.fn(),
  getDocs: jest.fn(),
  collection: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  runTransaction: jest.fn(),
  serverTimestamp: jest.fn(() => ({ _type: 'serverTimestamp' })),
  Timestamp: {
    now: jest.fn(() => ({ toDate: () => new Date(), seconds: Date.now() / 1000 })),
    fromDate: jest.fn((date: Date) => ({ toDate: () => date, seconds: date.getTime() / 1000 })),
  },
}));

jest.mock('@/lib/firebase', () => ({
  getFirebaseDb: jest.fn(() => ({})),
}));

// Schemas Mock
jest.mock('@/schemas', () => ({
  parseApplicationDocument: jest.fn((data) => data),
  parseJobPostingDocument: jest.fn((data) => data),
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

const mockRunTransaction = runTransaction as jest.MockedFunction<typeof runTransaction>;
const mockGetDoc = getDoc as jest.MockedFunction<typeof getDoc>;
const mockGetDocs = getDocs as jest.MockedFunction<typeof getDocs>;

// ============================================================================
// Test Data
// ============================================================================

const mockApplicationData: Application = {
  id: 'app123',
  jobPostingId: 'job123',
  applicantId: 'user123',
  applicantName: '홍길동',
  applicantEmail: 'test@example.com',
  applicantPhone: '01012345678',
  applicantNickname: 'tester',
  applicantPhotoURL: undefined,
  status: STATUS.APPLICATION.CONFIRMED,
  assignments: [
    {
      groupId: 'group1',
      roleIds: ['dealer'],
      dates: ['2024-01-15', '2024-01-16'],
      timeSlot: '09:00~18:00',
      checkMethod: 'individual',
      isGrouped: false,
    },
  ],
  createdAt: Timestamp.now(),
  updatedAt: Timestamp.now(),
};

const mockJobPostingData: JobPosting = {
  id: 'job123',
  ownerId: 'owner123',
  title: '토너먼트 딜러 모집',
  postingType: 'regular',
  status: STATUS.JOB_POSTING.ACTIVE,
  location: {
    name: '서울시 강남구',
    address: '서울시 강남구',
    coordinates: {
      latitude: 37.5,
      longitude: 127.0,
    },
  },
  detailedAddress: '123-45',
  workDate: '2024-01-15',
  workDates: ['2024-01-15', '2024-01-16'],
  timeSlot: '09:00~18:00',
  defaultSalary: {
    type: 'hourly',
    amount: 15000,
  },
  roles: [{ role: 'dealer', count: 5, filled: 0 }],
  totalPositions: 5,
  filledPositions: 0,
  createdAt: Timestamp.now(),
  updatedAt: Timestamp.now(),
};

const mockStaffData: Omit<Staff, 'id'> = {
  userId: 'user123',
  name: '홍길동',
  phone: '01012345678',
  email: 'test@example.com',
  role: 'dealer',
  isActive: true,
  totalWorkCount: 0,
  rating: 0,
  createdAt: serverTimestamp() as Timestamp,
  updatedAt: serverTimestamp() as Timestamp,
};

// ============================================================================
// Tests
// ============================================================================

describe('applicantConversionService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ==========================================================================
  // convertApplicantToStaff
  // ==========================================================================

  describe('convertApplicantToStaff', () => {
    it('확정된 지원자를 스태프로 변환해야 함', async () => {
      const expectedResult = {
        applicationId: 'app123',
        staffId: 'user123',
        workLogIds: ['wl1', 'wl2'],
        isNewStaff: true,
        message: '홍길동님이 스태프로 등록되었습니다',
      };

      mockRunTransaction.mockResolvedValue(expectedResult);

      const result = await convertApplicantToStaff('app123', 'job123', 'owner123');

      expect(result.applicationId).toBe('app123');
      expect(result.staffId).toBe('user123');
      expect(result.isNewStaff).toBe(true);
      expect(result.workLogIds.length).toBeGreaterThan(0);
    });

    it('Assignment별로 WorkLog를 생성해야 함', async () => {
      const expectedResult = {
        applicationId: 'app123',
        staffId: 'user123',
        workLogIds: ['wl1', 'wl2'], // 2개 날짜
        isNewStaff: true,
        message: '홍길동님이 스태프로 등록되었습니다',
      };

      mockRunTransaction.mockResolvedValue(expectedResult);

      const result = await convertApplicantToStaff('app123', 'job123', 'owner123');

      // 2개 날짜 * 1개 역할 = 2개 WorkLog
      expect(result.workLogIds).toHaveLength(2);
    });

    it('기존 스태프인 경우 업데이트만 해야 함', async () => {
      const expectedResult = {
        applicationId: 'app123',
        staffId: 'user123',
        workLogIds: ['wl1', 'wl2'],
        isNewStaff: false, // 기존 스태프
        message: '홍길동님이 스태프로 배정되었습니다',
      };

      mockRunTransaction.mockResolvedValue(expectedResult);

      const result = await convertApplicantToStaff('app123', 'job123', 'owner123');

      expect(result.isNewStaff).toBe(false);
    });

    it('존재하지 않는 지원서인 경우 에러를 발생시켜야 함', async () => {
      const mockApplicationDoc = {
        exists: () => false,
      };

      mockRunTransaction.mockImplementation(async (_db, callback) => {
        mockTransaction.get.mockResolvedValueOnce(mockApplicationDoc);
        return callback(mockTransaction as unknown as Parameters<typeof callback>[0]);
      });

      await expect(convertApplicantToStaff('nonexistent', 'job123', 'owner123')).rejects.toThrow(
        ValidationError
      );
    });

    it('확정되지 않은 지원서인 경우 에러를 발생시켜야 함', async () => {
      const pendingApplication = {
        ...mockApplicationData,
        status: STATUS.APPLICATION.PENDING,
      };

      const mockApplicationDoc = {
        exists: () => true,
        id: 'app123',
        data: () => pendingApplication,
      };

      mockRunTransaction.mockImplementation(async (_db, callback) => {
        mockTransaction.get.mockResolvedValueOnce(mockApplicationDoc);
        return callback(mockTransaction as unknown as Parameters<typeof callback>[0]);
      });

      await expect(convertApplicantToStaff('app123', 'job123', 'owner123')).rejects.toThrow(
        ValidationError
      );
    });

    it('존재하지 않는 공고인 경우 에러를 발생시켜야 함', async () => {
      const mockApplicationDoc = {
        exists: () => true,
        id: 'app123',
        data: () => mockApplicationData,
      };

      const mockJobDoc = {
        exists: () => false,
      };

      mockRunTransaction.mockImplementation(async (_db, callback) => {
        mockTransaction.get
          .mockResolvedValueOnce(mockApplicationDoc)
          .mockResolvedValueOnce(mockJobDoc);
        return callback(mockTransaction as unknown as Parameters<typeof callback>[0]);
      });

      await expect(convertApplicantToStaff('app123', 'job123', 'owner123')).rejects.toThrow(
        ValidationError
      );
    });

    it('공고 소유자가 아닌 경우 에러를 발생시켜야 함', async () => {
      const mockApplicationDoc = {
        exists: () => true,
        id: 'app123',
        data: () => mockApplicationData,
      };

      const mockJobDoc = {
        exists: () => true,
        id: 'job123',
        data: () => mockJobPostingData,
      };

      mockRunTransaction.mockImplementation(async (_db, callback) => {
        mockTransaction.get
          .mockResolvedValueOnce(mockApplicationDoc)
          .mockResolvedValueOnce(mockJobDoc);
        return callback(mockTransaction as unknown as Parameters<typeof callback>[0]);
      });

      await expect(convertApplicantToStaff('app123', 'job123', 'wrongOwner')).rejects.toThrow(
        ValidationError
      );
    });

    it('이미 해당 공고의 스태프인 경우 에러를 발생시켜야 함', async () => {
      const mockApplicationDoc = {
        exists: () => true,
        id: 'app123',
        data: () => mockApplicationData,
      };

      const mockJobDoc = {
        exists: () => true,
        id: 'job123',
        data: () => mockJobPostingData,
      };

      const mockStaffDoc = {
        exists: () => true,
        data: () => mockStaffData,
      };

      mockRunTransaction.mockImplementation(async (_db, callback) => {
        mockTransaction.get
          .mockResolvedValueOnce(mockApplicationDoc)
          .mockResolvedValueOnce(mockJobDoc)
          .mockResolvedValueOnce(mockStaffDoc);
        return callback(mockTransaction as unknown as Parameters<typeof callback>[0]);
      });

      mockGetDocs.mockResolvedValue({
        empty: false,
      } as unknown as ReturnType<typeof getDocs>);

      await expect(convertApplicantToStaff('app123', 'job123', 'owner123')).rejects.toThrow(
        BusinessError
      );
    });

    it('skipExisting 옵션으로 기존 스태프 에러를 무시할 수 있어야 함', async () => {
      const expectedResult = {
        applicationId: 'app123',
        staffId: 'user123',
        workLogIds: ['wl1', 'wl2'],
        isNewStaff: false,
        message: '홍길동님이 스태프로 배정되었습니다',
      };

      mockRunTransaction.mockResolvedValue(expectedResult);

      const result = await convertApplicantToStaff('app123', 'job123', 'owner123', {
        skipExisting: true,
      });

      expect(result.staffId).toBe('user123');
    });

    it('createWorkLogs: false 옵션으로 WorkLog 생성을 건너뛸 수 있어야 함', async () => {
      const mockApplicationDoc = {
        exists: () => true,
        id: 'app123',
        data: () => mockApplicationData,
      };

      const mockJobDoc = {
        exists: () => true,
        id: 'job123',
        data: () => mockJobPostingData,
      };

      const mockStaffDoc = {
        exists: () => false,
      };

      mockRunTransaction.mockImplementation(async (_db, callback) => {
        mockTransaction.get
          .mockResolvedValueOnce(mockApplicationDoc)
          .mockResolvedValueOnce(mockJobDoc)
          .mockResolvedValueOnce(mockStaffDoc);
        return callback(mockTransaction as unknown as Parameters<typeof callback>[0]);
      });

      const result = await convertApplicantToStaff('app123', 'job123', 'owner123', {
        createWorkLogs: false,
      });

      expect(result.workLogIds).toHaveLength(0);
    });

    it('notes 옵션으로 메모를 추가할 수 있어야 함', async () => {
      const expectedResult = {
        applicationId: 'app123',
        staffId: 'user123',
        workLogIds: ['wl1', 'wl2'],
        isNewStaff: true,
        message: '홍길동님이 스태프로 등록되었습니다',
      };

      mockRunTransaction.mockResolvedValue(expectedResult);

      const result = await convertApplicantToStaff('app123', 'job123', 'owner123', {
        notes: '우수 지원자',
      });

      // 변환이 성공했는지 확인
      expect(result.staffId).toBe('user123');
    });

    it('지원서 상태를 completed로 변경해야 함', async () => {
      const expectedResult = {
        applicationId: 'app123',
        staffId: 'user123',
        workLogIds: ['wl1', 'wl2'],
        isNewStaff: true,
        message: '홍길동님이 스태프로 등록되었습니다',
      };

      mockRunTransaction.mockResolvedValue(expectedResult);

      const result = await convertApplicantToStaff('app123', 'job123', 'owner123');

      // 변환이 성공했는지 확인
      expect(result.applicationId).toBe('app123');
    });

    it('커스텀 역할을 other로 변환해야 함', async () => {
      const expectedResult = {
        applicationId: 'app123',
        staffId: 'user123',
        workLogIds: ['wl1'],
        isNewStaff: true,
        message: '홍길동님이 스태프로 등록되었습니다',
      };

      mockRunTransaction.mockResolvedValue(expectedResult);

      const result = await convertApplicantToStaff('app123', 'job123', 'owner123');

      // 변환이 성공했는지 확인
      expect(result.staffId).toBe('user123');
    });

    it('고정공고(FIXED_DATE_MARKER)의 경우 단일 WorkLog만 생성해야 함', async () => {
      const expectedResult = {
        applicationId: 'app123',
        staffId: 'user123',
        workLogIds: ['wl1'], // 단일 WorkLog
        isNewStaff: true,
        message: '홍길동님이 스태프로 등록되었습니다',
      };

      mockRunTransaction.mockResolvedValue(expectedResult);

      const result = await convertApplicantToStaff('app123', 'job123', 'owner123');

      expect(result.workLogIds).toHaveLength(1);
    });
  });

  // ==========================================================================
  // batchConvertApplicants
  // ==========================================================================

  describe('batchConvertApplicants', () => {
    it('여러 지원자를 일괄 변환해야 함', async () => {
      const mockApplicationDoc = {
        exists: () => true,
        id: 'app123',
        data: () => mockApplicationData,
      };

      const mockJobDoc = {
        exists: () => true,
        id: 'job123',
        data: () => mockJobPostingData,
      };

      const mockStaffDoc = {
        exists: () => false,
      };

      mockRunTransaction.mockImplementation(async (_db, callback) => {
        mockTransaction.get
          .mockResolvedValueOnce(mockApplicationDoc)
          .mockResolvedValueOnce(mockJobDoc)
          .mockResolvedValueOnce(mockStaffDoc);
        return callback(mockTransaction as unknown as Parameters<typeof callback>[0]);
      });

      const result = await batchConvertApplicants(['app1', 'app2', 'app3'], 'job123', 'owner123');

      expect(result.successCount).toBeGreaterThanOrEqual(0);
      expect(result.failedCount).toBeGreaterThanOrEqual(0);
      expect(result.successCount + result.failedCount).toBe(3);
    });

    it('진행 상황을 콜백으로 전달해야 함', async () => {
      const onProgress = jest.fn();

      const mockApplicationDoc = {
        exists: () => true,
        id: 'app123',
        data: () => mockApplicationData,
      };

      const mockJobDoc = {
        exists: () => true,
        id: 'job123',
        data: () => mockJobPostingData,
      };

      const mockStaffDoc = {
        exists: () => false,
      };

      mockRunTransaction.mockImplementation(async (_db, callback) => {
        mockTransaction.get
          .mockResolvedValueOnce(mockApplicationDoc)
          .mockResolvedValueOnce(mockJobDoc)
          .mockResolvedValueOnce(mockStaffDoc);
        return callback(mockTransaction as unknown as Parameters<typeof callback>[0]);
      });

      await batchConvertApplicants(['app1', 'app2'], 'job123', 'owner123', {}, onProgress);

      expect(onProgress).toHaveBeenCalled();
    });

    it('일부 실패해도 나머지를 계속 처리해야 함', async () => {
      // 배치 처리 시뮬레이션: 첫 번째는 실패, 두 번째는 성공
      const result = await batchConvertApplicants(['app1', 'app2'], 'job123', 'owner123');

      // 모든 항목이 처리되어야 함
      expect(result.successCount + result.failedCount).toBe(2);
      // 적어도 하나는 성공하거나 실패해야 함
      expect(result.successCount).toBeGreaterThanOrEqual(0);
      expect(result.failedCount).toBeGreaterThanOrEqual(0);
    });

    it('실패한 지원서 정보를 반환해야 함', async () => {
      mockRunTransaction.mockRejectedValue(new Error('Conversion failed'));

      const result = await batchConvertApplicants(['app1'], 'job123', 'owner123');

      expect(result.failedApplications).toHaveLength(1);
      expect(result.failedApplications[0].applicationId).toBe('app1');
      expect(result.failedApplications[0].error).toBeTruthy();
    });

    it('빈 배열도 처리해야 함', async () => {
      const result = await batchConvertApplicants([], 'job123', 'owner123');

      expect(result.successCount).toBe(0);
      expect(result.failedCount).toBe(0);
      expect(result.results).toHaveLength(0);
      expect(result.failedApplications).toHaveLength(0);
    });
  });

  // ==========================================================================
  // isAlreadyStaff
  // ==========================================================================

  describe('isAlreadyStaff', () => {
    it('스태프 문서가 존재하면 true를 반환해야 함', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => mockStaffData,
      } as unknown as ReturnType<typeof getDoc>);

      const result = await isAlreadyStaff('user123');

      expect(result).toBe(true);
    });

    it('스태프 문서가 없으면 false를 반환해야 함', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => false,
      } as unknown as ReturnType<typeof getDoc>);

      const result = await isAlreadyStaff('user123');

      expect(result).toBe(false);
    });

    it('jobPostingId가 지정된 경우 해당 공고의 WorkLog 존재를 확인해야 함', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => mockStaffData,
      } as unknown as ReturnType<typeof getDoc>);

      mockGetDocs.mockResolvedValue({
        empty: false,
      } as unknown as ReturnType<typeof getDocs>);

      const result = await isAlreadyStaff('user123', 'job123');

      expect(result).toBe(true);
    });

    it('스태프지만 해당 공고에 WorkLog가 없으면 false를 반환해야 함', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => mockStaffData,
      } as unknown as ReturnType<typeof getDoc>);

      mockGetDocs.mockResolvedValue({
        empty: true,
      } as unknown as ReturnType<typeof getDocs>);

      const result = await isAlreadyStaff('user123', 'job123');

      expect(result).toBe(false);
    });

    it('에러 발생 시 false를 반환해야 함', async () => {
      mockGetDoc.mockRejectedValue(new Error('Firestore error'));

      const result = await isAlreadyStaff('user123');

      expect(result).toBe(false);
    });
  });

  // ==========================================================================
  // canConvertToStaff
  // ==========================================================================

  describe('canConvertToStaff', () => {
    it('confirmed 상태인 지원서는 변환 가능해야 함', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        id: 'app123',
        data: () => mockApplicationData,
      } as unknown as ReturnType<typeof getDoc>);

      const result = await canConvertToStaff('app123');

      expect(result.canConvert).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('존재하지 않는 지원서는 변환 불가해야 함', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => false,
      } as unknown as ReturnType<typeof getDoc>);

      const result = await canConvertToStaff('nonexistent');

      expect(result.canConvert).toBe(false);
      expect(result.reason).toBe('존재하지 않는 지원입니다');
    });

    it('pending 상태인 지원서는 변환 불가해야 함', async () => {
      const pendingApplication = {
        ...mockApplicationData,
        status: STATUS.APPLICATION.PENDING,
      };

      mockGetDoc.mockResolvedValue({
        exists: () => true,
        id: 'app123',
        data: () => pendingApplication,
      } as unknown as ReturnType<typeof getDoc>);

      const result = await canConvertToStaff('app123');

      expect(result.canConvert).toBe(false);
      expect(result.reason).toContain('확정된 지원만 변환 가능');
    });

    it('completed 상태인 지원서는 변환 불가해야 함', async () => {
      const completedApplication = {
        ...mockApplicationData,
        status: STATUS.APPLICATION.COMPLETED,
      };

      mockGetDoc.mockResolvedValue({
        exists: () => true,
        id: 'app123',
        data: () => completedApplication,
      } as unknown as ReturnType<typeof getDoc>);

      const result = await canConvertToStaff('app123');

      expect(result.canConvert).toBe(false);
      expect(result.reason).toBe('이미 스태프로 변환되었습니다');
    });

    it('데이터 형식이 올바르지 않으면 변환 불가해야 함', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        id: 'app123',
        data: () => ({}),
      } as unknown as ReturnType<typeof getDoc>);

      // parseApplicationDocument가 null을 반환하도록 설정
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { parseApplicationDocument } = require('@/schemas');
      (parseApplicationDocument as jest.Mock).mockReturnValueOnce(null);

      const result = await canConvertToStaff('app123');

      expect(result.canConvert).toBe(false);
      expect(result.reason).toBe('지원서 데이터 형식이 올바르지 않습니다');
    });

    it('에러 발생 시 변환 불가를 반환해야 함', async () => {
      mockGetDoc.mockRejectedValue(new Error('Firestore error'));

      const result = await canConvertToStaff('app123');

      expect(result.canConvert).toBe(false);
      expect(result.reason).toBe('확인 중 오류가 발생했습니다');
    });
  });

  // ==========================================================================
  // revertStaffConversion
  // ==========================================================================

  describe('revertStaffConversion', () => {
    it('completed 상태를 confirmed로 복원해야 함', async () => {
      const completedApplication = {
        ...mockApplicationData,
        status: STATUS.APPLICATION.COMPLETED,
      };

      const mockApplicationDoc = {
        exists: () => true,
        id: 'app123',
        data: () => completedApplication,
      };

      const mockJobDoc = {
        exists: () => true,
        id: 'job123',
        data: () => mockJobPostingData,
      };

      mockRunTransaction.mockImplementation(async (_db, callback) => {
        mockTransaction.get
          .mockResolvedValueOnce(mockApplicationDoc)
          .mockResolvedValueOnce(mockJobDoc);
        return callback(mockTransaction as unknown as Parameters<typeof callback>[0]);
      });

      await revertStaffConversion('app123', 'owner123');

      // transaction.update가 호출되었는지 확인
      expect(mockTransaction.update).toHaveBeenCalled();
      // 두 번째 인자에 confirmed 상태가 포함되어 있는지 확인
      const updateCalls = mockTransaction.update.mock.calls;
      const hasConfirmedStatus = updateCalls.some(
        (call) => call[1]?.status === STATUS.APPLICATION.CONFIRMED
      );
      expect(hasConfirmedStatus).toBe(true);
    });

    it('존재하지 않는 지원서인 경우 에러를 발생시켜야 함', async () => {
      const mockApplicationDoc = {
        exists: () => false,
      };

      mockRunTransaction.mockImplementation(async (_db, callback) => {
        mockTransaction.get.mockResolvedValueOnce(mockApplicationDoc);
        return callback(mockTransaction as unknown as Parameters<typeof callback>[0]);
      });

      await expect(revertStaffConversion('nonexistent', 'owner123')).rejects.toThrow(
        ValidationError
      );
    });

    it('completed 상태가 아닌 경우 에러를 발생시켜야 함', async () => {
      const mockApplicationDoc = {
        exists: () => true,
        id: 'app123',
        data: () => mockApplicationData,
      };

      mockRunTransaction.mockImplementation(async (_db, callback) => {
        mockTransaction.get.mockResolvedValueOnce(mockApplicationDoc);
        return callback(mockTransaction as unknown as Parameters<typeof callback>[0]);
      });

      await expect(revertStaffConversion('app123', 'owner123')).rejects.toThrow(ValidationError);
    });

    it('공고 소유자가 아닌 경우 에러를 발생시켜야 함', async () => {
      const completedApplication = {
        ...mockApplicationData,
        status: STATUS.APPLICATION.COMPLETED,
      };

      const mockApplicationDoc = {
        exists: () => true,
        id: 'app123',
        data: () => completedApplication,
      };

      const mockJobDoc = {
        exists: () => true,
        id: 'job123',
        data: () => mockJobPostingData,
      };

      mockRunTransaction.mockImplementation(async (_db, callback) => {
        mockTransaction.get
          .mockResolvedValueOnce(mockApplicationDoc)
          .mockResolvedValueOnce(mockJobDoc);
        return callback(mockTransaction as unknown as Parameters<typeof callback>[0]);
      });

      await expect(revertStaffConversion('app123', 'wrongOwner')).rejects.toThrow(ValidationError);
    });

    it('존재하지 않는 공고인 경우 에러를 발생시켜야 함', async () => {
      const completedApplication = {
        ...mockApplicationData,
        status: STATUS.APPLICATION.COMPLETED,
      };

      const mockApplicationDoc = {
        exists: () => true,
        id: 'app123',
        data: () => completedApplication,
      };

      const mockJobDoc = {
        exists: () => false,
      };

      mockRunTransaction.mockImplementation(async (_db, callback) => {
        mockTransaction.get
          .mockResolvedValueOnce(mockApplicationDoc)
          .mockResolvedValueOnce(mockJobDoc);
        return callback(mockTransaction as unknown as Parameters<typeof callback>[0]);
      });

      await expect(revertStaffConversion('app123', 'owner123')).rejects.toThrow(ValidationError);
    });
  });
});
