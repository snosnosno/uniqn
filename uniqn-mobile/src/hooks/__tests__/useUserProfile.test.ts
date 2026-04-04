import { renderHook } from '@testing-library/react-native';
import { useUserProfile } from '../useUserProfile';

const mockUseQuery = jest.fn();
const mockProfileKey = jest.fn((id: string) => ['user', 'profile', id]);

jest.mock('@tanstack/react-query', () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
}));

jest.mock('@/lib/queryClient', () => ({
  queryKeys: {
    user: {
      profile: (id: string) => mockProfileKey(id),
    },
  },
}));

jest.mock('@/services', () => ({
  getUserProfile: jest.fn(),
}));

describe('useUserProfile', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('uses fallback photo while the profile query is unresolved', () => {
    mockUseQuery.mockReturnValue({
      data: undefined,
      isLoading: true,
    });

    const { result } = renderHook(() =>
      useUserProfile({
        userId: 'staff-1',
        fallbackName: 'Alex',
        fallbackPhotoURL: 'https://example.com/fallback.jpg',
      })
    );

    expect(mockProfileKey).toHaveBeenCalledWith('staff-1');
    expect(result.current.profilePhotoURL).toBe('https://example.com/fallback.jpg');
  });

  it('drops stale fallback photo once the loaded profile has no photo', () => {
    mockUseQuery.mockReturnValue({
      data: {
        uid: 'staff-1',
        name: 'Alex',
        nickname: 'Ace',
        photoURL: null,
      },
      isLoading: false,
    });

    const { result } = renderHook(() =>
      useUserProfile({
        userId: 'staff-1',
        fallbackName: 'Alex',
        fallbackPhotoURL: 'https://example.com/old.jpg',
      })
    );

    expect(result.current.profilePhotoURL).toBeUndefined();
  });

  it('keeps fallback photo when the profile document is missing', () => {
    mockUseQuery.mockReturnValue({
      data: null,
      isLoading: false,
    });

    const { result } = renderHook(() =>
      useUserProfile({
        userId: 'staff-1',
        fallbackName: 'Alex',
        fallbackPhotoURL: 'https://example.com/legacy.jpg',
      })
    );

    expect(result.current.profilePhotoURL).toBe('https://example.com/legacy.jpg');
  });

  it('drops stale fallback nickname once the loaded profile removed it', () => {
    mockUseQuery.mockReturnValue({
      data: {
        uid: 'staff-1',
        name: 'Alex',
        nickname: undefined,
        photoURL: null,
      },
      isLoading: false,
    });

    const { result } = renderHook(() =>
      useUserProfile({
        userId: 'staff-1',
        fallbackName: 'Alex',
        fallbackNickname: 'LegacyNick',
      })
    );

    expect(result.current.displayName).toBe('Alex');
  });

  it('keeps fallback nickname when the profile document is missing', () => {
    mockUseQuery.mockReturnValue({
      data: null,
      isLoading: false,
    });

    const { result } = renderHook(() =>
      useUserProfile({
        userId: 'staff-1',
        fallbackName: 'Alex',
        fallbackNickname: 'LegacyNick',
      })
    );

    expect(result.current.displayName).toBe('Alex(LegacyNick)');
  });
});
