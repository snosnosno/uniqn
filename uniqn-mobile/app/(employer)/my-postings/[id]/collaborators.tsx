/**
 * UNIQN Mobile - 공고별 협업자 관리 라우트
 *
 * @description owner: 검색 + 추가 + 제거 / collaborator 본인: 자기 나가기만
 *              권한 강제는 RLS — UI 분기는 데이터 기반 (workspace owner 인지)
 * @version 1.0.0
 */

import React from 'react';
import { View, Text, KeyboardAvoidingView, Platform, Pressable, ScrollView } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StackHeader } from '@/components/headers';
import { useAuthStore } from '@/stores/authStore';
import { useJobPostingCollaborators } from '@/hooks/job-posting/useJobPostingCollaborators';
import { useJobDetailContext } from './_layout';
import { CollaboratorList } from '@/components/job-posting/CollaboratorList';
import { CollaboratorSearch } from '@/components/job-posting/CollaboratorSearch';
import { ErrorState } from '@/components/ui';
import { loadFailed } from '@/constants/messages';

export default function CollaboratorsRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const jobPostingId = id;

  const { user } = useAuthStore();
  const currentUserId = user?.uid;

  // 공고 데이터는 레이아웃이 realtime 구독과 함께 한 번만 조회한다.
  const { job: jobPosting } = useJobDetailContext();
  const {
    collaborators,
    isLoading,
    error,
    refetch,
    add,
    isAdding,
    remove,
    isRemoving,
    leaveSelf,
    changeRole,
    isChangingRole,
  } = useJobPostingCollaborators(jobPostingId);

  // workspace owner 여부 — RLS 가 진짜 게이트, UI 분기용
  // ownerId 가 현재 사용자면 owner.
  const isOwner = !!jobPosting && jobPosting.ownerId === currentUserId;

  const title = jobPosting?.title ?? '공고 협업자';
  const total = collaborators.length;

  return (
    <SafeAreaView className="flex-1 bg-surface-page dark:bg-surface" edges={['top', 'bottom']}>
      <StackHeader title="공유 관리" fallbackHref={`/(employer)/my-postings/${jobPostingId}`} />

      <View className="px-4 py-3 border-b border-divider">
        <Text className="text-base font-medium text-content-primary" numberOfLines={1}>
          {title}
        </Text>
        {total > 0 ? (
          <Text className="text-sm text-content-secondary mt-0.5">
            {`${total}명이 함께 관리 중`}
          </Text>
        ) : null}
        {/* 팀 화면의 "이 팀의 모든 공고" 와 짝(S5). 팀 링크는 사장에게만 — 협업자 본인이 누르면
            이 공고와 무관한 자기 팀 화면으로 가서 오히려 헷갈린다. */}
        <View className="flex-row items-center justify-between mt-0.5">
          <Text className="text-sm text-content-secondary">이 공고 하나만 함께 봅니다</Text>
          {isOwner ? (
            <Pressable
              onPress={() => router.push('/(employer)/workspace')}
              accessibilityRole="link"
              accessibilityLabel="팀 화면 열기"
              testID="collaborators-team-link"
              className="min-h-[44px] justify-center pl-3"
            >
              <Text className="text-sm font-sans-medium text-primary-600 dark:text-primary-400">
                팀 보기 ›
              </Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      {/* 조회 실패를 빈 목록으로 그리면 "아무도 공유받지 않았다"로 읽힌다 —
          이미 공유한 사람을 다시 추가하려 들게 만든다. 실패 시에는 추가 UI 도 닫는다(감사 A4). */}
      {error && collaborators.length === 0 ? (
        <ErrorState
          error={error}
          title={loadFailed('공유 관리 정보')}
          onRetry={() => {
            void refetch();
          }}
          alwaysAllowRetry
        />
      ) : isOwner ? (
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          className="flex-1"
        >
          <ScrollView
            className="flex-1"
            keyboardDismissMode="on-drag"
            keyboardShouldPersistTaps="handled"
          >
            <View className="py-2">
              <Text className="px-4 pb-2 text-xs font-medium text-content-secondary">
                협업자 추가
              </Text>
              <CollaboratorSearch
                jobPostingId={jobPostingId!}
                onAdd={async (userId) => {
                  await add(userId);
                }}
                isAdding={isAdding}
              />
            </View>

            <View className="py-2 mt-2">
              <Text className="px-4 pb-2 text-xs font-medium text-content-secondary">
                현재 협업자
              </Text>
              <CollaboratorList
                collaborators={collaborators}
                isLoading={isLoading}
                isOwner={true}
                currentUserId={currentUserId}
                onRemove={remove}
                onLeave={leaveSelf}
                onChangeRole={changeRole}
                actionDisabled={isRemoving || isChangingRole}
              />
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      ) : (
        <View className="flex-1">
          <CollaboratorList
            collaborators={collaborators}
            isLoading={isLoading}
            isOwner={false}
            currentUserId={currentUserId}
            onLeave={leaveSelf}
            actionDisabled={isRemoving}
          />
        </View>
      )}
    </SafeAreaView>
  );
}
