/**
 * pushTokenService.unregisterTokensForSignOut (A3) 테스트
 *
 * @description 로그아웃 시 서버 푸시 토큰 해제의 두 경로(인메모리 토큰 有/無)와
 * 실패 전파 계약을 잠근다. 공용 기기 계정 간 푸시 잔존 방지가 목적이다.
 */

import { unregisterTokensForSignOut } from '../pushTokenService';
import { pushState } from '../pushNotificationState';

const mockUnregisterFCMToken = jest.fn<Promise<void>, [string, string]>();
const mockUnregisterAllFCMTokens = jest.fn<Promise<void>, [string]>();

jest.mock('@/repositories', () => ({
  notificationRepository: {
    unregisterFCMToken: (...args: [string, string]) => mockUnregisterFCMToken(...args),
    unregisterAllFCMTokens: (...args: [string]) => mockUnregisterAllFCMTokens(...args),
  },
}));

jest.mock('@/utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

jest.mock('@/services/observability', () => ({
  crashlyticsService: { leaveBreadcrumb: jest.fn() },
}));

describe('unregisterTokensForSignOut', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    pushState.currentToken = null;
    mockUnregisterFCMToken.mockResolvedValue(undefined);
    mockUnregisterAllFCMTokens.mockResolvedValue(undefined);
  });

  it('인메모리 토큰이 있으면 해당 토큰만 삭제하고 인메모리 상태를 비운다', async () => {
    pushState.currentToken = 'ExponentPushToken[abc]';

    await unregisterTokensForSignOut('user-1');

    expect(mockUnregisterFCMToken).toHaveBeenCalledWith('user-1', 'ExponentPushToken[abc]');
    expect(mockUnregisterAllFCMTokens).not.toHaveBeenCalled();
    // 다음 사용자 로그인 전까지 이전 계정의 토큰이 인메모리에 잔존하지 않아야 한다.
    expect(pushState.currentToken).toBeNull();
  });

  it('인메모리 토큰이 없으면 사용자 전체 토큰을 삭제한다 (폴백)', async () => {
    pushState.currentToken = null;

    await unregisterTokensForSignOut('user-1');

    expect(mockUnregisterAllFCMTokens).toHaveBeenCalledWith('user-1');
    expect(mockUnregisterFCMToken).not.toHaveBeenCalled();
  });

  it('저장소 삭제 실패를 전파한다 (호출자 signOut 이 fail-safe 로 감쌈)', async () => {
    pushState.currentToken = null;
    mockUnregisterAllFCMTokens.mockRejectedValueOnce(new Error('RLS denied'));

    await expect(unregisterTokensForSignOut('user-1')).rejects.toThrow('RLS denied');
  });
});
