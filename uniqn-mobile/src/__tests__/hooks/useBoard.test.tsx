import { renderHook } from '@testing-library/react-native';
import { useBoardHome, useCreateBoardPost } from '@/hooks/useBoard';
import { canRunBoardQueryWithAuth } from '@/hooks/internal/boardQueryAuthGate';
import { createBoardPost } from '@/services';
import { userRepository } from '@/repositories';

const mockUseQuery = jest.fn((_options?: unknown) => ({
  data: undefined,
  isLoading: false,
  error: null,
  refetch: jest.fn(),
  isRefetching: false,
}));
const mockUseMutation = jest.fn((options?: unknown) => options);

const mockAuthState = {
  needsServerReconcile: false,
  bootstrapSource: 'none' as 'none' | 'cache' | 'server',
};

const mockUseAuth = jest.fn(
  (): {
    user: { uid: string; displayName?: string } | null;
    profile: null;
    role: string | null;
    isAdmin: boolean;
  } => ({
    user: { uid: 'user-1' },
    profile: null,
    role: 'employer',
    isAdmin: false,
  })
);

let mockLiveUserId: string | null = null;

jest.mock('@tanstack/react-query', () => ({
  useQuery: (options: unknown) => mockUseQuery(options),
  useMutation: (options: unknown) => mockUseMutation(options),
}));

jest.mock('@/services', () => ({
  getBoardHomeData: jest.fn(),
  fetchBoardPosts: jest.fn(),
  getBoardPostDetail: jest.fn(),
  getBoardMentionCandidates: jest.fn(),
  createBoardComment: jest.fn(),
  createBoardPost: jest.fn(),
  createBoardReport: jest.fn(),
  hideBoardPost: jest.fn(),
  incrementBoardPostViewCount: jest.fn(),
  setBoardCommentPinned: jest.fn(),
  setBoardCommentStatus: jest.fn(),
  setBoardPostLock: jest.fn(),
  toggleBoardCommentReaction: jest.fn(),
  toggleBoardPostVote: jest.fn(),
  updateBoardComment: jest.fn(),
  updateBoardPost: jest.fn(),
}));

jest.mock('@/hooks/useAuth', () => ({
  useAuth: () => mockUseAuth(),
}));

jest.mock('@/repositories', () => ({
  userRepository: {
    getById: jest.fn(),
  },
}));

const useAuthStoreFn = (selector?: (state: typeof mockAuthState) => unknown) =>
  typeof selector === 'function' ? selector(mockAuthState) : mockAuthState;
useAuthStoreFn.getState = () => mockAuthState;

jest.mock('@/stores/authStore', () => ({
  useAuthStore: useAuthStoreFn,
  selectNeedsServerReconcile: (state: typeof mockAuthState) => state.needsServerReconcile,
  selectBootstrapSource: (state: typeof mockAuthState) => state.bootstrapSource,
}));

jest.mock('@/hooks/internal/appInitializeAuthSession', () => ({
  getCurrentAuthUser: () => (mockLiveUserId ? { uid: mockLiveUserId } : null),
}));

jest.mock('@/lib/queryClient', () => ({
  queryKeys: {
    boards: {
      home: (userId?: string, role?: string, isAdmin?: boolean) => [
        'boards',
        'home',
        userId ?? 'anonymous',
        role ?? 'unknown',
        isAdmin ?? false,
      ],
    },
  },
  invalidateQueries: {
    boards: jest.fn(),
  },
}));

jest.mock('@/stores/toastStore', () => ({
  useToastStore: () => ({ addToast: jest.fn() }),
}));

jest.mock('@/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

describe('boardQueryAuthGate', () => {
  it('blocks board queries while cache bootstrap is waiting for the live Firebase session', () => {
    expect(
      canRunBoardQueryWithAuth({
        userId: 'user-1',
        bootstrapSource: 'cache',
        needsServerReconcile: true,
        liveUserId: null,
      })
    ).toBe(false);
  });

  it('allows board queries once the live Firebase session matches the cached user', () => {
    expect(
      canRunBoardQueryWithAuth({
        userId: 'user-1',
        bootstrapSource: 'cache',
        needsServerReconcile: true,
        liveUserId: 'user-1',
      })
    ).toBe(true);
  });
});

describe('useBoardHome', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuthState.needsServerReconcile = false;
    mockAuthState.bootstrapSource = 'none';
    mockLiveUserId = null;
    mockUseAuth.mockReturnValue({
      user: { uid: 'user-1' },
      profile: null,
      role: 'employer',
      isAdmin: false,
    });
  });

  it('passes enabled=false while cache bootstrap is waiting for the live Firebase session', () => {
    mockAuthState.needsServerReconcile = true;
    mockAuthState.bootstrapSource = 'cache';

    renderHook(() => useBoardHome());

    expect(mockUseQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        enabled: false,
      })
    );
  });

  it('passes enabled=true once the live Firebase session is available', () => {
    mockLiveUserId = 'user-1';
    mockAuthState.needsServerReconcile = false;
    mockAuthState.bootstrapSource = 'server';

    renderHook(() => useBoardHome());

    expect(mockUseQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        enabled: true,
      })
    );
  });
});

describe('useCreateBoardPost', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAuth.mockReturnValue({
      user: { uid: 'user-1', displayName: 'Auth User' },
      profile: null,
      role: null,
      isAdmin: false,
    });
  });

  it('hydrates board author identity from the persisted user profile before creating a post', async () => {
    (userRepository.getById as jest.Mock).mockResolvedValue({
      uid: 'user-1',
      name: 'Server Name',
      nickname: 'Server Nick',
      role: 'staff',
    });
    (createBoardPost as jest.Mock).mockResolvedValue('post-1');

    const { result } = renderHook(() => useCreateBoardPost());
    const mutation = result.current as unknown as {
      mutationFn: (input: { boardType: 'free'; title: string; body: string }) => Promise<unknown>;
    };

    await mutation.mutationFn({
      boardType: 'free',
      title: '제목',
      body: '본문',
    });

    expect(createBoardPost).toHaveBeenCalledWith(
      'user-1',
      'Server Nick',
      'staff',
      expect.objectContaining({
        authorId: 'user-1',
        authorName: 'Server Nick',
        authorRole: 'staff',
      })
    );
  });

  it('stops the mutation when the board author identity is still unavailable', async () => {
    (userRepository.getById as jest.Mock).mockResolvedValue(null);

    const { result } = renderHook(() => useCreateBoardPost());
    const mutation = result.current as unknown as {
      mutationFn: (input: { boardType: 'free'; title: string; body: string }) => Promise<unknown>;
    };

    await expect(
      mutation.mutationFn({
        boardType: 'free',
        title: '제목',
        body: '본문',
      })
    ).rejects.toThrow('프로필 정보를 불러오는 중입니다. 잠시 후 다시 시도해 주세요.');
    expect(createBoardPost).not.toHaveBeenCalled();
  });
});
