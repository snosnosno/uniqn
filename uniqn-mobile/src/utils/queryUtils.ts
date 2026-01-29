/**
 * UNIQN Mobile - Query 유틸리티
 *
 * @description React Query Key 생성 및 캐싱 관련 유틸리티
 * @version 1.0.0
 */

/**
 * Query Key용 필터 객체 안정화
 *
 * @description
 * - undefined 값을 제거하고 키를 정렬하여 일관된 Query Key 생성
 * - JSON.parse(JSON.stringify()) 대신 사용하여 성능 개선
 *
 * @param filters - 필터 객체
 * @returns 안정화된 필터 객체
 *
 * @example
 * ```ts
 * // 기존 (비효율적)
 * queryKey: queryKeys.schedules.list(filters ? JSON.parse(JSON.stringify(filters)) : {})
 *
 * // 개선 (stableFilters 사용)
 * queryKey: queryKeys.schedules.list(stableFilters(filters))
 * ```
 */
export function stableFilters<T extends object>(
  filters: T | undefined | null
): Record<string, unknown> {
  if (!filters) return {};

  // undefined 값 제거 및 키 정렬로 일관된 참조 생성
  const filterRecord = filters as Record<string, unknown>;
  const keys = Object.keys(filterRecord).filter(
    (key) => filterRecord[key] !== undefined && filterRecord[key] !== null
  );

  // 키 정렬하여 동일한 필터 객체에 대해 일관된 결과 보장
  keys.sort();

  return keys.reduce(
    (acc, key) => {
      const value = filterRecord[key];

      // 중첩 객체도 안정화 (재귀)
      if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
        acc[key] = stableFilters(value as Record<string, unknown>);
      } else {
        acc[key] = value;
      }

      return acc;
    },
    {} as Record<string, unknown>
  );
}

/**
 * Query Key 비교 유틸리티
 *
 * @description 두 Query Key가 동일한지 비교
 */
export function areQueryKeysEqual(
  keyA: readonly unknown[],
  keyB: readonly unknown[]
): boolean {
  if (keyA.length !== keyB.length) return false;

  return keyA.every((item, index) => {
    const otherItem = keyB[index];

    if (typeof item === 'object' && item !== null) {
      return JSON.stringify(item) === JSON.stringify(otherItem);
    }

    return item === otherItem;
  });
}
