import {
  createInquiry,
  fetchAllInquiries,
  fetchMyInquiries,
  getInquiry,
  getUnansweredCount,
  respondToInquiry,
  updateInquiryStatus,
} from '../inquiryService';

import { ERROR_CODES } from '@/errors';
import { inquiryRepository } from '@/repositories';

jest.mock('@/repositories', () => ({
  inquiryRepository: {
    getByUserId: jest.fn(),
    getAll: jest.fn(),
    getById: jest.fn(),
    create: jest.fn(),
    respond: jest.fn(),
    updateStatus: jest.fn(),
    getUnansweredCount: jest.fn(),
  },
}));

const mockRequireAdminUser = jest.fn();
const mockRequireMatchingCurrentUser = jest.fn();

jest.mock('@/services/auth', () => ({
  requireAdminUser: (...args: unknown[]) => mockRequireAdminUser(...args),
  requireMatchingCurrentUser: (...args: unknown[]) => mockRequireMatchingCurrentUser(...args),
}));
jest.mock('@/services/auth/authorizationService', () => ({
  requireAdminUser: (...args: unknown[]) => mockRequireAdminUser(...args),
  requireMatchingCurrentUser: (...args: unknown[]) => mockRequireMatchingCurrentUser(...args),
}));

jest.mock('@/errors/serviceErrorHandler', () => ({
  handleServiceError: jest.fn((error: unknown) =>
    error instanceof Error ? error : new Error(String(error))
  ),
}));

jest.mock('@/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

const mockRepo = inquiryRepository as jest.Mocked<typeof inquiryRepository>;

describe('inquiryService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireAdminUser.mockResolvedValue({ id: 'admin-1' } as never);
    mockRequireMatchingCurrentUser.mockReturnValue({ id: 'user-1' } as never);
  });

  it('fetches inquiries for the current user', async () => {
    const result = {
      inquiries: [{ id: 'inq-1', userId: 'user-1' }],
      nextCursor: null,
      hasMore: false,
    };
    mockRepo.getByUserId.mockResolvedValue(result as never);

    await expect(fetchMyInquiries({ userId: 'user-1', pageSize: 10 })).resolves.toEqual({
      inquiries: result.inquiries,
      lastDoc: null,
      hasMore: false,
    });
    expect(mockRepo.getByUserId).toHaveBeenCalledWith('user-1', {
      pageSize: 10,
      cursor: undefined,
    });
  });

  it('rejects fetchMyInquiries without a user id', async () => {
    await expect(fetchMyInquiries({ userId: '' })).rejects.toEqual(
      expect.objectContaining({ code: ERROR_CODES.VALIDATION_REQUIRED })
    );
  });

  it('fetches all inquiries with filters', async () => {
    const result = {
      inquiries: [{ id: 'inq-1', status: 'open' }],
      nextCursor: 'cursor-1',
      hasMore: true,
    };
    mockRepo.getAll.mockResolvedValue(result as never);

    await expect(fetchAllInquiries({ filters: { status: 'open' as never } })).resolves.toEqual({
      inquiries: result.inquiries,
      lastDoc: 'cursor-1',
      hasMore: true,
    });
    expect(mockRepo.getAll).toHaveBeenCalledWith({
      filters: { status: 'open' },
      pageSize: undefined,
      cursor: undefined,
    });
  });

  it('rejects admin inquiry fetches for non-admin users', async () => {
    mockRequireAdminUser.mockRejectedValueOnce(
      Object.assign(new Error('forbidden'), {
        code: ERROR_CODES.SECURITY_UNAUTHORIZED_ACCESS,
      })
    );

    await expect(fetchAllInquiries({ filters: { status: 'open' as never } })).rejects.toEqual(
      expect.objectContaining({ code: ERROR_CODES.SECURITY_UNAUTHORIZED_ACCESS })
    );
    expect(mockRepo.getAll).not.toHaveBeenCalled();
  });

  it('gets a single inquiry', async () => {
    const inquiry = { id: 'inq-1', subject: 'Need help' };
    mockRepo.getById.mockResolvedValue(inquiry as never);

    await expect(getInquiry('inq-1')).resolves.toEqual(inquiry);
    expect(mockRepo.getById).toHaveBeenCalledWith('inq-1');
  });

  it('creates an inquiry only for the authenticated user', async () => {
    mockRepo.create.mockResolvedValue('inq-new' as never);
    const input = {
      category: 'general' as const,
      subject: 'Question',
      message: 'Details here',
    };

    await expect(createInquiry('user-1', 'user@test.com', 'User', input)).resolves.toBe('inq-new');
    expect(mockRepo.create).toHaveBeenCalledWith(
      { userId: 'user-1', userEmail: 'user@test.com', userName: 'User' },
      input
    );
  });

  it('rejects inquiry creation when the user id does not match the session', async () => {
    const input = {
      category: 'general' as const,
      subject: 'Question',
      message: 'Details here',
    };

    mockRequireMatchingCurrentUser.mockImplementationOnce(() => {
      throw Object.assign(new Error('forbidden'), {
        code: ERROR_CODES.SECURITY_UNAUTHORIZED_ACCESS,
      });
    });

    await expect(createInquiry('other-user', 'user@test.com', 'User', input)).rejects.toEqual(
      expect.objectContaining({ code: ERROR_CODES.SECURITY_UNAUTHORIZED_ACCESS })
    );
    expect(mockRepo.create).not.toHaveBeenCalled();
  });

  it('responds to an inquiry only for the authenticated responder id', async () => {
    mockRepo.respond.mockResolvedValue(undefined as never);
    const input = { response: 'Handled', status: 'closed' as const };

    await expect(respondToInquiry('inq-1', 'admin-1', 'Admin', input)).resolves.toBeUndefined();
    expect(mockRepo.respond).toHaveBeenCalledWith('inq-1', 'admin-1', 'Admin', input);
  });

  it('rejects inquiry responses from non-admin users', async () => {
    mockRequireAdminUser.mockRejectedValueOnce(
      Object.assign(new Error('forbidden'), {
        code: ERROR_CODES.SECURITY_UNAUTHORIZED_ACCESS,
      })
    );
    const input = { response: 'Handled', status: 'closed' as const };

    await expect(respondToInquiry('inq-1', 'admin-1', 'Admin', input)).rejects.toEqual(
      expect.objectContaining({ code: ERROR_CODES.SECURITY_UNAUTHORIZED_ACCESS })
    );
    expect(mockRepo.respond).not.toHaveBeenCalled();
  });

  it('updates inquiry status', async () => {
    mockRepo.updateStatus.mockResolvedValue(undefined as never);

    await expect(updateInquiryStatus('inq-1', 'closed' as never)).resolves.toBeUndefined();
    expect(mockRepo.updateStatus).toHaveBeenCalledWith('inq-1', 'closed');
  });

  it('returns unanswered inquiry counts', async () => {
    mockRepo.getUnansweredCount.mockResolvedValue(5 as never);

    await expect(getUnansweredCount()).resolves.toBe(5);
    expect(mockRepo.getUnansweredCount).toHaveBeenCalledTimes(1);
  });
});
