import type { AuthUser } from '@/types/auth';

type PhoneOnlyAuthUser = Pick<AuthUser, 'email' | 'phoneNumber' | 'providerIds'>;

function hasPhoneWithoutEmail(user?: PhoneOnlyAuthUser | null): boolean {
  const hasPhoneNumber = typeof user?.phoneNumber === 'string' && user.phoneNumber.length > 0;
  const hasEmail = typeof user?.email === 'string' && user.email.length > 0;

  return hasPhoneNumber && !hasEmail;
}

export function isPhoneOnlySignupAuthUser(user?: PhoneOnlyAuthUser | null): boolean {
  if (!user || !hasPhoneWithoutEmail(user)) {
    return false;
  }

  const providerIds = user.providerIds?.filter((providerId): providerId is string => !!providerId);

  if (!providerIds || providerIds.length === 0) {
    return false;
  }

  const hasPhoneProvider = providerIds.includes('phone');
  const hasNonPhoneProvider = providerIds.some((providerId) => providerId !== 'phone');

  return hasPhoneProvider || !hasNonPhoneProvider;
}
