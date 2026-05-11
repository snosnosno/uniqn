/**
 * UNIQN Mobile - CollaboratorRow
 *
 * @description 협업자 1명 행 — 이름/이메일/추가일 + 액션 버튼
 *              owner 시점: ✕ 제거 / collaborator 본인 시점: "나가기"
 * @version 1.0.0
 */

import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { UserIcon, XIcon } from '@/components/icons';
import type { JobPostingCollaboratorWithUser } from '@/types/jobPostingCollaborator';

export interface CollaboratorRowProps {
  collaborator: JobPostingCollaboratorWithUser;
  /** 현재 로그인 사용자가 workspace owner 인지 (UI 분기) */
  isOwner: boolean;
  /** 현재 로그인 사용자 ID — 본인 행 식별 */
  currentUserId: string | undefined;
  /** owner 가 제거할 때 */
  onRemove?: (userId: string) => void;
  /** collaborator 본인이 나갈 때 */
  onLeave?: () => void;
  disabled?: boolean;
}

export function CollaboratorRow({
  collaborator,
  isOwner,
  currentUserId,
  onRemove,
  onLeave,
  disabled,
}: CollaboratorRowProps) {
  const isSelf = collaborator.userId === currentUserId;
  const addedAtLabel = (() => {
    try {
      return format(new Date(collaborator.addedAt), 'yyyy-MM-dd', { locale: ko });
    } catch {
      return '';
    }
  })();

  return (
    <View className="flex-row items-center gap-3 py-3 px-4 bg-white dark:bg-surface">
      {/* Avatar */}
      <View className="w-10 h-10 rounded-full bg-gray-100 dark:bg-surface-elevated items-center justify-center overflow-hidden">
        {collaborator.photoUrl ? (
          <Image
            source={{ uri: collaborator.photoUrl }}
            style={{ width: 40, height: 40 }}
            contentFit="cover"
          />
        ) : (
          <UserIcon size={20} color="#9CA3AF" />
        )}
      </View>

      {/* 이름 + 이메일 + 추가일 */}
      <View className="flex-1 min-w-0">
        <Text className="text-base font-medium text-content-primary" numberOfLines={1}>
          {collaborator.displayName ?? '이름 없음'}
        </Text>
        <Text className="text-xs text-content-secondary" numberOfLines={1}>
          {collaborator.email ?? ''}
          {addedAtLabel ? `  ·  ${addedAtLabel} 추가` : ''}
        </Text>
      </View>

      {/* 액션 */}
      {isSelf ? (
        <Pressable
          onPress={onLeave}
          disabled={disabled}
          className="px-3 py-1.5 rounded-md border border-content-secondary/30 active:bg-gray-100 dark:active:bg-surface-elevated"
          accessibilityRole="button"
          accessibilityLabel="공고 관리에서 나가기"
        >
          <Text className="text-sm text-content-primary">나가기</Text>
        </Pressable>
      ) : isOwner ? (
        <Pressable
          onPress={() => onRemove?.(collaborator.userId)}
          disabled={disabled}
          className="p-2 active:opacity-60"
          accessibilityRole="button"
          accessibilityLabel="협업자 제거"
        >
          <XIcon size={20} color="#9CA3AF" />
        </Pressable>
      ) : null}
    </View>
  );
}
