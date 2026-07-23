const MAX_NAMES = 3;

interface BulkFailureSource {
  failedCount: number;
  results: readonly { success: boolean; workLogId: string }[];
}

/**
 * 일괄 정산 실패 토스트 문구 — 서버 results[]에서 실패자를 이름으로 나열한다.
 * 이름 해소가 안 되면(캐시 미스·results 미제공) 건수만 표시하는 기존 문구로 폴백.
 */
export function formatBulkSettlementFailures(
  result: BulkFailureSource,
  nameByWorkLogId: ReadonlyMap<string, string>
): string | null {
  if (result.failedCount === 0) {
    return null;
  }

  const failed = result.results.filter((r) => !r.success);
  const names = failed
    .map((r) => nameByWorkLogId.get(r.workLogId))
    .filter((name): name is string => !!name);

  if (names.length === 0) {
    return `${result.failedCount}건 정산 실패`;
  }

  const shown = names.slice(0, MAX_NAMES);
  const remaining = result.failedCount - shown.length;
  const suffix = remaining > 0 ? ` 외 ${remaining}건` : '';

  return `${result.failedCount}건 정산 실패 — ${shown.join(', ')}${suffix}`;
}

/**
 * settlement 캐시(getQueriesData 결과)에서 workLogId/id → staffName 맵 구축.
 * 캐시 항목 구조를 신뢰하지 않고 런타임 타입 가드로만 수집한다.
 */
export function buildWorkLogNameMap(
  cachedQueries: readonly (readonly [unknown, unknown])[]
): Map<string, string> {
  const map = new Map<string, string>();

  for (const [, data] of cachedQueries) {
    if (!Array.isArray(data)) {
      continue;
    }
    for (const entry of data) {
      if (typeof entry !== 'object' || entry === null) {
        continue;
      }
      const record = entry as Record<string, unknown>;
      const name = typeof record.staffName === 'string' ? record.staffName : undefined;
      if (!name) {
        continue;
      }
      if (typeof record.workLogId === 'string') {
        map.set(record.workLogId, name);
      }
      if (typeof record.id === 'string') {
        map.set(record.id, name);
      }
    }
  }

  return map;
}
