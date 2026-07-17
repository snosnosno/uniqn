import { renderHook } from '@testing-library/react-native';
import { useOpsHubEnteredOnce } from '../useOpsHubEnteredOnce';

const mockTrackOpsFunnel = jest.fn();

jest.mock('@/services/observability/analyticsService', () => ({
  trackOpsFunnel: (...args: unknown[]) => mockTrackOpsFunnel(...args),
}));

describe('useOpsHubEnteredOnce', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('기본(enabled 생략)으로 마운트 시 ops_hub_entered 를 1회 발화한다', () => {
    renderHook(() => useOpsHubEnteredOnce());
    expect(mockTrackOpsFunnel).toHaveBeenCalledTimes(1);
    expect(mockTrackOpsFunnel).toHaveBeenCalledWith('ops_hub_entered');
  });

  it('enabled=false 면 진입 이벤트를 발화하지 않는다', () => {
    renderHook(() => useOpsHubEnteredOnce(false));
    expect(mockTrackOpsFunnel).not.toHaveBeenCalled();
  });

  it('재렌더가 반복돼도 진입 이벤트는 1회만 발화한다', () => {
    const { rerender } = renderHook(() => useOpsHubEnteredOnce(true));
    rerender({});
    rerender({});
    expect(mockTrackOpsFunnel).toHaveBeenCalledTimes(1);
  });

  it('enabled 이 false→true 로 바뀌면 그 시점에 1회만 발화한다', () => {
    const { rerender } = renderHook(({ e }: { e: boolean }) => useOpsHubEnteredOnce(e), {
      initialProps: { e: false },
    });
    expect(mockTrackOpsFunnel).not.toHaveBeenCalled();

    rerender({ e: true });
    expect(mockTrackOpsFunnel).toHaveBeenCalledTimes(1);

    rerender({ e: true });
    expect(mockTrackOpsFunnel).toHaveBeenCalledTimes(1);
  });
});
