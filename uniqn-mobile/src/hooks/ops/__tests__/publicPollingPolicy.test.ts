/**
 * 공개 폴링 실패 정책 회귀 테스트 (감사 monitor-01).
 *
 * 고정하려는 계약은 하나다 — **토큰 무효만 영구 정지, 나머지는 계속 폴링**.
 * 종전 코드는 `q.state.status === 'error'` 로 끊어 네트워크가 1초 끊긴 것도 영구 정지였고,
 * 그 상태가 화면에서 "유효하지 않은 링크"로 표시됐다.
 */
import { BusinessError, NetworkError, ERROR_CODES } from '@/errors';
import {
  PUBLIC_POLL_INTERVAL_MS,
  PUBLIC_POLL_MAX_INTERVAL_MS,
  isTokenInvalidError,
  publicPollInterval,
  publicRefetchInterval,
  publicShouldRetry,
} from '../publicPollingPolicy';

const MONITOR_CODE = ERROR_CODES.OPS_MONITOR_TOKEN_INVALID;
const VIEW_CODE = ERROR_CODES.OPS_VIEW_TOKEN_INVALID;

describe('isTokenInvalidError', () => {
  it('해당 토큰 무효 코드의 BusinessError 만 참', () => {
    expect(isTokenInvalidError(new BusinessError(MONITOR_CODE), MONITOR_CODE)).toBe(true);
    expect(isTokenInvalidError(new BusinessError(VIEW_CODE), VIEW_CODE)).toBe(true);
  });

  it('다른 표면의 토큰 무효 코드는 거짓 — 모니터/플레이어뷰가 서로의 에러를 삼키면 안 된다', () => {
    expect(isTokenInvalidError(new BusinessError(VIEW_CODE), MONITOR_CODE)).toBe(false);
  });

  it('네트워크 오류·정체불명 오류는 거짓 (이게 monitor-01 의 핵심)', () => {
    expect(
      isTokenInvalidError(new NetworkError(ERROR_CODES.NETWORK_REQUEST_FAILED), MONITOR_CODE)
    ).toBe(false);
    expect(isTokenInvalidError(new Error('Failed to fetch'), MONITOR_CODE)).toBe(false);
    expect(isTokenInvalidError(null, MONITOR_CODE)).toBe(false);
    expect(isTokenInvalidError(undefined, MONITOR_CODE)).toBe(false);
  });
});

describe('publicPollInterval', () => {
  it('실패가 없으면 기본 주기', () => {
    expect(publicPollInterval(0)).toBe(PUBLIC_POLL_INTERVAL_MS);
    expect(publicPollInterval(-1)).toBe(PUBLIC_POLL_INTERVAL_MS);
  });

  it('연속 실패마다 2배씩 늘어난다', () => {
    expect(publicPollInterval(1)).toBe(8000);
    expect(publicPollInterval(2)).toBe(16000);
    expect(publicPollInterval(3)).toBe(32000);
  });

  it('상한을 넘지 않는다 — 무인 전광판이 "안 돌아온다"고 느낄 만큼 벌어지면 안 된다', () => {
    expect(publicPollInterval(4)).toBe(PUBLIC_POLL_MAX_INTERVAL_MS);
    expect(publicPollInterval(99)).toBe(PUBLIC_POLL_MAX_INTERVAL_MS);
  });
});

describe('publicRefetchInterval', () => {
  it('토큰 무효만 false(영구 정지)', () => {
    expect(publicRefetchInterval(new BusinessError(MONITOR_CODE), 1, MONITOR_CODE)).toBe(false);
  });

  it('네트워크 오류는 폴링을 유지한다 — 종전 결함의 회귀 관측점', () => {
    const network = new NetworkError(ERROR_CODES.NETWORK_REQUEST_FAILED);
    expect(publicRefetchInterval(network, 1, MONITOR_CODE)).toBe(8000);
    expect(publicRefetchInterval(network, 3, MONITOR_CODE)).toBe(32000);
  });

  it('성공 상태(에러 없음)면 기본 주기로 돌아온다', () => {
    expect(publicRefetchInterval(null, 0, MONITOR_CODE)).toBe(PUBLIC_POLL_INTERVAL_MS);
  });
});

describe('publicShouldRetry', () => {
  it('토큰 무효는 즉시 포기 (재시도 폭주 금지)', () => {
    expect(publicShouldRetry(0, new BusinessError(MONITOR_CODE), MONITOR_CODE)).toBe(false);
  });

  it('네트워크 오류는 제한 횟수까지 즉시 재시도', () => {
    const network = new NetworkError(ERROR_CODES.NETWORK_REQUEST_FAILED);
    expect(publicShouldRetry(0, network, MONITOR_CODE)).toBe(true);
    expect(publicShouldRetry(1, network, MONITOR_CODE)).toBe(true);
    expect(publicShouldRetry(2, network, MONITOR_CODE)).toBe(false);
  });
});
