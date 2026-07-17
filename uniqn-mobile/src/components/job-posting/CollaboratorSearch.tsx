/**
 * UNIQN Mobile - CollaboratorSearch
 *
 * @description 닉네임으로 협업자 검색 + 추가 UI
 *              상태별 분기: self / workspace_member / already_collaborator / addable
 * @version 1.0.0
 */

import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { SearchIcon, UserIcon } from '@/components/icons';
import { useCollaboratorCandidates } from '@/hooks/job-posting/useJobPostingCollaborators';
import { COLLABORATOR_LIMITS } from '@/types/jobPostingCollaborator';
import type { CollaboratorSearchCandidate } from '@/types/jobPostingCollaborator';
import { triggerHaptic } from '@/utils/haptics';

export interface CollaboratorSearchProps {
  jobPostingId: string;
  onAdd: (userId: string) => Promise<void> | void;
  isAdding?: boolean;
}

function useDebouncedValue<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return debounced;
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
        <Text className="text-xs text-content-secondary" numberOfLines={1}>
          {candidate.email}
        </Text>
        {hint ? <Text className="text-xs text-warning-600 mt-0.5">{hint}</Text> : null}
      </View>
      {!disabled ? <Text className="text-sm text-primary-500 font-medium">추가</Text> : null}
    </Pressable>
  );
}

export function CollaboratorSearch({ jobPostingId, onAdd, isAdding }: CollaboratorSearchProps) {
  const [nicknameInput, setNicknameInput] = useState('');
  const debounced = useDebouncedValue(nicknameInput, COLLABORATOR_LIMITS.SEARCH_DEBOUNCE_MS);

  const { candidates, isLoading } = useCollaboratorCandidates(jobPostingId, debounced);

  const hasQuery = debounced.trim().length >= COLLABORATOR_LIMITS.SEARCH_MIN_CHARS;

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
          className="flex-1 text-base text-content-primary"
        />
      </View>

      {!hasQuery ? (
        <View className="py-6 items-center">
          <Text className="text-sm text-content-secondary">
            닉네임 2자 이상 입력하면 검색됩니다
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
              setNicknameInput(''); // 추가 후 입력 초기화
            }}
            isAdding={!!isAdding}
          />
        ))
      )}
    </View>
  );
}
