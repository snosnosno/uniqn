import { collection, collectionGroup, doc, getDocs, query, where } from 'firebase/firestore';
import { COLLECTIONS } from '@/constants';
import { getFirebaseDb } from '@/lib/firebase';
import type { WorkTimeModification } from '@/types';
import { logger } from '@/utils/logger';
import { normalizeTimeModificationRecord } from './legacyBridgeMerger';

const TIME_MODIFICATION_LOGS_COLLECTION = 'timeModificationLogs';
const COLLECTION_GROUP_BATCH_SIZE = 10;

function chunkWorkLogIds(workLogIds: string[]): string[][] {
  const chunks: string[][] = [];

  for (let index = 0; index < workLogIds.length; index += COLLECTION_GROUP_BATCH_SIZE) {
    chunks.push(workLogIds.slice(index, index + COLLECTION_GROUP_BATCH_SIZE));
  }

  return chunks;
}

export function getTimeModificationCollection(workLogId: string) {
  return collection(
    doc(getFirebaseDb(), COLLECTIONS.WORK_LOGS, workLogId),
    TIME_MODIFICATION_LOGS_COLLECTION
  );
}

export async function fetchAuthoritativeLogsByWorkLogIds(workLogIds: string[]) {
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
