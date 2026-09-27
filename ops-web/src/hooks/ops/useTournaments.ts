/**
 * ops 대회 목록·생성·복제·보관·공고 연결 훅 — 모바일 `useOpsTournaments`·`useOpsMutations` 대응.
 * 읽기는 Repository 사본 직접(읽기 전용 예외), 쓰기는 Service 사본 경유(경계 zod 검증).
 */
import { useEffect, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { DEFAULT_BLIND_LEVELS } from '@/core/domains/ops/defaultBlindStructure';
import { opsStaffRepository, opsTournamentRepository } from '@/core/repositories/ops';
import type { CreateOpsTournamentInput } from '@/core/repositories/ops';
import * as opsBlindLevelService from '@/core/services/ops/opsBlindLevelService';
import * as opsTournamentService from '@/core/services/ops/opsTournamentService';
import type { OpsTournament } from '@/core/types/ops';
import { useAuth } from '@/auth/authContext';
import { toUserMessage } from '@/lib/errorMessage';
import { logger } from '@/lib/logger';
import { requireOnline } from '@/lib/online';
import { supabase } from '@/lib/supabase';
import { trackOpsFunnel } from '@/repositories/analyticsRepository';
import { fetchManagedPostings } from '@/repositories/postingRepository';
import { useActorId } from '../useActorId';
import { opsKeys } from './keys';

/** 모바일과 같게 실패를 로그로 남기고 한글 문구 토스트. */
function reportError(message: string, error: unknown): void {
  logger.error(message, { error: String(error) });
  toast.error(toUserMessage(error));
}

export function useOpsTournaments() {
  return useQuery({
    queryKey: opsKeys.tournaments(),
    queryFn: () => opsTournamentRepository.listForUser(),
    staleTime: 30_000,
  });
}

/** 내가 관리하는 공고(연결 피커). */
export function useManagedPostings() {
  const auth = useAuth();
  const userId = auth.status === 'signedIn' ? auth.session.user.id : null;
  return useQuery({
    queryKey: opsKeys.managedPostings(),
    queryFn: () => fetchManagedPostings(supabase, userId as string),
    enabled: !!userId,
    staleTime: 60_000,
  });
}

/** 허브(대회 목록) 진입 계측 — 마운트당 1회, 공고 피커 모드는 제외(모바일 useOpsHubEnteredOnce). */
export function useOpsHubEnteredOnce(enabled: boolean): void {
  const fired = useRef(false);
  useEffect(() => {
    if (enabled && !fired.current) {
      fired.current = true;
      trackOpsFunnel('ops_hub_entered', { surface: 'web' });
    }
  }, [enabled]);
}

export function useCreateOpsTournament() {
  const qc = useQueryClient();
  const actorId = useActorId();
  return useMutation({
    mutationFn: async (input: CreateOpsTournamentInput) => {
      requireOnline('ops.createTournament');
      return opsTournamentService.createTournament(input, actorId);
    },
    onSuccess: (result, input) => {
      // 모바일과 같게 기본 블라인드 구조를 심는다 — **기다리지 않는다**(TanStack 은 async onSuccess 를
      // 기다려 isPending·화면 이동을 붙잡는다, 리뷰 W3). 실패해도 대회는 만들어졌으니 안내만.
      void opsBlindLevelService
        .setLevels(result.tournamentId, actorId, DEFAULT_BLIND_LEVELS)
        .then(() => qc.invalidateQueries({ queryKey: opsKeys.blindLevels(result.tournamentId) }))
        .catch((error: unknown) => {
          logger.error('기본 블라인드 시드 실패(수동 설정 가능)', { error: String(error) });
          toast.error('기본 블라인드 설정에 실패했어요. 블라인드 탭에서 직접 설정할 수 있어요.');
        });
      void qc.invalidateQueries({ queryKey: opsKeys.tournaments() });
      if (input.jobPostingId) {
        void qc.invalidateQueries({ queryKey: opsKeys.forPosting(input.jobPostingId) });
      }
      trackOpsFunnel('ops_tournament_created', { method: 'create', surface: 'web' });
      toast.success('대회를 만들었습니다');
    },
    onError: (error) => reportError('ops 대회 생성 실패', error),
  });
}

export function useDuplicateTournament() {
  const qc = useQueryClient();
  const actorId = useActorId();
  return useMutation({
    mutationFn: (input: { sourceTournamentId: string; name?: string; eventDate?: string }) => {
      requireOnline('ops.duplicateTournament');
      return opsTournamentService.duplicateTournament(input.sourceTournamentId, actorId, {
        name: input.name,
        eventDate: input.eventDate,
      });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: opsKeys.tournaments() });
      trackOpsFunnel('ops_tournament_created', { method: 'duplicate', surface: 'web' });
      toast.success('지난 대회 설정으로 새 대회를 만들었어요');
    },
    onError: (error) => reportError('ops 대회 복제 실패', error),
  });
}

