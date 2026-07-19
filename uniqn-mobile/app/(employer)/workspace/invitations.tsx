/**
 * UNIQN Mobile - Workspace Invitations Received Screen (S3)
 *
 * @description 본인이 받은 pending 초대 목록 (PR #3)
 *              수락 / 거절 모두 atomic RPC 경유.
 *              만료 초대는 D3 pg_cron 으로 자동 expired 전환됨.
 */

import { useCallback } from 'react';
import { View, Text, RefreshControl, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppFlashList } from '@/components/ui/AppFlashList';
import { router } from 'expo-router';
import { StackHeader } from '@/components/headers';
import { Avatar, Badge, Button, EmptyState, ErrorState } from '@/components/ui';
import { useToastStore } from '@/stores/toastStore';
import {
  useReceivedWorkspaceInvitations,
  useAcceptWorkspaceInvitation,
  useRejectWorkspaceInvitation,
} from '@/hooks/workspace';
import { PTR_REFRESH_PROPS } from '@/constants/ptr';
import { logger } from '@/utils/logger';
import { isAppError } from '@/errors';
import type { ReceivedWorkspaceInvitation } from '@/types/workspace';

function formatExpiresAt(expiresAtIso: string): string {
  const d = new Date(expiresAtIso);
  if (Number.isNaN(d.getTime())) return '';
  const month = d.getMonth() + 1;
  const day = d.getDate();
  return `${month}월 ${day}일까지 수락 가능`;
}

export default function WorkspaceInvitationsScreen() {
  const { addToast } = useToastStore();
  const { invitations, isLoading, isRefetching, error, refetch } =
    useReceivedWorkspaceInvitations();
  const acceptMutation = useAcceptWorkspaceInvitation();
  const rejectMutation = useRejectWorkspaceInvitation();

  const handleAccept = useCallback(
    async (invitation: ReceivedWorkspaceInvitation) => {
      try {
        const result = await acceptMutation.mutateAsync(invitation.id);
        if (result.idempotent) {
          addToast({ type: 'info', message: '이미 참여 중인 팀입니다' });
        } else {
          addToast({ type: 'success', message: '팀에 참여했어요' });
        }
        router.replace('/(employer)/workspace');
      } catch (err) {
        logger.warn('초대 수락 실패', { error: String(err) });
        const message = isAppError(err) && err.userMessage ? err.userMessage : '수락에 실패했어요';
        addToast({ type: 'error', message });
      }
    },
    [acceptMutation, addToast]
  );

  const handleReject = useCallback(
    async (invitation: ReceivedWorkspaceInvitation) => {
      try {
        await rejectMutation.mutateAsync(invitation.id);
        addToast({ type: 'info', message: '초대를 거절했어요' });
      } catch (err) {
        logger.warn('초대 거절 실패', { error: String(err) });
        const message = isAppError(err) && err.userMessage ? err.userMessage : '거절에 실패했어요';
        addToast({ type: 'error', message });
      }
    },
    [rejectMutation, addToast]
  );

  const renderItem = useCallback(
    ({ item }: { item: ReceivedWorkspaceInvitation }) => (
      <View className="mx-4 mb-3 rounded-md bg-white p-4 dark:bg-surface-elevated">
        <View className="flex-row items-start">
          <Avatar name={item.workspaceName || '팀'} size="md" />
          <View className="ml-3 flex-1">
            <Text className="text-base font-sans-medium text-content-primary">
              {item.workspaceName || '팀'}
            </Text>
            <Text className="mt-0.5 text-xs text-content-secondary">
              {item.inviterDisplayName ?? '누군가'}님이 초대 · {formatExpiresAt(item.expiresAt)}
            </Text>
          </View>
          <Badge variant="info" size="sm">
            편집자
          </Badge>
        </View>

        <Text className="mt-3 text-xs text-content-secondary">
          {item.workspaceName} 팀의 편집자가 되면, 이 팀의 모든 공고를 만들고 수정할 수 있어요.
          삭제는 소유자만 가능해요.
        </Text>

        <View className="mt-4 flex-row gap-2">
          <View className="flex-1">
            <Button
              variant="ghost"
              onPress={() => handleReject(item)}
              loading={rejectMutation.isPending && rejectMutation.variables === item.id}
            >
              거절
            </Button>
          </View>
          <View className="flex-1">
            <Button
              variant="primary"
              onPress={() => handleAccept(item)}
              loading={acceptMutation.isPending && acceptMutation.variables === item.id}
            >
              수락
            </Button>
          </View>
        </View>
      </View>
    ),
    [
      acceptMutation.isPending,
      acceptMutation.variables,
      handleAccept,
      handleReject,
      rejectMutation.isPending,
      rejectMutation.variables,
    ]
  );

  if (isLoading) {
    return (
      <SafeAreaView
        className="flex-1 items-center justify-center bg-surface-page dark:bg-surface"
        edges={['top', 'bottom']}
      >
        <StackHeader title="받은 초대" />
        <ActivityIndicator size="large" />
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView className="flex-1 bg-surface-page dark:bg-surface" edges={['top', 'bottom']}>
        <StackHeader title="받은 초대" />
        <View className="flex-1 items-center justify-center px-6">
          <ErrorState
            title="초대를 불러올 수 없어요"
            message="네트워크 상태를 확인하고 다시 시도해주세요."
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-surface-page dark:bg-surface" edges={['top', 'bottom']}>
      <StackHeader title="받은 초대" />
      <AppFlashList
        data={invitations}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        estimatedItemSize={140}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} {...PTR_REFRESH_PROPS} />
        }
        contentContainerClassName="pt-3 pb-8"
        ListEmptyComponent={
          <View className="items-center px-6 py-12">
            <EmptyState
              title="받은 초대가 없어요"
              description="팀 소유자가 초대하면 여기에 표시됩니다."
            />
          </View>
        }
      />
    </SafeAreaView>
  );
}
