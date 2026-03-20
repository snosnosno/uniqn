import {
  Timestamp,
  collection,
  collectionGroup,
  doc,
  getDocs,
  query,
  serverTimestamp,
  where,
  type Transaction,
} from 'firebase/firestore';
import { COLLECTIONS } from '@/constants';
import { getFirebaseDb } from '@/lib/firebase';
import type { WorkLog, WorkTimeModification } from '@/types';
import { toDateValue, type DateInput } from '@/utils/date';
import { logger } from '@/utils/logger';

const TIME_MODIFICATION_LOGS_COLLECTION = 'timeModificationLogs';
const COLLECTION_GROUP_BATCH_SIZE = 10;

type TimeModificationWriteInput = Omit<WorkTimeModification, 'modifiedAt'>;

function normalizeTimestampLike(value: unknown): DateInput {
  if (
    value &&
    typeof value === 'object' &&
    ('_methodName' in value || '_serverTimestamp' in value)
  ) {
    return Timestamp.now();
  }

  return value as DateInput;
}

function normalizeTimeModificationRecord(data: unknown): WorkTimeModification | null {
  if (!data || typeof data !== 'object') {
    return null;
  }

  const record = data as Record<string, unknown>;
  if (typeof record.modifiedBy !== 'string' || typeof record.reason !== 'string') {
    return null;
  }

  return {
    modifiedAt: normalizeTimestampLike(record.modifiedAt),
    modifiedBy: record.modifiedBy,
    reason: record.reason,
    previousStartTime: normalizeTimestampLike(record.previousStartTime),
    previousEndTime: normalizeTimestampLike(record.previousEndTime),
    newStartTime: normalizeTimestampLike(record.newStartTime),
    newEndTime: normalizeTimestampLike(record.newEndTime),
  };
}

function getTimeValueKey(value: unknown): string {
  const timestampValue = toDateValue(value as DateInput);
  if (timestampValue !== null) {
    return String(timestampValue);
  }

  if (value === null || value === undefined) {
    return 'null';
  }

  return JSON.stringify(value);
}

function buildModificationSignature(modification: WorkTimeModification): string {
  return [
    modification.modifiedBy,
    modification.reason,
    getTimeValueKey(modification.previousStartTime),
    getTimeValueKey(modification.previousEndTime),
    getTimeValueKey(modification.newStartTime),
    getTimeValueKey(modification.newEndTime),
  ].join('|');
}

function sortModificationHistory(history: WorkTimeModification[]): WorkTimeModification[] {
  return [...history].sort((left, right) => {
    const rightValue = toDateValue(right.modifiedAt) ?? 0;
    const leftValue = toDateValue(left.modifiedAt) ?? 0;
    return rightValue - leftValue;
  });
}

function shouldFetchAuthoritativeLogs(workLog: WorkLog): boolean {
  return Array.isArray(workLog.modificationHistory) && workLog.modificationHistory.length > 0;
}

function chunkWorkLogIds(workLogIds: string[]): string[][] {
  const chunks: string[][] = [];

  for (let index = 0; index < workLogIds.length; index += COLLECTION_GROUP_BATCH_SIZE) {
    chunks.push(workLogIds.slice(index, index + COLLECTION_GROUP_BATCH_SIZE));
  }

  return chunks;
}

function getTimeModificationCollection(workLogId: string) {
  return collection(
    doc(getFirebaseDb(), COLLECTIONS.WORK_LOGS, workLogId),
    TIME_MODIFICATION_LOGS_COLLECTION
  );
}

async function fetchAuthoritativeLogsByWorkLogIds(workLogIds: string[]) {
  const logsByWorkLogId = new Map<string, WorkTimeModification[]>();

  if (workLogIds.length === 0) {
    return logsByWorkLogId;
  }

  try {
    for (const workLogIdChunk of chunkWorkLogIds(workLogIds)) {
      const logsQuery = query(
        collectionGroup(getFirebaseDb(), TIME_MODIFICATION_LOGS_COLLECTION),
        where('workLogId', 'in', workLogIdChunk)
      );

      const snapshot = await getDocs(logsQuery);

      for (const logDoc of snapshot.docs) {
        const rawLog = logDoc.data() as Record<string, unknown>;
        const workLogId = typeof rawLog.workLogId === 'string' ? rawLog.workLogId : null;
        const logEntry = normalizeTimeModificationRecord(rawLog);

        if (!workLogId || !logEntry) {
          continue;
        }

        const existingLogs = logsByWorkLogId.get(workLogId) ?? [];
        existingLogs.push(logEntry);
        logsByWorkLogId.set(workLogId, existingLogs);
      }
    }
  } catch (error) {
    logger.warn('Failed to load authoritative time modification logs, using legacy history only', {
      component: 'timeModificationLogs',
      workLogIds,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  return logsByWorkLogId;
}

export function mergeTimeModificationHistory(
  authoritativeHistory: WorkTimeModification[],
  legacyHistory: WorkTimeModification[] = []
): WorkTimeModification[] {
  const mergedHistory = new Map<string, WorkTimeModification>();

  for (const authoritativeEntry of authoritativeHistory) {
    mergedHistory.set(buildModificationSignature(authoritativeEntry), authoritativeEntry);
  }

  for (const legacyEntry of legacyHistory) {
    const signature = buildModificationSignature(legacyEntry);
    if (!mergedHistory.has(signature)) {
      mergedHistory.set(signature, legacyEntry);
    }
  }

  return sortModificationHistory([...mergedHistory.values()]);
}

export function buildLegacyTimeModification(
  input: TimeModificationWriteInput
): WorkTimeModification {
  return {
    ...input,
    modifiedAt: Timestamp.now(),
  };
}

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
