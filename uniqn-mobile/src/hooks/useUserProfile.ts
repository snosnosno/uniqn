/**
 * UNIQN Mobile - 사용자 프로필 조회 훅
 *
 * @description getUserProfile + displayName 계산을 통합한 공통 훅
 * @version 1.0.0
 *
 * 9개 컴포넌트에서 반복되던 프로필 조회 + 이름 표시 로직 통합:
 * - ApplicantCard, ApplicantProfileModal, ConfirmedStaffCard
 * - ConfirmModal, GroupedSettlementCard, SettlementCard
 * - SettlementEditModal, StaffProfileModal, SettlementDetailModal
 */

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryClient';
import { getUserProfile } from '@/services';
import type { UserProfile } from '@/services';

// ============================================================================
// Types
// ============================================================================

interface UseUserProfileOptions {
  /** 사용자 ID */
  userId: string | undefined;
  /** 쿼리 활성화 여부 (모달 visible 등 추가 조건) */
  enabled?: boolean;
  /** 이름 폴백 (프로필 조회 실패 시) */
  fallbackName?: string;
  /** 닉네임 폴백 */
  fallbackNickname?: string;
  /** 프로필 사진 폴백 */
  fallbackPhotoURL?: string;
}

interface UseUserProfileResult {
  /** 프로필 데이터 */
  userProfile: UserProfile | null | undefined;
  /** 프로필 로딩 중 */
  isLoading: boolean;
  /** 표시용 이름 ("이름" 또는 "이름(닉네임)") */
  displayName: string;
  /** 프로필 사진 URL */
  profilePhotoURL: string | undefined;
}

// ============================================================================
// Hook
// ============================================================================

/**
 * 사용자 프로필 조회 + displayName 계산 통합 훅
 *
 * @example
 * const { displayName, profilePhotoURL } = useUserProfile({
 *   userId: applicant.applicantId,
 *   fallbackName: applicant.applicantName,
 * });
 */
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

  const profilePhotoURL = userProfile?.photoURL || fallbackPhotoURL;

  const displayName = useMemo(() => {
    const baseName = userProfile?.name || fallbackName;
    if (!baseName) {
      return userId ? `스태프 ${userId.slice(-4)}` : '';
    }
    const nickname = userProfile?.nickname || fallbackNickname;
    if (nickname && nickname !== baseName) {
      return `${baseName}(${nickname})`;
    }
    return baseName;
  }, [userProfile?.name, userProfile?.nickname, fallbackName, fallbackNickname, userId]);

  return { userProfile, isLoading, displayName, profilePhotoURL };
}
