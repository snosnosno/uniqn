import { act, renderHook } from '@testing-library/react-native';
import { useInstallPrompt } from '../useInstallPrompt';

const mockOpen = jest.fn();
const mockInfo = jest.fn();

jest.mock('@/stores/modalStore', () => ({
  useModal: () => ({
    open: mockOpen,
  }),
}));

jest.mock('@/stores/toastStore', () => ({
  useToast: () => ({
    info: mockInfo,
  }),
}));

jest.mock('@/constants', () => ({
  getStoreUrl: jest.fn(() => 'https://example.com/store'),
}));

jest.mock('@/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

describe('useInstallPrompt', () => {
  beforeEach(() => {
    mockOpen.mockReset();
    mockInfo.mockReset();
  });

  it('opens a custom install modal for public job actions', async () => {
    const { result } = renderHook(() => useInstallPrompt());

    act(() => {
      result.current.openInstallPrompt('job-card');
    });

    expect(mockOpen).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'custom',
        title: '앱에서 지원할 수 있어요',
      })
    );

    const modalConfig = mockOpen.mock.calls[0][0];

    await act(async () => {
      await modalConfig.confirmButton.onPress();
    });

    expect(mockInfo).toHaveBeenCalledWith('앱 설치 링크는 준비 중입니다.');
  });

  it('uses contextual copy for protected tabs', () => {
    const { result } = renderHook(() => useInstallPrompt());

    act(() => {
      result.current.openInstallPrompt('schedule-tab');
    });

    expect(mockOpen).toHaveBeenCalledWith(
      expect.objectContaining({
        title: '앱에서 스케줄을 확인할 수 있어요',
      })
    );
  });
});
