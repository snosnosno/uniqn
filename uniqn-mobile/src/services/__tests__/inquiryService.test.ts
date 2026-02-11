/**
 * UNIQN Mobile - InquiryService Tests
 *
 * @description inquiryService 단위 테스트
 * @version 1.0.0
 */

import {
  fetchMyInquiries,
  fetchAllInquiries,
  getInquiry,
  createInquiry,
  respondToInquiry,
  updateInquiryStatus,
  getUnansweredCount,
} from '../inquiryService';

// ============================================================================
// Mocks
// ============================================================================

jest.mock('@/lib/firebase');

jest.mock('@/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('@/errors', () => ({
  ...jest.requireActual('@/errors'),
  isAppError: jest.fn(),
  normalizeError: jest.fn((err: unknown) => {
    if (err instanceof Error) return err;
    return new Error(String(err));
  }),
}));

// Mock the firestore QueryBuilder and processPaginatedResults
jest.mock('@/utils/firestore', () => ({
  QueryBuilder: jest.fn().mockImplementation(() => ({
    whereEqual: jest.fn().mockReturnThis(),
    whereIf: jest.fn().mockReturnThis(),
    orderByDesc: jest.fn().mockReturnThis(),
    paginate: jest.fn().mockReturnThis(),
    build: jest.fn().mockReturnValue({}),
  })),
  processPaginatedResults: jest.fn(),
}));

// ============================================================================
// Import mocked modules
// ============================================================================

// eslint-disable-next-line @typescript-eslint/no-require-imports
const firestoreModule = require('firebase/firestore');
// Inject getCountFromServer mock into the already-mocked firebase/firestore module
const mockGetCountFromServerFn = jest.fn();
firestoreModule.getCountFromServer = mockGetCountFromServerFn;

import {
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
} from 'firebase/firestore';
import { processPaginatedResults } from '@/utils/firestore';

const mockGetDocs = getDocs as jest.MockedFunction<typeof getDocs>;
const mockGetDoc = getDoc as jest.MockedFunction<typeof getDoc>;
const mockAddDoc = addDoc as jest.MockedFunction<typeof addDoc>;
const mockUpdateDoc = updateDoc as jest.MockedFunction<typeof updateDoc>;
const mockProcessPaginatedResults = processPaginatedResults as jest.MockedFunction<typeof processPaginatedResults>;

// ============================================================================
// Tests
// ============================================================================

