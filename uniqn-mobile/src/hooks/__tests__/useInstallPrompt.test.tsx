import { act, fireEvent, render, renderHook } from '@testing-library/react-native';
import { Linking } from 'react-native';
import { useInstallPrompt } from '../useInstallPrompt';

const mockOpen = jest.fn();
const mockClose = jest.fn();
const mockError = jest.fn();
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
    error: mockError,
  }),
}));

jest.mock('@/constants', () => ({
  resolveInstallStoreUrl: jest.fn(() => 'https://apps.apple.com/kr/app/uniqn/id6758857038'),
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
    mockError.mockReset();
    mockPush.mockReset();
    (Linking.openURL as jest.Mock) = jest.fn().mockResolvedValue(undefined);
    expoRouter.router = {
      ...(expoRouter.router ?? {}),
      push: mockPush,
    };
  });

  it('renders a login CTA and uses an explicit redirect for public job actions', () => {
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
  });

  it('opens the resolved store url when the install CTA is pressed', async () => {
    const { result } = renderHook(() => useInstallPrompt());

    act(() => {
      result.current.openInstallPrompt('job-detail-cta', {
        loginRedirect: '/(app)/jobs/job-123/apply',
      });
    });

    const modalConfig = mockOpen.mock.calls[0][0];

    await act(async () => {
      await modalConfig.confirmButton.onPress();
    });

    expect(Linking.openURL).toHaveBeenCalledWith(
      'https://apps.apple.com/kr/app/uniqn/id6758857038'
    );
    expect(mockClose).toHaveBeenCalled();
    expect(mockError).not.toHaveBeenCalled();
  });

  it('shows an error toast and keeps the modal open when the store fails to launch', async () => {
    (Linking.openURL as jest.Mock).mockRejectedValueOnce(new Error('no handler'));

    const { result } = renderHook(() => useInstallPrompt());

    act(() => {
      result.current.openInstallPrompt('job-detail-cta', {
        loginRedirect: '/(app)/jobs/job-123/apply',
      });
    });

    const modalConfig = mockOpen.mock.calls[0][0];

    await act(async () => {
      await modalConfig.confirmButton.onPress();
    });

    expect(Linking.openURL).toHaveBeenCalled();
    expect(mockError).toHaveBeenCalledWith('스토어를 열 수 없어요. 잠시 후 다시 시도해주세요.');
    expect(mockClose).not.toHaveBeenCalled();
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
