/**
 * UNIQN Mobile - Employer Layout
 * 구인자 전용 레이아웃 (employer 권한 필요)
 *
 * @description Phase 1A — 활성 워크스페이스에서 멤버십 회수 감지 시
 *              WorkspaceRevocationModal 마운트 + 5초 자동 로그아웃.
 */

import { useState } from 'react';
import { Stack, Redirect } from 'expo-router';
import { useAuthStore, useHasRole, selectProfile } from '@/stores/authStore';
import { useThemeStore } from '@/stores/themeStore';
import { Loading } from '@/components/ui';
import { WorkspaceRevocationModal } from '@/components/workspace';
import {
  useActiveWorkspace,
  useWorkspaceMembers,
  useWorkspaceRevocationGuard,
} from '@/hooks/workspace';
import { useQuery } from '@tanstack/react-query';
import { workspaceService } from '@/services/workspace';
import { queryKeys, cachingPolicies } from '@/lib/queryClient';
import { getLayoutColor } from '@/constants/colors';

function EmployerStack() {
  const isDark = useThemeStore((s) => s.isDarkMode);
  const userId = useAuthStore((s) => s.user?.uid);
  const { activeWorkspace } = useActiveWorkspace();

  // useWorkspaceMembers 의 isFetched/isError 직접 노출이 없어 동일 query 를 별도 조회
  // — TanStack Query 가 같은 키로 dedup 하므로 추가 fetch 비용 없음
  const membersQuery = useQuery({
    queryKey: activeWorkspace?.id
      ? queryKeys.workspaces.members(activeWorkspace.id)
      : [...queryKeys.workspaces.all, 'members', 'none'],
    queryFn: () => workspaceService.listMembers(activeWorkspace!.id),
    enabled: !!activeWorkspace?.id,
    staleTime: cachingPolicies.frequent,
  });

  const { members } = useWorkspaceMembers(activeWorkspace?.id, activeWorkspace?.ownerId);
  const isOwner = !!userId && activeWorkspace?.ownerId === userId;

  const [revoked, setRevoked] = useState(false);

  useWorkspaceRevocationGuard({
    activeWorkspaceId: activeWorkspace?.id,
    currentUserId: userId,
    members,
    isOwner,
    isFetched: membersQuery.isFetched,
    isError: membersQuery.isError,
    onRevoked: () => setRevoked(true),
  });

  return (
    <>
      <Stack
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
          statusBarStyle: 'auto',
          statusBarBackgroundColor: 'transparent',
          contentStyle: {
            backgroundColor: getLayoutColor(isDark, 'content'),
          },
        }}
      />
      <WorkspaceRevocationModal visible={revoked} workspaceName={activeWorkspace?.name} />
    </>
  );
}

export default function EmployerLayout() {
  const { isLoading, isAuthenticated } = useAuthStore();
  const profile = useAuthStore(selectProfile);
  const hasEmployerRole = useHasRole('employer');

  // 로딩 중 또는 인증됐지만 프로필 아직 로드 안 됨 (hydration 타이밍 방어)
  if (isLoading || (isAuthenticated && !profile)) {
    return <Loading variant="layout" />;
  }

  // 인증되지 않음 - 로그인 페이지로 리다이렉트
  if (!isAuthenticated) {
    return <Redirect href="/(auth)/login" />;
  }

  // 구인자 권한 없음 - 홈으로 리다이렉트
  if (!hasEmployerRole) {
    return <Redirect href="/(app)/(tabs)" />;
  }

  return <EmployerStack />;
}
