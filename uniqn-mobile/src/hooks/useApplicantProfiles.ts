/**
 * UNIQN Mobile - 지원자 프로필 배치 조회 훅
 *
 * @description N+1 최적화를 위해 지원자 프로필을 배치로 조회
 * @version 1.0.0
 *
 * ApplicantList 컴포넌트가 Repository를 직접 호출하던 패턴을
 * Hook 레이어로 캡슐화하여 아키텍처 규칙(Component → Hook → Repository)을 준수합니다.
 */

import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { userRepository } from '@/repositories';
import { queryKeys } from '@/lib/queryClient';
import type { FirestoreUserProfile } from '@/types';

interface UseApplicantProfilesOptions {
  /** 조회할 지원자 ID 배열 */
  applicantIds: string[];
  /** 조회 활성화 여부 (기본: true) */
  enabled?: boolean;
}

/**
 * 지원자 프로필 배치 조회 + 개별 캐시 분배
 *
 * @example
 * const { profileMap, isLoading } = useApplicantProfiles({
 *   applicantIds: applicants.map(a => a.applicantId),
 * });
 */
export function useApplicantProfiles({
  applicantIds,
  enabled = true,
}: UseApplicantProfilesOptions) {
  const queryClient = useQueryClient();

  const { data: profileMap, isLoading } = useQuery({
    queryKey: queryKeys.user.profileBatch(applicantIds),
    queryFn: () => userRepository.getByIdBatch(applicantIds),
    enabled: enabled && applicantIds.length > 0,
    staleTime: 5 * 60 * 1000, // 5분
  });

  // 개별 캐시에 저장 (ApplicantCard의 useQuery가 캐시 히트)
  useEffect(() => {
    if (profileMap) {
      profileMap.forEach((profile: FirestoreUserProfile, id: string) => {
        queryClient.setQueryData(queryKeys.user.profile(id), profile);
      });
    }
  }, [profileMap, queryClient]);

  return { profileMap, isLoading };
}
