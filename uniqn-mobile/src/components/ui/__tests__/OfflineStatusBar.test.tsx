/**
 * OfflineStatusBar — impeccable v2 §25 동작 검증
 *
 * 전역 network 싱글톤(getNetworkState / subscribeToNetworkState)을 mock 해
 * 오프라인 진입·복구 시퀀스와 2초 auto-dismiss 를 검증한다.
 *
 * ⚠️ 플랩 가드(MIN_OFFLINE_FOR_RECONNECT_MS=1000ms) 도입 후, 복구 배너를 검증하는
 * 케이스는 fake timers 로 통일하고 오프라인 진입 후 1초 이상 경과시킨 뒤 온라인으로
 * 전환한다(modern fake timers 는 Date.now 도 함께 진행). 즉시 offline→online 전환은
 * 경과 ~0ms → 플랩 가드에 걸려 복구 배너가 뜨지 않는다.
 */

import { act, render } from '@testing-library/react-native';
import { AccessibilityInfo, StyleSheet } from 'react-native';

import { OfflineStatusBar } from '../OfflineStatusBar';
import { WifiIcon, WifiOff } from '@/components/icons';

// ── jest.mock 팩토리는 호이스팅되므로 `mock` 프리픽스 변수만 허용 ──────
let mockColorScheme = 'light';
jest.mock('nativewind', () => ({
  useColorScheme: () => ({ colorScheme: mockColorScheme }),
}));

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
    mockColorScheme = 'light';
    mockSubscribe.mockClear();
    // Fix 2: iOS announceForAccessibility 명시 호출을 제어된 no-op 으로 스텁.
    // restoreMocks:true 라 매 테스트 후 복원되므로 모듈 스코프가 아닌 beforeEach 에서 설치.
    jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => {
      /* no-op: 낭독 부수효과 차단 */
    });
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

  it('iOS 에서 오프라인 진입 시 announceForAccessibility 로 낭독한다', () => {
    mockIsOnline = false;
    render(<OfflineStatusBar />);
    expect(AccessibilityInfo.announceForAccessibility).toHaveBeenCalledWith('오프라인 상태입니다');
  });

  it('shows reconnect message when transitioning online → offline → online', () => {
    jest.useFakeTimers();
    mockIsOnline = true;
    const { queryByTestId, getByTestId } = render(<OfflineStatusBar />);
    expect(queryByTestId('offline-status-bar')).toBeNull();

    act(() => {
      triggerNetworkChange(false);
    });
    expect(getByTestId('offline-status-bar').props.accessibilityLabel).toBe('오프라인 상태입니다');

    act(() => {
      jest.advanceTimersByTime(1500); // 플랩 가드 임계(1초) 초과
    });
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
      jest.advanceTimersByTime(1500);
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

    // offline → (1.5s 경과) → online → offline (2s 안에)
    act(() => {
      triggerNetworkChange(false);
    });
    act(() => {
      jest.advanceTimersByTime(1500);
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
  });

  it('오프라인이 1초 미만이면(플랩) 복구 배너 없이 조용히 사라진다', () => {
    jest.useFakeTimers();
    mockIsOnline = true;
    const { queryByTestId, getByTestId } = render(<OfflineStatusBar />);

    act(() => {
      triggerNetworkChange(false);
    });
    expect(getByTestId('offline-status-bar').props.accessibilityLabel).toBe('오프라인 상태입니다');

    act(() => {
      jest.advanceTimersByTime(500); // 1초 미만
    });
    act(() => {
      triggerNetworkChange(true);
    });

    // 복구('온라인으로 돌아왔어요')로 전환되지 않고 오프라인 표기를 유지한 채 exit
    expect(getByTestId('offline-status-bar').props.accessibilityLabel).toBe('오프라인 상태입니다');
    expect(AccessibilityInfo.announceForAccessibility).not.toHaveBeenCalledWith(
      '온라인으로 돌아왔어요'
    );

    act(() => {
      jest.advanceTimersByTime(225); // exit 완료 → 언마운트
    });
    expect(queryByTestId('offline-status-bar')).toBeNull();
  });

  it('오프라인 배너는 warning 톤 배경으로 렌더된다', () => {
    mockIsOnline = false;
    const { getByTestId, UNSAFE_queryAllByType } = render(<OfflineStatusBar />);
    const flat = StyleSheet.flatten(getByTestId('offline-status-bar').props.style);
    expect(flat.backgroundColor).toBe('rgba(161,98,7,0.15)'); // light warning subtle
    expect(UNSAFE_queryAllByType(WifiOff)).toHaveLength(1);
    expect(UNSAFE_queryAllByType(WifiIcon)).toHaveLength(0);
  });

  it('dark 팔레트에서 오프라인 배너는 dark warning 톤 배경으로 렌더된다', () => {
    mockColorScheme = 'dark';
    mockIsOnline = false;
    const { getByTestId } = render(<OfflineStatusBar />);
    const flat = StyleSheet.flatten(getByTestId('offline-status-bar').props.style);
    expect(flat.backgroundColor).toBe('rgba(212,160,23,0.15)'); // dark warning subtle
  });

  it('복구 배너는 success 톤 배경 + Wifi 아이콘으로 렌더된다', () => {
    jest.useFakeTimers();
    mockIsOnline = true;
    const { getByTestId, UNSAFE_queryAllByType } = render(<OfflineStatusBar />);

    act(() => {
      triggerNetworkChange(false);
    });
    act(() => {
      jest.advanceTimersByTime(1500);
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
      jest.advanceTimersByTime(1500);
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
  });

  it('reduce motion 이어도 2초 후 지연 언마운트가 동작한다', async () => {
    // 모듈 스코프 spyOn 은 restoreMocks 로 2번째 테스트부터 무력화되므로 테스트 내부에서 설치
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    jest.useFakeTimers();
    mockIsOnline = true;
    const { queryByTestId } = render(<OfflineStatusBar />);

    // isReduceMotionEnabled Promise 해제(reduceMotion=true 반영)
    await act(async () => {
      /* microtask flush: isReduceMotionEnabled Promise 해제 */
    });

    act(() => {
      triggerNetworkChange(false);
    });
    act(() => {
      jest.advanceTimersByTime(1500);
    });
    act(() => {
      triggerNetworkChange(true);
    });
    expect(queryByTestId('offline-status-bar')).not.toBeNull();

    act(() => {
      jest.advanceTimersByTime(2000); // dismiss → hidden(exit 시작)
    });
    act(() => {
      jest.advanceTimersByTime(225); // 지연 언마운트
    });
    expect(queryByTestId('offline-status-bar')).toBeNull();
  });

  it('exit(225ms) 도중 재오프라인되면 언마운트가 취소되고 오프라인 배너가 유지된다', () => {
    jest.useFakeTimers();
    mockIsOnline = true;
    const { getByTestId } = render(<OfflineStatusBar />);

    act(() => {
      triggerNetworkChange(false);
    });
    act(() => {
      jest.advanceTimersByTime(1500);
    });
    act(() => {
      triggerNetworkChange(true); // reconnected
    });
    act(() => {
      jest.advanceTimersByTime(2000); // dismiss → hidden, 언마운트 타이머(225ms) 예약
    });
    act(() => {
      jest.advanceTimersByTime(100); // exit 진행 중(225ms 미만)
    });
    act(() => {
      triggerNetworkChange(false); // 재오프라인 → 언마운트 취소
    });
    act(() => {
      jest.advanceTimersByTime(225); // 원래 언마운트 시점 경과
    });

    expect(getByTestId('offline-status-bar').props.accessibilityLabel).toBe('오프라인 상태입니다');
  });
});
