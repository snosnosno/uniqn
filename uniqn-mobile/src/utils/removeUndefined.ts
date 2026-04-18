/**
 * UNIQN Mobile - undefined 필드 제거 유틸리티
 *
 * @description 일부 DB 드라이버는 undefined 값을 허용하지 않으므로 재귀적으로 제거.
 * Supabase 저장 직전 정제 용도.
 */

/**
 * 특수 객체 여부 판정
 *
 * @description Date 인스턴스만 재귀 순회하지 않고 그대로 보존.
 * Firebase TimestampLike({toDate}) 또는 {seconds, nanoseconds} 같은 객체가
 * 이 함수에 도달하면 schema 우회 경로의 버그. 재귀 순회하여 플래튼되면서
 * 런타임에 문제가 드러나게 둔다 (silent leak 보다 낫다).
 *
 * 과거 동작: toDate() / isEqual() 메서드를 가진 객체를 보존 → schema 우회 시
 * JSON.stringify가 {seconds, nanoseconds} 직렬화를 emit → Supabase 22007 재발.
 * adversarial review HIGH 2에 따라 escape hatch 제거 (2026-04-19).
 */
function isSpecialObject(value: unknown): boolean {
  return value instanceof Date;
}

/**
 * 값에서 undefined를 재귀적으로 제거 (배열, 중첩 객체 지원)
 */
function removeUndefinedValue(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) {
    return value.filter((v) => v !== undefined).map(removeUndefinedValue);
  }
  if (typeof value !== 'object') return value;
  if (isSpecialObject(value)) return value;

  return removeUndefined(value as Record<string, unknown>);
}

/**
 * 객체에서 undefined 값을 재귀적으로 제거
 *
 * @description undefined 필드가 있으면 문제가 되는 DB/직렬화 경로(Supabase 저장 등)
 * 에서 사용. Date / Timestamp 래퍼 같은 특수 객체는 재귀하지 않고 그대로 보존.
 *
 * @param obj - 정제할 객체
 * @returns undefined 필드가 제거된 새 객체
 *
 * @example
 * ```typescript
 * const data = removeUndefined({
 *   title: '공고 제목',
 *   description: undefined,  // 제거됨
 *   location: {
 *     address: '서울',
 *     detail: undefined,     // 재귀적으로 제거됨
 *   },
 *   tags: ['a', undefined],  // 배열 내부도 처리
 *   createdAt: new Date(),   // 특수 객체 보존
 * });
 * ```
 */
export function removeUndefined<T extends Record<string, unknown>>(obj: T): T {
  return Object.fromEntries(
    Object.entries(obj)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => [k, removeUndefinedValue(v)])
  ) as T;
}
