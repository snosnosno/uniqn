/**
 * UNIQN Mobile - Firestore undefined 필드 제거 유틸리티
 *
 * @description Firestore는 undefined 값을 허용하지 않으므로 재귀적으로 제거
 */

/**
 * Firebase 특수 객체 여부 판정
 *
 * @description Timestamp, Date, FieldValue 등은 일반 객체처럼 재귀 순회하면
 * 인스턴스가 파괴되므로 그대로 보존해야 함
 */
function isFirebaseSpecialObject(value: unknown): boolean {
  if (value instanceof Date) return true;

  const obj = value as Record<string, unknown>;
  // Timestamp: toDate() 메서드 보유
  if (typeof obj.toDate === 'function') return true;
  // FieldValue (serverTimestamp, increment 등): isEqual() 메서드 보유
  if (typeof obj.isEqual === 'function') return true;

  return false;
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
  if (isFirebaseSpecialObject(value)) return value;

  return removeUndefined(value as Record<string, unknown>);
}

/**
 * 객체에서 undefined 값을 재귀적으로 제거
 *
 * @description Firestore 문서 저장 시 undefined 필드가 있으면 에러 발생하므로
 * 저장 전에 이 함수로 정제. Firebase 특수 객체(Timestamp, Date, FieldValue)는
 * 재귀하지 않고 그대로 보존.
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
 *   createdAt: serverTimestamp(), // Firebase 특수 객체 보존
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
