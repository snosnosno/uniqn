/**
 * UNIQN Mobile - Workspace Invite Screen (S2)
 *
 * @description 공고 워크스페이스 협업 편집 (PR #3)
 *              owner 만 진입 가능 — 이메일 정확 매칭으로 사용자 lookup 후 초대.
 *              Phase 2: 외부 이메일 + 매직 링크 (workspace_invitations.invitee_email 추가).
 */

import { useCallback, useState } from 'react';
import { View, Text, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { StackHeader } from '@/components/headers';
import { Avatar, Button, EmptyState, Input } from '@/components/ui';
import { useToastStore } from '@/stores/toastStore';
import { useInviteWorkspaceMember } from '@/hooks/workspace';
import { workspaceService } from '@/services/workspace';
import { logger } from '@/utils/logger';
import { isAppError } from '@/errors';

interface LookupResult {
  id: string;
  name: string | null;
  email: string;
  photoUrl: string | null;
}

export default function WorkspaceInviteScreen() {
  const { workspaceId } = useLocalSearchParams<{ workspaceId: string }>();
  const { addToast } = useToastStore();
  const [emailDraft, setEmailDraft] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [lookupResult, setLookupResult] = useState<LookupResult | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);

  const inviteMutation = useInviteWorkspaceMember();

  const handleSearch = useCallback(async () => {
    const trimmed = emailDraft.trim();
    if (!trimmed) {
      setLookupResult(null);
      setSearchError(null);
      return;
    }

    if (!trimmed.includes('@')) {
      setSearchError('이메일 형식을 확인해주세요');
      setLookupResult(null);
      return;
    }

    setIsSearching(true);
    setSearchError(null);
    try {
      const found = await workspaceService.lookupUserByEmail(trimmed);
      setLookupResult(found);
      if (!found) {
        setSearchError('등록된 사용자를 찾을 수 없어요');
      }
    } catch (err) {
      logger.warn('사용자 검색 실패', { error: String(err) });
      setSearchError('검색에 실패했어요. 다시 시도해주세요.');
    } finally {
      setIsSearching(false);
    }
  }, [emailDraft]);

  const handleInvite = useCallback(async () => {
    if (!workspaceId || !lookupResult) return;
    try {
      await inviteMutation.mutateAsync({
        workspaceId,
        inviteeUserId: lookupResult.id,
      });
      addToast({ type: 'success', message: '초대를 보냈어요' });
      router.back();
    } catch (err) {
      logger.warn('초대 발송 실패', { error: String(err) });
      const message =
        isAppError(err) && err.userMessage ? err.userMessage : '초대 발송에 실패했어요';
      addToast({ type: 'error', message });
    }
  }, [workspaceId, lookupResult, inviteMutation, addToast]);

  if (!workspaceId) {
    return (
      <SafeAreaView className="flex-1 bg-surface-page dark:bg-surface" edges={['top', 'bottom']}>
        <StackHeader title="멤버 초대" />
        <View className="flex-1 items-center justify-center px-6">
          <EmptyState
            title="워크스페이스를 선택해주세요"
            description="이전 화면으로 돌아가 다시 시도해주세요."
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-surface-page dark:bg-surface" edges={['top', 'bottom']}>
      <StackHeader title="멤버 초대" />
      <ScrollView contentContainerClassName="pb-8" keyboardShouldPersistTaps="handled">
        <View className="px-4 pt-4">
          <Text className="mb-2 text-sm font-sans-medium text-content-primary">
            등록된 사용자 이메일
          </Text>
          <View className="flex-row items-center gap-2">
            <View className="flex-1">
              <Input
                value={emailDraft}
                onChangeText={(t) => {
                  setEmailDraft(t);
                  setLookupResult(null);
                  setSearchError(null);
                }}
                placeholder="user@example.com"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="search"
                onSubmitEditing={handleSearch}
              />
            </View>
            <Button
              variant="primary"
              size="md"
              onPress={handleSearch}
              loading={isSearching}
              disabled={isSearching || !emailDraft.trim()}
            >
              검색
            </Button>
          </View>

          {searchError && <Text className="mt-2 text-xs text-danger-500">{searchError}</Text>}
        </View>

        {/* 결과 영역 */}
        <View className="mt-6 px-4">
          {isSearching ? (
            <View className="items-center py-8">
              <ActivityIndicator size="small" />
            </View>
          ) : lookupResult ? (
            <View className="rounded-md bg-white p-4 dark:bg-surface-elevated">
              <View className="flex-row items-center">
                <Avatar
                  source={lookupResult.photoUrl ?? undefined}
                  name={lookupResult.name ?? lookupResult.email}
                  size="md"
                />
                <View className="ml-3 flex-1">
                  <Text className="text-base font-sans-medium text-content-primary">
                    {lookupResult.name ?? '익명'}
                  </Text>
                  <Text className="text-sm text-content-secondary">{lookupResult.email}</Text>
                </View>
              </View>
              <Text className="mt-3 text-xs text-content-secondary">
                초대를 수락하면 이 워크스페이스의 모든 공고를 만들고 수정할 수 있어요. 삭제는
                소유자만 가능해요.
              </Text>
              <View className="mt-4">
                <Button variant="primary" onPress={handleInvite} loading={inviteMutation.isPending}>
                  편집자로 초대
                </Button>
              </View>
            </View>
          ) : (
            !searchError && (
              <View className="items-center py-12">
                <EmptyState
                  title="이메일을 입력해주세요"
                  description="등록된 사용자 이메일로 검색하면 초대할 수 있어요."
                />
              </View>
            )
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
