import { buildCurrentUserIdentitySnapshot, resolveProfileIdentity } from '../identity';

describe('profile identity helpers', () => {
  describe('resolveProfileIdentity', () => {
    it('uses fallback values while the profile query is unresolved', () => {
      expect(
        resolveProfileIdentity({
          userProfile: undefined,
          userId: 'user-1234',
          fallbackName: '김소호',
          fallbackNickname: '스노',
          fallbackPhotoURL: 'https://example.com/fallback.jpg',
        })
      ).toEqual({
        baseName: '김소호',
        displayName: '김소호(스노)',
        nickname: '스노',
        photoURL: 'https://example.com/fallback.jpg',
        photoURLBlurhash: null,
      });
    });

    it('keeps legacy snapshot values when the profile document is missing', () => {
      expect(
        resolveProfileIdentity({
          userProfile: null,
          userId: 'user-1234',
          fallbackName: '레거시 이름',
          fallbackNickname: '레거시닉',
          fallbackPhotoURL: 'https://example.com/legacy.jpg',
        })
      ).toEqual({
        baseName: '레거시 이름',
        displayName: '레거시 이름(레거시닉)',
        nickname: '레거시닉',
        photoURL: 'https://example.com/legacy.jpg',
        photoURLBlurhash: null,
      });
    });

    it('drops stale fallback values when the loaded profile explicitly removed them', () => {
      expect(
        resolveProfileIdentity({
          userProfile: {
            name: '김소호',
            nickname: undefined,
            photoURL: null,
          },
          userId: 'user-1234',
          fallbackName: '레거시 이름',
          fallbackNickname: '레거시닉',
          fallbackPhotoURL: 'https://example.com/legacy.jpg',
        })
      ).toEqual({
        baseName: '김소호',
        displayName: '김소호',
        nickname: undefined,
        photoURL: undefined,
        photoURLBlurhash: null,
      });
    });

    it('uses nickname as the display name when no base name is available', () => {
      expect(
        resolveProfileIdentity({
          userProfile: {
            name: '',
            nickname: '스노',
            photoURL: undefined,
          },
          userId: 'user-1234',
        }).displayName
      ).toBe('스노');
    });
  });

  describe('buildCurrentUserIdentitySnapshot', () => {
    it('prefers profile values and preserves nickname-specific review names', () => {
      expect(
        buildCurrentUserIdentitySnapshot({
          profile: {
            name: '김소호',
            nickname: '스노',
            photoURL: 'https://example.com/profile.jpg',
          },
          authUser: {
            displayName: 'Auth Name',
            photoURL: 'https://example.com/auth.jpg',
          },
          fallbackName: '익명',
        })
      ).toEqual({
        name: '김소호',
        preferredName: '김소호',
        reviewName: '스노',
        baseName: '김소호',
        displayName: '김소호(스노)',
        nickname: '스노',
        photoURL: 'https://example.com/profile.jpg',
        photoURLBlurhash: null,
      });
    });

    it('falls back to auth values when the profile is missing', () => {
      expect(
        buildCurrentUserIdentitySnapshot({
          profile: null,
          authUser: {
            displayName: 'Auth Name',
            photoURL: 'https://example.com/auth.jpg',
          },
          fallbackName: '익명',
        })
      ).toEqual({
        name: 'Auth Name',
        preferredName: 'Auth Name',
        reviewName: 'Auth Name',
        baseName: 'Auth Name',
        displayName: 'Auth Name',
        nickname: undefined,
        photoURL: 'https://example.com/auth.jpg',
        photoURLBlurhash: null,
      });
    });

    it('clears stale auth photos when the loaded profile explicitly removed them', () => {
      expect(
        buildCurrentUserIdentitySnapshot({
          profile: {
            name: '김소호',
            nickname: undefined,
            photoURL: null,
          },
          authUser: {
            displayName: 'Auth Name',
            photoURL: 'https://example.com/auth.jpg',
          },
          fallbackName: '익명',
        }).photoURL
      ).toBeUndefined();
    });

    it('uses nickname as the visible display name when auth and profile names are both missing', () => {
      expect(
        buildCurrentUserIdentitySnapshot({
          profile: {
            name: '',
            nickname: '스노',
            photoURL: undefined,
          },
          authUser: {
            displayName: '',
            photoURL: null,
          },
          fallbackName: '',
        }).displayName
      ).toBe('스노');
    });
  });
});
