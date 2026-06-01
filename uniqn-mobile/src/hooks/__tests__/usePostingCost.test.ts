/**
 * usePostingCost — TanStack Query 훅 테스트
 */
import { usePostingCost } from '../usePostingCost';

const mockUseQuery = jest.fn();
const mockGet = jest.fn();

jest.mock('@tanstack/react-query', () => ({ useQuery: (o: unknown) => mockUseQuery(o) }));
jest.mock('@/services/wallet', () => ({ getPostingCost: (...a: unknown[]) => mockGet(...a) }));
jest.mock('@/lib/queryClient', () => ({
  queryKeys: {
    wallet: {
      all: ['wallet'],
      postingCost: (t: string, o?: string) => ['wallet', 'posting-cost', t, o ?? 'me'],
    },
  },
  queryCachingOptions: {
    wallet: { staleTime: 1, gcTime: 2 },
  },
}));

describe('usePostingCost', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseQuery.mockReturnValue({ data: undefined });
  });

  it('type+ownerId 기반 queryKey, enabled', () => {
    usePostingCost('urgent', 'owner-1');
    const o = mockUseQuery.mock.calls[0][0];
    expect(o.queryKey).toEqual(['wallet', 'posting-cost', 'urgent', 'owner-1']);
    expect(o.enabled).toBe(true);
  });

  it('ownerId 없으면 enabled=false', () => {
    usePostingCost('urgent', undefined);
    expect(mockUseQuery.mock.calls[0][0].enabled).toBe(false);
  });

  it('queryFn은 getPostingCost 호출', () => {
    usePostingCost('urgent', 'owner-1');
    mockUseQuery.mock.calls[0][0].queryFn();
    expect(mockGet).toHaveBeenCalledWith('urgent', 'owner-1');
  });
});
