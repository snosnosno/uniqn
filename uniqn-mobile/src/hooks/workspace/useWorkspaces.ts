/**
 * UNIQN Mobile - useWorkspaces / useWorkspaceMembers / useWorkspaceInvitations Hooks
 *
 * @description 워크스페이스 협업 (PR #2) — TanStack Query 기반.
 *              권한 단일 진실은 DB RLS. UI 분기는 데이터 형태로 구분.
 * @version 1.0.0
 */

import { useEffect, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys, cachingPolicies } from '@/lib/queryClient';
import { useAuthStore } from '@/stores/authStore';
import { workspaceService, workspaceInvitationService } from '@/services/workspace';
import { createRealtimeSubscription } from '@/utils/supabase';
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
  /** 최초 로딩 이후의 재조회(invalidate 후 refetch 등)를 포함한 진행 중 상태. */
  isFetching: boolean;
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
    isFetching: query.isFetching,
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
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: workspaceId
      ? queryKeys.workspaces.members(workspaceId)
      : [...queryKeys.workspaces.all, 'members', 'none'],
    queryFn: () => workspaceService.listMembers(workspaceId!),
    enabled: !!workspaceId,
    staleTime: cachingPolicies.frequent,
  });

  // Realtime 구독 — workspace_members row 변경 시 query invalidate.
  // Phase 1A 의 RevocationGuard 가 같은 채널을 활용 (createRealtimeSubscription 가
  // ref-counting + fan-out 으로 단일 채널만 유지).
  useEffect(() => {
    if (!workspaceId) return undefined;
    return createRealtimeSubscription('workspace_members', `workspace_id=eq.${workspaceId}`, () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.workspaces.members(workspaceId),
      });
      // listForUser 도 영향 — 새 멤버가 본인 워크스페이스 목록을 갱신해야 할 수 있음
      if (user?.uid) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.workspaces.listForUser(user.uid),
        });
      }
    });
  }, [workspaceId, queryClient, user?.uid]);

  return {
    members: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    isOwner: Boolean(ownerId && user?.uid && ownerId === user.uid),
  };
}

// ============================================================================
// useWorkspaceOwnerProfile — 워크스페이스 owner 의 public profile
// editor 도 SECURITY DEFINER RPC 경유로 owner 정보 조회 가능 (RLS 안전 우회).
// ============================================================================

export interface UseWorkspaceOwnerProfileResult {
  ownerProfile: { id: string; displayName: string | null; photoUrl: string | null } | null;
  isLoading: boolean;
  error: unknown;
}

export function useWorkspaceOwnerProfile(
  workspaceId: string | undefined
): UseWorkspaceOwnerProfileResult {
  const query = useQuery({
    queryKey: workspaceId
      ? queryKeys.workspaces.ownerProfile(workspaceId)
      : [...queryKeys.workspaces.all, 'owner', 'none'],
    queryFn: () => workspaceService.getOwnerProfile(workspaceId!),
    enabled: !!workspaceId,
    staleTime: cachingPolicies.frequent,
  });

  return {
    ownerProfile: query.data ?? null,
    isLoading: query.isLoading,
    error: query.error,
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
    onSuccess: (result) => {
      // 받은 초대 + 워크스페이스 목록 + (방금 합류한) 워크스페이스 멤버 목록 갱신
      if (user?.uid) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.workspaces.invitationsReceived(user.uid),
        });
        queryClient.invalidateQueries({
          queryKey: queryKeys.workspaces.listForUser(user.uid),
        });
      }
      if (result.workspaceId) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.workspaces.members(result.workspaceId),
        });
        queryClient.invalidateQueries({
          queryKey: queryKeys.workspaces.detail(result.workspaceId),
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
    mutationFn: (name: string) => workspaceService.createWorkspace({ name }),
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

// ============================================================================
// useArchivedWorkspaces — 보관함 (내가 owner 인 아카이브된 워크스페이스)
// ============================================================================

export interface UseArchivedWorkspacesResult {
  archived: Workspace[];
  isLoading: boolean;
  error: unknown;
  refetch: () => void;
}

export function useArchivedWorkspaces(): UseArchivedWorkspacesResult {
  const { user } = useAuthStore();
  const userId = user?.uid;

  const query = useQuery({
    queryKey: userId
      ? queryKeys.workspaces.archivedForUser(userId)
      : [...queryKeys.workspaces.all, 'archived', 'anonymous'],
    queryFn: () => workspaceService.listArchivedWorkspaces(userId!),
    enabled: !!userId,
    staleTime: cachingPolicies.frequent,
  });

  return {
    archived: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}

// ============================================================================
// useArchiveWorkspace / useRestoreWorkspace
// ============================================================================

function useInvalidateWorkspaceLists() {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  return () => {
    if (!user?.uid) return;
    queryClient.invalidateQueries({ queryKey: queryKeys.workspaces.listForUser(user.uid) });
    queryClient.invalidateQueries({ queryKey: queryKeys.workspaces.archivedForUser(user.uid) });
  };
}

export function useArchiveWorkspace() {
  const invalidate = useInvalidateWorkspaceLists();
  return useMutation({
    mutationFn: (workspaceId: string) => workspaceService.archiveWorkspace({ workspaceId }),
    onSuccess: invalidate,
  });
}

export function useRestoreWorkspace() {
  const invalidate = useInvalidateWorkspaceLists();
  return useMutation({
    mutationFn: (workspaceId: string) => workspaceService.restoreWorkspace({ workspaceId }),
    onSuccess: invalidate,
  });
}
