/**
 * UNIQN Mobile - CollaboratorSearch
 *
 * @description 닉네임으로 협업자 검색 + 추가 UI
 *              상태별 분기: self / workspace_member / already_collaborator / addable
 * @version 1.0.0
 */

import React, { useCallback, useState } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { SearchIcon, UserIcon } from '@/components/icons';
import { Button } from '@/components/ui/Button';
import { useCollaboratorCandidates } from '@/hooks/job-posting/useJobPostingCollaborators';
import { COLLABORATOR_LIMITS } from '@/types/jobPostingCollaborator';
import type { CollaboratorSearchCandidate } from '@/types/jobPostingCollaborator';
import { triggerHaptic } from '@/utils/haptics';
import { resolveSearchErrorMessage } from '@/components/staffPicker/SearchErrorNotice';
import { SECONDARY_PALETTE } from '@/constants/colors';

export interface CollaboratorSearchProps {
  jobPostingId: string;
  onAdd: (userId: string) => Promise<void> | void;
  isAdding?: boolean;
}

function CandidateRow({
  candidate,
  onAdd,
  isAdding,
}: {
  candidate: CollaboratorSearchCandidate;
  onAdd: (userId: string) => void;
  isAdding: boolean;
}) {
  const disabled =
    candidate.status === 'self' ||
    candidate.status === 'workspace_member' ||
    candidate.status === 'already_collaborator';

  const hint = (() => {
    switch (candidate.status) {
      case 'self':
        return '본인은 추가할 수 없습니다';
      case 'workspace_member':
        return '이미 워크스페이스 멤버 — 모든 공고 접근 가능';
      case 'already_collaborator':
        return '이미 협업자';
      default:
        return null;
    }
  })();

  return (
    <Pressable
      onPress={() => !disabled && onAdd(candidate.userId)}
      disabled={disabled || isAdding}
      className={`flex-row items-center gap-3 py-3 px-4 ${
        disabled ? 'opacity-50' : 'active:bg-gray-100 dark:active:bg-surface-elevated'
      }`}
    >
      <View className="w-10 h-10 rounded-full bg-gray-100 dark:bg-surface-elevated items-center justify-center overflow-hidden">
        {candidate.photoUrl ? (
          <Image
            source={{ uri: candidate.photoUrl }}
            style={{ width: 40, height: 40 }}
            contentFit="cover"
          />
        ) : (
          <UserIcon size={20} color="#9CA3AF" />
        )}
      </View>
      <View className="flex-1 min-w-0">
        <Text className="text-base font-medium text-content-primary" numberOfLines={1}>
          {candidate.displayName ?? '이름 없음'}
        </Text>
        {hint ? <Text className="text-xs text-warning-600 mt-0.5">{hint}</Text> : null}
      </View>
      {!disabled ? <Text className="text-sm text-primary-500 font-medium">추가</Text> : null}
    </Pressable>
  );
}

export function CollaboratorSearch({ jobPostingId, onAdd, isAdding }: CollaboratorSearchProps) {
  const [nicknameInput, setNicknameInput] = useState('');
  // 명시 제출(검색 버튼·엔터)로만 갱신한다. 타이핑마다 발화하면 서버 rate limit(분당 20회)을
  // 정상 사용자가 소진하므로, 스태프 검색(NicknameSearchField)과 동일한 수동 트리거로 통일한다.
  const [submittedQuery, setSubmittedQuery] = useState('');

  const { candidates, isLoading, error } = useCollaboratorCandidates(jobPostingId, submittedQuery);

  const hasQuery = submittedQuery.trim().length >= COLLABORATOR_LIMITS.SEARCH_MIN_CHARS;
  const canSearch = nicknameInput.trim().length >= COLLABORATOR_LIMITS.SEARCH_MIN_CHARS;

  const handleSearch = useCallback(() => {
    const next = nicknameInput.trim();
    if (next.length < COLLABORATOR_LIMITS.SEARCH_MIN_CHARS) return;
    setSubmittedQuery(next);
  }, [nicknameInput]);

  // rate limit 등 서버 예외를 빈 결과와 구분해 표시한다(빈 결과 문구는 "미가입자"로 오도한다)
  const errorMessage = resolveSearchErrorMessage(error);

  return (
    <View>
      <View className="flex-row items-center gap-2 px-4 py-2 bg-surface-page border-b border-divider">
        <SearchIcon size={18} color="#9CA3AF" />
        <TextInput
          value={nicknameInput}
          onChangeText={setNicknameInput}
          placeholder="닉네임으로 검색 (2자 이상)"
          placeholderTextColor="#9CA3AF"
          autoCapitalize="none"
          autoCorrect={false}
          onSubmitEditing={handleSearch}
          returnKeyType="search"
          className="flex-1 text-base text-content-primary"
        />
        <Button
          variant="secondary"
          size="sm"
          onPress={handleSearch}
          disabled={!canSearch}
          loading={isLoading}
          icon={<SearchIcon size={16} color={SECONDARY_PALETTE[500]} />}
          accessibilityLabel="닉네임으로 검색"
        >
          검색
        </Button>
      </View>

      {errorMessage ? (
        <View className="py-6 items-center px-4">
          <Text className="text-sm text-center text-error-600 dark:text-error-400">
            {errorMessage}
          </Text>
        </View>
      ) : !hasQuery ? (
        <View className="py-6 items-center">
          <Text className="text-sm text-content-secondary">
            닉네임 2자 이상 입력 후 검색을 눌러주세요
          </Text>
        </View>
      ) : isLoading ? (
        <View className="py-6 items-center">
          <ActivityIndicator />
        </View>
      ) : candidates.length === 0 ? (
        <View className="py-6 items-center">
          <Text className="text-sm text-content-secondary">
            UNIQN 에 가입한 사용자만 추가할 수 있어요
          </Text>
        </View>
      ) : (
        candidates.map((c) => (
          <CandidateRow
            key={c.userId}
            candidate={c}
            onAdd={async (uid) => {
              void triggerHaptic('light');
              await onAdd(uid);
              // 추가 후 입력·제출 질의 모두 초기화(결과 목록도 함께 닫힌다)
              setNicknameInput('');
              setSubmittedQuery('');
            }}
            isAdding={!!isAdding}
          />
        ))
      )}
    </View>
  );
}
