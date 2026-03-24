import { renderHook } from '@testing-library/react-native';
import { useTemplates } from '@/hooks/useTemplateManager';

const mockGetTemplates = jest.fn();
const mockUseQuery = jest.fn();
const mockUser = { uid: 'employer-1' };
const mockAuthState: { user: { uid: string } | null } = { user: mockUser };

jest.mock('@/services/jobs/templateService', () => ({
  getTemplates: (...args: unknown[]) => mockGetTemplates(...args),
  saveTemplate: jest.fn(),
  loadTemplate: jest.fn(),
  deleteTemplate: jest.fn(),
}));

jest.mock('@/stores/authStore', () => ({
  useAuthStore: (selector?: (state: typeof mockAuthState) => unknown) =>
    selector ? selector(mockAuthState) : mockAuthState,
}));

jest.mock('@/stores/toastStore', () => ({
  useToastStore: () => ({
    addToast: jest.fn(),
  }),
}));

jest.mock('@/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('@/lib/queryClient', () => ({
  queryKeys: {
    templates: {
      all: ['templates'],
      list: (userId?: string) =>
        userId === undefined ? ['templates', 'list'] : ['templates', 'list', userId],
      detail: (id: string) => ['templates', 'detail', id],
    },
  },
  cachingPolicies: {
    stable: 60 * 60 * 1000,
  },
}));

jest.mock('@tanstack/react-query', () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
  useMutation: jest.fn(() => ({
    mutate: jest.fn(),
    mutateAsync: jest.fn(),
    isPending: false,
  })),
  useQueryClient: jest.fn(() => ({
    invalidateQueries: jest.fn(),
  })),
}));

describe('useTemplates', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuthState.user = mockUser;
    mockUseQuery.mockImplementation((options: { enabled?: boolean }) => ({
      data: options.enabled === false ? undefined : [],
      isLoading: false,
      error: null,
    }));
  });

  it('should scope template queries by user', async () => {
    renderHook(() => useTemplates());

    const queryOptions = mockUseQuery.mock.calls[0][0] as {
      queryKey: string[];
      queryFn: () => Promise<unknown>;
    };

    expect(queryOptions.queryKey).toEqual(['templates', 'list', 'employer-1']);

    await queryOptions.queryFn();

    expect(mockGetTemplates).toHaveBeenCalledWith('employer-1');
  });

  it('should disable template queries when user is missing', () => {
    mockAuthState.user = null;

    renderHook(() => useTemplates());

    const queryOptions = mockUseQuery.mock.calls[0][0] as { enabled?: boolean };

    expect(queryOptions.enabled).toBe(false);
  });
});
