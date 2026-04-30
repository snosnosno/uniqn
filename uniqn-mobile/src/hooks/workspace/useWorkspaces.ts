/**
 * UNIQN Mobile - useWorkspaces / useWorkspaceMembers / useWorkspaceInvitations Hooks
 *
 * @description 워크스페이스 협업 (PR #2) — TanStack Query 기반.
 *              권한 단일 진실은 DB RLS. UI 분기는 데이터 형태로 구분.
 * @version 1.0.0
 */

import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys, cachingPolicies } from '@/lib/queryClient';
import { useAuthStore } from '@/stores/authStore';
import { workspaceService, workspaceInvitationService } from '@/services/workspace';
import type {
  Workspace,
  WorkspaceMemberWithUser,
  ReceivedWorkspaceInvitation,
  WorkspaceInvitation,
} from '@/types/workspace';

// ============================================================================
// useWorkspaces — 사용자가 속한 모든 워크스페이스
// ============================================================================

export interface UseWorkspacesResult {
  workspaces: Workspace[];
  ownedWorkspaces: Workspace[];
  memberWorkspaces: Workspace[];
  isLoading: boolean;
  error: unknown;
  refetch: () => void;
}

export function useWorkspaces(): UseWorkspacesResult {
  const { user } = useAuthStore();
  const userId = user?.uid;

  const query = useQuery({
    queryKey: userId
      ? queryKeys.workspaces.listForUser(userId)
      : [...queryKeys.workspaces.all, 'list', 'anonymous'],
    queryFn: () => workspaceService.listWorkspacesForUser(userId!),
    enabled: !!userId,
    staleTime: cachingPolicies.frequent,
  });

  const ownedWorkspaces = useMemo(
    () => (query.data ?? []).filter((w) => w.ownerId === userId),
    [query.data, userId]
  );
  const memberWorkspaces = useMemo(
    () => (query.data ?? []).filter((w) => w.ownerId !== userId),
    [query.data, userId]
  );

  return {
    workspaces: query.data ?? [],
    ownedWorkspaces,
    memberWorkspaces,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}

// ============================================================================
// useWorkspaceMembers — editor 멤버 목록 + 사용자 정보
// ============================================================================

export interface UseWorkspaceMembersResult {
  members: WorkspaceMemberWithUser[];
  isLoading: boolean;
  error: unknown;
  /** 현재 사용자가 owner 인지 (UI 분기용 — RLS 가 진짜 게이트) */
  isOwner: boolean;
}

export function useWorkspaceMembers(
  workspaceId: string | undefined,
  ownerId: string | undefined
): UseWorkspaceMembersResult {
  const { user } = useAuthStore();

  const query = useQuery({
    queryKey: workspaceId
      ? queryKeys.workspaces.members(workspaceId)
      : [...queryKeys.workspaces.all, 'members', 'none'],
    queryFn: () => workspaceService.listMembers(workspaceId!),
    enabled: !!workspaceId,
    staleTime: cachingPolicies.frequent,
  });

  return {
    members: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    isOwner: Boolean(ownerId && user?.uid && ownerId === user.uid),
  };
}

// ============================================================================
// useReceivedWorkspaceInvitations — 본인이 받은 pending 초대
// ============================================================================

export interface UseReceivedInvitationsResult {
  invitations: ReceivedWorkspaceInvitation[];
  isLoading: boolean;
  error: unknown;
  refetch: () => void;
}

export function useReceivedWorkspaceInvitations(): UseReceivedInvitationsResult {
  const { user } = useAuthStore();
  const userId = user?.uid;

  const query = useQuery({
    queryKey: userId
      ? queryKeys.workspaces.invitationsReceived(userId)
      : [...queryKeys.workspaces.all, 'invitations', 'received', 'anonymous'],
    queryFn: () => workspaceInvitationService.listPendingForUser(userId!),
    enabled: !!userId,
    staleTime: cachingPolicies.frequent,
  });

  return {
    invitations: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}

// ============================================================================
// useWorkspaceInvitationsSent — owner 가 보낸 초대 목록
// ============================================================================

export interface UseSentInvitationsResult {
  invitations: WorkspaceInvitation[];
  isLoading: boolean;
  error: unknown;
}

export function useWorkspaceInvitationsSent(
  workspaceId: string | undefined
): UseSentInvitationsResult {
  const query = useQuery({
    queryKey: workspaceId
      ? queryKeys.workspaces.invitationsSent(workspaceId)
      : [...queryKeys.workspaces.all, 'invitations', 'sent', 'none'],
    queryFn: () => workspaceInvitationService.listByWorkspace(workspaceId!),
    enabled: !!workspaceId,
    staleTime: cachingPolicies.frequent,
  });

  return {
    invitations: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
  };
}

// ============================================================================
// Mutations — invite / accept / reject / revoke / removeMember
// ============================================================================

export function useInviteWorkspaceMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { workspaceId: string; inviteeUserId: string }) =>
      workspaceInvitationService.invite(input),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.workspaces.invitationsSent(vars.workspaceId),
      });
    },
  });
}

export function useAcceptWorkspaceInvitation() {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  return useMutation({
    mutationFn: (invitationId: string) => workspaceInvitationService.accept({ invitationId }),
    onSuccess: () => {
      // 받은 초대 + 워크스페이스 목록 둘 다 갱신
      if (user?.uid) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.workspaces.invitationsReceived(user.uid),
        });
        queryClient.invalidateQueries({
          queryKey: queryKeys.workspaces.listForUser(user.uid),
        });
      }
    },
  });
}

export function useRejectWorkspaceInvitation() {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  return useMutation({
    mutationFn: (invitationId: string) => workspaceInvitationService.reject({ invitationId }),
    onSuccess: () => {
      if (user?.uid) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.workspaces.invitationsReceived(user.uid),
        });
      }
    },
  });
}

export function useRevokeWorkspaceInvitation(workspaceId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (invitationId: string) => workspaceInvitationService.revoke({ invitationId }),
    onSuccess: () => {
      if (workspaceId) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.workspaces.invitationsSent(workspaceId),
        });
      }
    },
  });
}

export function useRemoveWorkspaceMember(workspaceId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) =>
      workspaceService.removeMember({ workspaceId: workspaceId!, userId }),
    onSuccess: () => {
      if (workspaceId) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.workspaces.members(workspaceId),
        });
        queryClient.invalidateQueries({
          queryKey: queryKeys.workspaces.detail(workspaceId),
        });
      }
    },
  });
}

export function useCreateWorkspace() {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  return useMutation({
    mutationFn: (name: string) => workspaceService.createWorkspace({ name, ownerId: user!.uid }),
    onSuccess: () => {
      if (user?.uid) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.workspaces.listForUser(user.uid),
        });
      }
    },
  });
}

export function useUpdateWorkspaceName(workspaceId: string | undefined) {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  return useMutation({
    mutationFn: (name: string) =>
      workspaceService.updateWorkspaceName({ workspaceId: workspaceId!, name }),
    onSuccess: () => {
      if (workspaceId) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.workspaces.detail(workspaceId),
        });
      }
      if (user?.uid) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.workspaces.listForUser(user.uid),
        });
      }
    },
  });
}
