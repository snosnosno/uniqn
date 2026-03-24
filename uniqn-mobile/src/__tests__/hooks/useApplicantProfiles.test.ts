import { renderHook, waitFor } from '@testing-library/react-native';
import { useApplicantProfiles } from '@/hooks/useApplicantProfiles';

const mockGetByIdBatch = jest.fn();
const mockSetQueryData = jest.fn();
const mockUseQuery = jest.fn();
const mockProfileBatch = jest.fn((ids: string[]) => ['user', 'profileBatch', ids.join(',')]);
const mockProfileKey = jest.fn((id: string) => ['user', 'profile', id]);

jest.mock('@/repositories', () => ({
  userRepository: {
    getByIdBatch: (...args: unknown[]) => mockGetByIdBatch(...args),
  },
}));

jest.mock('@tanstack/react-query', () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
  useQueryClient: () => ({
    setQueryData: mockSetQueryData,
  }),
}));

jest.mock('@/lib/queryClient', () => ({
  queryKeys: {
    user: {
      profileBatch: (ids: string[]) => mockProfileBatch(ids),
      profile: (id: string) => mockProfileKey(id),
    },
  },
}));

describe('useApplicantProfiles', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseQuery.mockImplementation(
      (options: { enabled?: boolean; queryKey: unknown[]; queryFn: () => Promise<unknown> }) => ({
        data: options.enabled === false ? undefined : new Map(),
        isLoading: false,
      })
    );
  });

  it('normalizes applicant ids without mutating the caller array', async () => {
    const inputIds = ['staff-2', 'staff-1', 'staff-2'];
    const profileMap = new Map([
      ['staff-1', { uid: 'staff-1', name: 'Staff 1' }],
      ['staff-2', { uid: 'staff-2', name: 'Staff 2' }],
    ]);

    mockUseQuery.mockImplementation(
      (options: { enabled?: boolean; queryKey: unknown[]; queryFn: () => Promise<unknown> }) => ({
        data: options.enabled === false ? undefined : profileMap,
        isLoading: false,
      })
    );

    renderHook(() => useApplicantProfiles({ applicantIds: inputIds }));

    const queryOptions = mockUseQuery.mock.calls[0][0] as {
      queryKey: unknown[];
      queryFn: () => Promise<unknown>;
    };

    expect(inputIds).toEqual(['staff-2', 'staff-1', 'staff-2']);
    expect(mockProfileBatch).toHaveBeenCalledWith(['staff-1', 'staff-2']);
    expect(queryOptions.queryKey).toEqual(['user', 'profileBatch', 'staff-1,staff-2']);

    await queryOptions.queryFn();

    expect(mockGetByIdBatch).toHaveBeenCalledWith(['staff-1', 'staff-2']);

    await waitFor(() => {
      expect(mockSetQueryData).toHaveBeenCalledWith(
        ['user', 'profile', 'staff-1'],
        profileMap.get('staff-1')
      );
      expect(mockSetQueryData).toHaveBeenCalledWith(
        ['user', 'profile', 'staff-2'],
        profileMap.get('staff-2')
      );
    });
  });

  it('disables the query when normalized ids are empty', () => {
    renderHook(() => useApplicantProfiles({ applicantIds: ['', ''], enabled: true }));

    const queryOptions = mockUseQuery.mock.calls[0][0] as {
      enabled?: boolean;
    };

    expect(queryOptions.enabled).toBe(false);
    expect(mockProfileBatch).toHaveBeenCalledWith([]);
  });
});
