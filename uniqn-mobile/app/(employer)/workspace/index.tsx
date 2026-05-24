/**
 * UNIQN Mobile - Workspace Settings Screen (S1)
 *
 * @description 공고 워크스페이스 협업 편집 (PR #3)
 *              - owner / editor 모두 표시
 *              - owner 만 [멤버 초대] / 이름 변경 / 멤버 제거 노출 (UI 분기)
 *              - RLS 가 진짜 게이트
 */

import { useCallback, useState } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { StackHeader } from '@/components/headers';
import { Avatar, Badge, Button, EmptyState, ErrorState, Input } from '@/components/ui';
import { useAuthStore } from '@/stores/authStore';
import { useToastStore } from '@/stores/toastStore';
import { useModalStore } from '@/stores/modalStore';
import {
  useActiveWorkspace,
  useWorkspaceMembers,
  useWorkspaceOwnerProfile,
  useUpdateWorkspaceName,
  useRemoveWorkspaceMember,
  useCreateWorkspace,
  useWorkspaces,
  useArchiveWorkspace,
} from '@/hooks/workspace';
import { WorkspaceContextBar } from '@/components/workspace';
import { logger } from '@/utils/logger';
import { isAppError } from '@/errors';
import type { WorkspaceMemberWithUser } from '@/types/workspace';

