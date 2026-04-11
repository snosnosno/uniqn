import { announcementRepository, boardRepository } from '@/repositories';
import { deleteMultipleBoardImages } from '@/services/auth';
import { logger } from '@/utils/logger';
import type { BoardComment, BoardImageAttachment, BoardMembership, BoardPost } from '@/types/board';
import {
  fetchBoardPosts,
  getBoardHomeData,
  getBoardPostDetail,
  setBoardCommentStatus,
  updateBoardComment,
  updateBoardPost,
} from '../boardService';

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
  },
  jobPostingRepository: {},
  workLogRepository: {},
  userRepository: {},
}));

jest.mock('@/services/auth', () => ({
  requireAdminUser: jest.fn(),
  requireMatchingCurrentUser: jest.fn(),
  deleteMultipleBoardImages: jest.fn(),
}));

jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: jest.fn().mockResolvedValue({
        data: { user: { id: 'viewer-1' } },
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

const mockAnnouncementRepository = announcementRepository as jest.Mocked<
  typeof announcementRepository
>;
const mockBoardRepository = boardRepository as jest.Mocked<typeof boardRepository>;
const mockDeleteMultipleBoardImages = deleteMultipleBoardImages as jest.MockedFunction<
  typeof deleteMultipleBoardImages
>;
const mockLogger = logger as jest.Mocked<typeof logger>;

function createImage(id: string, storagePath = `boards/staff-1/${id}.jpg`): BoardImageAttachment {
  return {
    id,
    url: `https://example.com/${id}.jpg`,
    storagePath,
    order: Number(id.replace(/\D/g, '') || 0),
  };
}

function createBoardPost(overrides: Partial<BoardPost> = {}): BoardPost {
  return {
    id: overrides.id ?? 'post-1',
    boardType: 'schedule',
    source: 'board',
    title: '일정 게시글',
    body: '게시글 본문',
    authorId: 'owner-1',
    authorName: '사장님',
    authorRole: 'employer',
    visibility: 'participants_only',
    status: 'active',
    linkedJobPostingId: 'job-1',
    isAutoCreated: true,
    isLocked: false,
    likeCount: 0,
    dislikeCount: 0,
    commentCount: 0,
    viewCount: 0,
    imageAttachments: [],
    jobSummary: {
      jobPostingId: 'job-1',
      title: '일정 게시글',
      workDate: '2026-04-10',
    },
    createdAt: new Date('2026-04-01T00:00:00Z'),
    updatedAt: new Date('2026-04-06T00:00:00Z'),
    lastActivityAt: new Date('2026-04-06T00:00:00Z'),
    ...overrides,
  };
}

function createMembership(overrides: Partial<BoardMembership> = {}): BoardMembership {
  return {
    id: overrides.id ?? 'membership-1',
    boardType: 'schedule',
    userId: 'staff-1',
    postId: 'post-1',
    jobPostingId: 'job-1',
    role: 'confirmed',
    displayName: '스태프',
    canRead: true,
    canComment: true,
    title: '일정 게시글',
    workDate: '2026-04-10',
    authorId: 'owner-1',
    createdAt: new Date('2026-04-01T00:00:00Z'),
    updatedAt: new Date('2026-04-06T00:00:00Z'),
    lastActivityAt: new Date('2026-04-06T00:00:00Z'),
    ...overrides,
  };
}

function createBoardComment(overrides: Partial<BoardComment> = {}): BoardComment {
  return {
    id: overrides.id ?? 'comment-1',
    postId: overrides.postId ?? 'post-1',
    parentCommentId: null,
    body: '댓글 본문',
    authorId: 'staff-1',
    authorName: '스태프',
    authorRole: 'staff',
    mentionedUserIds: [],
    reactionCounts: {},
    isPinned: false,
    pinnedAt: null,
    pinnedBy: null,
    status: 'active',
    imageAttachments: [],
    createdAt: new Date('2026-04-06T00:00:00Z'),
    updatedAt: new Date('2026-04-06T00:00:00Z'),
    ...overrides,
  };
}

describe('boardService.fetchBoardPosts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockBoardRepository.getMembership.mockResolvedValue(null as never);
    mockBoardRepository.getComments.mockResolvedValue([] as never);
    mockBoardRepository.getPostVote.mockResolvedValue(null as never);
    mockBoardRepository.getCommentReactionsByUser.mockResolvedValue({} as never);
    mockDeleteMultipleBoardImages.mockResolvedValue(undefined);
  });

  it('keeps recent schedule activity ahead of earlier work dates', async () => {
    const memberships = [
      createMembership({
        id: 'author-membership-1',
        userId: 'owner-1',
        role: 'author',
        postId: 'older-date-post',
        jobPostingId: 'job-1',
        workDate: '2026-04-01',
      }),
      createMembership({
        id: 'author-membership-2',
        userId: 'owner-1',
        role: 'author',
        postId: 'recent-activity-post',
        jobPostingId: 'job-2',
        workDate: '2026-04-20',
      }),
      createMembership({
        id: 'confirmed-membership',
        userId: 'owner-1',
        role: 'confirmed',
        postId: 'confirmed-post',
        jobPostingId: 'job-3',
        workDate: '2026-04-15',
      }),
    ];
    const olderDatePost = createBoardPost({
      id: 'older-date-post',
      lastActivityAt: new Date('2026-04-05T08:00:00Z'),
      jobSummary: {
        jobPostingId: 'job-1',
        title: '이전 일정',
        workDate: '2026-04-01',
      },
    });
    const recentActivityPost = createBoardPost({
      id: 'recent-activity-post',
      lastActivityAt: new Date('2026-04-06T12:00:00Z'),
      jobSummary: {
        jobPostingId: 'job-2',
        title: '최근 일정',
        workDate: '2026-04-20',
      },
    });
    const confirmedPost = createBoardPost({
      id: 'confirmed-post',
      authorId: 'owner-2',
      lastActivityAt: new Date('2026-04-07T12:00:00Z'),
      jobSummary: {
        jobPostingId: 'job-3',
        title: '확정 인원 일정',
        workDate: '2026-04-15',
      },
    });

    mockBoardRepository.getMembershipsByUser.mockResolvedValue(memberships as never);
    mockBoardRepository.getPostById.mockImplementation(async (postId: string) => {
      if (postId === 'older-date-post') {
        return olderDatePost as never;
      }

      if (postId === 'recent-activity-post') {
        return recentActivityPost as never;
      }

      if (postId === 'confirmed-post') {
        return confirmedPost as never;
      }

      return null as never;
    });

    const result = await fetchBoardPosts({
      boardType: 'schedule',
      viewerId: 'owner-1',
      viewerRole: 'employer',
    });

    expect(result.map((post) => post.id)).toEqual(['recent-activity-post', 'older-date-post']);
    expect(mockBoardRepository.getMembershipsByUser).toHaveBeenCalledWith('owner-1', {
      canReadOnly: true,
      sortBy: 'lastActivityAt',
      sortDirection: 'desc',
    });
    expect(result.some((post) => post.id === 'confirmed-post')).toBe(false);
  });

  it('skips unreadable membership posts instead of failing the full staff list', async () => {
    const memberships = [
      createMembership({ postId: 'visible-post' }),
      createMembership({
        id: 'membership-2',
        postId: 'hidden-post',
        jobPostingId: 'job-2',
        workDate: '2026-04-11',
      }),
    ];
    const visiblePost = createBoardPost({
      id: 'visible-post',
      lastActivityAt: new Date('2026-04-06T12:00:00Z'),
    });

    mockBoardRepository.getMembershipsByUser.mockResolvedValue(memberships as never);
    mockBoardRepository.getPostById.mockImplementation(async (postId: string) => {
      if (postId === 'visible-post') {
        return visiblePost as never;
      }

      throw Object.assign(new Error('denied'), {
        code: 'permission-denied',
      });
    });

    const result = await fetchBoardPosts({
      boardType: 'schedule',
      viewerId: 'staff-1',
      viewerRole: 'staff',
    });

    expect(result.map((post) => post.id)).toEqual(['visible-post']);
    expect(mockBoardRepository.getPostById).toHaveBeenCalledTimes(2);
  });

  it('still surfaces unexpected repository failures while resolving memberships', async () => {
    mockBoardRepository.getMembershipsByUser.mockResolvedValue([
      createMembership({ postId: 'unavailable-post' }),
    ] as never);
    mockBoardRepository.getPostById.mockRejectedValue(
      Object.assign(new Error('temporarily unavailable'), {
        code: 'unavailable',
      }) as never
    );

    await expect(
      fetchBoardPosts({
        boardType: 'schedule',
        viewerId: 'staff-1',
        viewerRole: 'staff',
      })
    ).rejects.toMatchObject({
      message: expect.stringContaining('temporarily unavailable'),
    });
  });
});

