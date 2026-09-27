import { describe, expect, it } from 'vitest';
import { canConfirm, CONFIRM_ARM_MS, shouldHandleHotkey } from './keyGuards';

describe('canConfirm — 확인창 확정 가드(D1 리뷰 H3)', () => {
  const opened = 1_000;

  it('열린 직후(무장 시간 안)에는 확정하지 않는다 — 여는 Enter 가 그대로 확정되는 것 방지', () => {
    expect(
      canConfirm({ openedAt: opened, now: opened + 10, repeat: false, alreadyConfirmed: false })
    ).toBe(false);
  });

  it('키 자동반복(누르고 있기)은 확정하지 않는다', () => {
    expect(
      canConfirm({
        openedAt: opened,
        now: opened + CONFIRM_ARM_MS + 50,
        repeat: true,
        alreadyConfirmed: false,
      })
    ).toBe(false);
  });

  it('한 번 확정했으면 두 번째는 막는다(이중 RPC 방지)', () => {
    expect(
      canConfirm({
        openedAt: opened,
        now: opened + CONFIRM_ARM_MS + 50,
        repeat: false,
        alreadyConfirmed: true,
      })
    ).toBe(false);
  });

  it('무장 후 첫 확정은 통과', () => {
    expect(
      canConfirm({
        openedAt: opened,
        now: opened + CONFIRM_ARM_MS,
        repeat: false,
        alreadyConfirmed: false,
      })
    ).toBe(true);
  });
});

describe('shouldHandleHotkey — 단축키 오발동 가드(D1 리뷰 M1)', () => {
  const base = {
    code: 'KeyX',
    repeat: false,
    isComposing: false,
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    editableTarget: false,
    dialogOpen: false,
  };

  it('물리 키 코드로 판정한다 — 한글 입력 모드(key=ㅌ)에서도 동작', () => {
    expect(shouldHandleHotkey(base, 'KeyX')).toBe(true);
    expect(shouldHandleHotkey({ ...base, code: 'KeyR' }, 'KeyX')).toBe(false);
  });

  it.each([
    ['조합 중(IME)', { isComposing: true }],
    ['Ctrl+X(잘라내기)', { ctrlKey: true }],
    ['Cmd+X', { metaKey: true }],
    ['Alt 조합', { altKey: true }],
    ['입력칸 안', { editableTarget: true }],
    ['다른 대화상자 열림', { dialogOpen: true }],
    ['자동반복', { repeat: true }],
  ])('%s 이면 무시', (_label, override) => {
    expect(shouldHandleHotkey({ ...base, ...override }, 'KeyX')).toBe(false);
  });
});
