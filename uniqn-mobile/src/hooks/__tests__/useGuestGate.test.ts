import { renderHook } from '@testing-library/react-native';
import { useGuestGate } from '@/hooks/useGuestGate';

const mockModalOpen = jest.fn();
const mockOpenInstallPrompt = jest.fn();
const mockRouterPush = jest.fn();
let mockIsWeb = false;

jest.mock('expo-router', () => ({
  router: { push: (...args: unknown[]) => mockRouterPush(...args) },
}));

jest.mock('@/stores/modalStore', () => ({
  useModal: () => ({ open: mockModalOpen }),
}));

jest.mock('@/hooks/useInstallPrompt', () => ({
  useInstallPrompt: () => ({ openInstallPrompt: mockOpenInstallPrompt }),
}));

jest.mock('@/utils/platform', () => ({
  get isWeb() {
    return mockIsWeb;
  },
}));

describe('useGuestGate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsWeb = false;
  });

  it('앱에서는 로그인 안내를 띄우고, 로그인을 누르면 누르려던 곳을 redirect 로 넘긴다', () => {
    const { result } = renderHook(() => useGuestGate());

    result.current.promptGuest('job-card', '/(app)/jobs/job-1');

    expect(mockOpenInstallPrompt).not.toHaveBeenCalled();
    expect(mockModalOpen).toHaveBeenCalledTimes(1);
    const config = mockModalOpen.mock.calls[0][0];
    expect(config.title).toBe('로그인이 필요해요');

    config.confirmButton.onPress();
    expect(mockRouterPush).toHaveBeenCalledWith('/(auth)/login?redirect=%2F(app)%2Fjobs%2Fjob-1');
  });

  it('웹에서는 앱 설치 안내를 띄운다(로그인 redirect 는 그대로 전달)', () => {
    mockIsWeb = true;
    const { result } = renderHook(() => useGuestGate());

    result.current.promptGuest('schedule-tab', '/(app)/(tabs)/schedule');

    expect(mockModalOpen).not.toHaveBeenCalled();
    expect(mockOpenInstallPrompt).toHaveBeenCalledWith('schedule-tab', {
      loginRedirect: '/(app)/(tabs)/schedule',
    });
  });
});
