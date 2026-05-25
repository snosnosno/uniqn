import { getStoreUrl, resolveInstallStoreUrl, UPDATE_POLICY } from '@/constants/version';

describe('getStoreUrl', () => {
  it('returns the configured App Store url on iOS', () => {
    expect(getStoreUrl('ios')).toBe(UPDATE_POLICY.STORE_URLS.ios);
    expect(UPDATE_POLICY.STORE_URLS.ios).toContain('apps.apple.com');
  });

  it('returns the configured Play Store url on Android', () => {
    expect(getStoreUrl('android')).toBe(UPDATE_POLICY.STORE_URLS.android);
  });

  it('returns the web url on non-mobile platforms', () => {
    expect(getStoreUrl('web')).toBe(UPDATE_POLICY.STORE_URLS.web);
  });
});

describe('resolveInstallStoreUrl', () => {
  it('routes iPhone web visitors to the App Store via userAgent', () => {
    const ua = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15';
    expect(resolveInstallStoreUrl('web', ua)).toBe(UPDATE_POLICY.STORE_URLS.ios);
  });

  it('routes Android web visitors to the Play Store via userAgent', () => {
    const ua = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36';
    expect(resolveInstallStoreUrl('web', ua)).toBe(UPDATE_POLICY.STORE_URLS.android);
  });

  it('routes the in-app KakaoTalk browser on iOS to the App Store', () => {
    const ua =
      'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 KAKAOTALK';
    expect(resolveInstallStoreUrl('web', ua)).toBe(UPDATE_POLICY.STORE_URLS.ios);
  });

  it('routes legacy iPad UA (with iPad token) to the App Store', () => {
    const ua = 'Mozilla/5.0 (iPad; CPU OS 12_4 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148';
    expect(resolveInstallStoreUrl('web', ua)).toBe(UPDATE_POLICY.STORE_URLS.ios);
  });

  it('routes iPadOS 13+ desktop UA (Macintosh + touch) to the App Store', () => {
    const ua = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15';
    expect(resolveInstallStoreUrl('web', ua, 5)).toBe(UPDATE_POLICY.STORE_URLS.ios);
  });

  it('falls back to the website for real desktop web visitors (no touch)', () => {
    const ua = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15';
    expect(resolveInstallStoreUrl('web', ua, 0)).toBe(UPDATE_POLICY.STORE_URLS.web);
  });

  it('uses the native platform store directly when not on web', () => {
    expect(resolveInstallStoreUrl('ios', '')).toBe(UPDATE_POLICY.STORE_URLS.ios);
    expect(resolveInstallStoreUrl('android', '')).toBe(UPDATE_POLICY.STORE_URLS.android);
  });
});
