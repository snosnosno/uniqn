/**
 * chatFlag — 채팅 원격 플래그 파서
 *
 * 핵심 불변식: 서버가 다크(open·send 미부여)인 동안 클라 진입점이 열리면 안 된다.
 * → 원격 값이 없거나 이상하면 **빌드타임 fallback(false)** 으로 닫힌다(fail-closed).
 */
import { featureFlags } from '@/config/featureFlags';
import { parseChatFlag, resolveChatEnabled } from '../chatFlag';

describe('parseChatFlag', () => {
  it('{"enabled": true} → true', () => {
    expect(parseChatFlag({ enabled: true }, false)).toBe(true);
  });

  it('{"enabled": false} → false', () => {
    expect(parseChatFlag({ enabled: false }, true)).toBe(false);
  });

  it.each([
    ['null', null],
    ['undefined', undefined],
    ['빈 객체', {}],
    ['문자열 true', { enabled: 'true' }],
    ['숫자 1', { enabled: 1 }],
    ['버전 게이트 모양', { ios: true, android: true, web: true }],
    ['배열', [true]],
    ['문자열', 'enabled'],
  ])('%s → fallback', (_label, raw) => {
    expect(parseChatFlag(raw, false)).toBe(false);
    expect(parseChatFlag(raw, true)).toBe(true);
  });
});

describe('resolveChatEnabled (빌드타임 fallback 적용)', () => {
  it('빌드타임 fallback 은 false 다 — 서버 다크 동안 fail-closed', () => {
    expect(featureFlags.chat_enabled).toBe(false);
  });

  it('원격 행이 없으면(null) 닫힌다', () => {
    expect(resolveChatEnabled(null)).toBe(false);
  });

  it('원격 모양이 틀리면 닫힌다', () => {
    expect(resolveChatEnabled({ enabled: 'yes' })).toBe(false);
  });

  it('원격이 명시적으로 켜면 열린다', () => {
    expect(resolveChatEnabled({ enabled: true })).toBe(true);
  });
});
