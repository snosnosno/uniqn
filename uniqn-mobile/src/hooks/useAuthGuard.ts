/**
 * UNIQN Mobile - useAuthGuard Hook
 *
 * Route protection and authenticated entry routing.
 */

import { useEffect, useRef } from 'react';
import { useGlobalSearchParams, usePathname, useRouter, useSegments } from 'expo-router';
import { useIsMounted } from '@/hooks/useIsMounted';
import { isPhoneOnlySignupAuthUser } from '@/shared/auth/sessionState';
import {
  AUTH_ENTRY_ROUTES,
  appendRedirectToRoute,
  buildPostAuthRedirectFromSegments,
  getAuthenticatedEntryRoute,
  getLoginRoute,
  getResolvedAuthenticatedRoute,
  normalizePostAuthRedirect,
} from '@/shared/navigation/authRedirect';
import { RoleResolver } from '@/shared/role';
import { useAuthStore, selectIsLoading, selectProfile } from '@/stores/authStore';
import type { UserRole } from '@/types';
import { logger } from '@/utils/logger';

type RouteGroup = '(auth)' | '(app)' | '(employer)' | '(admin)' | '(public)';

interface RouteConfig {
  requiredAuth: boolean;
  requiredRole?: UserRole;
}

const PROFILE_RETRY_DELAY_MS = 500;
const PROFILE_MAX_RETRIES = 3;

const ROUTE_CONFIGS: Record<RouteGroup, RouteConfig> = {
  '(public)': {
    requiredAuth: false,
  },
  '(auth)': {
    requiredAuth: false,
  },
  '(app)': {
    requiredAuth: true,
    requiredRole: 'staff',
  },
  '(employer)': {
    requiredAuth: true,
    requiredRole: 'employer',
  },
  '(admin)': {
    requiredAuth: true,
    requiredRole: 'admin',
  },
};

const PUBLIC_ENTRY_PATHS = new Set(['/jobs', '/(public)/jobs']);

function getBrowserPathname(fallbackPathname: string): string {
  if (typeof window === 'undefined') {
    return fallbackPathname;
  }

  return window.location?.pathname || fallbackPathname;
}

function extractRouteGroup(segments: string[]): RouteGroup | null {
  const firstSegment = segments[0] as RouteGroup | undefined;

  if (firstSegment && firstSegment in ROUTE_CONFIGS) {
    return firstSegment;
  }

  return null;
}

function isPublicEntryRoute(pathname: string, segments: string[]): boolean {
  return PUBLIC_ENTRY_PATHS.has(pathname) || (segments[0] === '(public)' && segments[1] === 'jobs');
}

function isPublicJobDetailRoute(pathname: string, segments: string[]): boolean {
  const normalizedSegments = pathname.split('/').filter(Boolean);

  return (
    (normalizedSegments.length === 2 && normalizedSegments[0] === 'jobs') ||
    (segments[0] === '(public)' && segments[1] === 'jobs' && segments.length >= 3)
  );
}

function buildPublicJobDetailRedirect(pathname: string): string | null {
  const normalizedSegments = pathname.split('/').filter(Boolean);

  if (normalizedSegments.length !== 2 || normalizedSegments[0] !== 'jobs') {
    return null;
  }

  return `/(app)/jobs/${normalizedSegments[1]}`;
}

