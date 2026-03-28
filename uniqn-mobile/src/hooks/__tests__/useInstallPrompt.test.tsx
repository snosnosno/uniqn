import { act, fireEvent, render, renderHook } from '@testing-library/react-native';
import { useInstallPrompt } from '../useInstallPrompt';

const mockOpen = jest.fn();
const mockClose = jest.fn();
const mockInfo = jest.fn();
const mockPush = jest.fn();
const expoRouter = jest.requireMock('expo-router') as { router?: { push?: jest.Mock } };

jest.mock('@/stores/modalStore', () => ({
  useModal: () => ({
    open: mockOpen,
    close: mockClose,
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
    mockClose.mockReset();
    mockInfo.mockReset();
    mockPush.mockReset();
    expoRouter.router = {
      ...(expoRouter.router ?? {}),
      push: mockPush,
    };
  });

  it('renders a login CTA and uses an explicit redirect for public job actions', async () => {
    const { result } = renderHook(() => useInstallPrompt());

    act(() => {
      result.current.openInstallPrompt('job-card', {
        loginRedirect: '/(app)/jobs/job-123',
      });
    });

    expect(mockOpen).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'custom',
      })
    );

    const modalConfig = mockOpen.mock.calls[0][0];
    const { getByText } = render(modalConfig.content);

    expect(getByText('로그인')).toBeTruthy();

    fireEvent.press(getByText('로그인'));

    expect(mockClose).toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalledWith('/(auth)/login?redirect=%2F(app)%2Fjobs%2Fjob-123');

    await act(async () => {
      await modalConfig.confirmButton.onPress();
    });

    expect(mockInfo).toHaveBeenCalledWith('앱 설치 링크는 준비 중입니다.');
  });

  it('uses the default protected redirect for public tabs', () => {
    const { result } = renderHook(() => useInstallPrompt());

    act(() => {
      result.current.openInstallPrompt('schedule-tab');
    });

    const modalConfig = mockOpen.mock.calls[0][0];

    act(() => {
      modalConfig.content.props.onLogin();
    });

    expect(mockPush).toHaveBeenCalledWith('/(auth)/login?redirect=%2F(app)%2F(tabs)%2Fschedule');
  });
});
