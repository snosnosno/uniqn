/**
 * UNIQN Mobile - 사용자 프로필 조회 훅
 *
 * @description getUserProfile + displayName 계산을 통합한 공통 훅
 * @version 1.2.0
 */

import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryClient';
import { getUserProfile } from '@/services';
import { resolveProfileIdentity } from '@/shared/profile/identity';
import type { UserProfile } from '@/services';

interface UseUserProfileOptions {
  userId: string | undefined;
  enabled?: boolean;
  fallbackName?: string;
  fallbackNickname?: string;
  fallbackPhotoURL?: string;
}

interface UseUserProfileResult {
  userProfile: UserProfile | null | undefined;
  isLoading: boolean;
  displayName: string;
  profilePhotoURL: string | undefined;
}

export function useUserProfile({
  userId,
  enabled = true,
  fallbackName,
  fallbackNickname,
  fallbackPhotoURL,
}: UseUserProfileOptions): UseUserProfileResult {
  const { data: userProfile, isLoading } = useQuery<UserProfile | null>({
    queryKey: queryKeys.user.profile(userId ?? ''),
    queryFn: () => getUserProfile(userId!),
    enabled: enabled && !!userId,
    staleTime: 5 * 60 * 1000,
  });

  const profileIdentity = resolveProfileIdentity({
    userProfile,
    userId,
    fallbackName,
    fallbackNickname,
    fallbackPhotoURL,
  });

  return {
    userProfile,
    isLoading,
    displayName: profileIdentity.displayName,
    profilePhotoURL: profileIdentity.photoURL,
  };
}
