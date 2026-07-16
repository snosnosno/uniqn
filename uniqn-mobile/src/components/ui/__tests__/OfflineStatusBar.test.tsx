/**
 * OfflineStatusBar — impeccable v2 §25 동작 검증
 *
 * 전역 network 싱글톤(getNetworkState / subscribeToNetworkState)을 mock 해
 * 오프라인 진입·복구 시퀀스와 2초 auto-dismiss 를 검증한다.
 */

import { act, render } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { OfflineStatusBar } from '../OfflineStatusBar';
import { WifiIcon, WifiOff } from '@/components/icons';

jest.mock('nativewind', () => ({
  useColorScheme: () => ({ colorScheme: 'light' }),
}));

// ── jest.mock 팩토리는 호이스팅되므로 `mock` 프리픽스 변수만 허용 ──────
type Listener = () => void;
let mockIsOnline = true;
const mockSubscribe = jest.fn();

jest.mock('@/services/offline/networkState', () => ({
  getNetworkState: jest.fn(() => ({
    isOnline: mockIsOnline,
    isOffline: !mockIsOnline,
    isChecking: false,
    connectionType: 'wifi',
    isInternetReachable: mockIsOnline,
    lastChecked: new Date(),
    details: null,
  })),
  subscribeToNetworkState: (listener: Listener) => {
    mockSubscribe(listener);
    return () => {
      /* unsub noop */
    };
  },
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 44, bottom: 0, left: 0, right: 0 }),
}));

function triggerNetworkChange(online: boolean) {
  mockIsOnline = online;
  // 구독된 모든 리스너 호출
  for (const call of mockSubscribe.mock.calls) {
    const listener = call[0] as Listener;
    listener();
  }
}