/**
 * 보관/복원 — 낙관적으로 목록에서 즉시 옮긴다(DESIGN.md: 상태 변경 0ms 반영). 실패하면 되돌린다.
 * 🔑 hard DELETE 는 ops_events append-only 트리거와 충돌해 불가능 — 보관이 "치우기"의 유일한 경로.
 */
export function useSetTournamentArchived() {
  const qc = useQueryClient();
  const actorId = useActorId();
  return useMutation({
    mutationFn: ({ id, archived }: { id: string; archived: boolean }) => {
      requireOnline('ops.setTournamentArchived');
      return opsTournamentService.setArchived(id, actorId, archived);
    },
    onMutate: async ({ id, archived }) => {
      await qc.cancelQueries({ queryKey: opsKeys.tournaments() });
      const previous = qc.getQueryData<OpsTournament[]>(opsKeys.tournaments());
      qc.setQueryData<OpsTournament[]>(opsKeys.tournaments(), (list) =>
        list?.map((t) =>
          t.id === id ? { ...t, archivedAt: archived ? new Date().toISOString() : null } : t
        )
      );
      return { previous };
    },
    onError: (error, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(opsKeys.tournaments(), ctx.previous);
      reportError('ops 대회 보관 설정 실패', error);
    },
    onSuccess: (result) => {
      if (!result.changed) {
        toast.success(result.archivedAt ? '이미 보관된 대회예요' : '이미 활성 대회예요');
        return;
      }
      toast.success(result.archivedAt ? '대회를 보관했어요' : '대회를 복원했어요');
    },
    onSettled: (_data, _err, { id }) => {
      void qc.invalidateQueries({ queryKey: opsKeys.tournaments() });
      void qc.invalidateQueries({ queryKey: opsKeys.tournamentDetail(id) });
      void qc.invalidateQueries({ queryKey: opsKeys.events(id) });
    },
  });
}

/** 대회↔공고 연결/변경/해제(null). 서버가 owner 만 허용한다. */
export function useSetTournamentPosting(tournamentId: string) {
  const qc = useQueryClient();
  const actorId = useActorId();
  return useMutation({
    mutationFn: (jobPostingId: string | null) => {
      requireOnline('ops.setTournamentPosting');
      return opsStaffRepository.setTournamentPosting({ tournamentId, actorId, jobPostingId });
    },
    onSuccess: (_data, jobPostingId) => {
      const previous = qc.getQueryData<OpsTournament>(opsKeys.tournamentDetail(tournamentId));
      void qc.invalidateQueries({ queryKey: opsKeys.staff(tournamentId) });
      void qc.invalidateQueries({ queryKey: opsKeys.tournamentDetail(tournamentId) });
      void qc.invalidateQueries({ queryKey: opsKeys.tournaments() });
      if (previous?.jobPostingId) {
        void qc.invalidateQueries({ queryKey: opsKeys.forPosting(previous.jobPostingId) });
      }
      if (jobPostingId) void qc.invalidateQueries({ queryKey: opsKeys.forPosting(jobPostingId) });
      toast.success('공고 연결을 변경했습니다'); // 모바일과 같은 문구
    },
    onError: (error) => reportError('ops 대회-공고 연결 실패', error),
  });
}
