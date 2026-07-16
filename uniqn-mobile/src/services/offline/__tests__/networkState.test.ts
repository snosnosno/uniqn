/**
 * networkState — AppState 포그라운드 복귀 재확인(Fix 1) 검증
 *
 * iOS NetInfo 의 isInternetReachable 이 복구 후에도 stale false 로 남을 수 있어,
 * 앱이 포그라운드(active)로 복귀할 때 checkNetworkConnection()으로 NetInfo 를 강제
 * 재평가한다. NetInfo 는 jest.setup 에서 전역 mock 되어 있고, AppState 는 spy 로
 * change 핸들러를 가로채 검증한다. (Platform.OS 는 jest-expo 기본 'ios' → 네이티브 분기)
 */

import { AppState } from 'react-native';
import NetInfo from '@react-native-community/netinfo';

import { initializeNetworkState, resetNetworkStateForTests } from '../networkState';

describe('networkState — AppState 포그라운드 재확인', () => {
  afterEach(() => {
    resetNetworkStateForTests();
  });

  it('앱이 active 로 복귀하면 NetInfo 를 강제 재평가하고, cleanup 시 구독을 해제한다', async () => {
    const remove = jest.fn();
    const addEventListenerSpy = jest
      .spyOn(AppState, 'addEventListener')
      .mockReturnValue({ remove } as unknown as ReturnType<typeof AppState.addEventListener>);

    const cleanup = initializeNetworkState();

    // change 리스너가 등록됐는지
    const changeCall = addEventListenerSpy.mock.calls.find(([type]) => type === 'change');
    expect(changeCall).toBeDefined();
    const handler = changeCall![1] as (state: string) => void;

    // init 시 최초 checkNetworkConnection 호출분을 제외하고 카운트
    (NetInfo.fetch as jest.Mock).mockClear();

    // 포그라운드 복귀 → NetInfo.fetch 강제 재평가(동기 호출부)
    handler('active');
    expect(NetInfo.fetch).toHaveBeenCalledTimes(1);

    // 부동 promise 해제(commitState 완료)
    await Promise.resolve();

    // background/inactive 는 재평가하지 않음
    (NetInfo.fetch as jest.Mock).mockClear();
    handler('background');
    handler('inactive');
    expect(NetInfo.fetch).not.toHaveBeenCalled();

    // cleanup 시 AppState 구독 해제
    cleanup();
    expect(remove).toHaveBeenCalledTimes(1);
  });
});