export function useAuthGuard(): void {
  const router = useRouter();
  const segments = useSegments();
  const pathname = usePathname();
  const searchParams = useGlobalSearchParams<{
    redirect?: string | string[];
    mode?: string | string[];
  }>();

  const isLoading = useAuthStore(selectIsLoading);
  const profile = useAuthStore(selectProfile);
  const user = useAuthStore((state) => state.user);
  const checkAuthState = useAuthStore((state) => state.checkAuthState);

  const isAuthenticated = !!user;
  const userRole = profile?.role ?? null;
  const socialProvider = profile?.socialProvider ?? null;
  const phoneVerified = profile?.phoneVerified ?? null;
  const profileCompleted = profile?.profileCompleted ?? null;

  const authenticatedEntryRoute = getAuthenticatedEntryRoute({
    socialProvider,
    phoneVerified,
    profileCompleted,
  });

  const routerRef = useRef(router);
  routerRef.current = router;
  const isMountedRef = useIsMounted();
  const profileRetryCountRef = useRef(0);

  useEffect(() => {
    const routeGroup = extractRouteGroup(segments);
    const browserPathname = getBrowserPathname(pathname);
    const isPublicJobsEntryRoute =
      isPublicEntryRoute(browserPathname, segments) || isPublicEntryRoute(pathname, segments);
    const isPublicJobsDetailRoute =
      isPublicJobDetailRoute(browserPathname, segments) ||
      isPublicJobDetailRoute(pathname, segments);

    const redirectParam = Array.isArray(searchParams.redirect)
      ? searchParams.redirect[0]
      : searchParams.redirect;
    const requestedRedirect = normalizePostAuthRedirect(redirectParam);
    const currentProtectedRoute = buildPostAuthRedirectFromSegments(segments);
    const publicAliasRedirect =
      buildPublicJobDetailRedirect(browserPathname) ?? buildPublicJobDetailRedirect(pathname);
    const postAuthRedirect = routeGroup === '(auth)' ? requestedRedirect : currentProtectedRoute;
    const pendingAuthRedirect = publicAliasRedirect ?? postAuthRedirect;
    const isOnSignup = segments.includes('signup' as never);
    const signupModeParam = Array.isArray(searchParams.mode)
      ? searchParams.mode[0]
      : searchParams.mode;
    const isOnProfileSetup = pathname === '/profile-setup' || pathname === '/(app)/profile-setup';
    const resolvedAuthenticatedRoute = getResolvedAuthenticatedRoute({
      socialProvider,
      phoneVerified,
      profileCompleted,
      redirect: postAuthRedirect,
    });
    const phoneOnlySignupRoute = appendRedirectToRoute(
      AUTH_ENTRY_ROUTES.signup,
      pendingAuthRedirect
    );

    if (isLoading) {
      return;
    }

    // 프로필이 정상 로드되면 재시도 카운터 리셋
    if (profile) {
      profileRetryCountRef.current = 0;
    }

    if (isAuthenticated && !profile) {
      if (isPhoneOnlySignupAuthUser(user)) {
        const isOnPlainSignup =
          routeGroup === '(auth)' && isOnSignup && signupModeParam !== 'social';

        if (!isOnPlainSignup) {
          logger.debug('Phone-only signup session redirected to signup', {
            component: 'useAuthGuard',
            pathname,
            redirect: pendingAuthRedirect,
          });
          routerRef.current.replace(phoneOnlySignupRoute);
        }

        return;
      }

      if (profileRetryCountRef.current >= PROFILE_MAX_RETRIES) {
        logger.warn('Profile retry limit reached — halting automatic re-check', {
          component: 'useAuthGuard',
          retries: profileRetryCountRef.current,
        });
        return;
      }

      const retryTimer = setTimeout(() => {
        if (!isMountedRef.current) {
          return;
        }
        profileRetryCountRef.current += 1;
        void checkAuthState();
      }, PROFILE_RETRY_DELAY_MS);

      return () => clearTimeout(retryTimer);
    }

    if (!routeGroup) {
      const isRouterRootPath = pathname === '/' || pathname === '/index';
      const isBrowserRootPath = browserPathname === '/' || browserPathname === '/index';

      if (isRouterRootPath && isBrowserRootPath && isAuthenticated) {
        logger.debug('Authenticated user entered root route', {
          component: 'useAuthGuard',
          pathname,
          browserPathname,
          authenticatedEntryRoute: resolvedAuthenticatedRoute,
        });
        routerRef.current.replace(resolvedAuthenticatedRoute);
        return;
      }

      if (isPublicJobsEntryRoute && !isAuthenticated) {
        logger.debug('Guest user entered legacy public jobs alias route', {
          component: 'useAuthGuard',
          pathname,
          browserPathname,
        });
        routerRef.current.replace('/(auth)/login');
        return;
      }

      if (isAuthenticated && (isPublicJobsEntryRoute || isPublicJobsDetailRoute)) {
        const publicAliasAuthenticatedRoute = getResolvedAuthenticatedRoute({
          socialProvider,
          phoneVerified,
          profileCompleted,
          redirect: publicAliasRedirect,
        });

        logger.debug('Authenticated user entered public alias route', {
          component: 'useAuthGuard',
          pathname,
          browserPathname,
          redirect: publicAliasRedirect,
          authenticatedEntryRoute: publicAliasAuthenticatedRoute,
        });
        routerRef.current.replace(publicAliasAuthenticatedRoute);
        return;
      }
      return;
    }

    const config = ROUTE_CONFIGS[routeGroup];

    if (routeGroup === '(auth)' && isAuthenticated) {
      if (authenticatedEntryRoute.includes('/signup') && isOnSignup) {
        return;
      }

      logger.debug('Authenticated user entered auth group', {
        component: 'useAuthGuard',
        pathname,
        authenticatedEntryRoute: resolvedAuthenticatedRoute,
      });
      routerRef.current.replace(resolvedAuthenticatedRoute);
      return;
    }

    if (routeGroup === '(public)' && isPublicEntryRoute(pathname, segments)) {
      if (isAuthenticated) {
        logger.debug('Authenticated user entered public entry route', {
          component: 'useAuthGuard',
          pathname,
          authenticatedEntryRoute: resolvedAuthenticatedRoute,
        });
        routerRef.current.replace(resolvedAuthenticatedRoute);
      } else {
        logger.debug('Guest user entered public entry route', {
          component: 'useAuthGuard',
          pathname,
        });
        routerRef.current.replace('/(auth)/login');
      }

      return;
    }

    if (isAuthenticated && authenticatedEntryRoute.includes('/signup') && !isOnSignup) {
      logger.debug('Incomplete social signup detected', {
        component: 'useAuthGuard',
        pathname,
        socialProvider,
      });
      routerRef.current.replace(resolvedAuthenticatedRoute);
      return;
    }

    if (
      isAuthenticated &&
      authenticatedEntryRoute.includes('/profile-setup') &&
      !isOnProfileSetup
    ) {
      logger.debug('Incomplete profile detected', {
        component: 'useAuthGuard',
        pathname,
      });
      routerRef.current.replace(resolvedAuthenticatedRoute);
      return;
    }

    if (config.requiredAuth && !isAuthenticated) {
      if (isPublicJobsDetailRoute) {
        return;
      }

      logger.debug('Unauthenticated access to protected route', {
        component: 'useAuthGuard',
        pathname,
        routeGroup,
        redirect: currentProtectedRoute,
      });
      routerRef.current.replace(getLoginRoute(currentProtectedRoute));
      return;
    }

    const hasRequiredPermission = config.requiredRole
      ? RoleResolver.hasPermission(userRole, config.requiredRole)
      : true;

    if (config.requiredRole && !hasRequiredPermission) {
      logger.warn('Insufficient role for route', {
        component: 'useAuthGuard',
        pathname,
        userRole,
        requiredRole: config.requiredRole,
      });

      routerRef.current.replace(isAuthenticated ? authenticatedEntryRoute : '/(auth)/login');
      return;
    }

    return undefined;
  }, [
    authenticatedEntryRoute,
    checkAuthState,
    isAuthenticated,
    isLoading,
    isMountedRef,
    pathname,
    phoneVerified,
    profile,
    profileCompleted,
    searchParams.redirect,
    searchParams.mode,
    segments,
    socialProvider,
    user,
    userRole,
  ]);
}

export function useHasPermission(requiredRole: UserRole): boolean {
  const { profile } = useAuthStore();
  const userRole = profile?.role ?? null;

  return RoleResolver.hasPermission(userRole, requiredRole);
}

export function useIsAdmin(): boolean {
  return useHasPermission('admin');
}

export function useIsEmployer(): boolean {
  return useHasPermission('employer');
}

export function useIsStaff(): boolean {
  return useHasPermission('staff');
}

export default useAuthGuard;
