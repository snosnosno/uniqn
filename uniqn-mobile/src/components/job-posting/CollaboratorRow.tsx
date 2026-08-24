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
import { UserIcon } from '@/components/icons';
import { confirmAction } from '@/utils/confirmAction';
import { formatRelative } from '@/utils/formatters/date';
import { triggerHaptic } from '@/utils/haptics';
import {
  JOB_POSTING_COLLABORATOR_ROLE_LABELS,
  type JobPostingCollaboratorRole,
  type JobPostingCollaboratorWithUser,
} from '@/types/jobPostingCollaborator';

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
  /** owner 가 권한을 바꿀 때 (S3-4). 미주입 시 배지는 표시 전용이 된다. */
  onChangeRole?: (userId: string, role: JobPostingCollaboratorRole) => void;
  disabled?: boolean;
}

export const CollaboratorRow = React.memo(function CollaboratorRow({
  collaborator,
  isOwner,
  currentUserId,
  onRemove,
  onLeave,
  onChangeRole,
  disabled,
}: CollaboratorRowProps) {
  const isSelf = collaborator.userId === currentUserId;
  const addedAtLabel = collaborator.addedAt ? formatRelative(collaborator.addedAt) : '';
  const isViewer = collaborator.role === 'viewer';
  const roleLabel = JOB_POSTING_COLLABORATOR_ROLE_LABELS[collaborator.role];

  // 2단뿐이라 시트를 띄우지 않고 토글한다. 되돌리기 쉬운 변경이므로 확인 모달도 두지 않는다 —
  // 다만 '관리'로 **올리는** 쪽은 권한이 넓어지는 방향이라 한 번 묻는다.
  const handleToggleRole = () => {
    if (!onChangeRole) return;
    const who = collaborator.displayName ?? '이 동료';
    // 🔑 양방향 모두 확인을 거친다. 올리는 쪽은 권한이 넓어져서, 내리는 쪽은 상대가 하던
    //    일을 즉시 못 하게 돼서다 — 작은 배지를 잘못 눌러 조용히 강등되면 상대는
    //    "왜 갑자기 안 되지" 를 혼자 겪는다.
    // ⚠️ `who` 는 사람 이름이라 받침을 알 수 없다 — `${who}가` 처럼 조사를 박으면
    //    "박지훈가" 가 된다. 조사 헬퍼가 생기기 전까지는 받침과 무관한 '에게/에게는'
    //    구조를 쓴다(문구 감사 2026-08-24 P2-1).
    if (isViewer) {
      confirmAction({
        title: '관리 권한을 줄까요?',
        message: `${who}에게 공고 수정·지원자 확정·정산 권한이 생겨요.`,
        confirmText: '관리 권한 주기',
        onConfirm: () => onChangeRole(collaborator.userId, 'manager'),
      });
      return;
    }
    confirmAction({
      title: '보기 전용으로 바꿀까요?',
      message: `${who}에게는 공고 열람만 남아요. 수정·지원자 확정·정산은 할 수 없어요.`,
      confirmText: '보기 전용으로',
      onConfirm: () => onChangeRole(collaborator.userId, 'viewer'),
    });
  };

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
        <View className="flex-row items-center gap-2">
          <Text className="text-base font-medium text-content-primary shrink" numberOfLines={1}>
            {collaborator.displayName ?? '이름 없음'}
          </Text>
          {/*
            권한 배지 (S3-4). owner 는 눌러서 바꿀 수 있고, 아니면 표시만 한다.
            🔒 화면 분기는 헛수고를 줄이는 용도일 뿐이다 — 실제 게이트는 서버 RLS 와
               쓰기 RPC 14종이며, viewer 의 쓰기는 화면과 무관하게 서버에서 막힌다.
          */}
          <Pressable
            onPress={isOwner && onChangeRole ? handleToggleRole : undefined}
            disabled={!isOwner || !onChangeRole || disabled}
            accessibilityRole={isOwner && onChangeRole ? 'button' : 'text'}
            accessibilityLabel={
              isOwner && onChangeRole
                ? `${collaborator.displayName ?? '이름 없음'} 권한 ${roleLabel}, 눌러서 변경`
                : `권한 ${roleLabel}`
            }
            // 배지 자체는 작다 — hitSlop 으로 실제 터치 타깃을 44px 권장치까지 넓힌다.
            hitSlop={12}
            className={`rounded px-1.5 py-0.5 ${
              isViewer
                ? 'bg-secondary-100 dark:bg-surface-overlay'
                : 'bg-primary-50 dark:bg-primary-900/30'
            }`}
          >
            <Text
              className={`text-xs font-sans-medium ${
                isViewer
                  ? 'text-content-secondary dark:text-secondary-400'
                  : 'text-primary-600 dark:text-primary-400'
              }`}
            >
              {roleLabel}
            </Text>
          </Pressable>
        </View>
        <Text className="text-xs text-content-secondary" numberOfLines={1}>
          {collaborator.email ?? ''}
          {addedAtLabel ? `  ·  ${addedAtLabel}` : ''}
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
});
