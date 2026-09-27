import { Redirect } from 'expo-router';
import { isPhoneOnlySignupAuthUser } from '@/shared/auth/sessionState';
import { AUTH_ENTRY_ROUTES, getAuthenticatedEntryRoute } from '@/shared/navigation/authRedirect';
import { GUEST_HOME_ROUTE } from '@/shared/navigation/guestAccess';
import { useAuthStore } from '@/stores/authStore';

export default function LegacyPublicJobsEntryRoute() {
  const user = useAuthStore((state) => state.user);
  const profile = useAuthStore((state) => state.profile);

  if (!user) {
    return <Redirect href={GUEST_HOME_ROUTE} />;
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
