import { boardRepository } from '@/repositories';
import { requireMatchingCurrentUser } from '@/services/auth/authorizationService';
import { createSubstitutePost, archiveSubstitutePostByLinkedPosting } from '../boardService';
import type { CreateSubstitutePostInput } from '../boardService';
import type { BoardJobSummary } from '@/types/board';

jest.mock('@/repositories', () => ({
  announcementRepository: {
    getPublished: jest.fn(),
    getById: jest.fn(),
    incrementViewCount: jest.fn(),
  },
  applicationRepository: {},
  boardRepository: {
    getMembershipsByUser: jest.fn(),
    getMembership: jest.fn(),
    getPostById: jest.fn(),
    getPosts: jest.fn(),
    getComments: jest.fn(),
    getPostVote: jest.fn(),
    getCommentReactionsByUser: jest.fn(),
    updatePost: jest.fn(),
    updateComment: jest.fn(),
    setCommentStatus: jest.fn(),
    setPostStatus: jest.fn(),
    createPost: jest.fn(),
  },
  jobPostingRepository: {},
  workLogRepository: {},
  userRepository: {},
}));

jest.mock('@/services/auth', () => ({
  requireAdminUser: jest.fn(),
  requireMatchingCurrentUser: jest.fn(),
}));
jest.mock('@/services/auth/authorizationService', () => ({
  requireAdminUser: jest.fn(),
  requireMatchingCurrentUser: jest.fn(),
}));
jest.mock('@/services/auth/storageService', () => ({
  deleteMultipleBoardImages: jest.fn(),
}));

jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: jest.fn().mockResolvedValue({
        data: { user: { id: 'staff-1' } },
        error: null,
      }),
    },
  },
}));

jest.mock('@/errors/serviceErrorHandler', () => {
  const actual = jest.requireActual('@/errors/serviceErrorHandler');
  return {
    ...actual,
    handleSilentError: jest.fn(),
  };
});

jest.mock('@/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    appError: jest.fn(),
  },
}));

const mockBoardRepository = boardRepository as jest.Mocked<typeof boardRepository>;
const mockRequireMatchingCurrentUser = requireMatchingCurrentUser as jest.MockedFunction<
  typeof requireMatchingCurrentUser
>;

function makeJobSummary(overrides: Partial<BoardJobSummary> = {}): BoardJobSummary {
  return {
    jobPostingId: 'job-123',
    title: '강남 홀덤펍 딜러',
    workDate: '2026-04-20',
    locationName: '강남구',
    compensationLabel: '시급 15,000원',
    ...overrides,
  };
}

function makeInput(overrides: Partial<CreateSubstitutePostInput> = {}): CreateSubstitutePostInput {
  return {
    authorId: 'staff-1',
    authorName: '홍길동',
    authorRole: 'staff',
    applicationId: 'app-456',
    jobSummary: makeJobSummary(),
    reason: '갑자기 몸이 아파서 대타를 구합니다.',
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockRequireMatchingCurrentUser.mockResolvedValue({} as never);
  (mockBoardRepository.createPost as jest.Mock).mockResolvedValue('post-id-new');
});

