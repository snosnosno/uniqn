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

  // W1-10(CANCEL-12): 취소 사유는 **사장에게만** 간다. 게시판은 실명 공개 공간이라
  // 질병·가족 문제 같은 사적 사유가 본문 첫 줄로 노출되고 있었다.
  it('취소 사유 원문을 본문에 싣지 않는다 (개인정보 노출 차단)', async () => {
    // 타입에서 reason 을 없앴으므로 컴파일 타임에 막히지만, 레거시 호출부가 남아
    // 런타임으로 흘러들어와도 본문에 실리지 않아야 한다.
    const withLegacyReason = {
      ...makeInput(),
      reason: '유산 수술로 출근이 어렵습니다.',
    } as CreateSubstitutePostInput;

    await createSubstitutePost(withLegacyReason);

    const callArg = (mockBoardRepository.createPost as jest.Mock).mock.calls[0][0];
    expect(callArg.body).not.toContain('유산');
    expect(callArg.body).not.toContain('출근이 어렵습니다');
  });

  it('사유 대신 일정·지점·보상만 싣는다', async () => {
    await createSubstitutePost(makeInput());

    const callArg = (mockBoardRepository.createPost as jest.Mock).mock.calls[0][0];
    expect(callArg.body).toContain('2026-04-20');
    expect(callArg.body).toContain('강남구');
    expect(callArg.body).toContain('시급 15,000원');
  });

  // 프로덕션 호출부(schedule.tsx)는 compensationLabel 을 넘기지 않고 workDate 도 빌 수 있다.
  // 사유를 빼면 본문이 통째로 비어 assertSafeText 가 throw 하므로, 고정 안내 문구가 필요하다.
  it('일정·지점·보상이 모두 비어도 본문이 비지 않는다', async () => {
    const jobSummary = {
      jobPostingId: 'job-123',
      title: '강남 홀덤펍 딜러',
      workDate: '',
    } as BoardJobSummary;

    await expect(createSubstitutePost(makeInput({ jobSummary }))).resolves.toBeDefined();

    const callArg = (mockBoardRepository.createPost as jest.Mock).mock.calls[0][0];
    expect(callArg.body.trim().length).toBeGreaterThan(0);
  });

  it('rejects creation when jobSummary.jobPostingId is missing', async () => {
    const input = {
      authorId: 'staff-1',
      authorName: '홍길동',
      authorRole: 'staff' as const,
      applicationId: 'app-1',
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
  // 케이스 1: 단일 active 대타글 → setPostStatus 1회 호출
  it('should call setPostStatus once when getPosts returns 1 post', async () => {
    const mockPosts = [{ id: 'post-1' }];
    (mockBoardRepository.getPosts as jest.Mock).mockResolvedValue(mockPosts);
    (mockBoardRepository.setPostStatus as jest.Mock).mockResolvedValue(undefined);

    await archiveSubstitutePostByLinkedPosting('job-123', 'staff-1');

    expect(mockBoardRepository.setPostStatus).toHaveBeenCalledTimes(1);
    expect(mockBoardRepository.setPostStatus).toHaveBeenCalledWith('post-1', 'archived');
  });

  // 케이스 2: 복수 대타글 → N번 호출, 순서대로
  it('should call setPostStatus for each post when getPosts returns 2 posts', async () => {
    const mockPosts = [{ id: 'post-1' }, { id: 'post-2' }];
    (mockBoardRepository.getPosts as jest.Mock).mockResolvedValue(mockPosts);
    (mockBoardRepository.setPostStatus as jest.Mock).mockResolvedValue(undefined);

    await archiveSubstitutePostByLinkedPosting('job-123', 'staff-1');

    expect(mockBoardRepository.setPostStatus).toHaveBeenCalledTimes(2);
    expect(mockBoardRepository.setPostStatus).toHaveBeenNthCalledWith(1, 'post-1', 'archived');
    expect(mockBoardRepository.setPostStatus).toHaveBeenNthCalledWith(2, 'post-2', 'archived');
  });

  // 케이스 3: 빈 결과 → no-op (setPostStatus 호출 0회, 에러 없음)
  it('should never call setPostStatus when getPosts returns empty array', async () => {
    (mockBoardRepository.getPosts as jest.Mock).mockResolvedValue([]);

    await archiveSubstitutePostByLinkedPosting('job-123', 'staff-1');

    expect(mockBoardRepository.setPostStatus).not.toHaveBeenCalled();
  });

  // 케이스 4: authorId 권한 격리 — getPosts가 정확한 authorId 파라미터 받음
  it('should pass authorId to getPosts for author isolation', async () => {
    (mockBoardRepository.getPosts as jest.Mock).mockResolvedValue([]);

    await archiveSubstitutePostByLinkedPosting('job-xyz', 'staff-owner-42');

    expect(mockBoardRepository.getPosts).toHaveBeenCalledTimes(1);
    const callArg = (mockBoardRepository.getPosts as jest.Mock).mock.calls[0][0];
    expect(callArg.authorId).toBe('staff-owner-42');
    expect(callArg.linkedJobPostingId).toBe('job-xyz');
  });

  // 케이스 5: boardTypes: substitute + statuses: active 필터
  it('should pass boardTypes: [substitute] and statuses: [active] filters to getPosts', async () => {
    (mockBoardRepository.getPosts as jest.Mock).mockResolvedValue([]);

    await archiveSubstitutePostByLinkedPosting('job-123', 'staff-1');

    const callArg = (mockBoardRepository.getPosts as jest.Mock).mock.calls[0][0];
    expect(callArg.boardTypes).toEqual(['substitute']);
    expect(callArg.statuses).toEqual(['active']);
  });

  // 케이스 6: Repository 예외 → logger.warn 호출, throw 안됨 (Promise resolves)
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

  // 케이스 7: partial failure — 중간 post 실패해도 나머지 계속 시도, 각 실패는 개별 warn
  it('partial failure: succeeds on some posts, logs per-post warn for rejections', async () => {
    (mockBoardRepository.getPosts as jest.Mock).mockResolvedValue([
      { id: 'p1' },
      { id: 'p2' },
      { id: 'p3' },
    ]);
    (mockBoardRepository.setPostStatus as jest.Mock)
      .mockResolvedValueOnce(undefined) // p1 OK
      .mockRejectedValueOnce(new Error('p2 fail')) // p2 fails
      .mockResolvedValueOnce(undefined); // p3 OK (proves loop continued)

    const { logger } = jest.requireMock('@/utils/logger');

    await archiveSubstitutePostByLinkedPosting('job-X', 'user-X');

    // All 3 attempts made (not stopped by p2 failure)
    expect(mockBoardRepository.setPostStatus).toHaveBeenCalledTimes(3);
    // p2 failure logged specifically
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Substitute post archive failed for single post'),
      expect.objectContaining({ postId: 'p2' })
    );
  });
});
