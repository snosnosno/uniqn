import type { User as SupabaseUser } from '@supabase/supabase-js';
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

/**
 * Supabase 사용자가 phone-only signup 상태인지 확인
 *
 * Supabase에서는 phone-only signup이 일반적이지 않지만,
 * 하위 호환성을 위해 유지합니다.
 */
export function isPhoneOnlySignupFirebaseUser(user?: SupabaseUser | null): boolean {
  if (!user) return false;

  const hasPhone = typeof user.phone === 'string' && user.phone.length > 0;
  const hasEmail = typeof user.email === 'string' && user.email.length > 0;

  if (!hasPhone || hasEmail) return false;

  const providers = (user.app_metadata?.providers as string[]) ?? [];
  const hasPhoneProvider = providers.includes('phone');
  const hasNonPhoneProvider = providers.some((p) => p !== 'phone');

  return hasPhoneProvider || !hasNonPhoneProvider;
}