describe('boardService.getBoardHomeData', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDeleteMultipleBoardImages.mockResolvedValue(undefined);
  });

  it('returns partial home data when pinned notices are permission denied', async () => {
    const schedulePosts = [
      createBoardPost({
        id: 'schedule-post-1',
        title: '최신 일정',
      }),
    ];
    const communityPosts = [
      createBoardPost({
        id: 'community-post-1',
        boardType: 'free',
        title: '커뮤니티 글',
        authorRole: 'staff',
      }),
    ];

    mockAnnouncementRepository.getPublished.mockRejectedValue(
      Object.assign(new Error('denied'), { code: 'permission-denied' })
    );
    mockBoardRepository.getPosts
      .mockResolvedValueOnce(schedulePosts as never)
      .mockResolvedValueOnce(communityPosts as never);

    const result = await getBoardHomeData({
      userId: 'viewer-1',
      role: 'admin',
      isAdmin: true,
    });

    expect(result).toEqual({
      pinnedNotices: [],
      recentSchedulePosts: schedulePosts,
      popularCommunityPosts: communityPosts,
    });
  });

  it('returns empty sections instead of failing the full home when all sections are permission denied', async () => {
    const deniedError = Object.assign(new Error('denied'), { code: 'permission-denied' });

    mockAnnouncementRepository.getPublished.mockRejectedValue(deniedError);
    mockBoardRepository.getPosts.mockRejectedValue(deniedError);

    const result = await getBoardHomeData({
      userId: 'viewer-1',
      role: 'admin',
      isAdmin: true,
    });

    expect(result).toEqual({
      pinnedNotices: [],
      recentSchedulePosts: [],
      popularCommunityPosts: [],
    });
  });
});

