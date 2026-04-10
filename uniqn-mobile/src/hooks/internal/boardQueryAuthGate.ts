import { getCurrentAuthUser } from './appInitializeAuthSession';

type BootstrapSource = 'none' | 'cache' | 'server';

interface BoardQueryAuthGateInput {
  userId: string | null | undefined;
  bootstrapSource: BootstrapSource;
  needsServerReconcile: boolean;
  liveUserId?: string | null;
}

export function canRunBoardQueryWithAuth({
  userId,
  bootstrapSource,
  needsServerReconcile,
  liveUserId,
}: BoardQueryAuthGateInput): boolean {
  if (!userId) {
    return false;
  }

  const isWaitingForRestoredFirebaseSession =
    needsServerReconcile && bootstrapSource === 'cache' && liveUserId !== userId;

  return !isWaitingForRestoredFirebaseSession;
}

export function isBoardQueryAuthReady(input: Omit<BoardQueryAuthGateInput, 'liveUserId'>): boolean {
  return canRunBoardQueryWithAuth({
    ...input,
    liveUserId: getCurrentAuthUser()?.uid ?? null,
  });
}
