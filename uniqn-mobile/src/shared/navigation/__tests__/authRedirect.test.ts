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

  it('routes completed users to app tabs', () => {
    expect(
      getAuthenticatedEntryRoute({
        socialProvider: 'apple',
        phoneVerified: true,
        profileCompleted: true,
      })
    ).toBe(AUTH_ENTRY_ROUTES.appTabs);
  });

  it('treats legacy users without profileCompleted as ready for app tabs', () => {
    expect(
      getAuthenticatedEntryRoute({
        socialProvider: null,
        phoneVerified: null,
        profileCompleted: null,
      })
    ).toBe(AUTH_ENTRY_ROUTES.appTabs);
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