describe('boardService.getBoardPostDetail', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockBoardRepository.getMembership.mockResolvedValue(null as never);
    mockBoardRepository.getComments.mockResolvedValue([] as never);
    mockBoardRepository.getPostVote.mockResolvedValue(null as never);
    mockBoardRepository.getCommentReactionsByUser.mockResolvedValue({} as never);
  });

  it('keeps the detail page alive when optional vote and reaction lookups fail', async () => {
    const post = createBoardPost({
      id: 'free-post-1',
      boardType: 'free',
      authorId: 'staff-1',
      authorRole: 'staff',
      visibility: 'public',
      linkedJobPostingId: null,
      isAutoCreated: false,
    });
    const comments = [createBoardComment({ postId: 'free-post-1' })];

    mockBoardRepository.getPostById.mockResolvedValue(post as never);
    mockBoardRepository.getComments.mockResolvedValue(comments as never);
    mockBoardRepository.getPostVote.mockRejectedValue(
      Object.assign(new Error('vote denied'), { code: 'permission-denied' }) as never
    );
    mockBoardRepository.getCommentReactionsByUser.mockRejectedValue(
      Object.assign(new Error('reaction denied'), { code: 'permission-denied' }) as never
    );

    const result = await getBoardPostDetail('free-post-1', {
      userId: 'staff-1',
      role: 'staff',
    });

    expect(result.post.id).toBe('free-post-1');
    expect(result.comments).toEqual(comments);
    expect(result.commentTree).toHaveLength(1);
    expect(result.myVote).toBeNull();
    expect(result.myReactions).toEqual({});
    expect(mockLogger.warn).toHaveBeenCalledTimes(2);
  });

  it('still fails when the core comments query fails', async () => {
    const post = createBoardPost({
      id: 'free-post-1',
      boardType: 'free',
      authorId: 'staff-1',
      authorRole: 'staff',
      visibility: 'public',
      linkedJobPostingId: null,
      isAutoCreated: false,
    });

    mockBoardRepository.getPostById.mockResolvedValue(post as never);
    mockBoardRepository.getComments.mockRejectedValue(
      Object.assign(new Error('comments denied'), { code: 'permission-denied' }) as never
    );
    mockBoardRepository.getPostVote.mockResolvedValue(null as never);
    mockBoardRepository.getCommentReactionsByUser.mockResolvedValue({} as never);

    await expect(
      getBoardPostDetail('free-post-1', {
        userId: 'staff-1',
        role: 'staff',
      })
    ).rejects.toMatchObject({
      message: expect.stringContaining('comments denied'),
    });
  });
});