describe('OfflineStatusBar', () => {
  beforeEach(() => {
    mockIsOnline = true;
    mockSubscribe.mockClear();
  });

  // fake timer가 실패한 테스트에서 다음 테스트로 누수되지 않도록 매번 리셋
  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders nothing when online on mount', () => {
    const { queryByTestId } = render(<OfflineStatusBar />);
    expect(queryByTestId('offline-status-bar')).toBeNull();
  });

  it('renders "오프라인 상태입니다" when network starts offline', () => {
    mockIsOnline = false;
    const { getByTestId } = render(<OfflineStatusBar />);
    const bar = getByTestId('offline-status-bar');
    expect(bar.props.accessibilityLabel).toBe('오프라인 상태입니다');
  });

  it('sets accessibilityRole="alert" + accessibilityLiveRegion="polite"', () => {
    mockIsOnline = false;
    const { getByTestId } = render(<OfflineStatusBar />);
    const bar = getByTestId('offline-status-bar');
    expect(bar.props.accessibilityRole).toBe('alert');
    expect(bar.props.accessibilityLiveRegion).toBe('polite');
  });

  it('shows reconnect message when transitioning online → offline → online', () => {
    mockIsOnline = true;
    const { queryByTestId, getByTestId } = render(<OfflineStatusBar />);
    expect(queryByTestId('offline-status-bar')).toBeNull();

    act(() => {
      triggerNetworkChange(false);
    });
    expect(getByTestId('offline-status-bar').props.accessibilityLabel).toBe('오프라인 상태입니다');

    act(() => {
      triggerNetworkChange(true);
    });
    expect(getByTestId('offline-status-bar').props.accessibilityLabel).toBe(
      '온라인으로 돌아왔어요'
    );
  });

  it('auto-dismisses the reconnect message after 2s', () => {
    jest.useFakeTimers();
    mockIsOnline = true;
    const { queryByTestId, getByTestId } = render(<OfflineStatusBar />);

    act(() => {
      triggerNetworkChange(false);
    });
    act(() => {
      triggerNetworkChange(true);
    });
    expect(getByTestId('offline-status-bar').props.accessibilityLabel).toBe(
      '온라인으로 돌아왔어요'
    );

    act(() => {
      jest.advanceTimersByTime(2000);
    });
    // exit 애니메이션(225ms) 동안은 아직 렌더 유지
    expect(queryByTestId('offline-status-bar')).not.toBeNull();

    act(() => {
      jest.advanceTimersByTime(225);
    });
    expect(queryByTestId('offline-status-bar')).toBeNull();
    jest.useRealTimers();
  });

  it('does NOT show reconnect banner if the mount value is online and never went offline', () => {
    mockIsOnline = true;
    const { queryByTestId } = render(<OfflineStatusBar />);

    // 같은 online 상태로 다시 트리거돼도 배너는 뜨지 않아야 함
    act(() => {
      triggerNetworkChange(true);
    });
    expect(queryByTestId('offline-status-bar')).toBeNull();
  });

  it('cancels the pending 2s dismiss when network drops again before timeout', () => {
    jest.useFakeTimers();
    mockIsOnline = true;
    const { getByTestId } = render(<OfflineStatusBar />);

    // offline → online → offline (2s 안에)
    act(() => {
      triggerNetworkChange(false);
    });
    act(() => {
      triggerNetworkChange(true);
    });
    expect(getByTestId('offline-status-bar').props.accessibilityLabel).toBe(
      '온라인으로 돌아왔어요'
    );

    act(() => {
      jest.advanceTimersByTime(500);
      triggerNetworkChange(false);
    });
    expect(getByTestId('offline-status-bar').props.accessibilityLabel).toBe('오프라인 상태입니다');

    // 기존 2s timer 가 취소됐는지 — 이후 2s 가 지나도 여전히 오프라인 메시지 유지
    act(() => {
      jest.advanceTimersByTime(2000);
    });
    expect(getByTestId('offline-status-bar').props.accessibilityLabel).toBe('오프라인 상태입니다');
    jest.useRealTimers();
  });

  it('오프라인 배너는 warning 톤 배경으로 렌더된다', () => {
    mockIsOnline = false;
    const { getByTestId, UNSAFE_queryAllByType } = render(<OfflineStatusBar />);
    const flat = StyleSheet.flatten(getByTestId('offline-status-bar').props.style);
    expect(flat.backgroundColor).toBe('rgba(161,98,7,0.15)'); // light warning subtle
    expect(UNSAFE_queryAllByType(WifiOff)).toHaveLength(1);
    expect(UNSAFE_queryAllByType(WifiIcon)).toHaveLength(0);
  });

  it('복구 배너는 success 톤 배경 + Wifi 아이콘으로 렌더된다', () => {
    mockIsOnline = true;
    const { getByTestId, UNSAFE_queryAllByType } = render(<OfflineStatusBar />);

    act(() => {
      triggerNetworkChange(false);
    });
    act(() => {
      triggerNetworkChange(true);
    });

    const flat = StyleSheet.flatten(getByTestId('offline-status-bar').props.style);
    expect(flat.backgroundColor).toBe('rgba(22,163,74,0.15)'); // light success subtle
    expect(UNSAFE_queryAllByType(WifiIcon)).toHaveLength(1);
    expect(UNSAFE_queryAllByType(WifiOff)).toHaveLength(0);
  });

  it('exit 애니메이션 동안에도 복구 라벨과 success 톤을 유지한다', () => {
    jest.useFakeTimers();
    mockIsOnline = true;
    const { getByTestId } = render(<OfflineStatusBar />);

    act(() => {
      triggerNetworkChange(false);
    });
    act(() => {
      triggerNetworkChange(true);
    });
    act(() => {
      jest.advanceTimersByTime(2000); // dismiss 발동 → exit 구간 진입
    });

    const bar = getByTestId('offline-status-bar');
    expect(bar.props.accessibilityLabel).toBe('온라인으로 돌아왔어요');
    expect(StyleSheet.flatten(bar.props.style).backgroundColor).toBe('rgba(22,163,74,0.15)');
    jest.useRealTimers();
  });
});
