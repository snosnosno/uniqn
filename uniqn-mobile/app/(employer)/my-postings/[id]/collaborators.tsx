/**
 * UNIQN Mobile - 공고별 협업자 관리 라우트
 *
 * @description owner: 검색 + 추가 + 제거 / collaborator 본인: 자기 나가기만
 *              권한 강제는 RLS — UI 분기는 데이터 기반 (workspace owner 인지)
 * @version 1.0.0
 */

import React from 'react';
import { View, Text, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StackHeader } from '@/components/headers';
import { useAuthStore } from '@/stores/authStore';
import { useJobDetail } from '@/hooks/useJobDetail';
import { useJobPostingCollaborators } from '@/hooks/job-posting/useJobPostingCollaborators';
import { CollaboratorList } from '@/components/job-posting/CollaboratorList';
import { CollaboratorSearch } from '@/components/job-posting/CollaboratorSearch';

export default function CollaboratorsRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const jobPostingId = id;

  const { user } = useAuthStore();
  const currentUserId = user?.uid;

  const { job: jobPosting } = useJobDetail(jobPostingId);
  const { collaborators, isLoading, add, isAdding, remove, isRemoving, leaveSelf } =
    useJobPostingCollaborators(jobPostingId);

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
      </View>

      {isOwner ? (
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
                actionDisabled={isRemoving}
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
