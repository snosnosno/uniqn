/**
 * openExternalUrl — 외부 앱 링크 실패 흡수 검증.
 *
 * Sentry UNIQN-MOBILE-1F: 메일 계정이 없는 기기(앱 심사 기기 등)에서
 * `Linking.openURL('mailto:...')` 이 reject → catch 부재로 unhandled rejection.
 * 사용자에겐 아무 반응이 없었다. 실패를 흡수하고 값을 안내하는 계약을 고정한다.
 */
import { Alert, Linking, Platform } from 'react-native';
import { openExternalUrl } from '../externalLink';
import { logger } from '../logger';

const originalOSDescriptor = Object.getOwnPropertyDescriptor(Platform, 'OS');

function setPlatformOS(os: 'ios' | 'web') {
  Object.defineProperty(Platform, 'OS', {
    configurable: true,
    get: () => os,
  });
}

describe('openExternalUrl', () => {
  let alertSpy: jest.SpyInstance;
  let openURLSpy: jest.SpyInstance;
  let warnSpy: jest.SpyInstance;

  const options = {
    fallbackTitle: '메일 앱을 열 수 없어요',
    fallbackValue: 'support@uniqn.app',
    fallbackHint: '아래 주소로 직접 메일을 보내주세요.',
  };

  beforeEach(() => {
    // restoreMocks: true 환경 — spy 는 매 테스트 재설치
    alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    openURLSpy = jest.spyOn(Linking, 'openURL');
    warnSpy = jest.spyOn(logger, 'warn').mockImplementation(() => undefined);
    setPlatformOS('ios');
  });

  afterAll(() => {
    if (originalOSDescriptor) {
      Object.defineProperty(Platform, 'OS', originalOSDescriptor);
    }
  });

  it('링크를 열 수 있으면 true 를 반환하고 안내를 띄우지 않는다', async () => {
    openURLSpy.mockResolvedValue(true);

    const opened = await openExternalUrl('mailto:support@uniqn.app', options);

    expect(opened).toBe(true);
    expect(openURLSpy).toHaveBeenCalledWith('mailto:support@uniqn.app');
    expect(alertSpy).not.toHaveBeenCalled();
  });

  it('핸들러 앱이 없어 reject 되면 throw 하지 않고 값을 안내한다', async () => {
    openURLSpy.mockRejectedValue(new Error('Unable to open URL: mailto:support@uniqn.app'));

    const opened = await openExternalUrl('mailto:support@uniqn.app', options);

    expect(opened).toBe(false);
    expect(alertSpy).toHaveBeenCalledWith(
      '메일 앱을 열 수 없어요',
      '아래 주소로 직접 메일을 보내주세요.\n\nsupport@uniqn.app'
    );
  });

  it('실패 로그에 URL 전문(개인정보)을 남기지 않고 scheme 만 남긴다', async () => {
    openURLSpy.mockRejectedValue(new Error('Unable to open URL'));

    await openExternalUrl('mailto:hong@example.com', options);

    expect(warnSpy).toHaveBeenCalledTimes(1);
    const [, context] = warnSpy.mock.calls[0] as [string, Record<string, unknown>];
    expect(context.scheme).toBe('mailto');
    expect(JSON.stringify(context)).not.toContain('hong@example.com');
  });

  it('실패를 error 레벨로 올리지 않는다 (기기 환경 문제 — Sentry 노이즈 방지)', async () => {
    const errorSpy = jest.spyOn(logger, 'error').mockImplementation(() => undefined);
    openURLSpy.mockRejectedValue(new Error('Unable to open URL'));

    await openExternalUrl('tel:01012345678', options);

    expect(errorSpy).not.toHaveBeenCalled();
  });
});
