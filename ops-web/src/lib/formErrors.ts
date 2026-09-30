import type { ZodError } from 'zod';

/** zod 에러 → 필드별 첫 메시지. 중첩 경로는 첫 키로 모은다(폼은 평평하다). */
export function toFieldErrors(error: ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? '');
    if (!(key in out)) out[key] = issue.message;
  }
  return out;
}

/**
 * 제출 실패 시 첫 오류 칸으로 포커스를 옮긴다 — 스크린리더가 aria-describedby 로 연결된
 * 오류 문구를 바로 읽는다. `order` 는 화면 순서(필드 id).
 */
export function focusFirstError(errors: Record<string, string>, order: readonly string[]): void {
  const first = order.find((id) => id in errors);
  if (first) document.getElementById(first)?.focus();
}
