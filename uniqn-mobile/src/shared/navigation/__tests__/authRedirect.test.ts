import { AUTH_ENTRY_ROUTES, getAuthenticatedEntryRoute } from '../authRedirect';

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