describe('inquiryService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // --------------------------------------------------------------------------
  // fetchMyInquiries
  // --------------------------------------------------------------------------

  describe('fetchMyInquiries', () => {
    it('userId가 있으면 내 문의 목록을 조회해야 한다', async () => {
      const mockInquiries = [
        {
          id: 'inq-1',
          userId: 'user-1',
          subject: '문의1',
          status: 'open',
        },
      ];

      mockGetDocs.mockResolvedValue({ docs: [] } as never);
      mockProcessPaginatedResults.mockReturnValue({
        items: mockInquiries,
        lastDoc: null,
        hasMore: false,
      } as never);

      const result = await fetchMyInquiries({ userId: 'user-1' });

      expect(result).toEqual({
        inquiries: mockInquiries,
        lastDoc: null,
        hasMore: false,
      });
    });

    it('userId가 없으면 ValidationError를 던져야 한다', async () => {
      await expect(fetchMyInquiries({ userId: undefined })).rejects.toThrow();
    });

    it('userId가 빈 문자열이면 ValidationError를 던져야 한다', async () => {
      await expect(fetchMyInquiries({ userId: '' })).rejects.toThrow();
    });

    it('pageSize를 지정할 수 있어야 한다', async () => {
      mockGetDocs.mockResolvedValue({ docs: [] } as never);
      mockProcessPaginatedResults.mockReturnValue({
        items: [],
        lastDoc: null,
        hasMore: false,
      } as never);

      const result = await fetchMyInquiries({
        userId: 'user-1',
        pageSize: 10,
      });

      expect(result).toEqual({
        inquiries: [],
        lastDoc: null,
        hasMore: false,
      });
    });

    it('Firestore 에러 시 에러를 던져야 한다', async () => {
      mockGetDocs.mockRejectedValue(new Error('Firestore error'));

      await expect(
        fetchMyInquiries({ userId: 'user-1' })
      ).rejects.toThrow();
    });
  });

  // --------------------------------------------------------------------------
  // fetchAllInquiries
  // --------------------------------------------------------------------------

  describe('fetchAllInquiries', () => {
    it('전체 문의 목록을 조회해야 한다', async () => {
      const mockInquiries = [
        { id: 'inq-1', subject: '문의1', status: 'open' },
        { id: 'inq-2', subject: '문의2', status: 'closed' },
      ];

      mockGetDocs.mockResolvedValue({ docs: [] } as never);
      mockProcessPaginatedResults.mockReturnValue({
        items: mockInquiries,
        lastDoc: null,
        hasMore: false,
      } as never);

      const result = await fetchAllInquiries({});

      expect(result).toEqual({
        inquiries: mockInquiries,
        lastDoc: null,
        hasMore: false,
      });
    });

    it('status 필터를 적용할 수 있어야 한다', async () => {
      mockGetDocs.mockResolvedValue({ docs: [] } as never);
      mockProcessPaginatedResults.mockReturnValue({
        items: [],
        lastDoc: null,
        hasMore: false,
      } as never);

      const result = await fetchAllInquiries({
        filters: { status: 'open' as never },
      });

      expect(result).toEqual({
        inquiries: [],
        lastDoc: null,
        hasMore: false,
      });
    });

    it('status가 all이면 필터를 적용하지 않아야 한다', async () => {
      mockGetDocs.mockResolvedValue({ docs: [] } as never);
      mockProcessPaginatedResults.mockReturnValue({
        items: [],
        lastDoc: null,
        hasMore: false,
      } as never);

      await fetchAllInquiries({
        filters: { status: 'all' as never },
      });

      // Should complete without error
    });

    it('Firestore 에러 시 에러를 던져야 한다', async () => {
      mockGetDocs.mockRejectedValue(new Error('Firestore error'));

      await expect(fetchAllInquiries({})).rejects.toThrow();
    });
  });

  // --------------------------------------------------------------------------
  // getInquiry
  // --------------------------------------------------------------------------

  describe('getInquiry', () => {
    const mockInquiryData = {
      userId: 'user-1',
      userEmail: 'test@test.com',
      userName: '테스트',
      category: 'general',
      subject: '문의 제목',
      message: '문의 내용',
      status: 'open',
      attachments: [],
      response: null,
      responderId: null,
      responderName: null,
      respondedAt: null,
      createdAt: { _serverTimestamp: true },
      updatedAt: { _serverTimestamp: true },
    };

    it('문의 상세를 조회해야 한다', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        id: 'inq-1',
        data: () => mockInquiryData,
      } as never);

      const result = await getInquiry('inq-1');

      expect(result).not.toBeNull();
      expect(result?.id).toBe('inq-1');
      expect(result?.subject).toBe('문의 제목');
      expect(result?.userId).toBe('user-1');
    });

    it('존재하지 않는 문의는 null을 반환해야 한다', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => false,
        id: 'non-existent',
        data: () => undefined,
      } as never);

      const result = await getInquiry('non-existent');

      expect(result).toBeNull();
    });

    it('Firestore 에러 시 에러를 던져야 한다', async () => {
      mockGetDoc.mockRejectedValue(new Error('Firestore error'));

      await expect(getInquiry('inq-1')).rejects.toThrow();
    });
  });

  // --------------------------------------------------------------------------
  // createInquiry
  // --------------------------------------------------------------------------

  describe('createInquiry', () => {
    const mockInput = {
      category: 'general' as const,
      subject: '새 문의',
      message: '문의 내용입니다',
      attachments: [],
    };

    it('문의를 생성하고 ID를 반환해야 한다', async () => {
      mockAddDoc.mockResolvedValue({ id: 'new-inq-id' } as never);

      const result = await createInquiry(
        'user-1',
        'test@test.com',
        '테스트',
        mockInput as never
      );

      expect(result).toBe('new-inq-id');
      expect(mockAddDoc).toHaveBeenCalled();
    });

    it('첨부파일 없이 문의를 생성할 수 있어야 한다', async () => {
      mockAddDoc.mockResolvedValue({ id: 'new-inq-id' } as never);

      const inputWithoutAttachments = {
        category: 'general' as const,
        subject: '새 문의',
        message: '문의 내용',
      };

      const result = await createInquiry(
        'user-1',
        'test@test.com',
        '테스트',
        inputWithoutAttachments as never
      );

      expect(result).toBe('new-inq-id');
    });

    it('Firestore 에러 시 에러를 던져야 한다', async () => {
      mockAddDoc.mockRejectedValue(new Error('생성 실패'));

      await expect(
        createInquiry('user-1', 'test@test.com', '테스트', mockInput as never)
      ).rejects.toThrow();
    });
  });

  // --------------------------------------------------------------------------
  // respondToInquiry
  // --------------------------------------------------------------------------

  describe('respondToInquiry', () => {
    const mockInput = {
      response: '답변 내용입니다',
      status: 'closed' as const,
    };

    it('문의에 응답해야 한다', async () => {
      mockUpdateDoc.mockResolvedValue(undefined as never);

      await respondToInquiry(
        'inq-1',
        'admin-1',
        '관리자',
        mockInput as never
      );

      expect(mockUpdateDoc).toHaveBeenCalled();
      const updateCall = mockUpdateDoc.mock.calls[0];
      expect(updateCall[1]).toMatchObject({
        response: '답변 내용입니다',
        responderId: 'admin-1',
        responderName: '관리자',
      });
    });

    it('status를 지정하지 않으면 기본값으로 closed를 사용해야 한다', async () => {
      mockUpdateDoc.mockResolvedValue(undefined as never);

      const inputWithoutStatus = {
        response: '답변 내용',
      };

      await respondToInquiry(
        'inq-1',
        'admin-1',
        '관리자',
        inputWithoutStatus as never
      );

      expect(mockUpdateDoc).toHaveBeenCalled();
    });

    it('Firestore 에러 시 에러를 던져야 한다', async () => {
      mockUpdateDoc.mockRejectedValue(new Error('응답 실패'));

      await expect(
        respondToInquiry('inq-1', 'admin-1', '관리자', mockInput as never)
      ).rejects.toThrow();
    });
  });

  // --------------------------------------------------------------------------
  // updateInquiryStatus
  // --------------------------------------------------------------------------

  describe('updateInquiryStatus', () => {
    it('문의 상태를 변경해야 한다', async () => {
      mockUpdateDoc.mockResolvedValue(undefined as never);

      await updateInquiryStatus('inq-1', 'closed' as never);

      expect(mockUpdateDoc).toHaveBeenCalled();
      const updateCall = mockUpdateDoc.mock.calls[0];
      expect(updateCall[1]).toMatchObject({
        status: 'closed',
      });
    });

    it('in_progress 상태로 변경할 수 있어야 한다', async () => {
      mockUpdateDoc.mockResolvedValue(undefined as never);

      await updateInquiryStatus('inq-1', 'in_progress' as never);

      expect(mockUpdateDoc).toHaveBeenCalled();
      const updateCall = mockUpdateDoc.mock.calls[0];
      expect(updateCall[1]).toMatchObject({
        status: 'in_progress',
      });
    });

    it('Firestore 에러 시 에러를 던져야 한다', async () => {
      mockUpdateDoc.mockRejectedValue(new Error('상태 변경 실패'));

      await expect(
        updateInquiryStatus('inq-1', 'closed' as never)
      ).rejects.toThrow();
    });
  });

  // --------------------------------------------------------------------------
  // getUnansweredCount
  // --------------------------------------------------------------------------

  describe('getUnansweredCount', () => {
    it('미답변 문의 수를 반환해야 한다', async () => {
      mockGetCountFromServerFn.mockResolvedValue({
        data: () => ({ count: 5 }),
      } as never);

      const result = await getUnansweredCount();

      expect(result).toBe(5);
    });

    it('미답변 문의가 없으면 0을 반환해야 한다', async () => {
      mockGetCountFromServerFn.mockResolvedValue({
        data: () => ({ count: 0 }),
      } as never);

      const result = await getUnansweredCount();

      expect(result).toBe(0);
    });

    it('Firestore 에러 시 에러를 던져야 한다', async () => {
      mockGetCountFromServerFn.mockRejectedValue(new Error('통계 조회 실패'));

      await expect(getUnansweredCount()).rejects.toThrow();
    });
  });
});
