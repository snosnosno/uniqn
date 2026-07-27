/**
 * UNIQN Mobile - Workspace Invite Screen (S2)
 *
 * @description 팀 멤버 초대 — owner 만 진입. 닉네임 prefix 검색으로 후보를 고른다.
 *
 * 2026-07-19: 이메일 정확일치 → 닉네임 검색으로 전환.
 *   나머지 "사람 찾기" 흐름 두 개(스태프 직접추가·공고 협업자)가 이미 닉네임 prefix +
 *   SECDEF RPC 라 여기만 구식 직접 테이블 쿼리로 남아 있었다. 사장이 상대방 이메일
 *   주소를 정확히 알아야 하는 UX 부담도 이질적이었다.
 *
 *   후보 필터(구인자/관리자 한정, 본인·기존멤버·대기중초대 제외)와 권한·최소 2자·
 *   rate limit 은 전부 RPC 가 강제한다. 이 화면은 결과를 보여주고 고르게만 한다.
 */

import { useCallback, useState } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { StackHeader } from '@/components/headers';
import { Avatar, Button, EmptyState } from '@/components/ui';
import { NicknameSearchField } from '@/components/staffPicker/NicknameSearchField';
import { useToastStore } from '@/stores/toastStore';
import { useInviteWorkspaceMember, useWorkspaceInviteSearch } from '@/hooks/workspace';
import type { WorkspaceInviteCandidate } from '@/repositories';
import { logger } from '@/utils/logger';
import { isAppError } from '@/errors';

export default function WorkspaceInviteScreen() {
  const { workspaceId } = useLocalSearchParams<{ workspaceId: string }>();
  const { addToast } = useToastStore();
  const [nickname, setNickname] = useState('');
  const [selected, setSelected] = useState<WorkspaceInviteCandidate | null>(null);

  const { results, isSearching, errorMessage, searched, search, reset } = useWorkspaceInviteSearch(
    workspaceId ?? ''
  );
  const inviteMutation = useInviteWorkspaceMember();

  const handleChangeNickname = useCallback(
    (value: string) => {
      setNickname(value);
      // 입력이 바뀌면 옛 결과·선택을 버린다 — 바뀐 질의와 짝이 안 맞는 카드가 남지 않게.
      setSelected(null);
      reset();
    },
    [reset]
  );

  const handleSearch = useCallback(() => {
    setSelected(null);
    void search(nickname);
  }, [nickname, search]);

  const handleInvite = useCallback(async () => {
    if (!workspaceId || !selected) return;
    try {
      await inviteMutation.mutateAsync({ workspaceId, inviteeUserId: selected.id });
      addToast({ type: 'success', message: '초대를 보냈어요' });
      router.back();
    } catch (err) {
      logger.warn('초대 발송 실패', { error: String(err) });
      const message =
        isAppError(err) && err.userMessage ? err.userMessage : '초대 발송에 실패했어요';
      addToast({ type: 'error', message });
    }
  }, [workspaceId, selected, inviteMutation, addToast]);

  if (!workspaceId) {
    return (
      <SafeAreaView className="flex-1 bg-surface-page dark:bg-surface" edges={['top', 'bottom']}>
        <StackHeader title="멤버 초대" />
        <View className="flex-1 items-center justify-center px-6">
          <EmptyState
            title="팀을 선택해주세요"
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
          <NicknameSearchField
            nickname={nickname}
            onChangeNickname={handleChangeNickname}
            onSearch={handleSearch}
            isSearching={isSearching}
          />
          {errorMessage ? (
            <Text className="mt-2 text-sm text-error-600 dark:text-error-400">{errorMessage}</Text>
          ) : null}
        </View>

        <View className="mt-6 px-4">
          {results.length > 0 ? (
            <>
              <Text className="mb-2 text-sm font-sans-medium text-content-primary dark:text-content-primary">
                검색 결과 {results.length}명
              </Text>
              <View className="gap-2">
                {results.map((candidate) => {
                  const isSelected = selected?.id === candidate.id;
                  return (
                    <Pressable
                      key={candidate.id}
                      onPress={() => setSelected(candidate)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: isSelected }}
                      accessibilityLabel={`${candidate.nickname ?? '익명'} 선택`}
                      className={`min-h-[56px] flex-row items-center rounded-md border p-3 ${
                        isSelected
                          ? 'border-primary-500 bg-primary-50 dark:bg-surface-elevated'
                          : 'border-divider bg-white dark:bg-surface-elevated'
                      }`}
                    >
                      <Avatar
                        source={candidate.photoUrl ?? undefined}
                        name={candidate.nickname ?? candidate.name ?? '익명'}
                        size="md"
                      />
                      <View className="ml-3 flex-1">
                        <Text className="text-base font-sans-medium text-content-primary dark:text-content-primary">
                          {candidate.nickname ?? '익명'}
                        </Text>
                        {candidate.name ? (
                          <Text className="text-sm text-content-secondary dark:text-content-secondary">
                            {candidate.name}
                          </Text>
                        ) : null}
                      </View>
                    </Pressable>
                  );
                })}
              </View>

              {selected ? (
                <View className="mt-4 rounded-md bg-white p-4 dark:bg-surface-elevated">
                  <Text className="text-sm text-content-secondary dark:text-content-secondary">
                    초대를 수락하면 이 팀의 모든 공고를 만들고 수정할 수 있어요. 근무표와 지점 급여
                    단가도 함께 보고 바꿀 수 있어요. 삭제는 소유자만 가능해요.
                  </Text>
                  <View className="mt-4">
                    <Button
                      variant="primary"
                      onPress={handleInvite}
                      loading={inviteMutation.isPending}
                    >
                      {`${selected.nickname ?? '이 사용자'}님을 편집자로 초대`}
                    </Button>
                  </View>
                </View>
              ) : null}
            </>
          ) : searched && !errorMessage ? (
            <View className="items-center py-12">
              <EmptyState
                title="일치하는 구인자가 없어요"
                description="닉네임 앞부분을 다시 확인해주세요. 구인자로 등록된 사용자만 팀에 초대할 수 있고, 이미 멤버이거나 초대 중인 사람은 나오지 않아요."
              />
            </View>
          ) : !searched && !errorMessage ? (
            <View className="items-center py-12">
              <EmptyState
                title="닉네임으로 찾아보세요"
                description="구인자로 등록된 사용자만 멤버로 초대할 수 있어요."
              />
            </View>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
