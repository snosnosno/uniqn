/**
 * UNIQN Mobile - useAuthGuard Hook
 *
 * Route protection and authenticated entry routing.
 */

import { useEffect, useRef } from 'react';
import { useGlobalSearchParams, usePathname, useRouter, useSegments } from 'expo-router';
import {
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

export function useAuthGuard(): void {
  const router = useRouter();
  const segments = useSegments();
  const pathname = usePathname();
  const searchParams = useGlobalSearchParams<{ redirect?: string | string[] }>();

  const isLoading = useAuthStore(selectIsLoading);
  const profile = useAuthStore(selectProfile);
  const user = useAuthStore((state) => state.user);

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

  useEffect(() => {
    if (isLoading || (isAuthenticated && !profile)) return;

    const routeGroup = extractRouteGroup(segments);
    const redirectParam = Array.isArray(searchParams.redirect)
      ? searchParams.redirect[0]
      : searchParams.redirect;
    const requestedRedirect = normalizePostAuthRedirect(redirectParam);
    const currentProtectedRoute = buildPostAuthRedirectFromSegments(segments);
    const postAuthRedirect = routeGroup === '(auth)' ? requestedRedirect : currentProtectedRoute;
    const isOnSignup = segments.includes('signup' as never);
    const isOnProfileSetup = pathname === '/profile-setup' || pathname === '/(app)/profile-setup';
    const resolvedAuthenticatedRoute = getResolvedAuthenticatedRoute({
      socialProvider,
      phoneVerified,
      profileCompleted,
      redirect: postAuthRedirect,
    });

    if (!routeGroup) {
      if ((pathname === '/' || pathname === '/index') && isAuthenticated) {
        logger.debug('Authenticated user entered root route', {
          component: 'useAuthGuard',
          pathname,
          authenticatedEntryRoute: resolvedAuthenticatedRoute,
        });
        routerRef.current.replace(resolvedAuthenticatedRoute);
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

    if (routeGroup === '(public)' && isAuthenticated && isPublicEntryRoute(pathname, segments)) {
      logger.debug('Authenticated user entered public entry route', {
        component: 'useAuthGuard',
        pathname,
        authenticatedEntryRoute: resolvedAuthenticatedRoute,
      });
      routerRef.current.replace(resolvedAuthenticatedRoute);
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
      if (isPublicEntryRoute(pathname, segments) || isPublicJobDetailRoute(pathname, segments)) {
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
    }
  }, [
    authenticatedEntryRoute,
    isAuthenticated,
    isLoading,
    pathname,
    phoneVerified,
    profile,
    profileCompleted,
    searchParams.redirect,
    segments,
    socialProvider,
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