export default function WorkspaceSettingsScreen() {
  const { user } = useAuthStore();
  const { addToast } = useToastStore();
  const { showConfirm } = useModalStore();
  // useActiveWorkspace 가 내부에서 useWorkspaces 를 호출 — TanStack Query 가 동일 키로
  // 중복 조회 dedup. error 만 별도로 노출되지 않으므로 useWorkspaces 한 번 더 호출.
  const { error } = useWorkspaces();
  const { activeWorkspace, isLoading } = useActiveWorkspace();

  const isOwner = !!user?.uid && activeWorkspace?.ownerId === user.uid;

  const {
    members,
    isLoading: membersLoading,
    error: membersError,
  } = useWorkspaceMembers(activeWorkspace?.id, activeWorkspace?.ownerId);
  const { ownerProfile } = useWorkspaceOwnerProfile(activeWorkspace?.id);

  const updateNameMutation = useUpdateWorkspaceName(activeWorkspace?.id);
  const removeMemberMutation = useRemoveWorkspaceMember(activeWorkspace?.id);
  const createMutation = useCreateWorkspace();
  const archiveMutation = useArchiveWorkspace();

  const handleArchive = useCallback(() => {
    if (!activeWorkspace) return;
    showConfirm(
      '워크스페이스 보관',
      `'${activeWorkspace.name}' 워크스페이스를 보관할까요?\n공고와 기록은 보존되며 보관함에서 복원할 수 있어요.`,
      async () => {
        try {
          await archiveMutation.mutateAsync(activeWorkspace.id);
          addToast({ type: 'success', message: '워크스페이스를 보관했어요' });
        } catch (err) {
          logger.warn('워크스페이스 보관 실패', { error: String(err) });
          const message =
            isAppError(err) && err.userMessage ? err.userMessage : '보관에 실패했어요';
          addToast({ type: 'error', message });
        }
      }
    );
  }, [activeWorkspace, archiveMutation, addToast, showConfirm]);

  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState('');

  const handleSaveName = useCallback(async () => {
    if (!activeWorkspace || !nameDraft.trim()) {
      setEditingName(false);
      return;
    }
    try {
      await updateNameMutation.mutateAsync(nameDraft.trim());
      addToast({ type: 'success', message: '워크스페이스 이름이 변경되었어요' });
      setEditingName(false);
    } catch (err) {
      logger.warn('워크스페이스 이름 변경 실패', { error: String(err) });
      const message =
        isAppError(err) && err.userMessage ? err.userMessage : '이름 변경에 실패했어요';
      addToast({ type: 'error', message });
    }
  }, [activeWorkspace, nameDraft, updateNameMutation, addToast]);

  const handleRemoveMember = useCallback(
    (member: WorkspaceMemberWithUser) => {
      // showConfirm — native + web 양쪽 호환 (Alert.alert 은 web 에서 무음)
      showConfirm(
        '멤버 제거',
        `${member.displayName ?? member.email ?? '멤버'}님을 워크스페이스에서 제거할까요?\n권한이 즉시 회수됩니다.`,
        async () => {
          try {
            await removeMemberMutation.mutateAsync(member.userId);
            addToast({ type: 'success', message: '멤버를 제거했어요' });
          } catch (err) {
            const message =
              isAppError(err) && err.userMessage ? err.userMessage : '제거에 실패했어요';
            addToast({ type: 'error', message });
          }
        }
      );
    },
    [removeMemberMutation, addToast, showConfirm]
  );

  const handleCreateFirstWorkspace = useCallback(async () => {
    try {
      const created = await createMutation.mutateAsync(`${user?.displayName ?? '내'} 워크스페이스`);
      addToast({ type: 'success', message: '워크스페이스가 생성되었어요' });
      logger.info('첫 워크스페이스 생성', { workspaceId: created.id });
    } catch (err) {
      const message =
        isAppError(err) && err.userMessage ? err.userMessage : '워크스페이스 생성에 실패했어요';
      addToast({ type: 'error', message });
    }
  }, [createMutation, user?.displayName, addToast]);

  if (isLoading) {
    return (
      <SafeAreaView
        className="flex-1 items-center justify-center bg-surface-page dark:bg-surface"
        edges={['top', 'bottom']}
      >
        <StackHeader title="워크스페이스" />
        <ActivityIndicator size="large" />
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView className="flex-1 bg-surface-page dark:bg-surface" edges={['top', 'bottom']}>
        <StackHeader title="워크스페이스" />
        <View className="flex-1 items-center justify-center px-6">
          <ErrorState
            title="워크스페이스를 불러올 수 없어요"
            message="네트워크 상태를 확인하고 다시 시도해주세요."
          />
        </View>
      </SafeAreaView>
    );
  }

  if (!activeWorkspace) {
    return (
      <SafeAreaView className="flex-1 bg-surface-page dark:bg-surface" edges={['top', 'bottom']}>
        <StackHeader title="워크스페이스" />
        <View className="flex-1 items-center justify-center px-6">
          <EmptyState
            title="워크스페이스가 없어요"
            description="공고 협업을 위해 워크스페이스를 만들어보세요."
          />
          <View className="mt-6 w-full max-w-xs">
            <Button
              variant="primary"
              onPress={handleCreateFirstWorkspace}
              loading={createMutation.isPending}
            >
              첫 워크스페이스 만들기
            </Button>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-surface-page dark:bg-surface" edges={['top', 'bottom']}>
      <StackHeader title="워크스페이스" />
      <WorkspaceContextBar />
      <ScrollView contentContainerClassName="pb-8">
        {/* 워크스페이스 헤더 */}
        <View className="border-b border-secondary-200 bg-white px-4 py-5 dark:border-surface-overlay dark:bg-surface">
          {editingName ? (
            <View className="flex-row items-center gap-2">
              <View className="flex-1">
                <Input
                  value={nameDraft}
                  onChangeText={setNameDraft}
                  autoFocus
                  maxLength={50}
                  placeholder="워크스페이스 이름"
                />
              </View>
              <Button
                variant="primary"
                size="sm"
                onPress={handleSaveName}
                loading={updateNameMutation.isPending}
              >
                저장
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onPress={() => {
                  setEditingName(false);
                  setNameDraft('');
                }}
              >
                취소
              </Button>
            </View>
          ) : (
            <View className="flex-row items-center justify-between">
              <View className="flex-1">
                <Text className="text-xl font-display text-content-primary">
                  {activeWorkspace.name}
                </Text>
                <Text className="mt-1 text-sm text-content-secondary">
                  멤버 {activeWorkspace.memberCount + 1}명 · {isOwner ? '소유자' : '편집자'}
                </Text>
              </View>
              {isOwner && (
                <Pressable
                  onPress={() => {
                    setNameDraft(activeWorkspace.name);
                    setEditingName(true);
                  }}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="워크스페이스 이름 변경"
                >
                  <Text className="text-sm font-sans-medium text-primary-500">이름 변경</Text>
                </Pressable>
              )}
            </View>
          )}
        </View>

        {/* 멤버 섹션 */}
        <View className="mt-4 px-4">
          <View className="mb-3 flex-row items-center justify-between">
            <Text className="text-base font-display text-content-primary">멤버</Text>
            {isOwner && (
              <Button
                variant="primary"
                size="sm"
                onPress={() =>
                  router.push({
                    pathname: '/(employer)/workspace/invite',
                    params: { workspaceId: activeWorkspace.id },
                  })
                }
              >
                + 초대
              </Button>
            )}
          </View>

          {membersLoading ? (
            <ActivityIndicator size="small" />
          ) : membersError ? (
            <View className="items-center py-8">
              <ErrorState
                title="멤버를 불러올 수 없어요"
                message="네트워크 상태를 확인하고 다시 시도해주세요."
              />
            </View>
          ) : !ownerProfile && members.length === 0 ? (
            <View className="items-center py-8">
              <EmptyState
                title="아직 멤버가 없어요"
                description={isOwner ? '편집자를 초대해보세요.' : ''}
              />
            </View>
          ) : (
            <>
              {ownerProfile && (
                <View
                  key={`owner-${ownerProfile.id}`}
                  className="mb-2 flex-row items-center rounded-md bg-white p-3 dark:bg-surface-elevated"
                >
                  <Avatar
                    source={ownerProfile.photoUrl ?? undefined}
                    name={ownerProfile.displayName ?? '?'}
                    size="md"
                  />
                  <View className="ml-3 flex-1">
                    <Text className="text-sm font-sans-medium text-content-primary">
                      {ownerProfile.displayName ?? '소유자'}
                    </Text>
                  </View>
                  <Badge variant="warning" size="sm">
                    소유자
                  </Badge>
                </View>
              )}
              {members.map((member) => (
                <View
                  key={member.userId}
                  className="mb-2 flex-row items-center rounded-md bg-white p-3 dark:bg-surface-elevated"
                >
                  <Avatar
                    source={member.photoUrl ?? undefined}
                    name={member.displayName ?? member.email ?? '?'}
                    size="md"
                  />
                  <View className="ml-3 flex-1">
                    <Text className="text-sm font-sans-medium text-content-primary">
                      {member.displayName ?? '익명'}
                    </Text>
                    <Text className="text-xs text-content-secondary">{member.email ?? ''}</Text>
                  </View>
                  <Badge variant="info" size="sm">
                    편집자
                  </Badge>
                  {isOwner && (
                    <Pressable
                      onPress={() => handleRemoveMember(member)}
                      hitSlop={8}
                      accessibilityRole="button"
                      accessibilityLabel={`${member.displayName ?? '멤버'} 제거`}
                      className="ml-2 min-h-[44px] min-w-[44px] items-center justify-center rounded-md"
                    >
                      {({ pressed }) => (
                        <View
                          className={`rounded-md px-3 py-2 ${
                            pressed ? 'bg-error-100 dark:bg-error-900/30' : ''
                          }`}
                        >
                          <Text className="text-sm font-sans-medium text-error-600 dark:text-error-400">
                            제거
                          </Text>
                        </View>
                      )}
                    </Pressable>
                  )}
                </View>
              ))}
            </>
          )}
        </View>

        {/* 보관함 + 워크스페이스 보관 (owner 전용) */}
        {isOwner && (
          <View className="mt-8 gap-3 px-4">
            <Pressable
              onPress={() => router.push('/(employer)/workspace/archived')}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="보관함 열기"
              className="min-h-[44px] flex-row items-center justify-between rounded-md bg-white px-4 py-3 dark:bg-surface-elevated"
            >
              <Text className="text-sm font-sans-medium text-content-primary">보관함</Text>
              <Text className="text-sm text-content-secondary">보관한 워크스페이스 복원 ›</Text>
            </Pressable>

            <Button variant="secondary" onPress={handleArchive} loading={archiveMutation.isPending}>
              이 워크스페이스 보관
            </Button>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
