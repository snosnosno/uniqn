/**
 * UNIQN Mobile - CollaboratorAvatarStack
 *
 * @description 공고 상세 헤더 — 협업자 아바타 3개 + "+N" overflow + "공유 관리" 텍스트
 *              0명일 때는 "+ 협업자 추가" CTA
 * @version 1.0.0
 */

import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { UserIcon, UserPlusIcon } from '@/components/icons';
import { useJobPostingCollaborators } from '@/hooks/job-posting/useJobPostingCollaborators';

const VISIBLE_AVATARS = 3;

export interface CollaboratorAvatarStackProps {
  jobPostingId: string;
  onPress?: () => void;
  /** owner / collaborator 시점만 "공유 관리" CTA 표시 (RLS 와 별개의 UI 분기) */
  canManage?: boolean;
}

export function CollaboratorAvatarStack({
  jobPostingId,
  onPress,
  canManage = true,
}: CollaboratorAvatarStackProps) {
  const { collaborators, isLoading } = useJobPostingCollaborators(jobPostingId);

  if (isLoading) {
    return null; // 깜빡임 회피
  }

  const total = collaborators.length;
  const visible = collaborators.slice(0, VISIBLE_AVATARS);
  const overflow = Math.max(0, total - VISIBLE_AVATARS);

  if (total === 0) {
    return (
      <Pressable
        onPress={onPress}
        className="flex-row items-center gap-1 px-3 py-1.5 rounded-md bg-gray-100 dark:bg-surface-elevated active:opacity-70"
        accessibilityRole="button"
        accessibilityLabel="협업자 추가"
      >
        <UserPlusIcon size={14} color="#6B7280" />
        <Text className="text-sm text-content-secondary">협업자 추가</Text>
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center gap-2 px-2 py-1 rounded-md active:opacity-70"
      accessibilityRole="button"
      accessibilityLabel={`협업자 ${total}명, 공유 관리`}
    >
      <View className="flex-row items-center" style={{ marginRight: 4 }}>
        {visible.map((c, idx) => (
          <View
            key={c.id}
            className="w-7 h-7 rounded-full bg-gray-100 dark:bg-surface-elevated border-2 border-white dark:border-surface items-center justify-center overflow-hidden"
            style={{ marginLeft: idx === 0 ? 0 : -8 }}
          >
            {c.photoUrl ? (
              <Image
                source={{ uri: c.photoUrl }}
                style={{ width: 24, height: 24 }}
                contentFit="cover"
              />
            ) : (
              <UserIcon size={12} color="#9CA3AF" />
            )}
          </View>
        ))}
        {overflow > 0 ? (
          <View
            className="w-7 h-7 rounded-full bg-gray-200 dark:bg-surface-elevated border-2 border-white dark:border-surface items-center justify-center"
            style={{ marginLeft: -8 }}
          >
            <Text className="text-xs text-content-secondary font-medium">+{overflow}</Text>
          </View>
        ) : null}
      </View>
      {canManage ? (
        <Text className="text-sm text-content-primary font-medium">공유 관리</Text>
      ) : null}
    </Pressable>
  );
}
