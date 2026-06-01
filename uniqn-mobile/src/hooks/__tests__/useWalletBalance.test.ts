import { useWalletBalance } from '../useWalletBalance';

const mockUseQuery = jest.fn();
const mockGetWalletSummary = jest.fn();

jest.mock('@tanstack/react-query', () => ({
  useQuery: (opts: unknown) => mockUseQuery(opts),
}));

jest.mock('@/services/wallet', () => ({
  getWalletSummary: (...args: unknown[]) => mockGetWalletSummary(...args),
}));

const mockUseAuth = jest.fn();
jest.mock('@/hooks/useAuth', () => ({
  useAuth: () => mockUseAuth(),
}));

jest.mock('@/lib/queryClient', () => ({
  queryKeys: {
    wallet: {
      all: ['wallet'],
      summary: (uid?: string) => ['wallet', 'summary', uid ?? 'me'],
    },
  },
  queryCachingOptions: {
    wallet: {
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
    },
  },
}));

describe('useWalletBalance', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseQuery.mockReturnValue({ data: undefined, isLoading: true });
  });

  it('uid 기반 단일 queryKey로 useQuery를 구성한다', () => {
    mockUseAuth.mockReturnValue({ user: { uid: 'user-1' } });

    useWalletBalance();

    const opts = mockUseQuery.mock.calls[0][0];
    expect(opts.queryKey).toEqual(['wallet', 'summary', 'user-1']);
    expect(opts.enabled).toBe(true);
  });

  it('queryFn은 walletService.getWalletSummary를 호출한다', () => {
    mockUseAuth.mockReturnValue({ user: { uid: 'user-1' } });

    useWalletBalance();

    const opts = mockUseQuery.mock.calls[0][0];
    opts.queryFn();
    expect(mockGetWalletSummary).toHaveBeenCalledTimes(1);
  });

  it('로그인 전(uid 없음)에는 enabled=false', () => {
    mockUseAuth.mockReturnValue({ user: null });

    useWalletBalance();

    const opts = mockUseQuery.mock.calls[0][0];
    expect(opts.enabled).toBe(false);
    expect(opts.queryKey).toEqual(['wallet', 'summary', 'me']);
  });
});
