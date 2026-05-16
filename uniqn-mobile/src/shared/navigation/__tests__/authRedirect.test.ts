import {
  AUTH_ENTRY_ROUTES,
  appendRedirectToRoute,
  getAuthenticatedEntryRoute,
  getResolvedAuthenticatedRoute,
  normalizePostAuthRedirect,
} from '../authRedirect';

describe('getAuthenticatedEntryRoute', () => {
  it('routes incomplete social users to signup', () => {
    expect(
      getAuthenticatedEntryRoute({
        socialProvider: 'apple',
        phoneVerified: false,
        profileCompleted: false,
      })
    ).toBe(AUTH_ENTRY_ROUTES.socialSignup);
  });

  it('routes incomplete profiles to profile setup', () => {
    expect(
      getAuthenticatedEntryRoute({
        socialProvider: null,
        phoneVerified: true,
        profileCompleted: false,
      })
    ).toBe(AUTH_ENTRY_ROUTES.profileSetup);
  });

  it('routes completed users to app home', () => {
    expect(
      getAuthenticatedEntryRoute({
        socialProvider: 'apple',
        phoneVerified: true,
        profileCompleted: true,
      })
    ).toBe(AUTH_ENTRY_ROUTES.appHome);
  });

  it('treats legacy users without profileCompleted as ready for app home', () => {
    expect(
      getAuthenticatedEntryRoute({
        socialProvider: null,
        phoneVerified: null,
        profileCompleted: null,
      })
    ).toBe(AUTH_ENTRY_ROUTES.appHome);
  });

  it('routes users with identityVerified=false to identity reverify', () => {
    expect(
      getAuthenticatedEntryRoute({
        socialProvider: null,
        phoneVerified: true,
        profileCompleted: true,
        identityVerified: false,
      })
    ).toBe(AUTH_ENTRY_ROUTES.identityReverify);
  });

  it('treats legacy users without identityVerified column as verified (null/undefined → app home)', () => {
    // 옛날에 가입한 사용자는 identity_verified 컬럼이 NULL이거나 undefined.
    // 명시적으로 false 일 때만 차단해야 한다.
    expect(
      getAuthenticatedEntryRoute({
        socialProvider: null,
        phoneVerified: true,
        profileCompleted: true,
        identityVerified: null,
      })
    ).toBe(AUTH_ENTRY_ROUTES.appHome);
  });

  it('prioritizes social signup over identity reverify for incomplete social users', () => {
    // 소셜 신규 사용자(phoneVerified=false)는 mode=social 흐름이 우선.
    // identityVerified=false 도 함께 와도 socialSignup 으로 가야 한다.
    expect(
      getAuthenticatedEntryRoute({
        socialProvider: 'apple',
        phoneVerified: false,
        profileCompleted: false,
        identityVerified: false,
      })
    ).toBe(AUTH_ENTRY_ROUTES.socialSignup);
  });

  it('routes email/password signup row with phoneVerified=false to plain signup (no socialProvider)', () => {
    // 2026-05-16 사건 회귀 방지: handle_new_user trigger drift 또는 edge function
    // 실패로 social_provider 가 NULL 인 상태에서 사용자가 재로그인하면 reverify trap
    // 에 빠지던 버그. phone 인증조차 안 한 사용자는 reverify 가 아닌 가입 흐름으로
    // 보내야 한다.
    expect(
      getAuthenticatedEntryRoute({
        socialProvider: null,
        phoneVerified: false,
        identityVerified: false,
      })
    ).toBe(AUTH_ENTRY_ROUTES.signup);
  });
});

describe('normalizePostAuthRedirect', () => {
  it('allows protected in-app routes', () => {
    expect(normalizePostAuthRedirect('/(app)/jobs/123/apply')).toBe('/(app)/jobs/123/apply');
    expect(normalizePostAuthRedirect('/(employer)/dashboard?tab=staff')).toBe(
      '/(employer)/dashboard?tab=staff'
    );
  });

  it('rejects external or auth-loop redirects', () => {
    expect(normalizePostAuthRedirect('//evil.example')).toBeNull();
    expect(normalizePostAuthRedirect('/(auth)/login')).toBeNull();
    expect(normalizePostAuthRedirect('/(public)/jobs/123')).toBeNull();
    expect(normalizePostAuthRedirect('/\\evil')).toBeNull();
  });
});

describe('appendRedirectToRoute', () => {
  it('preserves safe redirects for follow-up onboarding routes', () => {
    expect(appendRedirectToRoute(AUTH_ENTRY_ROUTES.socialSignup, '/(app)/jobs/123/apply')).toBe(
      '/(auth)/signup?mode=social&redirect=%2F(app)%2Fjobs%2F123%2Fapply'
    );
  });

  it('returns the redirect directly for completed users entering app tabs', () => {
    expect(appendRedirectToRoute(AUTH_ENTRY_ROUTES.appTabs, '/(app)/jobs/123/apply')).toBe(
      '/(app)/jobs/123/apply'
    );
  });
});

describe('getResolvedAuthenticatedRoute', () => {
  it('keeps incomplete social users on signup even when a redirect is present', () => {
    expect(
      getResolvedAuthenticatedRoute({
        socialProvider: 'apple',
        phoneVerified: false,
        profileCompleted: false,
        redirect: '/(app)/jobs/123/apply',
      })
    ).toBe('/(auth)/signup?mode=social&redirect=%2F(app)%2Fjobs%2F123%2Fapply');
  });

  it('routes completed users to the validated redirect target', () => {
    expect(
      getResolvedAuthenticatedRoute({
        socialProvider: 'apple',
        phoneVerified: true,
        profileCompleted: true,
        redirect: '/(app)/jobs/123/apply',
      })
    ).toBe('/(app)/jobs/123/apply');
  });
});

describe('AUTH_ENTRY_ROUTES.appHome with feature flag', () => {
  afterEach(() => {
    jest.resetModules();
  });

  it('returns home route when flag is enabled', () => {
    jest.mock('@/config/featureFlags', () => ({
      featureFlags: { home_dashboard_enabled: true },
    }));
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { AUTH_ENTRY_ROUTES } = require('../authRedirect') as typeof import('../authRedirect');
    expect(AUTH_ENTRY_ROUTES.appHome).toBe('/(app)/home');
  });

  it('returns legacy tabs route when flag is disabled', () => {
    jest.mock('@/config/featureFlags', () => ({
      featureFlags: { home_dashboard_enabled: false },
    }));
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { AUTH_ENTRY_ROUTES } = require('../authRedirect') as typeof import('../authRedirect');
    expect(AUTH_ENTRY_ROUTES.appHome).toBe('/(app)/(tabs)');
  });
});
