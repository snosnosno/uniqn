/**
 * UNIQN Mobile - CollaboratorList
 *
 * @description 협업자 리스트 — FlashList (소형은 FlatList 도 가능, MVP 는 FlashList)
 * @version 1.0.0
 */

import React from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { CollaboratorRow } from './CollaboratorRow';
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
      <View className="py-6 items-center">
        <ActivityIndicator />
      </View>
    );
  }

  if (collaborators.length === 0) {
    return (
      <View className="py-8 items-center">
        <Text className="text-sm text-content-secondary">아직 협업자가 없습니다</Text>
      </View>
    );
  }

  return (
    <FlashList<JobPostingCollaboratorWithUser>
      data={collaborators}
      keyExtractor={(item) => item.id}
      // @ts-expect-error - estimatedItemSize is required in FlashList 2.x but types may be missing
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
