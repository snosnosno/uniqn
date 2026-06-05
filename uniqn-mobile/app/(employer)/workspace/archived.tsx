/**
 * UNIQN Mobile - 워크스페이스 보관함 (아카이브된 워크스페이스 복원)
 *
 * @description owner 가 아카이브한 워크스페이스 목록 + 복원.
 *              복원 시 활성 cap(10) 초과면 RPC 가 차단.
 */

import { useCallback } from 'react';
import { View, Text, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StackHeader } from '@/components/headers';
import { Button, EmptyState, ErrorState } from '@/components/ui';
import { useToastStore } from '@/stores/toastStore';
import { useArchivedWorkspaces, useRestoreWorkspace } from '@/hooks/workspace';
import { logger } from '@/utils/logger';
import { isAppError } from '@/errors';
import { formatRelative } from '@/utils/formatters/date';

export default function ArchivedWorkspacesScreen() {
  const { addToast } = useToastStore();
  const { archived, isLoading, error } = useArchivedWorkspaces();
  const restoreMutation = useRestoreWorkspace();

  const handleRestore = useCallback(
    async (workspaceId: string) => {
      try {
        await restoreMutation.mutateAsync(workspaceId);
        // 복원 성공 시 useRestoreWorkspace onSuccess 가 archivedForUser 쿼리를
        // invalidate → mount 된 이 화면 쿼리가 자동 refetch (수동 refetch 불필요).
        addToast({ type: 'success', message: '워크스페이스를 복원했어요' });
      } catch (err) {
        logger.warn('워크스페이스 복원 실패', { error: String(err) });
        const message = isAppError(err) && err.userMessage ? err.userMessage : '복원에 실패했어요';
        addToast({ type: 'error', message });
      }
    },
    [restoreMutation, addToast]
  );

  return (
    <SafeAreaView className="flex-1 bg-surface-page dark:bg-surface" edges={['top', 'bottom']}>
      <StackHeader title="보관함" />
      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" />
        </View>
      ) : error ? (
        <View className="flex-1 items-center justify-center px-6">
          <ErrorState
            title="보관함을 불러올 수 없어요"
            message="네트워크 상태를 확인하고 다시 시도해주세요."
          />
        </View>
      ) : archived.length === 0 ? (
        <View className="flex-1 items-center justify-center px-6">
          <EmptyState
            title="보관한 워크스페이스가 없어요"
            description="워크스페이스를 보관하면 여기에서 복원할 수 있어요."
          />
        </View>
      ) : (
        <ScrollView contentContainerClassName="px-4 py-4">
          {archived.map((ws) => (
            <View
              key={ws.id}
              className="mb-2 flex-row items-center rounded-md bg-white p-4 dark:bg-surface-elevated"
            >
              <View className="flex-1">
                <Text className="text-base font-sans-medium text-content-primary" numberOfLines={1}>
                  {ws.name}
                </Text>
                <Text className="mt-1 text-xs text-content-secondary">
                  {ws.archivedAt ? `${formatRelative(ws.archivedAt)} 보관` : '보관됨'}
                </Text>
              </View>
              <Button
                variant="secondary"
                size="sm"
                onPress={() => handleRestore(ws.id)}
                loading={restoreMutation.isPending && restoreMutation.variables === ws.id}
              >
                복원
              </Button>
            </View>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
