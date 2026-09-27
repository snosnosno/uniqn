import { describe, expect, it } from 'vitest';
import { isChunkLoadError, shouldReloadForChunkError } from './chunkReload';

describe('isChunkLoadError', () => {
  it.each([
    'Failed to fetch dynamically imported module: https://ops.uniqn.app/assets/MonitorPage-abc.js',
    'Importing a module script failed.',
    'error loading dynamically imported module',
    "Expected a JavaScript module script but the server responded with a MIME type of 'text/html'",
  ])('브라우저별 청크 로딩 실패 문구를 인식한다: %s', (message) => {
    expect(isChunkLoadError(new Error(message))).toBe(true);
  });

  it('일반 오류·비 Error 값은 청크 오류가 아니다', () => {
    expect(isChunkLoadError(new Error('Cannot read properties of undefined'))).toBe(false);
    expect(isChunkLoadError('string')).toBe(false);
    expect(isChunkLoadError(null)).toBe(false);
  });
});

describe('shouldReloadForChunkError', () => {
  const NOW = 1_000_000;

  it('최근 새로고침 기록이 없으면 새로고침한다', () => {
    expect(shouldReloadForChunkError(null, NOW)).toBe(true);
  });

  it('직전 새로고침이 제한 시간 안이면 반복하지 않는다(무한 루프 방지)', () => {
    expect(shouldReloadForChunkError(String(NOW - 5_000), NOW)).toBe(false);
  });

  it('제한 시간이 지났거나 기록이 깨졌으면 다시 허용한다', () => {
    expect(shouldReloadForChunkError(String(NOW - 60_000), NOW)).toBe(true);
    expect(shouldReloadForChunkError('garbage', NOW)).toBe(true);
  });
});
