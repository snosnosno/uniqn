import { Timestamp } from 'firebase/firestore';
import type { WorkTimeModification } from '@/types';
import { toDateValue, type DateInput } from '@/utils/date';

export type TimeModificationWriteInput = Omit<WorkTimeModification, 'modifiedAt'>;

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

export function normalizeTimeModificationRecord(data: unknown): WorkTimeModification | null {
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
