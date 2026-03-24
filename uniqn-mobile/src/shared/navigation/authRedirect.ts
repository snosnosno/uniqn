import type { UserProfile } from '@/types';

export const AUTH_ENTRY_ROUTES = {
  appTabs: '/(app)/(tabs)',
  socialSignup: '/(auth)/signup?mode=social',
  profileSetup: '/(app)/profile-setup',
} as const;

const ALLOWED_POST_AUTH_REDIRECT_PREFIXES = ['/(app)', '/(employer)', '/(admin)'] as const;

type AuthEntryRoute = (typeof AUTH_ENTRY_ROUTES)[keyof typeof AUTH_ENTRY_ROUTES];

interface AuthenticatedEntryRouteParams {
  socialProvider?: UserProfile['socialProvider'] | null;
  phoneVerified?: boolean | null;
  profileCompleted?: boolean | null;
}

interface ResolvedAuthenticatedRouteParams extends AuthenticatedEntryRouteParams {
  redirect?: string | null;
}

export function normalizePostAuthRedirect(redirect?: string | null): string | null {
  if (typeof redirect !== 'string') {
    return null;
  }

  const trimmed = redirect.trim();
  if (
    trimmed.length === 0 ||
    !trimmed.startsWith('/') ||
    trimmed.startsWith('//') ||
    trimmed.includes('\\')
  ) {
    return null;
  }

  const [pathname] = trimmed.split(/[?#]/, 1);
  const isAllowedInternalRoute = ALLOWED_POST_AUTH_REDIRECT_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );

  return isAllowedInternalRoute ? trimmed : null;
}

export function appendRedirectToRoute(route: string, redirect?: string | null): string {
  const normalizedRedirect = normalizePostAuthRedirect(redirect);

  if (!normalizedRedirect) {
    return route;
  }

  if (route === AUTH_ENTRY_ROUTES.appTabs) {
    return normalizedRedirect;
  }

  const separator = route.includes('?') ? '&' : '?';
  return `${route}${separator}redirect=${encodeURIComponent(normalizedRedirect)}`;
}

export function getAuthenticatedEntryRoute(params: AuthenticatedEntryRouteParams): AuthEntryRoute {
  const { socialProvider, phoneVerified, profileCompleted } = params;

  if (socialProvider && phoneVerified !== true) {
    return AUTH_ENTRY_ROUTES.socialSignup;
  }

  if (profileCompleted === false) {
    return AUTH_ENTRY_ROUTES.profileSetup;
  }

  return AUTH_ENTRY_ROUTES.appTabs;
}

export function getResolvedAuthenticatedRoute(params: ResolvedAuthenticatedRouteParams): string {
  const { redirect, ...routeParams } = params;
  return appendRedirectToRoute(getAuthenticatedEntryRoute(routeParams), redirect);
}
