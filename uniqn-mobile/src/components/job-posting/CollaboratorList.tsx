/**
 * UNIQN Mobile - CollaboratorList
 *
 * @description 협업자 리스트 — FlashList (소형은 FlatList 도 가능, MVP 는 FlashList)
 * @version 1.0.0
 */

import React from 'react';
import { View, Text } from 'react-native';
import { AppFlashList } from '@/components/ui/AppFlashList';
import { CollaboratorRow } from './CollaboratorRow';
import { SkeletonListItem } from '@/components/ui/Skeleton';
import type { JobPostingCollaboratorWithUser } from '@/types/jobPostingCollaborator';

export interface CollaboratorListProps {
  collaborators: JobPostingCollaboratorWithUser[];
  isLoading?: boolean;
  isOwner: boolean;
  currentUserId: string | undefined;
  onRemove?: (userId: string) => void;
  onLeave?: () => void;
  actionDisabled?: boolean;
}

export function CollaboratorList({
  collaborators,
  isLoading,
  isOwner,
  currentUserId,
  onRemove,
  onLeave,
  actionDisabled,
}: CollaboratorListProps) {
  if (isLoading) {
    return (
      <View accessibilityRole="progressbar" accessibilityLabel="협업자 목록 로딩 중">
        <SkeletonListItem />
        <SkeletonListItem />
        <SkeletonListItem />
      </View>
    );
  }

  if (collaborators.length === 0) {
    return (
      <View className="py-12 px-6 items-center gap-3">
        <Text className="text-base font-medium text-content-primary">
          {isOwner ? '아직 함께 관리하는 동료가 없어요' : '협업자가 추가되지 않은 공고예요'}
        </Text>
        <Text className="text-sm text-content-secondary text-center leading-5">
          {isOwner
            ? '위 검색창에서 이메일로 동료를 추가하면\n지원자 검토와 승인을 함께 진행할 수 있어요.'
            : '공고 작성자가 협업자를 추가하면\n이 목록에 표시됩니다.'}
        </Text>
      </View>
    );
  }

  return (
    <AppFlashList<JobPostingCollaboratorWithUser>
      data={collaborators}
      keyExtractor={(item) => item.id}
      estimatedItemSize={64}
      renderItem={({ item }) => (
        <CollaboratorRow
          collaborator={item}
          isOwner={isOwner}
          currentUserId={currentUserId}
          onRemove={onRemove}
          onLeave={onLeave}
          disabled={actionDisabled}
        />
      )}
    />
  );
}