describe('boardService image cleanup', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockBoardRepository.getMembership.mockResolvedValue(null as never);
    mockBoardRepository.getComments.mockResolvedValue([] as never);
    mockBoardRepository.getPostVote.mockResolvedValue(null as never);
    mockBoardRepository.getCommentReactionsByUser.mockResolvedValue({} as never);
    mockDeleteMultipleBoardImages.mockResolvedValue(undefined);
  });

  it('deletes removed board post images after updating the post', async () => {
    const removedImage = createImage('image-1');
    const keptImage = createImage('image-2');

    mockBoardRepository.getPostById.mockResolvedValue(
      createBoardPost({
        id: 'free-post-1',
        boardType: 'free',
        authorId: 'staff-1',
        authorRole: 'staff',
        visibility: 'public',
        isAutoCreated: false,
        linkedJobPostingId: null,
        imageAttachments: [removedImage, keptImage],
      }) as never
    );
    mockBoardRepository.updatePost.mockResolvedValue(undefined as never);

    await updateBoardPost(
      'free-post-1',
      { userId: 'staff-1', role: 'staff' },
      { imageAttachments: [keptImage] }
    );

    expect(mockBoardRepository.updatePost).toHaveBeenCalledWith(
      'free-post-1',
      expect.objectContaining({
        imageAttachments: [keptImage],
      })
    );
    expect(mockDeleteMultipleBoardImages).toHaveBeenCalledWith([removedImage]);
  });

  it('deletes removed board comment images after updating the comment', async () => {
    const removedImage = createImage('comment-image-1');
    const keptImage = createImage('comment-image-2');
    const post = createBoardPost({
      id: 'free-post-1',
      boardType: 'free',
      authorId: 'owner-1',
      visibility: 'public',
      isAutoCreated: false,
      linkedJobPostingId: null,
    });
    const comment = createBoardComment({
      id: 'comment-1',
      postId: 'free-post-1',
      authorId: 'staff-1',
      imageAttachments: [removedImage, keptImage],
    });

    mockBoardRepository.getPostById.mockResolvedValue(post as never);
    mockBoardRepository.getComments.mockResolvedValue([comment] as never);
    mockBoardRepository.updateComment.mockResolvedValue(undefined as never);

    await updateBoardComment(
      'free-post-1',
      'comment-1',
      { userId: 'staff-1' },
      { imageAttachments: [keptImage] }
    );

    expect(mockBoardRepository.updateComment).toHaveBeenCalledWith(
      'free-post-1',
      'comment-1',
      expect.objectContaining({
        imageAttachments: [keptImage],
      })
    );
    expect(mockDeleteMultipleBoardImages).toHaveBeenCalledWith([removedImage]);
  });

  it('deletes all board comment images after moderation clears them', async () => {
    const image = createImage('comment-image-1');
    const post = createBoardPost({
      id: 'schedule_job-1',
      boardType: 'schedule',
      authorId: 'owner-1',
      linkedJobPostingId: 'job-1',
    });
    const comment = createBoardComment({
      id: 'comment-1',
      postId: 'schedule_job-1',
      authorId: 'staff-1',
      imageAttachments: [image],
    });

    mockBoardRepository.getPostById.mockResolvedValue(post as never);
    mockBoardRepository.getComments.mockResolvedValue([comment] as never);
    mockBoardRepository.setCommentStatus.mockResolvedValue(undefined as never);

    await setBoardCommentStatus(
      'schedule_job-1',
      'comment-1',
      { userId: 'admin-1', isAdmin: true },
      'hidden'
    );

    expect(mockBoardRepository.setCommentStatus).toHaveBeenCalledWith(
      'schedule_job-1',
      'comment-1',
      'hidden'
    );
    expect(mockDeleteMultipleBoardImages).toHaveBeenCalledWith([image]);
  });
});
