import { Redirect } from 'expo-router';
import { isPhoneOnlySignupAuthUser } from '@/shared/auth/sessionState';
import {
  AUTH_ENTRY_ROUTES,
  AUTH_LOGIN_ROUTE,
  getAuthenticatedEntryRoute,
} from '@/shared/navigation/authRedirect';
import { useAuthStore } from '@/stores/authStore';

export default function LegacyPublicJobsEntryRoute() {
  const user = useAuthStore((state) => state.user);
  const profile = useAuthStore((state) => state.profile);

  if (!user) {
    return <Redirect href={AUTH_LOGIN_ROUTE} />;
  }

  if (!profile) {
    return <Redirect href={isPhoneOnlySignupAuthUser(user) ? AUTH_ENTRY_ROUTES.signup : '/'} />;
  }

  return (
    <Redirect
      href={getAuthenticatedEntryRoute({
        socialProvider: profile.socialProvider ?? null,
        phoneVerified: profile.phoneVerified ?? null,
        profileCompleted: profile.profileCompleted ?? null,
        identityVerified: profile.identityVerified ?? null,
      })}
    />
  );
}
