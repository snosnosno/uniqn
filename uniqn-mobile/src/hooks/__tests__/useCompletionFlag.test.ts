import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useCompletionFlag } from '../useCompletionFlag';

const mockGetString = jest.fn();
const mockSet = jest.fn();
const mockDelete = jest.fn();
const mockSecureGetItem = jest.fn();
const mockSecureSetItem = jest.fn();
const mockSecureDeleteItem = jest.fn();
const mockUseUserHash = jest.fn();

jest.mock('@/lib/mmkvStorage', () => ({
  getMMKVInstance: () => ({
    getString: mockGetString,
    set: mockSet,
    delete: mockDelete,
  }),
}));

jest.mock('@/lib/secureStorage', () => ({
  getItem: (...args: unknown[]) => mockSecureGetItem(...args),
  setItem: (...args: unknown[]) => mockSecureSetItem(...args),
  deleteItem: (...args: unknown[]) => mockSecureDeleteItem(...args),
}));

jest.mock('@/hooks/useUserHash', () => ({
  useUserHash: () => mockUseUserHash(),
}));

jest.mock('@/utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe('useCompletionFlag', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseUserHash.mockReturnValue('hashed-user');
    mockSecureSetItem.mockResolvedValue(undefined);
    mockSecureDeleteItem.mockResolvedValue(undefined);
  });

  it('restores completion state from secure storage when MMKV is empty', async () => {
    mockGetString.mockReturnValue(undefined);
    mockSecureGetItem.mockImplementation(async (key: string) => {
      if (key.includes('version')) {
        return 1;
      }

      return true;
    });

    const { result } = renderHook(() =>
      useCompletionFlag({
        completedKeyPrefix: 'tutorial:app_intro',
        versionKeyPrefix: 'tutorial:version:app_intro',
        currentVersion: 1,
      })
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.needsAction).toBe(false);
    expect(mockSet).toHaveBeenCalledWith('tutorial:app_intro:hashed-user', 'true');
    expect(mockSet).toHaveBeenCalledWith('tutorial:version:app_intro:hashed-user', '1');
  });

  it('mirrors completion state to secure storage when completed', async () => {
    mockGetString.mockReturnValue(undefined);
    mockSecureGetItem.mockResolvedValue(null);

    const { result } = renderHook(() =>
      useCompletionFlag({
        completedKeyPrefix: 'tutorial:qr_checkin',
        versionKeyPrefix: 'tutorial:version:qr_checkin',
        currentVersion: 1,
      })
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.complete();
    });

    expect(mockSet).toHaveBeenCalledWith('tutorial:qr_checkin:hashed-user', 'true');
    expect(mockSet).toHaveBeenCalledWith('tutorial:version:qr_checkin:hashed-user', '1');
    await waitFor(() => {
      expect(mockSecureSetItem).toHaveBeenCalledWith('tutorial:qr_checkin:hashed-user', true);
      expect(mockSecureSetItem).toHaveBeenCalledWith('tutorial:version:qr_checkin:hashed-user', 1);
    });
  });
});
