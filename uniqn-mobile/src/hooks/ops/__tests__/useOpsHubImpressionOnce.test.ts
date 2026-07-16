import { renderHook } from '@testing-library/react-native';
import { useOpsHubImpressionOnce } from '../useOpsHubImpressionOnce';

const mockTrackOpsFunnel = jest.fn();

jest.mock('@/services/observability/analyticsService', () => ({
  trackOpsFunnel: (...args: unknown[]) => mockTrackOpsFunnel(...args),
}));

describe('useOpsHubImpressionOnce', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('enabled=false 면 impression 을 발화하지 않는다', () => {
    renderHook(() => useOpsHubImpressionOnce(false));
    expect(mockTrackOpsFunnel).not.toHaveBeenCalled();
  });

  it('enabled=true 면 ops_hub_impression 을 1회 발화한다', () => {
    renderHook(() => useOpsHubImpressionOnce(true));
    expect(mockTrackOpsFunnel).toHaveBeenCalledTimes(1);
    expect(mockTrackOpsFunnel).toHaveBeenCalledWith('ops_hub_impression');
  });

  it('재렌더가 반복돼도 impression 은 1회만 발화한다', () => {
    const { rerender } = renderHook(() => useOpsHubImpressionOnce(true));
    rerender({});
    rerender({});
    expect(mockTrackOpsFunnel).toHaveBeenCalledTimes(1);
  });

  it('enabled 이 false→true 로 바뀌면 그 시점에 1회만 발화한다', () => {
    const { rerender } = renderHook(({ e }: { e: boolean }) => useOpsHubImpressionOnce(e), {
      initialProps: { e: false },
    });
    expect(mockTrackOpsFunnel).not.toHaveBeenCalled();

    rerender({ e: true });
    expect(mockTrackOpsFunnel).toHaveBeenCalledTimes(1);

    rerender({ e: true });
    expect(mockTrackOpsFunnel).toHaveBeenCalledTimes(1);
  });
});
