/**
 * EmployerMoreMenu — 내 공고 탭 헤더 ⋯ 메뉴 (구인자 IA S3)
 *
 * 자주 누르지 않는 진입점을 한곳에 모은다: 팀 · 받은 초대 · 여러 공고 묶어서 공유.
 *
 * 🔑 팀 진입점은 이 메뉴가 **유일한 경로**다. 그래서 "팀원 2명 이상일 때만" 을 숨김으로 구현하면
 *   혼자인 사장은 첫 팀원을 초대하러 갈 길을 잃는다. 대신 같은 자리의 이름만 바꾼다
 *   — 나 혼자면 `팀원 초대`, 2명 이상이면 `팀`. 도착지는 둘 다 팀 화면이다.
 *   멤버 목록(`useWorkspaceMembers`)은 소유자를 포함하지 않는다(팀 화면이 소유자를 따로 그린다).
 */
import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { ActionSheet, type ActionSheetOption } from '@/components/ui';
import { EllipsisHorizontalIcon } from '@/components/icons';
import { getIconColor } from '@/constants';
import {
  useActiveWorkspace,
  useReceivedWorkspaceInvitations,
  useWorkspaceMembers,
} from '@/hooks/workspace';
import { useThemeStore } from '@/stores/themeStore';

export interface EmployerMoreMenuProps {
  /** 넘기면 `여러 공고 묶어서 공유` 옵션을 보인다(공고가 2건 이상일 때 호출부가 넘긴다). */
  onBulkShare?: () => void;
}

export function EmployerMoreMenu({ onBulkShare }: EmployerMoreMenuProps) {
  const isDarkMode = useThemeStore((s) => s.isDarkMode);
  const { invitations: pendingInvitations } = useReceivedWorkspaceInvitations();
  const { activeWorkspace } = useActiveWorkspace();
  const {
    members,
    isLoading: membersLoading,
    error: membersError,
  } = useWorkspaceMembers(activeWorkspace?.id, activeWorkspace?.ownerId);
  const pendingCount = pendingInvitations.length;
  const [menuVisible, setMenuVisible] = useState(false);

  // 조회가 끝나 "나 혼자" 가 확인됐을 때만 이름을 바꾼다 — 로딩·실패 중에 깜빡이지 않게.
  const isSoloTeam = !membersLoading && !membersError && members.length === 0;

  const options = useMemo<ActionSheetOption[]>(
    () => [
      { label: isSoloTeam ? '팀원 초대' : '팀', value: 'workspace' },
      {
        label: pendingCount > 0 ? `받은 초대 (${pendingCount}건)` : '받은 초대',
        value: 'invitations',
      },
      ...(onBulkShare ? [{ label: '여러 공고 묶어서 공유', value: 'bulkShare' }] : []),
    ],
    [isSoloTeam, onBulkShare, pendingCount]
  );

  const handleSelect = useCallback(
    (value: string) => {
      setMenuVisible(false);
      if (value === 'workspace') {
        router.push('/(employer)/workspace');
      } else if (value === 'invitations') {
        router.push('/(employer)/workspace/invitations');
      } else if (value === 'bulkShare') {
        onBulkShare?.();
      }
    },
    [onBulkShare]
  );

  return (
    <>
      <Pressable
        onPress={() => setMenuVisible(true)}
        className="relative rounded-sm p-2"
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={`더보기${pendingCount > 0 ? ', 대기 중인 초대 있음' : ''}`}
      >
        <EllipsisHorizontalIcon size={24} color={getIconColor(isDarkMode, 'primary')} />
        {pendingCount > 0 ? (
          <View
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            className="absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full border border-white bg-error-500 dark:border-surface"
          />
        ) : null}
      </Pressable>
      <ActionSheet
        visible={menuVisible}
        onClose={() => setMenuVisible(false)}
        options={options}
        onSelect={handleSelect}
      />
    </>
  );
}
