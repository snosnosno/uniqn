import { getStoreUrl, UPDATE_POLICY } from '@/constants/version';

describe('version store urls', () => {
  it('falls back to the web url when the iOS App Store link is still a placeholder', () => {
    expect(getStoreUrl('ios')).toBe(UPDATE_POLICY.STORE_URLS.web);
  });

  it('returns the configured Play Store url on Android', () => {
    expect(getStoreUrl('android')).toBe(UPDATE_POLICY.STORE_URLS.android);
  });

  it('returns the web url on non-mobile platforms', () => {
    expect(getStoreUrl('web')).toBe(UPDATE_POLICY.STORE_URLS.web);
  });
});