describe('createSubstitutePost', () => {
  it('should call boardRepository.createPost with boardType substitute', async () => {
    const input = makeInput();

    await createSubstitutePost(input);

    expect(mockBoardRepository.createPost).toHaveBeenCalledTimes(1);
    const callArg = (mockBoardRepository.createPost as jest.Mock).mock.calls[0][0];
    expect(callArg.boardType).toBe('substitute');
  });

  it('should include linkedJobPostingId from jobSummary', async () => {
    const jobSummary = makeJobSummary({ jobPostingId: 'job-999' });
    const input = makeInput({ jobSummary });

    await createSubstitutePost(input);

    const callArg = (mockBoardRepository.createPost as jest.Mock).mock.calls[0][0];
    expect(callArg.linkedJobPostingId).toBe('job-999');
  });

  it('should include jobSummary in the post', async () => {
    const jobSummary = makeJobSummary({ title: '테스트 공고', workDate: '2026-05-01' });
    const input = makeInput({ jobSummary });

    await createSubstitutePost(input);

    const callArg = (mockBoardRepository.createPost as jest.Mock).mock.calls[0][0];
    expect(callArg.jobSummary).toEqual(jobSummary);
  });

  it('should return the post id from boardRepository.createPost', async () => {
    (mockBoardRepository.createPost as jest.Mock).mockResolvedValue('new-post-id-789');
    const input = makeInput();

    const result = await createSubstitutePost(input);

    expect(result).toBe('new-post-id-789');
  });

  it('should call requireMatchingCurrentUser with authorId', async () => {
    const input = makeInput({ authorId: 'staff-abc' });

    await createSubstitutePost(input);

    expect(mockRequireMatchingCurrentUser).toHaveBeenCalledWith('staff-abc');
  });

  it('should include title with job title', async () => {
    const jobSummary = makeJobSummary({ title: '강북 딜러 모집' });
    const input = makeInput({ jobSummary });

    await createSubstitutePost(input);

    const callArg = (mockBoardRepository.createPost as jest.Mock).mock.calls[0][0];
    expect(callArg.title).toContain('대타 구해요');
    expect(callArg.title).toContain('강북 딜러 모집');
  });

  it('should include reason in body', async () => {
    const input = makeInput({ reason: '개인 사정으로 출근이 어렵습니다.' });

    await createSubstitutePost(input);

    const callArg = (mockBoardRepository.createPost as jest.Mock).mock.calls[0][0];
    expect(callArg.body).toContain('개인 사정으로 출근이 어렵습니다.');
  });

  it('rejects creation when jobSummary.jobPostingId is missing', async () => {
    const input = {
      authorId: 'staff-1',
      authorName: '홍길동',
      authorRole: 'staff' as const,
      applicationId: 'app-1',
      reason: '갑자기 몸이 아파서 대타를 구합니다.',
      jobSummary: {
        // jobPostingId 의도적 누락
        title: 'Bar Shift',
        workDate: '2026-04-20',
        locationName: 'Pub',
        compensationLabel: '80000원',
      } as unknown as BoardJobSummary,
    };

    await expect(createSubstitutePost(input)).rejects.toMatchObject({
      name: 'ValidationError',
      code: expect.stringMatching(/^E3/),
    });

    expect(mockBoardRepository.createPost).not.toHaveBeenCalled();
  });
});

describe('archiveSubstitutePostByLinkedPosting', () => {
  it('should call setPostStatus for each post when getPosts returns 2 posts', async () => {
    const mockPosts = [{ id: 'post-1' }, { id: 'post-2' }];
    (mockBoardRepository.getPosts as jest.Mock).mockResolvedValue(mockPosts);
    (mockBoardRepository.setPostStatus as jest.Mock).mockResolvedValue(undefined);

    await archiveSubstitutePostByLinkedPosting('job-123', 'staff-1');

    expect(mockBoardRepository.setPostStatus).toHaveBeenCalledTimes(2);
    expect(mockBoardRepository.setPostStatus).toHaveBeenCalledWith('post-1', 'archived');
    expect(mockBoardRepository.setPostStatus).toHaveBeenCalledWith('post-2', 'archived');
  });

  it('should never call setPostStatus when getPosts returns empty array', async () => {
    (mockBoardRepository.getPosts as jest.Mock).mockResolvedValue([]);

    await archiveSubstitutePostByLinkedPosting('job-123', 'staff-1');

    expect(mockBoardRepository.setPostStatus).not.toHaveBeenCalled();
  });

  it('should resolve without rethrowing when setPostStatus throws (error swallowed, logger.warn called)', async () => {
    const { logger } = jest.requireMock('@/utils/logger');
    const mockPosts = [{ id: 'post-1' }];
    (mockBoardRepository.getPosts as jest.Mock).mockResolvedValue(mockPosts);
    (mockBoardRepository.setPostStatus as jest.Mock).mockRejectedValue(new Error('DB error'));

    await expect(
      archiveSubstitutePostByLinkedPosting('job-123', 'staff-1')
    ).resolves.toBeUndefined();

    expect(logger.warn).toHaveBeenCalledTimes(1);
  });
});
