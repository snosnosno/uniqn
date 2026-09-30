import type { ZodError } from 'zod';

/** 화면에 있는 입력칸 id(화면 순서) — 포커스 이동 순서이기도 하다. */
export const FIELD_ORDER = [
  'name',
  'venue',
  'eventDate',
  'gameType',
  'startingChips',
  'seatsPerTable',
  'buyInChips',
  'buyInCost',
  'feeCost',
  'bountyCost',
  'rebuyChips',
  'rebuyCost',
  'addonChips',
  'addonCost',
  'jobPostingId',
] as const;

const FIELDS = new Set<string>(FIELD_ORDER);

/**
 * 생성 스키마 오류 → 입력칸별 문구 + 칸이 없는 오류(폼 전체 문구).
 * `config.*` 는 바이인·리바이 등 칸으로 풀어 준다. 칸에 대응하지 않는 오류를 버리면
 * 제출이 아무 반응 없이 멈춘다(리뷰 W3) — 그런 건 `other` 로 모아 FormError 로 보인다.
 */
export function toCreateFormErrors(error: ZodError): {
  fields: Record<string, string>;
  other: string | null;
} {
  const fields: Record<string, string> = {};
  const other: string[] = [];
  for (const issue of error.issues) {
    const [head, sub] = issue.path.map(String);
    const key = head === 'config' && sub ? sub : head;
    if (key && FIELDS.has(key)) {
      if (!(key in fields)) fields[key] = issue.message;
    } else if (!other.includes(issue.message)) {
      other.push(issue.message);
    }
  }
  return { fields, other: other.length > 0 ? other.join(' · ') : null };
}
