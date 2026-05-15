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
import { ko } from 'date-fns/locale/ko';
import { UserIcon } from '@/components/icons';
import { confirmAction } from '@/utils/confirmAction';
import { triggerHaptic } from '@/utils/haptics';
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
    <View className="flex-row items-center gap-3 py-3 px-4 bg-surface-page">
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
          onPress={() => {
            const label = collaborator.displayName ?? '이름 없음';
            confirmAction({
              title: '공고 관리에서 나가기',
              message: `이 공고의 협업자 목록에서 ${label} 본인을 제거합니다. 더 이상 지원자 검토·승인을 할 수 없게 됩니다.`,
              confirmText: '나가기',
              destructive: true,
              onConfirm: () => {
                void triggerHaptic('warning');
                onLeave?.();
              },
            });
          }}
          disabled={disabled}
          hitSlop={8}
          className="min-h-[44px] min-w-[44px] px-3 items-center justify-center rounded-md border border-content-secondary/30 active:bg-gray-100 dark:active:bg-surface-elevated"
          accessibilityRole="button"
          accessibilityLabel="공고 관리에서 나가기"
        >
          <Text className="text-sm text-content-primary">나가기</Text>
        </Pressable>
      ) : isOwner ? (
        <Pressable
          onPress={() => {
            const label = collaborator.displayName ?? collaborator.email ?? '이 협업자';
            confirmAction({
              title: '협업자 제거',
              message: `${label} 님을 이 공고의 협업자 목록에서 제거합니다. 더 이상 지원자 관리·정산에 참여할 수 없게 됩니다.`,
              confirmText: '제거',
              destructive: true,
              onConfirm: () => {
                void triggerHaptic('warning');
                onRemove?.(collaborator.userId);
              },
            });
          }}
          disabled={disabled}
          hitSlop={8}
          className="min-h-[44px] min-w-[44px] px-3 items-center justify-center rounded-md border border-error-500/30 active:bg-error-50 dark:active:bg-error-500/20"
          accessibilityRole="button"
          accessibilityLabel={`${collaborator.displayName ?? '이 협업자'} 제거`}
        >
          <Text className="text-sm font-medium text-error-500">제거</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
