/**
 * 키보드 조작 가드 — 속도는 올리되 오조작은 막는다(DESIGN.md 상호작용, D1 코드 리뷰 H3·M1).
 * DOM 에 묶이지 않은 순수 함수로 두어 테스트한다. 훅·컴포넌트는 이 판정만 호출한다.
 */

/** 확인창이 열리고 이 시간 안의 확정은 무시한다 — 여는 데 쓴 Enter 가 그대로 확정되는 것 방지. */
export const CONFIRM_ARM_MS = 150;

interface ConfirmAttempt {
  openedAt: number;
  now: number;
  repeat: boolean;
  alreadyConfirmed: boolean;
}

export function canConfirm({ openedAt, now, repeat, alreadyConfirmed }: ConfirmAttempt): boolean {
  if (alreadyConfirmed || repeat) return false;
  return now - openedAt >= CONFIRM_ARM_MS;
}

interface HotkeyEvent {
  /** 물리 키 코드(KeyX). event.key 는 한글 입력 모드에서 'ㅌ'·'Process' 가 되어 쓰지 않는다. */
  code: string;
  repeat: boolean;
  isComposing: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  /** 입력칸·선택상자·편집 가능 영역 안에서 눌렀는가 */
  editableTarget: boolean;
  /** 다른 대화상자·시트가 열려 있는가 */
  dialogOpen: boolean;
}

export function shouldHandleHotkey(event: HotkeyEvent, code: string): boolean {
  if (event.code !== code) return false;
  if (event.repeat || event.isComposing) return false;
  if (event.ctrlKey || event.metaKey || event.altKey) return false;
  return !event.editableTarget && !event.dialogOpen;
}
