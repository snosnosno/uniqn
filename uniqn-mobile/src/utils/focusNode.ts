/**
 * DOM focus 가능 노드만 안전하게 포커스 (a11y C2)
 *
 * 웹(RN-web)에서 View/Text ref 는 실제 DOM 노드라 focus() 가 있고,
 * 네이티브·테스트 렌더러의 ref 인스턴스에는 없다. 호출부가 플랫폼 분기 없이
 * 한 줄로 쓰도록 가드를 내장한다 — focus 불가면 조용한 no-op.
 */
export function focusIfPossible(node: unknown): boolean {
  if (
    node !== null &&
    node !== undefined &&
    typeof (node as { focus?: unknown }).focus === 'function'
  ) {
    (node as { focus: () => void }).focus();
    return true;
  }
  return false;
}
