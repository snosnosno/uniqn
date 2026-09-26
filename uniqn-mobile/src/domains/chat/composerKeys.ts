/**
 * 웹 채팅 입력창 키 규칙 — Enter 전송 · Alt+Enter(·Shift+Enter) 줄바꿈 (09-26 QA)
 *
 * textarea 기본 동작: Enter·Shift+Enter 는 줄바꿈, Alt+Enter 는 아무 일도 안 한다.
 * 그래서 Enter 는 막고 보내며, Alt+Enter 는 직접 줄바꿈을 넣고, Shift+Enter 는 기본 동작에 맡긴다.
 *
 * 📱 터치 기기(거친 포인터)의 웹은 제외 — 가상 키보드엔 Alt·Shift+Enter 가 없어 Enter 를 전송으로
 *    가로채면 여러 줄을 쓸 방법이 사라진다. 네이티브 앱과 같게 Enter=줄바꿈, 전송은 버튼.
 *
 * 🚨 한글 조합 중 Enter 는 무시한다 — 안 그러면 조합 중인 글자가 반만 보내지거나(윈도우),
 *    조합 확정 Enter 와 다음 Enter 가 두 번 보내진다(macOS). Safari 는 compositionend 가 keydown 보다
 *    먼저 와 isComposing 이 false 라 keyCode 229 도 본다(react-native-web TextInput 과 같은 판정).
 */
export interface ComposerKeyEvent {
  key: string;
  altKey?: boolean;
  shiftKey?: boolean;
  isComposing?: boolean;
  keyCode?: number;
  /** 터치 기기(`(pointer: coarse)`) — 가상 키보드 */
  coarsePointer?: boolean;
}

export type ComposerKeyAction = 'send' | 'newline' | 'default';

export function composerKeyAction(event: ComposerKeyEvent): ComposerKeyAction {
  if (event.key !== 'Enter' || event.coarsePointer) return 'default';
  if (event.isComposing || event.keyCode === 229) return 'default';
  if (event.shiftKey) return 'default';
  if (event.altKey) return 'newline';
  return 'send';
}

/** 선택 영역을 줄바꿈으로 바꾼 새 값과 커서 위치 */
export function insertNewlineAt(
  value: string,
  selectionStart: number,
  selectionEnd: number
): { value: string; cursor: number } {
  const start = Math.max(0, Math.min(selectionStart, value.length));
  const end = Math.max(start, Math.min(selectionEnd, value.length));
  return { value: `${value.slice(0, start)}\n${value.slice(end)}`, cursor: start + 1 };
}
