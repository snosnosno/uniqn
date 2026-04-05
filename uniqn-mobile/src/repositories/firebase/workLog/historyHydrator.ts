import { doc, serverTimestamp, type Transaction } from 'firebase/firestore';
import type { WorkLog } from '@/types';
import {
  fetchAuthoritativeLogsByWorkLogIds,
  getTimeModificationCollection,
} from './authoritativeLogReader';
import {
  buildLegacyTimeModification,
  mergeTimeModificationHistory,
  type TimeModificationWriteInput,
} from './legacyBridgeMerger';

function shouldFetchAuthoritativeLogs(workLog: WorkLog): boolean {
  return (
    workLog.hasTimeModificationLogs === true ||
    (Array.isArray(workLog.modificationHistory) && workLog.modificationHistory.length > 0)
  );
}

export { buildLegacyTimeModification, type TimeModificationWriteInput };

export function writeTimeModificationLog(
  transaction: Transaction,
  workLogId: string,
  modification: TimeModificationWriteInput
): void {
  const logRef = doc(getTimeModificationCollection(workLogId));

  transaction.set(logRef, {
    workLogId,
    modifiedAt: serverTimestamp(),
    modifiedBy: modification.modifiedBy,
    reason: modification.reason,
    previousStartTime: modification.previousStartTime ?? null,
    previousEndTime: modification.previousEndTime ?? null,
    newStartTime: modification.newStartTime ?? null,
    newEndTime: modification.newEndTime ?? null,
  });
}

export async function hydrateWorkLogModificationHistory(
  workLog: WorkLog,
  options: { force?: boolean } = {}
): Promise<WorkLog> {
  if (!workLog.id || (!options.force && !shouldFetchAuthoritativeLogs(workLog))) {
    return workLog;
  }

  const logsByWorkLogId = await fetchAuthoritativeLogsByWorkLogIds([workLog.id]);
  const authoritativeHistory = logsByWorkLogId.get(workLog.id) ?? [];
  const legacyHistory = workLog.modificationHistory ?? [];

  if (authoritativeHistory.length === 0 && legacyHistory.length === 0) {
    return workLog;
  }

  return {
    ...workLog,
    modificationHistory: mergeTimeModificationHistory(authoritativeHistory, legacyHistory),
  };
}

export async function hydrateWorkLogsModificationHistory(workLogs: WorkLog[]): Promise<WorkLog[]> {
  const candidateWorkLogIds = workLogs
    // Bridge release: only rows that already expose legacy history need the
    // authoritative merge, so untouched lists avoid an extra collectionGroup read.
    .filter(
      (workLog) =>
        typeof workLog.id === 'string' &&
        workLog.id.length > 0 &&
        shouldFetchAuthoritativeLogs(workLog)
    )
    .map((workLog) => workLog.id);

  if (candidateWorkLogIds.length === 0) {
    return workLogs;
  }

  const logsByWorkLogId = await fetchAuthoritativeLogsByWorkLogIds(candidateWorkLogIds);

  return workLogs.map((workLog) => {
    if (!workLog.id) {
      return workLog;
    }

    const authoritativeHistory = logsByWorkLogId.get(workLog.id) ?? [];
    if (authoritativeHistory.length === 0) {
      return workLog;
    }

    return {
      ...workLog,
      modificationHistory: mergeTimeModificationHistory(
        authoritativeHistory,
        workLog.modificationHistory ?? []
      ),
    };
  });
}
